// As funcionalidades que podem ficar desligadas (js/funcionalidades.js): o que sai das telas com o hangar e o progresso nos
// cursos desligados, o que continua e o que fica guardado (ligar de novo traz tudo de volta). Com elas ligadas, os testes
// de cada tela (hangar.spec.js, cursos-no-dia.spec.js, agendamento.spec.js, cursos.spec.js e os outros com comHangar ou
// comProgresso)
import { test, comTodasAsFuncionalidades, expect, irPara, abrirEscala, abrirHistorico, diaSeguinte, entrar, prepararContexto, appPronto, vigiarErros, tabelaDoDia, importarDaAgenda, alternarDisponivel, mudarData, botaoDaData, trilho, avisosDaData, contagemDosAvisos, contagemDoDia, AMANHA } from './fixtures.js';
import { FRASES_DAS_FUNCIONALIDADES, FRASES_SEM_AS_FUNCIONALIDADES } from './manual-frases.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { montarGlossario } from '../../js/glossario.js';
import { cursosIniciais, novoCurso } from '../../js/programa.js';
import { MODELOS } from '../../js/modelos-de-curso.js';
import { FROTA_INICIAL } from '../../js/frota.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const DEPOIS = '2026-11-12';
// O PR-VOB na frente do hangar (a frota começa pelo PP-LJV)
const FROTA = FROTA_INICIAL.filter(f => ['C152', 'C172', 'PA-34'].includes(f.tipo)).map(f => f.reg);
const HANGAR = ['PR-VOB', ...FROTA.filter(r => r !== 'PR-VOB')];

// O PP com o cronograma (os ids são uuids), com as duas primeiras missões: IN-01 e IN-02
function programaPP() {
  let n = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  return { ...novoCurso([], { sigla: 'PP', nome: 'Piloto Privado', modelo: MODELOS['pp-acpm'] }, uuid).curso, versao: 1 };
}
const resultado = (id, alunoId, missao, voo = null) => ({
  id, aluno: alunoId, curso: 'PP', missao, resultado: 'aprovado', data: voo ? AMANHA : '2026-11-09', voo,
  registrado_em: '2026-11-09T12:00:00.000Z', registrado_por: 'Operador 01'
});
// A Maria (PP) voa com a IN-01 no pedido e já tem o resultado dela no voo; o João (PP) voa sem a missão do curso; a Ana
// (PP) não voa. O hangar na ordem de HANGAR
const docs = () => {
  const estado = cenario({
    ins: [instrutor(1, 9), instrutor(2, 9)],
    stu: [aluno(1000, { p1: 390, p2: -1, etapa: 'IN-01', cursoDaEtapa: 'PP' }, { nm: 'Maria', curso: 'PP' }), aluno(1001, { p1: 610, p2: -1 }, { nm: 'João', curso: 'PP' }),
      aluno(1002, { fly: false }, { nm: 'Ana', curso: 'PP' })]
  });
  const { documentos: { cadastro }, dias } = documentosAtuais(estado, AMANHA);
  return {
    acpm4_cadastro: cadastro,
    [`acpm4_dia_${AMANHA}`]: { ...dias[AMANHA], hangar: HANGAR },
    acpm4_cursos: { cursos: cursosIniciais().map(c => (c.sigla === 'PP' ? programaPP() : c)), alteracoes: [] },
    acpm4_resultados: [resultado(1, 1000, 'IN-01', '1000_0_1'), resultado(2, 1001, 'IN-01')]
  };
};
async function abrirCom(page, documentos = docs(), url = './') {
  await page.addInitScript(json => {
    if (localStorage.getItem('acpm4_cadastro')) return;
    for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
  }, JSON.stringify(documentos));
  await page.goto(url);
  await appPronto(page);
}
// Um pedido da agenda para amanhã, na manhã
const solicitacao = (id, stu, nome) => ({
  id, data: AMANHA, aluno: stu, aluno_nome: nome, missao: 'Voo Local', janela: 'manha', horario: null, horas: null, observacao: null, excecao: false,
  registrado_em: '2026-11-10T11:00:00.000Z', registrado_por: 'Secretaria', cancelada_em: null, cancelada_por: null
});
const gravado = (page, data = AMANHA) => page.evaluate(d => JSON.parse(localStorage.getItem(`acpm4_dia_${d}`) || 'null'), data);
const doBanco = (page, chave) => page.evaluate(c => JSON.parse(localStorage.getItem(c)), chave);
const pedido = (page, id, mid = 0) => page.locator(`#dem tr[data-k="d"][data-id="${id}"][data-mid="${mid}"]`);
const voo = (page, nome) => page.locator('#out tbody tr:not(.win)', { hasText: nome });
const avioes = page => page.locator('#out tbody tr:not(.win) .c-aviao').evaluateAll(tds => tds.map(td => td.textContent.trim().split(/\s+/)[0]));
// Uma alteração qualquer (grava o dia): a prioridade do João
async function mudarAPrioridade(page, valor) {
  await irPara(page, 'dem');
  await pedido(page, 1001).locator('[data-f="pr"]').selectOption(String(valor));
  await expect.poll(async () => (await gravado(page)).pedidos[1001].pr).toBe(valor);
}
const rotulosDosGrupos = page => page.locator('#agd-missao optgroup').evaluateAll(gs => gs.map(g => g.label));
const textoDaPagina = page => page.evaluate(() => [...document.body.querySelectorAll(':scope > :not(script)')].map(el => el.textContent).join(' '));

