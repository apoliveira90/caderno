import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { detectShortcut } from '../model/markdown';
import {
  childrenOf,
  convertBlock,
  createDatabase,
  createPage,
  duplicateBlock,
  indentBlock,
  insertAfter,
  insertBlock,
  isContainer,
  isTextual,
  makeBlock,
  mergeWithPrevious,
  moveBlock,
  outdentBlock,
  removeBlock,
  splitBlock,
  updateBlock,
  visibleOrder,
} from '../model/ops';
import { store, useWorkspace } from '../model/store';
import type { Block, BlockType, ID, Workspace } from '../model/types';
import { confirmAction } from './Confirm';
import { DatabaseView } from './Database';
import { caretOnEdgeLine, getCaret, hasSelection, onFocusRequest, requestFocus, setCaret, takeFocus } from './focus';
import { MenuList, Popover, type MenuItem } from './Popover';
import { navigate } from './router';

interface SlashCommand {
  label: string;
  icon: string;
  keys: string;
  type: BlockType | 'subpage' | 'inline-db';
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { label: 'Texto', icon: 'Aa', keys: 'texto text paragrafo', type: 'text' },
  { label: 'Título 1', icon: 'H1', keys: 'titulo 1 h1 heading', type: 'h1' },
  { label: 'Título 2', icon: 'H2', keys: 'titulo 2 h2 heading', type: 'h2' },
  { label: 'Título 3', icon: 'H3', keys: 'titulo 3 h3 heading', type: 'h3' },
  { label: 'Lista de tarefas', icon: '☑', keys: 'tarefa todo checkbox lista', type: 'todo' },
  { label: 'Lista com marcadores', icon: '•', keys: 'lista marcadores bullet', type: 'bullet' },
  { label: 'Lista numerada', icon: '1.', keys: 'lista numerada numbered', type: 'numbered' },
  { label: 'Toggle', icon: '▸', keys: 'toggle recolher sanfona', type: 'toggle' },
  { label: 'Citação', icon: '❝', keys: 'citacao quote', type: 'quote' },
  { label: 'Destaque', icon: '💡', keys: 'destaque callout aviso', type: 'callout' },
  { label: 'Código', icon: '</>', keys: 'codigo code', type: 'code' },
  { label: 'Divisor', icon: '—', keys: 'divisor divider linha', type: 'divider' },
  { label: 'Página', icon: '📄', keys: 'pagina page subpagina', type: 'subpage' },
  { label: 'Banco de dados', icon: '▦', keys: 'banco dados database tabela quadro', type: 'inline-db' },
];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterCommands(query: string): SlashCommand[] {
  const q = fold(query.trim());
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => fold(c.label).includes(q) || c.keys.split(' ').some((k) => k.startsWith(q)));
}

const PLACEHOLDER: Partial<Record<BlockType, string>> = {
  h1: 'Título 1',
  h2: 'Título 2',
  h3: 'Título 3',
  todo: 'Tarefa',
  bullet: 'Lista',
  numbered: 'Lista',
  toggle: 'Toggle',
  quote: 'Citação',
  callout: 'Destaque',
  code: 'Código',
};

let draggingId: ID | null = null;

export function BlockList({ ids, pageId }: { ids: ID[]; pageId: ID }) {
  const blocks = useWorkspace((ws) => ws.blocks);
  let n = 0;
  return (
    <div className="block-list">
      {ids.map((id) => {
        const b = blocks[id];
        if (!b) return null;
        n = b.type === 'numbered' ? n + 1 : 0;
        return <BlockRow key={id} block={b} pageId={pageId} number={n} />;
      })}
    </div>
  );
}

function focusNeighbor(ws: Workspace, pageId: ID, id: ID, dir: -1 | 1, at: 'start' | 'end'): boolean {
  const order = visibleOrder(ws, pageId);
  for (let i = order.indexOf(id) + dir; i >= 0 && i < order.length; i += dir) {
    const b = ws.blocks[order[i]];
    if (b && isTextual(b.type)) {
      requestFocus(b.id, at);
      return true;
    }
  }
  return false;
}

