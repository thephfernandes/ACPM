// Motor de alocação determinístico da escala do dia e utilitários de horas e de ocupação.
// runAllocationEngine é uma função pura: recebe o estado e devolve { out, al, tot } sem alterá-lo.
import { T, NI, DAY, NIGHT_OK, MIS, DEFAULT_LIM, GROUND_EQ_TYPE, GROUND_REG, GROUND_DURATION_MIN, GROUND_DURATION_H, REVISAO_H, MENOR_VOO_H, AIRCRAFT_EQ_TYPES } from './config.js';
import { FROTA_INICIAL, matriculasDoTipo } from './frota.js';
import { hm, fmtH } from './format.js';
import { isGroundMission, doesGroundGateFlight, disponibilidadeDoAluno, rotuloDaDisponibilidade } from './rules.js';
import { HORARIOS_INICIAIS, horariosDaMissao, periodoDoMinuto, minutoDaPreferencia } from './horarios.js';
import { podeFazer, descreverExigencias } from './habilitacoes.js';
import { categoriaDoRodizio, ajustarFilas } from './rodizio.js';
import { avisosDeAtraso } from './status.js';
import { sobrepoe, livre, cobre, pesoCabe, cabeNoSaldo } from './viabilidade.js';
import { reducaoNecessaria, combustivelDoVoo } from './combustivel.js';
import { normalizarHangar, posicaoNoHangar } from './hangar.js';
import { normalizarLimites, dentroDosLimites } from './limites.js';
import { compactar, custoDaEscala } from './compactar.js';

// Entre os instrutores possíveis, primeiro os que têm menos habilitações: os mais versáteis ficam livres
const qtdHabilitacoes = x => (Array.isArray(x.hab) ? x.hab.length : 0);

// Continuidade de avião (eficiência de pátio): a alocação segue a prioridade dos pedidos, não o horário, e às vezes
// deixa um instrutor em duas matrículas do mesmo tipo. Depois de alocar, as matrículas de cada tipo de avião são
// redistribuídas com o instrutor como unidade: quem tem mais voos escolhe primeiro e fica com uma matrícula livre em
// todos os seus horários; se não houver, voo a voo, primeiro nas matrículas que ele já usa. Só a matrícula muda
// (aluno, instrutor e horário continuam); o PR-JPL continua só para o Parafuso e aviões em manutenção não entram.
// A redistribuição só vale quando diminui as trocas de avião (senão, ou se algum voo não couber, fica a original).
// Por último, quem ainda estiver em duas matrículas passa para uma que esteja livre em todos os horários dele.
const TIPOS_DE_AVIAO = ['C152', 'C172', 'PA-34'];

// A folga entre um voo e o que o avião já voa (0 se encosta; Infinity se o avião ainda está no hangar)
const folgaAte = (ocupados, a, b) => ocupados.reduce((menor, [x, y]) => Math.min(menor, y <= a ? a - y : x >= b ? x - b : 0), Infinity);
const menorPrimeiro = (fa, fb) => (fa === fb ? 0 : fa - fb);

// O tempo parado dos aviões (minutos entre um voo e o seguinte de cada matrícula)
function paradoDosAvioes(voos, matricula) {
  const porMatricula = new Map();
  voos.forEach(o => (porMatricula.get(matricula(o)) || porMatricula.set(matricula(o), []).get(matricula(o))).push([o.a, o.b]));
  let total = 0;
  for (const lista of porMatricula.values()) {
    lista.sort((x, y) => x[0] - y[0]);
    let fim = lista[0][1];
    for (const [a, b] of lista.slice(1)) { if (a > fim) total += a - fim; fim = Math.max(fim, b); }
  }
  return total;
}

// Matrículas a mais (do mesmo tipo) por instrutor no dia
function trocasDeAviao(voos, matricula) {
  const porInstrutor = new Map();
  voos.forEach(o => (porInstrutor.get(o.insId) || porInstrutor.set(o.insId, new Set()).get(o.insId)).add(matricula(o)));
  return [...porInstrutor.values()].reduce((total, regs) => total + regs.size - 1, 0);
}

// As matrículas chegam na ordem do hangar. Cada instrutor, pela hora do primeiro voo, vai para o avião onde o dia
// inteiro dele cabe: primeiro um que já saiu, com a menor folga até os voos dele; senão, o primeiro do hangar
function redistribuirTipo(voos, matriculas, saldo, fixos = []) {
  const ocupacao = new Map(matriculas.map(r => [r, fixos.filter(o => o.r === r).map(o => [o.a, o.b])]));
  const horas = new Map(matriculas.map(r => [r, fixos.filter(o => o.r === r).reduce((total, o) => total + o.h, 0)]));
  const cabe = (r, f) => livre(ocupacao.get(r), f.a, f.b) && cabeNoSaldo(horas.get(r), f.h, saldo(r));
  const blocos = new Map();
  voos.forEach(o => (blocos.get(o.insId) || blocos.set(o.insId, []).get(o.insId)).push(o));
  const primeiro = bloco => Math.min(...bloco.map(o => o.a));
  const ordem = [...blocos.values()].sort((x, y) => primeiro(x) - primeiro(y) || y.length - x.length);
  const folgaDoBloco = (r, bloco) => Math.min(...bloco.map(f => folgaAte(ocupacao.get(r), f.a, f.b)));
  const nova = new Map();
  for (const bloco of ordem) {
    const horasDoBloco = bloco.reduce((total, f) => total + f.h, 0);
    const inteira = matriculas.filter(r => bloco.every(f => cabe(r, f)) && cabeNoSaldo(horas.get(r), horasDoBloco, saldo(r)))
      .sort((a, b) => menorPrimeiro(folgaDoBloco(a, bloco), folgaDoBloco(b, bloco)))[0];
    for (const f of [...bloco].sort((x, y) => x.a - y.a)) {
      const jaUsadas = [...new Set(bloco.filter(o => nova.has(o)).map(o => nova.get(o)))];
      const r = inteira || [...jaUsadas, ...matriculas.filter(m => !jaUsadas.includes(m))].find(m => cabe(m, f));
      if (!r) return null;
      ocupacao.get(r).push([f.a, f.b]);
      horas.set(r, horas.get(r) + f.h);
      nova.set(f, r);
    }
  }
  return nova;
}

