import { HassEntity } from "home-assistant-js-websocket";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators.js";

/** JSON that we store in the `description` field to save additional data. */
export interface TodoDetails {
  emoji?: string;
  /** Stores due time if the todo entity does not support that. */
  dueTime?: string;
}

/** Indicates whether a todo item should appear as a popup card. */
export function shouldShowTodoCard(item: TodoItem) {
  if (item.status === TodoItemStatus.Completed) return false;
  const startTime = computeDueTimestamp(item);
  return !startTime || startTime < new Date();
}

export function computeDueTimestamp(item: TodoItem): Date | null {
  if (!item.due) return null;
  if (item.due.includes("T")) return new Date(item.due);
  try {
    const details = JSON.parse(item.description ?? "{}") as TodoDetails;
    if (details.dueTime) return new Date(`${item.due}T${details.dueTime}`);
  } catch {
    // Ignore invalid JSON
  }
  return new Date(item.due);
}

export function setDueTimestamp(
  hass: HomeAssistant,
  entityId: string,
  item: TodoItem,
  due: Date,
) {
  if (
    supportsFeature(
      hass.states[entityId],
      TodoListEntityFeature.SET_DUE_DATETIME_ON_ITEM,
    )
  ) {
    return updateItem(hass, entityId, { ...item, due: due.toISOString() });
  } else {
    const [date, time] = due.toISOString().split("T");
    return updateItem(hass, entityId, {
      ...item,
      due: date,
      description: JSON.stringify({
        ...JSON.parse(item.description ?? "{}"),
        dueTime: time,
      }),
    });
  }
}

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

class TodoItemsSubscriber extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;

  @property({ attribute: "entity-id" })
  entityId?: string;

  private unsubscribeItems?: ReturnType<typeof subscribeItems>;

  connectedCallback(): void {
    super.connectedCallback();
    this.subscribeItems();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribeItems?.then((unsub) => unsub());
    this.unsubscribeItems = undefined;
  }

  public willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("entityId")) this.subscribeItems();
  }

  private async subscribeItems(): Promise<void> {
    this.unsubscribeItems?.then((unsub) => unsub());
    this.unsubscribeItems = undefined;

    if (!this.hass || !this.entityId) return;
    if (!(this.entityId in this.hass.states)) return;

    this.unsubscribeItems = subscribeItems(
      this.hass!,
      this.entityId,
      (update) => {
        this.dispatchEvent(
          new CustomEvent<TodoItem[]>("items-updated", {
            detail: update.items,
          }),
        );
      },
    );
  }
}

customElements.define("todo-items-subscriber", TodoItemsSubscriber);

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
