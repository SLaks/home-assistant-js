import "./target-days";
import { HomeAssistant } from "custom-card-helpers/dist/types";
import { property, state } from "lit/decorators.js";
import { applyDueTimestamp } from "./due-times";
import { css, html, LitElement } from "lit";
import { DateOption, TodoTargetDetails } from "./target-days";
import { TodoItemWithEntity } from "../../todos/subscriber";
import { updateItem } from "../../todos/ha-api";

class PopupTodoSnoozerElement extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) item?: TodoItemWithEntity;

  @state()
  snoozeButtons: DateOption[] = [];
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
    const menuButton = html` <ha-button-menu
      @action=${this.handleSnoozeMenu}
      corner="BOTTOM_END"
      menucorner="END"
      fixed
    >
      <ha-icon-button slot="trigger" label="More">
        <ha-icon class="MenuButtonIcon" icon="mdi:dots-vertical"></ha-icon>
      </ha-icon-button>

      ${this.snoozeMenu.map(
        (b) => html`<ha-list-item>${b.label}</ha-list-item>`,
      )}
    </ha-button-menu>`;

    return html`
      <todo-target-days
        .hass=${this.hass}
        @target-days-updated=${this.onTargetDaysUpdated}
      ></todo-target-days>
      <div class="Label">Snooze until ${menuButton}</div>
      <div class="Buttons">
        ${this.snoozeButtons.map(
          (b) =>
            html`<mwc-button @click=${() => this.snoozeTo(b.date)} raised>
              ${b.label}
            </mwc-button>`,
        )}
      </div>
    `;
  }

  private handleSnoozeMenu(e: CustomEvent<{ index: number }>) {
    this.snoozeTo(this.snoozeMenu[e.detail.index].date);
  }
  private snoozeTo(date: Date) {
    updateItem(
      this.hass!,
      this.item!.entityId,
      applyDueTimestamp(this.hass!, this.item!, date),
    );
  }
}

customElements.define("popup-todo-snoozer", PopupTodoSnoozerElement);
