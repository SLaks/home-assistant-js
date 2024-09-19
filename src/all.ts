import "./supper/supper-ui";
import "./popup-cards/runner";
import { render } from "lit";
import { html } from "lit/static-html.js";

if (import.meta.env.DEV) {
  render(
    html`<div
      style="
        position: fixed;
        z-index: 999999;
        right: 0;
        top: 0;
        color: red;
        font-size: 24px;
        text-shadow: 2px 2px 2px rgb(255 255 255 / 30%);
        pointer-events: none;
        font-weight: bold;"
    >
      SLaks UI: Local Dev!
    </div>`,
    document.body,
  );
}
