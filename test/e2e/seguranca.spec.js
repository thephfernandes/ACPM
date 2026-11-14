// Conteúdo gravado malicioso (revisão de 14/11): quem tem uma conta de operador consegue gravar qualquer coisa no
// cadastro, no dia, na escala salva e no histórico pela API. Nada disso pode virar HTML ou script em nenhuma tela: o
// app escapa tudo o que mostra (texto e atributos) e, ao abrir, só aceita os valores que ele mesmo produz.
import { test, expect, irPara, prepararContexto, vigiarErros, AMANHA } from './fixtures.js';
import { documentosAtuais, instalarSupabaseFalso, CONTAS } from './supabase-falso.js';
import { runAllocationEngine } from '../../js/engine.js';
import { aluno, cenario, instrutor, missaoExtra, GROUND_C152 } from '../helpers/montar.js';
import { rosterSintetico } from '../helpers/estado.js';

// Três formas de injetar: num texto, saindo de um atributo com aspas duplas (sem espaços, que alguns lugares tiram)
// e saindo de um atributo com aspas simples
const X = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const XA = 'x"><img/src/onerror=window.__xss=1>';
const XS = "x' onmouseover='window.__xss=1' data-x='";

const nada = async page => {
  expect(await page.evaluate(() => window.__xss), 'nenhum script injetado rodou').toBeUndefined();
  expect(await page.locator('[onerror],[onload],[onmouseover]').count(), 'nenhum atributo de evento injetado').toBe(0);
  expect(await page.evaluate(() => window.__csp || []), 'nada bloqueado pela política de segurança').toEqual([]);
};

// O cadastro, os dias (hoje, para a TV, e amanhã, a data que abre) e o histórico, no formato atual, com o dia de amanhã
// já com a escala gravada
function documentos(mudar) {
  const estado = {
    ...cenario({
      ins: [instrutor(1, 9, { nm: `Instrutor ${X}` }), instrutor(2, 9)],
      stu: [aluno(1000, { p1: 390, p2: -1, etapa: 'PP-01' }, { nm: `Aluno ${X}`, curso: 'PP', extra: [missaoExtra(1003, { p1: 870, p2: -1 })] }),
        aluno(1001, { p1: 500, p2: -1 }), aluno(1002, { ...GROUND_C152, p1: 610, p2: -1 }, { nm: `Aluna ${XS}` })]
    }),
    cursos: { PP: [{ id: 'PP-01', nome: `Familiarização ${X}`, mis: 'Voo Local', eq: 'C152', nb: 1 }], PC: [], INVA: [] },
    fStatus: { '1001_0_1': 'Cancelado' },
    fObs: { '1001_0_1': { motivo: 'Outro', texto: `Pista ${X}` } },
    aprovacao: { em: '2026-11-10T21:05:00.000Z', por: `Operador ${X}` }
  };
  const resultado = { ...runAllocationEngine(estado), data: AMANHA };
  const { documentos: { cadastro }, dias } = documentosAtuais(estado, AMANHA);
  const docs = {
    acpm4_cadastro: cadastro,
    [`acpm4_dia_${AMANHA}`]: { ...dias[AMANHA], resultado },
    'acpm4_dia_2026-11-10': { ...dias[AMANHA], resultado: { ...resultado, data: '2026-11-10' } },
    acpm4_historico: [{
      id: 1, data: AMANHA, registrado_em: '2026-11-10T14:00:00.000Z', autor: `Rayane ${X}`, tipo: 'mod',
      descricao: `Alterado ${X}`, reverter: null, reverte: null, importado: false
    }, {
      // Textos enormes gravados pela API: a tela mostra até 500 caracteres da descrição e 80 do autor
      id: 3, data: AMANHA, registrado_em: '2026-11-10T14:05:00.000Z', autor: 'Autor '.repeat(100), tipo: 'mod',
      descricao: 'Longo '.repeat(400), reverter: null, reverte: null, importado: false
    }]
  };
  return mudar ? mudar(docs) : docs;
}

// O que a política de segurança de conteúdo bloquear fica registrado
const vigiarPolitica = page => page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

async function abrirCom(page, docs, url = './') {
  await vigiarPolitica(page);
  await page.addInitScript(json => {
    if (localStorage.getItem('acpm4_cadastro')) return;
    for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
  }, JSON.stringify(docs));
  await page.goto(url);
}

