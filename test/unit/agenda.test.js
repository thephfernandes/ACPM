// Agenda de solicitações: o prazo das 13:00 (horário de São Paulo) e o pedido que cada solicitação vira na demanda (a
// importação para a demanda: test/unit/processamento.test.js).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MIS, ALL_EQ_TYPES } from '../../js/config.js';
import { HORARIOS_INICIAIS } from '../../js/horarios.js';
import { prazoDaAgendaPermite, primeiraDataAberta, datasParaRegistrar, disponibilidadeDaSolicitacao, pedidoDaSolicitacao, recursosDaMissao, recursoValido, RECURSO_DO_PEDIDO } from '../../js/agenda.js';

const em = iso => new Date(iso);

describe('Agenda de solicitações', () => {
  it('pedido para o dia seguinte só até as 13:00 de São Paulo; depois, a partir de dois dias', () => {
    assert.equal(prazoDaAgendaPermite('2026-11-11', em('2026-11-10T12:59:00-03:00')), true);
    assert.equal(prazoDaAgendaPermite('2026-11-11', em('2026-11-10T13:00:00-03:00')), false);
    assert.equal(prazoDaAgendaPermite('2026-11-12', em('2026-11-10T13:00:00-03:00')), true);
    assert.equal(prazoDaAgendaPermite('2026-11-10', em('2026-11-10T08:00:00-03:00')), false, 'o próprio dia nunca');
    assert.equal(prazoDaAgendaPermite('2026-11-11', em('2026-11-10T15:30:00Z')), true, '15:30 UTC é 12:30 em São Paulo');
    assert.equal(prazoDaAgendaPermite('2026-11-11', em('2026-11-10T16:30:00Z')), false, '16:30 UTC é 13:30 em São Paulo');
    assert.equal(prazoDaAgendaPermite('2026-11-11', em('2026-11-11T01:00:00Z')), false, '01:00 UTC do dia 11 ainda é 10/11 22:00 em São Paulo');
    assert.equal(prazoDaAgendaPermite('2027-01-01', em('2026-12-31T12:00:00-03:00')), true, 'virada de ano');
  });

  it('primeira data aberta para pedidos: amanhã até as 13:00, depois o dia seguinte a amanhã', () => {
    assert.equal(primeiraDataAberta(em('2026-11-10T12:00:00-03:00')), '2026-11-11');
    assert.equal(primeiraDataAberta(em('2026-11-10T13:00:00-03:00')), '2026-11-12');
    assert.equal(primeiraDataAberta(em('2026-12-31T14:00:00-03:00')), '2027-01-02');
  });

  // O aeroclube não opera aos domingos; os voos de segunda são agendados até sábado às 10:00
  it('domingo não tem voo; segunda até sábado às 10:00; os outros dias até 13:00 do dia anterior', () => {
    const sabado = h => em(`2026-11-14T${h}:00-03:00`);
    assert.equal(prazoDaAgendaPermite('2026-11-15', sabado('08:00')), false, 'domingo nunca');
    assert.equal(prazoDaAgendaPermite('2026-11-22', sabado('08:00')), false, 'domingo nunca, nem na semana seguinte');
    assert.equal(prazoDaAgendaPermite('2026-11-16', sabado('09:59')), true, 'segunda: até sábado 09:59');
    assert.equal(prazoDaAgendaPermite('2026-11-16', sabado('10:00')), false, 'segunda: encerrado sábado às 10:00');
    assert.equal(prazoDaAgendaPermite('2026-11-16', em('2026-11-13T15:00:00-03:00')), true, 'segunda: na sexta à tarde ainda pode');
    assert.equal(prazoDaAgendaPermite('2026-11-16', em('2026-11-15T08:00:00-03:00')), false, 'segunda: no domingo já fechou');
    assert.equal(prazoDaAgendaPermite('2026-11-17', em('2026-11-15T08:00:00-03:00')), true, 'terça: no domingo pode');
    assert.equal(prazoDaAgendaPermite('2026-11-17', em('2026-11-16T12:59:00-03:00')), true, 'terça: até segunda 12:59');
    assert.equal(prazoDaAgendaPermite('2026-11-17', em('2026-11-16T13:00:00-03:00')), false, 'terça: encerrado segunda às 13:00');
    assert.equal(prazoDaAgendaPermite('2026-11-14', em('2026-11-13T12:59:00-03:00')), true, 'sábado: até sexta 12:59');
  });

  it('primeira data aberta: pula o domingo', () => {
    assert.equal(primeiraDataAberta(em('2026-11-14T09:00:00-03:00')), '2026-11-16', 'sábado de manhã: segunda');
    assert.equal(primeiraDataAberta(em('2026-11-14T10:00:00-03:00')), '2026-11-17', 'sábado depois das 10:00: terça');
    assert.equal(primeiraDataAberta(em('2026-11-13T12:00:00-03:00')), '2026-11-14', 'sexta antes das 13:00: sábado');
    assert.equal(primeiraDataAberta(em('2026-11-13T13:00:00-03:00')), '2026-11-16', 'sexta depois das 13:00: segunda');
  });

  it('a disponibilidade da solicitação vira a do pedido (o horário específico vira aquele horário, em minutos)', () => {
    assert.deepEqual(['manha', 'tarde', 'noite'].map(janela => disponibilidadeDaSolicitacao({ janela })), ['manha', 'tarde', 'noite']);
    assert.equal(disponibilidadeDaSolicitacao({ janela: 'horario', horario: '14:30' }), 'h870');
    assert.equal(disponibilidadeDaSolicitacao({ janela: 'horario', horario: '07:30' }), 'h450');
    assert.equal(disponibilidadeDaSolicitacao({ janela: 'horario', horario: '25:00' }), undefined, 'horário inválido: sem restrição');
  });

  it('cada solicitação vira um pedido pronto para a escala, com os horários da categoria', () => {
    assert.deepEqual(pedidoDaSolicitacao({ missao: 'Voo Local', janela: 'tarde' }),
      { fly: true, mis: 'Voo Local', eq: 'C152', p1: 760, p2: 820, nb: 1, ss: 1, pr: 3, jan: 'tarde' });
    assert.deepEqual(pedidoDaSolicitacao({ missao: 'IFR', janela: 'horario', horario: '14:30' }),
      { fly: true, mis: 'IFR', eq: 'C172', p1: 870, p2: 870, nb: 1, ss: 1, pr: 3, jan: 'h870' });
    assert.deepEqual(pedidoDaSolicitacao({ missao: 'Noturno', janela: 'noite' }),
      { fly: true, mis: 'Noturno', eq: 'C172', p1: 1050, p2: -1, nb: 4, ss: 1, pr: 3, jan: 'noite' });
    const ground = pedidoDaSolicitacao({ missao: 'Ground C152', janela: 'manha' });
    assert.deepEqual([ground.eq, ground.nb, ground.p1, ground.p2, ground.jan], ['Sala Ground', 1.5, 390, 500, 'manha']);
    // O PA-34 tem horários de 30 em 30 minutos
    assert.deepEqual(pedidoDaSolicitacao({ missao: 'Multimotor', janela: 'horario', horario: '07:30' }),
      { fly: true, mis: 'Multimotor', eq: 'PA-34', p1: 450, p2: 450, nb: 1, ss: 1, pr: 3, jan: 'h450' });
    const manhaPa34 = pedidoDaSolicitacao({ missao: 'Multimotor', janela: 'manha' });
    assert.deepEqual([manhaPa34.p1, manhaPa34.p2], [390, 420]);
  });

  // O Ground tem 01h30 e o Noturno, 4 h às 17:30 (o translado e o noturno em BH): nem a agenda nem o programa mudam isso
  it('as horas do pedido: as fixas da missão; senão, as registradas na agenda; senão, as do programa; senão, as padrão da missão', () => {
    const horas = (missao, registradas, doPrograma) => pedidoDaSolicitacao({ missao, janela: 'tarde', horas: registradas }, undefined, { nb: doPrograma }).nb;
    assert.deepEqual([horas('Voo Local', 2.6, 2), horas('Voo Local', null, 2), horas('Voo Local', undefined), horas('Simulador', null)], [2.6, 2, 1, 2]);
    assert.deepEqual([horas('Noturno', 3, 3), horas('Noturno', null, 3), horas('Ground C152', 2, 1), horas('Voo Local', 'x')], [4, 4, 1.5, 1]);
  });

  // O pedido guarda o recurso escolhido; os de antes, e o que a missão não permite, valem como sem recurso
  it('os recursos da missão, e o recurso do pedido só quando a missão o permite', () => {
    for (const [missao, { eq }] of Object.entries(MIS)) assert.deepEqual(recursosDaMissao(missao), eq, missao);
    assert.deepEqual([recursosDaMissao(''), recursosDaMissao('Outra'), recursosDaMissao('constructor')], [[], [], []]);
    const valido = (missao, recurso) => recursoValido({ missao, recurso });
    assert.deepEqual([valido('Navegação', 'PA-34'), valido('Noturno', 'C172'), valido('Ground C152', 'Sala Ground')], ['PA-34', 'C172', 'Sala Ground']);
    assert.deepEqual([valido('Noturno', 'C152'), valido('Navegação', null), valido('Navegação', undefined), valido('Navegação', 'c152'), valido('Outra', 'C152')], [null, null, null, null, null]);
    for (const tipo of ALL_EQ_TYPES) assert.match(tipo, RECURSO_DO_PEDIDO);
    for (const ruim of ['', ' C152', 'C152 ', '<b>', 'C'.repeat(31), 'C152\n']) assert.doesNotMatch(ruim, RECURSO_DO_PEDIDO);
  });

  it('o recurso do pedido decide o avião, os horários e as preferências; sem ele, ou com um que a missão não permite, o padrão', () => {
    const p = (extra, opcoes) => pedidoDaSolicitacao({ missao: 'Navegação', janela: 'horario', horario: '07:30', horas: 2, ...extra }, HORARIOS_INICIAIS, opcoes);
    assert.deepEqual(p({ recurso: 'PA-34' }), { fly: true, mis: 'Navegação', eq: 'PA-34', p1: 450, p2: 450, nb: 2, ss: 1, pr: 3, jan: 'h450' });
    for (const recurso of [null, undefined, 'Sim. Mono', 'x']) assert.deepEqual(p({ recurso }), p({}), String(recurso));
    assert.equal(p({}).eq, 'C152');
    // O recurso da missão do curso já escolhida pelo operador (eq) vale mais
    assert.equal(p({ recurso: 'PA-34' }, { eq: 'C172' }).eq, 'C172');
    // O horário que o cadastro não tem mais: as preferências padrão da lista do recurso, com o horário pedido na disponibilidade
    const semAs0730 = { ...HORARIOS_INICIAIS, 'PA-34': [480, 540, 600, 660] };
    const velho = pedidoDaSolicitacao({ missao: 'Navegação', janela: 'horario', horario: '07:30', recurso: 'PA-34' }, semAs0730);
    assert.deepEqual([velho.eq, velho.p1, velho.p2, velho.jan], ['PA-34', 540, 660, 'h450']);
  });
});

