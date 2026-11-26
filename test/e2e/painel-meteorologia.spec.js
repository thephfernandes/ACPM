// A meteorologia no pé do painel (a vista Painel da Escala, em tela cheia também, e a TV da recepção): o METAR e o TAF
// oficiais de Pampulha (SBBH) e de Confins (SBCF), pela função meteorologia do servidor (no servidor falso dos testes, a
// rota /functions/v1/meteorologia), em duas caixas lado a lado, sempre as duas, sem alternar, cada uma com o nome em letras
// grandes e as mensagens ("Atualizado às" a hora da observação do METAR só quando a busca falhou ou ela passou de 90
// minutos). A cada 10 minutos, as mensagens novas; a busca que falha guarda as últimas.
// Sem a função publicada e neste navegador (sem servidor): "Meteorologia indisponível", e o resto do painel igual.
import { test, expect, abrir, abrirEscala, entrar, prepararContexto, vigiarErros, preencherLogin, URL_APP } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS, METEOROLOGIA_DE_TESTE } from './supabase-falso.js';
import { runAllocationEngine } from '../../js/engine.js';
import { estadoSintetico } from '../helpers/estado.js';
import { comExemplo } from '../helpers/exemplo.js';

const HOJE = '2026-11-10';
const NOME_DA_FAIXA = 'Meteorologia: METAR e TAF de Pampulha e Confins';
const faixa = page => page.getByRole('region', { name: NOME_DA_FAIXA });
const caixa = (page, icao) => faixa(page).locator(`.meteo-estacao[data-icao="${icao}"]`);
const linhas = page => page.locator('.fids tbody tr:not(.fids-vazia):not(.fids-nada)');

// O dia de exemplo (com os voos duas vezes, em outra chave: o quadro tem mais de uma página na tela toda), gravado como
// o operador deixa, e o mesmo cadastro (com a configuração do painel, quando há); mudar: mexe nos voos antes de gravar
function diaCheio({ painel = null, mudar = null } = {}) {
  const e = comExemplo(estadoSintetico());
  if (painel) e.painel = painel;
  const escala = runAllocationEngine(e);
  escala.out = [...escala.out, ...escala.out.map(o => ({ ...o, fKey: o.fKey.replace(/^\d+/, n => String(Number(n) + 5000)) }))];
  if (mudar) mudar(escala.out);
  const docs = documentosAtuais(e, HOJE);
  docs.dias[HOJE] = { ...docs.dias[HOJE], resultado: escala };
  return docs;
}

