import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { TodoItem } from "../todos/ha-api";
import "../popup-cards/todo-cards/todo-icon";
import { classMap } from "lit/directives/class-map.js";
import { isUrgent as isItemUrgent } from "../popup-cards/todo-cards/todo-actions";
import { isSnoozedLaterToday } from "../popup-cards/todo-cards/due-times";

class TodoThumbnailCard extends LitElement {
  // This element is dragged, so it must render entirely from attributes.
  // If it uses properties, Sortable's drag clones won't set the properties.
  @property({ attribute: "item-json" })
  itemJson?: string;

  @state()
  item?: TodoItem;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.itemJson) this.item = JSON.parse(this.itemJson);
  }
  protected override willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("itemJson")) {
      this.item = this.itemJson && JSON.parse(this.itemJson);
    }
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-self: stretch;
      max-width: 150px;
    }
    .Root {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      aspect-ratio: 1.618;
      place-self: stretch;
      position: relative;

      background: var(--primary-background-color);
      color: var(--mdc-theme-text-primary-on-background, rgba(0, 0, 0, 0.87));
      border-radius: 16px;
      padding: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);

      transition: border-color 0.2s ease-out;
      --border-color: white;
      border: 2px solid var(--border-color);
      &.isCompleted {
        --border-color: #388e3c;
      }
      &.isUrgent {
        --border-color: #f9a825;
      }
      &.isSnoozed {
        --border-color: #f57c00;
      }
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

    ha-icon {
      color: var(--border-color);
      position: absolute;
      top: -12px;
      left: -12px;
      background-color: white;
      border-radius: 50%;
    }
  `;

  protected override render(): unknown {
    if (!this.item) return;
    const isCompleted = this.item.status === "completed";
    const isUrgent = isItemUrgent(this.item);
    const isSnoozed = isSnoozedLaterToday(this.item);
    let icon = "";
    if (isCompleted) icon = "mdi:check-circle";
    if (isSnoozed) icon = "mdi:clock";
    if (isUrgent) icon = "mdi:alert-circle";
    if (isUrgent && isSnoozed) icon = "mdi:clock-alert-outline";
    return html`
      <div
        class=${classMap({
          Root: true,
          isCompleted,
          isUrgent,
          isSnoozed,
        })}
      >
        <popup-todo-icon .item=${this.item}></popup-todo-icon>
        <div class="Name">${this.item?.summary}</div>
        ${icon ? html`<ha-icon icon=${icon}></ha-icon>` : nothing}
      </div>
    `;
  }
}
customElements.define("todo-thumbnail-card", TodoThumbnailCard);
