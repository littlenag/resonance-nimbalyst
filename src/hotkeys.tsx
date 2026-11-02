// Keyboard shortcuts, as Mantine's useHotkeys, but only while focus is inside the panel:
// Nimbalyst owns the rest of the window, so the panel never listens on the document.

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

type Handler = (e: KeyboardEvent) => void;
type Registry = Set<{ current: [string, Handler][] }>;

const HotkeyContext = createContext<Registry | null>(null);

/** The key an event names: letters and digits by position, so shift+D is "d" and shift+/ is "/". */
function keyOf(e: KeyboardEvent): string {
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  if (e.code === 'Slash') return '/';
  return e.key.toLowerCase();
}

function matches(spec: string, e: KeyboardEvent): boolean {
  const parts = spec.toLowerCase().split('+');
  const key = parts.pop();
  const mods = new Set(parts);
  const mod = mods.has('mod');
  return (
    key === keyOf(e) &&
    e.shiftKey === mods.has('shift') &&
    e.altKey === mods.has('alt') &&
    (mod ? e.metaKey || e.ctrlKey : e.metaKey === mods.has('meta') && e.ctrlKey === mods.has('ctrl'))
  );
}

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Wrap the panel. Its root must be focusable, so that keys typed in it reach these handlers. */
export function HotkeyScope({ children, className }: { children: ReactNode; className?: string }) {
  const registry = useRef<Registry>(new Set()).current;
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.focus();
  }, []);
  return (
    <HotkeyContext.Provider value={registry}>
      <div
        ref={root}
        className={className}
        tabIndex={-1}
        onKeyDown={(e) => {
          const native = e.nativeEvent;
          for (const entry of registry) {
            for (const [spec, handler] of entry.current) {
              const withMod = /mod\+|ctrl\+|meta\+/i.test(spec);
              if (typing(native.target) && !withMod) continue;
              if (matches(spec, native)) {
                e.preventDefault();
                e.stopPropagation();
                handler(native);
                return;
              }
            }
          }
        }}
      >
        {children}
      </div>
    </HotkeyContext.Provider>
  );
}

export function useHotkeys(keys: [string, Handler][]) {
  const registry = useContext(HotkeyContext);
  const ref = useRef(keys);
  ref.current = keys;
  useEffect(() => {
    if (!registry) return;
    registry.add(ref);
    return () => {
      registry.delete(ref);
    };
  }, [registry]);
}
