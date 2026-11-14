// Migrações do formato dos dados guardados: cada versão transforma a anterior sem perder nada.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITES_DA_LEI } from '../../js/limites.js';
import { ESQUEMA, migrarCadastro, migrarDia, precisaMigrar, renomearSimulador } from '../../js/migracoes.js';
import { FROTA_INICIAL } from '../../js/frota.js';
import { HORARIOS_INICIAIS } from '../../js/horarios.js';
import { EQ } from '../../js/config.js';
import { habilitacoesDoNivel } from '../../js/habilitacoes.js';

describe('Migrações do formato dos dados', () => {
  it('dia da fase 3: renomeia os simuladores na disponibilidade e na escala, sem perder nada', () => {
    const antigo = {
      win: [true, false],
      av: { 'SIM-MONO-1': false, 'SIM-MONO-2': true, 'SIM-MULTI-1': true, 'SIM-MULTI-2': false, 'PR-BTB': false },
      ins: { 1: { on: true, aw: [true, false] } },
      pedidos: { 1000: { fly: true, mis: 'Simulador', eq: 'Sim. Mono', extra: [] } },
      fStatus: { '1000_0_1': 'Cancelado' },
      resultado: { out: [{ fKey: '1000_0_1', r: 'SIM-MONO-2', eqType: 'Sim. Mono' }, { fKey: '1001_0_1', r: 'PR-BTB' }], al: [], tot: 2, data: '2026-11-11' },
      campoDeOutraVersao: { x: 1 }
    };
    const novo = migrarDia(structuredClone(antigo));
    assert.equal(novo.esquema, ESQUEMA);
    assert.deepEqual(novo.av, { 'SIM-MONO-A': false, 'SIM-MONO-C': true, 'SIM-MLTE-E': true, 'SIM-MLTE-D': false, 'PR-BTB': false });
    assert.deepEqual(novo.resultado.out.map(o => o.r), ['SIM-MONO-C', 'PR-BTB']);
    assert.deepEqual(novo.resultado.out[0], { ...antigo.resultado.out[0], r: 'SIM-MONO-C' });
    for (const campo of ['win', 'ins', 'pedidos', 'fStatus', 'campoDeOutraVersao']) assert.deepEqual(novo[campo], antigo[campo], campo);
    assert.deepEqual({ ...novo.resultado, out: null }, { ...antigo.resultado, out: null });
  });

  it('dias importados do BI e simulados também são migrados; dia vazio ou ausente não quebra', () => {
    assert.equal(migrarDia({ importado: true, resultado: { out: [{ r: 'SIM-MULTI-1' }] } }).resultado.out[0].r, 'SIM-MLTE-E');
    assert.deepEqual(migrarDia({ simulado: true, resultado: null }), { simulado: true, resultado: null, esquema: ESQUEMA });
    assert.equal(migrarDia(null), null);
    assert.deepEqual(migrarDia({}), { esquema: ESQUEMA });
  });

  it('é idempotente: um dia já no formato atual não muda', () => {
    const atual = migrarDia({ av: { 'SIM-MONO-1': true }, resultado: { out: [{ r: 'SIM-MONO-1' }] } });
    assert.deepEqual(migrarDia(structuredClone(atual)), atual);
    assert.equal(precisaMigrar(atual), false);
    assert.equal(precisaMigrar({ av: {} }), true);
    assert.equal(precisaMigrar({ esquema: '5' }), true, 'versão que não é número conta como a mais antiga');
  });

  it('cadastro: ganha a versão do formato e mantém tudo o que tinha', () => {
    const cadastro = { nid: 1003, ins: [{ id: 1, nm: 'Instrutor 01', lv: 3, kg: 70 }], stu: [{ id: 1000, nm: 'Aluno 1000', kg: 60, bl: [1] }] };
    const novo = migrarCadastro(structuredClone(cadastro));
    assert.equal(novo.esquema, ESQUEMA);
    // Desde as versões 11, 12 e 15, o cadastro também guarda a frota, os horários de decolagem e os limites da lei
    assert.deepEqual({ ...novo, ins: null }, { ...cadastro, ins: null, frota: FROTA_INICIAL, horarios: HORARIOS_INICIAIS, limites: LIMITES_DA_LEI, esquema: ESQUEMA });
    assert.equal(migrarCadastro(null), null);
  });

  it('versão 6: cada instrutor recebe as habilitações do seu nível; o nível fica guardado como cópia', () => {
    const cadastro = {
      nid: 1004,
      ins: [{ id: 1, nm: 'A', lv: 1, kg: 70 }, { id: 2, nm: 'B', lv: 9, kg: 80, extra: 'x' }, { id: 3, nm: 'C', kg: 60 }],
      stu: []
    };
    const novo = migrarCadastro(cadastro);
    assert.deepEqual(novo.ins[0], { id: 1, nm: 'A', lv: 1, kg: 70, hab: habilitacoesDoNivel(1) });
    assert.deepEqual(novo.ins[1], { id: 2, nm: 'B', lv: 9, kg: 80, extra: 'x', hab: habilitacoesDoNivel(9) });
    assert.deepEqual(novo.ins[2].hab, habilitacoesDoNivel(1), 'sem nível: o padrão de antes (A01)');
    assert.deepEqual(migrarCadastro({ ...cadastro, esquema: 5 }).ins[0].hab, habilitacoesDoNivel(1), 'cadastro da versão 5 também migra');
    const editado = { ...novo, ins: [{ ...novo.ins[0], hab: ['c172'] }] };
    assert.deepEqual(migrarCadastro(editado), editado, 'quem já está no formato atual não muda');
  });

  it('versão 7: os dias passam a guardar as horas até a revisão de 50 horas (versões anteriores do app não conhecem o campo)', () => {
    const dia = { av: { 'PR-BTB': true }, horas: { 'PR-BTB': 12 }, esquema: 6 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 7);
  });

  it('versão 8: os dias passam a guardar as filas do rodízio (versões anteriores do app não conhecem o campo)', () => {
    const dia = { av: {}, filas: { c172: [1, 2] }, esquema: 7 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 8);
  });

  it('versão 9: os pedidos passam a guardar a disponibilidade do aluno (versões anteriores do app não conhecem o campo)', () => {
    const dia = { pedidos: { 1000: { fly: true, jan: 'tarde' } }, esquema: 8 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 9);
  });

  it('versão 10: os dias passam a guardar as solicitações da agenda já importadas', () => {
    const dia = { importadas: [7], esquema: 9 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 10);
  });

  it('versão 13: os dias passam a guardar os detalhes do status (motivo do cancelamento e novo horário do atraso)', () => {
    const dia = { fStatus: { '1000_0_1': 'Cancelado' }, esquema: 12 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.deepEqual(migrarCadastro({ nid: 1000, ins: [], stu: [], esquema: 12 }).ins, []);
    assert.ok(ESQUEMA >= 13);
  });

  it('versão 14: os dias guardam a ordem dos aviões no hangar', () => {
    const dia = { hangar: ['PR-VOB'], esquema: 13 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 14);
  });

  it('versão 15: o cadastro ganha os limites da Lei do Aeronauta, antes de "esquema"', async () => {
    const { LIMITES_DA_LEI } = await import('../../js/limites.js');
    const novo = migrarCadastro({ nid: 1000, ins: [], stu: [], frota: [], horarios: {}, esquema: 14 });
    assert.deepEqual(novo.limites, LIMITES_DA_LEI);
    assert.deepEqual(Object.keys(novo), ['nid', 'ins', 'stu', 'frota', 'horarios', 'limites', 'esquema']);
    const proprios = { ...LIMITES_DA_LEI, vooMesH: 90 };
    assert.deepEqual(migrarCadastro({ nid: 1000, ins: [], stu: [], limites: proprios, esquema: 14 }).limites, proprios);
    assert.ok(ESQUEMA >= 15);
  });

  it('versão 16: os dias guardam a escala aprovada (os voos fixos e quem aprovou)', () => {
    const dia = { fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } }, aprovacao: null, esquema: 15 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 16);
  });

  it('versão 17: os dias guardam os critérios da compactação', () => {
    const dia = { criterios: { buracos: 'aviao', horarios: 'fixos' }, esquema: 16 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 17);
  });

  it('os nomes novos são os da frota cadastrada, na mesma ordem', () => {
    assert.deepEqual(EQ['Sim. Mono'], ['SIM-MONO-A', 'SIM-MONO-C']);
    assert.deepEqual(EQ['Sim. Multi'], ['SIM-MLTE-E', 'SIM-MLTE-D']);
    assert.deepEqual(['SIM-MONO-1', 'SIM-MONO-2', 'SIM-MULTI-1', 'SIM-MULTI-2'].map(renomearSimulador), [...EQ['Sim. Mono'], ...EQ['Sim. Multi']]);
    assert.equal(renomearSimulador('PR-BTB'), 'PR-BTB');
  });
});
