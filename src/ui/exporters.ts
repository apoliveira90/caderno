import { displayValue } from '../model/query';
import type { ID, Workspace } from '../model/types';

/** Renders a page (and nested content) as Markdown; databases become tables. */
export function exportMarkdown(ws: Workspace, pageId: ID): string {
  const page = ws.blocks[pageId];
  if (!page) return '';
  const out: string[] = [`# ${page.icon ? `${page.icon} ` : ''}${page.text || 'Sem título'}`, ''];
  if (page.type === 'database') {
    out.push(...databaseTable(ws, pageId));
    return out.join('\n');
  }
  const walk = (ids: ID[], depth: number) => {
    let n = 0;
    const pad = '  '.repeat(depth);
    for (const id of ids) {
      const b = ws.blocks[id];
      if (!b) continue;
      n = b.type === 'numbered' ? n + 1 : 0;
      switch (b.type) {
        case 'h1':
          out.push(`${pad}## ${b.text}`);
          break;
        case 'h2':
          out.push(`${pad}### ${b.text}`);
          break;
        case 'h3':
          out.push(`${pad}#### ${b.text}`);
          break;
        case 'todo':
          out.push(`${pad}- [${b.checked ? 'x' : ' '}] ${b.text}`);
          break;
        case 'bullet':
        case 'toggle':
          out.push(`${pad}- ${b.text}`);
          break;
        case 'numbered':
          out.push(`${pad}${n}. ${b.text}`);
          break;
        case 'quote':
          out.push(`${pad}> ${b.text}`);
          break;
        case 'callout':
          out.push(`${pad}> ${b.icon ?? '💡'} ${b.text}`);
          break;
        case 'code':
          out.push(`${pad}\`\`\``, ...b.text.split('\n').map((l) => pad + l), `${pad}\`\`\``);
          break;
        case 'divider':
          out.push(`${pad}---`);
          break;
        case 'page':
          out.push(`${pad}📄 ${b.text || 'Sem título'}`);
          break;
        case 'database':
          out.push(`${pad}**${b.text || 'Sem título'}**`, '', ...databaseTable(ws, b.id), '');
          break;
        case 'linked_db': {
          const src = b.source ? ws.blocks[b.source] : undefined;
          out.push(`${pad}**${src?.text || 'Sem título'}** (vinculado)`, '', ...(src ? databaseTable(ws, src.id) : []), '');
          break;
        }
        default:
          out.push(pad + b.text);
      }
      if (b.type !== 'page' && b.type !== 'database') walk(b.children, depth + 1);
    }
  };
  walk(page.children, 0);
  return out.join('\n') + '\n';
}

function databaseTable(ws: Workspace, dbId: ID): string[] {
  const db = ws.blocks[dbId];
  const schema = db?.schema ?? [];
  const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const lines = [`| ${schema.map((p) => cell(p.name)).join(' | ')} |`, `| ${schema.map(() => '---').join(' | ')} |`];
  for (const id of db?.children ?? []) {
    const row = ws.blocks[id];
    if (row) lines.push(`| ${schema.map((p) => cell(displayValue(row, p))).join(' | ')} |`);
  }
  return lines;
}

export function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '-');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
