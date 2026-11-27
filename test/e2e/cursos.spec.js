// Cursos: o programa de cada curso (PP, PC e INVA) fica na aba Cursos, lido das tabelas dos cursos (neste navegador,
// acpm4_cursos). O Administrador inclui, muda, reordena e tira missões; os outros perfis só consultam. Cada alteração
// grava o curso inteiro (não o cadastro nem o dia) e não entra no histórico da data. Cada aluno tem o curso dele, em
// Alunos.
import { test, comProgresso, expect, abrir, irPara, irParaVista, confirmar, abrirEscala, prepararContexto, vigiarErros, preencherLogin, AMANHA, URL_APP, entrar as entrarNoApp, abrirHistorico, appPronto, caixaVoa, diaSeguinte, rotuloDaData, alvosPequenos, larguraDaPagina, semNome, campoDoAluno, textoDoProgresso, progressoNaLinha } from './fixtures.js';
import { criarSupabaseFalso, documentosAtuais, documentosFase3, CONTAS } from './supabase-falso.js';
import { aluno, cenario, instrutor, missaoExtra } from '../helpers/montar.js';
import { IDS } from '../helpers/casos-do-programa.js';
import { cursosIniciais, gravarCurso } from '../../js/programa.js';
import { ApiClient } from '../../js/storage.js';

const dia = (extra = {}) => ({ ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' }), aluno(1001)] }), ...extra });
const PROGRAMA = { PP: [{ id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local', eq: 'C152', nb: 1 }, { id: 'PP-02', nome: 'Navegação', mis: 'Navegação', eq: 'C152', nb: 2 }], PC: [], INVA: [] };
const curso = (page, id) => page.locator(`#cursos .curso[data-curso="${id}"]`);
const linhas = (page, id) => curso(page, id).locator('tbody tr[data-i]');
// Os cursos na aba (um de cada vez), pela sigla
const siglasNaAba = page => page.locator('#cursos .curso').evaluateAll(els => els.map(e => e.dataset.curso));

// O programa gravado neste navegador (acpm4_cursos): as missões de um curso, as do programa e as tiradas dele, e as
// alterações registradas
const programaGuardado = page => page.evaluate(() => JSON.parse(localStorage.getItem('acpm4_cursos')));
const missoesGuardadas = (guardado, sigla) => {
  const c = guardado.cursos.find(x => x.sigla === sigla);
  return c.missoes.map(m => [m.codigo, m.nome, m.mis, m.nb, m.removida]).sort((a, b) => a[4] - b[4] || a[0].localeCompare(b[0]));
};

test.describe('Cursos', () => {
  test('o Administrador monta o programa: inclui, muda, reordena e tira missões; tudo fica gravado nos cursos, fora do histórico da data', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await irPara(page, 'cur');
    await expect(curso(page, 'PP')).toContainText('Nenhuma missão no programa');
    // A primeira missão começa a Fase 1; a segunda entra nela, com o código seguinte
    await curso(page, 'PP').getByRole('button', { name: '+ Missão' }).click();
    await expect(curso(page, 'PP').locator('.fase h4')).toHaveText('Fase 1');
    await curso(page, 'PP').getByRole('button', { name: '+ Missão' }).click();
    await expect(linhas(page, 'PP')).toHaveCount(2);
    await expect(linhas(page, 'PP').nth(1).locator('[data-cf="codigo"]')).toHaveValue('PP-02');
    await expect(linhas(page, 'PP').nth(1).locator('[data-cf="nome"]')).toBeFocused();
    await expect(linhas(page, 'PP').nth(1).locator('[data-cf="nome"]')).toHaveValue('PP-02');

    await linhas(page, 'PP').nth(0).locator('[data-cf="nome"]').fill('Familiarização');
    await linhas(page, 'PP').nth(0).locator('[data-cf="nome"]').press('Tab');
    await linhas(page, 'PP').nth(1).locator('[data-cf="mis"]').selectOption('Navegação');
    await linhas(page, 'PP').nth(1).locator('[data-cf="nb"]').fill('2');
    await linhas(page, 'PP').nth(1).locator('[data-cf="nb"]').press('Enter');
    await linhas(page, 'PP').nth(1).getByRole('button', { name: 'Subir PP-02' }).click();
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="codigo"]')).toHaveValue('PP-02');
    // No topo da fase, o Subir fica desligado: o foco vai para o código da missão que subiu
    await expect(linhas(page, 'PP').nth(0).getByRole('button', { name: 'Subir PP-02' })).toBeDisabled();
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="codigo"]')).toBeFocused();

    // Código repetido no curso não vale
    await linhas(page, 'PP').nth(0).locator('[data-cf="codigo"]').fill('pp-01');
    await linhas(page, 'PP').nth(0).locator('[data-cf="codigo"]').press('Tab');
    await expect(page.locator('#toast-box')).toContainText('O código PP-01 já existe no PP.');
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="codigo"]')).toHaveValue('PP-02');

    await confirmar(page, '#cursos .curso[data-curso="PP"] tbody tr[data-i="1"] [data-act="missao-retirar"]');
    await expect(linhas(page, 'PP')).toHaveCount(1);
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="codigo"]')).toBeFocused();
    // Tirada do programa, a PP-01 guarda o código: ele não vale para outra missão
    await linhas(page, 'PP').nth(0).locator('[data-cf="codigo"]').fill('PP-01');
    await linhas(page, 'PP').nth(0).locator('[data-cf="codigo"]').press('Tab');
    await expect(page.locator('#toast-box')).toContainText('O código PP-01 é de uma missão tirada do programa do PP (ela guarda o código).');

    // O curso inteiro, gravado a cada alteração (uma versão por alteração, com a descrição); o cadastro guarda só a cópia
    // de antes, e o histórico da data não recebe o programa
    await expect.poll(async () => (await programaGuardado(page)).alteracoes.map(a => [a.curso, a.versao, a.descricao])).toEqual([
      ['PP', 2, 'PP: PP-01 incluída'], ['PP', 3, 'PP: PP-02 incluída'], ['PP', 4, 'PP: PP-01 alterada'], ['PP', 5, 'PP: PP-02 alterada'],
      ['PP', 6, 'PP: PP-02 alterada'], ['PP', 7, 'PP: PP-02 passou para 1ª'], ['PP', 8, 'PP: PP-01 tirada do programa']
    ]);
    expect(missoesGuardadas(await programaGuardado(page), 'PP')).toEqual([['PP-02', 'PP-02', 'Navegação', 2, false], ['PP-01', 'Familiarização', 'Voo Local', 1, true]]);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('acpm4_cadastro')).cursos)).toEqual({ PP: [], PC: [], INVA: [] });
    await expect(page.locator('#log-cnt')).toHaveText('0');

    await page.reload();
    await irPara(page, 'cur');
    await expect(linhas(page, 'PP')).toHaveCount(1);
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="mis"]')).toHaveValue('Navegação');
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="nb"]')).toHaveValue('2');
  });

  // F1d, "missão do curso" (regra a): a missão exige do INVA as habilitações marcadas em "Habilitações que o INVA precisa"
  // (os grupos do painel "Editar habilitações"). Marcar uma que nenhum INVA ativo tem não é impedido: o aviso diz o que
  // acontece com os voos, e a linha da missão continua dizendo até um INVA ter
  test('a missão exige do INVA as habilitações marcadas; sem nenhum INVA ativo com ela, o aviso fica na linha', async ({ page }) => {
    await abrir(page, { estado: dia({ cursos: PROGRAMA }) });
    await irPara(page, 'cur');
    const pp01 = () => linhas(page, 'PP').nth(0);
    const caixa = () => pp01().locator('details.exige');
    await expect(caixa().locator('summary')).toHaveText('Habilitações que o INVA precisa: nenhuma além da missão e do recurso');
    await expect(pp01().locator('[data-aviso-exige]')).toHaveCount(0);
    await caixa().locator('summary').click();
    await expect(caixa().locator('legend')).toHaveText(['Ground e simulador', 'Voo', 'Aviões', 'Checador: curso', 'Checador: motor', 'Checador: regras']);
    await expect(caixa().locator('input[data-cf="exige"]:checked')).toHaveCount(0);
    await caixa().getByRole('checkbox', { name: 'PP-01 exige Endosso Solo' }).check();
    await expect(page.locator('#toast-box')).toContainText('Nenhum INVA ativo tem Endosso Solo: os voos de PP-01 ficam fora da escala até um INVA ter (marque em Instrutores › Editar habilitações).');
    await expect(pp01().locator('[data-aviso-exige]')).toHaveText('Nenhum INVA ativo tem Endosso Solo: os voos ficam fora da escala.');
    await expect(caixa().locator('summary')).toHaveText('Habilitações que o INVA precisa: Endosso Solo');
    await expect(caixa()).toHaveAttribute('open', '');
    await expect(caixa().getByRole('checkbox', { name: 'PP-01 exige Endosso Solo' })).toBeChecked();
    await caixa().getByRole('checkbox', { name: 'PP-01 exige Voo de Navegação ≥ 150 NM' }).check();
    await expect(pp01().locator('[data-aviso-exige]')).toHaveText('Nenhum INVA ativo tem Voo de Navegação ≥ 150 NM e Endosso Solo: os voos ficam fora da escala.');
    const exigidas = async () => (await programaGuardado(page)).cursos.find(c => c.sigla === 'PP').missoes.map(m => [m.codigo, m.exige]);
    await expect.poll(exigidas).toEqual([['PP-01', ['navegacao_150', 'endosso_solo']], ['PP-02', []]]);
    await expect.poll(async () => (await programaGuardado(page)).alteracoes.map(a => a.descricao).slice(-2)).toEqual([
      'PP: PP-01 exige do INVA Endosso Solo', 'PP: PP-01 exige do INVA Voo de Navegação ≥ 150 NM e Endosso Solo'
    ]);
    // O INVA que passa a ter as duas tira o aviso da linha (inativo, ele não conta: os dois testes do INVA inativo e ativo)
    await irParaVista(page, 'ins', 'cadastro');
    await page.locator('#inst .cd[data-id="1"] [data-act="editar-habs"]').click();
    await page.locator('#painel-instrutor [data-f="hab"][data-h="endosso_solo"]').check();
    await page.locator('#painel-instrutor [data-f="hab"][data-h="navegacao_150"]').check();
    await page.locator('#btn-fechar-painel-instrutor').click();
    await irPara(page, 'cur');
    await expect(pp01().locator('[data-aviso-exige]')).toHaveCount(0);
    // Desmarcar as duas volta ao de antes
    await caixa().getByRole('checkbox', { name: 'PP-01 exige Endosso Solo' }).uncheck();
    await caixa().getByRole('checkbox', { name: 'PP-01 exige Voo de Navegação ≥ 150 NM' }).uncheck();
    await expect.poll(exigidas).toEqual([['PP-01', []], ['PP-02', []]]);
    await expect.poll(async () => (await programaGuardado(page)).alteracoes.at(-1).descricao).toBe('PP: PP-01 não exige mais habilitação do INVA além da missão e do recurso');
    await expect(caixa().locator('summary')).toHaveText('Habilitações que o INVA precisa: nenhuma além da missão e do recurso');
  });

  // O servidor guarda até 10 habilitações por missão: a 11ª marcada é recusada com o motivo, e as 10 ficam
  test('a missão exige do INVA até 10 habilitações: a 11ª marcada é recusada com o motivo', async ({ page }) => {
    await abrir(page, { estado: dia({ cursos: PROGRAMA }) });
    await irPara(page, 'cur');
    const caixa = () => linhas(page, 'PP').nth(0).locator('details.exige');
    await caixa().locator('summary').click();
    const dez = ['grounds', 'ground_pa34', 'sim_mono', 'sim_multi', 'tgl', 'local', 'navegacao', 'navegacao_150', 'solo', 'endosso_solo'];
    for (const h of dez) await caixa().locator(`input[data-cf="exige"][value="${h}"]`).check();
    const exigidas = async () => (await programaGuardado(page)).cursos.find(c => c.sigla === 'PP').missoes[0].exige.length;
    await expect.poll(exigidas).toBe(10);
    await caixa().locator('input[data-cf="exige"][value="parafuso"]').click();
    await expect(page.locator('#toast-box')).toContainText('A missão PP-01 exige do INVA no máximo 10 habilitações além da missão e do recurso: desmarque uma antes de marcar outra.');
    await expect(caixa().locator('input[data-cf="exige"][value="parafuso"]')).not.toBeChecked();
    await expect(caixa().locator('input[data-cf="exige"]:checked')).toHaveCount(10);
    expect(await exigidas()).toBe(10);
  });

  // "Nenhum INVA ativo": o INVA inativo no cadastro que tem a habilitação não conta (regra a)
  for (const [nome, inativo] of [['o INVA inativo com a habilitação não tira o aviso da linha', true], ['o INVA ativo com a habilitação tira o aviso da linha', false]]) {
    test(nome, async ({ page }) => {
      const { cursos } = gravarCurso({ cursos: cursosIniciais() }, {
        sigla: 'PP', versaoLida: 1, descricao: 'PP: programa', conteudo: {
          nome: 'Piloto Privado', ativo: true, fases: [{ id: IDS.f1, nome: 'Fase 1' }],
          missoes: [{ id: IDS.m1, fase: IDS.f1, codigo: 'SOLO-01', nome: 'Solo', mis: 'Voo Solo', eq: 'C152', nb: 1, exige: ['endosso_solo'] }]
        }
      });
      const comEndosso = { ...instrutor(2, 9), hab: [...instrutor(2, 9).hab, 'endosso_solo'], ...(inativo ? { inativo: true } : {}) };
      const { documentos: { cadastro }, dias } = documentosAtuais({ ...dia(), ins: [instrutor(1, 9), comEndosso] }, AMANHA);
      await page.addInitScript(json => {
        if (localStorage.getItem('acpm4_cadastro')) return;
        for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
      }, JSON.stringify({ acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_cursos: { cursos, alteracoes: [] } }));
      await page.goto('./');
      await appPronto(page);
      await irPara(page, 'cur');
      const aviso = linhas(page, 'PP').nth(0).locator('[data-aviso-exige]');
      await expect(linhas(page, 'PP')).toHaveCount(1);
      if (inativo) await expect(aviso).toHaveText('Nenhum INVA ativo tem Endosso Solo: os voos ficam fora da escala.');
      else await expect(aviso).toHaveCount(0);
    });
  }

  test('para quem só consulta, o que a missão exige do INVA é uma etiqueta, com o aviso', async ({ page }) => {
    const { cursos } = gravarCurso({ cursos: cursosIniciais() }, {
      sigla: 'PP', versaoLida: 1, descricao: 'PP: programa', conteudo: {
        nome: 'Piloto Privado', ativo: true, fases: [{ id: IDS.f1, nome: 'Fase 1' }],
        missoes: [{ id: IDS.m1, fase: IDS.f1, codigo: 'SOLO-01', nome: 'Solo', mis: 'Voo Solo', eq: 'C152', nb: 1, exige: ['endosso_solo'] }]
      }
    });
    const { documentos: { cadastro }, dias } = documentosAtuais(dia(), AMANHA);
    await page.addInitScript(json => {
      if (localStorage.getItem('acpm4_cadastro')) return;
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify({ acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_cursos: { cursos, alteracoes: [] } }));
    await page.goto('./?role=gestor');
    await appPronto(page);
    await irPara(page, 'cur');
    await expect(linhas(page, 'PP').nth(0).locator('td.c-marcas')).toHaveText('INVA: Endosso SoloNenhum INVA ativo tem Endosso Solo: os voos ficam fora da escala.');
  });

  // O programa do cadastro (o de antes do formato dos cursos) vai para os cursos na primeira abertura, uma vez só, e o
  // cadastro fica com a cópia
  test('na primeira abertura, o programa guardado no cadastro vai para os cursos deste navegador', async ({ page }) => {
    await abrir(page, { estado: dia({ cursos: PROGRAMA }) });
    await irPara(page, 'cur');
    await expect(linhas(page, 'PP')).toHaveCount(2);
    await expect(curso(page, 'PP').locator('.fase h4')).toHaveText('Programa');
    const guardado = await programaGuardado(page);
    expect(missoesGuardadas(guardado, 'PP')).toEqual([['PP-01', 'Familiarização', 'Voo Local', 1, false], ['PP-02', 'Navegação', 'Navegação', 2, false]]);
    expect(guardado.alteracoes.map(a => [a.curso, a.versao, a.descricao])).toEqual([['PP', 2, 'Programa trazido do cadastro (2 missões)']]);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('acpm4_cadastro')).cursos.PP.map(m => m.id))).toEqual(['PP-01', 'PP-02']);
    await page.reload();
    await irPara(page, 'cur');
    await expect(linhas(page, 'PP')).toHaveCount(2);
    expect((await programaGuardado(page)).alteracoes).toHaveLength(1);
  });

  // O programa trazido do cadastro fica numa fase só, "Programa": quando ela ganha companhia, os textos dizem "a fase
  // Programa" (como dizem "a Fase 2"), e não "a Programa"
  test('com a fase "Programa" e outra, os nomes e as alterações dizem "a fase Programa"', async ({ page }) => {
    await abrir(page, { estado: dia({ cursos: PROGRAMA }) });
    await irPara(page, 'cur');
    const pp = curso(page, 'PP');
    await pp.getByRole('button', { name: '+ Fase' }).click();
    await expect(pp.locator('.fase')).toHaveCount(2);
    const programa = pp.locator('.fase').first();
    await expect(programa.locator('[data-cfa="nome"]')).toHaveAccessibleName('Nome da fase Programa');
    await expect(programa.locator('[data-cfa="modulo"]')).toHaveAccessibleName('Módulo da fase Programa');
    await expect(programa.locator('[data-cfa="regra"]')).toHaveAccessibleName('Quando a fase Programa abre');
    await expect(programa.locator('[data-act="fase-descer"]')).toHaveAccessibleName('Descer a fase Programa');
    await expect(programa.locator('[data-act="fase-retirar"]')).toHaveAccessibleName('Tirar a fase Programa do programa');
    await expect(programa.locator('tbody tr').first().locator('[data-cf="codigo"]')).toHaveAccessibleName('Código da 1ª missão da fase Programa');
    const textos = await pp.evaluate(c => [...c.querySelectorAll('[aria-label], button, legend, summary, p')].map(e => e.getAttribute('aria-label') || e.textContent).join(' | '));
    expect(textos).not.toMatch(/\b(na|da|a) Programa\b/);
    // "+ Missão" na fase Programa, a missão para a Fase 2 e de volta, e a Fase 2 depois da fase Programa
    await programa.getByRole('button', { name: '+ Missão na fase Programa' }).click();
    const pp03 = pp.locator('tr', { has: page.locator('[data-cf="codigo"][value="PP-03"]') });
    await pp03.locator('[data-cf="fase"]').selectOption({ label: 'Fase 2' });
    await pp.locator('tr', { has: page.locator('[data-cf="codigo"][value="PP-03"]') }).locator('[data-cf="fase"]').selectOption({ label: 'Programa' });
    const fase2 = pp.locator('.fase').nth(1);
    await fase2.locator('[data-cfa="regra"]').selectOption('depois');
    await expect(fase2.locator('details.requisitos legend')).toHaveText('A Fase 2 abre depois de');
    await expect.poll(async () => (await programaGuardado(page)).alteracoes.map(a => a.descricao)).toEqual([
      'Programa trazido do cadastro (2 missões)', 'PP: Fase 2 incluída', 'PP: PP-03 incluída na fase Programa', 'PP: PP-03 passou para a Fase 2',
      'PP: PP-03 passou para a fase Programa', 'PP: Fase 2 depois de Programa'
    ]);
    // Para quem só consulta: "Abre depois da fase Programa"
    await page.locator('#role-sel').selectOption('gestor');
    await expect(pp.locator('p.regra')).toHaveText(['Abre depois da fase Programa']);
  });

  test('cada aluno tem o curso dele, na lista de alunos', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await irPara(page, 'alu');
    await expect((await campoDoAluno(page, 1000, 'curso'))).toHaveValue('PP');
    await (await campoDoAluno(page, 1001, 'curso')).selectOption('INVA');
    await page.reload();
    await irPara(page, 'alu');
    await expect((await campoDoAluno(page, 1001, 'curso'))).toHaveValue('INVA');
  });

  test('no Gestor, o programa (em texto) e o curso dos alunos só aparecem', async ({ page }) => {
    await abrir(page, { estado: dia({ cursos: PROGRAMA }), url: './?role=gestor' });
    await irPara(page, 'cur');
    await expect(linhas(page, 'PP')).toHaveCount(2);
    await expect(linhas(page, 'PP').nth(1).locator('td')).toHaveText(['2', 'PP-02', 'Navegação', 'Navegação', 'C152', '2 h', 'Depois das anteriores', '']);
    await expect(curso(page, 'PP').locator('input, select')).toHaveCount(0);
    await expect(curso(page, 'PP').getByRole('button', { name: '+ Missão' })).toBeHidden();
    await expect(page.locator('#cursos')).toContainText('Só o Administrador muda; aqui é consulta.');
    await irPara(page, 'alu');
    // O curso, em texto (quem só consulta não tem o campo)
    await expect((await campoDoAluno(page, 1000, 'curso'))).toHaveCount(0);
    await expect(page.locator('#det-alu [data-campo="curso"] .det-valor')).toHaveText('PP · Piloto Privado');
  });

  // Neste navegador, o perfil muda pelo topo: a aba Cursos aberta mostra ou tira na hora os controles de quem muda
  test('trocar o perfil com a aba Cursos aberta troca os controles do programa', async ({ page }) => {
    await abrir(page, { estado: dia({ cursos: PROGRAMA }) });
    await irPara(page, 'cur');
    await expect(curso(page, 'PP').getByRole('button', { name: '+ Missão' })).toBeVisible();
    await page.locator('#role-sel').selectOption('gestor');
    await expect(curso(page, 'PP').getByRole('button', { name: '+ Missão' })).toHaveCount(0);
    await expect(linhas(page, 'PP').nth(0).locator('[data-act="missao-retirar"]')).toHaveCount(0);
    await expect(page.locator('#cursos')).toContainText('Só o Administrador muda; aqui é consulta.');
    await page.locator('#role-sel').selectOption('operador');
    await expect(curso(page, 'PP').getByRole('button', { name: '+ Missão' })).toBeVisible();
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="nome"]')).toBeEnabled();
    await expect(page.locator('#cursos')).not.toContainText('aqui é consulta');
  });
});

