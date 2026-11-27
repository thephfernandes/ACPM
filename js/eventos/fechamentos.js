// Os eventos de "Horários fechados nesta data" (J; a tela em js/views/fechamentos.js): abrir e fechar o formulário, os
// campos dele, "Fechar", o ✕ de um intervalo e o ↶ do Histórico (setFechamentos). Cada mudança é uma entrada do
// Histórico. A primeira mudança de uma data sem fechamentos parte dos das nove janelas de antes (fechamentosDoWin), que
// ficam na lista: a data não perde o que já estava fechado. Importado por js/eventos/recursos.js (js/main.js é congelado)
import { gravarAlteracao } from '../actions.js';
import { S } from '../state.js';
import { $, fecharNoEsc } from '../dom.js';
import { fechamentosDoEstado, normalizarFechamentos, rotuloDosFechamentos } from '../fechamentos.js';
import { aoAcionar, aoMudarCampo, aoReverter } from './registro.js';
import { rFechamentos, atualizarFormularioDosFechamentos, abrirFormulario, fecharFormulario, mudarFormulario, formularioAberto, formularioDosFechamentos, podeFechar } from '../views/fechamentos.js';
import { redesenharPorNome } from '../redesenho.js';

// O texto do Histórico: "Horários fechados nesta data: 12:40–17:30 (todos os recursos)"
const paraOHistorico = lista => (lista.length ? rotuloDosFechamentos(lista).map(r => r.replace(' · ', ' (') + ')').join('; ') : 'nenhum');

function gravar(nova) {
  const antes = Array.isArray(S.fechamentos) ? normalizarFechamentos(S.fechamentos) : null;
  S.fechamentos = normalizarFechamentos(nova);
  gravarAlteracao('exc', `Horários fechados nesta data: ${paraOHistorico(S.fechamentos)}`, { kind: 'setFechamentos', antes, label: '↶ Reverter' });
  redesenharPorNome('recursos');
}

function focarNoBotao() {
  const botao = $('#fechamentos [data-act="fechar-horarios"]');
  if (botao) botao.focus();
}

function fechar({ focar = true } = {}) {
  fecharFormulario();
  rFechamentos();
  if (focar) focarNoBotao();
}

aoAcionar('fechar-horarios', () => {
  if (formularioAberto()) { fechar(); return; }
  abrirFormulario();
  rFechamentos();
  const de = $('#fch-de');
  if (de) de.focus();
});
aoAcionar('fch-cancelar', () => fechar());
aoAcionar('fch-dia-todo', () => {
  mudarFormulario({ de: 6 * 60, ate: 24 * 60 });
  atualizarFormularioDosFechamentos();
});
aoAcionar('fch-fechar', () => {
  const f = formularioDosFechamentos();
  if (!f || !podeFechar(f)) return;
  fecharFormulario();
  gravar([...fechamentosDoEstado(S), { de: f.de, ate: f.ate, ...(f.categorias.length ? { categorias: f.categorias } : {}) }]);
  focarNoBotao();
});
aoAcionar('tirar-fechamento', b => {
  const lista = fechamentosDoEstado(S);
  const i = +b.dataset.i;
  if (!Number.isInteger(i) || !lista[i]) return;
  gravar(lista.filter((_, k) => k !== i));
  focarNoBotao();
});

// Os campos do formulário mudam só o rascunho (nada é gravado antes de "Fechar"); a linha do efeito e o "Fechar" mudam
// nos mesmos elementos, e o foco fica onde está
aoMudarCampo('fch-de', t => { mudarFormulario({ de: +t.value }); atualizarFormularioDosFechamentos(); });
aoMudarCampo('fch-ate', t => { mudarFormulario({ ate: +t.value }); atualizarFormularioDosFechamentos(); });
aoMudarCampo('fch-cat', t => {
  const f = formularioDosFechamentos();
  if (!f) return;
  const categorias = t.checked ? [...new Set([...f.categorias, t.dataset.cat])] : f.categorias.filter(c => c !== t.dataset.cat);
  mudarFormulario({ categorias });
  atualizarFormularioDosFechamentos();
});

// Esc no formulário: como "Cancelar"
fecharNoEsc(() => (formularioAberto() ? $('#fechamentos') : null), () => fechar());

aoReverter('setFechamentos', (rev, entry) => {
  if (rev.antes === null) delete S.fechamentos;
  else S.fechamentos = rev.antes;
  const agora = fechamentosDoEstado(S);
  gravarAlteracao('inc', `Revertido: horários fechados nesta data: ${paraOHistorico(agora)}`, null, entry.id);
  redesenharPorNome('recursos');
});
