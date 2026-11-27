// Backend Supabase: leitura com versão, gravação em série e controle de concorrência otimista.
// Usa um cliente falso com a mesma interface do supabase-js (from/select/filtros/order/limit/maybeSingle e rpc).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { criarBackendSupabase } from '../../js/backends/supabase.js';
import { situacaoPorMissao, validarRegistro } from '../../js/resultados.js';
import { cursosIniciais, gravarCurso, importarProgramas, programaComResultados, programaDoLegado } from '../../js/programa.js';
import { normalizarCursos } from '../../js/cursos.js';
import { FORMATO_DOS_CURSOS } from '../../js/migracoes.js';
import { PROGRAMA } from '../helpers/casos-do-programa.js';
import { CASOS_DA_AGENDA, CURSO_DOS_CASOS, DATA_DOS_CASOS, pedidoDosCasos, localDosCasos, guardadoDoCaso } from '../helpers/casos-da-agenda.js';
import { recusaDoPedido } from '../../js/agenda.js';
import { GROUND_DURATION_H, MISSOES_LOCAIS, LIMITE_DE_VOOS_LOCAIS } from '../../js/config.js';

const espera = ms => new Promise(r => setTimeout(r, ms));

// Tabelas em memória (documentos, dias e historico) com o mesmo contrato das funções do banco testadas em pgTAP. Os
// cursos (programa_dos_cursos, salvar_curso e importar_cursos) seguem as regras do servidor (js/programa.js) e começam
// como o banco: PP, PC e INVA vazios
function clienteFalso(documentos = {}, { atraso = 0, dias = {} } = {}) {
  const banco = new Map(Object.entries(documentos));
  const tabelaDias = new Map(Object.entries(dias));
  const historico = [];
  const solicitacoes = [];
  const resultados = [];
  const cursos = { lista: cursosIniciais(), alteracoes: [] };
  // Contas do servidor falso: a do usuário logado e as que o administrador gerencia
  const contas = [{ usuario: 'u-eu', email: 'eu@teste.acpm', senha: 'senha atual bem longa', nome: 'Eu', perfil: 'administrador' }];
  const atualizacoes = [];
  const rpcs = [];
  const chamadas = [];
  let falhasDeRede = 0;
  let recusas = [];

  const linhasDe = tabela => {
    if (tabela === 'documentos') return [...banco].map(([chave, d]) => ({ chave, ...d }));
    if (tabela === 'dias') return [...tabelaDias].map(([data, d]) => ({ data, ...d }));
    if (tabela === 'historico') return historico.map(h => ({ ...h }));
    if (tabela === 'solicitacoes') return solicitacoes.map(s => ({ ...s }));
    if (tabela === 'resultados_de_missao') return resultados.map(r => ({ ...r }));
    throw new Error(`tabela inesperada: ${tabela}`);
  };

  // Versão do formato do conteúdo (campo esquema); o servidor não aceita voltar a um formato mais antigo
  const esquema = conteudo => (conteudo && typeof conteudo.esquema === 'number' ? Math.floor(conteudo.esquema) : 0);
  const salvar = (mapa, chave, conteudo, versaoLida) => {
    const atual = mapa.get(chave);
    if (atual && esquema(conteudo) < esquema(atual.conteudo)) return { data: null, error: { code: 'PT409', message: 'formato mais novo', hint: 'formato' } };
    const versaoAtual = atual ? atual.versao : 0;
    if (versaoLida !== versaoAtual) return { data: null, error: { code: 'PT409', message: 'alterado por outra pessoa' } };
    mapa.set(chave, { conteudo, versao: versaoAtual + 1 });
    return { data: versaoAtual + 1, error: null };
  };
  // O que a gravação dos cursos confere: os cursos, os resultados e o cadastro (o formato e a versão)
  const estadoDosCursos = () => ({
    cursos: cursos.lista, resultados, cadastro: banco.has('cadastro') ? { esquema: esquema(banco.get('cadastro').conteudo), versao: banco.get('cadastro').versao } : null
  });
  // A recusa como o PostgREST manda: o código, a mensagem e a dica (o campo)
  const recusaDoBanco = e => ({ data: null, error: { code: e.code, message: e.message, hint: e.campo || null } });

  return {
    banco,
    // Os cursos que a função de 13 argumentos da agenda confere (a missão do curso do pedido)
    guardarCursos(lista) { cursos.lista = lista; },
    dias: tabelaDias,
    historico,
    cursos,
    rpcs,
    chamadas,
    falharProximas(n) { falhasDeRede = n; },
    // As próximas gravações (e registros no histórico) recebem este erro (ex.: { code: '42501' } com status 403)
    recusarProximas(n, erro, status) { recusas = Array.from({ length: n }, () => ({ erro, status })); },
    contas,
    atualizacoes,
    auth: {
      async signInWithPassword({ email, password }) {
        const conta = contas.find(c => c.email === email && c.senha === password);
        return conta ? { data: { session: { user: { email } } }, error: null } : { data: {}, error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' } };
      },
      async updateUser(atributos, opcoes = {}) {
        atualizacoes.push({ atributos: structuredClone(atributos), opcoes: structuredClone(opcoes) });
        if (atributos.password !== undefined) {
          if (atributos.password.length < 12) return { data: {}, error: { status: 422, code: 'weak_password', message: 'Password should be at least 12 characters.' } };
          contas[0].senha = atributos.password;
        }
        return { data: { user: { email: contas[0].email, new_email: atributos.email || undefined } }, error: null };
      }
    },
    from(tabela) {
      const filtros = [];
      let colunas = null, limite = null;
      const ordens = [];
      const resultado = () => {
        let linhas = linhasDe(tabela).filter(l => filtros.every(f => f(l)));
        const comparar = (a, b, { coluna, ascending }) => (a[coluna] < b[coluna] ? -1 : a[coluna] > b[coluna] ? 1 : 0) * (ascending ? 1 : -1);
        if (ordens.length) linhas.sort((a, b) => ordens.reduce((r, o) => r || comparar(a, b, o), 0));
        if (limite !== null) linhas = linhas.slice(0, limite);
        return structuredClone(colunas ? linhas.map(l => Object.fromEntries(colunas.map(c => [c, l[c] ?? null]))) : linhas);
      };
      const consulta = {
        select(lista) { colunas = lista === '*' ? null : lista.split(',').map(c => c.trim()); return consulta; },
        eq(c, v) { filtros.push(l => l[c] === v); return consulta; },
        gte(c, v) { filtros.push(l => l[c] >= v); return consulta; },
        lte(c, v) { filtros.push(l => l[c] <= v); return consulta; },
        lt(c, v) { filtros.push(l => l[c] < v); return consulta; },
        order(coluna, { ascending = true } = {}) { ordens.push({ coluna, ascending }); return consulta; },
        limit(n) { limite = n; return consulta; },
        async maybeSingle() { return { data: resultado()[0] ?? null, error: null }; },
        then(ok, erro) { return Promise.resolve({ data: resultado(), error: null }).then(ok, erro); }
      };
      return consulta;
    },
    async rpc(nome, args) {
      chamadas.push([nome, structuredClone(args)]);
      if (nome === 'salvar_documento' || nome === 'salvar_dia') rpcs.push(structuredClone(args));
      await espera(atraso);
      if (falhasDeRede > 0) { falhasDeRede--; return { data: null, error: { message: 'Failed to fetch', code: '' }, status: 0 }; }
      if (recusas.length && ['salvar_documento', 'salvar_dia', 'registrar_historico', 'programa_dos_cursos', 'salvar_curso', 'importar_cursos'].includes(nome)) {
        const { erro, status } = recusas.shift();
        return { data: null, error: erro, status };
      }
      if (nome === 'salvar_documento') {
        // Depois da conversão (o cadastro existe), os documentos antigos ficam só como cópia
        if (args.p_chave !== 'cadastro' && banco.has('cadastro')) return { data: null, error: { code: 'PT409', message: 'versão anterior do app' } };
        return salvar(banco, args.p_chave, args.p_conteudo, args.p_versao_lida);
      }
      if (nome === 'salvar_dia') return salvar(tabelaDias, args.p_data, args.p_conteudo, args.p_versao_lida);
      if (nome === 'registrar_historico') {
        const id = historico.length + 1;
        historico.push({ id, data: args.p_data, registrado_em: new Date(Date.UTC(2026, 10, 10, 12, 0, id)).toISOString(), autor: 'Operador',
          tipo: args.p_tipo, descricao: args.p_descricao, reverter: args.p_reverter, reverte: args.p_reverte, importado: false });
        return { data: id, error: null };
      }
      if (nome === 'importar_historico') {
        if (historico.some(h => h.importado)) return { data: 0, error: null };
        for (const e of args.p_entradas) {
          historico.push({ id: historico.length + 1, data: args.p_data, registrado_em: e.registrado_em, autor: null, tipo: e.tipo, descricao: e.descricao, reverter: null, reverte: null, importado: true });
        }
        return { data: args.p_entradas.length, error: null };
      }
      if (nome === 'programa_dos_cursos') return { data: programaComResultados({ cursos: cursos.lista, resultados, alteracoes: cursos.alteracoes }), error: null };
      if (nome === 'salvar_curso') {
        try {
          const r = gravarCurso(estadoDosCursos(), { sigla: args.p_sigla, versaoLida: args.p_versao_lida, conteudo: args.p_curso, descricao: args.p_descricao, autor: contas[0].nome });
          Object.assign(cursos, { lista: r.cursos, alteracoes: [...cursos.alteracoes, r.alteracao] });
          return { data: r.retorno, error: null };
        } catch (e) {
          return recusaDoBanco(e);
        }
      }
      if (nome === 'importar_cursos') {
        try {
          const r = importarProgramas(estadoDosCursos(), { programas: args.p_cursos, versaoDoCadastro: args.p_versao_do_cadastro, autor: contas[0].nome });
          Object.assign(cursos, { lista: r.cursos, alteracoes: [...cursos.alteracoes, ...r.alteracoes] });
          return { data: r.retorno, error: null };
        } catch (e) {
          return recusaDoBanco(e);
        }
      }
      if (nome === 'registrar_resultado') {
        try {
          // O curso tem de existir (os cursos do servidor)
          const r = validarRegistro({ aluno: args.p_aluno, curso: args.p_curso, missao: args.p_missao, resultado: args.p_resultado, data: args.p_data, voo: args.p_voo },
            { cursos: cursos.lista.map(c => c.sigla) });
          resultados.push({ id: resultados.length + 1, ...r, registrado_em: new Date(Date.UTC(2026, 10, 10, 12, 0, resultados.length)).toISOString(), registrado_por: 'Operador' });
          return { data: resultados.length, error: null };
        } catch (e) {
          return { data: null, error: { code: e.code, message: e.message } };
        }
      }
      if (nome === 'dias_em_formato_antigo') {
        return { data: [...tabelaDias].filter(([, d]) => esquema(d.conteudo) < args.p_esquema).map(([data]) => data).sort(), error: null };
      }
      if (nome === 'situacao_das_missoes') return { data: [...situacaoPorMissao(resultados).values()].map(({ id, ...r }) => r), error: null };
      if (nome === 'listar_contas') return { data: contas.map(({ senha, ...c }) => c), error: null };
      if (nome === 'criar_conta') {
        if (contas.some(c => c.email === args.p_email)) return { data: null, error: { code: '23505', message: 'já existe' } };
        contas.push({ usuario: `u-${contas.length}`, email: args.p_email, senha: args.p_senha, nome: args.p_nome, perfil: args.p_perfil });
        return { data: contas.at(-1).usuario, error: null };
      }
      if (nome === 'excluir_conta') {
        const i = contas.findIndex(c => c.usuario === args.p_usuario);
        if (i < 0) return { data: null, error: { code: 'P0002', message: 'não encontrada' } };
        contas.splice(i, 1);
        return { data: null, error: null };
      }
      if (nome === 'registrar_solicitacao') {
        // A função de 13 argumentos (a migração missao_do_curso_e_limite_do_pedido), com as regras dela
        // (test/helpers/casos-da-agenda.js) e o prazo simplificado: antes de 11/11, encerrado
        const horas = String(args.p_missao).startsWith('Ground') ? GROUND_DURATION_H : Math.round(+args.p_horas * 10) / 10;
        const recusa = recusaDoPedido({ missao: args.p_missao, recurso: args.p_recurso, horario: args.p_horario, horas, missaoDoCurso: args.p_missao_do_curso }, cursos.lista);
        if (recusa) return { data: null, error: { code: recusa.code, message: recusa.mensagem, hint: recusa.campo } };
        const locais = MISSOES_LOCAIS.includes(args.p_missao)
          && solicitacoes.filter(x => x.data === args.p_data && !x.cancelada_em && x.horario === args.p_horario && MISSOES_LOCAIS.includes(x.missao)).length >= LIMITE_DE_VOOS_LOCAIS;
        if (locais && !args.p_confirmar_limite) return { data: null, error: { code: 'PT422', message: 'já há 6 voos locais no horário', hint: 'locais' } };
        if (args.p_data < '2026-11-11') return { data: null, error: { code: 'PT403', message: 'prazo encerrado' } };
        const id = solicitacoes.length + 1;
        const registrado_em = new Date(Date.UTC(2026, 10, 10, 12, 0, id)).toISOString();
        solicitacoes.push({ id, data: args.p_data, aluno: args.p_aluno, aluno_nome: args.p_aluno_nome, missao: args.p_missao, janela: args.p_janela,
          horario: args.p_horario, horas, recurso: args.p_recurso.trim(), missao_do_curso: args.p_missao_do_curso, observacao: args.p_observacao, registrado_por: args.p_registrado_por, registrado_em,
          excecao: Boolean(args.p_excecao), limite_confirmado_por: locais ? 'Eu' : null, limite_confirmado_em: locais ? registrado_em : null, cancelada_em: null, cancelada_por: null });
        return { data: id, error: null };
      }
      if (nome === 'cancelar_solicitacao') {
        const s = solicitacoes.find(x => x.id === args.p_id && !x.cancelada_em);
        if (!s) return { data: null, error: { code: 'P0002', message: 'não encontrado' } };
        Object.assign(s, { cancelada_em: '2026-11-10T13:00:00.000Z', cancelada_por: args.p_cancelada_por });
        return { data: null, error: null };
      }
      throw new Error(`função inesperada: ${nome}`);
    }
  };
}

describe('Backend Supabase', () => {
  it('lê o documento e grava a partir da versão lida', async () => {
    const cliente = clienteFalso({ estado: { conteudo: { a: 1 }, versao: 3 } });
    const backend = criarBackendSupabase(cliente);
    assert.deepEqual(await backend.ler('estado'), { a: 1 });
    assert.equal(await backend.gravar('estado', { a: 2 }), true);
    assert.deepEqual(cliente.rpcs, [{ p_chave: 'estado', p_conteudo: { a: 2 }, p_versao_lida: 3 }]);
    assert.deepEqual(cliente.banco.get('estado'), { conteudo: { a: 2 }, versao: 4 });
  });

  it('documento inexistente é lido como null e a primeira gravação o cria', async () => {
    const cliente = clienteFalso();
    const backend = criarBackendSupabase(cliente);
    assert.equal(await backend.ler('bi'), null);
    assert.equal(await backend.gravar('bi', { d: 1 }), true);
    assert.equal(cliente.rpcs[0].p_versao_lida, 0);
    assert.deepEqual(cliente.banco.get('bi'), { conteudo: { d: 1 }, versao: 1 });
  });

  it('gravações seguidas do mesmo documento saem em série, só com o conteúdo mais recente', async () => {
    const cliente = clienteFalso({}, { atraso: 15 });
    const backend = criarBackendSupabase(cliente);
    await backend.ler('estado');
    const gravacoes = [backend.gravar('estado', 'A'), backend.gravar('estado', 'B'), backend.gravar('estado', 'C')];
    assert.deepEqual(await Promise.all(gravacoes), [true, true, true]);
    assert.deepEqual(cliente.rpcs.map(r => [r.p_conteudo, r.p_versao_lida]), [['A', 0], ['C', 1]]);
    assert.deepEqual(cliente.banco.get('estado'), { conteudo: 'C', versao: 2 });
  });

  it('documentos diferentes são gravados de forma independente', async () => {
    const cliente = clienteFalso();
    const backend = criarBackendSupabase(cliente);
    await Promise.all([backend.ler('estado'), backend.ler('escala')]);
    // A gravação do estado fica presa no servidor; a da escala não espera por ela
    let soltar;
    const rpc = cliente.rpc;
    cliente.rpc = async (nome, args) => {
      if (args.p_chave === 'estado') await new Promise(r => { soltar = r; });
      return rpc(nome, args);
    };
    const estado = backend.gravar('estado', 1);
    assert.equal(await Promise.race([backend.gravar('escala', 2), espera(50).then(() => 'esperou o estado')]), true);
    soltar();
    assert.equal(await estado, true);
    assert.deepEqual([cliente.banco.get('estado').versao, cliente.banco.get('escala').versao], [1, 1]);
  });

  it('conflito: avisa, não grava mais nada e responde false', async () => {
    const cliente = clienteFalso({ estado: { conteudo: 'meu', versao: 4 } });
    const conflitos = [];
    const backend = criarBackendSupabase(cliente, { aoConflito: (doc, motivo) => conflitos.push([doc, motivo]) });
    await backend.ler('estado');
    cliente.banco.set('estado', { conteudo: 'do colega', versao: 5 });

    assert.equal(await backend.gravar('estado', 'minha alteração'), false);
    assert.deepEqual(conflitos, [['estado', { formato: false }]]);
    assert.equal(await backend.gravar('historico', []), false);
    assert.equal(cliente.rpcs.length, 1, 'depois do conflito nada mais é enviado');
    assert.deepEqual(cliente.banco.get('estado'), { conteudo: 'do colega', versao: 5 });
  });

  it('recusa pelo formato (uma versão mais nova do app atualizou os dados): o conflito diz que é o formato', async () => {
    const cliente = clienteFalso({ cadastro: { conteudo: { esquema: 19 }, versao: 2 } });
    const conflitos = [];
    const backend = criarBackendSupabase(cliente, { aoConflito: (doc, motivo) => conflitos.push([doc, motivo]) });
    await backend.ler('cadastro');
    assert.equal(await backend.gravar('cadastro', { esquema: 18 }), false);
    assert.deepEqual(conflitos, [['cadastro', { formato: true }]]);
  });

  // O conflito no cadastro que o app resolve lendo a data de novo (aoConflito responde 'releitura'): a alteração não é
  // gravada, mas o backend não trava; a gravação seguinte, depois da leitura, sai com a versão nova
  it('conflito no cadastro com releitura: responde false, não trava, e a gravação depois da leitura sai', async () => {
    const cliente = clienteFalso({ cadastro: { conteudo: { v: 1 }, versao: 1 } });
    const conflitos = [];
    const backend = criarBackendSupabase(cliente, { aoConflito: (doc, motivo) => { conflitos.push([doc, motivo]); return 'releitura'; } });
    await backend.ler('cadastro');
    cliente.banco.set('cadastro', { conteudo: { v: 2, colega: true }, versao: 2 });
    assert.equal(await backend.gravar('cadastro', { v: 3 }), false);
    assert.deepEqual(conflitos, [['cadastro', { formato: false }]]);
    assert.deepEqual(cliente.banco.get('cadastro'), { conteudo: { v: 2, colega: true }, versao: 2 }, 'a alteração recusada não foi gravada');
    // A leitura traz a versão do colega; a alteração refeita é gravada em cima dela
    assert.deepEqual(await backend.ler('cadastro'), { v: 2, colega: true });
    assert.equal(await backend.gravar('cadastro', { v: 3, colega: true }), true);
    assert.deepEqual(cliente.banco.get('cadastro'), { conteudo: { v: 3, colega: true }, versao: 3 });
    // O histórico também continua sendo registrado
    assert.equal(typeof await backend.registrar({ data: '2026-11-20', tipo: 'mod', descricao: 'Peso Aluno 1000: 80 kg' }), 'number');
  });

  it('conflito sem releitura (qualquer outra resposta de aoConflito): trava como sempre', async () => {
    for (const resposta of [undefined, 'travar', true]) {
      const cliente = clienteFalso({ cadastro: { conteudo: { v: 1 }, versao: 1 } });
      const backend = criarBackendSupabase(cliente, { aoConflito: () => resposta });
      await backend.ler('cadastro');
      cliente.banco.set('cadastro', { conteudo: { v: 2 }, versao: 2 });
      assert.equal(await backend.gravar('cadastro', { v: 3 }), false);
      await backend.ler('cadastro');
      assert.equal(await backend.gravar('cadastro', { v: 3 }), false, `resposta ${resposta}: depois do conflito nada mais é gravado`);
      assert.equal(await backend.registrar({ data: '2026-11-20', tipo: 'mod', descricao: 'x' }), null);
    }
  });

  // A leitura só para consultar (o formato do cadastro, em "Tentar de novo") não troca a versão que a gravação seguinte
  // leva: a gravação dos dados da tela, lidos antes, não passa por cima do que outra pessoa gravou depois
  it('a leitura só para consultar não muda a versão lida: a gravação seguinte continua com a de antes', async () => {
    const cliente = clienteFalso({ cadastro: { conteudo: { v: 1 }, versao: 1 } });
    const conflitos = [];
    const backend = criarBackendSupabase(cliente, { aoConflito: doc => conflitos.push(doc) });
    await backend.ler('cadastro');
    cliente.banco.set('cadastro', { conteudo: { v: 2 }, versao: 2 });
    assert.deepEqual(await backend.ler('cadastro', { guardarVersao: false }), { v: 2 });
    assert.equal(await backend.gravar('cadastro', { v: 3 }), false);
    assert.deepEqual(conflitos, ['cadastro']);
    assert.deepEqual(cliente.banco.get('cadastro'), { conteudo: { v: 2 }, versao: 2 });
    // Uma leitura comum guarda a versão nova
    const outro = criarBackendSupabase(cliente);
    await outro.ler('cadastro', { guardarVersao: false });
    await outro.ler('cadastro');
    assert.equal(await outro.gravar('cadastro', { v: 3 }), true);
    assert.deepEqual(cliente.banco.get('cadastro'), { conteudo: { v: 3 }, versao: 3 });
  });

  // Sem conexão, a alteração não se perde: a gravação tenta de novo sozinha
  it('erro de rede: avisa a cada falha e tenta de novo sozinho, esperando cada vez mais, até gravar', async () => {
    const cliente = clienteFalso();
    const erros = [], gravados = [], esperas = [];
    const backend = criarBackendSupabase(cliente, {
      aoErro: (erro, doc, { definitivo }) => erros.push([doc, erro.message, definitivo]),
      aoGravar: doc => gravados.push(doc),
      esperar: tentativa => { esperas.push(tentativa); return espera(1); }
    });
    await backend.ler('estado');
    cliente.falharProximas(2);
    assert.equal(await backend.gravar('estado', 'A'), true);
    assert.deepEqual(erros, [['estado', 'Failed to fetch', false], ['estado', 'Failed to fetch', false]]);
    assert.deepEqual(esperas, [1, 2], 'cada tentativa espera mais');
    assert.deepEqual(gravados, ['estado'], 'avisa quando volta a gravar');
    assert.deepEqual(cliente.banco.get('estado'), { conteudo: 'A', versao: 1 });
  });

  it('enquanto espera para tentar de novo, a alteração mais recente toma o lugar da anterior', async () => {
    const cliente = clienteFalso();
    let liberar;
    const backend = criarBackendSupabase(cliente, { esperar: () => new Promise(r => { liberar = r; }) });
    await backend.ler('estado');
    cliente.falharProximas(1);
    const primeira = backend.gravar('estado', 'A');
    await espera(5);
    assert.equal(backend.temGravacoesPendentes(), true);
    const segunda = backend.gravar('estado', 'B');
    liberar();
    assert.deepEqual([await primeira, await segunda], [true, true]);
    assert.deepEqual(cliente.banco.get('estado'), { conteudo: 'B', versao: 1 });
    assert.equal(cliente.rpcs.length, 2, 'uma tentativa que falhou e uma com o conteúdo mais recente');
    assert.equal(backend.temGravacoesPendentes(), false);
  });

  it('sessão expirada (401): a alteração e o histórico esperam o novo login e são gravados depois', async () => {
    const cliente = clienteFalso();
    const pedidos = [];
    let renovar;
    const renovada = new Promise(r => { renovar = r; });
    const backend = criarBackendSupabase(cliente, { aoSessaoExpirada: () => { pedidos.push('login'); return renovada; }, esperar: () => espera(1) });
    await backend.ler('estado');
    cliente.recusarProximas(3, { code: 'PGRST301', message: 'JWT expired' }, 401);
    const gravacao = backend.gravar('estado', 'A');
    const outra = backend.gravar('dia:2026-11-11', { v: 1 });
    const registro = backend.registrar({ data: '2026-11-11', tipo: 'exc', descricao: 'PR-BTB: Manutenção' });
    await espera(5);
    assert.deepEqual(pedidos, ['login', 'login', 'login'], 'cada gravação pede (o app mostra um diálogo só)');
    assert.equal(backend.temGravacoesPendentes(), true);
    renovar();
    assert.deepEqual([await gravacao, await outra, await registro], [true, true, 1]);
    assert.deepEqual(cliente.banco.get('estado'), { conteudo: 'A', versao: 1 });
    assert.deepEqual(cliente.historico.map(h => h.descricao), ['PR-BTB: Manutenção']);
  });

  it('recusa definitiva (sem permissão, dado inválido): avisa e não tenta de novo', async () => {
    const cliente = clienteFalso();
    const erros = [];
    const backend = criarBackendSupabase(cliente, { aoErro: (erro, doc, { definitivo }) => erros.push([doc, erro.code, definitivo]), esperar: () => espera(1) });
    await backend.ler('estado');
    cliente.recusarProximas(1, { code: '23514', message: 'status de voo fora da lista' }, 400);
    assert.equal(await backend.gravar('estado', 'A'), false);
    assert.deepEqual(erros, [['estado', '23514', true]]);
    assert.equal(cliente.rpcs.length, 1);
    assert.equal(backend.temGravacoesPendentes(), false);
    assert.equal(await backend.gravar('estado', 'B'), true, 'a alteração seguinte grava normalmente');
  });

  it('erro na leitura é repassado para quem chamou', async () => {
    const cliente = clienteFalso();
    cliente.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'sem conexão' } }) }) }) });
    const backend = criarBackendSupabase(cliente);
    await assert.rejects(backend.ler('estado'), /sem conexão/);
  });
});