// No máximo 6 voos locais (Voo Local, Voo Solo e TGL) no mesmo horário; ao agendar o 7º,
// o horário está indisponível, e o app diz o próximo possível
describe('Agenda: o limite de voos locais no mesmo horário', async () => {
  const { vagaDeVooLocal } = await import('../../js/agenda.js');
  const pedido = (id, horario, missao = 'Voo Local', extra = {}) => ({ id, data: '2026-11-11', aluno: id, missao, janela: 'horario', horario, cancelada_em: null, ...extra });
  const seisAs = horario => [0, 1, 2, 3, 4, 5].map(i => pedido(i + 1, horario, ['Voo Local', 'Voo Solo', 'TGL (TMA)'][i % 3]));

  it('com menos de 6 locais no horário, há vaga; outras missões e pedidos cancelados não contam', () => {
    const pedidos = [...seisAs('08:20').slice(0, 5), pedido(10, '08:20', 'Navegação'), pedido(11, '08:20', 'Voo Local', { cancelada_em: '2026-11-10T10:00:00Z' })];
    assert.deepEqual(vagaDeVooLocal(pedidos, { data: '2026-11-11', horario: '08:20', missao: 'Voo Local' }), { ok: true });
  });

  it('com 6 locais no horário, não há vaga: o próximo horário possível', () => {
    const pedidos = [...seisAs('08:20'), ...seisAs('10:10').map(p => ({ ...p, id: p.id + 20 }))];
    assert.deepEqual(vagaDeVooLocal(pedidos, { data: '2026-11-11', horario: '08:20', missao: 'TGL (TMA)' }), { ok: false, proximo: '11:30' });
  });

  it('o próximo horário possível é um dos horários do recurso do pedido', () => {
    const local = extra => vagaDeVooLocal(seisAs('08:30'), { data: '2026-11-11', horario: '08:30', missao: 'Voo Local', ...extra });
    assert.deepEqual([local({ recurso: 'PA-34' }), local({}), local({ recurso: 'Sim. Mono' })],
      [{ ok: false, proximo: '09:00' }, { ok: false, proximo: '10:10' }, { ok: false, proximo: '10:10' }]);
  });

  it('outra missão não tem o limite; o Solo (só às 06:30) não tem próximo horário', () => {
    assert.deepEqual(vagaDeVooLocal(seisAs('08:20'), { data: '2026-11-11', horario: '08:20', missao: 'Navegação' }), { ok: true });
    assert.deepEqual(vagaDeVooLocal(seisAs('06:30'), { data: '2026-11-11', horario: '06:30', missao: 'Voo Solo' }), { ok: false, proximo: null });
  });
});

