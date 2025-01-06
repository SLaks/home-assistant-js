import { HomeAssistant } from "custom-card-helpers/dist/types";
import { property, state } from "lit/decorators.js";
import { setDueTimestamp } from "./due-times";
import {
  bindEntity,
  SimpleEntityBasedElement,
  stateToBool,
} from "../../base-elements";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { css, html, PropertyValues } from "lit";
import { TodoItem } from "../../todos/ha-api";

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
    .Label {
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
      font-size: var(--mdc-typography-button-font-size, 0.875rem);
      margin-left: 18px;
      margin-top: -8px;
    }

    .Buttons {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      > * {
        flex-grow: 1;
      }
    }

    .MenuButtonIcon {
      display: flex;
      justify-content: center;
    }
  `;
  protected override render(): unknown {
    const menuButton = html` <ha-button-menu
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
    </ha-button-menu>`;

    return html`
      <div class="Label">Snooze until ${menuButton}</div>
      <div class="Buttons">
        ${this.snoozeButtons.map(
          (b) =>
            html`<mwc-button @click=${() => this.snoozeTo(b.date)} raised>
              ${b.label}
            </mwc-button>`,
        )}
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
    }
    options.push({
      label: this.isErev ? this.motzeiLabel() : "Tomorrow",
      date: today.add(1, "day").hour(8).toDate(),
    });

    const nextWeek = this.motzeiDate?.add(1, "day").hour(8);
    if (nextWeek && !options.some(({ date }) => nextWeek.isSame(date, "day"))) {
      options.push({
        label: `Next ${nextWeek.format("dddd")}`,
        date: nextWeek.toDate(),
      });
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
      if (this.erevDate?.isSame(date, "date") && date.day() !== 5) {
        label += " (ערב יום טוב)";
      } else if (this.motzeiDate?.isSame(date, "date")) {
        label = this.motzeiLabel();
      } else if (date.isBetween(this.erevDate!, this.motzeiDate!, "date")) {
        continue;
      }

      options.push({ label, date: date.toDate() });
    }
    return options;
  }

  private motzeiLabel(): string {
    return `מוצאי ${this.motzeiDate?.day() === 6 ? "שבת" : "יום טוב"}`;
  }
}
dayjs.extend(isBetween);

customElements.define("popup-todo-snoozer", PopupTodoSnoozerElement);