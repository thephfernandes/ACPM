// Rodízio justo nas escalas que remuneram melhor (o instrutor recebe por hora voada): uma fila por categoria de voo
// entre os instrutores habilitados. O motor oferece cada voo da categoria na ordem da fila; quem voou na categoria
// vai para o fim da fila dela na data seguinte. As filas guardadas são as do início de cada data.
import { podeFazer, podeAlgumCheque, ehCheque, habilitadoNoTipo } from './habilitacoes.js';

// Em ordem de peso na remuneração: cada voo conta na primeira categoria que se aplica
export const CATEGORIAS_DO_RODIZIO = [
  { id: 'cheque', nome: 'Voos de cheque', participa: podeAlgumCheque },
  { id: 'mlte', nome: 'Voo MLTE (PA-34)', participa: x => podeFazer(x, 'Multimotor', 'PA-34') },
  { id: 'noturno', nome: 'Voo noturno', participa: x => podeFazer(x, 'Noturno', 'C172') },
  { id: 'c172', nome: 'Voo C172', participa: x => habilitadoNoTipo(x, 'C172') }
];

export function categoriaDoRodizio(mis, eq) {
  if (ehCheque(mis)) return 'cheque';
  if (eq === 'PA-34') return 'mlte';
  if (mis === 'Noturno') return 'noturno';
  if (eq === 'C172') return 'c172';
  return null;
}

// Filas só com os habilitados: mantém a ordem guardada, tira quem não está mais no cadastro (ou perdeu a
// habilitação) e põe no fim, na ordem do cadastro, quem passou a ser habilitado
export function ajustarFilas(filas, instrutores) {
  const guardadas = filas && typeof filas === 'object' ? filas : {};
  return Object.fromEntries(CATEGORIAS_DO_RODIZIO.map(({ id, participa }) => {
    const habilitados = instrutores.filter(participa).map(x => x.id);
    const fila = Array.isArray(guardadas[id]) ? guardadas[id].filter(x => habilitados.includes(x)) : [];
    return [id, [...new Set(fila), ...habilitados.filter(x => !fila.includes(x))]];
  }));
}

// Filas no início da data seguinte: quem voou na categoria (sem contar voo cancelado) vai para o fim, na mesma ordem
export function filasDoDiaSeguinte(dia, instrutores) {
  const filas = ajustarFilas(dia.filas, instrutores);
  const out = dia.resultado && Array.isArray(dia.resultado.out) ? dia.resultado.out : [];
  const status = dia.fStatus || {};
  for (const { id } of CATEGORIAS_DO_RODIZIO) {
    const voaram = new Set(out
      // A volta do noturno (o trecho do dia seguinte) não conta de novo: o noturno contou no dia dele
      .filter(o => !o.trecho && categoriaDoRodizio(o.mis, o.eqType) === id && (status[o.fKey] || o.status) !== 'Cancelado')
      .map(o => o.insId));
    filas[id] = [...filas[id].filter(x => !voaram.has(x)), ...filas[id].filter(x => voaram.has(x))];
  }
  return filas;
}
