// A casca (F1a): a linha das etapas no lugar das abas, as telas com nome e endereço (#/<tela>[/<item>]), quem vê cada uma,
// Aprovar, Voltar e Avançar, a rolagem de cada entrada e o estado da linha (aberta, recolhida ou a faixa do celular). Os
// padrões do produto, de propósito: nenhum teste guarda uma preferência antes
import { test, expect, abrir, abrirComExemplo, entrar, irPara, abrirEscala, aprovar, botaoAprovar, botaoReabrir, botaoDaAba, rotulosDasAbas, mudarData, AMANHA } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';
import { comExemplo } from '../helpers/exemplo.js';

// Os padrões do produto: nada guardado neste navegador (o trilho ao lado a partir de 1280 px, a linha pela largura)
test.use({ preferencias: false });

const atual = page => page.locator('[aria-current="page"]');
const cartao = (page, id) => page.locator(`#linha li.estagio[data-estagio="${id}"]`);
const endereco = page => new URL(page.url());

test.describe('A linha e as telas', () => {
  test('cada cartão e cada link abre a tela dele, com o endereço e um só aria-current', async ({ page }) => {
    await abrirComExemplo(page);
    await expect(page).toHaveURL(/#\/esc$/);
    for (const [tela, secao] of [['age', 's-age'], ['dem', 's-dem'], ['esc', 's-esc'], ['alu', 's-alu'], ['ins', 's-ins'], ['rec', 's-rec'], ['cur', 's-cur'], ['rod', 's-rod'], ['bi', 's-bi']]) {
      await botaoDaAba(page, tela).click();
      await expect(page.locator(`#${secao}`)).toBeVisible();
      await expect(page.locator('main#conteudo > section.on')).toHaveCount(1);
      await expect(atual(page)).toHaveCount(1);
      await expect(atual(page)).toHaveAttribute('href', `#/${tela}`);
      expect(endereco(page).hash).toBe(`#/${tela}`);
      expect(endereco(page).searchParams.get('data')).toBe(AMANHA);
    }
    await page.locator('#btn-manual').click();
    await expect(page.locator('#s-manual h2')).toBeFocused();
    await expect(atual(page)).toHaveCount(1);
    await expect(atual(page)).toHaveId('btn-manual');
    expect(endereco(page).hash).toBe('#/manual');
  });

  test('o cartão da tela aberta tem a borda de destaque; os outros, não', async ({ page }) => {
    await abrirComExemplo(page);
    const borda = id => cartao(page, id).evaluate(li => getComputedStyle(li).borderTopWidth);
    expect(await borda('escala')).toBe('2px');
    expect(await borda('pedidos')).toBe('1px');
    await irPara(page, 'age');
    expect(await borda('pedidos')).toBe('2px');
    expect(await borda('escala')).toBe('1px');
  });

  test('Voltar e Avançar trocam a tela, não a data; recarregar fica na tela e na data', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'alu');
    await irPara(page, 'rec');
    await mudarData(page, '2026-11-12');
    await irPara(page, 'cur');
    await page.goBack();
    await expect(page.locator('#s-rec')).toBeVisible();
    await expect(page).toHaveURL(/data=2026-11-12#\/rec$/);
    // A entrada de Alunos foi criada com a data de antes: a data aberta volta para o endereço
    await page.goBack();
    await expect(page.locator('#s-alu')).toBeVisible();
    await expect(atual(page)).toHaveAttribute('href', '#/alu');
    await expect(page).toHaveURL(/data=2026-11-12#\/alu$/);
    await expect(page.locator('body')).toHaveAttribute('data-data', '2026-11-12');
    await page.goForward();
    await expect(page.locator('#s-rec')).toBeVisible();
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-pronto', '1');
    await expect(page.locator('#s-rec')).toBeVisible();
    await expect(page).toHaveURL(/data=2026-11-12#\/rec$/);
    await page.goBack();
    await expect(page.locator('#s-alu')).toBeVisible();
  });

  // O clique é dado sem rolar até o link (o Playwright rolaria a página até ele antes de clicar)
  test('Voltar devolve a rolagem da tela de antes', async ({ page }) => {
    await abrirComExemplo(page);
    await page.locator('#btn-manual').click();
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500);
    await page.evaluate(() => document.querySelector('#linha a[href="#/bi"]').click());
    await expect(page.locator('#s-bi')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.goBack();
    await expect(page.locator('#s-manual')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500);
  });

  test('um endereço com a tela abre nela; um item de uma vez sai do endereço depois de usado', async ({ page }) => {
    await abrir(page, { url: './#/cur' });
    await expect(page.locator('#s-cur')).toBeVisible();
    await expect(atual(page)).toHaveAttribute('href', '#/cur');
    await page.goto('./#/manual/manual-aba-rodizio');
    await expect(page.locator('body')).toHaveAttribute('data-pronto', '1');
    await expect(page.locator('#manual-aba-rodizio')).toBeInViewport();
    await expect(page).toHaveURL(/#\/manual$/);
  });

  test('uma tela que o perfil não vê volta para a dele: #/conta sem o servidor, #/dem para a Secretaria', async ({ page, context }) => {
    await abrir(page, { url: './#/conta' });
    await expect(page.locator('#s-esc')).toBeVisible();
    await expect(page).toHaveURL(/#\/esc$/);

    await instalarSupabaseFalso(context, documentosAtuais(comExemplo(estadoSintetico()), AMANHA));
    await entrar(page, CONTAS.secretaria, { url: './?supabase=teste#/dem' });
    await expect(page.locator('#s-age')).toBeVisible();
    await expect(page.locator('#s-dem')).toBeHidden();
    await expect(page).toHaveURL(/#\/age$/);
  });

  test('o que cada perfil vê na linha: a Secretaria sem a Demanda, os Recursos, o Rodízio e o BI', async ({ page, context }) => {
    await instalarSupabaseFalso(context, documentosAtuais(comExemplo(estadoSintetico()), AMANHA));
    await entrar(page, CONTAS.secretaria);
    await expect(rotulosDasAbas(page, { visiveis: true })).toHaveText(['Agenda', 'Escala', 'Aprovar', 'Alunos', 'Instrutores', 'Cursos']);
    await expect(page.locator('#linha .linha-sep')).toBeHidden();
    await expect(atual(page)).toHaveAttribute('href', '#/age');
  });

  test('o link que pula para o conteúdo leva o foco para dentro dele sem mudar o endereço', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'alu');
    const antes = page.url();
    await page.locator('a.pular').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#conteudo')).toBeFocused();
    expect(page.url()).toBe(antes);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('main#conteudo').contains(document.activeElement))).toBe(true);
  });
});

test.describe('Aprovar', () => {
  test('o cartão mostra a aprovação da Escala, contornada, com o foco no botão e o estado anunciado', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'dem');
    await botaoDaAba(page, 'apr').click();
    await expect(page.locator('#s-esc')).toBeVisible();
    await expect(atual(page)).toHaveAttribute('href', '#/apr');
    await expect(page.locator('#compactacao')).toBeInViewport();
    await expect(page.locator('#aprovacao')).toHaveClass(/\bdestaque\b/);
    expect(await page.locator('#aprovacao').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    await expect(botaoAprovar(page)).toBeFocused();
    await expect(page.locator('#anuncio')).toHaveText('Escala ainda não aprovada.');
    await expect(page.locator('#aprovacao')).not.toHaveClass(/\bdestaque\b/, { timeout: 3000 });
    expect(endereco(page).hash).toBe('#/apr');

    // A tarefa da linha aberta faz o mesmo: o foco no botão, não na barra
    await irPara(page, 'alu');
    await page.locator('#btn-linha').click();
    await page.locator('#linha a.tarefa[data-tarefa="aprovada"]').click();
    await expect(botaoAprovar(page)).toBeFocused();
    await expect(page.locator('#compactacao')).not.toHaveAttribute('tabindex');
    await page.locator('#btn-linha').click();

    // Aprovada: o selo e o Reabrir; o cartão diz a hora
    await aprovar(page);
    await irPara(page, 'alu');
    await botaoDaAba(page, 'apr').click();
    await expect(botaoReabrir(page)).toBeFocused();
    await expect(page.locator('#anuncio')).toHaveText(/^Escala aprovada às \d\d:\d\d/);
    await expect(cartao(page, 'aprovar')).toHaveAttribute('data-estado', 'feito');
  });

  test('quem só consulta: o foco vai para o título da Escala, com o porquê', async ({ page }) => {
    await abrirComExemplo(page, { url: './?role=gestor' });
    await botaoDaAba(page, 'apr').click();
    await expect(page.locator('#s-esc h2')).toBeFocused();
    await expect(page.locator('#anuncio')).toHaveText('Escala ainda não aprovada. Quem só consulta não aprova.');
  });

  test('a data sem voo: o foco vai para o título da Escala, com o porquê', async ({ page }) => {
    await abrir(page);
    await botaoDaAba(page, 'apr').click();
    await expect(page.locator('#s-esc h2')).toBeFocused();
    await expect(page.locator('#anuncio')).toHaveText('Nenhum voo nesta data: não há escala para aprovar.');
    await expect(cartao(page, 'aprovar')).toHaveAttribute('data-estado', 'nenhum');
  });
});

