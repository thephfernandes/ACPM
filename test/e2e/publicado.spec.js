// Verificação do site publicado com login real. Não altera os dados, exceto pela conversão para o formato atual no
// primeiro acesso de um operador (rode com --workers=1: o operador entra antes do gestor).
// Roda só quando as senhas das contas estão no ambiente; os demais testes E2E usam o modo local.
//   BASE_URL=https://thephfernandes.github.io/ACPM/ ACPM_SENHA_OPERADOR=... ACPM_SENHA_GESTOR=... ACPM_SENHA_SECRETARIA=... ACPM_SENHA_ADMIN=... ACPM_SENHA_PAINEL=... \
//     npx playwright test test/e2e/publicado.spec.js --workers=1
// ACPM_INICIO é o endereço de entrada (o padrão, ./): com BASE_URL=http://localhost:<porta>/ (npm run serve) e
// ACPM_INICIO='./?supabase=previa', roda contra a prévia a partir do app desta pasta (uma worktree, por exemplo)
import { test, expect, abrirMenuDaConta, AMANHA, preencherLogin, appPronto, botaoDaAba, campoDaAgenda, dataAberta } from './fixtures.js';

const INICIO = process.env.ACPM_INICIO || './';

const CONTAS = {
  operador: { email: process.env.ACPM_EMAIL_OPERADOR || 'operador.previa@example.com', senha: process.env.ACPM_SENHA_OPERADOR, rotulo: 'Operador' },
  gestor: { email: process.env.ACPM_EMAIL_GESTOR || 'gestor.previa@example.com', senha: process.env.ACPM_SENHA_GESTOR, rotulo: 'Gestor' }
};

test.describe('Site publicado (login real)', () => {
  test.skip(!process.env.ACPM_SENHA_OPERADOR || !process.env.ACPM_SENHA_GESTOR, 'defina BASE_URL, ACPM_SENHA_OPERADOR e ACPM_SENHA_GESTOR');

  for (const [perfil, conta] of Object.entries(CONTAS)) {
    test(`${perfil} entra e vê a escala compartilhada`, async ({ page }) => {
      await page.goto(INICIO);
      await preencherLogin(page, conta);
      await expect(page.locator('#usuario')).toContainText(`· ${conta.rotulo}`);
      await expect(page.locator('body')).toHaveAttribute('data-role', perfil);
      // No primeiro acesso de um operador depois de uma mudança de formato, o app regrava todos os dias antes de abrir
      await appPronto(page, { timeout: 30000 });
      await abrirMenuDaConta(page);
      await page.locator('#btn-sair').click();
      // Sair recarrega a página: na rede real, os módulos podem levar mais que o tempo padrão para carregar
      await expect(page.locator('#form-login')).toBeVisible({ timeout: 20000 });
    });
  }

  test('secretaria entra direto na agenda de solicitações (a escala ela só consulta)', async ({ page }) => {
    test.skip(!process.env.ACPM_SENHA_SECRETARIA, 'defina ACPM_SENHA_SECRETARIA');
    await page.goto(INICIO);
    await preencherLogin(page, { email: process.env.ACPM_EMAIL_SECRETARIA || 'secretaria.previa@example.com', senha: process.env.ACPM_SENHA_SECRETARIA });
    await expect(page.locator('#usuario')).toContainText('· Secretaria');
    await expect(page.locator('#s-age')).toBeVisible();
    await expect(page.locator('#form-agenda')).toBeVisible();
    await expect(campoDaAgenda(page, 'aluno').locator('option')).not.toHaveCount(0);
    await expect(page.locator('#agenda-prazo')).not.toBeEmpty();
    await abrirMenuDaConta(page);
    await page.locator('#btn-sair').click();
  });

  test('administrador vê as contas em Minha conta › Usuários', async ({ page }) => {
    test.skip(!process.env.ACPM_SENHA_ADMIN, 'defina ACPM_SENHA_ADMIN');
    await page.goto(INICIO);
    await preencherLogin(page, { email: process.env.ACPM_EMAIL_ADMIN || 'admin.previa@example.com', senha: process.env.ACPM_SENHA_ADMIN });
    await expect(page.locator('#usuario')).toContainText('· Administrador');
    await abrirMenuDaConta(page);
    await page.locator('#btn-conta').click();
    await expect(page.locator('#usuarios')).toBeVisible();
    await expect(page.locator('#lista-contas tbody tr')).not.toHaveCount(0);
    await abrirMenuDaConta(page);
    await page.locator('#btn-sair').click();
  });

  test('a conta da TV da recepção vai do app para o painel de hoje e não lê nenhuma tabela da escala', async ({ page }) => {
    test.skip(!process.env.ACPM_SENHA_PAINEL, 'defina ACPM_SENHA_PAINEL');
    await page.goto(INICIO);
    await preencherLogin(page, { email: process.env.ACPM_EMAIL_PAINEL || 'tv.previa@example.com', senha: process.env.ACPM_SENHA_PAINEL });
    await expect(page).toHaveURL(/painel\.html/, { timeout: 20000 });
    await expect(page.locator('.fids .fids-titulo')).toHaveText(/^(Missões|Partidas|Chegadas)$/, { timeout: 20000 });
    const linhasLidas = await page.evaluate(async () => {
      const { projetoSupabase, chaveDaSessao } = await import('./js/config-supabase.js');
      const projeto = projetoSupabase();
      // A sessão da TV (na chave dela): a do app ficou vazia
      if (localStorage.getItem(chaveDaSessao(projeto))) return 'o app ficou conectado com a conta da TV';
      const cliente = window.supabase.createClient(projeto.url, projeto.chave, { auth: { storageKey: chaveDaSessao(projeto, { painel: true }) } });
      const lidas = {};
      for (const tabela of ['documentos', 'dias', 'historico', 'solicitacoes', 'dados_pessoais']) {
        const { data } = await cliente.from(tabela).select('*').limit(1);
        lidas[tabela] = (data || []).length;
      }
      return lidas;
    });
    expect(linhasLidas).toEqual({ documentos: 0, dias: 0, historico: 0, solicitacoes: 0, dados_pessoais: 0 });
  });

  test('gestor abre uma data sem escala: vê a data nova (demanda vazia), sem gravar', async ({ page }) => {
    const conta = CONTAS.gestor;
    await page.goto(INICIO);
    await preencherLogin(page, conta);
    await appPronto(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    const instrutores = await page.locator('#inst .cd').count();
    // A data pelo endereço (no calendário, ela ficaria a centenas de meses)
    const url = new URL(page.url());
    url.searchParams.set('data', '2099-01-01');
    await page.goto(url.href);
    await appPronto(page);
    await expect(page.locator('#bi-dt')).toHaveValue('2099-01-01');
    await botaoDaAba(page, 'esc').click();
    // A data nova começa com a demanda vazia: a disponibilidade vem do dia anterior
    await expect(page.locator('#out')).toContainText(/Nenhum voo nesta data|missões pedidas/);
    await expect(page.locator('#inst .cd')).toHaveCount(instrutores);
    await abrirMenuDaConta(page);
    await page.locator('#btn-sair').click();
  });
});
