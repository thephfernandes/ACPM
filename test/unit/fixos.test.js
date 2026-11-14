// O dia de operação (fase 12): a escala aprovada fica fixa. O motor põe primeiro os voos fixos (no mesmo horário, avião
// e instrutor) e encaixa o resto em volta; um voo fixo que fica impossível continua onde está, marcado em conflito, e o
// voo fixo cancelado libera o avião e o instrutor.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine } from '../../js/engine.js';
import { aluno, cenario, instrutor, apenas, GROUND_C152 } from '../helpers/montar.js';

const pino = o => ({ a: o.a, b: o.b, r: o.r, insId: o.insId, ...(o.isGround ? { classKey: o.classKey } : {}) });
const fixarTudo = out => Object.fromEntries(out.map(o => [o.fKey, pino(o)]));
const doAluno = (out, id) => out.find(o => o.stuId === id);

describe('Voos fixos', () => {
  it('a escala fixada não muda quando a demanda muda: o pedido novo entra em volta', () => {
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] });
    const antes = runAllocationEngine(base);
    // Um aluno novo, de prioridade maior, que tiraria a vaga do primeiro: os fixos ficam onde estão
    const depois = runAllocationEngine({ ...base, stu: [...base.stu, aluno(1002, { p1: 390, p2: -1, pr: 5 })], fixos: fixarTudo(antes.out) });
    for (const o of antes.out) assert.deepEqual(pino(doAluno(depois.out, o.stuId)), pino(o));
    assert.ok(doAluno(depois.out, 1002), 'o pedido novo entra');
    assert.deepEqual(depois.out.filter(o => o.fixo).map(o => o.stuId).sort(), [1000, 1001]);
    assert.equal(doAluno(depois.out, 1002).fixo, undefined);
  });

  it('o voo fixo que fica impossível (o instrutor não vem mais) continua no lugar, em conflito', () => {
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] });
    const antes = runAllocationEngine(base);
    const { out, al } = runAllocationEngine({ ...base, ins: [{ ...base.ins[0], on: false }], fixos: fixarTudo(antes.out) });
    assert.deepEqual(pino(out[0]), pino(antes.out[0]));
    assert.deepEqual(out[0].conflito, ['o instrutor não está disponível']);
    assert.deepEqual(al.filter(a => a.t === 'conf'), [{ t: 'conf', s: 'Aluno 1000', fKey: '1000_0_1', m: 'Conflito na escala aprovada: o instrutor não está disponível.' }]);
  });

  it('avião em manutenção: o voo fixo nele fica em conflito', () => {
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] });
    const antes = runAllocationEngine(base);
    const { out } = runAllocationEngine({ ...base, av: { ...base.av, [antes.out[0].r]: false }, fixos: fixarTudo(antes.out) });
    assert.deepEqual(out[0].conflito, ['o avião está indisponível']);
  });

  it('o voo fixo cancelado libera o avião e o instrutor para outro pedido', () => {
    // Um avião e um instrutor só
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })], semAeronaves: apenas('C152', 'PP-LJV') });
    const antes = runAllocationEngine(base);
    const { out } = runAllocationEngine({
      ...base, stu: [...base.stu, aluno(1001, { p1: 390, p2: -1 })], fixos: fixarTudo(antes.out), fStatus: { [antes.out[0].fKey]: 'Cancelado' }
    });
    assert.equal(doAluno(out, 1000).status, 'Cancelado');
    assert.deepEqual([doAluno(out, 1001).a, doAluno(out, 1001).r, doAluno(out, 1001).insId], [390, 'PP-LJV', 1]);
  });

  it('a divisão das horas e a troca de matrículas não mexem nos fixos', () => {
    // Fixados: o instrutor 1 com os dois voos (06:30 e 08:20) em dois aviões; a divisão mandaria um para o instrutor 2
    const base = cenario({ ins: [instrutor(1, 1), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] });
    const fixos = {
      '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 },
      '1001_0_1': { a: 500, b: 560, r: 'PR-VOC', insId: 1 }
    };
    const { out } = runAllocationEngine({ ...base, fixos });
    assert.deepEqual(out.map(pino), [fixos['1000_0_1'], fixos['1001_0_1']]);
    assert.ok(out.every(o => !o.conflito));
  });

  it('turma de Ground fixa: um aluno novo entra na mesma turma', () => {
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { ...GROUND_C152, p1: 500, p2: -1 })] });
    const antes = runAllocationEngine(base);
    const { out } = runAllocationEngine({ ...base, stu: [...base.stu, aluno(1001, { ...GROUND_C152, p1: 500, p2: -1 })], fixos: fixarTudo(antes.out) });
    assert.equal(new Set(out.map(o => o.classKey)).size, 1, 'a mesma turma');
    assert.equal(doAluno(out, 1001).a, 500);
  });

  it('pedido que saiu da demanda: o voo fixo dele não aparece', () => {
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] });
    const antes = runAllocationEngine(base);
    const { out } = runAllocationEngine({ ...base, stu: [base.stu[0], { ...base.stu[1], fly: false }], fixos: fixarTudo(antes.out) });
    assert.deepEqual(out.map(o => o.stuId), [1000]);
  });
});

describe('Voos fixos: em 100 dias gerados', async () => {
  const { gerarCenario } = await import('../helpers/cenarios.js');

  it('com a escala fixada, pedidos novos de prioridade máxima nunca mexem num voo fixo', () => {
    for (let seed = 2001; seed <= 2100; seed++) {
      const estado = gerarCenario(seed);
      const antes = runAllocationEngine(estado);
      const novos = [0, 1, 2].map(i => aluno(9000 + i, { p1: [390, 500, 610][i], p2: -1, pr: 5 }));
      const depois = runAllocationEngine({ ...estado, stu: [...estado.stu, ...novos], fixos: fixarTudo(antes.out) });
      for (const o of antes.out) {
        const igual = depois.out.find(v => v.fKey === o.fKey);
        assert.ok(igual, `seed ${seed}: ${o.fKey} sumiu`);
        assert.deepEqual(pino(igual), pino(o), `seed ${seed}: ${o.fKey} mudou`);
        assert.equal(igual.conflito, undefined, `seed ${seed}: ${o.fKey} em conflito sem motivo`);
      }
    }
  });
});
