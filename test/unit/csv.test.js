// CSV para o lançamento no portal do aeroclube: agrupado por avião/equipamento, em ordem de horário em cada um.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CABECALHO, linhasDoCsv, montarCsv, nomeDoCsv } from '../../js/csv.js';

const voo = (r, eqType, a, extra = {}) => ({
  fKey: `${r}_${a}`, r, eqType, a, b: a + 60, w: 0, o: 0, s: 'Aluno 01', mis: 'Voo Local', ins: 'Instrutor 01', ss: '1/1',
  isGround: false, stuKg: 70, insKg: 80, limKg: { C152: 170, C172: 222, 'PA-34': 250 }[eqType] || 0, status: 'Confirmado', ...extra
});
const escala = (out, al = []) => ({ out, al, tot: out.length });

describe('CSV da escala por avião', () => {
  it('agrupa por avião (C152, C172, PA-34, simuladores e sala de Ground) e ordena por horário em cada um', () => {
    const out = [
      voo('SALA-GROUND', 'Sala Ground', 390, { isGround: true, mis: 'Ground C152', limKg: 0 }),
      voo('PR-VOB', 'C152', 390),
      voo('PR-BTB', 'C152', 500),
      voo('SIM-MONO-A', 'Sim. Mono', 390, { mis: 'Simulador' }),
      voo('PR-VOM', 'PA-34', 390, { mis: 'Multimotor' }),
      voo('PR-BTB', 'C152', 390),
      voo('PP-ABP', 'C172', 610),
      voo('PR-VOB', 'C152', 610)
    ];
    assert.deepEqual(linhasDoCsv(escala(out)).map(l => `${l[0]} ${l[1]}`), [
      'PR-BTB 06:30–07:30', 'PR-BTB 08:20–09:20', 'PR-VOB 06:30–07:30', 'PR-VOB 10:10–11:10',
      'PP-ABP 10:10–11:10', 'PR-VOM 06:30–07:30', 'SIM-MONO-A 06:30–07:30', 'SALA-GROUND 06:30–07:30'
    ]);
  });

  it('colunas: avião, horário, aluno, missão, instrutor e observações', () => {
    assert.deepEqual(CABECALHO, ['Avião / Equipamento', 'Horário', 'Aluno', 'Fase / Missão', 'Instrutor', 'Observações']);
    const [linha] = linhasDoCsv(escala([voo('PR-BTB', 'C152', 390, { s: 'Ana', mis: 'Navegação', ins: 'Bruno', ss: '2/2' })]));
    assert.deepEqual(linha.slice(0, 5), ['PR-BTB', '06:30–07:30', 'Ana', 'Navegação (sessão 2/2)', 'Bruno']);
  });

  it('a missão do curso vai na coluna Fase / Missão, antes do tipo de missão (fase 14)', () => {
    const [linha] = linhasDoCsv(escala([voo('PR-BTB', 'C152', 390, { mis: 'Navegação', etapa: 'PP-07' })]));
    assert.equal(linha[3], 'PP-07 · Navegação');
  });

  it('observações: peso do aluno + instrutor contra o limite do avião, pesos não informados, status e turma de Ground', () => {
    const obs = (o, fStatus) => linhasDoCsv(escala([o]), fStatus)[0][5];
    assert.equal(obs(voo('PR-BTB', 'C152', 390)), 'Peso aluno + instrutor: 150 kg (limite do C152: 170 kg) · dentro do envelope');
    assert.equal(obs(voo('PR-BTB', 'C152', 390, { stuKg: 100 })), 'Peso aluno + instrutor: 180 kg (limite do C152: 170 kg) · ACIMA DO LIMITE');
    assert.equal(obs(voo('PR-BTB', 'C152', 390, { stuKg: 0 })), 'Peso do aluno não informado: limite de 170 kg do C152 não verificado');
    assert.equal(obs(voo('PP-ABP', 'C172', 390, { insKg: 0 })), 'Peso do instrutor não informado: limite de 222 kg do C172 não verificado');
    assert.equal(obs(voo('PR-BTB', 'C152', 390, { fKey: 'k' }), { k: 'Cancelado' }), 'Status: Cancelado · Peso aluno + instrutor: 150 kg (limite do C152: 170 kg) · dentro do envelope');
    assert.equal(obs(voo('SIM-MONO-A', 'Sim. Mono', 390)), '');
    assert.equal(obs(voo('SALA-GROUND', 'Sala Ground', 390, { isGround: true, groupSize: 6, limKg: 0 })), 'Turma de Ground com 6 alunos');
  });

  it('observações: o detalhe do status (novo horário do atraso, motivo do cancelamento)', () => {
    const obs = (fStatus, fObs) => linhasDoCsv(escala([voo('PR-BTB', 'C152', 610, { fKey: 'k', stuKg: 0 })]), fStatus, fObs)[0][5];
    assert.match(obs({ k: 'Atrasado' }, { k: { novoInicio: 640 } }), /^Status: Atrasado: nova decolagem 10:40 · /);
    assert.match(obs({ k: 'Cancelado' }, { k: { motivo: 'Meteorologia' } }), /^Status: Cancelado: Meteorologia · /);
    assert.match(obs({ k: 'Cancelado' }, { k: { motivo: 'Outro', texto: 'Pista interditada' } }), /^Status: Cancelado: Pista interditada · /);
    assert.match(obs({ k: 'Cancelado' }, {}), /^Status: Cancelado · /);
  });

  it('observações: acima do limite com os tanques cheios, quanto abastecer e quanto o voo pede (fase 10)', () => {
    const obs = linhasDoCsv(escala([voo('PR-BTB', 'C152', 390, { stuKg: 100, comb: { reduzirGal: 4, abastecerGal: 22, minimoGal: 11, autonomiaMin: 203 } })]))[0][5];
    assert.equal(obs, 'Peso aluno + instrutor: 180 kg (limite do C152 com os tanques cheios: 170 kg) · combustível: abastecer até 22 gal (4 a menos); o voo, o táxi e a reserva pedem 11 gal');
  });

  it('observações: avião que para para a revisão de 50 horas naquele dia', () => {
    const res = { ...escala([voo('PR-BTB', 'C152', 390), voo('PR-VOB', 'C152', 390)]), revisao: { 'PR-BTB': { inicio: 49, voadas: 1, fim: 50, paraAs: 450 }, 'PR-VOB': { inicio: 10, voadas: 1, fim: 11, paraAs: null } } };
    const [btb, vob] = linhasDoCsv(res);
    assert.match(btb[5], / · Avião para para a revisão de 50 horas às 07:30$/);
    assert.doesNotMatch(vob[5], /revisão/);
  });

  it('formato do Excel: BOM, ";" como separador, aspas escapadas, quebras de linha do Windows e os alertas no fim', () => {
    const csv = montarCsv(escala([voo('PR-BTB', 'C152', 390, { s: 'Ana "Aninha"' })], [{ t: 'err', s: 'Bia', m: 'Rejeitado: sem avião.' }]));
    assert.ok(csv.startsWith('﻿"Avião / Equipamento";"Horário";'));
    const linhas = csv.slice(1).split('\r\n');
    assert.equal(linhas[1].split(';')[2], '"Ana ""Aninha"""');
    assert.deepEqual(linhas.slice(2), ['', '"Alertas";"Aluno";"Mensagem"', '"Rejeitado";"Bia";"Rejeitado: sem avião."']);
  });

  it('o arquivo leva a data da escala no nome', () => {
    assert.equal(nomeDoCsv('2026-11-11'), 'escala-acpm-2026-11-11.csv');
  });
});
