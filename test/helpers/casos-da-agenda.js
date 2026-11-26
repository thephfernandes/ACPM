// Os casos do registro de um pedido da agenda pela função de 13 argumentos (o recurso, a missão do curso e a confirmação
// do 7º voo local; a migração 20261127100000_missao_do_curso_e_limite_do_pedido), os mesmos no banco e nas três cópias
// das regras dele em JavaScript:
// - no banco, cada caso é uma verificação de supabase/tests/database/agenda-missao-do-curso.test.sql ou de
//   agenda-locais.test.sql, com o nome do caso na descrição (test/unit/espelho-do-banco.test.js confere);
// - no app, o modo local (js/backends/local.js), o servidor falso dos testes de ponta a ponta (test/e2e/falso/agenda.js)
//   e o cliente falso de test/unit/backend-supabase.test.js recebem os mesmos dados.
// Cada caso parte da agenda com `locais` voos locais (Voo Local no C152) às 08:20 da data e do programa do curso ZZ1 (logo
// abaixo), e registra um pedido (o que o formulário manda: o recurso, a missão do curso e a confirmação). Recusado: o
// código do erro e o campo (a dica do servidor). Aceito: o que fica guardado (as horas, o recurso, a missão do curso e se
// a confirmação do limite foi registrada).
// As regras que os casos fixam, nesta ordem (depois de quem pode, do horário específico e da duração, como na função de 11):
// - o recurso é obrigatório e é um dos que a missão permite, com as horas (o Ground, sempre 1,5 h): 22023, recurso;
// - o Noturno sai às 17:30 e o Voo Solo, às 06:30: 22023, horario;
// - a missão do curso existe, está no programa (nem ela nem a fase dela foram retiradas) e é do tipo do pedido: 22023,
//   missao. O recurso dela não é comparado com o do pedido, nem o curso dela com o do aluno;
// - o 7º voo local no mesmo horário só com a confirmação (sem ela, PT422, locais); com 6 ou mais, a confirmação fica
//   registrada (quem e quando); com menos, ou noutra missão, ela não registra nada.

const id = (grupo, n) => `00000000-0000-4000-${grupo}-${String(n).padStart(12, '0')}`;

export const IDS_DA_AGENDA = Object.freeze({
  fase: id('9101', 1), faseRetirada: id('9101', 2),
  nav: id('9102', 1), local: id('9102', 2), retirada: id('9102', 3), daFaseRetirada: id('9102', 4), fora: id('9102', 9)
});
const I = IDS_DA_AGENDA;

// O curso dos casos no formato guardado (o de programa_do_curso, como o modo local e o servidor falso o têm)
const missao = (mid, fase, codigo, mis, eq, nb, ordem, marcas = {}) => ({
  id: mid, fase, codigo, nome: codigo, mis, eq, nb, ordem, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, removida: false, ...marcas
});
export const CURSO_DOS_CASOS = Object.freeze({
  sigla: 'ZZ1', nome: 'Curso dos casos da agenda', ordem: 9, ativo: true, versao: 1,
  fases: [
    { id: I.fase, nome: 'Fase 1', modulo: null, ordem: 0, regra: 'ordem', requer: [], removida: false },
    { id: I.faseRetirada, nome: 'Fase 2', modulo: null, ordem: 1, regra: 'ordem', requer: [], removida: true }
  ],
  missoes: [
    missao(I.nav, I.fase, 'NAV-150NM', 'Navegação', 'C152', 3, 0),
    missao(I.local, I.fase, 'LOC-01', 'Voo Local', 'C152', 1, 1),
    missao(I.retirada, I.fase, 'RET-01', 'Voo Local', 'C152', 1, 2, { removida: true }),
    missao(I.daFaseRetirada, I.faseRetirada, 'FR-01', 'Voo Local', 'C152', 1, 0)
  ]
});

// A data dos casos (uma segunda-feira no prazo para o relógio dos testes, 10/11/2026 12:00) e o pedido de base
export const DATA_DOS_CASOS = '2026-11-16';
export const pedidoDosCasos = (extra = {}) => ({
  data: DATA_DOS_CASOS, aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Navegação', janela: 'horario', horario: '08:20', horas: 1,
  registrado_por: 'Maria', observacao: null, excecao: false, recurso: 'C152', missaoDoCurso: null, confirmarLimite: false, ...extra
});
// Um dos voos locais que já estão na agenda antes do caso
export const localDosCasos = n => pedidoDosCasos({ aluno: 2000 + n, missao: 'Voo Local' });

const aceito = (registrado = {}) => ({ registrado: { horas: 1, recurso: 'C152', missao_do_curso: null, limite_confirmado: false, ...registrado } });
const recusado = (code, campo) => ({ erro: { code, campo } });

