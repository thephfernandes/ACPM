// Sugestões para um conflito: o botão "Sugestões" da caixa de conflitos abre uma gaveta com o que pode voar
// no lugar do voo fixo; "Aplicar" muda o voo (que continua fixo) e o histórico desfaz. Cancelar pede o motivo, como no
// status, já com o motivo do conflito marcado
import { test, expect, abrir, irPara, abrirEscala, abrirCaixa, abrirHistorico, alternarVem, aprovar } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const dia = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] });
const linha = (page, nome) => page.locator('#out tbody tr:not(.win)', { hasText: nome });
const gaveta = page => page.locator('#painel-reparo');

// Aprova a escala e tira o instrutor do voo do aluno 1000; devolve o nome dele e o do outro
async function aprovarETirarOInstrutor(page, url) {
  await abrir(page, { estado: dia(), url });
  await abrirEscala(page);
  await aprovar(page);
  const instrutor = (await linha(page, 'Aluno 1000').locator('.c-instr').innerText()).trim();
  const id = instrutor.endsWith('01') ? 1 : 2;
  await irPara(page, 'ins');
  await alternarVem(page, id, false);
  await abrirEscala(page);
  await abrirCaixa(page, 'conflitos');
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

    await abrirHistorico(page);
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

  // As gavetas ficam umas sobre as outras: o Esc fecha só a de cima (a que abriu por último), e o próximo, a de baixo
  test('com o Histórico aberto, o Esc fecha primeiro as Sugestões, abertas depois; o segundo, o Histórico', async ({ page }) => {
    await aprovarETirarOInstrutor(page);
    await abrirHistorico(page);
    await expect(page.locator('#historico')).toBeVisible();
    // A gaveta do Histórico pode cobrir o botão: pelo teclado
    await page.locator('#out details.conflitos [data-reparo]').focus();
    await page.keyboard.press('Enter');
    await expect(gaveta(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(gaveta(page)).toBeHidden();
    await expect(page.locator('#historico')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
  });

  // O pedido mudou depois da aprovação (a duração): a única sugestão é soltar o voo
  test('soltar o voo: o app escala de novo, sem o cadeado; o histórico desfaz', async ({ page }) => {
    const estado = { ...dia(), stu: [aluno(1000, { p1: 390, p2: -1, nb: 2 })], fixos: { '1000_0_1': { a: 390, b: 450, r: 'PP-LJV', insId: 1 } }, aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' } };
    await abrir(page, { estado });
    await abrirEscala(page);
    await expect(page.locator('#out details.conflitos')).toContainText('a duração do pedido mudou');
    await abrirCaixa(page, 'conflitos');
    await page.locator('#out details.conflitos [data-reparo]').click();
    const opcoes = gaveta(page).locator('.opcoes-reparo li');
    await expect(opcoes).toHaveCount(2);
    await expect(opcoes.first()).toContainText('Soltar o voo: o app escolhe de novo o horário, o avião e o instrutor');
    await opcoes.first().getByRole('button', { name: 'Soltar' }).click();
    await expect(gaveta(page)).toBeHidden();
    await expect(page.locator('#out details.conflitos')).toHaveCount(0);
    await expect(linha(page, 'Aluno 1000').locator('.fixo')).toHaveCount(0);
    await expect(linha(page, 'Aluno 1000').locator('.c-hr')).toContainText('06:30–08:30');

    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list')).toContainText('Reparo: Aluno 1000 (06:30–07:30): Soltar o voo');
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#out details.conflitos')).toHaveCount(1);
  });

  test('no Gestor, a caixa de conflitos aparece sem o botão Sugestões', async ({ page }) => {
    const estado = { ...dia(), ins: [instrutor(1, 9, { on: false }), instrutor(2, 9)], fixos: { '1000_0_1': { a: 390, b: 450, r: 'PP-LJV', insId: 1 } }, aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' } };
    await abrir(page, { estado, url: './?role=gestor' });
    await abrirEscala(page);
    await expect(page.locator('#out details.conflitos')).toContainText('o instrutor não está disponível');
    await expect(page.locator('#out details.conflitos [data-reparo]')).toHaveCount(1);
    await expect(page.locator('#out details.conflitos [data-reparo]')).toBeHidden();
  });
});

// O voo cancelado também tem sugestões (F1e): o aluno não perde o voo porque o instrutor faltou. O motivo do cancelamento
// sai da busca (aqui, o instrutor); aplicada, a sugestão volta o voo para Pendente com o outro instrutor; o Histórico desfaz
test.describe('Sugestões para um voo cancelado', () => {
  const doisInstrutores = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] });

  test('cancelado por "Instrutor indisponível": outro instrutor no mesmo horário; aplicada, Pendente; o histórico desfaz', async ({ page }) => {
    await abrir(page, { estado: doisInstrutores() });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    const instrutor = (await voo.locator('.c-instr').innerText()).trim();
    await voo.locator('.st-sel').selectOption('Cancelado');
    await page.locator('#dlg-status').getByLabel('Instrutor indisponível').check();
    await page.locator('#dlg-status').getByRole('button', { name: 'Confirmar' }).click();
    await expect(voo).toHaveClass(/\bst-Cancelado\b/);

    await voo.getByRole('button', { name: 'Sugestões' }).click();
    await expect(gaveta(page)).toBeVisible();
    await expect(gaveta(page).locator('h2')).toContainText('Aproveitar o voo cancelado');
    await expect(gaveta(page)).toContainText('Cancelado: Instrutor indisponível.');
    const primeira = gaveta(page).locator('.opcoes-reparo li').first();
    await expect(primeira).toContainText('10:10');
    await expect(primeira).not.toContainText(instrutor);
    await primeira.getByRole('button', { name: 'Aplicar' }).click();
    await expect(gaveta(page)).toBeHidden();
    await expect(voo.locator('.st-sel')).toHaveValue('Pendente');
    await expect(voo.locator('.c-instr')).not.toHaveText(instrutor);
    await expect(voo.locator('.fixo')).toHaveCount(1);

    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list')).toContainText('Voo cancelado aproveitado: Aluno 1000 (10:10–11:10)');
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await page.keyboard.press('Escape');
    await expect(voo.locator('.st-sel')).toHaveValue('Cancelado');
    await expect(voo.locator('.st-detalhe')).toHaveText('Instrutor indisponível');
  });

  test('cancelado porque o aluno faltou: sem "Sugestões"', async ({ page }) => {
    await abrir(page, { estado: doisInstrutores() });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    await voo.locator('.st-sel').selectOption('Cancelado');
    await page.locator('#dlg-status').getByLabel('Aluno ausente').check();
    await page.locator('#dlg-status').getByRole('button', { name: 'Confirmar' }).click();
    await expect(voo).toHaveClass(/\bst-Cancelado\b/);
    await expect(voo.getByRole('button', { name: 'Sugestões' })).toHaveCount(0);
  });

  test('sem nada que sirva: "Impossível nesta data", com o porquê', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] }) });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    await voo.locator('.st-sel').selectOption('Cancelado');
    await page.locator('#dlg-status').getByLabel('Instrutor indisponível').check();
    await page.locator('#dlg-status').getByRole('button', { name: 'Confirmar' }).click();
    await voo.getByRole('button', { name: 'Sugestões' }).click();
    await expect(gaveta(page)).toContainText('Impossível nesta data.');
    await expect(gaveta(page).locator('.impossivel li')).toHaveCount(3);
  });
});

// A recusa do pedido cujo instrutor escolhido não serve também tem "Sugestões" (F1e): outro instrutor que o encaixa sem
// mudar outro voo; aplicada, a escolha do pedido muda e ele entra; o histórico desfaz
test('o pedido recusado pelo instrutor escolhido: "Sugestões" na linha da recusa encaixa com outro instrutor', async ({ page }) => {
  await abrir(page, { estado: cenario({ ins: [instrutor(1, 9, { on: false }), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1, insId: 1 })] }) });
  await abrirEscala(page);
  await abrirCaixa(page, 'erros');
  await page.locator('#out details.caixa.erros').getByRole('button', { name: 'Sugestões' }).click();
  await expect(gaveta(page).locator('h2')).toContainText('Encaixar o pedido');
  const primeira = gaveta(page).locator('.opcoes-reparo li').first();
  await expect(primeira).toContainText('Com Instrutor 02');
  await primeira.getByRole('button', { name: 'Aplicar' }).click();
  await expect(gaveta(page)).toBeHidden();
  await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toContainText('Instrutor 02');
  await abrirHistorico(page);
  await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#out details.caixa.erros')).toContainText('Aluno 1000');
});
