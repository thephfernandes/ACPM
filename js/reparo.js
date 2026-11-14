// Sugestões para um conflito na escala aprovada (fase 12): sem refazer o dia, o que pode voar no lugar do voo fixo que
// ficou impossível. No mesmo horário: outro avião do mesmo tipo (um que já saiu, com a menor folga, e depois o da
// frente do hangar), outro instrutor (habilitado, disponível, livre, sem bloqueio do aluno, dentro do peso e da lei; o
// tanque cheio primeiro, depois quem tem menos horas no dia e menos habilitações) ou os dois. Sem nada no mesmo horário,
// o primeiro horário mais tarde no mesmo dia, dentro da disponibilidade do aluno. Depois, soltar o voo (o motor o escala
// de novo; quando o pedido mudou, é a única sugestão) e, por último, cancelar. Cada sugestão é uma mudança no voo fixo;
// na turma de Ground, em todos os alunos dela.
import { AIRCRAFT_EQ_TYPES, GROUND_EQ_TYPE, GROUND_REG, REVISAO_H, T, NI } from './config.js';
import { FROTA_INICIAL, matriculasDoTipo } from './frota.js';
import { podeFazer } from './habilitacoes.js';
import { livre, cobre, cabeNoSaldo } from './viabilidade.js';
import { reducaoNecessaria } from './combustivel.js';
import { normalizarLimites, dentroDosLimites } from './limites.js';
import { normalizarHangar, posicaoNoHangar } from './hangar.js';
import { HORARIOS_INICIAIS, horariosDaMissao, periodoDoMinuto } from './horarios.js';
import { disponibilidadeDoAluno, doesGroundGateFlight } from './rules.js';
import { nomeDoRecurso } from './categorias.js';
import { hm } from './format.js';
import { gruposDoConflito } from './conflitos.js';

const menorPrimeiro = (a, b) => (a === b ? 0 : a - b);
// Os voos uma vez cada (a turma de Ground tem um item por aluno)
const unicos = lista => [...new Map(lista.map(o => [o.classKey || o.fKey, o])).values()];
// A turma de Ground muda inteira; o voo, sozinho
const doGrupo = (resultado, voo) => (voo.isGround ? resultado.out.filter(o => o.classKey === voo.classKey) : [voo]);

