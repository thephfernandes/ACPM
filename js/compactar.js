// Compactação da escala (fase 13): depois de montada a escala e dividida as horas, uma busca local muda voos de horário
// e de instrutor para fechar os buracos do dia. O operador escolhe o que pesa mais (os buracos dos INVAs, os dos aviões
// ou o maior buraco, de quem for) e até onde os horários podem mudar (dentro da disponibilidade do aluno, só entre a 1ª
// e a 2ª preferência, ou não mudam). Os movimentos: mudar o horário (com o mesmo instrutor), passar para outro
// instrutor (no mesmo horário), os dois juntos (para um instrutor que já voa ao lado) e trocar dois voos de mesma
// duração entre dois instrutores. Cada rodada aplica o movimento que mais diminui o custo, numa ordem fixa (a mesma
// escala dá sempre o mesmo resultado), até nenhum diminuir ou até os limites da busca. Todas as regras da escala
// continuam valendo; a soma dos quadrados das horas não cresce (a divisão das horas não piora) e o combustível não
// piora. Ficam como estão os voos fixos e os que já têm status (Atrasado, Em Voo, Cancelado), o instrutor dos voos do
// rodízio, o Noturno, o Parafuso no C152 e o horário das turmas de Ground.
import { AIRCRAFT_EQ_TYPES, GROUND_EQ_TYPE, T, NI, PESOS_DA_COMPACTACAO, LIMITES_DA_COMPACTACAO } from './config.js';
import { FROTA_INICIAL, matriculasDoTipo } from './frota.js';
import { podeFazer } from './habilitacoes.js';
import { categoriaDoRodizio } from './rodizio.js';
import { livre, cobre, cabeNoSaldo } from './viabilidade.js';
import { reducaoNecessaria, combustivelDoVoo } from './combustivel.js';
import { dentroDosLimites, normalizarLimites } from './limites.js';
import { HORARIOS_INICIAIS, horariosDaMissao, periodoDoMinuto, minutoDaPreferencia } from './horarios.js';
import { disponibilidadeDoAluno, doesGroundGateFlight } from './rules.js';
import { INTERVALO_DO_HANGAR } from './metricas.js';
import { normalizarCriterios } from './criterios.js';
import { intervaloEfetivo } from './status.js';

// Um voo que muda de instrutor junto com o horário vai para quem já voa até esta distância (minutos) dele
const ENCOSTA = 60;
const EPS = 1e-9;
// Os status em que o voo ainda pode mudar (Atrasado e Em Voo já estão no dia; Cancelado não voa)
const STATUS_QUE_MUDAM = ['Confirmado', 'Pendente'];

const soma = lista => lista.reduce((total, v) => total + v, 0);

// Os voos que ocupam o dia (sem os cancelados; o aluno cancelado de uma turma acompanha a turma), o atrasado no
// horário novo (revisão de 14/11). Os voos de out ficam os mesmos objetos, menos o atrasado (uma cópia, que nunca muda:
// o voo com status fica onde está)
function ocupando(out, estado) {
  const statusDe = v => (estado.fStatus && estado.fStatus[v.fKey]) || v.status || 'Confirmado';
  const ativas = new Set(out.filter(o => statusDe(o) !== 'Cancelado').map(o => o.classKey || o.fKey));
  return out.filter(o => ativas.has(o.classKey || o.fKey)).map(o => {
    const efetivo = intervaloEfetivo(o, statusDe(o), (estado.fObs || {})[o.fKey]);
    return efetivo.a === o.a ? o : { ...o, ...efetivo };
  });
}
const menorPrimeiro = (a, b) => (a === b ? 0 : a - b);

// As paradas (minutos) entre os blocos de uma lista de intervalos [início, fim]; os que se encostam ou se sobrepõem
// formam um bloco só
function paradas(intervalos) {
  intervalos.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const lista = [];
  let fim = null;
  for (const [a, b] of intervalos) {
    if (fim !== null && a > fim) lista.push(a - fim);
    fim = fim === null ? b : Math.max(fim, b);
  }
  return lista;
}