test('o padrão do app: o hangar e o progresso desligados; no localhost, ?funcionalidades= liga', async ({ page }) => {
  await abrirCom(page);
  await irPara(page, 'rec');
  await expect(page.locator('#hangar')).toHaveCount(0);
  await irPara(page, 'alu');
  await expect(page.locator('#alu .progresso')).toHaveCount(0);

  await page.goto('./?funcionalidades=hangar,progresso');
  await appPronto(page);
  await irPara(page, 'rec');
  await expect(page.locator('#hangar li').first()).toHaveAttribute('data-id', 'PR-VOB');
  await irPara(page, 'alu');
  await expect(page.locator('#alu tr[data-id="1001"] .progresso')).toHaveText('1/46 · Fase 1 · próxima IN-02');
});

// A tela, Voltar e a data mudam o endereço (js/endereco.js) sem tirar dele a escolha
test('?funcionalidades= fica no endereço ao trocar de tela e de data, ao voltar e ao recarregar', async ({ page }) => {
  await abrirCom(page, docs(), './?funcionalidades=hangar');
  const conferir = async (tela, data) => {
    await expect(page).toHaveURL(new RegExp(`#/${tela}$`));
    const { searchParams } = new URL(page.url());
    expect([searchParams.get('funcionalidades'), searchParams.get('data')]).toEqual(['hangar', data]);
  };
  await conferir('esc', AMANHA);
  await irPara(page, 'cur');
  await irPara(page, 'rec');
  await conferir('rec', AMANHA);
  await diaSeguinte(page);
  await expect(page).toHaveURL(new RegExp(`data=${DEPOIS}`));
  await conferir('rec', DEPOIS);
  await page.goBack();
  await conferir('cur', DEPOIS);
  await page.goForward();
  await conferir('rec', DEPOIS);
  await page.reload();
  await appPronto(page);
  await conferir('rec', DEPOIS);
  await expect(page.locator('#hangar li').first()).toHaveAttribute('data-id', 'PR-VOB');
});

