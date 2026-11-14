// Abas Instrutores e Alunos. Os instrutores têm duas visões: a disponibilidade do dia (uma grade com as janelas e os
// voos de cada um na escala) e o cadastro (nome, CANAC, peso e habilitações, editadas num painel lateral). Os dados
// pessoais (CPF, CANAC, nascimento, celular e e-mail) abrem noutro painel, só para quem pode vê-los (.so-dados).
import { WIN, PRE, T, AIRCRAFT_EQ_TYPES } from '../config.js';
import { HABILITACOES, nomeDaHabilitacao } from '../habilitacoes.js';
import { esc, hm, opts, LIMITE_DO_NOME } from '../format.js';
import { S, DATA, insBy, isGestor, voosQueVoam } from '../state.js';
import { $ } from '../dom.js';
import { canacDe } from './dados-pessoais.js';
import { normalizarLimites, LIMITES_DA_LEI, comHorasExternas } from '../limites.js';
import { ApiClient } from '../storage.js';
import { gerenciaContas } from '../perfis.js';
import { CURSOS } from '../cursos.js';
import { progressoDoAluno } from './etapas.js';

const ROTULO = new Map(HABILITACOES.map(h => [h.id, h.curto]));
// No cadastro, todas na ordem do painel; na grade do dia, só as que mais distinguem o instrutor
const ORDEM_DA_GRADE = ['checador_mlte', 'checador_ifr', 'checador_vfr', 'mlte', 'c172', 'ifr', 'noturno', 'parafuso', 'solo',
  'navegacao', 'local', 'tgl', 'sim_multi', 'sim_mono', 'ground_pa34', 'grounds'];
const resumoDasHabilitacoes = x => x.hab.map(h => ROTULO.get(h)).join(' · ');
function resumoNaGrade(x) {
  const rotulos = ORDEM_DA_GRADE.filter(h => x.hab.includes(h)).map(h => ROTULO.get(h));
  return rotulos.length > 3 ? `${rotulos.slice(0, 3).join(' · ')} · +${rotulos.length - 3}` : rotulos.join(' · ');
}
export const GRUPOS_DE_HABILITACAO = [
  ['Ground e simulador', ['grounds', 'ground_pa34', 'sim_mono', 'sim_multi']],
  ['Voo', ['tgl', 'local', 'navegacao', 'solo', 'parafuso', 'ifr', 'noturno']],
  ['Aviões', ['c172', 'mlte']],
  ['Checador', ['checador_vfr', 'checador_ifr', 'checador_mlte']]
];

let vistaDosInstrutores = 'dia';
export function mostrarVistaDosInstrutores(vista) {
  vistaDosInstrutores = vista;
  $('#s-ins').dataset.vista = vista;
  document.querySelectorAll('#s-ins [data-vista-ins]').forEach(b => b.classList.toggle('on', b.dataset.vistaIns === vista));
}

// Voos e aulas de cada instrutor na escala da data, sem os cancelados (a turma de Ground conta uma vez) e as janelas em que ele está ocupado
function ocupacaoDosInstrutores() {
  const porInstrutor = new Map();
  voosQueVoam().forEach(o => {
    const atual = porInstrutor.get(o.insId) || { voos: new Set(), janelas: new Set() };
    atual.voos.add(o.classKey || o.fKey);
    WIN.forEach((_, i) => {
      const inicio = T[i], fim = i < WIN.length - 1 ? T[i + 1] : 24 * 60;
      if (o.a < fim && o.b > inicio) atual.janelas.add(i);
    });
    porInstrutor.set(o.insId, atual);
  });
  return porInstrutor;
}

const atributos = x => `data-k="i" data-id="${x.id}" data-hab="${x.hab.join(' ')}" data-nm="${esc(x.nm.toLowerCase())}"`;

