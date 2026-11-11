import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGroundMission, doesGroundGateFlight, migrateLegacyMissionName, normalizeMissionFields, blank, janelasDaDisponibilidade, rotuloDaDisponibilidade
} from '../../js/rules.js';
import { podeFazer, descreverExigencias } from '../../js/habilitacoes.js';

describe('Regras de missão', () => {
  it('identifica as missões de Ground School', () => {
    assert.deepEqual(
      ['Ground C152', 'Ground C172', 'Ground PA-34', 'Ground Navegação', 'Voo Local', 'Simulador', 'Inexistente'].map(isGroundMission),
      [true, true, true, true, false, false, false]
    );
  });


  it('Ground de aeronave libera voos naquele equipamento; Ground Navegação libera Navegação', () => {
    assert.equal(doesGroundGateFlight('Ground C152', { mis: 'Voo Local', eq: 'C152' }), true);
    assert.equal(doesGroundGateFlight('Ground C152', { mis: 'Voo Local', eq: 'C172' }), false);
    assert.equal(doesGroundGateFlight('Ground PA-34', { mis: 'Multimotor', eq: 'PA-34' }), true);
    assert.equal(doesGroundGateFlight('Ground Navegação', { mis: 'Navegação', eq: 'C172' }), true);
    assert.equal(doesGroundGateFlight('Ground Navegação', { mis: 'Voo Local', eq: 'C152' }), false);
    assert.equal(doesGroundGateFlight('Ground C152', { mis: 'Ground C172', eq: 'Sala Ground' }), false);
    assert.equal(doesGroundGateFlight('Voo Local', { mis: 'Voo Local', eq: 'C152' }), false);
  });

  it('migra nomes de missão das versões anteriores', () => {
    assert.deepEqual(
      ['PP Local', 'PP Navegação (>27nm)', 'PC Visual', 'Multi', 'INVA', 'TGL', 'Ground de Navegação', 'IFR', '???'].map(migrateLegacyMissionName),
      ['Voo Local', 'Navegação', 'Voo Local', 'Multimotor', 'Voo Local', 'Voo Local', 'Ground Navegação', 'IFR', 'Voo Local']
    );
  });

  it('normaliza pedidos de Ground: sala, 01h30, sessão única e sem janela noturna', () => {
    const pedido = { mis: 'Ground C172', eq: 'C172', p1: 8, p2: 8, nb: 3, ss: 2 };
    normalizeMissionFields(pedido);
    assert.deepEqual(pedido, { mis: 'Ground C172', eq: 'Sala Ground', p1: 0, p2: 1, nb: 1.5, ss: 1 });
  });

  it('uma sessão por missão: pedidos antigos com 2 ou 3 sessões passam a ter uma só (para dividir, "+ missão")', () => {
    const pedido = { mis: 'Navegação', eq: 'C152', p1: 1, p2: 2, nb: 3, ss: 2 };
    normalizeMissionFields(pedido);
    assert.deepEqual(pedido, { mis: 'Navegação', eq: 'C152', p1: 1, p2: 2, nb: 3, ss: 1 });
  });

  it('normaliza pedidos de voo: equipamento permitido e horas inteiras', () => {
    const pedido = { mis: 'Multi', eq: 'C152', p1: 1, p2: 2, nb: 1.5, ss: 1 };
    normalizeMissionFields(pedido);
    assert.deepEqual(pedido, { mis: 'Multimotor', eq: 'PA-34', p1: 1, p2: 2, nb: 1, ss: 1 });
  });

  it('nomes herdados do Object (constructor, __proto__, toString) não são missões nem equipamentos', () => {
    assert.equal(isGroundMission('constructor'), false);
    assert.equal(migrateLegacyMissionName('constructor'), 'Voo Local');
    assert.equal(migrateLegacyMissionName('__proto__'), 'Voo Local');
    assert.equal(descreverExigencias('toString', 'C152'), 'Voo Local');
    assert.equal(descreverExigencias('Simulador', 'constructor'), 'Simulador (Mono)');
    assert.equal(podeFazer({ hab: ['local'] }, 'Voo Local', 'constructor'), true);
    assert.equal(doesGroundGateFlight('constructor', { mis: 'Voo Local', eq: 'C152' }), false);
    const pedido = { mis: 'constructor', eq: 'valueOf', p1: 1, p2: 2, nb: 1, ss: 1 };
    normalizeMissionFields(pedido);
    assert.deepEqual([pedido.mis, pedido.eq], ['Voo Local', 'C152']);
  });

  it('disponibilidade do aluno: em que janelas o voo pode começar', () => {
    assert.equal(janelasDaDisponibilidade(''), null);
    assert.equal(janelasDaDisponibilidade(undefined), null);
    assert.deepEqual(janelasDaDisponibilidade('manha'), [0, 1, 2, 3]);
    assert.deepEqual(janelasDaDisponibilidade('tarde'), [4, 5, 6, 7]);
    assert.deepEqual(janelasDaDisponibilidade('noite'), [8]);
    assert.deepEqual(janelasDaDisponibilidade('h5'), [5]);
    assert.equal(janelasDaDisponibilidade('h9'), null);
    assert.equal(janelasDaDisponibilidade('constructor'), null);
    assert.deepEqual(['manha', 'tarde', 'noite', 'h5'].map(rotuloDaDisponibilidade), ['Manhã', 'Tarde', 'Noite', 'às 13:40']);
    const pedido = { mis: 'Voo Local', eq: 'C152', p1: 1, p2: 2, nb: 1, ss: 1, jan: 'xyz' };
    normalizeMissionFields(pedido);
    assert.equal(Object.hasOwn(pedido, 'jan'), false, 'disponibilidade inválida sai do pedido');
  });

  it('pedido em branco é um objeto novo a cada chamada', () => {
    const a = blank();
    assert.deepEqual(a, { fly: false, mis: 'Voo Local', eq: 'C152', p1: 1, p2: 2, nb: 1, ss: 1, pr: 3 });
    assert.notEqual(blank(), a);
  });
});
