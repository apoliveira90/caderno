import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  addOption,
  addProperty,
  addRow,
  addView,
  changePropertyType,
  deleteProperty,
  deleteView,
  OPTION_COLORS,
  removeBlock,
  setRowProp,
  updateBlock,
  updateProperty,
  updateView,
} from '../model/ops';
import { displayValue, groupRows, queryRows, rowValue } from '../model/query';
import { store, useWorkspace } from '../model/store';
import type { Block, Color, Filter, FilterOp, ID, Option, Property, PropertyType, PropValue, View } from '../model/types';
import { newId } from '../model/ids';
import { Popover } from './Popover';
import { navigate } from './router';

export const PROPERTY_TYPES: [PropertyType, string, string][] = [
  ['text', 'Texto', '≡'],
  ['number', 'Número', '#'],
  ['select', 'Seleção', '◉'],
  ['multi_select', 'Seleção múltipla', '☰'],
  ['status', 'Status', '◔'],
  ['person', 'Pessoa', '👤'],
  ['date', 'Data', '📅'],
  ['checkbox', 'Caixa de seleção', '☑'],
  ['url', 'URL', '🔗'],
];

export const typeIcon = (t: PropertyType) => (t === 'title' ? 'Aa' : PROPERTY_TYPES.find((p) => p[0] === t)?.[2] ?? '≡');

const COLOR_LABEL: Record<Color, string> = {
  default: 'Padrão',
  gray: 'Cinza',
  brown: 'Marrom',
  orange: 'Laranja',
  yellow: 'Amarelo',
  green: 'Verde',
  blue: 'Azul',
  purple: 'Roxo',
  pink: 'Rosa',
  red: 'Vermelho',
};

const GROUP_LABEL = { todo: 'A fazer', doing: 'Em andamento', done: 'Concluído' } as const;

const isOptionType = (t: PropertyType) => t === 'select' || t === 'multi_select' || t === 'status' || t === 'person';
const isMulti = (t: PropertyType) => t === 'multi_select' || t === 'person';

export function Pill({ option, onRemove }: { option: Option; onRemove?: () => void }) {
  return (
    <span className={`pill c-${option.color}`}>
      {option.group !== undefined && <span className={`dot g-${option.group}`} />}
      {option.name}
      {onRemove && (
        <button type="button" className="pill-x" aria-label={`Remover ${option.name}`} onMouseDown={(e) => { e.preventDefault(); onRemove(); }}>
          ×
        </button>
      )}
    </span>
  );
}

export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// ------------------------------------------------------------- the view ---

