import "./snoozer";
import { css, html, LitElement, PropertyValues } from "lit";
import { TodoDetails } from "./due-times";
import { property, state } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { classMap } from "lit/directives/class-map.js";
import { TodoItem, updateItem, TodoItemStatus } from "../todos/ha-api";

const defaultEmoji = "☑️";

class PopupTodoCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) entityId?: string;
  @property({ attribute: false }) item?: TodoItem;
  @state() private details: TodoDetails = {};
  @state() private emoji = defaultEmoji;
  @state() private emojiSize = getGraphemeCount(this.emoji);

  static styles = css`
    .Card {
      height: 300px;
      max-width: 400px;

      background-color: var(--paper-item-icon-color);

      color: var(--primary-background-color);
      overflow: hidden;

      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
      gap: 12px;

      font-size: 1.2rem;
      text-align: center;
      text-overflow: ellipsis;

      .Name {
        font-size: var(--popup-todo-card-name-font-size, 1.3rem);
      }

      .Icon {
        flex-grow: 1;
        align-self: stretch;
        display: flex;
        place-content: center;
        min-height: 0;

        svg {
          width: 80%;
        }
      }

      &.isCompleted {
        background-color: #388e3c;
        color: white;
      }

      popup-todo-snoozer {
        align-self: stretch;
        flex-shrink: 0;
      }
    }
  `;

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
    const isCompleted = this.item.status === TodoItemStatus.Completed;
    return html`
      <ha-card
        class="Card ${classMap({ isCompleted })}"
        @click=${this.markCompleted}
      >
        <div class="Icon">
          <svg viewBox="0 0 ${this.emojiSize * 24} 18">
            <text x="0" y="15">${this.emoji}</text>
          </svg>
        </div>
        <div class="Name">${this.item.summary}</div>
        <md-ripple></md-ripple>
        <popup-todo-snoozer
          .hass=${this.hass}
          .entityId=${this.entityId}
          .item=${this.item}
          @keydown=${(e: Event) => e.stopPropagation()}
          @closed=${(e: Event) => e.stopPropagation()}
          @pointerdown=${(e: Event) => e.stopPropagation()}
          @click=${(e: Event) => e.stopPropagation()}
        ></popup-todo-snoozer>
      </ha-card>
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
