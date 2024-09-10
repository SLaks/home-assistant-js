import { HomeAssistant } from "custom-card-helpers/dist/types";
import { LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators/property.js";

export function bindEntity<
  T extends SimpleEntityBasedElement,
  TProperty extends keyof T,
>(opts: Omit<EntityBinding<T, TProperty>, "propertyName">) {
  return function (target: T, propertyName: TProperty) {
    (target.entityBindings ??= []).push({
      ...opts,
      propertyName,
    });
  };
}

interface EntityBinding<
  T extends SimpleEntityBasedElement,
  TProperty extends keyof T,
> {
  propertyName: keyof T;
  entityId: string;
  attributeName?: string;
  converter?: (value: string) => T[TProperty];
}

export class SimpleEntityBasedElement extends LitElement {
  entityBindings?: EntityBinding<this, keyof this>[];

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
      const value = info.attributeName
        ? state.attributes[info.attributeName]
        : state.state;
      this[info.propertyName] = info.converter ? info.converter(value) : value;
    }
    return super.willUpdate(changedProps);
  }
}
