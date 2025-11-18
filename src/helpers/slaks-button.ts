import { LitElement, css, html } from "lit";
import { property } from "lit/decorators.js";

class SLaksButton extends LitElement {
  @property({ type: String }) icon = "";
  @property({ type: Boolean }) raised = false;

  static styles = css`
    button {
      background: var(--card-background-color);
      color: var(--primary-text-color);
      border: none;
      position: relative;
      border-radius: 4px;
      padding: 8px 16px;
      width: 100%;
      cursor: pointer;
    }
    button[raised] {
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }
  `;

  render() {
    return html`
      <button ?raised=${this.raised}>
        ${this.icon ? html`<ha-icon icon=${this.icon}></ha-icon>` : ""}
        <slot></slot>
        <md-ripple></md-ripple>
      </button>
    `;
  }
}

customElements.define("slaks-button", SLaksButton);
