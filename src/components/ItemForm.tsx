// Adding and editing spec items (FR-291, FR-292). Adding suggests the next free key and the
// daemon refuses one that exists (FR-273). Editing sends only what changed, and says so when
// the item changed underneath (another person, an agent or git) before saving.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { call } from '../api';
import { FIELDS, choicesOf, label, valuesOf } from '../fields';
import { notify } from '../notify';
import type { SpecItem, SpecType } from '../types';
import { SPEC_TYPES } from '../types';
import { SPEC_TYPE_GUIDE } from '../specTypes';
import { Alert, Button, MarkdownText, Modal, Select, Tabs, TextInput, Textarea } from '../ui';

export type FormMode = { mode: 'add'; type: SpecType } | { mode: 'edit'; item: SpecItem };

export function ItemForm({
  mode,
  onClose,
  onSaved,
}: {
  mode: FormMode;
  onClose: () => void;
  /** Called with the saved item's key (or ID). */
  onSaved: (ref: string | null) => void;
}) {
  const editing = mode.mode === 'edit' ? mode.item : null;
  const [type, setType] = useState<SpecType>(mode.mode === 'add' ? mode.type : mode.item.type);
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    editing ? valuesOf(editing.type, editing.props) : emptyValues(type),
  );
  // What the edit is based on; compared with the latest version of the item.
  const [base, setBase] = useState<Record<string, string>>(() => (editing ? valuesOf(editing.type, editing.props) : {}));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const suggestion = useQuery({
    queryKey: ['suggest', type],
    queryFn: () => call<{ key: string }>('spec_suggest_key', { type }),
    enabled: mode.mode === 'add',
  });
  // The suggested key until the person types their own (FR-273).
  const shownKey = keyTouched ? key : (suggestion.data?.key ?? '');

  // The latest version of the item being edited; polling for changes refreshes it.
  const latest = useQuery({
    queryKey: ['item', editing?.id ?? '', 'spec'],
    queryFn: () => call<SpecItem>('spec_show', { ref: editing!.id }),
    enabled: !!editing,
  });
  const newer = useMemo(
    () => (editing && latest.data ? valuesOf(editing.type, latest.data.props) : null),
    [editing, latest.data],
  );
  const conflict = !!newer && JSON.stringify(newer) !== JSON.stringify(base);

  const fields = FIELDS[type];
  const changed = editing
    ? Object.fromEntries(fields.filter((f) => values[f.name] !== base[f.name]).map((f) => [f.name, values[f.name]]))
    : Object.fromEntries(fields.filter((f) => values[f.name]?.trim()).map((f) => [f.name, values[f.name]]));

  const save = async () => {
    if (conflict) {
      setError('This item changed while you were editing. Choose which version to keep first.');
      return;
    }
    setError(null);
    if (editing && Object.keys(changed).length === 0) {
      notify.info('Nothing changed.');
      onClose();
      return;
    }
    setSaving(true);
    try {
      const view = editing
        ? await call<SpecItem>('spec_edit', { ref: editing.id, fields: changed })
        : await call<SpecItem>('spec_add', { type, key: shownKey.trim() || undefined, fields: changed });
      notify.info(editing ? `Saved ${editing.key ?? editing.title}.` : `Added ${view.key ?? view.title}.`);
      onSaved(view.key ?? view.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? `Edit ${editing.key ?? editing.title}` : `New ${type.toLowerCase()}`;
  return (
    <Modal
      title={title}
      onClose={onClose}
      width={760}
      onKeyDown={(e) => {
        if ((e.key === 's' && (e.metaKey || e.ctrlKey)) || e.key === 'F2') {
          e.preventDefault();
          void save();
        }
      }}
    >
      <div className="flex flex-col gap-3">
        {editing?.source && (
          <Alert color="blue">
            This item came from <span className="rn-mono">{`${editing.source.path}:${editing.source.line}`}</span>. Saving
            marks that document for your agent to bring back in step.
          </Alert>
        )}
        {conflict && newer && (
          <Alert color="orange" title="This item changed while you were editing">
            <div>Changed: {fields.filter((f) => newer[f.name] !== base[f.name]).map((f) => f.name).join(', ')}.</div>
            <div className="mt-2 flex gap-1.5">
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  setValues(newer);
                  setBase(newer);
                }}
              >
                Take the newer version
              </Button>
              <Button size="xs" variant="light" color="orange" onClick={() => setBase(newer)}>
                Keep my edits
              </Button>
            </div>
          </Alert>
        )}
        {!editing && (
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Type"
              options={SPEC_TYPES.map((t) => ({ value: t, label: t }))}
              value={type}
              onChange={(t) => {
                if (!t) return;
                setType(t as SpecType);
                setValues(emptyValues(t as SpecType));
                setKeyTouched(false);
              }}
            />
            <TextInput
              label="Key"
              description="Suggested: the next free key. Keys are unique."
              value={shownKey}
              onChange={(v) => {
                setKey(v.replace(/\s/g, ''));
                setKeyTouched(true);
              }}
              autoFocus
            />
          </div>
        )}
        <div className="rn-muted">
          {SPEC_TYPE_GUIDE[type].captures} {SPEC_TYPE_GUIDE[type].graph}
        </div>
        {fields.map((f) =>
          f.long ? (
            <LongField key={f.name} name={f.name} value={values[f.name] ?? ''} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
          ) : choicesOf(type, f.name) ? (
            <Select
              key={f.name}
              label={label(f.name)}
              options={options(choicesOf(type, f.name) ?? [], values[f.name] ?? '')}
              value={values[f.name] || null}
              placeholder={editing ? undefined : 'Default for the type'}
              onChange={(v) => setValues((s) => ({ ...s, [f.name]: v ?? '' }))}
            />
          ) : (
            <TextInput key={f.name} label={label(f.name)} value={values[f.name] ?? ''} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
          ),
        )}
        {error && (
          <Alert color="red" title="Not saved">
            {error}
          </Alert>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="rn-muted text-xs">⌘S / ctrl+S saves, esc cancels. Your change goes to the change log for your agent.</span>
          <div className="flex gap-1.5">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              {editing ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** The field's values, and the current one if it is not among them, so that it shows. */
function options(allowed: string[], current: string) {
  const all = current && !allowed.includes(current) ? [...allowed, current] : allowed;
  return all.map((v) => ({ value: v, label: label(v) }));
}

function emptyValues(type: SpecType): Record<string, string> {
  return Object.fromEntries(FIELDS[type].map((f) => [f.name, '']));
}

function LongField({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  const [tab, setTab] = useState('write');
  return (
    <div>
      <div className="rn-label">{label(name)}</div>
      <Tabs
        tabs={[
          { value: 'write', label: 'Write' },
          { value: 'preview', label: 'Preview' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="pt-2">
        {tab === 'write' ? (
          <Textarea ariaLabel={label(name)} value={value} onChange={onChange} />
        ) : value ? (
          <MarkdownText>{value}</MarkdownText>
        ) : (
          <div className="rn-muted">Nothing to preview.</div>
        )}
      </div>
    </div>
  );
}
