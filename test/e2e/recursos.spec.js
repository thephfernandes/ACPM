// Recursos: a disponibilidade do dia (janelas, aviões e simuladores, hangar), o cadastro da frota, os horários de
// decolagem por categoria e os filtros.
import { test, comHangar, expect, abrir, abrirSintetico, abrirComExemplo, irPara, irParaVista, abrirEscala, lerEscala, filtrarCategorias, abrirHistorico, campoDaAgenda, alternarDisponivel, caixaDisponivel, janelasDeOperacao, tabelaDoDia } from './fixtures.js';
import { aluno, apenas, cenario, instrutor } from '../helpers/montar.js';
import { GLOSSARIO } from '../../js/glossario.js';

test.describe('Recursos', () => {
  test('estado inicial: 9 janelas, 26 recursos, nenhum instrutor e nenhum aluno', async ({ page }) => {
    await abrir(page);
    await expect(janelasDeOperacao(page).locator('input[data-a="win"]')).toHaveCount(9);
    await expect(janelasDeOperacao(page).locator('label').last()).toHaveText('17:30 noturno');
    await expect(tabelaDoDia(page).locator('input[data-a="av"]')).toHaveCount(26);
    await expect(tabelaDoDia(page).locator('tr.grupo')).toHaveText([/^C152/, /^C172/, /^PA-34/, /^Simuladores/]);
    await expect(tabelaDoDia(page).locator('tr[data-r="PR-JPL"]')).toContainText('Só Parafuso');
    await expect(page.locator('#inst .cd')).toHaveCount(0);
    await expect(page.locator('#inst')).toContainText('Nenhum instrutor cadastrado');
    await irPara(page, 'alu');
    await expect(page.locator('#alu')).toContainText('Nenhum aluno cadastrado');
  });

  test('aeronave em manutenção fica registrada no histórico e persiste', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const linha = tabelaDoDia(page).locator('tr[data-r="PR-BTB"]');
    await linha.locator('input[data-a="av"]').uncheck();
    await expect(linha).toHaveClass(/\bmanutencao\b/);
    await expect(linha).toContainText('Em manutenção');
    await expect(page.locator('#log-cnt')).toHaveText('1');
    await expect(page.locator('#audit-log-list')).toContainText('PR-BTB: Manutenção');
    await page.reload();
    await expect(caixaDisponivel(page, 'PR-BTB')).not.toBeChecked();
    await expect(page.locator('#log-cnt')).toHaveText('1');
  });

  test('uma tabela da frota: as horas disponíveis até a revisão de 50 horas e o que o avião voa no dia', async ({ page }) => {
    await abrir(page, { estado: cenario({ stu: [aluno(1000, { p1: 1, p2: 1 })], semAeronaves: apenas('C152', 'PP-LJV'), horas: { 'PP-LJV': 42 } }) });
    await irPara(page, 'rec');
    const linha = tabelaDoDia(page).locator('tr[data-r="PP-LJV"]');
    await expect(linha.locator('input[data-a="horas"]')).toHaveValue('8');
    await expect(linha.locator('.barra')).toHaveClass(/\bwa\b/);
    await expect(linha).toContainText('1 h na escala · termina com 7 h disponíveis');
    await expect(tabelaDoDia(page).locator('tr.grupo').first()).toContainText('1 de 13 disponíveis');
    await expect(tabelaDoDia(page).locator('tr[data-r="SIM-MONO-A"] input[data-a="horas"]')).toHaveCount(0);
  });

  test('desativa uma janela de operação', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const janela = janelasDeOperacao(page).locator('label').nth(3);
    await janela.locator('input').uncheck();
    await expect(janela).toHaveClass(/\boff\b/);
    await expect(page.locator('#audit-log-list')).toContainText('Janela 11:30 inativa');
  });
});

