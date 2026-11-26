// As telas na página: mostrar uma (a seção, a marca da navegação, o endereço, a rolagem e o foco), o que cada tela faz ao
// aparecer (registrarTela, chamado pelo módulo de eventos dela) e o endereço ligado à navegação (os links #/<tela>,
// Voltar e Avançar). Quem vê cada tela, a tela da abertura e a leitura do endereço ficam em js/telas.js
import { focarNoTitulo } from '../dom.js';
import { empilharTela, substituirTela, escreverDataNoEndereco } from '../endereco.js';
import { ApiClient } from '../storage.js';
import { TELAS, podeVer, telaDeAbertura, destinoDoEndereco } from '../telas.js';

const aoMostrarDe = new Map();
let aberta = 'esc';
let escolhida = false;
let navegacao = 0;

// O que a tela faz ao aparecer (ler os dados dela, desenhar, ir a um lugar). Pode devolver o elemento do lugar do item, que
// vem à vista (e recebe o foco, quando a navegação leva o foco), ou { lugar, focou: true }, quando ela mesma já pôs o foco
// (Aprovar, no botão da aprovação)
export function registrarTela(id, { aoMostrar = () => {} } = {}) {
  aoMostrarDe.set(id, aoMostrar);
}

export const telaAberta = () => aberta;
// Uma tela escolhida pela pessoa (um clique, Voltar, um endereço digitado) enquanto os dados carregam não é trocada pela
// tela da abertura
export const telaFoiEscolhida = () => escolhida;

// O perfil da conta; no modo local, nenhum (vê todas as telas menos a conta)
const perfilAtual = () => ApiClient.perfil || null;

// No celular, a faixa da navegação rola para o lado: o link da tela aberta vem inteiro para a parte à vista dela
function mostrarNaFaixa(link) {
  const faixa = link && link.closest('#linha .linha-corpo');
  if (!faixa) return;
  const b = link.getBoundingClientRect(), f = faixa.getBoundingClientRect();
  if (b.left < f.left) faixa.scrollLeft -= f.left - b.left;
  else if (b.right > f.right) faixa.scrollLeft += b.right - f.right;
}

// A tela de um controle da navegação: o href (#/<tela>)
const telaDoControle = el => (destinoDoEndereco(el.getAttribute('href')) || {}).tela;

// Um id de elemento dentro de uma tela ('#manual-aba-rodizio', do índice do Manual): a tela dele, com o lugar deixado ao
// navegador; senão, a tela do endereço
export function destinoDoHash(hash) {
  const destino = destinoDoEndereco(hash);
  if (destino) return destino;
  if (typeof hash !== 'string' || hash.length < 2 || hash.startsWith('#/')) return null;
  let alvo;
  try { alvo = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return null; }
  const secao = alvo && alvo.closest('main#conteudo > section.tela');
  const tela = secao && Object.keys(TELAS).find(t => (TELAS[t].secao ?? 's-' + t) === secao.id && !TELAS[t].item);
  return tela ? { tela, item: alvo.id, nativo: true } : null;
}

