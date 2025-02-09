import { css, html, LitElement } from "lit";
import { property, query } from "lit/decorators.js";
import { UpdateItemDetail } from "./builder-ui";
import { TodoItemStatus } from "../todos/ha-api";

class AddTodoFieldElement extends LitElement {
  @property({ attribute: false })
  args?: Pick<UpdateItemDetail, "due" | "status" | "targetEntity">;

  @property({ type: String })
  placeholder: string = "Add todo";

  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      align-items: center;
      position: relative;
    }
    ha-textfield {
      flex-grow: 1;
    }
    ha-icon-button {
      position: absolute;
      inset-inline-start: initial;
      inset-inline-end: 3px;
      right: 3px;
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
        placeholder=${this.placeholder}
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
            ...this.args!,
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
