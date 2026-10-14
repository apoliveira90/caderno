import { useMemo, useState } from 'react';
import { searchWorkspace } from '../model/query';
import { useWorkspace } from '../model/store';
import { navigate } from './router';

export function SearchDialog({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace((w) => w);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const hits = useMemo(() => searchWorkspace(ws, q), [ws, q]);

  const go = (id: string) => {
    navigate(id);
    onClose();
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="search" role="dialog" aria-label="Buscar" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="search-input"
          placeholder="Buscar páginas e conteúdo…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && hits[active]) go(hits[active].id);
            else if (e.key === 'Escape') onClose();
          }}
        />
        <div className="search-results">
          {hits.length === 0 && <div className="menu-empty">Nada encontrado</div>}
          {hits.map((h, i) => (
            <button key={h.id} type="button" className={`search-hit${i === active ? ' active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => go(h.id)}>
              <span className="tree-icon">{ws.blocks[h.id]?.icon ?? (ws.blocks[h.id]?.type === 'database' ? '▦' : '📄')}</span>
              <span className="search-text">
                <span className="search-title">{h.title}</span>
                {h.snippet && <span className="search-snippet">{h.snippet}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
