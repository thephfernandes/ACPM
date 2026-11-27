// O voo cancelado aproveitado (js/reparo.js): o aluno não perde o voo porque o instrutor ou o avião faltou. O motivo do
// cancelamento sai da busca; a ordem é o mesmo horário e avião com outro instrutor, outro avião, o horário mais perto e
// outro tipo de recurso; o que fica fora da disponibilidade do pedido ou em outro tipo pede a confirmação com o aluno.
// Aplicada, a sugestão fixa o voo, volta o status para Pendente e muda o pedido; desfeita, tudo volta como estava
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine } from '../../js/engine.js';
import { pinoDoVoo, fixosAoAprovar } from '../../js/fixos.js';
import { hm } from '../../js/format.js';
import { cancelamentoAproveitavel, sugerirParaCancelado, vagasDaListaDeEspera, aproveitarCancelado, desfazerAproveitamento, sugestoesDoRejeitado, sugerirReparos, repararComOPedido, dataQueAindaVoa } from '../../js/reparo.js';
import { validarReversao, motivoParaNaoDesfazerEdicao } from '../../js/reversoes.js';
import { rejeicoesDosPedidos } from '../../js/rejeicoes.js';
import { pedidoDoAluno } from '../../js/voo.js';
import { gerarCenario, comEscolhas } from '../helpers/cenarios.js';
import { aluno, cenario, instrutor, apenas, GROUND_C152 } from '../helpers/montar.js';

// Escala o dia, cancela o voo do aluno com o motivo e devolve o estado e a escala de depois
function cancelado(base, stuId, motivo, extra = {}) {
  const antes = runAllocationEngine(base);
  const voo = antes.out.find(o => o.stuId === stuId);
  const estado = {
    ...base, fixos: { [voo.fKey]: pinoDoVoo(voo) }, fStatus: { [voo.fKey]: 'Cancelado' }, fObs: { [voo.fKey]: { motivo } }, ...extra
  };
  return { estado, resultado: runAllocationEngine(estado), voo };
}
const textos = r => r.opcoes.map(o => o.texto);
const DIA = { data: '2026-11-11', hoje: '2026-11-10' };

describe('Quando o voo cancelado tem sugestões', () => {
  const base = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] });
  it('o cancelado da data aberta, de hoje em diante', () => {
    const { estado, resultado, voo } = cancelado(base(), 1000, 'Instrutor indisponível');
    const linha = resultado.out.find(o => o.fKey === voo.fKey);
    assert.equal(cancelamentoAproveitavel(estado, linha, DIA), true);
    assert.equal(cancelamentoAproveitavel(estado, linha, { data: '2026-11-09', hoje: '2026-11-10' }), false, 'data passada');
  });
  it('não quando o aluno faltou, quando o voo tem resultado ou quando não está cancelado', () => {
    const ausente = cancelado(base(), 1000, 'Aluno ausente');
    assert.equal(cancelamentoAproveitavel(ausente.estado, ausente.resultado.out[0], DIA), false);
    const comResultado = cancelado(base(), 1000, 'Meteorologia');
    comResultado.estado.resultados = { doDia: [{ voo: comResultado.voo.fKey }] };
    assert.equal(cancelamentoAproveitavel(comResultado.estado, comResultado.resultado.out[0], DIA), false);
    const confirmado = runAllocationEngine(base());
    assert.equal(cancelamentoAproveitavel(base(), confirmado.out[0], DIA), false);
  });
});

describe('O que pode voar no lugar do cancelado', () => {
  it('"Instrutor indisponível": o mesmo horário e avião com outro instrutor; nunca o que faltou, mesmo marcado como vindo', () => {
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] }), 1000, 'Instrutor indisponível');
    const r = sugerirParaCancelado(estado, resultado, voo.fKey);
    const outro = voo.insId === 1 ? 2 : 1;
    assert.equal(r.opcoes[0].tipo, 'instrutor');
    assert.deepEqual(r.opcoes[0].mudancas, { a: voo.a, b: voo.b, r: voo.r, insId: outro });
    assert.ok(r.opcoes.every(o => o.mudancas.insId !== voo.insId), 'o instrutor que faltou fica de fora');
  });

  it('"Manutenção da aeronave": outro avião no mesmo horário; nunca o que parou', () => {
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] }), 1000, 'Manutenção da aeronave');
    const r = sugerirParaCancelado(estado, resultado, voo.fKey);
    assert.ok(r.opcoes.length > 0);
    assert.equal(r.opcoes[0].tipo, 'aviao');
    assert.equal(r.opcoes[0].mudancas.a, voo.a);
    assert.ok(r.opcoes.every(o => o.mudancas.r !== voo.r), 'o avião que parou fica de fora');
  });

  it('"Meteorologia" e "Operacional": o horário sai; o mais perto, antes ou depois', () => {
    for (const motivo of ['Meteorologia', 'Operacional']) {
      const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] }), 1000, motivo);
      const r = sugerirParaCancelado(estado, resultado, voo.fKey);
      assert.ok(r.opcoes.every(o => o.mudancas.a !== voo.a), `${motivo}: nada no mesmo horário`);
      assert.equal(r.opcoes[0].tipo, 'horario');
    }
  });

  it('"Outro": nada sai da busca, e o primeiro é o mesmo horário e avião com outro instrutor (nunca o próprio voo cancelado)', () => {
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] }), 1000, 'Outro');
    const r = sugerirParaCancelado(estado, resultado, voo.fKey);
    assert.equal(r.opcoes[0].tipo, 'instrutor');
    assert.deepEqual(r.opcoes[0].mudancas, { a: voo.a, b: voo.b, r: voo.r, insId: voo.insId === 1 ? 2 : 1 });
    const mesmo = o => o.mudancas.a === voo.a && o.mudancas.r === voo.r && o.mudancas.insId === voo.insId;
    assert.ok(!r.opcoes.some(mesmo), textos(r).join(' | '));
    // O outro avião no mesmo horário fica com o instrutor de antes
    assert.ok(r.opcoes.some(o => o.tipo === 'aviao' && o.mudancas.insId === voo.insId), textos(r).join(' | '));
  });

  it('"Manutenção da aeronave": o outro avião no mesmo horário fica com o instrutor de antes quando ele está livre, e o escolhido do pedido não muda', () => {
    // O aluno escolheu o Instrutor 02; o Instrutor 01 vem antes na lista dos que servem
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1, insId: 2 })] }), 1000, 'Manutenção da aeronave');
    assert.equal(voo.insId, 2);
    const [primeira] = sugerirParaCancelado(estado, resultado, voo.fKey).opcoes;
    assert.equal(primeira.tipo, 'aviao');
    assert.equal(primeira.mudancas.insId, 2, primeira.texto);
    aproveitarCancelado(estado, resultado, voo.fKey, primeira);
    assert.equal(estado.stu[0].insId, 2);
  });

  it('hoje, visto às 08:30: o voo das 08:20 não tem nada às 08:20 nem antes, e o resto do dia continua', () => {
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 500, p2: -1 })] }), 1000, 'Instrutor indisponível');
    assert.equal(hm(voo.a), '08:20');
    const r = sugerirParaCancelado(estado, resultado, voo.fKey, { depoisDe: 510 });
    assert.ok(r.opcoes.length > 0, 'a tarde continua');
    assert.ok(r.opcoes.every(o => o.mudancas.a > 510), r.opcoes.map(o => o.texto).join(' | '));
  });

  it('fora da disponibilidade do pedido, a sugestão pede a confirmação com o aluno e muda a disponibilidade', () => {
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1, jan: 'h390' })] }), 1000, 'Meteorologia');
    const r = sugerirParaCancelado(estado, resultado, voo.fKey);
    assert.ok(r.opcoes[0].confirmar.startsWith('Confirme com o aluno'), textos(r).join(' | '));
    assert.equal(r.opcoes[0].pedido.jan, `h${r.opcoes[0].mudancas.a}`);
  });

  it('outro tipo de recurso que a missão permite vem por último, com a confirmação e o tipo novo no pedido', () => {
    // Só um C152 (em manutenção pelo motivo): o Voo Local voa também no C172
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })], semAeronaves: apenas('C152', 'PR-VOB') });
    const { estado, resultado, voo } = cancelado(base, 1000, 'Manutenção da aeronave');
    const r = sugerirParaCancelado(estado, resultado, voo.fKey);
    const tipo = r.opcoes.find(o => o.tipo === 'tipo');
    assert.ok(tipo, textos(r).join(' | '));
    assert.notEqual(tipo.pedido.eq, voo.eqType);
    assert.match(tipo.confirmar, /Confirme com o aluno/);
    assert.equal(r.opcoes.at(-1), tipo);
  });

  it('os horários fechados valem também no mesmo horário: fechado o horário do voo, nada nele, e o porquê diz isso', () => {
    // Cancelado pelo instrutor às 10:10, com outro instrutor livre; depois, o período das 10:10 fechado no dia
    const { estado, voo } = cancelado(cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] }), 1000, 'Instrutor indisponível');
    assert.equal(hm(voo.a), '10:10');
    estado.win = estado.win.map((w, i) => (i === 2 ? false : w));
    const resultado = runAllocationEngine(estado);
    const r = sugerirParaCancelado(estado, resultado, voo.fKey);
    assert.ok(r.opcoes.length > 0, 'os outros horários continuam');
    assert.ok(r.opcoes.every(o => o.mudancas.a !== voo.a), r.opcoes.map(o => o.texto).join(' | '));
    // Sem nenhum outro horário aberto: impossível, com o horário fechado no mesmo horário
    estado.win = estado.win.map(() => false);
    const nada = sugerirParaCancelado(estado, runAllocationEngine(estado), voo.fKey);
    assert.deepEqual(nada.opcoes, []);
    // Todas as janelas de antes fechadas: o dia todo fechado (fechamentosDoWin), e o texto diz o intervalo
    assert.equal(nada.impossivel[0], 'No mesmo horário: o horário está fechado nesta data (00:00–24:00).');
  });

  it('o voo atrasado ocupa o avião e o instrutor no horário novo: nada sobre a nova decolagem dele', () => {
    // Um C152 só: o Aluno 1001 às 06:30, atrasado para as 10:10; o Aluno 1000, às 08:20 e só disponível às 10:10,
    // cancelado pela meteorologia
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9), instrutor(3, 9)], stu: [aluno(1000, { p1: 500, p2: -1, jan: 'h610' }), aluno(1001, { p1: 390, p2: -1 })] });
    for (const r of Object.keys(base.av)) if (r !== 'PP-LJV') base.av[r] = false;
    const estado = {
      ...base,
      fixos: { '1000_0_1': { a: 500, b: 560, r: 'PP-LJV', insId: 1 }, '1001_0_1': { a: 390, b: 450, r: 'PP-LJV', insId: 2 } },
      fStatus: { '1000_0_1': 'Cancelado', '1001_0_1': 'Atrasado' },
      fObs: { '1000_0_1': { motivo: 'Meteorologia' }, '1001_0_1': { novoInicio: 610 } }
    };
    const resultado = runAllocationEngine(estado);
    const { opcoes } = sugerirParaCancelado(estado, resultado, '1000_0_1');
    const sobre = o => o.mudancas.r === 'PP-LJV' && o.mudancas.a < 670 && o.mudancas.b > 610;
    assert.ok(!opcoes.some(sobre), opcoes.map(o => o.texto).join(' | '));
    // Aplicada, a primeira não cria o aviso do atraso sobre ela
    if (opcoes.length) {
      aproveitarCancelado(estado, resultado, '1000_0_1', opcoes[0]);
      assert.ok(!runAllocationEngine(estado).al.some(a => /se sobrepõe/.test(a.m)));
    }
  });

  it('sem nada: "impossível", com o porquê de cada grupo', () => {
    // Um instrutor só, que faltou
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] }), 1000, 'Instrutor indisponível');
    const r = sugerirParaCancelado(estado, resultado, voo.fKey);
    assert.deepEqual(r.opcoes, []);
    assert.equal(r.impossivel.length, 3);
    assert.match(r.impossivel[0], /^No mesmo horário/);
  });
});

