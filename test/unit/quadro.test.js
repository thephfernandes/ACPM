// Painel do dia no estilo dos aeroportos (fase 8): um quadro de Partidas (todas as do dia) e um de Chegadas (as que
// ainda não pousaram), que se alternam página a página, como nos painéis da INFRAERO. Servem à visão "Painel" da
// Escala e, depois, à tela da recepção.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { linhasDoQuadro, quadroDePartidas, quadroDeChegadas, minutoDoQuadro, paginar, telasDoPainel } from '../../js/quadro.js';

const voo = (fKey, a, extra = {}) => ({
  fKey, classKey: fKey, isGround: false, a, b: a + 60, o: 0, r: 'PR-VOB', eqType: 'C152', s: `Aluno ${fKey.split('_')[0]}`,
  ins: 'Instrutor 01', insId: 1, mis: 'Voo Local', status: 'Confirmado', ...extra
});
const turma = (alunos, a = 390) => alunos.map((id, o) => voo(`${id}_0_1`, a, {
  classKey: 'GND_Ground C152_0_1', isGround: true, b: a + 90, o, r: 'SALA-GROUND', eqType: 'Sala Ground', mis: 'Ground C152'
}));
const colunas = l => [l.horario, l.previsto, l.missao, l.modelo, l.aeronave, l.aluno, l.instrutor, l.observacao];

describe('Linhas do painel', () => {
  it('uma linha por voo, em ordem de decolagem; a turma de Ground é uma linha só', () => {
    const linhas = linhasDoQuadro([...turma([1000, 1001]), voo('1002_0_1', 390, { r: 'PP-ABP', eqType: 'C172', mis: 'IFR' }), voo('1003_0_1', 610)]);
    assert.deepEqual(linhas.map(l => [l.inicio, l.fim, l.recurso, l.modelo, l.ground, l.alunos, l.missao, l.status]), [
      [390, 480, 'Sala Ground', '', true, ['Aluno 1000', 'Aluno 1001'], 'Ground C152', 'Confirmado'],
      [390, 450, 'PP-ABP', 'C172', false, ['Aluno 1002'], 'IFR', 'Confirmado'],
      [610, 670, 'PR-VOB', 'C152', false, ['Aluno 1003'], 'Voo Local', 'Confirmado']
    ]);
  });

  it('a missão do curso vem antes do tipo de missão (a turma de Ground fica só com o tipo)', () => {
    const linhas = linhasDoQuadro([voo('1000_0_1', 390, { mis: 'Navegação', etapa: 'PP-07' }), ...turma([1001, 1002], 500).map(o => ({ ...o, etapa: 'PP-G1' }))]);
    assert.deepEqual(linhas.map(l => l.missao), ['PP-07 · Navegação', 'Ground C152']);
  });

  it('o atrasado vai para o novo horário, com o original guardado; o cancelado leva o motivo', () => {
    const out = [voo('1000_0_1', 390), voo('1001_0_1', 610), voo('1002_0_1', 690)];
    const linhas = linhasDoQuadro(out, { '1000_0_1': 'Atrasado', '1002_0_1': 'Cancelado' },
      { '1000_0_1': { novoInicio: 660 }, '1002_0_1': { motivo: 'Outro', texto: 'Pista interditada' } });
    assert.deepEqual(linhas.map(l => [l.alunos[0], l.inicio, l.fim, l.original, l.status, l.motivo]), [
      ['Aluno 1001', 610, 670, null, 'Confirmado', ''],
      ['Aluno 1000', 660, 720, { inicio: 390, fim: 450 }, 'Atrasado', ''],
      ['Aluno 1002', 690, 750, null, 'Cancelado', 'Pista interditada']
    ]);
  });

  it('a turma só é cancelada quando todos os alunos estão cancelados', () => {
    assert.equal(linhasDoQuadro(turma([1000, 1001]), { '1000_0_1': 'Cancelado' })[0].status, 'Confirmado');
    assert.equal(linhasDoQuadro(turma([1000, 1001]), { '1000_0_1': 'Cancelado', '1001_0_1': 'Cancelado' })[0].status, 'Cancelado');
  });
});

