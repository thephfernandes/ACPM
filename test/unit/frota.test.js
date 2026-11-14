// A frota no cadastro (fase 7): matrícula, tipo e, no C152 acrobático, "Só Parafuso". Antes ela ficava no código
// (EQ em config.js); o formato 11 dos dados a leva para o cadastro, e o motor e as telas passam a lê-la de lá.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FROTA_INICIAL, TIPOS_DA_FROTA, normalizarFrota, matriculasDoTipo, novoRecurso } from '../../js/frota.js';
import { ESQUEMA, migrarCadastro } from '../../js/migracoes.js';
import { separar, juntar } from '../../js/dias.js';
import { ApiClient } from '../../js/storage.js';
import { runAllocationEngine } from '../../js/engine.js';
import { simularNavegador } from '../helpers/navegador.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

beforeEach(() => {
  simularNavegador();
  ApiClient.readOnly = false;
});

describe('Frota: o que ela guarda', () => {
  it('começa com os 26 recursos que estavam no código; o PR-JPL só voa Parafuso', () => {
    assert.equal(FROTA_INICIAL.length, 26);
    assert.deepEqual(FROTA_INICIAL.find(f => f.reg === 'PR-JPL'), { reg: 'PR-JPL', tipo: 'C152', soParafuso: true });
    assert.deepEqual(FROTA_INICIAL.find(f => f.reg === 'PR-VOM'), { reg: 'PR-VOM', tipo: 'PA-34' });
    assert.deepEqual(TIPOS_DA_FROTA, ['C152', 'C172', 'PA-34', 'Sim. Mono', 'Sim. Multi']);
  });

  it('normaliza: só recursos válidos, matrícula em maiúsculas e sem repetir; sem lista, a frota inicial', () => {
    assert.deepEqual(normalizarFrota(undefined), FROTA_INICIAL);
    assert.deepEqual(normalizarFrota([
      { reg: ' pr-new ', tipo: 'C152' }, { reg: 'PR-NEW', tipo: 'C172' }, { reg: 'PR-X', tipo: 'Boeing' }, { reg: '', tipo: 'C152' },
      null, { reg: 'SIM-X', tipo: 'Sim. Mono', soParafuso: true }
    ]), [{ reg: 'PR-NEW', tipo: 'C152' }, { reg: 'SIM-X', tipo: 'Sim. Mono' }]);
  });

  it('as matrículas de um tipo: as que só voam Parafuso ficam só para o Parafuso', () => {
    const frota = [{ reg: 'PR-A', tipo: 'C152' }, { reg: 'PR-B', tipo: 'C152', soParafuso: true }, { reg: 'PR-C', tipo: 'C172' }];
    assert.deepEqual(matriculasDoTipo(frota, 'C152'), ['PR-A']);
    assert.deepEqual(matriculasDoTipo(frota, 'C152', { parafuso: true }), ['PR-B']);
    assert.deepEqual(matriculasDoTipo(frota, 'C172', { parafuso: true }), ['PR-C']);
  });

  it('um recurso novo: matrícula única (em maiúsculas), categoria conhecida e "Só Parafuso" só no C152', () => {
    const frota = [{ reg: 'PR-A', tipo: 'C152' }];
    assert.deepEqual(novoRecurso(frota, { reg: ' pr-z ', tipo: 'C172' }), { recurso: { reg: 'PR-Z', tipo: 'C172' } });
    assert.deepEqual(novoRecurso(frota, { reg: 'PR-Q', tipo: 'C152', soParafuso: true }), { recurso: { reg: 'PR-Q', tipo: 'C152', soParafuso: true } });
    assert.deepEqual(novoRecurso(frota, { reg: 'PR-Q', tipo: 'C172', soParafuso: true }), { recurso: { reg: 'PR-Q', tipo: 'C172' } });
    assert.deepEqual(novoRecurso(frota, { reg: 'pr-a', tipo: 'C152' }), { erro: 'Já existe um recurso com a matrícula PR-A.' });
    assert.deepEqual(novoRecurso(frota, { reg: '', tipo: 'C152' }), { erro: 'Informe a matrícula.' });
    assert.deepEqual(novoRecurso(frota, { reg: 'PR ABC!', tipo: 'C152' }), { erro: 'Matrícula inválida: use letras, números e hífen (por exemplo, PR-ABC).' });
    assert.deepEqual(novoRecurso(frota, { reg: 'PR-Q', tipo: 'Boeing' }), { erro: 'Escolha a categoria.' });
  });
});

