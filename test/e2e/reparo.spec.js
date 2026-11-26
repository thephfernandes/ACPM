// Sugestões para um conflito: o botão "Sugestões" da caixa de conflitos abre uma gaveta com o que pode voar
// no lugar do voo fixo; "Aplicar" muda o voo (que continua fixo) e o histórico desfaz. Cancelar pede o motivo, como no
// status, já com o motivo do conflito marcado
import { test, expect, abrir, irPara, abrirEscala, abrirCaixa, abrirHistorico, alternarVem, aprovar, rotuloDaData, AMANHA } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';
import { documentosAtuais } from './supabase-falso.js';

const dia = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] });
const linha = (page, nome) => page.locator('#out tbody tr:not(.win)', { hasText: nome });
const gaveta = page => page.locator('#painel-reparo');

// Aprova a escala e tira o instrutor do voo do aluno 1000; devolve o nome dele e o do outro
async function aprovarETirarOInstrutor(page, url) {
  await abrir(page, { estado: dia(), url });
  await abrirEscala(page);
  await aprovar(page);
  const instrutor = (await linha(page, 'Aluno 1000').locator('.c-instr').innerText()).trim();
  const id = instrutor.endsWith('01') ? 1 : 2;
  await irPara(page, 'ins');
  await alternarVem(page, id, false);
  await abrirEscala(page);
  await abrirCaixa(page, 'conflitos');
  return { instrutor, outro: id === 1 ? 'Instrutor 02' : 'Instrutor 01' };
}

