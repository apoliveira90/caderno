import type { Block, Filter, ID, Option, Property, PropValue, Sort, Workspace } from './types';

export function rowValue(row: Block, prop: Property): PropValue {
  if (prop.type === 'title') return row.text;
  return row.props?.[prop.id] ?? null;
}

function optionName(prop: Property, id: string): string {
  return prop.options?.find((o) => o.id === id)?.name ?? '';
}

/** Human-readable value, used for text filters, search and CSV-like display. */
export function displayValue(row: Block, prop: Property): string {
  const v = rowValue(row, prop);
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map((id) => optionName(prop, id)).filter(Boolean).join(', ');
  if (prop.type === 'select' || prop.type === 'status') return optionName(prop, String(v));
  if (prop.type === 'checkbox') return v ? 'Sim' : 'Não';
  return String(v);
}

function isEmpty(v: PropValue): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

export function matchesFilter(row: Block, prop: Property, f: Filter): boolean {
  const v = rowValue(row, prop);
  const target = (f.value ?? '').toLowerCase();
  switch (f.op) {
    case 'empty':
      return isEmpty(v);
    case 'not_empty':
      return !isEmpty(v);
    case 'checked':
      return v === true;
    case 'unchecked':
      return v !== true;
    case 'is':
    case 'is_not': {
      let hit: boolean;
      if (Array.isArray(v)) hit = v.includes(f.value ?? '');
      else if (prop.type === 'select' || prop.type === 'status') hit = v === f.value;
      else hit = String(v ?? '').toLowerCase() === target;
      return f.op === 'is' ? hit : !hit;
    }
    case 'contains':
    case 'not_contains': {
      const hit = Array.isArray(v) ? v.includes(f.value ?? '') : displayValue(row, prop).toLowerCase().includes(target);
      return f.op === 'contains' ? hit : !hit;
    }
  }
}

function sortKey(row: Block, prop: Property): string | number | null {
  const v = rowValue(row, prop);
  if (isEmpty(v)) return null;
  if (prop.type === 'number') return Number(v);
  if (prop.type === 'checkbox') return v ? 1 : 0;
  if (prop.type === 'select' || prop.type === 'status') {
    // Options sort in their configured order, like a kanban column order.
    const i = prop.options?.findIndex((o) => o.id === v) ?? -1;
    return i < 0 ? null : i;
  }
  return displayValue(row, prop).toLowerCase();
}

export function compareRows(a: Block, b: Block, prop: Property, dir: Sort['dir']): number {
  const ka = sortKey(a, prop);
  const kb = sortKey(b, prop);
  // Empty values always go last, whatever the direction.
  if (ka === null && kb === null) return 0;
  if (ka === null) return 1;
  if (kb === null) return -1;
  const c = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb), 'pt-BR');
  return dir === 'asc' ? c : -c;
}

export function queryRows(ws: Workspace, dbId: ID, filters: Filter[], sorts: Sort[]): Block[] {
  const db = ws.blocks[dbId];
  if (!db) return [];
  const schema = db.schema ?? [];
  const byId = new Map(schema.map((p) => [p.id, p]));
  let rows = db.children.map((id) => ws.blocks[id]).filter((b): b is Block => !!b);
  for (const f of filters) {
    const prop = byId.get(f.propId);
    if (prop) rows = rows.filter((r) => matchesFilter(r, prop, f));
  }
  const active = sorts.map((s) => ({ s, prop: byId.get(s.propId) })).filter((x): x is { s: Sort; prop: Property } => !!x.prop);
  if (active.length) {
    rows = rows
      .map((r, i) => ({ r, i }))
      .sort((x, y) => {
        for (const { s, prop } of active) {
          const c = compareRows(x.r, y.r, prop, s.dir);
          if (c !== 0) return c;
        }
        return x.i - y.i;
      })
      .map((x) => x.r);
  }
  return rows;
}

export interface Group {
  option: Option | null;
  rows: Block[];
}

/** Board columns: one per option in order, plus "no value" when it has rows or no options exist. */
export function groupRows(rows: Block[], prop: Property): Group[] {
  const groups: Group[] = (prop.options ?? []).map((option) => ({ option, rows: [] }));
  const none: Group = { option: null, rows: [] };
  for (const r of rows) {
    const v = rowValue(r, prop);
    const key = Array.isArray(v) ? v[0] : v;
    const g = groups.find((x) => x.option!.id === key);
    (g ?? none).rows.push(r);
  }
  return none.rows.length || groups.length === 0 ? [none, ...groups] : groups;
}

export interface SearchHit {
  id: ID;
  title: string;
  snippet: string;
}

/** Finds pages and databases whose title or body text contains the query. */
export function searchWorkspace(ws: Workspace, query: string, limit = 30): SearchHit[] {
  const q = query.trim().toLowerCase();
  const hits: SearchHit[] = [];
  for (const b of Object.values(ws.blocks)) {
    if (b.type !== 'page' && b.type !== 'database') continue;
    const title = b.text || 'Sem título';
    if (!q) {
      hits.push({ id: b.id, title, snippet: '' });
      continue;
    }
    if (title.toLowerCase().includes(q)) {
      hits.push({ id: b.id, title, snippet: '' });
      continue;
    }
    const line = bodyLines(ws, b.id).find((t) => t.toLowerCase().includes(q));
    if (line) hits.push({ id: b.id, title, snippet: line.slice(0, 120) });
  }
  hits.sort((a, b) => (ws.blocks[b.id]?.updatedAt ?? 0) - (ws.blocks[a.id]?.updatedAt ?? 0));
  return hits.slice(0, limit);
}

function bodyLines(ws: Workspace, pageId: ID): string[] {
  const out: string[] = [];
  const walk = (ids: ID[]) => {
    for (const id of ids) {
      const b = ws.blocks[id];
      if (!b || b.type === 'page' || b.type === 'database') continue;
      if (b.text) out.push(b.text);
      walk(b.children);
    }
  };
  walk(ws.blocks[pageId]?.children ?? []);
  return out;
}
