// Limites dos instrutores pela Lei do Aeronauta (fase 11): as horas de voo do mês na disponibilidade do dia, as horas
// de fora do app no painel do instrutor e os limites (só o Administrador muda; neste navegador, o Operador).
import { test, expect, abrir, irPara, abrirEscala } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const umInstrutorDoisVoos = () => cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 610, p2: -1 })] });

test.describe('Limites da lei', () => {
  test('a disponibilidade do dia mostra as horas de voo do mês; as de fora do app entram pelo painel do instrutor', async ({ page }) => {
    await abrir(page, { estado: umInstrutorDoisVoos() });
    await irPara(page, 'ins');
    await expect(page.locator('#inst-dia-cab th')).toContainText(['Mês']);
    const mes = page.locator('#inst-dia tr[data-id="1"] td.mes');
    await expect(mes).toHaveText('2 h');

    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await page.locator('#inst [data-act="editar-habs"]').first().click();
    const painel = page.locator('#painel-instrutor');
    await expect(painel.locator('.horas-ins')).toContainText('No mês: 2 h de 100 h');
    await painel.getByLabel('Fora do app, neste mês').fill('88');
    await painel.getByLabel('Fora do app, neste mês').dispatchEvent('change');
    await expect(painel.locator('.horas-ins')).toContainText('No mês: 90 h de 100 h');
    await page.keyboard.press('Escape');
    await page.locator('#s-ins [data-vista-ins="dia"]').click();
    await expect(mes).toHaveText('90 h');
    await expect(mes).toHaveClass(/\bperto\b/);

    await abrirEscala(page);
    await expect(page.locator('#out details.caixa.avisos summary')).toContainText('1 instrutor perto do limite da lei');
  });

  test('o limite do mês mudado vale na hora: a segunda missão do instrutor fica de fora', async ({ page }) => {
    await abrir(page, { estado: umInstrutorDoisVoos() });
    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    const limites = page.locator('#limites-lei');
    await expect(limites.locator('h3')).toHaveText('Limites da Lei do Aeronauta');
    await expect(limites.getByLabel('Voo no mês (h)')).toHaveValue('100');
    await expect(limites.getByLabel('Voo no semestre (h)')).toHaveValue('');
    await limites.getByLabel('Voo no mês (h)').fill('1');
    await limites.getByLabel('Voo no mês (h)').dispatchEvent('change');
    await abrirEscala(page);
    await expect(page.locator('#out details.caixa.erros')).toContainText('nenhum instrutor dentro dos limites da Lei do Aeronauta');
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#historico')).toContainText('Limites da lei: voo no mês 100 h → 1 h');

    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await limites.getByRole('button', { name: 'Voltar aos valores da lei' }).click();
    await expect(limites.getByLabel('Voo no mês (h)')).toHaveValue('100');
  });

  test('no Gestor, os limites só se leem', async ({ page }) => {
    await abrir(page, { estado: umInstrutorDoisVoos(), url: './?role=gestor' });
    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await expect(page.locator('#limites-lei').getByLabel('Voo no mês (h)')).toBeDisabled();
  });
});
