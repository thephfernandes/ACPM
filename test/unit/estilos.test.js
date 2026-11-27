// As folhas de estilo, uma por dona (css/*.css): index.html carrega todas, na ordem; a TV (painel.html) carrega css/app.css,
// que importa as cinco que valem nas duas páginas, na mesma ordem. Uma folha nova entra nas duas listas abaixo (e no
// README "Estrutura"); uma regra fica numa folha só. O que cada folha faz na tela é medido por scripts/medir-estilos.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const ler = arquivo => readFileSync(`${RAIZ}${arquivo}`, 'utf8');

// A ordem é a da cascata: a base, os componentes e o painel (também da TV), a casca, a linha, o trilho, cada tela, as gavetas e os diálogos;
// os alvos de toque por último, como estavam no fim de css/app.css
const DO_APP = ['base', 'componentes', 'painel', 'tv', 'casca', 'linha', 'trilho', 'escala', 'demanda', 'agenda', 'recursos', 'instrutores', 'alunos',
  'cadastros', 'cursos', 'rodizio', 'bi', 'conta', 'manual', 'gavetas', 'dialogos', 'lista', 'toque'];
const DA_TV = ['base', 'componentes', 'painel', 'tv', 'toque'];

const linksDe = html => [...html.matchAll(/<link rel="stylesheet" href="css\/([\w-]+)\.css">/g)].map(m => m[1]);
const semComentarios = texto => texto.replace(/\/\*[\s\S]*?\*\//g, '');
// As regras de uma folha, cada uma com a @media em que está: "@media …|seletor|corpo"
function regras(texto) {
  const saida = [];
  const limpo = semComentarios(texto);
  let i = 0, media = '';
  while (i < limpo.length) {
    const abre = limpo.indexOf('{', i);
    if (abre < 0) break;
    const cabecalho = limpo.slice(i, abre).trim();
    if (cabecalho.startsWith('@media')) { media = cabecalho; i = abre + 1; continue; }
    if (cabecalho.startsWith('}')) { media = ''; i = limpo.indexOf('}', i) + 1; continue; }
    let prof = 1, j = abre + 1;
    while (prof) { if (limpo[j] === '{') prof++; else if (limpo[j] === '}') prof--; j++; }
    if (cabecalho) saida.push(`${media}|${cabecalho.replace(/\s+/g, ' ')}|${limpo.slice(abre + 1, j - 1).replace(/\s+/g, ' ').trim()}`);
    i = j;
    // O fim de uma @media: a chave que sobra depois das regras dela
    const resto = limpo.slice(i).match(/^\s*\}/);
    if (media && resto) { media = ''; i += resto[0].length; }
  }
  return saida;
}

describe('As folhas de estilo', () => {
  it('index.html carrega as folhas de cada dona, uma vez cada, na ordem da cascata', () => {
    assert.deepEqual(linksDe(ler('index.html')), DO_APP);
  });

  it('a TV carrega css/app.css, que importa as cinco das duas páginas, na mesma ordem', () => {
    assert.deepEqual(linksDe(ler('painel.html')), ['app']);
    const imports = [...semComentarios(ler('css/app.css')).matchAll(/@import url\("([\w-]+)\.css"\);/g)].map(m => m[1]);
    assert.deepEqual(imports, DA_TV);
    assert.equal(semComentarios(ler('css/app.css')).replace(/@import url\("[\w-]+\.css"\);/g, '').trim(), '', 'css/app.css só importa');
    // A ordem da TV é a mesma de index.html
    assert.deepEqual(DO_APP.filter(f => DA_TV.includes(f)), DA_TV);
  });

  it('não há folha que nenhuma página carregue', () => {
    const folhas = readdirSync(`${RAIZ}css`).filter(n => n.endsWith('.css')).map(n => n.replace(/\.css$/, '')).sort();
    assert.deepEqual(folhas, [...DO_APP, 'app'].sort());
  });

  it('cada folha começa dizendo o que guarda', () => {
    for (const f of DO_APP) assert.match(ler(`css/${f}.css`), /^\/\* \S/, f);
  });

  it('as quatro regras que nenhum elemento usava saíram (.chip.off, .num, .saldo, details.pn summary)', () => {
    for (const f of DO_APP) {
      const texto = semComentarios(ler(`css/${f}.css`));
      for (const morta of [/\.chip\.off\b/, /\.num\b/, /\.saldo\b/, /details\.pn summary/]) assert.doesNotMatch(texto, morta, `${f}: ${morta}`);
    }
  });

  it('uma regra fica numa folha só', () => {
    const onde = new Map();
    for (const f of DO_APP) for (const r of regras(ler(`css/${f}.css`))) onde.set(r, [...(onde.get(r) || []), f]);
    assert.ok(onde.size > 900, `só ${onde.size} regras lidas`);
    assert.deepEqual([...onde].filter(([, folhas]) => folhas.length > 1), []);
  });
});
