// Motor de alocação determinístico da escala do dia e utilitários de horas e de ocupação.
// runAllocationEngine é uma função pura: recebe o estado e devolve { out, al, tot } sem alterá-lo.
import { NOTURNO, T, DAY, MIS, DEFAULT_LIM, GROUND_EQ_TYPE, GROUND_REG, GROUND_DURATION_MIN, GROUND_DURATION_H, REVISAO_H, MENOR_VOO_H, AIRCRAFT_EQ_TYPES, MISSOES_LOCAIS, LIMITE_DE_VOOS_LOCAIS, MINUTOS_DO_DIA } from './config.js';
import { FROTA_INICIAL, matriculasDoTipo, matriculasParaOVoo, motivoDoAviao, aviaoServe, instrutorVoaNoAviao, recursoDaFrota } from './frota.js';
import { hm, fmtH, numeroBr, duracaoHm } from './format.js';
import { repousoAntesDaVolta, historicoDoDia } from './noturno.js';
import { isGroundMission, doesGroundGateFlight, disponibilidadeDoAluno, rotuloDaDisponibilidade, duracaoValida, duracaoFixaDaMissao, minutoConfirmado } from './rules.js';
import { HORARIOS_INICIAIS, horariosDaMissao, periodoDoMinuto, minutoDaPreferencia, ordenarPelaPreferencia, fimDasMissoesDoDia } from './horarios.js';
import { podeFazer, descreverExigencias } from './habilitacoes.js';
import { categoriaDoRodizio, ajustarFilas } from './rodizio.js';
import { avisosDeAtraso, intervaloEfetivo, STATUS_EM_ANDAMENTO } from './status.js';
import { sobrepoe, livre, cabeNoSaldo, folgaAte, saldoAteARevisao, problemasDoInstrutor } from './viabilidade.js';
import { reducaoNecessaria, combustivelDoVoo } from './combustivel.js';
import { TEXTO_DO_PROBLEMA } from './conflitos.js';
import { normalizarHangar, posicaoNoHangar } from './hangar.js';
import { normalizarLimites } from './limites.js';
import { compactar, custoDaEscala } from './compactar.js';
import { chaveDoVoo, statusDoVoo, unidadeDoVoo, umPorUnidade, pedidosDosVoos, ocupacaoDoVoo, compromissoDoVoo, exigeDosVoos } from './voo.js';
import { menorPrimeiro, soma, paradasEntre } from './util.js';

// Entre os instrutores possíveis, primeiro os que têm menos habilitações: os mais versáteis ficam livres
const qtdHabilitacoes = x => (Array.isArray(x.hab) ? x.hab.length : 0);

// Os instrutores que servem para o horário (as regras em js/viabilidade.js). Sem nenhum, a regra que barrou o que
// chegou mais longe nelas diz o motivo da rejeição: disponível e habilitado, livre, sem bloqueio, dentro da lei e do peso
const ETAPAS_DO_INSTRUTOR = ['disp', 'busy', 'bloq', 'limite', 'peso'];
const ETAPA_DO_PROBLEMA = { 'instrutor-indisponivel': 0, habilitacao: 0, 'instrutor-ocupado': 1, bloqueio: 2, 'limite-da-lei': 3, peso: 4 };
function instrutoresQueServem(instrutores, problemasDe) {
  const servem = [];
  let maisLonge = 0;
  for (const x of instrutores) {
    const [problema] = problemasDe(x);
    if (problema) maisLonge = Math.max(maisLonge, ETAPA_DO_PROBLEMA[problema.codigo]);
    else servem.push(x);
  }
  return { servem, barrou: servem.length ? null : ETAPAS_DO_INSTRUTOR[maisLonge] };
}

// Continuidade de avião (eficiência de pátio): a alocação segue a prioridade dos pedidos, não o horário, e às vezes
// deixa um instrutor em duas matrículas do mesmo tipo. Depois de alocar, as matrículas de cada tipo de avião são
// redistribuídas com o instrutor como unidade: quem tem mais voos escolhe primeiro e fica com uma matrícula livre em
// todos os seus horários; se não houver, voo a voo, primeiro nas matrículas que ele já usa. Só a matrícula muda
// (aluno, instrutor e horário continuam); o PR-JPL continua só para o Parafuso e aviões em manutenção não entram.
// A redistribuição só vale quando diminui as trocas de avião (senão, ou se algum voo não couber, fica a original).
// Por último, quem ainda estiver em duas matrículas passa para uma que esteja livre em todos os horários dele.

// O tempo parado dos aviões (minutos entre um voo e o seguinte de cada matrícula)
function paradoDosAvioes(voos, matricula) {
  const porMatricula = new Map();
  voos.forEach(o => (porMatricula.get(matricula(o)) || porMatricula.set(matricula(o), []).get(matricula(o))).push([o.a, o.b]));
  return soma([...porMatricula.values()].flatMap(paradasEntre));
}

// Matrículas a mais (do mesmo tipo) por instrutor no dia
function trocasDeAviao(voos, matricula) {
  const porInstrutor = new Map();
  voos.forEach(o => (porInstrutor.get(o.insId) || porInstrutor.set(o.insId, new Set()).get(o.insId)).add(matricula(o)));
  return [...porInstrutor.values()].reduce((total, regs) => total + regs.size - 1, 0);
}

