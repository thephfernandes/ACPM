// O driver da casca (dono: F1): abrir o app e entrar, as abas, a data em uso, o Histórico, o menu da conta e os
// controles que todas as telas usam (o botão armado, o filtro de vários valores, a tabela sem nenhum com os filtros).
// Os testes chegam a estes controles só por aqui (test/unit/donos-dos-seletores.test.js): quando a casca muda, muda
// este arquivo
import { expect } from '@playwright/test';
import { estadoSintetico } from '../../helpers/estado.js';
import { comExemplo } from '../../helpers/exemplo.js';

// As abas, na ordem do app (o Operador e o Administrador veem todas), e as da Secretaria
export const ABAS = ['age', 'dem', 'esc', 'alu', 'ins', 'rec', 'cur', 'rod', 'bi'];
export const ABAS_DA_SECRETARIA = ['age', 'esc', 'alu', 'ins', 'cur'];

// O app terminou de abrir: os dados da data foram lidos e as telas desenhadas (js/main.js marca body[data-pronto]).
// Antes disso, a tela ainda pode mudar sozinha (a Secretaria, por exemplo, vai para a Agenda). timeout: o do site publicado,
// que pode regravar todos os dias antes de abrir
export async function appPronto(page, { timeout } = {}) {
  await expect(page.locator('body[data-pronto]')).toBeAttached({ timeout });
}

// Abre a aplicação. Com `estado`, grava-o no localStorage antes do primeiro carregamento
// (recarregamentos posteriores mantêm o que a aplicação salvou).
export async function abrir(page, { estado = null, url = './' } = {}) {
  if (estado) {
    await page.addInitScript(json => {
      if (!localStorage.getItem('acpm3')) localStorage.setItem('acpm3', json);
    }, JSON.stringify(estado));
  }
  await page.goto(url);
  await appPronto(page);
}

export const abrirSintetico = (page, opts = {}) => abrir(page, { estado: estadoSintetico(), ...opts });

// Cadastro sintético com a demanda do dia de exemplo
export const abrirComExemplo = (page, opts = {}) => abrir(page, { estado: comExemplo(estadoSintetico()), ...opts });

// O app no modo compartilhado (o servidor falso dos testes, test/e2e/supabase-falso.js)
export const URL_APP = './?supabase=teste';

// Preenche e envia o login, sem esperar o app carregar
export async function preencherLogin(page, conta, senha = conta.senha) {
  await page.locator('#login-email').fill(conta.email);
  await page.locator('#login-senha').fill(senha);
  await page.locator('#btn-entrar').click();
}

// Abre o app no modo compartilhado e entra com a conta. Volta quando o app terminou de carregar os dados da data
export async function entrar(page, conta, { url = URL_APP } = {}) {
  await page.goto(url);
  await preencherLogin(page, conta);
  await appPronto(page);
}

// O link de uma tela na linha ('esc', 'dem'…): o título do cartão da etapa, ou o link dos cadastros, do Rodízio ou do BI
export const botaoDaAba = (page, aba) => page.locator(`#linha a[data-nav][href="#/${aba}"]`);
// Os links das telas na linha, na ordem (com visiveis, só os que aparecem para o perfil)
export const botoesDasAbas = (page, { visiveis = false } = {}) => page.locator(`#linha a[data-nav]${visiveis ? ':visible' : ''}`);
// Os nomes das telas na linha, na ordem (com visiveis, só os das que aparecem)
export const rotulosDasAbas = (page, { visiveis = false } = {}) => page.locator(`#linha a[data-nav]${visiveis ? ':visible' : ''} :is(.estagio-nome, .linha-rotulo)`);
// As telas que aparecem na linha, pelo id ('esc', 'dem'…)
export const abasVisiveis = page => botoesDasAbas(page, { visiveis: true }).evaluateAll(as => as.map(a => a.getAttribute('href').slice(2)));