describe('Quadro de partidas', () => {
  it('todas as partidas do dia, pelo horário previsto; o atrasado com a nova decolagem em "Previsto"', () => {
    const out = [voo('1000_0_1', 390), voo('1001_0_1', 610, { r: 'PT-KIW', eqType: 'PA-34', mis: 'Multimotor', ins: 'Instrutor 02' })];
    const partidas = quadroDePartidas(linhasDoQuadro(out, { '1000_0_1': 'Atrasado' }, { '1000_0_1': { novoInicio: 640 } }));
    assert.deepEqual(partidas.map(colunas), [
      [610, null, 'Multimotor', 'PA-34', 'PT-KIW', 'Aluno 1001', 'Instrutor 02', 'Confirmado'],
      [390, 640, 'Voo Local', 'C152', 'PR-VOB', 'Aluno 1000', 'Instrutor 01', 'Atrasado']
    ]);
  });

  it('a observação é o status (o cancelado com o motivo); a classe segue o status', () => {
    const out = ['1000', '1001', '1002', '1003'].map((id, i) => voo(`${id}_0_1`, 390 + 60 * i));
    const fStatus = { '1000_0_1': 'Pendente', '1001_0_1': 'Em Voo', '1002_0_1': 'Cancelado', '1003_0_1': 'Cancelado' };
    const partidas = quadroDePartidas(linhasDoQuadro(out, fStatus, { '1002_0_1': { motivo: 'Meteorologia' } }));
    assert.deepEqual(partidas.map(l => [l.observacao, l.classe]), [
      ['Pendente', 'Pendente'], ['Em voo', 'EmVoo'], ['Cancelado · Meteorologia', 'Cancelado'], ['Cancelado', 'Cancelado']
    ]);
  });

  it('Ground sem os nomes dos alunos (só quantos são) e com a sala; simulador com o modelo dele', () => {
    const out = [...turma([1000, 1001, 1002]), voo('1003_0_1', 500, { r: 'SIM-MONO-A', eqType: 'Sim. Mono', mis: 'Simulador' }), ...turma([1004], 610)
      .map(o => ({ ...o, classKey: 'GND_Ground C152_2_1' }))];
    assert.deepEqual(quadroDePartidas(linhasDoQuadro(out)).map(l => [l.aluno, l.aeronave, l.modelo]), [
      ['3 alunos', 'Sala Ground', 'Ground'], ['Aluno 1003', 'SIM-MONO-A', 'Sim. Mono'], ['1 aluno', 'Sala Ground', 'Ground']
    ]);
  });
});

describe('Quadro de chegadas', () => {
  const out = [voo('1000_0_1', 390), voo('1001_0_1', 610), voo('1002_0_1', 690), voo('1003_0_1', 760), voo('1004_0_1', 820)];
  const fStatus = { '1001_0_1': 'Em Voo', '1003_0_1': 'Cancelado', '1004_0_1': 'Atrasado' };
  const fObs = { '1003_0_1': { motivo: 'Meteorologia' }, '1004_0_1': { novoInicio: 850 } };
  const chegadas = agora => quadroDeChegadas(linhasDoQuadro(out, fStatus, fObs), agora);

  it('só as pendentes (o pouso ainda não passou), pelo pouso previsto; o atrasado com o novo pouso em "Previsto"', () => {
    // 12:00: o das 06:30 já pousou; o das 10:10 está em voo (atrasado para pousar) e continua até mudar de status
    assert.deepEqual(chegadas(720).map(colunas), [
      [670, null, 'Voo Local', 'C152', 'PR-VOB', 'Aluno 1001', 'Instrutor 01', 'Em voo'],
      [750, null, 'Voo Local', 'C152', 'PR-VOB', 'Aluno 1002', 'Instrutor 01', 'Confirmado'],
      [820, null, 'Voo Local', 'C152', 'PR-VOB', 'Aluno 1003', 'Instrutor 01', 'Cancelado · Meteorologia'],
      [880, 910, 'Voo Local', 'C152', 'PR-VOB', 'Aluno 1004', 'Instrutor 01', 'Atrasado']
    ]);
  });

  it('o cancelado sai quando o horário dele passa; dia que ainda não começou: todas; dia que já passou: nenhuma', () => {
    assert.deepEqual(chegadas(830).map(l => l.aluno), ['Aluno 1001', 'Aluno 1004']);
    assert.equal(chegadas(-Infinity).length, 5);
    assert.equal(chegadas(Infinity).length, 0);
  });

  it('o minuto do quadro: o de agora no dia de hoje; antes de tudo num dia futuro; depois de tudo num dia passado', () => {
    assert.equal(minutoDoQuadro('2026-11-10', '2026-11-10', 725), 725);
    assert.equal(minutoDoQuadro('2026-11-11', '2026-11-10', 725), -Infinity);
    assert.equal(minutoDoQuadro('2026-11-09', '2026-11-10', 725), Infinity);
  });
});

