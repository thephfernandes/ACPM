// Os conflitos de um voo fixo. A cada cálculo, o motor confere de novo cada voo da escala aprovada
// com as mesmas regras de quando o escalou; o que não vale mais vira conflito, com um texto e um código. O grupo do
// código decide as sugestões de reparo: trocar o instrutor, trocar o avião (ou a sala), passar para outro horário, ou
// soltar o voo para o app escolher de novo (o pedido mudou).
import { nomeDaHabilitacao, PREFIXO_DA_HABILITACAO_DO_AVIAO, PREFIXO_DA_MISSAO_DO_CURSO } from './habilitacoes.js';

export const GRUPO_DO_CONFLITO = {
  'instrutor-saiu': 'instrutor',
  'instrutor-indisponivel': 'instrutor',
  habilitacao: 'instrutor',
  'instrutor-ocupado': 'instrutor',
  bloqueio: 'instrutor',
  'limite-da-lei': 'instrutor',
  peso: 'instrutor',
  'tipo-de-aviao': 'aviao',
  'aviao-indisponivel': 'aviao',
  'aviao-ocupado': 'aviao',
  'so-parafuso': 'aviao',
  'so-vfr': 'aviao',
  revisao: 'aviao',
  'sala-ocupada': 'aviao',
  'aluno-ocupado': 'horario',
  'horario-fechado': 'horario',
  disponibilidade: 'horario',
  duracao: 'pedido',
  'ground-ou-voo': 'pedido'
};
export const CODIGOS_DE_CONFLITO = Object.keys(GRUPO_DO_CONFLITO);

// O limite da lei que o voo passaria, como aparece no conflito
const LIMITE_DO_MOTIVO = {
  'voo-dia': 'horas de voo no dia', jornada: 'jornada', mes: 'horas de voo no mês', semestre: 'horas de voo no semestre',
  ano: 'horas de voo no ano', repouso: 'repouso'
};

// O texto de cada problema do instrutor (os códigos de problemasDoInstrutor, js/viabilidade.js), como aparece no
// conflito de um voo fixo. Na habilitação, o motivo diz qual faltou: a do curso do aluno, a própria do avião, a que o
// recurso exige ou a que a missão do curso exige
export const TEXTO_DO_PROBLEMA = {
  'instrutor-saiu': () => 'o instrutor saiu do cadastro',
  'instrutor-indisponivel': () => 'o instrutor não está disponível',
  habilitacao: p => (!p.motivo ? 'o instrutor não tem a habilitação da missão'
    : p.motivo === 'curso' ? 'o instrutor não tem a habilitação que o curso do aluno exige nesta missão (o noturno do PC é IFR)'
      : p.motivo.startsWith(PREFIXO_DA_HABILITACAO_DO_AVIAO) ? `o instrutor não tem a habilitação própria do ${p.motivo.slice(PREFIXO_DA_HABILITACAO_DO_AVIAO.length)}`
        : p.motivo.startsWith(PREFIXO_DA_MISSAO_DO_CURSO) ? `o instrutor não tem a habilitação que a missão do curso exige (${nomeDaHabilitacao(p.motivo.slice(PREFIXO_DA_MISSAO_DO_CURSO.length))})`
        : `o instrutor não tem a habilitação que o recurso exige (${nomeDaHabilitacao(p.motivo)})`),
  'instrutor-ocupado': () => 'o instrutor já tem outro compromisso neste horário',
  bloqueio: () => 'o aluno não voa com este instrutor',
  'limite-da-lei': p => `o instrutor passaria do limite da lei (${LIMITE_DO_MOTIVO[p.motivo] || p.motivo})`,
  peso: () => 'o peso do aluno e do instrutor passa do limite do avião, mesmo com o mínimo de combustível'
};

// Os grupos dos conflitos de um voo (sem os códigos, o voo veio de uma escala gravada antes deles: pelo texto)
export function gruposDoConflito(voo) {
  if (Array.isArray(voo.conflitoCodigos) && voo.conflitoCodigos.length) return new Set(voo.conflitoCodigos.map(c => GRUPO_DO_CONFLITO[c]).filter(Boolean));
  const textos = voo.conflito || [];
  return new Set([
    ...(textos.some(c => /avião|sala/.test(c)) ? ['aviao'] : []),
    ...(textos.some(c => /instrutor/.test(c)) ? ['instrutor'] : []),
    ...(textos.some(c => /aluno/.test(c)) ? ['horario'] : [])
  ]);
}

// As regras que o motor segue sozinho e não confere nos voos fixos, quando o voo agendado na Escala está fora delas (o
// operador confirmou ao agendar): os horários de decolagem da missão, o pouso do voo de dia até as 17:30, o máximo de
// voos locais saindo no mesmo horário e o Ground antes do voo. Cada aviso tem a chave do voo (fKey) e o aluno (stuId).
// O limite de locais também é um código de rejeição: a escala gravada confere cada código na lista do tipo do alerta
export const CODIGOS_DO_AGENDADO = ['fora-dos-horarios', 'depois-das-17h30', 'limite-de-locais', 'antes-do-ground'];

// Os códigos dos avisos, para o resumo da Escala agrupar sem ler o texto: o peso que falta (stuId e insId dizem de
// quem), o instrutor perto do limite da lei (insId), o avião que para para a revisão, o atraso que invade outro voo, o
// voo que ficou sem o instrutor do “Priorizar com” do aluno e o do pedido cujo instrutor escolhido saiu do cadastro (stuId;
// insId: quem ficou com o voo), o repouso antes da volta do noturno (insId) e as regras que o voo agendado pulou
export const CODIGOS_DE_AVISO = ['sem-peso', 'perto-do-limite', 'revisao', 'atraso', 'voa-com', 'escolhido-saiu', 'repouso-do-noturno', ...CODIGOS_DO_AGENDADO];

// Os códigos das rejeições: por que o pedido ficou fora da escala, para dizer onde resolver
export const CODIGOS_DE_REJEICAO = [
  'equipamento-da-missao', 'ground-pendente', 'ground-antes-do-voo-fixo', 'so-parafuso', 'sem-aviao', 'sem-instrutor-habilitado',
  'disponibilidade-do-aluno', 'depois-do-ground', 'sem-horario', 'aluno-ocupado', 'avioes-ocupados', 'sala-ocupada', 'revisao',
  'instrutores-indisponiveis', 'instrutores-ocupados', 'bloqueio', 'limite-da-lei', 'peso', 'limite-de-locais', 'instrutor-escolhido',
  'habilitacao-do-aviao'
];
