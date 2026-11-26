// Tela da Escala: Lista, Por recurso ou Por instrutor; resumo com erros e avisos agrupados; uma linha por voo.
import { test, expect, abrir, abrirComExemplo, abrirEscala, irPara, irParaVista, lerEscala, alternarDisponivel, alvosPequenos, larguraDaPagina, appPronto, AMANHA, prepararContexto, vigiarErros, entrar, importarDaAgenda, abrirCaixa } from './fixtures.js';
import { criarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { IDS } from '../helpers/casos-do-programa.js';
import { cursosIniciais, gravarCurso } from '../../js/programa.js';
import { aluno, cenario, instrutor, GROUND_C152 } from '../helpers/montar.js';
import { GLOSSARIO } from '../../js/glossario.js';
import { COLUNAS_DO_PAINEL } from '../../js/config-do-painel.js';

// O painel como era antes do quadro Missões: Partidas e Chegadas alternando, com todas as colunas (Previsto e Observação
// também), na ordem do padrão
const PAINEL_DO_AEROPORTO = { quadro: 'alternar', colunas: COLUNAS_DO_PAINEL.map(c => ({ id: c.id, on: true })) };

test.describe('Tela da Escala', () => {
  test('a barra troca entre Por recurso (a que abre), Por instrutor, Lista e Painel', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page, { vista: null });
    await expect(page.locator('#s-esc [data-tl]')).toHaveText(['Por recurso', 'Por instrutor', 'Lista', 'Painel']);
    await expect(page.locator('#s-esc [data-tl="eq"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('#out .mapa')).toBeVisible();
    await expect(page.locator('#out table')).toBeHidden();
    await expect(page.locator('#btn-eixo')).toBeVisible();

    await page.locator('#s-esc [data-tl="lista"]').click();
    await expect(page.locator('#out table')).toBeVisible();
    await expect(page.locator('#out .mapa')).toBeHidden();
    await expect(page.locator('#btn-eixo')).toBeHidden();

    await page.locator('#s-esc [data-tl="eq"]').click();
    await expect(page.locator('#out .mapa')).toBeVisible();
    await expect(page.locator('#out table')).toBeHidden();
    await expect(page.locator('#out .tl-row .tl-lbl').first()).toContainText(/^P[PRT]-|^SIM-|^Sala Ground/);

    await page.locator('#s-esc [data-tl="ins"]').click();
    await expect(page.locator('#out .tl-row .tl-lbl').first()).toContainText('Instrutor');
    await page.locator('#s-esc [data-tl="painel"]').click();
    await expect(page.locator('#out .painel-dia')).toBeVisible();
    await expect(page.locator('#out .mapa')).toBeHidden();
    await expect(page.locator('#out .tabela-escala')).toBeHidden();
    await page.locator('#s-esc [data-tl="lista"]').click();
    await expect(page.locator('#out .tabela-escala table')).toBeVisible();
    await expect(page.locator('#out .painel-dia')).toBeHidden();
  });

  test('resumo: os números numa linha; o que não entrou numa caixa vermelha aberta; os avisos agrupados numa caixa fechada', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 1)], stu: [
      aluno(1000, { mis: 'Multimotor', eq: 'PA-34' }),
      aluno(1001, {}, { kg: 0 }),
      aluno(1002, {}, { kg: 0 })
    ] }) });
    await abrirEscala(page);
    await expect(page.locator('#out .st > div')).toHaveText(['3 missões pedidas', '2 escaladas', '2 h de voo e aula']);
    // As duas caixas abrem recolhidas, só com o título
    const erros = page.locator('#out details.caixa.erros');
    await expect(erros).not.toHaveAttribute('open', '');
    await expect(erros.locator('summary')).toHaveText('1 missão não entrou na escala: Aluno 1000');
    await erros.locator('summary').click();
    await expect(erros.locator('.al.err')).toContainText('nenhum instrutor ativo tem a habilitação');
    const avisos = page.locator('#out details.caixa.avisos');
    await expect(avisos).not.toHaveAttribute('open', '');
    await expect(avisos.locator('summary')).toHaveText('2 avisos: 2 alunos sem peso');
    await expect(avisos.locator('.al.warn')).toHaveCount(2);

    // Trocar de vista ou inverter o eixo redesenha a escala: cada caixa continua como a pessoa deixou
    for (const troca of ['#s-esc [data-tl="ins"]', '#s-esc [data-tl="eq"]', '#btn-eixo', '#s-esc [data-tl="lista"]', '#s-esc [data-tl="eq"]']) {
      await page.locator(troca).click();
      await expect(erros).toHaveAttribute('open', '');
      await expect(avisos).not.toHaveAttribute('open', '');
    }
    await erros.locator('summary').click();
    await page.locator('#s-esc [data-tl="ins"]').click();
    await expect(erros).not.toHaveAttribute('open', '');
  });

  // Inverter eixo X:Y: os recursos (ou os instrutores) viram colunas e as horas descem à esquerda; o voo continua o mesmo
  // botão (abre os detalhes) e o clique no espaço livre agenda no horário da altura dele
  test('Inverter eixo X:Y: recursos nas colunas, horas nas linhas, os voos e o clique continuam', async ({ page }) => {
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    await abrirComExemplo(page);
    await abrirEscala(page, { vista: 'eq' });
    const eixo = page.locator('#btn-eixo');
    await expect(eixo).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#out .tl-wrap')).not.toHaveClass(/transposto/);
    const barra = page.locator('#out .tl-bar').first();
    const antes = await barra.boundingBox();
    expect(antes.width).toBeGreaterThan(antes.height);

    await eixo.click();
    await expect(eixo).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#out .tl-wrap')).toHaveClass(/\btransposto\b/);
    // As linhas lado a lado (colunas) e as faixas em pé
    const [r1, r2] = await page.locator('#out .tl-row').evaluateAll(rs => rs.slice(0, 2).map(r => r.getBoundingClientRect().toJSON()));
    expect(Math.abs(r1.top - r2.top)).toBeLessThan(1);
    expect(r2.left).toBeGreaterThan(r1.left);
    const faixa = await page.locator('#out .tl-track').first().boundingBox();
    expect(faixa.height).toBeGreaterThan(faixa.width);
    // As marcas do eixo descem: 06:00 em cima, as seguintes abaixo
    const marcas = await page.locator('#out .tl-axis span').evaluateAll(ms => ms.slice(0, 3).map(m => m.getBoundingClientRect().top));
    expect(marcas[1]).toBeGreaterThan(marcas[0]);
    expect(marcas[2]).toBeGreaterThan(marcas[1]);
    // O voo: mais alto que largo, abre e fecha os detalhes como antes
    const depois = await barra.boundingBox();
    expect(depois.height).toBeGreaterThan(depois.width / 3);
    await barra.click();
    await expect(page.locator('#tl-pop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#tl-pop')).toBeHidden();

    // O clique no espaço livre de uma coluna agenda no horário da altura dele (contada da borda de dentro da faixa)
    const livre = page.locator('#out .tl-row:not(:has(.tl-bar)) .tl-track:not(.inerte)').first();
    const ponto = await livre.evaluate((el, m) => {
      const { inicio, fim } = el.closest('.tl-wrap').dataset;
      return { x: el.clientWidth / 2, y: ((m - inicio) / (fim - inicio)) * el.clientHeight };
    }, 625);
    await livre.click({ position: ponto });
    await expect(page.locator('#dlg-agendar')).toBeVisible();
    await expect(page.locator('#dlg-agendar')).toHaveAccessibleDescription(/clique perto das 10:25$/);
    await page.keyboard.press('Escape');

    // Na Lista o botão some; de volta ao mapa, o eixo continua invertido até outro clique
    await page.locator('#s-esc [data-tl="lista"]').click();
    await expect(eixo).toBeHidden();
    await page.locator('#s-esc [data-tl="ins"]').click();
    await expect(page.locator('#out .tl-wrap')).toHaveClass(/\btransposto\b/);
    await eixo.click();
    await expect(page.locator('#out .tl-wrap')).not.toHaveClass(/transposto/);
    expect(erros).toEqual([]);
  });

  // O aviso de peso diz de quem é o peso que falta; o resumo conta alunos e instrutores
  test('resumo dos avisos: alunos e instrutores sem peso', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 1, { kg: 0 })], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 }, { kg: 0 })] }) });
    await abrirEscala(page);
    await expect(page.locator('#out details.caixa.avisos summary')).toHaveText('2 avisos: 1 aluno sem peso · 1 instrutor sem peso');
  });

  // O voo agendado na Escala fora das regras que a escala segue sozinha (o operador confirmou ao agendar): a etiqueta
  // ao lado do horário, com o caso na dica, e o resumo conta os agendamentos (um por voo)
  test('o voo agendado fora das regras: a etiqueta "fora da regra" com o caso na dica, e o resumo conta os agendamentos', async ({ page }) => {
    const estado = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 980, p2: -1, nb: 2 }), aluno(1002, { p1: 500, p2: -1 })] });
    // Às 07:00 (fora dos horários do C152) e das 16:20 às 18:20 (o voo de dia pousa até as 17:30)
    estado.fixos = { '1000_0_1': { a: 420, b: 480, r: 'PR-VOB', insId: 1, agendado: true }, '1001_0_1': { a: 980, b: 1100, r: 'PR-VOC', insId: 2, agendado: true } };
    await abrir(page, { estado });
    await abrirEscala(page);
    await expect(page.locator('#out details.caixa.avisos summary')).toHaveText('2 avisos: 2 agendamentos fora da regra');
    const etiqueta = nome => page.locator('#out tbody tr:not(.win)', { hasText: nome }).locator('.c-hr .tag[data-dica="fora-da-regra"]');
    await expect(etiqueta('Aluno 1000')).toHaveText('fora da regra');
    await expect(etiqueta('Aluno 1002')).toHaveCount(0);
    await etiqueta('Aluno 1000').click();
    await expect(page.locator('#dica')).toHaveText(`Fora da regra Agendado às 07:00, fora dos horários de decolagem do C152. ${GLOSSARIO['fora-da-regra'].texto}`);
    await expect(etiqueta('Aluno 1001')).toHaveAccessibleDescription(`Agendado até as 18:20: o voo de dia pousa até as 17:30. ${GLOSSARIO['fora-da-regra'].texto}`);
  });

  // Fora da escala aprovada, o voo fixo em conflito é de um agendamento, do instrutor escolhido na Escala ou de um status
  test('o voo fixo em conflito sem a escala aprovada: "voo fixo em conflito", com o conflito do agendado', async ({ page }) => {
    const estado = cenario({ ins: [instrutor(1, 9, { on: false }), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 500, p2: -1 })] });
    estado.fixos = { '1000_0_1': { a: 610, b: 670, r: 'PR-VOB', insId: 1, agendado: true } };
    await abrir(page, { estado });
    await abrirEscala(page);
    const conflitos = page.locator('#out details.caixa.conflitos');
    await expect(conflitos.locator('summary')).toHaveText('1 voo fixo em conflito');
    await expect(conflitos.locator('.al.conf')).toHaveText('Aluno 1000 Conflito no voo agendado: o instrutor não está disponível. Sugestões');
  });

  test('uma linha por voo: duração junto do horário, preferência só quando não é a 1ª, peso com o limite e status discreto', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [
      aluno(1000, { mis: 'Voo Local', eq: 'C152', p1: 0, p2: 1 }),
      aluno(1001, { mis: 'Voo Local', eq: 'C152', p1: 0, p2: 1 })
    ] }) });
    await abrirEscala(page);
    await expect(page.locator('#out thead th')).toHaveText(['Horário', 'Aluno', 'Missão', 'Recurso', 'Instrutor', 'Peso', 'Status', '']);
    await expect(page.locator('#out tr.win').first()).toHaveText('06:30 · 1º tempo 1 decolagem ou aula');
    const primeiro = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });
    await expect(primeiro.locator('td').nth(0)).toHaveText('06:30–07:30 1 h');
    await expect(primeiro.locator('td').nth(5)).toHaveText('140 / 170 kg');
    await expect(primeiro.locator('.st-sel')).toHaveValue('Confirmado');
    await expect(primeiro.locator('[data-act="rm-fly"]')).toHaveAttribute('aria-label', 'Tirar Aluno 1000 da escala');
    const segundo = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1001' });
    await expect(segundo.locator('td').nth(0)).toContainText('2ª preferência');
  });

  test('acima do limite com os tanques cheios, o voo sai com menos combustível: a coluna Peso diz quanto reduzir', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9, { kg: 80 })], stu: [aluno(1000, { p1: 500, p2: -1 }, { kg: 100 })] }) });
    await abrirEscala(page);
    const linha = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });
    await expect(linha.locator('.c-peso')).toContainText('180 / 170 kg');
    const selo = linha.locator('.c-peso .tag.comb');
    await expect(selo).toHaveText('reduzir 4 gal');
    // A dica diz o caso deste voo antes da explicação
    await selo.click();
    await expect(page.locator('#dica')).toContainText('Reduzir combustível Abastecer até 22 gal (4 a menos que o tanque cheio); o voo, o táxi e a reserva pedem 11 gal; autonomia de 3h23.');
    // Para o leitor de tela, o mesmo texto: o caso deste voo, depois a explicação do termo
    await expect(selo).toHaveAccessibleDescription(`Abastecer até 22 gal (4 a menos que o tanque cheio); o voo, o táxi e a reserva pedem 11 gal; autonomia de 3h23. ${GLOSSARIO['reduzir-combustivel'].texto}`);
  });

  // O agendamento grava no cadastro os pesos digitados, com décimos: a soma (40,1 + 40,7 dá 80.80000000000001 no ponto
  // flutuante) aparece em décimos e com a vírgula, como no resumo do diálogo, na lista e no popup do mapa
  test('os pesos com décimos digitados no agendamento: a lista e o popup mostram a soma em décimos, com a vírgula', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { fly: false }), aluno(1001, { p1: 390, p2: -1 })] }) });
    await abrirEscala(page);
    await page.locator('#btn-agendar').click();
    await page.locator('#agd-aluno').selectOption('1000');
    await expect(page.locator('#agd-previa ul')).toContainText('Entra:');
    await page.locator('#agd-kg-aluno').fill('40.1');
    await page.locator('#agd-kg-instrutor').fill('40.7');
    await expect(page.locator('#agd-peso-resumo')).toContainText('80,8 kg de 170 kg');
    await page.locator('#agd-confirmar').click();
    await expect(page.locator('#dlg-agendar')).toBeHidden();
    const linha = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });
    await expect(linha.locator('.c-peso')).toHaveText('80,8 / 170 kg');
    await page.locator('#s-esc [data-tl="eq"]').click();
    await page.locator('#out .tl-bar', { hasText: 'Aluno 1000' }).click();
    const pesoNoPopup = page.locator('#tl-pop .tl-pop-grid > span', { hasText: 'Peso Trip.:' }).locator('xpath=following-sibling::span[1]');
    await expect(pesoNoPopup).toHaveText('80,8 kg');
  });

  test('turma de Ground: horário, missão, sala e instrutor uma vez só; cada aluno com o seu status e a sua ação', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [1000, 1001, 1002].map(id => aluno(id, { ...GROUND_C152, p1: 0, p2: 1 })) }) });
    await abrirEscala(page);
    const linhas = page.locator('#out tbody tr:not(.win)');
    await expect(linhas).toHaveCount(3);
    await expect(linhas.nth(0).locator('td')).toHaveCount(8);
    await expect(linhas.nth(0).locator('td').first()).toHaveAttribute('rowspan', '3');
    await expect(linhas.nth(0).locator('td').nth(2)).toContainText('Turma de 3 alunos');
    await expect(linhas.nth(1).locator('td')).toHaveCount(3);
    await expect(linhas.nth(1).locator('.st-sel')).toHaveCount(1);
    await expect(linhas.nth(1).locator('td').nth(0)).toHaveText('Aluno 1001');
  });

  test('Categoria e Recurso: os dois começam em "Todos", e o segundo mostra só os da categoria escolhida', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await expect(page.locator('#s-esc label.flt-rotulo > span')).toHaveText(['Categoria', 'Recurso']);
    const categoria = page.locator('#flt-esc-cat'), recurso = page.locator('#flt-esc-eq');
    await expect(categoria.locator('option')).toHaveText(['Todos', 'C152', 'C172', 'Simulador', 'PA-34', 'Sala Ground']);
    await expect(categoria).toHaveValue('');
    await expect(recurso).toHaveValue('');
    await expect(recurso.locator('option').first()).toHaveText('Todos');
    const avioesDasLinhas = async () => (await lerEscala(page)).linhas.map(l => l.split(' | ')).filter(c => c.length >= 5).map(c => c[3]);

    await categoria.selectOption({ label: 'PA-34' });
    const opcoes = await recurso.locator('option').allTextContents();
    expect(opcoes[0]).toBe('Todos');
    expect(opcoes.length).toBeGreaterThan(1);
    expect(opcoes.slice(1).every(r => ['PR-VOM', 'PT-JOB', 'PT-KIW'].includes(r)), opcoes.join(', ')).toBe(true);
    const pa34 = await avioesDasLinhas();
    expect(pa34.length).toBeGreaterThan(0);
    expect(pa34.every(a => a.endsWith(' PA-34')), pa34.join(', ')).toBe(true);

    // Um avião da categoria; trocar de categoria volta o segundo filtro para "Todos"
    await recurso.selectOption(opcoes[1]);
    const doAviao = await avioesDasLinhas();
    expect(doAviao.length).toBeGreaterThan(0);
    expect(doAviao.every(a => a.startsWith(opcoes[1] + ' ')), doAviao.join(', ')).toBe(true);
    await categoria.selectOption({ label: 'Sala Ground' });
    await expect(recurso).toHaveValue('');
    await expect(recurso.locator('option')).toHaveText(['Todos', 'Sala Ground']);
    expect(new Set(await avioesDasLinhas())).toEqual(new Set(['Sala Ground']));
    await categoria.selectOption({ label: 'Todos' });
    expect((await avioesDasLinhas()).length).toBeGreaterThan(pa34.length);
  });

  test('na Lista, cada horário recolhe e abre os voos dele (e continua assim quando a escala é refeita)', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const botao = page.locator('#out tr.win').first().locator('button.win-btn');
    const voos = w => page.locator(`#out tbody tr[data-w="${w}"]:not(.win)`);
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(await voos(0).count()).toBeGreaterThan(0);
    await botao.click();
    await expect(page.locator('#out tr.win').first().locator('button.win-btn')).toHaveAttribute('aria-expanded', 'false');
    await expect(voos(0).first()).toBeHidden();
    expect(await voos(0).evaluateAll(trs => trs.every(tr => tr.hidden))).toBe(true);
    await expect(voos(1).first()).toBeVisible();

    await page.locator('#s-esc [data-tl="eq"]').click();
    await page.locator('#s-esc [data-tl="lista"]').click();
    await expect(page.locator('#out tr.win').first().locator('button.win-btn')).toHaveAttribute('aria-expanded', 'false');
    await expect(voos(0).first()).toBeHidden();
    await page.locator('#out tr.win').first().locator('button.win-btn').click();
    await expect(voos(0).first()).toBeVisible();
  });

  test('cada alteração mostra a hora em que a escala foi refeita', async ({ page }) => {
    await abrirComExemplo(page);
    await expect(page.locator('#escala-atualizada')).toBeHidden();
    await irPara(page, 'rec');
    await alternarDisponivel(page, 'PR-BTB', false);
    await irPara(page, 'esc');
    // Discreta, com um relógio, ao lado do título (e não na barra)
    const atualizada = page.locator('#s-esc h2 #escala-atualizada');
    await expect(atualizada).toHaveText('Atualizada às 12:00');
    await expect(atualizada.locator('use')).toHaveAttribute('href', '#i-relogio');
    await expect(page.locator('#s-esc .bar #escala-atualizada')).toHaveCount(0);
    expect(await atualizada.evaluate(el => getComputedStyle(el).fontSize)).toBe('13px');
  });
});

