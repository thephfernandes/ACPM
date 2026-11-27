// Alunos como lista e detalhe (F2): o cadastro no detalhe, a busca, o filtro dos cursos, "Excluir aluno…" armado e o
// celular (a lista, depois o detalhe). O componente em si (as teclas, o clique, a bancada) fica em lista.spec.js
import {
  test, comProgresso, expect, abrir, abrirSintetico, abrirComExemplo, irPara, irParaVista, filtrarCursos, confirmar, AGORA, AMANHA, alvosPequenos,
  appPronto, botaoDaAba, dataAberta, diaSeguinte, larguraDaPagina, abrirAluno, campoDoAberto, linhaDoAluno, linhasDosAlunos, nomesNaLista,
  etiquetasDoAberto, nenhumNaLista, abrirHistorico, campoDaAgenda
} from './fixtures.js';
import { documentosAtuais } from './supabase-falso.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';
import { cursosIniciais } from '../../js/programa.js';
import { GLOSSARIO } from '../../js/glossario.js';

test.describe('Alunos', () => {
  test('cadastra, bloqueia instrutor e exclui aluno com confirmação, no detalhe', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'alu');
    await expect(page.locator('#alu')).toHaveText('Nenhum aluno cadastrado. Clique em “+ Novo aluno” acima para cadastrar.');
    await expect(page.locator('#det-alu')).toHaveText('Escolha um aluno na lista.');
    await page.locator('[data-act="adds"]').click();
    await expect(linhasDosAlunos(page)).toHaveCount(1);
    // O aluno novo abre escolhido, com o nome em foco (selecionado, para digitar por cima)
    await expect(campoDoAberto(page, 'nm')).toHaveValue('Novo aluno');
    await expect(campoDoAberto(page, 'nm')).toBeFocused();
    await expect(campoDoAberto(page, 'kg')).toHaveClass(/\bfalta\b/);
    // Sem peso: o ponto da linha diz
    await expect(linhasDosAlunos(page).first().locator('.lista-ponto.aviso')).toHaveAttribute('title', 'sem peso');

    const naoEscalar = campoDoAberto(page, 'bl');
    await expect(naoEscalar.locator('option').first()).toHaveText('Não escalar com…');
    await naoEscalar.selectOption({ label: 'Instrutor 03' });
    await expect(etiquetasDoAberto(page, 'bl')).toHaveText(/Instrutor 03/);
    // O foco continua no campo, para bloquear outro em seguida
    await expect(campoDoAberto(page, 'bl')).toBeFocused();
    await page.locator('#det-alu [data-act="unbl"]').click();
    await expect(etiquetasDoAberto(page, 'bl')).toHaveCount(0);
    await expect(campoDoAberto(page, 'bl')).toBeFocused();

    await irPara(page, 'dem');
    await expect(page.locator('#dem tr[data-k="d"]')).toHaveCount(1);

    // De volta, o aluno continua aberto; "Excluir aluno…", no rodapé, pede o segundo clique
    await irPara(page, 'alu');
    const excluir = page.locator('#det-alu-excluir');
    await excluir.click();
    await expect(excluir).toHaveText('Confirmar exclusão');
    await excluir.click();
    await expect(page.locator('#alu')).toContainText('Nenhum aluno cadastrado');
    await expect(page.locator('#det-alu')).toHaveText('Escolha um aluno na lista.');
    await expect(page).toHaveURL(/#\/alu$/);
  });

  test('o nome tem até 80 caracteres, nos alunos e nos instrutores', async ({ page }) => {
    await abrirSintetico(page);
    const longo = 'Maria '.repeat(20);
    await irPara(page, 'alu');
    await page.locator('[data-act="adds"]').click();
    await expect(campoDoAberto(page, 'nm')).toHaveAttribute('maxlength', '80');
    await campoDoAberto(page, 'nm').fill(longo);
    await campoDoAberto(page, 'nm').blur();
    await expect(campoDoAberto(page, 'nm')).toHaveValue(longo.slice(0, 80).trim());
    await expect(page.locator('#det-alu-titulo')).toHaveText(longo.slice(0, 80).trim());
    await irPara(page, 'ins');
    await page.locator('[data-act="addi"]').click();
    const nome = page.locator('#inst .cd').last().locator('.nm');
    await expect(nome).toHaveAttribute('maxlength', '80');
    await nome.fill(longo);
    await nome.blur();
    await expect(page.locator('#inst .cd').last().locator('.nm')).toHaveValue(longo.slice(0, 80).trim());
  });

  // Em Alunos, o peso recusado fica no campo, com a mensagem embaixo dele (o Esc devolve o gravado); em Instrutores (até C),
  // o aviso e o campo de volta ao peso de antes
  test('o peso vai até 300 kg, nos alunos e nos instrutores: acima disso, não vale', async ({ page }) => {
    await abrirSintetico(page);
    const historico = page.locator('#audit-log-list');
    await irPara(page, 'alu');
    await page.locator('[data-act="adds"]').click();
    const peso = campoDoAberto(page, 'kg');
    const erro = page.locator('#det-alu-kg-erro');
    await expect(peso).toHaveAttribute('min', '1');
    await expect(peso).toHaveAttribute('max', '300');
    await peso.fill('250');
    await peso.blur();
    await expect(historico).toContainText('Peso Novo aluno: 250 kg');
    await expect(peso).not.toHaveClass(/\bfalta\b/);
    // Acima de 300 kg: o valor fica no campo, marcado, com a mensagem; nada é gravado
    await peso.fill('350');
    await peso.press('Tab');
    await expect(erro).toHaveText('O peso vai de 1 a 300 kg.');
    await expect(peso).toHaveValue('350');
    await expect(peso).toHaveAttribute('aria-invalid', 'true');
    await expect(peso).toHaveAccessibleDescription('O peso vai de 1 a 300 kg.');
    // O Esc no campo devolve o peso gravado, e a mensagem sai
    await peso.focus();
    await page.keyboard.press('Escape');
    await expect(peso).toHaveValue('250');
    await expect(erro).toHaveText('');
    await expect(peso).not.toHaveAttribute('aria-invalid', 'true');
    // Um texto que não é número também não vale
    await peso.fill('');
    await peso.pressSequentially('1-2');
    await peso.blur();
    await expect(erro).toHaveText('O peso vai de 1 a 300 kg.');
    // O peso certo grava e tira a mensagem
    await peso.fill('72.5');
    await peso.blur();
    await expect(historico).toContainText('Peso Novo aluno: 72,5 kg');
    await expect(erro).toHaveText('');
    await expect(historico).not.toContainText('Peso Novo aluno: 350');

    // Instrutores (a tabela, até C): o aviso e o peso de antes
    await irPara(page, 'ins');
    await page.locator('[data-act="addi"]').click();
    const pesoIns = page.locator('#inst .cd').last().locator('[data-f="kg"]');
    await pesoIns.fill('250');
    await pesoIns.blur();
    await expect(historico).toContainText('Peso Novo instrutor: 250 kg');
    await pesoIns.fill('350');
    await pesoIns.blur();
    await expect(page.locator('.toast')).toHaveText('O peso vai de 1 a 300 kg.');
    await expect(pesoIns).toHaveValue('250');

    // O peso digitado fica gravado; vazio, a pessoa fica sem peso
    await page.reload();
    await appPronto(page);
    await irPara(page, 'alu');
    await abrirAluno(page, await linhasDosAlunos(page).last().getAttribute('data-id'));
    await expect(campoDoAberto(page, 'kg')).toHaveValue('72.5');
    await campoDoAberto(page, 'kg').fill('');
    await campoDoAberto(page, 'kg').blur();
    await expect(campoDoAberto(page, 'kg')).toHaveClass(/\bfalta\b/);
    await expect(campoDoAberto(page, 'kg')).toHaveValue('');
  });

  // A busca acha o nome sem os acentos e continua depois de cada redesenho: outra data, um instrutor renomeado, o aluno
  // renomeado e o aluno novo, que ficam à vista mesmo fora da busca, até ela mudar. A contagem diz quantos aparecem; sem
  // nenhum, "Limpar filtros"
  test('a busca acha o nome sem acentos e continua depois de cada redesenho: outra data, um instrutor renomeado, o aluno renomeado, + Novo aluno', async ({ page }) => {
    const estado = { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { nm: 'João Silva' }), aluno(1001, {}, { nm: 'Maria da Conceição' }), aluno(1002)] }), nid: 1003 };
    await abrir(page, { estado });
    await irPara(page, 'alu');
    const busca = page.locator('[data-flt="alu"]');
    const contagem = page.locator('#alu-contagem');
    await expect(contagem).toHaveAttribute('role', 'status');
    await expect(contagem).toHaveText('3 alunos');
    await busca.fill('joao');
    await expect.poll(() => nomesNaLista(page)).toEqual(['João Silva']);
    await expect(contagem).toHaveText('1 de 3 alunos');
    await busca.fill('CONCEICAO');
    await expect.poll(() => nomesNaLista(page)).toEqual(['Maria da Conceição']);
    await busca.fill('  maria   da ');
    await expect.poll(() => nomesNaLista(page)).toEqual(['Maria da Conceição']);
    await busca.fill('joão');
    await expect.poll(() => nomesNaLista(page)).toEqual(['João Silva']);

    // Outra data: a lista é refeita só no que mudou (a linha do João continua a mesma, com a marca que lhe foi posta)
    await linhaDoAluno(page, 1000).evaluate(li => { li.dataset.antes = ''; });
    await diaSeguinte(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect.poll(() => nomesNaLista(page)).toEqual(['João Silva']);
    await expect(linhaDoAluno(page, 1000)).toHaveAttribute('data-antes', '');
    await expect(busca).toHaveValue('joão');
    await expect(contagem).toHaveText('1 de 3 alunos');

    // Um instrutor renomeado
    await irParaVista(page, 'ins', 'cadastro');
    await page.locator('#inst .cd[data-id="1"] .nm').fill('Instrutor Um');
    await page.locator('#inst .cd[data-id="1"] .nm').blur();
    await expect(page.locator('#audit-log-list')).toContainText('Instrutor: Instrutor 01 → Instrutor Um');
    await irPara(page, 'alu');
    await expect.poll(() => nomesNaLista(page)).toEqual(['João Silva']);

    // O aluno renomeado no detalhe, pelo teclado: a linha continua à vista, mesmo fora da busca, e o Tab leva ao campo
    // seguinte, o peso. Mudada a busca, ela vale para o nome novo
    await abrirAluno(page, 1000);
    await campoDoAberto(page, 'nm').fill('Joaquim Silva');
    await page.keyboard.press('Tab');
    await expect(page.locator('#audit-log-list')).toContainText('Aluno: João Silva → Joaquim Silva');
    await expect(campoDoAberto(page, 'kg')).toBeFocused();
    await expect.poll(() => nomesNaLista(page)).toEqual(['Joaquim Silva']);
    await expect(contagem).toHaveText('1 de 3 alunos');
    await busca.fill('joao');
    await expect(page.locator('#alu > li.lista-vazia')).toBeVisible();
    await expect.poll(() => nomesNaLista(page)).toEqual([]);
    await expect(contagem).toHaveText('0 de 3 alunos');
    // O filtro nunca tira a escolha: o detalhe continua aberto
    await expect(page.locator('#det-alu-titulo')).toHaveText('Joaquim Silva');
    await busca.fill('joaquim');
    await expect.poll(() => nomesNaLista(page)).toEqual(['Joaquim Silva']);

    // O aluno novo aparece, escolhido, com o nome em foco; os outros continuam filtrados. Renomeado, ele continua à vista
    await page.locator('[data-act="adds"]').click();
    await expect.poll(() => nomesNaLista(page)).toEqual(['Joaquim Silva', 'Novo aluno']);
    await expect(campoDoAberto(page, 'nm')).toBeFocused();
    await expect(busca).toHaveValue('joaquim');
    await expect(contagem).toHaveText('2 de 4 alunos');
    await campoDoAberto(page, 'nm').fill('Pedro Álvares');
    await campoDoAberto(page, 'nm').blur();
    await expect(page.locator('#audit-log-list')).toContainText('Aluno: Novo aluno → Pedro Álvares');
    await expect.poll(() => nomesNaLista(page)).toEqual(['Joaquim Silva', 'Pedro Álvares']);
    await busca.fill('alvares');
    await expect.poll(() => nomesNaLista(page)).toEqual(['Pedro Álvares']);

    // Nenhum com esses filtros: a lista diz por quê; "Limpar filtros" mostra todos de novo, com o foco na busca
    await busca.fill('xyz');
    await expect(page.locator('#alu > li.lista-vazia')).toHaveText('Nenhum aluno com esses filtros. Limpar filtros');
    await expect(contagem).toHaveText('0 de 4 alunos');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(busca).toHaveValue('');
    await expect(busca).toBeFocused();
    await expect(linhasDosAlunos(page)).toHaveCount(4);
    await expect(page.locator('#alu > li.lista-vazia')).toHaveCount(0);
    await expect(contagem).toHaveText('4 alunos');
  });
});

