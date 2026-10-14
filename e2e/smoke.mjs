// Browser smoke test: builds nothing, serves dist/ with `vite preview`, then
// drives the editor and the database like a user would.
// Usage: npm run build && npm run e2e  (CHROME_PATH overrides the browser)

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4179;
const URL = `http://127.0.0.1:${PORT}/`;
const OUT = new globalThis.URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve());
  server.on('exit', (c) => reject(new Error(`preview exited ${c}`)));
  setTimeout(() => reject(new Error('preview timeout')), 20000);
});

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', headless: true });
const failures = [];
const check = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    console.log(`  ✗ ${msg}`);
    failures.push(msg);
  }
};

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForSelector('.page-title');

  console.log('seed');
  check((await page.locator('.tree-title').allTextContents()).some((t) => t.startsWith('Instrução de Protesto')), 'meeting page in sidebar');
  await page.locator('.tree-title', { hasText: 'Instrução de Protesto' }).click();
  await page.waitForSelector('.db-table');
  check((await page.locator('.db-table tbody tr').count()) === 9, 'inline task table shows 9 rows');
  await page.screenshot({ path: `${OUT}meeting.png`, fullPage: false });

  console.log('editor');
  await page.locator('.side-action', { hasText: 'Nova página' }).click();
  await page.waitForFunction(() => document.activeElement?.classList.contains('page-title'));
  await page.keyboard.type('Página de teste');
  await page.keyboard.press('Enter');
  await page.keyboard.type('# Título grande');
  check((await page.locator('.editable.h1').count()) === 1, 'markdown "# " makes a heading');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- item um');
  await page.keyboard.press('Enter');
  await page.keyboard.type('item dois');
  check((await page.locator('.editable.bullet').count()) === 2, 'Enter continues a bulleted list');
  await page.keyboard.press('Tab');
  check((await page.locator('.block-children .editable.bullet').count()) === 1, 'Tab nests the item');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  check((await page.locator('.editable.text').count()) >= 1, 'Enter on empty list items leaves the list');
  await page.keyboard.type('/taref');
  await page.waitForSelector('.slash-popover');
  check((await page.locator('.slash-popover .menu-item').first().textContent())?.includes('Lista de tarefas'), 'slash menu filters commands');
  await page.keyboard.press('Enter');
  await page.keyboard.type('comprar café');
  check((await page.locator('.editable.todo').count()) === 1, 'slash command converts to a to-do');
  await page.locator('.block-body.todo input[type=checkbox]').check();
  check(await page.locator('.block-body.todo.done').isVisible(), 'checking a to-do marks it done');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  const todoText = await page.locator('.editable.todo').textContent();
  check(todoText === 'comprar café', 'Backspace on an empty line merges back');

  await page.locator('.editable.todo').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('/banco');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.block-db .db-table');
  check(true, 'slash command inserts an inline database');
  await page.locator('.block-db .add-row').click();
  await page.keyboard.type('Primeira linha');
  await page.keyboard.press('Enter');
  check((await page.locator('.block-db .db-table tbody tr').count()) === 1, 'adds a row to the inline database');

  await page.locator('.block-db .db-table tbody tr').first().locator('.option-cell').first().click();
  await page.waitForSelector('.picker-input');
  await page.locator('.option-pick', { hasText: 'Em andamento' }).click();
  check((await page.locator('.block-db .db-table tbody tr .pill', { hasText: 'Em andamento' }).count()) === 1, 'sets a status from the picker');

  await page.locator('.block-db .db-tab', { hasText: 'Quadro' }).click();
  await page.waitForSelector('.block-db .board');
  const cols = await page.locator('.block-db .board-col-head .pill').allTextContents();
  check(cols.join('|') === 'Não iniciada|Em andamento|Concluída', 'board shows status columns');
  const card = page.locator('.block-db .card', { hasText: 'Primeira linha' });
  const done = page.locator('.block-db .board-col').nth(2);
  await card.dragTo(done);
  check((await done.locator('.card').count()) === 1, 'dragging a card changes its status');

  console.log('undo / search / persistence');
  await page.locator('.page-tail').click();
  await page.locator('body').click({ position: { x: 5, y: 500 } });
  await page.keyboard.press('Control+z');
  check((await page.locator('.block-db .board-col').nth(2).locator('.card').count()) === 0, 'Ctrl+Z undoes the drag');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('café');
  check((await page.locator('.search-hit .search-title').first().textContent()) === 'Página de teste', 'search finds body text');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('.page-title');
  check((await page.locator('.page-title').textContent()) === 'Página de teste', 'content survives a reload');
  check((await page.locator('.editable.todo').textContent()) === 'comprar café', 'blocks survive a reload');
  await page.screenshot({ path: `${OUT}editor.png`, fullPage: true });

  console.log('full database page');
  await page.locator('.tree-title', { hasText: 'Instrução de Protesto' }).click();
  await page.locator('.db-inline-title').click();
  await page.waitForSelector('.full-db');
  await page.locator('.db-tab', { hasText: 'Por status' }).click();
  await page.waitForSelector('.board');
  check((await page.locator('.board .card').count()) === 9, 'task board shows all 9 cards');
  await page.screenshot({ path: `${OUT}board.png` });
  await page.locator('.db-tab', { hasText: 'Minhas' }).click();
  check((await page.locator('.db-table tbody tr').count()) === 2, '"Minhas" view filters to André');
  await page.locator('.db-table tbody tr').first().locator('.open-row').click();
  await page.waitForSelector('.row-props');
  check((await page.locator('.row-prop').count()) >= 5, 'row page shows its properties');
  await page.screenshot({ path: `${OUT}row.png` });

  console.log('linked views');
  await page.locator('.tree-title', { hasText: 'Comece aqui' }).click();
  await page.waitForSelector('.type-linked_db .board');
  check((await page.locator('.type-linked_db .card').count()) === 2, 'seeded linked board shows only André’s 2 tasks');
  await page.locator('.side-action', { hasText: 'Nova página' }).click();
  await page.waitForFunction(() => document.activeElement?.classList.contains('page-title'));
  await page.keyboard.type('Vínculos');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/vincul');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.link-picker');
  await page.locator('.link-picker .menu-item', { hasText: 'Tarefas' }).dispatchEvent('mousedown');
  await page.waitForSelector('.type-linked_db .db-table');
  check((await page.locator('.type-linked_db .db-table tbody tr').count()) === 9, 'slash command links the Tarefas database');
  await page.locator('.type-linked_db .add-row').click();
  await page.keyboard.type('Criada pelo vínculo');
  await page.keyboard.press('Enter');
  await page.locator('.tree-title', { hasText: 'Instrução de Protesto' }).click();
  await page.waitForSelector('.db-table');
  const titles = await page.locator('.db-table tbody .title-cell input').evaluateAll((els) => els.map((e) => e.value));
  check(titles.includes('Criada pelo vínculo'), 'a row added in the linked view lands in the source');

  console.log('delete with in-page confirmation');
  await page.locator('.tree-title', { hasText: 'Página de teste' }).click();
  await page.locator('.topbar button[aria-label="Mais opções"]').click();
  await page.locator('.menu-item', { hasText: 'Excluir página' }).dispatchEvent('mousedown');
  await page.waitForSelector('.confirm');
  await page.locator('.confirm .primary').click();
  await page.waitForTimeout(100);
  check((await page.locator('.tree-title', { hasText: 'Página de teste' }).count()) === 0, 'confirmed delete removes the page');

  console.log('mobile');
  const phone = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await phone.goto(URL);
  await phone.waitForSelector('.page-title');
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, 'no horizontal page scroll on a phone');
  await phone.locator('.menu-toggle').click();
  await phone.waitForTimeout(300);
  check(await phone.locator('.sidebar.open').isVisible(), 'menu opens the sidebar on a phone');
  await phone.screenshot({ path: `${OUT}phone.png` });

  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  server.kill();
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