// O popup do mapa fica fora do painel que rola (dentro dele, seria cortado e, nas primeiras linhas, sumiria sob os
// filtros e o cabeçalho): abre com um clique (ou Enter) na barra e fecha com Esc ou com um clique fora
test.describe('Mapa: o popup do voo', () => {
  const pop = page => page.locator('#tl-pop');
  const abrirMapa = async page => {
    await abrirEscala(page);
    await page.locator('#s-esc [data-tl="eq"]').click();
    await expect(page.locator('#out .mapa')).toBeVisible();
  };
  // A caixa inteira na tela e por cima de tudo: o ponto no centro e perto de cada canto é do próprio popup
  const inteiroNaTela = page => page.evaluate(() => {
    const el = document.getElementById('tl-pop');
    if (!el || el.hidden) return 'fechado';
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) return `fora da tela: ${JSON.stringify(r)}`;
    const pontos = [[r.left + 6, r.top + 6], [r.right - 6, r.top + 6], [r.left + 6, r.bottom - 6], [r.right - 6, r.bottom - 6],
      [(r.left + r.right) / 2, (r.top + r.bottom) / 2]];
    const cobertos = pontos.filter(([x, y]) => !el.contains(document.elementFromPoint(x, y)));
    return cobertos.length ? `coberto em ${JSON.stringify(cobertos)}` : 'ok';
  });
  // Opacidade efetiva (a do elemento vezes a de quem o contém)
  const opacidade = locator => locator.evaluate(el => {
    let total = 1;
    for (let n = el; n; n = n.parentElement) total *= +getComputedStyle(n).opacity;
    return total;
  });

  test('o voo da primeira linha abre o popup inteiro, por cima dos filtros e do cabeçalho', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirMapa(page);
    const barra = page.locator('#out .tl-row:has(.tl-bar)').first().locator('.tl-bar').first();
    await expect(barra).toHaveAttribute('aria-expanded', 'false');
    await barra.click();
    await expect(pop(page)).toBeVisible();
    await expect(barra).toHaveAttribute('aria-expanded', 'true');
    expect(await inteiroNaTela(page)).toBe('ok');
    // É o voo da barra: o mesmo horário
    const [inicio, fim] = (await barra.locator('.tl-bar-t1').innerText()).split(' · ')[0].split('–');
    await expect(pop(page).locator('.tl-pop-hd')).toContainText(`${inicio} – ${fim}`);
  });

  test('Esc fecha o popup e devolve o foco à barra; Enter abre de novo; um clique fora fecha', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirMapa(page);
    const barra = page.locator('#out .tl-bar').first();
    await barra.click();
    await expect(pop(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pop(page)).toBeHidden();
    await expect(barra).toBeFocused();
    await expect(barra).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(pop(page)).toBeVisible();
    await page.locator('#s-esc h2').click();
    await expect(pop(page)).toBeHidden();
  });

  test('o popup de um voo cancelado não fica apagado como a barra', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 0 })], fStatus: { '1000_0_1': 'Cancelado' } }) });
    await abrirMapa(page);
    const barra = page.locator('#out .tl-bar.tl-st-Cancelado');
    await barra.click();
    await expect(pop(page)).toBeVisible();
    expect(await opacidade(barra)).toBeLessThan(1);
    expect(await opacidade(pop(page))).toBe(1);
  });

  test('mudar o status no popup atualiza a barra, e o popup continua aberto com o status novo', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 0 })] }) });
    await abrirMapa(page);
    await page.locator('#out .tl-bar').click();
    await pop(page).locator('.st-sel').selectOption('Em Voo');
    await expect(page.locator('#out .tl-bar')).toHaveClass(/\btl-st-EmVoo\b/);
    await expect(pop(page)).toBeVisible();
    await expect(pop(page).locator('.st-sel')).toHaveValue('Em Voo');
  });

  test('no Gestor, o status do popup fica travado e não há "Excluir da escala"', async ({ page }) => {
    await abrirComExemplo(page, { url: './?role=gestor' });
    await abrirMapa(page);
    await page.locator('#out .tl-bar').first().click();
    await expect(pop(page).locator('.st-sel')).toBeDisabled();
    await expect(pop(page).locator('[data-act="rm-fly"]')).toBeHidden();
  });
});

