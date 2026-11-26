// Configurações e constantes operacionais do CIAC/ACPM: janelas de instrução, frota, missões, limites de peso
// e turnos.

export const WIN = ['06:30','08:20','10:10','11:30','12:40','13:40','14:30','16:20','17:30'];
// O fim do dia, em minutos desde a meia-noite (os horários da escala vão de 0 a 1440)
export const MINUTOS_DO_DIA = 24 * 60;
export const NI = 8, DAY = [0,1,2,3,4,5,6,7];
export const T = WIN.map(w => w.split(':')[0] * 60 + +w.split(':')[1]);

// A frota com que o cadastro começa (js/frota.js); a escala usa a do cadastro, que o operador edita na aba Recursos
export const EQ = {
  'Sim. Mono': ['SIM-MONO-A','SIM-MONO-C'],
  'Sim. Multi': ['SIM-MLTE-E','SIM-MLTE-D'],
  'C152': 'PP-LJV PR-BTB PR-IGU PR-JPL PR-MLB PR-TBT PR-THI PR-VOB PR-VOC PR-VOI PR-VOP PR-VOW PR-VOZ'.split(' '),
  'C172': 'PP-ABP PP-AJS PR-BUL PR-CPL PR-HAR PR-VOY'.split(' '),
  'PA-34': ['PR-VOM','PT-JOB','PT-KIW']
};

export const GROUND_EQ_TYPE = 'Sala Ground';
export const GROUND_REG = 'SALA-GROUND';
export const GROUND_DURATION_MIN = 90;
export const GROUND_DURATION_H = 1.5;

export const SIM_EQ_TYPES = ['Sim. Mono', 'Sim. Multi'];
export const AIRCRAFT_EQ_TYPES = ['C152', 'C172', 'PA-34'];
export const ALL_EQ_TYPES = [...Object.keys(EQ), GROUND_EQ_TYPE];
export const ACROBAT_REG = 'PR-JPL'; // Exclusivo para missão de Parafuso
// Atributos dos aviões da frota inicial (js/frota.js): o PR-CPL não é homologado IFR (só voa VFR) e o PR-VOM exige do
// instrutor uma habilitação própria (a habilitação de multimotor não basta)
export const SO_VFR_INICIAL = ['PR-CPL'];
export const HABILITACAO_PROPRIA_INICIAL = ['PR-VOM'];
// A matrícula de um avião (PR-ABC) ou o código de um recurso (SALA-GROUND): letras, números e hífen
export const MATRICULA = /^[A-Z0-9][A-Z0-9-]{1,14}$/;

/**
 * Fases / Missões do CIAC (incluindo Ground School de 01h30 e Missões de Voo/Simulador). Quem pode ministrar cada
 * missão sai das habilitações individuais do instrutor (js/habilitacoes.js).
 * - Ground C152, Ground C172, Ground PA-34 e Ground Navegação: duração 01h30 em turma coletiva, precedendo
 *     obrigatoriamente o primeiro voo da respectiva temática no mesmo dia (ministrados pelo instrutor disponível
 *     com menos habilitações)
 * - Simulador: exclusivamente Sim. Mono ou Sim. Multi
 * - Missões de voo: realizadas exclusivamente em aeronaves (nunca em simuladores)
 * - IFR: exclusivamente C172 ou PA-34
 * - Noturno: exclusivamente C172
 * - Multimotor: exclusivamente PA-34
 * - TGL (TMA): treinamento de toque e arremetida na TMA
 * - Voos de cheque: PP e PC MNTE VFR (C152 ou C172), PC MNTE IFR (C172), PC MLTE VFR e IFR (PA-34), com o
 *     checador com as três marcas do cheque (o curso, o motor e as regras)
 */
// Cada missão: o equipamento padrão (defEq) e os permitidos (eq); regras: 'IFR' quando o voo é IFR (sem o campo, VFR);
// porCurso: as regras que mudam com o curso do aluno (as habilitações a mais do instrutor ficam no registro,
// js/habilitacoes.js); duracaoPadrao: as horas com que o pedido começa (sem o campo, 1 h). As regras do voo saem daqui
// (js/frota.js)
export const MIS = {
  'Ground C152':      { defEq: GROUND_EQ_TYPE, eq: [GROUND_EQ_TYPE], isGround: true, gatesEq: 'C152' },
  'Ground C172':      { defEq: GROUND_EQ_TYPE, eq: [GROUND_EQ_TYPE], isGround: true, gatesEq: 'C172' },
  'Ground PA-34':     { defEq: GROUND_EQ_TYPE, eq: [GROUND_EQ_TYPE], isGround: true, gatesEq: 'PA-34' },
  'Ground Navegação': { defEq: GROUND_EQ_TYPE, eq: [GROUND_EQ_TYPE], isGround: true, gatesMis: 'Navegação' },
  // A sessão de simulador tem 2 h por padrão (a duração que o pedido e a agenda começam)
  'Simulador':        { defEq: 'Sim. Mono',    eq: SIM_EQ_TYPES, duracaoPadrao: 2 },
  'Voo Local':        { defEq: 'C152',         eq: AIRCRAFT_EQ_TYPES },
  'TGL (TMA)':        { defEq: 'C152',         eq: AIRCRAFT_EQ_TYPES },
  'Navegação':        { defEq: 'C152',         eq: AIRCRAFT_EQ_TYPES },
  'Voo Solo':         { defEq: 'C152',         eq: AIRCRAFT_EQ_TYPES },
  'Parafuso':         { defEq: 'C152',         eq: AIRCRAFT_EQ_TYPES },
  'IFR':              { defEq: 'C172',         eq: ['C172', 'PA-34'], regras: 'IFR' },
  // O noturno do PP é VFR; o do PC é IFR: o avião homologado IFR e o instrutor com a habilitação IFR. A missão tem dois
  // dias (NOTURNO, abaixo): 4 h no dia (o translado e o noturno em BH) e a volta no dia seguinte
  'Noturno':          { defEq: 'C172',         eq: ['C172'], porCurso: { PC: { regras: 'IFR' } }, duracaoFixaH: 4 },
  'Multimotor':       { defEq: 'PA-34',        eq: ['PA-34'] },
  'Cheque PP':          { defEq: 'C152',  eq: ['C152', 'C172'] },
  'Cheque PC MNTE VFR': { defEq: 'C152',  eq: ['C152', 'C172'] },
  'Cheque PC MNTE IFR': { defEq: 'C172',  eq: ['C172'], regras: 'IFR' },
  'Cheque PC MLTE VFR': { defEq: 'PA-34', eq: ['PA-34'] },
  'Cheque PC MLTE IFR': { defEq: 'PA-34', eq: ['PA-34'], regras: 'IFR' }
};

