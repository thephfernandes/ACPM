import { test, expect, prepararContexto, vigiarErros, irPara, confirmar, AMANHA, abrirMenuDaConta } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';

const comDados = () => documentosAtuais(estadoSintetico(), AMANHA);

// Em localhost, ?supabase=teste liga o app ao servidor Supabase falso (supabase-falso.js)
const URL_APP = './?supabase=teste';

async function entrar(page, conta) {
  await page.locator('#login-email').fill(conta.email);
  await page.locator('#login-senha').fill(conta.senha);
  await page.locator('#btn-entrar').click();
}

test.describe('Login e perfis (modo compartilhado)', () => {
  test('sem sessão, mostra só o login', async ({ page, context }) => {
    await instalarSupabaseFalso(context);
    await page.goto(URL_APP);
    await expect(page.locator('#form-login')).toBeVisible();
    await expect(page.locator('#nav')).toBeHidden();
    await expect(page.locator('#s-rec')).toBeHidden();
    await expect(page.locator('#btn-share-link')).toBeHidden();
  });

  test('senha errada mostra o aviso e continua no login', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    await instalarSupabaseFalso(contexto);
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [400] });
    await page.goto(URL_APP);
    await entrar(page, { ...CONTAS.operador, senha: 'senha-errada' });
    await expect(page.locator('#login-erro')).toHaveText('E-mail ou senha incorretos.');
    await expect(page.locator('#form-login')).toBeVisible();
    await expect(page.locator('#nav')).toBeHidden();
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('operador entra, vê os dados do banco e as alterações são gravadas com a versão lida', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comDados());
    await page.goto(URL_APP);
    await entrar(page, CONTAS.operador);
    await expect(page.locator('#s-esc')).toBeVisible();
    await expect(page.locator('#usuario')).toHaveText('Operador de Teste · Operador');
    await expect(page.locator('#inst .cd')).toHaveCount(40);
    await expect(page.locator('#role-sel')).toBeHidden();

    await irPara(page, 'alu');
    await page.locator('[data-act="adds"]').click();
    await expect.poll(() => servidor.banco.get('cadastro').conteudo.stu.length).toBe(1);
    // O dia sai depois do cadastro (revisão de 14/11)
    await expect.poll(() => servidor.gravacoes.find(g => g.chave === `dia:${AMANHA}`)).toEqual({ chave: `dia:${AMANHA}`, versaoLida: 1, por: CONTAS.operador.email });
    await expect.poll(() => servidor.historico.map(h => [h.data, h.autor])).toContainEqual([AMANHA, 'Operador de Teste']);
  });

  test('gestor entra somente para leitura e nada é gravado', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comDados());
    await page.goto(URL_APP);
    await entrar(page, CONTAS.gestor);
    await expect(page.locator('#usuario')).toHaveText('Gestor de Teste · Gestor');
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    await expect(page.locator('#inst .cd')).toHaveCount(40);
    await irPara(page, 'dem');
    await expect(page.locator('#clr')).toBeHidden();
    await irPara(page, 'ins');
    await expect(page.locator('[data-act="addi"]')).toBeHidden();
    expect(servidor.gravacoes).toEqual([]);
  });

  test('conta sem perfil vê o aviso e pode sair', async ({ page, context }) => {
    await instalarSupabaseFalso(context);
    await page.goto(URL_APP);
    await entrar(page, CONTAS.semPerfil);
    await expect(page.locator('#sem-acesso')).toBeVisible();
    await expect(page.locator('#sem-acesso')).toContainText(CONTAS.semPerfil.email);
    await expect(page.locator('#form-login')).toBeHidden();
    await expect(page.locator('#nav')).toBeHidden();
    await page.locator('#btn-sair-sem-acesso').click();
    await expect(page.locator('#form-login')).toBeVisible();
  });

  test('a sessão continua depois de recarregar e "Sair" volta para o login (só neste navegador)', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comDados());
    await page.goto(URL_APP);
    await entrar(page, CONTAS.operador);
    await expect(page.locator('#usuario')).toBeVisible();
    await page.reload();
    await expect(page.locator('#usuario')).toHaveText('Operador de Teste · Operador');
    await expect(page.locator('#form-login')).toBeHidden();
    await abrirMenuDaConta(page);
    await page.locator('#btn-sair').click();
    await expect(page.locator('#form-login')).toBeVisible();
    expect(servidor.saidas, 'as sessões em outros aparelhos continuam').toEqual(['local']);
    await page.reload();
    await expect(page.locator('#form-login')).toBeVisible();
  });
});