// O Painel no estilo dos aeroportos (os painéis da INFRAERO): Partidas (todas as do dia) e Chegadas (as que ainda não
// pousaram) se alternam página a página, com o relógio no canto. Ground aparece sem os nomes dos alunos. Aqui, o painel
// configurado para abrir em "Partidas e chegadas", com todas as colunas
test.describe('Painel: partidas e chegadas como no aeroporto', () => {
  // 06:30 atrasado para 11:00; 10:10 confirmado; 11:30 cancelado; turma de Ground às 08:20
  const dia = () => ({
    ...cenario({
      ins: [instrutor(1, 9), instrutor(2, 9)],
      stu: [aluno(1000, { p1: 390, p2: -1 }), aluno(1001, { p1: 610, p2: -1 }), aluno(1002, { p1: 690, p2: -1, eq: 'C172' }),
        aluno(1003, { ...GROUND_C152, p1: 500, p2: -1 }), aluno(1004, { ...GROUND_C152, p1: 500, p2: -1 })],
      fStatus: { '1000_0_1': 'Atrasado', '1002_0_1': 'Cancelado' }
    }),
    fObs: { '1000_0_1': { novoInicio: 660 }, '1002_0_1': { motivo: 'Meteorologia' } },
    // O teste é do quadro: os horários ficam onde a escala pôs (sem a compactação mudar)
    criterios: { buracos: 'inva', horarios: 'fixos' },
    painel: PAINEL_DO_AEROPORTO
  });
  const abrirPainel = async page => {
    await abrirEscala(page);
    await page.locator('#s-esc [data-tl="painel"]').click();
    await expect(page.locator('#out .fids')).toBeVisible();
  };
  const titulo = page => page.locator('#out .fids .fids-titulo');
  const linhas = page => page.locator('#out .fids tbody tr:not(.fids-vazia)');

  // O quadro só é refeito quando muda: na troca de página, na virada do minuto e com dados novos. Refazê-lo a cada
  // segundo reinicia a animação do embarque e tira o leitor de tela do lugar
  test('o quadro muda só com a página ou o minuto; Pausar para a troca e o pisca, e o quadro continua seguindo a hora', async ({ page }) => {
    await abrir(page, { estado: { ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34', p1: 750, p2: -1 })] }), painel: PAINEL_DO_AEROPORTO } });
    // A data aberta (amanhã, 11/11) vira hoje, ao meio-dia: o PA-34 das 12:30 está em embarque
    await page.clock.install({ time: new Date('2026-11-11T12:00:00-03:00') });
    await abrirPainel(page);
    const chamada = page.locator('#out .fids .fids-Embarque .f-obs');
    const marcar = () => page.locator('#out .fids-tabela').evaluate(el => { el.dataset.marca = '1'; });
    const marcada = page.locator('#out .fids-tabela[data-marca="1"]');
    await expect(chamada).toHaveText('EMBARQUE IMEDIATO · Sala de briefing');
    expect(await chamada.evaluate(el => getComputedStyle(el).animationName)).toBe('fids-embarque');

    await marcar();
    await page.clock.runFor(2000);
    await expect(marcada).toHaveCount(1);
    // A troca de página (Partidas e Chegadas se alternam a cada 10 s) refaz o quadro
    await page.clock.runFor(8000);
    await expect(titulo(page)).toHaveText('Chegadas');
    await expect(marcada).toHaveCount(0);

    // Um quadro só, de uma página: nada para trocar
    await page.locator('#out [data-fids="partidas"]').click();
    await marcar();
    await page.clock.runFor(11000);
    await expect(marcada).toHaveCount(1);

    await page.locator('#out [data-fids="pausar"]').click();
    await expect(page.locator('#out .fids')).toHaveClass(/\bpausado\b/);
    expect(await chamada.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    // A pausa continua quando a escala é redesenhada (outra visão e de volta ao painel)
    await page.locator('#s-esc [data-tl="lista"]').click();
    await page.locator('#s-esc [data-tl="painel"]').click();
    await expect(page.locator('#out .fids')).toHaveClass(/\bpausado\b/);
    expect(await chamada.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    // Pausado, o quadro continua seguindo a hora: às 12:31 o PA-34 já saiu do embarque
    await page.clock.fastForward('31:00');
    await expect(page.locator('#out .fids .fids-relogio b')).toHaveText('12:31');
    await expect(page.locator('#out .fids .fids-Embarque')).toHaveCount(0);
  });

  test('a página que aparece fica os 10 s inteiros, mesmo depois de um tempo com uma página só', async ({ page }) => {
    await abrirComExemplo(page);
    await page.clock.install({ time: new Date('2026-11-10T12:00:00-03:00') });
    await abrirPainel(page);
    await page.locator('#out [data-fids="partidas"]').click();
    const pagina = page.locator('#out .fids .fids-relogio small').first();
    await expect(pagina).toHaveText(/^página 1\/[2-9]/);
    // Um filtro deixa uma página só por um tempo; sem ele, a página 1 aparece e fica os 10 s
    await page.locator('#flt-esc-q').fill('Instrutor 01');
    await expect(pagina).toHaveText('página 1/1');
    await page.clock.runFor(30000);
    await page.locator('#flt-esc-q').fill('');
    await expect(pagina).toHaveText(/^página 1\/[2-9]/);
    await page.clock.runFor(8000);
    await expect(pagina).toHaveText(/^página 1\//);
    await page.clock.runFor(3000);
    await expect(pagina).toHaveText(/^página 2\//);
  });

  test('pausado e sem mudança, o quadro não é tocado; na virada do minuto, só a hora muda', async ({ page }) => {
    await abrirComExemplo(page);
    await page.clock.install({ time: new Date('2026-11-10T12:00:00-03:00') });
    await abrirPainel(page);
    await page.locator('#out [data-fids="pausar"]').click();
    const contar = () => page.locator('#out .fids').evaluate(el => {
      window.__mudancas = [];
      new MutationObserver(m => window.__mudancas.push(...m.map(x => (x.target.closest ? x.target.closest('b, small, table, div')?.className || x.target.tagName : x.target.parentElement?.tagName)))).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await contar();
    await page.clock.runFor(30000);
    expect(await page.evaluate(() => window.__mudancas)).toEqual([]);
    await page.locator('#out .fids-tabela').evaluate(el => { el.dataset.marca = '1'; });
    await page.clock.runFor(31000);
    await expect(page.locator('#out .fids .fids-relogio b')).toHaveText('12:01');
    await expect(page.locator('#out .fids-tabela[data-marca="1"]')).toHaveCount(1);
  });

  test('como na TV da recepção: o aluno abreviado e, no cancelamento, só a categoria do motivo', async ({ page }) => {
    const estado = { ...dia(), fObs: { '1000_0_1': { novoInicio: 660 }, '1002_0_1': { motivo: 'Outro', texto: 'Aluno com febre' } } };
    estado.stu = estado.stu.map(s => (s.id === 1001 ? { ...s, nm: 'Maria Silva Santos' } : s));
    await abrir(page, { estado });
    await abrirPainel(page);
    await page.locator('#out [data-fids="partidas"]').click();
    await expect(page.locator('#out .fids')).toContainText('Maria S.');
    await expect(page.locator('#out .fids')).not.toContainText('Silva Santos');
    await expect(page.locator('#out .fids')).toContainText('Cancelado · Outro');
    await expect(page.locator('#out .fids')).not.toContainText('febre');
  });
  const coluna = (page, classe) => linhas(page).locator(classe);

  test('Partidas: o quadro do aeroporto com todas as partidas, pelo horário previsto; atraso, cancelamento e Ground sem nomes', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirPainel(page);
    await page.locator('#out [data-fids="partidas"]').click();
    await expect(titulo(page)).toHaveText('Partidas');
    await expect(page.locator('#out .fids .fids-relogio b')).toHaveText('12:00');
    await expect(page.locator('#out .fids thead th')).toHaveText(['Horário', 'Aeronave', 'Modelo', 'Aluno', 'Instrutor', 'Missão', 'Previsto', 'Observação']);
    await expect(coluna(page, '.f-hora')).toHaveText(['08:20', '10:10', '06:30', '11:30']);
    await expect(coluna(page, '.f-prev')).toHaveText(['', '', '11:00', '']);
    await expect(coluna(page, '.f-missao')).toHaveText(['Ground C152', 'Voo Local', 'Voo Local', 'Voo Local']);
    await expect(coluna(page, '.f-modelo')).toHaveText(['Ground', 'C152', 'C152', 'C172']);
    await expect(coluna(page, '.f-aluno')).toHaveText(['2 alunos', 'Aluno 1001', 'Aluno 1000', 'Aluno 1002']);
    await expect(coluna(page, '.f-obs')).toHaveText(['Confirmado', 'Confirmado', 'Atrasado', 'Cancelado · Meteorologia']);
    await expect(coluna(page, '.f-aeronave').first()).toHaveText('Sala Ground');
    await expect(linhas(page).nth(3)).toHaveClass(/\bfids-Cancelado\b/);
    // O quadro tem sempre a mesma altura: linhas vazias completam a página de 12 linhas (aqui, 4 voos e 8 vazias)
    await expect(page.locator('#out .fids tbody tr')).toHaveCount(12);
  });

  test('Chegadas: as pendentes, pelo pouso previsto; num dia que ainda não começou, todas', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirPainel(page);
    await page.locator('#out [data-fids="chegadas"]').click();
    await expect(titulo(page)).toHaveText('Chegadas');
    await expect(coluna(page, '.f-hora')).toHaveText(['09:50', '11:10', '07:30', '12:30']);
    await expect(coluna(page, '.f-prev')).toHaveText(['', '', '12:00', '']);
    await expect(coluna(page, '.f-aluno')).toHaveText(['2 alunos', 'Aluno 1001', 'Aluno 1000', 'Aluno 1002']);
  });

  test('alterna entre Partidas e Chegadas como no aeroporto; "Pausar" para a troca', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-10T12:00:00-03:00') });
    await abrir(page, { estado: dia() });
    await abrirPainel(page);
    await expect(page.locator('#out [data-fids="alternar"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(titulo(page)).toHaveText('Partidas');
    await page.clock.runFor(10_000);
    await expect(titulo(page)).toHaveText('Chegadas');
    await page.clock.runFor(10_000);
    await expect(titulo(page)).toHaveText('Partidas');
    // Um botão de alternar mantém o nome: o leitor de tela anuncia "Pausar, pressionado" (o nome que muda não é anunciado)
    const pausar = page.locator('#out [data-fids="pausar"]');
    await pausar.click();
    await expect(pausar).toHaveAttribute('aria-pressed', 'true');
    await expect(pausar).toHaveAccessibleName('Pausar');
    const fundoSolto = await page.locator('#out [data-fids="tela-cheia"]').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(await pausar.evaluate(el => getComputedStyle(el).backgroundColor), 'pressionado aparece na tela').not.toBe(fundoSolto);
    // Além da cor, uma marca (✓) ao lado do nome, escondida do leitor de tela; com as cores forçadas do sistema, o
    // botão pressionado usa a cor de destaque do sistema
    await expect(pausar.locator('.ico')).toBeVisible();
    await page.emulateMedia({ forcedColors: 'active' });
    expect(await pausar.evaluate(el => getComputedStyle(el).backgroundColor), 'cores forçadas').not.toBe(
      await page.locator('#out [data-fids="tela-cheia"]').evaluate(el => getComputedStyle(el).backgroundColor));
    await page.emulateMedia({ forcedColors: 'none' });
    await page.clock.runFor(30_000);
    await expect(titulo(page)).toHaveText('Partidas');
    await pausar.click();
    await expect(pausar).toHaveAttribute('aria-pressed', 'false');
    await expect(pausar).toHaveAccessibleName('Pausar');
    await expect(pausar.locator('.ico')).toBeHidden();
  });

  test('um quadro fixo continua só com ele; a página aparece junto do relógio', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-10T12:00:00-03:00') });
    await abrir(page, { estado: dia() });
    await abrirPainel(page);
    await page.locator('#out [data-fids="chegadas"]').click();
    await expect(page.locator('#out [data-fids="chegadas"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#out .fids .fids-relogio small')).toHaveText('página 1/1');
    await page.clock.runFor(30_000);
    await expect(titulo(page)).toHaveText('Chegadas');
  });

  test('no Gestor, o mesmo painel', async ({ page }) => {
    await abrir(page, { estado: dia(), url: './?role=gestor' });
    await abrirPainel(page);
    await expect(linhas(page)).toHaveCount(4);
  });
});

// No celular (390 px; os testes que mudam a largura dizem qual), vindos de celular.spec.js
test.describe('Celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // O "+" que agenda, na lista (um por horário) e em cada linha do mapa, por recurso e por instrutor
  test('o "+" que agenda tem pelo menos 44 px, na lista e no mapa', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const pequenos = seletor => page.locator(seletor).evaluateAll(bs => bs.filter(b => b.checkVisibility())
      .map(b => b.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).map(r => `${Math.round(r.width)}×${Math.round(r.height)}`));
    await expect(page.locator('#out .win-agendar').first()).toBeVisible();
    expect(await pequenos('#out .win-agendar'), 'lista').toEqual([]);
    for (const vista of ['eq', 'ins']) {
      await page.locator(`#s-esc [data-tl="${vista}"]`).click();
      await expect(page.locator('#out .mapa .tl-agendar').first()).toBeVisible();
      expect(await pequenos('#out .mapa .tl-agendar'), `mapa ${vista}`).toEqual([]);
    }
  });

  // Com o "+" de 44 px, sobram uns 107 px para o nome da linha do mapa: o nome longo quebra em linhas e fica inteiro à
  // vista (no toque, não há o title para ler o resto)
  test('no mapa, o nome longo da linha quebra em linhas, inteiro, sem reticências', async ({ page }) => {
    const longo = 'Maria Fernanda dos Santos Oliveira';
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9, { nm: longo }), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 })] }) });
    await abrirEscala(page);
    await page.locator('#s-esc [data-tl="ins"]').click();
    const linha = page.locator('#out .mapa .tl-row', { has: page.locator('.tl-lbl > span', { hasText: longo }) });
    await expect(linha.locator('.tl-agendar')).toBeVisible();
    const nome = await linha.locator('.tl-lbl > span').evaluate(span => ({
      cortado: span.scrollWidth > span.clientWidth || span.scrollHeight > span.clientHeight,
      linhas: Math.round(span.getBoundingClientRect().height / parseFloat(getComputedStyle(span).lineHeight))
    }));
    expect(nome.cortado).toBe(false);
    expect(nome.linhas).toBeGreaterThan(1);
    // Com o mouse (na tela larga, o nome continua numa linha só), o title mostra o nome inteiro
    await expect(linha.locator('.tl-lbl > span')).toHaveAttribute('title', longo);
    expect(await larguraDaPagina(page)).toBeLessThanOrEqual(390);
  });

  test('a escala vira um cartão por voo, com horário, aluno, missão, avião, instrutor e status à vista', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await expect(page.locator('#out thead')).toBeHidden();
    const cartao = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 12' });
    expect(await cartao.evaluate(el => getComputedStyle(el).display)).toBe('grid');
    for (const campo of ['.c-hr', '.c-aluno', '.c-missao', '.c-aviao', '.c-instr', '.c-status']) {
      const caixa = await cartao.locator(campo).boundingBox();
      expect(caixa, campo).not.toBeNull();
      expect(caixa.x + caixa.width, campo).toBeLessThanOrEqual(390);
    }
    await expect(cartao.locator('.c-instr')).toContainText('Instrutor 13');
  });

  // O painel no celular (390 e 320 px): os quatro quadros dois por linha, o quadro rola dentro da moldura, e o diálogo
  // "Configurar painel" cabe na tela, com alvos de 44 px
  test('o painel e "Configurar painel" cabem no celular (390 e 320 px), com alvos de 44 px', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await page.locator('#s-esc [data-tl="painel"]').click();
    for (const largura of [390, 320]) {
      await page.setViewportSize({ width: largura, height: 700 });
      await expect(page.locator('#out .fids')).toBeVisible();
      expect(await larguraDaPagina(page), `${largura}: painel`).toBeLessThanOrEqual(largura);
      expect(await alvosPequenos(page), `${largura}: painel`).toEqual([]);
      const quadros = await page.locator('#out .seg [data-fids]').evaluateAll(bs => bs.map(b => b.getBoundingClientRect()).map(r => [r.x, r.right]));
      for (const [x, direita] of quadros) {
        expect(x, `${largura}: quadro na tela`).toBeGreaterThanOrEqual(0);
        expect(direita, `${largura}: quadro na tela`).toBeLessThanOrEqual(largura);
      }
      await page.locator('#out [data-fids="configurar"]').click();
      const dialogo = page.locator('#dlg-painel');
      await expect(dialogo).toBeVisible();
      const caixa = await dialogo.boundingBox();
      expect(caixa.x, `${largura}: diálogo`).toBeGreaterThanOrEqual(0);
      expect(caixa.x + caixa.width, `${largura}: diálogo`).toBeLessThanOrEqual(largura);
      expect(await dialogo.evaluate(d => d.scrollWidth <= d.clientWidth), `${largura}: o diálogo não rola para o lado`).toBe(true);
      expect(await larguraDaPagina(page), `${largura}: com o diálogo`).toBeLessThanOrEqual(largura);
      const pequenos = await dialogo.evaluate(d => [...d.querySelectorAll('button, input')].map(el => {
        const alvo = el.matches('input') ? el.closest('label') : el;
        const { width, height } = alvo.getBoundingClientRect();
        return width < 44 || height < 44 ? `${el.getAttribute('aria-label') || alvo.textContent.trim()} ${Math.round(width)}×${Math.round(height)}` : null;
      }).filter(Boolean));
      expect(pequenos, `${largura}: alvos do diálogo`).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(dialogo).toBeHidden();
    }
  });
});

