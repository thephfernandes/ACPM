// Habilitações individuais dos instrutores. No aeroclube as funções não são cumulativas: há instrutor
// de C172 que não dá simulador e instrutor de PA-34 que não faz parafuso. Cada instrutor tem a lista do que pode
// fazer; uma missão exige a habilitação da missão e, no C152, no C172 e no PA-34, também a do avião. O voo pode exigir
// mais: pelo curso do aluno (o Noturno do PC exige IFR) e pelo próprio recurso, que exige do instrutor a lista "exige"
// (ids deste registro; a habilitação própria do PR-VOM é "aviao:PR-VOM", que aparece na grade quando o recurso a exige).
// Este registro não importa a frota: a frota (js/frota.js) é que lê dele
import { MATRICULA } from './config.js';

// Ordem da grade na aba Instrutores (curto: rótulo da grade; nome: o nome completo, na dica e nas mensagens)
export const HABILITACOES = [
  { id: 'grounds', nome: 'Grounds (C152, C172 e Navegação)', curto: 'Grounds C152/C172/Nav.' },
  { id: 'ground_pa34', nome: 'Ground (PA-34)', curto: 'Ground PA-34' },
  { id: 'sim_mono', nome: 'Simulador (Mono)', curto: 'Sim. Mono' },
  { id: 'sim_multi', nome: 'Simulador (Multi)', curto: 'Sim. Multi' },
  { id: 'tgl', nome: 'TGL (TMA)', curto: 'TGL (TMA)' },
  { id: 'local', nome: 'Voo Local', curto: 'Local' },
  { id: 'navegacao', nome: 'Voo de Navegação', curto: 'Navegação' },
  // O voo de navegação de 150 NM ou mais e o endosso do solo (formato 27): ninguém começa com elas, e só uma missão do curso
  // as exige (marcadas em Cursos); a Navegação e a Liberação de Solo continuam com as missões delas
  { id: 'navegacao_150', nome: 'Voo de Navegação ≥ 150 NM', curto: 'Nav. ≥ 150 NM' },
  { id: 'solo', nome: 'Voo para liberação de Solo', curto: 'Liberação de Solo' },
  { id: 'endosso_solo', nome: 'Endosso Solo', curto: 'Endosso Solo' },
  { id: 'parafuso', nome: 'Voo de Parafuso (SPIN)', curto: 'Parafuso (SPIN)' },
  { id: 'ifr', nome: 'Voo IFR', curto: 'IFR' },
  { id: 'noturno', nome: 'Voo Noturno', curto: 'Noturno' },
  { id: 'c152', nome: 'C152', curto: 'C152' },
  { id: 'c172', nome: 'C172', curto: 'C172' },
  { id: 'mlte', nome: 'MLTE (PA-34)', curto: 'MLTE (PA-34)' },
  // O checador é credenciado por partes: o curso, o motor e as regras do voo
  { id: 'checa_pp', nome: 'Checador do curso PP', curto: 'Checador PP' },
  { id: 'checa_pc', nome: 'Checador do curso PC', curto: 'Checador PC' },
  { id: 'checa_inva', nome: 'Checador do curso INVA', curto: 'Checador INVA' },
  { id: 'checa_mnte', nome: 'Checador MNTE', curto: 'Checador MNTE' },
  { id: 'checa_mlte', nome: 'Checador MLTE', curto: 'Checador MLTE' },
  { id: 'checa_vfr', nome: 'Checador VFR', curto: 'Checador VFR' },
  { id: 'checa_ifr', nome: 'Checador IFR', curto: 'Checador IFR' }
];
const ORDEM = new Map(HABILITACOES.map((h, i) => [h.id, i]));

// Os grupos do painel "Editar habilitações" e do filtro das habilitações, na ordem da tela. O voo de cheque exige uma marca
// de cada grupo do checador (o "?" do primeiro explica)
export const GRUPOS_DE_HABILITACAO = [
  { id: 'ground-e-simulador', titulo: 'Ground e simulador', ids: ['grounds', 'ground_pa34', 'sim_mono', 'sim_multi'] },
  { id: 'voo', titulo: 'Voo', ids: ['tgl', 'local', 'navegacao', 'navegacao_150', 'solo', 'endosso_solo', 'parafuso', 'ifr', 'noturno'] },
  { id: 'avioes', titulo: 'Aviões', ids: ['c152', 'c172', 'mlte'] },
  { id: 'checador-curso', titulo: 'Checador: curso', ids: ['checa_pp', 'checa_pc', 'checa_inva'], dica: 'checador' },
  { id: 'checador-motor', titulo: 'Checador: motor', ids: ['checa_mnte', 'checa_mlte'] },
  { id: 'checador-regras', titulo: 'Checador: regras', ids: ['checa_vfr', 'checa_ifr'] }
];
const NOME = new Map(HABILITACOES.map(h => [h.id, h.nome]));
// A habilitação própria de um recurso: "aviao:PR-VOM"
export const PREFIXO_DA_HABILITACAO_DO_AVIAO = 'aviao:';
export const habilitacaoDoAviao = reg => `${PREFIXO_DA_HABILITACAO_DO_AVIAO}${reg}`;
const ehDoAviao = id => typeof id === 'string' && id.startsWith(PREFIXO_DA_HABILITACAO_DO_AVIAO) && MATRICULA.test(id.slice(PREFIXO_DA_HABILITACAO_DO_AVIAO.length));
export const nomeDaHabilitacao = id => NOME.get(id) || (ehDoAviao(id) ? `Avião ${id.slice(PREFIXO_DA_HABILITACAO_DO_AVIAO.length)}` : id);

