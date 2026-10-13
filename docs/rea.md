# Análise com REA

O plano era usar o [REA](https://github.com/morluto/rea) (`rea-agents`) para capturar e analisar o bundle web do Notion e usar isso como referência. No ambiente em que o Caderno foi construído, o acesso a `notion.so` estava bloqueado pela política de rede, então **nenhuma análise REA foi feita** e nada aqui vem do código do Notion.

O Caderno é uma implementação própria. O modelo "tudo é um bloco, com pai e filhos ordenados" segue o que o Notion descreve publicamente sobre o próprio modelo de dados; a interface imita o comportamento visível do produto (atalhos, menu `/`, tabela e quadro).

## Rodar a análise localmente

Com o Notion aberto num Chromium com depuração remota, por exemplo:

```bash
chromium --remote-debugging-port=9222 https://www.notion.so
npx -y rea-agents@6.4.0 list-browser-targets http://127.0.0.1:9222
npx -y rea-agents@6.4.0 analyze-web-bundle http://127.0.0.1:9222 <targetId> --observation-ms 5000
```

`npx -y rea-agents@6.4.0 analyze-web-bundle --help` lista as opções. Use os resultados para comparar comportamento (operações de bloco, formato das transações), não para copiar código.
