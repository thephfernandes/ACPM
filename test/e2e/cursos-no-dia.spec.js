// A missão do curso no dia, com o programa em fases (o cronograma do PP, o modelo do app, com o Noturno em trechos): na
// Demanda, além da próxima missão (Usar), a
// lista "Outra missão do curso" põe outra missão do programa no pedido. A liberada vale na hora; a fora da ordem (a que o
// programa ainda não libera, a já aprovada, a dispensada) pede confirmação num botão que aparece armado, e o histórico
// diz por quê. O pedido guarda o curso da missão (cursoDaEtapa): o resultado vai para ele, mesmo que o aluno troque de
// curso no mesmo dia.
import { test, expect, irPara, abrirEscala, confirmar, AMANHA, appPronto, caixaVoa, campoDoAluno } from './fixtures.js';
import { documentosAtuais } from './supabase-falso.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';
import { cursosIniciais, percursoDoCurso, novoCurso } from '../../js/programa.js';
import { MODELOS } from '../../js/modelos-de-curso.js';

// Com o progresso nos cursos ligado (desligado: funcionalidades.spec.js)
test.use({ funcionalidades: 'progresso' });

// O cronograma do PP (o modelo do app) como as tabelas dos cursos o guardam (neste navegador, acpm4_cursos), na versão 1:
// os ids das fases e das missões são uuids, os únicos que o programa lido aceita
function programaPP() {
  let n = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  return { ...novoCurso([], { sigla: 'PP', nome: 'Piloto Privado', modelo: MODELOS['pp-acpm'] }, uuid).curso, versao: 1 };
}

// As missões do PP na ordem do curso, até esta (inclusive), aprovadas para a Maria
const ORDEM = percursoDoCurso(programaPP()).missoes.map(m => m.codigo);
const aprovadasAte = codigo => ORDEM.slice(0, ORDEM.indexOf(codigo) + 1).map((missao, i) => ({
  id: i + 1, aluno: 1000, curso: 'PP', missao, resultado: 'aprovado', data: '2026-11-09', voo: null,
  registrado_em: '2026-11-09T12:00:00.000Z', registrado_por: 'Operador 01'
}));

// A Maria (PP; nm: outro nome para ela) não voa ainda; o Aluno 1001 não tem curso. O cadastro e o dia já no formato
// atual, os cursos com o PP (encerrado: o PP encerrado na aba Cursos) e os resultados da Maria, neste navegador
async function abrirComOPP(page, { resultados, pedido = {}, fixos = {}, url = './', nm = 'Maria', encerrado = false }) {
  const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { fly: false, p1: 500, p2: -1, ...pedido }, { nm, curso: 'PP' }), aluno(1001, { fly: false })] });
  estado.fixos = fixos;
  const { documentos: { cadastro }, dias } = documentosAtuais(estado, AMANHA);
  const docs = {
    acpm4_cadastro: cadastro,
    [`acpm4_dia_${AMANHA}`]: dias[AMANHA],
    acpm4_cursos: { cursos: cursosIniciais().map(c => (c.sigla === 'PP' ? { ...programaPP(), ...(encerrado ? { ativo: false } : {}) } : c)), alteracoes: [] },
    acpm4_resultados: resultados
  };
  await page.addInitScript(json => {
    if (localStorage.getItem('acpm4_cadastro')) return;
    for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
  }, JSON.stringify(docs));
  await page.goto(url);
  await appPronto(page);
}

const naDemanda = async page => {
  await irPara(page, 'dem');
  if (await page.locator('#onlyfly').isChecked()) await page.locator('#onlyfly').uncheck();
  return page.locator('#dem tr[data-k="d"][data-id="1000"][data-mid="0"]');
};
// O pedido da Maria gravado no dia (a gravação sai logo depois da alteração); o instrutor escolhido, só quando há um
const pedidoGravado = page => page.evaluate(d => {
  const dia = JSON.parse(localStorage.getItem(`acpm4_dia_${d}`) || 'null');
  const p = dia && dia.pedidos[1000];
  return p ? { fly: p.fly, mis: p.mis, eq: p.eq, etapa: p.etapa, cursoDaEtapa: p.cursoDaEtapa, insId: p.insId } : null;
}, AMANHA);
const fixosGravados = page => page.evaluate(d => Object.keys((JSON.parse(localStorage.getItem(`acpm4_dia_${d}`) || '{}').fixos) || {}), AMANHA);
const FORA = 'Fora da ordem (pede confirmação)';

