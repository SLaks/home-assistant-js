import { css, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { TodoItem } from "../../todos/ha-api";
import { TodoDetails } from "./due-times";
import "../base/emoji-icon";

const defaultEmoji = "☑️";

class PopupTodoIcon extends LitElement {
  @property({ attribute: false }) item?: TodoItem;
  @state() private details: TodoDetails = {};

  static styles = css`
    :host {
      display: flex;
    }
  `;

  protected override willUpdate(changedProps: PropertyValues<this>): void {
    if (changedProps.has("item")) {
      try {
        this.details = JSON.parse(this.item?.description ?? "{}") ?? {};
      } catch {
        this.details = {};
      }
    }
  }
  protected override render(): unknown {
    return html`<popup-emoji-icon
      emoji=${this.details.emoji ?? defaultEmoji}
    ></popup-emoji-icon>`;
  }
}
customElements.define("popup-todo-icon", PopupTodoIcon);
