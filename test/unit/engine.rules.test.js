// Regras operacionais do motor de alocação, conforme o Manual (Como a escala é montada).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine, sumUniqueOperationalHours, consolidateTimelineSlots, semAPrioridadeNosMotivos } from '../../js/engine.js';
import { hm } from '../../js/format.js';
import { HORARIOS_INICIAIS } from '../../js/horarios.js';
import { habilitacoesDoNivel } from '../../js/habilitacoes.js';
import { aluno, apenas, cenario, instrutor, missaoExtra, GROUND_C152 } from '../helpers/montar.js';

// As regras da alocação, sem a compactação que vem depois (ela tem os testes dela em compactar.test.js)
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
    // As preferências (14:30 e 16:20) passariam das 17:30; o horário mais perto da 1ª que cabe
    assert.deepEqual(out.map(o => [o.w, o.a, o.b, o.tag]), [[4, 760, 1000, 'Próximo livre']]);
  });

  it('o simulador não depende da luz do dia: pode terminar depois das 17:30', () => {
    const sim = { mis: 'Simulador', eq: 'Sim. Mono', nb: 1.5, p1: 980, p2: -1 };
    const { out, al } = alocar({ ins: [instrutor(1, 9)], stu: [aluno(1000, sim)] });
    assert.deepEqual([out.map(o => [o.eqType, hm(o.a), hm(o.b), o.tag]), al], [[['Sim. Mono', '16:20', '17:50', 'Pref. 1']], []]);
  });

  it('o simulador que passa das 17:30 precisa do instrutor disponível na noite', () => {
    const sim = { mis: 'Simulador', eq: 'Sim. Mono', nb: 1.5, p1: 980, p2: -1 };
    const semNoite = Array(9).fill(true).map((v, k) => k !== 8);
    const { out } = alocar({ ins: [instrutor(1, 9, { aw: semNoite })], stu: [aluno(1000, sim)] });
    assert.deepEqual(out.map(o => [hm(o.a), hm(o.b), o.tag]), [['14:30', '16:00', 'Próximo livre']]);
  });

  it('com o Noturno do aluno no dia (só às 17:30), o simulador e a aula dele terminam antes', () => {
    const noturno = missaoExtra(1, { mis: 'Noturno', eq: 'C172', nb: 1 });
    const sim = { mis: 'Simulador', eq: 'Sim. Mono', nb: 1.5, p1: 980, p2: -1, pr: 5 };
    const comSim = alocar({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, sim, { extra: [noturno] })] });
    assert.deepEqual(comSim.out.map(o => [o.mis, hm(o.a), hm(o.b)]), [['Simulador', '14:30', '16:00'], ['Noturno', '17:30', '21:30']]);
    const comAula = alocar({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, GROUND_C152, { extra: [noturno] })], janelasOff: [0, 1, 2, 3, 4, 5] });
    assert.deepEqual(comAula.out.map(o => [o.mis, hm(o.a), hm(o.b)]), [['Ground C152', '14:30', '16:00'], ['Noturno', '17:30', '21:30']]);
  });

  it('com o Noturno no dia, o aluno não entra na turma de Ground das 16:20 (termina depois das 17:30)', () => {
    const noturno = missaoExtra(1, { mis: 'Noturno', eq: 'C172', nb: 1 });
    const { out } = alocar({
      ins: [instrutor(1, 9), instrutor(2, 9)],
      stu: [aluno(1000, { ...GROUND_C152, p1: 980, p2: -1, pr: 5 }), aluno(1001, { ...GROUND_C152, p1: 980, p2: -1 }, { extra: [noturno] })]
    });
    assert.deepEqual(out.filter(o => o.stuId === 1001).map(o => [o.mis, hm(o.a), hm(o.b)]), [['Ground C152', '14:30', '16:00'], ['Noturno', '17:30', '21:30']]);
  });

  it('a duração fracionada: 1,2 h são 72 minutos', () => {
    const { out } = alocar({ ins: [instrutor(1, 9)], stu: [aluno(1000, { nb: 1.2, p1: 390, p2: -1 })] });
    assert.deepEqual([out[0].a, out[0].b, out[0].h], [390, 462, 1.2]);
  });

  // Um pedido é um voo só, com as horas pedidas (para dividir no dia, "+ missão"); o número de sessões dos dados
  // antigos não conta
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
  // [missão, equipamento, nível A01–A09 que basta, habilitações exigidas]
  const casos = [
    ['Simulador', 'Sim. Mono', 2, 'Simulador (Mono)'],
    ['Simulador', 'Sim. Multi', 2, 'Simulador (Multi)'],
    ['Voo Local', 'C172', 7, 'Voo Local + C172'],
    ['Voo Local', 'PA-34', 9, 'Voo Local + MLTE (PA-34)'],
    // O C152 também é uma habilitação do avião
    ['Navegação', 'C152', 4, 'Voo de Navegação + C152'],
    ['Voo Solo', 'C152', 5, 'Voo para liberação de Solo + C152'],
    ['Parafuso', 'C152', 6, 'Voo de Parafuso (SPIN) + C152'],
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
    const ins = [instrutor(1, 1, { hab: ['local', 'c152'] }), instrutor(2, 1, { hab: ['local', 'c152', 'tgl'] })];
    assert.equal(alocar({ ins, stu: [aluno(1000, { mis: 'TGL (TMA)', eq: 'C152' })] }).out[0].insId, 2);
  });

  it('voos de cheque vão para o checador com as três marcas do cheque (o curso, o motor e as regras)', () => {
    const ins = [
      instrutor(1, 9, { hab: ['checa_pp', 'checa_mnte', 'checa_vfr'] }),
      instrutor(2, 9, { hab: ['checa_pc', 'checa_mnte', 'checa_ifr'] }),
      instrutor(3, 9, { hab: ['checa_pc', 'checa_mlte', 'checa_ifr'] })
    ];
    const cheque = (mis, eq) => alocar({ ins, stu: [aluno(1000, { mis, eq })] });
    assert.equal(cheque('Cheque PP', 'C152').out[0].insId, 1);
    assert.equal(cheque('Cheque PC MNTE IFR', 'C172').out[0].insId, 2);
    assert.equal(cheque('Cheque PC MLTE IFR', 'PA-34').out[0].insId, 3);
    const semChecador = alocar({ ins: [instrutor(1, 9)], stu: [aluno(1000, { mis: 'Cheque PC MLTE VFR', eq: 'PA-34' })] });
    assert.deepEqual(semChecador.al.map(a => a.m), ['Rejeitado: nenhum instrutor ativo tem a habilitação de Cheque PC MLTE VFR no PA-34 (Checador do curso PC + Checador MLTE + Checador VFR).']);
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
      { t: 'err', s: 'Aluno 1000', m: 'Rejeitado: os instrutores habilitados (Voo Local + C152) e livres estão em “Não escalar com” deste aluno.', codigo: 'bloqueio' }
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

  it('escolhe um instrutor mais leve que respeite o limite', () => {
    const { out } = alocar({ ins: [instrutor(1, 1, { kg: 80 }), instrutor(2, 5, { kg: 60 })], stu: [aluno(1000, {}, { kg: 100 })] });
    assert.deepEqual([out[0].insId, out[0].kg, out[0].limKg], [2, 160, 170]);
  });

  it('peso do aluno não informado gera aviso sem bloquear o voo', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, {}, { kg: 0 })] });
    assert.equal(out.length, 1);
    assert.equal(out[0].kg, 0);
    assert.deepEqual(al, [{ t: 'warn', s: 'Aluno 1000', m: 'Peso do aluno não informado (0 kg): verificação de limite (170 kg) no C152 não realizada.', codigo: 'sem-peso', stuId: 1000 }]);
  });

  it('quando o peso importa, o instrutor com o peso informado vem antes', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 1, { kg: 0 }), instrutor(2, 9)], stu: [aluno(1000)] });
    assert.deepEqual([out[0].insId, al], [2, []]);
  });

  it('o aviso diz de quem é o peso que falta (no texto e nos ids: o resumo conta os alunos e os instrutores)', () => {
    const soInstrutor = alocar({ ins: [instrutor(1, 1, { kg: 0 })], stu: [aluno(1000)] });
    assert.deepEqual(soInstrutor.al, [{ t: 'warn', s: 'Aluno 1000', m: 'Peso de Instrutor 01 não informado (0 kg): verificação de limite (170 kg) no C152 não realizada.', codigo: 'sem-peso', insId: 1 }]);
    const osDois = alocar({ ins: [instrutor(1, 1, { kg: 0 })], stu: [aluno(1000, {}, { kg: 0 })] });
    assert.deepEqual(osDois.al, [{ t: 'warn', s: 'Aluno 1000', m: 'Pesos do aluno e de Instrutor 01 não informados (0 kg): verificação de limite (170 kg) no C152 não realizada.', codigo: 'sem-peso', stuId: 1000, insId: 1 }]);
  });
});

// A diretoria permite no máximo 6 voos locais (Voo Local, Voo Solo e TGL) no mesmo horário
describe('No máximo 6 voos locais no mesmo horário', () => {
  const instrutores = Array.from({ length: 9 }, (_, i) => instrutor(i + 1, 9));
  it('o 7º voo local das 08:20 vai para outro horário; os de outras missões não contam', () => {
    const stu = [
      ...[0, 1, 2, 3].map(i => aluno(1000 + i, { p1: 500, p2: -1 })),
      aluno(1004, { mis: 'TGL (TMA)', p1: 500, p2: -1 }), aluno(1005, { mis: 'TGL (TMA)', p1: 500, p2: -1 }),
      aluno(1006, { p1: 500, p2: -1 }), aluno(1007, { mis: 'Navegação', p1: 500, p2: -1 })
    ];
    const { out } = alocar({ ins: instrutores, stu });
    assert.equal(out.filter(o => o.a === 500 && ['Voo Local', 'Voo Solo', 'TGL (TMA)'].includes(o.mis)).length, 6);
    assert.notEqual(out.find(o => o.stuId === 1006).a, 500, 'o 7º local sai em outro horário');
    assert.equal(out.find(o => o.stuId === 1007).a, 500, 'a Navegação não conta');
  });

  it('o Solo só sai às 06:30: com 6 locais às 06:30, o 7º é rejeitado dizendo por quê', () => {
    const stu = [...[0, 1, 2, 3, 4, 5].map(i => aluno(1000 + i, { mis: 'Voo Solo' })), aluno(1006, { mis: 'Voo Solo' })];
    const { out, al } = alocar({ ins: instrutores, stu });
    assert.equal(out.length, 6);
    assert.deepEqual(al.filter(a => a.t === 'err'), [{ t: 'err', s: 'Aluno 1006', m: 'Rejeitado: já há 6 voos locais (Voo Local, Voo Solo e TGL) em todos os horários possíveis, o máximo no mesmo horário.', codigo: 'limite-de-locais' }]);
  });

  it('a compactação também respeita o limite: o buraco não se fecha num horário que já tem 6 locais', () => {
    // O instrutor 1 voa às 06:30 e às 13:40; a compactação traria o das 13:40 para as 08:20, mas lá já saem 6 voos
    // locais de outros instrutores: ele vem para as 10:10
    const outros = [2, 3, 4, 5, 6, 7, 8, 9];
    const stu = [aluno(1000, { p1: 390, p2: -1, jan: 'h390' }, { bl: outros }), aluno(1001, { p1: 820, p2: -1 }, { bl: outros }),
      ...[2, 3, 4, 5, 6, 7].map(i => aluno(1000 + i, { p1: 500, p2: -1, jan: 'h500' }, { bl: [1] }))];
    const { out } = runAllocationEngine(cenario({ ins: instrutores, stu }));
    assert.deepEqual([out.filter(o => o.a === 500).length, out.find(o => o.stuId === 1001).a], [6, 610]);
  });
});

