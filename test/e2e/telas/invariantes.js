// As conferências que valem para todas as telas (dono: F1): o nome de cada controle para o leitor de tela, a área de
// toque no celular e a página que não rola para o lado; e o passeio por todas as telas, as abas e os ESTADOS de cada
// driver. Uma tela nova entra no passeio pelos ESTADOS do driver dela
import { ABAS, irPara } from './casca.js';
import { ESTADOS as DE_INSTRUTORES } from './instrutores.js';
import { ESTADOS as DE_ALUNOS } from './alunos.js';
import { ESTADOS as DA_DEMANDA } from './demanda.js';
import { ESTADOS as DE_RECURSOS } from './recursos.js';
import { ESTADOS as DE_CURSOS } from './cursos.js';

// As regiões da página que as conferências olham: a casca (o topo, a linha e o trilho à vista) e a tela aberta
export const REGIOES = { casca: 'header.topo, #linha, #trilho:not([hidden])', tela: 'main#conteudo > section.on' };

// A largura do documento: maior que a da janela, a página rola para o lado
export const larguraDaPagina = page => page.evaluate(() => document.documentElement.scrollWidth);

// Controles da tela aberta e da casca com área de toque menor que 44 px (a caixa de seleção conta com o rótulo que a
// envolve; links no meio do texto ficam de fora)
export const alvosPequenos = page => page.evaluate(() => {
  const secao = document.querySelector('main section.on');
  const controles = [...document.querySelectorAll('.topo button, .topo select, .topo input, .topo a[href], #linha a[href]:not(.tarefa), #linha button, #trilho button, #trilho a[href]'),
    ...secao.querySelectorAll('button, select, input, summary, a[href]')];
  const pequenos = new Set();
  for (const el of controles) {
    if (!el.checkVisibility({ visibilityProperty: true }) || el.matches('p a, .sr')) continue;
    const alvo = el.matches('input[type=checkbox]') ? (el.closest('label') || el) : el;
    const { width, height } = alvo.getBoundingClientRect();
    // A barra do voo no mapa tem a largura da duração dele (a escala do mapa): só a altura conta
    if (height < 44 || (!el.matches('select, input:not([type=checkbox]), summary, .tl-bar') && width < 44)) {
      pequenos.add(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.dataset.f ? `[data-f=${el.dataset.f}]` : ''}${el.dataset.act ? `[data-act=${el.dataset.act}]` : ''} ${Math.round(width)}×${Math.round(height)}`);
    }
  }
  return [...pequenos];
});

// Nome acessível, do jeito simples: aria-label, aria-labelledby, o rótulo do campo, o texto do botão ou a dica
export const semNome = (page, raiz) => page.evaluate(seletor => {
  const nome = el => {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    const por = el.getAttribute('aria-labelledby');
    if (por) return por.split(' ').map(id => (document.getElementById(id) || {}).textContent || '').join(' ');
    if (el.labels && el.labels.length) return [...el.labels].map(l => l.textContent).join(' ');
    // Sem texto, o leitor de tela usa a dica (title)
    if (el.matches('button, summary, a') && el.textContent.trim()) return el.textContent;
    return el.title || '';
  };
  const problemas = new Set();
  for (const raiz of document.querySelectorAll(seletor)) {
    for (const el of raiz.querySelectorAll('button, select, input, textarea, summary, a[href]')) {
      if (!el.checkVisibility() && !el.matches('input[type=checkbox]')) continue;
      if (el.matches('input[type=checkbox]') && !el.closest('label, td, th, li')?.checkVisibility()) continue;
      const n = nome(el).replace(/\s+/g, ' ').trim();
      if (!n || n === '✕' || n === '×') {
        problemas.add(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.dataset.f ? `[data-f=${el.dataset.f}]` : ''}${el.dataset.act ? `[data-act=${el.dataset.act}]` : ''}${el.dataset.a ? `[data-a=${el.dataset.a}]` : ''} "${n}"`);
      }
    }
  }
  return [...problemas];
}, raiz);

// Os ESTADOS dos drivers, na ordem do passeio: as telas que não são a de abertura de uma aba (as outras vistas, os
// painéis abertos dos filtros de vários valores, as tabelas que os filtros deixam sem nenhuma linha, outro curso)
const ESTADOS = [...DE_INSTRUTORES, ...DE_ALUNOS, ...DA_DEMANDA, ...DE_RECURSOS, ...DE_CURSOS];

// Todas as telas: cada aba como ela abre (naAba(aba); sem ela, conferir(`aba ${aba}`)) e, depois, cada estado dos drivers
// (conferir(nome)). As abas são ABAS, ou as que o teste leu da página (abas: uma aba nova também é conferida). No fim, a
// busca e as marcas voltam a vazias, Recursos, à Disponibilidade do dia, e Cursos, ao primeiro curso
export async function percorrerTelas(page, conferir, { abas = ABAS, naAba = aba => conferir(`aba ${aba}`) } = {}) {
  for (const aba of abas) {
    await irPara(page, aba);
    await naAba(aba);
  }
  for (const { nome, preparar } of ESTADOS) {
    await preparar(page);
    if (nome) await conferir(nome);
  }
}