// Limites da lei (fase 11): as horas de voo do instrutor com a escala desta data (as de antes, as de fora do app e as de
// hoje, só voo em avião) no mês, no semestre e no ano
function horasComAEscala(x) {
  const passadas = (S.horasDosInstrutores || {})[x.id] || { mes: 0, semestre: 0, ano: 0, fimAnterior: null };
  const hoje = [...new Map(voosQueVoam().filter(o => o.insId === x.id && AIRCRAFT_EQ_TYPES.includes(o.eqType)).map(o => [o.classKey || o.fKey, o])).values()]
    .reduce((total, o) => total + o.h, 0);
  const somar = h => Math.round((h + hoje) * 10) / 10;
  return { mes: somar(passadas.mes), semestre: somar(passadas.semestre), ano: somar(passadas.ano), fimAnterior: passadas.fimAnterior };
}
const horasTexto = h => String(h).replace('.', ',');
const perto = (h, limite) => limite !== null && h >= 0.9 * limite;
// O Administrador muda os limites (neste navegador, o Operador)
export const podeEditarLimites = () => (ApiClient.perfil ? gerenciaContas(ApiClient.perfil) : !isGestor());
const SEM_INSTRUTORES = 'Nenhum instrutor cadastrado. Clique em “+ Novo instrutor” acima para cadastrar.';

function linhaDoDia(x, ocupacao) {
  const { voos, janelas } = ocupacao.get(x.id) || { voos: new Set(), janelas: new Set() };
  const celulas = WIN.map((w, i) => {
    const cls = `cel${x.aw[i] ? ' on' : ''}${janelas.has(i) ? ' voo' : ''}`;
    return `<td class="jan"><label class="${cls}" title="${w}"><input type="checkbox" data-f="aw" data-w="${i}"${x.aw[i] ? ' checked' : ''} aria-label="${esc(x.nm)} às ${w}"></label></td>`;
  }).join('');
  return `<tr ${atributos(x)}${x.on ? '' : ' class="off"'}>
    <td class="nome"><b>${esc(x.nm)}</b></td>
    <td><label class="alvo"><input type="checkbox" class="sw" data-f="on"${x.on ? ' checked' : ''} aria-label="${esc(x.nm)} vem no dia"></label></td>
    ${celulas}
    <td class="voos">${voos.size || ''}</td>
    ${colunaDoMes(x)}
    <td><select data-f="pre" class="edit-only" aria-label="Aplicar um turno a ${esc(x.nm)}"><option value="">Aplicar turno…</option>${Object.keys(PRE).map(k => `<option>${k}</option>`).join('')}</select></td>
    <td class="habs-resumo" title="${esc(resumoDasHabilitacoes(x))}">${esc(resumoNaGrade(x))}</td>
  </tr>`;
}

function colunaDoMes(x) {
  const limites = normalizarLimites(S.limites);
  const h = horasComAEscala(x);
  const titulo = [`${horasTexto(h.mes)} h de voo no mês${limites.vooMesH === null ? '' : ` (limite ${limites.vooMesH} h)`}`,
    `${horasTexto(h.ano)} h no ano${limites.vooAnoH === null ? '' : ` (limite ${limites.vooAnoH} h)`}`,
    h.fimAnterior === null || h.fimAnterior === undefined ? '' : `ontem até as ${hm(h.fimAnterior)}`].filter(Boolean).join('; ');
  const atencao = perto(h.mes, limites.vooMesH) || perto(h.ano, limites.vooAnoH) || perto(h.semestre, limites.vooSemestreH);
  return `<td class="mes${atencao ? ' perto' : ''}" title="${esc(titulo)}">${horasTexto(h.mes)} h</td>`;
}

export function linhaDoCadastro(x) {
  return `<tr class="cd" ${atributos(x)}>
    <td><input class="nm" data-f="nm" value="${esc(x.nm)}" maxlength="${LIMITE_DO_NOME}" aria-label="Nome do instrutor"></td>
    <td class="c-canac so-dados">${esc(canacDe('instrutor', x.id))}</td>
    <td><input type="number" min="0" max="200" data-f="kg" value="${x.kg || ''}" placeholder="sem peso" aria-label="Peso de ${esc(x.nm)} em kg"${x.kg ? '' : ' class="falta"'}></td>
    <td><span class="habs-resumo">${esc(resumoDasHabilitacoes(x)) || 'Nenhuma'}</span></td>
    <td class="acoes"><button type="button" class="btn quiet so-dados" data-dados="instrutor:${x.id}" aria-label="Dados pessoais de ${esc(x.nm)}">Dados pessoais</button><button class="btn quiet edit-only" data-act="editar-habs" data-id="${x.id}">Editar habilitações</button><button class="x edit-only" data-act="deli" aria-label="Excluir ${esc(x.nm)}">✕</button></td>
  </tr>`;
}

