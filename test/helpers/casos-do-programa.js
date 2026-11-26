// Os casos da gravação do programa de um curso, os mesmos no banco e no app:
// - no banco, cada caso é uma verificação de supabase/tests/database/cursos.test.sql (public.salvar_curso e
//   public.importar_cursos), com o nome do caso na descrição, e cada código de erro com a dica que a gravação devolve
//   tem pelo menos um caso: test/unit/espelho-do-banco.test.js confere as duas coisas;
// - no app, os mesmos dados passam pela regra pura da gravação (gravarCurso e importarProgramas, em js/programa.js).
// Cada caso parte de um estado guardado (antes: os cursos, os códigos que já têm resultados e o cadastro) e faz uma
// chamada: salvar (o Administrador grava um curso) ou importar (a conversão única do cadastro). Recusada: o código do
// erro e o campo (a dica do servidor; null quando não há). Aceita: o retorno (salvar: a versão nova, sem a hora;
// importar: quantas missões vieram), o curso como fica e a versão registrada (null: nenhuma). Os cursos estão no
// formato guardado (sem comResultados e sem alteracoes); a ordem das listas não conta (compare pelo id).
// As regras que os casos fixam (a referência é public.gravar_programa, na migração 20261117200000_cursos_e_missoes):
// - o que vem é o programa: a fase ou a missão que não vem (ou vem com removida: true) sai dele, sem ser apagada, e
//   guarda o resto (a ordem também) menos os requisitos; a que volta entra de novo, com o que vier;
// - a ordem é a posição na lista: das fases, no programa; das missões, dentro da fase;
// - as listas de fases e de missões vêm sempre; o módulo, a regra, os requisitos, "dispensada", "avaliação" e o trecho
//   do Noturno podem faltar (null, 'ordem', [], false, false e nenhum);
// - o que a missão exige do INVA (exige: até 10 ids, letras minúsculas, números e _) pode faltar: a missão fica com o
//   que exigia (nova, nada); a migração 20261127110000_habilitacoes_da_missao_do_curso carrega a lista;
// - o trecho do Noturno ("ida", "noite" ou "volta") vai só numa missão Noturno, e na fase as missões com trecho que vêm
//   uma logo depois da outra são um Noturno só: a ida (se houver), uma noite e a volta (se houver), nesta ordem (a noite
//   sozinha também vale); o curso guarda o trecho só na missão que tem um;
// - a primeira recusa decide, nesta ordem: o papel, o formato do cadastro (antes do formato dos cursos), a descrição, o
//   curso (nome e ativo), a sigla (criar) ou a versão lida, e o programa: as listas e o limite, os ids (outro curso
//   também), os campos (das fases: nome, módulo e regra; das missões: fase, código, nome, tipo com recurso e horas,
//   regra, "dispensada", "avaliação" e o trecho do Noturno, com a sequência dele na fase), os códigos, os requisitos e o
//   código travado por um resultado;
// - a conversão troca o programa inteiro (o guardado é apagado), pula o curso igual e o que não existe, e com o
//   cadastro no formato dos cursos não grava nada.
import { FORMATO_DOS_CURSOS } from '../../js/migracoes.js';

const id = (grupo, n) => `00000000-0000-4000-${grupo}-${String(n).padStart(12, '0')}`;

export const IDS = Object.freeze({
  f1: id('9001', 1), f2: id('9001', 2), f3: id('9001', 3),
  // Um id que não está no programa, e um id com letras maiúsculas (o banco só aceita o uuid em minúsculas)
  fora: id('9001', 9), maiusculo: '00000000-0000-4000-9002-0000000000AB',
  m1: id('9002', 1), m2: id('9002', 2), m3: id('9002', 3), m4: id('9002', 4), m5: id('9002', 5), m6: id('9002', 6),
  m7: id('9002', 7), m8: id('9002', 8),
  // O curso ZZ8: a fase guardada e o programa trazido do cadastro (uma fase "Programa" com duas missões)
  faseDoZZ8: id('9008', 1),
  programa: id('9003', 1), legado1: id('9004', 1), legado2: id('9004', 2)
});
const { f1, f2, f3, m1, m2, m3, m4, m5, m6, m7, m8 } = IDS;

