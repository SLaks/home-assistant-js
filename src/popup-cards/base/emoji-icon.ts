import { css, html, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";

class EmojiIcon extends LitElement {
  @property() emoji?: string;

  @state() private emojiSize = 0;

  protected override willUpdate(changedProps: PropertyValues<this>): void {
    if (changedProps.has("emoji") && this.emoji) {
      this.emojiSize = getGraphemeCount(this.emoji);
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
  `;

  protected override render(): unknown {
    if (!this.emoji) return null;

    return html`
      <svg slot="icon" viewBox="0 0 ${this.emojiSize * 24} 18">
        <text x="0" y="15">${this.emoji}</text>
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