// Quem agendou primeiro sai primeiro; a Prioridade passa à frente, e o pedido posto à mão (sem a agenda) vem depois
// dos agendados
describe('A ordem dos agendamentos', () => {
  const umLugar = stu => alocar({ ins: [instrutor(1, 9)], stu, semAeronaves: SO_PP_LJV }).out.find(o => o.a === 390);
  it('com a mesma prioridade, quem agendou primeiro fica com o horário', () => {
    const voo = umLugar([aluno(1000, { p1: 390, p2: -1, solicitacao: 9 }), aluno(1001, { p1: 390, p2: -1, solicitacao: 5 })]);
    assert.equal(voo.stuId, 1001);
  });

  it('o pedido posto à mão vem depois dos agendados', () => {
    const voo = umLugar([aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 390, p2: -1, solicitacao: 5 })]);
    assert.equal(voo.stuId, 1001);
  });

  it('a prioridade maior passa à frente da ordem dos agendamentos', () => {
    const voo = umLugar([aluno(1000, { p1: 390, p2: -1, pr: 5 }), aluno(1001, { p1: 390, p2: -1, solicitacao: 5 })]);
    assert.equal(voo.stuId, 1000);
  });
});

// Sem vaga na 1ª nem na 2ª preferência, o horário mais perto da 1ª
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
    // A sala está com o Ground PA-34 às 11:30 (prioridade 5); o Ground C152 queria as 11:30: vai para as 13:40
    // (12:40 e 10:10 cruzam a outra turma), não 06:30
    const { out } = alocar({
      ins: [instrutor(1, 9), instrutor(2, 9)],
      stu: [aluno(1000, { mis: 'Ground PA-34', eq: 'Sala Ground', nb: 1.5, p1: 3, p2: -1, pr: 5 }), aluno(1001, { ...GROUND_C152, p1: 3, p2: -1 })]
    });
    assert.equal(hm(out.find(o => o.stuId === 1001).a), '13:40');
  });
});

describe('Disponibilidade do aluno', () => {
  // J (N13): a disponibilidade é o horário exato do pedido (não há mais período do dia)
  it('o voo só começa no horário do pedido (a preferência fora dele não vale)', () => {
    const { out } = alocar({ stu: [aluno(1000, { p1: 1, p2: 2, jan: 'h760' })] });
    assert.deepEqual([hm(out[0].a), out[0].tag], ['12:40', 'Próximo livre']);
  });

  it('horário específico: o voo começa só naquele horário', () => {
    const { out } = alocar({ stu: [aluno(1000, { p1: 1, p2: 2, jan: 'h6' })] });
    assert.equal(hm(out[0].a), '14:30');
  });

  it('sem o horário do pedido aberto, o pedido é rejeitado dizendo por quê', () => {
    const { al } = alocar({ stu: [aluno(1000, { jan: 'h760' })], janelasOff: [4, 5, 6, 7] });
    assert.deepEqual(al.map(a => a.m), ['Rejeitado: nenhum horário aberto na disponibilidade do aluno (às 12:40) comporta 1 h.']);
  });

  it('Ground também respeita a disponibilidade', () => {
    const { out } = alocar({ stu: [aluno(1000, { ...GROUND_C152, p1: 0, p2: 1, jan: 'h760' })] });
    assert.equal(hm(out[0].a), '12:40');
  });
});

describe('Revisão de 50 horas', () => {
  const ins = [instrutor(1, 1), instrutor(2, 1), instrutor(3, 1)];
  const tresVoos = [aluno(1000, { p1: 1, p2: 1 }), aluno(1001, { p1: 2, p2: 2 }), aluno(1002, { p1: 4, p2: 4 })];

  it('avião sem saldo para o voo não é escalado: o voo vai para outro avião', () => {
    const { out, al } = alocar({ ins, stu: [aluno(1000)], semAeronaves: apenas('C152', 'PP-LJV', 'PR-BTB'), horas: { 'PP-LJV': 49.5 } });
    assert.equal(out[0].r, 'PR-BTB');
    assert.deepEqual(al, [{ t: 'warn', s: 'PP-LJV', m: 'Aeronave parou para revisão de 50 horas: sem saldo para voar hoje (49,5 h desde a última revisão).', codigo: 'revisao' }]);
  });

  it('o avião voa até completar as 50 horas e para no meio do dia; os horários seguintes ficam sem esse avião', () => {
    const { out, al, revisao } = alocar({ ins, stu: tresVoos, semAeronaves: SO_PP_LJV, horas: { 'PP-LJV': 48, 'PR-BTB': 10 } });
    assert.deepEqual(out.map(o => [o.s, o.r, hm(o.a)]), [['Aluno 1000', 'PP-LJV', '08:20'], ['Aluno 1001', 'PP-LJV', '10:10']]);
    assert.deepEqual(al, [
      { t: 'err', s: 'Aluno 1002', m: 'Rejeitado: os C152 livres estão sem saldo até a revisão de 50 horas.', codigo: 'revisao' },
      { t: 'warn', s: 'PP-LJV', m: 'Aeronave parou para revisão de 50 horas às 11:10 (50 h desde a última revisão).', codigo: 'revisao' }
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
    const ins = [instrutor(1, 1, { hab: ['local', 'c152', 'c172', 'tgl'] }), instrutor(2, 1, { hab: ['local', 'c152', 'c172'] })];
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
  it('decola somente na janela das 17:30, com 4 h no dia (o translado e o noturno em BH)', () => {
    const { out } = alocar({ ins: [instrutor(1, 7)], stu: [aluno(1000, { mis: 'Noturno', eq: 'C172', p1: 8, p2: 8 })] });
    assert.deepEqual(out.map(o => [o.w, o.a, o.b, o.h]), [[8, 1050, 1290, 4]]);
  });

  it('é rejeitado com a janela noturna desativada', () => {
    const { al } = alocar({ ins: [instrutor(1, 7)], stu: [aluno(1000, { mis: 'Noturno', eq: 'C172', p1: 8, p2: 8 })], janelasOff: [8] });
    assert.deepEqual(al, [{
      t: 'err', s: 'Aluno 1000',
      m: 'Rejeitado: nenhum horário aberto comporta 4 h a partir das 17:30.', codigo: 'sem-horario'
    }]);
  });
});

describe('Ground School', () => {
  it('o aluno só entra numa turma já aberta se ela começa na disponibilidade dele', () => {
    const manha = [1000, 1001].map(id => aluno(id, { ...GROUND_C152, p1: 390, p2: 500 }));
    const { out } = alocar({ ins: [instrutor(1, 1), instrutor(2, 1)], stu: [...manha, aluno(1002, { ...GROUND_C152, p1: 760, p2: 820, jan: 'h760' })] });
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

  it('entre duas turmas abertas, a da 1ª preferência vem antes da da 2ª', () => {
    // O 1000 abre a turma das 08:20 (instrutor 1); o 1001, que bloqueou o 1, a das 06:30 (instrutor 2)
    const { out } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [aluno(1000, { ...GROUND_C152, p1: 500, p2: -1 }, { bl: [2] }), aluno(1001, { ...GROUND_C152, p1: 390, p2: -1 }, { bl: [1] }),
        aluno(1002, { ...GROUND_C152, p1: 390, p2: 500 })]
    });
    assert.deepEqual([out.find(o => o.stuId === 1002).a, out.find(o => o.stuId === 1002).baseTag], [390, 'Pref. 1']);
  });

  it('a aula não depende da luz do dia: a das 16:20 termina às 17:50', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, GROUND_C152)], janelasOff: [0, 1, 2, 3, 4, 5, 6] });
    assert.deepEqual([out.map(o => [hm(o.a), hm(o.b)]), al], [[['16:20', '17:50']], []]);
  });

  it('sem nenhum período do dia aberto, não há horário para a aula', () => {
    const { al } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, GROUND_C152)], janelasOff: [0, 1, 2, 3, 4, 5, 6, 7] });
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1000', m: 'Rejeitado: nenhum horário aberto comporta 01h30 de Ground.', codigo: 'sem-horario' }]);
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

// O voo agendado na Escala é um voo fixo com a marca agendado: a linha dele na escala leva a marca (a aprovação e a escala
// gravada a guardam). A marca não muda a escala: o mesmo voo fixo sem ela dá a mesma escala
describe('Voo agendado na Escala', () => {
  it('a linha do voo fixo leva a marca do pino agendado; os outros voos, não; sem a marca, a mesma escala', () => {
    const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 }), aluno(1002, { p1: 610, p2: -1 })] });
    const agendado = { a: 610, b: 670, r: 'PR-VOB', insId: 2, agendado: true };
    const fixos = { '1000_0_1': agendado, '1001_0_1': { a: 500, b: 560, r: 'PR-VOC', insId: 1 } };
    const resultado = runAllocationEngine({ ...estado, fixos });
    const marcas = id => { const o = resultado.out.find(v => v.stuId === id); return [o.fixo, o.agendado]; };
    assert.deepEqual([marcas(1000), marcas(1001), marcas(1002)], [[true, true], [true, undefined], [undefined, undefined]]);
    assert.deepEqual(resultado.al, []);
    const { agendado: _, ...semAMarca } = agendado;
    const semMarca = runAllocationEngine({ ...estado, fixos: { ...fixos, '1000_0_1': semAMarca } });
    assert.deepEqual(semMarca, { ...resultado, out: resultado.out.map(({ agendado: _, ...o }) => o) });
  });
});

