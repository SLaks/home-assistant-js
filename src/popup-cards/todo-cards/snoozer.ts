import "./target-days";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { property, state } from "lit/decorators.js";
import { css, html, LitElement, PropertyValues } from "lit";
import { DateMenu, DateOption, TodoTargetDetails } from "./target-days";
import { TodoItemWithEntity } from "../../todos/subscriber";
import { createItem, deleteItems, updateItem } from "../../todos/ha-api";
import { applyTodoActions } from "./todo-actions";

interface MenuItem {
  item: unknown;
  handler(): void;
}

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
  actionMenu: MenuItem[] = [];

  onTargetDaysUpdated(e: CustomEvent<TodoTargetDetails>) {
    this.snoozeButtons = e.detail.quickOptions;
    this.snoozeMenu = e.detail.fullWeek;
  }
  protected override willUpdate(_changedProperties: PropertyValues): void {
    super.willUpdate(_changedProperties);
    this.actionMenu = [
      ...this.snoozeMenu.map((d) => ({
        item: html`<ha-list-item graphic="icon"> ${d.label} </ha-list-item>`,
        handler: () => this.snoozeTo(d.date),
      })),
      ...this.moveToListIds.map((listId, index) => {
        const list = this.hass!.states[listId] || {};
        return {
          item: html` ${index === 0
              ? html`<li divider role="separator"></li>`
              : ""}
            <ha-list-item graphic="icon">
              <ha-icon
                icon=${list.attributes?.icon || "mdi:clipboard-list"}
                slot="graphic"
              ></ha-icon>
              Move to ${list.attributes?.friendly_name || listId}
            </ha-list-item>`,
          handler: () => this.moveTo(listId),
        };
      }),
      {
        item: html`<li divider role="separator"></li>
          <ha-list-item graphic="icon">
            <ha-icon
              icon="mdi:alert-${this.isUrgent ? "minus" : "plus"}"
              slot="graphic"
            ></ha-icon>
            ${this.isUrgent ? "Not urgent" : "Mark as urgent"}
          </ha-list-item>`,
        handler: () => this.toggleUrgent(),
      },
      {
        item: html`<ha-list-item graphic="icon" class="Warning">
          <ha-icon class="Warning" icon="mdi:delete" slot="graphic"></ha-icon>
          Delete
        </ha-list-item>`,
        handler: () => this.delete(),
      },
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
      .IconMenu {
        flex-grow: 0;
      }
    }

    .MenuButtonIcon {
      display: flex;
      justify-content: center;
    }

    .Warning {
      color: var(--error-color);
    }
  `;
  protected override render(): unknown {
    const menuButton = html`<ha-button-menu
      class="IconMenu"
      @action=${(e: CustomEvent) => {
        this.actionMenu[e.detail.index].handler();
      }}
      corner="BOTTOM_END"
      menu-corner="END"
      fixed
    >
      <ha-icon-button slot="trigger" label="More">
        <ha-icon class="MenuButtonIcon" icon="mdi:dots-vertical"></ha-icon>
      </ha-icon-button>

      ${this.actionMenu.map(({ item }) => item)}
    </ha-button-menu>`;

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
      return html`<ha-button-menu
        @action=${(e: CustomEvent) =>
          this.snoozeTo(entry.options[e.detail.index].date)}
        fixed
      >
        <slaks-button slot="trigger" raised>${entry.label}</slaks-button>
        ${entry.options.map(
          (o) => html`<ha-list-item>${o.label}</ha-list-item>`,
        )}
      </ha-button-menu>`;
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
