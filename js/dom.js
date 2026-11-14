// Utilitários de DOM: seletor, avisos (notificação temporária e aviso fixo) e foco no último campo.

export const $ = s => document.querySelector(s);

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
