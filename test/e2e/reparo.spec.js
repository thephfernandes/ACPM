// Sugestões para um conflito (fase 12): o botão "Sugestões" da caixa de conflitos abre uma gaveta com o que pode voar
// no lugar do voo fixo; "Aplicar" muda o voo (que continua fixo) e o histórico desfaz. Cancelar pede o motivo, como no
// status, já com o motivo do conflito marcado
import { test, expect, abrir, irPara, abrirEscala, confirmar } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const dia = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] });
const linha = (page, nome) => page.locator('#out tbody tr:not(.win)', { hasText: nome });
const gaveta = page => page.locator('#painel-reparo');

// Aprova a escala e tira o instrutor do voo do aluno 1000; devolve o nome dele e o do outro
async function aprovarETirarOInstrutor(page, url) {
  await abrir(page, { estado: dia(), url });
  await abrirEscala(page);
  await confirmar(page, '#btn-aprovar');
  const instrutor = (await linha(page, 'Aluno 1000').locator('.c-instr').innerText()).trim();
  const id = instrutor.endsWith('01') ? 1 : 2;
  await irPara(page, 'ins');
  await page.locator(`#inst-dia tr[data-id="${id}"] [data-f="on"]`).uncheck();
  await abrirEscala(page);
  return { instrutor, outro: id === 1 ? 'Instrutor 02' : 'Instrutor 01' };
}

test.describe('Sugestões para um conflito', () => {
  test('troca o instrutor que não vem mais; o voo continua fixo e o histórico desfaz', async ({ page }) => {
    const { instrutor, outro } = await aprovarETirarOInstrutor(page);
    await page.locator('#out details.conflitos [data-reparo]').click();
    await expect(gaveta(page)).toBeVisible();
    await expect(gaveta(page).locator('h2')).toContainText('Aluno 1000');
    await expect(gaveta(page)).toContainText('o instrutor não está disponível');
    const primeira = gaveta(page).locator('.opcoes-reparo li').first();
    await expect(primeira).toContainText(`Trocar o instrutor: ${outro}`);
    await primeira.getByRole('button', { name: 'Aplicar' }).click();
    await expect(gaveta(page)).toBeHidden();
    await expect(page.locator('#out details.conflitos')).toHaveCount(0);
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText(outro);
    await expect(linha(page, 'Aluno 1000').locator('.fixo')).toHaveCount(1);

    await page.locator('#btn-open-log').click();
    await expect(page.locator('#audit-log-list')).toContainText(`Reparo: Aluno 1000 (06:30–07:30): Trocar o instrutor: ${outro}`);
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await page.keyboard.press('Escape');
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText(instrutor);
    await expect(page.locator('#out details.conflitos')).toHaveCount(1);
  });

  test('cancelar pede o motivo, já marcado; o conflito some', async ({ page }) => {
    await aprovarETirarOInstrutor(page);
    await page.locator('#out details.conflitos [data-reparo]').click();
    const cancelar = gaveta(page).locator('.opcoes-reparo li').last();
    await expect(cancelar).toContainText('Motivo: Instrutor indisponível');
    await cancelar.getByRole('button', { name: 'Cancelar o voo' }).click();
    await expect(gaveta(page)).toBeHidden();
    const dialogo = page.locator('#dlg-status');
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByLabel('Instrutor indisponível')).toBeChecked();
    await dialogo.getByRole('button', { name: 'Confirmar' }).click();
    await expect(linha(page, 'Aluno 1000')).toHaveClass(/\bst-Cancelado\b/);
    await expect(page.locator('#out details.conflitos')).toHaveCount(0);
  });

  test('Esc fecha a gaveta e devolve o foco ao botão', async ({ page }) => {
    await aprovarETirarOInstrutor(page);
    const botao = page.locator('#out details.conflitos [data-reparo]');
    await botao.click();
    await expect(gaveta(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(gaveta(page)).toBeHidden();
    await expect(botao).toBeFocused();
  });

  test('no Gestor, a caixa de conflitos aparece sem o botão Sugestões', async ({ page }) => {
    const estado = { ...dia(), ins: [instrutor(1, 9, { on: false }), instrutor(2, 9)], fixos: { '1000_0_1': { a: 390, b: 450, r: 'PP-LJV', insId: 1 } }, aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Rayane' } };
    await abrir(page, { estado, url: './?role=gestor' });
    await abrirEscala(page);
    await expect(page.locator('#out details.conflitos')).toContainText('o instrutor não está disponível');
    await expect(page.locator('#out details.conflitos [data-reparo]')).toHaveCount(1);
    await expect(page.locator('#out details.conflitos [data-reparo]')).toBeHidden();
  });
});