// Todas as abas e visões, as gavetas e o popup do mapa
async function percorrer(page) {
  await expect(page.locator('#wins input[data-a="win"]').first()).toBeAttached();
  for (const aba of ['esc', 'dem', 'age', 'rec', 'ins', 'alu', 'rod', 'bi']) {
    await irPara(page, aba);
    await nada(page);
  }
  await irPara(page, 'esc');
  for (const vista of ['eq', 'ins', 'painel', 'lista']) {
    await page.locator(`#s-esc [data-tl="${vista}"]`).click();
    await nada(page);
  }
  await page.locator('#s-esc [data-tl="eq"]').click();
  await page.locator('#out .tl-bar').first().click();
  await expect(page.locator('#tl-pop')).toBeVisible();
  await nada(page);
  await page.keyboard.press('Escape');
  await page.locator('#btn-open-log').click();
  await expect(page.locator('#historico')).toBeVisible();
  await nada(page);
  await page.keyboard.press('Escape');
  await irPara(page, 'ins');
  await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
  await nada(page);
  await irPara(page, 'alu');
  await page.locator('#s-alu [data-vista-alu="cursos"]').click();
  await nada(page);
  await page.locator('#btn-manual').click();
  await nada(page);
}

test.describe('Conteúdo gravado malicioso', () => {
  test('textos maliciosos nos campos de texto aparecem como texto, em todas as telas', async ({ page }) => {
    await abrirCom(page, documentos());
    await percorrer(page);
    await irPara(page, 'alu');
    await expect(page.locator('#alu tr[data-id="1000"] [data-f="nm"]')).toHaveValue(`Aluno ${X}`);
    await irPara(page, 'esc');
    await expect(page.locator('#out tbody')).toContainText(`Aluno ${X}`);
    await expect(page.locator('#selo-aprovada')).toContainText(`Operador ${X}`);
    await page.locator('#btn-open-log').click();
    const longa = page.locator('#audit-log-list .audit-item').filter({ hasText: 'Longo Longo' });
    await expect(longa.locator('.audit-desc')).toHaveText('Longo '.repeat(400).slice(0, 500).trim());
    await expect(longa.locator('.audit-autor')).toHaveText('Autor '.repeat(100).slice(0, 80).trim());
  });

  // Valores que só o app deveria produzir (status, números, chaves, matrículas, etiquetas) gravados fora do formato:
  // o app descarta ou corrige ao abrir, e a escala gravada adulterada é refeita pelo motor
  const adulterados = docs => {
    const amanha = docs[`acpm4_dia_${AMANHA}`];
    amanha.fStatus = { '1000_0_1': XA, [XA]: 'Cancelado', '1001_0_1': 'Cancelado' };
    amanha.fObs = { '1000_0_1': { motivo: XA, novoInicio: XA }, '1001_0_1': { motivo: 'Outro', texto: X } };
    amanha.pedidos[1000] = { ...amanha.pedidos[1000], pr: XA, nb: XA, jan: XA, p1: XA, etapa: XA, mis: XA, eq: XA, extra: [{ mid: XA, fly: true, mis: 'Voo Local', eq: 'C152', p1: 610, p2: -1, nb: 1, pr: 3 }] };
    amanha.horas = { 'PR-VOB': XA };
    amanha.hangar = [XA, 'PR-VOB'];
    amanha.importadas = [XA];
    const [primeiro, ...resto] = amanha.resultado.out;
    amanha.resultado.out = [{
      ...primeiro, fKey: XA, classKey: XA, w: XA, stuId: XA, mid: XA, eqType: XA, h: XA, ss: XA, r: XA, stuKg: XA, insKg: XA,
      limKg: XA, kg: XA, comb: { reduzirGal: XA, abastecerGal: XA, minimoGal: XA, autonomiaMin: XA }, baseTag: XA, tag: XA,
      status: XA, etapa: XA, conflito: [X], groupSize: XA
    }, ...resto];
    // O status adulterado também nos voos que continuam (o quadro da TV lê o status de cada um)
    for (const o of resto) amanha.fStatus[o.fKey] = XA;
    amanha.resultado.al = [...amanha.resultado.al, { t: XA, s: X, m: X, fKey: XA }];
    amanha.resultado.tot = XA;
    amanha.resultado.revisao = { 'PR-VOB': { inicio: XA, voadas: XA, fim: XA, paraAs: XA } };
    docs['acpm4_dia_2026-11-10'] = structuredClone(amanha);
    docs.acpm4_cadastro.ins[1] = { ...docs.acpm4_cadastro.ins[1], kg: XA, hab: ['local', XA] };
    docs.acpm4_cadastro.stu[1] = { ...docs.acpm4_cadastro.stu[1], kg: XA, bl: [XA], curso: XA };
    docs.acpm4_historico.push({
      id: 2, data: AMANHA, registrado_em: '2026-11-10T14:10:00.000Z', autor: null, tipo: XA, descricao: 'Recurso retirado',
      reverter: { kind: 'readicionarRecurso', recurso: { reg: XA, tipo: 'C152' }, label: X }, reverte: null, importado: false
    });
    return docs;
  };

  test('valores fora do formato gravados no dia, na escala e no histórico não viram HTML nem quebram a tela', async ({ page }) => {
    await abrirCom(page, documentos(adulterados));
    await percorrer(page);
    // Reverter a entrada adulterada do histórico também não injeta nada
    await page.locator('#btn-open-log').click();
    const reverter = page.locator('#audit-log-list [data-act="rev-log"]');
    if (await reverter.count()) await reverter.first().click();
    await page.keyboard.press('Escape');
    await irPara(page, 'rec');
    await nada(page);
  });

  test('a TV da recepção (modo local) com o dia de hoje adulterado', async ({ page }) => {
    await abrirCom(page, documentos(adulterados), './painel.html');
    await expect(page.locator('.fids tbody tr:not(.fids-vazia)').first()).toBeVisible();
    await nada(page);
  });

  // O mesmo conteúdo vindo do servidor (modo compartilhado): no app do operador e na TV, cada um com a sua conta
  test('no modo compartilhado: o conteúdo adulterado vindo do servidor, no app e na TV', async ({ browser }) => {
    const docs = documentos(adulterados);
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    await instalarSupabaseFalso(contexto, {
      documentos: { cadastro: docs.acpm4_cadastro },
      dias: { [AMANHA]: docs[`acpm4_dia_${AMANHA}`], '2026-11-10': docs['acpm4_dia_2026-11-10'] },
      historico: docs.acpm4_historico
    });
    for (const [url, conta] of [['./?supabase=teste', CONTAS.operador], ['./painel.html?supabase=teste', CONTAS.painel]]) {
      const page = await contexto.newPage();
      const erros = vigiarErros(page);
      await vigiarPolitica(page);
      await page.goto(url);
      await page.locator('#login-email').fill(conta.email);
      await page.locator('#login-senha').fill(conta.senha);
      await page.locator('#btn-entrar').click();
      if (conta === CONTAS.operador) await percorrer(page);
      else await expect(page.locator('.fids tbody tr:not(.fids-vazia):not(.fids-nada)').first()).toBeVisible();
      await nada(page);
      expect(erros).toEqual([]);
      await page.close();
    }
    await contexto.close();
  });
});

