import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGroundMission, doesGroundGateFlight, migrateLegacyMissionName, normalizeMissionFields, blank, disponibilidadeDoAluno, disponibilidadeAtual,
  rotuloDaDisponibilidade, opcoesDeDisponibilidade, proximoMid
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

  it('normaliza pedidos de Ground: sala, 01h30, sessão única e sem horário noturno', () => {
    const pedido = { mis: 'Ground C172', eq: 'C172', p1: 8, p2: 1050, nb: 3, ss: 2 };
    normalizeMissionFields(pedido);
    assert.deepEqual(pedido, { mis: 'Ground C172', eq: 'Sala Ground', p1: 390, p2: 500, nb: 1.5, ss: 1 });
  });

  it('uma sessão por missão: pedidos antigos com 2 ou 3 sessões passam a ter uma só (para dividir, "+ missão")', () => {
    const pedido = { mis: 'Navegação', eq: 'C152', p1: 500, p2: 610, nb: 3, ss: 2 };
    normalizeMissionFields(pedido);
    assert.deepEqual(pedido, { mis: 'Navegação', eq: 'C152', p1: 500, p2: 610, nb: 3, ss: 1 });
  });

  it('normaliza pedidos de voo: equipamento permitido, horas inteiras e preferências em minutos', () => {
    const pedido = { mis: 'Multi', eq: 'C152', p1: 1, p2: 2, nb: 1.5, ss: 1 };
    normalizeMissionFields(pedido);
    assert.deepEqual(pedido, { mis: 'Multimotor', eq: 'PA-34', p1: 500, p2: 610, nb: 1, ss: 1 });
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

  it('disponibilidade do aluno: em que horários o voo pode começar (por período ou num horário exato)', () => {
    assert.equal(disponibilidadeDoAluno(''), null);
    assert.equal(disponibilidadeDoAluno(undefined), null);
    assert.equal(disponibilidadeDoAluno('h9'), null);
    assert.equal(disponibilidadeDoAluno('constructor'), null);
    const comeca = (jan, ...horarios) => horarios.map(disponibilidadeDoAluno(jan));
    assert.deepEqual(comeca('manha', 390, 420, 690, 760), [true, true, true, false]);
    assert.deepEqual(comeca('tarde', 750, 760, 980, 1050), [false, true, true, false]);
    assert.deepEqual(comeca('noite', 980, 1050), [false, true]);
    assert.deepEqual(comeca('h450', 420, 450), [false, true]);
    assert.deepEqual(comeca('h5', 820, 830), [true, false], 'o "h5" dos dados antigos é a janela das 13:40');
    assert.deepEqual(['manha', 'tarde', 'noite', 'h5', 'h450'].map(rotuloDaDisponibilidade), ['Manhã', 'Tarde', 'Noite', 'às 13:40', 'às 07:30']);
    assert.deepEqual(['h5', 'h450', 'tarde', 'xyz'].map(disponibilidadeAtual), ['h820', 'h450', 'tarde', undefined]);
    assert.deepEqual(opcoesDeDisponibilidade([450]), [['', 'Qualquer horário'], ['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite'], ['h450', 'Só às 07:30']]);
    const pedido = { mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, jan: 'xyz' };
    normalizeMissionFields(pedido);
    assert.equal(Object.hasOwn(pedido, 'jan'), false, 'disponibilidade inválida sai do pedido');
  });

  it('pedido em branco é um objeto novo a cada chamada', () => {
    const a = blank();
    assert.deepEqual(a, { fly: false, mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, pr: 3 });
    assert.notEqual(blank(), a);
  });
});

// Revisão de 14/11: a missão extra é numerada no aluno, e não pelo número do cadastro (que fica no documento de todas
// as datas: cada missão extra regravava o cadastro, e duas pessoas em datas diferentes recebiam conflito)
describe('Número da missão extra', () => {
  it('o próximo depois das missões do aluno e do que o dia ainda guarda (voo fixo, status ou detalhe de uma missão retirada)', () => {
    const estado = { nid: 5000, stu: [{ id: 1000, extra: [] }, { id: 1001, extra: [{ mid: 1003 }, { mid: 7 }] }], fixos: {}, fStatus: {}, fObs: {} };
    assert.equal(proximoMid(estado, estado.stu[0]), 1);
    assert.equal(proximoMid(estado, estado.stu[1]), 1004);
    estado.fixos = { '1000_4_1': { a: 390 } };
    estado.fStatus = { '1000_9_1': 'Cancelado', '1001_2000_1': 'Atrasado' };
    estado.fObs = { '1000_12_1': { motivo: 'Outro' } };
    assert.equal(proximoMid(estado, estado.stu[0]), 13, 'não reaproveita o número de uma missão retirada que o dia ainda guarda');
    assert.equal(proximoMid(estado, estado.stu[1]), 2001);
    assert.equal(estado.nid, 5000, 'o número do cadastro não muda');
  });
});
