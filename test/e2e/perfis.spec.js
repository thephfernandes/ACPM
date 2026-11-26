import { test, expect, abrir, abrirSintetico, abrirComExemplo, irPara, irParaVista, abrirEscala, filtrarHabilitacoes, filtrarCursos, filtrarCategorias, AMANHA, caixaVem, dataAberta, gradeDoDia, botaoDaData } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

test.describe('Perfis de acesso', () => {
  test('perfil Gestor oculta a edição e o Operador a restaura', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);

    await page.locator('#role-sel').selectOption('gestor');
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    await expect(page.locator('#out [data-act="rm-fly"]').first()).toBeHidden();
    // O Gestor não agenda voos na Escala
    await expect(page.locator('#btn-agendar')).toBeHidden();
    // A data o Gestor também muda: abrir uma data não grava nada
    await expect(botaoDaData(page)).toBeEnabled();
    await expect(page.locator('#out .st-sel').first()).toBeDisabled();
    await irPara(page, 'ins');
    await expect(page.locator('[data-act="addi"]')).toBeHidden();
    // A grade do dia fica travada (os campos desligados) e as habilitações não abrem (o Gestor vê o resumo)
    await expect(gradeDoDia(page).locator('.cel input').first()).toBeDisabled();
    await expect(caixaVem(gradeDoDia(page)).first()).toBeDisabled();
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await expect(page.locator('#inst [data-act="editar-habs"]').first()).toBeHidden();
    await expect(page.locator('#inst .habs-resumo').first()).toBeVisible();

    await page.locator('#role-sel').selectOption('operador');
    await expect(page.locator('[data-act="addi"]')).toBeVisible();
    await irPara(page, 'esc');
    await expect(page.locator('#btn-agendar')).toBeVisible();
    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="dia"]').click();
    await expect(gradeDoDia(page).locator('.cel input').first()).toBeEnabled();
    await expect(botaoDaData(page)).toBeEnabled();
  });

  test('?role=gestor abre no Gestor sem travar o seletor', async ({ page }) => {
    await abrirSintetico(page, { url: './?role=gestor' });
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    await expect(page.locator('#btn-agendar')).toBeHidden();
    await expect(page.locator('#role-sel')).toBeEnabled();
    await expect(page.locator('#role-sel')).toHaveValue('gestor');
  });

  // Quem só consulta usa os filtros como o Operador: a busca e as caixas das habilitações e dos cursos (.flt-ctrl, que
  // js/somente-leitura.js não desliga), as vistas, o botão e o "Limpar" do filtro, o "Limpar filtros" e o "Abrir a Demanda"
  // (sem data-act, que js/eventos/registro.js não deixa passar para ele)
  test('o Gestor busca, filtra pelas habilitações e pelos cursos e troca de vista em Instrutores, Alunos e na Demanda; "Limpar filtros" mostra todos de novo', async ({ page }) => {
    const estado = cenario({
      ins: [instrutor(1, 9, { nm: 'Ângelo Brandão' }), instrutor(2, 9), instrutor(3, 1), instrutor(4, 1, { hab: ['local', 'c172'] })],
      stu: [aluno(1000, {}, { nm: 'João Silva', curso: 'PP' }), aluno(1001)]
    });
    await abrir(page, { estado, url: './?role=gestor' });
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    await irPara(page, 'ins');
    const busca = page.locator('[data-flt="inst"]'), botao = page.locator('#flt-ins-hab'), painel = page.locator('#flt-ins-hab-painel');
    const dia = gradeDoDia(page).locator('tr[data-k="i"]:visible');
    await busca.fill('angelo');
    await expect(dia).toHaveCount(1);
    await expect(page.locator('#ins-contagem')).toHaveText('1 de 4 instrutores');
    await busca.fill('');
    // As habilitações, com duas marcas: quem tem as duas (o Instrutor 04 tem só o C172)
    await botao.click();
    await expect(painel).toBeVisible();
    await expect(painel.locator('input[data-filtro]:disabled')).toHaveCount(0);
    await painel.locator('input[data-valor="noturno"]').check();
    await painel.locator('input[data-valor="c172"]').check();
    await expect(dia).toHaveCount(2);
    await expect(botao).toHaveText('Habilitações: Noturno + C172');
    await expect(page.locator('#ins-contagem')).toHaveText('2 de 4 instrutores');
    // O "Limpar" do filtro, e o Esc fecha o painel (o foco volta ao botão)
    await painel.getByRole('button', { name: 'Limpar' }).click();
    await expect(dia).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(painel).toBeHidden();
    await expect(botao).toBeFocused();
    await filtrarHabilitacoes(page, ['mlte']);
    await expect(dia).toHaveCount(2);
    await irParaVista(page, 'ins', 'cadastro');
    await expect(page.locator('#inst .cd:visible')).toHaveCount(2);
    await busca.fill('nenhum assim');
    await page.locator('#limpar-filtros-inst').click();
    await expect(busca).toBeFocused();
    await expect(botao).toHaveText('Todas as habilitações');
    await expect(painel.locator('input[data-filtro]:checked')).toHaveCount(0);
    await expect(page.locator('#inst .cd:visible')).toHaveCount(4);
    await expect(page.locator('#ins-contagem')).toHaveText('4 instrutores');

    await irPara(page, 'alu');
    const buscaAlu = page.locator('[data-flt="alu"]');
    await buscaAlu.fill('joao');
    await expect(page.locator('#alu tr.cd:visible')).toHaveCount(1);
    await buscaAlu.fill('nenhum assim');
    await page.locator('#limpar-filtros-alu').click();
    await expect(buscaAlu).toHaveValue('');
    await expect(page.locator('#alu tr.cd:visible')).toHaveCount(2);
    await expect(page.locator('#alu-contagem')).toHaveText('2 alunos');
    // O filtro dos cursos, em Alunos e na Demanda (pelo "Abrir a Demanda", com as mesmas marcas)
    await page.locator('#flt-alu-cur').click();
    await expect(page.locator('#flt-alu-cur-painel input[data-filtro]:disabled')).toHaveCount(0);
    await filtrarCursos(page, 'alu', ['PP']);
    await expect(page.locator('#alu tr.cd:visible')).toHaveCount(1);
    await expect(page.locator('#alu-contagem')).toHaveText('1 de 2 alunos');
    await page.getByRole('link', { name: 'Abrir a Demanda' }).click();
    await expect(page.locator('#s-dem')).toBeVisible();
    await expect(page.locator('#flt-dem-cur')).toHaveText('Curso: PP');
    await expect(page.locator('#dem tr[data-k="d"]:visible')).toHaveCount(1);
    await expect(page.locator('#dem tr[data-k="d"]:visible')).toHaveAttribute('data-id', '1000');
    await page.locator('#flt-dem-cur').click();
    await expect(page.locator('#flt-dem-cur-painel input[data-filtro]:disabled')).toHaveCount(0);
    await filtrarCursos(page, 'dem', ['sem-curso']);
    await expect(page.locator('#dem tr[data-k="d"]:visible')).toHaveCount(1);
    await expect(page.locator('#dem tr[data-k="d"]:visible')).toHaveAttribute('data-id', '1001');
    // O "Limpar filtros" da Demanda: a busca e as marcas
    await page.locator('#flt-dem').fill('nenhum assim');
    await page.locator('#limpar-filtros-dem').click();
    await expect(page.locator('#flt-dem')).toBeFocused();
    await expect(page.locator('#flt-dem')).toHaveValue('');
    await expect(page.locator('#flt-dem-cur')).toHaveText('Todos os cursos');
    await expect(page.locator('#dem tr[data-k="d"]:visible')).toHaveCount(2);
    await expect(page.locator('#dem tr.sem-resultado')).toHaveCount(0);
  });

  // Em Recursos também: a busca pela matrícula e o filtro das categorias (o botão e as caixas com .flt-ctrl, sem data-f
  // nem data-a), as duas vistas e o "Limpar filtros"; "+ Novo recurso" não aparece
  test('o Gestor busca a matrícula, marca as categorias e troca de vista em Recursos; "Limpar filtros" mostra todos de novo', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }), url: './?role=gestor' });
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    await irPara(page, 'rec');
    await expect(page.locator('#s-rec')).toHaveAttribute('data-vista', 'dia');
    await expect(page.locator('#btn-novo-recurso')).toBeHidden();
    const busca = page.locator('#flt-rec-mat'), botao = page.locator('#flt-rec-cat'), painel = page.locator('#flt-rec-cat-painel');
    const pa34 = painel.locator('input[data-valor="PA-34"]');
    await expect(busca).toBeEnabled();
    await expect(botao).toBeEnabled();
    await botao.click();
    await expect(painel).toBeVisible();
    await expect(painel.locator('input[data-filtro]')).toHaveCount(4);
    await expect(painel.locator('input[data-filtro]:disabled')).toHaveCount(0);
    await expect(painel.locator('#flt-rec-cat-limpar')).toBeEnabled();
    await botao.click();
    await busca.fill('vob');
    await expect(page.locator('#revisao tr[data-r]')).toHaveCount(1);
    await expect(page.locator('#rec-contagem')).toHaveText('1 de 26 recursos');
    await busca.fill('');
    await filtrarCategorias(page, ['PA-34']);
    await expect(botao).toHaveText('Categoria: PA-34');
    await expect(page.locator('#revisao tr[data-r]')).toHaveCount(3);
    await irParaVista(page, 'rec', 'cadastro');
    await expect(page.locator('#frota li.frota-item')).toHaveCount(3);
    await busca.fill('nenhum assim');
    await page.locator('#limpar-filtros-frota').click();
    await expect(busca).toBeFocused();
    await expect(pa34).not.toBeChecked();
    await expect(botao).toHaveText('Todas as categorias');
    await expect(page.locator('#frota li.frota-item')).toHaveCount(26);
    await expect(page.locator('#rec-contagem')).toHaveText('26 recursos');
  });

  // O link não leva a escala no endereço (nomes, pesos e horas). Sem o servidor, a escala fica só neste navegador;
  // no app publicado, o link leva só a data (test/e2e/compartilhado.spec.js)
  test('neste navegador (sem servidor), Compartilhar explica que o link da escala é do app publicado', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await page.evaluate(() => navigator.clipboard.writeText('nada copiado'));
    await page.locator('#btn-share-link').click();
    await expect(page.locator('#toast-box')).toContainText('Sem o servidor, a escala fica só neste navegador: o link da escala é do app publicado, com login.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('nada copiado');
  });

  test('um link antigo com a escala no endereço (share=) avisa que não vale mais; o app abre com os dados deste navegador', async ({ page }) => {
    const payload = { d: '2026-11-12', fly: [[1000, 'Aluno do Link', 70, [], 1, 'Voo Local', 'C152', 1, 2, 1, 1, 3, []]] };
    const share = encodeURIComponent(Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'));
    await abrirComExemplo(page, { url: `./?role=gestor&share=${share}` });
    await expect(page.locator('#aviso-link-texto')).toHaveText(AVISO_DO_LINK_ANTIGO);
    await expect(page.locator('#role-sel')).toBeEnabled();
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    await abrirEscala(page);
    await expect(page.locator('#out')).not.toContainText('Aluno do Link');
    expect(new URL(page.url()).searchParams.has('share')).toBe(false);
    await page.locator('#btn-fechar-aviso-link').click();
    await expect(page.locator('#aviso-link')).toBeHidden();
  });
});

const AVISO_DO_LINK_ANTIGO = 'Este link antigo levava a escala no próprio endereço e não vale mais. Peça um link novo a quem compartilhou.';
