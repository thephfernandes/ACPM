// Divisão igual das horas do dia entre os instrutores (fase 7): depois de montada a escala, voos e aulas passam do
// instrutor com mais horas para o com menos sempre que todas as regras continuam valendo. Os voos do rodízio
// (cheque, MLTE, noturno e C172) ficam com quem a fila escolheu; a turma de Ground se move inteira e conta uma vez.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine } from '../../js/engine.js';
import { aluno, cenario, instrutor, GROUND_C152 } from '../helpers/montar.js';

const horasPorInstrutor = out => {
  const horas = {}, vistas = new Set();
  for (const o of out) {
    const chave = o.classKey || o.fKey;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    horas[o.insId] = (horas[o.insId] || 0) + o.h;
  }
  return horas;
};
const escala = opts => runAllocationEngine(cenario(opts));

describe('Divisão igual das horas entre os instrutores', () => {
  it('dois voos de 1 h e dois instrutores habilitados e livres: um voo para cada', () => {
    const { out, al } = escala({ ins: [instrutor(1, 1), instrutor(2, 9)], stu: [aluno(1000, { p1: 390 }), aluno(1001, { p1: 500 })] });
    assert.deepEqual(al, []);
    assert.deepEqual(horasPorInstrutor(out), { 1: 1, 2: 1 });
  });

  it('não move um voo para quem não pode recebê-lo: sem a habilitação, fora da disponibilidade ou bloqueado pelo aluno', () => {
    const semHabilitacao = escala({ ins: [instrutor(1, 1), instrutor(2, 9, { hab: ['grounds'] })], stu: [aluno(1000, { p1: 390 }), aluno(1001, { p1: 500 })] });
    assert.deepEqual(horasPorInstrutor(semHabilitacao.out), { 1: 2 });
    const indisponivel = escala({ ins: [instrutor(1, 1), instrutor(2, 9, { aw: Array(9).fill(false) })], stu: [aluno(1000, { p1: 390 }), aluno(1001, { p1: 500 })] });
    assert.deepEqual(horasPorInstrutor(indisponivel.out), { 1: 2 });
    const bloqueado = escala({ ins: [instrutor(1, 1), instrutor(2, 9)], stu: [aluno(1000, { p1: 390 }, { bl: [2] }), aluno(1001, { p1: 500 }, { bl: [2] })] });
    assert.deepEqual(horasPorInstrutor(bloqueado.out), { 1: 2 });
  });

  it('não move se o peso passar do limite do avião com o outro instrutor', () => {
    const { out } = escala({ ins: [instrutor(1, 1, { kg: 60 }), instrutor(2, 9, { kg: 120 })], stu: [aluno(1000, { p1: 390 }, { kg: 100 }), aluno(1001, { p1: 500 }, { kg: 100 })] });
    assert.deepEqual(horasPorInstrutor(out), { 1: 2 });
  });

  it('a turma de Ground se move inteira e conta 1h30 uma vez só', () => {
    const turma = [1000, 1001, 1002].map(id => aluno(id, { ...GROUND_C152, p1: 390, p2: 500 }));
    // Outra turma à tarde: as duas cairiam com o instrutor de menos habilitações (3 h contra 0)
    const { out } = escala({ ins: [instrutor(1, 1), instrutor(2, 9)], stu: [...turma, aluno(1003, { ...GROUND_C152, p1: 760, p2: 820, jan: 'tarde' })] });
    const instrutoresDaTurma = new Set(out.filter(o => turma.some(t => t.id === o.stuId)).map(o => o.insId));
    assert.equal(instrutoresDaTurma.size, 1, 'a turma continua com um instrutor só');
    assert.deepEqual(Object.values(horasPorInstrutor(out)).sort(), [1.5, 1.5]);
  });

  it('os voos do rodízio ficam com quem a fila escolheu; o equilíbrio usa os outros', () => {
    // O instrutor 1 é o primeiro da fila do C172 e, com menos habilitações, também recebe o voo no C152
    const { out } = escala({
      ins: [instrutor(1, 1, { hab: ['local', 'c172'] }), instrutor(2, 1, { hab: ['local', 'c172', 'navegacao', 'ifr'] })],
      stu: [aluno(1000, { eq: 'C172', p1: 390 }), aluno(1001, { eq: 'C152', p1: 500 })]
    });
    assert.equal(out.find(o => o.stuId === 1000).insId, 1, 'o voo do rodízio continua com o primeiro da fila');
    assert.equal(out.find(o => o.stuId === 1001).insId, 2, 'o voo no C152 passa para quem tinha menos horas');
  });

  it('entre as passagens válidas, a que deixa menos tempo parado (fase 10): o voo vai para quem já voa no horário vizinho', () => {
    // O instrutor 1 (menos habilitações) fica com 06:30, 08:20 e 10:10; o 2 voa às 12:40 e o 3, às 16:20 (alunos que
    // não voam com o 1). Para dividir as horas, o voo das 10:10 passa para o 2 (que voa logo depois), e não o das 06:30
    const { out } = escala({
      ins: [instrutor(1, 1), instrutor(2, 9), instrutor(3, 9)],
      stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 }), aluno(1002, { p1: 610, p2: -1 }),
        aluno(1003, { p1: 760, p2: -1 }, { bl: [1] }), aluno(1004, { p1: 980, p2: -1 }, { bl: [1] })]
    });
    const instrutorDe = stuId => out.find(o => o.stuId === stuId).insId;
    assert.deepEqual([1000, 1001, 1002, 1003, 1004].map(instrutorDe), [1, 1, 2, 2, 3]);
  });

  it('o aluno com duas missões no dia não fica com o mesmo instrutor nas duas', () => {
    const { out } = escala({
      ins: [instrutor(1, 1), instrutor(2, 9)],
      stu: [aluno(1000, { p1: 390 }, { extra: [{ mid: 1, fly: true, mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, pr: 3 }] })]
    });
    assert.equal(new Set(out.map(o => o.insId)).size, 2);
  });
});
