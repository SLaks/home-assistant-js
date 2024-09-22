import { HomeAssistant } from "custom-card-helpers/dist/types";
import { html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { TodoItem } from "./ha-api";
import dayjs from "dayjs";

class TodoHistoryIndex extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;

  @property({ attribute: "entity-id" })
  entityId?: string;

  @property({ attribute: "index-field" })
  indexField?: keyof TodoItem;

  protected override render(): unknown {
    if (!this.hass || !this.entityId || !this.indexField) return "";
    return html`
      <todo-items-subscriber
        .hass=${this.hass}
        .entityId=${this.entityId}
        @items-updated=${this.onTodoItemsChanged}
      ></todo-items-subscriber>
    `;
  }
  private onTodoItemsChanged(e: CustomEvent<TodoItem[]>) {
    const map: TodoIndex = new Map();
    const upperBound = dayjs().startOf("day").toDate();
    for (const item of e.detail.sort(
      (a, b) => -(a.due ?? "").localeCompare(b.due ?? ""),
    )) {
      if (!item.due || !dayjs(item.due).isBefore(upperBound, "day")) continue;
      const field = item[this.indexField!];
      if (field && !map.has(field)) map.set(field, item);
    }
    this.dispatchEvent(
      new CustomEvent<TodoIndex>("todo-index-updated", {
        detail: map,
      }),
    );
  }
}

/** Maps a todo item's `indexField` to the most recent item of that field. */
export type TodoIndex = Map<string, TodoItem>;

customElements.define("todo-history-index", TodoHistoryIndex);
