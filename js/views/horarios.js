// Horários de decolagem na aba Recursos. Cada categoria mostra um resumo (o modelo, quantos horários e os horários da
// manhã e da tarde, com o fechado nesta data riscado) e um botão "Editar". O editor abre na própria linha,
// com uma cópia da lista (o rascunho): o modelo, os horários com ✕, um campo em que Enter põe o horário e o efeito nos
// pedidos antes de salvar. Nada muda até "Salvar" (js/eventos/recursos.js); "Cancelar" e Esc descartam.
//
// O editor é desenhado ao abrir. Cada mudança no rascunho atualiza só os horários, o modelo marcado, o efeito e o erro:
// o foco fica onde está, e o efeito (aria-live) e o erro (role="alert") continuam os mesmos elementos, para o leitor de
// tela anunciar o texto novo. Quando a aba é redesenhada por outra alteração, o foco volta ao elemento equivalente.
//
// Os filtros de Recursos valem aqui por categoria (js/views/filtros-dos-recursos.js): aparecem as categorias marcadas e,
// com a busca, as dos recursos achados. A categoria do editor aberto, ou fechado agora (o foco volta ao "Editar" dela),
// continua à vista até os filtros mudarem.

import { S } from '../state.js';
import { $ } from '../dom.js';
import { doNomeDaCategoria } from '../categorias.js';
import { hm, esc } from '../format.js';
import { CATEGORIAS_COM_HORARIOS, HORARIOS_PADRAO, DE_30_EM_30, PRIMEIRO_HORARIO, ULTIMO_HORARIO, paraMinuto, modeloDosHorarios, descreverHorarios, porPeriodo, impactoDosHorarios, resumoDoImpacto } from '../horarios.js';
import { fechamentosDoEstado, fechamentoDoMinuto } from '../fechamentos.js';
import { horariosAVista, manterHorariosAVista } from './filtros-dos-recursos.js';

const NOMES_DAS_CATEGORIAS = { C152: 'C152', C172: 'C172', sim: 'Simulador', 'PA-34': 'PA-34', ground: 'Sala Ground' };
const MODELOS = [['padrao', 'Horários padrão'], ['de30', 'De 30 em 30 min'], ['personalizado', 'Personalizado']];
const PERIODOS = [['manha', 'Manhã'], ['tarde', 'Tarde']];
const ID_DO_ERRO = 'hr-erro', ID_DA_DICA = 'hr-dica';

// O rascunho do editor aberto: { cat, lista, base, erro, erroDoCampo }, ou null. base: a lista da categoria quando o
// editor abriu (Salvar só grava enquanto ela é a da categoria: js/eventos/recursos.js). erroDoCampo: o erro é do horário
// digitado (o campo fica marcado como inválido); o de tirar o último horário não é
let rascunho = null;
// A última escrita pedida no alerta: uma escrita adiada que ficou para trás não é feita
let escritasNoAlerta = 0;
export const editorDosHorariosAberto = () => Boolean(rascunho);
export const rascunhoDosHorarios = () => (rascunho ? { cat: rascunho.cat, lista: [...rascunho.lista], base: [...rascunho.base] } : null);

const listaDe = cat => (S.horarios && S.horarios[cat]) || [];
const quantos = n => `${n} ${n === 1 ? 'horário' : 'horários'}`;
// O fechamento que fecha o horário nesta data para a categoria (js/fechamentos.js), ou null
const fechadoNaData = (m, cat) => fechamentoDoMinuto(fechamentosDoEstado(S), m, cat);

// Os pedidos da demanda (os principais e as missões extras), com o nome do aluno
const pedidosDaDemanda = () => (S.stu || []).flatMap(s => [{ nome: s.nm, pedido: s }, ...(s.extra || []).map(ex => ({ nome: s.nm, pedido: ex }))]);
const efeitoDoRascunho = () => resumoDoImpacto(impactoDosHorarios(pedidosDaDemanda(), S.horarios, rascunho.cat, rascunho.lista));

function horarioNoResumo(m, cat) {
  const f = fechadoNaData(m, cat);
  if (!f) return `<span class="hr">${hm(m)}</span>`;
  return `<span class="hr fechado" data-dica="horario-fechado-na-data" data-dica-caso="Fechado nesta data (${hm(f.de)}–${hm(f.ate)}).">${hm(m)}<span class="sr"> (fechado nesta data)</span></span>`;
}

const horarioNoEditor = m => `<span class="hr-chip">${hm(m)}<button type="button" data-act="rascunho-tirar" data-min="${m}" aria-label="Tirar ${hm(m)}"><svg class="ico" aria-hidden="true"><use href="#i-fechar"/></svg></button></span>`;

