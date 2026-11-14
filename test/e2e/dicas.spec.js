// As dicas (revisão de 14/11): o balão que explica um termo da tela. Abre com o mouse parado no termo (depois de um
// instante), na hora com o foco do teclado, e num toque no "?" ou na etiqueta; Esc, um toque fora e sair do termo
// fecham. O texto vem do glossário.
import { test, expect, abrir, abrirEscala } from './fixtures.js';
import { aluno, cenario, instrutor, apenas } from '../helpers/montar.js';
import { GLOSSARIO } from '../../js/glossario.js';

// Um avião e um instrutor: o segundo aluno fica no horário livre mais perto da preferência
const diaComHorarioLivre = () => cenario({
  ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1, pr: 5 }), aluno(1001, { p1: 390, p2: -1 })], semAeronaves: apenas('C152', 'PP-LJV')
});
const dica = page => page.locator('#dica');
const etiqueta = page => page.locator('#out [data-dica="horario-livre"]').first();

test.describe('Dicas dos termos', () => {
  test('o mouse parado no termo abre a dica depois de um instante; sair dele fecha', async ({ page }) => {
    await abrir(page, { estado: diaComHorarioLivre() });
    await abrirEscala(page);
    await etiqueta(page).hover();
    await expect(dica(page)).toBeHidden();
    await expect(dica(page)).toBeVisible();
    await expect(dica(page)).toHaveText(`Horário livre ${GLOSSARIO['horario-livre'].texto}`);
    await expect(dica(page)).toHaveAttribute('role', 'tooltip');
    await page.mouse.move(0, 0);
    await expect(dica(page)).toBeHidden();
  });

  test('pelo teclado: o foco no "?" abre na hora, Enter não fecha, Esc fecha e o foco fica', async ({ page }) => {
    await abrir(page, { estado: diaComHorarioLivre() });
    await abrirEscala(page);
    const botao = page.locator('#criterios .dica-btn[data-dica="buracos"]');
    await botao.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(botao).toBeFocused();
    await expect(dica(page)).toBeVisible();
    await expect(dica(page)).toContainText(GLOSSARIO.buracos.texto);
    await page.keyboard.press('Enter');
    await expect(dica(page)).toBeVisible();
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(dica(page)).toBeHidden();
    await expect(botao).toBeFocused();
    await expect(botao).toHaveAttribute('aria-expanded', 'false');
  });

  test('para os leitores de tela, o termo aponta para o texto do glossário', async ({ page }) => {
    await abrir(page, { estado: diaComHorarioLivre() });
    await abrirEscala(page);
    await expect(etiqueta(page)).toHaveAttribute('aria-describedby', 'glossario-horario-livre');
    await expect(page.locator('#glossario-horario-livre')).toHaveText(GLOSSARIO['horario-livre'].texto);
    // Toda descrição aponta para um elemento que existe, e nenhum termo tem também o title do navegador
    const quebradas = await page.evaluate(() => [...document.querySelectorAll('[aria-describedby]')]
      .flatMap(el => el.getAttribute('aria-describedby').split(/\s+/).filter(id => !document.getElementById(id))));
    expect(quebradas).toEqual([]);
    await expect(page.locator('[data-dica][title]')).toHaveCount(0);
  });
});

test.describe('Dicas no celular', () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true });

  test('um toque na etiqueta abre a dica, inteira na tela; um toque fora fecha', async ({ page }) => {
    await abrir(page, { estado: diaComHorarioLivre() });
    await abrirEscala(page);
    await etiqueta(page).scrollIntoViewIfNeeded();
    await etiqueta(page).tap();
    await expect(dica(page)).toBeVisible();
    const caixa = await dica(page).boundingBox();
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(360);
    await page.locator('#out .st').tap();
    await expect(dica(page)).toBeHidden();
  });
});
