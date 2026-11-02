// What each spec type records (§6.2, docs/concepts.md). The spec page, the item
// detail and the add form all read this, so the wording stays in one place.

import type { SpecType } from './types';

export interface SpecTypeDoc {
  /** What this type records. */
  captures: string;
  /** Usual key shape. */
  keys: string;
  /** Fields a person edits. */
  fields: string;
  /** How the type sits in the graph. */
  graph: string;
}

export const SPEC_TYPE_GUIDE: Record<SpecType, SpecTypeDoc> = {
  Requirement: {
    captures: 'What the software must do: a statement of required behavior or quality.',
    keys: 'FR-042 (functional), NFR- (non-functional).',
    fields: 'text, kind, and status (draft, active, superseded, retired).',
    graph: 'Code satisfies it. Tests verify it.',
  },
  Decision: {
    captures: 'A recorded choice and its rationale, in the shape of an architecture decision record.',
    keys: 'ADR-0007.',
    fields: 'title, decision, context, consequences, and status (proposed, accepted, superseded, deprecated, retired).',
    graph: 'It constrains whatever the choice limits.',
  },
  Design: {
    captures: 'How something is shaped: a component, an interface, or a flow.',
    keys: 'DES-3.',
    fields: 'title, text, and status.',
    graph: 'Code realizes it. A design can refine a requirement.',
  },
  Constraint: {
    captures: 'A rule the work must obey, such as performance, compatibility, or policy, and the scope where it applies.',
    keys: 'CON-001.',
    fields: 'title, text, scope, and status.',
    graph: 'It constrains the requirement, decision, code, test, or file it applies to.',
  },
};
