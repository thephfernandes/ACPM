// Ordem dos aviões no hangar: em Recursos, da frente para o fundo, com subir, descer e pôr na frente. A escala tira
// primeiro os da frente e junta os voos nos aviões que já saíram; a data seguinte começa com a mesma ordem.
import { test, expect, abrir, irPara, abrirEscala, filtrarCategorias, abrirHistorico, diaSeguinte } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

// Com o hangar ligado (desligado: funcionalidades.spec.js)
test.use({ funcionalidades: 'hangar' });

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
    await abrirHistorico(page);
    await expect(page.locator('#historico')).toContainText('Hangar: PR-VOB passou para 1º');

    await diaSeguinte(page);
    await irPara(page, 'rec');
    expect((await posicoes(page))[0]).toBe('PR-VOB');
  });

  // A busca e as categorias de Recursos não valem no hangar: ele mostra sempre todos os aviões (fica ao lado da tabela
  // filtrada), e Subir troca o avião com o vizinho da lista inteira, também com o que os filtros escondem na tabela
  test('os filtros de Recursos não valem no hangar: todos os aviões continuam, e Subir troca com o vizinho da lista inteira', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await irPara(page, 'rec');
    const antes = await posicoes(page);
    await filtrarCategorias(page, ['PA-34']);
    await page.locator('#flt-rec-mat').fill('vom');
    await expect(page.locator('#revisao tr[data-r]')).toHaveCount(1);
    await expect(page.locator('#rec-contagem')).toHaveText('1 de 27 recursos');
    expect(await posicoes(page)).toEqual(antes);
    // O PR-VOM (PA-34) sobe um lugar: troca com o PR-VOY, um C172 que a tabela filtrada não mostra
    const i = antes.indexOf('PR-VOM');
    expect(antes[i - 1]).toBe('PR-VOY');
    await page.locator('#hangar li[data-id="PR-VOM"] [data-act="hangar-subir"]').click();
    const depois = [...antes];
    [depois[i - 1], depois[i]] = ['PR-VOM', 'PR-VOY'];
    await expect.poll(() => posicoes(page)).toEqual(depois);
    await expect(page.locator('#hangar li[data-id="PR-VOM"] .pos')).toHaveText(`${i}º`);
  });
});
