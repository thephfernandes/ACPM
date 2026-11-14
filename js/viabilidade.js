// Regras de viabilidade da escala (fase 10): o que torna possível pôr um voo num horário, num recurso e com um
// instrutor. O motor, a divisão das horas e a troca de matrículas usam as mesmas regras (antes repetidas em cada
// passo); a compactação, os limites legais e as sugestões de reparo também vão usar estas.
import { T, NI } from './config.js';

// Dois intervalos (em minutos) se sobrepõem quando um começa antes de o outro terminar; encostar não conta
export const sobrepoe = (a1, b1, a2, b2) => a1 < b2 && b1 > a2;

// Nenhum dos intervalos ocupados ([início, fim]) se sobrepõe ao voo
export const livre = (ocupados, a, b) => !(ocupados || []).some(([x, y]) => sobrepoe(a, b, x, y));

// O instrutor disponível durante todo o voo: em cada período do dia (as 9 janelas) que o voo toca
export const cobre = (aw, a, b) => T.every((inicio, k) => !sobrepoe(a, b, inicio, k < NI ? T[k + 1] : 1440) || aw[k]);

// Aluno + instrutor dentro do limite do avião. Sem o limite ou sem um dos pesos não há como conferir, e vale; na
// divisão das horas, o voo só passa para um instrutor com o peso informado (exigirPesoDoInstrutor)
export function pesoCabe(stuKg, insKg, limKg, { exigirPesoDoInstrutor = false } = {}) {
  if (!limKg || !stuKg) return true;
  if (!insKg) return !exigirPesoDoInstrutor;
  return stuKg + insKg <= limKg;
}

// O voo cabe no saldo de horas do avião até a revisão de 50 horas (sem o saldo informado, Infinity)
export const cabeNoSaldo = (horasNoDia, h, saldo) => horasNoDia + h <= saldo + 1e-9;
