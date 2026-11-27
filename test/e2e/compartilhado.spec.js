import { test, comProgresso, expect, abrirInstrutores, linhaDoAluno, prepararContexto, vigiarErros, irPara, abrirEscala, lerEscala, AMANHA, entrar, URL_APP, abrirHistorico, alternarDisponivel, botaoAprovar, caixaDisponivel, exportar, dataAberta, linhasDosAlunos } from './fixtures.js';
import { criarSupabaseFalso, instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';
import { comExemplo } from '../helpers/exemplo.js';

const comDados = () => documentosAtuais(estadoSintetico(), AMANHA);


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
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect(page.locator('#aviso-sync')).toBeVisible();
    await expect(page.locator('#aviso-sync-texto')).toHaveText(
      'Outra pessoa alterou a escala enquanto você editava. A tela ficou só para consulta: recarregue para ver a versão atual e continuar (a sua última alteração não foi salva).');
    // Só para consulta: sem os controles de edição (conferidos na aba aberta, a de Recursos)
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    await expect(page.locator('#btn-novo-recurso')).toBeHidden();

    await page.waitForTimeout(300);
    const enviadas = servidor.gravacoes.length;
    await caixaDisponivel(page, 'PR-JPL').evaluate(el => { el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(300);
    expect(servidor.gravacoes.length, 'depois do conflito nada mais é enviado').toBe(enviadas);

    await page.locator('#btn-recarregar').click();
    await expect(page.locator('#usuario')).toBeVisible();
    await expect(page.locator('#aviso-sync')).toBeHidden();
    await expect(caixaDisponivel(page, 'PR-IGU')).not.toBeChecked();
    await expect(caixaDisponivel(page, 'PR-BTB')).toBeChecked();
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
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect(page.locator('#aviso-sync-texto')).toHaveText('O app foi atualizado. Recarregue a página para continuar (a sua última alteração não foi salva).');
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // O cadastro alterado por outra pessoa (F2): a data é lida de novo, a tela não trava e o aviso diz o que não foi gravado.
  // A alteração refeita é gravada sem recarregar
  test('conflito no cadastro: a data é lida de novo, o aviso diz o que não foi gravado, e a alteração refeita é gravada', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [409] });
    await entrar(page, CONTAS.operador);
    // Uma colega cadastra um aluno antes desta pessoa mudar o peso de um instrutor
    const cadastro = structuredClone(servidor.banco.get('cadastro').conteudo);
    servidor.alterarPorOutraPessoa('cadastro', { ...cadastro, nid: cadastro.nid + 1, stu: [...cadastro.stu, { ...cadastro.stu[0], id: cadastro.nid, nm: 'Aluno da colega' }] });
    const id = cadastro.ins[0].id, nome = cadastro.ins[0].nm;
    await abrirInstrutores(page, 'cadastro');
    const peso = page.locator(`#inst tr[data-id="${id}"] [data-f="kg"]`);
    await peso.fill('77');
    await peso.press('Tab');
    await expect(page.locator('#aviso-sync-texto')).toHaveText(
      `Outra pessoa alterou o cadastro enquanto você editava: a tela mostra a versão atual, e esta alteração não foi gravada: Peso ${nome}: 77 kg. Refaça o que ainda for preciso.`);
    await expect(page.locator('#btn-recarregar')).toBeHidden();
    // A tela não trava: o perfil continua o de quem edita, e a versão da colega está na tela
    await expect(page.locator('body')).toHaveAttribute('data-role', 'operador');
    await expect(peso).not.toHaveValue('77');
    await page.locator('#btn-fechar-aviso').click();
    await expect(page.locator('#aviso-sync')).toBeHidden();
    // Refeita, a alteração é gravada em cima da versão da colega
    await peso.fill('77');
    await peso.press('Tab');
    await expect.poll(() => servidor.banco.get('cadastro').conteudo.ins.find(x => x.id === id).kg).toBe(77);
    expect(servidor.banco.get('cadastro').conteudo.stu.some(s => s.nm === 'Aluno da colega')).toBe(true);
    await expect(page.locator('#aviso-sync')).toBeHidden();
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // A aba velha inclui um aluno depois de uma colega incluir outro: os dois recebem o mesmo id (o nid do cadastro). A
  // inclusão é recusada; o aluno da colega fica como está, o detalhe diz que a inclusão não foi confirmada, e o endereço
  // nunca leva o id do aluno da colega
  test('conflito no cadastro ao incluir um aluno: o da colega fica, o detalhe diz que a inclusão não foi confirmada, e o endereço não leva o id dele', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [409] });
    await entrar(page, CONTAS.operador);
    const cadastro = structuredClone(servidor.banco.get('cadastro').conteudo);
    const id = cadastro.nid;
    servidor.alterarPorOutraPessoa('cadastro', { ...cadastro, nid: id + 1, stu: [...cadastro.stu, { ...cadastro.stu[0], id, nm: 'Aluno da colega' }] });
    const enderecos = [];
    page.on('framenavigated', f => { if (f === page.mainFrame()) enderecos.push(f.url()); });
    await irPara(page, 'alu');
    await page.locator('[data-act="adds"]').click();
    await expect(page.locator('#aviso-sync-texto')).toHaveText(
      'Outra pessoa alterou o cadastro enquanto você editava: a tela mostra a versão atual, e esta alteração não foi gravada: Aluno cadastrado: Novo aluno. Refaça o que ainda for preciso.');
    await expect(page.locator('#det-alu')).toContainText('A inclusão do aluno novo não foi confirmada pelo servidor.');
    await expect(page).toHaveURL(/#\/alu$/);
    await expect(linhaDoAluno(page, id).locator('.lista-titulo')).toHaveText('Aluno da colega');
    await expect(linhaDoAluno(page, id).locator('.lista-botao')).not.toHaveAttribute('aria-current', 'true');
    expect(servidor.banco.get('cadastro').conteudo.stu.find(s => s.id === id).nm).toBe('Aluno da colega');
    expect(await page.evaluate(() => location.hash)).not.toContain(String(id));
    expect(enderecos.filter(u => u.includes(`#/alu/${id}`))).toEqual([]);
    // O aluno da colega abre pelo endereço (o id da inclusão recusada não fica perdido para ele)
    await page.locator('#btn-fechar-aviso').click();
    await page.evaluate(i => { location.hash = `#/alu/${i}`; }, id);
    await expect(page.locator('#det-alu-titulo')).toHaveText('Aluno da colega');
    await expect(linhaDoAluno(page, id).locator('.lista-botao')).toHaveAttribute('aria-current', 'true');
    await expect(page).toHaveURL(new RegExp(`#/alu/${id}$`));
    // Refeito, o aluno novo entra com o id seguinte
    await page.locator('[data-act="adds"]').click();
    await expect(page).toHaveURL(new RegExp(`#/alu/${id + 1}$`));
    await expect.poll(() => servidor.banco.get('cadastro').conteudo.stu.map(s => s.nm)).toContain('Novo aluno');
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // A entrada do histórico só vai para o servidor depois que a alteração foi gravada
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
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect(page.locator('#aviso-sync')).toBeVisible();
    await abrirHistorico(page);
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
    await alternarDisponivel(page, 'PR-BTB', false);
    await abrirHistorico(page);
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

  // Sem as horas dos instrutores, os limites do mês e do ano não são conferidos; o app avisa
  comProgresso('sem as horas dos instrutores ou os resultados: aviso fixo, Aprovar escala desligado e "Tentar de novo"', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, documentosAtuais(comExemplo(estadoSintetico()), AMANHA));
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    servidor.falhar('/rpc/horas_dos_instrutores');
    servidor.falhar('/rpc/situacao_das_missoes');
    await entrar(page, CONTAS.operador);
    await expect(page.locator('#aviso-dados-texto')).toHaveText(
      'Não foi possível ler as horas de voo dos instrutores: os limites do mês e do ano não estão sendo conferidos, e Aprovar escala fica desligado. ' +
      'Não foi possível ler os resultados das missões dos cursos: a próxima missão e o registro de resultados ficam desligados.');
    await abrirEscala(page);
    await expect(botaoAprovar(page)).toBeDisabled();

    await page.locator('#btn-tentar-dados').click();
    await expect(page.locator('#aviso-dados')).toBeHidden();
    await expect(botaoAprovar(page)).toBeEnabled();
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // A sessão que expira não perde a alteração nem vira "sem conexão"
  test('sessão expirada: o app pede a senha de novo, sem perder a alteração, e grava depois do login', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [400, 401] });
    await entrar(page, CONTAS.operador);
    const registradas = servidor.historico.length;

    servidor.expirarSessoes();
    await irPara(page, 'rec');
    await alternarDisponivel(page, 'PR-BTB', false);
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
    await abrirHistorico(page);
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
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect(page.locator('#aviso-sync-texto')).toHaveText(
      'Sem conexão com o servidor: 1 alteração esperando para ser gravada. Ela é gravada sozinha quando a conexão voltar; não feche esta página.');
    await expect(page.locator('#btn-recarregar'), 'recarregar perderia a alteração').toBeHidden();
    // Sem nenhuma outra alteração, a gravação tenta de novo e o aviso some
    await expect(page.locator('#aviso-sync')).toBeHidden({ timeout: 15000 });
    expect(servidor.dias.get(AMANHA).conteudo.av['PR-BTB']).toBe(false);
    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list .audit-item').filter({ hasText: 'PR-BTB' }).locator('[data-act="rev-log"]')).toBeVisible();
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('depois de um conflito, nem o Administrador muda o programa dos cursos ou os limites da lei', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [409] });
    await entrar(page, CONTAS.administrador);
    const doColega = structuredClone(servidor.dias.get(AMANHA).conteudo);
    doColega.av['PR-IGU'] = false;
    servidor.alterarDiaPorOutraPessoa(AMANHA, doColega);
    await irPara(page, 'rec');
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect(page.locator('#aviso-sync')).toBeVisible();
    await irPara(page, 'cur');
    await expect(page.locator('#cursos')).toContainText('Só o Administrador muda; aqui é consulta.');
    await expect(page.locator('#cursos [data-act="missao-nova"]')).toHaveCount(0);
    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await expect(page.locator('#limites-lei [data-limite="vooMesH"]')).toBeDisabled();
    await expect(page.locator('#limites-lei [data-limites-padrao]')).toBeDisabled();
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // A recusa do servidor pode chegar com outra aba aberta (a gravação demorou): a aba Cursos aberta é refeita na hora e
  // fica só para consulta, sem precisar trocar de aba
  test('o conflito que chega com a aba Cursos aberta tira dela os controles de quem muda', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, comDados());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [409] });
    await entrar(page, CONTAS.administrador);
    const doColega = structuredClone(servidor.dias.get(AMANHA).conteudo);
    doColega.av['PR-IGU'] = false;
    servidor.alterarDiaPorOutraPessoa(AMANHA, doColega);
    const liberar = servidor.segurarGravacoes();
    await irPara(page, 'rec');
    await alternarDisponivel(page, 'PR-BTB', false);
    await irPara(page, 'cur');
    await expect(page.locator('#cursos')).toContainText('Só o Administrador muda.');
    // Um curso de cada vez: o "+ Missão" do PP, ainda sem programa
    await expect(page.locator('#cursos [data-act="missao-nova"]')).toHaveCount(1);
    liberar();
    await expect(page.locator('#aviso-sync')).toBeVisible();
    await expect(page.locator('#s-cur')).toBeVisible();
    await expect(page.locator('#cursos')).toContainText('Só o Administrador muda; aqui é consulta.');
    await expect(page.locator('#cursos [data-act="missao-nova"]')).toHaveCount(0);
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
    await alternarDisponivel(page, 'PR-BTB', false);
    await alternarDisponivel(page, 'PR-IGU', false);
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
    await exportar(pgOperador, 'csv');
    await expect.poll(() => servidor.dias.get(AMANHA).conteudo.resultado && servidor.dias.get(AMANHA).conteudo.resultado.data).toBe(AMANHA);
    const escalaOperador = await lerEscala(pgOperador);
    await pgOperador.locator('#btn-share-link').click();
    const link = await pgOperador.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).searchParams.get('data')).toBe(AMANHA);
    expect(link).not.toContain('share=');
    // Só a data: a tela aberta (o fragmento) não vai no link
    expect(pgOperador.url()).toContain('#/esc');
    expect(new URL(link).hash).toBe('');

    const gestor = await novoContexto(browser);
    await servidor.instalar(gestor);
    const pgGestor = await gestor.newPage();
    const erros = vigiarErros(pgGestor);
    await entrar(pgGestor, CONTAS.gestor, { url: link });
    await expect(dataAberta(pgGestor)).toHaveAttribute('data-data', AMANHA);
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
    await entrar(page, CONTAS.operador, { url: `${URL_APP}&share=${share}` });
    await expect(page.locator('#aviso-link-texto')).toHaveText(/^Este link antigo levava a escala no próprio endereço e não vale mais/);
    await expect(page.locator('body')).toHaveAttribute('data-role', 'operador');
    await irPara(page, 'alu');
    await expect(linhasDosAlunos(page)).toHaveCount(0);
  });
});
