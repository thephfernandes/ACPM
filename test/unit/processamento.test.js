// A importação dos pedidos da agenda para a demanda da data (js/processamento.js): cada pedido vira um voo, no lugar do
// voo da mesma missão posto à mão ou numa missão nova; o aluno de um curso entra com a missão do programa
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { importarSolicitacoes } from '../../js/processamento.js';
import { normalizarCursos } from '../../js/cursos.js';
import { programaDoLegado, percursoDoCurso, novoCurso } from '../../js/programa.js';
import { MODELOS } from '../../js/modelos-de-curso.js';
import { runAllocationEngine } from '../../js/engine.js';
import { blank } from '../../js/rules.js';
import { setS } from '../../js/state.js';
import { programaParaInferir } from '../../js/views/etapas.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';
import { ligarFuncionalidades } from '../helpers/funcionalidades.js';

// O cronograma do PP (o modelo do app, com o Noturno em trechos) como o curso PP, com os ids tirados da sigla e da chave
const cursoPP = () => novoCurso([], { sigla: 'PP', nome: 'Piloto Privado', modelo: MODELOS['pp-acpm'] }, (s, c) => `${s}:${c}`).curso;

describe('Importar as solicitações da agenda para a demanda', () => {
  afterEach(() => ligarFuncionalidades());
  const pedido = (id, alunoId, extra = {}) => ({ id, data: '2026-11-11', aluno: alunoId, aluno_nome: `Aluno ${alunoId}`, missao: 'Voo Local', janela: 'tarde', horario: null, cancelada_em: null, ...extra });
  const estado = () => ({ nid: 2000, importadas: [], stu: [aluno(1000, { fly: false }), aluno(1001, { mis: 'IFR', eq: 'C172' }), aluno(1002)] });
  // O programa do cadastro (a lista de missões de cada curso) no formato dos cursos, como a tela o passa
  const doCadastro = cursos => programaDoLegado(normalizarCursos(cursos), (s, c) => `${s}:${c}`);

  it('aluno sem voo no dia: o pedido vira a missão principal', () => {
    const e = estado();
    const resumo = importarSolicitacoes(e, [pedido(1, 1000)]);
    assert.deepEqual(resumo, { novos: 1, atualizados: 0, semAluno: 0, deInativo: 0, foraDoPrograma: [], semMissaoDoCurso: [], esperamOsProgramas: 0 });
    assert.deepEqual([e.stu[0].fly, e.stu[0].mis, e.stu[0].jan, e.stu[0].p1], [true, 'Voo Local', 'tarde', 760]);
    assert.deepEqual(e.importadas, [1]);
  });

  // Q8 (F1d): o pedido com o 7º voo local confirmado na Agenda (limite_confirmado_por e _em) entra com
  // limiteConfirmado: true; o que não foi confirmado, sem o campo. O voo à mão que dá lugar ao pedido fica com o do pedido
  it('o 7º voo local confirmado entra com limiteConfirmado; o voo que dá lugar ao pedido perde o de antes', () => {
    const e = estado();
    const confirmado = { janela: 'horario', horario: '08:20', limite_confirmado_por: 'Maria', limite_confirmado_em: '2026-11-10T14:00:00.000Z' };
    importarSolicitacoes(e, [pedido(1, 1000, confirmado), pedido(2, 1001)]);
    assert.deepEqual([e.stu[0].limiteConfirmado, e.stu[0].jan], [true, 'h500']);
    assert.equal(Object.hasOwn(e.stu[1].extra[0], 'limiteConfirmado'), false);
    const outro = estado();
    outro.stu[2].limiteConfirmado = true;
    importarSolicitacoes(outro, [pedido(3, 1002, { janela: 'horario', horario: '10:10' })]);
    assert.deepEqual([outro.stu[2].solicitacao, Object.hasOwn(outro.stu[2], 'limiteConfirmado')], [3, false]);
  });

  it('aluno já voando outra missão: o pedido entra como missão extra', () => {
    const e = estado();
    importarSolicitacoes(e, [pedido(2, 1001)]);
    assert.equal(e.stu[1].mis, 'IFR', 'a missão que ele já tinha continua');
    // A missão extra é numerada no aluno: o número do cadastro (nid) não muda
    assert.deepEqual(e.stu[1].extra.map(x => [x.mid, x.mis, x.jan]), [[1, 'Voo Local', 'tarde']]);
    assert.equal(e.nid, 2000);
  });

  it('aluno já voando a mesma missão (copiada da data anterior, sem pedido da agenda): o pedido toma o lugar dela', () => {
    const e = estado();
    const resumo = importarSolicitacoes(e, [pedido(3, 1002)]);
    assert.deepEqual(resumo, { novos: 0, atualizados: 1, semAluno: 0, deInativo: 0, foraDoPrograma: [], semMissaoDoCurso: [], esperamOsProgramas: 0 });
    assert.deepEqual([e.stu[2].jan, e.stu[2].p1, e.stu[2].solicitacao, e.stu[2].extra], ['tarde', 760, 3, []]);
  });

  it('dois pedidos da mesma missão para o mesmo aluno: dois voos, cada um no seu horário', () => {
    const e = estado();
    const pedidos = [pedido(10, 1002, { janela: 'horario', horario: '10:10' }), pedido(11, 1002, { janela: 'horario', horario: '14:30' })];
    const resumo = importarSolicitacoes(e, pedidos);
    assert.deepEqual(resumo, { novos: 1, atualizados: 1, semAluno: 0, deInativo: 0, foraDoPrograma: [], semMissaoDoCurso: [], esperamOsProgramas: 0 });
    const voos = [e.stu[2], ...e.stu[2].extra];
    assert.deepEqual(voos.map(v => [v.mis, v.jan, v.solicitacao, v.fly]), [['Voo Local', 'h610', 10, true], ['Voo Local', 'h870', 11, true]]);
  });

  it('aluno de um curso: quando a próxima missão dele é do tipo pedido, o pedido já entra como ela (código, recurso e horas)', () => {
    const programa = { PP: [{ id: 'PP-01', nome: 'A', mis: 'Voo Local', eq: 'C152', nb: 1 }, { id: 'PP-02', nome: 'B', mis: 'Navegação', eq: 'C172', nb: 2 }], PC: [], INVA: [] };
    const e = { ...estado(), stu: [aluno(1000, { fly: false }, { curso: 'PP' }), aluno(1001, { fly: false }, { curso: 'PP' })] };
    const situacao = [{ aluno: 1000, curso: 'PP', missao: 'PP-01', resultado: 'aprovado' }];
    importarSolicitacoes(e, [pedido(7, 1000, { missao: 'Navegação' }), pedido(8, 1001, { missao: 'Navegação' })], { situacao, programa: doCadastro(programa) });
    assert.deepEqual([e.stu[0].etapa, e.stu[0].eq, e.stu[0].nb], ['PP-02', 'C172', 2]);
    assert.deepEqual([e.stu[1].etapa, e.stu[1].mis], [undefined, 'Navegação'], 'a próxima do 1001 é PP-01 (Voo Local): o pedido entra como veio');
  });

  it('ignora cancelados e os já importados; conta os alunos que não estão no cadastro', () => {
    const e = { ...estado(), importadas: [5] };
    const resumo = importarSolicitacoes(e, [pedido(4, 1000, { cancelada_em: '2026-11-10T13:00:00Z' }), pedido(5, 1000), pedido(6, 9999)]);
    assert.deepEqual(resumo, { novos: 0, atualizados: 0, semAluno: 1, deInativo: 0, foraDoPrograma: [], semMissaoDoCurso: [], esperamOsProgramas: 0 });
    assert.equal(e.stu[0].fly, false);
    // O pedido de quem não está no cadastro não conta como visto (entra quando o aluno for cadastrado)
    assert.deepEqual(e.importadas, [5]);
  });

  // A agenda guarda a duração; o pedido sem ela fica com 1 h ou as horas do curso
  it('a duração do pedido vai para a demanda (vale mais que as horas do programa do curso)', () => {
    const programa = { PP: [{ id: 'PP-01', nome: 'A', mis: 'Voo Local', eq: 'C152', nb: 2 }], PC: [], INVA: [] };
    const e = { ...estado(), stu: [aluno(1000, { fly: false }, { curso: 'PP' }), aluno(1001, { fly: false }, { curso: 'PP' })] };
    importarSolicitacoes(e, [pedido(20, 1000, { janela: 'horario', horario: '10:10', horas: 2.6 }), pedido(21, 1001, { janela: 'horario', horario: '10:10', horas: null })], { programa: doCadastro(programa) });
    assert.deepEqual([e.stu[0].nb, e.stu[0].etapa, e.stu[1].nb, e.stu[1].etapa], [2.6, 'PP-01', 2, 'PP-01']);
  });

  it('missão do curso noutro recurso: as preferências são os horários desse recurso, na disponibilidade pedida', () => {
    const programa = { PP: [], PC: [{ id: 'PC-01', nome: 'A', mis: 'IFR', eq: 'PA-34', nb: 1 }], INVA: [] };
    const e = { ...estado(), stu: [aluno(1000, { fly: false }, { curso: 'PC' })] };
    importarSolicitacoes(e, [pedido(9, 1000, { missao: 'IFR', janela: 'manha' })], { programa: doCadastro(programa) });
    assert.deepEqual([e.stu[0].etapa, e.stu[0].eq, e.stu[0].p1, e.stu[0].p2], ['PC-01', 'PA-34', 390, 420]);
  });

  // O recurso que a secretaria escolheu na agenda vale: o avião, os horários e as preferências são os dele
  it('o pedido com recurso entra com ele; sem ele, ou com um que a missão não permite, com o padrão da missão', () => {
    const e = { ...estado(), stu: [aluno(1000, { fly: false }), aluno(1001, { fly: false }), aluno(1002, { fly: false })] };
    const nav = (id, quem, recurso) => pedido(id, quem, { missao: 'Navegação', janela: 'horario', horario: '07:30', horas: 2, ...(recurso === undefined ? {} : { recurso }) });
    importarSolicitacoes(e, [nav(50, 1000, 'PA-34'), nav(51, 1001), nav(52, 1002, 'Sim. Multi')]);
    assert.deepEqual(e.stu.map(s => [s.eq, s.p1, s.jan, s.nb]), [['PA-34', 450, 'h450', 2], ['C152', 500, 'h450', 2], ['C152', 500, 'h450', 2]]);
    for (const s of e.stu) assert.equal(Object.hasOwn(s, 'recurso'), false, 'o pedido da demanda não ganha o campo');
  });

  it('com o recurso, a missão do curso só é inferida entre as desse recurso; sem ele, a primeira do tipo, como antes', () => {
    const programa = doCadastro({
      PP: [{ id: 'NAV-01', nome: 'A', mis: 'Navegação', eq: 'C152', nb: 1.5 }, { id: 'NAV-02', nome: 'B', mis: 'Navegação', eq: 'C172', nb: 2 }], PC: [], INVA: []
    }).map(c => ({ ...c, missoes: c.missoes.map(m => ({ ...m, regra: 'livre' })) }));
    const importar = recurso => {
      const e = { ...estado(), stu: [aluno(1000, { fly: false }, { curso: 'PP' })] };
      importarSolicitacoes(e, [pedido(53, 1000, { missao: 'Navegação', janela: 'manha', ...(recurso === undefined ? {} : { recurso }) })], { programa });
      return [e.stu[0].etapa, e.stu[0].eq, e.stu[0].nb];
    };
    assert.deepEqual(importar(undefined), ['NAV-01', 'C152', 1.5]);
    assert.deepEqual(importar(null), ['NAV-01', 'C152', 1.5]);
    assert.deepEqual(importar('C152'), ['NAV-01', 'C152', 1.5]);
    assert.deepEqual(importar('C172'), ['NAV-02', 'C172', 2]);
    assert.deepEqual(importar('PA-34'), [undefined, 'PA-34', 1], 'nenhuma missão do curso no PA-34: entra como veio');
    assert.deepEqual(importar('Sim. Mono'), ['NAV-01', 'C152', 1.5], 'o recurso que a missão não permite não conta');
  });

  it('a missão do curso que o operador pôs no voo continua com o recurso dela, qualquer que seja o do pedido', () => {
    const e = { ...estado(), stu: [aluno(1000, { mis: 'Navegação', eq: 'C172', nb: 2, etapa: 'NAV-02', cursoDaEtapa: 'PP' }, { curso: 'PP' })] };
    importarSolicitacoes(e, [pedido(54, 1000, { missao: 'Navegação', janela: 'manha', recurso: 'PA-34' })]);
    assert.deepEqual([e.stu[0].etapa, e.stu[0].eq, e.stu[0].nb], ['NAV-02', 'C172', 2]);
  });

  // No programa em fases, várias missões podem estar liberadas: o pedido entra como a primeira do tipo pedido (o Noturno
  // em trechos, pela noite: o bloco de 4 h às 17:30, o translado e o noturno em BH); nenhuma liberada do tipo (fora da
  // ordem, ou fora do programa), ele entra como veio, com a duração da missão: o simulador, as 2 h de padrão
  it('aluno de um curso em fases: a primeira missão liberada do tipo pedido; fora da ordem, nenhuma', () => {
    // As fases 1 a 4 aprovadas (as 13 primeiras missões do curso): o Voo Solo (na Fase 7) ainda está fora da ordem
    const PP = cursoPP();
    const situacao = percursoDoCurso(PP).missoes.slice(0, 13).map((m, i) => ({ id: i + 1, aluno: 1000, curso: 'PP', missao: m.codigo, resultado: 'aprovado' }));
    const e = { ...estado(), stu: [aluno(1000, { fly: false }, { curso: 'PP' })] };
    importarSolicitacoes(e, [pedido(30, 1000, { missao: 'Parafuso' }), pedido(31, 1000, { missao: 'Navegação' }), pedido(32, 1000, { missao: 'Noturno' }),
      pedido(33, 1000, { missao: 'Simulador' }), pedido(39, 1000, { missao: 'Voo Solo' })], { situacao, programa: [PP] });
    assert.deepEqual([e.stu[0], ...e.stu[0].extra].map(p => [p.mis, p.etapa, p.eq, p.nb]), [
      ['Parafuso', 'PE-04', 'C152', 1], ['Navegação', 'NAV-01', 'C152', 1.5], ['Noturno', 'NOT', 'C172', 4], ['Simulador', undefined, 'Sim. Mono', 2],
      ['Voo Solo', undefined, 'C152', 1]
    ]);
    const noturno = e.stu[0].extra.find(p => p.mis === 'Noturno');
    assert.deepEqual([noturno.p1, noturno.p2], [1050, -1], 'o Noturno sai às 17:30');
  });

  // O curso da missão vai com o código: o resultado vai para ele, mesmo que o aluno troque de curso no mesmo dia
  it('o pedido que entra como missão do curso leva o curso dela; o que entra como veio, nenhum', () => {
    const PP = cursoPP();
    const situacao = percursoDoCurso(PP).missoes.slice(0, 13).map((m, i) => ({ id: i + 1, aluno: 1000, curso: 'PP', missao: m.codigo, resultado: 'aprovado' }));
    const e = { ...estado(), stu: [aluno(1000, { fly: false }, { curso: 'PP' }), aluno(1001, { fly: false })] };
    importarSolicitacoes(e, [pedido(34, 1000, { missao: 'Parafuso' }), pedido(35, 1000, { missao: 'Simulador' }), pedido(36, 1001)], { situacao, programa: [PP] });
    assert.deepEqual([e.stu[0], ...e.stu[0].extra, e.stu[1]].map(p => [p.mis, p.etapa, p.cursoDaEtapa]),
      [['Parafuso', 'PE-04', 'PP'], ['Simulador', undefined, undefined], ['Voo Local', undefined, undefined]]);
    assert.equal(Object.hasOwn(e.stu[0].extra[0], 'cursoDaEtapa'), false);
  });

  // A escolha do operador vale mais que a do app: a missão do curso que o operador pôs no voo ("Outra missão do curso",
  // Usar), sem voo fixo, continua quando o pedido da agenda da mesma missão toma o lugar dele. Antes, o pedido entrava
  // como a primeira liberada do tipo (a NAV-01 no lugar da NAV-02 escolhida), e a escolha se perdia
  it('a missão do curso escolhida no voo que dá lugar ao pedido da agenda continua a dele, com o curso, o recurso e as horas', () => {
    const PP = cursoPP();
    const situacao = percursoDoCurso(PP).missoes.slice(0, 13).map((m, i) => ({ id: i + 1, aluno: 1000, curso: 'PP', missao: m.codigo, resultado: 'aprovado' }));
    const e = { ...estado(), stu: [aluno(1000, { mis: 'Navegação', eq: 'C152', nb: 1.5, etapa: 'NAV-02', cursoDaEtapa: 'PP', insId: 2 }, { curso: 'PC' })] };
    const resumo = importarSolicitacoes(e, [pedido(37, 1000, { missao: 'Navegação', janela: 'manha' })], { situacao, programa: [PP] });
    assert.deepEqual(resumo, { novos: 0, atualizados: 1, semAluno: 0, deInativo: 0, foraDoPrograma: [], semMissaoDoCurso: [], esperamOsProgramas: 0 });
    const p = e.stu[0];
    assert.deepEqual([p.etapa, p.cursoDaEtapa, p.eq, p.nb, p.solicitacao, p.jan, p.insId, p.extra], ['NAV-02', 'PP', 'C152', 1.5, 37, 'manha', 2, []]);
    // Sem os programas lidos, a escolha também continua (ela não é inferida); a duração registrada na agenda vale mais
    const semPrograma = { ...estado(), stu: [aluno(1000, { mis: 'Navegação', eq: 'C172', nb: 2, etapa: 'TSL-01' }, { curso: 'PP' })] };
    importarSolicitacoes(semPrograma, [pedido(38, 1000, { missao: 'Navegação', horas: 1.2 })], { programa: [] });
    const q = semPrograma.stu[0];
    assert.deepEqual([q.etapa, Object.hasOwn(q, 'cursoDaEtapa'), q.eq, q.nb, q.solicitacao], ['TSL-01', false, 'C172', 1.2, 38]);
  });

  it('sem programa (os resultados ou os programas não foram lidos), nenhum pedido entra como missão do curso', () => {
    const e = { ...estado(), stu: [aluno(1000, { fly: false }, { curso: 'PP' })] };
    importarSolicitacoes(e, [pedido(40, 1000)], { programa: [] });
    assert.deepEqual([e.stu[0].fly, e.stu[0].etapa], [true, undefined]);
  });

  // A missão de um voo cancelado não conta como já marcada no dia
  it('as missões dos outros voos do dia contam como feitas; a do voo cancelado, não', () => {
    const programa = { PP: [{ id: 'PP-01', nome: 'A', mis: 'Voo Local', eq: 'C152', nb: 1 }, { id: 'PP-02', nome: 'B', mis: 'Navegação', eq: 'C152', nb: 2 }] };
    const importar = fStatus => {
      const e = { ...estado(), fStatus, stu: [aluno(1000, { etapa: 'PP-01' }, { curso: 'PP' })] };
      importarSolicitacoes(e, [pedido(50, 1000, { missao: 'Navegação' })], { programa: doCadastro(programa) });
      return e.stu[0].extra.map(x => [x.mis, x.etapa]);
    };
    assert.deepEqual(importar({}), [['Navegação', 'PP-02']]);
    assert.deepEqual(importar({ '1000_0_1': 'Cancelado' }), [['Navegação', undefined]], 'a PP-01 ainda falta');
  });

  // A sonda do juiz (sonda-agenda.mjs): o voo agendado na escala é o pedido com o voo fixo, sem pedido da agenda. Ele não
  // é a "mesma missão copiada": o pedido da agenda o sobrescrevia, e o voo fixo ficava em conflito (fora da
  // disponibilidade, a duração mudou)
  it('o voo fixo não dá lugar ao pedido da agenda: o pedido vira outro voo, e o fixo fica onde estava', () => {
    const e = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 610, p2: -1, etapa: 'PP-07' })] });
    const o = runAllocationEngine(e).out[0];
    e.fixos = { '1000_0_1': { a: o.a, b: o.b, r: o.r, insId: o.insId, agendado: true } };
    const resumo = importarSolicitacoes(e, [pedido(7, 1000, { janela: 'horario', horario: '13:40', horas: 2 })]);
    assert.deepEqual(resumo, { novos: 1, atualizados: 0, semAluno: 0, deInativo: 0, foraDoPrograma: [], semMissaoDoCurso: [], esperamOsProgramas: 0 });
    const principal = e.stu[0], [extra] = principal.extra;
    assert.deepEqual([principal.p1, principal.nb, principal.etapa, principal.solicitacao], [610, 1, 'PP-07', undefined]);
    assert.deepEqual([extra.mid, extra.mis, extra.p1, extra.nb, extra.solicitacao], [1, 'Voo Local', 820, 2, 7]);
    const { out } = runAllocationEngine(e);
    assert.deepEqual(out.map(v => [v.fKey, v.a, Boolean(v.fixo), v.conflito || []]), [['1000_0_1', 610, true, []], ['1000_1_1', 820, false, []]]);
  });

  // O voo que já tem resultado na data aconteceu: o pedido da agenda que tomasse o lugar dele mostraria o resultado dele
  it('o voo que já tem resultado na data também não dá lugar ao pedido da agenda', () => {
    const e = { ...estado(), resultados: { situacao: [], doDia: [{ id: 1, aluno: 1002, curso: 'PP', missao: 'PP-01', resultado: 'aprovado', data: '2026-11-11', voo: '1002_0_1' }] } };
    importarSolicitacoes(e, [pedido(3, 1002)]);
    assert.deepEqual([e.stu[2].solicitacao, e.stu[2].extra.map(x => [x.mid, x.mis, x.solicitacao])], [undefined, [[1, 'Voo Local', 3]]]);
  });

  // Em voo, atrasado, pousado ou cancelado, o voo fica onde está mesmo sem o cadeado (a aprovação da escala tira o cadeado
  // do voo que estava com o Voa desligado, e ele volta a voar sem ele): o pedido da agenda que tomasse o lugar dele
  // entraria cancelado ou em voo. Pendente e Confirmado não fixam o voo
  it('o voo fixado pelo status, mesmo sem o cadeado, também não dá lugar ao pedido da agenda', () => {
    const importar = status => {
      const e = { ...estado(), fStatus: { '1002_0_1': status } };
      importarSolicitacoes(e, [pedido(12, 1002)]);
      return [e.stu[2].solicitacao, e.stu[2].extra.map(x => [x.mid, x.solicitacao])];
    };
    for (const status of ['Em Voo', 'Atrasado', 'Pousou', 'Cancelado']) assert.deepEqual(importar(status), [undefined, [[1, 12]]], status);
    for (const status of ['Pendente', 'Confirmado']) assert.deepEqual(importar(status), [12, []], status);
  });

  // A sonda do juiz (sonda-limpar.mjs), de antes de "Limpar demanda" soltar os voos que limpa: os pedidos voltavam ao
  // branco, e o voo fixo (o agendado) ficava preso à chave do pedido principal. O pedido da agenda que entrasse nele
  // herdaria o voo fixo de outra missão; o mesmo com o status, o detalhe ou o resultado de um voo que saiu da escala
  it('o pedido principal que não voa mas tem sobras no dia não recebe o pedido da agenda: ele vira uma missão extra', () => {
    const e = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] });
    e.fixos = { '1000_0_1': { a: 610, b: 670, r: 'PP-LJV', insId: 1, agendado: true } };
    e.stu.forEach(d => { Object.assign(d, blank()); delete d.insId; d.extra = []; });
    importarSolicitacoes(e, [pedido(8, 1000, { missao: 'Navegação', janela: 'horario', horario: '13:40', horas: 1.5 })]);
    assert.deepEqual([e.stu[0].fly, e.stu[0].extra.map(x => [x.mid, x.mis, x.solicitacao])], [false, [[1, 'Navegação', 8]]]);
    const { out } = runAllocationEngine(e);
    assert.deepEqual(out.map(v => [v.fKey, v.mis, v.a, Boolean(v.fixo), v.conflito || []]), [['1000_1_1', 'Navegação', 820, false, []]]);

    const sobras = [{ fStatus: { '1000_0_1': 'Cancelado' } }, { fObs: { '1000_0_1': { motivo: 'Meteorologia' } } },
      { resultados: { situacao: [], doDia: [{ id: 1, aluno: 1000, curso: 'PP', missao: 'PP-01', resultado: 'reprovado', data: '2026-11-11', voo: '1000_0_1' }] } }];
    for (const sobra of sobras) {
      const comSobra = { ...estado(), ...sobra };
      importarSolicitacoes(comSobra, [pedido(9, 1000)]);
      assert.deepEqual([comSobra.stu[0].fly, comSobra.stu[0].extra.map(x => [x.mid, x.solicitacao])], [false, [[1, 9]]], JSON.stringify(sobra));
    }
  });

  // O pedido principal que volta a voar com o pedido da agenda não traz nada do voo de antes (a disponibilidade, a missão
  // do curso, o pedido da agenda, o instrutor escolhido)
  it('o pedido principal que recebe o pedido da agenda começa em branco', () => {
    const e = { ...estado(), stu: [aluno(1000, { fly: false, mis: 'Navegação', eq: 'C172', nb: 2, pr: 1, jan: 'manha', etapa: 'PP-09', solicitacao: 99, insId: 1 }, { curso: 'PP' })] };
    importarSolicitacoes(e, [pedido(61, 1000, { janela: 'horario', horario: null })]);
    const p = e.stu[0];
    assert.deepEqual([p.fly, p.mis, p.eq, p.nb, p.pr, p.solicitacao, p.extra], [true, 'Voo Local', 'C152', 1, 3, 61, []]);
    assert.deepEqual(['jan', 'etapa', 'insId'].filter(campo => Object.hasOwn(p, campo)), []);
  });

  // O pedido posto à mão com a missão do curso (o Usar), da mesma missão do pedido da agenda, dá lugar a ele, e a missão do
  // curso continua no dia. Antes, a missão dele contava como já no dia: o pedido entrava como a seguinte, no lugar dele, e
  // a do Usar sumia do dia
  it('o voo da mesma missão posto à mão com a missão do curso dá lugar ao pedido da agenda, com a mesma missão do curso', () => {
    const programa = { PP: ['PP-01', 'PP-02'].map(id => ({ id, nome: id, mis: 'Voo Local', eq: 'C152', nb: 1 })) };
    const e = { ...estado(), stu: [aluno(1000, { etapa: 'PP-01', insId: 2 }, { curso: 'PP' })] };
    const resumo = importarSolicitacoes(e, [pedido(62, 1000, { janela: 'horario', horario: '13:40' }), pedido(63, 1000, { janela: 'horario', horario: '15:20' })],
      { programa: doCadastro(programa) });
    assert.deepEqual(resumo, { novos: 1, atualizados: 1, semAluno: 0, deInativo: 0, foraDoPrograma: [], semMissaoDoCurso: [], esperamOsProgramas: 0 });
    // O instrutor escolhido continua no voo; o segundo pedido é outro voo, a missão seguinte
    assert.deepEqual([e.stu[0].etapa, e.stu[0].solicitacao, e.stu[0].jan, e.stu[0].insId], ['PP-01', 62, 'h820', 2]);
    assert.deepEqual(e.stu[0].extra.map(x => [x.mid, x.etapa, x.solicitacao, x.insId]), [[1, 'PP-02', 63, undefined]]);
  });

  // O Noturno do programa (o NOT, com as 3 h do noturno em BH) é o bloco de 4 h às 17:30 do dia (o translado e o noturno;
  // a volta no dia seguinte), também com outra duração registrada na agenda
  it('a missão de duração fixa entra com ela: o NOT do programa com 4 h às 17:30; o Ground com 01h30', () => {
    const PP = cursoPP();
    const feitas = [...percursoDoCurso(PP).missoes.slice(0, 13).map(m => m.codigo), 'TSL-01'];
    const situacao = feitas.map((codigo, i) => ({ id: i + 1, aluno: 1000, curso: 'PP', missao: codigo, resultado: 'aprovado' }));
    const e = { ...estado(), stu: [aluno(1000, { fly: false }, { curso: 'PP' }), aluno(1001, { fly: false })] };
    importarSolicitacoes(e, [pedido(64, 1000, { missao: 'Noturno', janela: 'noite', horas: 3 }), pedido(65, 1001, { missao: 'Ground C152', janela: 'manha', horas: 2 })],
      { situacao, programa: [PP] });
    const [noturno, ground] = e.stu;
    assert.deepEqual([noturno.mis, noturno.etapa, noturno.eq, noturno.nb, noturno.p1, noturno.p2], ['Noturno', 'NOT', 'C172', 4, 1050, -1]);
    assert.deepEqual([ground.mis, ground.eq, ground.nb], ['Ground C152', 'Sala Ground', 1.5]);
  });

  // A Agenda importa com o programa da tela (programaParaInferir, em js/eventos/agenda.js): sem os resultados ou os
  // programas (ou com o progresso desligado), vazio. Nenhum pedido entra como missão do curso (antes, inferia de uma situação vazia: a primeira missão)
  it('sem os resultados ou os programas lidos, nenhum pedido entra como missão do curso', () => {
    const importar = indisponiveis => {
      setS({ stu: [], fStatus: {}, resultados: { situacao: [], doDia: [] }, programa: [cursoPP()], indisponiveis });
      const e = { ...estado(), stu: [aluno(1000, { fly: false }, { curso: 'PP' })] };
      importarSolicitacoes(e, [pedido(66, 1000)], { situacao: [], programa: programaParaInferir() });
      return e.stu[0].etapa;
    };
    ligarFuncionalidades('progresso');
    assert.equal(importar([]), 'IN-01');
    assert.equal(importar(['horas']), 'IN-01');
    for (const parte of ['resultados', 'cursos', 'cursos-pendentes']) assert.equal(importar([parte]), undefined, parte);
  });

  it('com o progresso desligado (js/funcionalidades.js), nenhum pedido novo entra como missão do curso, e o que já tem a missão fica com ela', () => {
    ligarFuncionalidades('');
    setS({ stu: [], fStatus: {}, resultados: { situacao: [], doDia: [] }, programa: [cursoPP()] });
    const comEtapa = aluno(1001, { mis: 'Voo Local', eq: 'C152', etapa: 'PP-07', cursoDaEtapa: 'PP' }, { curso: 'PP' });
    const e = { ...estado(), stu: [aluno(1000, { fly: false }, { curso: 'PP' }), comEtapa] };
    importarSolicitacoes(e, [pedido(67, 1000), pedido(68, 1001)], { situacao: [], programa: programaParaInferir() });
    assert.equal(e.stu[0].fly, true);
    assert.equal(e.stu[0].etapa, undefined);
    assert.deepEqual([e.stu[1].etapa, e.stu[1].cursoDaEtapa], ['PP-07', 'PP']);
    assert.deepEqual(e.importadas, [67, 68]);
  });
});

