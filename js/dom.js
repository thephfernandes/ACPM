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
// o erro de gravação some quando uma gravação der certo (fecharAviso('erro'))
let avisoAtual = null;
export const avisoAberto = () => avisoAtual;
export function mostrarAviso(tipo, texto) {
  avisoAtual = tipo;
  $('#aviso-sync-texto').textContent = texto;
  $('#aviso-sync').hidden = false;
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
