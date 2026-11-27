// "Horários fechados nesta data" (J, N11; Recursos › Disponibilidade do dia, no lugar das nove "Janelas de operação"): a
// lista dos intervalos fechados da data aberta ("12:40–17:30 · todos os recursos", com o ✕ que abre de novo) e "+ Fechar
// horários", que abre o formulário: De e Até (de 10 em 10 minutos, das 06:00 às 24:00), "O dia todo", as categorias
// (nenhuma marcada: todos os recursos) e a linha do que ele fecha. Nada é gravado antes de "Fechar" (js/eventos/fechamentos.js)
import { S, isGestor } from '../state.js';
import { $, trocarConteudo } from '../dom.js';
import { esc, hm } from '../format.js';
import { CATEGORIAS, doNomeDaCategoria } from '../categorias.js';
import { fechamentosDoEstado, rotuloDosFechamentos, horariosQueOIntervaloFecha, cabeOFechamento, MAXIMO_DE_FECHAMENTOS } from '../fechamentos.js';
import { HORARIO_DO_NOTURNO } from '../horarios.js';

const INICIO = 6 * 60, FIM = 24 * 60, PASSO = 10;
const MINUTOS = Array.from({ length: (FIM - INICIO) / PASSO + 1 }, (_, i) => INICIO + PASSO * i);

// O formulário aberto: { de, ate, categorias }, ou null
let form = null;
export const formularioAberto = () => form !== null;
export const formularioDosFechamentos = () => form;

export function abrirFormulario() { form = { de: 12 * 60 + 40, ate: 17 * 60 + 30, categorias: [] }; }
export function fecharFormulario() { form = null; }
export function mudarFormulario(mudanca) { if (form) form = { ...form, ...mudanca }; }

// A linha do formulário: quantos horários de decolagem de cada categoria o intervalo fecha, dos que ainda estão abertos
// (os da lista e os fixos das missões, como o motor: o Noturno das 17:30 no C172; js/fechamentos.js)
function fraseDoFormulario(f) {
  if (f.ate <= f.de) return 'O Até vem depois do De.';
  const partes = horariosQueOIntervaloFecha(fechamentosDoEstado(S), S.horarios, f).map(({ categoria, minutos }, i) => {
    const n = minutos.length;
    // (nenhuma lista tem as 17:30: normalizarHorarios vai até as 17:00)
    const noturno = minutos.includes(HORARIO_DO_NOTURNO)
      ? (n === 1 ? ` (o Noturno, às ${hm(HORARIO_DO_NOTURNO)})` : ` (com o Noturno, às ${hm(HORARIO_DO_NOTURNO)})`) : '';
    return `${n} ${i === 0 ? (n === 1 ? 'horário ' : 'horários ') : ''}${doNomeDaCategoria(categoria.id)}${noturno}`;
  });
  return partes.length ? `Fecha ${partes.join(', ')}.` : 'Nenhum horário de decolagem cai nesse intervalo.';
}
// O intervalo pode ser fechado: o Até depois do De, e a lista, com ele junto aos outros, não passa do máximo
export const podeFechar = f => f.ate > f.de && cabeOFechamento(fechamentosDoEstado(S), { de: f.de, ate: f.ate, categorias: f.categorias });
const efeitoDoFormulario = f => (f.ate > f.de && !podeFechar(f) ? `No máximo ${MAXIMO_DE_FECHAMENTOS} intervalos fechados por data: abra um deles (✕) ou junte este a um que já está fechado.` : fraseDoFormulario(f));

const opcoes = (lista, escolhido) => lista.map(m => `<option value="${m}"${m === escolhido ? ' selected' : ''}>${hm(m)}</option>`).join('');

function formulario() {
  const f = form;
  return `<form class="fechar-horarios" aria-label="Fechar horários nesta data">
    <div class="fch-campos">
      <label class="campo">De <select data-a="fch-de" id="fch-de">${opcoes(MINUTOS.slice(0, -1), f.de)}</select></label>
      <label class="campo">Até <select data-a="fch-ate" id="fch-ate">${opcoes(MINUTOS.slice(1), f.ate)}</select></label>
      <button type="button" class="btn sec" data-act="fch-dia-todo">O dia todo</button>
    </div>
    <fieldset class="fch-categorias"><legend>Recursos <small>(nenhum marcado: todos)</small></legend>
      ${CATEGORIAS.map(c => `<label class="chk"><input type="checkbox" data-a="fch-cat" data-cat="${c.id}"${f.categorias.includes(c.id) ? ' checked' : ''}> ${esc(c.nome)}</label>`).join('')}
    </fieldset>
    <p class="fch-efeito" role="status">${esc(efeitoDoFormulario(f))}</p>
    <div class="fch-acoes">
      <button type="button" class="btn" data-act="fch-fechar"${podeFechar(f) ? '' : ' disabled'}>Fechar</button>
      <button type="button" class="btn quiet" data-act="fch-cancelar">Cancelar</button>
    </div>
  </form>`;
}

// Um campo do formulário mudou: só a linha do efeito, o "Fechar" e os campos mudam, nos mesmos elementos (a linha é uma
// região viva: um elemento novo não seria anunciado, e o foco fica no campo). Sem o formulário na tela, desenha tudo
export function atualizarFormularioDosFechamentos() {
  const caixa = $('#fechamentos .fechar-horarios');
  if (!form || !caixa) { rFechamentos(); return; }
  const efeito = caixa.querySelector('.fch-efeito');
  const texto = efeitoDoFormulario(form);
  if (efeito.textContent !== texto) efeito.textContent = texto;
  caixa.querySelector('[data-act="fch-fechar"]').disabled = !podeFechar(form);
  caixa.querySelector('#fch-de').value = String(form.de);
  caixa.querySelector('#fch-ate').value = String(form.ate);
  caixa.querySelectorAll('input[data-cat]').forEach(c => { c.checked = form.categorias.includes(c.dataset.cat); });
}

export function rFechamentos() {
  const caixa = $('#fechamentos');
  if (!caixa) return;
  const lista = Array.isArray(S.fechamentos) ? S.fechamentos : fechamentosDoEstado(S);
  const rotulos = rotuloDosFechamentos(lista);
  const leitura = isGestor();
  trocarConteudo(caixa, `${rotulos.length
    ? `<ul class="fechamentos-lista">${rotulos.map((r, i) => `<li><span>${esc(r)}</span>${leitura ? '' : ` <button type="button" class="btn quiet edit-only" data-act="tirar-fechamento" data-i="${i}" aria-label="Abrir de novo ${esc(r)}">✕</button>`}</li>`).join('')}</ul>`
    : '<p class="h">Nenhum horário fechado nesta data.</p>'}
    ${leitura ? '' : `<button type="button" class="btn sec edit-only" data-act="fechar-horarios" aria-expanded="${formularioAberto()}">+ Fechar horários</button>`}
    ${form && !leitura ? formulario() : ''}`);
}
