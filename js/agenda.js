// Agenda de solicitações da secretaria: a regra do prazo (a mesma do servidor, no horário de São Paulo) e o pedido
// da demanda que cada solicitação vira ao ser importada.
import { MIS } from './config.js';
import { disponibilidadeAtual, disponibilidadeDoAluno, normalizeMissionFields } from './rules.js';
import { horariosDaMissao, preferenciasPadrao, paraMinuto } from './horarios.js';
import { normalizarCursos } from './cursos.js';
import { situacaoPorMissao, proximaMissao } from './resultados.js';

export const FUSO_DO_AEROCLUBE = 'America/Sao_Paulo';

export const JANELAS_DA_AGENDA = [['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite'], ['horario', 'Horário específico']];

// Data (AAAA-MM-DD) e hora (HH:MM) de um instante no horário de São Paulo
function emSaoPaulo(instante) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_DO_AEROCLUBE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(instante).map(p => [p.type, p.value]));
  return { data: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

export const somarDias = (iso, dias) => new Date(Date.parse(iso + 'T12:00:00Z') + dias * 864e5).toISOString().slice(0, 10);
export const hojeEmSaoPaulo = (agora = new Date()) => emSaoPaulo(agora).data;

// Pedido para o dia seguinte só até as 13:00; depois disso, a partir de dois dias
export function prazoDaAgendaPermite(data, agora = new Date()) {
  const { data: hoje, hora } = emSaoPaulo(agora);
  return data >= somarDias(hoje, 2) || (data === somarDias(hoje, 1) && hora < '13:00');
}

export const primeiraDataAberta = (agora = new Date()) => {
  const { data: hoje } = emSaoPaulo(agora);
  return prazoDaAgendaPermite(somarDias(hoje, 1), agora) ? somarDias(hoje, 1) : somarDias(hoje, 2);
};

export const horaEmSaoPaulo = (agora = new Date()) => emSaoPaulo(agora).hora;

export function disponibilidadeDaSolicitacao({ janela, horario }) {
  if (janela !== 'horario') return disponibilidadeAtual(janela);
  const minuto = paraMinuto(horario);
  return minuto === null ? undefined : disponibilidadeAtual(`h${minuto}`);
}

// Pedido da demanda: a missão com o equipamento padrão; como preferências, os dois primeiros horários dela que a
// disponibilidade permite (sem disponibilidade, os primeiros a partir das 08:20 e das 10:10); 1 h (o Ground tem
// 01h30) e prioridade 3. Os horários são os da categoria do equipamento (o PA-34 tem os seus)
export function pedidoDaSolicitacao(solicitacao, horarios) {
  const jan = disponibilidadeDaSolicitacao(solicitacao);
  const regra = Object.hasOwn(MIS, solicitacao.missao) ? MIS[solicitacao.missao] : MIS['Voo Local'];
  const lista = horariosDaMissao(horarios, solicitacao.missao, regra.defEq);
  const permitida = disponibilidadeDoAluno(jan);
  const naDisponibilidade = permitida ? lista.filter(permitida) : [];
  const [p1, p2] = naDisponibilidade.length ? [naDisponibilidade[0], naDisponibilidade[Math.min(1, naDisponibilidade.length - 1)]] : preferenciasPadrao(lista);
  const pedido = {
    fly: true, mis: solicitacao.missao, eq: regra.defEq,
    p1, p2, nb: 1, ss: 1, pr: 3,
    ...(jan ? { jan } : {})
  };
  normalizeMissionFields(pedido);
  return pedido;
}

// Importa para a demanda da data as solicitações ativas ainda não importadas. Só acrescenta: o aluno sem voo no dia
// recebe o pedido como missão principal; quem já voa a mesma missão só ganha a disponibilidade pedida; senão, o
// pedido entra como missão extra. As solicitações vistas ficam anotadas no dia (estado.importadas) para não repetir.
// Aluno de um curso (fase 14): quando a próxima missão dele no programa é do tipo pedido, o pedido entra como ela (o
// código, o recurso e as horas do programa); situacao: o último resultado de cada missão
export function importarSolicitacoes(estado, solicitacoes, { situacao = [] } = {}) {
  const programa = normalizarCursos(estado.cursos), mapa = situacaoPorMissao(situacao);
  const resumo = { novos: 0, atualizados: 0, semAluno: 0 };
  if (!Array.isArray(estado.importadas)) estado.importadas = [];
  for (const solicitacao of solicitacoes) {
    if (solicitacao.cancelada_em || estado.importadas.includes(solicitacao.id)) continue;
    estado.importadas.push(solicitacao.id);
    const aluno = estado.stu.find(x => x.id === solicitacao.aluno);
    if (!aluno) { resumo.semAluno++; continue; }
    const pedido = pedidoDaSolicitacao(solicitacao, estado.horarios);
    const jaNoDia = [aluno, ...(aluno.extra || [])].filter(m => m.fly && m.etapa).map(m => m.etapa);
    const proxima = proximaMissao(programa, mapa, aluno.id, aluno.curso, { exceto: jaNoDia });
    if (proxima && proxima.mis === pedido.mis) Object.assign(pedido, { etapa: proxima.id, eq: proxima.eq, nb: proxima.nb });
    const mesmaMissao = [aluno, ...(aluno.extra || [])].find(m => m.fly && m.mis === pedido.mis);
    if (mesmaMissao) {
      Object.assign(mesmaMissao, { p1: pedido.p1, p2: pedido.p2 });
      if (pedido.jan) mesmaMissao.jan = pedido.jan;
      else delete mesmaMissao.jan;
      resumo.atualizados++;
    } else if (!aluno.fly) {
      Object.assign(aluno, pedido);
      resumo.novos++;
    } else {
      aluno.extra = [...(aluno.extra || []), { mid: estado.nid++, ...pedido }];
      resumo.novos++;
    }
  }
  return resumo;
}