// Abre a tela pelo link dela na linha (sempre à vista, aberta, recolhida ou na faixa do celular). Com uma gaveta aberta por
// cima da direita da página (o Histórico, os Dados pessoais), o link que ela cobre é alcançado pelo teclado (o foco nele e
// Enter), como faz quem está com a gaveta aberta. Aprovar mostra a Escala (até ter a tela dela)
export async function irPara(page, aba) {
  const link = botaoDaAba(page, aba);
  const coberto = await link.evaluate(a => {
    a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = a.getBoundingClientRect();
    return !a.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  if (coberto) {
    await link.focus();
    await page.keyboard.press('Enter');
  } else await link.click();
  await expect(page.locator(`#s-${aba === 'apr' ? 'esc' : aba}`)).toBeVisible();
}

// Abre uma vista de uma aba (Instrutores e Recursos: 'dia' ou 'cadastro'): a aba e o botão da vista no controle
// segmentado do alto dela. O Playwright só age no que está à vista: o que fica na outra vista pede a troca antes
export async function irParaVista(page, aba, vista) {
  await irPara(page, aba);
  await page.locator(`#s-${aba} [data-vista-${aba}="${vista}"]`).click();
  await expect(page.locator(`#s-${aba}`)).toHaveAttribute('data-vista', vista);
}

// A data em uso: a aberta (body[data-data], a ISO), o botão da data no topo, com o nome ("quarta-feira, 11/11") e o
// "amanhã"/"hoje" ao lado, e o calendário do trilho (os dias, as setas do mês)
export const dataAberta = page => page.locator('body');
export const botaoDaData = page => page.locator('#btn-data');
export const rotuloDaData = page => page.locator('#dt-rotulo');
export const relativoDaData = page => page.locator('#dt-rel');
export const trilho = page => page.locator('#trilho');
export const diaDoCalendario = (page, dia) => page.locator(`#cal .cal-dia[data-dia="${dia}"]`);
export const diasDoCalendario = page => page.locator('#cal .cal-dia');
// O número de pedidos de um dia, e os dias em que o Tab para (um só)
export const contagemDoDia = (page, dia) => diaDoCalendario(page, dia).locator('.cal-qtd');
export const paradasDoCalendario = page => page.locator('#cal .cal-dia[tabindex="0"]');

// Os avisos da data no trilho (com texto, só os que o têm) e quantos são, no botão da data
export const avisosDaData = (page, texto) => page.locator('#avisos-da-data > li', texto === undefined ? {} : { hasText: texto });
export const contagemDosAvisos = page => page.locator('#avisos-cnt');

const ehDomingo = iso => new Date(iso + 'T12:00:00Z').getUTCDay() === 0;
const somarDias = (iso, dias) => new Date(Date.parse(iso + 'T12:00:00Z') + dias * 864e5).toISOString().slice(0, 10);

// Escolhe o dia no calendário do trilho, como quem clica nele (sem esperar a data abrir): solto, o trilho abre pelo botão
// da data; o mês à vista anda pelas setas até o do dia
export async function escolherNoCalendario(page, dia) {
  if (!await trilho(page).isVisible()) await botaoDaData(page).click();
  await expect(trilho(page)).toBeVisible();
  for (let i = 0; i < 24 && !await diaDoCalendario(page, dia).count(); i++) {
    const mes = await trilho(page).getAttribute('data-mes');
    await page.locator(dia.slice(0, 7) < mes ? '#cal-mes-ant' : '#cal-mes-prox').click();
    await expect(trilho(page)).not.toHaveAttribute('data-mes', mes);
  }
  await diaDoCalendario(page, dia).click();
}

// Troca a data aberta pelo trilho e espera ela abrir. Solto, o trilho fecha sozinho quando a data abre
export async function mudarData(page, data) {
  await escolherNoCalendario(page, data);
  await expect(dataAberta(page)).toHaveAttribute('data-data', data);
}

// O dia de operação seguinte e o anterior (o domingo fica de fora), pelo trilho, até ele abrir. esperar: false, sem esperar
// (o teste segura ou derruba a leitura da data)
async function andarDias(page, dias, { esperar = true } = {}) {
  const aberta = await dataAberta(page).getAttribute('data-data');
  let destino = somarDias(aberta, dias);
  if (ehDomingo(destino)) destino = somarDias(destino, dias);
  await (esperar ? mudarData : escolherNoCalendario)(page, destino);
}
export const diaSeguinte = (page, opcoes) => andarDias(page, 1, opcoes);
export const diaAnterior = (page, opcoes) => andarDias(page, -1, opcoes);

// O Histórico da data: o botão no topo e a lista das entradas (com texto, só as que o têm)
export const botaoDoHistorico = page => page.locator('#btn-open-log');
export async function abrirHistorico(page) {
  await botaoDoHistorico(page).click();
}
export const entradasDoHistorico = (page, texto) => page.locator('#audit-log-list .audit-item', texto === undefined ? {} : { hasText: texto });

// Minha conta, Usuários, Tema e Sair ficam no menu da conta, no topo
export const botaoDoMenuDaConta = page => page.locator('#btn-menu-conta');
export async function abrirMenuDaConta(page) {
  await botaoDoMenuDaConta(page).click();
  await expect(page.locator('#menu-conta')).toBeVisible();
}

// Botões "armados" exigem dois cliques (o primeiro muda o texto para "Confirmar …")
export async function confirmar(page, seletor) {
  const botao = page.locator(seletor);
  await botao.click();
  await expect(botao).toHaveText(/^Confirmar/);
  await botao.click();
}

// Um filtro de vários valores (js/views/filtro-multiplo.js; id: o do botão): abre o painel, deixa marcados só os valores
// dados e fecha o painel pelo botão (com fechar: false, ele fica aberto). Sem nenhum, todos desmarcados
export async function marcarNoFiltro(page, id, valores, { fechar = true } = {}) {
  const botao = page.locator(`#${id}`), painel = page.locator(`#${id}-painel`);
  if (await botao.getAttribute('aria-expanded') !== 'true') await botao.click();
  await expect(painel).toBeVisible();
  const mudar = await painel.locator('input[data-filtro]').evaluateAll((caixas, marcar) =>
    caixas.filter(c => c.checked !== marcar.includes(c.dataset.valor)).map(c => c.dataset.valor), valores);
  for (const valor of mudar) await painel.locator(`input[data-valor="${valor}"]`).click();
  await expect(painel.locator('input[data-filtro]:checked')).toHaveCount(valores.length);
  if (!fechar) return;
  await botao.click();
  await expect(painel).toBeHidden();
}

// A tabela que os filtros deixam sem nenhuma linha: a linha que diz por quê; a contagem já escrita (ela espera a
// digitação parar: a tela é conferida com o texto mais longo, "0 de 40 instrutores"; a Demanda, sem aba, não tem); e o
// "Limpar filtros" inteiro na parte à vista da tabela e da tela (a grade do dia e a Demanda, mais largas que o celular,
// rolam para o lado)
export async function nenhumComOsFiltros(page, corpo, aba) {
  await expect(page.locator(`#${corpo} tr.sem-resultado`)).toBeVisible();
  if (aba) await expect(page.locator(`#${aba}-contagem`)).toHaveText(/^0 de \d+ /);
  const fora = await page.locator(`#limpar-filtros-${corpo}`).evaluate(botao => {
    const caixa = botao.getBoundingClientRect(), tabela = botao.closest('.tw');
    const esquerda = tabela.getBoundingClientRect().left + tabela.clientLeft, direita = esquerda + tabela.clientWidth;
    return caixa.left < esquerda || caixa.right > direita || caixa.right > document.documentElement.clientWidth;
  });
  expect(fora, `"Limpar filtros" fora da parte à vista de #${corpo}`).toBe(false);
}
