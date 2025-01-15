import { css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { TodoItem } from "../todos/ha-api";
import "../popup-cards/todo-cards/todo-icon";

class TodoThumbnailCard extends LitElement {
  @property({ attribute: false }) item?: TodoItem;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;

      background: var(--primary-background-color);
      color: var(--mdc-theme-text-primary-on-background, rgba(0, 0, 0, 0.87));
      border-radius: 16px;
      padding: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
    }
    popup-todo-icon {
      flex-grow: 1;
      width: 128px;
    }
    .Name {
      flex-shrink: 0;
      text-overflow: ellipsis;
      overflow: hidden;
    }
  `;

  protected override render(): unknown {
    return html`
      <popup-todo-icon .item=${this.item}></popup-todo-icon>
      <div class="Name">${this.item?.summary}</div>
    `;
  }
}
customElements.define("todo-thumbnail-card", TodoThumbnailCard);
