// Combustível e peso (fase 10). O limite de peso de cada avião (aluno + instrutor, js/config.js) vale com os tanques
// cheios. Acima dele, o avião pode sair com menos combustível, desde que o que fica dê o voo, o táxi e a reserva: 30
// minutos de dia; 45 à noite e em IFR (RBAC 91.151 e 91.167). Tudo arredonda para o lado seguro: a redução e o mínimo
// para cima, a autonomia para baixo. Sem um dos pesos, ou num tipo sem limite, não há o que conferir.
import { DEFAULT_LIM, COMBUSTIVEL, KG_POR_GALAO, TAXI_MIN } from './config.js';

export const reservaDaMissao = mis => (mis === 'Noturno' || /IFR/.test(mis || '') ? 45 : 30);

export function pesoECombustivel({ stuKg, insKg, tipo, minutos, mis }) {
  const limKg = DEFAULT_LIM[tipo] || 0;
  const kg = stuKg && insKg ? stuKg + insKg : 0;
  const tanque = COMBUSTIVEL[tipo];
  if (!limKg || !kg || kg <= limKg || !tanque) return { cabe: !limKg || !kg || kg <= limKg, kg, limKg, reduzirGal: 0 };
  const porMinuto = tanque.galoes / tanque.autonomiaMin;
  const reduzirGal = Math.ceil((kg - limKg) / KG_POR_GALAO - 1e-9);
  const abastecerGal = tanque.galoes - reduzirGal;
  const minimoGal = Math.ceil((minutos + TAXI_MIN + reservaDaMissao(mis)) * porMinuto - 1e-9);
  return { cabe: abastecerGal >= minimoGal, kg, limKg, reduzirGal, abastecerGal, minimoGal, autonomiaMin: Math.max(0, Math.floor(abastecerGal / porMinuto + 1e-9)) };
}

// A redução de combustível que o par precisa (0 com o tanque cheio; Infinity quando nem o mínimo resolve)
export function reducaoNecessaria(dados) {
  const r = pesoECombustivel(dados);
  return r.cabe ? r.reduzirGal : Infinity;
}

// O combustível do voo quando ele precisa sair com menos (o peso passa do limite com o tanque cheio): { comb } ou {}
export function combustivelDoVoo(stuKg, insKg, tipo, minutos, mis) {
  const { reduzirGal, abastecerGal, minimoGal, autonomiaMin } = pesoECombustivel({ stuKg, insKg, tipo, minutos, mis });
  return reduzirGal ? { comb: { reduzirGal, abastecerGal, minimoGal, autonomiaMin } } : {};
}
