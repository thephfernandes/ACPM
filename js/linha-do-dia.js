// A linha do dia, sem DOM: os quatro cartões das etapas (Agenda, Demanda, Escala, Aprovar), cada um com o valor dele (um
// sentido fixo por cartão, dito na dica), o estado (o pior das tarefas) e as tarefas, que levam à tela onde cada coisa se
// resolve; e o selo de Recursos. Uma função por cartão: cada passo seguinte muda só a do cartão dele.
// contexto: { S, RES, pedidos: lista | null, leituraDosPedidos: 'lendo' | 'erro' | 'lidos', perfil, opera, horasLidas,
// naoLidos: [{ parte, texto }], data, hoje } (js/views/linha.js, contextoDoDia). Os avisos da data, no trilho:
// avisosDaData
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
  if (!n) return {};
  return { rec: { valor: String(n), estado: 'atencao', dica: `${plural(n, 'avião parado', 'aviões parados')} ou perto da revisão de 50 horas` } };
}

// Os avisos da data, no trilho: cada recusa, conflito e aviso do motor (com o horário do voo, quando ele está na escala), os
// aviões parados ou perto da revisão, os pedidos que ainda não estão na demanda (para quem opera), os pedidos que não foram
// lidos e os dados que não foram lidos. Na ordem: erro, aviso, info; em cada uma, os sem horário primeiro, depois pelo
// minuto. destino: a tela onde ele se resolve (null, quando o perfil não a vê ou não há tela: o aviso do alto tem "Tentar de
// novo"). [{ id, gravidade, minuto, duracaoMin?, titulo, texto, destino }]
const ORDEM = ['erro', 'aviso', 'info'];
export function avisosDaData(ctx) {
  const avisos = [];
  const destino = tela => (podeVer(tela, ctx.perfil) ? { tela } : null);
  const voos = new Map(((ctx.RES && ctx.RES.out) || []).map(o => [o.fKey, o]));
  ((ctx.RES && ctx.RES.al) || []).forEach((a, i) => {
    const voo = a.fKey && voos.get(a.fKey);
    avisos.push({
      id: `${a.t}:${a.fKey || i}`, gravidade: a.t === 'warn' ? 'aviso' : 'erro', minuto: voo ? voo.a : null,
      ...(voo ? { duracaoMin: voo.b - voo.a } : {}), titulo: a.s || '', texto: a.m || '', destino: destino('esc')
    });
  });
  const avioes = avioesPertoDaRevisao(ctx);
  if (avioes) avisos.push({ id: 'recursos', gravidade: 'aviso', minuto: null, titulo: `${plural(avioes, 'avião parado', 'aviões parados')} ou perto da revisão de 50 horas`, texto: '', destino: destino('rec') });
  if (ctx.leituraDosPedidos === 'erro') {
    avisos.push({ id: 'pedidos-nao-lidos', gravidade: 'aviso', minuto: null, titulo: 'Não foi possível ler os pedidos desta data.', texto: '', destino: destino('age') });
  } else if (ctx.opera && ctx.leituraDosPedidos === 'lidos') {
    const { n } = contagemDosPedidos(ctx);
    if (n) avisos.push({ id: 'pedidos-nao-importados', gravidade: 'aviso', minuto: null, titulo: `${plural(n, 'pedido da agenda ainda não está', 'pedidos da agenda ainda não estão')} na demanda`, texto: '', destino: destino('age') });
  }
  for (const { parte, texto } of ctx.naoLidos || []) {
    avisos.push({ id: `nao-lido:${parte}`, gravidade: parte === 'horas' ? 'erro' : 'aviso', minuto: null, titulo: texto, texto: '', destino: null });
  }
  const chave = a => [ORDEM.indexOf(a.gravidade), a.minuto === null ? -1 : a.minuto];
  return avisos.sort((x, y) => {
    const [gx, mx] = chave(x), [gy, my] = chave(y);
    return gx - gy || mx - my || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
  });
}
