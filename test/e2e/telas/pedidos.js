// O driver dos pedidos (dono: D2): o formulário da Agenda, onde a secretaria e o operador registram os pedidos da data
// (no modo local e no compartilhado)

import { MIS } from '../../../js/config.js';

// Um campo do formulário ('aluno', 'missao', 'recurso', 'horario', 'horario-motivo', 'horas', 'por', 'obs', 'excecao', 'erro': #ag-aluno…)
export const campoDaAgenda = (page, campo) => page.locator(`#ag-${campo}`);

// Registra um pedido: a missão decide os recursos (recurso null: o padrão dela), o recurso decide os horários, e o pedido
// é sempre num horário específico, com a duração (horas null: a da missão)
export async function registrarPedido(page, { aluno = 'Aluno 1000', missao = 'Voo Local', recurso = null, horario = '06:30', horas = null, por = 'Maria', obs = '' } = {}) {
  await campoDaAgenda(page, 'aluno').selectOption({ label: aluno });
  await campoDaAgenda(page, 'missao').selectOption(missao);
  await campoDaAgenda(page, 'recurso').selectOption(recurso || MIS[missao].defEq);
  await campoDaAgenda(page, 'horario').selectOption(horario);
  if (horas !== null) await campoDaAgenda(page, 'horas').fill(String(horas));
  await campoDaAgenda(page, 'por').fill(por);
  await campoDaAgenda(page, 'obs').fill(obs);
  await page.locator('#form-agenda [type="submit"]').click();
}
