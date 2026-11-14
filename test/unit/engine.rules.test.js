// Regras operacionais do motor de alocação, conforme o Manual do Usuário (aba 8 · BI).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine, sumUniqueOperationalHours, consolidateTimelineSlots } from '../../js/engine.js';
import { hm } from '../../js/format.js';
import { aluno, apenas, cenario, instrutor, missaoExtra, GROUND_C152 } from '../helpers/montar.js';

// As regras da alocação, sem a compactação que vem depois (fase 13; ela tem os testes dela em compactar.test.js)
const alocar = opts => runAllocationEngine(cenario(opts), { compactar: false });
const resumo = o => ({ s: o.s, w: o.w, tag: o.tag });
const SO_PP_LJV = apenas('C152', 'PP-LJV');

describe('Voos: janelas preferidas e encaixe', () => {
  it('voo local no C152 sai na Pref. 1 com o instrutor habilitado que tem menos habilitações', () => {
    const { out, al, tot } = alocar({ ins: [instrutor(1, 8), instrutor(2, 3), instrutor(3, 1)], stu: [aluno(1000)] });
    assert.equal(tot, 1);
    assert.deepEqual(al, []);
    assert.equal(out.length, 1);
    assert.deepEqual(
      { w: out[0].w, a: out[0].a, b: out[0].b, r: out[0].r, insId: out[0].insId, tag: out[0].tag, h: out[0].h, ss: out[0].ss, kg: out[0].kg, limKg: out[0].limKg, fKey: out[0].fKey, status: out[0].status },
      { w: 1, a: 500, b: 560, r: 'PP-LJV', insId: 3, tag: 'Pref. 1', h: 1, ss: '1/1', kg: 140, limKg: 170, fKey: '1000_0_1', status: 'Confirmado' }
    );
  });

  it('aeronave ocupada leva à Pref. 2 e depois ao próximo horário livre', () => {
    const { out } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1), instrutor(3, 1)],
      stu: [aluno(1000), aluno(1001), aluno(1002)],
      semAeronaves: SO_PP_LJV
    });
    assert.deepEqual(out.map(resumo), [
      { s: 'Aluno 1002', w: 0, tag: 'Próximo livre' },
      { s: 'Aluno 1000', w: 1, tag: 'Pref. 1' },
      { s: 'Aluno 1001', w: 2, tag: 'Pref. 2' }
    ]);
  });

  it('maior prioridade escolhe o horário primeiro', () => {
    const { out } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [aluno(1000, { pr: 2 }), aluno(1001, { pr: 5 })],
      semAeronaves: SO_PP_LJV
    });
    assert.deepEqual(out.map(resumo), [
      { s: 'Aluno 1001', w: 1, tag: 'Pref. 1' },
      { s: 'Aluno 1000', w: 2, tag: 'Pref. 2' }
    ]);
  });

  it('voo diurno não termina depois das 17:30', () => {
    const { out } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, { nb: 4, p1: 6, p2: 7 })] });
    // As preferências (14:30 e 16:10) passariam das 17:30; o horário mais perto da 1ª que cabe (revisão de 14/11)
    assert.deepEqual(out.map(o => [o.w, o.a, o.b, o.tag]), [[4, 760, 1000, 'Próximo livre']]);
  });

  // Revisão de 14/11: um pedido é um voo só, com as horas pedidas (para dividir no dia, "+ missão"); o número de
  // sessões dos dados antigos não conta
  it('um pedido é um voo só, com as horas pedidas', () => {
    const { out } = alocar({ ins: [instrutor(1, 1), instrutor(2, 1)], stu: [aluno(1000, { nb: 3, ss: 2, p1: 0, p2: 2 })] });
    assert.deepEqual(out.map(o => [o.fKey, o.ss, o.a, o.b, o.h, o.tag]), [['1000_0_1', '1/1', 390, 570, 3, 'Pref. 1']]);
  });

  it('o instrutor fica no mesmo avião ao longo do dia', () => {
    const { out } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, { p1: 1, p2: 1 }), aluno(1001, { p1: 2, p2: 2 }), aluno(1002, { p1: 4, p2: 4 })] });
    assert.deepEqual(out.map(o => [o.s, o.w, o.insId, o.r]), [
      ['Aluno 1000', 1, 1, 'PP-LJV'],
      ['Aluno 1001', 2, 1, 'PP-LJV'],
      ['Aluno 1002', 4, 1, 'PP-LJV']
    ]);
  });

  it('o avião do instrutor no dia é por tipo de aeronave', () => {
    const { out } = alocar({
      ins: [instrutor(1, 7)],
      stu: [aluno(1000, { p1: 0, p2: 0 }), aluno(1001, { eq: 'C172', p1: 1, p2: 1 }), aluno(1002, { p1: 2, p2: 2 })]
    });
    assert.deepEqual(out.map(o => [o.s, o.eqType, o.r]), [
      ['Aluno 1000', 'C152', 'PP-LJV'],
      ['Aluno 1001', 'C172', 'PP-ABP'],
      ['Aluno 1002', 'C152', 'PP-LJV']
    ]);
  });

  it('respeita a disponibilidade do instrutor', () => {
    const aw = Array(9).fill(true);
    aw[1] = false;
    const { out } = alocar({ ins: [instrutor(1, 1, { aw })], stu: [aluno(1000)] });
    assert.deepEqual(out.map(resumo), [{ s: 'Aluno 1000', w: 2, tag: 'Pref. 2' }]);
  });

  it('não usa janelas de operação desativadas', () => {
    const { out } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000)], janelasOff: [1] });
    assert.deepEqual(out.map(resumo), [{ s: 'Aluno 1000', w: 2, tag: 'Pref. 2' }]);
  });

  it('preserva o status salvo do voo', () => {
    const { out } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000)], fStatus: { '1000_0_1': 'Em Voo' } });
    assert.equal(out[0].status, 'Em Voo');
  });
});

