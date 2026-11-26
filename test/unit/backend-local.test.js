// Backend local (localStorage) e a troca de backend do ApiClient.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { backendLocal } from '../../js/backends/local.js';
import { ApiClient } from '../../js/storage.js';
import { FORMATO_DOS_CURSOS } from '../../js/migracoes.js';
import { programaDoLegado } from '../../js/programa.js';
import { normalizarCursos } from '../../js/cursos.js';
import { simularNavegador } from '../helpers/navegador.js';
import { PROGRAMA, IDS } from '../helpers/casos-do-programa.js';

beforeEach(() => simularNavegador());

describe('Backend local (localStorage)', () => {
  it('grava e lê cada documento na sua chave do localStorage', async () => {
    const chaves = { estado: 'acpm3', escala: 'acpm3_res', historico: 'acpm3_audit', bi: 'acpm3_bi' };
    for (const [documento, chaveLocal] of Object.entries(chaves)) {
      assert.equal(await backendLocal.gravar(documento, { documento }), true);
      assert.deepEqual(JSON.parse(localStorage.getItem(chaveLocal)), { documento });
      assert.deepEqual(await backendLocal.ler(documento), { documento });
    }
  });

  it('documento ausente ou corrompido é lido como null', async () => {
    assert.equal(await backendLocal.ler('escala'), null);
    localStorage.setItem('acpm3_bi', '{corrompido');
    assert.equal(await backendLocal.ler('bi'), null);
  });

  it('recusa documentos desconhecidos', async () => {
    await assert.rejects(backendLocal.ler('outro'), /documento desconhecido/);
    await assert.rejects(backendLocal.gravar('outro', {}), /documento desconhecido/);
  });
});

describe('Backend local: escala por data, cadastro e histórico', () => {
  it('grava e lê o cadastro e a escala de cada data em chaves próprias', async () => {
    assert.equal(await backendLocal.gravar('cadastro', { ins: [] }), true);
    assert.deepEqual(JSON.parse(localStorage.getItem('acpm4_cadastro')), { ins: [] });
    assert.equal(await backendLocal.gravar('dia:2026-11-11', { v: 1 }), true);
    assert.deepEqual(JSON.parse(localStorage.getItem('acpm4_dia_2026-11-11')), { v: 1 });
    assert.deepEqual(await backendLocal.ler('dia:2026-11-11'), { v: 1 });
    assert.equal(await backendLocal.ler('dia:2026-11-12'), null);
    await assert.rejects(backendLocal.ler('dia:amanhã'), /documento desconhecido/);
  });

  it('as datas guardadas num formato anterior (a atualização do formato lê só essas)', async () => {
    localStorage.setItem('acpm4_dia_2026-11-10', JSON.stringify({ esquema: 17 }));
    localStorage.setItem('acpm4_dia_2026-11-11', JSON.stringify({ esquema: 18 }));
    localStorage.setItem('acpm4_dia_2026-11-12', JSON.stringify({ v: 1 }));
    localStorage.setItem('acpm4_dia_2026-11-13', '{corrompido');
    assert.deepEqual(await backendLocal.diasEmFormatoAntigo(18), ['2026-11-10', '2026-11-12', '2026-11-13']);
  });

  it('lista as datas de um período em ordem e acha o dia anterior com escala', async () => {
    for (const d of ['2026-11-12', '2026-10-30', '2026-11-01', '2026-11-30', '2026-12-01']) await backendLocal.gravar(`dia:${d}`, { d });
    localStorage.setItem('acpm3', '{}');
    assert.deepEqual((await backendLocal.listarDias('2026-11-01', '2026-11-30')).map(x => x.data), ['2026-11-01', '2026-11-12', '2026-11-30']);
    assert.deepEqual(await backendLocal.diaAnterior('2026-11-12'), { data: '2026-11-01', conteudo: { d: '2026-11-01' } });
    assert.deepEqual(await backendLocal.diaAnterior('2027-01-01'), { data: '2026-12-01', conteudo: { d: '2026-12-01' } });
    assert.equal(await backendLocal.diaAnterior('2026-10-30'), null);
  });

  it('histórico: registra com data, lista por data (mais recente primeiro) e importa uma vez só', async () => {
    const a = await backendLocal.registrar({ data: '2026-11-11', tipo: 'exc', descricao: 'PR-BTB: Manutenção', reverter: { kind: 'setAv' } });
    const b = await backendLocal.registrar({ data: '2026-11-11', tipo: 'inc', descricao: 'Revertido: PR-BTB', reverte: a });
    await backendLocal.registrar({ data: '2026-11-12', tipo: 'mod', descricao: 'Outra data' });
    const lista = await backendLocal.listarHistorico('2026-11-11');
    assert.deepEqual(lista.map(e => [e.id, e.descricao, e.reverte]), [[b, 'Revertido: PR-BTB', a], [a, 'PR-BTB: Manutenção', null]]);
    assert.deepEqual(lista[1].reverter, { kind: 'setAv' });
    assert.equal(lista[0].autor, null);

    assert.equal(await backendLocal.importarHistorico('2026-11-11', [{ registrado_em: '2026-11-09T10:00:00.000Z', tipo: 'inc', descricao: 'Antiga' }]), 1);
    assert.equal(await backendLocal.importarHistorico('2026-11-11', [{ tipo: 'inc', descricao: 'De novo' }]), 0);
    const depois = await backendLocal.listarHistorico('2026-11-11');
    assert.deepEqual(depois.map(e => e.descricao), ['Revertido: PR-BTB', 'PR-BTB: Manutenção', 'Antiga']);
    assert.deepEqual([depois[2].importado, depois[2].registrado_em], [true, '2026-11-09T10:00:00.000Z']);
  });
});

