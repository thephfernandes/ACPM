// ApiClient com escala por data: carregar e salvar uma data, cópia do dia anterior, BI e migração dos
// documentos da fase 2 (no próprio backend ou vindos de outro, como no envio dos dados do navegador).
import { describe, it, beforeEach, afterEach } from 'node:test';
import { FROTA_INICIAL } from '../../js/frota.js';
import { HORARIOS_INICIAIS } from '../../js/horarios.js';
import assert from 'node:assert/strict';
import { LIMITES_DA_LEI } from '../../js/limites.js';
import { ApiClient } from '../../js/storage.js';
import { backendLocal } from '../../js/backends/local.js';
import { simularNavegador } from '../helpers/navegador.js';
import { estadoSintetico } from '../helpers/estado.js';
import { aluno, instrutor, missaoExtra } from '../helpers/montar.js';
import { ESQUEMA } from '../../js/migracoes.js';
import { habilitacoesDoNivel } from '../../js/habilitacoes.js';

// Backend em memória com a mesma interface, contando as gravações
function backendEmMemoria() {
  const docs = new Map();
  const historico = [];
  const gravacoes = [];
  return {
    docs, historico, gravacoes,
    async ler(doc) { return docs.has(doc) ? structuredClone(docs.get(doc)) : null; },
    async gravar(doc, conteudo) { gravacoes.push(doc); docs.set(doc, structuredClone(conteudo)); return true; },
    async listarDias(de, ate) {
      return [...docs.keys()].filter(k => k.startsWith('dia:')).map(k => k.slice(4)).filter(d => d >= de && d <= ate).sort()
        .map(d => ({ data: d, conteudo: structuredClone(docs.get(`dia:${d}`)) }));
    },
    async diaAnterior(data) {
      const d = [...docs.keys()].filter(k => k.startsWith('dia:')).map(k => k.slice(4)).filter(x => x < data).sort().pop();
      return d ? { data: d, conteudo: structuredClone(docs.get(`dia:${d}`)) } : null;
    },
    async registrar(entrada) { historico.push({ id: historico.length + 1, ...entrada }); return historico.length; },
    async listarHistorico(data) { return historico.filter(e => e.data === data).reverse(); },
    async importarHistorico(data, entradas) {
      if (historico.some(e => e.importado)) return 0;
      entradas.forEach(e => historico.push({ id: historico.length + 1, data, importado: true, ...e }));
      return entradas.length;
    }
  };
}

const original = ApiClient.backend;
let backend;
beforeEach(() => {
  simularNavegador();
  backend = backendEmMemoria();
  ApiClient.backend = backend;
  ApiClient.readOnly = false;
  ApiClient.cadastroGravado = undefined;
});
afterEach(() => { ApiClient.backend = original; ApiClient.readOnly = false; });

const escalaDe = data => ({ out: [{ fKey: '1000_0_1', h: 1 }], al: [], tot: 1, data });

describe('Carregar e salvar uma data', () => {
  it('sem cadastro nem dias: estado vazio para a data, sem escala', async () => {
    const { estado, escala, novo } = await ApiClient.carregarDia('2026-11-11');
    assert.deepEqual([estado.ins, estado.stu, escala, novo], [[], [], null, true]);
    assert.equal(estado.schemaVer, 4);
  });

  it('salva e carrega de volta o mesmo estado e a mesma escala', async () => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000, {}, { extra: [missaoExtra(1001)] })] });
    estado.av['PR-BTB'] = false;
    estado.fStatus = { '1000_0_1': 'Em Voo' };
    assert.equal(await ApiClient.salvarDia('2026-11-11', estado, escalaDe('2026-11-11')), true);
    const lido = await ApiClient.carregarDia('2026-11-11');
    assert.deepEqual(lido.estado, estado);
    assert.deepEqual(lido.escala, escalaDe('2026-11-11'));
    assert.equal(lido.novo, false);
  });

  it('grava o cadastro só quando ele muda; o dia é gravado sempre', async () => {
    const estado = ApiClient.normalizeAndMigrateState(estadoSintetico());
    await ApiClient.carregarDia('2026-11-11');
    await ApiClient.salvarDia('2026-11-11', estado, null);
    estado.av['PR-BTB'] = false;
    await ApiClient.salvarDia('2026-11-11', estado, null);
    estado.ins[0].nm = 'Novo nome';
    await ApiClient.salvarDia('2026-11-11', estado, null);
    assert.deepEqual(backend.gravacoes, ['cadastro', 'dia:2026-11-11', 'dia:2026-11-11', 'cadastro', 'dia:2026-11-11']);
  });

  it('data nova começa com uma cópia do dia anterior (sem status e sem escala) e não grava nada', async () => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000)] });
    estado.av['PR-BTB'] = false;
    estado.fStatus = { '1000_0_1': 'Cancelado' };
    await ApiClient.salvarDia('2026-11-11', estado, escalaDe('2026-11-11'));
    backend.gravacoes.length = 0;

    const { estado: novo, escala, novo: ehNovo } = await ApiClient.carregarDia('2026-11-14');
    assert.equal(ehNovo, true);
    assert.equal(escala, null);
    assert.equal(novo.av['PR-BTB'], false);
    assert.deepEqual(novo.stu, estado.stu);
    assert.deepEqual(novo.fStatus, {});
    assert.deepEqual(backend.gravacoes, []);
  });

  it('somente leitura: nada é gravado', async () => {
    ApiClient.readOnly = true;
    assert.equal(await ApiClient.salvarDia('2026-11-11', ApiClient.normalizeAndMigrateState(estadoSintetico()), null), false);
    assert.equal(await ApiClient.registrarHistorico('2026-11-11', { tipo: 'mod', descricao: 'x' }), null);
    assert.deepEqual(backend.gravacoes, []);
    assert.deepEqual(backend.historico, []);
  });
});

