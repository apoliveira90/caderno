import { useSyncExternalStore } from 'react';

function current(): string | null {
  const m = /^#\/p\/([\w-]+)/.exec(window.location.hash);
  return m ? m[1] : null;
}

function subscribe(l: () => void): () => void {
  window.addEventListener('hashchange', l);
  return () => window.removeEventListener('hashchange', l);
}

export function useRoute(): string | null {
  return useSyncExternalStore(subscribe, current);
}

export function navigate(id: string | null): void {
  window.location.hash = id ? `#/p/${id}` : '#/';
}
