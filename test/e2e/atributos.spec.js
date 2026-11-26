// Atributos dos recursos na aba Recursos (Só VFR, Habilitação própria, Só Parafuso), a habilitação própria nas
// habilitações do instrutor e o simulador com 2 h na Demanda e na Agenda
import { test, expect, abrir, irPara, irParaVista, abrirEscala, abrirHistorico, campoDaAgenda } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const linha = (page, nome) => page.locator('#out tbody tr:not(.win)', { hasText: nome });

test.describe('Atributos dos recursos', () => {
  test('a frota começa com o PR-CPL "Só VFR" e o PR-VOM com habilitação própria; um atributo marcado vale na escala, e o histórico desfaz', async ({ page }) => {
    // Um voo IFR no C172, com todos os C172 em manutenção menos o PR-HAR e o PR-CPL
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { mis: 'IFR', eq: 'C172' })], semAeronaves: ['PP-ABP', 'PP-AJS', 'PR-BUL', 'PR-VOY'] });
    await abrir(page, { estado });
    // Os atributos ficam na frota, em Recursos › Cadastro
    await irParaVista(page, 'rec', 'cadastro');
    await expect(page.locator('#frota li.frota-item[data-r="PR-CPL"]')).toContainText('Só VFR');
    await expect(page.locator('#frota li.frota-item[data-r="PR-VOM"]')).toContainText('Habilitação própria');
    await abrirEscala(page);
    await expect(linha(page, 'Aluno 1000').locator('.c-aviao')).toContainText('PR-HAR');

    // O PR-HAR também passa a "Só VFR": o voo IFR fica sem avião (o Cadastro continua aberto ao voltar à aba)
    await irPara(page, 'rec');
    await expect(page.locator('#s-rec')).toHaveAttribute('data-vista', 'cadastro');
    await page.locator('#frota li.frota-item[data-r="PR-HAR"] [data-act="atributos-recurso"]').click();
    const caixas = page.locator('#frota li.frota-item[data-r="PR-HAR"] .atributos-recurso input');
    await expect(caixas).toHaveCount(2);
    await page.locator('#frota li.frota-item[data-r="PR-HAR"] [data-atributo="soVfr"]').check();
    await expect(page.locator('#frota li.frota-item[data-r="PR-HAR"]')).toContainText('Só VFR');
    await expect(page.locator('#frota li.frota-item[data-r="PR-HAR"] [data-atributo="soVfr"]')).toBeFocused();
    await abrirEscala(page);
    await expect(page.locator('#out details.erros')).toContainText('nenhum C172 homologado IFR disponível');

    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list')).toContainText('PR-HAR: Só VFR marcado');
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await page.keyboard.press('Escape');
    await expect(linha(page, 'Aluno 1000').locator('.c-aviao')).toContainText('PR-HAR');
  });

  test('a habilitação própria do PR-VOM aparece nas habilitações do instrutor e vale na escala', async ({ page }) => {
    const mlte = ['mlte', 'local'];
    const estado = cenario({ ins: [instrutor(1, 1, { hab: mlte })], stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34' })], semAeronaves: ['PT-JOB', 'PT-KIW'] });
    await abrir(page, { estado });
    await abrirEscala(page);
    await expect(page.locator('#out details.erros')).toContainText('exigem a habilitação própria deles');

    await irPara(page, 'ins');
    await page.locator('[data-vista-ins="cadastro"]').click();
    await page.locator('#inst tr.cd[data-id="1"] [data-act="editar-habs"]').click();
    const painel = page.locator('#painel-instrutor');
    await expect(painel.locator('fieldset', { hasText: 'Habilitação própria do recurso' })).toContainText('Avião PR-VOM');
    await painel.locator('[data-h="aviao:PR-VOM"]').check();
    await abrirEscala(page);
    await expect(linha(page, 'Aluno 1000').locator('.c-aviao')).toContainText('PR-VOM');
  });

  test('o simulador começa com 2 h na Demanda e na Agenda', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await irPara(page, 'dem');
    const pedido = page.locator('#dem tr[data-k="d"][data-id="1000"][data-mid="0"]');
    await pedido.locator('[data-f="mis"]').selectOption('Simulador');
    await expect(page.locator('#dem tr[data-k="d"][data-id="1000"][data-mid="0"] [data-f="nb"]')).toHaveValue('2');
    await page.locator('#dem tr[data-k="d"][data-id="1000"][data-mid="0"] [data-f="mis"]').selectOption('Voo Local');
    await expect(page.locator('#dem tr[data-k="d"][data-id="1000"][data-mid="0"] [data-f="nb"]')).toHaveValue('1');

    await irPara(page, 'age');
    // A missão espera o aluno (F1c)
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await campoDaAgenda(page, 'missao').selectOption('Simulador');
    await expect(campoDaAgenda(page, 'horas')).toHaveValue('2');
    await campoDaAgenda(page, 'missao').selectOption('Voo Local');
    await expect(campoDaAgenda(page, 'horas')).toHaveValue('1');
  });
});
