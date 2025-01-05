import { property, state } from "lit/decorators.js";
import { bindEntity, SimpleEntityBasedElement } from "../base-elements";
import { css, html } from "lit";

class ActionsCardElement extends SimpleEntityBasedElement {
  @property({ attribute: false })
  @bindEntity({
    entityIdProperty: "entityId",
    attributeName: "spec",
  })
  spec?: CardSpec;

  @state()
  entityId?: string;

  static getStubConfig(): CardConfig {
    return {
      entity: "sensor.todo",
    };
  }

  setConfig(config: CardConfig) {
    this.entityId = config.entity;
  }

  static styles = css`
    .Buttons {
      flex-grow: 1;

      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      > * {
        flex-grow: 1;
      }
    }
  `;

  override render() {
    if (!this.hass) return html`<div></div>`;
    if (!this.entityId)
      return html`<ha-alert alert-type="error">
        Please enter an entity
      </ha-alert>`;
    if (!this.hass.states[this.entityId])
      return html`<ha-alert alert-type="error">
        Entity ${this.entityId} not found
      </ha-alert>`;
    const entityName =
      this.hass.states[this.entityId].attributes.friendly_name ?? this.entityId;

    return html`
      <popup-card-base not-clickable ?is-completed=${!this.spec?.message}>
        <img
          slot="icon"
          src=${this.hass.states[this.entityId].attributes.entity_picture!}
        />
        <div slot="name">
          ${this.spec?.message || `${entityName} has no actions.`}
        </div>
        <div slot="actions" class="Buttons">
          ${this.spec?.actions?.map(
            (a) => html`
              <mwc-button raised @click=${() => this.handleAction(a)}>
                ${a.title}
              </mwc-button>
            `,
          )}
        </div>
      </popup-card-base>
    `;
  }

  private handleAction(a: ActionSpec) {
    return this.hass!.callApi("POST", "events/mobile_app_notification_action", {
      action: a.action,
      source: "popup-actions-card",
    });
  }
}
customElements.define("popup-actions-card", ActionsCardElement);
window.customCards ??= [];
window.customCards.push({
  type: "popup-actions-card",
  name: "Popup Actions Card",
  description: "Shows actions from a template sensor.",
});

interface ActionSpec {
  title: string;
  action: string;
}

interface CardSpec {
  message?: string;
  actions?: Array<ActionSpec>;
}

interface CardConfig {
  entity: string;
}