test.describe('Cursos no dia: outra missão do curso', () => {
  test('a liberada vale na hora: o pedido vira a missão do programa, com o curso dela, e o histórico diz', async ({ page }) => {
    // As fases 1 a 4 aprovadas: a NAV-01, a SPIN (livre na Fase 5) e o noturno (depois da Fase 4) estão liberadas
    await abrirComOPP(page, { resultados: aprovadasAte('TMA-05') });
    const linha = await naDemanda(page);
    await expect(linha.locator('[data-act="usar-proxima"]')).toHaveText('Próxima: NAV-01 · Usar');
    const lista = linha.locator('[data-f="outra-missao"]');
    await expect(lista).toHaveAccessibleName('Outra missão do curso para Maria');
    await expect(lista.locator('optgroup[label="Liberadas no PP"] option')).toHaveText([
      'NAV-01 · Navegação · C152 · 01h30 (1,5 h)', 'PE-04 · Parafuso · C152 · 1 h', 'NOT (com TSL-01 e TSL-02) · Noturno · C172 · 4 h'
    ]);
    await expect(lista.locator(`optgroup[label="${FORA}"] option[value="NAV-02"]`)).toHaveText('NAV-02 · Navegação · C152 · 01h30 (1,5 h) (falta NAV-01)');
    await expect(lista.locator(`optgroup[label="${FORA}"] option[value="IN-01"]`)).toHaveText('IN-01 · Voo Local · C152 · 1 h (já aprovada)');
    // O aluno sem curso não tem a lista
    await expect(page.locator('#dem tr[data-id="1001"] [data-f="outra-missao"]')).toHaveCount(0);

    // O Noturno vai pela noite (o NOT), com os translados: o pedido Noturno, com as 4 h do dia
    await lista.selectOption('NOT');
    await expect(linha.locator('.etapa')).toHaveText('NOT');
    await expect(linha.locator('.etapa')).toHaveAttribute('title', 'Missão do curso PP');
    await expect(caixaVoa(linha)).toBeChecked();
    await expect(linha.locator('[data-f="mis"]')).toHaveValue('Noturno');
    await expect(linha.locator('[data-f="eq"]')).toHaveValue('C172');
    await expect(linha.locator('[data-act="usar-fora-da-ordem"]')).toHaveCount(0);
    // A missão do pedido sai da lista dele; as outras liberadas continuam
    await expect(linha.locator('[data-f="outra-missao"] optgroup[label="Liberadas no PP"] option')).toHaveText([
      'NAV-01 · Navegação · C152 · 01h30 (1,5 h)', 'PE-04 · Parafuso · C152 · 1 h'
    ]);
    await expect(page.locator('#audit-log-list')).toContainText('Maria: NOT na demanda (Noturno · C172 · 4 h)');
    await expect.poll(() => pedidoGravado(page)).toEqual({ fly: true, mis: 'Noturno', eq: 'C172', etapa: 'NOT', cursoDaEtapa: 'PP' });
  });

  test('a fora da ordem pede confirmação: o botão aparece armado, o segundo acionamento põe a missão e o histórico diz por quê', async ({ page }) => {
    // Falta a TMA-05: a Fase 5 ainda não abriu, e a SPIN (livre na fase) espera por ela
    await abrirComOPP(page, { resultados: aprovadasAte('TMA-04') });
    const linha = await naDemanda(page);
    await expect(linha.locator('[data-act="usar-proxima"]')).toHaveText('Próxima: TMA-05 · Usar');
    const lista = linha.locator('[data-f="outra-missao"]');
    await expect(lista.locator('optgroup[label="Liberadas no PP"] option')).toHaveText(['TMA-05 · Voo Local · C152 · 1 h']);
    await expect(lista.locator(`optgroup[label="${FORA}"] option[value="PE-04"]`)).toHaveText('PE-04 · Parafuso · C152 · 1 h (falta TMA-05)');

    await lista.selectOption('PE-04');
    const botao = linha.locator('[data-act="usar-fora-da-ordem"]');
    await expect(botao).toHaveText('Confirmar: PE-04 fora da ordem');
    await expect(botao).toBeFocused();
    await expect(botao).toHaveAccessibleName('Confirmar: PE-04 fora da ordem: Usar PE-04 fora da ordem para Maria (falta TMA-05)');
    // Ainda nada mudou: o pedido não tem a missão, e o histórico não registrou
    await expect(linha.locator('.etapa')).toHaveCount(0);
    await expect(caixaVoa(linha)).not.toBeChecked();
    await expect(page.locator('#audit-log-list')).not.toContainText('PE-04');

    // O segundo acionamento (o Enter no botão em foco) confirma
    await page.keyboard.press('Enter');
    await expect(linha.locator('.etapa')).toHaveText('PE-04');
    await expect(linha.locator('[data-f="mis"]')).toHaveValue('Parafuso');
    await expect(linha.locator('[data-act="usar-fora-da-ordem"]')).toHaveCount(0);
    await expect(page.locator('#audit-log-list')).toContainText('Maria: PE-04 na demanda, fora da ordem (falta TMA-05)');
    await expect.poll(() => pedidoGravado(page)).toEqual({ fly: true, mis: 'Parafuso', eq: 'C152', etapa: 'PE-04', cursoDaEtapa: 'PP' });
  });

  test('escolher outra da lista troca a escolha que espera confirmação; a liberada não pede', async ({ page }) => {
    await abrirComOPP(page, { resultados: aprovadasAte('TMA-04') });
    const linha = await naDemanda(page);
    await linha.locator('[data-f="outra-missao"]').selectOption('PE-04');
    await expect(linha.locator('[data-act="usar-fora-da-ordem"]')).toHaveText('Confirmar: PE-04 fora da ordem');
    await linha.locator('[data-f="outra-missao"]').selectOption('IN-01');
    await expect(linha.locator('[data-act="usar-fora-da-ordem"]')).toHaveCount(1);
    await expect(linha.locator('[data-act="usar-fora-da-ordem"]')).toHaveText('Confirmar: IN-01 fora da ordem');
    await linha.locator('[data-f="outra-missao"]').selectOption('TMA-05');
    await expect(linha.locator('.etapa')).toHaveText('TMA-05');
    await expect(linha.locator('[data-act="usar-fora-da-ordem"]')).toHaveCount(0);
    await expect(page.locator('#audit-log-list')).toContainText('Maria: TMA-05 na demanda (Voo Local · C152 · 1 h)');
    await expect(page.locator('#audit-log-list')).not.toContainText('fora da ordem');
  });

  test('a outra missão solta o voo agendado do pedido, e o histórico diz; o instrutor escolhido continua', async ({ page }) => {
    const fixos = { '1000_0_1': { a: 610, b: 670, r: 'PR-VOB', insId: 1, agendado: true } };
    await abrirComOPP(page, { resultados: aprovadasAte('TMA-05'), pedido: { fly: true, p1: 610, insId: 1 }, fixos });
    await abrirEscala(page);
    const voo = page.locator('#out tbody tr:not(.win)', { hasText: 'Maria' });
    await expect(voo.locator('.fixo')).toHaveAttribute('aria-label', 'Voo fixo: agendado na escala');
    const linha = await naDemanda(page);
    await linha.locator('[data-f="outra-missao"]').selectOption('PE-04');
    await expect(page.locator('#audit-log-list')).toContainText('Maria: PE-04 na demanda (Parafuso · C152 · 1 h) (deixa de ser fixo)');
    await expect.poll(() => fixosGravados(page)).toEqual([]);
    await expect.poll(() => pedidoGravado(page)).toEqual({ fly: true, mis: 'Parafuso', eq: 'C152', etapa: 'PE-04', cursoDaEtapa: 'PP', insId: 1 });
    await abrirEscala(page);
    await expect(voo.locator('.fixo')).toHaveCount(0);
  });

  // O nome comprido quebra em palavras, e a célula do aluno ainda leva o código (ou a próxima missão), a lista e o
  // "+ missão": eles descem para baixo do nome, e as 10 colunas continuam cabendo na tela (antes, a tabela passava dela)
  test('com o nome comprido, a tabela da Demanda continua cabendo na tela', async ({ page }) => {
    await abrirComOPP(page, { resultados: aprovadasAte('TMA-05'), nm: 'Maximiliano Bartholomeu Vasconcellos' });
    const linha = await naDemanda(page);
    await expect(linha.locator('[data-f="outra-missao"]')).toBeVisible();
    const cabe = () => page.evaluate(() => document.querySelector('#s-dem .tw').scrollWidth <= document.querySelector('#s-dem .tw').clientWidth);
    expect(await cabe()).toBe(true);
    await linha.locator('[data-f="outra-missao"]').selectOption('NOT');
    await expect(linha.locator('.etapa')).toHaveText('NOT');
    expect(await cabe()).toBe(true);
  });

  test('no Gestor, nem a próxima missão nem a lista aparecem', async ({ page }) => {
    await abrirComOPP(page, { resultados: aprovadasAte('TMA-05'), url: './?role=gestor' });
    const linha = await naDemanda(page);
    await expect(linha.locator('[data-f="outra-missao"]')).toBeHidden();
    await expect(linha.locator('[data-act="usar-proxima"]')).toBeHidden();
  });

  // O curso encerrado é uma das regras do curso que pedem confirmação (desenho §4.9), na Demanda como no agendamento:
  // Usar e as liberadas também pedem, e o histórico diz que o curso estava encerrado
  test('no curso encerrado, Usar e as liberadas pedem confirmação, e o histórico diz que o curso estava encerrado', async ({ page }) => {
    await abrirComOPP(page, { resultados: aprovadasAte('TMA-05'), encerrado: true });
    const linha = await naDemanda(page);
    const usar = linha.locator('[data-act="usar-proxima"]');
    await expect(usar).toHaveText('Próxima: NAV-01 · Usar');
    await expect(usar).toHaveAttribute('title', /\(curso PP encerrado: pede confirmação\)$/);
    // O primeiro clique arma o botão; nada muda ainda
    await usar.click();
    await expect(usar).toHaveText('Confirmar: NAV-01 do curso encerrado');
    await expect(linha.locator('.etapa')).toHaveCount(0);
    await expect(caixaVoa(linha)).not.toBeChecked();
    await expect(page.locator('#audit-log-list')).not.toContainText('NAV-01');
    await usar.click();
    await expect(linha.locator('.etapa')).toHaveText('NAV-01');
    await expect(page.locator('#audit-log-list')).toContainText('Maria: NAV-01 na demanda (Navegação · C152 · 01h30 (1,5 h)), com o curso PP encerrado');
    await expect.poll(() => pedidoGravado(page)).toEqual({ fly: true, mis: 'Navegação', eq: 'C152', etapa: 'NAV-01', cursoDaEtapa: 'PP' });

    // "Outra missão…": a liberada também pede confirmação, num botão que aparece armado
    const lista = linha.locator('[data-f="outra-missao"]');
    await expect(lista.locator('optgroup').first()).toHaveAttribute('label', 'Liberadas no PP (curso encerrado: pede confirmação)');
    await lista.selectOption('PE-04');
    const botao = linha.locator('[data-act="usar-fora-da-ordem"]');
    await expect(botao).toHaveText('Confirmar: PE-04 do curso encerrado');
    await expect(botao).toBeFocused();
    await expect(botao).toHaveAccessibleName('Confirmar: PE-04 do curso encerrado: Usar PE-04 do curso encerrado para Maria (curso PP encerrado)');
    await expect(linha.locator('.etapa')).toHaveText('NAV-01');
    await page.keyboard.press('Enter');
    await expect(linha.locator('.etapa')).toHaveText('PE-04');
    await expect(page.locator('#audit-log-list')).toContainText('Maria: PE-04 na demanda (Parafuso · C152 · 1 h), com o curso PP encerrado');

    // A fora da ordem diz os dois motivos
    await lista.selectOption('IN-01');
    await expect(botao).toHaveText('Confirmar: IN-01 fora da ordem');
    await expect(botao).toHaveAccessibleName('Confirmar: IN-01 fora da ordem: Usar IN-01 fora da ordem para Maria (já aprovada; curso PP encerrado)');
    await page.keyboard.press('Enter');
    await expect(linha.locator('.etapa')).toHaveText('IN-01');
    await expect(page.locator('#audit-log-list')).toContainText('Maria: IN-01 na demanda, fora da ordem (já aprovada), com o curso PP encerrado');
  });
});

