import "../base/card-base";
import "../base/emoji-icon";
import "./snoozer";
import "./todo-icon";
import { css, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { updateItem, TodoItemStatus } from "../../todos/ha-api";
import { TodoItemWithEntity } from "../../todos/subscriber";
import { applyTodoActions, isUrgent } from "./todo-actions";
import { classMap } from "lit/directives/class-map.js";

class PopupTodoCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) item?: TodoItemWithEntity;
  @state() isUrgent = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.item) this.isUrgent = isUrgent(this.item);
  }
  protected willUpdate(changedProperties: PropertyValues): void {
    super.willUpdate(changedProperties);
    if (this.item && changedProperties.has("item")) {
      this.isUrgent = isUrgent(this.item);
    }
  }

  async markCompleted() {
    await updateItem(
      this.hass!,
      this.item!.entityId,
      applyTodoActions(this.hass!, this.item!, {
        status: TodoItemStatus.Completed,
      }),
    );
  }
  static styles = css`
    .Urgent {
      --ha-card-border-color: #c62828;
      --ha-card-border-width: 4px;
    }
  `;

  protected override render(): unknown {
    if (!this.hass || !this.item) return null;
    return html`
      <popup-card-base
        class=${classMap({ Urgent: this.isUrgent })}
        ?is-completed=${this.item.status === TodoItemStatus.Completed}
        @click=${this.markCompleted}
      >
        <popup-todo-icon
          slot="icon"
          .hass=${this.hass}
          .item=${this.item}
        ></popup-todo-icon>
        <div slot="name">${this.item.summary}</div>
        <popup-todo-snoozer
          slot="actions"
          .isUrgent=${this.isUrgent}
          .hass=${this.hass}
          .item=${this.item}
        ></popup-todo-snoozer>
      </popup-card-base>
    `;
  }
}
customElements.define("popup-todo-card", PopupTodoCard);
