// Pure, immutable operations on a Workspace. The UI store wraps these with
// history and persistence; tests exercise them directly.

import { newId } from './ids';
import type { Block, BlockType, Color, ID, Option, Property, PropertyType, PropValue, View, Workspace } from './types';

export const OPTION_COLORS: Color[] = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

/** Block types that own a document (shown in the sidebar, opened as a page). */
export const isContainer = (b: Block | undefined): boolean => !!b && (b.type === 'page' || b.type === 'database');

/** Block types whose text is the editable line of a content block. */
export const isTextual = (t: BlockType): boolean => t !== 'page' && t !== 'database' && t !== 'divider';

/** Types that keep their kind when Enter creates the next block. */
const CONTINUING: BlockType[] = ['todo', 'bullet', 'numbered'];

export function emptyWorkspace(): Workspace {
  return { version: 1, rootIds: [], blocks: {} };
}

export function makeBlock(type: BlockType, partial: Partial<Block> = {}): Block {
  const t = Date.now();
  return { id: newId(), type, parent: null, children: [], text: '', createdAt: t, updatedAt: t, ...partial };
}

export function childrenOf(ws: Workspace, parent: ID | null): ID[] {
  return parent === null ? ws.rootIds : ws.blocks[parent]?.children ?? [];
}

function withChildren(ws: Workspace, parent: ID | null, ids: ID[]): Workspace {
  if (parent === null) return { ...ws, rootIds: ids };
  const p = ws.blocks[parent];
  if (!p) return ws;
  return { ...ws, blocks: { ...ws.blocks, [parent]: { ...p, children: ids, updatedAt: Date.now() } } };
}

function put(ws: Workspace, ...blocks: Block[]): Workspace {
  const next = { ...ws.blocks };
  for (const b of blocks) next[b.id] = b;
  return { ...ws, blocks: next };
}

export function insertBlock(ws: Workspace, block: Block, parent: ID | null, index?: number): Workspace {
  const siblings = childrenOf(ws, parent).slice();
  const at = index === undefined || index < 0 || index > siblings.length ? siblings.length : index;
  siblings.splice(at, 0, block.id);
  return withChildren(put(ws, { ...block, parent }), parent, siblings);
}

export function insertAfter(ws: Workspace, block: Block, siblingId: ID): Workspace {
  const sib = ws.blocks[siblingId];
  if (!sib) return ws;
  const index = childrenOf(ws, sib.parent).indexOf(siblingId) + 1;
  return insertBlock(ws, block, sib.parent, index);
}

export function updateBlock(ws: Workspace, id: ID, patch: Partial<Block>): Workspace {
  const b = ws.blocks[id];
  if (!b) return ws;
  return put(ws, { ...b, ...patch, id, updatedAt: Date.now() });
}

export function descendants(ws: Workspace, id: ID): ID[] {
  const out: ID[] = [];
  const walk = (cur: ID) => {
    for (const c of ws.blocks[cur]?.children ?? []) {
      out.push(c);
      walk(c);
    }
  };
  walk(id);
  return out;
}

export function removeBlock(ws: Workspace, id: ID): Workspace {
  const b = ws.blocks[id];
  if (!b) return ws;
  const gone = new Set([id, ...descendants(ws, id)]);
  const blocks: Record<ID, Block> = {};
  for (const [k, v] of Object.entries(ws.blocks)) if (!gone.has(k)) blocks[k] = v;
  const next = { ...ws, blocks };
  return withChildren(next, b.parent, childrenOf(next, b.parent).filter((c) => c !== id));
}

export function isAncestor(ws: Workspace, ancestor: ID, id: ID): boolean {
  let cur = ws.blocks[id]?.parent ?? null;
  while (cur) {
    if (cur === ancestor) return true;
    cur = ws.blocks[cur]?.parent ?? null;
  }
  return false;
}

export function moveBlock(ws: Workspace, id: ID, parent: ID | null, index?: number): Workspace {
  const b = ws.blocks[id];
  if (!b || id === parent || (parent && isAncestor(ws, id, parent))) return ws;
  let next = withChildren(ws, b.parent, childrenOf(ws, b.parent).filter((c) => c !== id));
  next = insertBlock(next, next.blocks[id], parent, index);
  return next;
}

/** Nests a block under its previous sibling (Tab). */
export function indentBlock(ws: Workspace, id: ID): Workspace {
  const b = ws.blocks[id];
  if (!b) return ws;
  const siblings = childrenOf(ws, b.parent);
  const i = siblings.indexOf(id);
  if (i <= 0) return ws;
  const prev = ws.blocks[siblings[i - 1]];
  if (!prev || !isTextual(prev.type)) return ws;
  let next = moveBlock(ws, id, prev.id);
  if (prev.collapsed) next = updateBlock(next, prev.id, { collapsed: false });
  return next;
}

