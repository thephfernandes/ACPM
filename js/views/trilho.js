// O trilho (aside#trilho): o calendário da data aberta, com os pedidos de cada dia, e os avisos dela. Fica ao lado da tela
// (fixo: na largura larga, por padrão; na média, quando a pessoa escolhe) ou abre como painel entre a linha e a
// tela pelo botão da data (#btn-data). Só "Fixar ao lado" fica guardado, por classe de largura (acpm_trilho)
import { $, trocarConteudo } from '../dom.js';
import { dadosLidos } from '../actions.js';
import { esc, fmtH, hm, hojeISO, rotuloDaData } from '../format.js';
import { avisosDaData } from '../linha-do-dia.js';
import { semanasDoMes, paradaDoTab, descricaoDoDia, linhaDaData, nomeDoMes } from '../calendario.js';
import { ehDomingo } from '../agenda.js';
import { DATA } from '../state.js';
import { ApiClient } from '../storage.js';
import { enderecoDoDestino } from '../telas.js';
import { contextoDoDia } from './linha.js';
import { pedidosDaDataAberta } from './selos.js';

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
export const semanasAVista = () => semanasDoMes(mesDoTrilho());

// Os pedidos (não cancelados) de cada dia das semanas à vista, para todos os perfis: lidos com os dados da primeira data
// (antes deles, e da sessão, o app ainda lê deste navegador: nada é pedido), ao mudar o mês à vista, ao abrir o painel ou a
// Agenda e depois de registrar ou cancelar um pedido. Sem resposta, os dias ficam sem número
let dadosChegaram = false;
let mesContado = null;
let leituraDaContagem = 0;
export async function lerContagemDosDias() {
  if (!dadosChegaram) return;
  const vez = ++leituraDaContagem;
  const semanas = semanasAVista();
  mesContado = mesDoTrilho();
  let lidos = null;
  try {
    lidos = await ApiClient.contagemDaAgenda(semanas[0][0], semanas.at(-1).at(-1));
  } catch {
    // Sem a leitura, sem números (os dados da próxima data pedem de novo)
  }
  if (vez !== leituraDaContagem) return;
  if (!lidos) mesContado = null;
  contagem = lidos || {};
  rTrilho();
}
// Os dados de uma data chegaram: a contagem é lida se o mês à vista ainda não foi contado
export function contarComOsDados() {
  dadosChegaram = true;
  if (mesContado !== mesDoTrilho()) lerContagemDosDias();
}

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
  // Igual, o rótulo fica: trocado entre apertar e soltar o mouse, o botão perderia o clique
  const texto = [semana, diaMes, relativo].join(' ');
  if ($('#dt-rotulo').dataset.texto === texto) return;
  $('#dt-rotulo').dataset.texto = texto;
  const parte = (classe, texto) => Object.assign(document.createElement('span'), { className: classe, textContent: texto });
  $('#dt-rotulo').replaceChildren(parte('dt-semana', semana), parte('dt-semana-curta', semanaCurta), `, ${diaMes}`);
  // Com o ano e o "amanhã" (na virada do ano), o dia da semana abreviado: a data não é cortada ao lado do número de avisos
  $('#dt-rotulo').classList.toggle('abreviada', Boolean(relativo) && diaMes.length > 5);
  $('#dt-rel').textContent = relativo;
  $('#dt-rel').hidden = !relativo;
}

