// O dia de operação (fase 12): a escala aprovada fica fixa. O motor põe primeiro os voos fixos (no mesmo horário, avião
// e instrutor) e encaixa o resto em volta; um voo fixo que fica impossível continua onde está, marcado em conflito, e o
// voo fixo cancelado libera o avião e o instrutor.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine } from '../../js/engine.js';
import { aluno, cenario, instrutor, apenas, missaoExtra, GROUND_C152 } from '../helpers/montar.js';

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

// Revisão de 14/11: o voo fixo é conferido de novo a cada cálculo, com as mesmas regras do motor. O que não vale mais
// vira conflito, com o texto e o código (o código decide as sugestões de reparo)
describe('Voos fixos conferidos de novo', () => {
  const VOO = { a: 390, b: 450, r: 'PR-VOB', insId: 1 };
  const fixado = (pedido = {}, extra = {}, pinoDoVoo = VOO) => ({
    ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1, ...pedido })] }),
    fixos: { '1000_0_1': pinoDoVoo }, ...extra
  });
  const conflitoDe = estado => {
    const [voo] = runAllocationEngine(estado).out;
    return { conflito: voo.conflito, codigos: voo.conflitoCodigos };
  };

  it('o voo fixo que continua valendo fica sem conflito', () => {
    assert.deepEqual(conflitoDe(fixado()), { conflito: undefined, codigos: undefined });
  });

  it('Parafuso fora do avião "Só Parafuso", e outra missão nele', () => {
    assert.deepEqual(conflitoDe(fixado({ mis: 'Parafuso' })),
      { conflito: ['o Parafuso só voa no PR-JPL'], codigos: ['so-parafuso'] });
    assert.deepEqual(conflitoDe(fixado({}, {}, { ...VOO, r: 'PR-JPL' })),
      { conflito: ['o PR-JPL é só para o Parafuso'], codigos: ['so-parafuso'] });
  });

  it('peso do aluno e do instrutor acima do limite, mesmo com o mínimo de combustível', () => {
    assert.deepEqual(conflitoDe(fixado({}, { stu: [aluno(1000, { p1: 390, p2: -1 }, { kg: 160 })] })),
      { conflito: ['o peso do aluno e do instrutor passa do limite do avião, mesmo com o mínimo de combustível'], codigos: ['peso'] });
  });

  it('o avião passaria da revisão de 50 horas', () => {
    assert.deepEqual(conflitoDe(fixado({}, { horas: { 'PR-VOB': 49.5 } })),
      { conflito: ['o avião passaria da revisão de 50 horas'], codigos: ['revisao'] });
  });

  it('o instrutor passaria dos limites da lei (o repouso depois de ontem)', () => {
    const horasDosInstrutores = { 1: { mes: 0, semestre: 0, ano: 0, fimAnterior: 1410 } };
    assert.deepEqual(conflitoDe(fixado({}, { horasDosInstrutores })),
      { conflito: ['o instrutor passaria do limite da lei (repouso)'], codigos: ['limite-da-lei'] });
  });

  it('o aluno não voa com o instrutor', () => {
    assert.deepEqual(conflitoDe(fixado({}, { stu: [aluno(1000, { p1: 390, p2: -1 }, { bl: [1] })] })),
      { conflito: ['o aluno não voa com este instrutor'], codigos: ['bloqueio'] });
  });

  it('o período fechado nesta data e fora da disponibilidade do aluno', () => {
    const fechado = fixado();
    fechado.win = fechado.win.map((v, w) => (w === 0 ? false : v));
    assert.deepEqual(conflitoDe(fechado), { conflito: ['o horário está fechado nesta data'], codigos: ['horario-fechado'] });
    assert.deepEqual(conflitoDe(fixado({ jan: 'tarde' })),
      { conflito: ['o horário está fora da disponibilidade do aluno'], codigos: ['disponibilidade'] });
  });

  it('a duração do pedido mudou', () => {
    assert.deepEqual(conflitoDe(fixado({ nb: 2 })), { conflito: ['a duração do pedido mudou'], codigos: ['duracao'] });
  });

  it('o pedido passou de voo para Ground, e de Ground para voo', () => {
    assert.deepEqual(conflitoDe(fixado(GROUND_C152)), { conflito: ['o pedido passou de voo para Ground'], codigos: ['ground-ou-voo'] });
    const turma = { a: 390, b: 480, r: 'SALA-GROUND', insId: 1, classKey: 'GND_Ground C152_0_1' };
    assert.deepEqual(conflitoDe(fixado({}, {}, turma)), { conflito: ['o pedido passou de Ground para voo'], codigos: ['ground-ou-voo'] });
  });

  it('os conflitos de antes ganham código', () => {
    assert.deepEqual(conflitoDe(fixado({}, { ins: [{ ...instrutor(1, 9), on: false }] })),
      { conflito: ['o instrutor não está disponível'], codigos: ['instrutor-indisponivel'] });
    assert.deepEqual(conflitoDe(fixado({ eq: 'C172' })), { conflito: ['a missão ou o avião do pedido mudou'], codigos: ['tipo-de-aviao'] });
  });

  it('o voo fixo cancelado não é conferido', () => {
    assert.deepEqual(conflitoDe(fixado({ nb: 2 }, { fStatus: { '1000_0_1': 'Cancelado' } })), { conflito: undefined, codigos: undefined });
  });
});

