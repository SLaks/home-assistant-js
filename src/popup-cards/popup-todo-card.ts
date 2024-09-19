import { css, html, LitElement, PropertyValues } from "lit";
import { TodoItem, TodoItemStatus, updateItem } from "./todos";
import { property, state } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { classMap } from "lit/directives/class-map.js";

interface TodoDetails {
  emoji?: string;
}

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

      color: #1c1c1c;
      overflow: hidden;

      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4% 0;

      font-size: 1.2rem;
      text-align: center;
      text-overflow: ellipsis;

      .Icon {
        flex-grow: 1;
        align-self: stretch;
        display: flex;
        place-content: center;

        svg {
          width: 80%;
        }
      }

      &.isCompleted {
        background-color: #388e3c;
        color: white;
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
          <svg viewBox="0 0 ${this.emojiSize * 24} 18">
            <text x="0" y="15">${this.emoji}</text>
          </svg>
        </div>
        <div class="Name">${this.item.summary}</div>
        <md-ripple></md-ripple>
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