// O conteúdo que o app manda para gravar o curso de teste ZZ9 (p_curso): três fases (a terceira "depois de" a
// primeira, sem módulo) e cinco missões (uma livre, uma dispensada, uma de avaliação "depois de" outra fase e o Ground)
export const PROGRAMA = {
  nome: 'Curso de teste',
  ativo: true,
  fases: [
    { id: f1, nome: 'Fase 1 – Duplo comando', modulo: 'Módulo 01 – Treinamento', regra: 'ordem', requer: [] },
    { id: f2, nome: 'Fase 2 – Solo', modulo: 'Módulo 01 – Treinamento', regra: 'ordem', requer: [] },
    { id: f3, nome: 'Fase 3 – Noturno', modulo: null, regra: 'depois', requer: [f1] }
  ],
  missoes: [
    { id: m1, fase: f1, codigo: 'ZZ9-01', nome: 'Primeiro voo', mis: 'Voo Local', eq: 'C152', nb: 1, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, exige: [] },
    { id: m2, fase: f1, codigo: 'ZZ9-02', nome: 'Ground do C152', mis: 'Ground C152', eq: 'Sala Ground', nb: 1.5, regra: 'livre', requer: [], dispensada: false, avaliacao: false, exige: [] },
    { id: m3, fase: f2, codigo: 'ZZ9-03', nome: 'Adaptação', mis: 'Voo Local', eq: 'C152', nb: 1, regra: 'ordem', requer: [], dispensada: true, avaliacao: false, exige: [] },
    { id: m4, fase: f2, codigo: 'ZZ9-04', nome: 'Solo', mis: 'Voo Solo', eq: 'C152', nb: 1, regra: 'depois', requer: [m1], dispensada: false, avaliacao: true, exige: [] },
    { id: m5, fase: f3, codigo: 'ZZ9-05', nome: 'Noturno', mis: 'Noturno', eq: 'C172', nb: 3, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, exige: [] }
  ]
};

// O conteúdo com outros campos numa missão (ou numa fase)
const comMissao = (conteudo, qual, campos) => ({ ...conteudo, missoes: conteudo.missoes.map(m => (m.id === qual ? { ...m, ...campos } : m)) });
const comFase = (conteudo, qual, campos) => ({ ...conteudo, fases: conteudo.fases.map(f => (f.id === qual ? { ...f, ...campos } : f)) });
const semMissao = (conteudo, qual) => ({ ...conteudo, missoes: conteudo.missoes.filter(m => m.id !== qual) });
// O conteúdo sem a lista exige nas missões (como a aba de antes do F1d manda)
const semExige = conteudo => ({ ...conteudo, missoes: conteudo.missoes.map(({ exige, ...m }) => m) });

// O Noturno em trechos (p_curso): na Fase 3, a ida (ZZ9-06), a noite (a ZZ9-05) e a volta (ZZ9-07), juntas e nesta
// ordem
const IDA = { id: m6, fase: f3, codigo: 'ZZ9-06', nome: 'Translado de ida', mis: 'Noturno', eq: 'C172', nb: 1, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, exige: [], trecho: 'ida' };
const NOITE = { ...PROGRAMA.missoes[4], trecho: 'noite' };
const VOLTA = { id: m7, fase: f3, codigo: 'ZZ9-07', nome: 'Translado de volta', mis: 'Noturno', eq: 'C172', nb: 1, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, exige: [], trecho: 'volta' };
export const NOTURNO_EM_TRECHOS = { ...PROGRAMA, missoes: [...PROGRAMA.missoes.slice(0, 4), IDA, NOITE, VOLTA] };
// Uma missão sem trecho no meio do Noturno
const NO_MEIO = { id: m8, fase: f3, codigo: 'ZZ9-08', nome: 'Voo local em BH', mis: 'Voo Local', eq: 'C172', nb: 1 };

