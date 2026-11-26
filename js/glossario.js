// O glossário: cada termo da tela numa frase curta, em texto puro. Vai para a dica (o balão que aparece com o mouse, o
// foco do teclado ou um toque; js/dicas.js) e para a seção Glossário do Manual. Os números das regras vêm da
// configuração, para o texto nunca contradizer o motor. Um termo de uma funcionalidade que pode ficar desligada
// (js/funcionalidades.js) diz qual (funcionalidade) e, com ela desligada, some ou troca de texto (textoSem).
import { REVISAO_H, MENOR_VOO_H, GROUND_DURATION_MIN, LIMITE_DE_VOOS_LOCAIS, T, NI } from './config.js';
import { ligada } from './funcionalidades.js';
import { LIMITES_DA_LEI } from './limites.js';
import { INTERVALO_DO_HANGAR } from './metricas.js';
import { reservaDaMissao } from './combustivel.js';
import { duracaoHm, hm } from './format.js';

// 570 → "9h30"; 660 → "11 h"
const duracao = min => (min % 60 ? duracaoHm(min) : `${min / 60} h`);
const lei = LIMITES_DA_LEI;

// Um grupo por linha: cada passo do redesenho muda só a linha da tela dele
export const ABAS_DO_GLOSSARIO = [
  'Escala',
  'Critérios',
  'Demanda',
  'Agenda',
  'Recursos',
  'Instrutores',
  'Alunos',
  'Cursos',
  'Rodízio'
];