describe('A data do pedido (datasParaRegistrar)', () => {
  const HOJE = '2026-11-10';
  const meioDia = em('2026-11-10T12:00:00-03:00'), tarde = em('2026-11-10T14:00:00-03:00');

  it('os dias de operação de hoje a 14 dias, sem domingo, com as fechadas marcadas (com a exceção)', () => {
    const { opcoes, padrao } = datasParaRegistrar(HOJE, '2026-11-11', { excecao: true, agora: meioDia });
    assert.deepEqual([opcoes[0], opcoes[1], opcoes.at(-1)], [{ data: '2026-11-10', fechada: true }, { data: '2026-11-11', fechada: false }, { data: '2026-11-24', fechada: false }]);
    assert.equal(opcoes.length, 13);
    assert.equal(opcoes.some(o => ['2026-11-15', '2026-11-22'].includes(o.data)), false);
    assert.equal(padrao, '2026-11-11');
  });

  it('a Secretaria só recebe as datas que aceitam pedidos', () => {
    assert.equal(datasParaRegistrar(HOJE, '2026-11-11', { agora: meioDia }).opcoes[0].data, '2026-11-11');
    assert.equal(datasParaRegistrar(HOJE, '2026-11-11', { agora: tarde }).opcoes[0].data, '2026-11-12');
    assert.equal(datasParaRegistrar(HOJE, '2026-11-11', { agora: tarde }).opcoes.some(o => o.fechada), false);
  });

  it('a data aberta mais adiante entra na lista, e só ela; uma passada não', () => {
    const longe = datasParaRegistrar(HOJE, '2026-12-18', { excecao: true, agora: meioDia });
    assert.deepEqual([longe.opcoes.at(-2).data, longe.opcoes.at(-1).data], ['2026-11-24', '2026-12-18']);
    assert.equal(longe.padrao, '2026-12-18');
    const passada = datasParaRegistrar(HOJE, '2026-11-03', { excecao: true, agora: meioDia });
    assert.equal(passada.opcoes[0].data, HOJE);
    assert.equal(passada.padrao, '2026-11-11');
  });

  it('a data com que o campo começa: a aberta, se aceita pedidos; senão, a primeira que aceita', () => {
    assert.equal(datasParaRegistrar(HOJE, '2026-11-13', { agora: tarde }).padrao, '2026-11-13');
    assert.equal(datasParaRegistrar(HOJE, '2026-11-11', { excecao: true, agora: tarde }).padrao, '2026-11-12');
    // Sábado depois das 10:00: segunda já fechou
    assert.equal(datasParaRegistrar('2026-11-14', '2026-11-16', { excecao: true, agora: em('2026-11-14T10:30:00-03:00') }).padrao, '2026-11-17');
  });
});