// Revisão de 14/11: a turma de Ground fixa
describe('Turma de Ground fixa', () => {
  const TURMA = { a: 390, b: 480, r: 'SALA-GROUND', insId: 1, classKey: 'GND_Ground C152_0_1' };
  const ground = (id, pedido = {}, extra = {}) => aluno(id, { ...GROUND_C152, p1: 390, p2: -1, ...pedido }, extra);

  it('com o primeiro aluno cancelado, a turma continua ocupando a sala e o instrutor', () => {
    const estado = {
      ...cenario({ ins: [instrutor(1, 9)], stu: [ground(1000), ground(1001), aluno(1002, { mis: 'Ground PA-34', eq: 'Sala Ground', nb: 1.5, p1: 390, p2: -1 })] }),
      fixos: { '1000_0_1': TURMA, '1001_0_1': TURMA }, fStatus: { '1000_0_1': 'Cancelado' }
    };
    const { out } = runAllocationEngine(estado);
    assert.equal(doAluno(out, 1001).conflito, undefined);
    assert.ok(doAluno(out, 1002).a >= 480, `a outra turma às ${doAluno(out, 1002).a}`);
  });

  it('turma fixa sem o instrutor: um aluno novo não entra nela', () => {
    const estado = {
      ...cenario({ ins: [instrutor(1, 9, { on: false }), instrutor(2, 9)], stu: [ground(1000), ground(1001)] }),
      fixos: { '1000_0_1': TURMA }
    };
    const { out } = runAllocationEngine(estado);
    assert.deepEqual(doAluno(out, 1000).conflitoCodigos, ['instrutor-indisponivel']);
    const novo = doAluno(out, 1001);
    assert.notEqual(novo.classKey, TURMA.classKey);
    assert.deepEqual([novo.insId, novo.conflito], [2, undefined]);
  });

  it('a chave de uma turma nova não repete a de uma turma fixa', () => {
    // A turma fixa foi passada para as 08:20 (a chave continua a do período 0); o aluno novo só pode às 06:30
    const estado = {
      ...cenario({ ins: [instrutor(1, 9)], stu: [ground(1000), ground(1001, { jan: 'h390' })] }),
      fixos: { '1000_0_1': { ...TURMA, a: 500, b: 590 } }
    };
    const { out } = runAllocationEngine(estado);
    assert.equal(doAluno(out, 1001).a, 390);
    assert.notEqual(doAluno(out, 1001).classKey, doAluno(out, 1000).classKey);
  });

  it('o voo fixo que depende do Ground é um prazo: o Ground termina antes dele', () => {
    // O voo está fixo às 08:20, mas o pedido ainda diz 12:40; o Ground prefere as 10:10
    const voo = { a: 500, b: 560, r: 'PR-VOB', insId: 1 };
    const estado = {
      ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [ground(1000, { p1: 610 }, { extra: [missaoExtra(1, { p1: 760, p2: -1 })] })] }),
      fixos: { '1000_1_1': voo }
    };
    const { out, al } = runAllocationEngine(estado, { compactar: false });
    const turma = out.find(o => o.isGround);
    assert.ok(turma && turma.b <= 500, JSON.stringify({ turma, al }));
  });

  it('sem horário para o Ground antes do voo fixo, a rejeição diz por quê', () => {
    const voo = { a: 390, b: 450, r: 'PR-VOB', insId: 1 };
    const estado = {
      ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [ground(1000, { p1: 610 }, { extra: [missaoExtra(1, { p1: 390, p2: -1 })] })] }),
      fixos: { '1000_1_1': voo }
    };
    const { al } = runAllocationEngine(estado);
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1000', m: 'Rejeitado: o Ground precisa terminar antes do voo fixo das 06:30, e não há horário para ele antes disso.' }]);
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