// A missão noturna tem dois dias. No dia: sai de Pará de Minas às 17:30, 1 h de translado para Belo Horizonte (ida) e 3 h
// de voo noturno em BH (noite), um bloco só de 4 h. No dia seguinte: o translado de volta (volta), 1 h, decola de BH às
// 07:30; o instrutor, o aluno e o avião só ficam livres na escala às 10:10. Os ids dos trechos (ida, noite, volta) são os
// que o programa do curso usa (TSL-01, NOT, TSL-02)
export const NOTURNO = {
  trechos: { ida: { minutos: 60, nome: 'Translado Pará de Minas → Belo Horizonte' }, noite: { minutos: 180, nome: 'Noturno em Belo Horizonte' }, volta: { minutos: 60, nome: 'Translado Belo Horizonte → Pará de Minas' } },
  voltaInicio: 7 * 60 + 30,
  livreAs: 10 * 60 + 10
};

// Revisão obrigatória dos aviões a cada 50 horas de voo (o avião para quando não tem saldo para mais 1 h)
export const REVISAO_H = 50;
export const MENOR_VOO_H = 1;
// No máximo 6 voos locais (Voo Local, Voo Solo e TGL) saindo no mesmo horário: determinação da diretoria do aeroclube
export const MISSOES_LOCAIS = ['Voo Local', 'Voo Solo', 'TGL (TMA)'];
export const LIMITE_DE_VOOS_LOCAIS = 6;
// A duração de um voo da demanda: fracionada, em décimos de hora, até 5 h
export const DURACAO_MAXIMA_H = 5;

// Limites máximos de peso implícitos ao equipamento (fixos na regra operacional), aluno + instrutor com os tanques
// cheios
export const DEFAULT_LIM = { 'C152': 170, 'C172': 222, 'PA-34': 250 };

// Combustível: o tanque (galões americanos) e a autonomia com ele cheio. Acima do limite de peso, o avião
// pode sair com menos combustível (js/combustivel.js). 1 galão de gasolina de aviação = 6 lb = 2,72 kg
export const COMBUSTIVEL = { C152: { galoes: 26, autonomiaMin: 240 }, C172: { galoes: 53, autonomiaMin: 360 }, 'PA-34': { galoes: 93, autonomiaMin: 270 } };
export const KG_POR_GALAO = 6 * 0.45359237;
// Táxi e espera antes da decolagem (minutos de consumo além do voo)
export const TAXI_MIN = 10;

// Compactação da escala (js/compactar.js): o peso de cada parte no custo do dia, em minutos. INVA: o tempo
// parado dos instrutores vale mais; Avião: o tempo parado dos aviões e as saídas do hangar; Maior buraco: cada buraco
// (de instrutor ou de avião) vale o quadrado da duração dividido por 60 (1 h vale 60; 2 h, 240; 4 h, 960). A
// preferência perdida pesa igual nos três: a 2ª vale 30 e outro horário 60, vezes a prioridade do pedido sobre 3
export const PESOS_DA_COMPACTACAO = {
  inva: { invaParado: 1, aviaoParado: 0.1, saida: 10 },
  aviao: { invaParado: 0.1, aviaoParado: 1, saida: 60 },
  maior: { quadrado: 1 / 60 },
  preferencia: { p2: 30, outro: 60 }
};
// Até onde a busca vai (contagens, não tempo: a mesma escala dá sempre o mesmo resultado)
export const LIMITES_DA_COMPACTACAO = { movimentos: 200, verificacoes: 20000, avaliacoes: 200000 };

export const PRE = {
  'Dia inteiro': [0,1,2,3,4,5,6,7],
  'Manhã': [0,1,2,3],
  'Tarde': [4,5,6,7],
  'Noturno': [8],
  'Dia + noturno': [0,1,2,3,4,5,6,7,8]
};

// Status do voo, na ordem do dia; Atrasado leva o novo horário e Cancelado, o motivo (js/status.js)
// "Pousou": o fim do voo; no Ground e no simulador aparece como "Concluída" (js/status.js)
export const FLIGHT_STATUSES = ['Pendente', 'Confirmado', 'Atrasado', 'Em Voo', 'Pousou', 'Cancelado'];
