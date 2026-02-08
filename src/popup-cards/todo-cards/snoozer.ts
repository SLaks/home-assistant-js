import "./target-days";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { property, state } from "lit/decorators.js";
import { css, html, LitElement, PropertyValues, TemplateResult } from "lit";
import { DateMenu, DateOption, TodoTargetDetails } from "./target-days";
import { TodoItemWithEntity } from "../../todos/subscriber";
import { createItem, deleteItems, updateItem } from "../../todos/ha-api";
import { applyTodoActions } from "./todo-actions";

class PopupTodoSnoozerElement extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) item?: TodoItemWithEntity;
  @property({ attribute: "is-urgent", type: Boolean })
  isUrgent = false;

  @property({ attribute: false, type: Array })
  moveToListIds: string[] = [];

  @state()
  snoozeButtons: Array<DateOption | DateMenu> = [];
  @state()
  snoozeMenu: DateOption[] = [];

  @state()
  actionMenu: TemplateResult[] = [];

  onTargetDaysUpdated(e: CustomEvent<TodoTargetDetails>) {
    this.snoozeButtons = e.detail.quickOptions;
    this.snoozeMenu = e.detail.fullWeek;
  }
  protected override willUpdate(_changedProperties: PropertyValues): void {
    super.willUpdate(_changedProperties);
    this.actionMenu = [
      html`<h4>Snooze until</h4>`,
      ...this.snoozeMenu.map(
        (d) =>
          html`<ha-dropdown-item .slaksHandler=${() => this.snoozeTo(d.date)}>
            <ha-icon
              icon="mdi:calendar-today"
              style="opacity: 0"
              slot="icon"
            ></ha-icon>
            ${d.label}
          </ha-dropdown-item>`,
      ),
      html`<wa-divider></wa-divider>`,
      ...this.moveToListIds.map((listId) => {
        const list = this.hass!.states[listId] || {};
        return html`<ha-dropdown-item
          .slaksHandler=${() => this.moveTo(listId)}
        >
          <ha-icon
            icon=${list.attributes?.icon || "mdi:clipboard-list"}
            slot="icon"
          ></ha-icon>
          Move to ${list.attributes?.friendly_name || listId}
        </ha-dropdown-item>`;
      }),
      html`<wa-divider></wa-divider>`,
      html`<ha-dropdown-item .slaksHandler=${() => this.toggleUrgent()}>
        <ha-icon
          icon="mdi:alert-${this.isUrgent ? "minus" : "plus"}"
          slot="icon"
        ></ha-icon>
        ${this.isUrgent ? "Not urgent" : "Mark as urgent"}
      </ha-dropdown-item>`,
      html`<ha-dropdown-item
        variant="danger"
        .slaksHandler=${() => this.delete()}
      >
        <ha-icon icon="mdi:delete" slot="icon"></ha-icon>
        Delete
      </ha-dropdown-item>`,
    ];
  }

  static styles = css`
    :host {
      display: flex;
    }

    .Label {
      writing-mode: sideways-lr;
      text-align: center;
      align-self: center;
      margin-right: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
      font-size: var(--mdc-typography-button-font-size, 0.875rem);
    }

    .Buttons {
      flex-grow: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      > * {
        flex-grow: 1;
      }
    }
  `;
  protected override render(): unknown {
    const menuButton = html`<ha-dropdown
      @wa-select=${(e: CustomEvent) => {
        console.log(e);
        e.detail.item.slaksHandler();
      }}
    >
      <slaks-button slot="trigger" raised>More…</slaks-button>
      ${this.actionMenu}
    </ha-dropdown>`;

    return html`
      <todo-target-days
        .hass=${this.hass}
        @target-days-updated=${this.onTargetDaysUpdated}
      ></todo-target-days>
      <div class="Label">Snooze</div>
      <div class="Buttons">
        ${this.snoozeButtons.map((b) => this.renderSnoozeButton(b))}
        ${menuButton}
      </div>
    `;
  }

  private renderSnoozeButton(entry: DateOption | DateMenu) {
    if (entry.type === "menu") {
      return html`<ha-dropdown
        @wa-select=${(e: CustomEvent) => this.snoozeTo(e.detail.item.date)}
      >
        <slaks-button slot="trigger" raised>${entry.label}</slaks-button>
        ${entry.options.map(
          (o) =>
            html`<ha-dropdown-item .date=${o.date}>
              ${o.label}
            </ha-dropdown-item>`,
        )}
      </ha-dropdown>`;
    }
    return html`<slaks-button @click=${() => this.snoozeTo(entry.date)} raised>
      ${entry.label}
    </slaks-button>`;
  }

  private delete() {
    deleteItems(this.hass!, this.item!.entityId, [this.item!.uid]);
  }

  async moveTo(listId: string) {
    await createItem(this.hass!, listId, this.item!);
    await deleteItems(this.hass!, this.item!.entityId, [this.item!.uid]);
  }

  private toggleUrgent() {
    updateItem(
      this.hass!,
      this.item!.entityId,
      applyTodoActions(this.hass!, this.item!, {
        urgent: !this.isUrgent,
      }),
    );
  }

  private snoozeTo(due: Date) {
    updateItem(
      this.hass!,
      this.item!.entityId,
      applyTodoActions(this.hass!, this.item!, { due }),
    );
  }
}

customElements.define("popup-todo-snoozer", PopupTodoSnoozerElement);
