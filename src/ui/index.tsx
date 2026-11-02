// The panel's widgets, in Nimbalyst's look (styles.css). They stand in for the Mantine
// components the web UI uses, with similar props so the pages port line for line.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import Markdown from 'react-markdown';

export type Color = 'primary' | 'green' | 'red' | 'orange' | 'blue' | 'violet' | 'gray';

/** The web UI's Mantine colors, mapped onto Nimbalyst's semantic ones. */
export function color(name: string | undefined): Color {
  switch (name) {
    case 'green':
    case 'teal':
      return 'green';
    case 'red':
      return 'red';
    case 'orange':
    case 'yellow':
      return 'orange';
    case 'blue':
    case 'cyan':
      return 'blue';
    case 'violet':
    case 'grape':
    case 'pink':
      return 'violet';
    case 'indigo':
    case 'primary':
      return 'primary';
    default:
      return 'gray';
  }
}

export function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(' ');
}

/** A Material Symbols icon, as Nimbalyst draws them. */
export function Icon({ name, size = 18, fill, style, className }: { name: string; size?: number; fill?: boolean; style?: CSSProperties; className?: string }) {
  return (
    <span
      className={cx('rn-icon', 'material-symbols-outlined', className)}
      style={{ fontSize: size, width: size, height: size, fontVariationSettings: fill ? "'FILL' 1" : undefined, ...style }}
      aria-hidden
    >
      {name}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'filled',
  color: c = 'primary',
  size = 'sm',
  icon,
  rightIcon,
  disabled,
  loading,
  title,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'filled' | 'light' | 'default' | 'subtle';
  color?: string;
  size?: 'xs' | 'sm';
  icon?: string;
  rightIcon?: string;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  type?: 'button' | 'submit';
}) {
  const iconSize = size === 'xs' ? 14 : 16;
  return (
    <button
      type={type}
      className={cx('rn-btn', `rn-btn-${variant}`, `rn-c-${color(c)}`, size === 'xs' && 'rn-btn-xs')}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
    >
      {loading ? <span className="rn-loader" style={{ width: iconSize, height: iconSize }} /> : icon && <Icon name={icon} size={iconSize} />}
      {children}
      {rightIcon && <Icon name={rightIcon} size={iconSize} />}
    </button>
  );
}

