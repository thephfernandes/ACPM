import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGroundMission, doesGroundGateFlight, migrateLegacyMissionName, normalizeMissionFields, blank, disponibilidadeDoAluno, disponibilidadeAtual,
  rotuloDaDisponibilidade, opcoesDeDisponibilidade, proximoMid, duracaoDigitada, ERRO_DA_DURACAO, chaveTemSobras, alvoDoNovoPedido,
  pesoValido, pesoDigitado, pesoDoTexto, ERRO_DO_PESO, deixarEmBranco
} from '../../js/rules.js';
import { podeFazer, descreverExigencias } from '../../js/habilitacoes.js';

describe('Regras de missão', () => {
  it('identifica as missões de Ground School', () => {
    assert.deepEqual(
      ['Ground C152', 'Ground C172', 'Ground PA-34', 'Ground Navegação', 'Voo Local', 'Simulador', 'Inexistente'].map(isGroundMission),
      [true, true, true, true, false, false, false]
    );
  });


  it('Ground de aeronave libera voos naquele equipamento; Ground Navegação libera Navegação', () => {
    assert.equal(doesGroundGateFlight('Ground C152', { mis: 'Voo Local', eq: 'C152' }), true);
    assert.equal(doesGroundGateFlight('Ground C152', { mis: 'Voo Local', eq: 'C172' }), false);
    assert.equal(doesGroundGateFlight('Ground PA-34', { mis: 'Multimotor', eq: 'PA-34' }), true);
    assert.equal(doesGroundGateFlight('Ground Navegação', { mis: 'Navegação', eq: 'C172' }), true);
    assert.equal(doesGroundGateFlight('Ground Navegação', { mis: 'Voo Local', eq: 'C152' }), false);
    assert.equal(doesGroundGateFlight('Ground C152', { mis: 'Ground C172', eq: 'Sala Ground' }), false);
    assert.equal(doesGroundGateFlight('Voo Local', { mis: 'Voo Local', eq: 'C152' }), false);
  });

  it('migra nomes de missão das versões anteriores', () => {
    assert.deepEqual(
      ['PP Local', 'PP Navegação (>27nm)', 'PC Visual', 'Multi', 'INVA', 'TGL', 'Ground de Navegação', 'IFR', '???'].map(migrateLegacyMissionName),
      ['Voo Local', 'Navegação', 'Voo Local', 'Multimotor', 'Voo Local', 'Voo Local', 'Ground Navegação', 'IFR', 'Voo Local']
    );
  });

  it('normaliza pedidos de Ground: sala, 01h30, sessão única e sem horário noturno', () => {
    const pedido = { mis: 'Ground C172', eq: 'C172', p1: 8, p2: 1050, nb: 3, ss: 2 };
    normalizeMissionFields(pedido);
    assert.deepEqual(pedido, { mis: 'Ground C172', eq: 'Sala Ground', p1: 390, p2: 500, nb: 1.5, ss: 1 });
  });

  it('um valor gravado que não é texto nem número (um objeto que não vira texto) não para a abertura: vale o padrão', () => {
    // JSON.parse('{"toString": null}'): converter para texto ou número dá TypeError (docs/PLAN.md:440)
    const hostil = () => JSON.parse('{"toString": null}');
    const pedido = { fly: true, mis: hostil(), eq: 'C152', p1: 500, p2: 610, nb: hostil(), ss: 1, pr: hostil(), jan: hostil() };
    assert.doesNotThrow(() => normalizeMissionFields(pedido));
    assert.deepEqual(pedido, { fly: true, mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, pr: 3 });
    // Cada campo sozinho, também numa lista (que vira texto) e num número válido ao lado
    for (const campo of ['mis', 'nb', 'pr', 'jan']) {
      const um = { mis: 'Navegação', eq: 'C152', p1: 500, p2: 610, nb: 2, ss: 1, pr: 2, jan: 'manha', [campo]: hostil() };
      assert.doesNotThrow(() => normalizeMissionFields(um), campo);
    }
    const comLista = { mis: ['Navegação'], eq: 'C152', p1: 500, p2: -1, nb: [2], ss: 1 };
    assert.doesNotThrow(() => normalizeMissionFields(comLista));
    assert.equal(comLista.mis, 'Voo Local');
  });

  // Q8 (F1d): a confirmação do 7º voo local no pedido do dia fica só quando é true; o pedido em branco não a leva
  it('limiteConfirmado fica só quando é true, e o pedido em branco não o leva', () => {
    for (const [valor, fica] of [[true, true], [false, false], ['sim', false], [1, false], [null, false]]) {
      const pedido = { mis: 'Voo Local', eq: 'C152', p1: 500, p2: -1, nb: 1, ss: 1, jan: 'h500', limiteConfirmado: valor };
      normalizeMissionFields(pedido);
      assert.equal(Object.hasOwn(pedido, 'limiteConfirmado'), fica, String(valor));
    }
    const pedido = { ...blank(), fly: true, jan: 'h500', limiteConfirmado: true, solicitacao: 3 };
    deixarEmBranco(pedido);
    assert.equal(Object.hasOwn(pedido, 'limiteConfirmado'), false);
  });

  it('uma sessão por missão: pedidos antigos com 2 ou 3 sessões passam a ter uma só (para dividir, "+ missão")', () => {
    const pedido = { mis: 'Navegação', eq: 'C152', p1: 500, p2: 610, nb: 3, ss: 2 };
    normalizeMissionFields(pedido);
    assert.deepEqual(pedido, { mis: 'Navegação', eq: 'C152', p1: 500, p2: 610, nb: 3, ss: 1 });
  });

  it('normaliza pedidos de voo: equipamento permitido e preferências em minutos', () => {
    const pedido = { mis: 'Multi', eq: 'C152', p1: 1, p2: 2, nb: 1.5, ss: 1 };
    normalizeMissionFields(pedido);
    assert.deepEqual(pedido, { mis: 'Multimotor', eq: 'PA-34', p1: 500, p2: 610, nb: 1.5, ss: 1 });
  });

  it('a duração do voo: de 0,1 h a 5 h, em décimos; acima de 5 h fica 5; fora disso, 1 h', () => {
    const nb = valor => { const p = { mis: 'Voo Local', eq: 'C152', p1: 390, p2: -1, nb: valor }; normalizeMissionFields(p); return p.nb; };
    assert.deepEqual([nb(1.2), nb(2.6), nb(2.64), nb(5), nb(7), nb(0), nb(-1), nb('x'), nb('2.5')], [1.2, 2.6, 2.6, 5, 5, 1, 1, 1, 2.5]);
  });

  it('nomes herdados do Object (constructor, __proto__, toString) não são missões nem equipamentos', () => {
    assert.equal(isGroundMission('constructor'), false);
    assert.equal(migrateLegacyMissionName('constructor'), 'Voo Local');
    assert.equal(migrateLegacyMissionName('__proto__'), 'Voo Local');
    assert.equal(descreverExigencias('toString', 'C152'), 'Voo Local + C152');
    assert.equal(descreverExigencias('Simulador', 'constructor'), 'Simulador (Mono)');
    assert.equal(podeFazer({ hab: ['local'] }, 'Voo Local', 'constructor'), true);
    assert.equal(doesGroundGateFlight('constructor', { mis: 'Voo Local', eq: 'C152' }), false);
    const pedido = { mis: 'constructor', eq: 'valueOf', p1: 1, p2: 2, nb: 1, ss: 1 };
    normalizeMissionFields(pedido);
    assert.deepEqual([pedido.mis, pedido.eq], ['Voo Local', 'C152']);
  });

  it('disponibilidade do aluno: em que horários o voo pode começar (por período ou num horário exato)', () => {
    assert.equal(disponibilidadeDoAluno(''), null);
    assert.equal(disponibilidadeDoAluno(undefined), null);
    assert.equal(disponibilidadeDoAluno('h9'), null);
    assert.equal(disponibilidadeDoAluno('constructor'), null);
    const comeca = (jan, ...horarios) => horarios.map(disponibilidadeDoAluno(jan));
    assert.deepEqual(comeca('manha', 390, 420, 690, 760), [true, true, true, false]);
    assert.deepEqual(comeca('tarde', 750, 760, 980, 1050), [false, true, true, false]);
    assert.deepEqual(comeca('noite', 980, 1050), [false, true]);
    assert.deepEqual(comeca('h450', 420, 450), [false, true]);
    assert.deepEqual(comeca('h5', 820, 830), [true, false], 'o "h5" dos dados antigos é a janela das 13:40');
    assert.deepEqual(['manha', 'tarde', 'noite', 'h5', 'h450'].map(rotuloDaDisponibilidade), ['Manhã', 'Tarde', 'Noite', 'às 13:40', 'às 07:30']);
    assert.deepEqual(['h5', 'h450', 'tarde', 'xyz'].map(disponibilidadeAtual), ['h820', 'h450', 'tarde', undefined]);
    assert.deepEqual(opcoesDeDisponibilidade([450]), [['', 'Qualquer horário'], ['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite'], ['h450', 'Só às 07:30']]);
    const pedido = { mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, jan: 'xyz' };
    normalizeMissionFields(pedido);
    assert.equal(Object.hasOwn(pedido, 'jan'), false, 'disponibilidade inválida sai do pedido');
  });

  it('pedido em branco é um objeto novo a cada chamada', () => {
    const a = blank();
    assert.deepEqual(a, { fly: false, mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, pr: 3 });
    assert.notEqual(blank(), a);
  });
});

