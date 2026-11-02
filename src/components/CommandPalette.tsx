// Search spec items and actions (⌘K / ctrl+K), as the web UI's Spotlight.

import { useMemo, useState } from 'react';
import { Icon, Modal, cx } from '../ui';

export interface PaletteAction {
  id: string;
  label: string;
  description?: string;
  group: string;
  icon?: string;
  keywords?: string[];
  onClick: () => void;
}

const LIMIT = 30;

export function CommandPalette({ actions, onClose }: { actions: PaletteAction[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hits = q
      ? actions.filter((a) => `${a.label} ${a.description ?? ''} ${(a.keywords ?? []).join(' ')}`.toLowerCase().includes(q))
      : actions;
    return hits.slice(0, LIMIT);
  }, [actions, query]);
  const run = (a: PaletteAction | undefined) => {
    if (!a) return;
    onClose();
    a.onClick();
  };
  let lastGroup = '';
  return (
    <Modal title="Search spec items and actions" onClose={onClose} width={620}>
      <div
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(shown.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            run(shown[active]);
          }
        }}
      >
        <div className="rn-input-wrap">
          <Icon name="search" size={16} />
          <input
            className="rn-input"
            placeholder="Search spec items and actions…"
            value={query}
            autoFocus
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setActive(0);
            }}
          />
        </div>
        <div className="mt-2" style={{ maxHeight: '55vh', overflow: 'auto' }}>
          {shown.length === 0 && <p className="rn-muted p-2">Nothing found</p>}
          {shown.map((a, i) => {
            const header = a.group !== lastGroup ? a.group : null;
            lastGroup = a.group;
            return (
              <div key={a.id}>
                {header && <div className="rn-palette-group">{header}</div>}
                <div
                  className={cx('rn-palette-item', i === active && 'rn-active')}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(a)}
                >
                  {a.icon && <Icon name={a.icon} size={18} className="rn-muted" />}
                  <div className="min-w-0">
                    <div className="truncate">{a.label}</div>
                    {a.description && <div className="rn-muted truncate text-xs">{a.description}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
