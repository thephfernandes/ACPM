// Limites dos instrutores pela Lei do Aeronauta (fase 11). A Lei 13.475/2017 vale para a instrução de voo (art. 5º, III)
// e o RBAC 117 (Apêndice A) a aplica às escolas do RBAC 141. Os números padrão são os da lei; o Administrador pode
// mudá-los (o acordo coletivo dos instrutores pode ter outros). As horas passadas saem das escalas gravadas (só voo em
// avião, sem os cancelados) e das horas de voo fora do app informadas no cadastro (horasExternas).
import { AIRCRAFT_EQ_TYPES } from './config.js';

export const LIMITES_DA_LEI = {
  vooPorJornadaMin: 570,  // 9h30 de voo numa jornada (tripulação mínima: Lei 13.475, art. 32, I; RBAC 117, A117.13)
  jornadaMin: 660,        // 11 h de jornada (art. 37, I; Tabela A.5)
  vooMesH: 100,           // horas de voo no mês, aviões a pistão (art. 33, III; Tabela A.3)
  vooSemestreH: null,     // a lei não tem limite semestral (o acordo coletivo pode ter)
  vooAnoH: 960,           // horas de voo no ano (art. 33, III)
  repousoMin: 720,        // 12 h de repouso depois de uma jornada de até 12 h (art. 48)
  apresentacaoMin: 30,    // a jornada começa 30 min antes do primeiro compromisso (art. 35)
  encerramentoMin: 30     // e termina 30 min depois do último corte dos motores (art. 35)
};

// Valores editados: número positivo vale; vazio (null) é sem limite; o resto volta ao padrão
export function normalizarLimites(limites) {
  const dados = limites && typeof limites === 'object' ? limites : {};
  return Object.fromEntries(Object.entries(LIMITES_DA_LEI).map(([chave, padrao]) => {
    const v = dados[chave];
    if (v === null && !['apresentacaoMin', 'encerramentoMin'].includes(chave)) return [chave, null];
    return [chave, typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : padrao];
  }));
}

const naoCancelado = (dia, o) => ((dia.fStatus || {})[o.fKey] || o.status) !== 'Cancelado';
const voosDoDia = dia => (dia && dia.resultado && Array.isArray(dia.resultado.out) ? dia.resultado.out : []).filter(o => o && naoCancelado(dia, o));

// As horas de voo do dia por instrutor: só avião (simulador e Ground não são voo), sem os cancelados
export function horasDeVooDoDia(dia) {
  const horas = {};
  for (const o of voosDoDia(dia)) {
    if (!AIRCRAFT_EQ_TYPES.includes(o.eqType)) continue;
    horas[o.insId] = Math.round(((horas[o.insId] || 0) + (+o.h || 0)) * 10) / 10;
  }
  return horas;
}

// O fim do último compromisso (voo, simulador ou Ground) de cada instrutor no dia, sem os cancelados
const fimDosCompromissos = dia => voosDoDia(dia).reduce((fins, o) => ({ ...fins, [o.insId]: Math.max(fins[o.insId] ?? 0, o.b) }), {});

