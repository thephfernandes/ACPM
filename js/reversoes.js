// As reversões do histórico (revisão de 14/11). O que "Reverter" desfaz vem gravado no histórico (no servidor, por
// quem tem conta de operador), então só vale no formato que o próprio app produz: a reversão fora dele não vira botão
// nem é aplicada. Um recurso retirado volta pela mesma validação do "+ Novo recurso".
import { novoRecurso } from './frota.js';
import { normalizarFixos } from './fixos.js';

const MATRICULA = /^[A-Z0-9][A-Z0-9-]{1,14}$/;
const idValido = v => Number.isInteger(v) && v > 0;
const rotulo = v => (typeof v === 'string' && v.length <= 40 ? v : '↶ Reverter');

// A reversão limpa (só os campos dela), ou null
export function validarReversao(rev, frota) {
  if (!rev || typeof rev !== 'object' || Array.isArray(rev)) return null;
  const label = rotulo(rev.label);
  if (rev.kind === 'setFly') {
    const mid = rev.mid === undefined ? 0 : rev.mid;
    return idValido(rev.stuId) && Number.isInteger(mid) && mid >= 0 && typeof rev.val === 'boolean' ? { kind: 'setFly', stuId: rev.stuId, mid, val: rev.val, label } : null;
  }
  if (rev.kind === 'setAv') {
    return typeof rev.reg === 'string' && MATRICULA.test(rev.reg) && typeof rev.val === 'boolean' ? { kind: 'setAv', reg: rev.reg, val: rev.val, label } : null;
  }
  if (rev.kind === 'setInsOn') return idValido(rev.insId) && typeof rev.val === 'boolean' ? { kind: 'setInsOn', insId: rev.insId, val: rev.val, label } : null;
  if (rev.kind === 'restaurarFixos') {
    const fixos = rev.fixos && typeof rev.fixos === 'object' ? normalizarFixos(rev.fixos) : {};
    return Object.keys(fixos).length ? { kind: 'restaurarFixos', fixos, label } : null;
  }
  if (rev.kind === 'readicionarRecurso') {
    const { recurso } = novoRecurso(frota, rev.recurso && typeof rev.recurso === 'object' ? rev.recurso : {});
    return recurso ? { kind: 'readicionarRecurso', recurso, av: rev.av !== false, label } : null;
  }
  return null;
}