// O inativo do cadastro (formato 26): o pedido do aluno inativo não entra nem conta como visto, de hoje em diante
describe('Importar: o aluno inativo', () => {
  it('com semInativos, o pedido do aluno inativo fica de fora (fora de importadas) e é contado; sem, entra como antes', () => {
    const pedidoDe = (id, aluno) => ({ id, data: '2026-11-11', aluno, aluno_nome: `Aluno ${aluno}`, missao: 'Voo Local', janela: 'manha', horario: null, cancelada_em: null });
    const estado = () => {
      const e = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { fly: false }), aluno(1001, { fly: false }, { inativo: true })] });
      e.importadas = [];
      return e;
    };
    const com = estado();
    const resumo = importarSolicitacoes(com, [pedidoDe(1, 1000), pedidoDe(2, 1001)], { semInativos: true });
    assert.equal(resumo.novos, 1);
    assert.equal(resumo.deInativo, 1);
    assert.deepEqual(com.importadas, [1]);
    assert.equal(com.stu.find(s => s.id === 1001).fly, false);
    const sem = estado();
    assert.equal(importarSolicitacoes(sem, [pedidoDe(1, 1000), pedidoDe(2, 1001)]).novos, 2);
  });
});

// A missão do curso do pedido (F1c, a regra 8 da Agenda): na entrada, ela é a etapa do voo, com o curso dela, também com o
// progresso desligado; o recurso e as horas são os do pedido. A que saiu do programa ou mudou de tipo depois do registro
// não entra: o pedido entra pelo tipo da missão, com o aviso. Sem ela, o pedido entra como antes
describe('Importar: a missão do curso do pedido', () => {
  afterEach(() => ligarFuncionalidades());
  // Os ids das missões são uuid, como nos programas lidos
  let n = 0;
  const PP = novoCurso([], { sigla: 'PP', nome: 'Piloto Privado', modelo: MODELOS['pp-acpm'] }, () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`).curso;
  const idDe = codigo => PP.missoes.find(m => m.codigo === codigo).id;
  const pedido = (id, alunoId, extra = {}) => ({
    id, data: '2026-11-11', aluno: alunoId, aluno_nome: `Aluno ${alunoId}`, missao: 'Navegação', janela: 'horario', horario: '08:20', horas: 3, recurso: 'C152',
    cancelada_em: null, ...extra
  });
  const estado = stu => ({ nid: 2000, importadas: [], stu });

  it('com o progresso desligado, a missão do curso do pedido é a etapa do voo, com o curso dela, o recurso e as horas do pedido', () => {
    ligarFuncionalidades('');
    setS({ stu: [], fStatus: {}, resultados: { situacao: [], doDia: [] }, programa: [PP] });
    const e = estado([aluno(1000, { fly: false }, { curso: 'PC' })]);
    const resumo = importarSolicitacoes(e, [pedido(1, 1000, { missao_do_curso: idDe('NAV-150NM'), recurso: 'PA-34', horario: '07:30', horas: 2.5 })],
      { situacao: [], programa: programaParaInferir(), cursos: [PP] });
    assert.deepEqual(resumo, { novos: 1, atualizados: 0, semAluno: 0, deInativo: 0, foraDoPrograma: [], semMissaoDoCurso: [], esperamOsProgramas: 0 });
    const p = e.stu[0];
    assert.deepEqual([p.fly, p.mis, p.etapa, p.cursoDaEtapa, p.eq, p.nb, p.jan, p.p1, p.solicitacao], [true, 'Navegação', 'NAV-150NM', 'PP', 'PA-34', 2.5, 'h450', 450, 1]);
    // O Noturno do curso: as 4 h do dia às 17:30
    const n = estado([aluno(1001, { fly: false }, { curso: 'PP' })]);
    importarSolicitacoes(n, [pedido(2, 1001, { missao: 'Noturno', missao_do_curso: idDe('NOT'), recurso: 'C172', horario: '17:30', horas: 4 })], { cursos: [PP] });
    assert.deepEqual([n.stu[0].etapa, n.stu[0].eq, n.stu[0].nb, n.stu[0].p1], ['NOT', 'C172', 4, 1050]);
  });

  it('a missão do curso que saiu do programa, ou de outro tipo, não entra: o pedido entra pelo tipo, com o aviso', () => {
    const fora = { ...PP, missoes: PP.missoes.map(m => (m.codigo === 'NAV-150NM' ? { ...m, removida: true } : m.codigo === 'NAV-01' ? { ...m, mis: 'Voo Local' } : m)) };
    const e = estado([aluno(1000, { fly: false }, { curso: 'PP' }), aluno(1001, { fly: false }, { curso: 'PP' }), aluno(1002, { fly: false }, { curso: 'PP' })]);
    const resumo = importarSolicitacoes(e, [pedido(3, 1000, { missao_do_curso: idDe('NAV-150NM') }), pedido(4, 1001, { missao_do_curso: idDe('NAV-01') }),
      pedido(5, 1002, { missao_do_curso: '00000000-0000-4000-8000-000000000999' })], { cursos: [fora] });
    assert.deepEqual(resumo.foraDoPrograma, [{ missao: 'Navegação', entrouComo: null }, { missao: 'Navegação', entrouComo: null }, { missao: 'Navegação', entrouComo: null }]);
    assert.deepEqual(e.stu.map(s => [s.fly, s.mis, s.etapa, s.eq, s.nb]), [[true, 'Navegação', undefined, 'C152', 3], [true, 'Navegação', undefined, 'C152', 3], [true, 'Navegação', undefined, 'C152', 3]]);
    // Os programas lidos sem nenhum curso: a missão do curso não existe mais
    const semCursos = estado([aluno(1000, { fly: false }, { curso: 'PP' })]);
    assert.deepEqual(importarSolicitacoes(semCursos, [pedido(6, 1000, { missao_do_curso: idDe('NAV-150NM') })], { cursos: [] }).foraDoPrograma, [{ missao: 'Navegação', entrouComo: null }]);
  });

  // Os programas não lidos (cursos: null) não dizem se a missão do curso saiu: o pedido que tem uma espera, fora de
  // importadas, e entra com ela na importação depois de lidos; o que não tem nenhuma entra como antes
  it('sem os programas lidos (cursos: null), o pedido com a missão do curso espera e não conta como visto', () => {
    const e = estado([aluno(1000, { fly: false }, { curso: 'PP' }), aluno(1001, { fly: false })]);
    const resumo = importarSolicitacoes(e, [pedido(16, 1000, { missao_do_curso: idDe('NAV-150NM') }), pedido(17, 1001)], { cursos: null });
    assert.deepEqual(resumo, { novos: 1, atualizados: 0, semAluno: 0, deInativo: 0, foraDoPrograma: [], semMissaoDoCurso: [], esperamOsProgramas: 1 });
    assert.deepEqual(e.importadas, [17]);
    assert.deepEqual([e.stu[0].fly, e.stu[1].fly], [false, true]);
    // Lidos, ele entra com a missão do curso dele
    assert.equal(importarSolicitacoes(e, [pedido(16, 1000, { missao_do_curso: idDe('NAV-150NM') })], { cursos: [PP] }).novos, 1);
    assert.deepEqual([e.stu[0].fly, e.stu[0].etapa, e.stu[0].cursoDaEtapa, e.importadas], [true, 'NAV-150NM', 'PP', [17, 16]]);
  });

  // Com o progresso ligado, o pedido cuja missão do curso saiu do programa pode ganhar a próxima do programa: o resumo diz
  // como qual ele entrou (entrouComo), e não que entrou pelo tipo
  it('a missão do curso que saiu do programa, com o progresso ligado: o resumo diz a missão inferida no lugar dela', () => {
    const fora = { ...PP, missoes: PP.missoes.map(m => (m.codigo === 'IN-01' ? { ...m, removida: true } : m)) };
    const e = estado([aluno(1000, { fly: false }, { curso: 'PP' })]);
    const resumo = importarSolicitacoes(e, [pedido(18, 1000, { missao: 'Voo Local', missao_do_curso: idDe('IN-01'), horas: 1 })], { situacao: [], programa: [fora], cursos: [fora] });
    assert.deepEqual(resumo.foraDoPrograma, [{ missao: 'Voo Local', entrouComo: e.stu[0].etapa }]);
    assert.ok(/^IN-/.test(e.stu[0].etapa), e.stu[0].etapa);
  });

  it('o pedido sem missão do curso entra como antes, campo por campo (missao_do_curso null ou ausente)', () => {
    for (const progresso of ['', 'progresso']) {
      ligarFuncionalidades(progresso);
      const situacao = percursoDoCurso(PP).missoes.slice(0, 13).map((m, i) => ({ id: i + 1, aluno: 1000, curso: 'PP', missao: m.codigo, resultado: 'aprovado' }));
      setS({ stu: [], fStatus: {}, resultados: { situacao, doDia: [] }, programa: [PP] });
      const importar = extra => {
        const e = estado([aluno(1000, { fly: false }, { curso: 'PP' }), aluno(1001, { mis: 'Navegação', eq: 'C172', nb: 2, etapa: 'NAV-02', cursoDaEtapa: 'PP' }, { curso: 'PP' })]);
        const resumo = importarSolicitacoes(e, [pedido(7, 1000, extra), pedido(8, 1001, { recurso: 'PA-34', ...extra })], { situacao, programa: programaParaInferir(), cursos: [PP] });
        return { resumo, e };
      };
      const sem = importar({}), nulo = importar({ missao_do_curso: null });
      assert.deepEqual(nulo, sem, progresso);
      assert.deepEqual(sem.e.stu.map(s => [s.etapa, s.eq, s.nb]), progresso ? [['NAV-01', 'C152', 3], ['NAV-02', 'C172', 3]] : [[undefined, 'C152', 3], ['NAV-02', 'C172', 3]], progresso);
    }
  });

  it('o voo posto à mão da mesma missão: dá lugar ao pedido da mesma missão do curso, ou ao que só o pedido tem; com outra, são dois voos', () => {
    const mesma = estado([aluno(1000, { mis: 'Navegação', eq: 'C172', nb: 1.5, etapa: 'NAV-150NM', cursoDaEtapa: 'PP', insId: 2 }, { curso: 'PP' })]);
    assert.equal(importarSolicitacoes(mesma, [pedido(9, 1000, { missao_do_curso: idDe('NAV-150NM') })], { cursos: [PP] }).atualizados, 1);
    assert.deepEqual([mesma.stu[0].etapa, mesma.stu[0].eq, mesma.stu[0].nb, mesma.stu[0].insId, mesma.stu[0].solicitacao, mesma.stu[0].extra], ['NAV-150NM', 'C152', 3, 2, 9, []]);
    // Uma NAV-01 posta à mão e um pedido da NAV-150NM: dois voos, cada um com a sua
    const outra = estado([aluno(1000, { mis: 'Navegação', eq: 'C152', nb: 1.5, etapa: 'NAV-01', cursoDaEtapa: 'PP' }, { curso: 'PP' })]);
    assert.equal(importarSolicitacoes(outra, [pedido(10, 1000, { missao_do_curso: idDe('NAV-150NM') })], { cursos: [PP] }).novos, 1);
    assert.deepEqual([outra.stu[0], ...outra.stu[0].extra].map(p => [p.etapa, p.nb, p.solicitacao]), [['NAV-01', 1.5, undefined], ['NAV-150NM', 3, 10]]);
    // O voo posto à mão sem missão do curso dá lugar e fica com a do pedido
    const semEtapa = estado([aluno(1000, { mis: 'Navegação', eq: 'C172', nb: 2 }, { curso: 'PP' })]);
    assert.equal(importarSolicitacoes(semEtapa, [pedido(11, 1000, { missao_do_curso: idDe('NAV-150NM') })], { cursos: [PP] }).atualizados, 1);
    assert.deepEqual([semEtapa.stu[0].etapa, semEtapa.stu[0].cursoDaEtapa, semEtapa.stu[0].eq, semEtapa.stu[0].extra], ['NAV-150NM', 'PP', 'C152', []]);
    // O voo com a missão do curso posta à mão e o pedido sem nenhuma: o voo dá lugar e fica com a do operador, como antes
    const soNoVoo = estado([aluno(1000, { mis: 'Navegação', eq: 'C172', nb: 2, etapa: 'NAV-02', cursoDaEtapa: 'PP' }, { curso: 'PP' })]);
    importarSolicitacoes(soNoVoo, [pedido(12, 1000, { recurso: 'PA-34', horas: 1.2 })], { cursos: [PP] });
    assert.deepEqual([soNoVoo.stu[0].etapa, soNoVoo.stu[0].eq, soNoVoo.stu[0].nb, soNoVoo.stu[0].solicitacao], ['NAV-02', 'C172', 1.2, 12]);
  });

  it('o pedido sem missão do curso para o qual nenhuma é inferida diz por quê (só quando há o que inferir)', () => {
    const situacao = percursoDoCurso(PP).missoes.slice(0, 13).map((m, i) => ({ id: i + 1, aluno: 1000, curso: 'PP', missao: m.codigo, resultado: 'aprovado' }));
    const e = estado([aluno(1000, { fly: false }, { curso: 'PP' }), aluno(1001, { fly: false })]);
    const resumo = importarSolicitacoes(e, [pedido(13, 1000, { recurso: 'PA-34' }), pedido(14, 1001, { recurso: 'PA-34' })], { situacao, programa: [PP], cursos: [PP] });
    assert.deepEqual(resumo.semMissaoDoCurso, [{ missao: 'Navegação', recurso: 'PA-34' }]);
    // Com o progresso desligado (nenhum programa para inferir), nada é dito
    const desligado = estado([aluno(1000, { fly: false }, { curso: 'PP' })]);
    assert.deepEqual(importarSolicitacoes(desligado, [pedido(15, 1000, { recurso: 'PA-34' })], { situacao, programa: [], cursos: [PP] }).semMissaoDoCurso, []);
  });
});
