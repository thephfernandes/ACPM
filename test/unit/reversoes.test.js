// O que "Reverter" desfaz no histórico: a reversão vem gravada no histórico, então só vale no
// formato que o próprio app produz; o resto não vira botão nem é aplicado.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validarReversao, motivoParaNaoDesfazer, desfazerAgendamento, agendamentosEmVolta } from '../../js/reversoes.js';
import { FROTA_INICIAL } from '../../js/frota.js';
import { CAMPOS_DO_PEDIDO } from '../../js/dias.js';
import { aplicarAgendamento, reversaoDoAgendamento } from '../../js/agendamento.js';
import { escolherInstrutor, escolhasDaUnidade, escolherNosPedidos, reverterEscolha, reverterReparo } from '../../js/instrutor-escolhido.js';
import { aplicarReparo } from '../../js/reparo.js';
import { normalizarFixos, semAgendados, fixosAoAprovar, limparDemanda } from '../../js/fixos.js';
import { runAllocationEngine } from '../../js/engine.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const ATAQUE = 'x"><img/src/onerror=window.__xss=1>';

// O pedido de antes de um agendamento, com todos os campos do pedido (CAMPOS_DO_PEDIDO)
const PEDIDO_DE_ANTES = { fly: true, mis: 'Navegação', eq: 'C172', p1: 500, p2: -1, nb: 2, ss: 1, pr: 3, jan: 'manha', etapa: 'PP-07', solicitacao: 7, insId: 2, cursoDaEtapa: 'PP', limiteConfirmado: true };
// Uma reversão válida de cada tipo, com todos os campos que o app grava. Do voo agendado na Escala, duas: o criado numa
// missão extra (sem o pedido de antes) e o que mudou de lugar (o pedido, o voo fixo e a disponibilidade do instrutor de
// antes, e o pedido como o agendamento o deixou)
const VALIDAS = [
  { kind: 'setFly', stuId: 1000, mid: 0, val: true, extras: [1001, 1002], label: '↶ Restaurar' },
  { kind: 'setAv', reg: 'PR-VOB', val: true, label: '↶ Reverter' },
  { kind: 'setAtributo', reg: 'PR-CPL', atributo: 'soVfr', val: false, label: '↶ Reverter' },
  { kind: 'setInsOn', insId: 3, val: true, label: '↶ Reverter' },
  { kind: 'restaurarFixos', fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1, classKey: 'g', escolhido: true } }, pedidos: [{ stuId: 1000, mid: 0, insId: 2 }], label: '↶ Reverter' },
  { kind: 'restaurarEscolha', pedidos: [{ stuId: 1000, mid: 0, insId: 0 }], fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } }, soltar: ['1001_2_1'], label: '↶ Reverter' },
  { kind: 'restaurarHorarios', cat: 'PA-34', lista: [390, 450], pedidos: [{ stuId: 1000, mid: 2, p1: 450, p2: -1, jan: 'h450' }], label: '↶ Reverter' },
  { kind: 'readicionarRecurso', recurso: { reg: 'PR-NEW', tipo: 'C172', soVfr: true }, av: false, label: '↶ Reverter' },
  { kind: 'desfazerAgendamento', stuId: 1000, mid: 2, criado: true, pedido: null, fixo: null, disponibilidade: null, label: '↶ Desfazer' },
  {
    kind: 'desfazerAgendamento', stuId: 1000, mid: 0, criado: false, pedido: PEDIDO_DE_ANTES,
    fixo: { a: 500, b: 620, r: 'PR-HAR', insId: 2, classKey: 'g', escolhido: true, agendado: true },
    disponibilidade: { insId: 5, on: true, aw: [true, true, true, true, false, false, false, false, false] },
    criadoComo: { ...PEDIDO_DE_ANTES, p1: 610, jan: 'h610' }, label: '↶ Desfazer'
  }
];
// O que o histórico adulterado pode trazer em qualquer campo (é JSON): objetos que não viram texto (sem um toString ou
// um valueOf que sirva), listas deles, os nomes do protótipo e os tipos trocados
const HOSTIS = [JSON.parse('{"toString":null}'), JSON.parse('{"toString":null,"valueOf":null}'), JSON.parse('{"toString":{}}'),
  JSON.parse('[{"toString":null}]'), JSON.parse('{"__proto__":{"toString":null}}'), {}, [], null, 1.5, -1, '', 'toString', '__proto__', 'constructor', true];
// Cada campo da reversão, e cada campo dos objetos e das listas dentro dela
const caminhos = (valor, prefixo = []) => (valor && typeof valor === 'object'
  ? Object.keys(valor).flatMap(k => [[...prefixo, k], ...caminhos(valor[k], [...prefixo, k])]) : []);
function trocar(valor, [campo, ...resto], novo) {
  const copia = Array.isArray(valor) ? [...valor] : { ...valor };
  copia[campo] = resto.length ? trocar(valor[campo], resto, novo) : novo;
  return copia;
}

