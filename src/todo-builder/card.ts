import "../popup-cards/todo-cards/target-days";
import "../todos/subscriber";
import { state } from "lit/decorators.js";
import { SimpleEntityBasedElement } from "../base-elements";
import { html } from "lit";
import { TodoItem } from "../todos/ha-api";
import { ifDefined } from "lit/directives/if-defined.js";
import {
  DateOption,
  TodoTargetDetails,
} from "../popup-cards/todo-cards/target-days";

class TodoBuilderCardElement extends SimpleEntityBasedElement {
  @state()
  targetListId?: string;
  @state()
  longTermListId?: string;
  @state()
  templateListId?: string;

  @state()
  targetList?: TodoItem[];
  @state()
  templateList?: TodoItem[];
  @state()
  longTermList?: TodoItem[];
  @state()
  targetDays?: DateOption[];

  static getStubConfig(): CardConfig {
    return {
      target_list: "sensor.my_tasks",
      long_term_list: "sensor.long_term_tasks",
      template_list: "sensor.common_tasks",
    };
  }

  setConfig(config: CardConfig) {
    this.targetListId = config.target_list;
    this.longTermListId = config.long_term_list;
    this.templateListId = config.template_list;
  }

  override render() {
    if (!this.hass) return html`Loading...`;

    return html`
      <todo-target-days
        .hass=${this.hass}
        @target-days-updated=${(e: CustomEvent<TodoTargetDetails>) =>
          (this.targetDays = e.detail.fullWeek)}
      ></todo-target-days>
      <todo-items-subscriber
        .hass=${this.hass}
        entity-id=${ifDefined(this.targetListId)}
        @items-updated=${(e: CustomEvent<TodoItem[]>) =>
          (this.targetList = e.detail)}
      ></todo-items-subscriber>
      <todo-items-subscriber
        .hass=${this.hass}
        entity-id=${ifDefined(this.longTermListId)}
        @items-updated=${(e: CustomEvent<TodoItem[]>) =>
          (this.longTermList = e.detail)}
      ></todo-items-subscriber>
      <todo-items-subscriber
        .hass=${this.hass}
        entity-id=${ifDefined(this.templateListId)}
        @items-updated=${(e: CustomEvent<TodoItem[]>) =>
          (this.templateList = e.detail)}
      ></todo-items-subscriber>
    `;
  }
}

interface CardConfig {
  target_list: string;
  long_term_list: string;
  template_list: string;
}
window.customCards ??= [];
window.customCards.push({
  type: "todo-builder-card",
  name: "Todo Builder",
  description: "Adds items from templates or long-term tasks to a todo list.",
});
customElements.define("todo-builder-card", TodoBuilderCardElement);
