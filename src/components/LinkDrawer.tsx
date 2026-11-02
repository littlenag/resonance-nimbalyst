// What a link points to (FR-292): for code units, tests and document regions, the whole file
// with the linked lines highlighted; for spec items, the item, with a way to open it.

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { call } from '../api';
import { useNavigate } from '../nav';
import type { LinkView, ShowView } from '../types';
import { SPEC_TYPES } from '../types';
import { Alert, Badge, Button, Drawer, Loader } from '../ui';

export interface FileText {
  path: string;
  size: number;
  lines: number;
  text: string;
}

export function LinkDrawer({ link, onClose }: { link: LinkView; onClose: () => void }) {
  const other = link.other;
  return (
    <Drawer
      onClose={onClose}
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span className="rn-mono font-semibold">{other.label}</span>
          {other.type && <Badge variant="outline">{other.type}</Badge>}
          <Badge color={link.status === 'stale' ? 'orange' : 'gray'}>
            {link.relation}: {link.status}
          </Badge>
        </div>
      }
    >
      {other.id && <Target id={other.id} type={other.type} onClose={onClose} />}
    </Drawer>
  );
}

function Target({ id, type, onClose }: { id: string; type?: string; onClose: () => void }) {
  const navigate = useNavigate();
  const shown = useQuery({ queryKey: ['item', id, 'show'], queryFn: () => call<ShowView>('show', { ref: id }) });
  const isSpec = (SPEC_TYPES as string[]).includes(type ?? '');
  const loc = shown.data?.location;
  const path = loc?.path ?? (type === 'File' ? (shown.data?.node.label ?? null) : null);
  const file = useQuery({
    queryKey: ['file', path],
    queryFn: () => call<FileText>('file_text', { path }),
    enabled: !!path,
  });

  if (shown.isLoading) return <Loader />;
  if (shown.error) return <p className="rn-error-text">{(shown.error as Error).message}</p>;
  if (isSpec) {
    const ref = String(shown.data?.properties.key ?? id);
    return (
      <div className="flex flex-col gap-3">
        <div>{String(shown.data?.properties.text ?? shown.data?.properties.title ?? shown.data?.node.label ?? '')}</div>
        <div>
          <Button
            size="xs"
            rightIcon="arrow_forward"
            onClick={() => {
              onClose();
              navigate(`/spec/${encodeURIComponent(ref)}`);
            }}
          >
            Open {ref}
          </Button>
        </div>
      </div>
    );
  }
  if (!path) return <div className="rn-muted">This node has no place in a file to show.</div>;
  const orphaned = loc?.state && loc.state !== 'attached';
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="rn-mono">
          {path}
          {loc?.startLine ? `:${loc.startLine}${loc.endLine && loc.endLine !== loc.startLine ? `–${loc.endLine}` : ''}` : ''}
        </span>
        {loc && loc.confidence !== undefined && loc.confidence < 1 && (
          <Badge size="xs" color="yellow">
            confidence {Math.round(loc.confidence * 100)}%
          </Badge>
        )}
      </div>
      {orphaned && (
        <Alert color="orange" icon="warning">
          This region is {loc?.state}: Resonance could not find it in the file any more. The highlighted lines are where it
          was last seen.
        </Alert>
      )}
      {file.isLoading && <Loader />}
      {file.error && <p className="rn-error-text">{(file.error as Error).message}</p>}
      {file.data && <CodeView text={file.data.text} start={loc?.startLine} end={loc?.endLine} />}
    </div>
  );
}

/** A file with line numbers, the lines `start`–`end` (1-based, inclusive) highlighted and in view. */
export function CodeView({ text, start, end }: { text: string; start?: number; end?: number }) {
  const first = useRef<HTMLDivElement>(null);
  const lines = text.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const last = end ?? start;
  useEffect(() => {
    first.current?.scrollIntoView({ block: 'center' });
  }, [text, start]);
  const width = String(lines.length).length;
  return (
    <div className="rn-code-view" data-testid="code-view">
      {lines.map((line, i) => {
        const n = i + 1;
        const hit = start !== undefined && last !== undefined && n >= start && n <= last;
        return (
          <div
            key={n}
            ref={n === start ? first : undefined}
            className={hit ? 'rn-code-line rn-code-hit' : 'rn-code-line'}
            data-line={n}
            data-highlighted={hit || undefined}
          >
            <span className="rn-code-gutter">{String(n).padStart(width, ' ')}</span>
            <span>{line || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}