// O "Ativo" do cadastro (F2): a chave da linha, um clique em cada sentido, o aviso, o Histórico e "Mostrar inativos"
test.describe('Alunos: Ativo e Mostrar inativos', () => {
  const estado = () => ({ ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { nm: 'Ana' }), aluno(1001, {}, { nm: 'Bruno' }), aluno(1002, {}, { nm: 'Carla' })] }), nid: 1003 });
  const chave = (page, id) => linhaDoAluno(page, id).locator('.lista-chave');

  test('um clique desliga: a linha fica, discreta, com "inativo"; o aviso diz o que muda; o Histórico reverte; outro clique liga', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await irPara(page, 'alu');
    await expect(chave(page, 1000)).toHaveAttribute('role', 'switch');
    await expect(chave(page, 1000)).toHaveAttribute('aria-checked', 'true');
    await expect(chave(page, 1000)).toHaveAccessibleName('Ana ativo no cadastro');
    await expect(page.locator('#alu-inativos')).toBeHidden();
    await chave(page, 1000).click();
    await expect(chave(page, 1000)).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#toast-box')).toContainText('Ana inativo de hoje em diante. Os voos dele nesta data continuam; os pedidos ficam registrados e só entram quando ele voltar a ativo. As datas passadas não mudam.');
    // A linha continua à vista (até um filtro mudar), discreta e com a etiqueta
    await expect(linhaDoAluno(page, 1000)).toHaveClass(/\binativo\b/);
    await expect(linhaDoAluno(page, 1000).locator('.lista-inativo')).toHaveText('inativo');
    await expect(page.locator('#alu-inativos')).toHaveText('Mostrar inativos (1)');
    await expect(page.locator('#alu-contagem')).toHaveText('2 alunos');
    // O detalhe dele diz o que o inativo quer dizer
    await abrirAluno(page, 1000);
    await expect(page.locator('#det-alu-aviso')).toContainText('Inativo no cadastro');
    // Gravado no cadastro, com a entrada do Histórico, que reverte
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('acpm4_cadastro')).stu.find(s => s.id === 1000).inativo)).toBe(true);
    await abrirHistorico(page);
    const entrada = page.locator('#audit-log-list .audit-item', { hasText: 'Ana: inativo no cadastro' });
    await entrada.locator('[data-act="rev-log"]').click();
    await expect(chave(page, 1000)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#audit-log-list')).toContainText('Revertido: Ana: ativo no cadastro');
    await page.locator('#btn-fechar-historico').click();
    // Um clique liga de novo, e outro desliga
    await chave(page, 1001).click();
    await expect(chave(page, 1001)).toHaveAttribute('aria-checked', 'false');
    await chave(page, 1001).click();
    await expect(chave(page, 1001)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#toast-box')).toContainText('Bruno ativo de novo, de hoje em diante.');
    await expect.poll(() => page.evaluate(() => 'inativo' in JSON.parse(localStorage.getItem('acpm4_cadastro')).stu.find(s => s.id === 1001))).toBe(false);
  });

  test('"Mostrar inativos": o inativo sai da lista quando um filtro muda e volta com o botão; a busca vazia diz quantos inativos passam', async ({ page }) => {
    await abrir(page, { estado: estado() });
    await irPara(page, 'alu');
    await chave(page, 1002).click();
    await expect(chave(page, 1002)).toHaveAttribute('aria-checked', 'false');
    await page.locator('[data-flt="alu"]').fill('carla');
    await expect(page.locator('#alu > li.lista-vazia')).toHaveText('Nenhum aluno ativo com esses filtros; 1 inativo passa. Mostrar inativos Limpar filtros');
    await page.locator('#alu [data-lista-inativos="alu"]').click();
    await expect(page.locator('#alu-inativos')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => nomesNaLista(page)).toEqual(['Carla']);
    await expect(page.locator('#alu-contagem')).toHaveText('1 de 3 alunos');
    await page.locator('[data-flt="alu"]').fill('');
    await page.locator('#alu-inativos').click();
    await expect(page.locator('#alu-inativos')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana', 'Bruno']);
    await expect(page.locator('#alu-contagem')).toHaveText('2 alunos');
    // O aluno inativo não entra num pedido novo (a lista de alunos do formulário da Agenda fica sem ele)
    await irPara(page, 'age');
    await expect(campoDaAgenda(page, 'aluno').locator('option', { hasText: 'Carla' })).toHaveCount(0);
    // Quem só consulta não vê a chave
    await page.locator('#role-sel').selectOption('gestor');
    await irPara(page, 'alu');
    await expect(chave(page, 1000)).toBeHidden();
  });
});

