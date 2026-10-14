// Caret helpers for plain-text contentEditable blocks, plus a tiny channel the
// block operations use to say which block should take focus after a render.

export type CaretTarget = number | 'start' | 'end';

let pending: { id: string; at: CaretTarget } | null = null;
const listeners = new Set<() => void>();

export function requestFocus(id: string, at: CaretTarget = 'end'): void {
  pending = { id, at };
  // Wait for React to commit: the target may be new or about to be remounted.
  setTimeout(() => {
    for (const l of listeners) l();
  }, 0);
}

export function takeFocus(id: string): CaretTarget | null {
  if (pending?.id !== id) return null;
  const at = pending.at;
  pending = null;
  return at;
}

export function onFocusRequest(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getCaret(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return 0;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

export function hasSelection(el: HTMLElement): boolean {
  const sel = window.getSelection();
  return !!sel && sel.rangeCount > 0 && !sel.isCollapsed && el.contains(sel.anchorNode);
}

export function setCaret(el: HTMLElement, at: CaretTarget): void {
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const len = el.textContent?.length ?? 0;
  let offset = at === 'start' ? 0 : at === 'end' ? len : Math.max(0, Math.min(at, len));
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const n = node.textContent?.length ?? 0;
    if (offset <= n) {
      range.setStart(node, offset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    offset -= n;
    node = walker.nextNode();
  }
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** True when the caret sits on the first (or last) visual line of the element. */
export function caretOnEdgeLine(el: HTMLElement, edge: 'top' | 'bottom'): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rects = range.getClientRects();
  const box = el.getBoundingClientRect();
  if (rects.length === 0) {
    const text = el.textContent ?? '';
    const c = getCaret(el);
    return edge === 'top' ? !text.slice(0, c).includes('\n') : !text.slice(c).includes('\n');
  }
  const r = rects[0];
  const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
  return edge === 'top' ? r.top - box.top < line * 0.8 : box.bottom - r.bottom < line * 0.8;
}
