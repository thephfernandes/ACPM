// O dia de operação: a escala aprovada fica fixa. O motor põe primeiro os voos fixos (no mesmo horário, avião
// e instrutor) e encaixa o resto em volta; um voo fixo que fica impossível continua onde está, marcado em conflito, e o
// voo fixo cancelado libera o avião e o instrutor.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine } from '../../js/engine.js';
import { normalizarFixos, pinoDoVoo, fixosAoMudarStatus, fixosAoReabrir, fixosAoAprovar, semAgendados, limparDemanda, motivoDoFixo, pinoDeVoltaNaTurma } from '../../js/fixos.js';
import { escolherInstrutor, reverterEscolha } from '../../js/instrutor-escolhido.js';
import { comRepousoDoNoturno } from '../../js/noturno.js';
import { normalizarEscalaGravada } from '../../js/escala-gravada.js';
import { CODIGOS_DO_AGENDADO } from '../../js/conflitos.js';
import { blank } from '../../js/rules.js';
import { gerarCenario } from '../helpers/cenarios.js';
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

// O voo fixo é conferido de novo a cada cálculo, com as mesmas regras do motor. O que não vale mais
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

  it('o horário fechado nesta data e fora da disponibilidade do aluno', () => {
    const fechado = fixado();
    fechado.win = fechado.win.map((v, w) => (w === 0 ? false : v));
    assert.deepEqual(conflitoDe(fechado), { conflito: ['o horário está fechado nesta data'], codigos: ['horario-fechado'] });
    assert.deepEqual(conflitoDe(fixado({ jan: 'h760' })),
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

  it('os conflitos do instrutor indisponível e da missão ou do avião que mudou também têm código', () => {
    assert.deepEqual(conflitoDe(fixado({}, { ins: [{ ...instrutor(1, 9), on: false }] })),
      { conflito: ['o instrutor não está disponível'], codigos: ['instrutor-indisponivel'] });
    assert.deepEqual(conflitoDe(fixado({ eq: 'C172' })), { conflito: ['a missão ou o avião do pedido mudou'], codigos: ['tipo-de-aviao'] });
  });

  it('o voo fixo cancelado não é conferido', () => {
    assert.deepEqual(conflitoDe(fixado({ nb: 2 }, { fStatus: { '1000_0_1': 'Cancelado' } })), { conflito: undefined, codigos: undefined });
  });
});

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
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1000', m: 'Rejeitado: o Ground precisa terminar antes do voo fixo das 06:30, e não há horário para ele antes disso.', codigo: 'ground-antes-do-voo-fixo' }]);
  });

  // Desfazer o agendamento que tirou um aluno da turma (js/reversoes.js): o voo fixo de antes volta com a chave da turma só
  // enquanto ela está como ele a deixou; senão, numa turma só dele. Com a mesma chave, as duas turmas seriam uma só para o
  // motor, e o segundo horário não ocuparia a sala nem o instrutor
  it('o voo fixo de antes volta para a turma só enquanto ela está no mesmo horário e com o mesmo instrutor', () => {
    const { classKey: _, ...semChave } = TURMA;
    // A turma como estava, ou sem outro voo fixo nela: a chave volta
    assert.deepEqual(pinoDeVoltaNaTurma({ '1001_0_1': TURMA }, '1000_0_1', TURMA, 'Ground C152'), TURMA);
    assert.deepEqual(pinoDeVoltaNaTurma({ '1000_0_1': { ...TURMA, a: 610, b: 700 } }, '1000_0_1', TURMA, 'Ground C152'), TURMA);
    // A turma passou para as 12:40 ou para outro instrutor: o voo volta sem a chave (a turma dele fica com a chave do voo)
    for (const mudou of [{ a: 760, b: 850 }, { insId: 2 }]) {
      assert.deepEqual(pinoDeVoltaNaTurma({ '1001_0_1': { ...TURMA, ...mudou } }, '1000_0_1', TURMA, 'Ground C152'), semChave, JSON.stringify(mudou));
    }
    // A turma que tem a chave do voo dele (ele a abriu, e outro aluno entrou nela) também é a turma dele
    const aberta = { '1001_0_1': { ...semChave, a: 760, b: 850, classKey: '1000_0_1' } };
    assert.deepEqual(pinoDeVoltaNaTurma(aberta, '1000_0_1', semChave, 'Ground C152'), { ...semChave, classKey: 'GND_Ground C152_0_1' });
    // A chave do voo já é a de outra turma: uma chave nova, que nenhum voo fixo usa
    const outra = { '1001_0_1': { ...TURMA, a: 760, b: 850 }, '1002_0_1': { ...TURMA, a: 610, b: 700, classKey: '1000_0_1' } };
    assert.deepEqual(pinoDeVoltaNaTurma(outra, '1000_0_1', TURMA, 'Ground C152'), { ...semChave, classKey: 'GND_Ground C152_0_1_2' });
    // O voo de avião não tem turma
    const voo = { a: 390, b: 450, r: 'PR-VOB', insId: 1 };
    assert.deepEqual(pinoDeVoltaNaTurma({ '1001_0_1': { ...voo, a: 500, b: 560 } }, '1000_0_1', voo, 'Voo Local'), voo);
  });
});

