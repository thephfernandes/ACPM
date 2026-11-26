// O programa dos cursos em fases: o programa de antes (o do cadastro) no formato novo, uma fase por curso com as missões
// na mesma ordem, e o índice do programa (o curso, o caminho dele, a missão pelo id e pelo código); o programa lido do
// servidor nos formatos certos; a gravação de um curso e a conversão do cadastro como no servidor, com os casos que o
// banco também confere (test/helpers/casos-do-programa.js) e o que eles não mostram; a edição na aba Cursos; e os cursos
// novos, o nome, encerrar e o modelo de programa (o cronograma do PP, de js/modelos-de-curso.js).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  programaDoLegado, percursoDoCurso, indiceDoPrograma, rotuloDaFase, nomeDaFase, normalizarProgramas, gravarCurso, importarProgramas,
  programaComResultados, cursosIniciais, novoId, conteudoDoCurso, incluirMissao, mudarMissao, moverMissao, retirarMissao, validarCurso
} from '../../js/programa.js';
import {
  requisitosPossiveis, definirRegra, marcarMissao, mudarFase, incluirFase, moverFase, moverMissaoParaFase, retirarFase, restaurarFase,
  restaurarMissao, ordemRecusada
} from '../../js/programa.js';
import { normalizarCursos } from '../../js/cursos.js';
import { FORMATO_DOS_CURSOS } from '../../js/migracoes.js';
import { CASOS_DO_PROGRAMA, PROGRAMA, IDS, NOTURNO_EM_TRECHOS } from '../helpers/casos-do-programa.js';
import { noturnosDoCurso, rotuloDaMissao, definirTrecho, mudarCurso, aplicarModelo, novoCurso } from '../../js/programa.js';
import { exigirNaMissao, comExigenciasDasMissoes, exigeDaMissaoDoPedido } from '../../js/programa.js';
import { MODELOS } from '../../js/modelos-de-curso.js';

const gerarId = (sigla, codigo) => `${sigla}:${codigo}`;
// O cronograma do PP (o modelo do app) como o curso PP, com os ids tirados da sigla e da chave (PP:F4, PP:TSL-01)
const cursoPP = () => novoCurso([], { sigla: 'PP', nome: 'Piloto Privado', modelo: MODELOS['pp-acpm'] }, gerarId).curso;
const missao = (id, extra = {}) => ({ id, nome: `Missão ${id}`, mis: 'Voo Local', eq: 'C152', nb: 1, ...extra });

describe('O programa de antes no formato novo', () => {
  it('os três cursos, na ordem, cada um numa fase "Programa" com as missões na mesma ordem, todas depois das anteriores', () => {
    const cursos = normalizarCursos({ PP: [missao('PP-01'), missao('PP-02', { nome: 'Navegação', mis: 'Navegação', nb: 2 })], PC: [missao('PC-01', { mis: 'IFR', eq: 'C172' })] });
    const programa = programaDoLegado(cursos, gerarId);
    assert.deepEqual(programa.map(({ sigla, nome, ordem, ativo }) => ({ sigla, nome, ordem, ativo })), [
      { sigla: 'PP', nome: 'Piloto Privado', ordem: 0, ativo: true },
      { sigla: 'PC', nome: 'Piloto Comercial', ordem: 1, ativo: true },
      { sigla: 'INVA', nome: 'Instrutor de Voo', ordem: 2, ativo: true }
    ]);
    const [pp, pc, inva] = programa;
    assert.deepEqual(pp.fases, [{ id: 'PP:Programa', nome: 'Programa', modulo: null, ordem: 0, regra: 'ordem', requer: [], removida: false }]);
    assert.deepEqual(pp.missoes, [
      { id: 'PP:PP-01', fase: 'PP:Programa', codigo: 'PP-01', nome: 'Missão PP-01', mis: 'Voo Local', eq: 'C152', nb: 1, ordem: 0, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, removida: false },
      { id: 'PP:PP-02', fase: 'PP:Programa', codigo: 'PP-02', nome: 'Navegação', mis: 'Navegação', eq: 'C152', nb: 2, ordem: 1, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, removida: false }
    ]);
    assert.deepEqual(pc.missoes.map(m => [m.id, m.codigo, m.mis, m.eq]), [['PC:PC-01', 'PC-01', 'IFR', 'C172']]);
    // O curso sem missões também vai (a conversão espelha o cadastro)
    assert.deepEqual([inva.fases.length, inva.missoes], [1, []]);
  });

  it('os ids vêm de quem converte (o servidor recebe ids novos; a tela, ids fixos)', () => {
    let n = 0;
    const programa = programaDoLegado(normalizarCursos({ PP: [missao('PP-01')] }), () => `id-${++n}`);
    assert.deepEqual([programa[0].fases[0].id, programa[0].missoes[0].id, programa[0].missoes[0].fase], ['id-1', 'id-2', 'id-1']);
    assert.equal(new Set(programa.flatMap(c => [...c.fases, ...c.missoes].map(x => x.id))).size, n, 'um id para cada fase e missão');
  });
});

describe('O índice do programa', () => {
  // O PP com a NAV-02 tirada do programa e uma fase tirada (sem missões), na mesma ordem da Fase 2
  const comRetiradas = () => {
    const curso = cursoPP();
    curso.missoes.find(m => m.codigo === 'NAV-02').removida = true;
    curso.fases.push({ id: 'PP:velha', nome: 'Fase velha', modulo: null, ordem: 1, regra: 'ordem', requer: [], removida: true });
    // Fora da ordem na lista: o caminho segue a ordem
    curso.fases.reverse();
    curso.missoes.reverse();
    return curso;
  };

  it('o curso pela sigla; o caminho: as fases e as missões do programa na ordem do curso, com a posição de cada missão', () => {
    const programa = [comRetiradas()];
    const indice = indiceDoPrograma(programa);
    assert.equal(indice.curso('PP'), programa[0]);
    assert.equal(indice.curso('PC'), null);
    assert.equal(indice.percurso('PC'), null);
    const { fases, porFase, missoes, posicao } = indice.percurso('PP');
    assert.deepEqual(fases.map(rotuloDaFase), ['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4', 'Fase 5', 'Fase 7', 'Fase 8', 'Fase 6', 'Fase 9']);
    assert.deepEqual(porFase.get('PP:F5').map(m => m.codigo), ['NAV-01', 'NAV-150NM', 'PE-01', 'PE-02', 'PE-03', 'PE-04'], 'a NAV-02 saiu');
    assert.equal(missoes.length, 46);
    assert.deepEqual(missoes.slice(-5).map(m => m.codigo), ['NAV-SOLO-05', 'TSL-01', 'NOT', 'TSL-02', 'AVX-CQ'], 'a Fase 6 depois da 8');
    assert.deepEqual([posicao.get('PP:IN-01'), posicao.get('PP:TSL-01'), posicao.get('PP:AVX-CQ'), posicao.has('PP:NAV-02')], [0, 42, 45, false]);
  });

  it('a missão pelo id e pelo código, também a tirada do programa (o código antigo continua com nome)', () => {
    const indice = indiceDoPrograma([comRetiradas(), ...programaDoLegado(normalizarCursos({ PC: [missao('PC-01')] }), gerarId).slice(1)]);
    assert.equal(indice.missao('PP:NAV-02').nome, 'NAV 02');
    assert.equal(indice.missaoPorCodigo('PP', 'NAV-02').removida, true);
    assert.equal(indice.missaoPorCodigo('PC', 'PC-01').id, 'PC:PC-01');
    assert.equal(indice.missaoPorCodigo('PC', 'NAV-02'), null, 'o código é do curso');
    assert.equal(indice.missao('PP:XX'), null);
  });

  it('calculado uma vez por lista de cursos e uma vez por curso', () => {
    const programa = [cursoPP()];
    assert.equal(indiceDoPrograma(programa), indiceDoPrograma(programa));
    assert.notEqual(indiceDoPrograma(programa), indiceDoPrograma([...programa]));
    assert.equal(indiceDoPrograma(programa).percurso('PP'), percursoDoCurso(programa[0]));
    assert.equal(percursoDoCurso(programa[0]), percursoDoCurso(programa[0]));
  });

  it('o nome curto da fase: o que vem antes do travessão', () => {
    assert.deepEqual(['Fase 6 – Treinamento de Voo Noturno', 'Fase 3 — Coordenação', 'Fase 2 - Navegação', 'Pré-solo', 'Programa', 'Fase 10'].map(nome => rotuloDaFase({ nome })),
      ['Fase 6', 'Fase 3', 'Fase 2', 'Pré-solo', 'Programa', 'Fase 10']);
  });

  // "na Fase 6", mas "na fase Programa" (a fase do programa trazido do cadastro), e não "na Programa"
  it('a fase num texto: o nome curto que já diz "Fase"; senão, com "fase" na frente', () => {
    assert.deepEqual(['Fase 6 – Treinamento de Voo Noturno', 'FASE 2', 'Fase', 'Programa', 'Pré-solo – Revisão', 'Fases finais', 'Faseamento'].map(nome => nomeDaFase({ nome })),
      ['Fase 6', 'FASE 2', 'Fase', 'fase Programa', 'fase Pré-solo', 'fase Fases finais', 'fase Faseamento']);
  });
});

const AGORA = '2026-11-18T13:00:00.000Z';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const porId = lista => [...lista].sort((a, b) => (a.id < b.id ? -1 : 1));
// O curso com as listas em qualquer ordem (os casos comparam pelo id)
const pelosIds = curso => ({ ...curso, fases: porId(curso.fases), missoes: porId(curso.missoes) });
const semHora = ({ registrado_em, ...versao }) => versao;

describe('A gravação de um curso e a conversão do cadastro: os casos do banco, pela regra do app', () => {
  for (const caso of CASOS_DO_PROGRAMA) {
    it(caso.nome, () => {
      const antes = structuredClone(caso.antes);
      const fazer = () => (caso.salvar ? gravarCurso(antes, { ...caso.salvar, agora: AGORA }) : importarProgramas(antes, { ...caso.importar, agora: AGORA }));
      if (caso.erro) {
        assert.throws(fazer, caso.erro);
        assert.deepEqual(antes, caso.antes, 'a recusa não muda nada');
        return;
      }
      const { cursos, retorno, ...gravado } = fazer();
      assert.deepEqual(antes, caso.antes, 'a regra não muda o que estava guardado: devolve os cursos novos');
      assert.deepEqual(retorno, caso.salvar ? { versao: caso.retorno.versao, atualizado_em: AGORA } : caso.retorno);
      const { sigla } = caso.depois;
      assert.deepEqual(pelosIds(cursos.find(c => c.sigla === sigla)), pelosIds(caso.depois));
      assert.deepEqual(cursos.filter(c => c.sigla !== sigla), caso.antes.cursos.filter(c => c.sigla !== sigla), 'os outros cursos ficam como estavam');
      const versoes = caso.salvar ? [gravado.alteracao] : gravado.alteracoes;
      assert.deepEqual(versoes.length ? semHora(versoes.at(-1)) : null, caso.alteracao);
      assert.ok(versoes.every(v => v.registrado_em === AGORA), 'a hora da gravação');
    });
  }
});

