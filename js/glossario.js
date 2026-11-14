// O glossário (revisão de 14/11): cada termo da tela numa frase curta, em texto puro. Vai para a dica (o balão que
// aparece com o mouse, o foco do teclado ou um toque; js/dicas.js) e para a seção Glossário do Manual. Os números das
// regras vêm da configuração, para o texto nunca contradizer o motor.
import { REVISAO_H, MENOR_VOO_H, GROUND_DURATION_MIN } from './config.js';
import { LIMITES_DA_LEI } from './limites.js';
import { INTERVALO_DO_HANGAR } from './metricas.js';
import { reservaDaMissao } from './combustivel.js';

// 570 → "9h30"; 660 → "11 h"
const duracao = min => (min % 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min / 60} h`);
const lei = LIMITES_DA_LEI;

export const ABAS_DO_GLOSSARIO = ['Escala', 'Critérios', 'Demanda', 'Agenda', 'Recursos', 'Instrutores', 'Alunos', 'Rodízio'];

export const GLOSSARIO = {
  // Escala
  'horario-livre': { aba: 'Escala', termo: 'Horário livre', texto: 'Sem vaga na 1ª nem na 2ª preferência, o voo foi para o horário livre mais perto da 1ª preferência (empatados, o mais cedo).' },
  'segunda-preferencia': { aba: 'Escala', termo: '2ª preferência', texto: 'O voo ficou na 2ª preferência do aluno: na 1ª não havia avião, instrutor ou horário livre.' },
  'horario-ajustado': { aba: 'Escala', termo: 'Horário ajustado', texto: 'A compactação mudou o horário para fechar um buraco do dia, dentro da regra de Horários escolhida nos critérios.' },
  conflito: { aba: 'Escala', termo: 'Conflito', texto: 'O voo da escala aprovada não vale mais: o instrutor, o avião, o horário ou o pedido mudou. Ele fica no lugar até ser resolvido em Sugestões.' },
  'voo-fixo': { aba: 'Escala', termo: 'Voo fixo (cadeado)', texto: 'O voo não muda quando a escala é refeita. Fica fixo pela escala aprovada ou pelo status Em Voo, Atrasado ou Cancelado.' },
  'reduzir-combustivel': {
    aba: 'Escala', termo: 'Reduzir combustível',
    texto: `Aluno e instrutor passam do limite de peso do avião com o tanque cheio: o avião sai com menos combustível, o bastante para o voo, o táxi e a reserva (${reservaDaMissao('Voo Local')} min; ${reservaDaMissao('Noturno')} à noite e em IFR).`
  },
  'sem-peso': { aba: 'Escala', termo: 'Sem peso', texto: 'Falta o peso do aluno ou do instrutor: a escala não conferiu o limite de peso do avião. Informe o peso em Alunos ou Instrutores.' },
  turma: { aba: 'Escala', termo: 'Turma', texto: `Alunos do mesmo Ground, no mesmo horário e com o mesmo instrutor: uma aula só, de ${duracao(GROUND_DURATION_MIN)}, na sala de Ground.` },
  'missao-do-curso': { aba: 'Escala', termo: 'Missão do curso', texto: 'O código da missão no programa do curso (por exemplo, PP-07): a próxima que o aluno ainda não aprovou.' },
  resultado: { aba: 'Escala', termo: 'Resultado', texto: 'Aprovado ou Reprovado na missão do curso. A reprovada volta a ser a próxima; Pendente desfaz um engano.' },
  status: { aba: 'Escala', termo: 'Status', texto: 'Pendente, Confirmado, Atrasado (pede a nova decolagem), Em Voo ou Cancelado (pede o motivo). Em Voo, Atrasado e Cancelado fixam o voo.' },
  'tempo-parado': {
    aba: 'Escala', termo: 'Tempo parado',
    texto: `O tempo entre um voo e o seguinte de cada instrutor e de cada avião, sem os cancelados. Parado ${INTERVALO_DO_HANGAR / 60} h ou mais, o avião volta para o hangar (uma saída).`
  },
  'aprovar-escala': { aba: 'Escala', termo: 'Aprovar escala', texto: 'Fixa todos os voos: depois disso, uma alteração não tira ninguém do lugar. O pedido novo entra em volta, e o voo impossível vira conflito.' },
  reabrir: { aba: 'Escala', termo: 'Reabrir', texto: 'Solta os voos (menos os em andamento) e a escala volta a ser refeita inteira a cada alteração.' },

  // Critérios da compactação
  buracos: { aba: 'Critérios', termo: 'Buracos', texto: 'O que a compactação diminui primeiro: o tempo parado dos instrutores (INVA), o dos aviões (Avião) ou os maiores buracos, de qualquer um.' },
  'criterio-inva': { aba: 'Critérios', termo: 'INVA', texto: 'INVA é o instrutor de voo. Neste critério, a compactação fecha primeiro o tempo parado dos instrutores entre um voo e o seguinte.' },
  'criterio-aviao': { aba: 'Critérios', termo: 'Avião', texto: 'A compactação fecha primeiro o tempo parado dos aviões e evita que o avião volte para o hangar no meio do dia.' },
  'criterio-maior': { aba: 'Critérios', termo: 'Maior buraco', texto: 'A compactação fecha primeiro os maiores buracos do dia, de instrutor ou de avião.' },
  horarios: { aba: 'Critérios', termo: 'Horários', texto: 'Até onde a compactação pode mudar o horário dos voos: dentro da disponibilidade do aluno, só entre a 1ª e a 2ª preferência, ou não mudar.' },
  'criterio-disponibilidade': { aba: 'Critérios', termo: 'Na disponibilidade', texto: 'O voo pode mudar de horário dentro da disponibilidade do aluno.' },
  'criterio-preferencias': { aba: 'Critérios', termo: 'Só 1ª e 2ª', texto: 'O voo só muda entre a 1ª e a 2ª preferência do aluno.' },
  'criterio-fixos': { aba: 'Critérios', termo: 'Não mudar', texto: 'Os horários ficam onde a escala pôs; só os instrutores podem trocar.' },
  'criterios-travados': { aba: 'Critérios', termo: 'Critérios travados', texto: 'Com a escala aprovada, os voos fixos não mudam: reabra a escala para mudar os critérios.' },

  // Demanda
  voa: { aba: 'Demanda', termo: 'Voa', texto: 'Marcado, o pedido entra na escala desta data. Desmarcado, o aluno continua na lista sem voar.' },
  preferencias: { aba: 'Demanda', termo: 'Preferências', texto: 'Os horários que o aluno prefere, entre os da categoria do avião. Sem vaga neles, a escala usa o horário livre mais perto da 1ª.' },
  disponibilidade: { aba: 'Demanda', termo: 'Disponibilidade', texto: 'Quando o aluno pode voar: manhã, tarde, noite ou um horário exato. O voo só começa dentro dela.' },
  duracao: { aba: 'Demanda', termo: 'Duração', texto: `As horas do voo, de uma vez. O Ground tem ${duracao(GROUND_DURATION_MIN)}. Para dois voos do aluno no mesmo dia, use “+ missão”.` },
  prioridade: { aba: 'Demanda', termo: 'Prioridade', texto: 'De 1 a 5: o pedido de prioridade maior é escalado antes e escolhe primeiro o horário, o avião e o instrutor.' },

  // Agenda
  excecao: { aba: 'Agenda', termo: 'Exceção da Coordenação', texto: 'Registra o pedido depois do prazo das 13:00 da véspera. O pedido fica marcado como exceção, para auditoria.' },

  // Recursos
  janelas: { aba: 'Recursos', termo: 'Janelas de operação', texto: 'Os períodos do dia em que a escola opera nesta data. Período fechado não recebe voo nem Ground.' },
  'horarios-de-decolagem': { aba: 'Recursos', termo: 'Horários de decolagem', texto: 'Os horários em que cada categoria pode decolar (o PA-34 tem os seus). Valem para todas as datas.' },
  'horas-desde-a-revisao': {
    aba: 'Recursos', termo: 'Horas desde a revisão',
    texto: `As horas que o avião voou desde a última revisão de ${REVISAO_H} horas, no início desta data. A data seguinte soma os voos que não foram cancelados.`
  },
  'saldo-da-revisao': {
    aba: 'Recursos', termo: `Saldo até ${REVISAO_H} h`,
    texto: `Quanto o avião ainda pode voar até a revisão. Sem saldo para um voo de ${MENOR_VOO_H} h, ele para e a escala avisa.`
  },
  hangar: { aba: 'Recursos', termo: 'Ordem no hangar', texto: 'Da frente para o fundo: entre aviões livres, o da frente sai primeiro.' },
  'so-parafuso': { aba: 'Recursos', termo: 'Só Parafuso', texto: 'Avião reservado para a missão de Parafuso no C152: as outras missões não usam ele, e o Parafuso só voa nele.' },

  // Instrutores
  'vem-nesta-data': { aba: 'Instrutores', termo: 'Hoje', texto: 'Marcado, o instrutor vem nesta data e pode ser escalado nos períodos marcados ao lado.' },
  'voos-do-instrutor': { aba: 'Instrutores', termo: 'Voos', texto: 'Voos e aulas do instrutor na escala desta data, sem os cancelados (a turma de Ground conta uma vez).' },
  'horas-do-mes': { aba: 'Instrutores', termo: 'Mês', texto: 'As horas de voo do instrutor no mês, com a escala desta data. A partir de 90% do limite da lei, a escala avisa.' },
  turno: { aba: 'Instrutores', termo: 'Turno', texto: 'Marca de uma vez os períodos do instrutor nesta data: manhã, tarde, noturno, o dia inteiro ou o dia mais o noturno.' },
  'fora-do-app': { aba: 'Instrutores', termo: 'Fora do app', texto: 'Horas de voo do instrutor em outro lugar (outra escola, por exemplo). Entram nos limites da lei do mês e do ano.' },
  'limites-da-lei': {
    aba: 'Instrutores', termo: 'Limites da lei',
    texto: `Por dia, ${duracao(lei.vooPorJornadaMin)} de voo e ${duracao(lei.jornadaMin)} de jornada; ${lei.vooMesH} h no mês e ${lei.vooAnoH} h no ano; ${duracao(lei.repousoMin)} de repouso entre um dia e outro (Lei 13.475/2017).`
  },

  // Alunos
  'nao-escalar-com': { aba: 'Alunos', termo: 'Não escalar com', texto: 'Instrutores que não voam com este aluno: a escala nunca põe o aluno com eles.' },
  progresso: { aba: 'Alunos', termo: 'Progresso', texto: 'Missões do curso aprovadas sobre o total do programa, e a próxima missão.' },

  // Rodízio
  rodizio: { aba: 'Rodízio', termo: 'Rodízio', texto: 'Os voos de cheque, MLTE, noturno e C172 seguem uma fila por categoria: vai o primeiro livre; quem voou vai para o fim na data seguinte.' }
};
