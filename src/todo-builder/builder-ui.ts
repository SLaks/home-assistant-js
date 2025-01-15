import { css, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { TodoItem } from "../todos/ha-api";
import { DateOption } from "../popup-cards/todo-cards/target-days";
import dayjs from "dayjs";
import "./todo-thumbnail-card";
import { classMap } from "lit/directives/class-map.js";

const SORT_OPTIONS = { sort: false };

class ToboBuilderElement extends LitElement {
  @property({ attribute: false, type: Array })
  targetList: readonly TodoItem[] = [];
  @property({ attribute: false, type: Array })
  templateList: readonly TodoItem[] = [];
  @property({ attribute: false, type: Array })
  longTermList: readonly TodoItem[] = [];
  @property({ attribute: false, type: Array })
  targetDays: readonly DateOption[] = [];

  @state()
  dayGroups: Map<DateOption, TodoItem[]> = new Map();

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.targetDays.length) return;
    this.dayGroups = this.groupItems();
  }
  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    if (
      changedProperties.has("targetList") ||
      changedProperties.has("targetDays")
    ) {
      if (!this.targetDays.length) return;
      this.dayGroups = this.groupItems();
    }
  }
  private groupItems() {
    const allDays: DateOption[] = [];
    // Add past days before the first snooze option.
    for (
      let day = dayjs().startOf("week");
      !day.isSame(this.targetDays[0].date, "day");
      day = day.add(1, "day")
    ) {
      allDays.push({
        date: day.toDate(),
        label: day.isSame(new Date(), "day") ? "Today" : day.format("dddd"),
      });
    }
    // Add snooze options in this week only
    const lastDay = dayjs().endOf("week");
    allDays.push(...this.targetDays.filter((o) => lastDay.isAfter(o.date)));
    return new Map(
      allDays.map((option) => [
        option,
        this.targetList.filter(
          (item) =>
            // Ignore completed items with no date.
            (item.status === "needs_action" || item.due) &&
            // If the item was never snoozed, show it today.
            dayjs(item.due || new Date()).isSame(option.date, "day"),
        ),
      ]),
    );
  }

  static styles = css`
    :host {
      display: grid;
      grid-template-areas: "Templates LongTerm" "Days Days";
      grid-template-columns: 1fr min-content;
      grid-template-rows: min-content 3fr;
      padding: 8px;

      /* Restore card styling overridden for panel views. */
      --ha-card-border-radius: var(--restore-card-border-radius, 12px);
      --ha-card-border-width: var(--restore-card-border-width, 1px);
      --ha-card-box-shadow: var(--restore-card-box-shadow, none);
    }

    .Templates {
      grid-area: Templates;
    }
    .LongTerm {
      grid-area: LongTerm;
    }
    .Days {
      grid-area: Days;
      display: flex;
      justify-content: stretch;
      align-items: stretch;
      gap: 12px;
      h3 {
        text-align: center;
      }
      .Day {
        flex-grow: 1;
      }
    }

    .TodoList {
      padding: 8px;
      gap: 8px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      grid-template-rows: 1fr;
      overflow: hidden;

      background: var(--ha-card-background, var(--card-background-color, #fff));
      backdrop-filter: var(--ha-card-backdrop-filter, none);
      box-shadow: var(--ha-card-box-shadow, none);
      border-radius: var(--ha-card-border-radius, 12px);
      border-width: var(--ha-card-border-width, 1px);
      border-style: solid;
      border-color: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
      color: var(--primary-text-color);
    }

    .EmptyMessage {
      text-align: center;
      font-style: italic;
      padding: 16px;
      &:not(:only-child) {
        display: none;
      }
    }
  `;

  override render() {
    return html`
      <ha-sortable
        class="Templates"
        .options=${SORT_OPTIONS}
        .group=${{ name: "builder-todos", pull: "clone", put: false }}
        ?rollback=${false}
      >
        <div class="TodoList">
          ${this.templateList.map(
            (item) =>
              html`<todo-thumbnail-card item-json=${JSON.stringify(item)}>
              </todo-thumbnail-card>`,
          )}
        </div>
      </ha-sortable>
      <div class="LongTerm"></div>
      <div class="Days">
        ${[...this.dayGroups].map(
          ([key, items]) => html`
            <div
              class=${classMap({
                Day: true,
              })}
            >
              <h3>${key.label}</h3>
              <ha-sortable
                .options=${SORT_OPTIONS}
                draggable-selector="todo-thumbnail-card"
                group="builder-todos"
              >
                <div class="DayItems TodoList">
                  ${items.map(
                    (item) =>
                      html`<todo-thumbnail-card
                        item-json=${JSON.stringify(item)}
                      >
                      </todo-thumbnail-card>`,
                  )}
                  ${items.length === 0
                    ? html`<div class="EmptyMessage">Drop todos here</div>`
                    : null}
                </div>
              </ha-sortable>
            </div>
          `,
        )}
      </div>
    `;
  }
}

customElements.define("todo-builder", ToboBuilderElement);
