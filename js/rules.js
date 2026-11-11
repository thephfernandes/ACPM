// Regras das missões: Ground School, precedência Ground → voo
// e normalização de pedidos (inclusive nomes de missão de versões anteriores).
import { MIS, NI, WIN, PRE, GROUND_EQ_TYPE, GROUND_DURATION_H } from './config.js';

// Disponibilidade do aluno para o pedido (da agenda da secretaria ou escolhida na demanda): o voo só começa nessas
// janelas. Sem disponibilidade, o voo pode começar em qualquer janela habilitada
const PERIODOS = { manha: ['Manhã', PRE['Manhã']], tarde: ['Tarde', PRE['Tarde']], noite: ['Noite', PRE['Noturno']] };
export function janelasDaDisponibilidade(jan) {
  if (typeof jan !== 'string') return null;
  if (Object.hasOwn(PERIODOS, jan)) return [...PERIODOS[jan][1]];
  const horario = /^h([0-8])$/.exec(jan);
  return horario ? [+horario[1]] : null;
}
export const rotuloDaDisponibilidade = jan =>
  Object.hasOwn(PERIODOS, jan) ? PERIODOS[jan][0] : janelasDaDisponibilidade(jan) ? `às ${WIN[+jan.slice(1)]}` : 'Qualquer horário';
export const DISPONIBILIDADES = [['', 'Qualquer horário'], ...Object.keys(PERIODOS).map(j => [j, rotuloDaDisponibilidade(j)]), ...WIN.map((w, i) => [`h${i}`, `Só às ${w}`])];

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

export const blank = () => ({ fly: false, mis: 'Voo Local', eq: 'C152', p1: 1, p2: 2, nb: 1, ss: 1, pr: 3 });

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
  if (Object.hasOwn(target, 'jan') && !janelasDaDisponibilidade(target.jan)) delete target.jan;
  const mRule = missionRule(target.mis) || MIS['Voo Local'];
  if (!mRule.eq.includes(target.eq)) target.eq = mRule.defEq;
  if (mRule.isGround) {
    target.eq = GROUND_EQ_TYPE;
    target.nb = GROUND_DURATION_H;
    if (target.p1 === NI) target.p1 = 0;
    if (target.p2 === NI) target.p2 = 1;
  } else if (+target.nb === GROUND_DURATION_H || !Number.isInteger(+target.nb)) {
    target.nb = 1;
  }
}
