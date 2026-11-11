// Minha conta (trocar a senha e o e-mail) e Usuários (o administrador cria e exclui contas), no modo compartilhado.
import { test, expect, prepararContexto, vigiarErros, abrirMenuDaConta, AMANHA, irPara } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';

const URL_APP = './?supabase=teste';

async function entrar(page, conta, senha = conta.senha) {
  await page.goto(URL_APP);
  await page.locator('#login-email').fill(conta.email);
  await page.locator('#login-senha').fill(senha);
  await page.locator('#btn-entrar').click();
  await expect(page.locator('#usuario')).toBeVisible();
}

async function abrirMinhaConta(page) {
  await abrirMenuDaConta(page);
  await page.locator('#btn-conta').click();
  await expect(page.locator('#s-conta')).toBeVisible();
}

test.describe('Minha conta', () => {
  test('troca a senha depois de conferir a atual; o login passa a usar a nova', async ({ browser }) => {
    // A senha atual errada responde 400 de propósito
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(context);
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), AMANHA));
    const page = await context.newPage();
    const erros = vigiarErros(page, { statusEsperados: [400] });
    await entrar(page, CONTAS.operador);
    await abrirMinhaConta(page);
    await expect(page.locator('#conta-dados')).toContainText('operador@teste.acpm');
    await expect(page.locator('#conta-dados')).toContainText('Operador');

    const trocar = async (atual, nova, repetida = nova) => {
      await page.locator('#senha-atual').fill(atual);
      await page.locator('#senha-nova').fill(nova);
      await page.locator('#senha-repetida').fill(repetida);
      await page.locator('#form-senha [type="submit"]').click();
    };
    await trocar(CONTAS.operador.senha, 'uma senha nova bem longa', 'outra senha diferente');
    await expect(page.locator('#senha-msg')).toHaveText('As duas senhas novas não são iguais.');
    await trocar('senha errada', 'uma senha nova bem longa');
    await expect(page.locator('#senha-msg')).toHaveText('Senha atual incorreta.');
    await trocar(CONTAS.operador.senha, 'uma senha nova bem longa');
    await expect(page.locator('#senha-msg')).toHaveText('Senha trocada.');
    expect(servidor.senhaDe(CONTAS.operador)).toBe('uma senha nova bem longa');
    await expect(page.locator('#senha-atual')).toHaveValue('');

    await abrirMenuDaConta(page);
    await page.locator('#btn-sair').click();
    await expect(page.locator('#form-login')).toBeVisible();
    await page.locator('#login-email').fill(CONTAS.operador.email);
    await page.locator('#login-senha').fill('uma senha nova bem longa');
    await page.locator('#btn-entrar').click();
    await expect(page.locator('#usuario')).toBeVisible();
    expect(erros).toEqual([]);
    await context.close();
  });

  test('pede a troca do e-mail: o novo só vale depois dos links de confirmação', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), AMANHA));
    await entrar(page, CONTAS.gestor);
    await abrirMinhaConta(page);
    await page.locator('#email-novo').fill('gestor.novo@teste.acpm');
    await page.locator('#email-senha').fill(CONTAS.gestor.senha);
    await page.locator('#form-email [type="submit"]').click();
    await expect(page.locator('#email-msg')).toContainText('gestor@teste.acpm');
    await expect(page.locator('#email-msg')).toContainText('gestor.novo@teste.acpm');
    expect(servidor.trocasDeEmail.map(t => [t.de, t.para])).toEqual([['gestor@teste.acpm', 'gestor.novo@teste.acpm']]);
    await expect(page.locator('#usuarios')).toBeHidden();
  });
});

// O Supabase Auth volta ao site com o resultado no fragmento da URL (fluxo implícito do supabase-js)
test.describe('Volta dos links de confirmação da troca de e-mail', () => {
  const PRIMEIRO_LINK = '#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email';
  const LINK_EXPIRADO = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

  test('o primeiro link avisa que falta abrir o outro, já na tela de login', async ({ page, context }) => {
    await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), AMANHA));
    await page.goto(URL_APP + PRIMEIRO_LINK);
    await expect(page.locator('#aviso-link')).toHaveText(/Link confirmado\. Para concluir a troca de e-mail, abra também o link enviado para o outro endereço\./);
    await expect(page.locator('#form-login')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
  });

  test('o link expirado avisa, sai da URL e não encerra a sessão deste navegador', async ({ page, context }) => {
    await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), AMANHA));
    await entrar(page, CONTAS.gestor);
    await page.goto('about:blank');
    await page.goto(URL_APP + LINK_EXPIRADO);
    await expect(page.locator('#aviso-link')).toContainText('Este link de confirmação expirou ou já foi usado.');
    await expect(page.locator('#usuario')).toHaveText('Gestor de Teste · Gestor');
    expect(new URL(page.url()).hash).toBe('');
    await page.locator('#aviso-link button').click();
    await expect(page.locator('#aviso-link')).toBeHidden();
  });

  test('o segundo link conclui a troca: entra com o e-mail novo', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), AMANHA));
    await entrar(page, CONTAS.gestor);
    await abrirMinhaConta(page);
    await page.locator('#email-novo').fill('gestor.novo@teste.acpm');
    await page.locator('#email-senha').fill(CONTAS.gestor.senha);
    await page.locator('#form-email [type="submit"]').click();
    await expect(page.locator('#email-msg')).toContainText('gestor.novo@teste.acpm');

    // O link abre numa aba nova do mesmo navegador
    const link = await context.newPage();
    const erros = vigiarErros(link);
    await link.goto(URL_APP + servidor.confirmarTrocaDeEmail());
    await expect(link.locator('#aviso-link')).toHaveText(/Troca de e-mail concluída: agora você entra com gestor\.novo@teste\.acpm\./);
    await expect(link.locator('#usuario')).toHaveText('Gestor de Teste · Gestor');
    expect(new URL(link.url()).hash).toBe('');
    await abrirMinhaConta(link);
    await expect(link.locator('#conta-dados')).toContainText('gestor.novo@teste.acpm');
    expect(erros).toEqual([]);
  });
});

