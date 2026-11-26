// Instrutores: os filtros, a disponibilidade do dia (a grade e o "Vem"), as habilitações, o peso e o turno.
import { test, expect, abrir, abrirSintetico, abrirComExemplo, irPara, irParaVista, abrirEscala, lerEscala, filtrarHabilitacoes, confirmar, abrirHistorico, cabecalhoDaGrade, caixaVem, dataAberta, diaSeguinte, gradeDoDia, linhaDoInstrutor, alvosPequenos, larguraDaPagina } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

test.describe('Instrutores', () => {
  test('filtra por nome e por habilitação, nas duas visões', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'ins');
    const dia = gradeDoDia(page).locator('tr[data-k="i"]:visible');
    await page.locator('[data-flt="inst"]').fill('instrutor 1');
    await expect(dia).toHaveCount(10);
    await page.locator('[data-flt="inst"]').fill('');
    await filtrarHabilitacoes(page, ['mlte']);
    await expect(dia).toHaveCount(4);
    await expect(dia.first()).toContainText('Instrutor 09');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    await expect(page.locator('#inst .cd:visible')).toHaveCount(4);
    await expect(page.locator('#inst .cd:visible .nm').first()).toHaveValue('Instrutor 09');
  });

  // A busca acha o nome sem os acentos, nas duas vistas, e o número ao lado diz quantos aparecem (numa região de status).
  // Sem nenhum, a tabela diz por quê, e "Limpar filtros" (a busca e as marcas das habilitações) mostra todos de novo, com
  // o foco na busca. O instrutor novo aparece mesmo fora da busca (é nele que se digita o nome), até ela mudar
  test('a busca acha o nome sem acentos, com quantos aparecem; sem nenhum, "Limpar filtros"; o instrutor novo aparece', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9, { nm: 'Ângelo Brandão' }), instrutor(2, 9), instrutor(3, 1)] }) });
    await irPara(page, 'ins');
    const busca = page.locator('[data-flt="inst"]');
    const contagem = page.locator('#ins-contagem');
    const dia = gradeDoDia(page).locator('tr[data-k="i"]:visible');
    await expect(contagem).toHaveAttribute('role', 'status');
    await expect(contagem).toHaveText('3 instrutores');
    await busca.fill('angelo brandao');
    await expect(dia).toHaveCount(1);
    await expect(dia.locator('.nome')).toHaveText('Ângelo Brandão');
    await expect(contagem).toHaveText('1 de 3 instrutores');
    await busca.fill('  BRANDÃO ');
    await expect(dia).toHaveCount(1);
    // A grade refeita com a escala (a cada alteração) continua filtrada
    await caixaVem(dia).uncheck();
    await expect(linhaDoInstrutor(page, '1')).toHaveClass(/\boff\b/);
    await expect(dia).toHaveCount(1);
    await irParaVista(page, 'ins', 'cadastro');
    await expect(page.locator('#inst .cd:visible')).toHaveCount(1);

    // Nenhum com esses filtros, nas duas vistas
    await busca.fill('xyz');
    await expect(page.locator('#inst tr.sem-resultado')).toHaveText('Nenhum instrutor com esses filtros. Limpar filtros');
    await expect(page.locator('#inst .cd:visible')).toHaveCount(0);
    await expect(contagem).toHaveText('0 de 3 instrutores');
    await irParaVista(page, 'ins', 'dia');
    await filtrarHabilitacoes(page, ['mlte']);
    await gradeDoDia(page).locator('tr.sem-resultado').getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(busca).toHaveValue('');
    await expect(busca).toBeFocused();
    // As marcas também: o botão volta a "Todas as habilitações", sem nenhuma caixa marcada
    await expect(page.locator('#flt-ins-hab')).toHaveText('Todas as habilitações');
    await expect(page.locator('#flt-ins-hab-painel input:checked')).toHaveCount(0);
    await expect(dia).toHaveCount(3);
    await expect(page.locator('#s-ins tr.sem-resultado')).toHaveCount(0);
    await expect(contagem).toHaveText('3 instrutores');

    // O instrutor novo, com a busca: ele aparece (o nome em foco), e os outros continuam filtrados
    const nomesAVista = () => page.locator('#inst .cd:visible .nm').evaluateAll(campos => campos.map(c => c.value));
    await busca.fill('brandao');
    await page.locator('[data-act="addi"]').click();
    await expect(page.locator('#s-ins')).toHaveAttribute('data-vista', 'cadastro');
    await expect.poll(nomesAVista).toEqual(['Ângelo Brandão', 'Novo instrutor']);
    const novo = page.locator('#inst .cd').last().locator('.nm');
    await expect(novo).toBeFocused();
    await expect(busca).toHaveValue('brandao');
    await expect(contagem).toHaveText('2 de 4 instrutores');
    await novo.fill('Carlos Antônio');
    await novo.blur();
    await expect(page.locator('#audit-log-list')).toContainText('Instrutor: Novo instrutor → Carlos Antônio');
    await expect.poll(nomesAVista).toEqual(['Ângelo Brandão', 'Carlos Antônio']);
    // A busca mudou: vale também para ele
    await busca.fill('antonio');
    await expect.poll(nomesAVista).toEqual(['Carlos Antônio']);
    await busca.fill('brandão');
    await expect.poll(nomesAVista).toEqual(['Ângelo Brandão']);
  });

  // A linha alterada continua à vista mesmo fora dos filtros, até eles mudarem: o foco de quem usa o teclado não some com
  // ela. A habilitação tirada no painel, com o filtro dela: o Esc fecha o painel e devolve o foco a "Editar
  // habilitações". O nome mudado, com a busca: o Tab leva ao peso
  test('a linha alterada continua à vista fora dos filtros, até eles mudarem: o foco não some com ela', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9, { nm: 'Ângelo Brandão' }), instrutor(2, 9), instrutor(3, 1)] }) });
    await irParaVista(page, 'ins', 'cadastro');
    const busca = page.locator('[data-flt="inst"]'), contagem = page.locator('#ins-contagem');
    const nomesAVista = () => page.locator('#inst .cd:visible .nm').evaluateAll(campos => campos.map(c => c.value));
    await filtrarHabilitacoes(page, ['mlte']);
    await expect.poll(nomesAVista).toEqual(['Ângelo Brandão', 'Instrutor 02']);
    const editar = page.locator('#inst tr.cd[data-id="1"] [data-act="editar-habs"]');
    await editar.click();
    const mlte = page.locator('#painel-instrutor [data-h="mlte"]');
    await mlte.focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#audit-log-list')).toContainText('Habilitação retirada: Ângelo Brandão');
    await expect(page.locator('#inst tr.cd[data-id="1"]')).not.toHaveAttribute('data-hab', /\bmlte\b/);
    await expect.poll(nomesAVista).toEqual(['Ângelo Brandão', 'Instrutor 02']);
    await expect(contagem).toHaveText('2 de 3 instrutores');
    await page.keyboard.press('Escape');
    await expect(page.locator('#painel-instrutor')).toBeHidden();
    await expect(editar).toBeFocused();
    // Na grade do dia também; mudado o filtro, ele vale para ela
    await irParaVista(page, 'ins', 'dia');
    const naGrade = gradeDoDia(page).locator('tr[data-k="i"]:visible .nome');
    await expect(naGrade).toHaveText(['Ângelo Brandão', 'Instrutor 02']);
    await filtrarHabilitacoes(page, []);
    await filtrarHabilitacoes(page, ['mlte']);
    await expect(naGrade).toHaveText(['Instrutor 02']);

    // O nome mudado pelo teclado, com a busca: a linha fica, e o Tab leva ao peso dela; mudada a busca, ela vale para ela
    await irParaVista(page, 'ins', 'cadastro');
    await filtrarHabilitacoes(page, []);
    await busca.fill('instrutor 02');
    await expect.poll(nomesAVista).toEqual(['Instrutor 02']);
    await page.locator('#inst tr.cd[data-id="2"] .nm').fill('Bruno Peçanha');
    await page.keyboard.press('Tab');
    await expect(page.locator('#audit-log-list')).toContainText('Instrutor: Instrutor 02 → Bruno Peçanha');
    await expect(page.locator('#inst tr.cd[data-id="2"] [data-f="kg"]')).toBeFocused();
    await expect.poll(nomesAVista).toEqual(['Bruno Peçanha']);
    await expect(contagem).toHaveText('1 de 3 instrutores');
    await busca.fill('instrutor 0');
    await expect.poll(nomesAVista).toEqual(['Instrutor 03']);
    await busca.fill('pecanha');
    await expect.poll(nomesAVista).toEqual(['Bruno Peçanha']);
  });

  // O filtro das habilitações tem várias marcas, e aparece quem tem todas as marcadas: uma missão pede várias juntas (o
  // Noturno no C172 pede Noturno e C172). Ele vale nas duas vistas, com o número dos que aparecem. As opções são as do
  // painel "Editar habilitações", nos mesmos grupos, com a habilitação própria do recurso (o PR-VOM) e os rótulos da
  // coluna Habilitações; o botão diz o que está marcado, e "Limpar" desmarca todas
  test('o filtro das habilitações: várias marcas mostram quem tem todas, nas duas vistas, nos grupos de "Editar habilitações"', async ({ page }) => {
    const ins = [
      instrutor(1, 1, { nm: 'Ana', hab: ['local', 'c152', 'c172', 'noturno'] }),
      instrutor(2, 1, { nm: 'Bruno', hab: ['local', 'c152', 'noturno'] }),
      instrutor(3, 1, { nm: 'Carla', hab: ['local', 'c172'] }),
      instrutor(4, 1, { nm: 'Davi', hab: ['local', 'c172', 'noturno', 'aviao:PR-VOM'] })
    ];
    await abrir(page, { estado: cenario({ ins }) });
    await irPara(page, 'ins');
    const botao = page.locator('#flt-ins-hab'), painel = page.locator('#flt-ins-hab-painel'), contagem = page.locator('#ins-contagem');
    const caixa = valor => painel.locator(`input[data-valor="${valor}"]`);
    const naGrade = gradeDoDia(page).locator('tr[data-k="i"]:visible .nome');
    await expect(botao).toHaveText('Todas as habilitações');
    await expect(botao).toHaveAttribute('aria-expanded', 'false');
    await expect(botao).toHaveAttribute('aria-controls', 'flt-ins-hab-painel');
    await expect(painel).toBeHidden();
    await botao.click();
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    await expect(painel).toBeVisible();
    await expect(painel).toHaveAccessibleName('Filtrar por habilitação');
    // A regra dita no painel, com o "?" do glossário
    await expect(painel.locator('.filtro-regra')).toHaveText('Mostra quem tem todas as marcadas.');
    await expect(painel.locator('.filtro-regra [data-dica="filtro-das-habilitacoes"]')).toHaveAccessibleName('O que é Filtro das habilitações?');
    // O balão dessa dica, aberto pelo mouse, fica por cima do painel e fora dele no HTML: o clique no balão (para ler ou
    // selecionar o texto) não conta como fora e não fecha o painel; o mouse que sai do balão fecha só o balão
    const balao = page.locator('#dica');
    await painel.locator('.filtro-regra .dica-btn').hover();
    await expect(balao).toBeVisible();
    await balao.hover();
    await balao.click();
    await expect(painel).toBeVisible();
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.move(0, 0);
    await expect(balao).toBeHidden();
    const grupos = ['Ground e simulador', 'Voo', 'Aviões', 'Checador: curso', 'Checador: motor', 'Checador: regras', 'Habilitação própria do recurso'];
    await expect(painel.locator('legend')).toHaveText(grupos);
    const grupo = nome => painel.locator('fieldset', { has: page.locator('legend', { hasText: nome }) }).locator('label');
    await expect(grupo('Voo')).toHaveText(['TGL (TMA)', 'Local', 'Navegação', 'Liberação de Solo', 'Parafuso (SPIN)', 'IFR', 'Noturno']);
    await expect(grupo('Aviões')).toHaveText(['C152', 'C172', 'MLTE (PA-34)']);
    await expect(grupo('Checador: curso')).toHaveText(['Checador PP', 'Checador PC', 'Checador INVA']);
    await expect(grupo('Habilitação própria do recurso')).toHaveText(['Avião PR-VOM']);
    await expect(painel.locator('input[data-filtro]')).toHaveCount(22);

    // Uma marca: quem tem Noturno
    await caixa('noturno').check();
    await expect(naGrade).toHaveText(['Ana', 'Bruno', 'Davi']);
    await expect(botao).toHaveText('Habilitações: Noturno');
    await expect(contagem).toHaveText('3 de 4 instrutores');
    // Duas: só quem tem as duas, e não quem tem uma delas
    await caixa('c172').check();
    await expect(naGrade).toHaveText(['Ana', 'Davi']);
    await expect(botao).toHaveText('Habilitações: Noturno + C172');
    await expect(botao).toHaveClass(/\bcom-marcas\b/);
    await expect(contagem).toHaveText('2 de 4 instrutores');
    // A habilitação própria do recurso é uma marca como as outras
    await caixa('aviao:PR-VOM').check();
    await expect(naGrade).toHaveText(['Davi']);
    await expect(botao).toHaveText('Habilitações: Noturno + C172 + Avião PR-VOM');
    await caixa('aviao:PR-VOM').uncheck();
    await expect(naGrade).toHaveText(['Ana', 'Davi']);

    // Na outra vista também: o clique fora fecha o painel, e as marcas continuam
    const nomesAVista = () => page.locator('#inst .cd:visible .nm').evaluateAll(campos => campos.map(c => c.value));
    await irParaVista(page, 'ins', 'cadastro');
    await expect(painel).toBeHidden();
    await expect(botao).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(nomesAVista).toEqual(['Ana', 'Davi']);
    await expect(botao).toHaveText('Habilitações: Noturno + C172');

    // "Limpar" desmarca todas e mostra todos; o painel continua aberto, com o foco no "Limpar"
    await botao.click();
    const limpar = painel.getByRole('button', { name: 'Limpar' });
    await limpar.click();
    await expect(painel.locator('input[data-filtro]:checked')).toHaveCount(0);
    await expect(botao).toHaveText('Todas as habilitações');
    await expect(botao).not.toHaveClass(/\bcom-marcas\b/);
    await expect.poll(nomesAVista).toEqual(['Ana', 'Bruno', 'Carla', 'Davi']);
    await expect(contagem).toHaveText('4 instrutores');
    await expect(painel).toBeVisible();
    await expect(limpar).toBeFocused();

    // Os grupos são os do painel "Editar habilitações" (sem as horas de voo do instrutor)
    await page.locator('#inst tr.cd[data-id="1"] [data-act="editar-habs"]').click();
    await expect(painel).toBeHidden();
    await expect(page.locator('#painel-instrutor .habs-painel > fieldset:not(.horas-ins) > legend')).toHaveText(grupos);
  });

  // As opções acompanham a frota: a habilitação própria marcada num recurso em Recursos aparece no filtro; a que sai (o
  // atributo desmarcado, o recurso retirado) sai do filtro, também marcada, e o filtro deixa de valer por ela. O
  // Histórico, que devolve o recurso retirado, devolve a opção, sem a marca
  test('as opções do filtro das habilitações acompanham a frota: a habilitação própria que sai de Recursos sai do filtro, também marcada', async ({ page }) => {
    const ins = [instrutor(1, 1, { nm: 'Ana', hab: ['local', 'c172', 'aviao:PR-HAR', 'aviao:PR-VOM'] }), instrutor(2, 1, { nm: 'Bruno', hab: ['local', 'c172'] })];
    await abrir(page, { estado: cenario({ ins }) });
    const botao = page.locator('#flt-ins-hab'), painel = page.locator('#flt-ins-hab-painel');
    const propria = painel.locator('fieldset', { has: page.locator('legend', { hasText: 'Habilitação própria do recurso' }) }).locator('label');
    const naGrade = gradeDoDia(page).locator('tr[data-k="i"]:visible .nome');
    // A frota fica no Cadastro de Recursos
    const atributo = async (reg, marcar) => {
      await irParaVista(page, 'rec', 'cadastro');
      await page.locator(`#frota li.frota-item[data-r="${reg}"] [data-act="atributos-recurso"]`).click();
      await page.locator(`#frota li.frota-item[data-r="${reg}"] [data-atributo="habilitacaoPropria"]`).setChecked(marcar);
      await expect(page.locator('#audit-log-list')).toContainText(`${reg}: Habilitação própria ${marcar ? 'marcado' : 'desmarcado'}`);
      await irPara(page, 'ins');
    };
    // O PR-HAR (C172) passa a ter habilitação própria: aparece no filtro, ao lado da do PR-VOM
    await atributo('PR-HAR', true);
    await filtrarHabilitacoes(page, ['aviao:PR-HAR', 'aviao:PR-VOM'], { fechar: false });
    await expect(propria).toHaveText(['Avião PR-HAR', 'Avião PR-VOM']);
    await expect(naGrade).toHaveText(['Ana']);
    await expect(botao).toHaveText('Habilitações: Avião PR-HAR + Avião PR-VOM');
    // O PR-VOM deixa de ter habilitação própria: a opção some, e a marca dela sai do filtro
    await atributo('PR-VOM', false);
    await expect(botao).toHaveText('Habilitações: Avião PR-HAR');
    await expect(painel.locator('input[data-valor="aviao:PR-VOM"]')).toHaveCount(0);
    await expect(naGrade).toHaveText(['Ana']);
    // O PR-HAR sai da frota: o filtro fica sem marca, e o grupo da habilitação própria some
    await irParaVista(page, 'rec', 'cadastro');
    await confirmar(page, '#frota li.frota-item[data-r="PR-HAR"] [data-act="retirar-recurso"]');
    await expect(page.locator('#frota li.frota-item[data-r="PR-HAR"]')).toHaveCount(0);
    await irPara(page, 'ins');
    await expect(botao).toHaveText('Todas as habilitações');
    await expect(naGrade).toHaveText(['Ana', 'Bruno']);
    await expect(page.locator('#ins-contagem')).toHaveText('2 instrutores');
    await botao.click();
    await expect(painel.locator('legend', { hasText: 'Habilitação própria do recurso' })).toHaveCount(0);
    // O Histórico devolve o PR-HAR, com a habilitação própria: a opção volta, sem a marca
    await abrirHistorico(page);
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await expect(page.locator('#audit-log-list')).toContainText('Revertido: PR-HAR de volta à frota');
    await page.keyboard.press('Escape');
    await botao.click();
    await expect(propria).toHaveText(['Avião PR-HAR']);
    await expect(painel.locator('input[data-filtro]:checked')).toHaveCount(0);
  });

  // As marcas e o painel aberto duram aos redesenhos: a grade refeita com a escala (o turno aplicado, sem clique: o
  // painel continua aberto), outra data e o instrutor novo (que aparece fora do filtro, é nele que se digita o nome). Com
  // as opções refeitas (a frota que muda por baixo, como numa leitura dos dados), o foco fica na mesma caixa; a caixa que
  // some passa o foco para a que ficou no lugar
  test('o filtro das habilitações dura aos redesenhos: o painel aberto, as marcas e o foco na caixa', async ({ page }) => {
    const ins = [instrutor(1, 1, { nm: 'Ana', hab: ['local', 'c172', 'noturno'] }), instrutor(2, 1, { nm: 'Bruno', hab: ['local', 'noturno'] }),
      instrutor(3, 1, { nm: 'Carla', hab: ['local', 'c172', 'noturno'] })];
    await abrir(page, { estado: { ...cenario({ ins }), nid: 4 } });
    await irPara(page, 'ins');
    const botao = page.locator('#flt-ins-hab'), painel = page.locator('#flt-ins-hab-painel');
    const naGrade = gradeDoDia(page).locator('tr[data-k="i"]:visible .nome');
    await filtrarHabilitacoes(page, ['noturno', 'c172'], { fechar: false });
    await expect(naGrade).toHaveText(['Ana', 'Carla']);
    // A grade refeita com a escala: as linhas de antes ficam marcadas, e nenhuma linha da grade nova tem a marca
    await gradeDoDia(page).locator('tr').evaluateAll(linhas => linhas.forEach(l => { l.dataset.antes = ''; }));
    await linhaDoInstrutor(page, '1').locator('[data-f="pre"]').selectOption('Manhã');
    await expect(gradeDoDia(page).locator('tr[data-antes]')).toHaveCount(0);
    await expect(linhaDoInstrutor(page, '1').locator('.cel.on')).toHaveCount(4);
    await expect(painel).toBeVisible();
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    await expect(naGrade).toHaveText(['Ana', 'Carla']);
    // Outra data (o clique na seta fecha o painel): as marcas continuam
    await diaSeguinte(page);
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-12');
    await expect(painel).toBeHidden();
    await expect(botao).toHaveText('Habilitações: Noturno + C172');
    await expect(naGrade).toHaveText(['Ana', 'Carla']);
    await expect(painel.locator('input[data-filtro]:checked')).toHaveCount(2);
    // O instrutor novo aparece, e os outros continuam filtrados
    const nomesAVista = () => page.locator('#inst .cd:visible .nm').evaluateAll(campos => campos.map(c => c.value));
    await page.locator('[data-act="addi"]').click();
    await expect.poll(nomesAVista).toEqual(['Ana', 'Carla', 'Novo instrutor']);
    await expect(page.locator('#ins-contagem')).toHaveText('3 de 4 instrutores');

    // As opções refeitas com o foco numa caixa: o foco fica nela, e o painel continua aberto
    const refazerComAFrota = (reg, propria) => page.evaluate(async ([reg, propria]) => {
      const { S } = await import('./js/state.js');
      const recurso = S.frota.find(f => f.reg === reg);
      if (propria) recurso.habilitacaoPropria = true;
      else delete recurso.habilitacaoPropria;
      const { rIns } = await import('./js/views/instrutores.js');
      rIns();
    }, [reg, propria]);
    await botao.click();
    const c172 = painel.locator('input[data-valor="c172"]');
    await c172.focus();
    await refazerComAFrota('PR-HAR', true);
    await expect(painel.locator('input[data-valor="aviao:PR-HAR"]')).toBeVisible();
    await expect(c172).toBeFocused();
    await expect(painel).toBeVisible();
    // A caixa em foco que some: o foco vai para a que ficou no lugar dela (a do PR-VOM), e não para o corpo da página
    await painel.locator('input[data-valor="aviao:PR-HAR"]').focus();
    await refazerComAFrota('PR-HAR', false);
    await expect(painel.locator('input[data-valor="aviao:PR-HAR"]')).toHaveCount(0);
    await expect(painel.locator('input[data-valor="aviao:PR-VOM"]')).toBeFocused();
    await expect(botao).toHaveText('Habilitações: Noturno + C172');
  });

  test('disponibilidade do dia: a grade mostra as janelas e os voos de cada instrutor', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const linhasDaEscala = (await lerEscala(page)).linhas;
    await irPara(page, 'ins');
    await expect(page.locator('#s-ins [data-vista-ins="dia"]')).toHaveClass(/\bon\b/);
    // "Vem": o instrutor vem na data aberta no topo (o app abre em amanhã: não é "hoje")
    await expect(cabecalhoDaGrade(page).locator('th').nth(1)).toHaveText('Vem');
    await expect(cabecalhoDaGrade(page).locator('[data-dica="vem-nesta-data"]')).toHaveAccessibleName('O que é Vem?');
    await expect(page.locator('#s-ins .legenda-disp')).toContainText('Clique numa janela para mudar a disponibilidade desta data.');
    // A grade bate com a escala: o número de voos e aulas do instrutor (a turma de Ground conta uma vez)
    const comVoos = gradeDoDia(page).locator('tr[data-k="i"]').filter({ has: page.locator('.voos:not(:empty)') }).first();
    const id = await comVoos.getAttribute('data-id');
    const nome = (await comVoos.locator('.nome').innerText()).trim();
    await expect(comVoos.locator('.voos')).toHaveText(String(linhasDaEscala.filter(l => l.includes(`| ${nome} |`)).length));
    expect(await comVoos.locator('.cel.voo').count()).toBeGreaterThanOrEqual(1);
    const celula = () => gradeDoDia(page).locator(`tr[data-k="i"][data-id="${id}"] .cel`).nth(7);
    await comVoos.locator('[data-f="aw"][data-w="7"]').uncheck();
    await expect(celula()).not.toHaveClass(/\bon\b/);
    // Pelo teclado: a grade é refeita e o foco continua na mesma janela
    await linhaDoInstrutor(page, id).locator('[data-f="aw"][data-w="7"]').focus();
    await page.keyboard.press('Space');
    await expect(celula()).toHaveClass(/\bon\b/);
    await expect(linhaDoInstrutor(page, id).locator('[data-f="aw"][data-w="7"]')).toBeFocused();
  });

  test('o checador por partes: o curso, o motor e as regras; o cheque vai para quem tem as três', async ({ page }) => {
    const estado = cenario({
      ins: [instrutor(1, 9, { hab: ['local', 'c152', 'checa_pp', 'checa_mnte'] }), instrutor(2, 9, { hab: ['local', 'c152'] })],
      stu: [aluno(1000, { mis: 'Cheque PP', eq: 'C152' })]
    });
    await abrir(page, { estado });
    await irPara(page, 'ins');
    // Na grade do dia, as marcas de checador contam como uma
    await expect(gradeDoDia(page).locator('tr[data-k="i"][data-id="1"] .habs-resumo')).toHaveText('Checador · Local');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    const linha = page.locator('#inst .cd[data-id="1"]');
    await linha.locator('[data-act="editar-habs"]').click();
    const painel = page.locator('#painel-instrutor');
    const grupo = nome => painel.locator('fieldset', { has: page.locator('legend', { hasText: nome }) }).locator('label');
    await expect(grupo('Checador: curso')).toHaveText(['Checador do curso PP', 'Checador do curso PC', 'Checador do curso INVA']);
    await expect(grupo('Checador: motor')).toHaveText(['Checador MNTE', 'Checador MLTE']);
    await expect(grupo('Checador: regras')).toHaveText(['Checador VFR', 'Checador IFR']);
    await expect(painel.locator('.dica-btn[data-dica="checador"]')).toHaveCount(1);
    // Sem as regras (VFR), o instrutor ainda não dá o Cheque PP
    await abrirEscala(page);
    expect((await lerEscala(page)).linhas.filter(l => l.includes('Aluno 1000'))).toHaveLength(0);
    await irPara(page, 'ins');
    await painel.locator('[data-f="hab"][data-h="checa_vfr"]').check();
    await expect(linha).toHaveAttribute('data-hab', 'local c152 checa_pp checa_mnte checa_vfr');
    await page.locator('#btn-fechar-painel-instrutor').click();
    await abrirEscala(page);
    const voos = (await lerEscala(page)).linhas.filter(l => l.includes('Aluno 1000'));
    expect(voos).toHaveLength(1);
    expect(voos[0]).toContain('| Instrutor 01 |');
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
    await expect(linha).toHaveAttribute('data-hab', 'grounds ground_pa34 local c152');
    await expect(linha.locator('[data-f="kg"]')).toHaveClass(/\bfalta\b/);

    await linha.locator('[data-act="editar-habs"]').click();
    const painel = page.locator('#painel-instrutor');
    await expect(painel).toBeVisible();
    await expect(painel.locator('h2')).toContainText('Novo instrutor');
    await expect(painel.locator('fieldset', { hasText: 'Aviões' }).locator('label')).toHaveText(['C152', 'C172', 'MLTE (PA-34)']);
    await expect(painel.locator('[data-f="hab"][data-h="c152"]')).toBeChecked();
    await painel.locator('[data-f="hab"][data-h="c172"]').check();
    await painel.locator('[data-f="hab"][data-h="local"]').uncheck();
    await expect(page.locator('#inst .cd').last()).toHaveAttribute('data-hab', 'grounds ground_pa34 c152 c172');
    await page.locator('#btn-fechar-painel-instrutor').click();
    await expect(painel).toBeHidden();

    await page.locator('#inst .cd').last().locator('[data-f="kg"]').fill('80');
    await page.locator('#inst .cd').last().locator('[data-f="kg"]').blur();
    await expect(page.locator('#inst .cd').last().locator('[data-f="kg"]')).not.toHaveClass(/\bfalta\b/);

    await page.locator('#s-ins [data-vista-ins="dia"]').click();
    await gradeDoDia(page).locator('tr[data-k="i"]').last().locator('[data-f="pre"]').selectOption('Manhã');
    const janelas = gradeDoDia(page).locator('tr[data-k="i"]').last().locator('[data-f="aw"]');
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
    await expect(page.locator('#out')).toContainText('nenhum instrutor ativo tem a habilitação de Simulador no Sim. Mono (Simulador (Mono))');
  });

  test('instrutor indisponível pode ser revertido pelo histórico', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'ins');
    await caixaVem(gradeDoDia(page).locator('tr[data-k="i"]').first()).uncheck();
    await expect(gradeDoDia(page).locator('tr[data-k="i"]').first()).toHaveClass(/\boff\b/);
    await abrirHistorico(page);
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await irPara(page, 'ins');
    await expect(gradeDoDia(page).locator('tr[data-k="i"]').first()).not.toHaveClass(/\boff\b/);
  });
});