// O custo do dia de um instrutor e do dia de um avião, pelo critério
function custoDoInstrutor(intervalos, pesos) {
  const p = paradas(intervalos);
  return pesos.quadrado ? soma(p.map(g => g * g)) * pesos.quadrado : soma(p) * pesos.invaParado;
}
function custoDoAviao(intervalos, pesos) {
  if (!intervalos.length) return 0;
  const p = paradas(intervalos);
  if (pesos.quadrado) return soma(p.map(g => g * g)) * pesos.quadrado;
  return soma(p) * pesos.aviaoParado + (1 + p.filter(g => g >= INTERVALO_DO_HANGAR).length) * pesos.saida;
}
// A preferência perdida: nada na 1ª, um pouco na 2ª, mais em outro horário; pesa mais para quem tem mais prioridade
function custoDaPreferencia(a, pedido, pesos) {
  if (!pedido || a === minutoDaPreferencia(pedido.p1)) return 0;
  return (a === minutoDaPreferencia(pedido.p2) ? pesos.p2 : pesos.outro) * (+pedido.pr || 3) / 3;
}

const pedidosDo = estado => {
  const alunos = new Map((estado.stu || []).map(s => [s.id, s]));
  return v => { const s = alunos.get(v.stuId); return s && (v.mid ? (s.extra || []).find(ex => ex.mid === v.mid) : s); };
};
const agrupar = (lista, chave) => lista.reduce((grupos, o) => grupos.set(chave(o), [...(grupos.get(chave(o)) || []), o]), new Map());

// O custo da escala pelo critério do dia (o mesmo que a busca diminui): os dias dos instrutores, os dos aviões e as
// preferências perdidas
export function custoDaEscala(out, estado) {
  const pesos = PESOS_DA_COMPACTACAO[normalizarCriterios(estado.criterios).buracos];
  const pedidoDe = pedidosDo(estado);
  const unidades = [...new Map(ocupando(out, estado).map(o => [o.classKey || o.fKey, o])).values()];
  const intervalos = lista => lista.map(o => [o.a, o.b]);
  return soma([...agrupar(unidades, o => o.insId).values()].map(l => custoDoInstrutor(intervalos(l), pesos)))
    + soma([...agrupar(unidades.filter(o => AIRCRAFT_EQ_TYPES.includes(o.eqType)), o => o.r).values()].map(l => custoDoAviao(intervalos(l), pesos)))
    + soma(out.filter(o => !o.isGround).map(o => custoDaPreferencia(o.a, pedidoDe(o), PESOS_DA_COMPACTACAO.preferencia)));
}

