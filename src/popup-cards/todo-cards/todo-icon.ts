import { css, html, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { TodoItem } from "../../todos/ha-api";
import { TodoDetails } from "./due-times";
import "../base/emoji-icon";
import { bindEntity, SimpleEntityBasedElement } from "../../base-elements";

const defaultEmoji = "☑️";

function toFileName(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/\P{Letter}+/gu, "-")
    .replace(/^-|-$/, "");
}

class PopupTodoIcon extends SimpleEntityBasedElement {
  @property({ attribute: false }) item?: TodoItem;
  @state() private details: TodoDetails = {};
  @state() private imageUrl?: string;

  @bindEntity({ entityId: "sensor.todo_images", attributeName: "file_list" })
  @state()
  imageFiles: string[] = [];

  static styles = css`
    :host {
      display: flex;
    }

    img {
      display: flex;
      place-content: center;
      width: 80%;
    }
  `;

  override willUpdate(changedProps: PropertyValues<this>): void {
    super.willUpdate(changedProps);
    this.imageUrl = this.imageFiles.find((file) =>
      file.includes(`/${toFileName(this.item?.summary ?? "")}.`),
    );
    this.classList.toggle("HasImage", !!this.imageUrl);
    if (changedProps.has("item")) {
      try {
        this.details = JSON.parse(this.item?.description ?? "{}") ?? {};
      } catch {
        this.details = {};
      }
    }
  }
  protected override render(): unknown {
    if (this.imageUrl) {
      return html`<img
        src=${this.imageUrl.replace("/config/www", "/local")}
      />`;
    }
    return html`<popup-emoji-icon
      emoji=${this.details.emoji ?? defaultEmoji}
    ></popup-emoji-icon>`;
  }
}
customElements.define("popup-todo-icon", PopupTodoIcon);