// O voo atrasado ocupa o horário novo; o cancelado não ocupa nada nem conta nas horas
describe('Voos fixos atrasados e cancelados', () => {
  const VOO = { a: 390, b: 450, r: 'PP-LJV', insId: 1 };

  it('o voo fixo atrasado ocupa o horário novo (e deixa o de antes)', () => {
    const estado = {
      ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })], semAeronaves: apenas('C152', 'PP-LJV') }),
      fixos: { '1000_0_1': VOO }, fStatus: { '1000_0_1': 'Atrasado' }, fObs: { '1000_0_1': { novoInicio: 500 } }
    };
    const { out, al } = runAllocationEngine(estado);
    const novo = doAluno(out, 1001);
    assert.ok(novo.b <= 500 || novo.a >= 560, `o voo novo às ${novo.a}`);
    assert.deepEqual(al.filter(a => /Atraso/.test(a.m)), []);
  });

  it('o atraso conta no limite da lei do instrutor (o horário novo)', () => {
    // O voo das 06:30 atrasado para as 16:30: com a jornada de 10 h (até 18:00 com o encerramento), o voo novo do
    // instrutor só cabe a partir das 10:10 (pelo horário de antes, caberia às 08:20)
    const estado = {
      ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 390, p2: -1 })] }),
      fixos: { '1000_0_1': VOO }, fStatus: { '1000_0_1': 'Atrasado' }, fObs: { '1000_0_1': { novoInicio: 990 } },
      limites: { jornadaMin: 600 }
    };
    const { out } = runAllocationEngine(estado, { compactar: false });
    assert.equal(doAluno(out, 1001).a, 610);
  });

  it('o voo cancelado não conta na revisão de 50 horas, no limite da lei nem na turma', () => {
    const turma = { a: 500, b: 590, r: 'SALA-GROUND', insId: 1, classKey: 'GND_Ground C152_1_1' };
    const estado = {
      ...cenario({
        ins: [instrutor(1, 9)],
        stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { ...GROUND_C152, p1: 500, p2: -1 }), aluno(1002, { ...GROUND_C152, p1: 500, p2: -1 })],
        horas: { 'PP-LJV': 49 }
      }),
      fixos: { '1000_0_1': VOO, '1001_0_1': turma, '1002_0_1': turma },
      fStatus: { '1000_0_1': 'Cancelado', '1001_0_1': 'Cancelado' },
      horasDosInstrutores: { 1: { mes: 99, semestre: 0, ano: 0, fimAnterior: null } }
    };
    const { out, al, revisao } = runAllocationEngine(estado);
    assert.deepEqual(revisao['PP-LJV'], { inicio: 49, voadas: 0, fim: 49, paraAs: null });
    assert.deepEqual(al.filter(a => a.codigo === 'perto-do-limite'), []);
    assert.deepEqual([doAluno(out, 1002).groupSize, doAluno(out, 1002).tag], [1, 'Pref. 1']);
  });

  it('o voo fixo cancelado não conta nas horas da divisão igual', () => {
    // O instrutor 1 (menos habilitações) tem o voo das 08:20 e um cancelado;
    // com o cancelado contando, o voo iria para o 2
    const estado = {
      ...cenario({ ins: [instrutor(1, 1), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] }),
      fixos: { '1000_0_1': VOO }, fStatus: { '1000_0_1': 'Cancelado' }
    };
    const { out } = runAllocationEngine(estado, { compactar: false });
    assert.equal(doAluno(out, 1001).insId, 1);
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

// O ciclo do cadeado. Em Voo, Atrasado, Pousou e Cancelado fixam o voo; Pendente ou Confirmado o soltam fora
// da escala aprovada; Reabrir mantém os fixados pelo status; o cadeado diz por que o voo está fixo
describe('O cadeado do voo', () => {
  const VOO = { fKey: '1000_0_1', a: 390, b: 450, r: 'PR-VOB', insId: 1 };
  const PINO = { a: 390, b: 450, r: 'PR-VOB', insId: 1 };

  it('o status de andamento fixa o voo (mantém o pino que já havia)', async () => {
    const { fixosAoMudarStatus } = await import('../../js/fixos.js');
    for (const status of ['Em Voo', 'Atrasado', 'Cancelado']) {
      assert.deepEqual(fixosAoMudarStatus({}, VOO, status, { aprovada: false }), { '1000_0_1': PINO });
    }
    const antigo = { '1000_0_1': { ...PINO, r: 'PR-VOC' } };
    assert.deepEqual(fixosAoMudarStatus(antigo, VOO, 'Em Voo', { aprovada: true }), antigo);
  });

  it('Pendente ou Confirmado soltam o voo fora da escala aprovada; na aprovada, ele continua fixo', async () => {
    const { fixosAoMudarStatus } = await import('../../js/fixos.js');
    const fixos = { '1000_0_1': PINO, '1001_0_1': { ...PINO, a: 500, b: 560 } };
    assert.deepEqual(fixosAoMudarStatus(fixos, VOO, 'Confirmado', { aprovada: false }), { '1001_0_1': fixos['1001_0_1'] });
    assert.deepEqual(fixosAoMudarStatus(fixos, VOO, 'Pendente', { aprovada: true }), fixos);
  });

  it('Reabrir mantém só os voos fixados pelo status', async () => {
    const { fixosAoReabrir } = await import('../../js/fixos.js');
    const fixos = { '1000_0_1': PINO, '1001_0_1': PINO, '1002_0_1': PINO, '1003_0_1': PINO };
    const fStatus = { '1000_0_1': 'Em Voo', '1001_0_1': 'Confirmado', '1002_0_1': 'Cancelado', '1003_0_1': 'Pousou' };
    assert.deepEqual(Object.keys(fixosAoReabrir(fixos, fStatus)), ['1000_0_1', '1002_0_1', '1003_0_1']);
  });

  it('o motivo do cadeado', async () => {
    const { motivoDoFixo } = await import('../../js/fixos.js');
    assert.equal(motivoDoFixo('1000_0_1', { fStatus: {}, aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' } }), 'Voo fixo: escala aprovada');
    assert.equal(motivoDoFixo('1000_0_1', { fStatus: { '1000_0_1': 'Em Voo' }, aprovacao: null }), 'Voo fixo: Em Voo');
    assert.equal(motivoDoFixo('1000_0_1', { fStatus: { '1000_0_1': 'Cancelado' }, aprovacao: { em: 'x' } }), 'Voo fixo: Cancelado');
    assert.equal(motivoDoFixo('1000_0_1', { fStatus: { '1000_0_1': 'Pousou' }, aprovacao: null }), 'Voo fixo: Pousou');
    // No Ground e no simulador, o Pousou aparece como "Concluída"
    assert.equal(motivoDoFixo('1000_0_1', { fStatus: { '1000_0_1': 'Pousou' }, aprovacao: null, voo: { mis: 'Ground C152', isGround: true } }), 'Voo fixo: Concluída');
  });
});

// O voo agendado na Escala: o pino com a marca agendado. Ele fica fixo no ciclo inteiro do cadeado (o status, a
// reabertura e a aprovação, que guarda até o agendado que está fora da escala) e sai quando a Demanda solta o pedido
// dele (semAgendados: a missão extra tirada, outra missão no pedido; limparDemanda: a demanda limpa, que deixa como está
// o voo em andamento ou que já pousou)
describe('O voo agendado na Escala', () => {
  const VOO = { fKey: '1000_0_1', a: 390, b: 450, r: 'PR-VOB', insId: 1 };
  const PINO = { a: 390, b: 450, r: 'PR-VOB', insId: 1 };
  const AGENDADO = { ...PINO, agendado: true };
  const APROVACAO = { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' };

  it('os dados guardam a marca só quando ela é true: adulterada, sai (o voo fixo continua)', () => {
    const lidos = normalizarFixos({
      '1000_0_1': AGENDADO,
      '1001_0_1': { ...PINO, agendado: 'sim' },
      '1002_0_1': { ...PINO, agendado: 1 },
      '1003_0_1': { ...PINO, agendado: false },
      '1004_0_1': { ...PINO, agendado: true, escolhido: true, onclick: 'x' },
      '1005_0_1': { ...PINO, escolhido: 'true', agendado: true },
      '1006_0_1': { ...PINO, a: '390', agendado: true }
    });
    assert.deepEqual(lidos, {
      '1000_0_1': AGENDADO, '1001_0_1': PINO, '1002_0_1': PINO, '1003_0_1': PINO,
      '1004_0_1': { ...PINO, escolhido: true, agendado: true }, '1005_0_1': AGENDADO
    });
  });

  it('o pino do voo leva a marca da linha da escala (também na turma de Ground)', () => {
    assert.deepEqual(pinoDoVoo({ ...VOO, agendado: true }), AGENDADO);
    assert.deepEqual(pinoDoVoo(VOO), PINO);
    const turma = { fKey: '1000_0_1', a: 390, b: 480, r: 'SALA-GROUND', insId: 1, isGround: true, classKey: 'GND_Ground C152_0_1', agendado: true };
    assert.deepEqual(pinoDoVoo(turma), { a: 390, b: 480, r: 'SALA-GROUND', insId: 1, classKey: 'GND_Ground C152_0_1', agendado: true });
  });

  it('Pendente e Confirmado não soltam o agendado; o status de andamento mantém o pino dele, com a marca', () => {
    const fixos = { '1000_0_1': AGENDADO, '1001_0_1': { ...PINO, a: 500, b: 560 } };
    for (const status of ['Pendente', 'Confirmado']) assert.deepEqual(fixosAoMudarStatus(fixos, VOO, status, { aprovada: false }), fixos);
    for (const status of ['Em Voo', 'Atrasado', 'Pousou', 'Cancelado']) assert.deepEqual(fixosAoMudarStatus(fixos, VOO, status, { aprovada: false }), fixos);
    // O voo fixo sem marca continua sendo solto, como antes
    assert.deepEqual(fixosAoMudarStatus(fixos, { ...VOO, fKey: '1001_0_1' }, 'Confirmado', { aprovada: false }), { '1000_0_1': AGENDADO });
  });

  it('Reabrir mantém o agendado, com os fixados pelo status e pela escolha do instrutor; o fixo só pela aprovação sai', () => {
    const fixos = { '1000_0_1': AGENDADO, '1001_0_1': PINO, '1002_0_1': { ...PINO, escolhido: true }, '1003_0_1': PINO, '1004_0_1': { ...AGENDADO, escolhido: true } };
    const reaberta = fixosAoReabrir(fixos, { '1003_0_1': 'Em Voo', '1000_0_1': 'Confirmado' });
    assert.deepEqual(reaberta, { '1000_0_1': AGENDADO, '1002_0_1': fixos['1002_0_1'], '1003_0_1': PINO, '1004_0_1': fixos['1004_0_1'] });
  });

  it('Aprovar fixa cada voo da escala com as marcas: o agendado (do pino ou da linha) e o escolhido (do pino)', () => {
    const linha = (fKey, extra = {}) => ({ fKey, classKey: fKey, isGround: false, a: 390, b: 450, r: 'PR-VOB', insId: 1, ...extra });
    const turma = 'GND_Ground C152_0_1';
    const out = [
      linha('1000_0_1'), linha('1001_0_1', { agendado: true }), linha('1002_0_1'), linha('1003_0_1'),
      linha('1004_0_1', { isGround: true, classKey: turma, r: 'SALA-GROUND', b: 480, agendado: true })
    ];
    // A escala da tela pode ser a gravada antes da marca (o 1000 não a tem na linha): a marca vem do pino
    const fixos = { '1000_0_1': AGENDADO, '1002_0_1': { ...PINO, escolhido: true }, '1003_0_1': { ...PINO, a: 500, b: 560 } };
    assert.deepEqual(fixosAoAprovar(fixos, out), {
      '1000_0_1': AGENDADO, '1001_0_1': AGENDADO, '1002_0_1': { ...PINO, escolhido: true }, '1003_0_1': PINO,
      '1004_0_1': { a: 390, b: 480, r: 'SALA-GROUND', insId: 1, classKey: turma, agendado: true }
    });
  });

  it('Aprovar mantém o agendado que está fora da escala (o pedido tirado dela); os outros fixos fora dela saem, como antes', () => {
    const fixos = { '1000_0_1': AGENDADO, '1001_0_1': { ...AGENDADO, escolhido: true }, '1002_0_1': { ...PINO, escolhido: true }, '1003_0_1': PINO };
    const out = [{ fKey: '1004_0_1', classKey: '1004_0_1', isGround: false, a: 500, b: 560, r: 'PR-VOC', insId: 2 }];
    const PINO_DA_ESCALA = { a: 500, b: 560, r: 'PR-VOC', insId: 2 };
    assert.deepEqual(fixosAoAprovar(fixos, out), { '1000_0_1': AGENDADO, '1001_0_1': fixos['1001_0_1'], '1004_0_1': PINO_DA_ESCALA });
    assert.deepEqual(fixosAoAprovar(undefined, out), { '1004_0_1': PINO_DA_ESCALA });
    assert.deepEqual(fixosAoAprovar(fixos, []), { '1000_0_1': AGENDADO, '1001_0_1': fixos['1001_0_1'] });
  });

  it('sem agendados, Aprovar fixa o mesmo que antes: cada voo da escala, com a escolha do instrutor que o pino tinha', () => {
    // O código de antes, como estava em js/eventos/escala.js
    const comoAntes = (fixos, out) => Object.fromEntries(out.map(o => [o.fKey, { ...pino(o), ...((fixos || {})[o.fKey]?.escolhido ? { escolhido: true } : {}) }]));
    for (let seed = 2001; seed <= 2030; seed++) {
      const { out } = runAllocationEngine(gerarCenario(seed));
      const fixos = { ...Object.fromEntries(out.filter((o, i) => i % 3 === 0).map(o => [o.fKey, { ...pino(o), escolhido: true }])), '9999_0_1': { ...PINO, escolhido: true } };
      assert.deepEqual(fixosAoAprovar(fixos, out), comoAntes(fixos, out), `seed ${seed}`);
    }
  });

  it('com o motor: o agendado tirado da escala volta ao lugar dele depois da aprovação, e a reabertura não o solta', () => {
    // O agendamento: o Aluno 1000 às 10:10 no PR-VOB com o Instrutor 02 (o pedido dele prefere as 06:30)
    const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] });
    const agendado = { a: 610, b: 670, r: 'PR-VOB', insId: 2, agendado: true };
    estado.fixos = { '1000_0_1': agendado };
    const doAluno1000 = r => doAluno(r.out, 1000);
    const antes = runAllocationEngine(estado);
    assert.deepEqual([doAluno1000(antes).a, doAluno1000(antes).agendado, antes.al], [610, true, []]);

    // Tirado da escala (Voa desligado) e a escala aprovada: o agendado continua nos voos fixos
    estado.stu[0].fly = false;
    const semEle = runAllocationEngine(estado);
    assert.equal(doAluno1000(semEle), undefined);
    estado.fixos = fixosAoAprovar(estado.fixos, semEle.out);
    estado.aprovacao = APROVACAO;
    assert.deepEqual(Object.keys(estado.fixos).sort(), ['1000_0_1', '1001_0_1']);

    // De volta à escala: no lugar do agendamento, com a marca, e o cadeado diz por quê
    estado.stu[0].fly = true;
    const voo = doAluno1000(runAllocationEngine(estado));
    assert.deepEqual([voo.a, voo.r, voo.insId, voo.fixo, voo.agendado, voo.conflito], [610, 'PR-VOB', 2, true, true, undefined]);
    assert.equal(motivoDoFixo(voo.fKey, { fStatus: {}, aprovacao: estado.aprovacao, voo, fixos: estado.fixos }), 'Voo fixo: agendado na escala');
    assert.equal(motivoDoFixo('1001_0_1', { fStatus: {}, aprovacao: estado.aprovacao, fixos: estado.fixos }), 'Voo fixo: escala aprovada');
    // Reabrir: o agendado continua fixo; o fixo só pela aprovação sai
    assert.deepEqual(fixosAoReabrir(estado.fixos, {}), { '1000_0_1': agendado });
  });

  it('o cadeado: o status primeiro, depois o agendamento, a escala aprovada e o instrutor escolhido', () => {
    const motivo = (pinoDoDia, { fStatus = {}, aprovacao = null } = {}) => motivoDoFixo('1000_0_1', { fStatus, aprovacao, voo: VOO, fixos: { '1000_0_1': pinoDoDia } });
    const AMBOS = { ...AGENDADO, escolhido: true };
    assert.equal(motivo(AMBOS, { fStatus: { '1000_0_1': 'Em Voo' }, aprovacao: APROVACAO }), 'Voo fixo: Em Voo');
    assert.equal(motivo(AMBOS, { aprovacao: APROVACAO }), 'Voo fixo: agendado na escala');
    assert.equal(motivo(AGENDADO), 'Voo fixo: agendado na escala');
    assert.equal(motivo({ ...PINO, escolhido: true }, { aprovacao: APROVACAO }), 'Voo fixo: escala aprovada');
    assert.equal(motivo({ ...PINO, escolhido: true }), 'Voo fixo: instrutor escolhido na escala');
    assert.equal(motivo(PINO), 'Voo fixo');
    assert.equal(motivoDoFixo('1000_0_1', { fStatus: {}, aprovacao: null }), 'Voo fixo');
  });

  it('semAgendados: só os agendados das chaves saem; os outros voos fixos ficam', () => {
    const fixos = {
      '1000_0_1': AGENDADO, '1001_0_1': PINO, '1002_0_1': { ...PINO, escolhido: true }, '1003_0_1': { ...AGENDADO, escolhido: true }, '1004_1_1': AGENDADO
    };
    const copia = structuredClone(fixos);
    assert.deepEqual(semAgendados(fixos, Object.keys(fixos)), { '1001_0_1': PINO, '1002_0_1': fixos['1002_0_1'] });
    assert.deepEqual(semAgendados(fixos, ['1004_1_1']), { '1000_0_1': AGENDADO, '1001_0_1': PINO, '1002_0_1': fixos['1002_0_1'], '1003_0_1': fixos['1003_0_1'] });
    // O agendado que também tinha o instrutor escolhido sai inteiro
    assert.equal(semAgendados(fixos, ['1003_0_1'])['1003_0_1'], undefined);
    // As chaves de voos fixos sem a marca: nada muda
    assert.deepEqual(semAgendados(fixos, ['1001_0_1', '1002_0_1', '1009_0_1']), fixos);
    assert.deepEqual(semAgendados(fixos, []), fixos);
    assert.deepEqual(semAgendados(undefined, ['1000_0_1']), {});
    assert.deepEqual(fixos, copia, 'os voos fixos de antes não mudam');
  });

  it('semAgendados com o status: o agendado em andamento, pousado ou cancelado continua fixo pelo status, só sem a marca', () => {
    const fixos = {
      '1000_0_1': AGENDADO, '1001_0_1': { ...AGENDADO, escolhido: true }, '1002_0_1': AGENDADO, '1003_0_1': AGENDADO, '1004_0_1': PINO
    };
    const fStatus = { '1000_0_1': 'Em Voo', '1001_0_1': 'Cancelado', '1002_0_1': 'Confirmado', '1004_0_1': 'Pousou' };
    const copia = structuredClone(fixos);
    // Todas as chaves: o agendado com um status que fixa fica como o fixo pelo status (com a escolha do instrutor, se tinha)
    assert.deepEqual(semAgendados(fixos, Object.keys(fixos), fStatus), { '1000_0_1': PINO, '1001_0_1': { ...PINO, escolhido: true }, '1004_0_1': PINO });
    assert.deepEqual(semAgendados(fixos, ['1000_0_1', '1002_0_1'], fStatus), { '1000_0_1': PINO, '1001_0_1': fixos['1001_0_1'], '1003_0_1': AGENDADO, '1004_0_1': PINO });
    for (const status of ['Em Voo', 'Atrasado', 'Pousou', 'Cancelado']) {
      assert.deepEqual(semAgendados({ '1000_0_1': AGENDADO }, ['1000_0_1'], { '1000_0_1': status }), { '1000_0_1': PINO }, status);
    }
    for (const status of ['Pendente', 'Confirmado']) assert.deepEqual(semAgendados({ '1000_0_1': AGENDADO }, ['1000_0_1'], { '1000_0_1': status }), {}, status);
    assert.deepEqual(fixos, copia, 'os voos fixos de antes não mudam');
  });

  it('com o motor: o agendado com um status que fixa não sai do lugar quando a Demanda muda a missão, como o fixo pelo status', () => {
    for (const status of ['Em Voo', 'Atrasado', 'Pousou', 'Cancelado']) {
      for (const agendado of [true, false]) {
        const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] });
        estado.fixos = { '1000_0_1': { a: 610, b: 670, r: 'PR-VOB', insId: 2, ...(agendado ? { agendado: true } : {}) } };
        // O status na Escala mantém o pino (com a marca); depois, outra missão no pedido (eventos/demanda.js)
        estado.fixos = fixosAoMudarStatus(estado.fixos, doAluno(runAllocationEngine(estado).out, 1000), status, { aprovada: false });
        estado.fStatus = { '1000_0_1': status };
        estado.stu[0].mis = 'Navegação';
        estado.fixos = semAgendados(estado.fixos, ['1000_0_1'], estado.fStatus);
        const voo = doAluno(runAllocationEngine(estado).out, 1000);
        assert.deepEqual([voo.a, voo.r, voo.insId, voo.fixo, voo.agendado, voo.status], [610, 'PR-VOB', 2, true, undefined, status], `${status}, agendado: ${agendado}`);
      }
    }
  });

  it('o agendado com o instrutor escolhido que a Demanda solta: o pedido continua com o instrutor, e o motor também', () => {
    // O Aluno 1001 agendado às 10:10 e depois com o Instrutor 02 escolhido na Escala (o pedido guarda a escolha)
    const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 1)], stu: [aluno(1000), aluno(1001, { insId: 2 })] });
    estado.fixos = { '1001_0_1': { a: 610, b: 670, r: 'PR-VOC', insId: 2, agendado: true, escolhido: true } };
    estado.fixos = semAgendados(estado.fixos, ['1001_0_1']);
    assert.deepEqual(estado.fixos, {});
    const voo = doAluno(runAllocationEngine(estado).out, 1001);
    assert.deepEqual([voo.insId, voo.insEscolhido, voo.fixo], [2, true, undefined]);
  });

  it('"Automático" no agendado com o instrutor escolhido: ele continua agendado, com o instrutor de agora, sem a marca da escolha', () => {
    // O app põe o Instrutor 02 (menos habilitações) no Aluno 1000 e o 01 no 1001, os dois às 08:20
    const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 1)], stu: [aluno(1000), aluno(1001)] });
    const agendado = { ...pino(doAluno(runAllocationEngine(estado).out, 1001)), agendado: true };
    estado.fixos = { '1001_0_1': agendado };
    // O instrutor escolhido na Escala: o agendado leva também a marca da escolha
    escolherInstrutor(estado, runAllocationEngine(estado), { stuId: 1001, mid: 0 }, 2, { noLugar: true });
    assert.deepEqual(estado.fixos, { '1001_0_1': { ...agendado, insId: 2, escolhido: true } });
    const { antes } = escolherInstrutor(estado, runAllocationEngine(estado), { stuId: 1001, mid: 0 }, null, { noLugar: true });
    assert.deepEqual([estado.fixos, estado.stu[1].insId], [{ '1001_0_1': { ...agendado, insId: 2 } }, undefined]);
    // Pela Demanda, também
    escolherInstrutor(estado, runAllocationEngine(estado), { stuId: 1001, mid: 0 }, 2, { noLugar: true });
    escolherInstrutor(estado, runAllocationEngine(estado), { stuId: 1001, mid: 0 }, null);
    assert.deepEqual(estado.fixos, { '1001_0_1': { ...agendado, insId: 2 } });
    // A reversão do "Automático" volta a escolha
    reverterEscolha(estado, antes);
    assert.deepEqual([estado.fixos, estado.stu[1].insId], [{ '1001_0_1': { ...agendado, insId: 2, escolhido: true } }, 2]);
  });

  it('reverter uma escolha não solta o voo agendado depois dela no mesmo lugar', () => {
    const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 1)], stu: [aluno(1000), aluno(1001)] });
    const { antes } = escolherInstrutor(estado, runAllocationEngine(estado), { stuId: 1001, mid: 0 }, 2, { noLugar: true });
    assert.deepEqual(antes.soltar, ['1001_0_1']);
    const agendado = { ...estado.fixos['1001_0_1'], agendado: true };
    delete agendado.escolhido;
    estado.fixos = { '1001_0_1': agendado };
    reverterEscolha(estado, antes);
    assert.deepEqual([estado.fixos, estado.stu[1].insId], [{ '1001_0_1': agendado }, undefined]);
  });
});

