import { css, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { TodoItem } from "../todos/ha-api";
import { DateOption } from "../popup-cards/todo-cards/target-days";
import dayjs from "dayjs";
import "./todo-thumbnail-card";

class ToboBUilderElement extends LitElement {
  @property({ attribute: false, type: Array })
  targetList: readonly TodoItem[] = [];
  @property({ attribute: false, type: Array })
  templateList: readonly TodoItem[] = [];
  @property({ attribute: false, type: Array })
  longTermList: readonly TodoItem[] = [];
  @property({ attribute: false, type: Array })
  targetDays: readonly DateOption[] = [];

  @state()
  dayGroups: Map<string | DateOption, TodoItem[]> = new Map();

  protected override willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("targetList") && this.targetDays.length) {
      const weekStart = dayjs().startOf("week");
      const firstOption = dayjs(this.targetDays[0].date);
      this.dayGroups = new Map([
        ...Map.groupBy(
          this.targetList.filter(
            (item) =>
              weekStart.isBefore(item.due) && firstOption.isAfter(item.due),
          ),
          (item): string | DateOption => dayjs(item.due).format("Last dddd"),
        ),
        ...this.targetDays.map(
          (option) =>
            [
              option,
              this.targetList.filter((item) =>
                dayjs(item.due).isSame(option.date, "day"),
              ),
            ] as const,
        ),
      ]);
    }
  }

  static styles = css`
    :host {
      display: grid;
      grid-template-areas: "'Templates LongTerm' 'Days'";
      grid-template-columns: 1fr min-content;
      grid-template-rows: 2fr 3fr;
    }

    .Templates {
      grid-area: "Templates";
    }
    .LongTerm {
      grid-area: "LongTerm";
    }
    .Days {
      grid-area: "Days";
      display: flex;
      justify-content: stretch;
      align-items: stretch;
    }

    .TodoList {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `;

  override render() {
    return html`
      <div class="Templates TodoList">
        ${this.templateList.map(
          (item) =>
            html`<todo-thumbnail-card .item=${item}></todo-thumbnail-card>`,
        )}
      </div>
      <div class="LongTerm"></div>
      <div class="Days">
        ${[...this.dayGroups].map(
          ([key, items]) => html`
            <div class="Day">
              <h3>${typeof key === "string" ? key : key.label}</h3>
              <div class="DayItems TodoList">
                ${items.map(
                  (item) =>
                    html`<todo-thumbnail-card .item=${item}>
                    </todo-thumbnail-card>`,
                )}
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }
}

customElements.define("todo-builder", ToboBUilderElement);
