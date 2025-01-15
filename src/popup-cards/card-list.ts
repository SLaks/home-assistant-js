import "./todo-cards/popup-todo-card";
import {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceConfig,
  LovelaceViewConfig,
} from "custom-card-helpers";
import { css, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { CardHelpers } from "../types";
import { shouldShowTodoCard } from "./todo-cards/due-times";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import { TodoItemWithEntity } from "../todos/subscriber";

/** The default width of all cards (before flex-shrink). */
const BASE_CARD_WIDTH = 400;
/** The gap between cards. */
const CARD_SPACING = 16;
/** The minimum width of a card. */
const MIN_CARD_WIDTH = 200;
/** The height of all cards. */
export const CARD_HEIGHT = 300;

/** Renders a list of entity IDs as popup cards */
class PopupCardListElement extends LitElement {
  @property({ attribute: false })
  hass?: HomeAssistant;

  @property({ attribute: "card-entities", type: Array })
  cardEntities: string[] = [];
  @property({ attribute: false, type: Array })
  todoItems: TodoItemWithEntity[] = [];

  /** The number of visible cards, as filtered by the caller. */
  @property({ attribute: false })
  cardCount = 0;

  @state()
  missingCards: string[] = [];
  @state()
  cardsToRender: string[] = [];
  @state()
  helpers?: CardHelpers;

  // We also store previously-hidden cards, so they can transition to hidden.

  /** Maps entity IDs to card elements, including no-longer-shown cards. */
  private readonly cardMap = new Map<string, LovelaceCard>();
  /** Maps TODO uids to item objects, including just-completed items. */
  private readonly todoMap = new Map<string, TodoItemWithEntity>();
  constructor() {
    super();
    window.loadCardHelpers().then((h) => (this.helpers = h));
  }

  willUpdate(changedProps: PropertyValues<this>) {
    super.willUpdate(changedProps);
    if (changedProps.has("cardEntities") || changedProps.has("helpers"))
      this.createCards();
    if (changedProps.has("todoItems") || changedProps.has("cardCount"))
      this.updateTodos();
    if (changedProps.has("cardCount")) this.calculateCardWidth();
    this.cardMap.forEach((card) => (card.hass = this.hass));
  }

  /**
   * Calculates the ideal width for the densest row of cards.
   *
   * Flexbox applies wrap before shrink, so this is the only way to make cards
   * shrink to a set minimum width _before_ wrapping to the next line.  We fit
   * the cards into rows based on the minimum card width, then compute a width
   * to maximize the width of the row with the most cards after rounding.
   */
  private calculateCardWidth() {
    // Note: This includes the negative margin that cancels the first card's spacing.
    // This lets us treat the card spacing as part of the card when dividing.
    // Subtract a bit to make room for a vertical scrollbar.  If there is no
    // scrollbar, flex-grow will expand to fit anyway.
    const availableWidth = parseInt(getComputedStyle(this).maxWidth) - 20;
    const rowCount = Math.ceil(
      (this.cardCount * (MIN_CARD_WIDTH + CARD_SPACING)) / availableWidth,
    );
    const cardsPerRow = Math.ceil(this.cardCount / rowCount);
    this.style.setProperty(
      "--popup-card-width",
      `${Math.min(
        // Subtract the spacing, which is not part of the width.
        availableWidth / cardsPerRow - CARD_SPACING,
        BASE_CARD_WIDTH,
      )}px`,
    );
    this.style.flexWrap = rowCount > 1 ? "wrap" : "nowrap";
  }

  private updateTodos() {
    for (const item of this.todoItems) {
      // If we've already stored a completed item, keep updating it.
      // If we've never seen it before, don't store it at all.
      if (shouldShowTodoCard(item) || this.todoMap.has(item.uid))
        this.todoMap.set(item.uid, item);
    }
  }

  static styles = css`
    :host {
      --transition-func: cubic-bezier(0.4, 0, 0.2, 1);
      --transition-duration: 0.3s;
      display: flex;
      justify-content: center;
      overflow: auto;
      max-width: 80vw;
      max-height: 80vh;

      margin-left: -${CARD_SPACING}px;
      margin-top: -${CARD_SPACING}px;
    }

    .CardWrapper,
    .ErrorCard {
      /* This is animated to 0 for hidden cards */
      margin-left: ${CARD_SPACING}px;
      margin-top: ${CARD_SPACING}px;
    }

    .CardWrapper {
      /* 
       * Use flex-grow to make rows with fewer items grow past the fixed width.
       * Use max-width to prevent them from growing wider than the contained card.
       */
      flex-grow: 1;
      width: var(--popup-card-width);
      max-width: ${BASE_CARD_WIDTH}px;
      min-width: 0;
      overflow: hidden;
      animation: show-card var(--transition-duration) var(--transition-func)
        forwards;
      animation-fill-mode: none;
      transition-duration: var(--transition-duration);
      transition-timing-function: var(--transition-func);
      transition-property: flex-basis, margin-left, width;
      &.isHidden {
        margin-left: 0;
        min-width: 0;
        width: 0;
        flex-grow: 0;
      }

      > * {
        display: block;
      }
    }

    @keyframes show-card {
      0% {
        margin-left: 0;
        flex-basis: 0;
      }
    }

    .ErrorCard {
      padding: 16px;
    }
  `;

  private onCardTransitionEnd() {
    this.dispatchEvent(new Event("card-transitioned"));
  }

  render() {
    return html`
      ${repeat(
        this.cardMap,
        ([id]) => id,
        ([id, card]) => {
          const isHidden = !this.cardsToRender.includes(id);
          return html`<div
            class="CardWrapper ${classMap({ isHidden })}"
            @transitionend=${this.onCardTransitionEnd}
          >
            ${card} ${isHidden ? html`<span></span>` : null}
          </div>`;
        },
      )}
      <!-- Render a different element to prevent cards of different types from morphing into eachother. -->
      <span></span>
      ${repeat(
        this.todoMap.values(),
        ({ uid }) => uid,
        (item) => {
          const isHidden = !shouldShowTodoCard(item);
          return html`<div
            class="CardWrapper ${classMap({ isHidden })}"
            @transitionend=${this.onCardTransitionEnd}
          >
            <popup-todo-card .hass=${this.hass} .item=${item}></popup-todo-card>
          </div>`;
        },
      )}
      ${this.renderErrorCard()}
    `;
  }

  renderErrorCard() {
    if (!this.missingCards.length) return;
    return html`<ha-card class="ErrorCard">
      <h2>
        <ha-alert alert-type="error">Missing cards!</ha-alert>
      </h2>
      <p>
        The following entites were requested, but have no popup cards defined:
      </p>
      <ul>
        ${this.missingCards.map((id) => html`<li>${id}</li>`)}
      </ul>
    </ha-card>`;
  }

  async createCards() {
    if (!this.hass || !this.helpers) return;
    const newCardIds = this.cardEntities.filter(
      (id) => !this.cardMap.has(id) && !this.missingCards.includes(id),
    );

    const popupCardsDashboard = await this.hass.callWS<NewerLovelaceConfig>({
      type: "lovelace/config",
      url_path: "popup-cards",
    });
    const allCards = popupCardsDashboard.views.flatMap((v) => [
      ...(v.cards ?? []),
      ...(v.sections?.flatMap((s) => s.cards ?? []) ?? []),
    ]);
    const newCards = allCards.filter(({ entity }) =>
      newCardIds.includes(entity),
    );

    newCards.forEach((c) => {
      c.styles?.card?.forEach((s: Record<string, string>) => {
        if (!s.width) return;
        s["max-width"] = s.width;
        delete s.width;
      });
      this.cardMap.set(c.entity, this.helpers!.createCardElement(c));
    });
    this.missingCards = this.cardEntities.filter(
      (entity) => !allCards.some((c) => c.entity === entity),
    );
    this.cardsToRender = this.cardEntities.filter((entity) =>
      allCards.some((c) => c.entity === entity),
    );
    this.requestUpdate();
  }
}
customElements.define("popup-card-list", PopupCardListElement);

interface NewerLovelaceConfig extends LovelaceConfig {
  views: NewerLovelaceViewConfig[];
}
interface NewerLovelaceViewConfig extends LovelaceViewConfig {
  sections?: LovelaceSectionConfig[];
}
interface LovelaceSectionConfig {
  cards?: LovelaceCardConfig[];
  // I don't care about the other properties.
}