// Uma TV (ou um navegador) com o servidor falso; statusEsperados: as respostas de erro que o teste provoca
async function novoContexto(browser, opcoes = {}, { statusEsperados = [], viewport, dia = diaCheio() } = {}) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', ...(viewport ? { viewport } : {}) });
  await prepararContexto(context);
  const servidor = await instalarSupabaseFalso(context, { ...dia, ...opcoes });
  const page = await context.newPage();
  return { context, servidor, page, erros: vigiarErros(page, { statusEsperados }) };
}
const abrirPainelDaEscala = async page => {
  await abrirEscala(page);
  await page.locator('#s-esc [data-tl="painel"]').click();
  await expect(page.locator('#out .fids')).toBeVisible();
};
// As duas caixas lado a lado: na mesma altura, a de Pampulha à esquerda, sem se sobrepor, as duas inteiras na tela
async function ladoALado(page) {
  const [a, b] = await Promise.all([caixa(page, 'SBBH').boundingBox(), caixa(page, 'SBCF').boundingBox()]);
  const largura = page.viewportSize().width;
  expect(Math.abs(a.y - b.y), 'na mesma altura').toBeLessThan(1);
  expect(a.x + a.width, 'Pampulha à esquerda de Confins').toBeLessThanOrEqual(b.x);
  expect(a.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(largura);
}

test.describe('Meteorologia no painel', () => {
  test('na Escala: as duas estações lado a lado, com o nome, o METAR e o TAF em linhas, sem a hora da atualização', async ({ browser }) => {
    const { context, servidor, page, erros } = await novoContexto(browser);
    await entrar(page, CONTAS.operador);
    await abrirPainelDaEscala(page);
    await expect(faixa(page)).toBeVisible();
    // O nome, em letras grandes (o código só para o leitor de tela), e as mensagens; sem título da faixa nem hora
    for (const [icao, nome] of [['SBBH', 'Pampulha'], ['SBCF', 'Confins']]) {
      await expect(caixa(page, icao).locator('.meteo-nome')).toHaveText(`${icao} · ${nome}`);
      const codigo = await caixa(page, icao).locator('.meteo-nome .sr').boundingBox();
      expect(codigo.width, 'o código fora da vista').toBeLessThanOrEqual(1);
    }
    await expect(faixa(page).getByText(/Atualizado às|METAR e TAF/)).toHaveCount(0);
    // Os tamanhos e o espaço de uma linha entre o nome, o METAR e o TAF (o pedido do Pedro, 2026-11-25)
    const medidas = await caixa(page, 'SBCF').evaluate(el => {
      const px = (seletor, propriedade) => parseFloat(getComputedStyle(el.querySelector(seletor))[propriedade]);
      const base = parseFloat(getComputedStyle(el).fontSize), letra = px('.meteo-metar', 'fontSize');
      const [cab, metar, taf] = [...el.children].map(x => x.getBoundingClientRect());
      return { nome: px('.meteo-nome', 'fontSize') / base, letra: letra / base, peso: px('.meteo-nome', 'fontWeight'), vaos: [metar.top - cab.bottom, taf.top - metar.bottom].map(v => v / letra) };
    });
    expect(medidas.nome).toBeCloseTo(2.1, 2);
    expect(medidas.letra).toBeCloseTo(1.2, 2);
    // 4 px em volta das caixas
    expect(await faixa(page).evaluate(el => getComputedStyle(el).padding)).toBe('4px');
    expect(medidas.peso).toBe(700);
    for (const vao of medidas.vaos) expect(vao).toBeCloseTo(1, 1);
    await expect(caixa(page, 'SBBH').locator('.meteo-metar')).toHaveText(METEOROLOGIA_DE_TESTE.estacoes[0].metar);
    await expect(caixa(page, 'SBBH').locator('.meteo-sem')).toHaveText('Sem TAF em vigor');
    await expect(caixa(page, 'SBCF').locator('.meteo-metar')).toHaveText(METEOROLOGIA_DE_TESTE.estacoes[1].metar);
    expect(await caixa(page, 'SBCF').locator('.meteo-taf').innerText()).toBe([
      'TAF SBCF 100800Z 1012/1112 34005KT 7000 SCT016 TX28/1018Z TN19/1109Z',
      'BECMG 1015/1017 9999 SCT035', 'TEMPO 1018/1021 TS SCT035 FEW040CB', 'PROB30 1107/1111 2000 BR SCT002 RMK PGM'
    ].join('\n'));
    await expect(faixa(page).getByText(/antigo|Sem atualização/)).toHaveCount(0);
    // Letra de máquina de escrever
    expect(await caixa(page, 'SBCF').locator('.meteo-taf').evaluate(el => getComputedStyle(el).fontFamily)).toMatch(/monospace/);
    await ladoALado(page);
    // As caixas são grupos com o nome da estação; a faixa não é uma região viva (a atualização não é anunciada)
    await expect(faixa(page).getByRole('group', { name: 'SBBH · Pampulha' })).toBeVisible();
    await expect(faixa(page).getByRole('group', { name: 'SBCF · Confins' })).toBeVisible();
    expect(await faixa(page).evaluate(el => Boolean(el.closest('[aria-live]') || el.querySelector('[aria-live], [role="alert"], [role="status"]')))).toBe(false);
    // Uma chamada, com a sessão do operador
    expect(servidor.chamadasDaMeteorologia).toEqual([{ metodo: 'GET', conta: 'operador' }]);
    expect(erros).toEqual([]);
    await context.close();
  });

  test('as duas caixas ficam sempre à vista: o quadro troca de página, e a faixa não muda nem alterna', async ({ browser }) => {
    const { context, page, erros } = await novoContexto(browser, {}, { viewport: { width: 1280, height: 720 } });
    await page.clock.install({ time: new Date('2026-11-10T06:00:00-03:00') });
    await page.goto('./painel.html?supabase=teste');
    await preencherLogin(page, CONTAS.painel);
    await expect(caixa(page, 'SBCF')).toBeVisible();
    await expect(page.locator('.fids-relogio small').first()).toHaveText(/^página 1\/[2-9]$/);
    const paginas = Number(/\/(\d)/.exec(await page.locator('.fids-relogio small').first().textContent())[1]);
    // A faixa, marcada: a troca de página não a refaz
    await faixa(page).evaluate(el => { el.dataset.sonda = 'a mesma'; window.mudancasNaFaixa = 0; new MutationObserver(m => { window.mudancasNaFaixa += m.length; }).observe(el, { subtree: true, childList: true, characterData: true, attributes: true }); });
    for (const pagina of [2, paginas > 2 ? 3 : 1]) {
      await page.clock.runFor(10_000);
      await expect(page.locator('.fids-relogio small').first()).toHaveText(new RegExp(`^página ${pagina}/`));
      await expect(caixa(page, 'SBBH')).toBeVisible();
      await expect(caixa(page, 'SBCF')).toBeVisible();
      await ladoALado(page);
    }
    await expect(faixa(page)).toHaveAttribute('data-sonda', 'a mesma');
    expect(await page.evaluate(() => window.mudancasNaFaixa)).toBe(0);
    expect(erros).toEqual([]);
    await context.close();
  });

  test('a cada 10 minutos, as mensagens novas; a busca que falha guarda as últimas, e aí cada caixa diz a hora dela', async ({ browser }) => {
    const { context, servidor, page, erros } = await novoContexto(browser, {}, { statusEsperados: [503] });
    await page.clock.install({ time: new Date('2026-11-10T12:00:00-03:00') });
    await page.goto('./painel.html?supabase=teste');
    await preencherLogin(page, CONTAS.painel);
    await expect(caixa(page, 'SBCF').locator('.meteo-metar')).toHaveText(METEOROLOGIA_DE_TESTE.estacoes[1].metar);
    await expect(faixa(page).locator('.meteo-hora')).toHaveCount(0);
    expect(servidor.chamadasDaMeteorologia).toHaveLength(1);
    // Antes dos 10 minutos, nenhuma busca nova
    await page.clock.runFor(9 * 60_000);
    expect(servidor.chamadasDaMeteorologia).toHaveLength(1);
    // Aos 10 minutos, a função fora do ar (a chave da REDEMET que falta dá 503): as mensagens continuam, agora
    // com a hora delas, sem marca nem idade
    const recusadas = [];
    page.on('response', r => { if (r.url().includes('/functions/v1/meteorologia') && r.status() === 503) recusadas.push(r.url()); });
    servidor.falhar('/functions/v1/meteorologia', 1);
    await page.clock.runFor(60_000);
    await expect.poll(() => recusadas.length).toBe(1);
    await page.clock.runFor(5 * 60_000);
    await expect(caixa(page, 'SBCF').locator('.meteo-metar')).toHaveText(METEOROLOGIA_DE_TESTE.estacoes[1].metar);
    await expect(caixa(page, 'SBBH').locator('.meteo-hora')).toHaveText('Atualizado às 11:00 (14:00Z)');
    await expect(caixa(page, 'SBCF').locator('.meteo-hora')).toHaveText('Atualizado às 12:00 (15:00Z)');
    await expect(faixa(page).getByText(/antigo|Sem atualização|há \d/)).toHaveCount(0);
    // Aos 20 minutos, as mensagens novas (o SPECI das 12:20 de Confins): as horas saem
    const novas = structuredClone(METEOROLOGIA_DE_TESTE);
    novas.gerado = '2026-11-10T15:20:00.000Z';
    novas.estacoes[1] = { ...novas.estacoes[1], metar: 'SPECI SBCF 101520Z 34012KT 4000 TSRA BKN015 FEW030CB 22/20 Q1017', observado: '2026-11-10T15:20:00.000Z' };
    servidor.trocarMeteorologia(novas);
    await page.clock.runFor(5 * 60_000);
    await expect(caixa(page, 'SBCF').locator('.meteo-metar')).toHaveText(novas.estacoes[1].metar);
    await expect(faixa(page).locator('.meteo-hora')).toHaveCount(0);
    // As que chegaram à função: a das 12:00 e a das 12:20 (a das 12:10 parou no servidor fora do ar)
    expect(servidor.chamadasDaMeteorologia).toHaveLength(2);
    // Às 12:41, o METAR de Pampulha (o das 11:00) passou de 90 minutos: a hora dele, sem marca de antigo; Confins, sem hora
    // (fastForward: uma busca só, a das 12:41; com o relógio correndo, a das 12:30 estouraria o tempo máximo dela)
    await page.clock.fastForward(21 * 60_000);
    await expect(caixa(page, 'SBBH').locator('.meteo-hora')).toHaveText('Atualizado às 11:00 (14:00Z)');
    await expect(caixa(page, 'SBCF').locator('.meteo-hora')).toHaveCount(0);
    await expect(faixa(page).getByText(/antigo/)).toHaveCount(0);
    expect(erros).toEqual([]);
    await context.close();
  });

  test('sem a função publicada: "Meteorologia indisponível", e o painel e a TV como antes', async ({ browser }) => {
    const { context, servidor, page, erros } = await novoContexto(browser, { meteorologia: null }, { statusEsperados: [404] });
    await entrar(page, CONTAS.operador);
    await abrirPainelDaEscala(page);
    await expect(faixa(page)).toHaveText('Meteorologia indisponível');
    await expect(faixa(page).locator('.meteo-estacao')).toHaveCount(0);
    await expect(page.locator('#out .fids .fids-titulo')).toHaveText('Missões');
    await expect(page.locator('#out .fids tbody tr')).toHaveCount(12);
    // O resto do app segue: a Lista abre e o painel volta
    await page.locator('#s-esc [data-tl="lista"]').click();
    await expect(page.locator('#out .tabela-escala')).toBeVisible();
    // A TV também
    const tv = await context.newPage();
    const errosDaTV = vigiarErros(tv, { statusEsperados: [404] });
    await tv.goto('./painel.html?supabase=teste');
    await preencherLogin(tv, CONTAS.painel);
    await expect(linhas(tv).first()).toBeVisible();
    await expect(faixa(tv)).toHaveText('Meteorologia indisponível');
    expect(servidor.chamadasDaMeteorologia.length).toBeGreaterThanOrEqual(2);
    expect(erros).toEqual([]);
    expect(errosDaTV).toEqual([]);
    await context.close();
  });

  test('sem conexão com a função (erro de rede): "Meteorologia indisponível", e o painel como antes', async ({ browser }) => {
    const { context, page, erros } = await novoContexto(browser, {}, { statusEsperados: [] });
    await context.route('**/functions/v1/meteorologia', route => route.abort('failed'));
    await entrar(page, CONTAS.operador);
    await abrirPainelDaEscala(page);
    await expect(faixa(page)).toHaveText('Meteorologia indisponível');
    await expect(page.locator('#out .fids tbody tr')).toHaveCount(12);
    // Só o aviso do próprio navegador sobre a requisição que não chegou; nenhum erro do app
    expect(erros.filter(e => !/Failed to load resource: net::ERR_FAILED/.test(e))).toEqual([]);
    await context.close();
  });

  test('neste navegador (sem servidor): "Meteorologia indisponível", sem buscar nada', async ({ page }) => {
    const pedidos = [];
    page.on('request', r => { if (!r.url().startsWith('http://localhost')) pedidos.push(r.url()); });
    await abrir(page, { estado: comExemplo(estadoSintetico()) });
    await abrirPainelDaEscala(page);
    await expect(faixa(page)).toHaveText('Meteorologia indisponível');
    await page.goto('./painel.html');
    await expect(faixa(page)).toHaveText('Meteorologia indisponível');
    // Só as bibliotecas (o supabase-js do CDN vem nas duas páginas); nenhum servidor, nenhuma função
    expect(pedidos.filter(u => !u.startsWith('https://cdn') && !/fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
  });

  test('o METAR de 2 horas atrás: "Atualizado às", sem marca; sem METAR, o aviso e nenhuma hora', async ({ browser }) => {
    const velhas = structuredClone(METEOROLOGIA_DE_TESTE);
    velhas.estacoes[0] = { ...velhas.estacoes[0], metar: 'METAR SBBH 101300Z 00000KT 9999 FEW030 24/18 Q1018', observado: '2026-11-10T13:00:00.000Z' };
    velhas.estacoes[1] = { ...velhas.estacoes[1], metar: null, observado: null };
    const { context, page, erros } = await novoContexto(browser, { meteorologia: velhas });
    await page.goto('./painel.html?supabase=teste');
    await preencherLogin(page, CONTAS.painel);
    await expect(caixa(page, 'SBBH').locator('.meteo-hora')).toHaveText('Atualizado às 10:00 (13:00Z)');
    await expect(caixa(page, 'SBBH')).toHaveAttribute('class', 'meteo-estacao');
    await expect(faixa(page).getByText(/antigo|há \d/)).toHaveCount(0);
    await expect(caixa(page, 'SBCF').locator('.meteo-sem').first()).toHaveText('Sem METAR');
    await expect(caixa(page, 'SBCF').locator('.meteo-hora')).toHaveCount(0);
    await expect(caixa(page, 'SBCF').locator('.meteo-taf')).toBeVisible();
    expect(erros).toEqual([]);
    await context.close();
  });

  // No celular, as caixas ficam uma embaixo da outra, inteiras na tela (o quadro rola para o lado dentro da moldura; a
  // faixa fica parada)
  test('no celular (390 e 320 px), uma caixa embaixo da outra, sem rolar a página para o lado', async ({ browser }) => {
    const { context, page, erros } = await novoContexto(browser);
    await entrar(page, CONTAS.operador);
    await abrirPainelDaEscala(page);
    for (const largura of [390, 320]) {
      await page.setViewportSize({ width: largura, height: 800 });
      await expect(caixa(page, 'SBCF')).toBeVisible();
      const [a, b] = await Promise.all([caixa(page, 'SBBH').boundingBox(), caixa(page, 'SBCF').boundingBox()]);
      expect(b.y, `${largura}: Confins embaixo de Pampulha`).toBeGreaterThanOrEqual(a.y + a.height);
      for (const c of [a, b]) {
        expect(c.x, `${largura}: a caixa na tela`).toBeGreaterThanOrEqual(0);
        expect(c.x + c.width, `${largura}: a caixa na tela`).toBeLessThanOrEqual(largura);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${largura}: a página não rola para o lado`).toBeLessThanOrEqual(largura);
      // As mensagens quebram a linha dentro da caixa
      expect(await caixa(page, 'SBCF').locator('.meteo-taf').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      // O quadro rolado para o lado: a faixa fica no lugar
      await page.locator('#out .fids').evaluate(el => { el.scrollLeft = 400; });
      expect((await caixa(page, 'SBBH').boundingBox()).x).toBeCloseTo(a.x, 0);
      await page.locator('#out .fids').evaluate(el => { el.scrollLeft = 0; });
    }
    expect(erros).toEqual([]);
    await context.close();
  });

  // A tela toda: o quadro pagina as linhas que cabem acima da faixa (o TAF longo nas duas estações, o pior caso), na TV de
  // 1080p e de 720p, no monitor 4:3 e na tela cheia da Escala
  const LONGAS = structuredClone(METEOROLOGIA_DE_TESTE);
  LONGAS.estacoes = LONGAS.estacoes.map(e => ({
    ...e, metar: `${e.metar.split(' ').slice(0, 3).join(' ')} 34012G25KT 290V010 4000 1500SW -TSRA BR FEW008 BKN015 FEW030CB OVC080 22/20 Q1017 RERA WS R15`,
    taf: `TAF ${e.icao} 100800Z 1012/1112 34005KT 7000 SCT016 TX28/1018Z TN19/1109Z BECMG 1015/1017 9999 SCT035 TEMPO 1018/1021 4000 TSRA SCT035 FEW040CB BECMG 1022/1024 VRB03KT 8000 BKN015 PROB30 1107/1111 2000 BR SCT002 BECMG 1110/1112 9999 NSW SCT025 RMK PGM`
  }));
  const medirTela = page => page.evaluate(() => {
    const quadro = document.fullscreenElement || document.querySelector('.fids');
    const dados = [...quadro.querySelectorAll('tbody tr:not(.fids-vazia):not(.fids-nada)')];
    const meteo = quadro.querySelector('.fids-meteo').getBoundingClientRect();
    return {
      fundoDaTabela: quadro.querySelector('.fids-tabela').getBoundingClientRect().bottom,
      topoDaFaixa: meteo.top, fundoDaFaixa: meteo.bottom, altura: innerHeight,
      foraDaTela: dados.filter(tr => tr.getBoundingClientRect().bottom > meteo.top).length,
      linhas: dados.length,
      paginas: Number(/\/(\d+)/.exec(quadro.querySelector('.fids-relogio small').textContent)[1]),
      largura: document.documentElement.scrollWidth <= innerWidth
    };
  });
  const conferirTela = (m, rotulo) => {
    expect(m.fundoDaTabela, `${rotulo}: a tabela acima da faixa`).toBeLessThanOrEqual(m.topoDaFaixa + 0.5);
    expect(m.fundoDaFaixa, `${rotulo}: a faixa inteira na tela`).toBeLessThanOrEqual(m.altura + 0.5);
    expect(m.foraDaTela, `${rotulo}: nenhuma linha atrás da faixa`).toBe(0);
    expect(m.paginas, `${rotulo}: o que não cabe vai para outra página`).toBeGreaterThan(1);
    expect(m.linhas, `${rotulo}: as linhas da página`).toBeGreaterThanOrEqual(5);
    expect(m.largura, `${rotulo}: sem rolar para o lado`).toBe(true);
  };
  // A função que demora (a REDEMET lenta): o painel e a TV abrem na hora, sem esperar por ela; quando as
  // mensagens chegam, a faixa cresce e a página da TV passa a ter as linhas que cabem acima dela
  test('a função lenta não segura nada: o painel e a TV abrem, e a faixa espera as mensagens', async ({ browser }) => {
    const { context, servidor, page, erros } = await novoContexto(browser, { meteorologia: LONGAS }, { viewport: { width: 1280, height: 720 } });
    // 06:00: o dia inteiro ainda está no quadro Missões (ao meio-dia, os voos da manhã já teriam saído dele)
    await context.clock.setFixedTime(new Date('2026-11-10T06:00:00-03:00'));
    const soltar = servidor.segurar('/functions/v1/meteorologia');
    await entrar(page, CONTAS.operador);
    await abrirPainelDaEscala(page);
    await expect(page.locator('#out .fids tbody tr')).toHaveCount(12);
    await expect(faixa(page)).toHaveText('Buscando o METAR e o TAF…');
    await page.locator('#s-esc [data-tl="lista"]').click();
    await expect(page.locator('#out .tabela-escala')).toBeVisible();
    const tv = await context.newPage();
    await tv.setViewportSize({ width: 1280, height: 720 });
    const errosDaTV = vigiarErros(tv);
    await tv.goto('./painel.html?supabase=teste');
    await preencherLogin(tv, CONTAS.painel);
    await expect(linhas(tv).first()).toBeVisible();
    await expect(faixa(tv)).toHaveText('Buscando o METAR e o TAF…');
    const antes = await linhas(tv).count();
    soltar();
    await expect(caixa(tv, 'SBCF').locator('.meteo-taf')).toBeVisible();
    await ladoALado(tv);
    await expect.poll(async () => { const m = await medirTela(tv); return m.fundoDaTabela <= m.topoDaFaixa + 0.5 && m.foraDaTela === 0; }).toBe(true);
    expect(await linhas(tv).count(), 'a faixa maior tira linhas da página').toBeLessThan(antes);
    expect(erros).toEqual([]);
    expect(errosDaTV).toEqual([]);
    await context.close();
  });

  for (const [largura, altura] of [[1920, 1080], [1280, 720], [1024, 768]]) {
    test(`na TV de ${largura}×${altura}, o quadro pagina as linhas que cabem acima da faixa, com as duas caixas inteiras`, async ({ browser }) => {
      const { context, page, erros } = await novoContexto(browser, { meteorologia: LONGAS }, { viewport: { width: largura, height: altura } });
      await page.clock.setFixedTime(new Date('2026-11-10T06:00:00-03:00'));
      await page.goto('./painel.html?supabase=teste');
      await preencherLogin(page, CONTAS.painel);
      await expect(caixa(page, 'SBCF').locator('.meteo-taf')).toBeVisible();
      await expect(linhas(page).first()).toBeVisible();
      await ladoALado(page);
      await expect.poll(async () => { const m = await medirTela(page); return m.fundoDaTabela <= m.topoDaFaixa + 0.5 && m.foraDaTela === 0; }).toBe(true);
      conferirTela(await medirTela(page), `${largura}×${altura}`);
      expect(erros).toEqual([]);
      await context.close();
    });
  }

  // Pedro, 2026-11-20: na TV Full HD, duas listas lado a lado (o Automático) e a faixa embaixo das duas, da largura da
  // tela: cada lista com as mesmas linhas, as que cabem acima da faixa com os TAFs longos (mais uma não caberia), e a
  // página continua da lista da esquerda na da direita
  test('na TV de 1920×1080, duas listas lado a lado e a faixa embaixo das duas, com as linhas que cabem acima dela', async ({ browser }) => {
    const { context, page, erros } = await novoContexto(browser, { meteorologia: LONGAS }, { viewport: { width: 1920, height: 1080 } });
    await page.clock.install({ time: new Date('2026-11-10T06:00:00-03:00') });
    await page.goto('./painel.html?supabase=teste');
    await preencherLogin(page, CONTAS.painel);
    await expect(caixa(page, 'SBCF').locator('.meteo-taf')).toBeVisible();
    await expect(page.locator('.fids .fids-lista')).toHaveCount(2);
    await ladoALado(page);
    const medir = () => page.evaluate(() => {
      const quadro = document.querySelector('.fids');
      const listas = [...quadro.querySelectorAll('.fids-lista')].map(l => l.getBoundingClientRect());
      const tabelas = [...quadro.querySelectorAll('.fids-tabela')];
      const faixa = quadro.querySelector('.fids-meteo').getBoundingClientRect();
      const dados = [...quadro.querySelectorAll('tbody tr:not(.fids-vazia):not(.fids-nada)')];
      return {
        listas: listas.map(l => ({ left: l.left, right: l.right, top: l.top, bottom: l.bottom })),
        faixa: { left: faixa.left, right: faixa.right, top: faixa.top, bottom: faixa.bottom },
        porLista: tabelas.map(t => t.tBodies[0].rows.length),
        dados: tabelas.map(t => [...t.tBodies[0].rows].filter(tr => !tr.matches('.fids-vazia, .fids-nada')).length),
        linha: quadro.querySelector('tbody tr').getBoundingClientRect().height,
        atras: dados.filter(tr => tr.getBoundingClientRect().bottom > faixa.top + 0.5).length,
        pagina: quadro.querySelector('.fids-relogio small').textContent,
        largura: document.documentElement.scrollWidth
      };
    });
    await expect.poll(async () => (await medir()).atras).toBe(0);
    const m = await medir();
    const [esquerda, direita] = m.listas;
    expect(direita.left, 'lado a lado').toBeGreaterThanOrEqual(esquerda.right);
    expect(Math.abs(direita.top - esquerda.top)).toBeLessThan(1);
    // A faixa embaixo das duas listas, de uma ponta à outra da tela, no pé
    expect(m.faixa.top, 'a faixa embaixo das duas').toBeGreaterThanOrEqual(Math.max(esquerda.bottom, direita.bottom) - 0.5);
    expect(m.faixa.left).toBeLessThanOrEqual(esquerda.left);
    expect(m.faixa.right).toBeGreaterThanOrEqual(direita.right);
    expect(m.faixa.bottom).toBeCloseTo(1080, 0);
    expect(m.largura).toBeLessThanOrEqual(1920);
    // As duas com as mesmas linhas, as que cabem acima da faixa: mais uma não caberia
    expect(m.porLista[1]).toBe(m.porLista[0]);
    expect(m.porLista[0]).toBeGreaterThanOrEqual(8);
    expect(m.faixa.top - Math.max(esquerda.bottom, direita.bottom), 'mais uma linha não caberia').toBeLessThan(m.linha + 5);
    // A primeira página cheia nas duas listas, e o que não cabe vai para a página seguinte
    expect(m.dados).toEqual([m.porLista[0], m.porLista[0]]);
    expect(m.pagina).toMatch(/^página 1\/[2-9]$/);
    // A troca de página não mexe na faixa, e a página seguinte começa de novo na lista da esquerda
    await page.clock.runFor(10_000);
    await expect(page.locator('.fids-relogio small').first()).toHaveText(/^página 2\//);
    await expect.poll(async () => (await medir()).atras).toBe(0);
    await ladoALado(page);
    expect((await medir()).dados[0]).toBeGreaterThan(0);
    expect(erros).toEqual([]);
    await context.close();
  });

  // As letras diminuem só na página que precisa (um nome comprido); na seguinte, elas voltam a crescer, e o topo e o
  // cabeçalho também: as linhas de cada lista são contadas com as letras inteiras, e nenhuma fica atrás da faixa em
  // nenhuma página (contadas com as letras menores da página anterior, a última de cada lista ficava atrás dela)
  test('na TV, a página com as letras menores e a seguinte com as inteiras: nenhuma linha atrás da faixa, as mesmas linhas por lista', async ({ browser }) => {
    const nomeComprido = 'Instrutor Wenceslau Wanderley Washington Wolfgang Wellington Wagner Westphalen';
    const dia = diaCheio({
      painel: { quadro: 'missoes', colunas: [], listas: 'duas' },
      // Os três primeiros voos do dia (na primeira página) com o instrutor de nome comprido
      mudar: out => { for (const o of [...out].sort((x, y) => x.a - y.a).slice(0, 3)) o.ins = nomeComprido; }
    });
    const { context, page, erros } = await novoContexto(browser, { meteorologia: LONGAS }, { viewport: { width: 1920, height: 1080 }, dia });
    await page.clock.install({ time: new Date('2026-11-10T06:00:00-03:00') });
    await page.goto('./painel.html?supabase=teste');
    await preencherLogin(page, CONTAS.painel);
    await expect(caixa(page, 'SBCF').locator('.meteo-taf')).toBeVisible();
    await expect(page.locator('.fids .fids-lista')).toHaveCount(2);
    const medir = () => page.evaluate(() => {
      const quadro = document.querySelector('.fids');
      const faixa = quadro.querySelector('.fids-meteo').getBoundingClientRect();
      return {
        pagina: quadro.querySelector('.fids-relogio small').textContent,
        ajuste: quadro.style.getPropertyValue('--fids-ajuste'),
        porLista: [...quadro.querySelectorAll('.fids-tabela')].map(t => t.tBodies[0].rows.length),
        atras: [...quadro.querySelectorAll('tbody tr')].filter(tr => tr.getBoundingClientRect().bottom > faixa.top + 0.5).length
      };
    });
    await expect(page.locator('.fids-relogio small').first()).toHaveText(/^página 1\/2$/);
    const primeira = await medir();
    // A primeira página, com o nome comprido, nas letras menores
    expect(primeira.ajuste).not.toBe('');
    expect(primeira.atras).toBe(0);
    for (const pagina of [2, 1, 2]) {
      await page.clock.runFor(10_000);
      await expect(page.locator('.fids-relogio small').first()).toHaveText(new RegExp(`^página ${pagina}/2$`));
      const m = await medir();
      // A segunda página, sem o nome comprido, nas letras inteiras
      if (pagina === 2) expect(m.ajuste).toBe('');
      expect(m.atras, `página ${pagina}: nenhuma linha atrás da faixa`).toBe(0);
      expect(m.porLista, `página ${pagina}: as mesmas linhas por lista`).toEqual(primeira.porLista);
    }
    expect(erros).toEqual([]);
    await context.close();
  });

  test('em tela cheia na Escala: o quadro pagina acima da faixa; fora dela, volta às 12 linhas', async ({ browser }) => {
    const { context, page, erros } = await novoContexto(browser, { meteorologia: LONGAS }, { viewport: { width: 1280, height: 720 } });
    await context.clock.setFixedTime(new Date('2026-11-10T06:00:00-03:00'));
    await entrar(page, CONTAS.operador, { url: `${URL_APP}&data=${HOJE}` });
    await abrirPainelDaEscala(page);
    await expect(caixa(page, 'SBCF').locator('.meteo-taf')).toBeVisible();
    await page.locator('#out [data-fids="tela-cheia"]').click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    await expect.poll(async () => { const m = await medirTela(page); return m.fundoDaTabela <= m.topoDaFaixa + 0.5 && m.foraDaTela === 0; }).toBe(true);
    conferirTela(await medirTela(page), 'tela cheia');
    await ladoALado(page);
    await page.evaluate(() => document.exitFullscreen());
    await expect(page.locator('#out .fids tbody tr')).toHaveCount(12);
    await expect(caixa(page, 'SBCF')).toBeVisible();
    expect(erros).toEqual([]);
    await context.close();
  });
});