// A volta do noturno de ontem é uma linha fixa da escala (lida da véspera), não um voo fixo do dia: o agendamento não
// mexe nela. A aprovação, o status, a reabertura e a Demanda a tratam como antes (o pino da volta tem a chave da sessão
// 2, que o motor não lê)
describe('O voo agendado e a volta do noturno de ontem', () => {
  const volta = { stuId: 1000, mid: 0, insId: 1, r: 'PR-HAR', eqType: 'C172', s: 'Aluno 1000', ins: 'Instrutor 01', stuKg: 70, fim: 1290 };
  const PINO_DA_VOLTA = { a: 450, b: 510, r: 'PR-HAR', insId: 1 };
  const diaSeguinte = () => {
    const estado = cenario({
      ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { mis: 'Voo Local', eq: 'C172', p1: 610, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })],
      semAeronaves: apenas('C172', 'PR-HAR')
    });
    estado.noturnosDaVespera = [volta];
    estado.horasDosInstrutores = comRepousoDoNoturno({ 1: { mes: 0, semestre: 0, ano: 0, fimAnterior: 1290 } }, [volta]);
    return estado;
  };
  const daVolta = out => out.find(o => o.trecho === 'volta');

  it('Aprovar fixa a volta como antes, sem marca, ao lado do voo agendado; o motor não lê o pino dela', () => {
    const estado = diaSeguinte();
    estado.fixos = { '1001_0_1': { a: 610, b: 670, r: 'PR-VOB', insId: 2, agendado: true } };
    const res = runAllocationEngine(estado);
    const linha = daVolta(res.out);
    assert.deepEqual([linha.fKey, linha.fixo, Object.hasOwn(linha, 'agendado')], ['1000_0_2', true, false]);
    const aprovados = fixosAoAprovar(estado.fixos, res.out);
    assert.deepEqual(Object.keys(aprovados).sort(), res.out.map(o => o.fKey).sort());
    assert.deepEqual([aprovados['1000_0_2'], aprovados['1001_0_1']], [PINO_DA_VOLTA, estado.fixos['1001_0_1']]);
    const aprovada = runAllocationEngine({ ...estado, fixos: aprovados });
    assert.deepEqual(daVolta(aprovada.out), linha);
    assert.deepEqual(aprovada.al.filter(a => a.t === 'conf'), []);
    // Só o pino da volta não muda a escala
    assert.deepEqual(runAllocationEngine({ ...estado, fixos: { ...estado.fixos, '1000_0_2': PINO_DA_VOLTA } }), res);
  });

  it('o status, a reabertura e a Demanda (semAgendados e a demanda limpa) tratam a volta como antes', () => {
    const estado = diaSeguinte();
    const res = runAllocationEngine(estado);
    const linha = daVolta(res.out);
    // O status de andamento fixa a volta; Confirmado a solta fora da escala aprovada
    const emVoo = fixosAoMudarStatus({}, linha, 'Em Voo', { aprovada: false });
    assert.deepEqual(emVoo, { '1000_0_2': PINO_DA_VOLTA });
    assert.deepEqual(fixosAoMudarStatus(emVoo, linha, 'Confirmado', { aprovada: false }), {});
    // O pedido do aluno mudado não tira o pino da volta; a demanda limpa também não (a volta não é um pedido do dia)
    const aprovados = fixosAoAprovar({}, res.out);
    assert.deepEqual(semAgendados(aprovados, ['1000_0_1', '1000_0_2']), aprovados);
    const limpa = { ...diaSeguinte(), fixos: emVoo, fStatus: { '1000_0_2': 'Em Voo' } };
    assert.deepEqual(limparDemanda(limpa), { ficam: 0, reaberta: false });
    assert.deepEqual([limpa.fixos, limpa.fStatus], [emVoo, { '1000_0_2': 'Em Voo' }]);
    // Reabrir (também a demanda limpa, que reabre a escala aprovada): a volta sai com os outros fixos pela aprovação,
    // menos com um status que fixa
    assert.equal(Object.hasOwn(fixosAoReabrir(aprovados, {}), '1000_0_2'), false);
    assert.deepEqual(fixosAoReabrir(aprovados, { '1000_0_2': 'Pousou' }), { '1000_0_2': PINO_DA_VOLTA });
    for (const [fStatus, fixos] of [[{}, {}], [{ '1000_0_2': 'Pousou' }, { '1000_0_2': PINO_DA_VOLTA }]]) {
      const reaberta = { ...diaSeguinte(), fixos: aprovados, fStatus, aprovacao: { em: '2026-11-10T21:05:00.000Z', por: '' } };
      limparDemanda(reaberta);
      assert.deepEqual(reaberta.fixos, fixos, JSON.stringify(fStatus));
    }
    assert.equal(motivoDoFixo('1000_0_2', { fStatus: {}, aprovacao: null, voo: linha, fixos: aprovados }), 'Voo fixo');
  });
});

