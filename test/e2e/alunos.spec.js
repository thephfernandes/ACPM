// Alunos: o cadastro, a busca, o filtro dos cursos e o botão armado de excluir.
import { test, comProgresso, expect, abrir, abrirSintetico, abrirComExemplo, irPara, irParaVista, filtrarCursos, confirmar, AGORA, AMANHA, alvosPequenos, appPronto, botaoDaAba, dataAberta, diaSeguinte, larguraDaPagina } from './fixtures.js';
import { documentosAtuais } from './supabase-falso.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';
import { cursosIniciais } from '../../js/programa.js';
import { GLOSSARIO } from '../../js/glossario.js';

test.describe('Alunos', () => {
  test('cadastra, bloqueia instrutor e exclui aluno com confirmação', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'alu');
    await expect(page.locator('#s-alu thead th')).toHaveText(['Nome', 'CANAC', 'Peso (kg)', 'Curso', 'Priorizar com', 'Não escalar com', '']);
    await page.locator('[data-act="adds"]').click();
    const linha = page.locator('#alu .cd');
    await expect(linha).toHaveCount(1);
    await expect(linha.locator('.nm')).toHaveValue('Novo aluno');
    await expect(linha.locator('[data-f="kg"]')).toHaveClass(/\bfalta\b/);

    const naoEscalar = linha.locator('[data-f="bl"]');
    await expect(naoEscalar.locator('option').first()).toHaveText('Não escalar com…');
    await naoEscalar.selectOption({ label: 'Instrutor 03' });
    await expect(page.locator('#alu .cd .tg')).toHaveText(/Instrutor 03/);
    // O foco continua no campo, para bloquear outro em seguida
    await expect(page.locator('#alu .cd [data-f="bl"]')).toBeFocused();
    await page.locator('#alu .cd [data-act="unbl"]').click();
    await expect(page.locator('#alu .cd .tg')).toHaveCount(0);

    await irPara(page, 'dem');
    await expect(page.locator('#dem tr[data-k="d"]')).toHaveCount(1);

    await irPara(page, 'alu');
    const excluir = page.locator('#alu .cd [data-act="dels"]');
    await excluir.click();
    await expect(excluir).toHaveText('Confirmar');
    await excluir.click();
    await expect(page.locator('#alu')).toContainText('Nenhum aluno cadastrado');
  });

  test('o nome tem até 80 caracteres, nos alunos e nos instrutores', async ({ page }) => {
    await abrirSintetico(page);
    const longo = 'Maria '.repeat(20);
    for (const [aba, botao, lista] of [['alu', 'adds', '#alu'], ['ins', 'addi', '#inst']]) {
      await irPara(page, aba);
      await page.locator(`[data-act="${botao}"]`).click();
      const nome = page.locator(`${lista} .cd`).last().locator('.nm');
      await expect(nome).toHaveAttribute('maxlength', '80');
      await nome.fill(longo);
      await nome.blur();
      await expect(page.locator(`${lista} .cd`).last().locator('.nm')).toHaveValue(longo.slice(0, 80).trim());
    }
  });

  test('o peso vai até 300 kg, nos alunos e nos instrutores: acima disso, não vale', async ({ page }) => {
    await abrirSintetico(page);
    const historico = page.locator('#audit-log-list');
    const aviso = page.locator('.toast');
    for (const [aba, botao, lista, nome] of [['alu', 'adds', '#alu', 'Novo aluno'], ['ins', 'addi', '#inst', 'Novo instrutor']]) {
      await irPara(page, aba);
      await page.locator(`[data-act="${botao}"]`).click();
      const peso = page.locator(`${lista} .cd`).last().locator('[data-f="kg"]');
      // O campo vai de 1 a 300 kg, como o aviso: as setas não chegam a 0, que não vale
      await expect(peso).toHaveAttribute('min', '1');
      await expect(peso).toHaveAttribute('max', '300');
      // Acima do limite de antes (200 kg), vale
      await peso.fill('250');
      await peso.blur();
      await expect(historico).toContainText(`Peso ${nome}: 250 kg`);
      await expect(peso).not.toHaveClass(/\bfalta\b/);
      // Acima de 300 kg, não: o aviso aparece e o campo volta ao peso de antes. Cada recusa espera o aviso da anterior
      // sair, para conferir o dela
      await expect(aviso).toHaveCount(0);
      await peso.fill('350');
      await peso.blur();
      await expect(aviso).toHaveText('O peso vai de 1 a 300 kg.');
      await expect(peso).toHaveValue('250');
      // Um texto que não é número também não vale: o campo (type=number) chega vazio, mas o peso não some
      await expect(aviso).toHaveCount(0);
      await peso.fill('');
      await peso.pressSequentially('1-2');
      await peso.blur();
      await expect(aviso).toHaveText('O peso vai de 1 a 300 kg.');
      await expect(peso).toHaveValue('250');
      await expect(peso).not.toHaveClass(/\bfalta\b/);
      // Em décimos: o histórico mostra a vírgula. As recusas não entraram nele
      await peso.fill('72.5');
      await peso.blur();
      await expect(historico).toContainText(`Peso ${nome}: 72,5 kg`);
      await expect(historico).not.toContainText(`Peso ${nome}: 350`);
      await expect(historico).not.toContainText(`Peso ${nome}: 0 kg`);
    }
    // O peso digitado fica gravado; vazio, a pessoa fica sem peso
    await page.reload();
    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await expect(page.locator('#inst .cd').last().locator('[data-f="kg"]')).toHaveValue('72.5');
    await irPara(page, 'alu');
    const peso = page.locator('#alu .cd').last().locator('[data-f="kg"]');
    await expect(peso).toHaveValue('72.5');
    await peso.fill('');
    await peso.blur();
    await expect(peso).toHaveClass(/\bfalta\b/);
    await expect(peso).toHaveValue('');
  });

  // A busca acha o nome sem os acentos e continua depois de cada redesenho da tabela (que antes trazia todos de volta, com
  // a busca ainda no campo): outra data, um instrutor renomeado (a tabela mostra os nomes deles), o aluno renomeado e o
  // aluno novo, que ficam à vista mesmo fora da busca, até ela mudar. O número ao lado diz quantos aparecem; sem nenhum,
  // "Limpar filtros"
  test('a busca acha o nome sem acentos e continua depois de cada redesenho: outra data, um instrutor renomeado, o aluno renomeado, + Novo aluno', async ({ page }) => {
    // O aluno novo recebe o id seguinte ao dos que já existem (nid)
    const estado = { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { nm: 'João Silva' }), aluno(1001, {}, { nm: 'Maria da Conceição' }), aluno(1002)] }), nid: 1003 };
    await abrir(page, { estado });
    await irPara(page, 'alu');
    const busca = page.locator('[data-flt="alu"]');
    const contagem = page.locator('#alu-contagem');
    const nomesAVista = () => page.locator('#alu tr.cd:visible .nm').evaluateAll(campos => campos.map(c => c.value));
    // As linhas de antes ficam marcadas: redesenhada a tabela, nenhuma linha tem a marca
    const marcarAsLinhas = () => page.locator('#alu tr').evaluateAll(linhas => linhas.forEach(l => { l.dataset.antes = ''; }));
    const redesenhada = () => expect(page.locator('#alu tr[data-antes]')).toHaveCount(0);
    await expect(contagem).toHaveAttribute('role', 'status');
    await expect(contagem).toHaveText('3 alunos');
    await busca.fill('joao');
    await expect.poll(nomesAVista).toEqual(['João Silva']);
    await expect(contagem).toHaveText('1 de 3 alunos');
    await busca.fill('CONCEICAO');
    await expect.poll(nomesAVista).toEqual(['Maria da Conceição']);
    await busca.fill('  maria   da ');
    await expect.poll(nomesAVista).toEqual(['Maria da Conceição']);
    await busca.fill('joão');
    await expect.poll(nomesAVista).toEqual(['João Silva']);

    // Outra data
    await marcarAsLinhas();
    await diaSeguinte(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await redesenhada();
    await expect.poll(nomesAVista).toEqual(['João Silva']);
    await expect(busca).toHaveValue('joão');
    await expect(contagem).toHaveText('1 de 3 alunos');

    // Um instrutor renomeado
    await marcarAsLinhas();
    await irParaVista(page, 'ins', 'cadastro');
    await page.locator('#inst .cd[data-id="1"] .nm').fill('Instrutor Um');
    await page.locator('#inst .cd[data-id="1"] .nm').blur();
    await expect(page.locator('#audit-log-list')).toContainText('Instrutor: Instrutor 01 → Instrutor Um');
    await irPara(page, 'alu');
    await redesenhada();
    await expect.poll(nomesAVista).toEqual(['João Silva']);

    // O aluno renomeado na tabela, pelo teclado: a linha continua à vista, mesmo fora da busca, e o Tab leva ao campo
    // seguinte dela, o peso (o foco não some com a linha). Mudada a busca, ela vale para o nome novo (fora dela, a linha
    // sai, e a tabela diz por quê)
    const joao = page.locator('#alu tr.cd[data-id="1000"] .nm');
    await joao.fill('Joaquim Silva');
    await page.keyboard.press('Tab');
    await expect(page.locator('#audit-log-list')).toContainText('Aluno: João Silva → Joaquim Silva');
    await expect(page.locator('#alu tr.cd[data-id="1000"] [data-f="kg"]')).toBeFocused();
    await expect.poll(nomesAVista).toEqual(['Joaquim Silva']);
    await expect(contagem).toHaveText('1 de 3 alunos');
    await busca.fill('joao');
    await expect(page.locator('#alu tr.sem-resultado')).toBeVisible();
    await expect.poll(nomesAVista).toEqual([]);
    await expect(contagem).toHaveText('0 de 3 alunos');
    await busca.fill('joaquim');
    await expect.poll(nomesAVista).toEqual(['Joaquim Silva']);

    // O aluno novo aparece, com o nome em foco; os outros continuam filtrados. Renomeado, ele continua à vista
    await page.locator('[data-act="adds"]').click();
    await expect.poll(nomesAVista).toEqual(['Joaquim Silva', 'Novo aluno']);
    const novo = page.locator('#alu tr.cd').last().locator('.nm');
    await expect(novo).toBeFocused();
    await expect(busca).toHaveValue('joaquim');
    await expect(contagem).toHaveText('2 de 4 alunos');
    await novo.fill('Pedro Álvares');
    await novo.blur();
    await expect(page.locator('#audit-log-list')).toContainText('Aluno: Novo aluno → Pedro Álvares');
    await expect.poll(nomesAVista).toEqual(['Joaquim Silva', 'Pedro Álvares']);
    // A busca mudou: vale para todos, também para o novo, pelo nome que ele tem agora
    await busca.fill('alvares');
    await expect.poll(nomesAVista).toEqual(['Pedro Álvares']);

    // Nenhum com esses filtros: a tabela diz por quê; "Limpar filtros" mostra todos de novo, com o foco na busca
    await busca.fill('xyz');
    await expect(page.locator('#alu tr.sem-resultado')).toHaveText('Nenhum aluno com esses filtros. Limpar filtros');
    await expect(contagem).toHaveText('0 de 4 alunos');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(busca).toHaveValue('');
    await expect(busca).toBeFocused();
    await expect(page.locator('#alu tr.cd:visible')).toHaveCount(4);
    await expect(page.locator('#alu tr.sem-resultado')).toHaveCount(0);
    await expect(contagem).toHaveText('4 alunos');
  });
});

