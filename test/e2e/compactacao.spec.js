// Compactação da escala (fase 13): embaixo da barra da Escala, o operador escolhe o que pesa mais nos buracos do dia
// (INVA, Avião ou Maior buraco) e até onde os horários mudam (na disponibilidade, só 1ª e 2ª preferência, ou não
// mudam); a escala é refeita na hora e o tempo parado, ao lado do resumo, mostra o efeito. Os critérios ficam com o dia; com a
// escala aprovada e no Gestor, só aparecem
import { test, expect, abrir, abrirEscala, confirmar } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

// Um instrutor: às 06:30 (o aluno 1000 só pode nessa hora) e o aluno 1001, que pediu 13:40 e pode a qualquer hora
const dia = () => cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { p1: 390, p2: -1, jan: 'h390' }), aluno(1001, { p1: 820, p2: -1 })] });
const linha = (page, nome) => page.locator('#out tbody tr:not(.win)', { hasText: nome });
const botao = (page, nome) => page.locator('#compactacao').getByRole('button', { name: nome, exact: true });

test.describe('Compactação da escala', () => {
  test('o padrão fecha o buraco do instrutor; "Não mudar" volta o voo para a 1ª preferência; o critério fica com o dia', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirEscala(page);
    await expect(botao(page, 'INVA')).toHaveAttribute('aria-pressed', 'true');
    await expect(botao(page, 'Na disponibilidade')).toHaveAttribute('aria-pressed', 'true');
    await expect(linha(page, 'Aluno 1001').locator('.c-hr')).toContainText('08:20–09:20');
    await expect(linha(page, 'Aluno 1001').locator('.c-hr')).toContainText('horário ajustado');
    await expect(page.locator('#tempo-parado > div')).toHaveText(['0h50 INVAs parados', '0h50 aviões parados', '1 saída do hangar']);

    await botao(page, 'Não mudar').click();
    await expect(botao(page, 'Não mudar')).toHaveAttribute('aria-pressed', 'true');
    await expect(linha(page, 'Aluno 1001').locator('.c-hr')).toContainText('13:40–14:40');
    await expect(linha(page, 'Aluno 1001').locator('.c-hr')).not.toContainText('horário ajustado');
    await expect(page.locator('#tempo-parado > div')).toHaveText(['6h10 INVAs parados', '6h10 aviões parados', '2 saídas do hangar']);
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#audit-log-list')).toContainText('Compactação: horários Na disponibilidade → Não mudar');
    await page.keyboard.press('Escape');

    await page.reload();
    await abrirEscala(page);
    await expect(botao(page, 'Não mudar')).toHaveAttribute('aria-pressed', 'true');
  });

  test('com a escala aprovada, os critérios só aparecem', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await abrirEscala(page);
    await confirmar(page, '#btn-aprovar');
    await expect(botao(page, 'Avião')).toBeDisabled();
    await expect(botao(page, 'Não mudar')).toBeDisabled();
  });

  test('no Gestor, os critérios do dia aparecem travados', async ({ page }) => {
    await abrir(page, { estado: { ...dia(), criterios: { buracos: 'aviao', horarios: 'preferencias' } }, url: './?role=gestor' });
    await abrirEscala(page);
    await expect(botao(page, 'Avião')).toHaveAttribute('aria-pressed', 'true');
    await expect(botao(page, 'Só 1ª e 2ª')).toHaveAttribute('aria-pressed', 'true');
    await expect(botao(page, 'INVA')).toBeDisabled();
  });
});
