import { css, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";

class EmojiIcon extends LitElement {
  @property() emoji?: string;

  @state() private emojiCount = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.emoji) this.emojiCount = getGraphemeCount(this.emoji);
  }
  protected override willUpdate(changedProps: PropertyValues<this>): void {
    if (!this.emoji) return;

    if (changedProps.has("emoji") || !this.emojiCount) {
      this.emojiCount = getGraphemeCount(this.emoji);
    }
  }

  static styles = css`
    :host {
      display: flex;
      place-content: center;
    }
    svg {
      width: 80%;
    }
    text {
      text-align: center;
    }
  `;

  protected override render(): unknown {
    if (!this.emoji) return null;

    const width = this.emojiCount * 24;
    return html`
      <svg viewBox="0 0 ${width} 18">
        <text x=${width / 2} y="15" text-anchor="middle">${this.emoji}</text>
      </svg>
    `;
  }
}
customElements.define("popup-emoji-icon", EmojiIcon);

function getGraphemeCount(str: string) {
  const segmenter = new Intl.Segmenter("en-US", { granularity: "grapheme" });
  // The Segments object iterator that is used here iterates over characters in grapheme clusters,
  // which may consist of multiple Unicode characters
  return [...segmenter.segment(str)].length;
}
