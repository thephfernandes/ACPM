// Escala por data: separação entre cadastro (igual em todas as datas) e dia (disponibilidade, demanda e
// status dos voos), cópia do dia anterior e conversão dos documentos da fase 2.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { separar, juntar, diaPadrao, diaParaCopiar, horasDoDiaSeguinte, inferirDataDaEscala, converterLegado, biDosDias } from '../../js/dias.js';
import { ApiClient } from '../../js/storage.js';
import { gerarCenario } from '../helpers/cenarios.js';
import { aluno, instrutor, missaoExtra } from '../helpers/montar.js';
import { estadoSintetico } from '../helpers/estado.js';

const goldens = JSON.parse(readFileSync(new URL('../fixtures/motor-goldens.json', import.meta.url), 'utf8'));
const normalizado = estado => ApiClient.normalizeAndMigrateState(structuredClone(estado));

describe('Separar e juntar', () => {
  it('juntar(separar(estado)) devolve o mesmo estado em 300 cenários e no exemplo', () => {
    const estados = [goldens.exemplo.estado, ...Array.from({ length: 300 }, (_, i) => gerarCenario(5001 + i))].map(normalizado);
    for (const estado of estados) {
      const { cadastro, dia } = separar(estado);
      assert.deepEqual(juntar(cadastro, dia), estado);
    }
  });

  it('o cadastro não tem dados do dia e o dia não tem nomes nem pesos', () => {
    const estado = normalizado(goldens.exemplo.estado);
    const { cadastro, dia } = separar(estado);
    assert.deepEqual(Object.keys(cadastro).sort(), ['frota', 'horarios', 'ins', 'limites', 'nid', 'stu']);
    assert.deepEqual(Object.keys(cadastro.ins[0]).sort(), ['hab', 'id', 'kg', 'lv', 'nm']);
    assert.deepEqual(Object.keys(cadastro.stu[0]).sort(), ['bl', 'id', 'kg', 'nm']);
    assert.deepEqual(Object.keys(dia).sort(), ['aprovacao', 'av', 'criterios', 'fObs', 'fStatus', 'filas', 'fixos', 'hangar', 'horas', 'importadas', 'ins', 'pedidos', 'win']);
    assert.deepEqual(Object.keys(dia.ins[estado.ins[0].id]).sort(), ['aw', 'on']);
    const pedido = dia.pedidos[estado.stu[0].id];
    assert.equal('nm' in pedido || 'kg' in pedido, false);
  });

  it('dia vazio: instrutores disponíveis em todas as janelas, alunos sem missão, frota toda disponível', () => {
    const cadastro = { nid: 1003, ins: [{ id: 1, nm: 'Instrutor 01', lv: 3, kg: 70 }], stu: [{ id: 1000, nm: 'Aluno 1000', kg: 70, bl: [1] }] };
    const estado = juntar(cadastro, diaPadrao());
    assert.deepEqual(estado.ins, [{ id: 1, nm: 'Instrutor 01', lv: 3, kg: 70, on: true, aw: Array(9).fill(true) }]);
    assert.deepEqual(estado.stu[0], { id: 1000, nm: 'Aluno 1000', kg: 70, bl: [1], fly: false, mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, pr: 3, extra: [] });
    assert.equal(Object.keys(estado.av).length, 26);
    assert.ok(Object.values(estado.av).every(Boolean));
    assert.deepEqual(estado.win, Array(9).fill(true));
  });

  it('ignora no dia instrutores e alunos que saíram do cadastro', () => {
    const estado = normalizado({ ...estadoSintetico(), ins: [instrutor(1, 1), instrutor(2, 2)], stu: [aluno(1000), aluno(1001)] });
    const { cadastro, dia } = separar(estado);
    cadastro.ins = cadastro.ins.filter(x => x.id !== 2);
    cadastro.stu = cadastro.stu.filter(s => s.id !== 1001);
    const junto = juntar(cadastro, dia);
    assert.deepEqual(junto.ins.map(x => x.id), [1]);
    assert.deepEqual(junto.stu.map(s => s.id), [1000]);
  });

  it('os limites dos instrutores e as horas de voo fora do app ficam no cadastro; as horas passadas não são gravadas', () => {
    const estado = normalizado({ ...estadoSintetico(), ins: [instrutor(1, 9, { horasExternas: { '2026-11': 12, '2026-00': 300 } })], stu: [aluno(1000)] });
    estado.limites = { ...estado.limites, vooMesH: 90 };
    estado.horasDosInstrutores = { 1: { mes: 3, semestre: 4, ano: 5, fimAnterior: null } };
    const { cadastro, dia } = separar(estado);
    assert.deepEqual(cadastro.limites.vooMesH, 90);
    assert.deepEqual(cadastro.ins[0].horasExternas, { '2026-11': 12, '2026-00': 300 });
    assert.equal(JSON.stringify(dia).includes('horasDosInstrutores'), false);
    const junto = juntar(cadastro, dia);
    assert.deepEqual([junto.limites.vooMesH, junto.ins[0].horasExternas], [90, { '2026-11': 12, '2026-00': 300 }]);
  });

  it('a escala aprovada (os voos fixos e quem aprovou) vai e volta com o dia', () => {
    const estado = normalizado({ ...estadoSintetico(), stu: [aluno(1000)] });
    estado.fixos = { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } };
    estado.aprovacao = { em: '2026-11-10T21:05:00.000Z', por: 'Rayane' };
    const { cadastro, dia } = separar(estado);
    assert.deepEqual([dia.fixos, dia.aprovacao], [estado.fixos, estado.aprovacao]);
    assert.deepEqual([juntar(cadastro, dia).fixos, juntar(cadastro, dia).aprovacao], [estado.fixos, estado.aprovacao]);
  });

  it('os critérios da compactação vão e voltam com o dia; sem eles, os do padrão', () => {
    const estado = normalizado({ ...estadoSintetico(), stu: [aluno(1000)] });
    estado.criterios = { buracos: 'aviao', horarios: 'preferencias' };
    const { cadastro, dia } = separar(estado);
    assert.deepEqual(dia.criterios, estado.criterios);
    assert.deepEqual(juntar(cadastro, dia).criterios, estado.criterios);
    assert.deepEqual(juntar(cadastro, { ...dia, criterios: undefined }).criterios, { buracos: 'inva', horarios: 'disponibilidade' });
    assert.deepEqual(diaPadrao().criterios, { buracos: 'inva', horarios: 'disponibilidade' });
  });

  it('a ordem do hangar vai e volta com o dia; sem ela, a ordem da frota (só os aviões)', () => {
    const estado = normalizado({ ...estadoSintetico(), stu: [aluno(1000)] });
    const frente = ['PR-VOB', 'PP-ABP'];
    estado.hangar = [...frente, ...estado.hangar.filter(r => !frente.includes(r))];
    const { cadastro, dia } = separar(estado);
    assert.deepEqual(dia.hangar, estado.hangar);
    assert.deepEqual(juntar(cadastro, dia).hangar, estado.hangar);
    const semOrdem = juntar(cadastro, { ...dia, hangar: undefined }).hangar;
    assert.equal(semOrdem[0], 'PP-LJV', 'o primeiro avião da frota');
    assert.ok(!semOrdem.some(r => r.startsWith('SIM-')), 'simuladores não ficam no hangar');
  });

  it('os detalhes do status (motivo do cancelamento, novo horário do atraso) vão e voltam com o dia', () => {
    const estado = normalizado({ ...estadoSintetico(), stu: [aluno(1000), aluno(1001)] });
    estado.fStatus = { '1000_0_1': 'Cancelado', '1001_0_1': 'Atrasado' };
    estado.fObs = { '1000_0_1': { motivo: 'Outro', texto: 'Pista interditada' }, '1001_0_1': { novoInicio: 640 } };
    const { cadastro, dia } = separar(estado);
    assert.deepEqual(dia.fObs, estado.fObs);
    assert.equal('fObs' in cadastro, false);
    assert.deepEqual(juntar(cadastro, dia).fObs, estado.fObs);
    assert.deepEqual(juntar(cadastro, { ...dia, fObs: undefined }).fObs, {}, 'dia sem detalhes (formato anterior)');
  });

  it('juntar não compartilha objetos com o dia (editar o estado não altera o dia guardado)', () => {
    const estado = normalizado({ ...estadoSintetico(), stu: [aluno(1000, {}, { extra: [missaoExtra(1001)] })] });
    const { cadastro, dia } = separar(estado);
    const copia = structuredClone(dia);
    const junto = juntar(cadastro, dia);
    junto.ins[0].aw[0] = false;
    junto.stu[0].extra[0].p1 = 7;
    junto.win[0] = false;
    assert.deepEqual(dia, copia);
  });
});