export function IconButton({ icon, label, onClick, size = 18 }: { icon: string; label: string; onClick: () => void; size?: number }) {
  return (
    <button type="button" className="rn-icon-btn" onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Badge({
  children,
  color: c,
  variant = 'light',
  size = 'sm',
  title,
  onClick,
  style,
}: {
  children: ReactNode;
  color?: string;
  variant?: 'light' | 'filled' | 'outline' | 'dot';
  size?: 'xs' | 'sm';
  title?: string;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cx('rn-badge', `rn-badge-${variant}`, `rn-c-${color(c)}`, size === 'xs' && 'rn-badge-xs', onClick && 'rn-badge-clickable')}
      title={title}
      onClick={onClick}
      style={style}
    >
      {children}
    </span>
  );
}

export function Alert({ color: c = 'blue', title, icon, children, className }: { color?: string; title?: ReactNode; icon?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cx('rn-alert', `rn-c-${color(c)}`, className)} role="alert">
      {icon && <Icon name={icon} size={18} className="rn-alert-icon" />}
      <div className="min-w-0 flex-1">
        {title && <div className="rn-alert-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Loader({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return <span className={cx('rn-loader', size === 'lg' && 'rn-loader-lg')} role="progressbar" aria-label="Loading" />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rn-kbd">{children}</kbd>;
}

export function Progress({ value, animated, label }: { value: number; animated?: boolean; label?: string }) {
  return (
    <div className={cx('rn-progress', animated && 'rn-progress-animated')} role="progressbar" aria-label={label} aria-valuenow={value}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="rn-section-label">{children}</div>;
}

export function MarkdownText({ children }: { children: string }) {
  return (
    <div className="rn-markdown">
      <Markdown>{children}</Markdown>
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  icon,
  label,
  description,
  size = 'sm',
  width,
  inputRef,
  onKeyDown,
  autoFocus,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: string;
  label?: string;
  description?: string;
  size?: 'xs' | 'sm';
  width?: number;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const input = (
    <input
      ref={inputRef}
      className={cx('rn-input', size === 'xs' && 'rn-input-xs')}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.currentTarget.value)}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
      aria-label={ariaLabel ?? label}
    />
  );
  return (
    <div style={{ width }}>
      {label && <label className="rn-label">{label}</label>}
      {icon ? (
        <div className="rn-input-wrap">
          <Icon name={icon} size={size === 'xs' ? 14 : 16} />
          {input}
        </div>
      ) : (
        input
      )}
      {description && <div className="rn-description">{description}</div>}
    </div>
  );
}

/** A textarea that grows with its text, between `minRows` and `maxRows`. */
export function Textarea({ value, onChange, minRows = 3, maxRows = 16, ariaLabel }: { value: string; onChange: (v: string) => void; minRows?: number; maxRows?: number; ariaLabel?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const line = parseFloat(getComputedStyle(el).lineHeight) || 19;
    el.style.height = 'auto';
    el.style.height = `${Math.min(maxRows * line, Math.max(minRows * line, el.scrollHeight)) + 2}px`;
  }, [value, minRows, maxRows]);
  return <textarea ref={ref} className="rn-textarea" value={value} onChange={(e) => onChange(e.currentTarget.value)} aria-label={ariaLabel} />;
}

export function Select({
  value,
  onChange,
  options,
  label,
  placeholder,
  size = 'sm',
  width,
  ariaLabel,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
  label?: string;
  /** Shown, and selectable as "none", when there is no value. */
  placeholder?: string;
  size?: 'xs' | 'sm';
  width?: number;
  ariaLabel?: string;
}) {
  return (
    <div style={{ width }}>
      {label && <label className="rn-label">{label}</label>}
      <select
        className={cx('rn-select', size === 'xs' && 'rn-select-xs')}
        value={value ?? ''}
        onChange={(e) => onChange(e.currentTarget.value || null)}
        aria-label={ariaLabel ?? label}
      >
        {(value === null || placeholder !== undefined) && <option value="">{placeholder ?? ''}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Checkbox({ checked, onChange, label, dim }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; dim?: boolean }) {
  return (
    <label className="rn-check" style={{ opacity: dim ? 0.5 : 1 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      {label}
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={cx('rn-switch', checked && 'rn-switch-on')}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span className="rn-switch-track" />
      {label}
    </label>
  );
}

export function SegmentedControl({ data, value, onChange, ariaLabel }: { data: string[]; value: string; onChange: (v: string) => void; ariaLabel?: string }) {
  return (
    <div className="rn-segmented" role="radiogroup" aria-label={ariaLabel}>
      {data.map((d) => (
        <button key={d} type="button" role="radio" aria-checked={d === value} className={cx(d === value && 'rn-active')} onClick={() => onChange(d)}>
          {d}
        </button>
      ))}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { value: string; label: ReactNode }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rn-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === value} className={cx('rn-tab', t.value === value && 'rn-active')} onClick={() => onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Closes `open` popovers on a click outside `ref`, or on Escape. */
function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key, true);
    };
  }, [ref, open, close]);
}

/** A button that opens a menu of items. */
export function Menu({ trigger, items }: { trigger: (open: () => void) => ReactNode; items: { label: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  return (
    <div ref={ref} className="relative inline-block">
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <div className="rn-menu" role="menu">
          {items.map((i) => (
            <button
              key={i.label}
              type="button"
              role="menuitem"
              className="rn-menu-item"
              onClick={() => {
                setOpen(false);
                i.onClick();
              }}
            >
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pick several values from a list, in a dropdown of checkboxes. */
export function MultiSelect({ data, value, onChange, placeholder, width, ariaLabel }: { data: string[]; value: string[]; onChange: (v: string[]) => void; placeholder: string; width?: number; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  return (
    <div ref={ref} className="relative" style={{ width }}>
      <button type="button" className="rn-select rn-select-xs flex items-center justify-between gap-1 text-left" onClick={() => setOpen((o) => !o)} aria-label={ariaLabel}>
        <span className={cx('truncate', value.length === 0 && 'rn-muted')}>{value.length ? value.join(', ') : placeholder}</span>
        <Icon name="expand_more" size={14} />
      </button>
      {open && (
        <div className="rn-menu" style={{ maxHeight: 280, overflow: 'auto', width: '100%' }}>
          {value.length > 0 && (
            <button type="button" className="rn-menu-item rn-muted" onClick={() => onChange([])}>
              Clear
            </button>
          )}
          {data.map((d) => (
            <div key={d} className="rn-menu-item">
              <Checkbox checked={value.includes(d)} onChange={(c) => onChange(c ? [...value, d] : value.filter((v) => v !== d))} label={d} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children, width = 560, onKeyDown }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: number; onKeyDown?: (e: React.KeyboardEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button.rn-btn-filled');
    (first ?? ref.current)?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="rn-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className="rn-dialog"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal
        tabIndex={-1}
        onKeyDown={(e) => {
          // Keys typed in a dialog never reach the page's shortcuts.
          e.stopPropagation();
          if (e.key === 'Escape') onClose();
          else onKeyDown?.(e);
        }}
      >
        <div className="rn-dialog-head">
          <span>{title}</span>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div className="rn-dialog-body">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="rn-drawer"
      role="dialog"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="rn-dialog-head">
        <div className="min-w-0">{title}</div>
        <IconButton icon="close" label="Close" onClick={onClose} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">{children}</div>
    </div>
  );
}

// Confirmation dialogs, opened imperatively as Mantine's `modals.openConfirmModal` is.

export interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setOpen({ ...o, resolve })), []);
  const done = (v: boolean) => {
    open?.resolve(v);
    setOpen(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open && (
        <Modal title={open.title} onClose={() => done(false)} width={440}>
          <div>{open.body}</div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="default" onClick={() => done(false)}>
              Cancel
            </Button>
            <Button color={open.danger ? 'red' : 'primary'} onClick={() => done(true)}>
              {open.confirmLabel}
            </Button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}
