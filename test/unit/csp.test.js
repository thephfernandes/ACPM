// A política de segurança de conteúdo das duas páginas (revisão de 14/11): só os scripts e os estilos que elas usam e só
// os servidores do Supabase do app. Sem script embutido na página nem atributo de evento (onclick=...), a política não
// precisa de 'unsafe-inline' nos scripts. Uma biblioteca nova, ou uma versão nova, precisa entrar na política.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PROJETOS } from '../../js/config-supabase.js';

const ler = caminho => readFileSync(new URL(`../../${caminho}`, import.meta.url), 'utf8');
const PAGINAS = ['index.html', 'painel.html'];

function politica(html) {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'a página tem a política');
  return Object.fromEntries(m[1].split(';').map(d => d.trim().split(/\s+/)).filter(([nome]) => nome).map(([nome, ...fontes]) => [nome, fontes]));
}

// A fonte libera a URL: o servidor inteiro (sem caminho), uma pasta (caminho terminado em /) ou o arquivo exato
function libera(fontes, endereco) {
  const url = new URL(endereco);
  return fontes.filter(f => f.startsWith('https://')).some(f => {
    const fonte = new URL(f);
    if (fonte.origin !== url.origin) return false;
    if (/^https:\/\/[^/]+\/?$/.test(f)) return true;
    return f.endsWith('/') ? url.pathname.startsWith(fonte.pathname) : url.pathname === fonte.pathname;
  });
}

const externos = (html, padrao) => [...html.matchAll(padrao)].map(m => m[1]).filter(u => u.startsWith('https://'));

describe('Política de segurança de conteúdo', () => {
  for (const pagina of PAGINAS) {
    it(`${pagina}: a política vem antes de qualquer script ou estilo`, () => {
      const html = ler(pagina);
      const posicao = html.indexOf('http-equiv="Content-Security-Policy"');
      assert.ok(posicao > 0);
      assert.ok(posicao < html.indexOf('<script') && posicao < html.indexOf('<link rel="stylesheet"'));
    });

    it(`${pagina}: scripts só da própria página e das bibliotecas usadas, sem 'unsafe-inline' nem 'unsafe-eval'`, () => {
      const html = ler(pagina), p = politica(html);
      assert.deepEqual(p['default-src'], ["'self'"]);
      assert.deepEqual(p['object-src'], ["'none'"]);
      assert.deepEqual(p['base-uri'], ["'self'"]);
      assert.ok(p['script-src'].includes("'self'"));
      assert.ok(!p['script-src'].some(f => f.startsWith("'unsafe")), p['script-src'].join(' '));
      const scripts = externos(html, /<script[^>]* src="([^"]+)"/g);
      assert.ok(scripts.length > 0);
      for (const src of scripts) assert.ok(libera(p['script-src'], src), `script fora da política: ${src}`);
      assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/.test(html), 'nenhum script embutido');
      for (const css of externos(html, /<link rel="stylesheet" href="([^"]+)"/g)) {
        assert.ok(libera(p['style-src-elem'], css), `estilo fora da política: ${css}`);
      }
    });

    it(`${pagina}: conexões só com a própria página e os servidores do Supabase do app`, () => {
      const p = politica(ler(pagina));
      for (const { url } of Object.values(PROJETOS)) assert.ok(p['connect-src'].includes(url), url);
      assert.deepEqual(p['connect-src'].filter(f => f !== "'self'").sort(), Object.values(PROJETOS).map(x => x.url).sort());
    });
  }

  it('nenhuma tela usa atributos de evento (onclick=...)', () => {
    const arquivos = [...PAGINAS, ...readdirSync(new URL('../../js/', import.meta.url), { recursive: true })
      .filter(f => f.endsWith('.js')).map(f => `js/${f}`)];
    for (const arquivo of arquivos) {
      assert.ok(!/\son[a-z]+\s*=\s*["'`$]/.test(ler(arquivo)), `atributo de evento em ${arquivo}`);
    }
  });
});