describe('Nova data', () => {
  it('copia do dia anterior a disponibilidade e a demanda, sem status dos voos nem escala gerada', () => {
    const estado = normalizado({ ...estadoSintetico(), stu: [aluno(1000, {}, { extra: [missaoExtra(1001, { mis: 'IFR', eq: 'C172' })] })] });
    estado.av['PR-BTB'] = false;
    estado.fStatus = { '1000_0_1': 'Cancelado' };
    estado.fObs = { '1000_0_1': { motivo: 'Meteorologia' } };
    estado.criterios = { buracos: 'maior', horarios: 'fixos' };
    const anterior = { ...separar(estado).dia, resultado: { out: [{ fKey: '1000_0_1' }], al: [], tot: 1 } };
    const novo = diaParaCopiar(anterior);
    assert.deepEqual(Object.keys(novo).sort(), ['aprovacao', 'av', 'criterios', 'fObs', 'fStatus', 'filas', 'fixos', 'hangar', 'horas', 'importadas', 'ins', 'pedidos', 'win']);
    assert.deepEqual([novo.fStatus, novo.fObs, novo.fixos, novo.aprovacao], [{}, {}, {}, null], 'a data nova começa sem status, sem voos fixos e sem aprovação');
    assert.deepEqual(novo.hangar, anterior.hangar, 'a ordem do hangar continua a da data anterior');
    assert.deepEqual(novo.criterios, anterior.criterios, 'os critérios da compactação continuam os da data anterior');
    assert.equal(novo.av['PR-BTB'], false);
    assert.deepEqual(novo.pedidos[1000], anterior.pedidos[1000]);
    novo.pedidos[1000].extra[0].p1 = 7;
    assert.notEqual(anterior.pedidos[1000].extra[0].p1, 7, 'a cópia é independente');
  });

  it('dia sem disponibilidade nem demanda (importado do BI) copia como dia padrão', () => {
    assert.deepEqual(diaParaCopiar({ resultado: { out: [], al: [], tot: 0 }, importado: true }), diaPadrao());
  });
});

