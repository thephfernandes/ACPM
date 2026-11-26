// Utilitários de DOM: seletor, avisos (notificação temporária e aviso fixo) e foco no último campo.
import { semFalhar } from './sem-falhar.js';

export const $ = s => document.querySelector(s);

// Um diálogo (<dialog>) aberto é a camada de cima: o Esc é só dele. Quem fecha uma gaveta ou o popup do mapa com o Esc
// confere isto antes: com um diálogo aberto por cima, o Esc fecha só o diálogo, e a gaveta continua aberta
export const algumDialogoAberto = () => Boolean(document.querySelector('dialog[open]'));

// Notificação temporária. tipo 'ok': deu certo (verde, com o sinal de certo); sem tipo: aviso (amarelo)
export function showToast(text, tipo = '') {
  const box = $('#toast-box');
  if (!box) return;
  const el = document.createElement('div');
  el.className = tipo ? `toast ${tipo}` : 'toast';
  if (tipo === 'ok') el.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-ok"/></svg>';
  el.append(text);
  box.appendChild(el);
  setTimeout(() => { el.remove(); }, 2800);
}

// Aviso fixo no topo, com o botão "Recarregar". O conflito e a falha ao preparar os dados só saem recarregando;
// as alterações esperando a conexão saem quando uma gravação der certo (fecharAviso('espera')), e esse aviso vem sem o
// botão (recarregar perderia as alterações)
let avisoAtual = null;
export const avisoAberto = () => avisoAtual;
export function mostrarAviso(tipo, texto, { recarregar = true } = {}) {
  avisoAtual = tipo;
  $('#aviso-sync-texto').textContent = texto;
  $('#aviso-sync').hidden = false;
  $('#btn-recarregar').hidden = !recarregar;
  $('#btn-recarregar').onclick = () => window.location.reload();
}
export function fecharAviso(tipo) {
  if (avisoAtual !== tipo) return;
  avisoAtual = null;
  $('#aviso-sync').hidden = true;
}

// As gavetas (o Histórico, as habilitações, os dados pessoais e as sugestões) abrem no mesmo lugar, à direita, umas
// sobre as outras. A de cima é a que abriu por último: ela fica por cima na tela (a camada, no z-index da .gaveta), e o
// Esc fecha só ela, ou a gaveta em que está o foco; o próximo Esc fecha a de baixo
let gavetasJaAbertas = 0;
const gavetasAbertas = () => [...document.querySelectorAll('.gaveta:not([hidden])')]
  .sort((p, q) => (+p.dataset.ordem || 0) - (+q.dataset.ordem || 0));
export function abrirGaveta(gaveta) {
  gaveta.hidden = false;
  gaveta.dataset.ordem = String(++gavetasJaAbertas);
  gavetasAbertas().forEach((g, camada) => g.style.setProperty('--camada', String(camada)));
}
// A gaveta que o Esc fecha. Cada gaveta tem o seu ouvinte do Esc, e a escolha vale para a tecla inteira: a primeira que
// fecha não passa a vez para a de baixo no mesmo Esc
const gavetaDoEscEscolhida = new WeakMap();
export function gavetaDoEsc(evento) {
  if (!gavetaDoEscEscolhida.has(evento)) {
    const abertas = gavetasAbertas();
    gavetaDoEscEscolhida.set(evento, abertas.find(g => g.contains(document.activeElement)) || abertas.at(-1) || null);
  }
  return gavetaDoEscEscolhida.get(evento);
}

// O Esc num painel da própria página (o editor dos horários de decolagem, o formulário do curso novo, o filtro de vários
// valores) fecha só ele, quando o foco está dentro dele. Ouvido na captura, ele para aqui e não chega aos ouvintes das
// gavetas (o Histórico aberto continua aberto); a dica e o menu abertos por cima são ouvidos antes e ficam com o Esc, e
// com um diálogo aberto o Esc é do diálogo. aberto() devolve o painel aberto (ou null), ou as partes dele (o botão do
// filtro e o painel que ele abre). semFoco: o Esc fecha também com o foco em lugar nenhum (o clique no texto do painel; o
// Safari, que não leva o foco ao botão clicado), quando não há gaveta aberta (com uma, o Esc é dela)
export function fecharNoEsc(aberto, fechar, { semFoco = false } = {}) {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || algumDialogoAberto()) return;
    const painel = aberto();
    if (!painel || !(e.target instanceof Node)) return;
    const dentro = [].concat(painel).some(parte => parte.contains(e.target));
    const emLugarNenhum = semFoco && e.target === document.body && !gavetasAbertas().length;
    if (!dentro && !emLugarNenhum) return;
    e.stopPropagation();
    fechar();
  }, true);
}

