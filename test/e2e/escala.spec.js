import { readFile } from 'node:fs/promises';
import { test, expect, abrir, abrirComExemplo, abrirEscala, lerEscala, json, AMANHA, abrirHistorico, dataAberta, exportar } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

test.describe('Escala', () => {
  test.beforeEach(async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
  });

  test('gera a escala do exemplo: resumo, alertas, tabela e mapa por aeronave', async ({ page }) => {
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    expect(json(await lerEscala(page))).toMatchSnapshot('escala-exemplo.json');
  });

  test('mapa de ocupação por instrutor', async ({ page }) => {
    await page.locator('[data-tl="ins"]').click();
    await expect(page.locator('[data-tl="ins"]')).toHaveClass(/\bon\b/);
    expect(json((await lerEscala(page)).mapa)).toMatchSnapshot('mapa-por-instrutor.json');
  });

  test('filtra por equipamento e por texto', async ({ page }) => {
    await page.locator('#flt-esc-eq').selectOption('PT-JOB');
    const porEquipamento = await lerEscala(page);
    await page.locator('#flt-esc-eq').selectOption('');
    await page.locator('#flt-esc-q').fill('ground');
    const porTexto = await lerEscala(page);
    expect(json({ porEquipamento: porEquipamento.linhas, porTexto: porTexto.linhas })).toMatchSnapshot('escala-filtrada.json');
  });

  test('cancelar um voo atualiza status, horas e histórico', async ({ page }) => {
    const antes = await lerEscala(page);
    const ultimo = page.locator('#out table .st-sel').last();
    await ultimo.selectOption('Cancelado');
    // O cancelamento pede o motivo
    await page.locator('#dlg-status').getByLabel('Meteorologia').check();
    await page.locator('#dlg-status').getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.locator('#out table tbody tr.st-Cancelado')).toHaveCount(1);
    // O cancelado fica fixo onde estava: não ocupa nada, e os outros voos podem usar o horário
    await expect(page.locator('#out table tbody tr.st-Cancelado .fixo')).toHaveCount(1);
    const depois = await lerEscala(page);
    expect(json({ antes: antes.resumo, depois: depois.resumo, linha: depois.linhas.at(-1) })).toMatchSnapshot('cancelamento.json');
    await expect(page.locator('#audit-log-list')).toContainText(': Cancelado (Meteorologia)');
  });

  test('excluir da escala e restaurar pelo histórico', async ({ page }) => {
    const antes = await lerEscala(page);
    await page.locator('#out table [data-act="rm-fly"]').last().click();
    expect(json((await lerEscala(page)).resumo)).toMatchSnapshot('exclusao-resumo.json');
    await abrirHistorico(page);
    await page.locator('#audit-log-list [data-act="rev-log"]', { hasText: 'Restaurar' }).first().click();
    expect(await lerEscala(page)).toEqual(antes);
  });

  test('exporta CSV com BOM, separador ";" e quebras CRLF', async ({ page }) => {
    const [download] = await exportar(page, 'csv');
    expect(download.suggestedFilename()).toBe(`escala-acpm-${AMANHA}.csv`);
    const conteudo = await readFile(await download.path(), 'utf8');
    expect(conteudo[0]).toBe('﻿');
    expect(conteudo).not.toMatch(/[^\r]\n/);
    expect(conteudo.slice(1).split('\r\n').join('\n') + '\n').toMatchSnapshot('escala-exemplo.csv');
    await expect(page.locator('#toast-box .toast.ok')).toHaveText('CSV exportado.');
  });

  test('emite o PDF da escala com título, quadros e mais de uma página', async ({ page }) => {
    const [download] = await exportar(page, 'pdf');
    expect(download.suggestedFilename()).toBe(`escala-acpm-${AMANHA}.pdf`);
    const pdf = await readFile(await download.path());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    // O jsPDF grava o conteúdo sem compressão: os textos ASCII aparecem literalmente no arquivo
    const conteudo = pdf.toString('latin1');
    for (const trecho of ['Escala de Voo - ACPM', 'Data da escala: 11/11/2026', 'Quadro por instrutor',
      'Quadro por equipamento / sala', 'Aluno 01', 'Instrutor 10', 'SALA-GROUND', 'PR-JPL', '/Creator (AutoEscala - ACPM)']) {
      expect(conteudo, trecho).toContain(trecho);
    }
    expect(conteudo.match(/\/Type \/Page\b(?!s)/g).length).toBeGreaterThanOrEqual(2);
    // Uma notificação temporária, e não um texto fixo na barra
    await expect(page.locator('#msg')).toHaveCount(0);
    // Verde (deu certo), e não o amarelo dos avisos
    const aviso = page.locator('#toast-box .toast.ok');
    await expect(aviso).toHaveText('PDF emitido.');
    expect(await aviso.evaluate(el => getComputedStyle(el).fontSize)).toBe('15px');
    await expect(page.locator('#toast-box .toast')).toHaveCount(0, { timeout: 5000 });
  });

  // O que muda na escala fica gravado: depois de recarregar, ela volta com a alteração (aqui, um voo que decolou).
  // Sem alteração nenhuma, recarregar só recalcularia a mesma escala a partir dos mesmos dados
  test('mantém a escala após recarregar a página', async ({ page }) => {
    const voo = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 12' });
    await voo.locator('.st-sel').selectOption('Em Voo');
    await expect(voo.locator('.fixo')).toHaveAttribute('aria-label', 'Voo fixo: Em Voo');
    const alterada = await lerEscala(page);
    await page.reload();
    await abrirEscala(page);
    await expect(voo.locator('.st-sel')).toHaveValue('Em Voo');
    expect(await lerEscala(page)).toEqual(alterada);
  });
});

// Os pesos com décimos (o agendamento grava no cadastro o que o operador digita): o PDF e o CSV levam a soma em décimos,
// com a vírgula, como a tela, e não o resto do ponto flutuante (40,1 + 40,7 dá 80.80000000000001)
test('o PDF e o CSV levam o peso da tripulação com décimos em décimos, com a vírgula', async ({ page }) => {
  await abrir(page, { estado: cenario({ ins: [instrutor(1, 9, { kg: 40.7 })], stu: [aluno(1000, { p1: 390, p2: -1 }, { kg: 40.1 })] }) });
  await abrirEscala(page);
  await expect(page.locator('#out tbody tr:not(.win) .c-peso')).toHaveText('80,8 / 170 kg');
  const [pdf] = await exportar(page, 'pdf');
  const conteudoDoPdf = (await readFile(await pdf.path())).toString('latin1');
  expect(conteudoDoPdf).toContain('(80,8 kg)');
  expect(conteudoDoPdf).not.toContain('80.80000000000001');
  const [csv] = await exportar(page, 'csv');
  const conteudoDoCsv = await readFile(await csv.path(), 'utf8');
  expect(conteudoDoCsv).toContain('"Peso aluno + instrutor: 80,8 kg (limite do C152: 170 kg) · dentro do envelope"');
  expect(conteudoDoCsv).not.toContain('80.80000000000001');
});