// As matrículas chegam na ordem do hangar. Cada instrutor, pela hora do primeiro voo, vai para o avião onde o dia
// inteiro dele cabe: primeiro um que já saiu, com a menor folga até os voos dele; senão, o primeiro do hangar. serve: se o
// avião serve ao voo (os requisitos do voo e o que o avião exige do instrutor)
function redistribuirTipo(voos, matriculas, saldo, fixos = [], serve = () => true) {
  const ocupacao = new Map(matriculas.map(r => [r, fixos.filter(o => o.r === r).map(o => [o.a, o.b])]));
  const horas = new Map(matriculas.map(r => [r, fixos.filter(o => o.r === r).reduce((total, o) => total + o.h, 0)]));
  const cabe = (r, f) => serve(r, f) && livre(ocupacao.get(r), f.a, f.b) && cabeNoSaldo(horas.get(r), f.h, saldo(r));
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

function manterInstrutorNoMesmoAviao(out, state, saldo, frota, posicao, serve) {
  // Os aviões "Só Parafuso" ficam de fora: o Parafuso no C152 só pode ir para eles
  const soParafuso = matriculasDoTipo(frota, 'C152', { parafuso: true });
  for (const tipo of AIRCRAFT_EQ_TYPES) {
    // O voo com status de andamento fica no avião dele, como o fixo
    const preso = o => o.fixo || [...STATUS_EM_ANDAMENTO, 'Cancelado'].includes(statusDoVoo(o, state.fStatus));
    const voos = out.filter(o => o.eqType === tipo && !soParafuso.includes(o.r) && !preso(o));
    // Os voos fixos (escala aprovada) ficam no avião deles e ocupam o horário (o atrasado, o horário novo); o cancelado
    // não ocupa nada
    const fixosDoTipo = out.filter(o => o.eqType === tipo && preso(o) && statusDoVoo(o, state.fStatus) !== 'Cancelado')
      .map(o => { const e = intervaloEfetivo(o, statusDoVoo(o, state.fStatus), (state.fObs || {})[o.fKey]); const [a, b] = ocupacaoDoVoo(o, e.a, e.b); return { ...o, a, b }; });
    const matriculas = matriculasDoTipo(frota, tipo).filter(r => state.av[r]).sort((a, b) => posicao(a) - posicao(b));
    const nova = redistribuirTipo(voos, matriculas, saldo, fixosDoTipo, serve);
    // A distribuição nova vale quando tem menos trocas de avião; com as mesmas trocas, menos aviões fora do hangar e,
    // com os mesmos aviões, menos tempo parado
    const pontos = matricula => [trocasDeAviao(voos, matricula), new Set(voos.map(matricula)).size, paradoDosAvioes(voos, matricula)];
    const [novos, atuais] = nova && voos.length ? [pontos(o => nova.get(o)), pontos(o => o.r)] : [null, null];
    if (novos && (novos[0] - atuais[0] || novos[1] - atuais[1] || novos[2] - atuais[2]) < 0) voos.forEach(o => { o.r = nova.get(o); });

    // Cada mudança tira uma troca do dia, então a repetição termina; uma mudança pode liberar outra
    const horasDe = lista => lista.reduce((total, o) => total + o.h, 0);
    const livreEmTodos = (r, meus) => meus.every(f => serve(r, f) && ![...voos, ...fixosDoTipo].some(o => !meus.includes(o) && o.r === r && sobrepoe(o.a, o.b, f.a, f.b))) &&
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

// A duração (em minutos) do voo de um pedido: o Ground tem 01h30; o voo, as horas do pedido
const duracaoDoPedido = (d, ground) => (ground ? GROUND_DURATION_MIN : Math.round((duracaoFixaDaMissao(d.mis) || duracaoValida(d.nb)) * 60));

// Comparação de chaves de ordenação: a primeira posição diferente decide
const vemAntes = (a, b) => { const i = a.findIndex((v, k) => v !== b[k]); return i >= 0 && a[i] < b[i]; };

// Avisos dos limites da lei: com a escala do dia, o instrutor chega a 90% das horas de voo do mês, do semestre ou do ano
function avisosDeLimite(out, state, limites, historico) {
  const horasHoje = {};
  // O voo cancelado não voa
  umPorUnidade(out.filter(o => o.status !== 'Cancelado')).forEach(o => {
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
        avisos.push({ t: 'warn', s: x ? x.nm : `Instrutor ${id}`, m: `Limite da lei: com esta escala, ${numeroBr(total)} h de voo no ${periodo} (limite de ${limite} h).`, codigo: 'perto-do-limite', insId: +id });
      }
    }
  }
  return avisos;
}

// O tempo parado de um instrutor (minutos entre um compromisso e o seguinte), pelas unidades dele no dia
function paradoDasUnidades(unidades) {
  return soma(paradasEntre(unidades.map(u => [u.a, u.b])));
}

// Divisão igual das horas do dia: depois de montada a escala, voos e aulas passam do instrutor com mais
// horas para o com menos, enquanto todas as regras continuam valendo: a habilitação, a disponibilidade durante todo o
// voo, o horário livre, o bloqueio do aluno, o peso e o aluno não repetir o instrutor no dia. Os voos do rodízio
// (cheque, MLTE, noturno e C172) ficam com quem a fila escolheu, e o voo com o instrutor escolhido pelo operador (ou o
// do “Priorizar com” do aluno), com ele; a turma de Ground se move inteira e conta 1h30 uma vez. Cada troca diminui a soma dos quadrados das horas, então a repetição termina. O voo cancelado não conta nem
// ocupa o instrutor, o atrasado ocupa o horário novo, e o voo com status de andamento não muda de instrutor
function equalizarHoras(out, state, limites, historico) {
  const ativos = state.ins.filter(x => x.on);
  const alunos = new Map(state.stu.map(s => [s.id, s]));
  // O que a missão do curso dos pedidos da unidade exige do INVA (quem recebe a unidade também precisa ter)
  const exigeDa = exigeDosVoos(state.stu);
  const grupos = new Map();
  out.forEach(o => {
    const chave = unidadeDoVoo(o);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(o);
  });
  // A unidade cancelada (todos os alunos dela) fica de fora; o aluno cancelado de uma turma acompanha a turma
  const unidades = [...grupos.values()].filter(voos => voos.some(v => statusDoVoo(v, state.fStatus) !== 'Cancelado')).map(voos => {
    const v = voos.find(o => statusDoVoo(o, state.fStatus) !== 'Cancelado');
    return {
      voos, ...intervaloEfetivo(v, statusDoVoo(v, state.fStatus), (state.fObs || {})[v.fKey]), h: v.h, mis: v.mis, eqType: v.eqType, isGround: v.isGround,
      // O instrutor escolhido pelo operador (na Demanda ou na Escala) e o do “Priorizar com” do aluno não mudam
      presa: voos.some(o => o.fixo || o.insEscolhido || o.insPar || STATUS_EM_ANDAMENTO.includes(statusDoVoo(o, state.fStatus)))
    };
  });
  const instrutorDa = u => u.voos[0].insId;
  const daQuem = id => unidades.filter(u => instrutorDa(u) === id);

  // O receptor serve para a unidade (o combustível não piora e o peso dele precisa estar informado) e nenhum aluno
  // dela já voa com ele no dia
  const compromisso = u => compromissoDoVoo(u.voos[0], u.a, u.b);
  const podeReceber = (x, u) => {
    if (instrutorDa(u) === x.id) return false;
    const deles = daQuem(x.id);
    if (u.voos.some(v => deles.some(o => o.voos.some(w => w.stuId === v.stuId)))) return false;
    const [v] = u.voos;
    // O curso do aluno e o avião do voo (o noturno do PC exige IFR; o avião com habilitação própria, a dele)
    const recurso = u.isGround ? null : recursoDaFrota(Array.isArray(state.frota) ? state.frota : FROTA_INICIAL, v.r);
    return !problemasDoInstrutor(x, { mis: u.mis, tipo: u.isGround ? GROUND_EQ_TYPE : u.eqType, a: u.a, b: u.b, alunos: u.voos.map(o => alunos.get(o.stuId)), stuKg: v.stuKg, curso: (alunos.get(v.stuId) || {}).curso, recurso, exige: exigeDa(u.voos) },
      { compromissos: deles.map(compromisso), historico: historico(x.id), limites, peso: { reducaoMaxima: v.comb ? v.comb.reduzirGal : 0, exigirPesoDoInstrutor: true } }).length;
  };

  for (let rodada = 0; rodada < 1000; rodada++) {
    const horas = new Map(ativos.map(x => [x.id, 0]));
    unidades.forEach(u => horas.set(instrutorDa(u), (horas.get(instrutorDa(u)) || 0) + u.h));
    // Do instrutor com mais horas, entre as passagens válidas, a que deixa menos tempo parado no dia dos dois;
    // empatadas, para quem tem menos horas, menos habilitações e o menor id, e o voo mais cedo
    let troca = null;
    for (const doador of [...horas.keys()].sort((p, q) => horas.get(q) - horas.get(p) || p - q)) {
      const meus = daQuem(doador);
      for (const u of meus.filter(o => !categoriaDoRodizio(o.mis, o.eqType) && !o.presa)) {
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

// Por que os instrutores do “Priorizar com” do aluno não puderam: o que vale para todos eles (não vêm, sem a habilitação, em
// “Não escalar com”) ou a regra que mais barrou na busca só com eles (fc: as contagens da busca)
const MOTIVO_SEM_PAR = {
  disp: 'indisponível nos horários possíveis', busy: 'ocupado nos horários possíveis', bloq: 'em “Não escalar com”',
  limite: 'no limite da Lei do Aeronauta', peso: 'peso acima do limite do avião',
  aviaoProprio: 'sem a habilitação própria dos aviões livres'
};
function motivoSemPar(doPar, stu, d, tipo, fc) {
  if (doPar.every(x => !x.on)) return 'fora nesta data';
  const habilitado = x => podeFazer(x, d.mis, tipo, { curso: stu.curso, exige: d.exige });
  if (doPar.every(x => !x.on || !habilitado(x))) return 'sem a habilitação da missão';
  if (doPar.every(x => !x.on || !habilitado(x) || (stu.bl || []).includes(x.id))) return 'em “Não escalar com”';
  const contagens = Object.entries(fc || {}).filter(([k, n]) => n && Object.hasOwn(MOTIVO_SEM_PAR, k)).sort((a, b) => b[1] - a[1]);
  return contagens.length ? MOTIVO_SEM_PAR[contagens[0][0]] : 'sem horário possível com ele';
}

// opcoes.compactar: false monta a escala sem a compactação; opcoes.dividirHoras: false, sem a divisão igual das horas;
// opcoes.trocarMatriculas: false, sem a troca de matrículas para o instrutor ficar no mesmo avião (para comparar, medir
// e testar)
export function runAllocationEngine(state, opcoes = {}) {
  const used = {}, stuBusy = {}, stuLastPick = {}, load = {}, eu = {}, out = [], al = [];
  // A frota vem do cadastro; sem ela (estados de teste antigos), a frota inicial
  const frota = Array.isArray(state.frota) ? state.frota : FROTA_INICIAL;
  const soParafuso = matriculasDoTipo(frota, 'C152', { parafuso: true });
  const nomesSoParafuso = soParafuso.length ? soParafuso.join(' ou ') : 'marcada como “Só Parafuso”';
  // Os requisitos de um voo da escala (a missão, o tipo e o curso do aluno) e se um avião serve a ele, com o instrutor
  // dele (js/frota.js)
  const cursoDoAluno = new Map(state.stu.map(s => [s.id, s.curso]));
  const instrutorPorId = new Map(state.ins.map(x => [x.id, x]));
  const serveAoVoo = (r, o) => {
    const recurso = recursoDaFrota(frota, r), x = instrutorPorId.get(o.insId);
    return aviaoServe(recurso, { mis: o.mis, eq: o.eqType, curso: cursoDoAluno.get(o.stuId) }) && (!x || instrutorVoaNoAviao(x, recurso));
  };
  // Os horários de decolagem de cada categoria vêm do cadastro; sem eles, os iniciais
  const horarios = state.horarios || HORARIOS_INICIAIS;
  // A ordem dos aviões no hangar: da frente para o fundo; sem ela, a ordem da frota
  const hangar = normalizarHangar(state.hangar, frota);
  const posicao = r => posicaoNoHangar(hangar, r);
  // Limites da Lei do Aeronauta: as horas de voo de antes de hoje e o fim de ontem de cada instrutor, e os
  // compromissos de hoje (voo em avião conta como voo; simulador e Ground, só na jornada)
  const limites = normalizarLimites(state.limites);
  // (quem volta hoje do noturno de ontem fica sem o fimAnterior: o repouso dele é um aviso, js/noturno.js)
  const historico = historicoDoDia(state);
  const compromissos = {};
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
   * 2º: O pedido com o instrutor escolhido pelo operador para o dia antes dos outros: o que o operador definiu para o
   *     dia vale primeiro, e o pedido com um instrutor só é o que tem menos opções (os outros se encaixam em volta dele).
   * 3º: Maior prioridade (5 a 1).
   * 4º: Com a mesma prioridade, o do aluno com “Priorizar com” (o par permanente do cadastro) antes: ele tem menos
   *     instrutores possíveis. O “Priorizar com” vale todos os dias, então não passa na frente da prioridade.
   * 5º: A ordem dos agendamentos: o pedido da agenda que foi registrado antes (o id do
   *     pedido cresce com o registro) vem antes; o pedido posto à mão, sem a agenda, vem depois dos agendados.
   * 6º: Ordem de cadastro do aluno e ordem da missão.
   */
  const ordemDoAgendamento = item => (Number.isInteger(item.ref.solicitacao) ? item.ref.solicitacao : Infinity);
  // O instrutor que saiu do cadastro não conta como escolha (o pedido volta para o Automático, com aviso)
  const noCadastro = new Set(state.ins.map(x => x.id));
  const semEscolha = item => (item.ref.insId && noCadastro.has(item.ref.insId) ? 0 : 1);
  const semVoaCom = item => ((item.stu.voaCom || []).length ? 0 : 1);
  act.sort((a, b) => {
    const gA = isGroundMission(a.ref.mis) ? 1 : 0;
    const gB = isGroundMission(b.ref.mis) ? 1 : 0;
    if (gA !== gB) return gB - gA;
    return semEscolha(a) - semEscolha(b) || b.ref.pr - a.ref.pr || semVoaCom(a) - semVoaCom(b) || menorPrimeiro(ordemDoAgendamento(a), ordemDoAgendamento(b)) || a.stuOrder - b.stuOrder || a.misOrder - b.misOrder;
  });

  const free = (mp, id, s, e) => livre(mp[id], s, e);
  // Até quando a missão do aluno pode ir. O Noturno só sai às 17:30: o aluno que tem um no dia termina as outras
  // missões (o simulador e a aula, que podem passar das 17:30) antes dele. A compactação e as Sugestões usam a mesma regra
  const fimDoAluno = fimDasMissoesDoDia(state.stu);
  // Rodízio: a fila de cada categoria (cheque, MLTE, noturno e C172) e os voos dela que cada instrutor já recebeu hoje
  const filas = ajustarFilas(state.filas, state.ins);
  const voosNaCategoria = {};

  // Revisão de 50 horas: horas que o avião ainda pode voar hoje
  const horas = state.horas || {};
  const saldo = r => saldoAteARevisao(horas, r);

  // Escala aprovada: os voos fixos entram primeiro, no mesmo horário, avião e instrutor; o resto é encaixado
  // em volta. O fixo que ficou impossível continua onde está, em conflito (com o motivo); o cancelado não ocupa nada
  const fixos = state.fixos && typeof state.fixos === 'object' ? state.fixos : {};
  // O voo fixo de um pedido (a chave aluno_missão_1), ou null
  const chaveFixa = item => {
    const fKey = chaveDoVoo(item.stuId, item.mid);
    return Object.hasOwn(fixos, fKey) ? fKey : null;
  };
  const ocupacoesDeAtraso = [];
  // Os voos que ficaram sem o instrutor do “Priorizar com” do aluno (fKey → o aviso, que sai no fim)
  const semPar = new Map();
  // Os voos locais (Voo Local, Voo Solo e TGL) que saem em cada horário, sem os confirmados: o 7º voo local confirmado na
  // Agenda (limiteConfirmado, Q8) passa do limite no minuto exato do pedido (jan), fixo ou não, e não conta aqui, então
  // não toma lugar dos outros, onde quer que caia na fila (no máximo 6 sem os confirmados, mais os confirmados)
  const locaisNoHorario = {};

  // A volta do noturno de ontem (state.noturnosDaVespera, lido da escala gravada da véspera): o translado de BH decola às
  // 07:30 e pousa às 08:30. O instrutor, o aluno e o avião passaram a noite em BH e só ficam livres às 10:10. Entra como um
  // voo fixo (o trecho "volta", sessão 2/2 do pedido de ontem) de 07:30–08:30 com livreAs 10:10: ocupa a manhã até as
  // 10:10 (ocupacaoDoVoo) e conta 1 h de voo para a lei e a revisão. Cancelado (o mau tempo em BH), não ocupa nada
  for (const [i, n] of (Array.isArray(state.noturnosDaVespera) ? state.noturnosDaVespera : []).entries()) {
    const fKey = `${n.stuId}_${n.mid}_2`;
    const status = statusDoVoo({ fKey }, state.fStatus);
    const x = instrutorPorId.get(n.insId) || null;
    const stu = state.stu.find(s => s.id === n.stuId) || null;
    const a = NOTURNO.voltaInicio, b = a + NOTURNO.trechos.volta.minutos, livreAs = NOTURNO.livreAs, h = (b - a) / 60;
    const linha = { trecho: 'volta', a, b, livreAs, eqType: n.eqType };
    if (status !== 'Cancelado') {
      // A volta atrasada ocupa até o pouso novo, se for depois das 10:10, e a lei conta o voo no horário novo
      const efetivo = intervaloEfetivo(linha, status, (state.fObs || {})[fKey]);
      (used[n.r] ||= []).push(ocupacaoDoVoo(linha, efetivo.a, efetivo.b));
      (stuBusy[n.stuId] ||= []).push(ocupacaoDoVoo(linha, efetivo.a, efetivo.b));
      if (x) (compromissos[x.id] ||= []).push(compromissoDoVoo(linha, efetivo.a, efetivo.b));
      eu[n.r] = (eu[n.r] || 0) + h;
      if (x) load[x.id] = (load[x.id] || 0) + h;
    }
    const stuKg = (stu && stu.kg) || n.stuKg || 0, insKg = (x && x.kg) || 0;
    out.push({
      fKey, classKey: fKey, isGround: false, w: periodoDoMinuto(a), a, b, o: stu ? state.stu.indexOf(stu) : state.stu.length + i,
      stuId: n.stuId, mid: n.mid, insId: n.insId, eqType: n.eqType, s: stu ? stu.nm : n.s, mis: 'Noturno', h, ss: '2/2',
      r: n.r, ins: x ? x.nm : n.ins, stuKg, insKg, limKg: DEFAULT_LIM[n.eqType] || 0, kg: stuKg && insKg ? stuKg + insKg : 0,
      baseTag: 'Pref. 1', tag: 'Pref. 1', status, fixo: true, trecho: 'volta', livreAs
    });
  }

  // Os voos agendados na Escala entram depois dos outros fixos (pelo status, pela escala aprovada e pelo instrutor
  // escolhido na Escala), cada grupo na ordem dos pedidos: o que o agendado gasta (o avião ou a sala, o instrutor, o
  // aluno, o saldo até a revisão, a lei, os voos locais do horário e o rodízio) é conferido contra os outros fixos, e o
  // conflito fica nele, nunca no voo que já estava fixo
  const agendado = item => Boolean(fixos[chaveFixa(item)].agendado);
  const comPino = act.filter(chaveFixa);
  // O agendado pode estar fora de regras que o motor segue sozinho e não confere nos fixos (o operador confirmou ao
  // agendar): cada uma vira um aviso, com a chave do voo, depois dos fixos. Não avisam o voo cancelado, o em andamento
  // (ele já saiu) e o que mudou de tipo (o conflito dele já diz)
  const avisosDosAgendados = [];
  const agendadosComAviso = new Set();
  for (const item of [...comPino.filter(i => !agendado(i)), ...comPino.filter(agendado)]) {
    const fKey = chaveFixa(item);
    const pino = fixos[fKey];
    const { stu, stuId, mid, ref: d, stuOrder } = item;
    const rotulo = mid ? `${stu.nm} (${d.mis})` : stu.nm;
    const ground = isGroundMission(d.mis);
    const { a, b, r, insId } = pino;
    const classKey = ground ? pino.classKey || fKey : fKey;
    const x = state.ins.find(i => i.id === insId);
    const status = statusDoVoo({ fKey }, state.fStatus);
    const efetivo = intervaloEfetivo({ a, b }, status, (state.fObs || {})[fKey]);
    const tipo = ground ? GROUND_EQ_TYPE : d.eq;
    const lim = ground ? 0 : DEFAULT_LIM[d.eq] || 0;
    // A turma ocupa a sala e o instrutor pelo primeiro aluno dela que não foi cancelado
    const daMesmaTurma = ground && out.some(o => o.classKey === classKey && o.stuId !== stuId && o.status !== 'Cancelado');
    // Conferido de novo com as regras do motor: cada conflito com o texto e o código
    const conflito = [], conflitoCodigos = [];
    const marcar = (codigo, texto) => { conflito.push(texto); conflitoCodigos.push(codigo); };
    // Pedido que passou de voo para Ground (ou o contrário): o pino é de outro tipo de recurso
    const mudouDeTipo = ground !== (r === GROUND_REG);
    if (status !== 'Cancelado') {
      // O aluno que entra na turma do instrutor não muda a ocupação dele nem a lei
      const recursoDoPino = ground || mudouDeTipo ? null : recursoDaFrota(frota, r);
      problemasDoInstrutor(x, { mis: d.mis, tipo, a, b, efetivo, alunos: [stu], stuKg: stu.kg, curso: stu.curso, recurso: recursoDoPino, exige: d.exige }, {
        compromissos: (x && compromissos[x.id]) || [], historico: x ? historico(x.id) : null, limites, jaOcupa: daMesmaTurma,
        peso: ground || mudouDeTipo ? null : {}, todos: true
      }).forEach(p => marcar(p.codigo, TEXTO_DO_PROBLEMA[p.codigo](p)));
      if (mudouDeTipo) marcar('ground-ou-voo', ground ? 'o pedido passou de voo para Ground' : 'o pedido passou de Ground para voo');
      else if (!ground) {
        const recurso = frota.find(f => f.reg === r);
        if (!recurso || recurso.tipo !== d.eq) marcar('tipo-de-aviao', 'a missão ou o avião do pedido mudou');
        else if (!state.av[r]) marcar('aviao-indisponivel', 'o avião está indisponível');
        if (!free(used, r, a, b)) marcar('aviao-ocupado', 'o avião já está ocupado neste horário');
        // Os atributos do avião: o "Só Parafuso" e o "Só VFR" (o voo IFR só no avião homologado IFR)
        const motivo = recurso && recurso.tipo === d.eq ? motivoDoAviao(recurso, { mis: d.mis, eq: d.eq, curso: stu.curso }) : null;
        if (motivo === 'so-parafuso') marcar('so-parafuso', d.mis === 'Parafuso' ? `o Parafuso só voa no ${nomesSoParafuso}` : `o ${r} é só para o Parafuso`);
        if (motivo === 'so-vfr') marcar('so-vfr', `o ${r} não é homologado IFR, e o voo é IFR`);
        if (!cabeNoSaldo(eu[r] || 0, (b - a) / 60, saldo(r))) marcar('revisao', 'o avião passaria da revisão de 50 horas');
      } else if (!daMesmaTurma && !free(used, GROUND_REG, a, b)) marcar('sala-ocupada', 'a sala de Ground já está ocupada neste horário');
      if (!free(stuBusy, stuId, a, b)) marcar('aluno-ocupado', 'o aluno já tem outro voo neste horário');
      if (!state.win[periodoDoMinuto(a)]) marcar('horario-fechado', 'o horário está fechado nesta data');
      const permitidas = disponibilidadeDoAluno(d.jan);
      if (permitidas && !permitidas(a)) marcar('disponibilidade', 'o horário está fora da disponibilidade do aluno');
      if (!mudouDeTipo && b - a !== duracaoDoPedido(d, ground)) marcar('duracao', 'a duração do pedido mudou');
      if (pino.agendado && !STATUS_EM_ANDAMENTO.includes(status) && !mudouDeTipo) {
        agendadosComAviso.add(fKey);
        const avisar = (codigo, m) => avisosDosAgendados.push({ t: 'warn', s: rotulo, fKey, m, codigo, stuId });
        // Os horários de decolagem da missão (o Ground, nas janelas do dia; o Noturno, às 17:30; o Voo Solo, às 06:30)
        const lista = ground ? DAY.map(w => T[w]) : horariosDaMissao(horarios, d.mis, d.eq);
        if (!lista.includes(a)) {
          avisar('fora-dos-horarios', ground ? `Agendado às ${hm(a)}, fora dos horários das aulas de Ground.`
            : d.mis === 'Noturno' || d.mis === 'Voo Solo' ? `Agendado às ${hm(a)}: o ${d.mis} sai às ${hm(lista[0])}.`
              : `Agendado às ${hm(a)}, fora dos horários de decolagem do ${d.eq}.`);
        }
        // Até quando a missão pode ir: o voo de dia no avião pousa até as 17:30; com o Noturno no dia, o aluno termina as
        // outras missões antes dele
        const fim = fimDoAluno(stuId, d.mis, tipo);
        if (b > fim) {
          avisar('depois-das-17h30', AIRCRAFT_EQ_TYPES.includes(tipo) ? `Agendado até as ${hm(b)}: o voo de dia pousa até as ${hm(fim)}.`
            : `Agendado até as ${hm(b)}: com o Noturno no dia, o aluno termina as outras missões até as ${hm(fim)}.`);
        }
        // No máximo 6 voos locais saindo no mesmo horário: conferido antes de contar este (o confirmado avisa depois da fila)
        const locais = locaisNoHorario[efetivo.a] || 0;
        if (!ground && MISSOES_LOCAIS.includes(d.mis) && minutoConfirmado(d) !== efetivo.a && locais >= LIMITE_DE_VOOS_LOCAIS) {
          avisar('limite-de-locais', `Agendado às ${hm(a)} como o ${locais + 1}º voo local do horário: no máximo ${LIMITE_DE_VOOS_LOCAIS} voos locais saem no mesmo horário.`);
        }
        // O peso que falta, como no voo escalado pelo motor (os outros voos fixos não avisam)
        if (lim && x && (!stu.kg || !x.kg)) {
          const quem = !stu.kg && !x.kg ? `Pesos do aluno e de ${x.nm} não informados` : !stu.kg ? 'Peso do aluno não informado' : `Peso de ${x.nm} não informado`;
          avisosDosAgendados.push({ t: 'warn', s: rotulo, fKey, m: `${quem} (0 kg): verificação de limite (${lim} kg) no ${d.eq} não realizada.`, codigo: 'sem-peso', ...(stu.kg ? {} : { stuId }), ...(x.kg ? {} : { insId: x.id }) });
        }
      }
      // Ocupa o avião (ou a sala), o instrutor e o aluno; a turma ocupa a sala e o instrutor uma vez só. O voo atrasado
      // ocupa o horário novo, depois de conferidos os outros fixos: o atraso que invade outro voo
      // fixo é um aviso de atraso, não um conflito dele
      const h = ground ? GROUND_DURATION_H : (b - a) / 60;
      const ocupar = ({ a: ia, b: ib }) => {
        if (!daMesmaTurma) {
          (used[ground ? GROUND_REG : r] = used[ground ? GROUND_REG : r] || []).push([ia, ib]);
          if (x) {
            (compromissos[x.id] ||= []).push({ a: ia, b: ib, voo: AIRCRAFT_EQ_TYPES.includes(tipo) });
          }
        }
        (stuBusy[stuId] = stuBusy[stuId] || []).push([ia, ib]);
      };
      if (efetivo.a === a) ocupar(efetivo);
      else ocupacoesDeAtraso.push(() => ocupar(efetivo));
      // O confirmado só não conta no minuto confirmado: atrasado para outro horário, ele conta lá como os outros
      if (!ground && MISSOES_LOCAIS.includes(d.mis) && minutoConfirmado(d) !== efetivo.a) locaisNoHorario[efetivo.a] = (locaisNoHorario[efetivo.a] || 0) + 1;
      if (!daMesmaTurma) {
        if (x) load[x.id] = (load[x.id] || 0) + h;
        eu[ground ? GROUND_REG : r] = (eu[ground ? GROUND_REG : r] || 0) + h;
      }
      if (x && !ground) {
        const avioes = (insAircraft[x.id] = insAircraft[x.id] || []);
        if (!avioes.includes(r)) avioes.push(r);
        stuLastPick[stuId] = { r, x };
        const categoria = categoriaDoRodizio(d.mis, d.eq);
        if (categoria) voosNaCategoria[`${categoria}:${x.id}`] = (voosNaCategoria[`${categoria}:${x.id}`] || 0) + 1;
      }
      if (ground) {
        // A turma fixa fica aberta: um aluno novo do mesmo Ground pode entrar nela, se ela não está em conflito (sem o
        // instrutor, por exemplo)
        const turmas = (openGroundClasses[d.mis] = openGroundClasses[d.mis] || []);
        if (x && !daMesmaTurma && !conflito.length && !turmas.some(c => c.classKey === classKey)) turmas.push({ classKey, mis: d.mis, w: T.indexOf(a), a, b, x, count: 0 });
        const turma = turmas.find(c => c.classKey === classKey);
        if (turma) turma.count++;
        const gRec = (stuGroundStatus[stuId] || []).find(g => g.mis === d.mis && g.allocatedEnd === null);
        if (gRec) gRec.allocatedEnd = b;
      }
    }
    const pf = [minutoDaPreferencia(d.p1), minutoDaPreferencia(d.p2)];
    const baseTag = a === pf[0] ? 'Pref. 1' : a === pf[1] ? 'Pref. 2' : 'Próximo livre';
    out.push({
      fKey, classKey, isGround: ground,
      w: ground && T.indexOf(a) >= 0 ? T.indexOf(a) : periodoDoMinuto(a), a, b,
      o: stuOrder, stuId, mid, insId, eqType: tipo,
      s: stu.nm, mis: d.mis, h: ground ? GROUND_DURATION_H : (b - a) / 60, ss: '1/1',
      ...(d.etapa ? { etapa: d.etapa } : {}),
      r: ground ? GROUND_REG : r, ins: x ? x.nm : 'Instrutor fora do cadastro',
      stuKg: stu.kg || 0, insKg: (x && x.kg) || 0, limKg: lim, kg: stu.kg && x && x.kg ? stu.kg + x.kg : 0,
      ...(ground || !x ? {} : combustivelDoVoo(stu.kg, x.kg, d.eq, b - a, d.mis)),
      baseTag, tag: baseTag, status, fixo: true,
      ...(x && d.insId === x.id ? { insEscolhido: true } : {}),
      // O voo agendado na Escala: a linha leva a marca do pino (a aprovação e a escala gravada a guardam)
      ...(pino.agendado ? { agendado: true } : {}),
      ...(conflito.length ? { conflito, conflitoCodigos } : {})
    });
    if (conflito.length) al.push({ t: 'conf', s: rotulo, fKey, m: `${pino.agendado ? 'Conflito no voo agendado' : 'Conflito na escala aprovada'}: ${conflito.join('; ')}.` });
  }

  ocupacoesDeAtraso.forEach(ocupar => ocupar());
  // O Ground antes do voo, entre os fixos (o motor só confere a ordem quando escala um dos dois): o agendado que começa
  // antes do fim do Ground fixo de que depende, ou o Ground agendado que termina depois do início de um voo fixo que
  // depende dele. A volta do noturno de ontem não depende do Ground de hoje
  const fixoAtivo = o => o.fixo && !o.trecho && o.status !== 'Cancelado';
  for (const o of out.filter(v => agendadosComAviso.has(v.fKey))) {
    const doAluno = out.filter(v => v !== o && v.stuId === o.stuId && fixoAtivo(v));
    const avisar = m => avisosDosAgendados.push({ t: 'warn', s: o.mid ? `${o.s} (${o.mis})` : o.s, fKey: o.fKey, m, codigo: 'antes-do-ground', stuId: o.stuId });
    if (o.isGround) {
      const voos = doAluno.filter(v => !v.isGround && doesGroundGateFlight(o.mis, { mis: v.mis, eq: v.eqType }) && v.a < o.b);
      const voo = voos.reduce((p, v) => (!p || v.a < p.a ? v : p), null);
      if (voo) avisar(`Agendado até as ${hm(o.b)}, depois do início do ${voo.mis} do aluno (${hm(voo.a)}): o Ground vem antes do voo.`);
    } else {
      const grounds = doAluno.filter(v => v.isGround && doesGroundGateFlight(v.mis, { mis: o.mis, eq: o.eqType }) && v.b > o.a);
      const aula = grounds.reduce((p, v) => (!p || v.b > p.b ? v : p), null);
      if (aula) avisar(`Agendado às ${hm(o.a)}, antes do fim do ${aula.mis} do aluno (${hm(aula.b)}): o Ground vem antes do voo.`);
    }
  }
  al.push(...avisosDosAgendados);

  for (const item of act) {
    if (chaveFixa(item)) continue;
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

    // O instrutor escolhido pelo operador para o pedido: o motor procura o horário e o avião só com ele. O que impede o
    // voo em qualquer horário (fora do dia, sem a habilitação, em "Não escalar com") recusa logo. O escolhido que saiu
    // do cadastro (excluído depois de escolhido, numa data que não estava aberta) não vale mais: a exclusão também é do
    // operador, e o pedido volta para o Automático (com o “Priorizar com” do aluno), com o aviso no fim
    const escolhido = d.insId ? state.ins.find(x => x.id === d.insId) || null : null;
    const tipoDoPedido = isGnd ? GROUND_EQ_TYPE : d.eq;
    const quem = escolhido ? `o instrutor escolhido (${escolhido.nm})` : '';
    const impedimento = !escolhido ? null
      : !escolhido.on ? `${quem} não está disponível nesta data`
        : !podeFazer(escolhido, d.mis, tipoDoPedido, { curso: stu.curso, exige: d.exige }) ? `${quem} não tem a habilitação de ${d.mis}${isGnd ? '' : ` no ${d.eq}`} (${descreverExigencias(d.mis, tipoDoPedido, { curso: stu.curso, exige: d.exige })})`
          : (stu.bl || []).includes(escolhido.id) ? `${quem} está em “Não escalar com” deste aluno` : null;
    if (impedimento) {
      al.push({ t: 'err', s: labelStu, m: `Rejeitado: ${impedimento}.`, codigo: 'instrutor-escolhido' });
      continue;
    }
    // As passadas da busca do instrutor: só o escolhido; ou primeiro os do “Priorizar com” do aluno (o par permanente, do
    // cadastro) em todos os horários e, sem nenhum deles, todos os instrutores, com o aviso; ou todos
    const doPar = escolhido ? [] : (stu.voaCom || []).map(id => state.ins.find(x => x.id === id)).filter(Boolean);
    const passadas = escolhido ? [{ pool: [escolhido], marca: { insEscolhido: true } }]
      : doPar.length ? [{ pool: doPar, marca: { insPar: true } }, { pool: state.ins, marca: {}, semPar: true }]
        : [{ pool: state.ins, marca: {} }];
    // O voo que ficou sem o instrutor do “Priorizar com”: o motivo vem da passada só com eles (fc: as contagens dela). O aviso
    // sai no fim, com o instrutor que ficou com o voo depois da divisão das horas e da compactação
    const anotarSemPar = fc => semPar.set(chaveDoVoo(stuId, mid), { s: labelStu, nomes: doPar.map(i => i.nm).join(', '), motivo: motivoSemPar(doPar, stu, d, tipoDoPedido, fc), pares: doPar.map(i => i.id) });

    // ========================================================================
    // RAMO A: ALOCAÇÃO DE GROUND SCHOOL (01h30 = 90 MIN · TURMA COLETIVA)
    // ========================================================================
    if (isGnd) {
      // A missão do curso do pedido pode exigir mais do INVA (exige): a turma aberta também precisa servir a ele
      const habilitado = x => podeFazer(x, d.mis, GROUND_EQ_TYPE, { exige: d.exige });
      const exigeMais = Array.isArray(d.exige) && d.exige.length > 0;
      const durMin = GROUND_DURATION_MIN; // 90 min (1.5 h)
      const endMax = fimDoAluno(stuId, d.mis, GROUND_EQ_TYPE);
      const starts = DAY.filter(w => state.win[w] && T[w] + durMin <= endMax && naDisponibilidade(T[w]));

      // Se o aluno também tem um voo dependente hoje com horário preferido, prioriza janelas que terminem antes do voo
      const dependentFlights = act.filter(other => other.stuId === stuId && doesGroundGateFlight(d.mis, other.ref));
      // O voo dependente que já está fixo é um prazo: o Ground termina antes dele
      const prazoFixo = Math.min(Infinity, ...out.filter(o => o.stuId === stuId && o.fixo && !o.isGround && !o.trecho && o.status !== 'Cancelado'
        && doesGroundGateFlight(d.mis, { mis: o.mis, eq: o.eqType })).map(o => o.a));
      const earliestFlightPrefMin = Math.min(prazoFixo, dependentFlights.reduce((minT, flt) => {
        const fp1 = minutoDaPreferencia(flt.ref.p1);
        return (fp1 >= 0 && fp1 < minT) ? fp1 : minT;
      }, Infinity));

      // A 1ª e a 2ª preferência, depois os outros horários pela distância da 1ª
      const semPrazo = ordenarPelaPreferencia(starts.map(w => T[w]), preferidos[0], preferidos[1]).map(m => T.indexOf(m));
      const candidateWins = semPrazo.filter(w => T[w] + durMin <= prazoFixo);
      // Prioriza janelas que terminam antes do voo preferido do aluno, mantendo a cascata Pref.1 -> Pref.2 -> Próximo livre
      candidateWins.sort((w1, w2) => {
        const ok1 = T[w1] + durMin <= earliestFlightPrefMin ? 0 : 1;
        const ok2 = T[w2] + durMin <= earliestFlightPrefMin ? 0 : 1;
        return ok1 - ok2;
      });

      const existingClasses = openGroundClasses[d.mis] || [];
      let chosenClass = null, fcGnd, fcDoPar = null, passadaUsada = null;
      for (const passada of passadas) {
        const naPassada = x => passada.pool.includes(x);

        // 1ª Tentativa: Unir-se a uma turma já aberta da mesma temática de Ground (mesmo horário e mesmo instrutor)
        // A turma da 1ª preferência, depois a da 2ª, depois as outras (pelo horário: a turma fixa fora das janelas do dia
        // não tem janela, e não vale como a preferência que o aluno não tem)
        const ordemDaPreferencia = c => { const i = preferidos.indexOf(c.a); return i < 0 ? 2 : i; };
        const orderedExisting = [...existingClasses].filter(c => c.b <= prazoFixo && c.b <= endMax).sort((c1, c2) => {
          const inPref1 = ordemDaPreferencia(c1);
          const inPref2 = ordemDaPreferencia(c2);
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
          if (!naPassada(cls.x)) continue;
          if (exigeMais && !habilitado(cls.x)) continue;
          if (cls.b > earliestFlightPrefMin && candidateWins.some(w => T[w] + durMin <= earliestFlightPrefMin)) continue;
          chosenClass = cls;
          break;
        }

        // 2ª Tentativa: Abrir nova turma de Ground se não pôde ingressar em turma existente
        fcGnd = { stu_busy: 0, sala: 0, disp: 0, busy: 0, bloq: 0, limite: 0 };
        if (!chosenClass) {
          // Verifica restrições de bloqueio de todos os alunos da mesma turma potencial para escolher um instrutor comum
          const cohortBlocked = new Set(stu.bl);
          act.forEach(other => {
            if (other.ref.mis === d.mis) other.stu.bl.forEach(bId => cohortBlocked.add(bId));
          });

          for (const w of candidateWins) {
            const a = T[w], b = a + durMin;
            if (!free(stuBusy, stuId, a, b)) { fcGnd.stu_busy++; continue; }

            const sameWinCls = existingClasses.find(c => c.w === w && !stu.bl.includes(c.x.id) && naPassada(c.x) && (!exigeMais || habilitado(c.x)));
            if (sameWinCls) {
              chosenClass = sameWinCls;
              break;
            }

            // Há uma única sala de Ground: só abre turma nova com a sala livre durante toda a 01h30
            if (!free(used, GROUND_REG, a, b)) { fcGnd.sala++; continue; }

            const { servem: f2, barrou } = instrutoresQueServem(passada.pool, x => problemasDoInstrutor(x, { mis: d.mis, tipo: GROUND_EQ_TYPE, a, b, alunos: [stu], exige: d.exige },
              { compromissos: compromissos[x.id] || [], historico: historico(x.id), limites }));
            if (barrou) { fcGnd[barrou]++; continue; }

            // Ordena instrutores priorizando: não bloqueado pela turma -> MENOS HABILITAÇÕES -> menor carga no dia
            f2.sort((x1, x2) =>
              (cohortBlocked.has(x1.id) - cohortBlocked.has(x2.id)) ||
              (qtdHabilitacoes(x1) - qtdHabilitacoes(x2)) ||
              ((load[x1.id] || 0) - (load[x2.id] || 0))
            );

            const pickedIns = f2[0];
            // A chave da turma não repete a de outra (uma turma fixa passada para outro horário guarda a chave de antes)
            const usadas = new Set([...out.map(o => o.classKey), ...Object.values(fixos).map(p => p.classKey).filter(Boolean)]);
            const base = `GND_${d.mis}_${w}_${pickedIns.id}`;
            let classKey = base;
            for (let n = 2; usadas.has(classKey); n++) classKey = `${base}_${n}`;
            chosenClass = { classKey, mis: d.mis, w, a, b, x: pickedIns, count: 0 };
            (openGroundClasses[d.mis] = openGroundClasses[d.mis] || []).push(chosenClass);

            // Marca o instrutor e a sala ocupados neste intervalo (outros alunos do MESMO Ground entram via chosenClass)
            (compromissos[pickedIns.id] ||= []).push({ a, b, voo: false });
            (used[GROUND_REG] = used[GROUND_REG] || []).push([a, b]);
            load[pickedIns.id] = (load[pickedIns.id] || 0) + GROUND_DURATION_H;
            eu[GROUND_REG] = (eu[GROUND_REG] || 0) + GROUND_DURATION_H;
            break;
          }
        }
        if (chosenClass) { passadaUsada = passada; break; }
        if (!passada.semPar) fcDoPar = fcGnd;
      }

      if (chosenClass) {
        chosenClass.count++;
        (stuBusy[stuId] = stuBusy[stuId] || []).push([chosenClass.a, chosenClass.b]);

        // Registra que o aluno concluiu este Ground às chosenClass.b (liberando voos a partir de chosenClass.b)
        const stGnds = stuGroundStatus[stuId] || [];
        const gRec = stGnds.find(g => g.mis === d.mis && g.allocatedEnd === null) || stGnds.find(g => g.mis === d.mis);
        if (gRec) gRec.allocatedEnd = chosenClass.b;

        const fKey = chaveDoVoo(stuId, mid);
        const baseTag = chosenClass.a === preferidos[0] ? 'Pref. 1' : chosenClass.a === preferidos[1] ? 'Pref. 2' : 'Próximo livre';

        out.push({
          fKey,
          classKey: chosenClass.classKey,
          isGround: true,
          // A turma fixa fora das janelas do dia (T.indexOf do horário dela é -1) fica no período em que começa
          w: chosenClass.w >= 0 ? chosenClass.w : periodoDoMinuto(chosenClass.a), a: chosenClass.a, b: chosenClass.b,
          o: stuOrder,
          stuId,
          mid,
          insId: chosenClass.x.id,
          eqType: GROUND_EQ_TYPE,
          s: nm, mis: d.mis, h: GROUND_DURATION_H, ss: '1/1',
          // A missão do curso
          ...(d.etapa ? { etapa: d.etapa } : {}),
          r: GROUND_REG, ins: chosenClass.x.nm,
          stuKg: stu.kg || 0,
          insKg: chosenClass.x.kg || 0,
          limKg: 0,
          kg: 0,
          baseTag,
          tag: baseTag,
          status: statusDoVoo({ fKey }, state.fStatus),
          ...passadaUsada.marca
        });
        if (passadaUsada.semPar) anotarSemPar(fcDoPar);
      } else {
        // O motivo, com o código que diz onde resolver
        let codigo, why;
        if (!state.ins.some(x => x.on && habilitado(x))) {
          [codigo, why] = ['sem-instrutor-habilitado', `nenhum instrutor ativo tem a habilitação de ${d.mis} (${descreverExigencias(d.mis, GROUND_EQ_TYPE, { exige: d.exige })})`];
        } else if (semPrazo.length && !candidateWins.length) {
          [codigo, why] = ['ground-antes-do-voo-fixo', `o Ground precisa terminar antes do voo fixo das ${hm(prazoFixo)}, e não há horário para ele antes disso`];
        } else if (!starts.length) {
          [codigo, why] = permitidas
            ? ['disponibilidade-do-aluno', `nenhum horário aberto na disponibilidade do aluno (${rotuloDaDisponibilidade(d.jan)}) comporta 01h30 de Ground`]
            : ['sem-horario', `nenhum período aberto comporta 01h30 de Ground${endMax < MINUTOS_DO_DIA ? ` até as ${hm(endMax)}` : ''}`];
        } else {
          const key = Object.keys(fcGnd).sort((a, b) => fcGnd[b] - fcGnd[a])[0];
          [codigo, why] = {
            stu_busy: ['aluno-ocupado', 'o aluno já tem outra missão nos horários possíveis'],
            sala: ['sala-ocupada', 'a sala de Ground já está ocupada por outra turma nos horários possíveis'],
            disp: ['instrutores-indisponiveis', escolhido ? `${quem} não está disponível durante as 01h30 nos horários possíveis` : 'nenhum instrutor habilitado está disponível durante as 01h30 nos horários possíveis'],
            busy: ['instrutores-ocupados', escolhido ? `${quem} já tem outro compromisso nos horários possíveis` : 'os instrutores habilitados já têm outro compromisso nos horários possíveis'],
            bloq: ['bloqueio', 'os instrutores habilitados e livres estão em “Não escalar com” deste aluno'],
            limite: ['limite-da-lei', escolhido ? `${quem} passaria dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários possíveis` : 'nenhum instrutor dentro dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários possíveis']
          }[key];
        }
        al.push({ t: 'err', s: labelStu, m: `Rejeitado: ${why}.`, codigo });
      }
      continue;
    }

    // ========================================================================
    // RAMO B: ALOCAÇÃO DE MISSÕES DE VOO E SIMULADOR
    // ========================================================================
    const lim = DEFAULT_LIM[d.eq] || 0;
    // Um voo por pedido, com as horas pedidas (para dividir no dia, "+ missão")
    const H = duracaoFixaDaMissao(d.mis) || duracaoValida(d.nb);
    const night = d.mis === 'Noturno';
    const isParafuso = d.mis === 'Parafuso';
    const local = MISSOES_LOCAIS.includes(d.mis);
    // O 7º voo local confirmado passa do limite só no minuto do pedido (Q8)
    const confirmadoEm = minutoConfirmado(d);
    const exige = descreverExigencias(d.mis, d.eq, { curso: stu.curso, exige: d.exige });
    // Voo de categoria do rodízio: primeiro quem ainda não voou nela hoje, depois a ordem da fila
    const categoria = categoriaDoRodizio(d.mis, d.eq);
    const voosHoje = x => (categoria ? voosNaCategoria[`${categoria}:${x.id}`] || 0 : 0);
    const naFila = x => { const i = categoria ? filas[categoria].indexOf(x.id) : 0; return i < 0 ? Number.MAX_SAFE_INTEGER : i; };

    // 1. Validação de equipamento permitido para a missão
    if (!m.eq.includes(d.eq)) {
      al.push({
        t: 'err',
        s: labelStu,
        m: `Rejeitado: a missão “${d.mis}” só voa em ${m.eq.join(' ou ')} (o pedido está no ${d.eq}).`,
        codigo: 'equipamento-da-missao'
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
        m: `Rejeitado: o “${unallocatedGround.mis}” de hoje, que vem antes deste voo, não entrou na escala.`,
        codigo: 'ground-pendente'
      });
      continue;
    }
    const minStartAfterGround = gatingGrounds.reduce((maxEnd, g) => Math.max(maxEnd, g.allocatedEnd || 0), 0);

    // Os horários de decolagem da categoria (o noturno, às 17:30), com o período aberto e na disponibilidade do aluno
    const starts = horariosDaMissao(horarios, d.mis, d.eq).filter(m => state.win[periodoDoMinuto(m)] && naDisponibilidade(m));
    const endMax = fimDoAluno(stuId, d.mis, d.eq);
    const dur = Math.round(H * 60);
    // Os horários possíveis: a 1ª e a 2ª preferência, depois os outros pela distância da 1ª; w é o período (a janela de
    // operação em que o voo começa), para agrupar a escala
    const pf = preferidos;
    const inicios = ordenarPelaPreferencia(starts, pf[0], pf[1])
      .filter(m => m >= minStartAfterGround && m + dur <= endMax)
      .map(m => ({ w: periodoDoMinuto(m), a: m, b: m + dur }));

    // Os aviões que servem ao voo (js/frota.js): o tipo, o "Só Parafuso" (o Parafuso no C152 só nele, e ele só no
    // Parafuso) e o "Só VFR" (o voo IFR, inclusive o noturno do PC, só no avião homologado IFR)
    const vooDoPedido = { mis: d.mis, eq: d.eq, curso: stu.curso };
    const fleetPool = matriculasParaOVoo(frota, vooDoPedido);
    // O instrutor voa no avião: o avião com habilitação própria (o PR-VOM) exige a dele
    const voaNo = (x, r) => instrutorVoaNoAviao(x, recursoDaFrota(frota, r));

    // Duas tentativas: com o tanque cheio em todos os horários; só se nenhum par couber assim, com menos combustível
    // (o par que precisa reduzir menos vem antes)
    let fc, ch = null, fcDoPar = null, passadaUsada = null;
    const reducao = x => reducaoNecessaria({ stuKg: stu.kg, insKg: x.kg, tipo: d.eq, minutos: dur, mis: d.mis });
    const prev = stuLastPick[stuId] || null;
    for (const passada of passadas) {
      for (const comMenosCombustivel of [false, true]) {
        fc = { locais: 0, stu_busy: 0, eq: 0, revisao: 0, disp: 0, busy: 0, bloq: 0, limite: 0, peso: 0, aviaoProprio: 0 };
        if (comMenosCombustivel && !lim) break;
        for (const p of inicios) {
          // No máximo 6 voos locais saindo no mesmo horário (o confirmado, no minuto dele, passa)
          if (local && p.a !== confirmadoEm && (locaisNoHorario[p.a] || 0) >= LIMITE_DE_VOOS_LOCAIS) { fc.locais++; continue; }
          if (!free(stuBusy, stuId, p.a, p.b)) { fc.stu_busy++; continue; }

          const livres = fleetPool.filter(r => state.av[r] && free(used, r, p.a, p.b));
          if (!livres.length) { fc.eq++; continue; }
          const eqs = livres.filter(r => cabeNoSaldo(eu[r] || 0, dur / 60, saldo(r)));
          if (!eqs.length) { fc.revisao++; continue; }

          // Na primeira tentativa, só com o tanque cheio
          const { servem: habilitados, barrou } = instrutoresQueServem(passada.pool, x => problemasDoInstrutor(x, { mis: d.mis, tipo: d.eq, a: p.a, b: p.b, alunos: [stu], stuKg: stu.kg, curso: stu.curso, exige: d.exige },
            { compromissos: compromissos[x.id] || [], historico: historico(x.id), limites, peso: { reducaoMaxima: comMenosCombustivel ? Infinity : 0 } }));
          if (barrou) { fc[barrou]++; continue; }
          // O par instrutor e avião: só quem voa em algum dos aviões livres (o avião com habilitação própria exige a dele)
          const ins = habilitados.filter(x => eqs.some(r => voaNo(x, r)));
          if (!ins.length) { fc.aviaoProprio++; continue; }

          // Quando o peso importa (o avião tem limite e o aluno, o peso), o instrutor com o peso informado vem antes: sem
          // ele, o limite não é conferido
          const pesoImporta = Boolean(lim && stu.kg);
          ins.sort((a, b) => (comMenosCombustivel && reducao(a) - reducao(b)) || (pesoImporta && !a.kg - !b.kg) || (prev && (a.id === prev.x.id) - (b.id === prev.x.id)) ||
            voosHoje(a) - voosHoje(b) || naFila(a) - naFila(b) ||
            qtdHabilitacoes(a) - qtdHabilitacoes(b) || (load[a.id] || 0) - (load[b.id] || 0));

          // O instrutor fica no mesmo avião durante o dia: primeiro o avião que ele já usou hoje, depois o rodízio do aluno
          // (evita o avião anterior dele); então um avião que já saiu, com a menor folga até o voo (fecha os buracos do dia),
          // e por último o primeiro do hangar
          const x = ins[0];
          const ordemNoInstrutor = r => { const i = (insAircraft[x.id] || []).indexOf(r); return i < 0 ? Infinity : i; };
          const doInstrutor = eqs.filter(r => voaNo(x, r));
          doInstrutor.sort((a, b) => menorPrimeiro(ordemNoInstrutor(a), ordemNoInstrutor(b)) || (prev && (a === prev.r) - (b === prev.r)) ||
            menorPrimeiro(folgaAte(used[a] || [], p.a, p.b), folgaAte(used[b] || [], p.a, p.b)) || posicao(a) - posicao(b));

          ch = { p, r: doInstrutor[0], x };
          break;
        }
        if (ch || !fc.peso) break;
      }
      if (ch) { passadaUsada = passada; break; }
      if (!passada.semPar) fcDoPar = fc;
    }

    if (ch) {
      const { p, r, x } = ch, hh = dur / 60;
      (used[r] = used[r] || []).push([p.a, p.b]);
      (compromissos[x.id] ||= []).push({ a: p.a, b: p.b, voo: AIRCRAFT_EQ_TYPES.includes(d.eq) });
      (stuBusy[stuId] = stuBusy[stuId] || []).push([p.a, p.b]);
      stuLastPick[stuId] = { r, x };
      const avioesDoInstrutor = (insAircraft[x.id] = insAircraft[x.id] || []);
      if (!avioesDoInstrutor.includes(r)) avioesDoInstrutor.push(r);

      const fKey = chaveDoVoo(stuId, mid);
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
        s: nm, mis: d.mis, h: hh, ss: '1/1',
        ...(d.etapa ? { etapa: d.etapa } : {}),
        r, ins: x.nm,
        stuKg: stu.kg || 0,
        insKg: x.kg || 0,
        limKg: lim,
        kg: stu.kg && x.kg ? stu.kg + x.kg : 0,
        ...combustivelDoVoo(stu.kg, x.kg, d.eq, dur, d.mis),
        baseTag,
        tag: baseTag,
        status: statusDoVoo({ fKey }, state.fStatus),
        ...passadaUsada.marca
      });
      if (passadaUsada.semPar) anotarSemPar(fcDoPar);

      eu[r] = (eu[r] || 0) + hh;
      if (local && p.a !== confirmadoEm) locaisNoHorario[p.a] = (locaisNoHorario[p.a] || 0) + 1;
      load[x.id] = (load[x.id] || 0) + hh;
      if (categoria) voosNaCategoria[`${categoria}:${x.id}`] = voosHoje(x) + 1;

      if (lim && (!stu.kg || !x.kg)) {
        // O aviso diz de quem é o peso que falta
        const quem = !stu.kg && !x.kg ? `Pesos do aluno e de ${x.nm} não informados` : !stu.kg ? 'Peso do aluno não informado' : `Peso de ${x.nm} não informado`;
        al.push({ t: 'warn', s: labelStu, m: `${quem} (0 kg): verificação de limite (${lim} kg) no ${d.eq} não realizada.`, codigo: 'sem-peso', ...(stu.kg ? {} : { stuId }), ...(x.kg ? {} : { insId: x.id }) });
      }
    } else {
      // O motivo, com o código que diz onde resolver
      let codigo, why;
      if (isParafuso && d.eq === 'C152' && !soParafuso.some(r => state.av[r])) {
        [codigo, why] = ['so-parafuso', soParafuso.length
          ? `o ${nomesSoParafuso} (só para Parafuso no C152) está em manutenção`
          : 'não há na frota um C152 marcado como “Só Parafuso” (em Recursos)'];
      } else if (frota.some(f => f.tipo === d.eq && state.av[f.reg] && motivoDoAviao(f, vooDoPedido) === 'so-vfr') && !fleetPool.some(r => state.av[r])) {
        [codigo, why] = ['sem-aviao', `nenhum ${d.eq} homologado IFR disponível (o voo é IFR; os disponíveis são “Só VFR”)`];
      } else if (!fleetPool.some(r => state.av[r])) {
        [codigo, why] = ['sem-aviao', `nenhum ${d.eq} disponível (todos em manutenção)`];
      } else if (!state.ins.some(x => x.on && podeFazer(x, d.mis, d.eq, { curso: stu.curso, exige: d.exige }))) {
        [codigo, why] = ['sem-instrutor-habilitado', `nenhum instrutor ativo tem a habilitação de ${d.mis} no ${d.eq} (${exige})`];
      } else if (!inicios.length && permitidas) {
        [codigo, why] = ['disponibilidade-do-aluno', `nenhum horário aberto na disponibilidade do aluno (${rotuloDaDisponibilidade(d.jan)}) comporta ${fmtH(H)}`];
      } else if (!inicios.length) {
        [codigo, why] = minStartAfterGround > 0
          ? ['depois-do-ground', `nenhum horário aberto depois do Ground (${hm(minStartAfterGround)}) comporta ${fmtH(H)} até as ${hm(endMax)}`]
          : ['sem-horario', `nenhum horário aberto comporta ${fmtH(H)}${night ? ' a partir das 17:30' : endMax < MINUTOS_DO_DIA ? ` até as ${hm(endMax)}` : ''}`];
      } else {
        const key = Object.keys(fc).sort((a, b) => fc[b] - fc[a])[0];
        [codigo, why] = {
          stu_busy: ['aluno-ocupado', 'o aluno já tem outra missão nos horários possíveis'],
          eq: ['avioes-ocupados', isParafuso && d.eq === 'C152'
            ? `o ${nomesSoParafuso} (só para Parafuso) já está ocupado nos horários possíveis`
            : frota.some(f => f.tipo === d.eq && state.av[f.reg] && motivoDoAviao(f, vooDoPedido) === 'so-vfr')
              ? `nenhum ${d.eq} homologado IFR livre nos horários possíveis (o voo é IFR; os “Só VFR” não servem a ele)`
              : `nenhum ${d.eq} livre nos horários possíveis (ocupados por pedidos de prioridade maior)`],
          revisao: ['revisao', `os ${d.eq} livres estão sem saldo até a revisão de 50 horas`],
          disp: ['instrutores-indisponiveis', escolhido ? `${quem} não está disponível durante o voo inteiro nos horários possíveis` : `nenhum instrutor habilitado (${exige}) está disponível durante o voo inteiro nos horários possíveis`],
          busy: ['instrutores-ocupados', escolhido ? `${quem} já tem outro compromisso nos horários possíveis` : `os instrutores habilitados (${exige}) já têm outro compromisso nos horários possíveis`],
          bloq: ['bloqueio', `os instrutores habilitados (${exige}) e livres estão em “Não escalar com” deste aluno`],
          limite: ['limite-da-lei', escolhido ? `${quem} passaria dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários possíveis` : 'nenhum instrutor dentro dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários possíveis'],
          locais: ['limite-de-locais', `já há ${LIMITE_DE_VOOS_LOCAIS} voos locais (Voo Local, Voo Solo e TGL) em todos os horários possíveis, o máximo no mesmo horário`],
          peso: ['peso', `peso aluno + ${escolhido ? quem : 'instrutor'} acima do limite de ${lim} kg do ${d.eq}, mesmo com o mínimo de combustível`],
          aviaoProprio: ['habilitacao-do-aviao', `os ${d.eq} livres exigem a habilitação própria deles, e ${escolhido ? `${quem} não a tem` : 'nenhum instrutor livre a tem'} (marque em Instrutores › Cadastro)`]
        }[key];
      }
      al.push({ t: 'err', s: labelStu, m: `Rejeitado: ${why}.`, codigo });
    }
  }

  if (opcoes.dividirHoras !== false) equalizarHoras(out, state, limites, historico);
  // Compactação: a escala compactada vale quando, já com as matrículas trocadas, custa menos pelo critério do
  // dia do que a escala sem compactar (a troca de matrículas mexe no tempo parado dos aviões)
  const compactada = opcoes.compactar === false ? null : out.map(o => ({ ...o }));
  const trocarMatriculas = lista => { if (opcoes.trocarMatriculas !== false) manterInstrutorNoMesmoAviao(lista, state, saldo, frota, posicao, serveAoVoo); };
  if (compactada && compactar(compactada, state, { saldo, posicao, limites, historico })) {
    trocarMatriculas(compactada);
    trocarMatriculas(out);
    if (custoDaEscala(compactada, state) < custoDaEscala(out, state) - 1e-9) out.splice(0, out.length, ...compactada);
  } else {
    trocarMatriculas(out);
  }
  // O voo sem o instrutor do “Priorizar com”: o aviso diz quem ficou com ele (se a divisão das horas ou a compactação o
  // passaram para um instrutor do “Priorizar com”, não há aviso)
  for (const o of out) {
    const sem = semPar.get(o.fKey);
    if (!sem) continue;
    if (sem.pares.includes(o.insId)) { o.insPar = true; continue; }
    al.push({ t: 'warn', s: sem.s, m: `Sem o instrutor de “Priorizar com” (${sem.nomes}: ${sem.motivo}): o voo ficou com ${o.ins}.`, codigo: 'voa-com', stuId: o.stuId, insId: o.insId });
  }
  // O voo do pedido cujo instrutor escolhido saiu do cadastro: o aviso diz quem ficou com ele (o voo fixo fica com o
  // conflito dele)
  const pedidoDoVoo = pedidosDosVoos(state.stu);
  for (const o of out) {
    const d = o.fixo ? null : pedidoDoVoo(o);
    if (!d || !d.insId || noCadastro.has(d.insId)) continue;
    al.push({ t: 'warn', s: o.mid ? `${o.s} (${o.mis})` : o.s, m: `O instrutor escolhido saiu do cadastro: o voo ficou com ${o.ins}. Escolha outro na Demanda ou deixe no Automático.`, codigo: 'escolhido-saiu', stuId: o.stuId, insId: o.insId });
  }
  // O 7º voo local confirmado (Q8): cada voo confirmado num horário com mais de 6 voos locais no todo (sem os cancelados)
  // avisa, com o texto do agendado e o lugar dele, depois dos não confirmados do horário, na ordem dos alunos (o que ainda
  // cabe nos 6, porque um cancelado não sai, não avisa)
  const locaisPorHorario = new Map();
  for (const o of out) {
    if (o.trecho || o.isGround || !MISSOES_LOCAIS.includes(o.mis) || o.status === 'Cancelado') continue;
    locaisPorHorario.set(o.a, [...(locaisPorHorario.get(o.a) || []), o]);
  }
  for (const [a, voos] of locaisPorHorario) {
    if (voos.length <= LIMITE_DE_VOOS_LOCAIS) continue;
    const confirmados = voos.filter(o => { const d = pedidoDoVoo(o); return Boolean(d) && minutoConfirmado(d) === a; }).sort((p, q) => p.o - q.o || p.mid - q.mid);
    confirmados.forEach((o, k) => {
      const lugar = voos.length - confirmados.length + k + 1;
      if (lugar <= LIMITE_DE_VOOS_LOCAIS) return;
      al.push({
        t: 'warn', s: o.mid ? `${o.s} (${o.mis})` : o.s, fKey: o.fKey, stuId: o.stuId, codigo: 'limite-de-locais',
        m: `Agendado às ${hm(a)} como o ${lugar}º voo local do horário: no máximo ${LIMITE_DE_VOOS_LOCAIS} voos locais saem no mesmo horário.`
      });
    });
  }
  al.push(...avisosDeLimite(out, state, limites, historico));
  // O repouso antes da volta do noturno (a lei pede 12 h; o noturno termina às 21:30 e a volta decola às 07:30): um aviso
  // por instrutor, quando a volta não foi cancelada
  for (const o of out.filter(v => v.trecho === 'volta' && statusDoVoo(v, state.fStatus) !== 'Cancelado')) {
    const h = historico(o.insId);
    if (!h || !Number.isFinite(h.fimDoNoturno) || limites.repousoMin === null || al.some(a => a.codigo === 'repouso-do-noturno' && a.insId === o.insId)) continue;
    const repouso = repousoAntesDaVolta(h.fimDoNoturno, limites);
    if (repouso >= limites.repousoMin) continue;
    al.push({
      t: 'warn', s: o.ins, codigo: 'repouso-do-noturno', insId: o.insId,
      m: `Limite da lei: ${duracaoHm(repouso)} de repouso entre o noturno de ontem (até ${hm(h.fimDoNoturno)}) e o translado de volta (${hm(o.a)}), menos que as ${duracaoHm(limites.repousoMin)} da lei.`
    });
  }

  // Revisão de 50 horas: horas de cada avião controlado e onde ele para (sem saldo para mais uma missão de 1 h)
  const revisao = {};
  for (const r of Object.keys(horas)) {
    if (typeof horas[r] !== 'number' || !frota.some(f => f.reg === r)) continue;
    // Sem os cancelados; o atrasado para no horário novo
    const meus = out.filter(o => o.r === r && o.status !== 'Cancelado').map(o => ({ ...o, ...intervaloEfetivo(o, o.status, (state.fObs || {})[o.fKey]) }));
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
          : `Aeronave parou para revisão de 50 horas: sem saldo para voar hoje (${fmtH(fim)} desde a última revisão).`,
        codigo: 'revisao'
      });
    }
  }

  // Atualiza a tag das turmas coletivas de Ground com a quantidade de alunos na mesma sala/horário (sem os cancelados)
  const classCounts = {};
  out.forEach(o => {
    if (o.isGround && o.classKey && o.status !== 'Cancelado') {
      classCounts[o.classKey] = (classCounts[o.classKey] || 0) + 1;
    }
  });
  out.forEach(o => {
    if (o.isGround && o.classKey) {
      const c = Math.max(1, classCounts[o.classKey] || 0);
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
    const st = statusLookupFn ? statusLookupFn(o) : statusDoVoo(o);
    if (st === 'Cancelado') return;
    const key = unidadeDoVoo(o) || `${o.w}_${o.a}_${o.b}_${o.mis}_${o.ins}`;
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