test.describe('Sugestões para um conflito', () => {
  test('troca o instrutor que não vem mais; o voo continua fixo e o histórico desfaz', async ({ page }) => {
    const { instrutor, outro } = await aprovarETirarOInstrutor(page);
    await page.locator('#out details.conflitos [data-reparo]').click();
    await expect(gaveta(page)).toBeVisible();
    await expect(gaveta(page).locator('h2')).toContainText('Aluno 1000');
    await expect(gaveta(page)).toContainText('o instrutor não está disponível');
    const primeira = gaveta(page).locator('.opcoes-reparo li').first();
    await expect(primeira).toContainText(`Trocar o instrutor: ${outro}`);
    await primeira.getByRole('button', { name: 'Aplicar' }).click();
    await expect(gaveta(page)).toBeHidden();
    await expect(page.locator('#out details.conflitos')).toHaveCount(0);
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText(outro);
    await expect(linha(page, 'Aluno 1000').locator('.fixo')).toHaveCount(1);

    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list')).toContainText(`Reparo: Aluno 1000 (06:30–07:30): Trocar o instrutor: ${outro}`);
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await page.keyboard.press('Escape');
    await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toHaveText(instrutor);
    await expect(page.locator('#out details.conflitos')).toHaveCount(1);
  });

  test('cancelar pede o motivo, já marcado; o conflito some', async ({ page }) => {
    await aprovarETirarOInstrutor(page);
    await page.locator('#out details.conflitos [data-reparo]').click();
    const cancelar = gaveta(page).locator('.opcoes-reparo li').last();
    await expect(cancelar).toContainText('Motivo: Instrutor indisponível');
    await cancelar.getByRole('button', { name: 'Cancelar o voo' }).click();
    await expect(gaveta(page)).toBeHidden();
    const dialogo = page.locator('#dlg-status');
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByLabel('Instrutor indisponível')).toBeChecked();
    await dialogo.getByRole('button', { name: 'Confirmar' }).click();
    await expect(linha(page, 'Aluno 1000')).toHaveClass(/\bst-Cancelado\b/);
    await expect(page.locator('#out details.conflitos')).toHaveCount(0);
  });

  test('Esc fecha a gaveta e devolve o foco ao botão', async ({ page }) => {
    await aprovarETirarOInstrutor(page);
    const botao = page.locator('#out details.conflitos [data-reparo]');
    await botao.click();
    await expect(gaveta(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(gaveta(page)).toBeHidden();
    await expect(botao).toBeFocused();
  });

  // As gavetas ficam umas sobre as outras: o Esc fecha só a de cima (a que abriu por último), e o próximo, a de baixo
  test('com o Histórico aberto, o Esc fecha primeiro as Sugestões, abertas depois; o segundo, o Histórico', async ({ page }) => {
    await aprovarETirarOInstrutor(page);
    await abrirHistorico(page);
    await expect(page.locator('#historico')).toBeVisible();
    // A gaveta do Histórico pode cobrir o botão: pelo teclado
    await page.locator('#out details.conflitos [data-reparo]').focus();
    await page.keyboard.press('Enter');
    await expect(gaveta(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(gaveta(page)).toBeHidden();
    await expect(page.locator('#historico')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
  });

  // O pedido mudou depois da aprovação (a duração): a única sugestão é soltar o voo
  test('soltar o voo: o app escala de novo, sem o cadeado; o histórico desfaz', async ({ page }) => {
    const estado = { ...dia(), stu: [aluno(1000, { p1: 390, p2: -1, nb: 2 })], fixos: { '1000_0_1': { a: 390, b: 450, r: 'PP-LJV', insId: 1 } }, aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' } };
    await abrir(page, { estado });
    await abrirEscala(page);
    await expect(page.locator('#out details.conflitos')).toContainText('a duração do pedido mudou');
    await abrirCaixa(page, 'conflitos');
    await page.locator('#out details.conflitos [data-reparo]').click();
    const opcoes = gaveta(page).locator('.opcoes-reparo li');
    await expect(opcoes).toHaveCount(2);
    await expect(opcoes.first()).toContainText('Soltar o voo: o app escolhe de novo o horário, o avião e o instrutor');
    await opcoes.first().getByRole('button', { name: 'Soltar' }).click();
    await expect(gaveta(page)).toBeHidden();
    await expect(page.locator('#out details.conflitos')).toHaveCount(0);
    await expect(linha(page, 'Aluno 1000').locator('.fixo')).toHaveCount(0);
    await expect(linha(page, 'Aluno 1000').locator('.c-hr')).toContainText('06:30–08:30');

    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list')).toContainText('Reparo: Aluno 1000 (06:30–07:30): Soltar o voo');
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#out details.conflitos')).toHaveCount(1);
  });

  test('fora da disponibilidade do pedido: dois cliques ("Confirmei com o aluno"); o voo e o pedido mudam; o histórico desfaz os dois', async ({ page }) => {
    // O voo das 08:20, de quem só pode de manhã, fixo com o único instrutor, que agora só vem à tarde
    const aw = Array(9).fill(true).map((_, w) => w >= 4);
    const estado = {
      ...cenario({ ins: [instrutor(1, 9, { aw })], stu: [aluno(1000, { p1: 500, p2: -1, jan: 'manha' })] }),
      fixos: { '1000_0_1': { a: 500, b: 560, r: 'PP-LJV', insId: 1 } }
    };
    await abrir(page, { estado });
    await abrirEscala(page);
    await abrirCaixa(page, 'conflitos');
    await page.locator('#out details.conflitos [data-reparo]').click();
    const primeira = gaveta(page).locator('.opcoes-reparo li').first();
    await expect(primeira).toContainText('Passar para as 12:40');
    await expect(primeira).toContainText('Confirme com o aluno: às 12:40, fora da disponibilidade do pedido.');
    const aplicar = primeira.getByRole('button', { name: 'Aplicar' });
    await aplicar.click();
    await expect(primeira.locator('[data-reparo-aplicar]')).toHaveText('Confirmei com o aluno');
    await expect(gaveta(page)).toBeVisible();
    await primeira.locator('[data-reparo-aplicar]').click();
    await expect(gaveta(page)).toBeHidden();
    await expect(page.locator('#out details.conflitos')).toHaveCount(0);
    await expect(linha(page, 'Aluno 1000').locator('.c-hr')).toContainText('12:40');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('acpm4_dia_2026-11-11')).pedidos[1000].jan)).toBe('h760');

    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list')).toContainText('Reparo: Aluno 1000 (08:20–09:20): Passar para as 12:40');
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#out details.conflitos')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('acpm4_dia_2026-11-11')).pedidos[1000].jan)).toBe('manha');
  });

  test('no Gestor, a caixa de conflitos aparece sem o botão Sugestões', async ({ page }) => {
    const estado = { ...dia(), ins: [instrutor(1, 9, { on: false }), instrutor(2, 9)], fixos: { '1000_0_1': { a: 390, b: 450, r: 'PP-LJV', insId: 1 } }, aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' } };
    await abrir(page, { estado, url: './?role=gestor' });
    await abrirEscala(page);
    await expect(page.locator('#out details.conflitos')).toContainText('o instrutor não está disponível');
    await expect(page.locator('#out details.conflitos [data-reparo]')).toHaveCount(1);
    await expect(page.locator('#out details.conflitos [data-reparo]')).toBeHidden();
  });
});

// O voo cancelado também tem sugestões (F1e): o aluno não perde o voo porque o instrutor faltou. O motivo do cancelamento
// sai da busca (aqui, o instrutor); aplicada, a sugestão volta o voo para Pendente com o outro instrutor; o Histórico desfaz
test.describe('Sugestões para um voo cancelado', () => {
  const doisInstrutores = () => cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] });

  test('cancelado por "Instrutor indisponível": outro instrutor no mesmo horário; aplicada, Pendente; o histórico desfaz', async ({ page }) => {
    await abrir(page, { estado: doisInstrutores() });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    const instrutor = (await voo.locator('.c-instr').innerText()).trim();
    await voo.locator('.st-sel').selectOption('Cancelado');
    await page.locator('#dlg-status').getByLabel('Instrutor indisponível').check();
    await page.locator('#dlg-status').getByRole('button', { name: 'Confirmar' }).click();
    await expect(voo).toHaveClass(/\bst-Cancelado\b/);

    await voo.getByRole('button', { name: 'Sugestões' }).click();
    await expect(gaveta(page)).toBeVisible();
    await expect(gaveta(page).locator('h2')).toContainText('Aproveitar o voo cancelado');
    await expect(gaveta(page)).toContainText('Cancelado: Instrutor indisponível.');
    const primeira = gaveta(page).locator('.opcoes-reparo li').first();
    await expect(primeira).toContainText('10:10');
    await expect(primeira).not.toContainText(instrutor);
    await primeira.getByRole('button', { name: 'Aplicar' }).click();
    await expect(gaveta(page)).toBeHidden();
    await expect(voo.locator('.st-sel')).toHaveValue('Pendente');
    await expect(voo.locator('.c-instr')).not.toHaveText(instrutor);
    await expect(voo.locator('.fixo')).toHaveCount(1);

    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list')).toContainText('Voo cancelado aproveitado: Aluno 1000 (10:10–11:10)');
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await page.keyboard.press('Escape');
    await expect(voo.locator('.st-sel')).toHaveValue('Cancelado');
    await expect(voo.locator('.st-detalhe')).toHaveText('Instrutor indisponível');
  });

  test('o 7º voo local do horário, na escala aprovada: a sugestão avisa e pede dois cliques ("Aplicar mesmo assim")', async ({ page }) => {
    // Seis Voos Locais às 10:10, fixos pela aprovação; o do Aluno 1006, às 08:20 e só disponível às 10:10, cancelado
    // pela meteorologia
    const seis = ['PP-LJV', 'PR-BTB', 'PR-IGU', 'PR-MLB', 'PR-TBT', 'PR-THI'];
    const estado = {
      ...cenario({
        ins: [1, 2, 3, 4, 5, 6, 7].map(id => instrutor(id, 9)),
        stu: [...[1000, 1001, 1002, 1003, 1004, 1005].map(id => aluno(id, { p1: 610, p2: -1 })), aluno(1006, { p1: 500, p2: -1, jan: 'h610' })]
      }),
      fixos: { ...Object.fromEntries(seis.map((r, i) => [`${1000 + i}_0_1`, { a: 610, b: 670, r, insId: i + 1 }])), '1006_0_1': { a: 500, b: 560, r: 'PP-LJV', insId: 7 } },
      aprovacao: { em: '2026-11-10T21:05:00.000Z', por: 'Operador 01' },
      fStatus: { '1006_0_1': 'Cancelado' }, fObs: { '1006_0_1': { motivo: 'Meteorologia' } }
    };
    await abrir(page, { estado });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1006');
    await voo.getByRole('button', { name: 'Sugestões' }).click();
    const primeira = gaveta(page).locator('.opcoes-reparo li').first();
    await expect(primeira).toContainText('10:10');
    await expect(primeira).toContainText('Às 10:10, o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.');
    await primeira.getByRole('button', { name: 'Aplicar' }).click();
    await expect(primeira.locator('[data-reparo-aplicar]')).toHaveText('Aplicar mesmo assim');
    await expect(voo.locator('.st-sel')).toHaveValue('Cancelado');
    await primeira.locator('[data-reparo-aplicar]').click();
    await expect(gaveta(page)).toBeHidden();
    await expect(voo.locator('.st-sel')).toHaveValue('Pendente');
    await expect(voo.locator('.c-hr')).toContainText('10:10');
    await expect(page.locator('#out tbody tr:not(.win) .c-hr', { hasText: '10:10–11:10' })).toHaveCount(7);
  });

  test('na escala não aprovada, a sugestão que muda outro voo diz qual e pede dois cliques; a gaveta não promete "sem mexer"', async ({ page }) => {
    // 08:20 Aluno 1001 com um instrutor e 10:10 Aluno 1000 com o outro; o 1001 cancelado pelo instrutor: o motor refaz o
    // das 10:10 em volta da sugestão
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: 870 }), aluno(1001, { p1: 500, p2: 760 })] }) });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1001');
    await voo.locator('.st-sel').selectOption('Cancelado');
    await page.locator('#dlg-status').getByLabel('Instrutor indisponível').check();
    await page.locator('#dlg-status').getByRole('button', { name: 'Confirmar' }).click();
    const outro = (await linha(page, 'Aluno 1000').innerText()).replace(/\s+/g, ' ');
    await voo.getByRole('button', { name: 'Sugestões' }).click();
    await expect(gaveta(page)).not.toContainText('sem mexer nos outros voos');
    const comMudanca = gaveta(page).locator('.opcoes-reparo li', { hasText: 'Muda também outro voo: Aluno 1000' }).first();
    await expect(comMudanca).toBeVisible();
    const botao = comMudanca.locator('[data-reparo-aplicar]');
    await botao.click();
    await expect(botao).toHaveText('Aplicar mesmo assim');
    await expect(voo.locator('.st-sel')).toHaveValue('Cancelado');
    expect((await linha(page, 'Aluno 1000').innerText()).replace(/\s+/g, ' ')).toBe(outro);
    await botao.click();
    await expect(gaveta(page)).toBeHidden();
    await expect(voo.locator('.st-sel')).toHaveValue('Pendente');
  });

  test('cancelado porque o aluno faltou: sem "Sugestões"', async ({ page }) => {
    await abrir(page, { estado: doisInstrutores() });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    await voo.locator('.st-sel').selectOption('Cancelado');
    await page.locator('#dlg-status').getByLabel('Aluno ausente').check();
    await page.locator('#dlg-status').getByRole('button', { name: 'Confirmar' }).click();
    await expect(voo).toHaveClass(/\bst-Cancelado\b/);
    await expect(voo.getByRole('button', { name: 'Sugestões' })).toHaveCount(0);
  });

  test('sem nada que sirva: "Impossível nesta data", com o porquê', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] }) });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    await voo.locator('.st-sel').selectOption('Cancelado');
    await page.locator('#dlg-status').getByLabel('Instrutor indisponível').check();
    await page.locator('#dlg-status').getByRole('button', { name: 'Confirmar' }).click();
    await voo.getByRole('button', { name: 'Sugestões' }).click();
    await expect(gaveta(page)).toContainText('Impossível nesta data.');
    await expect(gaveta(page).locator('.impossivel li')).toHaveCount(3);
  });
});