// "Impossível nesta data": o porquê de cada grupo é o que de fato impediu cada horário (o horário fechado nesta data, o
// horário que já passou, o aluno ocupado, nenhum avião ou instrutor), com os horários
describe('O porquê do impossível', () => {
  it('o dia todo fechado, com o avião e os instrutores livres: os outros horários e o outro tipo dizem que estão fechados', () => {
    const { estado, voo } = cancelado(cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] }), 1000, 'Meteorologia');
    estado.win = estado.win.map(() => false);
    const r = sugerirParaCancelado(estado, runAllocationEngine(estado), voo.fKey);
    assert.deepEqual(r.opcoes, []);
    assert.equal(r.impossivel[0], 'No mesmo horário: o voo foi cancelado por meteorologia nele.');
    assert.match(r.impossivel[1], /^Em outro horário: o horário está fechado nesta data \(06:30, 08:20, 11:30/);
    assert.doesNotMatch(r.impossivel[1], /livres/);
    assert.match(r.impossivel[2], /^Em outro tipo de recurso: no C172, o horário está fechado nesta data \(06:30/);
  });

  it('hoje, depois do último horário: os outros horários já passaram', () => {
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] }), 1000, 'Meteorologia');
    const r = sugerirParaCancelado(estado, resultado, voo.fKey, { depoisDe: 1200 });
    assert.deepEqual(r.opcoes, []);
    assert.match(r.impossivel[1], /^Em outro horário: já passou \(06:30, 08:20/);
  });

  it('um instrutor só, o que faltou: em cada horário, nenhum instrutor que sirva', () => {
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] }), 1000, 'Instrutor indisponível');
    const r = sugerirParaCancelado(estado, resultado, voo.fKey);
    assert.match(r.impossivel[1], /^Em outro horário: nenhum instrutor que sirva \(08:20/);
    assert.equal(r.impossivel[0], 'No mesmo horário: nenhum avião com um instrutor que sirva.');
  });
});

describe('Aplicar e desfazer', () => {
  it('o pedido com o instrutor escolhido recebe o instrutor da sugestão; o sem escolha continua sem (o pino guarda o instrutor)', () => {
    const comEscolha = cancelado(cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1, insId: 1 })] }), 1000, 'Instrutor indisponível');
    assert.equal(comEscolha.voo.insId, 1);
    const [opcao] = sugerirParaCancelado(comEscolha.estado, comEscolha.resultado, comEscolha.voo.fKey).opcoes;
    aproveitarCancelado(comEscolha.estado, comEscolha.resultado, comEscolha.voo.fKey, opcao);
    assert.equal(comEscolha.estado.stu[0].insId, 2);
  });

  it('o voo fica fixo no lugar novo, volta a Pendente sem o motivo; o pedido sem escolha fica sem; desfeito, tudo volta', () => {
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] }), 1000, 'Instrutor indisponível');
    const antes = structuredClone({ fixos: estado.fixos, fStatus: estado.fStatus, fObs: estado.fObs, stu: estado.stu });
    const [opcao] = sugerirParaCancelado(estado, resultado, voo.fKey).opcoes;
    const rev = aproveitarCancelado(estado, resultado, voo.fKey, opcao);
    assert.equal(rev.kind, 'aproveitarCancelado');
    assert.equal(estado.fStatus[voo.fKey], 'Pendente');
    assert.equal(estado.fObs[voo.fKey], undefined);
    assert.deepEqual(estado.fixos[voo.fKey], { ...opcao.mudancas, agendado: true });
    assert.equal(estado.stu[0].insId, undefined, 'o instrutor fica no pino, não vira escolha do pedido');
    // O motor deixa o voo no lugar, sem conflito
    const depois = runAllocationEngine(estado);
    const linha = depois.out.find(o => o.fKey === voo.fKey);
    assert.deepEqual([linha.a, linha.r, linha.insId, linha.conflito], [opcao.mudancas.a, opcao.mudancas.r, opcao.mudancas.insId, undefined]);
    desfazerAproveitamento(estado, rev);
    assert.deepEqual({ fixos: estado.fixos, fStatus: estado.fStatus, fObs: estado.fObs, stu: estado.stu }, antes);
  });
});