export const CASOS_DA_AGENDA = [
  { nome: 'sem recurso: recusado (recurso)', pedido: { recurso: null }, ...recusado('22023', 'recurso') },
  { nome: 'recurso em branco: recusado (recurso)', pedido: { recurso: '  ' }, ...recusado('22023', 'recurso') },
  { nome: 'recurso que a missão não permite: recusado (recurso)', pedido: { missao: 'Noturno', horario: '17:30', recurso: 'C152' }, ...recusado('22023', 'recurso') },
  { nome: 'Ground fora da Sala Ground: recusado (recurso)', pedido: { missao: 'Ground C152', recurso: 'C152' }, ...recusado('22023', 'recurso') },
  { nome: 'Ground sem as horas: 1,5 h', pedido: { missao: 'Ground C152', recurso: 'Sala Ground', horas: null }, ...aceito({ horas: 1.5, recurso: 'Sala Ground' }) },
  { nome: 'Noturno fora das 17:30: recusado (horario)', pedido: { missao: 'Noturno', horario: '16:20', recurso: 'C172', horas: 4 }, ...recusado('22023', 'horario') },
  { nome: 'Noturno às 17:30: aceito', pedido: { missao: 'Noturno', horario: '17:30', recurso: 'C172', horas: 4 }, ...aceito({ horas: 4, recurso: 'C172' }) },
  { nome: 'Voo Solo fora das 06:30: recusado (horario)', pedido: { missao: 'Voo Solo', horario: '08:20' }, ...recusado('22023', 'horario') },
  { nome: 'Voo Solo às 06:30 no PA-34: aceito', pedido: { missao: 'Voo Solo', horario: '06:30', recurso: 'PA-34' }, ...aceito({ recurso: 'PA-34' }) },
  { nome: 'missão do curso que não existe: recusada (missao)', pedido: { missaoDoCurso: I.fora }, ...recusado('22023', 'missao') },
  { nome: 'missão do curso retirada do programa: recusada (missao)', pedido: { missao: 'Voo Local', missaoDoCurso: I.retirada }, ...recusado('22023', 'missao') },
  { nome: 'missão do curso numa fase retirada: recusada (missao)', pedido: { missao: 'Voo Local', missaoDoCurso: I.daFaseRetirada }, ...recusado('22023', 'missao') },
  { nome: 'missão do curso de outro tipo: recusada (missao)', pedido: { missao: 'Voo Local', missaoDoCurso: I.nav }, ...recusado('22023', 'missao') },
  { nome: 'missão do curso: guardada no pedido', pedido: { missaoDoCurso: I.nav, horas: 3 }, ...aceito({ horas: 3, missao_do_curso: I.nav }) },
  { nome: 'missão do curso noutro recurso: aceita', pedido: { missaoDoCurso: I.nav, recurso: 'PA-34', horario: '07:30' }, ...aceito({ recurso: 'PA-34', missao_do_curso: I.nav }) },
  { nome: 'o 7º voo local sem a confirmação: recusado (locais)', locais: 6, pedido: { missao: 'Voo Local' }, ...recusado('PT422', 'locais') },
  { nome: 'o 7º voo local confirmado: registrado com quem confirmou', locais: 6, pedido: { missao: 'TGL (TMA)', confirmarLimite: true }, ...aceito({ limite_confirmado: true }) },
  { nome: 'a confirmação com vaga: nada registrado', locais: 5, pedido: { missao: 'Voo Local', confirmarLimite: true }, ...aceito() },
  { nome: 'a confirmação noutra missão: nada registrado', locais: 6, pedido: { missao: 'Navegação', confirmarLimite: true }, ...aceito() },
  { nome: 'o 7º voo local noutro horário: aceito', locais: 6, pedido: { missao: 'Voo Local', horario: '10:10' }, ...aceito() }
];

// O pedido como o backend do Supabase o manda (js/backends/supabase.js): os 13 argumentos da função, pelos nomes
export const argumentosDoBanco = p => ({
  p_data: p.data, p_aluno: p.aluno, p_aluno_nome: p.aluno_nome, p_missao: p.missao, p_janela: p.janela, p_horario: p.horario, p_horas: p.horas,
  p_registrado_por: p.registrado_por, p_observacao: p.observacao ?? null, p_excecao: Boolean(p.excecao), p_recurso: p.recurso ?? null,
  p_missao_do_curso: p.missaoDoCurso ?? null, p_confirmar_limite: Boolean(p.confirmarLimite)
});
// O que fica guardado de um pedido aceito, como os casos o dizem
export const guardadoDoCaso = s => ({
  horas: s.horas === null ? null : +s.horas, recurso: s.recurso, missao_do_curso: s.missao_do_curso ?? null,
  limite_confirmado: Boolean(s.limite_confirmado_por) && Boolean(s.limite_confirmado_em)
});
