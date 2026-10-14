# Caderno

Workspace de páginas, blocos e bancos de dados no estilo do Notion, feito do zero, que roda no navegador e salva tudo localmente — sem conta e sem limite de blocos.

## O que tem

- **Páginas aninhadas** na barra lateral, com ícone, título, caminho (breadcrumbs), arrastar para reorganizar, duplicar e excluir.
- **Editor de blocos**: texto, títulos 1–3, lista com marcadores, lista numerada, lista de tarefas, toggle, citação, destaque, código, divisor, sub-página e banco de dados inline.
  - `/` abre o menu de blocos (com busca); atalhos de Markdown (`# `, `- `, `1. `, `[] `, `> `, `---`…).
  - Enter, Shift+Enter, Backspace (junta com o bloco anterior), Tab/Shift+Tab (aninhar), setas entre blocos, colar várias linhas.
  - Arrastar pelo `⋮⋮` para mover blocos; menu do bloco para transformar, duplicar ou excluir.
- **Bancos de dados** (página inteira ou inline):
  - Propriedades: texto, número, seleção, seleção múltipla, status (com grupos), pessoa, data, caixa de seleção e URL; renomear, mudar o tipo (com conversão de valores), ocultar e excluir.
  - Visualizações em **tabela** e **quadro** (kanban com arrastar entre colunas), com filtros, ordenações e agrupamento por visualização.
  - Cada registro abre como página, com as propriedades no topo e conteúdo livre embaixo.
  - **Visualizações vinculadas**: mostre um banco existente em outra página com filtros e layout próprios (`/Visualização vinculada`); os registros continuam no banco de origem.
- **Busca** (Ctrl/Cmd+K) em títulos e conteúdo; **desfazer/refazer** (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z).
- **Backup**: exportar/importar o workspace em JSON; exportar uma página em Markdown.
- Tema claro/escuro automático e layout para celular.

O conteúdo inicial traz a reunião "Instrução de Protesto / Contrato de Cobrança para Teste / Grupo Della Volpe" (21/09/2026) e o banco **Tarefas** com as 9 ações dela, nas visualizações Todas, Por status e Minhas.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/, que funciona como site estático
```

## Testes

```bash
npm test                      # modelo de dados (vitest)
npm run build && npm run e2e  # roteiro no navegador com playwright-core
```

O `e2e` usa o Chromium indicado em `CHROME_PATH`.

## Como funciona

Tudo é um bloco (`src/model/types.ts`): páginas, parágrafos, bancos de dados e registros. Cada bloco guarda o `parent` e a lista ordenada de `children`; um banco de dados guarda o `schema` (propriedades) e as `views`, e seus filhos são os registros, com os valores em `props`.

- `src/model/ops.ts` — operações puras e imutáveis (inserir, mover, aninhar, dividir, juntar, propriedades, visualizações).
- `src/model/query.ts` — filtros, ordenação, agrupamento e busca.
- `src/model/store.ts` — estado com histórico (desfazer) e persistência em `localStorage`.
- `src/ui/` — React: barra lateral, editor de blocos, banco de dados, busca.

A análise do app desktop do Notion com o REA, e o que ela mudou no Caderno, está em `docs/rea.md`.
