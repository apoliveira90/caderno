import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { breadcrumbs, duplicateBlock, insertBlock, makeBlock, removeBlock, updateBlock } from '../model/ops';
import { store, useWorkspace } from '../model/store';
import type { Block, ID } from '../model/types';
import { BlockList } from './BlockEditor';
import { DatabaseView, RowProperties } from './Database';
import { requestFocus } from './focus';
import { MenuList, Popover } from './Popover';
import { navigate } from './router';
import { exportMarkdown, download } from './exporters';

const EMOJIS = ['📄', '📝', '📌', '✅', '📅', '📊', '💡', '🚀', '🤝', '💰', '📦', '🏦', '⚖️', '🧾', '📈', '🗂️', '🔧', '🧪', '🎯', '⭐', '🔥', '📚', '🧠', '👋'];

export function PageView({ id }: { id: ID }) {
  const block = useWorkspace((ws) => ws.blocks[id]);
  const parent = useWorkspace((ws) => (block?.parent ? ws.blocks[block.parent] : undefined));
  const crumbs = useWorkspace((ws) => (block ? breadcrumbs(ws, id).join('/') : ''));

  if (!block || (block.type !== 'page' && block.type !== 'database')) {
    return (
      <div className="page-missing">
        <p>Esta página não existe mais.</p>
        <button type="button" className="primary" onClick={() => navigate(null)}>
          Voltar ao início
        </button>
      </div>
    );
  }
  const isRow = parent?.type === 'database';

  return (
    <div className={`page${block.type === 'database' ? ' full-db' : ''}`}>
      <PageTopBar block={block} crumbs={crumbs.split('/').filter(Boolean)} />
      <div className="page-inner">
        <PageHeader block={block} />
        {isRow && parent && <RowProperties row={block} db={parent} />}
        {block.type === 'database' ? (
          <DatabaseView dbId={block.id} />
        ) : (
          <>
            <BlockList ids={block.children} pageId={block.id} />
            <ClickToAppend page={block} />
          </>
        )}
      </div>
    </div>
  );
}

function PageTopBar({ block, crumbs }: { block: Block; crumbs: ID[] }) {
  const blocks = useWorkspace((ws) => ws.blocks);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(0);
  return (
    <div className="topbar">
      <nav className="crumbs" aria-label="Caminho">
        {crumbs.map((c, i) => (
          <span key={c} className="crumb">
            {i > 0 && <span className="sep">/</span>}
            <button type="button" onClick={() => navigate(c)}>
              {blocks[c]?.icon ? `${blocks[c].icon} ` : ''}
              {blocks[c]?.text || 'Sem título'}
            </button>
          </span>
        ))}
      </nav>
      <span className="saved" title="Alterações salvas neste navegador">
        Salvo localmente
      </span>
      <button type="button" className="ghost" aria-label="Mais opções" onClick={(e) => setMenu(e.currentTarget)}>
        ⋯
      </button>
      {menu && (
        <Popover anchor={menu} onClose={() => setMenu(null)} width={230}>
          <MenuList
            active={active}
            onHover={setActive}
            items={[
              {
                label: 'Duplicar',
                icon: '⧉',
                onSelect: () => {
                  const r = duplicateBlock(store.get(), block.id);
                  store.apply(() => r.ws);
                  setMenu(null);
                  navigate(r.id);
                },
              },
              {
                label: 'Exportar Markdown',
                icon: '⬇',
                onSelect: () => {
                  download(`${block.text || 'pagina'}.md`, exportMarkdown(store.get(), block.id), 'text/markdown');
                  setMenu(null);
                },
              },
              {
                label: 'Excluir página',
                icon: '🗑',
                danger: true,
                onSelect: () => {
                  if (!window.confirm(`Excluir "${block.text || 'Sem título'}" e todo o seu conteúdo?`)) return;
                  const parent = block.parent;
                  store.apply((ws) => removeBlock(ws, block.id));
                  setMenu(null);
                  navigate(parent && store.get().blocks[parent] ? parent : store.get().rootIds[0] ?? null);
                },
              },
            ]}
          />
        </Popover>
      )}
    </div>
  );
}

function PageHeader({ block }: { block: Block }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [picker, setPicker] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (ref.current && ref.current.textContent !== block.text) ref.current.textContent = block.text;
  }, [block.text]);

  useEffect(() => {
    // A brand-new empty page starts with the caret in its title.
    if (!block.text && ref.current) ref.current.focus();
  }, [block.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-header">
      <div className="page-icon-row">
        <button type="button" className={`page-icon${block.icon ? '' : ' empty'}`} onClick={(e) => setPicker(e.currentTarget)}>
          {block.icon ?? '＋ Ícone'}
        </button>
      </div>
      <h1
        ref={ref}
        className="page-title"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Sem título"
        onInput={() => store.apply((ws) => updateBlock(ws, block.id, { text: (ref.current?.textContent ?? '').replace(/\n/g, ' ') }), `title-${block.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || (e.key === 'ArrowDown' && block.type === 'page')) {
            e.preventDefault();
            if (block.type !== 'page') return;
            const first = store.get().blocks[block.children[0]];
            if (first && first.type !== 'page' && first.type !== 'database' && first.type !== 'divider' && e.key === 'ArrowDown') {
              requestFocus(first.id, 'start');
              return;
            }
            const fresh = makeBlock('text');
            store.apply((ws) => insertBlock(ws, fresh, block.id, 0));
            requestFocus(fresh.id, 'start');
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' '));
        }}
      />
      {picker && (
        <Popover anchor={picker} onClose={() => setPicker(null)} width={268}>
          <div className="emoji-grid">
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => {
                  store.apply((ws) => updateBlock(ws, block.id, { icon: em }));
                  setPicker(null);
                }}
              >
                {em}
              </button>
            ))}
          </div>
          {block.icon && (
            <button
              type="button"
              className="ghost full"
              onClick={() => {
                store.apply((ws) => updateBlock(ws, block.id, { icon: undefined }));
                setPicker(null);
              }}
            >
              Remover ícone
            </button>
          )}
        </Popover>
      )}
    </div>
  );
}

/** Clicking below the last block focuses it, or adds an empty line. */
function ClickToAppend({ page }: { page: Block }) {
  return (
    <div
      className="page-tail"
      onMouseDown={(e) => {
        e.preventDefault();
        const ws = store.get();
        const lastId = page.children[page.children.length - 1];
        const last = ws.blocks[lastId];
        if (last && last.type === 'text' && last.text === '' && last.children.length === 0) {
          requestFocus(last.id, 'end');
          return;
        }
        const fresh = makeBlock('text');
        store.apply((w) => insertBlock(w, fresh, page.id));
        requestFocus(fresh.id, 'start');
      }}
    />
  );
}
