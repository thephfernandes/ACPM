// A prioridade do pedido (js/funcionalidades.js, prioridade). Desligada (o padrão): a Demanda fica sem a coluna, nenhum
// texto fala dela (as dicas, o glossário e o Manual), e a escala segue a ordem dos agendamentos e do cadastro; a prioridade
// guardada continua no dia, depois de gravar e recarregar, e ligar de novo a traz de volta. Ligada: a tela mostra 1 como a
// mais alta (a guardada continua com 5 a mais alta: o formato não muda)
import { test, comPrioridade, expect, abrir, irPara, abrirEscala, lerEscala, appPronto, campoDoPedido, linhaDoPedido, voar, botaoDaData, avisosDaData, AMANHA } from './fixtures.js';
import { aluno, apenas, cenario, instrutor } from '../helpers/montar.js';
import { montarGlossario } from '../../js/glossario.js';

// Um instrutor e um avião, os dois alunos na mesma 1ª preferência (06:30): quem a escala confere antes fica com ela. O
// Aluno 1000, primeiro no cadastro, tem a prioridade guardada mais baixa (1); o Aluno 1001, a mais alta (5). O Aluno 1002
// não voa
const dia = () => cenario({
  ins: [instrutor(1, 9)], semAeronaves: apenas('C152', 'PP-LJV'),
  stu: [aluno(1000, { p1: 390, p2: -1, pr: 1 }), aluno(1001, { p1: 390, p2: -1, pr: 5 }), aluno(1002, { fly: false })]
});
// Quem ficou com as 06:30 (o voo, não a linha da janela)
async function naPreferencia(page) {
  await abrirEscala(page);
  const voos = (await lerEscala(page)).linhas.filter(l => /^06:30/.test(l) && /Aluno \d+/.test(l));
  expect(voos).toHaveLength(1);
  return voos[0].match(/Aluno \d+/)[0];
}
const guardadas = page => page.evaluate(d => {
  const { pedidos } = JSON.parse(localStorage.getItem(`acpm4_dia_${d}`) || '{"pedidos":{}}');
  return [1000, 1001].map(id => pedidos[id] && pedidos[id].pr);
}, AMANHA);
const textoDaPagina = page => page.evaluate(() => [...document.body.querySelectorAll(':scope > :not(script)')].map(el => el.textContent).join(' '));