// A grade do dia depende da escala: é refeita junto com ela
export function rInsDia() {
  $('#inst-dia-cab').innerHTML = `<tr><th>Instrutor</th><th>Hoje</th>${WIN.map(w => `<th class="jan">${w}</th>`).join('')}<th>Voos</th><th title="Horas de voo no mês com a escala desta data (limites da Lei do Aeronauta)">Mês</th><th>Turno</th><th>Habilitações</th></tr>`;
  if (!S.ins.length) {
    $('#inst-dia').innerHTML = `<tr><td colspan="${WIN.length + 6}" class="h">${SEM_INSTRUTORES}</td></tr>`;
    return;
  }
  const ocupacao = ocupacaoDosInstrutores();
  // Quem usa o teclado continua no mesmo campo depois que a grade é refeita
  const foco = $('#inst-dia').contains(document.activeElement) ? seletorDoCampo(document.activeElement) : null;
  $('#inst-dia').innerHTML = S.ins.map(x => linhaDoDia(x, ocupacao)).join('');
  if (foco && $('#inst-dia').querySelector(foco)) $('#inst-dia').querySelector(foco).focus();
  applyInstructorFilters();
}

function seletorDoCampo(el) {
  const linha = el.closest('tr[data-id]');
  const campo = ['data-f', 'data-w'].filter(a => el.hasAttribute(a)).map(a => `[${a}="${el.getAttribute(a)}"]`).join('');
  return linha && campo ? `tr[data-id="${linha.dataset.id}"] ${campo}` : null;
}

// Atualiza a linha do cadastro no lugar, sem trocar os campos (o foco de quem usa o teclado continua onde estava)
export function atualizarLinhaDoCadastro(x) {
  const linha = document.querySelector(`#inst tr.cd[data-id="${x.id}"]`);
  if (!linha) return;
  linha.dataset.hab = x.hab.join(' ');
  linha.dataset.nm = x.nm.toLowerCase();
  linha.querySelector('[data-f="nm"]').value = x.nm;
  const kg = linha.querySelector('[data-f="kg"]');
  kg.value = x.kg || '';
  kg.classList.toggle('falta', !x.kg);
  kg.setAttribute('aria-label', `Peso de ${x.nm} em kg`);
  linha.querySelector('[data-act="deli"]').setAttribute('aria-label', `Excluir ${x.nm}`);
  linha.querySelector('[data-dados]').setAttribute('aria-label', `Dados pessoais de ${x.nm}`);
  linha.querySelector('.habs-resumo').textContent = resumoDasHabilitacoes(x) || 'Nenhuma';
  const titulo = $('#painel-instrutor-titulo');
  if (titulo && !$('#painel-instrutor').hidden && +$('#painel-instrutor').dataset.id === x.id) titulo.querySelector('small').textContent = x.nm;
  applyInstructorFilters();
}

export function rIns() {
  mostrarVistaDosInstrutores(vistaDosInstrutores);
  rLimites();
  $('#inst').innerHTML = S.ins.length ? S.ins.map(linhaDoCadastro).join('') : `<tr><td colspan="5" class="h">${SEM_INSTRUTORES}</td></tr>`;
  rInsDia();
  rPainelDoInstrutor();
}

// Painel lateral com as habilitações de um instrutor, em grupos
export function rPainelDoInstrutor() {
  const painel = $('#painel-instrutor');
  if (!painel || painel.hidden) return;
  const x = insBy(+painel.dataset.id);
  if (!x) { painel.hidden = true; return; }
  painel.innerHTML = `<div class="gaveta-cab">
      <h2 id="painel-instrutor-titulo">Habilitações <small>${esc(x.nm)}</small></h2>
      <button class="x" type="button" id="btn-fechar-painel-instrutor" aria-label="Fechar o painel">✕</button>
    </div>
    <p class="h">Marque o que o instrutor pode fazer. No C172 e no PA-34, a missão exige também a habilitação do avião.</p>
    <div class="habs-painel" data-k="i" data-id="${x.id}">
      ${GRUPOS_DE_HABILITACAO.map(([titulo, ids]) => `<fieldset><legend>${titulo}</legend>${ids.map(h =>
        `<label class="hab"><input type="checkbox" class="sw" data-f="hab" data-h="${h}"${x.hab.includes(h) ? ' checked' : ''}>${esc(nomeDaHabilitacao(h))}</label>`).join('')}</fieldset>`).join('')}
      ${horasDoInstrutor(x)}
    </div>`;
}

