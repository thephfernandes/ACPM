// Agendar um voo na Escala (js/agendamento.js): o contexto, os horários e o encaixe, os padrões do formulário (a missão
// pelo progresso, o recurso e o instrutor livres, o horário, a duração e o peso), o pedido e o voo fixo que o agendamento
// cria, a simulação (a prévia é a escala que fica) e a conferência: cada bloqueio, aviso e nota
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  contextoInicial, horariosDoAgendamento, encaixarHorario, duracaoDoAgendamento, opcoesDeAluno, opcoesDeMissao,
  opcoesDeRecurso, opcoesDeInstrutor, formularioDoAgendamento, aplicarAgendamento, simularAgendamento, avaliarAgendamento, comPesos,
  assinaturaDosAvisos, descricaoDoAgendamento, reversaoDoAgendamento, historicoDosPesos, escolhasDaAlternativa, nomeDaData
} from '../../js/agendamento.js';
import { naOrdemDoMotor } from '../../js/rejeicoes.js';
import { ocupacaoDaEscala } from '../../js/candidatos.js';
import { runAllocationEngine } from '../../js/engine.js';
import { validarReversao, desfazerAgendamento, motivoParaNaoDesfazer } from '../../js/reversoes.js';
import { normalizarLinhaGravada } from '../../js/escala-gravada.js';
import { noturnosDaVespera, comRepousoDoNoturno } from '../../js/noturno.js';
import { fixosAoAprovar, fixosAoMudarStatus } from '../../js/fixos.js';
import { normalizeMissionFields } from '../../js/rules.js';
import { gerarCenario } from '../helpers/cenarios.js';
import { situacaoPorMissao } from '../../js/resultados.js';
import { T } from '../../js/config.js';
import { hm } from '../../js/format.js';
import { HORARIOS_PADRAO, DE_30_EM_30 } from '../../js/horarios.js';
import { aluno, cenario, instrutor, missaoExtra, apenas, GROUND_C152 } from '../helpers/montar.js';
import { novoCurso, comExigenciasDasMissoes } from '../../js/programa.js';
import { MODELOS } from '../../js/modelos-de-curso.js';

const DATA = '2026-11-11', HOJE = '2026-11-10';
// O cronograma do PP (o modelo do app, com o Noturno em trechos) como o curso PP, com os ids tirados da sigla e da chave
// (PP:F4, PP:TSL-01)
const cursoPP = () => novoCurso([], { sigla: 'PP', nome: 'Piloto Privado', modelo: MODELOS['pp-acpm'] }, (s, c) => `${s}:${c}`).curso;
const PP = cursoPP();
const aprovadas = (stuId, codigos) => codigos.map((missao, i) => ({ id: i + 1, aluno: stuId, curso: 'PP', missao, resultado: 'aprovado', data: '2026-11-01' }));
const ambiente = ({ registros = [], ...resto } = {}) => ({
  programa: [PP], situacao: situacaoPorMissao(registros), inferir: true, data: DATA, hoje: HOJE, agora: 600, semHoras: false, ...resto
});
const codigos = lista => lista.map(i => i.codigo);
const opcoes = grupos => grupos.flatMap(g => g.opcoes);
const semAlternativas = ({ alternativas, ...item }) => item;

// O agendamento inteiro, como o diálogo faz: o formulário, a escala com os pesos digitados, a simulação e a conferência
function agendar(estado, { amb = ambiente(), contexto = 'dia', escolhas = {}, tocados = [] } = {}) {
  const base = runAllocationEngine(estado);
  const formulario = formularioDoAgendamento(estado, base, amb, contextoInicial(contexto, amb), escolhas, new Set(tocados));
  if (!formulario.proposta) return { base, formulario, avaliacao: avaliarAgendamento({ estado, baseComPesos: base, formulario, ambiente: amb }) };
  const comOsPesos = comPesos(estado, formulario.proposta);
  const baseComPesos = comOsPesos === estado ? base : runAllocationEngine(comOsPesos);
  const { sim, estadoDaSim, fKey } = simularAgendamento(estado, base, formulario.proposta);
  return { base, formulario, sim, fKey, avaliacao: avaliarAgendamento({ estado, base, baseComPesos, sim, estadoDaSim, fKey, formulario, ambiente: amb }) };
}

// Dois instrutores; o Aluno 1000 voa às 06:30 (o app escolheu); o Aluno 1001, do PP, não voa hoje
const doDia = ({ ins = [instrutor(1, 9), instrutor(2, 9)], s1000 = {}, s1001 = {}, extra = {} } = {}) => ({
  ...cenario({ ins, stu: [aluno(1000, { p1: 390, p2: -1, ...s1000 }, { curso: 'PP' }), aluno(1001, { fly: false, ...s1001 }, { curso: 'PP' })] }),
  ...extra
});

describe('Agendamento: os horários e o encaixe', () => {
  it('os horários de cada missão, só nas janelas abertas; o Ground só nas janelas do dia', () => {
    const estado = cenario();
    assert.deepEqual(horariosDoAgendamento(estado, { mis: 'Voo Local', tipo: 'C152' }), HORARIOS_PADRAO);
    assert.deepEqual(horariosDoAgendamento(estado, { mis: 'Voo Local', tipo: 'PA-34' }), DE_30_EM_30);
    assert.deepEqual(horariosDoAgendamento(estado, { mis: 'Noturno', tipo: 'C172' }), [T[8]]);
    assert.deepEqual(horariosDoAgendamento(estado, { mis: 'Voo Solo', tipo: 'C152' }), [T[0]]);
    const comHorarios = { ...estado, horarios: { C152: [420, 480], C172: [420], sim: [420], 'PA-34': [420] } };
    assert.deepEqual(horariosDoAgendamento(comHorarios, { mis: 'Ground C152', tipo: 'Sala Ground' }), T.slice(0, 8));
    assert.deepEqual(horariosDoAgendamento(comHorarios, { mis: 'Voo Local', tipo: 'C152' }), [420, 480]);
    // A janela das 10:10 fechada: os horários que caem nela saem
    const fechada = { ...estado, win: estado.win.map((v, w) => w !== 2) };
    assert.ok(!horariosDoAgendamento(fechada, { mis: 'Voo Local', tipo: 'C152' }).includes(610));
    assert.deepEqual(horariosDoAgendamento(fechada, { mis: 'Voo Local', tipo: 'PA-34' }).filter(m => m >= 600 && m < 700), [600, 690]);
  });

  it('o encaixe: o mais perto do minuto, o mais cedo no empate, o livre antes; nenhum livre, o mais perto', () => {
    assert.equal(encaixarHorario(625, HORARIOS_PADRAO), 610);
    assert.equal(encaixarHorario(555, HORARIOS_PADRAO), 500, 'empate entre 08:20 e 10:10');
    assert.equal(encaixarHorario(625, HORARIOS_PADRAO, m => m !== 610), 690);
    assert.equal(encaixarHorario(625, HORARIOS_PADRAO, () => false), 610);
    assert.equal(encaixarHorario(625, []), null);
  });

  it('o contexto: a barra da Escala (hoje, a partir de agora), a linha de um recurso ou instrutor, um horário da lista, a turma e o clique no mapa', () => {
    const datas = { data: DATA, hoje: DATA, agora: 605 };
    assert.deepEqual(contextoInicial('dia', datas), { valor: 'dia', origem: 'dia', r: null, insId: null, classKey: null, w: null, minuto: 605, desde: 605, ate: null, perto: false });
    assert.deepEqual([contextoInicial('dia', { ...datas, hoje: HOJE })].map(c => [c.minuto, c.desde]), [[0, null]]);
    assert.deepEqual(['r:PR-VOB', 'i:7', 'w:2', 'w:8', 't:GND_1'].map(v => contextoInicial(v, { data: DATA, hoje: HOJE })).map(c => [c.origem, c.r, c.insId, c.desde, c.ate, c.classKey]), [
      ['recurso', 'PR-VOB', null, null, null, null], ['instrutor', null, 7, null, null, null], ['periodo', null, null, 610, 690, null],
      ['periodo', null, null, 1050, 1440, null], ['turma', null, null, null, null, 'GND_1']
    ]);
    const clique = contextoInicial({ r: 'PR-VOB', minuto: 625 }, datas);
    assert.deepEqual([clique.origem, clique.r, clique.minuto, clique.perto, clique.desde], ['mapa', 'PR-VOB', 625, true, null]);
    assert.equal(contextoInicial('i:x', datas).origem, 'dia');
  });

  it('a duração: a fixa (o Ground, o Noturno), a do programa, a do pedido, a padrão da missão e 1 h', () => {
    assert.deepEqual(duracaoDoAgendamento({ mis: 'Ground C152' }), { horas: 1.5, fixa: true });
    assert.deepEqual(duracaoDoAgendamento({ mis: 'Noturno', missao: { nb: 3 } }), { horas: 4, fixa: true });
    assert.deepEqual(duracaoDoAgendamento({ mis: 'Navegação', missao: { nb: 1.5 }, pedido: { nb: 2.6 } }), { horas: 1.5, fixa: false });
    assert.deepEqual(duracaoDoAgendamento({ mis: 'Navegação', pedido: { nb: 2.6 } }), { horas: 2.6, fixa: false });
    assert.deepEqual(duracaoDoAgendamento({ mis: 'Simulador' }), { horas: 2, fixa: false });
    assert.deepEqual(duracaoDoAgendamento({ mis: 'Voo Local' }), { horas: 1, fixa: false });
  });
});