// O filtro dos cursos de Alunos (o filtro de vários valores, com a regra "alguma": um curso só por aluno), a barra e o link
// para a Demanda
test.describe('Alunos: o filtro dos cursos e a barra', () => {
  // O cadastro e o dia, com os cursos como as tabelas dos cursos os guardam, neste navegador
  async function abrirComCursos(page, { estado, cursos = cursosIniciais() }) {
    const { documentos: { cadastro }, dias } = documentosAtuais(estado, AMANHA);
    const docs = { acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_cursos: { cursos, alteracoes: [] } };
    await page.addInitScript(json => {
      if (localStorage.getItem('acpm4_cadastro')) return;
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify(docs));
    await page.goto('./');
    await appPronto(page);
  }

  // A barra fica no painel da lista, inteira: a busca, o filtro, "+ Novo aluno" e a contagem, nada para fora dele
  test('a barra de Alunos: a busca, o filtro, "+ Novo aluno" e a contagem, dentro do painel da lista', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await irPara(page, 'alu');
    const caixas = await page.locator('#s-alu .lista-barra').evaluate(bar => {
      const painel = bar.closest('[data-regiao="lista"]').getBoundingClientRect();
      return ['input[type="search"]', '.filtro-botao', '[data-act="adds"]', '.contagem'].map(s => {
        const r = bar.querySelector(s).getBoundingClientRect();
        return r.left >= painel.left && r.right <= painel.right + 0.5;
      });
    });
    expect(caixas).toEqual([true, true, true, true]);
    await expect(page.locator('#alu')).toHaveAttribute('role', 'list');
    await expect(page.locator('#alu')).toHaveAccessibleName('Alunos');
  });

  test('o filtro dos cursos: os ativos, o encerrado e o desconhecido marcados e "Sem curso"; aparece quem está em algum dos marcados', async ({ page }) => {
    const estado = cenario({
      ins: [instrutor(1, 9)],
      stu: [aluno(1000, {}, { nm: 'Ana', curso: 'PP' }), aluno(1001, {}, { nm: 'Bruno', curso: 'PC' }), aluno(1002, {}, { nm: 'Carla', curso: 'ZZ9' }),
        aluno(1003, {}, { nm: 'Davi' }), aluno(1004, {}, { nm: 'Elisa', curso: 'INVA' })]
    });
    await abrirComCursos(page, { estado, cursos: cursosIniciais().map(c => (c.sigla === 'PC' ? { ...c, ativo: false } : c)) });
    await irPara(page, 'alu');
    const botao = page.locator('#flt-alu-cur'), painel = page.locator('#flt-alu-cur-painel'), contagem = page.locator('#alu-contagem');
    const caixa = valor => painel.locator(`input[data-valor="${valor}"]`);
    await expect(botao).toHaveText('Todos os cursos');
    await expect(botao).toHaveAttribute('aria-expanded', 'false');
    await expect(botao).toHaveAttribute('aria-controls', 'flt-alu-cur-painel');
    await botao.click();
    await expect(painel).toBeVisible();
    await expect(painel).toHaveAccessibleName('Filtrar por curso');
    await expect(painel.locator('.filtro-regra')).toHaveText('Mostra os alunos de algum dos cursos marcados.');
    await expect(painel.locator('.filtro-regra [data-dica="filtro-dos-cursos"]')).toHaveAccessibleName('O que é Filtro dos cursos?');
    await expect(painel.locator('.filtro-regra [data-dica="filtro-dos-cursos"]')).toHaveAccessibleDescription(GLOSSARIO['filtro-dos-cursos'].texto);
    await expect(painel.locator('legend')).toHaveText(['Cursos']);
    await expect(painel.locator('label')).toHaveText(['PP · Piloto Privado', 'INVA · Instrutor de Voo', 'PC · Piloto Comercial (encerrado)', 'ZZ9 (curso desconhecido)', 'Sem curso']);
    // Cada linha diz o curso do aluno, na segunda linha
    await expect(linhaDoAluno(page, 1000).locator('.lista-l2')).toHaveText('PP');
    await expect(linhaDoAluno(page, 1003).locator('.lista-l2')).toHaveText('sem curso');

    await caixa('PP').check();
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana']);
    await expect(botao).toHaveText('Curso: PP');
    await expect(botao).toHaveClass(/\bcom-marcas\b/);
    await expect(contagem).toHaveText('1 de 5 alunos');
    await caixa('PC').check();
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana', 'Bruno']);
    await expect(botao).toHaveText('Curso: PP ou PC');
    await expect(contagem).toHaveText('2 de 5 alunos');
    await caixa('sem-curso').check();
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana', 'Bruno', 'Davi']);
    await expect(botao).toHaveText('Curso: PP ou PC ou sem curso');
    await page.locator('[data-flt="alu"]').fill('bru');
    await expect.poll(() => nomesNaLista(page)).toEqual(['Bruno']);
    await expect(contagem).toHaveText('1 de 5 alunos');
    await page.locator('[data-flt="alu"]').fill('');
    await painel.getByRole('button', { name: 'Limpar' }).click();
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana', 'Bruno', 'Carla', 'Davi', 'Elisa']);
    await expect(botao).toHaveText('Todos os cursos');
    await expect(contagem).toHaveText('5 alunos');
    await caixa('ZZ9').check();
    await expect.poll(() => nomesNaLista(page)).toEqual(['Carla']);
    await page.keyboard.press('Escape');
    await expect(painel).toBeHidden();
    await expect(botao).toBeFocused();
    await expect(botao).toHaveText('Curso: ZZ9');
    await page.locator('[data-flt="alu"]').fill('ana');
    await nenhumNaLista(page, 'alu');
    await expect(contagem).toHaveText('0 de 5 alunos');
    await page.locator('#limpar-filtros-alu').click();
    await expect(page.locator('[data-flt="alu"]')).toHaveValue('');
    await expect(botao).toHaveText('Todos os cursos');
    await expect(painel.locator('input[data-filtro]:checked')).toHaveCount(0);
    await expect(linhasDosAlunos(page)).toHaveCount(5);
    await expect(contagem).toHaveText('5 alunos');
  });

  // As marcas duram aos redesenhos (outra data, + Novo aluno); o aluno com o curso mudado no detalhe continua à vista, até os
  // filtros mudarem. As opções acompanham os programas e os cursos dos alunos
  test('o filtro dos cursos dura aos redesenhos e acompanha os programas e o curso de cada aluno', async ({ page }) => {
    const estado = { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { nm: 'Ana', curso: 'PP' }), aluno(1001, {}, { nm: 'Bruno' }), aluno(1002, {}, { nm: 'Carla', curso: 'ZZ9' })] }), nid: 1003 };
    await abrirComCursos(page, { estado });
    await irPara(page, 'alu');
    const botao = page.locator('#flt-alu-cur'), painel = page.locator('#flt-alu-cur-painel'), contagem = page.locator('#alu-contagem');
    await filtrarCursos(page, 'alu', ['PP']);
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana']);
    await diaSeguinte(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana']);
    await expect(botao).toHaveText('Curso: PP');
    await expect(contagem).toHaveText('1 de 3 alunos');
    await page.locator('[data-act="adds"]').click();
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana', 'Novo aluno']);
    await expect(contagem).toHaveText('2 de 4 alunos');
    // O curso mudado no detalhe: a Ana passa para o INVA e continua à vista; a linha diz o curso novo
    await abrirAluno(page, 1000);
    await campoDoAberto(page, 'curso').selectOption('INVA');
    await expect(page.locator('#audit-log-list')).toContainText('Curso de Ana: INVA');
    await expect(linhaDoAluno(page, 1000).locator('.lista-l2')).toHaveText('INVA');
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana', 'Novo aluno']);
    await filtrarCursos(page, 'alu', ['PP', 'INVA']);
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana']);
    await expect(botao).toHaveText('Curso: PP ou INVA');

    const rotulos = () => painel.locator('label').allTextContents();
    await irPara(page, 'cur');
    await page.locator('#cur-novo').click();
    await page.locator('#cur-sigla').fill('MLTE');
    await page.locator('#cur-nome').fill('Multimotor');
    await page.locator('#cur-nome').press('Enter');
    await expect(page.locator('#cursos .curso[data-curso="MLTE"]')).toBeVisible();
    await irPara(page, 'alu');
    await botao.click();
    await expect.poll(rotulos).toEqual(['PP · Piloto Privado', 'PC · Piloto Comercial', 'INVA · Instrutor de Voo', 'MLTE · Multimotor', 'ZZ9 (curso desconhecido)', 'Sem curso']);
    await expect(painel.locator('input[data-filtro]:checked')).toHaveCount(2);
    await irPara(page, 'cur');
    await confirmar(page, '#cursos .curso[data-curso="MLTE"] [data-act="curso-encerrar"]');
    await expect(page.locator('#toast-box')).toContainText('MLTE encerrado');
    await irPara(page, 'alu');
    await botao.click();
    await expect.poll(rotulos).toEqual(['PP · Piloto Privado', 'PC · Piloto Comercial', 'INVA · Instrutor de Voo', 'MLTE · Multimotor (encerrado)', 'ZZ9 (curso desconhecido)', 'Sem curso']);
    await expect(botao).toHaveText('Curso: PP ou INVA');

    // O curso desconhecido marcado: o último aluno dele sai dele, e a opção some, com a marca (o filtro fica sem marcas)
    await filtrarCursos(page, 'alu', ['ZZ9'], { fechar: false });
    await expect.poll(() => nomesNaLista(page)).toEqual(['Carla']);
    await abrirAluno(page, 1002);
    await campoDoAberto(page, 'curso').selectOption('PP');
    await expect(painel.locator('input[data-valor="ZZ9"]')).toHaveCount(0);
    await expect(botao).toHaveText('Todos os cursos');
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana', 'Bruno', 'Carla', 'Novo aluno']);
    await expect(contagem).toHaveText('4 alunos');
  });

  test('"Abrir a Demanda", embaixo da barra, leva à Demanda com o foco no título; também para o Gestor', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await irPara(page, 'alu');
    await expect(page.locator('#s-alu .ir-para-demanda')).toHaveText('Os pedidos de cada data ficam na Demanda. Abrir a Demanda');
    const abrirDemanda = page.getByRole('link', { name: 'Abrir a Demanda' });
    await abrirDemanda.click();
    await expect(page.locator('#s-dem')).toBeVisible();
    await expect(page.locator('#s-alu')).toBeHidden();
    await expect(botaoDaAba(page, 'dem')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#s-dem h2')).toBeFocused();
    await page.locator('#role-sel').selectOption('gestor');
    await irPara(page, 'alu');
    await abrirDemanda.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#s-dem')).toBeVisible();
    await expect(page.locator('#s-dem h2')).toBeFocused();
  });

  test('o filtro dos cursos é o mesmo em Alunos e na Demanda: "Abrir a Demanda" mostra os pedidos dos alunos marcados', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { nm: 'Ana', curso: 'PP' }), aluno(1001, {}, { nm: 'Bruno', curso: 'PC' }), aluno(1002, {}, { nm: 'Carla' })] }) });
    const pedidos = () => page.locator('#dem tr[data-k="d"]:visible').evaluateAll(linhas => linhas.map(l => l.dataset.id));
    await irPara(page, 'alu');
    await filtrarCursos(page, 'alu', ['PP']);
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana']);
    await page.getByRole('link', { name: 'Abrir a Demanda' }).click();
    await expect(page.locator('#flt-dem-cur')).toHaveText('Curso: PP');
    await expect.poll(pedidos).toEqual(['1000']);
    await filtrarCursos(page, 'dem', ['PP', 'sem-curso']);
    await expect.poll(pedidos).toEqual(['1000', '1002']);
    await irPara(page, 'alu');
    await expect(page.locator('#flt-alu-cur')).toHaveText('Curso: PP ou sem curso');
    await expect(page.locator('#flt-alu-cur-painel input[data-filtro]:checked')).toHaveCount(2);
    await expect.poll(() => nomesNaLista(page)).toEqual(['Ana', 'Carla']);
    await expect(page.locator('#alu-contagem')).toHaveText('2 de 3 alunos');
    await page.locator('[data-flt="alu"]').fill('bruno');
    await page.locator('#limpar-filtros-alu').click();
    await expect(page.locator('#flt-alu-cur')).toHaveText('Todos os cursos');
    await irPara(page, 'dem');
    await expect(page.locator('#flt-dem-cur')).toHaveText('Todos os cursos');
    await expect(page.locator('#flt-dem-cur-painel input[data-filtro]:checked')).toHaveCount(0);
    await expect.poll(pedidos).toEqual(['1000', '1001', '1002']);
  });
});