test.describe('A prioridade desligada (o padrão)', () => {
  test('a Demanda fica sem a coluna, e nenhum texto fala dela: as dicas, o glossário e o Manual', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await irPara(page, 'dem');
    await expect(page.locator('#s-dem thead th')).toHaveText(['Aluno', 'Voa', 'Missão', 'Recurso', 'Instrutor', '1ª preferência', '2ª preferência', 'Duração']);
    await expect(page.locator('#dem [data-f="pr"]')).toHaveCount(0);
    await expect(linhaDoPedido(page, 1000).locator('td')).toHaveCount(8);
    await expect(page.locator('[data-dica="prioridade"]')).toHaveCount(0);
    for (const aba of ['esc', 'dem', 'age', 'rec', 'ins', 'alu', 'cur', 'rod', 'bi']) await irPara(page, aba);
    await page.locator('#btn-manual').click();
    await expect(page.locator('#s-manual')).toBeVisible();
    expect(await textoDaPagina(page)).not.toMatch(/prioridade/i);
    expect(await page.locator('[aria-label*="prioridade" i], [title*="prioridade" i]').count()).toBe(0);
    await expect(page.locator('#glossario-prioridade')).toHaveCount(0);
    expect(montarGlossario(() => false).prioridade).toBeUndefined();
  });

  test('a escala segue a ordem do cadastro; a prioridade guardada continua no dia, depois de gravar e recarregar; ligada, vale de novo', async ({ page }) => {
    await abrir(page, { estado: dia() });
    expect(await naPreferencia(page)).toBe('Aluno 1000');
    // Uma alteração qualquer grava o dia: o Aluno 1002 voa e deixa de voar
    await irPara(page, 'dem');
    await page.locator('#onlyfly').uncheck();
    await voar(page, 1002, true);
    await voar(page, 1002, false);
    await expect.poll(() => guardadas(page)).toEqual([1, 5]);
    await page.reload();
    await appPronto(page);
    expect(await naPreferencia(page)).toBe('Aluno 1000');
    expect(await guardadas(page)).toEqual([1, 5]);

    // Ligada: a mesma data, com a prioridade guardada (na tela, 5 e 1). A escala gravada aparece como foi feita, e a
    // próxima alteração a refaz com a prioridade
    await page.goto('./?funcionalidades=prioridade');
    await appPronto(page);
    expect(await naPreferencia(page)).toBe('Aluno 1000');
    await irPara(page, 'dem');
    await expect(campoDoPedido(page, 1000, 'pr')).toHaveValue('5');
    await expect(campoDoPedido(page, 1001, 'pr')).toHaveValue('1');
    await page.locator('#onlyfly').uncheck();
    await voar(page, 1002, true);
    await voar(page, 1002, false);
    expect(await naPreferencia(page)).toBe('Aluno 1001');
    expect(await guardadas(page)).toEqual([1, 5]);
  });

  test('o motivo do avião ocupado não fala da prioridade: na Escala, nos avisos da data e na prévia do agendamento', async ({ page }) => {
    await abrir(page, { estado: semAviao() });
    await abrirEscala(page);
    await expect(motivoDaEscala(page)).toHaveText('Aluno 1001 Rejeitado: nenhum C152 livre nos horários possíveis; 1º na lista de espera das 06:30.');
    // Os avisos da data, no trilho: o mesmo motivo
    await botaoDaData(page).click();
    await expect(avisosDaData(page, 'Aluno 1001')).toContainText('Rejeitado: nenhum C152 livre nos horários possíveis; 1º na lista de espera das 06:30.');
    await expect(avisosDaData(page, 'Aluno 1001')).not.toContainText(/prioridade/i);
    await botaoDaData(page).click();
    // Agendar o Aluno 1002 às 06:30 tira o Aluno 1000, pelo mesmo motivo
    await page.locator('#btn-agendar').click();
    await page.locator('#agd-aluno').selectOption('1002');
    await page.locator('#agd-horario').selectOption('390');
    await page.locator('#agd-previa summary').click();
    await expect(page.locator('#agd-previa ul')).toContainText('Sai: Aluno 1000 (nenhum C152 livre nos horários possíveis; 1º na lista de espera das 06:30)');
    await expect(page.locator('#agd-previa ul')).not.toContainText(/prioridade/i);
  });

  test('a escala gravada com a prioridade ligada aparece sem o motivo da prioridade', async ({ page }) => {
    await abrir(page, { estado: semAviao() });
    // Ligada, uma alteração grava a escala com o motivo da prioridade
    await page.goto('./?funcionalidades=prioridade');
    await appPronto(page);
    await irPara(page, 'dem');
    await page.locator('#onlyfly').uncheck();
    await voar(page, 1002, true);
    await voar(page, 1002, false);
    const gravado = () => page.evaluate(d => {
      const { resultado } = JSON.parse(localStorage.getItem(`acpm4_dia_${d}`) || '{}');
      return ((resultado && resultado.al) || []).filter(a => a.s === 'Aluno 1001').map(a => a.m);
    }, AMANHA);
    await expect.poll(gravado).toEqual(['Rejeitado: nenhum C152 livre nos horários possíveis (ocupados por pedidos de prioridade maior); 1º na lista de espera das 06:30.']);
    // Desligada, a mesma escala gravada (nada a refaz) aparece sem ele, e continua gravada como estava
    await page.goto('./');
    await appPronto(page);
    await abrirEscala(page);
    await expect(motivoDaEscala(page)).toHaveText('Aluno 1001 Rejeitado: nenhum C152 livre nos horários possíveis; 1º na lista de espera das 06:30.');
    expect(await gravado()).toEqual(['Rejeitado: nenhum C152 livre nos horários possíveis (ocupados por pedidos de prioridade maior); 1º na lista de espera das 06:30.']);
  });
});

