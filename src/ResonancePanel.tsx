// The panel: find the `resonance` binary and this workspace's daemon (resonance.ts), sign
// in to its web API (transport.ts), then show the app. Until then, say what is missing.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PanelHostProps } from '@nimbalyst/extension-sdk';
import { setConnection } from './api';
import { App } from './App';
import { HotkeyScope } from './hotkeys';
import { NavProvider } from './nav';
import { check, type Status } from './resonance';
import { getBinaryPath, setStorage } from './settings';
import { signIn } from './transport';
import { Button, ConfirmProvider, Loader } from './ui';

type Phase = { kind: 'checking' } | { kind: 'problem'; status: Exclude<Status, { kind: 'ready' }> } | { kind: 'connected'; root: string; generation: number };

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Polling says when something changed; no refetching on focus.
      queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
    },
  });
}

export function ResonancePanel({ host }: PanelHostProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  const [client, setClient] = useState(makeQueryClient);
  setStorage(host.storage);

  const start = useCallback(async () => {
    setPhase((p) => (p.kind === 'connected' ? p : { kind: 'checking' }));
    try {
      const status = await check(host, getBinaryPath());
      if (status.kind !== 'ready') {
        setConnection(null);
        setPhase({ kind: 'problem', status });
        return;
      }
      const endpoint = await signIn(host, status.daemon.port, status.daemon.token);
      setConnection({ host, endpoint });
      setPhase((p) =>
        p.kind === 'connected' && p.root === status.daemon.root
          ? { ...p, generation: p.generation + 1 }
          : { kind: 'connected', root: status.daemon.root, generation: 0 },
      );
    } catch (e) {
      setConnection(null);
      setPhase({ kind: 'problem', status: { kind: 'error', message: e instanceof Error ? e.message : String(e) } });
    }
  }, [host]);

  // A new workspace is another repository: start over with an empty cache.
  useEffect(() => {
    setClient(makeQueryClient());
    void start();
    return () => setConnection(null);
  }, [start, host.workspacePath]);

  return (
    <HotkeyScope className="rn-root">
      <ConfirmProvider>
        {phase.kind === 'connected' ? (
          <QueryClientProvider client={client}>
            <NavProvider key={phase.root}>
              <App onReconnect={() => void start()} />
            </NavProvider>
          </QueryClientProvider>
        ) : (
          <Setup workspace={host.workspacePath} phase={phase} onRetry={() => void start()} />
        )}
      </ConfirmProvider>
    </HotkeyScope>
  );
}

function Setup({ workspace, phase, onRetry }: { workspace: string; phase: Phase; onRetry: () => void }) {
  return (
    <div className="flex h-full items-start justify-center overflow-auto p-12">
      <div className="rn-card w-full max-w-[640px]">
        <h2 className="m-0 text-base font-semibold">Resonance</h2>
        <div className="rn-muted text-xs">{workspace}</div>
        <div className="mt-4">
          {phase.kind === 'problem' ? (
            <Problem status={phase.status} />
          ) : (
            <div className="flex items-center gap-2">
              <Loader /> Looking for this workspace's Resonance daemon…
            </div>
          )}
        </div>
        <div className="mt-5">
          <Button variant="default" icon="refresh" onClick={onRetry} disabled={phase.kind === 'checking'}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

function Problem({ status }: { status: Exclude<Status, { kind: 'ready' }> }) {
  switch (status.kind) {
    case 'not-initialized':
      return (
        <>
          <p className="mt-0">Resonance isn't set up in this repository. To set it up, run this in a terminal here:</p>
          <Command text="resonance init" />
        </>
      );
    case 'not-a-repo':
      return <p className="m-0">This workspace isn't inside a git repository. Resonance works only in git repositories.</p>;
    case 'binary-missing':
      return (
        <>
          <p className="mt-0">
            The <code className="rn-mono">resonance</code> command wasn't found. Tried:
          </p>
          <ul>
            {status.tried.map((t) => (
              <li key={t}>
                <code className="rn-mono">{t}</code>
              </li>
            ))}
          </ul>
          <p className="mb-0">
            Install it, or set its full path in Settings &gt; Extensions &gt; Resonance &gt; <code className="rn-mono">binaryPath</code>.
          </p>
        </>
      );
    case 'error':
      return (
        <>
          <p className="mt-0">Resonance reported an error:</p>
          <pre className="rn-mono whitespace-pre-wrap rounded p-3" style={{ background: 'var(--nim-bg-tertiary)' }}>
            {status.message}
          </pre>
        </>
      );
  }
}

function Command({ text }: { text: ReactNode & string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2" style={{ background: 'var(--nim-bg-tertiary)' }}>
      <code className="rn-mono">{text}</code>
      <Button size="xs" variant="default" onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