function BlockRow({ block, pageId, number }: { block: Block; pageId: ID; number: number }) {
  const [drop, setDrop] = useState<'before' | 'after' | null>(null);
  const [menu, setMenu] = useState<HTMLElement | null>(null);

  const onDragOver = (e: DragEvent) => {
    if (!draggingId || draggingId === block.id) return;
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDrop(e.clientY < r.top + Math.min(r.height / 2, 16) ? 'before' : 'after');
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dragged = draggingId;
    const where = drop;
    setDrop(null);
    draggingId = null;
    if (!dragged || dragged === block.id) return;
    store.apply((ws) => {
      const without = childrenOf(ws, block.parent).filter((c) => c !== dragged);
      const index = without.indexOf(block.id) + (where === 'after' ? 1 : 0);
      return moveBlock(ws, dragged, block.parent, index);
    });
  };

  const body = renderBody(block, pageId, number);
  const showChildren = isTextual(block.type) && block.children.length > 0 && !(block.type === 'toggle' && block.collapsed);

  return (
    <div
      className={`block-row type-${block.type}${drop ? ` drop-${drop}` : ''}`}
      data-block={block.id}
      onDragOver={onDragOver}
      onDragLeave={() => setDrop(null)}
      onDrop={onDrop}
    >
      <div className="block-line">
        <div className="block-gutter">
          <button
            type="button"
            className="block-add"
            title="Adicionar bloco abaixo"
            onClick={() => {
              const fresh = makeBlock('text');
              store.apply((ws) => insertAfter(ws, fresh, block.id));
              requestFocus(fresh.id, 'start');
            }}
          >
            +
          </button>
          <button
            type="button"
            className="block-handle"
            title="Arraste para mover · clique para opções"
            draggable
            onDragStart={(e) => {
              draggingId = block.id;
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', block.text);
              const row = (e.currentTarget as HTMLElement).closest('.block-row');
              if (row) e.dataTransfer.setDragImage(row, 0, 0);
            }}
            onDragEnd={() => (draggingId = null)}
            onClick={(e) => setMenu(e.currentTarget)}
          >
            ⋮⋮
          </button>
        </div>
        {body}
      </div>
      {showChildren && (
        <div className="block-children">
          <BlockList ids={block.children} pageId={pageId} />
        </div>
      )}
      {menu && <BlockMenu block={block} anchor={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

function renderBody(block: Block, pageId: ID, number: number) {
  switch (block.type) {
    case 'page':
      return <SubPageLink block={block} />;
    case 'database':
      return (
        <div className="block-db">
          <DatabaseView dbId={block.id} inline />
        </div>
      );
    case 'divider':
      return <Divider block={block} pageId={pageId} />;
    default:
      return <TextBlock block={block} pageId={pageId} number={number} />;
  }
}

function SubPageLink({ block }: { block: Block }) {
  return (
    <button type="button" className="subpage-link" onClick={() => navigate(block.id)}>
      <span className="subpage-icon">{block.icon ?? '📄'}</span>
      <span className="subpage-title">{block.text || 'Sem título'}</span>
    </button>
  );
}

function Divider({ block, pageId }: { block: Block; pageId: ID }) {
  const ref = useFocusTarget<HTMLDivElement>(block.id);
  return (
    <div
      ref={ref}
      className="divider"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          focusNeighbor(store.get(), pageId, block.id, -1, 'end') || focusNeighbor(store.get(), pageId, block.id, 1, 'start');
          store.apply((ws) => removeBlock(ws, block.id));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const fresh = makeBlock('text');
          store.apply((ws) => insertAfter(ws, fresh, block.id));
          requestFocus(fresh.id, 'start');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          focusNeighbor(store.get(), pageId, block.id, -1, 'end');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          focusNeighbor(store.get(), pageId, block.id, 1, 'start');
        }
      }}
    >
      <hr />
    </div>
  );
}

/** Focuses the element when a focus request names this block. */
function useFocusTarget<T extends HTMLElement>(id: ID) {
  const ref = useRef<T>(null);
  const check = useCallback(() => {
    if (!ref.current) return;
    const at = takeFocus(id);
    if (at === null) return;
    if (ref.current.isContentEditable) setCaret(ref.current, at);
    else ref.current.focus();
  }, [id]);
  // Every commit: the element may have just been (re)mounted for this request.
  useLayoutEffect(check);
  useEffect(() => onFocusRequest(check), [check]);
  return ref;
}

interface SlashState {
  start: number;
  query: string;
  active: number;
  rect: DOMRect;
}

function TextBlock({ block, pageId, number }: { block: Block; pageId: ID; number: number }) {
  const ref = useFocusTarget<HTMLDivElement>(block.id);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const commands = useMemo(() => (slash ? filterCommands(slash.query) : []), [slash]);

  // Keep the DOM in sync when the text changes from outside (undo, merge, convert).
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== block.text) {
      const focused = document.activeElement === el;
      el.textContent = block.text;
      if (focused) setCaret(el, 'end');
    }
  }, [block.text, ref]);

  const setText = (text: string) => store.apply((ws) => updateBlock(ws, block.id, { text }), block.id);

  const runCommand = useCallback(
    (cmd: SlashCommand) => {
      const el = ref.current;
      if (!el || !slash) return;
      const text = el.textContent ?? '';
      const caret = getCaret(el);
      const rest = text.slice(0, slash.start) + text.slice(Math.max(caret, slash.start + 1 + slash.query.length));
      setSlash(null);
      const replace = rest.trim() === '' && block.children.length === 0;
      const t = cmd.type;
      if (t === 'subpage' || t === 'inline-db') {
        let createdId = '';
        store.apply((ws) => {
          let next = updateBlock(ws, block.id, { text: rest });
          const index = childrenOf(next, block.parent).indexOf(block.id) + (replace ? 0 : 1);
          if (replace) next = removeBlock(next, block.id);
          const made = t === 'subpage' ? createPage(next, block.parent, '', index) : createDatabase(next, block.parent, '', index);
          createdId = made.id;
          next = made.ws;
          if (t === 'inline-db') next = insertAfter(next, makeBlock('text'), made.id);
          return next;
        });
        if (t === 'subpage') navigate(createdId);
        return;
      }
      if (t === 'divider') {
        const line = makeBlock('text');
        const div = makeBlock('divider');
        store.apply((ws) => {
          let next = updateBlock(ws, block.id, { text: rest });
          if (replace) {
            next = convertBlock(next, block.id, 'divider');
            next = updateBlock(next, block.id, { text: '' });
            return insertAfter(next, line, block.id);
          }
          next = insertAfter(next, div, block.id);
          return insertAfter(next, line, div.id);
        });
        requestFocus(line.id, 'start');
        return;
      }
      if (rest.trim() === '' || block.type === 'text') {
        store.apply((ws) => convertBlock(updateBlock(ws, block.id, { text: rest }), block.id, t));
        requestFocus(block.id, Math.min(slash.start, rest.length));
      } else {
        const fresh = makeBlock(t);
        store.apply((ws) => insertAfter(updateBlock(ws, block.id, { text: rest }), fresh, block.id));
        requestFocus(fresh.id, 'start');
      }
    },
    [block, ref, slash],
  );

  const onInput = () => {
    const el = ref.current;
    if (!el) return;
    const text = el.textContent ?? '';
    const caret = getCaret(el);
    if (block.type === 'text' && (text[caret - 1] === ' ' || text === '---')) {
      const sc = detectShortcut(text);
      if (sc) {
        setSlash(null);
        if (sc.type === 'divider') {
          const line = makeBlock('text');
          store.apply((ws) => insertAfter(updateBlock(convertBlock(ws, block.id, 'divider'), block.id, { text: '' }), line, block.id));
          requestFocus(line.id, 'start');
          return;
        }
        store.apply((ws) => updateBlock(convertBlock(ws, block.id, sc.type), block.id, { text: sc.text, checked: sc.checked ?? (sc.type === 'todo' ? false : undefined) }));
        requestFocus(block.id, 'start');
        return;
      }
    }
    if (slash) {
      if (caret <= slash.start || text[slash.start] !== '/') setSlash(null);
      else {
        const query = text.slice(slash.start + 1, caret);
        if (query.length > 24 || /\s{2}/.test(query)) setSlash(null);
        else setSlash({ ...slash, query, active: 0 });
      }
    } else if (text[caret - 1] === '/' && (caret === 1 || /\s/.test(text[caret - 2])) && block.type !== 'code') {
      const sel = window.getSelection();
      const rect = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : el.getBoundingClientRect();
      const useRect = rect.width === 0 && rect.height === 0 ? el.getBoundingClientRect() : rect;
      setSlash({ start: caret - 1, query: '', active: 0, rect: useRect });
    }
    setText(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current!;
    if (slash) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setSlash({ ...slash, active: (slash.active + d + commands.length) % Math.max(commands.length, 1) });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (commands[slash.active]) runCommand(commands[slash.active]);
        else setSlash(null);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }
    const ws = store.get();
    const caret = getCaret(el);
    const text = el.textContent ?? '';
    const nested = !!block.parent && !isContainer(ws.blocks[block.parent]);

    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      if (text === '' && block.type !== 'text') {
        store.apply((w) => convertBlock(w, block.id, 'text'));
        requestFocus(block.id, 'start');
        return;
      }
      if (text === '' && nested) {
        store.apply((w) => outdentBlock(w, block.id));
        requestFocus(block.id, 'start');
        return;
      }
      if (block.type === 'toggle' && block.collapsed && caret === text.length) {
        const fresh = makeBlock('toggle');
        store.apply((w) => insertAfter(w, fresh, block.id));
        requestFocus(fresh.id, 'start');
        return;
      }
      let created = '';
      store.apply((w) => {
        const r = splitBlock(w, block.id, caret);
        created = r.newId;
        return r.ws;
      });
      requestFocus(created, 'start');
      return;
    }
    if (e.key === 'Enter' && (e.shiftKey || block.type === 'code')) {
      e.preventDefault();
      document.execCommand('insertText', false, '\n');
      return;
    }
    if (e.key === 'Backspace' && caret === 0 && !hasSelection(el)) {
      e.preventDefault();
      if (block.type !== 'text') {
        store.apply((w) => convertBlock(w, block.id, 'text'));
        requestFocus(block.id, 'start');
        return;
      }
      if (nested) {
        store.apply((w) => outdentBlock(w, block.id));
        requestFocus(block.id, 'start');
        return;
      }
      const r = mergeWithPrevious(ws, block.id);
      if (r) {
        store.apply(() => r.ws);
        requestFocus(r.focusId, r.offset < 0 ? 'end' : r.offset);
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      store.apply((w) => (e.shiftKey ? outdentBlock(w, block.id) : indentBlock(w, block.id)));
      requestFocus(block.id, caret);
      return;
    }
    if (e.key === 'ArrowUp' && !e.shiftKey && caretOnEdgeLine(el, 'top')) {
      if (focusNeighbor(ws, pageId, block.id, -1, 'end')) e.preventDefault();
      else {
        e.preventDefault();
        document.querySelector<HTMLElement>('.page-title')?.focus();
      }
      return;
    }
    if (e.key === 'ArrowDown' && !e.shiftKey && caretOnEdgeLine(el, 'bottom')) {
      if (focusNeighbor(ws, pageId, block.id, 1, 'start')) e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft' && caret === 0 && !hasSelection(el)) {
      if (focusNeighbor(ws, pageId, block.id, -1, 'end')) e.preventDefault();
      return;
    }
    if (e.key === 'ArrowRight' && caret === text.length && !hasSelection(el)) {
      if (focusNeighbor(ws, pageId, block.id, 1, 'start')) e.preventDefault();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
    const lines = raw.split('\n');
    if (lines.length === 1 || block.type === 'code') {
      document.execCommand('insertText', false, raw);
      return;
    }
    const el = ref.current!;
    const caret = getCaret(el);
    const text = el.textContent ?? '';
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    let lastId = block.id;
    store.apply((ws) => {
      let next = updateBlock(ws, block.id, { text: before + lines[0] });
      let prev = block.id;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i] + (i === lines.length - 1 ? after : '');
        const sc = detectShortcut(line);
        const b = makeBlock(sc?.type ?? (block.type === 'todo' || block.type === 'bullet' || block.type === 'numbered' ? block.type : 'text'), {
          text: sc ? sc.text : line,
          checked: sc?.checked,
        });
        next = insertAfter(next, b, prev);
        prev = b.id;
      }
      lastId = prev;
      return next;
    });
    requestFocus(lastId, Math.max(0, (store.get().blocks[lastId]?.text.length ?? 0) - after.length));
  };

  const editable = (
    <div
      ref={ref}
      className={`editable ${block.type}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={PLACEHOLDER[block.type] ?? "Digite '/' para comandos"}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onBlur={() => setSlash(null)}
    />
  );

  const slashMenu = slash && (
    <Popover anchor={slash.rect} onClose={() => setSlash(null)} width={280} className="slash-popover">
      <div className="menu-title">Blocos básicos</div>
      <MenuList
        items={commands.map<MenuItem>((c) => ({ label: c.label, icon: c.icon, onSelect: () => runCommand(c) }))}
        active={slash.active}
        onHover={(i) => setSlash({ ...slash, active: i })}
      />
    </Popover>
  );

  // One stable tree for every type, so the editable element (and its focus)
  // survives conversions such as text → bullet.
  let marker: ReactNode = null;
  let variant = '';
  switch (block.type) {
    case 'todo':
      variant = `todo${block.checked ? ' done' : ''}`;
      marker = (
        <input
          type="checkbox"
          checked={!!block.checked}
          aria-label="Concluída"
          onChange={(e) => store.apply((ws) => updateBlock(ws, block.id, { checked: e.target.checked }))}
        />
      );
      break;
    case 'bullet':
      variant = 'list';
      marker = <span className="list-marker bullet-dot">•</span>;
      break;
    case 'numbered':
      variant = 'list';
      marker = <span className="list-marker">{number}.</span>;
      break;
    case 'toggle':
      variant = 'toggle';
      marker = (
        <button
          type="button"
          className={`toggle-arrow${block.collapsed ? '' : ' open'}`}
          aria-label={block.collapsed ? 'Expandir' : 'Recolher'}
          onClick={() => {
            if (block.collapsed && block.children.length === 0) {
              const fresh = makeBlock('text');
              store.apply((ws) => insertBlock(updateBlock(ws, block.id, { collapsed: false }), fresh, block.id));
              requestFocus(fresh.id, 'start');
            } else store.apply((ws) => updateBlock(ws, block.id, { collapsed: !block.collapsed }));
          }}
        >
          ▶
        </button>
      );
      break;
    case 'callout':
      variant = 'callout';
      marker = <span className="callout-icon">{block.icon ?? '💡'}</span>;
      break;
  }
  return (
    <div className={`block-body ${variant}`}>
      {marker}
      {editable}
      {slashMenu}
    </div>
  );
}

const TURN_INTO: [BlockType, string][] = [
  ['text', 'Texto'],
  ['h1', 'Título 1'],
  ['h2', 'Título 2'],
  ['h3', 'Título 3'],
  ['todo', 'Lista de tarefas'],
  ['bullet', 'Lista com marcadores'],
  ['numbered', 'Lista numerada'],
  ['toggle', 'Toggle'],
  ['quote', 'Citação'],
  ['callout', 'Destaque'],
  ['code', 'Código'],
];

function BlockMenu({ block, anchor, onClose }: { block: Block; anchor: HTMLElement; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const items: MenuItem[] = [
    {
      label: 'Duplicar',
      icon: '⧉',
      onSelect: () => {
        store.apply((ws) => duplicateBlock(ws, block.id).ws);
        onClose();
      },
    },
    ...(isTextual(block.type)
      ? TURN_INTO.filter(([t]) => t !== block.type).map<MenuItem>(([t, label]) => ({
          label: `Transformar em ${label.toLowerCase()}`,
          icon: '↻',
          onSelect: () => {
            store.apply((ws) => convertBlock(ws, block.id, t));
            requestFocus(block.id, 'end');
            onClose();
          },
        }))
      : []),
    {
      label: 'Excluir',
      icon: '🗑',
      danger: true,
      onSelect: async () => {
        const what = block.type === 'page' || block.type === 'database' ? `"${block.text || 'Sem título'}" e todo o seu conteúdo` : null;
        onClose();
        if (what && !(await confirmAction(`Excluir ${what}?`))) return;
        store.apply((ws) => removeBlock(ws, block.id));
        onClose();
      },
    },
  ];
  return (
    <Popover anchor={anchor} onClose={onClose} width={240}>
      <MenuList items={items} active={active} onHover={setActive} />
    </Popover>
  );
}
