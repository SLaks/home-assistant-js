import { HomeAssistant } from "custom-card-helpers/dist/types";
import { LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators.js";
import { subscribeItems, TodoItem } from "./ha-api";

export interface TodoItemWithEntity extends TodoItem {
  entityId: string;
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
          new CustomEvent<TodoItemWithEntity[]>("items-updated", {
            detail: update.items.map((item) => ({
              ...item,
              entityId: this.entityId!,
            })),
          }),
        );
      },
    );
  }
}

customElements.define("todo-items-subscriber", TodoItemsSubscriber);