test.describe('Cursos no dia: o curso da missão no pedido', () => {
  test('Usar põe o curso da missão no pedido; o aluno troca de PP para PC, e o resultado vai para o PP', async ({ page }) => {
    await abrirComOPP(page, { resultados: aprovadasAte('TMA-05') });
    const linha = await naDemanda(page);
    await linha.locator('[data-act="usar-proxima"]').click();
    await expect(linha.locator('.etapa')).toHaveText('NAV-01');
    await expect.poll(() => pedidoGravado(page)).toEqual({ fly: true, mis: 'Navegação', eq: 'C152', etapa: 'NAV-01', cursoDaEtapa: 'PP' });

    // A Maria passa para o PC no mesmo dia: o pedido continua com a missão do PP
    await irPara(page, 'alu');
    await (await campoDoAluno(page, 1000, 'curso')).selectOption('PC');
    await expect(page.locator('#audit-log-list')).toContainText('Curso de Maria: PC');
    await naDemanda(page);
    await expect(linha.locator('.etapa')).toHaveAttribute('title', 'Missão do curso PP');
    // O PC não tem programa: nem a próxima missão nem a lista
    await expect(linha.locator('[data-act="usar-proxima"], [data-f="outra-missao"]')).toHaveCount(0);

    await abrirEscala(page);
    const voo = page.locator('#out tbody tr:not(.win)', { hasText: 'Maria' });
    await expect(voo.locator('.c-status .etapa')).toHaveText('NAV-01');
    await voo.locator('[data-resultado]').selectOption('aprovado');
    await expect(page.locator('#audit-log-list')).toContainText('Resultado de Maria em NAV-01: aprovado');
    const ultimo = () => page.evaluate(() => {
      const r = (JSON.parse(localStorage.getItem('acpm4_resultados')) || []).at(-1);
      return r && [r.aluno, r.curso, r.missao, r.resultado, r.voo];
    });
    await expect.poll(ultimo).toEqual([1000, 'PP', 'NAV-01', 'aprovado', '1000_0_1']);
    await expect(voo.locator('[data-resultado]')).toHaveValue('aprovado');
  });

  test('o recurso mudado à mão tira o código e o curso da missão do pedido; "Limpar demanda" também', async ({ page }) => {
    await abrirComOPP(page, { resultados: aprovadasAte('TMA-05') });
    const linha = await naDemanda(page);
    await linha.locator('[data-act="usar-proxima"]').click();
    await expect.poll(() => pedidoGravado(page)).toEqual({ fly: true, mis: 'Navegação', eq: 'C152', etapa: 'NAV-01', cursoDaEtapa: 'PP' });
    await linha.locator('[data-f="eq"]').selectOption('C172');
    await expect(linha.locator('.etapa')).toHaveCount(0);
    await expect.poll(() => pedidoGravado(page)).toEqual({ fly: true, mis: 'Navegação', eq: 'C172' });

    await linha.locator('[data-f="outra-missao"]').selectOption('NOT');
    await expect.poll(() => pedidoGravado(page)).toEqual({ fly: true, mis: 'Noturno', eq: 'C172', etapa: 'NOT', cursoDaEtapa: 'PP' });
    await page.locator('#btn-mais-dem').click();
    await confirmar(page, '#clr');
    await expect(linha.locator('.etapa')).toHaveCount(0);
    await expect.poll(() => pedidoGravado(page)).toEqual({ fly: false, mis: 'Voo Local', eq: 'C152' });
  });
});
