// Shapes of the daemon's answers, as the web UI uses them. The server is the reference.

export type SpecType = 'Requirement' | 'Decision' | 'Design' | 'Constraint';

export const SPEC_TYPES: SpecType[] = ['Requirement', 'Decision', 'Design', 'Constraint'];

export interface PendingChange {
  seq: number;
  kind: string;
  fields: string[];
  origin: string;
}

export interface SpecItem {
  id: string;
  type: SpecType;
  key: string | null;
  title: string;
  text: string;
  status: string;
  kind: string | null;
  source: { path?: string; line?: number } | null;
  props: Record<string, unknown>;
  pendingChange?: PendingChange;
  links: number;
  staleLinks: number;
}

export interface LinkView {
  id?: string;
  type?: string;
  relation: string;
  status: string;
  other: { label?: string; type?: string; id?: string; status?: string };
  latestEvidence?: { result?: string; timestamp?: string } | null;
}

export interface ShowView {
  node: { label?: string; type?: string; status?: string; id?: string };
  properties: Record<string, unknown>;
  links: LinkView[];
  annotations: { kind?: string; text?: string; author?: string }[];
  /** Where a code unit, test or document region is (absent for spec items). */
  location?: { path: string; startLine?: number; endLine?: number; state?: string; confidence?: number };
}

export interface ChangeEntry {
  seq: number;
  at: string;
  actor: string;
  item: { id: string; key: string | null; title: string; type: string };
  kind: string;
  fields: string[];
  summary: string;
  origin: string;
  opIds: string[];
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface Status {
  root: string;
  stage: string;
  participation: string;
  schemaVersion: number;
  lastReconcile: string | null;
  counts: {
    files: number;
    requirements: number;
    requirementsRetired: number;
    decisions: number;
    codeUnits: number;
    tests: number;
    annotations: number;
    evidence: number;
    links: Record<string, number>;
  };
  repair: unknown[];
  history: {
    openDelta: string | null;
    openOperations: number;
    openFiles: number;
    sealed: number;
    detached: string[];
    skipped: number;
    snapshot: boolean;
  };
  divergences: unknown[];
  pendingChanges: number;
}

export interface Session {
  actor: string;
  root: string;
  repository: string;
  branch: string | null;
  ui: string | null;
  bundled: boolean;
}

export interface Health {
  state: string;
  ready: boolean;
  pid: number;
  root: string;
  endpoint: string;
  version: string;
  startedAt: string;
  ingestWatermark: number;
  eventsReceived: number;
  pendingEvents: number;
  lagMs: number;
  lastIngest: string | null;
  lastError: string | null;
  connections: number;
  subscribers: number;
  requestsServed: number;
  ui?: string | null;
}

export interface DiagEvent {
  seq: number;
  at: string;
  kind: string;
  summary: string;
  fields: Record<string, unknown>;
}

export interface LogRecord {
  seq: number;
  at: string;
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  component: string;
  message: string;
  fields?: Record<string, unknown>;
}

export interface MethodCounter {
  method: string;
  count: number;
  errors: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  totalMs: number;
}

export interface DiagClient {
  id: number;
  kind: string;
  actor: string | null;
  connectedAt: string;
  requests: number;
}

export interface ConfigSource {
  key: string;
  value: unknown;
  source: 'default' | 'file' | 'env';
}

export interface Diagnostics {
  identity: {
    pid: number;
    version: string;
    binaryId: string;
    schemaVersion: number;
    startedAt: string;
    uptimeSeconds: number;
    root: string;
    endpoint: string;
    ui: string | null;
  };
  health: Health;
  config: ConfigSource[];
  log: { level: string; file: string };
  events: DiagEvent[];
  oldestSeq: number | null;
  lastSeq: number;
  dropped: number;
  capacity: number;
  counters: { methods: MethodCounter[]; events: Record<string, number> };
  clients: DiagClient[];
}

export interface Logs {
  records: LogRecord[];
  oldestSeq: number | null;
  lastSeq: number;
  dropped: number;
  level: string;
  file: string;
}
