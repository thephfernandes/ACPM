// A linha do dia, sem DOM: os quatro cartões das etapas (Agenda, Demanda, Escala, Aprovar), cada um com o valor dele (um
// sentido fixo por cartão, dito na dica), o estado (o pior das tarefas) e as tarefas, que levam à tela onde cada coisa se
// resolve; o selo de Recursos; e os avisos da data, no trilho. Uma função por cartão e uma por grupo de avisos: cada passo
// seguinte muda só a dele.
// contexto: { S, RES, pedidos: lista | null, leituraDosPedidos: 'lendo' | 'erro' | 'lidos', perfil, opera, horasLidas,
// indisponiveis: [{ id, texto }], data, hoje } (js/views/linha.js, contextoDoDia)
import { REVISAO_H } from './config.js';
import { inativo, inativoValeEm } from './inativos.js';
import { ESTAGIOS, podeVer } from './telas.js';

// Os estados, do pior ao melhor; "nenhum" não entra na conta do cartão
const GRAVIDADE = ['falhou', 'atencao', 'andamento', 'pendente', 'feito'];
const PERTO_DA_REVISAO_H = 5;

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const tarefa = (id, rotulo, valor, estado, tela) => ({ id, rotulo, valor: String(valor), estado, destino: { tela } });

// O pior estado das tarefas (sem as "nenhum"); todas "nenhum": nenhum
function estadoDoCartao(tarefas) {
  const estados = tarefas.map(t => t.estado).filter(e => e !== 'nenhum');
  return estados.length ? GRAVIDADE.find(e => estados.includes(e)) : 'nenhum';
}

// O que vale na data: o inativo só de hoje em diante
const inativoNaData = (item, { data, hoje }) => inativo(item) && inativoValeEm(data, hoje);

// Os pedidos não cancelados da data e os que ainda não estão na demanda (sem os do aluno inativo, que ficam "Aluno inativo")
function contagemDosPedidos(ctx) {
  const lista = (ctx.pedidos || []).filter(p => !p.cancelada_em);
  const importadas = (ctx.S && ctx.S.importadas) || [];
  const alunos = new Map(((ctx.S && ctx.S.stu) || []).map(s => [s.id, s]));
  const naoImportados = lista.filter(p => !importadas.includes(p.id) && !inativoNaData(alunos.get(p.aluno), ctx));
  return { p: lista.length, n: naoImportados.length };
}

function tarefasDosPedidos(ctx) {
  const leitura = ctx.leituraDosPedidos;
  if (leitura === 'erro') {
    const tarefas = [tarefa('registrados', 'pedidos da data', '—', 'falhou', 'age')];
    if (ctx.opera) tarefas.push(tarefa('nao-importados', 'ainda não importados', '—', 'falhou', 'age'));
    return tarefas;
  }
  const { p, n } = contagemDosPedidos(ctx);
  const lidos = leitura === 'lidos';
  const tarefas = [tarefa('registrados', 'pedidos da data', lidos ? p : '—', !lidos ? 'nenhum' : p ? 'feito' : 'pendente', 'age')];
  if (ctx.opera) tarefas.push(tarefa('nao-importados', 'ainda não importados', lidos ? n : '—', !lidos || !p ? 'nenhum' : n ? 'atencao' : 'feito', 'age'));
  return tarefas;
}

function cartaoDosPedidos(ctx) {
  const tarefas = tarefasDosPedidos(ctx);
  const { p } = contagemDosPedidos(ctx);
  const erro = ctx.leituraDosPedidos === 'erro';
  const lidos = ctx.leituraDosPedidos === 'lidos';
  return {
    valor: lidos ? String(p) : '—',
    dica: erro ? 'Os pedidos desta data não foram lidos' : lidos ? `${plural(p, 'pedido', 'pedidos')} nesta data` : 'Os pedidos desta data estão sendo lidos',
    tarefas
  };
}

// Os aviões disponíveis na data que param ou chegam a menos de 5 h da revisão de 50 horas (o selo de Recursos e a atenção
// dos recursos da Demanda)
function avioesPertoDaRevisao(ctx) {
  const revisao = (ctx.RES && ctx.RES.revisao) || {};
  const frota = (ctx.S && ctx.S.frota) || [];
  const av = (ctx.S && ctx.S.av) || {};
  return Object.entries(revisao).filter(([r, v]) => av[r] !== false && !inativoNaData(frota.find(f => f.reg === r), ctx)
    && v && (v.paraAs !== null || REVISAO_H - v.fim < PERTO_DA_REVISAO_H)).length;
}

