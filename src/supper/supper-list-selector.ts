import "../todos/history-index";
import { property, state } from "lit/decorators.js";
import { bindEntity, SimpleEntityBasedElement } from "../base-elements";
import { SupperActionInfo, SupperInfo } from "./data-types";
import { css, html, PropertyValues } from "lit";
import { isDateToday } from "./helpers";
import {
  desktopMode,
  mobileMode,
  utilityClasses,
  veryMobileMode,
} from "./styles";
import { classMap } from "lit/directives/class-map.js";
import { TodoIndex } from "../todos/history-index";
import dayjs from "dayjs";

export class SupperListSelectorElement extends SimpleEntityBasedElement {
  @property()
  selectedDate?: string;
  @property()
  selectedSupper?: string;

  @state()
  isTodaySelected = false;
  @state()
  isNineDays = false;
  /** Milliseconds from now until supper should start. */
  @state()
  actionTimeRemaining = 0;

  @state()
  @bindEntity({ entityId: "input_datetime.supper_target_time" })
  targetTime = "";

  @state()
  @bindEntity({ entityId: "sensor.9_days_start" })
  nineDaysStart = "";

  @state()
  @bindEntity({
    entityId: "sensor.supper_list",
    attributeName: "all",
  })
  suppers: SupperInfo[] = [];

  @state()
  @bindEntity({ entityId: "input_select.sourdough_state" })
  sourdoughState = "";

  @state()
  supperHistory: TodoIndex = new Map();

  willUpdate(changedProps: PropertyValues<this>) {
    super.willUpdate(changedProps);
    this.isTodaySelected =
      !!this.selectedDate && isDateToday(this.selectedDate);
    this.actionTimeRemaining =
      +new Date(`${this.selectedDate}T${this.targetTime}`) - +new Date();

    const nineDaysOffset =
      (+new Date(this.selectedDate || new Date()) -
        +new Date(this.nineDaysStart)) /
      (24 * 60 * 60 * 1000);
    this.isNineDays = nineDaysOffset >= 0 && nineDaysOffset < 9;
  }

  private isSupperDisabled(supper: SupperInfo) {
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

  setSupper(supper: string) {
    this.hass!.callService("script", "set_supper", {
      supper,
      date: this.selectedDate,
    });
  }
  static styles = css`
    ${utilityClasses}

    :host {
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

  protected override render() {
    let suppers = this.suppers;
    if (this.isNineDays) suppers = suppers.slice().reverse();
    return html` <todo-history-index
        .hass=${this.hass}
        entity-id="todo.suppers"
        index-field="description"
        @todo-index-updated=${(e: CustomEvent<TodoIndex>) =>
          (this.supperHistory = e.detail)}
      ></todo-history-index>
      ${suppers.map((d) => this.renderSupperButton(d))}`;
  }
  private renderSupperButton(supper: SupperInfo) {
    const isSelected = supper.name === this.selectedSupper;
    return html`<div
      tabindex="0"
      role="option"
      class=${classMap({
        SupperButton: true,
        SetBackgroundColor: true,
        Disabled: this.isSupperDisabled(supper),
        Selected: isSelected,
      })}
      style="background-image: url(/local/suppers/${supper.image});
             --gender-color: var(--${supper.gender}-color);"
      @click=${() => this.setSupper(isSelected ? "" : supper.name)}
    >
      <div class="Caption">
        <div>
          <div>${supper.name}</div>
          ${this.renderSubcaption(supper)}
        </div>
        <div>${supper.actions.map((a) => this.renderSupperAction(a))}</div>
      </div>
      <md-ripple></md-ripple>
    </div>`;
  }

  private renderSubcaption(supper: SupperInfo) {
    const lastUse = this.supperHistory.get(supper.name)?.due;
    if (!lastUse) return;
    const diff = dayjs().diff(lastUse, "day");
    if (diff === 1) return html`<i>Last made yesterday</i>`;
    return html`<i>Last made ${diff} days ago</i>`;
  }

  private renderSupperAction(a: SupperActionInfo) {
    return html`<div class="Action">
      <ha-icon icon=${a.icon}></ha-icon> ${a.time.str}
    </div>`;
  }
}
customElements.define("supper-list-selector", SupperListSelectorElement);
