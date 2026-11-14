// Propriedades que toda escala gerada deve respeitar, verificadas em centenas de cenários aleatórios.
import { horariosDaMissao, periodoDoMinuto } from '../../js/horarios.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine } from '../../js/engine.js';
import { EQ, GROUND_REG, ACROBAT_REG, T, NI, DEFAULT_LIM } from '../../js/config.js';
import { isGroundMission, doesGroundGateFlight } from '../../js/rules.js';
import { podeFazer } from '../../js/habilitacoes.js';
import { gerarCenario } from '../helpers/cenarios.js';
import { CODIGOS_DE_REJEICAO } from '../../js/conflitos.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => 1001 + i);
const execucoes = SEEDS.map(seed => {
  const estado = gerarCenario(seed);
  return { seed, estado, ...runAllocationEngine(estado) };
});

const sobrepoe = (x, y) => x.a < y.b && y.a < x.b;
const pedidoDe = (estado, o) => {
  const stu = estado.stu.find(s => s.id === o.stuId);
  return { stu, d: o.mid ? stu.extra.find(ex => ex.mid === o.mid) : stu };
};

// Executa a verificação em todos os cenários e informa os seeds que violam a propriedade
function emTodos(verificar) {
  const falhas = [];
  for (const exec of execucoes) {
    try { verificar(exec); } catch (e) { falhas.push(`seed ${exec.seed}: ${e.message}`); }
  }
  assert.deepEqual(falhas.slice(0, 5), [], `${falhas.length} cenário(s) violam a propriedade`);
}

