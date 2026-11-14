// Estado da aplicação compartilhado entre os módulos. As variáveis são ligações vivas (ES modules):
// leia-as diretamente e use os setters para substituí-las.
import { ApiClient } from './storage.js';

export let S = ApiClient.createFreshState();
export let RES = null;
export let AUDIT_LOG = [];
export let BI_HISTORY = {};
export let TL_MODE = 'lista'; // visão da escala: 'lista', 'eq' (por recurso), 'ins' (por instrutor) ou 'painel' (o quadro do dia)
// Data (AAAA-MM-DD) da escala aberta na tela. O campo de data pode já mostrar outra enquanto ela carrega
// (ou ficar vazio): as alterações vão sempre para esta data
export let DATA = '';

export const setS = v => { S = v; };
export const setRES = v => { RES = v; };
export const setAuditLog = v => { AUDIT_LOG = v; };
export const setBIHistory = v => { BI_HISTORY = v; };
export const setTLMode = v => { TL_MODE = v; };
export const setData = v => { DATA = v; };

// O que não foi lido ao abrir a data (revisão de 14/11): 'horas' (dos instrutores) e 'resultados' (dos cursos)
export const dadoIndisponivel = parte => Boolean(S.indisponiveis && S.indisponiveis.includes(parte));
export const isGestor = () => ApiClient.readOnly || document.body.getAttribute('data-role') === 'gestor';

// Os voos da escala desta data que voam (revisão de 14/11): o cancelado não conta nos contadores das abas
export const voosQueVoam = () => ((RES && RES.out) || []).filter(o => ((S.fStatus || {})[o.fKey] || o.status) !== 'Cancelado');

export const insBy = id => S.ins.find(x => x.id === id);
export const stuBy = id => S.stu.find(x => x.id === id);

// Utilitário para acessar missão principal (mid = 0) ou missão extra (mid > 0) de um aluno
export function getMissionTarget(stuId, mid = 0) {
  const s = stuBy(stuId);
  if (!s) return null;
  if (!mid || mid === 0) return s;
  return (s.extra || []).find(ex => ex.mid === mid) || null;
}
