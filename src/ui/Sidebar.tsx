import { useRef, useState } from 'react';
import { createDatabase, createPage, duplicateBlock, isContainer, moveBlock, removeBlock } from '../model/ops';
import { buildSeed } from '../model/seed';
import { isWorkspace, store, useWorkspace } from '../model/store';
import type { Block, ID } from '../model/types';
import { download } from './exporters';
import { MenuList, Popover } from './Popover';
import { navigate } from './router';

const EXPANDED_KEY = 'caderno.sidebar.expanded';

function loadExpanded(): Set<ID> {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

let draggingPage: ID | null = null;

export function Sidebar({ current, onSearch, open, onClose }: { current: ID | null; onSearch: () => void; open: boolean; onClose: () => void }) {
  const rootIds = useWorkspace((ws) => ws.rootIds);
  const blocks = useWorkspace((ws) => ws.blocks);
  const [expanded, setExpanded] = useState<Set<ID>>(loadExpanded);
  const fileRef = useRef<HTMLInputElement>(null);
  const [rootDrop, setRootDrop] = useState(false);

  const toggle = (id: ID, force?: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const on = force ?? !next.has(id);
      if (on) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
      } catch {
        // Expansion state is a convenience only.
      }
      return next;
    });
  };

  const newPage = (parent: ID | null) => {
    const r = createPage(store.get(), parent);
    store.apply(() => r.ws);
    if (parent) toggle(parent, true);
    navigate(r.id);
    onClose();
  };

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-head">
        <span className="ws-badge">C</span>
        <span className="ws-name">Caderno</span>
        <button type="button" className="ghost sidebar-close" aria-label="Fechar menu" onClick={onClose}>
          ×
        </button>
      </div>
      <button type="button" className="side-action" onClick={onSearch}>
        <span>🔍</span> Buscar <kbd>Ctrl K</kbd>
      </button>
      <button type="button" className="side-action" onClick={() => newPage(null)}>
        <span>＋</span> Nova página
      </button>

      <div
        className={`side-section${rootDrop ? ' drop' : ''}`}
        onDragOver={(e) => {
          if (!draggingPage) return;
          e.preventDefault();
          setRootDrop(true);
        }}
        onDragLeave={() => setRootDrop(false)}
        onDrop={(e) => {
          e.preventDefault();
          setRootDrop(false);
          if (draggingPage) store.apply((ws) => moveBlock(ws, draggingPage!, null));
          draggingPage = null;
        }}
      >
        <div className="side-label">Páginas</div>
        {rootIds.map((id) => (
          <TreeItem key={id} id={id} depth={0} blocks={blocks} current={current} expanded={expanded} toggle={toggle} onNewChild={newPage} onNavigate={onClose} />
        ))}
      </div>

      <div className="side-foot">
        <button
          type="button"
          className="side-action"
          onClick={() => {
            const r = createDatabase(store.get(), null, 'Novo banco de dados');
            store.apply(() => r.ws);
            navigate(r.id);
            onClose();
          }}
        >
          <span>▦</span> Novo banco de dados
        </button>
        <button type="button" className="side-action" onClick={() => download(`caderno-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.get(), null, 2), 'application/json')}>
          <span>⬇</span> Exportar backup
        </button>
        <button type="button" className="side-action" onClick={() => fileRef.current?.click()}>
          <span>⬆</span> Importar backup
        </button>
        <button
          type="button"
          className="side-action muted"
          onClick={() => {
            if (window.confirm('Substituir tudo pelo conteúdo de exemplo? Exporte um backup antes se quiser guardar o atual.')) {
              store.replace(buildSeed());
              navigate(store.get().rootIds[0] ?? null);
            }
          }}
        >
          <span>↺</span> Restaurar exemplo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const data = JSON.parse(await file.text());
              if (!isWorkspace(data)) throw new Error('formato');
              if (!window.confirm('Importar este backup substitui o conteúdo atual. Continuar?')) return;
              store.replace(data);
              navigate(data.rootIds[0] ?? null);
            } catch {
              window.alert('Arquivo inválido: escolha um backup exportado pelo Caderno.');
            }
          }}
        />
      </div>
    </aside>
  );
}

interface TreeProps {
  id: ID;
  depth: number;
  blocks: Record<ID, Block>;
  current: ID | null;
  expanded: Set<ID>;
  toggle: (id: ID, force?: boolean) => void;
  onNewChild: (parent: ID) => void;
  onNavigate: () => void;
}

/** Sub-documents nested anywhere in a page's content (not database rows). */
function subDocs(blocks: Record<ID, Block>, id: ID): ID[] {
  const b = blocks[id];
  if (!b || b.type === 'database') return [];
  const out: ID[] = [];
  const walk = (ids: ID[]) => {
    for (const c of ids) {
      const cb = blocks[c];
      if (!cb) continue;
      if (isContainer(cb)) out.push(c);
      else walk(cb.children);
    }
  };
  walk(b.children);
  return out;
}

function TreeItem({ id, depth, blocks, current, expanded, toggle, onNewChild, onNavigate }: TreeProps) {
  const b = blocks[id];
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(0);
  const [drop, setDrop] = useState(false);
  if (!b) return null;
  const kids = subDocs(blocks, id);
  const isOpen = expanded.has(id);

  return (
    <div className="tree-item">
      <div
        className={`tree-row${current === id ? ' current' : ''}${drop ? ' drop' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        draggable
        onDragStart={(e) => {
          draggingPage = id;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', b.text);
          e.stopPropagation();
        }}
        onDragEnd={() => (draggingPage = null)}
        onDragOver={(e) => {
          if (!draggingPage || draggingPage === id || b.type === 'database') return;
          e.preventDefault();
          e.stopPropagation();
          setDrop(true);
        }}
        onDragLeave={() => setDrop(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDrop(false);
          const dragged = draggingPage;
          draggingPage = null;
          if (!dragged || dragged === id) return;
          store.apply((ws) => moveBlock(ws, dragged, id));
          toggle(id, true);
        }}
      >
        <button
          type="button"
          className={`tree-caret${isOpen ? ' open' : ''}${kids.length ? '' : ' leaf'}`}
          aria-label={isOpen ? 'Recolher' : 'Expandir'}
          onClick={() => toggle(id)}
        >
          ▶
        </button>
        <button
          type="button"
          className="tree-link"
          onClick={() => {
            navigate(id);
            onNavigate();
          }}
        >
          <span className="tree-icon">{b.icon ?? (b.type === 'database' ? '▦' : '📄')}</span>
          <span className="tree-title">{b.text || 'Sem título'}</span>
        </button>
        <button type="button" className="tree-more" aria-label="Opções" onClick={(e) => setMenu(e.currentTarget)}>
          ⋯
        </button>
        {b.type === 'page' && (
          <button type="button" className="tree-more" aria-label="Adicionar sub-página" onClick={() => onNewChild(id)}>
            +
          </button>
        )}
      </div>
      {isOpen && (
        <div className="tree-children">
          {kids.length ? (
            kids.map((k) => <TreeItem key={k} id={k} depth={depth + 1} blocks={blocks} current={current} expanded={expanded} toggle={toggle} onNewChild={onNewChild} onNavigate={onNavigate} />)
          ) : (
            <div className="tree-empty" style={{ paddingLeft: 26 + depth * 14 }}>
              {b.type === 'database' ? 'Abra para ver os registros' : 'Sem páginas dentro'}
            </div>
          )}
        </div>
      )}
      {menu && (
        <Popover anchor={menu} onClose={() => setMenu(null)} width={200}>
          <MenuList
            active={active}
            onHover={setActive}
            items={[
              {
                label: 'Duplicar',
                icon: '⧉',
                onSelect: () => {
                  store.apply((ws) => duplicateBlock(ws, id).ws);
                  setMenu(null);
                },
              },
              ...(b.parent
                ? [
                    {
                      label: 'Mover para a raiz',
                      icon: '⇱',
                      onSelect: () => {
                        store.apply((ws) => moveBlock(ws, id, null));
                        setMenu(null);
                      },
                    },
                  ]
                : []),
              {
                label: 'Excluir',
                icon: '🗑',
                danger: true,
                onSelect: () => {
                  if (!window.confirm(`Excluir "${b.text || 'Sem título'}" e todo o seu conteúdo?`)) return;
                  store.apply((ws) => removeBlock(ws, id));
                  setMenu(null);
                  if (current === id) navigate(store.get().rootIds[0] ?? null);
                },
              },
            ]}
          />
        </Popover>
      )}
    </div>
  );
}