describe('Reversões do histórico', () => {
  it('as que o app grava passam, com o rótulo', () => {
    assert.deepEqual(validarReversao({ kind: 'setFly', stuId: 1000, mid: 0, val: false, label: '↶ Reverter' }, FROTA_INICIAL),
      { kind: 'setFly', stuId: 1000, mid: 0, val: false, label: '↶ Reverter' });
    // As missões extras que saíram com a principal
    assert.deepEqual(validarReversao({ kind: 'setFly', stuId: 1000, mid: 0, val: true, extras: [1001, 1002], label: '↶ Restaurar' }, FROTA_INICIAL),
      { kind: 'setFly', stuId: 1000, mid: 0, val: true, extras: [1001, 1002], label: '↶ Restaurar' });
    assert.deepEqual(validarReversao({ kind: 'setAv', reg: 'PR-VOB', val: true, label: '↶ Reverter' }, FROTA_INICIAL),
      { kind: 'setAv', reg: 'PR-VOB', val: true, label: '↶ Reverter' });
    assert.deepEqual(validarReversao({ kind: 'setInsOn', insId: 3, val: true, label: '↶ Reverter' }, FROTA_INICIAL),
      { kind: 'setInsOn', insId: 3, val: true, label: '↶ Reverter' });
    assert.deepEqual(validarReversao({ kind: 'restaurarFixos', fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } }, label: '↶ Reverter' }, FROTA_INICIAL),
      { kind: 'restaurarFixos', fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } }, label: '↶ Reverter' });
    assert.deepEqual(validarReversao({ kind: 'readicionarRecurso', recurso: { reg: 'pr-new', tipo: 'C152' }, av: false, label: '↶ Reverter' }, FROTA_INICIAL),
      { kind: 'readicionarRecurso', recurso: { reg: 'PR-NEW', tipo: 'C152' }, av: false, label: '↶ Reverter' });
  });

  it('fora do formato, ou um recurso que já voltou à frota, não vale', () => {
    const ruins = [
      null, 'x', { kind: ATAQUE }, { kind: 'setFly', stuId: ATAQUE, val: true }, { kind: 'setFly', stuId: 1000, mid: 0, val: 'sim' }, { kind: 'setFly', stuId: 1000, mid: 0, val: true, extras: [ATAQUE] },
      { kind: 'setAv', reg: ATAQUE, val: true }, { kind: 'setAv', reg: '__proto__', val: true }, { kind: 'setInsOn', insId: 1.5, val: true },
      { kind: 'restaurarFixos', fixos: { [ATAQUE]: { a: 1 } } }, { kind: 'readicionarRecurso', recurso: { reg: ATAQUE, tipo: 'C152' } },
      { kind: 'readicionarRecurso', recurso: { reg: 'PR-VOB', tipo: 'C152' } }
    ];
    for (const rev of ruins) assert.equal(validarReversao(rev, FROTA_INICIAL), null, JSON.stringify(rev));
  });

  // A entrada adulterada só perde o botão: a validação nunca lança (o painel do Histórico, que a chama para cada entrada,
  // não seria desenhado), e o que ela devolve tem só os valores do formato do app
  it('qualquer campo adulterado, de qualquer tipo de reversão, não lança: a reversão vale limpa ou não vale', () => {
    assert.deepEqual(Object.keys(PEDIDO_DE_ANTES).sort(), [...CAMPOS_DO_PEDIDO].sort(), 'o pedido de antes da amostra tem todos os campos do pedido');
    for (const rev of VALIDAS) {
      assert.deepEqual(validarReversao(rev, FROTA_INICIAL), rev);
      for (const caminho of caminhos(rev)) {
        for (const hostil of HOSTIS) {
          const adulterada = trocar(rev, caminho, hostil);
          const onde = `${rev.kind}.${caminho.join('.')} = ${JSON.stringify(hostil)}`;
          let limpa;
          assert.doesNotThrow(() => { limpa = validarReversao(adulterada, FROTA_INICIAL); }, onde);
          if (limpa) assert.deepEqual(validarReversao(limpa, FROTA_INICIAL), limpa, onde);
        }
      }
    }
  });

  it('o atributo é o nome de um atributo, em texto (uma lista com o nome não vale)', () => {
    const rev = VALIDAS.find(r => r.kind === 'setAtributo');
    for (const atributo of [['soVfr'], JSON.parse('{"toString":null}'), 'toString', 'hasOwnProperty']) {
      assert.equal(validarReversao({ ...rev, atributo }, FROTA_INICIAL), null, JSON.stringify(atributo));
    }
  });

  it('o rótulo é um texto curto; fora disso, "↶ Reverter"', () => {
    assert.equal(validarReversao({ kind: 'setInsOn', insId: 3, val: true, label: 'x'.repeat(200) }, FROTA_INICIAL).label, '↶ Reverter');
    assert.equal(validarReversao({ kind: 'setInsOn', insId: 3, val: true }, FROTA_INICIAL).label, '↶ Reverter');
  });

  // Os horários de uma categoria e os pedidos que mudaram com eles
  it('os horários: a categoria da lista, horários do dia e os pedidos nos formatos do app', () => {
    const rev = { kind: 'restaurarHorarios', cat: 'PA-34', lista: [390, 450], pedidos: [{ stuId: 1000, mid: 0, p1: 450, p2: -1 }, { stuId: 1001, mid: 2, p1: 500, p2: 610, jan: 'h500' }], label: '↶ Reverter' };
    assert.deepEqual(validarReversao(rev, FROTA_INICIAL), rev);
    assert.deepEqual(validarReversao({ ...rev, pedidos: [] }, FROTA_INICIAL), { ...rev, pedidos: [] });
    for (const ruim of [{ cat: 'Sala' }, { lista: [390, 2000] }, { lista: 'x' }, { pedidos: [{ stuId: 0, mid: 0, p1: 1, p2: 1 }] },
      { pedidos: [{ stuId: 1, mid: 0, p1: 450, p2: -1, jan: '<img>' }] }, { pedidos: 'x' }]) {
      assert.equal(validarReversao({ ...rev, ...ruim }, FROTA_INICIAL), null, JSON.stringify(ruim));
    }
  });
});