describe('Habilitações exigidas (os instrutores migrados fazem o mesmo que os níveis A01–A09 permitiam)', () => {
  // [missão, equipamento, nível que bastava antes, habilitações exigidas agora]
  const casos = [
    ['Simulador', 'Sim. Mono', 2, 'Simulador (Mono)'],
    ['Simulador', 'Sim. Multi', 2, 'Simulador (Multi)'],
    ['Voo Local', 'C172', 7, 'Voo Local + C172'],
    ['Voo Local', 'PA-34', 9, 'Voo Local + MLTE (PA-34)'],
    ['Navegação', 'C152', 4, 'Voo de Navegação'],
    ['Voo Solo', 'C152', 5, 'Voo para liberação de Solo'],
    ['Parafuso', 'C152', 6, 'Voo de Parafuso (SPIN)'],
    ['Noturno', 'C172', 7, 'Voo Noturno + C172'],
    ['IFR', 'C172', 8, 'Voo IFR + C172'],
    ['IFR', 'PA-34', 9, 'Voo IFR + MLTE (PA-34)'],
    ['Multimotor', 'PA-34', 9, 'MLTE (PA-34)']
  ];

  for (const [mis, eq, lv, exige] of casos) {
    it(`${mis} em ${eq} exige ${exige}`, () => {
      const noturno = mis === 'Noturno' ? { p1: 8, p2: 8 } : {};
      const pedido = aluno(1000, { mis, eq, ...noturno });

      const abaixo = alocar({ ins: [instrutor(1, lv - 1)], stu: [pedido] });
      assert.equal(abaixo.out.length, 0);
      assert.deepEqual(abaixo.al, [{
        t: 'err', s: 'Aluno 1000',
        m: `Rejeitado: nenhum instrutor ativo tem a habilitação de ${mis} no ${eq} (${exige}).`, codigo: 'sem-instrutor-habilitado'
      }]);

      const habilitado = alocar({ ins: [instrutor(1, lv - 1), instrutor(2, lv)], stu: [pedido] });
      assert.equal(habilitado.out.length, 1);
      assert.equal(habilitado.out[0].insId, 2);
    });
  }

  it('as habilitações não são cumulativas: instrutor de C172 sem simulador, de PA-34 sem parafuso', () => {
    const ins = [instrutor(1, 9, { hab: ['local', 'noturno', 'c172'] }), instrutor(2, 1, { hab: ['sim_mono'] })];
    assert.equal(alocar({ ins, stu: [aluno(1000, { mis: 'Simulador', eq: 'Sim. Mono' })] }).out[0].insId, 2);
    assert.equal(alocar({ ins, stu: [aluno(1000, { mis: 'Noturno', eq: 'C172', p1: 8, p2: 8 })] }).out[0].insId, 1);
    const parafuso = alocar({ ins: [instrutor(1, 9, { hab: ['local', 'mlte'] })], stu: [aluno(1000, { mis: 'Parafuso', eq: 'PA-34' })] });
    assert.deepEqual(parafuso.al.map(a => a.m), ['Rejeitado: nenhum instrutor ativo tem a habilitação de Parafuso no PA-34 (Voo de Parafuso (SPIN) + MLTE (PA-34)).']);
  });

  it('TGL (TMA): só o instrutor com a habilitação TGL (TMA)', () => {
    const ins = [instrutor(1, 1, { hab: ['local'] }), instrutor(2, 1, { hab: ['local', 'tgl'] })];
    assert.equal(alocar({ ins, stu: [aluno(1000, { mis: 'TGL (TMA)', eq: 'C152' })] }).out[0].insId, 2);
  });

  it('voos de cheque vão para o checador credenciado (cheque PC MNTE IFR: checador IFR ou MLTE IFR, nunca o VFR)', () => {
    const ins = [instrutor(1, 9, { hab: ['checador_vfr'] }), instrutor(2, 9, { hab: ['checador_ifr'] }), instrutor(3, 9, { hab: ['checador_mlte'] })];
    const cheque = (mis, eq) => alocar({ ins, stu: [aluno(1000, { mis, eq })] });
    assert.equal(cheque('Cheque PP', 'C152').out[0].insId, 1);
    assert.equal(cheque('Cheque PC MNTE IFR', 'C172').out[0].insId, 2);
    assert.equal(cheque('Cheque PC MLTE IFR', 'PA-34').out[0].insId, 3);
    const semChecador = alocar({ ins: [instrutor(1, 9)], stu: [aluno(1000, { mis: 'Cheque PC MLTE VFR', eq: 'PA-34' })] });
    assert.deepEqual(semChecador.al.map(a => a.m), ['Rejeitado: nenhum instrutor ativo tem a habilitação de Cheque PC MLTE VFR no PA-34 (Checador PP, PC, MLTE, MNTE, INVA, IFR).']);
  });

  it('missão em equipamento não permitido é rejeitada', () => {
    const { out, al } = alocar({ stu: [aluno(1000, { mis: 'IFR', eq: 'C152' })] });
    assert.equal(out.length, 0);
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1000', m: 'Rejeitado: a missão “IFR” só voa em C172 ou PA-34 (o pedido está no C152).', codigo: 'equipamento-da-missao' }]);
  });

  it('instrutor bloqueado pelo aluno não é escalado', () => {
    const ins = [instrutor(1, 1), instrutor(2, 1)];
    assert.equal(alocar({ ins, stu: [aluno(1000, {}, { bl: [1] })] }).out[0].insId, 2);
    assert.deepEqual(alocar({ ins, stu: [aluno(1000, {}, { bl: [1, 2] })] }).al, [
      { t: 'err', s: 'Aluno 1000', m: 'Rejeitado: os instrutores habilitados (Voo Local) e livres estão em “Não escalar com” deste aluno.', codigo: 'bloqueio' }
    ]);
  });

  it('instrutor inativo não é escalado', () => {
    const { out } = alocar({ ins: [instrutor(1, 1, { on: false }), instrutor(2, 1)], stu: [aluno(1000)] });
    assert.equal(out[0].insId, 2);
  });
});

