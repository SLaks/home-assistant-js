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

/** A single list/drop target in the lower pane. */
interface DaySection extends DateOption {
  /** The status to apply to items dropped here. */
  status: TodoItemStatus;
  items: TodoItemWithEntity[];
  emptyMessage: string;
}
/** A panel in the lower pane, with one or (for today) more lists. */
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
    this.daySections = this.groupDays();
  }
  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    if (
      changedProperties.has("targetList") ||
      changedProperties.has("targetDays")
    ) {
      if (!this.targetDays.length) return;
      this.daySections = this.groupDays();
    }
  }

  private groupDays(): DayColumn[] {
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
        label: "Done Today",
        status: TodoItemStatus.Completed,
        emptyMessage: "Drop completed todos here",
        items: this.targetList.filter(
          (item) =>
            item.status === "completed" && today.isSame(item.due, "day"),
        ),
      },
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
      gap: var(--panel-gap);

      --panel-gap: 12px;

      /* Restore card styling overridden for panel views. */
      --ha-card-border-radius: var(--restore-card-border-radius, 12px);
      --ha-card-border-width: var(--restore-card-border-width, 1px);
      --ha-card-box-shadow: var(--restore-card-box-shadow, none);
    }

    /* Add to every descendant that should stretch to fill. */
    .StretchingFlexColumn {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }

    .Panel {
      background: var(--ha-card-background, var(--card-background-color, #fff));
      backdrop-filter: var(--ha-card-backdrop-filter, none);
      box-shadow: var(--ha-card-box-shadow, none);
      border-radius: var(--ha-card-border-radius, 12px);
      border-width: var(--ha-card-border-width, 1px);
      border-style: solid;
      border-color: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
      color: var(--primary-text-color);
    }

    .Templates {
      grid-area: Templates;
      todo-thumbnail-card {
        max-width: 150px;
      }
    }
    .LongTerm {
      grid-area: LongTerm;
    }
    .Days {
      grid-area: Days;
      display: flex;
      justify-content: stretch;
      align-items: stretch;
      gap: var(--panel-gap);
      h3 {
        text-align: center;
        margin: 8px -8px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--primary-background-color, #e0e0e0);
        margin-bottom: 6px;
      }
      .Column {
        display: flex;
        /* Make all columns equal width */
        flex-grow: 1;
        flex-basis: 100px;
        &:has(.Day + .Day) {
          /* Elements with two columns should be twice as wide. */
          flex-basis: 200px;
          flex-grow: 2;
        }
        .Day {
          padding: 8px;
          flex-basis: 1px; /* Make adjacent columns equal width */
          + .Day {
            border-left: 1px solid var(--primary-background-color, #e0e0e0);
            /* Decrease padding between adjacent columns. */
            margin-left: -8px;
            padding-left: 0px;
          }
        }
      }
    }

    .TodoList {
      flex-grow: 1;
      padding: 12px;
      gap: 12px;
      display: flex;
      flex-wrap: wrap;
      align-items: stretch;
      align-content: flex-start;
      overflow: hidden;
    }

    .EmptyMessage {
      text-align: center;
      font-style: italic;
      padding: 16px;
      grid-column: 1/-1; /* Span all columns */
      place-self: center;
      &:not(:only-child) {
        display: none;
      }
    }
  `;

  override render() {
    return html`
      ${this.renderTodoList({
        items: this.templateList,
                className: "Templates Panel",
        group: { name: "builder-todos", pull: "clone", put: false },
        content: renderThumbnailList({
          items: this.templateList,
          emptyMessage: "No templates defined",
        }),
      })}

      <div class="LongTerm"></div>
      <div class="Days">
        ${[...this.daySections].map(
          (sections) => html`<div class="Column Panel">
            ${sections.map((section) => this.renderSection(section))}
          </div>`,
        )}
      </div>
    `;
  }

  private renderSection(section: DaySection) {
    return html`<div
      class="Day StretchingFlexColumn"
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
      ${this.renderTodoList({
        ...section,
        className: "StretchingFlexColumn",
        content: renderThumbnailList(section),
      })}
    </div>`;
  }

  private renderTodoList({
    items,
        className,
    group = "builder-todos",
    content,
  }: {
    items: readonly TodoItemWithEntity[];
        className?: string;
    group?: string | object;
    content: unknown;
  }) {
    return keyed(
      this.renderVersion,
      html`<ha-sortable
        class=${ifDefined(className)}
        @item-moved=${(
          e: CustomEvent<{ newIndex: number; oldIndex: number }>,
        ) => this.onItemMoved(items, e.detail.oldIndex, e.detail.newIndex)}
        draggable-selector=".Draggable"
        .group=${group}
        ?rollback=${false}
      >
        ${content}
      </ha-sortable>`,
    );
  }

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

  onItemMoved(
    items: readonly TodoItemWithEntity[],
    oldIndex: number,
    newIndex: number,
  ) {
    const item = items[oldIndex];
    let prevItem: TodoItemWithEntity | undefined;
    if (newIndex > 0) {
      if (newIndex < oldIndex) {
        prevItem = items[newIndex - 1];
      } else {
        prevItem = items[newIndex];
      }
    }

    this.dispatchEvent(
      new CustomEvent<UpdateItemDetail>("update-todo", {
        detail: {
          item,
          targetEntity: item.entityId,
          status: item.status,
          previousUid: prevItem?.uid,
          complete: Promise.resolve(),
        },
      }),
    );
  }
}

function renderThumbnailList({
  items,
  emptyMessage,
}: {
  items: readonly TodoItemWithEntity[];
  emptyMessage: string;
}) {
  return html`<div class="TodoList">
    ${repeat(items, (item) => item.uid, renderTodoThumbnail)}
    <div class="EmptyMessage">${emptyMessage}</div>
  </div>`;
}
function renderTodoThumbnail(item: TodoItemWithEntity) {
  return html`<todo-thumbnail-card
    item-json=${JSON.stringify(item)}
    .sortableData=${item}
class="Draggable"
  >
  </todo-thumbnail-card>`;
}

customElements.define("todo-builder", ToboBuilderElement);