describe('Frota: formato 11 dos dados', () => {
  it('o cadastro antigo ganha a frota inicial; uma frota já gravada fica como está', () => {
    assert.ok(ESQUEMA >= 11);
    const antigo = { esquema: 10, nid: 1000, ins: [], stu: [] };
    assert.deepEqual(migrarCadastro(antigo).frota, FROTA_INICIAL);
    const propria = [{ reg: 'PR-NEW', tipo: 'C152' }];
    assert.deepEqual(migrarCadastro({ ...antigo, frota: propria }).frota, propria);
  });

  it('a frota fica no cadastro; um recurso novo começa disponível nos dias que ainda não o conhecem', () => {
    const estado = juntar({ nid: 1000, ins: [], stu: [], frota: [{ reg: 'PR-NEW', tipo: 'C152' }, { reg: 'PP-LJV', tipo: 'C152' }] },
      { win: Array(9).fill(true), av: { 'PP-LJV': false }, ins: {}, pedidos: {} });
    assert.deepEqual(estado.frota, [{ reg: 'PR-NEW', tipo: 'C152' }, { reg: 'PP-LJV', tipo: 'C152' }]);
    assert.deepEqual(estado.av, { 'PR-NEW': true, 'PP-LJV': false });
    const { cadastro, dia } = separar(estado);
    assert.deepEqual(cadastro.frota, estado.frota);
    assert.equal(dia.frota, undefined);
  });

  it('estado inicial e normalização: a frota, e só os recursos dela na disponibilidade e nas horas', () => {
    const novo = ApiClient.createFreshState();
    assert.deepEqual(novo.frota, FROTA_INICIAL);
    assert.equal(Object.keys(novo.av).length, 26);
    const estado = ApiClient.normalizeAndMigrateState({
      ins: [], stu: [], frota: [{ reg: 'PR-NEW', tipo: 'C152' }],
      av: { 'PR-NEW': false, 'PR-OLD': true }, horas: { 'PR-NEW': 12, 'PR-OLD': 40 }
    });
    assert.deepEqual(estado.av, { 'PR-NEW': false });
    assert.deepEqual(estado.horas, { 'PR-NEW': 12 });
  });

});

describe('Frota: o motor usa a frota dos dados', () => {
  it('um C152 novo voa; um avião que saiu da frota não voa mais', () => {
    const estado = cenario({ stu: [aluno(1000)] });
    estado.frota = [{ reg: 'PR-NEW', tipo: 'C152' }];
    estado.av = { 'PR-NEW': true, 'PP-LJV': true };
    const { out, al } = runAllocationEngine(estado);
    assert.deepEqual(al, []);
    assert.deepEqual(out.map(o => o.r), ['PR-NEW']);
  });

  it('o Parafuso no C152 vai para o avião marcado "Só Parafuso", que não recebe outras missões', () => {
    const estado = cenario({ stu: [aluno(1000, { mis: 'Parafuso' }), aluno(1001)] });
    estado.frota = [{ reg: 'PR-A', tipo: 'C152' }, { reg: 'PR-ACR', tipo: 'C152', soParafuso: true }];
    estado.av = { 'PR-A': true, 'PR-ACR': true };
    const { out } = runAllocationEngine(estado);
    assert.equal(out.find(o => o.s === 'Aluno 1000').r, 'PR-ACR');
    assert.equal(out.find(o => o.s === 'Aluno 1001').r, 'PR-A');
  });

  it('sem avião "Só Parafuso" disponível, o Parafuso no C152 não entra e o motivo diz qual é o avião', () => {
    const estado = cenario({ stu: [aluno(1000, { mis: 'Parafuso' })] });
    estado.frota = [{ reg: 'PR-A', tipo: 'C152' }, { reg: 'PR-ACR', tipo: 'C152', soParafuso: true }];
    estado.av = { 'PR-A': true, 'PR-ACR': false };
    const { out, al } = runAllocationEngine(estado);
    assert.equal(out.length, 0);
    assert.match(al[0].m, /PR-ACR/);
  });
});
