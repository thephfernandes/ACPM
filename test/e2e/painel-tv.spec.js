// A TV da recepção (fase 9): painel.html mostra o mesmo painel de partidas e chegadas da Escala, na tela toda e sem
// botões, com o quadro de hoje e o aluno abreviado. No modo compartilhado, a conta da TV (perfil "painel") só vê o
// quadro, que ela busca de novo a cada minuto.
import { test, expect, prepararContexto, vigiarErros } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { runAllocationEngine } from '../../js/engine.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const HOJE = '2026-11-10';
// Hoje: Maria às 08:20 (atrasada para 08:50) e João às 10:10 (cancelado por "Outro", com um texto que a TV não mostra)
function estado() {
  const e = cenario({
    ins: [instrutor(1, 9), instrutor(2, 9)],
    stu: [aluno(1000, { p1: 500, p2: -1 }, { nm: 'Maria Silva Santos' }), aluno(1001, { p1: 610, p2: -1 }, { nm: 'João' })],
    fStatus: { '1000_0_1': 'Atrasado', '1001_0_1': 'Cancelado' }
  });
  e.fObs = { '1000_0_1': { novoInicio: 530 }, '1001_0_1': { motivo: 'Outro', texto: 'Aluno com febre' } };
  return e;
}
// Os documentos de hoje com a escala gravada (como o operador deixa)
function documentosDeHoje() {
  const e = estado();
  const docs = documentosAtuais(e, HOJE);
  docs.dias[HOJE] = { ...docs.dias[HOJE], fObs: e.fObs, resultado: runAllocationEngine(e) };
  return docs;
}
const linhas = page => page.locator('.fids tbody tr:not(.fids-vazia):not(.fids-nada)');

