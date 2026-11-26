// O trilho (F1b): o calendário da data aberta no lugar das setas e do campo da data. Ao lado da tela a partir de 1280 px
// (por padrão), ou um painel aberto pelo botão da data; os dias (hoje, a data aberta, domingo, os pedidos de cada um), as
// teclas, "Fixar ao lado", o celular e a gaveta do Histórico à esquerda dele. Os padrões do produto, de propósito
import {
  test, expect, abrir, abrirComExemplo, entrar, preencherLogin, irPara, abrirHistorico, AMANHA, URL_APP, REGIOES, dataAberta, botaoDaData,
  rotuloDaData, trilho, diaDoCalendario, diasDoCalendario, contagemDoDia, paradasDoCalendario, escolherNoCalendario, mudarData, alvosPequenos,
  larguraDaPagina, semNome, prepararContexto, vigiarErros, avisosDaData, contagemDosAvisos, abrirEscala, aprovar, alternarDisponivel, botaoDaAba, abrirMenuDaConta
} from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';
import { comExemplo } from '../helpers/exemplo.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

test.use({ preferencias: false });

const pedido = (id, data, extra = {}) => ({
  id, data, aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Voo Local', janela: 'manha', horario: null, observacao: null,
  registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: 'Secretaria de Teste', excecao: false, cancelada_em: null, cancelada_por: null, ...extra
});
const comAluno = () => documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000)] }, AMANHA);
// As leituras dos pedidos que chegaram ao servidor: a data de uma ('11/11') ou as semanas do calendário ('01/11 a 05/12')
function leiturasDePedidos(page) {
  const lidas = [];
  const ddmm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  page.on('request', r => {
    const url = new URL(r.url());
    if (r.method() !== 'GET' || !url.pathname.endsWith('/rest/v1/solicitacoes')) return;
    const [de, ate] = url.searchParams.getAll('data').map(v => v.replace(/^(gte|lte)\./, ''));
    lidas.push(de === ate ? ddmm(de) : `${ddmm(de)} a ${ddmm(ate)}`);
  });
  return lidas;
}
// Segura as leituras que o filtro escolhe até soltar() (as seguintes seguem)
async function segurar(context, quais) {
  let soltar;
  const espera = new Promise(resolve => { soltar = resolve; });
  await context.route(quais, async route => { await espera; await route.fallback(); });
  return soltar;
}
const pedidosDoDia = dia => url => url.pathname.endsWith('/rest/v1/solicitacoes') && url.searchParams.getAll('data').join() === `gte.${dia},lte.${dia}`;
const contagemDoMes = url => url.pathname.endsWith('/rest/v1/solicitacoes') && new Set(url.searchParams.getAll('data').map(v => v.slice(4))).size > 1;
const leituraDoDia = dia => url => url.pathname.endsWith('/rest/v1/dias') && url.searchParams.get('data') === `eq.${dia}`;

