// O banco espelha o app. O pgTAP (supabase/tests/database) não roda no CI, então este teste confere o que as duas
// pontas precisam ter igual: a lista de tipos de missão e recursos da migração dos cursos (missao_e_recurso_validos) é a
// de js/config.js (MIS), o formato dos cursos (formato_dos_cursos) é o FORMATO_DOS_CURSOS do app, um passo do formato
// que o app grava (os dois em js/migracoes.js), os trechos do Noturno são os de js/config.js (NOTURNO), cada caso da
// gravação dos programas (test/helpers/casos-do-programa.js) é uma verificação de supabase/tests/database/cursos.test.sql,
// com os mesmos dados, e cada erro que a gravação devolve tem um caso.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MIS, GROUND_EQ_TYPE, GROUND_DURATION_H, DURACAO_MAXIMA_H, NOTURNO, MISSOES_LOCAIS, LIMITE_DE_VOOS_LOCAIS } from '../../js/config.js';
import { RECURSO_DO_PEDIDO, HORARIOS_FIXOS } from '../../js/agenda.js';
import { horariosDaMissao } from '../../js/horarios.js';
import { hm } from '../../js/format.js';
import { CASOS_DA_AGENDA } from '../helpers/casos-da-agenda.js';
import { ESQUEMA, FORMATO_DOS_CURSOS, migrarCadastro, antesDosCursosProprios } from '../../js/migracoes.js';
import { CASOS_DO_PROGRAMA, PROGRAMA, NOTURNO_EM_TRECHOS } from '../helpers/casos-do-programa.js';

const ler = caminho => readFileSync(new URL(`../../${caminho}`, import.meta.url), 'utf8');
const MIGRACAO = ler('supabase/migrations/20261117200000_cursos_e_missoes.sql');
const TESTE_DO_BANCO = ler('supabase/tests/database/cursos.test.sql');

// Uma função da migração, da criação até o fim do corpo (sem o $$; final)
function funcaoDaMigracao(nome) {
  const inicio = MIGRACAO.indexOf(`create function public.${nome}(`);
  assert.ok(inicio >= 0, `a migração cria ${nome}`);
  return MIGRACAO.slice(inicio, MIGRACAO.indexOf('$$;', inicio));
}

