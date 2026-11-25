// Agenda de solicitações: o prazo das 13:00 (horário de São Paulo) e o pedido que cada solicitação vira na demanda (a
// importação para a demanda: test/unit/processamento.test.js).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prazoDaAgendaPermite, primeiraDataAberta, disponibilidadeDaSolicitacao, pedidoDaSolicitacao, datasParaRegistrar } from '../../js/agenda.js';

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

  it('outra missão não tem o limite; o Solo (só às 06:30) não tem próximo horário', () => {
    assert.deepEqual(vagaDeVooLocal(seisAs('08:20'), { data: '2026-11-11', horario: '08:20', missao: 'Navegação' }), { ok: true });
    assert.deepEqual(vagaDeVooLocal(seisAs('06:30'), { data: '2026-11-11', horario: '06:30', missao: 'Voo Solo' }), { ok: false, proximo: null });
  });
});

// O campo "Data do pedido" da Agenda: a data do pedido é dele, não a data aberta no app
describe('As datas para registrar um pedido', () => {
  const agora = em('2026-11-10T12:00:00-03:00');
  it('os dias de operação de hoje a hoje + 14, sem os domingos; o rótulo curto, com hoje e amanhã', () => {
    const datas = datasParaRegistrar({ aberta: '2026-11-11', excecao: true, agora });
    assert.equal(datas[0].data, '2026-11-10');
    assert.equal(datas.at(-1).data, '2026-11-24');
    assert.ok(!datas.some(d => d.data === '2026-11-15' || d.data === '2026-11-22'));
    assert.equal(datas.length, 13);
    assert.equal(datas[0].rotulo, 'ter 10/11 (hoje) · prazo encerrado');
    assert.equal(datas[1].rotulo, 'qua 11/11 (amanhã)');
    assert.equal(datas[2].rotulo, 'qui 12/11');
  });

  it('a data aberta, quando é depois desses dias, entra no fim', () => {
    const datas = datasParaRegistrar({ aberta: '2026-12-15', excecao: true, agora });
    assert.equal(datas.at(-1).data, '2026-12-15');
    assert.equal(datasParaRegistrar({ aberta: '2026-11-29', excecao: true, agora }).at(-1).data, '2026-11-24');
  });

  it('quem não usa a exceção (a Secretaria) só vê as datas dentro do prazo', () => {
    const datas = datasParaRegistrar({ aberta: '2026-11-11', excecao: false, agora });
    assert.equal(datas[0].data, '2026-11-11');
    assert.ok(datas.every(d => !d.encerrado));
  });

  it('depois das 13:00, amanhã também fecha: a primeira data aberta é depois de amanhã', () => {
    const tarde = em('2026-11-10T13:30:00-03:00');
    const datas = datasParaRegistrar({ aberta: '2026-11-11', excecao: false, agora: tarde });
    assert.equal(datas[0].data, '2026-11-12');
    assert.equal(datas[0].data, primeiraDataAberta(tarde));
    assert.equal(datasParaRegistrar({ aberta: '2026-11-11', excecao: true, agora: tarde })[1].rotulo, 'qua 11/11 (amanhã) · prazo encerrado');
  });
});
