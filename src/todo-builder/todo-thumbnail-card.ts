import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { TodoItem } from "../todos/ha-api";
import "../popup-cards/todo-cards/todo-icon";
import { classMap } from "lit/directives/class-map.js";
import { isUrgent as isItemUrgent } from "../popup-cards/todo-cards/todo-actions";
import { isSnoozedLaterToday } from "../popup-cards/todo-cards/due-times";
import { HomeAssistant } from "custom-card-helpers/dist/types";

class TodoThumbnailCard extends LitElement {
  // This element is dragged, so it must render entirely from attributes.
  // If it uses properties, Sortable's drag clones won't set the properties.
  @property({ attribute: "item-json" })
  itemJson?: string;

  @property({ attribute: false }) hass?: HomeAssistant;

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
      --border-color: white;
      position: relative;
      display: flex;
      flex-direction: column;
      height: var(--todo-thumbnail-card-height);
    }

    .isUrgent {
      --border-color: #c62828;
    }
    .isSnoozed {
      --border-color: #fbc02d;
    }
    .isCompleted {
      --border-color: #388e3c;
    }

    .Root {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 8px;

      cursor: pointer;
      background: var(--primary-background-color);
      color: var(--mdc-theme-text-primary-on-background, rgba(0, 0, 0, 0.87));
      border-radius: 16px;
      padding: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
      overflow: hidden;
      transition: border-color 0.2s ease-out;

      border: 2px solid var(--border-color);
      &:has(.HasImage) {
        padding: 0;
      }
    }

    popup-todo-icon {
      flex-grow: 1;
      /*
       * Shrink to fit label in emoji mode. 
       * This is necessary for the template list, which is a flex row.
       */
      min-height: 0;
      &.HasImage {
        width: 100%;
        height: 100%;
        /* When there is an image, the image displays the name instead. */
        ~ .Name {
          display: none;
        }
      }
    }

    .Name {
      flex-shrink: 0;
      text-overflow: ellipsis;
      overflow: hidden;
      text-align: center;
    }

    /* This is outside .Root so it isn't clipped by overflow: hidden. */
    ha-icon {
      transition: color 0.2s ease-out;
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
    if (isSnoozed) icon = "mdi:clock";
    if (isUrgent) icon = "mdi:alert-circle";
    if (isUrgent && isSnoozed) icon = "mdi:clock-alert-outline";
    if (isCompleted) icon = "mdi:check-circle";

    // Applied to the icon separately because it's outside the root.
    const statusClasses = classMap({
      isCompleted,
      isUrgent,
      isSnoozed,
    });
    return html`
      <div class="Root ${statusClasses}">
        <popup-todo-icon
          .hass=${this.hass}
          .item=${this.item}
        ></popup-todo-icon>
        <div class="Name">${this.item?.summary}</div>
        <md-ripple></md-ripple>
      </div>
      ${icon
        ? html`<ha-icon class=${statusClasses} icon=${icon}></ha-icon>`
        : nothing}
    `;
  }
}
customElements.define("todo-thumbnail-card", TodoThumbnailCard);
