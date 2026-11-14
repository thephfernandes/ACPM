// Os conflitos de um voo fixo (revisão de 14/11). A cada cálculo, o motor confere de novo cada voo da escala aprovada
// com as mesmas regras de quando o escalou; o que não vale mais vira conflito, com um texto e um código. O grupo do
// código decide as sugestões de reparo: trocar o instrutor, trocar o avião (ou a sala), passar para outro horário, ou
// soltar o voo para o app escolher de novo (o pedido mudou).
export const GRUPO_DO_CONFLITO = {
  'instrutor-saiu': 'instrutor',
  'instrutor-indisponivel': 'instrutor',
  habilitacao: 'instrutor',
  'instrutor-ocupado': 'instrutor',
  bloqueio: 'instrutor',
  'limite-da-lei': 'instrutor',
  peso: 'instrutor',
  'tipo-de-aviao': 'aviao',
  'aviao-indisponivel': 'aviao',
  'aviao-ocupado': 'aviao',
  'so-parafuso': 'aviao',
  revisao: 'aviao',
  'sala-ocupada': 'aviao',
  'aluno-ocupado': 'horario',
  'horario-fechado': 'horario',
  disponibilidade: 'horario',
  duracao: 'pedido',
  'ground-ou-voo': 'pedido'
};
export const CODIGOS_DE_CONFLITO = Object.keys(GRUPO_DO_CONFLITO);

// O limite da lei que o voo passaria, como aparece no conflito
export const LIMITE_DO_MOTIVO = {
  'voo-dia': 'horas de voo no dia', jornada: 'jornada', mes: 'horas de voo no mês', semestre: 'horas de voo no semestre',
  ano: 'horas de voo no ano', repouso: 'repouso'
};

// Os grupos dos conflitos de um voo (sem os códigos, o voo veio de uma escala gravada antes deles: pelo texto)
export function gruposDoConflito(voo) {
  if (Array.isArray(voo.conflitoCodigos) && voo.conflitoCodigos.length) return new Set(voo.conflitoCodigos.map(c => GRUPO_DO_CONFLITO[c]).filter(Boolean));
  const textos = voo.conflito || [];
  return new Set([
    ...(textos.some(c => /avião|sala/.test(c)) ? ['aviao'] : []),
    ...(textos.some(c => /instrutor/.test(c)) ? ['instrutor'] : []),
    ...(textos.some(c => /aluno/.test(c)) ? ['horario'] : [])
  ]);
}
