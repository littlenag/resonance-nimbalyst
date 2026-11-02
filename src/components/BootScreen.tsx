// Shown on the spec and change log until the daemon is ready to serve them (FR-047,
// FR-095). Logs and diagnostics stay reachable: they read the daemon's own buffers,
// which answer while startup reconcile is still running.

import { BOOT_WAIT_MS, describeState, type BootPhase } from '../boot';
import { Button, Loader, Progress } from '../ui';

export function BootScreen({
  phase,
  elapsedMs,
  state,
  pendingEvents,
  lagMs,
  error,
  onLogs,
  onDiagnostics,
  onProceed,
}: {
  phase: Exclude<BootPhase, 'ready'>;
  elapsedMs: number;
  state?: string;
  pendingEvents: number;
  lagMs: number;
  error: string | null;
  onLogs: () => void;
  onDiagnostics: () => void;
  onProceed: () => void;
}) {
  const waiting = phase === 'waiting';
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const where = describeState(state);
  return (
    <div
      className="mx-auto flex h-full max-w-[560px] flex-col items-center justify-center gap-4 text-center"
      role="status"
      aria-live="polite"
      aria-label="Starting Resonance"
    >
      <Loader size="lg" />
      <h2 className="m-0 text-lg font-semibold">{waiting ? 'Starting Resonance' : 'Still starting'}</h2>
      <p className="m-0">
        {waiting
          ? `The panel is up. The daemon is still ${where}, so spec items are not loaded yet.`
          : `Startup can take longer than 10 seconds on a large repository. The daemon has been ${where} for ${seconds}s.`}
      </p>
      {waiting ? (
        <Progress value={Math.min(100, (elapsedMs / BOOT_WAIT_MS) * 100)} label="Time waited" />
      ) : (
        <Progress value={100} animated label="Still waiting for the daemon" />
      )}
      <p className="rn-muted m-0 text-xs">
        {waiting ? `${seconds}s of ${BOOT_WAIT_MS / 1000}s` : 'Waiting for the daemon to become ready.'}
        {pendingEvents > 0 &&
          ` ${pendingEvents} file event${pendingEvents === 1 ? '' : 's'} still waiting${
            lagMs >= 1000 ? ` (oldest ${Math.round(lagMs / 1000)}s)` : ''
          }.`}
      </p>
      {error && <p className="rn-error-text m-0 text-xs">{error}</p>}
      <div className="flex gap-2">
        <Button variant="default" onClick={onLogs}>
          Logs
        </Button>
        <Button variant="default" onClick={onDiagnostics}>
          Diagnostics
        </Button>
        {!waiting && <Button onClick={onProceed}>Open the spec anyway</Button>}
      </div>
    </div>
  );
}
