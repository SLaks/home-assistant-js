import { HomeAssistant } from "custom-card-helpers/dist/types";
import { LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators.js";

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