describe('A gravação de um curso: o que os casos do banco não mostram', () => {
  // O ZZ9 dos casos guardado na versão 1, com um resultado em ZZ9-01 e o cadastro no formato dos cursos; o PP com uma
  // fase (um id de outro curso)
  const FASE_DO_PP = '00000000-0000-4000-8000-000000000001';
  function comZZ9() {
    const vazio = { cursos: cursosIniciais(), resultados: [], cadastro: null };
    const pp = { nome: 'Piloto Privado', ativo: true, fases: [{ id: FASE_DO_PP, nome: 'Fase 1' }], missoes: [] };
    const { cursos } = gravarCurso(vazio, { sigla: 'PP', versaoLida: 1, conteudo: pp, descricao: 'PP: Fase 1 incluída', agora: AGORA });
    const comZz9 = gravarCurso({ ...vazio, cursos }, { sigla: 'ZZ9', versaoLida: 0, conteudo: PROGRAMA, descricao: 'Curso ZZ9 criado', agora: AGORA });
    return { cursos: comZz9.cursos, resultados: [{ curso: 'ZZ9', missao: 'ZZ9-01' }], cadastro: { esquema: FORMATO_DOS_CURSOS, versao: 7 } };
  }
  const salvarZZ9 = (conteudo, extra = {}) => gravarCurso(comZZ9(), { sigla: 'ZZ9', versaoLida: 1, conteudo, descricao: 'ZZ9: alteração de teste', agora: AGORA, ...extra });
  const comMissao = (conteudo, i, campos) => ({ ...conteudo, missoes: conteudo.missoes.map((m, j) => (j === i ? { ...m, ...campos } : m)) });
  const comFase = (conteudo, i, campos) => ({ ...conteudo, fases: conteudo.fases.map((f, j) => (j === i ? { ...f, ...campos } : f)) });
  const zz9 = gravado => gravado.cursos.find(c => c.sigla === 'ZZ9');
  const doZZ9 = (gravado, id) => [...zz9(gravado).fases, ...zz9(gravado).missoes].find(x => x.id === id);

  it('com mais de um problema, a recusa é a primeira que o servidor daria', () => {
    const muitasFases = Array.from({ length: 51 }, (_, i) => ({ id: i ? `00000000-0000-4000-8001-${String(i).padStart(12, '0')}` : IDS.maiusculo, nome: `Fase ${i + 1}` }));
    const casos = [
      // O formato do cadastro, antes da descrição
      [() => gravarCurso({ ...comZZ9(), cadastro: { esquema: FORMATO_DOS_CURSOS - 1, versao: 7 } }, { sigla: 'ZZ9', versaoLida: 1, conteudo: PROGRAMA, descricao: '' }),
        { code: 'PT409', campo: 'formato' }],
      // A descrição, o nome do curso, "ativo", a versão lida ou a sigla, e só então o programa
      [() => salvarZZ9({ ...PROGRAMA, nome: '' }, { descricao: '' }), { code: '22023', campo: 'descricao' }],
      [() => salvarZZ9({ ...PROGRAMA, nome: '', ativo: 'sim' }), { code: '22023', campo: 'nome' }],
      [() => salvarZZ9({ ...PROGRAMA, ativo: 'sim' }, { versaoLida: 9 }), { code: '22023', campo: 'ativo' }],
      [() => salvarZZ9(comMissao(PROGRAMA, 0, { codigo: 'x' }), { versaoLida: 9 }), { code: 'PT409', campo: null }],
      [() => salvarZZ9(comMissao(PROGRAMA, 0, { codigo: 'x' }), { sigla: 'zz', versaoLida: 0 }), { code: '22023', campo: 'sigla' }],
      // No programa: o limite antes dos ids; o id de outro curso antes dos campos
      [() => salvarZZ9({ ...PROGRAMA, fases: muitasFases, missoes: [] }), { code: '22023', campo: 'limite' }],
      [() => salvarZZ9({ ...comFase(PROGRAMA, 1, { nome: '' }), fases: [...comFase(PROGRAMA, 1, { nome: '' }).fases, { id: FASE_DO_PP, nome: 'Outra' }] }),
        { code: '22023', campo: 'id' }],
      // Os campos, um de cada vez: o módulo antes da regra da fase; a regra da fase antes da fase da missão; o nome da missão
      // antes do tipo
      [() => salvarZZ9(comFase(comFase(PROGRAMA, 0, { regra: 'sempre' }), 1, { modulo: '' })), { code: '22023', campo: 'modulo' }],
      [() => salvarZZ9(comMissao(comFase(PROGRAMA, 0, { regra: 'sempre' }), 0, { fase: IDS.fora })), { code: '22023', campo: 'regra' }],
      [() => salvarZZ9(comMissao(comMissao(PROGRAMA, 0, { nome: ' ' }), 4, { eq: 'C152' })), { code: '22023', campo: 'nome' }],
      // O código fora do formato antes do repetido; o repetido antes dos requisitos; os requisitos antes do código travado
      [() => salvarZZ9(comMissao(comMissao(PROGRAMA, 1, { codigo: 'ZZ9-01' }), 4, { codigo: 'zz' })), { code: '22023', campo: 'codigo' }],
      [() => salvarZZ9(comMissao(comMissao(PROGRAMA, 1, { codigo: 'ZZ9-01' }), 3, { requer: [IDS.m5] })), { code: '23505', campo: 'codigo' }],
      [() => salvarZZ9(comMissao(comMissao(PROGRAMA, 0, { codigo: 'ZZ9-10' }), 3, { requer: [IDS.m5] })), { code: '22023', campo: 'requer' }]
    ];
    for (const [fazer, erro] of casos) assert.throws(fazer, erro, JSON.stringify(erro));
  });

  it('os nomes e as horas como o banco mede e guarda: só o espaço sai das pontas, em caracteres; as horas com uma casa', () => {
    // btrim tira só o espaço: o nome só com uma tabulação vale; o nome fica como veio
    const r = salvarZZ9(comFase({ ...PROGRAMA, nome: '  Curso de teste  ' }, 1, { nome: '\t' }));
    assert.deepEqual([zz9(r).nome, doZZ9(r, IDS.f2).nome], ['  Curso de teste  ', '\t']);
    // Em caracteres (80 aviões são 160 unidades de texto no JS); a descrição não perde os espaços
    assert.equal(zz9(salvarZZ9({ ...PROGRAMA, nome: '🛩'.repeat(80) })).nome.length, 160);
    assert.throws(() => salvarZZ9({ ...PROGRAMA, nome: '🛩'.repeat(81) }), { code: '22023', campo: 'nome' });
    assert.equal(salvarZZ9(PROGRAMA, { descricao: '🛩'.repeat(500) }).alteracao.descricao.length, 1000);
    assert.equal(salvarZZ9(PROGRAMA, { descricao: ' ' }).alteracao.descricao, ' ');
    assert.throws(() => salvarZZ9(PROGRAMA, { descricao: '🛩'.repeat(501) }), { code: '22023', campo: 'descricao' });
    // As horas com uma casa, como o round() do Postgres (a metade vai para cima); o tipo e o recurso conferidos com elas
    const horas = nb => doZZ9(salvarZZ9(comMissao(PROGRAMA, 0, { nb })), IDS.m1).nb;
    assert.deepEqual([1.15, 1.25, 1.149, 0.05, 5.04].map(horas), [1.2, 1.3, 1.1, 0.1, 5]);
    for (const nb of [0.04, 5.05, '1', null]) assert.throws(() => horas(nb), { code: '22023', campo: 'mis' }, String(nb));
    // O Ground de 1,45 h é o de 1,5 h
    assert.equal(doZZ9(salvarZZ9(comMissao(PROGRAMA, 1, { nb: 1.45 })), IDS.m2).nb, 1.5);
  });

  it('as horas de duas casas, de 0,01 a 6 h, como o round() do Postgres faz com o número escrito', () => {
    // A conta em decimal, pelo texto do número (a do banco): a segunda casa decide
    const doBanco = texto => { const [inteira, casas] = texto.split('.'); return (Number(inteira) * 10 + Number(casas[0]) + (casas[1] >= '5' ? 1 : 0)) / 10; };
    const comHoras = nb => ({ nome: 'Curso de teste', ativo: true, fases: [{ id: IDS.f1, nome: 'Fase 1' }], missoes: [{ id: IDS.m1, fase: IDS.f1, codigo: 'ZZ9-01', nome: 'Voo', mis: 'Voo Local', eq: 'C152', nb }] });
    for (let centesimos = 1; centesimos <= 600; centesimos++) {
      const texto = (centesimos / 100).toFixed(2), esperado = doBanco(texto);
      const gravar = () => gravarCurso({ cursos: [], resultados: [], cadastro: null }, { sigla: 'ZZ9', versaoLida: 0, conteudo: comHoras(Number(texto)), descricao: 'Curso ZZ9 criado' });
      if (esperado > 0 && esperado <= 5) assert.equal(gravar().cursos[0].missoes[0].nb, esperado, texto);
      else assert.throws(gravar, { code: '22023', campo: 'mis' }, texto);
    }
  });

  it('o conteúdo vai como JSON: o campo undefined é o campo que falta', () => {
    const r = salvarZZ9(comMissao(comFase(PROGRAMA, 0, { modulo: undefined, requer: undefined }), 0, { regra: undefined, requer: undefined, dispensada: undefined }));
    assert.deepEqual([doZZ9(r, IDS.f1).modulo, doZZ9(r, IDS.m1).regra, doZZ9(r, IDS.m1).dispensada], [null, 'ordem', false]);
    assert.throws(() => salvarZZ9(undefined), { code: '22023', campo: 'limite' });
  });

  it('os requisitos ficam na ordem do curso; o que sai do programa perde os dele e guarda o resto; a missão não fica numa fase que sai', () => {
    assert.deepEqual(doZZ9(salvarZZ9(comMissao(PROGRAMA, 4, { regra: 'depois', requer: [IDS.m4, IDS.m1] })), IDS.m5).requer, [IDS.m1, IDS.m4]);
    // A Fase 3 ("depois" da Fase 1) sai com a missão dela: continua "depois", sem requisitos, como no banco
    const semF3 = { ...PROGRAMA, fases: PROGRAMA.fases.slice(0, 2), missoes: PROGRAMA.missoes.slice(0, 4) };
    const r = salvarZZ9(semF3);
    assert.deepEqual(doZZ9(r, IDS.f3), { id: IDS.f3, nome: 'Fase 3 – Noturno', modulo: null, ordem: 2, regra: 'depois', requer: [], removida: true });
    assert.deepEqual(doZZ9(r, IDS.m5), { ...doZZ9(salvarZZ9(PROGRAMA), IDS.m5), removida: true });
    // A fase marcada como retirada também sai, e a missão dela não fica no programa sem ela
    assert.throws(() => salvarZZ9(comFase(PROGRAMA, 2, { removida: true })), { code: '22023', campo: 'fase' });
  });

  it('o curso novo vai para o fim da lista (até 999); o primeiro curso é o 0. Sem cadastro, grava; o formato do cadastro é o número inteiro do "esquema"', () => {
    const criar = (cursos, cadastro = null) => gravarCurso({ cursos, resultados: [], cadastro }, { sigla: 'ZZ9', versaoLida: 0, conteudo: PROGRAMA, descricao: 'Curso ZZ9 criado', agora: AGORA });
    assert.deepEqual([criar([]), criar(cursosIniciais()), criar([{ ...cursosIniciais()[0], ordem: 999 }])].map(r => zz9(r).ordem), [0, 3, 999]);
    assert.equal(zz9(criar([], { esquema: FORMATO_DOS_CURSOS + 0.9, versao: 1 })).versao, 1);
    for (const esquema of [String(FORMATO_DOS_CURSOS), undefined, FORMATO_DOS_CURSOS - 0.1]) {
      assert.throws(() => criar([], { esquema, versao: 1 }), { code: 'PT409', campo: 'formato' }, String(esquema));
    }
  });

  it('novoId: um uuid novo a cada chamada, no formato que o servidor aceita', () => {
    const ids = Array.from({ length: 50 }, novoId);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => UUID_V4.test(id)), ids.find(id => !UUID_V4.test(id)));
    const fase = novoId();
    const conteudo = { nome: 'Curso novo', ativo: true, fases: [{ id: fase, nome: 'Fase 1' }], missoes: [{ id: novoId(), fase, codigo: 'NV-01', nome: 'NV-01', mis: 'Voo Local', eq: 'C152', nb: 1 }] };
    const { retorno } = gravarCurso({ cursos: cursosIniciais(), resultados: [], cadastro: null }, { sigla: 'NV', versaoLida: 0, conteudo, descricao: 'Curso NV criado: Curso novo' });
    assert.equal(retorno.versao, 1);
  });
});

describe('A conversão do programa do cadastro: o que os casos do banco não mostram', () => {
  const legado = normalizarCursos({ PP: [missao('PP-01'), missao('PP-02', { mis: 'Navegação', nb: 2 })], PC: [missao('PC-01', { mis: 'IFR', eq: 'C172' })] });
  const antes = { cursos: cursosIniciais(), resultados: [], cadastro: { esquema: FORMATO_DOS_CURSOS - 1, versao: 3 } };
  const importar = (programas, estado = antes) => importarProgramas(estado, { programas, versaoDoCadastro: 3, autor: 'Operador', agora: AGORA });

  it('traz o programa de antes com ids novos e o lê de volta igual; o curso vazio e o igual ficam como estavam', () => {
    const programas = programaDoLegado(legado);
    assert.ok(programas.flatMap(c => [...c.fases, ...c.missoes]).every(x => UUID_V4.test(x.id)), 'ids novos, sem gerarId');
    const r = importar(programas);
    assert.equal(r.retorno, 3);
    assert.deepEqual(r.alteracoes.map(semHora), [
      { curso: 'PP', versao: 2, descricao: 'Programa trazido do cadastro (2 missões)', registrado_por: 'Operador' },
      { curso: 'PC', versao: 2, descricao: 'Programa trazido do cadastro (1 missão)', registrado_por: 'Operador' }
    ]);
    // O INVA não tem missões no cadastro nem no servidor (a mesma assinatura): fica sem fase nenhuma, como estava
    assert.deepEqual(r.cursos[2], antes.cursos[2]);
    const lido = normalizarProgramas(programaComResultados({ cursos: r.cursos, alteracoes: r.alteracoes }));
    const campos = c => c.missoes.map(m => [m.id, m.fase, m.codigo, m.nome, m.mis, m.eq, m.nb, m.ordem, m.regra]);
    assert.deepEqual(lido.slice(0, 2).map(campos), programas.slice(0, 2).map(campos));
    assert.deepEqual(lido.slice(0, 2).map(c => c.fases.map(f => f.id)), programas.slice(0, 2).map(c => c.fases.map(f => f.id)));
    // De novo, o mesmo programa: nada
    const deNovo = importar(programas, { ...antes, cursos: r.cursos });
    assert.deepEqual([deNovo.retorno, deNovo.alteracoes, deNovo.cursos], [0, [], r.cursos]);
  });

  it('uma recusa em qualquer curso não grava nada; o mesmo curso duas vezes: a segunda vê a primeira', () => {
    const programas = programaDoLegado(legado);
    const errado = { ...programas[1], missoes: [{ ...programas[1].missoes[0], codigo: 'pc 01' }] };
    assert.throws(() => importar([programas[0], errado]), { code: '22023', campo: 'codigo' });
    const duasVezes = importar([programas[0], programas[0]]);
    assert.deepEqual([duasVezes.retorno, duasVezes.alteracoes.length], [2, 1]);
  });

  it('o curso sem as listas, como o vazio guardado, é pulado (a assinatura é a mesma); com missões guardadas, é recusado', () => {
    assert.equal(importar([{ sigla: 'INVA', fases: 'x' }]).retorno, 0);
    const comPP = importar(programaDoLegado(legado)).cursos;
    assert.throws(() => importar([{ sigla: 'PP', fases: 'x' }], { ...antes, cursos: comPP }), { code: '22023', campo: 'limite' });
  });
});

