// Dados pessoais de alunos e instrutores (fase 9): CPF, CANAC, nascimento, celular e e-mail, num painel ao lado da
// tabela. Ficam fora do cadastro e do link do Gestor; o histórico registra só os campos que mudaram. No modo
// compartilhado, operadores, administradores e a secretaria veem e editam; o gestor não vê.
import { test, expect, abrir, irPara, prepararContexto, vigiarErros, abrirMenuDaConta, AMANHA } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const estado = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000), aluno(1001)] });
const painel = page => page.locator('#painel-dados');
const campo = (page, rotulo) => painel(page).getByLabel(rotulo, { exact: true });
const salvar = page => painel(page).getByRole('button', { name: 'Salvar' }).click();

async function abrirDadosDoAluno(page, id) {
  await irPara(page, 'alu');
  await page.locator(`#alu tr[data-id="${id}"] [data-dados]`).click();
  await expect(painel(page)).toBeVisible();
}

test.describe('Dados pessoais (neste navegador)', () => {
  test('Alunos: o painel valida e salva; a tabela mostra o CANAC; o histórico registra só os campos', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await irPara(page, 'alu');
    await expect(page.locator('#s-alu thead th')).toHaveText(['Nome', 'CANAC', 'Curso', 'Peso (kg)', 'Não escalar com', '']);
    await abrirDadosDoAluno(page, 1000);
    await expect(painel(page).locator('h2')).toHaveText('Dados pessoais Aluno 1000');
    await campo(page, 'CPF').fill('529.982.247-24');
    await campo(page, 'CANAC').fill('12345');
    await salvar(page);
    await expect(painel(page).locator('[data-erro="cpf"]')).toHaveText('CPF inválido.');
    await expect(painel(page).locator('[data-erro="canac"]')).toHaveText('O CANAC tem 6 dígitos.');
    await expect(painel(page)).toBeVisible();

    await campo(page, 'CPF').fill('529.982.247-25');
    await campo(page, 'CANAC').fill('123456');
    await campo(page, 'Celular').fill('37991234567');
    await salvar(page);
    await expect(painel(page)).toBeHidden();
    await expect(page.locator('#toast-box .toast.ok')).toHaveText('Dados pessoais de Aluno 1000 salvos.');
    await expect(page.locator('#alu tr[data-id="1000"] .c-canac')).toHaveText('123456');

    // De novo: os dados vêm formatados
    await page.locator('#alu tr[data-id="1000"] [data-dados]').click();
    await expect(campo(page, 'CPF')).toHaveValue('529.982.247-25');
    await expect(campo(page, 'Celular')).toHaveValue('(37) 99123-4567');
    await page.keyboard.press('Escape');
    await expect(painel(page)).toBeHidden();
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#historico')).toContainText('Dados pessoais de Aluno 1000 atualizados: CPF, CANAC, Celular');
    await expect(page.locator('#historico')).not.toContainText('529');
  });

  test('o CPF ou o CANAC de outro aluno é recusado; deixar tudo vazio apaga os dados', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await abrirDadosDoAluno(page, 1000);
    await campo(page, 'CANAC').fill('123456');
    await salvar(page);
    await expect(painel(page)).toBeHidden();
    await abrirDadosDoAluno(page, 1001);
    await campo(page, 'CANAC').fill('123456');
    await salvar(page);
    await expect(painel(page).locator('[data-erro="canac"]')).toHaveText('CANAC já cadastrado para outro aluno.');
    await painel(page).getByRole('button', { name: 'Cancelar' }).click();

    await abrirDadosDoAluno(page, 1000);
    await campo(page, 'CANAC').fill('');
    await salvar(page);
    await expect(page.locator('#alu tr[data-id="1000"] .c-canac')).toHaveText('');
  });

  test('Instrutores: os mesmos dados pessoais, no cadastro dos instrutores', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await expect(page.locator('#s-ins table:has(#inst) thead th')).toHaveText(['Nome', 'CANAC', 'Peso (kg)', 'Habilitações', '']);
    await page.locator('#inst tr[data-id="2"] [data-dados]').click();
    await expect(painel(page).locator('h2')).toHaveText('Dados pessoais Instrutor 02');
    await campo(page, 'CANAC').fill('654321');
    await campo(page, 'E-mail').fill('instrutor@exemplo.com');
    await salvar(page);
    await expect(page.locator('#inst tr[data-id="2"] .c-canac')).toHaveText('654321');
  });

  test('ficam fora do cadastro e do link do Gestor; no perfil Gestor não aparecem', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await abrirDadosDoAluno(page, 1000);
    await campo(page, 'CPF').fill('52998224725');
    await campo(page, 'CANAC').fill('123456');
    await salvar(page);
    await expect(painel(page)).toBeHidden();
    const guardado = await page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'acpm4_dados_pessoais').map(k => localStorage.getItem(k)).join('|'));
    expect(guardado).not.toContain('52998224725');
    expect(guardado).not.toContain('123456');

    await irPara(page, 'esc');
    await page.locator('#btn-share-link').click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    const conteudo = Buffer.from(decodeURIComponent(new URL(link).searchParams.get('share')), 'base64').toString('utf8');
    expect(conteudo).not.toContain('52998224725');
    expect(conteudo).not.toContain('123456');

    await page.locator('#role-sel').selectOption('gestor');
    await irPara(page, 'alu');
    await expect(page.locator('#alu [data-dados]').first()).toBeHidden();
    await expect(page.locator('#s-alu thead th', { hasText: 'CANAC' })).toBeHidden();
  });
});

