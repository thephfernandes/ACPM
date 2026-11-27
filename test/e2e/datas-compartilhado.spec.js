// Escala por data no modo compartilhado: migração dos documentos antigos no servidor, gestor navegando
// entre as datas sem gravar e autor das alterações no histórico.
import { test, comProgresso, expect, prepararContexto, vigiarErros, irPara, AMANHA, entrar, preencherLogin, URL_APP, alternarDisponivel, appPronto, caixaDisponivel, dataAberta, escolherNoCalendario, mudarData, rotuloDaData, botaoDaData, textoDoProgresso, progressoNaLinha } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, documentosFase3, CONTAS } from './supabase-falso.js';
import { comNomesAntigos } from '../helpers/formato.js';
import { ESQUEMA } from '../../js/migracoes.js';
import { estadoSintetico } from '../helpers/estado.js';
import { aluno } from '../helpers/montar.js';
import { runAllocationEngine } from '../../js/engine.js';
import { ApiClient } from '../../js/storage.js';
import { separar } from '../../js/dias.js';

const DEPOIS = '2026-11-12';
// O programa do PP guardado no cadastro (o de antes do formato dos cursos), que a conversão única leva para as tabelas
const PROGRAMA = { PP: [{ id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local', eq: 'C152', nb: 1 }, { id: 'PP-02', nome: 'Navegação', mis: 'Navegação', eq: 'C152', nb: 2 }], PC: [], INVA: [] };
const doPP = servidor => servidor.cursos.find(c => c.sigla === 'PP');
// As funções do servidor chamadas pela página, na ordem
function funcoesChamadas(page) {
  const chamadas = [];
  page.on('request', r => {
    const { pathname } = new URL(r.url());
    if (pathname.startsWith('/rest/v1/rpc/')) chamadas.push(pathname.slice('/rest/v1/rpc/'.length));
  });
  return chamadas;
}

test.describe('Escala por data (modo compartilhado)', () => {
  test('no primeiro acesso de um operador, os documentos antigos viram o formato por data', async ({ page, context }) => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000), aluno(1001, { p1: 2 })], cursos: PROGRAMA });
    const escala = runAllocationEngine(estado);
    const servidor = await instalarSupabaseFalso(context, {
      documentos: {
        estado,
        escala,
        historico: [{ id: Date.UTC(2026, 10, 10, 13), ts: '10:00:00', type: 'mod', desc: 'Alteração antiga', revert: null }],
        bi: { '2026-11-03': { out: escala.out, tot: 2, rej: 0 }, [AMANHA]: { out: escala.out, tot: 2, rej: 0 } }
      }
    });
    await entrar(page, CONTAS.operador);

    await expect(dataAberta(page)).toHaveAttribute('data-data', AMANHA);
    await irPara(page, 'esc');
    await expect(page.locator('#out table tbody tr')).not.toHaveCount(0);
    await expect(page.locator('#audit-log-list')).toContainText('Alteração antiga');
    await expect(page.locator('#audit-log-list')).toContainText('importado');
    expect(servidor.banco.get('cadastro').conteudo).toEqual({ ...separar(estado).cadastro, esquema: ESQUEMA });
    expect([...servidor.dias.keys()].sort()).toEqual(['2026-11-03', AMANHA]);
    expect(servidor.historico.map(h => [h.descricao, h.importado])).toEqual([['Alteração antiga', true]]);
    expect(servidor.banco.has('estado'), 'os documentos da fase 2 ficam como cópia').toBe(true);
    // O programa do estado vai para as tabelas dos cursos antes do cadastro (que já sai no formato dos cursos)
    expect([doPP(servidor).versao, doPP(servidor).missoes.map(m => m.codigo)]).toEqual([2, ['PP-01', 'PP-02']]);
  });

  test('se o servidor recusar uma gravação da conversão, o app pede para recarregar em vez de abrir o cadastro vazio', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000)] });
    const servidor = await instalarSupabaseFalso(contexto, { documentos: { estado, escala: runAllocationEngine(estado) } });
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [400] });
    servidor.falharGravacoes(1, 400);
    await page.goto(URL_APP);
    await preencherLogin(page, CONTAS.operador);
    await expect(page.locator('#aviso-sync-texto')).toContainText('Não foi possível preparar os dados');
    await expect(page.locator('#inst .cd')).toHaveCount(0);
    expect(servidor.banco.has('cadastro')).toBe(false);

    await page.locator('#btn-recarregar').click();
    await expect(page.locator('#inst .cd').first()).toBeAttached();
    await expect(page.locator('#aviso-sync')).toBeHidden();
    expect(servidor.banco.get('cadastro').conteudo).toEqual({ ...separar(estado).cadastro, esquema: ESQUEMA });
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('com o servidor fora do ar por um instante, a conversão espera e termina sozinha', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000)] });
    const servidor = await instalarSupabaseFalso(contexto, { documentos: { estado, escala: runAllocationEngine(estado) } });
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    servidor.falharGravacoes(1);
    await page.goto(URL_APP);
    await preencherLogin(page, CONTAS.operador);
    await expect(page.locator('#aviso-sync-texto')).toHaveText('Sem conexão com o servidor: gravando de novo assim que a conexão voltar; não feche esta página.');
    await expect(page.locator('#inst .cd').first()).toBeAttached({ timeout: 10000 });
    await expect(page.locator('#aviso-sync')).toBeHidden();
    expect(servidor.banco.get('cadastro').conteudo).toEqual({ ...separar(estado).cadastro, esquema: ESQUEMA });
    expect(erros).toEqual([]);
    await contexto.close();
  });

  // Dados no formato anterior (sem versão, simuladores com os nomes antigos): o dia de amanhã com o SIM-MULTI-2 em
  // manutenção e um dia importado do BI com voo no SIM-MONO-1
  function servidorNoFormatoAnterior() {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000, { mis: 'Simulador', eq: 'Sim. Mono' }, { curso: 'PP' })], cursos: PROGRAMA });
    const { documentos, dias } = documentosFase3(estado, AMANHA);
    const escala = runAllocationEngine(estado);
    return comNomesAntigos({
      documentos,
      dias: {
        [AMANHA]: { ...dias[AMANHA], av: { ...dias[AMANHA].av, 'SIM-MLTE-D': false } },
        '2026-11-03': { importado: true, resultado: { ...escala, rej: 0, data: '2026-11-03' } }
      }
    });
  }

  comProgresso('no primeiro acesso de um operador, os dados no formato anterior são regravados no formato atual', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, servidorNoFormatoAnterior());
    expect(servidor.dias.get('2026-11-03').conteudo.resultado.out[0].r).toBe('SIM-MONO-1');
    const chamadas = funcoesChamadas(page);
    await entrar(page, CONTAS.operador);
    await expect(caixaDisponivel(page, 'SIM-MLTE-D')).not.toBeChecked();
    await expect(caixaDisponivel(page, 'SIM-MULTI-2')).toHaveCount(0);
    // A conversão do programa (importar_cursos) vem depois dos dias e antes do cadastro; ela não é a gravação de um
    // documento, e as gravações continuam as mesmas
    expect(chamadas.filter(f => ['salvar_dia', 'importar_cursos', 'salvar_documento'].includes(f))).toEqual(['salvar_dia', 'salvar_dia', 'importar_cursos', 'salvar_documento']);
    expect(servidor.gravacoes.map(g => g.chave)).toEqual(['dia:2026-11-03', `dia:${AMANHA}`, 'cadastro']);
    expect([doPP(servidor).versao, doPP(servidor).missoes.map(m => [m.codigo, m.nome])]).toEqual([2, [['PP-01', 'Familiarização'], ['PP-02', 'Navegação']]]);
    expect(servidor.banco.get('cadastro').conteudo.cursos, 'o cadastro guarda a cópia do programa').toEqual(PROGRAMA);
    await irPara(page, 'alu');
    await expect.poll(() => textoDoProgresso(page, 1000)).toBe('0/2 · próxima PP-01');
    await expect(page.locator('#aviso-dados')).toBeHidden();
    const amanha = servidor.dias.get(AMANHA).conteudo;
    expect([amanha.esquema, amanha.av['SIM-MLTE-D'], amanha.av['SIM-MONO-A']]).toEqual([ESQUEMA, false, true]);
    expect(Object.keys(amanha.av).filter(r => /^SIM-(MONO|MULTI)-\d$/.test(r))).toEqual([]);
    expect(servidor.dias.get('2026-11-03').conteudo.resultado.out[0].r).toBe('SIM-MONO-A');
    expect(servidor.banco.get('cadastro').conteudo.esquema).toBe(ESQUEMA);
  });

  // Antes da primeira abertura de um Operador, o programa ainda está só no cadastro: a próxima missão e o progresso
  // ficam desligados, e a Gestora vê por quê (na aba Cursos também)
  comProgresso('gestor vê os dados no formato atual antes da atualização, sem gravar nada', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, servidorNoFormatoAnterior());
    const chamadas = funcoesChamadas(page);
    await entrar(page, CONTAS.gestor);
    await expect(caixaDisponivel(page, 'SIM-MLTE-D')).not.toBeChecked();
    const pendentes = 'Os programas dos cursos ainda não foram trazidos do cadastro (isso acontece na primeira abertura de um Operador ou Administrador depois da atualização): a próxima missão e o progresso ficam desligados.';
    await expect(page.locator('#aviso-dados-texto')).toHaveText(pendentes);
    await irPara(page, 'alu');
    await expect(progressoNaLinha(page, 1000)).toHaveCount(0);
    await irPara(page, 'cur');
    await expect(page.locator('#cursos')).toHaveText(pendentes);
    expect(servidor.gravacoes).toEqual([]);
    expect(chamadas).not.toContain('importar_cursos');
    expect(servidor.dias.get(AMANHA).conteudo.esquema).toBeUndefined();
  });

  test('gestor navega entre as datas, sem gravar nada', async ({ page, context }) => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000)] });
    const { documentos, dias } = documentosAtuais(estado, AMANHA);
    const outroDia = structuredClone(dias[AMANHA]);
    outroDia.av['PR-BTB'] = false;
    const servidor = await instalarSupabaseFalso(context, { documentos, dias: { ...dias, [DEPOIS]: outroDia } });

    await entrar(page, CONTAS.gestor);
    await expect(botaoDaData(page)).toBeEnabled();
    await expect(caixaDisponivel(page, 'PR-BTB')).toBeChecked();
    await mudarData(page, DEPOIS);
    await expect(caixaDisponivel(page, 'PR-BTB')).not.toBeChecked();
    expect(servidor.gravacoes).toEqual([]);
    expect(servidor.historico).toEqual([]);
  });

  // Enquanto outra data abre, a tela ainda é a da data anterior, mas o cadastro já foi lido de novo, com a versão atual:
  // gravar nessa hora levaria o cadastro velho por cima do que outra pessoa mudou (o aluno que ela incluiu sumiria). A
  // alteração é recusada, em nenhuma das datas; com a data nova aberta, vale de novo
  test('alteração feita enquanto outra data carrega é recusada: nada é gravado, e o aluno que outra pessoa incluiu fica', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000)], nid: 1001 }, AMANHA));
    await entrar(page, CONTAS.operador);
    const { conteudo } = servidor.banco.get('cadastro');
    servidor.alterarPorOutraPessoa('cadastro', { ...conteudo, nid: 1002, stu: [...conteudo.stu, { ...conteudo.stu[0], id: 1001, nm: 'Aluno da colega' }] });
    const liberar = servidor.segurarLeiturasDeDias();
    await escolherNoCalendario(page, DEPOIS);
    await irPara(page, 'rec');
    await caixaDisponivel(page, 'PR-BTB').click();
    await expect(page.locator('#toast-box')).toContainText('A escala ainda não abriu: nada foi mudado.');
    await expect(caixaDisponivel(page, 'PR-BTB')).toBeChecked();
    liberar();
    await expect(rotuloDaData(page)).toContainText('12/11');
    await alternarDisponivel(page, 'PR-BTB', false);
    await expect.poll(() => servidor.dias.get(DEPOIS)?.conteudo.av['PR-BTB']).toBe(false);
    expect(servidor.gravacoes.map(g => g.chave)).not.toContain(`dia:${AMANHA}`);
    expect(servidor.dias.get(AMANHA).conteudo.av['PR-BTB']).toBe(true);
    expect(servidor.banco.get('cadastro').conteudo.stu.map(s => s.nm)).toEqual(['Aluno 1000', 'Aluno da colega']);
    await expect.poll(() => servidor.historico.map(h => [h.data, h.descricao])).toEqual([[DEPOIS, 'PR-BTB: Manutenção']]);
  });

  test('o histórico mostra quem fez cada alteração', async ({ page, context }) => {
    await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), AMANHA));
    await entrar(page, CONTAS.operador);
    await irPara(page, 'rec');
    await alternarDisponivel(page, 'PR-BTB', false);
    await page.reload();
    await appPronto(page);
    await expect(page.locator('#audit-log-list')).toContainText('Operador de Teste');
    await expect(page.locator('#audit-log-list')).toContainText('PR-BTB: Manutenção');
  });
});