// Com a prioridade desligada (js/funcionalidades.js), todos os pedidos têm a mesma: o motivo do avião ocupado não fala de
// "prioridade maior" (a tela tira o fim dele, js/state.js, comOsMotivosDaTela; o motor continua o mesmo)
describe('O motivo sem a prioridade', () => {
  it('o avião ocupado deixa de dizer "ocupados por pedidos de prioridade maior"; os outros motivos e o resultado continuam', () => {
    // Dois instrutores e um avião: os dois alunos só podem às 06:30, e o segundo fica sem avião
    const estado = cenario({
      ins: [instrutor(1, 9), instrutor(2, 9)], semAeronaves: apenas('C152', 'PP-LJV'),
      stu: [aluno(1000, { p1: 390, p2: -1, jan: 'h390' }), aluno(1001, { p1: 390, p2: -1, jan: 'h390' }), aluno(1002, { p1: 390, p2: -1, jan: 'h390', eq: 'C172' })]
    });
    const resultado = runAllocationEngine(estado);
    const antes = structuredClone(resultado);
    const erro = s => resultado.al.find(a => a.t === 'err' && a.s === s);
    // Com o horário exato, a recusa só por falta de lugar espera (F1h, N14): a prioridade sai, o lugar na lista fica
    assert.equal(erro('Aluno 1001').m, 'Rejeitado: nenhum C152 livre nos horários possíveis (ocupados por pedidos de prioridade maior); 1º na lista de espera das 06:30.');
    const sem = semAPrioridadeNosMotivos(resultado);
    assert.deepEqual(resultado, antes);
    const erroSem = sem.al.find(a => a.s === 'Aluno 1001');
    assert.deepEqual(erroSem, { ...erro('Aluno 1001'), m: 'Rejeitado: nenhum C152 livre nos horários possíveis; 1º na lista de espera das 06:30.' });
    // O resto: os mesmos objetos
    assert.equal(sem.out, resultado.out);
    sem.al.forEach((a, i) => { if (a !== erroSem) assert.equal(a, resultado.al[i]); });
    assert.deepEqual({ ...sem, al: null }, { ...resultado, al: null });
    // Sem o motivo: o próprio resultado
    const semOMotivo = { ...resultado, al: resultado.al.filter(a => a.codigo !== 'avioes-ocupados') };
    assert.equal(semAPrioridadeNosMotivos(semOMotivo), semOMotivo);
    // O avião ocupado com outro texto (o IFR, o Parafuso) continua
    const ifr = { ...resultado, al: [{ t: 'err', s: 'Aluno 1', codigo: 'avioes-ocupados', m: 'Rejeitado: nenhum C172 homologado IFR livre nos horários possíveis (o voo é IFR; os “Só VFR” não servem a ele).' }] };
    assert.equal(semAPrioridadeNosMotivos(ifr), ifr);
    // Sem a lista de espera, a prioridade no fim do motivo
    const noFim = { ...resultado, al: [{ t: 'err', s: 'Aluno 1', codigo: 'avioes-ocupados', m: 'Rejeitado: nenhum C152 livre nos horários possíveis (ocupados por pedidos de prioridade maior).' }] };
    assert.equal(semAPrioridadeNosMotivos(noFim).al[0].m, 'Rejeitado: nenhum C152 livre nos horários possíveis.');
  });

  // A disputa do “Priorizar com” (F1h) não diz o número da prioridade (a tela a mostra ao contrário, 1 a mais alta: o
  // motor não sabe): "prioridade maior"; com a mesma, só a chave que decidiu. A escala gravada com a prioridade ligada
  // aparece sem ela
  it('a disputa do “Priorizar com” gravada com a prioridade maior aparece sem ela', () => {
    const m = 'Aluno 1000 e Aluno 1001 priorizam Instrutor 01 às 08:20: ficou com Aluno 1001 (prioridade maior); Aluno 1000 voa às 10:10.';
    const outro = { t: 'warn', s: 'Aluno 2', codigo: 'voa-com', m: 'Aluno 2 e Aluno 3 priorizam Instrutor 01 às 08:20: ficou com Aluno 3 (pedido registrado antes); Aluno 2 voa às 10:10.' };
    const resultado = { out: [], tot: 0, al: [{ t: 'warn', s: 'Aluno 1000', codigo: 'voa-com', m }, outro] };
    const sem = semAPrioridadeNosMotivos(resultado);
    assert.equal(sem.al[0].m, 'Aluno 1000 e Aluno 1001 priorizam Instrutor 01 às 08:20: ficou com Aluno 1001; Aluno 1000 voa às 10:10.');
    assert.equal(sem.al[1], outro);
    assert.equal(resultado.al[0].m, m);
  });
});

// F1d, "missão do curso": o pedido com a missão do curso leva o que ela exige do INVA (exige, derivado no estado da escala
// a partir do programa: js/programa.js, comExigenciasDasMissoes). O INVA também precisa ter cada id da lista; sem ninguém
// que tenha, o voo fica fora com sem-instrutor-habilitado (regra a). Sem exige, o motor é o de antes (os goldens)
describe('O que a missão do curso exige do INVA', () => {
  const comEndosso = (id, lv) => instrutor(id, lv, { hab: [...instrutor(id, lv).hab, 'endosso_solo'] });
  const solo = (id, extra = {}) => aluno(id, { mis: 'Voo Solo', etapa: 'PP-SOLO-01', cursoDaEtapa: 'PP', exige: ['endosso_solo'], ...extra }, { curso: 'PP' });

  it('só o INVA que tem a habilitação da missão do curso dá o voo, mesmo com mais habilitações', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 5), comEndosso(2, 9)], stu: [solo(1000)] });
    assert.deepEqual(al.filter(a => a.t === 'err'), []);
    assert.equal(out.length, 1);
    assert.equal(out[0].insId, 2);
    // Sem a lista, o de menos habilitações, como antes
    const antes = alocar({ ins: [instrutor(1, 5), comEndosso(2, 9)], stu: [solo(1000, { exige: undefined })] });
    assert.equal(antes.out[0].insId, 1);
  });

  it('sem nenhum INVA ativo com a habilitação, o voo fica fora com sem-instrutor-habilitado, dizendo qual', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 9), instrutor(2, 5)], stu: [solo(1000)] });
    assert.equal(out.length, 0);
    assert.deepEqual(al.map(a => [a.t, a.codigo]), [['err', 'sem-instrutor-habilitado']]);
    assert.match(al[0].m, /nenhum instrutor ativo tem a habilitação de Voo Solo no C152 \(Voo para liberação de Solo \+ C152 \+ Endosso Solo\)/);
    // O INVA que tem, fora nesta data, não conta
    const fora = alocar({ ins: [{ ...comEndosso(1, 9), on: false }, instrutor(2, 5)], stu: [solo(1000)] });
    assert.deepEqual(fora.al.map(a => a.codigo), ['sem-instrutor-habilitado']);
  });

  it('o INVA escolhido sem a habilitação da missão do curso recusa o pedido', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 9), comEndosso(2, 9)], stu: [solo(1000, { insId: 1 })] });
    assert.equal(out.length, 0);
    assert.equal(al[0].codigo, 'instrutor-escolhido');
    assert.match(al[0].m, /o instrutor escolhido \(Instrutor 01\) não tem a habilitação de Voo Solo no C152 \(.*Endosso Solo\)/);
  });

  it('no Ground, a turma só recebe o aluno cuja missão do curso o INVA dela pode dar', () => {
    const ground = (id, extra = {}) => aluno(id, { ...GROUND_C152, ...extra }, { curso: 'PP' });
    const { out, al } = alocar({
      ins: [instrutor(1, 1), comEndosso(2, 9)],
      stu: [ground(1000, { pr: 5 }), ground(1001, { etapa: 'PP-GND-01', cursoDaEtapa: 'PP', exige: ['endosso_solo'] })]
    });
    assert.deepEqual(al, []);
    const porAluno = Object.fromEntries(out.map(o => [o.stuId, o]));
    assert.equal(porAluno[1000].insId, 1);
    assert.equal(porAluno[1001].insId, 2);
    assert.notEqual(porAluno[1000].classKey, porAluno[1001].classKey);
    const semNinguem = alocar({ ins: [instrutor(1, 9)], stu: [ground(1001, { exige: ['endosso_solo'] })] });
    assert.equal(semNinguem.al[0].codigo, 'sem-instrutor-habilitado');
    assert.match(semNinguem.al[0].m, /\(Grounds \(C152, C172 e Navegação\) \+ Endosso Solo\)/);
  });

  it('o voo fixo cujo INVA não tem a habilitação da missão do curso fica em conflito, dizendo qual', () => {
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [solo(1000)] });
    estado.fixos = { '1000_0_1': { a: 500, b: 560, r: 'PP-LJV', insId: 1 } };
    const { out } = runAllocationEngine(estado, { compactar: false });
    assert.deepEqual(out[0].conflitoCodigos, ['habilitacao']);
    assert.deepEqual(out[0].conflito, ['o instrutor não tem a habilitação que a missão do curso exige (Endosso Solo)']);
  });

  it('a divisão das horas não passa o voo para quem não tem a habilitação da missão do curso', () => {
    const { out } = runAllocationEngine(cenario({
      ins: [comEndosso(1, 9), instrutor(2, 9)],
      // Voo Local da missão do curso (o Voo Solo só sai às 06:30), em três horários
      stu: [0, 1, 2].map(i => solo(1000 + i, { mis: 'Voo Local', p1: i * 2, p2: i * 2 + 1 }))
    }));
    assert.equal(out.length, 3);
    assert.deepEqual([...new Set(out.map(o => o.insId))], [1]);
  });
});

