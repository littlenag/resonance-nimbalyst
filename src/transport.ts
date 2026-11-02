// HTTP to the daemon's web API, through `curl` run by PanelHost.exec.
//
// Nimbalyst's renderer is a file:// page: it cannot send the daemon's SameSite=Strict
// cookie, the daemon would refuse its Origin, and the API answers no CORS. So requests go
// out through the host's exec instead, as a same-origin client would make them. The key
// never appears on a command line (where `ps` would show it to other users): the whole
// curl configuration travels in an environment variable and reaches curl on stdin through
// the shell's built-in printf.

import type { PanelHost } from '@nimbalyst/extension-sdk';

export interface Endpoint {
  /** The web UI's port on 127.0.0.1. */
  port: number;
  /** The repository's web UI key. */
  token: string;
  /** The cookie the daemon expects the key in, learned from `/auth`. */
  cookie: string;
}

export interface HttpResult {
  status: number;
  body: string;
}

/** curl could not connect: nothing listens on the port (exit 7), or it timed out (28). */
export class Unreachable extends Error {}

const COMMAND = `printf '%s' "$RESONANCE_CURL" | curl --config -`;
const STATUS_MARK = '\n@@status=';

/** A curl config value: double-quoted, with backslash escapes. */
function quote(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`;
}

async function curl(host: PanelHost, options: [string, string?][], timeoutMs: number): Promise<HttpResult> {
  const config = [
    ['silent'],
    ['show-error'],
    ['max-time', String(Math.ceil(timeoutMs / 1000))],
    ['write-out', `${STATUS_MARK}%{http_code}`],
    ...options,
  ]
    .map(([k, v]) => (v === undefined ? k : `${k} = ${quote(v)}`))
    .join('\n');
  const r = await host.exec(COMMAND, {
    env: { RESONANCE_CURL: `${config}\n` },
    timeout: timeoutMs + 5000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.exitCode === 7 || r.exitCode === 28) throw new Unreachable(r.stderr.trim() || `curl exited with ${r.exitCode}`);
  if (r.exitCode !== 0) throw new Error(r.stderr.trim() || `curl exited with ${r.exitCode}`);
  const at = r.stdout.lastIndexOf(STATUS_MARK);
  if (at < 0) throw new Error('unexpected output from curl');
  return { status: Number(r.stdout.slice(at + STATUS_MARK.length).trim()), body: r.stdout.slice(0, at) };
}

/** Sign in as `resonance ui`'s address does, and learn the cookie's name. */
export async function signIn(host: PanelHost, port: number, token: string): Promise<Endpoint> {
  const r = await curl(
    host,
    [
      ['url', `http://127.0.0.1:${port}/auth?token=${encodeURIComponent(token)}&next=%2F`],
      ['dump-header', '-'],
      ['output', '/dev/null'],
    ],
    10_000,
  );
  const cookie = /^set-cookie:\s*([A-Za-z0-9_]+)=/im.exec(r.body)?.[1];
  if (r.status !== 303 || !cookie) throw new Error(`the daemon refused the sign-in (HTTP ${r.status})`);
  return { port, token, cookie };
}

/** `POST /api/call` with a JSON body. */
export function post(host: PanelHost, ep: Endpoint, path: string, json: unknown, timeoutMs = 60_000): Promise<HttpResult> {
  const origin = `http://127.0.0.1:${ep.port}`;
  return curl(
    host,
    [
      ['url', `${origin}${path}`],
      ['request', 'POST'],
      ['header', 'Content-Type: application/json'],
      ['header', `Origin: ${origin}`],
      ['cookie', `${ep.cookie}=${ep.token}`],
      ['data-binary', JSON.stringify(json)],
    ],
    timeoutMs,
  );
}