// No máximo 6 voos locais saem no mesmo horário (a regra do 7º local do plano: avisa e pede a confirmação). A sugestão
// que põe o voo local num horário que já tem 6 diz que ele será o 7º e pede a confirmação (dois cliques, "Aplicar mesmo
// assim"); a ordem não muda
describe('O limite de voos locais no horário', () => {
  // Seis Voos Locais às 10:10 e o do Aluno 1006 às 08:20, com sete instrutores
  const seisAs1010 = () => cenario({
    ins: [1, 2, 3, 4, 5, 6, 7].map(id => instrutor(id, 9)),
    stu: [...[1000, 1001, 1002, 1003, 1004, 1005].map(id => aluno(id, { p1: 610, p2: -1 })), aluno(1006, { p1: 500, p2: -1 })]
  });

  // A escala aprovada: os seis das 10:10 ficam fixos, e o 7º sai com eles (o motor avisa)
  const aprovada = (estado) => {
    const v = runAllocationEngine(seisAs1010()).out;
    return { ...estado, fixos: { ...fixosAoAprovar({}, v.filter(o => o.stuId !== 1006)), ...estado.fixos }, aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' } };
  };

  it('o cancelado que só pode às 10:10: a sugestão das 10:10 avisa que ele será o 7º e pede a confirmação', () => {
    const c = cancelado(seisAs1010(), 1006, 'Meteorologia');
    const estado = aprovada(c.estado), voo = c.voo;
    assert.equal(hm(voo.a), '08:20');
    estado.stu.find(s => s.id === 1006).jan = 'h610';
    const resultado = runAllocationEngine(estado);
    assert.equal(resultado.out.filter(o => o.a === 610).length, 6);
    const [primeira] = sugerirParaCancelado(estado, resultado, voo.fKey).opcoes;
    assert.equal(hm(primeira.mudancas.a), '10:10');
    assert.equal(primeira.confirmar, 'Às 10:10, o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.');
    assert.equal(primeira.armado, 'Aplicar mesmo assim');
    // Aplicada, são 7 às 10:10, e nenhum dos seis muda
    aproveitarCancelado(estado, resultado, voo.fKey, primeira);
    assert.equal(runAllocationEngine(estado).out.filter(o => o.a === 610).length, 7);
  });

  it('na escala não aprovada, o motor tira um dos seis do horário: a sugestão diz qual, e não que o voo é o 7º', () => {
    const { estado, voo } = cancelado(seisAs1010(), 1006, 'Meteorologia');
    estado.stu.find(s => s.id === 1006).jan = 'h610';
    const resultado = runAllocationEngine(estado);
    const [primeira] = sugerirParaCancelado(estado, resultado, voo.fKey).opcoes;
    assert.equal(hm(primeira.mudancas.a), '10:10');
    assert.doesNotMatch(primeira.confirmar, /7º voo local/);
    assert.match(primeira.confirmar, /^Muda também outro voo: Aluno 1005, das 10:10 para as 11:30/);
    assert.deepEqual(primeira.muda, ['1005_0_1']);
    assert.equal(primeira.armado, 'Aplicar mesmo assim');
  });

  it('com a confirmação com o aluno também, as duas frases, e o botão armado é o do aluno', () => {
    // Só às 06:30, com o período das 06:30 fechado: o mais perto fora da disponibilidade é o das 10:10
    const c = cancelado(seisAs1010(), 1006, 'Meteorologia');
    const estado = aprovada(c.estado), voo = c.voo;
    estado.stu.find(s => s.id === 1006).jan = 'h390';
    estado.win = estado.win.map((w, i) => (i === 0 ? false : w));
    const resultado = runAllocationEngine(estado);
    const [primeira] = sugerirParaCancelado(estado, resultado, voo.fKey).opcoes;
    assert.equal(hm(primeira.mudancas.a), '10:10');
    assert.equal(primeira.confirmar, 'Confirme com o aluno: às 10:10, fora da disponibilidade do pedido. Às 10:10, o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.');
    assert.equal(primeira.armado, 'Confirmei com o aluno');
  });

  it('o conflito que passa para as 10:10: a sugestão avisa que ele será o 7º', () => {
    const base = seisAs1010();
    const v = runAllocationEngine(base).out, v0 = v.find(o => o.stuId === 1006);
    // A escala aprovada; às 08:20 nenhum instrutor vem mais
    const aw = Array(9).fill(true); aw[1] = false;
    const estado = { ...base, fixos: fixosAoAprovar({}, v), aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' }, ins: base.ins.map(x => ({ ...x, aw: [...aw] })) };
    const resultado = runAllocationEngine(estado);
    const voo = resultado.out.find(o => o.fKey === v0.fKey);
    assert.ok(voo.conflito);
    const [primeira] = sugerirReparos(estado, resultado, voo.fKey).filter(o => o.mudancas);
    assert.equal(hm(primeira.mudancas.a), '10:10');
    assert.match(primeira.confirmar, /^Às 10:10, o 7º voo local do horário/);
    assert.equal(primeira.armado, 'Aplicar mesmo assim');
  });

  it('a troca no mesmo horário do conflito não avisa (o voo já sai nele); o horário com menos de 6 não avisa', () => {
    // A escala aprovada (na não aprovada, o motor refaz o voo das 08:20 em volta da troca, e a sugestão diz isso)
    const base = seisAs1010();
    const v = runAllocationEngine(base).out, v0 = v.find(o => o.stuId === 1000);
    const estado = { ...base, fixos: fixosAoAprovar({}, v), aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' }, ins: base.ins.map(x => (x.id === v0.insId ? { ...x, on: false } : x)) };
    const resultado = runAllocationEngine(estado);
    // (as trocas no mesmo horário: o horário mais perto e o outro tipo vêm depois delas)
    const opcoes = sugerirReparos(estado, resultado, v0.fKey).filter(o => o.mudancas && o.mudancas.a === undefined);
    assert.ok(opcoes.length > 0);
    assert.ok(opcoes.every(o => !o.confirmar), opcoes.map(o => o.texto).join(' | '));
    const outro = cancelado(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] }), 1000, 'Meteorologia');
    assert.ok(sugerirParaCancelado(outro.estado, outro.resultado, outro.voo.fKey).opcoes.every(o => !o.confirmar || !/voo local/.test(o.confirmar)));
  });
});

// O pedido recusado porque o instrutor escolhido não serve (js/reparo.js, sugestoesDoRejeitado): outro instrutor, ou
// "Automático", que encaixa o pedido sem tirar nem mudar nenhum outro voo
describe('O pedido recusado pelo instrutor escolhido', () => {
  it('o escolhido fora do dia: outro instrutor e "Automático", cada um dizendo onde o voo entra', () => {
    const estado = cenario({ ins: [instrutor(1, 9, { on: false }), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1, insId: 1 })] });
    const resultado = runAllocationEngine(estado);
    const fKey = [...rejeicoesDosPedidos(estado, resultado).keys()][0];
    assert.equal(rejeicoesDosPedidos(estado, resultado).get(fKey).codigo, 'instrutor-escolhido');
    const opcoes = sugestoesDoRejeitado(estado, resultado, fKey);
    assert.deepEqual(opcoes.map(o => o.insId), [2, 0]);
    assert.match(opcoes[0].texto, /^Com Instrutor 02: \d\d:\d\d no /);
    assert.match(opcoes[1].texto, /^Automático \(o app escolhe Instrutor 02\)/);
  });

  it('na escala de hoje, nada num horário que já passou: o motor encaixaria às 06:30, e às 08:30 não há sugestão', () => {
    const estado = cenario({ ins: [instrutor(1, 9, { on: false }), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1, insId: 1 })] });
    const resultado = runAllocationEngine(estado);
    const fKey = [...rejeicoesDosPedidos(estado, resultado).keys()][0];
    assert.equal(sugestoesDoRejeitado(estado, resultado, fKey).length, 2);
    assert.deepEqual(sugestoesDoRejeitado(estado, resultado, fKey, { depoisDe: 510 }), []);
    assert.equal(sugestoesDoRejeitado(estado, resultado, fKey, { depoisDe: 380 }).length, 2, 'antes das 06:30, as duas');
  });

  it('só de hoje em diante: a data passada não tem sugestões (como o voo cancelado)', () => {
    assert.equal(dataQueAindaVoa({ data: '2026-11-09', hoje: '2026-11-10' }), false);
    assert.equal(dataQueAindaVoa({ data: '2026-11-10', hoje: '2026-11-10' }), true);
    assert.equal(dataQueAindaVoa({ data: '2026-11-11', hoje: '2026-11-10' }), true);
    assert.equal(dataQueAindaVoa({ data: null, hoje: '2026-11-10' }), false);
  });

  it('em 80 sementes com escolhas: cada sugestão aplicada faz o pedido entrar sem mudar nenhum outro voo', () => {
    let vistas = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const estado = comEscolhas(gerarCenario(seed), seed);
      const resultado = runAllocationEngine(estado);
      for (const [fKey, err] of rejeicoesDosPedidos(estado, resultado)) {
        if (err.codigo !== 'instrutor-escolhido') continue;
        for (const opcao of sugestoesDoRejeitado(estado, resultado, fKey)) {
          vistas++;
          const copia = { ...estado, stu: structuredClone(estado.stu) };
          const [stuId, mid] = fKey.split('_').map(Number);
          const ref = pedidoDoAluno(copia.stu.find(s => s.id === stuId), mid);
          if (opcao.insId) ref.insId = opcao.insId; else delete ref.insId;
          const depois = runAllocationEngine(copia);
          assert.ok(depois.out.some(o => o.fKey === fKey), `seed ${seed}: ${fKey} entra`);
          const lugar = o => [o.fKey, o.a, o.b, o.r, o.insId].join('|');
          assert.deepEqual(depois.out.filter(o => o.fKey !== fKey).map(lugar), resultado.out.map(lugar), `seed ${seed}: ${opcao.texto}`);
        }
      }
    }
    assert.ok(vistas > 0, 'nenhuma sugestão nas sementes');
  });
});