function manterInstrutorNoMesmoAviao(out, state, saldo, frota, posicao) {
  // Os aviões "Só Parafuso" ficam de fora: o Parafuso no C152 só pode ir para eles
  const soParafuso = matriculasDoTipo(frota, 'C152', { parafuso: true });
  for (const tipo of TIPOS_DE_AVIAO) {
    const voos = out.filter(o => o.eqType === tipo && !soParafuso.includes(o.r) && !o.fixo);
    // Os voos fixos (escala aprovada) ficam no avião deles e ocupam o horário
    const fixosDoTipo = out.filter(o => o.eqType === tipo && o.fixo && o.status !== 'Cancelado');
    const matriculas = matriculasDoTipo(frota, tipo).filter(r => state.av[r]).sort((a, b) => posicao(a) - posicao(b));
    const nova = redistribuirTipo(voos, matriculas, saldo, fixosDoTipo);
    // A distribuição nova vale quando tem menos trocas de avião; com as mesmas trocas, menos aviões fora do hangar e,
    // com os mesmos aviões, menos tempo parado
    const pontos = matricula => [trocasDeAviao(voos, matricula), new Set(voos.map(matricula)).size, paradoDosAvioes(voos, matricula)];
    const [novos, atuais] = nova && voos.length ? [pontos(o => nova.get(o)), pontos(o => o.r)] : [null, null];
    if (novos && (novos[0] - atuais[0] || novos[1] - atuais[1] || novos[2] - atuais[2]) < 0) voos.forEach(o => { o.r = nova.get(o); });

    // Cada mudança tira uma troca do dia, então a repetição termina; uma mudança pode liberar outra
    const horasDe = lista => lista.reduce((total, o) => total + o.h, 0);
    const livreEmTodos = (r, meus) => meus.every(f => ![...voos, ...fixosDoTipo].some(o => !meus.includes(o) && o.r === r && sobrepoe(o.a, o.b, f.a, f.b))) &&
      cabeNoSaldo(horasDe([...voos, ...fixosDoTipo].filter(o => o.r === r && !meus.includes(o))), horasDe(meus), saldo(r));
    let mudou = true;
    while (mudou) {
      mudou = false;
      for (const insId of new Set(voos.map(o => o.insId))) {
        const meus = voos.filter(o => o.insId === insId);
        const usadas = [...new Set(meus.map(o => o.r))];
        if (usadas.length < 2) continue;
        const voosEm = r => meus.filter(o => o.r === r).length;
        const destino = [...usadas.sort((a, b) => voosEm(b) - voosEm(a)), ...matriculas.filter(r => !usadas.includes(r))]
          .find(r => livreEmTodos(r, meus));
        if (destino) {
          meus.forEach(o => { o.r = destino; });
          mudou = true;
        }
      }
    }
  }
}

// Comparação de chaves de ordenação: a primeira posição diferente decide
const vemAntes = (a, b) => { const i = a.findIndex((v, k) => v !== b[k]); return i >= 0 && a[i] < b[i]; };

// Avisos dos limites da lei: com a escala do dia, o instrutor chega a 90% das horas de voo do mês, do semestre ou do ano
function avisosDeLimite(out, state, limites, historico) {
  const horasHoje = {};
  new Map(out.map(o => [o.classKey || o.fKey, o])).forEach(o => {
    if (AIRCRAFT_EQ_TYPES.includes(o.eqType)) horasHoje[o.insId] = (horasHoje[o.insId] || 0) + o.h;
  });
  const avisos = [];
  for (const [id, hoje] of Object.entries(horasHoje)) {
    const h = historico(+id);
    if (!h) continue;
    const x = state.ins.find(i => i.id === +id);
    for (const [periodo, limite, passadas] of [['mês', limites.vooMesH, h.mes], ['semestre', limites.vooSemestreH, h.semestre], ['ano', limites.vooAnoH, h.ano]]) {
      const total = Math.round((passadas + hoje) * 10) / 10;
      if (limite !== null && total >= 0.9 * limite) {
        avisos.push({ t: 'warn', s: x ? x.nm : `Instrutor ${id}`, m: `Limite da lei: com esta escala, ${String(total).replace('.', ',')} h de voo no ${periodo} (limite de ${limite} h).` });
      }
    }
  }
  return avisos;
}

// O tempo parado de um instrutor (minutos entre um compromisso e o seguinte), pelas unidades dele no dia
function paradoDasUnidades(unidades) {
  const intervalos = unidades.map(u => [u.a, u.b]).sort((p, q) => p[0] - q[0]);
  let total = 0, fim = null;
  for (const [a, b] of intervalos) {
    if (fim !== null && a > fim) total += a - fim;
    fim = fim === null ? b : Math.max(fim, b);
  }
  return total;
}

