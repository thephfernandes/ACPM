// Escala aprovada (fase 12): os voos fixos (horário, avião e instrutor de cada voo, pela chave aluno_missão_sessão) e
// quem aprovou. Os dados vêm do dia guardado ou do link compartilhado: só valem nos formatos certos.
const CHAVE_DO_VOO = /^\d+_\d+_\d+$/;
const MATRICULA = /^[A-Z0-9][A-Z0-9-]{1,14}$/;
const minuto = v => Number.isInteger(v) && v >= 0 && v <= 1440;

export function normalizarFixos(fixos) {
  const dados = fixos && typeof fixos === 'object' ? fixos : {};
  return Object.fromEntries(Object.entries(dados).flatMap(([fKey, p]) => {
    if (!CHAVE_DO_VOO.test(fKey) || !p || typeof p !== 'object') return [];
    if (!minuto(p.a) || !minuto(p.b) || p.b <= p.a || typeof p.r !== 'string' || !MATRICULA.test(p.r) || !Number.isInteger(p.insId)) return [];
    return [[fKey, { a: p.a, b: p.b, r: p.r, insId: p.insId, ...(typeof p.classKey === 'string' && p.classKey.length <= 80 ? { classKey: p.classKey } : {}) }]];
  }));
}

export function normalizarAprovacao(aprovacao) {
  if (!aprovacao || typeof aprovacao !== 'object' || typeof aprovacao.em !== 'string' || Number.isNaN(Date.parse(aprovacao.em))) return null;
  return { em: aprovacao.em, por: typeof aprovacao.por === 'string' ? aprovacao.por.slice(0, 80) : '' };
}

// O voo fixo como o motor o recebe: o horário, o avião e o instrutor (e a turma, no Ground)
export const pinoDoVoo = o => ({ a: o.a, b: o.b, r: o.r, insId: o.insId, ...(o.isGround ? { classKey: o.classKey } : {}) });