test.describe('O trilho ao lado', () => {
  test('a 1280 px, o calendário fica ao lado da tela: hoje, a data aberta e o domingo', async ({ page }) => {
    await abrirComExemplo(page);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
    await expect(trilho(page)).toBeVisible();
    await expect(botaoDaData(page)).not.toHaveAttribute('aria-expanded');
    const [tela, lado] = await Promise.all([page.locator('main#conteudo').boundingBox(), trilho(page).boundingBox()]);
    expect(lado.x).toBeGreaterThan(tela.x + tela.width);
    await expect(page.locator('#cal-mes')).toHaveText('Novembro de 2026');
    await expect(diaDoCalendario(page, '2026-11-10')).toHaveClass(/\bhoje\b/);
    await expect(diaDoCalendario(page, AMANHA)).toHaveAttribute('aria-current', 'date');
    await expect(diaDoCalendario(page, AMANHA)).toHaveAccessibleName('quarta-feira, 11 de novembro de 2026, amanhã, data aberta');
    await expect(page.locator('#trilho-data')).toHaveText('Amanhã · quarta-feira · 11 de novembro');
    // O domingo não abre: o aviso, e a data fica
    // (aria-disabled: o Playwright não clica no que se diz desligado; quem usa o app clica e lê o aviso)
    await expect(diaDoCalendario(page, '2026-11-15')).toHaveAttribute('aria-disabled', 'true');
    await diaDoCalendario(page, '2026-11-15').click({ force: true });
    await expect(page.locator('#toast-box')).toContainText('O aeroclube não opera aos domingos: não há escala nem pedidos.');
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    // Todos os controles com nome
    expect(await semNome(page, REGIOES.casca)).toEqual([]);
  });

  for (const largura of [1280, 1920]) {
    test(`a ${largura} px, as sete colunas cabem dentro do trilho, com os dias redondos e do mesmo tamanho`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await abrirComExemplo(page);
      const lado = await trilho(page).boundingBox();
      const dias = await diasDoCalendario(page).evaluateAll(bs => bs.map(b => b.getBoundingClientRect().toJSON()));
      expect(dias.length % 7).toBe(0);
      const primeira = dias.slice(0, 7);
      expect(new Set(primeira.map(d => Math.round(d.top))).size).toBe(1);
      for (let i = 1; i < 7; i++) expect(primeira[i].left).toBeGreaterThanOrEqual(primeira[i - 1].right);
      expect(Math.min(...dias.map(d => d.left))).toBeGreaterThanOrEqual(lado.x);
      expect(Math.max(...dias.map(d => d.right))).toBeLessThanOrEqual(lado.x + lado.width);
      expect(Math.max(...dias.map(d => d.width)) - Math.min(...dias.map(d => d.width))).toBeLessThan(1.5);
      for (const d of dias) expect(Math.abs(d.width - d.height)).toBeLessThan(1.5);
      expect(dias[0].width).toBeGreaterThanOrEqual(34);
      expect(await larguraDaPagina(page)).toBeLessThanOrEqual(largura);
    });
  }

  test('um dia abre a data: a marca, o endereço, o anúncio; ao lado, o foco fica no dia', async ({ page }) => {
    await abrirComExemplo(page);
    await diaDoCalendario(page, '2026-11-12').click();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect(page).toHaveURL(/data=2026-11-12/);
    await expect(diaDoCalendario(page, '2026-11-12')).toHaveAttribute('aria-current', 'date');
    await expect(page.locator('#anuncio')).toHaveText('Data aberta: quinta-feira, 12/11');
    await expect(diaDoCalendario(page, '2026-11-12')).toBeFocused();
    await expect(rotuloDaData(page)).toHaveText('quinta-feira, 12/11', { useInnerText: true });
    await expect(page.locator('#trilho-data')).toHaveText('Quinta-feira · 12 de novembro');
  });

  test('as teclas andam pela grade, e a página do mês segue o dia', async ({ page }) => {
    await abrirComExemplo(page);
    await botaoDaData(page).click();
    await expect(diaDoCalendario(page, AMANHA)).toBeFocused();
    await expect(paradasDoCalendario(page)).toHaveCount(1);
    await page.keyboard.press('ArrowRight');
    await expect(diaDoCalendario(page, '2026-11-12')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(diaDoCalendario(page, '2026-11-19')).toBeFocused();
    await page.keyboard.press('PageDown');
    await expect(page.locator('#cal-mes')).toHaveText('Dezembro de 2026');
    await expect(diaDoCalendario(page, '2026-12-19')).toBeFocused();
    // O número dos pedidos chega e a grade é refeita: o foco e a parada do Tab continuam no dia
    await expect(paradasDoCalendario(page)).toHaveAttribute('data-dia', '2026-12-19');
    await page.keyboard.press('Home');
    await expect(diaDoCalendario(page, '2026-12-13')).toBeFocused();
    // O domingo não abre, também pelo teclado
    await page.keyboard.press('Enter');
    await expect(page.locator('#toast-box')).toContainText('não opera aos domingos');
    await page.keyboard.press('Escape');
    await expect(botaoDaData(page)).toBeFocused();
    await expect(trilho(page)).toBeVisible();
  });

  test('a seta para um dia de outro mês já à vista não troca o mês; PageDown e PageUp vão sempre ao mês do dia', async ({ page }) => {
    await abrir(page, { url: './?data=2026-11-30' });
    await botaoDaData(page).click();
    await page.keyboard.press('ArrowRight');
    await expect(diaDoCalendario(page, '2026-12-01')).toBeFocused();
    await expect(page.locator('#cal-mes')).toHaveText('Novembro de 2026');
    // 1º de dezembro menos um mês: 1º de novembro, que já está à vista no mês dele
    await page.keyboard.press('PageUp');
    await expect(diaDoCalendario(page, '2026-11-01')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    // 2 de novembro mais um mês: 2 de dezembro está à vista na última semana de novembro, e mesmo assim o mês muda
    await page.keyboard.press('PageDown');
    await expect(diaDoCalendario(page, '2026-12-02')).toBeFocused();
    await expect(page.locator('#cal-mes')).toHaveText('Dezembro de 2026');
  });

  test('a única parada do Tab: a data aberta; sem ela à vista, hoje; sem nenhuma, o dia 1 do mês', async ({ page }) => {
    await abrir(page, { url: './?data=2026-12-16' });
    await expect(paradasDoCalendario(page)).toHaveCount(1);
    await expect(paradasDoCalendario(page)).toHaveAttribute('data-dia', '2026-12-16');
    await page.locator('#cal-mes-ant').click();
    await expect(paradasDoCalendario(page)).toHaveAttribute('data-dia', '2026-11-10');
    await page.locator('#cal-mes-ant').click();
    await expect(paradasDoCalendario(page)).toHaveAttribute('data-dia', '2026-10-01');
    await expect(paradasDoCalendario(page)).toHaveCount(1);
  });

  test('as setas do mês mudam só o mês à vista; um dia de outro mês abre a data e leva o calendário ao mês dele', async ({ page }) => {
    await abrirComExemplo(page);
    await page.locator('#cal-mes-prox').click();
    await expect(page.locator('#cal-mes')).toHaveText('Dezembro de 2026');
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    await page.locator('#cal-mes-ant').click();
    const fora = diaDoCalendario(page, '2026-12-01');
    await expect(fora).toHaveClass(/\bfora\b/);
    await expect(fora).toHaveText(/dez/);
    await fora.click();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-12-01');
    await expect(page.locator('#cal-mes')).toHaveText('Dezembro de 2026');
    await expect(fora).not.toHaveClass(/\bfora\b/);
    await expect(fora).toBeFocused();
  });

  // Alt e ← (ou Cmd e ←) é o Voltar do navegador, e Ctrl e Home o alto da página: a grade só fica com as teclas sozinhas
  test('as teclas com Alt, Ctrl ou Cmd são do navegador', async ({ page }) => {
    await abrirComExemplo(page);
    await botaoDaData(page).click();
    await expect(diaDoCalendario(page, AMANHA)).toBeFocused();
    const tecla = (key, com) => diaDoCalendario(page, AMANHA).evaluate((dia, [k, c]) => !dia.dispatchEvent(new KeyboardEvent('keydown', { key: k, [c]: true, bubbles: true, cancelable: true })), [key, com]);
    for (const [key, com] of [['ArrowLeft', 'altKey'], ['ArrowLeft', 'metaKey'], ['Home', 'ctrlKey']]) {
      expect(await tecla(key, com), `${com} ${key}`).toBe(false);
      await expect(diaDoCalendario(page, AMANHA)).toBeFocused();
    }
    expect(await tecla('ArrowLeft', 'shiftKey')).toBe(true);
  });

  test('a página rola e o trilho continua à vista', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await abrirComExemplo(page);
    await page.locator('#btn-manual').click();
    await expect(page.locator('#s-manual')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 3000));
    await expect.poll(() => trilho(page).evaluate(t => Math.round(t.getBoundingClientRect().top))).toBe(12);
    await expect(diaDoCalendario(page, AMANHA)).toBeInViewport();
    // Mais alto que a janela, ele rola por dentro
    await page.setViewportSize({ width: 1400, height: 300 });
    expect(await trilho(page).evaluate(t => [t.scrollHeight > t.clientHeight, t.getBoundingClientRect().height <= 300 - 24])).toEqual([true, true]);
  });

  test('a impressão leva só a Escala: sem o trilho e sem os avisos do app', async ({ page }) => {
    await abrirComExemplo(page, { url: './?share=1' });
    await expect(page.locator('#aviso-link')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(trilho(page)).toBeHidden();
    await expect(page.locator('#aviso-link')).toBeHidden();
    await expect(page.locator('#s-esc')).toBeVisible();
  });

  // A página aberta passa da meia-noite: as duas partes que dizem a data são refeitas juntas
  test('depois da meia-noite, o topo e o trilho dizem o mesmo dia', async ({ page, context }) => {
    await abrirComExemplo(page);
    await expect(page.locator('#trilho-data')).toHaveText('Amanhã · quarta-feira · 11 de novembro');
    await context.clock.setFixedTime(new Date('2026-11-11T08:00:00-03:00'));
    await page.locator('#cal-mes-prox').click();
    await expect(page.locator('#trilho-data')).toHaveText('Hoje · quarta-feira · 11 de novembro');
    await expect(botaoDaData(page)).toContainText('hoje');
  });

  test('a largura muda de classe com o foco no trilho: o foco vai para o botão da data', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await abrirComExemplo(page);
    await diaDoCalendario(page, '2026-11-12').focus();
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(trilho(page)).toBeHidden();
    await expect(botaoDaData(page)).toBeFocused();
    // Com o foco na tela, ele fica
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.locator('#flt-esc-q').focus();
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(trilho(page)).toBeHidden();
    await expect(page.locator('#flt-esc-q')).toBeFocused();
  });

  test('a gaveta do Histórico abre à esquerda do trilho, e a data muda com ela aberta', async ({ page }) => {
    for (const largura of [1280, 1920]) {
      await page.setViewportSize({ width: largura, height: 800 });
      await abrirComExemplo(page);
      await abrirHistorico(page);
      const [gaveta, lado] = await Promise.all([page.locator('#historico').boundingBox(), trilho(page).boundingBox()]);
      expect(Math.abs(gaveta.x + gaveta.width - (lado.x - 12)), `${largura} px`).toBeLessThanOrEqual(1);
      await diaDoCalendario(page, '2026-11-12').click();
      await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
      await expect(page.locator('#historico')).toBeVisible();
    }
  });
});

