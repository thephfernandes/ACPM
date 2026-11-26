// Os desenhos registrados (js/redesenho.js), conferidos no código: cada nome é registrado uma vez, no módulo de eventos
// de uma tela; cada momento pedido existe; quem redesenha pelo nome pede um nome registrado; quem redesenha por momento
// pede um momento que existe e que algum desenho usa. Um nome errado falha aqui, em vez de só na tela (com o erro no
// console de cada teste E2E que passa por ele)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';
import { desenhosRegistrados } from '../../js/redesenho.js';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const arquivos = pasta => readdirSync(pasta).flatMap(nome => {
  const caminho = join(pasta, nome);
  return statSync(caminho).isDirectory() ? arquivos(caminho) : nome.endsWith('.js') ? [caminho] : [];
});
const doApp = arquivos(join(RAIZ, 'js'));
const nomeDoArquivo = arquivo => relative(RAIZ, arquivo).split(sep).join('/');

function percorrer(no, visitar) {
  if (!no || typeof no.type !== 'string') return;
  visitar(no);
  for (const valor of Object.values(no)) {
    if (Array.isArray(valor)) valor.forEach(filho => percorrer(filho, visitar));
    else if (valor && typeof valor.type === 'string') percorrer(valor, visitar);
  }
}
const literal = no => (no && no.type === 'Literal' && typeof no.value === 'string' ? no.value : null);

// As chamadas de registrarDesenho, redesenharPorNome e redesenhar em todo js/, e a lista MOMENTOS de js/redesenho.js
const registros = [], porNome = [], porMomento = [];
let momentos = null;
for (const arquivo of doApp) {
  const arvore = espree.parse(readFileSync(arquivo, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', loc: true });
  const onde = no => `${nomeDoArquivo(arquivo)}:${no.loc.start.line}`;
  // Só contam as funções importadas de js/redesenho.js (o painel da TV tem um redesenhar() dele)
  // (o nome local, também o de um import { redesenhar as outro }, leva ao nome importado)
  const doRegistro = new Map(arvore.body.filter(no => no.type === 'ImportDeclaration' && /(^|\/)redesenho\.js$/.test(no.source.value))
    .flatMap(no => no.specifiers.map(s => [s.local.name, s.imported ? s.imported.name : '*'])));
  percorrer(arvore, no => {
    if (no.type === 'VariableDeclarator' && no.id.name === 'MOMENTOS' && nomeDoArquivo(arquivo) === 'js/redesenho.js') {
      momentos = no.init.elements.map(literal);
    }
    if (no.type !== 'CallExpression' || no.callee.type !== 'Identifier' || !doRegistro.has(no.callee.name)) return;
    const [primeiro, , opcoes] = no.arguments;
    const funcao = doRegistro.get(no.callee.name);
    if (funcao === 'registrarDesenho') {
      const em = opcoes && opcoes.properties && opcoes.properties.find(p => p.key.name === 'em');
      registros.push({ nome: literal(primeiro), em: em ? em.value.elements.map(literal) : [], arquivo: nomeDoArquivo(arquivo), onde: onde(no) });
    } else if (funcao === 'redesenharPorNome') {
      no.arguments.forEach(a => porNome.push({ nome: literal(a), onde: onde(no) }));
    } else if (funcao === 'redesenhar') {
      porMomento.push({ momento: literal(primeiro), onde: onde(no) });
    }
  });
}

describe('Os desenhos registrados', () => {
  it('a lista dos momentos foi achada em js/redesenho.js, e o próprio módulo não registra nenhum desenho', () => {
    assert.deepEqual(momentos, ['dados', 'consulta', 'releitura', 'escala', 'perfil', 'pedidos', 'data-aberta', 'sessao']);
    assert.deepEqual(desenhosRegistrados(), []);
  });

  it('cada nome é um texto, registrado uma vez, no módulo de eventos de uma tela (js/eventos/)', () => {
    assert.ok(registros.length >= 14, `só ${registros.length} registros achados`);
    for (const r of registros) {
      assert.ok(r.nome, `${r.onde}: o nome do desenho precisa ser um texto escrito na chamada`);
      assert.match(r.arquivo, /^js\/eventos\/[\w-]+\.js$/, `${r.onde}: registrado fora de js/eventos/`);
    }
    const repetidos = registros.map(r => r.nome).filter((n, i, todos) => todos.indexOf(n) !== i);
    assert.deepEqual(repetidos, [], 'nomes registrados mais de uma vez');
  });

  it('cada momento pedido existe', () => {
    for (const r of registros) {
      for (const m of r.em) assert.ok(momentos.includes(m), `${r.onde}: o momento "${m}" não existe (os momentos: ${momentos.join(', ')})`);
    }
  });

  it('quem redesenha pelo nome pede um nome registrado', () => {
    assert.ok(porNome.length > 0);
    const nomes = new Set(registros.map(r => r.nome));
    for (const p of porNome) {
      assert.ok(p.nome, `${p.onde}: o nome precisa ser um texto escrito na chamada`);
      assert.ok(nomes.has(p.nome), `${p.onde}: "${p.nome}" não está registrado`);
    }
  });

  it('quem redesenha por momento pede um momento que existe e que algum desenho usa', () => {
    const usados = new Set(registros.flatMap(r => r.em));
    for (const p of porMomento) {
      assert.ok(p.momento && momentos.includes(p.momento), `${p.onde}: o momento "${p.momento}" não existe`);
      assert.ok(usados.has(p.momento), `${p.onde}: nenhum desenho é refeito no momento "${p.momento}"`);
    }
    // Cada momento é pedido por alguém: a abertura e outra data, quem só consulta, "Tentar de novo", a escala refeita, o
    // perfil, os pedidos lidos e a data aberta. Um está reservado para o passo que o pede: 'sessao' (H, a abertura e a
    // gravação da data)
    const reservados = ['sessao'];
    assert.deepEqual([...new Set(porMomento.map(p => p.momento))].sort(), momentos.filter(m => !reservados.includes(m)).sort());
  });
});
