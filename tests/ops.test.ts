import { describe, expect, it } from 'vitest';
import {
  addOption,
  addProperty,
  addRow,
  changePropertyType,
  createDatabase,
  createPage,
  deleteProperty,
  duplicateBlock,
  emptyWorkspace,
  indentBlock,
  insertBlock,
  makeBlock,
  mergeWithPrevious,
  moveBlock,
  outdentBlock,
  removeBlock,
  setRowProp,
  splitBlock,
  visibleOrder,
} from '../src/model/ops';
import type { Workspace } from '../src/model/types';

function pageWith(lines: string[]): { ws: Workspace; page: string; ids: string[] } {
  let ws = emptyWorkspace();
  const page = makeBlock('page', { text: 'P' });
  ws = insertBlock(ws, page, null);
  const ids: string[] = [];
  for (const t of lines) {
    const b = makeBlock('text', { text: t });
    ws = insertBlock(ws, b, page.id);
    ids.push(b.id);
  }
  return { ws, page: page.id, ids };
}

describe('block tree', () => {
  it('createPage adds a page with an empty first line', () => {
    const { ws, id } = createPage(emptyWorkspace(), null, 'Nova');
    expect(ws.rootIds).toEqual([id]);
    expect(ws.blocks[id].children).toHaveLength(1);
    expect(ws.blocks[ws.blocks[id].children[0]].type).toBe('text');
  });

  it('removeBlock deletes descendants too', () => {
    const { ws, page, ids } = pageWith(['a', 'b']);
    const nested = indentBlock(ws, ids[1]);
    const out = removeBlock(nested, ids[0]);
    expect(out.blocks[ids[0]]).toBeUndefined();
    expect(out.blocks[ids[1]]).toBeUndefined();
    expect(out.blocks[page].children).toEqual([]);
  });

  it('moveBlock refuses to move a block into its own subtree', () => {
    const { ws, ids } = pageWith(['a', 'b']);
    const nested = indentBlock(ws, ids[1]);
    expect(moveBlock(nested, ids[0], ids[1])).toBe(nested);
  });

  it('indent nests under the previous sibling and outdent restores order', () => {
    const { ws, page, ids } = pageWith(['a', 'b', 'c']);
    let next = indentBlock(ws, ids[1]);
    expect(next.blocks[ids[0]].children).toEqual([ids[1]]);
    expect(next.blocks[page].children).toEqual([ids[0], ids[2]]);
    next = indentBlock(next, ids[2]);
    expect(next.blocks[ids[0]].children).toEqual([ids[1], ids[2]]);
    // Outdenting b takes the following sibling c along as its child.
    next = outdentBlock(next, ids[1]);
    expect(next.blocks[page].children).toEqual([ids[0], ids[1]]);
    expect(next.blocks[ids[1]].children).toEqual([ids[2]]);
    expect(visibleOrder(next, page)).toEqual(ids);
  });

  it('indent is a no-op for the first block', () => {
    const { ws, ids } = pageWith(['a']);
    expect(indentBlock(ws, ids[0])).toBe(ws);
  });

  it('outdent does not leave the page', () => {
    const { ws, ids } = pageWith(['a']);
    expect(outdentBlock(ws, ids[0])).toBe(ws);
  });
});

describe('editing', () => {
  it('split moves the text after the caret into a new block', () => {
    const { ws, page, ids } = pageWith(['hello world']);
    const { ws: out, newId } = splitBlock(ws, ids[0], 5);
    expect(out.blocks[ids[0]].text).toBe('hello');
    expect(out.blocks[newId].text).toBe(' world');
    expect(out.blocks[page].children).toEqual([ids[0], newId]);
  });

  it('split keeps list types and resets headings to text', () => {
    let { ws, ids } = pageWith(['x', 'y']);
    ws = { ...ws, blocks: { ...ws.blocks, [ids[0]]: { ...ws.blocks[ids[0]], type: 'todo' }, [ids[1]]: { ...ws.blocks[ids[1]], type: 'h1' } } };
    const a = splitBlock(ws, ids[0], 1);
    expect(a.ws.blocks[a.newId].type).toBe('todo');
    const b = splitBlock(ws, ids[1], 1);
    expect(b.ws.blocks[b.newId].type).toBe('text');
  });

  it('split at the end of a block with children inserts the first child', () => {
    const { ws, ids } = pageWith(['a', 'b']);
    const nested = indentBlock(ws, ids[1]);
    const { ws: out, newId } = splitBlock(nested, ids[0], 1);
    expect(out.blocks[ids[0]].children).toEqual([newId, ids[1]]);
  });

  it('merge joins text into the previous block and returns the caret offset', () => {
    const { ws, page, ids } = pageWith(['foo', 'bar']);
    const r = mergeWithPrevious(ws, ids[1])!;
    expect(r.focusId).toBe(ids[0]);
    expect(r.offset).toBe(3);
    expect(r.ws.blocks[ids[0]].text).toBe('foobar');
    expect(r.ws.blocks[page].children).toEqual([ids[0]]);
  });

  it('merge keeps the children of the removed block', () => {
    const { ws, page, ids } = pageWith(['a', 'b', 'c']);
    const nested = indentBlock(ws, ids[2]);
    const r = mergeWithPrevious(nested, ids[1])!;
    expect(r.ws.blocks[page].children).toEqual([ids[0], ids[2]]);
  });

  it('merge on the first block does nothing', () => {
    const { ws, ids } = pageWith(['a']);
    expect(mergeWithPrevious(ws, ids[0])).toBeNull();
  });

  it('duplicate copies a subtree with fresh ids', () => {
    const { ws, page, ids } = pageWith(['a', 'b']);
    const nested = indentBlock(ws, ids[1]);
    const { ws: out, id } = duplicateBlock(nested, ids[0]);
    expect(out.blocks[page].children).toEqual([ids[0], id]);
    const copyChild = out.blocks[id].children[0];
    expect(copyChild).not.toBe(ids[1]);
    expect(out.blocks[copyChild].text).toBe('b');
    expect(out.blocks[copyChild].parent).toBe(id);
  });
});