function periodos(lista, celula) {
  const grupos = porPeriodo(lista);
  return `<div class="horarios-periodos">${PERIODOS.map(([id, rotulo]) => (grupos[id].length
    ? `<div class="horarios-periodo" data-periodo="${id}"><small>${rotulo}</small><span class="horarios-lista">${grupos[id].map(celula).join('')}</span></div>`
    : '')).join('')}</div>`;
}

const botaoEditar = (cat, aberto) =>
  `<button type="button" class="btn quiet edit-only" data-act="editar-horarios" data-cat="${cat}" aria-expanded="${aberto}" aria-label="Editar os horários ${esc(doNomeDaCategoria(cat))}"${aberto ? ' disabled' : ''}>Editar</button>`;

function resumo(cat) {
  const lista = listaDe(cat);
  return `<div class="horarios-cab">
      <b class="horarios-nome">${esc(NOMES_DAS_CATEGORIAS[cat])}</b>
      <span class="horarios-modelo">${esc(descreverHorarios(lista))}</span>
      <small class="horarios-qtd">${quantos(lista.length)}</small>
      ${botaoEditar(cat, false)}
    </div>
    ${periodos(lista, m => horarioNoResumo(m, cat))}`;
}

function editor(cat) {
  const nome = NOMES_DAS_CATEGORIAS[cat];
  const { lista, erro, erroDoCampo } = rascunho;
  const modelo = modeloDosHorarios(lista);
  return `<div class="horarios-cab">
      <b class="horarios-nome">${esc(nome)}</b>
      ${botaoEditar(cat, true)}
    </div>
    <div class="horarios-editor" role="group" aria-label="Horários de decolagem ${esc(doNomeDaCategoria(cat))}">
      <fieldset class="horarios-modelos">
        <legend>Modelo</legend>
        ${MODELOS.map(([id, rotulo]) => `<label class="chk"><input type="radio" name="hr-modelo" value="${id}"${id === modelo ? ' checked' : ''}> ${rotulo}</label>`).join('')}
      </fieldset>
      ${periodos(lista, horarioNoEditor)}
      <div class="horarios-novo">
        <label>Novo horário <input type="time" class="hr-novo" step="300" min="${hm(PRIMEIRO_HORARIO)}" max="${hm(ULTIMO_HORARIO)}" aria-describedby="${ID_DA_DICA} ${ID_DO_ERRO}" aria-invalid="${Boolean(erro && erroDoCampo)}"></label>
        <button type="button" class="btn quiet" data-act="rascunho-por">Adicionar</button>
        <small class="h" id="${ID_DA_DICA}">Enter também adiciona. Das ${hm(PRIMEIRO_HORARIO)} às ${hm(ULTIMO_HORARIO)}.</small>
      </div>
      <p class="erro-campo" id="${ID_DO_ERRO}" role="alert">${esc(erro || '')}</p>
      <p class="horarios-efeito" aria-live="polite">${esc(efeitoDoRascunho())}</p>
      <div class="horarios-botoes">
        <button type="button" class="btn" data-act="salvar-horarios">Salvar</button>
        <button type="button" class="btn quiet" data-act="cancelar-horarios">Cancelar</button>
      </div>
    </div>`;
}

// O seletor do elemento com o foco dentro dos horários, para devolver o foco a ele depois de redesenhar
function seletorDoFoco() {
  const el = document.activeElement;
  if (!el || !el.closest || !el.closest('#horarios')) return null;
  if (el.name === 'hr-modelo') return `input[name="hr-modelo"][value="${el.value}"]`;
  if (el.classList.contains('hr-novo')) return '.hr-novo';
  if (el.dataset.act === 'rascunho-tirar') return `[data-act="rascunho-tirar"][data-min="${el.dataset.min}"]`;
  if (el.dataset.act) return `[data-act="${el.dataset.act}"]${el.dataset.cat ? `[data-cat="${el.dataset.cat}"]` : ''}`;
  return null;
}

export function rHorarios() {
  const caixa = $('#horarios');
  if (!caixa) return;
  const foco = seletorDoFoco();
  // O horário digitado (e ainda não posto) continua no campo, se o editor redesenhado é o da mesma categoria
  const aberto = caixa.querySelector('.horarios-cat.editando');
  const digitado = aberto && rascunho && aberto.dataset.cat === rascunho.cat ? aberto.querySelector('.hr-novo').value : '';
  const aVista = CATEGORIAS_COM_HORARIOS.filter(cat => (rascunho && rascunho.cat === cat) || horariosAVista(cat));
  caixa.innerHTML = aVista.map(cat => {
    const editando = Boolean(rascunho) && rascunho.cat === cat;
    return `<div class="horarios-cat${editando ? ' editando' : ''}" data-cat="${cat}">${editando ? editor(cat) : resumo(cat)}</div>`;
  }).join('') || '<p class="h sem-resultado">Nenhuma categoria com esses filtros.</p>';
  const campo = caixa.querySelector('.hr-novo');
  if (campo) campo.value = digitado;
  const alvo = foco && caixa.querySelector(foco);
  if (alvo) alvo.focus();
}