describe('Invariantes do motor de alocação', () => {
  // Revisão de 14/11: a rejeição diz onde resolver
  it('toda rejeição tem um código da lista', () => emTodos(({ al }) => {
    for (const a of al.filter(x => x.t === 'err')) assert.ok(CODIGOS_DE_REJEICAO.includes(a.codigo), `${a.m} (${a.codigo})`);
  }));

  it('toda missão marcada é alocada ou recebe um alerta de rejeição', () => emTodos(({ estado, out, al, tot }) => {
    const marcadas = estado.stu.reduce((n, s) => n + (s.fly ? 1 : 0) + s.extra.filter(ex => ex.fly).length, 0);
    const alocadas = new Set(out.map(o => `${o.stuId}_${o.mid}`)).size;
    assert.equal(tot, marcadas);
    assert.equal(alocadas + al.filter(a => a.t === 'err').length, tot);
  }));

  // O voo cancelado não ocupa nada (revisão de 14/11): outro voo pode ficar no horário dele
  it('nenhuma aeronave ou simulador é escalado em horários sobrepostos', () => emTodos(({ out }) => {
    const voos = out.filter(o => !o.isGround && o.status !== 'Cancelado');
    for (const [i, x] of voos.entries()) {
      for (const y of voos.slice(i + 1)) {
        assert.ok(!(x.r === y.r && sobrepoe(x, y)), `${x.r} em ${x.fKey} e ${y.fKey}`);
      }
    }
  }));

  it('nenhum instrutor atende duas turmas ou voos ao mesmo tempo', () => emTodos(({ out: todos }) => {
    const out = todos.filter(o => o.status !== 'Cancelado');
    for (const [i, x] of out.entries()) {
      for (const y of out.slice(i + 1)) {
        assert.ok(!(x.insId === y.insId && x.classKey !== y.classKey && sobrepoe(x, y)), `instrutor ${x.insId} em ${x.fKey} e ${y.fKey}`);
      }
    }
  }));

  it('nenhum aluno é escalado em horários sobrepostos', () => emTodos(({ out: todos }) => {
    const out = todos.filter(o => o.status !== 'Cancelado');
    for (const [i, x] of out.entries()) {
      for (const y of out.slice(i + 1)) {
        assert.ok(!(x.stuId === y.stuId && sobrepoe(x, y)), `aluno ${x.stuId} em ${x.fKey} e ${y.fKey}`);
      }
    }
  }));

  it('instrutor ativo, habilitado para a missão no equipamento, disponível em todo o período e não bloqueado', () => emTodos(({ estado, out }) => {
    for (const o of out) {
      const x = estado.ins.find(i => i.id === o.insId);
      const { stu } = pedidoDe(estado, o);
      assert.ok(x.on, `${o.fKey}: instrutor inativo`);
      assert.ok(podeFazer(x, o.mis, o.eqType), `${o.fKey}: ${o.mis}/${o.eqType} sem habilitação (${x.hab})`);
      assert.ok(!stu.bl.includes(x.id), `${o.fKey}: instrutor bloqueado`);
      T.forEach((ini, k) => {
        const fim = k < NI ? T[k + 1] : 1440;
        if (o.a < fim && o.b > ini) assert.ok(x.aw[k], `${o.fKey}: instrutor indisponível na janela ${k}`);
      });
    }
  }));

  it('equipamento compatível, disponível e PR-JPL somente para Parafuso', () => emTodos(({ estado, out }) => {
    for (const o of out) {
      if (o.isGround) {
        assert.equal(o.r, GROUND_REG);
        continue;
      }
      assert.ok(EQ[o.eqType].includes(o.r), `${o.fKey}: ${o.r} não pertence a ${o.eqType}`);
      assert.ok(estado.av[o.r], `${o.fKey}: ${o.r} em manutenção`);
      assert.equal(o.r === ACROBAT_REG, o.mis === 'Parafuso' && o.eqType === 'C152', `${o.fKey}: uso indevido do ${ACROBAT_REG}`);
    }
  }));

  it('peso da tripulação dentro do limite do equipamento (acima dele, só com menos combustível que ainda dá o voo)', () => emTodos(({ out }) => {
    for (const o of out.filter(v => !v.isGround)) {
      assert.equal(o.limKg, DEFAULT_LIM[o.eqType] || 0);
      if (!o.limKg || !o.stuKg || !o.insKg) continue;
      const kg = o.stuKg + o.insKg;
      if (!o.comb) assert.ok(kg <= o.limKg, `${o.fKey}: ${kg} kg > ${o.limKg} kg sem reduzir o combustível`);
      else assert.ok(kg > o.limKg && o.comb.abastecerGal >= o.comb.minimoGal, `${o.fKey}: combustível ${JSON.stringify(o.comb)}`);
    }
  }));

  it('horários da categoria em períodos habilitados, Noturno às 17:30 e demais missões até 17:30', () => emTodos(({ estado, out }) => {
    for (const o of out) {
      assert.ok(estado.win[o.w], `${o.fKey}: janela ${o.w} desativada`);
      assert.equal(o.w, periodoDoMinuto(o.a), `${o.fKey}: período errado`);
      assert.ok(horariosDaMissao(estado.horarios, o.mis, o.eqType).includes(o.a), `${o.fKey}: ${o.a} fora dos horários do ${o.eqType}`);
      if (o.mis === 'Noturno') assert.equal(o.w, NI, `${o.fKey}: Noturno fora das 17:30`);
      else assert.ok(o.w < NI && o.b <= T[NI], `${o.fKey}: termina às ${o.b}`);
      if (o.isGround) assert.equal(o.b - o.a, 90);
    }
  }));

  it('o voo começa depois do término do Ground da mesma temática', () => emTodos(({ out }) => {
    for (const voo of out.filter(o => !o.isGround)) {
      for (const g of out.filter(o => o.isGround && o.stuId === voo.stuId)) {
        if (doesGroundGateFlight(g.mis, { mis: voo.mis, eq: voo.eqType })) {
          assert.ok(voo.a >= g.b, `${voo.fKey} às ${voo.a} antes do ${g.mis} (${g.b})`);
        }
      }
    }
  }));

  // Revisão de 14/11: um voo por pedido, com as horas pedidas
  it('cada pedido de voo é um voo só, com as horas pedidas', () => emTodos(({ estado, out }) => {
    const grupos = Map.groupBy(out.filter(o => !o.isGround), o => `${o.stuId}_${o.mid}`);
    for (const voos of grupos.values()) {
      const { d } = pedidoDe(estado, voos[0]);
      assert.equal(voos.length, 1);
      assert.deepEqual([voos[0].fKey.endsWith('_1'), voos[0].ss, voos[0].h, voos[0].b - voos[0].a], [true, '1/1', Math.max(1, Math.round(+d.nb || 1)), Math.max(1, Math.round(+d.nb || 1)) * 60]);
    }
  }));

  it('saída ordenada por horário, com Ground antes dos voos no mesmo horário', () => emTodos(({ out }) => {
    out.slice(1).forEach((o, i) => {
      const ant = out[i];
      assert.ok(ant.a < o.a || (ant.a === o.a && (ant.isGround || !o.isGround)), `${ant.fKey} antes de ${o.fKey}`);
    });
  }));

  it('a sala de Ground recebe uma turma por vez', () => emTodos(({ out }) => {
    const turmas = [...Map.groupBy(out.filter(o => o.isGround), o => o.classKey).values()].map(m => m[0]);
    for (const [i, x] of turmas.entries()) {
      for (const y of turmas.slice(i + 1)) assert.ok(!sobrepoe(x, y), `${x.classKey} e ${y.classKey} ao mesmo tempo`);
    }
  }));

  it('turmas de Ground reúnem a mesma temática, horário e instrutor', () => emTodos(({ out }) => {
    const turmas = Map.groupBy(out.filter(o => o.isGround), o => o.classKey);
    for (const membros of turmas.values()) {
      assert.equal(new Set(membros.map(m => `${m.mis}|${m.w}|${m.insId}`)).size, 1);
      membros.forEach(m => assert.equal(m.groupSize, Math.max(1, membros.filter(o => o.status !== 'Cancelado').length)));
      assert.ok(isGroundMission(membros[0].mis));
    }
  }));

  it('instrutor em duas matrículas do mesmo tipo só quando nenhuma estava livre em todos os horários dele', () => emTodos(({ estado, out }) => {
    // Os voos com status de andamento ficam no avião deles e o cancelado não ocupa nada (revisão de 14/11): a regra vale
    // para os que podem mudar
    for (const tipo of ['C152', 'C172', 'PA-34']) {
      const voos = out.filter(o => o.eqType === tipo && o.r !== ACROBAT_REG && o.status !== 'Cancelado');
      const mudam = voos.filter(o => !['Atrasado', 'Em Voo'].includes(o.status));
      for (const insId of new Set(mudam.map(o => o.insId))) {
        const meus = mudam.filter(o => o.insId === insId);
        if (new Set(meus.map(o => o.r)).size < 2) continue;
        const livre = EQ[tipo].find(r => r !== ACROBAT_REG && estado.av[r] &&
          meus.every(f => !voos.some(o => o.insId !== insId && o.r === r && sobrepoe(o, f))));
        assert.equal(livre, undefined, `instrutor ${insId} usou ${[...new Set(meus.map(o => o.r))]} com ${livre} livre o dia todo`);
      }
    }
  }));

  it('nenhum avião passa das 50 horas desde a última revisão (aviões perto do limite em 100 cenários)', () => {
    const falhas = [];
    for (const seed of SEEDS.slice(0, 100)) {
      const estado = gerarCenario(seed);
      const avioes = ['C152', 'C172', 'PA-34'].flatMap(t => EQ[t]);
      estado.horas = Object.fromEntries(avioes.filter((r, i) => i % 2 === 0).map((r, i) => [r, 46 + (i % 8) * 0.5]));
      const { out } = runAllocationEngine(estado);
      for (const [r, inicio] of Object.entries(estado.horas)) {
        const voadas = out.filter(o => o.r === r).reduce((t, o) => t + o.h, 0);
        if (inicio + voadas > 50 + 1e-9) falhas.push(`seed ${seed}: ${r} com ${inicio} + ${voadas} h`);
      }
    }
    assert.deepEqual(falhas.slice(0, 5), []);
  });

  it('é determinístico e não altera o estado recebido', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const estado = gerarCenario(seed);
      const copia = structuredClone(estado);
      const primeira = runAllocationEngine(estado);
      assert.deepEqual(estado, copia, `seed ${seed}: estado alterado`);
      assert.deepEqual(runAllocationEngine(estado), primeira, `seed ${seed}: saída diferente`);
    }
  });
});

