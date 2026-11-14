// Horários de decolagem por categoria (fase 7): cada categoria tem a sua lista, em minutos. As 9 janelas viram os
// períodos do dia (janelas de operação, disponibilidade dos instrutores e manhã/tarde/noite).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HORARIOS_PADRAO, HORARIOS_INICIAIS, normalizarHorarios, horariosDoTipo, periodoDoMinuto, minutoDaPreferencia, preferenciaValida, paraMinuto,
  preferenciasPadrao
} from '../../js/horarios.js';
import { hm } from '../../js/format.js';

describe('Horários de decolagem por categoria', () => {
  it('padrão: as 8 janelas do dia; o PA-34, de 30 em 30 minutos, das 06:30 às 16:30', () => {
    assert.deepEqual(HORARIOS_PADRAO.map(hm), ['06:30', '08:20', '10:10', '11:30', '12:40', '13:40', '14:30', '16:20']);
    assert.deepEqual(Object.keys(HORARIOS_INICIAIS), ['C152', 'C172', 'sim', 'PA-34']);
    assert.deepEqual(HORARIOS_INICIAIS.C152, HORARIOS_PADRAO);
    assert.equal(HORARIOS_INICIAIS['PA-34'].length, 21);
    assert.deepEqual(HORARIOS_INICIAIS['PA-34'].slice(0, 3).map(hm), ['06:30', '07:00', '07:30']);
    assert.equal(hm(HORARIOS_INICIAIS['PA-34'].at(-1)), '16:30');
  });

  it('normaliza: em ordem, sem repetir e só no dia (06:00 às 17:00); categoria sem lista válida recebe a inicial', () => {
    const h = normalizarHorarios({ C152: [610, 390, 390, 1200, 'x', 300], 'PA-34': [] });
    assert.deepEqual(h.C152, [390, 610]);
    assert.deepEqual(h['PA-34'], HORARIOS_INICIAIS['PA-34']);
    assert.deepEqual(h.C172, HORARIOS_INICIAIS.C172);
    assert.deepEqual(normalizarHorarios(undefined), HORARIOS_INICIAIS);
  });

  it('a lista de cada tipo: os simuladores pela categoria Simulador; a sala de Ground, as janelas do dia', () => {
    const horarios = { ...HORARIOS_INICIAIS, sim: [420, 480] };
    assert.deepEqual(horariosDoTipo(horarios, 'Sim. Multi'), [420, 480]);
    assert.deepEqual(horariosDoTipo(horarios, 'PA-34'), HORARIOS_INICIAIS['PA-34']);
    assert.deepEqual(horariosDoTipo(horarios, 'Sala Ground'), HORARIOS_PADRAO);
    assert.deepEqual(horariosDoTipo(undefined, 'C152'), HORARIOS_PADRAO);
  });

  it('o período de um horário é a janela de operação em que ele cai', () => {
    assert.deepEqual([390, 420, 499, 500, 510, 980, 1050].map(periodoDoMinuto), [0, 0, 0, 1, 1, 7, 8]);
  });

  it('preferência em minutos; o número da janela dos dados antigos vira o horário da janela; fora do dia, sem preferência', () => {
    assert.deepEqual([-1, 0, 1, 8, 450, 510].map(minutoDaPreferencia), [-1, 390, 500, 1050, 450, 510]);
    assert.deepEqual([99, 300, 1100, -5, 2.5, 'x', 1050].map(preferenciaValida), [-1, -1, -1, -1, -1, -1, 1050]);
    assert.equal(paraMinuto('07:30'), 450);
    assert.equal(paraMinuto('7:3'), null);
  });

  it('preferências de um pedido novo: os primeiros horários da lista a partir das 08:20 e das 10:10', () => {
    assert.deepEqual(preferenciasPadrao(HORARIOS_PADRAO).map(hm), ['08:20', '10:10']);
    assert.deepEqual(preferenciasPadrao(HORARIOS_INICIAIS['PA-34']).map(hm), ['08:30', '10:30']);
    assert.deepEqual(preferenciasPadrao([420]).map(hm), ['07:00', '07:00']);
  });
});

