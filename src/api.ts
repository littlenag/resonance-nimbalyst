// Calls to the daemon (POST /api/call), as the person, with origin `ui`: the same API the
// web UI uses (resonance/web/src/api.ts), carried by curl through PanelHost.exec.

import type { PanelHost } from '@nimbalyst/extension-sdk';
import { post, Unreachable, type Endpoint } from './transport';

let connection: { host: PanelHost; endpoint: Endpoint } | null = null;
const unreachableListeners = new Set<() => void>();

/** The daemon this panel talks to; `null` while there is none. */
export function setConnection(next: { host: PanelHost; endpoint: Endpoint } | null) {
  connection = next;
}

/** Called whenever a request finds nobody listening. */
export function onUnreachable(l: () => void): () => void {
  unreachableListeners.add(l);
  return () => unreachableListeners.delete(l);
}

export class ApiError extends Error {
  status: number;
  exitCode: number;
  constructor(message: string, status: number, exitCode: number) {
    super(message);
    this.status = status;
    this.exitCode = exitCode;
  }

  /** The panel is not signed in to this daemon (its key is stale). */
  get unauthorized() {
    return this.status === 401;
  }
}

export async function call<T>(method: string, args: Record<string, unknown> = {}, opts: { cached?: boolean } = {}): Promise<T> {
  if (!connection) throw new ApiError('Not connected to a Resonance daemon.', 0, 1);
  let res;
  try {
    res = await post(connection.host, connection.endpoint, '/api/call', { method, args, cached: opts.cached ?? false });
  } catch (e) {
    if (e instanceof Unreachable) {
      unreachableListeners.forEach((l) => l());
      throw new ApiError('The daemon is not answering. It may have stopped.', 0, 1);
    }
    throw new ApiError(`Could not reach the daemon: ${(e as Error).message}`, 0, 1);
  }
  let body: { result?: T; error?: { message: string; exitCode: number } };
  try {
    body = JSON.parse(res.body);
  } catch {
    throw new ApiError(`Unexpected answer from the daemon (HTTP ${res.status}).`, res.status, 1);
  }
  if (res.status < 200 || res.status >= 300 || body.error) {
    throw new ApiError(body.error?.message ?? `HTTP ${res.status}`, res.status, body.error?.exitCode ?? 1);
  }
  return body.result as T;
}

/** Download `data` as a JSON file. */
export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