// O rascunho mudou: só os horários, o modelo marcado, o efeito e o erro. O foco num ✕ que saiu vai para o horário
// seguinte (ou o anterior; sem nenhum, para o campo), para tirar vários em sequência pelo teclado
function atualizarEditor() {
  const caixa = document.querySelector('#horarios .horarios-editor');
  if (!caixa) { rHorarios(); return; }
  const { lista, erro, erroDoCampo } = rascunho;
  const ativo = document.activeElement;
  const minutoComFoco = ativo && caixa.contains(ativo) && ativo.dataset.act === 'rascunho-tirar' ? +ativo.dataset.min : null;
  caixa.querySelector('.horarios-periodos').outerHTML = periodos(lista, horarioNoEditor);
  const modelo = modeloDosHorarios(lista);
  caixa.querySelectorAll('input[name="hr-modelo"]').forEach(r => { r.checked = r.value === modelo; });
  caixa.querySelector('.hr-novo').setAttribute('aria-invalid', String(Boolean(erro && erroDoCampo)));
  // O alerta é esvaziado e escrito no quadro seguinte: o mesmo erro de novo também é anunciado
  const alerta = caixa.querySelector(`#${ID_DO_ERRO}`);
  const vez = ++escritasNoAlerta;
  alerta.textContent = '';
  if (erro) requestAnimationFrame(() => { if (vez === escritasNoAlerta) alerta.textContent = erro; });
  const efeito = caixa.querySelector('.horarios-efeito');
  const texto = efeitoDoRascunho();
  if (efeito.textContent !== texto) efeito.textContent = texto;
  if (minutoComFoco !== null) {
    const botoes = [...caixa.querySelectorAll('[data-act="rascunho-tirar"]')];
    const alvo = botoes.find(b => +b.dataset.min === minutoComFoco) || botoes.find(b => +b.dataset.min > minutoComFoco)
      || botoes[botoes.length - 1] || caixa.querySelector('.hr-novo');
    alvo.focus();
  }
}

export function abrirEditorDosHorarios(cat) {
  if (!CATEGORIAS_COM_HORARIOS.includes(cat)) return;
  rascunho = { cat, lista: [...listaDe(cat)], base: [...listaDe(cat)], erro: '', erroDoCampo: false };
  rHorarios();
  $('#horarios .hr-novo').focus();
}

// Fecha o editor (salvo ou descartado) e devolve o foco ao "Editar" da categoria, que continua à vista mesmo fora dos
// filtros (até eles mudarem)
export function fecharEditorDosHorarios() {
  if (!rascunho) return;
  const { cat } = rascunho;
  rascunho = null;
  manterHorariosAVista(cat);
  rHorarios();
  const botao = document.querySelector(`#horarios [data-act="editar-horarios"][data-cat="${cat}"]`);
  if (botao) botao.focus();
}

function mudar(lista, erro = '', { doCampo = false } = {}) {
  rascunho = { ...rascunho, lista, erro, erroDoCampo: doCampo };
  atualizarEditor();
}

// As ações do rascunho: tirar um horário (✕), pôr o do campo (Adicionar ou Enter) e escolher o modelo
export function tirarDoRascunho(minuto) {
  if (!rascunho) return;
  if (rascunho.lista.length <= 1) mudar(rascunho.lista, 'Cada categoria precisa de pelo menos um horário.');
  else mudar(rascunho.lista.filter(m => m !== minuto));
}

export function porNoRascunho() {
  if (!rascunho) return;
  const campo = $('#horarios .hr-novo');
  const minuto = paraMinuto(campo && campo.value);
  if (minuto === null || minuto < PRIMEIRO_HORARIO || minuto > ULTIMO_HORARIO) {
    mudar(rascunho.lista, `Escolha um horário entre ${hm(PRIMEIRO_HORARIO)} e ${hm(ULTIMO_HORARIO)}.`, { doCampo: true });
  } else {
    mudar([...new Set([...rascunho.lista, minuto])].sort((a, b) => a - b));
    campo.value = '';
  }
  if (campo) campo.focus();
}

export function escolherModelo(modelo) {
  if (!rascunho) return;
  if (modelo === 'padrao') mudar([...HORARIOS_PADRAO]);
  else if (modelo === 'de30') mudar([...DE_30_EM_30]);
}
