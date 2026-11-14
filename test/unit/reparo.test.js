// Sugestões para um conflito na escala aprovada (fase 12): sem refazer o dia, o que pode voar no lugar. Outro avião do
// mesmo tipo, outro instrutor (habilitado, livre, dentro da lei e do peso), os dois, um horário mais tarde no mesmo dia
// ou cancelar. Cada sugestão é uma mudança no voo fixo; aplicada, o conflito some.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine } from '../../js/engine.js';
import { sugerirReparos, aplicarReparo } from '../../js/reparo.js';
import { LIMITES_DA_LEI, dentroDosLimites } from '../../js/limites.js';
import { AIRCRAFT_EQ_TYPES } from '../../js/config.js';
import { aluno, cenario, instrutor, apenas, GROUND_C152 } from '../helpers/montar.js';

const pino = o => ({ a: o.a, b: o.b, r: o.r, insId: o.insId, ...(o.isGround ? { classKey: o.classKey } : {}) });
const fixarTudo = out => Object.fromEntries(out.map(o => [o.fKey, pino(o)]));
// Monta, aprova e muda o dia; devolve o estado mudado e a escala com o conflito
function aprovadoEMudado(base, mudar) {
  const antes = runAllocationEngine(base);
  const estado = mudar({ ...base, fixos: fixarTudo(antes.out) });
  return { estado, resultado: runAllocationEngine(estado) };
}
const aplicar = (estado, resultado, fKey, opcao) => ({ ...estado, fixos: aplicarReparo(estado.fixos, resultado, fKey, opcao) });
const semInstrutor = id => e => ({ ...e, ins: e.ins.map(x => (x.id === id ? { ...x, on: false } : x)) });