describe('Backend local: agenda de solicitações', () => {
  const antesDas13 = new Date('2026-11-10T12:00:00-03:00');
  const depoisDas13 = new Date('2026-11-10T13:30:00-03:00');
  // O pedido é num horário específico, com a duração
  const pedido = (extra = {}) => ({ data: '2026-11-11', aluno: 1000, aluno_nome: ' Aluno 1000 ', missao: 'Voo Local', janela: 'horario', horario: '06:30', horas: 1, registrado_por: ' Maria ', ...extra });

  it('registra no prazo com quem anotou, a hora e a duração; lista por período em ordem', async () => {
    const id = await backendLocal.registrarSolicitacao(pedido(), antesDas13);
    await backendLocal.registrarSolicitacao(pedido({ data: '2026-11-16', aluno: 1001, horario: '14:30', horas: 2.64, observacao: ' PP-ABP ' }), antesDas13);
    const lista = await backendLocal.listarSolicitacoes('2026-11-01', '2026-11-30');
    assert.deepEqual(lista.map(s => [s.data, s.aluno]), [['2026-11-11', 1000], ['2026-11-16', 1001]]);
    assert.deepEqual([lista[0].id, lista[0].aluno_nome, lista[0].registrado_por, lista[0].excecao, lista[0].registrado_em], [id, 'Aluno 1000', 'Maria', false, antesDas13.toISOString()]);
    assert.deepEqual([lista[1].horario, lista[1].horas, lista[1].observacao], ['14:30', 2.6, 'PP-ABP']);
    assert.deepEqual(await backendLocal.listarSolicitacoes('2026-11-12', '2026-11-14'), []);
  });

  it('fora do prazo: recusa (403), a não ser pela exceção da coordenação, que fica marcada', async () => {
    await assert.rejects(backendLocal.registrarSolicitacao(pedido(), depoisDas13), e => e.code === 'PT403');
    await backendLocal.registrarSolicitacao(pedido({ excecao: true }), depoisDas13);
    assert.equal((await backendLocal.listarSolicitacoes('2026-11-11', '2026-11-11'))[0].excecao, true);
  });

  it('"Registrado por" é obrigatório; o horário é específico; a duração vai de 0,1 h a 5 h (o Ground, 01h30)', async () => {
    await assert.rejects(backendLocal.registrarSolicitacao(pedido({ registrado_por: '  ' }), antesDas13), e => e.code === '23514');
    await assert.rejects(backendLocal.registrarSolicitacao(pedido({ horario: null }), antesDas13), e => e.code === '22023');
    await assert.rejects(backendLocal.registrarSolicitacao(pedido({ janela: 'manha' }), antesDas13), e => e.code === '22023');
    await assert.rejects(backendLocal.registrarSolicitacao(pedido({ horas: 5.5 }), antesDas13), e => e.code === '22023');
    await assert.rejects(backendLocal.registrarSolicitacao(pedido({ horas: 0 }), antesDas13), e => e.code === '22023');
    await backendLocal.registrarSolicitacao(pedido({ missao: 'Ground C152', horas: 3 }), antesDas13);
    assert.equal((await backendLocal.listarSolicitacoes('2026-11-11', '2026-11-11'))[0].horas, 1.5);
  });

  it('guarda o recurso do pedido (sem ele, null); um texto que não é um recurso é recusado, como no servidor', async () => {
    for (const recurso of ['PA-34', ' Sim. Mono ', '', null, undefined]) await backendLocal.registrarSolicitacao(pedido({ missao: 'Navegação', ...(recurso === undefined ? {} : { recurso }) }), antesDas13);
    assert.deepEqual((await backendLocal.listarSolicitacoes('2026-11-11', '2026-11-11')).map(s => s.recurso), ['PA-34', 'Sim. Mono', null, null, null]);
    await assert.rejects(backendLocal.registrarSolicitacao(pedido({ recurso: '<b>' }), antesDas13), e => e.code === '23514');
    await assert.rejects(backendLocal.registrarSolicitacao(pedido({ recurso: 'C'.repeat(31) }), antesDas13), e => e.code === '23514');
    assert.equal((await backendLocal.listarSolicitacoes('2026-11-11', '2026-11-11')).length, 5);
  });

  // No máximo 6 voos locais no mesmo horário, como no servidor
  it('o 7º voo local no mesmo horário é recusado (PT422); outra missão passa', async () => {
    for (let i = 0; i < 6; i++) await backendLocal.registrarSolicitacao(pedido({ aluno: 2000 + i, missao: ['Voo Local', 'Voo Solo', 'TGL (TMA)'][i % 3], horario: '08:20' }), antesDas13);
    await assert.rejects(backendLocal.registrarSolicitacao(pedido({ aluno: 2010, horario: '08:20' }), antesDas13), e => e.code === 'PT422');
    await backendLocal.registrarSolicitacao(pedido({ aluno: 2011, missao: 'Navegação', horario: '08:20' }), antesDas13);
  });

  it('cancela guardando quem cancelou (uma vez só); o pedido continua na agenda', async () => {
    const id = await backendLocal.registrarSolicitacao(pedido(), antesDas13);
    await backendLocal.cancelarSolicitacao(id, ' Maria ', antesDas13);
    const [s] = await backendLocal.listarSolicitacoes('2026-11-11', '2026-11-11');
    assert.deepEqual([s.cancelada_por, s.cancelada_em], ['Maria', antesDas13.toISOString()]);
    await assert.rejects(backendLocal.cancelarSolicitacao(id, 'Maria'), e => e.code === 'P0002');
  });
});

