// Habilitações individuais dos instrutores: substituem os níveis cumulativos A01–A09.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { HABILITACOES, habilitacoesDoNivel, normalizarHabilitacoes, podeFazer, podeAlgumCheque, descreverExigencias, marcasDoChecadorAntigo, GRUPOS_DE_HABILITACAO, exigenciasDoRecurso, gruposDosRecursos, exigencias, nomeDaHabilitacao, faltaDaMissaoDoCurso } from '../../js/habilitacoes.js';
import { MIS, MATRICULA } from '../../js/config.js';
import { MODELOS } from '../../js/modelos-de-curso.js';

// Regra dos níveis cumulativos, congelada aqui: a migração não pode mudar quem pode fazer o quê
const NIVEL_DA_MISSAO = { 'Simulador': 2, 'Voo Local': 1, 'Navegação': 4, 'Voo Solo': 5, 'Parafuso': 6, 'IFR': 8, 'Noturno': 7, 'Multimotor': 9 };
const NIVEL_DO_EQUIPAMENTO = { 'Sala Ground': 1, 'C152': 1, 'Sim. Mono': 2, 'Sim. Multi': 2, 'C172': 7, 'PA-34': 9 };
const nivelExigido = (mis, eq) => (mis.startsWith('Ground') ? 1 : Math.max(NIVEL_DA_MISSAO[mis], NIVEL_DO_EQUIPAMENTO[eq]));
const MISSOES_DA_FASE_3 = ['Ground C152', 'Ground C172', 'Ground PA-34', 'Ground Navegação', ...Object.keys(NIVEL_DA_MISSAO)];
const com = (...hab) => ({ hab });