// A missão extra é numerada no aluno, e não pelo número do cadastro (que fica no documento de todas as datas: cada
// missão extra regravaria o cadastro, e duas pessoas em datas diferentes receberiam conflito)
describe('Número da missão extra', () => {
  it('o próximo depois das missões do aluno e do que o dia ainda guarda (voo fixo, status ou detalhe de uma missão retirada)', () => {
    const estado = { nid: 5000, stu: [{ id: 1000, extra: [] }, { id: 1001, extra: [{ mid: 1003 }, { mid: 7 }] }], fixos: {}, fStatus: {}, fObs: {} };
    assert.equal(proximoMid(estado, estado.stu[0]), 1);
    assert.equal(proximoMid(estado, estado.stu[1]), 1004);
    estado.fixos = { '1000_4_1': { a: 390 } };
    estado.fStatus = { '1000_9_1': 'Cancelado', '1001_2000_1': 'Atrasado' };
    estado.fObs = { '1000_12_1': { motivo: 'Outro' } };
    assert.equal(proximoMid(estado, estado.stu[0]), 13, 'não reaproveita o número de uma missão retirada que o dia ainda guarda');
    assert.equal(proximoMid(estado, estado.stu[1]), 2001);
    assert.equal(estado.nid, 5000, 'o número do cadastro não muda');
  });

  // O resultado fica no servidor, preso à chave do voo: a missão nova com o número de uma retirada mostraria o resultado
  // dela
  it('nem o número de uma missão retirada que tem resultado registrado na data', () => {
    const doDia = [{ id: 1, aluno: 1000, curso: 'PP', missao: 'PP-03', resultado: 'reprovado', data: '2026-11-11', voo: '1000_3_1' }, { voo: '1001_9_1' }, { voo: null }, null];
    const estado = { stu: [], fixos: {}, fStatus: {}, fObs: {}, resultados: { situacao: [], doDia } };
    assert.equal(proximoMid(estado, { id: 1000, extra: [{ mid: 1 }] }), 4);
    assert.equal(proximoMid(estado, { id: 1001, extra: [{ mid: 2 }] }), 10);
    assert.equal(proximoMid({ ...estado, resultados: null }, { id: 1000, extra: [{ mid: 1 }] }), 2, 'sem os resultados lidos');
  });

  // O curso da missão do curso (a sigla) só vale com a missão: sem o código (ou com o código fora do formato, que sai), ou
  // fora do formato das siglas, ele sai
  it('o curso da missão do curso: uma sigla, só com o código da missão', () => {
    const pedido = extra => { const p = { mis: 'Voo Local', eq: 'C152', p1: 390, p2: -1, nb: 1, ...extra }; normalizeMissionFields(p); return p; };
    assert.deepEqual([pedido({ etapa: 'PE-04', cursoDaEtapa: 'PP' }), pedido({ etapa: 'IFR-01', cursoDaEtapa: 'PC-IFR' })].map(p => [p.etapa, p.cursoDaEtapa]),
      [['PE-04', 'PP'], ['IFR-01', 'PC-IFR']]);
    for (const ruim of ['pp', 'P', 'PP-', 'PPPPPPPPPPP', '<b>', 7, null, ['PP'], { toString: () => 'PP' }]) {
      const p = pedido({ etapa: 'PE-04', cursoDaEtapa: ruim });
      assert.deepEqual([p.etapa, Object.hasOwn(p, 'cursoDaEtapa')], ['PE-04', false], String(ruim));
    }
    for (const semCodigo of [{}, { etapa: 'pe 04' }, { etapa: null }]) {
      assert.equal(Object.hasOwn(pedido({ ...semCodigo, cursoDaEtapa: 'PP' }), 'cursoDaEtapa'), false, JSON.stringify(semCodigo));
    }
  });

  it('o id da solicitação da agenda: inteiro positivo; o resto sai', async () => {
    const { normalizeMissionFields } = await import('../../js/rules.js');
    const ok = { mis: 'Voo Local', eq: 'C152', p1: 390, p2: -1, nb: 1, solicitacao: 12 };
    normalizeMissionFields(ok);
    assert.equal(ok.solicitacao, 12);
    for (const ruim of ['12', -1, 1.5, null]) {
      const p = { mis: 'Voo Local', eq: 'C152', p1: 390, p2: -1, nb: 1, solicitacao: ruim };
      normalizeMissionFields(p);
      assert.equal(Object.hasOwn(p, 'solicitacao'), false, String(ruim));
    }
  });

  // O Voo Solo sai sempre às 06:30 e o Noturno às 17:30; a preferência é esse horário
  it('missão de horário fixo: a 1ª preferência é o horário dela, sem 2ª', async () => {
    const { normalizeMissionFields } = await import('../../js/rules.js');
    const solo = { mis: 'Voo Solo', eq: 'C152', p1: 760, p2: 870, nb: 2 };
    normalizeMissionFields(solo);
    assert.deepEqual([solo.p1, solo.p2], [390, -1]);
    const noturno = { mis: 'Noturno', eq: 'C172', p1: 500, p2: 610, nb: 1 };
    normalizeMissionFields(noturno);
    assert.deepEqual([noturno.p1, noturno.p2], [1050, -1]);
  });
});