// Q8 (F1d, "limite confirmado"): o 7º voo local confirmado na Agenda ("Registrar mesmo assim") voa no horário dele, o
// pedido com limiteConfirmado: true e o horário exato (jan). Ele passa pelo limite só no minuto dele, fixo ou não, e não
// toma lugar dos outros: no máximo 6 sem os confirmados, mais os confirmados, onde quer que ele caia na fila (instrutor
// escolhido, prioridade, "Priorizar com"). Depois da fila, cada confirmado num horário com mais de 6 locais avisa
// (limite-de-locais, o texto do agendado). A ordem da fila não muda
describe('O 7º voo local confirmado', () => {
  const instrutores = Array.from({ length: 9 }, (_, i) => instrutor(i + 1, 9));
  const seis = () => [0, 1, 2, 3, 4, 5].map(i => aluno(1000 + i, { p1: 500, p2: -1, jan: 'h500' }));
  const confirmado = (extra = {}, campos = {}) => aluno(1006, { p1: 500, p2: -1, jan: 'h500', limiteConfirmado: true, ...extra }, campos);
  const AVISO = { t: 'warn', s: 'Aluno 1006', fKey: '1006_0_1', stuId: 1006, codigo: 'limite-de-locais', m: 'Agendado às 08:20 como o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.' };
  const locaisAs = (out, a) => out.filter(o => o.a === a && ['Voo Local', 'Voo Solo', 'TGL (TMA)'].includes(o.mis)).map(o => o.stuId).sort();
  const todos = [1000, 1001, 1002, 1003, 1004, 1005, 1006];

  for (const [nome, extra, campos] of [
    ['por último na fila', {}, {}],
    ['primeiro na fila pelo instrutor escolhido', { insId: 9 }, {}],
    ['primeiro na fila pela prioridade', { pr: 5 }, {}],
    ['primeiro na fila pelo “Priorizar com”', {}, { voaCom: [9] }]
  ]) {
    it(`os sete voam às 08:20, o confirmado ${nome}, e só ele avisa`, () => {
      for (const compactar of [false, true]) {
        const { out, al } = runAllocationEngine(cenario({ ins: instrutores, stu: [...seis(), confirmado(extra, campos)] }), { compactar });
        assert.deepEqual(locaisAs(out, 500), todos, `compactar: ${compactar}`);
        assert.deepEqual(al.filter(a => a.codigo === 'limite-de-locais'), [AVISO]);
        assert.deepEqual(al.filter(a => a.t === 'err'), []);
      }
    });
  }

  it('fixo (o voo aprovado) também: os sete voam às 08:20, e os seis não confirmados cabem em volta dele', () => {
    const estado = cenario({ ins: instrutores, stu: [...seis(), confirmado()] });
    estado.fixos = { '1006_0_1': { a: 500, b: 560, r: 'PR-VOZ', insId: 9 } };
    const { out, al } = runAllocationEngine(estado);
    assert.deepEqual(locaisAs(out, 500), todos);
    assert.deepEqual(al.filter(a => a.codigo === 'limite-de-locais'), [AVISO]);
    assert.ok(!out.some(o => o.conflito));
  });

  it('fixo e atrasado para outro horário, o confirmado conta lá como os outros: a confirmação era do minuto dele', () => {
    // Confirmado para as 08:20, o voo aprovado atrasa para as 10:10, onde seis outros pedem o horário exato: lá ele não é
    // o 7º confirmado, e só cinco dos seis saem às 10:10, como sem a confirmação
    const as1010 = () => [0, 1, 2, 3, 4, 5].map(i => aluno(1000 + i, { p1: 610, p2: -1, jan: 'h610' }));
    const saemAs1010 = limiteConfirmado => {
      const estado = cenario({ ins: instrutores, stu: [...as1010(), confirmado({ limiteConfirmado })], fStatus: { '1006_0_1': 'Atrasado' } });
      estado.fixos = { '1006_0_1': { a: 500, b: 560, r: 'PR-VOZ', insId: 9 } };
      estado.fObs = { '1006_0_1': { novoInicio: 610 } };
      const { out, al } = runAllocationEngine(estado);
      return { aos1010: out.filter(o => o.a === 610).map(o => o.stuId).sort(), erros: al.filter(a => a.t === 'err').map(a => [a.s, a.codigo]) };
    };
    const sem = saemAs1010(undefined);
    assert.equal(sem.aos1010.length, 5);
    assert.deepEqual(saemAs1010(true), sem);
  });

  it('sem a confirmação, o 7º não sai às 08:20; o 8º não confirmado também não', () => {
    const sem = alocar({ ins: instrutores, stu: [...seis(), confirmado({ limiteConfirmado: undefined })] });
    assert.equal(locaisAs(sem.out, 500).length, 6);
    assert.deepEqual(sem.al.filter(a => a.t === 'err').map(a => [a.s, a.codigo]), [['Aluno 1006', 'limite-de-locais']]);
    const oitavo = alocar({ ins: instrutores, stu: [...seis(), confirmado(), aluno(1007, { p1: 500, p2: -1 })] });
    assert.deepEqual(locaisAs(oitavo.out, 500), todos);
    assert.notEqual(oitavo.out.find(o => o.stuId === 1007).a, 500, 'o 8º, sem confirmação, sai em outro horário');
  });

  it('a confirmação vale só no minuto do pedido: sem o horário exato, ou noutro horário, conta como os outros', () => {
    const semExato = alocar({ ins: instrutores, stu: [...seis(), confirmado({ jan: undefined })] });
    assert.equal(locaisAs(semExato.out, 500).length, 6);
    assert.notEqual(semExato.out.find(o => o.stuId === 1006).a, 500);
    assert.deepEqual(semExato.al.filter(a => a.codigo === 'limite-de-locais'), []);
  });

  it('com vaga no horário, o confirmado voa e não avisa; ele não ocupa a vaga de outro', () => {
    const comVaga = alocar({ ins: instrutores, stu: [...seis().slice(0, 4), confirmado()] });
    assert.equal(locaisAs(comVaga.out, 500).length, 5);
    assert.deepEqual(comVaga.al.filter(a => a.codigo === 'limite-de-locais'), []);
    // Confirmado primeiro na fila, os seis outros ainda saem às 08:20 (sete no horário, com o aviso)
    const primeiro = alocar({ ins: instrutores, stu: [confirmado({ pr: 5 }), ...seis()] });
    assert.deepEqual(locaisAs(primeiro.out, 500), todos);
  });

  it('dois confirmados no horário cheio: os oito voam, e cada um avisa com o lugar dele', () => {
    const outro = aluno(1007, { p1: 500, p2: -1, jan: 'h500', limiteConfirmado: true });
    const { out, al } = alocar({ ins: instrutores, stu: [...seis(), confirmado(), outro] });
    assert.deepEqual(locaisAs(out, 500), [...todos, 1007]);
    assert.deepEqual(al.filter(a => a.codigo === 'limite-de-locais').map(a => a.m), [
      'Agendado às 08:20 como o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.',
      'Agendado às 08:20 como o 8º voo local do horário: no máximo 6 voos locais saem no mesmo horário.'
    ]);
  });
});

// J (N11): a Sala Ground é um recurso com os seus horários de decolagem (Recursos › "Horários de decolagem"). O Ground
// sai da lista dela, em minutos; a turma junta quem começa no mesmo minuto; a chave e o w continuam os do tempo de antes
// em que ela começa (periodoDoMinuto), como os goldens guardam
describe('O Ground pelos horários da Sala Ground', () => {
  const comHorarios = (opts, ground) => runAllocationEngine({ ...cenario(opts), horarios: { ...HORARIOS_INICIAIS, ground } }, { compactar: false });
  const aulas = res => res.out.filter(o => o.isGround).map(o => [o.s, hm(o.a), hm(o.b), o.classKey, o.w]);

  it('uma lista fora da grade de antes: a aula às 07:00, a chave e o w do tempo das 06:30', () => {
    const res = comHorarios({ stu: [aluno(1000, { ...GROUND_C152, p1: 420, p2: -1 })] }, [420, 600]);
    assert.deepEqual(aulas(res), [['Aluno 1000', '07:00', '08:30', 'GND_Ground C152_0_1', 0]]);
  });

  it('só os horários da sala: a preferência fora da lista vai para o horário dela mais perto', () => {
    const res = comHorarios({ stu: [aluno(1000, { ...GROUND_C152, p1: 390, p2: -1 })] }, [420]);
    assert.deepEqual(aulas(res).map(a => a[1]), ['07:00']);
  });

  it('a turma junta quem começa no mesmo minuto, com o mesmo INVA', () => {
    const res = comHorarios({ stu: [1000, 1001].map(id => aluno(id, { ...GROUND_C152, p1: 420, p2: -1 })) }, [420, 600]);
    assert.deepEqual(aulas(res), [['Aluno 1000', '07:00', '08:30', 'GND_Ground C152_0_1', 0], ['Aluno 1001', '07:00', '08:30', 'GND_Ground C152_0_1', 0]]);
  });

  it('a janela de antes fechada ainda fecha os horários da sala que caem nela', () => {
    const res = comHorarios({ stu: [aluno(1000, { ...GROUND_C152, p1: 420, p2: -1 })], janelasOff: [0] }, [420, 600]);
    assert.deepEqual(aulas(res).map(a => a[1]), ['10:00']);
  });
});

// J (S4): com a Sala Ground indisponível na data, nenhuma aula de Ground entra; o voo que depende dela espera
// (ground-pendente, como hoje); os outros voos ficam
describe('A Sala Ground indisponível na data', () => {
  const comASala = (opts, disponivel) => runAllocationEngine({ ...cenario(opts), av: { ...cenario().av, 'SALA-GROUND': disponivel } }, { compactar: false });
  const voo = aluno(1001, { mis: 'Voo Local', eq: 'C152', p1: 610, p2: -1 });

  it('cada pedido de Ground recusado sala-indisponivel, o voo que ele libera ground-pendente, o resto entra', () => {
    const gnd = aluno(1000, { ...GROUND_C152, p1: 390, p2: -1 }, { extra: [missaoExtra(1, { mis: 'Navegação', eq: 'C152', p1: 760, p2: -1 })] });
    const res = comASala({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [gnd, voo] }, false);
    assert.equal(res.out.some(o => o.isGround), false);
    const codigos = res.al.filter(a => a.t === 'err').map(a => [a.s, a.codigo]);
    assert.deepEqual(codigos.filter(([s]) => s.startsWith('Aluno 1000')).map(([, c]) => c).sort(), ['ground-pendente', 'sala-indisponivel'].sort());
    assert.ok(res.out.some(o => o.stuId === 1001), 'o voo de outro aluno entra');
  });

  it('com a chave true, ou ausente, a aula entra', () => {
    for (const disponivel of [true, undefined]) {
      const res = comASala({ stu: [aluno(1000, { ...GROUND_C152, p1: 390, p2: -1 })] }, disponivel);
      assert.equal(res.out.filter(o => o.isGround).length, 1, String(disponivel));
    }
  });

  it('a turma fixa na sala indisponível fica em conflito sala-indisponivel', () => {
    const estado = { ...cenario({ stu: [aluno(1000, { ...GROUND_C152, p1: 390, p2: -1 })] }) };
    const feito = runAllocationEngine(estado, { compactar: false });
    const aula = feito.out.find(o => o.isGround);
    estado.fixos = { [aula.fKey]: { a: aula.a, b: aula.b, r: 'SALA-GROUND', insId: aula.insId, agendado: true } };
    estado.av = { ...estado.av, 'SALA-GROUND': false };
    const res = runAllocationEngine(estado, { compactar: false });
    const fixa = res.out.find(o => o.fKey === aula.fKey);
    assert.ok(fixa && (fixa.conflitoCodigos || []).includes('sala-indisponivel'), JSON.stringify(fixa && fixa.conflitoCodigos));
  });

  it('os 40 cenários e o exemplo com a sala disponível (a chave true) dão os goldens', async () => {
    const { gerarCenario } = await import('../helpers/cenarios.js');
    const { lerGoldens } = await import('../helpers/goldens.js');
    const goldens = lerGoldens();
    const comAChave = estado => ({ ...estado, av: { ...estado.av, 'SALA-GROUND': true } });
    assert.deepEqual(JSON.parse(JSON.stringify(runAllocationEngine(comAChave(goldens.exemplo.estado)))), goldens.exemplo.saida);
    for (const { seed, saida } of goldens.cenarios) assert.deepEqual(JSON.parse(JSON.stringify(runAllocationEngine(comAChave(gerarCenario(seed))))), saida, `cenário ${seed}`);
  });
});

