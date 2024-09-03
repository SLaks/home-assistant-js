import { HomeAssistant, LovelaceCard, LovelaceConfig } from "custom-card-helpers/dist/types";
import { bindEntity, SimpleEntityBasedElement } from "./base-elements.ts";
import { LitElement, html, css, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { CardHelpers } from "./types.ts";

/** Renders a list of entity IDs as popup cards */
class PopupCardRendererElement extends LitElement {
  static properties = {
    hass: { attribute: true },
    cardEntities: { attribute: true },
    helpers: { state: true },
    missingCards: { state: true },
    cardsToRender: { state: true },
  };

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

  update(changedProps: PropertyValues<this>) {
    if (changedProps.has("cardEntities") || changedProps.has("helpers")) this.createCards();
    this.cardMap.forEach((card) => (card.hass = this.hass));
    super.update(changedProps);
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
      return html`<div class="CardWrapper ${isHidden ? "Hidden" : ""}">
            ${card} ${isHidden ? html`<span></span>` : null}
          </div>`;
    });
    return html`
      <div class="Root">
        ${renderedCards}
        ${this.renderErrorCard()}
      </div>
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
      (id) => !this.cardMap.has(id) && !this.missingCards.includes(id)
    );

    const popupCardsDashboard = await this.hass.callWS<LovelaceConfig>({
      type: "lovelace/config",
      url_path: "popup-cards",
    });
    const allCards = popupCardsDashboard.views.flatMap((v) => v.cards ?? []);
    const newCards = allCards.filter(({ entity }) =>
      newCardIds.includes(entity)
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
      (entity) => !allCards.some((c) => c.entity === entity)
    );
    this.cardsToRender = this.cardEntities.filter((entity) =>
      allCards.some((c) => c.entity === entity)
    );
    this.requestUpdate();
  }
}
customElements.define("popup-card-renderer", PopupCardRendererElement);

class AutoPopupCardsElement extends SimpleEntityBasedElement {
  static properties = {
    hass: { attribute: false },
    cardEntities: { state: true, entity: "sensor.dashboard_alerts" },
  };


  @property({ attribute: false })
  @bindEntity({ entityId: "sensor.dashboard_alerts" })
  cardEntities = '[]';


  setConfig() { }
  render() {
    if (!this.hass) return html`<div>Loading...</div>`
    return html`<popup-card-renderer
      .hass=${this.hass}
      cardEntities=${JSON.parse(this.cardEntities)}
    ></popup-card-renderer>`;
  }

  connectedCallback() {
    window.showingPopupCards = true;
    super.connectedCallback();
  }
  disconnectedCallback() {
    window.showingPopupCards = false;
    super.disconnectedCallback();
  }
}

customElements.define("auto-popup-cards", AutoPopupCardsElement);

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

window.showPopupCards = function () {
  if (window.showingPopupCards) return;
  window.browser_mod.service("popup", {
    content: { type: "custom:auto-popup-cards" },
    style: `
          --popup-min-width: 30px;
          --popup-max-width: 90vw;
        `,
  });
};

declare global {
  interface Window {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browser_mod: any;
    showingPopupCards: boolean;
    showPopupCards: () => void;
  }
}