describe('A disponibilidade do pedido e a lista do conflito', () => {
  // J (N13): a disponibilidade é o horário exato do pedido; fora dele, a sugestão pede a confirmação com o aluno
  it('o pedido com horário exato cancelado no horário dele: todo outro horário pede a confirmação com o aluno', () => {
    // O voo das 11:30 (o pedido da Agenda às 11:30), cancelado pela meteorologia: o mesmo horário não serve
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 690, p2: -1, jan: 'h690' })] }), 1000, 'Meteorologia');
    assert.equal(hm(voo.a), '11:30');
    const opcoes = sugerirParaCancelado(estado, resultado, voo.fKey).opcoes;
    assert.ok(opcoes.length > 0);
    for (const o of opcoes) {
      assert.notEqual(o.mudancas.a, voo.a);
      assert.match(o.confirmar, /^Confirme com o aluno: às \d\d:\d\d, fora da disponibilidade do pedido[.,]/, o.texto);
    }
  });

  it('o conflito sem nada no mesmo horário nem depois ganha o horário mais perto antes, dentro da disponibilidade', () => {
    // O instrutor só pode até as 12:00 (período da tarde fechado para ele): o voo das 14:30 não tem nada depois
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 870, p2: -1 })] });
    const antes = runAllocationEngine(base);
    const v0 = antes.out[0];
    const aw = Array(9).fill(true); for (let w = 4; w < 9; w++) aw[w] = false;
    const estado = { ...base, fixos: { [v0.fKey]: pinoDoVoo(v0) }, ins: [instrutor(1, 9, { aw })] };
    const resultado = runAllocationEngine(estado);
    const voo = resultado.out[0];
    assert.ok(voo.conflito);
    const opcoes = sugerirReparos(estado, resultado, voo.fKey).filter(o => o.mudancas);
    assert.ok(opcoes.length > 0, 'o horário de antes aparece');
    assert.equal(opcoes[0].tipo, 'horario');
    assert.ok(opcoes[0].mudancas.a < voo.a && !opcoes[0].confirmar && !opcoes[0].pedido, 'o de antes, sem a confirmação, não muda o pedido');
    // Depois dele, só o outro tipo, que pede a confirmação com o aluno
    assert.deepEqual(opcoes.slice(1).map(o => o.tipo), ['tipo']);
  });
});

// A lista do conflito também ganha os dois últimos grupos do voo cancelado: o horário mais perto fora da disponibilidade
// do pedido e outro tipo de recurso, os dois com a confirmação com o aluno. Aplicada, a sugestão muda o voo fixo e o
// pedido (a disponibilidade, o tipo), e desfeita devolve os dois como estavam
describe('O conflito: outro tipo e o horário fora da disponibilidade', () => {
  // O voo das 08:20, do pedido da Agenda às 08:20, fixo com o único instrutor, que agora só vem à tarde: nada às 08:20
  function conflitoDeManha() {
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 500, p2: -1, jan: 'h500' })] });
    const v0 = runAllocationEngine(base).out[0];
    const aw = Array(9).fill(true); for (let w = 0; w < 4; w++) aw[w] = false;
    const estado = { ...base, fixos: { [v0.fKey]: pinoDoVoo(v0) }, fObs: {}, ins: [instrutor(1, 9, { aw })] };
    const resultado = runAllocationEngine(estado);
    return { estado, resultado, voo: resultado.out[0] };
  }

  it('sem nada na disponibilidade: o horário mais perto fora dela e outro tipo, com a confirmação e o que muda no pedido', () => {
    const { estado, resultado, voo } = conflitoDeManha();
    assert.equal(hm(voo.a), '08:20');
    assert.ok(voo.conflito, 'o instrutor não vem de manhã');
    const opcoes = sugerirReparos(estado, resultado, voo.fKey).filter(o => o.mudancas);
    assert.deepEqual(opcoes.map(o => o.tipo), ['horario', 'tipo'], opcoes.map(o => o.texto).join(' | '));
    const [horario, tipo] = opcoes;
    assert.equal(hm(horario.mudancas.a), '12:40');
    assert.match(horario.confirmar, /^Confirme com o aluno: às 12:40, fora da disponibilidade do pedido\./);
    assert.deepEqual(horario.pedido, { insId: 1, jan: 'h760' });
    assert.equal(tipo.pedido.eq, 'C172');
    assert.match(tipo.confirmar, /no C172/);
  });

  it('aplicada, o voo fixo muda e o pedido também; desfeita, os dois voltam como estavam', () => {
    const { estado, resultado, voo } = conflitoDeManha();
    const antes = structuredClone({ fixos: estado.fixos, fStatus: estado.fStatus, fObs: estado.fObs, stu: estado.stu });
    const tipo = sugerirReparos(estado, resultado, voo.fKey).find(o => o.tipo === 'tipo');
    const rev = repararComOPedido(estado, resultado, voo.fKey, tipo);
    assert.equal(rev.kind, 'aproveitarCancelado');
    assert.deepEqual(estado.fixos[voo.fKey], { ...antes.fixos[voo.fKey], ...tipo.mudancas });
    assert.equal(estado.stu[0].eq, 'C172');
    assert.equal(estado.fStatus[voo.fKey], antes.fStatus[voo.fKey], 'o status fica');
    const depois = runAllocationEngine(estado).out.find(o => o.fKey === voo.fKey);
    assert.deepEqual([depois.a, depois.r, depois.conflito], [tipo.mudancas.a, tipo.mudancas.r, undefined]);
    assert.ok(validarReversao({ ...rev, label: '↶ Reverter' }, estado.frota), 'a reversão é válida');
    desfazerAproveitamento(estado, validarReversao({ ...rev, label: '↶ Reverter' }, estado.frota));
    assert.deepEqual({ fixos: estado.fixos, fStatus: estado.fStatus, fObs: estado.fObs, stu: estado.stu }, antes);
  });

  it('a sugestão que não muda o pedido não traz o pedido (o reparo de sempre, com a escolha do instrutor)', () => {
    // O instrutor do voo fixo não vem mais: outro no mesmo horário
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] });
    const v0 = runAllocationEngine(base).out[0];
    const estado = { ...base, fixos: { [v0.fKey]: pinoDoVoo(v0) }, ins: base.ins.map(x => (x.id === v0.insId ? { ...x, on: false } : x)) };
    // (a troca no mesmo horário; o outro tipo, que vem depois, muda o pedido)
    const opcoes = sugerirReparos(estado, runAllocationEngine(estado), v0.fKey).filter(o => o.mudancas && o.tipo !== 'tipo');
    assert.ok(opcoes.length > 0);
    assert.ok(opcoes.every(o => o.pedido === undefined), opcoes.map(o => o.texto).join(' | '));
  });
});