// A recusa do pedido cujo instrutor escolhido não serve também tem "Sugestões" (F1e): outro instrutor que o encaixa sem
// mudar outro voo; aplicada, a escolha do pedido muda e ele entra; o histórico desfaz
test('o pedido recusado pelo instrutor escolhido: "Sugestões" na linha da recusa encaixa com outro instrutor', async ({ page }) => {
  await abrir(page, { estado: cenario({ ins: [instrutor(1, 9, { on: false }), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1, insId: 1 })] }) });
  await abrirEscala(page);
  await abrirCaixa(page, 'erros');
  await page.locator('#out details.caixa.erros').getByRole('button', { name: 'Sugestões' }).click();
  await expect(gaveta(page).locator('h2')).toContainText('Encaixar o pedido');
  const primeira = gaveta(page).locator('.opcoes-reparo li').first();
  await expect(primeira).toContainText('Com Instrutor 02');
  await primeira.getByRole('button', { name: 'Aplicar' }).click();
  await expect(gaveta(page)).toBeHidden();
  await expect(linha(page, 'Aluno 1000').locator('.c-instr')).toContainText('Instrutor 02');
  await abrirHistorico(page);
  await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#out details.caixa.erros')).toContainText('Aluno 1000');
});

// Uma data que já passou (hoje, nos testes, é 10/11, ao meio-dia), ou hoje: o cadastro e o dia gravados como o app grava,
// abertos pelo endereço
const ONTEM = '2026-11-09', HOJE = '2026-11-10';
async function abrirNaData(page, estado, data) {
  const { documentos, dias } = documentosAtuais(estado, data);
  await page.addInitScript(([cadastro, dia, data]) => {
    if (localStorage.getItem('acpm4_cadastro')) return;
    localStorage.setItem('acpm4_cadastro', cadastro);
    localStorage.setItem(`acpm4_dia_${data}`, dia);
  }, [JSON.stringify(documentos.cadastro), JSON.stringify(dias[data]), data]);
  await abrir(page, { url: `./?data=${data}` });
  await abrirEscala(page);
  await expect(rotuloDaData(page)).toContainText(`${data.slice(8)}/${data.slice(5, 7)}`);
}
const abrirNaDataPassada = (page, estado) => abrirNaData(page, estado, ONTEM);

