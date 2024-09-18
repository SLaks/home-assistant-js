import "./popup-todo-card";
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
import { TodoItem, TodoItemStatus } from "./todos";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";

/** Renders a list of entity IDs as popup cards */
class PopupCardRendererElement extends LitElement {
  @property({ attribute: false })
  hass?: HomeAssistant;

  @property({ attribute: "card-entities", type: Array })
  cardEntities: string[] = [];
  @property({ attribute: "todo-entity-id" })
  todoEntityId?: string;
  @property({ attribute: false, type: Array })
  todoItems: TodoItem[] = [];

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
  private readonly todoMap = new Map<string, TodoItem>();
  constructor() {
    super();
    window.loadCardHelpers().then((h) => (this.helpers = h));
  }

  willUpdate(changedProps: PropertyValues<this>) {
    super.willUpdate(changedProps);
    if (changedProps.has("cardEntities") || changedProps.has("helpers"))
      this.createCards();
    if (changedProps.has("todoItems")) this.updateTodos();
    this.cardMap.forEach((card) => (card.hass = this.hass));
  }

  private updateTodos() {
    for (const item of this.todoItems) {
      // If we've already stored a completed item, keep updating it.
      // If we've never seen it before, don't store it at all.
      if (
        item.status !== TodoItemStatus.Completed ||
        this.todoMap.has(item.uid)
      )
        this.todoMap.set(item.uid, item);
    }
  }

  static styles = css`
    .Root {
      --transition-func: cubic-bezier(0.4, 0, 0.2, 1);
      --transition-duration: 0.3s;
      display: flex;
      overflow: hidden;
      max-width: 80vw;
      max-height: 80vh;

      margin-left: -16px;
      > div {
        /* This is animated to 0 for hidden cards */
        margin-left: 16px;
      }

      .CardWrapper {
        flex: 0 1 400px;
        width: 400px;
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
          flex-basis: 0;
          width: 0;
        }
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
      <div class="Root">
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
            const isHidden = item.status === TodoItemStatus.Completed;
            return html`<div
              class="CardWrapper ${classMap({ isHidden })}"
              @transitionend=${this.onCardTransitionEnd}
            >
              <popup-todo-card
                entity-id=${this.todoEntityId!}
                .hass=${this.hass}
                .item=${item}
              ></popup-todo-card>
            </div>`;
          },
        )}
        ${this.renderErrorCard()}
      </div>
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
customElements.define("popup-card-renderer", PopupCardRendererElement);

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
