import {
  test, expect, abrirSintetico, abrirComExemplo, irPara, abrirEscala, lerEscala, prepararContexto, vigiarErros
} from './fixtures.js';

test.describe('Perfis de acesso', () => {
  test('perfil Gestor oculta a edição e o Operador a restaura', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);

    await page.locator('#role-sel').selectOption('gestor');
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    await expect(page.locator('#out [data-act="rm-fly"]').first()).toBeHidden();
    await expect(page.locator('#dt')).toBeDisabled();
    await expect(page.locator('#out .st-sel').first()).toBeDisabled();
    await irPara(page, 'ins');
    await expect(page.locator('[data-act="addi"]')).toBeHidden();
    // A grade do dia fica travada e as habilitações não abrem (o Gestor vê o resumo)
    expect(await page.locator('#inst-dia .cel').first().evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await expect(page.locator('#inst [data-act="editar-habs"]').first()).toBeHidden();
    await expect(page.locator('#inst .habs-resumo').first()).toBeVisible();

    await page.locator('#role-sel').selectOption('operador');
    await expect(page.locator('[data-act="addi"]')).toBeVisible();
    await expect(page.locator('#dt')).toBeEnabled();
  });

  test('?role=gestor abre no Gestor sem travar o seletor', async ({ page }) => {
    await abrirSintetico(page, { url: './?role=gestor' });
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    await expect(page.locator('#role-sel')).toBeEnabled();
    await expect(page.locator('#role-sel')).toHaveValue('gestor');
  });

  test('link compartilhado abre travado no Gestor com a mesma escala', async ({ page, browser }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const escalaOperador = await lerEscala(page);

    await page.locator('#btn-share-link').click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\?role=gestor&share=/);

    const contexto = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    const gestor = await contexto.newPage();
    const erros = vigiarErros(gestor);
    await gestor.goto(link);

    await expect(gestor.locator('#s-esc')).toBeVisible();
    await expect(gestor.locator('body')).toHaveAttribute('data-shared', 'true');
    await expect(gestor.locator('#role-sel')).toBeDisabled();
    await expect(gestor.locator('#role-sel option')).toHaveText(['Gestor (somente leitura)']);
    expect(await lerEscala(gestor)).toEqual(escalaOperador);
    expect(erros).toEqual([]);
    await contexto.close();
  });
});