// A missão do curso no dia: a Demanda sugere a próxima missão do programa ("Usar" põe a missão, o recurso e
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

  comProgresso('Usar a próxima missão; registrar o resultado na escala; o progresso e a próxima avançam; o resultado fica gravado', async ({ page }) => {
    await abrir(page, { estado: dia() });
    const linha = await naDemanda(page);
    await expect(linha.locator('[data-act="usar-proxima"]')).toHaveText('Próxima: PP-01 · Usar');
    await expect(page.locator('#dem tr[data-id="1001"] [data-act="usar-proxima"]')).toHaveCount(0);
    await linha.locator('[data-act="usar-proxima"]').click();
    await expect(caixaVoa(linha)).toBeChecked();
    await expect(linha.locator('.etapa')).toHaveText('PP-01');
    await expect(linha.locator('[data-act="usar-proxima"]')).toHaveCount(0);

    await abrirEscala(page);
    await expect(vooNaEscala(page).locator('.c-status .etapa')).toHaveText('PP-01');
    await vooNaEscala(page).locator('[data-resultado]').selectOption('aprovado');
    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list')).toContainText('Resultado de Aluno 1000 em PP-01: aprovado');
    await page.keyboard.press('Escape');

    await irPara(page, 'alu');
    await expect.poll(() => textoDoProgresso(page, 1000)).toBe('1/2 · próxima PP-02');
    // Com um resultado, o código da missão fica travado (os resultados guardam o código; o nome muda), já na tela que
    // registrou e, depois de recarregar, pelo programa lido
    const travado = async () => {
      await irPara(page, 'cur');
      const codigo = linhas(page, 'PP').nth(0).locator('[data-cf="codigo"]');
      await expect(codigo).toHaveAttribute('readonly', '');
      await expect(codigo).toHaveAttribute('title', 'Já há resultados com este código: o código não muda (o nome muda)');
      await expect(linhas(page, 'PP').nth(0).locator('[data-act="missao-retirar"]')).toHaveAttribute('aria-label', 'Tirar PP-01 do programa; os resultados ficam no histórico');
      await expect(linhas(page, 'PP').nth(1).locator('[data-cf="codigo"]')).not.toHaveAttribute('readonly');
    };
    await travado();

    await page.reload();
    await abrirEscala(page);
    await expect(vooNaEscala(page).locator('[data-resultado]')).toHaveValue('aprovado');
    await travado();
  });

  comProgresso('mudar a missão à mão tira o código do curso', async ({ page }) => {
    await abrir(page, { estado: dia() });
    const linha = await naDemanda(page);
    await linha.locator('[data-act="usar-proxima"]').click();
    await linha.locator('[data-f="mis"]').selectOption('Navegação');
    await expect(linha.locator('.etapa')).toHaveCount(0);
    await expect(linha.locator('[data-act="usar-proxima"]')).toHaveText('Próxima: PP-01 · Usar');
  });

  comProgresso('no Gestor, o código e o resultado só aparecem', async ({ page }) => {
    const estado = { ...dia(), stu: [aluno(1000, { p1: 500, p2: -1, etapa: 'PP-01' }, { curso: 'PP' })] };
    await abrir(page, { estado, url: './?role=gestor' });
    await abrirEscala(page);
    await expect(vooNaEscala(page).locator('.c-status .etapa')).toHaveText('PP-01');
    await expect(vooNaEscala(page).locator('[data-resultado]')).toHaveCount(0);
  });
});

