// Os candidatos para um voo num horário: os recursos (o avião, o simulador ou a sala de Ground) e os instrutores, cada
// um com o que o impede de servir, na ordem de preferência. A ocupação vem da escala do dia (os outros voos): as
// Sugestões para um conflito (js/reparo.js) contam todos os que ficam, cada um no horário marcado. As regras são as do
// motor, cada uma no lugar dela: os requisitos do voo e os atributos do avião (js/frota.js), as do instrutor
// (js/viabilidade.js) e o que cada voo ocupa (js/voo.js).
import { GROUND_EQ_TYPE, GROUND_REG } from './config.js';
import { FROTA_INICIAL, motivoDoAviao, recursoDaFrota, instrutorVoaNoAviao, habilitacaoQueFalta } from './frota.js';
import { sobrepoe, cabeNoSaldo, folgaAte, saldoAteARevisao, problemasDoInstrutor } from './viabilidade.js';
import { reducaoNecessaria } from './combustivel.js';
import { normalizarLimites } from './limites.js';
import { normalizarHangar, posicaoNoHangar } from './hangar.js';
import { historicoDoDia } from './noturno.js';
import { intervaloEfetivo } from './status.js';
import { statusDoVoo, unidadeDoVoo, ocupacaoDoVoo, compromissoDoVoo } from './voo.js';
import { agrupar, menorPrimeiro, soma } from './util.js';
import { inativoNoEstado } from './inativos.js';

const frotaDo = estado => (Array.isArray(estado.frota) ? estado.frota : FROTA_INICIAL);
// O intervalo que cada voo da escala ocupa: o do voo, ou mais na volta do noturno, que ocupa o instrutor, o aluno e o
// avião desde o início do dia até as 10:10 (ocupacaoDoVoo)
const intervalos = voos => voos.map(o => ocupacaoDoVoo(o));
// O primeiro dos voos que ocupa algo de [a, b) (encostar não conta)
const oQueOcupa = (voos, a, b) => voos.find(o => sobrepoe(a, b, ...ocupacaoDoVoo(o)));
const horas = voos => soma(voos.map(o => o.h));

// Uma linha por unidade, a primeira de cada na ordem da lista, com as unidades na ordem em que aparecem
const primeiraDaUnidade = lista => {
  const vistas = new Set();
  return lista.filter(o => !vistas.has(unidadeDoVoo(o)) && vistas.add(unidadeDoVoo(o)));
};

// A ocupação do dia pelos voos da escala: por recurso e por instrutor, uma vez por unidade (a turma de Ground ocupa a
// sala e o instrutor uma vez só), e por aluno, cada um com os voos dele (Maps). O voo cancelado não ocupa nada.
// exceto: as chaves dos voos que não contam (o voo que vai mudar, ou a turma dele); efetivo: o voo atrasado ocupa o
// horário novo (sem ele, o marcado); soFixos: só os voos fixos (os outros, o motor encaixa de novo em volta). A turma
// ocupa a sala e o instrutor pelo primeiro aluno dela na lista que não foi cancelado, como no motor (o primeiro que ele
// confere): com atrasos diferentes na turma, quem precisa do intervalo do motor passa os voos na ordem dele
// (js/rejeicoes.js, naOrdemDoMotor)
export function ocupacaoDaEscala(out, { fStatus = {}, fObs = {}, efetivo = false, exceto = [], soFixos = false } = {}) {
  const fora = new Set(exceto);
  const voos = out.filter(o => !fora.has(o.fKey) && (!soFixos || o.fixo) && statusDoVoo(o, fStatus) !== 'Cancelado')
    .map(o => {
      if (!efetivo) return o;
      const { a, b } = intervaloEfetivo(o, statusDoVoo(o, fStatus), (fObs || {})[o.fKey]);
      return a === o.a ? o : { ...o, a, b };
    });
  const porUnidade = grupos => new Map([...grupos].map(([chave, lista]) => [chave, primeiraDaUnidade(lista)]));
  return {
    recursos: porUnidade(agrupar(voos, o => o.r)),
    instrutores: porUnidade(agrupar(voos, o => o.insId)),
    alunos: agrupar(voos, o => o.stuId)
  };
}

// O que impede o recurso r de receber o voo [a, b), ou null: o avião em manutenção (a sala de Ground não entra), outro
// voo nele no mesmo horário (o problema traz o primeiro que se sobrepõe) ou a revisão de 50 horas
export function problemaDoRecurso(estado, ocupacao, r, { a, b, ground = false }) {
  if (!ground && !estado.av[r]) return { codigo: 'aviao-indisponivel' };
  const voos = ocupacao.recursos.get(r) || [];
  const voo = oQueOcupa(voos, a, b);
  if (voo) return { codigo: ground ? 'sala-ocupada' : 'aviao-ocupado', voo };
  if (!cabeNoSaldo(horas(voos), (b - a) / 60, saldoAteARevisao(estado.horas, r))) return { codigo: 'revisao' };
  return null;
}

