// Status do voo com detalhes (fase 8): o atraso guarda o novo horário de decolagem e o cancelamento, o motivo (de uma
// lista; em "Outro", um texto curto). Um atraso que invade o voo seguinte do mesmo recurso, instrutor ou aluno vira aviso.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLIGHT_STATUSES
} from '../../js/config.js';
import {
  MOTIVOS_DE_CANCELAMENTO, LIMITE_DO_TEXTO, STATUS_COM_DETALHE, validarDetalhe, normalizarDetalhes, textoDoDetalhe, textoDoStatus, textoParaOHistorico,
  intervaloEfetivo, conflitosDeAtraso, normalizarStatus, classeDoStatus
} from '../../js/status.js';
import { runAllocationEngine } from '../../js/engine.js';
import { aluno, cenario, instrutor, GROUND_C152 } from '../helpers/montar.js';

const voo = (fKey, a, extra = {}) => ({ fKey, classKey: fKey, a, b: a + 60, r: 'PR-VOB', insId: 1, ins: 'Instrutor 01', stuId: +fKey.split('_')[0], s: `Aluno ${fKey.split('_')[0]}`, status: 'Confirmado', ...extra });

describe('Status do voo: a lista e os detalhes', () => {
  it('cinco status: Pendente, Confirmado, Atrasado, Em Voo e Cancelado; Atrasado e Cancelado pedem detalhe', () => {
    assert.deepEqual(FLIGHT_STATUSES, ['Pendente', 'Confirmado', 'Atrasado', 'Em Voo', 'Cancelado']);
    assert.deepEqual(STATUS_COM_DETALHE, ['Atrasado', 'Cancelado']);
    assert.deepEqual(MOTIVOS_DE_CANCELAMENTO, ['Meteorologia', 'Manutenção da aeronave', 'Aluno ausente', 'Instrutor indisponível', 'Operacional', 'Outro']);
  });

  it('cancelamento: o motivo é obrigatório e vem da lista; "Outro" pede um texto de até 140 caracteres', () => {
    assert.deepEqual(validarDetalhe('Cancelado', { motivo: 'Meteorologia' }, 610), { detalhe: { motivo: 'Meteorologia' } });
    assert.deepEqual(validarDetalhe('Cancelado', { motivo: 'Meteorologia', texto: 'ignorado' }, 610), { detalhe: { motivo: 'Meteorologia' } });
    assert.ok(validarDetalhe('Cancelado', {}, 610).erro);
    assert.ok(validarDetalhe('Cancelado', { motivo: 'Chuva' }, 610).erro);
    assert.ok(validarDetalhe('Cancelado', { motivo: 'Outro', texto: '   ' }, 610).erro);
    assert.deepEqual(validarDetalhe('Cancelado', { motivo: 'Outro', texto: '  Pista   interditada ' }, 610), { detalhe: { motivo: 'Outro', texto: 'Pista interditada' } });
    assert.ok(validarDetalhe('Cancelado', { motivo: 'Outro', texto: 'x'.repeat(LIMITE_DO_TEXTO + 1) }, 610).erro);
    assert.equal(LIMITE_DO_TEXTO, 140);
  });

  it('atraso: a nova decolagem precisa ser depois da original e no mesmo dia', () => {
    assert.deepEqual(validarDetalhe('Atrasado', { novoInicio: 640 }, 610), { detalhe: { novoInicio: 640 } });
    assert.match(validarDetalhe('Atrasado', { novoInicio: 610 }, 610).erro, /depois das 10:10/);
    assert.ok(validarDetalhe('Atrasado', { novoInicio: 600 }, 610).erro);
    assert.ok(validarDetalhe('Atrasado', { novoInicio: 1440 }, 610).erro);
    assert.ok(validarDetalhe('Atrasado', { novoInicio: '10:40' }, 610).erro);
    assert.ok(validarDetalhe('Atrasado', {}, 610).erro);
  });

  it('os outros status não têm detalhe', () => {
    for (const st of ['Pendente', 'Confirmado', 'Em Voo']) assert.deepEqual(validarDetalhe(st, { motivo: 'Meteorologia' }, 610), { detalhe: null });
  });

  it('status guardados: só os da lista, em chaves de voo (o resto, gravado fora do formato, sai)', () => {
    const ataque = 'x"><img/src/onerror=window.__xss=1>';
    assert.deepEqual(normalizarStatus({ '1000_0_1': 'Em Voo', '1001_0_1': ataque, [ataque]: 'Cancelado', '1002_0_1': 'Atrasado', '1003_0_1': 7 }),
      { '1000_0_1': 'Em Voo', '1002_0_1': 'Atrasado' });
    assert.deepEqual(normalizarStatus(undefined), {});
    assert.deepEqual(normalizarStatus(['Cancelado']), {});
  });

  it('a classe CSS de cada status vem de uma lista fixa (o desconhecido vale como Confirmado)', () => {
    assert.deepEqual(FLIGHT_STATUSES.map(classeDoStatus), ['Pendente', 'Confirmado', 'Atrasado', 'EmVoo', 'Cancelado']);
    assert.equal(classeDoStatus('x"><img/src/onerror=1>'), 'Confirmado');
    assert.equal(classeDoStatus(undefined), 'Confirmado');
  });

  it('detalhes guardados: só os do status atual de cada voo e nos formatos válidos', () => {
    const fStatus = { '1000_0_1': 'Cancelado', '1001_0_1': 'Atrasado', '1002_0_1': 'Confirmado', '1003_0_1': 'Cancelado', '1004_0_1': 'Cancelado', '1005_0_1': 'Atrasado' };
    const fObs = {
      '1000_0_1': { motivo: 'Outro', texto: 'Pista interditada', extra: 1 },
      '1001_0_1': { novoInicio: 640 },
      '1002_0_1': { motivo: 'Meteorologia' },
      '1003_0_1': { motivo: 'Chuva' },
      '1004_0_1': { motivo: 'Outro' },
      '1005_0_1': { novoInicio: 2000 },
      '<img>': { motivo: 'Meteorologia' },
      '1006_0_1': 'x'
    };
    assert.deepEqual(normalizarDetalhes(fObs, fStatus), {
      '1000_0_1': { motivo: 'Outro', texto: 'Pista interditada' },
      '1001_0_1': { novoInicio: 640 },
      // O link do Gestor não leva o texto: "Outro" sem texto continua valendo
      '1004_0_1': { motivo: 'Outro' }
    });
    assert.deepEqual(normalizarDetalhes(undefined, fStatus), {});
    assert.deepEqual(normalizarDetalhes({ '1000_0_1': { motivo: 'Outro', texto: 'y'.repeat(300) } }, fStatus)['1000_0_1'].texto.length, LIMITE_DO_TEXTO);
  });

  it('textos: na escala e no CSV o detalhe completo; no histórico só a categoria do motivo', () => {
    assert.equal(textoDoStatus('Atrasado', { novoInicio: 640 }), 'Atrasado: nova decolagem 10:40');
    assert.equal(textoDoStatus('Cancelado', { motivo: 'Meteorologia' }), 'Cancelado: Meteorologia');
    assert.equal(textoDoStatus('Cancelado', { motivo: 'Outro', texto: 'Pista interditada' }), 'Cancelado: Pista interditada');
    assert.equal(textoDoStatus('Cancelado', { motivo: 'Outro' }), 'Cancelado: Outro');
    assert.equal(textoDoStatus('Cancelado', undefined), 'Cancelado');
    assert.equal(textoDoStatus('Em Voo', undefined), 'Em Voo');
    assert.deepEqual([textoDoDetalhe('Atrasado', { novoInicio: 640 }), textoDoDetalhe('Cancelado', { motivo: 'Outro', texto: 'Pista interditada' }),
      textoDoDetalhe('Cancelado', { motivo: 'Aluno ausente' }), textoDoDetalhe('Em Voo', { motivo: 'Aluno ausente' })],
    ['nova decolagem 10:40', 'Pista interditada', 'Aluno ausente', '']);
    assert.equal(textoParaOHistorico('Cancelado', { motivo: 'Outro', texto: 'Aluno com febre' }), 'Cancelado (Outro)');
    assert.equal(textoParaOHistorico('Cancelado', { motivo: 'Aluno ausente' }), 'Cancelado (Aluno ausente)');
    assert.equal(textoParaOHistorico('Atrasado', { novoInicio: 640 }), 'Atrasado (nova decolagem 10:40)');
    assert.equal(textoParaOHistorico('Confirmado', null), 'Confirmado');
  });

  it('o voo atrasado sai no novo horário, com a mesma duração', () => {
    assert.deepEqual(intervaloEfetivo({ a: 610, b: 730 }, 'Atrasado', { novoInicio: 640 }), { a: 640, b: 760 });
    assert.deepEqual(intervaloEfetivo({ a: 610, b: 730 }, 'Confirmado', { novoInicio: 640 }), { a: 610, b: 730 });
    assert.deepEqual(intervaloEfetivo({ a: 610, b: 730 }, 'Atrasado', undefined), { a: 610, b: 730 });
  });
});

