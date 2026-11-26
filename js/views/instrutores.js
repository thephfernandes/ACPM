// Aba Instrutores, em duas vistas: a disponibilidade do dia (uma grade com as janelas e os voos de cada um na escala) e o
// cadastro (nome, CANAC, peso e habilitações, editadas num painel lateral). Os dados pessoais abrem noutro painel
// (js/views/painel-de-dados.js), só para quem pode vê-los (.so-dados); os limites da lei, em js/views/limites.js
import { WIN, PRE, T, AIRCRAFT_EQ_TYPES, MINUTOS_DO_DIA } from '../config.js';
import { HABILITACOES, nomeDaHabilitacao, GRUPOS_DE_HABILITACAO, gruposDosRecursos } from '../habilitacoes.js';
import { FROTA_INICIAL } from '../frota.js';
import { esc, hm, LIMITE_DO_NOME, numeroBr, chaveDeBusca } from '../format.js';
import { S, DATA, insBy, voosQueVoam } from '../state.js';
import { $, abrirGaveta } from '../dom.js';
import { botaoDeDica } from '../dicas.js';
import { canacDe } from './dados-pessoais.js';
import { normalizarLimites } from '../limites.js';
import { unidadeDoVoo, umPorUnidade } from '../voo.js';
import { mostrarVista } from './vistas.js';
import { criarFiltroMultiplo } from './filtro-multiplo.js';
import { rLimites } from './limites.js';
import { filtrarLinhas } from './linhas-filtradas.js';

const ROTULO = new Map(HABILITACOES.map(h => [h.id, h.curto]));
// No cadastro, todas na ordem do painel; na grade do dia, só as que mais distinguem o instrutor
const ORDEM_DA_GRADE = ['mlte', 'c172', 'ifr', 'noturno', 'parafuso', 'endosso_solo', 'solo', 'navegacao_150', 'navegacao', 'local', 'tgl',
  'sim_multi', 'sim_mono', 'ground_pa34', 'grounds'];
const rotuloDa = h => ROTULO.get(h) || nomeDaHabilitacao(h);
const resumoDasHabilitacoes = x => x.hab.map(rotuloDa).join(' · ');
// Na grade do dia, as marcas de checador (o curso, o motor e as regras) contam como uma, na frente
function resumoNaGrade(x) {
  const checador = x.hab.some(h => h.startsWith('checa_')) ? ['Checador'] : [];
  const rotulos = [...checador, ...ORDEM_DA_GRADE.filter(h => x.hab.includes(h)).map(h => ROTULO.get(h))];
  return rotulos.length > 3 ? `${rotulos.slice(0, 3).join(' · ')} · +${rotulos.length - 3}` : rotulos.join(' · ');
}

// Voos e aulas de cada instrutor na escala da data, sem os cancelados (a turma de Ground conta uma vez) e as janelas em que ele está ocupado
function ocupacaoDosInstrutores() {
  const porInstrutor = new Map();
  voosQueVoam().forEach(o => {
    const atual = porInstrutor.get(o.insId) || { voos: new Set(), janelas: new Set() };
    atual.voos.add(unidadeDoVoo(o));
    WIN.forEach((_, i) => {
      const inicio = T[i], fim = i < WIN.length - 1 ? T[i + 1] : MINUTOS_DO_DIA;
      if (o.a < fim && o.b > inicio) atual.janelas.add(i);
    });
    porInstrutor.set(o.insId, atual);
  });
  return porInstrutor;
}

// data-nm: a chave da busca pelo nome (sem acentos), que os filtros comparam
const atributos = x => `data-k="i" data-id="${x.id}" data-hab="${x.hab.join(' ')}" data-nm="${esc(chaveDeBusca(x.nm))}"`;

