// O instrutor escolhido pelo operador para um voo. O que o operador define vale mais que a escolha do app:
// - na Demanda, o pedido do dia leva o instrutor (campo insId do pedido): o motor procura o horário e o avião só com
//   ele, antes dos pedidos sem escolha, e a divisão das horas e a compactação não o trocam;
// - na Escala, o voo fica onde está (horário e avião) com o instrutor escolhido: ele vira um voo fixo, e o resto da
//   escala é refeito em volta. O pedido também guarda o instrutor, então ele continua quando o voo é solto.
// Na turma de Ground, o que muda num voo que já está na escala muda a turma inteira (uma turma tem um instrutor só).
// "Automático" devolve a escolha ao app.
import { GROUND_EQ_TYPE } from './config.js';
import { podeFazer } from './habilitacoes.js';
import { historicoDoDia } from './noturno.js';
import { FROTA_INICIAL, recursoDaFrota } from './frota.js';
import { normalizarLimites } from './limites.js';
import { problemasDoInstrutor } from './viabilidade.js';
import { isGroundMission } from './rules.js';
import { pinoDoVoo, fixoPeloStatus, fixosQueVoltam } from './fixos.js';
import { chaveDoVoo, pedidoDoAluno, statusDoVoo, umPorUnidade, compromissoDoVoo, exigeDosVoos } from './voo.js';
import { inativoNoEstado } from './inativos.js';

const instrutorValido = v => Number.isInteger(v) && v > 0;

// Por que o pedido não pode voar com o instrutor em nenhum horário (o texto curto das opções), ou ''
function impedimentoDoPedido(estado, x, aluno, pedido) {
  // O inativo no cadastro primeiro: no estado da escala ele também não vem
  if (inativoNoEstado(estado, x)) return 'inativo';
  if (!x.on) return 'fora nesta data';
  // Com o que a missão do curso do pedido exige do INVA (exige: o estado da escala o deriva; a Demanda o passa)
  if (!podeFazer(x, pedido.mis, isGroundMission(pedido.mis) ? GROUND_EQ_TYPE : pedido.eq, { curso: aluno.curso, exige: pedido.exige })) return 'sem a habilitação';
  if ((aluno.bl || []).includes(x.id)) return 'em Não escalar com';
  return '';
}

// Demanda: os instrutores que podem ser escolhidos para o pedido (os habilitados para a missão, fora do "Não escalar
// com"; o que não vem na data aparece com a nota). O escolhido aparece sempre, com o motivo quando não serve mais
export function instrutoresDoPedido(estado, aluno, pedido) {
  const lista = estado.ins.map(x => ({ id: x.id, nm: x.nm, nota: impedimentoDoPedido(estado, x, aluno, pedido) }))
    .filter(o => o.id === pedido.insId || ['', 'fora nesta data'].includes(o.nota));
  if (instrutorValido(pedido.insId) && !lista.some(o => o.id === pedido.insId)) lista.unshift({ id: pedido.insId, nm: 'Instrutor fora do cadastro', nota: 'o app escolhe' });
  return lista;
}

// O que pesa contra o instrutor no voo (o texto curto das opções da Escala), pelo código da regra
export const NOTA_DO_PROBLEMA = {
  'instrutor-indisponivel': 'indisponível', habilitacao: 'sem a habilitação', 'instrutor-ocupado': 'ocupado',
  bloqueio: 'em Não escalar com', 'limite-da-lei': 'limite da lei', peso: 'peso acima do limite'
};

// A unidade do voo: na turma de Ground, todos os alunos dela
const unidadeDe = (resultado, voo) => (voo.isGround ? resultado.out.filter(o => o.classKey === voo.classKey) : [voo]);

