import { useEffect, useRef, useSyncExternalStore } from 'react';

// In-page replacement for window.confirm/alert, which embedded viewers block.

interface Request {
  message: string;
  confirmLabel: string;
  danger: boolean;
  alertOnly: boolean;
  resolve: (ok: boolean) => void;
}

let current: Request | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function open(req: Omit<Request, 'resolve'>): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { ...req, resolve };
    emit();
  });
}

export function confirmAction(message: string, confirmLabel = 'Excluir', danger = true): Promise<boolean> {
  return open({ message, confirmLabel, danger, alertOnly: false });
}

export function notify(message: string): Promise<boolean> {
  return open({ message, confirmLabel: 'OK', danger: false, alertOnly: true });
}

function close(ok: boolean) {
  const req = current;
  current = null;
  emit();
  req?.resolve(ok);
}

export function ConfirmHost() {
  const req = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!req) return;
    okRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(false);
      }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [req]);
  if (!req) return null;
  return (
    <div className="overlay" onMouseDown={() => close(false)}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-label={req.message} onMouseDown={(e) => e.stopPropagation()}>
        <p>{req.message}</p>
        <div className="confirm-actions">
          {!req.alertOnly && (
            <button type="button" className="ghost" onClick={() => close(false)}>
              Cancelar
            </button>
          )}
          <button ref={okRef} type="button" className={req.danger ? 'primary danger-fill' : 'primary'} onClick={() => close(true)}>
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