// Limites da lei: as horas de voo do instrutor com a escala desta data (as de antes, as de fora do app e as de hoje, só
// voo em avião) no mês, no semestre e no ano
function horasComAEscala(x) {
  const passadas = (S.horasDosInstrutores || {})[x.id] || { mes: 0, semestre: 0, ano: 0, fimAnterior: null };
  const hoje = umPorUnidade(voosQueVoam().filter(o => o.insId === x.id && AIRCRAFT_EQ_TYPES.includes(o.eqType)))
    .reduce((total, o) => total + o.h, 0);
  const somar = h => Math.round((h + hoje) * 10) / 10;
  return { mes: somar(passadas.mes), semestre: somar(passadas.semestre), ano: somar(passadas.ano), fimAnterior: passadas.fimAnterior };
}
const perto = (h, limite) => limite !== null && h >= 0.9 * limite;
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
  const titulo = [`${numeroBr(h.mes)} h de voo no mês${limites.vooMesH === null ? '' : ` (limite ${limites.vooMesH} h)`}`,
    `${numeroBr(h.ano)} h no ano${limites.vooAnoH === null ? '' : ` (limite ${limites.vooAnoH} h)`}`,
    h.fimAnterior === null || h.fimAnterior === undefined ? '' : `ontem até as ${hm(h.fimAnterior)}`].filter(Boolean).join('; ');
  const atencao = perto(h.mes, limites.vooMesH) || perto(h.ano, limites.vooAnoH) || perto(h.semestre, limites.vooSemestreH);
  return `<td class="mes${atencao ? ' perto' : ''}" title="${esc(titulo)}">${numeroBr(h.mes)} h</td>`;
}

// As células do cadastro (Instrutores e Alunos) têm a classe da coluna: no celular, cada pessoa vira um cartão, com as
// partes postas pela classe (css/cadastros.css), e o nome da coluna (data-rotulo) aparece pequeno em cima de cada uma. Os
// botões: "Editar habilitações" (o das habilitações; no celular, na linha de baixo delas) e depois "Dados pessoais" e o
// ✕, como em Alunos: o Tab segue a ordem da tela, também no cartão do celular
function linhaDoCadastro(x) {
  return `<tr class="cd" ${atributos(x)}>
    <td class="c-nome"><input class="nm" data-f="nm" value="${esc(x.nm)}" maxlength="${LIMITE_DO_NOME}" aria-label="Nome do instrutor"></td>
    <td class="c-canac so-dados" data-rotulo="CANAC">${esc(canacDe('instrutor', x.id))}</td>
    <td class="c-peso" data-rotulo="Peso (kg)"><input type="number" min="1" max="300" data-f="kg" value="${x.kg || ''}" placeholder="sem peso" aria-label="Peso de ${esc(x.nm)} em kg"${x.kg ? '' : ' class="falta"'}></td>
    <td class="c-habs" data-rotulo="Habilitações"><span class="habs-resumo">${esc(resumoDasHabilitacoes(x)) || 'Nenhuma'}</span></td>
    <td class="acoes"><button class="btn quiet edit-only" data-act="editar-habs" data-id="${x.id}">Editar habilitações</button><button type="button" class="btn quiet so-dados" data-dados="instrutor:${x.id}" aria-label="Dados pessoais de ${esc(x.nm)}">Dados pessoais</button><button class="x edit-only" data-act="deli" aria-label="Excluir ${esc(x.nm)}">✕</button></td>
  </tr>`;
}

// A grade do dia depende da escala: é refeita junto com ela. A coluna "Vem" é a da data aberta no topo (o app abre em
// amanhã: não é "hoje")
export function rInsDia() {
  // Os termos da grade com o "?"
  $('#inst-dia-cab').innerHTML = `<tr><th>Instrutor</th><th>Vem${botaoDeDica('vem-nesta-data', 'Vem')}</th>${WIN.map(w => `<th class="jan">${w}</th>`).join('')}<th>Voos${botaoDeDica('voos-do-instrutor', 'Voos')}</th><th>Mês${botaoDeDica('horas-do-mes', 'Mês')}</th><th>Turno${botaoDeDica('turno', 'Turno')}</th><th>Habilitações</th></tr>`;
  // Quem usa o teclado continua no mesmo campo (ou no "Limpar filtros") depois que a grade é refeita e filtrada
  const foco = $('#inst-dia').contains(document.activeElement) ? seletorDoCampo(document.activeElement) : null;
  if (S.ins.length) {
    const ocupacao = ocupacaoDosInstrutores();
    $('#inst-dia').innerHTML = S.ins.map(x => linhaDoDia(x, ocupacao)).join('');
  } else {
    $('#inst-dia').innerHTML = `<tr><td colspan="${WIN.length + 6}" class="h">${SEM_INSTRUTORES}</td></tr>`;
  }
  applyInstructorFilters();
  const alvo = foco && $('#inst-dia').querySelector(foco);
  if (alvo) alvo.focus();
}

function seletorDoCampo(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const linha = el.closest('tr[data-id]');
  const campo = ['data-f', 'data-w'].filter(a => el.hasAttribute(a)).map(a => `[${a}="${el.getAttribute(a)}"]`).join('');
  return linha && campo ? `tr[data-id="${linha.dataset.id}"] ${campo}` : null;
}