test.describe('Dados pessoais (modo compartilhado)', () => {
  async function entrar(browser, conta) {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(context);
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(estado(), AMANHA));
    const page = await context.newPage();
    const erros = vigiarErros(page);
    await page.goto('./?supabase=teste');
    await page.locator('#login-email').fill(conta.email);
    await page.locator('#login-senha').fill(conta.senha);
    await page.locator('#btn-entrar').click();
    await expect(page.locator('#usuario')).toBeVisible();
    return { context, servidor, page, erros };
  }

  test('a Secretaria vê Alunos e Instrutores e edita só os dados pessoais', async ({ browser }) => {
    const { context, servidor, page, erros } = await entrar(browser, CONTAS.secretaria);
    await expect(page.locator('#nav button[data-t]:visible')).toHaveText(['Escala', 'Agenda', 'Instrutores', 'Alunos']);
    await irPara(page, 'alu');
    expect(await page.locator('#alu tr[data-id="1000"] [data-f="kg"]').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
    await page.locator('#alu tr[data-id="1000"] [data-dados]').click();
    await campo(page, 'CANAC').fill('123456');
    await salvar(page);
    await expect(painel(page)).toBeHidden();
    await expect(page.locator('#alu tr[data-id="1000"] .c-canac')).toHaveText('123456');
    expect(servidor.dadosPessoais.get('aluno:1000')).toMatchObject({ canac: '123456', atualizado_por: 'Secretaria de Teste' });
    expect(erros).toEqual([]);
    await context.close();
  });

  test('o operador grava pelo servidor; o gestor não vê os dados pessoais', async ({ browser }) => {
    const operador = await entrar(browser, CONTAS.operador);
    await abrirDadosDoAluno(operador.page, 1001);
    await campo(operador.page, 'E-mail').fill('bia@exemplo.com');
    await salvar(operador.page);
    await expect(painel(operador.page)).toBeHidden();
    expect(operador.servidor.dadosPessoais.get('aluno:1001')).toMatchObject({ email: 'bia@exemplo.com' });
    await operador.context.close();

    const gestor = await entrar(browser, CONTAS.gestor);
    await irPara(gestor.page, 'alu');
    await expect(gestor.page.locator('#alu [data-dados]').first()).toBeHidden();
    await expect(gestor.page.locator('#s-alu thead th', { hasText: 'CANAC' })).toBeHidden();
    expect(gestor.erros).toEqual([]);
    await gestor.context.close();
  });
});
