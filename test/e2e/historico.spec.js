// Histórico da data numa gaveta lateral, que abre sobre a aba aberta (sem trocar de aba).
import { test, expect, abrir, abrirSintetico, irPara, abrirEscala, abrirCaixa, AMANHA, prepararContexto, vigiarErros, entrar, abrirHistorico, alternarDisponivel, alternarVem, appPronto, caixaVem, caixaVoa, dataAberta, diaSeguinte, linhaDoInstrutor } from './fixtures.js';
import { documentosAtuais, instalarSupabaseFalso, CONTAS } from './supabase-falso.js';
import { aluno, cenario, instrutor, missaoExtra } from '../helpers/montar.js';

// Abre o app com os documentos deste navegador já gravados: o cadastro, o dia de amanhã e o histórico dele
async function abrirComHistorico(page, estado, historico) {
  const { documentos: { cadastro }, dias } = documentosAtuais(estado, AMANHA);
  const docs = { acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_historico: historico };
  await page.addInitScript(json => {
    if (localStorage.getItem('acpm4_cadastro')) return;
    for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
  }, JSON.stringify(docs));
  await page.goto('./');
  await appPronto(page);
}

// Uma entrada de amanhã com a reversão de um voo agendado na Escala (a que o diálogo do agendamento grava)
const agendamento = (id, descricao, reverter) => ({
  id, data: AMANHA, registrado_em: `2026-11-10T14:0${id}:00.000Z`, autor: null, tipo: reverter.criado ? 'inc' : 'mod', descricao,
  reverter: { kind: 'desfazerAgendamento', pedido: null, fixo: null, disponibilidade: null, label: '↶ Desfazer', ...reverter }, reverte: null, importado: false
});