// Desfazer um voo agendado na Escala: o pedido de antes, o voo fixo de antes e a disponibilidade do instrutor de antes
describe('Desfazer um voo agendado na Escala', () => {
  const TODOS = Array(9).fill(true);
  const DE_MANHA = [true, true, true, true, false, false, false, false, false];
  // O agendamento criou a missão extra 2 do Aluno 1000 (sem pedido de antes: desfazer a tira)
  const NOVO = { kind: 'desfazerAgendamento', stuId: 1000, mid: 2, criado: true, pedido: null, fixo: null, disponibilidade: null, label: '↶ Desfazer' };
  // O agendamento moveu o pedido principal das 08:20 no PR-HAR, com o Instrutor 02 escolhido na Escala, para as 10:10 no
  // PR-CPL com o Instrutor 05, que não vinha à tarde e foi marcado disponível
  const ANTES = { fly: true, mis: 'Navegação', eq: 'C172', p1: 500, p2: -1, nb: 2, ss: 1, pr: 3, etapa: 'PP-07', insId: 2 };
  const MOVIDO = {
    kind: 'desfazerAgendamento', stuId: 1000, mid: 0, criado: false, pedido: ANTES,
    fixo: { a: 500, b: 620, r: 'PR-HAR', insId: 2, escolhido: true }, disponibilidade: { insId: 5, on: true, aw: DE_MANHA }, label: '↶ Desfazer'
  };
  const campos = pedido => Object.fromEntries(CAMPOS_DO_PEDIDO.filter(c => pedido[c] !== undefined).map(c => [c, pedido[c]]));
  // O que é do aluno e não do pedido: o cadastro e as missões extras
  const doAluno = ({ id, nm, kg, bl, voaCom, curso, extra }) => ({ id, nm, kg, bl, voaCom, curso, extra });

  // O dia depois dos agendamentos: a principal movida para as 10:10 e a extra 2 criada às 14:30 (e cancelada depois)
  const dia = () => ({
    stu: [{
      id: 1000, nm: 'Aluno 1000', kg: 82, bl: [3], voaCom: [2], curso: 'PP',
      fly: true, mis: 'Navegação', eq: 'C172', p1: 610, p2: -1, nb: 2, ss: 1, pr: 3, etapa: 'PP-07', insId: 5,
      extra: [{ mid: 1, fly: false, mis: 'Voo Local', eq: 'C152', p1: 760, p2: -1, nb: 1, ss: 1, pr: 3 },
        { mid: 2, fly: true, mis: 'Voo Local', eq: 'C152', p1: 870, p2: -1, nb: 1, ss: 1, pr: 3, insId: 5 }]
    }],
    ins: [{ id: 5, nm: 'Instrutor 05', kg: 90, on: true, aw: [...TODOS] }],
    fixos: { '1000_0_1': { a: 610, b: 730, r: 'PR-CPL', insId: 5 }, '1000_2_1': { a: 870, b: 930, r: 'PR-VOB', insId: 5 } },
    fStatus: { '1000_0_1': 'Confirmado', '1000_2_1': 'Cancelado' },
    fObs: { '1000_2_1': { motivo: 'Meteorologia' } },
    resultados: { situacao: [], doDia: [] }
  });

  it('as que o app grava passam: o voo criado numa missão extra ou no pedido principal, e o voo movido', () => {
    assert.deepEqual(validarReversao(NOVO, FROTA_INICIAL), NOVO);
    const principal = { ...NOVO, mid: 0, pedido: { fly: false, mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, pr: 3 } };
    assert.deepEqual(validarReversao(principal, FROTA_INICIAL), principal);
    assert.deepEqual(validarReversao(MOVIDO, FROTA_INICIAL), MOVIDO);
    // Todos os campos do pedido: a disponibilidade do aluno, a missão do curso (e o curso dela), o pedido da agenda, o
    // instrutor escolhido e a confirmação do 7º voo local (F1d)
    const completo = { ...MOVIDO, pedido: { ...ANTES, jan: 'h500', solicitacao: 12, cursoDaEtapa: 'PP', limiteConfirmado: true } };
    assert.deepEqual(Object.keys(completo.pedido).sort(), [...CAMPOS_DO_PEDIDO].sort());
    assert.deepEqual(validarReversao(completo, FROTA_INICIAL), completo);
    assert.equal(validarReversao({ ...NOVO, label: 'x'.repeat(40) }, FROTA_INICIAL).label, 'x'.repeat(40));
  });

  it('o pedido, o voo fixo ou a disponibilidade de antes que não vêm valem null; o que não é da reversão fica de fora', () => {
    const { fixo, disponibilidade, ...semFixo } = MOVIDO;
    // O peso digitado no agendamento não volta (é da pessoa e fica no cadastro)
    assert.deepEqual(validarReversao({ ...semFixo, pesos: [{ tipo: 'aluno', id: 1000, nm: 'Aluno 1000', kg: 80 }] }, FROTA_INICIAL),
      { ...MOVIDO, fixo: null, disponibilidade: null });
    const { pedido, ...semPedido } = NOVO;
    assert.deepEqual(validarReversao(semPedido, FROTA_INICIAL), NOVO);
  });

  it('o pedido de antes vai para os formatos do app (normalizeMissionFields)', () => {
    // A janela dos dados antigos vira o horário, a duração fica em décimos e a etapa fora do formato sai
    assert.deepEqual(validarReversao({ ...MOVIDO, pedido: { ...ANTES, p1: 2, nb: 1.25, etapa: ATAQUE } }, FROTA_INICIAL).pedido,
      { fly: true, mis: 'Navegação', eq: 'C172', p1: 610, p2: -1, nb: 1.3, ss: 1, pr: 3, insId: 2 });
    // O Noturno sai às 17:30 no C172, com as 4 h dele no dia
    assert.deepEqual(validarReversao({ ...MOVIDO, pedido: { fly: true, mis: 'Noturno', eq: 'C152' } }, FROTA_INICIAL).pedido,
      { fly: true, mis: 'Noturno', eq: 'C172', p1: 1050, p2: -1, nb: 4, ss: 1 });
    // O campo null é o campo que não vem (o instrutor escolhido null é o "Automático")
    const { insId, ...automatico } = ANTES;
    assert.deepEqual(validarReversao({ ...MOVIDO, pedido: { ...ANTES, insId: null, jan: null } }, FROTA_INICIAL).pedido, automatico);
  });

  // Um valor que o JSON permite e que não vira texto nem número (um objeto com "toString": null) lançava uma exceção na
  // normalização: o histórico e a escala da data não eram desenhados. O pedido de antes só tem valores simples
  it('um valor adulterado no pedido de antes não vale e não lança exceção', () => {
    const ruins = [JSON.parse('{"toString": null}'), { a: 1 }, [], ['Voo Local'], ['h500']];
    for (const campo of CAMPOS_DO_PEDIDO) {
      for (const ruim of ruins) {
        const rev = { ...MOVIDO, pedido: { ...ANTES, [campo]: ruim } };
        assert.equal(validarReversao(rev, FROTA_INICIAL), null, `${campo}: ${JSON.stringify(ruim)}`);
      }
    }
    // O nome da missão numa lista vira o texto dele na conversão: ['Noturno'] passaria por 'Noturno', sem as regras do
    // Noturno (o 17:30 e o C172)
    assert.equal(validarReversao({ ...MOVIDO, pedido: { fly: true, mis: ['Noturno'], eq: 'C172', p1: 500, nb: 1, pr: 3 } }, FROTA_INICIAL), null);
  });

  it('fora do formato não vale: não vira botão nem é aplicada', () => {
    const { label, ...semRotulo } = NOVO;
    const ruins = [
      // O aluno, a missão do aluno e se o agendamento criou o voo
      { ...NOVO, stuId: 0 }, { ...NOVO, stuId: ATAQUE }, { ...NOVO, mid: -1 }, { ...NOVO, mid: 1.5 }, { ...NOVO, mid: '2' }, { ...NOVO, criado: 'sim' },
      // Sem o pedido de antes, só o voo criado numa missão extra: nunca na missão 0 nem no voo movido
      { ...NOVO, mid: 0 }, { ...NOVO, criado: false }, { ...MOVIDO, pedido: null },
      // O pedido: só os campos do pedido, com uma missão do app e o "voa" sim ou não
      { ...MOVIDO, pedido: 'x' }, { ...MOVIDO, pedido: [ANTES] }, { ...MOVIDO, pedido: { ...ANTES, extra: [] } }, { ...MOVIDO, pedido: { ...ANTES, kg: 80 } },
      { ...MOVIDO, pedido: { ...ANTES, curso: 'PP' } }, { ...MOVIDO, pedido: { ...ANTES, [ATAQUE]: 1 } },
      { ...MOVIDO, pedido: JSON.parse('{"__proto__": {"x": 1}, "fly": true, "mis": "Voo Local"}') },
      { ...MOVIDO, pedido: { ...ANTES, mis: 'PP Local' } }, { ...MOVIDO, pedido: { ...ANTES, mis: 'constructor' } }, { ...MOVIDO, pedido: { ...ANTES, mis: ATAQUE } },
      { ...MOVIDO, pedido: { ...ANTES, fly: 'true' } }, { ...MOVIDO, pedido: { mis: 'Voo Local' } },
      // O voo fixo de antes: no formato dos voos fixos
      { ...MOVIDO, fixo: { a: 620, b: 500, r: 'PR-HAR', insId: 2 } }, { ...MOVIDO, fixo: { a: 500, b: 620, r: ATAQUE, insId: 2 } },
      { ...MOVIDO, fixo: { a: 500, b: 620, r: 'PR-HAR' } }, { ...MOVIDO, fixo: 'x' },
      // A disponibilidade de antes: o instrutor, se ele vem e cada um dos 9 horários do dia
      { ...MOVIDO, disponibilidade: { insId: 5, on: true, aw: TODOS.slice(1) } }, { ...MOVIDO, disponibilidade: { insId: 5, on: true, aw: [...TODOS, true] } },
      { ...MOVIDO, disponibilidade: { insId: 5, on: true, aw: TODOS.map(() => 1) } }, { ...MOVIDO, disponibilidade: { insId: 5, on: true } },
      { ...MOVIDO, disponibilidade: { insId: 5, on: 'não', aw: TODOS } }, { ...MOVIDO, disponibilidade: { insId: 0, on: true, aw: TODOS } },
      { ...MOVIDO, disponibilidade: 'x' },
      // O rótulo: um texto de até 40 caracteres, que não fica em branco (o botão ficaria sem nome)
      { ...NOVO, label: 'x'.repeat(41) }, { ...NOVO, label: 5 }, semRotulo, { ...NOVO, label: '' }, { ...NOVO, label: '   ' }
    ];
    for (const rev of ruins) assert.equal(validarReversao(rev, FROTA_INICIAL), null, JSON.stringify(rev));
  });

  it('o voo criado numa missão extra sai, sem sobras na chave dele; o instrutor volta como estava', () => {
    const estado = dia();
    const rev = validarReversao({ ...NOVO, disponibilidade: { insId: 5, on: false, aw: DE_MANHA } }, FROTA_INICIAL);
    // Cancelado não impede (o voo não voou)
    assert.equal(motivoParaNaoDesfazer(estado, rev), '');
    assert.equal(desfazerAgendamento(estado, rev), true);
    assert.deepEqual(estado.stu[0].extra.map(ex => ex.mid), [1]);
    assert.deepEqual(estado.fixos, { '1000_0_1': { a: 610, b: 730, r: 'PR-CPL', insId: 5 } });
    assert.deepEqual(estado.fStatus, { '1000_0_1': 'Confirmado' });
    assert.deepEqual(estado.fObs, {});
    assert.deepEqual(estado.ins[0], { id: 5, nm: 'Instrutor 05', kg: 90, on: false, aw: DE_MANHA });
    // O pedido principal e o peso digitado no agendamento ficam
    assert.deepEqual(campos(estado.stu[0]), campos(dia().stu[0]));
    assert.equal(estado.stu[0].kg, 82);
    assert.deepEqual(doAluno(estado.stu[0]).extra, dia().stu[0].extra.filter(ex => ex.mid === 1));
  });

  it('o pedido principal que o agendamento usou volta como estava, com o resto do aluno e as missões extras', () => {
    const estado = dia();
    const antes = { fly: false, mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, pr: 2, jan: 'manha' };
    assert.equal(desfazerAgendamento(estado, validarReversao({ ...NOVO, mid: 0, pedido: antes }, FROTA_INICIAL)), true);
    // A etapa e o instrutor escolhido pelo agendamento saem com ele
    assert.deepEqual(campos(estado.stu[0]), antes);
    assert.deepEqual(doAluno(estado.stu[0]), doAluno(dia().stu[0]));
    // A chave do voo fica limpa; a da missão extra continua
    assert.deepEqual(estado.fixos, { '1000_2_1': { a: 870, b: 930, r: 'PR-VOB', insId: 5 } });
    assert.deepEqual(estado.fStatus, { '1000_2_1': 'Cancelado' });
  });

  it('o voo movido volta para onde estava: o pedido, o instrutor escolhido e o voo fixo de antes; o status fica', () => {
    const estado = dia();
    assert.equal(desfazerAgendamento(estado, validarReversao(MOVIDO, FROTA_INICIAL)), true);
    assert.deepEqual(campos(estado.stu[0]), ANTES);
    assert.equal(estado.stu[0].insId, 2);
    assert.deepEqual(estado.fixos['1000_0_1'], { a: 500, b: 620, r: 'PR-HAR', insId: 2, escolhido: true });
    assert.equal(estado.fStatus['1000_0_1'], 'Confirmado');
    assert.deepEqual(estado.ins[0].aw, DE_MANHA);
    // Sem instrutor escolhido antes, o app volta a escolher; sem voo fixo antes, o voo deixa de ser fixo
    const semEscolha = dia();
    const { insId, ...automatico } = ANTES;
    assert.equal(desfazerAgendamento(semEscolha, validarReversao({ ...MOVIDO, pedido: automatico, fixo: null }, FROTA_INICIAL)), true);
    assert.equal(Object.hasOwn(semEscolha.stu[0], 'insId'), false);
    assert.equal(semEscolha.fixos['1000_0_1'], undefined);
    assert.equal(semEscolha.fStatus['1000_0_1'], 'Confirmado');
  });

  // O voo movido já voava antes do agendamento (só o pedido que voa muda de lugar): o "Voa" desligado depois dele é do
  // operador, e desfazer o agendamento não põe o aluno de volta na escala
  it('o voo movido depois de desligar "Voa": o pedido e o voo fixo voltam como estavam, e o aluno continua sem voar', () => {
    const estado = dia();
    estado.stu[0].fly = false;
    assert.equal(motivoParaNaoDesfazer(estado, MOVIDO), '');
    assert.equal(desfazerAgendamento(estado, validarReversao(MOVIDO, FROTA_INICIAL)), true);
    assert.deepEqual(campos(estado.stu[0]), { ...ANTES, fly: false });
    assert.deepEqual(estado.fixos['1000_0_1'], MOVIDO.fixo);
    // O pedido principal criado pelo agendamento volta como estava, sem voar, do mesmo jeito
    const criado = dia();
    criado.stu[0].fly = false;
    const antes = { fly: false, mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, pr: 2 };
    assert.equal(desfazerAgendamento(criado, validarReversao({ ...NOVO, mid: 0, pedido: antes }, FROTA_INICIAL)), true);
    assert.deepEqual(campos(criado.stu[0]), antes);
  });

  it('o voo em andamento ou com resultado registrado não é desfeito, com o motivo', () => {
    const estado = dia();
    for (const status of ['Em Voo', 'Atrasado', 'Pousou']) {
      estado.fStatus['1000_0_1'] = status;
      assert.equal(motivoParaNaoDesfazer(estado, MOVIDO), 'O voo já está em andamento: mude o status em vez de desfazer.', status);
    }
    for (const status of ['Pendente', 'Confirmado', 'Cancelado']) {
      estado.fStatus['1000_0_1'] = status;
      assert.equal(motivoParaNaoDesfazer(estado, MOVIDO), '', status);
    }
    // Qualquer registro do resultado no voo (até o "pendente" que desfaz um engano); o de outro voo não conta
    estado.resultados.doDia.push({ id: 1, aluno: 1000, curso: 'PP', missao: 'PP-06', resultado: 'aprovado', data: '2026-11-11', voo: '1000_1_1' });
    assert.equal(motivoParaNaoDesfazer(estado, MOVIDO), '');
    estado.resultados.doDia.push({ id: 2, aluno: 1000, curso: 'PP', missao: 'PP-07', resultado: 'pendente', data: '2026-11-11', voo: '1000_0_1' });
    assert.equal(motivoParaNaoDesfazer(estado, MOVIDO), 'O voo já tem resultado registrado.');
    assert.equal(motivoParaNaoDesfazer({ stu: dia().stu, fStatus: {} }, MOVIDO), '');
  });

  // A leitura dos resultados falhou (js/storage.js: os registros do dia vêm vazios e 'resultados' fica indisponível): o
  // voo pode ter resultado no servidor, e desfazer o deixaria apontando um voo que saiu da escala
  it('sem os resultados dos cursos, não desfaz: não dá para conferir se o voo tem resultado', () => {
    const estado = { ...dia(), resultados: { situacao: [], doDia: [] }, indisponiveis: ['resultados'] };
    const SEM_RESULTADOS = 'Sem os resultados dos cursos, o app não confere se o voo já tem resultado: clique em "Tentar de novo" no aviso e desfaça depois.';
    assert.equal(motivoParaNaoDesfazer(estado, NOVO), SEM_RESULTADOS);
    assert.equal(motivoParaNaoDesfazer(estado, MOVIDO), SEM_RESULTADOS);
    // O voo em andamento diz isso primeiro; quando só as horas dos instrutores faltam, desfaz
    estado.fStatus['1000_0_1'] = 'Em Voo';
    assert.equal(motivoParaNaoDesfazer(estado, MOVIDO), 'O voo já está em andamento: mude o status em vez de desfazer.');
    assert.equal(motivoParaNaoDesfazer({ ...dia(), indisponiveis: ['horas'] }, MOVIDO), '');
  });

  // O "↶ Desfazer" do Histórico não fazia nada e não dizia nada: agora o aviso diz por quê, e o botão continua
  it('sem o aluno, ou sem o pedido do voo movido, não há o que desfazer, e o aviso diz por quê', () => {
    const estado = dia();
    const semAluno = { ...validarReversao(MOVIDO, FROTA_INICIAL), stuId: 1001 }, semPedido = validarReversao({ ...MOVIDO, mid: 7 }, FROTA_INICIAL);
    assert.equal(motivoParaNaoDesfazer(estado, semAluno), 'O aluno deste voo saiu do cadastro: não há o que desfazer.');
    assert.equal(motivoParaNaoDesfazer(estado, semPedido), 'O pedido deste voo saiu da Demanda: não há o que desfazer.');
    assert.equal(motivoParaNaoDesfazer(estado, { ...validarReversao(NOVO, FROTA_INICIAL), stuId: 1001 }), 'O aluno deste voo saiu do cadastro: não há o que desfazer.');
    assert.equal(desfazerAgendamento(estado, semAluno), false);
    assert.equal(desfazerAgendamento(estado, semPedido), false);
    assert.deepEqual(estado, dia());
    // A missão extra criada que já saiu da demanda: desfaz, e a chave do voo fica limpa do mesmo jeito
    estado.stu[0].extra = estado.stu[0].extra.filter(ex => ex.mid !== 2);
    assert.equal(motivoParaNaoDesfazer(estado, validarReversao(NOVO, FROTA_INICIAL)), '');
    assert.equal(desfazerAgendamento(estado, validarReversao(NOVO, FROTA_INICIAL)), true);
    assert.equal(Object.hasOwn(estado.fixos, '1000_2_1'), false);
    assert.equal(Object.hasOwn(estado.fStatus, '1000_2_1'), false);
  });

  // A turma de Ground aprovada (os Alunos 1000 e 1001 às 08:20): o agendamento tira o Aluno 1000 dela, e a turma (só o
  // Aluno 1001) passa para as 12:40 pelas Sugestões. Desfazer devolvia o voo fixo de antes com a chave da turma: a turma
  // ficava às 08:20 e às 12:40, e o motor ocupava a sala e o instrutor só num dos horários (outra turma entrava no outro,
  // sem conflito)
  it('o aluno movido de uma turma de Ground volta para ela só enquanto a turma está no horário e com o instrutor de antes', () => {
    const GROUND = { mis: 'Ground C152', eq: 'Sala Ground', nb: 1.5, p1: 500, p2: -1 };
    const turmaMovida = (mudarATurma) => {
      const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, GROUND), aluno(1001, GROUND)] });
      const res = runAllocationEngine(estado);
      estado.fixos = fixosAoAprovar({}, res.out);
      estado.aprovacao = { em: '2026-11-10T10:00:00Z', por: '' };
      const turma = estado.fixos['1000_0_1'];
      assert.equal(estado.fixos['1001_0_1'].classKey, turma.classKey);
      const proposta = { stuId: 1000, mis: 'Ground C152', eq: 'Sala Ground', nb: 1.5, a: 610, b: 700, r: 'SALA-GROUND', insId: turma.insId, pedido: { mid: 0, acao: 'mover' } };
      const rev = validarReversao(JSON.parse(JSON.stringify(reversaoDoAgendamento(aplicarAgendamento(estado, res, proposta)))), FROTA_INICIAL);
      if (mudarATurma) estado.fixos = aplicarReparo(estado.fixos, runAllocationEngine(estado), '1001_0_1', { mudancas: { a: 760, b: 850, insId: turma.insId } });
      assert.equal(motivoParaNaoDesfazer(estado, rev), '');
      assert.equal(desfazerAgendamento(estado, rev), true);
      return { estado, turma };
    };
    // A turma passou para as 12:40: o Aluno 1000 volta às 08:20, numa turma só dele (sem a chave)
    const { estado, turma } = turmaMovida(true);
    const { classKey: _, ...semChave } = turma;
    assert.deepEqual(estado.fixos['1000_0_1'], semChave);
    // As duas turmas ocupam a sala: outro Ground pedido às 12:40 não entra no horário da turma do Aluno 1001
    estado.stu.push(aluno(1002, { ...GROUND, mis: 'Ground Navegação', p1: 760 }));
    const { out } = runAllocationEngine(estado);
    const daSala = out.filter(o => o.isGround);
    const juntas = daSala.filter((o, i) => daSala.some((p, j) => j < i && p.classKey !== o.classKey && p.a < o.b && o.a < p.b));
    assert.deepEqual(juntas, []);
    assert.deepEqual(out.filter(o => o.conflito), []);
    assert.notEqual(out.find(o => o.stuId === 1002).a, 760);
    // A turma como estava: o Aluno 1000 volta para ela, com a chave
    const comoEstava = turmaMovida(false);
    assert.deepEqual(comoEstava.estado.fixos['1000_0_1'], comoEstava.turma);
  });
});