describe('Conversão dos documentos da fase 2', () => {
  const escala = { out: [{ fKey: '1000_0_1', h: 1, r: 'PP-LJV' }], al: [], tot: 1 };

  it('data da escala: a gravada na escala, senão o dia do BI com a mesma escala, senão a data padrão', () => {
    assert.equal(inferirDataDaEscala({ ...escala, data: '2026-11-20' }, {}, '2026-11-11'), '2026-11-20');
    const bi = { '2026-11-09': { out: [{ fKey: 'outro' }] }, '2026-11-10': { out: escala.out } };
    assert.equal(inferirDataDaEscala(escala, bi, '2026-11-11'), '2026-11-10');
    assert.equal(inferirDataDaEscala(escala, { '2026-11-09': { out: [] } }, '2026-11-11'), '2026-11-11');
    assert.equal(inferirDataDaEscala(null, {}, '2026-11-11'), '2026-11-11');
  });

  it('gera cadastro, a escala atual, os dias do BI e o histórico para importar', () => {
    const estado = { ...estadoSintetico(), stu: [aluno(1000)] };
    const bi = {
      '2026-10-16': { out: [{ fKey: 'a', h: 2 }], tot: 3, rej: 1 },
      '2026-11-10': { out: escala.out, tot: 1, rej: 0 }
    };
    const id = Date.UTC(2026, 10, 9, 13, 0, 0) + 123;
    const historico = [{ id, ts: '10:00:00', type: 'exc', desc: 'PR-BTB: Manutenção', revert: { kind: 'setAv' } }, { id: 7, ts: '?', type: 'mod', desc: 'id estranho', revert: null }];

    // Quem chama normaliza o estado antes (como o ApiClient faz ao ler os documentos)
    const plano = converterLegado({ estado: normalizado(estado), escala, historico, bi }, '2026-11-11');
    assert.equal(plano.dataAtual, '2026-11-10');
    assert.deepEqual(plano.cadastro, separar(normalizado(estado)).cadastro);
    assert.deepEqual(Object.keys(plano.dias).sort(), ['2026-10-16', '2026-11-10']);
    assert.deepEqual(plano.dias['2026-11-10'], { ...separar(normalizado(estado)).dia, resultado: escala });
    assert.deepEqual(plano.dias['2026-10-16'], { importado: true, resultado: { out: [{ fKey: 'a', h: 2 }], al: [], tot: 3, rej: 1, data: '2026-10-16' } });
    assert.deepEqual(plano.historico, [
      { registrado_em: '2026-11-09T13:00:00.123Z', tipo: 'exc', descricao: 'PR-BTB: Manutenção' },
      { registrado_em: null, tipo: 'mod', descricao: 'id estranho' }
    ]);
  });

  it('sem escala gerada: a data atual é a padrão e o dia não tem resultado', () => {
    const plano = converterLegado({ estado: normalizado(estadoSintetico()), escala: null, historico: [], bi: {} }, '2026-11-11');
    assert.equal(plano.dataAtual, '2026-11-11');
    assert.equal(plano.dias['2026-11-11'].resultado, null);
  });
});

