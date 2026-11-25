// O trilho (F1b): o calendário da data aberta no lugar das setas e do campo da data. Ao lado da tela a partir de 1280 px
// (por padrão), ou um painel aberto pelo botão da data; os dias (hoje, a data aberta, domingo, os pedidos de cada um), as
// teclas, "Fixar ao lado", o celular e a gaveta do Histórico à esquerda dele. Os padrões do produto, de propósito
import { test, expect, abrir, abrirComExemplo, entrar, irPara, abrirHistorico, AMANHA, dataAberta, botaoDaData, trilho, diaDoCalendario, mudarData, larguraDaPagina, paradasDoCalendario, rotuloDaData, avisosNoTrilho, contagemDeAvisos, abrirSintetico } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

test.use({ preferencias: false });

const pedido = (id, data) => ({
  id, data, aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Voo Local', janela: 'manha', horario: null, observacao: null,
  registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: 'Secretaria de Teste', excecao: false, cancelada_em: null, cancelada_por: null
});

test.describe('O trilho ao lado', () => {
  test('a 1280 px, o calendário fica ao lado da tela: hoje, a data aberta e o domingo', async ({ page }) => {
    await abrirComExemplo(page);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
    await expect(trilho(page)).toBeVisible();
    await expect(botaoDaData(page)).not.toHaveAttribute('aria-expanded');
    const [tela, lado] = await Promise.all([page.locator('main#conteudo').boundingBox(), trilho(page).boundingBox()]);
    expect(lado.x).toBeGreaterThan(tela.x + tela.width);
    await expect(page.locator('#cal-mes')).toHaveText('Novembro de 2026');
    await expect(diaDoCalendario(page, '2026-11-10')).toHaveClass(/\bhoje\b/);
    await expect(diaDoCalendario(page, AMANHA)).toHaveAttribute('aria-current', 'date');
    await expect(diaDoCalendario(page, AMANHA)).toHaveAccessibleName('quarta-feira, 11 de novembro de 2026, amanhã, data aberta');
    await expect(page.locator('#trilho-data')).toHaveText('Amanhã · quarta-feira · 11 de novembro');
    // O domingo não abre: o aviso, e a data fica
    // (aria-disabled: o Playwright não clica no que se diz desligado; quem usa o app clica e lê o aviso)
    await diaDoCalendario(page, '2026-11-15').click({ force: true });
    await expect(page.locator('#toast-box')).toContainText('O aeroclube não opera aos domingos: não há escala nem pedidos.');
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
  });

  test('um dia abre a data: a marca, o endereço, o anúncio; ao lado, o foco fica no dia', async ({ page }) => {
    await abrirComExemplo(page);
    await diaDoCalendario(page, '2026-11-12').click();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect(page).toHaveURL(/data=2026-11-12/);
    await expect(diaDoCalendario(page, '2026-11-12')).toHaveAttribute('aria-current', 'date');
    await expect(page.locator('#anuncio')).toHaveText('Data aberta: quinta-feira, 12/11');
    await expect(diaDoCalendario(page, '2026-11-12')).toBeFocused();
    await expect(rotuloDaData(page)).toHaveText('quinta-feira, 12/11', { useInnerText: true });
  });

  test('as teclas andam pela grade, e a página do mês segue o dia', async ({ page }) => {
    await abrirComExemplo(page);
    await botaoDaData(page).click();
    await expect(diaDoCalendario(page, AMANHA)).toBeFocused();
    // Uma parada só do Tab na grade
    await expect(paradasDoCalendario(page)).toHaveCount(1);
    await page.keyboard.press('ArrowRight');
    await expect(diaDoCalendario(page, '2026-11-12')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(diaDoCalendario(page, '2026-11-19')).toBeFocused();
    await page.keyboard.press('PageDown');
    await expect(page.locator('#cal-mes')).toHaveText('Dezembro de 2026');
    await expect(diaDoCalendario(page, '2026-12-19')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(diaDoCalendario(page, '2026-12-13')).toBeFocused();
    // O domingo não abre, também pelo teclado
    await page.keyboard.press('Enter');
    await expect(page.locator('#toast-box')).toContainText('não opera aos domingos');
    await page.keyboard.press('Escape');
    await expect(botaoDaData(page)).toBeFocused();
  });

  test('a gaveta do Histórico abre à esquerda do trilho, e a data muda com ela aberta', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirHistorico(page);
    const [gaveta, lado] = await Promise.all([page.locator('#historico').boundingBox(), trilho(page).boundingBox()]);
    expect(Math.round(gaveta.x + gaveta.width)).toBe(Math.round(lado.x - 12));
    await diaDoCalendario(page, '2026-11-12').click();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect(page.locator('#historico')).toBeVisible();
  });
});

test.describe('O trilho solto', () => {
  test.use({ viewport: { width: 1100, height: 800 } });

  test('o botão da data abre o painel com o foco no calendário; a data aberta fecha o painel e o foco volta ao botão', async ({ page }) => {
    await abrirComExemplo(page);
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fechado');
    await expect(trilho(page)).toBeHidden();
    await expect(botaoDaData(page)).toHaveAttribute('aria-expanded', 'false');
    await botaoDaData(page).click();
    await expect(trilho(page)).toBeVisible();
    await expect(botaoDaData(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(diaDoCalendario(page, AMANHA)).toBeFocused();
    await diaDoCalendario(page, '2026-11-13').click();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-13');
    await expect(trilho(page)).toBeHidden();
    await expect(botaoDaData(page)).toBeFocused();
    // Esc fecha o painel
    await botaoDaData(page).click();
    await page.keyboard.press('Escape');
    await expect(trilho(page)).toBeHidden();
    await expect(botaoDaData(page)).toBeFocused();
  });

  test('"Fixar ao lado" põe o calendário ao lado e fica guardado para a largura', async ({ page }) => {
    await abrirComExemplo(page);
    await botaoDaData(page).click();
    await page.locator('#btn-fixar-trilho').click();
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
    await expect(page.locator('#btn-fixar-trilho')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-pronto', '1');
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
    // Na largura larga, o guardado da média não vale: o padrão (ao lado)
    await page.setViewportSize({ width: 1400, height: 800 });
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
    await page.locator('#btn-fixar-trilho').click();
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fechado');
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(page.locator('body')).toHaveAttribute('data-trilho', 'fixo');
  });

  test('o Gestor deste navegador também muda a data, e nada é gravado', async ({ page }) => {
    await abrirComExemplo(page, { url: './?role=gestor' });
    const antes = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    await mudarData(page, '2026-11-12');
    await expect(page.locator('#s-esc h2')).toBeVisible();
    const depois = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    expect(depois).toBe(antes);
  });
});

test.describe('O trilho no celular', () => {
  for (const largura of [390, 320]) {
    test(`a ${largura} px, o painel de ponta a ponta, com dias de 44 px, sem rolar a página de lado`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      await abrirComExemplo(page);
      await expect(page.locator('#btn-fixar-trilho')).toBeHidden();
      await botaoDaData(page).click();
      await expect(trilho(page)).toBeVisible();
      const dia = await diaDoCalendario(page, '2026-11-12').boundingBox();
      expect(dia.width).toBeGreaterThanOrEqual(44);
      expect(dia.height).toBeGreaterThanOrEqual(44);
      expect(await larguraDaPagina(page)).toBeLessThanOrEqual(largura);
      await page.locator('#btn-fechar-trilho').click();
      await expect(trilho(page)).toBeHidden();
    });
  }
});

test.describe('Os pedidos de cada dia', () => {
  test('o número de pedidos de cada dia (sem os cancelados)', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000)] }, AMANHA));
    servidor.solicitacoes.push(pedido(1, AMANHA), pedido(2, AMANHA), pedido(3, '2026-11-13'), { ...pedido(4, '2026-11-13'), cancelada_em: '2026-11-10T15:00:00.000Z' });
    await entrar(page, CONTAS.operador);
    await expect(diaDoCalendario(page, AMANHA).locator('.cal-qtd')).toHaveText('2');
    await expect(diaDoCalendario(page, '2026-11-13').locator('.cal-qtd')).toHaveText('1');
    await expect(diaDoCalendario(page, '2026-11-12').locator('.cal-qtd')).toHaveCount(0);
    await expect(diaDoCalendario(page, AMANHA)).toHaveAccessibleName('quarta-feira, 11 de novembro de 2026, amanhã, data aberta: 2 pedidos');
  });

  test('a Secretaria também vê os números', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000)] }, AMANHA));
    servidor.solicitacoes.push(pedido(1, '2026-11-13'));
    await entrar(page, CONTAS.secretaria);
    await expect(diaDoCalendario(page, '2026-11-13').locator('.cal-qtd')).toHaveText('1');
    await irPara(page, 'age');
    await expect(diaDoCalendario(page, '2026-11-13').locator('.cal-qtd')).toHaveText('1');
  });
});

