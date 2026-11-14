// Regras das missões: Ground School, precedência Ground → voo
// e normalização de pedidos (inclusive nomes de missão de versões anteriores).
import { MIS, NI, T, PRE, GROUND_EQ_TYPE, GROUND_DURATION_H } from './config.js';
import { hm } from './format.js';
import { periodoDoMinuto, minutoDaPreferencia, preferenciaValida } from './horarios.js';
import { codigoValido } from './cursos.js';

// Disponibilidade do aluno para o pedido (da agenda da secretaria ou escolhida na demanda): o voo só começa nesses
// horários. "manha", "tarde" e "noite" valem por período (as janelas de operação de cada um); "h450" é um horário
// exato (07:30, em minutos; "h5", dos dados antigos, é a janela 5). Sem disponibilidade, qualquer horário habilitado
const PERIODOS = { manha: ['Manhã', PRE['Manhã']], tarde: ['Tarde', PRE['Tarde']], noite: ['Noite', PRE['Noturno']] };
function minutoExato(jan) {
  const horario = /^h(\d{1,4})$/.exec(jan);
  const minuto = horario ? minutoDaPreferencia(+horario[1]) : -1;
  return minuto >= T[0] && minuto <= T[NI] ? minuto : null;
}
// O que a disponibilidade permite: uma função do horário de início, ou null (sem disponibilidade: qualquer horário)
export function disponibilidadeDoAluno(jan) {
  if (typeof jan !== 'string') return null;
  if (Object.hasOwn(PERIODOS, jan)) {
    const periodos = PERIODOS[jan][1];
    return minuto => periodos.includes(periodoDoMinuto(minuto));
  }
  const exato = minutoExato(jan);
  return exato === null ? null : minuto => minuto === exato;
}
export const disponibilidadeValida = jan => disponibilidadeDoAluno(jan) !== null;
// A disponibilidade no formato atual ("h5" vira "h820"); inválida: undefined
export const disponibilidadeAtual = jan =>
  (typeof jan === 'string' && Object.hasOwn(PERIODOS, jan) ? jan : minutoExato(jan) !== null ? `h${minutoExato(jan)}` : undefined);
export const rotuloDaDisponibilidade = jan =>
  (Object.hasOwn(PERIODOS, jan) ? PERIODOS[jan][0] : minutoExato(jan) !== null ? `às ${hm(minutoExato(jan))}` : 'Qualquer horário');
// Opções da Demanda: os períodos e os horários da lista do pedido
export const opcoesDeDisponibilidade = horarios => [['', 'Qualquer horário'], ...Object.keys(PERIODOS).map(j => [j, PERIODOS[j][0]]),
  ...horarios.map(m => [`h${m}`, `Só às ${hm(m)}`])];

// Regra da missão pelo nome, somente entre as missões cadastradas (nomes como "constructor" não contam)
export const missionRule = mis => (Object.hasOwn(MIS, mis) ? MIS[mis] : null);

export const isGroundMission = mis => Boolean(missionRule(mis) && missionRule(mis).isGround);

// Verifica se um voo (d) depende de uma missão de Ground (gMis) agendada para o mesmo aluno no dia
export function doesGroundGateFlight(gMis, flightReq) {
  const gRule = missionRule(gMis);
  if (!gRule || !gRule.isGround || isGroundMission(flightReq.mis)) return false;
  if (gRule.gatesEq && flightReq.eq === gRule.gatesEq) return true;
  if (gRule.gatesMis && flightReq.mis === gRule.gatesMis) return true;
  return false;
}

// O número da próxima missão extra de um aluno (revisão de 14/11): depois das missões dele e do que o dia ainda guarda
// para ele (voo fixo, status ou detalhe de uma missão retirada), para não herdar o voo de outra missão. Numerada no
// aluno, a missão extra não muda o cadastro (o número do cadastro, nid, fica para as pessoas novas)
export function proximoMid(estado, aluno) {
  const prefixo = `${aluno.id}_`;
  const doDia = [estado.fixos, estado.fStatus, estado.fObs].flatMap(m => Object.keys(m && typeof m === 'object' ? m : {}))
    .filter(fKey => fKey.startsWith(prefixo)).map(fKey => Number(fKey.split('_')[1]));
  const doAluno = (aluno.extra || []).map(ex => ex.mid).filter(Number.isInteger);
  return Math.max(0, ...doAluno, ...doDia.filter(Number.isInteger)) + 1;
}

export const blank = () => ({ fly: false, mis: 'Voo Local', eq: 'C152', p1: T[1], p2: T[2], nb: 1, ss: 1, pr: 3 });

export function migrateLegacyMissionName(mis) {
  if (missionRule(mis)) return mis;
  const map = {
    'PP Local': 'Voo Local',
    'PP Navegação (>27nm)': 'Navegação',
    'PC Visual': 'Voo Local',
    'Multi': 'Multimotor',
    'INVA': 'Voo Local',
    'TGL': 'Voo Local',
    'Ground de Navegação': 'Ground Navegação'
  };
  return Object.hasOwn(map, mis) ? map[mis] : 'Voo Local';
}

export function normalizeMissionFields(target) {
  target.mis = migrateLegacyMissionName(target.mis);
  // Uma sessão por missão: a coluna Sessões saiu da Demanda (para dividir o voo no dia, "+ missão"). O campo
  // continua nos dados, sempre 1, e o motor recebe cada missão como um voo só
  target.ss = 1;
  // Preferências e disponibilidade em minutos (formato 12): o número da janela e o "h5" dos dados antigos convertem
  if (Object.hasOwn(target, 'jan')) {
    const jan = disponibilidadeAtual(target.jan);
    if (jan) target.jan = jan;
    else delete target.jan;
  }
  target.p1 = preferenciaValida(target.p1);
  target.p2 = preferenciaValida(target.p2);
  // Prioridade de 1 a 5 e "voa" sim ou não (revisão de 14/11: valores gravados fora do formato voltam ao padrão)
  if (Object.hasOwn(target, 'pr')) target.pr = Number.isInteger(+target.pr) && +target.pr >= 1 && +target.pr <= 5 ? +target.pr : 3;
  if (Object.hasOwn(target, 'fly')) target.fly = Boolean(target.fly);
  // O código da missão do curso (fase 14), quando o pedido veio do programa
  if (Object.hasOwn(target, 'etapa') && !(typeof target.etapa === 'string' && codigoValido(target.etapa))) delete target.etapa;
  const mRule = missionRule(target.mis) || MIS['Voo Local'];
  if (!mRule.eq.includes(target.eq)) target.eq = mRule.defEq;
  if (mRule.isGround) {
    target.eq = GROUND_EQ_TYPE;
    target.nb = GROUND_DURATION_H;
    if (target.p1 === T[NI]) target.p1 = T[0];
    if (target.p2 === T[NI]) target.p2 = T[1];
  } else if (+target.nb === GROUND_DURATION_H || !Number.isInteger(+target.nb)) {
    target.nb = 1;
  }
}