describe('Os programas como o servidor devolve (programaComResultados)', () => {
  it('os cursos na ordem, as fases e as missões na ordem do banco (as retiradas no fim), as missões com resultados e as últimas 20 alterações', () => {
    const vazio = { cursos: cursosIniciais(), resultados: [], cadastro: null };
    const criado = gravarCurso(vazio, { sigla: 'ZZ9', versaoLida: 0, conteudo: PROGRAMA, descricao: 'Curso ZZ9 criado', agora: AGORA });
    const semM4 = { ...PROGRAMA, missoes: PROGRAMA.missoes.filter(m => m.id !== IDS.m4) };
    const { cursos } = gravarCurso({ ...vazio, cursos: criado.cursos }, { sigla: 'ZZ9', versaoLida: 1, conteudo: semM4, descricao: 'ZZ9: ZZ9-04 tirada do programa', agora: AGORA });
    const embaralhados = cursos.map(c => ({ ...c, fases: [...c.fases].reverse(), missoes: [...c.missoes].reverse() })).reverse();
    const alteracoes = [
      { curso: 'PP', versao: 2, descricao: 'PP', registrado_em: AGORA, registrado_por: 'Maria' },
      ...Array.from({ length: 25 }, (_, i) => ({ curso: 'ZZ9', versao: i + 1, descricao: `ZZ9: versão ${i + 1}`, registrado_em: AGORA, registrado_por: 'Maria' }))
    ];
    // Um resultado de outro curso com o mesmo código não conta
    const lido = programaComResultados({ cursos: embaralhados, resultados: [{ curso: 'ZZ9', missao: 'ZZ9-01' }, { curso: 'PP', missao: 'ZZ9-03' }], alteracoes });
    assert.deepEqual(lido.map(c => c.sigla), ['PP', 'PC', 'INVA', 'ZZ9']);
    const [pp, , , curso] = lido;
    assert.deepEqual(curso.fases.map(f => f.id), [IDS.f1, IDS.f2, IDS.f3]);
    assert.deepEqual(curso.missoes.map(m => [m.codigo, m.removida, m.comResultados]),
      [['ZZ9-01', false, true], ['ZZ9-02', false, false], ['ZZ9-03', false, false], ['ZZ9-05', false, false], ['ZZ9-04', true, false]]);
    assert.deepEqual(curso.alteracoes.map(a => a.versao), Array.from({ length: 20 }, (_, i) => 25 - i));
    assert.deepEqual(curso.alteracoes[0], { versao: 25, descricao: 'ZZ9: versão 25', registrado_em: AGORA, registrado_por: 'Maria' });
    assert.deepEqual([pp.alteracoes.length, pp.missoes], [1, []]);
    assert.deepEqual(normalizarProgramas(lido).at(-1).missoes.map(m => m.comResultados), [true, false, false, false, false]);
  });
});

// O Noturno em trechos: a ida, a noite e a volta do Noturno de dois dias, juntas na fase. O que o curso guarda e a tela
// manda de volta, o que o programa lido mantém, os Noturnos do curso e o nome do Noturno na próxima missão
describe('O Noturno em trechos (a ida, a noite e a volta)', () => {
  const { f2, m1, m4, m5, m6, m7 } = IDS;
  // O ZZ9 com o Noturno em trechos (na Fase 3: ZZ9-06, a ida; ZZ9-05, a noite; ZZ9-07, a volta), gravado e lido de volta
  // como a tela o tem
  function lido() {
    const estado = { cursos: cursosIniciais(), resultados: [], cadastro: { esquema: FORMATO_DOS_CURSOS, versao: 7 } };
    const { cursos } = gravarCurso(estado, { sigla: 'ZZ9', versaoLida: 0, conteudo: NOTURNO_EM_TRECHOS, descricao: 'Curso ZZ9 criado', agora: AGORA });
    return normalizarProgramas(programaComResultados({ cursos })).find(c => c.sigla === 'ZZ9');
  }
  const trechos = curso => curso.missoes.filter(m => m.trecho).map(m => [m.codigo, m.trecho]);
  const daMissao = (curso, id) => curso.missoes.find(m => m.id === id);
  const comMissao = (conteudo, id, campos) => ({ ...conteudo, missoes: conteudo.missoes.map(m => (m.id === id ? { ...m, ...campos } : m)) });

  it('o curso guarda o trecho só na missão que tem um, e a tela manda o mesmo de volta', () => {
    const zz9 = lido();
    assert.deepEqual(trechos(zz9), [['ZZ9-06', 'ida'], ['ZZ9-05', 'noite'], ['ZZ9-07', 'volta']]);
    assert.ok(zz9.missoes.filter(m => !m.trecho).every(m => !Object.hasOwn(m, 'trecho')));
    assert.deepEqual(conteudoDoCurso(zz9), NOTURNO_EM_TRECHOS);
    assert.equal(validarCurso(conteudoDoCurso(zz9)), null);
  });

  it('a missão que deixa de ser Noturno perde o trecho; o Noturno desmanchado é recusado na conferência', () => {
    const zz9 = lido();
    const idaNavegacao = mudarMissao(zz9, m6, 'mis', 'Navegação');
    assert.equal(Object.hasOwn(daMissao(idaNavegacao, m6), 'trecho'), false);
    assert.deepEqual(trechos(idaNavegacao), [['ZZ9-05', 'noite'], ['ZZ9-07', 'volta']]);
    assert.equal(validarCurso(conteudoDoCurso(idaNavegacao)), null, 'a noite e a volta continuam um Noturno');
    const semNoite = mudarMissao(zz9, m5, 'mis', 'Navegação');
    assert.deepEqual(trechos(semNoite), [['ZZ9-06', 'ida'], ['ZZ9-07', 'volta']]);
    assert.deepEqual(['code', 'campo'].map(c => validarCurso(conteudoDoCurso(semNoite))[c]), ['22023', 'trecho']);
    // O nome não mexe no trecho; a volta que sobe para antes da noite desmancha o Noturno
    assert.deepEqual(trechos(mudarMissao(zz9, m7, 'nome', 'Volta de BH')), trechos(zz9));
    assert.equal(validarCurso(conteudoDoCurso(moverMissao(zz9, m7, -1))).campo, 'trecho');
  });

  it('o programa lido: o trecho vale numa missão Noturno, no Noturno inteiro e junto na fase; fora do programa, ele fica', () => {
    const u = n => `00000000-0000-4000-8100-${String(n).padStart(12, '0')}`;
    const fase = (n, campos = {}) => ({ id: u(n), nome: `Fase ${n}`, modulo: null, ordem: n - 1, regra: 'ordem', requer: [], removida: false, ...campos });
    const missao = (n, faseN, trecho, campos = {}) => ({
      id: u(100 + n), fase: u(faseN), codigo: `PP-${n}`, nome: `Missão ${n}`, mis: 'Noturno', eq: 'C172', nb: 1, ordem: n, regra: 'ordem', requer: [],
      dispensada: false, avaliacao: false, removida: false, comResultados: false, ...(trecho ? { trecho } : {}), ...campos
    });
    const [pp] = normalizarProgramas([{
      sigla: 'PP', nome: 'Piloto Privado', ordem: 0, ativo: true, versao: 1, alteracoes: [], fases: [fase(1), fase(2), fase(3, { removida: true })],
      missoes: [
        // Na Fase 1: um Noturno inteiro; o trecho fora da lista; o trecho num voo local; a ida e a noite com outra missão no meio
        missao(1, 1, 'ida'), missao(2, 1, 'noite'), missao(3, 1, 'volta'), missao(4, 1, 'translado'), missao(5, 1, 'ida', { mis: 'Voo Local', eq: 'C152' }),
        missao(6, 1, 'ida'), missao(7, 1), missao(8, 1, 'noite'),
        // Na Fase 2: duas noites juntas (as três missões perdem o trecho); a ida no fim da fase
        missao(9, 2, 'ida'), missao(10, 2, 'noite'), missao(11, 2, 'noite'), missao(12, 2), missao(13, 2, 'ida'),
        // Fora do programa (a missão retirada e a da fase retirada): o trecho fica, para a volta ao programa (no tipo Noturno)
        missao(14, 2, 'volta', { removida: true }), missao(15, 3, 'ida'), missao(16, 2, 'ida', { removida: true, mis: 'Voo Local', eq: 'C152' })
      ]
    }]);
    assert.deepEqual(trechos(pp), [['PP-1', 'ida'], ['PP-2', 'noite'], ['PP-3', 'volta'], ['PP-8', 'noite'], ['PP-15', 'ida'], ['PP-14', 'volta']]);
  });

  it('os Noturnos do curso e o nome do Noturno na próxima missão: a noite, com os translados que voam junto', () => {
    const zz9 = lido();
    const doNoturno = noturnosDoCurso(zz9);
    assert.equal(noturnosDoCurso(zz9), doNoturno, 'calculado uma vez por curso');
    const noturno = doNoturno.get(m5);
    assert.deepEqual([noturno.ida.codigo, noturno.noite.codigo, noturno.volta.codigo], ['ZZ9-06', 'ZZ9-05', 'ZZ9-07']);
    assert.deepEqual([doNoturno.get(m6), doNoturno.get(m7), doNoturno.has(m1)], [noturno, noturno, false]);
    assert.deepEqual([m5, m6, m7, m1].map(id => rotuloDaMissao(zz9, daMissao(zz9, id))), ['ZZ9-05 (com ZZ9-06 e ZZ9-07)', 'ZZ9-06', 'ZZ9-07', 'ZZ9-01']);
    // Sem a volta; com a ida dispensada (ela não voa); a sequência que não forma um Noturno não conta
    const semVolta = retirarMissao(zz9, m7);
    assert.equal(rotuloDaMissao(semVolta, daMissao(semVolta, m5)), 'ZZ9-05 (com ZZ9-06)');
    const idaDispensada = { ...zz9, missoes: zz9.missoes.map(m => (m.id === m6 ? { ...m, dispensada: true } : m)) };
    assert.equal(rotuloDaMissao(idaDispensada, daMissao(idaDispensada, m5)), 'ZZ9-05 (com ZZ9-07)');
    const duasVoltas = { ...zz9, missoes: zz9.missoes.map(m => (m.id === m5 ? { ...m, trecho: 'volta' } : m)) };
    assert.deepEqual([noturnosDoCurso(duasVoltas).size, rotuloDaMissao(duasVoltas, daMissao(duasVoltas, m5))], [0, 'ZZ9-05']);
  });

  it('a recusa do trecho vem depois da "avaliação" e antes dos códigos e dos requisitos', () => {
    const recusa = conteudo => { const { code, campo } = validarCurso(conteudo); return `${code} ${campo}`; };
    const idaNavegacao = comMissao(NOTURNO_EM_TRECHOS, m6, { mis: 'Navegação' });
    assert.equal(recusa(comMissao(idaNavegacao, m4, { avaliacao: 1 })), '22023 avaliacao');
    assert.equal(recusa(comMissao(idaNavegacao, m1, { codigo: 'ZZ9-02' })), '22023 trecho', 'antes do código repetido');
    const emDuasFases = comMissao(NOTURNO_EM_TRECHOS, m6, { fase: f2 });
    assert.equal(recusa(comMissao(emDuasFases, m1, { codigo: 'ZZ9-02' })), '22023 trecho', 'a sequência também');
    assert.equal(recusa(comMissao(emDuasFases, m4, { requer: [m5] })), '22023 trecho', 'antes dos requisitos');
  });

  it('o programa de antes (o do cadastro) não tem trecho: a conversão não traz nenhum', () => {
    const legado = normalizarCursos({ PP: [{ id: 'TSL-01', mis: 'Noturno', trecho: 'ida' }, { id: 'NOT', mis: 'Noturno', nb: 3, trecho: 'noite' }] });
    const [pp] = programaDoLegado(legado, gerarId);
    assert.deepEqual(pp.missoes.map(m => [m.codigo, Object.hasOwn(m, 'trecho')]), [['TSL-01', false], ['NOT', false]]);
  });
});