describe('Backend Supabase: contas', () => {
  it('administrador: lista, cria e exclui contas pelas funções do banco (o código do erro é repassado)', async () => {
    const cliente = clienteFalso();
    const backend = criarBackendSupabase(cliente);
    const id = await backend.criarConta({ email: 'nova@teste.acpm', senha: 'senha inicial longa', perfil: 'secretaria', nome: 'Nova' });
    assert.deepEqual(cliente.chamadas.at(-1), ['criar_conta', { p_email: 'nova@teste.acpm', p_senha: 'senha inicial longa', p_perfil: 'secretaria', p_nome: 'Nova' }]);
    assert.deepEqual((await backend.listarContas()).map(c => [c.email, c.perfil]), [['eu@teste.acpm', 'administrador'], ['nova@teste.acpm', 'secretaria']]);
    await assert.rejects(backend.criarConta({ email: 'nova@teste.acpm', senha: 'senha inicial longa', perfil: 'gestor', nome: 'De novo' }), e => e.code === '23505');
    await backend.excluirConta(id);
    assert.deepEqual(cliente.chamadas.at(-1), ['excluir_conta', { p_usuario: id }]);
    await assert.rejects(backend.excluirConta(id), e => e.code === 'P0002');
  });

  it('minha conta: troca a senha só depois de conferir a senha atual', async () => {
    const cliente = clienteFalso();
    const backend = criarBackendSupabase(cliente);
    await assert.rejects(backend.alterarSenha('eu@teste.acpm', 'errada', 'nova senha bem longa'), e => e.code === 'senha_atual');
    assert.deepEqual(cliente.atualizacoes, [], 'com a senha atual errada, nada é alterado');
    await assert.rejects(backend.alterarSenha('eu@teste.acpm', 'senha atual bem longa', 'curta'), e => e.code === 'weak_password');
    await backend.alterarSenha('eu@teste.acpm', 'senha atual bem longa', 'nova senha bem longa');
    assert.equal(cliente.contas[0].senha, 'nova senha bem longa');
  });

  it('minha conta: o e-mail novo fica pendente até a confirmação pelos links enviados', async () => {
    const cliente = clienteFalso();
    const backend = criarBackendSupabase(cliente);
    await assert.rejects(backend.alterarEmail('eu@teste.acpm', 'errada', 'novo@teste.acpm', 'https://exemplo/ACPM/'), e => e.code === 'senha_atual');
    const usuario = await backend.alterarEmail('eu@teste.acpm', 'senha atual bem longa', 'novo@teste.acpm', 'https://exemplo/ACPM/');
    assert.deepEqual([usuario.email, usuario.new_email], ['eu@teste.acpm', 'novo@teste.acpm']);
    assert.deepEqual(cliente.atualizacoes.at(-1), { atributos: { email: 'novo@teste.acpm' }, opcoes: { emailRedirectTo: 'https://exemplo/ACPM/' } });
  });
});