const semestreDe = data => `${data.slice(0, 4)}-${+data.slice(5, 7) <= 6 ? 1 : 2}`;
const vespera = data => new Date(Date.parse(`${data}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
const somar = (registro, campo, horas) => { registro[campo] = Math.round((registro[campo] + horas) * 10) / 10; };

// As horas de voo de cada instrutor antes de uma data, no mês, no semestre e no ano dela (calendário), e o fim do último
// compromisso na véspera (para o repouso). dias: [{ data, conteudo }]
export function acumularHoras(dias, data) {
  const resultado = {};
  const de = id => (resultado[id] ||= { mes: 0, semestre: 0, ano: 0, fimAnterior: null });
  for (const { data: d, conteudo } of dias) {
    if (d >= data || d.slice(0, 4) !== data.slice(0, 4)) continue;
    for (const [id, horas] of Object.entries(horasDeVooDoDia(conteudo))) {
      somar(de(id), 'ano', horas);
      if (semestreDe(d) === semestreDe(data)) somar(de(id), 'semestre', horas);
      if (d.slice(0, 7) === data.slice(0, 7)) somar(de(id), 'mes', horas);
    }
  }
  const ontem = dias.find(d => d.data === vespera(data));
  if (ontem) Object.entries(fimDosCompromissos(ontem.conteudo)).forEach(([id, fim]) => { de(id).fimAnterior = fim; });
  return resultado;
}

// Somadas as horas de voo fora do app (cadastro: horasExternas['AAAA-MM'], e 'AAAA-00' para o ano antes deste mês)
export function comHorasExternas(acumulado, instrutores, data) {
  const ano = data.slice(0, 4), mes = data.slice(0, 7);
  const resultado = structuredClone(acumulado || {});
  for (const x of instrutores) {
    const externas = x.horasExternas && typeof x.horasExternas === 'object' ? x.horasExternas : {};
    for (const [quando, horas] of Object.entries(externas)) {
      if (quando.slice(0, 4) !== ano || typeof horas !== 'number' || !(horas > 0)) continue;
      const registro = (resultado[x.id] ||= { mes: 0, semestre: 0, ano: 0, fimAnterior: null });
      somar(registro, 'ano', horas);
      if (quando === mes) somar(registro, 'mes', horas);
      if (quando.slice(5) !== '00' && semestreDe(`${quando}-01`) === semestreDe(data)) somar(registro, 'semestre', horas);
    }
  }
  return resultado;
}

// A jornada do dia (minutos): do primeiro compromisso menos a apresentação ao último mais o encerramento. Depois das
// 18:00, a hora de trabalho vale 52m30s (art. 39): os minutos noturnos contam 60/52,5
const NOITE = 18 * 60, FATOR_NOTURNO = 60 / 52.5;
export function jornadaMin(intervalos, limites) {
  if (!intervalos.length) return 0;
  const inicio = Math.min(...intervalos.map(([a]) => a)) - limites.apresentacaoMin;
  const fim = Math.max(...intervalos.map(([, b]) => b)) + limites.encerramentoMin;
  const noturno = Math.max(0, fim - Math.max(inicio, NOITE));
  return fim - inicio - noturno + noturno * FATOR_NOTURNO;
}

// O compromisso novo cabe nos limites do instrutor? compromissos: os de hoje ({ a, b, voo }); historico: as horas antes
// de hoje no mês, no semestre e no ano e o fim do último compromisso de ontem. Devolve { ok } ou { ok: false, motivo }
export function dentroDosLimites({ compromissos, novo, historico, limites }) {
  const todos = [...compromissos, novo];
  const vooHojeMin = todos.filter(c => c.voo).reduce((total, c) => total + c.b - c.a, 0);
  const passa = (limite, valor) => limite !== null && valor > limite + 1e-9;
  if (passa(limites.vooPorJornadaMin, vooHojeMin)) return { ok: false, motivo: 'voo-dia' };
  if (passa(limites.jornadaMin, jornadaMin(todos.map(c => [c.a, c.b]), limites))) return { ok: false, motivo: 'jornada' };
  const vooHojeH = vooHojeMin / 60;
  const h = historico || { mes: 0, semestre: 0, ano: 0, fimAnterior: null };
  if (passa(limites.vooMesH, h.mes + vooHojeH)) return { ok: false, motivo: 'mes' };
  if (passa(limites.vooSemestreH, h.semestre + vooHojeH)) return { ok: false, motivo: 'semestre' };
  if (passa(limites.vooAnoH, h.ano + vooHojeH)) return { ok: false, motivo: 'ano' };
  if (limites.repousoMin !== null && h.fimAnterior !== null && h.fimAnterior !== undefined) {
    const repouso = 1440 - (h.fimAnterior + limites.encerramentoMin) + Math.min(...todos.map(c => c.a)) - limites.apresentacaoMin;
    if (repouso < limites.repousoMin) return { ok: false, motivo: 'repouso' };
  }
  return { ok: true };
}