test.describe('A data abrindo', () => {
  test('até os dados chegarem, o dia gira e a data aberta continua a de antes; depois, a data nova', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    await entrar(page, CONTAS.operador);
    const liberar = servidor.segurarLeiturasDeDias();
    const dia = diaDoCalendario(page, '2026-11-12');
    await dia.click();
    await expect(dia).toHaveClass(/\babrindo\b/);
    await expect(dia).toHaveAttribute('aria-busy', 'true');
    await expect(dia).toHaveAccessibleName('quinta-feira, 12 de novembro de 2026, abrindo');
    expect(await dia.evaluate(b => getComputedStyle(b, '::after').animationName)).toBe('cal-girar');
    await expect(page.locator('#trilho-data')).toHaveText('Abrindo quinta-feira, 12/11…');
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    await expect(diaDoCalendario(page, AMANHA)).toHaveAttribute('aria-current', 'date');
    await expect(rotuloDaData(page)).toContainText('11/11');
    await expect(page).toHaveURL(/data=2026-11-11/);
    // Com o movimento reduzido, o anel fica parado
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await dia.evaluate(b => getComputedStyle(b, '::after').animationName)).toBe('none');
    liberar();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect(dia).not.toHaveClass(/\babrindo\b/);
    await expect(dia).not.toHaveAttribute('aria-busy');
    await expect(page.locator('#trilho-data')).toHaveText('Quinta-feira · 12 de novembro');
    await expect(page).toHaveURL(/data=2026-11-12/);
  });

  // A data está aberta com os dados na tela: o BI do período, que chega depois, não segura o fim dela
  test('o fim da abertura não espera o BI', async ({ page, context }) => {
    await instalarSupabaseFalso(context, comAluno());
    await entrar(page, CONTAS.operador);
    let soltar;
    const espera = new Promise(resolve => { soltar = resolve; });
    await context.route(url => url.pathname.endsWith('/rest/v1/dias') && url.searchParams.getAll('data').some(v => v.startsWith('gte.')), async route => { await espera; await route.fallback(); });
    await diaDoCalendario(page, '2026-11-12').click();
    await expect(page.locator('#anuncio')).toHaveText('Data aberta: quinta-feira, 12/11');
    await expect(diaDoCalendario(page, '2026-11-12')).not.toHaveClass(/\babrindo\b/);
    soltar();
  });

  test('quem foi para um campo da tela enquanto a data abria continua nele', async ({ page, context }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    const servidor = await instalarSupabaseFalso(context, comAluno());
    await entrar(page, CONTAS.operador);
    const liberar = servidor.segurarLeiturasDeDias();
    await escolherNoCalendario(page, '2026-11-12');
    const busca = page.locator('#flt-esc-q');
    await busca.focus();
    liberar();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect(trilho(page)).toBeHidden();
    await expect(busca).toBeFocused();
  });

  test('a data que não abre: o aviso, e nada muda', async ({ browser }) => {
    // As tentativas de novo do supabase-js demoram
    test.slow();
    const context = await browser.newContext();
    await prepararContexto(context, { preferencias: false });
    const servidor = await instalarSupabaseFalso(context, comAluno());
    const page = await context.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    await entrar(page, CONTAS.operador);
    servidor.falhar('/rest/v1/dias', 1000);
    await diaDoCalendario(page, '2026-11-12').click();
    await expect(page.locator('#toast-box')).toContainText('Não foi possível abrir essa data. Verifique a conexão e tente de novo.', { timeout: 15000 });
    await expect(diaDoCalendario(page, '2026-11-12')).not.toHaveClass(/\babrindo\b/);
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    await expect(page.locator('#trilho-data')).toHaveText('Amanhã · quarta-feira · 11 de novembro');
    expect(erros).toEqual([]);
    await context.close();
  });

  // O último clique vale, também quando volta a uma data que já estava sendo lida
  for (const largura of [1400, 1100]) {
    test(`a ${largura} px, uma data, outra e a primeira de novo: ela fica abrindo até abrir, e o fim da abertura é o dela`, async ({ page, context }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      await instalarSupabaseFalso(context, comAluno());
      await entrar(page, CONTAS.operador);
      const soltar13 = await segurar(context, leituraDoDia('2026-11-13'));
      let n = 0, soltar1, soltar2;
      const esperas = [new Promise(resolve => { soltar1 = resolve; }), new Promise(resolve => { soltar2 = resolve; })];
      await context.route(leituraDoDia('2026-11-12'), async route => { await esperas[Math.min(n++, 1)]; await route.fallback(); });
      for (const dia of ['2026-11-12', '2026-11-13', '2026-11-12']) await escolherNoCalendario(page, dia);
      const dia = diaDoCalendario(page, '2026-11-12');
      await expect.poll(() => n).toBe(1);
      soltar1();
      // A segunda leitura do dia 12 começou: a primeira acabou
      await expect.poll(() => n).toBe(2);
      await expect(dia).toHaveClass(/\babrindo\b/);
      await expect(page.locator('#trilho-data')).toHaveText('Abrindo quinta-feira, 12/11…');
      soltar2();
      soltar13();
      await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
      await expect(page.locator('#anuncio')).toHaveText('Data aberta: quinta-feira, 12/11');
      await expect(dia).not.toHaveClass(/\babrindo\b/);
      if (largura === 1100) {
        await expect(trilho(page)).toBeHidden();
        await expect(botaoDaData(page)).toBeFocused();
      }
    });
  }

  test('o clique na data que continua aberta desfaz a troca que ainda abria', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    await entrar(page, CONTAS.operador);
    const liberar = servidor.segurarLeiturasDeDias();
    await diaDoCalendario(page, '2026-11-12').click();
    await expect(page.locator('#trilho-data')).toHaveText('Abrindo quinta-feira, 12/11…');
    await diaDoCalendario(page, AMANHA).click();
    await expect(page.locator('#trilho-data')).toHaveText('Abrindo quarta-feira, 11/11…');
    liberar();
    await expect(page.locator('#trilho-data')).toHaveText('Amanhã · quarta-feira · 11 de novembro');
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    await expect(page.locator('#anuncio')).toHaveText('Data aberta: quarta-feira, 11/11');
    // Nada ficou preso: a data aberta grava
    await irPara(page, 'rec');
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect.poll(() => servidor.dias.get(AMANHA).conteudo.av['PR-BTB']).toBe(false);
  });

  test('depois de uma data não abrir, o clique na que continua aberta a lê de novo, e ela volta a gravar', async ({ browser }) => {
    test.slow();
    const context = await browser.newContext();
    await prepararContexto(context, { preferencias: false });
    const servidor = await instalarSupabaseFalso(context, comAluno());
    const page = await context.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    await entrar(page, CONTAS.operador);
    servidor.falhar('/rest/v1/dias', 1000);
    await diaDoCalendario(page, '2026-11-12').click();
    await expect(page.locator('#toast-box')).toContainText('Não foi possível abrir essa data.', { timeout: 15000 });
    servidor.falhar('/rest/v1/dias', 0);
    await diaDoCalendario(page, AMANHA).click();
    await expect(page.locator('#anuncio')).toHaveText('Data aberta: quarta-feira, 11/11');
    await irPara(page, 'rec');
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect.poll(() => servidor.dias.get(AMANHA).conteudo.av['PR-BTB']).toBe(false);
    expect(erros).toEqual([]);
    await context.close();
  });

  // Aberta e lida, a data aberta não é lida de novo por um clique nela
  test('o clique na data aberta não faz nada', async ({ page, context }) => {
    await instalarSupabaseFalso(context, comAluno());
    await entrar(page, CONTAS.operador);
    let leituras = 0;
    await context.route(leituraDoDia(AMANHA), route => { leituras++; return route.fallback(); });
    await diaDoCalendario(page, AMANHA).click();
    await page.waitForTimeout(200);
    await expect(page.locator('#trilho-data')).toHaveText('Amanhã · quarta-feira · 11 de novembro');
    expect(leituras).toBe(0);
  });

  // O calendário está à vista desde o começo: o dia escolhido antes de a abertura preparar os dados é o que abre, no lugar
  // da data do link
  test('a data escolhida antes de o app preparar os dados é a que abre', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    const liberar = servidor.segurar('/rest/v1/documentos');
    await page.goto(`${URL_APP}&data=2026-11-20`);
    await preencherLogin(page, CONTAS.operador);
    await expect(page.locator('#usuario')).toBeVisible();
    await diaDoCalendario(page, '2026-11-13').click();
    await expect(page.locator('#trilho-data')).toHaveText('Abrindo sexta-feira, 13/11…');
    liberar();
    await expect(page.locator('body[data-pronto]')).toBeAttached();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-13');
    await expect(page.locator('#trilho-data')).toHaveText('Sexta-feira · 13 de novembro');
    await expect(page).toHaveURL(/data=2026-11-13/);
    await irPara(page, 'rec');
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect.poll(() => servidor.dias.get('2026-11-13')?.conteudo.av['PR-BTB']).toBe(false);
  });

  test('a data escolhida enquanto o app abre fica no lugar da abertura', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    const liberar = servidor.segurarLeiturasDeDias();
    await page.goto(URL_APP);
    await preencherLogin(page, CONTAS.operador);
    await expect(page.locator('#usuario')).toBeVisible();
    await diaDoCalendario(page, '2026-11-13').click();
    liberar();
    await expect(page.locator('body[data-pronto]')).toBeAttached();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-13');
    await expect(diaDoCalendario(page, '2026-11-13')).toHaveAttribute('aria-current', 'date');
  });
});