// No celular (390 px; os testes que mudam a largura dizem qual), vindos de celular.spec.js
test.describe('Celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // O filtro das habilitações no celular (390 e 320 px): o botão divide a linha com a busca; o painel abre no fluxo da
  // página, inteiro na largura da tela (a grade desce para baixo dele: nada fica coberto), e as caixas, o "Limpar" e o
  // "?" têm 44 px para o dedo
  test('o filtro das habilitações cabe no celular (390 e 320 px): o painel empurra a grade, com alvos de 44 px', async ({ page }) => {
    await abrirComExemplo(page);
    for (const largura of [390, 320]) {
      await page.setViewportSize({ width: largura, height: 800 });
      await irPara(page, 'ins');
      await filtrarHabilitacoes(page, ['noturno', 'c172'], { fechar: false });
      const caixas = await Promise.all(['[data-flt="inst"]', '#flt-ins-hab', '#flt-ins-hab-painel', '#s-ins .vista-dia .tw']
        .map(seletor => page.locator(seletor).boundingBox()));
      const [busca, botao, painel, grade] = caixas;
      expect(Math.abs(botao.y + botao.height / 2 - (busca.y + busca.height / 2)), `${largura}: o botão na linha da busca`).toBeLessThan(4);
      expect(botao.x + botao.width, `${largura}: o botão na tela`).toBeLessThanOrEqual(largura);
      expect(painel.x, `${largura}: o painel na tela`).toBeGreaterThanOrEqual(0);
      expect(painel.x + painel.width, `${largura}: o painel na tela`).toBeLessThanOrEqual(largura);
      expect(grade.y, `${largura}: a grade embaixo do painel`).toBeGreaterThanOrEqual(painel.y + painel.height);
      expect(await larguraDaPagina(page), `${largura}: a página não rola para o lado`).toBeLessThanOrEqual(largura);
      expect(await alvosPequenos(page), `${largura}: alvos de 44 px`).toEqual([]);
      await filtrarHabilitacoes(page, []);
    }
  });
});