describe('Backend local: resultados das missões', () => {
  const registro = { aluno: 1000, curso: 'PP', missao: 'PP-07', resultado: 'reprovado', data: '2026-11-10', voo: '1000_0_1' };

  it('registra com quem registrou; a situação é o último registro; lê os registros do dia', async () => {
    const primeiro = await backendLocal.registrarResultado(registro, { autor: 'Maria' });
    const segundo = await backendLocal.registrarResultado({ ...registro, missao: ' pp-07 ', resultado: 'aprovado', data: '2026-11-11' }, { autor: 'Maria' });
    assert.ok(segundo > primeiro);
    assert.deepEqual((await backendLocal.situacaoDasMissoes()).map(r => [r.missao, r.resultado, r.data, r.registrado_por]), [['PP-07', 'aprovado', '2026-11-11', 'Maria']]);
    assert.deepEqual((await backendLocal.resultadosDoDia('2026-11-10')).map(r => [r.id, r.resultado]), [[primeiro, 'reprovado']]);
  });

  it('valida como o servidor e nunca apaga nem altera', async () => {
    await assert.rejects(backendLocal.registrarResultado({ ...registro, resultado: 'talvez' }), e => e.code === '23514');
    await backendLocal.registrarResultado(registro);
    await backendLocal.registrarResultado({ ...registro, resultado: 'pendente' });
    assert.deepEqual((await backendLocal.resultadosDoDia('2026-11-10')).map(r => r.resultado), ['reprovado', 'pendente']);
  });

  it('o curso tem de existir (23514): os três de hoje, sem programa gravado; depois, os cursos gravados', async () => {
    await assert.rejects(backendLocal.registrarResultado({ ...registro, curso: 'ZZ9', missao: 'ZZ9-01' }), { code: '23514', message: 'curso desconhecido' });
    await backendLocal.registrarResultado({ ...registro, curso: 'INVA' });
    localStorage.setItem('acpm4_cadastro', JSON.stringify({ esquema: FORMATO_DOS_CURSOS }));
    await backendLocal.salvarCurso('ZZ9', 0, PROGRAMA, { descricao: 'Curso ZZ9 criado: Curso de teste' });
    await backendLocal.registrarResultado({ ...registro, curso: 'ZZ9', missao: 'ZZ9-01' });
    await assert.rejects(backendLocal.registrarResultado({ ...registro, curso: 'XX' }), { code: '23514' });
    assert.deepEqual((await backendLocal.resultadosDoDia('2026-11-10')).map(r => r.curso), ['INVA', 'ZZ9']);
  });
});