// No modo compartilhado, o resultado vai para o servidor pela função registrar_resultado; quem abre depois vê o
// resultado na escala e o progresso em Alunos. O programa vem das tabelas dos cursos (programa_dos_cursos), e só o
// Administrador o grava (salvar_curso), um curso de cada vez, sem gravar o cadastro nem o dia
test.describe('Cursos no servidor (modo compartilhado)', () => {
  async function entrar(browser, servidor, conta, { statusEsperados = [] } = {}) {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    await servidor.instalar(contexto);
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados });
    await entrarNoApp(page, conta);
    return { contexto, page, erros };
  }
  const servidorComPrograma = () => criarSupabaseFalso(documentosAtuais({ ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' })] }), cursos: PROGRAMA }, AMANHA));
  const doServidor = (servidor, sigla = 'PP') => servidor.cursos.find(c => c.sigla === sigla);
  const noPrograma = (servidor, sigla = 'PP') => doServidor(servidor, sigla).missoes.filter(m => !m.removida).sort((a, b) => a.ordem - b.ordem).map(m => [m.codigo, m.nome]);

  comProgresso('o operador registra; o servidor guarda com quem registrou; o gestor vê o resultado e o progresso', async ({ browser }) => {
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
    await expect.poll(() => textoDoProgresso(gestor.page, 1000)).toBe('1/2 · próxima PP-02');
    expect(gestor.erros).toEqual([]);
    await gestor.contexto.close();
  });

  // A resposta que chega depois de trocar de data não vai para a data nova
  comProgresso('o resultado registrado antes de trocar de data fica no histórico da data do voo', async ({ browser }) => {
    const estado = { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 500, p2: -1, etapa: 'PP-01' }, { curso: 'PP' })] }), cursos: PROGRAMA };
    const servidor = criarSupabaseFalso(documentosAtuais(estado, AMANHA));
    const operador = await entrar(browser, servidor, CONTAS.operador);
    await abrirEscala(operador.page);
    const liberar = servidor.segurar('/rpc/registrar_resultado');
    await operador.page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' }).locator('[data-resultado]').selectOption('aprovado');
    await diaSeguinte(operador.page);
    // A data nova já aberta (o rótulo muda depois de carregar)
    await expect(rotuloDaData(operador.page)).toContainText('12/11');
    liberar();
    await expect.poll(() => servidor.historico.filter(h => h.descricao.startsWith('Resultado de')).map(h => h.data)).toEqual([AMANHA]);
    expect(servidor.resultados.map(r => r.data)).toEqual([AMANHA]);
    expect(operador.erros).toEqual([]);
    await operador.contexto.close();
  });

  // A resposta que chega com a data seguinte ainda abrindo (nada mais grava até ela abrir) também vai para a data do voo
  comProgresso('o resultado que chega enquanto outra data abre fica no histórico da data do voo', async ({ browser }) => {
    const estado = { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 500, p2: -1, etapa: 'PP-01' }, { curso: 'PP' })] }), cursos: PROGRAMA };
    const servidor = criarSupabaseFalso(documentosAtuais(estado, AMANHA));
    const operador = await entrar(browser, servidor, CONTAS.operador);
    await abrirEscala(operador.page);
    const liberarResultado = servidor.segurar('/rpc/registrar_resultado');
    await operador.page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' }).locator('[data-resultado]').selectOption('aprovado');
    const liberarDias = servidor.segurarLeiturasDeDias();
    await diaSeguinte(operador.page, { esperar: false });
    liberarResultado();
    await expect.poll(() => servidor.historico.filter(h => h.descricao.startsWith('Resultado de')).map(h => h.data)).toEqual([AMANHA]);
    liberarDias();
    await expect(rotuloDaData(operador.page)).toContainText('12/11');
    expect(servidor.resultados.map(r => r.data)).toEqual([AMANHA]);
    expect(operador.erros).toEqual([]);
    await operador.contexto.close();
  });

  // Trocar de data lê os programas de novo: a aba Cursos aberta mostra o programa que o Administrador mudou nesse
  // meio-tempo
  test('com a aba Cursos aberta, a data nova mostra o programa lido de novo', async ({ browser }) => {
    const servidor = servidorComPrograma();
    const gestor = await entrar(browser, servidor, CONTAS.gestor);
    await irPara(gestor.page, 'cur');
    await expect(linhas(gestor.page, 'PP')).toHaveCount(2);
    const admin = await entrar(browser, servidor, CONTAS.administrador);
    await irPara(admin.page, 'cur');
    await confirmar(admin.page, '#cursos .curso[data-curso="PP"] tbody tr[data-i="0"] [data-act="missao-retirar"]');
    await expect.poll(() => noPrograma(servidor)).toEqual([['PP-02', 'Navegação']]);
    expect(admin.erros).toEqual([]);
    await admin.contexto.close();
    await diaSeguinte(gestor.page);
    await expect(rotuloDaData(gestor.page)).toContainText('12/11');
    await expect(gestor.page.locator('#s-cur')).toBeVisible();
    await expect(linhas(gestor.page, 'PP')).toHaveCount(1);
    await expect(linhas(gestor.page, 'PP').nth(0).locator('td.c-codigo')).toHaveText('PP-02');
    expect(gestor.erros).toEqual([]);
    await gestor.contexto.close();
  });

  // Cada alteração grava o curso inteiro, a partir da versão confirmada pela gravação anterior, com a descrição dela; o
  // cadastro (com a cópia do programa de antes), o dia e o histórico da data não mudam
  comProgresso('o Administrador muda o programa: só as tabelas dos cursos gravam, uma alteração depois da outra; quem abre depois vê', async ({ browser }) => {
    const servidor = servidorComPrograma();
    const admin = await entrar(browser, servidor, CONTAS.administrador);
    const enviadas = [];
    admin.page.on('request', r => { if (r.url().endsWith('/rpc/salvar_curso')) enviadas.push(r.postDataJSON()); });
    await irPara(admin.page, 'cur');
    // A primeira gravação demora: a segunda alteração aparece na hora e espera na fila, sem sair antes da primeira
    const liberar = servidor.segurar('/rpc/salvar_curso');
    const nome = linhas(admin.page, 'PP').nth(0).locator('[data-cf="nome"]');
    await nome.fill('Familiarização no C152');
    await nome.press('Tab');
    await linhas(admin.page, 'PP').nth(1).getByRole('button', { name: 'Subir PP-02' }).click();
    await expect(linhas(admin.page, 'PP').nth(0).locator('[data-cf="codigo"]')).toHaveValue('PP-02');
    await expect(linhas(admin.page, 'PP').nth(1).locator('[data-cf="nome"]')).toHaveValue('Familiarização no C152');
    await expect.poll(() => enviadas.length).toBe(1);
    liberar();
    await expect.poll(() => doServidor(servidor).versao).toBe(4);
    expect(enviadas.map(g => [g.p_sigla, g.p_versao_lida, g.p_descricao])).toEqual([['PP', 2, 'PP: PP-01 alterada'], ['PP', 3, 'PP: PP-02 passou para 1ª']]);
    expect(noPrograma(servidor)).toEqual([['PP-02', 'Navegação'], ['PP-01', 'Familiarização no C152']]);
    expect(servidor.gravacoes).toEqual([]);
    expect(servidor.historico).toEqual([]);
    expect(servidor.banco.get('cadastro').conteudo.cursos.PP.map(m => [m.id, m.nome])).toEqual([['PP-01', 'Familiarização'], ['PP-02', 'Navegação']]);
    expect(admin.erros).toEqual([]);
    await admin.contexto.close();

    const gestor = await entrar(browser, servidor, CONTAS.gestor);
    await irPara(gestor.page, 'cur');
    await expect(linhas(gestor.page, 'PP').nth(0).locator('td.c-codigo')).toHaveText('PP-02');
    await expect(linhas(gestor.page, 'PP').nth(1).locator('td.c-codigo')).toHaveText('PP-01');
    await expect(linhas(gestor.page, 'PP').nth(1).locator('td.c-nome')).toHaveText('Familiarização no C152');
    // As alterações do programa, a mais recente primeiro: quando, quem e o que mudou (também para quem só consulta)
    const alteracoes = curso(gestor.page, 'PP').locator('details.alteracoes');
    await alteracoes.locator('summary').click();
    await expect(alteracoes.locator('li')).toHaveText([
      '[10/11 12:00] Admin de Teste · PP: PP-02 passou para 1ª', '[10/11 12:00] Admin de Teste · PP: PP-01 alterada',
      '[10/11 12:00] Operador de Teste · Programa trazido do cadastro (2 missões)'
    ]);
    await irPara(gestor.page, 'alu');
    await expect.poll(() => textoDoProgresso(gestor.page, 1000)).toBe('0/2 · próxima PP-02');
    expect(gestor.erros).toEqual([]);
    await gestor.contexto.close();
  });

  // A data trocada lê os programas de novo; com uma gravação do programa ainda indo, a leitura traz o programa de antes
  // dela. Quando ela volta, a tela mostra o que ficou gravado, e a alteração seguinte parte da versão nova
  test('trocar de data com uma gravação do programa indo: a tela fica com o que foi gravado', async ({ browser }) => {
    const servidor = servidorComPrograma();
    const admin = await entrar(browser, servidor, CONTAS.administrador);
    await irPara(admin.page, 'cur');
    const liberar = servidor.segurar('/rpc/salvar_curso');
    const nome = linhas(admin.page, 'PP').nth(0).locator('[data-cf="nome"]');
    await nome.fill('Familiarização no C152');
    await nome.press('Tab');
    await diaSeguinte(admin.page);
    await expect(rotuloDaData(admin.page)).toContainText('12/11');
    await expect(nome).toHaveValue('Familiarização');
    liberar();
    await expect(nome).toHaveValue('Familiarização no C152');
    await linhas(admin.page, 'PP').nth(1).locator('[data-cf="nome"]').fill('Navegação de 2 h');
    await linhas(admin.page, 'PP').nth(1).locator('[data-cf="nome"]').press('Tab');
    await expect.poll(() => noPrograma(servidor)).toEqual([['PP-01', 'Familiarização no C152'], ['PP-02', 'Navegação de 2 h']]);
    expect(doServidor(servidor).versao).toBe(4);
    expect(admin.erros).toEqual([]);
    await admin.contexto.close();
  });

  // A alteração do programa vai para o servidor fora da fila das gravações da escala: fechar a página com ela ainda indo
  // também pede confirmação (ela se perderia); gravada, a página fecha sem perguntar
  test('fechar a página com uma alteração do programa ainda sendo gravada pede confirmação', async ({ browser }) => {
    const servidor = servidorComPrograma();
    const admin = await entrar(browser, servidor, CONTAS.administrador);
    await irPara(admin.page, 'cur');
    const liberar = servidor.segurar('/rpc/salvar_curso');
    const nome = linhas(admin.page, 'PP').nth(0).locator('[data-cf="nome"]');
    await nome.fill('Familiarização no C152');
    await nome.press('Tab');
    const dialogo = new Promise(resolve => admin.page.once('dialog', async d => { resolve(d.type()); await d.dismiss(); }));
    await admin.page.close({ runBeforeUnload: true });
    expect(await dialogo, 'fechar a página com a gravação do programa indo pede confirmação').toBe('beforeunload');
    expect(admin.page.isClosed(), 'quem desiste continua na página').toBe(false);
    liberar();
    await expect.poll(() => noPrograma(servidor)).toEqual([['PP-01', 'Familiarização no C152'], ['PP-02', 'Navegação']]);
    await expect.poll(() => admin.page.evaluate(async () => {
      const { programaSendoGravado } = await import('./js/eventos/cursos.js');
      return programaSendoGravado();
    })).toBe(false);
    let perguntou = false;
    admin.page.once('dialog', async d => { perguntou = true; await d.dismiss(); });
    await admin.page.close({ runBeforeUnload: true });
    await expect.poll(() => admin.page.isClosed()).toBe(true);
    expect(perguntou, 'com tudo gravado, fecha sem perguntar').toBe(false);
    expect(admin.erros).toEqual([]);
    await admin.contexto.close();
  });

  // O programa em fases (como as tabelas dos cursos o guardam): cada fase com o nome (só leitura), a tabela das missões e
  // o "+ Missão" dela, que inclui no fim da fase, com o código seguinte ao da missão anterior e o tipo de missão, o
  // recurso e as horas dela; os nomes dos campos e a descrição da alteração dizem a fase
  test('o programa em fases: o "+ Missão" de cada fase inclui nela, com o código seguinte ao da anterior', async ({ browser }) => {
    const { f1, f2, m1, m2 } = IDS;
    const { cursos } = gravarCurso({ cursos: cursosIniciais() }, {
      sigla: 'PP', versaoLida: 1, descricao: 'PP: o programa em fases', conteudo: {
        nome: 'Piloto Privado', ativo: true,
        fases: [{ id: f1, nome: 'Fase 1 – Duplo comando' }, { id: f2, nome: 'Fase 2 – Navegação' }],
        missoes: [
          { id: m1, fase: f1, codigo: 'TMA-01', nome: 'Tráfego', mis: 'Voo Local', eq: 'C152', nb: 1 },
          { id: m2, fase: f2, codigo: 'NAV-01', nome: 'Navegação', mis: 'Navegação', eq: 'C152', nb: 2.5 }
        ]
      }
    });
    const servidor = criarSupabaseFalso({ ...documentosAtuais(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' })] }), AMANHA), cursos });
    const admin = await entrar(browser, servidor, CONTAS.administrador);
    const enviadas = [];
    admin.page.on('request', r => { if (r.url().endsWith('/rpc/salvar_curso')) enviadas.push(r.postDataJSON().p_descricao); });
    await irPara(admin.page, 'cur');
    const pp = curso(admin.page, 'PP');
    await expect(pp.locator('h3 small')).toHaveText('Piloto Privado · 2 fases · 2 missões');
    await expect(pp.locator('.fase h4')).toHaveText(['Fase 1 – Duplo comando', 'Fase 2 – Navegação']);
    await expect(pp.locator(`tr[data-missao="${m2}"] [data-cf="codigo"]`)).toHaveAttribute('aria-label', 'Código da 1ª missão da Fase 2');
    await pp.getByRole('button', { name: '+ Missão na Fase 2' }).click();
    const daFase2 = pp.locator(`.fase[data-fase="${f2}"] tbody tr`);
    await expect(daFase2).toHaveCount(2);
    const nova = daFase2.nth(1);
    await expect(nova.locator('[data-cf="codigo"]')).toHaveValue('NAV-02');
    await expect(nova.locator('[data-cf="codigo"]')).toHaveAttribute('aria-label', 'Código da 2ª missão da Fase 2');
    await expect(nova.locator('[data-cf="nome"]')).toBeFocused();
    await expect(nova.locator('[data-cf="mis"]')).toHaveValue('Navegação');
    await expect(nova.locator('[data-cf="nb"]')).toHaveValue('2.5');
    await expect(pp.locator(`.fase[data-fase="${f1}"] tbody tr`)).toHaveCount(1);
    await expect.poll(() => doServidor(servidor).versao).toBe(3);
    const daFase = fase => doServidor(servidor).missoes.filter(m => m.fase === fase && !m.removida).sort((a, b) => a.ordem - b.ordem).map(m => [m.codigo, m.mis, m.eq, m.nb]);
    expect([daFase(f1), daFase(f2)]).toEqual([[['TMA-01', 'Voo Local', 'C152', 1]], [['NAV-01', 'Navegação', 'C152', 2.5], ['NAV-02', 'Navegação', 'C152', 2.5]]]);
    expect(enviadas).toEqual(['PP: NAV-02 incluída na Fase 2']);
    expect(admin.erros).toEqual([]);
    await admin.contexto.close();
  });

  // Outra pessoa gravou o programa depois da leitura: a gravação é recusada (PT409), a tela volta a mostrar o programa
  // gravado, com o aviso, e continua editável (não é um conflito da escala: nada fica travado)
  test('outra pessoa mudou o programa: a alteração é recusada, a tela mostra a versão atual e continua editável', async ({ browser }) => {
    const servidor = servidorComPrograma();
    const primeiro = await entrar(browser, servidor, CONTAS.administrador, { statusEsperados: [409] });
    await irPara(primeiro.page, 'cur');
    await expect(linhas(primeiro.page, 'PP')).toHaveCount(2);
    const outro = await entrar(browser, servidor, CONTAS.administrador);
    await irPara(outro.page, 'cur');
    await linhas(outro.page, 'PP').nth(1).locator('[data-cf="nome"]').fill('Navegação de outra pessoa');
    await linhas(outro.page, 'PP').nth(1).locator('[data-cf="nome"]').press('Tab');
    await expect.poll(() => doServidor(servidor).versao).toBe(3);
    expect(outro.erros).toEqual([]);
    await outro.contexto.close();

    const nome = linhas(primeiro.page, 'PP').nth(0).locator('[data-cf="nome"]');
    await nome.fill('Minha alteração');
    await nome.press('Tab');
    await expect(primeiro.page.locator('#toast-box')).toContainText('Outra pessoa mudou o programa do PP: a tela mostra a versão atual. Refaça a alteração.');
    await expect(linhas(primeiro.page, 'PP').nth(1).locator('[data-cf="nome"]')).toHaveValue('Navegação de outra pessoa');
    await expect(nome).toHaveValue('Familiarização');
    expect(noPrograma(servidor)).toEqual([['PP-01', 'Familiarização'], ['PP-02', 'Navegação de outra pessoa']]);
    // Sem trava: nem o aviso do conflito, e a alteração refeita grava a partir da versão atual
    await expect(primeiro.page.locator('#aviso-sync')).toBeHidden();
    await expect(primeiro.page.locator('#cursos')).toContainText('Só o Administrador muda.');
    await nome.fill('Minha alteração');
    await nome.press('Tab');
    await expect.poll(() => noPrograma(servidor)).toEqual([['PP-01', 'Minha alteração'], ['PP-02', 'Navegação de outra pessoa']]);
    expect(doServidor(servidor).versao).toBe(4);
    expect(servidor.gravacoes).toEqual([]);
    expect(primeiro.erros).toEqual([]);
    await primeiro.contexto.close();
  });

  // Sem os programas, nada é inferido de um programa vazio: o aviso do topo e a aba Cursos dizem por quê, e "Tentar de
  // novo" lê os programas de novo
  comProgresso('sem os programas dos cursos: o aviso, a aba Cursos sem o programa e "Tentar de novo"', async ({ browser }) => {
    const servidor = servidorComPrograma();
    servidor.falhar('/rpc/programa_dos_cursos');
    const admin = await entrar(browser, servidor, CONTAS.administrador, { statusEsperados: [503] });
    const semProgramas = 'Não foi possível ler os programas dos cursos: a próxima missão, o progresso e a missão do curso no agendamento ficam desligados.';
    await expect(admin.page.locator('#aviso-dados-texto')).toHaveText(semProgramas);
    await irPara(admin.page, 'cur');
    await expect(admin.page.locator('#cursos')).toHaveText(semProgramas);
    await expect(admin.page.locator('#cursos [data-act="missao-nova"]')).toHaveCount(0);
    await irPara(admin.page, 'alu');
    await expect(progressoNaLinha(admin.page, 1000)).toHaveCount(0);
    await admin.page.locator('#btn-tentar-dados').click();
    await expect(admin.page.locator('#aviso-dados')).toBeHidden();
    await expect.poll(() => textoDoProgresso(admin.page, 1000)).toBe('0/2 · próxima PP-01');
    await irPara(admin.page, 'cur');
    await expect(linhas(admin.page, 'PP')).toHaveCount(2);
    // Um curso de cada vez: o PP, com o "+ Missão" da fase dele
    await expect(admin.page.locator('#cursos [data-act="missao-nova"]')).toHaveCount(1);
    expect(admin.erros).toEqual([]);
    await admin.contexto.close();
  });

  // A Gestora (ou a Secretaria) que abriu antes da primeira abertura de um Operador vê o aviso dos programas que ainda
  // estão no cadastro. Depois que o Operador abre (e faz a conversão), "Tentar de novo" lê de novo o formato do cadastro
  // e os programas: o aviso sai, e a próxima missão, o progresso e a aba Cursos voltam, sem recarregar e sem gravar nada
  comProgresso('depois da conversão por um Operador, "Tentar de novo" tira o aviso dos programas que esperavam por ela', async ({ browser }) => {
    const estado = ApiClient.normalizeAndMigrateState({ ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' })] }), cursos: PROGRAMA });
    const servidor = criarSupabaseFalso(documentosFase3(estado, AMANHA));
    const gestor = await entrar(browser, servidor, CONTAS.gestor);
    const pendentes = 'Os programas dos cursos ainda não foram trazidos do cadastro (isso acontece na primeira abertura de um Operador ou Administrador depois da atualização): a próxima missão e o progresso ficam desligados.';
    const tentar = gestor.page.locator('#btn-tentar-dados');
    await expect(gestor.page.locator('#aviso-dados-texto')).toHaveText(pendentes);
    // Antes da conversão, o aviso fica
    await tentar.click();
    await expect(tentar).toBeEnabled();
    await expect(gestor.page.locator('#aviso-dados-texto')).toHaveText(pendentes);

    // O Operador abre: a conversão leva o programa para as tabelas, e o cadastro vai para o formato dos cursos
    const operador = await entrar(browser, servidor, CONTAS.operador);
    await expect.poll(() => doServidor(servidor).missoes.length).toBe(2);
    await expect(operador.page.locator('#aviso-dados')).toBeHidden();
    expect(operador.erros).toEqual([]);
    await operador.contexto.close();
    const gravacoes = servidor.gravacoes.length;

    await tentar.click();
    await expect(gestor.page.locator('#aviso-dados')).toBeHidden();
    await irPara(gestor.page, 'alu');
    await expect.poll(() => textoDoProgresso(gestor.page, 1000)).toBe('0/2 · próxima PP-01');
    await irPara(gestor.page, 'cur');
    await expect(linhas(gestor.page, 'PP')).toHaveCount(2);
    expect(servidor.gravacoes).toHaveLength(gravacoes);
    expect(gestor.erros).toEqual([]);
    await gestor.contexto.close();
  });

  // Sem os programas, a lista do curso em Alunos traz os três cursos com que o app começa (o servidor sempre os tem), e o
  // curso do aluno que não é um deles fica, pela sigla: nenhum aluno perde o curso, e a matrícula continua possível
  test('sem os programas dos cursos, o curso em Alunos oferece PP, PC e INVA, e o curso de cada aluno continua', async ({ browser }) => {
    const estado = { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' }), aluno(1001), aluno(1002, {}, { curso: 'MLTE' })] }), cursos: PROGRAMA };
    const servidor = criarSupabaseFalso(documentosAtuais(estado, AMANHA));
    servidor.falhar('/rpc/programa_dos_cursos');
    const operador = await entrar(browser, servidor, CONTAS.operador, { statusEsperados: [503] });
    await expect(operador.page.locator('#aviso-dados')).toBeVisible();
    await irPara(operador.page, 'alu');
    const opcoes = async id => (await campoDoAluno(operador.page, id, 'curso')).locator('option');
    const tres = ['PP · Piloto Privado', 'PC · Piloto Comercial', 'INVA · Instrutor de Voo'];
    await expect(await opcoes(1000)).toHaveText(['—', ...tres]);
    await expect((await campoDoAluno(operador.page, 1000, 'curso'))).toHaveValue('PP');
    await expect(await opcoes(1001)).toHaveText(['—', ...tres]);
    await expect(await opcoes(1002)).toHaveText(['—', ...tres, 'MLTE']);
    await expect((await campoDoAluno(operador.page, 1002, 'curso'))).toHaveValue('MLTE');
    // A matrícula feita sem os programas vale
    await (await campoDoAluno(operador.page, 1001, 'curso')).selectOption('INVA');
    await expect(operador.page.locator('#audit-log-list')).toContainText('Curso de Aluno 1001: INVA');
    // Lidos os programas, a lista é a das tabelas dos cursos: o curso que não existe nelas é dito como tal
    await operador.page.locator('#btn-tentar-dados').click();
    await expect(operador.page.locator('#aviso-dados')).toBeHidden();
    await expect(await opcoes(1002)).toHaveText(['—', ...tres, 'MLTE (curso desconhecido)']);
    await expect((await campoDoAluno(operador.page, 1001, 'curso'))).toHaveValue('INVA');
    expect(operador.erros).toEqual([]);
    await operador.contexto.close();
  });

  // O Operador consulta os cursos; quem grava é o Administrador, e o servidor confere (salvar_curso recusa com 42501)
  test('o Operador só consulta o programa: a gravação de um curso pela API é recusada pelo servidor (42501)', async ({ browser }) => {
    const servidor = servidorComPrograma();
    const operador = await entrar(browser, servidor, CONTAS.operador, { statusEsperados: [403] });
    await irPara(operador.page, 'cur');
    await expect(linhas(operador.page, 'PP')).toHaveCount(2);
    await expect(operador.page.locator('#cursos')).toContainText('Só o Administrador muda; aqui é consulta.');
    await expect(operador.page.locator('#cursos [data-act="missao-nova"]')).toHaveCount(0);
    await expect(linhas(operador.page, 'PP').nth(0).locator('td.c-nome')).toHaveText('Familiarização');
    // Só "Mostrar encerrados" fica para quem consulta (e os botões dos cursos): nenhum campo do programa nem o curso novo
    await expect(operador.page.locator('#cursos :is(input, select):not(.flt-ctrl), #cur-novo, #form-curso')).toHaveCount(0);
    const recusa = await operador.page.evaluate(async () => {
      const { ApiClient } = await import('./js/storage.js');
      const pp = (await ApiClient.lerProgramas()).find(c => c.sigla === 'PP');
      return ApiClient.salvarCurso('PP', pp.versao, { nome: pp.nome, ativo: true, fases: [], missoes: [] }, 'PP: tentativa do Operador')
        .then(() => null, e => ({ code: e.code, campo: e.campo }));
    });
    expect(recusa).toEqual({ code: '42501', campo: null });
    expect([doServidor(servidor).versao, noPrograma(servidor).length]).toEqual([2, 2]);
    expect(operador.erros).toEqual([]);
    await operador.contexto.close();
  });

  // O curso novo vai para as tabelas dos cursos pela gravação do curso inteiro, a partir da versão 0 (que o cria); o
  // encerrado também é só uma gravação do curso. O cadastro, o dia e o histórico da data não mudam
  test('o Administrador cria um curso com o cronograma do PP e o encerra: só as tabelas dos cursos gravam; quem abre depois vê', async ({ browser }) => {
    const servidor = servidorComPrograma();
    const admin = await entrar(browser, servidor, CONTAS.administrador);
    const enviadas = [];
    admin.page.on('request', r => { if (r.url().endsWith('/rpc/salvar_curso')) enviadas.push(r.postDataJSON()); });
    await irPara(admin.page, 'cur');
    await admin.page.locator('#cur-novo').click();
    await admin.page.locator('#cur-sigla').fill('pp-b');
    await admin.page.locator('#cur-nome').fill('Piloto Privado (turma B)');
    await admin.page.locator('#form-curso [name="cur-comeco"][value="pp-acpm"]').check();
    await admin.page.getByRole('button', { name: 'Criar o curso' }).click();
    const ppb = curso(admin.page, 'PP-B');
    await expect(ppb.locator('h3 small')).toHaveText('Piloto Privado (turma B) · 9 fases · 46 missões (1 dispensada)');
    await expect(ppb.locator('[data-cc="nome"]')).toBeFocused();
    await expect.poll(() => doServidor(servidor, 'PP-B') && doServidor(servidor, 'PP-B').versao).toBe(1);
    await confirmar(admin.page, '#cursos .curso[data-curso="PP-B"] [data-act="curso-encerrar"]');
    await expect.poll(() => doServidor(servidor, 'PP-B').ativo).toBe(false);
    expect(enviadas.map(g => [g.p_sigla, g.p_versao_lida, g.p_descricao])).toEqual([
      ['PP-B', 0, 'Curso PP-B criado: Piloto Privado (turma B) (com o cronograma P.I PPA 001A)'], ['PP-B', 1, 'PP-B encerrado']
    ]);
    const daB = doServidor(servidor, 'PP-B');
    expect([daB.ordem, daB.fases.length, daB.missoes.length, daB.missoes.filter(m => m.trecho).map(m => [m.codigo, m.trecho])])
      .toEqual([3, 9, 47, [['TSL-01', 'ida'], ['NOT', 'noite'], ['TSL-02', 'volta']]]);
    expect(servidor.gravacoes).toEqual([]);
    expect(servidor.historico).toEqual([]);
    expect(admin.erros).toEqual([]);
    await admin.contexto.close();

    // O Gestor vê o curso encerrado só com "Mostrar encerrados", em texto: um curso de cada vez, escolhido no alto (os
    // botões dos cursos valem para quem só consulta)
    const gestor = await entrar(browser, servidor, CONTAS.gestor);
    await irPara(gestor.page, 'cur');
    await expect(gestor.page.locator('#cursos .curso')).toHaveCount(1);
    await expect(gestor.page.locator('#cursos .seg-dos-cursos button')).toHaveText(['PP · Piloto Privado', 'PC · Piloto Comercial', 'INVA · Instrutor de Voo']);
    await gestor.page.locator('#cur-encerrados').check();
    await expect(gestor.page.locator('#cursos .seg-dos-cursos button')).toHaveText(['PP · Piloto Privado', 'PC · Piloto Comercial', 'INVA · Instrutor de Voo', 'PP-B · Piloto Privado (turma B) (encerrado)']);
    await expect(curso(gestor.page, 'PP')).toBeVisible();
    await gestor.page.locator('#cur-ver-PP-B').click();
    await expect(gestor.page.locator('#cur-ver-PP-B')).toHaveAttribute('aria-pressed', 'true');
    await expect(gestor.page.locator('#cursos .curso')).toHaveCount(1);
    await expect(curso(gestor.page, 'PP-B').locator('h3')).toHaveText('PP-B Piloto Privado (turma B) · 9 fases · 46 missões (1 dispensada) encerrado');
    await expect(curso(gestor.page, 'PP-B').locator('input, select, [data-act]')).toHaveCount(0);
    await expect(curso(gestor.page, 'PP-B').locator('tr[data-missao] td.c-mis', { hasText: 'Noturno' })).toHaveText(['Noturno · ida', 'Noturno · noite', 'Noturno · volta']);
    expect(gestor.erros).toEqual([]);
    await gestor.contexto.close();
  });

  // O curso novo que o servidor não cria: com a sigla que outra pessoa criou antes (PT409, sigla), a tela mostra o curso
  // dela; com a gravação que falha, o curso sai da tela, e o foco que estava nele vai para "+ Novo curso"
  test('o curso novo que não foi criado: a sigla que outra pessoa criou antes e a gravação que falha', async ({ browser }) => {
    const servidor = servidorComPrograma();
    const criar = async (page, sigla, nome) => {
      await page.locator('#cur-novo').click();
      await page.locator('#cur-sigla').fill(sigla);
      await page.locator('#cur-nome').fill(nome);
      await page.getByRole('button', { name: 'Criar o curso' }).click();
    };
    const admin = await entrar(browser, servidor, CONTAS.administrador, { statusEsperados: [409, 503] });
    await irPara(admin.page, 'cur');
    // Outra pessoa cria o MLTE depois que esta tela leu os cursos
    const outro = await entrar(browser, servidor, CONTAS.administrador);
    await irPara(outro.page, 'cur');
    await criar(outro.page, 'MLTE', 'Multimotor');
    await expect.poll(() => doServidor(servidor, 'MLTE') && doServidor(servidor, 'MLTE').versao).toBe(1);
    expect(outro.erros).toEqual([]);
    await outro.contexto.close();
    await criar(admin.page, 'mlte', 'Multimotor IFR');
    await expect(admin.page.locator('#toast-box')).toContainText('Outra pessoa já criou o curso MLTE: a tela mostra os cursos como estão.');
    await expect(curso(admin.page, 'MLTE').locator('h3 small')).toHaveText('Multimotor · 0 missões');
    expect([doServidor(servidor, 'MLTE').nome, doServidor(servidor, 'MLTE').versao]).toEqual(['Multimotor', 1]);

    // A gravação que falha: o curso novo sai da tela e dos botões dos cursos, e a tela fica com o primeiro ativo
    servidor.falhar('/rpc/salvar_curso');
    await criar(admin.page, 'PC-IFR', 'Piloto Comercial IFR');
    await expect(admin.page.locator('#toast-box')).toContainText('Sem conexão: a alteração do programa não foi gravada.');
    await expect(curso(admin.page, 'PC-IFR')).toHaveCount(0);
    await expect(admin.page.locator('#cur-ver-PC-IFR')).toHaveCount(0);
    await expect(admin.page.locator('#cur-ver-PP')).toHaveAttribute('aria-pressed', 'true');
    await expect(curso(admin.page, 'PP')).toBeVisible();
    await expect(admin.page.locator('#cur-novo')).toBeFocused();
    expect(doServidor(servidor, 'PC-IFR')).toBeUndefined();
    // De novo, agora gravado
    await criar(admin.page, 'PC-IFR', 'Piloto Comercial IFR');
    await expect.poll(() => doServidor(servidor, 'PC-IFR') && doServidor(servidor, 'PC-IFR').versao).toBe(1);
    await expect(curso(admin.page, 'PC-IFR').getByRole('button', { name: '+ Fase' })).toBeFocused();
    expect(admin.erros).toEqual([]);
    await admin.contexto.close();
  });

  // Sem os resultados (a leitura falhou), a fase de cada aluno não se conhece: os alunos do curso vêm pelo nome, e o índice
  // das fases, sem as contas; "Tentar de novo" lê os resultados, e os alunos vão para as fases
  comProgresso('sem os resultados, os alunos do curso vêm pelo nome e o índice das fases, sem as contas', async ({ browser }) => {
    const { f1, f2, m1, m2 } = IDS;
    const { cursos } = gravarCurso({ cursos: cursosIniciais() }, {
      sigla: 'PP', versaoLida: 1, descricao: 'PP: o programa em fases', conteudo: {
        nome: 'Piloto Privado', ativo: true,
        fases: [{ id: f1, nome: 'Fase 1 – Duplo comando' }, { id: f2, nome: 'Fase 2 – Navegação' }],
        missoes: [
          { id: m1, fase: f1, codigo: 'TMA-01', nome: 'Tráfego', mis: 'Voo Local', eq: 'C152', nb: 1 },
          { id: m2, fase: f2, codigo: 'NAV-01', nome: 'Navegação', mis: 'Navegação', eq: 'C152', nb: 2.5 }
        ]
      }
    });
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { nm: 'Bia', curso: 'PP' }), aluno(1001, {}, { nm: 'Ana', curso: 'PP' })] });
    const servidor = criarSupabaseFalso({ ...documentosAtuais(estado, AMANHA), cursos });
    servidor.falhar('/rpc/situacao_das_missoes');
    const gestor = await entrar(browser, servidor, CONTAS.gestor, { statusEsperados: [503] });
    await irPara(gestor.page, 'cur');
    const pp = curso(gestor.page, 'PP'), alunos = pp.locator('details.alunos-do-curso');
    await alunos.locator('summary').click();
    await expect(alunos.locator('.turma-da-fase')).toHaveCount(0);
    await expect(alunos.locator('li')).toHaveText(['Ana', 'Bia']);
    await expect(pp.locator('.indice-das-fases li')).toHaveText(['Fase 1 – Duplo comando', 'Fase 2 – Navegação']);
    await gestor.page.locator('#btn-tentar-dados').click();
    await expect(gestor.page.locator('#aviso-dados')).toBeHidden();
    await expect(alunos.locator('.turma-da-fase')).toHaveText(['Fase 1 – Duplo comando (2)']);
    await expect(alunos.locator('li')).toHaveText(['Ana · 0/2 · Fase 1 · próxima TMA-01', 'Bia · 0/2 · Fase 1 · próxima TMA-01']);
    await expect(pp.locator('.indice-das-fases li')).toHaveText(['Fase 1 – Duplo comando 2 alunos', 'Fase 2 – Navegação']);
    expect(gestor.erros).toEqual([]);
    await gestor.contexto.close();
  });

  // A aba aberta enquanto os dados carregam é refeita quando eles chegam: a Secretaria, que consulta os cursos, fica na
  // aba e vê o programa, não a aba vazia de antes da leitura
  test('a aba Cursos aberta enquanto os dados carregavam mostra o programa quando eles chegam', async ({ browser }) => {
    const estado = { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' })] }), cursos: PROGRAMA };
    const servidor = criarSupabaseFalso(documentosAtuais(estado, AMANHA));
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    await servidor.instalar(contexto);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    const liberar = servidor.segurarLeiturasDeDias();
    await page.goto(URL_APP);
    await preencherLogin(page, CONTAS.secretaria);
    await expect(page.locator('#usuario')).toBeVisible();
    // Antes dos dados, a aba ainda não tem programa nenhum
    await irPara(page, 'cur');
    await expect(page.locator('#cursos .curso')).toHaveCount(0);
    liberar();
    await expect(page.locator('body[data-pronto]')).toBeAttached();
    await expect(page.locator('#s-cur')).toBeVisible();
    await expect(linhas(page, 'PP')).toHaveCount(2);
    // A Secretaria lê o programa em texto, sem campos
    await expect(linhas(page, 'PP').nth(0).locator('td')).toHaveText(['1', 'PP-01', 'Familiarização', 'Voo Local', 'C152', '1 h', 'Depois das anteriores', '']);
    await expect(page.locator('#cursos :is(input, select):not(.flt-ctrl), #cur-novo, #form-curso')).toHaveCount(0);
    await expect(page.locator('#cursos')).toContainText('Só o Administrador muda; aqui é consulta.');
    // Ela recolhe a fase e troca de curso (o que só muda o que se vê não é uma ação: vale para quem só consulta)
    await page.locator('#cursos [data-recolher-fase]').click();
    await expect(linhas(page, 'PP').nth(0)).toBeHidden();
    await page.locator('#cur-ver-PC').click();
    await expect(curso(page, 'PC')).toBeVisible();
    await expect(curso(page, 'PP')).toHaveCount(0);
    expect(servidor.gravacoes).toEqual([]);
    expect(erros).toEqual([]);
    await contexto.close();
  });
});

// As fases, os módulos e quando voar: o programa em fases (como as tabelas dos cursos o guardam) gravado neste navegador,
// com o cadastro e o dia no formato atual (sem a conversão do cadastro)
test.describe('Cursos: fases, módulos e quando voar', () => {
  const u = n => `00000000-0000-4000-8013-${String(n).padStart(12, '0')}`;
  const [F4, F5, F7, F8, F6, F9] = [4, 5, 7, 8, 6, 9].map(u);
  const M = { tma05: u(101), pe03: u(102), pe04: u(103), adapt: u(104), endSolo: u(105), navSolo: u(106), not: u(107), avx: u(108) };
  const M01 = 'Módulo 01 – Duplo Comando', M02 = 'Módulo 02 – Voo Solo', M03 = 'Módulo 03 – Avaliação';
  const missao = (id, fase, codigo, nome, mis = 'Voo Local', eq = 'C152', nb = 1, extra = {}) => ({ id, fase, codigo, nome, mis, eq, nb, ...extra });
  // O cronograma do PP, resumido (uma ou duas missões de cada fase), com as fases na ordem impressa (a 6, do noturno,
  // depois da 8) e sem as exceções, que o Administrador monta
  const CRONOGRAMA = {
    nome: 'Piloto Privado', ativo: true,
    fases: [
      { id: F4, nome: 'Fase 4 – Manobras e Aproximações', modulo: M01 }, { id: F5, nome: 'Fase 5 – Procedimentos de Emergência', modulo: M01 },
      { id: F7, nome: 'Fase 7 – Voo Solo', modulo: M02 }, { id: F8, nome: 'Fase 8 – Navegação Solo', modulo: M02 },
      { id: F6, nome: 'Fase 6 – Voo Noturno', modulo: M02 }, { id: F9, nome: 'Fase 9 – Voo de Cheque', modulo: M03 }
    ],
    missoes: [
      missao(M.tma05, F4, 'TMA-05', 'TMA-05', 'Voo Local', 'C152', 1, { avaliacao: true }),
      missao(M.pe03, F5, 'PE-03', 'PE-03'), missao(M.pe04, F5, 'PE-04', 'PE-04 – SPIN', 'Parafuso'),
      missao(M.adapt, F7, 'ADAPT-C152', 'ADAPTAÇÃO AO CESSNA 152'), missao(M.endSolo, F7, 'END-SOLO', 'ENDOSSO SOLO LOCAL'),
      missao(M.navSolo, F8, 'NAV-SOLO-01', 'NAV SOLO 01', 'Voo Solo'),
      missao(M.not, F6, 'NOT', 'NOT', 'Noturno', 'C172', 3),
      missao(M.avx, F9, 'AVX-CQ', 'AVX ENDOSSO CQ', 'Navegação', 'C152', 2)
    ]
  };
  const comMudancas = (conteudo, fases = {}, missoes = {}) => ({
    ...conteudo, fases: conteudo.fases.map(f => ({ ...f, ...fases[f.id] })), missoes: conteudo.missoes.map(m => ({ ...m, ...missoes[m.id] }))
  });
  // O PP como as tabelas dos cursos o guardam (versão 2)
  const ppGuardado = conteudo => gravarCurso({ cursos: cursosIniciais() }, { sigla: 'PP', versaoLida: 1, conteudo, descricao: 'PP: cronograma' }).cursos;
  const aprovadas = (aluno, codigos, primeiro) => codigos.map((missao, i) => ({
    id: primeiro + i, aluno, curso: 'PP', missao, resultado: 'aprovado', data: '2026-11-05', voo: null, registrado_em: '2026-11-05T12:00:00.000Z', registrado_por: 'Operador'
  }));
  const alunos = () => cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { fly: false }, { curso: 'PP' }), aluno(1001, { fly: false }, { curso: 'PP' })] });

  async function abrirComPrograma(page, { conteudo, resultados = [], url = './', estado = alunos() }) {
    const { documentos: { cadastro }, dias } = documentosAtuais(estado, AMANHA);
    const docs = { acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_cursos: { cursos: ppGuardado(conteudo), alteracoes: [] }, acpm4_resultados: resultados };
    await page.addInitScript(json => {
      if (localStorage.getItem('acpm4_cadastro')) return;
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify(docs));
    await page.goto(url);
    await appPronto(page);
  }
  const descricoesGuardadas = async page => (await programaGuardado(page)).alteracoes.map(a => a.descricao);
  const proxima = (page, id) => page.locator(`#dem tr[data-id="${id}"][data-mid="0"] [data-act="usar-proxima"]`);
  async function naDemanda(page) {
    await irPara(page, 'dem');
    await page.locator('#onlyfly').uncheck();
  }

  // As exceções do PP são dados do programa: o SPIN livre na Fase 5, a Fase 6 (impressa depois da 8) depois da Fase 4 e
  // a ADAPTAÇÃO dispensada. A próxima missão da Demanda (a primeira liberada, na ordem do programa) as segue
  comProgresso('o Administrador monta as exceções do PP, e a próxima missão da Demanda as segue', async ({ page }) => {
    const resultados = [...aprovadas(1000, ['TMA-05', 'PE-03', 'PE-04'], 1), ...aprovadas(1001, ['TMA-05', 'PE-03', 'PE-04', 'END-SOLO', 'NAV-SOLO-01'], 10)];
    await abrirComPrograma(page, { conteudo: CRONOGRAMA, resultados });
    await naDemanda(page);
    await expect(proxima(page, 1000)).toHaveText('Próxima: ADAPT-C152 · Usar');
    await expect(proxima(page, 1001)).toHaveText('Próxima: ADAPT-C152 · Usar');

    await irPara(page, 'cur');
    const pp = curso(page, 'PP');
    await expect(pp.locator('h3 small')).toHaveText('Piloto Privado · 6 fases · 8 missões');
    // As fases seguidas do mesmo módulo, sob um título só
    await expect(pp.locator('h4.modulo')).toHaveText([M01, M02, M03]);
    await expect(pp.locator('.fase-cab h5')).toHaveText(CRONOGRAMA.fases.map(f => f.nome));

    await pp.locator(`tr[data-missao="${M.pe04}"] [data-cf="regra"]`).selectOption('livre');
    // "Depois de…" começa com a fase logo antes (a 8) e abre a escolha, só das fases anteriores
    const f6 = pp.locator(`.fase[data-fase="${F6}"]`);
    await f6.locator('[data-cfa="regra"]').selectOption('depois');
    const requisitos = f6.locator('details.requisitos');
    await expect(requisitos.locator('summary')).toHaveText('Depois de: Fase 8');
    await expect(requisitos).toHaveAttribute('open', '');
    await expect(requisitos.locator('label')).toHaveText(['Fase 4', 'Fase 5', 'Fase 7', 'Fase 8']);
    await requisitos.locator(`[data-cfa="requer"][value="${F4}"]`).click();
    await expect(requisitos.locator('summary')).toHaveText('Depois de: Fase 4 e Fase 8');
    await expect(requisitos.locator(`[data-cfa="requer"][value="${F4}"]`)).toBeFocused();
    await requisitos.locator(`[data-cfa="requer"][value="${F8}"]`).click();
    await expect(requisitos.locator('summary')).toHaveText('Depois de: Fase 4');
    // A última da lista não sai: sem nenhuma, a regra seria outra
    await requisitos.locator(`[data-cfa="requer"][value="${F4}"]`).click();
    await expect(page.locator('#toast-box')).toContainText('A Fase 6 espera pelo menos uma fase: para não esperar nenhuma, escolha “Desde o início do curso”.');
    await expect(requisitos.locator(`[data-cfa="requer"][value="${F4}"]`)).toBeChecked();
    await pp.locator(`tr[data-missao="${M.adapt}"] [data-cf="dispensada"]`).click();
    await expect(pp.locator(`tr[data-missao="${M.adapt}"] [data-cf="dispensada"]`)).toBeChecked();
    await expect(pp.locator('h3 small')).toHaveText('Piloto Privado · 6 fases · 7 missões (1 dispensada)');

    // Cada alteração grava o curso, com a descrição; a lista das alterações, a mais recente primeiro
    const descricoes = ['PP: PE-04 livre na fase', 'PP: Fase 6 depois de Fase 8', 'PP: Fase 6 depois de Fase 4 e Fase 8', 'PP: Fase 6 depois de Fase 4', 'PP: ADAPT-C152 dispensada'];
    await expect.poll(() => descricoesGuardadas(page)).toEqual(descricoes);
    const guardado = (await programaGuardado(page)).cursos.find(c => c.sigla === 'PP');
    const doGuardado = id => [...guardado.fases, ...guardado.missoes].find(x => x.id === id);
    expect([doGuardado(M.pe04).regra, doGuardado(F6).regra, doGuardado(F6).requer, doGuardado(M.adapt).dispensada]).toEqual(['livre', 'depois', [F4], true]);
    const alteracoes = pp.locator('details.alteracoes');
    await alteracoes.locator('summary').click();
    await expect(alteracoes.locator('li')).toHaveText(descricoes.map(d => `[10/11 12:00] ${d}`).reverse());

    // A ADAPTAÇÃO dispensada não é mais a próxima; quem fez as Fases 7 e 8 vai para o noturno
    await naDemanda(page);
    await expect(proxima(page, 1000)).toHaveText('Próxima: END-SOLO · Usar');
    await expect(proxima(page, 1001)).toHaveText('Próxima: NOT · Usar');

    await page.reload();
    await irPara(page, 'cur');
    await expect(pp.locator(`tr[data-missao="${M.pe04}"] [data-cf="regra"]`)).toHaveValue('livre');
    await expect(f6.locator('[data-cfa="regra"]')).toHaveValue('depois');
    await expect(f6.locator('details.requisitos summary')).toHaveText('Depois de: Fase 4');
    await expect(pp.locator(`tr[data-missao="${M.adapt}"] [data-cf="dispensada"]`)).toBeChecked();
  });

  // Para o Gestor (e a Secretaria, abaixo, no modo compartilhado), o programa é texto, sem paredes de campos desligados
  test('para quem só consulta, o programa é texto: quando a fase abre, quando voar e as marcas', async ({ page }) => {
    const conteudo = comMudancas(CRONOGRAMA, { [F6]: { regra: 'depois', requer: [F4] } },
      { [M.pe04]: { regra: 'livre' }, [M.adapt]: { dispensada: true }, [M.not]: { regra: 'depois', requer: [M.tma05] } });
    await abrirComPrograma(page, { conteudo, url: './?role=gestor' });
    await irPara(page, 'cur');
    const pp = curso(page, 'PP');
    await expect(page.locator('#cursos')).toContainText('Só o Administrador muda; aqui é consulta.');
    await expect(pp.locator('input, select')).toHaveCount(0);
    await expect(pp.locator('[data-act]')).toHaveCount(0);
    await expect(pp.locator('h4.modulo')).toHaveText([M01, M02, M03]);
    await expect(pp.locator(`.fase[data-fase="${F6}"] h5`)).toHaveText('Fase 6 – Voo Noturno');
    await expect(pp.locator('p.regra')).toHaveText(['Abre depois da Fase 4']);
    const quando = id => pp.locator(`tr[data-missao="${id}"] td.c-quando`);
    await expect(quando(M.pe03)).toHaveText('Depois das anteriores');
    await expect(quando(M.pe04)).toHaveText('Livre na fase');
    await expect(quando(M.not)).toHaveText('Depois de TMA-05');
    await expect(pp.locator(`tr[data-missao="${M.adapt}"] td.c-marcas`)).toHaveText('dispensada');
    await expect(pp.locator(`tr[data-missao="${M.tma05}"] td.c-marcas`)).toHaveText('AVAL');
    await expect(pp.locator(`tr[data-missao="${M.not}"] td`)).toHaveText(['1', 'NOT', 'NOT', 'Noturno', 'C172', '3 h', 'Depois de TMA-05', '']);
  });

  // "Voltar ao programa" devolve a missão ao lugar dela, com a regra. O servidor guarda a missão retirada sem a lista
  // "depois de…" (o adendo do desenho, §6): lido de novo o programa, ela volta "depois das anteriores", com o aviso
  test('tirar e voltar ao programa: no mesmo lugar e com a regra; lido de novo, o "depois de…" volta com o aviso', async ({ page }) => {
    const [F1, F2, IN01, IN02, CT01, CT02] = [1, 2, 201, 202, 203, 204].map(u);
    const conteudo = {
      nome: 'Piloto Privado', ativo: true,
      fases: [{ id: F1, nome: 'Fase 1 – Introdução ao Voo' }, { id: F2, nome: 'Fase 2 – O Controle da Aeronave' }],
      missoes: [missao(IN01, F1, 'IN-01', 'IN-01'), missao(IN02, F1, 'IN-02', 'IN-02'), missao(CT01, F2, 'CT-01', 'CT-01', 'Voo Local', 'C152', 1, { regra: 'depois', requer: [IN01] }),
        missao(CT02, F2, 'CT-02', 'CT-02')]
    };
    await abrirComPrograma(page, { conteudo });
    await irPara(page, 'cur');
    const pp = curso(page, 'PP'), ct01 = pp.locator(`tr[data-missao="${CT01}"]`);
    const retirar = () => confirmar(page, `#cursos tr[data-missao="${CT01}"] [data-act="missao-retirar"]`);
    await expect(ct01.locator('details.requisitos summary')).toHaveText('Depois de: IN-01');
    await retirar();
    await expect(ct01).toHaveCount(0);
    const retiradas = pp.locator('details.retiradas');
    await retiradas.locator('summary').click();
    await expect(retiradas.locator('summary')).toHaveText('Retiradas (1)');
    await expect(retiradas.locator('li')).toHaveText(['CT-01 · Fase 2 Voltar ao programa']);
    // De volta: o 1º lugar da Fase 2, ainda depois da IN-01, com o foco no código
    await retiradas.getByRole('button', { name: 'Voltar ao programa: CT-01' }).click();
    await expect(pp.locator('details.retiradas')).toHaveCount(0);
    await expect(pp.locator(`.fase[data-fase="${F2}"] tbody tr`).first()).toHaveAttribute('data-missao', CT01);
    await expect(ct01.locator('[data-cf="codigo"]')).toBeFocused();
    await expect(ct01.locator('[data-cf="regra"]')).toHaveValue('depois');
    await expect(ct01.locator('details.requisitos summary')).toHaveText('Depois de: IN-01');

    // Tirada de novo e lida de novo (recarregada): a lista não ficou guardada
    await retirar();
    await expect.poll(() => descricoesGuardadas(page)).toEqual(['PP: CT-01 tirada do programa', 'PP: CT-01 de volta ao programa', 'PP: CT-01 tirada do programa']);
    await page.reload();
    await irPara(page, 'cur');
    await pp.locator('details.retiradas summary').click();
    await pp.getByRole('button', { name: 'Voltar ao programa: CT-01' }).click();
    await expect(page.locator('#toast-box')).toContainText('A missão CT-01 voltou “depois das anteriores”: a lista “Depois de…” não fica guardada fora do programa. Escolha de novo em “Quando voar”.');
    await expect(ct01.locator('[data-cf="regra"]')).toHaveValue('ordem');
    await expect(ct01.locator('details.requisitos')).toHaveCount(0);

    // A fase só sai sem missões. "+ Fase" entra no fim, com o nome em foco; tirada e de volta, ela fica no lugar
    await expect(pp.locator(`.fase[data-fase="${F2}"] [data-act="fase-retirar"]`)).toBeDisabled();
    await pp.getByRole('button', { name: '+ Fase' }).click();
    const nova = pp.locator('.fase').nth(2);
    await expect(nova.locator('[data-cfa="nome"]')).toBeFocused();
    await expect(nova.locator('[data-cfa="nome"]')).toHaveValue('Fase 3');
    await page.keyboard.type('Fase 3 – Revisão');
    await page.keyboard.press('Tab');
    await expect(nova.locator('[data-cfa="nome"]')).toHaveValue('Fase 3 – Revisão');
    await expect(nova.locator('[data-cfa="modulo"]')).toBeFocused();
    await nova.locator('[data-cfa="modulo"]').fill('Módulo 02 – Revisão');
    await nova.locator('[data-cfa="modulo"]').press('Enter');
    await expect(pp.locator('h4.modulo')).toHaveText(['Módulo 02 – Revisão']);
    await expect(pp.locator('.fase-cab h5')).toHaveText(['Fase 3 – Revisão']);
    await confirmar(page, `#cursos .fase[data-fase="${await nova.getAttribute('data-fase')}"] [data-act="fase-retirar"]`);
    await expect(pp.locator('.fase')).toHaveCount(2);
    await pp.locator('details.retiradas summary').click();
    await expect(pp.locator('details.retiradas li')).toHaveText(['Fase 3 – Revisão Voltar ao programa']);
    await pp.getByRole('button', { name: 'Voltar ao programa: Fase 3' }).click();
    await expect(pp.locator('.fase')).toHaveCount(3);
    await expect(pp.locator('.fase').nth(2).locator('[data-cfa="nome"]')).toBeFocused();
    await expect.poll(() => descricoesGuardadas(page)).toEqual([
      'PP: CT-01 tirada do programa', 'PP: CT-01 de volta ao programa', 'PP: CT-01 tirada do programa', 'PP: CT-01 de volta ao programa',
      'PP: Fase 3 incluída', 'PP: Fase 3 alterada', 'PP: Fase 3 alterada', 'PP: Fase 3 tirada do programa', 'PP: Fase 3 de volta ao programa'
    ]);
  });

  // A ordem que poria uma fase ou uma missão antes do que ela espera não muda nada e diz por quê; a missão vai para o fim
  // de outra fase pela lista ao lado do ✕
  test('subir ou mudar de fase o que ficaria antes do que espera é recusado, com o motivo', async ({ page }) => {
    const [TSL01] = [301].map(u);
    const conteudo = {
      nome: 'Piloto Privado', ativo: true,
      fases: [{ id: F4, nome: 'Fase 4 – Manobras e Aproximações' }, { id: F6, nome: 'Fase 6 – Voo Noturno', regra: 'depois', requer: [F4] }],
      missoes: [missao(M.tma05, F4, 'TMA-05', 'TMA-05'), missao(TSL01, F6, 'TSL-01', 'TSL-01', 'Navegação', 'C172', 1),
        missao(M.not, F6, 'NOT', 'NOT', 'Noturno', 'C172', 3, { regra: 'depois', requer: [TSL01] })]
    };
    await abrirComPrograma(page, { conteudo });
    await irPara(page, 'cur');
    const pp = curso(page, 'PP'), toast = page.locator('#toast-box');
    await pp.getByRole('button', { name: 'Subir a Fase 6' }).click();
    await expect(toast).toContainText('A Fase 6 abre depois da Fase 4: ela não pode passar para antes dela.');
    await pp.getByRole('button', { name: 'Descer a Fase 4' }).click();
    await expect(toast).toContainText('A Fase 6 abre depois da Fase 4: a Fase 4 não pode passar para depois dela.');
    await pp.getByRole('button', { name: 'Subir NOT' }).click();
    await expect(toast).toContainText('A missão NOT voa depois da TSL-01: ela não pode passar para antes dela.');
    // O mesmo motivo pela lista da fase: sem o aviso de antes na tela, o aviso é desta recusa
    await page.evaluate(() => document.querySelector('#toast-box').replaceChildren());
    await pp.locator(`tr[data-missao="${M.not}"] [data-cf="fase"]`).selectOption(F4);
    await expect(toast).toContainText('A missão NOT voa depois da TSL-01: ela não pode passar para antes dela.');
    await expect(pp.locator(`tr[data-missao="${M.not}"] [data-cf="fase"]`)).toHaveValue(F6);
    await expect(pp.locator('.fase').first()).toHaveAttribute('data-fase', F4);
    expect(await descricoesGuardadas(page)).toEqual([]);
    // A TSL-01 pode ir para a Fase 4 (fica antes da NOT): vai para o fim dela, e o foco a acompanha
    await pp.locator(`tr[data-missao="${TSL01}"] [data-cf="fase"]`).selectOption(F4);
    await expect(pp.locator(`.fase[data-fase="${F4}"] tbody tr`)).toHaveCount(2);
    await expect(pp.locator(`.fase[data-fase="${F4}"] tbody tr`).nth(1)).toHaveAttribute('data-missao', TSL01);
    await expect(pp.locator(`tr[data-missao="${TSL01}"] [data-cf="fase"]`)).toBeFocused();
    await expect.poll(() => descricoesGuardadas(page)).toEqual(['PP: TSL-01 passou para a Fase 4']);
  });

  // O código é o que os resultados e os pedidos guardam: o resultado do voo vai para o código do pedido. Com a Demanda da
  // data aberta levando o código (o pedido principal ou um extra, no curso da missão do pedido, senão no do aluno), ele
  // não muda (o nome muda), como com resultados. O código sem missão que os resultados ou a Demanda ainda levam (o que
  // saiu de uma missão com o pedido de outra data nele, por exemplo) não vai para outra missão: digitado, é recusado, e o
  // "+ Missão" o pula. A troca que vale diz o código de antes nas alterações do programa
  test('o código que a Demanda leva não muda; o que, sem missão, os resultados ou a Demanda levam não vai para outra missão', async ({ page }) => {
    const estado = cenario({
      ins: [instrutor(1, 9)],
      stu: [
        aluno(1000, { etapa: 'PE-03' }, { nm: 'Maria', curso: 'PP' }),
        aluno(1001, { fly: false, etapa: 'TMA-06', cursoDaEtapa: 'PP', extra: [missaoExtra(1, { fly: false, etapa: 'END-SOLO', cursoDaEtapa: 'PP' })] }, { nm: 'João', curso: 'PP' }),
        // A PE-04 do PC não é a do PP
        aluno(1002, { fly: false, etapa: 'PE-04', cursoDaEtapa: 'PC' }, { nm: 'Ana', curso: 'PC' })
      ]
    });
    // Um resultado na PE-05, que nenhuma missão do PP tem
    await abrirComPrograma(page, { conteudo: CRONOGRAMA, resultados: aprovadas(1000, ['PE-05'], 1), estado });
    await irPara(page, 'cur');
    const pp = curso(page, 'PP'), toast = page.locator('#toast-box');
    const codigo = id => pp.locator(`tr[data-missao="${id}"] [data-cf="codigo"]`);
    const naDemanda = nomes => `Este código está na Demanda de amanhã (${nomes}): ele não muda enquanto um pedido o leva (o nome muda)`;
    // Travados, com o cadeado e o motivo: a PE-03 (o pedido da Maria, que está na escala) e a END-SOLO (o extra do João)
    for (const [id, nomes] of [[M.pe03, 'Maria'], [M.endSolo, 'João']]) {
      await expect(codigo(id)).toHaveAttribute('readonly', '');
      await expect(codigo(id)).toHaveAttribute('title', naDemanda(nomes));
      await expect(pp.locator(`tr[data-missao="${id}"] td.c-codigo svg`)).toHaveAttribute('aria-label', naDemanda(nomes));
    }
    for (const id of [M.pe04, M.tma05]) await expect(codigo(id)).not.toHaveAttribute('readonly');
    // O nome muda
    await pp.locator(`tr[data-missao="${M.pe03}"] [data-cf="nome"]`).fill('PE-03 – Emergências');
    await pp.locator(`tr[data-missao="${M.pe03}"] [data-cf="nome"]`).press('Tab');
    await expect.poll(() => descricoesGuardadas(page)).toEqual(['PP: PE-03 alterada']);
    // A tela que ainda mostrava o campo livre (antes de o pedido chegar): a troca é recusada do mesmo jeito
    await codigo(M.pe03).evaluate(el => el.removeAttribute('readonly'));
    await codigo(M.pe03).fill('PE-3A');
    await codigo(M.pe03).press('Tab');
    await expect(toast).toContainText('O código PE-03 está na Demanda de amanhã (Maria): ele não muda enquanto um pedido o leva (o nome muda).');
    await expect(codigo(M.pe03)).toHaveValue('PE-03');
    await expect(codigo(M.pe03)).toHaveAttribute('readonly', '');

    // O "+ Missão" pula a PE-05 (com o resultado) e a TMA-06 (no pedido do João): o próximo número livre do curso
    await pp.getByRole('button', { name: '+ Missão na Fase 5' }).click();
    await expect(pp.locator(`.fase[data-fase="${F5}"] tbody tr`).nth(2).locator('[data-cf="codigo"]')).toHaveValue('PP-01');
    await pp.getByRole('button', { name: '+ Missão na Fase 4' }).click();
    const nova = pp.locator(`.fase[data-fase="${F4}"] tbody tr`).nth(1).locator('[data-cf="codigo"]');
    await expect(nova).toHaveValue('PP-02');
    // Digitados, eles são recusados, com o motivo
    await page.evaluate(() => document.querySelector('#toast-box').replaceChildren());
    await nova.fill('pe-05');
    await nova.press('Tab');
    await expect(toast).toContainText('Já há resultados com o código PE-05 no PP: ele não vai para outra missão (os resultados passariam para ela).');
    await expect(nova).toHaveValue('PP-02');
    await nova.fill('TMA-06');
    await nova.press('Tab');
    await expect(toast).toContainText('O código TMA-06 está na Demanda de amanhã (João): ele não vai para outra missão (o voo passaria para ela).');
    await expect(nova).toHaveValue('PP-02');

    // O código livre muda; a alteração diz o de antes
    await codigo(M.pe04).fill('PE-4A');
    await codigo(M.pe04).press('Tab');
    await expect(codigo(M.pe04)).toHaveValue('PE-4A');
    await expect.poll(() => descricoesGuardadas(page)).toEqual(['PP: PE-03 alterada', 'PP: PP-01 incluída na Fase 5', 'PP: PP-02 incluída na Fase 4', 'PP: PE-04 → PE-4A']);
    await pp.locator('details.alteracoes summary').click();
    await expect(pp.locator('details.alteracoes li').first()).toContainText('PP: PE-04 → PE-4A');
  });

  // O campo digitado que perde o foco para um clique avisa a mudança no mousedown, antes do click: a aba é refeita depois
  // do clique (também o demorado), e o clique vale. Sem clicar num controle, ela é refeita do mesmo jeito
  test('digitar num campo e clicar direto em outro botão, marca ou campo: valem as duas alterações', async ({ page }) => {
    const [F1, F2, IN01, IN02, CT01] = [1, 2, 401, 402, 403].map(u);
    const conteudo = {
      nome: 'Piloto Privado', ativo: true,
      fases: [{ id: F1, nome: 'Fase 1 – Introdução ao Voo' }, { id: F2, nome: 'Fase 2 – O Controle da Aeronave' }],
      missoes: [missao(IN01, F1, 'IN-01', 'IN-01'), missao(IN02, F1, 'IN-02', 'IN-02'), missao(CT01, F2, 'CT-01', 'CT-01')]
    };
    await abrirComPrograma(page, { conteudo });
    await irPara(page, 'cur');
    const pp = curso(page, 'PP'), daFase1 = pp.locator(`.fase[data-fase="${F1}"] tbody tr`);
    // O nome de uma missão, e o ↓ de outra, com o botão do mouse apertado por um tempo
    await pp.locator(`tr[data-missao="${CT01}"] [data-cf="nome"]`).fill('Controle da aeronave');
    await pp.getByRole('button', { name: 'Descer IN-01' }).click({ delay: 300 });
    await expect(daFase1.first()).toHaveAttribute('data-missao', IN02);
    await expect(pp.getByRole('button', { name: 'Descer IN-01' })).toBeDisabled();
    // O nome de uma fase, e a marca de uma missão
    await pp.locator(`.fase[data-fase="${F2}"] [data-cfa="nome"]`).fill('Fase 2 – Controle');
    await pp.locator(`tr[data-missao="${IN01}"] [data-cf="dispensada"]`).click();
    await expect(pp.locator(`tr[data-missao="${IN01}"] [data-cf="dispensada"]`)).toBeChecked();
    await expect(pp.locator(`tr[data-missao="${IN01}"] [data-cf="dispensada"]`)).toBeFocused();
    // O código de uma missão, e o "+ Fase": o nome da fase nova fica em foco e selecionado
    await pp.locator(`tr[data-missao="${IN02}"] [data-cf="codigo"]`).fill('IN-05');
    await pp.getByRole('button', { name: '+ Fase' }).click();
    const nova = pp.locator('.fase').nth(2).locator('[data-cfa="nome"]');
    await expect(nova).toBeFocused();
    await page.keyboard.type('Fase 3 – Revisão');
    await page.keyboard.press('Enter');
    await expect(nova).toHaveValue('Fase 3 – Revisão');
    // O código de outra missão, e um clique fora dos controles: a aba é refeita, com o código novo nos nomes dos botões
    await pp.locator(`tr[data-missao="${CT01}"] [data-cf="codigo"]`).fill('CT-09');
    await pp.locator('h3').click();
    await expect(pp.locator(`tr[data-missao="${CT01}"] [data-act="missao-retirar"]`)).toHaveAttribute('aria-label', 'Tirar CT-09 do programa');
    await expect(pp.locator(`tr[data-missao="${IN02}"] [data-act="missao-retirar"]`)).toHaveAttribute('aria-label', 'Tirar IN-05 do programa');
    await expect(pp.locator(`tr[data-missao="${CT01}"] [data-cf="nome"]`)).toHaveValue('Controle da aeronave');
    // O nome de uma missão, e um clique no fim do nome de outra: o foco e o cursor ficam onde o clique os pôs
    await pp.locator(`tr[data-missao="${CT01}"] [data-cf="nome"]`).fill('Controle');
    const nomeDaIN01 = pp.locator(`tr[data-missao="${IN01}"] [data-cf="nome"]`);
    const caixa = await nomeDaIN01.boundingBox();
    await page.mouse.click(caixa.x + caixa.width - 4, caixa.y + caixa.height / 2);
    await expect(nomeDaIN01).toBeFocused();
    await page.keyboard.type(' (revisão)');
    await page.keyboard.press('Enter');
    await expect(nomeDaIN01).toHaveValue('IN-01 (revisão)');
    // O nome de uma missão, e os dois cliques do ✕ de outra: o primeiro arma o ✕, e ele continua armado para o segundo
    await nomeDaIN01.fill('Introdução');
    const tirar = `#cursos tr[data-missao="${IN02}"] [data-act="missao-retirar"]`;
    await page.locator(tirar).click();
    await expect(page.locator(tirar)).toHaveText('Confirmar');
    await page.waitForTimeout(700);
    await expect(page.locator(tirar)).toHaveText('Confirmar');
    await page.locator(tirar).click();
    await expect(pp.locator(`tr[data-missao="${IN02}"]`)).toHaveCount(0);
    // A troca de código diz o código de antes
    await expect.poll(() => descricoesGuardadas(page)).toEqual([
      'PP: CT-01 alterada', 'PP: IN-01 passou para 2ª', 'PP: Fase 2 alterada', 'PP: IN-01 dispensada', 'PP: IN-02 → IN-05', 'PP: Fase 3 incluída',
      'PP: Fase 3 alterada', 'PP: CT-01 → CT-09', 'PP: CT-09 alterada', 'PP: IN-01 alterada', 'PP: IN-01 alterada', 'PP: IN-05 tirada do programa'
    ]);
  });

  // Na tela estreita, a tabela de cada fase rola para o lado: refeita a aba, ela fica onde estava, com a marca à vista
  test('na tela estreita, a tabela da fase não volta ao começo a cada alteração', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await abrirComPrograma(page, { conteudo: CRONOGRAMA });
    await irPara(page, 'cur');
    const tabela = curso(page, 'PP').locator(`.fase[data-fase="${F7}"] > .tw`);
    const rolagem = () => tabela.evaluate(tw => tw.scrollLeft);
    await tabela.evaluate(tw => { tw.scrollLeft = tw.scrollWidth; });
    const noFim = await rolagem();
    expect(noFim).toBeGreaterThan(0);
    const marca = curso(page, 'PP').locator(`tr[data-missao="${M.adapt}"] [data-cf="dispensada"]`);
    await marca.click();
    await expect(marca).toBeChecked();
    await expect(marca).toBeFocused();
    expect(await rolagem()).toBe(noFim);
    // A marca em foco continua à vista dentro da tabela
    expect(await marca.evaluate(el => {
      const r = el.getBoundingClientRect(), caixa = el.closest('.tw').getBoundingClientRect();
      return r.left >= caixa.left && r.right <= caixa.right;
    })).toBe(true);
    await expect.poll(() => descricoesGuardadas(page)).toEqual(['PP: ADAPT-C152 dispensada']);
  });

  // No celular, cada missão é um cartão: o cadeado do código travado (a missão com resultados) fica ao lado do campo,
  // na mesma linha, e o cartão cabe na tela
  test('no celular, o cadeado do código travado fica ao lado do campo', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await abrirComPrograma(page, { conteudo: CRONOGRAMA, resultados: aprovadas(1000, ['TMA-05'], 1) });
    await irPara(page, 'cur');
    const linha = curso(page, 'PP').locator(`tr[data-missao="${M.tma05}"]`);
    await expect(linha.locator('[data-cf="codigo"]')).toHaveAttribute('readonly', '');
    const campo = await linha.locator('[data-cf="codigo"]').boundingBox(), cadeado = await linha.locator('td.c-codigo svg').boundingBox();
    // O cadeado começa depois do fim do campo, com o meio dele na altura do campo
    expect(cadeado.x).toBeGreaterThanOrEqual(campo.x + campo.width);
    expect(cadeado.y + cadeado.height / 2).toBeGreaterThan(campo.y);
    expect(cadeado.y + cadeado.height / 2).toBeLessThan(campo.y + campo.height);
    // O campo e o nome ao lado continuam inteiros, e a página não rola para o lado
    const nome = await linha.locator('[data-cf="nome"]').boundingBox();
    expect(cadeado.x + cadeado.width).toBeLessThanOrEqual(nome.x);
    expect(campo.width).toBeGreaterThan(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

// Os cursos: "+ Novo curso" (a sigla e o nome conferidos no formulário, o programa vazio ou o cronograma do PP), o nome,
// encerrar e reativar, um curso de cada vez (os botões dos cursos e "Mostrar encerrados"), os alunos de cada curso, o
// cronograma do PP no PP ainda vazio ou numa fase só e o trecho do Noturno. Neste navegador, com o cadastro e o dia no
// formato atual
test.describe('Cursos: cursos novos, encerrar, o cronograma do PP e o curso de cada aluno', () => {
  const u = n => `00000000-0000-4000-8015-${String(n).padStart(12, '0')}`;
  // O cadastro e o dia, os cursos (como as tabelas dos cursos os guardam) e os resultados, neste navegador
  async function abrirComCursos(page, { estado, cursos = cursosIniciais(), resultados = [], url = './' }) {
    const { documentos: { cadastro }, dias } = documentosAtuais(estado, AMANHA);
    const docs = { acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_cursos: { cursos, alteracoes: [] }, acpm4_resultados: resultados };
    await page.addInitScript(json => {
      if (localStorage.getItem('acpm4_cadastro')) return;
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify(docs));
    await page.goto(url);
    await appPronto(page);
  }
  const comPP = conteudo => gravarCurso({ cursos: cursosIniciais() }, { sigla: 'PP', versaoLida: 1, conteudo, descricao: 'PP: programa' }).cursos;
  const descricoes = async page => (await programaGuardado(page)).alteracoes.map(a => a.descricao);
  const opcoesDoCurso = async (page, id) => (await campoDoAluno(page, id, 'curso')).locator('option');
  // Os valores de uma lista de campos
  const valores = campos => campos.evaluateAll(els => els.map(e => e.value));
  const aprovada = (aluno, missao, id) => ({ id, aluno, curso: 'PP', missao, resultado: 'aprovado', data: '2026-11-05', voo: null, registrado_em: '2026-11-05T12:00:00.000Z', registrado_por: 'Operador' });

  comProgresso('um curso novo: a sigla e o nome conferidos no formulário; criado, ele vale em Alunos, e o resultado de um voo vai para ele', async ({ page }) => {
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' }), aluno(1001, { fly: false, p1: 500, p2: -1 })] });
    await abrirComCursos(page, { estado });
    await irPara(page, 'cur');
    const novo = page.locator('#cur-novo'), form = page.locator('#form-curso');
    await expect(form).toBeHidden();
    await novo.click();
    await expect(novo).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#cur-sigla')).toBeFocused();
    await expect(form.locator('fieldset label')).toHaveText(['Programa vazio', 'Cronograma do Piloto Privado (P.I PPA 001A)']);
    await expect(form.locator('[name="cur-comeco"][value="vazio"]')).toBeChecked();
    // Os erros ficam embaixo dos campos, com o campo marcado e em foco
    const erro = page.locator('#cur-erro');
    await form.getByRole('button', { name: 'Criar o curso' }).click();
    await expect(erro).toHaveText('Escreva a sigla do curso (por exemplo, PC-IFR).');
    await expect(page.locator('#cur-sigla')).toHaveAttribute('aria-invalid', 'true');
    await page.locator('#cur-sigla').fill('pc');
    await page.locator('#cur-nome').fill('Outro comercial');
    await page.locator('#cur-nome').press('Enter');
    await expect(erro).toHaveText('Já existe o curso PC (Piloto Comercial).');
    await expect(page.locator('#cur-sigla')).toBeFocused();
    await page.locator('#cur-sigla').fill('mlte');
    await page.locator('#cur-nome').fill('   ');
    await page.locator('#cur-nome').press('Enter');
    await expect(erro).toHaveText('Escreva o nome do curso (até 80 caracteres).');
    await expect(page.locator('#cur-nome')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#cur-sigla')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#cur-nome')).toBeFocused();
    await page.locator('#cur-nome').fill('Multimotor');
    await page.locator('#cur-nome').press('Enter');

    // Criado: escolhido no alto (o botão dele, no fim, pressionado), só ele na aba, com o foco em "+ Fase"; a gravação o
    // cria (versão 1)
    await expect(form).toBeHidden();
    await expect(novo).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#cursos .seg-dos-cursos button')).toHaveText(['PP · Piloto Privado', 'PC · Piloto Comercial', 'INVA · Instrutor de Voo', 'MLTE · Multimotor']);
    await expect(page.locator('#cur-ver-MLTE')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#cur-ver-PP')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => siglasNaAba(page)).toEqual(['MLTE']);
    await expect(curso(page, 'MLTE').locator('h3')).toHaveText('MLTE Multimotor · 0 missões');
    await expect(curso(page, 'MLTE').getByRole('button', { name: '+ Fase' })).toBeFocused();
    await expect.poll(async () => (await programaGuardado(page)).alteracoes.map(a => [a.curso, a.versao, a.descricao])).toEqual([['MLTE', 1, 'Curso MLTE criado: Multimotor']]);
    await curso(page, 'MLTE').getByRole('button', { name: '+ Missão' }).click();
    await expect(linhas(page, 'MLTE').nth(0).locator('[data-cf="codigo"]')).toHaveValue('MLTE-01');
    // Outro curso no alto: só ele na aba, com o foco no botão dele
    await page.locator('#cur-ver-PP').click();
    await expect.poll(() => siglasNaAba(page)).toEqual(['PP']);
    await expect(page.locator('#cur-ver-PP')).toBeFocused();

    // Em Alunos, o curso novo está na lista; com ele, a próxima missão, a escala e o resultado no MLTE
    await irPara(page, 'alu');
    await expect(await opcoesDoCurso(page, 1001)).toHaveText(['—', 'PP · Piloto Privado', 'PC · Piloto Comercial', 'INVA · Instrutor de Voo', 'MLTE · Multimotor']);
    await (await campoDoAluno(page, 1001, 'curso')).selectOption('MLTE');
    await expect(page.locator('#audit-log-list')).toContainText('Curso de Aluno 1001: MLTE');
    await irPara(page, 'dem');
    await page.locator('#onlyfly').uncheck();
    const usar = page.locator('#dem tr[data-id="1001"][data-mid="0"] [data-act="usar-proxima"]');
    await expect(usar).toHaveText('Próxima: MLTE-01 · Usar');
    await usar.click();
    await abrirEscala(page);
    const voo = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1001' });
    await expect(voo.locator('.c-status .etapa')).toHaveText('MLTE-01');
    await voo.locator('[data-resultado]').selectOption('aprovado');
    const ultimo = () => page.evaluate(() => {
      const r = (JSON.parse(localStorage.getItem('acpm4_resultados')) || []).at(-1);
      return r && [r.aluno, r.curso, r.missao, r.resultado];
    });
    await expect.poll(ultimo).toEqual([1001, 'MLTE', 'MLTE-01', 'aprovado']);
    // Os alunos do curso, com o progresso (a aba volta no curso escolhido antes)
    await irPara(page, 'cur');
    await expect(page.locator('#cur-ver-PP')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#cur-ver-MLTE').click();
    const alunos = curso(page, 'MLTE').locator('details.alunos-do-curso');
    await expect(alunos.locator('summary')).toHaveText('1 aluno no MLTE');
    await alunos.locator('summary').click();
    await expect(alunos.locator('li')).toHaveText(['Aluno 1001 · 1/1 · concluído']);
  });

  // O Esc com o foco no formulário fecha só ele, como Cancelar (nada é criado, e o foco volta ao botão); o Histórico aberto
  // continua aberto, e o Esc seguinte, com o foco fora das gavetas, o fecha
  test('o Esc no formulário do curso novo fecha só ele, sem criar nada; o Histórico aberto continua aberto', async ({ page }) => {
    await abrirComCursos(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await irPara(page, 'cur');
    const historico = page.locator('#historico');
    await abrirHistorico(page);
    await expect(historico).toBeVisible();
    const novo = page.locator('#cur-novo'), form = page.locator('#form-curso');
    // O Histórico cobre o botão: pelo teclado
    await novo.focus();
    await page.keyboard.press('Enter');
    await expect(form).toBeVisible();
    await expect(page.locator('#cur-sigla')).toBeFocused();
    await page.locator('#cur-sigla').fill('MLTE');
    await page.locator('#cur-nome').fill('Multimotor');
    await page.keyboard.press('Escape');
    await expect(form).toBeHidden();
    await expect(novo).toBeFocused();
    await expect(novo).toHaveAttribute('aria-expanded', 'false');
    await expect(historico).toBeVisible();
    await expect(curso(page, 'MLTE')).toHaveCount(0);
    expect((await programaGuardado(page)).cursos.map(c => c.sigla)).toEqual(['PP', 'PC', 'INVA']);
    await page.keyboard.press('Escape');
    await expect(historico).toBeHidden();
    // Aberto de novo, ele vem vazio
    await novo.click();
    await expect(page.locator('#cur-sigla')).toHaveValue('');
    await expect(page.locator('#cur-nome')).toHaveValue('');
  });

  test('encerrar e reativar: o encerrado sai das matrículas novas, e quem já está nele continua; o nome do curso muda', async ({ page }) => {
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PC' }), aluno(1001), aluno(1002, {}, { curso: 'ZZ9' })] });
    await abrirComCursos(page, { estado });
    await irPara(page, 'cur');
    await page.locator('#cur-ver-PC').click();
    const pc = curso(page, 'PC');
    await confirmar(page, '#cursos .curso[data-curso="PC"] [data-act="curso-encerrar"]');
    // Ele continua na aba ("Mostrar encerrados" fica marcado), com a etiqueta, e o foco vai para "Reativar o curso"
    await expect(page.locator('#cur-encerrados')).toBeChecked();
    await expect(pc.locator('h3 .tag')).toHaveText('encerrado');
    await expect(pc.getByRole('button', { name: 'Reativar o curso PC' })).toBeFocused();
    await expect(page.locator('#toast-box')).toContainText('PC encerrado: ele sai da lista dos cursos em Alunos; quem já está nele continua.');
    const botoes = page.locator('#cursos .seg-dos-cursos button');
    await expect(botoes).toHaveText(['PP · Piloto Privado', 'PC · Piloto Comercial (encerrado)', 'INVA · Instrutor de Voo']);
    // Sem "Mostrar encerrados", o PC sai do alto e da tela: fica o primeiro ativo, e ele continua quando os encerrados
    // aparecem de novo
    await page.locator('#cur-encerrados').uncheck();
    await expect.poll(() => siglasNaAba(page)).toEqual(['PP']);
    await expect(botoes).toHaveText(['PP · Piloto Privado', 'INVA · Instrutor de Voo']);
    await expect(page.locator('#cur-ver-PP')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#cur-encerrados').check();
    await expect(botoes).toHaveText(['PP · Piloto Privado', 'PC · Piloto Comercial (encerrado)', 'INVA · Instrutor de Voo']);
    await expect.poll(() => siglasNaAba(page)).toEqual(['PP']);
    await page.locator('#cur-encerrados').uncheck();

    // Em Alunos: o PC não aparece para quem não está nele; quem está continua, com o curso marcado como encerrado
    await irPara(page, 'alu');
    await expect(await opcoesDoCurso(page, 1001)).toHaveText(['—', 'PP · Piloto Privado', 'INVA · Instrutor de Voo']);
    await expect(await opcoesDoCurso(page, 1000)).toHaveText(['—', 'PP · Piloto Privado', 'INVA · Instrutor de Voo', 'PC · Piloto Comercial (encerrado)']);
    await expect((await campoDoAluno(page, 1000, 'curso'))).toHaveValue('PC');
    // O curso que não existe nas tabelas dos cursos continua, dito como tal
    await expect(await opcoesDoCurso(page, 1002)).toHaveText(['—', 'PP · Piloto Privado', 'INVA · Instrutor de Voo', 'ZZ9 (curso desconhecido)']);
    await expect((await campoDoAluno(page, 1002, 'curso'))).toHaveValue('ZZ9');
    // Quem sai do encerrado não volta para ele pela lista
    await (await campoDoAluno(page, 1000, 'curso')).selectOption('PP');
    await expect(await opcoesDoCurso(page, 1000)).toHaveText(['—', 'PP · Piloto Privado', 'INVA · Instrutor de Voo']);

    // Reativado (o encerrado escolhido no alto), ele volta às matrículas
    await irPara(page, 'cur');
    await page.locator('#cur-encerrados').check();
    await page.locator('#cur-ver-PC').click();
    await expect.poll(() => siglasNaAba(page)).toEqual(['PC']);
    await pc.getByRole('button', { name: 'Reativar o curso PC' }).click();
    await expect(pc.locator('h3 .tag')).toHaveCount(0);
    await expect(pc.getByRole('button', { name: 'Encerrar o curso PC' })).toBeFocused();
    // O nome do curso: vazio não vale; o novo vai para Alunos
    const nome = pc.locator('[data-cc="nome"]');
    await nome.fill(' ');
    await nome.press('Tab');
    await expect(page.locator('#toast-box')).toContainText('O nome do curso vai de 1 a 80 caracteres.');
    await expect(nome).toHaveValue('Piloto Comercial');
    await nome.fill('Piloto  Comercial   ACPM');
    await nome.press('Enter');
    await expect(pc.locator('h3 small')).toHaveText('Piloto Comercial ACPM · 0 missões');
    await irPara(page, 'alu');
    await expect(await opcoesDoCurso(page, 1001)).toHaveText(['—', 'PP · Piloto Privado', 'PC · Piloto Comercial ACPM', 'INVA · Instrutor de Voo']);
    await expect.poll(() => descricoes(page)).toEqual(['PC encerrado', 'PC reativado', 'Curso PC renomeado: Piloto Comercial ACPM']);
    expect((await programaGuardado(page)).cursos.find(c => c.sigla === 'PC')).toMatchObject({ nome: 'Piloto Comercial ACPM', ativo: true, versao: 4 });
  });

  comProgresso('no PP vazio, "Usar o cronograma do PP": dois cliques, com o resumo; as 9 fases, com a Fase 6 depois da Fase 4 e o Noturno em trechos', async ({ page }) => {
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { fly: false }, { curso: 'PP' })] });
    await abrirComCursos(page, { estado });
    await irPara(page, 'cur');
    const pp = curso(page, 'PP');
    // Só no PP (o curso do cronograma)
    await expect(page.locator('#cursos [data-act="curso-modelo"]')).toHaveCount(1);
    for (const sigla of ['PC', 'INVA']) {
      await page.locator(`#cur-ver-${sigla}`).click();
      await expect(curso(page, sigla).getByRole('button', { name: '+ Fase' })).toBeVisible();
      await expect(page.locator('#cursos [data-act="curso-modelo"]')).toHaveCount(0);
    }
    await page.locator('#cur-ver-PP').click();
    const usar = pp.getByRole('button', { name: 'Usar o cronograma do PP (P.I PPA 001A)' });
    await usar.click();
    await expect(pp.locator('[data-act="curso-modelo"]')).toHaveText('Confirmar: 47 missões entram');
    expect(await descricoes(page)).toEqual([]);
    await pp.locator('[data-act="curso-modelo"]').click();
    await expect(pp.locator('h3 small')).toHaveText('Piloto Privado · 9 fases · 46 missões (1 dispensada)');
    await expect(pp.locator('h4.modulo')).toHaveText(['Módulo 01 – Treinamento Duplo Comando', 'Módulo 02 – Treinamento de Voo Solo', 'Módulo 03 – Avaliação']);
    await expect(pp.locator('[data-act="curso-modelo"]')).toHaveCount(0);
    await expect(pp.locator('[data-cc="nome"]')).toBeFocused();
    const f6 = pp.locator('.fase').nth(7);
    await expect(f6.locator('[data-cfa="nome"]')).toHaveValue('Fase 6 – Treinamento de Voo Noturno');
    await expect(f6.locator('details.requisitos summary')).toHaveText('Depois de: Fase 4');
    await expect.poll(() => valores(f6.locator('[data-cf="trecho"]'))).toEqual(['ida', 'noite', 'volta']);
    await expect.poll(() => descricoes(page)).toEqual(['PP: cronograma P.I PPA 001A aplicado (0 mantidas, 47 novas, 0 retiradas)']);
    await irPara(page, 'dem');
    await page.locator('#onlyfly').uncheck();
    await expect(page.locator('#dem tr[data-id="1000"][data-mid="0"] [data-act="usar-proxima"]')).toHaveText('Próxima: IN-01 · Usar');
  });

  // O PP trazido do cadastro (uma fase só, "Programa"), com resultados na IN-01 e na PP-02: a IN-01 (código do cronograma)
  // fica, com o mesmo id e os resultados; a PP-02 sai do programa (os resultados ficam); a fase "Programa" também sai
  comProgresso('no PP trazido do cadastro, o cronograma mantém o código que já tem resultados e tira o resto do programa', async ({ page }) => {
    const plano = {
      nome: 'Piloto Privado', ativo: true, fases: [{ id: u(1), nome: 'Programa' }],
      missoes: [
        { id: u(11), fase: u(1), codigo: 'IN-01', nome: 'Familiarização', mis: 'Voo Local', eq: 'C152', nb: 1 },
        { id: u(12), fase: u(1), codigo: 'PP-02', nome: 'Navegação', mis: 'Navegação', eq: 'C152', nb: 2 },
        { id: u(13), fase: u(1), codigo: 'TMA-05', nome: 'Tráfego', mis: 'Voo Local', eq: 'C152', nb: 1 }
      ]
    };
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { fly: false }, { curso: 'PP' })] });
    await abrirComCursos(page, { estado, cursos: comPP(plano), resultados: [aprovada(1000, 'IN-01', 1), aprovada(1000, 'PP-02', 2)] });
    await irPara(page, 'alu');
    await expect.poll(() => textoDoProgresso(page, 1000)).toBe('2/3 · próxima TMA-05');
    await irPara(page, 'cur');
    const pp = curso(page, 'PP');
    await confirmar(page, '#cursos .curso[data-curso="PP"] [data-act="curso-modelo"]');
    await expect(pp.locator('h3 small')).toHaveText('Piloto Privado · 9 fases · 46 missões (1 dispensada)');
    // A IN-01 é a mesma missão (o id), com o nome do cronograma e o código travado pelos resultados
    const in01 = pp.locator(`tr[data-missao="${u(11)}"]`);
    await expect(in01.locator('[data-cf="codigo"]')).toHaveValue('IN-01');
    await expect(in01.locator('[data-cf="codigo"]')).toHaveAttribute('readonly', '');
    await expect(in01.locator('[data-cf="nome"]')).toHaveValue('IN-01');
    await expect(pp.locator(`tr[data-missao="${u(13)}"] [data-cf="avaliacao"]`)).toBeChecked();
    const retiradas = pp.locator('details.retiradas');
    await retiradas.locator('summary').click();
    await expect(retiradas.locator('li')).toHaveText(['Programa Voltar ao programa', 'PP-02 Navegação · Programa Voltar ao programa']);
    await expect.poll(() => descricoes(page)).toEqual(['PP: cronograma P.I PPA 001A aplicado (2 mantidas, 45 novas, 1 retirada)']);
    const guardado = (await programaGuardado(page)).cursos.find(c => c.sigla === 'PP');
    expect(guardado.missoes.filter(m => [u(11), u(12), u(13)].includes(m.id)).map(m => [m.codigo, m.removida]).sort())
      .toEqual([['IN-01', false], ['PP-02', true], ['TMA-05', false]]);
    // O resultado da IN-01 continua contando; o da PP-02, fora do programa, não
    await irPara(page, 'alu');
    await expect.poll(() => textoDoProgresso(page, 1000)).toBe('1/46 · Fase 1 · próxima IN-02');
  });

  // O trecho do Noturno de cada missão Noturno: o Noturno desmanchado é recusado com o motivo (a tela volta a mostrar como
  // estava); quem só consulta lê o trecho em texto
  comProgresso('o trecho do Noturno: a lista nas missões Noturno, a recusa do Noturno desmanchado e o texto para quem só consulta', async ({ page }) => {
    const [F4, F6, TMA05, TSL01, NOT, TSL02] = [4, 6, 21, 22, 23, 24].map(u);
    const noturno = (id, codigo, nb = 1) => ({ id, fase: F6, codigo, nome: codigo, mis: 'Noturno', eq: 'C172', nb });
    const plano = {
      nome: 'Piloto Privado', ativo: true,
      fases: [{ id: F4, nome: 'Fase 4 – Manobras' }, { id: F6, nome: 'Fase 6 – Voo Noturno' }],
      missoes: [{ id: TMA05, fase: F4, codigo: 'TMA-05', nome: 'TMA-05', mis: 'Voo Local', eq: 'C152', nb: 1 }, noturno(TSL01, 'TSL-01'), noturno(NOT, 'NOT', 3), noturno(TSL02, 'TSL-02')]
    };
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { fly: false }, { curso: 'PP' })] });
    await abrirComCursos(page, { estado, cursos: comPP(plano), resultados: [aprovada(1000, 'TMA-05', 1)] });
    await irPara(page, 'cur');
    const pp = curso(page, 'PP'), trecho = id => pp.locator(`tr[data-missao="${id}"] [data-cf="trecho"]`);
    await expect(pp.locator('[data-cf="trecho"]')).toHaveCount(3);
    await expect(trecho(TSL01)).toHaveAccessibleName('Trecho do Noturno de TSL-01');
    await expect(trecho(TSL01).locator('option')).toHaveText(['Nenhum', 'Ida', 'Noite', 'Volta']);
    // A ida sem a noite logo depois não forma um Noturno
    await trecho(TSL01).selectOption('ida');
    await expect(page.locator('#toast-box')).toContainText('Cada Noturno fica junto na fase: a ida (se houver), uma noite e a volta (se houver), nesta ordem, sem outra missão no meio.');
    await expect(trecho(TSL01)).toHaveValue('');
    await trecho(NOT).selectOption('noite');
    await expect(trecho(NOT)).toHaveValue('noite');
    await trecho(TSL01).selectOption('ida');
    await expect(trecho(TSL01)).toHaveValue('ida');
    await trecho(TSL02).selectOption('volta');
    await expect.poll(() => valores(pp.locator('[data-cf="trecho"]'))).toEqual(['ida', 'noite', 'volta']);
    // A noite que deixa de ser Noturno desmancharia o Noturno: recusada, ela continua a noite
    await page.evaluate(() => document.querySelector('#toast-box').replaceChildren());
    await pp.locator(`tr[data-missao="${NOT}"] [data-cf="mis"]`).selectOption('Navegação');
    await expect(page.locator('#toast-box')).toContainText('Cada Noturno fica junto na fase');
    await expect(pp.locator(`tr[data-missao="${NOT}"] [data-cf="mis"]`)).toHaveValue('Noturno');
    await expect(trecho(NOT)).toHaveValue('noite');
    await expect.poll(() => descricoes(page)).toEqual(['PP: NOT é a noite do Noturno', 'PP: TSL-01 é a ida do Noturno', 'PP: TSL-02 é a volta do Noturno']);
    // A próxima missão: o Noturno, pela noite, com os translados
    await irPara(page, 'dem');
    await page.locator('#onlyfly').uncheck();
    await expect(page.locator('#dem tr[data-id="1000"][data-mid="0"] [data-act="usar-proxima"]')).toHaveText('Próxima: NOT (com TSL-01 e TSL-02) · Usar');
    // Quem só consulta lê o trecho no tipo de missão
    await page.locator('#role-sel').selectOption('gestor');
    await irPara(page, 'cur');
    await expect(pp.locator('td.c-mis')).toHaveText(['Voo Local', 'Noturno · ida', 'Noturno · noite', 'Noturno · volta']);
    await expect(pp.locator('input, select')).toHaveCount(0);
  });
});

