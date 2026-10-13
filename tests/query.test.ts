import { describe, expect, it } from 'vitest';
import { detectShortcut } from '../src/model/markdown';
import { addOption, addProperty, addRow, createDatabase, createPage, emptyWorkspace } from '../src/model/ops';
import { groupRows, queryRows, searchWorkspace } from '../src/model/query';
import { buildSeed } from '../src/model/seed';
import { Store } from '../src/model/store';

function sample() {
  const d = createDatabase(emptyWorkspace(), null, 'T');
  const status = d.ws.blocks[d.id].schema![1];
  const n = addProperty(d.ws, d.id, 'number', 'Pontos');
  const tag = addProperty(n.ws, d.id, 'multi_select', 'Tags');
  const red = addOption(tag.ws, d.id, tag.id, 'red');
  let ws = red.ws;
  const rows: string[] = [];
  const data: [string, number | null, number, string[]][] = [
    ['Banana', 3, 1, [red.id]],
    ['abacate', 10, 0, []],
    ['Caju', null, 2, [red.id]],
  ];
  for (const [title, pts, st, tags] of data) {
    const r = addRow(ws, d.id, title, { [n.id]: pts, [status.id]: status.options![st].id, [tag.id]: tags });
    ws = r.ws;
    rows.push(r.id);
  }
  return { ws, db: d.id, status, pts: n.id, tags: tag.id, red: red.id, rows };
}

describe('queryRows', () => {
  it('sorts numbers with empties last in both directions', () => {
    const s = sample();
    const asc = queryRows(s.ws, s.db, [], [{ propId: s.pts, dir: 'asc' }]).map((r) => r.text);
    const desc = queryRows(s.ws, s.db, [], [{ propId: s.pts, dir: 'desc' }]).map((r) => r.text);
    expect(asc).toEqual(['Banana', 'abacate', 'Caju']);
    expect(desc).toEqual(['abacate', 'Banana', 'Caju']);
  });

  it('sorts titles case-insensitively', () => {
    const s = sample();
    expect(queryRows(s.ws, s.db, [], [{ propId: 'title', dir: 'asc' }]).map((r) => r.text)).toEqual(['abacate', 'Banana', 'Caju']);
  });

  it('sorts status by option order', () => {
    const s = sample();
    expect(queryRows(s.ws, s.db, [], [{ propId: s.status.id, dir: 'asc' }]).map((r) => r.text)).toEqual(['abacate', 'Banana', 'Caju']);
  });

  it('filters by multi-select membership and emptiness', () => {
    const s = sample();
    const has = queryRows(s.ws, s.db, [{ id: 'f', propId: s.tags, op: 'contains', value: s.red }], []);
    expect(has.map((r) => r.text)).toEqual(['Banana', 'Caju']);
    const empty = queryRows(s.ws, s.db, [{ id: 'f', propId: s.pts, op: 'empty' }], []);
    expect(empty.map((r) => r.text)).toEqual(['Caju']);
  });

  it('filters titles by substring', () => {
    const s = sample();
    expect(queryRows(s.ws, s.db, [{ id: 'f', propId: 'title', op: 'contains', value: 'AN' }], []).map((r) => r.text)).toEqual(['Banana']);
  });

  it('groups rows by status option', () => {
    const s = sample();
    const groups = groupRows(queryRows(s.ws, s.db, [], []), s.status);
    expect(groups.map((g) => g.option?.name)).toEqual(['Não iniciada', 'Em andamento', 'Concluída']);
    expect(groups.map((g) => g.rows.map((r) => r.text))).toEqual([['abacate'], ['Banana'], ['Caju']]);
  });
});

describe('detectShortcut', () => {
  it.each([
    ['# T', 'h1', 'T'],
    ['## T', 'h2', 'T'],
    ['### T', 'h3', 'T'],
    ['- item', 'bullet', 'item'],
    ['1. item', 'numbered', 'item'],
    ['[] fazer', 'todo', 'fazer'],
    ['> mais', 'toggle', 'mais'],
    ['" cit', 'quote', 'cit'],
    ['---', 'divider', ''],
  ])('%s → %s', (input, type, text) => {
    expect(detectShortcut(input)).toMatchObject({ type, text });
  });

  it('marks "[x] " todos as done', () => {
    expect(detectShortcut('[x] ok')).toEqual({ type: 'todo', text: 'ok', checked: true });
  });

  it('ignores ordinary text', () => {
    expect(detectShortcut('#hashtag')).toBeNull();
    expect(detectShortcut('texto - com hífen')).toBeNull();
  });
});

describe('seed', () => {
  it('has the meeting tasks database with nine rows and consistent parents', () => {
    const ws = buildSeed();
    const db = Object.values(ws.blocks).find((b) => b.type === 'database')!;
    expect(db.text).toBe('Tarefas');
    expect(db.children).toHaveLength(9);
    for (const b of Object.values(ws.blocks)) {
      const siblings = b.parent ? ws.blocks[b.parent].children : ws.rootIds;
      expect(siblings).toContain(b.id);
      for (const c of b.children) expect(ws.blocks[c].parent).toBe(b.id);
    }
    const mine = db.views!.find((v) => v.name === 'Minhas')!;
    expect(queryRows(ws, db.id, mine.filters, mine.sorts)).toHaveLength(2);
  });

  it('search finds pages by body text', () => {
    const ws = buildSeed();
    const hits = searchWorkspace(ws, 'VAN');
    expect(hits.some((h) => h.title.startsWith('Instrução de Protesto'))).toBe(true);
  });
});

describe('Store', () => {
  it('coalesces typing into one undo step and supports redo', () => {
    const s = new Store(emptyWorkspace(), false);
    const page = createPage(s.get(), null);
    s.apply(() => page.ws);
    const line = s.get().blocks[page.id].children[0];
    s.apply((ws) => ({ ...ws, blocks: { ...ws.blocks, [line]: { ...ws.blocks[line], text: 'a' } } }), line);
    s.apply((ws) => ({ ...ws, blocks: { ...ws.blocks, [line]: { ...ws.blocks[line], text: 'ab' } } }), line);
    expect(s.undo()).toBe(true);
    expect(s.get().blocks[line].text).toBe('');
    expect(s.redo()).toBe(true);
    expect(s.get().blocks[line].text).toBe('ab');
  });
});

