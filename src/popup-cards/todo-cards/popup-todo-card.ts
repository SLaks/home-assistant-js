import "../base/card-base";
import "./snoozer";
import { html, LitElement, PropertyValues } from "lit";
import { TodoDetails } from "./due-times";
import { property, state } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { TodoItem, updateItem, TodoItemStatus } from "../../todos/ha-api";

const defaultEmoji = "☑️";

class PopupTodoCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) entityId?: string;
  @property({ attribute: false }) item?: TodoItem;
  @state() private details: TodoDetails = {};
  @state() private emoji = defaultEmoji;
  @state() private emojiSize = getGraphemeCount(this.emoji);

  protected override willUpdate(changedProps: PropertyValues<this>): void {
    if (changedProps.has("item")) {
      try {
        this.details = JSON.parse(this.item?.description ?? "{}") ?? {};
      } catch {
        this.details = {};
      }
      this.emoji = this.details.emoji ?? defaultEmoji;
      this.emojiSize = getGraphemeCount(this.emoji);
    }
  }

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
        <svg slot="icon" viewBox="0 0 ${this.emojiSize * 24} 18">
          <text x="0" y="15">${this.emoji}</text>
        </svg>
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
function getGraphemeCount(str: string) {
  const segmenter = new Intl.Segmenter("en-US", { granularity: "grapheme" });
  // The Segments object iterator that is used here iterates over characters in grapheme clusters,
  // which may consist of multiple Unicode characters
  return [...segmenter.segment(str)].length;
}