// Dois instrutores e um avião, os dois alunos só podem às 06:30 (na disponibilidade): o Aluno 1001 fica sem avião e, com o
// horário exato, espera por ele (F1h, N14). O Aluno 1002 não voa (o agendamento o põe às 06:30, e o Aluno 1000 sai)
const semAviao = () => cenario({
  ins: [instrutor(1, 9), instrutor(2, 9)], semAeronaves: apenas('C152', 'PP-LJV'),
  stu: [aluno(1000, { p1: 390, p2: -1, jan: 'h390' }), aluno(1001, { p1: 390, p2: -1, jan: 'h390' }), aluno(1002, { fly: false })]
});
const motivoDaEscala = page => page.locator('#s-esc [data-caixa="erros"] li', { hasText: 'Aluno 1001' });

comPrioridade.describe('A prioridade ligada: 1 é a mais alta', () => {
  comPrioridade('a tela mostra 1 para a guardada 5; escolher 1 guarda 5, e a escala segue a guardada', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await irPara(page, 'dem');
    await expect(page.locator('#s-dem thead th').last()).toHaveText('Prioridade');
    await expect(campoDoPedido(page, 1000, 'pr').locator('option')).toHaveText(['1', '2', '3', '4', '5']);
    await expect(campoDoPedido(page, 1000, 'pr')).toHaveValue('5');
    await expect(campoDoPedido(page, 1001, 'pr')).toHaveValue('1');
    // A mais alta em destaque
    await expect(linhaDoPedido(page, 1001)).toHaveClass(/\bprioridade-mais-alta\b/);
    await expect(linhaDoPedido(page, 1000)).not.toHaveClass(/\bprioridade-mais-alta\b/);
    expect(await naPreferencia(page)).toBe('Aluno 1001');

    // O Aluno 1000 passa a 1 na tela: guarda 5, como o 1001; empatados, vale o cadastro
    await irPara(page, 'dem');
    await campoDoPedido(page, 1000, 'pr').selectOption('1');
    await expect.poll(() => guardadas(page)).toEqual([5, 5]);
    await expect(campoDoPedido(page, 1000, 'pr')).toHaveValue('1');
    expect(await naPreferencia(page)).toBe('Aluno 1000');
    // O 1001 passa a 4 na tela: guarda 2
    await irPara(page, 'dem');
    await campoDoPedido(page, 1001, 'pr').selectOption('4');
    await expect.poll(() => guardadas(page)).toEqual([5, 2]);
    await page.reload();
    await appPronto(page);
    await irPara(page, 'dem');
    await expect(campoDoPedido(page, 1001, 'pr')).toHaveValue('4');
  });

  comPrioridade('o motivo do avião ocupado continua com a prioridade', async ({ page }) => {
    await abrir(page, { estado: semAviao() });
    await abrirEscala(page);
    await expect(motivoDaEscala(page)).toHaveText('Aluno 1001 Rejeitado: nenhum C152 livre nos horários possíveis (ocupados por pedidos de prioridade maior); 1º na lista de espera das 06:30.');
  });

  comPrioridade('a dica e o Manual dizem que 1 é a mais alta', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await irPara(page, 'dem');
    await expect(page.locator('#s-dem [data-dica="prioridade"]')).toHaveCount(1);
    await page.locator('#btn-manual').click();
    await expect(page.locator('#glossario-prioridade')).toHaveText(montarGlossario(() => true).prioridade.texto);
    await expect(page.locator('#glossario-prioridade')).toContainText('1 é a mais alta');
    await expect(page.locator('#s-manual')).toContainText('por prioridade (1 primeiro)');
    await expect(page.locator('#s-manual')).not.toContainText(/5 (primeiro|é a mais alta)|quem tem 5/);
  });
});