// O leitor de tela, vindo de acessibilidade.spec.js
test.describe('Acessibilidade', () => {
  // O "+" que agenda é só o ícone (escondido do leitor de tela): o nome diz onde o voo vai, o recurso ou o instrutor da
  // linha no mapa e o horário na lista
  test('o "+" que agenda tem nome em cada vista: o recurso e o instrutor da linha no mapa, o horário na lista', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const nomes = () => page.locator('#out .win-agendar, #out .tl-agendar').evaluateAll(bs => bs.filter(b => b.checkVisibility()).map(b => b.getAttribute('aria-label')));
    const lista = await nomes();
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.filter(n => !/^Agendar às \d\d:\d\d$/.test(n)), 'lista').toEqual([]);
    await expect(page.getByRole('button', { name: 'Agendar às 06:30', exact: true })).toBeVisible();
    await page.locator('#s-esc [data-tl="eq"]').click();
    const recursos = await nomes();
    expect(recursos).toContain('Agendar no PR-VOB');
    expect(recursos).toContain('Agendar na Sala Ground');
    expect(recursos.filter(n => !/^Agendar (no [A-Z0-9-]+|na Sala Ground)$/.test(n)), 'por recurso').toEqual([]);
    await expect(page.getByRole('button', { name: 'Agendar no PR-VOB', exact: true })).toBeVisible();
    await page.locator('#s-esc [data-tl="ins"]').click();
    const instrutores = await nomes();
    expect(instrutores).toHaveLength(40);
    expect(instrutores.filter(n => !/^Agendar com Instrutor \d\d$/.test(n)), 'por instrutor').toEqual([]);
    await expect(page.getByRole('button', { name: 'Agendar com Instrutor 07', exact: true })).toBeVisible();
  });

  test('as barras do mapa dizem o status do voo (não só a cor)', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await page.locator('#out select[data-f="fstatus"]').first().selectOption('Em Voo');
    await page.locator('#s-esc [data-tl="eq"]').click();
    const barras = page.locator('#out .tl-bar');
    expect(await barras.count()).toBeGreaterThan(1);
    const ditos = await barras.evaluateAll(bs => bs.map(b => b.querySelector('.sr')?.textContent ?? ''));
    for (const dito of ditos) expect(dito).toMatch(/^, (Pendente|Confirmado|Atrasado|Em Voo|Pousou|Concluída|Cancelado)$/);
    expect(ditos).toContain(', Em Voo');
  });
});