describe('Habilitações individuais', () => {
  it('a migração dá a cada nível exatamente o que ele permitia (todas as missões e equipamentos)', () => {
    let casos = 0;
    for (let lv = 1; lv <= 9; lv++) {
      const instrutor = { hab: habilitacoesDoNivel(lv) };
      for (const mis of MISSOES_DA_FASE_3) {
        for (const eq of MIS[mis].eq) {
          assert.equal(podeFazer(instrutor, mis, eq), lv >= nivelExigido(mis, eq), `A0${lv} em ${mis} no ${eq}`);
          casos++;
        }
      }
    }
    assert.equal(casos, 9 * 22);
  });

  it('o que cada nível recebe; quem tem mais nível tem mais habilitações (os checadores começam desmarcados)', () => {
    assert.deepEqual(habilitacoesDoNivel(1), ['grounds', 'ground_pa34', 'local', 'c152']);
    assert.deepEqual(habilitacoesDoNivel(3), ['grounds', 'ground_pa34', 'sim_mono', 'sim_multi', 'tgl', 'local', 'c152']);
    // As habilitações novas do F1d (Endosso Solo e Nav. ≥ 150 NM) não vêm de nível nenhum
    assert.deepEqual(habilitacoesDoNivel(9), HABILITACOES.map(h => h.id).filter(h => !h.startsWith('checa_') && !['endosso_solo', 'navegacao_150'].includes(h)));
    assert.deepEqual(habilitacoesDoNivel('x'), habilitacoesDoNivel(1), 'nível inválido conta como A01');
    for (let lv = 2; lv <= 9; lv++) assert.ok(habilitacoesDoNivel(lv).length > habilitacoesDoNivel(lv - 1).length);
  });

  it('não são cumulativas: instrutor de C172 sem simulador, de PA-34 sem parafuso', () => {
    const c172 = com('local', 'navegacao', 'noturno', 'c172');
    assert.equal(podeFazer(c172, 'Voo Local', 'C172'), true);
    assert.equal(podeFazer(c172, 'Noturno', 'C172'), true);
    assert.equal(podeFazer(c172, 'Simulador', 'Sim. Mono'), false);
    const pa34 = com('local', 'mlte');
    assert.equal(podeFazer(pa34, 'Multimotor', 'PA-34'), true);
    assert.equal(podeFazer(pa34, 'Parafuso', 'PA-34'), false);
    assert.equal(podeFazer(pa34, 'Voo Local', 'C172'), false, 'PA-34 não habilita C172');
    assert.equal(podeFazer(com('sim_multi'), 'Simulador', 'Sim. Mono'), false);
    assert.equal(podeFazer(com('ground_pa34'), 'Ground C152', 'Sala Ground'), false);
    assert.equal(podeFazer({}, 'Voo Local', 'C152'), false, 'sem habilitações não faz nada');
  });

  it('normaliza a lista: só habilitações conhecidas, sem repetição, na ordem da grade', () => {
    assert.deepEqual(normalizarHabilitacoes(['c172', 'xyz', 'local', 'c172', 7]), ['local', 'c172']);
    assert.deepEqual(normalizarHabilitacoes('local'), []);
  });

  it('o C152 exige a habilitação do avião', () => {
    assert.equal(podeFazer(com('local'), 'Voo Local', 'C152'), false);
    assert.equal(podeFazer(com('local', 'c152'), 'Voo Local', 'C152'), true);
    assert.equal(podeFazer(com('local', 'c172'), 'Voo Local', 'C152'), false, 'o C172 não habilita o C152');
    assert.equal(descreverExigencias('Voo Local', 'C152'), 'Voo Local + C152');
  });

  it('TGL (TMA) exige a habilitação TGL (TMA) e a do avião', () => {
    assert.equal(podeFazer(com('tgl', 'c152'), 'TGL (TMA)', 'C152'), true);
    assert.equal(podeFazer(com('tgl'), 'TGL (TMA)', 'C152'), false);
    assert.equal(podeFazer(com('tgl'), 'TGL (TMA)', 'C172'), false);
    assert.equal(podeFazer(com('tgl', 'c172'), 'TGL (TMA)', 'C172'), true);
    assert.equal(podeFazer(com('local'), 'TGL (TMA)', 'C152'), false);
  });

  // O checador é credenciado por partes; o cheque exige as três (o curso, o motor e as regras)
  it('voos de cheque exigem as três marcas do checador: o curso, o motor e as regras (só as de checador)', () => {
    const exige = {
      'Cheque PP': ['checa_pp', 'checa_mnte', 'checa_vfr'],
      'Cheque PC MNTE VFR': ['checa_pc', 'checa_mnte', 'checa_vfr'],
      'Cheque PC MNTE IFR': ['checa_pc', 'checa_mnte', 'checa_ifr'],
      'Cheque PC MLTE VFR': ['checa_pc', 'checa_mlte', 'checa_vfr'],
      'Cheque PC MLTE IFR': ['checa_pc', 'checa_mlte', 'checa_ifr']
    };
    for (const [mis, marcas] of Object.entries(exige)) {
      for (const eq of MIS[mis].eq) {
        assert.equal(podeFazer(com(...marcas), mis, eq), true, `${mis} no ${eq}`);
        for (const falta of marcas) assert.equal(podeFazer(com(...marcas.filter(h => h !== falta)), mis, eq), false, `${mis} sem ${falta}`);
      }
    }
    assert.equal(podeFazer(com('checa_pc', 'checa_mnte', 'checa_vfr'), 'Cheque PP', 'C152'), false, 'checador do PC não checa o PP');
    assert.equal(podeFazer(com('checa_pp', 'checa_mlte', 'checa_ifr'), 'Cheque PP', 'C152'), false, 'o PP é monomotor e VFR');
    assert.equal(podeFazer(com('local', 'ifr', 'c172', 'mlte'), 'Cheque PP', 'C152'), false, 'sem checador, não faz cheque');
    assert.equal(podeAlgumCheque(com('checa_pc', 'checa_mlte', 'checa_ifr')), true);
    assert.equal(podeAlgumCheque(com('checa_inva', 'checa_mnte', 'checa_vfr')), false, 'não há cheque de INVA na escala');
  });

  it('as habilitações de checador antigas (VFR, IFR e MLTE IFR) viram as marcas que davam os mesmos cheques', () => {
    const cheques = Object.keys(MIS).filter(m => m.startsWith('Cheque'));
    const antes = {
      checador_vfr: ['Cheque PP', 'Cheque PC MNTE VFR'],
      checador_ifr: ['Cheque PP', 'Cheque PC MNTE VFR', 'Cheque PC MNTE IFR'],
      checador_mlte: cheques
    };
    for (const [antiga, podia] of Object.entries(antes)) {
      const x = com(...marcasDoChecadorAntigo([antiga]));
      for (const mis of cheques) for (const eq of MIS[mis].eq) assert.equal(podeFazer(x, mis, eq), podia.includes(mis), `${antiga}: ${mis} no ${eq}`);
      assert.ok(x.hab.includes('checa_inva'), `${antiga}: o nome dizia INVA`);
    }
    assert.deepEqual(marcasDoChecadorAntigo(['local', 'c152']), ['local', 'c152']);
  });

  it('descreve o que a missão exige', () => {
    assert.equal(descreverExigencias('IFR', 'C172'), 'Voo IFR + C172');
    assert.equal(descreverExigencias('Multimotor', 'PA-34'), 'MLTE (PA-34)');
    assert.equal(descreverExigencias('Simulador', 'Sim. Multi'), 'Simulador (Multi)');
    assert.equal(descreverExigencias('Ground Navegação', 'Sala Ground'), 'Grounds (C152, C172 e Navegação)');
    assert.equal(descreverExigencias('TGL (TMA)', 'C172'), 'TGL (TMA) + C172');
    assert.equal(descreverExigencias('Cheque PC MNTE IFR', 'C172'), 'Checador do curso PC + Checador MNTE + Checador IFR');
  });
});