const TERMOS = {
  // Escala
  'horario-livre': { aba: 'Escala', termo: 'Horário livre', texto: 'Sem vaga na 1ª nem na 2ª preferência, o voo foi para o horário livre mais perto da 1ª preferência (empatados, o mais cedo).' },
  'segunda-preferencia': { aba: 'Escala', termo: '2ª preferência', texto: 'O voo ficou na 2ª preferência do aluno: na 1ª não havia avião, instrutor ou horário livre.' },
  'horario-ajustado': { aba: 'Escala', termo: 'Horário ajustado', texto: 'A compactação mudou o horário para fechar um buraco do dia, dentro da regra de Horários escolhida nos critérios.' },
  conflito: { aba: 'Escala', termo: 'Conflito', texto: 'O voo fixo não vale mais: o instrutor, o avião, o horário ou o pedido mudou, ou outro voo fixo já ocupa o lugar (o agendado na Escala cede o lugar aos outros fixos). Ele fica onde está até ser resolvido em Sugestões.' },
  'voo-fixo': { aba: 'Escala', termo: 'Voo fixo (cadeado)', texto: 'O voo não muda quando a escala é refeita. Fica fixo pelo agendamento na Escala, pela escala aprovada, pelo instrutor escolhido na Escala ou pelo status Atrasado, Em Voo, Pousou ou Cancelado.' },
  'voo-agendado': { aba: 'Escala', termo: 'Voo agendado', texto: 'Marcado pelo operador em “+ Agendar voo”: fica fixo no horário, no recurso e com o instrutor confirmados, e a escala é refeita em volta dele. O Histórico desfaz o agendamento.' },
  'fora-da-regra': {
    aba: 'Escala', termo: 'Fora da regra',
    texto: `O voo agendado na Escala está fora de uma regra que a escala segue sozinha: os horários de decolagem, o pouso do voo de dia até as ${hm(T[NI])}, no máximo ${LIMITE_DE_VOOS_LOCAIS} voos locais por horário ou o Ground antes do voo. Ele fica onde foi agendado.`
  },
  'reduzir-combustivel': {
    aba: 'Escala', termo: 'Reduzir combustível',
    texto: `Aluno e instrutor passam do limite de peso do avião com o tanque cheio: o avião sai com menos combustível, o bastante para o voo, o táxi e a reserva (${reservaDaMissao('Voo Local')} min; ${reservaDaMissao('Noturno')} à noite e em IFR).`
  },
  'sem-peso': { aba: 'Escala', termo: 'Sem peso', texto: 'Falta o peso do aluno ou do instrutor: a escala não conferiu o limite de peso do avião. Informe o peso em Alunos ou Instrutores.' },
  turma: { aba: 'Escala', termo: 'Turma', texto: `Alunos do mesmo Ground, no mesmo horário e com o mesmo instrutor: uma aula só, de ${duracao(GROUND_DURATION_MIN)}, na sala de Ground.` },
  'missao-do-curso': {
    aba: 'Escala', termo: 'Missão do curso', texto: 'O código da missão no programa do curso (por exemplo, PP-07): a próxima que o aluno ainda não aprovou.',
    funcionalidade: 'progresso', textoSem: 'O código da missão no programa do curso (por exemplo, PP-07).'
  },
  resultado: { funcionalidade: 'progresso', aba: 'Escala', termo: 'Resultado', texto: 'Aprovado ou Reprovado na missão do curso. A reprovada volta a ser a próxima; Pendente desfaz um engano.' },
  status: { aba: 'Escala', termo: 'Status', texto: 'Pendente, Confirmado, Atrasado (pede a nova decolagem), Em Voo, Pousou (no Ground e no simulador, Concluída) ou Cancelado (pede o motivo). Os quatro últimos fixam o voo.' },
  'tempo-parado': {
    aba: 'Escala', termo: 'Tempo parado',
    texto: `O tempo entre um voo e o seguinte de cada instrutor e de cada avião, sem os cancelados. Parado ${INTERVALO_DO_HANGAR / 60} h ou mais, o avião volta para o hangar (uma saída).`,
    funcionalidade: 'hangar',
    textoSem: `O tempo entre um voo e o seguinte de cada instrutor e de cada avião, sem os cancelados. Nos critérios INVA e Avião, a compactação evita mais a parada de avião de ${INTERVALO_DO_HANGAR / 60} h ou mais.`
  },
  'aprovar-escala': { aba: 'Escala', termo: 'Aprovar escala', texto: 'Fixa todos os voos: depois disso, uma alteração não tira ninguém do lugar. O pedido novo entra em volta, e o voo impossível vira conflito.' },
  reabrir: { aba: 'Escala', termo: 'Reabrir', texto: 'Solta os voos (menos os em andamento) e a escala volta a ser refeita inteira a cada alteração.' },
  'listas-do-painel': { aba: 'Escala', termo: 'Listas (painel)', texto: 'Na tela grande, duas listas lado a lado, com as mesmas colunas: a página começa na da esquerda e continua na da direita. Automático: duas a partir de 1.600 px de largura, quando cabem.' },
  'painel-missoes': { aba: 'Escala', termo: 'Missões (painel)', texto: 'O quadro do painel com os voos e aulas do dia, pelo horário, sem separar partidas e chegadas; o voo sai 30 minutos depois do fim, e a aula de Ground no fim. É o padrão do painel e da TV; Configurar painel muda o quadro e as colunas.' },
  metar: { aba: 'Escala', termo: 'METAR', texto: 'A observação meteorológica oficial do aeródromo, de hora em hora (o SPECI, quando o tempo muda). O pé do painel mostra a de Pampulha (SBBH) e a de Confins (SBCF), da REDEMET; a hora da observação, em Z, vem na mensagem.' },
  taf: { aba: 'Escala', termo: 'TAF', texto: 'A previsão oficial do aeródromo para as próximas horas. No painel, cada mudança (BECMG, TEMPO, PROB, FM) começa uma linha; sem TAF em vigor, a caixa avisa.' },

  // Critérios da compactação
  buracos: { aba: 'Critérios', termo: 'Buracos', texto: 'O que a compactação diminui primeiro: o tempo parado dos instrutores (INVA), o dos aviões (Avião) ou os maiores buracos, de qualquer um.' },
  'criterio-inva': { aba: 'Critérios', termo: 'INVA', texto: 'INVA é o instrutor de voo. Neste critério, a compactação fecha primeiro o tempo parado dos instrutores entre um voo e o seguinte.' },
  'criterio-aviao': {
    aba: 'Critérios', termo: 'Avião', texto: 'A compactação fecha primeiro o tempo parado dos aviões e evita que o avião volte para o hangar no meio do dia.',
    funcionalidade: 'hangar', textoSem: `A compactação fecha primeiro o tempo parado dos aviões e evita as paradas de ${INTERVALO_DO_HANGAR / 60} h ou mais no meio do dia.`
  },
  'criterio-maior': { aba: 'Critérios', termo: 'Maior buraco', texto: 'A compactação fecha primeiro os maiores buracos do dia, de instrutor ou de avião.' },
  horarios: { aba: 'Critérios', termo: 'Horários', texto: 'Até onde a compactação pode mudar o horário dos voos: dentro da disponibilidade do aluno, só entre a 1ª e a 2ª preferência, ou não mudar.' },
  'criterio-disponibilidade': { aba: 'Critérios', termo: 'Na disponibilidade', texto: 'O voo pode mudar de horário dentro da disponibilidade do aluno.' },
  'criterio-preferencias': { aba: 'Critérios', termo: 'Só 1ª e 2ª', texto: 'O voo só muda entre a 1ª e a 2ª preferência do aluno.' },
  'criterio-fixos': { aba: 'Critérios', termo: 'Não mudar', texto: 'Os horários ficam onde a escala pôs; só os instrutores podem trocar.' },
  'criterios-travados': { aba: 'Critérios', termo: 'Critérios travados', texto: 'Com a escala aprovada, os voos fixos não mudam: reabra a escala para mudar os critérios.' },

  // Demanda
  voa: { aba: 'Demanda', termo: 'Voa', texto: 'Marcado, o pedido entra na escala desta data. Desmarcado, o aluno continua na lista sem voar.' },
  preferencias: { aba: 'Demanda', termo: 'Preferências', texto: 'Os horários que o aluno prefere, entre os da categoria do avião. Sem vaga neles, a escala usa o horário livre mais perto da 1ª.' },
  'instrutor-escolhido': { aba: 'Demanda', termo: 'Instrutor', texto: 'Automático: o app escolhe. Um instrutor escolhido pelo operador vale mais: a escala põe o aluno com ele (o horário e o avião em volta dele) e não o troca.' },
  disponibilidade: { aba: 'Demanda', termo: 'Disponibilidade', texto: 'Quando o aluno pode voar: manhã, tarde, noite ou um horário exato. O voo só começa dentro dela.' },
  duracao: { aba: 'Demanda', termo: 'Duração', texto: `As horas do voo, de uma vez. O Ground tem ${duracao(GROUND_DURATION_MIN)}. Para dois voos do aluno no mesmo dia, use “+ missão”.` },
  prioridade: { aba: 'Demanda', termo: 'Prioridade', texto: 'De 1 a 5: o pedido de prioridade maior é escalado antes. Com a mesma prioridade, quem agendou primeiro vai antes; o pedido posto à mão, depois.' },
  'fora-da-ordem': { funcionalidade: 'progresso', aba: 'Demanda', termo: 'Fora da ordem', texto: 'A missão do curso que o programa ainda não libera (falta uma anterior ou a fase não abriu), a já aprovada, a dispensada ou a que o aluno já tem em outro voo do dia. Escolhê-la pede confirmação, e o histórico diz por quê.' },
  'curso-encerrado': { funcionalidade: 'progresso', aba: 'Demanda', termo: 'Curso encerrado', texto: 'O curso do aluno foi encerrado em Cursos. A próxima missão e as outras do curso continuam, mas cada uma pede confirmação, aqui e no agendamento, e o histórico diz que o curso estava encerrado.' },

  // Agenda
  'recurso-do-pedido': { aba: 'Agenda', termo: 'Recurso do pedido', texto: 'O tipo de avião, o simulador ou a sala que a missão permite, escolhido no pedido. Ele decide os horários (os de decolagem dele, em Recursos) e vai com o pedido para a demanda.' },
  excecao: { aba: 'Agenda', termo: 'Exceção da Coordenação', texto: 'Registra o pedido depois do prazo (13:00 da véspera; a segunda, sábado às 10:00). O pedido fica marcado como exceção, para auditoria.' },

  // Recursos
  'horario-em-janela-fechada': { aba: 'Recursos', termo: 'Horário apagado', texto: 'O horário cai numa janela de operação fechada nesta data: nesta data, nenhum voo sai nele. Ele continua na lista para as outras datas.' },
  janelas: { aba: 'Recursos', termo: 'Janelas de operação', texto: 'Os períodos do dia em que a escola opera nesta data (Recursos › Disponibilidade do dia). Período fechado não recebe voo nem Ground.' },
  'horarios-de-decolagem': { aba: 'Recursos', termo: 'Horários de decolagem', texto: 'Os horários em que cada categoria pode decolar (o PA-34 tem os seus). Valem para todas as datas e ficam em Recursos › Cadastro.' },
  'horas-disponiveis': {
    aba: 'Recursos', termo: 'Horas disponíveis',
    texto: `Quanto o avião ainda pode voar até a revisão de ${REVISAO_H} horas, no início desta data. Sem horas para um voo de ${MENOR_VOO_H} h, ele para e a escala avisa.`
  },
  'filtro-das-categorias': {
    aba: 'Recursos', termo: 'Filtro das categorias',
    texto: 'Mostra só os recursos de alguma das categorias marcadas, nas duas vistas: C152 e PA-34 mostram os dois. Nunca vale para a ordem no hangar. Sem nenhuma marcada, mostra todos.',
    funcionalidade: 'hangar',
    textoSem: 'Mostra só os recursos de alguma das categorias marcadas, nas duas vistas: C152 e PA-34 mostram os dois. Sem nenhuma marcada, mostra todos.'
  },
  hangar: { funcionalidade: 'hangar', aba: 'Recursos', termo: 'Ordem no hangar', texto: 'Da frente para o fundo, sempre com todos os aviões (Recursos › Disponibilidade do dia): entre aviões livres, o da frente sai primeiro.' },
  noturno: { aba: 'Escala', termo: 'Noturno', texto: 'Missão de dois dias: sai às 17:30 para BH (1 h de translado) e voa 3 h de noturno em BH; no dia seguinte, a volta decola de BH às 07:30, e o instrutor, o aluno e o avião ficam livres às 10:10.' },
  'so-vfr': { aba: 'Recursos', termo: 'Só VFR', texto: 'Avião não homologado IFR: voa as missões VFR, e nenhum voo IFR (IFR, cheques IFR, o noturno do PC) vai para ele. Marque na frota, em Recursos › Cadastro.' },
  'habilitacao-propria': { aba: 'Recursos', termo: 'Habilitação própria', texto: 'O que o próprio recurso exige do instrutor, além da habilitação do tipo: uma habilitação só dele (por exemplo, a do PR-VOM), marcada na frota, em Recursos › Cadastro. Marque-a no instrutor em Instrutores › Cadastro › Editar habilitações.' },
  'so-parafuso': { aba: 'Recursos', termo: 'Só Parafuso', texto: 'Avião reservado para a missão de Parafuso no C152: as outras missões não usam ele, e o Parafuso só voa nele. Marque na frota, em Recursos › Cadastro.' },

  // Instrutores
  'vem-nesta-data': { aba: 'Instrutores', termo: 'Vem', texto: 'Marcado, o instrutor vem nesta data (a aberta no topo, que nem sempre é hoje) e pode ser escalado nos períodos marcados ao lado.' },
  'voos-do-instrutor': { aba: 'Instrutores', termo: 'Voos', texto: 'Voos e aulas do instrutor na escala desta data, sem os cancelados (a turma de Ground conta uma vez).' },
  'horas-do-mes': { aba: 'Instrutores', termo: 'Mês', texto: 'As horas de voo do instrutor no mês, com a escala desta data. A partir de 90% do limite da lei, a escala avisa.' },
  checador: { aba: 'Instrutores', termo: 'Checador', texto: 'O voo de cheque exige três marcas do checador: o curso (PP ou PC), o motor (MNTE ou MLTE) e as regras (VFR ou IFR). O Cheque PC MLTE IFR, por exemplo, pede PC, MLTE e IFR.' },
  'filtro-das-habilitacoes': { aba: 'Instrutores', termo: 'Filtro das habilitações', texto: 'Mostra só os instrutores que têm todas as habilitações marcadas, nas duas vistas: Noturno e C172 mostram quem tem as duas. Sem nenhuma marcada, mostra todos.' },
  turno: { aba: 'Instrutores', termo: 'Turno', texto: 'Marca de uma vez os períodos do instrutor nesta data: manhã, tarde, noturno, o dia inteiro ou o dia mais o noturno.' },
  'fora-do-app': { aba: 'Instrutores', termo: 'Fora do app', texto: 'Horas de voo do instrutor em outro lugar (outra escola, por exemplo). Entram nos limites da lei do mês e do ano.' },
  'limites-da-lei': {
    aba: 'Instrutores', termo: 'Limites da lei',
    texto: `Por dia, ${duracao(lei.vooPorJornadaMin)} de voo e ${duracao(lei.jornadaMin)} de jornada; ${lei.vooMesH} h no mês e ${lei.vooAnoH} h no ano; ${duracao(lei.repousoMin)} de repouso entre um dia e outro (Lei 13.475/2017).`
  },

  // Alunos
  'voa-com': { aba: 'Alunos', termo: 'Priorizar com', texto: 'Os instrutores do aluno: a escala põe o aluno com um deles sempre que algum pode voar. Quando nenhum pode, o voo fica com outro instrutor, com aviso.' },
  'nao-escalar-com': { aba: 'Alunos', termo: 'Não escalar com', texto: 'Instrutores que não voam com este aluno: a escala nunca põe o aluno com eles.' },
  progresso: { funcionalidade: 'progresso', aba: 'Alunos', termo: 'Progresso', texto: 'Missões do curso aprovadas sobre o total do programa, a fase em que o aluno está (no curso com mais de uma) e a próxima missão.' },
  'filtro-dos-cursos': { aba: 'Alunos', termo: 'Filtro dos cursos', texto: 'Mostra só os alunos de algum dos cursos marcados, em Alunos e na Demanda (as marcas valem nas duas): PP e PC mostram os alunos dos dois. “Sem curso” mostra quem não tem curso; sem nenhum marcado, mostra todos.' },

  // Cursos
  'fase-do-curso': {
    aba: 'Cursos', termo: 'Fase do curso',
    texto: 'Um grupo de missões do programa. A fase abre depois das fases anteriores, desde o início do curso ou depois das fases escolhidas, e fica completa com todas as missões dela feitas.'
  },
  'alunos-na-fase': { funcionalidade: 'progresso', aba: 'Cursos', termo: 'Alunos na fase', texto: 'Os alunos do curso que estão nesta fase: a primeira fase aberta em que ainda falta missão para eles (a do progresso, em Alunos). Quem concluiu o curso não conta.' },
  'quando-voar': {
    aba: 'Cursos', termo: 'Quando voar',
    texto: 'Depois das anteriores: espera as anteriores da fase. Livre na fase: voa com a fase aberta; as seguintes não esperam por ela, mas a fase só fica completa com ela. Depois de: espera só as missões escolhidas, anteriores a ela.'
  },
  dispensada: {
    aba: 'Cursos', termo: 'Dispensada', texto: 'A missão vale como feita para todos os alunos do curso: não é sugerida e não entra no total do progresso.',
    funcionalidade: 'progresso', textoSem: 'A missão vale como feita para todos os alunos do curso.'
  },
  'trecho-do-noturno': {
    aba: 'Cursos', termo: 'Trecho do Noturno',
    texto: 'O Noturno é um voo só em três trechos: a ida para BH, a noite em BH e a volta no dia seguinte. No programa, as missões dos trechos vêm juntas na fase; a próxima missão oferece a noite, e o resultado dela vale para os três.',
    funcionalidade: 'progresso',
    textoSem: 'O Noturno é um voo só em três trechos: a ida para BH, a noite em BH e a volta no dia seguinte. No programa, as missões dos trechos vêm juntas na fase.'
  },

  // Rodízio
  rodizio: { aba: 'Rodízio', termo: 'Rodízio', texto: 'Os voos de cheque, MLTE, noturno e C172 seguem uma fila por categoria: vai o primeiro livre; quem voou vai para o fim na data seguinte.' }
};

// O glossário com as funcionalidades que estaLigada diz: o termo da desligada sai, ou troca o texto
export const montarGlossario = estaLigada => Object.fromEntries(Object.entries(TERMOS)
  .filter(([, t]) => !t.funcionalidade || t.textoSem || estaLigada(t.funcionalidade))
  .map(([id, { aba, termo, texto, funcionalidade, textoSem }]) => [id, { aba, termo, texto: funcionalidade && textoSem && !estaLigada(funcionalidade) ? textoSem : texto }]));

export const GLOSSARIO = montarGlossario(ligada);
