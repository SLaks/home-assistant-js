import { css, html, LitElement } from "lit";
import { property, query } from "lit/decorators.js";
import { UpdateItemDetail } from "./builder-ui";
import { TodoItemStatus } from "../todos/ha-api";

class AddTodoFieldElement extends LitElement {
  @property({ type: String, attribute: "entity-id" })
  entityId?: string;

  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 24px;
      padding-bottom: 0;
      position: relative;
    }
    ha-textfield {
      flex-grow: 1;
    }
    ha-icon-button {
      position: absolute;
      inset-inline-start: initial;
      inset-inline-end: 19px;
      right: 19px;
    }

    .buttonIcon {
      display: flex;
      justify-content: center;
    }
  `;

  override render() {
    // HTML and CSS structure are copied from HA's src/panels/lovelace/cards/hui-todo-list-card.ts
    return html`
      <ha-textfield
        class="addBox"
        placeholder="Add long-term task"
        @keydown=${this._addKeyPress}
      ></ha-textfield>
      <ha-icon-button class="addButton" title="Add" @click=${this.addItem}>
        <ha-icon class="buttonIcon" icon="mdi:plus"></ha-icon>
      </ha-icon-button>
    `;
  }

  // This is actually an HaTextField, but it has a value property.
  @query(".addBox")
  private addBox?: HTMLInputElement;

  private _addKeyPress(ev: KeyboardEvent) {
    if (ev.key === "Enter") this.addItem();
  }
  private addItem() {
    if (this.addBox?.value) {
      this.dispatchEvent(
        new CustomEvent<UpdateItemDetail>("update-todo", {
          detail: {
            item: {
              summary: this.addBox.value,
              uid: "",
              status: TodoItemStatus.NeedsAction,
            },
            status: TodoItemStatus.NeedsAction,
            targetEntity: this.entityId!,
            complete: Promise.resolve(),
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
    if (this.addBox) this.addBox.value = "";
    this.addBox?.focus();
  }
}
customElements.define("add-todo-field", AddTodoFieldElement);
