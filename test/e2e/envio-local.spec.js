import { test, expect, irPara, preencherLogin, URL_APP, linhasDosAlunos } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';
import { aluno } from '../helpers/montar.js';


// Dados que o operador já tinha no navegador (modo local) antes de existir o servidor
function dadosLocais() {
  const estado = estadoSintetico();
  estado.stu = [aluno(1000), aluno(1001), aluno(1002)];
  return {
    acpm3: estado,
    acpm3_audit: [{ id: 1, ts: '10:00:00', type: 'inc', desc: 'Aluno cadastrado: Aluno 1000', revert: null }],
    acpm3_bi: { '2026-11-09': { out: [], tot: 0, rej: 0 } }
  };
}

async function abrirComDadosLocais(page, dados) {
  await page.addInitScript(json => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    for (const [chave, valor] of Object.entries(JSON.parse(json))) localStorage.setItem(chave, JSON.stringify(valor));
  }, JSON.stringify(dados));
  await page.goto(URL_APP);
}

test.describe('Envio dos dados do navegador para o servidor', () => {
  test('operador com dados no navegador e servidor vazio: envia e passa a usar os dados do servidor', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context);
    await abrirComDadosLocais(page, dadosLocais());
    await preencherLogin(page, CONTAS.operador);

    await expect(page.locator('#envio-local')).toBeVisible();
    await expect(page.locator('#envio-local')).toContainText('40 instrutores e 3 alunos');
    await expect(page.locator('#linha')).toBeHidden();
    await page.locator('#btn-enviar-local').click();

    await expect(page.locator('#linha')).toBeVisible();
    await expect.poll(() => servidor.banco.get('cadastro') && servidor.banco.get('cadastro').conteudo.stu.length).toBe(3);
    expect([...servidor.dias.keys()].sort()).toEqual(['2026-11-09', '2026-11-11']);
    expect(servidor.historico.filter(h => h.importado).map(h => h.descricao)).toEqual(['Aluno cadastrado: Aluno 1000']);
    expect(servidor.banco.has('estado'), 'o servidor recebe só o formato por data').toBe(false);
    await irPara(page, 'alu');
    await expect(linhasDosAlunos(page)).toHaveCount(3);
  });

  test('"Começar sem eles" não envia nada', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context);
    await abrirComDadosLocais(page, dadosLocais());
    await preencherLogin(page, CONTAS.operador);
    await page.locator('#btn-ignorar-local').click();
    await expect(page.locator('#linha')).toBeVisible();
    await irPara(page, 'alu');
    await expect(linhasDosAlunos(page)).toHaveCount(0);
    expect(servidor.banco.has('cadastro')).toBe(false);
  });

  test('servidor que já tem a escala: não pergunta e usa os dados do servidor', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais(estadoSintetico(), '2026-11-11'));
    await abrirComDadosLocais(page, dadosLocais());
    await preencherLogin(page, CONTAS.operador);
    await expect(page.locator('#linha')).toBeVisible();
    await expect(page.locator('#envio-local')).toBeHidden();
    await irPara(page, 'alu');
    await expect(linhasDosAlunos(page)).toHaveCount(0);
    expect(servidor.gravacoes).toEqual([]);
  });

  test('gestor não recebe a pergunta (não pode gravar)', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context);
    await abrirComDadosLocais(page, dadosLocais());
    await preencherLogin(page, CONTAS.gestor);
    await expect(page.locator('#linha')).toBeVisible();
    await expect(page.locator('#envio-local')).toBeHidden();
    expect(servidor.gravacoes).toEqual([]);
  });
});
