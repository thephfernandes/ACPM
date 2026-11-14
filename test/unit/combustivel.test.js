// Combustível e peso (fase 10): o limite de peso de cada avião (aluno + instrutor) vale com os tanques cheios. Acima
// dele, o avião sai com menos combustível quando o que fica dá o voo, o táxi e a reserva (30 min de dia; 45 min à
// noite e em IFR). O motor prefere sempre o tanque cheio e mostra quanto reduzir.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COMBUSTIVEL, KG_POR_GALAO, TAXI_MIN } from '../../js/config.js';
import { pesoECombustivel, reservaDaMissao } from '../../js/combustivel.js';
import { runAllocationEngine } from '../../js/engine.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

describe('Combustível: os números', () => {
  it('tanques e autonomia: C152 26 gal e 4 h; C172 53 gal e 6 h; PA-34 93 gal e 4h30; 1 galão = 6 lb', () => {
    assert.deepEqual(COMBUSTIVEL, { C152: { galoes: 26, autonomiaMin: 240 }, C172: { galoes: 53, autonomiaMin: 360 }, 'PA-34': { galoes: 93, autonomiaMin: 270 } });
    assert.ok(Math.abs(KG_POR_GALAO - 2.7216) < 1e-4);
    assert.equal(TAXI_MIN, 10);
  });

  it('reserva: 30 min de dia; 45 min no noturno e nas missões IFR', () => {
    assert.deepEqual(['Voo Local', 'Navegação', 'Noturno', 'IFR', 'Cheque PC MNTE IFR', 'Multimotor'].map(reservaDaMissao), [30, 30, 45, 45, 45, 30]);
  });
});

describe('Combustível: peso acima do limite com o tanque cheio', () => {
  it('dentro do limite: tanque cheio, nada a reduzir', () => {
    assert.deepEqual(pesoECombustivel({ stuKg: 70, insKg: 80, tipo: 'C152', minutos: 60, mis: 'Voo Local' }), { cabe: true, kg: 150, limKg: 170, reduzirGal: 0 });
  });

  it('10 kg acima no C152: 4 galões a menos (22 no tanque) ainda dão 1 h de voo, o táxi e a reserva', () => {
    // 10 kg = 3,67 galões (para cima: 4). Consumo 6,5 gal/h; 1 h + 10 min + 30 min = 100 min = 10,8 galões (para cima: 11)
    assert.deepEqual(pesoECombustivel({ stuKg: 100, insKg: 80, tipo: 'C152', minutos: 60, mis: 'Voo Local' }),
      { cabe: true, kg: 180, limKg: 170, reduzirGal: 4, abastecerGal: 22, minimoGal: 11, autonomiaMin: 203 });
  });

  it('50 kg acima no C152: o combustível que sobraria não dá o voo e a reserva', () => {
    const r = pesoECombustivel({ stuKg: 120, insKg: 100, tipo: 'C152', minutos: 60, mis: 'Voo Local' });
    assert.deepEqual([r.cabe, r.reduzirGal, r.abastecerGal, r.minimoGal], [false, 19, 7, 11]);
  });

  it('a reserva maior do noturno e um voo mais longo pedem mais combustível', () => {
    const noturno = pesoECombustivel({ stuKg: 140, insKg: 100, tipo: 'C172', minutos: 120, mis: 'Noturno' });
    // 18 kg = 6,6 galões (7); 120 + 10 + 45 = 175 min a 8,83 gal/h = 25,8 galões (26)
    assert.deepEqual([noturno.cabe, noturno.reduzirGal, noturno.abastecerGal, noturno.minimoGal], [true, 7, 46, 26]);
  });

  it('sem um dos pesos, ou num tipo sem limite (simulador), não há o que conferir', () => {
    assert.deepEqual(pesoECombustivel({ stuKg: 0, insKg: 80, tipo: 'C152', minutos: 60, mis: 'Voo Local' }), { cabe: true, kg: 0, limKg: 170, reduzirGal: 0 });
    assert.deepEqual(pesoECombustivel({ stuKg: 120, insKg: 120, tipo: 'Sim. Mono', minutos: 60, mis: 'Simulador' }), { cabe: true, kg: 240, limKg: 0, reduzirGal: 0 });
  });
});

describe('Combustível: o motor', () => {
  const pesado = (id, extra = {}) => aluno(id, { p1: 500, p2: -1 }, { kg: 100, ...extra });

  it('com um instrutor que cabe no limite, o tanque cheio ganha (mesmo em outro horário)', () => {
    const { out } = runAllocationEngine(cenario({ ins: [instrutor(1, 9, { kg: 80 }), instrutor(2, 9, { kg: 60, aw: Array(9).fill(true).map((v, k) => k !== 1) })], stu: [pesado(1000)] }));
    assert.equal(out.length, 1);
    assert.equal(out[0].insId, 2, 'o instrutor de 60 kg cabe com o tanque cheio, num horário fora da 1ª preferência');
    assert.equal(out[0].comb, undefined);
  });

  it('sem par que caiba com o tanque cheio, o voo sai com menos combustível e diz quanto', () => {
    const { out, al } = runAllocationEngine(cenario({ ins: [instrutor(1, 9, { kg: 80 })], stu: [pesado(1000)] }));
    assert.deepEqual(al.filter(a => a.t === 'err'), []);
    assert.deepEqual(out[0].comb, { reduzirGal: 4, abastecerGal: 22, minimoGal: 11, autonomiaMin: 203 });
    assert.equal(out[0].kg, 180);
  });

  it('se nem o mínimo de combustível resolve, o voo não entra e a mensagem diz por quê', () => {
    const { out, al } = runAllocationEngine(cenario({ ins: [instrutor(1, 9, { kg: 100 })], stu: [pesado(1000, { kg: 120 })] }));
    assert.equal(out.length, 0);
    assert.match(al[0].m, /peso aluno \+ instrutor acima do limite de 170 kg do C152, mesmo com o mínimo de combustível/);
  });

  it('a divisão das horas não passa um voo para quem precisaria de menos combustível', () => {
    // Dois voos com o instrutor 1 (60 kg, tanque cheio); o instrutor 2 (90 kg) faria o aluno de 100 kg passar do limite
    const { out } = runAllocationEngine(cenario({ ins: [instrutor(1, 1, { kg: 60 }), instrutor(2, 9, { kg: 90 })], stu: [pesado(1000, { p1: 390 }), pesado(1001)] }));
    assert.ok(out.every(o => !o.comb), 'nenhum voo com combustível reduzido');
  });
});