describe('Horários por categoria: o motor', async () => {
  const { runAllocationEngine } = await import('../../js/engine.js');
  const { aluno, cenario, instrutor, GROUND_C152 } = await import('../helpers/montar.js');
  const escala = (opts, horarios) => runAllocationEngine({ ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], ...opts }), ...(horarios ? { horarios } : {}) });
  const multimotor = (id, extra = {}) => aluno(id, { mis: 'Multimotor', eq: 'PA-34', nb: 1, ...extra });

  it('o PA-34 sai de 30 em 30 minutos: o pedido para as 07:30 sai às 07:30, no período do 1º tempo', () => {
    const [voo] = escala({ stu: [multimotor(1000, { p1: 450, p2: 510 })] }).out;
    assert.deepEqual({ inicio: hm(voo.a), tag: voo.tag, periodo: voo.w }, { inicio: '07:30', tag: 'Pref. 1', periodo: 0 });
  });

  it('a lista da categoria manda: um C152 com horários próprios só sai neles', () => {
    const [voo] = escala({ stu: [aluno(1000, { p1: 500, p2: 610 })] }, { ...HORARIOS_INICIAIS, C152: [420, 900] }).out;
    assert.deepEqual({ inicio: hm(voo.a), tag: voo.tag }, { inicio: '07:00', tag: 'Próximo livre' });
  });

  it('a janela de operação fechada fecha os horários da categoria que caem nela', () => {
    const [voo] = escala({ stu: [multimotor(1000, { p1: 450, p2: -1 })], janelasOff: [0] }).out;
    assert.equal(hm(voo.a), '08:30');
  });

  it('a disponibilidade do aluno vale por período ("Tarde") e por horário exato ("Só às 07:30")', () => {
    const [tarde] = escala({ stu: [multimotor(1000, { p1: -1, p2: -1, jan: 'tarde' })] }).out;
    assert.equal(hm(tarde.a), '13:00');
    const [exato] = escala({ stu: [multimotor(1000, { p1: -1, p2: -1, jan: 'h450' })] }).out;
    assert.equal(hm(exato.a), '07:30');
  });

  it('preferências em minutos; o número da janela dos dados antigos também vale', () => {
    const [emMinutos] = escala({ stu: [aluno(1000, { p1: 610, p2: 690 })] }).out;
    const [antigo] = escala({ stu: [aluno(1000, { p1: 2, p2: 3 })] }).out;
    assert.deepEqual([hm(emMinutos.a), emMinutos.tag, hm(antigo.a), antigo.tag], ['10:10', 'Pref. 1', '10:10', 'Pref. 1']);
  });

  it('o Ground continua nas janelas do dia, com a preferência em minutos', () => {
    const [aula] = escala({ stu: [aluno(1000, { ...GROUND_C152, p1: 500, p2: 610 })] }).out;
    assert.deepEqual({ inicio: hm(aula.a), tag: aula.tag }, { inicio: '08:20', tag: 'Pref. 1' });
  });
});

