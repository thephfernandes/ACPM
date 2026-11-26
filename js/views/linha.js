// A linha de produção no alto (nav#linha): os quatro cartões das etapas, com o estado, o valor e as tarefas, e os links dos
// cadastros, do Rodízio e do BI. Os cartões e os links estão em index.html; aqui eles recebem o que vem de
// js/linha-do-dia.js e somem para o perfil que não vê a tela deles
import { $, trocarConteudo } from '../dom.js';
import { esc, hojeISO } from '../format.js';
import { linhaDoDia, selosDosCadastros } from '../linha-do-dia.js';
import { dadosLidos, SEM_OS_DADOS } from '../actions.js';
import { S, RES, DATA, isGestor, dadoIndisponivel } from '../state.js';
import { ApiClient } from '../storage.js';
import { podeVer, destinoDoEndereco } from '../telas.js';
import { pedidosDaDataAberta } from './selos.js';

// O único leitor dos dados para a linha (e para os avisos da data, no trilho)
export function contextoDoDia() {
  const { lista, leitura } = pedidosDaDataAberta();
  return {
    S, RES, pedidos: lista, leituraDosPedidos: leitura, perfil: ApiClient.perfil || null,
    // Quem opera a escala: o Operador e o Administrador (no modo local, o perfil Operador)
    opera: !isGestor(), horasLidas: !dadoIndisponivel('horas'),
    indisponiveis: (S.indisponiveis || []).filter(p => Object.hasOwn(SEM_OS_DADOS, p)).map(id => ({ id, texto: SEM_OS_DADOS[id] })),
    data: DATA, hoje: hojeISO()
  };
}

// Cada estado tem um símbolo (e o anel, no pendente): a cor nunca é o único sinal
const ICONE = { feito: 'i-certo', falhou: 'i-fechar', atencao: 'i-exclamacao', andamento: 'i-andamento' };
const DITO = { feito: 'feito', falhou: 'falhou', atencao: 'precisa de atenção', andamento: 'em andamento', pendente: 'pendente', nenhum: '' };
const simbolo = estado => (ICONE[estado] ? `<svg class="ico"><use href="#${ICONE[estado]}"/></svg>` : '');

function linhaDaTarefa(t) {
  const href = t.destino ? `#/${t.destino.tela}${t.destino.item ? `/${t.destino.item}` : ''}` : null;
  const dito = DITO[t.estado];
  const conteudo = `<span class="estado" data-estado="${t.estado}" aria-hidden="true">${simbolo(t.estado)}</span>`
    + `<span class="tarefa-nome">${esc(t.rotulo)}</span><span class="tarefa-valor">${esc(t.valor)}</span>${dito ? `<span class="sr">: ${dito}</span>` : ''}`;
  const titulo = esc(`${t.rotulo}: ${t.valor}${dito ? `, ${dito}` : ''}`);
  return href
    ? `<li><a class="tarefa" href="${href}" data-tarefa="${esc(t.id)}" data-estado="${t.estado}" data-focar title="${titulo}">${conteudo}</a></li>`
    : `<li><span class="tarefa" data-tarefa="${esc(t.id)}" data-estado="${t.estado}" title="${titulo}">${conteudo}</span></li>`;
}

// O texto do cartão para o leitor de tela: o valor (pela dica), o estado e, quando não está feito, as tarefas que o pedem
function frase(cartao) {
  const dito = DITO[cartao.estado];
  if (!dito) return `: ${cartao.dica}`;
  const porque = cartao.estado === 'feito' ? [] : cartao.tarefas.filter(t => t.estado === cartao.estado).map(t => `${t.valor} ${t.rotulo}`);
  return `: ${cartao.dica}, ${dito}${porque.length ? `: ${porque.join(', ')}` : ''}`;
}

export function rLinha() {
  const nav = $('#linha');
  // Antes de os dados da data chegarem, os números seriam os do estado vazio: a linha fica como estava
  if (!nav || !dadosLidos) return;
  const ctx = contextoDoDia();
  const perfil = ctx.perfil;
  const aberta = nav.dataset.estado === 'aberta';
  for (const cartao of linhaDoDia(ctx)) {
    const li = nav.querySelector(`li.estagio[data-estagio="${cartao.id}"]`);
    if (!li) continue;
    li.hidden = !podeVer(cartao.tela, perfil);
    li.dataset.estado = cartao.estado;
    const titulo = li.querySelector('.estagio-titulo');
    titulo.title = cartao.dica;
    titulo.querySelector('.estado').dataset.estado = cartao.estado;
    trocarConteudo(titulo.querySelector('.estado'), simbolo(cartao.estado));
    titulo.querySelector('.estagio-valor').textContent = cartao.valor;
    titulo.querySelector('.sr').textContent = frase(cartao);
    const tarefas = li.querySelector('.estagio-tarefas');
    tarefas.hidden = !aberta;
    trocarConteudo(tarefas, cartao.tarefas.map(linhaDaTarefa).join(''));
  }
  // Os links dos cadastros, do Rodízio e do BI: só os das telas que o perfil vê; a divisória, só com algum link depois dela
  for (const link of nav.querySelectorAll('.linha-mais a[data-nav]')) {
    const destino = destinoDoEndereco(link.getAttribute('href'));
    link.hidden = !destino || !podeVer(destino.tela, perfil);
  }
  const sep = nav.querySelector('.linha-sep');
  if (sep) sep.hidden = !nav.querySelector('.linha-sep ~ a[data-nav]:not([hidden])');
  // O selo de Recursos: os aviões parados ou perto da revisão de 50 horas (dito também ao leitor de tela)
  const selo = selosDosCadastros(ctx).rec;
  const link = nav.querySelector('.linha-mais a[href="#/rec"]');
  if (link) {
    const marca = link.querySelector('.linha-selo'), dito = link.querySelector('.sr');
    marca.hidden = !selo;
    marca.textContent = selo ? selo.valor : '';
    marca.className = `linha-selo${selo ? ` ${selo.estado}` : ''}`;
    dito.textContent = selo ? `, ${selo.dica}` : '';
    link.title = selo ? selo.dica : '';
  }
}

// Aberta (os cartões com as tarefas) ou recolhida (uma fileira por cartão): o botão diz o que faz
export function mostrarEstadoDaLinha(estado) {
  const nav = $('#linha');
  if (!nav) return;
  nav.dataset.estado = estado;
  const aberta = estado === 'aberta';
  nav.querySelectorAll('.estagio-tarefas').forEach(ul => { ul.hidden = !aberta; });
  const botao = $('#btn-linha');
  if (botao) {
    botao.setAttribute('aria-expanded', String(aberta));
    botao.setAttribute('aria-label', aberta ? 'Esconder as tarefas das etapas' : 'Mostrar as tarefas das etapas');
    botao.title = botao.getAttribute('aria-label');
    trocarConteudo(botao, `<svg class="ico" aria-hidden="true"><use href="#${aberta ? 'i-cima' : 'i-baixo'}"/></svg>`);
  }
}
