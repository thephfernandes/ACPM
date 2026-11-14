// A missão do curso no dia (fase 14): a próxima missão de cada aluno (para a Demanda), o progresso (para Alunos) e o
// resultado de cada voo (para a escala). Os resultados chegam com a data (S.resultados: a situação de cada missão e os
// registros da data) e não são gravados no dia.
import { MIS } from '../config.js';
import { normalizarCursos } from '../cursos.js';
import { situacaoPorMissao, proximaMissao, progresso, resultadoDoVoo } from '../resultados.js';
import { S, isGestor, stuBy, dadoIndisponivel } from '../state.js';
import { esc, opts, fmtDurLabel } from '../format.js';

const resultados = () => S.resultados || { situacao: [], doDia: [] };
const situacao = () => situacaoPorMissao(resultados().situacao);
const programa = () => normalizarCursos(S.cursos);

// A próxima missão para um pedido do aluno: a primeira do programa ainda não aprovada que ele não tem em outro pedido
// do dia
export function proximaDoPedido(stu, mid) {
  if (!stu.curso) return null;
  const exceto = [stu, ...(stu.extra || [])].filter(p => (p.mid || 0) !== (mid || 0) && p.fly && p.etapa).map(p => p.etapa);
  return proximaMissao(programa(), situacao(), stu.id, stu.curso, { exceto });
}

export const descricaoDaMissao = m => `${m.id}: ${m.nome} · ${m.mis} · ${MIS[m.mis].isGround ? '1h30' : fmtDurLabel(m.nb)}${MIS[m.mis].isGround ? '' : ` · ${m.eq}`}`;

// Na Demanda: o código do pedido, ou o botão com a próxima missão do programa
export function etapaNaDemanda(stu, d, mid) {
  if (d.etapa) return ` <span class="etapa" title="Missão do curso ${esc(stu.curso || '')}">${esc(d.etapa)}</span>`;
  const proxima = proximaDoPedido(stu, mid);
  return proxima
    ? ` <button type="button" class="btn quiet edit-only usar-proxima" data-act="usar-proxima" data-id="${esc(stu.id)}" data-mid="${esc(mid)}" title="${esc(descricaoDaMissao(proxima))}"${dadoIndisponivel('resultados') ? ' disabled' : ''}>Próxima: ${esc(proxima.id)} · Usar</button>`
    : '';
}

// Em Alunos: as aprovadas do programa e a próxima missão
export function progressoDoAluno(stu) {
  if (!stu.curso || !programa()[stu.curso].length) return '';
  const { aprovadas, total } = progresso(programa(), situacao(), stu.id, stu.curso);
  const proxima = proximaMissao(programa(), situacao(), stu.id, stu.curso);
  return `<small class="progresso" data-dica="progresso">${aprovadas}/${total}${proxima ? ` · próxima ${esc(proxima.id)}` : ' · concluído'}</small>`;
}

// Na escala, com o status do aluno: o código da missão do curso e o resultado (o operador registra; os outros veem)
export function resultadoNaEscala(o) {
  if (!o.etapa) return '';
  const registrado = resultadoDoVoo(resultados().doDia, o.fKey);
  const atual = ['aprovado', 'reprovado'].includes(registrado) ? registrado : 'pendente';
  const stu = stuBy(o.stuId);
  const codigo = `<span class="etapa" data-dica="missao-do-curso">${esc(o.etapa)}</span>`;
  if (isGestor() || !stu || !stu.curso) {
    return `<span class="resultado">${codigo}${atual !== 'pendente' ? ` <span class="res res-${atual}">${atual === 'aprovado' ? 'Aprovado' : 'Reprovado'}</span>` : ''}</span>`;
  }
  return `<span class="resultado">${codigo} <select class="res-sel res-${atual}" data-resultado="${esc(o.fKey)}" aria-label="Resultado de ${esc(o.s)} em ${esc(o.etapa)}" data-dica="resultado"${dadoIndisponivel('resultados') ? ' disabled' : ''}>${opts([['pendente', 'Resultado'], ['aprovado', 'Aprovado'], ['reprovado', 'Reprovado']], atual)}</select></span>`;
}