describe('O programa lido, nos formatos certos (normalizarProgramas)', () => {
  const u = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const fase = (n, campos = {}) => ({ id: u(n), nome: `Fase ${n}`, modulo: null, ordem: n - 1, regra: 'ordem', requer: [], removida: false, ...campos });
  const missaoDe = (n, faseN, campos = {}) => ({
    id: u(100 + n), fase: u(faseN), codigo: `PP-${String(n).padStart(2, '0')}`, nome: `Missão ${n}`, mis: 'Voo Local', eq: 'C152', nb: 1,
    ordem: n - 1, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, exige: [], removida: false, comResultados: false, ...campos
  });
  const curso = (campos = {}) => ({
    sigla: 'PP', nome: 'Piloto Privado', ordem: 0, ativo: true, versao: 3, fases: [fase(1), fase(2)],
    missoes: [missaoDe(1, 1), missaoDe(2, 1), missaoDe(3, 2, { ordem: 0 })], alteracoes: [], ...campos
  });

  it('o programa do servidor fica como veio', () => {
    const programa = [curso({ alteracoes: [{ versao: 3, descricao: 'PP: PP-03 incluída na Fase 2', registrado_em: AGORA, registrado_por: 'Admin' }] })];
    assert.deepEqual(normalizarProgramas(structuredClone(programa)), programa);
  });

  it('os cursos: a sigla no formato, o primeiro de cada sigla, na ordem; sem nome, a sigla; sem lista, nenhum', () => {
    const lidos = normalizarProgramas([null, 'PP', curso({ sigla: 'pp' }), curso({ sigla: 'PC-IFR', ordem: 5, nome: '  ', ativo: undefined, versao: 0 }),
      curso({ ordem: 1 }), curso({ ordem: 0, nome: 'Outro PP' })]);
    assert.deepEqual(lidos.map(c => [c.sigla, c.nome, c.ordem, c.ativo, c.versao]), [['PP', 'Piloto Privado', 1, true, 3], ['PC-IFR', 'PC-IFR', 5, true, 1]]);
    assert.deepEqual([normalizarProgramas(null), normalizarProgramas({})], [[], []]);
  });

  it('as fases e as missões fora do formato saem: sem id (uuid), id repetido, código, tipo de missão ou fase do curso', () => {
    const [lido] = normalizarProgramas([curso({
      fases: [fase(1), fase(2, { id: 'F2' }), fase(3, { id: u(1) }), fase(4, { id: '00000000-0000-4000-8000-0000000000AA' }), null],
      missoes: [missaoDe(1, 1), missaoDe(2, 1, { codigo: 'pp 02' }), missaoDe(3, 1, { mis: 'Inexistente' }), missaoDe(4, 1, { mis: ['Voo Local'] }),
        missaoDe(5, 2), missaoDe(6, 9), missaoDe(7, 1, { id: u(1) }), missaoDe(8, 1, { id: u(101) }), null]
    })]);
    assert.deepEqual([lido.fases.map(f => f.id), lido.missoes.map(m => m.codigo)], [[u(1)], ['PP-01']]);
  });

  it('o recurso é um dos do tipo (senão o padrão), o Ground tem 1,5 h, as horas vão até 5; sem nome, a missão leva o código', () => {
    const [{ missoes }] = normalizarProgramas([curso({ missoes: [
      missaoDe(1, 1, { mis: 'Noturno', eq: 'C152' }), missaoDe(2, 1, { mis: 'Ground C152', eq: 'C152', nb: 3, nome: '' }),
      missaoDe(3, 1, { nb: 7, nome: '  Navegação   longa ' }), missaoDe(4, 1, { nb: 'x', nome: null })
    ] })]);
    assert.deepEqual(missoes.map(m => [m.eq, m.nb, m.nome]), [['C172', 1, 'Missão 1'], ['Sala Ground', 1.5, 'PP-02'], ['C152', 5, 'Navegação longa'], ['C152', 1, 'PP-04']]);
  });

  it('os nomes que o servidor aceita voltam inteiros: até 80 caracteres contados como o banco (um emoji é um só), sem emoji pela metade', () => {
    // 80 caracteres para o banco, 159 unidades de texto no JS
    const noLimite = `a${'🛩'.repeat(79)}`, longo = `b${'🛩'.repeat(85)} `;
    const [lido] = normalizarProgramas([curso({
      nome: '🛩'.repeat(80), fases: [fase(1, { nome: noLimite, modulo: noLimite }), fase(2, { nome: longo })],
      missoes: [missaoDe(1, 1, { nome: noLimite }), missaoDe(2, 2, { nome: longo, ordem: 0 })]
    })]);
    assert.deepEqual([lido.nome, lido.fases[0].nome, lido.fases[0].modulo, lido.missoes[0].nome], ['🛩'.repeat(80), noLimite, noLimite, noLimite]);
    // Mais longo (só gravado fora do app): os 80 primeiros caracteres, o que o banco aceita. Nenhum nome com meio emoji (o
    // JSON da gravação seguinte, que o banco recusaria)
    assert.deepEqual([lido.fases[1].nome, lido.missoes[1].nome], [`b${'🛩'.repeat(79)}`, `b${'🛩'.repeat(79)}`]);
    const meioEmoji = /[\ud800-\udbff](?![\udc00-\udfff])/;
    assert.ok([lido.nome, ...lido.fases.flatMap(f => [f.nome, f.modulo || '']), ...lido.missoes.map(m => m.nome)].every(nome => !meioEmoji.test(nome)));
  });

  it('um código repetido: vale a missão do programa que vem primeiro (a retirada perde)', () => {
    const [lido] = normalizarProgramas([curso({ missoes: [missaoDe(1, 1, { removida: true, codigo: 'PP-09' }), missaoDe(2, 1, { codigo: 'PP-09' }), missaoDe(3, 2, { codigo: 'PP-09' })] })]);
    assert.deepEqual(lido.missoes.map(m => m.id), [u(102)]);
  });

  it('os requisitos só apontam para trás; "depois de…" sem nenhum vira "depois das anteriores"; a retirada fica sem nenhum, com a regra', () => {
    const [lido] = normalizarProgramas([curso({
      fases: [fase(1), fase(2, { regra: 'depois', requer: [u(3), u(2), u(9), u(1), u(1), 5] }), fase(3, { regra: 'depois', requer: [u(3)] }),
        fase(4, { regra: 'depois', requer: [u(1)], removida: true })],
      missoes: [missaoDe(1, 1), missaoDe(2, 1, { regra: 'depois', requer: [u(103), u(101)] }), missaoDe(3, 2, { ordem: 0, requer: [u(101)] }),
        missaoDe(4, 2, { ordem: 1, regra: 'depois', requer: [u(102)] }), missaoDe(5, 1, { removida: true, regra: 'depois', requer: [u(101)] })]
    })]);
    // A retirada fica "depois de…" sem a lista, como o servidor a guarda: "Voltar ao programa" sabe que ela esperava
    assert.deepEqual(lido.fases.map(f => [f.regra, f.requer]), [['ordem', []], ['depois', [u(1)]], ['ordem', []], ['depois', []]]);
    assert.deepEqual(lido.missoes.map(m => [m.codigo, m.regra, m.requer]),
      [['PP-01', 'ordem', []], ['PP-02', 'depois', [u(101)]], ['PP-03', 'ordem', []], ['PP-04', 'depois', [u(102)]], ['PP-05', 'depois', []]]);
  });

  it('em ordem, as retiradas no fim; no programa, até 50 fases e 200 missões (as retiradas ficam todas)', () => {
    const fases = [...Array.from({ length: 52 }, (_, i) => fase(52 - i)), fase(53, { removida: true })];
    const missoes = [...Array.from({ length: 201 }, (_, i) => missaoDe(i + 1, 1, { codigo: `PP-${i + 1}` })), missaoDe(300, 51), missaoDe(301, 1, { removida: true, codigo: 'PP-X' })];
    const [lido] = normalizarProgramas([curso({ fases, missoes: missoes.reverse() })]);
    assert.deepEqual(lido.fases.map(f => f.id), [...Array.from({ length: 50 }, (_, i) => u(i + 1)), u(53)]);
    assert.deepEqual([lido.missoes.length, lido.missoes[0].codigo, lido.missoes.at(-2).codigo, lido.missoes.at(-1).codigo], [201, 'PP-1', 'PP-200', 'PP-X']);
  });

  it('as alterações: as 20 primeiras (as mais recentes), nos formatos certos', () => {
    const alteracoes = [{ versao: 'x', descricao: 'fora' },
      ...Array.from({ length: 22 }, (_, i) => ({ versao: 30 - i, descricao: `versão ${30 - i}`, registrado_em: AGORA, registrado_por: i ? 'Maria' : 7 }))];
    const [{ alteracoes: lidas }] = normalizarProgramas([curso({ alteracoes })]);
    assert.deepEqual([lidas.length, lidas[0], lidas.at(-1).versao], [20, { versao: 30, descricao: 'versão 30', registrado_em: AGORA, registrado_por: null }, 11]);
  });
});

