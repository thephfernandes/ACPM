// Aba Agenda de Solicitações (modo local): calendário, prazo das 13:00, registro com "Registrado por", exceção da
// coordenação e cancelamento. O relógio dos testes está em 10/11/2026, 12:00 em São Paulo.
import { test, expect, abrir, irPara, abrirEscala, lerEscala, caixaVoa, campoDaAgenda, dataAberta, diaAnterior, diaSeguinte, importarDaAgenda, registrarPedido, diaDoCalendario, mudarData, botaoDaData } from './fixtures.js';
import { aluno, cenario } from '../helpers/montar.js';

const comAlunos = () => cenario({ stu: [aluno(1000), aluno(1001)] });

test.describe('Agenda de Solicitações', () => {
  test('registra pedidos para amanhã (antes das 13:00) com quem anotou e a hora', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await expect(page.locator('#agenda-data')).toHaveText('quarta-feira, 11/11/2026');
    await expect(page.locator('#agenda-prazo')).toContainText('Pedidos para amanhã (11/11) até hoje às 13:00');

    await registrarPedido(page, { obs: 'Prefere o PR-BTB' });
    const pedidos = page.locator('#agenda-lista tbody tr');
    await expect(pedidos).toHaveCount(1);
    await expect(pedidos.first()).toContainText('Aluno 1000');
    await expect(pedidos.first()).toContainText('Voo Local');
    await expect(pedidos.first()).toContainText('06:30 · 1 h');
    await expect(pedidos.first()).toContainText('Maria');
    await expect(pedidos.first()).toContainText('10/11 12:00');
    await expect(pedidos.first()).toContainText('Prefere o PR-BTB');
    await expect(diaDoCalendario(page, '2026-11-11').locator('.cal-qtd')).toHaveText('1');
    await expect(campoDaAgenda(page, 'por')).toHaveValue('Maria', { timeout: 1000 });

    await registrarPedido(page, { aluno: 'Aluno 1001', missao: 'IFR', horario: '14:30', horas: 2.6, por: 'João' });
    await expect(pedidos).toHaveCount(2);
    await expect(pedidos.nth(1)).toContainText('14:30 · 2,6 h');
    await expect(diaDoCalendario(page, '2026-11-11').locator('.cal-qtd')).toHaveText('2');
  });

  test('o horário oferece os horários da missão: o Multimotor (PA-34), de 30 em 30 minutos; sem períodos', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await expect(campoDaAgenda(page, 'horario').locator('option')).toHaveText(['06:30', '08:20', '10:10', '11:30', '12:40', '13:40', '14:30', '16:20']);
    await campoDaAgenda(page, 'missao').selectOption('Multimotor');
    await expect(campoDaAgenda(page, 'horario').locator('option')).toHaveCount(21);
    await registrarPedido(page, { missao: 'Multimotor', horario: '07:30' });
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('07:30');
    await campoDaAgenda(page, 'missao').selectOption('Noturno');
    await expect(campoDaAgenda(page, 'horario').locator('option')).toHaveText(['17:30']);
    // O Voo Solo sai sempre às 06:30
    await campoDaAgenda(page, 'missao').selectOption('Voo Solo');
    await expect(campoDaAgenda(page, 'horario').locator('option')).toHaveText(['06:30']);
  });

  test('escolher o aluno apaga o erro e a marca de erro dos campos', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await campoDaAgenda(page, 'por').fill('');
    await page.locator('#form-agenda [type="submit"]').click();
    await expect(campoDaAgenda(page, 'erro')).toContainText('Escolha o aluno');
    await expect(campoDaAgenda(page, 'por')).toHaveAttribute('aria-invalid', 'true');
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await expect(campoDaAgenda(page, 'erro')).toBeEmpty();
    for (const campo of ['#ag-aluno', '#ag-por']) await expect(page.locator(campo)).toHaveAttribute('aria-invalid', 'false');
  });

  test('a duração: fracionada, até 5 h; o Ground tem 01h30', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await expect(campoDaAgenda(page, 'horas')).toHaveValue('1');
    await registrarPedido(page, { horas: 6 });
    await expect(campoDaAgenda(page, 'erro')).toHaveText('A duração vai de 0,1 h a 5 h.');
    // O campo errado é o marcado, e o motivo é a descrição dele (o que o leitor de tela diz no campo)
    await expect(campoDaAgenda(page, 'horas')).toHaveAttribute('aria-invalid', 'true');
    await expect(campoDaAgenda(page, 'horas')).toHaveAccessibleDescription('A duração vai de 0,1 h a 5 h.');
    await expect(campoDaAgenda(page, 'aluno')).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(0);
    await campoDaAgenda(page, 'missao').selectOption('Ground C152');
    await expect(campoDaAgenda(page, 'horas')).toBeDisabled();
    await expect(campoDaAgenda(page, 'horas')).toHaveValue('1.5');
  });

  // Duas operadoras podem marcar o mesmo aluno sem saber uma da outra
  test('o aluno que já tem voo marcado na data: o app avisa e pede para confirmar', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await registrarPedido(page, { horario: '06:30' });
    await registrarPedido(page, { horario: '10:10', por: 'Júlia' });
    await expect(campoDaAgenda(page, 'erro')).toHaveText('Aluno 1000 já tem voo marcado em 11/11: Voo Local às 06:30. É um reagendamento ou mais um voo? Para registrar mais este, clique em “Registrar mesmo assim”.');
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await expect(page.locator('#form-agenda [type="submit"]')).toHaveText('Registrar mesmo assim');
    await page.locator('#form-agenda [type="submit"]').click();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(2);
    await expect(page.locator('#form-agenda [type="submit"]')).toHaveText('Registrar pedido');
  });

  // No máximo 6 voos locais (Voo Local, Voo Solo e TGL) no mesmo horário
  test('o 7º voo local no mesmo horário: horário indisponível, com o motivo e o próximo horário possível', async ({ page }) => {
    const alunos = Array.from({ length: 8 }, (_, i) => aluno(1000 + i));
    await abrir(page, { estado: cenario({ stu: alunos }) });
    await irPara(page, 'age');
    for (let i = 0; i < 6; i++) await registrarPedido(page, { aluno: `Aluno ${1000 + i}`, missao: ['Voo Local', 'TGL (TMA)'][i % 2], horario: '08:20' });
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(6);
    await registrarPedido(page, { aluno: 'Aluno 1006', horario: '08:20' });
    await expect(campoDaAgenda(page, 'erro')).toHaveText('Horário indisponível: já há 6 voos locais (Voo Local, Voo Solo e TGL) às 08:20, o máximo no mesmo horário (determinação da diretoria). Próximo horário possível: 10:10.');
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(6);
    await registrarPedido(page, { aluno: 'Aluno 1006', missao: 'Navegação', horario: '08:20' });
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(7);
  });

  test('"Registrado por" é obrigatório', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await registrarPedido(page, { por: '' });
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(0);
  });

  test('fora do prazo não registra; a exceção da coordenação registra marcado', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    // A data do pedido fica no formulário: o Operador vê também as datas encerradas, e a de hoje já fechou
    await mudarData(page, '2026-11-10');
    await campoDaAgenda(page, 'data').selectOption('2026-11-10');
    await expect(page.locator('#agenda-prazo')).toContainText('Prazo encerrado para 10/11');
    await expect(page.locator('#form-agenda [type="submit"]')).toBeDisabled();
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await campoDaAgenda(page, 'por').fill('Coordenação');
    await campoDaAgenda(page, 'excecao').click();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('Exceção da coordenação');
  });

  test('cancelar pede confirmação e o pedido continua na agenda como cancelado', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await registrarPedido(page);
    const cancelar = page.locator('#agenda-lista [data-act="cancelar-pedido"]').first();
    await cancelar.click();
    await expect(cancelar).toHaveText('Confirmar cancelamento');
    await cancelar.click();
    const linha = page.locator('#agenda-lista tbody tr').first();
    await expect(linha.locator('.situacao')).toHaveText('Cancelado por Maria em 10/11 12:00');
    await expect(linha.locator('.situacao .tag')).toHaveAttribute('title', 'Cancelado por Maria em 10/11 12:00');
    await expect(diaDoCalendario(page, '2026-11-11').locator('.cal-qtd')).toHaveCount(0);
    // Numa linha só, esmaecido
    await expect(linha).toHaveClass(/\bcancel\b/);
    expect(await linha.evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(50);
  });

  test('a coluna Situação diz se o pedido já está na demanda; o operador importa pela própria agenda', async ({ page }) => {
    await abrir(page, { estado: cenario({ stu: [aluno(1000, { fly: false }), aluno(1001, { fly: false })] }) });
    await irPara(page, 'age');
    await registrarPedido(page, { aluno: 'Aluno 1000' });
    await registrarPedido(page, { aluno: 'Aluno 1001', horario: '12:40' });
    const situacao = page.locator('#agenda-lista tbody tr .situacao');
    await expect(situacao).toHaveText(['Ainda não importado', 'Ainda não importado']);
    const importar = page.locator('#agenda-importar');
    await expect(importar).toHaveText('Importar 2 pedidos para a demanda');
    await importar.click();
    await expect(situacao).toHaveText(['Na demanda', 'Na demanda']);
    await expect(importar).toBeHidden();
    await expect(page.locator('#linha a.tarefa[data-tarefa="nao-importados"]')).toHaveAttribute('data-estado', 'feito');
    await irPara(page, 'dem');
    await expect(caixaVoa(page.locator('#dem tr[data-k="d"][data-id="1001"]'))).toBeChecked();

    // Outra data aberta no app (o trilho): a Agenda mostra a lista dela, com a situação e o importar dela; o formulário
    // começa nela
    await irPara(page, 'age');
    await mudarData(page, '2026-11-12');
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-11-12');
    await registrarPedido(page, { aluno: 'Aluno 1000' });
    await expect(situacao).toHaveText(['Ainda não importado']);
    await expect(importar).toHaveText('Importar 1 pedido para a demanda');
  });

  test('"Importar Solicitações da Agenda" põe os pedidos da data na demanda, prontos para a escala', async ({ page }) => {
    await abrir(page, { estado: cenario({ stu: [aluno(1000, { fly: false }), aluno(1001, { fly: false })] }) });
    await irPara(page, 'age');
    await registrarPedido(page, { aluno: 'Aluno 1000', horario: '08:20', horas: 2.5 });
    await registrarPedido(page, { aluno: 'Aluno 1001', missao: 'IFR', horario: '14:30' });

    await irPara(page, 'dem');
    await importarDaAgenda(page);
    const linha = id => page.locator(`#dem tr[data-k="d"][data-id="${id}"][data-mid="0"]`);
    await expect(caixaVoa(linha(1000))).toBeChecked();
    await expect(linha(1000).locator('[data-f="jan"]')).toHaveValue('h500');
    await expect(linha(1000).locator('[data-f="nb"]')).toHaveValue('2.5');
    await expect(linha(1001).locator('[data-f="mis"]')).toHaveValue('IFR');
    await expect(linha(1001).locator('[data-f="jan"]')).toHaveValue('h870');
    await expect(page.locator('#audit-log-list')).toContainText('Agenda: Aluno 1000 incluído (Voo Local · às 08:20 · 2,5 h)');

    await importarDaAgenda(page);
    await expect(page.locator('#toast-box')).toContainText('Nenhum pedido novo na agenda para 11/11.');

    await abrirEscala(page);
    const voos = (await lerEscala(page)).linhas.filter(l => /Aluno 100[01]/.test(l));
    expect(voos.find(l => l.includes('Aluno 1000'))).toMatch(/^08:20–10:50/);
    expect(voos.find(l => l.includes('Aluno 1001'))).toMatch(/^14:30/);
  });

  // A lista é a da data aberta (amanhã); o pedido novo começa na primeira data que ainda aceita pedidos
  test('depois das 13:00, amanhã fecha: a lista continua na data aberta, e a data do pedido começa no dia seguinte', async ({ page, context }) => {
    await context.clock.setFixedTime(new Date('2026-11-10T13:30:00-03:00'));
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await expect(page.locator('#agenda-data')).toHaveText('quarta-feira, 11/11/2026');
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-11-12');
    await expect(page.locator('#agenda-prazo')).toHaveText('Pedidos para quinta-feira (12/11) até amanhã (11/11) às 13:00.');
  });

  // Trabalhando numa data à frente, a agenda e as outras abas ficam nela
  test('a agenda mostra a data aberta no app; outra data aberta pelo trilho, a agenda segue', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await mudarData(page, '2026-11-13');
    await irPara(page, 'age');
    await expect(page.locator('#agenda-data')).toContainText('13/11/2026');
    await irPara(page, 'dem');
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-13');
    await irPara(page, 'age');
    await mudarData(page, '2026-11-16');
    await expect(page.locator('#agenda-data')).toContainText('16/11/2026');
    await irPara(page, 'esc');
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-16');
  });

  test('recarregar a página continua na data aberta', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await diaSeguinte(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect(page).toHaveURL(/[?&]data=2026-11-12/);
    await page.reload();
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
  });

  // O aeroclube não opera aos domingos; os voos de segunda são agendados até sábado às 10:00
  test('sábado: o app abre na segunda; a agenda aceita pedidos para segunda até as 10:00; domingo não existe', async ({ page, context }) => {
    await context.clock.setFixedTime(new Date('2026-11-14T09:00:00-03:00'));
    await abrir(page, { estado: comAlunos() });
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-16');
    await irPara(page, 'age');
    await expect(page.locator('#agenda-prazo')).toHaveText('Pedidos para segunda-feira (16/11) até hoje às 10:00.');
    // O domingo não está entre as datas do pedido, e o trilho não o abre
    await expect(campoDaAgenda(page, 'data').locator('option[value="2026-11-15"]')).toHaveCount(0);
    await botaoDaData(page).click();
    await diaDoCalendario(page, '2026-11-15').click({ force: true });
    await expect(page.locator('#toast-box')).toContainText('O aeroclube não opera aos domingos: não há escala nem pedidos.');
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-16');
    // ‹ da segunda vai para o sábado (pula o domingo)
    await diaAnterior(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-14');
    await diaSeguinte(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-16');
  });

  test('um link para um domingo abre a segunda, com o aviso', async ({ page }) => {
    await abrir(page, { estado: comAlunos(), url: './?data=2026-11-15' });
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-16');
    await expect(page.locator('#toast-box')).toContainText('O aeroclube não opera aos domingos: abrimos segunda-feira, 16/11.');
  });
});
