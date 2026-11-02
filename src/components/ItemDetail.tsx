// One spec item (FR-291): every field, its links with their statuses and latest evidence,
// annotations, where it came from, and its pending change. A link opens what it points to
// in a drawer (FR-292).

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { call } from '../api';
import { FIELDS, fieldText, label, valueLabel } from '../fields';
import type { LinkView, ShowView, SpecItem } from '../types';
import { LinkDrawer } from './LinkDrawer';
import { StatusBadge } from '../pages/SpecPage';
import { SPEC_TYPE_GUIDE } from '../specTypes';
import { Alert, Badge, Button, Loader, MarkdownText, SectionLabel } from '../ui';

const SKIP = new Set(['source', 'alsoDefinedIn', 'key', 'specStatus', 'origin']);

const LINK_COLORS: Record<string, string> = {
  verified: 'green',
  asserted: 'blue',
  confirmed: 'teal',
  stale: 'orange',
  orphaned: 'red',
  failing: 'red',
};

export function ItemDetail({
  itemRef,
  listItem,
  onEdit,
  onRetire,
}: {
  itemRef: string;
  listItem?: SpecItem;
  onEdit: (item: SpecItem) => void;
  onRetire: (item: SpecItem) => void;
}) {
  const item = useQuery({
    queryKey: ['item', itemRef, 'spec'],
    queryFn: () => call<SpecItem>('spec_show', { ref: itemRef }),
  });
  const show = useQuery({
    queryKey: ['item', itemRef, 'show'],
    queryFn: () => call<ShowView>('show', { ref: itemRef }),
  });
  const [openLink, setOpenLink] = useState<LinkView | null>(null);
  const view = item.data ?? listItem;
  if (item.isLoading && !view) return <Loader />;
  if (item.error && !view) return <p className="rn-error-text">{(item.error as Error).message}</p>;
  if (!view) return null;

  const fields = FIELDS[view.type] ?? [];
  const named = new Set(fields.map((f) => f.name));
  const others = Object.entries(view.props).filter(([k, v]) => !named.has(k) && !SKIP.has(k) && v !== null && v !== '');
  const links = show.data?.links ?? [];
  const notes = show.data?.annotations ?? [];
  const pending = view.pendingChange;

  return (
    <div className="rn-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="rn-mono m-0 text-lg font-semibold">{view.key ?? view.id}</h3>
            <Badge variant="outline">{view.type}</Badge>
            <StatusBadge status={view.status} />
          </div>
          <div className="mt-1 font-medium">{view.title}</div>
          {SPEC_TYPE_GUIDE[view.type] && <div className="rn-muted mt-1">{SPEC_TYPE_GUIDE[view.type].captures}</div>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="xs" variant="light" icon="edit" onClick={() => onEdit(view)}>
            Edit
          </Button>
          <Button size="xs" variant="light" color="red" icon="archive" onClick={() => onRetire(view)} disabled={view.status === 'retired'}>
            Retire
          </Button>
        </div>
      </div>

      {pending && (
        <Alert color="yellow" icon="warning" title={`Pending change #${pending.seq}`} className="mt-3">
          {pending.kind}
          {pending.fields.length > 0 && `: ${pending.fields.join(', ')}`} ({pending.origin}). Your agent has not handled
          it yet.
        </Alert>
      )}
      {view.source && (
        <Alert color="blue" icon="description" className="mt-3">
          From <span className="rn-mono">{`${view.source.path ?? '?'}:${view.source.line ?? '?'}`}</span>. Edits here mark
          the document for your agent to bring back in step.
        </Alert>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {fields.map((f) => {
          const value = fieldText(view.props[f.name]);
          return (
            <div key={f.name}>
              <div className="rn-field-label">{label(f.name)}</div>
              {f.long ? (
                value ? <MarkdownText>{value}</MarkdownText> : <div className="rn-muted">—</div>
              ) : (
                <div>{valueLabel(view.type, f.name, value) || '—'}</div>
              )}
            </div>
          );
        })}
      </div>

      {others.length > 0 && (
        <>
          <SectionLabel>Other properties</SectionLabel>
          <table className="rn-table rn-table-compact">
            <tbody>
              {others.map(([k, v]) => (
                <tr key={k}>
                  <td className="rn-muted" style={{ width: 160 }}>
                    {k}
                  </td>
                  <td>{fieldText(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <SectionLabel>{`Links (${links.length})`}</SectionLabel>
      {show.isLoading ? (
        <Loader />
      ) : links.length === 0 ? (
        <div className="rn-muted">No links yet. Your agent links code and tests to this item as it implements it.</div>
      ) : (
        <table className="rn-table rn-table-compact">
          <thead>
            <tr>
              <th>Relation</th>
              <th>To</th>
              <th>Status</th>
              <th>Latest test</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l, i) => (
              <tr key={i}>
                <td>{l.relation}</td>
                <td className="rn-mono">
                  {l.other?.id ? (
                    <button type="button" className="rn-link rn-mono" onClick={() => setOpenLink(l)}>
                      {l.other.label ?? l.other.id}
                    </button>
                  ) : (
                    (l.other?.label ?? '?')
                  )}
                </td>
                <td>
                  <Badge color={LINK_COLORS[l.status]}>{l.status}</Badge>
                </td>
                <td>{l.latestEvidence ? `${l.latestEvidence.result ?? '?'} at ${l.latestEvidence.timestamp ?? '?'}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {notes.length > 0 && (
        <>
          <SectionLabel>{`Annotations (${notes.length})`}</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {notes.map((a, i) => (
              <div key={i}>
                <Badge size="xs" variant="outline" style={{ marginRight: 6 }}>
                  {a.kind ?? 'note'}
                </Badge>
                {a.text} <span className="rn-muted text-xs">({a.author})</span>
              </div>
            ))}
          </div>
        </>
      )}
      {openLink && <LinkDrawer link={openLink} onClose={() => setOpenLink(null)} />}
    </div>
  );
}
