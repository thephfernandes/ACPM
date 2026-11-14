// Cursos (fase 14): o programa de cada curso (PP, PC e INVA) fica em Alunos › Cursos. O Administrador inclui, muda,
// reordena e tira missões; os outros perfis só consultam. Cada aluno tem o curso dele.
import { test, expect, abrir, irPara, confirmar, abrirEscala, prepararContexto, vigiarErros, AMANHA } from './fixtures.js';
import { criarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const dia = (extra = {}) => ({ ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' }), aluno(1001)] }), ...extra });
const PROGRAMA = { PP: [{ id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local', eq: 'C152', nb: 1 }, { id: 'PP-02', nome: 'Navegação', mis: 'Navegação', eq: 'C152', nb: 2 }], PC: [], INVA: [] };
const verCursos = async page => {
  await irPara(page, 'alu');
  await page.locator('#s-alu [data-vista-alu="cursos"]').click();
  await expect(page.locator('#cursos')).toBeVisible();
};
const curso = (page, id) => page.locator(`#cursos .curso[data-curso="${id}"]`);
const linhas = (page, id) => curso(page, id).locator('tbody tr[data-i]');

test.describe('Cursos', () => {
  test('o Administrador monta o programa: inclui, muda, reordena e tira missões; tudo fica gravado', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await verCursos(page);
    await expect(curso(page, 'PP')).toContainText('Nenhuma missão no programa');
    await curso(page, 'PP').getByRole('button', { name: '+ Missão' }).click();
    await curso(page, 'PP').getByRole('button', { name: '+ Missão' }).click();
    await expect(linhas(page, 'PP')).toHaveCount(2);
    await expect(linhas(page, 'PP').nth(1).locator('[data-cf="id"]')).toHaveValue('PP-02');
    await expect(linhas(page, 'PP').nth(1).locator('[data-cf="nome"]')).toBeFocused();

    await linhas(page, 'PP').nth(0).locator('[data-cf="nome"]').fill('Familiarização');
    await linhas(page, 'PP').nth(0).locator('[data-cf="nome"]').press('Tab');
    await linhas(page, 'PP').nth(1).locator('[data-cf="mis"]').selectOption('Navegação');
    await linhas(page, 'PP').nth(1).locator('[data-cf="nb"]').selectOption('2');
    await linhas(page, 'PP').nth(1).getByRole('button', { name: 'Subir PP-02' }).click();
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="id"]')).toHaveValue('PP-02');

    // Código repetido no curso não vale
    await linhas(page, 'PP').nth(0).locator('[data-cf="id"]').fill('pp-01');
    await linhas(page, 'PP').nth(0).locator('[data-cf="id"]').press('Tab');
    await expect(page.locator('#toast-box')).toContainText('O código PP-01 já existe no PP.');
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="id"]')).toHaveValue('PP-02');

    await confirmar(page, '#cursos .curso[data-curso="PP"] tbody tr[data-i="1"] [data-act="curso-remover"]');
    await expect(linhas(page, 'PP')).toHaveCount(1);
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#audit-log-list')).toContainText('Programa do PP: PP-01 removida');
    await page.keyboard.press('Escape');

    await page.reload();
    await verCursos(page);
    await expect(linhas(page, 'PP')).toHaveCount(1);
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="mis"]')).toHaveValue('Navegação');
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="nb"]')).toHaveValue('2');
  });

  test('cada aluno tem o curso dele, na lista de alunos', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await irPara(page, 'alu');
    await expect(page.locator('#alu tr[data-id="1000"] [data-f="curso"]')).toHaveValue('PP');
    await page.locator('#alu tr[data-id="1001"] [data-f="curso"]').selectOption('INVA');
    await page.reload();
    await irPara(page, 'alu');
    await expect(page.locator('#alu tr[data-id="1001"] [data-f="curso"]')).toHaveValue('INVA');
  });

  test('no Gestor, o programa e o curso dos alunos só aparecem', async ({ page }) => {
    await abrir(page, { estado: dia({ cursos: PROGRAMA }), url: './?role=gestor' });
    await verCursos(page);
    await expect(linhas(page, 'PP')).toHaveCount(2);
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="nome"]')).toBeDisabled();
    await expect(curso(page, 'PP').getByRole('button', { name: '+ Missão' })).toBeHidden();
    await page.locator('#s-alu [data-vista-alu="alunos"]').click();
    await expect(page.locator('#alu tr[data-id="1000"] [data-f="curso"]')).toBeDisabled();
  });
});

