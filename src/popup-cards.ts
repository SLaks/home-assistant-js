import { SimpleEntityBasedElement } from "./base-elements.ts";
import { LitElement, html, css } from "lit";

/** Renders a list of entity IDs as popup cards */
class PopupCardRendererElement extends LitElement {
  static properties = {
    hass: { attribute: true },
    cardEntities: { attribute: true },
    helpers: { state: true },
    missingCards: { state: true },
    cardsToRender: { state: true },
  };

  cardMap = new Map();
  constructor() {
      super();
      window.loadCardHelpers().then((h) => (this.helpers = h));
      this.missingCards = [];
  }

  update(changedProps) {
    if (changedProps.has("cardEntities")) this.createCards(this.cardEntities);
    this.cardMap.forEach((card) => (card.hass = this.hass));
    // if (changedProps.length === 1 && changedProps.has("hass")) return;
    super.update(changedProps);
  }
  updated(changedProperties) {
    super.updated(changedProperties);
    this.cardMap.forEach((c) => (c.hass = this.hass));
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
    return html`
      <div class="Root">
        ${[...this.cardMap].map(([id, card]) => {
          const isHidden = !this.cardsToRender.includes(id);
          return html`<div class="CardWrapper ${isHidden ? "Hidden" : ""}">
            ${card} ${isHidden ? html`<span></span>` : null}
          </div>`;
        })}
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

  async createCards(cardEntities) {
    if (!this.hass) return;
    const newCardIds = cardEntities.filter(
      (id) => !this.cardMap.has(id) && !this.missingCards.includes(id)
    );

    const popupCardsDashboard = await this.hass.callWS({
      type: "lovelace/config",
      url_path: "popup-cards",
    });
    const allCards = popupCardsDashboard.views.flatMap((v) => v.cards);
    const newCards = allCards.filter(({ entity }) =>
      newCardIds.includes(entity)
    );

    newCards.forEach((c) => {
      c.styles?.card?.forEach((s) => {
        if (!s.width) return;
        s["max-width"] = s.width;
        delete s.width;
      });
      this.cardMap.set(c.entity, this.helpers.createCardElement(c));
    });
    this.missingCards = cardEntities.filter(
      (entity) => !allCards.some((c) => c.entity === entity)
    );
    this.cardsToRender = cardEntities.filter((entity) =>
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
  setConfig() {}
  render() {
    return html`<popup-card-renderer
      hass=${this.hass}
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

class ManualPopupCardsElement extends SimpleEntityBasedElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false },
    cardEntities: { state: true },
  };
  async setConfig(config) {
    if (!config.entities) throw new Error("Please specify entities");
    this.cardEntities = config.entities;
  }
  render() {
    return html`<popup-card-renderer
      hass=${this.hass}
      cardEntities=${this.cardEntities}
    ></popup-card-renderer>`;
  }
}

customElements.define("manual-popup-cards", ManualPopupCardsElement);

window.showPopupCards = function () {
  if (window.showingPopupCards) return;
  browser_mod.service("popup", {
    content: { type: "custom:auto-popup-cards" },
    style: `
          --popup-min-width: 30px;
          --popup-max-width: 90vw;
        `,
  });
};
