// A agenda do servidor falso (test/e2e/supabase-falso.js): a tabela solicitacoes e as funções registrar_solicitacao e
// cancelar_solicitacao, com as regras do banco. O app chama a função de 13 argumentos (a migração
// missao_do_curso_e_limite_do_pedido): quem pode, o horário específico e a duração, o recurso, o horário fixo e a missão
// do curso (recusaDoPedido, com os cursos das tabelas), o limite de voos locais no horário (o 7º só com a confirmação, que
// fica registrada), o prazo e a exceção da coordenação. O roteador lê a tabela (GET /rest/v1/solicitacoes) e manda as duas
// funções para cá
import { prazoDaAgendaPermite, RECURSO_DO_PEDIDO, recusaDoPedido } from '../../../js/agenda.js';
import { GROUND_DURATION_H, MISSOES_LOCAIS, LIMITE_DE_VOOS_LOCAIS } from '../../../js/config.js';

export const FUNCOES_DA_AGENDA = ['registrar_solicitacao', 'cancelar_solicitacao'];

// agora: o relógio do servidor para o prazo da agenda; cursos: os cursos das tabelas agora (a missão do curso do pedido).
// atender devolve [status, corpo] (corpo undefined: sem corpo)
export function criarAgenda({ agora, cursos = () => [] }) {
  const solicitacoes = [];
  const recusa = (status, code, message, hint = null) => [status, { code, message, ...(hint ? { hint } : {}) }];

  function atender(funcao, args, conta) {
    // Agenda: secretaria e operadores registram; fora do prazo, só operadores pela exceção da coordenação
    if (!conta || !['secretaria', 'operador', 'administrador'].includes(conta.perfil)) return recusa(403, '42501', 'sem permissão na agenda');
    if (funcao === 'cancelar_solicitacao') {
      const s = solicitacoes.find(x => x.id === args.p_id && !x.cancelada_em);
      if (!s) return recusa(404, 'P0002', 'pedido não encontrado');
      Object.assign(s, { cancelada_em: agora.toISOString(), cancelada_por: args.p_cancelada_por.trim() });
      return [204];
    }
    // Só a função de 13 argumentos: a chamada com outros nomes não acha nenhuma (o app não chama as de antes)
    if (!Object.hasOwn(args, 'p_missao_do_curso') || !Object.hasOwn(args, 'p_confirmar_limite')) {
      return [404, { code: 'PGRST202', message: 'Could not find the function public.registrar_solicitacao in the schema cache' }];
    }
    if (args.p_janela !== 'horario' || !args.p_horario) return recusa(400, '22023', 'o pedido é num horário específico', 'horario');
    const horas = String(args.p_missao).startsWith('Ground') ? GROUND_DURATION_H : Math.round(+args.p_horas * 10) / 10;
    if (!(horas > 0 && horas <= 5)) return recusa(400, '22023', 'a duração vai de 0,1 h a 5 h', 'horas');
    const regra = recusaDoPedido({ missao: args.p_missao, recurso: args.p_recurso, horario: args.p_horario, horas, missaoDoCurso: args.p_missao_do_curso }, cursos());
    if (regra) return recusa(400, regra.code, regra.mensagem, regra.campo);
    // No máximo 6 voos locais no mesmo horário; o 7º, com a confirmação, fica registrado com quem confirmou
    const alemDoLimite = MISSOES_LOCAIS.includes(args.p_missao)
      && solicitacoes.filter(s => s.data === args.p_data && !s.cancelada_em && s.horario === args.p_horario && MISSOES_LOCAIS.includes(s.missao)).length >= LIMITE_DE_VOOS_LOCAIS;
    if (alemDoLimite && !args.p_confirmar_limite) return recusa(422, 'PT422', 'já há 6 voos locais no horário', 'locais');
    const noPrazo = prazoDaAgendaPermite(args.p_data, agora);
    if (!noPrazo && !args.p_excecao) return recusa(403, 'PT403', 'prazo encerrado');
    if (!noPrazo && !['operador', 'administrador'].includes(conta.perfil)) return recusa(403, '42501', 'exceção só para operadores');
    const recurso = args.p_recurso.trim();
    if (!RECURSO_DO_PEDIDO.test(recurso)) return recusa(400, '23514', 'violates check constraint');
    const id = solicitacoes.length + 1;
    solicitacoes.push({
      id, data: args.p_data, aluno: args.p_aluno, aluno_nome: args.p_aluno_nome.trim(), missao: args.p_missao, janela: args.p_janela,
      horario: args.p_horario, horas, recurso, missao_do_curso: args.p_missao_do_curso, observacao: (args.p_observacao || '').trim() || null,
      registrado_por: args.p_registrado_por.trim(), registrado_em: agora.toISOString(), usuario: conta.id, conta: conta.nome, excecao: !noPrazo,
      limite_confirmado_por: alemDoLimite ? conta.nome : null, limite_confirmado_em: alemDoLimite ? agora.toISOString() : null,
      cancelada_em: null, cancelada_por: null
    });
    return [200, id];
  }

  return { solicitacoes, atender };
}
