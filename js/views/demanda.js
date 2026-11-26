// Aba Demanda: pedidos de missão por aluno (inclusive missões extras) e filtros (só quem voa, o nome, o curso do aluno e a
// missão). Os campos são discretos (parecem texto até o mouse passar ou o foco chegar); o que a missão exige do instrutor
// fica na dica do campo da missão.
import { MIS, GROUND_EQ_TYPE, T, NI, DURACAO_MAXIMA_H, GROUND_DURATION_H } from '../config.js';
import { matriculasDoTipo } from '../frota.js';
import { esc, opts, hm, chaveDeBusca } from '../format.js';
import { isGroundMission, opcoesDeDisponibilidade, duracaoFixaDaMissao } from '../rules.js';
import { horariosDaMissao } from '../horarios.js';
import { descreverExigencias } from '../habilitacoes.js';
import { S, estadoDaEscala, inativoNaDataAberta, programaLido } from '../state.js';
import { exigeDaMissaoDoPedido } from '../programa.js';
import { $, trocarConteudo } from '../dom.js';
import { renderAuditPanel } from './escala.js';
import { etapaNaDemanda } from './etapas.js';
import { instrutoresDoPedido } from '../instrutor-escolhido.js';
import { chaveDoVoo } from '../voo.js';
import { nomeDoRecurso } from '../categorias.js';
import { criarFiltroDosCursos, cursoDaLinha } from './filtro-dos-cursos.js';
import { nenhumComOsFiltros } from './linhas-filtradas.js';

function allowedEqOptionsForMission(mis, currentEq) {
  const m = MIS[mis] || MIS['Voo Local'];
  return opts(m.eq.map(eq => [eq, eq]), currentEq);
}

// Os horários do pedido são os da categoria do avião (o PA-34 tem os seus; o Noturno, 17:30). Uma preferência que
// não está na lista (a lista mudou depois) aparece marcada
function opcoesDeHorario(lista, valor) {
  const itens = [[-1, '—'], ...lista.map(m => [m, hm(m) + (m === T[NI] ? ' (noturno)' : '')])];
  if (Number.isInteger(valor) && valor >= 0 && !lista.includes(valor)) itens.push([valor, `${hm(valor)} (fora da lista)`]);
  return opts(itens, valor);
}

// O instrutor do pedido: "Automático" (o app escolhe; com o “Priorizar com” do aluno, um dos instrutores dele) ou um escolhido
// pelo operador, que vale mais que a escolha do app
function opcoesDeInstrutor(stu, d) {
  // Com o que a missão do curso do pedido exige do INVA
  const lista = instrutoresDoPedido(estadoDaEscala(), stu, { ...d, exige: exigeDaMissaoDoPedido(programaLido(), d, stu) }).map(o => [o.id, o.nota ? `${o.nm} (${o.nota})` : o.nm]);
  // O "Priorizar com" do aluno, só com os instrutores ativos na data (o inativo não é escolhido pelo app)
  const pares = (stu.voaCom || []).map(id => S.ins.find(x => x.id === id)).filter(x => x && !inativoNaDataAberta(x)).map(x => x.nm);
  return opts([['', pares.length ? `Automático (prioriza ${pares.join(', ')})` : 'Automático'], ...lista], d.insId || '');
}

// O voo agendado na Escala (o voo fixo com a marca agendado): o horário e o recurso dele. Ele explica por que mudar a
// preferência do pedido não muda o voo
function tagDoAgendado(stu, mid) {
  const pino = (S.fixos || {})[chaveDoVoo(stu.id, mid)];
  if (!pino || !pino.agendado) return '';
  return ` <span class="tag" data-dica="voo-agendado"><svg class="ico" aria-hidden="true"><use href="#i-cadeado"/></svg>agendado ${hm(pino.a)} · ${esc(nomeDoRecurso(pino.r))}</span>`;
}