// Divisão igual das horas do dia (fase 7): depois de montada a escala, voos e aulas passam do instrutor com mais
// horas para o com menos, enquanto todas as regras continuam valendo: a habilitação, a disponibilidade durante todo o
// voo, o horário livre, o bloqueio do aluno, o peso e o aluno não repetir o instrutor no dia. Os voos do rodízio
// (cheque, MLTE, noturno e C172) ficam com quem a fila escolheu; a turma de Ground se move inteira e conta 1h30 uma
// vez. Cada troca diminui a soma dos quadrados das horas, então a repetição termina. O status dos voos não conta: o
// equilíbrio não muda quando um voo é cancelado
function equalizarHoras(out, state, limites, historico) {
  const ativos = state.ins.filter(x => x.on);
  const alunos = new Map(state.stu.map(s => [s.id, s]));
  const grupos = new Map();
  out.forEach(o => {
    const chave = o.classKey || o.fKey;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(o);
  });
  const unidades = [...grupos.values()].map(voos => ({ voos, a: voos[0].a, b: voos[0].b, h: voos[0].h, mis: voos[0].mis, eqType: voos[0].eqType, isGround: voos[0].isGround }));
  const instrutorDa = u => u.voos[0].insId;
  const daQuem = id => unidades.filter(u => instrutorDa(u) === id);

  const podeReceber = (x, u) => {
    if (instrutorDa(u) === x.id || !podeFazer(x, u.mis, u.isGround ? GROUND_EQ_TYPE : u.eqType) || !cobre(x.aw, u.a, u.b)) return false;
    const deles = daQuem(x.id);
    if (deles.some(o => sobrepoe(o.a, o.b, u.a, u.b))) return false;
    // Os limites da Lei do Aeronauta do receptor com o voo a mais (fase 11)
    const compromisso = o => ({ a: o.a, b: o.b, voo: AIRCRAFT_EQ_TYPES.includes(o.eqType) });
    if (!dentroDosLimites({ compromissos: deles.map(compromisso), novo: compromisso(u), historico: historico(x.id), limites }).ok) return false;
    return u.voos.every(v => {
      const aluno = alunos.get(v.stuId);
      if (aluno && aluno.bl.includes(x.id)) return false;
      if (deles.some(o => o.voos.some(w => w.stuId === v.stuId))) return false;
      if (u.isGround || !v.limKg || !v.stuKg) return true;
      if (!x.kg) return false;
      return reducaoNecessaria({ stuKg: v.stuKg, insKg: x.kg, tipo: v.eqType, minutos: v.b - v.a, mis: v.mis }) <= (v.comb ? v.comb.reduzirGal : 0);
    });
  };

  for (let rodada = 0; rodada < 1000; rodada++) {
    const horas = new Map(ativos.map(x => [x.id, 0]));
    unidades.forEach(u => horas.set(instrutorDa(u), (horas.get(instrutorDa(u)) || 0) + u.h));
    // Do instrutor com mais horas, entre as passagens válidas, a que deixa menos tempo parado no dia dos dois (fase 10);
    // empatadas, para quem tem menos horas, menos habilitações e o menor id, e o voo mais cedo
    let troca = null;
    for (const doador of [...horas.keys()].sort((p, q) => horas.get(q) - horas.get(p) || p - q)) {
      const meus = daQuem(doador);
      for (const u of meus.filter(o => !categoriaDoRodizio(o.mis, o.eqType) && !o.voos.some(v => v.fixo))) {
        const semEle = paradoDasUnidades(meus.filter(o => o !== u)) - paradoDasUnidades(meus);
        for (const x of ativos) {
          if (!(horas.get(x.id) + u.h < horas.get(doador) - 1e-9) || !podeReceber(x, u)) continue;
          const deles = daQuem(x.id);
          const chave = [semEle + paradoDasUnidades([...deles, u]) - paradoDasUnidades(deles), horas.get(x.id), qtdHabilitacoes(x), x.id, u.a];
          if (!troca || vemAntes(chave, troca.chave)) troca = { u, x, chave };
        }
      }
      if (troca) break;
    }
    if (!troca) return;
    for (const v of troca.u.voos) {
      v.insId = troca.x.id;
      v.ins = troca.x.nm;
      v.insKg = troca.x.kg || 0;
      v.kg = v.stuKg && troca.x.kg ? v.stuKg + troca.x.kg : 0;
      if (!v.isGround) {
        delete v.comb;
        Object.assign(v, combustivelDoVoo(v.stuKg, troca.x.kg, v.eqType, v.b - v.a, v.mis));
      }
    }
  }
}

