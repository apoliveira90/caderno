# Análise com REA

Análise estática do app desktop do Notion feita com [REA](https://github.com/morluto/rea) (`rea-agents@6.4.0`), usada para comparar o modelo de dados do Caderno com o do Notion. Nenhum código do Notion foi copiado; o Caderno é uma implementação própria.

## Artefato

- `app.asar` do Notion Desktop 7.37.1 (`package.json`: `name: "Notion"`, `version: "7.37.1"`, `main: "./.webpack/main"`), fornecido pelo dono do workspace.
- SHA-256 `5a080489dd4c6eca9a02b4959f002f246424f7bfa3329f4e9c2a2b900693e833`.
- Evidence REA `ev_b58cb572fe77d42b6406426a1f6c88be132459ca27bf2d757b03900577584c80` (`analyze-javascript-application`, `--integrity-policy record-and-continue`).

## O que o REA encontrou

| Item | Resultado |
| --- | --- |
| Arquivos relevantes | 155 (97 JavaScript analisados, 0 falhas de parse) |
| Processo principal | `.webpack/main/index.js` (4,3 MB) |
| Renderers | 12, entre eles `tabs`, `client_placeholder`, `sqlite_browser`, `activity_monitor` e janelas para `https://calendar.notion.so` e `https://accounts.google.com` |
| Pontes de contexto | 1 (`__SENTRY_IPC__`, só telemetria) |
| Canais IPC | 6, todos do Sentry (`scope`, `envelope`, `metric`…) |
| Armazenamento | `localStorage`, `sessionStorage`, IndexedDB e um processo `SqliteServer` com `better-sqlite3` 13.0.1 |
| Pacotes nativos | `better-sqlite3`, `@notionhq/desktop-native`, `@vscode/windows-registry`, `cf-prefs` |

Limitação: a análise semântica de `.webpack/main/index.js`, `.webpack/main/SqliteServer.js` e de alguns renderers esgotou o heap do analisador (1024 MiB). Os fatos estáticos desses arquivos foram mantidos, mas as relações entre módulos ficaram incompletas. Os binários nativos (`.asar.unpacked`) não estavam no arquivo enviado e não foram analisados.

## Conclusões

1. **O app desktop é uma casca.** O editor, os blocos e os bancos de dados não estão no `app.asar`: a janela principal carrega a aplicação web (`client_placeholder`, `loadURL`). O pacote cuida de janelas e abas, cache local, busca offline (`SearchOfflinePages`), notificações de reunião e áudio.
2. **O cache local é SQLite controlado pelo cliente web.** O `SqliteServer` só executa lotes de SQL enviados pelo renderer (`makeSqliteBatch`, `execSqlite`, pragmas como `journal_mode=WAL`). O esquema das tabelas não aparece no pacote.
3. **Os dados são registros em tabelas, apontados por `{table, id, spaceId}`.** O bundle principal enumera 66 tabelas de registro, entre elas `block`, `collection`, `collection_view`, `collection_property_schema`, `block_property_value`, `space`, `space_view`, `user_root`, `notion_user`, `comment`, `discussion`, `reaction` e `layout`. Um `page` é normalizado para a tabela `block`.
4. **Banco de dados não é um bloco só.** O esquema mora em `collection`; cada visualização é um registro `collection_view`; as linhas são `block`s. O bloco que aparece na página só aponta para a coleção e para as visualizações. É isso que permite mostrar o mesmo banco em vários lugares, cada um com suas visualizações (as "visualizações vinculadas").

## O que mudou no Caderno

- **Visualizações vinculadas** (`linked_db`): bloco que mostra um banco existente com visualizações próprias (filtros, ordenação, layout), equivalente a apontar uma `collection_view` nova para a mesma `collection`. Registros e propriedades continuam na origem; criar ou editar uma linha pela visualização vinculada altera o banco original. Comando `/Visualização vinculada`.
- `updateView`/`deleteView` localizam a visualização no bloco que a guarda (banco ou vínculo), e excluir uma propriedade limpa também as visualizações vinculadas.

O Caderno continua guardando esquema e visualizações próprias dentro do bloco do banco, sem tabelas separadas; o vínculo cobre o caso de uso sem mudar o formato do backup.

## Ainda não coberto

Comentários e discussões (`comment`, `discussion`, `reaction`), espaços e permissões (`space`, `space_permission_group`), propriedades com esquema separado (`collection_property_schema`) e sincronização entre dispositivos.

## Reproduzir

```bash
npx -y rea-agents@6.4.0 analyze-javascript-application /caminho/para/app.asar \
  --integrity-policy record-and-continue --format json > analise.json
```

No Windows o arquivo fica em `%LOCALAPPDATA%\Programs\Notion\resources\app.asar`; no Mac, em `/Applications/Notion.app/Contents/Resources/app.asar`.