describe('Horas até a revisão de 50 horas', () => {
  it('ficam no dia e a nova data começa com as horas mais os voos do dia anterior', async () => {
    const estado = ApiClient.normalizeAndMigrateState(estadoSintetico());
    estado.horas = { 'PR-BTB': 40 };
    await ApiClient.salvarDia('2026-11-11', estado, { out: [{ fKey: '1000_0_1', r: 'PR-BTB', eqType: 'C152', h: 2 }], al: [], tot: 1 });
    assert.deepEqual((await ApiClient.carregarDia('2026-11-11')).estado.horas, { 'PR-BTB': 40 });
    assert.deepEqual((await ApiClient.carregarDia('2026-11-12')).estado.horas, { 'PR-BTB': 42 });
  });
});

describe('Filas do rodízio', () => {
  it('ficam no dia; a nova data começa com quem voou na categoria no fim da fila', async () => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), ins: [instrutor(1, 9), instrutor(2, 9)], filas: { c172: [1, 2] } });
    await ApiClient.salvarDia('2026-11-11', estado, { out: [{ fKey: 'a', insId: 1, mis: 'Voo Local', eqType: 'C172', h: 1, r: 'PP-ABP' }], al: [], tot: 1 });
    assert.deepEqual((await ApiClient.carregarDia('2026-11-11')).estado.filas.c172, [1, 2]);
    assert.deepEqual((await ApiClient.carregarDia('2026-11-12')).estado.filas.c172, [2, 1]);
  });
});

describe('Histórico e BI por data', () => {
  it('registra e lista o histórico da data', async () => {
    await ApiClient.registrarHistorico('2026-11-11', { tipo: 'exc', descricao: 'PR-BTB: Manutenção', reverter: { kind: 'setAv' } });
    await ApiClient.registrarHistorico('2026-11-12', { tipo: 'mod', descricao: 'Outra data' });
    assert.deepEqual((await ApiClient.historicoDoDia('2026-11-11')).map(e => e.descricao), ['PR-BTB: Manutenção']);
  });

  it('o BI sai das escalas guardadas no período', async () => {
    const estado = ApiClient.normalizeAndMigrateState(estadoSintetico());
    await ApiClient.salvarDia('2026-11-10', estado, escalaDe('2026-11-10'));
    await ApiClient.salvarDia('2026-11-11', estado, null);
    await ApiClient.salvarDia('2026-12-01', estado, escalaDe('2026-12-01'));
    assert.deepEqual(await ApiClient.biDoPeriodo('2026-11-01', '2026-11-30'), { '2026-11-10': { out: escalaDe().out, tot: 1, rej: 0 } });
  });
});

