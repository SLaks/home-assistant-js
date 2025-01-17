import "../popup-cards/todo-cards/target-days";
import "../todos/subscriber";
import { state } from "lit/decorators.js";
import { SimpleEntityBasedElement } from "../base-elements";
import { html } from "lit";
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
  targetList?: TodoItemWithEntity[];
  @state()
  templateList?: TodoItemWithEntity[];
  @state()
  longTermList?: TodoItemWithEntity[];
  @state()
  targetDays?: DateOption[];

  static getStubConfig(): CardConfig {
    return {
      target_list: "todo.my_tasks",
      long_term_list: "todo.long_term_tasks",
      template_list: "todo.common_tasks",
    };
  }

  setConfig(config: CardConfig) {
    this.targetListId = config.target_list;
    this.longTermListId = config.long_term_list;
    this.templateListId = config.template_list;
  }

  private async updateTodo(e: CustomEvent<UpdateItemDetail>) {
    const promises: Promise<unknown>[] = [];
    const sourceListId = e.detail.item.entityId;
    if (
      sourceListId &&
      sourceListId !== e.detail.targetEntity &&
      sourceListId !== this.templateListId
    ) {
      promises.push(deleteItems(this.hass!, sourceListId, [e.detail.item.uid]));
    }
    const updatedItem = applyTodoActions(
      this.hass!,
      { ...e.detail.item, entityId: e.detail.targetEntity },
      e.detail,
    );

    if (sourceListId === e.detail.targetEntity) {
      promises.push(updateItem(this.hass!, e.detail.targetEntity, updatedItem));
    } else {
      const created = createItem(
        this.hass!,
        e.detail.targetEntity,
        updatedItem,
      );
      promises.push(created);
      if (e.detail.status === TodoItemStatus.Completed) {
        // HA cannot create already-completed items, so immediately update it to be completed.
        await created;
        promises.push(this.markNewItemAsCompleted(updatedItem));
      }
    }
  }

  /** Finds a newly-inserted item and marks it as completed. */
  private async markNewItemAsCompleted(insertedItem: TodoItemWithEntity) {
    for (let i = 0; i < 5; i++) {
      const createdItem = this.targetList?.find(
        (item) =>
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
      await updateItem(this.hass!, insertedItem.entityId, {
        ...createdItem,
        status: TodoItemStatus.Completed,
      });
      return;
    }
    console.warn("Could not find created item", insertedItem);
  }

  override render() {
    if (!this.hass) return html`Loading...`;

    return html`
      <todo-builder
        long-term-list-id=${ifDefined(this.longTermListId)}
        target-list-id=${ifDefined(this.targetListId)}
        .targetList=${this.targetList || []}
        .templateList=${this.templateList || []}
        .longTermList=${this.longTermList || []}
        .targetDays=${this.targetDays || []}
        @update-todo=${this.updateTodo}
      ></todo-builder>
      <todo-target-days
        .hass=${this.hass}
        @target-days-updated=${(e: CustomEvent<TodoTargetDetails>) =>
          (this.targetDays = e.detail.fullWeek)}
      ></todo-target-days>
      <todo-items-subscriber
        .hass=${this.hass}
        entity-id=${ifDefined(this.targetListId)}
        @items-updated=${(e: CustomEvent<TodoItemWithEntity[]>) =>
          (this.targetList = e.detail)}
      ></todo-items-subscriber>
      <todo-items-subscriber
        .hass=${this.hass}
        entity-id=${ifDefined(this.longTermListId)}
        @items-updated=${(e: CustomEvent<TodoItemWithEntity[]>) =>
          (this.longTermList = e.detail)}
      ></todo-items-subscriber>
      <todo-items-subscriber
        .hass=${this.hass}
        entity-id=${ifDefined(this.templateListId)}
        @items-updated=${(e: CustomEvent<TodoItemWithEntity[]>) =>
          (this.templateList = e.detail)}
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
