// Acessibilidade: cada botão e cada campo tem um nome para o leitor de tela, e nenhum se chama só "✕" (que o leitor
// lê como "multiplicação"). Vale para todas as abas, o Histórico e o painel de habilitações.
import { test, expect, abrir, abrirComExemplo, irPara, entrar, abrirEscala, abrirCaixa, prepararContexto, vigiarErros, REGIOES, abasVisiveis, abrirHistorico, aprovar, botaoAprovar, botaoDoHistorico, botaoDoMenuDaConta, percorrerTelas, relativoDaData, rotuloDaData, semNome, alternarVem, botoesDasAbas, botaoDaData, mudarData, contagemDoDia, diaDoCalendario, trilho, AMANHA, avisosDaData, contagemDosAvisos, editorDoVoo, refazer, abrirAluno } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { comExemplo } from '../helpers/exemplo.js';
import { estadoSintetico } from '../helpers/estado.js';
import { razaoDeContraste } from '../helpers/contraste.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

test.describe('Acessibilidade', () => {
  test('todo botão e todo campo tem nome para o leitor de tela, em todas as abas', async ({ page }) => {
    await abrirComExemplo(page);
    // Cada aba com a casca (o topo e as abas); as outras vistas e as tabelas sem nenhum com os filtros, só a tela
    await percorrerTelas(page, async tela => expect(await semNome(page, REGIOES.tela), tela).toEqual([]), {
      naAba: async aba => expect(await semNome(page, `${REGIOES.casca}, ${REGIOES.tela}`), `aba ${aba}`).toEqual([])
    });
    await irPara(page, 'esc');
    for (const vista of ['eq', 'ins', 'painel']) {
      await page.locator(`#s-esc [data-tl="${vista}"]`).click();
      expect(await semNome(page, 'main section.on'), `mapa ${vista}`).toEqual([]);
    }
    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    expect(await semNome(page, 'main section.on'), 'cadastro de instrutores').toEqual([]);
    await page.locator('#inst [data-act="editar-habs"]').first().click();
    expect(await semNome(page, '#painel-instrutor'), 'painel de habilitações').toEqual([]);
    await page.keyboard.press('Escape');
    await abrirHistorico(page);
    expect(await semNome(page, '#historico'), 'histórico').toEqual([]);
  });
});

// O anel do foco precisa contrastar com o que está em volta (WCAG 2.4.7 e 1.4.11: pelo menos 3:1). A barra do topo é
// azul-escura nos dois temas
test.describe('O foco do teclado na barra do topo', () => {
  for (const [tema, nome] of [['light', 'claro'], ['dark', 'escuro']]) {
    test(`o anel do foco contrasta com a barra em todos os controles, no tema ${nome}`, async ({ page }) => {
      await abrirComExemplo(page);
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, tema);
      const fundo = await page.locator('header.topo').evaluate(el => getComputedStyle(el).backgroundColor);
      // O botão da data, o perfil, o Histórico, o Manual (um link) e o menu da conta
      const controles = page.locator('header.topo :is(button, select, a[href]):visible:not(:disabled)');
      const total = await controles.count();
      expect(total).toBeGreaterThanOrEqual(5);
      const fracos = [];
      for (let i = 0; i < total; i++) {
        const controle = controles.nth(i);
        // Pelo teclado (Shift+Tab e Tab): o foco que o navegador mostra (:focus-visible)
        await controle.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(controle).toBeFocused();
        const { cor, estilo, nome: rotulo, cortadoPor } = await controle.evaluate(el => {
          const css = getComputedStyle(el);
          // O anel é desenhado fora da caixa (outline-offset + largura): um pai que corta o que transborda o esconde
          const folga = parseFloat(css.outlineOffset) + parseFloat(css.outlineWidth);
          const caixa = el.getBoundingClientRect();
          let cortadoPor = null;
          for (let pai = el.parentElement; pai && !cortadoPor; pai = pai.parentElement) {
            const estiloDoPai = getComputedStyle(pai);
            if (estiloDoPai.overflowX === 'visible' && estiloDoPai.overflowY === 'visible') continue;
            const limite = pai.getBoundingClientRect();
            if (caixa.left - folga < limite.left - 0.5 || caixa.top - folga < limite.top - 0.5
              || caixa.right + folga > limite.right + 0.5 || caixa.bottom + folga > limite.bottom + 0.5) cortadoPor = pai.id || pai.tagName;
          }
          return { cor: css.outlineColor, estilo: css.outlineStyle, nome: el.getAttribute('aria-label') || el.textContent.trim() || el.id, cortadoPor };
        });
        const razao = razaoDeContraste(cor, fundo);
        if (estilo === 'none' || razao < 3) fracos.push(`${rotulo}: ${estilo} ${razao.toFixed(2)}:1`);
        if (cortadoPor) fracos.push(`${rotulo}: anel cortado por ${cortadoPor}`);
      }
      expect(fracos).toEqual([]);
    });
  }

  for (const [tema, nome] of [['light', 'claro'], ['dark', 'escuro']]) {
    test(`no menu da conta (claro, dentro da barra), o anel contrasta com o menu, no tema ${nome}`, async ({ page }) => {
      await abrirComExemplo(page);
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, tema);
      const botao = botaoDoMenuDaConta(page);
      await botao.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await expect(page.locator('#menu-conta')).toBeVisible();
      const fundo = await page.locator('#menu-conta').evaluate(el => getComputedStyle(el).backgroundColor);
      const itens = page.locator('#menu-conta button:visible');
      expect(await itens.count()).toBeGreaterThan(0);
      for (let i = 0; i < await itens.count(); i++) {
        const item = itens.nth(i);
        await item.focus();
        await page.keyboard.press('Shift');
        const { visivel, estilo, cor, nome: rotulo } = await item.evaluate(el => ({
          visivel: el.matches(':focus-visible'), estilo: getComputedStyle(el).outlineStyle,
          cor: getComputedStyle(el).outlineColor, nome: el.textContent.trim()
        }));
        expect(visivel, rotulo).toBe(true);
        // Primeiro, o anel existe: sem ele (outline none), o navegador continua informando uma cor
        expect(estilo, rotulo).not.toBe('none');
        expect(razaoDeContraste(cor, fundo), rotulo).toBeGreaterThanOrEqual(3);
      }
    });
  }

  test('o botão da data mostra o foco do teclado, com o anel branco da barra', async ({ page }) => {
    await abrirComExemplo(page);
    await page.locator('.topo-marca').click();
    await botaoDaData(page).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(botaoDaData(page)).toBeFocused();
    expect(await botaoDaData(page).evaluate(el => [getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineColor])).toEqual(['solid', 'rgb(255, 255, 255)']);
  });
});

