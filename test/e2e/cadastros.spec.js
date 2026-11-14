import { test, expect, abrir, abrirSintetico, abrirComExemplo, irPara, abrirEscala, lerEscala } from './fixtures.js';
import { aluno, apenas, cenario, instrutor } from '../helpers/montar.js';

test.describe('Recursos', () => {
  test('estado inicial: 9 janelas, 26 recursos, nenhum instrutor e nenhum aluno', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('#wins input[data-a="win"]')).toHaveCount(9);
    await expect(page.locator('#wins label').last()).toHaveText('17:30 noturno');
    await expect(page.locator('#eqs input[data-a="av"]')).toHaveCount(26);
    await expect(page.locator('#eqs tr.grupo')).toHaveText([/^C152/, /^C172/, /^PA-34/, /^Simuladores/]);
    await expect(page.locator('#eqs tr[data-r="PR-JPL"]')).toContainText('Só Parafuso');
    await expect(page.locator('#inst .cd')).toHaveCount(0);
    await expect(page.locator('#inst')).toContainText('Nenhum instrutor cadastrado');
    await irPara(page, 'alu');
    await expect(page.locator('#alu')).toContainText('Nenhum aluno cadastrado');
  });

  test('aeronave em manutenção fica registrada no histórico e persiste', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const linha = page.locator('#eqs tr[data-r="PR-BTB"]');
    await linha.locator('input[data-a="av"]').uncheck();
    await expect(linha).toHaveClass(/\bmanutencao\b/);
    await expect(linha).toContainText('Em manutenção');
    await expect(page.locator('#log-cnt')).toHaveText('1');
    await expect(page.locator('#audit-log-list')).toContainText('PR-BTB: Manutenção');
    await page.reload();
    await expect(page.locator('#eqs input[data-id="PR-BTB"]')).not.toBeChecked();
    await expect(page.locator('#log-cnt')).toHaveText('1');
  });

  test('uma tabela da frota: saldo até a revisão de 50 horas e o que o avião voa no dia', async ({ page }) => {
    await abrir(page, { estado: cenario({ stu: [aluno(1000, { p1: 1, p2: 1 })], semAeronaves: apenas('C152', 'PP-LJV'), horas: { 'PP-LJV': 42 } }) });
    await irPara(page, 'rec');
    const linha = page.locator('#eqs tr[data-r="PP-LJV"]');
    await expect(linha.locator('.saldo')).toHaveText('8 h');
    await expect(linha.locator('.barra')).toHaveClass(/\bwa\b/);
    await expect(linha).toContainText('1 h na escala · termina com 43 h');
    await expect(page.locator('#eqs tr.grupo').first()).toContainText('1 de 13 disponíveis');
    await expect(page.locator('#eqs tr[data-r="SIM-MONO-A"] input[data-a="horas"]')).toHaveCount(0);
  });

  test('desativa uma janela de operação', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const janela = page.locator('#wins label').nth(3);
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
    await expect(page.locator('#form-recurso')).toBeHidden();
    await page.locator('#btn-novo-recurso').click();
    await page.locator('#rec-reg').fill('pr-new');
    await page.locator('#rec-tipo').selectOption('C152');
    await page.locator('#form-recurso [type="submit"]').click();
    const linha = page.locator('#revisao tr[data-r="PR-NEW"]');
    await expect(linha).toBeVisible();
    await expect(linha.locator('[data-a="av"]')).toBeChecked();
    await expect(page.locator('#revisao tr.grupo', { hasText: 'C152' })).toContainText('1 de 14 disponíveis');
    await expect(page.locator('#toast-box .toast.ok')).toContainText('PR-NEW');
    await expect(page.locator('#form-recurso')).toBeHidden();
    await abrirEscala(page);
    expect((await lerEscala(page)).linhas.some(l => l.includes('PR-NEW'))).toBe(true);

    await page.reload();
    await irPara(page, 'rec');
    await expect(page.locator('#revisao tr[data-r="PR-NEW"]')).toBeVisible();
  });

  test('não aceita matrícula repetida nem sem categoria; "Só Parafuso" só no C152', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    await page.locator('#btn-novo-recurso').click();
    await page.locator('#rec-reg').fill('PP-LJV');
    await page.locator('#rec-tipo').selectOption('C152');
    await page.locator('#form-recurso [type="submit"]').click();
    await expect(page.locator('#rec-erro')).toHaveText('Já existe um recurso com a matrícula PP-LJV.');
    await page.locator('#rec-reg').fill('PR-ZZZ');
    await page.locator('#rec-tipo').selectOption('');
    await page.locator('#form-recurso [type="submit"]').click();
    await expect(page.locator('#rec-erro')).toHaveText('Escolha a categoria.');
    await expect(page.locator('#rec-parafuso')).toBeHidden();
    await page.locator('#rec-tipo').selectOption('C152');
    await expect(page.locator('#rec-parafuso')).toBeVisible();
    await page.locator('#rec-parafuso').check();
    await page.locator('#form-recurso [type="submit"]').click();
    await expect(page.locator('#revisao tr[data-r="PR-ZZZ"]')).toContainText('Só Parafuso');
  });

  test('retira um recurso com confirmação; o histórico desfaz', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const retirar = page.locator('#revisao tr[data-r="PT-KIW"] [data-act="retirar-recurso"]');
    await retirar.click();
    await expect(retirar).toHaveText('Confirmar retirada');
    await retirar.click();
    await expect(page.locator('#revisao tr[data-r="PT-KIW"]')).toHaveCount(0);
    await expect(page.locator('#revisao tr.grupo', { hasText: 'PA-34' })).toContainText('2 de 2 disponíveis');
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#audit-log-list')).toContainText('Recurso retirado: PT-KIW (PA-34)');
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await expect(page.locator('#revisao tr[data-r="PT-KIW"]')).toHaveCount(1);
  });

  test('o Gestor não acrescenta nem retira recursos', async ({ page }) => {
    await abrirSintetico(page);
    await page.locator('#role-sel').selectOption('gestor');
    await irPara(page, 'rec');
    await expect(page.locator('#btn-novo-recurso')).toBeHidden();
    await expect(page.locator('#revisao [data-act="retirar-recurso"]').first()).toBeHidden();
  });
});

