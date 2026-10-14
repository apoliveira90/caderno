// "Automações Processos" database imported from Notion on 2026-10-14
// (https://app.notion.com/p/3df289c631cc80e1b679c2ea0d67c602, view "Todos os projetos").

import { newId } from '../ids';
import { addRow, insertBlock, makeBlock, makeView } from '../ops';
import type { Color, ID, Option, Property, PropValue, Workspace } from '../types';

export const AUTOMACOES_IMPORT = 'notion:automacoes-processos:2026-10-14';

const opt = (name: string, color: Color, group?: Option['group']): Option => ({ id: newId(), name, color, ...(group ? { group } : {}) });

interface Row {
  projeto: string;
  descricao: string;
  status: 'Não iniciado' | 'Em andamento' | 'Concluído';
  prioridade?: 'Alta' | 'Média' | 'Baixa';
  equipe: ('andre' | 'neuton' | 'wilson')[];
  inicio?: string;
  termino?: string;
  data?: string;
  dataObs1?: string;
  obs1?: string;
  obs2?: string;
  texto?: string;
  notion: string;
}

const ROWS: Row[] = [
  { projeto: 'Solicitação Cartões de Pontos', descricao: 'Automatizar o disparo para as filiais', status: 'Concluído', prioridade: 'Média', equipe: ['wilson'], inicio: '2026-08-01', termino: '2026-08-03', obs1: 'Parametrizado (Funcional)', notion: 'https://app.notion.com/p/3e4289c631cc800b956ffebf51601380' },
  { projeto: 'NDD', descricao: 'Extrair em massa a partir de um Excel PDF/XML de CT-e e NF-e', status: 'Concluído', prioridade: 'Média', equipe: ['wilson', 'neuton', 'andre'], inicio: '2026-09-17', termino: '2026-09-21', obs1: 'Processo finalizado, criando layout', notion: 'https://app.notion.com/p/e59289c631cc8212b41781384dc861f3' },
  { projeto: 'Cadastro no v360', descricao: 'Incluir notas spots na automação', status: 'Concluído', prioridade: 'Alta', equipe: ['wilson', 'andre', 'neuton'], inicio: '2026-09-21', termino: '2026-09-23', data: '2026-09-23', dataObs1: '2026-09-22', obs1: 'Opção “Spot” não está funcionando para concluirmos o processo. Causador: Vale - Ir testando', obs2: '"Spot” normalizado (IMPORTANDO)', texto: 'Boot em produçãooo', notion: 'https://app.notion.com/p/3df289c631cc808babbbd185ab23b717' },
  { projeto: 'Prefeitura de Parauapebas-PA', descricao: 'Baixar em Massa os PDF’s das NFS-e', status: 'Concluído', prioridade: 'Média', equipe: ['wilson', 'andre', 'neuton'], inicio: '2026-09-24', termino: '2026-10-09', obs1: 'Aguardando passo a passo Kelly ou Barbara', notion: 'https://app.notion.com/p/a15289c631cc8370aeba01c3773620da' },
  { projeto: 'Prefeitura de Contagem-MG', descricao: 'Baixar em Massa os PDF’s das NFS-e', status: 'Em andamento', prioridade: 'Média', equipe: ['wilson'], inicio: '2026-09-24', termino: '2026-09-25', obs1: 'Aguardando passo a passo Kelly ou Barbara', notion: 'https://app.notion.com/p/3e4289c631cc80e8a415e1aabef2e258' },
  { projeto: 'Cadastro Portal Acelen', descricao: 'Cadastrar notas e CT-es no portal da Acelen', status: 'Em andamento', prioridade: 'Média', equipe: ['wilson', 'andre'], inicio: '2026-09-26', termino: '2026-10-15', obs1: 'Data de 30/09 adiada para 02/10', notion: 'https://app.notion.com/p/666289c631cc838ea7b781aef4a7c2b6' },
  { projeto: 'A Faturar', descricao: 'Extrair base do SAP tratar e enviar por e-mail', status: 'Não iniciado', prioridade: 'Alta', equipe: ['wilson'], inicio: '2026-09-30', termino: '2026-10-09', notion: 'https://app.notion.com/p/3df289c631cc80d8952cfa53112cb31c' },
  { projeto: 'Valores Altos - Faturamento/Mariana Abreu', descricao: 'Extrair tabela SAP, identificar os valores mais altos e disparar e-mail ao time de faturamento.', status: 'Concluído', prioridade: 'Alta', equipe: ['wilson', 'neuton', 'andre'], inicio: '2026-10-01', termino: '2026-10-01', notion: 'https://app.notion.com/p/3ec289c631cc8097af5bc465340304c6' },
  { projeto: 'Automação de Pendências Filiais (APF 1.0)', descricao: 'Com base no a faturar, disparar CT-es sem comprovante (clientes originais) para a filial responsável  - “Parametrizando massa de dados”', status: 'Não iniciado', prioridade: 'Média', equipe: ['wilson'], inicio: '2026-10-09', termino: '2026-10-14', obs1: '1° Cobrar comprovantes de clientes “Originais” Média de 2x na semana com disparo automático', notion: 'https://app.notion.com/p/3df289c631cc80ef830fca7a82e812f4' },
  { projeto: 'Automação validação de cartões de pontos', descricao: 'Validar cartões de pontos recebidos pelas filiais e informar o valor a receber da “Vale”', status: 'Em andamento', prioridade: 'Média', equipe: ['andre', 'wilson'], inicio: '2026-10-10', termino: '2026-10-16', notion: 'https://app.notion.com/p/3f3289c631cc80f3996bc26298a80621' },
  { projeto: 'Status RPS', descricao: 'Automatizar verificação de RPS que não foram integradas', status: 'Não iniciado', prioridade: 'Média', equipe: ['wilson', 'andre'], inicio: '2026-10-15', termino: '2026-10-21', notion: 'https://app.notion.com/p/3e2289c631cc80debc23ed009df3fb54' },
  { projeto: 'Relatório Setor Comprovantes 1.0', descricao: 'Parametrizando colunas necessárias + Validação massa de dados + Atualização diária', status: 'Não iniciado', equipe: [], notion: 'https://app.notion.com/p/3f8289c631cc80e3b33ee545a4ab0d43' },
  { projeto: 'Raizen - verificar com Andre', descricao: '', status: 'Não iniciado', equipe: [], notion: 'https://app.notion.com/p/3f3289c631cc804b80b2ff35c4c47846' },
  { projeto: 'Automação processo Volks', descricao: 'Aguardando parametrização com a Mariana.Abreu', status: 'Não iniciado', prioridade: 'Média', equipe: ['andre', 'wilson'], notion: 'https://app.notion.com/p/3f3289c631cc809f98c3eaf0b64009f8' },
];