describe('Peso da tripulação', () => {
  it('aluno + instrutor acima do limite, mesmo com o mínimo de combustível, é rejeitado', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 1, { kg: 100 })], stu: [aluno(1000, {}, { kg: 120 })] });
    assert.equal(out.length, 0);
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1000', m: 'Rejeitado: peso aluno + instrutor acima do limite de 170 kg do C152, mesmo com o mínimo de combustível.', codigo: 'peso' }]);
  });

  it('um pouco acima do limite: o voo sai com menos combustível (fase 10)', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 1, { kg: 80 })], stu: [aluno(1000, {}, { kg: 100 })] });
    assert.deepEqual(al, []);
    assert.deepEqual([out[0].kg, out[0].limKg, out[0].comb.reduzirGal], [180, 170, 4]);
  });

  it('escolhe um instrutor mais leve que respeite o limite', () => {
    const { out } = alocar({ ins: [instrutor(1, 1, { kg: 80 }), instrutor(2, 5, { kg: 60 })], stu: [aluno(1000, {}, { kg: 100 })] });
    assert.deepEqual([out[0].insId, out[0].kg, out[0].limKg], [2, 160, 170]);
  });

  it('peso do aluno não informado gera aviso sem bloquear o voo', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, {}, { kg: 0 })] });
    assert.equal(out.length, 1);
    assert.equal(out[0].kg, 0);
    assert.deepEqual(al, [{ t: 'warn', s: 'Aluno 1000', m: 'Peso do aluno não informado (0 kg): verificação de limite (170 kg) no C152 não realizada.' }]);
  });

  // Revisão de 14/11
  it('quando o peso importa, o instrutor com o peso informado vem antes', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 1, { kg: 0 }), instrutor(2, 9)], stu: [aluno(1000)] });
    assert.deepEqual([out[0].insId, al], [2, []]);
  });

  it('o aviso diz de quem é o peso que falta', () => {
    const soInstrutor = alocar({ ins: [instrutor(1, 1, { kg: 0 })], stu: [aluno(1000)] });
    assert.deepEqual(soInstrutor.al, [{ t: 'warn', s: 'Aluno 1000', m: 'Peso de Instrutor 01 não informado (0 kg): verificação de limite (170 kg) no C152 não realizada.' }]);
    const osDois = alocar({ ins: [instrutor(1, 1, { kg: 0 })], stu: [aluno(1000, {}, { kg: 0 })] });
    assert.deepEqual(osDois.al, [{ t: 'warn', s: 'Aluno 1000', m: 'Pesos do aluno e de Instrutor 01 não informados (0 kg): verificação de limite (170 kg) no C152 não realizada.' }]);
  });
});

