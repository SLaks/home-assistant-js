import { HomeAssistant } from "custom-card-helpers/dist/types";
import { LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators/property.js";

export function bindEntity({
  entityId,
  attributeName,
}: {
  entityId: string;
  attributeName?: string;
}) {
  return function <T extends SimpleEntityBasedElement>(
    target: T,
    propertyName: keyof T,
  ) {
    (target.entityBindings ??= []).push({
      propertyName,
      entityId,
      attributeName,
    });
  };
}

interface EntityBinding<T extends SimpleEntityBasedElement> {
  propertyName: keyof T;
  entityId: string;
  attributeName?: string;
}

export class SimpleEntityBasedElement extends LitElement {
  entityBindings?: EntityBinding<this>[];

  @property({ attribute: false }) hass?: HomeAssistant;

  shouldUpdate(changedProps: PropertyValues<this>) {
    const oldHass = changedProps.get("hass");
    if (!oldHass || changedProps.size > 1) return true;
    return (
      this.entityBindings?.some(
        (p) => oldHass.states[p.entityId] !== this.hass?.states[p.entityId],
      ) ?? false
    );
  }

  willUpdate(changedProps: PropertyValues<this>) {
    if (!this.hass || !this.entityBindings)
      return super.willUpdate(changedProps);
    for (const info of this.entityBindings) {
      if (!info.entityId) continue;
      const state = this.hass.states[info.entityId];
      this[info.propertyName] = info.attributeName
        ? state.attributes[info.attributeName]
        : state.state;
    }
    return super.willUpdate(changedProps);
  }
}