const textoDaRevisao = n => `${plural(n, 'avião parado', 'aviões parados')} ou perto da revisão de 50 horas`;

function tarefasDaDemanda(ctx) {
  const S = ctx.S || {};
  const pedidas = (ctx.RES && ctx.RES.tot) || 0;
  const frota = (S.frota || []).filter(f => !inativoNaData(f, ctx));
  const disponiveis = frota.filter(f => (S.av || {})[f.reg] !== false).length;
  const recursos = !frota.length ? 'pendente' : !disponiveis ? 'falhou' : avioesPertoDaRevisao(ctx) ? 'atencao' : 'feito';
  const instrutores = (S.ins || []).filter(x => !inativoNaData(x, ctx));
  const vem = instrutores.filter(x => x.on).length;
  const invas = !instrutores.length ? 'pendente'
    : !vem ? (pedidas ? 'falhou' : 'nenhum')
      : ctx.horasLidas === false ? 'atencao' : 'feito';
  return [
    tarefa('recursos', 'recursos disponíveis', `${disponiveis} de ${frota.length}`, recursos, 'rec'),
    tarefa('invas', 'instrutores que vêm', `${vem} de ${instrutores.length}`, invas, 'ins')
  ];
}

function cartaoDaDemanda(ctx) {
  const pedidas = (ctx.RES && ctx.RES.tot) || 0;
  return { valor: String(pedidas), dica: plural(pedidas, 'missão pedida', 'missões pedidas'), tarefas: tarefasDaDemanda(ctx) };
}

// As missões na escala: as pedidas menos as que não entraram (como o resumo da Escala conta)
function contagemDaEscala(ctx) {
  const al = (ctx.RES && ctx.RES.al) || [];
  const pedidas = (ctx.RES && ctx.RES.tot) || 0;
  const conta = t => al.filter(a => a.t === t).length;
  return { pedidas, naEscala: pedidas - conta('err'), erros: conta('err'), conflitos: conta('conf'), avisos: al.length - conta('err') - conta('conf') };
}

function tarefasDaEscala(ctx) {
  const { pedidas, naEscala, erros, conflitos, avisos } = contagemDaEscala(ctx);
  return [
    tarefa('montada', 'escala montada', `${naEscala} de ${pedidas}`, !pedidas ? 'pendente' : erros ? 'falhou' : 'feito', 'esc'),
    tarefa('conflitos', 'conflitos e avisos', conflitos + avisos, !pedidas ? 'pendente' : conflitos ? 'falhou' : avisos ? 'atencao' : 'feito', 'esc')
  ];
}

function cartaoDaEscala(ctx) {
  const { pedidas, naEscala } = contagemDaEscala(ctx);
  return { valor: `${naEscala} de ${pedidas}`, dica: `${naEscala} de ${plural(pedidas, 'missão', 'missões')} na escala`, tarefas: tarefasDaEscala(ctx) };
}

// A hora da aprovação, no relógio deste computador (como a barra da aprovação a mostra)
const horaDe = iso => {
  const em = new Date(iso);
  return `${String(em.getHours()).padStart(2, '0')}:${String(em.getMinutes()).padStart(2, '0')}`;
};

function tarefasDeAprovar(ctx) {
  const aprovacao = ctx.S && ctx.S.aprovacao;
  if (aprovacao) {
    return [tarefa('aprovada', `aprovada às ${horaDe(aprovacao.em)}${aprovacao.por ? ` por ${aprovacao.por}` : ''}`, horaDe(aprovacao.em), 'feito', 'apr')];
  }
  const pedidas = (ctx.RES && ctx.RES.tot) || 0;
  if (!pedidas) return [tarefa('aprovada', 'nenhum voo', '—', 'nenhum', 'apr')];
  return [tarefa('aprovada', 'não aprovada', '—', ctx.horasLidas === false ? 'atencao' : 'pendente', 'apr')];
}

function cartaoDeAprovar(ctx) {
  const tarefas = tarefasDeAprovar(ctx);
  return { valor: tarefas[0].valor, dica: tarefas[0].rotulo.replace(/^./, c => c.toUpperCase()), tarefas };
}