// A lista da função, linha a linha: o tipo de missão, os recursos e, no Ground, as horas
function listaDoBanco() {
  const corpo = funcaoDaMigracao('missao_e_recurso_validos');
  const tipos = [...corpo.matchAll(/^\s*when '([^']+)' then p_eq (?:= '([^']+)'|in \(([^)]*)\))(?: and p_nb = ([\d.]+))?$/gm)]
    .map(([, mis, um, varios, horas]) => ({
      mis,
      eq: um ? [um] : [...varios.matchAll(/'([^']+)'/g)].map(r => r[1]),
      horas: horas === undefined ? null : Number(horas)
    }));
  assert.equal(tipos.length, (corpo.match(/\bwhen '/g) || []).length, 'cada linha da lista no formato conhecido');
  return { corpo, tipos };
}

// O texto de uma função pg_temp de cursos.test.sql que devolve um jsonb fixo
function literalDoTeste(funcao) {
  const r = new RegExp(`create function pg_temp\\.${funcao}\\(\\)[\\s\\S]*?select '([\\s\\S]*?)'::jsonb`).exec(TESTE_DO_BANCO);
  assert.ok(r, `cursos.test.sql tem pg_temp.${funcao}()`);
  return JSON.parse(r[1]);
}

describe('O banco espelha o app', () => {
  it('missao_e_recurso_validos tem os tipos de missão de MIS, na mesma ordem, com os mesmos recursos', () => {
    const { tipos } = listaDoBanco();
    assert.deepEqual(tipos.map(t => t.mis), Object.keys(MIS));
    for (const t of tipos) assert.deepEqual(t.eq, MIS[t.mis].eq, t.mis);
  });

  it('o Ground é na Sala Ground, com 1,5 h; as horas vão até 5', () => {
    const { corpo, tipos } = listaDoBanco();
    for (const t of tipos) {
      if (MIS[t.mis].isGround) {
        assert.deepEqual(t.eq, [GROUND_EQ_TYPE], t.mis);
        assert.equal(t.horas, GROUND_DURATION_H, t.mis);
      } else {
        assert.equal(t.horas, null, `${t.mis}: as horas só são fixas no Ground`);
      }
    }
    assert.match(corpo, new RegExp(`else false end and p_nb > 0 and p_nb <= ${DURACAO_MAXIMA_H}\\s*$`));
  });

  // A coluna (a regra da tabela) e a gravação (public.gravar_programa) aceitam os trechos do Noturno do app, e só no tipo
  // Noturno
  it('os trechos do Noturno da migração são os de NOTURNO, só no tipo Noturno', () => {
    const listas = [...MIGRACAO.matchAll(/trecho'?\s+(?:not\s+)?in\s+\(([^)]*)\)/g)].map(r => [...r[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
    assert.equal(listas.length, 2, 'a regra da tabela e a gravação');
    for (const lista of listas) assert.deepEqual(lista, Object.keys(NOTURNO.trechos));
    assert.match(MIGRACAO, /check \(trecho is null or \(trecho in \([^)]*\) and tipo_de_missao = 'Noturno'\)\)/);
    assert.match(funcaoDaMigracao('gravar_programa'), /e ->> 'mis' <> 'Noturno'/);
  });

  // O formato dos cursos é um número só em cada ponta: a função da migração (imutável e interna: só as funções da
  // migração a chamam) e a constante de js/migracoes.js (que os casos também usam). Um aumento é uma linha em cada
  it('formato_dos_cursos() devolve o FORMATO_DOS_CURSOS do app, imutável e fora do alcance da API', () => {
    const corpo = funcaoDaMigracao('formato_dos_cursos');
    const r = new RegExp(String.raw`^create function public\.formato_dos_cursos\(\)\s+returns integer\s+language sql\s+immutable\s+`
      + String.raw`set search_path = ''\s+as \$\$\s+select (\d+)\s*$`).exec(corpo);
    assert.ok(r, 'uma função sql imutável que devolve um número');
    assert.equal(Number(r[1]), FORMATO_DOS_CURSOS);
    assert.match(MIGRACAO, /^revoke execute on function public\.formato_dos_cursos\(\) from public, anon, authenticated;$/m);
    assert.doesNotMatch(MIGRACAO, /grant execute on function public\.formato_dos_cursos/);
  });

  // O formato dos cursos é um passo de js/migracoes.js, e o app grava nele ou num formato depois dele: o cadastro de
  // antes passa pelo passo (sem ele, migrarCadastro quebra), e o regravado já não espera a conversão. Se outro formato
  // chega antes com o mesmo número (o main, numa fusão), o passo dos cursos é renumerado, junto com esta constante e a
  // função do banco: com o cadastro já gravado no número do outro, importar_cursos não traria nada, nunca
  it('o formato dos cursos é um passo do formato que o app grava, e o cadastro de antes passa por ele', () => {
    assert.ok(ESQUEMA >= FORMATO_DOS_CURSOS, `o app grava o formato ${ESQUEMA}: o formato dos cursos (${FORMATO_DOS_CURSOS}) não pode vir depois dele`);
    const antes = { nid: 1000, ins: [], stu: [], esquema: FORMATO_DOS_CURSOS - 1 };
    assert.equal(antesDosCursosProprios(antes), true);
    const regravado = migrarCadastro(antes);
    assert.equal(regravado.esquema, ESQUEMA);
    assert.equal(antesDosCursosProprios(regravado), false);
  });

  // O formato do cadastro (esquema_do_conteudo, direto ou na variável que recebe o valor dele) só é comparado com
  // formato_dos_cursos(), nunca com um número: o número fica só na função. A expressão confere as comparações, mesmo
  // em duas linhas; cada linha que lê o formato confere o resto: uma comparação a mais escrita de outro jeito
  // (coalesce, entre parênteses, o campo "esquema" direto) ou uma conta com a função (formato_dos_cursos() - 1)
  it('a migração compara o formato do cadastro com formato_dos_cursos(), sem nenhum número', () => {
    const formato = String.raw`(?:public\.)?esquema_do_conteudo\([^()]*\)|\bv_esquema\b`;
    const operador = '<=|>=|<>|!=|=|<|>';
    const comparacao = new RegExp(String.raw`(?:${formato})\s*(?:${operador})\s*([\w.]+(?:\(\))?)`, 'g');
    const comparacoes = [...MIGRACAO.matchAll(comparacao)].map(r => r[1]);
    assert.ok(comparacoes.length >= 2, 'salvar_curso e importar_cursos comparam o formato do cadastro');
    assert.deepEqual(comparacoes.filter(outro => outro !== 'public.formato_dos_cursos()'), []);
    assert.doesNotMatch(MIGRACAO, new RegExp(String.raw`\d\s*(?:${operador})\s*(?:${formato})`), 'nem com o número à esquerda');
    const comNumero = MIGRACAO.split('\n').map(l => l.replace(/--.*$/, '')).filter(l => /esquema/i.test(l) && /(?<![\w.])\d/.test(l));
    assert.deepEqual(comNumero, [], 'nenhum número na linha que lê o formato do cadastro (fora dos comentários)');
  });

  it('cada caso da gravação dos programas é uma verificação de cursos.test.sql (o nome é a descrição)', () => {
    const nomes = CASOS_DO_PROGRAMA.map(c => c.nome);
    assert.equal(new Set(nomes).size, nomes.length, 'sem nomes repetidos');
    for (const nome of nomes) assert.ok(!nome.includes("'"), `${nome}: sem aspas simples (o texto igual no SQL)`);
    assert.deepEqual(nomes.filter(nome => !TESTE_DO_BANCO.includes(`'${nome}');`)), []);
  });

  it('cursos.test.sql grava os mesmos programas dos casos', () => {
    assert.deepEqual(literalDoTeste('programa'), PROGRAMA);
    assert.deepEqual(literalDoTeste('noturno'), NOTURNO_EM_TRECHOS);
    assert.deepEqual(literalDoTeste('legado'), CASOS_DO_PROGRAMA.find(c => c.importar).importar.programas);
  });

  // O papel (42501) é do backend, e não da regra da gravação; o curso que não existe num resultado (23514, sem dica) é de
  // registrar_resultado, que o app confere em validarRegistro
  it('cada código de erro da migração, com a dica, tem um caso, e nenhum caso espera um erro que a migração não dá', () => {
    const chave = (code, campo) => (campo ? `${code} ${campo}` : code);
    const recusas = [...MIGRACAO.matchAll(/errcode = '(\w+)'(?:, hint = '(\w+)')?/g)];
    assert.equal(recusas.length, (MIGRACAO.match(/\braise exception\b/g) || []).length, 'cada recusa com o código no formato conhecido');
    const doBanco = new Set(recusas.map(([, code, campo]) => chave(code, campo)));
    const dosCasos = new Set(CASOS_DO_PROGRAMA.filter(c => c.erro).map(c => chave(c.erro.code, c.erro.campo)));
    const foraDaRegra = ['42501', '23514'];
    assert.deepEqual([...doBanco].filter(k => !foraDaRegra.includes(k) && !dosCasos.has(k)).sort(), [], 'erros sem caso');
    assert.deepEqual([...dosCasos].filter(k => !doBanco.has(k)), [], 'casos com um erro que a migração não dá');
  });
});

// O pedido com o recurso (a função de 11 argumentos) é a de 10, a que continua para as abas abertas, com o recurso a mais:
// as mesmas regras (quem pode, o horário, a duração, os 6 locais, o prazo e a exceção), na mesma ordem
describe('O banco espelha o app: o recurso do pedido da agenda', () => {
  const COM_RECURSO = ler('supabase/migrations/20261125230000_agenda_com_recurso.sql');
  const DE_ANTES = ler('supabase/migrations/20261114230012_agenda_limite_de_locais.sql');
  const funcao = texto => texto.slice(texto.indexOf('function public.registrar_solicitacao('), texto.indexOf('$$;'));
  const ASSINATURA = 'date, integer, text, text, text, text, numeric, text, text, boolean';

  it('o formato do recurso é o do app', () => {
    const [, formato] = /recurso ~ '([^']+)'/.exec(COM_RECURSO);
    assert.equal(formato, RECURSO_DO_PEDIDO.source);
  });

  it('a função nova é a de antes, só com o recurso a mais, e a de antes fica', () => {
    const nova = funcao(COM_RECURSO)
      .replace('p_excecao boolean,\n  p_recurso text\n', 'p_excecao boolean\n')
      .replace('horas, recurso, observacao', 'horas, observacao')
      .replace("v_horas, nullif(trim(p_recurso), ''), nullif(", 'v_horas, nullif(');
    assert.equal(nova, funcao(DE_ANTES));
    assert.doesNotMatch(COM_RECURSO, /drop function|create or replace/);
  });

  it('só quem está conectado chama a função nova', () => {
    assert.ok(COM_RECURSO.includes(`revoke execute on function public.registrar_solicitacao(${ASSINATURA}, text) from public, anon;`));
    assert.ok(COM_RECURSO.includes(`grant execute on function public.registrar_solicitacao(${ASSINATURA}, text) to authenticated;`));
  });
});

// A função de 13 argumentos (a migração #0b): a de 11 com a missão do curso e a confirmação do 7º voo local; os horários
// fixos, a lista dos voos locais e o limite são os do app, e cada caso de test/helpers/casos-da-agenda.js é uma
// verificação do banco
describe('O banco espelha o app: a missão do curso e o limite do pedido da agenda', () => {
  const MIGRACAO_0B = ler('supabase/migrations/20261127100000_missao_do_curso_e_limite_do_pedido.sql');
  const TESTES = ['agenda-missao-do-curso', 'agenda-locais'].map(nome => ler(`supabase/tests/database/${nome}.test.sql`)).join('\n');
  const ASSINATURA = 'date, integer, text, text, text, text, numeric, text, text, boolean, text, uuid, boolean';
  const corpo = MIGRACAO_0B.slice(MIGRACAO_0B.indexOf('create function public.registrar_solicitacao('), MIGRACAO_0B.indexOf('$$;'));

  it('o Noturno às 17:30 e o Voo Solo às 06:30, como os horários da missão no app', () => {
    const fixos = Object.fromEntries([...corpo.matchAll(/p_missao = '([^']+)' and p_horario is distinct from '(\d\d:\d\d)'/g)].map(r => [r[1], r[2]]));
    assert.deepEqual(fixos, HORARIOS_FIXOS);
    assert.deepEqual(fixos, { Noturno: hm(horariosDaMissao(null, 'Noturno', 'C172')[0]), 'Voo Solo': hm(horariosDaMissao(null, 'Voo Solo', 'C152')[0]) });
  });

  it('os voos locais e o limite são os do app', () => {
    const listas = [...corpo.matchAll(/missao in \(((?:'[^']*'(?:, )?)+)\)/g)].map(r => [...r[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
    assert.equal(listas.length, 2, 'o pedido e os que já estão na agenda');
    for (const lista of listas) assert.deepEqual(lista, MISSOES_LOCAIS);
    assert.match(corpo, new RegExp(`\\) >= ${LIMITE_DE_VOOS_LOCAIS} then`));
  });

  it('a função nova não tem valor padrão, só quem está conectado a chama, e as de antes ficam', () => {
    const cabeca = corpo.slice(0, corpo.indexOf(')'));
    assert.doesNotMatch(cabeca, /default|=/i);
    assert.ok(MIGRACAO_0B.includes(`revoke execute on function public.registrar_solicitacao(${ASSINATURA}) from public, anon;`));
    assert.ok(MIGRACAO_0B.includes(`grant execute on function public.registrar_solicitacao(${ASSINATURA}) to authenticated;`));
    assert.doesNotMatch(MIGRACAO_0B, /drop function|create or replace|drop column/);
    assert.match(corpo, /public\.missao_e_recurso_validos\(p_missao, v_recurso, v_horas\)/);
  });

  it('cada caso da agenda é uma verificação do banco (o nome é a descrição)', () => {
    const nomes = CASOS_DA_AGENDA.map(c => c.nome);
    assert.equal(new Set(nomes).size, nomes.length, 'sem nomes repetidos');
    for (const nome of nomes) assert.ok(!nome.includes("'"), `${nome}: sem aspas simples (o texto igual no SQL)`);
    assert.deepEqual(nomes.filter(nome => !TESTES.includes(`'${nome}');`)), []);
  });

  // As recusas novas (o recurso, o horário fixo e a missão do curso, a de 22023; o limite, PT422) têm um caso; as de
  // antes (quem pode, o horário específico, a duração e o prazo) são as da função de 11
  it('cada recusa nova da função tem um caso, e nenhum caso espera uma recusa que a função não dá', () => {
    const chave = (code, campo) => `${code} ${campo}`;
    const daFuncao = new Set([...corpo.matchAll(/errcode = '(\w+)', hint = '(\w+)'/g)].map(([, code, campo]) => chave(code, campo)));
    const dosCasos = new Set(CASOS_DA_AGENDA.filter(c => c.erro).map(c => chave(c.erro.code, c.erro.campo)));
    const deAntes = ['22023 horas'];
    assert.deepEqual([...daFuncao].filter(k => !deAntes.includes(k) && !dosCasos.has(k)).sort(), [], 'recusas sem caso');
    assert.deepEqual([...dosCasos].filter(k => !daFuncao.has(k)), [], 'casos com uma recusa que a função não dá');
  });
});