describe('Páginas e alternância', () => {
  it('páginas do tamanho pedido, e pelo menos uma (vazia) quando não há nada', () => {
    assert.deepEqual(paginar([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(paginar([], 2), [[]]);
  });

  it('as telas se alternam como no aeroporto: as páginas de partidas e depois as de chegadas', () => {
    const telas = telasDoPainel([1, 2, 3], [4], 2);
    assert.deepEqual(telas.map(t => [t.quadro, t.pagina, t.paginas, t.linhas]), [
      ['partidas', 1, 2, [1, 2]], ['partidas', 2, 2, [3]], ['chegadas', 1, 1, [4]]
    ]);
    assert.deepEqual(telasDoPainel([], [], 16).map(t => [t.quadro, t.linhas]), [['partidas', []], ['chegadas', []]]);
  });
});

describe('O quadro da TV da recepção (o mesmo que o servidor entrega)', async () => {
  const { nomeCurto, quadroDoDia } = await import('../../js/quadro.js');

  it('o aluno abreviado: o primeiro nome e a inicial do último; um nome só fica inteiro', () => {
    assert.deepEqual(['Maria Silva Santos', 'João', '  Ana   Paula  ', '', 'Aluno 12'].map(nomeCurto), ['Maria S.', 'João', 'Ana P.', '', 'Aluno 12']);
  });

  it('do dia gravado: os voos em ordem, só com o que o quadro mostra; do detalhe, o novo horário e a categoria do motivo', () => {
    const dia = {
      fStatus: { '1000_0_1': 'Atrasado', '1001_0_1': 'Cancelado' },
      fObs: { '1000_0_1': { novoInicio: 640 }, '1001_0_1': { motivo: 'Outro', texto: 'Aluno com febre' } },
      resultado: { out: [
        voo('1000_0_1', 610, { s: 'Maria Silva Santos', kg: 140, stuId: 1000, etapa: 'PP-07' }),
        voo('1001_0_1', 390, { s: 'João', r: 'PP-ABP', eqType: 'C172', mis: 'IFR' })
      ] }
    };
    const quadro = quadroDoDia(dia);
    assert.deepEqual(quadro.voos.map(v => [v.fKey, v.a, v.s]), [['1001_0_1', 390, 'João'], ['1000_0_1', 610, 'Maria S.']]);
    assert.deepEqual(Object.keys(quadro.voos[0]).sort(), ['a', 'b', 'classKey', 'eqType', 'etapa', 'fKey', 'ins', 'isGround', 'mis', 'r', 's', 'status']);
    assert.deepEqual(quadro.voos.map(v => v.etapa), [null, 'PP-07'], 'a missão do curso (fase 14)');
    assert.deepEqual(quadro.fStatus, dia.fStatus);
    assert.deepEqual(quadro.fObs, { '1000_0_1': { novoInicio: 640 }, '1001_0_1': { motivo: 'Outro' } });
    assert.deepEqual(quadroDoDia({ pedidos: {} }), { voos: null, fStatus: {}, fObs: {} }, 'dia sem escala gravada');
    assert.deepEqual(quadroDoDia(null), { voos: null, fStatus: {}, fObs: {} });
  });
});
