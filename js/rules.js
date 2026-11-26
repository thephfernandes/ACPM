// Regras das missões: Ground School, precedência Ground → voo
// e normalização de pedidos (inclusive nomes de missão de versões anteriores).
import { MIS, NI, T, PRE, GROUND_EQ_TYPE, GROUND_DURATION_H, DURACAO_MAXIMA_H, MISSOES_LOCAIS } from './config.js';
import { hm, lerHoras } from './format.js';
import { periodoDoMinuto, minutoDaPreferencia, preferenciaValida, HORARIO_DO_SOLO } from './horarios.js';
import { codigoValido, siglaValida } from './cursos.js';
import { chaveDoVoo } from './voo.js';

// Disponibilidade do aluno para o pedido (da agenda da secretaria ou escolhida na demanda): o voo só começa nesses
// horários. "manha", "tarde" e "noite" valem por período (as janelas de operação de cada um); "h450" é um horário
// exato (07:30, em minutos; "h5", dos dados antigos, é a janela 5). Sem disponibilidade, qualquer horário habilitado
const PERIODOS = { manha: ['Manhã', PRE['Manhã']], tarde: ['Tarde', PRE['Tarde']], noite: ['Noite', PRE['Noturno']] };
function minutoExato(jan) {
  const horario = /^h(\d{1,4})$/.exec(jan);
  const minuto = horario ? minutoDaPreferencia(+horario[1]) : -1;
  return minuto >= T[0] && minuto <= T[NI] ? minuto : null;
}
// O minuto em que o 7º voo local confirmado na Agenda (limiteConfirmado, Q8) passa do limite de 6: o horário exato do
// pedido (jan); null no pedido não confirmado, sem horário exato ou que não é local. O motor e as Sugestões contam assim
export const minutoConfirmado = d => (Boolean(d) && MISSOES_LOCAIS.includes(d.mis) && d.limiteConfirmado === true ? minutoExato(d.jan) : null);
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
const missionRule = mis => (Object.hasOwn(MIS, mis) ? MIS[mis] : null);

export const isGroundMission = mis => Boolean(missionRule(mis) && missionRule(mis).isGround);

// Verifica se um voo (d) depende de uma missão de Ground (gMis) agendada para o mesmo aluno no dia
export function doesGroundGateFlight(gMis, flightReq) {
  const gRule = missionRule(gMis);
  if (!gRule || !gRule.isGround || isGroundMission(flightReq.mis)) return false;
  if (gRule.gatesEq && flightReq.eq === gRule.gatesEq) return true;
  if (gRule.gatesMis && flightReq.mis === gRule.gatesMis) return true;
  return false;
}

// As chaves dos voos que o dia ainda guarda, também das missões que saíram da demanda: o voo fixo, o status, o detalhe
// do status e os resultados registrados na data
function chavesGuardadas(estado) {
  const resultados = estado.resultados && Array.isArray(estado.resultados.doDia) ? estado.resultados.doDia : [];
  return [...[estado.fixos, estado.fStatus, estado.fObs].flatMap(m => Object.keys(m && typeof m === 'object' ? m : {})),
    ...resultados.map(r => r && r.voo).filter(voo => typeof voo === 'string')];
}

// O dia ainda guarda alguma coisa do voo da chave (o voo fixo, o status, o detalhe ou um resultado): um pedido novo nela
// herdaria o cadeado, o status ou o resultado de outro voo
export const chaveTemSobras = (estado, chave) => chavesGuardadas(estado).includes(chave);

// O número da próxima missão extra de um aluno: depois das missões dele e do que o dia ainda guarda para ele (voo fixo,
// status, detalhe ou resultado de uma missão retirada), para não herdar o voo de outra missão. Numerada no aluno, a
// missão extra não muda o cadastro (o número do cadastro, nid, fica para as pessoas novas)
export function proximoMid(estado, aluno) {
  const prefixo = `${aluno.id}_`;
  const doDia = chavesGuardadas(estado).filter(fKey => fKey.startsWith(prefixo)).map(fKey => Number(fKey.split('_')[1]));
  const doAluno = (aluno.extra || []).map(ex => ex.mid).filter(Number.isInteger);
  return Math.max(0, ...doAluno, ...doDia.filter(Number.isInteger)) + 1;
}