// A aba Cursos muda o curso na tela na hora e grava o curso inteiro: cada operação devolve o curso como fica, e ele tem
// de ser o que o servidor grava e devolve depois (a tela não mostra uma coisa e grava outra)
describe('A edição do programa na aba Cursos', () => {
  const { f1, f2, f3, m1, m2, m3, m4, m5 } = IDS;
  const NO_FORMATO = { esquema: FORMATO_DOS_CURSOS, versao: 7 };
  // O ZZ9 dos casos como a tela o tem: gravado e lido de volta, como o servidor devolve (programa_dos_cursos)
  const lido = (estado, sigla = 'ZZ9') => normalizarProgramas(programaComResultados(estado)).find(c => c.sigla === sigla);
  function guardado() {
    const estado = { cursos: cursosIniciais(), resultados: [], cadastro: NO_FORMATO };
    const { cursos } = gravarCurso(estado, { sigla: 'ZZ9', versaoLida: 0, conteudo: PROGRAMA, descricao: 'Curso ZZ9 criado', agora: AGORA });
    return { ...estado, cursos };
  }
  // O curso como a tela o mandaria (conteudoDoCurso), gravado a partir da versão dele e lido de volta
  function regravado(estado, curso) {
    const { cursos } = gravarCurso(estado, { sigla: curso.sigla, versaoLida: curso.versao, conteudo: conteudoDoCurso(curso), descricao: `${curso.sigla}: alteração`, agora: AGORA });
    return { estado: { ...estado, cursos }, curso: lido({ ...estado, cursos }, curso.sigla) };
  }
  const semVersao = ({ versao, alteracoes, ...curso }) => pelosIds(curso);
  const codigos = (curso, fase) => percursoDoCurso(curso).porFase.get(fase).map(m => m.codigo);
  let n = 0;
  const gerarId = () => `00000000-0000-4000-8abc-${String(++n).padStart(12, '0')}`;

  it('o conteúdo da gravação: as fases e as missões do programa, na ordem, sem as tiradas nem os campos da tela', () => {
    const zz9 = lido(guardado());
    assert.deepEqual(conteudoDoCurso(zz9), PROGRAMA);
    assert.equal(validarCurso(conteudoDoCurso(zz9)), null);
    const semM5 = retirarMissao(zz9, m5);
    assert.deepEqual(conteudoDoCurso(semM5).missoes.map(m => m.id), [m1, m2, m3, m4]);
    assert.deepEqual(Object.keys(conteudoDoCurso(semM5).missoes[0]), Object.keys(PROGRAMA.missoes[0]));
  });

  it('cada operação dá o curso que o servidor grava e devolve (só a versão e as alterações mudam)', () => {
    let { estado, curso } = { estado: guardado(), curso: lido(guardado()) };
    const passos = [
      c => incluirMissao(c, f1, gerarId).curso,
      c => mudarMissao(c, m1, 'nome', '  Primeiro   voo local  '),
      c => mudarMissao(c, m2, 'mis', 'Voo Local'),
      c => moverMissao(c, m2, -1),
      c => mudarMissao(c, m3, 'codigo', 'zz9-30'),
      c => mudarMissao(c, m5, 'nb', 2.5),
      c => retirarMissao(c, m1),
      c => incluirMissao(c, null, gerarId).curso,
      c => moverMissao(c, m4, -1)
    ];
    for (const [i, passo] of passos.entries()) {
      const novo = passo(curso);
      assert.ok(novo, `passo ${i}`);
      assert.equal(validarCurso(conteudoDoCurso(novo)), null, `passo ${i}`);
      ({ estado, curso } = regravado(estado, novo));
      assert.deepEqual(semVersao(curso), semVersao(novo), `passo ${i}`);
      assert.equal(curso.versao, novo.versao + 1);
    }
    assert.deepEqual([codigos(curso, f1), codigos(curso, f2), codigos(curso, f3)], [['ZZ9-02', 'ZZ9-06'], ['ZZ9-04', 'ZZ9-30'], ['ZZ9-05', 'ZZ9-31']], 'a seguinte à ZZ9-05 já era a da Fase 1: o próximo número livre');
  });

  it('"+ Missão": no fim da fase, com o tipo, o recurso e as horas da anterior e o código seguinte ao dela (ou o próximo livre do curso)', () => {
    const zz9 = lido(guardado());
    const noFim = (faseId, curso = zz9) => incluirMissao(curso, faseId, gerarId);
    // Na Fase 3, a seguinte à ZZ9-05 está livre; na Fase 1, a ZZ9-03 é de outra missão: o próximo número livre do curso
    const naF3 = noFim(f3);
    assert.deepEqual([naF3.missao.codigo, naF3.missao.nome, naF3.missao.mis, naF3.missao.eq, naF3.missao.nb, naF3.missao.ordem, naF3.missao.fase], ['ZZ9-06', 'ZZ9-06', 'Noturno', 'C172', 3, 1, f3]);
    assert.deepEqual([naF3.missao.regra, naF3.missao.requer, naF3.missao.dispensada, naF3.missao.avaliacao, naF3.missao.comResultados], ['ordem', [], false, false, false]);
    const naF1 = noFim(f1);
    assert.deepEqual([naF1.missao.codigo, naF1.missao.mis, naF1.missao.eq, naF1.missao.nb], ['ZZ9-06', 'Ground C152', 'Sala Ground', 1.5]);
    assert.deepEqual(codigos(naF1.curso, f1), ['ZZ9-01', 'ZZ9-02', 'ZZ9-06']);
    // A missão tirada do programa guarda o código: ele não volta
    assert.equal(noFim(f3, retirarMissao(zz9, m5)).missao.codigo, 'ZZ9-06');
    const comAntiga = noFim(f1, incluirMissao(zz9, f3, gerarId).curso);
    assert.equal(noFim(f1, retirarMissao(comAntiga.curso, comAntiga.missao.id)).missao.codigo, 'ZZ9-08', 'a ZZ9-07 saiu do programa e guarda o código');
    // Sem fase dita, a última; uma fase que não está no programa, nada
    assert.equal(incluirMissao(zz9, null, gerarId).missao.fase, f3);
    assert.equal(incluirMissao(zz9, IDS.fora, gerarId), null);
    assert.deepEqual(zz9, lido(guardado()), 'o curso recebido não muda');
  });

  it('o código da missão nova segue o formato da anterior (TMA-05 → TMA-06, AVP-SOLO-05 → AVP-SOLO-06, PP-099 → PP-100)', () => {
    const fase = { id: gerarId(), nome: 'Fase 4', modulo: null, ordem: 0, regra: 'ordem', requer: [], removida: false };
    const comUltima = codigo => ({
      sigla: 'PP', nome: 'Piloto Privado', ordem: 0, ativo: true, versao: 1, fases: [fase], alteracoes: [],
      missoes: [{ id: gerarId(), fase: fase.id, codigo, nome: codigo, mis: 'Voo Local', eq: 'C152', nb: 1, ordem: 0, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, removida: false, comResultados: false }]
    });
    const seguinte = codigo => incluirMissao(comUltima(codigo), fase.id, gerarId).missao.codigo;
    assert.deepEqual(['TMA-05', 'AVP-SOLO-05', 'PP-099', 'CT-9', 'NAV-150NM', 'NOT', 'ABCDEFGHIJKLM-9'].map(seguinte),
      ['TMA-06', 'AVP-SOLO-06', 'PP-100', 'CT-10', 'PP-01', 'PP-01', 'PP-01']);
  });

  // Os reservados: os códigos que os resultados do curso ou a Demanda da data aberta levam, também sem missão (o código
  // que saiu de uma missão com um pedido ainda nele, por exemplo). A missão nova não fica com nenhum: os resultados e o
  // voo do pedido passariam a ser dela
  it('o código da missão nova pula os reservados: o seguinte ao da anterior e o próximo número livre do curso', () => {
    const fase = { id: gerarId(), nome: 'Fase 2', modulo: null, ordem: 0, regra: 'ordem', requer: [], removida: false };
    const missao = (codigo, ordem) => ({
      id: gerarId(), fase: fase.id, codigo, nome: codigo, mis: 'Voo Local', eq: 'C152', nb: 1, ordem, regra: 'ordem', requer: [], dispensada: false, avaliacao: false,
      removida: false, comResultados: false
    });
    const pp = { sigla: 'PP', nome: 'Piloto Privado', ordem: 0, ativo: true, versao: 1, fases: [fase], alteracoes: [], missoes: [missao('CT-01', 0), missao('CT-02', 1)] };
    const nova = reservados => incluirMissao(pp, fase.id, gerarId, reservados).missao.codigo;
    assert.equal(nova(), 'CT-03');
    assert.equal(nova(['CT-03']), 'PP-01', 'a CT-03, sem missão, leva resultados ou está num pedido: o próximo número livre do curso');
    assert.equal(nova(['CT-03', 'PP-01', 'PP-02']), 'PP-03');
    assert.equal(nova(['CT-03', 'PP-07']), 'PP-08');
    assert.equal(nova(['CT-01', 'PP-07']), 'CT-03', 'os reservados que não são a seguinte não mudam nada');
  });

  it('"+ Missão" no curso sem fases: a Fase 1 entra com a missão (um voo local de 1 h no C152, com o primeiro número do curso)', () => {
    const [pp] = normalizarProgramas(cursosIniciais());
    const { curso, missao } = incluirMissao(pp, null, gerarId);
    assert.deepEqual(curso.fases.map(({ nome, modulo, ordem, regra, requer, removida }) => ({ nome, modulo, ordem, regra, requer, removida })),
      [{ nome: 'Fase 1', modulo: null, ordem: 0, regra: 'ordem', requer: [], removida: false }]);
    assert.deepEqual([missao.fase, missao.codigo, missao.nome, missao.mis, missao.eq, missao.nb, missao.ordem], [curso.fases[0].id, 'PP-01', 'PP-01', 'Voo Local', 'C152', 1, 0]);
    const estado = { cursos: cursosIniciais(), resultados: [], cadastro: NO_FORMATO };
    assert.deepEqual(semVersao(regravado(estado, curso).curso), semVersao(curso));
  });

  it('um campo da missão: o código em maiúsculas (o nome igual ao código acompanha), o nome sem espaços a mais (vazio: o código), o tipo com o recurso e as horas', () => {
    const zz9 = lido(guardado());
    const missaoDe = (curso, id) => curso.missoes.find(m => m.id === id);
    const comNomeDeCodigo = mudarMissao(zz9, m5, 'nome', '');
    assert.equal(missaoDe(comNomeDeCodigo, m5).nome, 'ZZ9-05');
    assert.deepEqual(['codigo', 'nome'].map(c => missaoDe(mudarMissao(comNomeDeCodigo, m5, 'codigo', ' zz9-50 '), m5)[c]), ['ZZ9-50', 'ZZ9-50']);
    assert.deepEqual(['codigo', 'nome'].map(c => missaoDe(mudarMissao(zz9, m5, 'codigo', 'ZZ9-50'), m5)[c]), ['ZZ9-50', 'Noturno'], 'o nome próprio fica');
    assert.equal(missaoDe(mudarMissao(zz9, m1, 'nome', ` ${'x'.repeat(90)} `), m1).nome, 'x'.repeat(80));
    const tipo = (curso, id) => ['mis', 'eq', 'nb'].map(c => missaoDe(curso, id)[c]);
    assert.deepEqual(tipo(mudarMissao(zz9, m1, 'mis', 'Ground Navegação'), m1), ['Ground Navegação', 'Sala Ground', 1.5]);
    assert.deepEqual(tipo(mudarMissao(zz9, m2, 'mis', 'Voo Local'), m2), ['Voo Local', 'C152', 1.5], 'do Ground, as horas ficam');
    assert.deepEqual(tipo(mudarMissao(zz9, m1, 'mis', 'IFR'), m1), ['IFR', 'C172', 1], 'o C152 não serve: o recurso padrão do tipo');
    assert.deepEqual(tipo(mudarMissao(mudarMissao(zz9, m1, 'eq', 'C172'), m1, 'mis', 'IFR'), m1), ['IFR', 'C172', 1]);
    assert.deepEqual(tipo(mudarMissao(zz9, m1, 'nb', 2.5), m1), ['Voo Local', 'C152', 2.5]);
    // Nada muda: null (o código igual em minúsculas, o nome igual com espaços, o tipo desconhecido, a missão tirada)
    for (const [id, campo, valor] of [[m1, 'codigo', 'zz9-01'], [m1, 'nome', ' Primeiro  voo '], [m1, 'mis', 'Voo Local'], [m1, 'mis', 'Balão'], [m1, 'ordem', 3], [IDS.fora, 'nome', 'x']]) {
      assert.equal(mudarMissao(zz9, id, campo, valor), null, `${campo} ${valor}`);
    }
    assert.equal(mudarMissao(retirarMissao(zz9, m1), m1, 'nome', 'Outro'), null);
    assert.deepEqual(zz9, lido(guardado()), 'o curso recebido não muda');
  });

  it('↑ e ↓ trocam a missão com a vizinha da mesma fase; na ponta da fase, nada; a que esperaria por uma posterior é recusada pela conferência', () => {
    const zz9 = lido(guardado());
    assert.deepEqual(codigos(moverMissao(zz9, m2, -1), f1), ['ZZ9-02', 'ZZ9-01']);
    assert.deepEqual(codigos(moverMissao(zz9, m1, 1), f1), ['ZZ9-02', 'ZZ9-01']);
    assert.deepEqual(moverMissao(zz9, m1, 1).missoes.filter(m => m.fase === f1).map(m => [m.codigo, m.ordem]), [['ZZ9-02', 0], ['ZZ9-01', 1]]);
    for (const [id, passo] of [[m1, -1], [m2, 1], [m3, -1], [m5, 1], [m5, -1], [IDS.fora, 1]]) assert.equal(moverMissao(zz9, id, passo), null, `${id} ${passo}`);
    // A ZZ9-02 "depois de" a ZZ9-01: subir a ZZ9-02 a poria antes do que ela espera
    const depois = { ...zz9, missoes: zz9.missoes.map(m => (m.id === m2 ? { ...m, regra: 'depois', requer: [m1] } : m)) };
    const { code, campo } = validarCurso(conteudoDoCurso(moverMissao(depois, m2, -1)));
    assert.deepEqual([code, campo], ['22023', 'requer']);
  });

  it('tirar do programa: a missão fica no curso, fora do programa e sem requisitos; quem esperava por ela deixa de esperar', () => {
    const zz9 = lido(guardado());
    const semM1 = retirarMissao(zz9, m1);
    const tirada = semM1.missoes.find(m => m.id === m1);
    assert.deepEqual([tirada.removida, tirada.requer, tirada.codigo, tirada.ordem], [true, [], 'ZZ9-01', 0]);
    assert.deepEqual(semM1.missoes.filter(m => m.fase === f1 && !m.removida).map(m => [m.codigo, m.ordem]), [['ZZ9-02', 0]]);
    // A ZZ9-04 esperava só pela ZZ9-01: volta a "depois das anteriores"
    assert.deepEqual(['regra', 'requer'].map(c => semM1.missoes.find(m => m.id === m4)[c]), ['ordem', []]);
    const comDuas = { ...zz9, missoes: zz9.missoes.map(m => (m.id === m4 ? { ...m, requer: [m1, m2] } : m)) };
    assert.deepEqual(['regra', 'requer'].map(c => retirarMissao(comDuas, m1).missoes.find(m => m.id === m4)[c]), ['depois', [m2]]);
    assert.equal(retirarMissao(semM1, m1), null, 'já fora do programa');
    assert.deepEqual(indiceDoPrograma([semM1]).missaoPorCodigo('ZZ9', 'ZZ9-01').id, m1, 'o código continua com nome');
    assert.equal(retirarMissao(zz9, m3).missoes.filter(m => m.removida).length, 1);
  });
});

