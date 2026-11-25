// As frases que o Manual não diz mais e as que ele precisa dizer (app.spec.js, "o botão Manual abre…"), em um bloco por
// tela: o passo que muda uma tela muda o Manual dela e só o bloco dela aqui (A: Alunos; B: Recursos; C: Instrutores; D2:
// Pedidos; G1, G2: a Demanda; H: a Escala e Aprovar)

// Nada das regras e dos nomes antigos
const ANTIGAS = {
  geral: ['A01', 'A09', 'Gerar escala', 'Preencher exemplo', 'Link Blindado', 'Importar Solicitações da Agenda',
    'Vai voar?', 'Início pref', 'Exportar CSV', 'Emitir PDF', 'Turno rápido', 'Cada cartão', 'campo Data', 'Equipamento', 'Bloquear',
    'Sessões', 'sessão', 'Desfazer', 'Escala de Voo', 'Por avião e sala', 'Avião / sala', 'Aviões e salas', 'o botão ao lado de Alunos', 'As abas seguem a ordem de uso', 'ao lado do nome das abas', 'Use as setas ‹ ›', 'com um calendário'],
  // O "+" do mapa fica ao lado do nome da linha
  escala: ['no fim de cada linha'],
  // O Operador não muda os Cursos nem os limites da lei
  perfis: ['altera tudo e opera a escala'],
  // A coluna de quem vem é "Vem" (a data aberta não é sempre hoje); o filtro das habilitações tem várias marcas
  instrutores: ['o interruptor de quem vem', 'filtro por habilitação'],
  // O peso vem antes do curso em Alunos
  alunos: ['Nome, CANAC, curso e peso'],
  // Cursos mostra um curso de cada vez (sem "todos")
  cursos: ['mostra um curso só ou todos'],
  // Recursos em duas vistas (não mais em duas partes), com as categorias marcadas na barra
  recursos: ['A aba tem duas partes', 'Escolha uma categoria para ver só a frota dela', 'na Frota, em “Vale para todas as datas”',
    'Veja na aba Recursos se ele está ligado']
};

// Os nomes dos botões e das vistas, e as regras em vigor
const NOVAS = {
  casca: ['menu da conta'],
  escala: ['Atualizada às', 'Ver todos', 'Compartilhar', 'Por recurso',
    // O agendamento na Escala (mover e encaixar, as turmas, as alternativas, a prévia, os avisos), o voo agendado na
    // Demanda, as alterações dos cursos fora do Histórico e o peso aceito
    'Encaixar o voo', 'Mover o voo', 'Entrar na turma das', 'Horários livres', 'O que muda na escala', 'Agendar mesmo assim',
    'agendado 10:10 · PR-VOB', 'fora da regra', 'ao lado do nome de cada linha', 'não entram no Histórico da data', 'de 1 a 300 kg',
    // Acima do limite de voos locais do horário, todo voo local agendado pede a confirmação (não só o 7º)
    'mais de 6 voos locais no mesmo horário'],
  demanda: ['Pôr um aluno na demanda'],
  pedidos: ['Ainda não importado'],
  // A busca sem acentos, quantos aparecem e o "Limpar filtros"; a coluna Vem (a data aberta não é sempre hoje); o filtro
  // das habilitações, com várias marcas e a regra ("todas as marcadas")
  instrutores: ['Editar habilitações', 'sem os acentos', '12 de 40 instrutores', 'Limpar filtros', 'o interruptor Vem', 'Filtro das habilitações',
    'que têm todas as marcadas', 'Habilitações: Noturno + C172'],
  // Alunos com a barra de Instrutores: as colunas na mesma ordem, o filtro dos cursos (a regra "algum dos marcados"),
  // o link para a Demanda (o filtro dos cursos é um só nas duas telas) e o cartão do celular
  alunos: ['Não escalar com', 'Nome, CANAC, peso e curso', 'Filtro dos cursos', 'aparecem os alunos de algum dos marcados', 'Curso: PP ou PC',
    'Abrir a Demanda', 'aparecem os pedidos dos alunos de algum dos cursos marcados', 'O filtro dos cursos é um só nas duas telas',
    'um cartão por pessoa'],
  // Recursos: as duas vistas, a busca pela matrícula, o filtro das categorias (a regra "alguma das marcadas") e o hangar
  // sem filtros; o cadastro da frota e os horários de decolagem
  recursos: ['Disponibilidade do dia', 'Novo recurso', 'Retirar', 'Horários de decolagem', 'de 30 em 30 minutos', 'divide as horas do dia',
    'em Disponibilidade do dia, desligue', 'abre o Cadastro com o formulário', 'Buscar matrícula', '3 de 26 recursos',
    'os recursos de alguma das marcadas', 'Categoria: C152 ou PA-34', 'Filtro das categorias',
    'nunca para a ordem no hangar', 'cujo botão mostra o mesmo número', 'Veja em Recursos, na Disponibilidade do dia, se ele está ligado'],
  // Cursos: um de cada vez, o índice das fases, as fases recolhidas e os alunos por fase
  cursos: ['um curso de cada vez', 'índice das fases', 'Recolher todas', 'Abrir todas', 'agrupados pela fase em que estão']
};

export const FRASES_QUE_SAIRAM = Object.values(ANTIGAS).flat();
export const FRASES_DO_MANUAL = Object.values(NOVAS).flat();