/**
 * Moves a block out of its parent (Shift+Tab). As in outliners, the siblings
 * that followed it become its children so the visual order is preserved.
 */
export function outdentBlock(ws: Workspace, id: ID): Workspace {
  const b = ws.blocks[id];
  if (!b || !b.parent) return ws;
  const parent = ws.blocks[b.parent];
  if (!parent || isContainer(parent)) return ws;
  const siblings = parent.children;
  const i = siblings.indexOf(id);
  const following = siblings.slice(i + 1);
  let next = withChildren(ws, parent.id, siblings.slice(0, i));
  const grand = childrenOf(next, parent.parent);
  next = insertBlock(next, next.blocks[id], parent.parent, grand.indexOf(parent.id) + 1);
  for (const f of following) next = moveBlock(next, f, id);
  return next;
}

/** Nearest page or database that owns the block. */
export function ownerOf(ws: Workspace, id: ID): ID | null {
  let cur = ws.blocks[id]?.parent ?? null;
  while (cur) {
    if (isContainer(ws.blocks[cur])) return cur;
    cur = ws.blocks[cur]?.parent ?? null;
  }
  return null;
}

/** Ancestor containers from the root down to (and including) the page. */
export function breadcrumbs(ws: Workspace, pageId: ID): ID[] {
  const out: ID[] = [];
  let cur: ID | null = pageId;
  while (cur) {
    if (isContainer(ws.blocks[cur])) out.unshift(cur);
    cur = ws.blocks[cur]?.parent ?? null;
  }
  return out;
}

/** Content blocks of a page in reading order, skipping collapsed toggles and sub-documents. */
export function visibleOrder(ws: Workspace, pageId: ID): ID[] {
  const out: ID[] = [];
  const walk = (ids: ID[]) => {
    for (const id of ids) {
      const b = ws.blocks[id];
      if (!b) continue;
      out.push(id);
      if (!isContainer(b) && !(b.type === 'toggle' && b.collapsed)) walk(b.children);
    }
  };
  walk(ws.blocks[pageId]?.children ?? []);
  return out;
}

/** Enter: keeps text before the caret, moves the rest into a new block below. */
export function splitBlock(ws: Workspace, id: ID, offset: number): { ws: Workspace; newId: ID } {
  const b = ws.blocks[id];
  if (!b) return { ws, newId: id };
  const before = b.text.slice(0, offset);
  const after = b.text.slice(offset);
  const type: BlockType = CONTINUING.includes(b.type) ? b.type : 'text';
  const fresh = makeBlock(type, { text: after });
  let next = updateBlock(ws, id, { text: before });
  // A block with visible children (or an open toggle) gets the new line as its first child.
  const intoChildren = b.children.length > 0 && !(b.type === 'toggle' && b.collapsed) && offset === b.text.length;
  if ((b.type === 'toggle' && !b.collapsed && offset === b.text.length) || intoChildren) {
    next = insertBlock(next, fresh, id, 0);
  } else {
    next = insertAfter(next, fresh, id);
  }
  return { ws: next, newId: fresh.id };
}

/**
 * Backspace at the start of a text block: appends its text to the previous
 * visible content block and removes it. Its children move to the end of the
 * previous block's parent level after it.
 */
export function mergeWithPrevious(ws: Workspace, id: ID): { ws: Workspace; focusId: ID; offset: number } | null {
  const b = ws.blocks[id];
  const pageId = ownerOf(ws, id);
  if (!b || !pageId) return null;
  const order = visibleOrder(ws, pageId);
  const i = order.indexOf(id);
  let prevId: ID | undefined;
  for (let j = i - 1; j >= 0; j--) {
    const cand = ws.blocks[order[j]];
    if (cand && isTextual(cand.type) && !isAncestor(ws, id, cand.id)) {
      prevId = cand.id;
      break;
    }
    if (cand && (cand.type === 'divider' || isContainer(cand))) {
      // Deleting an empty line right after a divider or sub-page just removes the line.
      if (b.text === '' && b.children.length === 0) {
        return { ws: removeBlock(ws, id), focusId: cand.id, offset: -1 };
      }
      return null;
    }
  }
  if (!prevId) return null;
  const prev = ws.blocks[prevId];
  const offset = prev.text.length;
  let next = updateBlock(ws, prevId, { text: prev.text + b.text });
  const kids = b.children;
  const parentSiblings = childrenOf(next, b.parent);
  let at = parentSiblings.indexOf(id);
  for (const k of kids) {
    next = moveBlock(next, k, b.parent, at);
    at += 1;
  }
  next = removeBlock(next, id);
  return { ws: next, focusId: prevId, offset };
}

// ---------------------------------------------------------------- pages ---

