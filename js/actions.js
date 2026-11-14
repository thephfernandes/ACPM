// Ações que alteram o estado: perfil de acesso, data da escala, histórico de alterações, geração da escala e BI.
import { isoMenosDias, fimDoMes, rotuloDaData, hojeISO } from './format.js';
import { runAllocationEngine } from './engine.js';
import { ApiClient } from './storage.js';
import { S, RES, AUDIT_LOG, BI_HISTORY, DATA, setS, setRES, setAuditLog, setBIHistory, setData, isGestor } from './state.js';
import { $ } from './dom.js';
import { rBI } from './views/bi.js';
import { renderAuditPanel, rOut } from './views/escala.js';
import { rDem } from './views/demanda.js';
import { rIns, rInsDia, rAlu } from './views/cadastros.js';
import { rRec, rRevisao, rHangar } from './views/recursos.js';
import { podeEditarAgenda, rAgenda } from './views/agenda.js';
import { atualizarSelosDaEscala, atualizarSeloDaAgenda, lerPedidosDaData } from './views/selos.js';

// Abre uma data na tela (a data da escala e a data base do BI)
export function abrirData(data) {
  setData(data);
  $('#dt').value = data;
  $('#bi-dt').value = data;
  // No topo: "quarta-feira, 11/11" e "amanhã"
  const { dia, relativo } = rotuloDaData(data, hojeISO());
  $('#dt-rotulo').textContent = dia;
  $('#dt-rel').textContent = relativo;
  $('#dt-rel').hidden = !relativo;
}

export function setRole(role, lockShared = false) {
  if (lockShared) ApiClient.readOnly = true;
  const validRole = (ApiClient.readOnly || role === 'gestor') ? 'gestor' : 'operador';
  document.body.setAttribute('data-role', validRole);
  if (ApiClient.readOnly) {
    document.body.setAttribute('data-shared', 'true');
  }
  const sel = $('#role-sel');
  if (sel) {
    if (ApiClient.readOnly) {
      sel.innerHTML = '<option value="gestor" selected>Gestor (somente leitura)</option>';
      sel.value = 'gestor';
      sel.disabled = true;
      sel.title = 'Link compartilhado: visualização exclusiva no perfil Gestor';
    } else {
      sel.value = validRole;
    }
  }
  // No modo compartilhado o gestor navega entre as datas (somente leitura)
  const dtInput = $('#dt');
  if (dtInput) {
    dtInput.disabled = isGestor() && document.body.dataset.backend !== 'supabase';
    $('#dt-ant').disabled = $('#dt-prox').disabled = dtInput.disabled;
  }
  // Agenda: quem pode registrar pedidos (operadores e secretaria; no modo local, fora do perfil Gestor)
  document.body.dataset.agenda = podeEditarAgenda() ? 'edita' : 'consulta';
  atualizarSeloDaAgenda();
}

// A escala acompanha os dados: cada alteração do operador refaz a escala da data (o motor leva milissegundos) e
// grava os dados e a escala juntos. Ao abrir a aba Escala, ela já está pronta
export function save() {
  if (isGestor()) return;
  refazerEscala();
  ApiClient.salvarDia(DATA, S, RES);
  escalaSoCalculada = false;
  // A barra da escala mostra quando ela foi refeita
  const agora = new Date();
  $('#escala-atualizada-texto').textContent = `Atualizada às ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  $('#escala-atualizada').hidden = false;
}

// Escala só calculada (data aberta ainda sem escala gravada): é gravada na primeira alteração ou quando é exportada
// (CSV ou PDF), para entrar no BI e nas horas e no rodízio da data seguinte. Abrir uma data não grava nada
let escalaSoCalculada = false;
export const marcarEscalaSoCalculada = valor => { escalaSoCalculada = valor; };
export function gravarEscalaCalculada() {
  if (escalaSoCalculada) save();
}

// A entrada aparece na hora; o id (que permite reverter) chega quando o registro é gravado.
// reverte: id da entrada que esta alteração desfaz (ela deixa de aparecer no painel)
export function logChange(type, desc, revertAction = null, reverte = null) {
  if (isGestor()) return;
  const entry = {
    id: null,
    ts: new Date().toTimeString().slice(0, 8),
    type,
    desc,
    revert: revertAction,
    reverte,
    autor: ApiClient.autorAtual,
    importado: false
  };
  AUDIT_LOG.unshift(entry);
  renderAuditPanel();
  ApiClient.registrarHistorico(DATA, { tipo: type, descricao: desc, reverter: revertAction, reverte }).then(id => {
    if (id === null || id === undefined) return;
    entry.id = id;
    renderAuditPanel();
  });
}

// Entradas importadas (anteriores à fase 3) mostram também o dia em que foram feitas
function horario(iso, importado) {
  const d = new Date(iso);
  const hora = d.toTimeString().slice(0, 8);
  return importado ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hora.slice(0, 5)}` : hora;
}