// Aviso sobre o link que abriu o app (a volta da confirmação da troca de e-mail, um link antigo), com o botão "OK"
export function avisarDoLink(texto, tipo) {
  $('#aviso-link-texto').textContent = texto;
  $('#aviso-link').className = `aviso-link ${tipo}`;
  $('#aviso-link').hidden = false;
  $('#btn-fechar-aviso-link').onclick = () => { $('#aviso-link').hidden = true; };
}

export const focusLast = sel => {
  const e = [...document.querySelectorAll(sel)].pop();
  if (e) { e.scrollIntoView({ block: 'center' }); e.focus(); e.select(); }
};

// Um balão junto de um elemento (o popup do mapa da escala, a dica): acima dele (ou abaixo, quando não cabe), sempre
// inteiro na tela; a seta (--seta) aponta para o meio do elemento
const MARGEM = 8, DISTANCIA = 10;
export function posicionarJunto(balao, alvo) {
  const r = alvo.getBoundingClientRect();
  const { offsetWidth: largura, offsetHeight: altura } = balao;
  const acima = r.top - DISTANCIA - altura >= MARGEM || r.bottom + DISTANCIA + altura > innerHeight - MARGEM && r.top > innerHeight - r.bottom;
  const topo = Math.min(Math.max(acima ? r.top - DISTANCIA - altura : r.bottom + DISTANCIA, MARGEM), innerHeight - altura - MARGEM);
  const meio = r.left + r.width / 2;
  const esquerda = Math.min(Math.max(meio - largura / 2, MARGEM), innerWidth - largura - MARGEM);
  balao.style.top = `${Math.round(topo)}px`;
  balao.style.left = `${Math.round(esquerda)}px`;
  balao.style.setProperty('--seta', `${Math.round(Math.min(Math.max(meio - esquerda, 14), largura - 14))}px`);
  balao.classList.toggle('abaixo', !acima);
}

// Menus suspensos (conta e "Mais" da Demanda): abrem e fecham no botão; Esc ou um clique fora fecham
export function ligarMenu(botao, menu, { fecharAoEscolher = true } = {}) {
  const fechar = () => { menu.hidden = true; botao.setAttribute('aria-expanded', 'false'); };
  botao.onclick = () => {
    const abrir = menu.hidden;
    menu.hidden = !abrir;
    botao.setAttribute('aria-expanded', String(abrir));
    const primeiro = abrir && menu.querySelector('[role^="menuitem"]:not([hidden])');
    if (primeiro) primeiro.focus();
  };
  // O item escolhido faz o que faz antes daqui (o ouvinte dele é o do próprio botão): se ele não levou o foco a outro
  // lugar, o foco volta ao botão do menu
  if (fecharAoEscolher) {
    menu.addEventListener('click', e => {
      if (!e.target.closest('[role="menuitem"]')) return;
      const semDestino = menu.contains(document.activeElement) || document.activeElement === document.body;
      fechar();
      if (semDestino) botao.focus();
    });
  }
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target) && !botao.contains(e.target)) fechar(); });
  // O Esc fecha só o menu, a camada de cima: ouvido na captura, ele para aqui e não chega aos ouvintes das gavetas e dos
  // painéis de trás, que continuam abertos
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || menu.hidden) return;
    e.stopPropagation();
    fechar();
    botao.focus();
  }, true);
  // As setas, Home e End andam pelos itens, como num menu do sistema (o Tab também, e sai do menu no fim)
  menu.addEventListener('keydown', e => {
    const itens = [...menu.querySelectorAll('[role^="menuitem"]')].filter(el => !el.disabled && visivel(el));
    if (!itens.length) return;
    const i = itens.indexOf(document.activeElement);
    const destino = {
      ArrowDown: itens[(i + 1) % itens.length], ArrowUp: itens[(i <= 0 ? itens.length : i) - 1],
      Home: itens[0], End: itens[itens.length - 1]
    }[e.key];
    if (!destino) return;
    e.preventDefault();
    destino.focus();
  });
  // O foco que sai para outro lugar da página (Tab no último item, Shift+Tab antes do botão) fecha o menu. Sem destino
  // (um clique numa área que não recebe o foco, a janela que perdeu o foco), quem fecha é o clique fora, acima
  const saiu = e => !menu.hidden && e.relatedTarget && !menu.contains(e.relatedTarget) && !botao.contains(e.relatedTarget);
  menu.addEventListener('focusout', e => { if (saiu(e)) fechar(); });
  botao.addEventListener('focusout', e => { if (saiu(e)) fechar(); });
  return fechar;
}

