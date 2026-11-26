// Fixtures e utilitários compartilhados pelos testes E2E.
// - Relógio fixo (amanhã = 2026-11-11) para datas determinísticas na escala, no PDF e no BI
// - jsPDF e supabase-js servidos de node_modules e Google Fonts neutralizado: os testes não dependem da rede
// - As funcionalidades que podem ficar desligadas (js/funcionalidades.js) como no app; um teste escolhe as ligadas com
//   test.use({ funcionalidades: 'hangar,progresso' }) ('' desliga todas), que só valem no localhost
// - Qualquer erro de página ou de console falha o teste
// - Os drivers das telas (test/e2e/telas/*.js), reexportados daqui: os testes chegam aos controles das telas por eles
//   (test/unit/donos-dos-seletores.test.js)
import { test as base, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export { expect };
export * from './telas/casca.js';
export * from './telas/invariantes.js';
export * from './telas/recursos.js';
export * from './telas/instrutores.js';
export * from './telas/alunos.js';
export * from './telas/demanda.js';
export * from './telas/pedidos.js';
export * from './telas/escala.js';
export * from './telas/cursos.js';

export const AGORA = new Date('2026-11-10T12:00:00-03:00');
export const AMANHA = '2026-11-11';

const LIBS = {
  'jspdf.umd.min.js': fileURLToPath(new URL('../../node_modules/jspdf/dist/jspdf.umd.min.js', import.meta.url)),
  'jspdf.plugin.autotable.min.js': fileURLToPath(new URL('../../node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js', import.meta.url)),
  'supabase.js': fileURLToPath(new URL('../../node_modules/@supabase/supabase-js/dist/umd/supabase.js', import.meta.url))
};

// As funcionalidades do teste em andamento (undefined: as do app), para todo contexto que ele prepara, também os que abre à
// parte (browser.newContext)
let funcionalidadesDoTeste;

// preferencias: o trilho solto e a linha recolhida guardados neste navegador, para os testes de cada tela verem a largura de
// sempre; os testes da casca e do trilho (casca.spec.js, trilho.spec.js) usam os padrões do produto (false)
export async function prepararContexto(context, { preferencias = true } = {}) {
  if (funcionalidadesDoTeste !== undefined) {
    await context.addInitScript(lista => { window.FUNCIONALIDADES_LIGADAS = lista; }, funcionalidadesDoTeste);
  }
  if (preferencias) {
    await context.addInitScript(() => {
      try {
        if (!localStorage.getItem('acpm_trilho')) localStorage.setItem('acpm_trilho', '{"media":"solto","larga":"solto"}');
        if (!localStorage.getItem('acpm_linha')) localStorage.setItem('acpm_linha', 'recolhida');
      } catch {
        // Sem o armazenamento do navegador, valem os padrões
      }
    });
  }
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.clock.setFixedTime(AGORA);
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await context.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//, r => {
    const arquivo = LIBS[new URL(r.request().url()).pathname.split('/').pop()];
    // As tags <script> usam integrity + crossorigin: a resposta precisa do cabeçalho CORS, como no cdnjs
    return arquivo
      ? r.fulfill({ path: arquivo, contentType: 'text/javascript; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' } })
      : r.abort();
  });
}

// Respostas HTTP de erro que um teste provoca de propósito (ex.: 400 da senha errada) não contam como erro
export function vigiarErros(page, { statusEsperados = [], ignorar = [] } = {}) {
  const erros = [];
  const esperado = texto => statusEsperados.some(st => texto.includes(`status of ${st}`)) || ignorar.some(r => r.test(texto));
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !esperado(m.text())) erros.push(`console: ${m.text()}`); });
  return erros;
}

export const test = base.extend({
  funcionalidades: [undefined, { option: true }],
  // auto: antes do contexto do teste e dos que ele abre à parte
  funcionalidadesNaPagina: [async ({ funcionalidades }, use) => {
    funcionalidadesDoTeste = funcionalidades;
    await use();
    funcionalidadesDoTeste = undefined;
  }, { auto: true }],
  preferencias: [true, { option: true }],
  context: async ({ context, preferencias }, use) => {
    await prepararContexto(context, { preferencias });
    await use(context);
  },
  page: async ({ page }, use) => {
    const erros = vigiarErros(page);
    await use(page);
    expect(erros, 'a página não deve registrar erros').toEqual([]);
  }
});

// O test com uma funcionalidade ligada, para um teste no meio dos outros (o arquivo inteiro: test.use)
export const comHangar = test.extend({ funcionalidades: ['hangar', { option: true }] });
export const comProgresso = test.extend({ funcionalidades: ['progresso', { option: true }] });
export const comTodasAsFuncionalidades = test.extend({ funcionalidades: ['hangar,progresso', { option: true }] });

export const json = valor => JSON.stringify(valor, null, 2) + '\n';
