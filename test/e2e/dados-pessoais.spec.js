// Dados pessoais de alunos e instrutores: CPF, CANAC, nascimento, celular e e-mail. Em Alunos, uma seção do detalhe com
// "Salvar" e "Desfazer" (F2); em Instrutores, o painel ao lado da tabela (até C). Ficam fora do cadastro; o histórico
// registra só os campos que mudaram. No modo compartilhado, operadores, administradores e a secretaria veem e editam; o
// gestor não vê.
import { test, expect, abrir, irPara, irParaVista, prepararContexto, vigiarErros, filtrarHabilitacoes, filtrarCursos, AMANHA, entrar as entrarNoApp, abrirHistorico, rotulosDasAbas, gradeDoDia, linhaDoInstrutor, abrirAluno, campoDoAberto, linhaDoAluno, linhasDosAlunos, nenhumNaLista } from './fixtures.js';
import { criarSupabaseFalso, instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const estado = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000), aluno(1001)] });
// O painel dos instrutores (até C)
const painel = page => page.locator('#painel-dados');
const campoDoPainel = (page, rotulo) => painel(page).getByLabel(rotulo, { exact: true });
const salvarNoPainel = page => painel(page).getByRole('button', { name: 'Salvar' }).click();
// A seção do aluno aberto
const secao = page => page.locator('#det-alu [data-pessoa]');
const campo = (page, rotulo) => secao(page).getByLabel(rotulo, { exact: true });
const salvar = page => page.locator('#det-alu-dados-salvar').click();
const rodape = page => secao(page).locator('.det-dados-rodape');
const erroDe = (page, c) => page.locator(`#det-alu-${c}-erro`);

// Abre o aluno e espera a leitura dele (os campos ligados)
async function abrirDadosDoAluno(page, id) {
  await irPara(page, 'alu');
  await abrirAluno(page, id);
  await expect(secao(page)).toHaveAttribute('data-pessoa', `aluno:${id}`);
  await expect(campo(page, 'CPF')).toBeEnabled();
}