// As horas de voo do instrutor (limites da lei) e as de fora do app: neste mês e, no ano, antes deste mês
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function horasDoInstrutor(x) {
  const limites = normalizarLimites(S.limites);
  const h = horasComAEscala(x);
  const de = (valor, limite) => `${horasTexto(valor)} h${limite === null ? '' : ` de ${limite} h`}`;
  const externas = x.horasExternas || {};
  const mes = MESES[+DATA.slice(5, 7) - 1];
  return `<fieldset class="horas-ins"><legend>Horas de voo (limites da lei)</legend>
      <p>No mês: ${de(h.mes, limites.vooMesH)} · No semestre: ${de(h.semestre, limites.vooSemestreH)} · No ano: ${de(h.ano, limites.vooAnoH)} <small>(com a escala desta data)</small></p>
      <label>Fora do app, neste mês (${mes}) <input type="number" min="0" max="999" step="0.1" data-f="ext-mes" value="${externas[DATA.slice(0, 7)] ?? ''}"></label>
      <label>Fora do app, neste ano, antes de ${mes} <input type="number" min="0" max="2000" step="0.1" data-f="ext-ano" value="${externas[`${DATA.slice(0, 4)}-00`] ?? ''}"></label>
    </fieldset>`;
}

// Os limites da lei, no cadastro dos instrutores: só o Administrador muda (neste navegador, o Operador); vazio é sem limite
const CAMPOS_DOS_LIMITES = [
  ['vooPorJornadaMin', 'Voo por jornada (h)', 60], ['jornadaMin', 'Jornada (h)', 60], ['vooMesH', 'Voo no mês (h)', 1],
  ['vooSemestreH', 'Voo no semestre (h)', 1], ['vooAnoH', 'Voo no ano (h)', 1], ['repousoMin', 'Repouso entre jornadas (h)', 60]
];
export function rLimites() {
  const quadro = $('#limites-lei');
  if (!quadro) return;
  const limites = normalizarLimites(S.limites);
  const desligado = podeEditarLimites() ? '' : ' disabled';
  quadro.innerHTML = `<h3>Limites da Lei do Aeronauta</h3>
    <p class="h">Lei 13.475/2017 e RBAC 117 (Apêndice A): a escala não põe um instrutor além destes limites e avisa a partir de 90% do mês, do semestre e do ano. As horas de voo contam só avião (simulador e Ground contam na jornada). A jornada vai de 30 minutos antes do primeiro compromisso a 30 minutos depois do último. Vazio é sem limite; só o Administrador muda.</p>
    <div class="limites-grade">
      ${CAMPOS_DOS_LIMITES.map(([chave, rotulo, divisor]) => `<label>${rotulo} <input type="number" min="0.5" step="0.5" data-limite="${chave}" data-divisor="${divisor}" value="${limites[chave] === null ? '' : String(limites[chave] / divisor)}"${desligado}></label>`).join('')}
    </div>
    <button type="button" class="btn quiet" data-limites-padrao${desligado}>Voltar aos valores da lei</button>`;
}

export function abrirPainelDoInstrutor(id) {
  const painel = $('#painel-instrutor');
  painel.dataset.id = id;
  painel.hidden = false;
  rPainelDoInstrutor();
  $('#btn-fechar-painel-instrutor').focus();
}

export function fecharPainelDoInstrutor(devolverFoco = false) {
  const painel = $('#painel-instrutor');
  painel.hidden = true;
  const botao = document.querySelector(`#inst tr.cd[data-id="${painel.dataset.id}"] [data-act="editar-habs"]`);
  if (devolverFoco && botao) botao.focus();
}

// Alunos: uma tabela (nome, curso, peso e os instrutores com quem o aluno não deve ser escalado)
function naoEscalarCom(s) {
  return s.bl.map(b => insBy(b) ? `<span class="tg">${esc(insBy(b).nm)}<button class="edit-only" data-act="unbl" data-b="${b}" aria-label="Voltar a escalar com ${esc(insBy(b).nm)}">✕</button></span>` : '').join('') +
    `<select data-f="bl" class="edit-only" aria-label="Não escalar com"><option value="">Não escalar com…</option>${S.ins.filter(x => !s.bl.includes(x.id)).map(x => `<option value="${x.id}">${esc(x.nm)}</option>`).join('')}</select>`;
}