test.describe('O trilho solto', () => {
  test.use({ viewport: { width: 1100, height: 800 } });

  test('o botão da data abre o painel com o foco no calendário; a data aberta fecha o painel e o foco volta ao botão', async ({ page }) => {
    await abrirComExemplo(page);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fechado');
    await expect(trilho(page)).toBeHidden();
    await expect(botaoDaData(page)).toHaveAttribute('aria-expanded', 'false');
    await botaoDaData(page).click();
    await expect(trilho(page)).toBeVisible();
    await expect(botaoDaData(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(diaDoCalendario(page, AMANHA)).toBeFocused();
    await diaDoCalendario(page, '2026-11-13').click();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-13');
    await expect(trilho(page)).toBeHidden();
    await expect(botaoDaData(page)).toBeFocused();
    // Nada fica guardado: abrir para olhar não fixa
    expect(await page.evaluate(() => localStorage.getItem('acpm_trilho'))).toBe(null);
  });

  test('o painel fecha no Esc (com o foco nele ou no botão da data), no ✕ e no próprio botão; ele abre no mês da data', async ({ page }) => {
    await abrirComExemplo(page);
    await botaoDaData(page).click();
    await page.keyboard.press('Escape');
    await expect(trilho(page)).toBeHidden();
    await expect(botaoDaData(page)).toBeFocused();
    await botaoDaData(page).click();
    await botaoDaData(page).focus();
    await page.keyboard.press('Escape');
    await expect(trilho(page)).toBeHidden();
    await botaoDaData(page).click();
    await page.locator('#cal-mes-prox').click();
    await page.locator('#cal-mes-prox').click();
    await expect(page.locator('#cal-mes')).toHaveText('Janeiro de 2027');
    await botaoDaData(page).click();
    await expect(trilho(page)).toBeHidden();
    await expect(botaoDaData(page)).toHaveAttribute('aria-expanded', 'false');
    await botaoDaData(page).click();
    await expect(page.locator('#cal-mes')).toHaveText('Novembro de 2026');
    await page.locator('#btn-fechar-trilho').click();
    await expect(trilho(page)).toBeHidden();
    await expect(botaoDaData(page)).toBeFocused();
    // Com o foco na tela, o Esc é da tela
    await botaoDaData(page).click();
    await page.locator('#flt-esc-q').focus();
    await page.keyboard.press('Escape');
    await expect(trilho(page)).toBeVisible();
  });

  test('o calendário tem no máximo 320 px, à esquerda, com a linha da data ao lado; no celular, embaixo', async ({ page }) => {
    await abrirComExemplo(page);
    await botaoDaData(page).click();
    const medidas = () => page.evaluate(() => {
      const r = seletor => document.querySelector(seletor).getBoundingClientRect().toJSON();
      return { cal: r('#cal'), lista: r('.trilho-avisos') };
    });
    const largo = await medidas();
    expect(largo.cal.width).toBeLessThanOrEqual(320);
    expect(largo.lista.left).toBeGreaterThanOrEqual(largo.cal.right);
    expect(largo.lista.top).toBeLessThan(largo.cal.top);
    await page.setViewportSize({ width: 720, height: 800 });
    await botaoDaData(page).click();
    expect((await medidas()).lista.left).toBeGreaterThanOrEqual((await medidas()).cal.right);
    await page.setViewportSize({ width: 640, height: 800 });
    const estreito = await medidas();
    expect(estreito.cal.width).toBeLessThanOrEqual(320);
    expect(estreito.lista.top).toBeGreaterThanOrEqual(estreito.cal.bottom);
  });

  test('"Fixar ao lado" põe o calendário ao lado e fica guardado para a largura', async ({ page }) => {
    await abrirComExemplo(page);
    await botaoDaData(page).click();
    await page.locator('#btn-fixar-trilho').click();
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
    await expect(page.locator('#btn-fixar-trilho')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#btn-fechar-trilho')).toBeHidden();
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-pronto', '1');
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
    // Na largura larga, o guardado da média não vale: o padrão (ao lado)
    await page.setViewportSize({ width: 1400, height: 800 });
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
    await page.locator('#btn-fixar-trilho').click();
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fechado');
    await expect(botaoDaData(page)).toBeFocused();
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
  });

  test('as larguras: ao lado a partir de 1280 px; "Fixar ao lado" a partir de 1024 px; o painel aberto fecha quando a classe muda', async ({ page }) => {
    const estado = async largura => {
      await page.setViewportSize({ width: largura, height: 800 });
      return page.locator('body').getAttribute('data-trilho');
    };
    await abrirComExemplo(page);
    await estado(1279);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fechado');
    await estado(1280);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
    await estado(1279);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fechado');
    // Fixado na média: ao lado a 1024 px, nunca a 1023 px
    await botaoDaData(page).click();
    await page.locator('#btn-fixar-trilho').click();
    await estado(1024);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
    await estado(1023);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fechado');
    await botaoDaData(page).click();
    await expect(page.locator('#btn-fixar-trilho')).toBeHidden();
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'aberto');
    // Dentro da classe o painel continua; mudando de classe, fecha (aqui, para o fixo da média)
    await estado(800);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'aberto');
    await estado(1024);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
    await page.locator('#btn-fixar-trilho').click();
    await botaoDaData(page).click();
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'aberto');
    await estado(1023);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fechado');
    await expect(botaoDaData(page)).toHaveAttribute('aria-expanded', 'false');
  });

  // Os números chegam com o botão do mouse apertado: o dia é o mesmo elemento, e o clique vale
  test('a contagem que chega entre apertar e soltar o botão do mouse não perde o clique no dia', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    servidor.solicitacoes.push(pedido(1, '2026-11-12'));
    await entrar(page, CONTAS.operador);
    await escolherNoCalendario(page, AMANHA);
    const numero = contagemDoDia(page, '2026-11-12');
    await expect(numero).toHaveText('1');
    servidor.solicitacoes.push(pedido(2, '2026-11-12'), pedido(3, '2026-11-13'));
    const soltar = await segurar(context, contagemDoMes);
    await page.locator('#cal-mes-prox').click();
    await page.locator('#cal-mes-ant').click();
    await expect(numero).toHaveText('1');
    const caixa = await numero.boundingBox();
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.mouse.down();
    soltar();
    await expect(numero).toHaveText('2');
    await expect(contagemDoDia(page, '2026-11-13')).toHaveText('1');
    await page.mouse.up();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
  });

  test('o Gestor deste navegador também muda a data, e nada é gravado', async ({ page }) => {
    await abrirComExemplo(page, { url: './?role=gestor' });
    const antes = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    await mudarData(page, '2026-11-12');
    await expect(page.locator('#s-esc h2')).toBeVisible();
    const depois = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    expect(depois).toBe(antes);
  });
});

