// Agenda de solicitações da secretaria: a regra do prazo (a mesma do servidor, no horário de São Paulo), as datas em que um
// pedido pode ser registrado, as missões que o pedido do aluno pode ter (as do curso dele), as regras do registro, o limite
// de voos locais e o pedido da demanda que cada solicitação vira ao ser importada (a importação: js/processamento.js).
import { MIS, MISSOES_LOCAIS, LIMITE_DE_VOOS_LOCAIS, T, NI, GROUND_DURATION_H, DURACAO_MAXIMA_H } from './config.js';
import { disponibilidadeAtual, disponibilidadeDoAluno, normalizeMissionFields, duracaoPadraoDaMissao, duracaoFixaDaMissao } from './rules.js';
import { horariosDaMissao, preferenciasPadrao, paraMinuto, HORARIO_DO_SOLO } from './horarios.js';
import { percursoDoCurso, noturnosDoCurso, rotuloDaMissao } from './programa.js';
import { hm, fmtH, somarDias } from './format.js';

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

export const primeiraDataAberta = (agora = new Date()) => {
  const { data: hoje } = emSaoPaulo(agora);
  let data = somarDias(hoje, 1);
  while (!prazoDaAgendaPermite(data, agora)) data = somarDias(data, 1);
  return data;
};

// As datas em que um pedido pode ser registrado ("Data do pedido"): os dias de operação (sem domingo) de hoje (São Paulo) a
// 14 dias, e a data aberta, quando é mais adiante. Com a exceção da Coordenação, também as que já fecharam (fechada); sem
// ela, só as abertas. padrao: a data aberta, se ela está na lista e aceita pedidos; senão, a primeira que aceita
export function datasParaRegistrar(hoje, dataAberta, { excecao = false, agora = new Date() } = {}) {
  const datas = Array.from({ length: 15 }, (_, i) => somarDias(hoje, i));
  if (dataAberta && dataAberta > datas.at(-1)) datas.push(dataAberta);
  const opcoes = datas.filter(data => !ehDomingo(data)).map(data => ({ data, fechada: !prazoDaAgendaPermite(data, agora) })).filter(o => excecao || !o.fechada);
  const aberta = opcoes.find(o => o.data === dataAberta);
  return { opcoes, padrao: aberta && !aberta.fechada ? aberta.data : primeiraDataAberta(agora) };
}

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

// As missões que o pedido do aluno pode ter (N8): as do programa do curso dele (programa: os cursos lidos, S.programa;
// null, quando não foram lidos), uma lista por fase, na ordem do programa: as que estão nele e não são dispensadas, e o
// Noturno de dois dias pela noite (os translados voam com ela). Nada da próxima missão conta (a ordem, a aprovação, o "já
// voada"): uma missão voada continua na lista, e o progresso desligado não muda nada. Cada missão: o id, o código, o
// tipo, o recurso, as horas (as fixas do tipo, no Ground e no Noturno) e o texto, "NAV-150NM · Navegação · C152 · 3 h".
// Sem curso, com o curso encerrado, fora dos programas ou sem missões, e sem os programas lidos, nenhuma (grupos vazio):
// o campo oferece os tipos de missão, e motivo diz por quê
export function missoesDoAluno(aluno, programa) {
  const tipos = motivo => ({ curso: null, grupos: [], motivo: `${motivo}: escolha o tipo da missão.` });
  const sigla = aluno && aluno.curso;
  if (!sigla) return tipos('Aluno sem curso');
  if (!Array.isArray(programa)) return tipos('Os programas dos cursos não foram lidos');
  const curso = programa.find(c => c.sigla === sigla);
  if (!curso) return tipos(`O curso ${sigla} não está nos programas dos cursos`);
  if (curso.ativo === false) return tipos(`O curso ${sigla} está encerrado`);
  const { fases, porFase } = percursoDoCurso(curso);
  const doNoturno = noturnosDoCurso(curso);
  const oferecida = m => !m.dispensada && (!doNoturno.has(m.id) || doNoturno.get(m.id).noite.id === m.id);
  const grupos = fases.map(f => ({
    fase: f.nome,
    missoes: porFase.get(f.id).filter(oferecida).map(m => {
      const nb = duracaoFixaDaMissao(m.mis) || m.nb;
      return { id: m.id, codigo: m.codigo, mis: m.mis, eq: m.eq, nb, texto: `${rotuloDaMissao(curso, m)} · ${m.mis} · ${m.eq} · ${fmtH(nb)}` };
    })
  })).filter(g => g.missoes.length);
  if (!grupos.length) return tipos(`O curso ${sigla} não tem missões no programa`);
  return { curso, grupos, motivo: null };
}