// Lista válida: só habilitações conhecidas, sem repetição, na ordem da grade
// (as habilitações próprias dos recursos vêm depois, na ordem das matrículas)
const posicao = h => (ORDEM.has(h) ? ORDEM.get(h) : HABILITACOES.length);
export const normalizarHabilitacoes = lista =>
  (Array.isArray(lista) ? [...new Set(lista.filter(h => ORDEM.has(h) || ehDoAviao(h)))] : [])
    .sort((a, b) => posicao(a) - posicao(b) || (a < b ? -1 : a > b ? 1 : 0));

// O que um recurso exige do instrutor (formato 26): a lista exige; o recurso sem a lista, de antes do 26 (os de uma
// reversão do histórico, os estados dos testes), com a habilitação própria marcada: a dele
export function exigenciasDoRecurso(recurso) {
  if (!recurso || typeof recurso !== 'object') return [];
  if (Array.isArray(recurso.exige)) return recurso.exige;
  return recurso.habilitacaoPropria === true && typeof recurso.reg === 'string' ? [habilitacaoDoAviao(recurso.reg)] : [];
}

// O grupo das habilitações próprias que os recursos exigem (uma para cada, como o PR-VOM), na ordem da frota, para o painel
// das habilitações e o filtro: também as dos recursos inativos (o par continua quando ele volta)
export function gruposDosRecursos(frota) {
  const ids = [...new Set((Array.isArray(frota) ? frota : []).flatMap(exigenciasDoRecurso).filter(ehDoAviao))];
  return ids.length ? [{ id: 'habilitacao-propria', titulo: 'Habilitação própria do recurso', ids, dica: 'habilitacao-propria' }] : [];
}

// O que cada tipo de missão, cada tipo de recurso, cada cheque e o curso do aluno exigem do instrutor: listas de ids deste
// registro, lidas só por exigencias() (são código; o que um recurso exige é dado, a lista exige). Cada id da lista é um
// grupo de uma habilitação só (todas são exigidas)
// O tipo de missão (o simulador depende do equipamento)
const DA_MISSAO = {
  'Ground C152': ['grounds'],
  'Ground C172': ['grounds'],
  'Ground Navegação': ['grounds'],
  'Ground PA-34': ['ground_pa34'],
  'Voo Local': ['local'],
  'TGL (TMA)': ['tgl'],
  'Navegação': ['navegacao'],
  'Voo Solo': ['solo'],
  'Parafuso': ['parafuso'],
  'IFR': ['ifr'],
  'Noturno': ['noturno'],
  'Multimotor': ['mlte']
};
const DO_SIMULADOR = { 'Sim. Mono': ['sim_mono'], 'Sim. Multi': ['sim_multi'] };
// Sem o tipo na lista: o simulador exige o Mono, a missão, o Voo Local
const DO_SIMULADOR_PADRAO = DO_SIMULADOR['Sim. Mono'], DA_MISSAO_PADRAO = DA_MISSAO['Voo Local'];

// Voos de cheque: o checador precisa das três marcas do cheque (o curso, o motor e as regras), em qualquer avião permitido
const CHEQUES = {
  'Cheque PP': ['checa_pp', 'checa_mnte', 'checa_vfr'],
  'Cheque PC MNTE VFR': ['checa_pc', 'checa_mnte', 'checa_vfr'],
  'Cheque PC MNTE IFR': ['checa_pc', 'checa_mnte', 'checa_ifr'],
  'Cheque PC MLTE VFR': ['checa_pc', 'checa_mlte', 'checa_vfr'],
  'Cheque PC MLTE IFR': ['checa_pc', 'checa_mlte', 'checa_ifr']
};
export const ehCheque = mis => Object.hasOwn(CHEQUES, mis);
// Até o formato 19, três habilitações de checador; cada uma vira as marcas que davam exatamente os mesmos cheques
// (o INVA, que estava no nome de todas, também)
const CHECADOR_ANTIGO = {
  checador_vfr: ['checa_pp', 'checa_pc', 'checa_inva', 'checa_mnte', 'checa_vfr'],
  checador_ifr: ['checa_pp', 'checa_pc', 'checa_inva', 'checa_mnte', 'checa_vfr', 'checa_ifr'],
  checador_mlte: ['checa_pp', 'checa_pc', 'checa_inva', 'checa_mnte', 'checa_mlte', 'checa_vfr', 'checa_ifr']
};
export const marcasDoChecadorAntigo = hab => [...new Set(hab.flatMap(h => (Object.hasOwn(CHECADOR_ANTIGO, h) ? CHECADOR_ANTIGO[h] : [h])))];
// O tipo de recurso: o avião exige a habilitação dele (na migração para o formato 19, todo instrutor do cadastro recebe a
// do C152)
const DO_AVIAO = { 'C152': ['c152'], 'C172': ['c172'], 'PA-34': ['mlte'] };
// O curso do aluno, por tipo de missão: o Noturno do PC exige IFR (as regras do voo, IFR, ficam em MIS[mis].porCurso)
const DO_CURSO = { 'Noturno': { PC: ['ifr'] } };

