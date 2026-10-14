import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  anchor: DOMRect | HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  className?: string;
}

/** Floating panel next to an anchor; closes on outside click or Escape. */
export function Popover({ anchor, onClose, children, width = 260, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const r = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : anchor;
    const h = ref.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = r.bottom + 4;
    if (top + h > vh - 8 && r.top - h - 4 > 8) top = r.top - h - 4;
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    setPos({ top: top + window.scrollY, left: left + window.scrollX });
  }, [anchor, width]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    // Defer so the click that opened the popover does not close it.
    const t = setTimeout(() => document.addEventListener('mousedown', down), 0);
    document.addEventListener('keydown', key, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key, true);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className={`popover ${className}`} style={{ top: pos.top, left: pos.left, width }} role="dialog">
      {children}
    </div>,
    document.body,
  );
}

export interface MenuItem {
  label: string;
  hint?: string;
  icon?: string;
  danger?: boolean;
  onSelect: () => void | Promise<void>;
}

/** Keyboard-navigable list used by the slash menu and context menus. */
export function MenuList({ items, active, onHover }: { items: MenuItem[]; active: number; onHover: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  if (!items.length) return <div className="menu-empty">Nenhum resultado</div>;
  return (
    <div className="menu" ref={ref}>
      {items.map((it, i) => (
        <button
          key={it.label}
          data-i={i}
          type="button"
          className={`menu-item${i === active ? ' active' : ''}${it.danger ? ' danger' : ''}`}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            void it.onSelect();
          }}
        >
          {it.icon !== undefined && <span className="menu-icon">{it.icon}</span>}
          <span className="menu-label">{it.label}</span>
          {it.hint && <span className="menu-hint">{it.hint}</span>}
        </button>
      ))}
    </div>
  );
}
