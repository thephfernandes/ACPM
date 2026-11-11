import { test, expect, abrir, abrirSintetico, abrirComExemplo, irPara, abrirEscala, lerEscala } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const linhaDoAluno = (page, nome) => page.locator(`#dem tr[data-k="d"][data-mid="0"][data-nm="${nome.toLowerCase()}"]`);

test.describe('Demanda', () => {
  test('"Pôr um aluno na demanda" inclui quem ainda não voa (com "Só quem voa" ligado)', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'dem');
    const fora = page.locator('#dem tr[data-k="d"][data-mid="0"].off').first();
    const nome = await fora.getAttribute('data-nm');
    await expect(fora).toBeHidden();
    await expect(page.locator(`#alunos-fora option[value="${nome.replace(/^a/, 'A')}"]`)).toHaveCount(1);

    await page.locator('#incluir-aluno').fill(nome);
    await page.locator('#incluir-aluno').press('Enter');
    const linha = page.locator(`#dem tr[data-k="d"][data-mid="0"][data-nm="${nome}"]`);
    await expect(linha).toHaveClass(/\bon\b/);
    await expect(linha).toBeVisible();
    await expect(page.locator('#incluir-aluno')).toHaveValue('');
    await expect(page.locator('#audit-log-list')).toContainText(`${nome.replace(/^a/, 'A')} incluído na demanda`);
  });

  test('9 colunas que cabem na tela (sem Sessões); "Limpar demanda" fica no menu Mais', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'dem');
    await expect(page.locator('#s-dem thead th')).toHaveText(['Aluno', 'Voa', 'Missão', 'Avião / sala', '1ª preferência', '2ª preferência', 'Disponibilidade', 'Duração', 'Prioridade']);
    await expect(page.locator('#dem [data-f="ss"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.querySelector('#s-dem .tw').scrollWidth <= document.querySelector('#s-dem .tw').clientWidth)).toBe(true);
    await expect(page.locator('#clr')).toBeHidden();
    await page.locator('#btn-mais-dem').click();
    await expect(page.locator('#clr')).toBeVisible();
    await page.locator('#clr').click();
    await expect(page.locator('#clr')).toHaveText('Confirmar limpeza');
    await page.locator('#clr').click();
    await expect(page.locator('#dem tr[data-k="d"].on')).toHaveCount(0);
  });


  test('sem "Preencher exemplo": o app opera só com a demanda real', async ({ page }) => {
    await abrir(page);
    for (const aba of ['ins', 'alu', 'dem']) {
      await irPara(page, aba);
      await expect(page.locator(`#s-${aba}`)).not.toContainText('Preencher exemplo');
    }
    await expect(page.locator('#demo')).toHaveCount(0);
  });

  test('"+ Missão" adiciona e remove uma missão extra do aluno', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'dem');
    // O Aluno 09 não voa no dia de exemplo: mostra todos os alunos
    await page.locator('#onlyfly').uncheck();
    await linhaDoAluno(page, 'Aluno 09').locator('[data-act="add-mis"]').click();
    const extra = page.locator('#dem tr.extra-row[data-nm="aluno 09"]');
    await expect(extra).toHaveCount(1);
    await expect(extra.locator('td').first()).toContainText('↳ missão extra');
    await expect(extra.locator('[data-f="mis"]')).toHaveValue('Voo Local');
    await expect(extra.locator('[data-f="p1"]')).toHaveValue('4');
    await extra.locator('[data-act="del-mis"]').click();
    await expect(extra).toHaveCount(0);
    await expect(page.locator('#audit-log-list')).toContainText('Missão extra removida de Aluno 09');
  });

  test('trocar a missão ajusta equipamento, duração e horários', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'alu');
    await page.locator('[data-act="adds"]').click();
    await irPara(page, 'dem');
    await page.locator('#onlyfly').uncheck();
    const linha = page.locator('#dem tr[data-k="d"]');
    const valores = async () => Object.fromEntries(await Promise.all(
      ['eq', 'p1', 'p2', 'nb'].map(async f => [f, await linha.locator(`[data-f="${f}"]`).inputValue()])
    ));

    await linha.locator('[data-f="mis"]').selectOption('Noturno');
    expect(await valores()).toEqual({ eq: 'C172', p1: '8', p2: '8', nb: '1' });

    await linha.locator('[data-f="mis"]').selectOption('Ground C152');
    expect(await valores()).toEqual({ eq: 'Sala Ground', p1: '0', p2: '1', nb: '1.5' });
    await expect(linha.locator('[data-f="eq"]')).toBeDisabled();
    // O que a missão exige do instrutor aparece na dica do campo
    await expect(linha.locator('[data-f="mis"]')).toHaveAttribute('title', 'Exige Grounds (C152, C172 e Navegação)');

    await linha.locator('[data-f="mis"]').selectOption('Voo Local');
    expect(await valores()).toEqual({ eq: 'C152', p1: '0', p2: '1', nb: '1' });
  });

  test('TGL (TMA) e voos de cheque na demanda: equipamentos do cheque e o checador credenciado', async ({ page }) => {
    const estado = cenario({
      ins: [instrutor(1, 9, { hab: ['local', 'c172', 'checador_vfr'] }), instrutor(2, 9, { hab: ['local', 'c172', 'checador_ifr'] })],
      stu: [aluno(1000)]
    });
    await abrir(page, { estado });
    await irPara(page, 'dem');
    const linha = page.locator('#dem tr[data-k="d"]').first();
    const opcoes = await linha.locator('[data-f="mis"] option').allTextContents();
    expect(opcoes).toEqual(expect.arrayContaining(['TGL (TMA)', 'Cheque PP', 'Cheque PC MNTE VFR', 'Cheque PC MNTE IFR', 'Cheque PC MLTE VFR', 'Cheque PC MLTE IFR']));

    await linha.locator('[data-f="mis"]').selectOption('Cheque PC MNTE IFR');
    expect(await linha.locator('[data-f="eq"] option').allTextContents()).toEqual(['C172']);
    await expect(linha.locator('[data-f="mis"]')).toHaveAttribute('title', 'Exige Checador PP, PC, MNTE, INVA, IFR ou Checador PP, PC, MLTE, MNTE, INVA, IFR');
    await abrirEscala(page);
    const voos = (await lerEscala(page)).linhas.filter(l => l.includes('Aluno 1000'));
    expect(voos).toHaveLength(1);
    expect(voos[0]).toContain('| Cheque PC MNTE IFR |');
    expect(voos[0]).toContain('| Instrutor 02 |');
  });

  test('disponibilidade do aluno: o voo só começa nas janelas escolhidas', async ({ page }) => {
    await abrir(page, { estado: cenario({ stu: [aluno(1000, { p1: 1, p2: 2 })] }) });
    await irPara(page, 'dem');
    const linha = page.locator('#dem tr[data-k="d"]').first();
    await linha.locator('[data-f="jan"]').selectOption('tarde');
    await expect(page.locator('#audit-log-list')).toContainText('Pedido Aluno 1000: disponibilidade Tarde (Voo Local)');
    await abrirEscala(page);
    const voos = (await lerEscala(page)).linhas.filter(l => l.includes('Aluno 1000'));
    expect(voos[0]).toMatch(/^12:40–13:40 1 h[^|]* \| Aluno 1000 \|/);
  });

  test('filtros "Só quem voa", nome e missão', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'dem');
    const visiveis = page.locator('#dem tr[data-k="d"]:visible');

    // "Só quem voa" já vem ligado
    await expect(page.locator('#onlyfly')).toBeChecked();
    await expect(page.locator('#dem')).toHaveClass(/\bonly\b/);
    await expect(visiveis).toHaveCount(await page.locator('#dem tr[data-k="d"].on').count());

    await page.locator('#flt-dem').fill('aluno 01');
    await expect(visiveis).toHaveCount(3);

    await page.locator('#flt-dem').fill('');
    await page.locator('#flt-dem-mis').selectOption('Ground C152');
    await expect(visiveis).toHaveCount(6);
  });

});