// A missão do curso no dia (fase 14): a Demanda sugere a próxima missão do programa ("Usar" põe a missão, o recurso e
// as horas); na escala, o código fica com o aluno e o operador registra o resultado; aprovada, ela conta no progresso
// e a próxima passa a ser a seguinte
test.describe('Cursos no dia', () => {
  const dia = () => ({ ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { fly: false, p1: 500, p2: -1 }, { curso: 'PP' }), aluno(1001, { fly: false })] }), cursos: PROGRAMA });
  const naDemanda = async page => {
    await irPara(page, 'dem');
    await page.locator('#onlyfly').uncheck();
    return page.locator('#dem tr[data-id="1000"][data-mid="0"]');
  };
  const vooNaEscala = page => page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });

  test('Usar a próxima missão; registrar o resultado na escala; o progresso e a próxima avançam; o resultado fica gravado', async ({ page }) => {
    await abrir(page, { estado: dia() });
    const linha = await naDemanda(page);
    await expect(linha.locator('[data-act="usar-proxima"]')).toHaveText('Próxima: PP-01 · Usar');
    await expect(page.locator('#dem tr[data-id="1001"] [data-act="usar-proxima"]')).toHaveCount(0);
    await linha.locator('[data-act="usar-proxima"]').click();
    await expect(linha.locator('[data-f="fly"]')).toBeChecked();
    await expect(linha.locator('.etapa')).toHaveText('PP-01');
    await expect(linha.locator('[data-act="usar-proxima"]')).toHaveCount(0);

    await abrirEscala(page);
    await expect(vooNaEscala(page).locator('.c-status .etapa')).toHaveText('PP-01');
    await vooNaEscala(page).locator('[data-resultado]').selectOption('aprovado');
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#audit-log-list')).toContainText('Resultado de Aluno 1000 em PP-01: aprovado');
    await page.keyboard.press('Escape');

    await irPara(page, 'alu');
    await expect(page.locator('#alu tr[data-id="1000"] .progresso')).toHaveText('1/2 · próxima PP-02');

    await page.reload();
    await abrirEscala(page);
    await expect(vooNaEscala(page).locator('[data-resultado]')).toHaveValue('aprovado');
  });

  test('mudar a missão à mão tira o código do curso', async ({ page }) => {
    await abrir(page, { estado: dia() });
    const linha = await naDemanda(page);
    await linha.locator('[data-act="usar-proxima"]').click();
    await linha.locator('[data-f="mis"]').selectOption('Navegação');
    await expect(linha.locator('.etapa')).toHaveCount(0);
    await expect(linha.locator('[data-act="usar-proxima"]')).toHaveText('Próxima: PP-01 · Usar');
  });

  test('no Gestor, o código e o resultado só aparecem', async ({ page }) => {
    const estado = { ...dia(), stu: [aluno(1000, { p1: 500, p2: -1, etapa: 'PP-01' }, { curso: 'PP' })] };
    await abrir(page, { estado, url: './?role=gestor' });
    await abrirEscala(page);
    await expect(vooNaEscala(page).locator('.c-status .etapa')).toHaveText('PP-01');
    await expect(vooNaEscala(page).locator('[data-resultado]')).toHaveCount(0);
  });
});

// No modo compartilhado, o resultado vai para o servidor pela função registrar_resultado; quem abre depois vê o
// resultado na escala e o progresso em Alunos
test.describe('Cursos no servidor (modo compartilhado)', () => {
  async function entrar(browser, servidor, conta) {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    await servidor.instalar(contexto);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    await page.goto('./?supabase=teste');
    await page.locator('#login-email').fill(conta.email);
    await page.locator('#login-senha').fill(conta.senha);
    await page.locator('#btn-entrar').click();
    await expect(page.locator('#usuario')).toBeVisible();
    return { contexto, page, erros };
  }

  test('o operador registra; o servidor guarda com quem registrou; o gestor vê o resultado e o progresso', async ({ browser }) => {
    const estado = { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 500, p2: -1, etapa: 'PP-01' }, { curso: 'PP' })] }), cursos: PROGRAMA };
    const servidor = criarSupabaseFalso(documentosAtuais(estado, AMANHA));
    const operador = await entrar(browser, servidor, CONTAS.operador);
    await abrirEscala(operador.page);
    const voo = page => page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });
    await voo(operador.page).locator('[data-resultado]').selectOption('aprovado');
    await expect.poll(() => servidor.resultados.length).toBe(1);
    expect(servidor.resultados[0]).toMatchObject({ aluno: 1000, curso: 'PP', missao: 'PP-01', resultado: 'aprovado', data: AMANHA, voo: '1000_0_1', registrado_por: 'Operador de Teste' });
    expect(operador.erros).toEqual([]);
    await operador.contexto.close();

    const gestor = await entrar(browser, servidor, CONTAS.gestor);
    await abrirEscala(gestor.page);
    await expect(voo(gestor.page).locator('.res-aprovado')).toHaveText('Aprovado');
    await irPara(gestor.page, 'alu');
    await expect(gestor.page.locator('#alu tr[data-id="1000"] .progresso')).toHaveText('1/2 · próxima PP-02');
    expect(gestor.erros).toEqual([]);
    await gestor.contexto.close();
  });

  // Revisão de 14/11: a resposta que chega depois de trocar de data não vai para a data nova
  test('o resultado registrado antes de trocar de data fica no histórico da data do voo', async ({ browser }) => {
    const estado = { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 500, p2: -1, etapa: 'PP-01' }, { curso: 'PP' })] }), cursos: PROGRAMA };
    const servidor = criarSupabaseFalso(documentosAtuais(estado, AMANHA));
    const operador = await entrar(browser, servidor, CONTAS.operador);
    await abrirEscala(operador.page);
    const liberar = servidor.segurar('/rpc/registrar_resultado');
    await operador.page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' }).locator('[data-resultado]').selectOption('aprovado');
    await operador.page.locator('#dt-prox').click();
    // A data nova já aberta (o rótulo muda depois de carregar)
    await expect(operador.page.locator('#dt-rotulo')).toContainText('12/11');
    liberar();
    await expect.poll(() => servidor.historico.filter(h => h.descricao.startsWith('Resultado de')).map(h => h.data)).toEqual([AMANHA]);
    expect(servidor.resultados.map(r => r.data)).toEqual([AMANHA]);
    expect(operador.erros).toEqual([]);
    await operador.contexto.close();
  });
});