export function createPage(ws: Workspace, parent: ID | null, title = '', index?: number): { ws: Workspace; id: ID } {
  const page = makeBlock('page', { text: title });
  const line = makeBlock('text');
  let next = insertBlock(ws, page, parent, index);
  next = insertBlock(next, line, page.id);
  return { ws: next, id: page.id };
}

// ------------------------------------------------------------ databases ---

export function defaultStatusOptions(): Option[] {
  return [
    { id: newId(), name: 'Não iniciada', color: 'gray', group: 'todo' },
    { id: newId(), name: 'Em andamento', color: 'blue', group: 'doing' },
    { id: newId(), name: 'Concluída', color: 'green', group: 'done' },
  ];
}

export function makeView(type: View['type'], name: string, extra: Partial<View> = {}): View {
  return { id: newId(), name, type, filters: [], sorts: [], hidden: [], ...extra };
}

export function createDatabase(
  ws: Workspace,
  parent: ID | null,
  title = '',
  index?: number,
): { ws: Workspace; id: ID } {
  const titleProp: Property = { id: 'title', name: 'Nome', type: 'title' };
  const status: Property = { id: newId(), name: 'Status', type: 'status', options: defaultStatusOptions() };
  const db = makeBlock('database', {
    text: title,
    schema: [titleProp, status],
    views: [makeView('table', 'Tabela'), makeView('board', 'Quadro', { groupBy: status.id })],
  });
  return { ws: insertBlock(ws, db, parent, index), id: db.id };
}

function mapSchema(ws: Workspace, dbId: ID, fn: (s: Property[]) => Property[]): Workspace {
  const db = ws.blocks[dbId];
  if (!db || db.type !== 'database') return ws;
  return updateBlock(ws, dbId, { schema: fn(db.schema ?? []) });
}

export function getProperty(ws: Workspace, dbId: ID, propId: ID): Property | undefined {
  return ws.blocks[dbId]?.schema?.find((p) => p.id === propId);
}

export function addProperty(ws: Workspace, dbId: ID, type: PropertyType, name: string): { ws: Workspace; id: ID } {
  const prop: Property = { id: newId(), name, type };
  if (type === 'status') prop.options = defaultStatusOptions();
  else if (type === 'select' || type === 'multi_select' || type === 'person') prop.options = [];
  return { ws: mapSchema(ws, dbId, (s) => [...s, prop]), id: prop.id };
}

export function updateProperty(ws: Workspace, dbId: ID, propId: ID, patch: Partial<Property>): Workspace {
  return mapSchema(ws, dbId, (s) => s.map((p) => (p.id === propId ? { ...p, ...patch, id: p.id } : p)));
}

/** Changes a property's type, converting values where a lossless mapping exists. */
export function changePropertyType(ws: Workspace, dbId: ID, propId: ID, type: PropertyType): Workspace {
  const prop = getProperty(ws, dbId, propId);
  if (!prop || prop.type === 'title' || type === 'title' || prop.type === type) return ws;
  const optionTypes: PropertyType[] = ['select', 'multi_select', 'status', 'person'];
  let options = prop.options ?? [];
  if (type === 'status' && !prop.options?.length) options = defaultStatusOptions();
  let next = updateProperty(ws, dbId, propId, {
    type,
    options: optionTypes.includes(type) ? options.map((o) => ({ ...o, group: type === 'status' ? o.group ?? 'todo' : o.group })) : undefined,
  });
  for (const rowId of ws.blocks[dbId]?.children ?? []) {
    const row = next.blocks[rowId];
    const v = row?.props?.[propId];
    if (v === undefined) continue;
    next = setRowProp(next, rowId, propId, convertValue(v, prop, type, options));
  }
  return next;
}

function convertValue(v: PropValue, from: Property, to: PropertyType, options: Option[]): PropValue {
  const names = (ids: string[]) => ids.map((id) => from.options?.find((o) => o.id === id)?.name ?? '').filter(Boolean);
  const asText =
    Array.isArray(v) ? names(v).join(', ')
    : (from.type === 'select' || from.type === 'status') && typeof v === 'string' ? names([v]).join('')
    : v === null ? ''
    : String(v);
  switch (to) {
    case 'select':
    case 'status':
      if (Array.isArray(v)) return v[0] ?? null;
      return typeof v === 'string' && options.some((o) => o.id === v) ? v : null;
    case 'multi_select':
    case 'person':
      if (Array.isArray(v)) return v;
      return typeof v === 'string' && options.some((o) => o.id === v) ? [v] : [];
    case 'number': {
      const n = Number(asText.replace(',', '.'));
      return asText.trim() === '' || Number.isNaN(n) ? null : n;
    }
    case 'checkbox':
      return v === true || asText === 'true';
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(asText) ? asText : null;
    default:
      return asText;
  }
}