export const singleDemandRowHTML = (stu, d, mid = 0) => {
  const isExtra = mid !== 0;
  const horarios = horariosDaMissao(S.horarios, d.mis, isGroundMission(d.mis) ? GROUND_EQ_TYPE : d.eq);
  const isGnd = isGroundMission(d.mis);
  const trCls = `${d.fly ? 'on p' + d.pr : 'off'}${isExtra ? ' extra-row' : ''}`;
  // A missão do curso: o código do pedido, ou a próxima do programa para usar; o voo agendado na Escala
  const etapa = etapaNaDemanda(stu, d, mid) + tagDoAgendado(stu, mid);
  const firstCell = isExtra
    ? `<div class="stu-cell"><span class="sm">↳ missão extra</span>${etapa}<button class="x edit-only" data-act="del-mis" data-id="${stu.id}" data-mid="${mid}" aria-label="Tirar a missão extra de ${esc(stu.nm)}" title="Tirar esta missão extra">✕</button></div>`
    : `<div class="stu-cell"><span>${esc(stu.nm)}</span>${inativoNaDataAberta(stu) ? ' <span class="tag">inativo</span>' : ''}${etapa}<button class="btn-add-mis edit-only" data-act="add-mis" data-id="${stu.id}" title="Outra missão para este aluno no mesmo dia" aria-label="Mais uma missão para ${esc(stu.nm)}">+ missão</button></div>`;
  const soParafuso = d.mis === 'Parafuso' && d.eq === 'C152' ? matriculasDoTipo(S.frota || [], 'C152', { parafuso: true }) : [];
  // O que a missão exige do INVA: o tipo, o avião, o curso do aluno e a missão do curso do pedido
  const exige = `Exige ${descreverExigencias(d.mis, isGnd ? GROUND_EQ_TYPE : d.eq, { curso: stu.curso, exige: exigeDaMissaoDoPedido(programaLido(), d, stu) })}${soParafuso.length ? ` (no ${soParafuso.join(' ou ')})` : ''}`;
  const de = ` de ${esc(stu.nm)}`;

  const nbOpts = isGnd
    ? `<select data-f="nb" disabled title="Ground School tem duração fixa de 01h30" aria-label="Duração de ${esc(stu.nm)}"><option value="${GROUND_DURATION_H}" selected>1h30</option></select>`
    // O Noturno: 4 h no dia (o translado e o noturno em BH); a volta é no dia seguinte, às 07:30
    : d.mis === 'Noturno'
      ? `<select data-f="nb" disabled title="1 h de translado para BH e 3 h de noturno em BH; a volta, 1 h, no dia seguinte às 07:30" aria-label="Duração de ${esc(stu.nm)}"><option value="${duracaoFixaDaMissao('Noturno')}" selected>4 h</option></select>`
    // A duração digitada, fracionada, até 5 h
    : `<input type="number" class="duracao" data-f="nb" min="0.1" max="${DURACAO_MAXIMA_H}" step="0.1" inputmode="decimal" value="${esc(d.nb)}" aria-label="Duração de ${esc(stu.nm)}, em horas">`;

  return `<tr data-k="d" data-id="${stu.id}" data-mid="${mid}" data-nm="${esc(chaveDeBusca(stu.nm))}" data-curso="${esc(stu.curso || '')}" data-mis="${esc(d.mis)}" class="${trCls}">
    <td>${firstCell}</td>
    <td><label class="alvo"><input type="checkbox" class="sw" data-f="fly"${d.fly ? ' checked' : ''} aria-label="${esc(stu.nm)} vai voar"></label></td>
    <td><select data-f="mis" title="${esc(exige)}" aria-label="Missão${de}">${opts(Object.keys(MIS).map(m => [m, m]), d.mis)}</select></td>
    <td><select data-f="eq"${isGnd ? ' disabled' : ''} aria-label="Recurso${de}">${allowedEqOptionsForMission(d.mis, d.eq)}</select></td>
    <td><select data-f="insId" class="${d.insId ? 'escolhido' : ''}" aria-label="Instrutor${de}">${opcoesDeInstrutor(stu, d)}</select></td>
    <td><select data-f="p1" aria-label="1ª preferência${de}">${opcoesDeHorario(horarios, d.p1)}</select></td>
    <td><select data-f="p2" aria-label="2ª preferência${de}">${opcoesDeHorario(horarios, d.p2)}</select></td>
    <td><select data-f="jan" aria-label="Disponibilidade${de}">${opts(opcoesDeDisponibilidade(horarios), d.jan || '')}</select></td>
    <td>${nbOpts}</td>
    <td><select data-f="pr" aria-label="Prioridade${de}">${opts([1, 2, 3, 4, 5].map(n => [n, n]), d.pr)}</select></td>
  </tr>`;
};

const studentDemandRowsHTML = stu => {
  let html = singleDemandRowHTML(stu, stu, 0);
  if (Array.isArray(stu.extra) && stu.extra.length) {
    html += stu.extra.map(ex => singleDemandRowHTML(stu, ex, ex.mid)).join('');
  }
  return html;
};