describe('Backend Supabase: escala por data e histórico', () => {
  it('escala de uma data: lê e grava na tabela dias com a versão lida (salvar_dia)', async () => {
    const cliente = clienteFalso({}, { dias: { '2026-11-11': { conteudo: { a: 1 }, versao: 2 } } });
    const backend = criarBackendSupabase(cliente);
    assert.deepEqual(await backend.ler('dia:2026-11-11'), { a: 1 });
    assert.equal(await backend.gravar('dia:2026-11-11', { a: 2 }), true);
    assert.deepEqual(cliente.chamadas.at(-1), ['salvar_dia', { p_data: '2026-11-11', p_conteudo: { a: 2 }, p_versao_lida: 2 }]);
    assert.deepEqual(cliente.dias.get('2026-11-11'), { conteudo: { a: 2 }, versao: 3 });
    assert.equal(await backend.ler('dia:2026-11-12'), null);
    assert.equal(await backend.gravar('dia:2026-11-12', { b: 1 }), true);
    assert.equal(cliente.dias.get('2026-11-12').versao, 1);
  });

  it('o cadastro continua na tabela documentos (salvar_documento)', async () => {
    const cliente = clienteFalso();
    const backend = criarBackendSupabase(cliente);
    assert.equal(await backend.ler('cadastro'), null);
    assert.equal(await backend.gravar('cadastro', { ins: [] }), true);
    assert.equal(cliente.chamadas.at(-1)[0], 'salvar_documento');
    assert.deepEqual(cliente.banco.get('cadastro'), { conteudo: { ins: [] }, versao: 1 });
  });

  it('lista as datas de um período em ordem e acha o dia anterior com escala', async () => {
    const dias = Object.fromEntries(['2026-11-12', '2026-10-30', '2026-11-01', '2026-11-30', '2026-12-01'].map(d => [d, { conteudo: { d }, versao: 1 }]));
    const backend = criarBackendSupabase(clienteFalso({}, { dias }));
    assert.deepEqual(await backend.listarDias('2026-11-01', '2026-11-30'), [
      { data: '2026-11-01', conteudo: { d: '2026-11-01' } },
      { data: '2026-11-12', conteudo: { d: '2026-11-12' } },
      { data: '2026-11-30', conteudo: { d: '2026-11-30' } }
    ]);
    assert.deepEqual(await backend.diaAnterior('2026-11-12'), { data: '2026-11-01', conteudo: { d: '2026-11-01' } });
    assert.equal(await backend.diaAnterior('2026-10-30'), null);
  });

  it('as datas num formato anterior vêm do servidor (dias_em_formato_antigo), sem baixar os dias', async () => {
    const dias = { '2026-11-10': { conteudo: { esquema: 17 }, versao: 1 }, '2026-11-11': { conteudo: { esquema: 18 }, versao: 1 }, '2026-11-12': { conteudo: {}, versao: 1 } };
    const cliente = clienteFalso({}, { dias });
    const backend = criarBackendSupabase(cliente);
    assert.deepEqual(await backend.diasEmFormatoAntigo(18), ['2026-11-10', '2026-11-12']);
    assert.deepEqual(cliente.chamadas.at(-1), ['dias_em_formato_antigo', { p_esquema: 18 }]);
  });

  it('histórico: registra pela função (com o que reverter), lista por data e importa', async () => {
    const cliente = clienteFalso();
    const backend = criarBackendSupabase(cliente);
    const a = await backend.registrar({ data: '2026-11-11', tipo: 'exc', descricao: 'PR-BTB: Manutenção', reverter: { kind: 'setAv' } });
    const b = await backend.registrar({ data: '2026-11-11', tipo: 'inc', descricao: 'Revertido: PR-BTB', reverte: a });
    await backend.registrar({ data: '2026-11-12', tipo: 'mod', descricao: 'Outra data' });
    assert.deepEqual(cliente.chamadas[0], ['registrar_historico', { p_data: '2026-11-11', p_tipo: 'exc', p_descricao: 'PR-BTB: Manutenção', p_reverter: { kind: 'setAv' }, p_reverte: null }]);
    const lista = await backend.listarHistorico('2026-11-11');
    assert.deepEqual(lista.map(e => [e.id, e.descricao, e.reverte, e.autor]), [[b, 'Revertido: PR-BTB', a, 'Operador'], [a, 'PR-BTB: Manutenção', null, 'Operador']]);
    assert.equal(await backend.importarHistorico('2026-11-11', [{ registrado_em: '2026-11-09T10:00:00.000Z', tipo: 'inc', descricao: 'Antiga' }]), 1);
    assert.equal(await backend.importarHistorico('2026-11-11', []), 0);
  });

  it('as leituras esperam as gravações em andamento deste navegador (não voltam a um conteúdo anterior)', async () => {
    const cliente = clienteFalso({ cadastro: { conteudo: { v: 1 }, versao: 1 } }, { atraso: 15, dias: { '2026-11-11': { conteudo: { v: 1 }, versao: 1 } } });
    const backend = criarBackendSupabase(cliente);
    await backend.ler('cadastro');
    await backend.ler('dia:2026-11-11');
    const gravacoes = [backend.gravar('cadastro', { v: 2 }), backend.gravar('dia:2026-11-11', { v: 2 })];
    assert.deepEqual(await backend.ler('cadastro'), { v: 2 });
    // Uma gravação nova antes de cada leitura seguinte: a leitura anterior já esperou as que estavam em andamento
    backend.gravar('dia:2026-11-11', { v: 3 });
    assert.deepEqual(await backend.diaAnterior('2026-11-12'), { data: '2026-11-11', conteudo: { v: 3 } });
    backend.gravar('dia:2026-11-11', { v: 4 });
    assert.deepEqual((await backend.listarDias('2026-11-01', '2026-11-30')).map(d => d.conteudo), [{ v: 4 }]);
    assert.deepEqual(await Promise.all(gravacoes), [true, true]);
    assert.equal(await backend.gravar('cadastro', { v: 4 }), true, 'a versão lida continua a mais recente');
  });

  it('agenda: registra e cancela pelas funções do banco, lista por período e repassa o código do erro e o campo', async () => {
    const cliente = clienteFalso();
    const backend = criarBackendSupabase(cliente);
    const id = await backend.registrarSolicitacao({ data: '2026-11-12', aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'IFR', janela: 'horario', horario: '14:30', horas: 2.6, registrado_por: 'Maria', recurso: 'C172' });
    assert.deepEqual(cliente.chamadas.at(-1), ['registrar_solicitacao', {
      p_data: '2026-11-12', p_aluno: 1000, p_aluno_nome: 'Aluno 1000', p_missao: 'IFR', p_janela: 'horario', p_horario: '14:30', p_horas: 2.6,
      p_registrado_por: 'Maria', p_observacao: null, p_excecao: false, p_recurso: 'C172', p_missao_do_curso: null, p_confirmar_limite: false
    }]);
    await backend.registrarSolicitacao({ data: '2026-11-11', aluno: 1001, aluno_nome: 'Aluno 1001', missao: 'Voo Local', janela: 'horario', horario: '08:20', horas: 1, registrado_por: 'Maria', recurso: 'C152' });
    assert.deepEqual((await backend.listarSolicitacoes('2026-11-01', '2026-11-30')).map(s => [s.data, s.aluno]), [['2026-11-11', 1001], ['2026-11-12', 1000]]);
    await assert.rejects(backend.registrarSolicitacao({ data: '2026-11-10', aluno: 1, aluno_nome: 'A', missao: 'Voo Local', janela: 'horario', horario: '08:20', horas: 1, registrado_por: 'M', recurso: 'C152' }), e => e.code === 'PT403');
    await assert.rejects(backend.registrarSolicitacao({ data: '2026-11-12', aluno: 1, aluno_nome: 'A', missao: 'Noturno', janela: 'horario', horario: '08:20', horas: 4, registrado_por: 'M', recurso: 'C172' }),
      e => e.code === '22023' && e.campo === 'horario');
    await backend.cancelarSolicitacao(id, 'Maria');
    assert.equal(cliente.chamadas.at(-1)[0], 'cancelar_solicitacao');
    await assert.rejects(backend.cancelarSolicitacao(id, 'Maria'), e => e.code === 'P0002');
  });

  // Sempre a função de 13 argumentos (a migração precede o app): nenhum erro chama outra, e a missão do curso e a
  // confirmação do 7º voo local vão com o pedido
  it('agenda: a missão do curso e a confirmação vão na função de 13 argumentos; nenhum erro chama outra função', async () => {
    const pedido = (extra = {}) => ({ data: '2026-11-12', aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Navegação', janela: 'horario', horario: '07:30', horas: 3, registrado_por: 'Maria', recurso: 'PA-34', ...extra });
    const cliente = clienteFalso();
    cliente.guardarCursos([...cursosIniciais(), CURSO_DOS_CASOS]);
    const backend = criarBackendSupabase(cliente);
    await backend.registrarSolicitacao(pedido({ missaoDoCurso: CURSO_DOS_CASOS.missoes[0].id, confirmarLimite: true }));
    assert.deepEqual(Object.keys(cliente.chamadas.at(-1)[1]).length, 13);
    assert.deepEqual([cliente.chamadas.at(-1)[1].p_missao_do_curso, cliente.chamadas.at(-1)[1].p_confirmar_limite], [CURSO_DOS_CASOS.missoes[0].id, true]);
    assert.deepEqual((await backend.listarSolicitacoes('2026-11-12', '2026-11-12')).map(s => [s.recurso, s.missao_do_curso]), [['PA-34', CURSO_DOS_CASOS.missoes[0].id]]);
    for (const erro of [{ code: 'PGRST202', message: 'Could not find the function' }, { code: '42883', message: 'does not exist' }, { code: '', message: 'TypeError: Failed to fetch' }]) {
      const outro = clienteFalso();
      const rpc = outro.rpc;
      const tamanhos = [];
      outro.rpc = async (nome, args) => {
        if (nome !== 'registrar_solicitacao') return rpc(nome, args);
        tamanhos.push(Object.keys(args).length);
        return { data: null, error: erro };
      };
      await assert.rejects(criarBackendSupabase(outro).registrarSolicitacao(pedido()), e => e.code === erro.code && e.message === erro.message);
      assert.deepEqual(tamanhos, [13], erro.message);
    }
  });

  // Os casos da função de 13 argumentos (test/helpers/casos-da-agenda.js): o pedido do app chega ao cliente pelos nomes, e
  // a recusa volta com o código e o campo
  for (const caso of CASOS_DA_AGENDA) {
    it(`agenda, caso: ${caso.nome}`, async () => {
      const cliente = clienteFalso();
      cliente.guardarCursos([...cursosIniciais(), CURSO_DOS_CASOS]);
      const backend = criarBackendSupabase(cliente);
      for (let n = 0; n < (caso.locais || 0); n++) await backend.registrarSolicitacao(localDosCasos(n));
      const registro = backend.registrarSolicitacao(pedidoDosCasos(caso.pedido));
      if (caso.erro) {
        await assert.rejects(registro, e => e.code === caso.erro.code && e.campo === caso.erro.campo);
        return;
      }
      const id = await registro;
      const [s] = (await backend.listarSolicitacoes(DATA_DOS_CASOS, DATA_DOS_CASOS)).filter(x => x.id === id);
      assert.deepEqual(guardadoDoCaso(s), caso.registrado);
    });
  }

  it('resultados das missões: registra pela função, lê a situação e os registros do dia; repassa o código do erro', async () => {
    const cliente = clienteFalso();
    const backend = criarBackendSupabase(cliente);
    const registro = { aluno: 1000, curso: 'PP', missao: 'PP-07', resultado: 'aprovado', data: '2026-11-11', voo: '1000_0_1' };
    const id = await backend.registrarResultado(registro);
    assert.deepEqual(cliente.chamadas.at(-1), ['registrar_resultado', { p_aluno: 1000, p_curso: 'PP', p_missao: 'PP-07', p_resultado: 'aprovado', p_data: '2026-11-11', p_voo: '1000_0_1' }]);
    assert.equal(id, 1);
    assert.deepEqual((await backend.situacaoDasMissoes()).map(r => [r.aluno, r.curso, r.missao, r.resultado]), [[1000, 'PP', 'PP-07', 'aprovado']]);
    assert.deepEqual((await backend.resultadosDoDia('2026-11-11')).map(r => [r.id, r.voo, r.resultado]), [[1, '1000_0_1', 'aprovado']]);
    assert.deepEqual(await backend.resultadosDoDia('2026-11-12'), []);
    // O curso que não existe no servidor ('XX'): 23514, como antes da lista de cursos
    await assert.rejects(backend.registrarResultado({ ...registro, curso: 'XX' }), { code: '23514', message: 'curso desconhecido' });
  });

  it('depois de um conflito, nada mais é gravado: nem outras datas nem o histórico', async () => {
    const cliente = clienteFalso({}, { dias: { '2026-11-11': { conteudo: {}, versao: 1 } } });
    const conflitos = [];
    const backend = criarBackendSupabase(cliente, { aoConflito: d => conflitos.push(d) });
    await backend.ler('dia:2026-11-11');
    cliente.dias.set('2026-11-11', { conteudo: { colega: true }, versao: 2 });
    assert.equal(await backend.gravar('dia:2026-11-11', { meu: true }), false);
    assert.deepEqual(conflitos, ['dia:2026-11-11']);
    assert.equal(await backend.gravar('dia:2026-11-12', {}), false);
    assert.equal(await backend.registrar({ data: '2026-11-11', tipo: 'mod', descricao: 'x' }), null);
    assert.deepEqual(cliente.chamadas.map(c => c[0]), ['salvar_dia']);
  });
});

describe('Backend Supabase: o programa dos cursos', () => {
  const NO_FORMATO = { cadastro: { conteudo: { esquema: FORMATO_DOS_CURSOS }, versao: 7 } };
  const ANTES_DO_FORMATO = { cadastro: { conteudo: { esquema: FORMATO_DOS_CURSOS - 1 }, versao: 7 } };

  it('lê os programas e grava um curso por chamadas únicas às funções do banco, com os argumentos delas', async () => {
    const cliente = clienteFalso(NO_FORMATO);
    const backend = criarBackendSupabase(cliente);
    assert.deepEqual((await backend.programaDosCursos()).map(c => [c.sigla, c.versao, c.missoes]), [['PP', 1, []], ['PC', 1, []], ['INVA', 1, []]]);
    assert.deepEqual(cliente.chamadas.at(-1), ['programa_dos_cursos', undefined]);
    const resposta = await backend.salvarCurso('ZZ9', 0, PROGRAMA, { descricao: 'Curso ZZ9 criado: Curso de teste', autor: 'ignorado: o servidor sabe quem é' });
    assert.deepEqual(cliente.chamadas.at(-1), ['salvar_curso', { p_sigla: 'ZZ9', p_versao_lida: 0, p_curso: PROGRAMA, p_descricao: 'Curso ZZ9 criado: Curso de teste' }]);
    assert.deepEqual([resposta.versao, typeof resposta.atualizado_em], [1, 'string']);
    const zz9 = (await backend.programaDosCursos()).at(-1);
    assert.deepEqual([zz9.sigla, zz9.versao, zz9.missoes.length, zz9.alteracoes.map(a => [a.versao, a.registrado_por])], ['ZZ9', 1, 5, [[1, 'Eu']]]);
    assert.deepEqual(cliente.rpcs, [], 'nada passa pela fila das gravações (salvar_documento e salvar_dia)');
  });

  it('a conversão leva a versão do cadastro lida por último (0 antes de ler); cadastro alterado depois: PT409', async () => {
    const cliente = clienteFalso(ANTES_DO_FORMATO);
    const backend = criarBackendSupabase(cliente);
    const programas = programaDoLegado(normalizarCursos({ PP: [{ id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local' }] }));
    await assert.rejects(backend.importarCursos(programas), { code: 'PT409', campo: null });
    assert.deepEqual(cliente.chamadas.at(-1), ['importar_cursos', { p_cursos: programas, p_versao_do_cadastro: 0 }]);
    await backend.ler('cadastro');
    assert.equal(await backend.importarCursos(programas), 1);
    assert.deepEqual(cliente.chamadas.at(-1), ['importar_cursos', { p_cursos: programas, p_versao_do_cadastro: 7 }]);
    // Depois de gravar o cadastro, a versão gravada (a conversão já feita: nada mais)
    assert.equal(await backend.gravar('cadastro', { esquema: FORMATO_DOS_CURSOS }), true);
    assert.equal(await backend.importarCursos(programas), 0);
    assert.equal(cliente.chamadas.at(-1)[1].p_versao_do_cadastro, 8);
  });

  it('a recusa traz o código e o campo (a dica do servidor) e fica com quem chamou: não trava as gravações', async () => {
    const cliente = clienteFalso(ANTES_DO_FORMATO, { dias: { '2026-11-11': { conteudo: {}, versao: 1 } } });
    const conflitos = [], erros = [];
    const backend = criarBackendSupabase(cliente, { aoConflito: d => conflitos.push(d), aoErro: (e, d) => erros.push(d) });
    await assert.rejects(backend.salvarCurso('ZZ9', 0, PROGRAMA, { descricao: 'Curso ZZ9 criado' }), { code: 'PT409', campo: 'formato' });
    cliente.banco.set('cadastro', NO_FORMATO.cadastro);
    const comCodigo = codigo => ({ ...PROGRAMA, missoes: PROGRAMA.missoes.map((m, i) => (i ? m : { ...m, codigo })) });
    await assert.rejects(backend.salvarCurso('ZZ9', 0, comCodigo('zz9 01'), { descricao: 'Curso ZZ9 criado' }), { code: '22023', campo: 'codigo' });
    await assert.rejects(backend.salvarCurso('ZZ9', 0, PROGRAMA, { descricao: '' }), { code: '22023', campo: 'descricao' });
    await assert.rejects(backend.salvarCurso('ZZ7', 1, PROGRAMA, { descricao: 'ZZ7: alteração' }), { code: 'P0002', campo: null });
    await backend.salvarCurso('ZZ9', 0, PROGRAMA, { descricao: 'Curso ZZ9 criado' });
    await assert.rejects(backend.salvarCurso('ZZ9', 0, PROGRAMA, { descricao: 'Curso ZZ9 criado' }), { code: 'PT409', campo: 'sigla' });
    await assert.rejects(backend.salvarCurso('ZZ9', 3, PROGRAMA, { descricao: 'ZZ9: alteração' }), { code: 'PT409', campo: null });
    cliente.recusarProximas(1, { code: '42501', message: 'somente o Administrador altera os cursos' }, 403);
    await assert.rejects(backend.salvarCurso('ZZ9', 1, PROGRAMA, { descricao: 'ZZ9: alteração' }), { code: '42501', campo: null, message: 'somente o Administrador altera os cursos' });
    cliente.recusarProximas(1, { code: '42501', message: 'permission denied for function programa_dos_cursos' }, 401);
    await assert.rejects(backend.programaDosCursos(), { code: '42501' });
    cliente.falharProximas(1);
    await assert.rejects(backend.importarCursos([]), { message: 'Failed to fetch' });
    assert.deepEqual([conflitos, erros], [[], []], 'nenhum aviso de conflito nem de erro das gravações');
    await backend.ler('dia:2026-11-11');
    assert.equal(await backend.gravar('dia:2026-11-11', { v: 2 }), true, 'as gravações continuam');
  });
});
