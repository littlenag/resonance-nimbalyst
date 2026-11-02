// The spec page's explanation of the four spec types. Open by default, and the person's
// last choice is kept in the extension's storage.

import { useState } from 'react';
import { SPEC_TYPE_GUIDE } from '../specTypes';
import { SPEC_TYPES, type SpecType } from '../types';
import { Icon } from '../ui';
import { getStorage } from '../settings';

const STORAGE_KEY = 'specTypesGuide';

export function SpecTypesGuide() {
  const [open, setOpen] = useState(() => getStorage()?.get<string>(STORAGE_KEY) !== 'closed');
  const toggle = () => {
    const next = !open;
    setOpen(next);
    void getStorage()?.set(STORAGE_KEY, next ? 'open' : 'closed');
  };

  return (
    <section
      className="rn-card"
      aria-label="Spec types"
      // On a short panel the four cards are taller than the page. Cap the guide and
      // scroll it, so the item list underneath keeps the rest of the height.
      style={{ flex: '0 1 auto', minHeight: 0, maxHeight: '50%', overflow: 'auto', padding: 10 }}
    >
      <button type="button" className="rn-sort-header" onClick={toggle} aria-expanded={open}>
        <Icon name={open ? 'expand_more' : 'chevron_right'} size={16} />
        What these types capture
      </button>
      {open && (
        <>
          <p className="mb-0 mt-2">
            Requirements, decisions, designs and constraints are the spec. Each one records a different kind of
            statement and keeps a permanent key. Retiring one keeps the item and its links. A newer item of the same
            kind can supersede an older one, and links to the older one become stale so they can be checked against
            the new one.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {SPEC_TYPES.map((type) => (
              <TypeCard key={type} type={type} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function TypeCard({ type }: { type: SpecType }) {
  const doc = SPEC_TYPE_GUIDE[type];
  return (
    <div className="flex flex-col gap-0.5">
      <div className="font-semibold">{type}</div>
      <div>{doc.captures}</div>
      <div className="rn-muted text-xs">Keys: {doc.keys}</div>
      <div className="rn-muted text-xs">Fields: {doc.fields}</div>
      <div className="rn-muted text-xs">{doc.graph}</div>
    </div>
  );
}