// O filtro dos cursos de Alunos (o filtro de vários valores, como o das habilitações em Instrutores, com a regra "alguma":
// um curso só por aluno), a barra no lugar da de Instrutores e o link para a Demanda
test.describe('Alunos: o filtro dos cursos e a barra dos Instrutores', () => {
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
  const nomesAVista = page => page.locator('#alu tr.cd:visible .nm').evaluateAll(campos => campos.map(c => c.value));

  // Na mesma ordem e no mesmo lugar: a busca, o filtro, quantos aparecem e "+ Novo", juntos e alinhados à direita como em
  // Instrutores (lá, as vistas ficam à esquerda), numa linha só; a busca da mesma largura
  test('a barra de Alunos é a de Instrutores: a busca, o filtro, quantos aparecem e "+ Novo", no mesmo lugar', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    const barra = (aba, novo) => page.locator(`#s-${aba} .bar`).evaluate((bar, novo) => {
      const caixas = [':scope > input[type="search"]', ':scope > .filtro-botao', ':scope > .contagem', `:scope > [data-act="${novo}"]`]
        .map(seletor => bar.querySelector(seletor).getBoundingClientRect());
      return {
        // O espaço entre cada um e o seguinte, e o meio de cada um na altura
        espacos: caixas.slice(1).map((c, i) => Math.round(c.left - caixas[i].right)),
        numaLinha: caixas.every(c => Math.abs((c.top + c.bottom) / 2 - (caixas[0].top + caixas[0].bottom) / 2) <= 2),
        direita: Math.round(caixas[3].right), busca: Math.round(caixas[0].width)
      };
    }, novo);
    await irPara(page, 'ins');
    const ins = await barra('ins', 'addi');
    await irPara(page, 'alu');
    const alu = await barra('alu', 'adds');
    expect(alu.espacos).toEqual([8, 8, 8]);
    expect(alu.numaLinha).toBe(true);
    expect(alu).toEqual(ins);
  });

  test('o filtro dos cursos: os ativos, o encerrado e o desconhecido marcados e "Sem curso"; aparece quem está em algum dos marcados', async ({ page }) => {
    const estado = cenario({
      ins: [instrutor(1, 9)],
      stu: [aluno(1000, {}, { nm: 'Ana', curso: 'PP' }), aluno(1001, {}, { nm: 'Bruno', curso: 'PC' }), aluno(1002, {}, { nm: 'Carla', curso: 'ZZ9' }),
        aluno(1003, {}, { nm: 'Davi' }), aluno(1004, {}, { nm: 'Elisa', curso: 'INVA' })]
    });
    // O PC encerrado na aba Cursos
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
    // A regra dita no painel, com o "?" do glossário
    await expect(painel.locator('.filtro-regra')).toHaveText('Mostra os alunos de algum dos cursos marcados.');
    await expect(painel.locator('.filtro-regra [data-dica="filtro-dos-cursos"]')).toHaveAccessibleName('O que é Filtro dos cursos?');
    await expect(painel.locator('.filtro-regra [data-dica="filtro-dos-cursos"]')).toHaveAccessibleDescription(GLOSSARIO['filtro-dos-cursos'].texto);
    // Os ativos na ordem da aba Cursos, o encerrado e o desconhecido marcados, e "Sem curso"
    await expect(painel.locator('legend')).toHaveText(['Cursos']);
    await expect(painel.locator('label')).toHaveText(['PP · Piloto Privado', 'INVA · Instrutor de Voo', 'PC · Piloto Comercial (encerrado)', 'ZZ9 (curso desconhecido)', 'Sem curso']);
    // Cada linha diz o curso do aluno
    await expect(page.locator('#alu tr.cd[data-id="1000"]')).toHaveAttribute('data-curso', 'PP');
    await expect(page.locator('#alu tr.cd[data-id="1003"]')).toHaveAttribute('data-curso', '');

    // Um curso: os alunos dele
    await caixa('PP').check();
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana']);
    await expect(botao).toHaveText('Curso: PP');
    await expect(botao).toHaveClass(/\bcom-marcas\b/);
    await expect(contagem).toHaveText('1 de 5 alunos');
    // Mais um, o encerrado: os de um ou do outro
    await caixa('PC').check();
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana', 'Bruno']);
    await expect(botao).toHaveText('Curso: PP ou PC');
    await expect(contagem).toHaveText('2 de 5 alunos');
    // "Sem curso": quem não tem
    await caixa('sem-curso').check();
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana', 'Bruno', 'Davi']);
    await expect(botao).toHaveText('Curso: PP ou PC ou sem curso');
    // Com a busca, os dois valem juntos
    await page.locator('[data-flt="alu"]').fill('bru');
    await expect.poll(() => nomesAVista(page)).toEqual(['Bruno']);
    await expect(contagem).toHaveText('1 de 5 alunos');
    await page.locator('[data-flt="alu"]').fill('');
    // "Limpar" desmarca todos
    await painel.getByRole('button', { name: 'Limpar' }).click();
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana', 'Bruno', 'Carla', 'Davi', 'Elisa']);
    await expect(botao).toHaveText('Todos os cursos');
    await expect(contagem).toHaveText('5 alunos');
    // O curso desconhecido também filtra. O Esc fecha o painel (o foco volta ao botão), e o filtro continua
    await caixa('ZZ9').check();
    await expect.poll(() => nomesAVista(page)).toEqual(['Carla']);
    await page.keyboard.press('Escape');
    await expect(painel).toBeHidden();
    await expect(botao).toBeFocused();
    await expect(botao).toHaveText('Curso: ZZ9');
    // Nenhum com a busca e o curso: "Limpar filtros" limpa também as marcas
    await page.locator('[data-flt="alu"]').fill('ana');
    await expect(page.locator('#alu tr.sem-resultado')).toBeVisible();
    await expect(contagem).toHaveText('0 de 5 alunos');
    await page.locator('#limpar-filtros-alu').click();
    await expect(page.locator('[data-flt="alu"]')).toHaveValue('');
    await expect(botao).toHaveText('Todos os cursos');
    await expect(painel.locator('input[data-filtro]:checked')).toHaveCount(0);
    await expect(page.locator('#alu tr.cd:visible')).toHaveCount(5);
    await expect(contagem).toHaveText('5 alunos');
  });

  // As marcas duram aos redesenhos (outra data, + Novo aluno); o aluno com o curso mudado na linha continua à vista (é a
  // linha alterada agora), até os filtros mudarem. As opções acompanham os programas (o curso criado e o encerrado na aba
  // Cursos) e os cursos dos alunos: o desconhecido de que o último aluno saiu some, e a marca dele sai do filtro
  test('o filtro dos cursos dura aos redesenhos e acompanha os programas e o curso de cada aluno', async ({ page }) => {
    const estado = { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { nm: 'Ana', curso: 'PP' }), aluno(1001, {}, { nm: 'Bruno' }), aluno(1002, {}, { nm: 'Carla', curso: 'ZZ9' })] }), nid: 1003 };
    await abrirComCursos(page, { estado });
    await irPara(page, 'alu');
    const botao = page.locator('#flt-alu-cur'), painel = page.locator('#flt-alu-cur-painel'), contagem = page.locator('#alu-contagem');
    await filtrarCursos(page, 'alu', ['PP']);
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana']);
    // Outra data: as linhas são refeitas (as de antes ficam marcadas), e o filtro continua
    await page.locator('#alu tr').evaluateAll(linhas => linhas.forEach(l => { l.dataset.antes = ''; }));
    await diaSeguinte(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect(page.locator('#alu tr[data-antes]')).toHaveCount(0);
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana']);
    await expect(botao).toHaveText('Curso: PP');
    await expect(contagem).toHaveText('1 de 3 alunos');
    // O aluno novo aparece (é na linha dele que se digita o nome); os outros continuam filtrados
    await page.locator('[data-act="adds"]').click();
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana', 'Novo aluno']);
    await expect(contagem).toHaveText('2 de 4 alunos');
    // O curso mudado na linha: a Ana passa para o INVA e continua à vista; a linha diz o curso novo
    await page.locator('#alu tr.cd[data-id="1000"] [data-f="curso"]').selectOption('INVA');
    await expect(page.locator('#audit-log-list')).toContainText('Curso de Ana: INVA');
    await expect(page.locator('#alu tr.cd[data-id="1000"]')).toHaveAttribute('data-curso', 'INVA');
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana', 'Novo aluno']);
    // Mudados os filtros, eles valem para todos: o curso novo da Ana, e o aluno novo, sem curso, sai
    await filtrarCursos(page, 'alu', ['PP', 'INVA']);
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana']);
    await expect(botao).toHaveText('Curso: PP ou INVA');

    // O curso criado na aba Cursos aparece no filtro, e as marcas continuam; encerrado, ele fica, marcado
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
    await expect.poll(() => nomesAVista(page)).toEqual(['Carla']);
    await page.locator('#alu tr.cd[data-id="1002"] [data-f="curso"]').selectOption('PP');
    await expect(painel.locator('input[data-valor="ZZ9"]')).toHaveCount(0);
    await expect(botao).toHaveText('Todos os cursos');
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana', 'Bruno', 'Carla', 'Novo aluno']);
    await expect(contagem).toHaveText('4 alunos');
  });

  // Os pedidos de cada data ficam na Demanda: o link embaixo da barra leva a ela, com o foco no título (o botão some com a
  // aba de Alunos). Sem data-act, ele vale também para quem só consulta (o Gestor), pelo mouse e pelo teclado
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

  // O filtro dos cursos é um só, em Alunos e na Demanda (o plano: Alunos leva à Demanda e divide com ela o filtro dos
  // cursos): os alunos marcados em Alunos são os da Demanda aberta pelo link, as marcas feitas na Demanda valem em Alunos,
  // e "Limpar filtros" de Alunos as tira nas duas abas
  test('o filtro dos cursos é o mesmo em Alunos e na Demanda: "Abrir a Demanda" mostra os pedidos dos alunos marcados', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { nm: 'Ana', curso: 'PP' }), aluno(1001, {}, { nm: 'Bruno', curso: 'PC' }), aluno(1002, {}, { nm: 'Carla' })] }) });
    const pedidos = () => page.locator('#dem tr[data-k="d"]:visible').evaluateAll(linhas => linhas.map(l => l.dataset.id));
    await irPara(page, 'alu');
    await filtrarCursos(page, 'alu', ['PP']);
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana']);
    await page.getByRole('link', { name: 'Abrir a Demanda' }).click();
    await expect(page.locator('#flt-dem-cur')).toHaveText('Curso: PP');
    await expect.poll(pedidos).toEqual(['1000']);
    // Marcado na Demanda, vale em Alunos (as caixas e o botão de lá também)
    await filtrarCursos(page, 'dem', ['PP', 'sem-curso']);
    await expect.poll(pedidos).toEqual(['1000', '1002']);
    await irPara(page, 'alu');
    await expect(page.locator('#flt-alu-cur')).toHaveText('Curso: PP ou sem curso');
    await expect(page.locator('#flt-alu-cur-painel input[data-filtro]:checked')).toHaveCount(2);
    await expect.poll(() => nomesAVista(page)).toEqual(['Ana', 'Carla']);
    await expect(page.locator('#alu-contagem')).toHaveText('2 de 3 alunos');
    // "Limpar filtros" de Alunos tira as marcas nas duas abas
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
  test('um padrão só: o ✕ armado fica vermelho e diz o que confirma; sem o segundo clique, volta ao que era', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'alu');
    await page.clock.install({ time: AGORA });
    const alunos = page.locator('#alu .cd');
    const total = await alunos.count();
    const excluir = page.locator('#alu .cd [data-act="dels"]').first();
    const nome = await excluir.getAttribute('aria-label');
    expect(nome).toMatch(/^Excluir /);
    await excluir.click();
    await expect(excluir).toHaveText('Confirmar');
    await expect(excluir).toHaveClass(/\barm\b/);
    await expect(excluir).toHaveAccessibleName(`Confirmar: ${nome}`);
    await page.clock.runFor(3500);
    await expect(excluir).toHaveText('✕');
    await expect(excluir).not.toHaveClass(/\barm\b/);
    await expect(excluir).toHaveAccessibleName(nome);
    await expect(alunos).toHaveCount(total);
  });

  test('o aluno renomeado com o ✕ armado: depois que ele desarma, o nome lido é o novo', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'alu');
    await page.clock.install({ time: AGORA });
    const linha = page.locator('#alu .cd').first();
    const excluir = linha.locator('[data-act="dels"]');
    await excluir.click();
    await linha.locator('.nm').fill('Maria Nova');
    await linha.locator('.nm').press('Tab');
    await expect(excluir).toHaveAccessibleName('Excluir Maria Nova');
    await page.clock.runFor(3500);
    await expect(excluir).toHaveText('✕');
    await expect(excluir).toHaveAccessibleName('Excluir Maria Nova');
  });
});