test.describe('Sugestões só de hoje em diante', () => {
  test('hoje, a recusa que outro instrutor só encaixaria num horário que já passou diz isso, e aponta "+ Agendar voo"', async ({ page }) => {
    // Às 12:00, o pedido das 06:30 (2ª preferência 14:30) cujo escolhido não vem: o app o poria às 06:30
    await abrirNaData(page, cenario({ ins: [instrutor(1, 9, { on: false }), instrutor(2, 9)], stu: [aluno(1001, { p1: 390, p2: 870, insId: 1 })] }), HOJE);
    await abrirCaixa(page, 'erros');
    await page.locator('#out details.caixa.erros [data-rejeitado]').click();
    await expect(gaveta(page).locator('.opcoes-reparo li')).toHaveCount(0);
    await expect(gaveta(page)).not.toContainText('sem mudar outro voo');
    await expect(gaveta(page)).toContainText('Com outro instrutor, o app escala este pedido num horário que já passou.');
    await expect(gaveta(page)).toContainText('+ Agendar voo');
  });


  test('na data passada, a recusa do instrutor escolhido não tem "Sugestões"', async ({ page }) => {
    await abrirNaDataPassada(page, cenario({ ins: [instrutor(1, 9, { on: false }), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1, insId: 1 })] }));
    await abrirCaixa(page, 'erros');
    await expect(page.locator('#out details.caixa.erros')).toContainText('Aluno 1000');
    await expect(page.locator('#out details.caixa.erros [data-rejeitado]')).toHaveCount(0);
  });

  test('na data passada, o voo cancelado não tem "Sugestões"', async ({ page }) => {
    await abrirNaDataPassada(page, {
      ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] }),
      fStatus: { '1000_0_1': 'Cancelado' }, fObs: { '1000_0_1': { motivo: 'Instrutor indisponível' } }
    });
    const voo = linha(page, 'Aluno 1000');
    await expect(voo.locator('.st-sel')).toHaveValue('Cancelado');
    await expect(voo.getByRole('button', { name: 'Sugestões' })).toHaveCount(0);
  });
});

