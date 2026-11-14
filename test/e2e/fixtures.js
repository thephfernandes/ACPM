// Fixtures e utilitários compartilhados pelos testes E2E.
// - Relógio fixo (amanhã = 2026-11-11) para datas determinísticas na escala, no PDF e no BI
// - jsPDF e supabase-js servidos de node_modules e Google Fonts neutralizado: os testes não dependem da rede
// - Qualquer erro de página ou de console falha o teste
import { test as base, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { estadoSintetico } from '../helpers/estado.js';
import { comExemplo } from '../helpers/exemplo.js';

export { expect };

export const AGORA = new Date('2026-11-10T12:00:00-03:00');
export const AMANHA = '2026-11-11';

const LIBS = {
  'jspdf.umd.min.js': fileURLToPath(new URL('../../node_modules/jspdf/dist/jspdf.umd.min.js', import.meta.url)),
  'jspdf.plugin.autotable.min.js': fileURLToPath(new URL('../../node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js', import.meta.url)),
  'supabase.js': fileURLToPath(new URL('../../node_modules/@supabase/supabase-js/dist/umd/supabase.js', import.meta.url))
};

export async function prepararContexto(context) {
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
  context: async ({ context }, use) => {
    await prepararContexto(context);
    await use(context);
  },
  page: async ({ page }, use) => {
    const erros = vigiarErros(page);
    await use(page);
    expect(erros, 'a página não deve registrar erros').toEqual([]);
  }
});

// Abre a aplicação. Com `estado`, grava-o no localStorage antes do primeiro carregamento
// (recarregamentos posteriores mantêm o que a aplicação salvou).
export async function abrir(page, { estado = null, url = './' } = {}) {
  if (estado) {
    await page.addInitScript(json => {
      if (!localStorage.getItem('acpm3')) localStorage.setItem('acpm3', json);
    }, JSON.stringify(estado));
  }
  await page.goto(url);
  // As janelas de operação são desenhadas depois de carregar os dados (mesmo sem nenhum cadastro)
  await expect(page.locator('#wins input[data-a="win"]').first()).toBeAttached();
}

export const abrirSintetico = (page, opts = {}) => abrir(page, { estado: estadoSintetico(), ...opts });

export async function irPara(page, aba) {
  await page.locator(`#nav button[data-t="${aba}"]`).click();
  await expect(page.locator(`#s-${aba}`)).toBeVisible();
}

// Minha conta, Usuários, Tema e Sair ficam no menu da conta, no topo
export async function abrirMenuDaConta(page) {
  await page.locator('#btn-menu-conta').click();
  await expect(page.locator('#menu-conta')).toBeVisible();
}

// Botões "armados" exigem dois cliques (o primeiro muda o texto para "Confirmar …")
export async function confirmar(page, seletor) {
  const botao = page.locator(seletor);
  await botao.click();
  await expect(botao).toHaveText(/^Confirmar/);
  await botao.click();
}

// Cadastro sintético com o dia de exemplo (a demanda do antigo botão "Preencher exemplo")
export const abrirComExemplo = (page, opts = {}) => abrir(page, { estado: comExemplo(estadoSintetico()), ...opts });

// A escala é refeita a cada alteração: basta abrir a aba
export async function abrirEscala(page) {
  await irPara(page, 'esc');
  await expect(page.locator('#out .st')).toBeVisible();
}

// Leitura estruturada da escala renderizada (resumo, alertas, tabela oficial e mapa de ocupação)
export function lerEscala(page) {
  return page.locator('#out').evaluate(out => {
    const txt = el => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
    const tabela = out.querySelector('table');
    return {
      resumo: [...out.querySelectorAll('.st > div')].map(txt),
      alertas: [...out.querySelectorAll('.al')].map(txt),
      linhas: tabela
        ? [...tabela.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => {
            const sel = td.querySelector('select');
            return sel ? `[${sel.value}]` : txt(td);
          }).join(' | '))
        : [],
      mapa: [...out.querySelectorAll('.tl-row')].map(row => ({
        rotulo: txt(row.querySelector('.tl-lbl')),
        barras: [...row.querySelectorAll('.tl-bar')].map(b => `${txt(b.querySelector('.tl-bar-t1'))} / ${txt(b.querySelector('.tl-bar-t2'))}`)
      }))
    };
  });
}

export const json = valor => JSON.stringify(valor, null, 2) + '\n';
