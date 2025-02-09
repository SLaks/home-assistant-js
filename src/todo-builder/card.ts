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

type ListIdFields = "targetList" | "longTermList" | "templateList";

class TodoBuilderCardElement extends SimpleEntityBasedElement {
  @state()
  targetList: TodoItemWithEntity[] = [];
  @state()
  longTermList: TodoItemWithEntity[] = [];
  @state()
  templateList: TodoItemWithEntity[] = [];

  @state()
  listToEntityIds = new Map<ListIdFields, string>();
  @state()
  entityIdToLists = new Map<string, ListIdFields>();
  @state()
  targetDays?: DateOption[];

  /**
   * Suppresses updates from intermediary states while saving.
   * This prevents a flsah of an uncompleted item (in a different position in the list)
   * when dragging a new item to an already-completed column.
   */
  @state()
  isSaving = false;

  /**
   * Used to recreate all SortableJS DOM when dragging fails.
   * Otherwise, we get duplicate items, or items missing properties that cannot be dragged
   * a second time.
   */
  @state()
  forceRerender = 0;

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
    this.listToEntityIds = new Map([
      ["targetList", config.target_list],
      ["longTermList", config.long_term_list],
      ["templateList", config.template_list],
    ]);
    this.entityIdToLists = new Map(
      this.listToEntityIds.entries().map(([k, v]) => [v, k]),
    );
  }

  private async deleteTodo(e: CustomEvent<TodoItemWithEntity>) {
    try {
      await deleteItems(this.hass!, e.detail.entityId, [e.detail.uid]);
    } catch (e) {
      this.reportError(e);
      throw e;
    }
  }
  private async updateTodo(e: CustomEvent<UpdateItemDetail>) {
    this.isSaving = true;
    try {
      const promises: Promise<unknown>[] = [];
      const sourceListId = e.detail.item.entityId;
      if (
        sourceListId &&
        sourceListId !== e.detail.targetEntity &&
        sourceListId !== this.listToEntityIds.get("templateList")
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

      if ("previousUid" in e.detail) {
        promises.push(
          moveItem(
            this.hass!,
            e.detail.targetEntity,
            updatedItem.uid,
            e.detail.previousUid,
          ),
        );
      }
      await Promise.all(promises);
    } catch (e) {
      this.forceRerender++;
      this.reportError(e);
      throw e;
    } finally {
      this.isSaving = false;
    }
  }

  private reportError(e: unknown) {
    this.dispatchEvent(
      new CustomEvent("hass-notification", {
        composed: true,
        detail: { message: (e as Error)?.message || "Error!" },
      }),
    );
    console.error(e);
  }

  /** Sets the `uid` field of an just-inserted item, finding the inserted item in the list. */
  private async setNewItemUid(insertedItem: TodoItemWithEntity) {
    for (let i = 0; i < 5; i++) {
      const list = this[this.entityIdToLists.get(insertedItem.entityId)!];
      const createdItem = list.findLast(
        (item) =>
          // Todos cannot be created as completed.
          item.status === TodoItemStatus.NeedsAction &&
          item.summary === insertedItem.summary &&
          // If the inserted item has no descrption, don't match that, in case
          // an automation added a description.
          (!item.description ||
            item.description === insertedItem.description) &&
          normalizeDueDate(item.due) === normalizeDueDate(insertedItem.due),
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
        force-rerender=${this.forceRerender}
        long-term-list-id=${ifDefined(this.listToEntityIds.get("longTermList"))}
        target-list-id=${ifDefined(this.listToEntityIds.get("targetList"))}
        .targetList=${this.targetList}
        .templateList=${this.templateList}
        .fullLongTermList=${this.longTermList}
        .targetDays=${this.targetDays || []}
        .hass=${this.hass}
        @update-todo=${this.updateTodo}
        @delete-todo=${this.deleteTodo}
      ></todo-builder>
      ${this.listToEntityIds
        .entries()
        .map(([field, entityId]) => this.renderTodoSubscriber(entityId, field))}
      <todo-target-days
        .hass=${this.hass}
        @target-days-updated=${(e: CustomEvent<TodoTargetDetails>) =>
          (this.targetDays = e.detail.fullWeek)}
      ></todo-target-days>
    `;
  }

  private renderTodoSubscriber(entityId: string, field: ListIdFields) {
    return html`
      <todo-items-subscriber
        .hass=${this.hass}
        entity-id=${entityId}
        @items-updated=${(e: CustomEvent<TodoItemWithEntity[]>) =>
          (this[field] = e.detail)}
      ></todo-items-subscriber>
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

function normalizeDueDate(due: string | undefined | null): number | null {
  if (!due) return null;
  return +new Date(due);
}