// No celular (vieram de celular.spec.js)
test.describe('Celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // O filtro dos cursos no celular (390 e 320 px), em Alunos e na Demanda: o botão fica na linha da busca (em Alunos, como
  // o das habilitações em Instrutores); o painel abre inteiro na tela, com a tabela embaixo dele, e alvos de 44 px
  test('o filtro dos cursos cabe no celular (390 e 320 px), em Alunos e na Demanda: o painel empurra a tabela, com alvos de 44 px', async ({ page }) => {
    await abrirComExemplo(page);
    for (const largura of [390, 320]) {
      await page.setViewportSize({ width: largura, height: 800 });
      for (const [aba, busca, tabela] of [['alu', '[data-flt="alu"]', '#s-alu .tw'], ['dem', '#flt-dem', '#s-dem .tw']]) {
        await irPara(page, aba);
        await filtrarCursos(page, aba, ['PP', 'sem-curso'], { fechar: false });
        const [campo, botao, painel, abaixo] = await Promise.all([busca, `#flt-${aba}-cur`, `#flt-${aba}-cur-painel`, tabela].map(seletor => page.locator(seletor).boundingBox()));
        if (aba === 'alu') expect(Math.abs(botao.y + botao.height / 2 - (campo.y + campo.height / 2)), `${largura}: o botão na linha da busca`).toBeLessThan(4);
        expect(botao.x + botao.width, `${largura} ${aba}: o botão na tela`).toBeLessThanOrEqual(largura);
        expect(painel.x, `${largura} ${aba}: o painel na tela`).toBeGreaterThanOrEqual(0);
        expect(painel.x + painel.width, `${largura} ${aba}: o painel na tela`).toBeLessThanOrEqual(largura);
        expect(abaixo.y, `${largura} ${aba}: a tabela embaixo do painel`).toBeGreaterThanOrEqual(painel.y + painel.height);
        expect(await larguraDaPagina(page), `${largura} ${aba}: a página não rola para o lado`).toBeLessThanOrEqual(largura);
        expect(await alvosPequenos(page), `${largura} ${aba}: alvos de 44 px`).toEqual([]);
        await filtrarCursos(page, aba, []);
      }
    }
  });

  // O cadastro no celular (390 e 320 px), em Instrutores e em Alunos: um cartão por pessoa, o mesmo nas duas abas. Cada
  // parte vai para o lugar dela pela classe da célula, e não pela posição (desde a coluna do CANAC, o peso ficava no lugar
  // das habilitações em Instrutores), com o nome da coluna em cima, o mesmo do título dela na tela grande; nada sai do
  // cartão (o "Dados pessoais" e o ✕ saíam dele, em Alunos e, nos 320 px, em Instrutores), e a tabela não rola para o
  // lado. Na tela grande, os nomes não aparecem (a linha dos títulos está lá). Para quem só consulta, "Priorizar com" e
  // "Não escalar com" sem ninguém não aparecem (o nome sozinho, sem nada embaixo)
  comProgresso('o cadastro no celular: um cartão por pessoa, as partes no lugar pela classe, com o nome em cima e tudo dentro dele (390 e 320 px)', async ({ page }) => {
    const estado = cenario({
      ins: [instrutor(1, 9, { nm: 'Maria Fernanda dos Santos Oliveira' }), instrutor(2, 1)],
      stu: [aluno(1000, {}, { nm: 'João Pedro de Alcântara Albuquerque', curso: 'PP', voaCom: [1], bl: [2] }), aluno(1001)]
    });
    await page.addInitScript(dados => {
      if (!localStorage.getItem('acpm4_dados_pessoais')) localStorage.setItem('acpm4_dados_pessoais', dados);
    }, JSON.stringify({ 'aluno:1000': { canac: '123456' }, 'instrutor:1': { canac: '654321' } }));
    await abrir(page, { estado });
    // Cada cartão: a área de cada célula à vista (pela classe), o nome em cima dela (::before) e o título da coluna, e
    // o que sai do cartão
    const cartoes = corpo => page.locator(`${corpo} tr.cd`).evaluateAll(linhas => linhas.map(linha => {
      const titulos = [...linha.closest('table').tHead.rows[0].cells].map(th => th.textContent.trim());
      const caixa = linha.getBoundingClientRect();
      const celulas = [...linha.cells].filter(td => td.checkVisibility()).map(td => {
        const r = td.getBoundingClientRect();
        return {
          classe: td.classList[0], area: getComputedStyle(td).gridRowStart, base: Math.round(r.bottom), caixa: [r.left, r.top, r.right, r.bottom],
          nome: getComputedStyle(td, '::before').content, titulo: td.dataset.rotulo ? titulos[td.cellIndex] : null, rotulo: td.dataset.rotulo || null
        };
      });
      const fora = [...linha.querySelectorAll('button, input, select, .tg, .habs-resumo, .progresso')].filter(el => el.checkVisibility())
        .filter(el => { const r = el.getBoundingClientRect(); return r.left < caixa.left - 0.5 || r.right > caixa.right + 0.5; })
        .map(el => el.dataset.f || el.dataset.act || el.dataset.dados || el.className);
      // Os controles na ordem do Tab (a do HTML), com o lugar de cada um na tela
      const controles = [...linha.querySelectorAll('button, input, select')].filter(el => el.checkVisibility()).map(el => {
        const r = el.getBoundingClientRect();
        return { nome: el.dataset.f || el.dataset.act || (el.dataset.dados ? 'dados' : el.className), caixa: [r.left, r.top, r.right, r.bottom] };
      });
      return { id: linha.dataset.id, grade: getComputedStyle(linha).display, celulas, fora, controles };
    }));
    const AREAS = {
      inst: { 'c-nome': 'nome', 'c-canac': 'canac', 'c-peso': 'peso', 'c-habs': 'habs', acoes: 'acoes' },
      alu: { 'c-nome': 'nome', 'c-canac': 'canac', 'c-peso': 'peso', 'c-curso': 'curso', 'c-voa-com': 'voa-com', 'c-nao-escalar': 'nao-escalar', acoes: 'acoes' }
    };
    const ORDEM = { inst: [['c-nome'], ['c-peso', 'c-canac'], ['c-habs'], ['acoes']], alu: [['c-nome'], ['c-peso', 'c-canac'], ['c-curso'], ['c-voa-com'], ['c-nao-escalar'], ['acoes']] };
    const conferir = async (corpo, largura) => {
      const lista = await cartoes(`#${corpo}`);
      expect(lista.length, `${largura}: #${corpo}`).toBe(2);
      for (const { id, grade, celulas, fora, controles } of lista) {
        const onde = `${largura}: #${corpo} ${id}`;
        expect(grade, onde).toBe('grid');
        expect(fora, `${onde}: fora do cartão`).toEqual([]);
        // O Tab segue a ordem da tela: cada controle vem depois do anterior, na mesma linha (à direita dele) ou embaixo
        // (o foco não sobe e desce dentro do cartão)
        const foraDaOrdem = controles.slice(1).flatMap((b, i) => {
          const a = controles[i];
          const mesmaLinha = Math.min(a.caixa[3], b.caixa[3]) - Math.max(a.caixa[1], b.caixa[1]) > 1;
          return (mesmaLinha ? b.caixa[0] < a.caixa[2] - 1 : b.caixa[1] < a.caixa[3] - 1) ? [`${a.nome} → ${b.nome}`] : [];
        });
        expect(foraDaOrdem, `${onde}: a ordem do Tab ${JSON.stringify(controles.map(c => c.nome))}`).toEqual([]);
        for (const c of celulas) {
          expect(c.area, `${onde}: ${c.classe}`).toBe(AREAS[corpo][c.classe]);
          // O nome em cima é o do título da coluna
          if (c.rotulo) expect([c.nome, c.rotulo], `${onde}: ${c.classe}`).toEqual([`"${c.titulo}"`, c.titulo]);
        }
        // As linhas do cartão, de cima para baixo (as partes de uma linha ficam alinhadas embaixo): o nome; o peso e o CANAC
        // lado a lado; …; os botões
        const base = classe => (celulas.find(c => c.classe === classe) || {}).base;
        const linhas = ORDEM[corpo].map(grupo => grupo.map(base).filter(t => t !== undefined)).filter(g => g.length);
        expect(linhas.every(g => g.every(t => Math.abs(t - g[0]) <= 1)), `${onde}: ${JSON.stringify(linhas)}`).toBe(true);
        expect(linhas.slice(1).every((g, i) => g[0] > linhas[i][0]), `${onde}: a ordem das linhas ${JSON.stringify(linhas)}`).toBe(true);
        // Nenhuma parte por cima de outra
        const sobrepostas = celulas.flatMap((a, i) => celulas.slice(i + 1).filter(b => Math.min(a.caixa[2], b.caixa[2]) - Math.max(a.caixa[0], b.caixa[0]) > 1
          && Math.min(a.caixa[3], b.caixa[3]) - Math.max(a.caixa[1], b.caixa[1]) > 1).map(b => `${a.classe}/${b.classe}`));
        expect(sobrepostas, `${onde}: partes sobrepostas`).toEqual([]);
      }
      // Em Instrutores, "Editar habilitações" fica numa linha só dele, embaixo das habilitações, em cima dos outros botões
      if (corpo === 'inst') {
        const [editar, dados] = await Promise.all(['[data-act="editar-habs"]', '[data-dados]'].map(b => page.locator(`#inst tr.cd[data-id="1"] ${b}`).boundingBox()));
        expect(editar.y + editar.height, `${largura}: "Editar habilitações" em cima`).toBeLessThanOrEqual(dados.y);
      }
      expect(await page.locator(`#${corpo}`).evaluate(corpo => corpo.closest('.tw').scrollWidth <= corpo.closest('.tw').clientWidth), `${largura}: #${corpo} sem rolar para o lado`).toBe(true);
      expect(await larguraDaPagina(page), `${largura}: a página`).toBeLessThanOrEqual(largura);
      expect(await alvosPequenos(page), `${largura}: #${corpo}`).toEqual([]);
    };
    for (const largura of [390, 320]) {
      await page.setViewportSize({ width: largura, height: 800 });
      await irParaVista(page, 'ins', 'cadastro');
      await expect(page.locator('#inst tr.cd[data-id="1"] .c-canac')).toHaveText('654321');
      await conferir('inst', largura);
      await irPara(page, 'alu');
      await expect(page.locator('#alu tr.cd[data-id="1000"] .c-canac')).toHaveText('123456');
      await conferir('alu', largura);
      // Sem o CANAC, o peso fica sozinho na linha dele (a célula vazia não aparece)
      await expect(page.locator('#alu tr.cd[data-id="1001"] .c-canac')).toBeHidden();
    }
    // Na tela grande, a tabela, com a linha dos títulos: os nomes em cima das partes não aparecem
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('#s-alu thead')).toBeVisible();
    expect(await page.locator('#alu tr.cd[data-id="1000"] td.c-peso').evaluate(td => getComputedStyle(td, '::before').content)).toBe('none');

    // Quem só consulta: sem a lista para escolher, "Priorizar com" e "Não escalar com" sem ninguém não aparecem; com alguém,
    // aparecem, com o nome em cima
    await page.setViewportSize({ width: 390, height: 800 });
    await page.locator('#role-sel').selectOption('gestor');
    await irPara(page, 'alu');
    const celula = (id, classe) => page.locator(`#alu tr.cd[data-id="${id}"] td.${classe}`);
    await expect(celula(1001, 'c-voa-com')).toBeHidden();
    await expect(celula(1001, 'c-nao-escalar')).toBeHidden();
    await expect(celula(1000, 'c-voa-com')).toBeVisible();
    await expect(celula(1000, 'c-voa-com').locator('.tg')).toHaveText('Maria Fernanda dos Santos Oliveira', { useInnerText: true });
    await expect(celula(1000, 'c-nao-escalar').locator('.tg')).toHaveText('Instrutor 02', { useInnerText: true });
    // O Gestor não tem nenhum botão no cartão: a parte deles não aparece
    await expect(celula(1000, 'acoes')).toBeHidden();
    expect(await larguraDaPagina(page)).toBeLessThanOrEqual(390);
  });
});
