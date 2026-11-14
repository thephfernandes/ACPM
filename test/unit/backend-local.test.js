// Backend local (localStorage) e a troca de backend do ApiClient.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { backendLocal } from '../../js/backends/local.js';
import { ApiClient } from '../../js/storage.js';
import { simularNavegador } from '../helpers/navegador.js';

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
  const pedido = (extra = {}) => ({ data: '2026-11-11', aluno: 1000, aluno_nome: ' Aluno 1000 ', missao: 'Voo Local', janela: 'manha', registrado_por: ' Maria ', ...extra });

  it('registra no prazo com quem anotou e a hora; lista por período em ordem', async () => {
    const id = await backendLocal.registrarSolicitacao(pedido(), antesDas13);
    await backendLocal.registrarSolicitacao(pedido({ data: '2026-11-15', aluno: 1001, janela: 'horario', horario: '14:30', observacao: ' PP-ABP ' }), antesDas13);
    const lista = await backendLocal.listarSolicitacoes('2026-11-01', '2026-11-30');
    assert.deepEqual(lista.map(s => [s.data, s.aluno]), [['2026-11-11', 1000], ['2026-11-15', 1001]]);
    assert.deepEqual([lista[0].id, lista[0].aluno_nome, lista[0].registrado_por, lista[0].excecao, lista[0].registrado_em], [id, 'Aluno 1000', 'Maria', false, antesDas13.toISOString()]);
    assert.deepEqual([lista[1].horario, lista[1].observacao], ['14:30', 'PP-ABP']);
    assert.deepEqual(await backendLocal.listarSolicitacoes('2026-11-12', '2026-11-14'), []);
  });

  it('fora do prazo: recusa (403), a não ser pela exceção da coordenação, que fica marcada', async () => {
    await assert.rejects(backendLocal.registrarSolicitacao(pedido(), depoisDas13), e => e.code === 'PT403');
    await backendLocal.registrarSolicitacao(pedido({ excecao: true }), depoisDas13);
    assert.equal((await backendLocal.listarSolicitacoes('2026-11-11', '2026-11-11'))[0].excecao, true);
  });

  it('"Registrado por" é obrigatório e a disponibilidade precisa ser válida', async () => {
    await assert.rejects(backendLocal.registrarSolicitacao(pedido({ registrado_por: '  ' }), antesDas13), e => e.code === '23514');
    await assert.rejects(backendLocal.registrarSolicitacao(pedido({ janela: 'horario' }), antesDas13), e => e.code === '23514');
    await assert.rejects(backendLocal.registrarSolicitacao(pedido({ janela: 'madrugada' }), antesDas13), e => e.code === '23514');
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
