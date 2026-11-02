// A long, growing list (the activity timeline, the log), virtualized, that follows new rows
// unless the person scrolls up or pauses it.

import { useEffect, useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export function StreamList<T>({
  items,
  render,
  follow,
  estimate = 24,
}: {
  items: T[];
  render: (item: T) => ReactNode;
  follow: boolean;
  estimate?: number;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parent.current,
    estimateSize: () => estimate,
    overscan: 20,
  });
  useEffect(() => {
    if (!follow || items.length === 0) return;
    // After the rows are measured, so that the end really is the end.
    const frame = requestAnimationFrame(() => virtualizer.scrollToIndex(items.length - 1, { align: 'end' }));
    return () => cancelAnimationFrame(frame);
  }, [follow, items.length, virtualizer]);
  return (
    <div ref={parent} className="rn-stream min-h-0 flex-1">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className="rn-stream-row"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start}px)` }}
          >
            {render(items[row.index])}
          </div>
        ))}
      </div>
    </div>
  );
}
