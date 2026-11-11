// A escala acompanha os dados: é refeita a cada alteração do operador e já está pronta ao abrir a aba Escala.
import { test, expect, abrirSintetico, abrirComExemplo, irPara, lerEscala, AMANHA } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';
import { comExemplo } from '../helpers/exemplo.js';

const MATRICULA = /\b(P[PRT]-[A-Z]{3})\b/;

async function entrar(page, conta) {
  await page.goto('./?supabase=teste');
  await page.locator('#login-email').fill(conta.email);
  await page.locator('#login-senha').fill(conta.senha);
  await page.locator('#btn-entrar').click();
  await expect(page.locator('#usuario')).toBeVisible();
}

test.describe('Escala automática', () => {
  test('a escala já está pronta ao abrir a aba, sem botão de gerar', async ({ page }) => {
    await abrirComExemplo(page);
    await expect(page.locator('#gen, #gen2')).toHaveCount(0);
    await irPara(page, 'esc');
    await expect(page.locator('#out .st')).toBeVisible();
    expect((await lerEscala(page)).linhas.length).toBeGreaterThan(20);
  });

  test('cada alteração refaz a escala na hora: o avião em manutenção sai e, religado, volta', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'esc');
    const antes = await lerEscala(page);
    const matricula = antes.linhas.map(l => (l.match(MATRICULA) || [])[1]).find(Boolean);
    expect(matricula).toBeTruthy();

    await irPara(page, 'rec');
    await page.locator(`#eqs input[data-id="${matricula}"]`).uncheck();
    await irPara(page, 'esc');
    expect((await lerEscala(page)).linhas.some(l => l.includes(matricula))).toBe(false);

    // Sem botão Desfazer: para voltar atrás, basta alterar de novo
    await expect(page.locator('#btn-undo')).toHaveCount(0);
    await irPara(page, 'rec');
    await page.locator(`#eqs input[data-id="${matricula}"]`).check();
    await irPara(page, 'esc');
    expect(await lerEscala(page)).toEqual(antes);
  });

  test('sem ninguém para voar, a aba Escala explica que a escala se monta sozinha', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'esc');
    await expect(page.locator('#out')).toContainText('Nenhum voo nesta data');
    await expect(page.locator('#out')).toContainText('automaticamente');
  });

  test('data sem escala gravada: a escala calculada aparece na hora e é gravada junto com a primeira alteração', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(comExemplo(estadoSintetico()), AMANHA));
    await entrar(page, CONTAS.operador);
    await irPara(page, 'esc');
    expect((await lerEscala(page)).linhas.length).toBeGreaterThan(20);
    expect(servidor.gravacoes).toEqual([]);

    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect.poll(() => servidor.dias.get(AMANHA).conteudo.av['PR-BTB']).toBe(false);
    const { resultado } = servidor.dias.get(AMANHA).conteudo;
    expect(resultado.data).toBe(AMANHA);
    expect(resultado.out.length).toBeGreaterThan(20);
    expect(resultado.out.some(o => o.r === 'PR-BTB')).toBe(false);
    expect(servidor.gravacoes.filter(g => g.chave === `dia:${AMANHA}`)).toHaveLength(1);
  });

  test('exportar uma escala só calculada a grava (BI e dia seguinte); exportar de novo não grava outra vez', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(comExemplo(estadoSintetico()), AMANHA));
    await entrar(page, CONTAS.operador);
    await irPara(page, 'esc');
    await Promise.all([page.waitForEvent('download'), page.locator('#exp').click()]);
    await expect.poll(() => (servidor.dias.get(AMANHA).conteudo.resultado || { out: [] }).out.length).toBeGreaterThan(20);
    await Promise.all([page.waitForEvent('download'), page.locator('#pdf').click()]);
    await Promise.all([page.waitForEvent('download'), page.locator('#exp').click()]);
    expect(servidor.gravacoes.filter(g => g.chave === `dia:${AMANHA}`)).toHaveLength(1);
  });

  test('o gestor exporta sem gravar', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(comExemplo(estadoSintetico()), AMANHA));
    await entrar(page, CONTAS.gestor);
    await irPara(page, 'esc');
    await Promise.all([page.waitForEvent('download'), page.locator('#exp').click()]);
    expect(servidor.gravacoes).toEqual([]);
  });

  test('o gestor também vê a escala calculada de uma data ainda sem escala gravada, sem gravar nada', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(comExemplo(estadoSintetico()), AMANHA));
    await entrar(page, CONTAS.gestor);
    await irPara(page, 'esc');
    expect((await lerEscala(page)).linhas.length).toBeGreaterThan(20);
    expect(servidor.gravacoes).toEqual([]);
  });
});