export function deleteProperty(ws: Workspace, dbId: ID, propId: ID): Workspace {
  if (propId === 'title') return ws;
  let next = mapSchema(ws, dbId, (s) => s.filter((p) => p.id !== propId));
  const db = next.blocks[dbId];
  next = updateBlock(next, dbId, {
    views: (db.views ?? []).map((v) => ({
      ...v,
      groupBy: v.groupBy === propId ? undefined : v.groupBy,
      filters: v.filters.filter((f) => f.propId !== propId),
      sorts: v.sorts.filter((s) => s.propId !== propId),
      hidden: v.hidden.filter((h) => h !== propId),
    })),
  });
  for (const rowId of db.children) {
    const row = next.blocks[rowId];
    if (row?.props && propId in row.props) {
      const { [propId]: _drop, ...rest } = row.props;
      next = updateBlock(next, rowId, { props: rest });
    }
  }
  return next;
}

export function addOption(ws: Workspace, dbId: ID, propId: ID, name: string): { ws: Workspace; id: ID } {
  const prop = getProperty(ws, dbId, propId);
  const existing = prop?.options?.find((o) => o.name.toLowerCase() === name.trim().toLowerCase());
  if (!prop || existing) return { ws, id: existing?.id ?? '' };
  const color = OPTION_COLORS[(prop.options?.length ?? 0) % OPTION_COLORS.length];
  const opt: Option = { id: newId(), name: name.trim(), color };
  if (prop.type === 'status') opt.group = 'todo';
  return { ws: updateProperty(ws, dbId, propId, { options: [...(prop.options ?? []), opt] }), id: opt.id };
}

export function addRow(
  ws: Workspace,
  dbId: ID,
  title = '',
  props: Record<ID, PropValue> = {},
  index?: number,
): { ws: Workspace; id: ID } {
  const row = makeBlock('page', { text: title, props });
  return { ws: insertBlock(ws, row, dbId, index), id: row.id };
}

export function setRowProp(ws: Workspace, rowId: ID, propId: ID, value: PropValue): Workspace {
  const row = ws.blocks[rowId];
  if (!row) return ws;
  if (propId === 'title') return updateBlock(ws, rowId, { text: typeof value === 'string' ? value : String(value ?? '') });
  return updateBlock(ws, rowId, { props: { ...row.props, [propId]: value } });
}

export function updateView(ws: Workspace, dbId: ID, viewId: ID, patch: Partial<View>): Workspace {
  const db = ws.blocks[dbId];
  if (!db?.views) return ws;
  return updateBlock(ws, dbId, { views: db.views.map((v) => (v.id === viewId ? { ...v, ...patch, id: v.id } : v)) });
}

export function addView(ws: Workspace, dbId: ID, type: View['type']): { ws: Workspace; id: ID } {
  const db = ws.blocks[dbId];
  if (!db) return { ws, id: '' };
  const groupable = db.schema?.find((p) => p.type === 'status' || p.type === 'select');
  const view = makeView(type, type === 'table' ? 'Tabela' : 'Quadro', type === 'board' ? { groupBy: groupable?.id } : {});
  return { ws: updateBlock(ws, dbId, { views: [...(db.views ?? []), view] }), id: view.id };
}

export function deleteView(ws: Workspace, dbId: ID, viewId: ID): Workspace {
  const db = ws.blocks[dbId];
  if (!db?.views || db.views.length <= 1) return ws;
  return updateBlock(ws, dbId, { views: db.views.filter((v) => v.id !== viewId) });
}

/** Turns a content block into another type, keeping its text. */
export function convertBlock(ws: Workspace, id: ID, type: BlockType): Workspace {
  const b = ws.blocks[id];
  if (!b || isContainer(b)) return ws;
  return updateBlock(ws, id, { type, checked: type === 'todo' ? b.checked ?? false : undefined });
}

export function duplicateBlock(ws: Workspace, id: ID): { ws: Workspace; id: ID } {
  const b = ws.blocks[id];
  if (!b) return { ws, id };
  const map = new Map<ID, ID>();
  const all = [id, ...descendants(ws, id)];
  for (const old of all) map.set(old, newId());
  let next = ws;
  const t = Date.now();
  const copies: Block[] = all.map((old) => {
    const src = ws.blocks[old];
    return {
      ...src,
      id: map.get(old)!,
      parent: old === id ? src.parent : map.get(src.parent!)!,
      children: src.children.map((c) => map.get(c)!),
      text: old === id && isContainer(src) ? `${src.text} (cópia)` : src.text,
      createdAt: t,
      updatedAt: t,
    };
  });
  next = put(next, ...copies.slice(1));
  const index = childrenOf(ws, b.parent).indexOf(id) + 1;
  next = insertBlock(next, copies[0], b.parent, index);
  return { ws: next, id: copies[0].id };
}
