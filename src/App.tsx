// The panel's app: the spec, the change log, diagnostics and logs, as the web UI (MVP-043)
// lays them out, in Nimbalyst's look.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { call } from './api';
import { statusLabel } from './fields';
import { useHotkeys } from './hotkeys';
import { connect, disconnect, useLive } from './live';
import { useLocation, useNavigate } from './nav';
import type { Health, Session, SpecItem, Status } from './types';
import { SPEC_TYPES } from './types';
import { SpecPage } from './pages/SpecPage';
import { ChangeLogPage } from './pages/ChangeLogPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { LogsPage } from './pages/LogsPage';
import { BootScreen } from './components/BootScreen';
import { CommandPalette, type PaletteAction } from './components/CommandPalette';
import { bootPhase, describeState } from './boot';
import { Alert, Badge, Button, Icon, IconButton, Kbd, Modal, cx } from './ui';

const STATE_COLORS: Record<string, string> = {
  ready: 'green',
  starting: 'gray',
  reconciling: 'blue',
  'git-operation': 'blue',
  degraded: 'orange',
};

export function App({ onReconnect }: { onReconnect: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const live = useLive();
  const [help, setHelp] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    connect(() => {
      void queryClient.invalidateQueries({ queryKey: ['spec'] });
      void queryClient.invalidateQueries({ queryKey: ['item'] });
      void queryClient.invalidateQueries({ queryKey: ['changes'] });
      void queryClient.invalidateQueries({ queryKey: ['status'] });
    });
    return () => disconnect();
  }, [queryClient]);

  const session = useQuery({ queryKey: ['session'], queryFn: () => call<Session>('session') });
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => call<Health>('health'),
    // Poll quickly until the daemon can serve the graph, then settle (FR-095).
    refetchInterval: (query) => (query.state.data?.ready ? 5000 : 500),
  });
  const ready = health.data?.ready === true;
  // Spec items are fetched only once the daemon is ready, or the person asks to look anyway.
  // A fetch during startup can fail or come back empty and then stay cached.
  const [proceeded, setProceeded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (ready) return;
    const start = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - start), 200);
    return () => window.clearInterval(id);
  }, [ready]);
  const serveGraph = ready || proceeded;
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () => call<Status>('status', {}, { cached: true }),
    enabled: serveGraph,
  });
  const allItems = useQuery({
    queryKey: ['spec', 'all'],
    queryFn: () => call<SpecItem[]>('spec_list', {}),
    enabled: serveGraph,
  });
  const wasReady = useRef(false);
  useEffect(() => {
    if (!ready || wasReady.current) return;
    wasReady.current = true;
    void queryClient.invalidateQueries({ queryKey: ['spec'] });
    void queryClient.invalidateQueries({ queryKey: ['status'] });
  }, [ready, queryClient]);

  useHotkeys([
    ['shift+/', () => setHelp(true)],
    ['l', () => navigate('/changes')],
    ['g', () => void queryClient.invalidateQueries()],
    ['mod+K', () => setPalette(true)],
  ]);

  const actions: PaletteAction[] = useMemo(() => {
    const go = (id: string, label: string, path: string, icon: string): PaletteAction => ({
      id,
      label,
      group: 'Go to',
      icon,
      onClick: () => navigate(path),
    });
    const list: PaletteAction[] = [
      go('go-spec', 'Spec items', '/spec', 'list_alt'),
      go('go-changes', 'Change log', '/changes', 'history'),
      go('go-diagnostics', 'Diagnostics', '/diagnostics', 'monitor_heart'),
      go('go-logs', 'Logs', '/logs', 'description'),
      ...SPEC_TYPES.map((t) => ({
        id: `add-${t}`,
        label: `Add a ${t.toLowerCase()}`,
        group: 'Actions',
        icon: 'add',
        onClick: () => navigate(`/spec?add=${t}`),
      })),
      {
        id: 'reconcile',
        label: 'Reconcile now',
        description: 'Bring the graph up to date with the files on disk',
        group: 'Actions',
        icon: 'refresh',
        onClick: () => void call('reconcile', {}).then(() => queryClient.invalidateQueries()),
      },
    ];
    for (const item of allItems.data ?? []) {
      const ref = item.key ?? item.id;
      list.push({
        id: `item-${item.id}`,
        label: `${item.key ?? ''} ${item.title}`.trim(),
        description: `${item.type} · ${statusLabel(item.status)}`,
        group: 'Spec items',
        keywords: [item.text.slice(0, 200)],
        onClick: () => navigate(`/spec/${encodeURIComponent(ref)}`),
      });
    }
    return list;
  }, [allItems.data, navigate, queryClient]);

  const state = health.data?.state ?? '…';
  const pending = status.data?.pendingChanges ?? 0;
  const path = location.pathname;
  const phase = bootPhase(ready, elapsed, proceeded);
  // Logs and diagnostics read the daemon's own buffers and answer during startup.
  const escape = path.startsWith('/logs') || path.startsWith('/diagnostics');
  const showBoot = phase !== 'ready' && !escape;

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-nim px-4" style={{ background: 'var(--nim-bg-secondary)' }}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-semibold">Resonance</span>
          {session.data && (
            <span className="truncate font-medium" title={session.data.root}>
              {session.data.repository}
            </span>
          )}
          {session.data?.branch && <Badge color="primary">{session.data.branch}</Badge>}
          {status.data && (
            <Badge variant="outline" title={`Participation: ${status.data.participation}`}>
              stage {status.data.stage}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {pending > 0 && (
            <Badge color="yellow" variant="filled" title="Changes your agent has not handled yet" onClick={() => navigate('/changes')}>
              {pending} pending
            </Badge>
          )}
          <Badge variant="dot" color={STATE_COLORS[state] ?? 'gray'} title={health.data?.lastError ?? `daemon ${state}`}>
            {state}
          </Badge>
          <IconButton icon="search" label="Search and actions (⌘K)" onClick={() => setPalette(true)} />
          <IconButton icon="help" label="Help" onClick={() => setHelp(true)} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="rn-nav shrink-0 border-r border-nim p-2" style={{ width: 190 }}>
          <NavItem icon="list_alt" label="Spec" active={path === '/' || path.startsWith('/spec')} onClick={() => navigate('/spec')} />
          <NavItem
            icon="history"
            label="Change log"
            active={path.startsWith('/changes')}
            onClick={() => navigate('/changes')}
            badge={pending > 0 ? pending : undefined}
          />
          <NavItem icon="monitor_heart" label="Diagnostics" active={path.startsWith('/diagnostics')} onClick={() => navigate('/diagnostics')} />
          <NavItem icon="description" label="Logs" active={path.startsWith('/logs')} onClick={() => navigate('/logs')} />
        </nav>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4">
          <ConnectionBanner onReconnect={onReconnect} />
          {showBoot ? (
            <BootScreen
              phase={phase}
              elapsedMs={elapsed}
              state={health.data?.state}
              pendingEvents={health.data?.pendingEvents ?? 0}
              lagMs={health.data?.lagMs ?? 0}
              error={health.error ? (health.error as Error).message : (health.data?.lastError ?? null)}
              onLogs={() => navigate('/logs')}
              onDiagnostics={() => navigate('/diagnostics')}
              onProceed={() => {
                setProceeded(true);
                navigate('/spec');
              }}
            />
          ) : (
            <>
              {proceeded && !ready && (
                <Alert color="yellow" title="The daemon is not ready">
                  The daemon is still {describeState(health.data?.state)}. Spec items refresh when it is ready.
                </Alert>
              )}
              <Page path={path} />
            </>
          )}
        </main>
      </div>
      {palette && <CommandPalette actions={actions} onClose={() => setPalette(false)} />}
      {help && <HelpModal onClose={() => setHelp(false)} live={live.connection} />}
    </>
  );
}