test.describe('Dados pessoais (neste navegador)', () => {
  test('Alunos: a seção do detalhe valida e salva; a linha mostra o CANAC; o histórico registra só os campos', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await abrirDadosDoAluno(page, 1000);
    await expect(page.locator('#sec-alu-dados')).toHaveText(/Dados pessoais/);
    await campo(page, 'CPF').fill('529.982.247-24');
    await campo(page, 'CANAC').fill('12345');
    await salvar(page);
    await expect(erroDe(page, 'cpf')).toHaveText('CPF inválido.');
    await expect(erroDe(page, 'canac')).toHaveText('O CANAC tem 6 dígitos.');
    await expect(campo(page, 'CPF')).toBeFocused();
    await expect(campo(page, 'CPF')).toHaveAttribute('aria-invalid', 'true');

    await campo(page, 'CPF').fill('529.982.247-25');
    await campo(page, 'CANAC').fill('123456');
    await campo(page, 'Celular').fill('37991234567');
    await salvar(page);
    await expect(page.locator('#toast-box .toast.ok')).toHaveText('Dados pessoais de Aluno 1000 salvos.');
    await expect(rodape(page)).toHaveText(/^Atualizado em \d{2}\/\d{2}\/\d{4}/);
    await expect(linhaDoAluno(page, 1000).locator('.lista-l2')).toContainText('CANAC 123456');
    await expect(page.locator('#det-alu .det-sub')).toContainText('CANAC 123456');
    // Os valores, formatados
    await expect(campo(page, 'CPF')).toHaveValue('529.982.247-25');
    await expect(campo(page, 'Celular')).toHaveValue('(37) 99123-4567');
    // A busca acha o CANAC, para quem vê os dados pessoais
    await page.locator('[data-flt="alu"]').fill('123456');
    await expect(linhasDosAlunos(page)).toHaveCount(1);
    await page.locator('[data-flt="alu"]').fill('');
    await abrirHistorico(page);
    await expect(page.locator('#historico')).toContainText('Dados pessoais de Aluno 1000 atualizados: CPF, CANAC, Celular');
    await expect(page.locator('#historico')).not.toContainText('529');
  });

  test('o CPF ou o CANAC de outro aluno é recusado; deixar tudo vazio apaga os dados', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await abrirDadosDoAluno(page, 1000);
    await campo(page, 'CANAC').fill('123456');
    await salvar(page);
    await expect(rodape(page)).toHaveText(/^Atualizado em/);
    await abrirDadosDoAluno(page, 1001);
    await campo(page, 'CANAC').fill('123456');
    await salvar(page);
    await expect(erroDe(page, 'canac')).toHaveText('CANAC já cadastrado para outro aluno.');
    // "Desfazer" joga o rascunho fora: o campo volta ao que está guardado
    await page.locator('#det-alu-dados-desfazer').click();
    await expect(campo(page, 'CANAC')).toHaveValue('');
    await expect(campo(page, 'CPF')).toBeFocused();

    await abrirDadosDoAluno(page, 1000);
    await campo(page, 'CANAC').fill('');
    await salvar(page);
    await expect(linhaDoAluno(page, 1000).locator('.lista-l2')).not.toContainText('CANAC');
  });

  test('Instrutores: os mesmos dados pessoais, no cadastro dos instrutores (o painel, até virar lista e detalhe)', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await expect(page.locator('#s-ins table:has(#inst) thead th')).toHaveText(['Nome', 'CANAC', 'Peso (kg)', 'Habilitações', '']);
    await page.locator('#inst tr[data-id="2"] [data-dados]').click();
    await expect(painel(page).locator('h2')).toHaveText('Dados pessoais Instrutor 02');
    await campoDoPainel(page, 'CANAC').fill('654321');
    await campoDoPainel(page, 'E-mail').fill('instrutor@exemplo.com');
    await salvarNoPainel(page);
    await expect(page.locator('#inst tr[data-id="2"] .c-canac')).toHaveText('654321');
  });

  test('ficam fora do cadastro; no perfil Gestor não aparecem', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await abrirDadosDoAluno(page, 1000);
    await campo(page, 'CPF').fill('52998224725');
    await campo(page, 'CANAC').fill('123456');
    await salvar(page);
    await expect(rodape(page)).toHaveText(/^Atualizado em/);
    const guardado = await page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'acpm4_dados_pessoais').map(k => localStorage.getItem(k)).join('|'));
    expect(guardado).not.toContain('52998224725');
    expect(guardado).not.toContain('123456');

    await page.locator('#role-sel').selectOption('gestor');
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    await expect(secao(page)).toHaveCount(0);
    await expect(page.locator('#sec-alu-dados')).toHaveCount(0);
    await expect(linhaDoAluno(page, 1000).locator('.lista-l2')).not.toContainText('CANAC');
    await expect(page.locator('#det-alu .det-sub')).not.toContainText('123456');
    // A busca do Gestor não acha o CANAC
    await page.locator('[data-flt="alu"]').fill('123456');
    await nenhumNaLista(page, 'alu');
  });

  // O rascunho é da pessoa: fica na memória quando outra é escolhida, a linha dela ganha o ponto, e ele volta ao abri-la;
  // sair da página com ele pergunta antes
  test('o rascunho fica com a pessoa ao escolher outra, marcado na linha; sair da página com ele pergunta', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await abrirDadosDoAluno(page, 1000);
    await campo(page, 'E-mail').fill('ana@exemplo.com');
    await expect(page.locator('#det-alu-dados-desfazer')).toBeVisible();
    await abrirDadosDoAluno(page, 1001);
    await expect(campo(page, 'E-mail')).toHaveValue('');
    await expect(linhaDoAluno(page, 1000).locator('.lista-ponto')).toHaveClass(/\baviso\b/);
    await expect(linhaDoAluno(page, 1000).locator('.lista-ponto')).toHaveAttribute('title', 'dados pessoais não salvos');
    await abrirDadosDoAluno(page, 1000);
    await expect(campo(page, 'E-mail')).toHaveValue('ana@exemplo.com');
    // Sair da página com o rascunho pede confirmação
    let perguntou = false;
    page.on('dialog', d => { perguntou = d.type() === 'beforeunload'; d.dismiss(); });
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => perguntou).toBe(true);
  });

  // O Esc num campo digitado devolve o valor gravado também ao rascunho: o que a tela mostra é o que "Salvar" grava
  test('o Esc num campo digitado devolve o valor gravado, e o rascunho acompanha: nada de "Desfazer", nada gravado', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await abrirDadosDoAluno(page, 1000);
    await campo(page, 'E-mail').fill('ana@exemplo.com');
    await campo(page, 'E-mail').press('Escape');
    await expect(campo(page, 'E-mail')).toHaveValue('');
    await expect(campo(page, 'E-mail')).toBeFocused();
    await campo(page, 'Celular').click();
    await expect(campo(page, 'E-mail')).toHaveValue('');
    await expect(page.locator('#det-alu-dados-desfazer')).toBeHidden();
    await expect(linhaDoAluno(page, 1000).locator('.lista-ponto')).not.toHaveClass(/\baviso\b/);
    await salvar(page);
    await expect(page.locator('#toast-box .toast.ok')).toHaveText('Dados pessoais de Aluno 1000 salvos.');
    expect(await page.evaluate(() => localStorage.getItem('acpm4_dados_pessoais') || '')).not.toContain('ana@exemplo.com');
  });
});