describe('Atraso que invade o voo seguinte', () => {
  it('mesmo recurso, mesmo instrutor ou mesmo aluno: conflito, com o motivo', () => {
    const out = [voo('1000_0_1', 610), voo('1001_0_1', 690, { r: 'PR-VOC', insId: 2 })];
    const fStatus = { '1000_0_1': 'Atrasado' };
    assert.deepEqual(conflitosDeAtraso(out, fStatus, { '1000_0_1': { novoInicio: 640 } }), []);
    assert.deepEqual(conflitosDeAtraso([voo('1000_0_1', 610), voo('1001_0_1', 690)], fStatus, { '1000_0_1': { novoInicio: 640 } }),
      [{ fKey: '1000_0_1', com: '1001_0_1', motivos: ['recurso', 'instrutor'] }]);
    assert.deepEqual(conflitosDeAtraso([voo('1000_0_1', 610), voo('1000_1_1', 690, { r: 'PR-VOC', insId: 2 })], fStatus, { '1000_0_1': { novoInicio: 640 } }),
      [{ fKey: '1000_0_1', com: '1000_1_1', motivos: ['aluno'] }]);
  });

  it('voo cancelado não conta; voo seguinte também atrasado conta no horário novo dele', () => {
    const out = [voo('1000_0_1', 610), voo('1001_0_1', 690)];
    assert.deepEqual(conflitosDeAtraso(out, { '1000_0_1': 'Atrasado', '1001_0_1': 'Cancelado' }, { '1000_0_1': { novoInicio: 640 } }), []);
    assert.deepEqual(conflitosDeAtraso(out, { '1000_0_1': 'Atrasado', '1001_0_1': 'Atrasado' },
      { '1000_0_1': { novoInicio: 640 }, '1001_0_1': { novoInicio: 700 } }), []);
  });

  it('o atraso que invade uma turma de Ground conta uma vez (pelo primeiro aluno da turma)', () => {
    const turma = ['1001_0_1', '1002_0_1', '1003_0_1'].map(k => voo(k, 500, { classKey: 'GND_Ground C152_1_2', r: 'SALA-GROUND', insId: 2, b: 590 }));
    const atrasado = voo('1000_0_1', 390, { classKey: 'GND_Ground PA-34_0_3', r: 'SALA-GROUND', insId: 3, b: 480 });
    assert.deepEqual(conflitosDeAtraso([atrasado, ...turma], { '1000_0_1': 'Atrasado' }, { '1000_0_1': { novoInicio: 450 } }),
      [{ fKey: '1000_0_1', com: '1001_0_1', motivos: ['recurso'] }]);
  });

  it('os alunos da mesma turma de Ground não conflitam entre si', () => {
    const turma = ['1000_0_1', '1001_0_1'].map(k => voo(k, 390, { classKey: 'GND_Ground C152_0_1', r: 'SALA-GROUND', b: 480 }));
    assert.deepEqual(conflitosDeAtraso(turma, { '1000_0_1': 'Atrasado' }, { '1000_0_1': { novoInicio: 400 } }), []);
  });

  it('o motor avisa o conflito do atraso (e a escala não muda)', () => {
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 610, p2: -1 }), aluno(1001, { p1: 690, p2: -1 })] });
    const antes = runAllocationEngine(base);
    const [primeiro] = antes.out;
    const depois = runAllocationEngine({ ...base, fStatus: { [primeiro.fKey]: 'Atrasado' }, fObs: { [primeiro.fKey]: { novoInicio: 640 } } });
    assert.deepEqual(depois.out.map(o => [o.fKey, o.a, o.r, o.insId]), antes.out.map(o => [o.fKey, o.a, o.r, o.insId]));
    const aviso = depois.al.find(a => a.m.startsWith('Atraso:'));
    assert.ok(aviso, 'aviso do atraso');
    assert.equal(aviso.t, 'warn');
    assert.equal(aviso.s, 'Aluno 1000');
    assert.match(aviso.m, /nova decolagem às 10:40 \(pouso às 11:40\).*voo das 11:30 de Aluno 1001/);
    assert.match(aviso.m, /mesmo instrutor \(Instrutor 01\)/);
    assert.equal(antes.al.some(a => a.m.startsWith('Atraso:')), false);
  });

  it('turma de Ground atrasada: o aviso aparece uma vez por voo atrasado', () => {
    const turma = [1000, 1001].map(id => aluno(id, { ...GROUND_C152, p1: 390, p2: -1 }));
    const base = cenario({ ins: [instrutor(1, 9)], stu: turma });
    const { out } = runAllocationEngine(base);
    const fStatus = Object.fromEntries(out.map(o => [o.fKey, 'Atrasado']));
    const fObs = Object.fromEntries(out.map(o => [o.fKey, { novoInicio: 420 }]));
    assert.equal(runAllocationEngine({ ...base, fStatus, fObs }).al.filter(a => a.m.startsWith('Atraso:')).length, 0);
  });
});
