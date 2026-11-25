// Agenda de Solicitações no modo compartilhado: a Secretaria registra pedidos (a escala ela só consulta), o
// Operador usa a exceção da coordenação e o Gestor só consulta. O servidor falso aplica o mesmo prazo do banco.
import { test, expect, entrar, preencherLogin, irPara, abrirMenuDaConta, AMANHA, URL_APP, botaoDaAba, campoDaAgenda, dataAberta, diaSeguinte, importarDaAgenda, rotuloDaData, rotulosDasAbas, escolherNoCalendario, mudarData } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';
import { aluno } from '../helpers/montar.js';

const comAlunos = () => documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000), aluno(1001)] }, AMANHA);

test.describe('Agenda de Solicitações (modo compartilhado)', () => {
  // A Secretaria vai para a Agenda quando os dados terminam de carregar, a menos que já tenha saído da Escala
  const enquantoCarrega = async (page, context, escolher, conta = CONTAS.secretaria) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    const liberar = servidor.segurarLeiturasDeDias();
    await page.goto(URL_APP);
    await preencherLogin(page, conta);
    await expect(page.locator('#usuario')).toBeVisible();
    await escolher();
    liberar();
    await expect(page.locator('body[data-pronto]')).toBeAttached();
  };
  for (const [nome, secao, escolher] of [
    ['Alunos', '#s-alu', page => irPara(page, 'alu')],
    ['o Manual', '#s-manual', page => page.locator('#btn-manual').click()],
    ['Minha conta', '#s-conta', async page => { await abrirMenuDaConta(page); await page.locator('#btn-conta').click(); }]
  ]) {
    test(`a Secretaria que abriu ${nome} enquanto os dados carregavam continua lá`, async ({ page, context }) => {
      await enquantoCarrega(page, context, () => escolher(page));
      await expect(page.locator(secao)).toBeVisible();
      await expect(page.locator('#s-age')).toBeHidden();
    });
  }

  // Voltar enquanto os dados carregam também é uma escolha: a entrada de antes (sem tela no endereço) é a tela da abertura,
  // e ela fica quando os dados chegam
  test('Voltar enquanto os dados carregavam: a Secretaria volta para a tela da abertura dela, a Agenda, e fica lá', async ({ page, context }) => {
    await enquantoCarrega(page, context, async () => {
      await irPara(page, 'cur');
      await page.goBack();
      await expect(page.locator('#s-age')).toBeVisible();
    });
    await expect(page.locator('#s-age')).toBeVisible();
    await expect(page.locator('#s-cur')).toBeHidden();
    await expect(page).toHaveURL(/#\/age$/);
  });

  test('a Agenda aberta enquanto os dados carregavam é lida de novo quando eles chegam (com os alunos)', async ({ page, context }) => {
    await enquantoCarrega(page, context, () => irPara(page, 'age'));
    await expect(page.locator('#s-age')).toBeVisible();
    await expect(campoDaAgenda(page, 'aluno').locator('option', { hasText: 'Aluno 1001' })).toHaveCount(1);
  });

  test('o dia escolhido no trilho enquanto os dados carregavam abre depois, na Agenda e no app', async ({ page, context }) => {
    await enquantoCarrega(page, context, async () => {
      await irPara(page, 'age');
      await escolherNoCalendario(page, '2026-11-13');
    }, CONTAS.operador);
    await expect(page.locator('#agenda-data')).toContainText('13/11');
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-13');
  });

  test('a Secretaria abre na agenda, registra pedidos e só consulta a escala', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    await entrar(page, CONTAS.secretaria);
    await expect(page.locator('#usuario')).toHaveText('Secretaria de Teste · Secretaria');
    await expect(page.locator('#s-age')).toBeVisible();
    await expect(campoDaAgenda(page, 'aluno').locator('option', { hasText: 'Aluno 1001' })).toHaveCount(1);

    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1001' });
    await campoDaAgenda(page, 'horario').selectOption('12:40');
    await campoDaAgenda(page, 'horas').fill('2.5');
    await campoDaAgenda(page, 'por').fill('Maria');
    await page.locator('#form-agenda [type="submit"]').click();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    const pedido = page.locator('#agenda-lista tbody tr').first();
    await expect(pedido.locator('.por')).toHaveText('Maria');
    await expect(pedido.locator('.por')).toHaveAttribute('title', 'Conta: Secretaria de Teste');
    await expect(pedido.locator('.situacao')).toHaveText('Ainda não importado');
    await expect(page.locator('#agenda-importar')).toBeHidden();
    expect(servidor.solicitacoes.map(s => [s.data, s.aluno, s.janela, s.horario, s.horas, s.registrado_por, s.usuario])).toEqual([[AMANHA, 1001, 'horario', '12:40', 2.5, 'Maria', CONTAS.secretaria.id]]);

    // A Secretaria só vê as datas que ainda aceitam pedidos (hoje já fechou), e não há a Exceção da Coordenação para ela
    await expect(campoDaAgenda(page, 'data').locator('option[value="2026-11-10"]')).toHaveCount(0);
    await expect(campoDaAgenda(page, 'data').locator('option').first()).toHaveText('qua 11/11 (amanhã)');
    await expect(campoDaAgenda(page, 'excecao')).toBeHidden();

    // Ela vê a Agenda, a Escala e os Cursos (que só consulta) e, pelos dados pessoais, Instrutores e Alunos
    await expect(rotulosDasAbas(page, { visiveis: true })).toHaveText(['Agenda', 'Escala', 'Aprovar', 'Alunos', 'Instrutores', 'Cursos']);
    await botaoDaAba(page, 'esc').click();
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    expect(servidor.gravacoes).toEqual([]);
  });

  test('o Operador registra fora do prazo pela exceção da coordenação', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    await entrar(page, CONTAS.operador);
    await botaoDaAba(page, 'age').click();
    // A data aberta é a de hoje (a lista dela) e a data do pedido, também: fora do prazo, com a Exceção da Coordenação
    await mudarData(page, '2026-11-10');
    await campoDaAgenda(page, 'data').selectOption('2026-11-10');
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await campoDaAgenda(page, 'por').fill('Coordenação');
    await campoDaAgenda(page, 'excecao').click();
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('Exceção da coordenação');
    expect(servidor.solicitacoes.map(s => [s.data, s.excecao])).toEqual([['2026-11-10', true]]);
  });

  test('o Gestor vê a agenda, sem registrar nem cancelar', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    servidor.solicitacoes.push({ id: 1, data: AMANHA, aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Voo Local', janela: 'manha', horario: null,
      observacao: null, registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: 'Secretaria de Teste', excecao: false, cancelada_em: null, cancelada_por: null });
    await entrar(page, CONTAS.gestor);
    await botaoDaAba(page, 'age').click();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await expect(page.locator('#form-agenda')).toBeHidden();
    await expect(page.locator('#agenda-lista [data-act="cancelar-pedido"]')).toBeHidden();
  });

  // A importação que termina depois de trocar de data não grava nada na data nova
  test('trocar de data durante a importação da agenda cancela a importação', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000, { fly: false })] }, AMANHA));
    servidor.solicitacoes.push({
      id: 1, data: AMANHA, aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Voo Local', janela: 'tarde', horario: null, observacao: null,
      registrado_por: 'Secretaria', registrado_em: '2026-11-10T12:00:00.000Z', excecao: false, cancelada_em: null, cancelada_por: null
    });
    await entrar(page, CONTAS.operador);
    await botaoDaAba(page, 'dem').click();
    const liberar = servidor.segurar('/rest/v1/solicitacoes');
    await importarDaAgenda(page);
    await diaSeguinte(page);
    // A data nova já aberta (o rótulo muda depois de carregar)
    await expect(rotuloDaData(page)).toContainText('12/11');
    liberar();
    await expect(page.locator('#toast-box')).toContainText('A data mudou durante a importação da agenda: nada foi importado.');
    const dia = servidor.dias.get('2026-11-12');
    expect(dia && dia.conteudo.pedidos[1000] && dia.conteudo.pedidos[1000].fly).toBeFalsy();
    expect(servidor.dias.get(AMANHA).conteudo.pedidos[1000].fly).toBe(false);
  });
});
