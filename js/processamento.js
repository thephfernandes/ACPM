// O processamento dos pedidos da agenda: a importação para a demanda da data (o botão "Importar da agenda", na Demanda e
// na Agenda; js/eventos/importacao.js). Puro: recebe o estado da data e os pedidos e muda só o estado
import { migrateLegacyMissionName, alvoDoNovoPedido } from './rules.js';
import { pedidoDaSolicitacao, recursoValido, missaoDoCursoGuardada } from './agenda.js';
import { indiceDoPrograma } from './programa.js';
import { proximasMissoes, missoesDoDia } from './progresso.js';
import { situacaoPorMissao, resultadoDoVoo } from './resultados.js';
import { chaveDoVoo } from './voo.js';
import { fixoPeloStatus } from './fixos.js';
import { inativo } from './inativos.js';

// O voo da mesma missão (mis) que está na demanda do aluno sem pedido da agenda (posto à mão: a demanda começa vazia a
// cada data): ele dá lugar ao pedido, para não duplicar. O voo fixo (agendado, aprovado ou com o instrutor escolhido na
// escala), o fixado pelo status (em andamento ou cancelado; também quando o cadeado saiu, como na aprovação com o Voa
// desligado) e o que já tem resultado na data ficam como estão. Com a missão do curso do pedido (vinculada: { codigo,
// sigla }), o voo com outra missão do curso também fica (o pedido entra como outro voo); o sem missão do curso dá lugar.
// Nenhum: null
function vooQueDaLugar(estado, aluno, mis, vinculada = null) {
  const doDia = estado.resultados ? estado.resultados.doDia : [];
  const mesmaMissaoDoCurso = p => !vinculada || !p.etapa || (p.etapa === vinculada.codigo && (p.cursoDaEtapa || aluno.curso) === vinculada.sigla);
  return [aluno, ...(aluno.extra || [])].find(p => {
    const chave = chaveDoVoo(aluno.id, p.mid || 0);
    return p.fly && p.mis === mis && p.solicitacao === undefined && mesmaMissaoDoCurso(p) && !Object.hasOwn(estado.fixos || {}, chave)
      && !fixoPeloStatus(chave, estado.fStatus) && resultadoDoVoo(doDia, chave) === null;
  }) || null;
}

// A missão do curso que o pedido escolheu na Agenda (missao_do_curso), nos programas lidos (cursos: S.programa), quando ela
// continua no programa e é do tipo do pedido: { codigo, sigla, missao }. A que saiu do programa ou mudou de tipo depois do
// registro, ou que os programas lidos não têm, não vale (false); o pedido sem nenhuma: null
function missaoDoCursoDoPedido(cursos, solicitacao) {
  if (!solicitacao.missao_do_curso) return null;
  const achada = missaoDoCursoGuardada(cursos, solicitacao.missao_do_curso);
  if (!achada || achada.retirada || achada.missao.mis !== solicitacao.missao) return false;
  return { codigo: achada.missao.codigo, sigla: achada.curso.sigla, missao: achada.missao };
}

