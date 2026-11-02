// Filtering and sorting spec items in the page: text search, facets with checkboxes (none
// checked means everything; values of one facet are alternatives, facets narrow each other),
// and sortable columns. Kept in the address so that a view can be bookmarked.

import { STATUSES, statusLabel } from './fields';
import type { SpecItem } from './types';
import { SPEC_TYPES } from './types';

export interface Facet {
  id: string;
  label: string;
  /** The value of this facet for an item. */
  value: (item: SpecItem) => string;
  /** Values always listed, in this order; others follow as they occur. */
  known: string[];
  /** How a value reads in the panel. */
  show?: (value: string) => string;
}

export const FACETS: Facet[] = [
  { id: 'type', label: 'Type', value: (i) => i.type, known: SPEC_TYPES },
  { id: 'status', label: 'Status', value: (i) => i.status, known: [], show: statusLabel },
  {
    id: 'pending',
    label: 'Change log',
    value: (i) => (i.pendingChange ? 'pending' : 'handled'),
    known: ['pending', 'handled'],
    show: (v) => (v === 'pending' ? 'Pending change' : 'Nothing pending'),
  },
  {
    id: 'links',
    label: 'Links',
    value: (i) => (i.links === 0 ? 'none' : i.staleLinks > 0 ? 'stale' : 'current'),
    known: ['stale', 'current', 'none'],
    show: (v) => ({ stale: 'Some stale', current: 'All current', none: 'No links' })[v] ?? v,
  },
  {
    id: 'source',
    label: 'Source',
    value: (i) => (i.source ? 'document' : 'graph'),
    known: ['document', 'graph'],
    show: (v) => (v === 'document' ? 'From a document' : 'Graph only'),
  },
];

/** Checked values per facet; a facet that is absent or empty filters nothing. */
export type Selection = Record<string, string[]>;

export function matchesText(item: SpecItem, text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  return `${item.key ?? ''} ${item.title} ${item.text}`.toLowerCase().includes(t);
}

function passes(item: SpecItem, selection: Selection, except?: string): boolean {
  return FACETS.every((f) => {
    if (f.id === except) return true;
    const checked = selection[f.id];
    return !checked || checked.length === 0 || checked.includes(f.value(item));
  });
}

export function applyFilters(items: SpecItem[], text: string, selection: Selection): SpecItem[] {
  return items.filter((i) => matchesText(i, text) && passes(i, selection));
}

/** Each facet's values with how many items each would show, given the other facets. */
export function facetCounts(items: SpecItem[], text: string, selection: Selection): Record<string, { value: string; count: number }[]> {
  const out: Record<string, { value: string; count: number }[]> = {};
  const searched = items.filter((i) => matchesText(i, text));
  for (const f of FACETS) {
    const counts = new Map<string, number>();
    for (const v of f.known) counts.set(v, 0);
    for (const i of searched) {
      if (!passes(i, selection, f.id)) continue;
      const v = f.value(i);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    for (const v of selection[f.id] ?? []) if (!counts.has(v)) counts.set(v, 0);
    let values = [...counts.entries()].map(([value, count]) => ({ value, count }));
    if (f.id === 'status') {
      const rank = (s: string) => {
        const i = STATUSES.indexOf(s);
        return i < 0 ? STATUSES.length : i;
      };
      values = values.sort((a, b) => rank(a.value) - rank(b.value) || a.value.localeCompare(b.value));
    }
    out[f.id] = values;
  }
  return out;
}

export type SortKey = 'key' | 'type' | 'status' | 'title' | 'links';
export type SortDir = 'asc' | 'desc';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compare(a: SpecItem, b: SpecItem, key: SortKey): number {
  switch (key) {
    case 'key':
      // Items without a key go last; FR-2 comes before FR-10.
      if (!a.key || !b.key) return Number(!a.key) - Number(!b.key);
      return collator.compare(a.key, b.key);
    case 'type':
      return SPEC_TYPES.indexOf(a.type) - SPEC_TYPES.indexOf(b.type);
    case 'status': {
      const rank = (s: string) => (STATUSES.includes(s) ? STATUSES.indexOf(s) : STATUSES.length);
      return rank(a.status) - rank(b.status) || collator.compare(a.status, b.status);
    }
    case 'title':
      return collator.compare(a.title, b.title);
    case 'links':
      return a.staleLinks - b.staleLinks || a.links - b.links;
  }
}

/** Sorted by `key`, then by key and ID so that the order is stable. */
export function sortItems(items: SpecItem[], key: SortKey, dir: SortDir): SpecItem[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort(
    (a, b) => sign * compare(a, b, key) || compare(a, b, 'key') || a.id.localeCompare(b.id),
  );
}

/** The view in the address: `?q=…&type=A,B&status=…&sort=key&dir=asc`. */
export function readView(params: URLSearchParams): { text: string; selection: Selection; sort: SortKey; dir: SortDir } {
  const selection: Selection = {};
  for (const f of FACETS) {
    const v = params.get(f.id);
    if (v) selection[f.id] = v.split(',').filter(Boolean);
  }
  const sort = params.get('sort') as SortKey | null;
  const valid: SortKey[] = ['key', 'type', 'status', 'title', 'links'];
  return {
    text: params.get('q') ?? '',
    selection,
    sort: sort && valid.includes(sort) ? sort : 'key',
    dir: params.get('dir') === 'desc' ? 'desc' : 'asc',
  };
}

export function writeView(
  params: URLSearchParams,
  view: { text: string; selection: Selection; sort: SortKey; dir: SortDir },
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const f of FACETS) {
    const v = view.selection[f.id] ?? [];
    if (v.length) next.set(f.id, v.join(','));
    else next.delete(f.id);
  }
  if (view.text) next.set('q', view.text);
  else next.delete('q');
  if (view.sort !== 'key') next.set('sort', view.sort);
  else next.delete('sort');
  if (view.dir !== 'asc') next.set('dir', view.dir);
  else next.delete('dir');
  return next;
}