// O foco de quem usa o teclado sobrevive a um redesenho: o elemento em foco é achado de novo no conteúdo novo pelos
// atributos que o identificam (os dele e os da linha em que está) e recebe o foco sem a página rolar. Se o equivalente
// sumiu ou ficou desligado:
// - um campo (o Voa da linha escondida por "Só quem voa"): o campo do mesmo tipo que ficou na mesma posição, o da linha
//   seguinte;
// - um botão (o ✕ do voo tirado da escala, o Reverter já usado, o Subir de quem chegou ao topo da fila): o item dele, ou
//   o que ficou no lugar, que não faz nada com o Enter. Assim o Enter repetido ou segurado não age nos itens seguintes.
// Na aba Cursos: os campos do curso (data-cc), da fase (data-cfa) e da missão (data-cf), a fase ou a missão de que um
// botão ou uma caixa de "depois de…" fala (data-fase, data-missao), o título que recolhe a fase (data-recolher-fase) e o
// link do índice (data-ir-fase); as linhas são a missão (tr[data-missao]), a fase (.fase[data-fase]) e o curso
// (.curso[data-curso]). Os botões dos cursos, no alto, têm o id. No filtro de vários valores (js/views/filtro-multiplo.js),
// a caixa de cada opção: o filtro (data-filtro) e o valor (data-valor). Na linha: a tarefa (data-tarefa) e o cartão
// (data-estagio); no trilho, o dia (data-dia) e o aviso da data (data-aviso)
const QUEM_E = ['id', 'data-f', 'data-a', 'data-act', 'data-w', 'data-i', 'data-h', 'data-b', 'data-cat', 'data-min',
  'data-dia', 'data-criterio', 'data-valor', 'data-logid', 'data-horas', 'data-fkey', 'data-resultado',
  'data-reparo', 'data-dados', 'data-id', 'data-mid', 'data-recolher-tempo', 'data-recolher-grupo', 'data-agendar', 'data-cc',
  'data-cfa', 'data-cf', 'data-fase', 'data-missao', 'data-filtro', 'data-recolher-fase', 'data-ir-fase', 'data-tarefa', 'data-estagio',
  'data-aviso'];
const DA_LINHA = ['data-k', 'data-id', 'data-mid', 'data-fkey', 'data-cat', 'data-missao', 'data-fase', 'data-curso'];
// O tipo do campo: os atributos que dizem o que ele é, sem os que dizem de quem (o voo, o aluno, o recurso) ou qual
// (o valor da caixa do filtro)
const DO_TIPO = ['data-f', 'data-a', 'data-act', 'data-criterio', 'data-filtro'];
const LINHA = '[data-k], [data-fkey], tr[data-id], li[data-id], tr[data-missao], .fase[data-fase], .curso[data-curso]';
// Os itens de uma lista, com ou sem identidade: as linhas das tabelas, os itens das listas e os do Histórico
const ITEM = 'tbody tr, li, .audit-item';
const comAtributos = (el, lista) => el.tagName.toLowerCase() +
  lista.filter(a => el.hasAttribute(a)).map(a => `[${a}="${CSS.escape(el.getAttribute(a))}"]`).join('');
// Se o elemento aparece na tela. O checkVisibility() falta no Safari antes do 17.4: aí, se ele ocupa algum lugar
export const visivel = el => (el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0);
const aVista = el => visivel(el) && !el.disabled;
const posicaoEntre = (lugar, seletor, el) => [...lugar.querySelectorAll(seletor)].filter(aVista).indexOf(el);

// O Tab que sai de um campo digitado: o change do campo chega com o foco já no <body>, antes de o Tab entregá-lo ao
// seguinte, e se a linha é redesenhada o seguinte também some. O Tab em andamento fica lembrado até o fim da tarefa, e o
// redesenho leva o foco ao elemento seguinte (ou ao anterior, no Shift+Tab) da versão nova
let tabEmAndamento = null;
addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  tabEmAndamento = { origem: e.target, passo: e.shiftKey ? -1 : 1 };
  setTimeout(() => { tabEmAndamento = null; });
}, true);
const TABULAVEL = 'a[href], button, input, select, textarea, summary, [tabindex]';
function vizinhoNoTab(el, passo) {
  const todos = [...document.querySelectorAll(TABULAVEL)].filter(x => x.tabIndex >= 0 && aVista(x));
  const i = todos.indexOf(el);
  return i < 0 ? null : todos[i + passo] || null;
}

// O item em que um elemento está: o seletor dele (se ele tem identidade), o tipo dos itens da mesma lista e a posição
function descreverItem(lugar, item) {
  if (!item || item === lugar || !lugar.contains(item)) return null;
  const tipo = item.matches('tbody tr') ? 'tbody tr' : item.matches('.audit-item') ? '.audit-item' : 'li';
  const identidade = comAtributos(item, DA_LINHA);
  return { seletor: identidade.includes('[') ? identidade : null, tipo, posicao: posicaoEntre(lugar, tipo, item) };
}