test.describe('O trilho no celular', () => {
  for (const largura of [390, 320]) {
    test(`a ${largura} px, o painel de ponta a ponta, com dias de 44 px, sem rolar a página de lado`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      await abrirComExemplo(page);
      await botaoDaData(page).click();
      await expect(trilho(page)).toBeVisible();
      await expect(page.locator('#btn-fixar-trilho')).toBeHidden();
      const painel = await trilho(page).boundingBox();
      expect([painel.x, painel.width]).toEqual([0, largura]);
      const dias = await diasDoCalendario(page).evaluateAll(bs => bs.map(b => b.getBoundingClientRect().toJSON()));
      for (const d of dias) {
        expect(d.width).toBeGreaterThanOrEqual(43.9);
        expect(d.height).toBeGreaterThanOrEqual(43.9);
        expect(d.left).toBeGreaterThanOrEqual(0);
        expect(d.right).toBeLessThanOrEqual(largura);
      }
      // Os dias não se sobrepõem, e os botões do alto também têm 44 px
      for (let i = 1; i < 7; i++) expect(dias[i].left).toBeGreaterThanOrEqual(dias[i - 1].right - 0.5);
      expect(await alvosPequenos(page)).toEqual([]);
      expect(await larguraDaPagina(page)).toBeLessThanOrEqual(largura);
      await page.locator('#btn-fechar-trilho').click();
      await expect(trilho(page)).toBeHidden();
    });
  }
});

