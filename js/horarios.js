// Horários de decolagem por categoria (fase 7). Cada categoria (C152, C172, Simulador e PA-34) tem a sua lista, em
// minutos, editada na aba Recursos; o padrão são as 8 janelas diurnas, e o PA-34 sai de 30 em 30 minutos. O voo
// noturno sai sempre às 17:30, e o Ground, nas janelas do dia. As 9 janelas viram os períodos do dia: a janela de
// operação fechada fecha os horários que caem nela, e a disponibilidade dos instrutores e "manhã, tarde e noite"
// valem por período.
import { T, NI, DAY } from './config.js';
import { categoriaDoTipo } from './categorias.js';

export const HORARIOS_PADRAO = DAY.map(w => T[w]);
export const DE_30_EM_30 = Array.from({ length: 21 }, (_, i) => 390 + 30 * i);

export const HORARIOS_INICIAIS = { C152: [...HORARIOS_PADRAO], C172: [...HORARIOS_PADRAO], sim: [...HORARIOS_PADRAO], 'PA-34': DE_30_EM_30 };
export const CATEGORIAS_COM_HORARIOS = Object.keys(HORARIOS_INICIAIS);

// Só horários do dia (06:00 às 17:00), em ordem e sem repetir; a categoria sem lista válida recebe a inicial
const PRIMEIRO = 6 * 60, ULTIMO = 17 * 60;
export function normalizarHorarios(horarios) {
  const dados = horarios && typeof horarios === 'object' ? horarios : {};
  return Object.fromEntries(CATEGORIAS_COM_HORARIOS.map(cat => {
    const lista = Array.isArray(dados[cat])
      ? [...new Set(dados[cat].filter(m => Number.isInteger(m) && m >= PRIMEIRO && m <= ULTIMO))].sort((a, b) => a - b)
      : [];
    return [cat, lista.length ? lista : [...HORARIOS_INICIAIS[cat]]];
  }));
}

// A lista de um tipo (pela categoria); a sala de Ground (e um tipo sem categoria com lista) usa as janelas do dia.
// Sem os horários do cadastro, os iniciais (como no motor)
export function horariosDoTipo(horarios, tipo) {
  const lista = (horarios || HORARIOS_INICIAIS)[categoriaDoTipo(tipo)];
  return Array.isArray(lista) && lista.length ? lista : HORARIOS_PADRAO;
}

// Os horários de uma missão: o Noturno sai às 17:30; as demais, na lista do tipo pedido (o Ground, nas janelas do dia)
export const horariosDaMissao = (horarios, mis, tipo) => (mis === 'Noturno' ? [T[NI]] : horariosDoTipo(horarios, tipo));

// O período (janela de operação) em que um horário cai: a última janela que começa até ele
export function periodoDoMinuto(minuto) {
  let periodo = 0;
  T.forEach((inicio, i) => { if (minuto >= inicio) periodo = i; });
  return periodo;
}

// Preferências em minutos; o número da janela (0 a 8) dos dados anteriores ao formato 12 vira o horário da janela
export const minutoDaPreferencia = p => (!Number.isInteger(p) || p < 0 ? -1 : p <= NI ? T[p] : p);
// Uma preferência válida: um horário entre 06:00 e 17:30 (ou a janela antiga); o resto vira "sem preferência"
export function preferenciaValida(p) {
  const minuto = minutoDaPreferencia(p);
  return minuto >= PRIMEIRO && minuto <= T[NI] ? minuto : -1;
}

export function paraMinuto(texto) {
  const partes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(texto || '');
  return partes ? +partes[1] * 60 + +partes[2] : null;
}

// As preferências de um pedido novo: os primeiros horários da lista a partir das 08:20 e das 10:10
export function preferenciasPadrao(lista) {
  const aPartirDe = minuto => lista.find(m => m >= minuto) ?? lista[lista.length - 1];
  return [aPartirDe(T[1]), aPartirDe(T[2])];
}

// Depois de trocar a missão ou o avião de um pedido: cada preferência vai para o horário mais próximo da lista nova,
// a partir dela (ao sair das 17:30 do Noturno, para as preferências padrão), e um horário exato que a lista nova não
// tem deixa de valer
export function ajustarPreferencias(pedido, lista) {
  const [padrao1, padrao2] = preferenciasPadrao(lista);
  const ajustar = (minuto, padrao) => {
    if (!Number.isInteger(minuto) || minuto < 0 || lista.includes(minuto)) return minuto;
    if (minuto === T[NI]) return padrao;
    return lista.find(m => m >= minuto) ?? lista[lista.length - 1];
  };
  pedido.p1 = ajustar(pedido.p1, padrao1);
  pedido.p2 = ajustar(pedido.p2, padrao2);
  if (typeof pedido.jan === 'string' && /^h\d+$/.test(pedido.jan) && !lista.includes(+pedido.jan.slice(1))) delete pedido.jan;
}


// A ordem dos horários a tentar (revisão de 14/11, decisão do Pedro): a 1ª e a 2ª preferência, depois os outros pela
// distância da 1ª (sem ela, da 2ª), o mais cedo no empate; sem preferência, em ordem. Só os horários da lista
export function ordenarPelaPreferencia(lista, p1, p2) {
  const ancora = p1 >= 0 ? p1 : p2 >= 0 ? p2 : null;
  const resto = ancora === null ? [...lista] : [...lista].sort((a, b) => Math.abs(a - ancora) - Math.abs(b - ancora) || a - b);
  return [...new Set([p1, p2, ...resto])].filter(m => lista.includes(m));
}