describe('BI a partir das escalas guardadas', () => {
  it('cada data com escala gerada vira um registro do BI (voos, missões e rejeições)', () => {
    const dias = [
      { data: '2026-11-10', conteudo: { resultado: { out: [{ fKey: 'x' }], al: [{ t: 'err' }, { t: 'warn' }], tot: 3 } } },
      { data: '2026-11-11', conteudo: { pedidos: {}, resultado: null } },
      { data: '2026-10-16', conteudo: { importado: true, resultado: { out: [], al: [], tot: 2, rej: 2 } } }
    ];
    assert.deepEqual(biDosDias(dias), {
      '2026-11-10': { out: [{ fKey: 'x' }], tot: 3, rej: 1 },
      '2026-10-16': { out: [], tot: 2, rej: 2 }
    });
  });
});

describe('Horas até a revisão de 50 horas', () => {
  const anterior = {
    ...diaPadrao(),
    horas: { 'PR-BTB': 40, 'PP-LJV': 49.5, 'PR-IGU': 10 },
    fStatus: { b: 'Cancelado' },
    resultado: {
      out: [
        { fKey: 'a', r: 'PR-BTB', eqType: 'C152', h: 2 },
        { fKey: 'b', r: 'PR-BTB', eqType: 'C152', h: 1 },
        { fKey: 'c', r: 'PP-LJV', eqType: 'C152', h: 0.5, status: 'Confirmado' },
        { fKey: 'd', r: 'PR-VOB', eqType: 'C152', h: 1 },
        { fKey: 'e', r: 'SALA-GROUND', eqType: 'Sala Ground', h: 1.5, isGround: true }
      ],
      al: [], tot: 5
    }
  };

  it('a nova data começa com as horas do dia anterior mais os voos dele que não foram cancelados', () => {
    const esperado = { 'PR-BTB': 42, 'PP-LJV': 50, 'PR-IGU': 10 };
    assert.deepEqual(horasDoDiaSeguinte(anterior), esperado, 'o voo cancelado não conta; avião sem horas informadas continua sem');
    assert.deepEqual(diaParaCopiar(anterior).horas, esperado);
  });

  it('sem escala no dia anterior, as horas seguem iguais; dia sem horas começa sem horas', () => {
    assert.deepEqual(horasDoDiaSeguinte({ ...anterior, resultado: null }), anterior.horas);
    assert.deepEqual(horasDoDiaSeguinte({ resultado: anterior.resultado }), {});
    assert.deepEqual(diaPadrao().horas, {});
  });

  it('as horas fazem parte do dia (separar e juntar)', () => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), horas: { 'PR-BTB': 12.5 } });
    const { dia } = separar(estado);
    assert.deepEqual(dia.horas, { 'PR-BTB': 12.5 });
    assert.deepEqual(juntar(separar(estado).cadastro, dia).horas, { 'PR-BTB': 12.5 });
  });
});

describe('Filas do rodízio por data', () => {
  it('as filas fazem parte do dia e a nova data começa com quem voou na categoria no fim da fila', () => {
    const estado = ApiClient.normalizeAndMigrateState({
      ...estadoSintetico(),
      ins: [instrutor(1, 9), instrutor(2, 9), instrutor(3, 1)],
      filas: { c172: [1, 2] }
    });
    const { dia, cadastro } = separar(estado);
    assert.deepEqual(dia.filas.c172, [1, 2]);
    assert.deepEqual(juntar(cadastro, dia).filas.c172, [1, 2]);
    const anterior = { ...dia, resultado: { out: [{ fKey: 'a', insId: 1, mis: 'Voo Local', eqType: 'C172' }], al: [], tot: 1 } };
    assert.deepEqual(diaParaCopiar(anterior, cadastro.ins).filas.c172, [2, 1]);
  });
});

describe('Disponibilidade do aluno nos pedidos', () => {
  it('a disponibilidade do pedido (e das missões extras) faz parte do dia', () => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000, { jan: 'tarde' }, { extra: [missaoExtra(1001, { jan: 'h2' })] })] });
    const { cadastro, dia } = separar(estado);
    assert.equal(dia.pedidos[1000].jan, 'tarde');
    const volta = juntar(cadastro, dia).stu[0];
    assert.deepEqual([volta.jan, volta.extra[0].jan], ['tarde', 'h610']);
  });
});

describe('Solicitações da agenda importadas', () => {
  it('ficam no dia e não passam para a data seguinte', () => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), importadas: [7, 9] });
    const { cadastro, dia } = separar(estado);
    assert.deepEqual(juntar(cadastro, dia).importadas, [7, 9]);
    assert.deepEqual(diaParaCopiar(dia).importadas, []);
  });
});