test.describe('Confirmação', () => {
  test('um padrão só: "Excluir aluno…" armado fica vermelho e diz o que confirma; sem o segundo clique, volta ao que era', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    await page.clock.install({ time: AGORA });
    const total = await linhasDosAlunos(page).count();
    const excluir = page.locator('#det-alu-excluir');
    const nome = await excluir.getAttribute('aria-label');
    expect(nome).toMatch(/^Excluir /);
    await excluir.click();
    await expect(excluir).toHaveText('Confirmar exclusão');
    await expect(excluir).toHaveClass(/\barm\b/);
    await expect(excluir).toHaveAccessibleName(`Confirmar exclusão: ${nome}`);
    await page.clock.runFor(3500);
    await expect(excluir).toHaveText('Excluir aluno…');
    await expect(excluir).not.toHaveClass(/\barm\b/);
    await expect(excluir).toHaveAccessibleName(nome);
    await expect(linhasDosAlunos(page)).toHaveCount(total);
  });

  // O rodapé armado fica como está enquanto o aluno é renomeado (o segundo clique não se perde); desarmado, ele é refeito
  // com o nome novo
  test('o aluno renomeado com "Excluir aluno…" armado: depois que ele desarma, o nome lido é o novo', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    await page.clock.install({ time: AGORA });
    const excluir = page.locator('#det-alu-excluir');
    await excluir.click();
    await campoDoAberto(page, 'nm').fill('Maria Nova');
    await campoDoAberto(page, 'nm').press('Tab');
    await expect(excluir).toHaveText('Confirmar exclusão');
    await page.clock.runFor(3500);
    await page.clock.runFor(700);
    await expect(page.locator('#det-alu-excluir')).toHaveText('Excluir aluno…');
    await expect(page.locator('#det-alu-excluir')).toHaveAccessibleName('Excluir Maria Nova');
  });
});