test.describe('Os pedidos de cada dia', () => {
  test('o número de pedidos de cada dia (sem os cancelados); acima de 99, "99+"', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    servidor.solicitacoes.push(pedido(1, AMANHA), pedido(2, AMANHA), pedido(3, '2026-11-13'), pedido(4, '2026-11-13', { cancelada_em: '2026-11-10T15:00:00.000Z' }),
      ...Array.from({ length: 100 }, (_, i) => pedido(100 + i, '2026-11-20')));
    await entrar(page, CONTAS.operador);
    await expect(contagemDoDia(page, AMANHA)).toHaveText('2');
    await expect(contagemDoDia(page, '2026-11-13')).toHaveText('1');
    await expect(contagemDoDia(page, '2026-11-12')).toHaveCount(0);
    await expect(contagemDoDia(page, '2026-11-20')).toHaveText('99+');
    await expect(diaDoCalendario(page, AMANHA)).toHaveAccessibleName('quarta-feira, 11 de novembro de 2026, amanhã, data aberta: 2 pedidos');
    await expect(diaDoCalendario(page, '2026-11-20')).toHaveAccessibleName('sexta-feira, 20 de novembro de 2026: 100 pedidos');
  });

  for (const perfil of ['gestor', 'secretaria']) {
    test(`o perfil ${perfil} também vê os números`, async ({ page, context }) => {
      const servidor = await instalarSupabaseFalso(context, comAluno());
      servidor.solicitacoes.push(pedido(1, '2026-11-13'));
      await entrar(page, CONTAS[perfil]);
      await expect(contagemDoDia(page, '2026-11-13')).toHaveText('1');
      await irPara(page, 'age');
      await expect(contagemDoDia(page, '2026-11-13')).toHaveText('1');
    });
  }

  test('antes do login nada é pedido; depois, as semanas à vista uma vez, e de novo só ao mudar o mês, não a cada data', async ({ page, context }) => {
    await instalarSupabaseFalso(context, comAluno());
    const lidas = leiturasDePedidos(page);
    await page.goto(URL_APP);
    await expect(page.locator('#s-login')).toBeVisible();
    await page.waitForTimeout(200);
    expect(lidas).toEqual([]);
    await entrar(page, CONTAS.operador);
    await expect.poll(() => [...lidas].sort()).toEqual(['01/11 a 05/12', '11/11']);
    lidas.length = 0;
    await mudarData(page, '2026-11-12');
    await mudarData(page, '2026-11-13');
    await expect.poll(() => lidas).toContain('13/11');
    expect(lidas.filter(l => l.includes(' a '))).toEqual([]);
    await page.locator('#cal-mes-prox').click();
    await expect.poll(() => lidas.filter(l => l.includes(' a '))).toEqual(['29/11 a 02/01']);
  });

  test('o número da data aberta é o dos pedidos dela, também sem a contagem do mês', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    servidor.solicitacoes.push(pedido(1, AMANHA), pedido(2, AMANHA), pedido(3, AMANHA, { cancelada_em: '2026-11-10T15:00:00.000Z' }), pedido(4, '2026-11-13'));
    await context.route(contagemDoMes, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{' }));
    await entrar(page, CONTAS.operador);
    await expect(contagemDoDia(page, AMANHA)).toHaveText('2');
    await expect(contagemDoDia(page, '2026-11-13')).toHaveCount(0);
  });

  test('a Agenda aberta lê de novo os pedidos da data e a contagem', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    servidor.solicitacoes.push(pedido(1, AMANHA));
    await entrar(page, CONTAS.operador);
    await expect(contagemDoDia(page, AMANHA)).toHaveText('1');
    // Outra pessoa registra
    servidor.solicitacoes.push(pedido(2, AMANHA), pedido(3, '2026-11-13'));
    await irPara(page, 'age');
    await expect(contagemDoDia(page, AMANHA)).toHaveText('2');
    await expect(contagemDoDia(page, '2026-11-13')).toHaveText('1');
  });

  test('a contagem é lida de novo ao abrir o painel e quando uma tecla muda o mês', async ({ page, context }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await instalarSupabaseFalso(context, comAluno());
    const lidas = leiturasDePedidos(page);
    await entrar(page, CONTAS.operador);
    await expect.poll(() => [...lidas].sort()).toEqual(['01/11 a 05/12', '11/11']);
    lidas.length = 0;
    await botaoDaData(page).click();
    await expect.poll(() => lidas).toEqual(['01/11 a 05/12']);
    await expect(diaDoCalendario(page, AMANHA)).toBeFocused();
    await page.keyboard.press('PageDown');
    await expect.poll(() => lidas).toEqual(['01/11 a 05/12', '29/11 a 02/01']);
  });

  // Duas leituras da mesma data: a resposta da mais antiga, chegando por último, não fica no lugar da mais nova
  test('a resposta atrasada de uma leitura anterior dos pedidos da data não vale', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    await entrar(page, CONTAS.operador);
    await irPara(page, 'age');
    await expect(page.locator('#agenda-lista')).toHaveText('Nenhum pedido para esta data.');
    let n = 0, soltar;
    const espera = new Promise(resolve => { soltar = resolve; });
    await context.route(pedidosDoDia(AMANHA), async route => {
      if (n++) { await route.fallback(); return; }
      await espera;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await irPara(page, 'age');
    await expect.poll(() => n).toBe(1);
    servidor.solicitacoes.push(pedido(1, AMANHA));
    await irPara(page, 'age');
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    const atrasada = page.waitForResponse(r => pedidosDoDia(AMANHA)(new URL(r.url())));
    soltar();
    await atrasada;
    await page.waitForTimeout(100);
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
  });

  test('a contagem que não veio deixa os dias sem número', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    servidor.solicitacoes.push(pedido(1, '2026-11-13'));
    await context.route(url => url.pathname.endsWith('/rest/v1/solicitacoes') && url.searchParams.getAll('data').includes('gte.2026-11-01'), route => route.fulfill({ status: 200, contentType: 'application/json', body: '{' }));
    await entrar(page, CONTAS.operador);
    await expect(diaDoCalendario(page, '2026-11-13')).toBeVisible();
    await expect(contagemDoDia(page, '2026-11-13')).toHaveCount(0);
  });
});