describe('Agendamento: os padrões do formulário', () => {
  const amb = ambiente({ registros: aprovadas(1001, ['IN-01']) });

  it('sem aluno, o formulário espera por ele', () => {
    const { formulario } = agendar(doDia(), { amb });
    assert.equal(formulario.aluno, null);
    assert.deepEqual(codigos(formulario.formato), ['sem-aluno']);
    assert.equal(formulario.formato[0].texto, 'Escolha o aluno: a missão, o horário e o peso vêm dele.');
  });

  // O contexto é a descrição do diálogo (aria-describedby): ele diz de onde o diálogo abriu desde antes do aluno, e
  // depois, com o horário que o formulário escolheu
  it('a descrição do diálogo diz de onde ele abriu, antes e depois do aluno: a barra, a linha, o horário da lista, o clique e a turma', () => {
    const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 9), instrutor(7, 9)], stu: [
      aluno(1000, { p1: 390, p2: -1 }, { curso: 'PP' }), aluno(1001, { fly: false }, { curso: 'PP' }), ...[1002, 1003].map(id => aluno(id, { ...GROUND_C152, p1: 500, p2: -1 }))
    ] });
    const turma = runAllocationEngine(estado).out.find(o => o.isGround);
    const descricoes = contexto => [{}, { aluno: 1001 }].map(escolhas => {
      const { formulario: f } = agendar(estado, { amb, contexto, escolhas });
      return f.recurso ? f.contextoTexto.replaceAll(f.recurso, 'R') : f.contextoTexto;
    });
    assert.deepEqual(descricoes('dia'), ['Quarta-feira, 11/11 · o primeiro horário livre', 'Quarta-feira, 11/11 · o primeiro horário livre: 06:30']);
    assert.deepEqual(descricoes('r:PR-VOB'), ['PR-VOB · C152 · o primeiro horário livre', 'R · C152 · o primeiro horário livre: 06:30']);
    // A linha da sala de Ground, com um aluno cuja missão é um voo: o voo vai para um avião, e a descrição diz por quê
    assert.deepEqual(descricoes('r:SALA-GROUND'), ['Sala Ground · o primeiro horário livre', 'R · C152 · o primeiro horário livre: 06:30. A sala de Ground não serve ao Voo Local: o voo vai no R.']);
    assert.deepEqual(descricoes('i:7'), ['Com Instrutor 07 · o primeiro horário livre', 'Com Instrutor 07 · o primeiro horário livre: 06:30']);
    assert.deepEqual(descricoes('w:2'), ['O primeiro horário livre a partir das 10:10', 'R · C152 · o primeiro horário livre a partir das 10:10: 10:10']);
    assert.deepEqual(descricoes({ r: 'PR-VOB', minuto: 865 }), ['PR-VOB · C152 · clique perto das 14:25', 'R · C152 · clique perto das 14:25 → 14:30 (horários do C152)']);
    assert.deepEqual(descricoes({ insId: 7, minuto: 500 }), ['Com Instrutor 07 · clique perto das 08:20', 'Com Instrutor 07 · R · C152 · clique perto das 08:20 → 08:20 (horários do C152)']);
    assert.deepEqual(descricoes(`t:${turma.classKey}`), Array(2).fill(`Turma de Ground C152 das 08:20 com ${turma.ins}`));
    // A linha do PR-VOB: o voo fica nele, e a descrição o diz
    assert.equal(agendar(estado, { amb, contexto: 'r:PR-VOB', escolhas: { aluno: 1001 } }).formulario.contextoTexto, 'PR-VOB · C152 · o primeiro horário livre: 06:30');
    assert.equal(agendar(estado, { amb, contexto: { r: 'PR-VOB', minuto: 865 }, escolhas: { aluno: 1001 } }).formulario.contextoTexto, 'PR-VOB · C152 · clique perto das 14:25 → 14:30 (horários do C152)');
    // A linha do recurso continua como o recurso do voo (o padrão); o recurso que o operador troca não é "o que não serve"
    const trocado = agendar(estado, { amb, contexto: 'r:PR-VOB', escolhas: { aluno: 1001, recurso: 'PR-VOC' }, tocados: ['recurso'] }).formulario;
    assert.deepEqual([trocado.recurso, trocado.contextoTexto], ['PR-VOC', 'PR-VOC · C152 · o primeiro horário livre: 06:30']);
    // A linha do PR-JPL (Só Parafuso) não serve ao voo local: a explicação fica também depois de o operador escolher outro
    // recurso, ou outro horário pelas alternativas (que marcam todos os campos como escolhidos)
    for (const tocados of [[], ['recurso', 'horario']]) {
      const f = agendar(estado, { amb, contexto: 'r:PR-JPL', escolhas: { aluno: 1001, recurso: 'PR-VOC', horario: 500 }, tocados }).formulario;
      assert.ok(f.contextoTexto.endsWith(`. O PR-JPL não serve ao Voo Local: o voo vai no ${f.recurso}.`), f.contextoTexto);
    }
    // Hoje, a barra parte de agora
    assert.deepEqual(agendar(estado, { amb: { ...amb, hoje: DATA, agora: 600 } }).formulario.contextoTexto, 'Quarta-feira, 11/11 · o primeiro horário livre a partir de agora');
  });

  it('os alunos em grupos: fora da escala, na demanda e os outros, com o curso, a próxima missão e os horários do dia', () => {
    const estado = doDia({ ins: [instrutor(1, 9)], s1000: { jan: 'h390' }, extra: {} });
    estado.stu.push(aluno(1002, { p1: 390, p2: -1, jan: 'h390' }, { bl: [1] }));
    const base = runAllocationEngine(estado);
    const grupos = opcoesDeAluno(estado, base, amb, contextoInicial('i:1', amb));
    assert.deepEqual(grupos.map(g => [g.rotulo, g.opcoes.map(o => o.texto)]), [
      ['Ficaram fora da escala', ['Aluno 1002 · não voa com Instrutor 01']],
      ['Na demanda de amanhã', ['Aluno 1000 — PP · próxima IN-01 · voa amanhã às 06:30']],
      ['Outros alunos', ['Aluno 1001 — PP · próxima IN-02']]
    ]);
  });

  // O operador costuma montar a escala de amanhã: os textos que falam dos voos da data aberta dizem hoje, amanhã ou a
  // data, nunca "hoje" para outra data
  it('a data aberta pelo nome certo nos textos do diálogo: hoje, amanhã ou a data', () => {
    assert.deepEqual(nomeDaData({ data: DATA, hoje: DATA }), { de: 'de hoje', quando: 'hoje', curto: 'hoje' });
    assert.deepEqual(nomeDaData({ data: DATA, hoje: HOJE }), { de: 'de amanhã', quando: 'amanhã', curto: 'amanhã' });
    // Depois de amanhã, ontem e em outro ano: a data
    assert.deepEqual(nomeDaData({ data: DATA, hoje: '2026-11-09' }), { de: 'de 11/11', quando: 'em 11/11', curto: '11/11' });
    assert.equal(nomeDaData({ data: DATA, hoje: '2026-11-12' }).quando, 'em 11/11');
    assert.equal(nomeDaData({ data: '2027-01-02', hoje: '2026-12-31' }).de, 'de 02/01/2027');
    assert.deepEqual(nomeDaData({}), { de: 'do dia', quando: '', curto: '' });
    // O Aluno 1000 voa a IN-01 às 06:30 na data
    const estado = doDia({ s1000: { etapa: 'IN-01', cursoDaEtapa: 'PP' } });
    const textos = hoje => {
      const amb = ambiente({ hoje, agora: 0 });
      const { base, formulario: f } = agendar(estado, { amb, escolhas: { aluno: 1000 } });
      const r = base.out.find(o => o.stuId === 1000).r;
      const noturno = agendar(estado, { amb, contexto: { r: 'PR-VOY', minuto: 600 }, escolhas: { aluno: 1001, missao: 'tipo:Noturno' }, tocados: ['missao'] }).avaliacao;
      return [
        f.alunos[0].rotulo, f.alunos[0].opcoes[0].texto.replace(/^.* · voa/, 'voa'), f.alunoInfo.replace(/^.* · já/, 'já').replace(r, 'R'),
        f.missoes.grupos[0].rotulo, f.missoes.grupos[0].opcoes[0].texto.replace(r, 'R'), opcoes(f.missoes.grupos).find(o => o.valor === 'missao:PP:IN-01').texto,
        noturno.notas.find(n => n.codigo === 'noturno').texto.replace(/;.*/, '')
      ];
    };
    assert.deepEqual(textos(HOJE), [
      'Na demanda de amanhã', 'voa amanhã às 06:30', 'já voa amanhã às 06:30 (IN-01, R)', 'Voos de amanhã do aluno', 'Mover IN-01 · Voo Local (amanhã 06:30, R)',
      'IN-01 · Voo Local · C152 · 1 h (já no voo de amanhã às 06:30)', 'O Noturno volta em 12/11 às 07:30'
    ]);
    assert.deepEqual(textos(DATA), [
      'Na demanda de hoje', 'voa hoje às 06:30', 'já voa hoje às 06:30 (IN-01, R)', 'Voos de hoje do aluno', 'Mover IN-01 · Voo Local (hoje 06:30, R)',
      'IN-01 · Voo Local · C152 · 1 h (já no voo de hoje às 06:30)', 'O Noturno volta amanhã às 07:30'
    ]);
    assert.deepEqual(textos('2026-11-09'), [
      'Na demanda de 11/11', 'voa em 11/11 às 06:30', 'já voa em 11/11 às 06:30 (IN-01, R)', 'Voos de 11/11 do aluno', 'Mover IN-01 · Voo Local (11/11 06:30, R)',
      'IN-01 · Voo Local · C152 · 1 h (já no voo de 11/11 às 06:30)', 'O Noturno volta em 12/11 às 07:30'
    ]);
    // A data de ontem: o Noturno dela volta hoje
    assert.equal(textos('2026-11-12').at(-1), 'O Noturno volta hoje às 07:30');
  });

  it('a próxima missão do curso, o recurso livre, o instrutor que serve, o primeiro horário livre, a duração e o peso do cadastro', () => {
    const estado = doDia();
    const { base, formulario: f } = agendar(estado, { amb, escolhas: { aluno: 1001 } });
    assert.equal(f.missao, 'missao:PP:IN-02');
    assert.equal(f.missoes.nota, 'Próxima do PP: IN-02 (Fase 1).');
    assert.equal(f.alunoInfo, 'PP · Fase 1 · 1/46 · próxima IN-02');
    const voo1000 = base.out.find(o => o.stuId === 1000);
    assert.notEqual(f.recurso, voo1000.r, 'o recurso livre antes do ocupado agora');
    assert.equal(f.recursos.find(o => o.valor === voo1000.r).texto, `${voo1000.r} · C152 — ocupado agora (o app reorganiza)`);
    assert.equal(f.instrutor, 2, 'o instrutor 1 voa às 06:30 (o app reorganiza)');
    assert.deepEqual(f.instrutores.map(g => [g.rotulo, g.opcoes.map(o => o.texto)]), [
      ['Servem neste horário', ['Instrutor 02']], ['Com aviso', ['Instrutor 01 — ocupado agora (o app reorganiza)']]
    ]);
    assert.equal(f.horario, 390);
    assert.deepEqual(f.horas, { valor: '1', fixa: false });
    assert.deepEqual(f.peso, { visivel: true, aluno: '70', instrutor: '70', resumo: '140 kg de 170 kg no C152: tanque cheio.' });
    assert.equal(f.contextoTexto, 'Quarta-feira, 11/11 · o primeiro horário livre: 06:30');
    assert.deepEqual(f.proposta, {
      stuId: 1001, mis: 'Voo Local', eq: 'C152', nb: 1, a: 390, b: 450, r: f.recurso, insId: 2, missao: { sigla: 'PP', codigo: 'IN-02' },
      pesos: { aluno: 70, instrutor: 70 }, disponibilizar: null
    });
  });

  it('hoje, a partir de agora; o instrutor do "Priorizar com" que serve vem antes; o que o operador mudou fica', () => {
    const estado = doDia({ ins: [instrutor(1, 9), instrutor(2, 9), instrutor(3, 9)] });
    estado.stu[1].voaCom = [3];
    const hoje = { ...amb, hoje: DATA, agora: 600 };
    const { formulario: f } = agendar(estado, { amb: hoje, escolhas: { aluno: 1001 } });
    assert.equal(f.horario, 610, 'a partir das 10:00');
    assert.equal(f.instrutor, 3, 'o do Priorizar com');
    assert.equal(f.contextoTexto, 'Quarta-feira, 11/11 · o primeiro horário livre a partir de agora: 10:10');
    const mudado = agendar(estado, { amb: hoje, escolhas: { aluno: 1001, instrutor: 1, horario: 820, recurso: 'PR-VOC' }, tocados: ['instrutor', 'horario', 'recurso'] }).formulario;
    assert.deepEqual([mudado.instrutor, mudado.horario, mudado.recurso], [1, 820, 'PR-VOC']);
  });

  it('o primeiro horário livre também para o aluno: quem volta do noturno de ontem só voa a partir das 10:10', () => {
    const estado = doDia();
    estado.noturnosDaVespera = [{ stuId: 1001, mid: 0, insId: 1, r: 'PR-VOY', eqType: 'C172', s: 'Aluno 1001', ins: 'Instrutor 01', stuKg: 70, fim: 1290 }];
    const { formulario } = agendar(estado, { amb, escolhas: { aluno: 1001 } });
    assert.equal(formulario.horario, 610);
    assert.match(formulario.alunoInfo, /já voa amanhã às 07:30 \(Noturno, PR-VOY\)$/);
  });

  it('a preferência do contexto: no avião Só Parafuso, o PE-04; sem contexto, a primeira liberada; no C172, a missão do C152 com aviso', () => {
    const f1a4 = ambiente({ registros: aprovadas(1001, PP.missoes.filter(m => ['PP:F1', 'PP:F2', 'PP:F3', 'PP:F4'].includes(m.fase)).map(m => m.codigo)) });
    const estado = doDia();
    const stu = estado.stu[1];
    const base = runAllocationEngine(estado);
    const missoes = contexto => opcoesDeMissao(estado, base, f1a4, stu, { a: 390, contexto: contextoInicial(contexto, f1a4) });
    assert.equal(missoes('dia').padrao, 'missao:PP:NAV-01');
    assert.equal(missoes('r:PR-JPL').padrao, 'missao:PP:PE-04');
    assert.deepEqual(opcoes(missoes('dia').grupos).filter(o => o.info.estado === 'liberada').map(o => o.info.missao.codigo), ['NAV-01', 'PE-04', 'NOT']);
    assert.equal(missoes('dia').nota, 'Próxima do PP: NAV-01 (Fase 5). Também liberadas: PE-04 (livre na Fase 5), NOT, com TSL-01 e TSL-02 (Fase 6).');
    // Nada aprovado, no C172: a IN-01 (do C152) no avião clicado, com o aviso do recurso do programa
    const { formulario, avaliacao } = agendar(doDia(), { amb: ambiente(), contexto: 'r:PR-VOY', escolhas: { aluno: 1001 } });
    assert.deepEqual([formulario.missao, formulario.recurso], ['missao:PP:IN-01', 'PR-VOY']);
    assert.deepEqual(codigos(avaliacao.avisos), ['recurso-do-programa']);
    assert.equal(avaliacao.avisos[0].texto, 'O programa faz IN-01 no C152; o voo vai no C172, e a missão continua IN-01.');
  });

  it('a preferência do contexto confere o curso pela sigla: o Noturno do PC (IFR) não é o padrão no avião Só VFR nem com o instrutor sem IFR', () => {
    const fase = { id: 'PC:F1', nome: 'Fase 1', ordem: 0, regra: 'ordem', requer: [], removida: false };
    const missao = (codigo, mis, ordem) => ({
      id: `PC:${codigo}`, codigo, nome: codigo, mis, eq: 'C172', nb: 1, fase: 'PC:F1', ordem, regra: 'livre', requer: [], dispensada: false, avaliacao: false, removida: false
    });
    const PC = { sigla: 'PC', nome: 'Piloto Comercial', ordem: 1, ativo: true, fases: [fase], missoes: [missao('NOT', 'Noturno', 0), missao('NAV', 'Navegação', 1)] };
    const semIfr = instrutor(1, 9).hab.filter(h => h !== 'ifr');
    const estado = cenario({ ins: [instrutor(1, 9, { hab: semIfr }), instrutor(2, 9)], stu: [aluno(1001, { fly: false }, { curso: 'PC' })] });
    const base = runAllocationEngine(estado);
    const doPC = ambiente({ programa: [PC] });
    const padrao = contexto => opcoesDeMissao(estado, base, doPC, estado.stu[0], { a: 390, contexto: contextoInicial(contexto, doPC) }).padrao;
    // O PR-CPL é Só VFR e o Instrutor 01 não tem IFR: a NAV; o PR-VOY e o Instrutor 02 servem ao Noturno do PC: a NOT
    assert.deepEqual(['r:PR-CPL', 'r:PR-VOY', 'i:1', 'i:2'].map(padrao), ['missao:PC:NAV', 'missao:PC:NOT', 'missao:PC:NAV', 'missao:PC:NOT']);
  });

  it('o recurso padrão é um em que algum instrutor voa: o PR-VOM (habilitação própria) sem ninguém habilitado não é o padrão', () => {
    const estado = doDia();
    delete estado.stu[1].curso;
    const multi = agendar(estado, { amb, escolhas: { aluno: 1001, missao: 'tipo:Multimotor' }, tocados: ['missao'] });
    assert.ok(['PT-JOB', 'PT-KIW'].includes(multi.formulario.recurso), multi.formulario.recurso);
    assert.deepEqual(codigos(multi.avaliacao.bloqueios), []);
    const nome = estado.ins.find(x => x.id === multi.formulario.instrutor).nm;
    assert.equal(multi.formulario.recursos.find(o => o.valor === 'PR-VOM').texto, `PR-VOM · PA-34 — exige a habilitação própria (${nome} não tem)`);
    // Com o Instrutor 02 habilitado nele, o PR-VOM (o primeiro do hangar) serve, com o Instrutor 02
    estado.ins[1].hab = [...estado.ins[1].hab, 'aviao:PR-VOM'];
    const habilitado = agendar(estado, { amb, escolhas: { aluno: 1001, missao: 'tipo:Multimotor' }, tocados: ['missao'] });
    assert.deepEqual([habilitado.formulario.recurso, habilitado.formulario.instrutor, codigos(habilitado.avaliacao.bloqueios)], ['PR-VOM', 2, []]);
  });

  it('o recurso padrão é do tipo do programa, mesmo ocupado agora por um voo que o app reorganiza: o livre de outro tipo pediria confirmação', () => {
    // Só o PR-VOB entre os C152, com o Aluno 1000 às 06:30 (o app escolheu: ele muda de horário)
    const estado = doDia();
    for (const r of apenas('C152', 'PR-VOB')) estado.av[r] = false;
    const { formulario, avaliacao, sim } = agendar(estado, { amb, escolhas: { aluno: 1001 } });
    assert.deepEqual([formulario.missao, formulario.recurso, formulario.horario], ['missao:PP:IN-02', 'PR-VOB', 390]);
    assert.equal(formulario.recursos[0].texto, 'PR-VOB · C152 — ocupado agora (o app reorganiza)');
    assert.deepEqual([codigos(avaliacao.bloqueios), codigos(avaliacao.avisos)], [[], []]);
    assert.deepEqual(sim.out.filter(o => o.stuId === 1000).map(o => [o.r, o.a]), [['PR-VOB', 500]]);
    // Com o C152 ocupado por um voo fixo, o padrão é o livre de outro tipo, com o aviso do recurso do programa
    estado.fixos = { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } };
    estado.fStatus = { '1000_0_1': 'Em Voo' };
    const outroTipo = agendar(estado, { amb, escolhas: { aluno: 1001, horario: 390 }, tocados: ['horario'] });
    assert.deepEqual([outroTipo.formulario.recursos.find(o => o.valor === outroTipo.formulario.recurso).tipo, codigos(outroTipo.avaliacao.avisos)], ['C172', ['recurso-do-programa']]);
  });

  it('o recurso clicado que não serve à missão pelos atributos (o Só Parafuso no voo local) dá lugar a um que serve, e o contexto diz', () => {
    const { formulario, avaliacao } = agendar(doDia(), { amb, contexto: 'r:PR-JPL', escolhas: { aluno: 1001 } });
    assert.equal(formulario.missao, 'missao:PP:IN-02');
    assert.notEqual(formulario.recurso, 'PR-JPL');
    assert.ok(formulario.contextoTexto.endsWith(`. O PR-JPL não serve ao Voo Local: o voo vai no ${formulario.recurso}.`), formulario.contextoTexto);
    assert.deepEqual(codigos(avaliacao.bloqueios), []);
    assert.equal(formulario.recursos.find(o => o.valor === 'PR-JPL').texto, 'PR-JPL · C152 — só Parafuso');
    // No Parafuso (a PE-04, fora da ordem), o PR-JPL clicado fica, e os outros C152 não servem (o Só Parafuso vale nos dois
    // sentidos); escolhido nele, o voo local troca de avião
    const parafuso = agendar(doDia(), { amb, contexto: 'r:PR-JPL', escolhas: { aluno: 1001, missao: 'missao:PP:PE-04' }, tocados: ['missao'] }).formulario;
    assert.equal(parafuso.recurso, 'PR-JPL');
    assert.equal(parafuso.recursos.find(o => o.valor === 'PR-VOB').texto, 'PR-VOB · C152 — não é Só Parafuso');
    const trocado = agendar(doDia(), { amb, escolhas: { aluno: 1001, recurso: 'PR-JPL', missao: 'missao:PP:IN-02' }, tocados: ['recurso', 'missao'] });
    assert.notEqual(trocado.formulario.recurso, 'PR-JPL');
    assert.deepEqual(codigos(trocado.avaliacao.bloqueios), []);
  });

  it('sem os programas dos cursos, a missão do aluno com curso não é sugerida: o operador escolhe, com a nota', () => {
    const semProgramas = ambiente({ programa: [], programaIndisponivel: true, inferir: false });
    const { formulario, avaliacao } = agendar(doDia(), { amb: semProgramas, escolhas: { aluno: 1001 } });
    assert.equal(formulario.missao, '');
    assert.equal(formulario.missoes.nota, 'Sem os programas dos cursos, as missões do PP não aparecem: escolha a missão.');
    assert.deepEqual(formulario.missoes.grupos.map(g => g.rotulo), ['Sem missão do curso']);
    assert.deepEqual(codigos(avaliacao.bloqueios), ['sem-missao']);
    // Escolhido o tipo, o voo vai sem a missão do curso; o aluno sem curso continua com o tipo padrão
    const escolhida = agendar(doDia(), { amb: semProgramas, escolhas: { aluno: 1001, missao: 'tipo:Voo Local' }, tocados: ['missao'] });
    assert.deepEqual([escolhida.formulario.proposta.missao, codigos(escolhida.avaliacao.bloqueios)], [null, []]);
    const semCurso = doDia();
    delete semCurso.stu[1].curso;
    assert.equal(agendar(semCurso, { amb: semProgramas, escolhas: { aluno: 1001 } }).formulario.missao, 'tipo:Voo Local');
  });

  it('as missões fora da ordem, com o motivo; a condicional, com a missão de que depende', () => {
    const estado = doDia({ s1000: { p1: 390, etapa: 'IN-01' } });
    const base = runAllocationEngine(estado);
    const stu = estado.stu[0];
    const textos = a => Object.fromEntries(opcoes(opcoesDeMissao(estado, base, ambiente(), stu, { a }).grupos).map(o => [o.valor, o.texto]));
    // O IN-01 voa às 06:30: às 06:30 o IN-02 espera por ele; às 08:20, depende do resultado
    assert.equal(textos(390)['missao:PP:IN-01'], 'IN-01 · Voo Local · C152 · 1 h (já no voo de amanhã às 06:30)');
    assert.equal(textos(390)['missao:PP:IN-02'], 'IN-02 · Voo Local · C152 · 1 h — IN-01 voa depois, às 06:30');
    assert.equal(textos(500)['missao:PP:IN-02'], 'IN-02 · Voo Local · C152 · 1 h — depende do resultado de IN-01 (amanhã 06:30)');
    assert.equal(textos(500)['missao:PP:CT-01'], 'CT-01 · Voo Local · C152 · 1 h — a Fase 2 abre depois da Fase 1: falta IN-02');
    assert.equal(textos(500)['missao:PP:ADAPT-C152'], 'ADAPT-C152 · Voo Local · C152 · 1 h (dispensada)');
    const reprovada = ambiente({ registros: [...aprovadas(1001, ['IN-01']), { id: 9, aluno: 1001, curso: 'PP', missao: 'IN-02', resultado: 'reprovado', data: '2026-11-04' }] });
    const doAluno = opcoes(opcoesDeMissao(estado, base, reprovada, estado.stu[1], { a: 390 }).grupos);
    assert.equal(doAluno.find(o => o.valor === 'missao:PP:CT-01').texto, 'CT-01 · Voo Local · C152 · 1 h — a Fase 2 abre depois da Fase 1: falta IN-02');
    assert.equal(doAluno.find(o => o.valor === 'missao:PP:IN-01').texto, 'IN-01 · Voo Local · C152 · 1 h (já aprovada)');
    const semFase = { ...PP, fases: [{ ...PP.fases[0], id: 'F' }], missoes: PP.missoes.slice(0, 3).map((m, i) => ({ ...m, fase: 'F', ordem: i })) };
    const plano = opcoes(opcoesDeMissao(estado, base, { ...reprovada, programa: [semFase] }, estado.stu[1], { a: 390 }).grupos);
    assert.equal(plano.find(o => o.valor === 'missao:PP:CT-01').texto, 'CT-01 · Voo Local · C152 · 1 h — falta IN-02 (reprovada em 04/11)');
  });

  it('sem os resultados, as missões do curso sem a ordem conferida e sem padrão; sem curso, o tipo de missão', () => {
    const semResultados = ambiente({ inferir: false });
    const { formulario, avaliacao } = agendar(doDia(), { amb: semResultados, escolhas: { aluno: 1001 } });
    assert.equal(formulario.missao, '');
    assert.deepEqual(codigos(avaliacao.bloqueios), ['sem-missao']);
    assert.deepEqual(formulario.missoes.grupos.map(g => g.rotulo), ['Missões do PP (a ordem não foi conferida)', 'Sem missão do curso']);
    const escolhida = agendar(doDia(), { amb: semResultados, escolhas: { aluno: 1001, missao: 'missao:PP:CT-02' }, tocados: ['missao'] });
    assert.deepEqual(codigos(escolhida.avaliacao.avisos), ['ordem-nao-conferida']);
    const estado = doDia();
    delete estado.stu[1].curso;
    const semCurso = agendar(estado, { amb, escolhas: { aluno: 1001 } }).formulario;
    assert.equal(semCurso.missao, 'tipo:Voo Local');
    assert.deepEqual(semCurso.missoes.grupos.map(g => g.rotulo), ['Sem missão do curso']);
    // "Outro tipo de missão…": o tipo escolhido no campo a mais, e o recurso que serve a ele
    const outro = agendar(estado, { amb, escolhas: { aluno: 1001, missao: 'tipo:', tipo: 'Simulador', recurso: 'PR-VOB' }, tocados: ['missao'] }).formulario;
    assert.deepEqual([outro.tipos.length > 10, outro.tipo, outro.recurso.startsWith('SIM-'), outro.horas.valor], [true, 'Simulador', true, '2']);
  });

  it('o Ground: a sala, a duração fixa e os horários das janelas; o Noturno, às 17:30, com a volta no dia seguinte', () => {
    const estado = doDia();
    delete estado.stu[1].curso;
    const ground = agendar(estado, { amb, escolhas: { aluno: 1001, missao: 'tipo:Ground C152' }, tocados: ['missao'] });
    assert.deepEqual([ground.formulario.recurso, ground.formulario.horas, ground.formulario.peso.visivel], ['SALA-GROUND', { valor: '1.5', fixa: true }, false]);
    assert.deepEqual(ground.formulario.horarios, { opcoes: T.slice(0, 8).map(m => ({ valor: m, texto: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` })), outro: false });
    assert.equal(ground.formulario.proposta.b - ground.formulario.proposta.a, 90);
    const linha = ground.sim.out.find(o => o.fKey === ground.fKey);
    assert.ok(normalizarLinhaGravada(linha), 'a turma nova é aceita pela escala gravada');
    const noturno = agendar(estado, { amb, contexto: { r: 'PR-VOY', minuto: 600 }, escolhas: { aluno: 1001, missao: 'tipo:Noturno' }, tocados: ['missao'] });
    assert.deepEqual([noturno.formulario.horario, noturno.formulario.horas], [1050, { valor: '4', fixa: true }]);
    assert.deepEqual(codigos(noturno.avaliacao.notas), ['horario-da-missao', 'rodizio', 'noturno', 'repouso-do-noturno']);
    assert.deepEqual(noturno.avaliacao.notas.map(n => n.texto), [
      'O Noturno sai às 17:30.', 'Na fila do rodízio (Voo noturno), a vez é de Instrutor 01.',
      'O Noturno volta em 12/11 às 07:30; o instrutor, o aluno e o avião ficam livres às 10:10.',
      `Limite da lei: ${noturno.formulario.selecao.x.nm} fica com 9h00 de repouso entre o noturno (até 21:30) e o translado de volta (07:30), menos que as 12h00 da lei; a escala de 12/11 avisa.`
    ]);
    // Com a janela das 17:30 fechada, o Noturno fica sem horário: o bloqueio diz por quê, e o contexto não fica pela metade
    const fechada = { ...estado, win: estado.win.map((v, w) => w !== 8) };
    const semHorario = agendar(fechada, { amb, escolhas: { aluno: 1001, missao: 'tipo:Noturno' }, tocados: ['missao'] }).formulario;
    assert.deepEqual(codigos(semHorario.formato), ['horario-invalido']);
    assert.equal(semHorario.contextoTexto, 'Quarta-feira, 11/11 · nenhum horário de decolagem aberto');
  });

  // A lei pede 12 h de repouso, e a volta do Noturno decola de BH às 07:30: a escala do dia da volta avisa
  // (repouso-do-noturno), e o agendamento do Noturno já diz o repouso que fica, numa nota (sem confirmação)
  it('o Noturno: a nota diz o repouso do instrutor até a volta, o mesmo que a escala do dia da volta avisa', () => {
    const estado = doDia();
    delete estado.stu[1].curso;
    const noturno = (mudar = {}, escolhas = {}) => agendar({ ...estado, ...mudar }, {
      amb, contexto: { r: 'PR-VOY', minuto: 600 }, escolhas: { aluno: 1001, missao: 'tipo:Noturno', ...escolhas }, tocados: ['missao', ...Object.keys(escolhas)]
    });
    const repouso = r => (r.avaliacao.notas.find(n => n.codigo === 'repouso-do-noturno') || {}).texto || null;
    const { formulario, avaliacao, sim } = noturno();
    const x = formulario.selecao.x;
    assert.deepEqual(codigos(avaliacao.avisos), []);
    assert.equal(repouso({ avaliacao }), `Limite da lei: ${x.nm} fica com 9h00 de repouso entre o noturno (até 21:30) e o translado de volta (07:30), menos que as 12h00 da lei; a escala de 12/11 avisa.`);
    // A escala do dia seguinte, com a escala do agendamento gravada como a véspera, avisa o mesmo repouso
    const noturnos = noturnosDaVespera({ data: DATA, conteudo: { ...estado, resultado: sim } }, '2026-11-12');
    const seguinte = { ...cenario({ ins: estado.ins, stu: [aluno(1002, { fly: false })] }), noturnosDaVespera: noturnos, horasDosInstrutores: comRepousoDoNoturno({}, noturnos) };
    const aviso = runAllocationEngine(seguinte).al.find(a => a.codigo === 'repouso-do-noturno');
    assert.deepEqual([aviso.insId, aviso.m], [x.id, 'Limite da lei: 9h00 de repouso entre o noturno de ontem (até 21:30) e o translado de volta (07:30), menos que as 12h00 da lei.']);
    // Na data de hoje, a escala de amanhã avisa; o noturno que sai mais tarde (outro horário) deixa menos repouso
    assert.match(repouso(agendar(estado, { amb: { ...amb, hoje: DATA, agora: 0 }, contexto: { r: 'PR-VOY', minuto: 600 }, escolhas: { aluno: 1001, missao: 'tipo:Noturno' }, tocados: ['missao'] })), /; a escala de amanhã avisa\.$/);
    assert.match(repouso(noturno({}, { horario: 'outro', outroHorario: '18:00' })), /fica com 8h30 de repouso entre o noturno \(até 22:00\)/);
    // Com o repouso mínimo menor que o que fica, ou sem ele (o Administrador muda os limites), nada
    assert.equal(repouso(noturno({ limites: { repousoMin: 480 } })), null);
    assert.equal(repouso(noturno({ limites: { repousoMin: null } })), null);
    assert.match(repouso(noturno({ limites: { repousoMin: 600 } })), /fica com 9h00 de repouso .*, menos que as 10h00 da lei;/);
  });

  it('o Noturno em trechos vai pela noite, com os translados no nome: nenhum translado sozinho, e o voo leva a etapa da noite', () => {
    // O PP com o Noturno em trechos (o do cronograma): o TSL-01 (a ida), a NOT (a noite) e o TSL-02 (a volta) num voo só
    const comTrechos = (mudar = {}) => {
      const curso = cursoPP();
      curso.missoes = curso.missoes.map(m => ({ ...m, ...mudar[m.codigo] }));
      return curso;
    };
    const NT = comTrechos();
    const ate = fases => aprovadas(1001, NT.missoes.filter(m => fases.includes(m.fase)).map(m => m.codigo));
    const ATE_A_4 = ['PP:F1', 'PP:F2', 'PP:F3', 'PP:F4'], ATE_A_8 = [...ATE_A_4, 'PP:F5', 'PP:F7', 'PP:F8'];
    const estado = doDia();
    const base = runAllocationEngine(estado);
    const daFase6 = (amb, stu = estado.stu[1]) => {
      const { grupos, nota } = opcoesDeMissao(estado, base, amb, stu, { a: 390, contexto: contextoInicial('dia', amb) });
      return { textos: opcoes(grupos).filter(o => o.info.tipo === 'missao' && o.info.missao.fase === 'PP:F6').map(o => o.texto), nota };
    };
    // Depois da Fase 4: a noite, liberada, com os translados no nome (também na nota); sem os resultados, também só ela
    const f1a4 = ambiente({ programa: [NT], registros: ate(ATE_A_4) });
    assert.deepEqual(daFase6(f1a4), {
      textos: ['NOT (com TSL-01 e TSL-02) · Noturno · C172 · 4 h'],
      nota: 'Próxima do PP: NAV-01 (Fase 5). Também liberadas: PE-04 (livre na Fase 5), NOT, com TSL-01 e TSL-02 (Fase 6).'
    });
    assert.deepEqual(daFase6({ ...f1a4, inferir: false }).textos, ['NOT (com TSL-01 e TSL-02) · Noturno · C172 · 4 h']);
    // A noite aprovada: só ela, fora da ordem; o translado dispensado não vai, nem no nome
    assert.deepEqual(daFase6(ambiente({ programa: [NT], registros: [...ate(ATE_A_4), ...aprovadas(1001, ['NOT'])] })).textos,
      ['NOT (com TSL-01 e TSL-02) · Noturno · C172 · 4 h (já aprovada)']);
    assert.deepEqual(daFase6(ambiente({ programa: [comTrechos({ 'TSL-02': { dispensada: true } })], registros: ate(ATE_A_4) })).textos,
      ['NOT (com TSL-01) · Noturno · C172 · 4 h']);
    // Até a Fase 8: a próxima é o Noturno, no aluno e no formulário, e o pedido do voo leva a etapa da noite
    const f1a8 = ambiente({ programa: [NT], registros: ate(ATE_A_8) });
    const doAluno = opcoesDeAluno(estado, base, f1a8, contextoInicial('dia', f1a8)).flatMap(g => g.opcoes).find(o => o.valor === 1001);
    assert.equal(doAluno.texto, 'Aluno 1001 — PP · próxima NOT (com TSL-01 e TSL-02)');
    const { formulario } = agendar(estado, { amb: f1a8, escolhas: { aluno: 1001 } });
    assert.deepEqual([formulario.missao, formulario.alunoInfo], ['missao:PP:NOT', 'PP · Fase 6 · 42/46 · próxima NOT (com TSL-01 e TSL-02)']);
    assert.deepEqual([formulario.proposta.mis, formulario.proposta.missao], ['Noturno', { sigla: 'PP', codigo: 'NOT' }]);
    const depois = structuredClone(estado);
    const { criadoComo } = aplicarAgendamento(depois, base, formulario.proposta);
    assert.deepEqual([criadoComo.mis, criadoComo.etapa, criadoComo.cursoDaEtapa], ['Noturno', 'NOT', 'PP']);
  });

  it('a turma de Ground com atrasos diferentes ocupa a sala pelo primeiro aluno que o motor confere (a prioridade antes do cadastro)', () => {
    // Escala aprovada: a turma das 08:20 (Aluno 1000, prioridade 3, atrasado para as 10:10; Aluno 1001, prioridade 5)
    const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [
      aluno(1000, { ...GROUND_C152, p1: 500, p2: -1, pr: 3 }), aluno(1001, { ...GROUND_C152, p1: 500, p2: -1, pr: 5 }), aluno(1002, { fly: false })
    ] });
    const turma = runAllocationEngine(estado).out;
    estado.fixos = Object.fromEntries(turma.map(o => [o.fKey, { a: o.a, b: o.b, r: o.r, insId: o.insId, classKey: o.classKey }]));
    estado.aprovacao = { em: '2026-11-10T20:00:00.000Z', por: '' };
    estado.fStatus = { '1000_0_1': 'Atrasado' };
    estado.fObs = { '1000_0_1': { novoInicio: 610 } };
    const base = runAllocationEngine(estado);
    assert.deepEqual(naOrdemDoMotor(estado, base.out).map(o => o.stuId), [1001, 1000], 'o motor confere primeiro a prioridade 5');
    const opcoesNaOrdem = { fStatus: estado.fStatus, fObs: estado.fObs, efetivo: true, soFixos: true };
    assert.deepEqual(ocupacaoDaEscala(naOrdemDoMotor(estado, base.out), opcoesNaOrdem).recursos.get('SALA-GROUND').map(o => [o.a, o.b]), [[500, 590]]);
    assert.deepEqual(ocupacaoDaEscala(base.out, opcoesNaOrdem).recursos.get('SALA-GROUND').map(o => [o.a, o.b]), [[610, 700]], 'na ordem da escala, o atrasado viria primeiro');
    // A sala está livre às 10:10 para uma turma nova, como na simulação
    const sala = opcoesDeRecurso(estado, base, { mis: 'Ground C152', a: 610, b: 700 });
    assert.deepEqual(sala.map(o => [o.valor, o.desligada]), [['SALA-GROUND', false]]);
    const novo = agendar(estado, { escolhas: { aluno: 1002, missao: 'tipo:Ground C152', horario: 610 }, tocados: ['missao', 'horario'] });
    assert.deepEqual(codigos(novo.avaliacao.bloqueios), []);
    assert.equal(opcoesDeRecurso(estado, base, { mis: 'Ground C152', a: 500, b: 590 })[0].texto, 'Sala Ground — turma fixa 08:20–09:50 (Ground C152)');
  });
});

describe('Agendamento: o pedido e o voo fixo', () => {
  const proposta = (campos = {}) => ({
    stuId: 1001, mis: 'Voo Local', eq: 'C152', nb: 1, a: 610, b: 670, r: 'PR-VOB', insId: 2, missao: { sigla: 'PP', codigo: 'IN-02' },
    pesos: { aluno: 70, instrutor: 70 }, disponibilizar: null, ...campos
  });

  it('o pedido principal que não voa, com a chave limpa, recebe o voo; a reversão devolve o de antes', () => {
    const estado = doDia({ s1001: { jan: 'manha', etapa: 'IN-01', insId: 1, solicitacao: 7, p1: 500, p2: 610 } });
    const antes = aplicarAgendamento(estado, null, proposta());
    const stu = estado.stu[1];
    assert.deepEqual([antes.mid, antes.criado], [0, true]);
    assert.deepEqual(antes.pedido, { fly: false, mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, pr: 3, jan: 'manha', etapa: 'IN-01', solicitacao: 7, insId: 1 });
    assert.deepEqual([stu.fly, stu.mis, stu.p1, stu.p2, stu.etapa, stu.cursoDaEtapa, stu.insId, stu.jan, stu.solicitacao], [true, 'Voo Local', 610, -1, 'IN-02', 'PP', 2, undefined, undefined]);
    assert.deepEqual(estado.fixos['1001_0_1'], { a: 610, b: 670, r: 'PR-VOB', insId: 2, agendado: true });
    const rev = validarReversao(reversaoDoAgendamento(antes));
    assert.equal(rev.label, '↶ Desfazer');
    assert.deepEqual(rev.criadoComo.etapa, 'IN-02');
    assert.equal(motivoParaNaoDesfazer(estado, rev), '');
    assert.ok(desfazerAgendamento(estado, rev));
    assert.deepEqual([stu.fly, stu.jan, stu.etapa, stu.insId, stu.solicitacao, stu.cursoDaEtapa], [false, 'manha', 'IN-01', 1, 7, undefined]);
    assert.ok(!Object.hasOwn(estado.fixos, '1001_0_1'));
  });

  it('com o pedido principal voando, ou com sobras do dia na chave dele (inclusive um resultado), uma missão extra nova', () => {
    const voando = doDia();
    const extra = aplicarAgendamento(voando, null, proposta({ stuId: 1000 }));
    assert.deepEqual([extra.mid, extra.pedido, voando.stu[0].extra.map(ex => ex.mid)], [1, null, [1]]);
    assert.deepEqual(voando.fixos['1000_1_1'], { a: 610, b: 670, r: 'PR-VOB', insId: 2, agendado: true });
    const sobras = doDia({ extra: { fStatus: { '1001_0_1': 'Cancelado' }, resultados: { situacao: [], doDia: [{ voo: '1001_1_1' }] } } });
    const antes = aplicarAgendamento(sobras, null, proposta());
    assert.deepEqual([antes.mid, antes.pedido, sobras.stu[1].fly], [2, null, false]);
    assert.equal(sobras.stu[1].extra[0].pr, 3);
    // Desfazer tira a missão extra e limpa a chave dela
    sobras.fStatus['1001_2_1'] = 'Confirmado';
    assert.ok(desfazerAgendamento(sobras, validarReversao(reversaoDoAgendamento(antes))));
    assert.deepEqual([sobras.stu[1].extra, Object.hasOwn(sobras.fixos, '1001_2_1'), Object.hasOwn(sobras.fStatus, '1001_2_1')], [[], false, false]);
  });

  it('desfazer não tira outra missão extra que ficou com o mesmo número depois de a do agendamento sair', () => {
    const estado = doDia();
    const antes = aplicarAgendamento(estado, null, proposta({ stuId: 1000 }));
    const rev = validarReversao(reversaoDoAgendamento(antes));
    // Tirar da escala e pôr de volta não muda o pedido
    estado.stu[0].extra[0].fly = false;
    assert.equal(motivoParaNaoDesfazer(estado, rev), '');
    // A missão extra saiu na Demanda (o pino com ela) e outra foi criada no mesmo número
    estado.stu[0].extra = [missaoExtra(1, { p1: 760, p2: 870 })];
    delete estado.fixos['1000_1_1'];
    assert.equal(motivoParaNaoDesfazer(estado, rev), 'O pedido mudou depois do agendamento: desfazer agora mexeria em outro voo. Mude o pedido na Demanda.');
    // Sem a missão (tirada e não criada de novo), desfazer só limpa a chave
    estado.stu[0].extra = [];
    assert.equal(motivoParaNaoDesfazer(estado, rev), '');
    // A reversão de antes do guarda (sem criadoComo) continua valendo; o voo que mudou de lugar (sem criado) também tem
    // o guarda; o criadoComo fora do formato não vale
    const { criadoComo, ...semGuarda } = reversaoDoAgendamento(antes);
    assert.ok(validarReversao(semGuarda) && !validarReversao(semGuarda).criadoComo && criadoComo);
    assert.deepEqual(validarReversao({ ...reversaoDoAgendamento(antes), criado: false, pedido: antes.criadoComo }).criadoComo, antes.criadoComo);
    assert.equal(validarReversao({ ...reversaoDoAgendamento(antes), criadoComo: { mis: ['Voo Local'], fly: true } }), null);
  });

  it('os pesos digitados vão para o cadastro, um texto do histórico cada; "Marcar disponível" liga o instrutor nos períodos do voo', () => {
    const estado = doDia();
    estado.ins[1].on = false;
    estado.ins[1].aw = estado.ins[1].aw.map(() => false);
    const antes = aplicarAgendamento(estado, null, proposta({ pesos: { aluno: 82.5, instrutor: 70 }, disponibilizar: { insId: 2 } }));
    assert.deepEqual(antes.pesos, [{ tipo: 'aluno', id: 1001, nm: 'Aluno 1001', kg: 82.5 }]);
    assert.deepEqual(historicoDosPesos(antes), ['Peso Aluno 1001: 82,5 kg (agendamento)']);
    assert.equal(estado.stu[1].kg, 82.5);
    assert.deepEqual([estado.ins[1].on, estado.ins[1].aw.map((v, w) => (v ? w : -1)).filter(w => w >= 0)], [true, [2]]);
    assert.deepEqual(antes.disponibilidade, { insId: 2, on: false, aw: Array(9).fill(false) });
    // Desfazer devolve a disponibilidade; o peso é da pessoa e fica
    assert.ok(desfazerAgendamento(estado, validarReversao(reversaoDoAgendamento(antes))));
    assert.deepEqual([estado.ins[1].on, estado.ins[1].aw.some(Boolean), estado.stu[1].kg], [false, false, 82.5]);
  });

  it('a prévia é a escala que fica: aplicar no estado e refazer a escala dá a escala simulada', () => {
    const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 9), instrutor(3, 5)], stu: [
      aluno(1000, { p1: 390, p2: 500 }, { curso: 'PP' }), aluno(1001, { fly: false }, { curso: 'PP' }), aluno(1002, { ...GROUND_C152, p1: 500, p2: -1 }),
      aluno(1003, { mis: 'Navegação', nb: 2, p1: 610, p2: -1 }), aluno(1004, { p1: 390, p2: -1 }, { voaCom: [2] })
    ] });
    const { formulario, sim } = agendar(estado, { escolhas: { aluno: 1001, horario: 390, instrutor: 2 }, tocados: ['horario', 'instrutor'] });
    const real = structuredClone(estado);
    aplicarAgendamento(real, null, formulario.proposta);
    assert.deepEqual(runAllocationEngine(real), sim);
  });
});

describe('Agendamento: a conferência', () => {
  const amb = ambiente({ registros: aprovadas(1001, ['IN-01']) });
  const conferir = (estado, opcoesDoAgendamento = {}) => agendar(estado, { amb, ...opcoesDoAgendamento }).avaliacao;

  it('os bloqueios do formato: a missão, o horário, a duração, o peso e a meia-noite, cada um com o campo', () => {
    const estado = doDia();
    const de = (escolhas, tocados) => conferir(estado, { escolhas: { aluno: 1001, ...escolhas }, tocados }).bloqueios.map(b => [b.codigo, b.campo]);
    assert.deepEqual(de({ horario: 'outro', outroHorario: '' }, []), [['horario-invalido', 'agd-outro-horario']]);
    assert.deepEqual(de({ horas: '7' }, ['horas']), [['duracao', 'agd-horas']]);
    assert.deepEqual(de({ horario: 'outro', outroHorario: '23:30' }, []), [['depois-da-meia-noite', 'agd-outro-horario']]);
    assert.deepEqual(de({ kgAluno: '400' }, ['kgAluno']), [['peso-invalido', 'agd-kg-aluno']]);
    assert.deepEqual(de({ kgInstrutor: { 2: '0,0' } }, []), [['peso-invalido', 'agd-kg-instrutor']]);
    // Sem instrutor no cadastro, ou sem recurso do tipo na frota
    const semInstrutor = conferir(doDia({ ins: [] }), { escolhas: { aluno: 1001 } }).bloqueios.map(b => [b.codigo, b.campo]);
    assert.deepEqual(semInstrutor, [['sem-instrutor', 'agd-instrutor']]);
    const semSimulador = { ...doDia(), frota: [{ reg: 'PR-VOB', tipo: 'C152' }] };
    delete semSimulador.stu[1].curso;
    const semRecurso = conferir(semSimulador, { escolhas: { aluno: 1001, missao: 'tipo:', tipo: 'Simulador', recurso: 'PR-VOB' }, tocados: ['missao'] }).bloqueios;
    assert.deepEqual(semRecurso.map(b => [b.codigo, b.texto]), [['sem-recurso', 'Nenhum recurso para Simulador na frota.']]);
  });

  it('o instrutor indisponível bloqueia, com "Marcar disponível": marcado, o voo passa, com a nota, e o histórico diz', () => {
    const estado = doDia();
    estado.ins[1].on = false;
    const { avaliacao } = agendar(estado, { amb, escolhas: { aluno: 1001, instrutor: 2 }, tocados: ['instrutor'] });
    assert.deepEqual(avaliacao.bloqueios, [{ codigo: 'instrutor-indisponivel', texto: 'O instrutor não está disponível.', campo: 'agd-instrutor', opcoes: [{ opcao: 'disponibilizar', texto: 'Marcar Instrutor 02 disponível às 06:30' }] }]);
    const marcado = agendar(estado, { amb, escolhas: { aluno: 1001, instrutor: 2, disponibilizar: 2 }, tocados: ['instrutor'] });
    assert.deepEqual(codigos(marcado.avaliacao.bloqueios), []);
    assert.ok(codigos(marcado.avaliacao.notas).includes('disponibilizar'));
    assert.equal(descricaoDoAgendamento(estado, marcado.formulario.proposta, marcado.avaliacao),
      `Agendado na escala: Aluno 1001 · IN-02 (Voo Local) · 06:30–07:30 · ${marcado.formulario.recurso} · Instrutor 02 · Instrutor 02 marcado disponível às 06:30`);
  });

  it('o avião, o aluno e o instrutor ocupados por um voo fixo, o horário fechado e o peso acima do limite bloqueiam', () => {
    // O Aluno 1000 está em voo no PR-VOB às 06:30 com o Instrutor 01
    const emVoo = doDia({ extra: { fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } }, fStatus: { '1000_0_1': 'Em Voo' } } });
    const aviao = conferir(emVoo, { escolhas: { aluno: 1001, recurso: 'PR-VOB', horario: 390 }, tocados: ['recurso', 'horario'] });
    assert.deepEqual(aviao.bloqueios.map(semAlternativas), [{ codigo: 'aviao-ocupado', texto: 'O avião já está ocupado neste horário.', campo: 'agd-recurso' }]);
    const instrutor = conferir(emVoo, { escolhas: { aluno: 1001, instrutor: 1, horario: 390 }, tocados: ['instrutor', 'horario'] });
    assert.deepEqual(codigos(instrutor.bloqueios), ['instrutor-ocupado']);
    // O próprio aluno: uma missão extra às 06:30
    const aluno1000 = conferir(emVoo, { escolhas: { aluno: 1000, horario: 390 }, tocados: ['horario'] });
    assert.deepEqual(codigos(aluno1000.bloqueios), ['aluno-ocupado']);
    const fechada = doDia({ extra: { win: Array(9).fill(true).map((v, w) => w !== 2) } });
    assert.deepEqual(codigos(conferir(fechada, { escolhas: { aluno: 1001, horario: 'outro', outroHorario: '10:25' } }).bloqueios), ['horario-fechado']);
    const pesado = conferir(doDia(), { escolhas: { aluno: 1001, kgAluno: '150', kgInstrutor: { 2: '110' } }, tocados: ['kgAluno'] });
    assert.deepEqual(codigos(pesado.bloqueios), ['peso']);
  });

  it('o voo de outro aluno que fica em conflito por causa do agendamento bloqueia', () => {
    // O Aluno 1001 já está agendado no PR-VOB às 06:30; o Aluno 1000 agendado no mesmo avião e horário passa na frente
    // (o pedido com o instrutor escolhido) e deixa o outro em conflito
    const estado = doDia({ s1001: { fly: true, p1: 390, p2: -1 }, extra: { fixos: { '1001_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 2, agendado: true } } } });
    estado.stu[0].fly = false;
    const { avaliacao } = agendar(estado, { amb, escolhas: { aluno: 1000, recurso: 'PR-VOB', horario: 390, instrutor: 1 }, tocados: ['recurso', 'horario', 'instrutor'] });
    assert.deepEqual(avaliacao.bloqueios.map(semAlternativas), [{ codigo: 'conflito-em-outro-voo', texto: 'Agendar aqui deixa o voo de Aluno 1001 em conflito: o avião já está ocupado neste horário.', campo: 'agd-horario' }]);
  });

  it('as regras do curso pedem confirmação: fora da ordem, já aprovada, dispensada, repetida no dia, de outro curso, curso encerrado', () => {
    const estado = doDia({ s1000: { etapa: 'IN-01' } });
    const aviso = (stuId, missao, outro = {}) => conferir(estado, { amb: { ...amb, ...outro }, escolhas: { aluno: stuId, missao }, tocados: ['missao'] }).avisos;
    assert.deepEqual(aviso(1001, 'missao:PP:CT-01'), [{ codigo: 'fora-da-ordem', texto: 'CT-01 fora da ordem: a Fase 2 abre depois da Fase 1: falta IN-02.', resumo: 'fora da ordem (a Fase 2 abre depois da Fase 1: falta IN-02)', campo: 'agd-missao' }]);
    assert.deepEqual(codigos(aviso(1001, 'missao:PP:IN-01')), ['ja-aprovada']);
    assert.deepEqual(codigos(aviso(1001, 'missao:PP:ADAPT-C152')), ['dispensada']);
    assert.deepEqual(aviso(1000, 'missao:PP:IN-01').map(a => [a.codigo, a.texto]), [['repetida-no-dia', 'IN-01 já está no voo de amanhã às 06:30: o aluno voa a missão duas vezes no dia.']]);
    const encerrado = aviso(1001, 'missao:PP:IN-02', { programa: [{ ...PP, ativo: false }] });
    assert.deepEqual(codigos(encerrado), ['curso-encerrado']);
    // A missão de outro curso (o aluno trocou de curso)
    const { formulario, sim, fKey } = agendar(estado, { amb, escolhas: { aluno: 1001 } });
    const deOutro = { ...formulario, selecao: { ...formulario.selecao, info: { ...formulario.selecao.info, sigla: 'PC' } } };
    const base = runAllocationEngine(estado);
    assert.deepEqual(codigos(avaliarAgendamento({ estado, base, baseComPesos: base, sim, fKey, formulario: deOutro, ambiente: amb }).avisos), ['outro-curso']);
  });

  it('as regras que o motor não confere nos agendados viram avisos: fora dos horários, depois das 17:30, o 7º local, antes do Ground, sem peso', () => {
    const avisos = (estado, escolhas, tocados = []) => conferir(estado, { escolhas: { aluno: 1001, ...escolhas }, tocados }).avisos.map(a => [a.codigo, a.texto]);
    assert.deepEqual(avisos(doDia(), { horario: 'outro', outroHorario: '10:25' }), [['fora-dos-horarios', 'Agendado às 10:25, fora dos horários de decolagem do C152.']]);
    assert.deepEqual(avisos(doDia(), { horario: 'outro', outroHorario: '16:50' }).map(([c]) => c), ['fora-dos-horarios', 'depois-das-17h30']);
    // Seis voos locais fixos às 08:20 (escala aprovada): o agendado é o 7º
    const seis = cenario({ ins: [1, 2, 3, 4, 5, 6, 7].map(id => instrutor(id, 9)), stu: [1000, 1002, 1003, 1004, 1005, 1006].map(id => aluno(id, { p1: 500, p2: -1 })) });
    seis.stu.push(aluno(1001, { fly: false }, { curso: 'PP' }));
    const regs = ['PP-LJV', 'PR-BTB', 'PR-IGU', 'PR-MLB', 'PR-TBT', 'PR-THI'];
    seis.fixos = Object.fromEntries([1000, 1002, 1003, 1004, 1005, 1006].map((id, i) => [`${id}_0_1`, { a: 500, b: 560, r: regs[i], insId: i + 1 }]));
    seis.aprovacao = { em: '2026-11-10T20:00:00.000Z', por: '' };
    assert.deepEqual(avisos(seis, { horario: 500 }, ['horario']), [['limite-de-locais', 'Agendado às 08:20 como o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.']]);
    // O Ground fixo do aluno às 08:20 e o voo agendado às 06:30, antes do fim dele
    const comGround = doDia({ s1001: { ...GROUND_C152, fly: true, p1: 500, p2: -1 } });
    comGround.stu[1].extra = [];
    const turma = runAllocationEngine(comGround).out.find(o => o.stuId === 1001);
    comGround.fixos = { '1001_0_1': { a: turma.a, b: turma.b, r: turma.r, insId: turma.insId, classKey: turma.classKey } };
    comGround.fStatus = { '1001_0_1': 'Confirmado' };
    comGround.aprovacao = { em: '2026-11-10T20:00:00.000Z', por: '' };
    assert.deepEqual(avisos(comGround, { horario: 390 }, ['horario']), [['antes-do-ground', 'Agendado às 06:30, antes do fim do Ground C152 do aluno (09:50): o Ground vem antes do voo.']]);
    const semPeso = conferir(doDia(), { escolhas: { aluno: 1001, kgAluno: '' }, tocados: ['kgAluno'] }).avisos;
    assert.deepEqual(semPeso.map(a => [a.codigo, a.campo, a.resumo]), [['sem-peso', 'agd-kg-aluno', 'sem peso']]);
  });

  it('o 7º voo local do horário pede confirmação também quando o aluno novo vem antes no cadastro (o motor avisa outro agendado)', () => {
    // Seis voos locais agendados às 08:20; o Aluno 1001 é o primeiro do cadastro: o motor confere o agendado dele antes dos
    // outros, e o aviso do motor fica no último deles
    const outros = [1000, 1002, 1003, 1004, 1005, 1006];
    const regs = ['PP-LJV', 'PR-BTB', 'PR-IGU', 'PR-MLB', 'PR-TBT', 'PR-THI'];
    const estado = cenario({ ins: [1, 2, 3, 4, 5, 6, 7].map(id => instrutor(id, 9)), stu: [aluno(1001, { fly: false }, { curso: 'PP' }), ...outros.map(id => aluno(id, { p1: 500, p2: -1 }))] });
    estado.fixos = Object.fromEntries(outros.map((id, i) => [`${id}_0_1`, { a: 500, b: 560, r: regs[i], insId: i + 1, agendado: true }]));
    const { formulario, sim, fKey, avaliacao } = agendar(estado, { amb, escolhas: { aluno: 1001, horario: 500 }, tocados: ['horario'] });
    assert.deepEqual([formulario.proposta.mis, formulario.proposta.a], ['Voo Local', 500]);
    assert.deepEqual(sim.al.filter(al => al.codigo === 'limite-de-locais').map(al => al.fKey), ['1006_0_1']);
    assert.ok(!sim.al.some(al => al.fKey === fKey && al.codigo === 'limite-de-locais'));
    assert.deepEqual(avaliacao.avisos.map(a => [a.codigo, a.texto, a.campo, a.resumo]), [[
      'limite-de-locais', 'Agendado às 08:20 como o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.', 'agd-horario',
      'acima do limite de voos locais no horário'
    ]]);
    // Às 10:10, com os seis às 08:20, nenhum aviso; o Ground às 08:20 não é voo local
    assert.deepEqual(codigos(agendar(estado, { amb, escolhas: { aluno: 1001, horario: 610 }, tocados: ['horario'] }).avaliacao.avisos), []);
    const ground = agendar(estado, { amb, escolhas: { aluno: 1001, missao: 'tipo:Ground C152', horario: 500 }, tocados: ['missao', 'horario'] });
    assert.ok(!codigos(ground.avaliacao.avisos).includes('limite-de-locais'));
  });

  it('o voo que sai da escala e o conflito que só o peso digitado cria pedem confirmação', () => {
    // Um instrutor só: o Aluno 1000 só pode às 06:30 e sai da escala quando o 1001 fica com o instrutor às 06:30
    const estado = doDia({ ins: [instrutor(1, 9)], s1000: { jan: 'h390' } });
    const saem = conferir(estado, { escolhas: { aluno: 1001, horario: 390 }, tocados: ['horario'] }).avisos;
    assert.deepEqual(saem.map(a => [a.codigo, a.resumo]), [['saem', 'tira 1 voo da escala']]);
    assert.match(saem[0].texto, /^Agendar aqui tira da escala: Aluno 1000 \(.+\)\.$/);
    // O Instrutor 02 voa com o Aluno 1000 (100 kg) às 08:20 na escala aprovada; com 120 kg digitados, aquele voo passa do limite
    const aprovado = doDia({ s1000: { p1: 500, insId: 2 } });
    aprovado.stu[0].kg = 100;
    const voo = runAllocationEngine(aprovado).out.find(o => o.stuId === 1000);
    aprovado.fixos = { [voo.fKey]: { a: voo.a, b: voo.b, r: voo.r, insId: voo.insId } };
    aprovado.aprovacao = { em: '2026-11-10T20:00:00.000Z', por: '' };
    const comPeso = conferir(aprovado, { escolhas: { aluno: 1001, instrutor: 2, horario: 610, kgInstrutor: { 2: '120' } }, tocados: ['instrutor', 'horario'] });
    assert.deepEqual(codigos(comPeso.bloqueios), []);
    assert.deepEqual(codigos(comPeso.avisos), ['peso-muda-outro-voo']);
    assert.match(comPeso.avisos[0].texto, /^Com o peso digitado, o voo de Aluno 1000 fica em conflito: o peso do aluno e do instrutor passa do limite/);
    assert.deepEqual(codigos(comPeso.notas), ['reduzir-combustivel', 'escala-aprovada']);
  });

  it('a data e o horário: o que já passou, a data passada, o domingo; sem as horas dos instrutores, a lei não conferida', () => {
    const avisos = (outro, escolhas = {}, tocados = []) => codigos(agendar(doDia(), { amb: { ...amb, ...outro }, escolhas: { aluno: 1001, ...escolhas }, tocados }).avaliacao.avisos);
    assert.deepEqual(avisos({ hoje: DATA, agora: 700 }, { horario: 390 }, ['horario']), ['horario-passado']);
    assert.deepEqual(avisos({ hoje: '2026-11-12' }), ['data-passada']);
    assert.deepEqual(avisos({ data: '2026-11-15', hoje: '2026-11-14' }), ['domingo']);
    assert.deepEqual(avisos({ semHoras: true }), ['lei-nao-conferida']);
  });

  it('as notas: a condicional, a duração diferente da do programa, o instrutor fora do Priorizar com e o pedido que ficou fora', () => {
    // O IN-02 voa às 06:30; o voo das 08:20 recebe o CT-01 (escolhido: o padrão é mover o IN-02), que depende do resultado
    const estado = doDia({ s1000: { etapa: 'IN-01' } });
    estado.stu[1] = { ...estado.stu[1], fly: true, p1: 390, p2: -1, etapa: 'IN-02', voaCom: [1] };
    const notas = conferir(estado, {
      escolhas: { aluno: 1001, missao: 'missao:PP:CT-01', horario: 500, horas: '1,5', instrutor: 2 }, tocados: ['missao', 'horario', 'horas', 'instrutor']
    }).notas;
    assert.deepEqual(notas.map(n => [n.codigo, n.texto]), [
      ['condicional', 'CT-01 depende do resultado de IN-02 (amanhã 06:30).'],
      ['duracao-do-programa', 'A duração (1,5 h) é diferente da do programa para CT-01 (1 h).'],
      ['fora-do-priorizar', 'Instrutor 02 está fora do Priorizar com de Aluno 1001.']
    ]);
    const fora = doDia({ ins: [instrutor(1, 9)], s1000: { jan: 'h390' } });
    fora.stu.push(aluno(1002, { p1: 390, p2: -1, jan: 'h390' }));
    // Um voo novo (o padrão seria encaixar o pedido que ficou fora): o outro pedido continua fora, com a nota
    assert.ok(codigos(conferir(fora, { escolhas: { aluno: 1002, missao: 'tipo:Voo Local', horario: 500 }, tocados: ['missao', 'horario'] }).notas).includes('pedido-fora'));
  });

  it('a confirmação vale para um conjunto de avisos; a descrição do histórico tem até 500 caracteres', () => {
    assert.notEqual(assinaturaDosAvisos([{ codigo: 'sem-peso', texto: 'a' }]), assinaturaDosAvisos([{ codigo: 'sem-peso', texto: 'b' }]));
    assert.equal(assinaturaDosAvisos([]), '');
    const longo = 'N'.repeat(80);
    const estado = doDia();
    estado.stu[1].nm = longo;
    estado.ins[1].nm = longo;
    const { formulario } = agendar(estado, { amb, escolhas: { aluno: 1001, instrutor: 2, disponibilizar: 2 }, tocados: ['instrutor'] });
    const avisos = Array.from({ length: 30 }, (_, i) => ({ codigo: 'fora-da-ordem', resumo: `fora da ordem (falta a missão ${i})` }));
    const texto = descricaoDoAgendamento(estado, formulario.proposta, { avisos });
    assert.ok(texto.length <= 500, `${texto.length} caracteres`);
    assert.match(texto, /^Agendado na escala: N{80} · IN-02 \(Voo Local\) · 06:30–07:30 · .+ · confirmado: fora da ordem/);
    assert.ok(texto.endsWith(`· ${longo} marcado disponível às 06:30`));
    const aprovada = { ...estado, aprovacao: { em: '2026-11-10T20:00:00.000Z', por: '' } };
    assert.match(descricaoDoAgendamento(aprovada, formulario.proposta, { avisos: [] }), /^Agendado na escala aprovada: /);
  });
});

describe('Agendamento: os instrutores', () => {
  it('em grupos: os que servem, os com aviso (indisponível; ocupado só com voo que não é fixo) e os que não servem, com o motivo', () => {
    const estado = doDia({ ins: [instrutor(1, 9), instrutor(2, 9), instrutor(3, 9, { on: false }), instrutor(4, 9, { hab: ['grounds'] }), instrutor(5, 9)], extra: {
      fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 5 } }, fStatus: { '1000_0_1': 'Em Voo' }
    } });
    estado.stu[1].bl = [2];
    const base = runAllocationEngine(estado);
    const grupos = opcoesDeInstrutor(estado, base, { mis: 'Voo Local', tipo: 'C152', a: 390, b: 450, stu: estado.stu[1], stuKg: 70, curso: 'PP', r: 'PR-VOC' });
    assert.deepEqual(grupos.map(g => [g.rotulo, g.opcoes.map(o => [o.texto, Boolean(o.desligada)])]), [
      ['Servem neste horário', [['Instrutor 01', false]]],
      ['Com aviso', [['Instrutor 03 — indisponível', false]]],
      ['Não servem', [['Instrutor 04 — sem a habilitação', true], ['Instrutor 02 — em Não escalar com', true], ['Instrutor 05 — ocupado: voo fixo 06:30–07:30 (Aluno 1000)', true]]]
    ]);
  });
});

describe('Agendamento: os voos de hoje do aluno (mover e encaixar)', () => {
  const amb = ambiente({ registros: aprovadas(1001, ['IN-01']) });
  // Um instrutor só: o Aluno 1001 (prioridade 5) voa às 06:30; o Aluno 1000 só pode às 06:30 e fica fora da escala
  const comFora = () => doDia({ ins: [instrutor(1, 9)], s1000: { jan: 'h390', etapa: 'IN-01', cursoDaEtapa: 'PP' }, s1001: { fly: true, p1: 390, p2: -1, pr: 5 } });
  const deHoje = f => f.missoes.grupos.find(g => g.rotulo === 'Voos de amanhã do aluno');

  it('o padrão nunca é a missão seguinte por cima de um pedido que já existe: o que ficou fora entra; o que tem a próxima muda de lugar', () => {
    // O IN-01 do Aluno 1000 voa às 06:30 (o app escolheu): mover; o IN-02 continua escolhível, dependendo do resultado
    const estado = doDia({ s1000: { etapa: 'IN-01', cursoDaEtapa: 'PP' } });
    const voo = runAllocationEngine(estado).out.find(o => o.stuId === 1000);
    const { formulario: f } = agendar(estado, { escolhas: { aluno: 1000 } });
    assert.deepEqual([f.missao, f.acao], ['pedido:0', 'mover']);
    assert.deepEqual(deHoje(f).opcoes.map(o => [o.valor, o.texto, Boolean(o.desligada)]), [['pedido:0', `Mover IN-01 · Voo Local (amanhã 06:30, ${voo.r})`, false]]);
    assert.equal(opcoes(f.missoes.grupos).find(o => o.valor === 'missao:PP:IN-02').texto, 'IN-02 · Voo Local · C152 · 1 h — depende do resultado de IN-01 (amanhã 06:30)');
    // O voo sai do horário em que está: o primeiro horário livre depois dele, no mesmo avião e com o mesmo instrutor
    assert.deepEqual([f.horario, f.recurso, f.instrutor], [500, voo.r, voo.insId]);
    assert.deepEqual(f.proposta.pedido, { mid: 0, acao: 'mover', de: { a: 390, r: voo.r } });
    assert.equal(f.proposta.missao, null);
    // O que ficou fora entra, antes de tudo
    const fora = agendar(comFora(), { escolhas: { aluno: 1000 } }).formulario;
    assert.deepEqual([fora.missao, fora.acao, fora.horario], ['pedido:0', 'encaixar', 390]);
    assert.deepEqual(deHoje(fora).opcoes.map(o => o.texto), ['Encaixar IN-01 · Voo Local (ficou fora: sem instrutor livre)']);
    // Sem a próxima num pedido do dia (o pedido sem a missão do curso), a próxima do curso, num voo novo
    const semEtapa = agendar(doDia(), { escolhas: { aluno: 1000 } }).formulario;
    assert.deepEqual([semEtapa.missao, semEtapa.acao], ['missao:PP:IN-01', null]);
    assert.deepEqual(deHoje(semEtapa).opcoes.map(o => o.texto), [`Mover Voo Local (amanhã 06:30, ${voo.r})`]);
  });

  // A volta do noturno de ontem leva o número do pedido de ontem (0, na sessão 2), o mesmo do pedido de hoje do aluno, e
  // não é o voo dele (pedidosDosVoos, js/voo.js): "Mover" é só do voo de hoje, e a volta continua onde está, ocupando o
  // aluno até as 10:10 (js/candidatos.js)
  it('a volta do noturno de ontem não é o voo do pedido de hoje: mover leva só o voo de hoje, e a volta fica', () => {
    const estado = doDia({ s1000: { p1: 820, p2: -1, pr: 5 } });
    estado.noturnosDaVespera = [{ stuId: 1000, mid: 0, insId: 1, r: 'PR-VOY', eqType: 'C172', s: 'Aluno 1000', ins: 'Instrutor 01', stuKg: 70, fim: 1290 }];
    const doAluno = out => out.filter(o => o.stuId === 1000).map(o => [o.fKey, o.trecho || null, hm(o.a)]);
    const { base, formulario: f } = agendar(estado, { amb, escolhas: { aluno: 1000 } });
    assert.deepEqual(doAluno(base.out), [['1000_0_2', 'volta', '07:30'], ['1000_0_1', null, '13:40']]);
    const voo = base.out.find(o => o.fKey === '1000_0_1');
    assert.deepEqual(deHoje(f).opcoes.map(o => [o.valor, o.texto]), [['pedido:0', `Mover Voo Local (amanhã 13:40, ${voo.r})`]]);
    // O voo novo do aluno: o primeiro horário depois da volta
    assert.equal(f.horario, 610);
    // O voo de hoje movido para as 10:10: a volta continua às 07:30, sem pedido
    const { sim } = agendar(estado, { amb, escolhas: { aluno: 1000, missao: 'pedido:0', horario: 610 }, tocados: ['missao', 'horario'] });
    assert.deepEqual(doAluno(sim.out), [['1000_0_2', 'volta', '07:30'], ['1000_0_1', null, '10:10']]);
  });

  it('o voo em andamento e o cancelado ficam desligados, com o status; o cancelado não segura a próxima missão', () => {
    const estado = doDia({ s1000: { etapa: 'IN-01', cursoDaEtapa: 'PP' } });
    const voo = runAllocationEngine(estado).out.find(o => o.stuId === 1000);
    for (const [status, rotulo] of [['Em Voo', 'em voo'], ['Atrasado', 'atrasado'], ['Pousou', 'pousou'], ['Cancelado', 'cancelado']]) {
      const comStatus = { ...estado, fixos: { '1000_0_1': { a: voo.a, b: voo.b, r: voo.r, insId: voo.insId } }, fStatus: { '1000_0_1': status } };
      const { formulario: f } = agendar(comStatus, { escolhas: { aluno: 1000 } });
      assert.deepEqual(deHoje(f).opcoes.map(o => [o.texto, o.desligada]), [[`Mover IN-01 · Voo Local (amanhã 06:30, ${voo.r}) — ${rotulo}`, true]], status);
      assert.notEqual(f.missao, 'pedido:0', status);
      // Escolhido mesmo assim (o select não deixa), não muda de lugar
      const escolhido = agendar(comStatus, { escolhas: { aluno: 1000, missao: 'pedido:0' }, tocados: ['missao'] }).formulario;
      assert.deepEqual(codigos(escolhido.formato), ['voo-em-andamento'], status);
    }
    // Cancelado, o IN-01 volta a ser a próxima, num voo novo
    const cancelado = { ...estado, fixos: { '1000_0_1': { a: voo.a, b: voo.b, r: voo.r, insId: voo.insId } }, fStatus: { '1000_0_1': 'Cancelado' } };
    assert.equal(agendar(cancelado, { escolhas: { aluno: 1000 } }).formulario.missao, 'missao:PP:IN-01');
  });

  it('mover: o mesmo pedido muda de lugar, com o instrutor escolhido dele; desfazer devolve o pedido e o voo fixo de antes', () => {
    // O IN-02 do Aluno 1001 às 06:30, fixo pelo instrutor escolhido na Escala (o Instrutor 02), com a disponibilidade de manhã
    const estado = doDia({ s1001: { fly: true, p1: 390, p2: 500, etapa: 'IN-02', cursoDaEtapa: 'PP', insId: 2, jan: 'manha' } });
    estado.fixos = { '1001_0_1': { a: 390, b: 450, r: 'PR-VOC', insId: 2, escolhido: true } };
    const { formulario: f, sim, fKey } = agendar(estado, { amb, escolhas: { aluno: 1001, horario: 820 }, tocados: ['horario'] });
    assert.deepEqual([f.missao, f.acao, f.instrutor, f.recurso], ['pedido:0', 'mover', 2, 'PR-VOC']);
    const real = structuredClone(estado);
    const antes = aplicarAgendamento(real, null, f.proposta);
    assert.deepEqual(runAllocationEngine(real), sim, 'a prévia é a escala que fica');
    assert.equal(fKey, '1001_0_1');
    const stu = real.stu[1];
    // A missão do curso fica; o horário, o recurso e o instrutor são os novos; a disponibilidade que não inclui as 13:40 sai
    assert.deepEqual([stu.extra, stu.mis, stu.etapa, stu.cursoDaEtapa, stu.p1, stu.p2, stu.insId, stu.jan], [[], 'Voo Local', 'IN-02', 'PP', 820, -1, 2, undefined]);
    assert.deepEqual(real.fixos['1001_0_1'], { a: 820, b: 880, r: 'PR-VOC', insId: 2, agendado: true });
    assert.deepEqual([antes.criado, antes.mid, antes.fixo], [false, 0, { a: 390, b: 450, r: 'PR-VOC', insId: 2, escolhido: true }]);
    assert.deepEqual(antes.pedido, { fly: true, mis: 'Voo Local', eq: 'C152', p1: 390, p2: 500, nb: 1, ss: 1, pr: 3, jan: 'manha', etapa: 'IN-02', insId: 2, cursoDaEtapa: 'PP' });
    // Desfazer: o pedido como estava e o voo fixo pelo instrutor escolhido de antes
    const rev = validarReversao(reversaoDoAgendamento(antes));
    assert.deepEqual([rev.criado, rev.label], [false, '↶ Desfazer']);
    assert.equal(motivoParaNaoDesfazer(real, rev), '');
    assert.ok(desfazerAgendamento(real, rev));
    assert.deepEqual([stu.p1, stu.p2, stu.jan, stu.insId, stu.etapa], [390, 500, 'manha', 2, 'IN-02']);
    assert.deepEqual(real.fixos['1001_0_1'], { a: 390, b: 450, r: 'PR-VOC', insId: 2, escolhido: true });
    // O pedido que mudou depois do agendamento (outra missão na Demanda) não é desfeito
    const depois = structuredClone(estado);
    const outro = aplicarAgendamento(depois, null, f.proposta);
    depois.stu[1].mis = 'Navegação';
    assert.equal(motivoParaNaoDesfazer(depois, validarReversao(reversaoDoAgendamento(outro))), 'O pedido mudou depois do agendamento: desfazer agora mexeria em outro voo. Mude o pedido na Demanda.');
  });

  it('desfazer o voo movido sem voo fixo antes: cancelado depois, ele fica fixo onde foi cancelado; na escala aprovada depois, volta para o app', () => {
    const estado = doDia({ s1000: { etapa: 'IN-01', cursoDaEtapa: 'PP' } });
    const { formulario: f } = agendar(estado, { escolhas: { aluno: 1000, horario: 610 }, tocados: ['horario'] });
    const movido = () => {
      const real = structuredClone(estado);
      const rev = validarReversao(reversaoDoAgendamento(aplicarAgendamento(real, null, f.proposta)));
      assert.equal(rev.fixo, null);
      return { real, rev, pino: real.fixos['1000_0_1'] };
    };
    // Cancelado depois (o status fixa o voo onde está): desfazer devolve o pedido e deixa o voo cancelado ali, sem a marca
    const cancelado = movido();
    const voo = runAllocationEngine(cancelado.real).out.find(o => o.fKey === '1000_0_1');
    cancelado.real.fixos = fixosAoMudarStatus(cancelado.real.fixos, voo, 'Cancelado', { aprovada: false });
    cancelado.real.fStatus = { '1000_0_1': 'Cancelado' };
    assert.equal(motivoParaNaoDesfazer(cancelado.real, cancelado.rev), '');
    assert.ok(desfazerAgendamento(cancelado.real, cancelado.rev));
    const { agendado, ...semMarca } = cancelado.pino;
    assert.deepEqual([agendado, cancelado.real.fixos['1000_0_1'], cancelado.real.stu[0].p1], [true, semMarca, 390]);
    assert.equal(runAllocationEngine(cancelado.real).out.find(o => o.fKey === '1000_0_1').a, 610, 'o cancelado não volta para a escala nem ocupa outro lugar');
    // Aprovada depois: o voo deixa de ser fixo, e o app o põe de novo na escala (em volta dos voos fixos), como antes
    const aprovado = movido();
    aprovado.real.fixos = fixosAoAprovar(aprovado.real.fixos, runAllocationEngine(aprovado.real).out);
    aprovado.real.aprovacao = { em: '2026-11-10T20:00:00.000Z', por: '' };
    assert.ok(desfazerAgendamento(aprovado.real, aprovado.rev));
    assert.equal(Object.hasOwn(aprovado.real.fixos, '1000_0_1'), false);
    const deNovo = runAllocationEngine(aprovado.real).out.find(o => o.fKey === '1000_0_1');
    assert.deepEqual([deNovo.a, Boolean(deNovo.fixo)], [390, false]);
  });

  it('encaixar: o pedido que ficou fora entra na escala sem outra missão extra; a prévia diz o voo que mudou de lugar', () => {
    const estado = comFora();
    const { formulario: f, sim, avaliacao } = agendar(estado, { escolhas: { aluno: 1000 } });
    assert.deepEqual(codigos(avaliacao.bloqueios), []);
    const novo = sim.out.find(o => o.fKey === '1000_0_1');
    const outro = sim.out.find(o => o.stuId === 1001);
    assert.deepEqual(avaliacao.previa.linhas, [
      `Entra: Aluno 1000 · Voo Local · 06:30–07:30 · ${novo.r} · Instrutor 01 (estava fora da escala)`,
      `Aluno 1001: 06:30 → ${hm(outro.a)}${outro.r !== runAllocationEngine(estado).out[0].r ? `, ${runAllocationEngine(estado).out[0].r} → ${outro.r}` : ''}`
    ]);
    const real = structuredClone(estado);
    const antes = aplicarAgendamento(real, null, f.proposta);
    assert.deepEqual([real.stu[0].extra, real.stu[0].jan, antes.criado, antes.fixo], [[], 'h390', false, null]);
    assert.equal(descricaoDoAgendamento(estado, f.proposta, avaliacao), `Agendado na escala: Aluno 1000 · IN-01 (Voo Local) · 06:30–07:30 · ${novo.r} · Instrutor 01 (estava fora da escala)`);
    // Desfazer: o pedido volta a ficar fora, sem voo fixo
    assert.ok(desfazerAgendamento(real, validarReversao(reversaoDoAgendamento(antes))));
    assert.equal(Object.hasOwn(real.fixos, '1000_0_1'), false);
    assert.equal(runAllocationEngine(real).out.some(o => o.fKey === '1000_0_1'), false);
  });

  it('mover pede confirmação: a disponibilidade do aluno que não inclui o horário novo, o voo da escala aprovada e a ordem do curso no horário novo', () => {
    // De manhã só: às 13:40 a disponibilidade sai do pedido (sem conflito na simulação)
    const manha = doDia({ s1000: { jan: 'manha', etapa: 'IN-01', cursoDaEtapa: 'PP' } });
    const tarde = agendar(manha, { escolhas: { aluno: 1000, horario: 820 }, tocados: ['horario'] });
    assert.deepEqual(tarde.avaliacao.avisos.map(a => [a.codigo, a.texto, a.resumo]), [
      ['disponibilidade-do-aluno', 'Aluno 1000 está disponível só de manhã: agendado às 13:40, o pedido fica sem a disponibilidade.', 'fora da disponibilidade do aluno']
    ]);
    assert.deepEqual(codigos(tarde.avaliacao.bloqueios), []);
    // Na escala aprovada, o voo fixo muda de lugar
    const aprovada = doDia({ s1000: { etapa: 'IN-01', cursoDaEtapa: 'PP' } });
    const voo = runAllocationEngine(aprovada).out.find(o => o.stuId === 1000);
    aprovada.fixos = fixosAoAprovar({}, runAllocationEngine(aprovada).out);
    aprovada.aprovacao = { em: '2026-11-10T20:00:00.000Z', por: '' };
    const naAprovada = agendar(aprovada, { escolhas: { aluno: 1000, horario: 610 }, tocados: ['horario'] }).avaliacao;
    assert.deepEqual(naAprovada.avisos.map(a => [a.codigo, a.texto]), [
      ['fixo-muda', `O voo de Aluno 1000 está fixo (escala aprovada): ele sai das 06:30 no ${voo.r} e fica fixo no horário novo.`]
    ]);
    // O IN-02 numa missão extra às 10:10, depois do IN-01 das 08:20: às 06:30, antes do IN-01, fica fora da ordem
    const ordem = doDia({ s1000: { p1: 500, etapa: 'IN-01', cursoDaEtapa: 'PP' } });
    ordem.stu[0].extra = [missaoExtra(1, { p1: 610, p2: -1, etapa: 'IN-02', cursoDaEtapa: 'PP' })];
    const cedo = agendar(ordem, { escolhas: { aluno: 1000, missao: 'pedido:1', horario: 390 }, tocados: ['missao', 'horario'] }).avaliacao;
    assert.deepEqual(cedo.avisos.map(a => [a.codigo, a.texto]), [['fora-da-ordem', 'IN-02 fora da ordem: IN-01 voa depois, às 08:20.']]);
    // Mais tarde, depois do IN-01: só a nota de que depende do resultado
    const tardeOk = agendar(ordem, { escolhas: { aluno: 1000, missao: 'pedido:1', horario: 760 }, tocados: ['missao', 'horario'] }).avaliacao;
    assert.deepEqual([codigos(tardeOk.avisos), tardeOk.notas.find(n => n.codigo === 'condicional').texto], [[], 'IN-02 depende do resultado de IN-01 (amanhã 08:20).']);
  });

  it('mover o Noturno: as 4 h fixas às 17:30, com a volta amanhã; o Ground, 1h30 nas janelas do dia', () => {
    const estado = doDia({ s1000: { mis: 'Noturno', eq: 'C172', p1: 1050, p2: -1, nb: 4 } });
    const voo = runAllocationEngine(estado).out.find(o => o.stuId === 1000);
    assert.deepEqual([voo.a, voo.b], [1050, 1290]);
    const { formulario: f, avaliacao } = agendar(estado, { escolhas: { aluno: 1000, missao: 'pedido:0' }, tocados: ['missao'] });
    assert.deepEqual([f.acao, f.horas, f.horario, f.horarios.opcoes.map(o => o.valor)], ['mover', { valor: '4', fixa: true }, 1050, [1050]]);
    assert.deepEqual([f.proposta.nb, f.proposta.b], [4, 1290]);
    assert.ok(codigos(avaliacao.notas).includes('noturno'));
    const real = structuredClone(estado);
    aplicarAgendamento(real, null, f.proposta);
    assert.deepEqual([real.stu[0].mis, real.stu[0].nb, real.stu[0].p1, real.fixos['1000_0_1'].b], ['Noturno', 4, 1050, 1290]);
    // O Ground muda de turma só nas janelas do dia, com 1h30
    const ground = doDia({ s1000: { ...GROUND_C152, p1: 500, p2: -1 } });
    const g = agendar(ground, { escolhas: { aluno: 1000, missao: 'pedido:0', horario: 760 }, tocados: ['missao', 'horario'] }).formulario;
    assert.deepEqual([g.acao, g.horas, g.horarios.opcoes.map(o => o.valor), g.proposta.b - g.proposta.a], ['mover', { valor: '1.5', fixa: true }, T.slice(0, 8), 90]);
  });

  it('a descrição do histórico do voo que mudou de lugar diz de onde ele saiu', () => {
    const estado = doDia({ s1000: { etapa: 'IN-01', cursoDaEtapa: 'PP' } });
    const voo = runAllocationEngine(estado).out.find(o => o.stuId === 1000);
    const { formulario: f, avaliacao } = agendar(estado, { escolhas: { aluno: 1000, horario: 610 }, tocados: ['horario'] });
    assert.equal(descricaoDoAgendamento(estado, f.proposta, avaliacao),
      `Agendado na escala: Aluno 1000 · IN-01 (Voo Local) · 10:10–11:10 · ${f.recurso} · ${voo.ins} (era 06:30 no ${voo.r})`);
    assert.equal(avaliacao.previa.linhas[0], `Muda: Aluno 1000 · Voo Local · 10:10–11:10 · ${f.recurso} · ${voo.ins} (era 06:30 no ${voo.r})`);
  });

  it('o Ground que muda de lugar estava "na sala de Ground": a descrição, a prévia, o aviso do voo fixo e o contexto', () => {
    const estado = doDia({ s1000: { ...GROUND_C152, p1: 500, p2: -1 } });
    const de = runAllocationEngine(estado).out.find(o => o.stuId === 1000);
    const { formulario: f, avaliacao } = agendar(estado, { escolhas: { aluno: 1000, missao: 'pedido:0', horario: 760 }, tocados: ['missao', 'horario'] });
    const x = f.selecao.x.nm;
    assert.equal(descricaoDoAgendamento(estado, f.proposta, avaliacao), `Agendado na escala: Aluno 1000 · Ground C152 · 12:40–14:10 · Sala Ground · ${x} (era 08:20 na sala de Ground)`);
    assert.equal(avaliacao.previa.linhas[0], `Muda: Aluno 1000 · Ground C152 · 12:40–14:10 · Sala Ground · ${x} (era 08:20 na sala de Ground)`);
    // Na escala aprovada, o aviso do voo fixo que muda de lugar
    estado.fixos = fixosAoAprovar({}, runAllocationEngine(estado).out);
    estado.aprovacao = { em: '2026-11-10T20:00:00.000Z', por: '' };
    const aprovada = agendar(estado, { escolhas: { aluno: 1000, missao: 'pedido:0', horario: 760 }, tocados: ['missao', 'horario'] }).avaliacao;
    assert.deepEqual(aprovada.avisos.map(a => a.texto), [`O voo de Aluno 1000 está fixo (escala aprovada): ele sai das ${hm(de.a)} na sala de Ground e fica fixo no horário novo.`]);
    // O Ground que ficou fora (só às 06:30, com a janela fechada), pela linha do PR-VOB: o contexto diz que ele vai para a sala
    const fora = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { ...GROUND_C152, p1: 390, p2: -1, jan: 'h390' })], janelasOff: [0] });
    const g = agendar(fora, { contexto: { r: 'PR-VOB', minuto: 600 }, escolhas: { aluno: 1000 } }).formulario;
    assert.deepEqual([g.missao, g.acao, g.recurso, g.horario], ['pedido:0', 'encaixar', 'SALA-GROUND', 610]);
    assert.equal(g.contextoTexto, 'Sala Ground · clique perto das 10:00 → 10:10 (horários das aulas de Ground). O PR-VOB não serve ao Ground C152: o voo vai na sala de Ground.');
  });
});

describe('Agendamento: as turmas de Ground', () => {
  // A turma das 08:20 (Alunos 1000 e 1002, com o Instrutor 01); o Aluno 1001 não voa
  const comTurma = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [
    aluno(1000, { ...GROUND_C152, p1: 500, p2: -1 }), aluno(1001, { fly: false }), aluno(1002, { ...GROUND_C152, p1: 500, p2: -1 })
  ] });

  it('entrar na turma do dia: a chave, o horário e o instrutor dela; a linha gravada aceita a turma', () => {
    const estado = comTurma();
    const turma = runAllocationEngine(estado).out[0];
    const { formulario: f, sim, avaliacao } = agendar(estado, { escolhas: { aluno: 1001, missao: 'tipo:Ground C152', instrutor: `turma:${turma.classKey}` }, tocados: ['missao', 'instrutor'] });
    assert.deepEqual(f.instrutores[0], {
      rotulo: 'Turmas de amanhã',
      opcoes: [{ valor: `turma:${turma.classKey}`, texto: 'Entrar na turma das 08:20 com Instrutor 01 (2 alunos)', desligada: false, turma: { classKey: turma.classKey, mis: 'Ground C152', a: 500, b: 590, insId: 1, ins: 'Instrutor 01', n: 2 } }]
    });
    assert.deepEqual([f.instrutor, f.horario, f.recurso, f.recursos.map(o => o.texto)], [`turma:${turma.classKey}`, 500, 'SALA-GROUND', ['Sala Ground · turma das 08:20']]);
    assert.equal(f.horarios.opcoes.find(o => o.valor === 500).texto, '08:20 (turma)');
    assert.deepEqual([f.proposta.a, f.proposta.b, f.proposta.insId, f.proposta.turma], [500, 590, 1, { classKey: turma.classKey }]);
    assert.deepEqual(codigos(avaliacao.bloqueios), []);
    const linha = sim.out.find(o => o.stuId === 1001);
    assert.deepEqual([linha.classKey, linha.groupSize, linha.tag], [turma.classKey, 3, 'Pref. 1 · Turma (3)']);
    assert.ok(normalizarLinhaGravada(linha), 'a chave da turma do motor');
    const real = structuredClone(estado);
    aplicarAgendamento(real, null, f.proposta);
    assert.deepEqual(real.fixos['1001_0_1'], { a: 500, b: 590, r: 'SALA-GROUND', insId: 1, classKey: turma.classKey, agendado: true });
    assert.deepEqual(runAllocationEngine(real), sim);
    assert.match(descricaoDoAgendamento(estado, f.proposta, avaliacao), /^Agendado na escala: Aluno 1001 · Ground C152 · 08:20–09:50 · Sala Ground · Instrutor 01 · entrou na turma$/);
  });

  it('a turma nova não tem chave (vale a do voo, aceita pela linha gravada); o "Não escalar com" desliga a turma do instrutor', () => {
    const estado = comTurma();
    const { formulario: f, sim } = agendar(estado, { escolhas: { aluno: 1001, missao: 'tipo:Ground C152', instrutor: 2, horario: 610 }, tocados: ['missao', 'instrutor', 'horario'] });
    assert.equal(f.proposta.turma, undefined);
    const real = structuredClone(estado);
    aplicarAgendamento(real, null, f.proposta);
    assert.deepEqual(real.fixos['1001_0_1'], { a: 610, b: 700, r: 'SALA-GROUND', insId: 2, agendado: true });
    const linha = sim.out.find(o => o.stuId === 1001);
    assert.equal(linha.classKey, '1001_0_1');
    assert.ok(normalizarLinhaGravada(linha), 'a chave do voo como chave da turma');
    estado.stu[1].bl = [1];
    const bloqueada = agendar(estado, { escolhas: { aluno: 1001, missao: 'tipo:Ground C152' }, tocados: ['missao'] }).formulario;
    assert.deepEqual(bloqueada.instrutores[0].opcoes.map(o => [o.texto, o.desligada]), [['Entrar na turma das 08:20 com Instrutor 01 (2 alunos) — em Não escalar com', true]]);
  });

  it('o aluno que abriu a turma muda de lugar: a turma nova dele recebe outra chave, e a de antes fica com quem entrou nela', () => {
    // A turma nova do Aluno 1000 às 08:20 (a chave dela é a do voo dele), e o Aluno 1001 entra nela
    const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 9), instrutor(3, 9)], stu: [aluno(1000, { fly: false }), aluno(1001, { fly: false }), aluno(1002, { fly: false })] });
    const confirmar = (escolhas, tocados) => aplicarAgendamento(estado, null, agendar(estado, { escolhas, tocados }).formulario.proposta);
    confirmar({ aluno: 1000, missao: 'tipo:Ground C152', instrutor: 1, horario: 500 }, ['missao', 'instrutor', 'horario']);
    confirmar({ aluno: 1001, missao: 'tipo:Ground C152', instrutor: 'turma:1000_0_1' }, ['missao', 'instrutor']);
    // O Aluno 1000 muda para as 10:10, numa turma nova com o Instrutor 02: ela não pode ter a chave da turma das 08:20
    const { formulario: f, sim } = agendar(estado, { escolhas: { aluno: 1000, missao: 'pedido:0', instrutor: 2, horario: 610 }, tocados: ['missao', 'instrutor', 'horario'] });
    aplicarAgendamento(estado, null, f.proposta);
    assert.deepEqual(estado.fixos['1000_0_1'], { a: 610, b: 700, r: 'SALA-GROUND', insId: 2, classKey: 'GND_Ground C152_2_2', agendado: true });
    assert.deepEqual(runAllocationEngine(estado), sim, 'a prévia é a escala que fica');
    const turmas = sim.out.filter(o => o.isGround).sort((p, q) => p.a - q.a);
    assert.deepEqual(turmas.map(o => [o.fKey, o.classKey, o.a, o.insId]), [['1001_0_1', '1000_0_1', 500, 1], ['1000_0_1', 'GND_Ground C152_2_2', 610, 2]]);
    assert.ok(turmas.every(o => normalizarLinhaGravada(o)), 'as chaves são aceitas pela escala gravada');
    // Cada turma ocupa a sala e o instrutor dela: o Instrutor 01 num voo às 08:20, ou outra turma na sala às 08:20, bloqueiam
    const voo = agendar(estado, { escolhas: { aluno: 1002, missao: 'tipo:Voo Local', instrutor: 1, horario: 500 }, tocados: ['missao', 'instrutor', 'horario'] });
    assert.deepEqual(codigos(voo.avaliacao.bloqueios), ['instrutor-ocupado']);
    const outra = agendar(estado, { escolhas: { aluno: 1002, missao: 'tipo:Ground C152', instrutor: 3, horario: 500 }, tocados: ['missao', 'instrutor', 'horario'] });
    assert.deepEqual(codigos(outra.avaliacao.bloqueios), ['sala-ocupada']);
    // Sem outra turma com a chave do voo, a turma nova continua sem chave (vale a do voo)
    const sozinho = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { ...GROUND_C152, p1: 500, p2: -1 })] });
    const mudou = agendar(sozinho, { escolhas: { aluno: 1000, missao: 'pedido:0', horario: 610 }, tocados: ['missao', 'horario'] }).formulario;
    aplicarAgendamento(sozinho, null, mudou.proposta);
    assert.equal(Object.hasOwn(sozinho.fixos['1000_0_1'], 'classKey'), false);
  });

  it('pelo "+ Aluno na turma" (t:): o Ground e a turma vêm escolhidos, e o contexto diz qual', () => {
    const estado = comTurma();
    const turma = runAllocationEngine(estado).out[0];
    const { formulario: f, avaliacao } = agendar(estado, { contexto: `t:${turma.classKey}`, escolhas: { aluno: 1001 } });
    assert.deepEqual([f.missao, f.instrutor, f.horario, f.proposta.turma], ['tipo:Ground C152', `turma:${turma.classKey}`, 500, { classKey: turma.classKey }]);
    assert.equal(f.contextoTexto, 'Turma de Ground C152 das 08:20 com Instrutor 01');
    assert.deepEqual(codigos(avaliacao.bloqueios), []);
    // O aluno com o Ground no pedido dele (numa turma das 06:30): ele muda para a turma com o pedido dele
    estado.stu[1] = { ...estado.stu[1], ...GROUND_C152, fly: true, p1: 390, p2: -1, jan: 'h390' };
    const comPedido = agendar(estado, { contexto: `t:${turma.classKey}`, escolhas: { aluno: 1001 } }).formulario;
    assert.deepEqual([comPedido.missao, comPedido.acao, comPedido.instrutor, comPedido.horario], ['pedido:0', 'mover', `turma:${turma.classKey}`, 500]);
    // O pedido dele que ficou fora (o instrutor escolhido não vem): ele entra na turma, com o instrutor dela
    estado.ins.push(instrutor(3, 9, { on: false }));
    estado.stu[1].insId = 3;
    const fora = agendar(estado, { contexto: `t:${turma.classKey}`, escolhas: { aluno: 1001 } });
    assert.deepEqual([fora.formulario.missao, fora.formulario.acao, fora.formulario.proposta.insId], ['pedido:0', 'encaixar', 1]);
    assert.deepEqual(codigos(fora.avaliacao.bloqueios), []);
  });
});

describe('Agendamento: as alternativas de cada bloqueio', () => {
  const amb = ambiente({ registros: aprovadas(1001, ['IN-01']) });
  // O Aluno 1000 está em voo no PR-VOB às 06:30 com o Instrutor 01
  const emVoo = () => doDia({ extra: { fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } }, fStatus: { '1000_0_1': 'Em Voo' } } });
  const alternativas = item => (item.alternativas || []).map(g => [g.rotulo, g.opcoes.map(o => [o.opcao, o.texto])]);

  it('o avião ocupado: os recursos e os horários livres; o instrutor ocupado: os instrutores e os horários; o aluno ocupado: os horários', () => {
    const aviao = agendar(emVoo(), { amb, escolhas: { aluno: 1001, recurso: 'PR-VOB', horario: 390 }, tocados: ['recurso', 'horario'] }).avaliacao.bloqueios;
    assert.deepEqual(alternativas(aviao[0]), [
      ['Recursos livres', [['recurso:PP-LJV', 'PP-LJV'], ['recurso:PR-BTB', 'PR-BTB'], ['recurso:PR-IGU', 'PR-IGU']]],
      ['Horários livres', [['horario:500', '08:20'], ['horario:610', '10:10'], ['horario:690', '11:30']]]
    ]);
    const instrutor = agendar(emVoo(), { amb, escolhas: { aluno: 1001, instrutor: 1, horario: 390 }, tocados: ['instrutor', 'horario'] }).avaliacao.bloqueios;
    assert.deepEqual(alternativas(instrutor[0]), [
      ['Instrutores livres', [['instrutor:2', 'Instrutor 02']]], ['Horários livres', [['horario:500', '08:20'], ['horario:610', '10:10'], ['horario:690', '11:30']]]
    ]);
    const aluno1000 = agendar(emVoo(), { amb, escolhas: { aluno: 1000, missao: 'tipo:Voo Local', horario: 390 }, tocados: ['missao', 'horario'] }).avaliacao.bloqueios;
    assert.deepEqual(alternativas(aluno1000[0]), [['Horários livres', [['horario:500', '08:20'], ['horario:610', '10:10'], ['horario:690', '11:30']]]]);
    // A alternativa escolhida (com os outros campos como estavam) resolve o bloqueio
    const outroAviao = agendar(emVoo(), { amb, escolhas: { aluno: 1001, recurso: 'PP-LJV', horario: 390, instrutor: 2 }, tocados: ['recurso', 'horario', 'instrutor'] });
    assert.deepEqual(codigos(outroAviao.avaliacao.bloqueios), []);
    const outroHorario = agendar(emVoo(), { amb, escolhas: { aluno: 1001, recurso: 'PR-VOB', horario: 500, instrutor: 2 }, tocados: ['recurso', 'horario', 'instrutor'] });
    assert.deepEqual(codigos(outroHorario.avaliacao.bloqueios), []);
  });

  it('os recursos livres são do mesmo tipo: trocar de tipo muda os horários, o peso e a habilitação, e fica com o operador', () => {
    // Entre os C152, só o PR-VOB (os outros em manutenção), e ele está em voo às 06:30; os outros tipos estão livres
    const estado = { ...emVoo(), av: Object.fromEntries(Object.entries(emVoo().av).map(([r, v]) => [r, apenas('C152', 'PR-VOB').includes(r) ? false : v])) };
    const { formulario: f, avaliacao } = agendar(estado, { amb, escolhas: { aluno: 1001, recurso: 'PR-VOB', horario: 390 }, tocados: ['recurso', 'horario'] });
    assert.ok(f.recursos.some(o => o.tipo !== 'C152' && !o.desligada), 'há outro tipo livre no horário');
    assert.deepEqual(alternativas(avaliacao.bloqueios[0]).map(([rotulo]) => rotulo), ['Horários livres']);
  });

  it('a alternativa escolhida muda só o campo dela: os outros ficam como o formulário os mostra, e o valor que ele trocou não volta', () => {
    // O operador escolheu antes uma turma de Ground (o Voo Local não tem turma: o formulário escolheu um instrutor) e o PR-VOB,
    // ocupado às 06:30
    const escolhas = { aluno: 1001, missao: 'tipo:Voo Local', recurso: 'PR-VOB', horario: 390, instrutor: 'turma:GND_X' };
    const tocados = new Set(['missao', 'recurso', 'horario', 'instrutor']);
    const { formulario: f, avaliacao } = agendar(emVoo(), { amb, escolhas, tocados: [...tocados] });
    assert.ok(Number.isInteger(f.instrutor) && codigos(avaliacao.bloqueios).includes('aviao-ocupado'));
    const horario = escolhasDaAlternativa(f, escolhas, tocados, 'horario:500');
    assert.deepEqual(horario.escolhas, { aluno: 1001, missao: 'tipo:Voo Local', recurso: 'PR-VOB', horario: 500, instrutor: f.instrutor });
    assert.deepEqual([...horario.tocados].sort(), ['horario', 'instrutor', 'missao', 'recurso']);
    assert.deepEqual(escolhasDaAlternativa(f, escolhas, tocados, 'recurso:PP-LJV').escolhas, { ...escolhas, recurso: 'PP-LJV', instrutor: f.instrutor });
    assert.equal(escolhas.instrutor, 'turma:GND_X', 'as escolhas de antes não mudam');
    for (const valor of ['disponibilizar', 'horario:', 'horario:x', 'instrutor:1a', 'aluno:1000']) assert.equal(escolhasDaAlternativa(f, escolhas, tocados, valor), null, valor);
    // Num dia sorteado, cada alternativa de cada bloqueio, escolhida assim, resolve o bloqueio dela e não muda outro campo
    // (o PR-VOY, em manutenção, às 08:20, que não é um horário do C172: o formulário mostra as 06:30)
    const campos = ff => ({ missao: ff.missao, horario: ff.horario, recurso: ff.recurso, instrutor: ff.instrutor });
    let vistas = 0;
    const dia = gerarCenario(8);
    for (const s of dia.stu) [s, ...(s.extra || [])].forEach(normalizeMissionFields);
    for (const stu of dia.stu.filter(s => [1001, 1005].includes(s.id))) {
      for (const [r, a] of [['PR-VOY', 500], ['PR-VOB', 390]]) {
        const tentativa = { aluno: stu.id, recurso: r, horario: a };
        const feito = agendar(dia, { escolhas: tentativa, tocados: ['recurso', 'horario'] });
        if (r === 'PR-VOY') assert.equal(feito.formulario.horario, 390, 'as 08:20 não estão nos horários do C172');
        for (const b of (feito.avaliacao.bloqueios || []).filter(x => x.alternativas)) {
          for (const o of b.alternativas.flatMap(g => g.opcoes)) {
            const nova = escolhasDaAlternativa(feito.formulario, tentativa, new Set(['recurso', 'horario']), o.opcao);
            const depois = agendar(dia, { escolhas: nova.escolhas, tocados: [...nova.tocados] });
            const [campo, ...valor] = o.opcao.split(':');
            const esperado = { ...campos(feito.formulario), [campo]: campo === 'recurso' ? valor.join(':') : +valor.join(':') };
            assert.deepEqual(campos(depois.formulario), esperado, `${stu.id}: ${b.codigo} → ${o.opcao}`);
            const novo = depois.sim.out.find(v => v.fKey === depois.fKey);
            assert.ok(!(novo.conflitoCodigos || []).includes(b.codigo), `${stu.id}: ${o.opcao} resolve ${b.codigo}`);
            vistas++;
          }
        }
      }
    }
    assert.ok(vistas >= 6, `${vistas} alternativas`);
  });

  it('o peso acima do limite: os instrutores com peso informado que cabem nele', () => {
    const estado = doDia({ ins: [instrutor(1, 9, { kg: 95 }), instrutor(2, 9, { kg: 110 }), instrutor(3, 9, { kg: 55 }), instrutor(4, 9, { kg: 0 })] });
    const { avaliacao } = agendar(estado, { amb, escolhas: { aluno: 1001, kgAluno: '120', instrutor: 2 }, tocados: ['kgAluno', 'instrutor'] });
    const peso = avaliacao.bloqueios.find(b => b.codigo === 'peso');
    assert.deepEqual(alternativas(peso), [['Instrutores que cabem no peso', [['instrutor:3', 'Instrutor 03 (55 kg)']]]]);
  });
});

describe('Agendamento: a prévia e o rodízio', () => {
  it('a prévia tem até 8 linhas dos outros voos, mais "e mais N"', () => {
    // Um dia sorteado em que o voo novo das 06:30 muda muitos voos de lugar
    const estado = gerarCenario(2);
    for (const s of estado.stu) [s, ...(s.extra || [])].forEach(normalizeMissionFields);
    const { avaliacao } = agendar(estado, { amb: ambiente(), escolhas: { aluno: 1005, missao: 'tipo:Voo Local', horario: 390 }, tocados: ['missao', 'horario'] });
    const { linhas, movidos, saem, entram } = avaliacao.previa;
    const outras = movidos.length + saem.length + entram.length;
    assert.ok(outras > 8, `${outras} voos mudam`);
    assert.equal(linhas.length, 10);
    assert.match(linhas[0], /^Entra: Aluno 04 · Voo Local · 06:30–07:30 · /);
    linhas.slice(1, 9).forEach(l => assert.match(l, /^(Aluno \d+( \(.+\))?: .+ → .+|Sai: .+|Entra: .+)$/, l));
    assert.equal(linhas[9], `e mais ${outras - 8}`);
  });

  it('a prévia diz o voo que sai da escala com o motivo, e "Nenhum outro voo muda." sem mudança', () => {
    // Um instrutor só: o Aluno 1000 só pode às 06:30 e sai quando o 1001 fica com o instrutor às 06:30
    const estado = doDia({ ins: [instrutor(1, 9)], s1000: { jan: 'h390' } });
    const { avaliacao } = agendar(estado, { amb: ambiente({ registros: aprovadas(1001, ['IN-01']) }), escolhas: { aluno: 1001, horario: 390 }, tocados: ['horario'] });
    assert.match(avaliacao.previa.linhas[0], /^Entra: Aluno 1001 · Voo Local · 06:30–07:30 · /);
    assert.match(avaliacao.previa.linhas[1], /^Sai: Aluno 1000 \(.+\)$/);
    // Na escala aprovada, nenhum outro voo muda
    const aprovada = doDia();
    aprovada.fixos = fixosAoAprovar({}, runAllocationEngine(aprovada).out);
    aprovada.aprovacao = { em: '2026-11-10T20:00:00.000Z', por: '' };
    const livre = agendar(aprovada, { amb: ambiente({ registros: aprovadas(1001, ['IN-01']) }), escolhas: { aluno: 1001, horario: 610 }, tocados: ['horario'] }).avaliacao;
    assert.deepEqual(livre.previa.linhas.slice(1), ['Nenhum outro voo muda.']);
  });

  it('a nota do rodízio diz de quem é a vez na fila da categoria', () => {
    const estado = doDia();
    delete estado.stu[1].curso;
    const noturno = escolhas => agendar(estado, { escolhas: { aluno: 1001, missao: 'tipo:Noturno', ...escolhas }, tocados: ['missao', ...Object.keys(escolhas)] }).avaliacao.notas.find(n => n.codigo === 'rodizio');
    assert.equal(noturno({}).texto, 'Na fila do rodízio (Voo noturno), a vez é de Instrutor 01.');
    estado.filas = { noturno: [2, 1] };
    assert.equal(noturno({ instrutor: 1 }).texto, 'Na fila do rodízio (Voo noturno), a vez é de Instrutor 02.');
    // Fora das categorias do rodízio (o Voo Local no C152), nenhuma nota
    assert.equal(agendar(estado, { escolhas: { aluno: 1001, missao: 'tipo:Voo Local' }, tocados: ['missao'] }).avaliacao.notas.find(n => n.codigo === 'rodizio'), undefined);
  });
});

describe('Agendamento: o que a missão do curso exige do INVA', () => {
  // O PP com PE-04 exigindo Endosso Solo (regra a: nenhum INVA tem, até o Pedro marcar)
  const PP_EXIGE = { ...PP, missoes: PP.missoes.map(m => (m.codigo === 'PE-04' ? { ...m, exige: ['endosso_solo'] } : m)) };
  const amb = () => ambiente({ programa: [PP_EXIGE] });
  // A simulação é a escala que fica: o mesmo agendamento gravado no estado e a escala com as exigências derivadas
  const depoisDeGravar = (estado, proposta) => {
    const gravado = structuredClone(estado);
    aplicarAgendamento(gravado, null, proposta);
    return runAllocationEngine(comExigenciasDasMissoes(gravado, [PP_EXIGE]));
  };
  const conflitos = (res, fKey) => (res.out.find(o => o.fKey === fKey) || {}).conflitoCodigos || [];

  it('a missão do curso escolhida exige do INVA: sem quem tenha, o diálogo bloqueia, como a escala gravada', () => {
    const estado = doDia();
    const { formulario, sim, fKey, avaliacao } = agendar(comExigenciasDasMissoes(estado, [PP_EXIGE]), { amb: amb(), escolhas: { aluno: 1001, missao: 'missao:PP:PE-04' }, tocados: ['missao'] });
    assert.deepEqual(formulario.selecao.exige, ['endosso_solo']);
    assert.deepEqual(conflitos(sim, fKey), ['habilitacao']);
    assert.deepEqual(conflitos(depoisDeGravar(estado, formulario.proposta), fKey), ['habilitacao']);
    const bloqueio = avaliacao.bloqueios.find(b => b.codigo === 'habilitacao');
    assert.ok(bloqueio, avaliacao.bloqueios.map(b => b.codigo).join());
    assert.equal(bloqueio.texto, 'O instrutor não tem a habilitação que a missão do curso exige (Endosso Solo).');
    // Com o INVA 02 habilitado, ele é o padrão e nada bloqueia
    const habilitado = doDia({ ins: [instrutor(1, 9), { ...instrutor(2, 9), hab: [...instrutor(2, 9).hab, 'endosso_solo'] }] });
    const ok = agendar(comExigenciasDasMissoes(habilitado, [PP_EXIGE]), { amb: amb(), escolhas: { aluno: 1001, missao: 'missao:PP:PE-04' }, tocados: ['missao'] });
    assert.equal(ok.formulario.proposta.insId, 2);
    assert.deepEqual(ok.avaliacao.bloqueios, []);
  });

  it('o pedido que não voa e guarda uma missão do curso não leva a exigência dela para o voo novo de outro tipo', () => {
    const estado = doDia({ s1001: { etapa: 'PE-04', cursoDaEtapa: 'PP' } });
    const derivado = comExigenciasDasMissoes(estado, [PP_EXIGE]);
    assert.deepEqual(derivado.stu[1].exige, ['endosso_solo']);
    const { formulario, sim, fKey, avaliacao } = agendar(derivado, { amb: amb(), escolhas: { aluno: 1001, missao: 'tipo:Voo Local' }, tocados: ['missao'] });
    assert.deepEqual(formulario.selecao.exige, []);
    assert.deepEqual(conflitos(sim, fKey), []);
    assert.deepEqual(conflitos(depoisDeGravar(estado, formulario.proposta), fKey), []);
    assert.equal(avaliacao.bloqueios.find(b => b.codigo === 'habilitacao'), undefined);
  });
});
