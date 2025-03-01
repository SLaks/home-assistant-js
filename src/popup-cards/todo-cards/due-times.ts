import { HomeAssistant } from "custom-card-helpers/dist/types";
import {
  TodoItem,
  TodoItemStatus,
  supportsFeature,
  TodoListEntityFeature,
} from "../../todos/ha-api";
import { TodoItemWithEntity } from "../../todos/subscriber";
import { isUrgent } from "./todo-actions";

/** JSON that we store in the `description` field to save additional data. */
export interface TodoDetails {
  emoji?: string;
  /** Stores due time if the todo entity does not support that. */
  dueTime?: string;
}

/** Indicates whether a todo item should appear as a popup card. */
export function shouldShowTodoCard(
  item: TodoItem,
  showUrgentTodosOnly: boolean,
): boolean {
  if (item.status === TodoItemStatus.Completed) return false;
  if (showUrgentTodosOnly && !isUrgent(item)) return false;
  const startTime = computeDueTimestamp(item);
  return !startTime || startTime < new Date();
}

/** Returns true if an item is snoozed for between now and midnight. */
export function isSnoozedLaterToday(item: TodoItem): boolean {
  const due = computeDueTimestamp(item);
  if (!due) return false;
  const now = new Date();
  return due > now && due < new Date(now.setHours(23, 59, 59, 999));
}

/** Resolves a todo item's due time, reading from our custom field if necessary. */
export function computeDueTimestamp(item: TodoItem): Date | null {
  if (!item.due) return null;
  if (item.due.includes("T")) return new Date(item.due);
  try {
    const details = JSON.parse(item.description ?? "{}") as TodoDetails;
    if (details.dueTime) return new Date(`${item.due} ${details.dueTime}`);
  } catch {
    // Ignore invalid JSON
  }
  // Parse the date, but add the current timezone offset so we don't interpret it in UTC
  return new Date(
    +new Date(item.due) + new Date().getTimezoneOffset() * 60_000,
  );
}

/**
 * Returns an updated todo item with a due time.
 * For todo entities that do not support due times, stores the time
 * in the description field.
 */
export function applyDueTimestamp(
  hass: HomeAssistant,
  item: TodoItemWithEntity,
  due: Date,
): TodoItemWithEntity {
  if (
    supportsFeature(
      hass.states[item.entityId],
      TodoListEntityFeature.SET_DUE_DATETIME_ON_ITEM,
    )
  ) {
    return { ...item, due: due.toISOString() };
  } else {
    const [date] = due.toISOString().split("T");
    return {
      ...item,
      due: date,
      description: JSON.stringify({
        ...JSON.parse(item.description ?? "{}"),
        dueTime: due.toTimeString(),
      }),
    };
  }
}