test.describe('Recursos: horários de decolagem por categoria', () => {
  test('cada categoria mostra os seus horários; tirar e pôr um horário muda a escala', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34', p1: 450, p2: -1 })] }) });
    await irPara(page, 'rec');
    const pa34 = page.locator('#horarios [data-cat="PA-34"]');
    await expect(pa34.locator('.hr-chip')).toHaveCount(21);
    await expect(page.locator('#horarios [data-cat="C152"] .hr-chip')).toHaveText(['06:30', '08:20', '10:10', '11:30', '12:40', '13:40', '14:30', '16:20']);
    await abrirEscala(page);
    expect((await lerEscala(page)).linhas.find(l => l.includes('Aluno 1000'))).toMatch(/^07:30/);

    // Sem o 07:30, o pedido vai para o horário seguinte
    await irPara(page, 'rec');
    await pa34.locator('[data-act="remover-horario"][data-min="450"]').click();
    await expect(pa34.locator('.hr-chip')).toHaveCount(20);
    await abrirEscala(page);
    expect((await lerEscala(page)).linhas.find(l => l.includes('Aluno 1000'))).toMatch(/^08:00/);

    // Um horário novo e a volta às janelas do dia
    await irPara(page, 'rec');
    await pa34.locator('.hr-novo').fill('07:45');
    await pa34.locator('[data-act="adicionar-horario"]').click();
    await expect(pa34.locator('.hr-chip', { hasText: '07:45' })).toHaveCount(1);
    await pa34.locator('[data-act="horarios-padrao"]').click();
    await expect(pa34.locator('.hr-chip')).toHaveText(['06:30', '08:20', '10:10', '11:30', '12:40', '13:40', '14:30', '16:20']);
    await pa34.locator('[data-act="horarios-30"]').click();
    await expect(pa34.locator('.hr-chip')).toHaveCount(21);
  });

  test('não tira o último horário de uma categoria; o Gestor não edita', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const c152 = page.locator('#horarios [data-cat="C152"]');
    for (let i = 0; i < 7; i++) await c152.locator('[data-act="remover-horario"]').first().click();
    await expect(c152.locator('.hr-chip')).toHaveCount(1);
    await c152.locator('[data-act="remover-horario"]').first().click();
    await expect(c152.locator('.hr-chip')).toHaveCount(1);
    await expect(page.locator('#toast-box')).toContainText('pelo menos um horário');
    await page.locator('#role-sel').selectOption('gestor');
    await expect(page.locator('#horarios [data-act="remover-horario"]').first()).toBeHidden();
  });
});

