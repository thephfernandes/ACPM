// Conteúdo gravado malicioso: quem tem uma conta de operador consegue gravar qualquer coisa no
// cadastro, no dia, na escala salva e no histórico pela API. Nada disso pode virar HTML ou script em nenhuma tela: o
// app escapa tudo o que mostra (texto e atributos) e, ao abrir, só aceita os valores que ele mesmo produz.
import { test, comTodasAsFuncionalidades, expect, irPara, prepararContexto, vigiarErros, AMANHA, preencherLogin, URL_APP, ABAS, abrirHistorico, appPronto, botaoDaAba, caixaDisponivel, linhasDosAlunos, abrirAluno, campoDoAberto } from './fixtures.js';
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

// O programa dos cursos como este navegador o guarda (acpm4_cursos: os cursos e, à parte, as alterações de todos, na
// ordem em que foram registradas) e como o servidor falso o recebe (o formato de programa_dos_cursos: as alterações de
// cada curso, a mais recente primeiro)
const noNavegador = cursos => ({
  cursos: cursos.map(({ alteracoes, ...c }) => c),
  alteracoes: cursos.flatMap(c => [...(c.alteracoes || [])].reverse().map(a => ({ curso: c.sigla, ...a })))
});
const noServidor = ({ cursos, alteracoes }) => cursos.map(c => ({
  ...c, alteracoes: alteracoes.filter(a => a.curso === c.sigla).reverse().map(({ curso, ...a }) => a)
}));

// O cadastro, os dias (hoje, para a TV, e amanhã, a data que abre), o histórico e o programa dos cursos (nas tabelas dos
// cursos: o do cadastro, como a conversão deixa), no formato atual, com o dia de amanhã já com a escala gravada
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
  const { documentos: { cadastro }, dias, cursos } = documentosAtuais(estado, AMANHA);
  // O programa com textos maliciosos também no nome do curso, no nome e no módulo da fase e nas alterações registradas,
  // e uma segunda fase (com mais de uma, o nome curto da fase vai para o "+ Missão" dela e para os nomes dos campos)
  const fase2 = { id: '00000000-0000-4000-8000-0000000000f2', nome: `Fase 2 ${XA}`, modulo: null, ordem: 1, regra: 'ordem', requer: [], removida: false };
  const programa = cursos.map(c => (c.sigla !== 'PP' ? c : {
    ...c, nome: `Piloto Privado ${X}`,
    fases: [...c.fases.map(f => ({ ...f, nome: `Programa ${XA}`, modulo: `Módulo ${XS}` })), fase2],
    missoes: [...c.missoes, {
      id: '00000000-0000-4000-8000-0000000000b2', fase: fase2.id, codigo: 'PP-02', nome: `Navegação ${XS}`, mis: 'Navegação', eq: 'C152', nb: 2,
      ordem: 0, regra: 'ordem', requer: [], dispensada: false, avaliacao: false, removida: false
    }],
    alteracoes: c.alteracoes.map(a => ({ ...a, descricao: `PP: alterado ${X}`, registrado_por: `Admin ${X}` }))
  }));
  const docs = {
    acpm4_cadastro: cadastro,
    acpm4_cursos: noNavegador(programa),
    [`acpm4_dia_${AMANHA}`]: { ...dias[AMANHA], resultado },
    'acpm4_dia_2026-11-10': { ...dias[AMANHA], resultado: { ...resultado, data: '2026-11-10' } },
    acpm4_historico: [{
      id: 1, data: AMANHA, registrado_em: '2026-11-10T14:00:00.000Z', autor: `Operador 01 ${X}`, tipo: 'mod',
      descricao: `Alterado ${X}`, reverter: null, reverte: null, importado: false
    }, {
      // Textos enormes gravados pela API: a tela mostra até 500 caracteres da descrição e 80 do autor
      id: 3, data: AMANHA, registrado_em: '2026-11-10T14:05:00.000Z', autor: 'Autor '.repeat(100), tipo: 'mod',
      descricao: 'Longo '.repeat(400), reverter: null, reverte: null, importado: false
    }]
  };
  return mudar ? mudar(docs) : docs;
}

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
  await appPronto(page);
  for (const aba of ABAS) {
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
  await expect(page.locator('#dlg-voo')).toBeVisible();
  await nada(page);
  await page.keyboard.press('Escape');
  await abrirHistorico(page);
  await expect(page.locator('#historico')).toBeVisible();
  await nada(page);
  await page.keyboard.press('Escape');
  await irPara(page, 'ins');
  await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
  await nada(page);
  await irPara(page, 'cur');
  await nada(page);
  await page.locator('#btn-manual').click();
  await nada(page);
}