// opcoes.compactar: false monta a escala sem a compactação (para comparar e medir)
export function runAllocationEngine(state, opcoes = {}) {
  const used = {}, busy = {}, stuBusy = {}, stuLastPick = {}, load = {}, eu = {}, out = [], al = [];
  // A frota vem do cadastro (fase 7); sem ela (estados de teste antigos), a frota inicial
  const frota = Array.isArray(state.frota) ? state.frota : FROTA_INICIAL;
  const soParafuso = matriculasDoTipo(frota, 'C152', { parafuso: true });
  const nomesSoParafuso = soParafuso.length ? soParafuso.join(' ou ') : 'marcada como “Só Parafuso”';
  // Os horários de decolagem de cada categoria vêm do cadastro (fase 7); sem eles, os iniciais
  const horarios = state.horarios || HORARIOS_INICIAIS;
  // A ordem dos aviões no hangar (fase 10): da frente para o fundo; sem ela, a ordem da frota
  const hangar = normalizarHangar(state.hangar, frota);
  const posicao = r => posicaoNoHangar(hangar, r);
  // Limites da Lei do Aeronauta (fase 11): as horas de voo de antes de hoje e o fim de ontem de cada instrutor, e os
  // compromissos de hoje (voo em avião conta como voo; simulador e Ground, só na jornada)
  const limites = normalizarLimites(state.limites);
  const horasPassadas = state.horasDosInstrutores || {};
  const historico = id => horasPassadas[id] || null;
  const compromissos = {};
  const cabeNosLimites = (x, a, b, voo, outros = []) =>
    dentroDosLimites({ compromissos: [...(compromissos[x.id] || []), ...outros], novo: { a, b, voo }, historico: historico(x.id), limites }).ok;
  // Aeronaves/simuladores que cada instrutor já usou no dia, na ordem em que foram escalados
  const insAircraft = {};
  // Armazena turmas abertas de Ground School por missão para permitir múltiplos alunos no mesmo horário/instrutor
  const openGroundClasses = {};
  // Registra os Grounds agendados por aluno no dia para exigir precedência antes do respectivo voo
  const stuGroundStatus = {};

  // Monta fila de pedidos de missão (suporta múltiplas missões por aluno no mesmo dia)
  const act = [];
  state.stu.forEach((st, stuIdx) => {
    if (st.fly) {
      act.push({ stu: st, stuId: st.id, mid: 0, ref: st, stuOrder: stuIdx, misOrder: 0 });
    }
    if (Array.isArray(st.extra)) {
      st.extra.forEach((ex, exIdx) => {
        if (ex.fly) {
          act.push({ stu: st, stuId: st.id, mid: ex.mid, ref: ex, stuOrder: stuIdx, misOrder: exIdx + 1 });
        }
      });
    }
  });

  // Registra todos os Grounds que cada aluno tem marcados para hoje (para checar precedência nos voos)
  act.forEach(item => {
    if (isGroundMission(item.ref.mis)) {
      (stuGroundStatus[item.stuId] = stuGroundStatus[item.stuId] || []).push({
        mis: item.ref.mis,
        allocatedEnd: null
      });
    }
  });

  /**
   * Ordenação da Fila:
   * 1º: Missões de Ground School SEMPRE antes de missões de Voo/Simulador (garante a criação das turmas
   *     coletivas e define o horário de término do Ground antes de alocar o voo dependente do aluno).
   * 2º: Maior prioridade (5 a 1).
   * 3º: Ordem de cadastro do aluno e ordem da missão.
   */
  act.sort((a, b) => {
    const gA = isGroundMission(a.ref.mis) ? 1 : 0;
    const gB = isGroundMission(b.ref.mis) ? 1 : 0;
    if (gA !== gB) return gB - gA;
    return b.ref.pr - a.ref.pr || a.stuOrder - b.stuOrder || a.misOrder - b.misOrder;
  });

  const free = (mp, id, s, e) => livre(mp[id], s, e);
  // Rodízio: a fila de cada categoria (cheque, MLTE, noturno e C172) e os voos dela que cada instrutor já recebeu hoje
  const filas = ajustarFilas(state.filas, state.ins);
  const voosNaCategoria = {};

  // Revisão de 50 horas: horas que o avião ainda pode voar hoje (sem as horas informadas, não há limite)
  const horas = state.horas || {};
  const saldo = r => (typeof horas[r] === 'number' ? REVISAO_H - horas[r] : Infinity);

  // Escala aprovada (fase 12): os voos fixos entram primeiro, no mesmo horário, avião e instrutor; o resto é encaixado
  // em volta. O fixo que ficou impossível continua onde está, em conflito (com o motivo); o cancelado não ocupa nada
  const fixos = state.fixos && typeof state.fixos === 'object' ? state.fixos : {};
  // As sessões fixas de um pedido (as chaves aluno_missão_sessão), em ordem
  const sessoesFixas = item => Object.keys(fixos).filter(k => k.startsWith(`${item.stuId}_${item.mid}_`) && /^\d+$/.test(k.slice(`${item.stuId}_${item.mid}_`.length)))
    .sort((p, q) => +p.split('_')[2] - +q.split('_')[2]);
  for (const item of act) {
    const chaves = sessoesFixas(item);
    for (const [j, fKey] of chaves.entries()) {
      const pino = fixos[fKey];
      const { stu, stuId, mid, ref: d, stuOrder } = item;
      const ground = isGroundMission(d.mis);
      const { a, b, r, insId } = pino;
      const classKey = ground ? pino.classKey || fKey : fKey;
      const x = state.ins.find(i => i.id === insId);
      const status = (state.fStatus && state.fStatus[fKey]) || 'Confirmado';
      const tipo = ground ? GROUND_EQ_TYPE : d.eq;
      const daMesmaTurma = ground && out.some(o => o.classKey === classKey && o.stuId !== stuId);
      const conflito = [];
      if (status !== 'Cancelado') {
        if (!x) conflito.push('o instrutor saiu do cadastro');
        else {
          if (!x.on || !cobre(x.aw, a, b)) conflito.push('o instrutor não está disponível');
          if (!podeFazer(x, d.mis, tipo)) conflito.push('o instrutor não tem a habilitação da missão');
          if (!daMesmaTurma && !free(busy, x.id, a, b)) conflito.push('o instrutor já tem outro compromisso neste horário');
        }
        if (!ground) {
          const recurso = frota.find(f => f.reg === r);
          if (!recurso || recurso.tipo !== d.eq) conflito.push('a missão ou o avião do pedido mudou');
          else if (!state.av[r]) conflito.push('o avião está indisponível');
          if (!free(used, r, a, b)) conflito.push('o avião já está ocupado neste horário');
        } else if (!daMesmaTurma && !free(used, GROUND_REG, a, b)) conflito.push('a sala de Ground já está ocupada neste horário');
        if (!free(stuBusy, stuId, a, b)) conflito.push('o aluno já tem outro voo neste horário');
        // Ocupa o avião (ou a sala), o instrutor e o aluno; a turma ocupa a sala e o instrutor uma vez só
        const h = ground ? GROUND_DURATION_H : (b - a) / 60;
        if (!daMesmaTurma) {
          (used[ground ? GROUND_REG : r] = used[ground ? GROUND_REG : r] || []).push([a, b]);
          if (x) {
            (busy[x.id] = busy[x.id] || []).push([a, b]);
            (compromissos[x.id] ||= []).push({ a, b, voo: AIRCRAFT_EQ_TYPES.includes(tipo) });
            load[x.id] = (load[x.id] || 0) + h;
          }
          eu[ground ? GROUND_REG : r] = (eu[ground ? GROUND_REG : r] || 0) + h;
        }
        (stuBusy[stuId] = stuBusy[stuId] || []).push([a, b]);
        if (x && !ground) {
          const avioes = (insAircraft[x.id] = insAircraft[x.id] || []);
          if (!avioes.includes(r)) avioes.push(r);
          stuLastPick[stuId] = { r, x };
          const categoria = categoriaDoRodizio(d.mis, d.eq);
          if (categoria) voosNaCategoria[`${categoria}:${x.id}`] = (voosNaCategoria[`${categoria}:${x.id}`] || 0) + 1;
        }
        if (ground) {
          // A turma fixa fica aberta: um aluno novo do mesmo Ground pode entrar nela
          const turmas = (openGroundClasses[d.mis] = openGroundClasses[d.mis] || []);
          if (x && !turmas.some(c => c.classKey === classKey)) turmas.push({ classKey, mis: d.mis, w: T.indexOf(a), a, b, x, count: 0 });
          const turma = turmas.find(c => c.classKey === classKey);
          if (turma) turma.count++;
          const gRec = (stuGroundStatus[stuId] || []).find(g => g.mis === d.mis && g.allocatedEnd === null);
          if (gRec) gRec.allocatedEnd = b;
        }
      }
      const pf = [minutoDaPreferencia(d.p1), minutoDaPreferencia(d.p2)];
      const baseTag = a === pf[0] ? 'Pref. 1' : a === pf[1] ? 'Pref. 2' : 'Próximo livre';
      const lim = ground ? 0 : DEFAULT_LIM[d.eq] || 0;
      out.push({
        fKey, classKey, isGround: ground,
        w: ground && T.indexOf(a) >= 0 ? T.indexOf(a) : periodoDoMinuto(a), a, b,
        o: stuOrder, stuId, mid, insId, eqType: tipo,
        s: stu.nm, mis: d.mis, h: ground ? GROUND_DURATION_H : (b - a) / 60, ss: `${j + 1}/${chaves.length}`,
        ...(d.etapa ? { etapa: d.etapa } : {}),
        r: ground ? GROUND_REG : r, ins: x ? x.nm : 'Instrutor fora do cadastro',
        stuKg: stu.kg || 0, insKg: (x && x.kg) || 0, limKg: lim, kg: stu.kg && x && x.kg ? stu.kg + x.kg : 0,
        ...(ground || !x ? {} : combustivelDoVoo(stu.kg, x.kg, d.eq, b - a, d.mis)),
        baseTag, tag: baseTag, status, fixo: true,
        ...(conflito.length ? { conflito } : {})
      });
      if (conflito.length) al.push({ t: 'conf', s: mid ? `${stu.nm} (${d.mis})` : stu.nm, fKey, m: `Conflito na escala aprovada: ${conflito.join('; ')}.` });
    }
  }

  for (const item of act) {
    if (sessoesFixas(item).length) continue;
    const { stu, stuId, mid, ref: d, stuOrder } = item;
    const m = MIS[d.mis] || MIS['Voo Local'];
    const nm = stu.nm;
    const labelStu = mid ? `${nm} (${d.mis})` : nm;
    const isGnd = Boolean(m.isGround);
    // Disponibilidade do aluno: o voo (ou o Ground) só começa nesses horários (por período ou num horário exato)
    const permitidas = disponibilidadeDoAluno(d.jan);
    const naDisponibilidade = minuto => !permitidas || permitidas(minuto);
    // Preferências em minutos (o número da janela dos dados antigos vale como o horário dela)
    const preferidos = [minutoDaPreferencia(d.p1), minutoDaPreferencia(d.p2)];

    // ========================================================================
    // RAMO A: ALOCAÇÃO DE GROUND SCHOOL (01h30 = 90 MIN · TURMA COLETIVA)
    // ========================================================================
    if (isGnd) {
      const habilitado = x => podeFazer(x, d.mis, GROUND_EQ_TYPE);
      const durMin = GROUND_DURATION_MIN; // 90 min (1.5 h)
      const endMax = T[NI]; // 17:30 (1050 min)
      const starts = DAY.filter(w => state.win[w] && T[w] + durMin <= endMax && naDisponibilidade(T[w]));
      const pf = preferidos.map(m => T.indexOf(m));

      // Se o aluno também tem um voo dependente hoje com horário preferido, prioriza janelas que terminem antes do voo
      const dependentFlights = act.filter(other => other.stuId === stuId && doesGroundGateFlight(d.mis, other.ref));
      const earliestFlightPrefMin = dependentFlights.reduce((minT, flt) => {
        const fp1 = minutoDaPreferencia(flt.ref.p1);
        return (fp1 >= 0 && fp1 < minT) ? fp1 : minT;
      }, Infinity);

      const candidateWins = [...new Set([...pf.filter(w => w >= 0), ...starts])].filter(w => starts.includes(w));
      // Prioriza janelas que terminam antes do voo preferido do aluno, mantendo a cascata Pref.1 -> Pref.2 -> Próximo livre
      candidateWins.sort((w1, w2) => {
        const ok1 = T[w1] + durMin <= earliestFlightPrefMin ? 0 : 1;
        const ok2 = T[w2] + durMin <= earliestFlightPrefMin ? 0 : 1;
        return ok1 - ok2;
      });

      const existingClasses = openGroundClasses[d.mis] || [];
      let chosenClass = null;

      // 1ª Tentativa: Unir-se a uma turma já aberta da mesma temática de Ground (mesmo horário e mesmo instrutor)
      const orderedExisting = [...existingClasses].sort((c1, c2) => {
        const inPref1 = pf.includes(c1.w) ? 0 : 1;
        const inPref2 = pf.includes(c2.w) ? 0 : 1;
        if (inPref1 !== inPref2) return inPref1 - inPref2;
        const okFlt1 = c1.b <= earliestFlightPrefMin ? 0 : 1;
        const okFlt2 = c2.b <= earliestFlightPrefMin ? 0 : 1;
        return okFlt1 - okFlt2;
      });

      for (const cls of orderedExisting) {
        // A turma precisa começar na disponibilidade do aluno (manhã, tarde ou um horário exato)
        if (!naDisponibilidade(cls.a)) continue;
        if (!free(stuBusy, stuId, cls.a, cls.b)) continue;
        if (stu.bl.includes(cls.x.id)) continue;
        if (cls.b > earliestFlightPrefMin && candidateWins.some(w => T[w] + durMin <= earliestFlightPrefMin)) continue;
        chosenClass = cls;
        break;
      }

      // 2ª Tentativa: Abrir nova turma de Ground se não pôde ingressar em turma existente
      const fcGnd = { stu_busy: 0, sala: 0, disp: 0, busy: 0, bloq: 0, limite: 0 };
      if (!chosenClass) {
        // Verifica restrições de bloqueio de todos os alunos da mesma turma potencial para escolher um instrutor comum
        const cohortBlocked = new Set(stu.bl);
        act.forEach(other => {
          if (other.ref.mis === d.mis) other.stu.bl.forEach(bId => cohortBlocked.add(bId));
        });

        for (const w of candidateWins) {
          const a = T[w], b = a + durMin;
          if (!free(stuBusy, stuId, a, b)) { fcGnd.stu_busy++; continue; }

          const sameWinCls = existingClasses.find(c => c.w === w && !stu.bl.includes(c.x.id));
          if (sameWinCls) {
            chosenClass = sameWinCls;
            break;
          }

          // Há uma única sala de Ground: só abre turma nova com a sala livre durante toda a 01h30
          if (!free(used, GROUND_REG, a, b)) { fcGnd.sala++; continue; }

          const q = state.ins.filter(x => x.on && habilitado(x) && cobre(x.aw, a, b));
          if (!q.length) { fcGnd.disp++; continue; }

          const f1 = q.filter(x => free(busy, x.id, a, b));
          if (!f1.length) { fcGnd.busy++; continue; }

          const sobra = f1.filter(x => !stu.bl.includes(x.id));
          if (!sobra.length) { fcGnd.bloq++; continue; }

          const f2 = sobra.filter(x => cabeNosLimites(x, a, b, false));
          if (!f2.length) { fcGnd.limite++; continue; }

          // Ordena instrutores priorizando: não bloqueado pela turma -> MENOS HABILITAÇÕES -> menor carga no dia
          f2.sort((x1, x2) =>
            (cohortBlocked.has(x1.id) - cohortBlocked.has(x2.id)) ||
            (qtdHabilitacoes(x1) - qtdHabilitacoes(x2)) ||
            ((load[x1.id] || 0) - (load[x2.id] || 0))
          );

          const pickedIns = f2[0];
          const classKey = `GND_${d.mis}_${w}_${pickedIns.id}`;
          chosenClass = { classKey, mis: d.mis, w, a, b, x: pickedIns, count: 0 };
          (openGroundClasses[d.mis] = openGroundClasses[d.mis] || []).push(chosenClass);

          // Marca o instrutor e a sala ocupados neste intervalo (outros alunos do MESMO Ground entram via chosenClass)
          (busy[pickedIns.id] = busy[pickedIns.id] || []).push([a, b]);
          (compromissos[pickedIns.id] ||= []).push({ a, b, voo: false });
          (used[GROUND_REG] = used[GROUND_REG] || []).push([a, b]);
          load[pickedIns.id] = (load[pickedIns.id] || 0) + GROUND_DURATION_H;
          eu[GROUND_REG] = (eu[GROUND_REG] || 0) + GROUND_DURATION_H;
          break;
        }
      }

      if (chosenClass) {
        chosenClass.count++;
        (stuBusy[stuId] = stuBusy[stuId] || []).push([chosenClass.a, chosenClass.b]);

        // Registra que o aluno concluiu este Ground às chosenClass.b (liberando voos a partir de chosenClass.b)
        const stGnds = stuGroundStatus[stuId] || [];
        const gRec = stGnds.find(g => g.mis === d.mis && g.allocatedEnd === null) || stGnds.find(g => g.mis === d.mis);
        if (gRec) gRec.allocatedEnd = chosenClass.b;

        const fKey = `${stuId}_${mid}_1`;
        const baseTag = chosenClass.w === pf[0] ? 'Pref. 1' : chosenClass.w === pf[1] ? 'Pref. 2' : 'Próximo livre';

        out.push({
          fKey,
          classKey: chosenClass.classKey,
          isGround: true,
          w: chosenClass.w, a: chosenClass.a, b: chosenClass.b,
          o: stuOrder,
          stuId,
          mid,
          insId: chosenClass.x.id,
          eqType: GROUND_EQ_TYPE,
          s: nm, mis: d.mis, h: GROUND_DURATION_H, ss: '1/1',
          // A missão do curso (fase 14)
          ...(d.etapa ? { etapa: d.etapa } : {}),
          r: GROUND_REG, ins: chosenClass.x.nm,
          stuKg: stu.kg || 0,
          insKg: chosenClass.x.kg || 0,
          limKg: 0,
          kg: 0,
          baseTag,
          tag: baseTag,
          status: (state.fStatus && state.fStatus[fKey]) || 'Confirmado'
        });
      } else {
        let why;
        if (!state.ins.some(x => x.on && habilitado(x))) {
          why = `nenhum instrutor ativo habilitado para ministrar ${d.mis} (${descreverExigencias(d.mis, GROUND_EQ_TYPE)})`;
        } else if (!starts.length) {
          why = permitidas
            ? `não há horário habilitado na disponibilidade do aluno (${rotuloDaDisponibilidade(d.jan)}) para 01h30 de Ground`
            : `nenhuma janela diurna habilitada comporta 01h30 de Ground até ${hm(endMax)}`;
        } else {
          const key = Object.keys(fcGnd).sort((a, b) => fcGnd[b] - fcGnd[a])[0];
          why = {
            stu_busy: `conflito de horário com outra missão do próprio aluno (${nm})`,
            sala: `a sala de Ground já está ocupada por outra turma nos horários testados`,
            disp: `nenhum instrutor disponível durante todo o período de 01h30`,
            busy: `todos os instrutores disponíveis já estão ocupados nos horários testados`,
            bloq: `os instrutores disponíveis no horário estão bloqueados por este aluno`,
            limite: `nenhum instrutor dentro dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários testados`
          }[key];
        }
        al.push({ t: 'err', s: labelStu, m: `Rejeitado: ${why}.` });
      }
      continue;
    }

    // ========================================================================
    // RAMO B: ALOCAÇÃO DE MISSÕES DE VOO E SIMULADOR
    // ========================================================================
    const lim = DEFAULT_LIM[d.eq] || 0;
    const H = Math.max(1, Math.round(+d.nb || 1)), K = Math.min(Math.max(+d.ss || 1, 1), H);
    const night = d.mis === 'Noturno';
    const isParafuso = d.mis === 'Parafuso';
    const exige = descreverExigencias(d.mis, d.eq);
    // Voo de categoria do rodízio: primeiro quem ainda não voou nela hoje, depois a ordem da fila
    const categoria = categoriaDoRodizio(d.mis, d.eq);
    const voosHoje = x => (categoria ? voosNaCategoria[`${categoria}:${x.id}`] || 0 : 0);
    const naFila = x => { const i = categoria ? filas[categoria].indexOf(x.id) : 0; return i < 0 ? Number.MAX_SAFE_INTEGER : i; };

    // 1. Validação de equipamento permitido para a missão
    if (!m.eq.includes(d.eq)) {
      al.push({
        t: 'err',
        s: labelStu,
        m: `Rejeitado: a missão “${d.mis}” é realizada apenas em ${m.eq.join(' ou ')} (selecionado: ${d.eq}).`
      });
      continue;
    }

    // 2. Validação de Precedência de Ground School (Ground deve ocorrer antes do 1º voo da temática)
    const gatingGrounds = (stuGroundStatus[stuId] || []).filter(g => doesGroundGateFlight(g.mis, d));
    const unallocatedGround = gatingGrounds.find(g => g.allocatedEnd === null);
    if (unallocatedGround) {
      al.push({
        t: 'err',
        s: labelStu,
        m: `Rejeitado: o pré-requisito “${unallocatedGround.mis}” agendado para hoje não pôde ser alocado antes deste voo.`
      });
      continue;
    }
    const minStartAfterGround = gatingGrounds.reduce((maxEnd, g) => Math.max(maxEnd, g.allocatedEnd || 0), 0);

    // Os horários de decolagem da categoria (o noturno, às 17:30), com o período aberto e na disponibilidade do aluno
    const starts = horariosDaMissao(horarios, d.mis, d.eq).filter(m => state.win[periodoDoMinuto(m)] && naDisponibilidade(m));
    const endMax = night ? 1440 : T[NI];
    const pf = preferidos;
    const len = Array.from({ length: K }, (_, j) => (Math.floor(H / K) + (j < H % K ? 1 : 0)) * 60);
    const plans = [];

    (function rec(j, from, pl) {
      if (j === K) { plans.push(pl); return; }
      // Horários em minutos; w é o período (a janela de operação em que o voo começa), para agrupar a escala
      const c = [...new Set([...(j < 2 ? [pf[j]] : []), ...(j == 0 ? [pf[1]] : []), ...starts])]
        .filter(m => starts.includes(m) && m >= from && m + len[j] <= endMax);
      for (const m of c) rec(j + 1, m + len[j], [...pl, { w: periodoDoMinuto(m), a: m, b: m + len[j] }]);
    })(0, minStartAfterGround, []);

    // Filtra a frota candidata respeitando a exclusividade do C152 PR-JPL (Acrobat) para Parafuso
    const fleetPool = matriculasDoTipo(frota, d.eq, { parafuso: isParafuso });

    // Duas tentativas: com o tanque cheio em todos os horários; só se nenhum par couber assim, com menos combustível
    // (o par que precisa reduzir menos vem antes)
    let fc, ch = null;
    const reducao = x => reducaoNecessaria({ stuKg: stu.kg, insKg: x.kg, tipo: d.eq, minutos: len[0], mis: d.mis });
    for (const comMenosCombustivel of [false, true]) {
    fc = { stu_busy: 0, eq: 0, revisao: 0, disp: 0, busy: 0, bloq: 0, limite: 0, peso: 0 };
    if (comMenosCombustivel && !lim) break;
    for (const pl of plans) {
      const pick = [];
      const horasNoPlano = {};
      let prev = stuLastPick[stuId] || null, bad = null;

      for (const [j, p] of pl.entries()) {
        if (!free(stuBusy, stuId, p.a, p.b)) { bad = 'stu_busy'; break; }

        const livres = fleetPool.filter(r => state.av[r] && free(used, r, p.a, p.b));
        if (!livres.length) { bad = 'eq'; break; }
        const eqs = livres.filter(r => cabeNoSaldo((eu[r] || 0) + (horasNoPlano[r] || 0), len[j] / 60, saldo(r)));
        if (!eqs.length) { bad = 'revisao'; break; }

        const q = state.ins.filter(x => x.on && podeFazer(x, d.mis, d.eq) && cobre(x.aw, p.a, p.b));
        if (!q.length) { bad = 'disp'; break; }

        const f1 = q.filter(x => free(busy, x.id, p.a, p.b));
        if (!f1.length) { bad = 'busy'; break; }

        const naoBloqueados = f1.filter(x => !stu.bl.includes(x.id));
        if (!naoBloqueados.length) { bad = 'bloq'; break; }

        const ehVoo = AIRCRAFT_EQ_TYPES.includes(d.eq);
        const f2 = naoBloqueados.filter(x => cabeNosLimites(x, p.a, p.b, ehVoo,
          pick.flatMap((s, k) => (s.x.id === x.id ? [{ a: pl[k].a, b: pl[k].b, voo: ehVoo }] : []))));
        if (!f2.length) { bad = 'limite'; break; }

        const ins = f2.filter(x => (comMenosCombustivel ? reducao(x) < Infinity : pesoCabe(stu.kg, x.kg, lim)));
        if (!ins.length) { bad = 'peso'; break; }

        ins.sort((a, b) => (comMenosCombustivel && reducao(a) - reducao(b)) || (prev && (a.id === prev.x.id) - (b.id === prev.x.id)) ||
          voosHoje(a) - voosHoje(b) || naFila(a) - naFila(b) ||
          qtdHabilitacoes(a) - qtdHabilitacoes(b) || (load[a.id] || 0) - (load[b.id] || 0));

        // O instrutor fica no mesmo avião durante o dia: primeiro o avião que ele já usou hoje, depois o rodízio do aluno
        // (evita o avião anterior dele); então um avião que já saiu, com a menor folga até o voo (fecha os buracos do dia),
        // e por último o primeiro do hangar
        const x = ins[0];
        const ordemNoInstrutor = r => { const i = (insAircraft[x.id] || []).indexOf(r); return i < 0 ? Infinity : i; };
        eqs.sort((a, b) => menorPrimeiro(ordemNoInstrutor(a), ordemNoInstrutor(b)) || (prev && (a === prev.r) - (b === prev.r)) ||
          menorPrimeiro(folgaAte(used[a] || [], p.a, p.b), folgaAte(used[b] || [], p.a, p.b)) || posicao(a) - posicao(b));

        prev = { r: eqs[0], x };
        pick.push(prev);
        horasNoPlano[eqs[0]] = (horasNoPlano[eqs[0]] || 0) + len[j] / 60;
      }

      if (bad) { fc[bad]++; continue; }
      ch = { pl, pick };
      break;
    }
    if (ch || !fc.peso) break;
    }

    if (ch) {
      const { pl, pick } = ch;
      let warned = false;
      pl.forEach((p, j) => {
        const { r, x } = pick[j], hh = len[j] / 60;
        (used[r] = used[r] || []).push([p.a, p.b]);
        (busy[x.id] = busy[x.id] || []).push([p.a, p.b]);
        (compromissos[x.id] ||= []).push({ a: p.a, b: p.b, voo: AIRCRAFT_EQ_TYPES.includes(d.eq) });
        (stuBusy[stuId] = stuBusy[stuId] || []).push([p.a, p.b]);
        stuLastPick[stuId] = { r, x };
        const avioesDoInstrutor = (insAircraft[x.id] = insAircraft[x.id] || []);
        if (!avioesDoInstrutor.includes(r)) avioesDoInstrutor.push(r);

        const fKey = `${stuId}_${mid}_${j + 1}`;
        const baseTag = p.a === pf[0] ? 'Pref. 1' : p.a === pf[1] ? 'Pref. 2' : 'Próximo livre';
        out.push({
          fKey,
          classKey: fKey,
          isGround: false,
          w: p.w, a: p.a, b: p.b,
          o: stuOrder,
          stuId,
          mid,
          insId: x.id,
          eqType: d.eq,
          s: nm, mis: d.mis, h: hh, ss: `${j + 1}/${K}`,
          ...(d.etapa ? { etapa: d.etapa } : {}),
          r, ins: x.nm,
          stuKg: stu.kg || 0,
          insKg: x.kg || 0,
          limKg: lim,
          kg: stu.kg && x.kg ? stu.kg + x.kg : 0,
          ...combustivelDoVoo(stu.kg, x.kg, d.eq, len[j], d.mis),
          baseTag,
          tag: baseTag,
          status: (state.fStatus && state.fStatus[fKey]) || 'Confirmado'
        });

        eu[r] = (eu[r] || 0) + hh;
        load[x.id] = (load[x.id] || 0) + hh;
        if (categoria) voosNaCategoria[`${categoria}:${x.id}`] = voosHoje(x) + 1;

        if (lim && !warned && (!stu.kg || !x.kg)) {
          warned = true;
          al.push({ t: 'warn', s: labelStu, m: `Peso do aluno não informado (0 kg): verificação de limite (${lim} kg) no ${d.eq} não realizada.` });
        }
      });
    } else {
      let why;
      if (isParafuso && d.eq === 'C152' && !soParafuso.some(r => state.av[r])) {
        why = soParafuso.length
          ? `a aeronave acrobática ${nomesSoParafuso} (exclusiva para Parafuso no C152) está indisponível/em manutenção`
          : 'não há na frota um C152 marcado como “Só Parafuso” (aba Recursos)';
      } else if (!fleetPool.some(r => state.av[r])) {
        why = `nenhum equipamento ${d.eq} compatível disponível (manutenção/indisponível)`;
      } else if (!state.ins.some(x => x.on && podeFazer(x, d.mis, d.eq))) {
        why = `nenhum instrutor ativo habilitado para ${d.mis} em ${d.eq} (${exige})`;
      } else if (!plans.length && permitidas) {
        why = `não há horário habilitado na disponibilidade do aluno (${rotuloDaDisponibilidade(d.jan)}) para encaixar ${H} h`;
      } else if (!plans.length) {
        why = minStartAfterGround > 0
          ? `não há janela disponível após o término do Ground School (${hm(minStartAfterGround)}) para encaixar ${H} h antes das ${hm(endMax)}`
          : `não há como encaixar ${H} h${K > 1 ? ' em ' + K + ' sessões' : ' contínuas'} ${night ? 'a partir da janela noturna (17:30)' : 'dentro do horário diurno (término até ' + hm(T[NI]) + ')'} com as janelas habilitadas`;
      } else {
        const key = Object.keys(fc).sort((a, b) => fc[b] - fc[a])[0];
        why = {
          stu_busy: `conflito de horário com outra missão/Ground do próprio aluno (${nm}) já agendada neste dia`,
          eq: isParafuso && d.eq === 'C152'
            ? `a aeronave acrobática ${nomesSoParafuso} (exclusiva para Parafuso) já está ocupada nos horários testados`
            : `falta de ${d.eq} livre nos horários testados (ocupado por voos de maior prioridade)`,
          revisao: `os ${d.eq} livres estão sem saldo até a revisão de 50 horas`,
          disp: `nenhum instrutor habilitado (${exige}) disponível durante todo o voo nos horários testados`,
          busy: `instrutores habilitados (${exige}) já ocupados em algum trecho do voo (conflito de horário)`,
          bloq: `os instrutores habilitados (${exige}) livres estão bloqueados por este aluno`,
          limite: `nenhum instrutor dentro dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários testados`,
          peso: `peso aluno + instrutor acima do limite de ${lim} kg do ${d.eq}, mesmo com o mínimo de combustível`
        }[key];
      }
      al.push({ t: 'err', s: labelStu, m: `Rejeitado: ${why}.` });
    }
  }

  equalizarHoras(out, state, limites, historico);
  // Compactação (fase 13): a escala compactada vale quando, já com as matrículas trocadas, custa menos pelo critério do
  // dia do que a escala sem compactar (a troca de matrículas mexe no tempo parado dos aviões)
  const compactada = opcoes.compactar === false ? null : out.map(o => ({ ...o }));
  if (compactada && compactar(compactada, state, { saldo, posicao, limites, historico })) {
    manterInstrutorNoMesmoAviao(compactada, state, saldo, frota, posicao);
    manterInstrutorNoMesmoAviao(out, state, saldo, frota, posicao);
    if (custoDaEscala(compactada, state) < custoDaEscala(out, state) - 1e-9) out.splice(0, out.length, ...compactada);
  } else {
    manterInstrutorNoMesmoAviao(out, state, saldo, frota, posicao);
  }
  al.push(...avisosDeLimite(out, state, limites, historico));

  // Revisão de 50 horas: horas de cada avião controlado e onde ele para (sem saldo para mais uma missão de 1 h)
  const revisao = {};
  for (const r of Object.keys(horas)) {
    if (typeof horas[r] !== 'number' || !frota.some(f => f.reg === r)) continue;
    const meus = out.filter(o => o.r === r);
    const voadas = Math.round(meus.reduce((total, o) => total + o.h, 0) * 10) / 10;
    const fim = Math.round((horas[r] + voadas) * 10) / 10;
    const para = state.av[r] !== false && REVISAO_H - fim < MENOR_VOO_H;
    const paraAs = !para ? null : meus.length ? Math.max(...meus.map(o => o.b)) : T[0];
    revisao[r] = { inicio: horas[r], voadas, fim, paraAs };
    if (para) {
      al.push({
        t: 'warn', s: r,
        m: meus.length
          ? `Aeronave parou para revisão de 50 horas às ${hm(paraAs)} (${fmtH(fim)} desde a última revisão).`
          : `Aeronave parou para revisão de 50 horas: sem saldo para voar hoje (${fmtH(fim)} desde a última revisão).`
      });
    }
  }

  // Atualiza a tag das turmas coletivas de Ground com a quantidade de alunos na mesma sala/horário
  const classCounts = {};
  out.forEach(o => {
    if (o.isGround && o.classKey) {
      classCounts[o.classKey] = (classCounts[o.classKey] || 0) + 1;
    }
  });
  out.forEach(o => {
    if (o.isGround && o.classKey) {
      const c = classCounts[o.classKey] || 1;
      o.groupSize = c;
      o.tag = c > 1 ? `${o.baseTag} · Turma (${c})` : o.baseTag;
    }
  });

  out.sort((a, b) => a.a - b.a || (b.isGround ? 1 : 0) - (a.isGround ? 1 : 0) || a.o - b.o);
  // Atraso que invade o voo seguinte do mesmo recurso, instrutor ou aluno: aviso (os horários continuam os da escala)
  al.push(...avisosDeAtraso(out, state.fStatus || {}, state.fObs || {}));
  return { out, al, tot: act.length, revisao };
}

