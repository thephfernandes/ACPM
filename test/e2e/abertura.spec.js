// A escala abrindo: até os dados da data chegarem, e depois de uma leitura que falhou, nada é gravado. Antes deles, o
// estado da tela é o inicial (sem os alunos e os instrutores), mas o cadastro já foi lido, com a versão atual: gravar
// nessa hora levaria o cadastro vazio por cima do de todos. Numa troca de data, a tela ainda é a da data anterior, com o
// cadastro já lido de novo. Toda mudança é recusada, com o aviso, e a tela fica como estava: também o programa dos cursos
// (a aba Cursos grava nas tabelas dos cursos, à parte do dia) e o agendamento na Escala (o diálogo nem abre). As datas são
// lidas uma de cada vez (a versão que a gravação leva é a da leitura dos dados da tela), e nenhuma data é lida antes de a
// abertura preparar os dados, nem depois de a preparação falhar. O que fica aberto na tela quando a data abre passa a
// mostrar os dados dela
import { test, comProgresso, expect, prepararContexto, vigiarErros, preencherLogin, entrar, irPara, irParaVista, abrirEscala, AMANHA, URL_APP, abrirHistorico, alternarDisponivel, botaoAprovar, caixaDisponivel, caixaVoa, dataAberta, diaAnterior, diaSeguinte, exportar, importarDaAgenda, rotuloDaData, escolherNoCalendario } from './fixtures.js';
import { criarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';
import { runAllocationEngine } from '../../js/engine.js';
import { ApiClient } from '../../js/storage.js';

const AVISO = 'A escala ainda não abriu: nada foi mudado. Espere os dados chegarem ou recarregue a página.';
const FALHA = 'Não foi possível preparar os dados da escala. Verifique a conexão e recarregue a página; nada foi perdido.';
const PROGRAMA = { PP: [{ id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local', eq: 'C152', nb: 1 }], PC: [], INVA: [] };
// Um instrutor, dois alunos (o do PP voa a PP-01 amanhã), o programa do PP e um pedido da agenda para amanhã
const estado = () => ({
  ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 500, p2: -1, etapa: 'PP-01' }, { curso: 'PP' }), aluno(1001, { fly: false })] }),
  cursos: PROGRAMA, nid: 1002
});
const PEDIDO = {
  id: 1, data: AMANHA, aluno: 1001, aluno_nome: 'Aluno 1001', missao: 'Voo Local', janela: 'horario', horario: '07:00', horas: 1, observacao: null,
  registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: 'Secretaria de Teste', excecao: false, cancelada_em: null, cancelada_por: null
};

function criarServidor(dias = {}) {
  const documentos = documentosAtuais(estado(), AMANHA);
  const servidor = criarSupabaseFalso({ ...documentos, dias: { ...documentos.dias, ...dias } });
  servidor.solicitacoes.push(PEDIDO);
  return servidor;
}

async function novoContexto(browser, servidor) {
  const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await prepararContexto(contexto);
  await servidor.instalar(contexto);
  return contexto;
}

// O cadastro do servidor: os alunos e os instrutores e, nas tabelas dos cursos, cada curso com a versão dele e o programa
// do PP (os códigos, na ordem)
const cadastroDe = servidor => {
  const { conteudo } = servidor.banco.get('cadastro');
  const pp = servidor.cursos.find(c => c.sigla === 'PP');
  return {
    alunos: conteudo.stu.map(s => s.nm), instrutores: conteudo.ins.map(i => i.nm), cursos: servidor.cursos.map(c => `${c.sigla} v${c.versao}`),
    pp: pp.missoes.filter(m => !m.removida).sort((a, b) => a.ordem - b.ordem).map(m => m.codigo)
  };
};

// A mudança recusada mostra o aviso, uma vez (os avisos anteriores saem antes)
async function recusada(page, nome, mudar) {
  await page.locator('#toast-box').evaluate(caixa => caixa.replaceChildren());
  await mudar();
  await expect(page.locator('#toast-box .toast'), nome).toHaveText([AVISO]);
}

// Os botões que já estão na tela antes de os dados chegarem: também "+ Novo curso" (a aba Cursos, ainda sem os cursos) e
// "+ Agendar voo", na barra da Escala
const BOTOES_DA_ABERTURA = [
  ['+ Novo aluno', async page => { await irPara(page, 'alu'); await page.locator('#s-alu [data-act="adds"]').click(); }],
  ['+ Novo instrutor', async page => { await irPara(page, 'ins'); await page.locator('#s-ins [data-act="addi"]').click(); }],
  ['Cursos › + Novo curso', async page => { await irPara(page, 'cur'); await page.locator('#cur-novo').click(); }],
  ['+ Novo recurso', async page => {
    await irPara(page, 'rec');
    await page.locator('#btn-novo-recurso').click();
    await page.locator('#rec-reg').fill('PR-ZZZ');
    await page.locator('#rec-tipo').selectOption('C152');
    await page.locator('#form-recurso [type="submit"]').click();
  }],
  ['Limpar demanda', async page => {
    await irPara(page, 'dem');
    await page.locator('#btn-mais-dem').click();
    await page.locator('#clr').click();
  }],
  ['Importar da agenda', async page => { await irPara(page, 'dem'); await importarDaAgenda(page); }],
  ['+ Agendar voo', async page => { await irPara(page, 'esc'); await page.locator('#btn-agendar').click(); }]
];

