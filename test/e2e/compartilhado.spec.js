import { test, expect, prepararContexto, vigiarErros, irPara, abrirEscala, lerEscala, AMANHA } from './fixtures.js';
import { criarSupabaseFalso, instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';
import { comExemplo } from '../helpers/exemplo.js';

const comDados = () => documentosAtuais(estadoSintetico(), AMANHA);

const URL_APP = './?supabase=teste';

async function entrar(page, conta, url = URL_APP) {
  await page.goto(url);
  await page.locator('#login-email').fill(conta.email);
  await page.locator('#login-senha').fill(conta.senha);
  await page.locator('#btn-entrar').click();
  await expect(page.locator('#usuario')).toBeVisible();
  // Espera os dados do servidor serem carregados (os instrutores aparecem depois da leitura)
  await expect(page.locator('#inst .cd').first()).toBeAttached();
}

async function novoContexto(browser) {
  const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await prepararContexto(contexto);
  return contexto;
}

test.describe('Modo compartilhado: gravação, conflitos e link da escala', () => {
  test('conflito: aviso fixo, a tela fica só para consulta, nada mais é enviado e "Recarregar" mostra a versão do colega', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [409] });
    await entrar(page, CONTAS.operador);

    // Um colega grava a escala da mesma data (PR-IGU em manutenção) antes desta pessoa
    const doColega = structuredClone(servidor.dias.get(AMANHA).conteudo);
    doColega.av['PR-IGU'] = false;
    servidor.alterarDiaPorOutraPessoa(AMANHA, doColega);
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect(page.locator('#aviso-sync')).toBeVisible();
    await expect(page.locator('#aviso-sync-texto')).toHaveText(
      'Outra pessoa alterou a escala enquanto você editava. A tela ficou só para consulta: recarregue para ver a versão atual e continuar (a sua última alteração não foi salva).');
    // Só para consulta (revisão de 14/11): sem os controles de edição
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    await expect(page.locator('[data-act="addi"]')).toBeHidden();

    await page.waitForTimeout(300);
    const enviadas = servidor.gravacoes.length;
    await page.locator('#eqs input[data-id="PR-JPL"]').evaluate(el => { el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(300);
    expect(servidor.gravacoes.length, 'depois do conflito nada mais é enviado').toBe(enviadas);

    await page.locator('#btn-recarregar').click();
    await expect(page.locator('#usuario')).toBeVisible();
    await expect(page.locator('#aviso-sync')).toBeHidden();
    await expect(page.locator('#eqs input[data-id="PR-IGU"]')).not.toBeChecked();
    await expect(page.locator('#eqs input[data-id="PR-BTB"]')).toBeChecked();
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('a versão anterior do app aberta numa aba: o servidor recusa pelo formato e o app pede para recarregar', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [409] });
    await entrar(page, CONTAS.operador);
    // Os dados foram atualizados por uma versão mais nova do app (o cadastro está num formato à frente deste)
    const cadastro = structuredClone(servidor.banco.get('cadastro').conteudo);
    servidor.alterarPorOutraPessoa('cadastro', { ...cadastro, esquema: cadastro.esquema + 1 });

    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect(page.locator('#aviso-sync-texto')).toHaveText('O app foi atualizado. Recarregue a página para continuar (a sua última alteração não foi salva).');
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // Revisão de 14/11: a entrada do histórico só vai para o servidor depois que a alteração foi gravada
  test('a alteração recusada (outra pessoa gravou antes) não entra no histórico: na tela, "não gravada", sem Reverter', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [409] });
    await entrar(page, CONTAS.operador);
    const doColega = structuredClone(servidor.dias.get(AMANHA).conteudo);
    doColega.av['PR-IGU'] = false;
    servidor.alterarDiaPorOutraPessoa(AMANHA, doColega);
    const registradas = servidor.historico.length;

    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect(page.locator('#aviso-sync')).toBeVisible();
    await page.locator('#btn-open-log').click();
    const entrada = page.locator('#audit-log-list .audit-item').filter({ hasText: 'PR-BTB' });
    await expect(entrada.locator('.audit-estado')).toHaveText('não gravada');
    await expect(entrada.locator('[data-act="rev-log"]')).toHaveCount(0);
    expect(servidor.historico.length, 'nada foi registrado no servidor').toBe(registradas);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('enquanto a alteração é gravada, a entrada aparece "gravando…" sem Reverter; depois, registrada e com Reverter', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    await entrar(page, CONTAS.operador);
    const registradas = servidor.historico.length;

    const liberar = servidor.segurarGravacoes();
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await page.locator('#btn-open-log').click();
    const entrada = page.locator('#audit-log-list .audit-item').filter({ hasText: 'PR-BTB' });
    await expect(entrada.locator('.audit-estado')).toHaveText('gravando…');
    await expect(entrada.locator('[data-act="rev-log"]')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(servidor.historico.length, 'o histórico espera a gravação').toBe(registradas);

    liberar();
    await expect(entrada.locator('[data-act="rev-log"]')).toBeVisible();
    await expect(entrada.locator('.audit-estado')).toHaveCount(0);
    expect(servidor.historico.length).toBe(registradas + 1);
    expect(servidor.historico.at(-1).descricao).toContain('PR-BTB');
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // Revisão de 14/11: sem conexão, as alterações esperam e são gravadas sozinhas
  test('uma missão extra grava só o dia (o cadastro, de todas as datas, não muda)', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const estado = estadoSintetico();
    const servidor = await instalarSupabaseFalso(contexto, documentosAtuais({ ...estado, stu: comExemplo(estado).stu.slice(0, 3) }, AMANHA));
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    await entrar(page, CONTAS.operador);
    const versaoDoCadastro = servidor.banco.get('cadastro').versao;
    await irPara(page, 'dem');
    await page.locator('#dem [data-act="add-mis"]').first().click();
    await expect.poll(() => servidor.gravacoes.filter(g => g.chave === `dia:${AMANHA}`).length).toBe(1);
    expect(servidor.banco.get('cadastro').versao).toBe(versaoDoCadastro);
    expect(servidor.dias.get(AMANHA).conteudo.pedidos).toBeTruthy();
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // Revisão de 14/11: a sessão que expira não perde a alteração nem vira "sem conexão"
  test('sessão expirada: o app pede a senha de novo, sem perder a alteração, e grava depois do login', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [400, 401] });
    await entrar(page, CONTAS.operador);
    const registradas = servidor.historico.length;

    servidor.expirarSessoes();
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    const dialogo = page.locator('#dlg-sessao');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(CONTAS.operador.email);
    await expect(page.locator('#aviso-sync')).toBeHidden();
    await page.locator('#sessao-senha').fill('senha errada');
    await page.locator('#sessao-entrar').click();
    await expect(page.locator('#sessao-erro')).toHaveText('Senha incorreta.');
    await page.locator('#sessao-senha').fill(CONTAS.operador.senha);
    await page.locator('#sessao-entrar').click();
    await expect(dialogo).toBeHidden();
    await expect.poll(() => servidor.dias.get(AMANHA).conteudo.av['PR-BTB']).toBe(false);
    await expect.poll(() => servidor.historico.length).toBe(registradas + 1);
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#audit-log-list .audit-item').filter({ hasText: 'PR-BTB' }).locator('[data-act="rev-log"]')).toBeVisible();
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('servidor fora do ar: o aviso conta as alterações esperando; a gravação tenta de novo sozinha e o aviso some', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    await entrar(page, CONTAS.operador);

    servidor.falharGravacoes(2);
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect(page.locator('#aviso-sync-texto')).toHaveText(
      'Sem conexão com o servidor: 1 alteração esperando para ser gravada. Ela é gravada sozinha quando a conexão voltar; não feche esta página.');
    await expect(page.locator('#btn-recarregar'), 'recarregar perderia a alteração').toBeHidden();
    // Sem nenhuma outra alteração, a gravação tenta de novo e o aviso some
    await expect(page.locator('#aviso-sync')).toBeHidden({ timeout: 15000 });
    expect(servidor.dias.get(AMANHA).conteudo.av['PR-BTB']).toBe(false);
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#audit-log-list .audit-item').filter({ hasText: 'PR-BTB' }).locator('[data-act="rev-log"]')).toBeVisible();
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('sem conexão: as alterações esperam (fechar a página pede confirmação) e são gravadas quando a conexão volta', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { ignorar: [/ERR_INTERNET_DISCONNECTED/] });
    await entrar(page, CONTAS.operador);

    // A conexão cai (o navegador sabe: quando ela volta, avisa a página)
    servidor.desconectar();
    await contexto.setOffline(true);
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await page.locator('#eqs input[data-id="PR-IGU"]').uncheck();
    await expect(page.locator('#aviso-sync-texto')).toHaveText(
      'Sem conexão com o servidor: 2 alterações esperando para serem gravadas. Elas são gravadas sozinhas quando a conexão voltar; não feche esta página.');
    const dialogo = new Promise(resolve => page.once('dialog', async d => { resolve(d.type()); await d.dismiss(); }));
    await page.close({ runBeforeUnload: true });
    expect(await dialogo, 'fechar a página com alterações esperando pede confirmação').toBe('beforeunload');
    expect(page.isClosed(), 'quem desiste continua na página').toBe(false);

    servidor.reconectar();
    await contexto.setOffline(false);
    await expect(page.locator('#aviso-sync')).toBeHidden();
    expect(servidor.dias.get(AMANHA).conteudo.av).toMatchObject({ 'PR-BTB': false, 'PR-IGU': false });
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('a escala gerada guarda a data, o link leva só a data e o gestor vê a mesma escala', async ({ browser }) => {
    const servidor = criarSupabaseFalso(documentosAtuais(comExemplo(estadoSintetico()), AMANHA));

    const operador = await novoContexto(browser);
    await servidor.instalar(operador);
    const pgOperador = await operador.newPage();
    await entrar(pgOperador, CONTAS.operador);
    await abrirEscala(pgOperador);
    // A escala calculada fica gravada (com a data) ao ser exportada
    await Promise.all([pgOperador.waitForEvent('download'), pgOperador.locator('#exp').click()]);
    await expect.poll(() => servidor.dias.get(AMANHA).conteudo.resultado && servidor.dias.get(AMANHA).conteudo.resultado.data).toBe(AMANHA);
    const escalaOperador = await lerEscala(pgOperador);
    await pgOperador.locator('#btn-share-link').click();
    const link = await pgOperador.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).searchParams.get('data')).toBe(AMANHA);
    expect(link).not.toContain('share=');

    const gestor = await novoContexto(browser);
    await servidor.instalar(gestor);
    const pgGestor = await gestor.newPage();
    const erros = vigiarErros(pgGestor);
    await entrar(pgGestor, CONTAS.gestor, link);
    await expect(pgGestor.locator('#dt')).toHaveValue(AMANHA);
    await irPara(pgGestor, 'esc');
    const escalaGestor = await lerEscala(pgGestor);
    expect(escalaGestor.linhas).toEqual(escalaOperador.linhas);
    expect(escalaGestor.resumo).toEqual(escalaOperador.resumo);
    expect(erros).toEqual([]);
    await operador.close();
    await gestor.close();
  });

  test('link antigo com os dados na URL (share=) é ignorado depois do login, com o aviso', async ({ page, context }) => {
    await instalarSupabaseFalso(context, comDados());
    const payload = { d: AMANHA, fly: [[1000, 'Aluno do Link', 70, [], 1, 'Voo Local', 'C152', 1, 2, 1, 1, 3, []]] };
    const share = encodeURIComponent(Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'));
    await entrar(page, CONTAS.operador, `${URL_APP}&share=${share}`);
    await expect(page.locator('#aviso-link-texto')).toHaveText(/^Este link antigo levava a escala no próprio endereço e não vale mais/);
    await expect(page.locator('body')).toHaveAttribute('data-role', 'operador');
    await expect(page.locator('body')).not.toHaveAttribute('data-shared', 'true');
    await irPara(page, 'alu');
    await expect(page.locator('#alu .cd')).toHaveCount(0);
  });
});