test.describe('O desenho da linha', () => {
  test('os pontos são 12 px na linha, com a borda dentro; a linha corre atrás dos cartões', async ({ page }) => {
    await abrirComExemplo(page);
    const ponto = await cartao(page, 'escala').evaluate(li => {
      const p = getComputedStyle(li, '::before');
      return { largura: p.width, altura: p.height, caixa: p.boxSizing, topo: p.top, conteudo: p.content };
    });
    expect(ponto).toEqual({ largura: '12px', altura: '12px', caixa: 'border-box', topo: '16px', conteudo: '""' });
    const fundo = await page.locator('#linha-estagios').evaluate(ol => getComputedStyle(ol).backgroundImage);
    expect(fundo).toContain('linear-gradient');
  });

  // .etapa é a etiqueta da missão do curso (na Demanda e na Lista da Escala): os pontos são só de #linha .estagio
  test('a etiqueta da missão do curso (.etapa) não ganha os pontos da linha', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const conteudo = await page.locator('#out').evaluate(out => {
      const etapa = Object.assign(document.createElement('span'), { className: 'etapa', textContent: 'PP-07' });
      out.prepend(etapa);
      const antes = getComputedStyle(etapa, '::before').content;
      etapa.remove();
      return antes;
    });
    expect(conteudo).toBe('none');
  });

  // Aberta por padrão com 1540 px de linha e a janela alta: a 1920 × 1080 (a moldura de 1612 px), a linha abre com as
  // tarefas. Recolhida pelo botão, ela fica assim ao recarregar
  test('a 1920 × 1080, a linha abre com as tarefas; recolhida pelo botão, fica assim', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await abrirComExemplo(page);
    await expect(page.locator('#linha')).toHaveAttribute('data-estado', 'aberta');
    await expect(page.locator('#linha .estagio-tarefas').first()).toBeVisible();
    await expect(page.locator('#btn-linha')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#btn-linha')).toHaveAccessibleName('Esconder as tarefas das etapas');
    // A tarefa leva à tela dela, com o foco no título
    await page.locator('#linha a.tarefa[data-tarefa="recursos"]').click();
    await expect(page.locator('#s-rec h2')).toBeFocused();
    await page.locator('#btn-linha').click();
    await expect(page.locator('#linha')).toHaveAttribute('data-estado', 'recolhida');
    await expect(page.locator('#linha .estagio-tarefas').first()).toBeHidden();
    await expect(page.locator('#btn-linha')).toHaveAccessibleName('Mostrar as tarefas das etapas');
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-pronto', '1');
    await expect(page.locator('#linha')).toHaveAttribute('data-estado', 'recolhida');
  });

  test('a 1280 × 720, recolhida numa fileira só, sem cortar o nome de nenhum cartão', async ({ page }) => {
    await abrirComExemplo(page);
    await expect(page.locator('#linha')).toHaveAttribute('data-estado', 'recolhida');
    const caixas = await page.locator('#linha .linha-estagios, #linha .linha-mais, #btn-linha').evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON()));
    const meio = c => (c.top + c.bottom) / 2;
    expect(Math.max(...caixas.map(meio)) - Math.min(...caixas.map(meio))).toBeLessThan(8);
    const cortados = await page.locator('#linha .estagio-nome').evaluateAll(els => els.filter(el => el.scrollWidth > el.clientWidth + 0.5).map(el => el.textContent));
    expect(cortados).toEqual([]);
  });

  test('no celular (390 e 320 px), uma faixa que rola dentro de si, sem rolar a página', async ({ page }) => {
    for (const largura of [390, 320]) {
      await page.setViewportSize({ width: largura, height: 844 });
      await abrirComExemplo(page);
      await expect(page.locator('#btn-linha')).toBeHidden();
      await expect(page.locator('#linha .estagio-tarefas').first()).toBeHidden();
      const faixa = await page.locator('#linha .linha-corpo').evaluate(el => ({ rola: el.scrollWidth > el.clientWidth, overflow: getComputedStyle(el).overflowX }));
      expect(faixa).toEqual({ rola: true, overflow: 'auto' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
      await irPara(page, 'bi');
      const bi = await botaoDaAba(page, 'bi').evaluate(a => {
        const r = a.getBoundingClientRect(), f = a.closest('.linha-corpo').getBoundingClientRect();
        return r.left >= f.left - 0.5 && r.right <= f.right + 0.5 && r.height >= 44;
      });
      expect(bi, `${largura} px`).toBe(true);
    }
  });
});