// Só as chaves do próprio mapa (nomes como "constructor" ou "toString" não contam)
const doMapa = (mapa, chave, padrao) => (Object.hasOwn(mapa, chave) ? mapa[chave] : padrao);

// Exigências da missão no equipamento: todos os grupos, e em cada grupo basta uma das habilitações. Com o contexto do
// voo, também as do curso do aluno (o Noturno do PC exige IFR), as que o recurso exige (recurso.exige) e as que a missão
// do curso do pedido exige (exige: missoes_do_curso.exige, que o estado da escala deriva; js/programa.js)
export function exigencias(mis, eq, { curso, recurso, exige } = {}) {
  const grupos = ehCheque(mis) ? CHEQUES[mis].map(h => [h])
    : (mis === 'Simulador' ? doMapa(DO_SIMULADOR, eq, DO_SIMULADOR_PADRAO) : doMapa(DA_MISSAO, mis, DA_MISSAO_PADRAO)).map(h => [h]);
  if (!ehCheque(mis)) for (const h of doMapa(DO_AVIAO, eq, [])) if (!grupos.some(g => g.includes(h))) grupos.push([h]);
  const doCurso = typeof curso === 'string' && Object.hasOwn(DO_CURSO, mis) ? doMapa(DO_CURSO[mis], curso, []) : [];
  const daMissaoDoCurso = Array.isArray(exige) ? exige.filter(h => typeof h === 'string') : [];
  for (const h of [...doCurso, ...exigenciasDoRecurso(recurso), ...daMissaoDoCurso]) if (!grupos.some(g => g.length === 1 && g[0] === h)) grupos.push([h]);
  return grupos;
}

// O instrutor tem o que o tipo de recurso exige (a fila do C172 no rodízio)
export const habilitadoNoTipo = (instrutor, tipo) => doMapa(DO_AVIAO, tipo, []).every(h => Array.isArray(instrutor.hab) && instrutor.hab.includes(h));

// contexto: { curso, recurso, exige } do voo (sem ele, só a missão e o tipo)
export const podeFazer = (instrutor, mis, eq, contexto) => {
  const hab = Array.isArray(instrutor.hab) ? instrutor.hab : [];
  return exigencias(mis, eq, contexto).every(grupo => grupo.some(h => hab.includes(h)));
};

// Quem pode dar ao menos um dos voos de cheque (a fila do rodízio dos cheques)
export const podeAlgumCheque = instrutor => Object.keys(CHEQUES).some(mis => podeFazer(instrutor, mis));

// O motivo da habilitação que falta quando ela é da missão do curso: "missao-do-curso:endosso_solo"
export const PREFIXO_DA_MISSAO_DO_CURSO = 'missao-do-curso:';
// A primeira habilitação que a missão do curso exige (exige) e o instrutor não tem, ou null
export const faltaDaMissaoDoCurso = (instrutor, exige) => (Array.isArray(exige) ? exige.find(h => !(Array.isArray(instrutor.hab) && instrutor.hab.includes(h))) || null : null);

export const descreverExigencias = (mis, eq, contexto) => exigencias(mis, eq, contexto).map(g => g.map(nomeDaHabilitacao).join(' ou ')).join(' + ');

// Migração dos níveis cumulativos A01–A09: o instrutor recebe exatamente o que o nível permitia
// (checadores não existiam: começam desmarcados; Endosso Solo e Nav. ≥ 150 NM nunca vêm de um nível)
const POR_NIVEL = [
  [1, ['grounds', 'ground_pa34', 'local', 'c152']],
  [2, ['sim_mono', 'sim_multi']],
  [3, ['tgl']],
  [4, ['navegacao']],
  [5, ['solo']],
  [6, ['parafuso']],
  [7, ['noturno', 'c172']],
  [8, ['ifr']],
  [9, ['mlte']]
];
export const habilitacoesDoNivel = lv => {
  const nivel = Number.isInteger(lv) && lv >= 1 && lv <= 9 ? lv : 1;
  return normalizarHabilitacoes(POR_NIVEL.filter(([n]) => nivel >= n).flatMap(([, h]) => h));
};