describe('Horários por categoria: formato 12 dos dados', async () => {
  const { ESQUEMA, migrarCadastro, migrarDia } = await import('../../js/migracoes.js');

  it('o cadastro ganha os horários iniciais, antes de "esquema" (a ordem em que o app grava)', () => {
    const novo = migrarCadastro({ nid: 1000, ins: [], stu: [], frota: [], esquema: 11 });
    assert.ok(ESQUEMA >= 12);
    assert.deepEqual(novo.horarios, HORARIOS_INICIAIS);
    assert.deepEqual(Object.keys(novo), ['nid', 'ins', 'stu', 'frota', 'horarios', 'limites', 'cursos', 'esquema']);
    const proprios = { ...HORARIOS_INICIAIS, C152: [420] };
    assert.deepEqual(migrarCadastro({ nid: 1000, ins: [], stu: [], frota: [], horarios: proprios, esquema: 11 }).horarios, proprios);
  });

  it('os pedidos do dia passam a guardar o horário (minutos) no lugar do número da janela; "h5" vira "h820"', () => {
    const dia = migrarDia({ esquema: 11, pedidos: {
      1000: { fly: true, mis: 'Voo Local', eq: 'C152', p1: 1, p2: -1, jan: 'h5', extra: [{ mid: 1, fly: true, p1: 8, p2: 2, jan: 'tarde' }] },
      1001: { fly: false, mis: 'Voo Local', eq: 'C152', p1: 610, p2: 690 }
    } });
    assert.deepEqual(dia.pedidos[1000], { fly: true, mis: 'Voo Local', eq: 'C152', p1: 500, p2: -1, jan: 'h820', extra: [{ mid: 1, fly: true, p1: 1050, p2: 610, jan: 'tarde' }] });
    assert.deepEqual(dia.pedidos[1001], { fly: false, mis: 'Voo Local', eq: 'C152', p1: 610, p2: 690 });
  });

  it('os pedidos de PA-34 vão para o horário mais próximo da lista nova (de 30 em 30 minutos)', () => {
    const dia = migrarDia({ esquema: 11, pedidos: {
      1000: { fly: true, mis: 'Multimotor', eq: 'PA-34', p1: 1, p2: 2, extra: [{ mid: 1, fly: true, mis: 'IFR', eq: 'PA-34', p1: 4, p2: -1 }] }
    } });
    assert.deepEqual([dia.pedidos[1000].p1, dia.pedidos[1000].p2], [510, 630]);
    assert.deepEqual([dia.pedidos[1000].extra[0].p1, dia.pedidos[1000].extra[0].p2], [780, -1]);
  });
});

describe('Horários por categoria: trocar a missão ou o avião do pedido', async () => {
  const { ajustarPreferencias, horariosDaMissao } = await import('../../js/horarios.js');
  const ajustado = (pedido, mis, eq) => { const p = { ...pedido, mis, eq }; ajustarPreferencias(p, horariosDaMissao(HORARIOS_INICIAIS, mis, eq)); return p; };

  it('as preferências vão para o horário mais próximo (a partir delas) da lista nova', () => {
    assert.deepEqual(ajustado({ p1: 500, p2: 610 }, 'Multimotor', 'PA-34'), { p1: 510, p2: 630, mis: 'Multimotor', eq: 'PA-34' });
    assert.deepEqual(ajustado({ p1: 450, p2: -1 }, 'Voo Local', 'C152'), { p1: 500, p2: -1, mis: 'Voo Local', eq: 'C152' });
  });

  it('para o Noturno, 17:30; ao sair do Noturno, as preferências padrão', () => {
    assert.deepEqual(ajustado({ p1: 500, p2: 610 }, 'Noturno', 'C172'), { p1: 1050, p2: 1050, mis: 'Noturno', eq: 'C172' });
    assert.deepEqual(ajustado({ p1: 1050, p2: 1050 }, 'Voo Local', 'C152'), { p1: 500, p2: 610, mis: 'Voo Local', eq: 'C152' });
  });

  it('um horário exato que a lista nova não tem deixa de valer; um período continua', () => {
    assert.equal(ajustado({ p1: 450, p2: 450, jan: 'h450' }, 'Voo Local', 'C152').jan, undefined);
    assert.equal(ajustado({ p1: 450, p2: 450, jan: 'tarde' }, 'Voo Local', 'C152').jan, 'tarde');
    assert.equal(ajustado({ p1: 500, p2: 500, jan: 'h500' }, 'Voo Local', 'C172').jan, 'h500');
  });
});