// Reverter uma troca de instrutor ou um reparo das Sugestões depois de um agendamento na Escala: o histórico da data (a
// entrada mais nova primeiro) diz o que a reversão não devolve. O voo agendado volta só enquanto o agendamento continua:
// de volta depois de desfeito (ou de solto pela Demanda), ele prenderia o voo seguinte do aluno no horário, no avião e com
// o instrutor de um agendamento que não existe mais
describe('Reverter depois de um agendamento na Escala', () => {
  const K = '1001_0_1';
  // O Aluno 1000 voa às 06:30; o Aluno 1001 não voa (o pedido dele prefere as 14:30)
  const dia = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { fly: false, p1: 870, p2: -1 })] });
  // O Aluno 1001 voa às 06:30, sem voo fixo
  const voando = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1001, { p1: 390, p2: -1 })] });
  // O agendamento: um voo novo do Aluno 1001 às 10:10 no PP-LJV com o Instrutor 01, ou o voo de hoje dele, que muda para
  // as 12:40
  const NOVO = { stuId: 1001, mis: 'Voo Local', eq: 'C152', nb: 1, a: 610, b: 670, r: 'PP-LJV', insId: 1 };
  const MOVIDO = { ...NOVO, a: 760, b: 820, pedido: { mid: 0, acao: 'mover' } };
  const AGENDADO = { a: 610, b: 670, r: 'PP-LJV', insId: 1, agendado: true };
  const vooDe = (estado, fKey = K) => runAllocationEngine(estado).out.find(o => o.fKey === fKey);

  // O histórico como o painel o guarda, e o que js/eventos/historico.js faz no clique de "↶ Desfazer" ou "↶ Reverter";
  // o agendamento (js/eventos/agendamento.js), a troca do instrutor na Demanda (js/eventos/demanda.js) e o reparo das
  // Sugestões (js/eventos/escala.js), com a reversão de cada um
  function historico() {
    const lista = [];
    const registrar = revert => {
      const e = { id: lista.length + 1, revert: JSON.parse(JSON.stringify(revert)), reverte: null };
      lista.unshift(e);
      return e;
    };
    const reverter = (estado, e) => {
      const rev = validarReversao(e.revert, FROTA_INICIAL);
      if (rev.kind === 'desfazerAgendamento') {
        assert.equal(motivoParaNaoDesfazer(estado, rev), '');
        assert.equal(desfazerAgendamento(estado, rev), true);
      } else {
        const emVolta = agendamentosEmVolta(estado, lista, e, FROTA_INICIAL);
        (rev.kind === 'restaurarEscolha' ? reverterEscolha : reverterReparo)(estado, rev, emVolta);
        estado.fixos = normalizarFixos(estado.fixos);
      }
      lista.unshift({ id: lista.length + 1, revert: null, reverte: e.id });
    };
    const agendar = (estado, proposta) => registrar(reversaoDoAgendamento(aplicarAgendamento(estado, runAllocationEngine(estado), proposta)));
    const trocar = (estado, stuId, mid, insId) =>
      registrar({ kind: 'restaurarEscolha', ...escolherInstrutor(estado, runAllocationEngine(estado), { stuId, mid }, insId).antes, label: '↶ Reverter' });
    const reparar = (estado, fKey, opcao) => {
      const res = runAllocationEngine(estado), antes = estado.fixos;
      const escolhas = escolhasDaUnidade(estado, res, fKey);
      if (opcao.soltar) escolherNosPedidos(estado, escolhas, null);
      else if (opcao.mudancas.insId) escolherNosPedidos(estado, escolhas, opcao.mudancas.insId);
      estado.fixos = aplicarReparo(antes, res, fKey, opcao);
      const mudados = Object.keys(antes).filter(k => estado.fixos[k] !== antes[k]);
      return registrar({ kind: 'restaurarFixos', fixos: Object.fromEntries(mudados.map(k => [k, antes[k]])), ...(escolhas.length ? { pedidos: escolhas } : {}), label: '↶ Reverter' });
    };
    return { lista, agendar, trocar, reparar, reverter };
  }

  it('desfazer o agendamento e depois reverter a troca de instrutor não traz o voo agendado de volta', () => {
    const estado = dia(), h = historico();
    const agendamento = h.agendar(estado, NOVO);
    const troca = h.trocar(estado, 1001, 0, 2);
    assert.deepEqual(estado.fixos[K], { ...AGENDADO, insId: 2 });
    h.reverter(estado, agendamento);
    h.reverter(estado, troca);
    // Nem o voo fixo nem o instrutor escolhido do agendamento desfeito voltam: o pedido é o de antes dele
    assert.equal(estado.fixos[K], undefined);
    assert.deepEqual([estado.stu[1].fly, estado.stu[1].insId], [false, undefined]);
    // O aluno volta a voar, com outra missão: o voo vai para a preferência dele (14:30), sem a marca do agendamento
    Object.assign(estado.stu[1], { fly: true, mis: 'Navegação', nb: 1.5 });
    const voo = vooDe(estado);
    assert.deepEqual([voo.a, Boolean(voo.agendado), Boolean(voo.fixo)], [870, false, false]);
  });

  it('nem o "Soltar o voo" das Sugestões revertido, nem o voo criado numa missão extra ou movido', () => {
    const casos = [
      ['soltar o voo criado', dia, NOVO, (e, h) => h.reparar(e, K, { soltar: true }), K],
      ['trocar o instrutor da missão extra criada', voando, NOVO, (e, h) => h.trocar(e, 1001, 1, 2), '1001_1_1'],
      ['trocar o instrutor do voo movido', voando, MOVIDO, (e, h) => h.trocar(e, 1001, 0, 2), K],
      ['soltar o voo movido', voando, MOVIDO, (e, h) => h.reparar(e, K, { soltar: true }), K],
      ['passar o voo movido para outro instrutor', voando, MOVIDO, (e, h) => h.reparar(e, K, { mudancas: { insId: 2 } }), K]
    ];
    for (const [nome, inicio, proposta, mudar, fKey] of casos) {
      const estado = inicio(), h = historico();
      const agendamento = h.agendar(estado, proposta);
      const mudanca = mudar(estado, h);
      h.reverter(estado, agendamento);
      h.reverter(estado, mudanca);
      assert.equal(estado.fixos[fKey], undefined, nome);
      const pedido = fKey === K ? estado.stu.find(s => s.id === 1001) : estado.stu.find(s => s.id === 1001).extra.find(ex => ex.mid === 1);
      if (pedido) assert.equal(pedido.insId, undefined, nome);
      // O voo movido volta para a preferência dele (06:30), sem a marca do agendamento
      if (proposta === MOVIDO) assert.deepEqual([vooDe(estado).a, Boolean(vooDe(estado).agendado)], [390, false], nome);
    }
  });

  it('o voo agendado que continua volta com a reversão: da troca de instrutor, do "Soltar o voo" e com "Voa" desligado', () => {
    const casos = [
      ['trocar o instrutor', (e, h) => h.trocar(e, 1001, 0, 2)],
      ['soltar o voo', (e, h) => h.reparar(e, K, { soltar: true })],
      ['trocar o instrutor e desligar "Voa"', (e, h) => { const troca = h.trocar(e, 1001, 0, 2); e.stu[1].fly = false; return troca; }]
    ];
    for (const [nome, mudar] of casos) {
      const estado = dia(), h = historico();
      h.agendar(estado, NOVO);
      h.reverter(estado, mudar(estado, h));
      assert.deepEqual(estado.fixos[K], AGENDADO, nome);
      assert.equal(estado.stu[1].insId, 1, nome);
    }
  });

  it('o agendamento feito depois da mudança fica como está, com o instrutor escolhido dele', () => {
    // Desfeito e agendado de novo (o pedido principal, às 12:40, com o Instrutor 02)
    const estado = dia(), h = historico();
    const primeiro = h.agendar(estado, NOVO);
    const troca = h.trocar(estado, 1001, 0, 2);
    h.reverter(estado, primeiro);
    h.agendar(estado, { ...NOVO, a: 760, b: 820, insId: 2 });
    h.reverter(estado, troca);
    assert.deepEqual([estado.fixos[K], estado.stu[1].insId], [{ ...AGENDADO, a: 760, b: 820, insId: 2 }, 2]);
    // Movido depois da troca (às 14:30, com o Instrutor 02)
    const movido = dia(), m = historico();
    m.agendar(movido, NOVO);
    const outra = m.trocar(movido, 1001, 0, 2);
    m.agendar(movido, { ...MOVIDO, a: 870, b: 930, insId: 2 });
    m.reverter(movido, outra);
    assert.deepEqual([movido.fixos[K], movido.stu[1].insId], [{ ...AGENDADO, a: 870, b: 930, insId: 2 }, 2]);
  });

  it('o voo agendado que a Demanda soltou não volta: a demanda limpa, outra missão no pedido', () => {
    const limpa = dia(), h = historico();
    h.agendar(limpa, NOVO);
    const troca = h.trocar(limpa, 1001, 0, 2);
    limparDemanda(limpa);
    h.reverter(limpa, troca);
    assert.deepEqual([limpa.fixos[K], limpa.stu[1].insId], [undefined, undefined]);
    // Outra missão no pedido depois do reparo: o voo agendado não volta; o instrutor escolhido de antes do reparo, sim
    const outra = dia(), r = historico();
    r.agendar(outra, NOVO);
    const reparo = r.reparar(outra, K, { mudancas: { insId: 2 } });
    Object.assign(outra.stu[1], { mis: 'Navegação', nb: 1.5 });
    outra.fixos = semAgendados(outra.fixos, [K], outra.fStatus);
    r.reverter(outra, reparo);
    assert.deepEqual([outra.fixos[K], outra.stu[1].insId], [undefined, 1]);
  });

  it('o voo fixo que o desfazer devolveu fica: o da escala aprovada, sem a marca do agendamento', () => {
    const estado = voando(), h = historico();
    estado.fixos = fixosAoAprovar({}, runAllocationEngine(estado).out);
    estado.aprovacao = { em: '2026-11-10T10:00:00Z', por: '' };
    const aprovado = estado.fixos[K];
    const agendamento = h.agendar(estado, MOVIDO);
    const troca = h.trocar(estado, 1001, 0, 2);
    h.reverter(estado, agendamento);
    h.reverter(estado, troca);
    assert.deepEqual(estado.fixos[K], aprovado);
    assert.equal(estado.stu[0].insId, undefined);
  });

  it('sem a entrada no histórico, o estado decide: o voo agendado sem pedido que voe não volta, nem o instrutor dele', () => {
    const estado = dia(), h = historico();
    const agendamento = h.agendar(estado, NOVO);
    const troca = h.trocar(estado, 1001, 0, 2);
    assert.deepEqual(agendamentosEmVolta(estado, h.lista, { ...troca }, FROTA_INICIAL), { mudados: new Set(), soltos: new Set() });
    desfazerAgendamento(estado, validarReversao(agendamento.revert, FROTA_INICIAL));
    reverterEscolha(estado, validarReversao(troca.revert, FROTA_INICIAL));
    assert.deepEqual([estado.fixos[K], estado.stu[1].insId], [undefined, undefined]);
  });
});
