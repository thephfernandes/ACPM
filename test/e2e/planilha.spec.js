// Planilha no modelo do aeroclube (Excel, para o lançamento no CAVOK): o arquivo baixado é conferido por fora
// (test/helpers/xlsx.js) contra o modelo e contra o CSV baixado da mesma tela (outro caminho do código), e os XML também
// passam pelo leitor de XML do navegador
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { test, expect, prepararContexto, vigiarErros, abrirComExemplo, abrirEscala, AMANHA, botaoExportar, dataAberta, exportar, escolherNoCalendario } from './fixtures.js';
import { abrirZip, lerPlanilha, conferirEstrutura, conferirConteudo } from '../helpers/xlsx.js';
import { FROTA_INICIAL } from '../../js/frota.js';

const MODELO = abrirZip(readFileSync(new URL('../../modelos/escala-cavok.xlsx', import.meta.url)));
const DEPOIS = '2026-11-12';
const aba = data => data.split('-').reverse().join('-');
const minutos = h => +h.slice(0, 2) * 60 + +h.slice(3, 5);

// Os voos do CSV da tela: avião, horário, aluno, missão e instrutor (sem a parte dos alertas e sem os cancelados)
function voosDoCsv(texto) {
  const linhas = texto.replace(/^\uFEFF/, '').split('\r\n');
  const voos = [];
  for (const linha of linhas.slice(1)) {
    if (!linha) break;
    const [r, horario, aluno, missao, instrutor, observacoes] = [...linha.matchAll(/"((?:[^"]|"")*)"/g)].map(m => m[1].replace(/""/g, '"'));
    if (/Status: Cancelado/.test(observacoes)) continue;
    const [a, b] = horario.split('–').map(minutos);
    voos.push({ r, a, b, aluno, instrutor, mis: missao.split(' · ').pop().replace(/ \(sessão .*\)$/, ''), ground: r === 'SALA-GROUND' });
  }
  return voos;
}

// Os XML do arquivo que o leitor de XML do navegador recusa
const xmlsRecusados = (page, arquivos) => page.evaluate(lista => lista
  .filter(([, xml]) => new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror').length)
  .map(([nome]) => nome), [...arquivos].filter(([n]) => /\.(xml|rels)$/.test(n)).map(([n, b]) => [n, b.toString('utf8')]));

async function conferirPlanilha(page, download, csv, data) {
  expect(download.suggestedFilename()).toBe(`escala-acpm-${data}.xlsx`);
  const saida = abrirZip(await readFile(await download.path()));
  expect(conferirEstrutura(MODELO, saida)).toEqual([]);
  expect(await xmlsRecusados(page, saida)).toEqual([]);
  const lida = lerPlanilha(saida);
  expect(lida.aba).toBe(aba(data));
  const voos = voosDoCsv(await readFile(await csv.path(), 'utf8'));
  expect(voos.length).toBeGreaterThan(20);
  expect(conferirConteudo(lida, voos, { data, frota: FROTA_INICIAL, arquivos: saida })).toEqual([]);
}

test.describe('Planilha no modelo do aeroclube (Excel)', () => {
  test('o arquivo é o modelo preenchido: cada voo do CSV na coluna do avião, na linha do horário', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const [csv] = await exportar(page, 'csv');
    const [planilha] = await exportar(page, 'xlsx');
    await expect(page.locator('#toast-box .toast.ok').filter({ hasText: 'Planilha exportada.' })).toBeVisible();
    await conferirPlanilha(page, planilha, csv, AMANHA);
  });

  test('a data muda enquanto o modelo carrega: a planilha é a da data do clique', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const [csv] = await exportar(page, 'csv');
    let liberar;
    const segurado = new Promise(resolve => { liberar = resolve; });
    await page.route('**/modelos/escala-cavok.xlsx', async rota => { await segurado; await rota.continue(); });
    const baixado = page.waitForEvent('download');
    await botaoExportar(page, 'xlsx').click();
    await escolherNoCalendario(page, DEPOIS);
    await expect(dataAberta(page)).toHaveAttribute('data-data', DEPOIS);
    liberar();
    await conferirPlanilha(page, await baixado, csv, AMANHA);
  });

  test('o modelo estragado: avisa que não deu para montar e não baixa nada', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await page.route('**/modelos/escala-cavok.xlsx', rota => rota.fulfill({ status: 200, contentType: 'text/html', body: '<html>não é o modelo</html>' }));
    let baixou = false;
    page.on('download', () => { baixou = true; });
    await botaoExportar(page, 'xlsx').click();
    await expect(page.locator('#toast-box .toast').filter({ hasText: 'Não foi possível montar a planilha: o modelo que chegou não é o esperado. Recarregue a página e tente de novo, ou use o CSV.' })).toBeVisible();
    expect(baixou).toBe(false);
  });

  test('o navegador sem a compressão "deflate-raw": avisa para atualizar e nem busca o modelo', async ({ page }) => {
    // Como no Safari antes do 16.4: o construtor recusa o formato
    await page.addInitScript(() => {
      const Original = window.DecompressionStream;
      window.DecompressionStream = class extends Original {
        constructor(formato) {
          if (formato === 'deflate-raw') throw new TypeError(`Unsupported compression format: '${formato}'`);
          super(formato);
        }
      };
    });
    await abrirComExemplo(page);
    await abrirEscala(page);
    let buscou = false;
    await page.route('**/modelos/escala-cavok.xlsx', rota => { buscou = true; return rota.continue(); });
    await botaoExportar(page, 'xlsx').click();
    await expect(page.locator('#toast-box .toast').filter({ hasText: 'Este navegador não monta a planilha do Excel. Atualize o navegador ou use o CSV.' })).toBeVisible();
    expect(buscou).toBe(false);
  });

  test('o segundo clique enquanto a planilha é montada não baixa outra; depois de pronta, baixa de novo', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    let liberar;
    const segurado = new Promise(resolve => { liberar = resolve; });
    let buscas = 0;
    await page.route('**/modelos/escala-cavok.xlsx', async rota => { buscas++; await segurado; await rota.continue(); });
    const downloads = [];
    page.on('download', d => downloads.push(d));
    await botaoExportar(page, 'xlsx').click();
    await botaoExportar(page, 'xlsx').click();
    liberar();
    await expect.poll(() => downloads.length).toBe(1);
    await botaoExportar(page, 'xlsx').click();
    await expect.poll(() => downloads.length).toBe(2);
    expect(buscas, 'o segundo clique nem buscou o modelo').toBe(2);
  });

  test('sem o modelo (404 ou rede fora): avisa que o modelo não carregou e não baixa nada', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [404], ignorar: [/ERR_FAILED/] });
    await abrirComExemplo(page);
    await abrirEscala(page);
    let baixou = false;
    page.on('download', () => { baixou = true; });
    const aviso = page.locator('#toast-box .toast').filter({ hasText: 'O modelo da planilha não carregou. Verifique a conexão e tente de novo.' });
    await page.route('**/modelos/escala-cavok.xlsx', rota => rota.fulfill({ status: 404, body: '' }));
    await botaoExportar(page, 'xlsx').click();
    await expect(aviso).toBeVisible();
    await page.unroute('**/modelos/escala-cavok.xlsx');
    await expect(aviso).toBeHidden();
    await page.route('**/modelos/escala-cavok.xlsx', rota => rota.abort('failed'));
    await botaoExportar(page, 'xlsx').click();
    await expect(aviso).toBeVisible();
    expect(baixou).toBe(false);
    expect(erros).toEqual([]);
    await contexto.close();
  });
});
