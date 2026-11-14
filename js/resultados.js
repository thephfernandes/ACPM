// Resultados das missões dos cursos (fase 14). O operador registra aprovado ou reprovado na linha do voo (pendente
// desfaz um engano); os registros só crescem, e a situação de cada missão é o último registro do aluno, curso e
// missão. A próxima missão do aluno é a primeira do programa ainda não aprovada (a reprovada volta); o progresso conta
// as aprovadas do programa. As regras do registro são as do servidor (supabase/migrations/…_resultados_de_missao.sql).
import { CURSOS, codigoValido } from './cursos.js';

export const RESULTADOS = ['aprovado', 'reprovado', 'pendente'];
const CHAVE_DO_VOO = /^\d+_\d+_\d+$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const chave = (aluno, curso, missao) => `${aluno}|${curso}|${missao}`;

// O último registro de cada aluno, curso e missão (a ordem dos registros é a ordem em que foram feitos)
export function situacaoPorMissao(registros) {
  const mapa = new Map();
  [...(registros || [])].sort((p, q) => (p.id || 0) - (q.id || 0)).forEach(r => mapa.set(chave(r.aluno, r.curso, r.missao), r));
  return mapa;
}
export const situacaoDa = (mapa, aluno, curso, missao) => {
  const r = mapa.get(chave(aluno, curso, missao));
  return r ? r.resultado : 'pendente';
};

// exceto: as missões que o aluno já tem no dia (a missão extra recebe a seguinte)
export function proximaMissao(programa, mapa, aluno, curso, { exceto = [] } = {}) {
  const missoes = (programa && curso && programa[curso]) || [];
  return missoes.find(m => situacaoDa(mapa, aluno, curso, m.id) !== 'aprovado' && !exceto.includes(m.id)) || null;
}

export function progresso(programa, mapa, aluno, curso) {
  const missoes = (programa && curso && programa[curso]) || [];
  return { aprovadas: missoes.filter(m => situacaoDa(mapa, aluno, curso, m.id) === 'aprovado').length, total: missoes.length };
}

// O resultado registrado para um voo da escala do dia (o último), ou null
export function resultadoDoVoo(registrosDoDia, voo) {
  const dele = (registrosDoDia || []).filter(r => r.voo === voo).sort((p, q) => (p.id || 0) - (q.id || 0));
  return dele.length ? dele.at(-1).resultado : null;
}

// O registro nos formatos do servidor (o código em maiúsculas); fora deles, o erro do servidor (23514)
export function validarRegistro({ aluno, curso, missao, resultado, data, voo = null }) {
  const codigo = typeof missao === 'string' ? missao.trim().toUpperCase() : '';
  const certo = Number.isInteger(aluno) && aluno > 0 && CURSOS.some(([c]) => c === curso) && codigoValido(codigo)
    && RESULTADOS.includes(resultado) && DATA.test(data || '') && (voo === null || CHAVE_DO_VOO.test(voo));
  if (!certo) throw Object.assign(new Error('resultado fora do formato'), { code: '23514' });
  return { aluno, curso, missao: codigo, resultado, data, voo };
}
