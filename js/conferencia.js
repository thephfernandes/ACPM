// A conferência dos voos fixos da escala, fora do motor (js/engine.js), que a usa: a fila dos pedidos, a volta do noturno de
// ontem, a linha de cada voo fixo (linhaDoFixo: o lugar dele, conferido com as regras do motor, os conflitos e os avisos
// do agendado) e o que o motor confere depois de montar a escala (o 7º local confirmado, os limites da lei, o repouso
// antes da volta do noturno, a revisão de 50 horas, o tamanho das turmas e os atrasos).
// conferirEscala confere uma escala já montada sem o motor: a escala aprovada que o operador muda na Escala (F1g). Ela não
// põe, não move e não tira nenhum voo: refaz as marcas de conflito, os alertas deles, os avisos e a revisão, e os pesos e o
// combustível de cada linha pelo cadastro
import { NOTURNO, DEFAULT_LIM, GROUND_EQ_TYPE, GROUND_REG, GROUND_DURATION_MIN, GROUND_DURATION_H, REVISAO_H, MENOR_VOO_H, AIRCRAFT_EQ_TYPES, MISSOES_LOCAIS, LIMITE_DE_VOOS_LOCAIS } from './config.js';
import { FROTA_INICIAL, matriculasDoTipo, motivoDoAviao, aviaoServe, instrutorVoaNoAviao, recursoDaFrota, salaDisponivel } from './frota.js';
import { hm, fmtH, numeroBr, duracaoHm } from './format.js';
import { repousoAntesDaVolta, historicoDoDia } from './noturno.js';
import { isGroundMission, doesGroundGateFlight, disponibilidadeDoAluno, disponibilidadeAtual, duracaoValida, duracaoFixaDaMissao, minutoConfirmado } from './rules.js';
import { categoriaDoTipo } from './categorias.js';
import { fechamentosDoEstado, horarioAberto } from './fechamentos.js';
import { HORARIOS_INICIAIS, horariosDaMissao, horariosDoTipo, periodoDoMinuto, minutoDaPreferencia, fimDasMissoesDoDia, INICIOS_DOS_TEMPOS, HORARIO_DO_SOLO } from './horarios.js';
import { ajustarFilas, categoriaDoRodizio } from './rodizio.js';
import { avisosDeAtraso, intervaloEfetivo, STATUS_EM_ANDAMENTO } from './status.js';
import { livre, cabeNoSaldo, saldoAteARevisao, problemasDoInstrutor } from './viabilidade.js';
import { combustivelDoVoo } from './combustivel.js';
import { TEXTO_DO_PROBLEMA } from './conflitos.js';
import { podeFazer } from './habilitacoes.js';
import { normalizarHangar, posicaoNoHangar } from './hangar.js';
import { normalizarLimites } from './limites.js';
import { chaveDoVoo, statusDoVoo, umPorUnidade, pedidosDosVoos, pedidoDoAluno, ocupacaoDoVoo, compromissoDoVoo } from './voo.js';
import { menorPrimeiro } from './util.js';
import { pinoDoVoo } from './fixos.js';
import { rejeicoesDosPedidos } from './rejeicoes.js';

// A duração (em minutos) do voo de um pedido: o Ground tem 01h30; o voo, as horas do pedido
const duracaoDoPedido = (d, ground) => (ground ? GROUND_DURATION_MIN : Math.round((duracaoFixaDaMissao(d.mis) || duracaoValida(d.nb)) * 60));

const free = (mp, id, s, e) => livre(mp[id], s, e);

