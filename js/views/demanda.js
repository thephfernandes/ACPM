// Aba Demanda: pedidos de missão por aluno (inclusive missões extras) e filtros. Os campos são discretos (parecem
// texto até o mouse passar ou o foco chegar); o que a missão exige do instrutor fica na dica do campo da missão.
import { MIS, GROUND_EQ_TYPE, T, NI } from '../config.js';
import { matriculasDoTipo } from '../frota.js';
import { esc, opts, hm } from '../format.js';
import { isGroundMission, opcoesDeDisponibilidade } from '../rules.js';
import { horariosDaMissao } from '../horarios.js';
import { descreverExigencias } from '../habilitacoes.js';
import { S } from '../state.js';
import { $ } from '../dom.js';
import { renderAuditPanel } from './escala.js';
import { etapaNaDemanda } from './etapas.js';

export function allowedEqOptionsForMission(mis, currentEq) {
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

export const singleDemandRowHTML = (stu, d, mid = 0) => {
  const isExtra = mid !== 0;
  const horarios = horariosDaMissao(S.horarios, d.mis, isGroundMission(d.mis) ? GROUND_EQ_TYPE : d.eq);
  const isGnd = isGroundMission(d.mis);
  const trCls = `${d.fly ? 'on p' + d.pr : 'off'}${isExtra ? ' extra-row' : ''}`;
  // A missão do curso (fase 14): o código do pedido, ou a próxima do programa para usar
  const etapa = etapaNaDemanda(stu, d, mid);
  const firstCell = isExtra
    ? `<div class="stu-cell"><span class="sm">↳ missão extra</span>${etapa}<button class="x edit-only" data-act="del-mis" data-id="${stu.id}" data-mid="${mid}" aria-label="Tirar a missão extra de ${esc(stu.nm)}" title="Tirar esta missão extra">✕</button></div>`
    : `<div class="stu-cell"><span>${esc(stu.nm)}</span>${etapa}<button class="btn-add-mis edit-only" data-act="add-mis" data-id="${stu.id}" title="Outra missão para este aluno no mesmo dia" aria-label="Mais uma missão para ${esc(stu.nm)}">+ missão</button></div>`;
  const soParafuso = d.mis === 'Parafuso' && d.eq === 'C152' ? matriculasDoTipo(S.frota || [], 'C152', { parafuso: true }) : [];
  const exige = `Exige ${descreverExigencias(d.mis, isGnd ? GROUND_EQ_TYPE : d.eq)}${soParafuso.length ? ` (no ${soParafuso.join(' ou ')})` : ''}`;
  const de = ` de ${esc(stu.nm)}`;

  const nbOpts = isGnd
    ? `<select data-f="nb" disabled title="Ground School tem duração fixa de 01h30" aria-label="Duração de ${esc(stu.nm)}"><option value="1.5" selected>1h30</option></select>`
    : `<select data-f="nb" aria-label="Duração de ${esc(stu.nm)}">${opts(Array.from({ length: 11 }, (_, i) => [i + 1, (i + 1) + ' h']), d.nb)}</select>`;

  return `<tr data-k="d" data-id="${stu.id}" data-mid="${mid}" data-nm="${esc(stu.nm.toLowerCase())}" data-mis="${esc(d.mis)}" class="${trCls}">
    <td>${firstCell}</td>
    <td><label class="alvo"><input type="checkbox" class="sw" data-f="fly"${d.fly ? ' checked' : ''} aria-label="${esc(stu.nm)} vai voar"></label></td>
    <td><select data-f="mis" title="${esc(exige)}" aria-label="Missão${de}">${opts(Object.keys(MIS).map(m => [m, m]), d.mis)}</select></td>
    <td><select data-f="eq"${isGnd ? ' disabled' : ''} aria-label="Recurso${de}">${allowedEqOptionsForMission(d.mis, d.eq)}</select></td>
    <td><select data-f="p1" aria-label="1ª preferência${de}">${opcoesDeHorario(horarios, d.p1)}</select></td>
    <td><select data-f="p2" aria-label="2ª preferência${de}">${opcoesDeHorario(horarios, d.p2)}</select></td>
    <td><select data-f="jan" aria-label="Disponibilidade${de}">${opts(opcoesDeDisponibilidade(horarios), d.jan || '')}</select></td>
    <td>${nbOpts}</td>
    <td><select data-f="pr" aria-label="Prioridade${de}">${opts([1, 2, 3, 4, 5].map(n => [n, n]), d.pr)}</select></td>
  </tr>`;
};

export const studentDemandRowsHTML = stu => {
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
  // "Pôr um aluno na demanda": os alunos que ainda não voam na data
  const fora = S.stu.filter(s => !s.fly && !(s.extra || []).some(ex => ex.fly));
  $('#alunos-fora').innerHTML = fora.map(s => `<option value="${esc(s.nm)}"></option>`).join('');
};

export const rDem = () => {
  if (!S.stu.length) {
    $('#dem').innerHTML = `<tr class="empty-dem"><td colspan="9" class="h" style="padding:16px">Nenhum aluno cadastrado. Cadastre os alunos na aba Alunos.</td></tr>`;
    cnt();
    renderAuditPanel();
    return;
  }
  $('#dem').innerHTML = S.stu.map(studentDemandRowsHTML).join('');
  cnt();
  applyDemandFilters();
  renderAuditPanel();
};

export function applyDemandFilters() {
  const q = ($('#flt-dem') && $('#flt-dem').value || '').toLowerCase();
  const mis = $('#flt-dem-mis') ? $('#flt-dem-mis').value : '';
  document.querySelectorAll('#dem tr[data-k="d"]').forEach(tr => {
    const matchName = !q || tr.dataset.nm.includes(q);
    const matchMis = !mis || tr.dataset.mis === mis;
    tr.hidden = !(matchName && matchMis);
  });
}