const linhaDoAluno = s => `<tr class="cd" data-k="s" data-id="${s.id}" data-nm="${esc(s.nm.toLowerCase())}">
  <td><input class="nm" data-f="nm" value="${esc(s.nm)}" maxlength="${LIMITE_DO_NOME}" aria-label="Nome do aluno"></td>
  <td class="c-canac so-dados">${esc(canacDe('aluno', s.id))}</td>
  <td class="c-curso"><select data-f="curso" aria-label="Curso de ${esc(s.nm)}"${isGestor() ? ' disabled' : ''}>${opts([['', '—'], ...CURSOS.map(([id, nome]) => [id, `${id} · ${nome}`])], s.curso || '')}</select>${progressoDoAluno(s)}</td>
  <td><input type="number" min="0" max="200" data-f="kg" value="${s.kg || ''}" placeholder="sem peso" aria-label="Peso de ${esc(s.nm)} em kg"${s.kg ? '' : ' class="falta"'}></td>
  <td><div class="bl">${naoEscalarCom(s)}</div></td>
  <td class="acoes"><button type="button" class="btn quiet so-dados" data-dados="aluno:${s.id}" aria-label="Dados pessoais de ${esc(s.nm)}">Dados pessoais</button><button class="x edit-only" data-act="dels" aria-label="Excluir ${esc(s.nm)}">✕</button></td>
</tr>`;

export const rAlu = () => {
  $('#alu').innerHTML = S.stu.length ? S.stu.map(linhaDoAluno).join('')
    : '<tr><td colspan="6" class="h">Nenhum aluno cadastrado. Clique em “+ Novo aluno” acima para cadastrar.</td></tr>';
};

// Atualiza a linha do aluno no lugar. "Não escalar com" é refeito só quando muda, e o foco volta para o seletor
export function atualizarLinhaDoAluno(s, { naoEscalar = false } = {}) {
  const linha = document.querySelector(`#alu tr.cd[data-id="${s.id}"]`);
  if (!linha) return;
  linha.dataset.nm = s.nm.toLowerCase();
  linha.querySelector('[data-f="nm"]').value = s.nm;
  const kg = linha.querySelector('[data-f="kg"]');
  kg.value = s.kg || '';
  kg.classList.toggle('falta', !s.kg);
  kg.setAttribute('aria-label', `Peso de ${s.nm} em kg`);
  const curso = linha.querySelector('[data-f="curso"]');
  curso.value = s.curso || '';
  curso.setAttribute('aria-label', `Curso de ${s.nm}`);
  const progresso = linha.querySelector('.progresso');
  if (progresso) progresso.remove();
  curso.insertAdjacentHTML('afterend', progressoDoAluno(s));
  linha.querySelector('[data-act="dels"]').setAttribute('aria-label', `Excluir ${s.nm}`);
  linha.querySelector('[data-dados]').setAttribute('aria-label', `Dados pessoais de ${s.nm}`);
  if (!naoEscalar) return;
  linha.querySelector('.bl').innerHTML = naoEscalarCom(s);
  linha.querySelector('[data-f="bl"]').focus();
}

// Filtro da aba Instrutores: uma opção por habilitação
export function preencherFiltroDeHabilitacoes() {
  $('#flt-ins-hab').insertAdjacentHTML('beforeend', HABILITACOES.map(h => `<option value="${h.id}">${esc(h.nome)}</option>`).join(''));
}

// Os filtros valem para as duas visões
export function applyInstructorFilters() {
  const q = ($('[data-flt="inst"]') && $('[data-flt="inst"]').value || '').toLowerCase();
  const hab = ($('#flt-ins-hab') && $('#flt-ins-hab').value) || '';
  document.querySelectorAll('#inst tr.cd, #inst-dia tr[data-k="i"]').forEach(c => {
    const matchName = !q || c.dataset.nm.includes(q);
    const matchHab = !hab || c.dataset.hab.split(' ').includes(hab);
    c.hidden = !(matchName && matchHab);
  });
}