// O registro das habilitações (formato 26): os grupos do painel e o que cada recurso exige do instrutor (exige: ids do
// registro ou "aviao:<matrícula>"). O motor não muda: ele pergunta ao recurso o que ele exige
describe('O registro das habilitações', () => {
  it('os grupos do painel das habilitações usam só ids do registro, cada um uma vez', () => {
    assert.deepEqual(GRUPOS_DE_HABILITACAO.map(g => g.titulo), ['Ground e simulador', 'Voo', 'Aviões', 'Checador: curso', 'Checador: motor', 'Checador: regras']);
    const ids = GRUPOS_DE_HABILITACAO.flatMap(g => g.ids);
    assert.deepEqual([...ids].sort(), HABILITACOES.map(h => h.id).sort());
    assert.equal(GRUPOS_DE_HABILITACAO.find(g => g.titulo === 'Checador: curso').dica, 'checador');
    for (const g of GRUPOS_DE_HABILITACAO) assert.match(g.id, /^[a-z-]+$/);
  });

  it('o recurso exige a lista exige; sem ela, o gravado antes do 26 com a habilitação própria exige a dele', () => {
    assert.deepEqual(exigenciasDoRecurso({ reg: 'PR-VOM', tipo: 'PA-34', exige: ['aviao:PR-VOM'] }), ['aviao:PR-VOM']);
    assert.deepEqual(exigenciasDoRecurso({ reg: 'PR-VOM', tipo: 'PA-34', habilitacaoPropria: true }), ['aviao:PR-VOM']);
    assert.deepEqual(exigenciasDoRecurso({ reg: 'PR-X', tipo: 'C172', exige: ['ifr'] }), ['ifr']);
    assert.deepEqual(exigenciasDoRecurso({ reg: 'PR-X', tipo: 'C172' }), []);
    assert.deepEqual(exigenciasDoRecurso(null), []);
  });

  it('um C172 que exige IFR só voa com o instrutor que tem IFR (além do C172 e da missão)', () => {
    const recurso = { reg: 'PR-X', tipo: 'C172', exige: ['ifr'] };
    assert.equal(podeFazer(com('local', 'c172'), 'Voo Local', 'C172', { recurso }), false);
    assert.equal(podeFazer(com('local', 'c172', 'ifr'), 'Voo Local', 'C172', { recurso }), true);
    assert.equal(descreverExigencias('Voo Local', 'C172', { recurso }), 'Voo Local + C172 + Voo IFR');
  });

  it('os grupos dos recursos: as habilitações próprias que algum recurso exige, na ordem da frota', () => {
    const frota = [{ reg: 'PR-A', tipo: 'C152' }, { reg: 'PR-VOM', tipo: 'PA-34', exige: ['aviao:PR-VOM'] }, { reg: 'PR-X', tipo: 'C172', exige: ['ifr', 'aviao:PR-X'] }];
    assert.deepEqual(gruposDosRecursos(frota), [{ id: 'habilitacao-propria', titulo: 'Habilitação própria do recurso', ids: ['aviao:PR-VOM', 'aviao:PR-X'], dica: 'habilitacao-propria' }]);
    assert.deepEqual(gruposDosRecursos([{ reg: 'PR-A', tipo: 'C152' }]), []);
  });
});

