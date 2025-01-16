import { HomeAssistant } from "custom-card-helpers/dist/types";
import { TodoItemStatus } from "../../todos/ha-api";
import { TodoItemWithEntity } from "../../todos/subscriber";
import { applyDueTimestamp } from "./due-times";

/** Returns an updated todo item with the specified actions applied. */
export function applyTodoActions(
  hass: HomeAssistant,
  item: TodoItemWithEntity,
  actions: { status?: TodoItemStatus; due?: Date },
) {
  // Record the completion time, unless we're explicitly
  // marking it as completed at a specific time.
  if (actions.status === TodoItemStatus.Completed && !actions.due) {
    actions.due = new Date();
  }

  let updatedItem = { ...item };
  if (actions.status) updatedItem.status = actions.status;
  if (actions.due)
    updatedItem = applyDueTimestamp(hass, updatedItem, actions.due);

  if (actions.status === TodoItemStatus.Completed) {
    // Also record a completion event, to trigger automations or sensors.
    hass.callApi("POST", `events/popup_todo_completed`, {
      ...updatedItem,
      entity_id: item.entityId,
    });
  }

  return updatedItem;
}