const SEM_M5 = semMissao(PROGRAMA, m5);
const TROCADOS = comMissao(comMissao(SEM_M5, m2, { codigo: 'ZZ9-03' }), m3, { codigo: 'ZZ9-02' });
const DE_VOLTA = { ...TROCADOS, missoes: [...TROCADOS.missoes, PROGRAMA.missoes[4]] };
const M4_MARCADA = comMissao(DE_VOLTA, m4, { removida: true });

// Os cursos guardados
const SEMEADOS = [
  { sigla: 'PP', nome: 'Piloto Privado', ordem: 0, ativo: true, versao: 1, fases: [], missoes: [] },
  { sigla: 'PC', nome: 'Piloto Comercial', ordem: 1, ativo: true, versao: 1, fases: [], missoes: [] },
  { sigla: 'INVA', nome: 'Instrutor de Voo', ordem: 2, ativo: true, versao: 1, fases: [], missoes: [] }
];
const ZZ8 = {
  sigla: 'ZZ8', nome: 'Outro curso de teste', ordem: 998, ativo: true, versao: 1,
  fases: [{ id: IDS.faseDoZZ8, nome: 'Fase do outro curso', modulo: null, ordem: 0, regra: 'ordem', requer: [], removida: false }],
  missoes: []
};
const ZZ9_V1 = {
  sigla: 'ZZ9', nome: 'Curso de teste', ordem: 999, ativo: true, versao: 1,
  fases: [
    { id: f1, nome: 'Fase 1 – Duplo comando', modulo: 'Módulo 01 – Treinamento', ordem: 0, regra: 'ordem', requer: [], removida: false },
    { id: f2, nome: 'Fase 2 – Solo', modulo: 'Módulo 01 – Treinamento', ordem: 1, regra: 'ordem', requer: [], removida: false },
    { id: f3, nome: 'Fase 3 – Noturno', modulo: null, ordem: 2, regra: 'depois', requer: [f1], removida: false }
  ],
  missoes: [
    { id: m1, fase: f1, codigo: 'ZZ9-01', nome: 'Primeiro voo', mis: 'Voo Local', eq: 'C152', nb: 1, ordem: 0, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, exige: [], removida: false },
    { id: m2, fase: f1, codigo: 'ZZ9-02', nome: 'Ground do C152', mis: 'Ground C152', eq: 'Sala Ground', nb: 1.5, ordem: 1, regra: 'livre', requer: [], dispensada: false, avaliacao: false, exige: [], removida: false },
    { id: m3, fase: f2, codigo: 'ZZ9-03', nome: 'Adaptação', mis: 'Voo Local', eq: 'C152', nb: 1, ordem: 0, regra: 'ordem', requer: [], dispensada: true, avaliacao: false, exige: [], removida: false },
    { id: m4, fase: f2, codigo: 'ZZ9-04', nome: 'Solo', mis: 'Voo Solo', eq: 'C152', nb: 1, ordem: 1, regra: 'depois', requer: [m1], dispensada: false, avaliacao: true, exige: [], removida: false },
    { id: m5, fase: f3, codigo: 'ZZ9-05', nome: 'Noturno', mis: 'Noturno', eq: 'C172', nb: 3, ordem: 0, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, exige: [], removida: false }
  ]
};
// Um curso guardado com outra versão e outros campos em algumas missões
const versao = (curso, n, missoes = {}) => ({ ...curso, versao: n, missoes: curso.missoes.map(m => ({ ...m, ...missoes[m.id] })) });
const ZZ9_V2 = versao(ZZ9_V1, 2, { [m5]: { removida: true } });
const ZZ9_V3 = versao(ZZ9_V2, 3, { [m2]: { codigo: 'ZZ9-03' }, [m3]: { codigo: 'ZZ9-02' } });
const ZZ9_V4 = versao(ZZ9_V3, 4, { [m5]: { removida: false } });
const ZZ9_V5 = versao(ZZ9_V4, 5, { [m4]: { removida: true, requer: [] } });
// O ZZ9 da versão 1 gravado de novo (versão 2) com a Fase 3 nestas missões, nesta ordem
const comAFase3 = (...missoes) => ({ ...ZZ9_V1, versao: 2, missoes: [...ZZ9_V1.missoes.slice(0, 4), ...missoes.map((m, ordem) => ({ ...m, ordem, exige: [], removida: false }))] });
// O ZZ9 da versão 1 gravado de novo (versão n) com a ZZ9-04 exigindo do INVA estas habilitações
const comExige = (n, exige) => versao(ZZ9_V1, n, { [m4]: { exige } });
const ZZ8_TRAZIDO = {
  ...ZZ8, versao: 2,
  fases: [{ id: IDS.programa, nome: 'Programa', modulo: null, ordem: 0, regra: 'ordem', requer: [], removida: false }],
  missoes: [
    { id: IDS.legado1, fase: IDS.programa, codigo: 'ZZ8-01', nome: 'Voo local', mis: 'Voo Local', eq: 'C152', nb: 1, ordem: 0, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, exige: [], removida: false },
    { id: IDS.legado2, fase: IDS.programa, codigo: 'ZZ8-02', nome: 'Navegação', mis: 'Navegação', eq: 'C152', nb: 2.5, ordem: 1, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, exige: [], removida: false }
  ]
};

