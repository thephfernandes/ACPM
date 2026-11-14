// Camada de dados (ApiClient): estado inicial, migrações de schema e persistência.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../js/storage.js';
import { habilitacoesDoNivel } from '../../js/habilitacoes.js';
import { DEFAULT_LIM } from '../../js/config.js';
import { rosterSintetico } from '../helpers/estado.js';
import { simularNavegador } from '../helpers/navegador.js';
import { aluno, instrutor, missaoExtra } from '../helpers/montar.js';

beforeEach(() => {
  simularNavegador();
  ApiClient.readOnly = false;
});

describe('Estado inicial', () => {
  it('janelas e frota habilitadas, sem instrutores e sem alunos (o cadastro vem do servidor ou do usuário)', () => {
    const s = ApiClient.createFreshState();
    assert.equal(s.schemaVer, 4);
    assert.deepEqual(s.win, Array(9).fill(true));
    assert.equal(Object.keys(s.av).length, 26);
    assert.ok(Object.values(s.av).every(Boolean));
    assert.deepEqual(s.lim, DEFAULT_LIM);
    assert.equal(s.nid, 1000);
    assert.deepEqual(s.stu, []);
    assert.deepEqual(s.fStatus, {});
    assert.deepEqual(s.ins, []);
  });
});

describe('Migração de estado', () => {
  it('estado inválido vira estado inicial', () => {
    assert.equal(ApiClient.normalizeAndMigrateState(null).schemaVer, 4);
    assert.deepEqual(ApiClient.normalizeAndMigrateState({ stu: 'x', ins: [] }).stu, []);
  });

  it('valores gravados fora do formato: status desconhecidos saem; pessoas e pedidos voltam aos tipos certos (revisão de 14/11)', () => {
    const ataque = 'x"><img/src/onerror=window.__xss=1>';
    const estado = ApiClient.createFreshState();
    estado.ins = [
      { id: 1, nm: 'Ana', on: true, kg: ataque, hab: ['local', ataque], aw: estado.win.map(() => true) },
      { id: ataque, nm: 'Sem id', on: true, kg: 70, hab: [], aw: [] },
      { id: 2, nm: 'B'.repeat(200), on: 'sim', kg: 400, hab: [], aw: [ataque] }
    ];
    estado.stu = [{ id: 1000, nm: 'Aluno 1000', kg: ataque, bl: [1, ataque, 2.5], fly: 'sim', mis: 'Voo Local', eq: 'C152', p1: 500, p2: -1, nb: 1, ss: 1, pr: ataque,
      extra: [{ mid: ataque, fly: true, mis: 'Voo Local', eq: 'C152', p1: 610, p2: -1, nb: 1, ss: 1, pr: 9 }, ataque] }, { id: '1001', nm: 'Sem id' }];
    estado.fStatus = { '1000_0_1': ataque, '1000_0_2': 'Cancelado' };
    estado.horas = { 'PR-VOB': ataque, 'PR-BTB': 12.5 };
    estado.importadas = [7, ataque];
    const x = ApiClient.normalizeAndMigrateState(estado);
    assert.deepEqual(x.fStatus, { '1000_0_2': 'Cancelado' });
    assert.deepEqual(x.ins.map(i => [i.id, i.nm.length, i.on, i.kg, i.hab, i.aw.length, i.aw.every(v => typeof v === 'boolean')]), [
      [1, 3, true, 0, ['local'], 9, true],
      [2, 80, true, 0, [], 9, true]
    ]);
    const [stu] = x.stu;
    assert.deepEqual([x.stu.length, stu.kg, stu.bl, stu.fly, stu.pr], [1, 0, [1], true, 3]);
    assert.deepEqual(stu.extra.map(ex => [Number.isInteger(ex.mid) && ex.mid > 0, ex.pr]), [[true, 3]]);
    assert.deepEqual([x.horas, x.importadas], [{ 'PR-BTB': 12.5 }, [7]]);
  });

  it('schema v4: preserva o cadastro e normaliza os pedidos', () => {
    const estado = ApiClient.createFreshState();
    estado.lim = { C152: 999 };
    estado.nid = 5;
    estado.stu = [aluno(1000, { mis: 'PP Local', eq: 'PA-34' }, { extra: [{ ...missaoExtra(undefined, { mis: 'Ground de Navegação', eq: 'C152', p1: 8, p2: 8 }) }] })];
    const x = ApiClient.normalizeAndMigrateState(estado);
    assert.deepEqual(x.lim, DEFAULT_LIM);
    assert.equal(x.nid, 1000, 'o número do cadastro vai a 1000 e não muda com a missão extra');
    assert.deepEqual([x.stu[0].mis, x.stu[0].eq], ['Voo Local', 'PA-34']);
    // A missão extra sem número recebe o próximo do aluno (revisão de 14/11)
    assert.deepEqual(
      [x.stu[0].extra[0].mid, x.stu[0].extra[0].mis, x.stu[0].extra[0].eq, x.stu[0].extra[0].p1, x.stu[0].extra[0].nb],
      [1, 'Ground Navegação', 'Sala Ground', 390, 1.5]
    );
  });

  it('schema anterior ao v3: mantém os instrutores do navegador (com os mesmos ids) e completa campos ausentes', () => {
    const aw = [true, false, true, false, true, false, true, false, true];
    const antigo = {
      schemaVer: 2,
      win: Array(9).fill(true), av: {}, lim: {}, nid: 1200,
      ins: [{ id: 77, nm: 'Instrutor Antigo', on: false, lv: 6, kg: 99, aw }, { id: 78, nm: 'Instrutor 78', on: true, lv: 3, kg: 70, aw }, { id: 79, nm: 'Sem dados', lv: 12, aw: [true] }],
      stu: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, nm: `Aluno ${String(i + 1).padStart(2, '0')}`, fly: false, extra: [], ...missaoExtra(0, { fly: false }) }))
    };
    const x = ApiClient.normalizeAndMigrateState(antigo);
    assert.deepEqual(x.ins, [
      { id: 77, nm: 'Instrutor Antigo', on: false, lv: 6, kg: 99, aw, hab: habilitacoesDoNivel(6) },
      { id: 78, nm: 'Instrutor 78', on: true, lv: 3, kg: 70, aw, hab: habilitacoesDoNivel(3) },
      { id: 79, nm: 'Sem dados', on: true, lv: 1, kg: 0, aw: Array(9).fill(true), hab: habilitacoesDoNivel(1) }
    ]);
    assert.deepEqual(x.stu, [], 'remove os 50 alunos de exemplo das versões antigas');
    assert.equal(x.schemaVer, 4);
  });

  it('schema v1: mantém os níveis válidos dos instrutores (e dá as habilitações equivalentes)', () => {
    const x = ApiClient.normalizeAndMigrateState({ schemaVer: 1, ins: [{ id: 9, nm: 'Instrutor 09', lv: 9, kg: 70 }], stu: [] });
    assert.equal(x.ins[0].lv, 9);
    assert.deepEqual(x.ins[0].hab, habilitacoesDoNivel(9));
  });

  it('habilitações: lista conhecida e na ordem da grade; quem não tem recebe as do nível', () => {
    const x = ApiClient.normalizeAndMigrateState({ schemaVer: 4, ins: [instrutor(1, 1, { hab: ['c172', 'xyz', 'local'] }), { id: 2, nm: 'B', on: true, lv: 7, kg: 0, aw: [] }], stu: [] });
    assert.deepEqual(x.ins.map(i => i.hab), [['local', 'c172'], habilitacoesDoNivel(7)]);
  });
});