// Um curso de cada vez (os botões dos cursos no alto), o índice das fases com os alunos de cada uma e as fases que
// recolhem: o que só muda o que se vê vale para todos os perfis e fica na memória até a página recarregar. Neste
// navegador, com o PP em três fases (dois módulos), o MLTE encerrado e alunos em fases diferentes
test.describe('Cursos: um de cada vez, o índice das fases, as fases recolhíveis e os alunos por fase', () => {
  const u = n => `00000000-0000-4000-8016-${String(n).padStart(12, '0')}`;
  const [F1, F2, F3] = [1, 2, 3].map(u);
  const [IN01, IN02, CT01, CT02] = [11, 12, 21, 22].map(u);
  const M01 = 'Módulo 01 – Duplo Comando', M02 = 'Módulo 02 – Voo Solo';
  const local = (id, fase, codigo, mis = 'Voo Local') => ({ id, fase, codigo, nome: codigo, mis, eq: 'C152', nb: 1 });
  const PROGRAMA_EM_FASES = {
    nome: 'Piloto Privado', ativo: true,
    fases: [{ id: F1, nome: 'Fase 1 – Introdução ao Voo', modulo: M01 }, { id: F2, nome: 'Fase 2 – O Controle da Aeronave', modulo: M01 }, { id: F3, nome: 'Fase 3 – Voo Solo', modulo: M02 }],
    missoes: [local(IN01, F1, 'IN-01'), local(IN02, F1, 'IN-02'), local(CT01, F2, 'CT-01'), local(CT02, F2, 'CT-02'),
      ...[31, 32, 33, 34].map((n, i) => local(u(n), F3, `SOLO-0${i + 1}`, 'Voo Solo'))]
  };
  const SOLOS = ['SOLO-01', 'SOLO-02', 'SOLO-03', 'SOLO-04'];
  const aprovadas = (aluno, codigos, primeiro) => codigos.map((missao, i) => ({
    id: primeiro + i, aluno, curso: 'PP', missao, resultado: 'aprovado', data: '2026-11-05', voo: null, registrado_em: '2026-11-05T12:00:00.000Z', registrado_por: 'Operador'
  }));
  // A Ana na Fase 1, o Bruno na Fase 2 (fez a Fase 1) e a Carla com o curso concluído; o Davi, no PC
  const RESULTADOS = [...aprovadas(1001, ['IN-01', 'IN-02'], 1), ...aprovadas(1002, ['IN-01', 'IN-02', 'CT-01', 'CT-02', ...SOLOS], 10)];
  async function abrirComOsCursos(page, { url = './', resultados = RESULTADOS, mudarCursos = cursos => cursos } = {}) {
    const estado = cenario({
      ins: [instrutor(1, 9)],
      stu: [aluno(1000, { fly: false }, { nm: 'Ana', curso: 'PP' }), aluno(1001, { fly: false }, { nm: 'Bruno', curso: 'PP' }),
        aluno(1002, { fly: false }, { nm: 'Carla', curso: 'PP' }), aluno(1003, { fly: false }, { nm: 'Davi', curso: 'PC' })]
    });
    const comPP = gravarCurso({ cursos: cursosIniciais() }, { sigla: 'PP', versaoLida: 1, conteudo: PROGRAMA_EM_FASES, descricao: 'PP: programa' }).cursos;
    const { cursos } = gravarCurso({ cursos: comPP }, { sigla: 'MLTE', versaoLida: 0, conteudo: { nome: 'Multimotor', ativo: false, fases: [], missoes: [] }, descricao: 'Curso MLTE criado: Multimotor' });
    const { documentos: { cadastro }, dias } = documentosAtuais(estado, AMANHA);
    const docs = { acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_cursos: { cursos: mudarCursos(cursos), alteracoes: [] }, acpm4_resultados: resultados };
    await page.addInitScript(json => {
      if (localStorage.getItem('acpm4_cadastro')) return;
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify(docs));
    await page.goto(url);
    await appPronto(page);
  }
  const pressionados = page => page.locator('#cursos .seg-dos-cursos button').evaluateAll(bs => bs.map(b => b.getAttribute('aria-pressed')));
  const titulo = (page, fase) => page.locator(`#cursos .fase[data-fase="${fase}"] [data-recolher-fase]`);
  const abertas = page => page.locator('#cursos [data-recolher-fase]').evaluateAll(bs => bs.map(b => b.getAttribute('aria-expanded')));

  test('um curso de cada vez: a aba abre no primeiro ativo e fica no escolhido até recarregar; o encerrado, só com "Mostrar encerrados"', async ({ page }) => {
    await abrirComOsCursos(page);
    await irPara(page, 'cur');
    const botoes = page.locator('#cursos .seg-dos-cursos button');
    await expect(page.getByRole('group', { name: 'Curso' })).toBeVisible();
    await expect(botoes).toHaveText(['PP · Piloto Privado', 'PC · Piloto Comercial', 'INVA · Instrutor de Voo']);
    expect(await pressionados(page)).toEqual(['true', 'false', 'false']);
    expect(await siglasNaAba(page)).toEqual(['PP']);
    // Outro curso: só ele na aba, com o botão pressionado e o foco nele
    await page.locator('#cur-ver-PC').click();
    await expect.poll(() => siglasNaAba(page)).toEqual(['PC']);
    expect(await pressionados(page)).toEqual(['false', 'true', 'false']);
    await expect(page.locator('#cur-ver-PC')).toBeFocused();
    await expect(curso(page, 'PC').locator('details.alunos-do-curso summary')).toHaveText('1 aluno no PC');
    // Pelo teclado, também
    await page.keyboard.press('Tab');
    await expect(page.locator('#cur-ver-INVA')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => siglasNaAba(page)).toEqual(['INVA']);
    await expect(page.locator('#cur-ver-INVA')).toBeFocused();
    // A escolha fica em outra aba e em outra data, até a página recarregar
    await irPara(page, 'alu');
    await irPara(page, 'cur');
    expect(await siglasNaAba(page)).toEqual(['INVA']);
    await diaSeguinte(page);
    await expect(rotuloDaData(page)).toContainText('12/11');
    await expect.poll(() => siglasNaAba(page)).toEqual(['INVA']);
    await page.reload();
    await irPara(page, 'cur');
    await expect.poll(() => siglasNaAba(page)).toEqual(['PP']);
    // O encerrado, só com "Mostrar encerrados" (na ordem dos cursos, com a marca); sem ele, o primeiro ativo volta à tela
    await page.locator('#cur-encerrados').check();
    await expect(botoes).toHaveText(['PP · Piloto Privado', 'PC · Piloto Comercial', 'INVA · Instrutor de Voo', 'MLTE · Multimotor (encerrado)']);
    await page.locator('#cur-ver-MLTE').click();
    await expect(curso(page, 'MLTE').locator('h3 .tag')).toHaveText('encerrado');
    await page.locator('#cur-encerrados').uncheck();
    await expect.poll(() => siglasNaAba(page)).toEqual(['PP']);
    await expect(botoes).toHaveText(['PP · Piloto Privado', 'PC · Piloto Comercial', 'INVA · Instrutor de Voo']);
  });

  comProgresso('os alunos por fase e o índice das fases: o link leva à fase, sem mudar o endereço, com o foco no título dela', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await abrirComOsCursos(page);
    await irPara(page, 'cur');
    const pp = curso(page, 'PP'), indice = pp.getByRole('navigation', { name: 'Fases do PP' });
    // Os alunos do curso, na ordem das fases em que estão (a do progresso); quem concluiu, no fim
    const alunos = pp.locator('details.alunos-do-curso');
    await expect(alunos.locator('summary')).toHaveText('3 alunos no PP');
    await alunos.locator('summary').click();
    await expect(alunos.locator('.turma-da-fase')).toHaveText(['Fase 1 – Introdução ao Voo (1)', 'Fase 2 – O Controle da Aeronave (1)', 'Concluíram o curso (1)']);
    await expect(alunos.locator('li')).toHaveText(['Ana · 0/8 · Fase 1 · próxima IN-01', 'Bruno · 2/8 · Fase 2 · próxima CT-01', 'Carla · 8/8 · concluído']);
    await expect(alunos.getByRole('list', { name: 'Fase 2 – O Controle da Aeronave (1)' }).locator('li')).toHaveText(['Bruno · 2/8 · Fase 2 · próxima CT-01']);
    // O índice: os módulos, e em cada um as fases, com quantos alunos estão em cada fase
    await expect(indice.locator('.indice-modulo-nome')).toHaveText([M01, M02]);
    await expect(indice.getByRole('list', { name: M01 }).locator('li')).toHaveText(['Fase 1 – Introdução ao Voo 1 aluno', 'Fase 2 – O Controle da Aeronave 1 aluno']);
    await expect(indice.getByRole('list', { name: M02 }).locator('li')).toHaveText(['Fase 3 – Voo Solo']);
    await expect(indice.locator('.alunos-na-fase').first()).toHaveAttribute('data-dica', 'alunos-na-fase');
    // O link: a fase vem para o alto da tela (com a folga), o foco vai para o título dela e o endereço não muda
    const enderecoAntes = page.url();
    await indice.getByRole('link', { name: 'Fase 2 – O Controle da Aeronave' }).click();
    await expect(titulo(page, F2)).toBeFocused();
    await expect(titulo(page, F2)).toHaveAccessibleName('Fase 2 – O Controle da Aeronave');
    await expect.poll(() => pp.locator(`.fase[data-fase="${F2}"]`).evaluate(el => Math.round(el.getBoundingClientRect().top))).toBe(8);
    expect(page.url()).toBe(enderecoAntes);
    // Pelo teclado: Enter no link, e o Tab seguinte entra na fase (o nome dela, para quem muda)
    await indice.getByRole('link', { name: 'Fase 1 – Introdução ao Voo' }).focus();
    await page.keyboard.press('Enter');
    await expect(titulo(page, F1)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(pp.locator(`.fase[data-fase="${F1}"] [data-cfa="nome"]`)).toBeFocused();
  });

  test('as fases recolhem e abrem: no título, em "Recolher todas" e "Abrir todas"; continuam assim depois de uma alteração e de outro curso', async ({ page }) => {
    await abrirComOsCursos(page);
    await irPara(page, 'cur');
    const pp = curso(page, 'PP');
    const linhasDa = fase => pp.locator(`.fase[data-fase="${fase}"] tbody tr`);
    // Abertas: as missões à vista
    expect(await abertas(page)).toEqual(['true', 'true', 'true']);
    await expect(linhasDa(F1).first()).toBeVisible();
    // O título recolhe a fase: as missões e o "+ Missão" somem; o cabeçalho (o nome, o módulo, quando abre) fica
    await titulo(page, F1).click();
    await expect(titulo(page, F1)).toHaveAttribute('aria-expanded', 'false');
    await expect(linhasDa(F1).first()).toBeHidden();
    await expect(pp.getByRole('button', { name: '+ Missão na Fase 1' })).toBeHidden();
    await expect(pp.locator(`.fase[data-fase="${F1}"] [data-cfa="nome"]`)).toBeVisible();
    await expect(titulo(page, F1)).toBeFocused();
    // Uma alteração em outra fase refaz a aba: a Fase 1 continua recolhida, e o Tab segue do campo
    const nomeCT01 = pp.locator(`tr[data-missao="${CT01}"] [data-cf="nome"]`);
    await nomeCT01.fill('Controle da aeronave');
    await nomeCT01.press('Tab');
    await expect(pp.locator(`tr[data-missao="${CT01}"] [data-cf="mis"]`)).toBeFocused();
    await expect(titulo(page, F1)).toHaveAttribute('aria-expanded', 'false');
    await expect(linhasDa(F1).first()).toBeHidden();
    // Outro curso e de volta: continua recolhida
    await page.locator('#cur-ver-PC').click();
    await page.locator('#cur-ver-PP').click();
    expect(await abertas(page)).toEqual(['false', 'true', 'true']);
    // A missão levada para a fase recolhida abre a fase, com o foco na lista da fase dela
    await pp.locator(`tr[data-missao="${CT02}"] [data-cf="fase"]`).selectOption(F1);
    await expect(titulo(page, F1)).toHaveAttribute('aria-expanded', 'true');
    await expect(linhasDa(F1)).toHaveCount(3);
    await expect(pp.locator(`tr[data-missao="${CT02}"] [data-cf="fase"]`)).toBeFocused();
    // Todas de uma vez; o link do índice abre a fase recolhida
    await pp.getByRole('button', { name: 'Recolher todas' }).click();
    expect(await abertas(page)).toEqual(['false', 'false', 'false']);
    await expect(pp.locator('tbody tr:visible')).toHaveCount(0);
    await expect(pp.getByRole('button', { name: 'Recolher todas' })).toBeFocused();
    await pp.getByRole('navigation', { name: 'Fases do PP' }).getByRole('link', { name: 'Fase 3 – Voo Solo' }).click();
    expect(await abertas(page)).toEqual(['false', 'false', 'true']);
    await expect(titulo(page, F3)).toBeFocused();
    await pp.getByRole('button', { name: 'Abrir todas' }).click();
    expect(await abertas(page)).toEqual(['true', 'true', 'true']);
    await expect.poll(async () => (await programaGuardado(page)).alteracoes.map(a => a.descricao)).toEqual(['PP: CT-01 alterada', 'PP: CT-02 passou para a Fase 1']);
    // Recarregada a página, as fases voltam abertas
    await titulo(page, F2).click();
    await page.reload();
    await irPara(page, 'cur');
    expect(await abertas(page)).toEqual(['true', 'true', 'true']);
  });

  // Com todos os cursos encerrados, a aba diz por que não mostra nenhum; com "Mostrar encerrados", o primeiro deles (na
  // ordem dos cursos) fica na tela. Reativado um, sem "Mostrar encerrados" fica só ele
  test('todos os cursos encerrados: o aviso; com "Mostrar encerrados", o primeiro deles', async ({ page }) => {
    await abrirComOsCursos(page, { mudarCursos: cursos => cursos.map(c => ({ ...c, ativo: false })) });
    await irPara(page, 'cur');
    await expect(page.locator('#cursos')).toContainText('Nenhum curso ativo. Marque “Mostrar encerrados” para ver os encerrados.');
    await expect(page.locator('#cursos .curso')).toHaveCount(0);
    await expect(page.locator('#cursos .seg-dos-cursos')).toHaveCount(0);
    await page.locator('#cur-encerrados').check();
    await expect.poll(() => siglasNaAba(page)).toEqual(['PP']);
    await expect(page.locator('#cursos .seg-dos-cursos button')).toHaveText(['PP · Piloto Privado (encerrado)', 'PC · Piloto Comercial (encerrado)', 'INVA · Instrutor de Voo (encerrado)', 'MLTE · Multimotor (encerrado)']);
    await expect(page.locator('#cur-encerrados')).toBeFocused();
    await page.locator('#cur-ver-INVA').click();
    await curso(page, 'INVA').getByRole('button', { name: 'Reativar o curso INVA' }).click();
    await page.locator('#cur-encerrados').uncheck();
    await expect(page.locator('#cursos .seg-dos-cursos button')).toHaveText(['INVA · Instrutor de Voo']);
    await expect.poll(() => siglasNaAba(page)).toEqual(['INVA']);
  });

  // O Gestor (e a Secretaria, no modo compartilhado, acima) só consulta o programa, mas troca de curso, recolhe as fases e
  // usa o índice: nada disso é uma ação (data-act), que quem só consulta não usa
  test('quem só consulta troca de curso, recolhe e abre as fases e usa o índice', async ({ page }) => {
    await abrirComOsCursos(page, { url: './?role=gestor' });
    await irPara(page, 'cur');
    const pp = curso(page, 'PP');
    await expect(pp.locator('input, select, [data-act]')).toHaveCount(0);
    // O título da fase, em texto, é o botão que a recolhe
    await expect(titulo(page, F2)).toHaveText('Fase 2 – O Controle da Aeronave');
    await expect(pp.locator(`.fase[data-fase="${F2}"] h4, .fase[data-fase="${F2}"] h5`)).toHaveText('Fase 2 – O Controle da Aeronave');
    await titulo(page, F2).click();
    await expect(titulo(page, F2)).toHaveAttribute('aria-expanded', 'false');
    await expect(pp.locator(`.fase[data-fase="${F2}"] tbody tr`).first()).toBeHidden();
    await pp.getByRole('button', { name: 'Recolher todas' }).click();
    expect(await abertas(page)).toEqual(['false', 'false', 'false']);
    await pp.getByRole('link', { name: 'Fase 2 – O Controle da Aeronave' }).click();
    await expect(titulo(page, F2)).toBeFocused();
    expect(await abertas(page)).toEqual(['false', 'true', 'false']);
    await page.locator('#cur-ver-PC').click();
    await expect.poll(() => siglasNaAba(page)).toEqual(['PC']);
    await page.locator('#cur-encerrados').check();
    await page.locator('#cur-ver-MLTE').click();
    await expect.poll(() => siglasNaAba(page)).toEqual(['MLTE']);
    await expect(curso(page, 'MLTE').locator('input, select, [data-act]')).toHaveCount(0);
  });

  // O foco de quem usa o teclado sobrevive à aba refeita (trocarConteudo, js/dom.js): o botão do curso (o id), o título
  // da fase (data-recolher-fase), o link do índice (data-ir-fase) e "Recolher todas" (o id)
  test('a aba refeita deixa o foco no botão do curso, no título da fase, no link do índice e em "Recolher todas"', async ({ page }) => {
    await abrirComOsCursos(page);
    await irPara(page, 'cur');
    const refazer = () => page.evaluate(async () => {
      const { rCursos } = await import('./js/views/cursos.js');
      rCursos();
    });
    for (const seletor of ['#cur-ver-INVA', `#cursos [data-recolher-fase="${F2}"]`, `#cursos [data-ir-fase="${F3}"]`, '#fases-recolher']) {
      await page.locator(seletor).focus();
      await refazer();
      await expect(page.locator(seletor), seletor).toBeFocused();
    }
  });

  // Sem nenhum resultado, os três estão na Fase 1; o programa com uma fase só não tem índice, e os alunos vêm pelo nome
  comProgresso('sem resultados, todos na primeira fase; com uma fase só, sem o índice e com os alunos pelo nome', async ({ page }) => {
    await abrirComOsCursos(page, { resultados: [] });
    await irPara(page, 'cur');
    const pp = curso(page, 'PP');
    await pp.locator('details.alunos-do-curso summary').click();
    await expect(pp.locator('.turma-da-fase')).toHaveText(['Fase 1 – Introdução ao Voo (3)']);
    await expect(pp.locator('.indice-das-fases li')).toHaveText(['Fase 1 – Introdução ao Voo 3 alunos', 'Fase 2 – O Controle da Aeronave', 'Fase 3 – Voo Solo']);
    // A Fase 2 e a Fase 3 tiradas do programa (as missões delas levadas para a Fase 1): uma fase só
    for (const fase of [F2, F3]) {
      const missoes = pp.locator(`.fase[data-fase="${fase}"] tbody tr`);
      while (await missoes.count()) await missoes.first().locator('[data-cf="fase"]').selectOption(F1);
      await confirmar(page, `#cursos .fase[data-fase="${fase}"] [data-act="fase-retirar"]`);
    }
    await expect(pp.locator('.fase')).toHaveCount(1);
    await expect(pp.locator('.indice-das-fases')).toHaveCount(0);
    await expect(pp.locator('.turma-da-fase')).toHaveCount(0);
    await expect(pp.locator('details.alunos-do-curso li')).toHaveText(['Ana · 0/8 · próxima IN-01', 'Bruno · 0/8 · próxima IN-01', 'Carla · 0/8 · próxima IN-01']);
    // A fase única também recolhe
    await titulo(page, F1).click();
    await expect(pp.locator('tbody tr').first()).toBeHidden();
  });
});

// No celular (390 px; os testes que mudam a largura dizem qual), vindos de celular.spec.js
test.describe('Celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // O exemplo não tem programa: aqui, a aba Cursos com missões, um cartão por missão (o Ground, com o recurso e as horas
  // desligados)
  test('a aba Cursos com o programa cabe na tela, com alvos de 44 px', async ({ page }) => {
    const cursos = { PP: [{ id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local', eq: 'C152', nb: 1 }, { id: 'PP-02', nome: 'Ground', mis: 'Ground C152', eq: 'Sala Ground', nb: 1.5 }], PC: [], INVA: [] };
    await abrir(page, { estado: { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' })] }), cursos } });
    await irPara(page, 'cur');
    await expect(page.locator('#cursos tr[data-i]')).toHaveCount(2);
    expect(await larguraDaPagina(page)).toBeLessThanOrEqual(390);
    expect(await alvosPequenos(page)).toEqual([]);
  });

  // O programa em fases (gravado neste navegador, como as tabelas dos cursos o guardam): os cabeçalhos das fases, a
  // missão "Depois de…" com a escolha aberta, a fase de cada missão, as retiradas, os alunos do curso e as alterações
  // também cabem na tela, com alvos de 44 px
  test('a aba Cursos em fases cabe na tela, com as caixas abertas e alvos de 44 px', async ({ page }) => {
    const u = n => `00000000-0000-4000-8013-${String(n).padStart(12, '0')}`;
    const modulo = 'Módulo 01 – Treinamento Duplo Comando';
    const conteudo = {
      nome: 'Piloto Privado', ativo: true,
      fases: [{ id: u(1), nome: 'Fase 1 – Introdução ao Voo', modulo }, { id: u(2), nome: 'Fase 2 – O Controle da Aeronave', modulo, regra: 'depois', requer: [u(1)] }],
      missoes: [
        { id: u(11), fase: u(1), codigo: 'IN-01', nome: 'IN-01', mis: 'Voo Local', eq: 'C152', nb: 1 },
        { id: u(12), fase: u(1), codigo: 'IN-02', nome: 'IN-02', mis: 'Ground C152', eq: 'Sala Ground', nb: 1.5, dispensada: true },
        { id: u(13), fase: u(2), codigo: 'AVP-SOLO-05', nome: 'AV PROF. SOLO 05', mis: 'Voo Local', eq: 'C152', nb: 0.3, regra: 'depois', requer: [u(11), u(12)], avaliacao: true },
        { id: u(14), fase: u(2), codigo: 'CT-09', nome: 'CT-09', mis: 'Voo Local', eq: 'C152', nb: 1 }
      ]
    };
    // A CT-09 tirada do programa: fica nas retiradas
    const comCt09 = gravarCurso({ cursos: cursosIniciais() }, { sigla: 'PP', versaoLida: 1, conteudo, descricao: 'PP: cronograma' });
    const semCt09 = gravarCurso({ cursos: comCt09.cursos }, { sigla: 'PP', versaoLida: 2, conteudo: { ...conteudo, missoes: conteudo.missoes.slice(0, 3) }, descricao: 'PP: CT-09 tirada do programa' });
    const { documentos: { cadastro }, dias } = documentosAtuais(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' })] }), AMANHA);
    const docs = {
      acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_cursos: { cursos: semCt09.cursos, alteracoes: [comCt09.alteracao, semCt09.alteracao] }
    };
    await page.addInitScript(json => {
      if (localStorage.getItem('acpm4_cadastro')) return;
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify(docs));
    await page.goto('./');
    await irPara(page, 'cur');
    await expect(page.locator('#cursos .curso[data-curso="PP"] tr[data-i]')).toHaveCount(3);
    for (const resumo of await page.locator('#cursos .curso[data-curso="PP"] summary').all()) await resumo.click();
    // Com "Habilitações que o INVA precisa" de cada uma das 3 missões (F1d)
    await expect(page.locator('#cursos .curso[data-curso="PP"] details[open]')).toHaveCount(8);
    expect(await larguraDaPagina(page)).toBeLessThanOrEqual(390);
    expect(await alvosPequenos(page)).toEqual([]);
    // Os cursos pela sigla e as fases do índice pelo nome curto; as fases recolhidas, também para quem só consulta, e
    // nos 320 px: a aba continua na tela, com alvos de 44 px
    await expect(page.locator('#cursos .seg-dos-cursos button')).toHaveText(['PP', 'PC', 'INVA'], { useInnerText: true });
    await expect(page.locator('#cursos .indice-das-fases a')).toHaveText(['Fase 1', 'Fase 2'], { useInnerText: true });
    await page.locator('#fases-recolher').click();
    await expect(page.locator('#cursos .curso[data-curso="PP"] tr[data-i]:visible')).toHaveCount(0);
    // Para quem muda, a seta da fase fica na linha do nome dela (não sozinha numa linha acima dele), também nos 320 px
    await expect(page.locator('#cursos .fase-cab .nome-da-fase')).toHaveCount(2);
    const setasForaDaLinha = () => page.locator('#cursos .fase-cab').evaluateAll(cabs => cabs.filter(cab => {
      const nome = cab.querySelector('.nome-da-fase');
      if (!nome) return false;
      const seta = cab.querySelector('.fase-titulo').getBoundingClientRect(), campo = nome.getBoundingClientRect();
      return seta.bottom <= campo.top || campo.bottom <= seta.top;
    }).map(cab => cab.closest('.fase').dataset.fase));
    for (const perfil of ['operador', 'gestor']) {
      await page.locator('#role-sel').selectOption(perfil);
      for (const largura of [390, 320]) {
        await page.setViewportSize({ width: largura, height: 844 });
        for (const fases of ['#fases-abrir', '#fases-recolher']) {
          await page.locator(fases).click();
          expect(await larguraDaPagina(page), `${perfil}, ${largura} px, ${fases}`).toBeLessThanOrEqual(largura);
          expect(await alvosPequenos(page), `${perfil}, ${largura} px, ${fases}`).toEqual([]);
          if (perfil === 'operador') expect(await setasForaDaLinha(), `${largura} px, ${fases}`).toEqual([]);
        }
      }
    }
    // O curso encerrado à mostra: o botão dele, com a marca, também cabe nos 320 px
    await page.locator('#role-sel').selectOption('operador');
    await page.locator('#cur-ver-PC').click();
    await confirmar(page, '#cursos .curso[data-curso="PC"] [data-act="curso-encerrar"]');
    await expect(page.locator('#cur-ver-PC')).toHaveText('PC (encerrado)', { useInnerText: true });
    expect(await larguraDaPagina(page)).toBeLessThanOrEqual(320);
    expect(await alvosPequenos(page)).toEqual([]);
  });

  // Com os cursos que o Administrador cria (as siglas com hífen, como PC-IFR) e um encerrado à mostra, os botões dos
  // cursos não encolhem abaixo do texto: a sigla e "(encerrado)" ficam inteiros, e o botão que não cabe vai para a linha de
  // baixo, nos 390 e nos 320 px, para quem muda e para quem só consulta
  test('com muitos cursos, os botões dos cursos ficam inteiros no celular', async ({ page }) => {
    let cursos = cursosIniciais();
    for (const [sigla, nome, ativo] of [['PC-IFR', 'Piloto Comercial IFR', true], ['MLTE', 'Multimotor', false], ['INVA-B', 'Instrutor de Voo (turma B)', true]]) {
      ({ cursos } = gravarCurso({ cursos }, { sigla, versaoLida: 0, conteudo: { nome, ativo, fases: [], missoes: [] }, descricao: `Curso ${sigla} criado: ${nome}` }));
    }
    const { documentos: { cadastro }, dias } = documentosAtuais(cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' })] }), AMANHA);
    const docs = { acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_cursos: { cursos, alteracoes: [] } };
    await page.addInitScript(json => {
      if (localStorage.getItem('acpm4_cadastro')) return;
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify(docs));
    await page.goto('./');
    await irPara(page, 'cur');
    await page.locator('#cur-encerrados').check();
    const botoes = page.locator('#cursos .seg-dos-cursos button');
    // O botão com o texto cortado (mais largo que ele), ou com a sigla ou o "(encerrado)" partidos em duas linhas
    const cortados = () => botoes.evaluateAll(bs => bs.filter(b => {
      const linhas = el => {
        const faixa = document.createRange();
        faixa.selectNodeContents(el);
        return new Set([...faixa.getClientRects()].map(r => Math.round(r.top))).size;
      };
      return b.scrollWidth > b.clientWidth || [...b.querySelectorAll('.sigla, .curso-encerrado')].some(el => linhas(el) > 1);
    }).map(b => `${b.id} ${b.clientWidth}/${b.scrollWidth}`));
    for (const perfil of ['operador', 'gestor']) {
      await page.locator('#role-sel').selectOption(perfil);
      for (const largura of [390, 320]) {
        await page.setViewportSize({ width: largura, height: 844 });
        await expect(botoes).toHaveText(['PP', 'PC', 'INVA', 'PC-IFR', 'MLTE (encerrado)', 'INVA-B'], { useInnerText: true });
        expect(await cortados(), `${perfil}, ${largura} px`).toEqual([]);
        expect(await larguraDaPagina(page), `${perfil}, ${largura} px`).toBeLessThanOrEqual(largura);
        expect(await alvosPequenos(page), `${perfil}, ${largura} px`).toEqual([]);
      }
    }
  });
});

// O leitor de tela, vindo de acessibilidade.spec.js
test.describe('Acessibilidade', () => {
  // A aba Cursos com o programa em fases (o exemplo não tem programa: aqui, o cronograma do PP): os botões dos cursos, o
  // índice das fases, o título de cada fase (o botão que a recolhe; para quem muda, só a seta, com o nome da fase para o
  // leitor de tela) e "Abrir todas" e "Recolher todas" têm nome, para quem muda e para quem só consulta, abertas e
  // recolhidas
  test('a aba Cursos em fases: os cursos, o índice e o título de cada fase têm nome, abertas e recolhidas', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' })] }) });
    await irPara(page, 'cur');
    await confirmar(page, '#cursos [data-act="curso-modelo"]');
    await expect(page.locator('#cursos .fase')).toHaveCount(9);
    await expect(page.locator('#cursos [data-recolher-fase]').first()).toHaveAccessibleName('Fase 1 – Introdução ao Voo');
    await expect(page.locator('#cursos [data-recolher-fase]').first()).toHaveAttribute('aria-expanded', 'true');
    for (const perfil of ['operador', 'gestor']) {
      await page.locator('#role-sel').selectOption(perfil);
      for (const fases of ['#fases-abrir', '#fases-recolher']) {
        await page.locator(fases).click();
        expect(await semNome(page, 'main section.on'), `${perfil}, ${fases}`).toEqual([]);
      }
    }
    await expect(page.getByRole('navigation', { name: 'Fases do PP' }).getByRole('link')).toHaveCount(9);
    await expect(page.getByRole('group', { name: 'Curso' }).getByRole('button', { name: 'PP · Piloto Privado' })).toHaveAttribute('aria-pressed', 'true');
  });
});
