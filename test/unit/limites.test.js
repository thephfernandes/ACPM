// Limites dos instrutores pela Lei do Aeronauta (fase 11): voo e jornada por dia, voo no mês, no semestre e no ano, e o
// repouso entre jornadas. As horas passadas saem das escalas gravadas (só voo em avião, sem os cancelados) e das horas
// de voo fora do app informadas no cadastro.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITES_DA_LEI, normalizarLimites, horasDeVooDoDia, acumularHoras, comHorasExternas, jornadaMin, dentroDosLimites } from '../../js/limites.js';

const voo = (insId, a, extra = {}) => ({ fKey: `${insId}${a}_0_1`, classKey: `${insId}${a}_0_1`, insId, eqType: 'C152', a, b: a + 60, h: 1, ...extra });
const dia = (data, out, fStatus = {}) => ({ data, conteudo: { fStatus, resultado: { out } } });

describe('Limites da lei', () => {
  it('os padrões: 9h30 de voo e 11 h de jornada por dia, 100 h no mês, 960 h no ano, 12 h de repouso; sem limite semestral', () => {
    assert.deepEqual(LIMITES_DA_LEI, { vooPorJornadaMin: 570, jornadaMin: 660, vooMesH: 100, vooSemestreH: null, vooAnoH: 960, repousoMin: 720, apresentacaoMin: 30, encerramentoMin: 30 });
  });

  it('valores editados: números positivos; vazio é sem limite; o resto volta ao padrão', () => {
    const l = normalizarLimites({ vooMesH: 90, vooSemestreH: 500, vooAnoH: null, repousoMin: -5, jornadaMin: 'x', extra: 1 });
    assert.deepEqual(l, { ...LIMITES_DA_LEI, vooMesH: 90, vooSemestreH: 500, vooAnoH: null });
    assert.deepEqual(normalizarLimites(undefined), LIMITES_DA_LEI);
  });
});

describe('Horas passadas', () => {
  it('as horas de voo do dia por instrutor: só avião (não simulador nem Ground), sem os cancelados', () => {
    const d = dia('2026-11-03', [
      voo(1, 390), voo(1, 500, { h: 2, b: 620 }), voo(2, 390),
      voo(1, 700, { eqType: 'Sim. Mono' }), voo(2, 500, { eqType: 'Sala Ground', h: 1.5, isGround: true }),
      voo(2, 610, { fKey: 'cancelado' })
    ], { cancelado: 'Cancelado' });
    assert.deepEqual(horasDeVooDoDia(d.conteudo), { 1: 3, 2: 1 });
  });

  it('antes da data: no mês, no semestre e no ano dela; e o fim do último compromisso no dia anterior', () => {
    const dias = [
      dia('2025-12-30', [voo(1, 390)]),
      dia('2026-05-10', [voo(1, 390)]),
      dia('2026-07-01', [voo(1, 390), voo(2, 390)]),
      dia('2026-11-02', [voo(1, 390, { h: 2, b: 510 })]),
      dia('2026-11-09', [voo(1, 980), voo(2, 1050, { eqType: 'C172' })]),
      dia('2026-11-10', [voo(1, 390)])
    ];
    assert.deepEqual(acumularHoras(dias, '2026-11-10'), {
      1: { mes: 3, semestre: 4, ano: 5, fimAnterior: 1040 },
      2: { mes: 1, semestre: 2, ano: 2, fimAnterior: 1110 }
    });
  });

  it('as horas de voo fora do app entram no mês e no ano (antes deste mês: só no ano)', () => {
    const acumulado = { 1: { mes: 3, semestre: 4, ano: 5, fimAnterior: null } };
    const instrutores = [{ id: 1, horasExternas: { '2026-11': 10, '2026-00': 300, '2026-08': 20, '2025-11': 99 } }, { id: 2, horasExternas: { '2026-11': 4 } }];
    assert.deepEqual(comHorasExternas(acumulado, instrutores, '2026-11-10'), {
      1: { mes: 13, semestre: 34, ano: 335, fimAnterior: null },
      2: { mes: 4, semestre: 4, ano: 4, fimAnterior: null }
    });
  });
});

