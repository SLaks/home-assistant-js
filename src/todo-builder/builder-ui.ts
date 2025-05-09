import "./add-todo-field";
import "./todo-thumbnail-card";
import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { DateOption } from "../popup-cards/todo-cards/target-days";
import dayjs from "dayjs";
import { repeat } from "lit/directives/repeat.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { TodoItemWithEntity } from "../todos/subscriber";
import { TodoItemStatus } from "../todos/ha-api";
import { keyed } from "lit/directives/keyed.js";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { computeDueTimestamp } from "../popup-cards/todo-cards/due-times";
import { classMap } from "lit/directives/class-map.js";

export function getCategory(item: TodoItemWithEntity) {
  try {
    return JSON.parse(item.description ?? "{}").category;
  } catch {
    return "Other";
  }
}
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

  /** Set by the event handler after the update(s) are complete. */
  completionPromise?: Promise<unknown>;
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

interface CategoryHeader {
  type: "header";
  header: string;
}
type GroupedListElement =
  | (TodoItemWithEntity & { type?: undefined })
  | CategoryHeader;

class TodoBuilderElement extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: "target-list-id" })
  targetListId: string = "";
  @property({ attribute: "long-term-list-id" })
  longTermListId: string = "";
  @property({ attribute: "template-list-id" })
  templateListId: string = "";

  @property({ attribute: false, type: Array })
  targetList: readonly TodoItemWithEntity[] = [];
  @property({ attribute: false, type: Array })
  templateList: readonly TodoItemWithEntity[] = [];
  @property({ attribute: false, type: Array })
  fullLongTermList: readonly TodoItemWithEntity[] = [];
  @property({ attribute: false, type: Array })
  targetDays: readonly DateOption[] = [];

  @state()
  longTermList: TodoItemWithEntity[] = [];
  @state()
  private groupedTemplates: GroupedListElement[] = [];

  @state()
  daySections: DayColumn[] = [];

  /**
   * Used to recreate the long-term SortableJS DOM when dragging fails.
   * Otherwise, we get duplicate items, or items missing properties that cannot be dragged
   * a second time.
   * This value changes whenever items are moved, added, or removed.
   */
  @state()
  longTermRenderHash = "";
  /**
   * Used to recreate all SortableJS DOM when dragging fails.
   * Otherwise, we get duplicate items, or items missing properties that cannot be dragged
   * a second time.
   */
  @property({ type: Number, attribute: "force-rerender" })
  forceRerender = 0;

  @state()
  showDeleteTarget = false;
  /** Used to replace the delete target after every drop to clear dragged items. */
  @state()
  deleteTargetVersion = 0;
  /** Used to replace the template list after reordering. */
  @state()
  templateVersion = "";

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.targetDays.length) return;
    this.daySections = this.groupDays();
  }
  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("templateList")) {
      const categoryGroups = Map.groupBy(
        this.templateList.filter(
          (item) => item.status === TodoItemStatus.NeedsAction,
        ),
        getCategory,
      );
      if (categoryGroups.size === 1) {
        this.groupedTemplates = categoryGroups.values().next().value!;
      } else {
        this.groupedTemplates = [...categoryGroups].flatMap(
          ([header, items]) => [{ type: "header", header }, ...items],
        );
      }
    }
    if (
      changedProperties.has("targetList") ||
      changedProperties.has("targetDays")
    ) {
      if (!this.targetDays.length) return;
      this.daySections = this.groupDays();
    }

    if (changedProperties.has("fullLongTermList")) {
      const today = dayjs().startOf("day").toDate();
      // Drop items that were completed yesterday.
      // Also drop items with no recorded completion date.
      // We don't care about the timestamp.
      this.longTermList = this.fullLongTermList.filter(
        (item) =>
          item.status === TodoItemStatus.NeedsAction ||
          new Date(item.due!) > today,
      );

      // Recreate on reorder (to fix ripples) and add/remove (to fix item state).
      // Do not recreate on item completion, to preserve checkbox focus/animation.
      this.longTermRenderHash = this.longTermList
        .map((item) => item.uid)
        .join();
    }

    if (
      changedProperties.has("targetList") ||
      changedProperties.has("fullLongTermList")
    ) {
      // After dragging an item from the template list, recreate it to
      // fix SortableJS clones.
      // Only count visible items, because Google Tasks caps lists at 100
      // items, so the full count won't change.
      this.templateVersion = `${sum(this.daySections, (dc) =>
        sum(dc, (ds) => ds.items.length),
      )}-${this.longTermList.length}`;
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
    return columns;
  }

  static styles = css`
    :host {
      display: grid;
      grid-template-areas: "Templates LongTerm" "Days Days";
      grid-template-columns: 1fr min-content;
      grid-template-rows:
        minmax(
          auto,
          calc(
            2 * var(--todo-thumbnail-card-height) + 3 *
              var(--todo-thumbnail-card-gap)
          )
        )
        1fr;
      padding: var(--outer-spacing);
      gap: var(--panel-gap);
      position: relative;

      --panel-gap: 12px;
      --outer-spacing: 8px;
      --todo-thumbnail-card-height: 96px;
      --todo-thumbnail-card-gap: 12px;

      --mdc-list-side-padding: 4px;
      /* This matches a calc() in .mdc-checkbox. */
      --padding-around-mwc-checkbox: 11px;

      /* Restore card styling overridden for panel views. */
      --ha-card-border-radius: var(--restore-card-border-radius, 12px);
      --ha-card-border-width: var(--restore-card-border-width, 1px);
      --ha-card-box-shadow: var(--restore-card-box-shadow, none);
    }

    ::-webkit-scrollbar-track {
      border-radius: 10px;
      background-color: rgba(0, 0, 0, 0.5);
    }

    ::-webkit-scrollbar {
      width: 6px;
    }

    ::-webkit-scrollbar-thumb {
      border-radius: 10px;
      box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
      background-color: rgba(255, 255, 255, 0.3);
    }

    /* Add to every descendant that should stretch to fill. */
    .StretchingFlexColumn {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }

    ha-check-list-item .Description {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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

    .DeleteTarget {
      grid-area: Templates;
      position: relative;
      place-self: center;
      z-index: 100;

      width: 256px;
      aspect-ratio: 1.618;
      padding: 20px;

      background-color: var(--error-color);
      overflow: hidden;
      box-shadow: 0 10px 20px rgba(255, 255, 255, 0.09),
        0 6px 6px rgba(255, 255, 255, 0.11);

      display: flex;
      place-content: stretch;

      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);

      &.Show {
        opacity: 1;
        pointer-events: all;
      }

      .DropTarget {
        flex-grow: 1;
        display: flex;
        place-content: center;
        place-items: center;
        flex-direction: column; /* Makes thumbnails center vertically. */
      }

      ha-icon {
        color: white;
        --mdc-icon-size: 48px;
        &:not(:only-child) {
          display: none;
        }
      }

      todo-thumbnail-card {
        width: 90%;
        height: 90%;
      }
    }

    .Templates {
      grid-area: Templates;
      overflow: auto;

      todo-thumbnail-card {
        width: 150px;
      }
    }
    .LongTerm {
      grid-area: LongTerm;
      min-width: 200px;
      overflow-y: auto;

      add-todo-field {
        /* Align to the checkbox, including its padding. */
        margin: calc(
          var(--mdc-list-side-padding) + var(--padding-around-mwc-checkbox)
        );
        margin-bottom: 0;
      }

      .CompletedLabel {
        font-style: italic;
        color: #388e3c;
      }

      ha-check-list-item {
        padding-right: 8px;
      }

      /* When dropping: */
      todo-thumbnail-card {
        /* Align to the checkbox, including its padding. */
        margin: 0
          calc(
            var(--mdc-list-side-padding) + var(--padding-around-mwc-checkbox)
          );
      }
    }
    .Days {
      grid-area: Days;
      display: flex;
      justify-content: stretch;
      align-items: stretch;
      gap: var(--panel-gap);
      h3 {
        text-align: center;
        margin: 8px -8px 0;
        padding-bottom: var(--todo-thumbnail-card-gap);
        border-bottom: 1px solid var(--primary-background-color, #e0e0e0);
      }
      .Column {
        /* Make all columns equal width */
        flex-grow: 1;
        flex-basis: 100px;
        &:has(.Day + .Day) {
          /* Elements with two columns should be twice as wide. */
          flex-basis: 200px;
          flex-grow: 2;
        }

        /* Make the two inner columns equal width. */
        display: grid;
        grid-auto-columns: 1fr;
        grid-auto-flow: column;
        .Day {
          /* Truncate dropped wider long-term todos. */
          min-width: 0;
          + .Day {
            border-left: 1px solid var(--primary-background-color, #e0e0e0);
          }
        }

        add-todo-field {
          margin: var(--todo-thumbnail-card-gap) var(--todo-thumbnail-card-gap)
            0;
        }
      }
      .TodoList {
        flex-direction: column;
        align-content: stretch;
      }
    }

    .TodoList {
      flex-grow: 1;
      padding: var(--todo-thumbnail-card-gap);
      gap: var(--todo-thumbnail-card-gap);
      display: flex;
      flex-wrap: wrap;
      align-items: stretch;
      align-content: flex-start;
      overflow: hidden;

      .EmptyMessage {
        padding: 16px;
      }

      h4 {
        margin: 0;
        writing-mode: sideways-lr;
        text-align: center;
        border-bottom: 1px solid var(--primary-background-color, #e0e0e0);
      }

      /* When dropping: */
      ha-check-list-item {
        /* Include MDC's padding in the width. */
        box-sizing: border-box;
        width: 100%;
      }
    }

    .EmptyMessage {
      color: inherit;
      text-align: center;
      font-style: italic;
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
        items: this.groupedTemplates,
        // Recreate when any item is dragged from the template list,
        // to fix bad SortableJS clones.
        key: this.templateVersion,
        className: "Templates Panel",
        group: { name: "builder-todos", pull: "clone", put: false },
        content: this.renderThumbnailList({
          items: this.groupedTemplates,
          emptyMessage: "No templates defined",
        }),
      })}
      ${this.renderDeleteTarget()} ${this.renderLongTerm()}
      <div class="Days" @drag-start=${this.onDragStart}>
        ${[...this.daySections].map(
          (sections) => html`<div class="Column Panel">
            ${sections.map((section) => this.renderSection(section))}
          </div>`,
        )}
      </div>
    `;
  }

  private onDragStart() {
    this.showDeleteTarget = true;
  }
  private onDragEnd() {
    this.showDeleteTarget = false;
  }

  private renderDeleteTarget() {
    return keyed(
      this.deleteTargetVersion,
      html`<ha-sortable
        class=${classMap({
          Panel: true,
          DeleteTarget: true,
          Show: this.showDeleteTarget,
        })}
        group="builder-todos"
        ?rollback=${false}
        @item-added=${(e: CustomEvent<{ data: TodoItemWithEntity }>) =>
          this.deleteItem(e.detail.data)}
      >
        <div class="DropTarget">
          <ha-icon icon="mdi:delete"></ha-icon>
        </div>
      </ha-sortable>`,
    );
  }

  private deleteItem(item: TodoItemWithEntity) {
    this.dispatchEvent(new CustomEvent("delete-todo", { detail: item }));
    setTimeout(() => this.deleteTargetVersion++, 400);
  }

  private renderLongTerm() {
    return html`
      <div
        class="LongTerm StretchingFlexColumn Panel"
        @drag-start=${this.onDragStart}
        @item-added=${(
          e: CustomEvent<{ data: TodoItemWithEntity; index: number }>,
        ) =>
          this.addItemToLongTerm(
            e.detail.data,
            this.longTermList[e.detail.index - 1]?.uid,
          )}
      >
        <add-todo-field
          .args=${{
            targetEntity: this.longTermListId,
            status: TodoItemStatus.NeedsAction,
          }}
          placeholder="Add long-term task"
        ></add-todo-field>

        ${this.renderTodoList({
          key: this.longTermRenderHash,
          items: this.longTermList,
          className: "StretchingFlexColumn",
          content: html`<mwc-list wrapFocus multi class="StretchingFlexColumn">
            ${this.longTermList.map((item) => this.renderCheckableItem(item))}
            <ha-list-item disabled class="EmptyMessage">
              No long-term tasks!
            </ha-list-item>
          </mwc-list> `,
          options: {
            /** Return true to _cancel_ the drag. */
            filter(e: PointerEvent, dragEl: HTMLElement) {
              if (e.pointerType !== "touch") return false;
              // Allow users to check checkboxes without dragging.
              if (e.composedPath().some(isCheckbox)) return true;
              console.log(e);
              const rect = dragEl.getBoundingClientRect();
              const x = e.clientX - rect.x;
              // Cancel drag if the user is dragging from the right half of the element.
              // This allows scrolling.
              if (x > rect.width / 2) return true;
              return false;
            },
          },
        })}
      </div>
    `;
  }

  private renderSection(section: DaySection) {
    let addField: unknown = nothing;
    if (section.status === TodoItemStatus.NeedsAction) {
      addField = html`<add-todo-field
        .args=${{
          targetEntity: this.targetListId,
          status: TodoItemStatus.NeedsAction,
          due: section.date,
        }}
        placeholder=${`Add task for ${
          section.label === "Today" ? "today" : section.label
        }`}
      ></add-todo-field>`;
    }

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
      ${addField}
      ${this.renderTodoList({
        ...section,
        // Only recreate each day when items are added or removed.
        key: section.items.length,
        className: "StretchingFlexColumn",
        content: this.renderThumbnailList(section),
      })}
    </div>`;
  }

  private renderTodoList({
    items,
    className,
    group = "builder-todos",
    content,
    key,
    options,
  }: {
    items: readonly GroupedListElement[];
    className?: string;
    group?: string | object;
    content: unknown;
    key: unknown;
    options?: unknown;
  }) {
    return keyed(
      `${this.forceRerender}-${key}`,
      html`<ha-sortable
        class=${ifDefined(className)}
        @drag-end=${this.onDragEnd}
        @item-moved=${(
          e: CustomEvent<{ newIndex: number; oldIndex: number }>,
        ) => this.onItemMoved(items, e.detail.oldIndex, e.detail.newIndex)}
        draggable-selector=".Draggable"
        .group=${group}
        ?rollback=${false}
        .options=${options}
      >
        ${content}
      </ha-sortable>`,
    );
  }

  private renderCheckableItem(item: TodoItemWithEntity) {
    const isComplete = item.status === TodoItemStatus.Completed;
    let lowerContent: unknown = nothing;
    if (isComplete) {
      lowerContent = html`<div class="CompletedLabel">
        Done
        <ha-relative-time
          .hass=${this.hass}
          .datetime=${computeDueTimestamp(item)}
        >
        </ha-relative-time>
      </div>`;
    }
    return html`
      <ha-check-list-item
        left
        .hasMeta=${isComplete}
        .selected=${isComplete}
        @change=${() => this.toggleItem(item)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") this.toggleItem(item);
        }}
        .sortableData=${item}
        class="Draggable"
      >
        <div class="Description">${item.summary} ${lowerContent}</div>
      </ha-check-list-item>
    `;
  }

  toggleItem(item: TodoItemWithEntity) {
    const isComplete = item.status === TodoItemStatus.Completed;
    const detail: UpdateItemDetail = {
      item,
      targetEntity: item.entityId,
      status: isComplete
        ? TodoItemStatus.NeedsAction
        : TodoItemStatus.Completed,
      // Record the completion time.
      due: isComplete ? new Date() : undefined,
    };
    this.dispatchEvent(new CustomEvent("update-todo", { detail }));
  }

  private addItemToLongTerm(item: TodoItemWithEntity, previousUid?: string) {
    const detail: UpdateItemDetail = {
      item,
      targetEntity: this.longTermListId,
      due: undefined, // Always clear the due date.
      status: TodoItemStatus.NeedsAction,
      previousUid,
    };
    this.dispatchEvent(new CustomEvent("update-todo", { detail }));
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
    };
    this.dispatchEvent(new CustomEvent("update-todo", { detail }));
  }

  onItemMoved(
    items: readonly GroupedListElement[],
    oldIndex: number,
    newIndex: number,
  ) {
    const item = items[oldIndex];
    if (item.type === "header") return;
    let prevItem: GroupedListElement | undefined;
    if (newIndex > 0) {
      if (newIndex < oldIndex) newIndex--;
      prevItem = items[newIndex];
    }
    if (prevItem?.type === "header") {
      prevItem = items[newIndex - 1];
      if (prevItem?.type === "header") return;
    }

    const detail: UpdateItemDetail = {
      item,
      targetEntity: item.entityId,
      status: item.status,
      previousUid: prevItem?.uid,
    };
    this.dispatchEvent(new CustomEvent("update-todo", { detail }));

    // Rerender every time we move templates, because the final ordering
    // after grouping is unpredictable. Moving a template to a different
    // group may not affect any order, or may move entire groups.
    if (item.entityId === this.templateListId)
      detail.completionPromise?.then(() => (this.templateVersion += "!"));
  }

  private renderThumbnailList({
    items,
    emptyMessage,
  }: {
    items: readonly GroupedListElement[];
    emptyMessage: string;
  }) {
    return html`<div class="TodoList">
      ${repeat(
        items,
        (item) => (item.type === "header" ? item.header : item.uid),
        (item) =>
          item.type === "header"
            ? this.renderHeader(item.header)
            : this.renderTodoThumbnail(item),
      )}
      <div class="EmptyMessage">${emptyMessage}</div>
    </div>`;
  }
  private renderHeader(header: string) {
    return html`<h4>${header}</h4>`;
  }
  private renderTodoThumbnail(item: TodoItemWithEntity) {
    return html`<todo-thumbnail-card
      .hass=${this.hass}
      item-json=${JSON.stringify(item)}
      .sortableData=${item}
      class="Draggable"
    >
    </todo-thumbnail-card>`;
  }
}

function isCheckbox(el: EventTarget): boolean {
  return el instanceof HTMLElement && el.classList.contains("mdc-checkbox");
}

function sum<T>(array: T[], cb: (item: T) => number): number {
  return array.reduce((sum, item) => sum + cb(item), 0);
}

customElements.define("todo-builder", TodoBuilderElement);
