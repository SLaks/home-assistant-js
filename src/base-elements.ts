import { HomeAssistant } from "custom-card-helpers/dist/types";
import { LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators/property.js";

export function bindEntity<
  T extends SimpleEntityBasedElement,
  TProperty extends keyof T,
>(opts: Omit<EntityBinding<T, TProperty>, "propertyName">) {
  return function (target: T, propertyName: TProperty) {
    if (!!opts.entityId === !!opts.entityIdProperty)
      throw new Error(
        `${String(
          propertyName,
        )}: Exactly one of entityId or entityIdProperty must be specified`,
      );
    (target.entityBindings ??= []).push({
      ...opts,
      propertyName,
    });
    if (opts.entityIdProperty)
      (target.entityIdProperties ??= []).push(opts.entityIdProperty);
  };
}

interface EntityBinding<
  T extends SimpleEntityBasedElement,
  TProperty extends keyof T,
> {
  /** The property on the element to set */
  propertyName: keyof T;
  /** An @state() on the element that specifies the entity ID to consume.  Specify this xor `entityId`. */
  entityIdProperty?: string & keyof T;
  /** The fixed entity ID to consume.  Specify this xor `entityIdProperty`. */
  entityId?: string;
  /** The attribute on the entity to consume.  Omit to consume its state. */
  attributeName?: string;
  converter?: (value: string) => T[TProperty];
}

export class SimpleEntityBasedElement extends LitElement {
  entityBindings?: EntityBinding<this, keyof this>[];
  entityIdProperties?: Array<string & keyof this>;

  @property({ attribute: false }) hass?: HomeAssistant;

  private propertyEntityId(p: EntityBinding<this, keyof this>): string {
    if (p.entityId) return p.entityId;
    if (p.entityIdProperty) return this[p.entityIdProperty] as string;
    throw new Error("Invalid entity binding");
  }

  shouldUpdate(changedProps: PropertyValues<this>) {
    const oldHass = changedProps.get("hass");
    if (!oldHass || changedProps.size > 1) return true;
    return (
      this.entityBindings?.some(
        (p) =>
          oldHass.states[this.propertyEntityId(p)] !==
          this.hass?.states[this.propertyEntityId(p)],
      ) ?? false
    );
  }

  willUpdate(changedProps: PropertyValues<this>) {
    if (!this.hass || !this.entityBindings)
      return super.willUpdate(changedProps);
    // If neither hass nor any entity ID property changed, we don't need to do anything here.
    if (
      !changedProps.has("hass") &&
      !this.entityIdProperties?.some((p) =>
        changedProps.has(p as keyof SimpleEntityBasedElement),
      )
    )
      return super.willUpdate(changedProps);
    for (const info of this.entityBindings) {
      const entityId = this.propertyEntityId(info);
      const state = this.hass.states[entityId];

      // Ignore unchanged states so that the converter doesn't produce a false positive change
      // (eg, if it returns a new object every call).
      if (
        info.entityIdProperty &&
        !changedProps.has(
          info.entityIdProperty as keyof SimpleEntityBasedElement,
        ) &&
        changedProps.get("hass")?.states[entityId] === state
      )
        continue;
      const value = info.attributeName
        ? state.attributes[info.attributeName]
        : state.state;
      this[info.propertyName] = info.converter ? info.converter(value) : value;
    }
    return super.willUpdate(changedProps);
  }
}
