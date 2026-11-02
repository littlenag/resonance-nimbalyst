// Spec items (FR-291): facets and a sortable list beside the selected item's detail; add,
// edit and retire. Every item has its own address, /spec/<key>, and the filters and sort are
// in the address's query, as in the web UI.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { call } from '../api';
import { statusLabel } from '../fields';
import { useHotkeys } from '../hotkeys';
import { useLocation, useNavigate, useParams, useSearchParams } from '../nav';
import { notify } from '../notify';
import type { SpecItem, SpecType } from '../types';
import { SPEC_TYPES } from '../types';
import { ItemDetail } from '../components/ItemDetail';
import { ItemForm, type FormMode } from '../components/ItemForm';
import { Facets } from '../components/Facets';
import { SpecTypesGuide } from '../components/SpecTypesGuide';
import {
  applyFilters,
  facetCounts,
  readView,
  sortItems,
  writeView,
  type Selection,
  type SortDir,
  type SortKey,
} from '../specFilter';
import { Badge, Button, Icon, Menu, TextInput, cx, useConfirm } from '../ui';

export function refOf(item: SpecItem) {
  return item.key ?? item.id;
}

export function SpecPage() {
  const { ref } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [form, setForm] = useState<FormMode | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const view = readView(search);

  // Every spec item, in one query that polling keeps current; filtering and sorting happen
  // here, so that no filter can show a stale list.
  const list = useQuery({
    queryKey: ['spec', 'all'],
    queryFn: () => call<SpecItem[]>('spec_list', {}),
  });
  const all = useMemo(() => list.data ?? [], [list.data]);
  const items = useMemo(
    () => sortItems(applyFilters(all, view.text, view.selection), view.sort, view.dir),
    [all, view.text, view.selection, view.sort, view.dir],
  );
  const counts = useMemo(() => facetCounts(all, view.text, view.selection), [all, view.text, view.selection]);

  const setView = (next: Partial<typeof view>) => setSearch(writeView(search, { ...view, ...next }), { replace: true });
  const setSort = (key: SortKey) => {
    const dir: SortDir = view.sort === key && view.dir === 'asc' ? 'desc' : 'asc';
    setView({ sort: key, dir });
  };

  const decoded = ref ? decodeURIComponent(ref) : undefined;
  const index = decoded ? items.findIndex((i) => i.key === decoded || i.id === decoded) : -1;
  const current = index >= 0 ? items[index] : !decoded ? items[0] : all.find((i) => i.key === decoded || i.id === decoded);
  const selectedRef = decoded ?? (items[0] ? refOf(items[0]) : undefined);

  // `/spec?add=Decision` (from the command palette) opens the add form.
  const addParam = search.get('add');
  const fromUrl: FormMode | null =
    addParam && (SPEC_TYPES as string[]).includes(addParam) ? { mode: 'add', type: addParam as SpecType } : null;
  const openForm = form ?? fromUrl;
  const closeForm = () => {
    setForm(null);
    if (addParam) {
      search.delete('add');
      setSearch(search, { replace: true });
    }
  };

  const go = (r: string) => navigate(`/spec/${encodeURIComponent(r)}${location.search}`);
  const select = (item: SpecItem | undefined) => {
    if (item) go(refOf(item));
  };
  const move = (delta: number) => {
    if (items.length === 0) return;
    if (index < 0) return select(items[0]);
    select(items[Math.min(items.length - 1, Math.max(0, index + delta))]);
  };

  const retire = async (item: SpecItem) => {
    if (item.status === 'retired') {
      notify.info('Already retired.');
      return;
    }
    const label = item.key ?? item.title;
    const ok = await confirm({
      title: `Retire ${label}?`,
      body: (
        <>
          Retiring never deletes: {label} stays in the graph as retired, and its {item.links} link(s) are kept, so that
          they can be reviewed. Your agent sees the change in the change log.
        </>
      ),
      confirmLabel: 'Retire',
      danger: true,
    });
    if (!ok) return;
    try {
      await call('spec_retire', { ref: item.id });
      notify.info(`Retired ${label} (its ${item.links} link(s) were kept).`);
      await queryClient.invalidateQueries();
    } catch (e) {
      notify.error('Not retired', (e as Error).message);
    }
  };

  const onlyType = view.selection.type?.length === 1 ? (view.selection.type[0] as SpecType) : 'Requirement';
  useHotkeys([
    ['/', () => filterRef.current?.focus()],
    ['j', () => move(1)],
    ['ArrowDown', () => move(1)],
    ['n', () => move(1)],
    ['k', () => move(-1)],
    ['ArrowUp', () => move(-1)],
    ['p', () => move(-1)],
    ['a', () => setForm({ mode: 'add', type: onlyType })],
    ['e', () => current && setForm({ mode: 'edit', item: current })],
    ['r', () => current && void retire(current)],
  ]);

  const filtered = view.text !== '' || Object.values(view.selection).some((v) => v.length > 0);
  const th = (key: SortKey, label: string) => (
    <th aria-sort={view.sort === key ? (view.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <SortHeader active={view.sort === key} dir={view.dir} onClick={() => setSort(key)} label={label}>
        {label}
      </SortHeader>
    </th>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          inputRef={filterRef}
          placeholder="Search keys and text (/)"
          icon="search"
          value={view.text}
          onChange={(text) => setView({ text })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
          width={300}
          ariaLabel="Search"
        />
        <Menu
          trigger={(toggle) => (
            <Button icon="add" rightIcon="expand_more" onClick={toggle}>
              Add
            </Button>
          )}
          items={SPEC_TYPES.map((t) => ({ label: t, onClick: () => setForm({ mode: 'add', type: t }) }))}
        />
        <span className="rn-muted">
          {list.isLoading ? 'Loading…' : filtered ? `${items.length} of ${all.length} item(s)` : `${all.length} item(s)`}
        </span>
      </div>
      {list.error && <p className="rn-error-text m-0">{(list.error as Error).message}</p>}
      <SpecTypesGuide />
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden" style={{ flexBasis: 0 }}>
        <div className="min-h-0 overflow-auto" style={{ flex: '0 0 210px' }}>
          <Facets counts={counts} selection={view.selection} onChange={(s: Selection) => setView({ selection: s })} />
        </div>
        <div className="min-h-0 min-w-0 overflow-auto" style={{ flex: '1.2 1 0' }}>
          <table className="rn-table rn-table-hover">
            <thead>
              <tr>
                {th('key', 'Key')}
                {th('type', 'Type')}
                {th('status', 'Status')}
                {th('title', 'Title')}
                {th('links', 'Links')}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSelected = current?.id === item.id;
                return (
                  <tr
                    key={item.id}
                    className={cx('rn-row-clickable', isSelected && 'rn-row-selected', item.pendingChange && 'rn-row-pending')}
                    onClick={() => select(item)}
                    aria-selected={isSelected}
                    data-pending={item.pendingChange ? true : undefined}
                    title={
                      item.pendingChange
                        ? `Pending change #${item.pendingChange.seq} (${item.pendingChange.kind}): not handled by your agent yet`
                        : undefined
                    }
                    data-testid={`item-${refOf(item)}`}
                  >
                    <td className="rn-mono whitespace-nowrap">{item.key ?? '—'}</td>
                    <td className="text-xs">{item.type}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <span className="line-clamp-2">{item.title}</span>
                    </td>
                    <td className="whitespace-nowrap">{item.links}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!list.isLoading && !list.error && items.length === 0 && (
            <p className="rn-muted p-4">
              {filtered
                ? 'No spec items match these filters.'
                : 'No spec items yet: add one, or ask your agent to bring in your spec documents.'}
            </p>
          )}
        </div>
        <div className="min-h-0 min-w-0 overflow-auto" style={{ flex: '1 1 0' }}>
          {selectedRef ? (
            <ItemDetail
              // The address's reference when there is one, so that the detail is fetched once.
              itemRef={decoded ?? current?.id ?? selectedRef}
              listItem={current}
              onEdit={(item) => setForm({ mode: 'edit', item })}
              onRetire={(item) => void retire(item)}
            />
          ) : (
            <p className="rn-muted">Select an item to see its details.</p>
          )}
        </div>
      </div>
      {openForm && (
        <ItemForm
          mode={openForm}
          onClose={closeForm}
          onSaved={(saved) => {
            closeForm();
            void queryClient.invalidateQueries().then(() => {
              if (saved) go(saved);
            });
          }}
        />
      )}
    </div>
  );
}

function SortHeader({
  active,
  dir,
  onClick,
  label,
  children,
}: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  const icon = active ? (dir === 'asc' ? 'expand_less' : 'expand_more') : 'unfold_more';
  return (
    <button type="button" onClick={onClick} className="rn-sort-header" aria-label={`Sort by ${label}`}>
      {children}
      <Icon name={icon} size={14} style={{ opacity: active ? 1 : 0.4 }} />
    </button>
  );
}

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  accepted: 'green',
  draft: 'gray',
  proposed: 'blue',
  superseded: 'violet',
  deprecated: 'orange',
  retired: 'red',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge color={STATUS_COLORS[status] ?? 'gray'}>{statusLabel(status)}</Badge>;
}