// F1h (N9, N14; Pedro, 2026-11-26: “o Priorizar com é para o INVA, não para o horário”). A ordem da fila decide quem fica
// com cada horário (o Ground antes, o instrutor escolhido, a prioridade, a ordem de registro na agenda, entre os postos à
// mão o “Priorizar com”, o cadastro e a missão); o aluno com “Priorizar com” procura primeiro um instrutor dele nos horários
// dele, como antes do F1h; depois de montada a escala, os voos que começam no mesmo horário trocam de instrutor entre si
// para que o maior número de alunos voe com um instrutor do “Priorizar com”, sem mudar nenhum horário e sem passar por cima
// de nenhuma regra, pino ou escolha do operador
describe('O “Priorizar com” escolhe o instrutor, não o horário', () => {
  // Dois alunos que priorizam o mesmo INVA e querem o mesmo horário (08:20); o outro INVA está livre
  const ins = [instrutor(1, 1), instrutor(2, 1)];
  const dupla = (a = {}, b = {}) => alocar({ ins, stu: [aluno(1000, a, { voaCom: [1] }), aluno(1001, b, { voaCom: [1] })] });
  const comOInstrutor = ({ out }) => out.filter(o => o.insId === 1).map(o => [o.stuId, o.a]);
  const doPar = al => al.filter(a => a.codigo === 'voa-com').map(a => a.m);

  it('o desempate entre dois que priorizam o mesmo INVA é a fila: a prioridade maior', () => {
    assert.deepEqual(comOInstrutor(dupla({ pr: 3 }, { pr: 4 })), [[1001, 500], [1000, 610]]);
  });

  it('o desempate: com a mesma prioridade, o pedido da agenda registrado antes; o posto à mão, depois', () => {
    assert.deepEqual(comOInstrutor(dupla({ solicitacao: 9 }, { solicitacao: 5 })), [[1001, 500], [1000, 610]]);
    assert.deepEqual(comOInstrutor(dupla({}, { solicitacao: 5 })), [[1001, 500], [1000, 610]]);
  });

  it('o desempate: a ordem do cadastro', () => {
    assert.deepEqual(comOInstrutor(dupla()), [[1000, 500], [1001, 610]]);
  });

  it('o desempate: a ordem das missões do aluno', () => {
    const { out } = alocar({ ins, stu: [aluno(1000, {}, { voaCom: [1], extra: [missaoExtra(1)] })] });
    assert.deepEqual(out.map(o => [o.mid, o.a, o.insId]), [[0, 500, 1], [1, 610, 1]]);
  });

  it('o outro voa com o INVA em outro horário; sem outro horário na disponibilidade, com outro INVA (o de sempre)', () => {
    const { out } = dupla({}, { jan: 'h500', p2: -1 });
    assert.deepEqual(out.map(o => [o.stuId, o.a, o.insId, Boolean(o.insPar)]), [[1000, 500, 1, true], [1001, 500, 2, false]]);
  });

  it('o horário é da fila: o de prioridade 5, sem “Priorizar com”, fica com as 08:20 antes do de prioridade 1 que prioriza o único INVA', () => {
    const { out } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, { pr: 1 }, { voaCom: [1] }), aluno(1001, { pr: 5 })] });
    assert.deepEqual(out.map(o => [o.stuId, o.a, o.insId, Boolean(o.insPar)]), [[1001, 500, 1, false], [1000, 610, 1, true]]);
  });

  it('com a mesma prioridade, quem registrou antes na agenda fica com o horário, com ou sem “Priorizar com” (N14)', () => {
    const um = [instrutor(1, 1)];
    const horarios = ({ out }) => out.map(o => [o.stuId, o.a]);
    assert.deepEqual(horarios(alocar({ ins: um, stu: [aluno(1000, { solicitacao: 9 }, { voaCom: [1] }), aluno(1001, { solicitacao: 5 })] })), [[1001, 500], [1000, 610]]);
    // O posto à mão (sem a agenda) vem depois dos agendados, também com “Priorizar com”
    assert.deepEqual(horarios(alocar({ ins: um, stu: [aluno(1000, {}, { voaCom: [1] }), aluno(1001, { solicitacao: 5 })] })), [[1001, 500], [1000, 610]]);
    // Entre os postos à mão de mesma prioridade, a ordem do cadastro: o “Priorizar com” não passa na frente (também o de um
    // instrutor de fora do cadastro)
    assert.deepEqual(horarios(alocar({ ins: um, stu: [aluno(1000), aluno(1001, {}, { voaCom: [1] })] })), [[1000, 500], [1001, 610]]);
    assert.deepEqual(horarios(alocar({ ins: um, stu: [aluno(1000), aluno(1001, {}, { voaCom: [99] })] })), [[1000, 500], [1001, 610]]);
    // Entre os agendados de mesma prioridade, o registro: o “Priorizar com” do que registrou depois não passa na frente
    assert.deepEqual(horarios(alocar({ ins: um, stu: [aluno(1000, { solicitacao: 5 }), aluno(1001, { solicitacao: 9 }, { voaCom: [1] })] })), [[1000, 500], [1001, 610]]);
  });

  it('o “Priorizar com” não é chave da fila (nem em naOrdemDoMotor): com ele ou sem ele, a mesma ordem em 300 dias gerados', async () => {
    const { gerarCenario, comEscolhas } = await import('../helpers/cenarios.js');
    const { contextoDaEscala, filaDosPedidos } = await import('../../js/conferencia.js');
    const { naOrdemDoMotor } = await import('../../js/rejeicoes.js');
    const fila = estado => filaDosPedidos(estado, contextoDaEscala(estado)).map(item => `${item.stuId}_${item.mid}`).join(' ');
    const ordem = (estado, out) => naOrdemDoMotor(estado, out).map(o => o.fKey).join(' ');
    const diferentes = [];
    let comLista = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const estado = comEscolhas(gerarCenario(seed), seed);
      const semLista = { ...estado, stu: estado.stu.map(s => ({ ...s, voaCom: [] })) };
      const { out } = runAllocationEngine(estado);
      if (estado.stu.some(s => (s.voaCom || []).length)) comLista++;
      if (fila(estado) !== fila(semLista) || ordem(estado, out) !== ordem(semLista, out)) diferentes.push(seed);
    }
    assert.ok(comLista > 100, String(comLista));
    assert.deepEqual(diferentes, []);
  });

  // O 1002 (prioridade 5, sem “Priorizar com”) fica com o INVA 1 às 08:20 (o que tem menos habilitações); o 1000 (prioridade
  // 1, só às 08:20, prioriza o INVA 1) fica com o INVA 2. Os dois trocam: o horário de cada um é o da fila
  const tres = ({ ins: outros = [instrutor(1, 1), instrutor(2, 9)], de1000 = {}, de1002 = {}, extra1002 = {}, fixos, opcoes = { compactar: false } } = {}) => {
    const estado = cenario({ ins: outros, stu: [aluno(1000, { pr: 1, jan: 'h500', p2: -1 }, { voaCom: [1], ...de1000 }), aluno(1002, { pr: 5, jan: 'h500', p2: -1, ...de1002 }, extra1002)] });
    if (fixos) estado.fixos = fixos;
    return runAllocationEngine(estado, opcoes);
  };
  // Pelo aluno (a escala ordena as linhas pelo horário e pelo avião)
  const quem = ({ out }) => out.map(o => [o.stuId, o.a, o.insId]).sort((p, q) => p[0] - q[0]);

  it('no mesmo horário, os voos trocam de INVA para o aluno voar com o do “Priorizar com”, sem aviso', () => {
    const resultado = tres();
    assert.deepEqual(resultado.out.map(o => [o.stuId, o.a, o.insId, Boolean(o.insPar)]).sort((p, q) => p[0] - q[0]), [[1000, 500, 1, true], [1002, 500, 2, false]]);
    assert.deepEqual(doPar(resultado.al), []);
    // Sem o pareamento (opcoes.parearNoHorario: false, o motor de antes do F1h), o de sempre
    assert.deepEqual(quem(tres({ opcoes: { compactar: false, parearNoHorario: false } })), [[1000, 500, 2], [1002, 500, 1]]);
  });

  it('a troca não passa por cima de nada: o instrutor escolhido, o voo fixo, a habilitação, o que a missão exige, “Não escalar com”, o peso', () => {
    const semTroca = [[1000, 500, 2], [1002, 500, 1]];
    // O instrutor escolhido para o dia na Demanda: o aviso diz quem ficou com ele
    const escolhido = tres({ de1002: { insId: 1 } });
    assert.deepEqual(quem(escolhido), semTroca);
    assert.deepEqual(doPar(escolhido.al), ['Sem o instrutor de “Priorizar com” (Instrutor 01: ocupado nos horários possíveis): o voo ficou com Instrutor 02. Aluno 1000 prioriza Instrutor 01 às 08:20: ficou com Aluno 1002 (instrutor escolhido para o dia).']);
    // O voo fixo (o da escala aprovada) com o INVA 1
    const r = tres({ opcoes: { compactar: false, parearNoHorario: false } }).out.find(o => o.stuId === 1002).r;
    assert.deepEqual(quem(tres({ fixos: { '1002_0_1': { a: 500, b: 560, r, insId: 1 } } })), semTroca);
    // A habilitação: o INVA 2 não voa a Navegação do 1002
    const semNavegacao = instrutor(2, 9, { hab: habilitacoesDoNivel(9).filter(h => h !== 'navegacao') });
    assert.deepEqual(quem(tres({ ins: [instrutor(1, 4), instrutor(2, 9)], de1002: { mis: 'Navegação' } })), [[1000, 500, 1], [1002, 500, 2]]);
    assert.deepEqual(quem(tres({ ins: [instrutor(1, 4), semNavegacao], de1002: { mis: 'Navegação' } })), semTroca);
    // O que a missão do curso do 1002 exige (IFR), que o INVA 2 não tem
    const semIfr = instrutor(2, 9, { hab: habilitacoesDoNivel(9).filter(h => h !== 'ifr') });
    assert.deepEqual(quem(tres({ ins: [instrutor(1, 8), semIfr] })), [[1000, 500, 1], [1002, 500, 2]]);
    assert.deepEqual(quem(tres({ ins: [instrutor(1, 8), semIfr], de1002: { exige: ['ifr'] } })), semTroca);
    // O 1002 não voa com o INVA 2
    assert.deepEqual(quem(tres({ extra1002: { bl: [2] } })), semTroca);
    // O peso: com 80 kg, o 1002 e o INVA 2 (105 kg) passariam do limite do C152 com o tanque cheio; com 60 kg, não
    const pesado = instrutor(2, 9, { kg: 105 });
    assert.deepEqual(quem(tres({ ins: [instrutor(1, 1), pesado], de1000: { kg: 60 }, extra1002: { kg: 60 } })), [[1000, 500, 1], [1002, 500, 2]]);
    assert.deepEqual(quem(tres({ ins: [instrutor(1, 1), pesado], de1000: { kg: 60 }, extra1002: { kg: 80 } })), semTroca);
  });

  // O rodízio (C172, PA-34, cheques, Noturno): os dois voos de uma categoria trocam de INVA no mesmo horário (cada INVA
  // continua com um voo dela); o voo do rodízio não troca com um de outra categoria nem passa para um INVA livre
  it('no rodízio, os voos da mesma categoria trocam de INVA; com outra categoria ou para um INVA livre, não', () => {
    const c172 = { eq: 'C172' };
    const nove = [instrutor(1, 9), instrutor(2, 9)];
    const mesma = tres({ ins: nove, de1000: c172, de1002: c172 });
    assert.deepEqual(quem(mesma), [[1000, 500, 1], [1002, 500, 2]]);
    assert.deepEqual(doPar(mesma.al), []);
    assert.deepEqual(quem(tres({ ins: nove, de1000: c172, de1002: c172, opcoes: { compactar: false, parearNoHorario: false } })), [[1000, 500, 2], [1002, 500, 1]]);
    // O 1000 no C152 e o 1002 no C172: trocar tiraria o voo do rodízio do INVA 1
    assert.deepEqual(quem(tres({ ins: nove, de1002: c172 })), [[1000, 500, 2], [1002, 500, 1]]);
    // O 1002 não voa com o INVA 2: só sobraria passar para o INVA 3, livre, fora da vez dele no rodízio
    assert.deepEqual(quem(tres({ ins: [...nove, instrutor(3, 9)], de1000: c172, de1002: c172, extra1002: { bl: [2] } })), [[1000, 500, 2], [1002, 500, 1]]);
  });

  it('a troca não muda o avião de nenhum voo, nem dos voos de outros horários', () => {
    const ins = [instrutor(1, 1), instrutor(2, 9)];
    const as = minuto => ({ pr: 5, jan: `h${minuto}`, p2: -1 });
    const stu = () => [aluno(1000, { pr: 1, jan: 'h500', p2: -1 }, { voaCom: [1] }), aluno(1002, as(500)), aluno(1003, as(390)), aluno(1004, as(390))];
    for (const alunos of [stu(), stu().slice(0, 3)]) {
      const avioes = opcoes => runAllocationEngine(cenario({ ins, stu: alunos }), opcoes).out.map(o => [o.stuId, o.a, o.r]).sort((p, q) => p[0] - q[0]);
      const pareado = runAllocationEngine(cenario({ ins, stu: alunos }));
      assert.equal(pareado.out.find(o => o.stuId === 1000).insId, 1);
      assert.deepEqual(avioes({}), avioes({ parearNoHorario: false }));
    }
  });

  it('a troca que não serve ao outro aluno do mesmo minuto é dita: “a troca não serve a”', () => {
    const inicio = 'Sem o instrutor de “Priorizar com” (Instrutor 01: ocupado nos horários possíveis): o voo ficou com Instrutor 02. Aluno 1000 prioriza Instrutor 01 às 08:20: ficou com Aluno 1002 (prioridade maior)';
    // O 1002 não voa com o INVA 2 (“Não escalar com”)
    assert.deepEqual(doPar(tres({ extra1002: { bl: [2] } }).al), [`${inicio}; a troca não serve a Aluno 1002.`]);
    // O 1002 no C172 (o rodízio) e o 1000 no C152: trocar mudaria o rodízio
    assert.deepEqual(doPar(tres({ ins: [instrutor(1, 9), instrutor(2, 9)], de1002: { eq: 'C172' } }).al), [`${inicio}; a troca não serve a Aluno 1002.`]);
    // Com o instrutor escolhido para o dia ou num voo fixo, o porquê de sempre, sem a troca
    assert.deepEqual(doPar(tres({ de1002: { insId: 1 } }).al), [`${inicio.replace('prioridade maior', 'instrutor escolhido para o dia')}.`]);
    // O motor de antes do F1h: o aviso de antes
    assert.deepEqual(doPar(tres({ extra1002: { bl: [2] }, opcoes: { compactar: false, antesDoF1h: true } }).al), ['Sem o instrutor de “Priorizar com” (Instrutor 01: ocupado nos horários possíveis): o voo ficou com Instrutor 02.']);
  });

  it('um caminho: quem está com o INVA vai para outro do “Priorizar com” dele, e os dois voam com um dos seus', () => {
    // O 1000 prioriza o 1 e o 2 e fica com o 1; o 1001 só prioriza o 1 e fica com o 2 (só às 08:20). O 1000 passa para o 2
    const { out, al } = alocar({ ins: [instrutor(1, 1), instrutor(2, 1), instrutor(3, 1)], stu: [aluno(1000, { pr: 4, jan: 'h500', p2: -1 }, { voaCom: [1, 2] }), aluno(1001, { jan: 'h500', p2: -1 }, { voaCom: [1] })] });
    assert.deepEqual(out.map(o => [o.stuId, o.a, o.insId, Boolean(o.insPar)]), [[1000, 500, 2, true], [1001, 500, 1, true]]);
    assert.deepEqual(doPar(al), []);
  });

  it('Ground: a fila fica com a sala (o Ground de prioridade 5 antes do de prioridade 1 com “Priorizar com”)', () => {
    const ground = (pedido, extra = {}) => aluno(pedido.id, { ...GROUND_C152, p1: 500, p2: -1, ...pedido.p }, extra);
    const caso = voaCom => alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [ground({ id: 1000, p: { pr: 5 } }), ground({ id: 1001, p: { mis: 'Ground C172', pr: 1 } }, voaCom ? { voaCom } : {})]
    }).out.map(o => [o.stuId, o.a, o.insId]);
    // Com ou sem o “Priorizar com”, o de prioridade 5 fica com a sala às 08:20; o de prioridade 1, com o INVA dele, em outro
    assert.deepEqual(caso(null).filter(o => o[1] === 500).map(o => o[0]), [1000]);
    assert.deepEqual(caso([2]).filter(o => o[1] === 500).map(o => o[0]), [1000]);
    assert.deepEqual(caso([2]).filter(o => o[0] === 1001).map(o => o[2]), [2]);
  });

  it('com o “Priorizar com” só de instrutores de fora do cadastro, nada muda', () => {
    const semPar = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, { pr: 1 }), aluno(1001, { pr: 5 })] });
    const foraDoCadastro = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, { pr: 1 }, { voaCom: [99] }), aluno(1001, { pr: 5 })] });
    assert.deepEqual(foraDoCadastro.out.map(o => [o.stuId, o.a]), semPar.out.map(o => [o.stuId, o.a]));
  });

  it('a recusa continua na ordem dos pedidos (o pareamento das recusas não muda)', () => {
    // Os dois não cabem (um avião só, uma janela só): as recusas saem na ordem da fila
    const { out, al } = alocar({
      ins: [instrutor(1, 1)], semAeronaves: apenas('C152'),
      stu: [aluno(1000, { pr: 5 }), aluno(1001, { pr: 1 }, { voaCom: [1] })]
    });
    assert.deepEqual([out.length, al.map(a => [a.s, a.codigo])], [0, [['Aluno 1000', 'sem-aviao'], ['Aluno 1001', 'sem-aviao']]]);
  });
});

