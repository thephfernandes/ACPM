// O instrutor escolhido pelo operador: na Demanda (o app encaixa o voo com ele) e na Escala (o nome do instrutor abre a
// lista; o voo fica onde está, fixo, com o escolhido, e o resto é refeito em volta). O histórico desfaz
import { test, expect, abrir, irPara, abrirEscala, confirmar, abrirHistorico, alternarVem, aprovar, reabrir, editorDoVoo, refazer, abrirCaixa, campoDoAluno, abrirAluno } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

// Dois voos às 08:20: o app põe o Instrutor 02 (menos habilitações) com o Aluno 1000 e o Instrutor 01 com o 1001
const dia = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 1), instrutor(3, 9, { on: false })], stu: [aluno(1000), aluno(1001)] });
const linha = (page, nome) => page.locator('#out tbody tr:not(.win)', { hasText: nome });
const pedido = (page, id) => page.locator(`#dem tr[data-k="d"][data-id="${id}"][data-mid="0"]`);

test.describe('Instrutor escolhido', () => {
  test('na Demanda: o voo sai com o escolhido; o histórico volta para o automático', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirEscala(page);
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText('Instrutor 02');

    await irPara(page, 'dem');
    const campo = pedido(page, 1000).locator('[data-f="insId"]');
    await expect(campo.locator('option')).toHaveText(['Automático', 'Instrutor 01', 'Instrutor 02', 'Instrutor 03 (fora nesta data)']);
    await campo.selectOption({ label: 'Instrutor 01' });
    await expect(pedido(page, 1000).locator('[data-f="insId"]')).toHaveClass(/\bescolhido\b/);

    await abrirEscala(page);
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText('Instrutor 01');
    await expect(linha(page, 'Aluno 1000').locator('.ins-btn')).toHaveClass(/\bescolhido\b/);
    await expect(linha(page, 'Aluno 1001').locator('.c-instr')).toHaveText('Instrutor 02');

    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list')).toContainText('Pedido Aluno 1000: instrutor Instrutor 01 (Voo Local)');
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await page.keyboard.press('Escape');
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText('Instrutor 02');
    await irPara(page, 'dem');
    await expect(pedido(page, 1000).locator('[data-f="insId"]')).toHaveValue('');
  });

  test('o escolhido que não pode voar: o pedido fica fora da escala, com o motivo', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await irPara(page, 'dem');
    await pedido(page, 1000).locator('[data-f="insId"]').selectOption({ label: 'Instrutor 03 (fora nesta data)' });
    await abrirEscala(page);
    await expect(page.locator('#out details.erros')).toContainText('o instrutor escolhido (Instrutor 03) não está disponível nesta data');
  });

  test('na Escala: o voo fica no horário e no avião dele, fixo, com o escolhido; "Automático" solta', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1001');
    const aviao = (await voo.locator('.c-aviao').innerText()).trim();
    await expect(voo.locator('.c-instr')).toHaveText('Instrutor 01');

    await voo.locator('[data-act="trocar-instrutor"]').click();
    const lista = voo.locator('select[data-a="insVoo"]');
    await expect(lista).toBeFocused();
    // Quem o app escolheu é a primeira opção; o Instrutor 02 está ocupado às 08:20 e o 03 não vem
    await expect(lista.locator('option')).toHaveText(['Instrutor 01 (escolhido pelo app)', 'Instrutor 02 (ocupado com Aluno 1000)', 'Instrutor 03 (indisponível)']);
    await lista.selectOption({ label: 'Instrutor 02 (ocupado com Aluno 1000)' });
    // A escala não está aprovada: a pergunta antes de refazer (F1g)
    await refazer(page);

    // O resto da escala é refeito em volta: o Aluno 1000 passa para o Instrutor 01, no mesmo horário
    await expect(voo.locator('.c-instr')).toHaveText('Instrutor 02');
    await expect(voo.locator('.c-hr')).toContainText('08:20–09:20');
    await expect(voo.locator('.c-aviao')).toHaveText(aviao);
    await expect(voo.locator('.fixo')).toHaveAttribute('aria-label', 'Voo fixo: instrutor escolhido na escala');
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText('Instrutor 01');
    await expect(page.locator('#out details.conflitos')).toHaveCount(0);

    await irPara(page, 'dem');
    await expect(pedido(page, 1001).locator('[data-f="insId"]')).toHaveValue('2');

    await abrirEscala(page);
    await voo.locator('[data-act="trocar-instrutor"]').click();
    await expect(voo.locator('select[data-a="insVoo"] option').first()).toHaveText('Automático (o app escolhe)');
    await voo.locator('select[data-a="insVoo"]').selectOption({ label: 'Automático (o app escolhe)' });
    await refazer(page);
    await expect(voo.locator('.fixo')).toHaveCount(0);
    await expect(voo.locator('.ins-btn')).not.toHaveClass(/\bescolhido\b/);
  });

  test('na Escala, sair da lista sem escolher (Esc) volta ao nome, com o foco nele', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    await voo.locator('[data-act="trocar-instrutor"]').click();
    await expect(voo.locator('select[data-a="insVoo"]')).toBeFocused();
    // O clique abre a lista do navegador quando ele permite (showPicker; no Linux, sim): o primeiro Esc fecha a lista
    // aberta, o seguinte volta ao nome
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(voo.locator('select[data-a="insVoo"]')).toHaveCount(0, { timeout: 300 });
    }).toPass({ timeout: 3000 });
    await expect(voo.locator('[data-act="trocar-instrutor"]')).toBeFocused();
  });

  test('Priorizar com (Alunos): o aluno voa com o instrutor dele; quando ele não vem, com outro, e a escala avisa', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await irPara(page, 'alu');
    await abrirAluno(page, 1000);
    const aluno = page.locator('#det-alu .det[data-id="1000"]');
    await aluno.locator('[data-f="voaCom"]').selectOption({ label: 'Instrutor 01' });
    await expect(aluno.locator('.tg.par')).toHaveText(/Instrutor 01/);
    await expect((await campoDoAluno(page, 1000, 'voaCom'))).toBeFocused();
    // Quem está no “Priorizar com” não aparece em “Não escalar com”, e o contrário
    await expect(aluno.locator('[data-f="bl"] option', { hasText: 'Instrutor 01' })).toHaveCount(1);
    await aluno.locator('[data-f="bl"]').selectOption({ label: 'Instrutor 03' });
    await expect(aluno.locator('[data-f="voaCom"] option', { hasText: 'Instrutor 03' })).toHaveCount(0);

    await irPara(page, 'dem');
    await expect(pedido(page, 1000).locator('[data-f="insId"] option').first()).toHaveText('Automático (prioriza Instrutor 01)');

    await abrirEscala(page);
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText('Instrutor 01');
    await expect(page.locator('#out details.avisos')).toHaveCount(0);

    // O Instrutor 01 não vem: o voo fica com outro, com o aviso
    await irPara(page, 'ins');
    await alternarVem(page, '1', false);
    await abrirEscala(page);
    await expect(linha(page, 'Aluno 1000')).toHaveCount(1);
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText('Instrutor 02');
    await expect(page.locator('#out details.avisos summary')).toContainText('1 aviso de Priorizar com');
    await expect(page.locator('#out details.avisos')).toContainText('Sem o instrutor de “Priorizar com” (Instrutor 01: fora nesta data)');

    // Tirar do “Priorizar com”: o aviso some
    await irPara(page, 'alu');
    await page.locator('#det-alu .det[data-id="1000"] [data-act="unvc"]').click();
    await expect(page.locator('#det-alu .det[data-id="1000"] .tg.par')).toHaveCount(0);
    await abrirEscala(page);
    await expect(page.locator('#out details.avisos')).toHaveCount(0);
  });

  test('o “Priorizar com” fica no cadastro: vale também na data seguinte', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await irPara(page, 'alu');
    await (await campoDoAluno(page, 1001, 'voaCom')).selectOption({ label: 'Instrutor 02' });
    await page.reload();
    await irPara(page, 'alu');
    await abrirAluno(page, 1001);
    await expect(page.locator('#det-alu .det[data-id="1001"] .tg.par')).toHaveText(/Instrutor 02/);
  });

  test('o voo fixo pela escolha na Escala continua fixo ao mudar o status; "Automático" na Demanda o solta', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1001');
    await voo.locator('[data-act="trocar-instrutor"]').click();
    await voo.locator('select[data-a="insVoo"]').selectOption({ label: 'Instrutor 02 (ocupado com Aluno 1000)' });
    await refazer(page);
    await expect(voo.locator('.fixo')).toHaveCount(1);

    await voo.locator('select[data-f="fstatus"]').selectOption('Pendente');
    await refazer(page);
    await expect(voo.locator('select[data-f="fstatus"]')).toHaveValue('Pendente');
    await expect(voo.locator('.fixo')).toHaveAttribute('aria-label', 'Voo fixo: instrutor escolhido na escala');
    await expect(voo.locator('.c-instr')).toHaveText('Instrutor 02');

    await irPara(page, 'dem');
    await pedido(page, 1001).locator('[data-f="insId"]').selectOption('');
    await abrirEscala(page);
    await expect(voo.locator('.fixo')).toHaveCount(0);
    await expect(voo.locator('.ins-btn')).not.toHaveClass(/\bescolhido\b/);
  });

  test('aprovar e reabrir a escala não soltam o voo fixo pela escolha na Escala', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1001');
    await voo.locator('[data-act="trocar-instrutor"]').click();
    await voo.locator('select[data-a="insVoo"]').selectOption({ label: 'Instrutor 02 (ocupado com Aluno 1000)' });
    await refazer(page);
    await aprovar(page);
    await expect(voo.locator('.fixo')).toHaveAttribute('aria-label', 'Voo fixo: escala aprovada');
    await reabrir(page);
    await expect(voo.locator('.fixo')).toHaveAttribute('aria-label', 'Voo fixo: instrutor escolhido na escala');
    await expect(linha(page, 'Aluno 1000').locator('.fixo')).toHaveCount(0);
  });

  test('o escolhido excluído: na data aberta, o pedido volta ao Automático; em outra data, o app escolhe e avisa', async ({ page }) => {
    // Outra data: o pedido guardado ainda escolhe o instrutor 9, que saiu do cadastro
    const estado = dia();
    estado.stu[0].insId = 9;
    await abrir(page, { estado });
    await abrirEscala(page);
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText('Instrutor 02');
    await expect(page.locator('#out details.avisos summary')).toContainText('1 voo com o instrutor escolhido fora do cadastro');
    await expect(page.locator('#out details.avisos')).toContainText('O instrutor escolhido saiu do cadastro: o voo ficou com Instrutor 02.');
    await irPara(page, 'dem');
    await expect(pedido(page, 1000).locator('[data-f="insId"] option:checked')).toHaveText('Instrutor fora do cadastro (o app escolhe)');

    // A data aberta: escolher o Instrutor 01 e excluí-lo do cadastro devolve o pedido ao Automático, sem aviso
    await pedido(page, 1000).locator('[data-f="insId"]').selectOption({ label: 'Instrutor 01' });
    await irPara(page, 'ins');
    await page.locator('[data-vista-ins="cadastro"]').click();
    await confirmar(page, '#inst tr.cd[data-id="1"] [data-act="deli"]');
    await irPara(page, 'dem');
    await expect(pedido(page, 1000).locator('[data-f="insId"]')).toHaveValue('');
    await abrirEscala(page);
    await expect(page.locator('#out details.avisos')).toHaveCount(0);
    await expect(linha(page, 'Aluno 1000')).toHaveCount(1);
  });

  test('o escolhido excluído de um voo agendado na Escala: o voo fica no lugar, em conflito, com as sugestões', async ({ page }) => {
    // O Aluno 1001 agendado às 10:10 e, depois, com o Instrutor 01 escolhido na Escala; um voo fixo só pela escolha (o
    // Aluno 1000) é solto, como antes
    const estado = dia();
    estado.stu[0].insId = 1;
    estado.stu[1].insId = 1;
    estado.fixos = {
      '1000_0_1': { a: 500, b: 560, r: 'PR-VOC', insId: 1, escolhido: true },
      '1001_0_1': { a: 610, b: 670, r: 'PR-VOB', insId: 1, escolhido: true, agendado: true }
    };
    await abrir(page, { estado });
    await abrirEscala(page);
    await expect(linha(page, 'Aluno 1001').locator('.fixo')).toHaveAttribute('aria-label', 'Voo fixo: agendado na escala');
    await irPara(page, 'ins');
    await page.locator('[data-vista-ins="cadastro"]').click();
    await confirmar(page, '#inst tr.cd[data-id="1"] [data-act="deli"]');
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1001');
    await expect(voo.locator('.c-hr')).toContainText('10:10–11:10');
    await expect(voo.locator('.fixo')).toHaveAttribute('aria-label', 'Voo fixo: agendado na escala');
    await expect(voo).toHaveClass(/\bem-conflito\b/);
    await expect(page.locator('#out details.conflitos')).toContainText('o instrutor saiu do cadastro');
    await expect(page.locator('#out details.conflitos [data-reparo="1001_0_1"]')).toHaveCount(1);
    await expect(linha(page, 'Aluno 1000').locator('.fixo')).toHaveCount(0);
  });

  // Revisão do F1h (N9): o INVA fora do “Priorizar com” do aluno, escolhido pelo operador. Na Lista, a opção diz; na escala
  // aberta, a pergunta também; a Escala guarda a observação. Na Demanda, o instrutor do dia fora dele também fica com a
  // observação
  const comPriorizar = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 500, p2: -1 }, { voaCom: [1] })] });
  const posto = 'Aluno 1000 Fora do “Priorizar com” de Aluno 1000 (Instrutor 01): o voo foi posto à mão com Instrutor 02.';
  test('o INVA fora do “Priorizar com” na Lista: a opção diz, a pergunta da escala aberta avisa, e a Escala guarda a observação', async ({ page }) => {
    await abrir(page, { estado: comPriorizar() });
    await abrirEscala(page, { vista: 'lista' });
    const voo = linha(page, 'Aluno 1000');
    await expect(voo.locator('.c-instr')).toHaveText('Instrutor 01');
    await voo.locator('[data-act="trocar-instrutor"]').click();
    await expect(voo.locator('select[data-a="insVoo"] option')).toHaveText(['Instrutor 01 (Priorizar com do aluno)', 'Instrutor 02 (fora do Priorizar com)']);
    await voo.locator('select[data-a="insVoo"]').selectOption('2');
    await expect(page.locator('#refazer-avisos li')).toHaveText(['Instrutor 02 está fora do Priorizar com de Aluno 1000.']);
    await refazer(page);
    await expect(voo.locator('.c-instr')).toHaveText('Instrutor 02');
    await expect((await abrirCaixa(page, 'avisos')).locator('li', { hasText: 'Priorizar com' })).toHaveText([posto]);
  });

  test('o INVA fora do “Priorizar com” na Lista da escala aprovada: a opção diz, a troca vale sem o motor, com a observação', async ({ page }) => {
    await abrir(page, { estado: comPriorizar() });
    await abrirEscala(page, { vista: 'lista' });
    await aprovar(page);
    const voo = linha(page, 'Aluno 1000');
    await voo.locator('[data-act="trocar-instrutor"]').click();
    await expect(voo.locator('select[data-a="insVoo"] option', { hasText: 'Instrutor 02' })).toHaveText('Instrutor 02 (fora do Priorizar com)');
    await voo.locator('select[data-a="insVoo"]').selectOption('2');
    await expect(voo.locator('.c-instr')).toHaveText('Instrutor 02');
    await expect((await abrirCaixa(page, 'avisos')).locator('li', { hasText: 'Priorizar com' })).toHaveText([posto]);
  });

  test('o instrutor do dia na Demanda fora do “Priorizar com”: a observação na Escala', async ({ page }) => {
    await abrir(page, { estado: comPriorizar() });
    await irPara(page, 'dem');
    await pedido(page, 1000).locator('[data-f="insId"]').selectOption({ label: 'Instrutor 02' });
    await abrirEscala(page, { vista: 'lista' });
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText('Instrutor 02');
    await expect((await abrirCaixa(page, 'avisos')).locator('li', { hasText: 'Priorizar com' }))
      .toHaveText(['Aluno 1000 Fora do “Priorizar com” de Aluno 1000 (Instrutor 01): Instrutor 02 foi escolhido para o dia na Demanda.']);
  });

  // No mapa, a barra abre o editor do voo (F1g): o instrutor é um campo dele, com o motivo de cada um; mudar só o instrutor
  // fixa o voo no lugar com ele, como na Lista (instrutor escolhido), depois da pergunta (a escala não está aprovada)
  test('no mapa: o instrutor no editor do voo; o escolhido fica com o voo, fixo, como na Lista', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirEscala(page);
    await page.locator('#s-esc [data-tl="ins"]').click();
    const barra = page.locator('#out .tl-bar', { hasText: 'Aluno 1001' });
    await barra.focus();
    await page.keyboard.press('Enter');
    await expect(editorDoVoo(page)).toBeVisible();
    const lista = page.locator('#voo-instrutor');
    await expect(lista.locator('option', { hasText: 'Instrutor 02' })).toHaveText(/Instrutor 02 — ocupado/);
    await lista.selectOption({ label: await lista.locator('option', { hasText: 'Instrutor 02' }).innerText() });
    await expect(page.locator('#voo-avisos li.conflito')).toHaveCount(0);
    await page.locator('#voo-salvar').click();
    await refazer(page);
    await expect(editorDoVoo(page)).toBeHidden();
    await expect(page.locator('#out .tl-row', { hasText: 'Instrutor 02' }).locator('.tl-bar', { hasText: 'Aluno 1001' })).toHaveCount(1);

    await page.locator('#s-esc [data-tl="lista"]').click();
    const voo = linha(page, 'Aluno 1001');
    await expect(voo.locator('.c-instr')).toHaveText('Instrutor 02');
    await expect(voo.locator('.fixo')).toHaveAttribute('aria-label', 'Voo fixo: instrutor escolhido na escala');
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText('Instrutor 01');
  });
});

