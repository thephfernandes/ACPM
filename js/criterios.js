// Critérios da compactação da escala (fase 13), escolhidos pelo operador na Escala e guardados com o dia (a data
// seguinte continua com eles): o que pesa mais nos buracos do dia e até onde os horários dos voos podem mudar
export const OPCOES_DE_BURACOS = [
  ['inva', 'INVA', 'Menos tempo parado dos instrutores'],
  ['aviao', 'Avião', 'Menos tempo parado dos aviões e menos saídas do hangar'],
  ['maior', 'Maior buraco', 'Os maiores buracos primeiro, de instrutor ou de avião']
];
export const OPCOES_DE_HORARIOS = [
  ['disponibilidade', 'Na disponibilidade', 'O voo pode mudar de horário dentro da disponibilidade do aluno'],
  ['preferencias', 'Só 1ª e 2ª', 'O voo só muda entre a 1ª e a 2ª preferência do aluno'],
  ['fixos', 'Não mudar', 'Os horários ficam onde a escala pôs; só os instrutores podem trocar']
];
export const CRITERIOS_PADRAO = Object.freeze({ buracos: 'inva', horarios: 'disponibilidade' });

// Só os valores conhecidos; o resto volta ao padrão
export function normalizarCriterios(criterios) {
  const c = criterios && typeof criterios === 'object' ? criterios : {};
  const valido = (opcoes, v, padrao) => (opcoes.some(([id]) => id === v) ? v : padrao);
  return { buracos: valido(OPCOES_DE_BURACOS, c.buracos, CRITERIOS_PADRAO.buracos), horarios: valido(OPCOES_DE_HORARIOS, c.horarios, CRITERIOS_PADRAO.horarios) };
}