// O link antigo da fase 2 levava a escala inteira no endereço (revisão de 14/11: saiu). Um link desses, mesmo com
// conteúdo malicioso, não é lido: o app avisa que ele não vale mais

// Cada campo do link recebe um HTML que, se fosse interpretado, registraria o nome do campo em window.__xss
const ataque = campo => `"><img src=x onerror="window.__xss=(window.__xss||[]).concat('${campo}')">`;
const codificar = obj => encodeURIComponent(Buffer.from(JSON.stringify(obj), 'utf8').toString('base64'));

function payloadMalicioso() {
  const ins = rosterSintetico().map(x => [x.id, x.nm, 1, x.lv, x.kg, x.aw.map(() => 1)]);
  ins[0][1] = ataque('nome-instrutor');
  return {
    d: '2026-11-11',
    w: [0, 1, 0, 0, 0, 0, 0, 0, 0],
    ins,
    st: { '1000_0_1': ataque('status') },
    fly: [[1000, ataque('nome-aluno'), 70, [], 1, 'Voo Local', 'C152', 1, 1, 1, 1, 3, []]]
  };
}

test.describe('Link antigo com os dados na URL', () => {
  test('o conteúdo do link não é lido: o app avisa que o link não vale mais', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    await page.goto(`./?role=gestor&share=${codificar(payloadMalicioso())}`);
    await expect(page.locator('#aviso-link-texto')).toContainText('não vale mais');
    for (const aba of ['rec', 'ins', 'alu', 'dem', 'bi', 'esc']) await page.locator(`#nav button[data-t="${aba}"]`).click();

    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await expect(page.locator('#alu .cd')).toHaveCount(0);
    await expect(page.locator('#inst .cd')).toHaveCount(0);
    expect(erros).toEqual([]);
    await contexto.close();
  });
});