// A sugestão conferida no motor: na escala não aprovada, o motor refaz em volta dos fixos os voos que não são fixos. A
// sugestão que muda ou tira um deles diz quais e pede a confirmação ("Aplicar mesmo assim"); a que não muda nenhum é a
// "sem mexer nos outros voos"
describe('O que a sugestão muda nos outros voos', () => {
  const lugar = o => [o.a, o.b, o.r, o.insId].join('|');
  // Os outros voos que mudam ou saem quando a sugestão é aplicada (aplicar: no estado), contra a escala de antes
  function mudados(estado, resultado, unidade, aplicar) {
    const copia = { ...estado, stu: structuredClone(estado.stu) };
    aplicar(copia);
    const depois = new Map(runAllocationEngine(copia).out.map(o => [o.fKey, o]));
    return { depois, chaves: runAllocationEngine(estado).out.filter(o => !unidade.includes(o.fKey) && (!depois.has(o.fKey) || lugar(depois.get(o.fKey)) !== lugar(o))).map(o => o.fKey) };
  }

  it('cancelado pelo instrutor, na escala não aprovada: a sugestão que dá o voo de outro aluno ao instrutor que faltou diz isso', () => {
    // 08:20 Aluno 1001 com o Instrutor 02 e 10:10 Aluno 1000 com o Instrutor 01 (o motor refaz o das 10:10)
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: 870 }), aluno(1001, { p1: 500, p2: 760 })] });
    const { estado, resultado, voo } = cancelado(base, 1001, 'Instrutor indisponível');
    const { opcoes } = sugerirParaCancelado(estado, resultado, voo.fKey);
    assert.ok(opcoes.length > 0);
    for (const opcao of opcoes) {
      const { chaves } = mudados(estado, resultado, [voo.fKey], e => aproveitarCancelado(e, resultado, voo.fKey, opcao));
      assert.deepEqual(opcao.muda || [], chaves, opcao.texto);
      if (chaves.length) {
        assert.match(opcao.confirmar, /Muda também outro voo: Aluno 1000/, opcao.texto);
        assert.equal(opcao.armado, /^Confirme com o aluno/.test(opcao.confirmar) ? 'Confirmei com o aluno' : 'Aplicar mesmo assim');
      }
    }
    assert.ok(opcoes.some(o => o.muda && o.muda.length), opcoes.map(o => o.texto).join(' | '));
  });

  it('o aluno da turma de Ground aproveitado, na escala não aprovada: os colegas que o motor junta a ele aparecem', () => {
    const g = { ...GROUND_C152, p1: 390, p2: -1 };
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, g), aluno(1001, g), aluno(1002, g)] }), 1001, 'Instrutor indisponível');
    const [opcao] = sugerirParaCancelado(estado, resultado, voo.fKey).opcoes;
    assert.ok(opcao);
    assert.deepEqual(opcao.muda, ['1000_0_1', '1002_0_1']);
    assert.match(opcao.confirmar, /^Muda também 2 outros voos: Aluno 1000, das 06:30 para as 08:20, com Instrutor 02; Aluno 1002, das 06:30 para as 08:20, com Instrutor 02\.$/);
  });

  it('com a Sala Ground indisponível na data (S4), nenhum horário de Ground; sem a chave da sala, os de sempre', () => {
    const g = { ...GROUND_C152, p1: 390, p2: -1 };
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, g), aluno(1001, g), aluno(1002, g)] });
    const v = runAllocationEngine(base).out, v1 = v.find(o => o.stuId === 1001);
    const aprovado = av => ({ ...base, av, fixos: fixosAoAprovar({}, v), aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' }, fStatus: { [v1.fKey]: 'Cancelado' }, fObs: { [v1.fKey]: { motivo: 'Instrutor indisponível' } } });
    const comHorario = estado => sugerirParaCancelado(estado, runAllocationEngine(estado), v1.fKey).opcoes.filter(o => o.mudancas && o.mudancas.a !== undefined);
    assert.ok(comHorario(aprovado(base.av)).length > 0, 'sem a chave, a sala está disponível');
    assert.deepEqual(comHorario(aprovado({ ...base.av, 'SALA-GROUND': false })).map(o => o.texto), []);
  });

  it('com a Sala Ground indisponível, o porquê das Sugestões diz isso, no mesmo horário e nos outros (revisão do J)', () => {
    const g = { ...GROUND_C152, p1: 500, p2: -1 };
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, g)] });
    const v = runAllocationEngine(base).out, v1 = v[0];
    const estado = { ...base, av: { ...base.av, 'SALA-GROUND': false }, fixos: fixosAoAprovar({}, v), aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' }, fStatus: { [v1.fKey]: 'Cancelado' }, fObs: { [v1.fKey]: { motivo: 'Instrutor indisponível' } } };
    const { opcoes, impossivel } = sugerirParaCancelado(estado, runAllocationEngine(estado), v1.fKey);
    assert.deepEqual(opcoes, []);
    assert.equal(impossivel[0], 'No mesmo horário: a Sala Ground está indisponível nesta data.');
    assert.match(impossivel[1], /^Em outro horário: a Sala Ground está indisponível nesta data \(06:30, 10:10, 11:30, 12:40, 13:40, 14:30, 16:20\)\.$/);
    assert.doesNotMatch(impossivel.join(' '), /a sala não está livre|nenhum avião/);
  });

  it('na escala aprovada, os mesmos casos não mudam nenhum outro voo', () => {
    const g = { ...GROUND_C152, p1: 390, p2: -1 };
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, g), aluno(1001, g), aluno(1002, g)] });
    const v = runAllocationEngine(base).out, v1 = v.find(o => o.stuId === 1001);
    const estado = { ...base, fixos: fixosAoAprovar({}, v), aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' }, fStatus: { [v1.fKey]: 'Cancelado' }, fObs: { [v1.fKey]: { motivo: 'Instrutor indisponível' } } };
    const resultado = runAllocationEngine(estado);
    const { opcoes } = sugerirParaCancelado(estado, resultado, v1.fKey);
    assert.ok(opcoes.length > 0);
    assert.ok(opcoes.every(o => !o.muda && !o.confirmar), opcoes.map(o => `${o.texto} ${o.confirmar}`).join(' | '));
  });

  it('em 40 dias gerados, aprovados ou não: o voo fica onde a sugestão diz, e ela lista exatamente os outros voos que mudam', () => {
    const MOTIVOS = ['Meteorologia', 'Manutenção da aeronave', 'Instrutor indisponível', 'Operacional', 'Outro'];
    let vistas = 0, comMudanca = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const base = gerarCenario(seed);
      const v = runAllocationEngine(base).out.filter(o => !o.trecho);
      if (!v.length) continue;
      const voo = v[(seed * 7) % v.length];
      for (const aprovadaAgora of [false, true]) {
        const motivo = MOTIVOS[seed % MOTIVOS.length];
        const fixos = aprovadaAgora ? fixosAoAprovar({}, v) : { [voo.fKey]: pinoDoVoo(voo) };
        const estado = { ...base, fixos, ...(aprovadaAgora ? { aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' } } : {}), fStatus: { [voo.fKey]: 'Cancelado' }, fObs: { [voo.fKey]: { motivo } } };
        const resultado = runAllocationEngine(estado);
        for (const opcao of sugerirParaCancelado(estado, resultado, voo.fKey).opcoes) {
          vistas++;
          const { depois, chaves } = mudados(estado, resultado, [voo.fKey], e => aproveitarCancelado(e, resultado, voo.fKey, opcao));
          const novo = depois.get(voo.fKey);
          assert.deepEqual([novo.a, novo.insId, ...(voo.isGround ? [] : [novo.r])], [opcao.mudancas.a, opcao.mudancas.insId, ...(voo.isGround ? [] : [opcao.mudancas.r])], `seed ${seed}: ${opcao.texto}`);
          assert.deepEqual(opcao.muda || [], chaves, `seed ${seed} (aprovada: ${aprovadaAgora}): ${opcao.texto}`);
          if (aprovadaAgora) assert.deepEqual(chaves, [], `seed ${seed}: na aprovada nada muda`);
          if (chaves.length) comMudanca++;
        }
      }
    }
    assert.ok(vistas > 20 && comMudanca > 0, `${vistas} sugestões, ${comMudanca} com mudança`);
  });
});

