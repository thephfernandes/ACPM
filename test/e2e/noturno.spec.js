// O noturno de dois dias na tela: no dia, 4 h a partir das 17:30 (a Demanda e a Agenda travam a duração); no dia
// seguinte, a volta de BH às 07:30 entra sozinha na escala, com o instrutor, o aluno e o avião livres só às 10:10, e o
// repouso antes dela é um aviso. No programa do curso, o Noturno pode vir em trechos (a ida, a noite e a volta): é um voo
// só, oferecido pela noite
import { test, comProgresso, expect, abrir, irPara, abrirEscala, prepararContexto, vigiarErros, AMANHA, entrar, campoDaAgenda, diaSeguinte, rotuloDaData } from './fixtures.js';
import { criarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';
import { cursosIniciais, gravarCurso } from '../../js/programa.js';

const linha = (page, texto) => page.locator('#out tbody tr:not(.win)', { hasText: texto });
const NOTURNO = { mis: 'Noturno', eq: 'C172', p1: 1050, p2: -1 };

test.describe('Noturno de dois dias', () => {
  test('a Demanda e a Agenda travam a duração do Noturno (4 h no dia e a volta no dia seguinte)', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await irPara(page, 'dem');
    await page.locator('#dem tr[data-k="d"][data-id="1000"] [data-f="mis"]').selectOption('Noturno');
    const duracao = page.locator('#dem tr[data-k="d"][data-id="1000"] [data-f="nb"]');
    await expect(duracao).toBeDisabled();
    await expect(duracao.locator('option:checked')).toHaveText('4 h');
    // Saindo do Noturno, a missão nova começa com a duração dela (não fica com as 4 h)
    await page.locator('#dem tr[data-k="d"][data-id="1000"] [data-f="mis"]').selectOption('Voo Local');
    await expect(page.locator('#dem tr[data-k="d"][data-id="1000"] [data-f="nb"]')).toHaveValue('1');
    await page.locator('#dem tr[data-k="d"][data-id="1000"] [data-f="mis"]').selectOption('Noturno');
    await irPara(page, 'age');
    await campoDaAgenda(page, 'missao').selectOption('Noturno');
    await expect(campoDaAgenda(page, 'recurso')).toHaveValue('C172');
    await expect(campoDaAgenda(page, 'horas')).toHaveValue('4');
    await expect(campoDaAgenda(page, 'horas')).toBeDisabled();
  });

  test('no dia seguinte, a volta de BH entra às 07:30 e ninguém dela voa antes das 10:10', async ({ page }) => {
    // O Aluno 1000 voa o noturno hoje; o Aluno 1001 pede um voo local amanhã às 08:20 com o mesmo instrutor (o único)
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, NOTURNO), aluno(1001, { fly: false })] });
    await abrir(page, { estado });
    await abrirEscala(page);
    const noturno = linha(page, 'Aluno 1000');
    await expect(noturno.locator('.c-hr')).toContainText('17:30–21:30');
    await expect(noturno.locator('.c-missao')).toContainText('translado + 3 h em BH · volta amanhã às 07:30');
    // Uma alteração grava a escala do dia (o dia seguinte lê a escala gravada)
    await noturno.locator('select[data-f="fstatus"]').selectOption('Pendente');

    await diaSeguinte(page);
    await expect(rotuloDaData(page)).toContainText('12/11');
    await abrirEscala(page);
    const volta = linha(page, 'Aluno 1000');
    await expect(volta.locator('.c-hr')).toContainText('07:30–08:30');
    await expect(volta.locator('.c-missao')).toContainText('volta de BH · livres às 10:10');
    await expect(volta.locator('.fixo')).toHaveCount(1);
    // A volta não tem "Tirar da escala" nem a troca do instrutor (é o voo de ontem)
    await expect(volta.locator('[data-act="rm-fly"], [data-act="trocar-instrutor"]')).toHaveCount(0);
    await expect(page.locator('#out details.avisos')).toContainText('9h00 de repouso entre o noturno de ontem (até 21:30) e o translado de volta (07:30)');

    // Um voo pedido às 08:20 com o mesmo instrutor vai para depois das 10:10
    await irPara(page, 'dem');
    await page.locator('#incluir-aluno').fill('Aluno 1001');
    await page.locator('#incluir-aluno').press('Enter');
    await page.locator('#dem tr[data-k="d"][data-id="1001"] [data-f="p1"]').selectOption({ label: '08:20' });
    await abrirEscala(page);
    await expect(linha(page, 'Aluno 1001').locator('.c-hr')).not.toContainText('08:20');
    const inicio = (await linha(page, 'Aluno 1001').locator('.c-hr').innerText()).slice(0, 5);
    expect(inicio >= '10:10', `começou às ${inicio}`).toBe(true);
  });
});

