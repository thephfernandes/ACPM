// Horários de decolagem por categoria: cada categoria tem a sua lista, em minutos. As 9 janelas são os
// períodos do dia (janelas de operação, disponibilidade dos instrutores e manhã/tarde/noite).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HORARIOS_PADRAO, HORARIOS_INICIAIS, normalizarHorarios, horariosDoTipo, periodoDoMinuto, minutoDaPreferencia, preferenciaValida, paraMinuto,
  preferenciasPadrao, DE_30_EM_30, modeloDosHorarios, descreverHorarios, porPeriodo, impactoDosHorarios, resumoDoImpacto,
  PRIMEIRO_HORARIO, ULTIMO_HORARIO, fimDaMissao
} from '../../js/horarios.js';
import { hm } from '../../js/format.js';

describe('Horários de decolagem por categoria', () => {
  it('padrão: os 8 horários padrão; o PA-34, de 30 em 30 minutos, das 06:30 às 16:30', () => {
    assert.deepEqual(HORARIOS_PADRAO.map(hm), ['06:30', '08:20', '10:10', '11:30', '12:40', '13:40', '14:30', '16:20']);
    // J (N11): a Sala Ground é uma categoria como as outras, com os oito horários que o Ground usava
    assert.deepEqual(Object.keys(HORARIOS_INICIAIS), ['C152', 'C172', 'sim', 'PA-34', 'ground']);
    assert.deepEqual(HORARIOS_INICIAIS.C152, HORARIOS_PADRAO);
    assert.deepEqual(HORARIOS_INICIAIS.ground, HORARIOS_PADRAO);
    assert.notEqual(HORARIOS_INICIAIS.ground, HORARIOS_PADRAO, 'uma cópia: editar a lista da sala não muda o padrão');
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

  it('a lista de cada tipo: os simuladores pela categoria Simulador; a Sala Ground, a sua (sem ela, os horários padrão)', () => {
    const horarios = { ...HORARIOS_INICIAIS, sim: [420, 480] };
    assert.deepEqual(horariosDoTipo(horarios, 'Sim. Multi'), [420, 480]);
    assert.deepEqual(horariosDoTipo(horarios, 'PA-34'), HORARIOS_INICIAIS['PA-34']);
    assert.deepEqual(horariosDoTipo(horarios, 'Sala Ground'), HORARIOS_PADRAO);
    assert.deepEqual(horariosDoTipo({ ...HORARIOS_INICIAIS, ground: [420, 600] }, 'Sala Ground'), [420, 600]);
    // O cadastro gravado antes do formato 28 não tem a lista da sala: os oito horários de antes
    const { ground, ...semASala } = HORARIOS_INICIAIS;
    assert.ok(ground);
    assert.deepEqual(horariosDoTipo(semASala, 'Sala Ground'), HORARIOS_PADRAO);
    assert.deepEqual(normalizarHorarios(semASala).ground, HORARIOS_PADRAO);
    assert.deepEqual(horariosDoTipo(undefined, 'C152'), HORARIOS_PADRAO);
  });

  it('os 40 cenários e o exemplo com a lista da sala igual à padrão dão os goldens', async () => {
    const { runAllocationEngine } = await import('../../js/engine.js');
    const { gerarCenario } = await import('../helpers/cenarios.js');
    const { lerGoldens } = await import('../helpers/goldens.js');
    const comASala = estado => ({ ...estado, horarios: structuredClone(HORARIOS_INICIAIS) });
    const goldens = lerGoldens();
    assert.deepEqual(JSON.parse(JSON.stringify(runAllocationEngine(comASala(goldens.exemplo.estado)))), goldens.exemplo.saida);
    for (const { seed, saida } of goldens.cenarios) {
      assert.deepEqual(JSON.parse(JSON.stringify(runAllocationEngine(comASala(gerarCenario(seed))))), saida, `cenário ${seed}`);
    }
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

  it('a disponibilidade do aluno é um horário exato ("às 07:30"); um período guardado ("tarde") vale como nenhum (J, N13)', () => {
    const [tarde] = escala({ stu: [multimotor(1000, { p1: -1, p2: -1, jan: 'tarde' })] }).out;
    const [nenhuma] = escala({ stu: [multimotor(1000, { p1: -1, p2: -1 })] }).out;
    assert.equal(hm(tarde.a), hm(nenhuma.a));
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
    // O "tarde" do pedido extra sai (J, N13: não há período do dia)
    assert.deepEqual(dia.pedidos[1000], { fly: true, mis: 'Voo Local', eq: 'C152', p1: 500, p2: -1, jan: 'h820', extra: [{ mid: 1, fly: true, p1: 1050, p2: 610 }] });
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
    // O horário exato do pedido fica, mesmo fora da lista nova (J, N14): o motor o recusa no horário dele, até a lista ter o
    // minuto de novo ou o horário mudar
    assert.equal(ajustado({ p1: 450, p2: 450, jan: 'h450' }, 'Voo Local', 'C152').jan, 'h450');
    assert.equal(ajustado({ p1: 450, p2: 450, jan: 'tarde' }, 'Voo Local', 'C152').jan, 'tarde');
    assert.equal(ajustado({ p1: 500, p2: 500, jan: 'h500' }, 'Voo Local', 'C172').jan, 'h500');
  });
});

// Sem vaga na 1ª nem na 2ª preferência, o horário mais perto da 1ª (sem a 1ª, da 2ª); empatados, o mais cedo.
// Sem preferência, em ordem
describe('Horários pela distância da preferência', () => {
  it('a 1ª e a 2ª preferência primeiro, depois pela distância da 1ª; o empate vai para o mais cedo', async () => {
    const { ordenarPelaPreferencia } = await import('../../js/horarios.js');
    const lista = [390, 500, 610, 690, 760, 820, 870, 980];
    assert.deepEqual(ordenarPelaPreferencia(lista, 760, 390), [760, 390, 820, 690, 870, 610, 980, 500]);
    assert.deepEqual(ordenarPelaPreferencia(lista, 500, -1), [500, 390, 610, 690, 760, 820, 870, 980]);
  });

  it('sem a 1ª, pela distância da 2ª; sem nenhuma, em ordem', async () => {
    const { ordenarPelaPreferencia } = await import('../../js/horarios.js');
    const lista = [390, 500, 610, 690, 760];
    assert.deepEqual(ordenarPelaPreferencia(lista, -1, 690), [690, 760, 610, 500, 390]);
    assert.deepEqual(ordenarPelaPreferencia(lista, -1, -1), lista);
  });

  it('a preferência fora da lista não entra, mas a distância conta a partir dela', async () => {
    const { ordenarPelaPreferencia } = await import('../../js/horarios.js');
    assert.deepEqual(ordenarPelaPreferencia([390, 500, 610], 450, -1), [500, 390, 610]);
  });
});

// O Voo Solo sai sempre às 06:30 (local ou navegação)
describe('O Voo Solo às 06:30', () => {
  it('a missão Voo Solo só tem o horário das 06:30, em qualquer avião', async () => {
    const { horariosDaMissao, HORARIOS_INICIAIS } = await import('../../js/horarios.js');
    assert.deepEqual(horariosDaMissao(HORARIOS_INICIAIS, 'Voo Solo', 'C152'), [390]);
    assert.deepEqual(horariosDaMissao(HORARIOS_INICIAIS, 'Voo Solo', 'PA-34'), [390]);
  });

  it('o motor põe o Solo às 06:30, mesmo com outra preferência', async () => {
    const { runAllocationEngine } = await import('../../js/engine.js');
    const { aluno, cenario, instrutor } = await import('../helpers/montar.js');
    const { out } = runAllocationEngine(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { mis: 'Voo Solo', p1: 760, p2: 870 })] }));
    assert.equal(out[0].a, 390);
  });
});