function focoEm(lugar) {
  let el = document.activeElement, passo = 0;
  if ((!el || el === document.body) && tabEmAndamento && lugar.contains(tabEmAndamento.origem)) {
    ({ origem: el, passo } = tabEmAndamento);
  }
  if (!el || el === lugar || !lugar.contains(el)) return null;
  // O próprio item, em foco depois de o botão dele sumir (focarSemAcao): continua o lugar do foco
  if (el.hasAttribute('data-foco-neutro')) {
    const item = descreverItem(lugar, el);
    return item && { seletor: item.seletor, neutro: true, item };
  }
  const proprio = comAtributos(el, QUEM_E);
  if (proprio === el.tagName.toLowerCase()) return null;
  const linha = el.parentElement && el.parentElement.closest(LINHA);
  const tipo = comAtributos(el, DO_TIPO);
  return {
    seletor: linha && linha !== lugar && lugar.contains(linha) ? `${comAtributos(linha, DA_LINHA)} ${proprio}` : proprio,
    campo: el.matches('input, select, textarea'),
    passo,
    tipo,
    posicao: posicaoEntre(lugar, tipo, el),
    item: descreverItem(lugar, el.closest(ITEM))
  };
}

// Um lugar para o foco que não faz nada com o Enter: o item recebe o foco até ele sair dele
function focarSemAcao(el) {
  if (!el.hasAttribute('tabindex')) {
    el.setAttribute('tabindex', '-1');
    el.setAttribute('data-foco-neutro', '');
    el.addEventListener('blur', () => { el.removeAttribute('tabindex'); el.removeAttribute('data-foco-neutro'); }, { once: true });
  }
  el.focus({ preventScroll: true });
}

function devolverFoco(lugar, foco) {
  if (!foco) return;
  const alvo = foco.seletor && lugar.querySelector(foco.seletor);
  if (alvo && aVista(alvo)) {
    // Saindo do campo pelo Tab: o seguinte, que pode estar fora da tela (o foco rola até ele, como no Tab)
    const seguinte = foco.passo && vizinhoNoTab(alvo, foco.passo);
    if (seguinte) seguinte.focus();
    else if (foco.neutro) focarSemAcao(alvo);
    else alvo.focus({ preventScroll: true });
    return;
  }
  if (foco.campo) {
    // Um campo sem tipo (só a tag) não tem com o que comparar
    if (!foco.tipo.includes('[') || foco.posicao < 0) return;
    const iguais = [...lugar.querySelectorAll(foco.tipo)].filter(aVista);
    if (iguais.length) iguais[Math.min(foco.posicao, iguais.length - 1)].focus({ preventScroll: true });
    return;
  }
  if (!foco.item) return;
  const mesmo = foco.item.seletor && lugar.querySelector(foco.item.seletor);
  const itens = [...lugar.querySelectorAll(foco.item.tipo)].filter(aVista);
  const destino = mesmo && aVista(mesmo) ? mesmo : foco.item.posicao >= 0 && itens[Math.min(foco.item.posicao, itens.length - 1)];
  if (destino) focarSemAcao(destino);
}

// Troca o conteúdo de um lugar da tela mantendo o foco no elemento equivalente
export function trocarConteudo(lugar, html) {
  // O foco é um cuidado a mais: um erro nele não pode impedir o redesenho, nem a gravação, que vem depois dele
  const foco = semFalhar(() => focoEm(lugar));
  lugar.innerHTML = html;
  semFalhar(() => devolverFoco(lugar, foco));
}

// Troca um elemento inteiro (a linha de uma tabela) mantendo o foco no equivalente da versão nova
export function trocarElemento(el, html) {
  const pai = el.parentElement;
  const foco = pai && semFalhar(() => focoEm(pai));
  el.outerHTML = html;
  if (pai) semFalhar(() => devolverFoco(pai, foco));
}

// Leva o foco ao título de um lugar da tela (uma aba aberta pelo menu, uma parte do Manual): quem usa o teclado ou o
// leitor de tela continua de onde a página foi
export function focarNoTitulo(lugar) {
  if (!lugar) return;
  const titulo = lugar.matches('h1, h2, h3, h4') ? lugar : lugar.querySelector('h1, h2, h3, h4') || lugar;
  if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1');
  titulo.focus();
}

// Um anúncio para o leitor de tela, na região #anuncio (que não aparece na tela). Esvaziar e escrever na volta seguinte
// do navegador faz o mesmo texto ser lido de novo
export function anunciar(texto) {
  const lugar = $('#anuncio');
  if (!lugar) return;
  lugar.textContent = '';
  requestAnimationFrame(() => { lugar.textContent = texto; });
}
