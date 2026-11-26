// Agenda de Solicitações no modo compartilhado: a Secretaria registra pedidos (a escala ela só consulta), o
// Operador usa a exceção da coordenação e o Gestor só consulta. O servidor falso aplica o mesmo prazo do banco.
import { test, expect, entrar, preencherLogin, irPara, abrirMenuDaConta, AMANHA, URL_APP, vigiarErros, prepararContexto, botaoDaAba, campoDaAgenda, dataAberta, diaSeguinte, importarDaAgenda, registrarPedido, rotuloDaData, rotulosDasAbas, escolherNoCalendario, mudarData } from './fixtures.js';
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
    await campoDaAgenda(page, 'missao').selectOption('Voo Local');
    await campoDaAgenda(page, 'recurso').selectOption('C152');
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
    expect(servidor.solicitacoes.map(s => [s.data, s.aluno, s.janela, s.horario, s.horas, s.recurso, s.registrado_por, s.usuario])).toEqual([[AMANHA, 1001, 'horario', '12:40', 2.5, 'C152', 'Maria', CONTAS.secretaria.id]]);

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
    await campoDaAgenda(page, 'missao').selectOption('Navegação');
    await campoDaAgenda(page, 'recurso').selectOption('PA-34');
    await campoDaAgenda(page, 'horario').selectOption('07:30');
    await campoDaAgenda(page, 'por').fill('Coordenação');
    await campoDaAgenda(page, 'excecao').click();
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('Exceção da coordenação');
    expect(servidor.solicitacoes.map(s => [s.data, s.excecao, s.recurso])).toEqual([['2026-11-10', true, 'PA-34']]);
  });

  test('o Gestor vê a agenda, sem registrar nem cancelar', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    servidor.solicitacoes.push({ id: 1, data: AMANHA, aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Voo Local', janela: 'manha', horario: null,
      observacao: null, registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: 'Secretaria de Teste', excecao: false, cancelada_em: null, cancelada_por: null });
    await entrar(page, CONTAS.gestor);
    await botaoDaAba(page, 'age').click();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    // O pedido de antes, sem o recurso: só a missão
    await expect(page.locator('#agenda-lista tbody td').nth(2)).toHaveText('Voo Local');
    await expect(page.locator('#form-agenda')).toBeHidden();
    await expect(page.locator('#agenda-lista [data-act="cancelar-pedido"]')).toBeHidden();
  });

  // O app novo no ar antes da migração agenda_com_recurso: o recurso padrão da missão ainda é registrado (pela função de
  // antes), o outro não, e nada é registrado duas vezes
  test('o servidor de antes do recurso: só o recurso padrão da missão é registrado, uma vez; o outro diz por quê', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    const servidor = await instalarSupabaseFalso(contexto, { ...comAlunos(), agendaSemRecurso: true });
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [404] });
    await entrar(page, CONTAS.secretaria);
    await registrarPedido(page, { aluno: 'Aluno 1000', missao: 'Navegação', recurso: 'PA-34', horario: '07:30' });
    await expect(campoDaAgenda(page, 'erro')).toHaveText('O servidor precisa ser atualizado para guardar o recurso do pedido: até lá, Navegação só pode ser pedida no C152. Nada foi registrado. Avise a administração do app.');
    await expect(campoDaAgenda(page, 'recurso')).toHaveAttribute('aria-invalid', 'true');
    expect(servidor.solicitacoes).toEqual([]);
    await expect(campoDaAgenda(page, 'aluno')).not.toHaveValue('');
    await registrarPedido(page, { aluno: 'Aluno 1000', missao: 'Navegação', recurso: 'C152', horario: '08:20' });
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    expect(servidor.solicitacoes.map(s => [s.missao, s.horario, Object.hasOwn(s, 'recurso')])).toEqual([['Navegação', '08:20', false]]);
    // A recusa com o botão armado ("Registrar mesmo assim"): escolhido o recurso padrão, ela sai, e o campo não fica marcado
    await registrarPedido(page, { aluno: 'Aluno 1000', missao: 'Navegação', recurso: 'PA-34', horario: '10:00' });
    await expect(campoDaAgenda(page, 'erro')).toContainText('já tem voo marcado');
    await page.locator('#form-agenda [type="submit"]').click();
    await expect(campoDaAgenda(page, 'erro')).toContainText('O servidor precisa ser atualizado');
    await campoDaAgenda(page, 'recurso').selectOption('C152');
    await expect(campoDaAgenda(page, 'recurso')).toHaveAttribute('aria-invalid', 'false');
    await expect(campoDaAgenda(page, 'erro')).toContainText('Aluno 1000 já tem voo marcado');
    expect(servidor.solicitacoes).toHaveLength(1);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // Um clique a mais enquanto o servidor não respondeu não é outro pedido (nem outro voo na demanda)
  test('o segundo clique em "Registrar pedido" antes da resposta não registra de novo', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    await entrar(page, CONTAS.secretaria);
    let chamadas = 0;
    page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/rpc/registrar_solicitacao')) chamadas++; });
    const liberar = servidor.segurar('/rpc/registrar_solicitacao');
    await registrarPedido(page, { aluno: 'Aluno 1000', missao: 'Navegação', recurso: 'PA-34', horario: '07:30' });
    await page.locator('#form-agenda [type="submit"]').click();
    await campoDaAgenda(page, 'por').press('Enter');
    liberar();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await expect(campoDaAgenda(page, 'aluno')).toHaveValue('');
    expect(chamadas).toBe(1);
    // O pedido seguinte é registrado normalmente
    await registrarPedido(page, { aluno: 'Aluno 1001', missao: 'Navegação', recurso: 'PA-34', horario: '08:00' });
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(2);
    expect(servidor.solicitacoes.map(s => [s.aluno, s.horario])).toEqual([[1000, '07:30'], [1001, '08:00']]);
  });

  // A rede que cai no meio do registro: não se sabe se ele chegou, e o app não tenta de novo sozinho
  test('o registro sem resposta não é repetido pela função de antes', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    const servidor = await instalarSupabaseFalso(contexto, comAlunos());
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503], ignorar: [/ERR_FAILED/] });
    let chamadas = 0;
    await page.route('**/rpc/registrar_solicitacao', async route => {
      chamadas++;
      await route.abort();
    });
    await entrar(page, CONTAS.secretaria);
    await registrarPedido(page, { aluno: 'Aluno 1000', missao: 'Navegação', recurso: 'C152', horario: '08:20' });
    await expect(campoDaAgenda(page, 'erro')).toHaveText('Não foi possível registrar o pedido. Verifique a conexão e tente de novo.');
    expect(chamadas).toBe(1);
    expect(servidor.solicitacoes).toEqual([]);
    expect(erros).toEqual([]);
    await contexto.close();
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