test('sem a data no endereço, a Secretaria abre na primeira data que ainda aceita pedidos', async ({ page, context }) => {
  await context.clock.setFixedTime(new Date('2026-11-10T14:00:00-03:00'));
  await instalarSupabaseFalso(context, documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000)] }, AMANHA));
  await entrar(page, CONTAS.secretaria);
  await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
});

test('o link para um domingo abre a segunda, com o aviso', async ({ page }) => {
  await abrir(page, { url: './?data=2026-11-15' });
  await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-16');
  await expect(page.locator('#toast-box')).toContainText('O aeroclube não opera aos domingos: abrimos segunda-feira, 16/11.');
});

test.describe('Os avisos da data', () => {
  test('a missão que não entrou e os avisos, com o horário e o link para a Escala; o número deles no botão da data', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 1)], stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34' }), aluno(1001, {}, { kg: 0 })] }) });
    const itens = avisosNoTrilho(page);
    await expect(itens).toHaveCount(2);
    // O erro primeiro (sem horário); o aviso do voo, com o horário dele
    await expect(itens.nth(0)).toHaveClass(/\berro\b/);
    await expect(itens.nth(0)).toContainText('Aluno 1000');
    await expect(itens.nth(0).locator('.aviso-hora')).toContainText('—');
    await expect(itens.nth(1)).toHaveClass(/\baviso\b/);
    await expect(itens.nth(1).locator('time')).toHaveText(/^\d\d:\d\d$/);
    await expect(contagemDeAvisos(page)).toBeVisible();
    await expect(contagemDeAvisos(page)).toContainText('2');
    await expect(botaoDaData(page)).toHaveAccessibleName(/2 avisos nesta data/);
    await irPara(page, 'alu');
    await itens.nth(0).locator('a').click();
    await expect(page.locator('#s-esc h2')).toBeFocused();
  });

  test('sem nada a resolver: a frase, e o botão da data sem número', async ({ page }) => {
    await abrirSintetico(page);
    await expect(avisosNoTrilho(page)).toHaveCount(0);
    await expect(page.locator('#avisos-vazio')).toHaveText('Nada a resolver nesta data.');
    await expect(contagemDeAvisos(page)).toBeHidden();
  });
});
