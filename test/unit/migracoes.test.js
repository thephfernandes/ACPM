// Migrações do formato dos dados guardados: cada versão transforma a anterior sem perder nada.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITES_DA_LEI } from '../../js/limites.js';
import { ESQUEMA, FORMATO_DOS_CURSOS, migrarCadastro, migrarDia, precisaMigrar, antesDosCursosProprios, renomearSimulador } from '../../js/migracoes.js';
import { FROTA_INICIAL } from '../../js/frota.js';
import { HORARIOS_INICIAIS } from '../../js/horarios.js';
import { EQ } from '../../js/config.js';
import { habilitacoesDoNivel } from '../../js/habilitacoes.js';

describe('Migrações do formato dos dados', () => {
  // O único lugar que fixa o número: cada passo que muda o formato muda este número, o PASSOS de js/migracoes.js e o
  // README ("Formato dos dados"); os outros testes usam ESQUEMA
  it('o formato dos dados gravados é o 27', () => {
    assert.equal(ESQUEMA, 27);
  });

  it('dia: renomeia os simuladores na disponibilidade e na escala, sem perder nada', () => {
    const antigo = {
      win: [true, false],
      av: { 'SIM-MONO-1': false, 'SIM-MONO-2': true, 'SIM-MULTI-1': true, 'SIM-MULTI-2': false, 'PR-BTB': false },
      ins: { 1: { on: true, aw: [true, false] } },
      pedidos: { 1000: { fly: true, mis: 'Simulador', eq: 'Sim. Mono', extra: [] } },
      fStatus: { '1000_0_1': 'Cancelado' },
      resultado: { out: [{ fKey: '1000_0_1', r: 'SIM-MONO-2', eqType: 'Sim. Mono' }, { fKey: '1001_0_1', r: 'PR-BTB' }], al: [], tot: 2, data: '2026-11-11' },
      campoDeOutraVersao: { x: 1 }
    };
    const novo = migrarDia(structuredClone(antigo));
    assert.equal(novo.esquema, ESQUEMA);
    assert.deepEqual(novo.av, { 'SIM-MONO-A': false, 'SIM-MONO-C': true, 'SIM-MLTE-E': true, 'SIM-MLTE-D': false, 'PR-BTB': false });
    assert.deepEqual(novo.resultado.out.map(o => o.r), ['SIM-MONO-C', 'PR-BTB']);
    assert.deepEqual(novo.resultado.out[0], { ...antigo.resultado.out[0], r: 'SIM-MONO-C' });
    for (const campo of ['win', 'ins', 'pedidos', 'fStatus', 'campoDeOutraVersao']) assert.deepEqual(novo[campo], antigo[campo], campo);
    assert.deepEqual({ ...novo.resultado, out: null }, { ...antigo.resultado, out: null });
  });

  it('dias importados do BI e simulados também são migrados; dia vazio ou ausente não quebra', () => {
    assert.equal(migrarDia({ importado: true, resultado: { out: [{ r: 'SIM-MULTI-1' }] } }).resultado.out[0].r, 'SIM-MLTE-E');
    assert.deepEqual(migrarDia({ simulado: true, resultado: null }), { simulado: true, resultado: null, esquema: ESQUEMA });
    assert.equal(migrarDia(null), null);
    assert.deepEqual(migrarDia({}), { esquema: ESQUEMA });
  });

  it('é idempotente: um dia já no formato atual não muda', () => {
    const atual = migrarDia({ av: { 'SIM-MONO-1': true }, resultado: { out: [{ r: 'SIM-MONO-1' }] } });
    assert.deepEqual(migrarDia(structuredClone(atual)), atual);
    assert.equal(precisaMigrar(atual), false);
    assert.equal(precisaMigrar({ av: {} }), true);
    assert.equal(precisaMigrar({ esquema: '5' }), true, 'versão que não é número conta como a mais antiga');
  });

  it('cadastro: ganha a versão do formato e mantém tudo o que tinha', () => {
    const cadastro = { nid: 1003, ins: [{ id: 1, nm: 'Instrutor 01', lv: 3, kg: 70 }], stu: [{ id: 1000, nm: 'Aluno 1000', kg: 60, bl: [1] }] };
    const novo = migrarCadastro(structuredClone(cadastro));
    assert.equal(novo.esquema, ESQUEMA);
    // Desde as versões 11, 12, 15 e 18, o cadastro também guarda a frota, os horários de decolagem,
    // os limites da lei e o programa dos cursos
    assert.deepEqual({ ...novo, ins: null }, { ...cadastro, ins: null, frota: FROTA_INICIAL, horarios: HORARIOS_INICIAIS, limites: LIMITES_DA_LEI, cursos: { PP: [], PC: [], INVA: [] }, esquema: ESQUEMA });
    assert.equal(migrarCadastro(null), null);
  });

  it('versão 6: cada instrutor recebe as habilitações do seu nível; o nível fica guardado como cópia', () => {
    const cadastro = {
      nid: 1004,
      ins: [{ id: 1, nm: 'A', lv: 1, kg: 70 }, { id: 2, nm: 'B', lv: 9, kg: 80, extra: 'x' }, { id: 3, nm: 'C', kg: 60 }],
      stu: []
    };
    const novo = migrarCadastro(cadastro);
    assert.deepEqual(novo.ins[0], { id: 1, nm: 'A', lv: 1, kg: 70, hab: habilitacoesDoNivel(1) });
    assert.deepEqual(novo.ins[1], { id: 2, nm: 'B', lv: 9, kg: 80, extra: 'x', hab: habilitacoesDoNivel(9) });
    assert.deepEqual(novo.ins[2].hab, habilitacoesDoNivel(1), 'sem nível: o padrão de antes (A01)');
    assert.deepEqual(migrarCadastro({ ...cadastro, esquema: 5 }).ins[0].hab, habilitacoesDoNivel(1), 'cadastro da versão 5 também migra');
    const editado = { ...novo, ins: [{ ...novo.ins[0], hab: ['c172'] }] };
    assert.deepEqual(migrarCadastro(editado), editado, 'quem já está no formato atual não muda');
  });

  it('versão 7: os dias passam a guardar as horas até a revisão de 50 horas (versões anteriores do app não conhecem o campo)', () => {
    const dia = { av: { 'PR-BTB': true }, horas: { 'PR-BTB': 12 }, esquema: 6 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 7);
  });

  it('versão 8: os dias passam a guardar as filas do rodízio (versões anteriores do app não conhecem o campo)', () => {
    const dia = { av: {}, filas: { c172: [1, 2] }, esquema: 7 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 8);
  });

  it('versão 9: os pedidos passam a guardar a disponibilidade do aluno (versões anteriores do app não conhecem o campo)', () => {
    const dia = { pedidos: { 1000: { fly: true, jan: 'tarde' } }, esquema: 8 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 9);
  });

  it('versão 10: os dias passam a guardar as solicitações da agenda já importadas', () => {
    const dia = { importadas: [7], esquema: 9 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 10);
  });

  it('versão 13: os dias passam a guardar os detalhes do status (motivo do cancelamento e novo horário do atraso)', () => {
    const dia = {
      fStatus: { '1000_0_1': 'Cancelado', '1001_0_1': 'Atrasado' },
      fObs: { '1000_0_1': { motivo: 'Meteorologia' }, '1001_0_1': { novoInicio: 640 } },
      esquema: 12
    };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.deepEqual(migrarCadastro({ nid: 1000, ins: [], stu: [], esquema: 12 }).ins, []);
    assert.ok(ESQUEMA >= 13);
  });

  it('versão 14: os dias guardam a ordem dos aviões no hangar', () => {
    const dia = { hangar: ['PR-VOB'], esquema: 13 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 14);
  });

  it('versão 15: o cadastro ganha os limites da Lei do Aeronauta, antes de "esquema"', async () => {
    const { LIMITES_DA_LEI } = await import('../../js/limites.js');
    const novo = migrarCadastro({ nid: 1000, ins: [], stu: [], frota: [], horarios: {}, esquema: 14 });
    assert.deepEqual(novo.limites, LIMITES_DA_LEI);
    assert.deepEqual(Object.keys(novo), ['nid', 'ins', 'stu', 'frota', 'horarios', 'limites', 'cursos', 'esquema']);
    const proprios = { ...LIMITES_DA_LEI, vooMesH: 90 };
    assert.deepEqual(migrarCadastro({ nid: 1000, ins: [], stu: [], limites: proprios, esquema: 14 }).limites, proprios);
    assert.ok(ESQUEMA >= 15);
  });

  it('versão 16: os dias guardam a escala aprovada (os voos fixos e quem aprovou)', () => {
    const dia = {
      fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1 } },
      aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' },
      esquema: 15
    };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 16);
  });

  it('versão 17: os dias guardam os critérios da compactação', () => {
    const dia = { criterios: { buracos: 'aviao', horarios: 'fixos' }, esquema: 16 };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 17);
  });

  it('versão 18: o cadastro ganha o programa dos cursos (vazio), antes de "esquema"', () => {
    const novo = migrarCadastro({ nid: 1000, ins: [], stu: [], frota: [], horarios: {}, limites: {}, esquema: 17 });
    assert.deepEqual(novo.cursos, { PP: [], PC: [], INVA: [] });
    assert.deepEqual(Object.keys(novo), ['nid', 'ins', 'stu', 'frota', 'horarios', 'limites', 'cursos', 'esquema']);
    const proprio = { PP: [{ id: 'PP-01', nome: 'A', mis: 'Voo Local', eq: 'C152', nb: 1 }], PC: [], INVA: [] };
    assert.deepEqual(migrarCadastro({ nid: 1000, ins: [], stu: [], cursos: proprio, esquema: 17 }).cursos, proprio);
    assert.ok(ESQUEMA >= 18);
  });

  it('os nomes novos são os da frota cadastrada, na mesma ordem', () => {
    assert.deepEqual(EQ['Sim. Mono'], ['SIM-MONO-A', 'SIM-MONO-C']);
    assert.deepEqual(EQ['Sim. Multi'], ['SIM-MLTE-E', 'SIM-MLTE-D']);
    assert.deepEqual(['SIM-MONO-1', 'SIM-MONO-2', 'SIM-MULTI-1', 'SIM-MULTI-2'].map(renomearSimulador), [...EQ['Sim. Mono'], ...EQ['Sim. Multi']]);
    assert.equal(renomearSimulador('PR-BTB'), 'PR-BTB');
  });

  // Versão 19: o C152 vira uma habilitação; todos os instrutores de antes a recebem
  it('versão 19: todo instrutor do cadastro recebe a habilitação do C152', () => {
    const cadastro = { esquema: 18, nid: 3, ins: [{ id: 1, nm: 'A', hab: ['local'] }, { id: 2, nm: 'B', hab: ['mlte', 'c152'] }, { id: 3, nm: 'C' }], stu: [] };
    const novo = migrarCadastro(cadastro);
    assert.deepEqual(novo.ins.map(x => x.hab), [['local', 'c152'], ['mlte', 'c152'], ['c152']]);
    assert.equal(novo.esquema, ESQUEMA);
    assert.ok(ESQUEMA >= 19);
  });

  // Versão 20: o checador é credenciado por partes (o curso, o motor e as regras)
  it('versão 20: cada checador antigo recebe as marcas que davam os mesmos cheques; o resto não muda', () => {
    const cadastro = {
      esquema: 19, nid: 4, stu: [],
      ins: [
        { id: 1, nm: 'A', hab: ['local', 'c152', 'checador_vfr'] },
        { id: 2, nm: 'B', hab: ['c172', 'checador_ifr'] },
        { id: 3, nm: 'C', hab: ['mlte', 'checador_mlte', 'checador_vfr'] },
        { id: 4, nm: 'D', hab: ['local', 'c152'] }
      ]
    };
    const novo = migrarCadastro(cadastro);
    assert.deepEqual(novo.ins.map(x => x.hab), [
      ['local', 'c152', 'checa_pp', 'checa_pc', 'checa_inva', 'checa_mnte', 'checa_vfr'],
      ['c172', 'checa_pp', 'checa_pc', 'checa_inva', 'checa_mnte', 'checa_vfr', 'checa_ifr'],
      ['mlte', 'checa_pp', 'checa_pc', 'checa_inva', 'checa_mnte', 'checa_mlte', 'checa_vfr', 'checa_ifr'],
      ['local', 'c152']
    ]);
    assert.equal(novo.esquema, ESQUEMA);
    assert.ok(ESQUEMA >= 20);
  });

  // Versão 21: o status "Pousou". Nada muda nos dados; o número novo faz a aba da versão anterior
  // (que não conhece o Pousou e o apagaria ao abrir o dia) recusar o dia e pedir para recarregar
  it('versão 21: o dia e o cadastro não mudam, só o número do formato', () => {
    const dia = { esquema: 20, fStatus: { '1000_0_1': 'Pousou' }, fObs: { '1000_0_1': { novoInicio: 640 } } };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= 21);
  });

  // Versão 24 (o formato dos cursos): o programa vai para as tabelas dos cursos. O cadastro guarda a cópia de antes
  // ("cursos", que ninguém mais grava); o voo agendado na Escala e o curso da missão do pedido passam pelo dia. Nada
  // muda: o número novo faz a aba da versão anterior recusar a gravação (e tirar esses campos) e pedir para recarregar
  it('versão 24: o cadastro (com a cópia do programa) e o dia não mudam, só o número do formato', () => {
    assert.equal(FORMATO_DOS_CURSOS, 24);
    const cadastro = {
      esquema: 23, nid: 1001, ins: [], stu: [{ id: 1000, nm: 'Aluno 1000', kg: 60, bl: [], curso: 'PP' }], frota: [], horarios: {}, limites: {},
      cursos: { PP: [{ id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local', eq: 'C152', nb: 1 }], PC: [], INVA: [] }
    };
    const novo = migrarCadastro(structuredClone(cadastro));
    assert.deepEqual(novo, { ...cadastro, esquema: ESQUEMA });
    assert.deepEqual(Object.keys(novo), Object.keys(cadastro), 'nenhum campo sai do cadastro (nem a cópia do programa)');
    const dia = {
      esquema: 23,
      pedidos: { 1000: { fly: true, mis: 'Voo Local', etapa: 'PP-01', cursoDaEtapa: 'PP', insId: 1, extra: [] } },
      fixos: { '1000_0_1': { a: 390, b: 450, r: 'PR-VOB', insId: 1, agendado: true } }
    };
    assert.deepEqual(migrarDia(structuredClone(dia)), { ...dia, esquema: ESQUEMA });
    assert.ok(ESQUEMA >= FORMATO_DOS_CURSOS);
  });

  // Antes do formato dos cursos, o programa de cada curso ainda é o do cadastro: a conversão única o leva para as
  // tabelas dos cursos antes de o cadastro ser regravado
  it('antesDosCursosProprios: o cadastro guardado num formato anterior ao dos cursos (sem "esquema", o mais antigo)', () => {
    for (const esquema of [undefined, 4, 18, 22, 23, '24']) {
      assert.equal(antesDosCursosProprios({ nid: 1000, ins: [], stu: [], ...(esquema === undefined ? {} : { esquema }) }), true, String(esquema));
    }
    for (const esquema of [24, 25]) assert.equal(antesDosCursosProprios({ esquema }), false, String(esquema));
    for (const doc of [null, undefined, 'cadastro', 24]) assert.equal(antesDosCursosProprios(doc), false, String(doc));
    assert.equal(antesDosCursosProprios(migrarCadastro({ nid: 1000, ins: [], stu: [], esquema: 23 })), false, 'regravado, já no formato atual');
  });
});

// Formato 26: o recurso com a habilitação própria e sem a lista exige ganha exige: ['aviao:<matrícula>'] (a marca fica);
// o dia não muda. O número também protege o inativo de alunos, instrutores e recursos
describe('Formato 26', () => {
  const no25 = frota => ({ esquema: 25, nid: 1000, ins: [], stu: [], frota });
  it('a habilitação própria vira a lista exige, com a marca; o que o passo não conhece fica', () => {
    const cadastro = no25([
      { reg: 'PR-VOM', tipo: 'PA-34', habilitacaoPropria: true, outro: 1 },
      { reg: 'pr-low ', tipo: 'C152', habilitacaoPropria: true },
      { reg: 'PR-X', tipo: 'C172', habilitacaoPropria: true, exige: ['ifr'] },
      { reg: 'PR-Y', tipo: 'C152', inativo: true },
      null, 'texto'
    ]);
    const novo = migrarCadastro(cadastro);
    assert.equal(novo.esquema, ESQUEMA);
    assert.deepEqual(novo.frota, [
      { reg: 'PR-VOM', tipo: 'PA-34', habilitacaoPropria: true, outro: 1, exige: ['aviao:PR-VOM'] },
      { reg: 'pr-low ', tipo: 'C152', habilitacaoPropria: true, exige: ['aviao:PR-LOW'] },
      { reg: 'PR-X', tipo: 'C172', habilitacaoPropria: true, exige: ['ifr'] },
      { reg: 'PR-Y', tipo: 'C152', inativo: true },
      null, 'texto'
    ]);
    assert.deepEqual(migrarCadastro({ esquema: 25, nid: 1000, ins: [], stu: [] }), { esquema: ESQUEMA, nid: 1000, ins: [], stu: [] });
  });

  it('o dia não muda', () => {
    const dia = { esquema: 25, win: [true], av: { 'PR-VOM': true } };
    assert.deepEqual(migrarDia(dia), { ...dia, esquema: ESQUEMA });
  });
});

// Formato 27 (F1d): as habilitações endosso_solo e navegacao_150 nos instrutores (a aba do 26 as tiraria como
// desconhecidas) e o limiteConfirmado do pedido do dia. Nada é convertido: ninguém recebe as novas (regra a)
describe('Formato 27', () => {
  it('o cadastro não muda: ninguém recebe Endosso Solo nem Nav. ≥ 150 NM, e quem já as tem fica com elas', () => {
    const cadastro = {
      esquema: 26, nid: 1003, stu: [],
      ins: [
        { id: 1, nm: 'Instrutor 01', hab: habilitacoesDoNivel(9) },
        { id: 2, nm: 'Instrutor 02', hab: ['local', 'c152', 'endosso_solo', 'navegacao_150'] },
        { id: 3, nm: 'Instrutor 03', outro: 1 }
      ],
      frota: [{ reg: 'PR-VOM', tipo: 'PA-34', exige: ['aviao:PR-VOM'] }]
    };
    assert.deepEqual(migrarCadastro(structuredClone(cadastro)), { ...cadastro, esquema: 27 });
    assert.ok(!habilitacoesDoNivel(9).includes('endosso_solo') && !habilitacoesDoNivel(9).includes('navegacao_150'));
  });

  it('o dia não muda', () => {
    const dia = { esquema: 26, win: [true], pedidos: [{ id: 1000, fly: true, mis: 'Voo Local', limiteConfirmado: true }] };
    assert.deepEqual(migrarDia(structuredClone(dia)), { ...dia, esquema: 27 });
  });
});