// O que a escala do dia gasta enquanto é montada (o motor e a conferência): o avião (ou a sala), o instrutor, o aluno, as
// horas até a revisão, a lei, os voos locais de cada horário e o rodízio; e o que o estado diz de fixo (a frota, os
// horários de decolagem, o hangar, os limites e as horas de antes de hoje)
export function contextoDaEscala(state) {
  // A frota vem do cadastro; sem ela (estados de teste antigos), a frota inicial
  const frota = Array.isArray(state.frota) ? state.frota : FROTA_INICIAL;
  const soParafuso = matriculasDoTipo(frota, 'C152', { parafuso: true });
  // Os requisitos de um voo da escala (a missão, o tipo e o curso do aluno) e se um avião serve a ele, com o instrutor
  // dele (js/frota.js)
  const cursoDoAluno = new Map(state.stu.map(s => [s.id, s.curso]));
  const instrutorPorId = new Map(state.ins.map(x => [x.id, x]));
  const serveAoVoo = (r, o) => {
    const recurso = recursoDaFrota(frota, r), x = instrutorPorId.get(o.insId);
    return aviaoServe(recurso, { mis: o.mis, eq: o.eqType, curso: cursoDoAluno.get(o.stuId) }) && (!x || instrutorVoaNoAviao(x, recurso));
  };
  // A ordem dos aviões no hangar: da frente para o fundo; sem ela, a ordem da frota
  const hangar = normalizarHangar(state.hangar, frota);
  // Revisão de 50 horas: horas que o avião ainda pode voar hoje
  const horas = state.horas || {};
  // Escala aprovada: os voos fixos entram primeiro, no mesmo horário, avião e instrutor; o resto é encaixado
  // em volta. O fixo que ficou impossível continua onde está, em conflito (com o motivo); o cancelado não ocupa nada
  const fixos = state.fixos && typeof state.fixos === 'object' ? state.fixos : {};
  return {
    frota, soParafuso, nomesSoParafuso: soParafuso.length ? soParafuso.join(' ou ') : 'marcada como “Só Parafuso”',
    instrutorPorId, serveAoVoo,
    // Os horários de decolagem de cada categoria vêm do cadastro; sem eles, os iniciais
    horarios: state.horarios || HORARIOS_INICIAIS,
    // Os horários fechados da data (js/fechamentos.js): os do dia; sem eles, os das nove janelas de antes
    fechamentos: fechamentosDoEstado(state),
    posicao: r => posicaoNoHangar(hangar, r),
    // Limites da Lei do Aeronauta: as horas de voo de antes de hoje e o fim de ontem de cada instrutor, e os
    // compromissos de hoje (voo em avião conta como voo; simulador e Ground, só na jornada)
    limites: normalizarLimites(state.limites),
    // (quem volta hoje do noturno de ontem fica sem o fimAnterior: o repouso dele é um aviso, js/noturno.js)
    historico: historicoDoDia(state),
    // Até quando a missão do aluno pode ir. O Noturno só sai às 17:30: o aluno que tem um no dia termina as outras
    // missões (o simulador e a aula, que podem passar das 17:30) antes dele. A compactação e as Sugestões usam a mesma regra
    fimDoAluno: fimDasMissoesDoDia(state.stu),
    // Rodízio: a fila de cada categoria (cheque, MLTE, noturno e C172) e os voos dela que cada instrutor já recebeu hoje
    filas: ajustarFilas(state.filas, state.ins),
    horas, saldo: r => saldoAteARevisao(horas, r),
    fixos,
    // O voo fixo de um pedido (a chave aluno_missão_1), ou null
    chaveFixa: item => { const fKey = chaveDoVoo(item.stuId, item.mid); return Object.hasOwn(fixos, fKey) ? fKey : null; },
    // O instrutor que saiu do cadastro não conta como escolha (o pedido volta para o Automático, com aviso)
    noCadastro: new Set(state.ins.map(x => x.id)),
    used: {}, stuBusy: {}, stuLastPick: {}, load: {}, eu: {}, compromissos: {},
    // Aeronaves/simuladores que cada instrutor já usou no dia, na ordem em que foram escalados
    insAircraft: {},
    // Armazena turmas abertas de Ground School por missão para permitir múltiplos alunos no mesmo horário/instrutor
    openGroundClasses: {},
    // Registra os Grounds agendados por aluno no dia para exigir precedência antes do respectivo voo
    stuGroundStatus: {},
    voosNaCategoria: {},
    // Os voos locais (Voo Local, Voo Solo e TGL) que saem em cada horário, sem os confirmados: o 7º voo local confirmado na
    // Agenda (limiteConfirmado, Q8) passa do limite no minuto exato do pedido (jan), fixo ou não, e não conta aqui, então
    // não toma lugar dos outros, onde quer que caia na fila (no máximo 6 sem os confirmados, mais os confirmados)
    locaisNoHorario: {},
    // O voo atrasado ocupa o horário novo depois de conferidos os outros fixos
    ocupacoesDeAtraso: [],
    // As linhas da escala já montadas (a turma de Ground ocupa a sala e o instrutor pelo primeiro aluno dela)
    out: []
  };
}

