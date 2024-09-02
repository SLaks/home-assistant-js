import { SimpleEntityBasedElement } from "./base-elements.js";
import { html, css, unsafeCSS } from "lit";

function isDateToday(dateStr) {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
    .toISOString()
    .startsWith(dateStr);
}

const desktopMode = unsafeCSS`(min-width: 1165px)`;
const mobileMode = unsafeCSS`(max-width: 1164px)`;
const veryMobileMode = unsafeCSS`(max-width: 429px)`;

export class SupperSelectorElement extends SimpleEntityBasedElement {
  static properties = {
    hass: { attribute: false },
    supperTimeEl: { state: true },
    isTodaySelected: { state: true },
    selectedDate: { state: true },
    selectedSupper: { state: true },
    isNineDays: { state: true },
    /** Milliseconds from now until supper should start. */
    actionTimeRemaining: { state: true },
    suppers: {
      state: true,
      entity: "sensor.supper_list",
      hassAttribute: "all",
    },
    allDates: {
      state: true,
      entity: "sensor.supper_today",
      hassAttribute: "all",
    },
    targetTime: { state: true, entity: "input_datetime.supper_target_time" },
    sourdoughState: { state: true, entity: "input_select.sourdough_state" },
    nineDaysStart: { state: true, entity: "sensor.9_days_start" },
  };

  update(changedProps) {
    super.update(changedProps);
    if (this.supperTimeEl) this.supperTimeEl.hass = this.hass;

    if (!this.selectedDate) {
      this.selectedDate = this.allDates.find((s) => isDateToday(s.date))?.date;
    }
    this.selectedSupper = this.allDates.find(
      (s) => s.date === this.selectedDate
    )?.name;
    this.isTodaySelected = isDateToday(this.selectedDate);
    /** Milliseconds from now until supper should start. */
    this.actionTimeRemaining =
      new Date(`${this.selectedDate}T${this.targetTime}`) - new Date();

    const nineDaysOffset =
      (new Date(this.selectedDate) - new Date(this.nineDaysStart)) /
      (24 * 60 * 60 * 1000);
    this.isNineDays = nineDaysOffset >= 0 && nineDaysOffset < 9;
  }

  isSupperDisabled(supper) {
    if (this.isNineDays && supper.gender === "fleishig") return true;
    // Suppers should only be disabled when selecting for today.
    if (!this.isTodaySelected) return false;

    if (/sourdough/i.test(supper.name) && this.sourdoughState !== "Rising")
      return true;

    const fifteenMinutes = 15 * 60 * 1000;
    let minimumActionTime = supper.actions[0].total_time.millis;
    // Allow a 15-minute grace period for defrosting only.
    if (supper.actions[0].name === "Defrost")
      minimumActionTime -= fifteenMinutes;
    if (
      this.actionTimeRemaining > 0 &&
      minimumActionTime > this.actionTimeRemaining
    )
      return true;

    return false;
  }

