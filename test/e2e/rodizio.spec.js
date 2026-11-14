// Aba Rodízio: as filas de cada categoria, os botões para ajustar a ordem e o efeito na escala.
import { test, expect, abrir, irPara, abrirEscala, lerEscala } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const doC172 = id => instrutor(id, 1, { hab: ['local', 'noturno', 'c172'] });
const instrutorDoVoo = async page => (await lerEscala(page)).linhas.find(l => l.includes('Aluno 1000'));

test.describe('Rodízio', () => {
  test('mostra as filas, ajusta a ordem e a escala segue a fila', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [doC172(1), doC172(2), instrutor(3, 1)], stu: [aluno(1000, { eq: 'C172' })] }) });
    await irPara(page, 'rod');
    const filaC172 = page.locator('#rodizio [data-cat="c172"] li');
    await expect(filaC172).toHaveCount(2, { timeout: 2000 });
    await expect(filaC172.nth(0)).toContainText('Instrutor 01');
    await expect(page.locator('#rodizio [data-cat="noturno"] li')).toHaveCount(2);
    await expect(page.locator('#rodizio [data-cat="cheque"]')).toContainText('Nenhum instrutor habilitado');

    await abrirEscala(page);
    expect(await instrutorDoVoo(page)).toContain('| Instrutor 01 |');
    await irPara(page, 'rod');
    await expect(filaC172.nth(0)).toContainText('1 voo nesta data');

    await filaC172.nth(1).locator('[data-act="fila-subir"]').click();
    await expect(filaC172.nth(0)).toContainText('Instrutor 02');
    await expect(page.locator('#audit-log-list')).toContainText('Rodízio · Voo C172: Instrutor 02 passou para 1º');
    await irPara(page, 'esc');
    expect(await instrutorDoVoo(page)).toContain('| Instrutor 02 |');
  });

  test('compacto: os botões aparecem com o mouse ou o foco e a explicação leva ao Manual', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [doC172(1), doC172(2)] }) });
    await irPara(page, 'rod');
    const segundo = page.locator('#rodizio [data-cat="c172"] li').nth(1);
    const opacidade = () => segundo.locator('.acoes').evaluate(el => getComputedStyle(el).opacity);
    await page.mouse.move(0, 0);
    expect(await opacidade()).toBe('0');
    await segundo.hover();
    await expect.poll(opacidade).toBe('1');
    await expect(segundo.locator('[data-act="fila-inicio"]')).toHaveAttribute('aria-label', 'Pôr Instrutor 02 no início da fila');

    await page.locator('#s-rod [data-manual="manual-aba-rodizio"]').click();
    await expect(page.locator('#s-manual')).toBeVisible();
    await expect(page.locator('#manual-aba-rodizio')).toBeInViewport();
  });
});

// Revisão de 14/11: o voo cancelado não voa e não conta nos contadores da data
test('o voo cancelado não conta no Rodízio, nos Recursos nem nos Instrutores', async ({ page }) => {
  const estado = {
    ...cenario({ ins: [doC172(1), doC172(2)], stu: [aluno(1000, { eq: 'C172', p1: 390, p2: -1 })] }),
    fixos: { '1000_0_1': { a: 390, b: 450, r: 'PP-ABP', insId: 1 } }, fStatus: { '1000_0_1': 'Cancelado' },
    aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Rayane' }
  };
  await abrir(page, { estado });
  await irPara(page, 'rod');
  await expect(page.locator('#rodizio [data-cat="c172"] li').nth(0)).toContainText('Instrutor 01');
  await expect(page.locator('#rodizio')).not.toContainText('voo nesta data');
  await irPara(page, 'rec');
  await expect(page.locator('#hangar li[data-id="PP-ABP"]')).not.toContainText('voo nesta data');
  await irPara(page, 'ins');
  await expect(page.locator('#inst-dia tr[data-id="1"] td.voos')).toHaveText('');
});
