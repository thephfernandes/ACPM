// O voo da escala: a chave (aluno_missão_1: um pedido é um voo só), o status em vigor e a unidade. Os alunos de uma
// turma de Ground têm uma linha cada, mas ocupam a sala e o instrutor uma vez só: a unidade é a turma.

export const CHAVE_DO_VOO = /^\d+_\d+_\d+$/;
export const chaveDoVoo = (stuId, mid) => `${stuId}_${mid}_1`;

// O status marcado no dia (fStatus) vale mais que o da linha da escala
export const statusDoVoo = (voo, fStatus) => (fStatus && fStatus[voo.fKey]) || voo.status || 'Confirmado';

export const unidadeDoVoo = voo => voo.classKey || voo.fKey;

// O intervalo que o voo ocupa (o instrutor, o aluno e o avião): o do próprio voo, ou maior na volta do noturno (eles
// passaram a noite em BH: ocupa desde o início do dia, e eles só ficam livres às 10:10, em livreAs). A lei conta o voo
export const ocupacaoDoVoo = (voo, a = voo.a, b = voo.b) => (voo.trecho === 'volta' && Number.isInteger(voo.livreAs) ? [0, Math.max(b, voo.livreAs)] : [a, b]);
// O compromisso do instrutor num voo da escala (js/viabilidade.js): o voo (a e b, para a lei) e o que ele ocupa (ocupaDe
// e ocupaAte, quando é mais que o voo). a e b: o intervalo efetivo (o atrasado), quando há
export function compromissoDoVoo(voo, a = voo.a, b = voo.b) {
  const [de, ate] = ocupacaoDoVoo(voo, a, b);
  return { a, b, voo: ['C152', 'C172', 'PA-34'].includes(voo.eqType), ...(de !== a || ate !== b ? { ocupaDe: de, ocupaAte: ate } : {}) };
}

// Uma linha por unidade (a última de cada), na ordem em que a unidade aparece
export const umPorUnidade = lista => [...new Map(lista.map(voo => [unidadeDoVoo(voo), voo])).values()];

// O pedido de um voo: o do próprio aluno (missão 0) ou uma das missões extras dele
export const pedidoDoAluno = (aluno, mid) => (mid ? (aluno.extra || []).find(ex => ex.mid === mid) : aluno);
// O pedido de cada voo da escala, pelos alunos do dia. A volta do noturno de ontem (o trecho "volta") não tem pedido no
// dia: ela leva o número do pedido de ontem, e o pedido de hoje com esse número é outro
export const pedidosDosVoos = alunos => {
  const porId = new Map(alunos.map(s => [s.id, s]));
  return voo => {
    if (voo.trecho === 'volta') return undefined;
    const aluno = porId.get(voo.stuId);
    return aluno && pedidoDoAluno(aluno, voo.mid);
  };
};

// O que a missão do curso dos pedidos de uma unidade (o voo; a turma de Ground: todos os alunos dela) exige do INVA (exige:
// derivado no estado da escala, js/programa.js), sem repetir; nada quando o pedido não exige
export const exigeDosVoos = alunos => {
  const pedido = pedidosDosVoos(alunos);
  return voos => [...new Set(voos.flatMap(v => { const d = pedido(v); return (d && Array.isArray(d.exige)) ? d.exige : []; }))];
};