function Page({ path }: { path: string }) {
  if (path.startsWith('/changes')) return <ChangeLogPage />;
  if (path.startsWith('/diagnostics')) return <DiagnosticsPage />;
  if (path.startsWith('/logs')) return <LogsPage />;
  return <SpecPage />;
}

function NavItem({ icon, label, active, onClick, badge }: { icon: string; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button type="button" className={cx('rn-nav-item', active && 'rn-active')} onClick={onClick}>
      <Icon name={icon} size={18} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <Badge size="xs" color="yellow" variant="filled">
          {badge}
        </Badge>
      )}
    </button>
  );
}

function ConnectionBanner({ onReconnect }: { onReconnect: () => void }) {
  const { connection } = useLive();
  if (connection === 'live' || connection === 'connecting') return null;
  const text = {
    reconnecting: 'Lost the connection to the daemon; retrying. It may have stopped after being idle.',
    stopped: 'The daemon stopped.',
    'signed-out': 'The daemon no longer accepts this panel’s key (it was replaced).',
  }[connection];
  return (
    <Alert color={connection === 'reconnecting' ? 'yellow' : 'red'} title="Not connected">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{text}</span>
        <Button size="xs" variant="light" icon="play_arrow" onClick={onReconnect}>
          Start and reconnect
        </Button>
      </div>
    </Alert>
  );
}

const KEYS: [string, string][] = [
  ['/', 'Filter spec items by text'],
  ['j / k, ↓ / ↑', 'Next or previous item'],
  ['a', 'Add a spec item'],
  ['e', 'Edit the selected item'],
  ['r', 'Retire the selected item'],
  ['l', 'Open the change log'],
  ['d / shift+D', 'Clear the selected change-log entry / all of them'],
  ['g', 'Reload'],
  ['⌘K / ctrl+K', 'Search spec items and actions'],
  ['⌘S / ctrl+S', 'Save a form'],
  ['esc', 'Cancel'],
  ['?', 'This help'],
];

function HelpModal({ onClose, live }: { onClose: () => void; live: string }) {
  return (
    <Modal title="Keys" onClose={onClose} width={560}>
      <table className="rn-table">
        <tbody>
          {KEYS.map(([k, what]) => (
            <tr key={k}>
              <td style={{ width: 160 }}>
                <Kbd>{k}</Kbd>
              </td>
              <td>{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rn-muted mb-0 mt-3">
        Keys work while the Resonance panel has focus. Your edits go to the graph as you, and land in the change log for your
        agent. Connection: <span className="rn-mono">{live}</span>.
      </p>
    </Modal>
  );
}
