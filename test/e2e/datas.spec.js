// Escala por data no modo local: cada data guarda a sua escala, a nova data copia o dia anterior,
// histórico e BI por data, e os dados da fase 2 deste navegador são convertidos na primeira abertura.
import { test, expect, abrir, abrirSintetico, abrirComExemplo, irPara, abrirEscala, lerEscala, AMANHA } from './fixtures.js';
import { estadoSintetico } from '../helpers/estado.js';
import { aluno } from '../helpers/montar.js';
import { runAllocationEngine } from '../../js/engine.js';
import { ApiClient } from '../../js/storage.js';
import { separar } from '../../js/dias.js';
import { ESQUEMA } from '../../js/migracoes.js';
import { comNomesAntigos } from '../helpers/formato.js';

const DEPOIS = '2026-11-12';

// O campo de data fica na aba 6 · Escala
async function mudarData(page, data) {
  await page.locator('#nav button[data-t="esc"]').click();
  await page.locator('#dt').fill(data);
  await page.locator('#dt').dispatchEvent('change');
  await expect(page.locator('#dt')).toHaveValue(data);
}

test.describe('Escala por data', () => {
  test('cada data tem a sua escala; a nova data copia a demanda do dia anterior', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const escalaDia11 = await lerEscala(page);

    // A nova data já mostra a escala calculada com a demanda copiada
    await mudarData(page, DEPOIS);
    await expect(page.locator('#out .st')).toBeVisible();
    expect((await lerEscala(page)).linhas.length).toBeGreaterThan(20);
    await irPara(page, 'dem');
    await expect(page.locator('#dem tr[data-k="d"][data-mid="0"]')).toHaveCount(20);
    await expect(page.locator('#cnt')).toContainText('20 aluno(s)');

    await page.locator('#dem tr[data-k="d"][data-mid="0"]').first().locator('[data-f="fly"]').uncheck();
    await abrirEscala(page);
    const escalaDia12 = await lerEscala(page);
    expect(escalaDia12.linhas).not.toEqual(escalaDia11.linhas);

    await mudarData(page, AMANHA);
    await irPara(page, 'esc');
    expect(await lerEscala(page)).toEqual(escalaDia11);
    await mudarData(page, DEPOIS);
    await irPara(page, 'esc');
    expect(await lerEscala(page)).toEqual(escalaDia12);
  });

  test('sem espaço neste navegador: o aviso diz que a alteração não foi salva (revisão de 14/11)', async ({ page }) => {
    await abrirSintetico(page);
    await page.evaluate(() => {
      const gravar = Storage.prototype.setItem;
      Storage.prototype.setItem = function (chave, valor) {
        if (chave.startsWith('acpm4_')) throw new DOMException('O espaço acabou', 'QuotaExceededError');
        return gravar.call(this, chave, valor);
      };
    });
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect(page.locator('#aviso-sync-texto')).toHaveText(
      'Não foi possível salvar neste navegador (o espaço de armazenamento pode ter acabado): a última alteração não foi salva. Exporte o CSV para não perder a escala.');
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#audit-log-list .audit-item').filter({ hasText: 'PR-BTB' }).locator('.audit-estado')).toHaveText('não gravada');
  });

  test('o histórico é separado por data', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect(page.locator('#log-cnt')).toHaveText('1');
    await mudarData(page, DEPOIS);
    await expect(page.locator('#log-cnt')).toHaveText('0');
    await mudarData(page, AMANHA);
    await expect(page.locator('#log-cnt')).toHaveText('1');
    await expect(page.locator('#audit-log-list')).toContainText('PR-BTB: Manutenção');
  });

  test('reverter pelo histórico vale também depois de recarregar', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await page.locator('#btn-open-log').click();
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await expect(page.locator('#audit-log-list')).toContainText('Revertido: PR-BTB');
    await page.reload();
    await irPara(page, 'rec');
    await expect(page.locator('#eqs input[data-id="PR-BTB"]')).toBeChecked();
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#audit-log-list [data-act="rev-log"]')).toHaveCount(0);
    await expect(page.locator('#log-cnt')).toHaveText('1');
  });

  test('o link com ?data= abre aquela data; uma data que não existe abre amanhã, com o aviso', async ({ page }) => {
    await abrir(page, { url: `./?data=${DEPOIS}` });
    await expect(page.locator('#dt')).toHaveValue(DEPOIS);
    await page.goto('./?data=2026-02-30');
    await expect(page.locator('#dt')).toHaveValue(AMANHA);
    await expect(page.locator('#toast-box')).toContainText('A data do link não existe (2026-02-30). A escala aberta é a de amanhã.');
  });

  test('com o campo de data vazio, a tela volta para a data aberta e as alterações continuam indo para ela', async ({ page }) => {
    await abrirSintetico(page);
    await page.locator('#nav button[data-t="esc"]').click();
    await page.locator('#dt').fill('');
    await page.locator('#dt').dispatchEvent('change');
    await expect(page.locator('#dt')).toHaveValue(AMANHA);
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await page.reload();
    await irPara(page, 'rec');
    await expect(page.locator('#eqs input[data-id="PR-BTB"]')).not.toBeChecked();
  });

  test('o BI soma as escalas guardadas de cada data', async ({ page }) => {
    // Exportar grava a escala calculada de cada data
    const exportar = () => Promise.all([page.waitForEvent('download'), page.locator('#exp').click()]);
    await abrirComExemplo(page);
    await abrirEscala(page);
    await exportar();
    await mudarData(page, DEPOIS);
    await abrirEscala(page);
    await exportar();
    await irPara(page, 'bi');
    await expect(page.locator('#bi-content .st > div').nth(1)).toContainText('44 h');
    await expect(page.locator('#bi-content .st > div').nth(2)).toContainText('2 dias registrados');
  });

  test('dados no formato anterior neste navegador são regravados no formato atual na abertura', async ({ page }) => {
    const { cadastro, dia } = separar(ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000)] }));
    // O cadastro antigo não tinha a frota (formato 11)
    const { frota, ...cadastroAntigo } = cadastro;
    const fase3 = comNomesAntigos({ acpm4_cadastro: cadastroAntigo, [`acpm4_dia_${AMANHA}`]: { ...dia, av: { ...dia.av, 'SIM-MONO-A': false }, resultado: null } });
    await page.addInitScript(json => {
      if (sessionStorage.getItem('semeado')) return;
      sessionStorage.setItem('semeado', '1');
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify(fase3));
    await abrir(page);
    await irPara(page, 'rec');
    await expect(page.locator('#eqs input[data-id="SIM-MONO-A"]')).not.toBeChecked();
    const gravado = await page.evaluate(d => ({ cadastro: JSON.parse(localStorage.getItem('acpm4_cadastro')), dia: JSON.parse(localStorage.getItem(`acpm4_dia_${d}`)) }), AMANHA);
    expect([gravado.cadastro.esquema, gravado.dia.esquema, gravado.dia.av['SIM-MONO-A']]).toEqual([ESQUEMA, ESQUEMA, false]);
    expect(Object.keys(gravado.dia.av).filter(r => /^SIM-(MONO|MULTI)-\d$/.test(r))).toEqual([]);
    expect(gravado.cadastro.ins).toEqual(cadastro.ins);
  });

  test('dados da fase 2 neste navegador são convertidos na primeira abertura', async ({ page }) => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000), aluno(1001, { p1: 2 })] });
    const escala = runAllocationEngine(estado);
    const fase2 = {
      acpm3: estado,
      acpm3_res: escala,
      acpm3_audit: [{ id: Date.UTC(2026, 10, 10, 13), ts: '10:00:00', type: 'inc', desc: 'Aluno cadastrado: Aluno 1000', revert: null }],
      acpm3_bi: { '2026-11-03': { out: escala.out, tot: 2, rej: 0 }, [AMANHA]: { out: escala.out, tot: 2, rej: 0 } }
    };
    await page.addInitScript(json => {
      if (sessionStorage.getItem('semeado')) return;
      sessionStorage.setItem('semeado', '1');
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify(fase2));
    await abrir(page);

    await irPara(page, 'alu');
    await expect(page.locator('#alu .cd')).toHaveCount(2);
    await irPara(page, 'esc');
    await expect(page.locator('#out table tbody tr')).not.toHaveCount(0);
    await expect(page.locator('#audit-log-list')).toContainText('Aluno cadastrado: Aluno 1000');
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('acpm4_')).sort()))
      .toEqual(['acpm4_cadastro', 'acpm4_dia_2026-11-03', `acpm4_dia_${AMANHA}`, 'acpm4_historico']);
    expect(await page.evaluate(() => localStorage.getItem('acpm3') !== null), 'os dados antigos ficam como cópia').toBe(true);
  });
});
