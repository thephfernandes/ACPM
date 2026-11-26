// Agenda de Solicitações no modo compartilhado: a Secretaria registra pedidos (a escala ela só consulta), o
// Operador usa a exceção da coordenação e o Gestor só consulta. O servidor falso aplica o mesmo prazo do banco.
import { test, expect, entrar, preencherLogin, irPara, abrirMenuDaConta, AMANHA, URL_APP, botaoDaAba, campoDaAgenda, dataAberta, diaSeguinte, escolherNoCalendario, registrarPedido, contagemDoDia, prepararContexto, vigiarErros, importarDaAgenda, rotuloDaData, rotulosDasAbas,
  missaoDoCursoNaAgenda } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';
import { aluno } from '../helpers/montar.js';
import { cursosIniciais, novoCurso } from '../../js/programa.js';
import { MODELOS } from '../../js/modelos-de-curso.js';

const comAlunos = () => documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000), aluno(1001)] }, AMANHA);
const pedidoDe = (id, data, extra = {}) => ({
  id, data, aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Voo Local', janela: 'horario', horario: '08:20', horas: 1, observacao: null,
  registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: 'Secretaria de Teste', excecao: false, cancelada_em: null, cancelada_por: null, ...extra
});
// Segura as leituras dos pedidos de uma data até soltar()
async function segurarPedidos(context, dia) {
  let soltar;
  const espera = new Promise(resolve => { soltar = resolve; });
  await context.route(url => url.pathname.endsWith('/rest/v1/solicitacoes') && url.searchParams.getAll('data').join() === `gte.${dia},lte.${dia}`, async route => { await espera; await route.fallback(); });
  return soltar;
}

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

  test('a data escolhida no calendário enquanto os dados carregavam continua escolhida, na Agenda e no app', async ({ page, context }) => {
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

    // Só as datas que aceitam pedidos: hoje não está na lista dela
    await expect(campoDaAgenda(page, 'data').locator('option').first()).toHaveText('qua 11/11 (amanhã)');
    await expect(campoDaAgenda(page, 'data').locator('option', { hasText: 'prazo encerrado' })).toHaveCount(0);
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
    await campoDaAgenda(page, 'data').selectOption('2026-11-10');
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await campoDaAgenda(page, 'missao').selectOption('Navegação');
    await campoDaAgenda(page, 'recurso').selectOption('PA-34');
    await campoDaAgenda(page, 'horario').selectOption('07:30');
    await campoDaAgenda(page, 'por').fill('Coordenação');
    await campoDaAgenda(page, 'excecao').click();
    await expect(page.locator('#toast-box')).toContainText('Pedido registrado para ter 10/11 pela Exceção da Coordenação.');
    expect(servidor.solicitacoes.map(s => [s.data, s.excecao, s.recurso])).toEqual([['2026-11-10', true, 'PA-34']]);
    // A lista é a da data aberta: aberta a data do pedido, ele aparece nela
    await escolherNoCalendario(page, '2026-11-10');
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('Exceção da coordenação');
  });

  test('a Agenda lê os pedidos da data uma vez e diz enquanto lê e quando não lê', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    await entrar(page, CONTAS.operador);
    let resposta;
    const erro = new Promise(resolve => { resposta = resolve; });
    let doDia12 = true;
    await context.route(url => url.pathname.endsWith('/rest/v1/solicitacoes') && url.searchParams.getAll('data').includes('gte.2026-11-12'), async route => {
      if (!doDia12) { await route.fallback(); return; }
      await erro;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{' });
    });
    await botaoDaAba(page, 'age').click();
    await expect(page.locator('#agenda-lista')).toHaveText('Nenhum pedido para esta data.');
    await diaSeguinte(page);
    await expect(page.locator('#agenda-lista')).toHaveText('Lendo os pedidos desta data…');
    resposta();
    await expect(page.locator('#agenda-lista')).toHaveText('Não foi possível ler os pedidos desta data. Verifique a conexão.');
    // O clique na tela já aberta lê de novo
    doDia12 = false;
    servidor.solicitacoes.push({ id: 1, data: '2026-11-12', aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Voo Local', janela: 'horario', horario: '08:20', horas: 1,
      observacao: null, registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: 'Secretaria de Teste', excecao: false, cancelada_em: null, cancelada_por: null });
    await botaoDaAba(page, 'age').click();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
  });

  // As duas conferências do formulário são da data do pedido, lida uma vez quando o campo muda. Sem os pedidos dela, o
  // servidor recusa o 7º voo local (PT422), e o formulário diz o mesmo aviso, armado
  test('a data do pedido que não é a aberta: os pedidos dela são lidos uma vez; sem eles, o 7º voo local é avisado pela recusa do servidor', async ({ browser }) => {
    const context = await browser.newContext();
    await prepararContexto(context);
    const page = await context.newPage();
    // A recusa do servidor (PT422: o PostgREST responde 422)
    const erros = vigiarErros(page, { statusEsperados: [422] });
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    for (let i = 0; i < 6; i++) {
      servidor.solicitacoes.push({ id: 50 + i, data: '2026-11-13', aluno: 1001, aluno_nome: 'Aluno 1001', missao: 'Voo Local', janela: 'horario', horario: '08:20', horas: 1,
        observacao: null, registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: 'Secretaria de Teste', excecao: false, cancelada_em: null, cancelada_por: null });
    }
    let leituras = 0, falhar = false;
    await context.route(url => url.pathname.endsWith('/rest/v1/solicitacoes') && url.searchParams.getAll('data').join() === 'gte.2026-11-13,lte.2026-11-13', async route => {
      leituras++;
      if (falhar) await route.fulfill({ status: 200, contentType: 'application/json', body: '{' });
      else await route.fallback();
    });
    await entrar(page, CONTAS.operador);
    await irPara(page, 'age');
    await campoDaAgenda(page, 'data').selectOption('2026-11-13');
    await registrarPedido(page, { horario: '08:20' });
    await expect(campoDaAgenda(page, 'erro')).toContainText('Horário cheio: já há 6 voos locais');
    expect(leituras).toBe(1);
    expect(servidor.solicitacoes).toHaveLength(6);
    // A leitura falha: as conferências não são feitas, o servidor recusa, e o aviso é o mesmo; confirmado, o 7º fica registrado
    falhar = true;
    await campoDaAgenda(page, 'data').selectOption('2026-11-12');
    await campoDaAgenda(page, 'data').selectOption('2026-11-13');
    await registrarPedido(page, { aluno: 'Aluno 1000', horario: '08:20' });
    await expect(campoDaAgenda(page, 'erro')).toHaveText('Horário cheio: já há 6 voos locais (Voo Local, Voo Solo e TGL) às 08:20, o máximo no mesmo horário (determinação da diretoria). Próximo horário com vaga: 10:10. Para registrar este como o 7º, clique em “Registrar mesmo assim”.');
    expect(servidor.solicitacoes).toHaveLength(6);
    falhar = false;
    await page.locator('#form-agenda [type="submit"]').click();
    await expect(page.locator('#toast-box')).toContainText('Pedido registrado para sex 13/11.');
    expect(servidor.solicitacoes.map(s => [s.aluno, s.limite_confirmado_por])).toContainEqual([1000, 'Operador de Teste']);
    // Registrado, só duas leituras: os pedidos da data dele e os de cada dia do calendário
    await expect(contagemDoDia(page, '2026-11-13')).toHaveText('7');
    expect(erros).toEqual([]);
    await context.close();
  });

  // A Secretaria lê os programas dos cursos: o aluno de um curso tem as missões dele, e o pedido leva a missão do curso
  test('a Secretaria vê as missões do curso do aluno e registra a missão do curso', async ({ page, context }) => {
    let n = 0;
    const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    const pp = { ...novoCurso([], { sigla: 'PP', nome: 'Piloto Privado', modelo: MODELOS['pp-acpm'] }, uuid).curso, versao: 1 };
    const docs = documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000, {}, { nm: 'Maria', curso: 'PP' }), aluno(1001)] }, AMANHA);
    const servidor = await instalarSupabaseFalso(context, { ...docs, cursos: cursosIniciais().map(c => (c.sigla === 'PP' ? pp : c)) });
    await entrar(page, CONTAS.secretaria);
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Maria' });
    await expect(missaoDoCursoNaAgenda(page, 'NAV-150NM')).toHaveText('NAV-150NM · Navegação · C152 · 3 h');
    await registrarPedido(page, { aluno: 'Maria', codigo: 'NAV-150NM', horario: '10:10' });
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('NAV-150NM · C152');
    expect(servidor.solicitacoes.map(s => [s.missao, s.recurso, s.horas, s.missao_do_curso])).toEqual([['Navegação', 'C152', 3, pp.missoes.find(m => m.codigo === 'NAV-150NM').id]]);
  });

  // Sem os programas lidos, a importação não sabe se a missão do curso do pedido saiu do programa: o pedido espera (não
  // conta como importado), o app diz, e ele entra com ela depois de "Tentar de novo"
  test('importar sem os programas dos cursos lidos: o pedido com a missão do curso espera e entra com ela depois', async ({ browser }) => {
    const context = await browser.newContext();
    await prepararContexto(context);
    const page = await context.newPage();
    let n = 0;
    const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    const pp = { ...novoCurso([], { sigla: 'PP', nome: 'Piloto Privado', modelo: MODELOS['pp-acpm'] }, uuid).curso, versao: 1 };
    const docs = documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000, { fly: false }, { nm: 'Maria', curso: 'PP' }), aluno(1001, { fly: false })] }, AMANHA);
    const servidor = await instalarSupabaseFalso(context, { ...docs, cursos: cursosIniciais().map(c => (c.sigla === 'PP' ? pp : c)) });
    servidor.solicitacoes.push(pedidoDe(1, AMANHA, { aluno_nome: 'Maria', missao: 'Navegação', horas: 3, recurso: 'C152', missao_do_curso: pp.missoes.find(m => m.codigo === 'NAV-150NM').id }),
      pedidoDe(2, AMANHA, { aluno: 1001, aluno_nome: 'Aluno 1001', horario: '10:10', recurso: 'C152' }));
    servidor.falhar('/rpc/programa_dos_cursos');
    const erros = vigiarErros(page, { statusEsperados: [503] });
    await entrar(page, CONTAS.operador);
    await expect(page.locator('#aviso-dados')).toBeVisible();
    await botaoDaAba(page, 'dem').click();
    await importarDaAgenda(page);
    await expect(page.locator('#toast-box')).toContainText('1 pedido(s) da agenda na demanda · 1 pedido com a missão do curso espera os programas dos cursos, que não foram lidos: importe de novo depois de lê-los.');
    await expect.poll(() => servidor.dias.get(AMANHA).conteudo.importadas).toEqual([2]);
    expect(servidor.dias.get(AMANHA).conteudo.pedidos[1000].fly).toBe(false);
    await page.locator('#btn-tentar-dados').click();
    await expect(page.locator('#aviso-dados')).toBeHidden();
    await importarDaAgenda(page);
    await expect(page.locator('#toast-box')).toContainText('1 pedido(s) da agenda na demanda.');
    await expect.poll(() => { const p = servidor.dias.get(AMANHA).conteudo.pedidos[1000]; return [p.fly, p.etapa, p.cursoDaEtapa]; }).toEqual([true, 'NAV-150NM', 'PP']);
    expect(erros).toEqual([]);
    await context.close();
  });

  // Outra pessoa registra para a data do campo, que não é a aberta: abrir a Agenda de novo lê os pedidos dela
  test('a Agenda aberta de novo lê também os pedidos da data do pedido', async ({ page, context }) => {
    await context.clock.setFixedTime(new Date('2026-11-10T13:30:00-03:00'));
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    await entrar(page, CONTAS.operador);
    await irPara(page, 'age');
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-11-12');
    servidor.solicitacoes.push(pedidoDe(1, '2026-11-12'));
    await irPara(page, 'esc');
    await irPara(page, 'age');
    await registrarPedido(page, { horario: '10:10' });
    await expect(campoDaAgenda(page, 'erro')).toContainText('Aluno 1000 já tem voo marcado em 12/11: Voo Local às 08:20.');
    expect(servidor.solicitacoes).toHaveLength(1);
  });

  // A data acabou de abrir e os pedidos dela ainda chegam: o registro espera por eles
  test('registrar enquanto os pedidos da data aberta chegam espera por eles', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    servidor.solicitacoes.push(pedidoDe(1, '2026-11-12'));
    await entrar(page, CONTAS.operador);
    await irPara(page, 'age');
    const soltar = await segurarPedidos(context, '2026-11-12');
    await diaSeguinte(page);
    await expect(page.locator('#agenda-lista')).toHaveText('Lendo os pedidos desta data…');
    await registrarPedido(page, { horario: '10:10' });
    const registrar = page.locator('#form-agenda [type="submit"]');
    await expect(registrar).toHaveText('Registrando…');
    soltar();
    await expect(campoDaAgenda(page, 'erro')).toContainText('Aluno 1000 já tem voo marcado em 12/11: Voo Local às 08:20.');
    await expect(registrar).toHaveText('Registrar mesmo assim');
    expect(servidor.solicitacoes).toHaveLength(1);
  });

  test('dois cliques em Registrar enquanto os pedidos da outra data chegam registram um pedido só', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    await entrar(page, CONTAS.operador);
    await irPara(page, 'age');
    const soltar = await segurarPedidos(context, '2026-11-13');
    await campoDaAgenda(page, 'data').selectOption('2026-11-13');
    await registrarPedido(page, { horario: '10:10' });
    const registrar = page.locator('#form-agenda [type="submit"]');
    await expect(registrar).toHaveText('Registrando…');
    await expect(page.locator('#form-agenda')).toHaveAttribute('aria-busy', 'true');
    await registrar.click();
    soltar();
    await expect(page.locator('#toast-box')).toContainText('Pedido registrado para sex 13/11.');
    await expect(registrar).toHaveText('Registrar pedido');
    await expect(page.locator('#form-agenda')).not.toHaveAttribute('aria-busy');
    await expect(contagemDoDia(page, '2026-11-13')).toHaveText('1');
    expect(servidor.solicitacoes).toHaveLength(1);
    // O seguinte já vê o registrado
    await registrarPedido(page, { horario: '10:10' });
    await expect(campoDaAgenda(page, 'erro')).toContainText('Aluno 1000 já tem voo marcado em 13/11: Voo Local · C152 às 10:10.');
    expect(servidor.solicitacoes).toHaveLength(1);
  });

  test('a exceção da coordenação também registra uma vez só, e o botão volta ao nome dele', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    await entrar(page, CONTAS.operador);
    await irPara(page, 'age');
    const excecao = campoDaAgenda(page, 'excecao');
    const nome = await excecao.textContent();
    const soltar = await segurarPedidos(context, '2026-11-10');
    await campoDaAgenda(page, 'data').selectOption('2026-11-10');
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await campoDaAgenda(page, 'missao').selectOption('Voo Local');
    await campoDaAgenda(page, 'recurso').selectOption('C152');
    await campoDaAgenda(page, 'horario').selectOption('06:30');
    await campoDaAgenda(page, 'por').fill('Coordenação');
    await excecao.click();
    await expect(excecao).toHaveText('Registrando…');
    await excecao.click();
    soltar();
    await expect(page.locator('#toast-box')).toContainText('Pedido registrado para ter 10/11 pela Exceção da Coordenação.');
    await expect(excecao).toHaveText(nome);
    expect(servidor.solicitacoes).toHaveLength(1);
  });

  test('cancelar lê de novo os pedidos da data e os de cada dia do calendário', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    servidor.solicitacoes.push(pedidoDe(1, AMANHA));
    await entrar(page, CONTAS.operador);
    await irPara(page, 'age');
    await campoDaAgenda(page, 'por').fill('Maria');
    const cancelar = page.locator('#agenda-lista [data-act="cancelar-pedido"]');
    await expect(contagemDoDia(page, AMANHA)).toHaveText('1');
    await cancelar.click();
    // Enquanto isso, outra pessoa registrou para o dia 13
    servidor.solicitacoes.push(pedidoDe(2, '2026-11-13'));
    await cancelar.click();
    await expect(contagemDoDia(page, '2026-11-13')).toHaveText('1');
    await expect(contagemDoDia(page, AMANHA)).toHaveCount(0);
    await expect(page.locator('#agenda-lista tbody tr')).toHaveClass(/\bcancel\b/);
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
  test('o registro sem resposta não é repetido', async ({ browser }) => {
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