// A lista de espera (F1h; N14, U3; Pedro, 2026-11-26: “If it is confirmed, we warn-and-confirm. If it is not confirmed we
// form a waiting list”): o pedido com um horário exato (jan h<minuto>) recusado só por falta de lugar nele (os 6 voos
// locais, os aviões, os instrutores) espera por ele, na ordem da fila (a ordem de registro, depois da prioridade e do
// instrutor escolhido), com o lugar dele na lista do horário na recusa (espera: { minuto, lugar }) e no texto
describe('A lista de espera', () => {
  const nove = Array.from({ length: 9 }, (_, i) => instrutor(i + 1, 9));
  const as0820 = (id, solicitacao, extra = {}) => aluno(id, { p1: 500, p2: -1, jan: 'h500', solicitacao, ...extra });
  const espera = al => al.filter(a => a.t === 'err').map(a => [a.s, a.codigo, a.espera, a.m]);
  const texto = lugar => `Rejeitado: já há 6 voos locais (Voo Local, Voo Solo e TGL) em todos os horários possíveis, o máximo no mesmo horário; ${lugar}º na lista de espera das 08:20.`;

  it('oito locais da Agenda às 08:20, sem confirmação: seis voam, o 7º e o 8º pelo registro esperam, 1º e 2º', () => {
    const oito = ids => ids.map((solicitacao, i) => as0820(1000 + i, solicitacao));
    const { out, al } = alocar({ ins: nove, stu: oito([1, 2, 3, 4, 5, 6, 7, 8]) });
    assert.deepEqual(out.filter(o => o.a === 500).map(o => o.stuId).sort(), [1000, 1001, 1002, 1003, 1004, 1005]);
    assert.deepEqual(espera(al), [
      ['Aluno 1006', 'limite-de-locais', { minuto: 500, lugar: 1 }, texto(1)],
      ['Aluno 1007', 'limite-de-locais', { minuto: 500, lugar: 2 }, texto(2)]
    ]);
    // Os ids ao contrário: os outros dois esperam
    const contrario = alocar({ ins: nove, stu: oito([8, 7, 6, 5, 4, 3, 2, 1]) });
    assert.deepEqual(espera(contrario.al).map(e => [e[0], e[2]]), [['Aluno 1001', { minuto: 500, lugar: 1 }], ['Aluno 1000', { minuto: 500, lugar: 2 }]]);
    // A prioridade e o instrutor escolhido pelo operador vêm antes do registro
    const operador = alocar({ ins: nove, stu: [...oito([1, 2, 3, 4, 5, 6]), as0820(1006, 7, { pr: 5 }), as0820(1007, 8, { insId: 9 })] });
    assert.deepEqual(espera(operador.al).map(e => [e[0], e[2].lugar]), [['Aluno 1004', 1], ['Aluno 1005', 2]]);
  });

  it('o 7º confirmado voa além dos seis, com o aviso; o 8º, não confirmado, espera (U3)', () => {
    const stu = [...[1, 2, 3, 4, 5, 6].map((id, i) => as0820(1000 + i, id)), as0820(1006, 7, { limiteConfirmado: true }), as0820(1007, 8)];
    const { out, al } = alocar({ ins: nove, stu });
    assert.equal(out.filter(o => o.a === 500).length, 7);
    assert.deepEqual(espera(al), [['Aluno 1007', 'limite-de-locais', { minuto: 500, lugar: 1 }, texto(1)]]);
    assert.ok(al.some(a => a.t === 'warn' && a.codigo === 'limite-de-locais'));
  });

  it('por falta de avião ou de instrutor no horário, também; cada horário com a sua lista', () => {
    // Um C152 só: às 08:20 e às 10:10, um voa e o outro espera
    const { al } = alocar({ ins: nove, semAeronaves: apenas('C152', 'PP-LJV'), stu: [as0820(1000, 1), as0820(1001, 2), aluno(1002, { p1: 610, p2: -1, jan: 'h610', solicitacao: 3 }), aluno(1003, { p1: 610, p2: -1, jan: 'h610', solicitacao: 4 })] });
    assert.deepEqual(espera(al).map(e => [e[0], e[1], e[2]]), [['Aluno 1001', 'avioes-ocupados', { minuto: 500, lugar: 1 }], ['Aluno 1003', 'avioes-ocupados', { minuto: 610, lugar: 1 }]]);
    // Um INVA só
    const um = alocar({ ins: [instrutor(1, 9)], stu: [as0820(1000, 1), as0820(1001, 2)] });
    assert.deepEqual(espera(um.al).map(e => [e[0], e[1], e[2]]), [['Aluno 1001', 'instrutores-ocupados', { minuto: 500, lugar: 1 }]]);
  });

  it('não esperam: o pedido sem horário exato, o recusado por outro motivo, o Voo Solo sem horário exato, e o motor de antes do F1h', () => {
    // Sem horário exato (a 1ª e a 2ª preferência): procura outros horários e, sem nenhum, não espera
    const semExato = alocar({ ins: [instrutor(1, 9)], janelasOff: [0, 2, 3, 4, 5, 6, 7, 8], stu: [aluno(1000, { p1: 500, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] });
    assert.deepEqual(espera(semExato.al).map(e => [e[0], e[2]]), [['Aluno 1001', undefined]]);
    // O INVA escolhido em “Não escalar com” do aluno: recusado, sem esperar
    const bloqueado = alocar({ ins: nove, stu: [{ ...as0820(1000, 1, { insId: 1 }), bl: [1] }] });
    assert.deepEqual(espera(bloqueado.al).map(e => [e[1], e[2]]), [['instrutor-escolhido', undefined]]);
    // O Voo Solo sai sempre às 06:30, mas sem o jan não tem horário exato
    const solo = alocar({ ins: [instrutor(1, 9)], stu: [aluno(1000, { mis: 'Voo Solo', nb: 1 }), aluno(1001, { mis: 'Voo Solo', nb: 1 })] });
    assert.deepEqual(espera(solo.al).map(e => [e[0], e[1], e[2]]), [['Aluno 1001', 'instrutores-ocupados', undefined]]);
    // O motor de antes do F1h não tem a lista de espera
    const antes = runAllocationEngine(cenario({ ins: [instrutor(1, 9)], stu: [as0820(1000, 1), as0820(1001, 2)] }), { compactar: false, antesDoF1h: true });
    assert.deepEqual(espera(antes.al).map(e => [e[2], e[3]]), [[undefined, 'Rejeitado: os instrutores habilitados (Voo Local + C152) já têm outro compromisso nos horários possíveis.']]);
  });

  it('o lugar que a compactação libera vai para o 1º da lista de espera do horário', async () => {
    const { gerarCenario, comAgenda } = await import('../helpers/cenarios.js');
    // A semente 292 com os pedidos da Agenda: sem a compactação, o Aluno 20 (só às 07:30) espera pelo INVA 12, que voa às
    // 06:30; a compactação leva esse voo para as 14:30, e o Aluno 20 voa às 07:30 com o INVA 12, sem a recusa
    const estado = comAgenda(gerarCenario(292), 292);
    const semCompactar = runAllocationEngine(estado, { compactar: false });
    assert.deepEqual(espera(semCompactar.al).filter(e => e[0] === 'Aluno 20').map(e => [e[1], e[2]]), [['instrutores-ocupados', { minuto: 450, lugar: 1 }]]);
    const { out, al } = runAllocationEngine(estado);
    assert.deepEqual(out.filter(o => o.stuId === 1025).map(o => [o.a, o.insId]), [[450, 12]]);
    assert.ok(!al.some(a => a.t === 'err' && a.s === 'Aluno 20'));
    // O INVA 12 não voa dois ao mesmo tempo
    const doDoze = out.filter(o => o.insId === 12).sort((p, q) => p.a - q.a);
    assert.ok(doDoze.every((o, i) => i === 0 || doDoze[i - 1].b <= o.a), JSON.stringify(doDoze.map(o => [o.a, o.b])));
  });
});

// O INVA em “Não escalar com” do aluno nunca dá o voo, por nenhum caminho do motor: a fila (também quando está no “Priorizar
// com”), a turma de Ground, a divisão das horas, a compactação e as Sugestões. O bloqueio depois da escala montada: o voo
// sem pino troca de INVA na rodada seguinte; o fixo fica onde está, em conflito
describe('“Não escalar com”: nunca, por nenhum caminho', () => {
  it('a fila: nem quando o INVA também está no “Priorizar com” (um estado que o cadastro não grava)', () => {
    const { out, al } = runAllocationEngine(cenario({ ins: [instrutor(1, 1), instrutor(2, 9)], stu: [aluno(1000, {}, { voaCom: [1], bl: [1] })] }));
    assert.deepEqual(out.map(o => o.insId), [2]);
    assert.deepEqual(al.map(a => a.m), ['Sem o instrutor de “Priorizar com” (Instrutor 01: em “Não escalar com”): o voo ficou com Instrutor 02.']);
  });

  it('a turma de Ground: o aluno não entra na turma do INVA bloqueado', () => {
    const { out } = runAllocationEngine(cenario({
      ins: [instrutor(1, 1), instrutor(2, 9)],
      stu: [aluno(1000, { ...GROUND_C152, p1: 500, p2: -1, insId: 1 }), aluno(1001, { ...GROUND_C152, p1: 500, p2: -1 }, { bl: [1] })]
    }));
    assert.deepEqual(out.map(o => [o.stuId, o.insId, o.a]), [[1001, 2, 390], [1000, 1, 500]]);
  });

  it('a divisão das horas: o voo não passa para o INVA bloqueado', () => {
    const ins = [instrutor(1, 1), instrutor(2, 9)];
    const stu = bl => [aluno(1000, { p1: 390 }, { bl }), aluno(1001, { p1: 500 }, { bl })];
    assert.deepEqual(runAllocationEngine(cenario({ ins, stu: stu([]) }), { compactar: false }).out.map(o => o.insId).sort(), [1, 2]);
    assert.deepEqual(runAllocationEngine(cenario({ ins, stu: stu([2]) }), { compactar: false }).out.map(o => o.insId), [1, 1]);
  });

  it('a compactação: nenhum voo vai para o INVA bloqueado, em 300 cenários com bloqueios', async () => {
    const { gerarCenario } = await import('../helpers/cenarios.js');
    const falhas = [];
    for (let seed = 1; seed <= 300; seed++) {
      const estado = gerarCenario(seed);
      for (const [rotulo, opcoes] of [['compactada', {}], ['sem a divisão', { dividirHoras: false }]]) {
        for (const o of runAllocationEngine(estado, opcoes).out) {
          const s = estado.stu.find(x => x.id === o.stuId);
          if (!o.trecho && s.bl.includes(o.insId)) falhas.push(`${seed} ${rotulo} ${o.fKey}`);
        }
      }
    }
    assert.deepEqual(falhas, []);
  });

  it('as Sugestões do pedido recusado não oferecem o INVA bloqueado', async () => {
    const { sugestoesDoRejeitado } = await import('../../js/reparo.js');
    const estado = cenario({ ins: [instrutor(1, 1), instrutor(2, 1), instrutor(3, 1)], stu: [aluno(1000, { p1: 500, p2: -1, jan: 'h500', insId: 3 }, { bl: [1] })] });
    estado.ins[2].on = false;
    const resultado = runAllocationEngine(estado);
    assert.deepEqual(resultado.al.map(a => a.codigo), ['instrutor-escolhido']);
    const instrutores = sugestoesDoRejeitado(estado, resultado, '1000_0_1').map(o => o.insId ?? (o.mudancas || {}).insId ?? (o.pino || {}).insId);
    assert.ok(instrutores.length >= 1, JSON.stringify(instrutores));
    assert.ok(!instrutores.includes(1), JSON.stringify(instrutores));
  });

  it('bloqueado depois da escala: o voo sem pino troca de INVA; o fixo fica, em conflito', () => {
    const base = cenario({ ins: [instrutor(1, 1), instrutor(2, 9)], stu: [aluno(1000)] });
    const antes = runAllocationEngine(base);
    assert.equal(antes.out[0].insId, 1);
    const bloqueado = { ...base, stu: [{ ...base.stu[0], bl: [1] }] };
    assert.deepEqual(runAllocationEngine(bloqueado).out.map(o => [o.insId, Boolean(o.conflito)]), [[2, false]]);
    const o = antes.out[0];
    const fixo = runAllocationEngine({ ...bloqueado, fixos: { [o.fKey]: { a: o.a, b: o.b, r: o.r, insId: o.insId } } });
    assert.deepEqual(fixo.out.map(v => [v.insId, v.conflitoCodigos]), [[1, ['bloqueio']]]);
  });
});

// F1h (N9): quando dois alunos priorizam o mesmo INVA no mesmo horário, ou quando um voo fixo ou um pedido com o instrutor
// escolhido fica com ele, a escala diz: um aviso voa-com por voo, escrito depois da divisão das horas e da compactação, com
// os horários do fim. O horário pedido é o minuto exato do pedido, senão a 1ª preferência; sem nenhum, não há disputa. O
// voo posto à mão (agendado, ou com o INVA trocado na Escala) fora do “Priorizar com” também avisa
describe('As disputas do “Priorizar com”', () => {
  const ins = [instrutor(1, 1), instrutor(2, 1)];
  const doPar = al => al.filter(a => a.codigo === 'voa-com').map(a => [a.fKey, a.stuId, a.insId, a.m]);
  const dupla = (a = {}, b = {}, opcoes) => runAllocationEngine(cenario({ ins, stu: [aluno(1000, a, { voaCom: [1] }), aluno(1001, b, { voaCom: [1] })] }), opcoes);

  it('o outro fica com o INVA em outro horário: o aviso diz quem ficou com o horário e por quê', () => {
    assert.deepEqual(doPar(dupla({ pr: 3 }, { pr: 4 }).al), [
      ['1000_0_1', 1000, 1, 'Aluno 1000 e Aluno 1001 priorizam Instrutor 01 às 08:20: ficou com Aluno 1001 (prioridade maior); Aluno 1000 voa às 10:10.']
    ]);
    assert.deepEqual(doPar(dupla({ solicitacao: 9 }, { solicitacao: 5 }).al).map(a => a[3]),
      ['Aluno 1000 e Aluno 1001 priorizam Instrutor 01 às 08:20: ficou com Aluno 1001 (pedido registrado antes); Aluno 1000 voa às 10:10.']);
    assert.deepEqual(doPar(dupla().al).map(a => a[3]),
      ['Aluno 1001 e Aluno 1000 priorizam Instrutor 01 às 08:20: ficou com Aluno 1000 (antes no cadastro); Aluno 1001 voa às 10:10.']);
  });

  it('sem outro horário possível, com outro INVA: a disputa vai dentro do aviso de sempre (um aviso só)', () => {
    assert.deepEqual(doPar(dupla({}, { jan: 'h500', p2: -1 }).al), [
      ['1001_0_1', 1001, 2, 'Sem o instrutor de “Priorizar com” (Instrutor 01: ocupado nos horários possíveis): o voo ficou com Instrutor 02. Aluno 1001 e Aluno 1000 priorizam Instrutor 01 às 08:20: ficou com Aluno 1000 (antes no cadastro).']
    ]);
  });

  it('o INVA com um voo fixo no horário pedido: nomeado do mesmo jeito', () => {
    const estado = cenario({ ins, stu: [aluno(1000, {}, { voaCom: [1] }), aluno(1001, { p1: 500, p2: -1 })] });
    estado.fixos = { '1001_0_1': { a: 500, b: 560, r: 'PR-VOB', insId: 1 } };
    assert.deepEqual(doPar(runAllocationEngine(estado).al).map(a => a[3]),
      ['Aluno 1000 prioriza Instrutor 01 às 08:20: ficou com Aluno 1001 (voo fixo); Aluno 1000 voa às 10:10.']);
  });

  it('sem disputa, sem frase: o INVA com quem não prioriza ninguém no horário (uma aula de Ground), e o pedido sem horário pedido', () => {
    // A aula de Ground (o Ground vem antes na fila) fica com o INVA 1 às 08:20; o aluno voa com ele às 10:10, sem aviso
    const comAula = runAllocationEngine(cenario({ ins: [instrutor(1, 1)], stu: [aluno(1000, {}, { voaCom: [1] }), aluno(1001, { ...GROUND_C152, p1: 500, p2: -1 })] }));
    assert.deepEqual([comAula.out.map(o => [o.stuId, o.a, o.insId]), doPar(comAula.al)], [[[1001, 500, 1], [1000, 610, 1]], []]);
    // Sem minuto exato e sem 1ª preferência, não há horário pedido
    assert.deepEqual(doPar(dupla({ pr: 3, p1: -1, p2: -1 }, { pr: 4, p1: -1, p2: -1 }).al), []);
  });

  it('o horário pedido é o minuto exato do pedido antes da 1ª preferência', () => {
    // O 1000 pede só as 10:10 (1ª preferência às 06:30, quando o INVA está livre): a disputa é a das 10:10
    assert.deepEqual(doPar(dupla({ pr: 3, jan: 'h610', p1: 0, p2: -1 }, { pr: 4, p1: 2, p2: -1 }).al).map(a => a[3]),
      ['Sem o instrutor de “Priorizar com” (Instrutor 01: ocupado nos horários possíveis): o voo ficou com Instrutor 02. Aluno 1000 e Aluno 1001 priorizam Instrutor 01 às 10:10: ficou com Aluno 1001 (prioridade maior).']);
  });

  it('Ground: dois Grounds (uma sala só) do mesmo INVA no mesmo horário', () => {
    const { out, al } = runAllocationEngine(cenario({
      ins, stu: [aluno(1000, { ...GROUND_C152, p1: 500, p2: -1, pr: 4 }, { voaCom: [1] }), aluno(1001, { mis: 'Ground C172', eq: 'Sala Ground', nb: 1.5, p1: 500, p2: -1 }, { voaCom: [1] })]
    }));
    assert.deepEqual(out.map(o => [o.stuId, o.a, o.insId]), [[1001, 390, 1], [1000, 500, 1]]);
    assert.deepEqual(doPar(al), [['1001_0_1', 1001, 1, 'Aluno 1001 e Aluno 1000 priorizam Instrutor 01 às 08:20: ficou com Aluno 1000 (prioridade maior); Aluno 1001 voa às 06:30.']]);
  });

  // Achado pela busca em cenários aleatórios: antes da compactação, o Aluno 05 está com o Instrutor 06 às 08:20, o horário
  // que a aula de Ground do Aluno 07 pediu; a compactação o leva para as 11:30, e às 08:20 não há mais ninguém com ele: a
  // frase sai (a do motivo de sempre fica). O Aluno 05 não veio antes na fila (o Ground vem antes dos voos): sem o porquê
  it('a disputa que a compactação desfaz não é dita (a frase usa os horários do fim)', async () => {
    const { gerarCenario, comEscolhas } = await import('../helpers/cenarios.js');
    const estado = comEscolhas(gerarCenario(86), 86);
    const disputaDe = opcoes => runAllocationEngine(estado, opcoes).al.filter(a => a.fKey === '1009_0_1').map(a => a.m);
    const inicio = 'Sem o instrutor de “Priorizar com” (Instrutor 06: indisponível nos horários possíveis): o voo ficou com Instrutor 05.';
    assert.deepEqual(disputaDe({ compactar: false }), [`${inicio} Aluno 07 e Aluno 05 priorizam Instrutor 06 às 08:20: ficou com Aluno 05.`]);
    const { out } = runAllocationEngine(estado);
    assert.deepEqual(out.filter(o => o.insId === 6 && o.a < 590 && 500 < o.b), []);
    assert.deepEqual(disputaDe({}), [inicio]);
  });

  it('a aula de Ground fica com o INVA antes do voo: o porquê é o Ground', () => {
    const { out, al } = runAllocationEngine(cenario({ ins, stu: [aluno(1000, { jan: 'h500', p2: -1 }, { voaCom: [1] }), aluno(1001, { ...GROUND_C152, p1: 500, p2: -1 }, { voaCom: [1] })] }));
    assert.deepEqual(out.map(o => [o.stuId, o.a, o.insId]).sort((p, q) => p[0] - q[0]), [[1000, 500, 2], [1001, 500, 1]]);
    assert.deepEqual(doPar(al).map(a => a[3]), ['Sem o instrutor de “Priorizar com” (Instrutor 01: ocupado nos horários possíveis): o voo ficou com Instrutor 02. Aluno 1000 e Aluno 1001 priorizam Instrutor 01 às 08:20: ficou com Aluno 1001 (o Ground vem antes dos voos).']);
  });

  it('o aluno que vem antes na fila e perdeu o horário por outro motivo: a frase sem o porquê', () => {
    // O 1000 (prioridade 5) quer as 08:20, mas a aula de Ground dele (com o INVA 2, escolhido) é às 08:20 e o voo vem
    // depois dela: o 1001 (prioridade 1) fica com o INVA 1 às 08:20, sem ter vindo antes na fila
    const { al } = runAllocationEngine(cenario({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [aluno(1000, { pr: 5 }, { voaCom: [1], extra: [missaoExtra(1, { ...GROUND_C152, p1: 500, p2: -1, jan: 'h500', insId: 2 })] }), aluno(1001, { pr: 1 }, { voaCom: [1] })]
    }), { compactar: false });
    // (A aula de Ground com o INVA 2 escolhido na Demanda, fora do “Priorizar com”, também avisa: a revisão do F1h)
    assert.deepEqual(doPar(al), [
      ['1000_1_1', 1000, 2, 'Fora do “Priorizar com” de Aluno 1000 (Instrutor 01): Instrutor 02 foi escolhido para o dia na Demanda.'],
      ['1000_0_1', 1000, 1, 'Aluno 1000 e Aluno 1001 priorizam Instrutor 01 às 08:20: ficou com Aluno 1001; Aluno 1000 voa às 10:10.']
    ]);
  });

  it('um aviso por voo, com a chave dele', () => {
    const { al } = runAllocationEngine(cenario({ ins: [instrutor(1, 1)], stu: [1000, 1001, 1002].map(id => aluno(id, { pr: 1003 - id === 3 ? 5 : 3 }, { voaCom: [1] })) }));
    const chaves = al.filter(a => a.codigo === 'voa-com').map(a => a.fKey);
    assert.deepEqual([chaves.length, new Set(chaves).size], [2, 2]);
  });

  it('o voo posto à mão fora do “Priorizar com” (agendado, ou o INVA trocado na Escala): o aviso, com a chave dele; o fixo da aprovação, não', () => {
    const estado = cenario({ ins, stu: [aluno(1000, {}, { voaCom: [1] })] });
    const caso = pino => doPar(runAllocationEngine({ ...estado, fixos: { '1000_0_1': { a: 500, b: 560, r: 'PR-VOB', insId: 2, ...pino } } }).al);
    const aviso = [['1000_0_1', 1000, 2, 'Fora do “Priorizar com” de Aluno 1000 (Instrutor 01): o voo foi posto à mão com Instrutor 02.']];
    assert.deepEqual(caso({ agendado: true }), aviso);
    assert.deepEqual(caso({ escolhido: true }), aviso);
    assert.deepEqual(caso({}), []);
    // Com o INVA do “Priorizar com”, nada
    assert.deepEqual(doPar(runAllocationEngine({ ...estado, fixos: { '1000_0_1': { a: 500, b: 560, r: 'PR-VOB', insId: 1, agendado: true } } }).al), []);
  });

  // Revisão do F1h: com dois INVAs no “Priorizar com”, o aluno que perde o horário do INVA 01 para outro aluno que também o
  // prioriza e voa com o INVA 02 (o outro dele) em outro horário teve a mesma disputa: ela é dita, com o INVA com que ele voa
  it('o aluno com dois INVAs no “Priorizar com” que perde o horário de um deles e voa com o outro: a disputa é dita', () => {
    const aw = Array(9).fill(true);
    aw[1] = false;
    const caso = voaCom => runAllocationEngine(cenario({ ins: [instrutor(1, 1), instrutor(2, 1, { aw })], stu: [aluno(1000, { pr: 3 }, { voaCom }), aluno(1001, { pr: 4 }, { voaCom: [1] })] }));
    const doisPares = caso([1, 2]);
    assert.deepEqual(doisPares.out.map(o => [o.stuId, o.a, o.insId]), [[1001, 500, 1], [1000, 610, 2]]);
    assert.deepEqual(doPar(doisPares.al), [
      ['1000_0_1', 1000, 2, 'Aluno 1000 e Aluno 1001 priorizam Instrutor 01 às 08:20: ficou com Aluno 1001 (prioridade maior); Aluno 1000 voa às 10:10 com Instrutor 02.']
    ]);
    // Com o mesmo INVA, a frase de antes
    assert.deepEqual(doPar(caso([1]).al).map(a => a[3]), ['Aluno 1000 e Aluno 1001 priorizam Instrutor 01 às 08:20: ficou com Aluno 1001 (prioridade maior); Aluno 1000 voa às 10:10.']);
  });

  // Revisão do F1h (N9: o operador que escala contra o “Priorizar com”): o INVA escolhido para o dia na Demanda é uma escolha
  // à mão como a da Escala: fora do “Priorizar com”, o aviso
  it('o INVA escolhido para o dia na Demanda fora do “Priorizar com”: o aviso, com a chave do voo', () => {
    const { out, al } = runAllocationEngine(cenario({ ins, stu: [aluno(1000, { insId: 2 }, { voaCom: [1] })] }));
    assert.deepEqual(out.map(o => [o.fKey, o.insId]), [['1000_0_1', 2]]);
    assert.deepEqual(doPar(al), [['1000_0_1', 1000, 2, 'Fora do “Priorizar com” de Aluno 1000 (Instrutor 01): Instrutor 02 foi escolhido para o dia na Demanda.']]);
    // Com o INVA do “Priorizar com”, nada
    assert.deepEqual(doPar(runAllocationEngine(cenario({ ins, stu: [aluno(1000, { insId: 1 }, { voaCom: [1] })] })).al), []);
  });

  // Revisão do F1h: sem nenhum INVA do “Priorizar com” que possa dar o voo (não vem, sem a habilitação, em “Não escalar com”),
  // o voo com outro INVA não vai contra ele: posto à mão ou escolhido na Demanda, o aviso é o motivo de sempre (não “posto à
  // mão”), como o do voo que o motor pôs
  it('sem nenhum INVA do “Priorizar com” que possa dar o voo, o voo posto à mão ou escolhido com outro: o motivo de sempre', () => {
    const insFora = [instrutor(1, 1, { on: false }), instrutor(2, 1)];
    const motivo = 'Sem o instrutor de “Priorizar com” (Instrutor 01: fora nesta data): o voo ficou com Instrutor 02.';
    const solto = runAllocationEngine(cenario({ ins: insFora, stu: [aluno(1000, {}, { voaCom: [1] })] }));
    assert.deepEqual(doPar(solto.al).map(a => a[3]), [motivo]);
    for (const pino of [{ agendado: true }, { escolhido: true }]) {
      const estado = cenario({ ins: insFora, stu: [aluno(1000, {}, { voaCom: [1] })] });
      estado.fixos = { '1000_0_1': { a: 760, b: 820, r: 'PR-VOB', insId: 2, ...pino } };
      assert.deepEqual(doPar(runAllocationEngine(estado).al), [['1000_0_1', 1000, 2, motivo]], JSON.stringify(pino));
    }
    assert.deepEqual(doPar(runAllocationEngine(cenario({ ins: insFora, stu: [aluno(1000, { insId: 2 }, { voaCom: [1] })] })).al).map(a => a[3]), [motivo]);
    // Um em “Não escalar com”, o outro sem a habilitação: o motivo como o do motor
    const estado = cenario({ ins: [instrutor(1, 1), instrutor(3, 1, { hab: [] }), instrutor(2, 1)], stu: [aluno(1000, {}, { voaCom: [1, 3], bl: [1] })] });
    assert.deepEqual(doPar(runAllocationEngine(estado).al).map(a => a[3]), ['Sem o instrutor de “Priorizar com” (Instrutor 01, Instrutor 03: em “Não escalar com”): o voo ficou com Instrutor 02.']);
    estado.fixos = { '1000_0_1': { a: 760, b: 820, r: 'PR-VOB', insId: 2, agendado: true } };
    assert.deepEqual(doPar(runAllocationEngine(estado).al).map(a => a[3]), ['Sem o instrutor de “Priorizar com” (Instrutor 01, Instrutor 03: em “Não escalar com”): o voo ficou com Instrutor 02.']);
  });

  it('sem o F1h (opcoes.antesDoF1h: true), os avisos de antes', () => {
    assert.deepEqual(doPar(dupla({ pr: 3 }, { pr: 4 }, { antesDoF1h: true }).al), []);
  });
});
