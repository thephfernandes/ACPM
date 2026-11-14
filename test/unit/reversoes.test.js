// O que "Reverter" desfaz no histórico (revisão de 14/11): a reversão vem gravada no histórico, então só vale no
// formato que o próprio app produz; o resto não vira botão nem é aplicado.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validarReversao } from '../../js/reversoes.js';
import { FROTA_INICIAL } from '../../js/frota.js';

const ATAQUE = 'x"><img/src/onerror=window.__xss=1>';

describe('Reversões do histórico', () => {
  it('as que o app grava passam, com o rótulo', () => {
    assert.deepEqual(validarReversao({ kind: 'setFly', stuId: 1000, mid: 0, val: false, label: '↶ Reverter' }, FROTA_INICIAL),
      { kind: 'setFly', stuId: 1000, mid: 0, val: false, label: '↶ Reverter' });
    assert.deepEqual(validarReversao({ kind: 'setAv', reg: 'PR-VOB', val: true, label: '↶ Reverter' }, FROTA_INICIAL),
      { kind: 'setAv', reg: 'PR-VOB', val: true, label: '↶ Reverter' });
    assert.deepEqual(validarReversao({ kind: 'setInsOn', insId: 3, val: true, label: '↶ Reverter' }, FROTA_INICIAL),
      { kind: 'setInsOn', insId: 3, val: true, label: '↶ Reverter' });
    assert.deepEqual(validarReversao({ kind: 'restaurarFixos', fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } }, label: '↶ Reverter' }, FROTA_INICIAL),
      { kind: 'restaurarFixos', fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } }, label: '↶ Reverter' });
    assert.deepEqual(validarReversao({ kind: 'readicionarRecurso', recurso: { reg: 'pr-new', tipo: 'C152' }, av: false, label: '↶ Reverter' }, FROTA_INICIAL),
      { kind: 'readicionarRecurso', recurso: { reg: 'PR-NEW', tipo: 'C152' }, av: false, label: '↶ Reverter' });
  });

  it('fora do formato, ou um recurso que já voltou à frota, não vale', () => {
    const ruins = [
      null, 'x', { kind: ATAQUE }, { kind: 'setFly', stuId: ATAQUE, val: true }, { kind: 'setFly', stuId: 1000, mid: 0, val: 'sim' },
      { kind: 'setAv', reg: ATAQUE, val: true }, { kind: 'setAv', reg: '__proto__', val: true }, { kind: 'setInsOn', insId: 1.5, val: true },
      { kind: 'restaurarFixos', fixos: { [ATAQUE]: { a: 1 } } }, { kind: 'readicionarRecurso', recurso: { reg: ATAQUE, tipo: 'C152' } },
      { kind: 'readicionarRecurso', recurso: { reg: 'PR-VOB', tipo: 'C152' } }
    ];
    for (const rev of ruins) assert.equal(validarReversao(rev, FROTA_INICIAL), null, JSON.stringify(rev));
  });

  it('o rótulo é um texto curto; fora disso, "↶ Reverter"', () => {
    assert.equal(validarReversao({ kind: 'setInsOn', insId: 3, val: true, label: 'x'.repeat(200) }, FROTA_INICIAL).label, '↶ Reverter');
    assert.equal(validarReversao({ kind: 'setInsOn', insId: 3, val: true }, FROTA_INICIAL).label, '↶ Reverter');
  });
});