// Quem usa o teclado continua no mesmo lugar depois de uma ação (vindo de acessibilidade.spec.js): a tela é redesenhada,
// mas o foco volta para o campo ou o botão equivalente
test.describe('O foco depois de uma ação', () => {
  const emFoco = page => page.evaluate(() => {
    const el = document.activeElement;
    return el === document.body ? 'body' : `${el.tagName.toLowerCase()}${['data-f', 'data-a', 'data-act', 'data-fkey', 'data-id', 'id'].filter(a => el.hasAttribute(a)).map(a => `[${a}="${el.getAttribute(a)}"]`).join('')}`;
  });

  test('o status mudado pelo teclado na lista da Escala', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const status = page.locator('#out select[data-f="fstatus"]').first();
    const fkey = await status.getAttribute('data-fkey');
    await status.focus();
    await status.selectOption('Em Voo');
    await expect(page.locator(`#out select[data-fkey="${fkey}"]`)).toHaveValue('Em Voo');
    expect(await emFoco(page)).toBe(`select[data-f="fstatus"][data-fkey="${fkey}"]`);
  });

  test('o diálogo do Atrasado devolve o foco ao status do voo, desistido ou confirmado (com a lista redesenhada)', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const status = page.locator('#out select[data-f="fstatus"]').first();
    const fkey = await status.getAttribute('data-fkey');
    const dialogo = page.locator('#dlg-status');
    await status.focus();
    await status.selectOption('Atrasado');
    await dialogo.getByRole('button', { name: 'Voltar' }).click();
    await expect(dialogo).toBeHidden();
    expect(await emFoco(page)).toBe(`select[data-f="fstatus"][data-fkey="${fkey}"]`);
    // Confirmado: o status muda e a lista é redesenhada; o foco fica no status do mesmo voo
    await status.selectOption('Atrasado');
    const [h, m] = (await page.locator('#dlg-status-voo').textContent()).match(/(\d\d):(\d\d)–/).slice(1).map(Number);
    const novo = h * 60 + m + 30;
    await page.locator('#st-novo').fill(`${String(Math.floor(novo / 60)).padStart(2, '0')}:${String(novo % 60).padStart(2, '0')}`);
    await dialogo.getByRole('button', { name: 'Confirmar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.locator(`#out select[data-fkey="${fkey}"]`)).toHaveValue('Atrasado');
    expect(await emFoco(page)).toBe(`select[data-f="fstatus"][data-fkey="${fkey}"]`);
  });

  test('o popup do mapa: Enter na barra leva o foco para ele, e Tab depois do último controle volta para a barra', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await page.locator('[data-tl="eq"]').click();
    const barra = page.locator('#out .tl-bar').first();
    await barra.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#tl-pop')).toBeVisible();
    // O primeiro controle do popup é o instrutor (o nome abre a lista para trocar); depois, o status
    await expect(page.locator('#tl-pop [data-act="trocar-instrutor"]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#tl-pop select[data-f="fstatus"]')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    const controles = await page.locator('#tl-pop select, #tl-pop button').count();
    for (let i = 0; i < controles; i++) await page.keyboard.press('Tab');
    await expect(page.locator('#tl-pop')).toBeHidden();
    await expect(barra).toBeFocused();
  });

  test('o ✕ que tira o voo da escala, com o Enter dado duas vezes ou segurado, tira um voo só; o foco fica na linha que ficou no lugar', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const xs = page.locator('#out .tabela-escala button[data-act="rm-fly"]');
    const antes = await xs.count();
    await xs.nth(2).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(xs).toHaveCount(antes - 1);
    // O foco fica na linha, que não faz nada com o Enter, e continua nela depois de outro redesenho
    const naLinha = () => page.evaluate(() => document.activeElement.matches('#out tbody tr[data-foco-neutro]'));
    expect(await naLinha()).toBe(true);
    await page.evaluate(async () => {
      const { rOut } = await import('./js/views/escala.js');
      rOut();
    });
    expect(await naLinha()).toBe(true);
    // Segurado: o primeiro keydown e as repetições da tecla
    await xs.nth(2).focus();
    for (let i = 0; i < 5; i++) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect(xs).toHaveCount(antes - 2);
  });

  test('num navegador sem checkVisibility (Safari antes do 17.4), mudar um status grava, redesenha e mantém o foco', async ({ page }) => {
    await page.addInitScript(() => { delete Element.prototype.checkVisibility; });
    await abrirComExemplo(page);
    await abrirEscala(page);
    const status = page.locator('#out select[data-f="fstatus"]').nth(2);
    const fkey = await status.getAttribute('data-fkey');
    await status.focus();
    await status.selectOption('Em Voo');
    await expect(page.locator(`#out select[data-fkey="${fkey}"]`)).toHaveClass(/\bst-EmVoo\b/);
    expect(await emFoco(page)).toBe(`select[data-f="fstatus"][data-fkey="${fkey}"]`);
    await page.reload();
    await abrirEscala(page);
    await expect(page.locator(`#out select[data-fkey="${fkey}"]`)).toHaveValue('Em Voo');
  });

  test('um clique num texto da tabela e Tab: o foco segue dali, e não do topo', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const linha = page.locator('#out .tabela-escala tbody tr:not(.win)').nth(5);
    await linha.locator('td.c-aluno b').click();
    await page.keyboard.press('Tab');
    const fkey = await linha.locator('select[data-f="fstatus"]').getAttribute('data-fkey');
    expect(await emFoco(page)).toBe(`select[data-f="fstatus"][data-fkey="${fkey}"]`);
  });

  test('o foco devolvido depois de um redesenho não rola a página até ele', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await page.locator('#out select[data-f="fstatus"]').first().focus();
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    const antes = await page.evaluate(() => scrollY);
    expect(antes).toBeGreaterThan(300);
    // Um redesenho que chega depois (outra alteração, a resposta do servidor)
    await page.evaluate(async () => {
      const { rOut } = await import('./js/views/escala.js');
      rOut();
    });
    expect(await page.evaluate(() => scrollY)).toBe(antes);
    await expect(page.locator('#out select[data-f="fstatus"]').first()).toBeFocused();
  });
});