// Revisão de 14/11 (decisão do Pedro): sem vaga na 1ª nem na 2ª preferência, o horário mais perto da 1ª
describe('O horário mais perto da preferência', () => {
  it('voo: o horário livre mais perto da 1ª preferência, não o primeiro do dia', () => {
    // Um avião e um instrutor; o aluno 1000 (prioridade 5) fica com as 12:40; o 1001 queria as 12:40
    const { out } = alocar({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 760, p2: -1, pr: 5 }), aluno(1001, { p1: 760, p2: -1 })], semAeronaves: SO_PP_LJV });
    const voo = out.find(o => o.stuId === 1001);
    assert.deepEqual([hm(voo.a), voo.baseTag], ['13:40', 'Próximo livre']);
  });

  it('empatados, o mais cedo', () => {
    const { out } = alocar({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 500, p2: -1, pr: 5 }), aluno(1001, { p1: 500, p2: -1 })], semAeronaves: SO_PP_LJV });
    assert.equal(hm(out.find(o => o.stuId === 1001).a), '06:30');
  });

  it('Ground: a turma mais perto da 1ª preferência', () => {
    // A sala está com o Ground PA-34 às 11:30 (prioridade 5); o Ground C152 queria as 11:30: vai para as 13:40 (12:40 e 10:10 cruzam a outra turma), não 06:30
    const { out } = alocar({
      ins: [instrutor(1, 9), instrutor(2, 9)],
      stu: [aluno(1000, { mis: 'Ground PA-34', eq: 'Sala Ground', nb: 1.5, p1: 3, p2: -1, pr: 5 }), aluno(1001, { ...GROUND_C152, p1: 3, p2: -1 })]
    });
    assert.equal(hm(out.find(o => o.stuId === 1001).a), '13:40');
  });
});

