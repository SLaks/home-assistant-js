import { css, html, LitElement } from "lit";
import { TodoItem, TodoItemStatus, updateItem } from "./todos";
import { property } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { classMap } from "lit/directives/class-map.js";

class PopupTodoCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: "entity-id" }) entityId?: string;
  @property({ attribute: false }) item?: TodoItem;

  static styles = css`
    .Card {
      height: 300px;
      width: 400px;

      background-color: var(--paper-item-icon-color);

      color: #1c1c1c;
      overflow: hidden;

      display: flex;
      flex-direction: column;

      .Icon {
        flex-grow: 1;
      }

      &.isCompleted {
        background-color: #388e3c;
        color: white;
      }
    }
  `;

  markCompleted() {
    updateItem(this.hass!, this.entityId!, {
      ...this.item!,
      status: TodoItemStatus.Completed,
    });
  }

  protected override render(): unknown {
    if (!this.hass || !this.item) return null;
    const isCompleted = this.item.status === TodoItemStatus.Completed;
    return html`
      <ha-card
        class="Card ${classMap({ isCompleted })}"
        @click=${this.markCompleted}
      >
        <div class="Icon">
          <ha-icon icon="mdi:todo"></ha-icon>
        </div>
        <div class="Name">${this.item.summary}</div>
      </ha-card>
    `;
  }
}
customElements.define("popup-todo-card", PopupTodoCard);
