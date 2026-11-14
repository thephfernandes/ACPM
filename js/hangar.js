// Ordem dos aviões no hangar (fase 10), da frente para o fundo, em cada data: o operador ajusta em Recursos e a data
// seguinte começa com a mesma ordem. O motor tira primeiro os da frente e junta os voos nos aviões que já saíram, para
// não deixar avião parado no meio do dia nem tirar um do fundo. Simuladores e a sala de Ground não ficam no hangar.
import { AIRCRAFT_EQ_TYPES } from './config.js';

const avioesDaFrota = frota => frota.filter(f => AIRCRAFT_EQ_TYPES.includes(f.tipo)).map(f => f.reg);

// Só os aviões da frota, sem repetir; quem não está na lista entra no fundo, na ordem da frota
export function normalizarHangar(hangar, frota) {
  const avioes = avioesDaFrota(frota);
  const lista = (Array.isArray(hangar) ? hangar : []).filter((r, i, l) => avioes.includes(r) && l.indexOf(r) === i);
  return [...lista, ...avioes.filter(r => !lista.includes(r))];
}

// A posição de um avião (0 é a frente); fora da lista, no fim
export const posicaoNoHangar = (hangar, r) => { const i = hangar.indexOf(r); return i < 0 ? hangar.length : i; };

// Sobe, desce ou vai para a frente do hangar
export function moverNoHangar(hangar, r, para) {
  const antes = hangar.indexOf(r);
  if (antes < 0) return [...hangar];
  const resto = hangar.filter(x => x !== r);
  const depois = para === 'frente' ? 0 : Math.max(0, Math.min(resto.length, antes + (para === 'subir' ? -1 : 1)));
  resto.splice(depois, 0, r);
  return resto;
}