// O que impede o aluno de voar em [a, b), ou null: outro voo dele no mesmo horário (o problema traz o primeiro que se
// sobrepõe)
export function problemaDoAluno(ocupacao, stuId, { a, b }) {
  const voo = oQueOcupa(ocupacao.alunos.get(stuId) || [], a, b);
  return voo ? { codigo: 'aluno-ocupado', voo } : null;
}

// O que os atributos do avião impedem, ou null: o voo a que ele não serve (so-parafuso, so-vfr) e, com o instrutor, a
// habilitação que o recurso exige e ele não tem, a primeira (o problema do instrutor, com o motivo, como no conflito do voo fixo)
function problemaDoAviao(recurso, voo, instrutor) {
  const motivo = motivoDoAviao(recurso, voo);
  if (motivo) return { codigo: motivo };
  return instrutor && !instrutorVoaNoAviao(instrutor, recurso) ? { codigo: 'habilitacao', motivo: habilitacaoQueFalta(instrutor, recurso) } : null;
}

// Os recursos do tipo para o voo [a, b) (no Ground, a sala), cada um com o problema (null quando serve) e a folga até o
// voo mais perto dele (Infinity no avião que ainda está no hangar). Os requisitos do voo (a missão, o tipo e o curso, a
// sigla do curso do aluno) decidem pelos atributos do avião: o Parafuso no C152 só voa nos aviões "Só Parafuso", e eles
// só no Parafuso (so-parafuso); o voo IFR, como o noturno do PC, só no avião homologado IFR (so-vfr). instrutor: só os
// aviões em que ele voa (o avião com habilitação própria exige a dele). Na ordem: os que servem; um que já saiu, com a
// menor folga, e depois o da frente do hangar
export function avioesQueServem(estado, ocupacao, { tipo, mis, curso, a, b, ground = false, instrutor = null }) {
  const frota = frotaDo(estado);
  const hangar = normalizarHangar(estado.hangar, frota);
  // O recurso inativo no cadastro não entra na lista (js/inativos.js)
  const doTipo = ground ? [GROUND_REG] : frota.filter(f => f.tipo === tipo && !inativoNoEstado(estado, f)).map(f => f.reg);
  return doTipo.map(r => ({
    r,
    problema: (!ground && problemaDoAviao(recursoDaFrota(frota, r), { mis, eq: tipo, curso }, instrutor)) || problemaDoRecurso(estado, ocupacao, r, { a, b, ground }),
    folga: folgaAte(intervalos(ocupacao.recursos.get(r) || []), a, b)
  })).sort((p, q) => Boolean(p.problema) - Boolean(q.problema) || menorPrimeiro(p.folga, q.folga)
    || posicaoNoHangar(hangar, p.r) - posicaoNoHangar(hangar, q.r));
}

// Os instrutores para o voo [a, b) com os alunos dele (o "Não escalar com" de cada um), o peso e o curso do aluno (o
// noturno do PC exige IFR), o recurso r, quando já se sabe qual (o avião com habilitação própria exige a dele), e o que a
// missão do curso do pedido exige do INVA (exige), cada um
// com os problemas (todos os de js/viabilidade.js; vazio quando serve) e a redução de combustível com ele (0 com o tanque
// cheio ou sem um dos pesos; Infinity quando nem o mínimo dá). Cada voo dele na escala é um compromisso (compromissoDoVoo:
// a lei conta o voo, e a volta do noturno o ocupa mais) e o histórico é o do dia (historicoDoDia: quem volta hoje do
// noturno de ontem não fica barrado pelo repouso, que é um aviso). Na ordem: os que servem; o tanque cheio primeiro,
// depois quem tem menos horas no dia e menos habilitações (os mais versáteis ficam livres)
export function instrutoresQueServem(estado, ocupacao, { mis, tipo, a, b, alunos = [], stuKg = 0, curso, r = null, exige = [] }) {
  const limites = normalizarLimites(estado.limites);
  const historicoDe = historicoDoDia(estado);
  const recurso = r && tipo !== GROUND_EQ_TYPE ? recursoDaFrota(frotaDo(estado), r) : null;
  const voosDo = x => ocupacao.instrutores.get(x.id) || [];
  const horasNoDia = new Map(estado.ins.map(x => [x, horas(voosDo(x))]));
  // O instrutor inativo no cadastro não entra na lista (js/inativos.js)
  return estado.ins.filter(x => !inativoNoEstado(estado, x)).map(x => ({
    x,
    problemas: problemasDoInstrutor(x, { mis, tipo, a, b, alunos, stuKg, curso, recurso, exige }, {
      compromissos: voosDo(x).map(o => compromissoDoVoo(o)), historico: historicoDe(x.id), limites, todos: true
    }),
    reducao: reducaoNecessaria({ stuKg, insKg: x.kg, tipo, minutos: b - a, mis })
  })).sort((p, q) => Boolean(p.problemas.length) - Boolean(q.problemas.length) || (p.reducao > 0) - (q.reducao > 0)
    || horasNoDia.get(p.x) - horasNoDia.get(q.x) || (p.x.hab || []).length - (q.x.hab || []).length || p.x.id - q.x.id);
}
