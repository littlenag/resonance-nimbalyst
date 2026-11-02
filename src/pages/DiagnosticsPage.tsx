// Diagnostics (FR-293–FR-295, MVP-044): the daemon's internals since it started. Identity,
// health, the store, counters, clients, configuration with sources, the activity timeline,
// and the daemon's operational actions.

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { call, downloadJson } from '../api';
import { getLive, markStopped, useLive } from '../live';
import { notify } from '../notify';
import type { DiagEvent, Diagnostics, Status } from '../types';
import { StreamList } from '../components/StreamList';
import { Alert, Badge, Button, MultiSelect, Select, Switch, Tabs, TextInput, useConfirm } from '../ui';

export const EVENT_KINDS = [
  'request',
  'client',
  'reconcile',
  'git',
  'changeset',
  'changelog',
  'divergence',
  'delta',
  'registry',
  'state',
  'action',
  'ui',
];

const KIND_COLORS: Record<string, string> = {
  request: 'gray',
  client: 'cyan',
  reconcile: 'blue',
  git: 'violet',
  changeset: 'green',
  changelog: 'yellow',
  divergence: 'orange',
  delta: 'grape',
  registry: 'pink',
  state: 'indigo',
  action: 'red',
  ui: 'teal',
};

export const LEVELS = ['error', 'warn', 'info', 'debug', 'trace'];

/** Events matching `kinds` (all when empty) and `text`, in the summary or fields. */
export function filterEvents(events: DiagEvent[], kinds: string[], text: string): DiagEvent[] {
  const t = text.trim().toLowerCase();
  return events.filter(
    (e) =>
      (kinds.length === 0 || kinds.includes(e.kind)) &&
      (!t || e.summary.toLowerCase().includes(t) || JSON.stringify(e.fields).toLowerCase().includes(t)),
  );
}

function uptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <tr>
      <td className="rn-muted" style={{ width: 150 }}>
        {k}
      </td>
      <td style={{ wordBreak: 'break-all' }}>{v}</td>
    </tr>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rn-card">
      <div className="mb-2 font-semibold">{title}</div>
      <table className="rn-table rn-table-compact text-xs">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function DiagnosticsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const live = useLive();
  // The snapshot without events: polling carries those.
  const diag = useQuery({
    queryKey: ['diagnostics'],
    queryFn: () => call<Diagnostics>('diagnostics', { kinds: ['-'] }),
    refetchInterval: 3000,
  });
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () => call<Status>('status', {}, { cached: true }),
    refetchInterval: 5000,
  });
  const [tab, setTab] = useState('activity');
  const [kinds, setKinds] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [follow, setFollow] = useState(true);
  const events = useMemo(() => filterEvents(live.events, kinds, text), [live.events, kinds, text]);

  const d = diag.data;
  const s = status.data;

  const action = async (label: string, method: string, args: Record<string, unknown>, warning?: string) => {
    if (warning && !(await confirm({ title: `${label}?`, body: warning, confirmLabel: label, danger: method === 'daemon_stop' }))) return;
    try {
      await call(method, args);
      if (method === 'daemon_stop') markStopped();
      notify.info(`${label}: done.`);
      await queryClient.invalidateQueries();
    } catch (e) {
      notify.error(label, (e as Error).message);
    }
  };

  const exportAll = () => {
    const live = getLive();
    downloadJson(`resonance-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, {
      exportedAt: new Date().toISOString(),
      identity: d?.identity,
      health: d?.health,
      config: d?.config,
      counters: d?.counters,
      clients: d?.clients,
      log: d?.log,
      events: live.events,
      droppedEvents: live.droppedEvents,
      logs: live.logs,
      droppedLogs: live.droppedLogs,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="m-0 text-base font-semibold">Diagnostics</h3>
          <div className="rn-muted">What this daemon has done since it started. Kept in memory only; nothing here outlives the daemon.</div>
        </div>
        <Button variant="light" icon="download" onClick={exportAll}>
          Export JSON
        </Button>
      </div>
      {diag.error && <Alert color="red">{(diag.error as Error).message}</Alert>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <InfoCard title="Daemon">
          <Row k="Process" v={d?.identity.pid} />
          <Row k="Version" v={d?.identity.version} />
          <Row k="Up for" v={d ? uptime(d.identity.uptimeSeconds) : ''} />
          <Row k="Started" v={d?.identity.startedAt} />
          <Row k="Repository" v={<span className="rn-mono">{d?.identity.root}</span>} />
          <Row k="Socket" v={<span className="rn-mono">{d?.identity.endpoint}</span>} />
          <Row k="Web UI" v={<span className="rn-mono">{d?.identity.ui}</span>} />
        </InfoCard>
        <InfoCard title="Health">
          <Row k="State" v={<Badge color={d?.health.ready ? 'green' : 'orange'} variant="filled">{d?.health.state}</Badge>} />
          <Row k="Ingest lag" v={d ? `${d.health.lagMs} ms` : ''} />
          <Row k="Pending events" v={d?.health.pendingEvents} />
          <Row k="Watermark" v={d ? `${d.health.ingestWatermark} / ${d.health.eventsReceived}` : ''} />
          <Row k="Last ingest" v={d?.health.lastIngest ?? '—'} />
          <Row k="Requests" v={d?.health.requestsServed} />
          <Row k="Last error" v={d?.health.lastError ? <span className="rn-error-text">{d.health.lastError}</span> : '—'} />
        </InfoCard>
        <InfoCard title="Store">
          <Row k="Stage" v={s ? `${s.stage} (${s.participation})` : ''} />
          <Row k="Files" v={s?.counts.files} />
          <Row k="Requirements" v={s ? `${s.counts.requirements} (${s.counts.requirementsRetired} retired)` : ''} />
          <Row k="Decisions" v={s?.counts.decisions} />
          <Row k="Code units / tests" v={s ? `${s.counts.codeUnits} / ${s.counts.tests}` : ''} />
          <Row k="Links" v={s ? Object.entries(s.counts.links).map(([k, n]) => `${k} ${n}`).join(', ') || '0' : ''} />
          <Row k="Open delta" v={s ? `${s.history.openOperations} operation(s)` : ''} />
          <Row k="Sealed deltas" v={s?.history.sealed} />
          <Row k="Pending changes" v={s?.pendingChanges} />
          <Row k="Repair list" v={s?.repair.length} />
          <Row k="Divergences" v={s?.divergences.length} />
        </InfoCard>
      </div>

      <div className="rn-card flex flex-wrap items-center gap-1.5">
        <span className="mr-2 font-semibold">Actions</span>
        <Button size="xs" variant="light" icon="refresh" onClick={() => void action('Reconcile', 'reconcile', {})}>
          Reconcile now
        </Button>
        <Button
          size="xs"
          variant="light"
          icon="refresh"
          onClick={() =>
            void action('Full reconcile', 'reconcile', { full: true }, 'Every file is read again, ignoring sizes and times. Other clients wait until it finishes.')
          }
        >
          Full reconcile
        </Button>
        <Button
          size="xs"
          variant="light"
          icon="build"
          onClick={() =>
            void action('Rebuild derived data', 'rebuild_derived', {}, 'Derived data (containment, the file cache) is dropped and rebuilt. Other clients wait until it finishes.')
          }
        >
          Rebuild derived data
        </Button>
        <Button
          size="xs"
          variant="light"
          color="orange"
          icon="restart_alt"
          onClick={() =>
            void action('Restart the daemon', 'daemon_restart', {}, 'Connected agents and terminals are disconnected and reconnect to the new daemon. This panel reconnects on its own.')
          }
        >
          Restart
        </Button>
        <Button
          size="xs"
          variant="light"
          color="red"
          icon="stop"
          onClick={() =>
            void action('Stop the daemon', 'daemon_stop', {}, 'Connected agents and terminals are disconnected. This panel stops working until you start the daemon again; the next agent request starts a daemon too.')
          }
        >
          Stop
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <span>Log level for this session</span>
          <Select
            size="xs"
            width={110}
            options={LEVELS.map((l) => ({ value: l, label: l }))}
            value={LEVELS.includes(d?.log.level ?? '') ? (d?.log.level ?? null) : null}
            onChange={(level) => level && void action('Change the log level', 'log_level', { level })}
            ariaLabel="Log level"
          />
        </div>
      </div>

      <div className="flex min-h-[320px] flex-1 flex-col">
        <Tabs
          tabs={[
            { value: 'activity', label: `Activity (${live.events.length})` },
            { value: 'counters', label: 'Counters' },
            { value: 'clients', label: `Clients (${d?.clients.length ?? 0})` },
            { value: 'config', label: 'Configuration' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="flex min-h-0 flex-1 flex-col pt-3">
          {tab === 'activity' && (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <MultiSelect placeholder="All kinds" data={EVENT_KINDS} value={kinds} onChange={setKinds} width={300} ariaLabel="Kinds" />
                <TextInput size="xs" placeholder="Filter" icon="search" value={text} onChange={setText} width={220} />
                <Switch label="Follow" checked={follow} onChange={setFollow} />
                <span className="rn-muted text-xs">
                  {events.length} shown
                  {live.droppedEvents > 0 && ` · ${live.droppedEvents} older event(s) dropped (diagnostics.bufferEvents)`}
                </span>
              </div>
              <StreamList
                items={events}
                follow={follow}
                render={(e) => (
                  <div className="flex items-start gap-2">
                    <span className="rn-mono rn-muted whitespace-nowrap">{e.at.slice(11, 23)}</span>
                    <Badge size="xs" color={KIND_COLORS[e.kind]} style={{ width: 84, justifyContent: 'center' }}>
                      {e.kind}
                    </Badge>
                    <span title={JSON.stringify(e.fields)}>{e.summary}</span>
                  </div>
                )}
              />
            </>
          )}
          {tab === 'counters' && (
            <>
              <table className="rn-table rn-table-striped">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th className="text-right">Count</th>
                    <th className="text-right">Errors</th>
                    <th className="text-right">Median</th>
                    <th className="text-right">95th pct.</th>
                    <th className="text-right">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {(d?.counters.methods ?? []).map((m) => (
                    <tr key={m.method}>
                      <td className="rn-mono">{m.method}</td>
                      <td className="text-right">{m.count}</td>
                      <td className={m.errors ? 'rn-error-text text-right' : 'text-right'}>{m.errors}</td>
                      <td className="text-right">{m.medianMs} ms</td>
                      <td className="text-right">{m.p95Ms} ms</td>
                      <td className="text-right">{m.maxMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(d?.counters.events ?? {}).map(([k, n]) => (
                  <Badge key={k} variant="outline" color={KIND_COLORS[k]}>
                    {k}: {n}
                  </Badge>
                ))}
              </div>
            </>
          )}
          {tab === 'clients' && (
            <>
              <table className="rn-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Kind</th>
                    <th>Actor</th>
                    <th>Connected</th>
                    <th className="text-right">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {(d?.clients ?? []).map((c) => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>
                        <Badge>{c.kind}</Badge>
                      </td>
                      <td>{c.actor ?? '—'}</td>
                      <td>{c.connectedAt}</td>
                      <td className="text-right">{c.requests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {d && d.clients.length === 0 && <p className="rn-muted">No clients connected.</p>}
              <p className="rn-faint text-xs">This panel polls the daemon rather than holding a connection, so it is not listed here.</p>
            </>
          )}
          {tab === 'config' && (
            <table className="rn-table rn-table-striped">
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Value</th>
                  <th>From</th>
                </tr>
              </thead>
              <tbody>
                {(d?.config ?? []).map((c) => (
                  <tr key={c.key}>
                    <td className="rn-mono">{c.key}</td>
                    <td className="rn-mono">{JSON.stringify(c.value)}</td>
                    <td>
                      <Badge color={c.source === 'default' ? 'gray' : c.source === 'file' ? 'blue' : 'orange'}>{c.source}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