function botaoDoDia(dia, { mes, hoje, parada }) {
  const qtd = contagem[dia] || 0;
  const domingo = ehDomingo(dia);
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

// A grade: com os mesmos dias, cada botão é atualizado no lugar (trocado entre apertar e soltar o mouse, o clique se perderia)
function desenharGrade(html) {
  const cal = $('#cal');
  const nova = document.createElement('table');
  nova.innerHTML = html;
  const antes = [...cal.querySelectorAll('.cal-dia')], depois = [...nova.querySelectorAll('.cal-dia')];
  if (antes.length !== depois.length || antes.some((b, i) => b.dataset.dia !== depois[i].dataset.dia)) {
    trocarConteudo(cal, html);
    return;
  }
  antes.forEach((botao, i) => {
    const novo = depois[i];
    for (const nome of botao.getAttributeNames()) if (!novo.hasAttribute(nome)) botao.removeAttribute(nome);
    for (const nome of novo.getAttributeNames()) if (botao.getAttribute(nome) !== novo.getAttribute(nome)) botao.setAttribute(nome, novo.getAttribute(nome));
    if (botao.innerHTML !== novo.innerHTML) botao.innerHTML = novo.innerHTML;
  });
}

// O calendário do mês à vista, o nome da data no topo, a linha dela (ou da que está abrindo) e os avisos. O topo e a linha
// dizem "hoje" e "amanhã" juntos, também com a página aberta depois da meia-noite
export function rTrilho() {
  const trilho = $('#trilho');
  if (!trilho || !DATA) return;
  rRotuloDaData();
  const mes = mesDoTrilho();
  const hoje = hojeISO();
  const semanas = semanasDoMes(mes);
  // O dia em foco continua a parada do Tab num redesenho
  const emFoco = document.activeElement && document.activeElement.closest('#cal .cal-dia');
  const parada = emFoco && semanas.flat().includes(emFoco.dataset.dia) ? emFoco.dataset.dia : paradaDoTab(semanas, { aberta: DATA, hoje });
  // O número da data aberta segue os pedidos dela já lidos
  const { lista, leitura } = pedidosDaDataAberta();
  if (leitura === 'lidos') contagem[DATA] = lista.filter(p => !p.cancelada_em).length;
  trilho.dataset.mes = mes;
  // O mês é dito quando muda (aria-live): o mesmo texto escrito de novo seria lido a cada redesenho
  if ($('#cal-mes').textContent !== nomeDoMes(mes)) $('#cal-mes').textContent = nomeDoMes(mes);
  const cabeca = `<thead><tr>${CABECA.map(([letra, nome]) => `<th scope="col" aria-label="${nome}"><span aria-hidden="true">${letra}</span></th>`).join('')}</tr></thead>`;
  const corpo = `<tbody>${semanas.map(semana => `<tr>${semana.map(dia => botaoDoDia(dia, { mes, hoje, parada })).join('')}</tr>`).join('')}</tbody>`;
  desenharGrade(cabeca + corpo);
  $('#trilho-data').textContent = abrindo ? `Abrindo ${rotuloDaData(abrindo, hoje).dia}…` : linhaDaData(DATA, hoje);
  rAvisos();
}

// Os avisos da data aberta, na ordem de js/linha-do-dia.js: o horário e a duração do voo, o que é e o porquê; o que tem destino
// leva à tela onde se resolve. No botão da data, quantos são (erros e avisos). Enquanto outra data abre, e antes dos dados da
// primeira, a lista fica como estava
const DITO = { erro: 'erro', aviso: 'aviso', info: 'informação' };
function avisoHTML(a) {
  const hora = a.minuto === null ? '<span aria-hidden="true">—</span><span class="sr">sem horário</span>'
    : `<time>${hm(a.minuto)}</time><small>${fmtH(a.duracaoMin / 60)}</small>`;
  const conteudo = `<span class="aviso-hora">${hora}</span><span class="aviso-barra" aria-hidden="true"></span>`
    + `<span class="aviso-corpo"><b class="aviso-titulo">${esc(a.titulo)}</b>${a.texto ? `<small class="aviso-texto">${esc(a.texto)}</small>` : ''}</span>`
    + `<span class="sr">, ${DITO[a.gravidade]}</span>`;
  const item = `data-aviso="${esc(a.id)}"`;
  return a.destino
    ? `<li class="aviso" data-gravidade="${a.gravidade}"><a class="aviso-item" href="${enderecoDoDestino(a.destino)}" ${item} data-focar>${conteudo}</a></li>`
    : `<li class="aviso" data-gravidade="${a.gravidade}"><div class="aviso-item" ${item}>${conteudo}</div></li>`;
}
function rAvisos() {
  if (!dadosLidos) return;
  const contexto = contextoDoDia();
  const avisos = avisosDaData(contexto);
  trocarConteudo($('#avisos-da-data'), avisos.map(avisoHTML).join(''));
  $('#avisos-da-data').hidden = !avisos.length;
  // Enquanto os pedidos da data não chegam, ainda não se sabe se não há nada
  $('#avisos-vazio').hidden = avisos.length > 0 || contexto.leituraDosPedidos === 'lendo';
  const n = avisos.filter(a => a.gravidade !== 'info').length;
  const marca = $('#avisos-cnt');
  marca.hidden = !n;
  trocarConteudo(marca, n ? `<span aria-hidden="true">${n}</span><span class="sr">, ${n} ${n === 1 ? 'aviso' : 'avisos'} nesta data</span>` : '');
}

// O dia do calendário que recebe o foco: o pedido ou a parada do Tab
export function focarNoCalendario(dia = null) {
  const alvo = (dia && $(`#cal .cal-dia[data-dia="${dia}"]`)) || $('#cal .cal-dia[tabindex="0"]');
  if (!alvo) return;
  $('#cal').querySelectorAll('.cal-dia').forEach(b => { b.tabIndex = b === alvo ? 0 : -1; });
  alvo.focus();
}