// A busca. Muda os voos de out no lugar (horário, período, instrutor, peso, combustível, avião e a etiqueta da
// preferência) e devolve quantos movimentos fez
export function compactar(out, state, { saldo = () => Infinity, posicao = () => 0, limites: limitesDados, historico = () => null, limitesDaBusca = LIMITES_DA_COMPACTACAO } = {}) {
  // Sem os limites, os do estado (revisão de 14/11)
  const limites = limitesDados || normalizarLimites(state.limites);
  const { buracos, horarios: regra } = normalizarCriterios(state.criterios);
  const pesos = PESOS_DA_COMPACTACAO[buracos], pesosDaPreferencia = PESOS_DA_COMPACTACAO.preferencia;
  const frota = Array.isArray(state.frota) ? state.frota : FROTA_INICIAL;
  const horarios = state.horarios || HORARIOS_INICIAIS;
  const ativos = state.ins.filter(x => x.on).sort((p, q) => p.id - q.id);
  const instrutor = new Map(state.ins.map(x => [x.id, x]));
  const alunos = new Map(state.stu.map(s => [s.id, s]));
  const pedidoDe = pedidosDo(state);
  const statusDe = v => (state.fStatus && state.fStatus[v.fKey]) || v.status || 'Confirmado';

  // As unidades: um voo, ou uma turma de Ground inteira (1h30 uma vez só). O voo cancelado não ocupa nada e o atrasado
  // ocupa o horário novo (revisão de 14/11); os dois ficam onde estão
  const unidades = [...agrupar(ocupando(out, state), o => o.classKey || o.fKey).values()].map(voos => {
    const v = voos[0];
    const presa = voos.some(o => o.fixo || !STATUS_QUE_MUDAM.includes(statusDe(o))) || v.mis === 'Noturno' || (v.mis === 'Parafuso' && v.eqType === 'C152');
    return {
      chave: v.classKey || v.fKey, voos, a: v.a, b: v.b, dur: v.b - v.a, h: v.h, insId: v.insId, r: v.r, mis: v.mis,
      tipo: v.isGround ? GROUND_EQ_TYPE : v.eqType, isGround: v.isGround, aviao: AIRCRAFT_EQ_TYPES.includes(v.eqType),
      alunos: voos.map(o => o.stuId), original: v.a,
      mudaHorario: !presa && !v.isGround && regra !== 'fixos',
      mudaInstrutor: !presa && !categoriaDoRodizio(v.mis, v.eqType)
    };
  });

  // Os horários de cada voo: os da categoria, no período aberto, até as 17:30, na disponibilidade do aluno (ou só a 1ª
  // e a 2ª preferência) e depois do Ground que libera o voo
  for (const u of unidades.filter(x => x.mudaHorario)) {
    const pedido = pedidoDe(u.voos[0]) || {};
    const permitidas = disponibilidadeDoAluno(pedido.jan);
    const preferidos = [minutoDaPreferencia(pedido.p1), minutoDaPreferencia(pedido.p2)];
    const depoisDoGround = Math.max(0, ...unidades.filter(g => g.isGround && g.alunos.includes(u.alunos[0]) && doesGroundGateFlight(g.mis, { mis: u.mis, eq: u.tipo })).map(g => g.b));
    u.inicios = horariosDaMissao(horarios, u.mis, u.tipo).filter(m => state.win[periodoDoMinuto(m)] && m + u.dur <= T[NI] && m >= depoisDoGround
      && (!permitidas || permitidas(m)) && (regra !== 'preferencias' || preferidos.includes(m)));
    if (!u.inicios.length) u.mudaHorario = false;
  }

  // Quem está onde: os dias dos instrutores, dos recursos (aviões e simuladores) e dos alunos, e as horas de cada instrutor
  const doInstrutor = new Map(), doRecurso = new Map(), doAluno = new Map(), cargas = new Map(ativos.map(x => [x.id, 0]));
  const por = (mapa, k) => mapa.get(k) || mapa.set(k, new Set()).get(k);
  for (const u of unidades) {
    por(doInstrutor, u.insId).add(u);
    if (!u.isGround) por(doRecurso, u.r).add(u);
    u.alunos.forEach(s => por(doAluno, s).add(u));
    cargas.set(u.insId, (cargas.get(u.insId) || 0) + u.h);
  }
  // Os intervalos de um conjunto, sem as unidades que saem e com os horários que entram
  const intervalosDe = (conjunto, sem, com = []) => {
    const lista = [];
    if (conjunto) for (const u of conjunto) if (!sem.includes(u)) lista.push([u.a, u.b]);
    return lista.concat(com);
  };
  const custosDosInstrutores = new Map(), custosDosAvioes = new Map();
  const custoAtualDoInstrutor = id => (custosDosInstrutores.has(id) ? custosDosInstrutores.get(id)
    : custosDosInstrutores.set(id, custoDoInstrutor(intervalosDe(doInstrutor.get(id), []), pesos)).get(id));
  const custoAtualDoAviao = r => (custosDosAvioes.has(r) ? custosDosAvioes.get(r)
    : custosDosAvioes.set(r, custoDoAviao(intervalosDe(doRecurso.get(r), []), pesos)).get(r));

  // O recurso serve: disponível, livre (sem as unidades que saem) e, se for outro, com saldo até a revisão de 50 horas
  const horasNoRecurso = (r, sem) => { let t = 0; for (const u of doRecurso.get(r) || []) if (!sem.includes(u)) t += u.h; return t; };
  const recursoServe = (u, r, a, b, sem) => Boolean(state.av[r]) && livre(intervalosDe(doRecurso.get(r), sem), a, b)
    && (r === u.r || cabeNoSaldo(horasNoRecurso(r, sem), u.h, saldo(r)));
  const folga = (r, a, b, sem) => intervalosDe(doRecurso.get(r), sem).reduce((m, [x, y]) => Math.min(m, y <= a ? a - y : x >= b ? x - b : 0), Infinity);
  // Num horário novo, o mesmo avião quando ele está livre; senão, um que já saiu com a menor folga, depois o do hangar
  function recursoPara(u, a, b) {
    if (recursoServe(u, u.r, a, b, [u])) return u.r;
    return matriculasDoTipo(frota, u.tipo).filter(r => r !== u.r && recursoServe(u, r, a, b, [u]))
      .sort((p, q) => menorPrimeiro(folga(p, a, b, [u]), folga(q, a, b, [u])) || posicao(p) - posicao(q))[0] || null;
  }

  // Quanto o custo muda com as mudanças (cada uma: a unidade, o horário novo, o instrutor e o recurso)
  let avaliacoes = 0, verificacoes = 0;
  function diferenca(mudancas) {
    avaliacoes++;
    const movidas = mudancas.map(m => m.u);
    const ids = new Set(mudancas.flatMap(m => [m.u.insId, m.insId]));
    const regs = new Set(mudancas.filter(m => m.u.aviao).flatMap(m => [m.u.r, m.r]));
    let d = 0;
    for (const id of ids) {
      const com = mudancas.filter(m => m.insId === id).map(m => [m.a, m.a + m.u.dur]);
      d += custoDoInstrutor(intervalosDe(doInstrutor.get(id), movidas, com), pesos) - custoAtualDoInstrutor(id);
    }
    for (const r of regs) {
      const com = mudancas.filter(m => m.u.aviao && m.r === r).map(m => [m.a, m.a + m.u.dur]);
      d += custoDoAviao(intervalosDe(doRecurso.get(r), movidas, com), pesos) - custoAtualDoAviao(r);
    }
    for (const m of mudancas) {
      if (m.a === m.u.a) continue;
      for (const v of m.u.voos) d += custoDaPreferencia(m.a, pedidoDe(v), pesosDaPreferencia) - custoDaPreferencia(m.u.a, pedidoDe(v), pesosDaPreferencia);
    }
    return d;
  }

  // As regras da escala com as mudanças: o instrutor (habilitado, disponível, livre, dentro da lei; o novo, sem
  // bloqueio do aluno, sem já voar com ele no dia, com o peso conferido e sem piorar o combustível), o aluno livre e o
  // recurso
  function viavel(mudancas) {
    verificacoes++;
    const movidas = mudancas.map(m => m.u);
    for (const m of mudancas) {
      const { u, a } = m, b = a + u.dur;
      const mudouHorario = a !== u.a, mudouInstrutor = m.insId !== u.insId;
      const x = instrutor.get(m.insId);
      const outras = mudancas.filter(n => n !== m && n.insId === m.insId);
      if (mudouHorario || mudouInstrutor) {
        if (!x || !x.on || !podeFazer(x, u.mis, u.tipo) || !cobre(x.aw, a, b)) return false;
        if (!livre(intervalosDe(doInstrutor.get(x.id), movidas, outras.map(n => [n.a, n.a + n.u.dur])), a, b)) return false;
        const compromissos = [...(doInstrutor.get(x.id) || [])].filter(w => !movidas.includes(w)).map(w => ({ a: w.a, b: w.b, voo: w.aviao }))
          .concat(outras.map(n => ({ a: n.a, b: n.a + n.u.dur, voo: n.u.aviao })));
        if (!dentroDosLimites({ compromissos, novo: { a, b, voo: u.aviao }, historico: historico(x.id), limites }).ok) return false;
      }
      if (mudouInstrutor) {
        for (const v of u.voos) {
          const aluno = alunos.get(v.stuId);
          if (aluno && (aluno.bl || []).includes(x.id)) return false;
          const jaVoa = w => w.insId === x.id && !movidas.includes(w);
          if ([...(doAluno.get(v.stuId) || [])].some(jaVoa) || outras.some(n => n.u.alunos.includes(v.stuId))) return false;
          if (u.isGround || !v.limKg || !v.stuKg) continue;
          if (!x.kg || reducaoNecessaria({ stuKg: v.stuKg, insKg: x.kg, tipo: v.eqType, minutos: u.dur, mis: v.mis }) > (v.comb ? v.comb.reduzirGal : 0)) return false;
        }
      }
      if (mudouHorario) {
        for (const s of u.alunos) if (!livre(intervalosDe(doAluno.get(s), movidas), a, b)) return false;
      }
      if ((mudouHorario || m.r !== u.r) && !u.isGround && !recursoServe(u, m.r, a, b, movidas)) return false;
    }
    return true;
  }

  function aplicar(mudancas) {
    for (const { u } of mudancas) {
      doInstrutor.get(u.insId).delete(u);
      if (!u.isGround) doRecurso.get(u.r).delete(u);
      cargas.set(u.insId, cargas.get(u.insId) - u.h);
      custosDosInstrutores.delete(u.insId);
      if (u.aviao) custosDosAvioes.delete(u.r);
    }
    for (const m of mudancas) {
      const { u } = m, x = instrutor.get(m.insId);
      Object.assign(u, { a: m.a, b: m.a + u.dur, insId: m.insId, r: m.r });
      por(doInstrutor, u.insId).add(u);
      if (!u.isGround) por(doRecurso, u.r).add(u);
      cargas.set(u.insId, (cargas.get(u.insId) || 0) + u.h);
      custosDosInstrutores.delete(u.insId);
      if (u.aviao) custosDosAvioes.delete(u.r);
      for (const v of u.voos) {
        Object.assign(v, { a: u.a, b: u.b, r: u.r });
        if (!v.isGround) v.w = periodoDoMinuto(v.a);
        if (v.insId === x.id) continue;
        Object.assign(v, { insId: x.id, ins: x.nm, insKg: x.kg || 0, kg: v.stuKg && x.kg ? v.stuKg + x.kg : 0 });
        if (!v.isGround) { delete v.comb; Object.assign(v, combustivelDoVoo(v.stuKg, x.kg, v.eqType, v.b - v.a, v.mis)); }
      }
    }
  }

  // Quem já voa até ENCOSTA minutos antes ou depois do horário
  const encosta = (id, a, b, u) => [...(doInstrutor.get(id) || [])].some(w => w !== u && ((w.b <= a && a - w.b <= ENCOSTA) || (w.a >= b && w.a - b <= ENCOSTA)));
  const cabeNaDivisao = (id, u) => (cargas.get(id) || 0) + u.h <= (cargas.get(u.insId) || 0) + EPS;

  let movimentos = 0;
  const { movimentos: maxMovimentos, verificacoes: maxVerificacoes, avaliacoes: maxAvaliacoes } = limitesDaBusca;
  const esgotou = () => verificacoes >= maxVerificacoes || avaliacoes >= maxAvaliacoes;
  while (movimentos < maxMovimentos && !esgotou()) {
    let melhor = null;
    const considerar = mudancas => {
      if (esgotou()) return;
      const d = diferenca(mudancas);
      if (d < (melhor ? melhor.d : 0) - EPS && viavel(mudancas)) melhor = { mudancas, d };
    };
    const ordem = [...unidades].sort((p, q) => p.a - q.a || (p.chave < q.chave ? -1 : 1));
    for (const [i, u] of ordem.entries()) {
      if (u.mudaHorario) {
        for (const a of u.inicios) {
          if (a === u.a) continue;
          const r = u.isGround ? u.r : recursoPara(u, a, a + u.dur);
          if (r) considerar([{ u, a, insId: u.insId, r }]);
        }
      }
      if (!u.mudaInstrutor) continue;
      for (const x of ativos) {
        if (x.id === u.insId || !cabeNaDivisao(x.id, u)) continue;
        considerar([{ u, a: u.a, insId: x.id, r: u.r }]);
        if (!u.mudaHorario) continue;
        for (const a of u.inicios) {
          if (a === u.a || !encosta(x.id, a, a + u.dur, u)) continue;
          const r = recursoPara(u, a, a + u.dur);
          if (r) considerar([{ u, a, insId: x.id, r }]);
        }
      }
      for (const w of ordem.slice(i + 1)) {
        if (!w.mudaInstrutor || w.insId === u.insId || Math.abs(w.h - u.h) > EPS) continue;
        considerar([{ u, a: u.a, insId: w.insId, r: u.r }, { u: w, a: w.a, insId: u.insId, r: w.r }]);
      }
    }
    if (!melhor) break;
    aplicar(melhor.mudancas);
    movimentos++;
  }

  // O voo que mudou de horário: na 1ª ou na 2ª preferência, ou "Horário ajustado"
  for (const u of unidades) {
    if (u.a === u.original) continue;
    for (const v of u.voos) {
      const pedido = pedidoDe(v) || {};
      v.baseTag = v.tag = v.a === minutoDaPreferencia(pedido.p1) ? 'Pref. 1' : v.a === minutoDaPreferencia(pedido.p2) ? 'Pref. 2' : 'Horário ajustado';
    }
  }
  return movimentos;
}