test.describe('Recursos: categoria e grupos recolhíveis', () => {
  test('a categoria mostra só a frota dela; cada categoria recolhe e abre, e continua assim quando a escala é refeita', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    const categoria = page.locator('#flt-rec-cat');
    const linhasVisiveis = page.locator('#revisao tr[data-r]:visible');
    await expect(categoria.locator('option')).toHaveText(['Todos', 'C152', 'C172', 'Simulador', 'PA-34']);
    await expect(linhasVisiveis).toHaveCount(26);

    await categoria.selectOption({ label: 'PA-34' });
    await expect(linhasVisiveis).toHaveCount(3);
    await expect(page.locator('#revisao tr.grupo:visible')).toHaveText([/^PA-34/]);
    await categoria.selectOption({ label: 'Simulador' });
    await expect(linhasVisiveis).toHaveCount(4);
    await categoria.selectOption({ label: 'Todos' });
    await expect(linhasVisiveis).toHaveCount(26);

    const grupoC152 = () => page.locator('#revisao tr.grupo', { hasText: 'C152' }).locator('button');
    await expect(grupoC152()).toHaveAttribute('aria-expanded', 'true');
    await grupoC152().click();
    await expect(grupoC152()).toHaveAttribute('aria-expanded', 'false');
    await expect(linhasVisiveis).toHaveCount(13);
    await page.locator('#eqs input[data-id="PR-VOM"]').uncheck();
    await expect(grupoC152()).toHaveAttribute('aria-expanded', 'false');
    await expect(linhasVisiveis).toHaveCount(13);
    await grupoC152().click();
    await expect(linhasVisiveis).toHaveCount(26);
  });
});

test.describe('Instrutores', () => {
  test('filtra por nome e por habilitação, nas duas visões', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'ins');
    const dia = page.locator('#inst-dia tr[data-k="i"]:visible');
    await page.locator('[data-flt="inst"]').fill('instrutor 1');
    await expect(dia).toHaveCount(10);
    await page.locator('[data-flt="inst"]').fill('');
    await page.locator('#flt-ins-hab').selectOption('mlte');
    await expect(dia).toHaveCount(4);
    await expect(dia.first()).toContainText('Instrutor 09');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await expect(page.locator('#inst .cd:visible')).toHaveCount(4);
    await expect(page.locator('#inst .cd:visible .nm').first()).toHaveValue('Instrutor 09');
  });

  test('disponibilidade do dia: a grade mostra as janelas e os voos de cada instrutor', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const linhasDaEscala = (await lerEscala(page)).linhas;
    await irPara(page, 'ins');
    await expect(page.locator('#s-ins [data-vista-ins="dia"]')).toHaveClass(/\bon\b/);
    // A grade bate com a escala: o número de voos e aulas do instrutor (a turma de Ground conta uma vez)
    const comVoos = page.locator('#inst-dia tr[data-k="i"]').filter({ has: page.locator('.voos:not(:empty)') }).first();
    const id = await comVoos.getAttribute('data-id');
    const nome = (await comVoos.locator('.nome').innerText()).trim();
    await expect(comVoos.locator('.voos')).toHaveText(String(linhasDaEscala.filter(l => l.includes(`| ${nome} |`)).length));
    expect(await comVoos.locator('.cel.voo').count()).toBeGreaterThanOrEqual(1);
    const celula = () => page.locator(`#inst-dia tr[data-k="i"][data-id="${id}"] .cel`).nth(7);
    await comVoos.locator('[data-f="aw"][data-w="7"]').uncheck();
    await expect(celula()).not.toHaveClass(/\bon\b/);
    // Pelo teclado: a grade é refeita e o foco continua na mesma janela
    await page.locator(`#inst-dia tr[data-id="${id}"] [data-f="aw"][data-w="7"]`).focus();
    await page.keyboard.press('Space');
    await expect(celula()).toHaveClass(/\bon\b/);
    await expect(page.locator(`#inst-dia tr[data-id="${id}"] [data-f="aw"][data-w="7"]`)).toBeFocused();
  });

  test('cadastra instrutor e altera habilitações (no painel), peso e turno', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'ins');
    await page.locator('[data-act="addi"]').click();
    // O instrutor novo aparece no cadastro, com o peso em destaque enquanto falta
    await expect(page.locator('#s-ins [data-vista-ins="cadastro"]')).toHaveClass(/\bon\b/);
    const linha = page.locator('#inst .cd').last();
    await expect(page.locator('#inst .cd')).toHaveCount(41);
    await expect(linha.locator('.nm')).toHaveValue('Novo instrutor');
    await expect(linha).toHaveAttribute('data-hab', 'grounds ground_pa34 local');
    await expect(linha.locator('[data-f="kg"]')).toHaveClass(/\bfalta\b/);

    await linha.locator('[data-act="editar-habs"]').click();
    const painel = page.locator('#painel-instrutor');
    await expect(painel).toBeVisible();
    await expect(painel.locator('h2')).toContainText('Novo instrutor');
    await painel.locator('[data-f="hab"][data-h="c172"]').check();
    await painel.locator('[data-f="hab"][data-h="local"]').uncheck();
    await expect(page.locator('#inst .cd').last()).toHaveAttribute('data-hab', 'grounds ground_pa34 c172');
    await page.locator('#btn-fechar-painel-instrutor').click();
    await expect(painel).toBeHidden();

    await page.locator('#inst .cd').last().locator('[data-f="kg"]').fill('80');
    await page.locator('#inst .cd').last().locator('[data-f="kg"]').blur();
    await expect(page.locator('#inst .cd').last().locator('[data-f="kg"]')).not.toHaveClass(/\bfalta\b/);

    await page.locator('#s-ins [data-vista-ins="dia"]').click();
    await page.locator('#inst-dia tr[data-k="i"]').last().locator('[data-f="pre"]').selectOption('Manhã');
    const janelas = page.locator('#inst-dia tr[data-k="i"]').last().locator('[data-f="aw"]');
    await expect(janelas).toHaveCount(9);
    for (let i = 0; i < 9; i++) {
      if (i < 4) await expect(janelas.nth(i)).toBeChecked();
      else await expect(janelas.nth(i)).not.toBeChecked();
    }
    await expect(page.locator('#audit-log-list')).toContainText('Peso Novo instrutor: 80 kg');
    await expect(page.locator('#audit-log-list')).toContainText('Habilitação incluída: Novo instrutor · C172');
    await expect(page.locator('#audit-log-list')).toContainText('Habilitação retirada: Novo instrutor · Voo Local');
  });

  test('as habilitações não são cumulativas e valem na escala', async ({ page }) => {
    // Instrutor 01 é de C172 e não dá simulador; o Instrutor 02 só dá simulador (Mono)
    const estado = cenario({
      ins: [instrutor(1, 9, { hab: ['local', 'noturno', 'c172'] }), instrutor(2, 1, { hab: ['sim_mono'] })],
      stu: [aluno(1000, { mis: 'Simulador', eq: 'Sim. Mono' })]
    });
    await abrir(page, { estado });
    await abrirEscala(page);
    const voos = (await lerEscala(page)).linhas.filter(l => l.includes('Aluno 1000'));
    expect(voos).toHaveLength(1);
    expect(voos[0]).toContain('| Instrutor 02 |');

    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await page.locator('#inst .cd[data-id="2"] [data-act="editar-habs"]').click();
    await page.locator('#painel-instrutor [data-f="hab"][data-h="sim_mono"]').uncheck();
    await irPara(page, 'esc');
    await expect(page.locator('#out')).toContainText('nenhum instrutor ativo habilitado para Simulador em Sim. Mono (Simulador (Mono))');
  });

  test('instrutor indisponível pode ser revertido pelo histórico', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'ins');
    await page.locator('#inst-dia tr[data-k="i"]').first().locator('[data-f="on"]').uncheck();
    await expect(page.locator('#inst-dia tr[data-k="i"]').first()).toHaveClass(/\boff\b/);
    await page.locator('#btn-open-log').click();
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await irPara(page, 'ins');
    await expect(page.locator('#inst-dia tr[data-k="i"]').first()).not.toHaveClass(/\boff\b/);
  });
});

