import { HassEntity } from "home-assistant-js-websocket";
import { HomeAssistant } from "custom-card-helpers/dist/types";

export const enum TodoListEntityFeature {
  CREATE_TODO_ITEM = 1,
  DELETE_TODO_ITEM = 2,
  UPDATE_TODO_ITEM = 4,
  MOVE_TODO_ITEM = 8,
  SET_DUE_DATE_ON_ITEM = 16,
  SET_DUE_DATETIME_ON_ITEM = 32,
  SET_DESCRIPTION_ON_ITEM = 64,
}

export interface TodoList {
  entity_id: string;
  name: string;
}

export const enum TodoItemStatus {
  NeedsAction = "needs_action",
  Completed = "completed",
}

export interface TodoItem {
  uid: string;
  summary: string;
  status: TodoItemStatus;
  description?: string | null;
  due?: string | null;
}
export interface TodoItems {
  items: TodoItem[];
}

export const subscribeItems = (
  hass: HomeAssistant,
  entity_id: string,
  callback: (item: TodoItems) => void,
) =>
  hass.connection.subscribeMessage<TodoItems>(callback, {
    type: "todo/item/subscribe",
    entity_id,
  });

export function updateItem(
  hass: HomeAssistant,
  entity_id: string,
  item: TodoItem,
) {
  return hass.callService(
    "todo",
    "update_item",
    {
      item: item.uid,
      rename: item.summary,
      status: item.status,
      description: item.description,
      due_datetime: item.due?.includes("T") ? item.due : undefined,
      due_date:
        item.due === undefined || item.due?.includes("T")
          ? undefined
          : item.due,
    },
    { entity_id },
  );
}
export function createItem(
  hass: HomeAssistant,
  entity_id: string,
  item: Omit<TodoItem, "uid" | "status">,
) {
  return hass.callService(
    "todo",
    "add_item",
    {
      item: item.summary,
      description: item.description || undefined,
      due_datetime: item.due?.includes("T") ? item.due : undefined,
      due_date:
        item.due === undefined || item.due?.includes("T")
          ? undefined
          : item.due,
    },
    { entity_id },
  );
}
export function deleteItems(
  hass: HomeAssistant,
  entity_id: string,
  uids: string[],
) {
  return hass.callService(
    "todo",
    "remove_item",
    {
      item: uids,
    },
    { entity_id },
  );
}

export const supportsFeature = (
  stateObj: HassEntity,
  feature: number,
): boolean => supportsFeatureFromAttributes(stateObj.attributes, feature);

export const supportsFeatureFromAttributes = (
  attributes: {
    supported_features?: number;
    [key: string]: unknown;
  },
  feature: number,
): boolean => (attributes.supported_features! & feature) !== 0;