export function DatabaseView({ dbId, inline = false }: { dbId: ID; inline?: boolean }) {
  const ws = useWorkspace((w) => w);
  const db = ws.blocks[dbId];
  const [viewId, setViewId] = useState<ID | null>(null);
  const view = db?.views?.find((v) => v.id === viewId) ?? db?.views?.[0];
  const rows = useMemo(() => (db && view ? queryRows(ws, dbId, view.filters, view.sorts) : []), [ws, db, dbId, view]);
  const [panel, setPanel] = useState<{ kind: 'filter' | 'sort' | 'props' | 'group' | 'view' | 'addView'; anchor: HTMLElement } | null>(null);

  if (!db || !view) return <div className="db-missing">Banco de dados não encontrado.</div>;
  const schema = db.schema ?? [];

  const newRowDefaults = (): Record<ID, PropValue> => {
    // New rows start with values that keep them visible under the view's filters.
    const props: Record<ID, PropValue> = {};
    for (const f of view.filters) {
      const p = schema.find((x) => x.id === f.propId);
      if (!p || !f.value || (f.op !== 'is' && f.op !== 'contains')) continue;
      if (isMulti(p.type)) props[p.id] = [f.value];
      else if (p.type === 'select' || p.type === 'status') props[p.id] = f.value;
    }
    return props;
  };

  return (
    <div className={`database${inline ? ' inline' : ''}`}>
      {inline && (
        <div className="db-inline-head">
          <button type="button" className="db-inline-title" onClick={() => navigate(dbId)} title="Abrir como página">
            <span>{db.icon ?? '▦'}</span>
            <InlineTitle db={db} />
          </button>
        </div>
      )}
      <div className="db-toolbar">
        <div className="db-tabs" role="tablist">
          {db.views!.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={v.id === view.id}
              className={`db-tab${v.id === view.id ? ' active' : ''}`}
              onClick={(e) => (v.id === view.id ? setPanel({ kind: 'view', anchor: e.currentTarget }) : setViewId(v.id))}
              title={v.id === view.id ? 'Clique para editar a visualização' : undefined}
            >
              <span>{v.type === 'table' ? '▦' : '▥'}</span> {v.name}
            </button>
          ))}
          <button type="button" className="db-tab add" aria-label="Adicionar visualização" onClick={(e) => setPanel({ kind: 'addView', anchor: e.currentTarget })}>
            +
          </button>
        </div>
        <div className="db-actions">
          {view.type === 'board' && (
            <button type="button" className="ghost" onClick={(e) => setPanel({ kind: 'group', anchor: e.currentTarget })}>
              Agrupar
            </button>
          )}
          <button type="button" className={`ghost${view.filters.length ? ' on' : ''}`} onClick={(e) => setPanel({ kind: 'filter', anchor: e.currentTarget })}>
            Filtro{view.filters.length ? ` · ${view.filters.length}` : ''}
          </button>
          <button type="button" className={`ghost${view.sorts.length ? ' on' : ''}`} onClick={(e) => setPanel({ kind: 'sort', anchor: e.currentTarget })}>
            Ordenar{view.sorts.length ? ` · ${view.sorts.length}` : ''}
          </button>
          <button type="button" className="ghost" onClick={(e) => setPanel({ kind: 'props', anchor: e.currentTarget })}>
            Propriedades
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              const r = addRow(store.get(), dbId, '', newRowDefaults());
              store.apply(() => r.ws);
              navigate(r.id);
            }}
          >
            Nova
          </button>
        </div>
      </div>

      {view.type === 'table' ? (
        <TableView db={db} view={view} rows={rows} defaults={newRowDefaults} />
      ) : (
        <BoardView db={db} view={view} rows={rows} />
      )}

      {panel?.kind === 'filter' && <FilterPanel db={db} view={view} anchor={panel.anchor} onClose={() => setPanel(null)} />}
      {panel?.kind === 'sort' && <SortPanel db={db} view={view} anchor={panel.anchor} onClose={() => setPanel(null)} />}
      {panel?.kind === 'props' && <PropsPanel db={db} view={view} anchor={panel.anchor} onClose={() => setPanel(null)} />}
      {panel?.kind === 'group' && <GroupPanel db={db} view={view} anchor={panel.anchor} onClose={() => setPanel(null)} />}
      {panel?.kind === 'view' && (
        <ViewPanel
          db={db}
          view={view}
          anchor={panel.anchor}
          onClose={() => setPanel(null)}
          onDeleted={() => setViewId(null)}
        />
      )}
      {panel?.kind === 'addView' && (
        <Popover anchor={panel.anchor} onClose={() => setPanel(null)} width={200}>
          <div className="menu">
            {(['table', 'board'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className="menu-item"
                onClick={() => {
                  const r = addView(store.get(), dbId, t);
                  store.apply(() => r.ws);
                  setViewId(r.id);
                  setPanel(null);
                }}
              >
                <span className="menu-icon">{t === 'table' ? '▦' : '▥'}</span>
                <span className="menu-label">{t === 'table' ? 'Tabela' : 'Quadro'}</span>
              </button>
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}

function InlineTitle({ db }: { db: Block }) {
  const [editing, setEditing] = useState(false);
  if (!editing)
    return (
      <span
        className="db-title-text"
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {db.text || 'Sem título'}
      </span>
    );
  return (
    <TextInput
      autoFocus
      className="db-title-input"
      value={db.text}
      placeholder="Sem título"
      onCommit={(v) => {
        store.apply((ws) => updateBlock(ws, db.id, { text: v }));
        setEditing(false);
      }}
    />
  );
}

/** Text input that keeps its own draft and commits on blur or Enter. */
export function TextInput({
  value,
  onCommit,
  type = 'text',
  className = '',
  placeholder,
  autoFocus,
}: {
  value: string;
  onCommit: (v: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  return (
    <input
      className={`cell-input ${className}`}
      type={type}
      value={draft}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onClick={(e) => e.stopPropagation()}
      onFocus={() => (editing.current = true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        editing.current = false;
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          editing.current = false;
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
    />
  );
}

// ------------------------------------------------------------ table view ---

function TableView({ db, view, rows, defaults }: { db: Block; view: View; rows: Block[]; defaults: () => Record<ID, PropValue> }) {
  const schema = (db.schema ?? []).filter((p) => !view.hidden.includes(p.id));
  const [headMenu, setHeadMenu] = useState<{ prop: Property; anchor: HTMLElement } | null>(null);
  const [adding, setAdding] = useState<HTMLElement | null>(null);
  const [focusRow, setFocusRow] = useState<ID | null>(null);

  return (
    <div className="table-wrap">
      <table className="db-table">
        <thead>
          <tr>
            {schema.map((p) => (
              <th key={p.id} className={p.type === 'title' ? 'col-title' : ''}>
                <button type="button" className="th-btn" onClick={(e) => setHeadMenu({ prop: p, anchor: e.currentTarget })}>
                  <span className="th-icon">{typeIcon(p.type)}</span>
                  {p.name}
                  {view.sorts.find((s) => s.propId === p.id) && <span className="th-sort">{view.sorts.find((s) => s.propId === p.id)!.dir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              </th>
            ))}
            <th className="col-add">
              <button type="button" className="th-btn" aria-label="Adicionar propriedade" onClick={(e) => setAdding(e.currentTarget)}>
                +
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {schema.map((p) => (
                <td key={p.id} className={p.type === 'title' ? 'col-title' : `col-${p.type}`}>
                  {p.type === 'title' ? (
                    <div className="title-cell">
                      <TextInput
                        value={r.text}
                        placeholder="Sem título"
                        autoFocus={focusRow === r.id}
                        onCommit={(v) => store.apply((ws) => setRowProp(ws, r.id, 'title', v))}
                      />
                      <button type="button" className="open-row" onClick={() => navigate(r.id)}>
                        Abrir
                      </button>
                    </div>
                  ) : (
                    <PropertyCell db={db} row={r} prop={p} />
                  )}
                </td>
              ))}
              <td className="col-add">
                <button
                  type="button"
                  className="row-del"
                  aria-label="Excluir linha"
                  title="Excluir linha"
                  onClick={() => {
                    if (window.confirm(`Excluir "${r.text || 'Sem título'}"?`)) store.apply((ws) => removeBlock(ws, r.id));
                  }}
                >
                  🗑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="add-row"
        onClick={() => {
          const r = addRow(store.get(), db.id, '', defaults());
          store.apply(() => r.ws);
          setFocusRow(r.id);
        }}
      >
        + Nova linha
      </button>
      <div className="db-count">{rows.length} {rows.length === 1 ? 'registro' : 'registros'}</div>
      {headMenu && <PropertyMenu db={db} view={view} prop={headMenu.prop} anchor={headMenu.anchor} onClose={() => setHeadMenu(null)} />}
      {adding && <AddPropertyPanel db={db} anchor={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

export function AddPropertyPanel({ db, anchor, onClose }: { db: Block; anchor: HTMLElement; onClose: () => void }) {
  const [name, setName] = useState('');
  return (
    <Popover anchor={anchor} onClose={onClose} width={240}>
      <div className="panel">
        <input className="panel-input" autoFocus placeholder="Nome da propriedade" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="menu-title">Tipo</div>
        <div className="menu">
          {PROPERTY_TYPES.map(([t, label, icon]) => (
            <button
              key={t}
              type="button"
              className="menu-item"
              onClick={() => {
                store.apply((ws) => addProperty(ws, db.id, t, name.trim() || label).ws);
                onClose();
              }}
            >
              <span className="menu-icon">{icon}</span>
              <span className="menu-label">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </Popover>
  );
}

function PropertyMenu({ db, view, prop, anchor, onClose }: { db: Block; view: View; prop: Property; anchor: HTMLElement; onClose: () => void }) {
  const setSort = (dir: 'asc' | 'desc') => {
    store.apply((ws) => updateView(ws, db.id, view.id, { sorts: [{ propId: prop.id, dir }, ...view.sorts.filter((s) => s.propId !== prop.id)] }));
    onClose();
  };
  return (
    <Popover anchor={anchor} onClose={onClose} width={250}>
      <div className="panel">
        <TextInput
          className="panel-input"
          value={prop.name}
          onCommit={(v) => v.trim() && store.apply((ws) => updateProperty(ws, db.id, prop.id, { name: v.trim() }))}
        />
        {prop.type !== 'title' && (
          <label className="panel-row">
            <span>Tipo</span>
            <select value={prop.type} onChange={(e) => store.apply((ws) => changePropertyType(ws, db.id, prop.id, e.target.value as PropertyType))}>
              {PROPERTY_TYPES.map(([t, label]) => (
                <option key={t} value={t}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="menu">
          <button type="button" className="menu-item" onClick={() => setSort('asc')}>
            <span className="menu-icon">↑</span>
            <span className="menu-label">Ordenar crescente</span>
          </button>
          <button type="button" className="menu-item" onClick={() => setSort('desc')}>
            <span className="menu-icon">↓</span>
            <span className="menu-label">Ordenar decrescente</span>
          </button>
          {prop.type !== 'title' && (
            <>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  store.apply((ws) => updateView(ws, db.id, view.id, { hidden: [...view.hidden, prop.id] }));
                  onClose();
                }}
              >
                <span className="menu-icon">◌</span>
                <span className="menu-label">Ocultar nesta visualização</span>
              </button>
              <button
                type="button"
                className="menu-item danger"
                onClick={() => {
                  if (!window.confirm(`Excluir a propriedade "${prop.name}" e seus valores?`)) return;
                  store.apply((ws) => deleteProperty(ws, db.id, prop.id));
                  onClose();
                }}
              >
                <span className="menu-icon">🗑</span>
                <span className="menu-label">Excluir propriedade</span>
              </button>
            </>
          )}
        </div>
      </div>
    </Popover>
  );
}

// ------------------------------------------------------------ cell editor ---

export function PropertyCell({ db, row, prop }: { db: Block; row: Block; prop: Property }) {
  const v = rowValue(row, prop);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const set = (value: PropValue) => store.apply((ws) => setRowProp(ws, row.id, prop.id, value));

  switch (prop.type) {
    case 'title':
    case 'text':
      return <TextInput value={typeof v === 'string' ? v : ''} placeholder="Vazio" onCommit={set} />;
    case 'number':
      return (
        <TextInput
          type="number"
          className="num"
          value={typeof v === 'number' ? String(v) : ''}
          placeholder="Vazio"
          onCommit={(s) => set(s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s))}
        />
      );
    case 'url':
      return (
        <div className="url-cell">
          <TextInput value={typeof v === 'string' ? v : ''} placeholder="Vazio" onCommit={set} />
          {typeof v === 'string' && /^https?:\/\//.test(v) && (
            <a href={v} target="_blank" rel="noreferrer" className="url-open" aria-label="Abrir link">
              ↗
            </a>
          )}
        </div>
      );
    case 'checkbox':
      return <input type="checkbox" className="cell-check" checked={v === true} aria-label={prop.name} onChange={(e) => set(e.target.checked)} />;
    case 'date':
      return <TextInput type="date" value={typeof v === 'string' ? v : ''} onCommit={(s) => set(s || null)} />;
    default: {
      const ids = Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [];
      const opts = ids.map((id) => prop.options?.find((o) => o.id === id)).filter((o): o is Option => !!o);
      return (
        <>
          <button type="button" className="option-cell" onClick={(e) => setAnchor(e.currentTarget)}>
            {opts.length ? opts.map((o) => <Pill key={o.id} option={o} />) : <span className="empty">Vazio</span>}
          </button>
          {anchor && <OptionPicker db={db} prop={prop} value={ids} anchor={anchor} onChange={(next) => set(isMulti(prop.type) ? next : next[0] ?? null)} onClose={() => setAnchor(null)} />}
        </>
      );
    }
  }
}

function OptionPicker({
  db,
  prop,
  value,
  anchor,
  onChange,
  onClose,
}: {
  db: Block;
  prop: Property;
  value: string[];
  anchor: HTMLElement;
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<ID | null>(null);
  // Read the live schema so options created here show up immediately.
  const live = useWorkspace((ws) => ws.blocks[db.id]?.schema?.find((p) => p.id === prop.id)) ?? prop;
  const options = live.options ?? [];
  const multi = isMulti(live.type);
  const shown = options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = options.some((o) => o.name.toLowerCase() === q.trim().toLowerCase());

  const pick = (id: string) => {
    if (multi) onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
    else {
      onChange(value[0] === id ? [] : [id]);
      onClose();
    }
    setQ('');
  };
  const create = () => {
    const name = q.trim();
    if (!name) return;
    const r = addOption(store.get(), db.id, live.id, name);
    store.apply(() => r.ws);
    pick(r.id);
  };

  const list = (opts: Option[]) =>
    opts.map((o) =>
      editing === o.id ? (
        <OptionEditor key={o.id} db={db} prop={live} option={o} onDone={() => setEditing(null)} onDeleted={() => onChange(value.filter((x) => x !== o.id))} />
      ) : (
        <div key={o.id} className={`option-row${value.includes(o.id) ? ' selected' : ''}`}>
          <button type="button" className="option-pick" onClick={() => pick(o.id)}>
            <Pill option={o} />
            {value.includes(o.id) && <span className="check">✓</span>}
          </button>
          <button type="button" className="option-edit" aria-label={`Editar ${o.name}`} onClick={() => setEditing(o.id)}>
            ⋯
          </button>
        </div>
      ),
    );

  return (
    <Popover anchor={anchor} onClose={onClose} width={260}>
      <div className="panel">
        <div className="picker-selected">
          {value.map((id) => {
            const o = options.find((x) => x.id === id);
            return o ? <Pill key={id} option={o} onRemove={() => onChange(value.filter((x) => x !== id))} /> : null;
          })}
          <input
            className="picker-input"
            autoFocus
            placeholder={options.length ? 'Buscar ou criar opção' : 'Criar opção'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (shown.length === 1 && q.trim()) pick(shown[0].id);
                else if (!exact) create();
              } else if (e.key === 'Backspace' && q === '' && value.length && multi) onChange(value.slice(0, -1));
            }}
          />
        </div>
        <div className="option-list">
          {live.type === 'status'
            ? (['todo', 'doing', 'done'] as const).map((g) => {
                const inGroup = shown.filter((o) => (o.group ?? 'todo') === g);
                return inGroup.length ? (
                  <div key={g}>
                    <div className="menu-title">{GROUP_LABEL[g]}</div>
                    {list(inGroup)}
                  </div>
                ) : null;
              })
            : list(shown)}
          {q.trim() && !exact && (
            <button type="button" className="menu-item" onClick={create}>
              <span className="menu-label">
                Criar <Pill option={{ id: 'new', name: q.trim(), color: OPTION_COLORS[options.length % OPTION_COLORS.length] }} />
              </span>
            </button>
          )}
        </div>
      </div>
    </Popover>
  );
}

function OptionEditor({ db, prop, option, onDone, onDeleted }: { db: Block; prop: Property; option: Option; onDone: () => void; onDeleted: () => void }) {
  const patch = (p: Partial<Option>) =>
    store.apply((ws) => updateProperty(ws, db.id, prop.id, { options: (prop.options ?? []).map((o) => (o.id === option.id ? { ...o, ...p } : o)) }));
  return (
    <div className="option-editor">
      <TextInput value={option.name} className="panel-input" onCommit={(v) => v.trim() && patch({ name: v.trim() })} />
      {prop.type === 'status' && (
        <label className="panel-row">
          <span>Grupo</span>
          <select value={option.group ?? 'todo'} onChange={(e) => patch({ group: e.target.value as Option['group'] })}>
            {(['todo', 'doing', 'done'] as const).map((g) => (
              <option key={g} value={g}>
                {GROUP_LABEL[g]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="swatches">
        {(['default', ...OPTION_COLORS] as Color[]).map((c) => (
          <button key={c} type="button" className={`swatch c-${c}${option.color === c ? ' on' : ''}`} title={COLOR_LABEL[c]} aria-label={COLOR_LABEL[c]} onClick={() => patch({ color: c })} />
        ))}
      </div>
      <div className="option-editor-actions">
        <button
          type="button"
          className="ghost danger"
          onClick={() => {
            store.apply((ws) => {
              let next = updateProperty(ws, db.id, prop.id, { options: (prop.options ?? []).filter((o) => o.id !== option.id) });
              for (const rowId of ws.blocks[db.id]?.children ?? []) {
                const v = next.blocks[rowId]?.props?.[prop.id];
                if (v === option.id) next = setRowProp(next, rowId, prop.id, null);
                else if (Array.isArray(v) && v.includes(option.id)) next = setRowProp(next, rowId, prop.id, v.filter((x) => x !== option.id));
              }
              return next;
            });
            onDeleted();
            onDone();
          }}
        >
          Excluir opção
        </button>
        <button type="button" className="ghost" onClick={onDone}>
          Pronto
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ board view ---

function BoardView({ db, view, rows }: { db: Block; view: View; rows: Block[] }) {
  const schema = db.schema ?? [];
  const groupProp = schema.find((p) => p.id === view.groupBy && isOptionType(p.type));
  const [dragging, setDragging] = useState<ID | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [editing, setEditing] = useState<ID | null>(null);

  if (!groupProp) {
    return (
      <div className="board-empty">
        Escolha uma propriedade de seleção ou status em <strong>Agrupar</strong> para montar o quadro.
      </div>
    );
  }
  const groups = groupRows(rows, groupProp);
  const cardProps = schema.filter((p) => p.type !== 'title' && p.id !== groupProp.id && !view.hidden.includes(p.id));
  const valueFor = (optionId: string | null): PropValue => (optionId === null ? (isMulti(groupProp.type) ? [] : null) : isMulti(groupProp.type) ? [optionId] : optionId);

  return (
    <div className="board">
      {groups.map((g) => {
        const key = g.option?.id ?? '__none';
        return (
          <div
            key={key}
            className={`board-col${over === key ? ' over' : ''}`}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              setOver(key);
            }}
            onDragLeave={() => setOver((o) => (o === key ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (dragging) store.apply((ws) => setRowProp(ws, dragging, groupProp.id, valueFor(g.option?.id ?? null)));
              setDragging(null);
            }}
          >
            <div className="board-col-head">
              {g.option ? <Pill option={g.option} /> : <span className="pill c-default">Sem {groupProp.name.toLowerCase()}</span>}
              <span className="count">{g.rows.length}</span>
            </div>
            {g.rows.map((r) => (
              <div
                key={r.id}
                className={`card${dragging === r.id ? ' dragging' : ''}`}
                draggable={editing !== r.id}
                onDragStart={(e) => {
                  setDragging(r.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', r.text);
                }}
                onDragEnd={() => setDragging(null)}
                onClick={() => editing !== r.id && navigate(r.id)}
              >
                {editing === r.id ? (
                  <TextInput
                    autoFocus
                    value={r.text}
                    placeholder="Sem título"
                    onCommit={(v) => {
                      store.apply((ws) => setRowProp(ws, r.id, 'title', v));
                      setEditing(null);
                    }}
                  />
                ) : (
                  <div className="card-title">{r.text || 'Sem título'}</div>
                )}
                <CardProps row={r} props={cardProps} />
              </div>
            ))}
            <button
              type="button"
              className="add-card"
              onClick={() => {
                const r = addRow(store.get(), db.id, '', { [groupProp.id]: valueFor(g.option?.id ?? null) });
                store.apply(() => r.ws);
                setEditing(r.id);
              }}
            >
              + Nova
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CardProps({ row, props }: { row: Block; props: Property[] }) {
  const items: ReactNode[] = [];
  for (const p of props) {
    const v = rowValue(row, p);
    if (v === null || v === '' || (Array.isArray(v) && !v.length) || v === false) continue;
    if (isOptionType(p.type)) {
      const ids = Array.isArray(v) ? v : [String(v)];
      for (const id of ids) {
        const o = p.options?.find((x) => x.id === id);
        if (o) items.push(<Pill key={`${p.id}-${id}`} option={o} />);
      }
    } else if (p.type === 'date') items.push(<span key={p.id} className="card-meta">📅 {formatDate(String(v))}</span>);
    else if (p.type === 'checkbox') items.push(<span key={p.id} className="card-meta">☑ {p.name}</span>);
    else items.push(<span key={p.id} className="card-meta">{displayValue(row, p)}</span>);
  }
  return items.length ? <div className="card-props">{items}</div> : null;
}

// ---------------------------------------------------------------- panels ---

const OPS_FOR: Record<string, [FilterOp, string][]> = {
  text: [
    ['contains', 'contém'],
    ['not_contains', 'não contém'],
    ['is', 'é'],
    ['is_not', 'não é'],
    ['empty', 'está vazio'],
    ['not_empty', 'não está vazio'],
  ],
  option: [
    ['is', 'é'],
    ['is_not', 'não é'],
    ['empty', 'está vazio'],
    ['not_empty', 'não está vazio'],
  ],
  multi: [
    ['contains', 'contém'],
    ['not_contains', 'não contém'],
    ['empty', 'está vazio'],
    ['not_empty', 'não está vazio'],
  ],
  checkbox: [
    ['checked', 'marcada'],
    ['unchecked', 'desmarcada'],
  ],
};

function opsFor(p: Property): [FilterOp, string][] {
  if (p.type === 'checkbox') return OPS_FOR.checkbox;
  if (isMulti(p.type)) return OPS_FOR.multi;
  if (isOptionType(p.type)) return OPS_FOR.option;
  return OPS_FOR.text;
}

function FilterPanel({ db, view, anchor, onClose }: { db: Block; view: View; anchor: HTMLElement; onClose: () => void }) {
  const schema = db.schema ?? [];
  const save = (filters: Filter[]) => store.apply((ws) => updateView(ws, db.id, view.id, { filters }));
  return (
    <Popover anchor={anchor} onClose={onClose} width={440}>
      <div className="panel">
        {view.filters.length === 0 && <div className="panel-note">Nenhum filtro nesta visualização.</div>}
        {view.filters.map((f, i) => {
          const p = schema.find((x) => x.id === f.propId);
          if (!p) return null;
          const ops = opsFor(p);
          const needsValue = !['empty', 'not_empty', 'checked', 'unchecked'].includes(f.op);
          const patch = (x: Partial<Filter>) => save(view.filters.map((g, j) => (j === i ? { ...g, ...x } : g)));
          return (
            <div key={f.id} className="filter-row">
              <select
                value={f.propId}
                onChange={(e) => {
                  const np = schema.find((x) => x.id === e.target.value)!;
                  patch({ propId: np.id, op: opsFor(np)[0][0], value: '' });
                }}
              >
                {schema.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              <select value={f.op} onChange={(e) => patch({ op: e.target.value as FilterOp })}>
                {ops.map(([op, label]) => (
                  <option key={op} value={op}>
                    {label}
                  </option>
                ))}
              </select>
              {needsValue &&
                (isOptionType(p.type) ? (
                  <select value={f.value ?? ''} onChange={(e) => patch({ value: e.target.value })}>
                    <option value="">—</option>
                    {(p.options ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TextInput type={p.type === 'date' ? 'date' : p.type === 'number' ? 'number' : 'text'} value={f.value ?? ''} placeholder="Valor" onCommit={(v) => patch({ value: v })} />
                ))}
              <button type="button" className="ghost" aria-label="Remover filtro" onClick={() => save(view.filters.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="ghost"
          onClick={() => {
            const p = schema[0];
            save([...view.filters, { id: newId(), propId: p.id, op: opsFor(p)[0][0], value: '' }]);
          }}
        >
          + Adicionar filtro
        </button>
      </div>
    </Popover>
  );
}

function SortPanel({ db, view, anchor, onClose }: { db: Block; view: View; anchor: HTMLElement; onClose: () => void }) {
  const schema = db.schema ?? [];
  const save = (sorts: View['sorts']) => store.apply((ws) => updateView(ws, db.id, view.id, { sorts }));
  return (
    <Popover anchor={anchor} onClose={onClose} width={340}>
      <div className="panel">
        {view.sorts.length === 0 && <div className="panel-note">Nenhuma ordenação.</div>}
        {view.sorts.map((s, i) => (
          <div key={`${s.propId}-${i}`} className="filter-row">
            <select value={s.propId} onChange={(e) => save(view.sorts.map((x, j) => (j === i ? { ...x, propId: e.target.value } : x)))}>
              {schema.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <select value={s.dir} onChange={(e) => save(view.sorts.map((x, j) => (j === i ? { ...x, dir: e.target.value as 'asc' | 'desc' } : x)))}>
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </select>
            <button type="button" className="ghost" aria-label="Remover ordenação" onClick={() => save(view.sorts.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => save([...view.sorts, { propId: schema[0].id, dir: 'asc' }])}>
          + Adicionar ordenação
        </button>
      </div>
    </Popover>
  );
}

function PropsPanel({ db, view, anchor, onClose }: { db: Block; view: View; anchor: HTMLElement; onClose: () => void }) {
  const [adding, setAdding] = useState<HTMLElement | null>(null);
  return (
    <Popover anchor={anchor} onClose={onClose} width={260}>
      <div className="panel">
        {(db.schema ?? []).map((p) => (
          <label key={p.id} className="panel-row check">
            <input
              type="checkbox"
              disabled={p.type === 'title'}
              checked={!view.hidden.includes(p.id)}
              onChange={(e) =>
                store.apply((ws) =>
                  updateView(ws, db.id, view.id, { hidden: e.target.checked ? view.hidden.filter((h) => h !== p.id) : [...view.hidden, p.id] }),
                )
              }
            />
            <span className="th-icon">{typeIcon(p.type)}</span>
            <span>{p.name}</span>
          </label>
        ))}
        <button type="button" className="ghost" onClick={(e) => setAdding(e.currentTarget)}>
          + Nova propriedade
        </button>
        {adding && <AddPropertyPanel db={db} anchor={adding} onClose={() => setAdding(null)} />}
      </div>
    </Popover>
  );
}

function GroupPanel({ db, view, anchor, onClose }: { db: Block; view: View; anchor: HTMLElement; onClose: () => void }) {
  const options = (db.schema ?? []).filter((p) => isOptionType(p.type));
  return (
    <Popover anchor={anchor} onClose={onClose} width={240}>
      <div className="menu">
        {options.length === 0 && <div className="panel-note">Crie uma propriedade de seleção ou status.</div>}
        {options.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`menu-item${view.groupBy === p.id ? ' active' : ''}`}
            onClick={() => {
              store.apply((ws) => updateView(ws, db.id, view.id, { groupBy: p.id }));
              onClose();
            }}
          >
            <span className="menu-icon">{typeIcon(p.type)}</span>
            <span className="menu-label">{p.name}</span>
            {view.groupBy === p.id && <span className="menu-hint">✓</span>}
          </button>
        ))}
      </div>
    </Popover>
  );
}

function ViewPanel({ db, view, anchor, onClose, onDeleted }: { db: Block; view: View; anchor: HTMLElement; onClose: () => void; onDeleted: () => void }) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={240}>
      <div className="panel">
        <TextInput className="panel-input" value={view.name} onCommit={(v) => v.trim() && store.apply((ws) => updateView(ws, db.id, view.id, { name: v.trim() }))} />
        <label className="panel-row">
          <span>Layout</span>
          <select
            value={view.type}
            onChange={(e) => {
              const type = e.target.value as View['type'];
              const groupBy = view.groupBy ?? (db.schema ?? []).find((p) => p.type === 'status' || p.type === 'select')?.id;
              store.apply((ws) => updateView(ws, db.id, view.id, { type, groupBy }));
            }}
          >
            <option value="table">Tabela</option>
            <option value="board">Quadro</option>
          </select>
        </label>
        {(db.views?.length ?? 0) > 1 && (
          <button
            type="button"
            className="ghost danger"
            onClick={() => {
              store.apply((ws) => deleteView(ws, db.id, view.id));
              onDeleted();
              onClose();
            }}
          >
            Excluir visualização
          </button>
        )}
      </div>
    </Popover>
  );
}

// ------------------------------------------------- row page properties ---

export function RowProperties({ row, db }: { row: Block; db: Block }) {
  const [adding, setAdding] = useState<HTMLElement | null>(null);
  const [menu, setMenu] = useState<{ prop: Property; anchor: HTMLElement } | null>(null);
  const view = db.views?.[0];
  return (
    <div className="row-props">
      {(db.schema ?? [])
        .filter((p) => p.type !== 'title')
        .map((p) => (
          <div key={p.id} className="row-prop">
            <button type="button" className="row-prop-name" onClick={(e) => setMenu({ prop: p, anchor: e.currentTarget })}>
              <span className="th-icon">{typeIcon(p.type)}</span>
              {p.name}
            </button>
            <div className="row-prop-value">
              <PropertyCell db={db} row={row} prop={p} />
            </div>
          </div>
        ))}
      <button type="button" className="ghost add-prop" onClick={(e) => setAdding(e.currentTarget)}>
        + Adicionar propriedade
      </button>
      {adding && <AddPropertyPanel db={db} anchor={adding} onClose={() => setAdding(null)} />}
      {menu && view && <PropertyMenu db={db} view={view} prop={menu.prop} anchor={menu.anchor} onClose={() => setMenu(null)} />}
    </div>
  );
}