describe('Jornada e limites', () => {
  it('a jornada vai de 30 min antes do primeiro compromisso a 30 min depois do último; depois das 18:00, a hora vale 52m30s', () => {
    assert.equal(jornadaMin([[390, 450], [610, 670]], LIMITES_DA_LEI), 340);
    // 17:30–18:30 mais o encerramento: das 18:00 às 19:00 são 60 minutos noturnos, que valem 68,57
    assert.equal(Math.round(jornadaMin([[1050, 1110]], LIMITES_DA_LEI)), 129);
    assert.equal(jornadaMin([], LIMITES_DA_LEI), 0);
  });

  it('o voo novo passa quando todos os limites continuam valendo; senão, diz qual', () => {
    const base = { compromissos: [], historico: { mes: 0, semestre: 0, ano: 0, fimAnterior: null }, limites: LIMITES_DA_LEI };
    assert.deepEqual(dentroDosLimites({ ...base, novo: { a: 390, b: 450, voo: true } }), { ok: true });
    const nove = Array.from({ length: 9 }, (_, i) => ({ a: 390 + 60 * i, b: 450 + 60 * i, voo: true }));
    assert.deepEqual(dentroDosLimites({ ...base, compromissos: nove, novo: { a: 930, b: 990, voo: true } }), { ok: false, motivo: 'voo-dia' });
    assert.deepEqual(dentroDosLimites({ ...base, compromissos: [{ a: 390, b: 450, voo: false }], novo: { a: 1050, b: 1110, voo: true } }), { ok: false, motivo: 'jornada' });
    assert.deepEqual(dentroDosLimites({ ...base, historico: { ...base.historico, mes: 99.5 }, novo: { a: 390, b: 450, voo: true } }), { ok: false, motivo: 'mes' });
    assert.deepEqual(dentroDosLimites({ ...base, historico: { ...base.historico, ano: 959.5 }, novo: { a: 390, b: 450, voo: true } }), { ok: false, motivo: 'ano' });
    assert.deepEqual(dentroDosLimites({ ...base, historico: { ...base.historico, semestre: 499.5 }, limites: { ...LIMITES_DA_LEI, vooSemestreH: 500 }, novo: { a: 390, b: 450, voo: true } }), { ok: false, motivo: 'semestre' });
    // Ontem até as 19:00 (o noturno) mais 30 min; hoje às 06:30 menos 30 min: 10h30 de repouso, menos que 12 h
    assert.deepEqual(dentroDosLimites({ ...base, historico: { ...base.historico, fimAnterior: 1140 }, novo: { a: 390, b: 450, voo: true } }), { ok: false, motivo: 'repouso' });
    assert.deepEqual(dentroDosLimites({ ...base, historico: { ...base.historico, fimAnterior: 1140 }, novo: { a: 500, b: 560, voo: true } }), { ok: true }, '08:20: 12h20 de repouso');
    // Simulador e Ground não são voo: contam só na jornada
    assert.deepEqual(dentroDosLimites({ ...base, compromissos: nove, novo: { a: 930, b: 990, voo: false } }), { ok: true });
  });

  it('sem limite (vazio), não barra', () => {
    const limites = { ...LIMITES_DA_LEI, vooMesH: null, repousoMin: null };
    assert.deepEqual(dentroDosLimites({ compromissos: [], historico: { mes: 500, semestre: 0, ano: 0, fimAnterior: 1400 }, limites, novo: { a: 390, b: 450, voo: true } }), { ok: true });
  });
});

describe('Limites: o motor', async () => {
  const { runAllocationEngine } = await import('../../js/engine.js');
  const { aluno, cenario, instrutor } = await import('../helpers/montar.js');
  const historico = (mes = 0, extra = {}) => ({ mes, semestre: mes, ano: mes, fimAnterior: null, ...extra });
  // O instrutor 1 tem menos habilitações: sem os limites, ele receberia o voo
  const dois = () => [instrutor(1, 1), instrutor(2, 9)];

  it('quem passaria das 100 h no mês não recebe o voo; o outro recebe', () => {
    const { out } = runAllocationEngine({ ...cenario({ ins: dois(), stu: [aluno(1000, { p1: 390, p2: -1 })] }), horasDosInstrutores: { 1: historico(99.5) } });
    assert.equal(out[0].insId, 2);
  });

  it('sem instrutor dentro dos limites, o voo não entra e a mensagem diz por quê', () => {
    const { out, al } = runAllocationEngine({ ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] }), horasDosInstrutores: { 1: historico(99.5) } });
    assert.equal(out.length, 0);
    assert.match(al[0].m, /nenhum instrutor dentro dos limites da Lei do Aeronauta/);
  });

  it('repouso: quem terminou ontem às 19:00 não pega o voo das 06:30', () => {
    const { out } = runAllocationEngine({ ...cenario({ ins: dois(), stu: [aluno(1000, { p1: 390, p2: -1 })] }), horasDosInstrutores: { 1: historico(0, { fimAnterior: 1140 }) } });
    assert.equal(out[0].insId, 2);
  });

  it('jornada de 11 h: o instrutor do voo das 06:30 não pega o das 16:20', () => {
    const { out } = runAllocationEngine(cenario({ ins: dois(), stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 980, p2: -1 })] }));
    const instrutorDe = stuId => out.find(o => o.stuId === stuId).insId;
    assert.notEqual(instrutorDe(1000), instrutorDe(1001));
  });

  it('a divisão das horas não passa um voo para quem passaria do limite do mês', () => {
    // O instrutor 1 (menos habilitações) fica com os dois voos; o 2 está a 30 min das 100 h e não pode receber nenhum
    const { out } = runAllocationEngine({ ...cenario({ ins: dois(), stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] }), horasDosInstrutores: { 2: historico(99.5) } });
    assert.deepEqual(out.map(o => o.insId), [1, 1]);
  });

  it('a partir de 90% do mês, a escala avisa', () => {
    const { al } = runAllocationEngine({ ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] }), horasDosInstrutores: { 1: historico(89.5) } });
    assert.deepEqual(al, [{ t: 'warn', s: 'Instrutor 01', m: 'Limite da lei: com esta escala, 90,5 h de voo no mês (limite de 100 h).' }]);
  });

  it('limites editados valem; sem limite (vazio), não barra', () => {
    const base = { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] }), horasDosInstrutores: { 1: historico(99.5) } };
    assert.equal(runAllocationEngine({ ...base, limites: { ...LIMITES_DA_LEI, vooMesH: null } }).out.length, 1);
    assert.equal(runAllocationEngine({ ...base, horasDosInstrutores: { 1: historico(80) }, limites: { ...LIMITES_DA_LEI, vooMesH: 80 } }).out.length, 0);
  });
});
