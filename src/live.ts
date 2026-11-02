// The live view of the daemon: diagnostics events and log records since it started, and
// a signal when the graph changed. The web UI gets these from one event stream
// (/api/events, FR-290). The panel has no stream (see transport.ts), so it polls the
// daemon's buffers with `since`; `diagnostics` and `logs` are answered from memory and are
// not recorded as activity, so polling them adds nothing to the timeline. The interface
// matches resonance/web/src/live.ts.

import { useSyncExternalStore } from 'react';
import { call, onUnreachable } from './api';
import type { DiagEvent, Diagnostics, LogRecord, Logs } from './types';

export type Connection = 'connecting' | 'live' | 'reconnecting' | 'stopped' | 'signed-out';

export interface LiveState {
  connection: Connection;
  events: DiagEvent[];
  logs: LogRecord[];
  /** Events the daemon dropped before this panel saw them. */
  droppedEvents: number;
  droppedLogs: number;
  daemon: { pid: number; startedAt: string } | null;
}

const MAX_EVENTS = 10000;
const MAX_LOGS = 5000;
const POLL_MS = 1500;
/** Event kinds that mean the graph or the change log changed: views refresh. */
const CHANGE_KINDS = new Set(['changeset', 'changelog', 'reconcile', 'git', 'divergence']);

const EMPTY: LiveState = {
  connection: 'connecting',
  events: [],
  logs: [],
  droppedEvents: 0,
  droppedLogs: 0,
  daemon: null,
};

let state: LiveState = EMPTY;
const listeners = new Set<() => void>();
let pending = false;

function emit() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    listeners.forEach((l) => l());
  }, 50);
}

function set(next: Partial<LiveState>) {
  state = { ...state, ...next };
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLive(): LiveState {
  return useSyncExternalStore(subscribe, () => state);
}

export function getLive(): LiveState {
  return state;
}

/** Merge `incoming` into `current` by sequence number, keeping at most `max`. */
export function mergeBySeq<T extends { seq: number }>(current: T[], incoming: T[], max: number): T[] {
  if (incoming.length === 0) return current;
  const last = current.length ? current[current.length - 1].seq : 0;
  let merged: T[];
  if (incoming.every((x) => x.seq > last)) {
    merged = current.concat(incoming);
  } else {
    const bySeq = new Map<number, T>();
    for (const x of current) bySeq.set(x.seq, x);
    for (const x of incoming) bySeq.set(x.seq, x);
    merged = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  }
  return merged.length > max ? merged.slice(merged.length - max) : merged;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let lastEvent: number | undefined;
let lastLog: number | undefined;
let stopUnreachable: (() => void) | null = null;

async function poll(onChanged: () => void) {
  try {
    const [d, l] = await Promise.all([
      call<Diagnostics>('diagnostics', lastEvent === undefined ? {} : { since: lastEvent }),
      call<Logs>('logs', lastLog === undefined ? {} : { since: lastLog }),
    ]);
    const daemon = { pid: d.identity.pid, startedAt: d.identity.startedAt };
    const another = state.daemon && (state.daemon.pid !== daemon.pid || state.daemon.startedAt !== daemon.startedAt);
    if (another) {
      // A new daemon: sequence numbers started again. Read its buffers from the start.
      state = { ...state, events: [], logs: [], droppedEvents: 0, droppedLogs: 0 };
      lastEvent = undefined;
      lastLog = undefined;
      set({ connection: 'live', daemon });
      onChanged();
      return;
    }
    const first = lastEvent === undefined;
    // A gap the buffers no longer hold: start again from what they have.
    const gap = !first && d.oldestSeq !== null && d.oldestSeq > (lastEvent ?? 0) + 1;
    lastEvent = d.lastSeq;
    lastLog = l.lastSeq;
    set({
      connection: 'live',
      daemon,
      events: gap ? d.events : mergeBySeq(state.events, d.events, MAX_EVENTS),
      logs: mergeBySeq(state.logs, l.records, MAX_LOGS),
      droppedEvents: d.dropped,
      droppedLogs: l.dropped,
    });
    if (!first && (gap || d.events.some((e) => CHANGE_KINDS.has(e.kind)))) onChanged();
  } catch (e) {
    if ((e as { unauthorized?: boolean }).unauthorized) set({ connection: 'signed-out' });
    else if (state.connection !== 'stopped') set({ connection: state.connection === 'live' ? 'reconnecting' : state.connection });
  }
}

/** Start polling. `onChanged` runs when the graph or the change log changed, to refresh views. */
export function connect(onChanged: () => void) {
  if (running) return;
  running = true;
  stopUnreachable = onUnreachable(() => {
    if (state.connection === 'live') set({ connection: 'reconnecting' });
  });
  const tick = async () => {
    await poll(onChanged);
    if (running) timer = setTimeout(tick, POLL_MS);
  };
  void tick();
}

/** The daemon was stopped on purpose: stop expecting it back. */
export function markStopped() {
  set({ connection: 'stopped' });
}

/** Stop polling and forget everything (the panel closed, or the workspace changed). */
export function disconnect() {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
  stopUnreachable?.();
  stopUnreachable = null;
  lastEvent = undefined;
  lastLog = undefined;
  state = EMPTY;
  emit();
}

/** For tests: forget everything. */
export const resetLive = disconnect;