// As horas com que um pedido da missão começa: o Ground, 01h30; a missão com duração padrão (o simulador, 2 h), a dela;
// as outras, 1 h
export const duracaoPadraoDaMissao = mis => (isGroundMission(mis) ? GROUND_DURATION_H
  : duracaoFixaDaMissao(mis) || (Object.hasOwn(MIS, mis) && MIS[mis].duracaoPadrao ? MIS[mis].duracaoPadrao : 1));
// A duração que não muda (o Ground, 01h30; o Noturno, 4 h no dia: o translado e o noturno em BH), ou null
export const duracaoFixaDaMissao = mis => (isGroundMission(mis) ? GROUND_DURATION_H
  : Object.hasOwn(MIS, mis) && MIS[mis].duracaoFixaH ? MIS[mis].duracaoFixaH : null);

export const blank = () => ({ fly: false, mis: 'Voo Local', eq: 'C152', p1: T[1], p2: T[2], nb: 1, ss: 1, pr: 3 });
// O pedido em branco, sem nada do voo de antes: saem a disponibilidade, a missão do curso (o código e o curso), o pedido
// da agenda e o instrutor escolhido. Assim ficam o pedido que a agenda reaproveita (alvoDoNovoPedido) e o pedido limpo
// por "Limpar demanda" (js/fixos.js). Muda o pedido e o devolve
export function deixarEmBranco(pedido) {
  Object.assign(pedido, blank());
  for (const campo of ['jan', 'etapa', 'cursoDaEtapa', 'solicitacao', 'insId', 'limiteConfirmado']) delete pedido[campo];
  return pedido;
}

// O pedido que recebe um voo novo do aluno (o pedido da agenda; o voo agendado na escala): o principal, quando ele não
// voa e o dia não guarda nada da chave dele, em branco (deixarEmBranco); senão, uma missão extra nova, com a prioridade
// do aluno. O pedido que não voa e tem sobras fica como está: voltando a voar, volta para o mesmo lugar
export function alvoDoNovoPedido(estado, aluno) {
  if (!aluno.fly && !chaveTemSobras(estado, chaveDoVoo(aluno.id, 0))) return deixarEmBranco(aluno);
  const extra = { mid: proximoMid(estado, aluno), ...blank(), pr: aluno.pr || 3 };
  aluno.extra = [...(aluno.extra || []), extra];
  return extra;
}

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

// A duração digitada pelo operador: de 0,1 h a DURACAO_MAXIMA_H, em décimos; fora disso, null (e a mensagem)
export const ERRO_DA_DURACAO = `A duração vai de 0,1 h a ${DURACAO_MAXIMA_H} h.`;
export const duracaoDigitada = texto => {
  const h = lerHoras(texto);
  return h > 0 && h <= DURACAO_MAXIMA_H ? h : null;
};

// A duração do voo: em décimos de hora, de 0,1 h a DURACAO_MAXIMA_H (acima, o máximo); fora disso, 1 h
export function duracaoValida(valor) {
  const h = Math.round(+valor * 10) / 10;
  if (!Number.isFinite(h) || h <= 0) return 1;
  return Math.min(h, DURACAO_MAXIMA_H);
}

// O peso de um aluno ou instrutor, em kg: mais que 0 e até PESO_MAXIMO; 0 é sem peso. O gravado fora disso (ou que não é
// um número) fica sem peso
const PESO_MAXIMO = 300;
export const pesoValido = v => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= PESO_MAXIMO ? v : 0);
// O peso digitado pelo operador: em décimos de kg, com vírgula ou ponto, mais que 0 e até PESO_MAXIMO; fora disso, null
// (e a mensagem). O campo vazio é sem peso: quem lê o campo decide
export const ERRO_DO_PESO = `O peso vai de 1 a ${PESO_MAXIMO} kg.`;
export const pesoDigitado = texto => {
  const kg = Math.round(parseFloat(String(texto).replace(',', '.')) * 10) / 10;
  return kg > 0 && kg <= PESO_MAXIMO ? kg : null;
};
// O peso do campo do cadastro (aluno ou instrutor): vazio é sem peso (0); zero, negativo, acima de PESO_MAXIMO ou um texto
// que não é número não vale (null). O texto que não é número chega vazio (o campo é type=number), mas com
// validity.badInput (naoENumero): ele não apaga o peso
export const pesoDoTexto = (texto, naoENumero = false) => (String(texto ?? '').trim() === '' && !naoENumero ? 0 : pesoDigitado(texto));

