// Ordem dos aviões no hangar (fase 10): em Recursos, da frente para o fundo, com subir, descer e pôr na frente. A
// escala tira primeiro os da frente e junta os voos nos aviões que já saíram; a data seguinte começa com a mesma ordem.
import { test, expect, abrir, irPara, abrirEscala } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const posicoes = page => page.locator('#hangar li').evaluateAll(lis => lis.map(li => li.dataset.id));

test.describe('Ordem no hangar', () => {
  test('pôr um avião na frente: o primeiro voo do dia sai nele; o histórico registra; a data seguinte começa igual', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 610, p2: -1 })] }) });
    await irPara(page, 'rec');
    const antes = await posicoes(page);
    expect(antes[0]).toBe('PP-LJV');
    expect(antes).not.toContain('SIM-MONO-A');
    await page.locator('#hangar li[data-id="PR-VOB"] [data-act="hangar-frente"]').click();
    expect((await posicoes(page))[0]).toBe('PR-VOB');
    await page.locator('#hangar li[data-id="PR-VOB"] [data-act="hangar-descer"]').click();
    await page.locator('#hangar li[data-id="PR-VOB"] [data-act="hangar-subir"]').click();
    expect((await posicoes(page)).slice(0, 2)).toEqual(['PR-VOB', 'PP-LJV']);
    await expect(page.locator('#hangar li[data-id="PR-VOB"]')).toContainText('2 voos nesta data');

    await abrirEscala(page);
    const recursos = await page.locator('#out tbody tr:not(.win) .c-aviao').allTextContents();
    expect(recursos.map(t => t.trim().split(/\s+/)[0])).toEqual(['PR-VOB', 'PR-VOB']);
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#historico')).toContainText('Hangar: PR-VOB passou para 1º');

    await page.locator('#dt-prox').click();
    await irPara(page, 'rec');
    expect((await posicoes(page))[0]).toBe('PR-VOB');
  });
});