test.describe('O hangar desligado', () => {
  test.use({ funcionalidades: '' });

  test('em Recursos, sem o painel, e a tabela fica com a largura toda, também no celular', async ({ page }) => {
    await abrirCom(page);
    await irPara(page, 'rec');
    await expect(page.locator('#s-rec .rec-hangar, #hangar, [data-act^="hangar-"]')).toHaveCount(0);
    for (const largura of [1440, 1100, 800, 390]) {
      await page.setViewportSize({ width: largura, height: 800 });
      const [parte, tabela] = await Promise.all([page.locator('#s-rec .rec-dia').boundingBox(), tabelaDoDia(page).boundingBox()]);
      expect(Math.round(tabela.width), `${largura} px`).toBe(Math.round(parte.width));
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${largura} px`).toBeLessThanOrEqual(largura);
    }
  });

  test('em nenhum texto da página: a Escala, as dicas, o glossário e o Manual', async ({ page }) => {
    await abrirCom(page);
    await abrirEscala(page);
    await expect(page.locator('#tempo-parado > div')).toHaveCount(2);
    await expect(page.locator('#tempo-parado')).not.toContainText('hangar');
    for (const tela of ['age', 'dem', 'esc', 'apr', 'alu', 'ins', 'rec', 'cur', 'rod', 'bi']) await irPara(page, tela);
    expect(await textoDaPagina(page)).not.toMatch(/hangar/i);
    expect(await page.locator('[aria-label*="hangar" i], [title*="hangar" i]').count()).toBe(0);
    await expect(page.locator('#glossario-hangar')).toHaveCount(0);
    await expect(page.locator('#glossario-tempo-parado')).toHaveText(montarGlossario(() => false)['tempo-parado'].texto);
  });

  test('a escala segue a ordem da frota; a ordem guardada continua no dia, depois de gravar, recarregar e mudar de data', async ({ page }) => {
    await abrirCom(page);
    await mudarAPrioridade(page, 5);
    await abrirEscala(page);
    expect(await avioes(page)).toEqual(['PP-LJV', 'PP-LJV']);
    expect((await gravado(page)).hangar).toEqual(HANGAR);
    await page.reload();
    await appPronto(page);
    expect(await avioes(page)).toEqual(['PP-LJV', 'PP-LJV']);
    // A data seguinte começa com a mesma ordem, gravada com a primeira alteração dela
    await diaSeguinte(page);
    await irPara(page, 'rec');
    await alternarDisponivel(page, 'PR-VOC', false);
    await expect.poll(async () => (await gravado(page, DEPOIS))?.hangar).toEqual(HANGAR);
    expect((await gravado(page)).hangar).toEqual(HANGAR);
  });
});

// Com a ordem guardada, a data feita com o hangar desligado fica na ordem da frota também depois de passar
test('a data feita na ordem da frota não muda de aviões ao ser alterada no dia seguinte', async ({ page }) => {
  // Os dois voos no mesmo horário, e os aviões do fundo do hangar são os da frente da frota
  const documentos = docs();
  documentos[`acpm4_dia_${AMANHA}`].hangar = [...FROTA].reverse();
  documentos[`acpm4_dia_${AMANHA}`].pedidos[1001].p1 = 390;
  await abrirCom(page, documentos, './?funcionalidades=');
  await mudarAPrioridade(page, 5);
  const gravados = async () => (await gravado(page)).resultado.out.map(o => `${o.s} ${o.r} ${o.a}`).sort();
  const antes = await gravados();
  expect(antes).toHaveLength(2);
  await page.clock.setFixedTime(new Date('2026-11-12T12:00:00-03:00'));
  await page.reload();
  await appPronto(page);
  await mudarData(page, AMANHA);
  await expect(page.locator('#out')).toContainText('Maria');
  await abrirEscala(page);
  await voo(page, 'Maria').locator('select[data-f="fstatus"]').selectOption('Pousou');
  await expect.poll(async () => Object.values((await gravado(page)).fStatus)).toContain('Pousou');
  expect(await gravados()).toEqual(antes);
});

// O agendamento e a escala leem o mesmo estado: numa data sem voos, o recurso sugerido é o primeiro da frota; com o hangar
// ligado, o da frente dele
test('no agendamento, o recurso sugerido também segue a ordem da frota', async ({ page }) => {
  const documentos = docs();
  for (const id of [1000, 1001]) documentos[`acpm4_dia_${AMANHA}`].pedidos[id].fly = false;
  for (const [url, recurso] of [['./?funcionalidades=', 'PP-LJV'], ['./?funcionalidades=hangar', 'PR-VOB']]) {
    await abrirCom(page, documentos, url);
    await irPara(page, 'esc');
    await page.locator('#btn-agendar').click();
    await page.locator('#agd-aluno').selectOption('1002');
    await page.locator('#agd-missao').selectOption('tipo:Voo Local');
    await expect(page.locator('#agd-recurso'), url).toHaveValue(recurso);
  }
});

// A mesma data com tudo ligado: a ordem guardada e o resultado que os testes de cima deixam guardados valem
comTodasAsFuncionalidades('ligados, a ordem guardada vale na escala, e o progresso, a próxima missão e o resultado aparecem', async ({ page }) => {
  await abrirCom(page);
  await mudarAPrioridade(page, 5);
  await expect(pedido(page, 1001).locator('[data-act="usar-proxima"]')).toHaveText('Próxima: IN-02 · Usar');
  await abrirEscala(page);
  expect(await avioes(page)).toEqual(['PR-VOB', 'PR-VOB']);
  await expect(voo(page, 'Maria').locator('[data-resultado]')).toHaveValue('aprovado');
  await irPara(page, 'rec');
  await expect(page.locator('#hangar li').first()).toHaveAttribute('data-id', 'PR-VOB');
});

test.describe('O progresso nos cursos desligado', () => {
  test.use({ funcionalidades: '' });

  test('na Demanda, só o código que o pedido já tem; ele fica guardado com uma alteração e depois de recarregar', async ({ page }) => {
    await abrirCom(page);
    await irPara(page, 'dem');
    if (await page.locator('#onlyfly').isChecked()) await page.locator('#onlyfly').uncheck();
    await expect(pedido(page, 1000).locator('.etapa')).toHaveText('IN-01');
    await expect(pedido(page, 1000).locator('.etapa')).toHaveAttribute('title', 'Missão do curso PP');
    await expect(page.locator('#dem .etapa')).toHaveCount(1);
    await expect(page.locator('#dem [data-act="usar-proxima"], #dem [data-f="outra-missao"], #dem [data-act="usar-fora-da-ordem"]')).toHaveCount(0);
    await expect(page.locator('#s-dem')).not.toContainText('Próxima');
    await mudarAPrioridade(page, 4);
    await pedido(page, 1000).locator('[data-f="pr"]').selectOption('5');
    await expect.poll(async () => (await gravado(page)).pedidos[1000].pr).toBe(5);
    await page.reload();
    await appPronto(page);
    const { etapa, cursoDaEtapa } = (await gravado(page)).pedidos[1000];
    expect([etapa, cursoDaEtapa]).toEqual(['IN-01', 'PP']);
    await irPara(page, 'dem');
    await expect(pedido(page, 1000).locator('.etapa')).toHaveText('IN-01');
  });

  // Um botão ou uma lista que sobrou na tela (uma aba aberta antes) não muda nada
  test('os eventos da próxima missão, das outras e do resultado não fazem nada', async ({ page }) => {
    await abrirCom(page);
    await irPara(page, 'dem');
    const antes = [await gravado(page), await doBanco(page, 'acpm4_resultados')];
    await pedido(page, 1001).evaluate(tr => {
      const celula = tr.querySelector('td');
      for (const act of ['usar-proxima', 'usar-fora-da-ordem']) {
        celula.insertAdjacentHTML('beforeend', `<button type="button" data-act="${act}" data-id="1001" data-mid="0" data-codigo="IN-02">x</button>`);
        celula.lastElementChild.click();
      }
      celula.insertAdjacentHTML('beforeend', '<select data-f="outra-missao"><option value="IN-02" selected>IN-02</option></select>');
      celula.lastElementChild.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.locator('#dem [data-f="outra-missao"]')).toHaveCount(0);
    await abrirEscala(page);
    await voo(page, 'Maria').locator('.c-status').evaluate(td => {
      td.insertAdjacentHTML('beforeend', '<select data-resultado="1000_0_1"><option value="reprovado" selected>Reprovado</option></select>');
      td.lastElementChild.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    expect([await gravado(page), await doBanco(page, 'acpm4_resultados')]).toEqual(antes);
    await abrirHistorico(page);
    await expect(page.locator('#audit-log-list')).not.toContainText('IN-0');
  });

  test('na Escala, o código da missão, sem o resultado (o já registrado continua guardado); o Gestor também', async ({ page }) => {
    await abrirCom(page);
    await abrirEscala(page);
    await expect(voo(page, 'Maria').locator('.c-status .etapa')).toHaveText('IN-01');
    await expect(page.locator('#out [data-resultado], #out .res')).toHaveCount(0);
    await page.goto('./?role=gestor');
    await appPronto(page);
    await expect(voo(page, 'Maria').locator('.c-status .etapa')).toHaveText('IN-01');
    await expect(page.locator('#out [data-resultado], #out .res')).toHaveCount(0);
    expect((await doBanco(page, 'acpm4_resultados')).map(r => r.resultado)).toEqual(['aprovado', 'aprovado']);
  });

  test('em Alunos, o curso sem o progresso; em Cursos, a lista dos alunos pelo nome, e a tela funciona', async ({ page }) => {
    await abrirCom(page);
    await irPara(page, 'alu');
    await expect(page.locator('#alu tr[data-id="1000"] [data-f="curso"]')).toHaveValue('PP');
    await expect(page.locator('#alu .progresso')).toHaveCount(0);
    // O curso continua a mudar em Alunos
    await page.locator('#alu tr[data-id="1002"] [data-f="curso"]').selectOption('PC');
    await page.locator('#alu tr[data-id="1002"] [data-f="curso"]').selectOption('PP');

    await irPara(page, 'cur');
    const pp = page.locator('#cursos .curso[data-curso="PP"]');
    await expect(pp.locator('.fase')).toHaveCount(9);
    const alunos = pp.locator('.alunos-do-curso');
    await alunos.locator('summary').click();
    await expect(alunos.locator('summary')).toHaveText('3 alunos no PP');
    await expect(alunos.locator('li')).toHaveText(['Ana', 'João', 'Maria']);
    await expect(pp.locator('.turma-da-fase, .progresso, .alunos-na-fase')).toHaveCount(0);
    await expect(pp.locator('.indice-das-fases a')).toHaveCount(9);
    // O editor: o nome muda; o código com resultados (ou no pedido da data) fica travado, e o outro muda
    const linha = codigo => pp.locator(`tr:has([data-cf="codigo"][value="${codigo}"])`);
    await expect(linha('IN-01').locator('[data-cf="codigo"]')).toHaveAttribute('readonly', '');
    await linha('IN-02').locator('[data-cf="nome"]').fill('Nome novo');
    await linha('IN-02').locator('[data-cf="nome"]').press('Tab');
    await expect.poll(async () => (await doBanco(page, 'acpm4_cursos')).cursos.find(c => c.sigla === 'PP').missoes.find(m => m.codigo === 'IN-02').nome).toBe('Nome novo');
  });

  test('agendar: sem a missão do curso nem o aviso dos programas; o operador escolhe a missão, e o voo fica agendado', async ({ page }) => {
    await abrirCom(page);
    await abrirEscala(page);
    await page.locator('#btn-agendar').click();
    await expect(page.locator('#agd-aluno')).not.toContainText('próxima');
    await expect(page.locator('#agd-aluno option[value="1002"]')).toHaveText('Ana — PP');
    await page.locator('#agd-aluno').selectOption('1002');
    await expect(page.locator('#agd-aluno-info')).toHaveText('PP');
    await expect(page.locator('#agd-missao-nota')).toBeEmpty();
    await expect(page.locator('#agd-missao option:checked')).toHaveText('Escolha a missão');
    await expect(page.locator('#agd-missao option[value^="missao:"]')).toHaveCount(0);
    expect(await rotulosDosGrupos(page)).toEqual(['Tipos de missão']);
    await page.locator('#agd-missao').selectOption('tipo:Voo Local');
    await expect(page.locator('#agd-previa ul')).toContainText('Entra:');
    await expect(page.locator('#agd-conferencia .agd-bloqueios li, #agd-conferencia .agd-avisos li')).toHaveCount(0);
    await page.locator('#agd-confirmar').click();
    await expect(page.locator('#dlg-agendar')).toBeHidden();
    await expect(voo(page, 'Ana').locator('.fixo')).toHaveAttribute('aria-label', 'Voo fixo: agendado na escala');
    expect((await gravado(page)).pedidos[1002].etapa).toBeUndefined();
  });

  test('agendar: mover o voo com a missão do curso mantém o código dela, também depois de recarregar', async ({ page }) => {
    await abrirCom(page);
    await abrirEscala(page);
    await page.locator('#btn-agendar').click();
    await page.locator('#agd-aluno').selectOption('1000');
    await expect(page.locator('#agd-missao-nota')).toBeEmpty();
    expect(await rotulosDosGrupos(page)).toEqual(['Voos de amanhã do aluno', 'Tipos de missão']);
    const mover = page.locator('#agd-missao option', { hasText: /^Mover/ });
    await expect(mover).toContainText('IN-01');
    await page.locator('#agd-missao').selectOption(await mover.getAttribute('value'));
    await expect(page.locator('#dlg-agendar')).toHaveAccessibleName('Mover o voo');
    await page.locator('#agd-horario').selectOption('760');
    await expect(page.locator('#agd-previa ul')).not.toContainText('calculando');
    await expect(page.locator('#agd-conferencia .agd-bloqueios li, #agd-conferencia .agd-avisos li')).toHaveCount(0);
    await page.locator('#agd-confirmar').click();
    await expect(voo(page, 'Maria').locator('.c-hr')).toContainText('12:40');
    await expect.poll(async () => (await gravado(page)).pedidos[1000].p1).toBe(760);
    await page.reload();
    await appPronto(page);
    const { etapa, cursoDaEtapa } = (await gravado(page)).pedidos[1000];
    expect([etapa, cursoDaEtapa]).toEqual(['IN-01', 'PP']);
    await expect(voo(page, 'Maria').locator('.c-status .etapa')).toHaveText('IN-01');
  });

  // O curso encerrado é do cadastro dos cursos, como em Alunos
  test('agendar: o curso encerrado do aluno continua marcado', async ({ page }) => {
    const documentos = docs();
    documentos.acpm4_cursos.cursos.find(c => c.sigla === 'PP').ativo = false;
    await abrirCom(page, documentos);
    await abrirEscala(page);
    await page.locator('#btn-agendar').click();
    await page.locator('#agd-aluno').selectOption('1002');
    await expect(page.locator('#agd-aluno-info')).toHaveText('PP (encerrado)');
    await page.locator('#agd-aluno').selectOption('1000');
    await expect(page.locator('#agd-aluno-info')).toContainText('PP (encerrado) · já voa amanhã às 06:30');
  });

  // O resultado guardado continua a proteger o voo, mas não aparece: o aviso diz o que fazer, e isso funciona
  test('desfazer um agendamento com resultado: o aviso diz como tirar o voo, e o voo sai', async ({ page }) => {
    const documentos = docs();
    documentos.acpm4_resultados = [];
    await abrirCom(page, documentos);
    await abrirEscala(page);
    await page.locator('#btn-agendar').click();
    await page.locator('#agd-aluno').selectOption('1002');
    await page.locator('#agd-missao').selectOption('tipo:Voo Local');
    await expect(page.locator('#agd-previa ul')).toContainText('Entra:');
    await page.locator('#agd-confirmar').click();
    await expect(voo(page, 'Ana')).toHaveCount(1);
    await expect.poll(async () => (await gravado(page)).pedidos[1002].fly).toBe(true);
    // O resultado que o voo já tinha quando a funcionalidade foi desligada
    const registros = [resultado(1, 1002, 'IN-01', '1002_0_1')];
    await page.evaluate(json => localStorage.setItem('acpm4_resultados', json), JSON.stringify(registros));
    await page.reload();
    await appPronto(page);
    await abrirEscala(page);
    await abrirHistorico(page);
    await page.locator('#audit-log-list .audit-item', { hasText: 'Agendado na escala' }).getByRole('button', { name: '↶ Desfazer' }).click();
    await expect(page.locator('#toast-box')).toContainText('O voo já tem resultado registrado. Para tirar o voo, use Tirar da escala; para mudar, Agendar voo.');
    await page.keyboard.press('Escape');
    await expect(voo(page, 'Ana')).toHaveCount(1);
    await voo(page, 'Ana').getByRole('button', { name: 'Tirar Ana da escala' }).click();
    await expect(voo(page, 'Ana')).toHaveCount(0);
    expect(await doBanco(page, 'acpm4_resultados')).toEqual(registros);
  });

  // A leitura que falhou continua avisada (os códigos com resultados e o desfazer do agendamento dependem dela), sem falar
  // da próxima missão
  test('sem os resultados ou os programas lidos, o aviso diz só o que falta, e "Tentar de novo" lê de novo', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' })] });
    const servidor = await instalarSupabaseFalso(contexto, documentosAtuais(estado, AMANHA));
    servidor.falhar('/rpc/situacao_das_missoes');
    servidor.falhar('/rpc/programa_dos_cursos');
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    await entrar(page, CONTAS.operador);
    const semProgramas = 'Não foi possível ler os programas dos cursos: a tela Cursos fica sem eles.';
    await expect(page.locator('#aviso-dados-texto')).toHaveText(
      `Não foi possível ler os resultados das missões dos cursos: o app não confere se um código do programa ou um voo agendado já tem resultado. ${semProgramas}`);
    // Nos avisos da data, no trilho, o mesmo texto
    await expect(avisosDaData(page, 'Não foi possível ler os resultados')).toHaveText(/o app não confere se um código do programa ou um voo agendado já tem resultado/);
    await expect(avisosDaData(page, /próxima missão/)).toHaveCount(0);
    await irPara(page, 'cur');
    await expect(page.locator('#cursos')).toHaveText(semProgramas);
    await page.locator('#btn-tentar-dados').click();
    await expect(page.locator('#aviso-dados')).toBeHidden();
    await expect(page.locator('#cursos .curso')).toHaveCount(1);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('na agenda, o pedido importado não vira missão do curso, e o que já tem a missão fica com ela', async ({ page }) => {
    const documentos = docs();
    const dia = documentos[`acpm4_dia_${AMANHA}`];
    Object.assign(dia.pedidos[1001], { fly: false });
    documentos.acpm4_agenda = [solicitacao(1, 1000, 'Maria'), solicitacao(2, 1001, 'João')];
    await abrirCom(page, documentos);
    await irPara(page, 'dem');
    await importarDaAgenda(page);
    await expect.poll(async () => (await gravado(page)).pedidos[1001].fly).toBe(true);
    const { pedidos } = await gravado(page);
    expect([pedidos[1000].etapa, pedidos[1000].cursoDaEtapa, pedidos[1001].etapa]).toEqual(['IN-01', 'PP', undefined]);
  });
});

// A linha das etapas (js/linha-do-dia.js), com as tarefas, e os endereços das telas
test.describe('Os dois desligados, na linha, no trilho e no endereço', () => {
  test.use({ funcionalidades: '' });

  // O trilho (o calendário com os pedidos de cada dia, os avisos da data e quantos são) e a Agenda da data aberta. O código
  // da missão que o pedido já tem continua (como na Escala)
  test('o trilho e a Agenda da data aberta não falam deles', async ({ page }) => {
    const documentos = docs();
    documentos.acpm4_agenda = [solicitacao(1, 1000, 'Maria'), solicitacao(2, 1002, 'Ana')];
    await abrirCom(page, documentos);
    const dito = alvo => alvo.evaluate(el => [el.textContent, ...[...el.querySelectorAll('[title], [aria-label]')].flatMap(n => [n.title, n.getAttribute('aria-label')])].join(' '));
    await botaoDaData(page).click();
    await expect(trilho(page)).toBeVisible();
    await expect(contagemDoDia(page, AMANHA)).toHaveText('2');
    await expect(avisosDaData(page, '2 pedidos da agenda ainda não estão na demanda')).toHaveCount(1);
    await expect(contagemDosAvisos(page)).toBeVisible();
    for (const [nome, alvo] of [['trilho', trilho(page)], ['botão da data', botaoDaData(page)]]) {
      expect(await dito(alvo), nome).not.toMatch(/hangar|progresso|próxima|aprovado\b|reprovado/i);
    }
    await irPara(page, 'age');
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(2);
    expect(await dito(page.locator('#s-age'))).not.toMatch(/hangar|progresso|próxima|aprovado\b|reprovado|IN-0/i);
  });

  test('a linha não fala deles, aberta ou recolhida, e um endereço não chega a eles', async ({ page }) => {
    await abrirCom(page);
    const linha = page.locator('#linha');
    const dito = () => linha.evaluate(nav => [nav.textContent, ...[...nav.querySelectorAll('[title], [aria-label]')].flatMap(el => [el.title, el.getAttribute('aria-label')])].join(' '));
    for (const estado of ['recolhida', 'aberta']) {
      if (await linha.getAttribute('data-estado') !== estado) await page.locator('#btn-linha').click();
      await expect(linha).toHaveAttribute('data-estado', estado);
      expect(await dito(), estado).not.toMatch(/hangar|progresso|próxima|aprovado\b|reprovado|IN-0/i);
    }
    for (const [n, endereco] of ['#glossario-hangar', '#glossario-progresso', '#/rec/hangar', '#/alu/1001', '#/cur/PP'].entries()) {
      // Um parâmetro diferente em cada um: só o fragmento diferente não abre o app de novo
      await page.goto(`./?vez=${n}${endereco}`);
      await appPronto(page);
      await expect(page.locator('main#conteudo > section.on'), endereco).toHaveCount(1);
      await expect(page.locator('#hangar, #glossario-hangar, #glossario-progresso, .progresso, .alunos-na-fase, .turma-da-fase'), endereco).toHaveCount(0);
    }
  });
});

test.describe('O Manual e o glossário', () => {
  // O Manual inteiro, com o glossário: só o texto (o que o leitor de tela lê)
  async function manual(page) {
    await abrirCom(page);
    await page.locator('#btn-manual').click();
    await expect(page.locator('#s-manual')).toBeVisible();
    return { texto: await page.locator('#s-manual').innerText(), naPagina: (await page.locator('#s-manual').textContent()).replace(/\s+/g, ' ') };
  }

  test.describe(() => {
    test.use({ funcionalidades: '' });

    test('desligados, o Manual não fala deles, nem em texto escondido', async ({ page }) => {
      const { texto, naPagina } = await manual(page);
      for (const nome of ['hangar', 'progresso']) {
        for (const frase of FRASES_DAS_FUNCIONALIDADES[nome]) expect(naPagina, frase).not.toContain(frase);
        for (const frase of FRASES_SEM_AS_FUNCIONALIDADES[nome]) expect(texto, frase).toContain(frase);
      }
      expect(naPagina).not.toMatch(/hangar|progresso|próxima missão/i);
      await expect(page.locator('[data-funcionalidade]')).toHaveCount(0);
      const glossario = montarGlossario(() => false);
      const termos = await page.locator('#manual-glossario-lista dt').allTextContents();
      expect(termos.sort()).toEqual(Object.values(glossario).map(t => t.termo).sort());
      for (const id of Object.keys(montarGlossario(() => true))) await expect(page.locator(`#glossario-${id}`)).toHaveCount(Object.hasOwn(glossario, id) ? 1 : 0);
      // Nenhum parágrafo ou item ficou vazio
      expect(await page.locator('#s-manual :is(p, li, dd, dt):not(.h)').evaluateAll(nos => nos.filter(n => !n.textContent.trim()).length)).toBe(0);
      await expect(page.locator('#s-manual')).not.toContainText(/ [,;.:)]|\( /);
    });
  });

  comTodasAsFuncionalidades('ligados, o Manual fala deles como antes', async ({ page }) => {
    const { texto, naPagina } = await manual(page);
    for (const nome of ['hangar', 'progresso']) {
      for (const frase of FRASES_DAS_FUNCIONALIDADES[nome]) expect(texto, frase).toContain(frase);
      for (const frase of FRASES_SEM_AS_FUNCIONALIDADES[nome].filter(f => f !== 'e um clique leva à fase')) expect(naPagina, frase).not.toContain(frase);
    }
    await expect(page.locator('[data-sem-funcionalidade]')).toHaveCount(0);
    const glossario = montarGlossario(() => true);
    await expect(page.locator('#manual-glossario-lista dt')).toHaveCount(Object.keys(glossario).length);
    for (const id of Object.keys(glossario)) await expect(page.locator(`#glossario-${id}`)).toHaveText(glossario[id].texto);
  });
});
