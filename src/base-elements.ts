import { LitElement } from "lit";

export class SimpleEntityBasedElement extends LitElement {
  shouldUpdate(changedProps) {
    const oldHass = changedProps.get("hass");
    if (!oldHass) return true;
    return Object.values(this.constructor.properties).some(
      (p) => p.entity && oldHass.states[p.entity] !== this.hass.states[p.entity]
    );
  }

  update(changedProps) {
    for (const [property, info] of Object.entries(
      this.constructor.properties
    )) {
      if (!info.entity) continue;
      const state = this.hass.states[info.entity];
      this[property] = info.hassAttribute
        ? state.attributes[info.hassAttribute]
        : state.state;
    }
    return super.update(changedProps);
  }
}