// Revisão de 14/11: a escala aprovada com atrasos, cancelamentos e pedidos novos. Cada voo ocupa o horário efetivo (o
// atrasado, o novo); o cancelado não ocupa nada. Entre dois voos fixos, a sobreposição é o aviso de atraso; fora isso,
// nada se sobrepõe
describe('Invariantes da escala aprovada com atrasos e cancelamentos', () => {
  const fixar = out => Object.fromEntries(out.map(o => [o.fKey, { a: o.a, b: o.b, r: o.r, insId: o.insId, ...(o.isGround ? { classKey: o.classKey } : {}) }]));
  const dias = SEEDS.slice(0, 150).map(seed => {
    const base = gerarCenario(seed);
    const antes = runAllocationEngine(base);
    const fStatus = {}, fObs = {};
    antes.out.forEach((o, i) => {
      if (i % 5 === 1) fStatus[o.fKey] = 'Cancelado';
      if (i % 5 === 3 && !o.isGround && o.b + 60 <= 1440) { fStatus[o.fKey] = 'Atrasado'; fObs[o.fKey] = { novoInicio: o.a + 60 }; }
    });
    const novos = [0, 1, 2, 3].map(i => ({ id: 9000 + i, nm: `Novo ${i}`, kg: 70, bl: [], extra: [], fly: true, mis: 'Voo Local', eq: 'C152', p1: [390, 500, 610, 760][i], p2: -1, nb: 1, ss: 1, pr: 5 }));
    const estado = { ...base, stu: [...base.stu, ...novos], fixos: fixar(antes.out), fStatus, fObs };
    return { seed, estado, ...runAllocationEngine(estado) };
  });

  it('nada se sobrepõe a um voo novo no avião, no instrutor ou no aluno (cada voo no horário efetivo)', () => {
    const falhas = [];
    for (const { seed, estado, out } of dias) {
      const ativos = [...new Map(out.filter(o => (estado.fStatus[o.fKey] || o.status) !== 'Cancelado').map(o => [o.classKey || o.fKey, o])).values()]
        .map(o => ({ o, a: estado.fObs[o.fKey] ? estado.fObs[o.fKey].novoInicio : o.a, b: estado.fObs[o.fKey] ? estado.fObs[o.fKey].novoInicio + o.b - o.a : o.b }));
      for (const [i, x] of ativos.entries()) {
        for (const y of ativos.slice(i + 1)) {
          if ((x.o.fixo && y.o.fixo) || !sobrepoe(x, y)) continue;
          if (x.o.r === y.o.r || x.o.insId === y.o.insId) falhas.push(`seed ${seed}: ${x.o.fKey} e ${y.o.fKey}`);
        }
      }
      const porAluno = out.filter(o => (estado.fStatus[o.fKey] || o.status) !== 'Cancelado' && !o.fixo);
      for (const x of porAluno) {
        for (const y of out.filter(o => o !== x && o.stuId === x.stuId && (estado.fStatus[o.fKey] || o.status) !== 'Cancelado')) {
          const ya = estado.fObs[y.fKey] ? estado.fObs[y.fKey].novoInicio : y.a;
          if (sobrepoe(x, { a: ya, b: ya + y.b - y.a })) falhas.push(`seed ${seed}: aluno ${x.stuId}`);
        }
      }
    }
    assert.deepEqual(falhas.slice(0, 5), [], `${falhas.length} sobreposição(ões)`);
  });

  it('os voos com status ficam onde estavam, com o mesmo instrutor e avião', () => {
    const falhas = [];
    for (const { seed, estado, out } of dias) {
      for (const o of out.filter(v => estado.fStatus[v.fKey])) {
        const p = estado.fixos[o.fKey];
        if (p && (o.a !== p.a || o.r !== p.r || o.insId !== p.insId)) falhas.push(`seed ${seed}: ${o.fKey}`);
      }
    }
    assert.deepEqual(falhas.slice(0, 5), []);
  });
});
