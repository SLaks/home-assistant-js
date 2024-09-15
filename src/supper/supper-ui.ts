import "./supper-list-selector.ts";
import "./date-tab.ts";

import { HomeAssistant, LovelaceCard } from "custom-card-helpers";
import { property, state } from "lit/decorators.js";
import { bindEntity, SimpleEntityBasedElement } from "../base-elements.ts";
import { html, css, PropertyValues } from "lit";
import { SupperForDate } from "./data-types.ts";
import { isDateToday } from "./helpers.ts";
import { desktopMode, mobileMode } from "./styles.ts";

export class SupperSelectorElement extends SimpleEntityBasedElement {
  @property({ attribute: false })
  hass?: HomeAssistant;

  @state()
  supperTimeEl?: LovelaceCard;
  @state()
  selectedDate?: string;

  @bindEntity({
    entityId: "sensor.supper_today",
    attributeName: "all",
  })
  @state()
  allDates: SupperForDate[] = [];
  @state()
  selectedSupper?: string;

  willUpdate(changedProps: PropertyValues<this>) {
    super.willUpdate(changedProps);
    if (this.supperTimeEl) this.supperTimeEl.hass = this.hass;

    if (!this.selectedDate) {
      this.selectedDate = this.allDates.find((s) => isDateToday(s.date))?.date;
    }
    this.selectedSupper = this.allDates.find(
      (s) => s.date === this.selectedDate,
    )?.name;
  }

  async setConfig() {
    const helpers = await window.loadCardHelpers();
    this.supperTimeEl = helpers.createCardElement({
      type: "entities",
      entities: [
        {
          entity: "input_datetime.supper_target_time",
          name: "Eat supper at",
        },
      ],
    });
    this.supperTimeEl.hass = this.hass;
  }

  static styles = css`
    .Root {
      display: grid;
      grid-template-areas:
        "T S"
        "D S";
      --border-width: 3px;
      --layout-spacing: 8px;

      @media ${desktopMode} {
        grid-template-columns: min-content 1fr;
        grid-template-rows: min-content 1fr;

        padding: var(--layout-spacing);
        padding-bottom: 0;
        padding-right: 0;

        position: absolute;
        top: var(--header-height);
        bottom: 0;
      }

      @media (max-width: 1280px) {
        grid-template-areas:
          "T T"
          "D S";
      }
      @media ${mobileMode} {
        grid-template-areas:
          "T"
          "D"
          "S";
      }
    }

    .TimeField {
      grid-area: T;
      @media ${desktopMode} {
        margin-right: var(--layout-spacing);
      }
      margin-bottom: var(--layout-spacing);
    }
    @media ${mobileMode} {
      .TimeField,
      .DateTabs {
        padding: 0 var(--layout-spacing);
      }
    }

    .BackLink {
      color: var(--primary-text-color);
      margin-bottom: calc(2 * var(--layout-spacing));
      text-decoration: none;
      --mdc-icon-size: 48px;
      display: inline-block;
      position: relative;

      @media ${mobileMode} {
        display: none;
      }
    }

    .DateTabs {
      grid-area: D;

      @media ${mobileMode} {
        overflow-x: auto;
        overflow-y: visible;
        display: flex;
        max-width: calc(100vw - 2 * var(--layout-spacing));
        padding-bottom: var(--border-width);

        position: sticky;
        top: 0;
        z-index: 8;
        background-color: var(--background-color);
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);

        &::before {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          border-bottom: solid var(--state-active-color) var(--border-width);
        }
      }
    }
  `;

  render() {
    if (!this.hass) return html`Loading...`;

    return html`
      <div class="Root">
        <div class="TimeField">${this.supperTimeEl ?? "Loading..."}</div>
        <div class="DateTabs">
          <a
            class="BackLink"
            href="./0"
            title="Back"
            @click=${() => history.back()}
          >
            <ha-icon icon="mdi:arrow-left-circle"></ha-icon>
            <md-ripple></md-ripple>
          </a>
          ${this.allDates.map(
            (d) =>
              html`<supper-date-tab
                .dateInfo=${d}
                .isSelected=${d.date === this.selectedDate}
                @click=${() => (this.selectedDate = d.date)}
              ></supper-date-tab>`,
          )}
        </div>
        <supper-list-selector
          .hass=${this.hass}
          .selectedDate=${this.selectedDate}
          .selectedSupper=${this.selectedSupper}
        ></supper-list-selector>
      </div>
    `;
  }
}
customElements.define("supper-selector", SupperSelectorElement);
