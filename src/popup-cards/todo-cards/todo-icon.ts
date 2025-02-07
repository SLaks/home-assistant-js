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
      position: relative;
      display: flex;
    }

    img {
      display: flex;
      place-content: center;
      object-fit: cover;
      width: 100%;
      /* 
       * Prevents the image itself from being draggable. 
       * You can still drag from the image, because the
       * click is seen by the parent.  
       * Calling e.preventDefault() breaks SortableJS.
       */
      pointer-events: none;
    }

    .Name {
      color: white;
      text-align: center;
      background-color: rgba(0, 0, 0, 0.7);
      padding: 4px;
      position: absolute;
      inset: auto 0 0;
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
      return html`
        <img src=${this.imageUrl.replace("/config/www", "/local")} />
        <div class="Name">${this.item?.summary}</div>
      `;
    }
    // When there is an emoji, the name is displayed by the caller separately.
    return html`<popup-emoji-icon
      emoji=${this.details.emoji ?? defaultEmoji}
    ></popup-emoji-icon>`;
  }
}
customElements.define("popup-todo-icon", PopupTodoIcon);
