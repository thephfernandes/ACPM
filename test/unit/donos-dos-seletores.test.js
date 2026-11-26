// Os testes E2E chegam aos controles das telas pelos drivers (test/e2e/telas/*.js): cada seletor reservado aparece só no
// driver dele e nos testes da tela dona dele. Um passo que muda uma tela muda o driver dela (e os testes dela), e os
// outros testes continuam a passar pelo driver
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E = fileURLToPath(new URL('../e2e/', import.meta.url));

// O seletor (o texto como aparece no código, e a expressão que o acha sem pegar um id mais longo, como #dt-rotulo em
// #dt, e que pega o seletor montado, como `#ag-${campo}`), os drivers onde ele pode aparecer e os testes da tela dona
// dele. Um id também é achado quando o teste o lê pelo DOM (getElementById('dt'), activeElement.id === 'dt')
const DONOS = [
  // A casca (F1): a data (o botão e o trilho), a linha, o Histórico e o menu da conta
  { seletor: '#btn-data', achar: /#btn-data(?![\w-])/, drivers: ['casca.js'] },
  { seletor: '#trilho', achar: /#trilho(?![\w-])/, drivers: ['casca.js'] },
  { seletor: '.cal-dia', achar: /\.cal-dia(?![\w-])/, drivers: ['casca.js'] },
  { seletor: '#dt-rotulo', achar: /#dt-rotulo(?![\w-])/, drivers: ['casca.js'] },
  { seletor: '#dt-rel', achar: /#dt-rel(?![\w-])/, drivers: ['casca.js'] },
  { seletor: '#linha a[data-nav]', achar: /#linha a\[data-nav\]/, drivers: ['casca.js'] },
  { seletor: '#btn-open-log', achar: /#btn-open-log(?![\w-])/, drivers: ['casca.js'] },
  { seletor: '#btn-menu-conta', achar: /#btn-menu-conta(?![\w-])/, drivers: ['casca.js'] },
  // Recursos (B): a disponibilidade do dia e as janelas de operação
  { seletor: '#eqs', achar: /#eqs(?![\w-])/, drivers: ['recursos.js'], testes: ['recursos.spec.js'] },
  { seletor: '#wins', achar: /#wins(?![\w-])/, drivers: ['recursos.js'], testes: ['recursos.spec.js'] },
  // Instrutores (C): a grade do dia e o "Vem"
  { seletor: '#inst-dia', achar: /#inst-dia(?![\w-])/, drivers: ['instrutores.js'], testes: ['instrutores.spec.js'] },
  { seletor: '#inst-dia-cab', achar: /#inst-dia-cab(?![\w-])/, drivers: ['instrutores.js'], testes: ['instrutores.spec.js'] },
  { seletor: 'data-f="on"', achar: /data-f="on"/, drivers: ['instrutores.js'], testes: ['instrutores.spec.js'] },
  // A Demanda (G1, G2): o "Voa" de cada pedido
  { seletor: 'data-f="fly"', achar: /data-f="fly"/, drivers: ['demanda.js'], testes: ['demanda.spec.js'] },
  { seletor: '#importar-agenda', achar: /#importar-agenda(?![\w-])/, drivers: ['demanda.js'], testes: ['demanda.spec.js'] },
  // Os pedidos (D2): o formulário da Agenda
  { seletor: '#ag-*', achar: /#ag-(?:[\w-]|\$\{)/, drivers: ['pedidos.js'], testes: ['agenda.spec.js', 'agenda-compartilhado.spec.js'] },
  // A Escala e a aprovação (H)
  { seletor: '#btn-aprovar', achar: /#btn-aprovar(?![\w-])/, drivers: ['escala.js'], testes: ['aprovacao.spec.js'] },
  { seletor: '#btn-reabrir', achar: /#btn-reabrir(?![\w-])/, drivers: ['escala.js'], testes: ['aprovacao.spec.js'] },
  { seletor: '#exp', achar: /#exp(?![\w-])/, drivers: ['escala.js'] },
  { seletor: '#pdf', achar: /#pdf(?![\w-])/, drivers: ['escala.js'] },
  { seletor: '#xlsx', achar: /#xlsx(?![\w-])/, drivers: ['escala.js'] }
];

// O id lido pelo DOM, sem o "#": getElementById('dt'), el.id === 'dt'
const lidoPeloDom = seletor => (/^#[\w-]+$/.test(seletor)
  ? new RegExp(`(?:getElementById\\(\\s*|\\.id\\s*===?\\s*)(['"\`])${seletor.slice(1)}\\1`)
  : null);

function arquivos(pasta) {
  return readdirSync(pasta).flatMap(nome => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return nome.endsWith('.js') ? [caminho] : [];
  });
}

const doE2E = arquivos(E2E).map(caminho => ({ nome: relative(E2E, caminho).split(sep).join('/'), texto: readFileSync(caminho, 'utf8') }));

describe('Os donos dos seletores (os testes E2E passam pelos drivers)', () => {
  it('os nove drivers existem e test/e2e/fixtures.js reexporta todos', () => {
    const fixtures = doE2E.find(a => a.nome === 'fixtures.js').texto;
    for (const tela of ['casca', 'invariantes', 'recursos', 'instrutores', 'alunos', 'demanda', 'pedidos', 'escala', 'cursos']) {
      assert.ok(doE2E.some(a => a.nome === `telas/${tela}.js`), `test/e2e/telas/${tela}.js`);
      assert.match(fixtures, new RegExp(`export \\* from '\\./telas/${tela}\\.js';`), `fixtures.js reexporta telas/${tela}.js`);
    }
  });

  it('o seletor montado e o id lido pelo DOM também são achados', () => {
    const ag = DONOS.find(d => d.seletor === '#ag-*').achar;
    assert.ok(ag.test('page.locator(`#ag-${campo}`)'));
    assert.ok(ag.test("page.locator('#ag-aluno')"));
    const dt = lidoPeloDom('#dt');
    assert.ok(dt.test("document.activeElement.id === 'dt'"));
    assert.ok(dt.test('document.getElementById("dt")'));
    assert.ok(!dt.test("document.activeElement.id === 'dt-rotulo'"));
    assert.equal(lidoPeloDom('#ag-*'), null);
  });

  for (const { seletor, achar, drivers, testes = [] } of DONOS) {
    const peloDom = lidoPeloDom(seletor);
    const acha = linha => achar.test(linha) || !!peloDom?.test(linha);
    it(`${seletor}: só em ${drivers.map(d => `telas/${d}`).join(', ')}${testes.length ? ` e em ${testes.join(', ')}` : ''}`, () => {
      assert.ok(drivers.some(d => achar.test(doE2E.find(a => a.nome === `telas/${d}`)?.texto || '')), `${seletor} em telas/${drivers[0]}`);
      const permitidos = new Set([...drivers.map(d => `telas/${d}`), ...testes]);
      const fora = doE2E.filter(a => !permitidos.has(a.nome)).flatMap(a => a.texto.split('\n')
        .map((linha, i) => (acha(linha) ? `${a.nome}:${i + 1}` : null)).filter(Boolean));
      assert.deepEqual(fora, []);
    });
  }
});
