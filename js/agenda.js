// Agenda de solicitações da secretaria: a regra do prazo (a mesma do servidor, no horário de São Paulo), o limite de voos
// locais e o pedido da demanda que cada solicitação vira ao ser importada (a importação: js/processamento.js).
import { MIS, MISSOES_LOCAIS, LIMITE_DE_VOOS_LOCAIS } from './config.js';
import { disponibilidadeAtual, disponibilidadeDoAluno, normalizeMissionFields, duracaoPadraoDaMissao } from './rules.js';
import { horariosDaMissao, preferenciasPadrao, paraMinuto } from './horarios.js';
import { hm, somarDias } from './format.js';

export const FUSO_DO_AEROCLUBE = 'America/Sao_Paulo';

export const JANELAS_DA_AGENDA = [['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite'], ['horario', 'Horário específico']];

// Data (AAAA-MM-DD) e hora (HH:MM) de um instante no horário de São Paulo
function emSaoPaulo(instante) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_DO_AEROCLUBE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(instante).map(p => [p.type, p.value]));
  return { data: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

export const hojeEmSaoPaulo = (agora = new Date()) => emSaoPaulo(agora).data;

// O aeroclube não opera aos domingos
export const ehDomingo = iso => new Date(iso + 'T12:00:00Z').getUTCDay() === 0;

// O prazo para os pedidos de uma data: até as 13:00 do dia de operação anterior; a segunda, até sábado às 10:00 (o
// domingo não opera). Domingo não recebe pedido. Devolve { dia, hora } (São Paulo) ou null (domingo)
export function prazoDaData(data) {
  if (ehDomingo(data)) return null;
  const anterior = somarDias(data, ehDomingo(somarDias(data, -1)) ? -2 : -1);
  return { dia: anterior, hora: new Date(anterior + 'T12:00:00Z').getUTCDay() === 6 ? '10:00' : '13:00' };
}

export function prazoDaAgendaPermite(data, agora = new Date()) {
  const prazo = prazoDaData(data);
  if (!prazo) return false;
  const { data: hoje, hora } = emSaoPaulo(agora);
  return hoje < prazo.dia || (hoje === prazo.dia && hora < prazo.hora);
}

// As datas do campo "Data do pedido": os dias de operação de hoje até daqui a 14 dias e a data aberta, quando depois
// disso. Quem não usa a Exceção da Coordenação (a Secretaria) só vê as que ainda aceitam pedidos; quem usa vê também as
// encerradas, marcadas. Cada uma: { data, rotulo: "sex 20/11 (amanhã)", encerrado }
const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function datasParaRegistrar({ aberta, excecao = false, agora = new Date() }) {
  const hoje = emSaoPaulo(agora).data;
  const dias = [];
  for (let i = 0; i <= 14; i++) dias.push(somarDias(hoje, i));
  if (aberta && aberta > dias.at(-1)) dias.push(aberta);
  return dias.filter(d => !ehDomingo(d)).map(data => {
    const encerrado = !prazoDaAgendaPermite(data, agora);
    const relativo = data === hoje ? ' (hoje)' : data === somarDias(hoje, 1) ? ' (amanhã)' : '';
    const rotulo = `${SEMANA_CURTA[new Date(data + 'T12:00:00Z').getUTCDay()]} ${data.slice(8, 10)}/${data.slice(5, 7)}${relativo}${encerrado ? ' · prazo encerrado' : ''}`;
    return { data, rotulo, encerrado };
  }).filter(d => excecao || !d.encerrado);
}

export const primeiraDataAberta = (agora = new Date()) => {
  const { data: hoje } = emSaoPaulo(agora);
  let data = somarDias(hoje, 1);
  while (!prazoDaAgendaPermite(data, agora)) data = somarDias(data, 1);
  return data;
};

export function disponibilidadeDaSolicitacao({ janela, horario }) {
  if (janela !== 'horario') return disponibilidadeAtual(janela);
  const minuto = paraMinuto(horario);
  return minuto === null ? undefined : disponibilidadeAtual(`h${minuto}`);
}

// O recurso do pedido (o tipo: C152, PA-34, Sim. Mono…): os que a missão permite, e o formato em que o servidor o guarda
// (a migração agenda_com_recurso). O pedido de antes não tem recurso, e o que a missão não permite não vale: null nos dois
export const RECURSO_DO_PEDIDO = /^[A-Za-z0-9]([A-Za-z0-9 .-]{0,28}[A-Za-z0-9])?$/;
export const recursosDaMissao = missao => (Object.hasOwn(MIS, missao) ? MIS[missao].eq : []);
export const recursoValido = ({ missao, recurso }) => (recursosDaMissao(missao).includes(recurso) ? recurso : null);

// Pedido da demanda: a missão com o recurso do pedido (sem ele, o padrão da missão); como preferências, os dois primeiros horários dela que a
// disponibilidade permite (sem disponibilidade, os primeiros a partir das 08:20 e das 10:10); prioridade 3. Os horários
// são os da categoria do equipamento (o PA-34 tem os seus). As horas: as fixas da missão (o Ground, 01h30; o Noturno,
// 4 h); senão, as registradas na agenda; senão, as do programa do curso; senão, as padrão da missão (1 h; o simulador,
// 2 h). eq e nb: o recurso e as horas da missão do programa do curso (o recurso dela vale mais que o do pedido)
export function pedidoDaSolicitacao(solicitacao, horarios, { eq, nb } = {}) {
  const jan = disponibilidadeDaSolicitacao(solicitacao);
  const regra = Object.hasOwn(MIS, solicitacao.missao) ? MIS[solicitacao.missao] : MIS['Voo Local'];
  const equipamento = eq && regra.eq.includes(eq) ? eq : recursoValido(solicitacao) || regra.defEq;
  const lista = horariosDaMissao(horarios, solicitacao.missao, equipamento);
  const permitida = disponibilidadeDoAluno(jan);
  const naDisponibilidade = permitida ? lista.filter(permitida) : [];
  const [p1, p2] = naDisponibilidade.length ? [naDisponibilidade[0], naDisponibilidade[Math.min(1, naDisponibilidade.length - 1)]] : preferenciasPadrao(lista);
  const registradas = solicitacao.horas === null || solicitacao.horas === undefined ? null : +solicitacao.horas;
  const pedido = {
    fly: true, mis: solicitacao.missao, eq: equipamento,
    p1, p2, nb: registradas ?? nb ?? duracaoPadraoDaMissao(solicitacao.missao), ss: 1, pr: 3,
    ...(jan ? { jan } : {})
  };
  // A duração fixa da missão vale mais que as outras (normalizeMissionFields a impõe)
  normalizeMissionFields(pedido);
  return pedido;
}

// No máximo 6 voos locais (Voo Local, Voo Solo e TGL) saindo no mesmo horário (determinação da diretoria). Ao agendar
// mais um local num horário que já tem 6 (pedidos não cancelados da data), não há vaga: o próximo horário possível é o
// primeiro mais tarde, entre os horários da missão no recurso do pedido (sem ele, no padrão dela), que ainda tem vaga (null:
// nenhum)
export function vagaDeVooLocal(pedidos, { data, horario, missao, recurso }, horarios) {
  if (!MISSOES_LOCAIS.includes(missao)) return { ok: true };
  const noHorario = h => pedidos.filter(p => p.data === data && !p.cancelada_em && p.janela === 'horario' && p.horario === h && MISSOES_LOCAIS.includes(p.missao)).length;
  if (noHorario(horario) < LIMITE_DE_VOOS_LOCAIS) return { ok: true };
  const regra = Object.hasOwn(MIS, missao) ? MIS[missao] : MIS['Voo Local'];
  const depois = horariosDaMissao(horarios, missao, recursoValido({ missao, recurso }) || regra.defEq).map(hm).filter(h => h > horario);
  return { ok: false, proximo: depois.find(h => noHorario(h) < LIMITE_DE_VOOS_LOCAIS) || null };
}