describe('Sugestões para um conflito', () => {
  it('instrutor que não vem mais: outro instrutor livre e habilitado; aplicada, o conflito some', () => {
    // O voo fica com o instrutor 1 (menos habilitações); sem ele, o 3 (nível 5) vem antes do 2 (nível 9)
    const base = cenario({ ins: [instrutor(1, 1), instrutor(2, 9), instrutor(3, 5)], stu: [aluno(1000, { p1: 390, p2: -1 })] });
    const { estado, resultado } = aprovadoEMudado(base, e => ({ ...e, ins: e.ins.map(x => (x.id === 1 ? { ...x, on: false } : x)) }));
    const [voo] = resultado.out;
    assert.deepEqual(voo.conflito, ['o instrutor não está disponível']);
    const opcoes = sugerirReparos(estado, resultado, voo.fKey);
    assert.equal(opcoes[0].tipo, 'instrutor');
    assert.equal(opcoes[0].texto, 'Trocar o instrutor: Instrutor 03');
    assert.deepEqual(opcoes[0].mudancas, { insId: 3 }, 'menos habilitações primeiro (os mais versáteis ficam livres)');
    assert.deepEqual(opcoes.at(-1), { tipo: 'cancelar', texto: 'Cancelar o voo (pede o motivo)', mudancas: null, motivo: 'Instrutor indisponível' });
    const depois = runAllocationEngine(aplicar(estado, resultado, voo.fKey, opcoes[0]));
    assert.equal(depois.out[0].conflito, undefined);
    assert.equal(depois.out[0].insId, 3);
  });

  it('avião em manutenção: outro avião do mesmo tipo, primeiro um que já saiu, depois o da frente do hangar', () => {
    const base = { ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] }), hangar: ['PR-VOZ', 'PR-VOW', 'PR-VOB'] };
    const { estado, resultado } = aprovadoEMudado(base, e => ({ ...e, av: { ...e.av, 'PR-VOZ': false } }));
    const voo = resultado.out.find(o => o.conflito);
    const opcoes = sugerirReparos(estado, resultado, voo.fKey);
    assert.deepEqual([opcoes[0].tipo, opcoes[0].mudancas], ['aviao', { r: 'PR-VOW' }]);
    assert.equal(opcoes.at(-1).motivo, 'Manutenção da aeronave', 'cancelar já com o motivo');
  });

  it('não sugere o avião que passaria da revisão de 50 horas', () => {
    const base = { ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] }), hangar: ['PR-VOZ', 'PR-VOW', 'PR-VOB'] };
    const { estado, resultado } = aprovadoEMudado(base, e => ({ ...e, av: { ...e.av, 'PR-VOZ': false }, horas: { 'PR-VOW': 49.5 } }));
    const voo = resultado.out.find(o => o.conflito);
    const avioes = sugerirReparos(estado, resultado, voo.fKey, { maximo: 10 }).filter(o => o.tipo === 'aviao').map(o => o.mudancas.r);
    assert.ok(avioes.length >= 1);
    assert.ok(!avioes.includes('PR-VOW'), avioes.join(', '));
  });

  it('nunca sugere um instrutor ocupado, bloqueado pelo aluno, sem a habilitação ou fora da lei', () => {
    const base = cenario({
      ins: [instrutor(1, 9), instrutor(2, 9), instrutor(3, 9), instrutor(4, 9, { hab: ['local'] }), instrutor(5, 9), instrutor(6, 9)],
      stu: [aluno(1000, { p1: 390, p2: -1, mis: 'Navegação' }, { bl: [3] }), aluno(1001, { p1: 390, p2: -1 })]
    });
    const { estado, resultado } = aprovadoEMudado(base, e => ({
      ...e,
      ins: e.ins.map(x => (x.id === e.fixos['1000_0_1'].insId ? { ...x, on: false } : x)),
      horasDosInstrutores: { 5: { mes: 99.5, semestre: 0, ano: 0, fimAnterior: null } }
    }));
    const voo = resultado.out.find(o => o.stuId === 1000);
    const ocupado = resultado.out.find(o => o.stuId === 1001).insId;
    const sugeridos = sugerirReparos(estado, resultado, voo.fKey, { maximo: 10 }).filter(o => o.tipo === 'instrutor').map(o => o.mudancas.insId);
    for (const id of [3, 4, 5, ocupado]) assert.ok(!sugeridos.includes(id), `não sugere o instrutor ${id}`);
    assert.ok(sugeridos.length >= 1);
  });

  it('sem ninguém no mesmo horário: um horário mais tarde, com avião e instrutor livres', () => {
    // Às 06:30, o instrutor 1 voa com o aluno 1000 e o 2 com o 1001; o 2 sai: o único que sobra está ocupado às 06:30
    const base = cenario({ ins: [instrutor(1, 1), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 390, p2: -1 })], semAeronaves: apenas('C152', 'PR-VOB', 'PR-VOC') });
    const { estado, resultado } = aprovadoEMudado(base, e => ({ ...e, ins: e.ins.map(x => (x.id === 2 ? { ...x, on: false } : x)) }));
    const voo = resultado.out.find(o => o.stuId === 1001);
    assert.ok(voo.conflito);
    const opcoes = sugerirReparos(estado, resultado, voo.fKey);
    const horario = opcoes.find(o => o.tipo === 'horario');
    assert.ok(horario, JSON.stringify(opcoes));
    assert.equal(horario.mudancas.insId, 1, 'o único instrutor que sobrou, depois do voo dele');
    assert.ok(horario.mudancas.a >= 450);
    assert.match(horario.texto, /^Passar para as \d\d:\d\d, no P[PRT]-[A-Z]{3}, com Instrutor 01$/);
  });

  it('com outro instrutor, o tanque cheio vem primeiro; o que pede menos combustível diz quanto', () => {
    // O aluno pesa 110 kg e o instrutor 1 (55 kg) fica com o voo; sem ele, o 3 (60 kg) voa com o tanque cheio (170 kg)
    // e o 2 (80 kg) só com 8 gal a menos
    const base = cenario({ ins: [instrutor(1, 1, { kg: 55 }), instrutor(2, 9, { kg: 80 }), instrutor(3, 9, { kg: 60 })], stu: [aluno(1000, { p1: 390, p2: -1 }, { kg: 110 })] });
    const { estado, resultado } = aprovadoEMudado(base, semInstrutor(1));
    const textos = sugerirReparos(estado, resultado, resultado.out[0].fKey).filter(o => o.tipo === 'instrutor').map(o => o.texto);
    assert.deepEqual(textos, ['Trocar o instrutor: Instrutor 03', 'Trocar o instrutor: Instrutor 02 · reduzir 8 gal']);
  });

  it('turma de Ground: a sugestão vale para a turma inteira', () => {
    const base = cenario({ ins: [instrutor(1, 1), instrutor(2, 9)], stu: [aluno(1000, { ...GROUND_C152, p1: 500, p2: -1 }), aluno(1001, { ...GROUND_C152, p1: 500, p2: -1 })] });
    const { estado, resultado } = aprovadoEMudado(base, semInstrutor(1));
    assert.equal(resultado.out.filter(o => o.conflito).length, 2);
    const [primeira] = sugerirReparos(estado, resultado, resultado.out[0].fKey);
    assert.deepEqual(primeira.mudancas, { insId: 2 });
    const depois = runAllocationEngine(aplicar(estado, resultado, resultado.out[0].fKey, primeira));
    assert.deepEqual(depois.out.map(o => [o.stuId, o.insId, o.conflito]), [[1000, 2, undefined], [1001, 2, undefined]]);
    assert.equal(new Set(depois.out.map(o => o.classKey)).size, 1, 'a mesma turma');
  });

  it('a primeira sessão não passa para depois da segunda', () => {
    // O aluno 1000 voa duas sessões (06:30 e 08:20) com o mesmo instrutor; ele sai, e o outro está ocupado às 06:30
    const base = cenario({ ins: [instrutor(1, 1), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1, nb: 2, ss: 2 }), aluno(1001, { p1: 390, p2: -1 })] });
    const { estado, resultado } = aprovadoEMudado(base, e => semInstrutor(e.fixos['1000_0_1'].insId)(e));
    const segunda = resultado.out.find(o => o.fKey === '1000_0_2');
    const opcoes = sugerirReparos(estado, resultado, '1000_0_1', { maximo: 10 });
    for (const o of opcoes.filter(op => op.mudancas && 'a' in op.mudancas)) assert.ok(o.mudancas.b <= segunda.a, o.texto);
  });

  it('o voo sem conflito não tem sugestões', () => {
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] });
    const { estado, resultado } = aprovadoEMudado(base, e => e);
    assert.deepEqual(sugerirReparos(estado, resultado, resultado.out[0].fKey), []);
  });
});