const CARTOES = {
  pedidos: { tela: 'age', montar: cartaoDosPedidos },
  processamento: { tela: 'dem', montar: cartaoDaDemanda },
  escala: { tela: 'esc', montar: cartaoDaEscala },
  aprovar: { tela: 'apr', montar: cartaoDeAprovar }
};

// Um cartão por etapa, na ordem: { id, tela, estado, valor, dica, tarefas: [{ id, rotulo, estado, valor, destino }] }
export function linhaDoDia(ctx) {
  return ESTAGIOS.map(id => {
    const { valor, dica, tarefas } = CARTOES[id].montar(ctx);
    return { id, tela: CARTOES[id].tela, estado: estadoDoCartao(tarefas), valor, dica, tarefas };
  });
}

// Os selos dos links dos cadastros: em Recursos, os aviões parados ou perto da revisão de 50 horas
export function selosDosCadastros(ctx) {
  const n = avioesPertoDaRevisao(ctx);
  return n ? { rec: { valor: String(n), estado: 'atencao', dica: textoDaRevisao(n) } } : {};
}

// Os avisos da data, um por item a resolver: { id, gravidade: 'erro' | 'aviso' | 'info', minuto (do voo; null: sem horário),
// duracaoMin?, titulo, texto, destino: { tela, item? } | null (o perfil não abre a tela, ou o aviso se resolve no alto) }

// As missões que não entraram, os conflitos e os avisos da escala. Os de um voo da escala têm o horário dele
function avisosDaEscala({ RES }) {
  const voos = new Map(((RES && RES.out) || []).map(o => [o.fKey, o]));
  const vistos = new Map();
  return ((RES && RES.al) || []).map(a => {
    const base = `${a.t}:${a.fKey ?? [a.codigo, a.stuId, a.insId].filter(x => x !== undefined && x !== null).join('-')}`;
    const vez = (vistos.get(base) || 0) + 1;
    vistos.set(base, vez);
    const voo = a.fKey === undefined ? null : voos.get(a.fKey);
    return {
      id: vez === 1 ? base : `${base}:${vez}`,
      gravidade: a.t === 'err' || a.t === 'conf' ? 'erro' : 'aviso',
      minuto: voo ? voo.a : null, ...(voo ? { duracaoMin: voo.b - voo.a } : {}),
      titulo: a.s, texto: a.m, destino: { tela: 'esc' }
    };
  });
}

function avisosDosRecursos(ctx) {
  const n = avioesPertoDaRevisao(ctx);
  if (!n) return [];
  return [{ id: 'recursos', gravidade: 'aviso', minuto: null, titulo: textoDaRevisao(n), texto: '', destino: podeVer('rec', ctx.perfil) ? { tela: 'rec' } : null }];
}

function avisosDosPedidos(ctx) {
  const aviso = (id, titulo) => [{ id, gravidade: 'aviso', minuto: null, titulo, texto: '', destino: { tela: 'age' } }];
  if (ctx.leituraDosPedidos === 'erro') return aviso('pedidos-nao-lidos', 'Não foi possível ler os pedidos desta data.');
  const { n } = contagemDosPedidos(ctx);
  if (!ctx.opera || ctx.leituraDosPedidos !== 'lidos' || !n) return [];
  return aviso('nao-importados', `${plural(n, 'pedido da agenda ainda não está', 'pedidos da agenda ainda não estão')} na demanda`);
}

// O que a data não leu: sem destino (a faixa do alto tem "Tentar de novo"). Sem as horas dos instrutores, os limites da lei
// não são conferidos: é erro
const avisosDosDados = ctx => (ctx.indisponiveis || []).map(({ id, texto }) =>
  ({ id: `dados:${id}`, gravidade: id === 'horas' ? 'erro' : 'aviso', minuto: null, titulo: texto, texto: '', destino: null }));

// Na ordem: erro, aviso, info; em cada um, os sem horário primeiro, depois pelo horário e pelo id
const ORDEM_DOS_AVISOS = ['erro', 'aviso', 'info'];
export function avisosDaData(ctx) {
  return [avisosDaEscala, avisosDosRecursos, avisosDosPedidos, avisosDosDados].flatMap(grupo => grupo(ctx)).sort((p, q) =>
    ORDEM_DOS_AVISOS.indexOf(p.gravidade) - ORDEM_DOS_AVISOS.indexOf(q.gravidade)
    || (p.minuto ?? -1) - (q.minuto ?? -1)
    || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
}