test.describe('TV da recepção', () => {
  test('neste navegador: o painel de hoje na tela toda, sem botões, com o aluno abreviado e sem o texto do motivo', async ({ page }) => {
    const { documentos, dias } = documentosDeHoje();
    await page.addInitScript(([cadastro, dia]) => {
      localStorage.setItem('acpm4_cadastro', cadastro);
      localStorage.setItem('acpm4_dia_2026-11-10', dia);
    }, [JSON.stringify(documentos.cadastro), JSON.stringify(dias[HOJE])]);
    await page.goto('./painel.html');
    await expect(page.locator('.fids .fids-titulo')).toHaveText('Partidas');
    await expect(linhas(page).locator('.f-aluno')).toHaveText(['Maria S.', 'João']);
    await expect(linhas(page).locator('.f-obs')).toHaveText(['Atrasado', 'Cancelado · Outro']);
    await expect(linhas(page).first().locator('.f-prev')).toHaveText('08:50');
    await expect(page.locator('[data-fids]')).toHaveCount(0);
    const caixa = await page.locator('.fids').boundingBox();
    const tela = page.viewportSize();
    expect(caixa.width).toBeGreaterThanOrEqual(tela.width - 1);
    expect(caixa.height).toBeGreaterThanOrEqual(tela.height - 1);
  });

  test('sem a escala de hoje gravada, o painel avisa', async ({ page }) => {
    await page.goto('./painel.html');
    await expect(page.locator('.fids .fids-nada')).toHaveText('A escala de hoje ainda não foi publicada.');
  });

  test('a conta da TV entra pela própria página, vê o quadro e o atualiza a cada minuto', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(context);
    const servidor = await instalarSupabaseFalso(context, documentosDeHoje());
    const page = await context.newPage();
    const erros = vigiarErros(page);
    await page.clock.install({ time: new Date('2026-11-10T12:00:00-03:00') });
    await page.goto('./painel.html?supabase=teste');
    await page.locator('#login-email').fill(CONTAS.painel.email);
    await page.locator('#login-senha').fill(CONTAS.painel.senha);
    await page.locator('#btn-entrar').click();
    await expect(linhas(page).locator('.f-aluno')).toHaveText(['Maria S.', 'João']);
    await expect(page.locator('.fids .fids-aviso')).toHaveText('');

    // O operador muda um status: a TV mostra na próxima busca
    const dia = structuredClone(servidor.dias.get(HOJE).conteudo);
    dia.fStatus['1000_0_1'] = 'Em Voo';
    delete dia.fObs['1000_0_1'];
    servidor.alterarDiaPorOutraPessoa(HOJE, dia);
    await page.clock.runFor(60_000);
    await expect(linhas(page).first().locator('.f-obs')).toHaveText('Em voo');
    expect(erros).toEqual([]);
    await context.close();
  });

  test('a conta da TV que abre o app vai direto para o painel; o app não fica conectado com ela', async ({ browser }) => {
    const { context, page, erros } = await novaTV(browser);
    await page.goto('./?supabase=teste');
    await entrar(page, CONTAS.painel);
    await expect(page).toHaveURL(/painel\.html\?supabase=teste$/);
    await expect(linhas(page).locator('.f-aluno')).toHaveText(['Maria S.', 'João']);
    await page.goto('./?supabase=teste');
    await expect(page.locator('#form-login')).toBeVisible();
    expect(erros).toEqual([]);
    await context.close();
  });

  // Revisão de 14/11: a TV fica numa tela pública. Ela só aceita a conta da TV e guarda a sessão numa chave só dela: quem
  // usar a TV não abre o app com a conta de outra pessoa
  test('outra conta não entra na TV: a página pede a conta da TV', async ({ browser }) => {
    const { context, page, erros } = await novaTV(browser);
    await page.goto('./painel.html?supabase=teste');
    await entrar(page, CONTAS.operador);
    await expect(page.locator('#login-erro')).toHaveText('Esta conta não é a da TV. Entre com a conta da TV (perfil Painel).');
    await expect(page.locator('#quadro')).toBeHidden();
    await page.reload();
    await expect(page.locator('#form-login')).toBeVisible();
    await entrar(page, CONTAS.painel);
    await expect(linhas(page).locator('.f-aluno')).toHaveText(['Maria S.', 'João']);
    expect(erros).toEqual([]);
    await context.close();
  });

  test('a sessão do app não vale na TV, e a da TV não abre o app', async ({ browser }) => {
    const { context, page, erros } = await novaTV(browser);
    await page.goto('./?supabase=teste');
    await entrar(page, CONTAS.operador);
    await expect(page.locator('#usuario')).toContainText(CONTAS.operador.nome);
    await page.goto('./painel.html?supabase=teste');
    await expect(page.locator('#form-login')).toBeVisible();
    await entrar(page, CONTAS.painel);
    await expect(linhas(page)).toHaveCount(2);
    // O app continua com a conta do operador
    await page.goto('./?supabase=teste');
    await expect(page.locator('#usuario')).toContainText(CONTAS.operador.nome);
    expect(erros).toEqual([]);
    await context.close();
  });

  test('a TV que entrou antes desta versão (com a sessão na chave do app) continua conectada', async ({ browser }) => {
    const { context, page, erros } = await novaTV(browser);
    await page.goto('./painel.html?supabase=teste');
    await entrar(page, CONTAS.painel);
    await expect(linhas(page)).toHaveCount(2);
    // Como a versão anterior guardava: na chave do app
    await page.evaluate(() => {
      localStorage.setItem('acpm-teste', localStorage.getItem('acpm-teste-painel'));
      localStorage.removeItem('acpm-teste-painel');
    });
    await page.reload();
    await expect(linhas(page)).toHaveCount(2);
    await page.goto('./?supabase=teste');
    await expect(page.locator('#form-login')).toBeVisible();
    expect(erros).toEqual([]);
    await context.close();
  });
});

async function novaTV(browser) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await prepararContexto(context);
  await instalarSupabaseFalso(context, documentosDeHoje());
  const page = await context.newPage();
  return { context, page, erros: vigiarErros(page) };
}

async function entrar(page, conta) {
  await page.locator('#login-email').fill(conta.email);
  await page.locator('#login-senha').fill(conta.senha);
  await page.locator('#btn-entrar').click();
}
