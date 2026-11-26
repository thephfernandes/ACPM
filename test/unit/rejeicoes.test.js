// As recusas do motor ligadas aos pedidos (js/rejeicoes.js): a i-ésima recusa é a do i-ésimo pedido que voa sem pino e sem
// linha, na ordem do motor. Conferido em todos os estados dos goldens e em 300 sementes (com escolhas de instrutor, com
// atributos dos recursos e com a volta do noturno): cada recusa liga a um pedido do mesmo rótulo, e cada pedido sem lugar
// a uma recusa. E nos casos em que o rótulo não basta: dois alunos de mesmo nome e duas extras da mesma missão
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine } from '../../js/engine.js';
import { naOrdemDoMotor, rejeicoesDosPedidos } from '../../js/rejeicoes.js';
import { chaveDoVoo, pedidoDoAluno } from '../../js/voo.js';
import { gerarCenario, comEscolhas, comAtributos, comVolta } from '../helpers/cenarios.js';
import { lerGoldens } from '../helpers/goldens.js';
import { aluno, cenario, instrutor, missaoExtra } from '../helpers/montar.js';

// O rótulo que o motor dá à recusa de um pedido: o nome, e a missão nas extras
function rotuloDoPedido(estado, fKey) {
  const [stuId, mid] = fKey.split('_').map(Number);
  const s = estado.stu.find(x => x.id === stuId);
  return mid ? `${s.nm} (${pedidoDoAluno(s, mid).mis})` : s.nm;
}

function conferir(estado, nome) {
  const resultado = runAllocationEngine(estado);
  const recusas = resultado.al.filter(a => a.t === 'err');
  const mapa = rejeicoesDosPedidos(estado, resultado);
  assert.equal(mapa.size, recusas.length, `${nome}: cada recusa ligada a um pedido`);
  for (const [fKey, err] of mapa) assert.equal(err.s, rotuloDoPedido(estado, fKey), `${nome}: ${fKey}`);
  // Cada recusa ligada a um pedido só, e cada uma uma vez
  assert.equal(new Set(mapa.values()).size, recusas.length, `${nome}: uma recusa por pedido`);
  return { resultado, mapa };
}

describe('As recusas do motor e os pedidos', () => {
  it('nos 41 estados dos goldens', () => {
    const goldens = lerGoldens();
    conferir(goldens.exemplo.estado, 'exemplo');
    for (const { seed } of goldens.cenarios) conferir(gerarCenario(seed), `cenário ${seed}`);
  });

  it('em 300 sementes, com escolhas, atributos e a volta do noturno', () => {
    let recusas = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const base = gerarCenario(seed);
      for (const [nome, estado] of [[seed, base], [`${seed} com escolhas`, comEscolhas(gerarCenario(seed), seed)],
        [`${seed} com atributos`, comAtributos(gerarCenario(seed), seed)], [`${seed} com a volta`, comVolta(gerarCenario(seed), seed)]]) {
        recusas += conferir(estado, nome).mapa.size;
      }
    }
    // O teste só vale se houver recusas para ligar
    assert.ok(recusas > 300, `só ${recusas} recusas`);
  });

  it('dois alunos de mesmo nome: cada recusa vai para o pedido certo, pelo motivo', () => {
    // Os dois "Maria Silva" pedem Multimotor sem nenhum instrutor que o faça; um deles com o instrutor escolhido fora do dia
    const estado = cenario({
      ins: [instrutor(1, 1), instrutor(2, 1, { on: false })],
      stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34' }, { nm: 'Maria Silva' }), aluno(1001, { mis: 'Voo Local', insId: 2 }, { nm: 'Maria Silva' })]
    });
    const { mapa } = conferir(estado, 'homônimos');
    assert.equal(mapa.get(chaveDoVoo(1001, 0)).codigo, 'instrutor-escolhido');
    assert.notEqual(mapa.get(chaveDoVoo(1000, 0)).codigo, 'instrutor-escolhido');
  });

  it('duas extras da mesma missão: cada uma com a recusa dela', () => {
    const estado = cenario({ ins: [instrutor(1, 1)], stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34' }, { extra: [missaoExtra(2, { mis: 'Multimotor', eq: 'PA-34' }), missaoExtra(3, { mis: 'Multimotor', eq: 'PA-34' })] })] });
    const { mapa } = conferir(estado, 'extras');
    assert.deepEqual([...mapa.keys()].sort(), [chaveDoVoo(1000, 0), chaveDoVoo(1000, 2), chaveDoVoo(1000, 3)].sort());
  });

  it('o pino e o voo na escala não recebem recusa; sem recusas, o mapa vazio', () => {
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000), aluno(1001)] });
    const { resultado, mapa } = conferir(estado, 'sem recusas');
    assert.equal(mapa.size, 0);
    assert.equal(rejeicoesDosPedidos(null, resultado).size, 0);
  });

  it('naOrdemDoMotor: a volta do noturno, os fixos, os agendados e os outros', () => {
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000), aluno(1001), aluno(1002)] });
    estado.fixos = { [chaveDoVoo(1002, 0)]: { a: 390, b: 450, r: 'PR-VOB', insId: 1 }, [chaveDoVoo(1001, 0)]: { a: 500, b: 560, r: 'PR-VOB', insId: 1, agendado: true } };
    const voos = [chaveDoVoo(1000, 0), chaveDoVoo(1001, 0), chaveDoVoo(1002, 0)].map(fKey => ({ fKey, stuId: +fKey.split('_')[0], mid: 0 }));
    assert.deepEqual(naOrdemDoMotor(estado, voos).map(o => o.stuId), [1002, 1001, 1000]);
  });
});
