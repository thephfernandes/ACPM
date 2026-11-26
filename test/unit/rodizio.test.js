// Rodízio: filas por categoria de voo (cheque, MLTE, noturno e C172) entre os instrutores habilitados.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIAS_DO_RODIZIO, categoriaDoRodizio, ajustarFilas, filasDoDiaSeguinte } from '../../js/rodizio.js';
import { habilitadoNoTipo, exigencias } from '../../js/habilitacoes.js';

const instrutor = (id, ...hab) => ({ id, nm: `Instrutor ${id}`, on: true, hab });

describe('Rodízio', () => {
  it('cada voo conta na primeira categoria que se aplica: cheque, MLTE (PA-34), noturno e C172', () => {
    assert.deepEqual(CATEGORIAS_DO_RODIZIO.map(c => c.id), ['cheque', 'mlte', 'noturno', 'c172']);
    assert.equal(categoriaDoRodizio('Cheque PC MLTE IFR', 'PA-34'), 'cheque');
    assert.equal(categoriaDoRodizio('Cheque PP', 'C172'), 'cheque');
    assert.equal(categoriaDoRodizio('Multimotor', 'PA-34'), 'mlte');
    assert.equal(categoriaDoRodizio('IFR', 'PA-34'), 'mlte');
    assert.equal(categoriaDoRodizio('Noturno', 'C172'), 'noturno');
    assert.equal(categoriaDoRodizio('IFR', 'C172'), 'c172');
    assert.equal(categoriaDoRodizio('Voo Local', 'C172'), 'c172');
    assert.equal(categoriaDoRodizio('Voo Local', 'C152'), null);
    assert.equal(categoriaDoRodizio('Simulador', 'Sim. Multi'), null);
    assert.equal(categoriaDoRodizio('Ground PA-34', 'Sala Ground'), null);
  });

  it('as filas têm só os habilitados: mantêm a ordem, tiram quem saiu e põem quem entrou no fim', () => {
    const ins = [
      instrutor(1, 'local', 'c172', 'noturno'),
      instrutor(2, 'local', 'c172'),
      instrutor(3, 'local', 'mlte', 'checa_pc', 'checa_mlte', 'checa_ifr'),
      instrutor(4, 'checa_pp', 'checa_mnte', 'checa_vfr'),
      instrutor(6, 'checa_pp', 'checa_mnte'),
      instrutor(5, 'local')
    ];
    assert.deepEqual(ajustarFilas(undefined, ins), { cheque: [3, 4], mlte: [3], noturno: [1], c172: [1, 2] }, 'sem fila: na ordem do cadastro');
    assert.deepEqual(ajustarFilas({ c172: [9, 2, 1], noturno: 'x' }, ins), { cheque: [3, 4], mlte: [3], noturno: [1], c172: [2, 1] });
    assert.deepEqual(ajustarFilas({ c172: [2] }, ins).c172, [2, 1], 'quem passou a ser habilitado entra no fim');
  });

  it('na data seguinte, quem voou na categoria vai para o fim da fila (voo cancelado não conta)', () => {
    const ins = [instrutor(1, 'c172', 'noturno'), instrutor(2, 'c172', 'noturno'), instrutor(3, 'c172'), instrutor(4, 'mlte')];
    const dia = {
      filas: { c172: [1, 2, 3], noturno: [2, 1], mlte: [4], cheque: [] },
      fStatus: { b: 'Cancelado' },
      resultado: {
        out: [
          { fKey: 'a', insId: 1, mis: 'Voo Local', eqType: 'C172' },
          { fKey: 'b', insId: 3, mis: 'Voo Local', eqType: 'C172' },
          { fKey: 'c', insId: 2, mis: 'Noturno', eqType: 'C172' },
          { fKey: 'd', insId: 4, mis: 'Voo Local', eqType: 'C152' }
        ]
      }
    };
    assert.deepEqual(filasDoDiaSeguinte(dia, ins), { cheque: [], mlte: [4], noturno: [1, 2], c172: [2, 3, 1] });
    assert.deepEqual(filasDoDiaSeguinte({ ...dia, filas: undefined }, ins).c172, [2, 3, 1], 'dia sem filas: começa pelo cadastro');
    assert.deepEqual(filasDoDiaSeguinte({ filas: dia.filas }, ins), ajustarFilas(dia.filas, ins), 'sem escala: as filas seguem iguais');
  });

  // A fila do C172 lê o que o tipo C172 exige no registro (js/habilitacoes.js), não um id escrito aqui
  it('a fila do C172 é de quem tem o que o tipo C172 exige no registro', () => {
    const c172 = CATEGORIAS_DO_RODIZIO.find(c => c.id === 'c172');
    const doTipo = exigencias('Multimotor', 'C172').slice(1).flat();
    assert.deepEqual(doTipo, ['c172']);
    for (const hab of [[], ['c172'], ['local'], ['local', 'c172', 'noturno'], ['mlte']]) {
      const x = instrutor(1, ...hab);
      assert.equal(c172.participa(x), doTipo.every(h => hab.includes(h)), hab.join(' '));
      assert.equal(habilitadoNoTipo(x, 'C172'), c172.participa(x));
    }
    assert.equal(c172.participa({ id: 1 }), false, 'sem a lista');
    assert.equal(habilitadoNoTipo(instrutor(1, 'local'), 'Sala Ground'), true, 'tipo que não exige nada');
  });
});