// O programa guardado no cadastro (antes do formato dos cursos), como o app manda na conversão: o ZZ8 e um curso que
// não existe (pulado)
const LEGADO = [
  {
    sigla: 'ZZ8',
    fases: [{ id: IDS.programa, nome: 'Programa', modulo: null, regra: 'ordem', requer: [] }],
    missoes: [
      { id: IDS.legado1, fase: IDS.programa, codigo: 'ZZ8-01', nome: 'Voo local', mis: 'Voo Local', eq: 'C152', nb: 1, regra: 'ordem', requer: [], dispensada: false, avaliacao: false },
      { id: IDS.legado2, fase: IDS.programa, codigo: 'ZZ8-02', nome: 'Navegação', mis: 'Navegação', eq: 'C152', nb: 2.5, regra: 'ordem', requer: [], dispensada: false, avaliacao: false }
    ]
  },
  { sigla: 'ZZ7', fases: [], missoes: [] }
];
const LEGADO_MUDADO = [{ ...LEGADO[0], missoes: LEGADO[0].missoes.slice(0, 1) }];

// Os estados guardados. O formato dos cursos é o do app (FORMATO_DOS_CURSOS, em js/migracoes.js; no banco,
// public.formato_dos_cursos(): test/unit/espelho-do-banco.test.js confere que é o mesmo). O cadastro já convertido, no
// formato dos cursos (versão 7, salvo na conversão), e o de antes
const CADASTRO_CONVERTIDO = { esquema: FORMATO_DOS_CURSOS, versao: 7 };
const CADASTRO_DE_ANTES = { esquema: FORMATO_DOS_CURSOS - 1, versao: 7 };
const estado = (zz9, { cadastro = CADASTRO_CONVERTIDO, zz8 = ZZ8 } = {}) => ({
  cursos: [...SEMEADOS, zz8, ...(zz9 ? [zz9] : [])],
  resultados: zz9 ? [{ curso: 'ZZ9', missao: 'ZZ9-01' }] : [],
  cadastro
});

const ADMINISTRADOR = 'Administrador de teste', OPERADOR = 'Operador de teste';
const salvar = (versaoLida, conteudo, extra = {}) => ({ sigla: 'ZZ9', versaoLida, conteudo, descricao: 'ZZ9: alteração de teste', autor: ADMINISTRADOR, ...extra });
const recusa = (code, campo = null) => ({ erro: { code, campo } });
const versaoGravada = (curso, numero, descricao, autor = ADMINISTRADOR) => ({ curso, versao: numero, descricao, registrado_por: autor });