// No celular: a lista, depois o detalhe; o filtro dos cursos cabe
test.describe('Celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('o filtro dos cursos cabe no celular (390 e 320 px), em Alunos e na Demanda: o painel empurra a lista, com alvos de 44 px', async ({ page }) => {
    await abrirComExemplo(page);
    for (const largura of [390, 320]) {
      await page.setViewportSize({ width: largura, height: 800 });
      for (const [aba, abaixoDele] of [['alu', '#alu'], ['dem', '#s-dem .tw']]) {
        await irPara(page, aba);
        await filtrarCursos(page, aba, ['PP', 'sem-curso'], { fechar: false });
        const [botao, painel, abaixo] = await Promise.all([`#flt-${aba}-cur`, `#flt-${aba}-cur-painel`, abaixoDele].map(seletor => page.locator(seletor).boundingBox()));
        expect(botao.x + botao.width, `${largura} ${aba}: o botão na tela`).toBeLessThanOrEqual(largura);
        expect(painel.x, `${largura} ${aba}: o painel na tela`).toBeGreaterThanOrEqual(0);
        expect(painel.x + painel.width, `${largura} ${aba}: o painel na tela`).toBeLessThanOrEqual(largura);
        expect(abaixo.y, `${largura} ${aba}: a lista embaixo do painel`).toBeGreaterThanOrEqual(painel.y + painel.height);
        expect(await larguraDaPagina(page), `${largura} ${aba}: a página não rola para o lado`).toBeLessThanOrEqual(largura);
        expect(await alvosPequenos(page), `${largura} ${aba}: alvos de 44 px`).toEqual([]);
        await filtrarCursos(page, aba, []);
      }
    }
  });

  // No celular (390 e 320 px): a lista, e o aluno aberto no lugar dela; o detalhe com cada rótulo em cima do valor, tudo
  // dentro da tela, sem rolar para o lado, alvos de 44 px; "‹ Alunos" devolve a lista. Quem só consulta lê o texto
  comProgresso('o aluno no celular: a lista, depois o detalhe, com os rótulos em cima dos valores (390 e 320 px)', async ({ page }) => {
    const estado = cenario({
      ins: [instrutor(1, 9, { nm: 'Maria Fernanda dos Santos Oliveira' }), instrutor(2, 1)],
      stu: [aluno(1000, {}, { nm: 'João Pedro de Alcântara Albuquerque', curso: 'PP', voaCom: [1], bl: [2] }), aluno(1001)]
    });
    await page.addInitScript(dados => {
      if (!localStorage.getItem('acpm4_dados_pessoais')) localStorage.setItem('acpm4_dados_pessoais', dados);
    }, JSON.stringify({ 'aluno:1000': { canac: '123456' }, 'instrutor:1': { canac: '654321' } }));
    await abrir(page, { estado });
    for (const largura of [390, 320]) {
      await page.setViewportSize({ width: largura, height: 800 });
      await irPara(page, 'alu');
      await expect(page.locator('#det-alu')).toBeHidden();
      await expect(linhaDoAluno(page, 1000).locator('.lista-l2')).toContainText('CANAC 123456 · PP');
      await abrirAluno(page, 1000);
      await expect(page.locator('#alu')).toBeHidden();
      await expect(page.locator('#det-alu-titulo')).toBeFocused();
      // Cada rótulo em cima do valor (o painel é estreito); nada para fora da tela
      const fora = await page.locator('#det-alu .det').evaluate((det, largura) => [...det.querySelectorAll('button, input, select, .tg, .det-rotulo')]
        .filter(el => el.checkVisibility()).filter(el => { const r = el.getBoundingClientRect(); return r.left < 0 || r.right > largura + 0.5; })
        .map(el => el.id || el.className), largura);
      expect(fora, `${largura}: fora da tela`).toEqual([]);
      await expect(campoDoAberto(page, 'kg')).toBeVisible();
      const embaixo = await page.locator('#det-alu [data-campo="kg"]').evaluate(campo => campo.querySelector('input').getBoundingClientRect().top
        >= campo.querySelector('.det-rotulo').getBoundingClientRect().bottom - 1);
      expect(embaixo, `${largura}: o peso embaixo do rótulo`).toBe(true);
      expect(await larguraDaPagina(page), `${largura}: a página`).toBeLessThanOrEqual(largura);
      expect(await alvosPequenos(page), `${largura}: alvos`).toEqual([]);
      await page.locator('#det-alu-voltar').click();
      await expect(page.locator('#alu')).toBeVisible();
      await expect(linhaDoAluno(page, 1000).locator('.lista-botao')).toBeFocused();
    }
    // Quem só consulta: o texto, as etiquetas sem ✕, sem "Excluir aluno…"
    await page.setViewportSize({ width: 390, height: 800 });
    await page.locator('#role-sel').selectOption('gestor');
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    await expect(page.locator('#det-alu [data-campo="voaCom"] .tg')).toHaveText('Maria Fernanda dos Santos Oliveira');
    await expect(page.locator('#det-alu [data-campo="bl"] .tg')).toHaveText('Instrutor 02');
    await expect(page.locator('#det-alu input, #det-alu select')).toHaveCount(0);
    await expect(page.locator('#det-alu-excluir')).toHaveCount(0);
    expect(await larguraDaPagina(page)).toBeLessThanOrEqual(390);
  });
});