// Mostra a tela. historico: 'empilhar' (uma entrada nova), 'substituir' (a entrada atual) ou 'nenhum' (veio do endereço).
// focar: o foco vai para o lugar do item ou para o título da tela. rolagem: a de uma entrada do histórico (Voltar). ler:
// false na abertura, antes da sessão e dos dados (a tela só aparece; o que ela faz ao aparecer vem com os dados)
export async function mostrarTela(id, { item = null, historico = 'empilhar', focar = false, rolagem = null, nativo = false, ler = true } = {}) {
  const vez = ++navegacao;
  // A tela que o perfil não vê: a da abertura dele, também no endereço
  if (!podeVer(id, perfilAtual())) {
    id = telaDeAbertura(perfilAtual()); item = null; nativo = false;
    if (historico === 'nenhum') historico = 'substituir';
  }
  const tela = TELAS[id];
  if (historico === 'empilhar') empilharTela({ tela: id, item: nativo ? null : item });
  else if (historico === 'substituir') substituirTela({ tela: id, item: nativo ? null : item });
  // Na hora, antes do que a tela lê: a entrada de antes (Voltar) ainda tem a data que estava aberta nela
  escreverDataNoEndereco();

  const secao = document.getElementById(tela.secao ?? 's-' + id);
  document.querySelectorAll('main#conteudo > section.tela').forEach(s => s.classList.toggle('on', s === secao));
  aberta = id;
  document.body.dataset.aberta = id;
  if (secao && secao.dataset.forma) document.body.dataset.forma = secao.dataset.forma;
  else delete document.body.dataset.forma;

  // A tela aberta é dita ao leitor de tela, não só mostrada pela cor: um só controle da navegação com aria-current
  let atual = null;
  document.querySelectorAll('[data-nav]').forEach(el => {
    const essa = telaDoControle(el) === id;
    el.classList.toggle('on', essa);
    if (essa && !atual) { atual = el; el.setAttribute('aria-current', 'page'); } else el.removeAttribute('aria-current');
  });

  const aoMostrar = ler ? aoMostrarDe.get(id) : null;
  const feito = aoMostrar ? await aoMostrar(item ?? tela.item ?? null) : null;
  if (vez !== navegacao) return;
  const lugar = feito && !(feito instanceof Element) && 'lugar' in feito ? feito.lugar : feito;
  const focou = Boolean(feito && feito.focou);

  // A rolagem: a da entrada (Voltar), o lugar do item, o topo; o lugar de um id do próprio Manual fica com o navegador
  const elemento = lugar instanceof Element ? lugar : null;
  if (rolagem !== null && rolagem !== undefined) window.scrollTo(0, rolagem);
  else if (elemento) elemento.scrollIntoView({ block: 'start' });
  else if (!nativo) window.scrollTo(0, 0);

  if (focar && !focou) focarNoTitulo(elemento || secao);
  // O item vale uma vez: o endereço fica só com a tela (recarregar não repete o que ele fez)
  if (item && !nativo && item !== tela.item) substituirTela({ tela: id });
  mostrarNaFaixa(atual);
}

// Os links #/<tela>, o link que pula para o conteúdo, Voltar e Avançar. js/main.js liga uma vez
export function ligarEndereco() {
  try { window.history.scrollRestoration = 'manual'; } catch { /* o navegador sem a opção rola sozinho */ }
  document.addEventListener('click', e => {
    const pular = e.target.closest('a.pular');
    if (pular) {
      // O foco no conteúdo sem mudar o endereço (a tela continua no fragmento). O tabindex vale só até o foco sair: fixo,
      // um clique num texto da tela levaria o próximo Tab ao começo do conteúdo, e não ao que vem depois do clique
      e.preventDefault();
      const conteudo = document.getElementById('conteudo');
      conteudo.setAttribute('tabindex', '-1');
      conteudo.addEventListener('blur', () => conteudo.removeAttribute('tabindex'), { once: true });
      conteudo.focus();
      return;
    }
    const link = e.target.closest('a[href^="#/"]');
    if (!link || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const destino = destinoDoEndereco(link.getAttribute('href'));
    if (!destino) return;
    e.preventDefault();
    escolhida = true;
    // O link da tela já aberta, sem item: lê os dados dela de novo, como o clique na aba fazia
    const mesma = destino.tela === aberta && !destino.item;
    mostrarTela(destino.tela, { item: destino.item, historico: mesma ? 'nenhum' : 'empilhar', focar: link.hasAttribute('data-focar') });
  });
  // Voltar, Avançar e um endereço digitado: os dois eventos de uma mesma troca abrem a tela uma vez
  const aoMudarEndereco = () => {
    // A entrada sem tela no endereço (a da abertura, antes de os dados chegarem): a tela da abertura do perfil
    const destino = destinoDoHash(window.location.hash) || (window.location.hash ? null : { tela: telaDeAbertura(perfilAtual()), item: null });
    const rolagem = window.history.state && Number.isFinite(window.history.state.rolagem) ? window.history.state.rolagem : null;
    if (!destino) { escreverDataNoEndereco(); return; }
    if (destino.tela === aberta && !destino.item) {
      escreverDataNoEndereco();
      if (rolagem !== null) window.scrollTo(0, rolagem);
      return;
    }
    escolhida = true;
    mostrarTela(destino.tela, { item: destino.item, nativo: Boolean(destino.nativo), historico: 'nenhum', rolagem });
  };
  window.addEventListener('popstate', aoMudarEndereco);
  window.addEventListener('hashchange', aoMudarEndereco);
}

// A navegação feita por um controle que não é um link (o menu da conta)
export function escolherTela(id, opcoes = {}) {
  escolhida = true;
  return mostrarTela(id, { historico: id === aberta && !opcoes.item ? 'nenhum' : 'empilhar', ...opcoes });
}