describe('Sugestões: em 100 dias gerados', async () => {
  const { gerarCenario } = await import('../helpers/cenarios.js');
  const unicos = lista => [...new Map(lista.map(o => [o.classKey, o])).values()];

  it('toda sugestão aplicada tira o conflito do voo, não cria outro e deixa o instrutor dentro da lei', () => {
    let aplicadas = 0;
    for (let seed = 3001; seed <= 3100; seed++) {
      const base = gerarCenario(seed);
      const antes = runAllocationEngine(base);
      if (!antes.out.length) continue;
      // Sai o instrutor com mais voos e para o avião mais usado
      const contagem = chave => [...antes.out.reduce((m, o) => m.set(o[chave], (m.get(o[chave]) || 0) + 1), new Map())].sort((p, q) => q[1] - p[1]);
      const instrutor = contagem('insId')[0][0];
      const aviao = (contagem('r').find(([r]) => r !== 'SALA-GROUND') || [])[0];
      const estado = {
        ...base, fixos: fixarTudo(antes.out),
        ins: base.ins.map(x => (x.id === instrutor ? { ...x, on: false } : x)),
        av: { ...base.av, ...(aviao ? { [aviao]: false } : {}) }
      };
      const resultado = runAllocationEngine(estado);
      const emConflito = new Set(resultado.out.filter(o => o.conflito).map(o => o.fKey));
      for (const fKey of emConflito) {
        for (const opcao of sugerirReparos(estado, resultado, fKey, { maximo: 10 }).filter(o => o.mudancas)) {
          const depois = runAllocationEngine(aplicar(estado, resultado, fKey, opcao));
          const voo = depois.out.find(o => o.fKey === fKey);
          assert.equal(voo.conflito, undefined, `seed ${seed}: ${fKey}, ${opcao.texto}: ${voo.conflito}`);
          for (const o of depois.out.filter(v => v.conflito)) assert.ok(emConflito.has(o.fKey), `seed ${seed}: ${opcao.texto} pôs ${o.fKey} em conflito`);
          const ativos = unicos(depois.out.filter(o => o.insId === voo.insId && o.classKey !== voo.classKey && o.status !== 'Cancelado'));
          const compromisso = o => ({ a: o.a, b: o.b, voo: AIRCRAFT_EQ_TYPES.includes(o.eqType) });
          assert.ok(dentroDosLimites({ compromissos: ativos.map(compromisso), novo: compromisso(voo), historico: null, limites: LIMITES_DA_LEI }).ok, `seed ${seed}: ${opcao.texto} passa da lei`);
          aplicadas++;
        }
      }
    }
    assert.ok(aplicadas >= 100, `só ${aplicadas} sugestões aplicadas`);
  });
});