export function sugerirReparos(estado, resultado, fKey, { maximo = 3, depoisDe = null } = {}) {
  const voo = resultado.out.find(o => o.fKey === fKey);
  if (!voo || !voo.conflito) return [];
  const statusDe = o => (estado.fStatus && estado.fStatus[o.fKey]) || o.status || 'Confirmado';
  const grupo = doGrupo(resultado, voo);
  const chavesDoGrupo = new Set(grupo.map(o => o.fKey));
  const outros = resultado.out.filter(o => !chavesDoGrupo.has(o.fKey) && statusDe(o) !== 'Cancelado');
  const frota = Array.isArray(estado.frota) ? estado.frota : FROTA_INICIAL;
  const hangar = normalizarHangar(estado.hangar, frota);
  const limites = normalizarLimites(estado.limites);
  const horasPassadas = estado.horasDosInstrutores || {};
  const alunos = new Map(estado.stu.map(s => [s.id, s]));
  const pedidoDo = v => { const s = alunos.get(v.stuId); return s && (v.mid ? (s.extra || []).find(ex => ex.mid === v.mid) : s); };
  const tipo = voo.isGround ? GROUND_EQ_TYPE : voo.eqType;
  const ehVoo = AIRCRAFT_EQ_TYPES.includes(tipo);

  const ocupacaoDo = r => unicos(outros.filter(o => o.r === r)).map(o => [o.a, o.b]);
  const compromissosDo = id => unicos(outros.filter(o => o.insId === id)).map(o => ({ a: o.a, b: o.b, voo: AIRCRAFT_EQ_TYPES.includes(o.eqType) }));
  const horasNoDia = id => unicos(outros.filter(o => o.insId === id)).reduce((total, o) => total + o.h, 0);
  const horasDoAviao = r => unicos(outros.filter(o => o.r === r)).reduce((total, o) => total + o.h, 0);
  const saldo = r => (typeof (estado.horas || {})[r] === 'number' ? REVISAO_H - estado.horas[r] : Infinity);
  const folga = (r, a, b) => ocupacaoDo(r).reduce((m, [x, y]) => Math.min(m, y <= a ? a - y : x >= b ? x - b : 0), Infinity);
  // Combustível a menos com o instrutor (0 com o tanque cheio ou sem um dos pesos; Infinity quando nem o mínimo dá)
  const reducao = (x, a, b) => (voo.isGround ? 0 : reducaoNecessaria({ stuKg: voo.stuKg, insKg: x.kg, tipo, minutos: b - a, mis: voo.mis }));

  const aviaoServe = (r, a, b) => (voo.isGround || Boolean(estado.av[r])) && livre(ocupacaoDo(r), a, b) && cabeNoSaldo(horasDoAviao(r), (b - a) / 60, saldo(r));
  const instrutorServe = (x, a, b) => Boolean(x) && x.on && podeFazer(x, voo.mis, tipo) && cobre(x.aw, a, b)
    && livre(compromissosDo(x.id).map(c => [c.a, c.b]), a, b)
    && grupo.every(v => { const s = alunos.get(v.stuId); return !(s && (s.bl || []).includes(x.id)); })
    && reducao(x, a, b) < Infinity
    && dentroDosLimites({ compromissos: compromissosDo(x.id), novo: { a, b, voo: ehVoo }, historico: horasPassadas[x.id] || null, limites }).ok;

  const avioesPara = (a, b) => (voo.isGround
    ? (aviaoServe(GROUND_REG, a, b) ? [GROUND_REG] : [])
    : matriculasDoTipo(frota, tipo, { parafuso: voo.mis === 'Parafuso' }).filter(r => aviaoServe(r, a, b))
      .sort((p, q) => menorPrimeiro(folga(p, a, b), folga(q, a, b)) || posicaoNoHangar(hangar, p) - posicaoNoHangar(hangar, q)));
  const instrutoresPara = (a, b) => estado.ins.filter(x => instrutorServe(x, a, b))
    .sort((p, q) => (reducao(p, a, b) > 0) - (reducao(q, a, b) > 0) || horasNoDia(p.id) - horasNoDia(q.id)
      || (p.hab || []).length - (q.hab || []).length || p.id - q.id);
  const comCombustivel = (texto, x, a, b) => { const gal = reducao(x, a, b); return gal > 0 ? `${texto} · reduzir ${gal} gal` : texto; };

  // O que o conflito pede, pelo código (revisão de 14/11): o pedido mudou (só soltar), o horário não serve (outro
  // horário), ou o avião e o instrutor
  const grupos = gruposDoConflito(voo);
  const pedidoMudou = grupos.has('pedido');
  const problemaNoAviao = grupos.has('aviao');
  const problemaNoInstrutor = grupos.has('instrutor');
  const problemaNoAluno = grupos.has('horario');
  const atual = estado.ins.find(x => x.id === voo.insId);
  const opcoes = [];

  // No mesmo horário
  if (!problemaNoAluno && !pedidoMudou) {
    const { a, b } = voo;
    const avioes = avioesPara(a, b), instrutores = instrutoresPara(a, b);
    if (problemaNoAviao && !problemaNoInstrutor) avioes.forEach(r => opcoes.push({ tipo: 'aviao', texto: `Trocar o avião: ${nomeDoRecurso(r)}`, mudancas: { r } }));
    if (problemaNoInstrutor && !problemaNoAviao) {
      instrutores.forEach(x => opcoes.push({ tipo: 'instrutor', texto: comCombustivel(`Trocar o instrutor: ${x.nm}`, x, a, b), mudancas: { insId: x.id } }));
    }
    if (problemaNoAviao && problemaNoInstrutor && avioes.length && instrutores.length) {
      const [r] = avioes, [x] = instrutores;
      opcoes.push({ tipo: 'ambos', texto: comCombustivel(`Trocar o avião e o instrutor: ${nomeDoRecurso(r)}, com ${x.nm}`, x, a, b), mudancas: { r, insId: x.id } });
    }
  }

  // Sem nada no mesmo horário: o primeiro horário mais tarde, no mesmo dia, com o avião e o instrutor de antes quando
  // eles servem. Vale a disponibilidade de cada aluno, e o Ground termina antes dos voos que dependem dele
  if (!opcoes.length && !pedidoMudou) {
    const duracao = voo.b - voo.a;
    const inicios = voo.isGround ? T.slice(0, NI) : horariosDaMissao(estado.horarios || HORARIOS_INICIAIS, voo.mis, tipo);
    const fimDoDia = voo.mis === 'Noturno' ? 1440 : T[NI];
    const voosQueDependem = voo.isGround
      ? outros.filter(o => grupo.some(v => v.stuId === o.stuId) && !o.isGround && doesGroundGateFlight(voo.mis, { mis: o.mis, eq: o.eqType }))
      : [];
    const limite = Math.min(fimDoDia, ...voosQueDependem.map(o => o.a));
    const alunosPodem = (a, b) => grupo.every(v => {
      const permitidas = disponibilidadeDoAluno((pedidoDo(v) || {}).jan);
      return (!permitidas || permitidas(a)) && livre(outros.filter(o => o.stuId === v.stuId).map(o => [o.a, o.b]), a, b);
    });
    for (const m of inicios) {
      if (m <= Math.max(voo.a, depoisDe ?? -1) || m + duracao > limite || !estado.win[periodoDoMinuto(m)] || !alunosPodem(m, m + duracao)) continue;
      const r = !voo.isGround && aviaoServe(voo.r, m, m + duracao) ? voo.r : avioesPara(m, m + duracao)[0];
      const x = instrutorServe(atual, m, m + duracao) ? atual : instrutoresPara(m, m + duracao)[0];
      if (!r || !x) continue;
      opcoes.push({
        tipo: 'horario',
        texto: comCombustivel(`Passar para as ${hm(m)}, ${voo.isGround ? 'na' : 'no'} ${nomeDoRecurso(r)}, com ${x.nm}`, x, m, m + duracao),
        mudancas: { a: m, b: m + duracao, ...(voo.isGround ? {} : { r }), insId: x.id }
      });
      break;
    }
  }

  // Soltar: o voo deixa de ser fixo e o motor o escala de novo, em volta dos outros (não vale para o voo em andamento)
  const emAndamento = grupo.some(v => ['Em Voo', 'Atrasado'].includes(statusDe(v)));
  const soltar = emAndamento ? [] : [{ tipo: 'soltar', texto: 'Soltar o voo: o app escolhe de novo o horário, o avião e o instrutor', mudancas: null, soltar: true }];
  return [...opcoes.slice(0, maximo), ...soltar, { tipo: 'cancelar', texto: 'Cancelar o voo (pede o motivo)', mudancas: null, motivo: motivoDoConflito(voo.conflito) }];
}

// O motivo de cancelamento que o conflito sugere (o diálogo do status já abre com ele marcado)
function motivoDoConflito(conflito) {
  if (conflito.some(c => /instrutor (saiu|não está disponível)/.test(c))) return 'Instrutor indisponível';
  if (conflito.includes('o avião está indisponível')) return 'Manutenção da aeronave';
  return null;
}

// A sugestão aplicada nos voos fixos (devolve os fixos novos): na turma de Ground, em todos os alunos fixos dela. Soltar
// tira o voo (ou a turma) dos fixos
export function aplicarReparo(fixos, resultado, fKey, opcao) {
  const voo = resultado.out.find(o => o.fKey === fKey);
  if (!voo || !opcao || !(opcao.mudancas || opcao.soltar)) return fixos;
  const chaves = doGrupo(resultado, voo).map(o => o.fKey).filter(k => fixos[k]);
  if (opcao.soltar) return Object.fromEntries(Object.entries(fixos).filter(([k]) => !chaves.includes(k)));
  return { ...fixos, ...Object.fromEntries(chaves.map(k => [k, { ...fixos[k], ...opcao.mudancas }])) };
}