// A lista do conflito ganha os dois últimos grupos sempre (até o máximo), não só quando nada mais serve: o horário mais
// perto (o de antes, ou fora da disponibilidade, quando já há um mais tarde) e outro tipo
describe('O conflito: os dois últimos grupos sempre', () => {
  const aprovacao = { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' };
  it('com um horário mais tarde, o outro tipo também aparece', () => {
    // O único instrutor só vem à tarde: o voo das 08:20 passa para as 12:40 ou vai para o C172
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 500, p2: -1 })] });
    const v0 = runAllocationEngine(base).out[0];
    const aw = Array(9).fill(true); for (let w = 0; w < 4; w++) aw[w] = false;
    const estado = { ...base, fixos: { [v0.fKey]: pinoDoVoo(v0) }, aprovacao, ins: [instrutor(1, 9, { aw })] };
    const resultado = runAllocationEngine(estado);
    const opcoes = sugerirReparos(estado, resultado, v0.fKey).filter(o => o.mudancas);
    assert.deepEqual(opcoes.map(o => o.tipo), ['horario', 'tipo'], opcoes.map(o => o.texto).join(' | '));
    assert.ok(opcoes[0].mudancas.a > v0.a && !opcoes[0].confirmar);
    assert.match(opcoes[1].confirmar, /^Confirme com o aluno: .*no C172\./);
  });

  it('com outro instrutor no mesmo horário, o horário mais perto e o outro tipo vêm depois, até o máximo', () => {
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] });
    const v = runAllocationEngine(base).out;
    const estado = { ...base, fixos: fixosAoAprovar({}, v), aprovacao, ins: base.ins.map(x => (x.id === v[0].insId ? { ...x, on: false } : x)) };
    const resultado = runAllocationEngine(estado);
    const opcoes = sugerirReparos(estado, resultado, v[0].fKey, { maximo: 5 }).filter(o => o.mudancas);
    assert.deepEqual(opcoes.map(o => o.tipo), ['instrutor', 'horario', 'tipo'], opcoes.map(o => o.texto).join(' | '));
    assert.equal(sugerirReparos(estado, resultado, v[0].fKey).filter(o => o.mudancas).length, 3);
  });
});

describe('A reversão do aproveitamento', () => {
  it('validarReversao aceita a que aproveitarCancelado devolve e recusa as malformadas', () => {
    const { estado, resultado, voo } = cancelado(cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] }), 1000, 'Instrutor indisponível');
    const [opcao] = sugerirParaCancelado(estado, resultado, voo.fKey).opcoes;
    const rev = aproveitarCancelado(estado, resultado, voo.fKey, opcao);
    const valida = validarReversao({ ...rev, label: '↶ Reverter' }, estado.frota);
    assert.deepEqual(valida.voos, rev.voos);
    assert.equal(valida.pedidos.length, 1);
    for (const ruim of [{ ...rev, voos: [] }, { ...rev, voos: [{ fKey: 'x' }] }, { ...rev, pedidos: [{ stuId: 1000, mid: 0, pedido: { mis: 'Inexistente', fly: true } }] }]) {
      assert.equal(validarReversao(ruim, estado.frota), null);
    }
  });
});

// A turma de Ground (revisão de mecânica): o aluno aproveitado em outro horário sai da turma; a sala ocupada não entra
// no mesmo horário; o voo não sai antes do Ground de que depende
describe('O Ground no voo cancelado', () => {
  const turma = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { ...GROUND_C152, p1: 390, p2: -1 }), aluno(1001, { ...GROUND_C152, p1: 390, p2: -1 })] });

  it('um aluno da turma aproveitado em outro horário vira outra turma: ocupa a sala e o instrutor no horário novo', () => {
    const base = turma();
    const antes = runAllocationEngine(base);
    const [v0, v1] = antes.out.filter(o => o.isGround);
    assert.equal(v0.classKey, v1.classKey);
    const estado = { ...base, fixos: { [v0.fKey]: pinoDoVoo(v0), [v1.fKey]: pinoDoVoo(v1) }, fStatus: { [v1.fKey]: 'Cancelado' }, fObs: { [v1.fKey]: { motivo: 'Meteorologia' } } };
    const resultado = runAllocationEngine(estado);
    const opcao = sugerirParaCancelado(estado, resultado, v1.fKey).opcoes.find(o => o.mudancas.a !== v0.a);
    assert.ok(opcao, 'um horário novo');
    aproveitarCancelado(estado, resultado, v1.fKey, opcao);
    assert.notEqual(estado.fixos[v1.fKey].classKey, v0.classKey);
    const depois = runAllocationEngine(estado);
    const novo = depois.out.find(o => o.fKey === v1.fKey);
    assert.equal(novo.conflito, undefined);
    assert.notEqual(novo.classKey, depois.out.find(o => o.fKey === v0.fKey).classKey);
  });

  it('no mesmo horário, só com a sala livre', () => {
    // Ground C152 cancelado às 06:30 e, de novo, outra turma (C172) na sala às 06:30
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9), instrutor(3, 9)], stu: [aluno(1000, { ...GROUND_C152, p1: 390, p2: -1 })] });
    const { estado, voo } = cancelado(base, 1000, 'Instrutor indisponível');
    estado.stu = [...estado.stu, aluno(1002, { mis: 'Ground C172', eq: 'Sala Ground', nb: 1.5, p1: 390, p2: -1 })];
    const resultado = runAllocationEngine(estado);
    const outra = resultado.out.find(o => o.stuId === 1002);
    assert.equal(outra.a, voo.a, 'a outra turma ocupa a sala no horário');
    const opcoes = sugerirParaCancelado(estado, resultado, voo.fKey).opcoes;
    assert.ok(opcoes.every(o => o.mudancas.a !== voo.a), 'nada no mesmo horário com a sala ocupada');
  });

  it('o voo não vai para antes do fim do Ground de que depende', () => {
    // Ground às 08:20–09:50 e o voo às 10:10, cancelado pela meteorologia, com o resto do dia fechado: no C152, nada às
    // 06:30 (o Ground C152 vem antes); no C172, que esse Ground não trava, as 06:30 servem
    const base = cenario({ ins: [instrutor(1, 9)], janelasOff: [3, 4, 5, 6, 7, 8],
      stu: [aluno(1000, { ...GROUND_C152, p1: 500, p2: -1 }, { extra: [{ mid: 1, mis: 'Voo Local', eq: 'C152', nb: 1, p1: 610, p2: -1, fly: true }] })] });
    const antes = runAllocationEngine(base);
    const ground = antes.out.find(o => o.isGround), local = antes.out.find(o => !o.isGround);
    assert.ok(ground && local && local.a >= ground.b, 'o dia montado');
    const estado = { ...base, fixos: { [ground.fKey]: pinoDoVoo(ground), [local.fKey]: pinoDoVoo(local) }, fStatus: { [local.fKey]: 'Cancelado' }, fObs: { [local.fKey]: { motivo: 'Meteorologia' } } };
    const resultado = runAllocationEngine(estado);
    const opcoes = sugerirParaCancelado(estado, resultado, local.fKey).opcoes;
    assert.deepEqual(opcoes.filter(o => !o.pedido.eq).map(o => o.texto), []);
    assert.deepEqual(opcoes.map(o => [o.pedido.eq, hm(o.mudancas.a)]), [['C172', '06:30']]);
  });
});

