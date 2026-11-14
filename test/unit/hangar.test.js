// Ordem dos aviões no hangar (fase 10): da frente para o fundo, em cada data. O motor tira primeiro os da frente e junta
// os voos nos aviões que já saíram, para não deixar avião parado no meio do dia nem tirar um do fundo.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarHangar, moverNoHangar } from '../../js/hangar.js';
import { FROTA_INICIAL } from '../../js/frota.js';
import { runAllocationEngine } from '../../js/engine.js';
import { aluno, cenario, instrutor, apenas } from '../helpers/montar.js';

const C152 = FROTA_INICIAL.filter(f => f.tipo === 'C152').map(f => f.reg);

describe('Ordem do hangar', () => {
  it('só os aviões da frota, sem repetir; quem falta entra no fundo, na ordem da frota', () => {
    const hangar = normalizarHangar(['PR-VOB', 'SIM-MONO-A', 'XX-XXX', 'PR-VOB', 'PP-ABP'], FROTA_INICIAL);
    assert.deepEqual(hangar.slice(0, 2), ['PR-VOB', 'PP-ABP']);
    assert.equal(hangar.length, FROTA_INICIAL.filter(f => ['C152', 'C172', 'PA-34'].includes(f.tipo)).length);
    assert.ok(!hangar.includes('SIM-MONO-A'));
    assert.deepEqual(normalizarHangar(undefined, FROTA_INICIAL), FROTA_INICIAL.filter(f => ['C152', 'C172', 'PA-34'].includes(f.tipo)).map(f => f.reg));
  });

  it('subir, descer e pôr na frente', () => {
    const hangar = ['A', 'B', 'C'];
    assert.deepEqual(moverNoHangar(hangar, 'B', 'subir'), ['B', 'A', 'C']);
    assert.deepEqual(moverNoHangar(hangar, 'B', 'descer'), ['A', 'C', 'B']);
    assert.deepEqual(moverNoHangar(hangar, 'C', 'frente'), ['C', 'A', 'B']);
    assert.deepEqual(moverNoHangar(hangar, 'A', 'subir'), ['A', 'B', 'C']);
    assert.deepEqual(moverNoHangar(hangar, 'C', 'descer'), ['A', 'B', 'C']);
  });
});

describe('Hangar: o motor', () => {
  // Os C152 do fim da frota na frente do hangar
  const hangar = [...C152].reverse();

  it('o primeiro avião que sai é o da frente do hangar', () => {
    const { out } = runAllocationEngine({ ...cenario({ stu: [aluno(1000, { p1: 390, p2: -1 })] }), hangar });
    assert.equal(out[0].r, hangar[0]);
  });

  it('voos em horários diferentes, com instrutores diferentes, vão para o avião que já saiu (e não para outro do hangar)', () => {
    const { out } = runAllocationEngine({
      ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9), instrutor(3, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 }), aluno(1002, { p1: 760, p2: -1 })] }),
      hangar
    });
    assert.equal(new Set(out.map(o => o.r)).size, 1, `um avião só: ${out.map(o => o.r).join(', ')}`);
    assert.equal(out[0].r, hangar[0]);
  });

  it('voos ao mesmo tempo: os da frente do hangar, na ordem', () => {
    const { out } = runAllocationEngine({
      ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 390, p2: -1 })] }),
      hangar
    });
    assert.deepEqual(out.map(o => o.r).sort(), hangar.slice(0, 2).sort());
  });

  it('o avião em manutenção fica de fora mesmo na frente do hangar', () => {
    const { out } = runAllocationEngine({ ...cenario({ stu: [aluno(1000, { p1: 390, p2: -1 })], semAeronaves: [hangar[0]] }), hangar });
    assert.equal(out[0].r, hangar[1]);
  });

  it('o avião que já saiu e está livre preenche o buraco no meio do dia (o exemplo da diretoria: PR-VOB das 06 às 10 e depois às 16)', () => {
    // O instrutor 1 voa às 06:30, 08:20 e 16:20 no avião da frente; o instrutor 2 voa às 12:40: vai para o mesmo avião
    const { out } = runAllocationEngine({
      ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [
        aluno(1000, { p1: 390, p2: -1 }, { bl: [2] }), aluno(1001, { p1: 500, p2: -1 }, { bl: [2] }), aluno(1002, { p1: 980, p2: -1 }, { bl: [2] }),
        aluno(1003, { p1: 760, p2: -1 }, { bl: [1] })
      ] }),
      hangar
    });
    assert.equal(new Set(out.map(o => o.r)).size, 1, `um avião só: ${out.map(o => `${o.s} ${o.r}`).join(', ')}`);
  });
});
