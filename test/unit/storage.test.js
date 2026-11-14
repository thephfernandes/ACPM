// Camada de dados (ApiClient): estado inicial, migrações de schema, persistência e link compartilhado.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../js/storage.js';
import { habilitacoesDoNivel } from '../../js/habilitacoes.js';
import { DEFAULT_LIM } from '../../js/config.js';
import { rosterSintetico } from '../helpers/estado.js';
import { simularNavegador, navegarPara } from '../helpers/navegador.js';
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

  it('schema v4: preserva o cadastro e normaliza os pedidos', () => {
    const estado = ApiClient.createFreshState();
    estado.lim = { C152: 999 };
    estado.nid = 5;
    estado.stu = [aluno(1000, { mis: 'PP Local', eq: 'PA-34' }, { extra: [{ ...missaoExtra(undefined, { mis: 'Ground de Navegação', eq: 'C152', p1: 8, p2: 8 }) }] })];
    const x = ApiClient.normalizeAndMigrateState(estado);
    assert.deepEqual(x.lim, DEFAULT_LIM);
    assert.equal(x.nid, 1001);
    assert.deepEqual([x.stu[0].mis, x.stu[0].eq], ['Voo Local', 'PA-34']);
    assert.deepEqual(
      [x.stu[0].extra[0].mid, x.stu[0].extra[0].mis, x.stu[0].extra[0].eq, x.stu[0].extra[0].p1, x.stu[0].extra[0].nb],
      [1000, 'Ground Navegação', 'Sala Ground', 390, 1.5]
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

  it('modo somente leitura (link compartilhado) não grava nada', async () => {
    ApiClient.readOnly = true;
    assert.equal(await ApiClient.salvarDia('2026-11-11', ApiClient.createFreshState(), { out: [], al: [], tot: 0 }), false);
    assert.equal(await ApiClient.registrarHistorico('2026-11-11', { tipo: 'mod', descricao: 'x' }), null);
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11'), null);
    for (const k of ['acpm4_cadastro', 'acpm4_dia_2026-11-11', 'acpm4_historico']) assert.equal(localStorage.getItem(k), null, k);
  });
});

describe('Link compartilhável (perfil Gestor)', () => {
  it('leva data, janelas, manutenção, instrutores, status e somente os alunos que voam', () => {
    const estado = ApiClient.createFreshState();
    estado.ins = rosterSintetico();
    estado.win[2] = false;
    estado.av['PR-BTB'] = false;
    estado.ins[0].on = false;
    estado.fStatus = { '1000_0_1': 'Em Voo', '1000_1003_1': 'Cancelado', '1002_1003_1': 'Atrasado' };
    estado.fObs = { '1000_1003_1': { motivo: 'Outro', texto: 'Aluno com febre' }, '1002_1003_1': { novoInicio: 640 } };
    estado.horas = { 'PR-BTB': 42 };
    estado.hangar = ['PR-VOB', ...estado.hangar.filter(r => r !== 'PR-VOB')];
    estado.limites = { ...estado.limites, vooMesH: 90 };
    estado.fixos = { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 7 } };
    estado.aprovacao = { em: '2026-11-10T21:05:00.000Z', por: 'Rayane' };
    estado.criterios = { buracos: 'maior', horarios: 'preferencias' };
    estado.horasDosInstrutores = { [estado.ins[0].id]: { mes: 80, semestre: 400, ano: 700, fimAnterior: 1110 } };
    estado.filas = { cheque: [], mlte: [9], noturno: [8, 7], c172: [8, 7, 9] };
    estado.stu = [
      aluno(1000, { jan: 'manha', etapa: 'PP-07' }, { kg: 81, bl: [3] }),
      aluno(1001, { fly: false }),
      aluno(1002, { fly: false }, { extra: [missaoExtra(1003, { mis: 'IFR', eq: 'C172' }), missaoExtra(1004, { fly: false })] })
    ];

    const link = ApiClient.encodeShareableURL(estado, '2026-11-11');
    assert.match(link, /^https:\/\/gdruumond\.github\.io\/ACPM\/\?role=gestor&share=/);

    navegarPara(link);
    const destino = ApiClient.createFreshState();
    assert.equal(ApiClient.applySharedURLIfPresent(destino), '2026-11-11');
    assert.deepEqual(destino.win, estado.win);
    assert.equal(destino.av['PR-BTB'], false);
    assert.deepEqual(destino.ins, estado.ins.map(({ lv, ...x }) => x), 'o link leva as habilitações (o nível de antes não vai)');
    assert.deepEqual(destino.fStatus, estado.fStatus);
    assert.deepEqual(destino.fObs, { '1000_1003_1': { motivo: 'Outro' }, '1002_1003_1': { novoInicio: 640 } }, 'o texto livre do motivo não vai no link');
    assert.deepEqual([destino.horas, destino.filas], [estado.horas, estado.filas], 'as horas até a revisão e as filas do rodízio vão no link');
    assert.deepEqual(destino.hangar, estado.hangar, 'a ordem do hangar vai no link');
    assert.deepEqual([destino.limites, destino.horasDosInstrutores], [estado.limites, estado.horasDosInstrutores], 'os limites e as horas passadas vão no link (quem abre gera a mesma escala)');
    assert.deepEqual([destino.fixos, destino.aprovacao], [estado.fixos, estado.aprovacao], 'a escala aprovada vai no link');
    assert.deepEqual(destino.criterios, estado.criterios, 'os critérios da compactação vão no link (quem abre gera a mesma escala)');
    assert.equal(destino.stu[0].jan, 'manha', 'a disponibilidade vai no link');
    assert.equal(destino.stu[0].etapa, 'PP-07', 'a missão do curso vai no link');
    assert.deepEqual(destino.stu.map(s => [s.id, s.fly, s.kg, s.bl, s.extra.map(ex => [ex.mid, ex.mis])]), [
      [1000, true, 81, [3], []],
      [1002, false, 70, [], [[1003, 'IFR']]]
    ]);
  });

  it('sem parâmetro share não altera o estado', () => {
    const estado = ApiClient.createFreshState();
    assert.equal(ApiClient.applySharedURLIfPresent(estado), null);
    assert.deepEqual(estado, ApiClient.createFreshState());
  });
});