test.describe('Histórico', () => {
  test('abre numa gaveta sobre a aba aberta, sem trocar de aba; Esc e ✕ fecham', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect(page.locator('#log-cnt')).toHaveText('1');

    await abrirHistorico(page);
    await expect(page.locator('#historico')).toBeVisible();
    await expect(page.locator('#s-rec')).toBeVisible();
    await expect(page.locator('#historico-data')).toHaveText('quarta-feira, 11/11');
    await expect(page.locator('#audit-log-list')).toContainText('PR-BTB: Manutenção');

    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
    await abrirHistorico(page);
    await page.locator('#btn-fechar-historico').click();
    await expect(page.locator('#historico')).toBeHidden();
  });

  test('com o histórico aberto, trocar a data troca também a data do histórico', async ({ page }) => {
    await abrirSintetico(page);
    await abrirHistorico(page);
    await expect(page.locator('#historico-data')).toHaveText('quarta-feira, 11/11');
    await diaSeguinte(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect(page.locator('#historico-data')).toHaveText('quinta-feira, 12/11');
  });

  test('desfazer um voo agendado na Escala: o voo criado sai, sem o cadeado, e o instrutor volta a não vir', async ({ page }) => {
    // O agendamento criou a missão extra 1 do Aluno 1000 às 10:10, fixa no PR-VOB com o Instrutor 02, que não vinha
    // nesta data e foi marcado disponível
    const estado = cenario({
      ins: [instrutor(1, 9), instrutor(2, 9)],
      stu: [aluno(1000, { p1: 500, p2: -1 }, { extra: [missaoExtra(1, { p1: 610, p2: -1, insId: 2 })] })],
      fStatus: { '1000_1_1': 'Confirmado' }
    });
    estado.fixos = { '1000_1_1': { a: 610, b: 670, r: 'PR-VOB', insId: 2 } };
    const descricao = 'Agendado na escala: Aluno 1000 · Voo Local · 10:10–11:10 · PR-VOB · Instrutor 02 · Instrutor 02 marcado disponível às 10:10';
    await abrirComHistorico(page, estado, [agendamento(1, descricao, {
      stuId: 1000, mid: 1, criado: true, disponibilidade: { insId: 2, on: false, aw: Array(9).fill(true) }
    })]);
    await irPara(page, 'ins');
    await expect(caixaVem(linhaDoInstrutor(page, '2'))).toBeChecked();
    await abrirEscala(page);
    const voos = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });
    await expect(voos).toHaveCount(2);
    await expect(voos.filter({ hasText: '10:10–11:10' }).locator('.fixo')).toHaveCount(1);
    await expect(voos.filter({ hasText: '10:10–11:10' }).locator('.c-instr')).toHaveText('Instrutor 02');

    await abrirHistorico(page);
    const desfazer = page.locator('#audit-log-list [data-act="rev-log"]');
    await expect(desfazer).toHaveText('↶ Desfazer');
    await desfazer.click();
    const revertido = page.locator('#audit-log-list .audit-item', { hasText: `Revertido: ${descricao}` });
    await expect(revertido.locator('.audit-badge')).toHaveText('Exclusão');
    await expect(desfazer).toHaveCount(0);
    await page.keyboard.press('Escape');

    await expect(voos).toHaveCount(1);
    await expect(voos.locator('.c-hr')).toContainText('08:20–09:20');
    await expect(page.locator('#out .fixo')).toHaveCount(0);
    await irPara(page, 'dem');
    await expect(page.locator('#dem tr[data-k="d"][data-id="1000"]')).toHaveCount(1);
    await irPara(page, 'ins');
    await expect(caixaVem(linhaDoInstrutor(page, '2'))).not.toBeChecked();

    // Gravado: depois de recarregar, continua desfeito (o instrutor também), e a entrada desfeita não volta
    await page.reload();
    await abrirEscala(page);
    await expect(voos).toHaveCount(1);
    await abrirHistorico(page);
    await expect(revertido).toHaveCount(1);
    await expect(desfazer).toHaveCount(0);
    await page.keyboard.press('Escape');
    await irPara(page, 'ins');
    await expect(caixaVem(linhaDoInstrutor(page, '2'))).not.toBeChecked();
  });

  // A reversão vem gravada no histórico (no servidor, por quem tem conta de operador): adulterada, ela não vira botão, e a
  // data abre com a escala e o resto do histórico. Um campo do pedido de antes que nem vira texto (um objeto com
  // "toString": null) lançava uma exceção ao desenhar o histórico, e a escala da data não aparecia
  test('a reversão de um agendamento adulterada não vira botão nem impede a data de abrir', async ({ page }) => {
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 500, p2: -1 })] });
    const pedido = { fly: true, mis: 'Voo Local', eq: 'C152', p1: 610, p2: -1, nb: 1, ss: 1, pr: 3 };
    await abrirComHistorico(page, estado, [
      agendamento(1, 'Agendado na escala: prioridade adulterada', { stuId: 1000, mid: 0, criado: false, pedido: { ...pedido, pr: { toString: null } } }),
      agendamento(2, 'Agendado na escala: missão numa lista', { stuId: 1000, mid: 0, criado: false, pedido: { ...pedido, mis: ['Noturno'] } }),
      agendamento(3, 'Agendado na escala: no formato do app', { stuId: 1000, mid: 0, criado: false, pedido })
    ]);
    await abrirEscala(page);
    await expect(page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' }).locator('.c-hr')).toContainText('08:20–09:20');
    await abrirHistorico(page);
    const entrada = texto => page.locator('#audit-log-list .audit-item', { hasText: texto });
    await expect(entrada('prioridade adulterada')).toHaveCount(1);
    await expect(entrada('prioridade adulterada').locator('[data-act="rev-log"]')).toHaveCount(0);
    await expect(entrada('missão numa lista').locator('[data-act="rev-log"]')).toHaveCount(0);
    await expect(entrada('no formato do app').locator('[data-act="rev-log"]')).toHaveText('↶ Desfazer');
  });

  // Modo compartilhado: sem os resultados dos cursos (a leitura falhou), os registros do dia vêm vazios e não dá para
  // conferir se o voo tem resultado; desfazer espera "Tentar de novo", e o voo com resultado continua
  test('sem os resultados dos cursos, o voo agendado não é desfeito; lidos, o voo com resultado também não', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    const estado = cenario({
      ins: [instrutor(1, 9)],
      stu: [aluno(1000, { p1: 500, p2: -1 }, { curso: 'PP', extra: [missaoExtra(1, { p1: 610, p2: -1, etapa: 'PP-07' })] })]
    });
    estado.fixos = { '1000_1_1': { a: 610, b: 670, r: 'PR-VOB', insId: 1 } };
    const servidor = await instalarSupabaseFalso(contexto, {
      ...documentosAtuais(estado, AMANHA),
      historico: [agendamento(1, 'Agendado na escala: Aluno 1000 · PP-07 (Voo Local) · 10:10–11:10 · PR-VOB · Instrutor 01', { stuId: 1000, mid: 1, criado: true })]
    });
    servidor.resultados.push({ id: 1, aluno: 1000, curso: 'PP', missao: 'PP-07', resultado: 'aprovado', data: AMANHA, voo: '1000_1_1', registrado_em: '2026-11-11T13:30:00.000Z', registrado_por: 'Operador' });
    servidor.falhar('/rpc/situacao_das_missoes');
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    await entrar(page, CONTAS.operador);
    await expect(page.locator('#aviso-dados')).toBeVisible();
    await abrirEscala(page);
    const voos = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });
    await expect(voos).toHaveCount(2);

    const desfazer = page.locator('#audit-log-list [data-act="rev-log"]');
    await abrirHistorico(page);
    await desfazer.click();
    await expect(page.locator('#toast-box')).toContainText('Sem os resultados dos cursos, o app não confere se o voo já tem resultado: clique em "Tentar de novo" no aviso e desfaça depois.');
    await expect(desfazer).toHaveText('↶ Desfazer');
    await page.keyboard.press('Escape');

    await page.locator('#btn-tentar-dados').click();
    await expect(page.locator('#aviso-dados')).toBeHidden();
    await abrirHistorico(page);
    await desfazer.click();
    await expect(page.locator('#toast-box')).toContainText('O voo já tem resultado registrado.');
    await expect(desfazer).toHaveText('↶ Desfazer');
    await page.keyboard.press('Escape');
    await expect(voos).toHaveCount(2);
    // Nada desfeito: o histórico do servidor só tem o agendamento
    expect(servidor.historico).toHaveLength(1);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('desfazer um voo movido: o pedido, o instrutor escolhido e o voo fixo voltam como estavam; o voo em andamento fica', async ({ page }) => {
    // O agendamento moveu o Aluno 1000 das 08:20 no PR-VOC, com o Instrutor 02 escolhido na Escala, para as 10:10 no
    // PR-VOB com o Instrutor 01. O Aluno 1001, agendado às 06:30, já está em voo
    const estado = cenario({
      ins: [instrutor(1, 9), instrutor(2, 9)],
      stu: [aluno(1000, { p1: 610, p2: -1, insId: 1 }), aluno(1001, { p1: 390, p2: -1 })],
      fStatus: { '1000_0_1': 'Confirmado', '1001_0_1': 'Em Voo' }
    });
    estado.fixos = { '1000_0_1': { a: 610, b: 670, r: 'PR-VOB', insId: 1 }, '1001_0_1': { a: 390, b: 450, r: 'PR-VOI', insId: 1 } };
    await abrirComHistorico(page, estado, [
      agendamento(1, 'Agendado na escala: Aluno 1001 · Voo Local · 06:30–07:30 · PR-VOI · Instrutor 01', {
        stuId: 1001, mid: 0, criado: true, pedido: { fly: false, mis: 'Voo Local', eq: 'C152', p1: 500, p2: 610, nb: 1, ss: 1, pr: 3 }
      }),
      agendamento(2, 'Agendado na escala: Aluno 1000 · Voo Local · 10:10–11:10 · PR-VOB · Instrutor 01 (era 08:20 no PR-VOC)', {
        stuId: 1000, mid: 0, criado: false, pedido: { fly: true, mis: 'Voo Local', eq: 'C152', p1: 500, p2: -1, nb: 1, ss: 1, pr: 3, insId: 2 },
        fixo: { a: 500, b: 560, r: 'PR-VOC', insId: 2, escolhido: true }
      })
    ]);
    await abrirEscala(page);
    const voo = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });
    await expect(voo.locator('.c-hr')).toContainText('10:10–11:10');
    await expect(voo.locator('.c-instr')).toHaveText('Instrutor 01');

    await abrirHistorico(page);
    const entrada = texto => page.locator('#audit-log-list .audit-item', { hasText: texto });
    // O voo em andamento não é desfeito: o aviso diz por quê, e a entrada continua com o botão
    await entrada('Agendado na escala: Aluno 1001').locator('[data-act="rev-log"]').click();
    await expect(page.locator('#toast-box')).toContainText('O voo já está em andamento: mude o status em vez de desfazer.');
    await expect(entrada('Agendado na escala: Aluno 1001').locator('[data-act="rev-log"]')).toHaveText('↶ Desfazer');

    await entrada('Agendado na escala: Aluno 1000').locator('[data-act="rev-log"]').click();
    await expect(entrada('Revertido: Agendado na escala: Aluno 1000').locator('.audit-badge')).toHaveText('Edição');
    await page.keyboard.press('Escape');
    await expect(voo.locator('.c-hr')).toContainText('08:20–09:20');
    await expect(voo.locator('.c-aviao')).toContainText('PR-VOC');
    await expect(voo.locator('.c-instr')).toHaveText('Instrutor 02');
    await expect(voo.locator('.fixo')).toHaveAttribute('aria-label', 'Voo fixo: instrutor escolhido na escala');
    await irPara(page, 'dem');
    await expect(page.locator('#dem tr[data-k="d"][data-id="1000"][data-mid="0"] [data-f="insId"]')).toHaveValue('2');
  });

  // O voo movido cujo pedido saiu da Demanda (a missão extra tirada depois): não há o que desfazer. O clique não fazia
  // nada e não dizia nada; agora o aviso diz por quê, e a entrada continua com o botão
  test('desfazer um voo movido cujo pedido saiu da Demanda: o aviso diz por quê, e nada muda', async ({ page }) => {
    // A missão extra 1 do Aluno 1000 mudou das 10:10 para as 12:40 e depois saiu da Demanda
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] });
    const pedido = { fly: true, mis: 'Voo Local', eq: 'C152', p1: 610, p2: -1, nb: 1, ss: 1, pr: 3 };
    const descricao = 'Agendado na escala: Aluno 1000 (Voo Local) · Voo Local · 12:40–13:40 · PR-VOB · Instrutor 01 (era 10:10 no PR-VOB)';
    await abrirComHistorico(page, estado, [agendamento(1, descricao, { stuId: 1000, mid: 1, criado: false, pedido })]);
    await abrirEscala(page);
    await abrirHistorico(page);
    const desfazer = page.locator('#audit-log-list [data-act="rev-log"]');
    await desfazer.click();
    await expect(page.locator('#toast-box')).toContainText('O pedido deste voo saiu da Demanda: não há o que desfazer.');
    await expect(desfazer).toHaveText('↶ Desfazer');
    await expect(page.locator('#audit-log-list .audit-item')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' }).locator('.c-hr')).toContainText('06:30–07:30');
  });

  // O voo movido já voava antes do agendamento: o "Voa" desligado depois dele é do operador, e desfazer não põe o aluno
  // de volta na escala
  test('desfazer um voo movido depois de desligar "Voa": o aluno continua fora da escala', async ({ page }) => {
    // O agendamento moveu o Aluno 1000 das 08:20 para as 10:10 (fixo no PR-VOB); depois, "Voa" foi desligado
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { fly: false, p1: 610, p2: -1, insId: 1 }), aluno(1001, { p1: 390, p2: -1 })] });
    estado.fixos = { '1000_0_1': { a: 610, b: 670, r: 'PR-VOB', insId: 1, agendado: true } };
    await abrirComHistorico(page, estado, [agendamento(1, 'Agendado na escala: Aluno 1000 · Voo Local · 10:10–11:10 · PR-VOB · Instrutor 01 (era 08:20 no PR-VOC)', {
      stuId: 1000, mid: 0, criado: false, pedido: { fly: true, mis: 'Voo Local', eq: 'C152', p1: 500, p2: -1, nb: 1, ss: 1, pr: 3 }
    })]);
    await abrirEscala(page);
    const voo = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });
    await expect(voo).toHaveCount(0);
    await abrirHistorico(page);
    await page.locator('#audit-log-list [data-act="rev-log"]').click();
    await expect(page.locator('#audit-log-list .audit-item', { hasText: 'Revertido: Agendado na escala: Aluno 1000' })).toHaveCount(1);
    await page.keyboard.press('Escape');
    // Continua fora da escala, e a Demanda continua com "Voa" desligado
    await expect(voo).toHaveCount(0);
    await irPara(page, 'dem');
    const voa = caixaVoa(page.locator('#dem tr[data-k="d"][data-id="1000"][data-mid="0"]'));
    await expect(voa).not.toBeChecked();
    // Voando de novo, o voo vai para o horário de antes do agendamento (08:20), sem o cadeado
    await page.locator('#onlyfly').uncheck();
    await voa.check();
    await abrirEscala(page);
    await expect(voo.locator('.c-hr')).toContainText('08:20–09:20');
    await expect(voo.locator('.fixo')).toHaveCount(0);
  });

  // Desfazer um agendamento e depois reverter a troca de instrutor feita depois dele: o voo agendado desfeito não volta.
  // De volta, ele prenderia o voo seguinte da aluna no horário, no avião e com o instrutor do agendamento desfeito
  test('desfazer o agendamento e depois reverter a troca de instrutor não traz o voo agendado de volta', async ({ page }) => {
    const estado = cenario({
      ins: [instrutor(1, 9), instrutor(2, 9)],
      stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { fly: false, p1: 870, p2: -1 }, { nm: 'Maria Silva' })]
    });
    await abrir(page, { estado });
    await abrirEscala(page);
    // A Maria agendada às 10:10, com o recurso e o instrutor que o diálogo sugere
    await page.locator('#btn-agendar').click();
    await page.locator('#agd-aluno').selectOption('1001');
    await page.locator('#agd-horario').selectOption('610');
    await expect(page.locator('#agd-previa ul')).toContainText('Entra:');
    const ins = await page.locator('#agd-instrutor').inputValue();
    await page.locator('#agd-confirmar').click();
    await expect(page.locator('#dlg-agendar')).toBeHidden();
    const voo = page.locator('#out tbody tr:not(.win)', { hasText: 'Maria Silva' });
    await expect(voo.locator('.c-hr')).toContainText('10:10–11:10');

    // Na Demanda, o instrutor da Maria muda para o outro; no Histórico, o agendamento é desfeito e a troca, revertida
    await irPara(page, 'dem');
    const pedido = page.locator('#dem tr[data-k="d"][data-id="1001"][data-mid="0"]');
    await pedido.locator('[data-f="insId"]').selectOption(ins === '1' ? '2' : '1');
    await abrirHistorico(page);
    const lista = page.locator('#audit-log-list');
    await lista.locator('.audit-item', { hasText: 'Agendado na escala' }).getByRole('button', { name: '↶ Desfazer' }).click();
    await expect(lista).toContainText('Revertido: Agendado na escala: Maria Silva');
    await lista.locator('.audit-item', { hasText: 'Pedido Maria Silva: instrutor' }).getByRole('button', { name: '↶ Reverter' }).click();
    await expect(lista).toContainText('Revertido: Pedido Maria Silva: instrutor');
    await page.locator('#btn-fechar-historico').click();
    // O pedido é o de antes do agendamento: sem voar e sem o instrutor escolhido; o dia não guarda o voo fixo
    await expect(caixaVoa(pedido)).not.toBeChecked();
    await expect(pedido.locator('[data-f="insId"]')).toHaveValue('');
    expect(await page.evaluate(data => JSON.parse(localStorage.getItem(`acpm4_dia_${data}`)).fixos, AMANHA)).toEqual({});

    // A Maria volta a voar: o voo vai para a preferência dela (14:30), sem o cadeado
    await page.locator('#incluir-aluno').fill('Maria Silva');
    await page.locator('#incluir-aluno').press('Enter');
    await expect(caixaVoa(pedido)).toBeChecked();
    await abrirEscala(page);
    await expect(voo.locator('.c-hr')).toContainText('14:30–15:30');
    await expect(voo.locator('.fixo')).toHaveCount(0);
  });

  // O mesmo com o "Soltar o voo" das Sugestões: o reparo revertido depois de desfeito o agendamento não traz o voo
  // agendado de volta, nem o instrutor escolhido dele
  test('desfazer o agendamento e depois reverter o "Soltar o voo" das Sugestões não traz o voo agendado de volta', async ({ page }) => {
    const estado = cenario({
      ins: [instrutor(1, 9), instrutor(2, 9)],
      stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { fly: false, p1: 870, p2: -1 }, { nm: 'Maria Silva' })]
    });
    await abrir(page, { estado });
    await abrirEscala(page);
    await page.locator('#btn-agendar').click();
    await page.locator('#agd-aluno').selectOption('1001');
    await page.locator('#agd-horario').selectOption('610');
    await expect(page.locator('#agd-previa ul')).toContainText('Entra:');
    const ins = await page.locator('#agd-instrutor').inputValue();
    await page.locator('#agd-confirmar').click();
    await expect(page.locator('#dlg-agendar')).toBeHidden();

    // O instrutor do agendamento não vem mais: o voo agendado fica em conflito, e as Sugestões o soltam
    await irPara(page, 'ins');
    await alternarVem(page, ins, false);
    await abrirEscala(page);
    await abrirCaixa(page, 'conflitos');
    await page.locator('#out details.conflitos [data-reparo]').click();
    const soltar = page.locator('#painel-reparo .opcoes-reparo li', { hasText: 'Soltar o voo' });
    await soltar.getByRole('button', { name: 'Soltar' }).click();
    await expect(page.locator('#painel-reparo')).toBeHidden();

    await abrirHistorico(page);
    const lista = page.locator('#audit-log-list');
    await lista.locator('.audit-item', { hasText: 'Agendado na escala' }).getByRole('button', { name: '↶ Desfazer' }).click();
    await expect(lista).toContainText('Revertido: Agendado na escala: Maria Silva');
    await lista.locator('.audit-item', { hasText: 'Reparo: Maria Silva' }).getByRole('button', { name: '↶ Reverter' }).click();
    await expect(lista).toContainText('Revertido: Reparo: Maria Silva');
    await page.locator('#btn-fechar-historico').click();
    expect(await page.evaluate(data => JSON.parse(localStorage.getItem(`acpm4_dia_${data}`)).fixos, AMANHA)).toEqual({});
    await irPara(page, 'dem');
    const pedido = page.locator('#dem tr[data-k="d"][data-id="1001"][data-mid="0"]');
    await expect(caixaVoa(pedido)).not.toBeChecked();
    await expect(pedido.locator('[data-f="insId"]')).toHaveValue('');
  });

  // O voo movido pelo agendamento continua na Demanda depois de desfeito (com o pedido de antes): é o histórico que diz
  // que o agendamento foi desfeito depois da troca de instrutor
  test('desfazer um voo movido e depois reverter a troca de instrutor: o voo volta para onde estava, sem o cadeado', async ({ page }) => {
    const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }, { nm: 'Maria Silva' })] });
    await abrir(page, { estado });
    await abrirEscala(page);
    const voo = page.locator('#out tbody tr:not(.win)', { hasText: 'Maria Silva' });
    await expect(voo.locator('.c-hr')).toContainText('06:30–07:30');
    // O voo de hoje da Maria muda para as 12:40
    await page.locator('#btn-agendar').click();
    await page.locator('#agd-aluno').selectOption('1000');
    await page.locator('#agd-missao').selectOption('pedido:0');
    await page.locator('#agd-horario').selectOption('760');
    await expect(page.locator('#agd-previa ul')).toContainText('Muda:');
    const ins = await page.locator('#agd-instrutor').inputValue();
    await page.locator('#agd-confirmar').click();
    await expect(page.locator('#dlg-agendar')).toBeHidden();
    await expect(voo.locator('.c-hr')).toContainText('12:40–13:40');

    await irPara(page, 'dem');
    const pedido = page.locator('#dem tr[data-k="d"][data-id="1000"][data-mid="0"]');
    await pedido.locator('[data-f="insId"]').selectOption(ins === '1' ? '2' : '1');
    await abrirHistorico(page);
    const lista = page.locator('#audit-log-list');
    await lista.locator('.audit-item', { hasText: 'Agendado na escala' }).getByRole('button', { name: '↶ Desfazer' }).click();
    await expect(lista).toContainText('Revertido: Agendado na escala: Maria Silva');
    await lista.locator('.audit-item', { hasText: 'Pedido Maria Silva: instrutor' }).getByRole('button', { name: '↶ Reverter' }).click();
    await expect(lista).toContainText('Revertido: Pedido Maria Silva: instrutor');
    await page.locator('#btn-fechar-historico').click();
    // O pedido de antes do agendamento, sem o instrutor escolhido; o voo de volta às 06:30, solto
    await expect(pedido.locator('[data-f="insId"]')).toHaveValue('');
    await abrirEscala(page);
    await expect(voo.locator('.c-hr')).toContainText('06:30–07:30');
    await expect(voo.locator('.fixo')).toHaveCount(0);
  });
});
