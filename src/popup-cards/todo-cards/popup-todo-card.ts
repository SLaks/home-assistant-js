import "../base/card-base";
import "../base/emoji-icon";
import "./snoozer";
import { html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { TodoItem, updateItem, TodoItemStatus } from "../../todos/ha-api";
import "./todo-icon";

class PopupTodoCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) entityId?: string;
  @property({ attribute: false }) item?: TodoItem;

  async markCompleted() {
    const updatedItem = {
      ...this.item!,
      status: TodoItemStatus.Completed,
    };
    await updateItem(this.hass!, this.entityId!, updatedItem);
    await this.hass!.callApi("POST", `events/popup_todo_completed`, {
      ...updatedItem,
      entity_id: this.entityId,
    });
  }

  protected override render(): unknown {
    if (!this.hass || !this.item) return null;
    return html`
      <popup-card-base
        ?is-completed=${this.item.status === TodoItemStatus.Completed}
        @click=${this.markCompleted}
      >
        <popup-todo-icon slot="icon" .item=${this.item}></popup-todo-icon>
        <div slot="name">${this.item.summary}</div>
        <popup-todo-snoozer
          slot="actions"
          .hass=${this.hass}
          .entityId=${this.entityId}
          .item=${this.item}
        ></popup-todo-snoozer>
      </popup-card-base>
    `;
  }
}
customElements.define("popup-todo-card", PopupTodoCard);