test.describe('Recursos: acrescentar e retirar', () => {
  test('acrescenta um C152: aparece na categoria, disponível, entra na escala e fica gravado', async ({ page }) => {
    // Todos os C152 em manutenção: o voo só entra com o avião novo
    await abrir(page, { estado: cenario({ stu: [aluno(1000)], semAeronaves: apenas('C152') }) });
    await irPara(page, 'rec');
    // O formulário começa fechado (na Disponibilidade do dia, o Cadastro inteiro fica escondido: o hidden é o do formulário)
    await expect(page.locator('#form-recurso')).toHaveJSProperty('hidden', true);
    await expect(page.locator('#btn-novo-recurso')).toHaveAttribute('aria-expanded', 'false');
    // "+ Novo recurso", na barra da aba, abre o Cadastro com o formulário (como "+ Novo instrutor")
    await page.locator('#btn-novo-recurso').click();
    await expect(page.locator('#s-rec')).toHaveAttribute('data-vista', 'cadastro');
    await expect(page.locator('#btn-novo-recurso')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#rec-reg')).toBeFocused();
    await page.locator('#rec-reg').fill('pr-new');
    await page.locator('#rec-tipo').selectOption('C152');
    await page.locator('#form-recurso [type="submit"]').click();
    await expect(page.locator('#frota [data-r="PR-NEW"]')).toBeVisible();
    // O formulário fecha (conferido no Cadastro, onde ele fica), e o foco volta ao botão
    await expect(page.locator('#form-recurso')).toBeHidden();
    await expect(page.locator('#btn-novo-recurso')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#btn-novo-recurso')).toBeFocused();
    await irParaVista(page, 'rec', 'dia');
    const linha = page.locator('#revisao tr[data-r="PR-NEW"]');
    await expect(linha).toBeVisible();
    await expect(linha.locator('[data-a="av"]')).toBeChecked();
    await expect(page.locator('#revisao tr.grupo', { hasText: 'C152' })).toContainText('1 de 14 disponíveis');
    await expect(page.locator('#toast-box .toast.ok')).toContainText('PR-NEW');
    await abrirEscala(page);
    expect((await lerEscala(page)).linhas.some(l => l.includes('PR-NEW'))).toBe(true);

    await page.reload();
    await irPara(page, 'rec');
    await expect(page.locator('#revisao tr[data-r="PR-NEW"]')).toBeVisible();
  });

  // De outra vista, "+ Novo recurso" abre o Cadastro com o formulário, e o que ficou aberto lá continua com o que foi
  // digitado; no Cadastro, o mesmo botão abre e fecha o formulário, e Cancelar o fecha com o foco de volta no botão
  test('"+ Novo recurso" de outra vista abre o Cadastro com o formulário (o aberto continua como estava); no Cadastro, abre e fecha', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const botao = page.locator('#btn-novo-recurso'), form = page.locator('#form-recurso'), matricula = page.locator('#rec-reg');
    await botao.click();
    await expect(form).toBeVisible();
    await matricula.fill('PR-ABC');
    await irParaVista(page, 'rec', 'dia');
    await expect(form).toBeHidden();
    await botao.click();
    await expect(page.locator('#s-rec')).toHaveAttribute('data-vista', 'cadastro');
    await expect(form).toBeVisible();
    await expect(matricula).toBeFocused();
    await expect(matricula).toHaveValue('PR-ABC');
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    // No Cadastro, o botão fecha o formulário e abre de novo, vazio
    await botao.click();
    await expect(form).toBeHidden();
    await expect(botao).toHaveAttribute('aria-expanded', 'false');
    await botao.click();
    await expect(matricula).toHaveValue('');
    await page.locator('#rec-cancelar').click();
    await expect(form).toBeHidden();
    await expect(botao).toBeFocused();
  });

  test('não aceita matrícula repetida nem sem categoria; "Só Parafuso" só no C152', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    await page.locator('#btn-novo-recurso').click();
    await page.locator('#rec-reg').fill('PP-LJV');
    await page.locator('#rec-tipo').selectOption('C152');
    await page.locator('#form-recurso [type="submit"]').click();
    await expect(page.locator('#rec-erro')).toHaveText('Já existe um recurso com a matrícula PP-LJV.');
    // O campo do erro fica marcado (e só ele), com o motivo como descrição
    await expect(page.locator('#rec-reg')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#rec-reg')).toHaveAccessibleDescription('Já existe um recurso com a matrícula PP-LJV.');
    await expect(page.locator('#rec-tipo')).not.toHaveAttribute('aria-invalid');
    await page.locator('#rec-reg').fill('PR-ZZZ');
    await page.locator('#rec-tipo').selectOption('');
    await page.locator('#form-recurso [type="submit"]').click();
    await expect(page.locator('#rec-erro')).toHaveText('Escolha a categoria.');
    await expect(page.locator('#rec-tipo')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#rec-reg')).not.toHaveAttribute('aria-invalid');
    await expect(page.locator('#rec-parafuso')).toBeHidden();
    await page.locator('#rec-tipo').selectOption('C152');
    await expect(page.locator('#rec-parafuso')).toBeVisible();
    await page.locator('#rec-parafuso').check();
    await page.locator('#form-recurso [type="submit"]').click();
    await expect(page.locator('#frota [data-r="PR-ZZZ"]')).toContainText('Só Parafuso');
  });

  test('retira um recurso com confirmação; o histórico desfaz', async ({ page }) => {
    await abrirSintetico(page);
    await irParaVista(page, 'rec', 'cadastro');
    const retirar = page.locator('#frota [data-r="PT-KIW"] [data-act="retirar-recurso"]');
    await retirar.click();
    await expect(retirar).toHaveText('Confirmar retirada');
    await retirar.click();
    await expect(page.locator('#frota [data-r="PT-KIW"]')).toHaveCount(0);
    await expect(page.locator('#revisao tr[data-r="PT-KIW"]')).toHaveCount(0);
    await expect(page.locator('#revisao tr.grupo', { hasText: 'PA-34' })).toContainText('2 de 2 disponíveis');
    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list')).toContainText('Recurso retirado: PT-KIW (PA-34)');
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await expect(page.locator('#revisao tr[data-r="PT-KIW"]')).toHaveCount(1);
    await expect(page.locator('#frota [data-r="PT-KIW"]')).toHaveCount(1);
  });

  // O Retirar fica na frota, no Cadastro: conferido com a frota à vista (na Disponibilidade do dia, o Cadastro inteiro
  // fica escondido, e o Retirar escondido ali não diria nada)
  test('o Gestor não acrescenta nem retira recursos', async ({ page }) => {
    await abrirSintetico(page);
    await page.locator('#role-sel').selectOption('gestor');
    await irPara(page, 'rec');
    await expect(page.locator('#btn-novo-recurso')).toBeHidden();
    await irParaVista(page, 'rec', 'cadastro');
    await expect(page.locator('#frota li.frota-item[data-r="PT-KIW"]')).toBeVisible();
    await expect(page.locator('#frota [data-act="retirar-recurso"]:visible')).toHaveCount(0);
  });

  // Duas vistas, pelo escopo: a Disponibilidade do dia (o que vale para a data aberta: as janelas, os aviões e
  // simuladores e, ao lado da tabela, o hangar) e o Cadastro (o que vale para todas as datas: a frota e os horários de
  // decolagem). Todos os ids continuam na página, e a vista escolhida fica ao voltar à aba, até a página recarregar
  comHangar('Recursos em duas vistas: a Disponibilidade do dia (janelas, aviões e simuladores, hangar) e o Cadastro (frota e horários, para todas as datas)', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const secao = page.locator('#s-rec');
    const dia = secao.locator('.vista-dia'), cadastro = secao.locator('.vista-cadastro');
    await expect(secao).toHaveAttribute('data-vista', 'dia');
    await expect(secao.locator('.seg button')).toHaveText(['Disponibilidade do dia', 'Cadastro']);
    await expect(secao.locator('[data-vista-rec="dia"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(secao.locator('[data-vista-rec="cadastro"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(dia.locator('h3')).toContainText('Nesta data');
    for (const id of ['#wins', '#eqs', '#revisao', '#hangar']) await expect(dia.locator(id)).toBeVisible();
    for (const id of ['#frota', '#horarios', '#form-recurso']) await expect(cadastro.locator(id)).toHaveCount(1);
    await expect(cadastro).toBeHidden();
    // A barra da aba (as vistas, a busca, as categorias, a contagem e "+ Novo recurso") vale para as duas vistas
    for (const id of ['#flt-rec-mat', '#flt-rec-cat', '#rec-contagem', '#btn-novo-recurso']) await expect(secao.locator(`:scope > .bar ${id}`)).toBeVisible();
    await expect(page.locator('#rec-contagem')).toHaveText('26 recursos');

    await secao.locator('[data-vista-rec="cadastro"]').click();
    await expect(secao.locator('[data-vista-rec="cadastro"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(cadastro.locator('h3')).toContainText('Vale para todas as datas');
    await expect(cadastro.locator('h4')).toHaveText(['Frota', 'Horários de decolagem']);
    await expect(dia).toBeHidden();
    // A frota: cada recurso uma vez, por categoria; o Retirar fica só nela
    await expect(page.locator('#frota [data-r]')).toHaveCount(26);
    await expect(page.locator('#frota .grupo h5')).toHaveText([/^C152/, /^C172/, /^PA-34/, /^Simuladores/]);
    await expect(page.locator('#revisao [data-act="retirar-recurso"]')).toHaveCount(0);
    await expect(page.locator('#rec-contagem')).toHaveText('26 recursos');

    // A vista escolhida fica ao voltar à aba, até a página recarregar
    await irPara(page, 'esc');
    await irPara(page, 'rec');
    await expect(secao).toHaveAttribute('data-vista', 'cadastro');
    await expect(page.locator('#horarios')).toBeVisible();
    await page.reload();
    await irPara(page, 'rec');
    await expect(secao).toHaveAttribute('data-vista', 'dia');
    await expect(janelasDeOperacao(page)).toBeVisible();
  });

  // A partir de 1.100 px, a ordem no hangar fica ao lado da tabela dos aviões; abaixo disso, embaixo dela. A página não
  // rola de lado
  comHangar('a ordem no hangar fica ao lado da tabela a partir de 1.100 px, e embaixo dela nas telas menores', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    for (const [largura, aoLado] of [[1280, true], [1100, true], [1099, false], [800, false]]) {
      await page.setViewportSize({ width: largura, height: 800 });
      const tabela = await tabelaDoDia(page).boundingBox();
      const hangar = await page.locator('#s-rec .rec-hangar').boundingBox();
      if (aoLado) {
        expect(hangar.x, `${largura} px`).toBeGreaterThanOrEqual(tabela.x + tabela.width);
        expect(hangar.y, `${largura} px`).toBeLessThan(tabela.y + tabela.height);
      } else {
        expect(hangar.y, `${largura} px`).toBeGreaterThanOrEqual(tabela.y + tabela.height);
        expect(Math.round(hangar.width), `${largura} px`).toBe(Math.round(tabela.width));
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${largura} px`).toBeLessThanOrEqual(largura);
    }
  });
});

// Cada categoria mostra um resumo; um botão abre o editor da lista
test.describe('Recursos: horários de decolagem por categoria', () => {
  const editor = page => page.locator('#horarios .horarios-editor');

  test('o resumo: o modelo, quantos horários e os horários da manhã e da tarde; o da janela fechada fica apagado', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await irParaVista(page, 'rec', 'cadastro');
    const c152 = page.locator('#horarios [data-cat="C152"]');
    await expect(c152.locator('.horarios-modelo')).toHaveText('Janelas do dia');
    await expect(c152.locator('.horarios-qtd')).toHaveText('8 horários');
    await expect(c152.locator('[data-periodo="manha"] .hr')).toHaveText(['06:30', '08:20', '10:10', '11:30']);
    await expect(c152.locator('[data-periodo="tarde"] .hr')).toHaveText(['12:40', '13:40', '14:30', '16:20']);
    const pa34 = page.locator('#horarios [data-cat="PA-34"]');
    await expect(pa34.locator('.horarios-modelo')).toHaveText('De 30 em 30 min, 06:30–16:30');
    await expect(pa34.locator('.horarios-qtd')).toHaveText('21 horários');
    // No resumo, só um botão por categoria (C152, C172, simuladores e PA-34)
    await expect(page.locator('#horarios .horarios-cat')).toHaveCount(4);
    await expect(page.locator('#horarios button')).toHaveCount(4);
    await expect(page.locator('#horarios .horarios-editor')).toHaveCount(0);

    // A janela das 10:10 fechada nesta data (na Disponibilidade do dia): o horário dela fica apagado, e a dica diz por quê
    await irParaVista(page, 'rec', 'dia');
    await janelasDeOperacao(page).locator('input[data-a="win"][data-i="2"]').uncheck();
    await irParaVista(page, 'rec', 'cadastro');
    await expect(c152.locator('.hr.fechado')).toHaveText(['10:10 (janela fechada nesta data)']);
    await expect(c152.locator('.hr.fechado')).toHaveAttribute('data-dica', 'horario-em-janela-fechada');
  });

  test('editar: tirar, pôr com Enter, o efeito antes de salvar; Salvar muda a escala, e o histórico desfaz a lista e os pedidos', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34', p1: 450, p2: -1 })] }) });
    await abrirEscala(page);
    expect((await lerEscala(page)).linhas.find(l => l.includes('Aluno 1000'))).toMatch(/^07:30/);
    await irParaVista(page, 'rec', 'cadastro');
    const pa34 = page.locator('#horarios [data-cat="PA-34"]');
    const editar = pa34.locator('[data-act="editar-horarios"]');
    await editar.click();
    await expect(editar).toHaveAttribute('aria-expanded', 'true');
    await expect(editor(page)).toBeVisible();
    await expect(editor(page).locator('.hr-novo')).toBeFocused();
    await expect(editor(page).locator('.hr-chip')).toHaveCount(21);
    await expect(editor(page).locator('.horarios-efeito')).toHaveText('Nenhum pedido muda.');

    await editor(page).locator('[data-act="rascunho-tirar"][data-min="450"]').click();
    await expect(editor(page).locator('.hr-chip')).toHaveCount(20);
    await expect(editor(page).locator('.horarios-efeito')).toHaveText('1 pedido muda de preferência.');
    await editor(page).locator('.hr-novo').fill('17:00');
    await editor(page).locator('.hr-novo').press('Enter');
    await expect(editor(page).locator('[role="alert"]')).toHaveText('Escolha um horário entre 06:00 e 16:30.');
    await editor(page).locator('.hr-novo').fill('07:45');
    await editor(page).locator('.hr-novo').press('Enter');
    await expect(editor(page).locator('.hr-chip', { hasText: '07:45' })).toHaveCount(1);
    await expect(editor(page).locator('[role="alert"]')).toHaveText('');
    // Nada muda antes de salvar
    await expect(pa34.locator('.horarios-modelo')).toHaveCount(0);
    await editor(page).locator('[data-act="salvar-horarios"]').click();
    await expect(editor(page)).toHaveCount(0);
    await expect(editar).toBeFocused();
    await expect(pa34.locator('.horarios-qtd')).toHaveText('21 horários');
    await expect(pa34.locator('.horarios-modelo')).toHaveText('06:30, 07:00, 07:45, 08:00–16:30 de 30 em 30 min');
    await abrirEscala(page);
    expect((await lerEscala(page)).linhas.find(l => l.includes('Aluno 1000'))).toMatch(/^07:45/);

    // Uma entrada no histórico; Reverter volta a lista e a preferência do pedido
    await abrirHistorico(page);
    const entrada = page.locator('#audit-log-list .audit-item', { hasText: 'Horários de decolagem do PA-34' });
    await expect(entrada).toHaveCount(1);
    await entrada.locator('[data-act="rev-log"]').click();
    await page.keyboard.press('Escape');
    await irPara(page, 'rec');
    await expect(pa34.locator('.horarios-modelo')).toHaveText('De 30 em 30 min, 06:30–16:30');
    await abrirEscala(page);
    expect((await lerEscala(page)).linhas.find(l => l.includes('Aluno 1000'))).toMatch(/^07:30/);
  });

  // O Histórico abre por cima da Agenda: a lista do cadastro muda com ela aberta
  test('o "↶ Reverter" dos horários, com a Agenda aberta, muda os horários do pedido que está sendo feito', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000)] }) });
    await irParaVista(page, 'rec', 'cadastro');
    await page.locator('#horarios [data-cat="PA-34"] [data-act="editar-horarios"]').click();
    await editor(page).locator('[data-act="rascunho-tirar"][data-min="450"]').click();
    await editor(page).locator('.hr-novo').fill('07:45');
    await editor(page).locator('.hr-novo').press('Enter');
    await editor(page).locator('[data-act="salvar-horarios"]').click();
    await expect(editor(page)).toHaveCount(0);
    await irPara(page, 'age');
    const [horario, motivo] = ['horario', 'horario-motivo'].map(c => campoDaAgenda(page, c));
    await campoDaAgenda(page, 'aluno').selectOption({ label: 'Aluno 1000' });
    await campoDaAgenda(page, 'missao').selectOption('Navegação');
    await campoDaAgenda(page, 'recurso').selectOption('PA-34');
    await horario.selectOption('07:45');
    await campoDaAgenda(page, 'obs').fill('Prefere o PT-JOB');
    await abrirHistorico(page);
    await page.locator('#audit-log-list .audit-item', { hasText: 'Horários de decolagem do PA-34' }).locator('[data-act="rev-log"]').click();
    await expect(horario.locator('option', { hasText: '07:30' })).toHaveCount(1);
    await expect(horario.locator('option', { hasText: '07:45' })).toHaveCount(0);
    await expect(horario).toHaveValue('');
    await expect(motivo).toHaveText('O horário 07:45 não é um dos de Navegação (PA-34). Escolha outro.');
    await expect(campoDaAgenda(page, 'obs')).toHaveValue('Prefere o PT-JOB');
  });

  test('os modelos; Cancelar descarta; não tira o último horário; o Gestor não edita', async ({ page }) => {
    await abrirSintetico(page);
    await irParaVista(page, 'rec', 'cadastro');
    const c152 = page.locator('#horarios [data-cat="C152"]');
    await c152.locator('[data-act="editar-horarios"]').click();
    await editor(page).getByLabel('De 30 em 30 min').check();
    await expect(editor(page).locator('.hr-chip')).toHaveCount(21);
    await editor(page).locator('[data-act="cancelar-horarios"]').click();
    await expect(c152.locator('.horarios-modelo')).toHaveText('Janelas do dia');
    await expect(c152.locator('[data-act="editar-horarios"]')).toBeFocused();

    await c152.locator('[data-act="editar-horarios"]').click();
    for (let i = 0; i < 7; i++) await editor(page).locator('[data-act="rascunho-tirar"]').first().click();
    await expect(editor(page).getByLabel('Personalizado')).toBeChecked();
    await editor(page).locator('[data-act="rascunho-tirar"]').first().click();
    await expect(editor(page).locator('.hr-chip')).toHaveCount(1);
    await expect(editor(page).locator('[role="alert"]')).toHaveText('Cada categoria precisa de pelo menos um horário.');
    // O erro não é do campo do horário novo: ele não fica marcado como inválido
    await expect(editor(page).locator('.hr-novo')).toHaveAttribute('aria-invalid', 'false');
    await page.keyboard.press('Escape');
    await expect(editor(page)).toHaveCount(0);
    await expect(c152.locator('.horarios-qtd')).toHaveText('8 horários');

    await page.locator('#role-sel').selectOption('gestor');
    await expect(page.locator('#horarios [data-act="editar-horarios"]').first()).toBeHidden();
  });

  // O Esc fecha só a camada de cima: com o foco no editor, ele fecha o editor (o rascunho é descartado), e o Histórico
  // aberto continua aberto; o Esc seguinte, com o foco fora das gavetas, fecha o Histórico
  test('o Esc no editor fecha só o editor; o Histórico aberto continua aberto', async ({ page }) => {
    await abrirSintetico(page);
    await irParaVista(page, 'rec', 'cadastro');
    const c152 = page.locator('#horarios [data-cat="C152"]');
    const editar = c152.locator('[data-act="editar-horarios"]');
    await editar.click();
    await editor(page).locator('[data-act="rascunho-tirar"]').first().click();
    await expect(editor(page).locator('.hr-chip')).toHaveCount(7);
    const historico = page.locator('#historico');
    await abrirHistorico(page);
    await expect(historico).toBeVisible();
    await editor(page).locator('.hr-novo').focus();
    await page.keyboard.press('Escape');
    await expect(editor(page)).toHaveCount(0);
    await expect(editar).toBeFocused();
    await expect(c152.locator('.horarios-qtd')).toHaveText('8 horários');
    await expect(historico).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(historico).toBeHidden();
  });

  test('a lista mudou depois que o editor abriu (o histórico a reverteu): Salvar não grava o rascunho por cima, com o aviso', async ({ page }) => {
    await abrirSintetico(page);
    await irParaVista(page, 'rec', 'cadastro');
    const c152 = page.locator('#horarios [data-cat="C152"]');
    async function por(hora) {
      await editor(page).locator('.hr-novo').fill(hora);
      await editor(page).locator('.hr-novo').press('Enter');
      await expect(editor(page).locator('.hr-chip', { hasText: hora })).toHaveCount(1);
    }
    await c152.locator('[data-act="editar-horarios"]').click();
    await por('07:45');
    await editor(page).locator('[data-act="salvar-horarios"]').click();
    await expect(c152.locator('.horarios-qtd')).toHaveText('9 horários');
    // O editor aberto de novo (o rascunho parte da lista com o 07:45); com ele aberto, o histórico reverte o 07:45
    await c152.locator('[data-act="editar-horarios"]').click();
    await por('08:45');
    await abrirHistorico(page);
    await page.locator('#audit-log-list .audit-item', { hasText: 'Horários de decolagem do C152' }).locator('[data-act="rev-log"]').click();
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeVisible();
    await editor(page).locator('[data-act="salvar-horarios"]').click();
    await expect(page.locator('#toast-box')).toContainText('Os horários do C152 mudaram depois que o editor abriu: nada foi salvo. Confira a lista e edite de novo.');
    await expect(editor(page)).toHaveCount(0);
    // Fica a lista revertida: sem o 07:45 e sem o 08:45 do rascunho
    await expect(c152.locator('.horarios-modelo')).toHaveText('Janelas do dia');
    await expect(c152.locator('.horarios-qtd')).toHaveText('8 horários');
  });
});

test.describe('Recursos: o editor dos horários pelo teclado e no leitor de tela', () => {
  test('as setas no modelo mantêm o foco; o efeito e o erro continuam no mesmo lugar e o erro fica ligado ao campo', async ({ page }) => {
    await abrirSintetico(page);
    await irParaVista(page, 'rec', 'cadastro');
    await page.locator('#horarios [data-cat="C152"] [data-act="editar-horarios"]').click();
    const editor = page.locator('#horarios .horarios-editor');
    await editor.getByLabel('Janelas do dia').focus();
    await page.keyboard.press('ArrowRight');
    await expect(editor.getByLabel('De 30 em 30 min')).toBeFocused();
    await expect(editor.getByLabel('De 30 em 30 min')).toBeChecked();
    await expect(editor.locator('.hr-chip')).toHaveCount(21);

    // O efeito é uma região viva: o mesmo elemento recebe o texto novo (um elemento novo não seria anunciado)
    await editor.locator('.horarios-efeito').evaluate(el => { el.dataset.marca = '1'; });
    await page.keyboard.press('ArrowLeft');
    await expect(editor.getByLabel('Janelas do dia')).toBeFocused();
    await expect(editor.locator('.horarios-efeito[data-marca="1"]')).toHaveText('Nenhum pedido muda.');

    const campo = editor.locator('.hr-novo');
    const erro = editor.locator('[role="alert"]');
    await erro.evaluate(el => { el.dataset.marca = '1'; });
    await campo.fill('17:00');
    await campo.press('Enter');
    await expect(editor.locator('[role="alert"][data-marca="1"]')).toHaveText('Escolha um horário entre 06:00 e 16:30.');
    await expect(campo).toBeFocused();
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await expect(campo).toHaveAttribute('aria-describedby', new RegExp(`\\b${await erro.getAttribute('id')}\\b`));
    // O mesmo erro de novo também é anunciado: o alerta é escrito outra vez
    const escritas = await erro.evaluate(el => {
      window.__escritasNoAlerta = 0;
      new MutationObserver(m => { window.__escritasNoAlerta += m.length; }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await campo.press('Enter');
    await expect(erro).toHaveText('Escolha um horário entre 06:00 e 16:30.');
    await expect.poll(() => page.evaluate(() => window.__escritasNoAlerta)).toBeGreaterThan(0);
    expect(escritas).toBeUndefined();
    await campo.fill('07:15');
    await campo.press('Enter');
    await expect(campo).toHaveAttribute('aria-invalid', 'false');
    await expect(campo).toHaveValue('');
    await expect(erro).toHaveText('');
    // Vazio, o alerta continua na árvore de acessibilidade (escondido, não seria anunciado quando aparecer), sem ocupar
    // espaço: entre o campo e o efeito fica só o espaço normal do editor
    expect(await erro.evaluate(el => getComputedStyle(el).display)).not.toBe('none');
    const espaco = await editor.evaluate(ed => {
      const campo = ed.querySelector('.horarios-novo').getBoundingClientRect();
      const efeito = ed.querySelector('.horarios-efeito').getBoundingClientRect();
      return { entre: efeito.top - campo.bottom, normal: parseFloat(getComputedStyle(ed).rowGap) };
    });
    expect(Math.abs(espaco.entre - espaco.normal)).toBeLessThan(1);

    // Um horário digitado (sem pôr) continua no campo quando a aba é redesenhada por outra alteração (a janela fechada na
    // Disponibilidade do dia: o editor continua aberto no Cadastro, escondido)
    await campo.fill('09:15');
    await irParaVista(page, 'rec', 'dia');
    await janelasDeOperacao(page).locator('input[data-a="win"][data-i="1"]').uncheck();
    await irParaVista(page, 'rec', 'cadastro');
    await expect(editor.locator('.hr-novo')).toHaveValue('09:15');
    // e não passa para o editor de outra categoria
    await page.locator('#horarios [data-cat="PA-34"] [data-act="editar-horarios"]').click();
    await expect(page.locator('#horarios [data-cat="PA-34"] .hr-novo')).toHaveValue('');
    await page.locator('#horarios [data-cat="PA-34"] [data-act="cancelar-horarios"]').click();
    await page.locator('#horarios [data-cat="C152"] [data-act="editar-horarios"]').click();

    // O ✕ de um horário leva o foco para o horário seguinte (tirar vários em sequência). O editor reaberto começa da
    // lista salva: o 07:15 do rascunho anterior não está nela
    await editor.locator('[data-act="rascunho-tirar"][data-min="390"]').focus();
    await page.keyboard.press('Enter');
    await expect(editor.locator('[data-act="rascunho-tirar"][data-min="500"]')).toBeFocused();
  });
});

test.describe('Recursos: horários de decolagem no celular', () => {
  test.use({ viewport: { width: 360, height: 780 } });
  test('o editor ocupa a largura e a página não rola de lado', async ({ page }) => {
    await abrirSintetico(page);
    await irParaVista(page, 'rec', 'cadastro');
    await page.locator('#horarios [data-cat="PA-34"] [data-act="editar-horarios"]').click();
    const caixa = await page.locator('#horarios .horarios-editor').boundingBox();
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});

test.describe('Recursos: a busca pela matrícula, as categorias e os grupos recolhíveis', () => {
  // As categorias ficam no filtro de vários valores, "Categoria ▾" (uma ou outra: a regra "alguma"; nenhuma marcada,
  // todas), e a busca acha a matrícula sem os acentos, sem o hífen e sem diferença de maiúsculas. Os dois valem nas duas vistas: na tabela, na frota e nos horários de
  // decolagem (por categoria), nunca no hangar. A barra diz quantos recursos aparecem; sem nenhum, "Limpar filtros"
  comHangar('as categorias (uma ou outra) e a busca valem para a tabela, a frota e os horários, nunca para o hangar; sem nenhum, "Limpar filtros"', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const categorias = page.locator('#flt-rec-cat'), painel = page.locator('#flt-rec-cat-painel');
    const busca = page.locator('#flt-rec-mat');
    const contagem = page.locator('#rec-contagem');
    const linhas = page.locator('#revisao tr[data-r]:visible');
    const grupos = page.locator('#revisao tr.grupo');
    const hangar = page.locator('#hangar li');
    const horarios = () => page.locator('#horarios .horarios-cat').evaluateAll(cs => cs.map(c => c.dataset.cat));
    const frota = () => page.locator('#frota li.frota-item').evaluateAll(lis => lis.map(li => li.dataset.r));
    await expect(categorias).toHaveText('Todas as categorias');
    await categorias.click();
    await expect(painel.locator('label.filtro-opcao')).toHaveText(['C152', 'C172', 'Simulador', 'PA-34']);
    // Filtros, não alterações: flt-ctrl (o Gestor também usa) e nenhum data-f ou data-a
    await expect(painel.locator('input.flt-ctrl:not([data-f]):not([data-a])')).toHaveCount(4);
    await categorias.click();
    await expect(contagem).toHaveAttribute('role', 'status');
    await expect(linhas).toHaveCount(26);
    await expect(hangar).toHaveCount(22);
    await expect(contagem).toHaveText('26 recursos');

    await filtrarCategorias(page, ['PA-34']);
    await expect(categorias).toHaveText('Categoria: PA-34');
    await expect(linhas).toHaveCount(3);
    await expect(grupos).toHaveText([/^PA-34/]);
    await expect(contagem).toHaveText('3 de 26 recursos');
    // Uma ou outra: o PA-34 e os simuladores. O cabeçalho conta a categoria inteira
    await filtrarCategorias(page, ['sim', 'PA-34']);
    await expect(categorias).toHaveText('Categoria: Simulador ou PA-34');
    await expect(linhas).toHaveCount(7);
    await expect(grupos).toHaveText([/^PA-34 3 de 3 disponíveis/, /^Simuladores 4 de 4 disponíveis/]);
    await expect(contagem).toHaveText('7 de 26 recursos');
    // O hangar continua com todos os aviões: Subir e Descer andam na lista inteira
    await expect(hangar).toHaveCount(22);
    // No Cadastro, a frota e os horários de decolagem das categorias marcadas
    await irParaVista(page, 'rec', 'cadastro');
    await expect(page.locator('#frota .grupo h5')).toHaveText([/^PA-34/, /^Simuladores/]);
    await expect(page.locator('#frota li.frota-item')).toHaveCount(7);
    await expect.poll(horarios).toEqual(['sim', 'PA-34']);

    // A busca, junto com as categorias marcadas: "vo" acha o PR-VOM (PA-34), mas não os C152 e o C172 com "VO"
    await busca.fill('vo');
    await expect.poll(frota).toEqual(['PR-VOM']);
    await expect.poll(horarios).toEqual(['PA-34']);
    await filtrarCategorias(page, []);
    await expect.poll(frota).toEqual(['PR-VOB', 'PR-VOC', 'PR-VOI', 'PR-VOP', 'PR-VOW', 'PR-VOZ', 'PR-VOY', 'PR-VOM']);
    await expect.poll(horarios).toEqual(['C152', 'C172', 'PA-34']);
    // Sem os acentos, sem o hífen e sem diferença de maiúsculas
    await busca.fill(' PR VÓB ');
    await expect.poll(frota).toEqual(['PR-VOB']);
    await expect.poll(horarios).toEqual(['C152']);
    await expect(contagem).toHaveText('1 de 26 recursos');
    // O cabeçalho da categoria conta a categoria inteira, também os recursos que a busca esconde (na frota e na tabela)
    await expect(page.locator('#frota .grupo h5')).toHaveText([/^C152\s*13 recursos$/]);
    await irParaVista(page, 'rec', 'dia');
    await expect(linhas).toHaveCount(1);
    await expect(linhas.first()).toHaveAttribute('data-r', 'PR-VOB');
    await expect(grupos).toHaveText([/^C152\s*13 de 13 disponíveis$/]);
    await expect(hangar).toHaveCount(22);

    // Nenhum recurso com os filtros: a tabela e a frota dizem por quê, e os horários, que nenhuma categoria aparece
    await busca.fill('nenhum assim');
    await expect(page.locator('#revisao tr.sem-resultado')).toHaveText('Nenhum recurso com esses filtros. Limpar filtros');
    await expect(contagem).toHaveText('0 de 26 recursos');
    await expect(hangar).toHaveCount(22);
    await irParaVista(page, 'rec', 'cadastro');
    await expect(page.locator('#frota li.sem-resultado')).toHaveText('Nenhum recurso com esses filtros. Limpar filtros');
    await expect(page.locator('#horarios')).toHaveText('Nenhuma categoria com esses filtros.');
    // "Limpar filtros" esvazia a busca e as categorias, mostra todos e leva o foco à busca
    await filtrarCategorias(page, ['C172']);
    await page.locator('#limpar-filtros-frota').click();
    await expect(busca).toBeFocused();
    await expect(busca).toHaveValue('');
    await expect(painel.locator('input:checked')).toHaveCount(0);
    await expect(categorias).toHaveText('Todas as categorias');
    await expect(page.locator('#frota li.frota-item')).toHaveCount(26);
    await expect.poll(horarios).toEqual(['C152', 'C172', 'sim', 'PA-34']);
    await expect(contagem).toHaveText('26 recursos');
  });

  // "Categoria ▾" é o filtro de vários valores dos outros cadastros: o painel com a regra ("alguma") e a dica, o foco que
  // fica na caixa quando a tabela é refeita, o "Limpar" do painel e o Esc (ouvido na captura) que fecha só o painel, com o
  // editor dos horários aberto embaixo: o editor continua, com o horário digitado
  test('o filtro das categorias: a regra, o foco na caixa, o "Limpar" do painel e o Esc que fecha só o painel', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const botao = page.locator('#flt-rec-cat'), painel = page.locator('#flt-rec-cat-painel'), contagem = page.locator('#rec-contagem');
    await expect(botao).toHaveAttribute('aria-controls', 'flt-rec-cat-painel');
    await expect(botao).toHaveAttribute('aria-expanded', 'false');
    await botao.click();
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    await expect(painel).toHaveAccessibleName('Filtrar por categoria');
    await expect(painel.locator('.filtro-regra')).toHaveText('Mostra os recursos de alguma das categorias marcadas.');
    await expect(painel.locator('.filtro-regra [data-dica="filtro-das-categorias"]')).toHaveAccessibleName('O que é Filtro das categorias?');
    await expect(painel.locator('.filtro-regra [data-dica="filtro-das-categorias"]')).toHaveAccessibleDescription(GLOSSARIO['filtro-das-categorias'].texto);
    await expect(painel.locator('legend')).toHaveText(['Categorias']);
    // Pelo teclado: a caixa marcada refaz a tabela, e o foco continua nela, com o painel aberto
    const pa34 = painel.locator('input[data-valor="PA-34"]');
    await pa34.focus();
    await page.keyboard.press('Space');
    await expect(contagem).toHaveText('3 de 26 recursos');
    await expect(pa34).toBeFocused();
    await expect(painel).toBeVisible();
    // O "Limpar" do painel: todas de novo
    await painel.locator('#flt-rec-cat-limpar').click();
    await expect(contagem).toHaveText('26 recursos');
    await expect(botao).toHaveText('Todas as categorias');
    // O clique fora fecha o painel
    await page.locator('#s-rec h2').click();
    await expect(painel).toBeHidden();

    // O editor dos horários aberto, com um horário digitado e não salvo; o Esc com o foco no painel fecha só o painel e
    // leva o foco ao botão; o editor continua aberto, com o digitado
    await irParaVista(page, 'rec', 'cadastro');
    const c152 = page.locator('#horarios [data-cat="C152"]');
    await c152.locator('[data-act="editar-horarios"]').click();
    await c152.locator('.hr-novo').fill('07:15');
    await filtrarCategorias(page, ['C152'], { fechar: false });
    await painel.locator('input[data-valor="C152"]').focus();
    await page.keyboard.press('Escape');
    await expect(painel).toBeHidden();
    await expect(botao).toBeFocused();
    await expect(c152.locator('.horarios-editor')).toBeVisible();
    await expect(c152.locator('.hr-novo')).toHaveValue('07:15');
    // O Esc no editor fecha o editor (e não abre nem fecha o filtro)
    await c152.locator('.hr-novo').focus();
    await page.keyboard.press('Escape');
    await expect(c152.locator('.horarios-editor')).toHaveCount(0);
    await expect(painel).toBeHidden();
    await expect(botao).toHaveText('Categoria: C152');
  });

  test('cada categoria recolhe e abre, e continua assim quando a escala é refeita', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const linhasVisiveis = page.locator('#revisao tr[data-r]:visible');
    const grupoC152 = () => page.locator('#revisao tr.grupo', { hasText: 'C152' }).locator('button');
    await expect(grupoC152()).toHaveAttribute('aria-expanded', 'true');
    await grupoC152().click();
    await expect(grupoC152()).toHaveAttribute('aria-expanded', 'false');
    await expect(linhasVisiveis).toHaveCount(13);
    await alternarDisponivel(page, 'PR-VOM', false);
    await expect(grupoC152()).toHaveAttribute('aria-expanded', 'false');
    await expect(linhasVisiveis).toHaveCount(13);
    // A busca não abre o grupo recolhido: só deixa nele os recursos achados
    await page.locator('#flt-rec-mat').fill('vob');
    await expect(grupoC152()).toHaveAttribute('aria-expanded', 'false');
    await expect(linhasVisiveis).toHaveCount(0);
    await grupoC152().click();
    await expect(linhasVisiveis).toHaveCount(1);
    await page.locator('#flt-rec-mat').fill('');
    await expect(linhasVisiveis).toHaveCount(26);
  });

  // Quem acabou de acrescentar um recurso o vê, mesmo fora dos filtros, até eles mudarem; o mesmo vale para a categoria
  // dos horários editados agora (o foco volta ao "Editar" dela)
  test('o recurso acrescentado e os horários editados continuam à vista fora dos filtros, até eles mudarem', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    await filtrarCategorias(page, ['PA-34']);
    await page.locator('#btn-novo-recurso').click();
    await page.locator('#rec-reg').fill('PR-NEW');
    await page.locator('#rec-tipo').selectOption('C152');
    await page.locator('#form-recurso [type="submit"]').click();
    await expect(page.locator('#frota .grupo h5')).toHaveText([/^C152/, /^PA-34/]);
    await expect.poll(() => page.locator('#frota li.frota-item').evaluateAll(lis => lis.map(li => li.dataset.r))).toEqual(['PR-NEW', 'PR-VOM', 'PT-JOB', 'PT-KIW']);
    await expect(page.locator('#rec-contagem')).toHaveText('4 de 27 recursos');
    await irParaVista(page, 'rec', 'dia');
    await expect(page.locator('#revisao tr[data-r="PR-NEW"]')).toBeVisible();
    // Os filtros mudam: ele segue os filtros
    await filtrarCategorias(page, ['sim', 'PA-34']);
    await expect(page.locator('#revisao tr[data-r="PR-NEW"]')).toHaveCount(0);
    await expect(page.locator('#rec-contagem')).toHaveText('7 de 27 recursos');

    // O editor dos horários aberto continua à vista quando os filtros o deixariam de fora; fechado, a categoria fica, com
    // o foco no "Editar" dela, até os filtros mudarem de novo
    await filtrarCategorias(page, []);
    await irParaVista(page, 'rec', 'cadastro');
    const c152 = page.locator('#horarios [data-cat="C152"]');
    await c152.locator('[data-act="editar-horarios"]').click();
    await filtrarCategorias(page, ['PA-34']);
    await expect(page.locator('#horarios .horarios-cat')).toHaveCount(2);
    await expect(c152.locator('.horarios-editor')).toBeVisible();
    await c152.locator('[data-act="cancelar-horarios"]').click();
    await expect(c152.locator('[data-act="editar-horarios"]')).toBeFocused();
    await expect(page.locator('#horarios .horarios-cat')).toHaveCount(2);
    await filtrarCategorias(page, []);
    await filtrarCategorias(page, ['PA-34']);
    await expect(page.locator('#horarios .horarios-cat')).toHaveCount(1);
    await expect(c152).toHaveCount(0);
  });
});

// O foco depois de uma ação, em Recursos (vieram de acessibilidade.spec.js)
test.describe('O foco depois de uma ação', () => {
  test('com o Enter dado de novo, o Reverter não reverte outra alteração, e quem subiu ao topo do Rodízio fica lá', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'rec');
    // Três alterações que o Histórico desfaz: três recursos postos em manutenção
    const disponiveis = tabelaDoDia(page).locator('input[data-a="av"]:checked');
    for (let i = 0; i < 3; i++) { await disponiveis.first().focus(); await page.keyboard.press('Space'); }
    await abrirHistorico(page);
    const reverter = page.locator('#audit-log-list button[data-act="rev-log"]');
    await expect(reverter).toHaveCount(3);
    await reverter.first().focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(reverter).toHaveCount(2);
    await page.keyboard.press('Escape');
    // O Rodízio: o 2º da fila sobe para o 1º; o Enter de novo (o Subir dele ficou desligado) não o tira de lá
    await irPara(page, 'rod');
    const categoria = await page.locator('#rodizio .pn[data-cat]').evaluateAll(ps => ps.find(p => p.querySelectorAll('li').length >= 3).dataset.cat);
    const fila = page.locator(`#rodizio .pn[data-cat="${categoria}"] li`);
    const segundo = await fila.nth(1).getAttribute('data-id');
    await fila.nth(1).locator('[data-act="fila-subir"]').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(fila.first()).toHaveAttribute('data-id', segundo);
    // O foco fica com quem subiu (o item dele), e não com quem desceu
    expect(await page.evaluate(() => document.activeElement.dataset.id)).toBe(segundo);
  });

  // O Tab que sai de um campo digitado: o change chega com o foco já fora do campo, e a linha é redesenhada
  const vizinho = page => page.evaluate(() => {
    const el = document.activeElement;
    if (el === document.body) return 'body';
    const tr = el.closest('tr');
    return `${el.tagName.toLowerCase()}[${el.dataset.f || el.dataset.a || el.dataset.act || ''}] linha=${tr ? `${tr.dataset.id || tr.dataset.r || ''}/${tr.dataset.mid || ''}` : '-'}`;
  });
  for (const [nome, aba, seletor, valores] of [['as horas em Recursos', 'rec', '#revisao input[data-a="horas"]', ['20', '21']]]) {
    test(`digitar ${nome} e sair com Tab ou Shift+Tab leva ao mesmo vizinho que sem digitar, com a linha redesenhada`, async ({ page }) => {
      await abrirComExemplo(page);
      await irPara(page, aba);
      const campo = page.locator(seletor).nth(2);
      for (const [i, tecla] of ['Tab', 'Shift+Tab'].entries()) {
        await campo.focus();
        await page.keyboard.press(tecla);
        const semDigitar = await vizinho(page);
        await campo.fill(valores[i]);
        await page.keyboard.press(tecla);
        expect(await vizinho(page), tecla).toBe(semDigitar);
      }
    });
  }
});