// O voo novo de um aluno (o pedido da agenda; o voo agendado na escala) não herda o que o dia ainda guarda de outro voo:
// o cadeado, o status, o detalhe ou o resultado ficam presos à chave (aluno_missão_1)
describe('O pedido que recebe um voo novo', () => {
  const CHAVE = '1000_0_1';
  const resultado = voo => ({ id: 1, aluno: 1000, curso: 'PP', missao: 'PP-01', resultado: 'aprovado', data: '2026-11-11', voo });
  const SOBRAS = {
    'voo fixo': { fixos: { [CHAVE]: { a: 610, b: 670, r: 'PP-LJV', insId: 1 } } },
    status: { fStatus: { [CHAVE]: 'Cancelado' } },
    detalhe: { fObs: { [CHAVE]: { motivo: 'Meteorologia' } } },
    resultado: { resultados: { situacao: [], doDia: [resultado(CHAVE)] } }
  };
  const dia = (sobras = {}) => ({ stu: [], fixos: {}, fStatus: {}, fObs: {}, resultados: { situacao: [], doDia: [] }, ...sobras });
  // O aluno que saiu da escala: o pedido principal não voa e ainda tem o que era do voo de antes
  const quemSaiu = (extra = {}) => ({
    id: 1000, nm: 'Aluno 1000', kg: 70, bl: [], curso: 'PP', fly: false, mis: 'Navegação', eq: 'C172', p1: 760, p2: 870, nb: 2, ss: 1, pr: 1,
    jan: 'tarde', etapa: 'PP-03', cursoDaEtapa: 'PP', solicitacao: 7, insId: 3, extra: [{ mid: 2, ...blank(), fly: true }], ...extra
  });

  it('a chave tem sobras: o voo fixo, o status, o detalhe ou um resultado registrado na data', () => {
    assert.equal(chaveTemSobras(dia(), CHAVE), false);
    assert.equal(chaveTemSobras({}, CHAVE), false, 'o dia sem nada (e sem os resultados lidos)');
    for (const [sobra, sobras] of Object.entries(SOBRAS)) assert.equal(chaveTemSobras(dia(sobras), CHAVE), true, sobra);
    // As de outro voo não contam: outra missão do aluno, outro aluno, a volta de BH do noturno de ontem (a sessão 2)
    const deOutros = dia({ fixos: { '1000_1_1': SOBRAS['voo fixo'].fixos[CHAVE] }, fStatus: { '1001_0_1': 'Cancelado', '1000_0_2': 'Atrasado' },
      resultados: { situacao: [], doDia: [resultado('1000_2_1'), { voo: null }, null] } });
    assert.equal(chaveTemSobras(deOutros, CHAVE), false);
  });

  it('o pedido principal, quando o aluno não voa e o dia não guarda nada dele: em branco, sem o que era do voo de antes', () => {
    const aluno = quemSaiu();
    const alvo = alvoDoNovoPedido(dia(), aluno);
    assert.equal(alvo, aluno, 'o pedido principal é o próprio aluno');
    assert.deepEqual(aluno, { id: 1000, nm: 'Aluno 1000', kg: 70, bl: [], curso: 'PP', ...blank(), extra: [{ mid: 2, ...blank(), fly: true }] });
  });

  it('com sobras na chave do pedido principal, ou com ele voando, uma missão extra nova: o pedido principal fica como estava', () => {
    for (const [sobra, sobras] of Object.entries(SOBRAS)) {
      const aluno = quemSaiu(), antes = structuredClone(aluno);
      const alvo = alvoDoNovoPedido(dia(sobras), aluno);
      // O número seguinte, a prioridade do aluno e nada do voo de antes (nem o instrutor escolhido)
      assert.deepEqual(alvo, { mid: 3, ...blank(), pr: 1 }, sobra);
      assert.equal(aluno.extra.at(-1), alvo, sobra);
      // Voltando a voar, o pedido principal volta para o mesmo lugar, com o voo fixo dele
      assert.deepEqual({ ...aluno, extra: aluno.extra.slice(0, -1) }, antes, sobra);
    }
    const voando = quemSaiu({ fly: true, pr: undefined, extra: [] });
    assert.deepEqual(alvoDoNovoPedido(dia(), voando), { mid: 1, ...blank() }, 'sem a prioridade do aluno, 3');
    assert.deepEqual([voando.fly, voando.etapa, voando.insId, voando.extra.length], [true, 'PP-03', 3, 1]);
  });
});