describe('Backend local: o programa dos cursos (as regras do servidor, js/programa.js)', () => {
  const agora = new Date('2026-11-18T13:00:00.000Z');
  const comCadastro = esquema => localStorage.setItem('acpm4_cadastro', JSON.stringify({ nid: 1000, ins: [], stu: [], esquema }));
  const guardado = () => localStorage.getItem('acpm4_cursos');
  const criarZZ9 = () => backendLocal.salvarCurso('ZZ9', 0, PROGRAMA, { descricao: 'Curso ZZ9 criado: Curso de teste', autor: 'Maria', agora });

  it('sem programa gravado: PP, PC e INVA vazios, na versão 1, como o servidor começa; a leitura não grava a chave', async () => {
    const programa = await backendLocal.programaDosCursos();
    assert.deepEqual(programa.map(c => [c.sigla, c.nome, c.ordem, c.ativo, c.versao, c.fases, c.missoes, c.alteracoes]), [
      ['PP', 'Piloto Privado', 0, true, 1, [], [], []], ['PC', 'Piloto Comercial', 1, true, 1, [], [], []], ['INVA', 'Instrutor de Voo', 2, true, 1, [], [], []]
    ]);
    assert.equal(guardado(), null);
    assert.equal(localStorage.length, 0);
  });

  it('grava o curso como o servidor: a versão, a ordem, as alterações com quem gravou e as missões que já têm resultados', async () => {
    comCadastro(FORMATO_DOS_CURSOS);
    assert.deepEqual(await criarZZ9(), { versao: 1, atualizado_em: agora.toISOString() });
    await backendLocal.registrarResultado({ aluno: 1000, curso: 'ZZ9', missao: 'ZZ9-01', resultado: 'reprovado', data: '2026-11-18', voo: null });
    const semM5 = { ...PROGRAMA, nome: 'Curso de teste (novo nome)', missoes: PROGRAMA.missoes.filter(m => m.id !== IDS.m5) };
    assert.equal((await backendLocal.salvarCurso('ZZ9', 1, semM5, { descricao: 'ZZ9: ZZ9-05 tirada do programa', agora })).versao, 2);
    const zz9 = (await backendLocal.programaDosCursos()).find(c => c.sigla === 'ZZ9');
    assert.deepEqual([zz9.nome, zz9.ordem, zz9.versao], ['Curso de teste (novo nome)', 3, 2]);
    assert.deepEqual(zz9.missoes.map(m => [m.codigo, m.removida, m.comResultados]),
      [['ZZ9-01', false, true], ['ZZ9-02', false, false], ['ZZ9-03', false, false], ['ZZ9-04', false, false], ['ZZ9-05', true, false]]);
    assert.deepEqual(zz9.alteracoes, [
      { versao: 2, descricao: 'ZZ9: ZZ9-05 tirada do programa', registrado_em: agora.toISOString(), registrado_por: null },
      { versao: 1, descricao: 'Curso ZZ9 criado: Curso de teste', registrado_em: agora.toISOString(), registrado_por: 'Maria' }
    ]);
    // Na chave, os cursos no formato do servidor (sem o que a leitura acrescenta) e as alterações com o curso
    const { cursos, alteracoes } = JSON.parse(guardado());
    assert.deepEqual([cursos.map(c => c.sigla), Object.hasOwn(cursos[3].missoes[0], 'comResultados'), alteracoes.map(a => [a.curso, a.versao])],
      [['PP', 'PC', 'INVA', 'ZZ9'], false, [['ZZ9', 1], ['ZZ9', 2]]]);
  });

  it('recusa como o servidor (PT409, 23505, 23514, 22023, P0002), com o código e o campo, sem gravar nada', async () => {
    comCadastro(FORMATO_DOS_CURSOS);
    await criarZZ9();
    await backendLocal.registrarResultado({ aluno: 1000, curso: 'ZZ9', missao: 'ZZ9-01', resultado: 'aprovado', data: '2026-11-18', voo: null });
    const antes = guardado();
    const comMissao = (i, campos) => ({ ...PROGRAMA, missoes: PROGRAMA.missoes.map((m, j) => (j === i ? { ...m, ...campos } : m)) });
    const recusas = [
      [() => criarZZ9(), { code: 'PT409', campo: 'sigla' }],
      [() => backendLocal.salvarCurso('ZZ9', 7, PROGRAMA, { descricao: 'ZZ9: alteração' }), { code: 'PT409', campo: null }],
      [() => backendLocal.salvarCurso('ZZ9', 1, comMissao(1, { codigo: 'ZZ9-01' }), { descricao: 'ZZ9: alteração' }), { code: '23505', campo: 'codigo' }],
      [() => backendLocal.salvarCurso('ZZ9', 1, comMissao(0, { codigo: 'ZZ9-10' }), { descricao: 'ZZ9: alteração' }), { code: '23514', campo: 'codigo' }],
      [() => backendLocal.salvarCurso('ZZ9', 1, comMissao(4, { eq: 'C152' }), { descricao: 'ZZ9: alteração' }), { code: '22023', campo: 'mis' }],
      [() => backendLocal.salvarCurso('ZZ7', 1, PROGRAMA, { descricao: 'ZZ7: alteração' }), { code: 'P0002', campo: null }]
    ];
    for (const [gravar, erro] of recusas) {
      // A recusa vem na promessa (nada é lançado na chamada)
      let gravacao;
      assert.doesNotThrow(() => { gravacao = gravar(); });
      await assert.rejects(gravacao, erro);
    }
    assert.equal(guardado(), antes, 'nada gravado');
  });

  it('antes do formato dos cursos, o programa espera a conversão (PT409 formato); sem cadastro, grava', async () => {
    comCadastro(FORMATO_DOS_CURSOS - 1);
    await assert.rejects(criarZZ9(), { code: 'PT409', campo: 'formato' });
    assert.equal(guardado(), null);
    localStorage.removeItem('acpm4_cadastro');
    assert.equal((await criarZZ9()).versao, 1);
  });

  it('a conversão do cadastro: só antes do formato dos cursos; o curso igual é pulado e a chave só é gravada quando algum curso muda', async () => {
    const legado = () => programaDoLegado(normalizarCursos({ PP: [{ id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local', eq: 'C152', nb: 1 }] }));
    comCadastro(FORMATO_DOS_CURSOS);
    assert.equal(await backendLocal.importarCursos(legado()), 0);
    assert.equal(guardado(), null, 'no formato dos cursos, nada');
    comCadastro(FORMATO_DOS_CURSOS - 1);
    assert.equal(await backendLocal.importarCursos(legado(), { autor: 'Maria', agora }), 1);
    const depois = guardado();
    const [pp] = await backendLocal.programaDosCursos();
    assert.deepEqual([pp.versao, pp.fases.map(f => f.nome), pp.missoes.map(m => m.codigo)], [2, ['Programa'], ['PP-01']]);
    assert.deepEqual(pp.alteracoes, [{ versao: 2, descricao: 'Programa trazido do cadastro (1 missão)', registrado_em: agora.toISOString(), registrado_por: 'Maria' }]);
    // O mesmo programa com outros ids (cada abertura gera ids novos) é o mesmo: nada é gravado
    const gravadas = [], setItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (chave, valor) => { gravadas.push(chave); setItem(chave, valor); };
    assert.equal(await backendLocal.importarCursos(legado()), 0);
    assert.deepEqual([gravadas, guardado()], [[], depois]);
    // Sem cadastro (o primeiro uso deste navegador), a conversão grava
    localStorage.removeItem('acpm4_cadastro');
    localStorage.removeItem('acpm4_cursos');
    assert.equal(await backendLocal.importarCursos(legado()), 1);
    assert.deepEqual(gravadas, ['acpm4_cursos']);
  });
});

describe('Backend local: limpeza (só no modo local)', () => {
  it('limpa o histórico de uma data sem tocar nas outras', async () => {
    await backendLocal.registrar({ data: '2026-11-11', tipo: 'mod', descricao: 'Dia 11' });
    await backendLocal.registrar({ data: '2026-11-12', tipo: 'mod', descricao: 'Dia 12' });
    await backendLocal.limparHistorico('2026-11-11');
    assert.deepEqual(await backendLocal.listarHistorico('2026-11-11'), []);
    assert.deepEqual((await backendLocal.listarHistorico('2026-11-12')).map(e => e.descricao), ['Dia 12']);
  });

  it('remove só os dias simulados do BI', async () => {
    await backendLocal.gravar('dia:2026-11-10', { simulado: true });
    await backendLocal.gravar('dia:2026-11-11', { av: {} });
    localStorage.setItem('acpm3', '{}');
    await backendLocal.removerDiasSimulados();
    assert.deepEqual((await backendLocal.listarDias('2026-11-01', '2026-11-30')).map(x => x.data), ['2026-11-11']);
    assert.equal(localStorage.getItem('acpm3'), '{}');
  });
});

describe('ApiClient com outro backend', () => {
  const original = ApiClient.backend;
  afterEach(() => { ApiClient.backend = original; ApiClient.readOnly = false; ApiClient.cadastroGravado = undefined; });

  it('lê e grava pelo backend configurado (nada vai para o localStorage) e respeita o modo somente leitura', async () => {
    const memoria = new Map();
    ApiClient.backend = {
      ler: async chave => memoria.get(chave) ?? null,
      gravar: async (chave, conteudo) => { memoria.set(chave, conteudo); return true; },
      diaAnterior: async () => null
    };
    const estado = ApiClient.createFreshState();
    assert.equal(await ApiClient.salvarDia('2026-11-11', estado, null), true);
    assert.deepEqual([...memoria.keys()], ['cadastro', 'dia:2026-11-11']);
    assert.deepEqual((await ApiClient.carregarDia('2026-11-11')).estado, ApiClient.normalizeAndMigrateState(structuredClone(estado)));
    assert.equal(localStorage.length, 0, 'nada vai para o localStorage');

    ApiClient.readOnly = true;
    memoria.clear();
    assert.equal(await ApiClient.salvarDia('2026-11-11', estado, null), false);
    assert.equal(memoria.size, 0);
  });
});
