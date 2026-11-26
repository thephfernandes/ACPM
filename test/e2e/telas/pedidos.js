// O driver dos pedidos (dono: D2): o formulário da Agenda, onde a secretaria e o operador registram os pedidos da data
// (no modo local e no compartilhado)

import { MIS } from '../../../js/config.js';

// Um campo do formulário ('aluno', 'missao', 'missao-motivo', 'recurso', 'recurso-motivo', 'horario', 'horario-motivo',
// 'horas', 'por', 'obs', 'excecao', 'erro': #ag-aluno…)
export const campoDaAgenda = (page, campo) => page.locator(`#ag-${campo}`);
// A missão do curso no campo "Fase / missão", pelo código ("NAV-150NM")
export const missaoDoCursoNaAgenda = (page, codigo) => campoDaAgenda(page, 'missao').locator(`option[data-codigo="${codigo}"]`);
export async function escolherMissaoDoCurso(page, codigo) {
  await campoDaAgenda(page, 'missao').selectOption(await missaoDoCursoNaAgenda(page, codigo).getAttribute('value'));
}

// Registra um pedido: o aluno, depois a missão (codigo: a missão do curso do aluno; senão, o tipo de missão), que decide os
// recursos (recurso null: o da missão do curso, ou o padrão do tipo), o recurso decide os horários, e o pedido é sempre num
// horário específico, com a duração (horas null: a da missão)
export async function registrarPedido(page, { aluno = 'Aluno 1000', missao = 'Voo Local', codigo = null, recurso = null, horario = '06:30', horas = null, por = 'Maria', obs = '' } = {}) {
  await campoDaAgenda(page, 'aluno').selectOption({ label: aluno });
  if (codigo) await escolherMissaoDoCurso(page, codigo);
  else await campoDaAgenda(page, 'missao').selectOption(missao);
  if (!codigo || recurso) await campoDaAgenda(page, 'recurso').selectOption(recurso || MIS[missao].defEq);
  await campoDaAgenda(page, 'horario').selectOption(horario);
  if (horas !== null) await campoDaAgenda(page, 'horas').fill(String(horas));
  await campoDaAgenda(page, 'por').fill(por);
  await campoDaAgenda(page, 'obs').fill(obs);
  await page.locator('#form-agenda [type="submit"]').click();
}
