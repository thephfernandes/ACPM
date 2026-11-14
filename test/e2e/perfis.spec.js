import { test, expect, abrirSintetico, abrirComExemplo, irPara, abrirEscala, AMANHA } from './fixtures.js';

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

  // Revisão de 14/11: o link que levava a escala inteira no endereço (nomes, pesos e horas) saiu. Sem o servidor, a
  // escala fica só neste navegador; no app publicado, o link leva só a data (test/e2e/compartilhado.spec.js)
  test('neste navegador (sem servidor), Compartilhar explica que o link da escala é do app publicado', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await page.evaluate(() => navigator.clipboard.writeText('nada copiado'));
    await page.locator('#btn-share-link').click();
    await expect(page.locator('#toast-box')).toContainText('Sem o servidor, a escala fica só neste navegador: o link da escala é do app publicado, com login.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('nada copiado');
  });

  test('um link antigo com a escala no endereço (share=) avisa que não vale mais; o app abre com os dados deste navegador', async ({ page }) => {
    const payload = { d: '2026-11-12', fly: [[1000, 'Aluno do Link', 70, [], 1, 'Voo Local', 'C152', 1, 2, 1, 1, 3, []]] };
    const share = encodeURIComponent(Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'));
    await abrirComExemplo(page, { url: `./?role=gestor&share=${share}` });
    await expect(page.locator('#aviso-link-texto')).toHaveText(AVISO_DO_LINK_ANTIGO);
    await expect(page.locator('body')).not.toHaveAttribute('data-shared', 'true');
    await expect(page.locator('#role-sel')).toBeEnabled();
    await expect(page.locator('#dt')).toHaveValue(AMANHA);
    await abrirEscala(page);
    await expect(page.locator('#out')).not.toContainText('Aluno do Link');
    expect(new URL(page.url()).searchParams.has('share')).toBe(false);
    await page.locator('#btn-fechar-aviso-link').click();
    await expect(page.locator('#aviso-link')).toBeHidden();
  });
});

const AVISO_DO_LINK_ANTIGO = 'Este link antigo levava a escala no próprio endereço e não vale mais. Peça um link novo a quem compartilhou.';