// F1e sobre o F1d: a missão do curso exige do INVA (exige, derivado no estado da escala: js/programa.js) também nas
// Sugestões. A busca do cancelado e dos dois últimos grupos do conflito nunca oferece um INVA sem a habilitação da
// missão do curso, e a cópia em que o motor confere cada sugestão (conferirNoMotor) leva o exige
describe('As Sugestões e o que a missão do curso exige do INVA', () => {
  const comEndosso = (id, lv = 9) => instrutor(id, lv, { hab: [...instrutor(id, lv).hab, 'endosso_solo'] });
  const doCurso = (id, extra = {}) => aluno(id, { etapa: 'PP-01', cursoDaEtapa: 'PP', exige: ['endosso_solo'], ...extra }, { curso: 'PP' });
  const comEle = [2];

  it('o cancelado: nunca um INVA sem a habilitação, em nenhum grupo e por nenhum motivo', () => {
    const base = () => cenario({ ins: [instrutor(1, 9), comEndosso(2), instrutor(3, 9)], stu: [doCurso(1000, { p1: 610, p2: -1 })] });
    assert.equal(runAllocationEngine(base()).out[0].insId, 2, 'o motor dá o voo a quem tem');
    for (const motivo of ['Instrutor indisponível', 'Manutenção da aeronave', 'Meteorologia', 'Operacional', 'Outro']) {
      const { estado, resultado, voo } = cancelado(base(), 1000, motivo);
      const r = sugerirParaCancelado(estado, resultado, voo.fKey);
      assert.ok(r.opcoes.every(o => comEle.includes(o.mudancas.insId)), `${motivo}: ${textos(r).join(' | ')}`);
      if (motivo !== 'Instrutor indisponível') assert.ok(r.opcoes.length > 0, `${motivo}: com o INVA que tem, há lugar`);
    }
    // Sem o INVA que tem (ele faltou), nada: os outros dois não servem à missão do curso
    const { estado, resultado, voo } = cancelado(base(), 1000, 'Instrutor indisponível');
    const r = sugerirParaCancelado(estado, resultado, voo.fKey);
    assert.deepEqual(textos(r), []);
    assert.equal(r.impossivel[0], 'No mesmo horário: nenhum avião com um instrutor que sirva.');
    assert.match(r.impossivel[1], /nenhum instrutor que sirva/);
  });

  it('o conflito: nem a troca no mesmo horário nem os dois últimos grupos oferecem um INVA sem a habilitação', () => {
    const base = cenario({ ins: [instrutor(1, 9), comEndosso(2)], stu: [doCurso(1000, { p1: 610, p2: -1 })] });
    const v = runAllocationEngine(base).out;
    // A escala aprovada, e o INVA que tem sai do dia
    const estado = { ...base, fixos: fixosAoAprovar({}, v), aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' }, ins: base.ins.map(x => (x.id === 2 ? { ...x, on: false } : x)) };
    const resultado = runAllocationEngine(estado);
    assert.ok(resultado.out[0].conflito);
    const opcoes = sugerirReparos(estado, resultado, v[0].fKey);
    assert.deepEqual(opcoes.filter(o => o.mudancas).map(o => o.texto), []);
    assert.deepEqual(opcoes.map(o => o.tipo), ['soltar', 'cancelar']);
  });

  it('o motor confere cada sugestão numa cópia com o exige da missão do curso (o cancelado, o conflito e o recusado)', () => {
    const vistos = [];
    const motor = s => { vistos.push(pedidoDoAluno(s.stu.find(x => x.id === 1000), 0).exige); return runAllocationEngine(s); };
    const base = () => cenario({ ins: [instrutor(1, 9), comEndosso(2), comEndosso(3)], stu: [doCurso(1000, { p1: 610, p2: -1 })] });
    const c = cancelado(base(), 1000, 'Instrutor indisponível');
    const doCancelado = sugerirParaCancelado(c.estado, c.resultado, c.voo.fKey, { motor });
    assert.ok(doCancelado.opcoes.length > 0 && vistos.length > 0);
    assert.ok(doCancelado.opcoes.every(o => o.mudancas.insId === 3));
    // O conflito (o INVA de antes fora do dia, na escala aprovada)
    const v = runAllocationEngine(base()).out;
    const aprovada = { ...base(), fixos: fixosAoAprovar({}, v), aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' } };
    aprovada.ins = aprovada.ins.map(x => (x.id === v[0].insId ? { ...x, on: false } : x));
    const r = runAllocationEngine(aprovada);
    const doConflito = sugerirReparos(aprovada, r, v[0].fKey, { motor }).filter(o => o.mudancas);
    assert.ok(doConflito.length > 0 && doConflito.every(o => [2, 3].includes(o.mudancas.insId)));
    // O recusado: o escolhido sem a habilitação; só o outro com ela, e "Automático" diz quem tem
    const recusado = cenario({ ins: [instrutor(1, 9), comEndosso(2), instrutor(3, 9)], stu: [doCurso(1000, { p1: 610, p2: -1, insId: 1 })] });
    const rr = runAllocationEngine(recusado);
    assert.equal(rr.al[0].codigo, 'instrutor-escolhido');
    assert.deepEqual(sugestoesDoRejeitado(recusado, rr, '1000_0_1', { motor }).map(o => o.texto), ['Com Instrutor 02: 10:10 no PP-LJV', 'Automático (o app escolhe Instrutor 02): 10:10 no PP-LJV']);
    assert.ok(vistos.length >= 4);
    assert.ok(vistos.every(e => Array.isArray(e) && e.length === 1 && e[0] === 'endosso_solo'), JSON.stringify(vistos));
  });
});

// F1e sobre o F1d: o 7º voo local confirmado na Agenda (limiteConfirmado, no minuto exato do pedido) passa do limite e
// não toma o lugar dos outros (js/engine.js). O aviso das Sugestões conta como o motor: o confirmado no minuto dele não
// conta, e o próprio voo confirmado nesse minuto não avisa; a sugestão que muda o horário do pedido tira a confirmação
describe('As Sugestões e o 7º voo local confirmado', () => {
  const instrutores = () => Array.from({ length: 10 }, (_, i) => instrutor(i + 1, 9));
  const as0820 = n => Array.from({ length: n }, (_, i) => aluno(1000 + i, { p1: 500, p2: -1, jan: 'h500' }));
  const confirmado = () => aluno(1006, { p1: 500, p2: -1, jan: 'h500', limiteConfirmado: true });
  const aprovar = (estado) => ({ ...estado, fixos: { ...fixosAoAprovar({}, runAllocationEngine(estado).out.filter(o => !estado.fixos || !estado.fixos[o.fKey])), ...estado.fixos }, aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' } });
  const locaisAs = (out, a) => out.filter(o => o.a === a && o.status !== 'Cancelado').length;

  it('o cancelado que é o 7º confirmado: no mesmo horário, a sugestão não avisa, e o motor o deixa como o 7º sem mexer nos seis', () => {
    const base = cenario({ ins: instrutores(), stu: [...as0820(6), confirmado()] });
    assert.equal(locaisAs(runAllocationEngine(base).out, 500), 7);
    const { estado, resultado, voo } = cancelado(base, 1006, 'Instrutor indisponível');
    const [primeira] = sugerirParaCancelado(estado, resultado, voo.fKey).opcoes;
    assert.equal(primeira.mudancas.a, 500);
    assert.equal(primeira.confirmar, undefined, primeira.confirmar);
    assert.equal(primeira.muda, undefined);
    aproveitarCancelado(estado, resultado, voo.fKey, primeira);
    const depois = runAllocationEngine(estado);
    assert.equal(locaisAs(depois.out, 500), 7);
    assert.deepEqual(depois.al.filter(a => a.codigo === 'limite-de-locais').map(a => [a.s, a.m]), [['Aluno 1006', 'Agendado às 08:20 como o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.']]);
    assert.ok(estado.stu.find(s => s.id === 1006).limiteConfirmado, 'a confirmação fica: o horário é o dela');
  });

  // O Aluno 1007 voa às 06:30 e é cancelado pela meteorologia; o pedido passa a só poder às 08:20, na escala aprovada
  const paraAs0820 = (naoConfirmados) => {
    const base = cenario({ ins: instrutores(), stu: [...as0820(naoConfirmados), confirmado(), aluno(1007, { p1: 390, p2: -1 })] });
    const c = cancelado(base, 1007, 'Meteorologia');
    const estado = aprovar(c.estado);
    estado.stu.find(s => s.id === 1007).jan = 'h500';
    const resultado = runAllocationEngine(estado);
    assert.equal(locaisAs(resultado.out, 500), naoConfirmados + 1);
    const opcao = sugerirParaCancelado(estado, resultado, c.voo.fKey).opcoes.find(o => o.mudancas.a === 500);
    assert.ok(opcao, 'a sugestão das 08:20');
    aproveitarCancelado(estado, resultado, c.voo.fKey, opcao);
    const avisos = runAllocationEngine(estado).al.filter(a => a.codigo === 'limite-de-locais').map(a => [a.s, a.m]);
    return { opcao, avisos };
  };

  it('cinco e o confirmado às 08:20: o voo é o 6º dos não confirmados, a sugestão não avisa, e o motor avisa só o confirmado', () => {
    const { opcao, avisos } = paraAs0820(5);
    assert.equal(opcao.confirmar, undefined, opcao.confirmar);
    assert.deepEqual(avisos, [['Aluno 1006', 'Agendado às 08:20 como o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.']]);
  });

  it('seis e o confirmado às 08:20: a sugestão avisa que o voo é o 7º, o mesmo número que o motor dá a ele depois', () => {
    const { opcao, avisos } = paraAs0820(6);
    assert.equal(opcao.confirmar, 'Às 08:20, o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.');
    assert.equal(opcao.armado, 'Aplicar mesmo assim');
    assert.deepEqual(avisos.find(([s]) => s === 'Aluno 1007'), ['Aluno 1007', 'Agendado às 08:20 como o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.']);
  });

  it('a sugestão que muda o horário do pedido confirmado tira a confirmação (era do minuto de antes); desfeita, ela volta', () => {
    // O confirmado das 08:20, cancelado pela meteorologia: o horário mais perto fica fora da disponibilidade (h500)
    const base = cenario({ ins: instrutores(), stu: [...as0820(6), confirmado()] });
    const { estado, resultado, voo } = cancelado(base, 1006, 'Meteorologia');
    const opcao = sugerirParaCancelado(estado, resultado, voo.fKey).opcoes.find(o => o.pedido && o.pedido.jan);
    assert.ok(opcao, 'um horário fora da disponibilidade');
    assert.notEqual(opcao.mudancas.a, 500);
    const rev = aproveitarCancelado(estado, resultado, voo.fKey, opcao);
    const pedido = estado.stu.find(s => s.id === 1006);
    assert.equal(pedido.jan, `h${opcao.mudancas.a}`);
    assert.equal(pedido.limiteConfirmado, undefined);
    desfazerAproveitamento(estado, rev);
    assert.equal(pedido.jan, 'h500');
    assert.equal(pedido.limiteConfirmado, true);
  });
});

// A vaga do voo cancelado na escala aprovada (F1h, N14): depois das sugestões do próprio aluno, “Dar a vaga a” o 1º da
// lista de espera do horário que o motor põe nele, sem mudar nenhum outro voo; só com um clique (a tela grava o pino
// agendado e a reversão devolve a recusa, com a espera)
describe('A vaga do voo cancelado para a lista de espera', () => {
  const as0820 = (id, solicitacao, extra = {}) => aluno(id, { p1: 500, p2: -1, jan: 'h500', solicitacao }, extra);
  // A escala aprovada (todos os voos fixos) e, depois, o voo do aluno cancelado pelo status: a escala da tela não muda (sem
  // o motor, F1g)
  const aprovadaECancelada = (base, stuId) => {
    const resultado = runAllocationEngine(base);
    const voo = resultado.out.find(o => o.stuId === stuId);
    const aprovada = { ...base, aprovacao: { em: '2026-11-10T10:00:00Z' }, fixos: fixosAoAprovar({}, resultado.out) };
    const estado = { ...aprovada, fStatus: { [voo.fKey]: 'Cancelado' }, fObs: { [voo.fKey]: { motivo: 'Outro' } } };
    return { estado, resultado, voo };
  };

  it('o 1º da lista de espera do horário entra no lugar que o motor acha, sem mudar nenhum outro voo', () => {
    const { estado, resultado, voo } = aprovadaECancelada(cenario({ ins: [instrutor(1, 9)], stu: [as0820(1000, 1), as0820(1001, 2), as0820(1002, 3)] }), 1000);
    assert.deepEqual([...rejeicoesDosPedidos(estado, resultado)].map(([k, a]) => [k, a.espera]), [['1001_0_1', { minuto: 500, lugar: 1 }], ['1002_0_1', { minuto: 500, lugar: 2 }]]);
    const vagas = vagasDaListaDeEspera(estado, resultado, voo.fKey);
    assert.deepEqual(vagas.map(o => [o.tipo, o.vaga, o.pino.a, o.pino.insId]), [['espera', '1001_0_1', 500, 1]]);
    assert.match(vagas[0].texto, /^Dar a vaga a Aluno 1001 \(1º da lista de espera das 08:20\): Instrutor 01, /);
    // Aplicada (o pino agendado), o pedido voa no lugar e só a recusa dele sai
    const depois = runAllocationEngine({ ...estado, fixos: { ...estado.fixos, '1001_0_1': { ...vagas[0].pino, agendado: true } } });
    assert.deepEqual(depois.out.filter(o => o.a === 500 && o.status !== 'Cancelado').map(o => o.stuId), [1001]);
    assert.deepEqual(depois.al.filter(a => a.t === 'err').map(a => [a.s, a.espera]), [['Aluno 1002', { minuto: 500, lugar: 1 }]]);
  });

  it('o 1º que não cabe na vaga fica de fora, e ela vai para o 2º', () => {
    // O 1002 (1º da lista) não voa com o INVA 1, que fica livre com o cancelamento do 1000; o 1003 (2º) voa
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [as0820(1000, 1), as0820(1001, 2), as0820(1002, 3, { bl: [1] }), as0820(1003, 4)] });
    const { estado, resultado, voo } = aprovadaECancelada(base, 1000);
    assert.equal(voo.insId, 1);
    assert.deepEqual(vagasDaListaDeEspera(estado, resultado, voo.fKey).map(o => [o.vaga, o.texto.split('): ')[0]]), [['1003_0_1', 'Dar a vaga a Aluno 1003 (2º da lista de espera das 08:20']]);
  });

  it('nada: o voo não cancelado, o cancelado de outro horário, o horário que já passou e a lista vazia', () => {
    const { estado, resultado, voo } = aprovadaECancelada(cenario({ ins: [instrutor(1, 9)], stu: [as0820(1000, 1), as0820(1001, 2)] }), 1000);
    assert.equal(vagasDaListaDeEspera(estado, resultado, voo.fKey).length, 1);
    assert.deepEqual(vagasDaListaDeEspera({ ...estado, fStatus: {} }, resultado, voo.fKey), []);
    assert.deepEqual(vagasDaListaDeEspera(estado, resultado, voo.fKey, { depoisDe: 510 }), []);
    // O cancelado das 06:30 não dá vaga a quem espera pelas 08:20
    const outro = aprovadaECancelada(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1003, { p1: 390, p2: -1, jan: 'h390', solicitacao: 9 }), as0820(1000, 1), as0820(1001, 2)] }), 1003);
    assert.deepEqual(vagasDaListaDeEspera(outro.estado, outro.resultado, outro.voo.fKey), []);
    // Sem ninguém esperando
    const so = aprovadaECancelada(cenario({ ins: [instrutor(1, 9)], stu: [as0820(1000, 1)] }), 1000);
    assert.deepEqual(vagasDaListaDeEspera(so.estado, so.resultado, so.voo.fKey), []);
  });

  it('a reversão guarda a espera da recusa que volta; malformada, a reversão não vale', () => {
    const rev = {
      kind: 'desfazerEdicao', voos: [{ fKey: '1001_0_1', fixo: null, status: null, detalhe: null, statusDepois: null }], pedidos: [{ stuId: 1001, mid: 0, pedido: { fly: true, mis: 'Voo Local', eq: 'C152', p1: 500, p2: -1, nb: 1, pr: 3, jan: 'h500' } }],
      recusas: [{ fKey: '1001_0_1', s: 'Aluno 1001', m: 'Rejeitado: x; 1º na lista de espera das 08:20.', codigo: 'instrutores-ocupados', espera: { minuto: 500, lugar: 1 } }], label: '↶ Reverter'
    };
    assert.deepEqual(validarReversao(rev).recusas, rev.recusas);
    assert.equal(validarReversao(rev).voos[0].statusDepois, null);
    // O status do voo de quem recebeu a vaga mudou depois dela (Confirmado): a reversão não desfaz (F1g, #85)
    const estado = { stu: [aluno(1001, { p1: 500, p2: -1 })], fStatus: { '1001_0_1': 'Confirmado' }, resultados: { doDia: [] } };
    assert.match(motivoParaNaoDesfazerEdicao(estado, validarReversao(rev)), /^O status do voo mudou depois da alteração/);
    assert.equal(motivoParaNaoDesfazerEdicao({ ...estado, fStatus: {} }, validarReversao(rev)), '');
    assert.equal(validarReversao({ ...rev, recusas: [{ ...rev.recusas[0], espera: { minuto: 500, lugar: 0 } }] }), null);
    assert.equal(validarReversao({ ...rev, recusas: [{ ...rev.recusas[0], espera: 'x' }] }), null);
  });
});
