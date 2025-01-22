import "../popup-cards/todo-cards/target-days";
import "../todos/subscriber";
import { state } from "lit/decorators.js";
import { SimpleEntityBasedElement } from "../base-elements";
import { html, PropertyValues } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import {
  DateOption,
  TodoTargetDetails,
} from "../popup-cards/todo-cards/target-days";
import "./builder-ui";
import { TodoItemWithEntity } from "../todos/subscriber";
import { UpdateItemDetail } from "./builder-ui";
import {
  createItem,
  deleteItems,
  moveItem,
  TodoItemStatus,
  updateItem,
} from "../todos/ha-api";
import { applyTodoActions } from "../popup-cards/todo-cards/todo-actions";

class TodoBuilderCardElement extends SimpleEntityBasedElement {
  @state()
  targetListId?: string;
  @state()
  longTermListId?: string;
  @state()
  templateListId?: string;

  @state()
  lists = new Map<string | undefined, TodoItemWithEntity[]>();
  @state()
  targetDays?: DateOption[];

  /**
   * Suppresses updates from intermediary states while saving.
   * This prevents a flsah of an uncompleted item (in a different position in the list)
   * when dragging a new item to an already-completed column.
   */
  @state()
  isSaving = false;

  static getStubConfig(): CardConfig {
    return {
      target_list: "todo.my_tasks",
      long_term_list: "todo.long_term_tasks",
      template_list: "todo.common_tasks",
    };
  }

  override shouldUpdate(changedProps: PropertyValues<this>): boolean {
    // Block all updates while saving, to prevent flicker.
    return !this.isSaving && super.shouldUpdate(changedProps);
  }

  setConfig(config: CardConfig) {
    this.targetListId = config.target_list;
    this.longTermListId = config.long_term_list;
    this.templateListId = config.template_list;
  }

  private async updateTodo(e: CustomEvent<UpdateItemDetail>) {
    this.isSaving = true;
    try {
      const promises: Promise<unknown>[] = [];
      const sourceListId = e.detail.item.entityId;
      if (
        sourceListId &&
        sourceListId !== e.detail.targetEntity &&
        sourceListId !== this.templateListId
      ) {
        promises.push(
          deleteItems(this.hass!, sourceListId, [e.detail.item.uid]),
        );
      }
      const updatedItem = applyTodoActions(
        this.hass!,
        { ...e.detail.item, entityId: e.detail.targetEntity },
        e.detail,
      );

      if (sourceListId === e.detail.targetEntity) {
        if (e.detail.due || e.detail.status !== e.detail.item.status) {
          promises.push(
            updateItem(this.hass!, e.detail.targetEntity, updatedItem),
          );
        }
      } else {
        promises.push(
          createItem(this.hass!, e.detail.targetEntity, updatedItem),
        );
        await promises[promises.length - 1];
        await this.setNewItemUid(updatedItem);
        if (e.detail.status === TodoItemStatus.Completed) {
          // HA cannot create already-completed items, so immediately update it to be completed.
          promises.push(
            updateItem(this.hass!, e.detail.targetEntity, {
              ...updatedItem,
              status: TodoItemStatus.Completed,
            }),
          );
          await promises[promises.length - 1];
        }
      }

      promises.push(
        moveItem(
          this.hass!,
          e.detail.targetEntity,
          updatedItem.uid,
          e.detail.previousUid,
        ),
      );
      e.detail.complete = Promise.all(promises);
      await e.detail.complete;
    } finally {
      this.isSaving = false;
    }
  }

  /** Sets the `uid` field of an just-inserted item, finding the inserted item in the list. */
  private async setNewItemUid(insertedItem: TodoItemWithEntity) {
    for (let i = 0; i < 5; i++) {
      const createdItem = this.lists.get(insertedItem.entityId)?.findLast(
        (item) =>
          // Todos cannot be created as completed.
          item.status === TodoItemStatus.NeedsAction &&
          item.summary === insertedItem.summary &&
          item.description === insertedItem.description &&
          new Date(item.due!).toISOString() ===
            new Date(insertedItem.due!).toISOString(),
      );
      if (!createdItem) {
        await new Promise((r) => setTimeout(r, (i + 1) * 100));
        continue;
      }
      insertedItem.uid = createdItem.uid;
      return;
    }
    console.warn("Could not find created item", insertedItem);
    throw new Error("Could not find created item");
  }

  override render() {
    if (!this.hass) return html`Loading...`;

    return html`
      <todo-builder
        long-term-list-id=${ifDefined(this.longTermListId)}
        target-list-id=${ifDefined(this.targetListId)}
        .targetList=${this.lists.get(this.targetListId) || []}
        .templateList=${this.lists.get(this.templateListId) || []}
        .longTermList=${this.lists.get(this.longTermListId) || []}
        .targetDays=${this.targetDays || []}
        @update-todo=${this.updateTodo}
      ></todo-builder>
${[this.targetListId, this.templateListId, this.longTermListId].map(
        (id) =>
          id &&
          html`
            <todo-items-subscriber
              .hass=${this.hass}
              entity-id=${id}
              @items-updated=${(e: CustomEvent<TodoItemWithEntity[]>) => {
                this.lists.set(id, e.detail);
                this.requestUpdate();
              }}
            ></todo-items-subscriber>
          `,
      )}
      <todo-target-days
        .hass=${this.hass}
        @target-days-updated=${(e: CustomEvent<TodoTargetDetails>) =>
          (this.targetDays = e.detail.fullWeek)}
      ></todo-target-days>
          `;
  }
}

interface CardConfig {
  target_list: string;
  long_term_list: string;
  template_list: string;
}
window.customCards ??= [];
window.customCards.push({
  type: "todo-builder-card",
  name: "Todo Builder",
  description: "Adds items from templates or long-term tasks to a todo list.",
});
customElements.define("todo-builder-card", TodoBuilderCardElement);
