import dayjs from "dayjs";
import { state } from "lit/decorators.js";
import {
  bindEntity,
  SimpleEntityBasedElement,
  stateToBool,
} from "../../base-elements";
import isBetween from "dayjs/plugin/isBetween";
import { PropertyValues } from "lit";

dayjs.extend(isBetween);

export interface TodoTargetDetails {
  quickOptions: DateOption[];
  fullWeek: DateOption[];
}
export interface DateOption {
  label: string;
  date: Date;
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

  private computeQuickOptions() {
    const options: DateOption[] = [];

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