// WCAG 1.4.10: a 320 px de largura (o celular pequeno, ou 1280 px com zoom de 400%), nenhuma aba rola de lado
test.describe('Telas de 320 px', () => {
  test.use({ viewport: { width: 320, height: 700 } });
  test('nenhuma aba rola de lado', async ({ page }) => {
    await abrirComExemplo(page);
    const abas = await abasVisiveis(page);
    expect(abas.length).toBeGreaterThan(5);
    const largas = [];
    const conferir = async tela => {
      const largura = await page.evaluate(() => document.documentElement.scrollWidth);
      if (largura > 320) largas.push(`${tela}: ${largura}px`);
    };
    // As abas à vista, as outras vistas e as tabelas sem nenhum com os filtros
    await percorrerTelas(page, conferir, { abas, naAba: conferir });
    expect(largas).toEqual([]);
  });

  test('na virada do ano, a data com o ano e o "amanhã" também aparece inteira', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-12-31T12:00:00-03:00'));
    await abrirComExemplo(page);
    const rotulo = rotuloDaData(page);
    await expect(rotulo).toHaveText('sex., 01/01/2027', { useInnerText: true });
    await expect(relativoDaData(page)).toHaveText('amanhã');
    expect(await rotulo.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });

  test('a data aparece inteira, com o dia da semana abreviado', async ({ page }) => {
    await abrirComExemplo(page);
    const rotulo = rotuloDaData(page);
    expect(await rotulo.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(rotulo).toHaveText('qua., 11/11', { useInnerText: true });
  });
});

// O botão da data tem a largura fixa: com o ano, o "amanhã" e o número de avisos, o dia da semana vai abreviado
test('na tela grande, na virada do ano, a data aparece inteira com o número de avisos', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-31T12:00:00-03:00'));
  await abrir(page, { estado: cenario({ ins: [instrutor(1, 1)], stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34' })] }) });
  await expect(contagemDosAvisos(page)).toBeVisible();
  const rotulo = rotuloDaData(page);
  await expect(rotulo).toHaveText('sex., 01/01/2027', { useInnerText: true });
  expect(await rotulo.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('na tela grande, o dia da semana aparece por extenso', async ({ page }) => {
  await abrirComExemplo(page);
  await expect(rotuloDaData(page).locator('.dt-semana')).toBeVisible();
  await expect(rotuloDaData(page).locator('.dt-semana')).toHaveText('quarta-feira');
  await expect(rotuloDaData(page).locator('.dt-semana-curta')).toBeHidden();
});

// Entre o celular e a tela grande, a barra do topo não pode sobrepor a data e as ferramentas. No modo compartilhado, as
// ferramentas levam o nome da conta (mais largas)
test.describe('A barra do topo nas larguras intermediárias', () => {
  for (const [largura, modo] of [[641, 'local'], [700, 'local'], [820, 'local'], [900, 'local'], [1024, 'local'], [1029, 'compartilhado'],
    [1030, 'compartilhado'], [1110, 'local'], [1280, 'local'], [1289, 'compartilhado'], [1290, 'compartilhado']]) {
    test(`a ${largura} px (modo ${modo}), nada na barra cobre a marca, o botão da data ou as ferramentas`, async ({ page, context }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      if (modo === 'local') await abrirComExemplo(page);
      else {
        await instalarSupabaseFalso(context, documentosAtuais(comExemplo(estadoSintetico()), '2026-11-11'));
        await entrar(page, CONTAS.operador);
      }
      // O que está no meio de cada um é ele mesmo (nada por cima): a marca, o botão da data e as ferramentas
      for (const [seletor, alvo] of [['.topo-titulo', page.locator('.topo-titulo')], ['o botão da data', botaoDaData(page)],
        ['o Histórico', botaoDoHistorico(page)], ['#btn-manual', page.locator('#btn-manual')],
        ['o menu da conta', botaoDoMenuDaConta(page)]]) {
        const noMeio = await alvo.evaluate(el => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
        });
        expect(noMeio, seletor).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
    });
  }
});

// No celular, os botões do topo mostram só o ícone: o nome continua o da palavra escondida (e não só o número do selo)
test.describe('Os botões do topo no celular', () => {
  test.use({ viewport: { width: 360, height: 780 } });
  test('o Histórico e o Manual mantêm o nome para o leitor de tela', async ({ page }) => {
    await abrirComExemplo(page);
    await expect(botaoDoHistorico(page)).toHaveAccessibleName(/^Histórico/);
    await expect(page.locator('#btn-manual')).toHaveAccessibleName('Manual');
    await expect(botaoDoHistorico(page).locator('.hd-txt')).not.toBeInViewport({ ratio: 0.5 });
  });
});

// Da tela média para cima, o Tab passa pelos controles da barra na ordem em que eles aparecem, linha por linha
test.describe('A ordem do Tab na barra do topo', () => {
  for (const largura of [700, 900, 1029, 1100, 1400]) {
    test(`a ${largura} px, cada controle da barra fica na mesma linha ou abaixo do anterior`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      await abrirComExemplo(page);
      const linhas = await page.locator('header.topo').evaluate(topo => [...topo.querySelectorAll('button, select, input')]
        .filter(el => el.checkVisibility() && !el.closest('#menu-conta, nav')).map(el => [el.id || el.className, Math.round(el.getBoundingClientRect().top)]));
      for (let i = 1; i < linhas.length; i++) expect(linhas[i][1], `${linhas[i][0]} depois de ${linhas[i - 1][0]}`).toBeGreaterThanOrEqual(linhas[i - 1][1] - 6);
    });
  }
});

// Um nome de conta longo termina em reticências e não empurra as ferramentas para cima da marca
test.describe('Um nome de conta longo', () => {
  for (const largura of [1030, 1289]) {
    test(`a ${largura} px, o nome é cortado e a marca continua à vista`, async ({ page, context }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      const nome = 'Maria Aparecida dos Santos Albuquerque de Oliveira Figueiredo Pereira da Silva';
      await instalarSupabaseFalso(context, { ...documentosAtuais(comExemplo(estadoSintetico()), '2026-11-11'), nomes: { [CONTAS.operador.id]: nome } });
      await entrar(page, CONTAS.operador);
      await expect(page.locator('#usuario b')).toHaveText(nome);
      expect(await page.locator('#usuario b').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
      expect(await page.locator('.topo-titulo').evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
      })).toBe(true);
    });
  }
});

// Quem usa o teclado continua no mesmo lugar depois de uma ação: a tela é redesenhada, mas o foco volta para o campo ou o
// botão equivalente (antes, ele caía no <body> e o próximo Tab recomeçava do topo)
test.describe('O foco depois de uma ação', () => {
  test('fechar o Histórico devolve o foco ao botão; o Manual leva o foco ao título dele', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirHistorico(page);
    await expect(page.locator('#btn-fechar-historico')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(botaoDoHistorico(page)).toBeFocused();
    await page.locator('#btn-manual').click();
    await expect(page.locator('#s-manual h2').first()).toBeFocused();
  });

  test('com o Histórico aberto, o Esc dado na busca da Escala fecha a gaveta e o foco fica na busca', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await abrirHistorico(page);
    await expect(page.locator('#historico')).toBeVisible();
    // O foco vai para a busca sem o clique: dependendo da largura, a gaveta cobre a busca
    const busca = page.locator('#flt-esc-q');
    await busca.focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
    await expect(busca).toBeFocused();
  });
});

// O texto e o fundo que aparece atrás dele: as camadas semitransparentes somadas, de baixo para cima
const coresDoTexto = locator => locator.evaluate(el => {
  const canais = cor => /rgba?\(([^)]+)\)/.exec(cor)[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  const camadas = [];
  for (let no = el; no; no = no.parentElement) camadas.unshift(getComputedStyle(no).backgroundColor);
  let fundo = [255, 255, 255];
  for (const camada of camadas) {
    const [r, g, b, a = 1] = canais(camada);
    fundo = [r, g, b].map((v, i) => v * a + fundo[i] * (1 - a));
  }
  return { texto: getComputedStyle(el).color, fundo: `rgb(${fundo.map(Math.round).join(', ')})` };
});
// Os textos sem o contraste mínimo da WCAG para texto normal (4,5:1), com o rótulo de cada um
const contrastesFracos = async (itens) => {
  const fracos = [];
  for (const [rotulo, locator] of itens) {
    const { texto, fundo } = await coresDoTexto(locator);
    const razao = razaoDeContraste(texto, fundo);
    if (razao < 4.5) fracos.push(`${rotulo}: ${razao.toFixed(2)}:1 (${texto} sobre ${fundo})`);
  }
  return fracos;
};

// O que a tela mostra pela cor ou pela posição também é dito ao leitor de tela; o teclado chega aonde o mouse chega
test.describe('O leitor de tela e o teclado', () => {
  test('a aba aberta (e o Manual), a vista escolhida e a data aberta são ditos, não só coloridos', async ({ page }) => {
    await abrirComExemplo(page);
    const atual = page.locator('[aria-current="page"]');
    await expect(atual).toHaveAttribute('href', '#/esc');
    await irPara(page, 'dem');
    await expect(atual).toHaveCount(1);
    await expect(atual).toHaveAttribute('href', '#/dem');
    await page.locator('#btn-manual').click();
    await expect(atual).toHaveCount(1);
    await expect(atual).toHaveId('btn-manual');
    // A vista escolhida fica "pressionada"; as outras, não (a Escala abre em Por recurso)
    await abrirEscala(page, { vista: null });
    await expect(page.locator('#s-esc [data-tl][aria-pressed="true"]')).toHaveAttribute('data-tl', 'eq');
    await page.locator('#s-esc [data-tl="lista"]').click();
    await expect(page.locator('#s-esc [data-tl][aria-pressed="true"]')).toHaveAttribute('data-tl', 'lista');
    await expect(page.locator('#s-esc [data-tl][aria-pressed="false"]')).toHaveCount(3);
    await irPara(page, 'ins');
    await page.locator('[data-vista-ins="cadastro"]').click();
    await expect(page.locator('[data-vista-ins][aria-pressed="true"]')).toHaveAttribute('data-vista-ins', 'cadastro');
    // Cursos é uma aba, não uma vista de Alunos: a aba aberta é a atual
    await irPara(page, 'cur');
    await expect(atual).toHaveCount(1);
    await expect(atual).toHaveAttribute('href', '#/cur');
    // A data aberta no calendário, e a que passa a ser aberta
    const aberta = page.locator('#cal [aria-current="date"]');
    await expect(aberta).toHaveCount(1);
    await expect(aberta).toHaveAttribute('data-dia', AMANHA);
    await mudarData(page, '2026-11-12');
    await expect(aberta).toHaveCount(1);
    await expect(aberta).toHaveAttribute('data-dia', '2026-11-12');
  });

  test('o pedido de confirmação é dito na região de status (o nome trocado do botão nem sempre é lido)', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const anuncio = page.locator('#anuncio');
    await expect(anuncio).toHaveAttribute('role', 'status');
    await expect(anuncio).toBeEmpty();
    // Um botão com texto e um com nome próprio ("Excluir aluno…", com o nome do aluno): o anúncio é o nome do botão armado
    const aprovar = botaoAprovar(page);
    await aprovar.click();
    await expect(anuncio).toHaveText('Confirmar aprovação. Para confirmar, acione o botão de novo.');
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    const x = page.locator('#det-alu-excluir');
    const nome = await x.getAttribute('aria-label');
    await x.click();
    await expect(x).toHaveClass(/\barm\b/);
    await expect(anuncio).toHaveText(`Confirmar exclusão: ${nome}. Para confirmar, acione o botão de novo.`);
  });

  test('o menu da conta: as setas, Home e End andam pelos itens; o Tab que sai do menu o fecha', async ({ page, context }) => {
    await instalarSupabaseFalso(context, documentosAtuais(comExemplo(estadoSintetico()), '2026-11-11'));
    await entrar(page, CONTAS.administrador);
    const botao = botaoDoMenuDaConta(page);
    await botao.focus();
    await page.keyboard.press('Enter');
    const itens = page.locator('#menu-conta [role^="menuitem"]:visible');
    await expect(itens).toHaveCount(4);
    expect(await itens.evaluateAll(els => els.map(el => el.getAttribute('aria-label') || el.textContent.trim())))
      .toEqual(['Minha conta', 'Usuários', 'Tema escuro', 'Sair']);
    await expect(itens.nth(0)).toBeFocused();
    for (const [tecla, item] of [['ArrowDown', 1], ['End', 3], ['ArrowDown', 0], ['ArrowUp', 3], ['ArrowUp', 2], ['Home', 0]]) {
      await page.keyboard.press(tecla);
      await expect(itens.nth(item), tecla).toBeFocused();
    }
    await page.keyboard.press('End');
    await page.keyboard.press('Tab');
    await expect(page.locator('#menu-conta')).toBeHidden();
    await expect(botao).toHaveAttribute('aria-expanded', 'false');
    // Shift+Tab do botão (com o menu aberto) também sai e fecha
    await botao.click();
    await expect(itens.nth(0)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(botao).toBeFocused();
    await expect(page.locator('#menu-conta')).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#menu-conta')).toBeHidden();
  });

  test('o Esc fecha só a camada de cima: com o menu da conta aberto, o primeiro fecha a dica aberta pelo mouse', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const botao = botaoDoMenuDaConta(page);
    await botao.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#menu-conta')).toBeVisible();
    await page.locator('#out [data-dica]:not(select):not(button)').first().hover();
    await expect(page.locator('#dica')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#dica')).toBeHidden();
    await expect(page.locator('#menu-conta')).toBeVisible();
  });

  test('o Esc fecha só a camada de cima: com o Histórico aberto, o primeiro fecha o menu da conta, o segundo, a gaveta', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirHistorico(page);
    await expect(page.locator('#historico')).toBeVisible();
    const botao = botaoDoMenuDaConta(page);
    await botao.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#menu-conta')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-conta')).toBeHidden();
    await expect(botao).toBeFocused();
    await expect(page.locator('#historico')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
  });

  test('o Esc fecha só a camada de cima: com o Histórico aberto, o primeiro fecha o diálogo do status, o segundo, a gaveta', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await abrirHistorico(page);
    await expect(page.locator('#historico')).toBeVisible();
    // O status muda sem o clique (dependendo da largura, a gaveta cobre a lista): o foco fica no ✕ da gaveta. Com o foco
    // no status, a volta do foco depois do Esc abriria a dica dele, uma camada a mais (o 2º Esc fecharia a dica)
    const status = page.locator('#out select[data-f="fstatus"]').first();
    const fkey = await status.getAttribute('data-fkey');
    const anterior = await status.inputValue();
    await status.selectOption('Cancelado');
    const dialogo = page.locator('#dlg-status');
    await expect(dialogo).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(page.locator('#historico')).toBeVisible();
    // Desistir deixa o status anterior, e o foco volta para o ✕ da gaveta
    await expect(page.locator(`#out select[data-fkey="${fkey}"]`)).toHaveValue(anterior);
    await expect(page.locator('#btn-fechar-historico')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
    await expect(botaoDoHistorico(page)).toBeFocused();
  });

  test('o Esc fecha só a camada de cima: com o Histórico aberto, o primeiro fecha o editor do voo, o segundo, a gaveta', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await page.locator('#s-esc [data-tl="eq"]').click();
    await abrirHistorico(page);
    await expect(page.locator('#historico')).toBeVisible();
    // O editor abre pelo teclado (dependendo da largura, a gaveta cobre a barra), com o foco nele
    const barra = page.locator('#out .tl-bar').first();
    await barra.focus();
    await page.keyboard.press('Enter');
    const popup = editorDoVoo(page);
    await expect(popup).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await expect(barra).toBeFocused();
    await expect(page.locator('#historico')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
  });

  // As Sugestões de um conflito (como em reparo.spec.js): a escala aprovada e o instrutor do voo do Aluno 1000 desligado
  // na data. Devolve o botão "Sugestões", com a gaveta aberta
  async function abrirSugestoes(page) {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] }) });
    await abrirEscala(page);
    await aprovar(page);
    const doVoo = (await page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' }).locator('.c-instr').innerText()).trim();
    await irPara(page, 'ins');
    await alternarVem(page, doVoo.endsWith('01') ? 1 : 2, false);
    await abrirEscala(page);
    await abrirCaixa(page, 'conflitos');
    const botao = page.locator('#out details.conflitos [data-reparo]');
    await botao.click();
    await expect(page.locator('#painel-reparo')).toBeVisible();
    return botao;
  }

  test('o Esc fecha só a camada de cima: com as Sugestões abertas, o primeiro fecha o diálogo do agendamento, o segundo, a gaveta', async ({ page }) => {
    const botao = await abrirSugestoes(page);
    await page.locator('#btn-agendar').focus();
    await page.keyboard.press('Enter');
    const dialogo = page.locator('#dlg-agendar');
    await expect(dialogo).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(page.locator('#painel-reparo')).toBeVisible();
    await expect(page.locator('#btn-agendar')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#painel-reparo')).toBeHidden();
    await expect(botao).toBeFocused();
  });

  test('o Esc fecha só a camada de cima: com as Sugestões abertas, o primeiro fecha o diálogo do status (o status fica), o segundo, a gaveta', async ({ page }) => {
    await abrirSugestoes(page);
    const status = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1001' }).locator('select[data-f="fstatus"]');
    const anterior = await status.inputValue();
    await status.selectOption('Cancelado');
    const dialogo = page.locator('#dlg-status');
    await expect(dialogo).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(page.locator('#painel-reparo')).toBeVisible();
    await expect(status).toHaveValue(anterior);
    await page.keyboard.press('Escape');
    await expect(page.locator('#painel-reparo')).toBeHidden();
  });

  // Qualquer diálogo é a camada de cima, não só o do status: o da sessão expirada aparece sozinho, na gravação, e o Esc
  // não o fecha. A gravação com a sessão expirada responde 401 de propósito
  test('o Esc fecha só a camada de cima: com o diálogo da sessão aberto sobre a Escala, o Esc não o fecha, e o status mudado fica', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(context);
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(comExemplo(estadoSintetico()), '2026-11-11'));
    const page = await context.newPage();
    const erros = vigiarErros(page, { statusEsperados: [401] });
    await entrar(page, CONTAS.operador);
    await abrirEscala(page);
    servidor.expirarSessoes();
    const status = page.locator('#out select[data-f="fstatus"]').first();
    await status.selectOption('Em Voo');
    await refazer(page);
    const sessao = page.locator('#dlg-sessao');
    await expect(sessao).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sessao).toBeVisible();
    await page.locator('#sessao-senha').click();
    await page.locator('#sessao-senha').fill(CONTAS.operador.senha);
    await page.locator('#sessao-entrar').click();
    await expect(sessao).toBeHidden();
    await expect(status).toHaveValue('Em Voo');
    expect(erros).toEqual([]);
    await context.close();
  });

  // Com o foco em lugar nenhum (o clique no texto do painel; no Safari, o botão clicado não recebe o foco): sem gaveta
  // aberta, o Esc fecha o filtro e leva o foco ao botão; com uma gaveta aberta, o Esc é dela, e o filtro continua aberto
  test('o Esc com o foco em lugar nenhum: com o Histórico aberto, fecha o Histórico; sem gaveta, fecha o filtro das habilitações', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await irPara(page, 'ins');
    await abrirHistorico(page);
    await expect(page.locator('#historico')).toBeVisible();
    // O Histórico pode cobrir o botão do filtro: pelo teclado
    const botao = page.locator('#flt-ins-hab'), painel = page.locator('#flt-ins-hab-painel');
    await botao.focus();
    await page.keyboard.press('Enter');
    await expect(painel).toBeVisible();
    // O clique no começo da frase da regra (um texto, que não recebe o foco): o foco sai do botão para lugar nenhum
    await painel.locator('.filtro-regra').click({ position: { x: 4, y: 6 } });
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await expect(painel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
    await expect(painel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(painel).toBeHidden();
    await expect(botao).toBeFocused();
  });

  for (const [tema, nome] of [['light', 'claro'], ['dark', 'escuro']]) {
    test(`os textos sobre cor (os status, o ✕ armado, os avisos do editor do voo, o selo da aprovação) contrastam, no tema ${nome}`, async ({ page }) => {
      await abrirComExemplo(page);
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, tema);
      await abrirEscala(page);
      const fracos = [];
      const conferir = async (rotulo, locator) => fracos.push(...await contrastesFracos([[rotulo, locator]]));
      const status = page.locator('#out select[data-f="fstatus"]');
      await status.nth(0).selectOption('Em Voo');
      await refazer(page);
      await status.nth(1).selectOption('Pousou');
      await refazer(page);
      await conferir('Em Voo', page.locator('#out .st-sel.st-EmVoo').first());
      await conferir('Pousou', page.locator('#out .st-sel.st-Pousou').first());
      // O editor do voo: o aviso de conflito (o horário de outro voo, no avião dele)
      const linhas = page.locator('#out tbody tr:not(.win):not(.membro)', { has: page.locator('.c-aviao small') });
      const [hora, recurso] = await linhas.nth(0).evaluate(tr => [tr.querySelector('.c-hr').textContent.trim().slice(0, 5), tr.querySelector('.c-aviao').firstChild.textContent.trim()]);
      await linhas.nth(1).locator('[data-act="editar-voo"]').click();
      await page.locator('#voo-recurso').selectOption(recurso);
      await page.locator('#voo-horario').selectOption({ label: hora });
      await expect(page.locator('#voo-avisos li.conflito').first()).toBeVisible();
      await conferir('aviso do editor', page.locator('#voo-avisos li.conflito').first());
      await page.keyboard.press('Escape');
      await page.locator('#s-esc [data-tl="lista"]').click();
      await aprovar(page);
      await conferir('selo da aprovação', page.locator('#selo-aprovada'));
      await irPara(page, 'alu');
      await abrirAluno(page, 1000);
      const x = page.locator('#det-alu-excluir');
      await x.click();
      await expect(x).toHaveClass(/\barm\b/);
      await conferir('"Excluir aluno…" armado', x);
      expect(fracos).toEqual([]);
    });

    // Os tokens da casca (F1a): o símbolo sobre o disco de cada estado, o disco e o anel sobre o cartão, a linha selecionada
    // e os avatares (F2), com as cores como o navegador as resolve no tema: todos com 4,5:1
    test(`os tokens dos estados, da seleção e dos avatares contrastam, no tema ${nome}`, async ({ page }) => {
      await abrir(page);
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, tema);
      const pares = [
        ['--okT', '--ok', 4.5], ['--waT', '--wa', 4.5], ['--erT', '--er', 4.5], ['--anT', '--an', 4.5],
        ['--ok', '--pn', 4.5], ['--wa', '--pn', 4.5], ['--er', '--pn', 4.5], ['--an', '--pn', 4.5], ['--pe', '--pn', 4.5],
        ['--ink', '--sel', 4.5], ['--mu', '--sel', 4.5],
        ['--avT', '--av1', 4.5], ['--avT', '--av2', 4.5], ['--avT', '--av3', 4.5], ['--avT', '--av4', 4.5], ['--avT', '--av5', 4.5]
      ];
      const cores = await page.evaluate(nomes => {
        const el = document.createElement('span');
        document.body.append(el);
        const cor = nome => { el.style.color = `var(${nome})`; return getComputedStyle(el).color; };
        const lidas = Object.fromEntries(nomes.map(n => [n, cor(n)]));
        el.remove();
        return lidas;
      }, [...new Set(pares.flat().filter(x => typeof x === 'string'))]);
      const fracos = pares.filter(([a, b, minimo]) => razaoDeContraste(cores[a], cores[b]) < minimo)
        .map(([a, b]) => `${a} sobre ${b}: ${razaoDeContraste(cores[a], cores[b]).toFixed(2)}`);
      expect(fracos).toEqual([]);
    });

    // O disco "falhou" do cartão da Escala (missões que não entraram): o símbolo contrasta com o disco, e o anel do foco dos
    // links da linha, com a página
    test(`o disco de "falhou" na linha contrasta, e o anel do foco dos links da linha também, no tema ${nome}`, async ({ page }) => {
      await abrir(page, { estado: cenario({ ins: [instrutor(1, 1)], stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34' })] }) });
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, tema);
      const disco = page.locator('#linha li.estagio[data-estagio="escala"] .estagio-titulo .estado');
      await expect(disco).toHaveAttribute('data-estado', 'falhou');
      expect(await contrastesFracos([['disco falhou', disco]])).toEqual([]);
      const fundo = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
      const fracos = [];
      for (const link of await botoesDasAbas(page, { visiveis: true }).all()) {
        await link.focus();
        const anel = await link.evaluate(el => getComputedStyle(el).outlineColor);
        if (razaoDeContraste(anel, fundo) < 3) fracos.push(await link.getAttribute('href'));
      }
      expect(fracos).toEqual([]);
    });

    // O trilho (F1b): os dias (o número sobre o círculo de hoje, os discretos, o número de pedidos) e a linha da data; e o
    // anel do foco dos controles dele, com o fundo do painel
    test(`os textos do trilho contrastam, e o anel do foco dele também, no tema ${nome}`, async ({ page, context }) => {
      const servidor = await instalarSupabaseFalso(context, documentosAtuais(comExemplo(estadoSintetico()), AMANHA));
      for (const [id, data] of [[1, '2026-11-10'], [2, '2026-11-13'], [3, AMANHA]]) {
        servidor.solicitacoes.push({ id, data, aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Voo Local', janela: 'horario', horario: '08:20', horas: 1, observacao: null,
          registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: 'Secretaria de Teste', excecao: false, cancelada_em: null, cancelada_por: null });
      }
      await entrar(page, CONTAS.operador);
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, tema);
      await botaoDaData(page).click();
      await expect(contagemDoDia(page, '2026-11-13')).toBeVisible();
      expect(await contrastesFracos([
        ['o mês', page.locator('#cal-mes')], ['o dia da semana', page.locator('#cal th').first()], ['um dia', diaDoCalendario(page, '2026-11-12')],
        ['a data aberta', diaDoCalendario(page, AMANHA)], ['hoje', diaDoCalendario(page, '2026-11-10')], ['um domingo', diaDoCalendario(page, '2026-11-15')],
        ['um dia de outro mês', diaDoCalendario(page, '2026-12-01')], ['os pedidos de um dia', contagemDoDia(page, '2026-11-13')],
        ['os pedidos de hoje', contagemDoDia(page, '2026-11-10')], ['a linha da data', page.locator('#trilho-data')],
        ['o título de um aviso', avisosDaData(page).first().locator('.aviso-titulo')], ['o número de avisos', contagemDosAvisos(page)]
      ])).toEqual([]);
      const fundo = await trilho(page).evaluate(el => getComputedStyle(el).backgroundColor);
      const fracos = [];
      for (const controle of await trilho(page).locator('button:visible, a:visible').all()) {
        await controle.focus();
        await page.keyboard.press('Shift');
        const { cor, estilo, quem } = await controle.evaluate(el => ({ cor: getComputedStyle(el).outlineColor, estilo: getComputedStyle(el).outlineStyle, quem: el.id || el.dataset.dia }));
        if (estilo === 'none' || razaoDeContraste(cor, fundo) < 3) fracos.push(`${quem}: ${estilo} ${razaoDeContraste(cor, fundo).toFixed(2)}:1`);
      }
      expect(fracos).toEqual([]);
    });
  }

  test('o primeiro Tab da página é o link para pular ao conteúdo, e o Tab seguinte já é dentro do conteúdo', async ({ page }) => {
    await abrirComExemplo(page);
    const pular = page.locator('a.pular');
    await expect(pular).not.toBeInViewport();
    await page.locator('body').focus();
    await page.keyboard.press('Tab');
    await expect(pular).toBeFocused();
    await expect(pular).toBeInViewport();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('main').contains(document.activeElement))).toBe(true);
  });

  test('os anúncios: a data do topo ao mudar, quantos voos ficaram com os filtros e o diálogo do status descrito pelo voo', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    // A data nova é anunciada (o nome dela, dentro do botão, não é uma região viva: seria lido duas vezes com o foco nele)
    await expect(rotuloDaData(page)).not.toHaveAttribute('aria-live');
    await expect(botaoDaData(page).locator('svg.ico').first()).toHaveAttribute('aria-hidden', 'true');
    await mudarData(page, '2026-11-12');
    await expect(page.locator('#anuncio')).toHaveText('Data aberta: quinta-feira, 12/11');
    await mudarData(page, '2026-11-11');
    // O filtro muda a lista sem tirar o foco dele: o resultado vai para a região de status
    const busca = page.locator('#flt-esc-q');
    await busca.fill('zzzz');
    await expect(page.locator('#out')).toContainText('Nenhum voo na escala com esses filtros.');
    await expect(page.locator('#anuncio')).toHaveText('Nenhum voo na escala com esses filtros.');
    await busca.fill('');
    await expect(page.locator('#anuncio')).toHaveText(/^\d+ voos na escala com esses filtros\.$/);
    await expect(busca).toBeFocused();
    // Abrir o diálogo do Atrasado: a descrição dele é o voo
    const status = page.locator('#out select[data-f="fstatus"]').first();
    await status.selectOption('Atrasado');
    await expect(page.locator('#dlg-status')).toBeVisible();
    await expect(page.locator('#dlg-status')).toHaveAccessibleDescription(await page.locator('#dlg-status-voo').textContent());
    await expect(page.locator('#dlg-status-voo')).not.toBeEmpty();
    await page.locator('#dlg-status').getByRole('button', { name: 'Voltar' }).click();
  });
});