describe('Persistência local (escala por data)', () => {
  beforeEach(() => { ApiClient.cadastroGravado = undefined; });

  it('salva e recupera a escala de uma data, o histórico e o BI', async () => {
    const estado = ApiClient.normalizeAndMigrateState({ ...ApiClient.createFreshState(), stu: [aluno(1000)] });
    const res = { out: [{ fKey: '1000_0_1' }], al: [], tot: 1 };
    assert.equal(await ApiClient.salvarDia('2026-11-11', estado, res), true);
    const lido = await ApiClient.carregarDia('2026-11-11');
    assert.equal(lido.estado.stu[0].nm, 'Aluno 1000');
    assert.deepEqual(lido.escala, res);

    await ApiClient.registrarHistorico('2026-11-11', { tipo: 'mod', descricao: 'x' });
    assert.deepEqual((await ApiClient.historicoDoDia('2026-11-11')).map(e => e.descricao), ['x']);
    assert.deepEqual(Object.keys(await ApiClient.biDoPeriodo('2026-11-01', '2026-11-30')), ['2026-11-11']);
  });

  it('sem dados salvos: sem cadastro, sem escala, histórico e BI vazios', async () => {
    const { estado, escala } = await ApiClient.carregarDia('2026-11-11');
    assert.deepEqual([estado.ins, estado.stu, escala], [[], [], null]);
    assert.deepEqual(await ApiClient.historicoDoDia('2026-11-11'), []);
    assert.deepEqual(await ApiClient.biDoPeriodo('2026-11-01', '2026-11-30'), {});
  });

  it('dados corrompidos não quebram o carregamento', async () => {
    localStorage.setItem('acpm4_cadastro', '{corrompido');
    localStorage.setItem('acpm4_dia_2026-11-11', '{corrompido');
    const { estado, escala } = await ApiClient.carregarDia('2026-11-11');
    assert.deepEqual([estado.schemaVer, estado.ins, escala], [4, [], null]);
  });

  it('migra o formato acpm2 (7 janelas) para as 9 janelas atuais', async () => {
    localStorage.setItem(ApiClient.KEY_LEGACY, JSON.stringify({
      win: [true, true, false, true, true, true, false],
      lim: {},
      ins: [{ id: 1, nm: 'Instrutor 01', on: true, lv: 3, kg: 80, aw: [true, false, true, true, false, true, true] }],
      stu: [{ id: 5, nm: 'Aluno 5', kg: 70, bl: [], fly: true, mis: 'PP Local', eq: 'C152', p1: 3, p2: -1, nb: 1, ss: 2, pr: 3 }]
    }));
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11'), '2026-11-11');
    const { estado: x } = await ApiClient.carregarDia('2026-11-11');
    assert.deepEqual(x.win, [true, true, false, false, true, true, true, true, false]);
    assert.deepEqual(x.ins[0].aw, [true, false, true, true, true, true, false, true, true]);
    // A janela 3 do formato de 7 janelas vira a janela 4 (12:40), guardada em minutos
    assert.deepEqual([x.stu[0].p1, x.stu[0].p2, x.stu[0].ss, x.stu[0].mis], [760, -1, 1, 'Voo Local']);
  });

  it('modo somente leitura (Gestor e Secretaria no modo compartilhado) não grava nada', async () => {
    ApiClient.readOnly = true;
    assert.equal(await ApiClient.salvarDia('2026-11-11', ApiClient.createFreshState(), { out: [], al: [], tot: 0 }), false);
    assert.equal(await ApiClient.registrarHistorico('2026-11-11', { tipo: 'mod', descricao: 'x' }), null);
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11'), null);
    for (const k of ['acpm4_cadastro', 'acpm4_dia_2026-11-11', 'acpm4_historico']) assert.equal(localStorage.getItem(k), null, k);
  });
});
