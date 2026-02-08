import dayjs from "dayjs";
import { state } from "lit/decorators.js";
import {
  bindEntity,
  SimpleEntityBasedElement,
  stateToBool,
} from "../../base-elements";
import isBetween from "dayjs/plugin/isBetween";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { PropertyValues } from "lit";

dayjs.extend(customParseFormat);

dayjs.extend(isBetween);

export interface TodoTargetDetails {
  quickOptions: Array<DateOption | DateMenu>;
  fullWeek: DateOption[];
}
export interface DateOption {
  label: string;
  date: Date;
  /** Never set, but must exist to make this work as a discriminated union. */
  type?: undefined;
}

export interface DateMenu {
  label: string;
  options: DateOption[];
  type: "menu";
}

class TodoTargetDaysElement extends SimpleEntityBasedElement {
  override willUpdate(changedProps: PropertyValues<this>): void {
    super.willUpdate(changedProps);
    const detail = {
      quickOptions: this.computeQuickOptions(),
      fullWeek: this.computeFullWeek(),
    };
    this.dispatchEvent(
      new CustomEvent<TodoTargetDetails>("target-days-updated", { detail }),
    );
  }

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
  @bindEntity({
    entityId: "input_select.snooze_times",
    attributeName: "options",
  })
  snoozeTimeOptions1: string[] = [];
  @state()
  @bindEntity({
    entityId: "sensor.snooze_times",
    attributeName: "options",
  })
  snoozeTimeOptions2: string[] = [];

  private computeTimeMenu(): DateOption[] {
    const now = dayjs();
    return this.snoozeTimeOptions1
      .concat(this.snoozeTimeOptions2)
      .map((label) => ({ date: dayjs(label, "h:mm A").toDate(), label }))
      .filter(({ date }) => now.isBefore(date));
  }

  private computeQuickOptions() {
    const options: Array<DateOption | DateMenu> = [];

    const today = dayjs().startOf("day");

    if (!this.isErev) {
      const times = this.computeTimeMenu();
      if (times.length)
        options.push({ type: "menu", label: "Today at…", options: times });
    }
    options.push({
      label: this.isErev ? this.motzeiLabel() : "Tomorrow",
      date: today.add(1, "day").hour(8).toDate(),
    });

    const now = dayjs();
    return options.filter((o) => o.type === "menu" || now.isBefore(o.date));
  }

  private computeFullWeek() {
    const options: DateOption[] = [];
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

customElements.define("todo-target-days", TodoTargetDaysElement);