test.describe('Os avisos da data', () => {
  test('sem nada a resolver: a frase, e o botão da data sem número', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('#avisos-vazio')).toHaveText('Nada a resolver nesta data.');
    await expect(avisosDaData(page)).toHaveCount(0);
    await expect(page.locator('#avisos-da-data')).toBeHidden();
    await expect(contagemDosAvisos(page)).toBeHidden();
  });

  test('cada item com o horário do voo, o que é e o porquê; o clique leva à tela, com o foco no título; o número está no botão da data', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await aprovar(page);
    await irPara(page, 'rec');
    for (const reg of ['PR-IGU', 'PR-MLB']) await alternarDisponivel(page, reg, false);
    // Dois aviões em manutenção: os voos aprovados deles estão em conflito, na ordem do horário
    const avisos = avisosDaData(page, 'Conflito na escala aprovada');
    await expect(avisos.first()).toBeVisible();
    const n = await avisos.count();
    expect(n).toBeGreaterThan(1);
    const horas = await avisos.locator('time').allTextContents();
    expect(horas).toHaveLength(n);
    expect(horas).toEqual([...horas].sort());
    await expect(avisos.first()).toHaveAttribute('data-gravidade', 'erro');
    await expect(avisos.first().locator('a')).toHaveAccessibleName(/^06:30 2 h Aluno \d+.* Conflito na escala aprovada: .*, erro$/);
    await expect(avisos.first().locator('a')).toHaveAttribute('data-aviso', /^conf:\d+_\d+_1$/);
    await expect(page.locator('#avisos-vazio')).toBeHidden();
    await expect(contagemDosAvisos(page)).toHaveText(new RegExp(`^${await avisosDaData(page).count()}, \\d+ avisos nesta data$`));
    await expect(botaoDaData(page)).toHaveAccessibleName(/amanhã ?, \d+ avisos nesta data$/);
    await avisos.first().locator('a').click();
    await expect(page.locator('#s-esc h2')).toBeFocused();
    await expect(botaoDaAba(page, 'esc')).toHaveAttribute('aria-current', 'page');
  });

  test('enquanto os pedidos da data não chegam, a lista não diz que não há nada a resolver', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    servidor.solicitacoes.push(pedido(1, '2026-11-12'));
    await entrar(page, CONTAS.operador);
    await expect(page.locator('#avisos-vazio')).toBeVisible();
    const soltar = await segurar(context, pedidosDoDia('2026-11-12'));
    await mudarData(page, '2026-11-12');
    await expect(page.locator('#trilho-data')).toHaveText('Quinta-feira · 12 de novembro');
    await expect(page.locator('#avisos-vazio')).toBeHidden();
    soltar();
    await expect(avisosDaData(page)).toHaveText([/1 pedido da agenda ainda não está na demanda/]);
    await expect(page.locator('#avisos-vazio')).toBeHidden();
  });

  test('o foco no aviso sobrevive a um redesenho dos avisos', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    servidor.solicitacoes.push(pedido(1, AMANHA));
    await entrar(page, CONTAS.operador);
    const item = avisosDaData(page, 'ainda não está na demanda').locator('a');
    await item.focus();
    await page.evaluate(async () => {
      const { redesenhar } = await import('./js/redesenho.js');
      redesenhar('pedidos');
    });
    await expect(item).toBeFocused();
  });

  test('os pedidos da agenda: quantos ainda não estão na demanda (só para quem opera), e a leitura que falhou', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAluno());
    servidor.solicitacoes.push(pedido(1, AMANHA), pedido(2, AMANHA));
    await entrar(page, CONTAS.operador);
    await expect(avisosDaData(page)).toHaveText([/—sem horário2 pedidos da agenda ainda não estão na demanda, aviso/]);
    await avisosDaData(page).locator('a').click();
    await expect(page.locator('#s-age h2')).toBeFocused();
    // Enquanto outra data abre, a lista continua a da data aberta; aberta, é a dela
    const liberar = servidor.segurarLeiturasDeDias();
    await diaDoCalendario(page, '2026-11-12').click();
    await expect(page.locator('#trilho-data')).toHaveText('Abrindo quinta-feira, 12/11…');
    await expect(avisosDaData(page)).toHaveCount(1);
    liberar();
    await expect(page.locator('#avisos-vazio')).toBeVisible();
    // A leitura dos pedidos da data que falha
    await context.route(url => url.pathname.endsWith('/rest/v1/solicitacoes') && url.searchParams.getAll('data').join() === 'gte.2026-11-13,lte.2026-11-13', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{' }));
    await diaDoCalendario(page, '2026-11-13').click();
    await expect(avisosDaData(page)).toHaveText([/Não foi possível ler os pedidos desta data\., aviso/]);
  });

  for (const [perfil, href] of [['gestor', '#/rec'], ['secretaria', null]]) {
    test(`o perfil ${perfil} não importa, sem o aviso dos pedidos; o dos aviões ${href ? 'leva a Recursos' : 'fica sem o link, que ele não abre'}`, async ({ page, context }) => {
      const estado = comExemplo(estadoSintetico());
      estado.horas = { ...estado.horas, 'PR-MLB': 49.5 };
      const servidor = await instalarSupabaseFalso(context, documentosAtuais(estado, AMANHA));
      servidor.solicitacoes.push(pedido(1, AMANHA));
      await entrar(page, CONTAS[perfil]);
      const dosAvioes = avisosDaData(page, /avião parado ou perto|aviões parados ou perto/);
      await expect(dosAvioes).toHaveCount(1);
      if (href) await expect(dosAvioes.locator('a')).toHaveAttribute('href', href);
      else await expect(dosAvioes.locator('a')).toHaveCount(0);
      await expect(avisosDaData(page, 'pedido da agenda')).toHaveCount(0);
    });
  }

  test('o que a data não leu está na lista: as horas como erro, sem link', async ({ browser }) => {
    const context = await browser.newContext();
    await prepararContexto(context, { preferencias: false });
    const servidor = await instalarSupabaseFalso(context, comAluno());
    servidor.falhar('/rpc/horas_dos_instrutores');
    const page = await context.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    await entrar(page, CONTAS.operador);
    const horas = avisosDaData(page, 'Não foi possível ler as horas de voo dos instrutores');
    await expect(horas).toHaveAttribute('data-gravidade', 'erro');
    await expect(horas.locator('a')).toHaveCount(0);
    await expect(contagemDosAvisos(page)).toContainText('1 aviso nesta data');
    // "Tentar de novo" (na faixa do alto) lê, e o aviso sai
    await page.locator('#btn-tentar-dados').click();
    await expect(horas).toHaveCount(0);
    expect(erros).toEqual([]);
    await context.close();
  });

  test('no celular, o aviso fecha o painel e leva à tela; os itens têm 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Um instrutor só, sem habilitação para o Multimotor: a missão não entra
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 1)], stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34' })] }) });
    await irPara(page, 'bi');
    await expect(contagemDosAvisos(page)).toBeVisible();
    await botaoDaData(page).click();
    const item = avisosDaData(page, 'Rejeitado').locator('a');
    await expect(item).toBeVisible();
    expect(await alvosPequenos(page)).toEqual([]);
    expect(await larguraDaPagina(page)).toBeLessThanOrEqual(390);
    await item.click();
    await expect(trilho(page)).toBeHidden();
    await expect(page.locator('#s-esc h2')).toBeFocused();
  });
});