test.describe('Conteúdo gravado malicioso', () => {
  // Com as funcionalidades que podem ficar desligadas: o hangar, a próxima missão, o progresso e os resultados também
  comTodasAsFuncionalidades('textos maliciosos nos campos de texto aparecem como texto, em todas as telas', async ({ page }) => {
    await abrirCom(page, documentos());
    await percorrer(page);
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    await expect(campoDoAberto(page, 'nm')).toHaveValue(`Aluno ${X}`);
    await expect(page.locator('#det-alu-titulo')).toHaveText(`Aluno ${X}`);
    // Os nomes maliciosos do programa (das tabelas dos cursos) chegam à aba Cursos (a conferência dela não passa por estar
    // vazia): os das missões, o do curso e os das fases, também no "+ Missão" da fase e no nome do campo
    await irPara(page, 'cur');
    const pp = page.locator('#cursos .curso[data-curso="PP"]');
    await expect(pp.locator('tr:has([value="PP-01"]) [data-cf="nome"]')).toHaveValue(`Familiarização ${X}`);
    await expect(pp.locator('tr:has([value="PP-02"]) [data-cf="nome"]')).toHaveValue(`Navegação ${XS}`);
    await expect(pp.locator('h3 small')).toContainText(`Piloto Privado ${X}`);
    // A primeira fase tem módulo: o título dela fica sob o do módulo (h5); a segunda, sem módulo, é h4
    await expect(pp.locator('.fase-cab :is(h4, h5)')).toHaveText([`Programa ${XA}`, `Fase 2 ${XA}`]);
    await expect(pp.locator('h4.modulo')).toHaveText([`Módulo ${XS}`]);
    // E também no botão do curso, no alto, e no índice das fases (o módulo e as fases)
    await expect(page.locator('#cur-ver-PP')).toHaveText(`PP · Piloto Privado ${X}`);
    await expect(pp.locator('.indice-das-fases .indice-modulo-nome')).toHaveText([`Módulo ${XS}`]);
    await expect(pp.locator('.indice-das-fases a')).toHaveText([`Programa ${XA}`, `Fase 2 ${XA}`]);
    await expect(pp.locator('[data-cfa="nome"]').first()).toHaveValue(`Programa ${XA}`);
    await expect(pp.locator('[data-cfa="modulo"]').first()).toHaveValue(`Módulo ${XS}`);
    await expect(pp.locator('details.alteracoes li').first()).toContainText(`Admin ${X} · PP: alterado ${X}`);
    await expect(pp.locator('[data-act="missao-nova"]').nth(1)).toHaveText(`+ Missão na Fase 2 ${XA}`);
    await expect(pp.locator('tr:has([value="PP-02"]) [data-cf="codigo"]')).toHaveAttribute('aria-label', `Código da 1ª missão da Fase 2 ${XA}`);
    await irPara(page, 'esc');
    await expect(page.locator('#out tbody')).toContainText(`Aluno ${X}`);
    await expect(page.locator('#selo-aprovada')).toContainText(`Operador ${X}`);
    // O diálogo do agendamento: os nomes nas opções (os alunos e os instrutores) e nos textos dele aparecem como texto
    await page.locator('#btn-agendar').click();
    await expect(page.locator('#dlg-agendar')).toBeVisible();
    await expect(page.locator('#agd-aluno option[value="1000"]')).toContainText(`Aluno ${X}`);
    await expect(page.locator('#agd-aluno option[value="1002"]')).toContainText(`Aluna ${XS}`);
    await page.locator('#agd-aluno').selectOption('1002');
    await expect(page.locator('#agd-instrutor option[value="1"]')).toContainText(`Instrutor ${X}`);
    await page.locator('#agd-aluno').selectOption('1000');
    await expect(page.locator('#agd-aluno-info')).toContainText('já voa amanhã');
    await nada(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#dlg-agendar')).toBeHidden();
    await abrirHistorico(page);
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
    // O PR-VOB em manutenção: reverter a entrada do histórico o deixa disponível de novo
    amanha.av = { ...amanha.av, 'PR-VOB': false };
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
    // O programa adulterado: o que está fora do formato sai (o curso sem sigla, a fase e a missão sem id, a missão sem
    // código ou tipo) ou é corrigido (o recurso, as horas, a regra, os requisitos, a versão, as alterações)
    const [pp] = docs.acpm4_cursos.cursos;
    const [primeira] = pp.missoes;
    const id = n => `00000000-0000-4000-8000-0000000000${n}`;
    pp.versao = XA;
    pp.fases.push({ ...pp.fases[0], id: XA, nome: X });
    pp.missoes.push({ ...primeira, id: XA, codigo: 'PP-90' }, { ...primeira, id: id('a1'), codigo: XA }, { ...primeira, id: id('a2'), codigo: 'PP-91', mis: XA },
      { ...primeira, id: id('a3'), codigo: 'PP-92', nome: `Corrigida ${X}`, eq: XA, nb: XA, regra: XA, requer: [XA], ordem: 1 });
    docs.acpm4_cursos.cursos.push({ ...structuredClone(pp), sigla: XA });
    docs.acpm4_cursos.alteracoes.push({ curso: 'PP', versao: XA, descricao: X, registrado_em: XA, registrado_por: X });
    docs.acpm4_historico.push({
      id: 2, data: AMANHA, registrado_em: '2026-11-10T14:10:00.000Z', autor: null, tipo: XA, descricao: 'Recurso retirado',
      reverter: { kind: 'readicionarRecurso', recurso: { reg: XA, tipo: 'C152' }, label: X }, reverte: null, importado: false
    });
    // O nome do atributo é um objeto que não vira texto (sem toString): a validação da reversão não pode lançar, ou o
    // painel do Histórico não seria desenhado
    docs.acpm4_historico.push({
      id: 5, data: AMANHA, registrado_em: '2026-11-10T14:15:00.000Z', autor: null, tipo: 'mod', descricao: 'PR-CPL: Só VFR',
      reverter: { kind: 'setAtributo', reg: 'PR-CPL', atributo: { toString: null }, val: true, label: '↶ Reverter' }, reverte: null, importado: false
    });
    // Uma reversão no formato certo, com HTML no rótulo do botão (até 40 caracteres, o rótulo vale)
    docs.acpm4_historico.push({
      id: 4, data: AMANHA, registrado_em: '2026-11-10T14:20:00.000Z', autor: null, tipo: 'exc', descricao: 'PR-VOB: Manutenção',
      reverter: { kind: 'setAv', reg: 'PR-VOB', val: true, label: '<img src=x onerror=window.__xss=1>' }, reverte: null, importado: false
    });
    return docs;
  };

  comTodasAsFuncionalidades('valores fora do formato gravados no dia, na escala, no histórico e no programa não viram HTML nem quebram a tela', async ({ page }) => {
    await abrirCom(page, documentos(adulterados));
    await percorrer(page);
    // Do programa adulterado, a aba Cursos mostra o que está no formato: os cursos de sigla certa (um botão para cada, no
    // alto, e um curso de cada vez na tela), com as fases e as missões de id, código e tipo certos (a corrigida com o
    // recurso e as horas padrão)
    await expect(page.locator('#cursos .seg-dos-cursos button')).toHaveText([`PP · Piloto Privado ${X}`, 'PC · Piloto Comercial', 'INVA · Instrutor de Voo']);
    await expect(page.locator('#cursos .curso')).toHaveCount(1);
    const pp = page.locator('#cursos .curso[data-curso="PP"]');
    await expect(pp.locator('.fase')).toHaveCount(2);
    await expect(pp.locator('[data-cf="codigo"]')).toHaveCount(3);
    const corrigida = pp.locator('tr:has([data-cf="codigo"][value="PP-92"])');
    await expect(corrigida.locator('[data-cf="nome"]')).toHaveValue(`Corrigida ${X}`);
    await expect(corrigida.locator('[data-cf="eq"]')).toHaveValue('C152');
    await expect(corrigida.locator('[data-cf="nb"]')).toHaveValue('1');
    // A reversão adulterada (um recurso com matrícula impossível, um atributo que não é texto) não vira botão; a que está
    // no formato certo mostra o rótulo como texto, e revertê-la não injeta nada
    await abrirHistorico(page);
    const entrada = descricao => page.locator('#audit-log-list .audit-item', { hasText: descricao });
    await expect(entrada('Recurso retirado').locator('[data-act="rev-log"]')).toHaveCount(0);
    await expect(entrada('PR-CPL: Só VFR')).toBeVisible();
    await expect(entrada('PR-CPL: Só VFR').locator('[data-act="rev-log"]')).toHaveCount(0);
    const reverter = entrada('PR-VOB: Manutenção').locator('[data-act="rev-log"]');
    await expect(reverter).toHaveText('<img src=x onerror=window.__xss=1>');
    await reverter.click();
    await expect(page.locator('#audit-log-list')).toContainText('Revertido: PR-VOB disponível');
    await page.keyboard.press('Escape');
    await irPara(page, 'rec');
    await expect(caixaDisponivel(page, 'PR-VOB')).toBeChecked();
    await nada(page);
  });

  test('a TV da recepção (modo local) com o dia de hoje adulterado', async ({ page }) => {
    // 06:00: os voos de hoje ainda estão no quadro Missões
    await page.clock.setFixedTime(new Date('2026-11-10T06:00:00-03:00'));
    await abrirCom(page, documentos(adulterados), './painel.html');
    await expect(page.locator('.fids tbody tr:not(.fids-vazia):not(.fids-nada)').first()).toBeVisible();
    await nada(page);
  });

  comTodasAsFuncionalidades('no modo compartilhado: o conteúdo adulterado vindo do servidor, no app e na TV', async ({ browser }) => {
    const docs = documentos(adulterados);
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    await instalarSupabaseFalso(contexto, {
      documentos: { cadastro: docs.acpm4_cadastro },
      dias: { [AMANHA]: docs[`acpm4_dia_${AMANHA}`], '2026-11-10': docs['acpm4_dia_2026-11-10'] },
      historico: docs.acpm4_historico,
      cursos: noServidor(docs.acpm4_cursos)
    });
    for (const [url, conta] of [[URL_APP, CONTAS.operador], ['./painel.html?supabase=teste', CONTAS.painel]]) {
      // A TV às 06:00: os voos de hoje ainda estão no quadro Missões (ao meio-dia, eles já terminaram há mais de 30 minutos)
      if (conta === CONTAS.painel) await contexto.clock.setFixedTime(new Date('2026-11-10T06:00:00-03:00'));
      const page = await contexto.newPage();
      const erros = vigiarErros(page);
      await vigiarPolitica(page);
      await page.goto(url);
      await preencherLogin(page, conta);
      if (conta === CONTAS.operador) {
        await percorrer(page);
        // O programa malicioso vem das tabelas dos cursos (programa_dos_cursos) e chega à aba Cursos, só para consulta (em
        // texto)
        await irPara(page, 'cur');
        const daMissao = codigo => page.locator('#cursos .curso[data-curso="PP"] tbody tr', { has: page.locator('td.c-codigo', { hasText: codigo }) });
        await expect(daMissao('PP-01').locator('td.c-nome')).toHaveText(`Familiarização ${X}`);
        await expect(daMissao('PP-92').locator('td.c-nome')).toHaveText(`Corrigida ${X}`);
      } else await expect(page.locator('.fids tbody tr:not(.fids-vazia):not(.fids-nada)').first()).toBeVisible();
      await nada(page);
      expect(erros).toEqual([]);
      await page.close();
    }
    await contexto.close();
  });
});

// O link antigo leva a escala inteira no endereço. Um link desses, mesmo com
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
    for (const aba of ['rec', 'ins', 'alu', 'dem', 'bi', 'esc']) await botaoDaAba(page, aba).click();

    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await expect(linhasDosAlunos(page)).toHaveCount(0);
    await expect(page.locator('#inst .cd')).toHaveCount(0);
    expect(erros).toEqual([]);
    await contexto.close();
  });
});
