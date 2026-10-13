import { useEffect, useState } from 'react';
import { store, useWorkspace } from '../model/store';
import { PageView } from './PageView';
import { navigate, useRoute } from './router';
import { SearchDialog } from './Search';
import { Sidebar } from './Sidebar';

export function App() {
  const route = useRoute();
  const firstRoot = useWorkspace((ws) => ws.rootIds[0] ?? null);
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!route && firstRoot) navigate(firstRoot);
  }, [route, firstRoot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearching((s) => !s);
        return;
      }
      const target = e.target as HTMLElement;
      // Inputs keep their native undo; blocks and the rest use the workspace history.
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        store.redo();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="app">
      <Sidebar current={route} onSearch={() => setSearching(true)} open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <main className="main">
        <button type="button" className="menu-toggle" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
          ☰
        </button>
        {route ? (
          <PageView key={route} id={route} />
        ) : (
          <div className="page-missing">
            <p>Nenhuma página ainda.</p>
          </div>
        )}
      </main>
      {searching && <SearchDialog onClose={() => setSearching(false)} />}
    </div>
  );
}
