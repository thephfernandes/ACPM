// O componente de lista e detalhe (F2): a bancada (uma lista de mentira montada na página, com todo estado que as telas
// seguintes usam: os fixos, os grupos, o cabeçalho que se escolhe, a chave desta data, a ação, o bloco, o apagado, o
// inativo, o lendo e o falhou, o vazio fixo, as duas vistas juntas no celular) e Alunos, a primeira tela que o usa: o clique
// que não se perde depois de digitar, as teclas, o endereço, o celular e quem só consulta
import { test, expect, abrir, irPara, abrirHistorico, appPronto, diaSeguinte, dataAberta, alvosPequenos, larguraDaPagina, semNome, abrirAluno, campoDoAberto, linhaDoAluno, linhaNaLista, detalheDa, abrirNaLista, nomesNaLista } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

// A bancada: uma seção da página com a barra, a lista e o detalhe, mostrada no lugar da tela aberta. Os ouvintes da
// página de mentira mudam o modelo dela (a chave desta data e o nome) e a desenham de novo
async function montarBancada(page) {
  await page.evaluate(async () => {
    const { criarMestreDetalhe } = await import('./js/views/mestre-detalhe.js');
    const secao = document.createElement('section');
    secao.id = 's-banco';
    secao.className = 'tela on';
    secao.dataset.forma = 'lista-detalhe';
    secao.dataset.vendo = 'lista';
    secao.innerHTML = `<div class="md-lista" data-regiao="lista"><h2>Bancada</h2>
      <div class="bar lista-barra"><span class="lista-busca"><input type="search" class="flt-ctrl" data-flt="banco" aria-label="Buscar na bancada"></span>
      <button type="button" class="btn quiet lista-inativos" id="banco-inativos" aria-pressed="false" hidden>Mostrar inativos</button>
      <span class="contagem" id="banco-contagem" role="status"></span></div>
      <p class="lista-aviso" id="banco-aviso" role="status" hidden></p>
      <ul class="lista" id="banco" role="list" aria-label="Bancada" data-lista="banco"></ul></div>
      <div class="md-detalhe" id="det-banco" data-regiao="detalhe" role="region" aria-label="Item escolhido" tabindex="-1">
        <form id="banco-novo" class="h"><label for="banco-novo-nome">Nome do item novo</label> <input id="banco-novo-nome" class="flt-ctrl"></form></div>`;
    document.querySelectorAll('main#conteudo > section.tela').forEach(s => s.classList.remove('on'));
    document.querySelector('main#conteudo').append(secao);
    document.body.dataset.forma = 'lista-detalhe';
    const item = (id, mais = {}) => ({ id, titulo: id, busca: [id], atributos: `data-k="banco" data-id="${id}"`, valores: {}, ...mais });
    window.modeloDoBanco = {
      estado: 'pronto',
      fixos: [item('hangar', { titulo: 'Ordem no hangar', icone: 'i-aviao', busca: [] })],
      grupos: [{ id: 'C152', titulo: 'C152', resumo: '2 de 3 disponíveis', idDoDetalhe: 'cat:C152' }, { id: 'SIM', titulo: 'Simulador' }],
      itens: [
        item('PR-AAA', {
          grupo: 'C152', linha2: 'C152 · Só VFR', meta: '12,5 h', linha3: '11/11 · disponível', bloco: '<span class="tira">06:30–11:30</span>',
          rapida: { marcado: true, texto: 'Disponível', rotulo: 'PR-AAA disponível em 11/11', atributos: 'data-a="banco-rapida"' },
          chave: { marcado: true, texto: 'Ativo', rotulo: 'PR-AAA ativo no cadastro', atributos: 'data-act="banco-chave"' }
        }),
        item('PR-BBB', { grupo: 'C152', linha2: 'C152', ponto: 'erro', pontoRotulo: 'parou para revisão' }),
        item('PR-CCC', { grupo: 'C152', linha2: 'C152', inativo: true }),
        item('SIM-A', { grupo: 'SIM', linha2: 'Simulador' }),
        item('P-1', { linha2: 'Pedido', acao: { texto: 'Aprovar', rotulo: 'Aprovar o pedido P-1', atributos: 'data-act="banco-acao"' } }),
        item('P-2', { linha2: 'cancelado', apagado: true })
      ]
    };
    window.acoesDoBanco = [];
    window.banco = criarMestreDetalhe({
      id: 'banco', rotulo: 'Bancada', nomes: ['item', 'itens'], semItens: 'Nenhum item.', vazio: { elemento: 'banco-novo' },
      modelo: () => window.modeloDoBanco,
      // Cada desenho do detalhe é contado (window.desenhosDoDetalhe)
      detalhe: id => {
        window.desenhosDoDetalhe = (window.desenhosDoDetalhe || 0) + 1;
        return {
          atributos: `data-k="banco" data-id="${id}"`, id, titulo: id, subtitulo: 'da bancada',
          secoes: [{ id: 'dados', titulo: 'Dados', escopo: 'todas as datas', campos: [{ id: 'nome', rotulo: 'Nome', tipo: 'texto', valor: id, atributos: 'data-f="banco-nome"' }] }],
          rodape: []
        };
      }
    });
    // A chave desta data muda com um clique; a ação fica registrada
    document.addEventListener('change', e => {
      if (e.target.dataset.a !== 'banco-rapida') return;
      const id = e.target.closest('[data-id]').dataset.id;
      window.modeloDoBanco.itens.find(i => i.id === id).rapida.marcado = e.target.checked;
      window.banco.desenhar();
    });
    document.addEventListener('click', e => { if (e.target.closest('[data-act="banco-acao"]')) window.acoesDoBanco.push(e.target.closest('[data-id]').dataset.id); });
    window.banco.desenhar();
  });
  await expect(page.locator('#banco > li').first()).toBeVisible();
}
const linhaDaBancada = (page, id) => linhaNaLista(page, 'banco', id);
const titulos = page => page.locator('#banco > li').evaluateAll(lis => lis.map(li => li.dataset.chave));

