// "↶ Reverter" no histórico: os tipos de reversão que validarReversao aceita (js/reversoes.js) e os que as telas registram
// com aoReverter (js/eventos/*.js) são os mesmos, cada um registrado uma vez. Um tipo aceito sem registro seria um botão
// que não faz nada; um registrado que validarReversao não aceita nunca chegaria ao registro
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const ler = arquivo => espree.parse(readFileSync(join(RAIZ, arquivo), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', loc: true });

function percorrer(no, visitar) {
  if (!no || typeof no.type !== 'string') return;
  visitar(no);
  for (const valor of Object.values(no)) {
    if (Array.isArray(valor)) valor.forEach(filho => percorrer(filho, visitar));
    else if (valor && typeof valor.type === 'string') percorrer(valor, visitar);
  }
}

// Os textos comparados com rev.kind dentro de validarReversao
function tiposAceitos() {
  const funcao = ler('js/reversoes.js').body.map(no => (no.type === 'ExportNamedDeclaration' ? no.declaration : no))
    .find(no => no && no.type === 'FunctionDeclaration' && no.id.name === 'validarReversao');
  assert.ok(funcao, 'validarReversao não foi achada em js/reversoes.js');
  const tipos = [];
  percorrer(funcao.body, no => {
    if (no.type === 'BinaryExpression' && no.operator === '===' && no.left.type === 'MemberExpression'
      && no.left.object.name === 'rev' && no.left.property.name === 'kind' && no.right.type === 'Literal') tipos.push(no.right.value);
  });
  return tipos;
}

// O primeiro argumento de cada aoReverter(…) nos módulos de eventos
function tiposRegistrados() {
  const pasta = join(RAIZ, 'js', 'eventos');
  return readdirSync(pasta).filter(n => n.endsWith('.js')).flatMap(nome => {
    const registros = [];
    percorrer(ler(`js/eventos/${nome}`), no => {
      if (no.type === 'CallExpression' && no.callee.type === 'Identifier' && no.callee.name === 'aoReverter') {
        const [tipo] = no.arguments;
        registros.push({ tipo: tipo && tipo.type === 'Literal' ? tipo.value : null, onde: `js/eventos/${nome}:${no.loc.start.line}` });
      }
    });
    return registros;
  });
}

describe('As reversões registradas', () => {
  it('cada tipo aceito por validarReversao tem quem o desfaça, e só um', () => {
    const aceitos = tiposAceitos(), registros = tiposRegistrados();
    assert.equal(aceitos.length, 10, `os tipos aceitos: ${aceitos.join(', ')}`);
    for (const r of registros) assert.ok(r.tipo, `${r.onde}: o tipo precisa ser um texto escrito na chamada`);
    const registrados = registros.map(r => r.tipo);
    assert.deepEqual([...registrados].sort(), [...new Set(registrados)].sort(), 'um tipo registrado mais de uma vez');
    assert.deepEqual([...new Set(registrados)].sort(), [...aceitos].sort());
  });
});
