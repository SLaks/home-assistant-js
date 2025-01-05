import "./card-list.ts";
import "../todos/subscriber.ts";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { bindEntity, SimpleEntityBasedElement } from "../base-elements.ts";
import { LitElement, html, css, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { shouldShowTodoCard } from "./todo-cards/due-times.ts";
import { ifDefined } from "lit/directives/if-defined.js";
import { CARD_HEIGHT } from "./card-list.ts";
import { TodoItem } from "../todos/ha-api.ts";

class PopupCardRunnerElement extends SimpleEntityBasedElement {
  @property({ attribute: false })
  @bindEntity({ entityIdProperty: "cardListEntityId", converter: JSON.parse })
  cardEntities: string[] = [];

  @state()
  reopenDelayMs = 0;

  @state()
  browserIds?: Set<string>;

  @state()
  todoEntityId?: string;

  @state()
  cardListEntityId?: string;

  @state()
  private editMode = false;

  @state()
  private isOpen = false;

  @state()
  todoItems: TodoItem[] = [];

  @state()
  cardCount = 0;

  override shouldUpdate(): boolean {
    return true; // Always update, in case cards consume other entities.
  }
  override willUpdate(changedProps: PropertyValues<this>): void {
    super.willUpdate(changedProps);

    // Always recount cards every minute in case a todo item reaches its due time.
    this.cardCount =
      this.cardEntities.length +
      this.todoItems.filter(shouldShowTodoCard).length;

    // If the count actually changed, reopen the popup.
    // If this runs every time, isOpen will be stuck as
    // true before the dialog finishes closing, and the
    // dialog will never reopen.
    if (changedProps.has("cardCount") && this.cardCount) this.isOpen = true;
  }

  static getStubConfig(): CardConfig {
    return {
      card_list_entity_id: "sensor.popup_cards",
      reopen_delay_ms: `${5 * 60_000}`,
      todo_entity_id: "todo.your_list",
    };
  }

  setConfig(config: CardConfig) {
    this.reopenDelayMs = parseInt(config.reopen_delay_ms ?? "0") || 0;
    if (this.todoEntityId !== config.todo_entity_id) this.todoItems = [];
    this.todoEntityId = config.todo_entity_id;
    this.cardListEntityId = config.card_list_entity_id;
    this.browserIds = config.browser_ids
      ? new Set(config.browser_ids)
      : undefined;
  }
  async connectedCallback() {
    super.connectedCallback();

    if (this.parentElement?.localName === "hui-card-preview") {
      this.editMode = true;
    }
  }

  static styles = css`
    :host {
      --mdc-dialog-min-width: 30px;
      --mdc-dialog-max-width: 90vw;
    }
    /* Don't let the height change after the cards are removed. */
    .content {
      min-height: ${CARD_HEIGHT}px;
    }
  `;

  override render() {
    if (this.editMode) return this.renderEditMode();

    if (this.browserIds?.has(window.browser_mod?.browserID ?? "") === false)
      return html`<div></div>`;
    if (!this.hass) return html`<div></div>`;

    // After the close animation finishes, remove this element entirely.
    // This prevents us from leaking cached rendered card elements.
    const content = html`<popup-card-list
      .cardEntities=${this.cardEntities}
      .hass=${this.hass}
      .todoEntityId=${this.todoEntityId}
      .todoItems=${this.todoItems}
      .cardCount=${this.cardCount}
      @card-transitioned=${this.onCardHidden}
    >
    </popup-card-list>`;

    return html`<todo-items-subscriber
        .hass=${this.hass}
        entity-id=${ifDefined(this.todoEntityId)}
        @items-updated=${this.onTodoItemsChanged}
      ></todo-items-subscriber>
      <ha-dialog ?open=${this.isOpen} @closed=${this.onClosed} hideActions>
        <div class="content" dialogInitialFocus>
          ${this.isOpen ? content : null}
        </div>
      </ha-dialog>`;
  }

  private renderEditMode() {
    return html`<ha-card style="padding: 12px;">
      <p>This invisible card shows a popup with:</p>
      <ul>
        ${this.renderEditModePopupInfo()} ${this.renderEditModeTodoInfo()}
      </ul>
    </ha-card>`;
  }

  private renderEditModePopupInfo() {
    if (!this.cardListEntityId) return null;
    const cardListEntity = this.hass?.states[this.cardListEntityId];
    if (cardListEntity) {
      return html`<li>
        ${this.cardEntities.length} card(s) from list
        ${cardListEntity.attributes.friendly_name}
      </li>`;
    }
    return html`<li>
      <ha-alert alert-type="error">
        <code>card_list_entity_id: ${this.cardListEntityId}</code> not found
      </ha-alert>
    </li>`;
  }
  private renderEditModeTodoInfo() {
    if (!this.todoEntityId) return null;
    const todoEntity = this.hass?.states[this.todoEntityId];
    if (todoEntity) {
      return html`<li>
        ${todoEntity.state} todo(s) from list
        ${todoEntity.attributes.friendly_name}
      </li>`;
    }
    return html`<li>
      <ha-alert alert-type="error">
        <code>todo_entity_id: ${this.todoEntityId}</code> not found
      </ha-alert>
    </li>`;
  }

  private onTodoItemsChanged(e: CustomEvent<TodoItem[]>) {
    // We filter the items in card-list.ts, so that it can update completed items
    // as they animate away.
    this.todoItems = e.detail;
  }

  private onCardHidden() {
    if (!this.cardCount) this.isOpen = false;
  }

  onClosed() {
    this.isOpen = false;
    if (!this.reopenDelayMs || !this.cardCount) return;
    setTimeout(() => {
      if (this.cardCount) this.isOpen = true;
    }, this.reopenDelayMs);
  }
}
customElements.define("popup-card-runner", PopupCardRunnerElement);
window.customCards ??= [];
window.customCards.push({
  type: "popup-card-runner",
  name: "Popup Card Runner",
  description: "Automatically opens a popup with active popup cards.",
});

interface CardConfig {
  reopen_delay_ms?: string;
  todo_entity_id?: string;
  card_list_entity_id?: string;
  browser_ids?: string[];
}

class ManualPopupCardsElement extends LitElement {
  @property({ attribute: false })
  hass?: HomeAssistant;

  @state()
  cardEntities: string[] = [];

  async setConfig(config: { entities: string[] }) {
    if (!config.entities) throw new Error("Please specify entities");
    this.cardEntities = config.entities;
  }
  render() {
    return html`<popup-card-list
      .hass=${this.hass}
      .cardEntities=${this.cardEntities}
    ></popup-card-list>`;
  }
}

customElements.define("manual-popup-cards", ManualPopupCardsElement);

declare global {
  interface Window {
    browser_mod?: { browserID: string };
  }
}