// Atualiza a linha do cadastro no lugar, sem trocar os campos (o foco de quem usa o teclado continua onde estava). Ela é
// a do instrutor alterado agora: continua à vista mesmo fora dos filtros, até eles mudarem
export function atualizarLinhaDoCadastro(x) {
  const linha = document.querySelector(`#inst tr.cd[data-id="${x.id}"]`);
  if (!linha) return;
  linha.dataset.hab = x.hab.join(' ');
  linha.dataset.nm = chaveDeBusca(x.nm);
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
  manterInstrutorAVista(x.id);
  applyInstructorFilters();
}

export function rIns() {
  mostrarVista('ins');
  // As opções do filtro das habilitações acompanham a frota (a habilitação própria de cada recurso)
  if (filtroDasHabilitacoes) filtroDasHabilitacoes.desenhar();
  rLimites();
  $('#inst').innerHTML = S.ins.length ? S.ins.map(linhaDoCadastro).join('') : `<tr><td colspan="5" class="h">${SEM_INSTRUTORES}</td></tr>`;
  rInsDia();
  rPainelDoInstrutor();
}

// Os grupos do painel e do filtro: os do registro (js/habilitacoes.js) e as habilitações próprias que a frota exige
const gruposDoPainel = () => [...GRUPOS_DE_HABILITACAO, ...gruposDosRecursos(Array.isArray(S.frota) ? S.frota : FROTA_INICIAL)];

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
    <p class="h">Marque o que o instrutor pode fazer. Nos aviões (C152, C172 e PA-34), a missão exige também a habilitação do avião; o voo de cheque exige uma marca de cada grupo do checador.</p>
    <div class="habs-painel" data-k="i" data-id="${x.id}">
      ${gruposDoPainel().map(({ titulo, ids, dica }) => `<fieldset><legend>${titulo}${dica ? botaoDeDica(dica, dica === 'checador' ? 'checador' : 'habilitação própria') : ''}</legend>${ids.map(h =>
        `<label class="hab"><input type="checkbox" class="sw" data-f="hab" data-h="${h}"${x.hab.includes(h) ? ' checked' : ''}>${esc(nomeDaHabilitacao(h))}</label>`).join('')}</fieldset>`).join('')}
      ${horasDoInstrutor(x)}
    </div>`;
}

// As horas de voo do instrutor (limites da lei) e as de fora do app: neste mês e, no ano, antes deste mês
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function horasDoInstrutor(x) {
  const limites = normalizarLimites(S.limites);
  const h = horasComAEscala(x);
  const de = (valor, limite) => `${numeroBr(valor)} h${limite === null ? '' : ` de ${limite} h`}`;
  const externas = x.horasExternas || {};
  const mes = MESES[+DATA.slice(5, 7) - 1];
  return `<fieldset class="horas-ins"><legend>Horas de voo (limites da lei)${botaoDeDica('limites-da-lei', 'limites da lei')}</legend>
      <p>No mês: ${de(h.mes, limites.vooMesH)} · No semestre: ${de(h.semestre, limites.vooSemestreH)} · No ano: ${de(h.ano, limites.vooAnoH)} <small>(com a escala desta data)</small></p>
      <p class="h">As horas de voo de fora do app (outra escola, por exemplo) entram nos limites do mês e do ano.</p>
      <label>Fora do app, neste mês (${mes}) <input type="number" min="0" max="999" step="0.1" data-f="ext-mes" value="${externas[DATA.slice(0, 7)] ?? ''}"></label>
      <label>Fora do app, neste ano, antes de ${mes} <input type="number" min="0" max="2000" step="0.1" data-f="ext-ano" value="${externas[`${DATA.slice(0, 4)}-00`] ?? ''}"></label>
    </fieldset>`;
}

// O painel abre por cima das outras gavetas abertas (também quando já estava aberto, com outro instrutor)
export function abrirPainelDoInstrutor(id) {
  const painel = $('#painel-instrutor');
  painel.dataset.id = id;
  abrirGaveta(painel);
  rPainelDoInstrutor();
  $('#btn-fechar-painel-instrutor').focus();
}

export function fecharPainelDoInstrutor(devolverFoco = false) {
  const painel = $('#painel-instrutor');
  painel.hidden = true;
  const botao = document.querySelector(`#inst tr.cd[data-id="${painel.dataset.id}"] [data-act="editar-habs"]`);
  if (devolverFoco && botao) botao.focus();
}