// F1d, "missão do curso": o pedido com a missão do curso leva o que ela exige do INVA (exige, de S.programa, também com
// o progresso desligado). Sem nenhum INVA ativo com a habilitação, o voo fica fora (regra a); com os programas não lidos,
// nada é exigido e a Escala diz que as habilitações das missões do curso não foram conferidas
test.describe('O que a missão do curso exige do INVA, na Escala', () => {
  const PROGRAMA = gravarCurso({ cursos: cursosIniciais() }, {
    sigla: 'PP', versaoLida: 1, descricao: 'PP: programa', conteudo: {
      nome: 'Piloto Privado', ativo: true, fases: [{ id: IDS.f1, nome: 'Fase 1' }],
      missoes: [{ id: IDS.m1, fase: IDS.f1, codigo: 'NAV-150NM', nome: 'Navegação longa', mis: 'Voo Local', eq: 'C152', nb: 1, exige: ['endosso_solo'] }]
    }
  }).cursos;
  const estado = () => cenario({
    ins: [instrutor(1, 9), instrutor(2, 1)],
    stu: [aluno(1000, { etapa: 'NAV-150NM', cursoDaEtapa: 'PP' }, { curso: 'PP' })]
  });

  test('sem nenhum INVA ativo com a habilitação, o voo fica fora; marcada num INVA, ele voa com esse INVA', async ({ page }) => {
    const { documentos: { cadastro }, dias } = documentosAtuais(estado(), AMANHA);
    await page.addInitScript(json => {
      if (localStorage.getItem('acpm4_cadastro')) return;
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify({ acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_cursos: { cursos: PROGRAMA, alteracoes: [] } }));
    await page.goto('./');
    await appPronto(page);
    await abrirEscala(page, { vista: 'lista' });
    await expect(page.locator('#out')).toContainText('nenhum instrutor ativo tem a habilitação de Voo Local no C152 (Voo Local + C152 + Endosso Solo)');
    expect((await lerEscala(page)).linhas.filter(l => l.includes('Aluno 1000'))).toEqual([]);
    // Marcada no INVA 01 (nível 9): sem a exigência, o desempate pelas menos habilitações daria o voo ao 02 (nível 1), então
    // só ela leva o voo ao 01
    await irParaVista(page, 'ins', 'cadastro');
    await page.locator('#inst .cd[data-id="1"] [data-act="editar-habs"]').click();
    await page.locator('#painel-instrutor [data-f="hab"][data-h="endosso_solo"]').check();
    await page.locator('#btn-fechar-painel-instrutor').click();
    await abrirEscala(page, { vista: 'lista' });
    const voos = (await lerEscala(page)).linhas.filter(l => l.includes('Aluno 1000'));
    expect(voos).toHaveLength(1);
    expect(voos[0]).toContain('| Instrutor 01 |');
    await expect(page.locator('#out [data-caixa="habilitacoes"]')).toHaveCount(0);
  });

  // A missão marcada (ou desmarcada) em Cursos muda o que o motor pede: a escala da data aberta é refeita e gravada na hora
  // (sem entrada no histórico da data: a alteração fica nas versões do curso), também a que já estava gravada
  test('marcar e desmarcar em Cursos o que a missão exige do INVA refaz a escala gravada da data aberta', async ({ page }) => {
    const semExige = gravarCurso({ cursos: cursosIniciais() }, {
      sigla: 'PP', versaoLida: 1, descricao: 'PP: programa', conteudo: {
        nome: 'Piloto Privado', ativo: true, fases: [{ id: IDS.f1, nome: 'Fase 1' }],
        missoes: [{ id: IDS.m1, fase: IDS.f1, codigo: 'NAV-150NM', nome: 'Navegação longa', mis: 'Voo Local', eq: 'C152', nb: 1 }]
      }
    }).cursos;
    const { documentos: { cadastro }, dias } = documentosAtuais(cenario({
      ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { etapa: 'NAV-150NM', cursoDaEtapa: 'PP' }, { curso: 'PP' })]
    }), AMANHA);
    await page.addInitScript(json => {
      if (localStorage.getItem('acpm4_cadastro')) return;
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify({ acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_cursos: { cursos: semExige, alteracoes: [] } }));
    await page.goto('./');
    await appPronto(page);
    // A escala gravada (uma alteração da Demanda grava a data), com o voo
    await irPara(page, 'dem');
    await page.locator('select[aria-label="Prioridade de Aluno 1000"]').selectOption('4');
    const voosGravados = () => page.evaluate(d => (JSON.parse(localStorage.getItem(`acpm4_dia_${d}`)).resultado || { out: [] }).out.filter(o => o.stuId === 1000).length, AMANHA);
    await expect.poll(voosGravados).toBe(1);
    const historico = await page.locator('#audit-log-list li').count();
    const marca = () => page.locator('#cursos .curso[data-curso="PP"] tr[data-missao]').first().getByRole('checkbox', { name: 'NAV-150NM exige Endosso Solo' });
    const naEscala = async () => (await lerEscala(page)).linhas.filter(l => l.includes('Aluno 1000'));
    await irPara(page, 'cur');
    await page.locator('#cursos .curso[data-curso="PP"] tr[data-missao]').first().locator('details.exige summary').click();
    await marca().check();
    await abrirEscala(page, { vista: 'lista' });
    expect(await naEscala()).toEqual([]);
    await expect(page.locator('#out')).toContainText('nenhum instrutor ativo tem a habilitação de Voo Local no C152 (Voo Local + C152 + Endosso Solo)');
    await expect.poll(voosGravados).toBe(0);
    await expect(page.locator('#audit-log-list li')).toHaveCount(historico);
    await page.reload();
    await appPronto(page);
    await abrirEscala(page, { vista: 'lista' });
    expect(await naEscala()).toEqual([]);
    // Desmarcada, o voo volta
    await irPara(page, 'cur');
    await page.locator('#cursos .curso[data-curso="PP"] tr[data-missao]').first().locator('details.exige summary').click();
    await marca().uncheck();
    await abrirEscala(page, { vista: 'lista' });
    expect(await naEscala()).toHaveLength(1);
    await expect.poll(voosGravados).toBe(1);
  });

  test('sem os programas dos cursos lidos, a Escala diz que as habilitações das missões do curso não foram conferidas', async ({ browser }) => {
    const servidor = criarSupabaseFalso({ ...documentosAtuais(estado(), AMANHA), cursos: PROGRAMA });
    servidor.falhar('/rpc/programa_dos_cursos', 1000);
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    await servidor.instalar(contexto);
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    await entrar(page, CONTAS.operador);
    await abrirEscala(page, { vista: 'lista' });
    const caixa = page.locator('#out [data-caixa="habilitacoes"]');
    await expect(caixa.locator('summary')).toHaveText('As habilitações das missões do curso não foram conferidas');
    await caixa.locator('summary').click();
    await expect(caixa.locator('li')).toHaveText('Os programas dos cursos não foram lidos: o que a missão do curso exige do INVA não foi conferido em 1 pedido desta data: a escala foi montada sem essa conferência.');
    // Nada é exigido: o voo entra
    expect((await lerEscala(page)).linhas.filter(l => l.includes('Aluno 1000'))).toHaveLength(1);
    expect(erros).toEqual([]);
    await contexto.close();
  });
});