// O voo agendado na Escala no motor. Ele entra depois dos outros voos fixos (pelo status, pela escala aprovada e pelo
// instrutor escolhido): o que ele gasta é conferido contra eles, e o conflito fica nele, nunca no voo que já estava fixo.
// As regras que o motor segue sozinho e não confere nos fixos (os horários de decolagem, o pouso até as 17:30, o máximo
// de voos locais no horário, o Ground antes do voo) e o peso que falta viram avisos dele, com a chave do voo. A turma
// fixa fora das janelas não invalida a escala gravada
describe('Voos agendados no motor', () => {
  const agendado = (a, b, r, insId, extra = {}) => ({ a, b, r, insId, agendado: true, ...extra });
  const instrutores = n => Array.from({ length: n }, (_, i) => instrutor(i + 1, 9));
  const daChave = (out, fKey) => out.find(o => o.fKey === fKey);
  const semMarca = ({ agendado: _, ...p }) => p;
  const avisosDe = (al, ...codigos) => al.filter(a => a.t === 'warn' && codigos.includes(a.codigo));

  it('no avião e no horário de um voo aprovado: o conflito fica no agendado (Conflito no voo agendado), e o aprovado não muda', () => {
    // O Aluno 1001, de prioridade maior, agendado no avião e no horário do voo aprovado do Aluno 1000, com o outro instrutor
    const base = cenario({ ins: instrutores(2), stu: [aluno(1000, { p1: 390, p2: -1, pr: 3 }), aluno(1001, { p1: 500, p2: -1, pr: 5 })] });
    const antes = runAllocationEngine(base);
    const aprovado = doAluno(antes.out, 1000);
    const fixos = { ...fixarTudo(antes.out), '1001_0_1': agendado(aprovado.a, aprovado.b, aprovado.r, aprovado.insId === 1 ? 2 : 1) };
    const { out, al } = runAllocationEngine({ ...base, fixos });
    assert.deepEqual(pino(doAluno(out, 1000)), pino(aprovado));
    assert.deepEqual([doAluno(out, 1000).conflito, doAluno(out, 1001).conflitoCodigos, doAluno(out, 1001).agendado], [undefined, ['aviao-ocupado'], true]);
    assert.deepEqual(al, [{ t: 'conf', s: 'Aluno 1001', fKey: '1001_0_1', m: 'Conflito no voo agendado: o avião já está ocupado neste horário.' }]);
    // O mesmo voo fixo sem a marca entra pela prioridade, antes do aprovado: o conflito ia para o voo aprovado
    const comoFixo = runAllocationEngine({ ...base, fixos: { ...fixos, '1001_0_1': semMarca(fixos['1001_0_1']) } });
    assert.deepEqual([doAluno(comoFixo.out, 1000).conflitoCodigos, doAluno(comoFixo.out, 1001).conflito], [['aviao-ocupado'], undefined]);
    assert.deepEqual(comoFixo.al, [{ t: 'conf', s: 'Aluno 1000', fKey: '1000_0_1', m: 'Conflito na escala aprovada: o avião já está ocupado neste horário.' }]);
  });

  it('o saldo até a revisão de 50 horas fica com o voo aprovado: o agendado que passaria dela leva o conflito', () => {
    // O PR-VOB tem 1h30 até a revisão: o voo aprovado das 06:30 usa 1 h, e o agendado das 10:10 (prioridade maior) não cabe
    const base = cenario({ ins: instrutores(2), stu: [aluno(1000, { p1: 390, p2: -1, pr: 3 }), aluno(1001, { p1: 610, p2: -1, pr: 5 })], horas: { 'PR-VOB': 48.5 } });
    const fixos = { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 }, '1001_0_1': agendado(610, 670, 'PR-VOB', 2) };
    const { out, al } = runAllocationEngine({ ...base, fixos });
    assert.deepEqual([doAluno(out, 1000).conflito, doAluno(out, 1001).conflitoCodigos], [undefined, ['revisao']]);
    assert.deepEqual(al.filter(a => a.t === 'conf'), [{ t: 'conf', s: 'Aluno 1001', fKey: '1001_0_1', m: 'Conflito no voo agendado: o avião passaria da revisão de 50 horas.' }]);
    const comoFixo = runAllocationEngine({ ...base, fixos: { ...fixos, '1001_0_1': semMarca(fixos['1001_0_1']) } });
    assert.deepEqual([doAluno(comoFixo.out, 1000).conflitoCodigos, doAluno(comoFixo.out, 1001).conflito], [['revisao'], undefined]);
  });

  it('o instrutor, o aluno, a sala de Ground e a lei: o que o voo aprovado já usa fica com ele', () => {
    const casos = [
      ['o instrutor', [aluno(1000, { p1: 390, p2: -1, pr: 1 }), aluno(1001, { p1: 390, p2: -1, pr: 5 })],
        { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } }, ['1001_0_1', agendado(390, 450, 'PR-VOC', 1)], {}, ['instrutor-ocupado']],
      ['o aluno (outra missão dele)', [aluno(1000, { p1: 390, p2: -1, pr: 1 }, { extra: [missaoExtra(1, { p1: 390, p2: -1, pr: 5 })] })],
        { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } }, ['1000_1_1', agendado(390, 450, 'PR-VOC', 2)], {}, ['aluno-ocupado']],
      ['a sala de Ground', [aluno(1000, { ...GROUND_C152, p1: 390, p2: -1, pr: 1 }), aluno(1001, { mis: 'Ground C172', eq: 'Sala Ground', nb: 1.5, p1: 390, p2: -1, pr: 5 })],
        { '1000_0_1': { a: 390, b: 480, r: 'SALA-GROUND', insId: 1, classKey: 'GND_Ground C152_0_1' } }, ['1001_0_1', agendado(390, 480, 'SALA-GROUND', 2)], {}, ['sala-ocupada']],
      // O Instrutor 01 tem 98h30 no mês: o voo aprovado chega a 99h30, e o agendado passaria das 100 h
      ['a lei (as horas do mês)', [aluno(1000, { p1: 390, p2: -1, pr: 1 }), aluno(1001, { p1: 610, p2: -1, pr: 5 })],
        { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } }, ['1001_0_1', agendado(610, 670, 'PR-VOC', 1)],
        { horasDosInstrutores: { 1: { mes: 98.5, semestre: 0, ano: 0, fimAnterior: null } } }, ['limite-da-lei']]
    ];
    for (const [rotulo, stu, aprovados, [chave, pinoAgendado], extra, codigos] of casos) {
      const estado = { ...cenario({ ins: instrutores(2), stu }), ...extra, fixos: { ...aprovados, [chave]: pinoAgendado } };
      const { out, al } = runAllocationEngine(estado);
      const [aprovado] = Object.keys(aprovados);
      assert.deepEqual([daChave(out, aprovado).conflito, daChave(out, chave).conflitoCodigos], [undefined, codigos], rotulo);
      assert.match(al.find(a => a.t === 'conf').m, /^Conflito no voo agendado: /, rotulo);
      // Sem a marca, o pedido de prioridade maior entrava antes e tirava o lugar do voo aprovado
      const comoFixo = runAllocationEngine({ ...estado, fixos: { ...aprovados, [chave]: semMarca(pinoAgendado) } });
      assert.deepEqual([daChave(comoFixo.out, aprovado).conflitoCodigos, daChave(comoFixo.out, chave).conflito], [codigos, undefined], `${rotulo}, sem a marca`);
    }
  });

  it('o fixo pelo instrutor escolhido na Escala (#38) e o fixo pelo status também ficam com o lugar; o agendado com o instrutor escolhido entra com os agendados', () => {
    // O Aluno 1001, de prioridade maior e com o instrutor escolhido no pedido (o agendamento escolhe o instrutor), agendado
    // no avião e no horário do voo do Aluno 1000, fixo pela escolha do instrutor na Escala ou pelo status
    const base = cenario({ ins: instrutores(2), stu: [aluno(1000, { p1: 390, p2: -1, pr: 1, insId: 1 }), aluno(1001, { p1: 390, p2: -1, pr: 5, insId: 2 })] });
    const doAgendado = agendado(390, 450, 'PR-VOB', 2);
    const casos = [
      ['o escolhido', { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1, escolhido: true }, '1001_0_1': doAgendado }, {}],
      ['o Em Voo', { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 }, '1001_0_1': doAgendado }, { '1000_0_1': 'Em Voo' }],
      ['o agendado também escolhido', { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1, escolhido: true }, '1001_0_1': { ...doAgendado, escolhido: true } }, {}]
    ];
    for (const [rotulo, fixos, fStatus] of casos) {
      const { out, al } = runAllocationEngine({ ...base, fixos, fStatus });
      assert.deepEqual([doAluno(out, 1000).conflito, doAluno(out, 1000).insEscolhido, doAluno(out, 1001).conflitoCodigos, doAluno(out, 1001).insEscolhido],
        [undefined, true, ['aviao-ocupado'], true], rotulo);
      assert.deepEqual(al, [{ t: 'conf', s: 'Aluno 1001', fKey: '1001_0_1', m: 'Conflito no voo agendado: o avião já está ocupado neste horário.' }], rotulo);
    }
  });

  it('fora dos horários de decolagem: o do avião, o Noturno às 17:30, o Voo Solo às 06:30 e o Ground fora dos horários da Sala Ground', () => {
    const casos = [
      [{}, agendado(420, 480, 'PR-VOB', 1), 'Agendado às 07:00, fora dos horários de decolagem do C152.'],
      [{ mis: 'Noturno', eq: 'C172', nb: 4, p1: 1050 }, agendado(1020, 1260, 'PR-HAR', 1), 'Agendado às 17:00: o Noturno sai às 17:30.'],
      [{ mis: 'Voo Solo' }, agendado(500, 560, 'PR-VOB', 1), 'Agendado às 08:20: o Voo Solo sai às 06:30.'],
      [GROUND_C152, agendado(420, 510, 'SALA-GROUND', 1), 'Agendado às 07:00, fora dos horários de decolagem da Sala Ground.'],
      [{ mis: 'Simulador', eq: 'Sim. Mono' }, agendado(420, 480, 'SIM-MONO-A', 1), 'Agendado às 07:00, fora dos horários de decolagem do Sim. Mono.']
    ];
    for (const [pedido, pinoAgendado, m] of casos) {
      const estado = { ...cenario({ ins: instrutores(1), stu: [aluno(1000, { p1: 390, p2: -1, ...pedido })] }), fixos: { '1000_0_1': pinoAgendado } };
      const resultado = runAllocationEngine(estado);
      assert.deepEqual(resultado.al, [{ t: 'warn', s: 'Aluno 1000', fKey: '1000_0_1', m, codigo: 'fora-dos-horarios', stuId: 1000 }], m);
      assert.deepEqual([resultado.out[0].conflito, resultado.out[0].agendado], [undefined, true], m);
      assert.deepEqual(normalizarEscalaGravada(resultado), resultado, `${m}: a escala gravada`);
      // O mesmo voo fixo sem a marca (pela aprovação): nenhum aviso, como antes
      assert.deepEqual(runAllocationEngine({ ...estado, fixos: { '1000_0_1': semMarca(pinoAgendado) } }).al, [], `${m}, sem a marca`);
    }
    // Nos horários da missão, nenhum aviso
    const nasJanelas = { ...cenario({ ins: instrutores(1), stu: [aluno(1000, { ...GROUND_C152, p1: 390, p2: -1 })] }), fixos: { '1000_0_1': agendado(500, 590, 'SALA-GROUND', 1) } };
    assert.deepEqual(runAllocationEngine(nasJanelas).al, []);
  });

  it('depois das 17:30: o voo de dia no avião, e as outras missões do aluno que tem o Noturno no dia', () => {
    const doDia = { ...cenario({ ins: instrutores(1), stu: [aluno(1000, { p1: 390, p2: -1, nb: 2 })] }), fixos: { '1000_0_1': agendado(980, 1100, 'PR-VOB', 1) } };
    assert.deepEqual(runAllocationEngine(doDia).al, [{ t: 'warn', s: 'Aluno 1000', fKey: '1000_0_1', m: 'Agendado até as 18:20: o voo de dia pousa até as 17:30.', codigo: 'depois-das-17h30', stuId: 1000 }]);
    // O Ground das 16:20 vai até as 17:50: sem o Noturno, a aula pode passar das 17:30; com ele, não
    const ground = (extra = []) => ({ ...cenario({ ins: instrutores(2), stu: [aluno(1000, { ...GROUND_C152, p1: 980, p2: -1 }, { extra })] }), fixos: { '1000_0_1': agendado(980, 1070, 'SALA-GROUND', 1) } });
    assert.deepEqual(runAllocationEngine(ground()).al, []);
    assert.deepEqual(avisosDe(runAllocationEngine(ground([missaoExtra(1, { mis: 'Noturno', eq: 'C172', nb: 4, p1: 1050, p2: -1 })])).al, ...CODIGOS_DO_AGENDADO), [
      { t: 'warn', s: 'Aluno 1000', fKey: '1000_0_1', m: 'Agendado até as 17:50: com o Noturno no dia, o aluno termina as outras missões até as 17:30.', codigo: 'depois-das-17h30', stuId: 1000 }
    ]);
    // O Noturno agendado às 17:30 vai até as 21:30, como sempre: nenhum aviso
    const noturno = { ...cenario({ ins: instrutores(1), stu: [aluno(1000, { mis: 'Noturno', eq: 'C172', nb: 4, p1: 1050, p2: -1 })] }), fixos: { '1000_0_1': agendado(1050, 1290, 'PR-HAR', 1) } };
    assert.deepEqual(runAllocationEngine(noturno).al, []);
  });

  it('o 7º voo local no mesmo horário: o agendado avisa (os seis aprovados ficam como estão); outro horário e o voo não local, não', () => {
    const regs = ['PP-LJV', 'PR-BTB', 'PR-IGU', 'PR-MLB', 'PR-TBT', 'PR-THI', 'PR-VOB'];
    const dia = (pedido7 = {}, pino7 = {}) => {
      const stu = regs.map((r, i) => aluno(1000 + i, { p1: 500, p2: -1, ...(i === 6 ? pedido7 : {}) }));
      const fixos = Object.fromEntries(stu.map((s, i) => [`${s.id}_0_1`, { a: 500, b: 560, r: regs[i], insId: i + 1, ...(i === 6 ? { agendado: true, ...pino7 } : {}) }]));
      return { ...cenario({ ins: instrutores(7), stu }), fixos };
    };
    const { out, al } = runAllocationEngine(dia());
    assert.deepEqual(al, [{ t: 'warn', s: 'Aluno 1006', fKey: '1006_0_1', m: 'Agendado às 08:20 como o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.', codigo: 'limite-de-locais', stuId: 1006 }]);
    assert.ok(out.every(o => !o.conflito));
    assert.deepEqual(runAllocationEngine(dia({ mis: 'Navegação' })).al, [], 'a navegação não é um voo local');
    assert.deepEqual(runAllocationEngine(dia({ p1: 610 }, { a: 610, b: 670 })).al, [], 'às 10:10, o 1º local do horário');
    // O voo do 7º local fixo pela aprovação (sem a marca) fica como antes, sem aviso
    assert.deepEqual(runAllocationEngine({ ...dia(), fixos: { ...dia().fixos, '1006_0_1': semMarca(dia().fixos['1006_0_1']) } }).al, []);
  });

  it('o Ground antes do voo: o voo agendado antes do fim do Ground fixo do aluno, e o Ground agendado depois do início do voo fixo', () => {
    // O Ground C152 aprovado às 08:20 e o voo de C152 agendado às 06:30
    const vooAntes = { ...cenario({ ins: instrutores(2), stu: [aluno(1000, { ...GROUND_C152, p1: 500, p2: -1 }, { extra: [missaoExtra(1, { p1: 390, p2: -1 })] })] }),
      fixos: { '1000_0_1': { a: 500, b: 590, r: 'SALA-GROUND', insId: 1 }, '1000_1_1': agendado(390, 450, 'PR-VOB', 2) } };
    assert.deepEqual(runAllocationEngine(vooAntes).al, [{ t: 'warn', s: 'Aluno 1000 (Voo Local)', fKey: '1000_1_1', m: 'Agendado às 06:30, antes do fim do Ground C152 do aluno (09:50): o Ground vem antes do voo.', codigo: 'antes-do-ground', stuId: 1000 }]);
    // O voo de C152 aprovado às 06:30 e o Ground C152 agendado às 08:20
    const groundDepois = { ...cenario({ ins: instrutores(2), stu: [aluno(1000, { p1: 390, p2: -1 }, { extra: [missaoExtra(1, { ...GROUND_C152, p1: 500, p2: -1 })] })] }),
      fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 }, '1000_1_1': agendado(500, 590, 'SALA-GROUND', 2) } };
    assert.deepEqual(runAllocationEngine(groundDepois).al, [{ t: 'warn', s: 'Aluno 1000 (Ground C152)', fKey: '1000_1_1', m: 'Agendado até as 09:50, depois do início do Voo Local do aluno (06:30): o Ground vem antes do voo.', codigo: 'antes-do-ground', stuId: 1000 }]);
    // Na ordem certa, ou com um Ground que não vem antes deste voo (o Ground C172 e o voo de C152), nenhum aviso; os dois
    // fixos só pela aprovação, também nenhum
    assert.deepEqual(runAllocationEngine({ ...vooAntes, fixos: { ...vooAntes.fixos, '1000_1_1': agendado(610, 670, 'PR-VOB', 2) } }).al, []);
    const outroGround = structuredClone(vooAntes);
    outroGround.stu[0].mis = 'Ground C172';
    assert.deepEqual(runAllocationEngine(outroGround).al, []);
    assert.deepEqual(runAllocationEngine({ ...vooAntes, fixos: { ...vooAntes.fixos, '1000_1_1': semMarca(vooAntes.fixos['1000_1_1']) } }).al, []);
    // A fronteira: o PA-34 sai de 30 em 30 min, e o voo das 08:00 começa quando o Ground PA-34 das 06:30 termina (sem
    // aviso; o das 07:30, antes dele, avisa). Do outro lado, o Ground agendado que termina quando o voo fixo começa
    const GROUND_PA34 = { mis: 'Ground PA-34', eq: 'Sala Ground', nb: 1.5 }, MLTE = { mis: 'Multimotor', eq: 'PA-34' };
    const fronteira = inicio => ({ ...cenario({ ins: instrutores(2), stu: [aluno(1000, { ...GROUND_PA34, p1: 390, p2: -1 }, { extra: [missaoExtra(1, { ...MLTE, p1: inicio, p2: -1 })] })] }),
      fixos: { '1000_0_1': { a: 390, b: 480, r: 'SALA-GROUND', insId: 1 }, '1000_1_1': agendado(inicio, inicio + 60, 'PT-JOB', 2) } });
    assert.deepEqual(runAllocationEngine(fronteira(480)).al, []);
    assert.deepEqual(avisosDe(runAllocationEngine(fronteira(450)).al, 'antes-do-ground').map(a => a.m), ['Agendado às 07:30, antes do fim do Ground PA-34 do aluno (08:00): o Ground vem antes do voo.']);
    const groundNaFronteira = { ...cenario({ ins: instrutores(2), stu: [aluno(1000, { ...MLTE, p1: 480, p2: -1 }, { extra: [missaoExtra(1, { ...GROUND_PA34, p1: 390, p2: -1 })] })] }),
      fixos: { '1000_0_1': { a: 480, b: 540, r: 'PT-JOB', insId: 1 }, '1000_1_1': agendado(390, 480, 'SALA-GROUND', 2) } };
    assert.deepEqual(runAllocationEngine(groundNaFronteira).al, []);
    // O Ground cancelado não conta
    assert.deepEqual(runAllocationEngine({ ...vooAntes, fStatus: { '1000_0_1': 'Cancelado' } }).al, []);
    // Por cima um do outro (o aluno em dois lugares é o conflito; a ordem, o aviso): o voo agendado no começo do Ground,
    // e o Ground agendado no começo do voo de 2 h, que termina depois dele
    const juntos = runAllocationEngine({ ...vooAntes, fixos: { ...vooAntes.fixos, '1000_1_1': agendado(500, 560, 'PR-VOB', 2) } });
    assert.deepEqual([daChave(juntos.out, '1000_1_1').conflitoCodigos, avisosDe(juntos.al, 'antes-do-ground').map(a => a.m)],
      [['aluno-ocupado'], ['Agendado às 08:20, antes do fim do Ground C152 do aluno (09:50): o Ground vem antes do voo.']]);
    const vooLongo = structuredClone(groundDepois);
    vooLongo.stu[0].nb = 2;
    vooLongo.fixos = { '1000_0_1': { a: 390, b: 510, r: 'PR-VOB', insId: 1 }, '1000_1_1': agendado(390, 480, 'SALA-GROUND', 2) };
    const grounds = runAllocationEngine(vooLongo);
    assert.deepEqual([daChave(grounds.out, '1000_1_1').conflitoCodigos, avisosDe(grounds.al, 'antes-do-ground').map(a => a.m)],
      [['aluno-ocupado'], ['Agendado até as 08:00, depois do início do Voo Local do aluno (06:30): o Ground vem antes do voo.']]);
  });

  it('a volta do noturno de ontem não depende do Ground de hoje: o Ground agendado depois dela não avisa, e a volta fica como era', () => {
    const volta = { stuId: 1000, mid: 0, insId: 1, r: 'PR-HAR', eqType: 'C172', s: 'Aluno 1000', ins: 'Instrutor 01', stuKg: 70, fim: 1290 };
    const estado = cenario({ ins: instrutores(2), stu: [aluno(1000, { mis: 'Ground C172', eq: 'Sala Ground', nb: 1.5, p1: 610, p2: -1 })] });
    estado.noturnosDaVespera = [volta];
    estado.horasDosInstrutores = comRepousoDoNoturno({ 1: { mes: 0, semestre: 0, ano: 0, fimAnterior: 1290 } }, [volta]);
    const semAgendado = runAllocationEngine(estado);
    const comAgendado = runAllocationEngine({ ...estado, fixos: { '1000_0_1': agendado(610, 700, 'SALA-GROUND', 2) } });
    assert.deepEqual(comAgendado.al.map(a => a.codigo), ['repouso-do-noturno']);
    assert.deepEqual(comAgendado.out.find(o => o.trecho), semAgendado.out.find(o => o.trecho));
    assert.deepEqual(daChave(comAgendado.out, '1000_0_1').conflito, undefined);
  });

  it('o peso que falta: só no voo agendado em avião (com a chave do voo); o fixo pela aprovação, o Ground e o simulador não avisam', () => {
    const estado = cenario({
      ins: [instrutor(1, 9, { kg: 0 }), instrutor(2, 9)],
      stu: [aluno(1000, { p1: 390, p2: -1 }, { kg: 0 }), aluno(1001, { p1: 500, p2: -1 }, { kg: 0 }), aluno(1002, { p1: 610, p2: -1 })]
    });
    const fixos = { '1000_0_1': agendado(390, 450, 'PR-VOB', 2), '1001_0_1': agendado(500, 560, 'PR-VOB', 1), '1002_0_1': agendado(610, 670, 'PR-VOB', 1) };
    const resultado = runAllocationEngine({ ...estado, fixos });
    const texto = quem => `${quem} (0 kg): verificação de limite (170 kg) no C152 não realizada.`;
    assert.deepEqual(resultado.al, [
      { t: 'warn', s: 'Aluno 1000', fKey: '1000_0_1', m: texto('Peso do aluno não informado'), codigo: 'sem-peso', stuId: 1000 },
      { t: 'warn', s: 'Aluno 1001', fKey: '1001_0_1', m: texto('Pesos do aluno e de Instrutor 01 não informados'), codigo: 'sem-peso', stuId: 1001, insId: 1 },
      { t: 'warn', s: 'Aluno 1002', fKey: '1002_0_1', m: texto('Peso de Instrutor 01 não informado'), codigo: 'sem-peso', insId: 1 }
    ]);
    assert.deepEqual(normalizarEscalaGravada(resultado), resultado);
    // Os mesmos voos fixos pela aprovação: nenhum aviso, como antes
    assert.deepEqual(runAllocationEngine({ ...estado, fixos: Object.fromEntries(Object.entries(fixos).map(([k, p]) => [k, semMarca(p)])) }).al, []);
    // O Ground e o simulador agendados não têm limite de peso
    const semLimite = cenario({ ins: [instrutor(1, 9, { kg: 0 })], stu: [aluno(1000, { ...GROUND_C152, p1: 390, p2: -1 }, { kg: 0 }), aluno(1001, { mis: 'Simulador', eq: 'Sim. Mono', p1: 610, p2: -1 }, { kg: 0 })] });
    assert.deepEqual(runAllocationEngine({ ...semLimite, fixos: { '1000_0_1': agendado(390, 480, 'SALA-GROUND', 1), '1001_0_1': agendado(610, 670, 'SIM-MONO-A', 1) } }).al, []);
  });

  it('o agendado cancelado, em andamento ou que mudou de tipo não avisa; Pendente e Confirmado avisam', () => {
    // Às 07:00 (fora dos horários do C152), até as 18:20 (depois das 17:30) e sem o peso do aluno
    const estado = (pedido = {}, fStatus = {}, fObs = {}) => ({
      ...cenario({ ins: instrutores(2), stu: [aluno(1000, { p1: 390, p2: -1, nb: 2, ...pedido }, { kg: 0 }), aluno(1001, { p1: 980, p2: -1, nb: 2 }, { kg: 0 })] }),
      fixos: { '1000_0_1': agendado(420, 540, 'PR-VOB', 1), '1001_0_1': agendado(980, 1100, 'PR-VOC', 2) }, fStatus, fObs
    });
    const codigos = r => r.al.filter(a => a.t === 'warn').map(a => `${a.fKey}:${a.codigo}`);
    const todos = ['1000_0_1:fora-dos-horarios', '1000_0_1:sem-peso', '1001_0_1:depois-das-17h30', '1001_0_1:sem-peso'];
    assert.deepEqual(codigos(runAllocationEngine(estado())), todos);
    for (const status of ['Pendente', 'Confirmado']) {
      assert.deepEqual(codigos(runAllocationEngine(estado({}, { '1000_0_1': status, '1001_0_1': status }))), todos, status);
    }
    for (const status of ['Em Voo', 'Pousou', 'Cancelado']) {
      assert.deepEqual(codigos(runAllocationEngine(estado({}, { '1000_0_1': status, '1001_0_1': status }))), [], status);
    }
    // O atrasado também já saiu (o atraso dele é outro aviso)
    const atrasado = runAllocationEngine(estado({}, { '1000_0_1': 'Atrasado' }, { '1000_0_1': { novoInicio: 450 } }));
    assert.deepEqual(codigos(atrasado), ['1001_0_1:depois-das-17h30', '1001_0_1:sem-peso']);
    // O pedido que passou para Ground com o voo fixo num avião: só o conflito
    const mudou = runAllocationEngine(estado(GROUND_C152));
    assert.deepEqual(daChave(mudou.out, '1000_0_1').conflitoCodigos, ['ground-ou-voo']);
    assert.deepEqual(codigos(mudou), ['1001_0_1:depois-das-17h30', '1001_0_1:sem-peso']);
  });

  it('a turma de Ground fixa fora das janelas: o colega que entra nela fica no período dela, e a escala gravada vale', () => {
    // A turma fixa às 07:00 (aprovada ou agendada) e um colega do mesmo Ground, escalado pelo motor
    for (const marca of [{}, { agendado: true }]) {
      const estado = {
        ...cenario({ ins: instrutores(1), stu: [aluno(1000, { ...GROUND_C152, p1: 390, p2: -1 }), aluno(1001, { ...GROUND_C152, p1: 390, p2: -1 })] }),
        fixos: { '1000_0_1': { a: 420, b: 510, r: 'SALA-GROUND', insId: 1, ...marca } }
      };
      const resultado = runAllocationEngine(estado);
      const [fixo, colega] = [doAluno(resultado.out, 1000), doAluno(resultado.out, 1001)];
      assert.deepEqual([colega.classKey, colega.a, colega.b, colega.w, colega.fixo], [fixo.classKey, 420, 510, 0, undefined], JSON.stringify(marca));
      assert.equal(fixo.w, 0);
      // As 07:00 não são preferência do colega (ele não tem a 2ª): horário livre, não a 2ª preferência
      assert.deepEqual([colega.baseTag, colega.tag], ['Próximo livre', 'Próximo livre · Turma (2)'], JSON.stringify(marca));
      assert.deepEqual(normalizarEscalaGravada(resultado), resultado, JSON.stringify(marca));
    }
    // Entre as turmas abertas, a das 07:00 não passa na frente como se fosse a 2ª preferência do colega (sem a 2ª): ele
    // fica na turma das 10:10, que abriu antes (o aluno dela vem antes na demanda), e no horário livre
    const duasTurmas = {
      ...cenario({ ins: instrutores(2), stu: [aluno(1002, { ...GROUND_C152, p1: 610, p2: -1 }), aluno(1000, { ...GROUND_C152, p1: 610, p2: -1 }), aluno(1001, { ...GROUND_C152, p1: 870, p2: -1 })] }),
      fixos: { '1002_0_1': { a: 610, b: 700, r: 'SALA-GROUND', insId: 2, classKey: 'GND_Ground C152_2_2' }, '1000_0_1': { a: 420, b: 510, r: 'SALA-GROUND', insId: 1 } }
    };
    const colega = doAluno(runAllocationEngine(duasTurmas).out, 1001);
    assert.deepEqual([colega.classKey, colega.a, colega.baseTag], ['GND_Ground C152_2_2', 610, 'Próximo livre']);
  });
});

