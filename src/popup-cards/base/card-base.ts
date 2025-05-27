import { css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

class PopupCardBase extends LitElement {
  @property({ type: Boolean, attribute: "is-completed" })
  isCompleted = false;

  @property({ type: Boolean, attribute: "not-clickable" })
  notClickable = false;

  static styles = css`
    .Card {
      height: var(--popup-card-height, 300px);
      max-width: var(--popup-card-width, 400px);

      --panel-radius: 16px;
      /* 
       * This ought to fall back to var(--secondary-background-color), 
       * but most themes make that the same as primary. 
       */
      background: var(--popup-card-background-color, rgba(0, 0, 0, 0.2));

      color: var(--popup-card-text-color, var(--primary-text-color));
      overflow: hidden;

      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
      gap: 12px;

      font-size: 1.2rem;
      text-align: center;
      text-overflow: ellipsis;

      .Name {
        display: var(--popup-card-name-display, block);
        font-size: var(--popup-card-name-font-size, 1.3rem);
      }

      .Icon {
        flex-grow: 1;
        display: flex;
        place-content: center;
        min-height: 0;
      }

      &.isCompleted {
        background-color: #388e3c;
        color: white;
      }

      .Actions {
        align-self: stretch;
        flex-shrink: 0;
        background: var(--primary-background-color);
        color: var(--mdc-theme-text-primary-on-background, rgba(0, 0, 0, 0.87));
        border-radius: var(--panel-radius);
        padding: 12px;
        --mdc-theme-primary: var(--mdc-theme-surface);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);

        /* Make mwc-button look consistent: */
        --mdc-theme-on-primary: var(--primary-text-color);
        --mdc-theme-primary: var(
          --ha-card-background,
          var(--card-background-color, #fff)
        );
        --mdc-ripple-hover-opacity: var(--ha-ripple-hover-opacity, 0.08);
        --mdc-ripple-pressed-opacity: var(--ha-ripple-pressed-opacity, 0.12);
        --mdc-ripple-color: var(
          --ha-ripple-pressed-color,
          var(--ha-ripple-color, var(--secondary-text-color))
        );
      }
    }
  `;

  protected override render(): unknown {
    return html`
      <ha-card class=${classMap({ isCompleted: this.isCompleted, Card: true })}>
        <div class="Icon">
          <slot name="icon"></slot>
        </div>
        <div class="Name">
          <slot name="name"></slot>
        </div>
        ${this.notClickable ? null : html`<md-ripple></md-ripple>`}
        <div
          class="Actions"
          @keydown=${(e: Event) => e.stopPropagation()}
          @closed=${(e: Event) => e.stopPropagation()}
          @pointerdown=${(e: Event) => e.stopPropagation()}
          @click=${(e: Event) => e.stopPropagation()}
        >
          <slot name="actions"></slot>
        </div>
      </ha-card>
    `;
  }
}
customElements.define("popup-card-base", PopupCardBase);