describe('Disponibilidade do aluno', () => {
  it('o voo só começa nas janelas da disponibilidade (a preferência fora dela não vale)', () => {
    const { out } = alocar({ stu: [aluno(1000, { p1: 1, p2: 2, jan: 'tarde' })] });
    assert.deepEqual([hm(out[0].a), out[0].tag], ['12:40', 'Próximo livre']);
  });

  it('horário específico: o voo começa só naquele horário', () => {
    const { out } = alocar({ stu: [aluno(1000, { p1: 1, p2: 2, jan: 'h6' })] });
    assert.equal(hm(out[0].a), '14:30');
  });

  it('sem horário possível na disponibilidade, o pedido é rejeitado dizendo por quê', () => {
    const { al } = alocar({ stu: [aluno(1000, { jan: 'tarde' })], janelasOff: [4, 5, 6, 7] });
    assert.deepEqual(al.map(a => a.m), ['Rejeitado: nenhum horário aberto na disponibilidade do aluno (Tarde) comporta 1 h.']);
  });

  it('Ground também respeita a disponibilidade', () => {
    const { out } = alocar({ stu: [aluno(1000, { ...GROUND_C152, p1: 0, p2: 1, jan: 'tarde' })] });
    assert.equal(hm(out[0].a), '12:40');
  });
});

describe('Revisão de 50 horas', () => {
  const ins = [instrutor(1, 1), instrutor(2, 1), instrutor(3, 1)];
  const tresVoos = [aluno(1000, { p1: 1, p2: 1 }), aluno(1001, { p1: 2, p2: 2 }), aluno(1002, { p1: 4, p2: 4 })];

  it('avião sem saldo para o voo não é escalado: o voo vai para outro avião', () => {
    const { out, al } = alocar({ ins, stu: [aluno(1000)], semAeronaves: apenas('C152', 'PP-LJV', 'PR-BTB'), horas: { 'PP-LJV': 49.5 } });
    assert.equal(out[0].r, 'PR-BTB');
    assert.deepEqual(al, [{ t: 'warn', s: 'PP-LJV', m: 'Aeronave parou para revisão de 50 horas: sem saldo para voar hoje (49,5 h desde a última revisão).' }]);
  });

  it('o avião voa até completar as 50 horas e para no meio do dia; os horários seguintes ficam sem esse avião', () => {
    const { out, al, revisao } = alocar({ ins, stu: tresVoos, semAeronaves: SO_PP_LJV, horas: { 'PP-LJV': 48, 'PR-BTB': 10 } });
    assert.deepEqual(out.map(o => [o.s, o.r, hm(o.a)]), [['Aluno 1000', 'PP-LJV', '08:20'], ['Aluno 1001', 'PP-LJV', '10:10']]);
    assert.deepEqual(al, [
      { t: 'err', s: 'Aluno 1002', m: 'Rejeitado: os C152 livres estão sem saldo até a revisão de 50 horas.', codigo: 'revisao' },
      { t: 'warn', s: 'PP-LJV', m: 'Aeronave parou para revisão de 50 horas às 11:10 (50 h desde a última revisão).' }
    ]);
    assert.deepEqual(revisao, {
      'PP-LJV': { inicio: 48, voadas: 2, fim: 50, paraAs: 670 },
      'PR-BTB': { inicio: 10, voadas: 0, fim: 10, paraAs: null }
    }, 'o PR-BTB está em manutenção: tem as horas, mas não voa');
  });

  it('sem as horas informadas não há limite', () => {
    const { out, al, revisao } = alocar({ ins, stu: tresVoos, semAeronaves: SO_PP_LJV });
    assert.equal(out.length, 3);
    assert.deepEqual([al, revisao], [[], {}]);
  });

  it('o voo inteiro precisa caber no saldo do avião', () => {
    const { out, al } = alocar({ ins, stu: [aluno(1000, { nb: 2 })], semAeronaves: SO_PP_LJV, horas: { 'PP-LJV': 49 } });
    assert.equal(out.length, 0, 'só havia saldo para 1 das 2 h');
    assert.equal(al[0].m, 'Rejeitado: os C152 livres estão sem saldo até a revisão de 50 horas.');
  });
});