test.describe('A escala abrindo: nada é gravado antes de os dados da data chegarem', () => {
  test('enquanto os dados chegam, nenhum botão grava (o cadastro de todos fica como estava); com eles, os mesmos botões gravam', async ({ browser }) => {
    const servidor = criarServidor();
    const contexto = await novoContexto(browser, servidor);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    const antes = cadastroDe(servidor);
    const liberar = servidor.segurarLeiturasDeDias();
    await page.goto(URL_APP);
    await preencherLogin(page, CONTAS.administrador);
    await expect(page.locator('#usuario')).toBeVisible();

    for (const [nome, usar] of BOTOES_DA_ABERTURA) await recusada(page, nome, () => usar(page));
    // A tela também ficou como estava: sem o aluno novo, o formulário do curso novo, o diálogo de agendar ou "Limpar
    // demanda" armado
    await expect(page.locator('#alu tr.cd')).toHaveCount(0);
    await expect(page.locator('#cursos .curso')).toHaveCount(0);
    await expect(page.locator('#form-curso')).toBeHidden();
    await expect(page.locator('#dlg-agendar')).toBeHidden();
    await expect(page.locator('#clr')).toHaveText('Limpar demanda');
    expect(servidor.gravacoes).toEqual([]);
    expect(servidor.historico).toEqual([]);
    expect(cadastroDe(servidor)).toEqual(antes);

    // Com os dados, os mesmos botões gravam, junto com o que já estava no cadastro. O programa do curso fica só nas tabelas
    // dos cursos (fora do histórico da data), e "+ Agendar voo" abre o diálogo
    liberar();
    await expect(page.locator('body[data-pronto]')).toBeAttached();
    await irPara(page, 'alu');
    await expect(page.locator('#alu tr.cd')).toHaveCount(2);
    await page.locator('#s-alu [data-act="adds"]').click();
    await expect.poll(() => cadastroDe(servidor).alunos).toEqual(['Aluno 1000', 'Aluno 1001', 'Novo aluno']);
    await irPara(page, 'cur');
    await page.locator('#cursos .curso[data-curso="PP"] [data-act="missao-nova"]').click();
    await expect.poll(() => cadastroDe(servidor).pp).toEqual(['PP-01', 'PP-02']);
    expect(cadastroDe(servidor).instrutores).toEqual(antes.instrutores);
    await expect.poll(() => servidor.historico.map(h => h.descricao)).toEqual(['Aluno cadastrado: Novo aluno']);
    await irPara(page, 'esc');
    await page.locator('#btn-agendar').click();
    await expect(page.locator('#dlg-agendar')).toBeVisible();
    await page.locator('#agd-voltar').click();
    await expect(page.locator('#dlg-agendar')).toBeHidden();
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('depois de a abertura falhar, nenhum botão grava; recarregando, a escala abre e grava', async ({ browser }) => {
    const servidor = criarServidor();
    const contexto = await novoContexto(browser, servidor);
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    const antes = cadastroDe(servidor);
    // A leitura da data falha, também nas tentativas de novo do supabase-js
    servidor.falhar('/rest/v1/dias', 1000);
    await page.goto(URL_APP);
    await preencherLogin(page, CONTAS.administrador);
    await expect(page.locator('#aviso-sync-texto')).toHaveText(FALHA, { timeout: 15000 });

    for (const [nome, usar] of BOTOES_DA_ABERTURA) await recusada(page, nome, () => usar(page));
    expect(servidor.gravacoes).toEqual([]);
    expect(servidor.historico).toEqual([]);
    expect(cadastroDe(servidor)).toEqual(antes);

    // O servidor volta: recarregando, a escala abre
    servidor.falhar('/rest/v1/dias', 0);
    await page.locator('#btn-recarregar').click();
    await expect(page.locator('body[data-pronto]')).toBeAttached();
    await expect(page.locator('#aviso-sync')).toBeHidden();
    await irPara(page, 'alu');
    await expect(page.locator('#alu tr.cd')).toHaveCount(2);
    await page.locator('#s-alu [data-act="adds"]').click();
    await expect.poll(() => cadastroDe(servidor).alunos).toEqual(['Aluno 1000', 'Aluno 1001', 'Novo aluno']);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // Fora dos botões fixos, as mudanças da tela da data anterior: o resultado da missão, aprovar, a compactação, a Demanda,
  // os limites da lei e o programa do curso
  comProgresso('enquanto outra data abre, nenhuma mudança grava e a tela fica como estava; na data nova, vale de novo', async ({ browser }) => {
    const servidor = criarServidor();
    const contexto = await novoContexto(browser, servidor);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    const antes = cadastroDe(servidor);
    await entrar(page, CONTAS.administrador);
    await abrirEscala(page);
    const liberar = servidor.segurarLeiturasDeDias();
    await diaSeguinte(page, { esperar: false });

    const resultado = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' }).locator('[data-resultado]');
    await recusada(page, 'o resultado da missão', () => resultado.selectOption('aprovado'));
    await expect(resultado).toHaveValue('pendente');
    await recusada(page, 'Aprovar escala', () => botaoAprovar(page).click());
    await expect(botaoAprovar(page)).toHaveText('Aprovar escala');
    const criterio = page.locator('[data-criterio="buracos"][data-valor="aviao"]');
    await recusada(page, 'a compactação', () => criterio.click());
    await expect(criterio).toHaveAttribute('aria-pressed', 'false');

    await irPara(page, 'dem');
    await recusada(page, 'Pôr um aluno na demanda', async () => {
      await page.locator('#incluir-aluno').fill('Aluno 1001');
      await page.locator('#incluir-aluno').press('Enter');
    });
    const voa = caixaVoa(page.locator('#dem tr[data-k="d"][data-id="1000"]'));
    await recusada(page, 'o Voa da demanda', () => voa.click());
    await expect(voa).toBeChecked();

    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    const limite = page.locator('#limites-lei [data-limite="vooMesH"]');
    await recusada(page, 'os limites da lei', async () => { await limite.fill('90'); await limite.press('Tab'); });
    await expect(limite).toHaveValue('100');

    await irPara(page, 'cur');
    const nome = page.locator('#cursos .curso[data-curso="PP"] tbody tr[data-i="0"] [data-cf="nome"]');
    await recusada(page, 'o programa do curso', async () => { await nome.fill('Primeiro voo'); await nome.press('Tab'); });
    await expect(nome).toHaveValue('Familiarização');
    expect(servidor.gravacoes).toEqual([]);
    expect(servidor.historico).toEqual([]);
    expect(servidor.resultados).toEqual([]);
    expect(cadastroDe(servidor)).toEqual(antes);

    liberar();
    await expect(rotuloDaData(page)).toContainText('12/11');
    await nome.fill('Primeiro voo');
    await nome.press('Tab');
    await expect.poll(() => servidor.cursos.find(c => c.sigla === 'PP').missoes.find(m => m.codigo === 'PP-01').nome).toBe('Primeiro voo');
    expect(cadastroDe(servidor).alunos).toEqual(['Aluno 1000', 'Aluno 1001']);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // Exportar e "Tentar de novo" gravam sem passar por uma alteração (a escala só calculada; as horas lidas de novo): enquanto
  // outra data abre, os dois continuam (o CSV sai, as horas são lidas), mas não gravam. Na data nova, exportar grava
  test('enquanto outra data abre, exportar e "Tentar de novo" não gravam', async ({ browser }) => {
    const servidor = criarServidor();
    const contexto = await novoContexto(browser, servidor);
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    servidor.falhar('/rpc/horas_dos_instrutores');
    await entrar(page, CONTAS.operador);
    await expect(page.locator('#aviso-dados')).toBeVisible();
    await abrirEscala(page);
    const liberar = servidor.segurarLeiturasDeDias();
    await diaSeguinte(page, { esperar: false });
    // A escala de amanhã só foi calculada: exportar a gravaria
    await exportar(page, 'csv');
    await page.locator('#btn-tentar-dados').click();
    await expect(page.locator('#aviso-dados')).toBeHidden();
    await page.waitForTimeout(300);
    expect(servidor.gravacoes).toEqual([]);

    liberar();
    await expect(rotuloDaData(page)).toContainText('12/11');
    await exportar(page, 'csv');
    await expect.poll(() => servidor.gravacoes.map(g => g.chave)).toContain('dia:2026-11-12');
    expect(servidor.gravacoes.map(g => g.chave)).not.toContain(`dia:${AMANHA}`);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // A abertura (amanhã) e o dia 13, escolhido no calendário enquanto ela lia: as datas são lidas uma de cada vez, e o dia 13
  // só é lido depois da abertura (a resposta dela nunca chega depois da dele). Depois, a tela e a gravação ficam com os
  // dados do dia 13 (o PR-BTB em manutenção)
  test('a data escolhida enquanto a escala abria espera a leitura da abertura e fica no lugar dela', async ({ browser }) => {
    const dia13 = structuredClone(documentosAtuais(estado(), AMANHA).dias[AMANHA]);
    dia13.av['PR-BTB'] = false;
    const servidor = criarServidor({ '2026-11-13': dia13 });
    const contexto = await novoContexto(browser, servidor);
    // Os resultados do dia da abertura demoram
    let soltarAbertura;
    const abertura = new Promise(resolve => { soltarAbertura = resolve; });
    await contexto.route(url => url.pathname.endsWith('/rest/v1/resultados_de_missao') && url.searchParams.get('data') === `eq.${AMANHA}`, async route => {
      await abertura;
      await route.fallback();
    });
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    const leiturasDo13 = [];
    page.on('request', r => { if (new URL(r.url()).searchParams.get('data') === 'eq.2026-11-13') leiturasDo13.push(r.url()); });
    const liberar = servidor.segurarLeiturasDeDias();
    await page.goto(URL_APP);
    await preencherLogin(page, CONTAS.operador);
    await expect(page.locator('#usuario')).toBeVisible();
    await irPara(page, 'age');
    await escolherNoCalendario(page, '2026-11-13');
    liberar();
    // O dia 13 espera: nada dele é lido enquanto a abertura lê
    await page.waitForTimeout(300);
    expect(leiturasDo13).toEqual([]);
    soltarAbertura();
    await expect(rotuloDaData(page)).toContainText('13/11');
    await expect(page.locator('body[data-pronto]')).toBeAttached();

    await irPara(page, 'rec');
    await expect(dataAberta(page)).toHaveAttribute('data-data', '2026-11-13');
    await expect(caixaDisponivel(page, 'PR-BTB')).not.toBeChecked();
    await alternarDisponivel(page, 'PR-IGU', false);
    await expect.poll(() => servidor.dias.get('2026-11-13').versao).toBe(2);
    expect(servidor.dias.get('2026-11-13').conteudo.av).toMatchObject({ 'PR-BTB': false, 'PR-IGU': false });
    expect(servidor.gravacoes.map(g => g.chave)).not.toContain(`dia:${AMANHA}`);
    expect(cadastroDe(servidor).alunos).toEqual(['Aluno 1000', 'Aluno 1001']);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // Na outra ordem, a resposta da abertura chega antes da do dia 13: a escala da abertura aparece (com os alunos), mas nada
  // grava até o dia 13 abrir
  test('a resposta da abertura que chega antes da data escolhida aparece, mas nada grava até a escolhida abrir', async ({ browser }) => {
    const dia13 = structuredClone(documentosAtuais(estado(), AMANHA).dias[AMANHA]);
    dia13.av['PR-BTB'] = false;
    const servidor = criarServidor({ '2026-11-13': dia13 });
    const contexto = await novoContexto(browser, servidor);
    let soltar13;
    const espera13 = new Promise(resolve => { soltar13 = resolve; });
    await contexto.route(url => url.pathname.endsWith('/rest/v1/resultados_de_missao') && url.searchParams.get('data') === 'eq.2026-11-13', async route => {
      await espera13;
      await route.fallback();
    });
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    const liberar = servidor.segurarLeiturasDeDias();
    await page.goto(URL_APP);
    await preencherLogin(page, CONTAS.operador);
    await expect(page.locator('#usuario')).toBeVisible();
    await irPara(page, 'age');
    await escolherNoCalendario(page, '2026-11-13');
    liberar();
    await expect(page.locator('body[data-pronto]')).toBeAttached();
    await irPara(page, 'alu');
    await expect(page.locator('#alu tr.cd')).toHaveCount(2);
    await recusada(page, '+ Novo aluno', () => page.locator('#s-alu [data-act="adds"]').click());
    await expect(page.locator('#alu tr.cd')).toHaveCount(2);

    soltar13();
    await expect(rotuloDaData(page)).toContainText('13/11');
    await irPara(page, 'rec');
    await expect(caixaDisponivel(page, 'PR-BTB')).not.toBeChecked();
    await irPara(page, 'alu');
    await page.locator('#s-alu [data-act="adds"]').click();
    await expect.poll(() => cadastroDe(servidor).alunos).toEqual(['Aluno 1000', 'Aluno 1001', 'Novo aluno']);
    expect(servidor.gravacoes.map(g => g.chave)).not.toContain(`dia:${AMANHA}`);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // Duas trocas de data seguidas (o dia 12 e logo o 13): o 13 só é lido depois do 12. Lidos juntos, a resposta atrasada do
  // cadastro do 12 (já com o aluno que uma colega acabou de incluir) deixaria valendo a versão dela, com os dados do 13 na
  // tela, sem o aluno: a alteração seguinte gravaria por cima, sem conflito, e o aluno da colega sumiria
  test('as datas são lidas uma de cada vez: a leitura atrasada de uma troca anterior não apaga o aluno que outra pessoa incluiu', async ({ browser }) => {
    const servidor = criarServidor();
    const contexto = await novoContexto(browser, servidor);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    await entrar(page, CONTAS.operador);
    // A leitura do cadastro da troca para o dia 12 demora
    let soltar12, segurar = true;
    const espera12 = new Promise(resolve => { soltar12 = resolve; });
    await contexto.route(url => url.pathname.endsWith('/rest/v1/documentos') && url.searchParams.get('chave') === 'eq.cadastro', async route => {
      if (segurar) { segurar = false; await espera12; }
      await route.fallback();
    });
    await escolherNoCalendario(page, '2026-11-12');
    await escolherNoCalendario(page, '2026-11-13');
    // O dia 13 espera a leitura do 12
    await page.waitForTimeout(300);
    await expect(rotuloDaData(page)).toContainText('11/11');
    const { conteudo } = servidor.banco.get('cadastro');
    servidor.alterarPorOutraPessoa('cadastro', { ...conteudo, nid: 1003, stu: [...conteudo.stu, { ...conteudo.stu[0], id: 1002, nm: 'Aluno da colega' }] });
    soltar12();
    await expect(rotuloDaData(page)).toContainText('13/11');
    await irPara(page, 'rec');
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect.poll(() => servidor.dias.get('2026-11-13')?.conteudo.av['PR-BTB']).toBe(false);
    expect(cadastroDe(servidor).alunos).toEqual(['Aluno 1000', 'Aluno 1001', 'Aluno da colega']);
    await expect(page.locator('#aviso-sync')).toBeHidden();
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // › duas vezes, rápido: a mesma data pedida duas vezes. A primeira leitura demora e a segunda espera por ela; a data abre
  // e grava (a resposta da primeira, chegando por último, deixaria a tela sem gravar até trocar de data de novo)
  test('a mesma data pedida duas vezes (› duas vezes) abre e grava', async ({ browser }) => {
    const servidor = criarServidor();
    const contexto = await novoContexto(browser, servidor);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    await entrar(page, CONTAS.operador);
    let soltar, segurar = true;
    const espera = new Promise(resolve => { soltar = resolve; });
    await contexto.route(url => url.pathname.endsWith('/rest/v1/dias') && url.searchParams.get('data') === 'eq.2026-11-12', async route => {
      if (segurar) { segurar = false; await espera; }
      await route.fallback();
    });
    await diaSeguinte(page, { esperar: false });
    await diaSeguinte(page, { esperar: false });
    await page.waitForTimeout(300);
    await expect(rotuloDaData(page)).toContainText('11/11');
    soltar();
    await expect(rotuloDaData(page)).toContainText('12/11');
    await irPara(page, 'rec');
    await page.locator('#toast-box').evaluate(caixa => caixa.replaceChildren());
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect.poll(() => servidor.dias.get('2026-11-12')?.conteudo.av['PR-BTB']).toBe(false);
    await expect(page.locator('#toast-box')).not.toContainText(AVISO);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // A conversão dos documentos antigos (de antes da escala por data) para no meio, antes de gravar o cadastro. Nenhuma data
  // abre depois disso: lida, ela viria com o cadastro vazio, e "+ Novo aluno" gravaria esse cadastro (a conversão ficaria
  // por feita, sem os alunos de antes). Recarregando, a conversão termina, com eles
  test('depois de a conversão dos dados antigos falhar, nenhuma data abre e nada é gravado; recarregando, ela termina', async ({ browser }) => {
    const antigo = ApiClient.normalizeAndMigrateState(estado());
    const servidor = criarSupabaseFalso({ documentos: { estado: antigo, escala: runAllocationEngine(antigo) } });
    const contexto = await novoContexto(browser, servidor);
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [400] });
    // A gravação do primeiro dia da conversão é recusada
    servidor.falharGravacoes(1, 400);
    await page.goto(URL_APP);
    await preencherLogin(page, CONTAS.operador);
    await expect(page.locator('#aviso-sync-texto')).toHaveText(FALHA);
    await page.locator('#toast-box').evaluate(caixa => caixa.replaceChildren());
    await diaSeguinte(page, { esperar: false });
    await expect(page.locator('#toast-box .toast')).toHaveText(['Não foi possível abrir essa data. Verifique a conexão e tente de novo.']);
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    await recusada(page, '+ Novo aluno', async () => { await irPara(page, 'alu'); await page.locator('#s-alu [data-act="adds"]').click(); });
    expect(servidor.banco.has('cadastro')).toBe(false);
    expect(servidor.gravacoes.map(g => g.chave)).toEqual([`dia:${AMANHA}`]);

    await page.locator('#btn-recarregar').click();
    await expect(page.locator('body[data-pronto]')).toBeAttached();
    await irPara(page, 'alu');
    await expect(page.locator('#alu tr.cd')).toHaveCount(2);
    expect(cadastroDe(servidor).alunos).toEqual(['Aluno 1000', 'Aluno 1001']);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // No modo local (os dados neste navegador) também. Aqui, o histórico antigo ilegível faz a conversão dos dados antigos
  // falhar: gravar o cadastro do estado inicial marcaria a conversão como feita, e os alunos de antes não voltariam mais.
  // Nenhuma data abre depois disso (ela viria com o cadastro vazio)
  test('modo local: depois de a abertura falhar, nada é gravado; com a conversão consertada, os alunos de antes abrem', async ({ page }) => {
    await page.addInitScript(json => {
      if (localStorage.getItem('acpm3')) return;
      localStorage.setItem('acpm3', json);
      localStorage.setItem('acpm3_audit', '{}');
    }, JSON.stringify(estado()));
    await page.goto('./');
    await expect(page.locator('#aviso-sync-texto')).toHaveText(FALHA);
    await diaSeguinte(page, { esperar: false });
    await expect(page.locator('#toast-box')).toContainText('Não foi possível abrir essa data.');
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    await recusada(page, '+ Novo aluno', async () => { await irPara(page, 'alu'); await page.locator('#s-alu [data-act="adds"]').click(); });
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('acpm4_')))).toEqual([]);

    await page.evaluate(() => localStorage.removeItem('acpm3_audit'));
    await page.reload();
    await expect(page.locator('#alu tr.cd')).toHaveCount(2);
    await expect(page.locator('#aviso-sync')).toBeHidden();
  });
});

// O programa dos cursos (a aba Cursos grava nas tabelas dos cursos), o agendamento na Escala (pela barra, pelo "+" de um
// horário da lista ou de uma linha do mapa, e pelo clique no mapa) e a missão do curso na Demanda também não mudam nada
// com a tela da data anterior: enquanto outra data abre e depois de ela falhar, cada um recusa com o aviso, e a tela fica
// como estava. Com a data aberta, valem de novo
test.describe('Os cursos, o agendamento e a missão do curso: nada muda antes de a data abrir', () => {
  // O PP com duas missões e um Noturno (a lista do trecho). O Aluno 1000, do PP, voa às 06:30 sem a missão do curso (a
  // próxima é a PP-01, e as outras ficam em "Outra missão…"); a Maria Silva, sem curso, não voa
  const PROGRAMA_DO_DIA = {
    PP: [
      { id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local', eq: 'C152', nb: 1 },
      { id: 'PP-02', nome: 'Manobras', mis: 'Voo Local', eq: 'C152', nb: 1 },
      { id: 'NOT', nome: 'Noturno', mis: 'Noturno', eq: 'C172', nb: 1 }
    ],
    PC: [],
    INVA: []
  };
  const estadoDoDia = () => ({
    ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, { p1: 390, p2: -1 }, { curso: 'PP' }), aluno(1001, { fly: false }, { nm: 'Maria Silva' })] }),
    cursos: PROGRAMA_DO_DIA, nid: 1002
  });
  // Amanhã e o dia 12 com a mesma demanda (o dia 12 já gravado, sem o voo que a Maria Silva agenda amanhã)
  const DEPOIS = '2026-11-12';
  function servidorDoDia() {
    const documentos = documentosAtuais(estadoDoDia(), AMANHA);
    return criarSupabaseFalso({ ...documentos, dias: { ...documentos.dias, [DEPOIS]: structuredClone(documentos.dias[AMANHA]) } });
  }

  const cursoPP = page => page.locator('#cursos .curso[data-curso="PP"]');
  const trechoDoNoturno = page => cursoPP(page).locator('[data-cf="trecho"]');
  const pedidoDoAluno = page => page.locator('#dem tr[data-k="d"][data-id="1000"][data-mid="0"]');
  const dialogo = page => page.locator('#dlg-agendar');
  // Uma linha do mapa sem voo nenhum (o clique nela agenda)
  const faixaLivre = page => page.locator('#out .tl-row[data-r]:not(:has(.tl-bar)) .tl-track:not(.inerte)').first();
  async function vistaDaEscala(page, vista) {
    await irPara(page, 'esc');
    await page.locator(`#s-esc [data-tl="${vista}"]`).click();
    await expect(page.locator(vista === 'lista' ? '#out tr.win' : '#out .tl-row').first()).toBeVisible();
  }
  async function agendarAMaria(page) {
    await expect(dialogo(page)).toBeVisible();
    await page.locator('#agd-aluno').selectOption('1001');
    await expect(page.locator('#agd-previa ul')).toContainText('Entra:');
    await page.locator('#agd-confirmar').click();
    await expect(dialogo(page)).toBeHidden();
  }

  async function abrirODia(browser, servidor, opcoes) {
    const contexto = await novoContexto(browser, servidor);
    const page = await contexto.newPage();
    const erros = vigiarErros(page, opcoes);
    await entrar(page, CONTAS.administrador);
    // Na data aberta: a Maria Silva agendada pela barra da Escala (o Histórico desfaz) e o formulário do curso novo aberto,
    // já preenchido
    await irPara(page, 'esc');
    await page.locator('#btn-agendar').click();
    await agendarAMaria(page);
    await expect.poll(() => servidor.historico.map(h => [h.data, h.descricao])).toEqual([[AMANHA, expect.stringMatching(/^Agendado na escala: Maria Silva/)]]);
    await irPara(page, 'cur');
    await page.locator('#cur-novo').click();
    await page.locator('#cur-sigla').fill('MLTE');
    await page.locator('#cur-nome').fill('Multimotor');
    return { contexto, page, erros };
  }

  // Cada entrada com a tela da data anterior
  const ENTRADAS = [
    ['Cursos › + Missão', async page => { await irPara(page, 'cur'); await cursoPP(page).locator('[data-act="missao-nova"]').click(); }],
    ['Cursos › o trecho do Noturno', async page => { await irPara(page, 'cur'); await trechoDoNoturno(page).selectOption('noite'); }],
    ['Cursos › Usar o cronograma do PP', async page => { await irPara(page, 'cur'); await cursoPP(page).locator('[data-act="curso-modelo"]').click(); }],
    ['Cursos › Encerrar o curso', async page => { await irPara(page, 'cur'); await cursoPP(page).locator('[data-act="curso-encerrar"]').click(); }],
    ['Cursos › Criar o curso', async page => { await irPara(page, 'cur'); await page.getByRole('button', { name: 'Criar o curso' }).click(); }],
    ['+ Agendar voo', async page => { await irPara(page, 'esc'); await page.locator('#btn-agendar').click(); }],
    ['o + de um horário da lista', async page => { await vistaDaEscala(page, 'lista'); await page.locator('#out .win-agendar').first().click(); }],
    ['o + de uma linha do mapa', async page => { await vistaDaEscala(page, 'eq'); await page.locator('#out .tl-agendar').first().click(); }],
    ['um clique no mapa', async page => { await vistaDaEscala(page, 'eq'); await faixaLivre(page).click(); }],
    ['Demanda › Usar', async page => { await irPara(page, 'dem'); await pedidoDoAluno(page).locator('[data-act="usar-proxima"]').click(); }],
    ['Demanda › Outra missão do curso', async page => { await irPara(page, 'dem'); await pedidoDoAluno(page).locator('[data-f="outra-missao"]').selectOption('PP-02'); }],
    ['Histórico › Desfazer o agendamento', async page => {
      await abrirHistorico(page);
      await page.locator('#audit-log-list [data-act="rev-log"]').click();
    }]
  ];

  // Todas recusam com o aviso; nada é gravado, e a tela fica como estava
  async function nadaMuda(page, servidor) {
    const antes = { cadastro: cadastroDe(servidor), gravacoes: servidor.gravacoes.length, historico: servidor.historico.length };
    for (const [nome, usar] of ENTRADAS) await recusada(page, nome, () => usar(page));
    await page.locator('#btn-fechar-historico').click();
    await expect(dialogo(page)).toBeHidden();
    await irPara(page, 'cur');
    await expect(cursoPP(page).locator('tbody tr[data-missao]')).toHaveCount(3);
    await expect(trechoDoNoturno(page)).toHaveValue('');
    // Os dois botões que pedem confirmação nem armaram
    await expect(cursoPP(page).locator('[data-act="curso-modelo"]')).not.toHaveText(/^Confirmar/);
    await expect(cursoPP(page).locator('[data-act="curso-encerrar"]')).not.toHaveText(/^Confirmar/);
    await expect(page.locator('#cursos .curso[data-curso="MLTE"]')).toHaveCount(0);
    await expect(page.locator('#cur-sigla')).toHaveValue('MLTE');
    // O que só muda o que se vê não é uma ação e vale também agora: o curso na tela (o formulário aberto continua) e a fase
    // que recolhe e abre
    await page.locator('#cur-ver-PC').click();
    await expect(page.locator('#cursos .curso[data-curso="PC"]')).toBeVisible();
    await expect(cursoPP(page)).toHaveCount(0);
    await page.locator('#cur-ver-PP').click();
    await expect(page.locator('#cur-sigla')).toHaveValue('MLTE');
    const fase = cursoPP(page).locator('[data-recolher-fase]');
    await fase.click();
    await expect(fase).toHaveAttribute('aria-expanded', 'false');
    await expect(cursoPP(page).locator('tbody tr[data-missao]').first()).toBeHidden();
    await fase.click();
    await expect(cursoPP(page).locator('tbody tr[data-missao]')).toHaveCount(3);
    await expect(cursoPP(page).locator('tbody tr[data-missao]').first()).toBeVisible();
    await irPara(page, 'dem');
    await expect(pedidoDoAluno(page).locator('[data-act="usar-proxima"]')).toHaveText('Próxima: PP-01 · Usar');
    await expect(pedidoDoAluno(page).locator('[data-f="outra-missao"]')).toHaveValue('');
    await expect(page.locator('#dem [data-act="usar-fora-da-ordem"]')).toHaveCount(0);
    await vistaDaEscala(page, 'lista');
    await expect(page.locator('#out tbody tr:not(.win)', { hasText: 'Maria Silva' })).toHaveCount(1);
    expect(cadastroDe(servidor)).toEqual(antes.cadastro);
    expect(servidor.gravacoes.length).toBe(antes.gravacoes);
    expect(servidor.historico.length).toBe(antes.historico);
  }

  // Na data nova, as mesmas entradas valem: a missão do curso na Demanda, o programa e o curso novo (nas tabelas dos
  // cursos) e o agendamento, pela barra e pelo clique no mapa
  async function valemNaDataNova(page, servidor) {
    await expect(rotuloDaData(page)).toContainText('12/11');
    const daDataNova = () => servidor.historico.filter(h => h.data === DEPOIS).map(h => h.descricao);
    await irPara(page, 'dem');
    await pedidoDoAluno(page).locator('[data-act="usar-proxima"]').click();
    await expect.poll(daDataNova).toEqual([expect.stringMatching(/^Aluno 1000: PP-01 na demanda/)]);
    await irPara(page, 'cur');
    await trechoDoNoturno(page).selectOption('noite');
    await expect.poll(() => servidor.cursos.find(c => c.sigla === 'PP').missoes.find(m => m.codigo === 'NOT').trecho).toBe('noite');
    await cursoPP(page).locator('[data-act="missao-nova"]').click();
    await expect.poll(() => cadastroDe(servidor).pp).toHaveLength(4);
    await page.getByRole('button', { name: 'Criar o curso' }).click();
    await expect.poll(() => cadastroDe(servidor).cursos).toContain('MLTE v1');
    await irPara(page, 'esc');
    await page.locator('#btn-agendar').click();
    await expect(dialogo(page)).toBeVisible();
    await page.locator('#agd-voltar').click();
    await vistaDaEscala(page, 'eq');
    await faixaLivre(page).click();
    await agendarAMaria(page);
    await expect.poll(daDataNova).toEqual([expect.stringMatching(/^Aluno 1000: PP-01 na demanda/), expect.stringMatching(/Maria Silva/)]);
    expect(servidor.gravacoes.map(g => g.chave)).toContain(`dia:${DEPOIS}`);
  }

  comProgresso('enquanto outra data abre, nenhuma entrada dos cursos, do agendamento ou da missão do curso muda nada; na data nova, valem', async ({ browser }) => {
    const servidor = servidorDoDia();
    const { contexto, page, erros } = await abrirODia(browser, servidor);
    const liberar = servidor.segurarLeiturasDeDias();
    await diaSeguinte(page, { esperar: false });
    await nadaMuda(page, servidor);
    liberar();
    await valemNaDataNova(page, servidor);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  comProgresso('depois de a troca de data falhar, nenhuma entrada dos cursos, do agendamento ou da missão do curso muda nada; abrindo a data, valem', async ({ browser }) => {
    test.slow();
    const servidor = servidorDoDia();
    const { contexto, page, erros } = await abrirODia(browser, servidor, { statusEsperados: [503] });
    // A leitura da data falha, também nas tentativas de novo do supabase-js: a tela continua a da data anterior
    servidor.falhar('/rest/v1/dias', 1000);
    await diaSeguinte(page, { esperar: false });
    await expect(page.locator('#toast-box')).toContainText('Não foi possível abrir essa data.', { timeout: 15000 });
    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    await nadaMuda(page, servidor);
    // O servidor volta: a data abre
    servidor.falhar('/rest/v1/dias', 0);
    await diaSeguinte(page);
    await valemNaDataNova(page, servidor);
    expect(erros).toEqual([]);
    await contexto.close();
  });
});

// O que fica aberto na tela quando os dados de uma data chegam (a abertura ou uma troca de data) passa a mostrar os dados
// dela: a pessoa decide sobre o que está vendo, e o que grava parte do que foi lido
test.describe('O que fica aberto quando a data abre passa a mostrar os dados dela', () => {
  const DEPOIS = '2026-11-12';
  const doC172 = id => instrutor(id, 1, { hab: ['local', 'noturno', 'c172'] });
  // Três instrutores do C172: a fila do C172 é 01, 02, 03 amanhã e 03, 01, 02 no dia 12
  function servidorComFilas() {
    const documentos = documentosAtuais({ ...cenario({ ins: [doC172(1), doC172(2), doC172(3)], stu: [aluno(1000, { p1: 500, p2: -1 })] }), cursos: PROGRAMA, nid: 1001 }, AMANHA);
    const amanha = documentos.dias[AMANHA];
    amanha.filas = { ...(amanha.filas || {}), c172: [1, 2, 3] };
    const depois = structuredClone(amanha);
    depois.filas.c172 = [3, 1, 2];
    return criarSupabaseFalso({ ...documentos, dias: { [AMANHA]: amanha, [DEPOIS]: depois } });
  }
  const filaDoC172 = page => page.locator('#rodizio [data-cat="c172"] li b');

  test('a aba Rodízio aberta numa troca de data mostra as filas da data nova, e o botão age sobre a fila que ela mostra', async ({ browser }) => {
    const servidor = servidorComFilas();
    const contexto = await novoContexto(browser, servidor);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    await entrar(page, CONTAS.operador);
    await irPara(page, 'rod');
    await expect(filaDoC172(page)).toHaveText(['Instrutor 01', 'Instrutor 02', 'Instrutor 03']);
    await diaSeguinte(page);
    await expect(rotuloDaData(page)).toContainText('12/11');
    await expect(filaDoC172(page)).toHaveText(['Instrutor 03', 'Instrutor 01', 'Instrutor 02']);
    // "Subir" o Instrutor 01, o 2º da fila do dia 12: ele passa para 1º
    await page.locator('#rodizio [data-cat="c172"] li[data-id="1"] [data-act="fila-subir"]').click();
    await expect(filaDoC172(page)).toHaveText(['Instrutor 01', 'Instrutor 03', 'Instrutor 02']);
    await expect.poll(() => servidor.dias.get(DEPOIS).conteudo.filas.c172).toEqual([1, 3, 2]);
    await expect.poll(() => servidor.historico.map(h => [h.data, h.descricao])).toEqual([[DEPOIS, 'Rodízio · Voo C172: Instrutor 01 passou para 1º']]);
    expect(servidor.dias.get(AMANHA).conteudo.filas.c172).toEqual([1, 2, 3]);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('a aba Rodízio aberta enquanto a escala abre mostra as filas quando os dados chegam', async ({ browser }) => {
    const servidor = servidorComFilas();
    const contexto = await novoContexto(browser, servidor);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    const liberar = servidor.segurarLeiturasDeDias();
    await page.goto(URL_APP);
    await preencherLogin(page, CONTAS.operador);
    await expect(page.locator('#usuario')).toBeVisible();
    await irPara(page, 'rod');
    await expect(page.locator('#rodizio [data-cat="c172"]')).toContainText('Nenhum instrutor habilitado.');
    liberar();
    await expect(page.locator('body[data-pronto]')).toBeAttached();
    await expect(filaDoC172(page)).toHaveText(['Instrutor 01', 'Instrutor 02', 'Instrutor 03']);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // Os horários são do cadastro, e a data que abre traz o cadastro lido de novo, com a versão dele. O rascunho do editor
  // parte da lista de quando ele abriu: com a lista igual, ele vale na data nova; mudada por outra pessoa, gravá-lo apagaria
  // o horário dela sem conflito (a versão é a nova). Nada é salvo, e o editor fecha com o aviso
  test('o editor dos horários aberto numa troca de data: com a lista igual, Salvar grava; mudada por outra pessoa, nada é salvo', async ({ browser }) => {
    const servidor = servidorComFilas();
    const contexto = await novoContexto(browser, servidor);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    await entrar(page, CONTAS.operador);
    await irParaVista(page, 'rec', 'cadastro');
    const c152 = page.locator('#horarios [data-cat="C152"]');
    const editor = page.locator('#horarios .horarios-editor');
    const doC152 = () => servidor.banco.get('cadastro').conteudo.horarios.C152;
    async function por(hora) {
      await editor.locator('.hr-novo').fill(hora);
      await editor.locator('.hr-novo').press('Enter');
      await expect(editor.locator('.hr-chip', { hasText: hora })).toHaveCount(1);
    }
    // Ninguém mais muda os horários: o rascunho atravessa a troca de data e grava na data nova
    await c152.locator('[data-act="editar-horarios"]').click();
    await por('07:45');
    await diaSeguinte(page);
    await expect(rotuloDaData(page)).toContainText('12/11');
    await editor.locator('[data-act="salvar-horarios"]').click();
    await expect(editor).toHaveCount(0);
    await expect.poll(doC152).toContain(465);
    await expect.poll(() => servidor.historico.map(h => [h.data, h.descricao.split(':')[0]])).toEqual([[DEPOIS, 'Horários de decolagem do C152']]);

    // Outra pessoa põe 09:15 nos horários do C152. O editor, aberto antes, atravessa a volta para amanhã, cuja leitura traz
    // o cadastro com o 09:15
    await c152.locator('[data-act="editar-horarios"]').click();
    await por('08:45');
    const { conteudo } = servidor.banco.get('cadastro');
    servidor.alterarPorOutraPessoa('cadastro', { ...conteudo, horarios: { ...conteudo.horarios, C152: [...conteudo.horarios.C152, 555].sort((a, b) => a - b) } });
    await diaAnterior(page);
    await expect(rotuloDaData(page)).toContainText('11/11');
    await page.locator('#toast-box').evaluate(caixa => caixa.replaceChildren());
    await editor.locator('[data-act="salvar-horarios"]').click();
    await expect(page.locator('#toast-box')).toContainText('Os horários do C152 mudaram depois que o editor abriu: nada foi salvo. Confira a lista e edite de novo.');
    await expect(editor).toHaveCount(0);
    await expect(c152.locator('[data-act="editar-horarios"]')).toBeFocused();
    // A lista, na tela e no servidor, é a de agora: com o 09:15 da outra pessoa, sem o 08:45 do rascunho
    await expect(c152.locator('.hr', { hasText: '09:15' })).toHaveCount(1);
    await expect(c152.locator('.hr', { hasText: '08:45' })).toHaveCount(0);
    expect([doC152().includes(555), doC152().includes(525)]).toEqual([true, false]);
    expect(servidor.historico).toHaveLength(1);
    expect(erros).toEqual([]);
    await contexto.close();
  });
});