// Um registro só (F1d, "registro"): o que cada tipo de missão, cada tipo de recurso, cada cheque e o curso do aluno exigem
// são listas de ids ao lado de HABILITACOES, lidas só por exigencias(). As respostas de antes, congeladas aqui: os 32
// pares de missão e tipo de MIS e o Noturno do PC
describe('Um registro só das habilitações', () => {
  const ANTES = [
    ['Ground C152', 'Sala Ground', [['grounds']]], ['Ground C172', 'Sala Ground', [['grounds']]],
    ['Ground PA-34', 'Sala Ground', [['ground_pa34']]], ['Ground Navegação', 'Sala Ground', [['grounds']]],
    ['Simulador', 'Sim. Mono', [['sim_mono']]], ['Simulador', 'Sim. Multi', [['sim_multi']]],
    ['Voo Local', 'C152', [['local'], ['c152']]], ['Voo Local', 'C172', [['local'], ['c172']]], ['Voo Local', 'PA-34', [['local'], ['mlte']]],
    ['TGL (TMA)', 'C152', [['tgl'], ['c152']]], ['TGL (TMA)', 'C172', [['tgl'], ['c172']]], ['TGL (TMA)', 'PA-34', [['tgl'], ['mlte']]],
    ['Navegação', 'C152', [['navegacao'], ['c152']]], ['Navegação', 'C172', [['navegacao'], ['c172']]], ['Navegação', 'PA-34', [['navegacao'], ['mlte']]],
    ['Voo Solo', 'C152', [['solo'], ['c152']]], ['Voo Solo', 'C172', [['solo'], ['c172']]], ['Voo Solo', 'PA-34', [['solo'], ['mlte']]],
    ['Parafuso', 'C152', [['parafuso'], ['c152']]], ['Parafuso', 'C172', [['parafuso'], ['c172']]], ['Parafuso', 'PA-34', [['parafuso'], ['mlte']]],
    ['IFR', 'C172', [['ifr'], ['c172']]], ['IFR', 'PA-34', [['ifr'], ['mlte']]],
    ['Noturno', 'C172', [['noturno'], ['c172']]],
    ['Multimotor', 'PA-34', [['mlte']]],
    ['Cheque PP', 'C152', [['checa_pp'], ['checa_mnte'], ['checa_vfr']]], ['Cheque PP', 'C172', [['checa_pp'], ['checa_mnte'], ['checa_vfr']]],
    ['Cheque PC MNTE VFR', 'C152', [['checa_pc'], ['checa_mnte'], ['checa_vfr']]], ['Cheque PC MNTE VFR', 'C172', [['checa_pc'], ['checa_mnte'], ['checa_vfr']]],
    ['Cheque PC MNTE IFR', 'C172', [['checa_pc'], ['checa_mnte'], ['checa_ifr']]],
    ['Cheque PC MLTE VFR', 'PA-34', [['checa_pc'], ['checa_mlte'], ['checa_vfr']]],
    ['Cheque PC MLTE IFR', 'PA-34', [['checa_pc'], ['checa_mlte'], ['checa_ifr']]]
  ];

  it('os 32 pares de missão e tipo e o Noturno do PC exigem o mesmo que antes, na mesma ordem e com o mesmo texto', () => {
    const pares = Object.entries(MIS).flatMap(([mis, m]) => m.eq.map(eq => [mis, eq]));
    assert.equal(pares.length, 32);
    assert.deepEqual(pares, ANTES.map(([mis, eq]) => [mis, eq]));
    for (const [mis, eq, grupos] of ANTES) assert.deepEqual(exigencias(mis, eq), grupos, `${mis} no ${eq}`);
    assert.deepEqual(exigencias('Noturno', 'C172', { curso: 'PC' }), [['noturno'], ['c172'], ['ifr']]);
    assert.deepEqual(exigencias('Noturno', 'C172', { curso: 'PP' }), [['noturno'], ['c172']]);
    assert.equal(descreverExigencias('Noturno', 'C172', { curso: 'PC' }), 'Voo Noturno + C172 + Voo IFR');
    // Os padrões de antes: o simulador sem o tipo dele, a missão fora de MIS, a missão sem o avião
    assert.deepEqual(exigencias('Simulador', 'C152'), [['sim_mono'], ['c152']]);
    assert.deepEqual(exigencias('Xyz', 'C152'), [['local'], ['c152']]);
    assert.deepEqual(exigencias('Voo Local', 'Sala Ground'), [['local']]);
    assert.deepEqual(exigencias('constructor', 'toString', { curso: 'constructor' }), [['local']]);
  });

  it('cada id das listas, dos grupos, dos níveis, da grade e dos modelos de curso está no registro (ou é aviao:<matrícula>)', () => {
    const ids = new Set(HABILITACOES.map(h => h.id));
    const valido = id => ids.has(id) || (/^aviao:/.test(id) && MATRICULA.test(id.slice('aviao:'.length)));
    const cursos = ['PP', 'PC', 'INVA', 'ZZ9'];
    const dasMissoes = Object.entries(MIS).flatMap(([mis, m]) => [...m.eq, 'Sala Ground', 'Xyz']
      .flatMap(eq => [undefined, ...cursos].flatMap(curso => exigencias(mis, eq, { curso }).flat())));
    const dosGrupos = GRUPOS_DE_HABILITACAO.flatMap(g => g.ids);
    const dosNiveis = Array.from({ length: 9 }, (_, i) => habilitacoesDoNivel(i + 1)).flat();
    const fonte = readFileSync(new URL('../../js/views/instrutores.js', import.meta.url), 'utf8');
    const grade = fonte.match(/const ORDEM_DA_GRADE = \[([^\]]*)\]/);
    assert.ok(grade, 'ORDEM_DA_GRADE em js/views/instrutores.js');
    const daGrade = [...grade[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    assert.ok(daGrade.length >= 13);
    const dosModelos = Object.values(MODELOS).flatMap(m => m.fases.flatMap(f => f.missoes.flatMap(x => x.exige || [])));
    for (const [onde, lista] of [['missões', dasMissoes], ['grupos', dosGrupos], ['níveis', dosNiveis], ['grade', daGrade], ['modelos', dosModelos]]) {
      for (const id of lista) assert.ok(valido(id), `${onde}: ${id}`);
    }
  });

  it('nenhum módulo além de js/habilitacoes.js compara uma lista de habilitações com um id escrito no código', () => {
    // As exceções, pelo nome: os passos de js/migracoes.js e a marca "Checador" da grade (só exibição, até o C)
    const PERMITIDOS = [{ arquivo: 'js/migracoes.js' }, { arquivo: 'js/views/instrutores.js', trecho: "startsWith('checa_')" }];
    assert.deepEqual(comparacoesComIdLiteral("const c = x.hab.includes('c172');"), ["x.hab.includes('c172')"]);
    assert.deepEqual(comparacoesComIdLiteral('ok = (i.hab || []).some(h => h === "ifr") && 1'), ['(i.hab || []).some(h => h === "ifr")']);
    assert.deepEqual(comparacoesComIdLiteral('x.hab.indexOf(`mlte`) >= 0'), ['x.hab.indexOf(`mlte`)']);
    assert.deepEqual(comparacoesComIdLiteral('x.hab.includes(h); filas[id].indexOf(x.id); eq === \'C172\''), []);
    const achados = [];
    for (const arquivo of arquivosDoApp()) {
      if (arquivo === 'js/habilitacoes.js') continue;
      const texto = readFileSync(new URL(`../../${arquivo}`, import.meta.url), 'utf8');
      for (const trecho of comparacoesComIdLiteral(texto)) {
        if (PERMITIDOS.some(p => p.arquivo === arquivo && (!p.trecho || trecho.includes(p.trecho)))) continue;
        achados.push(`${arquivo}: ${trecho}`);
      }
    }
    assert.deepEqual(achados, []);
  });
});

// As comparações de uma lista de habilitações (hab) com um id escrito no código: hab.includes('x') (indexOf), e
// hab.some(h => h === 'x') (every, find, filter; também startsWith e includes no elemento)
function comparacoesComIdLiteral(texto) {
  const lista = String.raw`(?:\(\s*)?[\w.$]*\bhab\b(?:\s*\|\|\s*\[\])?(?:\s*\))?`;
  const literal = String.raw`(?:'[^'\n]*'|"[^"\n]*"|\x60[^\x60\n]*\x60)`;
  const direta = new RegExp(String.raw`${lista}\.(?:includes|indexOf|lastIndexOf)\(\s*${literal}\s*\)`, 'g');
  const callback = new RegExp(String.raw`${lista}\.(?:some|every|find|findIndex|filter)\(\s*\(?\s*(\w+)\s*\)?\s*=>[^;\n]*?\b\1\s*(?:===|!==|==|!=|\.startsWith\(|\.includes\()\s*${literal}[^;\n]*?\)`, 'g');
  return [...texto.matchAll(direta), ...texto.matchAll(callback)].map(m => m[0]);
}

function arquivosDoApp(pasta = 'js') {
  return readdirSync(new URL(`../../${pasta}`, import.meta.url), { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? arquivosDoApp(`${pasta}/${e.name}`) : e.name.endsWith('.js') ? [`${pasta}/${e.name}`] : []));
}

// N5 (F1d, "novas habilitações", formato 27): Endosso Solo e o voo de navegação de 150 NM ou mais têm habilitação própria,
// no grupo Voo, ao lado da Liberação de Solo e da Navegação (que continuam com as missões delas). Ninguém começa com elas
// (regra a), nenhum tipo de missão nem nível as exige: valem quando uma missão do curso as pede
describe('As habilitações novas: Endosso Solo e Nav. ≥ 150 NM', () => {
  it('estão no registro, com os nomes, no grupo Voo, ao lado de solo e navegacao', () => {
    const porId = new Map(HABILITACOES.map(h => [h.id, h]));
    assert.deepEqual(porId.get('endosso_solo'), { id: 'endosso_solo', nome: 'Endosso Solo', curto: 'Endosso Solo' });
    assert.deepEqual(porId.get('navegacao_150'), { id: 'navegacao_150', nome: 'Voo de Navegação ≥ 150 NM', curto: 'Nav. ≥ 150 NM' });
    assert.deepEqual(GRUPOS_DE_HABILITACAO.find(g => g.id === 'voo').ids,
      ['tgl', 'local', 'navegacao', 'navegacao_150', 'solo', 'endosso_solo', 'parafuso', 'ifr', 'noturno']);
    assert.deepEqual(normalizarHabilitacoes(['endosso_solo', 'ifr', 'navegacao_150', 'solo', 'navegacao']), ['navegacao', 'navegacao_150', 'solo', 'endosso_solo', 'ifr']);
    assert.equal(nomeDaHabilitacao('navegacao_150'), 'Voo de Navegação ≥ 150 NM');
  });

  it('ninguém as recebe de um nível, e nenhum tipo de missão, cheque ou curso as exige', () => {
    for (let lv = 1; lv <= 9; lv++) assert.ok(!habilitacoesDoNivel(lv).some(h => ['endosso_solo', 'navegacao_150'].includes(h)), `A0${lv}`);
    for (const [mis, m] of Object.entries(MIS)) {
      for (const eq of m.eq) {
        for (const curso of [undefined, 'PP', 'PC', 'INVA']) {
          assert.ok(!exigencias(mis, eq, { curso }).flat().some(h => ['endosso_solo', 'navegacao_150'].includes(h)), `${mis} no ${eq}`);
        }
      }
    }
    // Voo Solo e Navegação continuam pedindo só o de antes: quem tem só a nova não dá a missão
    assert.equal(podeFazer(com('endosso_solo', 'c152'), 'Voo Solo', 'C152'), false);
    assert.equal(podeFazer(com('solo', 'c152'), 'Voo Solo', 'C152'), true);
    assert.equal(podeFazer(com('navegacao_150', 'c152'), 'Navegação', 'C152'), false);
  });
});

// F1d, "missão do curso": o que a missão do curso exige (exige, no contexto do voo) soma às do tipo, do curso e do recurso
describe('O que a missão do curso exige do INVA, no contexto do voo', () => {
  it('cada id de exige é mais um grupo (todos exigidos), sem repetir o que já se exige', () => {
    assert.deepEqual(exigencias('Voo Solo', 'C152', { exige: ['endosso_solo'] }), [['solo'], ['c152'], ['endosso_solo']]);
    assert.deepEqual(exigencias('Navegação', 'C172', { exige: ['navegacao_150', 'c172', 'ifr'] }), [['navegacao'], ['c172'], ['navegacao_150'], ['ifr']]);
    assert.deepEqual(exigencias('Noturno', 'C172', { curso: 'PC', exige: ['ifr', 'endosso_solo'] }), [['noturno'], ['c172'], ['ifr'], ['endosso_solo']]);
    assert.deepEqual(exigencias('Voo Solo', 'C152', { exige: [] }), exigencias('Voo Solo', 'C152'));
    assert.deepEqual(exigencias('Voo Solo', 'C152', { exige: 'endosso_solo' }), exigencias('Voo Solo', 'C152'), 'só uma lista conta');
    assert.equal(podeFazer(com('solo', 'c152'), 'Voo Solo', 'C152', { exige: ['endosso_solo'] }), false);
    assert.equal(podeFazer(com('solo', 'c152', 'endosso_solo'), 'Voo Solo', 'C152', { exige: ['endosso_solo'] }), true);
    assert.equal(descreverExigencias('Voo Solo', 'C152', { exige: ['endosso_solo'] }), 'Voo para liberação de Solo + C152 + Endosso Solo');
  });

  it('a primeira habilitação da missão do curso que o instrutor não tem', () => {
    assert.equal(faltaDaMissaoDoCurso(com('solo', 'endosso_solo'), ['endosso_solo', 'navegacao_150']), 'navegacao_150');
    assert.equal(faltaDaMissaoDoCurso(com('solo'), []), null);
    assert.equal(faltaDaMissaoDoCurso({}, ['ifr']), 'ifr');
    assert.equal(faltaDaMissaoDoCurso(com('ifr'), undefined), null);
  });
});