// Monta fila de pedidos de missão (suporta múltiplas missões por aluno no mesmo dia) e registra os Grounds de cada aluno
export function filaDosPedidos(state, ctx, { antesDoF1h = false } = {}) {
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
      (ctx.stuGroundStatus[item.stuId] = ctx.stuGroundStatus[item.stuId] || []).push({
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
   * 4º: A ordem dos agendamentos: o pedido da agenda que foi registrado antes (o id do
   *     pedido cresce com o registro) vem antes; o pedido posto à mão, sem a agenda, vem depois dos agendados. Num
   *     horário cheio, quem registrou antes fica com ele (N14).
   * 5º: Ordem de cadastro do aluno e ordem da missão.
   * O “Priorizar com” não é chave da fila e não ganha horário de ninguém (Pedro, 2026-11-26: ele é para escolher o INVA,
   * não o horário): ele escolhe o instrutor entre os que ficaram com o horário (js/engine.js, parearNoHorario).
   * antesDoF1h: a fila do motor de antes do F1h (com a mesma prioridade, o aluno com “Priorizar com” antes da ordem dos
   * agendamentos), a que gravou test/fixtures/conferencia-do-motor.json
   */
  const ordemDoAgendamento = item => (Number.isInteger(item.ref.solicitacao) ? item.ref.solicitacao : Infinity);
  const semEscolha = item => (item.ref.insId && ctx.noCadastro.has(item.ref.insId) ? 0 : 1);
  const semVoaCom = item => (antesDoF1h && (item.stu.voaCom || []).length ? 0 : 1);
  act.sort((a, b) => {
    const gA = isGroundMission(a.ref.mis) ? 1 : 0;
    const gB = isGroundMission(b.ref.mis) ? 1 : 0;
    if (gA !== gB) return gB - gA;
    return semEscolha(a) - semEscolha(b) || b.ref.pr - a.ref.pr || semVoaCom(a) - semVoaCom(b) || menorPrimeiro(ordemDoAgendamento(a), ordemDoAgendamento(b)) || a.stuOrder - b.stuOrder || a.misOrder - b.misOrder;
  });
  return act;
}

// A volta do noturno de ontem (state.noturnosDaVespera, lido da escala gravada da véspera): o translado de BH decola às
// 07:30 e pousa às 08:30. O instrutor, o aluno e o avião passaram a noite em BH e só ficam livres às 10:10. Entra como um
// voo fixo (o trecho "volta", sessão 2/2 do pedido de ontem) de 07:30–08:30 com livreAs 10:10: ocupa a manhã até as
// 10:10 (ocupacaoDoVoo) e conta 1 h de voo para a lei e a revisão. Cancelado (o mau tempo em BH), não ocupa nada
function voltasDoNoturno(state, ctx, out) {
  const { used, stuBusy, compromissos, eu, load, instrutorPorId } = ctx;
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
}

// A linha de um voo fixo (o pino de um pedido da fila: item, como em filaDosPedidos), no lugar do pino, conferida de novo
// com as regras do motor contra o que a escala já gasta (ctx): cada conflito com o texto e o código. Ocupa o avião (ou a
// sala), o instrutor e o aluno no contexto. Devolve a linha, o alerta do conflito (ou null) e os avisos das regras que o
// agendado pulou (comAviso: o agendado que as confere)
function linhaDoFixo(state, ctx, item, pino, fKey = chaveDoVoo(item.stuId, item.mid)) {
  const { used, stuBusy, stuLastPick, load, eu, compromissos, insAircraft, openGroundClasses, stuGroundStatus, voosNaCategoria, locaisNoHorario, frota, nomesSoParafuso, historico, limites, horarios, fechamentos, fimDoAluno, saldo } = ctx;
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
  const avisos = [];
  let comAviso = false;
  // A turma ocupa a sala e o instrutor pelo primeiro aluno dela que não foi cancelado
  const daMesmaTurma = ground && ctx.out.some(o => o.classKey === classKey && o.stuId !== stuId && o.status !== 'Cancelado');
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
    } else {
      // A Sala Ground indisponível na data (S4), como o avião indisponível
      if (!salaDisponivel(state.av)) marcar('sala-indisponivel', 'a Sala Ground está indisponível nesta data');
      if (!daMesmaTurma && !free(used, GROUND_REG, a, b)) marcar('sala-ocupada', 'a sala de Ground já está ocupada neste horário');
    }
    if (!free(stuBusy, stuId, a, b)) marcar('aluno-ocupado', 'o aluno já tem outro voo neste horário');
    if (!horarioAberto(fechamentos, a, categoriaDoTipo(tipo))) marcar('horario-fechado', 'o horário está fechado nesta data');
    const permitidas = disponibilidadeDoAluno(d.jan);
    if (permitidas && !permitidas(a)) marcar('disponibilidade', 'o horário está fora da disponibilidade do aluno');
    if (!mudouDeTipo && b - a !== duracaoDoPedido(d, ground)) marcar('duracao', 'a duração do pedido mudou');
    if (pino.agendado && !STATUS_EM_ANDAMENTO.includes(status) && !mudouDeTipo) {
      comAviso = true;
      const avisar = (codigo, m) => avisos.push({ t: 'warn', s: rotulo, fKey, m, codigo, stuId });
      // Os horários de decolagem da missão (o Ground, os da Sala Ground; o Noturno, às 17:30; o Voo Solo, às 06:30)
      const lista = ground ? horariosDoTipo(horarios, GROUND_EQ_TYPE) : horariosDaMissao(horarios, d.mis, d.eq);
      if (!lista.includes(a)) {
        avisar('fora-dos-horarios', ground ? `Agendado às ${hm(a)}, fora dos horários de decolagem da Sala Ground.`
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
        avisos.push({ t: 'warn', s: rotulo, fKey, m: `${quem} (0 kg): verificação de limite (${lim} kg) no ${d.eq} não realizada.`, codigo: 'sem-peso', ...(stu.kg ? {} : { stuId }), ...(x.kg ? {} : { insId: x.id }) });
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
    else ctx.ocupacoesDeAtraso.push(() => ocupar(efetivo));
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
      if (x && !daMesmaTurma && !conflito.length && !turmas.some(c => c.classKey === classKey)) turmas.push({ classKey, mis: d.mis, w: INICIOS_DOS_TEMPOS.indexOf(a), a, b, x, count: 0 });
      const turma = turmas.find(c => c.classKey === classKey);
      if (turma) turma.count++;
      const gRec = (stuGroundStatus[stuId] || []).find(g => g.mis === d.mis && g.allocatedEnd === null);
      if (gRec) gRec.allocatedEnd = b;
    }
  }
  const pf = [minutoDaPreferencia(d.p1), minutoDaPreferencia(d.p2)];
  const baseTag = a === pf[0] ? 'Pref. 1' : a === pf[1] ? 'Pref. 2' : 'Próximo livre';
  const linha = {
    fKey, classKey, isGround: ground,
    w: ground && INICIOS_DOS_TEMPOS.indexOf(a) >= 0 ? INICIOS_DOS_TEMPOS.indexOf(a) : periodoDoMinuto(a), a, b,
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
  };
  const alerta = conflito.length ? { t: 'conf', s: rotulo, fKey, m: `${pino.agendado ? 'Conflito no voo agendado' : 'Conflito na escala aprovada'}: ${conflito.join('; ')}.` } : null;
  return { linha, alerta, avisos, comAviso };
}

// O contexto da escala já montada (out): o que ela gasta, com cada linha no lugar dela, conferida como um fixo (a volta do
// noturno e os fixos com o pino deles; as outras com o lugar delas, e, como na fila do motor, sem o status: o status só
// muda a ocupação de um voo fixo). O motor encaixa nele, depois da compactação, os pedidos da lista de espera
// (js/engine.js). opcoes: as da fila (filaDosPedidos)
export function contextoDaEscalaMontada(state, out, opcoes = {}) {
  const fixos = state.fixos && typeof state.fixos === 'object' ? state.fixos : {};
  const semPino = new Set(out.filter(o => !o.trecho && !Object.hasOwn(fixos, o.fKey)).map(o => o.fKey));
  const estado = { ...state, fStatus: Object.fromEntries(Object.entries(state.fStatus || {}).filter(([fKey]) => !semPino.has(fKey))) };
  const ctx = contextoDaEscala(estado);
  const act = filaDosPedidos(estado, ctx, opcoes);
  const pinos = Object.fromEntries(out.filter(o => !o.trecho).map(o => [o.fKey, semPino.has(o.fKey) ? pinoDoVoo(o) : fixos[o.fKey]]));
  conferirFixos(estado, ctx, act, [], [], pinos);
  return ctx;
}

// Os voos fixos do dia, na ordem do motor: a volta do noturno de ontem; depois os fixos (pelo status, pela escala
// aprovada e pelo instrutor escolhido na Escala) e, por último, os agendados na Escala, cada grupo na ordem dos pedidos:
// o que o agendado gasta é conferido contra os outros fixos, e o conflito fica nele, nunca no voo que já estava fixo.
// pinos: o pino de cada chave (os voos fixos do estado, ou mais: conferirEscala). Põe as linhas em out e os alertas em al
// (os conflitos, na ordem; os avisos dos agendados, depois de todos)
export function conferirFixos(state, ctx, act, out, al, pinos = ctx.fixos) {
  ctx.out = out;
  voltasDoNoturno(state, ctx, out);
  const comPino = act.filter(item => Object.hasOwn(pinos, chaveDoVoo(item.stuId, item.mid)));
  const agendado = item => Boolean(pinos[chaveDoVoo(item.stuId, item.mid)].agendado);
  // O agendado pode estar fora de regras que o motor segue sozinho e não confere nos fixos (o operador confirmou ao
  // agendar): cada uma vira um aviso, com a chave do voo, depois dos fixos. Não avisam o voo cancelado, o em andamento
  // (ele já saiu) e o que mudou de tipo (o conflito dele já diz)
  const avisosDosAgendados = [];
  const agendadosComAviso = new Set();
  for (const item of [...comPino.filter(i => !agendado(i)), ...comPino.filter(agendado)]) {
    const fKey = chaveDoVoo(item.stuId, item.mid);
    const { linha, alerta, avisos, comAviso } = linhaDoFixo(state, ctx, item, pinos[fKey], fKey);
    if (comAviso) agendadosComAviso.add(fKey);
    avisosDosAgendados.push(...avisos);
    out.push(linha);
    if (alerta) al.push(alerta);
  }

  ctx.ocupacoesDeAtraso.forEach(ocupar => ocupar());
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
}

// O horário que o pedido quer: o minuto exato da disponibilidade, senão a 1ª preferência; sem nenhum, null
function horarioPedido(d) {
  const exato = disponibilidadeAtual(d.jan);
  if (typeof exato === 'string' && exato.startsWith('h')) return Number(exato.slice(1));
  const p1 = minutoDaPreferencia(d.p1);
  return p1 >= 0 ? p1 : null;
}

// Por que o outro pedido ficou com o horário: a chave da fila em que ele vem antes (o Ground antes dos voos; a prioridade;
// com a mesma, a ordem de registro na agenda e o cadastro: filaDosPedidos). Quando ele não vem antes na fila (o aluno não
// ficou com o horário por outro motivo: o avião, a sala de Ground), null. Sem o número da prioridade (a tela a mostra ao
// contrário, 1 a mais alta, e com ela desligada todos têm a mesma: js/state.js, estadoDaEscala) e, com a mesma, sem falar
// dela
function porQueFicou(outro, d, ordemDoOutro, ordem) {
  const ground = p => isGroundMission(p.mis);
  if (ground(outro) !== ground(d)) return ground(outro) ? 'o Ground vem antes dos voos' : null;
  const pr = outro.pr ?? 3;
  const agenda = p => (Number.isInteger(p.solicitacao) ? p.solicitacao : Infinity);
  if (pr !== (d.pr ?? 3)) return pr > (d.pr ?? 3) ? 'prioridade maior' : null;
  if (agenda(outro) !== agenda(d)) return agenda(outro) < agenda(d) ? 'pedido registrado antes' : null;
  return ordemDoOutro < ordem ? 'antes no cadastro' : null;
}

// Os instrutores do “Priorizar com” do aluno que estão no cadastro, cada um com o que o impede de dar o voo do pedido (mis,
// tipo, exige) em qualquer horário, na ordem do motivo do motor (js/engine.js, motivoSemPar): 'fora nesta data', 'sem a
// habilitação da missão', 'em “Não escalar com”'; '' quando pode
function paresDoAluno(state, s, { mis, tipo, exige }) {
  return (s.voaCom || []).map(id => state.ins.find(x => x.id === id)).filter(Boolean).map(x => ({
    x, nota: !x.on ? 'fora nesta data' : !podeFazer(x, mis, tipo, { curso: s.curso, exige }) ? 'sem a habilitação da missão' : (s.bl || []).includes(x.id) ? 'em “Não escalar com”' : ''
  }));
}

// Sem nenhum do “Priorizar com” que possa dar o voo: o motivo, como o do motor (todos fora; senão, sem a habilitação; senão,
// em “Não escalar com”)
const motivoSemNenhum = lista => (lista.every(p => p.nota === 'fora nesta data') ? 'fora nesta data'
  : lista.every(p => p.nota !== 'em “Não escalar com”') ? 'sem a habilitação da missão' : 'em “Não escalar com”');

// O INVA (insId) fora do “Priorizar com” do aluno quando um do “Priorizar com” poderia dar o voo: ir contra a limitação do
// aluno (N9, F1h; o agendamento, o editor do voo e a lista do instrutor na Escala avisam). Sem nenhum que possa, o voo com
// outro INVA não vai contra ela
export function foraDoPriorizarCom(state, s, pedido, insId) {
  const pares = paresDoAluno(state, s, pedido);
  return pares.some(p => !p.nota) && !pares.some(p => p.x.id === insId);
}

// O começo do aviso do voo posto à mão (ou com o INVA escolhido na Demanda) fora do “Priorizar com” quando um dele poderia
// (o editor do voo pede a confirmação dele: js/edicao-do-voo.js)
export const INICIO_DO_FORA_DO_PRIORIZAR = 'Fora do “Priorizar com” de ';

// O começo do aviso de sempre do voo que ficou sem o INVA do “Priorizar com”, com o porquê (o resto: “: o voo ficou com …”)
const inicioDoSemPar = porque => `Sem o instrutor de “Priorizar com” (${porque})`;

// Os avisos do “Priorizar com” da escala montada (N9, F1h; o código voa-com, um por voo, com a chave dele), depois da
// divisão das horas e da compactação, com os horários do fim:
// - o voo posto à mão (o pino agendado, ou o do INVA trocado na Escala) ou com o INVA escolhido para o dia na Demanda fora
//   do “Priorizar com”, quando um do “Priorizar com” poderia dar o voo: o aviso de que está fora; sem nenhum que possa, o
//   aviso de sempre, com o motivo como o do motor (o voo com outro INVA não vai contra a limitação);
// - o voo sem pino que ficou sem o instrutor do “Priorizar com” (semPar: a chave do voo → os nomes e o motivo, da busca do
//   motor, ou o começo do aviso, de conferirEscala): o aviso de sempre, com a disputa dentro dele quando há uma;
// - o voo sem pino que ficou com um instrutor do “Priorizar com” fora do horário pedido: a disputa, quando há uma (por
//   qualquer instrutor do “Priorizar com” que pudesse dar o voo).
// A disputa: no horário pedido (horarioPedido), o instrutor do “Priorizar com” está com outro aluno que também o prioriza,
// com um voo fixo, com um pedido que tem o instrutor escolhido para o dia, ou, quando o aluno voa nesse horário, com outro
// voo do mesmo minuto que não o prioriza (“; a troca não serve a <aluno>”: a troca de INVAs não serviu); sem ninguém assim,
// não há frase. O fixo pela aprovação ou pelo status não avisa, nem o voo posto à mão cancelado (o voo sem pino cancelado
// avisa, como antes)
export function avisosDoPriorizarCom(state, out, { semPar = new Map() } = {}) {
  const alunos = new Map(state.stu.map((s, i) => [s.id, { s, i }]));
  const instrutores = new Map(state.ins.map(x => [x.id, x]));
  const fixos = state.fixos && typeof state.fixos === 'object' ? state.fixos : {};
  const pedido = o => { const a = alunos.get(o.stuId); return a && !o.trecho ? pedidoDoAluno(a.s, o.mid || 0) : null; };
  const ativo = o => statusDoVoo(o, state.fStatus) !== 'Cancelado';
  const fimDe = o => (o.trecho ? o.livreAs || o.b : o.b);
  // Quem está com o instrutor x no horário pedido (a, b), além do aluno: o primeiro pelo horário e pela ordem do cadastro.
  // Um voo fixo, um com o instrutor escolhido, um de outro aluno que também prioriza x, ou um voo que sai no mesmo minuto
  // que o do aluno, no horário pedido (a troca de INVAs do pareamento não serviu a ele: js/engine.js, parearNoHorario)
  const quemEsta = (o, x, a, b) => out.filter(v => v !== o && v.stuId !== o.stuId && v.insId === x && ativo(v) && v.a < b && a < fimDe(v) && !(o.isGround && v.classKey === o.classKey))
    .filter(v => {
      if (v.fixo || v.insEscolhido) return true;
      const outro = alunos.get(v.stuId);
      return Boolean(outro && ((outro.s.voaCom || []).includes(x) || (!v.isGround && !v.trecho && !o.isGround && v.a === a && o.a === a)));
    })
    .sort((p, q) => p.a - q.a || p.o - q.o || (p.mid || 0) - (q.mid || 0))[0] || null;
  const disputa = (o, d, s, lista) => {
    const t = horarioPedido(d);
    if (t === null || (lista.includes(o.insId) && o.a === t)) return null;
    for (const x of lista) {
      const v = quemEsta(o, x, t, t + (o.b - o.a));
      if (!v) continue;
      const outro = alunos.get(v.stuId);
      const ambos = Boolean(outro && (outro.s.voaCom || []).includes(x));
      const dOutro = pedido(v);
      const porQue = v.fixo || !dOutro ? 'voo fixo' : v.insEscolhido ? 'instrutor escolhido para o dia' : porQueFicou(dOutro, d, outro.i, alunos.get(o.stuId).i);
      const quem = outro ? outro.s.nm : v.s;
      // Quando ele voa: o horário, e o instrutor quando é outro do “Priorizar com”
      const quando = o.a !== t ? `; ${s.nm} voa às ${hm(o.a)}${lista.includes(o.insId) && o.insId !== x ? ` com ${o.ins}` : ''}` : '';
      // O outro, no mesmo minuto, não prioriza x e não tem pino nem escolha: a troca de INVAs não serve a ele
      const troca = !ambos && !v.fixo && !v.insEscolhido ? `; a troca não serve a ${quem}` : '';
      return `${s.nm} ${ambos ? `e ${quem} priorizam` : 'prioriza'} ${instrutores.get(x).nm} às ${hm(t)}: ficou com ${quem}${porQue ? ` (${porQue})` : ''}${quando}${troca}.`;
    }
    return null;
  };
  const avisos = [];
  for (const o of out) {
    const d = pedido(o);
    if (!d) continue;
    const { s } = alunos.get(o.stuId);
    const lista = paresDoAluno(state, s, { mis: d.mis, tipo: o.isGround ? GROUND_EQ_TYPE : d.eq, exige: d.exige });
    if (!lista.length) continue;
    const pares = lista.map(p => p.x.id);
    // Só os instrutores do “Priorizar com” que poderiam dar o voo (vêm, têm a habilitação e não estão em “Não escalar com”)
    const capazes = lista.filter(p => !p.nota).map(p => p.x.id);
    const rotulo = o.mid ? `${s.nm} (${d.mis})` : s.nm;
    // Na ordem dos campos da escala gravada (js/escala-gravada.js)
    const aviso = m => avisos.push({ t: 'warn', s: rotulo, fKey: o.fKey, m, codigo: 'voa-com', stuId: o.stuId, insId: o.insId });
    const pino = Object.hasOwn(fixos, o.fKey) ? fixos[o.fKey] : null;
    const escolhidoNaDemanda = !pino && Boolean(d.insId && instrutores.has(d.insId));
    if (pino || escolhidoNaDemanda) {
      if (!(escolhidoNaDemanda || pino.agendado || pino.escolhido) || !ativo(o) || pares.includes(o.insId)) continue;
      if (!capazes.length) aviso(`${inicioDoSemPar(`${lista.map(p => p.x.nm).join(', ')}: ${motivoSemNenhum(lista)}`)}: o voo ficou com ${o.ins}.`);
      else {
        const nomes = pares.map(id => instrutores.get(id).nm).join(', ');
        aviso(`${INICIO_DO_FORA_DO_PRIORIZAR}${s.nm} (${nomes}): ${escolhidoNaDemanda ? `${o.ins} foi escolhido para o dia na Demanda` : `o voo foi posto à mão com ${o.ins}`}.`);
      }
      continue;
    }
    if (pares.includes(o.insId)) {
      const frase = disputa(o, d, s, [o.insId, ...capazes.filter(id => id !== o.insId)]);
      if (frase) aviso(frase);
      continue;
    }
    const sem = semPar.get(o.fKey);
    if (!sem) continue;
    const frase = disputa(o, d, s, capazes);
    aviso(`${sem.inicio || inicioDoSemPar(`${sem.nomes}: ${sem.motivo}`)}: o voo ficou com ${o.ins}.${frase ? ` ${frase}` : ''}`);
  }
  return avisos;
}

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

// O que o motor confere depois de montar a escala, sem mover nenhum voo: o instrutor escolhido que saiu do cadastro, o 7º
// voo local confirmado, os limites da lei, o repouso antes da volta do noturno, a revisão de 50 horas, o tamanho e a
// etiqueta das turmas, a ordem das linhas e os atrasos. Muda out e al; devolve a revisão de cada avião
export function concluirEscala(state, ctx, out, al) {
  const { limites, historico, horas } = ctx;
  // O voo do pedido cujo instrutor escolhido saiu do cadastro: o aviso diz quem ficou com ele (o voo fixo fica com o
  // conflito dele)
  const pedidoDoVoo = pedidosDosVoos(state.stu);
  for (const o of out) {
    const d = o.fixo ? null : pedidoDoVoo(o);
    if (!d || !d.insId || ctx.noCadastro.has(d.insId)) continue;
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
    if (typeof horas[r] !== 'number' || !ctx.frota.some(f => f.reg === r)) continue;
    // Sem os cancelados; o atrasado para no horário novo
    const meus = out.filter(o => o.r === r && o.status !== 'Cancelado').map(o => ({ ...o, ...intervaloEfetivo(o, o.status, (state.fObs || {})[o.fKey]) }));
    const voadas = Math.round(meus.reduce((total, o) => total + o.h, 0) * 10) / 10;
    const fim = Math.round((horas[r] + voadas) * 10) / 10;
    const para = state.av[r] !== false && REVISAO_H - fim < MENOR_VOO_H;
    const paraAs = !para ? null : meus.length ? Math.max(...meus.map(o => o.b)) : HORARIO_DO_SOLO;
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
  return revisao;
}

// A linha de um voo sem pino que fica onde está: a de antes (a etiqueta, o “Priorizar com”, o instrutor escolhido), na
// mesma ordem de campos, com os pesos e o combustível do cadastro, o status e o conflito de agora (nova: a linha de
// linhaDoFixo no mesmo lugar). A turma de Ground só soma o peso quando a linha somava: o motor soma só ao passá-la a outro
// instrutor
function comOsPesosDe(velha, nova) {
  const pesos = { stuKg: nova.stuKg, insKg: nova.insKg, limKg: nova.limKg, kg: nova.isGround && !velha.kg ? 0 : nova.kg, status: nova.status };
  const linha = {};
  for (const [campo, valor] of Object.entries(velha)) {
    if (['conflito', 'conflitoCodigos'].includes(campo) || (campo === 'comb' && !nova.comb)) continue;
    linha[campo] = campo === 'comb' ? nova.comb : Object.hasOwn(pesos, campo) ? pesos[campo] : valor;
    // O combustível vem depois do peso, como o motor o põe
    if (campo === 'kg' && nova.comb && !velha.comb) linha.comb = nova.comb;
  }
  return { ...linha, ...(nova.conflito ? { conflito: nova.conflito, conflitoCodigos: nova.conflitoCodigos } : {}) };
}

// A escala montada (a da tela: resultado), conferida de novo sem o motor, depois de uma alteração no estado (a escala
// aprovada que o operador muda na Escala). Nenhum voo é posto, movido ou tirado: o voo com pino fica no pino (a linha dele
// é a de linhaDoFixo), o voo sem pino que está na escala fica onde está (conferido como um fixo, a linha de antes com os
// pesos e o combustível do cadastro), e o pedido sem lugar continua com a recusa de antes (js/rejeicoes.js: antes é o
// estado que fez a escala, para ligar cada recusa ao pedido dela). O pedido que deixou de voar sai (com a linha e a
// recusa); a recusa do pedido que ganhou um pino também. Refeitos: as marcas de conflito e os alertas deles, os avisos
// (dos agendados, do peso, do 7º local confirmado, da lei, da revisão, dos atrasos e do “Priorizar com”, este com o motivo
// de antes do voo sem o instrutor dele), a revisão, o total de missões pedidas e o tamanho das turmas. Um pedido que voa
// sem pino, sem linha e sem recusa (um pedido que entrou no dia) precisa do motor: devolve null. recusas: as recusas que
// voltam (a reversão de uma alteração que tirou a recusa de um pedido: [chave do voo, alerta]), no lugar da linha dele
export function conferirEscala(estado, resultado, { antes = estado, recusas: deVolta = [] } = {}) {
  const ctx = contextoDaEscala(estado);
  const act = filaDosPedidos(estado, ctx);
  const linhas = new Map((resultado.out || []).filter(o => !o.trecho).map(o => [o.fKey, o]));
  const recusas = rejeicoesDosPedidos(antes, resultado);
  // A recusa que volta tira a linha do pedido (a reversão do encaixe: ele volta a ser recusado)
  for (const [fKey, alerta] of deVolta) {
    recusas.set(fKey, alerta);
    linhas.delete(fKey);
  }
  const chave = item => chaveDoVoo(item.stuId, item.mid);
  if (act.some(item => !Object.hasOwn(ctx.fixos, chave(item)) && !linhas.has(chave(item)) && !recusas.has(chave(item)))) return null;
  const out = [], al = [];
  // Os voos fixos, como no motor
  conferirFixos(estado, ctx, act, out, al);
  // Depois deles, na ordem do motor (onde ele encaixaria os outros pedidos): o voo sem pino que está na escala, no lugar
  // dele, conferido como um fixo, com o aviso do peso que falta; e a recusa de cada pedido sem lugar
  const atrasos = ctx.ocupacoesDeAtraso.length;
  const semPesoDeAntes = (resultado.al || []).filter(a => a.codigo === 'sem-peso' && !a.fKey);
  for (const item of act) {
    const fKey = chave(item);
    if (Object.hasOwn(ctx.fixos, fKey)) continue;
    const velha = linhas.get(fKey);
    if (!velha) { al.push(recusas.get(fKey)); continue; }
    const { linha: nova, alerta } = linhaDoFixo(estado, ctx, item, pinoDoVoo(velha), fKey);
    out.push(comOsPesosDe(velha, nova));
    if (alerta) al.push(alerta);
    const rotulo = item.mid ? `${item.stu.nm} (${item.ref.mis})` : item.stu.nm;
    // Os pesos de antes: o aviso de antes (o motor avisa com o instrutor de quando encaixou o voo)
    if (velha.stuKg === nova.stuKg && velha.insKg === nova.insKg) {
      const i = semPesoDeAntes.findIndex(a => a.s === rotulo);
      if (i >= 0) al.push(...semPesoDeAntes.splice(i, 1));
      continue;
    }
    const x = ctx.instrutorPorId.get(nova.insId);
    if (nova.isGround || !nova.limKg || !x || (item.stu.kg && x.kg)) continue;
    const quem = !item.stu.kg && !x.kg ? `Pesos do aluno e de ${x.nm} não informados` : !item.stu.kg ? 'Peso do aluno não informado' : `Peso de ${x.nm} não informado`;
    al.push({ t: 'warn', s: rotulo, m: `${quem} (0 kg): verificação de limite (${nova.limKg} kg) no ${nova.eqType} não realizada.`, codigo: 'sem-peso', ...(item.stu.kg ? {} : { stuId: item.stuId }), ...(x.kg ? {} : { insId: x.id }) });
  }
  ctx.ocupacoesDeAtraso.slice(atrasos).forEach(ocupar => ocupar());
  const soltos = new Set(act.map(chave).filter(fKey => !Object.hasOwn(ctx.fixos, fKey) && linhas.has(fKey)));
  // Os avisos do “Priorizar com”, refeitos com os horários de agora (F1h): as disputas e os voos postos à mão. O motivo do
  // voo sem pino que ficou sem o instrutor do “Priorizar com” vem da busca do motor: fica o do aviso de antes do voo (pela
  // chave; o aviso gravado antes do F1h não a tem: pelo aluno e pelo instrutor), e a disputa dentro dele é refeita
  const velhos = (resultado.al || []).filter(a => a.codigo === 'voa-com' && typeof a.m === 'string' && a.m.startsWith('Sem o instrutor de “Priorizar com” ('));
  const semPar = new Map();
  for (const o of out.filter(v => soltos.has(v.fKey))) {
    const fim = `: o voo ficou com ${o.ins}.`;
    const velho = velhos.find(a => (a.fKey ? a.fKey === o.fKey : a.stuId === o.stuId) && a.insId === o.insId && a.m.includes(fim));
    if (velho) semPar.set(o.fKey, { inicio: velho.m.slice(0, velho.m.indexOf(fim)) });
  }
  al.push(...avisosDoPriorizarCom(estado, out, { semPar }));
  const revisao = concluirEscala(estado, ctx, out, al);
  return { out, al, tot: act.length, revisao, ...(resultado.data !== undefined ? { data: resultado.data } : {}) };
}
