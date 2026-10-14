import { useSyncExternalStore } from 'react';
import type { Workspace } from './types';
import { applyPendingImports } from './imports/automacoes';
import { buildSeed } from './seed';

const STORAGE_KEY = 'caderno.workspace.v1';
const HISTORY_LIMIT = 200;
const COALESCE_MS = 800;

type Listener = () => void;

export function isWorkspace(x: unknown): x is Workspace {
  const w = x as Workspace;
  return !!w && w.version === 1 && Array.isArray(w.rootIds) && typeof w.blocks === 'object' && w.blocks !== null;
}

function load(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isWorkspace(parsed)) return applyPendingImports(parsed);
    }
  } catch {
    // Storage blocked or corrupt: start from the seed below.
  }
  return buildSeed();
}

export class Store {
  private state: Workspace;
  private past: Workspace[] = [];
  private future: Workspace[] = [];
  private listeners = new Set<Listener>();
  private lastKey: string | null = null;
  private lastAt = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(initial?: Workspace, private persist = true) {
    this.state = initial ?? load();
  }

  get = (): Workspace => this.state;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  /**
   * Applies a change. Edits sharing a `coalesce` key within a short window
   * (typing in one block) collapse into a single undo step.
   */
  apply(fn: (ws: Workspace) => Workspace, coalesce?: string): void {
    const next = fn(this.state);
    if (next === this.state) return;
    const t = Date.now();
    const merge = coalesce !== undefined && coalesce === this.lastKey && t - this.lastAt < COALESCE_MS;
    if (!merge) {
      this.past.push(this.state);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
    }
    this.future = [];
    this.lastKey = coalesce ?? null;
    this.lastAt = t;
    this.set(next);
  }

  undo(): boolean {
    const prev = this.past.pop();
    if (!prev) return false;
    this.future.push(this.state);
    this.lastKey = null;
    this.set(prev);
    return true;
  }

  redo(): boolean {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(this.state);
    this.lastKey = null;
    this.set(next);
    return true;
  }

  replace(ws: Workspace): void {
    this.past.push(this.state);
    this.future = [];
    this.lastKey = null;
    this.set(ws);
  }

  private set(ws: Workspace): void {
    this.state = ws;
    this.scheduleSave();
    for (const l of this.listeners) l();
  }

  private scheduleSave(): void {
    if (!this.persist) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 250);
  }

  flush(): void {
    if (!this.persist) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Quota exceeded or storage unavailable; the session keeps working in memory.
    }
  }
}

export const store = new Store();

if (typeof window !== 'undefined') window.addEventListener('beforeunload', () => store.flush());

export function useWorkspace<T>(select: (ws: Workspace) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