describe('databases', () => {
  it('creates a database with title and status properties and two views', () => {
    const { ws, id } = createDatabase(emptyWorkspace(), null, 'Tarefas');
    const db = ws.blocks[id];
    expect(db.schema!.map((p) => p.type)).toEqual(['title', 'status']);
    expect(db.views!.map((v) => v.type)).toEqual(['table', 'board']);
    expect(db.views![1].groupBy).toBe(db.schema![1].id);
  });

  it('sets row values and the title property', () => {
    const d = createDatabase(emptyWorkspace(), null, 'T');
    const r = addRow(d.ws, d.id, 'Linha');
    let ws = setRowProp(r.ws, r.id, 'title', 'Renomeada');
    expect(ws.blocks[r.id].text).toBe('Renomeada');
    const status = ws.blocks[d.id].schema![1];
    ws = setRowProp(ws, r.id, status.id, status.options![1].id);
    expect(ws.blocks[r.id].props![status.id]).toBe(status.options![1].id);
  });

  it('addOption reuses an option with the same name', () => {
    const d = createDatabase(emptyWorkspace(), null, 'T');
    const p = addProperty(d.ws, d.id, 'select', 'Tag');
    const a = addOption(p.ws, d.id, p.id, 'Urgente');
    const b = addOption(a.ws, d.id, p.id, ' urgente ');
    expect(b.id).toBe(a.id);
    expect(b.ws.blocks[d.id].schema!.find((x) => x.id === p.id)!.options).toHaveLength(1);
  });

  it('deleteProperty removes values and view references', () => {
    const d = createDatabase(emptyWorkspace(), null, 'T');
    const status = d.ws.blocks[d.id].schema![1];
    const r = addRow(d.ws, d.id, 'x', { [status.id]: status.options![0].id });
    const ws = deleteProperty(r.ws, d.id, status.id);
    expect(ws.blocks[d.id].schema!.map((p) => p.id)).toEqual(['title']);
    expect(ws.blocks[r.id].props).toEqual({});
    expect(ws.blocks[d.id].views![1].groupBy).toBeUndefined();
  });

  it('the title property cannot be deleted', () => {
    const d = createDatabase(emptyWorkspace(), null, 'T');
    expect(deleteProperty(d.ws, d.id, 'title')).toBe(d.ws);
  });

  it('changing select to text keeps the option name', () => {
    const d = createDatabase(emptyWorkspace(), null, 'T');
    const p = addProperty(d.ws, d.id, 'select', 'Tag');
    const o = addOption(p.ws, d.id, p.id, 'Azul');
    const r = addRow(o.ws, d.id, 'x', { [p.id]: o.id });
    const ws = changePropertyType(r.ws, d.id, p.id, 'text');
    expect(ws.blocks[r.id].props![p.id]).toBe('Azul');
  });

  it('changing text to number parses decimal commas', () => {
    const d = createDatabase(emptyWorkspace(), null, 'T');
    const p = addProperty(d.ws, d.id, 'text', 'Valor');
    const r = addRow(p.ws, d.id, 'x', { [p.id]: '12,5' });
    const ws = changePropertyType(r.ws, d.id, p.id, 'number');
    expect(ws.blocks[r.id].props![p.id]).toBe(12.5);
  });
});
