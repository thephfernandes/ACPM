// A escala gravada de uma data, ao abrir (revisão de 14/11). Quem tem uma conta de operador consegue gravar qualquer
// coisa pela API; a tela só usa a escala gravada quando cada linha tem os campos que o motor produz, nos formatos dele.
// Uma linha adulterada invalida a escala gravada inteira (a tela usa a escala calculada de novo, que é gravada na
// próxima alteração). Os campos desconhecidos saem.
import { ALL_EQ_TYPES, MIS, FLIGHT_STATUSES, NI } from './config.js';
import { codigoValido } from './cursos.js';

const CHAVE_DO_VOO = /^\d+_\d+_\d+$/;
// A chave da turma de Ground: GND_<missão>_<período>_<instrutor> (com um número no fim quando repete)
const CHAVE_DA_TURMA = /^GND_[A-Za-zÀ-ÿ0-9 .()-]{1,40}_\d+_\d+(_\d+)?$/;
const MATRICULA = /^[A-Z0-9][A-Z0-9-]{1,14}$/;
const SESSAO = /^\d{1,2}\/\d{1,2}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ETIQUETAS = ['Pref. 1', 'Pref. 2', 'Próximo livre', 'Horário ajustado'];
const ETIQUETA_DA_TURMA = /^(Pref\. 1|Pref\. 2|Próximo livre|Horário ajustado) · Turma \(\d{1,3}\)$/;
const TIPOS_DE_ALERTA = ['err', 'warn', 'conf'];

const inteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const numero = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const texto = (v, max) => typeof v === 'string' && v.length <= max;
const objeto = v => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const CAMPOS_DO_COMBUSTIVEL = { reduzirGal: [1, 200], abastecerGal: [0, 200], minimoGal: [0, 200], autonomiaMin: [0, 1000] };
const combustivel = v => objeto(v) && Object.entries(CAMPOS_DO_COMBUSTIVEL).every(([c, [min, max]]) => inteiro(v[c], min, max));

// Cada campo de uma linha e o formato dele
const CAMPOS = {
  fKey: v => typeof v === 'string' && CHAVE_DO_VOO.test(v),
  classKey: v => typeof v === 'string' && (CHAVE_DO_VOO.test(v) || CHAVE_DA_TURMA.test(v)),
  isGround: v => typeof v === 'boolean',
  w: v => inteiro(v, 0, NI),
  a: v => inteiro(v, 0, 1440),
  b: v => inteiro(v, 0, 1440),
  o: v => inteiro(v, 0, 100000),
  stuId: v => inteiro(v, 1, 1e9),
  mid: v => inteiro(v, 0, 1e9),
  insId: v => inteiro(v, 1, 1e9),
  eqType: v => ALL_EQ_TYPES.includes(v),
  s: v => texto(v, 200),
  ins: v => texto(v, 200),
  mis: v => typeof v === 'string' && Object.hasOwn(MIS, v),
  h: v => numero(v, 0, 24),
  ss: v => typeof v === 'string' && SESSAO.test(v),
  r: v => typeof v === 'string' && MATRICULA.test(v),
  stuKg: v => numero(v, 0, 1000),
  insKg: v => numero(v, 0, 1000),
  limKg: v => numero(v, 0, 1000),
  kg: v => numero(v, 0, 2000),
  comb: combustivel,
  baseTag: v => ETIQUETAS.includes(v),
  tag: v => typeof v === 'string' && (ETIQUETAS.includes(v) || ETIQUETA_DA_TURMA.test(v)),
  status: v => FLIGHT_STATUSES.includes(v),
  groupSize: v => inteiro(v, 1, 100),
  fixo: v => v === true,
  conflito: v => Array.isArray(v) && v.length <= 20 && v.every(m => texto(m, 200)),
  etapa: v => typeof v === 'string' && codigoValido(v)
};
// Só a chave do voo é obrigatória: os dias importados do BI antigo têm linhas com poucos campos
const OBRIGATORIOS = ['fKey'];

// Uma linha no formato do motor (só os campos conhecidos), ou null
export function normalizarLinhaGravada(o) {
  if (!objeto(o) || OBRIGATORIOS.some(c => !Object.hasOwn(o, c))) return null;
  const limpa = {};
  for (const [c, v] of Object.entries(o)) {
    if (!Object.hasOwn(CAMPOS, c) || v === undefined) continue;
    if (!CAMPOS[c](v)) return null;
    limpa[c] = c === 'comb' ? { ...v } : c === 'conflito' ? [...v] : v;
  }
  return limpa.a === undefined || limpa.b === undefined || limpa.a < limpa.b ? limpa : null;
}

function alerta(a) {
  if (!objeto(a) || !TIPOS_DE_ALERTA.includes(a.t) || !texto(a.s, 200) || !texto(a.m, 1000)) return null;
  if (a.fKey !== undefined && !CAMPOS.fKey(a.fKey)) return null;
  return { t: a.t, s: a.s, ...(a.fKey !== undefined ? { fKey: a.fKey } : {}), m: a.m };
}

function revisaoDoAviao(r) {
  if (!objeto(r) || !numero(r.inicio, 0, 100) || !numero(r.voadas, 0, 100) || !numero(r.fim, 0, 200)) return null;
  if (r.paraAs !== null && !inteiro(r.paraAs, 0, 1440)) return null;
  return { inicio: r.inicio, voadas: r.voadas, fim: r.fim, paraAs: r.paraAs };
}

// A escala gravada no formato do motor, ou null (sem escala gravada válida)
export function normalizarEscalaGravada(resultado) {
  if (!objeto(resultado) || !Array.isArray(resultado.out) || !Array.isArray(resultado.al)) return null;
  const out = resultado.out.map(normalizarLinhaGravada);
  const al = resultado.al.map(alerta);
  if (out.includes(null) || al.includes(null) || !inteiro(resultado.tot, 0, 100000)) return null;
  const revisao = {};
  if (resultado.revisao !== undefined) {
    if (!objeto(resultado.revisao)) return null;
    for (const [r, dados] of Object.entries(resultado.revisao)) {
      const limpa = MATRICULA.test(r) ? revisaoDoAviao(dados) : null;
      if (!limpa) return null;
      revisao[r] = limpa;
    }
  }
  if (resultado.data !== undefined && !(typeof resultado.data === 'string' && DATA.test(resultado.data))) return null;
  if (resultado.rej !== undefined && !inteiro(resultado.rej, 0, 100000)) return null;
  return {
    out, al, tot: resultado.tot, ...(resultado.rej !== undefined ? { rej: resultado.rej } : {}),
    ...(resultado.revisao !== undefined ? { revisao } : {}), ...(resultado.data !== undefined ? { data: resultado.data } : {})
  };
}