// Calcula horas operacionais deduplicando turmas coletivas de Ground School
export function sumUniqueOperationalHours(flights, statusLookupFn) {
  const seenClasses = new Set();
  let total = 0;
  flights.forEach(o => {
    const st = statusLookupFn ? statusLookupFn(o) : (o.status || 'Confirmado');
    if (st === 'Cancelado') return;
    const key = o.classKey || o.fKey || `${o.w}_${o.a}_${o.b}_${o.mis}_${o.ins}`;
    if (o.isGround || isGroundMission(o.mis)) {
      if (seenClasses.has(key)) return;
      seenClasses.add(key);
    }
    total += (+o.h || 0);
  });
  return Math.round(total * 10) / 10;
}

/**
 * Agrupa voos para o Mapa Visual de Ocupação:
 * - Turmas coletivas de Ground School no mesmo horário/instrutor são consolidadas em uma única barra visual,
 *   evitando sobreposição de barras e contabilizando 1,5 h uma única vez para o instrutor/sala.
 */
export function consolidateTimelineSlots(flights) {
  const slots = [];
  const groundMap = new Map();

  flights.forEach(o => {
    if (o.isGround || isGroundMission(o.mis)) {
      const k = o.classKey || `GND_${o.mis}_${o.w}_${o.ins}`;
      if (!groundMap.has(k)) {
        const clone = { ...o, students: [o.s], items: [o] };
        groundMap.set(k, clone);
        slots.push(clone);
      } else {
        const g = groundMap.get(k);
        g.students.push(o.s);
        g.items.push(o);
      }
    } else {
      slots.push({ ...o, students: [o.s], items: [o] });
    }
  });

  return slots;
}
