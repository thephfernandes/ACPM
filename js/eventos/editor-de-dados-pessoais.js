// Os dados pessoais no detalhe de uma pessoa (js/views/editor-de-dados-pessoais.js): o que se digita vira o rascunho
// dela, "Salvar" (o envio do formulário: também o Enter) grava, "Desfazer" joga o rascunho fora e "Tentar de novo" lê a
// pessoa de novo. Os ouvintes ficam no documento, para qualquer seção [data-pessoa] (Alunos; INVAs no passo C). Importado
// uma vez, por js/main.js
import { stuBy, insBy } from '../state.js';
import { digitou, salvar, desfazer, lerDeNovo } from '../views/editor-de-dados-pessoais.js';

const daPessoa = el => {
  const lugar = el instanceof Element && el.closest('[data-pessoa]');
  if (!lugar) return null;
  const [tipo, id] = lugar.dataset.pessoa.split(':');
  return { tipo, id: +id, lugar };
};
const nomeDe = (tipo, id) => { const p = tipo === 'aluno' ? stuBy(id) : insBy(id); return p ? p.nm : ''; };

document.addEventListener('input', e => {
  if (!e.target.matches || !e.target.matches('.dado-campo[data-dado]')) return;
  const quem = daPessoa(e.target);
  if (!quem) return;
  // "Desfazer" aparece (e some, com os campos de volta ao que está guardado) na hora: o desenho da seção espera o campo
  // com o texto digitado perder o foco
  const temRascunho = digitou(quem.tipo, quem.id, e.target.form);
  const botao = quem.lugar.querySelector('[data-desfazer-dados]');
  if (botao) botao.hidden = !temRascunho;
});

document.addEventListener('submit', e => {
  if (!e.target.matches('.dados-form')) return;
  e.preventDefault();
  const quem = daPessoa(e.target);
  if (quem) salvar(quem.tipo, quem.id, e.target, nomeDe(quem.tipo, quem.id));
});

document.addEventListener('click', e => {
  const botao = e.target instanceof Element && e.target.closest('[data-desfazer-dados], [data-ler-dados]');
  if (!botao) return;
  const [tipo, id] = (botao.dataset.desfazerDados || botao.dataset.lerDados).split(':');
  if (botao.dataset.lerDados) { lerDeNovo(tipo, +id); return; }
  desfazer(tipo, +id);
  // O foco vai para o primeiro campo da seção refeita (o botão sumiu)
  const primeiro = document.querySelector(`[data-pessoa="${tipo}:${id}"] .dado-campo`);
  if (primeiro) primeiro.focus();
});