describe('Migração dos documentos da fase 2', () => {
  async function gravarFase2(destino, { comData = false } = {}) {
    const estado = { ...estadoSintetico(), stu: [aluno(1000)] };
    const escala = { out: [{ fKey: '1000_0_1', h: 1 }], al: [], tot: 1, ...(comData ? { data: '2026-11-20' } : {}) };
    await destino.gravar('estado', estado);
    await destino.gravar('escala', escala);
    await destino.gravar('historico', [{ id: Date.UTC(2026, 10, 9, 13), ts: '10:00:00', type: 'exc', desc: 'PR-BTB: Manutenção', revert: null }]);
    await destino.gravar('bi', { '2026-11-09': { out: [{ fKey: 'x', h: 2 }], tot: 1, rej: 0 }, '2026-11-10': { out: escala.out, tot: 1, rej: 0 } });
    return estado;
  }

  it('converte uma vez: escala na sua data, dias do BI, histórico importado e cadastro por último', async () => {
    const estado = await gravarFase2(backend);
    backend.gravacoes.length = 0;
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11'), '2026-11-10');
    assert.equal(backend.gravacoes.at(-1), 'cadastro', 'o cadastro é gravado por último (marca a migração como concluída)');
    assert.deepEqual([...backend.docs.keys()].filter(k => k.startsWith('dia:')).sort(), ['dia:2026-11-09', 'dia:2026-11-10']);
    const { estado: lido, escala } = await ApiClient.carregarDia('2026-11-10');
    assert.deepEqual(lido.stu, ApiClient.normalizeAndMigrateState(structuredClone(estado)).stu);
    assert.deepEqual(escala.out, [{ fKey: '1000_0_1', h: 1 }]);
    assert.deepEqual(backend.historico.map(e => [e.data, e.descricao, e.importado]), [['2026-11-10', 'PR-BTB: Manutenção', true]]);
    assert.ok(backend.docs.has('estado'), 'os documentos da fase 2 ficam como cópia');

    backend.gravacoes.length = 0;
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11'), null, 'não migra de novo');
    assert.deepEqual(backend.gravacoes, []);
  });

  it('sem documentos da fase 2 não faz nada', async () => {
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11'), null);
    assert.deepEqual(backend.gravacoes, []);
  });

  it('pode migrar os documentos de outro backend (envio dos dados do navegador para o servidor)', async () => {
    await gravarFase2(backendLocal, { comData: true });
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11', backendLocal), '2026-11-20');
    assert.ok(backend.docs.has('cadastro'));
    assert.ok(backend.docs.has('dia:2026-11-20'));
    assert.equal(backend.docs.has('estado'), false, 'o servidor recebe só o formato novo');
  });

  it('se uma gravação falha no meio, a conversão para com erro sem gravar o cadastro; a próxima abertura termina', async () => {
    await gravarFase2(backend);
    const gravar = backend.gravar;
    backend.gravar = async (doc, conteudo) => (doc === 'dia:2026-11-09' ? false : gravar(doc, conteudo));
    await assert.rejects(ApiClient.migrarDocumentosAntigos('2026-11-11'), /conversão dos dados não terminou/);
    assert.equal(backend.docs.has('cadastro'), false, 'sem o cadastro, a conversão continua pendente');
    backend.gravar = async (doc, conteudo) => (doc === 'cadastro' ? false : gravar(doc, conteudo));
    await assert.rejects(ApiClient.migrarDocumentosAntigos('2026-11-11'), /conversão dos dados não terminou/);
    backend.gravar = gravar;
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11'), '2026-11-10');
    assert.ok(backend.docs.has('cadastro'));
  });

  it('não sobrescreve dias que já existem no destino', async () => {
    await gravarFase2(backend);
    await backend.gravar('dia:2026-11-09', { meu: true });
    await ApiClient.migrarDocumentosAntigos('2026-11-11');
    assert.deepEqual(backend.docs.get('dia:2026-11-09'), { meu: true });
  });
});