// "Limpar demanda": cada pedido fica em branco e o voo dele fica solto (sem o voo fixo, o status e o detalhe), seja qual
// for o motivo do cadeado; o voo em andamento ou que já pousou fica como está; a escala aprovada é reaberta
describe('Limpar demanda', () => {
  const PINO = { a: 390, b: 450, r: 'PR-VOB', insId: 1 };
  const APROVACAO = { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' };
  // O aluno com o pedido em branco (e sem as missões extras)
  const emBranco = s => ({ id: s.id, nm: s.nm, kg: s.kg, bl: s.bl, extra: [], ...blank() });

  it('o pedido fica em branco e o voo solto: saem o voo fixo (da aprovação, do instrutor escolhido ou do status), o status e o detalhe', () => {
    const estado = {
      ...cenario({
        stu: [
          aluno(1000, { p1: 390, p2: -1, jan: 'manha', etapa: 'PP-01', cursoDaEtapa: 'PP', solicitacao: 7, insId: 1 }, { extra: [missaoExtra(1, { p1: 610, p2: -1 })] }),
          aluno(1001, { p1: 500, p2: -1 }),
          aluno(1002, { fly: false, p1: 610, p2: -1 })
        ]
      }),
      fixos: { '1000_0_1': { ...PINO, escolhido: true }, '1000_1_1': { ...PINO, a: 610, b: 670 }, '1001_0_1': { ...PINO, a: 500, b: 560 }, '1002_0_1': { ...PINO, a: 610, b: 670, insId: 2 } },
      fStatus: { '1000_0_1': 'Confirmado', '1000_1_1': 'Pendente', '1001_0_1': 'Cancelado', '1002_0_1': 'Cancelado' },
      fObs: { '1001_0_1': { motivo: 'Meteorologia' }, '1002_0_1': { motivo: 'Outro', texto: 'Pista interditada' } },
      aprovacao: APROVACAO
    };
    const alunos = estado.stu.map(s => ({ ...s }));
    assert.deepEqual(limparDemanda(estado), { ficam: 0, reaberta: true });
    assert.deepEqual(estado.stu, alunos.map(emBranco));
    assert.deepEqual([estado.fixos, estado.fStatus, estado.fObs, estado.aprovacao], [{}, {}, {}, null]);
  });

  it('o voo em andamento ou que já pousou (Atrasado, Em Voo, Pousou) fica como está: o pedido, a missão extra, o voo fixo, o status e o detalhe', () => {
    const estado = {
      ...cenario({
        stu: [
          aluno(1000, { p1: 390, p2: -1, jan: 'manha', insId: 1 }, { extra: [missaoExtra(1, { p1: 610, p2: -1 }), missaoExtra(2, { p1: 760, p2: -1, etapa: 'PP-02' })] }),
          aluno(1001, { p1: 500, p2: -1, solicitacao: 9 }),
          aluno(1002, { p1: 610, p2: -1 })
        ]
      }),
      fixos: { '1000_0_1': { ...PINO, escolhido: true }, '1000_1_1': { ...PINO, a: 610, b: 670 }, '1000_2_1': { ...PINO, a: 760, b: 820 }, '1001_0_1': { ...PINO, a: 500, b: 560 }, '1002_0_1': { ...PINO, a: 610, b: 670, insId: 2 } },
      fStatus: { '1000_0_1': 'Em Voo', '1000_1_1': 'Cancelado', '1000_2_1': 'Pousou', '1001_0_1': 'Atrasado', '1002_0_1': 'Confirmado' },
      fObs: { '1000_1_1': { motivo: 'Meteorologia' }, '1001_0_1': { novoInicio: 530 } }
    };
    const antes = structuredClone(estado);
    assert.deepEqual(limparDemanda(estado), { ficam: 3, reaberta: false });
    // O Aluno 1000 fica com o pedido e a missão extra que pousou; a missão extra cancelada sai. O 1001 fica inteiro
    assert.deepEqual(estado.stu, [{ ...antes.stu[0], extra: [antes.stu[0].extra[1]] }, antes.stu[1], emBranco(antes.stu[2])]);
    const sem = (dados, ...chaves) => Object.fromEntries(Object.entries(dados).filter(([fKey]) => !chaves.includes(fKey)));
    assert.deepEqual(estado.fixos, sem(antes.fixos, '1000_1_1', '1002_0_1'));
    assert.deepEqual(estado.fStatus, sem(antes.fStatus, '1000_1_1', '1002_0_1'));
    assert.deepEqual(estado.fObs, { '1001_0_1': { novoInicio: 530 } });
  });

  it('na turma de Ground, o aluno em aula fica na turma, com a sala e o instrutor; os colegas ainda Confirmado são limpos', () => {
    // A turma de três alunos, na escala aprovada: só o 1001 está em aula (cada aluno da turma tem o seu status)
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [1000, 1001, 1002].map(id => aluno(id, { ...GROUND_C152, p1: 390, p2: -1 })) });
    const antes = runAllocationEngine(base);
    assert.equal(new Set(antes.out.map(o => o.classKey)).size, 1, 'uma turma só');
    const estado = { ...structuredClone(base), fixos: fixarTudo(antes.out), fStatus: { '1000_0_1': 'Confirmado', '1001_0_1': 'Em Voo' }, aprovacao: APROVACAO };
    assert.deepEqual(limparDemanda(estado), { ficam: 1, reaberta: true });
    assert.deepEqual([estado.fixos, estado.fStatus], [{ '1001_0_1': pino(doAluno(antes.out, 1001)) }, { '1001_0_1': 'Em Voo' }]);
    assert.deepEqual(estado.stu.map(s => [s.id, s.fly, s.mis]), [[1000, false, 'Voo Local'], [1001, true, 'Ground C152'], [1002, false, 'Voo Local']]);
    // O aluno em aula continua no mesmo lugar, e o colega que volta a pedir o mesmo Ground entra na turma dele
    Object.assign(estado.stu[0], GROUND_C152, { fly: true, p1: 390, p2: -1 });
    const { out } = runAllocationEngine(estado);
    assert.deepEqual(out.map(o => [o.stuId, pino(o), o.fixo, o.status]).sort(), [
      [1000, pino(doAluno(antes.out, 1000)), undefined, 'Confirmado'],
      [1001, pino(doAluno(antes.out, 1001)), true, 'Em Voo']
    ]);
  });

  it('a escala aprovada é reaberta, como em Reabrir: só o voo em andamento continua fixo', () => {
    // O voo fixo que o dia ainda guarda de uma missão extra tirada antes (1000_4_1) não é um pedido: sai como em Reabrir
    const estado = {
      ...cenario({ stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] }),
      fixos: { '1000_0_1': PINO, '1001_0_1': { ...PINO, a: 500, b: 560 }, '1000_4_1': { ...PINO, a: 760, b: 820 } },
      fStatus: { '1000_0_1': 'Pousou' },
      aprovacao: APROVACAO
    };
    assert.deepEqual(limparDemanda(estado), { ficam: 1, reaberta: true });
    assert.deepEqual([estado.fixos, estado.fStatus, estado.aprovacao], [{ '1000_0_1': PINO }, { '1000_0_1': 'Pousou' }, null]);
  });

  it('a volta do noturno de ontem não é um pedido do dia: o status e o detalhe dela ficam', () => {
    const estado = { ...cenario({ stu: [aluno(1000)] }), fStatus: { '1000_0_2': 'Atrasado', '1000_0_1': 'Confirmado' }, fObs: { '1000_0_2': { novoInicio: 480 } } };
    assert.deepEqual(limparDemanda(estado), { ficam: 0, reaberta: false });
    assert.deepEqual([estado.fStatus, estado.fObs], [{ '1000_0_2': 'Atrasado' }, { '1000_0_2': { novoInicio: 480 } }]);
  });

  it('o Voa religado depois da limpeza: o pedido é escalado de novo, solto, sem o status de antes; o voo que pousou continua onde estava', () => {
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1, insId: 2 }), aluno(1001, { p1: 390, p2: -1 }), aluno(1002, { p1: 610, p2: -1 })] });
    const antes = runAllocationEngine(base);
    const estado = {
      ...structuredClone(base),
      fixos: { ...fixarTudo(antes.out), '1000_0_1': { ...pino(doAluno(antes.out, 1000)), escolhido: true } },
      fStatus: { '1001_0_1': 'Cancelado', '1002_0_1': 'Pousou' }, fObs: { '1001_0_1': { motivo: 'Meteorologia' } }, aprovacao: APROVACAO
    };
    limparDemanda(estado);
    estado.stu.forEach(s => { s.fly = true; });
    const { out } = runAllocationEngine(estado);
    // O pedido em branco sai na 1ª preferência dele (08:20), sem o cadeado, sem o instrutor escolhido e Confirmado
    for (const id of [1000, 1001]) {
      const o = doAluno(out, id);
      assert.deepEqual([o.a, o.fixo, o.insEscolhido, o.status], [500, undefined, undefined, 'Confirmado'], `Aluno ${id}`);
    }
    const pousou = doAluno(out, 1002);
    assert.deepEqual([pino(pousou), pousou.fixo, pousou.status], [pino(doAluno(antes.out, 1002)), true, 'Pousou']);
  });

  it('o voo agendado na Escala: o do pedido limpo sai com o pedido; o que já pousou continua agendado, também na escala reaberta', () => {
    // O Aluno 1000 agendado às 10:10 com o Instrutor 02 (o pedido prefere as 06:30 e guarda o instrutor do agendamento);
    // o 1001 agendado às 08:20, que já pousou, e a missão extra dele agendada às 12:40, cancelada
    const POUSOU = { a: 500, b: 560, r: 'PR-VOC', insId: 1, agendado: true };
    const estado = {
      ...cenario({
        ins: [instrutor(1, 9), instrutor(2, 9)],
        stu: [
          aluno(1000, { p1: 390, p2: -1, etapa: 'PP-01', cursoDaEtapa: 'PP', insId: 2 }),
          aluno(1001, { p1: 500, p2: -1, insId: 1 }, { extra: [missaoExtra(1, { p1: 760, p2: -1 })] })
        ]
      }),
      fixos: { '1000_0_1': { a: 610, b: 670, r: 'PR-VOB', insId: 2, agendado: true }, '1001_0_1': POUSOU, '1001_1_1': { ...POUSOU, a: 760, b: 820 } },
      fStatus: { '1001_0_1': 'Pousou', '1001_1_1': 'Cancelado' },
      fObs: { '1001_1_1': { motivo: 'Meteorologia' } },
      aprovacao: APROVACAO
    };
    const pedido1001 = { ...estado.stu[1], extra: [] };
    assert.deepEqual(limparDemanda(estado), { ficam: 1, reaberta: true });
    assert.deepEqual([estado.fixos, estado.fStatus, estado.fObs, estado.aprovacao], [{ '1001_0_1': POUSOU }, { '1001_0_1': 'Pousou' }, {}, null]);
    assert.deepEqual(estado.stu[1], pedido1001);
    assert.deepEqual(['etapa', 'cursoDaEtapa', 'insId'].filter(campo => Object.hasOwn(estado.stu[0], campo)), []);
    // O Voa religado: o pedido em branco sai na 1ª preferência dele (08:20), solto, sem a marca e sem o instrutor do
    // agendamento; o que pousou continua no lugar, agendado
    estado.stu[0].fly = true;
    const { out } = runAllocationEngine(estado);
    const solto = doAluno(out, 1000), pousou = doAluno(out, 1001);
    assert.deepEqual([solto.a, solto.fixo, solto.agendado, solto.insEscolhido, solto.status], [500, undefined, undefined, undefined, 'Confirmado']);
    assert.deepEqual([pino(pousou), pousou.fixo, pousou.agendado, pousou.status], [pino(POUSOU), true, true, 'Pousou']);
    assert.equal(motivoDoFixo('1001_0_1', { fStatus: estado.fStatus, aprovacao: estado.aprovacao, voo: pousou, fixos: estado.fixos }), 'Voo fixo: Pousou');
  });
});
