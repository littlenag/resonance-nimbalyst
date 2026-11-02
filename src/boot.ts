// How long the spec page waits for the daemon to become ready (FR-095) before it
// says that startup is taking longer. The page stays on that screen either way:
// spec items are not fetched until the daemon is ready, or the person asks to
// open the spec anyway.

/** The quiet wait. A large repository's startup reconcile can run past this. */
export const BOOT_WAIT_MS = 10_000;

export type BootPhase = 'waiting' | 'delayed' | 'ready';

/** `ready` once the daemon says so, or the person opens the spec anyway. */
export function bootPhase(ready: boolean, elapsedMs: number, proceeded: boolean): BootPhase {
  if (ready || proceeded) return 'ready';
  return elapsedMs >= BOOT_WAIT_MS ? 'delayed' : 'waiting';
}

/** A health state as a short phrase in a sentence. */
export function describeState(state: string | undefined): string {
  switch (state) {
    case 'starting':
      return 'starting';
    case 'reconciling':
      return 'reconciling the repository';
    case 'git-operation':
      return 'waiting for a git command to finish';
    case 'degraded':
      return 'up, in a degraded state';
    case 'ready':
      return 'ready';
    default:
      return state ? state : 'not answering yet';
  }
}
