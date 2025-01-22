import "./target-days";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { property, state } from "lit/decorators.js";
import { css, html, LitElement } from "lit";
import { DateMenu, DateOption, TodoTargetDetails } from "./target-days";
import { TodoItemWithEntity } from "../../todos/subscriber";
import { updateItem } from "../../todos/ha-api";
import { applyTodoActions } from "./todo-actions";

class PopupTodoSnoozerElement extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) item?: TodoItemWithEntity;
  @property({ attribute: "is-urgent", type: Boolean })
  isUrgent = false;

  @state()
  snoozeButtons: Array<DateOption | DateMenu> = [];
  @state()
  snoozeMenu: DateOption[] = [];

  onTargetDaysUpdated(e: CustomEvent<TodoTargetDetails>) {
    this.snoozeButtons = e.detail.quickOptions;
    this.snoozeMenu = e.detail.fullWeek;
  }

  static styles = css`
    .Label {
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
      font-size: var(--mdc-typography-button-font-size, 0.875rem);
      margin-left: 18px;
      margin-top: -8px;
    }

    .Buttons {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      > * {
        flex-grow: 1;
      }
    }

    .MenuButtonIcon {
      display: flex;
      justify-content: center;
    }
  `;
  protected override render(): unknown {
    const menuButton = html`<ha-button-menu
      @action=${(e: CustomEvent) => {
        if (e.detail.index >= this.snoozeMenu.length) this.toggleUrgent();
        else this.snoozeTo(this.snoozeMenu[e.detail.index].date);
      }}
      corner="BOTTOM_END"
      menu-corner="END"
      fixed
    >
      <ha-icon-button slot="trigger" label="More">
        <ha-icon class="MenuButtonIcon" icon="mdi:dots-vertical"></ha-icon>
      </ha-icon-button>

      ${this.snoozeMenu.map(
        (b) => html`<ha-list-item>${b.label}</ha-list-item>`,
      )}
      <li divider role="separator"></li>
      <ha-list-item
        >${this.isUrgent ? "Not urgent" : "Mark as urgent"}</ha-list-item
      >
    </ha-button-menu>`;

    return html`
      <todo-target-days
        .hass=${this.hass}
        @target-days-updated=${this.onTargetDaysUpdated}
      ></todo-target-days>
      <div class="Label">Snooze until ${menuButton}</div>
      <div class="Buttons">
        ${this.snoozeButtons.map((b) => this.renderSnoozeButton(b))}
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
        <mwc-button slot="trigger" raised fullwidth>${entry.label}</mwc-button>
        ${entry.options.map(
          (o) => html`<ha-list-item>${o.label}</ha-list-item>`,
        )}
      </ha-button-menu>`;
    }
    return html`<mwc-button @click=${() => this.snoozeTo(entry.date)} raised>
      ${entry.label}
    </mwc-button>`;
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
