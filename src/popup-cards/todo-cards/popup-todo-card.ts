import "../base/card-base";
import "../base/emoji-icon";
import "./snoozer";
import "./todo-icon";
import { html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { updateItem, TodoItemStatus } from "../../todos/ha-api";
import { TodoItemWithEntity } from "../../todos/subscriber";

class PopupTodoCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) item?: TodoItemWithEntity;

  async markCompleted() {
    const updatedItem = {
      ...this.item!,
      status: TodoItemStatus.Completed,
    };
    await updateItem(this.hass!, this.item!.entityId, updatedItem);
    await this.hass!.callApi("POST", `events/popup_todo_completed`, {
      ...updatedItem,
      entity_id: this.item!.entityId,
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
          .item=${this.item}
        ></popup-todo-snoozer>
      </popup-card-base>
    `;
  }
}
customElements.define("popup-todo-card", PopupTodoCard);