// Itens do menu da conta pelo nome (o tema é um interruptor só com ícones: o nome vem do aria-label)
const itensDoMenu = page => page.locator('#menu-conta [role^="menuitem"]:visible')
  .evaluateAll(itens => itens.map(i => i.getAttribute('aria-label') || i.textContent.trim()));

test.describe('Menu da conta', () => {
  test('reúne Minha conta, o tema e Sair; Esc fecha o menu', async ({ page, context }) => {
    await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), AMANHA));
    await entrar(page, CONTAS.operador);
    await expect(page.locator('#menu-conta')).toBeHidden();
    await abrirMenuDaConta(page);
    expect(await itensDoMenu(page)).toEqual(['Minha conta', 'Tema escuro', 'Sair']);
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-conta')).toBeHidden();
    await abrirMenuDaConta(page);
    await page.locator('#s-esc h2').click();
    await expect(page.locator('#menu-conta')).toBeHidden();
  });

  test('o administrador tem Usuários no menu, que leva direto à lista de contas', async ({ page, context }) => {
    await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), AMANHA));
    await entrar(page, CONTAS.administrador);
    await abrirMenuDaConta(page);
    expect(await itensDoMenu(page)).toEqual(['Minha conta', 'Usuários', 'Tema escuro', 'Sair']);
    await page.locator('#btn-usuarios').click();
    await expect(page.locator('#usuarios')).toBeVisible();
    await expect(page.locator('#lista-contas tbody tr')).toHaveCount(5);
  });
});

test.describe('Usuários (administrador)', () => {
  test('o administrador cria e exclui contas; não exclui a própria', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), AMANHA));
    await entrar(page, CONTAS.administrador);
    await expect(page.locator('#usuario')).toHaveText('Admin de Teste · Administrador');
    await abrirMinhaConta(page);
    const linhas = page.locator('#lista-contas tbody tr');
    await expect(linhas).toHaveCount(5);
    await expect(page.locator('#lista-contas tr', { hasText: 'admin@teste.acpm' }).locator('[data-act="excluir-conta"]')).toBeDisabled();

    await page.locator('#nc-nome').fill('Maria Secretaria');
    await page.locator('#nc-email').fill('Maria@Teste.ACPM');
    await page.locator('#nc-perfil').selectOption('secretaria');
    await page.locator('#nc-gerar').click();
    const senha = await page.locator('#nc-senha').inputValue();
    expect(senha.length).toBeGreaterThanOrEqual(12);
    await page.locator('#form-nova-conta [type="submit"]').click();
    await expect(page.locator('#nc-msg')).toContainText('Conta criada para maria@teste.acpm');
    await expect(linhas).toHaveCount(6);
    expect(servidor.contasCriadas.map(c => [c.email, c.perfil, c.nome, c.senha])).toEqual([['maria@teste.acpm', 'secretaria', 'Maria Secretaria', senha]]);

    const excluir = page.locator('#lista-contas tr', { hasText: 'maria@teste.acpm' }).locator('[data-act="excluir-conta"]');
    await excluir.click();
    await expect(excluir).toHaveText('Confirmar exclusão');
    await excluir.click();
    await expect(linhas).toHaveCount(5);
    expect(servidor.contasCriadas).toEqual([]);
  });

  test('o administrador também opera a escala', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), AMANHA));
    await entrar(page, CONTAS.administrador);
    await irPara(page, 'rec');
    await expect(page.locator('#wins input[data-a="win"]').first()).toBeAttached();
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect.poll(() => servidor.dias.get(AMANHA).conteudo.av['PR-BTB']).toBe(false);
  });

  test('o operador não vê Usuários', async ({ page, context }) => {
    await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), AMANHA));
    await entrar(page, CONTAS.operador);
    await abrirMinhaConta(page);
    await expect(page.locator('#usuarios')).toBeHidden();
  });
});
