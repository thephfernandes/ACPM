// O trilho (aside#trilho): o calendário da data aberta, com os pedidos de cada dia, a linha da data e os avisos dela. Fica ao lado da tela
// (fixo, da largura média em diante, quando a pessoa escolhe; na larga, por padrão) ou abre como painel entre a linha e a
// tela pelo botão da data (#btn-data). Só "Fixar ao lado" fica guardado, por classe de largura (acpm_trilho)
import { $, trocarConteudo } from '../dom.js';
import { esc, fmtH, hm, hojeISO, rotuloDaData } from '../format.js';
import { semanasDoMes, paradaDoTab, descricaoDoDia, linhaDaData, nomeDoMes } from '../calendario.js';
import { dadosLidos } from '../actions.js';
import { avisosDaData } from '../linha-do-dia.js';
import { DATA } from '../state.js';
import { contextoDoDia } from './linha.js';

const ABREVIADOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const CABECA = [['D', 'domingo'], ['S', 'segunda-feira'], ['T', 'terça-feira'], ['Q', 'quarta-feira'], ['Q', 'quinta-feira'], ['S', 'sexta-feira'], ['S', 'sábado']];

// O mês à vista (as setas do mês mudam só ele), o dia que está abrindo e os pedidos de cada dia das semanas à vista
let mesVisivel = null;
let abrindo = null;
let contagem = {};

export const mesDoTrilho = () => mesVisivel || (DATA || hojeISO()).slice(0, 7);
export function mostrarMes(mes) { mesVisivel = mes; }
export function marcarAbrindo(dia) { abrindo = dia; }
export const diaAbrindo = () => abrindo;
export function guardarContagem(valores) { contagem = valores || {}; }
export const semanasAVista = () => semanasDoMes(mesDoTrilho());

// O estado do trilho: 'fixo' (ao lado), 'aberto' (o painel) ou 'fechado'
export const estadoDoTrilho = () => document.body.dataset.trilho || 'fechado';

export function mostrarTrilho(estado) {
  document.body.dataset.trilho = estado;
  const trilho = $('#trilho');
  if (trilho) trilho.hidden = estado === 'fechado';
  const botao = $('#btn-data');
  if (botao) {
    // Fixo, o botão leva o foco ao calendário; solto, ele abre e fecha o painel
    if (estado === 'fixo') botao.removeAttribute('aria-expanded');
    else botao.setAttribute('aria-expanded', String(estado === 'aberto'));
  }
  const fixar = $('#btn-fixar-trilho');
  if (fixar) fixar.setAttribute('aria-pressed', String(estado === 'fixo'));
  const fechar = $('#btn-fechar-trilho');
  if (fechar) fechar.hidden = estado !== 'aberto';
}

// O nome da data no botão do topo: "quarta-feira, 11/11" e "amanhã" (na tela estreita, "qua., 11/11")
export function rRotuloDaData() {
  if (!DATA) return;
  const { semana, semanaCurta, data: diaMes, relativo } = rotuloDaData(DATA, hojeISO());
  const parte = (classe, texto) => Object.assign(document.createElement('span'), { className: classe, textContent: texto });
  $('#dt-rotulo').replaceChildren(parte('dt-semana', semana), parte('dt-semana-curta', semanaCurta), `, ${diaMes}`);
  $('#dt-rel').textContent = relativo;
  $('#dt-rel').hidden = !relativo;
}

function botaoDoDia(dia, { mes, hoje, parada }) {
  const qtd = contagem[dia] || 0;
  const domingo = new Date(dia + 'T12:00:00Z').getUTCDay() === 0;
  const classes = ['cal-dia', dia === hoje && 'hoje', dia === DATA && 'aberta', dia.slice(0, 7) !== mes && 'fora', domingo && 'domingo', dia === abrindo && 'abrindo'].filter(Boolean);
  const mesCurto = dia.slice(8, 10) === '01' && dia.slice(0, 7) !== mes ? `<small class="cal-mes-curto" aria-hidden="true">${ABREVIADOS[+dia.slice(5, 7) - 1]}</small>` : '';
  const atributos = [
    `data-dia="${dia}"`, `tabindex="${dia === parada ? 0 : -1}"`,
    `aria-label="${esc(descricaoDoDia(dia, { hoje, aberta: DATA, qtd, abrindo }))}"`,
    dia === DATA ? 'aria-current="date"' : '', domingo ? 'aria-disabled="true"' : '', dia === abrindo ? 'aria-busy="true"' : ''
  ].filter(Boolean).join(' ');
  const numero = qtd ? `<span class="cal-qtd" aria-hidden="true">${qtd > 99 ? '99+' : qtd}</span>` : '';
  return `<td role="gridcell"><button type="button" class="${classes.join(' ')}" ${atributos}>${+dia.slice(8, 10)}${mesCurto}${numero}</button></td>`;
}