// A coluna CANAC do cadastro, quando os dados pessoais chegam ou mudam (js/views/dados-pessoais.js)
export function atualizarCanacDosInstrutores() {
  document.querySelectorAll('#inst tr[data-id] .c-canac').forEach(td => { td.textContent = canacDe('instrutor', +td.closest('tr').dataset.id); });
}

// Os filtros de Instrutores: o nome e as habilitações, nas duas vistas. Eles ficam aqui (a busca) e no filtro de vários
// valores (as marcas), e não só nos campos, e valem de novo a cada redesenho das linhas: o cadastro novo, outra data, um
// nome mudado. O nome é comparado pela chave da busca (sem acentos). Quem acabou de ser cadastrado (+ Novo) ou alterado
// na linha dele (o nome, a habilitação tirada no painel) continua à vista mesmo fora dos filtros, até eles mudarem: é na
// linha do novo que se digita o nome, e a linha alterada não some com o foco de quem usa o teclado (o Tab depois do
// nome, o botão a que o painel devolve o foco)
let filtroDoNome = '';
const mantidos = new Set();
const BUSCA = '[data-flt="inst"]';
// O filtro das habilitações (js/views/filtro-multiplo.js)
let filtroDasHabilitacoes = null;
// Na digitação, a contagem espera a pessoa parar (o leitor de tela não a dita a cada letra)
const ESPERA_DA_DIGITACAO = 500;

// As opções do filtro das habilitações: os grupos do painel "Editar habilitações", com a habilitação própria de cada
// recurso da frota, e os rótulos da coluna Habilitações
const opcoesDasHabilitacoes = () => gruposDoPainel()
  .map(({ titulo, ids }) => ({ titulo, opcoes: ids.map(h => [h, rotuloDa(h)]) }));

// Ao abrir: o filtro das habilitações, e a busca como o filtro, vazia (o navegador que devolve o texto de antes de
// recarregar a página não deixa o campo diferente do filtro). O instrutor aparece se tem todas as marcadas: uma missão
// pede várias juntas (o Noturno no C172, Noturno e C172)
export function prepararFiltrosDosInstrutores() {
  filtroDasHabilitacoes = criarFiltroMultiplo({
    id: 'flt-ins-hab', nome: 'Habilitações', todas: 'Todas as habilitações', regra: 'todas',
    dica: ['filtro-das-habilitacoes', 'Filtro das habilitações'], grupos: opcoesDasHabilitacoes, aoMudar: () => filtrarInstrutores()
  });
  $(BUSCA).value = filtroDoNome;
}

// Um filtro mudou (a busca, { nome }, ou as marcas das habilitações): vale para todas as linhas, também as do cadastrado
// e do alterado agora
export function filtrarInstrutores(mudanca = {}) {
  if ('nome' in mudanca) filtroDoNome = mudanca.nome;
  mantidos.clear();
  applyInstructorFilters({ esperar: 'nome' in mudanca ? ESPERA_DA_DIGITACAO : 0 });
}

// O cadastrado (+ Novo) ou alterado agora continua à vista mesmo fora dos filtros, até eles mudarem
export function manterInstrutorAVista(id) {
  mantidos.add(id);
}

// "Limpar filtros": a busca e as marcas voltam a vazio, todas as linhas aparecem, e o foco vai para a busca
export function limparFiltrosDosInstrutores() {
  filtroDoNome = '';
  if (filtroDasHabilitacoes) filtroDasHabilitacoes.limpar();
  mantidos.clear();
  $(BUSCA).value = '';
  applyInstructorFilters();
  $(BUSCA).focus();
}

const filtrando = () => Boolean(filtroDoNome) || Boolean(filtroDasHabilitacoes && filtroDasHabilitacoes.valores().length > 0);

// Os filtros valem para as duas vistas: o instrutor tem todas as habilitações marcadas (data-hab, com a habilitação
// própria do recurso: aviao:PR-VOM)
function applyInstructorFilters({ esperar = 0 } = {}) {
  const q = chaveDeBusca(filtroDoNome);
  const temAsMarcadas = filtroDasHabilitacoes ? filtroDasHabilitacoes.quemPassa() : () => true;
  filtrarLinhas(['#inst-dia', '#inst'],
    l => mantidos.has(+l.dataset.id) || ((!q || l.dataset.nm.includes(q)) && temAsMarcadas(l.dataset.hab.split(' '))),
    { aba: 'ins', nomes: ['instrutor', 'instrutores'], filtrando: filtrando(), esperar });
}