describe('Rodízio', () => {
  const doC172 = id => instrutor(id, 1, { hab: ['local', 'noturno', 'c172'] });
  const comFilas = (opts, filas) => runAllocationEngine({ ...cenario(opts), filas });
  const voosNoC172 = [aluno(1000, { eq: 'C172', p1: 1, p2: 1 }), aluno(1001, { eq: 'C172', p1: 2, p2: 2 })];

  it('o voo da categoria vai para o primeiro da fila', () => {
    assert.equal(comFilas({ ins: [doC172(1), doC172(2)], stu: [voosNoC172[0]] }, { c172: [2, 1] }).out[0].insId, 2);
    assert.equal(comFilas({ ins: [doC172(1), doC172(2)], stu: [voosNoC172[0]] }, { c172: [1, 2] }).out[0].insId, 1);
  });

  it('no mesmo dia, quem já voou na categoria fica atrás de quem ainda não voou', () => {
    const { out } = comFilas({ ins: [doC172(1), doC172(2)], stu: voosNoC172 }, { c172: [1, 2] });
    assert.deepEqual(out.map(o => [o.s, o.insId]), [['Aluno 1000', 1], ['Aluno 1001', 2]]);
  });

  it('o voo noturno segue a fila do noturno, não a do C172', () => {
    const noturno = aluno(1000, { mis: 'Noturno', eq: 'C172', p1: 8, p2: 8 });
    assert.equal(comFilas({ ins: [doC172(1), doC172(2)], stu: [noturno] }, { c172: [1, 2], noturno: [2, 1] }).out[0].insId, 2);
  });

  it('voos fora das categorias (local no C152) não seguem fila: vai quem tem menos habilitações', () => {
    const ins = [instrutor(1, 1, { hab: ['local', 'c172', 'tgl'] }), instrutor(2, 1, { hab: ['local', 'c172'] })];
    assert.equal(comFilas({ ins, stu: [aluno(1000)] }, { c172: [1, 2] }).out[0].insId, 2);
  });
});

describe('PR-JPL (C152 Acrobat)', () => {
  it('Parafuso no C152 usa exclusivamente o PR-JPL', () => {
    const { out } = alocar({ ins: [instrutor(1, 6)], stu: [aluno(1000, { mis: 'Parafuso' })] });
    assert.equal(out[0].r, 'PR-JPL');
  });

  it('outras missões nunca usam o PR-JPL', () => {
    const { out, al } = alocar({ stu: [aluno(1000)], semAeronaves: apenas('C152', 'PR-JPL') });
    assert.equal(out.length, 0);
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1000', m: 'Rejeitado: nenhum C152 disponível (todos em manutenção).', codigo: 'sem-aviao' }]);
  });

  it('Parafuso no C152 é rejeitado com o PR-JPL em manutenção', () => {
    const { al } = alocar({ stu: [aluno(1000, { mis: 'Parafuso' })], semAeronaves: ['PR-JPL'] });
    assert.deepEqual(al, [{
      t: 'err', s: 'Aluno 1000',
      m: 'Rejeitado: o PR-JPL (só para Parafuso no C152) está em manutenção.', codigo: 'so-parafuso'
    }]);
  });

  it('Parafuso no C172 usa a frota C172', () => {
    const { out } = alocar({ ins: [instrutor(1, 7)], stu: [aluno(1000, { mis: 'Parafuso', eq: 'C172' })] });
    assert.equal(out[0].r, 'PP-ABP');
  });
});