// As fases, as regras de quando abrir e de quando voar, as marcas e a volta ao programa: cada operação dá o curso que o
// servidor grava e devolve (a lista "depois de…" de quem sai do programa fica só na tela, para "Voltar ao programa"); a
// ordem que poria um item antes do que ele espera é recusada com o motivo
describe('A edição das fases e das regras na aba Cursos', () => {
  const { f1, f2, f3, m1, m2, m3, m4, m5 } = IDS;
  const NO_FORMATO = { esquema: FORMATO_DOS_CURSOS, versao: 7 };
  const lido = estado => normalizarProgramas(programaComResultados(estado)).find(c => c.sigla === 'ZZ9');
  function guardado() {
    const estado = { cursos: cursosIniciais(), resultados: [], cadastro: NO_FORMATO };
    const { cursos } = gravarCurso(estado, { sigla: 'ZZ9', versaoLida: 0, conteudo: PROGRAMA, descricao: 'Curso ZZ9 criado', agora: AGORA });
    return { ...estado, cursos };
  }
  // O ZZ9 dos casos (F1: ZZ9-01, ZZ9-02 livre; F2: ZZ9-03 dispensada, ZZ9-04 depois da ZZ9-01; F3 depois da F1: ZZ9-05)
  // como a tela o tem
  const zz9 = () => lido(guardado());
  function regravado(estado, curso) {
    const { cursos } = gravarCurso(estado, { sigla: 'ZZ9', versaoLida: curso.versao, conteudo: conteudoDoCurso(curso), descricao: 'ZZ9: alteração', agora: AGORA });
    return { estado: { ...estado, cursos }, curso: lido({ ...estado, cursos }) };
  }
  // O curso como o servidor o devolve: quem está fora do programa vem sem a lista "depois de…"
  const comoNoServidor = ({ versao, alteracoes, ...curso }) => pelosIds({
    ...curso, fases: curso.fases.map(f => (f.removida ? { ...f, requer: [] } : f)), missoes: curso.missoes.map(m => (m.removida ? { ...m, requer: [] } : m))
  });
  const fasesDe = curso => percursoDoCurso(curso).fases.map(f => f.id);
  const codigos = (curso, fase) => percursoDoCurso(curso).porFase.get(fase).map(m => m.codigo);
  const doCurso = (curso, id) => [...curso.fases, ...curso.missoes].find(x => x.id === id);
  const regra = (curso, id) => [doCurso(curso, id).regra, doCurso(curso, id).requer];
  let n = 0;
  const gerarId = () => `00000000-0000-4000-8def-${String(++n).padStart(12, '0')}`;

  it('o que cada fase e cada missão pode esperar: as do mesmo tipo antes dela, na ordem do curso (as missões, de qualquer fase anterior)', () => {
    const curso = zz9();
    const ids = id => requisitosPossiveis(curso, id).map(x => x.id);
    assert.deepEqual([ids(f1), ids(f2), ids(f3)], [[], [f1], [f1, f2]]);
    assert.deepEqual([ids(m1), ids(m2), ids(m4), ids(m5)], [[], [m1], [m1, m2, m3], [m1, m2, m3, m4]]);
    assert.deepEqual(ids(IDS.fora), []);
    assert.deepEqual(requisitosPossiveis(retirarMissao(curso, m3), m3), [], 'fora do programa, nenhuma');
  });

  it('a regra: "depois de…" sem lista fica com a de antes ou com o item logo antes; a lista vale só com anteriores, na ordem do curso', () => {
    const curso = zz9();
    assert.deepEqual(regra(definirRegra(curso, f2, 'depois'), f2), ['depois', [f1]]);
    assert.deepEqual(regra(definirRegra(curso, f3, 'depois', [f2, f1]), f3), ['depois', [f1, f2]]);
    assert.deepEqual(regra(definirRegra(curso, f3, 'livre'), f3), ['livre', []]);
    // A missão espera a logo antes dela no curso, também a de outra fase; a lista perde o que não vem antes
    assert.deepEqual(regra(definirRegra(curso, m5, 'depois'), m5), ['depois', [m4]]);
    assert.deepEqual(regra(definirRegra(curso, m4, 'depois', [m3, m5, IDS.fora, m1]), m4), ['depois', [m1, m3]]);
    assert.deepEqual(regra(definirRegra(curso, m4, 'ordem'), m4), ['ordem', []]);
    assert.deepEqual(regra(definirRegra(curso, m2, 'ordem'), m2), ['ordem', []]);
    // Nada muda, nada antes para esperar, a lista vazia, a regra desconhecida, a retirada: null
    for (const [id, r, lista] of [[m4, 'depois', [m1]], [m4, 'depois', null], [m2, 'livre', null], [m1, 'depois', null], [f1, 'depois', null],
      [m4, 'depois', []], [m4, 'depois', [m5]], [m4, 'sempre', null], [IDS.fora, 'livre', null]]) {
      assert.equal(definirRegra(curso, id, r, lista), null, `${id} ${r} ${lista}`);
    }
    assert.equal(definirRegra(retirarMissao(curso, m2), m2, 'ordem'), null);
    assert.deepEqual(curso, zz9(), 'o curso recebido não muda');
  });

  it('as marcas da missão: dispensada e avaliação, sim ou não', () => {
    const curso = zz9();
    const marcas = (c, id) => ['dispensada', 'avaliacao'].map(campo => doCurso(c, id)[campo]);
    assert.deepEqual(marcas(marcarMissao(curso, m1, 'dispensada', true), m1), [true, false]);
    assert.deepEqual(marcas(marcarMissao(curso, m3, 'dispensada', false), m3), [false, false]);
    assert.deepEqual(marcas(marcarMissao(curso, m4, 'avaliacao', false), m4), [false, false]);
    for (const [id, campo, valor] of [[m1, 'dispensada', false], [m1, 'dispensada', 'sim'], [m1, 'removida', true], [IDS.fora, 'avaliacao', true]]) {
      assert.equal(marcarMissao(curso, id, campo, valor), null, `${campo} ${valor}`);
    }
    assert.equal(marcarMissao(retirarMissao(curso, m1), m1, 'dispensada', true), null);
  });

  it('o nome e o módulo da fase: sem os espaços a mais; sem nome fica o de antes, sem módulo fica sem', () => {
    const curso = zz9();
    const fase = (c, id) => [doCurso(c, id).nome, doCurso(c, id).modulo];
    assert.deepEqual(fase(mudarFase(curso, f2, 'nome', '  Fase 2 –  Solo   local '), f2), ['Fase 2 – Solo local', 'Módulo 01 – Treinamento']);
    assert.deepEqual(fase(mudarFase(curso, f3, 'modulo', ' Módulo 02 – Noturno '), f3), ['Fase 3 – Noturno', 'Módulo 02 – Noturno']);
    assert.deepEqual(fase(mudarFase(curso, f1, 'modulo', '  '), f1), ['Fase 1 – Duplo comando', null]);
    for (const [id, campo, valor] of [[f2, 'nome', '   '], [f2, 'nome', 'Fase 2 – Solo'], [f3, 'modulo', ''], [f1, 'regra', 'livre'], [IDS.fora, 'nome', 'x']]) {
      assert.equal(mudarFase(curso, id, campo, valor), null, `${campo} ${valor}`);
    }
  });

  it('"+ Fase": no fim do programa, "Fase N", depois das anteriores, com o módulo da última', () => {
    const { curso, fase } = incluirFase(zz9(), gerarId);
    assert.deepEqual([fase.nome, fase.modulo, fase.ordem, fase.regra, fase.requer, fase.removida], ['Fase 4', null, 3, 'ordem', [], false]);
    assert.deepEqual(fasesDe(curso), [f1, f2, f3, fase.id]);
    const comModulo = incluirFase(mudarFase(zz9(), f3, 'modulo', 'Módulo 02'), gerarId).fase;
    assert.equal(comModulo.modulo, 'Módulo 02');
    // O PP impresso: a fase nova é a "Fase 10", no Módulo 03
    assert.deepEqual(['nome', 'modulo'].map(c => incluirFase(cursoPP(), gerarId).fase[c]), ['Fase 10', 'Módulo 03 – Avaliação']);
  });

  it('↑ e ↓ da fase levam as missões dela; na ponta, nada; a ordem que poria uma fase ou missão antes do que ela espera é recusada', () => {
    const curso = zz9();
    const desceF2 = moverFase(curso, f2, 1);
    assert.deepEqual(fasesDe(desceF2), [f1, f3, f2]);
    assert.deepEqual([codigos(desceF2, f2), codigos(desceF2, f3)], [['ZZ9-03', 'ZZ9-04'], ['ZZ9-05']]);
    assert.equal(ordemRecusada(desceF2, f2), null);
    assert.equal(validarCurso(conteudoDoCurso(desceF2)), null);
    for (const [id, passo] of [[f1, -1], [f3, 1], [IDS.fora, 1]]) assert.equal(moverFase(curso, id, passo), null);
    // A Fase 3 abre depois da Fase 1; a ZZ9-04 (Fase 2) voa depois da ZZ9-01 (Fase 1)
    assert.equal(ordemRecusada(moverFase(curso, f2, -1), f2), 'A missão ZZ9-04 voa depois da ZZ9-01: a Fase 2 não pode passar para antes da Fase 1.');
    assert.equal(ordemRecusada(moverFase(curso, f1, 1), f1), 'A missão ZZ9-04 voa depois da ZZ9-01: a Fase 1 não pode passar para depois da Fase 2.');
    const semM4 = definirRegra(curso, m4, 'ordem');
    assert.equal(ordemRecusada(moverFase(moverFase(semM4, f1, 1), f1, 1), f1), 'A Fase 3 abre depois da Fase 1: a Fase 1 não pode passar para depois dela.');
    assert.equal(ordemRecusada(moverFase(moverFase(semM4, f3, -1), f3, -1), f3), 'A Fase 3 abre depois da Fase 1: ela não pode passar para antes dela.');
    // O exemplo do desenho, no PP impresso: a Fase 6 sobe até a Fase 5, e não passa da Fase 4
    let pp = cursoPP();
    for (let i = 0; i < 3; i++) {
      pp = moverFase(pp, 'PP:F6', -1);
      assert.equal(ordemRecusada(pp, 'PP:F6'), null);
    }
    assert.equal(ordemRecusada(moverFase(pp, 'PP:F6', -1), 'PP:F6'), 'A Fase 6 abre depois da Fase 4: ela não pode passar para antes dela.');
    // A fase que não se chama "Fase N" (a do programa trazido do cadastro) é dita "a fase Programa"
    const comPrograma = mudarFase(curso, f1, 'nome', 'Programa');
    assert.equal(ordemRecusada(moverFase(comPrograma, f2, -1), f2), 'A missão ZZ9-04 voa depois da ZZ9-01: a Fase 2 não pode passar para antes da fase Programa.');
    assert.equal(ordemRecusada(moverFase(moverFase(definirRegra(comPrograma, m4, 'ordem'), f1, 1), f1, 1), f1),
      'A Fase 3 abre depois da fase Programa: a fase Programa não pode passar para depois dela.');
  });

  it('↑ e ↓ da missão e a missão em outra fase (no fim dela): a que ficaria antes do que espera é recusada', () => {
    const curso = definirRegra(zz9(), m2, 'depois', [m1]);
    assert.equal(ordemRecusada(moverMissao(curso, m2, -1), m2), 'A missão ZZ9-02 voa depois da ZZ9-01: ela não pode passar para antes dela.');
    assert.equal(ordemRecusada(moverMissao(curso, m1, 1), m1), 'A missão ZZ9-02 voa depois da ZZ9-01: a ZZ9-01 não pode passar para depois dela.');
    assert.equal(ordemRecusada(moverMissao(zz9(), m1, 1), m1), null, 'a ZZ9-02 livre não espera');
    const m3NaF1 = moverMissaoParaFase(curso, m3, f1);
    assert.deepEqual([codigos(m3NaF1, f1), codigos(m3NaF1, f2)], [['ZZ9-01', 'ZZ9-02', 'ZZ9-03'], ['ZZ9-04']]);
    assert.equal(doCurso(m3NaF1, m3).ordem, 2);
    assert.equal(ordemRecusada(m3NaF1, m3), null);
    assert.equal(ordemRecusada(moverMissaoParaFase(curso, m1, f2), m1), 'A missão ZZ9-02 voa depois da ZZ9-01: a ZZ9-01 não pode passar para depois dela.');
    assert.equal(ordemRecusada(moverMissaoParaFase(zz9(), m4, f3), m4), null);
    for (const [id, fase] of [[m3, f2], [m3, IDS.fora], [IDS.fora, f1]]) assert.equal(moverMissaoParaFase(curso, id, fase), null);
    assert.equal(moverMissaoParaFase(retirarMissao(curso, m3), m3, f1), null);
  });

  it('tirar uma fase: só sem missões; ela fica no curso com a regra e a lista (só na tela); quem esperava por ela deixa de esperar', () => {
    const curso = zz9();
    assert.equal(retirarFase(curso, f3), null, 'a Fase 3 tem a ZZ9-05');
    const semF3 = retirarFase(retirarMissao(curso, m5), f3);
    assert.deepEqual(fasesDe(semF3), [f1, f2]);
    const tirada = doCurso(semF3, f3);
    assert.deepEqual([tirada.removida, tirada.regra, tirada.requer, tirada.ordem], [true, 'depois', [f1], 2]);
    assert.equal(validarCurso(conteudoDoCurso(semF3)), null);
    // A Fase 3 esperava a Fase 1 e a Fase 2: tirada a 2 (vazia), espera só a 1; esperando só a 2, volta a "depois das anteriores"
    const vazia = retirarMissao(retirarMissao(definirRegra(curso, f3, 'depois', [f1, f2]), m3), m4);
    assert.deepEqual(regra(retirarFase(vazia, f2), f3), ['depois', [f1]]);
    assert.deepEqual(regra(retirarFase(definirRegra(vazia, f3, 'depois', [f2]), f2), f3), ['ordem', []]);
    assert.equal(retirarFase(semF3, f3), null, 'já fora do programa');
  });

  it('voltar ao programa: a fase e a missão voltam ao lugar de antes, com a regra; "depois de…" volta com a lista que ainda está antes', () => {
    const curso = zz9();
    // A ZZ9-04 (depois da ZZ9-01) tirada nesta tela: volta ao 2º lugar da Fase 2, ainda depois da ZZ9-01
    const volta = restaurarMissao(retirarMissao(curso, m4), m4);
    assert.equal(volta.regraPerdida, null);
    assert.deepEqual([codigos(volta.curso, f2), regra(volta.curso, m4), doCurso(volta.curso, m4).removida], [['ZZ9-03', 'ZZ9-04'], ['depois', [m1]], false]);
    assert.deepEqual(comoNoServidor(volta.curso), comoNoServidor(curso));
    // A Fase 3 (depois da Fase 1) tirada e de volta, no 3º lugar, sem missões; a ZZ9-05 volta depois, uma a uma
    const semF3 = retirarFase(retirarMissao(curso, m5), f3);
    const f3DeVolta = restaurarFase(semF3, f3);
    assert.deepEqual([f3DeVolta.regraPerdida, fasesDe(f3DeVolta.curso), regra(f3DeVolta.curso, f3), codigos(f3DeVolta.curso, f3)], [null, [f1, f2, f3], ['depois', [f1]], []]);
    assert.equal(restaurarMissao(semF3, m5), null, 'a missão de uma fase fora do programa espera a fase');
    assert.deepEqual(codigos(restaurarMissao(f3DeVolta.curso, m5).curso, f3), ['ZZ9-05']);
    // O lugar de antes, ou o fim quando a fase ficou menor
    const semM3M4 = retirarMissao(retirarMissao(curso, m3), m4);
    assert.deepEqual(codigos(restaurarMissao(semM3M4, m4).curso, f2), ['ZZ9-04']);
    // Os que ela esperava saíram do programa: volta "depois das anteriores", e diz por quê
    const semM1 = retirarMissao(retirarMissao(curso, m4), m1);
    assert.deepEqual([restaurarMissao(semM1, m4).regraPerdida, regra(restaurarMissao(semM1, m4).curso, m4)], ['requisitos-fora', ['ordem', []]]);
    const semF2 = retirarFase(retirarMissao(retirarMissao(retirarFase(retirarMissao(definirRegra(curso, f3, 'depois', [f2]), m5), f3), m3), m4), f2);
    assert.deepEqual([restaurarFase(semF2, f3).regraPerdida, regra(restaurarFase(semF2, f3).curso, f3)], ['requisitos-fora', ['ordem', []]]);
    for (const [fazer, id] of [[restaurarMissao, m1], [restaurarFase, f1], [restaurarMissao, IDS.fora], [restaurarFase, IDS.fora]]) assert.equal(fazer(curso, id), null);
    assert.deepEqual(curso, zz9(), 'o curso recebido não muda');
  });

  // Desenho, adendo §6: o servidor guarda a missão (ou a fase) retirada com a regra "depois" e sem a lista; lida de novo,
  // ela continua "depois de…" (normalizarProgramas não a troca por "depois das anteriores"), e a volta avisa que a lista
  // não ficou, em vez de perder a regra calada
  it('lida de novo do servidor, a retirada "depois de…" vem sem a lista: volta "depois das anteriores", com o aviso', () => {
    let { estado, curso } = { estado: guardado(), curso: zz9() };
    ({ estado, curso } = regravado(estado, retirarMissao(curso, m4)));
    assert.deepEqual([doCurso(curso, m4).removida, ...regra(curso, m4)], [true, 'depois', []]);
    const volta = restaurarMissao(curso, m4);
    assert.deepEqual([volta.regraPerdida, regra(volta.curso, m4)], ['sem-requisitos', ['ordem', []]]);
    ({ curso } = regravado(estado, retirarFase(retirarMissao(curso, m5), f3)));
    assert.deepEqual([doCurso(curso, f3).removida, ...regra(curso, f3)], [true, 'depois', []]);
    const faseDeVolta = restaurarFase(curso, f3);
    assert.deepEqual([faseDeVolta.regraPerdida, regra(faseDeVolta.curso, f3)], ['sem-requisitos', ['ordem', []]]);
  });

  it('cada operação dá o curso que o servidor grava e devolve (fora a lista de quem está fora do programa)', () => {
    let { estado, curso } = { estado: guardado(), curso: zz9() };
    let f4;
    const passos = [
      c => { const r = incluirFase(c, gerarId); f4 = r.fase.id; return r.curso; },
      c => mudarFase(c, f2, 'nome', 'Fase 2 – Solo local'),
      c => mudarFase(c, f3, 'modulo', 'Módulo 02 – Noturno'),
      c => definirRegra(c, m2, 'ordem'),
      c => moverFase(c, f3, -1),
      c => definirRegra(c, m5, 'depois', [m2, m1]),
      c => definirRegra(c, f2, 'livre'),
      c => definirRegra(c, f4, 'depois', [f3, f1]),
      c => marcarMissao(c, m3, 'dispensada', false),
      c => marcarMissao(c, m1, 'avaliacao', true),
      c => moverMissaoParaFase(c, m3, f1),
      c => retirarMissao(c, m4),
      c => restaurarMissao(c, m4).curso,
      c => incluirMissao(c, f4, gerarId).curso,
      c => retirarMissao(c, percursoDoCurso(c).porFase.get(f4)[0].id),
      c => retirarFase(c, f4),
      c => restaurarFase(c, f4).curso
    ];
    for (const [i, passo] of passos.entries()) {
      const novo = passo(curso);
      assert.ok(novo, `passo ${i}`);
      assert.equal(validarCurso(conteudoDoCurso(novo)), null, `passo ${i}`);
      assert.equal(ordemRecusada(novo, null), null, `passo ${i}`);
      ({ estado, curso } = regravado(estado, novo));
      assert.deepEqual(comoNoServidor(curso), comoNoServidor(novo), `passo ${i}`);
    }
    assert.deepEqual(fasesDe(curso), [f1, f3, f2, f4]);
    assert.deepEqual([regra(curso, f2), regra(curso, f4), regra(curso, m5), regra(curso, m4)], [['livre', []], ['ordem', []], ['depois', [m1, m2]], ['ordem', []]],
      'a ZZ9-04 e a Fase 4 voltaram do servidor sem a lista');
    assert.deepEqual([codigos(curso, f1), codigos(curso, f2), codigos(curso, f4)], [['ZZ9-01', 'ZZ9-02', 'ZZ9-03'], ['ZZ9-04'], []]);
  });
});

