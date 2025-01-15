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
        .options=${SORT_OPTIONS}
        .group=${{ name: "builder-todos", pull: "clone", put: false }}
        ?rollback=${false}
      >
        <div class="Templates TodoList">
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
                Inactive: typeof key === "string",
              })}
            >
              <h3>${typeof key === "string" ? key : key.label}</h3>
              <ha-sortable .options=${SORT_OPTIONS} group="builder-todos">
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
