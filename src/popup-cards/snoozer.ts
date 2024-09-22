import { HomeAssistant } from "custom-card-helpers/dist/types";
import { property, state } from "lit/decorators.js";
import { setDueTimestamp } from "./due-times";
import {
  bindEntity,
  SimpleEntityBasedElement,
  stateToBool,
} from "../base-elements";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { css, html, PropertyValues } from "lit";
import { TodoItem } from "../todos/ha-api";

interface SnoozeOption {
  label: string;
  date: Date;
}

class PopupTodoSnoozerElement extends SimpleEntityBasedElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) entityId?: string;
  @property({ attribute: false }) item?: TodoItem;

  @bindEntity({
    entityId: "binary_sensor.jewish_calendar_erev_shabbat_hag",
    converter: stateToBool,
  })
  @state()
  isErev = false;

  @bindEntity({
    entityId: "sensor.jewish_calendar_upcoming_candle_lighting",
    converter: (val) => dayjs(val).startOf("day"),
  })
  @state()
  erevDate?: dayjs.Dayjs;
  @bindEntity({
    entityId: "sensor.jewish_calendar_upcoming_havdalah",
    converter: (val) => dayjs(val).startOf("day"),
  })
  @state()
  motzeiDate?: dayjs.Dayjs;

  @state()
  snoozeButtons: SnoozeOption[] = [];
  @state()
  snoozeMenu: SnoozeOption[] = [];

  override willUpdate(changedProps: PropertyValues<this>): void {
    super.willUpdate(changedProps);
    // Don't recompute on every state update; only when our derived properties change.
    if (changedProps.has("hass") && changedProps.size === 1) return;
    this.snoozeButtons = this.computeSnoozeButtons();
    this.snoozeMenu = this.computeSnoozeMenu();
  }
  static styles = css`
    :host {
      /* background: var(
        --ha-dialog-surface-background,
        var(--mdc-theme-surface, #fff)
      );
      color: var(--mdc-theme-text-primary-on-background, rgba(0, 0, 0, 0.87)); */
      padding: 8px;
    }
    .Label {
      text-align: left;
      display: flex;
      align-items: center;
      margin: 0 -8px;

      &::before,
      &::after {
        content: "";
        display: block;
        border-top: 1px solid gray;
        border-bottom: 1px solid
          var(--ha-dialog-surface-background, var(--mdc-theme-surface, #fff));
      }
      &::before {
        width: 16px;
        margin-right: 4px;
      }
      &::after {
        margin-left: 4px;
        flex-grow: 1;
      }
    }

    .Buttons {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
    }

    .MenuButtonIcon {
      display: flex;
      justify-content: center;
      align-items: center; /* Fixes a layout issue in the button. */
    }
  `;
  protected override render(): unknown {
    return html`
      <div class="Label">Snooze until</div>
      <div class="Buttons">
        ${this.snoozeButtons.map(
          (b) =>
            html`<ha-button @click=${() => this.snoozeTo(b.date)}>
              ${b.label}
            </ha-button>`,
        )}

        <ha-button-menu
          @action=${this.handleSnoozeMenu}
          corner="BOTTOM_END"
          menucorner="END"
          fixed
        >
          <ha-icon-button slot="trigger" label="More">
            <ha-icon class="MenuButtonIcon" icon="mdi:dots-vertical"></ha-icon>
          </ha-icon-button>

          ${this.snoozeMenu.map(
            (b) => html`<ha-list-item>${b.label}</ha-list-item>`,
          )}
        </ha-button-menu>
      </div>
    `;
  }

  private handleSnoozeMenu(e: CustomEvent<{ index: number }>) {
    this.snoozeTo(this.snoozeMenu[e.detail.index].date);
  }
  private snoozeTo(date: Date) {
    setDueTimestamp(this.hass!, this.entityId!, this.item!, date);
  }

  private computeSnoozeButtons() {
    const options: SnoozeOption[] = [];

    const today = dayjs().startOf("day");

    if (!this.isErev) {
      options.push({ label: "8:00 PM", date: today.hour(20).toDate() });
      options.push({
        label: "Tomorrow",
        date: today.add(1, "day").hour(8).toDate(),
      });
    }

    const nextWeek = this.motzeiDate?.add(1, "day").hour(8);
    if (nextWeek && !options.some(({ date }) => nextWeek.isSame(date, "day"))) {
      options.push({ label: "Next week", date: nextWeek.toDate() });
    }

    const now = dayjs();
    return options.filter(({ date }) => now.isBefore(date));
  }

  private computeSnoozeMenu() {
    const options: SnoozeOption[] = [];
    const lastDay = dayjs().startOf("day").add(7, "days");
    for (
      let date = dayjs().startOf("day").add(1, "day").hour(8);
      date < lastDay;
      date = date.add(1, "day")
    ) {
      let label = date.format("dddd");
      if (this.erevDate?.isSame(date, "date")) {
        label = `ערב ${date.day() === 5 ? "שבת" : "יום טוב"}`;
      } else if (this.motzeiDate?.isSame(date, "date")) {
        label = `מוצאי ${date.day() === 6 ? "שבת" : "יום טוב"}`;
      } else if (date.isBetween(this.erevDate!, this.motzeiDate!, "date")) {
        continue;
      }

      options.push({ label, date: date.toDate() });
    }
    return options;
  }
}
dayjs.extend(isBetween);

customElements.define("popup-todo-snoozer", PopupTodoSnoozerElement);
