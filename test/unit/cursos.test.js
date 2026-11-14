// Cursos (fase 14): o programa de cada curso (PP, PC e INVA), mantido no app pelo Administrador, e o curso de cada
// aluno. Cada missão do programa tem um código (PP-07), um nome, o tipo de missão do app, o recurso e as horas.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CURSOS, cursosVazios, normalizarCursos, normalizarCursoDoAluno, novaMissaoDoCurso } from '../../js/cursos.js';

const missao = (id, extra = {}) => ({ id, nome: `Missão ${id}`, mis: 'Voo Local', eq: 'C152', nb: 1, ...extra });

describe('Programa dos cursos', () => {
  it('os três cursos, nesta ordem; sem programa, cada um começa vazio', () => {
    assert.deepEqual(CURSOS.map(([id]) => id), ['PP', 'PC', 'INVA']);
    assert.deepEqual(cursosVazios(), { PP: [], PC: [], INVA: [] });
    assert.deepEqual(normalizarCursos(undefined), cursosVazios());
  });

  it('só missões válidas: código curto e único no curso, missão do app, recurso da missão e horas inteiras de 1 a 11', () => {
    const cursos = normalizarCursos({
      PP: [missao('PP-01'), missao('pp-02 ', { nome: '  Navegação  ', mis: 'Navegação', nb: 2 }), missao('PP-01'), missao('', {}), missao('PP 03'),
        missao('PP-04', { mis: 'Inexistente' }), missao('PP-05', { eq: 'PA-34', mis: 'Noturno' }), missao('PP-06', { nb: 40 })],
      PC: 'x',
      XYZ: [missao('X-1')]
    });
    assert.deepEqual(cursos.PP.map(m => [m.id, m.nome, m.mis, m.eq, m.nb]), [
      ['PP-01', 'Missão PP-01', 'Voo Local', 'C152', 1],
      ['PP-02', 'Navegação', 'Navegação', 'C152', 2],
      ['PP-05', 'Missão PP-05', 'Noturno', 'C172', 1],
      ['PP-06', 'Missão PP-06', 'Voo Local', 'C152', 1]
    ]);
    assert.deepEqual([cursos.PC, cursos.INVA, Object.keys(cursos)], [[], [], ['PP', 'PC', 'INVA']]);
  });

  it('o Ground é na sala, com 1h30; sem nome, o nome é o código', () => {
    const [ground] = normalizarCursos({ PP: [missao('PP-G1', { mis: 'Ground C152', eq: 'C152', nb: 3, nome: '' })] }).PP;
    assert.deepEqual(ground, { id: 'PP-G1', nome: 'PP-G1', mis: 'Ground C152', eq: 'Sala Ground', nb: 1.5 });
  });

  it('a missão nova recebe o próximo número livre do curso', () => {
    assert.deepEqual(novaMissaoDoCurso('PP', []), { id: 'PP-01', nome: '', mis: 'Voo Local', eq: 'C152', nb: 1 });
    assert.equal(novaMissaoDoCurso('INVA', [missao('INVA-01'), missao('INVA-07'), missao('INVA-X')]).id, 'INVA-08');
  });

  it('o curso do aluno: só um dos três', () => {
    assert.equal(normalizarCursoDoAluno('PC'), 'PC');
    assert.equal(normalizarCursoDoAluno('pc'), undefined);
    assert.equal(normalizarCursoDoAluno(undefined), undefined);
  });
});

describe('A missão do curso no pedido e na escala', async () => {
  const { normalizeMissionFields } = await import('../../js/rules.js');
  const { runAllocationEngine } = await import('../../js/engine.js');
  const { aluno, cenario, instrutor, missaoExtra, GROUND_C152 } = await import('../helpers/montar.js');

  it('o pedido guarda o código da missão do curso; um código fora do formato sai', () => {
    const certo = { mis: 'Navegação', eq: 'C152', p1: 500, p2: -1, nb: 2, etapa: 'PP-07' };
    normalizeMissionFields(certo);
    assert.equal(certo.etapa, 'PP-07');
    const errado = { mis: 'Navegação', eq: 'C152', p1: 500, p2: -1, nb: 2, etapa: 'PP 07' };
    normalizeMissionFields(errado);
    assert.equal(Object.hasOwn(errado, 'etapa'), false);
  });

  it('o voo, a missão extra e o Ground levam o código para a escala', () => {
    const { out } = runAllocationEngine(cenario({
      ins: [instrutor(1, 9), instrutor(2, 9)],
      stu: [aluno(1000, { p1: 390, p2: -1, etapa: 'PP-07' }, { extra: [missaoExtra(1001, { p1: 610, p2: -1, etapa: 'PP-08' })] }),
        aluno(1002, { ...GROUND_C152, p1: 500, p2: -1, etapa: 'PP-G1' }), aluno(1003, { p1: 870, p2: -1 })]
    }));
    const porPedido = Object.fromEntries(out.map(o => [`${o.stuId}_${o.mid}`, o.etapa]));
    assert.deepEqual(porPedido, { '1000_0': 'PP-07', '1000_1001': 'PP-08', '1002_0': 'PP-G1', '1003_0': undefined });
  });
});