/** Adds the imported database as a top-level page and records the import. */
export function addAutomacoesProcessos(ws: Workspace): Workspace {
  const status = { naoIniciado: opt('Não iniciado', 'red', 'todo'), andamento: opt('Em andamento', 'blue', 'doing'), concluido: opt('Concluído', 'green', 'done') };
  const prio = { Alta: opt('Alta', 'red'), Média: opt('Média', 'yellow'), Baixa: opt('Baixa', 'green') };
  const people = { andre: opt('Andre Oliveira', 'blue'), neuton: opt('Neuton Dias', 'purple'), wilson: opt('wilson.ruffo', 'orange') };
  const p = (name: string, type: Property['type'], options?: Option[]): Property => ({ id: newId(), name, type, ...(options ? { options } : {}) });
  const P = {
    descricao: p('Descrição', 'text'),
    status: p('Status', 'status', Object.values(status)),
    inicio: p('Data de início', 'date'),
    termino: p('Data de término', 'date'),
    equipe: p('Equipe', 'person', Object.values(people)),
    prioridade: p('Prioridade', 'select', Object.values(prio)),
    obs1: p('Observação 1', 'text'),
    dataObs1: p('Data Observação 1', 'date'),
    obs2: p('Observação 2', 'text'),
    data: p('Data', 'date'),
    texto: p('Texto', 'text'),
    notion: p('Link no Notion', 'url'),
  };
  const statusOf = { 'Não iniciado': status.naoIniciado, 'Em andamento': status.andamento, Concluído: status.concluido };

  const db = makeBlock('database', {
    text: 'Automações Processos',
    icon: '🤖',
    schema: [{ id: 'title', name: 'Projeto', type: 'title' }, ...Object.values(P)],
    views: [
      makeView('table', 'Todos os projetos', { sorts: [{ propId: P.inicio.id, dir: 'asc' }] }),
      makeView('board', 'Por status', { groupBy: P.status.id, sorts: [{ propId: P.inicio.id, dir: 'asc' }] }),
      makeView('table', 'Minhas', {
        filters: [{ id: newId(), propId: P.equipe.id, op: 'contains', value: people.andre.id }],
        sorts: [{ propId: P.termino.id, dir: 'asc' }],
      }),
    ],
  });
  let next = insertBlock(ws, db, null);
  for (const r of ROWS) {
    const props: Record<ID, PropValue> = {
      [P.descricao.id]: r.descricao,
      [P.status.id]: statusOf[r.status].id,
      [P.inicio.id]: r.inicio ?? null,
      [P.termino.id]: r.termino ?? null,
      [P.equipe.id]: r.equipe.map((k) => people[k].id),
      [P.prioridade.id]: r.prioridade ? prio[r.prioridade].id : null,
      [P.obs1.id]: r.obs1 ?? '',
      [P.dataObs1.id]: r.dataObs1 ?? null,
      [P.obs2.id]: r.obs2 ?? '',
      [P.data.id]: r.data ?? null,
      [P.texto.id]: r.texto ?? '',
      [P.notion.id]: r.notion,
    };
    const row = addRow(next, db.id, r.projeto, props);
    next = insertBlock(row.ws, makeBlock('text'), row.id);
  }
  return { ...next, imports: [...(next.imports ?? []), AUTOMACOES_IMPORT] };
}

/** Applies imports a saved workspace has not received yet. */
export function applyPendingImports(ws: Workspace): Workspace {
  return ws.imports?.includes(AUTOMACOES_IMPORT) ? ws : addAutomacoesProcessos(ws);
}
