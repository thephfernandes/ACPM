// Agenda de Solicitações no modo compartilhado: a Secretaria registra pedidos (a escala ela só consulta), o
// Operador usa a exceção da coordenação e o Gestor só consulta. O servidor falso aplica o mesmo prazo do banco.
import { test, expect } from './fixtures.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';
import { aluno } from '../helpers/montar.js';
import { AMANHA } from './fixtures.js';

const comAlunos = () => documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000), aluno(1001)] }, AMANHA);

async function entrar(page, conta) {
  await page.goto('./?supabase=teste');
  await page.locator('#login-email').fill(conta.email);
  await page.locator('#login-senha').fill(conta.senha);
  await page.locator('#btn-entrar').click();
  await expect(page.locator('#usuario')).toBeVisible();
}

test.describe('Agenda de Solicitações (modo compartilhado)', () => {
  test('a Secretaria abre na agenda, registra pedidos e só consulta a escala', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    await entrar(page, CONTAS.secretaria);
    await expect(page.locator('#usuario')).toHaveText('Secretaria de Teste · Secretaria');
    await expect(page.locator('#s-age')).toBeVisible();
    await expect(page.locator('#ag-aluno option', { hasText: 'Aluno 1001' })).toHaveCount(1);

    await page.locator('#ag-aluno').selectOption({ label: 'Aluno 1001' });
    await page.locator('#ag-janela').selectOption('tarde');
    await page.locator('#ag-por').fill('Maria');
    await page.locator('#form-agenda [type="submit"]').click();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    const pedido = page.locator('#agenda-lista tbody tr').first();
    await expect(pedido.locator('.por')).toHaveText('Maria');
    await expect(pedido.locator('.por')).toHaveAttribute('title', 'Conta: Secretaria de Teste');
    await expect(pedido.locator('.situacao')).toHaveText('Ainda não importado');
    await expect(page.locator('#agenda-importar')).toBeHidden();
    expect(servidor.solicitacoes.map(s => [s.data, s.aluno, s.janela, s.registrado_por, s.usuario])).toEqual([[AMANHA, 1001, 'tarde', 'Maria', CONTAS.secretaria.id]]);

    await page.locator('#agenda-cal [data-dia="2026-11-10"]').click();
    await expect(page.locator('#form-agenda [type="submit"]')).toBeDisabled();
    await expect(page.locator('#ag-excecao')).toBeHidden();

    // Ela vê a Agenda e a Escala (que só consulta) e, pelos dados pessoais, Instrutores e Alunos (fase 9)
    await expect(page.locator('#nav button:visible .aba-rotulo')).toHaveText(['Escala', 'Agenda', 'Instrutores', 'Alunos']);
    await page.locator('#nav button[data-t="esc"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-role', 'gestor');
    expect(servidor.gravacoes).toEqual([]);
  });

  test('o Operador registra fora do prazo pela exceção da coordenação', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    await entrar(page, CONTAS.operador);
    await page.locator('#nav button[data-t="age"]').click();
    await page.locator('#agenda-cal [data-dia="2026-11-10"]').click();
    await page.locator('#ag-aluno').selectOption({ label: 'Aluno 1000' });
    await page.locator('#ag-por').fill('Coordenação');
    await page.locator('#ag-excecao').click();
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('Exceção da coordenação');
    expect(servidor.solicitacoes.map(s => [s.data, s.excecao])).toEqual([['2026-11-10', true]]);
  });

  test('o Gestor vê a agenda, sem registrar nem cancelar', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, comAlunos());
    servidor.solicitacoes.push({ id: 1, data: AMANHA, aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Voo Local', janela: 'manha', horario: null,
      observacao: null, registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: 'Secretaria de Teste', excecao: false, cancelada_em: null, cancelada_por: null });
    await entrar(page, CONTAS.gestor);
    await page.locator('#nav button[data-t="age"]').click();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await expect(page.locator('#form-agenda')).toBeHidden();
    await expect(page.locator('#agenda-lista [data-act="cancelar-pedido"]')).toBeHidden();
  });
});
