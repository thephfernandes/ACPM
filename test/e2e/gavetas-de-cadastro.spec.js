// As gavetas do cadastro (os Dados pessoais e as Habilitações, de Instrutores, até C; os de Alunos ficam no detalhe, F2) e o Esc: a gaveta continua
// aberta nas outras abas, e o Esc fecha só a camada de cima (o diálogo, o filtro, a gaveta que abriu por último ou a que
// tem o foco). Vieram de acessibilidade.spec.js
import { test, expect, abrir, abrirComExemplo, irPara, irParaVista, abrirEscala, semNome, abrirHistorico, botaoDoHistorico } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

test.describe('O Esc e as gavetas do cadastro', () => {
  // O diálogo do agendamento: o nome, a descrição (o contexto), o foco no aluno, os nomes dos campos e o alerta vazio, que
  // fica na árvore de acessibilidade (escondido sem display: none) para ser anunciado. Ele é a camada de cima: com as
  // habilitações abertas embaixo, o Esc fecha só ele, e o seguinte, as habilitações
  test('o diálogo do agendamento: nome, descrição, foco e campos com nome; o Esc fecha só ele, com as habilitações abertas embaixo', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await page.locator('#inst [data-act="editar-habs"]').first().click();
    const painel = page.locator('#painel-instrutor');
    await expect(painel).toBeVisible();
    await abrirEscala(page);
    await page.locator('#btn-agendar').focus();
    await page.keyboard.press('Enter');
    const dialogo = page.locator('#dlg-agendar');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toHaveAccessibleName('Agendar voo');
    await expect(page.locator('#agd-contexto')).not.toBeEmpty();
    await expect(dialogo).toHaveAccessibleDescription(await page.locator('#agd-contexto').textContent());
    await expect(page.locator('#agd-aluno')).toBeFocused();
    await expect(page.locator('#agd-aluno')).toHaveAccessibleName('Aluno');
    await expect(page.locator('#agd-erro')).toHaveAttribute('role', 'alert');
    expect(await page.locator('#agd-erro').evaluate(el => getComputedStyle(el).display)).not.toBe('none');
    await page.locator('#agd-aluno').selectOption({ index: 1 });
    await expect(page.locator('#agd-previa ul')).toContainText('Entra:');
    expect(await semNome(page, '#dlg-agendar')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(painel).toBeVisible();
    await expect(page.locator('#btn-agendar')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(painel).toBeHidden();
    await expect(page.locator('#log-cnt')).toHaveText('0');
  });

  test('o Esc fecha só a camada de cima: as habilitações, abertas em Instrutores, continuam abertas na Escala quando o Esc fecha o diálogo do status', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await page.locator('#inst [data-act="editar-habs"]').first().click();
    const painel = page.locator('#painel-instrutor');
    await expect(painel).toBeVisible();
    // O painel continua aberto nas outras abas
    await abrirEscala(page);
    await expect(painel).toBeVisible();
    await page.locator('#out select[data-f="fstatus"]').first().selectOption('Cancelado');
    const dialogo = page.locator('#dlg-status');
    await expect(dialogo).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(painel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(painel).toBeHidden();
  });

  // Os Dados pessoais continuam abertos nas outras abas, como as habilitações: o diálogo do agendamento é a camada de cima
  test('o Esc fecha só a camada de cima: com os Dados pessoais abertos, o primeiro fecha o diálogo do agendamento, o segundo, o painel (nada é gravado)', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await irParaVista(page, 'ins', 'cadastro');
    await page.locator('#inst tr[data-id="1"] [data-dados]').click();
    const painel = page.locator('#painel-dados');
    await expect(painel).toBeVisible();
    await abrirEscala(page);
    await expect(painel).toBeVisible();
    await page.locator('#btn-agendar').focus();
    await page.keyboard.press('Enter');
    const dialogo = page.locator('#dlg-agendar');
    await expect(dialogo).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(painel).toBeVisible();
    await expect(page.locator('#btn-agendar')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(painel).toBeHidden();
    await expect(page.locator('#log-cnt')).toHaveText('0');
  });

  // As gavetas abrem no mesmo lugar, à direita, umas sobre as outras. A de cima é a que abriu por último (ela fica por
  // cima na tela) ou a que tem o foco: o Esc fecha só ela, e o próximo, a de baixo. O Histórico abre pelo teclado, porque
  // a outra gaveta cobre o botão dele para o mouse
  const GAVETAS = [
    ['os Dados pessoais', '#painel-dados', '#dado-cpf', async page => {
      await irParaVista(page, 'ins', 'cadastro');
      await page.locator('#inst tr[data-id="1"] [data-dados]').click();
    }],
    ['as Habilitações', '#painel-instrutor', '#btn-fechar-painel-instrutor', async page => {
      await irPara(page, 'ins');
      await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
      await page.locator('#inst tr.cd[data-id="1"] [data-act="editar-habs"]').click();
    }]
  ];
  const abrirComDuasGavetas = async (page, { abrirGaveta, focoNaGaveta }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await abrirGaveta(page);
    await expect(page.locator(focoNaGaveta)).toBeFocused();
    await botaoDoHistorico(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#historico')).toBeVisible();
    await expect(page.locator('#btn-fechar-historico')).toBeFocused();
  };
  // A gaveta que aparece no meio da área das gavetas (a de cima na tela)
  const gavetaNaTela = page => page.evaluate(() => {
    const { left, top, width, height } = document.querySelector('#historico').getBoundingClientRect();
    return document.elementFromPoint(left + width / 2, top + height / 2).closest('.gaveta').id;
  });

  for (const [nome, gaveta, focoNaGaveta, abrirGaveta] of GAVETAS) {
    test(`o Esc fecha só a gaveta de cima: com ${nome} e o Histórico abertos (o Histórico por último), o primeiro fecha o Histórico, o segundo, ${nome}`, async ({ page }) => {
      await abrirComDuasGavetas(page, { abrirGaveta, focoNaGaveta });
      expect(await gavetaNaTela(page), 'o Histórico, que abriu por último, fica por cima').toBe('historico');
      await page.keyboard.press('Escape');
      await expect(page.locator('#historico')).toBeHidden();
      await expect(page.locator(gaveta)).toBeVisible();
      await expect(botaoDoHistorico(page)).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator(gaveta)).toBeHidden();
    });
  }

  test('o Esc fecha só a gaveta de cima: com o Histórico aberto, os Dados pessoais abertos depois fecham primeiro', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await irParaVista(page, 'ins', 'cadastro');
    await abrirHistorico(page);
    await expect(page.locator('#historico')).toBeVisible();
    // A gaveta do Histórico pode cobrir o botão da linha: pelo teclado
    await page.locator('#inst tr[data-id="1"] [data-dados]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#dado-cpf')).toBeFocused();
    expect(await gavetaNaTela(page)).toBe('painel-dados');
    await page.keyboard.press('Escape');
    await expect(page.locator('#painel-dados')).toBeHidden();
    await expect(page.locator('#historico')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
  });

  test('o Esc fecha a gaveta em que está o foco, mesmo a de baixo; o próximo, a outra', async ({ page }) => {
    const [, , focoNaGaveta, abrirGaveta] = GAVETAS[0];
    await abrirComDuasGavetas(page, { abrirGaveta, focoNaGaveta });
    // O foco volta para o CPF, nos Dados pessoais (embaixo do Histórico)
    await page.locator('#dado-cpf').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#painel-dados')).toBeHidden();
    await expect(page.locator('#historico')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
  });

  // As duas regras juntas: o diálogo do agendamento é a camada de cima (o Esc é só dele), e as gavetas embaixo dele
  // fecham uma de cada vez, a que abriu por último primeiro. Nada é gravado
  for (const [nome, gaveta, focoNaGaveta, abrirGaveta] of GAVETAS) {
    test(`o Esc fecha só a camada de cima: com ${nome} e o Histórico abertos, o primeiro fecha o diálogo do agendamento, o segundo, o Histórico, o terceiro, ${nome}`, async ({ page }) => {
      await abrirComDuasGavetas(page, { abrirGaveta, focoNaGaveta });
      await abrirEscala(page);
      // As gavetas podem cobrir o botão: pelo teclado
      await page.locator('#btn-agendar').focus();
      await page.keyboard.press('Enter');
      const dialogo = page.locator('#dlg-agendar');
      await expect(dialogo).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialogo).toBeHidden();
      await expect(page.locator('#historico')).toBeVisible();
      await expect(page.locator(gaveta)).toBeVisible();
      await expect(page.locator('#btn-agendar')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('#historico')).toBeHidden();
      await expect(page.locator(gaveta)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator(gaveta)).toBeHidden();
      await expect(page.locator('#log-cnt')).toHaveText('0');
    });
  }

  // Na aba Cursos, com o foco num campo do programa (fora das gavetas), vale a mesma regra: o Esc fecha a gaveta que abriu
  // por último, e o foco fica no campo
  test('o Esc fecha só a gaveta de cima também na aba Cursos: com o foco no nome do curso, o primeiro fecha o Histórico, o segundo, os Dados pessoais', async ({ page }) => {
    const [, gaveta, focoNaGaveta, abrirGaveta] = GAVETAS[0];
    await abrirComDuasGavetas(page, { abrirGaveta, focoNaGaveta });
    await irPara(page, 'cur');
    const nome = page.locator('#cursos .curso[data-curso="PP"] [data-cc="nome"]');
    await nome.focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
    await expect(page.locator(gaveta)).toBeVisible();
    await expect(nome).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator(gaveta)).toBeHidden();
    await expect(page.locator('#log-cnt')).toHaveText('0');
  });

  // O filtro das habilitações (Instrutores) é um painel da própria página: o Esc com o foco nele fecha só ele (ouvido na
  // captura, ele para ali), e as gavetas continuam abertas; os próximos fecham as gavetas, a de cima primeiro. As marcas
  // ficam
  test('o Esc fecha só a camada de cima: com as Habilitações e o Histórico abertos, o primeiro fecha o filtro das habilitações, o segundo, o Histórico, o terceiro, as Habilitações', async ({ page }) => {
    const [, gaveta, focoNaGaveta, abrirGaveta] = GAVETAS[1];
    await abrirComDuasGavetas(page, { abrirGaveta, focoNaGaveta });
    // As gavetas podem cobrir o botão do filtro: pelo teclado
    const botao = page.locator('#flt-ins-hab'), painel = page.locator('#flt-ins-hab-painel');
    await botao.focus();
    await page.keyboard.press('Enter');
    await expect(painel).toBeVisible();
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    // A caixa marcada pelo teclado (o espaço na caixa é um clique dentro do painel: ele continua aberto)
    const noturno = painel.locator('input[data-valor="noturno"]');
    await noturno.focus();
    await page.keyboard.press('Space');
    await expect(noturno).toBeChecked();
    await expect(painel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(painel).toBeHidden();
    await expect(botao).toHaveAttribute('aria-expanded', 'false');
    await expect(botao).toBeFocused();
    await expect(page.locator('#historico')).toBeVisible();
    await expect(page.locator(gaveta)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
    await expect(page.locator(gaveta)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(gaveta)).toBeHidden();
    await expect(page.locator('#inst tr.cd[data-id="1"] [data-act="editar-habs"]')).toBeFocused();
    await expect(botao).toHaveText('Habilitações: Noturno');
  });
});