// Importa para a demanda da data as solicitações ativas ainda não importadas. Só acrescenta: cada pedido da agenda vira
// um voo, marcado com o id dele em solicitacao (dois pedidos da mesma missão são dois voos). O voo da mesma missão posto
// na demanda sem pedido da agenda dá lugar ao pedido (vooQueDaLugar); senão, o pedido vai para o pedido principal do
// aluno, quando ele não voa e o dia não guarda nada dele, ou para uma missão extra nova (alvoDoNovoPedido). As
// solicitações vistas ficam anotadas no dia (estado.importadas) para não repetir.
// O pedido com a missão do curso escolhida na Agenda (missao_do_curso) entra como ela, qualquer que seja o progresso: o
// código e o curso dela, com o recurso e as horas do pedido. A que saiu do programa ou mudou de tipo depois do registro não
// entra: o pedido entra como o que não tem nenhuma, e o resumo o conta (foraDoPrograma, com a missão do curso como a qual
// ele entrou, entrouComo: a inferida ou a do operador; null, pelo tipo). Sem os programas lidos (cursos: null), não se
// sabe se ela saiu: o pedido espera, sem contar como visto, e entra na importação depois de lidos (esperamOsProgramas).
// O pedido sem missão do curso, do aluno de um curso: entra como a primeira missão liberada do programa que é do tipo
// pedido (o código e o curso dela, o recurso e as horas do programa); nenhuma, ele entra como veio, e o resumo diz
// (semMissaoDoCurso, só quando havia o que inferir). O pedido com recurso só entra como uma missão do
// programa nesse recurso. As missões dos outros voos do aluno no dia
// contam como feitas, como na Demanda; a do voo que dá lugar ao pedido, não (ela continua no dia, agora com o pedido). A
// missão do curso que o operador pôs nesse voo (Usar, "Outra missão do curso") continua a dele, com o recurso e as horas
// que ele tem (as registradas na agenda valem mais, como na missão do programa): a escolha do operador vale mais que a
// próxima missão do programa. situacao: o último resultado de cada missão; programa: os cursos de onde a missão é
// inferida (vazio quando os resultados ou os programas não foram lidos, ou com o progresso desligado: nenhum pedido entra
// como missão inferida); cursos: os programas lidos, onde está a missão do curso do pedido (null: não lidos). semInativos: o inativo do
// cadastro vale na data (de hoje em diante): o pedido do aluno inativo não entra nem conta como visto (entra quando ele
// voltar a ativo)
export function importarSolicitacoes(estado, solicitacoes, { situacao = [], programa = [], cursos = [], semInativos = false } = {}) {
  const indice = indiceDoPrograma(programa), mapa = situacaoPorMissao(situacao);
  const resumo = { novos: 0, atualizados: 0, semAluno: 0, deInativo: 0, foraDoPrograma: [], semMissaoDoCurso: [], esperamOsProgramas: 0 };
  if (!Array.isArray(estado.importadas)) estado.importadas = [];
  for (const solicitacao of solicitacoes) {
    if (solicitacao.cancelada_em || estado.importadas.includes(solicitacao.id)) continue;
    // O pedido de quem não está no cadastro não conta como visto: entra quando o aluno for cadastrado
    const aluno = estado.stu.find(x => x.id === solicitacao.aluno);
    if (!aluno) { resumo.semAluno++; continue; }
    if (semInativos && inativo(aluno)) { resumo.deInativo++; continue; }
    if (cursos === null && solicitacao.missao_do_curso) { resumo.esperamOsProgramas++; continue; }
    estado.importadas.push(solicitacao.id);
    const vinculada = missaoDoCursoDoPedido(cursos || [], solicitacao) || null;
    const copiada = vooQueDaLugar(estado, aluno, migrateLegacyMissionName(solicitacao.missao), vinculada);
    const escolhida = !vinculada && copiada && copiada.etapa ? copiada : null;
    const curso = !vinculada && !escolhida && aluno.curso ? indice.curso(aluno.curso) : null;
    const jaNoDia = curso && missoesDoDia(curso, aluno, { fStatus: estado.fStatus, mid: copiada ? copiada.mid || 0 : null });
    const recurso = recursoValido(solicitacao);
    const missao = curso && proximasMissoes(curso, mapa, aluno.id, { planejadas: jaNoDia, exceto: jaNoDia }).candidatas
      .find(m => m.mis === solicitacao.missao && (!recurso || m.eq === recurso));
    if (curso && !missao) resumo.semMissaoDoCurso.push({ missao: solicitacao.missao, ...(recurso ? { recurso } : {}) });
    // A missão do curso do pedido: o recurso e as horas do pedido (sem eles, os dela). A inferida ou a do operador: o recurso
    // do programa, com os horários e as preferências dele, e as horas dele
    const doCurso = escolhida || missao;
    const pedido = pedidoDaSolicitacao(solicitacao, estado.horarios, vinculada ? { ...(recurso ? {} : { eq: vinculada.missao.eq }), nb: vinculada.missao.nb }
      : doCurso ? { eq: doCurso.eq, nb: doCurso.nb } : {});
    if (vinculada) Object.assign(pedido, { etapa: vinculada.codigo, cursoDaEtapa: vinculada.sigla });
    else if (escolhida) Object.assign(pedido, { etapa: escolhida.etapa }, escolhida.cursoDaEtapa ? { cursoDaEtapa: escolhida.cursoDaEtapa } : {});
    else if (missao) Object.assign(pedido, { etapa: missao.codigo, cursoDaEtapa: curso.sigla });
    if (!vinculada && solicitacao.missao_do_curso) resumo.foraDoPrograma.push({ missao: solicitacao.missao, entrouComo: pedido.etapa || null });
    pedido.solicitacao = solicitacao.id;
    if (copiada) {
      // O voo continua com o instrutor escolhido; a disponibilidade e a missão do curso passam a ser as do pedido
      for (const campo of ['jan', 'etapa', 'cursoDaEtapa', 'limiteConfirmado']) delete copiada[campo];
      Object.assign(copiada, pedido);
      resumo.atualizados++;
    } else {
      Object.assign(alvoDoNovoPedido(estado, aluno), pedido);
      resumo.novos++;
    }
  }
  return resumo;
}
