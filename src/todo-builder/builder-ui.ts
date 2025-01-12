import { css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { TodoItem } from "../todos/ha-api";

class ToboBUilderElement extends LitElement {
  @property({ attribute: false, type: Array })
  targetList: TodoItem[] = [];
  @property({ attribute: false, type: Array })
  templateList: TodoItem[] = [];
  @property({ attribute: false, type: Array })
  longTermList: TodoItem[] = [];

  static styles = css`
    :host {
      display: grid;
    }
  `;

  override render() {
    return html`<div class=""></div>`;
  }
}

customElements.define("todo-builder", ToboBUilderElement);
