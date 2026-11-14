// As dicas (revisão de 14/11): um balão só (#dica, role="tooltip") que explica um termo do glossário. Ele aparece:
// - com o mouse parado sobre o termo por 400 ms;
// - na hora, quando o foco do teclado chega a um elemento com a dica;
// - num toque ou clique no botão "?" (a dica de um rótulo) ou numa etiqueta com a dica (que não é um botão).
// Esc, um toque fora e sair do termo fecham o balão; ele acompanha a rolagem e o tamanho da tela. O texto entra só como
// texto (nunca como HTML). Para os leitores de tela, cada elemento com a dica aponta (aria-describedby) para o texto do
// termo, num nó escondido do glossário.
import { GLOSSARIO } from './glossario.js';
import { posicionarJunto } from './dom.js';

const ESPERA_DO_MOUSE = 400;
let alvo = null, porToque = false, espera = null;

const balao = () => document.getElementById('dica');
const idDoTexto = id => `glossario-${id}`;
// Elementos que fazem outra coisa no clique (o clique neles não abre a dica; o foco e o mouse, sim)
const temAcao = el => !el.classList.contains('dica-btn') && el.matches('button, a[href], input, select, textarea, summary, [role="button"]');

function criarNos() {
  if (balao()) return;
  const dica = document.createElement('div');
  dica.id = 'dica';
  dica.className = 'dica';
  dica.setAttribute('role', 'tooltip');
  dica.hidden = true;
  document.body.append(dica);
  const textos = document.createElement('div');
  textos.id = 'glossario-textos';
  textos.hidden = true;
  for (const [id, { texto }] of Object.entries(GLOSSARIO)) {
    const no = document.createElement('span');
    no.id = idDoTexto(id);
    no.textContent = texto;
    textos.append(no);
  }
  document.body.append(textos);
}

// Cada elemento com uma dica do glossário aponta para o texto dela (sem perder outra descrição que já tenha)
function descrever(raiz) {
  const elementos = raiz.matches && raiz.matches('[data-dica]') ? [raiz] : [];
  elementos.push(...(raiz.querySelectorAll ? raiz.querySelectorAll('[data-dica]') : []));
  for (const el of elementos) {
    const id = el.dataset.dica;
    if (!Object.hasOwn(GLOSSARIO, id)) continue;
    const atuais = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!atuais.includes(idDoTexto(id))) el.setAttribute('aria-describedby', [...atuais, idDoTexto(id)].join(' '));
  }
}

export function abrirDica(el, { toque = false } = {}) {
  const termo = GLOSSARIO[el.dataset.dica];
  const dica = balao();
  if (!termo || !dica) return;
  clearTimeout(espera);
  if (alvo && alvo !== el) fecharDica();
  alvo = el;
  porToque = toque;
  dica.replaceChildren();
  const titulo = document.createElement('strong');
  titulo.textContent = termo.termo;
  dica.append(titulo, ' ', termo.texto);
  dica.hidden = false;
  posicionarJunto(dica, el);
  if (el.classList.contains('dica-btn')) el.setAttribute('aria-expanded', 'true');
}

export function fecharDica() {
  clearTimeout(espera);
  const dica = balao();
  if (dica) dica.hidden = true;
  if (alvo && alvo.classList.contains('dica-btn')) alvo.setAttribute('aria-expanded', 'false');
  alvo = null;
  porToque = false;
}

export const dicaAberta = () => Boolean(alvo);

export function iniciarDicas() {
  criarNos();
  descrever(document.body);
  new MutationObserver(mudancas => {
    for (const m of mudancas) for (const no of m.addedNodes) if (no.nodeType === 1) descrever(no);
    // O termo saiu da tela (a lista foi refeita): o balão fecha
    if (alvo && !alvo.isConnected) fecharDica();
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-dica]');
    if (!el || el === alvo) return;
    clearTimeout(espera);
    espera = setTimeout(() => abrirDica(el), ESPERA_DO_MOUSE);
  });
  document.addEventListener('pointerout', e => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-dica]');
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
    clearTimeout(espera);
    if (el === alvo && !porToque && document.activeElement !== el) fecharDica();
  });
  document.addEventListener('focusin', e => {
    const el = e.target.closest && e.target.closest('[data-dica]');
    if (el && el.matches(':focus-visible')) abrirDica(el);
  });
  document.addEventListener('focusout', e => {
    if (alvo && e.target === alvo && !porToque) fecharDica();
  });
  // Toque ou clique: o "?" e a etiqueta abrem e fecham; fora do termo e do balão, fecha
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-dica]');
    if (el && !temAcao(el)) {
      if (alvo === el && porToque) fecharDica();
      else abrirDica(el, { toque: true });
      return;
    }
    if (alvo && !e.target.closest('#dica')) fecharDica();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && alvo) {
      // A dica fecha primeiro; o Esc não chega à gaveta ou ao diálogo de trás
      e.stopPropagation();
      fecharDica();
    }
  }, true);
  const reposicionar = () => { if (alvo) posicionarJunto(balao(), alvo); };
  addEventListener('scroll', reposicionar, true);
  addEventListener('resize', reposicionar);
}
