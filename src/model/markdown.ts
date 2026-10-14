import type { BlockType } from './types';

const SHORTCUTS: [RegExp, BlockType][] = [
  [/^###\s/, 'h3'],
  [/^##\s/, 'h2'],
  [/^#\s/, 'h1'],
  [/^\[\s?\]\s/, 'todo'],
  [/^[-*+]\s/, 'bullet'],
  [/^1[.)]\s/, 'numbered'],
  [/^>\s/, 'toggle'],
  [/^"\s/, 'quote'],
  [/^```\s?/, 'code'],
];

/**
 * Markdown-style prefixes typed at the start of a plain text block convert it,
 * e.g. "# " → heading. Returns null when the text has no shortcut.
 */
export function detectShortcut(text: string): { type: BlockType; text: string; checked?: boolean } | null {
  if (/^(---|\*\*\*)$/.test(text)) return { type: 'divider', text: '' };
  const done = /^\[x\]\s/i.exec(text);
  if (done) return { type: 'todo', text: text.slice(done[0].length), checked: true };
  for (const [re, type] of SHORTCUTS) {
    const m = re.exec(text);
    if (m) return { type, text: text.slice(m[0].length) };
  }
  return null;
}