describe('Os cursos novos, o nome, encerrar e o cronograma do PP', () => {
  const MODELO = MODELOS['pp-acpm'];
  const NO_FORMATO = { esquema: FORMATO_DOS_CURSOS, versao: 7 };
  const contas = ({ mantidas, novas, retiradas }) => [mantidas, novas, retiradas];
  const daMissao = (curso, codigo) => curso.missoes.find(m => m.codigo === codigo);
  const codigosDoPrograma = curso => percursoDoCurso(curso).missoes.map(m => m.codigo);

  it('"+ Novo curso": a sigla em maiúsculas, no formato e uma vez só (também entre os encerrados), o nome; no fim da lista', () => {
    const programa = normalizarProgramas(cursosIniciais()).map(c => (c.sigla === 'PC' ? { ...c, ativo: false } : c));
    const { curso } = novoCurso(programa, { sigla: ' mlte ', nome: '  Multimotor   IFR ' });
    assert.deepEqual(curso, { sigla: 'MLTE', nome: 'Multimotor IFR', ordem: 3, ativo: true, versao: 0, fases: [], missoes: [], alteracoes: [] });
    const erro = dados => { const r = novoCurso(programa, dados); return [r.campo, r.erro, r.curso]; };
    assert.deepEqual(erro({ sigla: ' ', nome: 'X' }), ['sigla', 'Escreva a sigla do curso (por exemplo, PC-IFR).', undefined]);
    for (const sigla of ['P', 'PC-', '1PC', 'PILOTO-COMERCIAL', 'PÇ', 'P C']) {
      assert.deepEqual(erro({ sigla, nome: 'X' }).slice(0, 2), ['sigla', 'A sigla tem de 2 a 10 caracteres: letras sem acento, números e hífen, começando por letra e sem hífen no fim (por exemplo, PC-IFR).'], sigla);
    }
    assert.deepEqual(erro({ sigla: 'pp', nome: 'X' }).slice(0, 2), ['sigla', 'Já existe o curso PP (Piloto Privado).']);
    assert.deepEqual(erro({ sigla: 'PC', nome: 'X' }).slice(0, 2), ['sigla', 'Já existe o curso PC (Piloto Comercial), encerrado: para usá-lo de novo, reative-o.']);
    assert.deepEqual(erro({ sigla: 'MLTE', nome: '  ' }).slice(0, 2), ['nome', 'Escreva o nome do curso (até 80 caracteres).']);
    assert.equal(novoCurso(programa, { sigla: 'MLTE', nome: 'x'.repeat(90) }).curso.nome, 'x'.repeat(80));
    // A gravação cria o curso (versão 0) no mesmo lugar da lista: o fim (no servidor também)
    const estado = { cursos: cursosIniciais(), resultados: [], cadastro: NO_FORMATO };
    const gravado = gravarCurso(estado, { sigla: 'MLTE', versaoLida: 0, conteudo: conteudoDoCurso(curso), descricao: 'Curso MLTE criado: Multimotor IFR', agora: AGORA });
    assert.deepEqual(gravado.cursos.map(c => [c.sigla, c.ordem]).at(-1), ['MLTE', curso.ordem]);
    assert.deepEqual(gravado.retorno, { versao: 1, atualizado_em: AGORA });
    assert.equal(novoCurso([], { sigla: 'PP', nome: 'Piloto Privado' }).curso.ordem, 0);
  });

  it('"+ Novo curso" com o cronograma do PP: as 9 fases e as 47 missões, com ids novos', () => {
    const { curso } = novoCurso(normalizarProgramas(cursosIniciais()), { sigla: 'PP-B', nome: 'Piloto Privado B', modelo: MODELO });
    assert.deepEqual(codigosDoPrograma(curso), codigosDoPrograma(cursoPP()));
    assert.ok([...curso.fases, ...curso.missoes].every(x => UUID_V4.test(x.id)));
    assert.equal(validarCurso(conteudoDoCurso(curso)), null);
  });

  it('o nome do curso (sem os espaços a mais, até 80 caracteres) e encerrar ou reativar', () => {
    const [pp] = normalizarProgramas(cursosIniciais());
    assert.equal(mudarCurso(pp, 'nome', '  Piloto   Privado ACPM ').nome, 'Piloto Privado ACPM');
    assert.equal(mudarCurso(pp, 'nome', 'x'.repeat(90)).nome, 'x'.repeat(80));
    assert.deepEqual([mudarCurso(pp, 'ativo', false).ativo, mudarCurso({ ...pp, ativo: false }, 'ativo', true).ativo], [false, true]);
    for (const [campo, valor] of [['nome', '  '], ['nome', 'Piloto Privado'], ['ativo', true], ['ativo', 'não'], ['sigla', 'PX']]) {
      assert.equal(mudarCurso(pp, campo, valor), null, `${campo} ${valor}`);
    }
    // O servidor guarda o curso encerrado (e o reativado)
    const estado = { cursos: cursosIniciais(), resultados: [], cadastro: NO_FORMATO };
    const encerrado = gravarCurso(estado, { sigla: 'PP', versaoLida: 1, conteudo: conteudoDoCurso(mudarCurso(pp, 'ativo', false)), descricao: 'PP encerrado' });
    assert.deepEqual(encerrado.cursos.map(c => [c.sigla, c.ativo, c.versao]), [['PP', false, 2], ['PC', true, 1], ['INVA', true, 1]]);
  });

  it('o cronograma do PP no PP vazio: as 9 fases e as 47 missões entram', () => {
    const [pp] = normalizarProgramas(cursosIniciais());
    const r = aplicarModelo(pp, MODELO, gerarId);
    assert.deepEqual(contas(r), [0, 47, 0]);
    assert.deepEqual(r.curso, { ...cursoPP(), versao: 1 });
    assert.deepEqual(pp, normalizarProgramas(cursosIniciais())[0], 'o curso recebido não muda');
  });

  // O PP trazido do cadastro (uma fase só, "Programa"), gravado e lido como o servidor faz: a TMA-05 (com resultados) e a
  // CT-01 ficam, com o mesmo id; o NOT, tirado do programa antes, volta (o código é dele); a PP-01 (com resultados) e a
  // PP-02 saem, e a fase "Programa" também; as outras 44 do cronograma entram
  it('o cronograma do PP no PP trazido do cadastro: os códigos que já existem ficam (o mesmo id), os outros saem, os do cronograma entram', () => {
    const legado = normalizarCursos({ PP: [
      { id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local' }, { id: 'TMA-05', nome: 'Tráfego', mis: 'Navegação', nb: 2 }, { id: 'CT-01', mis: 'Voo Local' },
      { id: 'NOT', nome: 'Noturno', mis: 'Noturno', nb: 3 }, { id: 'PP-02', mis: 'Voo Local' }
    ] });
    let estado = { cursos: cursosIniciais(), resultados: [], cadastro: null };
    estado = { ...estado, cursos: importarProgramas(estado, { programas: programaDoLegado(legado), versaoDoCadastro: 0, agora: AGORA }).cursos };
    const lerPP = () => normalizarProgramas(programaComResultados(estado)).find(c => c.sigla === 'PP');
    const semNot = { ...lerPP(), missoes: lerPP().missoes.filter(m => m.codigo !== 'NOT') };
    estado = { ...estado, cursos: gravarCurso(estado, { sigla: 'PP', versaoLida: 2, conteudo: conteudoDoCurso(semNot), descricao: 'PP: NOT tirada do programa', agora: AGORA }).cursos };
    estado = { ...estado, resultados: [{ curso: 'PP', missao: 'TMA-05' }, { curso: 'PP', missao: 'PP-01' }], cadastro: NO_FORMATO };
    const pp = lerPP();
    assert.deepEqual([codigosDoPrograma(pp), daMissao(pp, 'NOT').removida, percursoDoCurso(pp).fases.map(f => f.nome)], [['PP-01', 'TMA-05', 'CT-01', 'PP-02'], true, ['Programa']]);

    const r = aplicarModelo(pp, MODELO);
    assert.deepEqual(contas(r), [3, 44, 2]);
    assert.deepEqual(codigosDoPrograma(r.curso), codigosDoPrograma(cursoPP()));
    const tma05 = daMissao(r.curso, 'TMA-05'), not = daMissao(r.curso, 'NOT');
    assert.deepEqual([tma05.id, tma05.nome, tma05.mis, tma05.nb, tma05.avaliacao, tma05.comResultados, tma05.removida], [daMissao(pp, 'TMA-05').id, 'TMA-05', 'Voo Local', 1, true, true, false]);
    assert.equal(tma05.fase, percursoDoCurso(r.curso).fases[3].id, 'na Fase 4');
    assert.deepEqual([not.id, not.trecho, not.removida, not.nome], [daMissao(pp, 'NOT').id, 'noite', false, 'NOT']);
    assert.deepEqual([daMissao(r.curso, 'PP-01').removida, daMissao(r.curso, 'PP-01').nome, daMissao(r.curso, 'PP-02').removida], [true, 'Familiarização', true]);
    assert.deepEqual(r.curso.fases.filter(f => f.removida).map(f => f.nome), ['Programa']);
    assert.equal(validarCurso(conteudoDoCurso(r.curso)), null);

    // O servidor aceita (o código da missão tirada do programa é dela; o código com resultados não muda) e devolve o mesmo
    const gravado = gravarCurso(estado, { sigla: 'PP', versaoLida: pp.versao, conteudo: conteudoDoCurso(r.curso), descricao: 'PP: cronograma P.I PPA 001A aplicado', agora: AGORA });
    estado = { ...estado, cursos: gravado.cursos };
    const lido = lerPP();
    assert.deepEqual(conteudoDoCurso(lido), conteudoDoCurso(r.curso));
    assert.deepEqual(lido.missoes.filter(m => m.removida).map(m => m.codigo), ['PP-01', 'PP-02']);
    assert.deepEqual([daMissao(lido, 'TMA-05').comResultados, daMissao(lido, 'PP-01').comResultados], [true, true]);
  });

  it('o trecho do Noturno: ida, noite ou volta numa missão Noturno; vazio tira; o Noturno desmanchado, a conferência recusa', () => {
    const { curso } = novoCurso([], { sigla: 'PP', nome: 'Piloto Privado', modelo: MODELO });
    const id = codigo => daMissao(curso, codigo).id;
    const trechos = c => percursoDoCurso(c).missoes.filter(m => m.trecho).map(m => [m.codigo, m.trecho]);
    const recusa = c => { const e = validarCurso(conteudoDoCurso(c)); return e && [e.code, e.campo]; };
    let c = ['TSL-01', 'NOT', 'TSL-02'].reduce((x, codigo) => definirTrecho(x, id(codigo), ''), curso);
    assert.deepEqual([trechos(c), recusa(c)], [[], null]);
    assert.equal(Object.hasOwn(daMissao(c, 'NOT'), 'trecho'), false, 'sem trecho, a missão fica sem o campo');
    // A ida sem a noite logo depois não forma um Noturno: a conferência recusa; com a noite primeiro, vale
    assert.deepEqual(recusa(definirTrecho(c, id('TSL-01'), 'ida')), ['22023', 'trecho']);
    c = definirTrecho(c, id('NOT'), 'noite');
    assert.equal(recusa(c), null, 'a noite sozinha é um Noturno');
    c = definirTrecho(definirTrecho(c, id('TSL-01'), 'ida'), id('TSL-02'), 'volta');
    assert.deepEqual([trechos(c), recusa(c)], [[['TSL-01', 'ida'], ['NOT', 'noite'], ['TSL-02', 'volta']], null]);
    assert.deepEqual(conteudoDoCurso(c), conteudoDoCurso(curso));
    // Duas noites, a volta antes da noite: a conferência recusa
    assert.deepEqual(recusa(definirTrecho(c, id('TSL-02'), 'noite')), ['22023', 'trecho']);
    assert.deepEqual(recusa(definirTrecho(c, id('TSL-01'), 'volta')), ['22023', 'trecho']);
    // Nada muda: o mesmo trecho, uma missão que não é Noturno, um trecho que não existe, a missão fora do programa
    const semVolta = retirarMissao(c, id('TSL-02'));
    for (const [x, codigo, trecho] of [[c, 'NOT', 'noite'], [c, 'IN-01', 'ida'], [c, 'NOT', 'translado'], [semVolta, 'TSL-02', '']]) {
      assert.equal(definirTrecho(x, id(codigo), trecho), null, `${codigo} ${trecho}`);
    }
    assert.deepEqual(recusa(semVolta), null, 'a ida e a noite continuam um Noturno');
  });
});

// F1d, "missão do curso": a missão do curso exige do INVA uma lista de ids do registro das habilitações (exige; vazia até
// o Pedro marcar em Cursos, regra a). O estado da escala deriva a lista de cada pedido pela missão do curso dele (etapa,
// no curso cursoDaEtapa ou no do aluno), nunca guardada; sem os programas lidos, nada é exigido
describe('O que a missão do curso exige do INVA', () => {
  const NO_FORMATO = { esquema: FORMATO_DOS_CURSOS, versao: 7 };
  function zz9(exigeDaM4 = ['endosso_solo']) {
    const estado = { cursos: cursosIniciais(), resultados: [], cadastro: NO_FORMATO };
    const conteudo = { ...PROGRAMA, missoes: PROGRAMA.missoes.map(m => (m.id === IDS.m4 ? { ...m, exige: exigeDaM4 } : m)) };
    const { cursos } = gravarCurso(estado, { sigla: 'ZZ9', versaoLida: 0, conteudo, descricao: 'Curso ZZ9 criado', agora: AGORA });
    return normalizarProgramas(programaComResultados({ cursos }));
  }

  it('a missão lida e as missões novas têm a lista (vazia sem nada marcado); a tela manda a lista na gravação', () => {
    const programa = zz9();
    const curso = programa.find(c => c.sigla === 'ZZ9');
    assert.deepEqual(curso.missoes.map(m => [m.codigo, m.exige]), [['ZZ9-01', []], ['ZZ9-02', []], ['ZZ9-03', []], ['ZZ9-04', ['endosso_solo']], ['ZZ9-05', []]]);
    assert.deepEqual(conteudoDoCurso(curso).missoes.find(m => m.id === IDS.m4).exige, ['endosso_solo']);
    assert.deepEqual(incluirMissao(curso, IDS.f1, () => '00000000-0000-4000-8abc-000000000999').missao.exige, []);
    // Fora do formato, a lista lida fica vazia; repetida, uma vez
    const [lido] = normalizarProgramas([{ ...curso, missoes: curso.missoes.map((m, i) => ({ ...m, exige: [['X'], 'Endosso', null, ['ifr', 'ifr'], undefined][i] })) }]);
    assert.deepEqual(lido.missoes.map(m => m.exige), [[], [], [], ['ifr'], []]);
  });

  it('exigirNaMissao: a lista inteira, só ids do registro (sem a habilitação própria de um recurso), na ordem dele, até 10', () => {
    const curso = zz9([]).find(c => c.sigla === 'ZZ9');
    const marcada = exigirNaMissao(curso, IDS.m4, ['endosso_solo', 'navegacao_150']);
    assert.deepEqual(marcada.missoes.find(m => m.id === IDS.m4).exige, ['navegacao_150', 'endosso_solo']);
    assert.notEqual(marcada, curso);
    assert.deepEqual(curso.missoes.find(m => m.id === IDS.m4).exige, [], 'o recebido não muda');
    assert.equal(exigirNaMissao(marcada, IDS.m4, ['navegacao_150', 'endosso_solo']), null, 'nada muda');
    assert.deepEqual(exigirNaMissao(marcada, IDS.m4, []).missoes.find(m => m.id === IDS.m4).exige, []);
    assert.equal(exigirNaMissao(curso, IDS.m4, ['aviao:PR-VOM']), null, 'a habilitação própria é do recurso');
    assert.equal(exigirNaMissao(curso, IDS.m4, ['nao_existe']), null);
    assert.equal(exigirNaMissao(curso, IDS.m4, 'endosso_solo'), null);
    assert.equal(exigirNaMissao(curso, '00000000-0000-4000-8abc-000000000000', ['endosso_solo']), null);
    assert.equal(exigirNaMissao(retirarMissao(curso, IDS.m4), IDS.m4, ['endosso_solo']), null, 'a missão tirada do programa não muda');
  });

  it('aplicar o modelo: as missões do modelo não exigem nada; a do mesmo código guarda o que exigia', () => {
    const pp = cursoPP();
    assert.ok(pp.missoes.every(m => Array.isArray(m.exige) && m.exige.length === 0));
    const comSolo = { ...pp, missoes: pp.missoes.map(m => (m.codigo === 'TMA-01' ? { ...m, exige: ['endosso_solo'] } : m)) };
    const { curso } = aplicarModelo(comSolo, MODELOS['pp-acpm'], gerarId);
    assert.deepEqual(curso.missoes.filter(m => m.exige.length).map(m => [m.codigo, m.exige]), [['TMA-01', ['endosso_solo']]]);
  });

  it('o pedido leva o que a missão do curso dele exige: pelo curso da missão, senão pelo do aluno; os extras também', () => {
    const programa = zz9();
    const aluno = { id: 1000, nm: 'Aluno 1000', curso: 'ZZ9', fly: true, mis: 'Voo Solo', etapa: 'ZZ9-04', extra: [{ mid: 1, fly: true, mis: 'Voo Local', etapa: 'ZZ9-01' }, { mid: 2, fly: true, mis: 'Voo Solo', etapa: 'ZZ9-04', cursoDaEtapa: 'ZZ9' }] };
    const outro = { id: 1001, nm: 'Aluno 1001', curso: 'PP', fly: true, mis: 'Voo Solo', etapa: 'ZZ9-04', cursoDaEtapa: 'ZZ9', extra: [] };
    const semCurso = { id: 1002, nm: 'Aluno 1002', fly: true, mis: 'Voo Solo', etapa: 'ZZ9-04', extra: [] };
    const estado = { stu: [aluno, outro, semCurso], ins: [] };
    const novo = comExigenciasDasMissoes(estado, programa);
    assert.deepEqual(novo.stu[0].exige, ['endosso_solo']);
    assert.deepEqual(novo.stu[0].extra.map(ex => ex.exige), [undefined, ['endosso_solo']]);
    assert.deepEqual(novo.stu[1].exige, ['endosso_solo'], 'pelo curso da missão, não pelo do aluno');
    assert.equal(novo.stu[2], semCurso, 'sem curso, nada');
    assert.equal(estado.stu[0].exige, undefined, 'o estado recebido não muda');
    assert.deepEqual(exigeDaMissaoDoPedido(programa, aluno, aluno), ['endosso_solo']);
    assert.deepEqual(exigeDaMissaoDoPedido(programa, { etapa: 'ZZ9-99' }, aluno), []);
    // Sem os programas lidos, ou sem nada marcado, o mesmo estado
    assert.equal(comExigenciasDasMissoes(estado, null), estado);
    assert.equal(comExigenciasDasMissoes(estado, []), estado);
    assert.equal(comExigenciasDasMissoes(estado, zz9([])), estado);
    // A missão tirada do programa depois do pedido continua exigindo
    const curso = programa.find(c => c.sigla === 'ZZ9');
    const semM4 = programa.map(c => (c === curso ? retirarMissao(curso, IDS.m4) : c));
    assert.deepEqual(comExigenciasDasMissoes(estado, semM4).stu[0].exige, ['endosso_solo']);
  });
});
