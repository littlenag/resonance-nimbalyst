// Fields per spec item type, and which are long text: the same as the TUI's (MVP-041).

import type { SpecType } from './types';

export interface FieldSpec {
  name: string;
  long: boolean;
}

export const FIELDS: Record<SpecType, FieldSpec[]> = {
  Requirement: [
    { name: 'text', long: true },
    { name: 'kind', long: false },
    { name: 'status', long: false },
  ],
  Decision: [
    { name: 'title', long: false },
    { name: 'decision', long: true },
    { name: 'context', long: true },
    { name: 'consequences', long: true },
    { name: 'status', long: false },
  ],
  Design: [
    { name: 'title', long: false },
    { name: 'text', long: true },
    { name: 'status', long: false },
  ],
  Constraint: [
    { name: 'title', long: false },
    { name: 'text', long: true },
    { name: 'scope', long: false },
    { name: 'status', long: false },
  ],
};

export const STATUSES = ['active', 'draft', 'proposed', 'accepted', 'superseded', 'deprecated', 'retired'];

/** The statuses each type allows: the same as the daemon checks. */
export const STATUSES_BY_TYPE: Record<SpecType, string[]> = {
  Requirement: ['draft', 'active', 'superseded', 'retired'],
  Decision: ['proposed', 'accepted', 'superseded', 'deprecated', 'retired'],
  Design: ['draft', 'active', 'superseded', 'retired'],
  Constraint: ['draft', 'active', 'superseded', 'retired'],
};

/** A status as people read it: `active` is "Active". */
export function statusLabel(status: string): string {
  return label(status);
}

/** A requirement's kinds (§6.2). */
export const KINDS = ['functional', 'non-functional'];

/** The values a field takes, for the fields that pick from a list rather than take text. */
export function choicesOf(type: SpecType, field: string): string[] | null {
  if (field === 'status') return STATUSES_BY_TYPE[type];
  if (field === 'kind' && type === 'Requirement') return KINDS;
  return null;
}

/** A field's value as people read it: picked values start with a capital, `functional` is "Functional". */
export function valueLabel(type: SpecType, field: string, value: string): string {
  return choicesOf(type, field) ? label(value) : value;
}

/** A property as text, the way the TUI's forms show it. */
export function fieldText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

/** The values of `fields` from an item's properties. */
export function valuesOf(type: SpecType, props: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of FIELDS[type]) out[f.name] = fieldText(props[f.name]);
  return out;
}

export function label(field: string): string {
  return field.charAt(0).toUpperCase() + field.slice(1);
}