// O voo cancelado pela meteorologia, de quem só pode às 10:10 (fixo, como o status deixa)
const canceladoSoAs1010 = (extra = {}) => ({
  ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 610, p2: -1, jan: 'h610' })], ...extra }),
  fixos: { '1000_0_1': { a: 610, b: 670, r: 'PP-LJV', insId: 1 } },
  fStatus: { '1000_0_1': 'Cancelado' }, fObs: { '1000_0_1': { motivo: 'Meteorologia' } }
});

test.describe('Sugestões do voo cancelado: o mapa, a confirmação, o resultado e o Gestor', () => {
  test('fora da disponibilidade: o primeiro clique arma "Confirmei com o aluno" e não muda nada; o segundo aplica e muda o pedido', async ({ page }) => {
    await abrir(page, { estado: canceladoSoAs1010() });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    await voo.getByRole('button', { name: 'Sugestões' }).click();
    const primeira = gaveta(page).locator('.opcoes-reparo li').first();
    await expect(primeira).toContainText('Confirme com o aluno:');
    await expect(primeira.locator('.confirmar-aluno')).toContainText('fora da disponibilidade do pedido');
    const botao = primeira.locator('[data-reparo-aplicar]');
    await botao.click();
    await expect(botao).toHaveText('Confirmei com o aluno');
    await expect(gaveta(page)).toBeVisible();
    await expect(voo.locator('.st-sel')).toHaveValue('Cancelado');
    await botao.click();
    await expect(gaveta(page)).toBeHidden();
    await expect(voo.locator('.st-sel')).toHaveValue('Pendente');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('acpm4_dia_2026-11-11')).pedidos[1000].jan)).not.toBe('h610');
  });

  test('sem o segundo clique, o botão volta a "Aplicar" e o voo continua cancelado', async ({ page }) => {
    await abrir(page, { estado: canceladoSoAs1010() });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    await voo.getByRole('button', { name: 'Sugestões' }).click();
    const botao = gaveta(page).locator('.opcoes-reparo li').first().locator('[data-reparo-aplicar]');
    await botao.click();
    await expect(botao).toHaveText('Confirmei com o aluno');
    await page.clock.runFor(4000);
    await expect(botao).toHaveText('Aplicar');
    await expect(voo.locator('.st-sel')).toHaveValue('Cancelado');
  });

  test('no mapa, o popup do voo cancelado tem "Sugestões", que abre a gaveta', async ({ page }) => {
    await abrir(page, { estado: canceladoSoAs1010() });
    await abrirEscala(page, { vista: 'eq' });
    await page.locator('#out .tl-bar.tl-st-Cancelado').click();
    await expect(page.locator('#tl-pop')).toBeVisible();
    await page.locator('#tl-pop').getByRole('button', { name: 'Sugestões' }).click();
    await expect(gaveta(page)).toBeVisible();
    await expect(gaveta(page).locator('h2')).toContainText('Aproveitar o voo cancelado');
    await expect(gaveta(page)).toContainText('Cancelado: Meteorologia.');
  });

  // O popup é a camada de baixo: aberta a gaveta, ele fecha, e o Esc fecha a gaveta e volta para a barra do voo
  test('pelo teclado, do popup do mapa: a gaveta abre no lugar do popup, e o Esc a fecha e volta para a barra', async ({ page }) => {
    await abrir(page, { estado: canceladoSoAs1010() });
    await abrirEscala(page, { vista: 'eq' });
    const barra = page.locator('#out .tl-bar.tl-st-Cancelado');
    await barra.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#tl-pop')).toBeVisible();
    await page.locator('#tl-pop').getByRole('button', { name: 'Sugestões' }).focus();
    await page.keyboard.press('Enter');
    await expect(gaveta(page)).toBeVisible();
    await expect(page.locator('#tl-pop')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(gaveta(page)).toBeHidden();
    await expect(barra).toBeFocused();
  });

  test('aplicada pelo teclado, o foco vai para o voo (o status dele na lista)', async ({ page }) => {
    await abrir(page, {
      estado: {
        ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 610, p2: -1 })] }),
        fixos: { '1000_0_1': { a: 610, b: 670, r: 'PP-LJV', insId: 1 } },
        fStatus: { '1000_0_1': 'Cancelado' }, fObs: { '1000_0_1': { motivo: 'Instrutor indisponível' } }
      }
    });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    await voo.getByRole('button', { name: 'Sugestões' }).click();
    await expect(gaveta(page).locator('[data-reparo-aplicar]').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(gaveta(page)).toBeHidden();
    await expect(voo.locator('.st-sel')).toHaveValue('Pendente');
    await expect(voo.locator('.st-sel')).toBeFocused();
  });

  test('a frase da confirmação fica numa linha própria, separada do texto da sugestão', async ({ page }) => {
    await abrir(page, { estado: canceladoSoAs1010() });
    await abrirEscala(page);
    await linha(page, 'Aluno 1000').getByRole('button', { name: 'Sugestões' }).click();
    const primeira = gaveta(page).locator('.opcoes-reparo li').first();
    await expect(primeira.locator('.confirmar-aluno')).toHaveCSS('display', 'block');
    await expect(primeira.locator('span').first()).toHaveText(/Instrutor 01 Confirme com o aluno/);
  });

  test('o voo cancelado que já tem resultado registrado não tem "Sugestões"', async ({ page }) => {
    const resultado = { id: 1, aluno: 1000, curso: 'PP', missao: 'PP-01', resultado: 'reprovado', data: AMANHA, voo: '1000_0_1', registrado_em: '2026-11-10T12:00:00.000Z', registrado_por: 'Operador 01' };
    await page.addInitScript(json => { if (!localStorage.getItem('acpm4_resultados')) localStorage.setItem('acpm4_resultados', json); }, JSON.stringify([resultado]));
    await abrir(page, { estado: canceladoSoAs1010() });
    await abrirEscala(page);
    const voo = linha(page, 'Aluno 1000');
    await expect(voo.locator('.st-sel')).toHaveValue('Cancelado');
    await expect(voo.getByRole('button', { name: 'Sugestões' })).toHaveCount(0);
    await abrirEscala(page, { vista: 'eq' });
    await page.locator('#out .tl-bar.tl-st-Cancelado').click();
    await expect(page.locator('#tl-pop')).toBeVisible();
    await expect(page.locator('#tl-pop').getByRole('button', { name: 'Sugestões' })).toHaveCount(0);
  });

  test('no Gestor, o voo cancelado e a recusa do instrutor escolhido ficam sem "Sugestões", e a gaveta não abre', async ({ page }) => {
    const estado = canceladoSoAs1010({ ins: [instrutor(1, 9), instrutor(2, 9, { on: false })] });
    estado.stu = [...estado.stu, aluno(1001, { p1: 390, p2: -1, insId: 2 })];
    await abrir(page, { estado, url: './?role=gestor' });
    await abrirEscala(page);
    const doCancelado = linha(page, 'Aluno 1000').locator('[data-reparo]');
    await expect(doCancelado).toHaveCount(1);
    await expect(doCancelado).toBeHidden();
    await abrirCaixa(page, 'erros');
    const daRecusa = page.locator('#out details.caixa.erros [data-rejeitado]');
    await expect(daRecusa).toHaveCount(1);
    await expect(daRecusa).toBeHidden();
    await doCancelado.dispatchEvent('click');
    await daRecusa.dispatchEvent('click');
    await expect(gaveta(page)).toBeHidden();
  });
});