// Escala: os instrutores para o voo, no mesmo horário, com o problema de cada um contra os outros voos do dia (o
// operador pode escolher mesmo assim: o voo fica fixo e o resto é refeito em volta; o que não tiver solução fica em
// conflito, com as sugestões). O ocupado diz com quem: aquele voo muda de instrutor ou de horário. Os que servem vêm
// antes
export function instrutoresDoVoo(estado, resultado, fKey) {
  const voo = resultado && resultado.out.find(o => o.fKey === fKey);
  if (!voo) return [];
  const grupo = unidadeDe(resultado, voo);
  const chaves = new Set(grupo.map(o => o.fKey));
  const outros = umPorUnidade(resultado.out.filter(o => !chaves.has(o.fKey) && statusDoVoo(o, estado.fStatus) !== 'Cancelado'));
  const alunos = new Map(estado.stu.map(s => [s.id, s]));
  const limites = normalizarLimites(estado.limites);
  const historicoDe = historicoDoDia(estado);
  const exige = exigeDosVoos(estado.stu)(grupo);
  // O instrutor inativo no cadastro não é opção, a não ser o do próprio voo (com a nota)
  const opcoes = estado.ins.filter(x => !inativoNoEstado(estado, x) || x.id === voo.insId).map(x => {
    // Com o curso do aluno (o noturno do PC é IFR), o avião do voo (a habilitação própria dele) e o que a missão do curso
    // dos pedidos da unidade exige do INVA
    const contexto = { curso: (alunos.get(voo.stuId) || {}).curso, recurso: voo.isGround ? null : recursoDaFrota(Array.isArray(estado.frota) ? estado.frota : FROTA_INICIAL, voo.r), exige };
    const [problema] = problemasDoInstrutor(x, { mis: voo.mis, tipo: voo.isGround ? GROUND_EQ_TYPE : voo.eqType, a: voo.a, b: voo.b, alunos: grupo.map(o => alunos.get(o.stuId)), stuKg: voo.stuKg, ...contexto }, {
      compromissos: outros.filter(o => o.insId === x.id).map(o => compromissoDoVoo(o)),
      historico: historicoDe(x.id), limites, peso: voo.isGround ? null : {}
    });
    if (x.id === voo.insId || !problema) return { id: x.id, nm: x.nm, nota: x.id === voo.insId && inativoNoEstado(estado, x) ? 'inativo' : '' };
    const comQuem = problema.codigo === 'instrutor-ocupado' && outros.find(o => o.insId === x.id && o.a < voo.b && o.b > voo.a);
    return { id: x.id, nm: x.nm, nota: comQuem ? `ocupado com ${comQuem.isGround ? `a turma de ${comQuem.mis}` : comQuem.s}` : NOTA_DO_PROBLEMA[problema.codigo] || '' };
  });
  return [...opcoes.filter(o => !o.nota), ...opcoes.filter(o => o.nota)];
}

const pedidoDe = (estado, stuId, mid) => {
  const aluno = estado.stu.find(s => s.id === stuId);
  return aluno ? pedidoDoAluno(aluno, mid) || null : null;
};

// O voo fixo pela escolha na Escala, e não pela escala aprovada, pelo status nem pelo agendamento na Escala (o pino
// agendado), pode ser solto
const soltavel = (estado, fKey, pino) => !estado.aprovacao && !fixoPeloStatus(fKey, estado.fStatus) && !pino.agendado;

// Escolhe o instrutor (insId; null: "Automático") do pedido do aluno (stuId, mid). Muda o estado e devolve o que
// mudou, como estava antes (a reversão do histórico) e quantos alunos da turma mudaram juntos.
// - noLugar: false (Demanda) muda o pedido; o voo que já está fixo fica onde está, com o instrutor novo.
// - noLugar: true (Escala) também fixa o voo onde ele está, com o instrutor novo; o voo fixo leva a marca escolhido
//   (a mudança de status e a reabertura da escala não o soltam).
// - "Automático", na Demanda ou na Escala, devolve a escolha ao app: o voo fixo pela escolha na Escala é solto; o da
//   escala aprovada, o fixado pelo status e o agendado na Escala continuam fixos, com o instrutor de agora.
export function escolherInstrutor(estado, resultado, { stuId, mid = 0 }, insId, { noLugar = false } = {}) {
  const fixos = estado.fixos || {};
  const fKey = chaveDoVoo(stuId, mid);
  const voo = resultado && Array.isArray(resultado.out) ? resultado.out.find(o => o.fKey === fKey) || null : null;
  const mexeNoVoo = Boolean(voo) && (noLugar || Object.hasOwn(fixos, fKey));
  const grupo = mexeNoVoo ? unidadeDe(resultado, voo) : [];
  const alvos = mexeNoVoo ? grupo.map(o => ({ stuId: o.stuId, mid: o.mid || 0 })) : [{ stuId, mid }];

  // Antes: os pedidos, os voos fixos e os que não eram fixos (para a reversão)
  const antes = {
    pedidos: alvos.map(p => ({ ...p, insId: (pedidoDe(estado, p.stuId, p.mid) || {}).insId || 0 })),
    fixos: Object.fromEntries(grupo.filter(o => fixos[o.fKey]).map(o => [o.fKey, fixos[o.fKey]])),
    soltar: grupo.filter(o => !fixos[o.fKey]).map(o => o.fKey)
  };

  for (const p of alvos) {
    const pedido = pedidoDe(estado, p.stuId, p.mid);
    if (!pedido) continue;
    if (instrutorValido(insId)) pedido.insId = insId;
    else delete pedido.insId;
  }

  if (mexeNoVoo) {
    const novos = { ...fixos };
    for (const o of grupo) {
      const atual = novos[o.fKey];
      if (instrutorValido(insId)) {
        if (atual || noLugar) novos[o.fKey] = { ...(atual || pinoDoVoo(o)), insId, ...(noLugar ? { escolhido: true } : {}) };
      } else if (atual && atual.escolhido) {
        if (soltavel(estado, o.fKey, atual)) delete novos[o.fKey];
        else { const { escolhido: _, ...resto } = atual; novos[o.fKey] = resto; }
      }
    }
    estado.fixos = novos;
  }
  return { antes, alunos: alvos.length };
}

