// O servidor Supabase falso dos testes E2E (test/e2e/supabase-falso.js) e o programa dos cursos, fora do navegador: as
// rotas do Playwright atendidas direto (a resposta como o supabase-js recebe: o status e o corpo). As funções dos cursos
// respondem como o banco (o código, a dica que o backend lê como campo e o status do PostgREST), e o programa que
// documentosAtuais põe nas tabelas é o que a conversão única deixa (o app não converte o cadastro no formato atual).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { criarSupabaseFalso, documentosAtuais, documentosFase3, CONTAS, URL_TESTE } from '../e2e/supabase-falso.js';
import { CASOS_DO_PROGRAMA, PROGRAMA } from '../helpers/casos-do-programa.js';
import { CASOS_DA_AGENDA, CURSO_DOS_CASOS, DATA_DOS_CASOS, pedidoDosCasos, localDosCasos, argumentosDoBanco, guardadoDoCaso } from '../helpers/casos-da-agenda.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';
import { normalizarCursos } from '../../js/cursos.js';
import { FORMATO_DOS_CURSOS } from '../../js/migracoes.js';
import { novoId, programaDoLegado, cursosIniciais } from '../../js/programa.js';

const DATA = '2026-11-11';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Os status do PostgREST para os códigos das funções (PTxyz: o status xyz)
const STATUS = { 42501: 403, PT403: 403, PT409: 409, PT422: 422, 23505: 409, P0002: 404, 22023: 400, 23514: 400 };
const LEGADO = { PP: [{ id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local', eq: 'C152', nb: 1 }, { id: 'PP-02', nome: 'Navegação', mis: 'Navegação', eq: 'C152', nb: 2 }], PC: [], INVA: [] };
const comPrograma = () => ({ ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' })] }), cursos: LEGADO });

// O servidor com as rotas instaladas: entrar (o token da sessão) e chamar uma função (rpc), como o supabase-js
async function conectar(servidor) {
  let atender;
  await servidor.instalar({ route: async (_padrao, fn) => { atender = fn; } });
  const pedir = async (caminho, corpo, token = null) => {
    let resposta = null;
    await atender({
      request: () => ({
        url: () => `${URL_TESTE}${caminho}`, method: () => 'POST', postDataJSON: () => corpo,
        headers: () => (token ? { authorization: `Bearer ${token}` } : {})
      }),
      fulfill: async ({ status = 200, body = '' }) => { resposta = { status, corpo: body ? JSON.parse(body) : null }; },
      abort: async motivo => { resposta = { abortado: motivo }; }
    });
    return resposta;
  };
  return {
    pedir,
    entrar: async conta => (await pedir('/auth/v1/token?grant_type=password', { email: conta.email, password: conta.senha })).corpo.access_token,
    rpc: (token, funcao, args = {}) => pedir(`/rest/v1/rpc/${funcao}`, args, token)
  };
}

// O cadastro guardado num formato e numa versão (só o que as funções dos cursos conferem)
const cadastroNoFormato = (esquema, versao) => ({ conteudo: { esquema, nid: 1000, ins: [], stu: [] }, versao });
// O programa lido sem os ids (os da conversão do app são novos a cada vez)
const semIds = programa => programa.map(c => ({
  ...c, fases: c.fases.map(({ id, requer, ...f }) => f), missoes: c.missoes.map(({ id, fase, requer, ...m }) => m)
}));
const porId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const semOrdemDasListas = c => ({ ...c, fases: [...c.fases].sort(porId), missoes: [...c.missoes].sort(porId) });

describe('Servidor falso dos testes E2E: os cursos', () => {
  it('documentosAtuais põe nas tabelas o programa que a conversão única deixa: o curso vazio fica sem fases', async () => {
    // A conversão de verdade: os documentos antigos e o operador trazendo o programa do cadastro, como o app manda
    const antigo = criarSupabaseFalso(documentosFase3(comPrograma(), DATA));
    const a = await conectar(antigo);
    const operadorA = await a.entrar(CONTAS.operador);
    const programas = programaDoLegado(normalizarCursos(antigo.banco.get('cadastro').conteudo.cursos), novoId);
    assert.deepEqual(await a.rpc(operadorA, 'importar_cursos', { p_cursos: programas, p_versao_do_cadastro: 1 }), { status: 200, corpo: 2 });
    const convertido = (await a.rpc(operadorA, 'programa_dos_cursos')).corpo;

    const atual = criarSupabaseFalso(documentosAtuais(comPrograma(), DATA));
    const b = await conectar(atual);
    const lido = (await b.rpc(await b.entrar(CONTAS.operador), 'programa_dos_cursos')).corpo;
    assert.deepEqual(semIds(lido), semIds(convertido));
    assert.deepEqual(lido.map(c => [c.sigla, c.versao, c.fases.map(f => f.nome), c.missoes.map(m => m.codigo), c.alteracoes.map(x => `${x.versao} ${x.descricao} · ${x.registrado_por}`)]), [
      ['PP', 2, ['Programa'], ['PP-01', 'PP-02'], ['2 Programa trazido do cadastro (2 missões) · Operador de Teste']],
      ['PC', 1, [], [], []],
      ['INVA', 1, [], [], []]
    ]);
    // Os ids são uuid e os mesmos a cada chamada (tirados da sigla e do código)
    const ids = lido.flatMap(c => [...c.fases, ...c.missoes].map(x => x.id));
    assert.ok(ids.every(id => UUID.test(id)));
    assert.deepEqual(documentosAtuais(comPrograma(), DATA).cursos, documentosAtuais(comPrograma(), DATA).cursos);
    // A versão registrada não fica no curso guardado (fica nas versões, como no banco)
    assert.equal(Object.hasOwn(atual.cursos[0], 'alteracoes'), false);
    // Trazer de novo o mesmo programa (antes do formato dos cursos) não grava nada
    atual.banco.set('cadastro', cadastroNoFormato(FORMATO_DOS_CURSOS - 1, 1));
    const antes = structuredClone(atual.cursos);
    assert.deepEqual(await b.rpc(await b.entrar(CONTAS.operador), 'importar_cursos', { p_cursos: programas, p_versao_do_cadastro: 1 }), { status: 200, corpo: 0 });
    assert.deepEqual(atual.cursos, antes);
  });

  it('salvar_curso e importar_cursos respondem como o banco nos casos de casos-do-programa.js (código, dica e status)', async () => {
    const nomes = { [CONTAS.administrador.id]: 'Administrador de teste', [CONTAS.operador.id]: 'Operador de teste' };
    for (const caso of CASOS_DO_PROGRAMA) {
      const servidor = criarSupabaseFalso({ cursos: caso.antes.cursos, nomes });
      servidor.resultados.push(...caso.antes.resultados.map((r, i) => ({ id: i + 1, aluno: 99001, resultado: 'aprovado', data: '2099-01-01', voo: null, ...r })));
      if (caso.antes.cadastro) servidor.banco.set('cadastro', cadastroNoFormato(caso.antes.cadastro.esquema, caso.antes.cadastro.versao));
      const { entrar, rpc } = await conectar(servidor);
      const token = await entrar(caso.salvar ? CONTAS.administrador : CONTAS.operador);
      const antes = structuredClone(servidor.cursos);
      const resposta = caso.salvar
        ? await rpc(token, 'salvar_curso', { p_sigla: caso.salvar.sigla, p_versao_lida: caso.salvar.versaoLida, p_curso: caso.salvar.conteudo, p_descricao: caso.salvar.descricao })
        : await rpc(token, 'importar_cursos', { p_cursos: caso.importar.programas, p_versao_do_cadastro: caso.importar.versaoDoCadastro });
      if (caso.erro) {
        assert.deepEqual([resposta.status, resposta.corpo.code, resposta.corpo.hint], [STATUS[caso.erro.code], caso.erro.code, caso.erro.campo], caso.nome);
        assert.deepEqual(servidor.cursos, antes, `${caso.nome}: a recusa não grava nada`);
        continue;
      }
      assert.equal(resposta.status, 200, caso.nome);
      assert.deepEqual(caso.salvar ? resposta.corpo.versao : resposta.corpo, caso.salvar ? caso.retorno.versao : caso.retorno, caso.nome);
      assert.deepEqual(semOrdemDasListas(servidor.cursos.find(c => c.sigla === caso.depois.sigla)), semOrdemDasListas(caso.depois), caso.nome);
      const { alteracoes } = (await rpc(token, 'programa_dos_cursos')).corpo.find(c => c.sigla === caso.depois.sigla);
      assert.deepEqual(alteracoes.map(({ registrado_em, ...x }) => ({ curso: caso.depois.sigla, ...x })), caso.alteracao ? [caso.alteracao] : [], caso.nome);
      assert.deepEqual(servidor.gravacoes, [], `${caso.nome}: não é gravação de documento`);
    }
  });

  it('quem lê e quem grava: os perfis da escala leem, só o Administrador grava e só os operadores trazem o programa', async () => {
    const servidor = criarSupabaseFalso(documentosAtuais(comPrograma(), DATA));
    const { entrar, rpc } = await conectar(servidor);
    const tokens = Object.fromEntries(await Promise.all(Object.entries(CONTAS).map(async ([perfil, conta]) => [perfil, await entrar(conta)])));
    for (const perfil of ['operador', 'administrador', 'gestor', 'secretaria']) {
      const { status, corpo } = await rpc(tokens[perfil], 'programa_dos_cursos');
      assert.deepEqual([status, corpo.map(c => c.sigla)], [200, ['PP', 'PC', 'INVA']], perfil);
    }
    for (const perfil of ['painel', 'semPerfil']) assert.deepEqual(await rpc(tokens[perfil], 'programa_dos_cursos'), { status: 200, corpo: [] }, perfil);

    const criar = token => rpc(token, 'salvar_curso', { p_sigla: 'ZZ9', p_versao_lida: 0, p_curso: PROGRAMA, p_descricao: 'Curso ZZ9 criado: Curso de teste' });
    servidor.banco.set('cadastro', cadastroNoFormato(FORMATO_DOS_CURSOS, 3));
    for (const perfil of ['operador', 'gestor', 'secretaria', 'painel', 'semPerfil']) {
      const { status, corpo } = await criar(tokens[perfil]);
      assert.deepEqual([status, corpo.code], [403, '42501'], perfil);
    }
    // Antes do formato dos cursos, o Administrador espera a conversão
    servidor.banco.set('cadastro', cadastroNoFormato(FORMATO_DOS_CURSOS - 1, 3));
    const esperando = await criar(tokens.administrador);
    assert.deepEqual([esperando.status, esperando.corpo.code, esperando.corpo.hint], [409, 'PT409', 'formato']);
    servidor.banco.set('cadastro', cadastroNoFormato(FORMATO_DOS_CURSOS, 3));
    const criado = await criar(tokens.administrador);
    assert.deepEqual([criado.status, criado.corpo.versao], [200, 1]);
    assert.deepEqual(servidor.cursos.map(c => c.sigla), ['PP', 'PC', 'INVA', 'ZZ9']);

    for (const perfil of ['gestor', 'secretaria', 'painel', 'semPerfil']) {
      const { status, corpo } = await rpc(tokens[perfil], 'importar_cursos', { p_cursos: [], p_versao_do_cadastro: 3 });
      assert.deepEqual([status, corpo.code], [403, '42501'], perfil);
    }
    // No formato dos cursos, a conversão não grava mais nada
    assert.deepEqual(await rpc(tokens.administrador, 'importar_cursos', { p_cursos: [{ ...PROGRAMA, sigla: 'PP' }], p_versao_do_cadastro: 3 }), { status: 200, corpo: 0 });

    // O resultado só vale para um curso das tabelas (o curso criado também)
    const resultado = curso => rpc(tokens.operador, 'registrar_resultado', { p_aluno: 1000, p_curso: curso, p_missao: `${curso}-01`, p_resultado: 'aprovado', p_data: DATA, p_voo: null });
    const desconhecido = await resultado('ZZ8');
    assert.deepEqual([desconhecido.status, desconhecido.corpo.code, desconhecido.corpo.message], [400, '23514', 'curso desconhecido']);
    assert.deepEqual(await resultado('ZZ9'), { status: 200, corpo: 1 });
    assert.deepEqual((await rpc(tokens.gestor, 'programa_dos_cursos')).corpo.find(c => c.sigla === 'ZZ9').missoes.filter(m => m.comResultados).map(m => m.codigo), ['ZZ9-01']);
  });
});

// A sessão no Auth falso (a TV da recepção, js/sessao-da-tv.js): a renovação troca os dois tokens e o refresh token vale
// uma vez; revogadas as sessões, nem o token nem o refresh token valem; a validade da sessão vem só como expires_in
describe('Servidor falso dos testes E2E: a sessão', () => {
  const login = (pedir, conta, senha = conta.senha) => pedir('/auth/v1/token?grant_type=password', { email: conta.email, password: senha });
  const renovar = (pedir, refresh) => pedir('/auth/v1/token?grant_type=refresh_token', { refresh_token: refresh });

  it('a renovação troca os dois tokens; o refresh token já usado é recusado', async () => {
    const servidor = criarSupabaseFalso();
    const { pedir, rpc } = await conectar(servidor);
    const sessao = (await login(pedir, CONTAS.painel)).corpo;
    assert.equal(typeof sessao.expires_at, 'number');
    const nova = await renovar(pedir, sessao.refresh_token);
    assert.equal(nova.status, 200);
    assert.notEqual(nova.corpo.access_token, sessao.access_token);
    assert.notEqual(nova.corpo.refresh_token, sessao.refresh_token);
    assert.equal((await rpc(nova.corpo.access_token, 'painel_do_dia')).status, 200);
    const usada = await renovar(pedir, sessao.refresh_token);
    assert.deepEqual([usada.status, usada.corpo.error_code], [400, 'refresh_token_not_found']);
    assert.deepEqual(servidor.renovacoes, [{ perfil: 'painel', aceita: true }, { perfil: null, aceita: false }]);
  });

  it('com a validade da sessão, só o expires_in (o supabase-js conta do relógio da página)', async () => {
    const { pedir } = await conectar(criarSupabaseFalso({ validadeDaSessao: 900 }));
    const sessao = (await login(pedir, CONTAS.painel)).corpo;
    assert.equal(sessao.expires_in, 900);
    assert.equal('expires_at' in sessao, false);
    assert.equal('expires_at' in (await renovar(pedir, sessao.refresh_token)).corpo, false);
  });

  it('revogadas as sessões, o token dá 401 e a renovação é recusada; a senha trocada recusa o login', async () => {
    const servidor = criarSupabaseFalso();
    const { pedir, rpc } = await conectar(servidor);
    const sessao = (await login(pedir, CONTAS.painel)).corpo;
    servidor.revogarSessoes();
    assert.equal((await rpc(sessao.access_token, 'painel_do_dia')).status, 401);
    assert.equal((await renovar(pedir, sessao.refresh_token)).status, 400);
    servidor.trocarSenha(CONTAS.painel, 'senha-nova-da-tv');
    assert.deepEqual([(await login(pedir, CONTAS.painel)).status, (await login(pedir, CONTAS.painel, 'senha-nova-da-tv')).status], [400, 200]);
  });

  it('expirados os tokens anteriores, só o último de cada conta vale', async () => {
    const servidor = criarSupabaseFalso();
    const { pedir, rpc } = await conectar(servidor);
    const primeira = (await login(pedir, CONTAS.painel)).corpo;
    const segunda = (await renovar(pedir, primeira.refresh_token)).corpo;
    const operador = (await login(pedir, CONTAS.operador)).corpo;
    servidor.expirarTokensAnteriores();
    assert.equal((await rpc(primeira.access_token, 'painel_do_dia')).status, 401);
    assert.equal((await rpc(segunda.access_token, 'painel_do_dia')).status, 200);
    assert.equal((await rpc(operador.access_token, 'painel_do_dia')).status, 200);
  });
});

// Os casos da função de 13 argumentos da agenda (test/helpers/casos-da-agenda.js), pela Secretaria, com o curso ZZ1 nas
// tabelas dos cursos
describe('Servidor falso dos testes E2E: a agenda (a função de 13 argumentos)', () => {
  for (const caso of CASOS_DA_AGENDA) {
    it(caso.nome, async () => {
      const servidor = criarSupabaseFalso({ cursos: [...cursosIniciais(), CURSO_DOS_CASOS] });
      const { entrar, rpc } = await conectar(servidor);
      const token = await entrar(CONTAS.secretaria);
      for (let n = 0; n < (caso.locais || 0); n++) assert.equal((await rpc(token, 'registrar_solicitacao', argumentosDoBanco(localDosCasos(n)))).status, 200);
      const r = await rpc(token, 'registrar_solicitacao', argumentosDoBanco(pedidoDosCasos(caso.pedido)));
      if (caso.erro) {
        assert.deepEqual([r.status, r.corpo.code, r.corpo.hint], [STATUS[caso.erro.code] || 400, caso.erro.code, caso.erro.campo]);
        assert.equal(servidor.solicitacoes.filter(s => s.data === DATA_DOS_CASOS).length, caso.locais || 0);
        return;
      }
      assert.equal(r.status, 200);
      assert.deepEqual(guardadoDoCaso(servidor.solicitacoes.find(s => s.id === r.corpo)), caso.registrado);
    });
  }

  it('o 7º voo local confirmado guarda o nome da conta e a hora do servidor', async () => {
    const servidor = criarSupabaseFalso({ cursos: [...cursosIniciais(), CURSO_DOS_CASOS] });
    const { entrar, rpc } = await conectar(servidor);
    const token = await entrar(CONTAS.secretaria);
    for (let n = 0; n < 6; n++) await rpc(token, 'registrar_solicitacao', argumentosDoBanco(localDosCasos(n)));
    const r = await rpc(token, 'registrar_solicitacao', argumentosDoBanco(pedidoDosCasos({ missao: 'Voo Local', confirmarLimite: true })));
    const s = servidor.solicitacoes.find(x => x.id === r.corpo);
    assert.deepEqual([s.limite_confirmado_por, s.limite_confirmado_em], ['Secretaria de Teste', '2026-11-10T15:00:00.000Z']);
  });
});