test('sem a data no endereço, a Secretaria abre na primeira data que ainda aceita pedidos', async ({ page, context }) => {
  await context.clock.setFixedTime(new Date('2026-11-10T14:00:00-03:00'));
  await instalarSupabaseFalso(context, comAluno());
  await entrar(page, CONTAS.secretaria);
  await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
});

// O login: sem a data e sem o calendário, o cartão no meio da página, e o endereço como a pessoa o abriu
test.describe('No login', () => {
  test('a data e o calendário não aparecem, e o cartão fica no meio da página', async ({ page, context }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await instalarSupabaseFalso(context, comAluno());
    await page.goto(URL_APP);
    const cartao = page.locator('#s-login');
    await expect(cartao).toBeVisible();
    await expect(trilho(page)).toBeHidden();
    await expect(botaoDaData(page)).toBeHidden();
    const { x, width } = await cartao.boundingBox();
    expect(Math.abs(x + width / 2 - 700)).toBeLessThanOrEqual(1);
  });

  test('recarregar o login não escolhe a data: a da Secretaria continua a primeira que aceita pedidos, e a do link, a do link', async ({ page, context }) => {
    await context.clock.setFixedTime(new Date('2026-11-10T14:30:00-03:00'));
    await instalarSupabaseFalso(context, comAluno());
    await page.goto(URL_APP);
    await expect(page.locator('#s-login')).toBeVisible();
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    expect(new URL(page.url()).searchParams.get('data')).toBe(null);
    // Também pelo Voltar e por um endereço digitado
    await page.evaluate(() => { location.hash = '#/alu'; });
    await page.goBack();
    await page.reload();
    await preencherLogin(page, CONTAS.secretaria);
    await expect(page.locator('body[data-pronto]')).toBeAttached();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect(page).toHaveURL(/data=2026-11-12/);
  });

  test('o link com a data continua no endereço durante o login', async ({ page, context }) => {
    await instalarSupabaseFalso(context, comAluno());
    await page.goto(`${URL_APP}&data=2026-11-20`);
    await expect(page.locator('#s-login')).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-data', AMANHA);
    await expect(page).toHaveURL(/data=2026-11-20/);
    await page.reload();
    await preencherLogin(page, CONTAS.operador);
    await expect(page.locator('body[data-pronto]')).toBeAttached();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-20');
  });
});

// Voltar a uma tela que lê o servidor (Minha conta, do Administrador): a data aberta vai para o endereço na hora
test('Voltar com o servidor lento: o endereço já tem a data aberta', async ({ page, context }) => {
  await instalarSupabaseFalso(context, comAluno());
  await entrar(page, CONTAS.administrador);
  await abrirMenuDaConta(page);
  await page.locator('#btn-conta').click();
  await expect(page.locator('#s-conta')).toBeVisible();
  await irPara(page, 'dem');
  await mudarData(page, '2026-11-12');
  let soltar;
  const espera = new Promise(resolve => { soltar = resolve; });
  await context.route(url => url.hostname !== 'localhost' && /\/(rest|functions|auth)\/v1\//.test(url.pathname), async route => { await espera; await route.fallback(); });
  await page.goBack();
  await expect(page.locator('#s-conta')).toBeVisible();
  await expect(page).toHaveURL(/data=2026-11-12#\/conta$/, { timeout: 1000 });
  soltar();
});

test('o link para um domingo abre a segunda, com o aviso', async ({ page }) => {
  await abrir(page, { url: './?data=2026-11-15' });
  await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-16');
  await expect(page.locator('#toast-box')).toContainText('O aeroclube não opera aos domingos: abrimos segunda-feira, 16/11.');
});
