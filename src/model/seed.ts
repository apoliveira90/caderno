// Initial workspace: a getting-started page, the 2026-09-21 Della Volpe /
// Bradesco meeting notes and the task database with its action items.

import { newId } from './ids';
import { addAutomacoesProcessos } from './imports/automacoes';
import { addProperty, addRow, createDatabase, emptyWorkspace, insertBlock, makeBlock, makeView, updateBlock } from './ops';
import type { BlockType, Color, ID, Option, Workspace } from './types';

type Line = [BlockType, string] | [BlockType, string, Line[]];

function fill(ws: Workspace, parent: ID, lines: Line[]): Workspace {
  let next = ws;
  for (const [type, text, kids] of lines) {
    const b = makeBlock(type, { text, checked: type === 'todo' ? false : undefined });
    next = insertBlock(next, b, parent);
    if (kids) next = fill(next, b.id, kids);
  }
  return next;
}

const opt = (name: string, color: Color): Option => ({ id: newId(), name, color });

export function buildSeed(): Workspace {
  let ws = emptyWorkspace();

  const welcome = makeBlock('page', { text: 'Comece aqui', icon: '👋' });
  ws = insertBlock(ws, welcome, null);
  ws = fill(ws, welcome.id, [
    ['h2', 'Tudo é um bloco'],
    ['text', 'Digite "/" em uma linha vazia para escolher o tipo do bloco: títulos, listas, tarefas, citações, código, sub-páginas ou um banco de dados.'],
    ['h3', 'Atalhos de Markdown'],
    ['bullet', '"# ", "## " e "### " viram títulos'],
    ['bullet', '"- " vira lista, "1. " lista numerada e "[] " caixa de tarefa'],
    ['bullet', '"> " vira toggle, aspas + espaço vira citação, "---" vira divisor'],
    ['h3', 'Teclado'],
    ['todo', 'Enter cria um bloco abaixo; Shift+Enter quebra a linha'],
    ['todo', 'Tab aninha o bloco; Shift+Tab desfaz o aninhamento'],
    ['todo', 'Backspace no início junta com o bloco anterior'],
    ['todo', 'Ctrl/Cmd+K busca páginas; Ctrl/Cmd+Z desfaz fora do texto'],
    ['toggle', 'Onde ficam meus dados?', [
      ['text', 'Tudo fica salvo no navegador (localStorage). Use Exportar na barra lateral para guardar um backup em JSON e Importar para restaurar.'],
    ]],
  ]);

  const meeting = makeBlock('page', { text: 'Instrução de Protesto / Contrato de Cobrança para Teste / Grupo Della Volpe', icon: '🤝' });
  ws = insertBlock(ws, meeting, null);
  ws = fill(ws, meeting.id, [
    ['callout', 'Reunião de 21/09/2026 entre o faturamento/financeiro da Della Volpe (André, Ronaldo, Ana, Rita — consultora FI e fiscal) e o Bradesco (Jaqueline e Lívia).'],
    ['h2', 'Contexto'],
    ['bullet', 'Objetivo: esclarecer protesto/negativação, boleto híbrido com PIX e o novo convênio de teste para o SAP.'],
    ['h2', 'Protesto e negativação'],
    ['bullet', 'O protesto já está disponível no convênio atual do grupo e pode ser habilitado.'],
    ['bullet', 'Automático: toda a carteira vai a protesto após X dias úteis do vencimento (10 ou 20, a definir); risco para clientes estratégicos.'],
    ['bullet', 'Pontual (recomendado): por padrão todos vão a protesto e os estratégicos recebem a flag "não protestar" na remessa.'],
    ['bullet', 'Decisão interna: protesto só para boletos emitidos daqui em diante, não para a carteira legada.'],
    ['bullet', 'O banco não envia aviso ativo; a informação fica no próprio boleto. O cartório envia boleto com custas e principal.'],
    ['bullet', 'Serasa: comunicado prévio possível, mas é só "pendência financeira" — efeito menor que o protesto.'],
    ['bullet', 'Conclusão: protesto é mais eficaz para o perfil de clientes; Serasa pode entrar como piloto ou híbrido.'],
    ['h2', 'Boleto híbrido com PIX'],
    ['bullet', 'QR Code no boleto permite pagar via PIX e antecipa ~30% da carteira recebível.'],
    ['bullet', 'Exige novo número de carteira e chave PIX vinculada; o retorno no SAP precisa separar PIX de banco.'],
    ['bullet', 'Decisão: caminhar em paralelo com protesto e boleto híbrido.'],
    ['h2', 'Ambiente de teste e novo convênio'],
    ['bullet', 'A carteira atual está em produção e não pode voltar para teste; por isso o Bradesco criou um convênio exclusivo para testes.'],
    ['bullet', 'Hoje o SAP recebe a remessa mas não recebe o arquivo retorno em QA; a falta de VAN impede o teste completo.'],
    ['h2', 'Questões jurídicas'],
    ['bullet', 'O contrato é uma minuta padrão; as condições seguem as já existentes para o grupo, sem custo adicional.'],
    ['bullet', 'Após aprovação jurídica e testes satisfatórios, o convênio de teste migra para a carteira de produção.'],
    ['h2', 'Tarefas'],
  ]);

  const db = createDatabase(ws, meeting.id, 'Tarefas');
  ws = updateBlock(db.ws, db.id, { icon: '✅' });
  const status = ws.blocks[db.id].schema!.find((p) => p.type === 'status')!;
  const [todo, doing] = status.options!;
  const waiting: Option = { id: newId(), name: 'Aguardando terceiros', color: 'yellow', group: 'doing' };
  ws = updateBlock(ws, db.id, {
    schema: ws.blocks[db.id].schema!.map((p) =>
      p.id === status.id ? { ...p, options: [todo, doing, waiting, status.options![2]] } : p.id === 'title' ? { ...p, name: 'Tarefa' } : p,
    ),
  });

  const people = {
    andre: opt('André', 'blue'),
    ana: opt('Ana', 'pink'),
    ritaSap: opt('Rita (SAP/FI)', 'purple'),
    ritaJur: opt('Rita (Jurídico)', 'brown'),
    jaqueline: opt('Jaqueline (Bradesco)', 'red'),
    dv: opt('Della Volpe', 'orange'),
  };
  const fronts = {
    protesto: opt('Protesto', 'red'),
    pix: opt('Boleto híbrido/PIX', 'green'),
    teste: opt('Convênio de teste', 'blue'),
    juridico: opt('Jurídico', 'brown'),
    sap: opt('SAP', 'purple'),
    comercial: opt('Comercial', 'orange'),
  };
  const prios = { alta: opt('Alta', 'red'), media: opt('Média', 'yellow'), baixa: opt('Baixa', 'gray') };

  let r = addProperty(ws, db.id, 'person', 'Responsável');
  const pResp = r.id;
  r = addProperty(r.ws, db.id, 'date', 'Prazo');
  const pDue = r.id;
  r = addProperty(r.ws, db.id, 'select', 'Prioridade');
  const pPrio = r.id;
  r = addProperty(r.ws, db.id, 'multi_select', 'Frente');
  const pFront = r.id;
  r = addProperty(r.ws, db.id, 'text', 'Notas');
  const pNotes = r.id;
  ws = r.ws;
  ws = updateBlock(ws, db.id, {
    schema: ws.blocks[db.id].schema!.map((p) =>
      p.id === pResp ? { ...p, options: Object.values(people) }
      : p.id === pPrio ? { ...p, options: Object.values(prios) }
      : p.id === pFront ? { ...p, options: Object.values(fronts) }
      : p,
    ),
  });

  const tasks: [string, Option, Option[], Option, Option[], string][] = [
    ['Formalizar e-mail: convênio só para teste, sem custo e com as mesmas tarifas', waiting, [people.jaqueline], prios.alta, [fronts.teste, fronts.juridico], 'Insumo para o jurídico aprovar a minuta padrão.'],
    ['Compartilhar volumetria de clientes candidatos ao protesto', todo, [people.ana], prios.media, [fronts.protesto], 'Base para a cotação da tarifa.'],
    ['Enviar custos transacionais atuais e proposta de tarifa para protesto', waiting, [people.jaqueline], prios.media, [fronts.protesto], 'A proposta depende da volumetria da Ana.'],
    ['Acionar Aparecido sobre suporte de VAN ao ambiente de teste', waiting, [people.jaqueline], prios.alta, [fronts.teste, fronts.sap], 'Sem VAN o SAP não recebe o retorno em QA.'],
    ['Incluir cláusula de protesto em todas as propostas comerciais', todo, [people.dv], prios.media, [fronts.protesto, fronts.comercial], ''],
    ['Definir prazo de protesto (10 ou 20 dias) e prioridade entre boleto híbrido e protesto', todo, [people.andre, people.ana], prios.alta, [fronts.protesto, fronts.pix], 'As duas frentes seguem em paralelo.'],
    ['Verificar no layout da remessa a instrução de "não protestar" e configurar no SAP', todo, [people.ritaSap], prios.media, [fronts.protesto, fronts.sap], ''],
    ['Revisar e aprovar o novo convênio de teste', todo, [people.ritaJur], prios.alta, [fronts.juridico, fronts.teste], 'Depende do e-mail da Jaqueline.'],
    ['Providenciar assinatura do contrato do novo convênio de teste', todo, [people.andre], prios.alta, [fronts.teste, fronts.juridico], 'Após o aval do jurídico.'],
  ];
  for (const [title, st, who, prio, front, notes] of tasks) {
    const row = addRow(ws, db.id, title, {
      [status.id]: st.id,
      [pResp]: who.map((o) => o.id),
      [pDue]: null,
      [pPrio]: prio.id,
      [pFront]: front.map((o) => o.id),
      [pNotes]: notes,
    });
    ws = insertBlock(row.ws, makeBlock('text'), row.id);
  }

  ws = fill(ws, welcome.id, [
    ['h3', 'Visualização vinculada'],
    ['text', 'O quadro abaixo mostra o banco "Tarefas" da página da reunião, com filtro próprio. Edite aqui ou lá: os registros são os mesmos.'],
  ]);
  ws = updateBlock(ws, db.id, {
    views: [
      makeView('table', 'Todas', { sorts: [{ propId: pPrio, dir: 'asc' }] }),
      makeView('board', 'Por status', { groupBy: status.id }),
      makeView('table', 'Minhas', { filters: [{ id: newId(), propId: pResp, op: 'contains', value: people.andre.id }] }),
    ],
  });
  const mine = ws.blocks[db.id].views!.find((v) => v.name === 'Minhas')!;
  const linked = makeBlock('linked_db', {
    source: db.id,
    views: [makeView('board', 'Minhas tarefas', { groupBy: status.id, filters: mine.filters.map((f) => ({ ...f, id: newId() })) })],
  });
  ws = insertBlock(ws, linked, welcome.id);
  return addAutomacoesProcessos(ws);
}