// As regras do pedido na função de 13 argumentos (a migração missao_do_curso_e_limite_do_pedido), depois de quem pode, do
// horário específico e da duração, e antes do limite de voos locais e do prazo. As três cópias delas (o modo local, o
// servidor falso e o cliente falso dos testes) passam pelos casos de test/helpers/casos-da-agenda.js, que o banco também
// tem. Os horários fixos: o Noturno sai às 17:30 e o Voo Solo, às 06:30 (os de horariosDaMissao)
export const HORARIOS_FIXOS = Object.freeze({ Noturno: hm(T[NI]), 'Voo Solo': hm(HORARIO_DO_SOLO) });

// A missão do curso pelo id, nos cursos guardados (o formato de programa_do_curso: as fases e as missões, também as
// retiradas): { curso, missao, retirada } (retirada: ela ou a fase dela saiu do programa); null, quando não há
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function missaoDoCursoGuardada(cursos, id) {
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  for (const curso of Array.isArray(cursos) ? cursos : []) {
    const missao = (curso.missoes || []).find(m => m.id === id);
    if (!missao) continue;
    const fase = (curso.fases || []).find(f => f.id === missao.fase);
    return { curso, missao, retirada: missao.removida === true || Boolean(fase && fase.removida === true) };
  }
  return null;
}

// A recusa do pedido (horas: as que o servidor guarda, o Ground já com 1,5 h), com o código, o campo (a dica do servidor)
// e a mensagem; null, quando passa:
// - o recurso é obrigatório e é um dos que a missão permite, com as horas (public.missao_e_recurso_validos);
// - o Noturno e o Voo Solo saem nos horários fixos deles;
// - a missão do curso, quando há uma, existe, está no programa e é do tipo do pedido (o recurso dela e o curso do aluno
//   não são comparados: são do cadastro, e uma limitação do aluno pode trocar o recurso)
export function recusaDoPedido({ missao, recurso, horario, horas, missaoDoCurso = null }, cursos = []) {
  const tipo = typeof recurso === 'string' ? recurso.trim() : '';
  const recusa = (campo, mensagem) => ({ code: '22023', campo, mensagem });
  if (!tipo) return recusa('recurso', 'o pedido precisa do recurso');
  const permitido = Object.hasOwn(MIS, missao) && MIS[missao].eq.includes(tipo) && (!MIS[missao].isGround || horas === GROUND_DURATION_H)
    && horas > 0 && horas <= DURACAO_MAXIMA_H;
  if (!permitido) return recusa('recurso', `a missão ${missao} não é feita no ${tipo} com essas horas`);
  if (Object.hasOwn(HORARIOS_FIXOS, missao) && horario !== HORARIOS_FIXOS[missao]) return recusa('horario', `${missao} sai sempre às ${HORARIOS_FIXOS[missao]}`);
  if (missaoDoCurso !== null && missaoDoCurso !== undefined) {
    const doCurso = missaoDoCursoGuardada(cursos, missaoDoCurso);
    if (!doCurso || doCurso.retirada || doCurso.missao.mis !== missao) {
      return recusa('missao', 'a missão do curso não existe, saiu do programa ou é de outro tipo');
    }
  }
  return null;
}

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
// mais um local num horário que já tem 6 (pedidos não cancelados da data), não há vaga: quantos já há (locais: mais de 6
// com o 7º confirmado) e o próximo horário possível, o primeiro mais tarde, entre os horários da missão no recurso do
// pedido (sem ele, no padrão dela), que ainda tem vaga (null: nenhum)
export function vagaDeVooLocal(pedidos, { data, horario, missao, recurso }, horarios) {
  if (!MISSOES_LOCAIS.includes(missao)) return { ok: true };
  const noHorario = h => pedidos.filter(p => p.data === data && !p.cancelada_em && p.janela === 'horario' && p.horario === h && MISSOES_LOCAIS.includes(p.missao)).length;
  const locais = noHorario(horario);
  if (locais < LIMITE_DE_VOOS_LOCAIS) return { ok: true };
  const regra = Object.hasOwn(MIS, missao) ? MIS[missao] : MIS['Voo Local'];
  const depois = horariosDaMissao(horarios, missao, recursoValido({ missao, recurso }) || regra.defEq).map(hm).filter(h => h > horario);
  return { ok: false, locais, proximo: depois.find(h => noHorario(h) < LIMITE_DE_VOOS_LOCAIS) || null };
}
