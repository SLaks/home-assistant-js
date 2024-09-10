import "./renderer.ts";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { bindEntity, SimpleEntityBasedElement } from "../base-elements.ts";
import { LitElement, html, css, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";

class PopupCardRunnerElement extends SimpleEntityBasedElement {
  @property({ attribute: false })
  @bindEntity({ entityId: "sensor.dashboard_alerts", converter: JSON.parse })
  cardEntities: string[] = [];

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
    if (
      previousEntities.join() !== this.cardEntities.join() &&
      this.cardEntities.length
    )
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
    if (this.browserIds?.has(window.browser_mod?.browserID ?? "") === false)
      return html`<div></div>`;
    if (!this.hass) return html`<div></div>`;
    return html`<ha-dialog
      ?open=${this.isOpen}
      @closed=${this.onClosed}
      hideActions
    >
      <div class="content" dialogInitialFocus>
        <popup-card-renderer
          .cardEntities=${this.cardEntities}
          .hass=${this.hass}
          @card-transitioned=${this.onCardHidden}
        >
        </popup-card-renderer>
      </div>
    </ha-dialog>`;
  }

  onCardHidden() {
    if (this.cardEntities.length) this.isOpen = false;
  }

  onClosed() {
    this.isOpen = false;
    if (!this.reopenDelayMs || !this.cardEntities.length) return;
    setTimeout(() => {
      if (this.cardEntities.length) this.isOpen = true;
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
