// Métricas de uma escala (fase 10): tempo parado dos aviões e dos instrutores, saídas do hangar, aviões usados contra o
// mínimo possível, equilíbrio das horas, preferências atendidas e trocas de avião. Medem o efeito das regras novas do
// motor (scripts/medir-escalas.mjs) e, depois, aparecem na Escala.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { metricasDaEscala, INTERVALO_DO_HANGAR } from '../../js/metricas.js';

const voo = (fKey, r, a, insId, extra = {}) => ({
  fKey, classKey: fKey, r, eqType: 'C152', a, b: a + 60, h: 1, insId, isGround: false, baseTag: 'Pref. 1', mis: 'Voo Local', ...extra
});

describe('Métricas da escala', () => {
  it('avião: o tempo parado entre o primeiro e o último voo; uma saída do hangar a cada parada de 2 h ou mais', () => {
    assert.equal(INTERVALO_DO_HANGAR, 120);
    const m = metricasDaEscala([voo('1_0_1', 'PR-VOB', 390, 1), voo('2_0_1', 'PR-VOB', 500, 2), voo('3_0_1', 'PR-VOB', 760, 3)]);
    // 07:30→08:20 (50 min) e 09:20→12:40 (200 min)
    assert.equal(m.avioesParadoMin, 250);
    assert.equal(m.saidasDoHangar, 2);
    assert.equal(m.avioesUsados, 1);
  });

  it('aviões usados contra o mínimo possível (o pico de voos ao mesmo tempo, por tipo)', () => {
    const out = [voo('1_0_1', 'PR-VOB', 390, 1), voo('2_0_1', 'PR-VOC', 390, 2), voo('3_0_1', 'PR-VOI', 500, 3),
      voo('4_0_1', 'PP-ABP', 390, 4, { eqType: 'C172' })];
    const m = metricasDaEscala(out);
    assert.deepEqual([m.avioesUsados, m.avioesMinimo], [4, 3], 'C152: 3 usados, pico de 2; C172: 1');
  });

  it('simuladores e a sala de Ground não contam como aviões', () => {
    const m = metricasDaEscala([voo('1_0_1', 'SIM-MONO-A', 390, 1, { eqType: 'Sim. Mono' }), voo('2_0_1', 'SALA-GROUND', 390, 2, { eqType: 'Sala Ground', isGround: true })]);
    assert.deepEqual([m.avioesUsados, m.avioesParadoMin, m.saidasDoHangar], [0, 0, 0]);
  });

  it('instrutor: o tempo parado entre o primeiro e o último compromisso (a turma de Ground conta uma vez)', () => {
    const turma = [1, 2, 3].map(id => voo(`${id}_0_1`, 'SALA-GROUND', 390, 7, { classKey: 'GND_x', isGround: true, eqType: 'Sala Ground', b: 480, h: 1.5 }));
    const m = metricasDaEscala([...turma, voo('4_0_1', 'PR-VOB', 610, 7), voo('5_0_1', 'PR-VOB', 980, 7)], { ativos: [7, 8] });
    // 08:00→10:10 (130 min) e 11:10→16:20 (310 min)
    assert.equal(m.instrutoresParadoMin, 440);
    assert.equal(m.instrutoresComDuasHorasParado, 1);
    assert.deepEqual(m.horasPorInstrutor, { 7: 3.5, 8: 0 });
    assert.equal(m.diferencaDeHoras, 3.5);
    assert.equal(m.somaDosQuadrados, 12.25);
  });

  it('preferências atendidas (por aluno) e trocas de avião do mesmo tipo por instrutor', () => {
    const out = [
      voo('1_0_1', 'PR-VOB', 390, 1), voo('2_0_1', 'PR-VOC', 500, 1, { baseTag: 'Pref. 2' }),
      voo('3_0_1', 'PP-ABP', 610, 1, { eqType: 'C172', baseTag: 'Próximo livre' }), voo('4_0_1', 'PR-VOB', 610, 2)
    ];
    const m = metricasDaEscala(out);
    assert.deepEqual(m.preferencias, { p1: 2, p2: 1, outro: 1 });
    assert.equal(m.trocasDeAviao, 1, 'o instrutor 1 voa em dois C152 (o C172 é outro tipo)');
  });

  it('escala vazia: tudo zero', () => {
    const m = metricasDaEscala([]);
    assert.deepEqual([m.avioesUsados, m.avioesMinimo, m.avioesParadoMin, m.instrutoresParadoMin, m.diferencaDeHoras], [0, 0, 0, 0, 0]);
  });
});
