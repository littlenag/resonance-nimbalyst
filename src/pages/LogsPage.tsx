// The daemon's log since it started (FR-298): live, filtered by level, component and text,
// following or paused, with copy and export, and the session's level (FR-295).

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { call, downloadJson } from '../api';
import { useLive } from '../live';
import { notify } from '../notify';
import type { LogRecord, Logs } from '../types';
import { StreamList } from '../components/StreamList';
import { LEVELS } from './DiagnosticsPage';
import { Badge, Button, MultiSelect, SegmentedControl, Select, Switch, TextInput } from '../ui';

const LEVEL_COLORS: Record<string, string> = {
  error: 'red',
  warn: 'orange',
  info: 'blue',
  debug: 'gray',
  trace: 'gray',
};

const RANK: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };

/** Records at `level` or more severe, of `components` (all when empty), containing `text`. */
export function filterLogs(records: LogRecord[], level: string, components: string[], text: string): LogRecord[] {
  const max = RANK[level] ?? 4;
  const t = text.trim().toLowerCase();
  return records.filter(
    (r) =>
      (RANK[r.level] ?? 4) <= max &&
      (components.length === 0 || components.includes(r.component)) &&
      (!t || r.message.toLowerCase().includes(t) || JSON.stringify(r.fields ?? {}).toLowerCase().includes(t)),
  );
}

/** A record as one line of text, as in the log file. */
export function logLine(r: LogRecord): string {
  const fields = Object.entries(r.fields ?? {})
    .map(([k, v]) => ` ${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('');
  return `${r.at} ${r.level.toUpperCase().padEnd(5)} ${r.component}: ${r.message}${fields}`;
}

export function LogsPage() {
  const queryClient = useQueryClient();
  const live = useLive();
  const info = useQuery({ queryKey: ['logs', 'info'], queryFn: () => call<Logs>('logs', { since: Number.MAX_SAFE_INTEGER }) });
  const [level, setLevel] = useState('trace');
  const [components, setComponents] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [follow, setFollow] = useState(true);
  const known = useMemo(() => [...new Set(live.logs.map((r) => r.component))].sort(), [live.logs]);
  const shown = useMemo(() => filterLogs(live.logs, level, components, text), [live.logs, level, components, text]);

  const setSessionLevel = async (l: string | null) => {
    if (!l) return;
    try {
      await call('log_level', { level: l });
      notify.info(`The daemon now logs at ${l} until it stops.`);
      await queryClient.invalidateQueries({ queryKey: ['logs'] });
      await queryClient.invalidateQueries({ queryKey: ['diagnostics'] });
    } catch (e) {
      notify.error('Level not changed', (e as Error).message);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="m-0 text-base font-semibold">Logs</h3>
          <div className="rn-muted">
            Since the daemon started. Also written to <span className="rn-mono">{info.data?.file ?? '…'}</span> (log.file).
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Daemon level</span>
          <Select
            size="xs"
            width={110}
            options={LEVELS.map((l) => ({ value: l, label: l }))}
            value={LEVELS.includes(info.data?.level ?? '') ? (info.data?.level ?? null) : null}
            onChange={(l) => void setSessionLevel(l)}
            ariaLabel="Daemon log level"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl data={LEVELS} value={level} onChange={setLevel} ariaLabel="Show at least" />
        <MultiSelect placeholder="All components" data={known} value={components} onChange={setComponents} width={240} ariaLabel="Components" />
        <TextInput size="xs" placeholder="Filter" icon="search" value={text} onChange={setText} width={220} />
        <Switch label="Follow" checked={follow} onChange={setFollow} />
        <Button
          size="xs"
          variant="light"
          icon="content_copy"
          onClick={() => void navigator.clipboard.writeText(shown.map(logLine).join('\n')).then(() => notify.info(`Copied ${shown.length} line(s).`))}
        >
          Copy
        </Button>
        <Button
          size="xs"
          variant="light"
          icon="download"
          onClick={() => downloadJson(`resonance-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, shown)}
        >
          Export
        </Button>
        <span className="rn-muted text-xs">
          {shown.length} of {live.logs.length}
          {live.droppedLogs > 0 && ` · ${live.droppedLogs} older record(s) dropped (log.bufferLines)`}
        </span>
      </div>
      <StreamList
        items={shown}
        follow={follow}
        render={(r) => (
          <div className="flex items-start gap-2">
            <span className="rn-mono rn-muted whitespace-nowrap">{r.at.slice(11, 23)}</span>
            <Badge size="xs" color={LEVEL_COLORS[r.level]} style={{ width: 52, justifyContent: 'center' }}>
              {r.level}
            </Badge>
            <span className="rn-mono rn-muted shrink-0" style={{ width: 80 }}>
              {r.component}
            </span>
            <span className="rn-mono" style={{ wordBreak: 'break-word' }}>
              {r.message}
              {Object.entries(r.fields ?? {}).map(([k, v]) => (
                <span className="rn-muted" key={k}>
                  {' '}
                  {k}={typeof v === 'string' ? v : JSON.stringify(v)}
                </span>
              ))}
            </span>
          </div>
        )}
      />
    </div>
  );
}