// Um valor gravado que não é texto, número nem booleano (um objeto ou uma lista) não é convertido: um objeto que não vira
// texto ({"toString": null}, num JSON gravado) daria TypeError ao converter, e a data não abriria. Esses campos ficam
// sem o valor e valem os padrões, como os outros fora do formato (docs/PLAN.md:440)
const valorSimples = v => v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v);
const CAMPOS_CONVERTIDOS = ['mis', 'nb', 'pr', 'jan'];

export function normalizeMissionFields(target) {
  for (const campo of CAMPOS_CONVERTIDOS) {
    if (Object.hasOwn(target, campo) && !valorSimples(target[campo])) {
      if (campo === 'pr') target.pr = 3;
      else delete target[campo];
    }
  }
  target.mis = migrateLegacyMissionName(target.mis);
  // Uma sessão por missão (para dividir o voo no dia, "+ missão"): o campo fica nos dados, sempre 1, e o motor
  // recebe cada missão como um voo só
  target.ss = 1;
  // Preferências e disponibilidade em minutos (formato 12): o número da janela e o "h5" dos dados antigos convertem
  if (Object.hasOwn(target, 'jan')) {
    const jan = disponibilidadeAtual(target.jan);
    if (jan) target.jan = jan;
    else delete target.jan;
  }
  target.p1 = preferenciaValida(target.p1);
  target.p2 = preferenciaValida(target.p2);
  // Prioridade de 1 a 5 e "voa" sim ou não (valores gravados fora do formato voltam ao padrão)
  if (Object.hasOwn(target, 'pr')) target.pr = Number.isInteger(+target.pr) && +target.pr >= 1 && +target.pr <= 5 ? +target.pr : 3;
  if (Object.hasOwn(target, 'fly')) target.fly = Boolean(target.fly);
  // O código da missão do curso, quando o pedido veio do programa
  if (Object.hasOwn(target, 'etapa') && !(typeof target.etapa === 'string' && codigoValido(target.etapa))) delete target.etapa;
  // O curso dessa missão (a sigla; o resultado vai para ele, mesmo que o aluno troque de curso no mesmo dia): só com a
  // missão do curso. Não se chama "curso": o pedido principal é o próprio aluno, e o curso do aluno é outro campo
  if (Object.hasOwn(target, 'cursoDaEtapa') && !(siglaValida(target.cursoDaEtapa) && Object.hasOwn(target, 'etapa'))) delete target.cursoDaEtapa;
  // O id do pedido da agenda que originou este voo
  if (Object.hasOwn(target, 'solicitacao') && !(Number.isInteger(target.solicitacao) && target.solicitacao > 0)) delete target.solicitacao;
  // O instrutor escolhido pelo operador para o pedido
  if (Object.hasOwn(target, 'insId') && !(Number.isInteger(target.insId) && target.insId > 0)) delete target.insId;
  // O 7º voo local no horário confirmado na Agenda (formato 27): só true fica
  if (Object.hasOwn(target, 'limiteConfirmado') && target.limiteConfirmado !== true) delete target.limiteConfirmado;
  const mRule = missionRule(target.mis) || MIS['Voo Local'];
  if (!mRule.eq.includes(target.eq)) target.eq = mRule.defEq;
  if (mRule.isGround) {
    target.eq = GROUND_EQ_TYPE;
    target.nb = GROUND_DURATION_H;
    if (target.p1 === T[NI]) target.p1 = T[0];
    if (target.p2 === T[NI]) target.p2 = T[1];
  } else {
    target.nb = duracaoFixaDaMissao(target.mis) || duracaoValida(target.nb);
  }
  // Missão de horário fixo (o Noturno às 17:30; o Voo Solo às 06:30): a preferência é ele
  if (target.mis === 'Noturno' || target.mis === 'Voo Solo') { target.p1 = target.mis === 'Noturno' ? T[NI] : HORARIO_DO_SOLO; target.p2 = -1; }
}
