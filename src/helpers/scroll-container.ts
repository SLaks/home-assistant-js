import { css, html, LitElement } from "lit";
import { state } from "lit/decorators.js";

export class ScrollContainer extends LitElement {
  @state() private showTopShadow = false;
  @state() private showBottomShadow = false;

  static override styles = css`
    :host {
      container-type: scroll;
      overflow-y: auto;
      scrollbar-width: thin;
      --parent-background: var(
        --ha-dialog-surface-background,
        var(--mdc-theme-surface, #fff)
      );
    }

    .shadow {
      position: fixed;
      left: 0;
      right: 0;
      height: 32px;
      pointer-events: none;
      z-index: 1;
      transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      width: 100%;
    }

    .shadow[hide] {
      opacity: 0;
    }

    .shadow.top {
      top: 0;
      background: linear-gradient(
        to bottom,
        var(--parent-background),
        transparent
      );
    }

    .shadow.bottom {
      bottom: 0;
      background: linear-gradient(
        to top,
        var(--parent-background),
        transparent
      );
    }
  `;
  protected override render() {
    return html`
      <div class="shadow top" ?hide=${!this.showTopShadow}></div>
      <slot></slot>
      <div class="shadow bottom" ?hide=${!this.showBottomShadow}></div>
    `;
  }

  protected override firstUpdated() {
    this.updateShadows();

    // Check shadows when content resizes
    new ResizeObserver(() => this.updateShadows()).observe(this);
    this.addEventListener("scroll", this.onScroll);

    // Check shadows when slot content changes
    this.shadowRoot
      ?.querySelector("slot")
      ?.addEventListener("slotchange", () => {
        // Wait for layout to update
        setTimeout(() => this.updateShadows(), 0);
      });
  }

  private onScroll() {
    this.updateShadows();
  }

  private updateShadows() {
    const { scrollTop, scrollHeight, clientHeight } = this;
    const scrollBottom = Math.ceil(scrollTop + clientHeight);

    this.showTopShadow = scrollTop > 0;
    this.showBottomShadow = scrollHeight - scrollBottom > 2;
  }
}

customElements.define("scroll-container", ScrollContainer);
