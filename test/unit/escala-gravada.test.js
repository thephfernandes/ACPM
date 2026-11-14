// A escala gravada ao abrir (revisão de 14/11): cada linha precisa ter os campos que o motor produz, nos formatos
// dele. Uma linha adulterada invalida a escala gravada (a tela usa a escala calculada de novo); os campos desconhecidos
// saem. As escalas que o próprio motor produz passam inteiras.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizarEscalaGravada } from '../../js/escala-gravada.js';
import { runAllocationEngine } from '../../js/engine.js';
import { aluno, cenario, instrutor, apenas } from '../helpers/montar.js';

const goldens = JSON.parse(readFileSync(new URL('../fixtures/motor-goldens.json', import.meta.url), 'utf8'));
const saidas = [goldens.exemplo.saida, ...goldens.cenarios.map(c => c.saida)];
const ATAQUE = 'x"><img/src/onerror=window.__xss=1>';

describe('Escala gravada', () => {
  it('as escalas do motor passam inteiras (o dia de exemplo e as 40 geradas), com a data', () => {
    for (const saida of saidas) assert.deepEqual(normalizarEscalaGravada(saida), saida);
    assert.deepEqual(normalizarEscalaGravada({ ...saidas[0], data: '2026-11-11' }), { ...saidas[0], data: '2026-11-11' });
  });

  it('também os campos que só aparecem às vezes: combustível, voo fixo, conflito, missão do curso e a revisão de 50 horas', () => {
    // O aluno 1000 tem um voo fixo com um instrutor que saiu do cadastro (conflito); o 1001, de 100 kg com o instrutor de
    // 95 kg, só voa com menos combustível
    const estado = cenario({
      ins: [instrutor(1, 9, { kg: 95 })], stu: [aluno(1000, { p1: 390, p2: -1, etapa: 'PP-07' }), aluno(1001, { p1: 500, p2: -1 }, { kg: 100 })],
      horas: { 'PR-VOB': 49 }, semAeronaves: apenas('C152', 'PR-VOB', 'PR-VOC')
    });
    const escala = runAllocationEngine({ ...estado, fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 2 } } });
    const [fixo, outro] = [escala.out.find(o => o.stuId === 1000), escala.out.find(o => o.stuId === 1001)];
    assert.ok(fixo.fixo && fixo.conflito && fixo.etapa && outro.comb, JSON.stringify(escala.out));
    assert.ok(escala.al.some(a => a.t === 'conf' && a.fKey) && Object.keys(escala.revisao).length);
    assert.deepEqual(normalizarEscalaGravada(escala), escala);
  });

  it('um campo adulterado em qualquer linha invalida a escala gravada', () => {
    const base = saidas[0];
    const adulterar = (campo, valor) => ({ ...base, out: [{ ...base.out[0], [campo]: valor }, ...base.out.slice(1)] });
    const ruins = [
      ['fKey', ATAQUE], ['classKey', ATAQUE], ['isGround', 'sim'], ['w', ATAQUE], ['w', 9], ['a', '390'], ['b', 2000], ['o', -1],
      ['stuId', ATAQUE], ['mid', 1.5], ['insId', '1'], ['eqType', ATAQUE], ['s', 7], ['ins', { nm: 1 }], ['mis', ATAQUE],
      ['h', ATAQUE], ['ss', ATAQUE], ['r', ATAQUE], ['stuKg', ATAQUE], ['insKg', -5], ['limKg', ATAQUE], ['kg', ATAQUE],
      ['comb', { reduzirGal: ATAQUE, abastecerGal: 7, minimoGal: 11, autonomiaMin: 60 }], ['baseTag', ATAQUE], ['tag', ATAQUE],
      ['status', ATAQUE], ['groupSize', ATAQUE], ['fixo', 'sim'], ['conflito', ATAQUE], ['conflito', [ATAQUE, 3]], ['conflitoCodigos', [ATAQUE]], ['conflitoCodigos', 'peso'], ['etapa', ATAQUE]
    ];
    for (const [campo, valor] of ruins) assert.equal(normalizarEscalaGravada(adulterar(campo, valor)), null, `${campo} = ${JSON.stringify(valor)}`);
    assert.equal(normalizarEscalaGravada({ ...base, out: [{ ...base.out[0], a: 450, b: 390 }] }), null, 'termina antes de começar');
  });

  it('alertas, total, revisão e data também no formato; os campos desconhecidos saem', () => {
    const base = saidas[0];
    assert.equal(normalizarEscalaGravada({ ...base, al: [{ t: ATAQUE, s: 'x', m: 'y' }] }), null);
    assert.equal(normalizarEscalaGravada({ ...base, al: [{ t: 'warn', s: 'x', m: 'y', fKey: ATAQUE }] }), null);
    // O código da rejeição (revisão de 14/11): só os da lista
    assert.deepEqual(normalizarEscalaGravada({ ...base, al: [{ t: 'err', s: 'x', m: 'y', codigo: 'bloqueio' }] }).al, [{ t: 'err', s: 'x', m: 'y', codigo: 'bloqueio' }]);
    assert.equal(normalizarEscalaGravada({ ...base, al: [{ t: 'err', s: 'x', m: 'y', codigo: ATAQUE }] }), null);
    assert.equal(normalizarEscalaGravada({ ...base, tot: ATAQUE }), null);
    assert.equal(normalizarEscalaGravada({ ...base, revisao: { [ATAQUE]: { inicio: 1, voadas: 1, fim: 2, paraAs: null } } }), null);
    assert.equal(normalizarEscalaGravada({ ...base, revisao: { 'PR-VOB': { inicio: ATAQUE, voadas: 1, fim: 2, paraAs: null } } }), null);
    assert.equal(normalizarEscalaGravada({ ...base, data: ATAQUE }), null);
    assert.equal(normalizarEscalaGravada({ ...base, rej: ATAQUE }), null);
    assert.deepEqual(normalizarEscalaGravada({ ...base, rej: 2 }), { ...base, rej: 2 }, 'o número de rejeições dos dias importados do BI fica');
    const comExtras = { ...base, extra: ATAQUE, out: [{ ...base.out[0], onclick: ATAQUE }, ...base.out.slice(1)] };
    assert.deepEqual(normalizarEscalaGravada(comExtras), base);
  });

  it('sem lista de voos, ou sem os campos de que a tela precisa, não há escala gravada', () => {
    assert.equal(normalizarEscalaGravada(null), null);
    assert.equal(normalizarEscalaGravada({ out: 'x', al: [], tot: 0 }), null);
    const { fKey, ...semChave } = saidas[0].out[0];
    assert.equal(normalizarEscalaGravada({ ...saidas[0], out: [semChave] }), null);
  });
});