// O painel mostra um resumo de cada lista e edita numa caixa só
describe('O resumo dos horários e o efeito de uma lista nova', () => {
  const h = texto => paraMinuto(texto);

  it('o modelo da lista: os horários padrão, de 30 em 30 minutos, ou personalizada', () => {
    assert.equal(modeloDosHorarios(HORARIOS_PADRAO), 'padrao');
    assert.equal(modeloDosHorarios(DE_30_EM_30), 'de30');
    assert.equal(modeloDosHorarios([390, 450]), 'personalizado');
    assert.equal(modeloDosHorarios([...HORARIOS_PADRAO].reverse()), 'padrao', 'a ordem não importa');
  });

  it('a descrição: o nome do modelo, ou as sequências de mesmo intervalo resumidas e os horários soltos', () => {
    assert.equal(descreverHorarios(HORARIOS_PADRAO), 'Horários padrão');
    assert.equal(descreverHorarios(DE_30_EM_30), 'De 30 em 30 min, 06:30–16:30');
    assert.equal(descreverHorarios([h('07:00'), h('07:30'), h('08:00'), h('08:30'), h('14:00'), h('15:10')]), '07:00–08:30 de 30 em 30 min, 14:00, 15:10');
    assert.equal(descreverHorarios([h('07:00'), h('09:00')]), '07:00, 09:00', 'dois horários não fazem sequência');
    assert.equal(descreverHorarios([h('06:30'), h('07:30'), h('08:30'), h('12:00'), h('12:20'), h('12:40')]), '06:30–08:30 de 1 em 1 h, 12:00–12:40 de 20 em 20 min');
  });

  it('manhã (antes das 12:00) e tarde', () => {
    assert.deepEqual(porPeriodo(HORARIOS_PADRAO), { manha: [390, 500, 610, 690], tarde: [760, 820, 870, 980] });
    assert.deepEqual(porPeriodo([720]), { manha: [], tarde: [720] });
  });

  it('o efeito nos pedidos da categoria: quem muda de preferência e quem fica fora da lista (o horário exato que ela não tem)', () => {
    const pedidos = [
      { nome: 'Ana', pedido: { mis: 'Voo Local', eq: 'C152', p1: 390, p2: 610 } },
      { nome: 'Bia', pedido: { mis: 'Voo Local', eq: 'C152', p1: 500, p2: -1, jan: 'h500' } },
      { nome: 'Caio', pedido: { mis: 'Voo Local', eq: 'C172', p1: 500, p2: -1 } },
      { nome: 'Davi', pedido: { mis: 'Noturno', eq: 'C152', p1: 1050, p2: -1 } }
    ];
    const efeito = impactoDosHorarios(pedidos, HORARIOS_INICIAIS, 'C152', [390, 610, 760]);
    assert.deepEqual(efeito, { mudam: ['Bia'], foraDaLista: [{ nome: 'Bia', minuto: 500 }] });
    assert.equal(resumoDoImpacto(efeito), '1 pedido muda de preferência; 1 fica fora da lista (às 08:20).');
    assert.equal(resumoDoImpacto(impactoDosHorarios(pedidos, HORARIOS_INICIAIS, 'C152', [...HORARIOS_PADRAO])), 'Nenhum pedido muda.');
    const dois = impactoDosHorarios(pedidos, HORARIOS_INICIAIS, 'C152', [400]);
    assert.deepEqual(dois.mudam, ['Ana', 'Bia']);
    assert.equal(resumoDoImpacto(dois), '2 pedidos mudam de preferência; 1 fica fora da lista (às 08:20).');
    assert.equal(resumoDoImpacto({ mudam: [], foraDaLista: [{ nome: 'A', minuto: 500 }, { nome: 'B', minuto: 610 }] }), '2 ficam fora da lista.');
    // Os pedidos não mudam (o efeito só calcula)
    assert.equal(pedidos[1].pedido.jan, 'h500');
  });

  it('no editor, os horários vão das 06:00 às 16:30 (o último que cabe um voo de 1 h antes do noturno)', () => {
    assert.deepEqual([PRIMEIRO_HORARIO, ULTIMO_HORARIO].map(hm), ['06:00', '16:30']);
  });
});

describe('Até quando a missão pode ir', () => {
  it('o voo de dia no avião pousa até as 17:30, quando começa a noite', () => {
    for (const tipo of ['C152', 'C172', 'PA-34']) assert.equal(fimDaMissao('Voo Local', tipo), 1050, tipo);
  });

  it('o Noturno, o simulador e a aula de Ground não dependem da luz do dia: vão até o fim do dia', () => {
    assert.equal(fimDaMissao('Noturno', 'C172'), 1440);
    assert.equal(fimDaMissao('Simulador', 'Sim. Mono'), 1440);
    assert.equal(fimDaMissao('Simulador', 'Sim. Multi'), 1440);
    assert.equal(fimDaMissao('Ground C152', 'Sala Ground'), 1440);
  });
});
