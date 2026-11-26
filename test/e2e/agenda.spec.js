// A Agenda de Solicitações (modo local): a lista da data aberta, a "Data do pedido" e o prazo das 13:00, o registro com
// "Registrado por", a exceção da coordenação e o cancelamento. O relógio dos testes está em 10/11/2026, 12:00 em São Paulo.
import { test, expect, abrir, irPara, abrirEscala, lerEscala, caixaVoa, campoDaAgenda, contagemDoDia, dataAberta, diaAnterior, diaSeguinte, importarDaAgenda, mudarData, registrarPedido } from './fixtures.js';
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
    await expect(contagemDoDia(page, '2026-11-11')).toHaveText('1');
    await expect(campoDaAgenda(page, 'por')).toHaveValue('Maria', { timeout: 1000 });

    await registrarPedido(page, { aluno: 'Aluno 1001', missao: 'IFR', horario: '14:30', horas: 2.6, por: 'João' });
    await expect(pedidos).toHaveCount(2);
    await expect(pedidos.nth(1)).toContainText('IFR · C172');
    await expect(pedidos.nth(1)).toContainText('14:30 · 2,6 h');
    await expect(contagemDoDia(page, '2026-11-11')).toHaveText('2');
  });

  test('o horário oferece os horários da missão: o Multimotor (PA-34), de 30 em 30 minutos; sem períodos', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await expect(campoDaAgenda(page, 'horario').locator('option')).toHaveText(['Escolha o horário…']);
    await campoDaAgenda(page, 'missao').selectOption('Multimotor');
    await expect(campoDaAgenda(page, 'horario').locator('option')).toHaveCount(22);
    await registrarPedido(page, { missao: 'Multimotor', horario: '07:30' });
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('07:30');
    await campoDaAgenda(page, 'missao').selectOption('Noturno');
    await expect(campoDaAgenda(page, 'horario').locator('option')).toHaveText(['17:30']);
    // O Voo Solo sai sempre às 06:30
    await campoDaAgenda(page, 'missao').selectOption('Voo Solo');
    await campoDaAgenda(page, 'recurso').selectOption('C172');
    await expect(campoDaAgenda(page, 'horario').locator('option')).toHaveText(['06:30']);
  });

  const horarios = page => campoDaAgenda(page, 'horario').locator('option');
  const DE_30_EM_30 = ['06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  const JANELAS = ['06:30', '08:20', '10:10', '11:30', '12:40', '13:40', '14:30', '16:20'];

  // A missão decide o recurso, e os dois, os horários: o pedido no PA-34 nunca sai num horário do C152
  test('a missão decide os recursos; o horário só abre com o aluno, a missão e o recurso, e são os do recurso', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    const [aluno, missao, recurso, horario, motivo] = ['aluno', 'missao', 'recurso', 'horario', 'horario-motivo'].map(c => campoDaAgenda(page, c));
    await expect(missao).toHaveValue('');
    await expect(missao.locator('option:checked')).toHaveText('Escolha a missão…');
    await expect(recurso).toBeDisabled();
    await expect(horario).toBeDisabled();
    await expect(motivo).toHaveText('Antes, escolha o aluno, a missão e o recurso.');
    await expect(motivo).toBeVisible();
    await expect(motivo).toHaveAttribute('aria-live', 'polite');
    await expect(horario).toHaveAccessibleDescription(/Antes, escolha o aluno, a missão e o recurso\./);

    // Vários recursos permitidos: nenhum escolhido; a ordem de preencher é livre
    await missao.selectOption('Navegação');
    await expect(recurso).toBeEnabled();
    await expect(recurso.locator('option')).toHaveText(['Escolha o recurso…', 'C152', 'C172', 'PA-34']);
    await expect(recurso).toHaveValue('');
    await expect(motivo).toHaveText('Antes, escolha o aluno e o recurso.');
    await recurso.selectOption('PA-34');
    await expect(horario).toBeDisabled();
    await expect(motivo).toHaveText('Antes, escolha o aluno.');
    await aluno.selectOption({ label: 'Aluno 1000' });
    await expect(horario).toBeEnabled();
    await expect(motivo).toBeEmpty();
    await expect(horarios(page)).toHaveText(['Escolha o horário…', ...DE_30_EM_30]);
    await expect(horario).toHaveValue('');
    await recurso.selectOption('C152');
    await expect(horarios(page)).toHaveText(['Escolha o horário…', ...JANELAS]);

    // Um recurso só permitido: escolhido sozinho; ao sair da missão, ele não fica para a próxima
    await missao.selectOption('Multimotor');
    await expect(recurso.locator('option')).toHaveText(['PA-34']);
    await expect(recurso).toHaveValue('PA-34');
    await expect(horarios(page)).toHaveText(['Escolha o horário…', ...DE_30_EM_30]);
    await missao.selectOption('Simulador');
    await expect(recurso.locator('option')).toHaveText(['Escolha o recurso…', 'Sim. Mono', 'Sim. Multi']);
    await expect(recurso).toHaveValue('');
    await expect(horario).toBeDisabled();
    await missao.selectOption('Ground PA-34');
    await expect(recurso).toHaveValue('Sala Ground');
    await expect(horarios(page)).toHaveText(['Escolha o horário…', ...JANELAS]);

    // Sem missão de novo: tudo volta a esperar
    await missao.selectOption('');
    await expect(recurso).toBeDisabled();
    await expect(horario).toBeDisabled();
    await expect(motivo).toHaveText('Antes, escolha a missão e o recurso.');
  });

  test('trocar a missão ou o recurso mantém o horário que a lista nova tem; o outro sai, e o app diz', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    const [missao, recurso, horario, motivo] = ['missao', 'recurso', 'horario', 'horario-motivo'].map(c => campoDaAgenda(page, c));
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await missao.selectOption('Voo Local');
    await recurso.selectOption('C152');
    await horario.selectOption('11:30');
    // O recurso escolhido pela pessoa continua na missão que o permite, e o horário também
    await missao.selectOption('Navegação');
    await expect(recurso).toHaveValue('C152');
    await expect(horario).toHaveValue('11:30');
    await recurso.selectOption('PA-34');
    await expect(horario).toHaveValue('11:30');
    await expect(motivo).toBeEmpty();
    await horario.selectOption('12:00');
    await recurso.selectOption('C172');
    await expect(horario).toHaveValue('');
    await expect(motivo).toHaveText('O horário 12:00 não é um dos de Navegação (C172). Escolha outro.');
    await horario.selectOption('08:20');
    await expect(motivo).toBeEmpty();
    // Enquanto o recurso não é escolhido, o horário espera a lista
    await recurso.selectOption('');
    await expect(horario).toBeDisabled();
    await recurso.selectOption('C152');
    await expect(horario).toHaveValue('08:20');
    await missao.selectOption('Noturno');
    await expect(horario).toHaveValue('17:30');
    await expect(motivo).toHaveText('O horário 08:20 não é um dos de Noturno (C172). Agora é 17:30.');
    // O Voo Solo tem um horário só; o escolhido antes volta na missão que o tem, e o app diz
    await missao.selectOption('Voo Solo');
    await expect(recurso).toHaveValue('');
    await recurso.selectOption('C152');
    await expect(horario).toHaveValue('06:30');
    await expect(motivo).toHaveText('O horário 08:20 não é um dos de Voo Solo (C152). Agora é 06:30.');
    await missao.selectOption('Parafuso');
    await expect(horario).toHaveValue('08:20');
    await expect(motivo).toHaveText('O horário agora é 08:20.');
    await horario.selectOption('10:10');
    await expect(motivo).toBeEmpty();
  });

  test('o horário posto pelo app (o único da missão) não fica para a seguinte, e o app diz', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    const [missao, horario, motivo] = ['missao', 'horario', 'horario-motivo'].map(c => campoDaAgenda(page, c));
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await missao.selectOption('Voo Solo');
    await campoDaAgenda(page, 'recurso').selectOption('C152');
    await expect(horario).toHaveValue('06:30');
    await expect(motivo).toBeEmpty();
    await missao.selectOption('Voo Local');
    await expect(horario).toHaveValue('');
    await expect(motivo).toHaveText('O horário 06:30 era o único da escolha anterior. Escolha o horário.');
    // O teclado, que passa por cada missão da lista: o horário escolhido não se perde no Voo Solo
    await horario.selectOption('11:30');
    await expect(motivo).toBeEmpty();
    for (const m of ['TGL (TMA)', 'Navegação', 'Voo Solo']) await missao.selectOption(m);
    await expect(motivo).toHaveText('O horário 11:30 não é um dos de Voo Solo (C152). Agora é 06:30.');
    // Outro aluno: o horário é o mesmo, sem o aviso de novo
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1001' });
    await expect(horario).toHaveValue('06:30');
    await expect(motivo).toBeEmpty();
    await missao.selectOption('Parafuso');
    await expect(horario).toHaveValue('11:30');
    await expect(motivo).toHaveText('O horário agora é 11:30.');
    // Registrado no Voo Solo, o horário escolhido antes não vale mais
    await missao.selectOption('Voo Solo');
    await campoDaAgenda(page, 'por').fill('Maria');
    await page.locator('#form-agenda [type="submit"]').click();
    await expect(page.locator('#agenda-lista tbody tr')).toContainText(['06:30']);
    await missao.selectOption('Parafuso');
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await expect(horario).toHaveValue('');
  });

  test('a missão, o recurso e o horário são obrigatórios, com o erro no campo certo', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    const enviar = () => page.locator('#form-agenda [type="submit"]').click();
    const [missao, recurso, horario, erro] = ['missao', 'recurso', 'horario', 'erro'].map(c => campoDaAgenda(page, c));
    const invalidos = async (...campos) => {
      for (const campo of ['aluno', 'missao', 'recurso', 'horario', 'horas', 'por']) await expect(campoDaAgenda(page, campo), campo).toHaveAttribute('aria-invalid', String(campos.includes(campo)));
    };
    await enviar();
    await expect(erro).toHaveText('Escolha o aluno e a missão. Informe quem anotou o pedido (“Registrado por”).');
    await invalidos('aluno', 'missao', 'por');
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await campoDaAgenda(page, 'por').fill('Maria');
    await missao.selectOption('IFR');
    await expect(erro).toBeEmpty();
    await enviar();
    await expect(erro).toHaveText('Escolha o recurso.');
    await invalidos('recurso');
    await expect(recurso).toHaveAccessibleDescription('Escolha o recurso.');
    await recurso.selectOption('PA-34');
    await enviar();
    await expect(erro).toHaveText('Escolha o horário.');
    await invalidos('horario');
    await expect(horario).toHaveAccessibleDescription('Escolha o horário.');
    await horario.selectOption('07:00');
    await invalidos();
    await expect(erro).toBeEmpty();
    await enviar();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('IFR · PA-34');

    // Depois de registrar, saem o aluno e a observação; a missão, o recurso e o horário ficam, e o horário espera o aluno
    await expect(campoDaAgenda(page, 'aluno')).toHaveValue('');
    await expect(missao).toHaveValue('IFR');
    await expect(recurso).toHaveValue('PA-34');
    await expect(horario).toBeDisabled();
    await expect(campoDaAgenda(page, 'horario-motivo')).toHaveText('Antes, escolha o aluno.');
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1001' });
    await expect(horario).toBeEnabled();
    await expect(horario).toHaveValue('07:00');
  });

  // Antes, a lista era feita uma vez só: o horário tirado do cadastro continuava sendo oferecido
  test('os horários acompanham o cadastro no redesenho, sem tirar o foco nem o que foi digitado', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    const [horario, motivo, obs] = ['horario', 'horario-motivo', 'obs'].map(c => campoDaAgenda(page, c));
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await campoDaAgenda(page, 'missao').selectOption('Navegação');
    await campoDaAgenda(page, 'recurso').selectOption('PA-34');
    await horario.selectOption('07:30');
    await campoDaAgenda(page, 'horas').fill('2.4');
    await obs.fill('Prefere o PT-JOB');
    const trocar = lista => page.evaluate(async novos => {
      const { S } = await import('/js/state.js');
      S.horarios = { ...S.horarios, 'PA-34': novos };
      (await import('/js/redesenho.js')).redesenhar('dados');
    }, lista);
    await obs.focus();
    await trocar([390, 450, 540]);
    await expect(horarios(page)).toHaveText(['Escolha o horário…', '06:30', '07:30', '09:00']);
    await expect(horario).toHaveValue('07:30');
    await expect(motivo).toBeEmpty();
    await expect(obs).toBeFocused();
    await horario.focus();
    await trocar([390, 540]);
    await expect(horario).toHaveValue('');
    await expect(horario).toBeFocused();
    await expect(motivo).toHaveText('O horário 07:30 não é um dos de Navegação (PA-34). Escolha outro.');
    await expect(campoDaAgenda(page, 'horas')).toHaveValue('2.4');
    await expect(obs).toHaveValue('Prefere o PT-JOB');
    await expect(campoDaAgenda(page, 'recurso')).toHaveValue('PA-34');
    // O cadastro que mudou sem redesenhar: o envio confere a lista
    await horario.selectOption('09:00');
    await campoDaAgenda(page, 'por').fill('Maria');
    await page.evaluate(async () => { const { S } = await import('/js/state.js'); S.horarios = { ...S.horarios, 'PA-34': [390] }; });
    await page.locator('#form-agenda [type="submit"]').click();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(0);
    await expect(motivo).toHaveText('O horário 09:00 não é um dos de Navegação (PA-34). Agora é 06:30.');
  });

  test('o pedido no PA-34 entra na demanda e na escala no PA-34, no horário dele', async ({ page }) => {
    await abrir(page, { estado: cenario({ stu: [aluno(1000, { fly: false })] }) });
    await irPara(page, 'age');
    await registrarPedido(page, { missao: 'Navegação', recurso: 'PA-34', horario: '07:30' });
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('Navegação · PA-34');
    await irPara(page, 'dem');
    await importarDaAgenda(page);
    const linha = page.locator('#dem tr[data-k="d"][data-id="1000"][data-mid="0"]');
    await expect(linha.locator('[data-f="eq"]')).toHaveValue('PA-34');
    await expect(linha.locator('[data-f="jan"]')).toHaveValue('h450');
    await abrirEscala(page);
    expect((await lerEscala(page)).linhas.find(l => l.includes('Aluno 1000'))).toMatch(/^07:30/);
  });

  test('o 7º voo local no PA-34: o próximo horário possível é um do PA-34', async ({ page }) => {
    await abrir(page, { estado: cenario({ stu: Array.from({ length: 8 }, (_, i) => aluno(1000 + i)) }) });
    await irPara(page, 'age');
    for (let i = 0; i < 6; i++) await registrarPedido(page, { aluno: `Aluno ${1000 + i}`, horario: '06:30' });
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(6);
    await registrarPedido(page, { aluno: 'Aluno 1006', recurso: 'PA-34', horario: '06:30' });
    await expect(campoDaAgenda(page, 'erro')).toContainText('Próximo horário possível: 07:00.');
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(6);
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
    await expect(campoDaAgenda(page, 'erro')).toHaveText('Aluno 1000 já tem voo marcado em 11/11: Voo Local · C152 às 06:30. É um reagendamento ou mais um voo? Para registrar mais este, clique em “Registrar mesmo assim”.');
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await expect(page.locator('#form-agenda [type="submit"]')).toHaveText('Registrar mesmo assim');
    await page.locator('#form-agenda [type="submit"]').click();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(2);
    await expect(page.locator('#form-agenda [type="submit"]')).toHaveText('Registrar pedido');
  });

  // Com o botão armado, um erro de outro campo substitui o aviso: corrigido o campo, o aviso volta, e o campo não fica marcado
  test('com "Registrar mesmo assim", o erro de um campo sai quando ele é corrigido, e o aviso do voo já marcado volta', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    const [recurso, horario, erro] = ['recurso', 'horario', 'erro'].map(c => campoDaAgenda(page, c));
    const enviar = page.locator('#form-agenda [type="submit"]');
    const aviso = 'Aluno 1000 já tem voo marcado em 11/11: Voo Local · C152 às 06:30. É um reagendamento ou mais um voo? Para registrar mais este, clique em “Registrar mesmo assim”.';
    await registrarPedido(page, { horario: '06:30' });
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await registrarPedido(page, { missao: 'Navegação', recurso: 'PA-34', horario: '07:00' });
    await expect(erro).toHaveText(aviso);
    await recurso.selectOption('C152');
    await expect(erro).toHaveText(aviso);
    await enviar.click();
    await expect(erro).toHaveText('Escolha o horário.');
    await expect(horario).toHaveAttribute('aria-invalid', 'true');
    await horario.selectOption('08:20');
    await expect(horario).toHaveAttribute('aria-invalid', 'false');
    await expect(erro).toHaveText(aviso);
    await expect(enviar).toHaveText('Registrar mesmo assim');
    // Noutra data, o aviso e o botão armado não valem
    await mudarData(page, '2026-11-12');
    await horario.selectOption('10:10');
    await expect(erro).toBeEmpty();
    await expect(enviar).toHaveText('Registrar pedido');
    await enviar.click();
    await expect(page.locator('#agenda-lista tbody tr')).toContainText(['Navegação · C152']);
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
    await campoDaAgenda(page, 'data').selectOption('2026-11-10');
    await expect(page.locator('#agenda-prazo')).toContainText('Prazo encerrado para 10/11');
    await expect(page.locator('#form-agenda [type="submit"]')).toBeDisabled();
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await campoDaAgenda(page, 'missao').selectOption('Voo Local');
    await campoDaAgenda(page, 'recurso').selectOption('C152');
    await campoDaAgenda(page, 'horario').selectOption('08:20');
    await campoDaAgenda(page, 'por').fill('Coordenação');
    await campoDaAgenda(page, 'excecao').click();
    await expect(page.locator('#toast-box')).toContainText('Pedido registrado para ter 10/11 pela Exceção da Coordenação.');
    // A lista é a da data aberta: o pedido está no dia 10
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(0);
    await expect(contagemDoDia(page, '2026-11-10')).toHaveText('1');
    await mudarData(page, '2026-11-10');
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('Exceção da coordenação');
  });

  // A data do pedido é um campo dele: a data aberta no app não muda, e o campo volta a ela quando ela muda
  test('a data do pedido não muda a data aberta; fica entre um registro e outro e volta quando outra data abre', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    const data = campoDaAgenda(page, 'data');
    await expect(data).toHaveValue('2026-11-11');
    await expect(data.locator('option')).toHaveCount(13);
    await data.selectOption('2026-11-13');
    await expect(page.locator('#agenda-prazo')).toHaveText('Pedidos para sexta-feira (13/11) até quinta-feira (12/11) às 13:00.');
    await expect(data).toHaveAccessibleDescription('Pedidos para sexta-feira (13/11) até quinta-feira (12/11) às 13:00.');
    await expect(page.locator('#agenda-data')).toHaveText('quarta-feira, 11/11/2026');
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-11');
    await registrarPedido(page, { horario: '08:20' });
    await expect(page.locator('#toast-box')).toContainText('Pedido registrado para sex 13/11.');
    await expect(contagemDoDia(page, '2026-11-13')).toHaveText('1');
    await expect(data).toHaveValue('2026-11-13');
    // Os pedidos da data do campo valem para o aviso de voo já marcado; trocar a data desfaz a confirmação
    await registrarPedido(page, { horario: '10:10' });
    await expect(campoDaAgenda(page, 'erro')).toContainText('Aluno 1000 já tem voo marcado em 13/11: Voo Local · C152 às 08:20.');
    await data.selectOption('2026-11-12');
    await expect(campoDaAgenda(page, 'erro')).toBeEmpty();
    await expect(page.locator('#form-agenda [type="submit"]')).toHaveText('Registrar pedido');
    await mudarData(page, '2026-11-14');
    await expect(data).toHaveValue('2026-11-14');
  });

  // A data do campo pode ser a mesma enquanto a data aberta muda: os pedidos dela, lidos antes, podem ter mudado
  test('a data do pedido que continua a mesma: o aviso do voo já marcado vê o pedido registrado com ela aberta', async ({ page, context }) => {
    await context.clock.setFixedTime(new Date('2026-11-10T13:30:00-03:00'));
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-11-12');
    await mudarData(page, '2026-11-12');
    await registrarPedido(page, { horario: '08:20' });
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await mudarData(page, '2026-11-11');
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-11-12');
    await registrarPedido(page, { horario: '10:10' });
    await expect(campoDaAgenda(page, 'erro')).toContainText('Aluno 1000 já tem voo marcado em 12/11: Voo Local · C152 às 08:20.');
    await expect(contagemDoDia(page, '2026-11-12')).toHaveText('1');
  });

  test('a data de hoje, já fechada, aberta: o pedido continua o de amanhã, com o aviso do voo já marcado', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await registrarPedido(page, { horario: '06:30' });
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await mudarData(page, '2026-11-10');
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-11-11');
    await registrarPedido(page, { horario: '10:10' });
    await expect(campoDaAgenda(page, 'erro')).toContainText('Aluno 1000 já tem voo marcado em 11/11: Voo Local · C152 às 06:30.');
    await expect(contagemDoDia(page, '2026-11-11')).toHaveText('1');
  });

  // O Gestor (deste navegador) não registra: os pedidos da data do campo são lidos quando o perfil passa a registrar, e as
  // datas seguem o perfil
  test('trocar o perfil para o Operador com a Agenda aberta: as datas da exceção e o aviso do voo já marcado', async ({ page, context }) => {
    await context.clock.setFixedTime(new Date('2026-11-10T13:30:00-03:00'));
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await registrarPedido(page, { horario: '08:20' });
    await expect(contagemDoDia(page, '2026-11-12')).toHaveText('1');
    await abrir(page, { url: './?role=gestor' });
    await irPara(page, 'age');
    const primeira = campoDaAgenda(page, 'data').locator('option').first();
    await expect(primeira).toHaveText('qui 12/11');
    await page.locator('#role-sel').selectOption('operador');
    await expect(primeira).toHaveText('ter 10/11 (hoje) · prazo encerrado');
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-11-12');
    await registrarPedido(page, { horario: '10:10' });
    await expect(campoDaAgenda(page, 'erro')).toContainText('Aluno 1000 já tem voo marcado em 12/11: Voo Local · C152 às 08:20.');
    await expect(contagemDoDia(page, '2026-11-12')).toHaveText('1');
  });

  test('a data aberta além de duas semanas também está na data do pedido', async ({ page }) => {
    await abrir(page, { estado: comAlunos(), url: './?data=2026-12-18' });
    await irPara(page, 'age');
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-12-18');
    await expect(campoDaAgenda(page, 'data').locator('option').last()).toHaveText('sex 18/12');
  });

  test('cancelar pede confirmação e o pedido continua na agenda como cancelado', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await registrarPedido(page);
    const cancelar = page.locator('#agenda-lista [data-act="cancelar-pedido"]').first();
    await cancelar.click();
    await expect(cancelar).toHaveText('Confirmar cancelamento: Voo Local · C152');
    await cancelar.click();
    const linha = page.locator('#agenda-lista tbody tr').first();
    await expect(linha.locator('.situacao')).toHaveText('Cancelado por Maria em 10/11 12:00');
    await expect(linha.locator('.situacao .tag')).toHaveAttribute('title', 'Cancelado por Maria em 10/11 12:00');
    await expect(contagemDoDia(page, '2026-11-11')).toHaveCount(0);
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

    // Outra data aberta: a situação e o importar são dela
    await irPara(page, 'age');
    await mudarData(page, '2026-11-12');
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

  test('depois das 13:00, a lista é a da data aberta, amanhã, e o pedido começa no dia seguinte', async ({ page, context }) => {
    await context.clock.setFixedTime(new Date('2026-11-10T13:30:00-03:00'));
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await expect(page.locator('#agenda-data')).toHaveText('quarta-feira, 11/11/2026');
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-11-12');
    await expect(campoDaAgenda(page, 'data').locator('option').nth(0)).toHaveText('ter 10/11 (hoje) · prazo encerrado');
    await expect(campoDaAgenda(page, 'data').locator('option').nth(1)).toHaveText('qua 11/11 (amanhã) · prazo encerrado');
    await expect(campoDaAgenda(page, 'data').locator('option').nth(2)).toHaveText('qui 12/11');
    await expect(page.locator('#agenda-prazo')).toHaveText('Pedidos para quinta-feira (12/11) até amanhã (11/11) às 13:00.');
  });

  // Trabalhando numa data à frente, a agenda e as outras abas ficam nela
  test('a agenda segue a data aberta, e a data do pedido também', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await diaSeguinte(page);
    await diaSeguinte(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-13');
    await irPara(page, 'age');
    await expect(page.locator('#agenda-data')).toContainText('13/11/2026');
    await irPara(page, 'dem');
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-13');
    await irPara(page, 'age');
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-11-13');
    await mudarData(page, '2026-11-16');
    await expect(page.locator('#agenda-data')).toContainText('16/11/2026');
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-11-16');
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
    await expect(campoDaAgenda(page, 'data').locator('option[value="2026-11-15"]')).toHaveCount(0);
    await expect(campoDaAgenda(page, 'data')).toHaveValue('2026-11-16');
    // Da segunda para o dia de operação anterior, o sábado
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
