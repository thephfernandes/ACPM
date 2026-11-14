// O dia de operação (fase 12): "Aprovar escala" fixa os voos. Depois disso, uma alteração não tira ninguém do lugar:
// o pedido novo entra em volta, e o voo fixo que ficou impossível aparece em conflito. "Reabrir" volta ao normal.
// Em Voo e Atrasado também fixam o voo.
import { test, expect, abrir, irPara, abrirEscala, lerEscala } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const dia = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 }), aluno(1002, { fly: false, p1: 390, p2: -1 })] });
const linhas = async page => (await lerEscala(page)).linhas.filter(l => l.includes('Aluno 100'));
const confirmar = async (page, botao) => { await botao.click(); await expect(botao).toHaveText(/^Confirmar/); await botao.click(); };

test.describe('Escala aprovada', () => {
  test('aprovar fixa os voos: o selo diz quando e quem; um pedido novo de prioridade 5 não tira ninguém do lugar; reabrir volta ao normal', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirEscala(page);
    const antes = await linhas(page);
    await confirmar(page, page.locator('#btn-aprovar'));
    await expect(page.locator('#selo-aprovada')).toHaveText('Aprovada às 12:00');
    await expect(page.locator('#out tbody tr:not(.win) .fixo')).toHaveCount(2);

    // Pedido novo, prioridade 5, no mesmo horário do primeiro voo
    await irPara(page, 'dem');
    await page.locator('#onlyfly').uncheck();
    const novo = page.locator('#dem tr[data-id="1002"]');
    await novo.locator('[data-f="fly"]').check();
    await novo.locator('[data-f="pr"]').selectOption('5');
    await abrirEscala(page);
    const depois = await linhas(page);
    for (const linha of antes) expect(depois).toContain(linha);
    expect(depois.some(l => l.includes('Aluno 1002'))).toBe(true);

    await page.locator('#btn-open-log').click();
    await expect(page.locator('#historico')).toContainText('Escala aprovada: 2 voos fixados');
    await page.keyboard.press('Escape');
    await confirmar(page, page.locator('#btn-reabrir'));
    await expect(page.locator('#selo-aprovada')).toBeHidden();
    await expect(page.locator('#btn-aprovar')).toBeVisible();
    await expect(page.locator('#out tbody tr:not(.win) .fixo')).toHaveCount(0);
  });

  test('o instrutor que não vem mais: o voo fixo dele fica no lugar, em conflito', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirEscala(page);
    await confirmar(page, page.locator('#btn-aprovar'));
    const primeiro = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });
    const instrutor = (await primeiro.locator('.c-instr').innerText()).trim();
    const id = instrutor.endsWith('01') ? 1 : 2;
    await irPara(page, 'ins');
    await page.locator(`#inst-dia tr[data-id="${id}"] [data-f="on"]`).uncheck();
    await abrirEscala(page);
    const conflitos = page.locator('#out details.caixa.conflitos');
    await expect(conflitos).toHaveAttribute('open', '');
    await expect(conflitos.locator('summary')).toHaveText('1 voo em conflito na escala aprovada');
    await expect(conflitos).toContainText('o instrutor não está disponível');
    await expect(primeiro).toHaveClass(/\bem-conflito\b/);
    await expect(primeiro.locator('.c-instr')).toHaveText(instrutor);
  });

  test('Em Voo fixa o voo mesmo sem aprovar', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirEscala(page);
    const primeiro = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });
    await primeiro.locator('.st-sel').selectOption('Em Voo');
    await expect(primeiro.locator('.fixo')).toHaveCount(1);
    await expect(page.locator('#out tbody tr:not(.win) .fixo')).toHaveCount(1);
  });

  test('no Gestor, o selo aparece e os botões não', async ({ page }) => {
    const estado = { ...dia(), fixos: { '1000_0_1': { a: 390, b: 450, r: 'PP-LJV', insId: 1 } }, aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Rayane' } };
    await abrir(page, { estado, url: './?role=gestor' });
    await abrirEscala(page);
    await expect(page.locator('#selo-aprovada')).toHaveText('Aprovada às 18:05 por Rayane');
    await expect(page.locator('#btn-reabrir')).toBeHidden();
  });
});