export const CASOS_DO_PROGRAMA = [
  // Criar
  {
    nome: 'o Administrador cria um curso: versão 1, com quem gravou',
    antes: estado(null),
    salvar: salvar(0, PROGRAMA, { descricao: 'Curso ZZ9 criado: Curso de teste' }),
    retorno: { versao: 1 },
    depois: ZZ9_V1,
    alteracao: versaoGravada('ZZ9', 1, 'Curso ZZ9 criado: Curso de teste')
  },
  { nome: 'criar um curso que já existe é conflito (PT409, sigla)', antes: estado(ZZ9_V1), salvar: salvar(0, PROGRAMA), ...recusa('PT409', 'sigla') },
  {
    nome: 'sigla fora do formato é recusada (22023, sigla)', antes: estado(ZZ9_V1),
    salvar: salvar(0, { nome: 'Curso inválido', ativo: true, fases: [], missoes: [] }, { sigla: 'z9' }), ...recusa('22023', 'sigla')
  },
  {
    nome: 'gravar um curso que não existe é recusado (P0002)', antes: estado(ZZ9_V1),
    salvar: salvar(1, { nome: 'Curso que não existe', ativo: true, fases: [], missoes: [] }, { sigla: 'ZZ7' }), ...recusa('P0002')
  },

  // Os campos do programa (o ZZ9 guardado na versão 1, com um resultado em ZZ9-01)
  { nome: 'código fora do formato é recusado (22023, codigo)', antes: estado(ZZ9_V1), salvar: salvar(1, comMissao(PROGRAMA, m2, { codigo: 'zz9 02' })), ...recusa('22023', 'codigo') },
  { nome: 'código repetido no programa é recusado (23505, codigo)', antes: estado(ZZ9_V1), salvar: salvar(1, comMissao(PROGRAMA, m2, { codigo: 'ZZ9-01' })), ...recusa('23505', 'codigo') },
  { nome: 'Noturno no C152 é recusado (22023, mis)', antes: estado(ZZ9_V1), salvar: salvar(1, comMissao(PROGRAMA, m5, { eq: 'C152' })), ...recusa('22023', 'mis') },
  { nome: 'Ground com 1 h é recusado (22023, mis)', antes: estado(ZZ9_V1), salvar: salvar(1, comMissao(PROGRAMA, m2, { nb: 1 })), ...recusa('22023', 'mis') },
  { nome: 'missão de 6 h é recusada (22023, mis)', antes: estado(ZZ9_V1), salvar: salvar(1, comMissao(PROGRAMA, m1, { nb: 6 })), ...recusa('22023', 'mis') },
  {
    nome: 'missão "depois de" uma missão posterior é recusada (22023, requer)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(PROGRAMA, m4, { requer: [m5] })), ...recusa('22023', 'requer')
  },
  {
    nome: '"depois de…" sem nenhuma missão é recusado (22023, requer)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(PROGRAMA, m5, { regra: 'depois', requer: [] })), ...recusa('22023', 'requer')
  },
  {
    nome: 'fase "depois de" uma fase posterior é recusada (22023, requer)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comFase(PROGRAMA, f2, { regra: 'depois', requer: [f3] })), ...recusa('22023', 'requer')
  },
  {
    nome: 'missão numa fase fora do programa é recusada (22023, fase)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(PROGRAMA, m5, { fase: IDS.fora })), ...recusa('22023', 'fase')
  },
  {
    nome: 'fase de outro curso é recusada (22023, id)', antes: estado(ZZ9_V1),
    salvar: salvar(1, { ...PROGRAMA, fases: [...PROGRAMA.fases, { id: IDS.faseDoZZ8, nome: 'Fase de outro curso', modulo: null, regra: 'ordem', requer: [] }] }),
    ...recusa('22023', 'id')
  },
  {
    nome: 'o código de uma missão com resultados não muda (23514, codigo)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(PROGRAMA, m1, { codigo: 'ZZ9-10' })), ...recusa('23514', 'codigo')
  },

  // A descrição, o curso e os outros campos do programa: cada dica da gravação tem um caso
  { nome: 'a descrição vazia é recusada (22023, descricao)', antes: estado(ZZ9_V1), salvar: salvar(1, PROGRAMA, { descricao: '' }), ...recusa('22023', 'descricao') },
  { nome: 'o curso sem nome é recusado (22023, nome)', antes: estado(ZZ9_V1), salvar: salvar(1, { ...PROGRAMA, nome: ' ' }), ...recusa('22023', 'nome') },
  { nome: '"ativo" fora de sim ou não é recusado (22023, ativo)', antes: estado(ZZ9_V1), salvar: salvar(1, { ...PROGRAMA, ativo: 'sim' }), ...recusa('22023', 'ativo') },
  {
    nome: 'o programa sem a lista de missões é recusado (22023, limite)', antes: estado(ZZ9_V1),
    salvar: salvar(1, { nome: PROGRAMA.nome, ativo: PROGRAMA.ativo, fases: PROGRAMA.fases }), ...recusa('22023', 'limite')
  },
  {
    nome: 'id com letra maiúscula é recusado (22023, id)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(PROGRAMA, m5, { id: IDS.maiusculo })), ...recusa('22023', 'id')
  },
  { nome: 'fase sem nome é recusada (22023, nome)', antes: estado(ZZ9_V1), salvar: salvar(1, comFase(PROGRAMA, f2, { nome: '' })), ...recusa('22023', 'nome') },
  { nome: 'módulo vazio é recusado (22023, modulo)', antes: estado(ZZ9_V1), salvar: salvar(1, comFase(PROGRAMA, f1, { modulo: '' })), ...recusa('22023', 'modulo') },
  { nome: 'regra fora da lista é recusada (22023, regra)', antes: estado(ZZ9_V1), salvar: salvar(1, comMissao(PROGRAMA, m1, { regra: 'sempre' })), ...recusa('22023', 'regra') },
  {
    nome: '"dispensada" fora de sim ou não é recusada (22023, dispensada)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(PROGRAMA, m3, { dispensada: 'sim' })), ...recusa('22023', 'dispensada')
  },
  {
    nome: '"avaliação" fora de sim ou não é recusada (22023, avaliacao)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(PROGRAMA, m4, { avaliacao: 1 })), ...recusa('22023', 'avaliacao')
  },

  // O que a missão exige do INVA (o ZZ9 guardado na versão 1; migração 20261127110000)
  {
    nome: 'a missão guarda as habilitações que exige do INVA', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(PROGRAMA, m4, { exige: ['endosso_solo'] })), retorno: { versao: 2 }, depois: comExige(2, ['endosso_solo']),
    alteracao: versaoGravada('ZZ9', 2, 'ZZ9: alteração de teste')
  },
  {
    nome: 'a missão sem a lista exige fica com o que exigia do INVA', antes: estado(comExige(2, ['endosso_solo'])),
    salvar: salvar(2, semExige(PROGRAMA)), retorno: { versao: 3 }, depois: comExige(3, ['endosso_solo']), alteracao: versaoGravada('ZZ9', 3, 'ZZ9: alteração de teste')
  },
  {
    nome: 'a lista exige vazia tira o que a missão exigia do INVA', antes: estado(comExige(2, ['endosso_solo'])),
    salvar: salvar(2, comMissao(PROGRAMA, m4, { exige: [] })), retorno: { versao: 3 }, depois: comExige(3, []), alteracao: versaoGravada('ZZ9', 3, 'ZZ9: alteração de teste')
  },
  { nome: 'exige com um id fora do formato é recusado (22023, exige)', antes: estado(ZZ9_V1), salvar: salvar(1, comMissao(PROGRAMA, m4, { exige: ['Endosso Solo'] })), ...recusa('22023', 'exige') },
  {
    nome: 'exige com mais de 10 habilitações é recusado (22023, exige)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(PROGRAMA, m4, { exige: Array.from({ length: 11 }, (_, i) => `hab_${i}`) })), ...recusa('22023', 'exige')
  },
  { nome: 'exige fora de uma lista é recusado (22023, exige)', antes: estado(ZZ9_V1), salvar: salvar(1, comMissao(PROGRAMA, m4, { exige: 'endosso_solo' })), ...recusa('22023', 'exige') },

  // O Noturno em trechos (o ZZ9 guardado na versão 1)
  {
    nome: 'o Noturno com a ida, a noite e a volta, juntas na fase', antes: estado(ZZ9_V1),
    salvar: salvar(1, NOTURNO_EM_TRECHOS), retorno: { versao: 2 }, depois: comAFase3(IDA, NOITE, VOLTA), alteracao: versaoGravada('ZZ9', 2, 'ZZ9: alteração de teste')
  },
  {
    nome: 'o Noturno só com a noite', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(PROGRAMA, m5, { trecho: 'noite' })), retorno: { versao: 2 }, depois: comAFase3(NOITE), alteracao: versaoGravada('ZZ9', 2, 'ZZ9: alteração de teste')
  },
  {
    nome: 'o Noturno com a ida e a noite, sem a volta', antes: estado(ZZ9_V1),
    salvar: salvar(1, semMissao(NOTURNO_EM_TRECHOS, m7)), retorno: { versao: 2 }, depois: comAFase3(IDA, NOITE), alteracao: versaoGravada('ZZ9', 2, 'ZZ9: alteração de teste')
  },
  {
    nome: 'o Noturno com a noite e a volta, sem a ida', antes: estado(ZZ9_V1),
    salvar: salvar(1, semMissao(NOTURNO_EM_TRECHOS, m6)), retorno: { versao: 2 }, depois: comAFase3(NOITE, VOLTA), alteracao: versaoGravada('ZZ9', 2, 'ZZ9: alteração de teste')
  },
  {
    nome: 'trecho numa missão que não é Noturno é recusado (22023, trecho)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(NOTURNO_EM_TRECHOS, m6, { mis: 'Navegação' })), ...recusa('22023', 'trecho')
  },
  {
    nome: 'trecho fora da lista é recusado (22023, trecho)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(NOTURNO_EM_TRECHOS, m6, { trecho: 'translado' })), ...recusa('22023', 'trecho')
  },
  {
    nome: 'a ida sem a noite logo depois é recusada (22023, trecho)', antes: estado(ZZ9_V1),
    salvar: salvar(1, semMissao(comMissao(NOTURNO_EM_TRECHOS, m5, { trecho: null }), m7)), ...recusa('22023', 'trecho')
  },
  {
    nome: 'a volta sem a noite logo antes é recusada (22023, trecho)', antes: estado(ZZ9_V1),
    salvar: salvar(1, semMissao(comMissao(NOTURNO_EM_TRECHOS, m5, { trecho: null }), m6)), ...recusa('22023', 'trecho')
  },
  {
    nome: 'duas noites no mesmo Noturno são recusadas (22023, trecho)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(NOTURNO_EM_TRECHOS, m7, { trecho: 'noite' })), ...recusa('22023', 'trecho')
  },
  {
    nome: 'outra missão no meio do Noturno é recusada (22023, trecho)', antes: estado(ZZ9_V1),
    salvar: salvar(1, { ...NOTURNO_EM_TRECHOS, missoes: [...NOTURNO_EM_TRECHOS.missoes.slice(0, 6), NO_MEIO, VOLTA] }), ...recusa('22023', 'trecho')
  },
  {
    nome: 'o Noturno em duas fases é recusado (22023, trecho)', antes: estado(ZZ9_V1),
    salvar: salvar(1, comMissao(NOTURNO_EM_TRECHOS, m6, { fase: f2 })), ...recusa('22023', 'trecho')
  },

  // Tirar, trocar e voltar
  {
    nome: 'a missão que não vem sai do programa, sem ser apagada', antes: estado(ZZ9_V1),
    salvar: salvar(1, SEM_M5), retorno: { versao: 2 }, depois: ZZ9_V2, alteracao: versaoGravada('ZZ9', 2, 'ZZ9: alteração de teste')
  },
  { nome: 'gravar a partir de uma versão antiga é conflito (PT409)', antes: estado(ZZ9_V2), salvar: salvar(1, SEM_M5), ...recusa('PT409') },
  {
    nome: 'o código de uma missão retirada fica reservado (23505, codigo)', antes: estado(ZZ9_V2),
    salvar: salvar(2, { ...SEM_M5, missoes: [...SEM_M5.missoes, { ...PROGRAMA.missoes[4], id: m6, nome: 'Outro noturno' }] }),
    ...recusa('23505', 'codigo')
  },
  {
    nome: 'dois códigos trocam de missão numa gravação só', antes: estado(ZZ9_V2),
    salvar: salvar(2, TROCADOS), retorno: { versao: 3 }, depois: ZZ9_V3, alteracao: versaoGravada('ZZ9', 3, 'ZZ9: alteração de teste')
  },
  {
    nome: 'a missão retirada volta ao programa', antes: estado(ZZ9_V3),
    salvar: salvar(3, DE_VOLTA), retorno: { versao: 4 }, depois: ZZ9_V4, alteracao: versaoGravada('ZZ9', 4, 'ZZ9: alteração de teste')
  },
  {
    nome: 'a missão marcada como retirada também sai do programa', antes: estado(ZZ9_V4),
    salvar: salvar(4, M4_MARCADA), retorno: { versao: 5 }, depois: ZZ9_V5, alteracao: versaoGravada('ZZ9', 5, 'ZZ9: alteração de teste')
  },

  // A conversão única do cadastro (o cadastro no formato de antes, na versão 7)
  {
    nome: 'antes do formato dos cursos, o Administrador espera a conversão (PT409, formato)', antes: estado(ZZ9_V5, { cadastro: CADASTRO_DE_ANTES }),
    salvar: salvar(5, M4_MARCADA), ...recusa('PT409', 'formato')
  },
  {
    nome: 'o operador traz o programa do cadastro (antes do formato dos cursos, a versão lida)', antes: estado(ZZ9_V5, { cadastro: CADASTRO_DE_ANTES }),
    importar: { programas: LEGADO, versaoDoCadastro: 7, autor: OPERADOR },
    retorno: 2, depois: ZZ8_TRAZIDO, alteracao: versaoGravada('ZZ8', 2, 'Programa trazido do cadastro (2 missões)', OPERADOR)
  },
  {
    nome: 'trazer o mesmo programa de novo não grava nada', antes: estado(ZZ9_V5, { cadastro: CADASTRO_DE_ANTES, zz8: ZZ8_TRAZIDO }),
    importar: { programas: LEGADO, versaoDoCadastro: 7, autor: OPERADOR }, retorno: 0, depois: ZZ8_TRAZIDO, alteracao: null
  },
  {
    nome: 'cadastro alterado depois da leitura é conflito (PT409)', antes: estado(ZZ9_V5, { cadastro: CADASTRO_DE_ANTES, zz8: ZZ8_TRAZIDO }),
    importar: { programas: LEGADO, versaoDoCadastro: 6, autor: OPERADOR }, ...recusa('PT409')
  },
  {
    nome: 'no formato dos cursos, a conversão não grava mais nada', antes: estado(ZZ9_V5, { zz8: ZZ8_TRAZIDO }),
    importar: { programas: LEGADO_MUDADO, versaoDoCadastro: 7, autor: OPERADOR }, retorno: 0, depois: ZZ8_TRAZIDO, alteracao: null
  }
];