test.describe('A bancada do componente de lista e detalhe', () => {
  test('os fixos primeiro, os grupos, as linhas com o bloco, a chave desta data, a chave do cadastro e a ação; o apagado fica, o inativo não', async ({ page }) => {
    await abrir(page);
    await montarBancada(page);
    expect(await titulos(page)).toEqual(['f:hangar', 'g:C152', 'i:PR-AAA', 'i:PR-BBB', 'g:SIM', 'i:SIM-A', 'i:P-1', 'i:P-2']);
    // A contagem não conta os fixos nem o inativo
    await expect(page.locator('#banco-contagem')).toHaveText('5 itens');
    const aaa = linhaDaBancada(page, 'PR-AAA');
    await expect(aaa.locator('.lista-l2')).toHaveText('C152 · Só VFR12,5 h');
    await expect(aaa.locator('.lista-l3')).toHaveText('11/11 · disponível');
    await expect(aaa.locator('.lista-bloco .tira')).toHaveText('06:30–11:30');
    // Os controles são irmãos do botão que escolhe (nada interativo dentro dele)
    await expect(aaa.locator('.lista-botao button, .lista-botao input')).toHaveCount(0);
    await expect(aaa.locator(':scope > .lista-chave')).toHaveAttribute('role', 'switch');
    await expect(aaa.locator(':scope > .lista-chave')).toHaveAccessibleName('PR-AAA ativo no cadastro');
    await expect(aaa.locator(':scope > .lista-chave')).toHaveAttribute('aria-checked', 'true');
    await expect(aaa.locator(':scope > .lista-rapida input')).toHaveAccessibleName('PR-AAA disponível em 11/11');
    await expect(linhaDaBancada(page, 'P-1').locator(':scope > .lista-acao')).toHaveText('Aprovar');
    await expect(linhaDaBancada(page, 'P-1').locator('.lista-chave')).toHaveCount(0);
    // O ponto é dito ao leitor de tela
    await expect(linhaDaBancada(page, 'PR-BBB').locator('.lista-botao')).toContainText('parou para revisão');
    // O apagado fica, discreto, sem a etiqueta "inativo"
    await expect(linhaDaBancada(page, 'P-2')).toHaveClass(/\bapagado\b/);
    await expect(linhaDaBancada(page, 'P-2').locator('.lista-inativo')).toHaveCount(0);
    expect(await linhaDaBancada(page, 'P-2').locator('.lista-titulo').evaluate(el => getComputedStyle(el).color))
      .toBe(await page.evaluate(() => { const s = document.createElement('span'); s.style.color = 'var(--mu)'; document.body.append(s); const c = getComputedStyle(s).color; s.remove(); return c; }));
    expect(await semNome(page, '#s-banco')).toEqual([]);
  });

  test('os grupos: a seta recolhe (o título do C152 se escolhe e abre o detalhe dele); com texto na busca, todos abertos', async ({ page }) => {
    await abrir(page);
    await montarBancada(page);
    await page.locator('#grp-banco-C152').click();
    await expect(page.locator('#grp-banco-C152')).toHaveAttribute('aria-expanded', 'false');
    expect(await titulos(page)).toEqual(['f:hangar', 'g:C152', 'g:SIM', 'i:SIM-A', 'i:P-1', 'i:P-2']);
    // O recolhido continua contado
    await expect(page.locator('#banco-contagem')).toHaveText('5 itens');
    await page.locator('[data-flt="banco"]').fill('pr-a');
    expect(await titulos(page)).toEqual(['f:hangar', 'g:C152', 'i:PR-AAA']);
    await expect(page.locator('#banco-contagem')).toHaveText('1 de 5 itens');
    await page.locator('[data-flt="banco"]').fill('');
    expect(await titulos(page)).toEqual(['f:hangar', 'g:C152', 'g:SIM', 'i:SIM-A', 'i:P-1', 'i:P-2']);
    await page.locator('#lin-banco-cat\\:C152').click();
    await expect(detalheDa(page, 'banco')).toHaveAttribute('data-id', 'cat:C152');
    await expect(page.locator('#lin-banco-cat\\:C152')).toHaveAttribute('aria-current', 'true');
    // O grupo sem detalhe é um botão só, que recolhe
    await page.locator('#grp-banco-SIM').click();
    await expect(page.locator('#grp-banco-SIM')).toHaveAttribute('aria-expanded', 'false');
    await expect(linhaDaBancada(page, 'SIM-A')).toHaveCount(0);
  });

  test('as teclas: ↓ ↑ Home End escolhem; ← recolhe e → abre o grupo; Enter vai ao título do detalhe; da busca, ↓ e Enter', async ({ page }) => {
    await abrir(page);
    await montarBancada(page);
    const focado = () => page.evaluate(() => document.activeElement.id);
    await page.locator('#lin-banco-hangar').focus();
    await page.keyboard.press('ArrowDown');
    expect(await focado()).toBe('lin-banco-cat:C152');
    await expect(detalheDa(page, 'banco')).toHaveAttribute('data-id', 'cat:C152');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#grp-banco-C152')).toHaveAttribute('aria-expanded', 'false');
    expect(await focado()).toBe('lin-banco-cat:C152');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#grp-banco-C152')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    expect(await focado()).toBe('lin-banco-PR-AAA');
    await expect(detalheDa(page, 'banco')).toHaveAttribute('data-id', 'PR-AAA');
    await page.keyboard.press('End');
    expect(await focado()).toBe('lin-banco-P-2');
    await page.keyboard.press('ArrowUp');
    expect(await focado()).toBe('lin-banco-P-1');
    await page.keyboard.press('Home');
    expect(await focado()).toBe('lin-banco-hangar');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    expect(await focado()).toBe('det-banco-titulo');
    // O Esc no detalhe volta à linha
    await page.keyboard.press('Escape');
    expect(await focado()).toBe('lin-banco-P-2');
    // Da busca: ↓ vai à primeira linha (com texto, ao primeiro item, sem o fixo e os cabeçalhos); Enter abre o primeiro
    await page.locator('[data-flt="banco"]').fill('sim');
    await page.keyboard.press('ArrowDown');
    expect(await focado()).toBe('lin-banco-SIM-A');
    await page.locator('[data-flt="banco"]').fill('p-1');
    await page.keyboard.press('Enter');
    expect(await focado()).toBe('det-banco-titulo');
    await expect(detalheDa(page, 'banco')).toHaveAttribute('data-id', 'P-1');
  });

  test('uma parada só no Tab: a linha escolhida e os controles dela; a ação não escolhe, a chave desta data muda num clique', async ({ page }) => {
    await abrir(page);
    await montarBancada(page);
    await expect(page.locator('#banco [tabindex="0"]')).toHaveCount(1);
    await linhaDaBancada(page, 'PR-AAA').locator('.lista-botao').click();
    // A linha escolhida e os dois controles dela, e nada mais da lista
    await expect(page.locator('#banco [tabindex="0"]')).toHaveCount(3);
    await expect(linhaDaBancada(page, 'PR-AAA').locator('[tabindex="0"]')).toHaveCount(3);
    await page.keyboard.press('Tab');
    await expect(linhaDaBancada(page, 'PR-AAA').locator('.lista-chave')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(linhaDaBancada(page, 'PR-AAA').locator('.lista-rapida input')).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('#banco')))).toBe(false);
    // A chave desta data: um clique
    await linhaDaBancada(page, 'PR-AAA').locator('.lista-rapida input').click();
    await expect(linhaDaBancada(page, 'PR-AAA').locator('.lista-rapida input')).not.toBeChecked();
    expect(await page.evaluate(() => window.modeloDoBanco.itens[0].rapida.marcado)).toBe(false);
    // A ação: faz a dela, e a linha não é escolhida
    await linhaDaBancada(page, 'P-1').locator('.lista-acao').click();
    expect(await page.evaluate(() => window.acoesDoBanco)).toEqual(['P-1']);
    await expect(detalheDa(page, 'banco')).toHaveAttribute('data-id', 'PR-AAA');
  });

  test('o vazio fixo ({ elemento }): o bloco da página aparece com nada escolhido e nunca é redesenhado', async ({ page }) => {
    await abrir(page);
    await montarBancada(page);
    const form = page.locator('#banco-novo');
    await expect(form).toBeVisible();
    await form.evaluate(f => { f.marca = 'a mesma'; });
    await page.locator('#banco-novo-nome').fill('digitado');
    await abrirNaLista(page, 'banco', 'SIM-A');
    await expect(form).toBeHidden();
    await page.evaluate(() => window.banco.escolher(null));
    await expect(form).toBeVisible();
    expect(await form.evaluate(f => f.marca)).toBe('a mesma');
    await expect(page.locator('#banco-novo-nome')).toHaveValue('digitado');
  });

  test('lendo e falhou: o texto do estado no lugar das linhas; "Tentar de novo" pede ao modelo', async ({ page }) => {
    await abrir(page);
    await montarBancada(page);
    await page.evaluate(() => { window.modeloDoBanco = { estado: 'lendo', textoDoEstado: 'Lendo os pedidos…', itens: [] }; window.banco.desenhar(); });
    await expect(page.locator('#banco > li')).toHaveText(['Lendo os pedidos…']);
    await expect(page.locator('#banco > li')).toHaveAttribute('role', 'status');
    await page.evaluate(() => {
      window.tentativas = 0;
      window.modeloDoBanco = { estado: 'falhou', textoDoEstado: 'Não foi possível ler os pedidos.', itens: [], tentar: () => { window.tentativas++; } };
      window.banco.desenhar();
    });
    await expect(page.locator('#banco > li')).toHaveText(['Não foi possível ler os pedidos. Tentar de novo']);
    await page.locator('#tentar-banco').click();
    expect(await page.evaluate(() => window.tentativas)).toBe(1);
  });

  test('"Mostrar inativos": o botão diz quantos, e o vazio diz quantos inativos passam com os filtros', async ({ page }) => {
    await abrir(page);
    await montarBancada(page);
    const botao = page.locator('#banco-inativos');
    await expect(botao).toHaveText('Mostrar inativos (1)');
    await expect(botao).toHaveAttribute('aria-pressed', 'false');
    await page.locator('[data-flt="banco"]').fill('ccc');
    await expect(page.locator('#banco > li.lista-vazia')).toHaveText('Nenhum item ativo com esses filtros; 1 inativo passa. Mostrar inativos Limpar filtros');
    await page.locator('#banco [data-lista-inativos="banco"]').click();
    await expect(botao).toHaveAttribute('aria-pressed', 'true');
    await expect(linhaDaBancada(page, 'PR-CCC')).toHaveClass(/\binativo\b/);
    await expect(linhaDaBancada(page, 'PR-CCC').locator('.lista-inativo')).toHaveText('inativo');
    await expect(page.locator('#banco-contagem')).toHaveText('1 de 6 itens');
    await botao.click();
    await expect(page.locator('#banco > li.lista-vazia')).toBeVisible();
  });

  // No celular: uma vista de cada vez; alvos de 44 px; a 320 px, a linha com as duas chaves guarda 120 px para o texto; nada
  // rola para o lado, nem a página nem os painéis. Com data-vendo="ambos", as duas regiões, na ordem da página
  for (const largura of [390, 320]) {
    test(`no celular (${largura} px): uma vista de cada vez, alvos de 44 px, o texto da linha com espaço e nada rolando para o lado; "ambos" mostra as duas`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      await abrir(page);
      await montarBancada(page);
      await expect(page.locator('#det-banco')).toBeHidden();
      expect(await alvosPequenos(page)).toEqual([]);
      const texto = await linhaDaBancada(page, 'PR-AAA').locator('.lista-texto').evaluate(el => el.getBoundingClientRect().width);
      expect(texto).toBeGreaterThanOrEqual(120);
      const paineis = () => page.locator('#s-banco [data-regiao]').evaluateAll(rs => rs.filter(r => r.checkVisibility()).map(r => r.scrollWidth <= r.clientWidth));
      expect(await paineis()).toEqual([true]);
      expect(await larguraDaPagina(page)).toBeLessThanOrEqual(largura);
      await abrirNaLista(page, 'banco', 'PR-AAA');
      await expect(page.locator('#banco')).toBeHidden();
      expect(await alvosPequenos(page)).toEqual([]);
      expect(await paineis()).toEqual([true]);
      await page.locator('#s-banco').evaluate(s => { s.dataset.vendo = 'ambos'; });
      await expect(page.locator('#banco')).toBeVisible();
      await expect(page.locator('#det-banco')).toBeVisible();
      const [lista, detalhe] = await Promise.all(['#banco', '#det-banco'].map(s => page.locator(s).boundingBox()));
      expect(detalhe.y).toBeGreaterThan(lista.y);
      expect(await larguraDaPagina(page)).toBeLessThanOrEqual(largura);
    });
  }

  // "ambos" é da tela (Aprovar): o componente nunca o troca, nem ao aparecer, nem no clique, nem no Esc
  test('no celular, data-vendo="ambos" fica: ao aparecer, no clique numa linha e no Esc; as duas regiões continuam à vista', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await abrir(page);
    await montarBancada(page);
    const secao = page.locator('#s-banco');
    await secao.evaluate(s => { s.dataset.vendo = 'ambos'; });
    await page.evaluate(() => window.banco.aoMostrar(null, { historico: 'nenhum' }));
    await expect(secao).toHaveAttribute('data-vendo', 'ambos');
    await linhaDaBancada(page, 'PR-AAA').locator('.lista-botao').click();
    await expect(detalheDa(page, 'banco')).toHaveAttribute('data-id', 'PR-AAA');
    await expect(secao).toHaveAttribute('data-vendo', 'ambos');
    await page.locator('#det-banco-titulo').focus();
    await page.keyboard.press('Escape');
    await expect(secao).toHaveAttribute('data-vendo', 'ambos');
    await expect(page.locator('#lin-banco-PR-AAA')).toBeFocused();
    await expect(page.locator('#banco')).toBeVisible();
    await expect(page.locator('#det-banco')).toBeVisible();
  });

  // No celular, o vazio fixo (o formulário de um item novo) abre como a segunda vista, com nada escolhido
  test('no celular, escolher(null, { abrir: true }) mostra o vazio fixo como a segunda vista; voltar devolve a lista', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await abrir(page);
    await montarBancada(page);
    await expect(page.locator('#banco-novo')).toBeHidden();
    await page.evaluate(() => window.banco.escolher(null, { abrir: true }));
    await expect(page.locator('#s-banco')).toHaveAttribute('data-vendo', 'detalhe');
    await expect(page.locator('#banco-novo')).toBeVisible();
    await expect(page.locator('#det-banco')).toBeFocused();
    await page.evaluate(() => window.banco.voltarParaALista());
    await expect(page.locator('#s-banco')).toHaveAttribute('data-vendo', 'lista');
    await expect(page.locator('#banco-novo')).toBeHidden();
  });

  // A ação que sai da linha depois do clique ("Aprovar" que aprova): o foco fica na linha, e as setas continuam dela
  test('a ação some depois do clique: o foco fica na linha, e ↓ e ↑ andam a partir dela', async ({ page }) => {
    await abrir(page);
    await montarBancada(page);
    await page.evaluate(() => {
      document.addEventListener('click', e => {
        if (!e.target.closest('[data-act="banco-acao"]')) return;
        delete window.modeloDoBanco.itens.find(i => i.id === 'P-1').acao;
        window.banco.desenhar();
      });
    });
    const focado = () => page.evaluate(() => document.activeElement.id || document.activeElement.dataset.chave);
    await page.locator('#lin-banco-P-1').focus();
    await page.keyboard.press('Tab');
    await expect(linhaDaBancada(page, 'P-1').locator('.lista-acao')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(linhaDaBancada(page, 'P-1').locator('.lista-acao')).toHaveCount(0);
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('[data-chave="i:P-1"]')))).toBe(true);
    await page.keyboard.press('ArrowDown');
    expect(await focado()).toBe('lin-banco-P-2');
    await page.keyboard.press('ArrowUp');
    expect(await focado()).toBe('lin-banco-P-1');
  });

  // Uma parte retida (o campo de texto em foco) é desenhada de novo depois, uma vez: os desenhos seguidos não acumulam esperas
  test('com o campo do detalhe em foco, cinco desenhos seguidos deixam uma espera só', async ({ page }) => {
    await abrir(page);
    await montarBancada(page);
    await abrirNaLista(page, 'banco', 'PR-BBB');
    await page.locator('#det-banco-nome').click();
    await page.keyboard.type('x');
    await page.evaluate(() => { window.desenhosDoDetalhe = 0; for (let i = 0; i < 5; i++) window.banco.desenhar(); });
    await page.waitForTimeout(1500);
    // Os cinco, e a espera de 600 ms duas vezes (sem acumular: 5 + 5 × 2)
    expect(await page.evaluate(() => window.desenhosDoDetalhe)).toBeLessThanOrEqual(8);
    await expect(page.locator('#det-banco-nome')).toHaveValue('PR-BBBx');
  });

  // Com as cores forçadas do sistema, o fundo some: a linha escolhida tem o contorno em Highlight, e a chave mostra o estado
  test('com as cores forçadas: a linha escolhida tem contorno, e a chave ligada é diferente da desligada', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await abrir(page);
    await montarBancada(page);
    await abrirNaLista(page, 'banco', 'PR-AAA');
    const contorno = li => li.evaluate(el => getComputedStyle(el).outlineStyle);
    expect(await contorno(linhaDaBancada(page, 'PR-AAA'))).not.toBe('none');
    expect(await contorno(linhaDaBancada(page, 'PR-BBB'))).toBe('none');
    const chave = linhaDaBancada(page, 'PR-AAA').locator('.lista-chave');
    const trilho = () => chave.evaluate(el => [getComputedStyle(el, '::before').backgroundColor, getComputedStyle(el, '::after').marginLeft]);
    const ligada = await trilho();
    await chave.evaluate(el => el.setAttribute('aria-checked', 'false'));
    const desligada = await trilho();
    expect(ligada[0]).not.toBe(desligada[0]);
    expect(ligada[1]).not.toBe(desligada[1]);
  });

  // "Mostrar inativos" do vazio sai da lista com o redesenho: o foco vai para a primeira linha que apareceu
  test('"Mostrar inativos" do vazio, pelo teclado: o foco vai para a primeira linha que apareceu', async ({ page }) => {
    await abrir(page);
    await montarBancada(page);
    await page.locator('[data-flt="banco"]').fill('ccc');
    await page.locator('#banco [data-lista-inativos="banco"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#lin-banco-PR-CCC')).toBeFocused();
  });
});

