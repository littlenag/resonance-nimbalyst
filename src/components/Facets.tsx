// Facets in the style of log explorers: a column of checkboxes per facet, with counts. None
// checked shows everything; "only" checks just that value.

import { useState } from 'react';
import { FACETS, type Selection } from '../specFilter';
import { Checkbox, Icon } from '../ui';

export function Facets({
  counts,
  selection,
  onChange,
}: {
  counts: Record<string, { value: string; count: number }[]>;
  selection: Selection;
  onChange: (next: Selection) => void;
}) {
  const any = Object.values(selection).some((v) => v.length > 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-5 items-center justify-between">
        <span className="rn-field-label">Filters</span>
        {any && (
          <button type="button" className="rn-link text-xs" onClick={() => onChange({})}>
            Clear all
          </button>
        )}
      </div>
      {FACETS.map((f) => (
        <FacetGroup
          key={f.id}
          label={f.label}
          values={counts[f.id] ?? []}
          checked={selection[f.id] ?? []}
          show={f.show}
          onChange={(v) => onChange({ ...selection, [f.id]: v })}
        />
      ))}
    </div>
  );
}

function FacetGroup({
  label,
  values,
  checked,
  show,
  onChange,
}: {
  label: string;
  values: { value: string; count: number }[];
  checked: string[];
  show?: (v: string) => string;
  onChange: (checked: string[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div role="group" aria-label={label}>
      <div className="flex items-center justify-between gap-1">
        <button type="button" className="rn-sort-header" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Icon name={open ? 'expand_more' : 'chevron_right'} size={16} />
          {label}
        </button>
        {checked.length > 0 && (
          <button type="button" className="rn-link text-xs" onClick={() => onChange([])}>
            clear
          </button>
        )}
      </div>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1 pl-[18px]">
          {values.map(({ value, count }) => {
            const isChecked = checked.includes(value);
            return (
              <div
                key={value}
                className="flex items-center justify-between gap-1"
                onMouseEnter={() => setHover(value)}
                onMouseLeave={() => setHover((h) => (h === value ? null : h))}
              >
                <Checkbox
                  checked={isChecked}
                  onChange={(c) => onChange(c ? [...checked, value] : checked.filter((v) => v !== value))}
                  label={show ? show(value) : value}
                  dim={count === 0 && !isChecked}
                />
                {/* Fixed box so swapping the count for "only" on hover never resizes the row. */}
                <span className="flex h-[18px] min-w-[32px] shrink-0 items-center justify-end text-xs">
                  {hover === value && !(checked.length === 1 && isChecked) ? (
                    <button type="button" className="rn-link text-xs" onClick={() => onChange([value])} aria-label={`only ${value}`}>
                      only
                    </button>
                  ) : (
                    <span className="rn-muted">{count}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