// Q8 (F1d, "limite confirmado"): o 7º voo local do horário confirmado na Agenda ("Registrar mesmo assim") entra na demanda
// com a confirmação e voa no horário dele, sem tomar a vaga dos seis; a Escala avisa nele, com o texto do agendado
test.describe('O 7º voo local confirmado, na Escala', () => {
  const pedido = (id, extra = {}) => ({
    id, data: AMANHA, aluno: 2000 + id, aluno_nome: `Aluno ${2000 + id}`, missao: 'Voo Local', janela: 'horario', horario: '08:20', horas: 1, recurso: 'C152',
    observacao: null, registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: null, excecao: false, cancelada_em: null, cancelada_por: null,
    missao_do_curso: null, limite_confirmado_por: null, limite_confirmado_em: null, ...extra
  });

  test('os sete voam às 08:20, e o confirmado tem o aviso do limite', async ({ page }) => {
    const estado = cenario({
      ins: Array.from({ length: 8 }, (_, i) => instrutor(i + 1, 9)),
      stu: Array.from({ length: 7 }, (_, i) => aluno(2001 + i, { fly: false }))
    });
    const agenda = [...Array.from({ length: 6 }, (_, i) => pedido(i + 1)),
      pedido(7, { limite_confirmado_por: 'Maria', limite_confirmado_em: '2026-11-10T14:05:00.000Z', registrado_em: '2026-11-10T14:05:00.000Z' })];
    const { documentos: { cadastro }, dias } = documentosAtuais(estado, AMANHA);
    await page.addInitScript(json => {
      if (localStorage.getItem('acpm4_cadastro')) return;
      for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
    }, JSON.stringify({ acpm4_cadastro: cadastro, [`acpm4_dia_${AMANHA}`]: dias[AMANHA], acpm4_agenda: agenda }));
    await page.goto('./');
    await appPronto(page);
    await irPara(page, 'dem');
    await importarDaAgenda(page);
    await expect(page.locator('#toast-box')).toContainText('7');
    await abrirEscala(page, { vista: 'lista' });
    const linhas = (await lerEscala(page)).linhas.filter(l => /Aluno 20\d\d/.test(l));
    expect(linhas).toHaveLength(7);
    expect(linhas.every(l => l.includes('08:20'))).toBe(true);
    await expect(page.locator('#out')).not.toContainText('Rejeitado');
    const avisos = await abrirCaixa(page, 'avisos');
    await expect(avisos.locator('li', { hasText: 'voo local' })).toHaveText(['Aluno 2007 Agendado às 08:20 como o 7º voo local do horário: no máximo 6 voos locais saem no mesmo horário.']);
    // A linha do confirmado tem a marca "fora da regra"; as outras, não
    await expect(page.locator('#out tr', { hasText: 'Aluno 2007' }).locator('[data-dica="fora-da-regra"]')).toHaveCount(1);
    await expect(page.locator('#out [data-dica="fora-da-regra"]')).toHaveCount(1);
    // O dia guarda a confirmação no pedido
    const dia = await page.evaluate(d => JSON.parse(localStorage.getItem(`acpm4_dia_${d}`)), AMANHA);
    expect(Object.entries(dia.pedidos).filter(([, p]) => p.limiteConfirmado).map(([id]) => id)).toEqual(['2007']);
  });
});