// Alunos, a primeira tela do componente
const estadoDeTres = () => ({ ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, {}, { nm: 'Ana', kg: 60 }), aluno(1001, {}, { nm: 'Bruno', kg: 70 }), aluno(1002, {}, { nm: 'Carla', kg: 80 })] }), nid: 1003 });

test.describe('Alunos no componente: o clique, as teclas e o endereço', () => {
  // O campo digitado avisa a mudança no mousedown do clique que tira o foco dele: o desenho espera o clique acabar, e o
  // clique vale na primeira vez (o foco no campo clicado, o dígito nele)
  test('digitado e clicado com o mouse, sem blur: o campo clicado recebe o foco e o dígito', async ({ page }) => {
    await abrir(page, { estado: estadoDeTres() });
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    await campoDoAberto(page, 'nm').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Souza');
    await campoDoAberto(page, 'kg').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('65');
    await expect(campoDoAberto(page, 'kg')).toHaveValue('65');
    await page.keyboard.press('Tab');
    await expect(page.locator('#audit-log-list')).toContainText('Aluno: Ana → Ana Souza');
    await expect(page.locator('#audit-log-list')).toContainText('Peso Ana Souza: 65 kg');
    await expect(linhaDoAluno(page, 1000).locator('.lista-titulo')).toHaveText('Ana Souza');
  });

  test('digitado e clicado: outro aluno escolhido com um clique; "Excluir aluno…" armado com um clique', async ({ page }) => {
    await abrir(page, { estado: estadoDeTres() });
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    await campoDoAberto(page, 'kg').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('66');
    await linhaDoAluno(page, 1001).locator('.lista-botao').click();
    await expect(page.locator('#det-alu-titulo')).toHaveText('Bruno');
    await expect(page.locator('#audit-log-list')).toContainText('Peso Ana: 66 kg');
    await campoDoAberto(page, 'kg').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('71');
    await page.locator('#det-alu-excluir').click();
    await expect(page.locator('#det-alu-excluir')).toHaveText('Confirmar exclusão');
    await expect(page.locator('#audit-log-list')).toContainText('Peso Bruno: 71 kg');
  });

  test.describe('com toque', () => {
    test.use({ hasTouch: true });
    test('digitado e tocado: o outro aluno com um toque, e o campo tocado recebe o foco', async ({ page }) => {
      await abrir(page, { estado: estadoDeTres() });
      await irPara(page, 'alu');
      await abrirAluno(page, 1000);
      await campoDoAberto(page, 'kg').tap();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type('67');
      await campoDoAberto(page, 'nm').tap();
      await expect(campoDoAberto(page, 'nm')).toBeFocused();
      await expect(page.locator('#audit-log-list')).toContainText('Peso Ana: 67 kg');
      await page.keyboard.press('End');
      await page.keyboard.type('!');
      await linhaDoAluno(page, 1002).locator('.lista-botao').tap();
      await expect(page.locator('#det-alu-titulo')).toHaveText('Carla');
      await expect(page.locator('#audit-log-list')).toContainText('Aluno: Ana → Ana!');
    });
  });

  // O desenho troca só o que mudou: a linha que a gravação não mudou continua o mesmo elemento (a marca posta nela fica)
  test('uma gravação troca só a linha que mudou: as outras continuam os mesmos elementos', async ({ page }) => {
    await abrir(page, { estado: estadoDeTres() });
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    for (const id of [1001, 1002]) await linhaDoAluno(page, id).evaluate(li => { li.marca = 'antes'; });
    await linhaDoAluno(page, 1000).evaluate(li => { li.marca = 'antes'; });
    await campoDoAberto(page, 'nm').fill('Ana Maria');
    await campoDoAberto(page, 'nm').press('Tab');
    await expect(linhaDoAluno(page, 1000).locator('.lista-titulo')).toHaveText('Ana Maria');
    expect(await linhaDoAluno(page, 1001).evaluate(li => li.marca)).toBe('antes');
    expect(await linhaDoAluno(page, 1002).evaluate(li => li.marca)).toBe('antes');
    expect(await linhaDoAluno(page, 1000).evaluate(li => li.marca)).toBeUndefined();
  });

  test('as setas escolhem e o endereço acompanha; Enter vai ao título; Esc volta à linha; o Tab de um campo digitado vai ao vizinho', async ({ page }) => {
    await abrir(page, { estado: estadoDeTres() });
    await irPara(page, 'alu');
    await linhaDoAluno(page, 1000).locator('.lista-botao').click();
    await page.keyboard.press('ArrowDown');
    await expect(linhaDoAluno(page, 1001).locator('.lista-botao')).toBeFocused();
    await expect(page.locator('#det-alu-titulo')).toHaveText('Bruno');
    await expect(page).toHaveURL(/#\/alu\/1001$/);
    await page.keyboard.press('Enter');
    await expect(page.locator('#det-alu-titulo')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(linhaDoAluno(page, 1001).locator('.lista-botao')).toBeFocused();
    // O Tab de um campo digitado: o seguinte, mesmo com a parte redesenhada
    await campoDoAberto(page, 'nm').fill('Bruno Lima');
    await page.keyboard.press('Tab');
    await expect(campoDoAberto(page, 'kg')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(campoDoAberto(page, 'nm')).toBeFocused();
  });

  test('Ctrl+. grava o campo e vai ao mesmo campo do próximo aluno; Ctrl+, ao do anterior; "Anterior" e "Próximo" desligados nas pontas', async ({ page }) => {
    await abrir(page, { estado: estadoDeTres() });
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    await expect(page.locator('#det-alu-anterior')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#det-alu-anterior')).toHaveAccessibleName('Aluno anterior');
    await campoDoAberto(page, 'kg').fill('61');
    await page.keyboard.press('Control+.');
    await expect(page.locator('#det-alu-titulo')).toHaveText('Bruno');
    await expect(campoDoAberto(page, 'kg')).toBeFocused();
    await expect(page.locator('#audit-log-list')).toContainText('Peso Ana: 61 kg');
    await page.keyboard.type('72');
    await page.keyboard.press('Control+.');
    await expect(page.locator('#det-alu-titulo')).toHaveText('Carla');
    await expect(page.locator('#audit-log-list')).toContainText('Peso Bruno: 72 kg');
    await expect(page.locator('#det-alu-proximo')).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Control+,');
    await expect(page.locator('#det-alu-titulo')).toHaveText('Bruno');
    await page.locator('#det-alu-proximo').click();
    await expect(page.locator('#det-alu-titulo')).toHaveText('Carla');
    await expect(page.locator('#det-alu-proximo')).toBeFocused();
    await expect(page).toHaveURL(/#\/alu\/1002$/);
  });

  // Com o Histórico aberto, o Esc é dele primeiro; o segundo devolve o campo digitado ao valor gravado; o terceiro vai à linha
  test('com o Histórico aberto: o primeiro Esc fecha só ele, o segundo devolve o campo, o terceiro vai à linha', async ({ page }) => {
    await abrir(page, { estado: estadoDeTres() });
    await irPara(page, 'alu');
    await abrirAluno(page, 1001);
    await abrirHistorico(page);
    await campoDoAberto(page, 'kg').fill('99');
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
    await expect(campoDoAberto(page, 'kg')).toHaveValue('99');
    await page.keyboard.press('Escape');
    await expect(campoDoAberto(page, 'kg')).toHaveValue('70');
    await expect(campoDoAberto(page, 'kg')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(linhaDoAluno(page, 1001).locator('.lista-botao')).toBeFocused();
    await expect(page.locator('#log-cnt')).toHaveText('0');
  });

  test('a escolha dura à troca de data, ao nome mudado e a recarregar (#/alu/1001); o aluno novo é escolhido e vai para o endereço', async ({ page }) => {
    await abrir(page, { estado: estadoDeTres() });
    await irPara(page, 'alu');
    await abrirAluno(page, 1001);
    await expect(page).toHaveURL(/#\/alu\/1001$/);
    await diaSeguinte(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect(page.locator('#det-alu-titulo')).toHaveText('Bruno');
    await expect(page).toHaveURL(/\?data=2026-11-12#\/alu\/1001$/);
    await campoDoAberto(page, 'nm').fill('Bruno Lima');
    await campoDoAberto(page, 'nm').blur();
    await expect(linhaDoAluno(page, 1001).locator('.lista-botao')).toHaveAttribute('aria-current', 'true');
    await page.reload();
    await appPronto(page);
    await expect(page.locator('#det-alu-titulo')).toHaveText('Bruno Lima');
    await expect(linhaDoAluno(page, 1001).locator('.lista-botao')).toHaveAttribute('aria-current', 'true');
    // Outra tela e a volta pela navegação: a escolha da memória volta ao endereço
    await irPara(page, 'esc');
    await irPara(page, 'alu');
    await expect(page).toHaveURL(/#\/alu\/1001$/);
    // O aluno novo: escolhido, e no endereço quando a gravação é confirmada
    await page.locator('[data-act="adds"]').click();
    await expect(page).toHaveURL(/#\/alu\/1003$/);
    await expect(page.locator('#det-alu-titulo')).toHaveText('Novo aluno');
    expect(await nomesNaLista(page)).toEqual(['Ana', 'Bruno Lima', 'Carla', 'Novo aluno']);
  });

  test.describe('no celular', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('a lista, depois o detalhe; "‹ Alunos" e o Voltar do navegador devolvem a lista, com o foco na linha', async ({ page }) => {
      await abrir(page, { estado: estadoDeTres() });
      await irPara(page, 'alu');
      await expect(page.locator('#s-alu')).toHaveAttribute('data-vendo', 'lista');
      await linhaDoAluno(page, 1001).locator('.lista-botao').click();
      await expect(page.locator('#s-alu')).toHaveAttribute('data-vendo', 'detalhe');
      await expect(page.locator('#alu')).toBeHidden();
      await expect(page.locator('#det-alu-titulo')).toBeFocused();
      await expect(page).toHaveURL(/#\/alu\/1001$/);
      await page.locator('#det-alu-voltar').click();
      await expect(page.locator('#s-alu')).toHaveAttribute('data-vendo', 'lista');
      await expect(linhaDoAluno(page, 1001).locator('.lista-botao')).toBeFocused();
      await expect(page).toHaveURL(/#\/alu$/);
      // O Voltar do navegador
      await linhaDoAluno(page, 1002).locator('.lista-botao').click();
      await expect(page.locator('#det-alu-titulo')).toHaveText('Carla');
      await page.goBack();
      await expect(page.locator('#s-alu')).toHaveAttribute('data-vendo', 'lista');
      await expect(linhaDoAluno(page, 1002).locator('.lista-botao')).toBeFocused();
      // E o Avançar abre o detalhe de novo
      await page.goForward();
      await expect(page.locator('#s-alu')).toHaveAttribute('data-vendo', 'detalhe');
      await expect(page.locator('#det-alu-titulo')).toHaveText('Carla');
      // O foco vai para o título do detalhe (a linha que o tinha saiu da vista)
      await expect(page.locator('#det-alu-titulo')).toBeFocused();
    });

    // A exclusão no detalhe aberto (a entrada empilhada) volta por ela: o Voltar seguinte sai de Alunos, sem uma entrada morta
    test('"Excluir aluno…" no detalhe: a lista volta, e o Voltar seguinte sai de Alunos', async ({ page }) => {
      await abrir(page, { estado: estadoDeTres() });
      await irPara(page, 'alu');
      await linhaDoAluno(page, 1002).locator('.lista-botao').click();
      await expect(page.locator('#s-alu')).toHaveAttribute('data-vendo', 'detalhe');
      await page.locator('#det-alu-excluir').click();
      await page.locator('#det-alu-excluir').click();
      await expect(page.locator('#s-alu')).toHaveAttribute('data-vendo', 'lista');
      await expect(linhaDoAluno(page, 1002)).toHaveCount(0);
      await expect(page).toHaveURL(/#\/alu$/);
      await expect(linhaDoAluno(page, 1001).locator('.lista-botao')).toBeFocused();
      await page.goBack();
      await expect(page.locator('#s-alu')).not.toHaveClass(/\bon\b/);
    });
  });

  // O aluno que sai do cadastro (outra pessoa o excluiu) com o foco no detalhe: o foco fica na região do detalhe, que diz por quê
  test('o aluno aberto sai do cadastro com o foco num campo: o foco vai para a região do detalhe', async ({ page }) => {
    await abrir(page, { estado: estadoDeTres() });
    await irPara(page, 'alu');
    await abrirAluno(page, 1001);
    await campoDoAberto(page, 'kg').focus();
    await page.evaluate(async () => {
      const { S } = await import('./js/state.js');
      S.stu = S.stu.filter(s => s.id !== 1001);
      const { redesenhar } = await import('./js/redesenho.js');
      redesenhar('releitura');
    });
    await expect(page.locator('#det-alu')).toContainText('Este aluno saiu do cadastro.');
    await expect(page.locator('#det-alu')).toBeFocused();
    await expect(page).toHaveURL(/#\/alu$/);
  });

  // A 320 px, as ações do detalhe vão para baixo do título: o nome longo fica com a largura, sem quebrar no meio da palavra
  test('a 320 px, as ações do detalhe ficam embaixo do título, e o nome longo tem a largura do painel', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const longo = { ...estadoDeTres() };
    longo.stu = [aluno(1000, {}, { nm: 'Carla Fernanda de Albuquerque Monteiro', kg: 60 }), ...longo.stu.slice(1)];
    await abrir(page, { estado: longo });
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    const [titulo, acoes] = await Promise.all(['#det-alu-titulo', '#det-alu .det-acoes'].map(s => page.locator(s).boundingBox()));
    expect(acoes.y).toBeGreaterThanOrEqual(titulo.y + titulo.height - 1);
    expect(titulo.width).toBeGreaterThanOrEqual(180);
    // Nenhuma palavra partida: cada palavra numa linha só
    const partidas = await page.locator('#det-alu-titulo').evaluate(h => {
      const texto = h.firstChild, r = document.createRange();
      let i = 0;
      return texto.data.split(' ').filter(p => { r.setStart(texto, i); r.setEnd(texto, i + p.length); i += p.length + 1; return r.getClientRects().length > 1; });
    });
    expect(partidas).toEqual([]);
  });

  test('o Gestor escolhe e lê o texto, sem o CANAC; o detalhe tem até 760 px de largura', async ({ page }) => {
    await page.addInitScript(dados => {
      if (!localStorage.getItem('acpm4_dados_pessoais')) localStorage.setItem('acpm4_dados_pessoais', dados);
    }, JSON.stringify({ 'aluno:1000': { canac: '123456' } }));
    await page.setViewportSize({ width: 1920, height: 1000 });
    await abrir(page, { estado: estadoDeTres() });
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    expect(await page.locator('#det-alu .det').evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(760);
    await expect(linhaDoAluno(page, 1000).locator('.lista-l2')).toContainText('CANAC 123456');
    await page.locator('#role-sel').selectOption('gestor');
    await expect(linhaDoAluno(page, 1000).locator('.lista-l2')).not.toContainText('CANAC');
    await abrirAluno(page, 1001);
    await abrirAluno(page, 1000);
    await expect(page.locator('#det-alu [data-campo="kg"] .det-valor')).toHaveText('60 kg');
    await expect(page.locator('#det-alu input, #det-alu select')).toHaveCount(0);
    await expect(page.locator('#det-alu')).not.toContainText('123456');
    await expect(page.locator('[data-act="adds"]')).toBeHidden();
  });
});