describe('A duração digitada', () => {
  it('de 0,1 h a 5 h, em décimos, com vírgula ou ponto; fora disso, nenhuma', () => {
    assert.deepEqual(['1,5', '2.6', '0,1', '5', '1,26'].map(duracaoDigitada), [1.5, 2.6, 0.1, 5, 1.3]);
    for (const fora of ['0', '0,04', '5,1', '6', '', 'abc', '-1']) assert.equal(duracaoDigitada(fora), null, fora);
    assert.equal(ERRO_DA_DURACAO, 'A duração vai de 0,1 h a 5 h.');
  });
});

describe('O peso', () => {
  it('o gravado: mais que 0 e até 300 kg; fora disso, ou sem ser um número, sem peso (0)', () => {
    assert.deepEqual([72, 72.5, 0.1, 250, 300].map(pesoValido), [72, 72.5, 0.1, 250, 300]);
    for (const fora of [0, -70, 300.1, 400, NaN, Infinity, '70', null, undefined, {}]) assert.equal(pesoValido(fora), 0, String(fora));
  });

  it('o digitado: em décimos, com vírgula ou ponto, mais que 0 e até 300 kg; fora disso, nenhum', () => {
    assert.deepEqual(['72', '72,5', '80.3', '68,25', '0,1', '250', '300', '300,04', ' 75 ', 90].map(pesoDigitado),
      [72, 72.5, 80.3, 68.3, 0.1, 250, 300, 300, 75, 90]);
    for (const fora of ['0', '0,04', '-1', '300,1', '350', '', 'abc', 'Infinity']) assert.equal(pesoDigitado(fora), null, fora);
    assert.equal(ERRO_DO_PESO, 'O peso vai de 1 a 300 kg.');
  });

  it('o do campo do cadastro: vazio é sem peso (0); o texto que não é número (validity.badInput) não apaga o peso', () => {
    assert.equal(pesoDoTexto(''), 0);
    assert.equal(pesoDoTexto('   '), 0);
    assert.equal(pesoDoTexto('72,5'), 72.5);
    assert.equal(pesoDoTexto('', true), null);
    for (const fora of ['0', '-1', '301', 'abc']) assert.equal(pesoDoTexto(fora), null, fora);
  });
});
