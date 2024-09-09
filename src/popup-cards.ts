import {
  HomeAssistant,
  LovelaceCard,
  LovelaceConfig,
} from "custom-card-helpers/dist/types";
import { bindEntity, SimpleEntityBasedElement } from "./base-elements.ts";
import { LitElement, html, css, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { CardHelpers } from "./types.ts";

/** Renders a list of entity IDs as popup cards */
class PopupCardRendererElement extends LitElement {
  @property({ attribute: false })
  hass?: HomeAssistant;

  @property({ attribute: "card-entities", type: Array })
  cardEntities: string[] = [];

  @state()
  missingCards: string[] = [];
  @state()
  cardsToRender: string[] = [];
  @state()
  helpers?: CardHelpers;

  private readonly cardMap = new Map<string, LovelaceCard>();
  constructor() {
    super();
    window.loadCardHelpers().then((h) => (this.helpers = h));
  }

  willUpdate(changedProps: PropertyValues<this>) {
    if (changedProps.has("cardEntities")) this.createCards();
    this.cardMap.forEach((card) => (card.hass = this.hass));
    super.willUpdate(changedProps);
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
      > * {
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
        &.Hidden {
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
  render() {
    if (!this.cardsToRender) return html`Loading...`;
    const renderedCards = [...this.cardMap].map(([id, card]) => {
      const isHidden = !this.cardsToRender.includes(id);
      return html`<div
        class="CardWrapper ${isHidden ? "Hidden" : ""}"
        @transitionend=${() =>
          this.dispatchEvent(new Event("card-transitioned"))}
      >
        ${card} ${isHidden ? html`<span></span>` : null}
      </div>`;
    });
    return html`
      <div class="Root">${renderedCards} ${this.renderErrorCard()}</div>
    `;
  }

  renderErrorCard() {
    if (!this.missingCards.length) return;
    return html`<ha-card class="ErrorCard">
      <h2>
        <ha-alert alert-type="error">Missinsg cards!</ha-alert>
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

    const popupCardsDashboard = await this.hass.callWS<LovelaceConfig>({
      type: "lovelace/config",
      url_path: "popup-cards",
    });
    const allCards = popupCardsDashboard.views.flatMap((v) => v.cards ?? []);
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

class PopupCardRunnerElement extends SimpleEntityBasedElement {
  @property({ attribute: false })
  @bindEntity({ entityId: "sensor.dashboard_alerts" })
  cardEntities = "[]";

  @state()
  reopenDelayMs = 0;

  @state()
  browserIds?: Set<string>;

  @state()
  private editMode = false;

  @state()
  private isOpen = false;

  override shouldUpdate(): boolean {
    return true; // Always update, in case cards consume other entities.
  }
  override willUpdate(changedProps: PropertyValues<this>): void {
    const previousEntities = this.cardEntities;
    super.willUpdate(changedProps);
    if (previousEntities !== this.cardEntities && this.cardEntities !== "[]")
      this.isOpen = true;
  }

  setConfig(config: Record<string, unknown>) {
    this.reopenDelayMs = parseInt(config.reopen_delay_ms as string) ?? 0;
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
  `;

  override render() {
    if (this.editMode) {
      return html`<ha-card style="padding: 12px;">
        This invisible card shows popups when there are popup cards.
      </ha-card>`;
    }
    const entities: string[] = JSON.parse(this.cardEntities);
    if (!(this.browserIds?.has(window.browser_mod?.browserID ?? "") ?? true))
      return html`<div></div>`;
    if (!this.hass) return html`<div></div>`;
    return html`<ha-dialog
      ?open=${this.isOpen}
      @closed=${this.onClosed}
      hideActions
    >
      <div class="content" dialogInitialFocus>
        <popup-card-renderer
          .cardEntities=${entities}
          .hass=${this.hass}
          @card-transitioned=${this.onCardHidden}
        >
        </popup-card-renderer>
      </div>
    </ha-dialog>`;
  }

  onCardHidden() {
    if (this.cardEntities === "[]") this.isOpen = false;
  }

  onClosed() {
    this.isOpen = false;
    if (!this.reopenDelayMs || this.cardEntities === "[]") return;
    setTimeout(() => {
      if (this.cardEntities !== "[]") this.isOpen = true;
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
    return html`<popup-card-renderer
      .hass=${this.hass}
      .cardEntities=${this.cardEntities}
    ></popup-card-renderer>`;
  }
}

customElements.define("manual-popup-cards", ManualPopupCardsElement);

declare global {
  interface Window {
    browser_mod?: { browserID: string };
  }
}