test.describe('Alunos', () => {
  test('cadastra, bloqueia instrutor e exclui aluno com confirmação', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'alu');
    await expect(page.locator('#s-alu thead th')).toHaveText(['Nome', 'CANAC', 'Peso (kg)', 'Não escalar com', '']);
    await page.locator('[data-act="adds"]').click();
    const linha = page.locator('#alu .cd');
    await expect(linha).toHaveCount(1);
    await expect(linha.locator('.nm')).toHaveValue('Novo aluno');
    await expect(linha.locator('[data-f="kg"]')).toHaveClass(/\bfalta\b/);

    const naoEscalar = linha.locator('[data-f="bl"]');
    await expect(naoEscalar.locator('option').first()).toHaveText('Não escalar com…');
    await naoEscalar.selectOption({ label: 'Instrutor 03' });
    await expect(page.locator('#alu .cd .tg')).toHaveText(/Instrutor 03/);
    // O foco continua no campo, para bloquear outro em seguida
    await expect(page.locator('#alu .cd [data-f="bl"]')).toBeFocused();
    await page.locator('#alu .cd [data-act="unbl"]').click();
    await expect(page.locator('#alu .cd .tg')).toHaveCount(0);

    await irPara(page, 'dem');
    await expect(page.locator('#dem tr[data-k="d"]')).toHaveCount(1);

    await irPara(page, 'alu');
    const excluir = page.locator('#alu .cd [data-act="dels"]');
    await excluir.click();
    await expect(excluir).toHaveText('Confirmar');
    await excluir.click();
    await expect(page.locator('#alu')).toContainText('Nenhum aluno cadastrado');
  });

  test('busca alunos pelo nome', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'alu');
    for (let i = 0; i < 3; i++) await page.locator('[data-act="adds"]').click();
    await page.locator('#alu .cd').nth(1).locator('.nm').fill('Carla');
    await page.locator('#alu .cd').nth(1).locator('.nm').blur();
    await page.locator('[data-flt="alu"]').fill('carla');
    await expect(page.locator('#alu .cd:visible')).toHaveCount(1);
  });
});
