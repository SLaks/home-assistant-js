import "./card-list.ts";
import "../todos/subscriber.ts";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { bindEntity, SimpleEntityBasedElement } from "../base-elements.ts";
import { LitElement, html, css, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { shouldShowTodoCard } from "./due-times.ts";
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

  setConfig(config: Record<string, unknown>) {
    this.reopenDelayMs = parseInt(config.reopen_delay_ms as string) ?? 0;
    if (this.todoEntityId !== config.todo_entity_id) this.todoItems = [];
    this.todoEntityId = config.todo_entity_id as string;
    this.cardListEntityId = config.card_list_entity_id as string;
    this.browserIds = config.browser_ids
      ? new Set(config.browser_ids as string[])
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
      <p>This invisible card shows popups when there are popup cards.</p>
      <p>${this.renderEditModeTodoInfo()}</p>
    </ha-card>`;
  }

  private renderEditModeTodoInfo() {
    if (!this.todoEntityId) return null;
    const todoEntity = this.hass?.states[this.todoEntityId];
    if (todoEntity) {
      return `Will also show ${todoEntity.state} todo(s) from list ${todoEntity.attributes.friendly_name}`;
    }
    return html`<ha-alert alert-type="error">
      <code>todo_entity_id: ${this.todoEntityId}</code> not found
    </ha-alert>`;
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