export async function historicoParaPainel(data) {
  return (await ApiClient.historicoDoDia(data)).map(e => ({
    id: e.id,
    ts: horario(e.registrado_em, e.importado),
    type: e.tipo,
    desc: e.descricao,
    revert: e.importado ? null : e.reverter,
    reverte: e.reverte,
    autor: e.autor,
    importado: e.importado
  }));
}

// Abre a escala de uma data (uma troca rápida de data descarta a resposta da troca anterior)
let pedidoDeData = 0;
export async function carregarData(data) {
  const pedido = ++pedidoDeData;
  const { estado, escala, horasBase, horasDosInstrutores, resultados } = await ApiClient.carregarDia(data);
  const historico = await historicoParaPainel(data);
  if (pedido !== pedidoDeData) return;
  abrirData(data);
  setS({ ...estado, horasBase, horasDosInstrutores, resultados });
  // Data sem escala gravada (por exemplo, uma data nova, copiada da anterior): a escala calculada aparece na hora
  // e é gravada junto com a primeira alteração
  setRES(escala || escalaCalculada());
  escalaSoCalculada = !escala;
  setAuditLog(historico);
  $('#escala-atualizada').hidden = true;
  rRec(); rIns(); rAlu(); rDem(); renderAuditPanel(); rOut(); rAgenda();
  atualizarSelosDaEscala();
  lerPedidosDaData();
  await carregarBI();
}

// BI das escalas guardadas no mês da data base (e nos 7 dias até ela), com a escala da tela já incluída.
// Sem conexão, o BI continua como estava
let pedidoDeBI = 0;
export async function carregarBI() {
  const ref = $('#bi-dt').value || DATA;
  const inicioMes = ref.slice(0, 8) + '01';
  const inicioSemana = isoMenosDias(ref, 6);
  const pedido = ++pedidoDeBI;
  let bi;
  try {
    bi = await ApiClient.biDoPeriodo(inicioSemana < inicioMes ? inicioSemana : inicioMes, fimDoMes(ref));
  } catch (e) {
    return;
  }
  if (pedido !== pedidoDeBI) return;
  setBIHistory(bi);
  syncBIHistoryForCurrentDate();
  rBI();
}

// O BI em memória acompanha a escala da tela (que pode ainda estar sendo gravada)
export function syncBIHistoryForCurrentDate() {
  if (ApiClient.readOnly) return;
  if (!DATA) return;
  if (RES) {
    BI_HISTORY[DATA] = {
      out: RES.out.map(o => ({ ...o })),
      tot: RES.tot,
      rej: RES.al.filter(a => a.t === 'err').length
    };
  } else {
    delete BI_HISTORY[DATA];
  }
}

// Escala da data calculada a partir dos dados da tela. Ela guarda a data para a qual foi feita (no modo
// compartilhado, todos veem essa data)
export const escalaCalculada = () => ({ ...runAllocationEngine(S), data: DATA });

// Refaz a escala e o que depende dela (revisão de 50 horas, painel do dia e BI), sem gravar: quem grava é save
export function refazerEscala() {
  setRES(escalaCalculada());
  syncBIHistoryForCurrentDate();
  rRevisao();
  rHangar();
  rInsDia();
  rOut();
  renderAuditPanel();
  rBI();
  atualizarSelosDaEscala();
}