describe('Formato dos dados guardados (versões)', () => {
  // Cadastro e dia no formato da fase 3 (sem versão), com simuladores nos nomes antigos
  const cadastroFase3 = () => ({ nid: 1001, ins: [{ id: 1, nm: 'Instrutor 01', lv: 2, kg: 70 }], stu: [{ id: 1000, nm: 'Aluno 1000', kg: 60, bl: [] }] });
  const diaFase3 = (resultado = null) => ({
    win: Array(9).fill(true),
    av: { 'SIM-MONO-1': false, 'SIM-MONO-2': true, 'SIM-MULTI-1': true, 'SIM-MULTI-2': false, 'PR-BTB': true },
    ins: { 1: { on: true, aw: Array(9).fill(true) } },
    pedidos: { 1000: { fly: true, mis: 'Simulador', eq: 'Sim. Mono', p1: 1, p2: 2, nb: 1, ss: 1, pr: 3, extra: [] } },
    fStatus: {},
    resultado
  });

  it('lê dados no formato anterior já no formato atual (simuladores renomeados), sem gravar nada', async () => {
    await backend.gravar('cadastro', cadastroFase3());
    await backend.gravar('dia:2026-11-11', diaFase3({ out: [{ fKey: '1000_0_1', r: 'SIM-MONO-2', h: 1 }], al: [], tot: 1 }));
    backend.gravacoes.length = 0;
    const { estado, escala } = await ApiClient.carregarDia('2026-11-11');
    assert.equal(estado.av['SIM-MONO-A'], false);
    assert.equal(estado.av['SIM-MLTE-D'], false);
    assert.equal(Object.hasOwn(estado.av, 'SIM-MONO-1'), false, 'os nomes antigos não ficam no estado');
    assert.equal(escala.out[0].r, 'SIM-MONO-C');
    assert.deepEqual(backend.gravacoes, []);
  });

  it('a nova data copia o dia anterior já no formato atual, e o BI usa os nomes novos', async () => {
    await backend.gravar('cadastro', cadastroFase3());
    await backend.gravar('dia:2026-11-11', diaFase3({ out: [{ fKey: '1000_0_1', r: 'SIM-MULTI-1', h: 1 }], al: [], tot: 1 }));
    const { estado } = await ApiClient.carregarDia('2026-11-12');
    assert.equal(estado.av['SIM-MONO-A'], false);
    assert.deepEqual((await ApiClient.biDoPeriodo('2026-11-01', '2026-11-30'))['2026-11-11'].out.map(o => o.r), ['SIM-MLTE-E']);
  });

  it('grava sempre no formato atual', async () => {
    await ApiClient.salvarDia('2026-11-11', ApiClient.normalizeAndMigrateState(estadoSintetico()), null);
    assert.equal(backend.docs.get('cadastro').esquema, ESQUEMA);
    assert.equal(backend.docs.get('dia:2026-11-11').esquema, ESQUEMA);
  });

  it('a conversão dos documentos da fase 2 já grava no formato atual', async () => {
    await backend.gravar('estado', { ...estadoSintetico(), av: { 'SIM-MONO-1': false } });
    await ApiClient.migrarDocumentosAntigos('2026-11-11');
    assert.equal(backend.docs.get('cadastro').esquema, ESQUEMA);
    assert.equal(backend.docs.get('dia:2026-11-11').esquema, ESQUEMA);
    assert.equal(backend.docs.get('dia:2026-11-11').av['SIM-MONO-A'], false);
  });

  it('atualiza o que está gravado: todos os dias e, por último, o cadastro; uma vez só', async () => {
    await backend.gravar('cadastro', cadastroFase3());
    await backend.gravar('dia:2026-10-16', { importado: true, resultado: { out: [{ r: 'SIM-MONO-1', h: 1 }], al: [], tot: 1, rej: 0, data: '2026-10-16' } });
    await backend.gravar('dia:2026-11-11', diaFase3());
    await backend.gravar('dia:2026-11-12', { ...diaFase3(), av: { 'SIM-MONO-A': true }, esquema: ESQUEMA });
    backend.gravacoes.length = 0;
    assert.equal(await ApiClient.atualizarFormatoGravado(), true);
    assert.deepEqual(backend.gravacoes, ['dia:2026-10-16', 'dia:2026-11-11', 'cadastro'], 'o dia que já estava no formato atual não é regravado');
    assert.equal(backend.docs.get('dia:2026-10-16').resultado.out[0].r, 'SIM-MONO-A');
    assert.equal(backend.docs.get('dia:2026-11-11').av['SIM-MLTE-D'], false);
    const fase3 = cadastroFase3();
    assert.deepEqual(backend.docs.get('cadastro'), { ...fase3, ins: fase3.ins.map(x => ({ ...x, hab: habilitacoesDoNivel(x.lv) })), frota: FROTA_INICIAL, horarios: HORARIOS_INICIAIS, limites: LIMITES_DA_LEI, cursos: { PP: [], PC: [], INVA: [] }, esquema: ESQUEMA });

    backend.gravacoes.length = 0;
    assert.equal(await ApiClient.atualizarFormatoGravado(), false, 'já atualizado');
    assert.deepEqual(backend.gravacoes, []);
  });

  it('se uma gravação falha, para com erro e o cadastro continua no formato anterior (retoma na próxima abertura)', async () => {
    await backend.gravar('cadastro', cadastroFase3());
    await backend.gravar('dia:2026-11-11', diaFase3());
    const gravar = backend.gravar;
    backend.gravar = async (doc, conteudo) => (doc === 'dia:2026-11-11' ? false : gravar(doc, conteudo));
    await assert.rejects(ApiClient.atualizarFormatoGravado(), /atualização dos dados não terminou/);
    assert.equal(backend.docs.get('cadastro').esquema, undefined);
    backend.gravar = gravar;
    assert.equal(await ApiClient.atualizarFormatoGravado(), true);
  });

  it('não grava nada no modo somente leitura nem com o banco vazio', async () => {
    assert.equal(await ApiClient.atualizarFormatoGravado(), false);
    await backend.gravar('cadastro', cadastroFase3());
    backend.gravacoes.length = 0;
    ApiClient.readOnly = true;
    assert.equal(await ApiClient.atualizarFormatoGravado(), false);
    assert.deepEqual(backend.gravacoes, []);
  });
});