describe('Link compartilhável: validação do conteúdo (vem da URL, não é confiável)', () => {
  const ATAQUE = '"><img src=x onerror=alert(1)>';
  const abrir = payload => {
    const share = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    navegarPara(`https://gdruumond.github.io/ACPM/?role=gestor&share=${encodeURIComponent(share)}`);
    const estado = ApiClient.createFreshState();
    return { data: ApiClient.applySharedURLIfPresent(estado), estado };
  };

  it('aceita somente data AAAA-MM-DD, janelas booleanas e matrículas conhecidas', () => {
    const { data, estado } = abrir({ d: `2026-11-11${ATAQUE}`, w: [1, 0, 'x', 1, 1, 1, 1, 1, 1, 1, 1], avOff: ['PR-BTB', ATAQUE] });
    assert.equal(data, null);
    assert.deepEqual(estado.win, [true, false, true, true, true, true, true, true, true]);
    assert.equal(estado.av['PR-BTB'], false);
    assert.equal(ATAQUE in estado.av, false);
  });

  it('disponibilidade do aluno: só os códigos conhecidos (manhã, tarde, noite ou um horário)', () => {
    const { estado } = abrir({ fly: [[1000, 'Aluno', 70, [], 1, 'Voo Local', 'C152', 1, 2, 1, 1, 3, [[1001, 'IFR', 'C172', 3, 3, 1, 1, 3, ATAQUE]], 'tarde']] });
    assert.equal(estado.stu[0].jan, 'tarde');
    assert.equal(Object.hasOwn(estado.stu[0].extra[0], 'jan'), false);
  });

  it('horas até a revisão e filas do rodízio: só matrículas conhecidas, horas numéricas e ids inteiros', () => {
    const { estado } = abrir({
      h: { 'PR-BTB': 48.5, 'XX-XXX': 10, 'PP-LJV': ATAQUE, 'PR-IGU': 99, constructor: 1 },
      f: { c172: [3, ATAQUE, 2], cheque: 'x', outra: [1], noturno: [1.5, 4] }
    });
    assert.deepEqual(estado.horas, { 'PR-BTB': 48.5 });
    assert.deepEqual(estado.filas, { cheque: [], mlte: [], noturno: [4], c172: [3, 2] });
  });

  it('link antigo com simulador em manutenção vale para o nome novo do simulador', () => {
    const { estado } = abrir({ d: '2026-11-11', avOff: ['SIM-MONO-1', 'SIM-MULTI-2'] });
    assert.deepEqual([estado.av['SIM-MONO-A'], estado.av['SIM-MONO-C'], estado.av['SIM-MLTE-E'], estado.av['SIM-MLTE-D']], [false, true, true, false]);
  });

  it('limites e horas passadas: só números (o resto volta ao padrão ou sai)', () => {
    const { estado } = abrir({ li: { vooMesH: ATAQUE, vooAnoH: 900 }, hi: { 7: { mes: 3, semestre: ATAQUE, ano: 5, fimAnterior: 1000 }, [ATAQUE]: { mes: 1 } } });
    assert.equal(estado.limites.vooMesH, 100);
    assert.equal(estado.limites.vooAnoH, 900);
    assert.deepEqual(estado.horasDosInstrutores, { 7: { mes: 3, semestre: 0, ano: 5, fimAnterior: 1000 } });
  });

  it('escala aprovada: voos fixos com horário, avião e instrutor válidos; quem aprovou é texto curto', () => {
    const { estado } = abrir({
      fx: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 7 }, '1001_0_1': { a: ATAQUE, b: 450, r: 'PR-VOB', insId: 7 }, [ATAQUE]: { a: 390, b: 450, r: 'PR-VOB', insId: 7 },
        '1002_0_1': { a: 500, b: 560, r: ATAQUE, insId: 7 } },
      ap: { em: '2026-11-10T21:05:00.000Z', por: ATAQUE.repeat(10) }
    });
    assert.deepEqual(estado.fixos, { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 7 } });
    assert.equal(estado.aprovacao.por.length <= 80, true);
  });

  it('critérios da compactação: só os valores conhecidos (o resto volta ao padrão)', () => {
    assert.deepEqual(abrir({ cr: { buracos: ATAQUE, horarios: 'fixos' } }).estado.criterios, { buracos: 'inva', horarios: 'fixos' });
    assert.deepEqual(abrir({ cr: ATAQUE }).estado.criterios, { buracos: 'inva', horarios: 'disponibilidade' });
  });

  it('ordem do hangar: só os aviões da frota, sem repetir (o resto entra no fundo)', () => {
    const { estado } = abrir({ hg: [ATAQUE, 'PR-VOB', 'SIM-MONO-A', 'PR-VOB', 7] });
    assert.equal(estado.hangar[0], 'PR-VOB');
    assert.ok(!estado.hangar.includes(ATAQUE) && !estado.hangar.includes('SIM-MONO-A'));
  });

  it('status de voo: somente chaves aluno_missão_sessão e valores conhecidos', () => {
    const { estado } = abrir({ st: { '1000_0_1': ATAQUE, '1000_0_2': 'Em Voo', [ATAQUE]: 'Pendente' } });
    assert.deepEqual(estado.fStatus, { '1000_0_2': 'Em Voo' });
  });

  it('detalhes do status: motivo da lista e horário em minutos, só para o status do voo; texto livre nunca', () => {
    const { estado } = abrir({
      st: { '1000_0_1': 'Cancelado', '1001_0_1': 'Atrasado', '1002_0_1': 'Cancelado', '1003_0_1': 'Em Voo' },
      ob: { '1000_0_1': { m: 'Meteorologia', t: ATAQUE }, '1001_0_1': { n: 640 }, '1002_0_1': { m: ATAQUE }, '1003_0_1': { m: 'Meteorologia' }, [ATAQUE]: { m: 'Outro' } }
    });
    assert.deepEqual(estado.fObs, { '1000_0_1': { motivo: 'Meteorologia' }, '1001_0_1': { novoInicio: 640 } });
  });

  it('instrutores: id inteiro, habilitações conhecidas (ou o nível dos links antigos), peso numérico e disponibilidade booleana', () => {
    const { estado } = abrir({
      ins: [
        [7, 'Instrutor 07', 1, ATAQUE, ATAQUE, [1, 0]],
        [8, ATAQUE, 0, 12, 500, 'x'],
        [9, 'Instrutor 09', 1, ['c172', ATAQUE, 'local'], 70, []],
        [10, 'Link antigo', 1, 7, 70, []],
        [ATAQUE, 'Sem id', 1, 3, 70, []]
      ]
    });
    assert.deepEqual(estado.ins, [
      { id: 7, nm: 'Instrutor 07', on: true, hab: habilitacoesDoNivel(1), kg: 0, aw: [true, false, false, false, false, false, false, false, false] },
      { id: 8, nm: ATAQUE, on: false, hab: habilitacoesDoNivel(1), kg: 0, aw: Array(9).fill(true) },
      { id: 9, nm: 'Instrutor 09', on: true, hab: ['local', 'c172'], kg: 70, aw: Array(9).fill(false) },
      { id: 10, nm: 'Link antigo', on: true, hab: habilitacoesDoNivel(7), kg: 70, aw: Array(9).fill(false) }
    ]);
  });

  it('alunos e missões: ids inteiros, campos numéricos dentro dos limites da interface', () => {
    const { estado } = abrir({
      fly: [
        [1000, '<b>Ana</b>', ATAQUE, [7, ATAQUE], 1, 'Voo Local', 'C152', ATAQUE, 2, 1e9, 1e9, ATAQUE, [
          [ATAQUE, 'IFR', 'C172', 1, 2, 1, 1, 3],
          [1003, 'IFR', 'C172', 99, -5, 2, 9, 7]
        ]],
        [ATAQUE, 'Sem id', 70, [], 1, 'Voo Local', 'C152', 1, 2, 1, 1, 3, []]
      ]
    });
    assert.equal(estado.stu.length, 1);
    const [ana] = estado.stu;
    assert.deepEqual(
      { id: ana.id, nm: ana.nm, kg: ana.kg, bl: ana.bl, fly: ana.fly, mis: ana.mis, eq: ana.eq, p1: ana.p1, p2: ana.p2, nb: ana.nb, ss: ana.ss, pr: ana.pr },
      { id: 1000, nm: '<b>Ana</b>', kg: 0, bl: [7], fly: true, mis: 'Voo Local', eq: 'C152', p1: -1, p2: 610, nb: 1, ss: 1, pr: 3 }
    );
    assert.deepEqual(ana.extra, [{ mid: 1003, fly: true, mis: 'IFR', eq: 'C172', p1: -1, p2: -1, nb: 2, ss: 1, pr: 3 }]);
  });

  it('limita o tamanho das listas recebidas', () => {
    const linha = id => [id, `Aluno ${id}`, 70, [], 1, 'Voo Local', 'C152', 1, 2, 1, 1, 3, []];
    const { estado } = abrir({ fly: Array.from({ length: 600 }, (_, i) => linha(1000 + i)) });
    assert.equal(estado.stu.length, 500);
  });
});
