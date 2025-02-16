import "./card-list.ts";
import "../todos/subscriber.ts";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { bindEntity, SimpleEntityBasedElement } from "../base-elements.ts";
import { LitElement, html, css, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { shouldShowTodoCard } from "./todo-cards/due-times.ts";
import { ifDefined } from "lit/directives/if-defined.js";
import { waitUntilNoHaDialogs } from "../helpers/dialogs.ts";
import { TodoItemWithEntity } from "../todos/subscriber.ts";

export enum DisplayMode {
  Popup = "popup",
  VerticalStack = "vertical-stack",
  HorizontalStack = "horizontal-stack",
}

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
  moveToListIds: string[] = [];

  @state()
  showUrgentTodosOnly = false;

  @state()
  cardListEntityId?: string;

  @state()
  private editMode = false;

  @state()
  private isOpen = false;

  @state()
  todoItems: TodoItemWithEntity[] = [];

  @state()
  cardCount = 0;

  @state()
  private displayMode: DisplayMode = DisplayMode.Popup;

  override shouldUpdate(): boolean {
    return true; // Always update, in case cards consume other entities.
  }
  override willUpdate(changedProps: PropertyValues<this>): void {
    super.willUpdate(changedProps);

    // Always recount cards every minute in case a todo item reaches its due time.
    this.cardCount =
      this.cardEntities.length +
      this.todoItems.filter((i) =>
        shouldShowTodoCard(i, this.showUrgentTodosOnly),
      ).length;

    // If the count actually changed, reopen the popup.
    // If this runs every time, isOpen will be stuck as
    // true before the dialog finishes closing, and the
    // dialog will never reopen.
    if (changedProps.has("cardCount")) this.tryOpen();
  }

  static getStubConfig(): CardConfig {
    return {
      card_list_entity_id: "sensor.popup_cards",
      reopen_delay_ms: `${5 * 60_000}`,
      todo_entity_id: "todo.your_list",
      move_to_list_ids: "todo.long_term_tasks",
      display_mode: DisplayMode.Popup,
    };
  }

  setConfig(fullConfig: CardConfig) {
    const browserConfig = fullConfig.browser_ids?.find(
      (b): b is CardBrowserSpec =>
        typeof b === "object" && b.browser_id === window.browser_mod?.browserID,
    );
    const config = { ...fullConfig, ...(browserConfig ?? {}) };
    this.reopenDelayMs = parseInt(config.reopen_delay_ms ?? "0") || 0;
    if (this.todoEntityId !== config.todo_entity_id) this.todoItems = [];
    this.todoEntityId = config.todo_entity_id;
    this.cardListEntityId = config.card_list_entity_id;
    this.showUrgentTodosOnly = !!config.show_urgent_todos_only;
    this.moveToListIds = [config.move_to_list_ids ?? []].flat();
    this.browserIds = config.browser_ids
      ? new Set(
          config.browser_ids.map((b) =>
            typeof b === "string" ? b : b.browser_id,
          ),
        )
      : undefined;
    this.displayMode = config.display_mode ?? DisplayMode.Popup;
    if (!Object.values(DisplayMode).includes(this.displayMode)) {
      throw new Error(`Invalid display_mode: ${this.displayMode}`);
    }
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
      min-height: var(--popup-card-height, 300px);
    }
  `;

  override render() {
    if (this.editMode && this.displayMode === DisplayMode.Popup)
      return this.renderEditMode();

    if (this.browserIds?.has(window.browser_mod?.browserID ?? "") === false)
      return html`<div></div>`;
    if (!this.hass) return html`<div></div>`;

    // After the close animation finishes, remove this element entirely.
    // This prevents us from leaking cached rendered card elements.
    let content: unknown = html`<popup-card-list
      .cardEntities=${this.cardEntities}
      .showUrgentTodosOnly=${this.showUrgentTodosOnly}
      .hass=${this.hass}
      .todoItems=${this.todoItems}
      .cardCount=${this.cardCount}
      .moveToListIds=${this.moveToListIds}
      @card-transitioned=${this.onCardHidden}
      display-mode=${this.displayMode}
    >
      ${this.displayMode !== DisplayMode.Popup && this.editMode
        ? this.renderEditMode()
        : null}
    </popup-card-list>`;

    if (!this.isOpen && !this.editMode) content = null;

    const subscriber = html`<todo-items-subscriber
      .hass=${this.hass}
      entity-id=${ifDefined(this.todoEntityId)}
      @items-updated=${this.onTodoItemsChanged}
    ></todo-items-subscriber>`;
    if (this.displayMode === DisplayMode.Popup) {
      return html` ${subscriber}
        <ha-dialog ?open=${this.isOpen} @closed=${this.onClosed} hideActions>
          <div class="content" dialogInitialFocus>${content}</div>
        </ha-dialog>`;
    }
    return html`${subscriber} ${content}`;
  }

  private renderEditMode() {
    let context;
    switch (this.displayMode) {
      case DisplayMode.VerticalStack:
        context = "A vertical stack showing";
        break;
      case DisplayMode.HorizontalStack:
        context = "A horizontal stack showing";
        break;
      case DisplayMode.Popup:
        context = "This invisible card shows a popup with";
    }
    return html`<ha-card style="padding: 12px;">
      <p>${context}:</p>
      <ul>
        ${this.renderEditModePopupInfo()} ${this.renderEditModeTodoInfo()}
        ${this.moveToListIds.map(
          (id) =>
            html`<li>
              An option to move todos to
              ${this.hass?.states[id]?.attributes.friendly_name ??
              id + " not found!"}
            </li>`,
        )}
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
        Up to ${todoEntity.state} ${this.showUrgentTodosOnly ? "urgent" : ""}
        todo(s) from list ${todoEntity.attributes.friendly_name}
      </li>`;
    }
    return html`<li>
      <ha-alert alert-type="error">
        <code>todo_entity_id: ${this.todoEntityId}</code> not found
      </ha-alert>
    </li>`;
  }

  private onTodoItemsChanged(e: CustomEvent<TodoItemWithEntity[]>) {
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
    setTimeout(() => this.tryOpen(), this.reopenDelayMs);
  }

  private async tryOpen() {
    if (!this.cardCount) return;
    await waitUntilNoHaDialogs();
    // We may get here multiple times concurrently.  This is fine.
    if (!this.cardCount) return;
    this.isOpen = true;
  }
}
customElements.define("popup-card-runner", PopupCardRunnerElement);
window.customCards ??= [];
window.customCards.push({
  type: "popup-card-runner",
  name: "Popup Card Runner",
  description: "Automatically opens a popup with active popup cards.",
});

interface CardBehaviorOptions {
  reopen_delay_ms?: string;
  todo_entity_id?: string;
  card_list_entity_id?: string;
  show_urgent_todos_only?: boolean;
  move_to_list_ids?: string | string[];
  display_mode?: DisplayMode;
}
interface CardBrowserSpec extends CardBehaviorOptions {
  browser_id: string;
}
interface CardConfig extends CardBehaviorOptions {
  browser_ids?: Array<string | CardBrowserSpec>;
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
