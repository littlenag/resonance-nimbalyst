// The change log (FR-285, FR-291): people's changes to spec items that the agent has not
// handled yet. Clearing removes entries from the log only, as for agents (FR-276).

import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { call } from '../api';
import { fieldText } from '../fields';
import { useHotkeys } from '../hotkeys';
import { Link } from '../nav';
import { notify } from '../notify';
import type { ChangeEntry } from '../types';
import { Badge, Button, Loader, cx, useConfirm } from '../ui';

const KIND_COLORS: Record<string, string> = {
  created: 'green',
  added: 'green',
  edited: 'blue',
  retired: 'red',
  restored: 'teal',
  superseded: 'violet',
  status: 'grape',
};

export function ChangeLogPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const log = useQuery({ queryKey: ['changes'], queryFn: () => call<ChangeEntry[]>('changes', {}) });
  const entries = log.data ?? [];
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const selected = entries[Math.min(cursor, entries.length - 1)];

  const clear = async (seqs: number[]) => {
    try {
      await call('changes_done', { seqs, note: 'cleared in the Nimbalyst panel' });
      const n = seqs.length;
      notify.info(`Cleared ${n} entr${n === 1 ? 'y' : 'ies'} from the change log; your agent will not see ${n === 1 ? 'it' : 'them'}.`);
      await queryClient.invalidateQueries();
    } catch (e) {
      notify.error('Not cleared', (e as Error).message);
    }
  };

  const clearAll = async () => {
    if (entries.length === 0) return;
    const ok = await confirm({
      title: `Clear all ${entries.length} entries?`,
      body: (
        <>
          Your agent will not see these changes. Clear them when you judge that nothing more is needed; the changes
          themselves stay in the graph and its history.
        </>
      ),
      confirmLabel: 'Clear all',
      danger: true,
    });
    if (ok) await clear(entries.map((e) => e.seq));
  };

  useHotkeys([
    ['j', () => setCursor((c) => Math.min(entries.length - 1, c + 1))],
    ['ArrowDown', () => setCursor((c) => Math.min(entries.length - 1, c + 1))],
    ['k', () => setCursor((c) => Math.max(0, c - 1))],
    ['ArrowUp', () => setCursor((c) => Math.max(0, c - 1))],
    ['Enter', () => selected && setOpen((o) => (o === selected.seq ? null : selected.seq))],
    ['d', () => selected && void clear([selected.seq])],
    ['shift+D', () => void clearAll()],
  ]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="m-0 text-base font-semibold">Change log</h3>
          <div className="rn-muted">People's changes to spec items, and spec changes from git, that your agent has not handled yet.</div>
        </div>
        <Button color="red" variant="light" icon="delete" onClick={() => void clearAll()} disabled={entries.length === 0}>
          Clear all
        </Button>
      </div>
      {log.isLoading && <Loader />}
      {log.error && <p className="rn-error-text">{(log.error as Error).message}</p>}
      {!log.isLoading && entries.length === 0 && (
        <div className="rn-card rn-muted">The change log is empty: your agent has handled everything.</div>
      )}
      {entries.length > 0 && (
        <table className="rn-table rn-table-hover">
          <thead>
            <tr>
              <th>#</th>
              <th>When</th>
              <th>Item</th>
              <th>Change</th>
              <th>Summary</th>
              <th>Who</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <EntryRows
                key={e.seq}
                entry={e}
                selected={i === cursor}
                open={open === e.seq}
                onToggle={() => {
                  setCursor(i);
                  setOpen((o) => (o === e.seq ? null : e.seq));
                }}
                onClear={() => void clear([e.seq])}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EntryRows({
  entry,
  selected,
  open,
  onToggle,
  onClear,
}: {
  entry: ChangeEntry;
  selected: boolean;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
}) {
  const ref = entry.item.key ?? entry.item.id;
  return (
    <Fragment>
      <tr className={cx('rn-row-clickable', selected && 'rn-row-selected')} onClick={onToggle}>
        <td className="rn-mono">{entry.seq}</td>
        <td className="whitespace-nowrap">{new Date(entry.at).toLocaleString()}</td>
        <td>
          <Link to={`/spec/${encodeURIComponent(ref)}`} onClick={(e) => e.stopPropagation()} className="rn-mono">
            {entry.item.key ?? entry.item.id}
          </Link>{' '}
          <span className="rn-muted text-xs">{entry.item.title}</span>
        </td>
        <td>
          <Badge color={KIND_COLORS[entry.kind]}>{entry.kind}</Badge>
          {entry.fields.length > 0 && <span className="rn-muted ml-1 text-xs">{entry.fields.join(', ')}</span>}
        </td>
        <td>{entry.summary}</td>
        <td>
          <div className="text-xs">{entry.actor}</div>
          <Badge size="xs" variant="outline">
            {entry.origin}
          </Badge>
        </td>
        <td>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            Clear
          </Button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7}>
            <EntryDiff seq={entry.seq} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function EntryDiff({ seq }: { seq: number }) {
  const full = useQuery({ queryKey: ['changes', 'show', seq], queryFn: () => call<ChangeEntry>('changes_show', { seq }) });
  if (full.isLoading) return <Loader />;
  if (full.error) return <p className="rn-error-text">{(full.error as Error).message}</p>;
  const before = full.data?.before ?? {};
  const after = full.data?.after ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (k) => fieldText(before[k]) !== fieldText(after[k]),
  );
  if (keys.length === 0) return <div className="rn-muted">No field differences recorded.</div>;
  return (
    <table className="rn-table rn-table-bordered rn-table-compact text-xs">
      <thead>
        <tr>
          <th>Field</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k}>
            <td className="rn-mono">{k}</td>
            <td className="whitespace-pre-wrap">{fieldText(before[k]) || '—'}</td>
            <td className="whitespace-pre-wrap">{fieldText(after[k]) || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
