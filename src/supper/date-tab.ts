import { css, html, LitElement } from "lit";
import { desktopMode, mobileMode, utilityClasses } from "./styles";
import { property } from "lit/decorators.js";
import { SupperForDate } from "./data-types";
import { isDateToday } from "./helpers";
import { classMap } from "lit/directives/class-map.js";

class DateTabElement extends LitElement {
  @property({ type: Object, attribute: false })
  dateInfo?: SupperForDate;

  @property({ type: Boolean, attribute: "is-selected" })
  isSelected = false;

  static styles = css`
    ${utilityClasses}

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
  `;

  override render() {
    if (!this.dateInfo) return null;
    const isToday = isDateToday(this.dateInfo.date);
    return html`<div
      tabindex="0"
      role="tab"
      class=${classMap({
        DateTab: true,
        SetBackgroundColor: true,
        Selected: this.isSelected,
        [this.dateInfo.name ? "HasSupper" : "NoSupper"]: true,
      })}
      style="--supper-image: url(/local/suppers/${this.dateInfo.image});
             --gender-color: var(--${this.dateInfo.gender}-color);"
    >
      <div class="Icon">
        ${this.dateInfo.name
          ? html`<img src="/local/suppers/${this.dateInfo.image}" />`
          : html`<ha-icon icon="mdi:help-circle-outline"></ha-icon>`}
      </div>
      <div class="Label">
        <b>
          ${isToday
            ? "Today"
            : weekdayFormat.format(new Date(this.dateInfo.date))}
        </b>
        ${this.dateInfo.name}
      </div>
      <md-ripple></md-ripple>
    </div>`;
  }
}

const weekdayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: "UTC",
});

customElements.define("date-tab", DateTabElement);