// O que o histórico diz dos agendamentos em volta da mudança revertida (js/reversoes.js, agendamentosEmVolta): sem ele,
// nenhum agendamento mudou depois dela
const SEM_AGENDAMENTOS = { mudados: new Set(), soltos: new Set() };

// Desfaz uma escolha (a reversão do histórico): os pedidos voltam como estavam e os voos fixos também. O voo que não
// era fixo deixa de ser; se depois disso a escala foi aprovada, o voo ganhou um status que fixa ou foi agendado na
// Escala, ele continua fixo onde está, com o instrutor de agora, só sem a marca da escolha (o instrutor de antes pode
// já ter outro voo no horário: a escala foi refeita em volta da escolha). O voo agendado volta só enquanto o
// agendamento continua (js/fixos.js, fixosQueVoltam; emVolta: o que o histórico diz): a chave de um agendamento
// desfeito depois da escolha, ou feito depois dela, fica como está, com o instrutor escolhido de agora; e, como a troca
// do instrutor não solta o voo agendado, o que o soltou depois dela continua valendo
export function reverterEscolha(estado, { pedidos, fixos, soltar }, emVolta = SEM_AGENDAMENTOS) {
  const { fixos: voltam, semInstrutor } = fixosQueVoltam(estado, fixos, { ...emVolta, soltaAgendado: false });
  for (const { stuId, mid, insId } of pedidos) {
    const pedido = pedidoDe(estado, stuId, mid);
    if (!pedido || semInstrutor.has(chaveDoVoo(stuId, mid))) continue;
    if (insId) pedido.insId = insId;
    else delete pedido.insId;
  }
  const novos = { ...(estado.fixos || {}), ...voltam };
  for (const k of soltar) {
    if (!novos[k] || emVolta.mudados.has(k)) continue;
    if (soltavel(estado, k, novos[k])) delete novos[k];
    else { const { escolhido: _, ...resto } = novos[k]; novos[k] = resto; }
  }
  estado.fixos = novos;
}

// Os pedidos da unidade do voo (na turma de Ground, todos os alunos dela) que têm o instrutor escolhido, como estão
export function escolhasDaUnidade(estado, resultado, fKey) {
  const voo = resultado && resultado.out.find(o => o.fKey === fKey);
  if (!voo) return [];
  return unidadeDe(resultado, voo).map(o => ({ stuId: o.stuId, mid: o.mid || 0, insId: (pedidoDe(estado, o.stuId, o.mid || 0) || {}).insId || 0 }))
    .filter(p => p.insId);
}

// Muda o instrutor escolhido dos pedidos (insId; null: "Automático"), com o reparo de um conflito: trocar o instrutor
// é uma escolha do operador, e soltar o voo devolve a escolha ao app
export function escolherNosPedidos(estado, pedidos, insId) {
  for (const p of pedidos) {
    const pedido = pedidoDe(estado, p.stuId, p.mid);
    if (!pedido) continue;
    if (instrutorValido(insId)) pedido.insId = insId;
    else delete pedido.insId;
  }
}

// Desfaz um reparo das Sugestões (a reversão do histórico): os voos voltam a ser fixos como antes dele, e o instrutor
// escolhido dos pedidos também. O voo agendado volta só enquanto o agendamento continua (js/fixos.js, fixosQueVoltam;
// emVolta: o que o histórico diz): o que o próprio reparo soltou ("Soltar o voo"), com o pedido voando, volta
export function reverterReparo(estado, { fixos, pedidos = [] }, emVolta = SEM_AGENDAMENTOS) {
  const { fixos: voltam, semInstrutor } = fixosQueVoltam(estado, fixos, { ...emVolta, soltaAgendado: true });
  estado.fixos = { ...(estado.fixos || {}), ...voltam };
  for (const p of pedidos) {
    if (!semInstrutor.has(chaveDoVoo(p.stuId, p.mid))) escolherNosPedidos(estado, [p], p.insId);
  }
}