describe('Noturno', () => {
  it('decola somente na janela das 17:30', () => {
    const { out } = alocar({ ins: [instrutor(1, 7)], stu: [aluno(1000, { mis: 'Noturno', eq: 'C172', p1: 8, p2: 8 })] });
    assert.deepEqual(out.map(o => [o.w, o.a, o.b]), [[8, 1050, 1110]]);
  });

  it('é rejeitado com a janela noturna desativada', () => {
    const { al } = alocar({ ins: [instrutor(1, 7)], stu: [aluno(1000, { mis: 'Noturno', eq: 'C172', p1: 8, p2: 8 })], janelasOff: [8] });
    assert.deepEqual(al, [{
      t: 'err', s: 'Aluno 1000',
      m: 'Rejeitado: nenhum horário aberto comporta 1 h a partir das 17:30.', codigo: 'sem-horario'
    }]);
  });
});

describe('Ground School', () => {
  it('o aluno só entra numa turma já aberta se ela começa na disponibilidade dele', () => {
    const manha = [1000, 1001].map(id => aluno(id, { ...GROUND_C152, p1: 390, p2: 500 }));
    const { out } = alocar({ ins: [instrutor(1, 1), instrutor(2, 1)], stu: [...manha, aluno(1002, { ...GROUND_C152, p1: 760, p2: 820, jan: 'tarde' })] });
    assert.equal(hm(out.find(o => o.stuId === 1002).a), '12:40');
  });

  it('forma turma coletiva com um instrutor e conta 1,5 h uma única vez', () => {
    const { out } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [1000, 1001, 1002].map(id => aluno(id, { ...GROUND_C152, p1: 0, p2: 1 }))
    });
    assert.equal(out.length, 3);
    for (const o of out) {
      assert.deepEqual(
        { classKey: o.classKey, insId: o.insId, a: o.a, b: o.b, r: o.r, h: o.h, eqType: o.eqType, groupSize: o.groupSize, tag: o.tag },
        { classKey: 'GND_Ground C152_0_1', insId: 1, a: 390, b: 480, r: 'SALA-GROUND', h: 1.5, eqType: 'Sala Ground', groupSize: 3, tag: 'Pref. 1 · Turma (3)' }
      );
    }
    assert.equal(sumUniqueOperationalHours(out), 1.5);
  });

  it('há uma única sala: turmas de temas diferentes não acontecem ao mesmo tempo', () => {
    const { out } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [aluno(1000, { ...GROUND_C152, p1: 0, p2: 1 }), aluno(1001, { mis: 'Ground PA-34', eq: 'Sala Ground', nb: 1.5, p1: 0, p2: 1 })]
    });
    assert.deepEqual(out.map(o => [o.s, o.mis, o.w, o.tag]), [
      ['Aluno 1000', 'Ground C152', 0, 'Pref. 1'],
      ['Aluno 1001', 'Ground PA-34', 1, 'Pref. 2']
    ]);
  });

  it('aluno que bloqueou o instrutor da turma vai para outro horário (não abre turma paralela)', () => {
    // Cada aluno bloqueou o instrutor do outro: não há instrutor comum para uma turma única às 06:30
    const { out } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [aluno(1000, { ...GROUND_C152, p1: 0, p2: 1 }, { bl: [2] }), aluno(1001, { ...GROUND_C152, p1: 0, p2: 1 }, { bl: [1] })]
    });
    assert.deepEqual(out.map(o => [o.s, o.w, o.insId]), [['Aluno 1000', 0, 1], ['Aluno 1001', 1, 2]]);
  });

  it('é rejeitado quando a sala está ocupada em todos os horários possíveis', () => {
    const { out, al } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [aluno(1000, { ...GROUND_C152, p1: 0, p2: 0 }), aluno(1001, { mis: 'Ground C172', eq: 'Sala Ground', nb: 1.5, p1: 0, p2: 0 })],
      janelasOff: [1, 2, 3, 4, 5, 6, 7, 8]
    });
    assert.deepEqual(out.map(o => o.s), ['Aluno 1000']);
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1001', m: 'Rejeitado: a sala de Ground já está ocupada por outra turma nos horários possíveis.', codigo: 'sala-ocupada' }]);
  });

  it('é ministrado pelo instrutor disponível com menos habilitações', () => {
    const { out } = alocar({ ins: [instrutor(1, 9), instrutor(2, 4), instrutor(3, 1)], stu: [aluno(1000, GROUND_C152)] });
    assert.equal(out[0].insId, 3);
  });

  it('precede o voo da mesma temática e é antecipado para liberar a Pref. 1 do voo', () => {
    const { out, al } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [aluno(1000, GROUND_C152, { extra: [missaoExtra(1001)] })]
    });
    assert.deepEqual(al, []);
    assert.deepEqual(out.map(o => [o.mis, o.w, o.a, o.b, o.tag]), [
      ['Ground C152', 0, 390, 480, 'Próximo livre'],
      ['Voo Local', 1, 500, 560, 'Pref. 1']
    ]);
  });

  it('o voo é rejeitado quando o Ground pré-requisito não pode ser alocado', () => {
    const soNoturno = Array(9).fill(false);
    soNoturno[8] = true;
    const { out, al } = alocar({
      ins: [instrutor(1, 1, { aw: soNoturno })],
      stu: [aluno(1000, GROUND_C152, { extra: [missaoExtra(1001)] })]
    });
    assert.equal(out.length, 0);
    assert.deepEqual(al, [
      { t: 'err', s: 'Aluno 1000', m: 'Rejeitado: nenhum instrutor habilitado está disponível durante as 01h30 nos horários possíveis.', codigo: 'instrutores-indisponiveis' },
      { t: 'err', s: 'Aluno 1000 (Voo Local)', m: 'Rejeitado: o “Ground C152” de hoje, que vem antes deste voo, não entrou na escala.', codigo: 'ground-pendente' }
    ]);
  });

  // Revisão de 14/11
  it('entre duas turmas abertas, a da 1ª preferência vem antes da da 2ª', () => {
    // O 1000 abre a turma das 08:20 (instrutor 1); o 1001, que bloqueou o 1, a das 06:30 (instrutor 2)
    const { out } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [aluno(1000, { ...GROUND_C152, p1: 500, p2: -1 }, { bl: [2] }), aluno(1001, { ...GROUND_C152, p1: 390, p2: -1 }, { bl: [1] }),
        aluno(1002, { ...GROUND_C152, p1: 390, p2: 500 })]
    });
    assert.deepEqual([out.find(o => o.stuId === 1002).a, out.find(o => o.stuId === 1002).baseTag], [390, 'Pref. 1']);
  });

  it('não termina depois das 17:30', () => {
    const { al } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, GROUND_C152)], janelasOff: [0, 1, 2, 3, 4, 5, 6] });
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1000', m: 'Rejeitado: nenhum período aberto comporta 01h30 de Ground até as 17:30.', codigo: 'sem-horario' }]);
  });
});

describe('Horas operacionais e mapa de ocupação', () => {
  const ground = (s, classKey) => ({ s, classKey, fKey: `${s}_0_1`, isGround: true, mis: 'Ground C152', h: 1.5, status: 'Confirmado' });
  const voo = (s, h, status = 'Confirmado') => ({ s, classKey: `${s}_0_1`, fKey: `${s}_0_1`, isGround: false, mis: 'Voo Local', h, status });

  it('soma horas contando cada turma de Ground uma vez e ignorando cancelados', () => {
    const voos = [ground('A', 'T1'), ground('B', 'T1'), ground('C', 'T2'), voo('D', 2), voo('E', 1, 'Cancelado')];
    assert.equal(sumUniqueOperationalHours(voos), 5);
    assert.equal(sumUniqueOperationalHours(voos, o => (o.s === 'D' ? 'Cancelado' : o.status)), 3);
  });

  it('consolida turmas de Ground em uma única barra com a lista de alunos', () => {
    const barras = consolidateTimelineSlots([ground('A', 'T1'), voo('D', 2), ground('B', 'T1')]);
    assert.deepEqual(barras.map(b => b.students), [['A', 'B'], ['D']]);
    assert.equal(barras[0].items.length, 2);
  });
});
