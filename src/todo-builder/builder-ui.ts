import { css, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { DateOption } from "../popup-cards/todo-cards/target-days";
import dayjs from "dayjs";
import "./todo-thumbnail-card";
import { repeat } from "lit/directives/repeat.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { TodoItemWithEntity } from "../todos/subscriber";
import { TodoItemStatus } from "../todos/ha-api";
import { keyed } from "lit/directives/keyed.js";

const SORT_OPTIONS = { sort: false };

type MakeOptional<T, K extends keyof T> = Omit<T, K> & Partial<T>;

export interface UpdateItemDetail {
  /**
   * The existing item to update, or a new item to add.
   * `entityId` will be null when creating a new item.
   * TODO: Use a separate event for creating new items?
   */
readonly item: MakeOptional<TodoItemWithEntity, "entityId">;
  /** The new due date. */
readonly due?: Date;
readonly status: TodoItemStatus;
  /**
   * The list that it should be in.
   * If this doesn't match `item.entityId`, the item should
   * be removed from `item.entityId` and added to this list.
   */
readonly targetEntity: string;
/** The `.uid` of the item that the new item should be placed after. */
  previousUid?: string;
/** Set by the event handler when all operations are complete. */
  complete: Promise<unknown>;
}

/** A single list/drop target in the lower panel. */
interface DaySection extends DateOption {
  /** The status to apply to items dropped here. */
  status: TodoItemStatus;
  items: TodoItemWithEntity[];
  emptyMessage: string;
}
/** A column in the lower panel, with one or (for today) more lists. */
type DayColumn = DaySection[];

class ToboBuilderElement extends LitElement {
  @property({ attribute: "target-list-id" })
  targetListId: string = "";
  @property({ attribute: "long-term-list-id" })
  longTermListId: string = "";

  @property({ attribute: false, type: Array })
  targetList: readonly TodoItemWithEntity[] = [];
  @property({ attribute: false, type: Array })
  templateList: readonly TodoItemWithEntity[] = [];
  @property({ attribute: false, type: Array })
  longTermList: readonly TodoItemWithEntity[] = [];
  @property({ attribute: false, type: Array })
  targetDays: readonly DateOption[] = [];

  @state()
  daySections: DayColumn[] = [];

  /**
   * Used to recreate the Sortables after dragging, to remove fake elements from SortableJS.
   * Otherwise, we get duplicate items, or items missing properties that cannot be dragged
   * a second time.
   * This value changes whenever an item is added or removed from any list.
   * This includes dragging an item between days, which does not change the
   * total count.
   */
  @state()
  renderVersion = "";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.targetDays.length) return;
    this.daySections = this.groupItems();
  }
  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    if (
      changedProperties.has("targetList") ||
      changedProperties.has("targetDays")
    ) {
      if (!this.targetDays.length) return;
      this.daySections = this.groupItems();
    }
  }
  private groupItems(): DayColumn[] {
    const columns: DayColumn[] = [];
    // Add past days before the first snooze option.
    const today = dayjs().startOf("day");
    for (
      let day = dayjs().startOf("week");
      !day.isSame(today, "day");
      day = day.add(1, "day")
    ) {
      columns.push([
        {
          date: day.toDate(),
          label: day.format("dddd"),
          status: TodoItemStatus.Completed,
          emptyMessage: "Drop completed todos here",
          items: this.targetList.filter(
            (item) =>
              item.status === "completed" && day.isSame(item.due, "day"),
          ),
        },
      ]);
    }

    columns.push([
      {
        date: today.toDate(),
        label: "Today",
        status: TodoItemStatus.NeedsAction,
        emptyMessage: "Drop today's tasks items here",
        items: this.targetList.filter(
          (item) =>
            item.status === TodoItemStatus.NeedsAction &&
            // Include uncompleted items due in the past.
            // Also include items with no due date.
            !dayjs(item.due || new Date()).isAfter(today, "day"),
        ),
      },
      {
        date: today.toDate(),
        label: "Completed",
        status: TodoItemStatus.Completed,
        emptyMessage: "Drop completed todos here",
        items: this.targetList.filter(
          (item) =>
            item.status === "completed" && today.isSame(item.due, "day"),
        ),
      },
    ]);

    // Add snooze options in this week only
    const lastDay = dayjs().endOf("week");
    columns.push(
      ...this.targetDays
        .filter((o) => lastDay.isAfter(o.date))
        .map((o) => [
          {
            ...o,
            status: TodoItemStatus.NeedsAction,
            emptyMessage: "Drop todos here to snooze",
            items: this.targetList.filter((item) =>
              dayjs(o.date).isSame(item.due, "day"),
            ),
          },
        ]),
    );
    this.renderVersion = columns
      .map((c) => c.map((s) => s.items.length).join())
      .concat([this.longTermList.length.toString()])
      .join();
    return columns;
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
      .Column {
        flex-grow: 1;
      }
    }

    .TodoList {
      padding: 12px;
      gap: 12px;
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
      grid-column: 1/-1; /* Span all columns */
      &:not(:only-child) {
        display: none;
      }
    }
  `;

  private addItemToDay(
item: TodoItemWithEntity,
day: DaySection,
    previousUid?: string,
) {
    const detail: UpdateItemDetail = {
          item,
          targetEntity: this.targetListId,
          due: day.date,
          status: day.status,
previousUid,
        complete: Promise.resolve(),
      };
    this.dispatchEvent(new CustomEvent("update-todo", { detail }));
    // If the operation fails, reset the SortableJS DOM.
    detail.complete.catch(() => (this.renderVersion = "Error"));
  }

  override render() {
    return html`
      ${this.renderThumbnailList({
        items: this.templateList,
        emptyMessage: "No templates defined",
        className: "Templates",
        group: { name: "builder-todos", pull: "clone", put: false },
      })}

      <div class="LongTerm"></div>
      <div class="Days">
        ${[...this.daySections].map(
          (sections) => html`<div class="Column">
            ${sections.map((section) => this.renderSection(section))}
          </div>`,
        )}
      </div>
    `;
  }

  private renderSection(section: DaySection) {
    return html`<div
      class="Day"
      @item-added=${(
e: CustomEvent<{ data: TodoItemWithEntity; index: number }>,
) =>
        this.addItemToDay(
e.detail.data,
          section,
section.items[e.detail.index - 1]?.uid,
)}
    >
      <h3>${section.label}</h3>
      ${this.renderThumbnailList(section)}
    </div>`;
  }

  private renderThumbnailList({
    items,
    emptyMessage,
    className,
    group = "builder-todos",
  }: {
    items: readonly TodoItemWithEntity[];
    emptyMessage: string;
    className?: string;
    group?: string | object;
  }) {
    return keyed(
      this.renderVersion,
html`<ha-sortable
      class=${ifDefined(className)}
      draggable-selector="todo-thumbnail-card"
      .options=${SORT_OPTIONS}
      .group=${group}
      ?rollback=${false}
    >
      <div class="TodoList">
        ${repeat(
          items,
          (item) => item.uid,
          (item) =>
            html`<todo-thumbnail-card
              item-json=${JSON.stringify(item)}
              .sortableData=${item}
            >
            </todo-thumbnail-card>`,
        )}
        <div class="EmptyMessage">${emptyMessage}</div>
      </div>
    </ha-sortable>`,
    );
  }
}

customElements.define("todo-builder", ToboBuilderElement);
