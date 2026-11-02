// Finding the `resonance` command and this workspace's daemon, through PanelHost.exec.
// Everything goes through the CLI: the extension never reads .resonance/ itself.

import type { PanelHost } from '@nimbalyst/extension-sdk';

export const DEFAULT_BINARY = 'resonance';

/** What `resonance ui --no-open --json` reports. The key comes from its signed-in `url`. */
export interface DaemonInfo {
  root: string;
  address: string;
  port: number;
  token: string;
}

export type Status =
  | { kind: 'binary-missing'; tried: string[] }
  | { kind: 'not-a-repo' }
  | { kind: 'not-initialized' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; command: string; version: string; daemon: DaemonInfo };

/** Quote `s` as one POSIX shell word. */
export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * The binaries to try, as a shell word and a label. The configured value comes first; the
 * default also falls back to ~/.cargo/bin, which a Dock-launched app's PATH usually lacks.
 */
function candidates(configured: string): { word: string; label: string }[] {
  const value = configured.trim() || DEFAULT_BINARY;
  const list = [{ word: shellQuote(value), label: value }];
  if (value === DEFAULT_BINARY) list.push({ word: '"$HOME/.cargo/bin/resonance"', label: '~/.cargo/bin/resonance' });
  return list;
}

function notFound(r: { exitCode: number; stderr: string }): boolean {
  return r.exitCode === 127 || /not found|no such file/i.test(r.stderr);
}

function failure(r: { exitCode: number; stdout: string; stderr: string }): string {
  return (r.stderr || r.stdout).trim() || `exited with status ${r.exitCode}`;
}

// Exit codes of the preflight script below.
const NOT_A_REPO = 3;
const NOT_INITIALIZED = 4;
const PREFLIGHT =
  `top=$(git rev-parse --show-toplevel 2>/dev/null) || exit ${NOT_A_REPO}; ` +
  `test -d "$top/.resonance" || exit ${NOT_INITIALIZED}`;

/** Find the binary and the daemon, starting the daemon if needed. */
export async function check(host: PanelHost, configured: string): Promise<Status> {
  const tried = candidates(configured);
  let command: string | undefined;
  let version = '';
  for (const { word } of tried) {
    const r = await host.exec(`${word} --version`);
    if (r.exitCode === 0) {
      command = word;
      version = r.stdout.trim();
      break;
    }
    if (!notFound(r)) return { kind: 'error', message: failure(r) };
  }
  if (!command) return { kind: 'binary-missing', tried: tried.map((c) => c.label) };

  const pre = await host.exec(PREFLIGHT);
  if (pre.exitCode === NOT_A_REPO) return { kind: 'not-a-repo' };
  if (pre.exitCode === NOT_INITIALIZED) return { kind: 'not-initialized' };

  const r = await host.exec(`${command} ui --no-open --json`);
  if (r.exitCode !== 0) return { kind: 'error', message: failure(r) };
  try {
    const { root, address, port, url } = JSON.parse(r.stdout) as Omit<DaemonInfo, 'token'> & { url: string };
    const token = new URL(url).searchParams.get('token');
    if (!token) return { kind: 'error', message: '`resonance ui --json` gave no key' };
    return { kind: 'ready', command, version, daemon: { root, address, port, token } };
  } catch {
    return { kind: 'error', message: `could not read the output of \`resonance ui --json\`: ${r.stdout.trim()}` };
  }
}
