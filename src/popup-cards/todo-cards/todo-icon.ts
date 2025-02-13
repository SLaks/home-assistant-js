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
  @bindEntity({ entityId: "sensor.todo_images", attributeName: "bytes" })
  @state()
  imageFileVersion = "";

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: 100%;
      grid-template-rows: 100%;
      width: 100%;
    }

    img {
      grid-area: 1 / 1;
      place-self: stretch;
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
      grid-area: 1 / 1;
      color: white;
      text-align: center;
      background-color: rgba(0, 0, 0, 0.7);
      padding: 4px;
      place-self: flex-end stretch;
    }
  `;

  override willUpdate(changedProps: PropertyValues<this>): void {
    super.willUpdate(changedProps);
    this.imageUrl = this.imageFiles.find((file) =>
      file.includes(`/${toFileName(this.item?.summary ?? "")}.`),
    );

    // Add a cachebuster that changes if any image is updated.
    // It also changes when new images are generated, but that
    // is not the end of the world.
    if (this.imageUrl) {
      this.imageUrl += `?size-version=${encodeURIComponent(
        this.imageFileVersion,
      )}`;
    }
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