export const cnt = () => {
  let activeMissions = 0;
  let activeStudents = 0;
  S.stu.forEach(s => {
    const extraActive = (s.extra || []).filter(ex => ex.fly).length;
    const totStu = (s.fly ? 1 : 0) + extraActive;
    if (totStu > 0) activeStudents++;
    activeMissions += totStu;
  });
  $('#cnt').textContent = `${activeStudents} / ${S.stu.length} aluno(s) · ${activeMissions} missão(ões) marcada(s)`;
  // "Pôr um aluno na demanda": os alunos ativos que ainda não voam na data
  const fora = S.stu.filter(s => !s.fly && !(s.extra || []).some(ex => ex.fly) && !inativoNaDataAberta(s));
  $('#alunos-fora').innerHTML = fora.map(s => `<option value="${esc(s.nm)}"></option>`).join('');
};

export const rDem = () => {
  // As opções do filtro dos cursos acompanham os programas e os cursos dos alunos
  if (filtroDosCursos) filtroDosCursos.desenhar();
  if (!S.stu.length) {
    trocarConteudo($('#dem'), `<tr class="empty-dem"><td colspan="10" class="h" style="padding:16px">Nenhum aluno cadastrado. Cadastre os alunos em Alunos.</td></tr>`);
    cnt();
    renderAuditPanel();
    return;
  }
  trocarConteudo($('#dem'), S.stu.map(studentDemandRowsHTML).join(''));
  cnt();
  applyDemandFilters();
  renderAuditPanel();
};

// O filtro dos cursos na Demanda (js/views/filtro-dos-cursos.js), o mesmo de Alunos, com as mesmas marcas: o pedido
// aparece se o aluno está em algum dos cursos marcados, junto com os outros filtros da barra
let filtroDosCursos = null;
export function prepararFiltroDosCursos() {
  filtroDosCursos = criarFiltroDosCursos('flt-dem-cur', filtrarDemanda);
}

// O aluno posto agora na demanda ("Pôr um aluno na demanda") continua à vista mesmo fora dos filtros, até eles mudarem:
// as marcas dos cursos podem ter vindo de Alunos, e o pedido incluído não some na hora
const mantidosNaDemanda = new Set();
export const manterNaDemanda = id => mantidosNaDemanda.add(id);

// Um filtro da barra mudou (a busca, a missão, as marcas dos cursos, aqui ou em Alunos): vale para todos os pedidos
export function filtrarDemanda() {
  mantidosNaDemanda.clear();
  applyDemandFilters();
}

function applyDemandFilters() {
  // O nome sem acentos: "joao" acha "João"
  const q = chaveDeBusca($('#flt-dem') && $('#flt-dem').value);
  const mis = $('#flt-dem-mis') ? $('#flt-dem-mis').value : '';
  const noCurso = filtroDosCursos ? filtroDosCursos.quemPassa() : () => true;
  document.querySelectorAll('#dem tr[data-k="d"]').forEach(tr => {
    const matchName = !q || tr.dataset.nm.includes(q);
    const matchMis = !mis || tr.dataset.mis === mis;
    tr.hidden = !(mantidosNaDemanda.has(+tr.dataset.id) || (matchName && matchMis && noCurso(cursoDaLinha(tr))));
  });
  conferirNenhumNaDemanda();
}

// Com os filtros da barra escondendo todos os pedidos, a linha "Nenhum aluno com esses filtros", com "Limpar filtros"
// (como em Instrutores e Alunos). Ela conta só os pedidos que "Só quem voa" deixa: sem ninguém voando, nenhum filtro da
// barra esconde nada, e a contagem de cima já diz "0 missão(ões) marcada(s)". Vale de novo quando "Só quem voa" muda e
// quando o Voa de um pedido muda (a linha dele é refeita)
export function conferirNenhumNaDemanda() {
  const corpo = $('#dem');
  if (!corpo) return;
  const soQuemVoa = corpo.classList.contains('only');
  const restam = [...corpo.querySelectorAll(':scope > tr[data-k="d"]')].filter(tr => !(soQuemVoa && tr.classList.contains('off')));
  nenhumComOsFiltros(corpo, restam.length > 0 && restam.every(tr => tr.hidden), { nome: 'aluno' });
}

// "Limpar filtros" da Demanda: a busca, a missão e as marcas dos cursos (também as de Alunos, que são as mesmas) voltam a
// vazio, e o foco vai para a busca. "Só quem voa" fica como está
export function limparFiltrosDaDemanda() {
  $('#flt-dem').value = '';
  $('#flt-dem-mis').value = '';
  if (filtroDosCursos) filtroDosCursos.limpar();
  filtrarDemanda();
  $('#flt-dem').focus();
}