test.describe('Dados pessoais (modo compartilhado)', () => {
  // Cada conta no seu navegador; com servidor, os navegadores dividem o mesmo servidor. viewport: a tela (o celular)
  async function entrar(browser, conta, servidorComum = null, { viewport } = {}) {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', ...(viewport ? { viewport } : {}) });
    await prepararContexto(context);
    const servidor = servidorComum || await instalarSupabaseFalso(context, documentosAtuais(estado(), AMANHA));
    if (servidorComum) await servidorComum.instalar(context);
    const page = await context.newPage();
    const erros = vigiarErros(page);
    await entrarNoApp(page, conta);
    return { context, servidor, page, erros };
  }

  test('a Secretaria vê Alunos e Instrutores e edita só os dados pessoais', async ({ browser }) => {
    const { context, servidor, page, erros } = await entrar(browser, CONTAS.secretaria);
    await expect(rotulosDasAbas(page, { visiveis: true })).toHaveText(['Agenda', 'Escala', 'Aprovar', 'Alunos', 'Instrutores', 'Cursos']);
    await irPara(page, 'alu');
    // Sem a Demanda, também sem o link para ela; o filtro dos cursos vale para ela (as caixas não ficam desligadas)
    await expect(page.locator('#s-alu .ir-para-demanda')).toBeHidden();
    await page.locator('#flt-alu-cur').click();
    await expect(page.locator('#flt-alu-cur-painel input[data-filtro]:disabled')).toHaveCount(0);
    await filtrarCursos(page, 'alu', ['PP']);
    await nenhumNaLista(page, 'alu');
    await filtrarCursos(page, 'alu', ['sem-curso']);
    await expect(linhasDosAlunos(page)).toHaveCount(2);
    await filtrarCursos(page, 'alu', []);
    // O cadastro ela lê (o texto, sem campo); os dados pessoais, ela altera
    await abrirDadosDoAluno(page, 1000);
    await expect(campoDoAberto(page, 'kg')).toHaveCount(0);
    await expect(page.locator('#det-alu [data-campo="kg"] .det-valor')).toHaveText(/kg$/);
    await campo(page, 'CANAC').fill('123456');
    await salvar(page);
    await expect(rodape(page)).toHaveText(/por Secretaria de Teste\.$/);
    await expect(linhaDoAluno(page, 1000).locator('.lista-l2')).toContainText('CANAC 123456');
    expect(servidor.dadosPessoais.get('aluno:1000')).toMatchObject({ canac: '123456', atualizado_por: 'Secretaria de Teste' });
    expect(erros).toEqual([]);
    await context.close();
  });

  // No celular (390 px), o trabalho da Secretaria: em Instrutores, o "Dados pessoais" no cartão (o painel, até C); em
  // Alunos, a seção do detalhe, com "Salvar" de 44 px e tudo dentro da tela
  test('no celular, a Secretaria chega aos dados pessoais: o cartão em Instrutores, o detalhe em Alunos', async ({ browser }) => {
    const { context, page, erros } = await entrar(browser, CONTAS.secretaria, null, { viewport: { width: 390, height: 844 } });
    await irPara(page, 'ins');
    await expect(page.locator('#s-ins')).toHaveAttribute('data-vista', 'cadastro');
    const linha = page.locator('#inst tr.cd[data-id="1"]');
    const botoes = linha.locator('td.acoes button:visible');
    await expect(botoes).toHaveText(['Dados pessoais']);
    const [cartao, botao] = await Promise.all([linha.boundingBox(), botoes.first().boundingBox()]);
    expect(botao.height).toBeGreaterThanOrEqual(44);
    expect(botao.x >= cartao.x && botao.x + botao.width <= cartao.x + cartao.width, 'o botão dentro do cartão').toBe(true);
    await botoes.first().click();
    await expect(painel(page).locator('h2')).toHaveText('Dados pessoais Instrutor 01');
    await page.keyboard.press('Escape');
    await expect(painel(page)).toBeHidden();
    await expect(botoes.first()).toBeFocused();

    await abrirDadosDoAluno(page, 1000);
    const salvarBotao = await page.locator('#det-alu-dados-salvar').boundingBox();
    expect(salvarBotao.height).toBeGreaterThanOrEqual(44);
    expect(salvarBotao.x + salvarBotao.width).toBeLessThanOrEqual(390);
    // Sem ninguém, "Priorizar com" e "Não escalar com" dizem "—"
    await expect(page.locator('#det-alu [data-campo="voaCom"] .det-valor')).toHaveText('—');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(erros).toEqual([]);
    await context.close();
  });

  // A vista de cada aba fica na memória até a página recarregar; antes de a pessoa escolher, vale a do perfil: a Secretaria
  // abre Instrutores no Cadastro (o trabalho dela ali são os dados pessoais), o Operador na Disponibilidade do dia
  test('Instrutores abre no Cadastro para a Secretaria e na Disponibilidade do dia para o Operador; a vista escolhida fica até recarregar', async ({ browser }) => {
    const secretaria = await entrar(browser, CONTAS.secretaria);
    const page = secretaria.page;
    await irPara(page, 'ins');
    await expect(page.locator('#s-ins')).toHaveAttribute('data-vista', 'cadastro');
    await expect(page.locator('#s-ins [data-vista-ins="cadastro"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#s-ins [data-vista-ins="dia"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#inst tr[data-id="1"] [data-dados]')).toBeVisible();
    await expect(gradeDoDia(page)).toBeHidden();
    // Ela busca, filtra pelas habilitações (as caixas não ficam desligadas para quem só consulta) e usa o "Limpar
    // filtros" (sem data-act: vale também para quem só consulta)
    const busca = page.locator('[data-flt="inst"]');
    await busca.fill('instrutor 02');
    await expect(page.locator('#inst .cd:visible')).toHaveCount(1);
    await busca.fill('');
    await page.locator('#flt-ins-hab').click();
    await expect(page.locator('#flt-ins-hab-painel input[data-filtro]:disabled')).toHaveCount(0);
    await filtrarHabilitacoes(page, ['noturno', 'c172']);
    await expect(page.locator('#inst .cd:visible')).toHaveCount(2);
    await expect(page.locator('#ins-contagem')).toHaveText('2 de 2 instrutores');
    await filtrarHabilitacoes(page, ['noturno', 'checa_pp']);
    await expect(page.locator('#inst tr.sem-resultado')).toBeVisible();
    await page.locator('#limpar-filtros-inst').click();
    await expect(busca).toHaveValue('');
    await expect(page.locator('#flt-ins-hab')).toHaveText('Todas as habilitações');
    await expect(page.locator('#inst .cd:visible')).toHaveCount(2);
    // A vista escolhida fica ao voltar à aba
    await irParaVista(page, 'ins', 'dia');
    await irPara(page, 'alu');
    await irPara(page, 'ins');
    await expect(page.locator('#s-ins')).toHaveAttribute('data-vista', 'dia');
    await expect(linhaDoInstrutor(page, '1')).toBeVisible();
    // Recarregada a página, vale de novo a do perfil
    await page.reload();
    await expect(page.locator('body[data-pronto]')).toBeAttached();
    await irPara(page, 'ins');
    await expect(page.locator('#s-ins')).toHaveAttribute('data-vista', 'cadastro');
    expect(secretaria.erros).toEqual([]);
    await secretaria.context.close();

    const operador = await entrar(browser, CONTAS.operador);
    await irPara(operador.page, 'ins');
    await expect(operador.page.locator('#s-ins')).toHaveAttribute('data-vista', 'dia');
    await expect(operador.page.locator('#s-ins [data-vista-ins="dia"]')).toHaveAttribute('aria-pressed', 'true');
    expect(operador.erros).toEqual([]);
    await operador.context.close();
  });

  // O mesmo servidor para os dois: o gestor entra com o CANAC e o e-mail gravados pelo operador, e não os vê
  test('o operador grava pelo servidor; o gestor não vê os dados pessoais', async ({ browser }) => {
    const servidor = criarSupabaseFalso(documentosAtuais(estado(), AMANHA));
    const operador = await entrar(browser, CONTAS.operador, servidor);
    await abrirDadosDoAluno(operador.page, 1001);
    await campo(operador.page, 'CANAC').fill('654321');
    await campo(operador.page, 'E-mail').fill('bia@exemplo.com');
    await salvar(operador.page);
    await expect(rodape(operador.page)).toHaveText(/^Atualizado em/);
    await expect(linhaDoAluno(operador.page, 1001).locator('.lista-l2')).toContainText('CANAC 654321');
    expect(servidor.dadosPessoais.get('aluno:1001')).toMatchObject({ canac: '654321', email: 'bia@exemplo.com' });
    await operador.context.close();

    const gestor = await entrar(browser, CONTAS.gestor, servidor);
    // O cliente nem pede os dados da pessoa escolhida (o servidor também os recusaria)
    const pedidos = [];
    gestor.page.on('request', r => { if (r.url().includes('/rest/v1/dados_pessoais')) pedidos.push(r.url()); });
    await irPara(gestor.page, 'alu');
    await abrirAluno(gestor.page, 1001);
    await gestor.page.waitForTimeout(600);
    expect(pedidos).toEqual([]);
    await expect(secao(gestor.page)).toHaveCount(0);
    await expect(linhaDoAluno(gestor.page, 1001).locator('.lista-l2')).not.toContainText('CANAC');
    await expect(gestor.page.locator('#s-alu')).not.toContainText('654321');
    await expect(gestor.page.locator('#s-alu')).not.toContainText('bia@exemplo.com');
    // A busca não acha o CANAC
    await gestor.page.locator('[data-flt="alu"]').fill('654321');
    await nenhumNaLista(gestor.page, 'alu');
    expect(gestor.erros).toEqual([]);
    await gestor.context.close();
  });

  test('duas pessoas editam a mesma pessoa: a segunda é avisada, vê a versão atual e não apaga o que a primeira gravou', async ({ browser }) => {
    const servidor = criarSupabaseFalso(documentosAtuais(estado(), AMANHA));
    const a = await entrar(browser, CONTAS.operador, servidor);
    const b = await entrar(browser, CONTAS.administrador, servidor);
    await abrirDadosDoAluno(a.page, 1000);
    await abrirDadosDoAluno(b.page, 1000);
    await campo(a.page, 'CANAC').fill('123456');
    await salvar(a.page);
    await expect(rodape(a.page)).toHaveText(/^Atualizado em/);

    await campo(b.page, 'Celular').fill('37991234567');
    await salvar(b.page);
    await expect(b.page.locator('#det-alu-dados-aviso')).toHaveText('Outra pessoa alterou os dados de Aluno 1000 enquanto você editava: a tela mostra a versão atual. Refaça a alteração.');
    expect(servidor.dadosPessoais.get('aluno:1000')).toMatchObject({ canac: '123456' });
    expect(servidor.dadosPessoais.get('aluno:1000').celular).toBeUndefined();
    // A seção já mostra o que a outra pessoa gravou, sem o rascunho
    await expect(campo(b.page, 'CANAC')).toHaveValue('123456');
    await expect(campo(b.page, 'Celular')).toHaveValue('');
    for (const x of [a, b]) { expect(x.erros.filter(e => !e.includes('409'))).toEqual([]); await x.context.close(); }
  });

  test('a seção lê a pessoa escolhida; sem resposta, não deixa salvar, e "Tentar de novo" lê outra vez', async ({ browser }) => {
    // (o supabase-js tenta cada leitura algumas vezes, esperando entre elas)
    test.slow();
    const { context, servidor, page, erros } = await entrar(browser, CONTAS.operador);
    // Outra pessoa grava depois do login: a seção mostra o que está no servidor
    servidor.dadosPessoais.set('aluno:1001', { canac: '777777', atualizado_em: '2026-11-10T13:00:00.000Z', atualizado_por: 'Operador 01' });
    await abrirDadosDoAluno(page, 1001);
    await expect(campo(page, 'CANAC')).toHaveValue('777777');

    servidor.falhar('/rest/v1/dados_pessoais', 20);
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    // (o supabase-js tenta a leitura de novo algumas vezes antes de desistir)
    await expect(page.locator('#det-alu-dados-aviso')).toHaveText('Não foi possível ler os dados pessoais. Tentar de novo', { timeout: 20000 });
    await expect(campo(page, 'CPF')).toBeDisabled();
    await expect(page.locator('#det-alu-dados-salvar')).toBeDisabled();
    // A leitura que falhou não se repete sozinha (cada desenho não pede outra): só "Tentar de novo" lê
    const leituras = [];
    page.on('request', r => { if (r.url().includes('/rest/v1/dados_pessoais')) leituras.push(r.url()); });
    await page.waitForTimeout(2000);
    expect(leituras).toEqual([]);
    servidor.falhar('/rest/v1/dados_pessoais', 0);
    await page.locator('#det-alu-dados-tentar').click();
    await expect(campo(page, 'CPF')).toBeEnabled({ timeout: 20000 });
    expect(erros.filter(e => !e.includes('503'))).toEqual([]);
    await context.close();
  });

  test('a alteração da secretaria vai para o histórico (só os nomes dos campos)', async ({ browser }) => {
    const { context, servidor, page, erros } = await entrar(browser, CONTAS.secretaria);
    await abrirDadosDoAluno(page, 1000);
    await campo(page, 'CANAC').fill('123456');
    await salvar(page);
    await expect(rodape(page)).toHaveText(/^Atualizado em/);
    expect(servidor.historico.map(h => [h.data, h.descricao, h.autor])).toContainEqual([AMANHA, 'Dados pessoais de Aluno 1000 atualizados: CANAC', 'Secretaria de Teste']);
    expect(erros).toEqual([]);
    await context.close();
  });

  test('excluir um aluno apaga os dados pessoais dele', async ({ browser }) => {
    const { context, servidor, page, erros } = await entrar(browser, CONTAS.operador);
    await abrirDadosDoAluno(page, 1001);
    await campo(page, 'CANAC').fill('123456');
    await salvar(page);
    await expect(rodape(page)).toHaveText(/^Atualizado em/);
    expect(servidor.dadosPessoais.has('aluno:1001')).toBe(true);
    const excluir = page.locator('#det-alu-excluir');
    await excluir.click();
    await excluir.click();
    await expect.poll(() => servidor.dadosPessoais.has('aluno:1001')).toBe(false);
    expect(erros).toEqual([]);
    await context.close();
  });

  // A recusa que chega depois de ela ter ido para outra pessoa fica com a primeira: o ponto da linha, o aviso da lista
  // com "Abrir", e a mensagem no campo quando ela é aberta de novo
  test('a recusa que chega com outra pessoa aberta: o ponto da linha, o aviso com "Abrir", a mensagem no campo', async ({ browser }) => {
    const { context, servidor, page, erros } = await entrar(browser, CONTAS.operador);
    servidor.dadosPessoais.set('aluno:1001', { canac: '123456', atualizado_em: '2026-11-10T13:00:00.000Z', atualizado_por: 'Operador 01' });
    await abrirDadosDoAluno(page, 1000);
    // A resposta da gravação espera até a pessoa ir para outro aluno
    let soltar;
    const segura = new Promise(r => { soltar = r; });
    await page.route('**/rest/v1/rpc/salvar_dados_pessoais', async rota => { await segura; await rota.fallback(); });
    await campo(page, 'CANAC').fill('123456');
    await salvar(page);
    await abrirDadosDoAluno(page, 1001);
    soltar();
    await expect(linhaDoAluno(page, 1000).locator('.lista-ponto')).toHaveClass(/\berro\b/);
    await expect(page.locator('#alu-aviso')).toHaveText('Os dados pessoais de Aluno 1000 não foram salvos: CANAC já cadastrado para outro aluno. Abrir');
    await page.locator('#alu-aviso-abrir').click();
    await expect(page.locator('#det-alu-titulo')).toHaveText('Aluno 1000');
    await expect(erroDe(page, 'canac')).toHaveText('CANAC já cadastrado para outro aluno.');
    await expect(campo(page, 'CANAC')).toHaveValue('123456');
    expect(erros.filter(e => !e.includes('400') && !e.includes('409'))).toEqual([]);
    await context.close();
  });

  // O aluno novo: os dados pessoais dele esperam a gravação que o incluiu no cadastro
  test('os dados pessoais do aluno novo esperam a gravação que o incluiu', async ({ browser }) => {
    const { context, servidor, page, erros } = await entrar(browser, CONTAS.operador);
    await irPara(page, 'alu');
    const liberar = servidor.segurarGravacoes();
    await page.locator('[data-act="adds"]').click();
    await expect(page).toHaveURL(/#\/alu\/novo$/);
    await expect(campo(page, 'CPF')).toBeEnabled();
    await campo(page, 'CANAC').fill('246810');
    await salvar(page);
    await page.waitForTimeout(300);
    expect([...servidor.dadosPessoais.values()].some(d => d.canac === '246810'), 'nada enviado antes do aluno ser gravado').toBe(false);
    liberar();
    await expect(rodape(page)).toHaveText(/^Atualizado em/);
    const id = await page.locator('#det-alu .det').getAttribute('data-id');
    expect(servidor.dadosPessoais.get(`aluno:${id}`)).toMatchObject({ canac: '246810' });
    await expect(page).toHaveURL(new RegExp(`#/alu/${id}$`));
    expect(erros).toEqual([]);
    await context.close();
  });
});