  async setConfig(config) {
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

  setSupper(supper) {
    this.hass.callService("script", "set_supper", {
      supper,
      date: this.selectedDate,
    });
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

    .SetBackgroundColor {
      --gender-background: color-mix(
        in lab,
        transparent 30%,
        var(--gender-color)
      );
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

      .DateTab {
        display: flex;
        align-items: center;
        text-align: center;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.3s ease-out;
        z-index: 3;
        position: relative;

        &::after {
          content: "";
          border-radius: inherit;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: solid transparent var(--border-width);
          transition: all 0.3s ease-out;
        }
        &.HasSupper::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          display: block;
          border-style: solid;
          border-width: 24px 24px 0 0;
          border-color: var(--gender-background) transparent transparent
            transparent;
        }

        @media ${desktopMode} {
          margin-bottom: 8px;
          border-radius: 12px 0 0 12px;
          min-width: 240px;
          &::after {
            border-right-width: 0;
          }
        }
        @media ${mobileMode} {
          border-radius: 12px 12px 0 0;
          flex-direction: column;
          justify-content: flex-end;
          min-width: 70px;
          flex-grow: 1;
          margin: 0 8px;
          z-index: 8;
          min-height: 132px;
          &::after {
            border-bottom-width: 0;
          }
          &.HasSupper {
            flex-grow: 15;
            background-image: var(--supper-image);
            background-position: center center;
            background-origin: border-box;
            background-size: cover;
          }
        }

        &.Selected {
          background-color: var(--ha-card-background);
          &::after {
            border-color: var(--state-active-color);
          }

          @media ${desktopMode} {
            margin-right: calc(0px - var(--border-width));
            padding-right: var(--border-width);
          }
          @media ${mobileMode} {
            margin-bottom: calc(0px - var(--border-width));
            padding-bottom: var(--border-width);
          }
        }

        .Icon > * {
          aspect-ratio: 1/1;
          object-fit: cover;
          display: block;
          @media ${desktopMode} {
            width: 80px;
            height: 80px;
            --mdc-icon-size: 80px;
          }
          @media ${mobileMode} {
            --mdc-icon-size: 10vw;
          }
        }
        @media ${mobileMode} {
          &.HasSupper .Icon {
            display: none;
          }
        }
        .Label {
          margin: 8px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          transition: all 0.3s ease-out;
        }
        @media ${mobileMode} {
          &.HasSupper .Label {
            margin: 0;
            position: absolute;
            padding: 4px;
            background-color: #333333aa;
            bottom: 0;
            left: calc(0px - var(--border-width));
            right: calc(0px - var(--border-width));
          }
          &.Selected.HasSupper .Label {
            background-color: var(--ha-card-background);
          }
        }
      }
    }

    .SupperList {
      grid-area: S;
      overflow: auto;
      display: flex;
      flex-wrap: wrap;
      overflow-y: auto;
      justify-content: center;
      padding: var(--layout-spacing) 0 0 var(--layout-spacing);

      background-color: var(--ha-card-background);
      @media ${desktopMode} {
        border-left: solid var(--state-active-color) var(--border-width);
        border-top: solid var(--state-active-color) var(--border-width);
        border-radius: 12px 0 0 0;
      }
    }

    .SupperButton {
      margin: 0 var(--layout-spacing) var(--layout-spacing) 0;
      background-position: center center;
      background-origin: border-box;
      background-size: cover;
      border-radius: 5px;
      aspect-ratio: 1.618;
      width: 300px;
      max-width: 450px;
      flex-grow: 1;
      overflow: hidden;
      transition: all 0.3s ease-out;
      cursor: pointer;
      position: relative;

      @media ${mobileMode} {
        width: 250px;
      }
      @media (max-width: 1062px) {
        width: 200px;
      }
      @media ${veryMobileMode} {
        --column-count: 2;
        width: calc(
          100% / var(--column-count) - (2 + var(--column-count)) *
            var(--layout-spacing)
        );
        aspect-ratio: 1/1.618;
      }

      &.Disabled {
        filter: grayscale(75%);
      }

      &.Selected {
        outline: var(--state-active-color) var(--border-width) solid;
      }

      .Caption {
        position: absolute;
        background-color: var(--gender-background);
        bottom: 0;
        left: 0;
        right: 0;
        padding: 4px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 17px;
        gap: 8px;

        @media ${veryMobileMode} {
          flex-direction: column;
          text-align: center;
        }

        .Action {
          display: flex;
          align-items: center;
          gap: 4px;
          justify-content: space-between;
          --mdc-icon-size: 24px;
        }
      }
    }
  `;

  render() {
    if (!this.hass) return html`Loading...`;
    let suppers = this.suppers;
    if (this.isNineDays) suppers = suppers.slice().reverse();

    return html`
      <div class="Root">
        <div class="TimeField">${this.supperTimeEl ?? "Loading..."}</div>
        <div class="DateTabs">
          <a
            class="BackLink"
            href="./0"
            title="Back"
            @click="${() => history.back()}"
          >
            <ha-icon icon="mdi:arrow-left-circle"></ha-icon>
            <md-ripple></md-ripple>
          </a>
          ${this.allDates.map((d) => this.renderDateTab(d))}
        </div>
        <div class="SupperList">
          ${suppers.map((d) => this.renderSupperButton(d))}
        </div>
      </div>
    `;
  }

  renderDateTab(dateInfo) {
    const isToday = isDateToday(dateInfo.date);
    const isSelected = this.selectedDate === dateInfo.date;
    return html`<div
      tabindex="0"
      class="DateTab SetBackgroundColor ${isSelected
        ? "Selected"
        : ""} ${dateInfo.name ? "HasSupper" : "NoSupper"}"
      style="--supper-image: url(/local/suppers/${dateInfo.image});
             --gender-color: var(--${dateInfo.gender}-color);"
      @click="${() => (this.selectedDate = dateInfo.date)}"
    >
      <div class="Icon">
        ${dateInfo.name
          ? html`<img src="/local/suppers/${dateInfo.image}" />`
          : html`<ha-icon icon="mdi:help-circle-outline" />`}
      </div>
      <div class="Label">
        <b>
          ${isToday ? "Today" : weekdayFormat.format(new Date(dateInfo.date))}
        </b>
        ${dateInfo.name}
      </div>
      <md-ripple></md-ripple>
    </div>`;
  }
  renderSupperButton(supper) {
    const isSelected = supper.name === this.selectedSupper;
    return html`<div
      tabindex="0"
      class="SupperButton SetBackgroundColor
             ${this.isSupperDisabled(supper) ? "Disabled" : ""} 
             ${isSelected ? "Selected" : ""}"
      style="background-image: url(/local/suppers/${supper.image});
             --gender-color: var(--${supper.gender}-color);"
      @click=${() => this.setSupper(isSelected ? "" : supper.name)}
    >
      <div class="Caption">
        <div>${supper.name}</div>
        <div>${supper.actions.map((a) => this.renderSupperAction(a))}</div>
      </div>
      <md-ripple></md-ripple>
    </div>`;
  }

  renderSupperAction(a) {
    return html`<div class="Action">
      <ha-icon icon="${a.icon}"></ha-icon> ${a.time.str}
    </div>`;
  }
}
customElements.define("supper-selector", SupperSelectorElement);

const weekdayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: "UTC",
});