// O calendário do mês à vista e a linha da data aberta (ou da que está abrindo)
export function rTrilho() {
  const trilho = $('#trilho');
  if (!trilho || !DATA) return;
  const mes = mesDoTrilho();
  const hoje = hojeISO();
  const semanas = semanasDoMes(mes);
  const parada = paradaDoTab(semanas, { aberta: DATA, hoje });
  trilho.dataset.mes = mes;
  $('#cal-mes').textContent = nomeDoMes(mes);
  const cabeca = `<thead><tr>${CABECA.map(([letra, nome]) => `<th scope="col" aria-label="${nome}"><span aria-hidden="true">${letra}</span></th>`).join('')}</tr></thead>`;
  const corpo = `<tbody>${semanas.map(semana => `<tr>${semana.map(dia => botaoDoDia(dia, { mes, hoje, parada })).join('')}</tr>`).join('')}</tbody>`;
  trocarConteudo($('#cal'), cabeca + corpo);
  $('#trilho-data').textContent = abrindo ? `Abrindo ${rotuloDaData(abrindo, hoje).dia}…` : linhaDaData(DATA, hoje);
}

// Os avisos da data: um item por aviso, com o horário (ou "—", sem horário), a barra da gravidade, o título e o texto; com
// destino, um link para a tela onde ele se resolve. O botão da data conta os erros e os avisos
const DITO = { erro: 'erro', aviso: 'aviso', info: 'informação' };
function itemDoAviso(a) {
  const hora = a.minuto === null
    ? '<span class="aviso-hora">—<span class="sr">sem horário</span></span>'
    : `<span class="aviso-hora"><time>${hm(a.minuto)}</time>${a.duracaoMin ? `<small>${fmtH(a.duracaoMin / 60)}</small>` : ''}</span>`;
  const corpo = `${hora}<span class="aviso-barra" aria-hidden="true"></span><span class="aviso-corpo"><b class="aviso-titulo">${esc(a.titulo)}</b>${a.texto ? `<small class="aviso-texto">${esc(a.texto)}</small>` : ''}</span><span class="sr">, ${DITO[a.gravidade]}</span>`;
  const href = a.destino && `#/${a.destino.tela}${a.destino.item ? `/${a.destino.item}` : ''}`;
  return `<li class="aviso ${a.gravidade}" data-aviso="${esc(a.id)}">${href ? `<a class="aviso-link" href="${href}" data-focar>${corpo}</a>` : `<div class="aviso-link">${corpo}</div>`}</li>`;
}
export function rAvisos() {
  const lista = $('#avisos-da-data');
  if (!lista || !dadosLidos) return;
  const avisos = avisosDaData(contextoDoDia());
  trocarConteudo(lista, avisos.map(itemDoAviso).join(''));
  $('#avisos-vazio').hidden = avisos.length > 0;
  const n = avisos.filter(a => a.gravidade !== 'info').length;
  const marca = $('#avisos-cnt');
  marca.hidden = !n;
  marca.firstElementChild.textContent = n ? String(n) : '';
  marca.lastElementChild.textContent = n ? `, ${n} ${n === 1 ? 'aviso' : 'avisos'} nesta data` : '';
}

// O dia do calendário que recebe o foco: o pedido ou a parada do Tab
export function focarNoCalendario(dia = null) {
  const alvo = (dia && $(`#cal .cal-dia[data-dia="${dia}"]`)) || $('#cal .cal-dia[tabindex="0"]');
  if (!alvo) return;
  $('#cal').querySelectorAll('.cal-dia').forEach(b => { b.tabIndex = b === alvo ? 0 : -1; });
  alvo.focus();
}