// O Noturno em trechos no programa do PP: a Fase 6 (a ida TSL-01, a noite NOT e a volta TSL-02) abre depois da Fase 4.
// A Demanda oferece o Noturno uma vez, pela noite, com os translados no nome; Usar põe o pedido Noturno com a missão
// NOT; o resultado é da noite, e os translados contam feitos com ela
test.describe('O Noturno em trechos no programa do curso', () => {
  const u = n => `00000000-0000-4000-8e00-${String(n).padStart(12, '0')}`;
  const trecho = (n, codigo, nb, nome) => ({ id: u(n), fase: u(2), codigo, nome: codigo, mis: 'Noturno', eq: 'C172', nb, trecho: nome });

  comProgresso('a Demanda oferece o Noturno uma vez; Usar põe o pedido Noturno com a NOT, e o resultado dela faz os três', async ({ browser }) => {
    const { cursos } = gravarCurso({ cursos: cursosIniciais() }, {
      sigla: 'PP', versaoLida: 1, descricao: 'PP: o Noturno em trechos', conteudo: {
        nome: 'Piloto Privado', ativo: true,
        fases: [{ id: u(1), nome: 'Fase 4 – Manobras' }, { id: u(2), nome: 'Fase 6 – Voo Noturno', regra: 'depois', requer: [u(1)] }],
        missoes: [
          { id: u(11), fase: u(1), codigo: 'TMA-01', nome: 'TMA-01', mis: 'Voo Local', eq: 'C152', nb: 1 },
          trecho(21, 'TSL-01', 1, 'ida'), trecho(22, 'NOT', 3, 'noite'), trecho(23, 'TSL-02', 1, 'volta')
        ]
      }
    });
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { fly: false, p1: 500, p2: -1 }, { curso: 'PP' })] });
    const servidor = criarSupabaseFalso({ ...documentosAtuais(estado, AMANHA), cursos });
    servidor.resultados.push({ id: 1, aluno: 1000, curso: 'PP', missao: 'TMA-01', resultado: 'aprovado', data: '2026-11-09', voo: null, registrado_em: '2026-11-09T12:00:00.000Z', registrado_por: 'Operador de Teste' });
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    await servidor.instalar(contexto);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    await entrar(page, CONTAS.operador);

    await irPara(page, 'alu');
    await expect(page.locator('#alu tr[data-id="1000"] .progresso')).toHaveText('1/4 · Fase 6 · próxima NOT (com TSL-01 e TSL-02)');
    await irPara(page, 'dem');
    await page.locator('#onlyfly').uncheck();
    const pedido = page.locator('#dem tr[data-id="1000"][data-mid="0"]');
    await expect(pedido.locator('[data-act="usar-proxima"]')).toHaveText('Próxima: NOT (com TSL-01 e TSL-02) · Usar');
    // As horas são as do voo (as 4 h do dia, que o pedido recebe), não as da noite no programa (3 h)
    await expect(pedido.locator('[data-act="usar-proxima"]')).toHaveAttribute('title', /^NOT: .* · Noturno · 4 h · C172$/);
    // A lista "Outra missão do curso" também oferece o Noturno uma vez, pela noite; nenhum translado vai sozinho
    await expect(pedido.locator('[data-f="outra-missao"] option'))
      .toHaveText(['Outra missão…', 'NOT (com TSL-01 e TSL-02) · Noturno · C172 · 4 h', 'TMA-01 · Voo Local · C152 · 1 h (já aprovada)']);
    await pedido.locator('[data-act="usar-proxima"]').click();
    await expect(pedido.locator('[data-f="mis"]')).toHaveValue('Noturno');
    await expect(pedido.locator('.etapa')).toHaveText('NOT');
    await expect(pedido.locator('[data-act="usar-proxima"]')).toHaveCount(0);
    // Uma vez só: com o Noturno no pedido, a missão extra do aluno não recebe um translado (TSL-01 ou TSL-02) nem a
    // NOT de novo; sem mais nada no programa, ela fica sem a próxima missão (e sai, para a escala ter só o Noturno)
    await pedido.locator('[data-act="add-mis"]').click();
    const extra = page.locator('#dem tr.extra-row[data-id="1000"]');
    await expect(extra).toHaveCount(1);
    await expect(extra.locator('[data-act="usar-proxima"]')).toHaveCount(0);
    await expect(extra.locator('[data-f="outra-missao"] option'))
      .toHaveText(['Outra missão…', 'TMA-01 · Voo Local · C152 · 1 h (já aprovada)', 'NOT (com TSL-01 e TSL-02) · Noturno · C172 · 4 h (já em outro voo do dia)']);
    await extra.locator('[data-act="del-mis"]').click();
    await extra.locator('[data-act="del-mis"]').click();
    await expect(extra).toHaveCount(0);

    // Na escala: o Noturno das 17:30, com a missão NOT; o resultado vai para ela
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    await expect(voo.locator('.c-hr')).toContainText('17:30–21:30');
    await expect(voo.locator('.c-status .etapa')).toHaveText('NOT');
    await voo.locator('[data-resultado]').selectOption('aprovado');
    await expect.poll(() => servidor.resultados.map(r => r.missao)).toEqual(['TMA-01', 'NOT']);
    await irPara(page, 'alu');
    await expect(page.locator('#alu tr[data-id="1000"] .progresso')).toHaveText('4/4 · concluído');
    expect(erros).toEqual([]);
    await contexto.close();
  });
});
