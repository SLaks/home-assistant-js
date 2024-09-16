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
    // If hass didn't change, we don't need to do anything here.
    if (!this.hass || !this.entityBindings || !changedProps.has("hass"))
      return super.willUpdate(changedProps);
    for (const info of this.entityBindings) {
      if (!info.entityId) continue;

      const state = this.hass.states[info.entityId];

      // Ignore unchanged states so that the converter doesn't produce a false positive change
      // (eg, if it returns a new object every call).
      if (changedProps.get("hass")?.states[info.entityId] === state) continue;
      const value = info.attributeName
        ? state.attributes[info.attributeName]
        : state.state;
      this[info.propertyName] = info.converter ? info.converter(value) : value;
    }
    return super.willUpdate(changedProps);
  }
}
