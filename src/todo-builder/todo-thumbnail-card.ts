import { css, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { TodoItem } from "../todos/ha-api";
import "../popup-cards/todo-cards/todo-icon";

class TodoThumbnailCard extends LitElement {
  // This element is dragged, so it must render entirely from attributes.
  // If it uses properties, Sortable's drag clones won't set the properties.
  @property({ attribute: "item-json" })
  itemJson?: string;

  @state()
  item?: TodoItem;

  protected override willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("itemJson")) {
      this.item = this.itemJson && JSON.parse(this.itemJson);
    }
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      aspect-ratio: 1.618;
      place-self: stretch;

      background: var(--primary-background-color);
      color: var(--mdc-theme-text-primary-on-background, rgba(0, 0, 0, 0.87));
      border-radius: 16px;
      padding: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
    }
    popup-todo-icon {
      flex-grow: 1;
    }
    .Name {
      flex-shrink: 0;
      text-overflow: ellipsis;
      overflow: hidden;
      text-align: center;
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
