import { test, expect, abrir, irPara, abrirMenuDaConta } from './fixtures.js';

test.describe('Aplicação', () => {
  test('abre na Escala, com as abas na ordem de uso e sem números', async ({ page }) => {
    await abrir(page);
    await expect(page).toHaveTitle('AutoEscala - ACPM');
    await expect(page.locator('meta[name="application-name"]')).toHaveAttribute('content', 'AutoEscala - ACPM');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'AutoEscala');
    await expect(page.locator('#nav button .aba-rotulo')).toHaveText(['Escala', 'Demanda', 'Agenda', 'Recursos', 'Instrutores', 'Alunos', 'Rodízio', 'BI']);
    await expect(page.locator('#s-esc')).toBeVisible();
    await expect(page.locator('#nav button[data-t="esc"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('#s-rec')).toBeHidden();
    // Sem botão Desfazer: para voltar atrás, basta alterar de novo
    await expect(page.locator('#btn-undo')).toHaveCount(0);
  });

  test('o logo do ACPM no topo e como ícone da página; no topo, a águia e "AutoEscala", alinhados, sem a sigla', async ({ page }) => {
    await abrir(page);
    const icone = page.locator('link[rel="icon"]');
    await expect(icone).toHaveAttribute('href', 'img/favicon-32.png');
    expect((await page.request.get(await icone.evaluate(l => l.href))).ok()).toBe(true);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'img/apple-touch-icon.png');
    const logo = page.locator('.topo-marca img.topo-logo');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('alt', '');
    expect(await logo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.locator('.topo-marca')).toHaveText('AutoEscala');
    await expect(page.locator('.topo-sigla')).toHaveCount(0);
    const centros = await page.evaluate(() => ['.topo-logo', '.topo-titulo'].map(s => {
      const r = document.querySelector(s).getBoundingClientRect();
      return r.top + r.height / 2;
    }));
    expect(Math.max(...centros) - Math.min(...centros)).toBeLessThanOrEqual(1);
  });

  test('a data em uso fica no topo, em todas as abas; os botões ‹ e › trocam o dia', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('#dt-rotulo')).toHaveText('quarta-feira, 11/11');
    await expect(page.locator('#dt-rel')).toHaveText('amanhã');
    await irPara(page, 'dem');
    await expect(page.locator('#dt-rotulo')).toBeVisible();
    await page.locator('#dt-prox').click();
    await expect(page.locator('#dt')).toHaveValue('2026-11-12');
    await expect(page.locator('#dt-rotulo')).toHaveText('quinta-feira, 12/11');
    await expect(page.locator('#dt-rel')).toBeHidden();
    await page.locator('#dt-ant').click();
    await expect(page.locator('#dt')).toHaveValue('2026-11-11');
    await page.locator('#dt-ant').click();
    await expect(page.locator('#dt')).toHaveValue('2026-11-10');
    await expect(page.locator('#dt-rel')).toHaveText('hoje');
  });

  test('o controle da data tem tamanho fixo: as setas não saem do lugar quando o texto muda', async ({ page }) => {
    await abrir(page);
    const caixas = () => page.evaluate(() => ['.topo-data', '#dt-ant', '#dt-prox'].map(s => {
      const r = document.querySelector(s).getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.width)];
    }));
    const inicial = await caixas();
    for (const data of ['2026-11-12', '2026-11-10', '2026-11-14', '2026-11-16', '2027-01-04', '2026-12-31']) {
      await page.locator('#dt').fill(data);
      await expect(page.locator('#dt')).toHaveValue(data);
      expect(await caixas(), data).toEqual(inicial);
    }
  });

  test('navega pelas abas; sem os botões "Próximo" de um passo a passo', async ({ page }) => {
    await abrir(page);
    for (const aba of ['ins', 'alu', 'dem', 'esc', 'bi', 'rec']) {
      await irPara(page, aba);
      await expect(page.locator(`#nav button[data-t="${aba}"]`)).toHaveClass(/\bon\b/);
      await expect(page.locator('section.on')).toHaveCount(1);
    }
    await expect(page.locator('[data-go]')).toHaveCount(0);
  });

  test('aplica a folha de estilos (tokens de cor, layout e fontes)', async ({ page }) => {
    const fontes = [];
    page.on('request', r => { if (r.url().startsWith('https://fonts.googleapis.com/css2?family=Barlow')) fontes.push(r.url()); });
    await abrir(page);
    const estilos = () => page.evaluate(() => ({
      tinta: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
      fundo: getComputedStyle(document.body).backgroundColor,
      fonte: getComputedStyle(document.body).fontFamily,
      secaoInativa: getComputedStyle(document.querySelector('#s-bi')).display,
      principalMax: getComputedStyle(document.querySelector('main')).maxWidth
    }));
    expect(await estilos()).toEqual({
      tinta: '#12263A', fundo: 'rgb(238, 242, 245)', fonte: expect.stringContaining('Barlow'), secaoInativa: 'none', principalMax: '1280px'
    });
    expect(fontes).toHaveLength(1);

    await abrirMenuDaConta(page);
    await page.locator('#btn-theme').click();
    expect((await estilos()).fundo).not.toBe('rgb(238, 242, 245)');
  });

  test('alterna o tema e lembra a escolha após recarregar', async ({ page }) => {
    await abrir(page);
    const html = page.locator('html');
    await abrirMenuDaConta(page);
    const tema = page.locator('#btn-theme');
    // Um interruptor com ícones (sol e lua), sem o texto "Tema claro ou escuro"
    await expect(tema).toHaveAttribute('role', 'menuitemcheckbox');
    await expect(tema).toHaveAttribute('aria-label', 'Tema escuro');
    await expect(tema).toHaveAttribute('aria-checked', 'false');
    await expect(tema).toHaveText('');
    await expect(tema.locator('use')).toHaveCount(2);
    await tema.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(tema).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#menu-conta')).toBeVisible();
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await abrirMenuDaConta(page);
    await page.locator('#btn-theme').click();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('o botão Manual abre, de qualquer aba, o manual com as regras em vigor', async ({ page }) => {
    await abrir(page);
    await irPara(page, 'dem');
    await page.locator('#btn-manual').click();
    const manual = page.locator('#s-manual');
    await expect(manual).toBeVisible();
    await expect(page.locator('#s-dem')).toBeHidden();

    // As tabelas de regras saem do código (missões, janelas, pesos e rodízio)
    await expect(page.locator('#manual-missoes tbody tr')).toHaveCount(18);
    await expect(page.locator('#manual-missoes tbody tr', { hasText: 'Cheque PC MLTE IFR' })).toContainText('Checador MLTE IFR');
    await expect(page.locator('#manual-janelas li')).toHaveCount(9);
    await expect(page.locator('#manual-pesos')).toContainText('C152: 170 kg');
    await expect(page.locator('#manual-rodizio li')).toHaveText(['Voos de cheque', 'Voo MLTE (PA-34)', 'Voo noturno', 'Voo C172']);

    await expect(manual.locator('h2')).toHaveText('Manual do AutoEscala');
    // Nada das regras e dos nomes antigos
    const texto = await manual.innerText();
    for (const antigo of ['A01', 'A09', 'Gerar escala', 'Preencher exemplo', 'Link Blindado', 'Importar Solicitações da Agenda',
      'Vai voar?', 'Início pref', 'Exportar CSV', 'Emitir PDF', 'Turno rápido', 'Cada cartão', 'campo Data', 'Equipamento', 'Bloquear',
      'Sessões', 'sessão', 'Desfazer', 'Escala de Voo', 'Por avião e sala', 'Avião / sala', 'Aviões e salas']) {
      expect(texto, antigo).not.toContain(antigo);
    }
    await expect(manual.locator('h3')).toHaveText(['Primeiros passos: a rotina do operador', 'Perfis de acesso', 'As abas',
      'Como a escala é montada', 'Para o gestor', 'TV da recepção', 'Perguntas frequentes']);
    // As abas na ordem do app, sem números, com os nomes novos dos botões e das vistas
    await expect(manual.locator('#manual-abas h4')).toHaveText(['Escala', 'Demanda', 'Agenda', 'Recursos', 'Instrutores', 'Alunos', 'Rodízio', 'BI']);
    for (const novo of ['menu da conta', 'Pôr um aluno na demanda', 'Disponibilidade do dia', 'Editar habilitações', 'Não escalar com',
      'Ainda não importado', 'Atualizada às', 'Ver todos', 'Compartilhar', 'Por recurso', 'Novo recurso', 'Retirar', 'Horários de decolagem',
      'de 30 em 30 minutos', 'divide as horas do dia']) {
      expect(texto, novo).toContain(novo);
    }

    // O índice leva às seções e as abas continuam funcionando
    await manual.locator('.manual-indice a[href="#manual-regras"]').click();
    await expect(page.locator('#manual-regras')).toBeInViewport();
    await irPara(page, 'esc');
    await expect(manual).toBeHidden();
  });

  test('o manual tem a largura das outras páginas e fica centralizado', async ({ page }) => {
    await abrir(page);
    await irPara(page, 'rec');
    const outra = await page.locator('#s-rec .pn').first().boundingBox();
    await page.locator('#btn-manual').click();
    const cartao = await page.locator('#s-manual .pn').first().boundingBox();
    expect(Math.round(cartao.x)).toBe(Math.round(outra.x));
    expect(Math.round(cartao.width)).toBe(Math.round(outra.width));
    const largura = await page.evaluate(() => document.documentElement.clientWidth);
    expect(Math.abs(cartao.x - (largura - cartao.x - cartao.width))).toBeLessThanOrEqual(1);
  });

  test('o manual saiu do fim da aba BI', async ({ page }) => {
    await abrir(page);
    await irPara(page, 'bi');
    await expect(page.locator('#s-bi details, #s-bi .manual-panel')).toHaveCount(0);
  });
});
