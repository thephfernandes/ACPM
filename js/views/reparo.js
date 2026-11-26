// Gaveta das sugestões para um conflito na escala aprovada: o voo, o motivo do conflito e o que pode voar no lugar,
// cada sugestão com "Aplicar"; soltar o voo (o app escala de novo); por último, cancelar o voo (pede o motivo, como no
// status). Também para o voo cancelado (aproveitar o voo: js/reparo.js, sugerirParaCancelado), com o motivo do
// cancelamento e, sem nada, "Impossível nesta data" com o porquê. Na escala de hoje, só horários que ainda não passaram
import { S, RES, DATA, estadoDaEscala } from '../state.js';
import { sugerirReparos, sugerirParaCancelado, cancelamentoAproveitavel, sugestoesDoRejeitado } from '../reparo.js';
import { rejeicoesDosPedidos } from '../rejeicoes.js';
import { GRUPO_DO_CONFLITO } from '../conflitos.js';
import { nomeDoRecurso } from '../categorias.js';
import { esc, hm, hojeISO, minutoDoDia } from '../format.js';
import { $, abrirGaveta } from '../dom.js';

let opcoesAbertas = [];
let doCancelado = false;
let doRejeitado = false;

const vooDaChave = fKey => (RES && Array.isArray(RES.out) ? RES.out.find(o => o.fKey === fKey) : null);

const painelDeReparoAberto = () => Boolean($('#painel-reparo') && !$('#painel-reparo').hidden);

// focar: aberta pelo botão "Sugestões" (o foco vai para a primeira sugestão, e a gaveta, por cima das outras abertas);
// sem focar, a gaveta aberta é redesenhada no lugar em que está
export function abrirPainelDeReparo(fKey, { focar = true } = {}) {
  const voo = vooDaChave(fKey);
  if (voo && !voo.conflito && cancelamentoAproveitavel(S, voo, { data: DATA, hoje: hojeISO() })) { abrirParaCancelado(voo, { focar }); return; }
  if (!voo || !voo.conflito) return;
  doCancelado = false;
  doRejeitado = false;
  const painel = $('#painel-reparo');
  opcoesAbertas = sugerirReparos(estadoDaEscala(), RES, fKey, { depoisDe: DATA === hojeISO() ? minutoDoDia() : null });
  painel.dataset.fkey = fKey;
  const sugestoes = opcoesAbertas.filter(o => o.mudancas);
  const pedidoMudou = (voo.conflitoCodigos || []).some(c => GRUPO_DO_CONFLITO[c] === 'pedido');
  painel.innerHTML = `<div class="gaveta-cab">
      <h2 id="painel-reparo-titulo">Resolver o conflito <small>${esc(voo.s)}</small></h2>
      <button class="x" type="button" id="btn-fechar-reparo" aria-label="Fechar as sugestões">✕</button>
    </div>
    <p class="h">${[`${hm(voo.a)}–${hm(voo.b)}`, voo.mis, nomeDoRecurso(voo.r), voo.ins].map(esc).join(' · ')}</p>
    <p class="motivo-conflito"><b>Conflito:</b> ${esc(voo.conflito.join('; '))}.</p>
    <p class="h">${pedidoMudou
      ? 'O pedido mudou depois da aprovação: solte o voo para o app escalar de novo, ou cancele. Fica no histórico (dá para reverter).'
      : sugestoes.length
        ? 'O que pode voar no lugar, sem mexer nos outros voos. Aplicada, a sugestão vale para o voo fixo e fica no histórico (dá para reverter).'
        : 'Nenhum avião ou instrutor serve neste horário, nem mais tarde hoje.'}</p>
    <ol class="opcoes-reparo">${opcoesAbertas.map((o, i) => `<li class="${esc(o.tipo)}">
      <span>${esc(o.mudancas || o.soltar ? o.texto : o.motivo ? `Motivo: ${o.motivo}` : 'Pede o motivo')}</span>
      <button type="button" class="btn${o.mudancas ? '' : ' sec'}" data-reparo-aplicar="${i}">${o.mudancas ? 'Aplicar' : o.soltar ? 'Soltar' : 'Cancelar o voo'}</button>
    </li>`).join('')}</ol>`;
  if (focar || painel.hidden) abrirGaveta(painel);
  const primeiro = painel.querySelector('[data-reparo-aplicar]');
  if (focar && primeiro) primeiro.focus();
}

// O voo cancelado: o que pode voar no lugar dele, cada sugestão com "Aplicar" (a que pede a confirmação com o aluno diz
// por quê, e o primeiro clique só arma o botão); sem nada, "Impossível nesta data", com o porquê de cada grupo
function abrirParaCancelado(voo, { focar }) {
  const painel = $('#painel-reparo');
  const { opcoes, impossivel } = sugerirParaCancelado(estadoDaEscala(), RES, voo.fKey, { depoisDe: DATA === hojeISO() ? minutoDoDia() : null });
  opcoesAbertas = opcoes;
  doCancelado = true;
  doRejeitado = false;
  painel.dataset.fkey = voo.fKey;
  const detalhe = (S.fObs || {})[voo.fKey];
  painel.innerHTML = `<div class="gaveta-cab">
      <h2 id="painel-reparo-titulo">Aproveitar o voo cancelado <small>${esc(voo.s)}</small></h2>
      <button class="x" type="button" id="btn-fechar-reparo" aria-label="Fechar as sugestões">✕</button>
    </div>
    <p class="h">${[`${hm(voo.a)}–${hm(voo.b)}`, voo.mis, nomeDoRecurso(voo.r), voo.ins].map(esc).join(' · ')}</p>
    <p class="motivo-conflito"><b>Cancelado:</b> ${esc(detalhe && detalhe.motivo ? detalhe.motivo : 'sem o motivo')}.</p>
    ${opcoes.length
    ? `<p class="h">O que pode voar no lugar, sem mexer nos outros voos. Aplicada, a sugestão volta o voo para Pendente, no lugar dela, e fica no histórico (dá para reverter).</p>
      <ol class="opcoes-reparo">${opcoes.map((o, i) => `<li class="${esc(o.tipo)}">
        <span>${esc(o.texto)}${o.confirmar ? `<small class="confirmar-aluno">${esc(o.confirmar)}</small>` : ''}</span>
        <button type="button" class="btn" data-reparo-aplicar="${i}"${o.confirmar ? ' data-confirmar' : ''}>Aplicar</button>
      </li>`).join('')}</ol>`
    : `<p class="motivo-conflito"><b>Impossível nesta data.</b></p><ul class="impossivel">${impossivel.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`}`;
  if (focar || painel.hidden) abrirGaveta(painel);
  const primeiro = painel.querySelector('[data-reparo-aplicar]') || painel.querySelector('#btn-fechar-reparo');
  if (focar && primeiro) primeiro.focus();
}

// O pedido recusado porque o instrutor escolhido não serve: outro instrutor (ou "Automático") que o encaixa sem mudar
// nenhum outro voo; aplicada, a escolha do pedido muda (a recusa do motor fica até o operador escolher)
export function abrirPainelDoRejeitado(fKey, { focar = true } = {}) {
  const estado = estadoDaEscala();
  const recusa = rejeicoesDosPedidos(estado, RES).get(fKey);
  if (!recusa) return;
  const painel = $('#painel-reparo');
  opcoesAbertas = sugestoesDoRejeitado(estado, RES, fKey);
  doCancelado = false;
  doRejeitado = true;
  painel.dataset.fkey = fKey;
  painel.innerHTML = `<div class="gaveta-cab">
      <h2 id="painel-reparo-titulo">Encaixar o pedido <small>${esc(recusa.s)}</small></h2>
      <button class="x" type="button" id="btn-fechar-reparo" aria-label="Fechar as sugestões">✕</button>
    </div>
    <p class="motivo-conflito"><b>Recusado:</b> ${esc(recusa.m.replace(/^Rejeitado: /, ''))}</p>
    ${opcoesAbertas.length
    ? `<p class="h">Com outro instrutor, o pedido entra na escala sem mudar nenhum outro voo. Aplicada, a escolha do pedido muda e fica no histórico (dá para reverter).</p>
      <ol class="opcoes-reparo">${opcoesAbertas.map((o, i) => `<li class="${o.insId ? 'instrutor' : 'automatico'}">
        <span>${esc(o.texto)}</span><button type="button" class="btn" data-reparo-aplicar="${i}">Aplicar</button></li>`).join('')}</ol>`
    : '<p class="h">Nenhum outro instrutor encaixa este pedido sem mudar outro voo. O pedido fica recusado até a escolha mudar na Demanda.</p>'}`;
  if (focar || painel.hidden) abrirGaveta(painel);
  const primeiro = painel.querySelector('[data-reparo-aplicar]') || painel.querySelector('#btn-fechar-reparo');
  if (focar && primeiro) primeiro.focus();
}

// devolverFoco: volta ao botão "Sugestões" do voo (quando ele ainda está na tela)
export function fecharPainelDeReparo(devolverFoco = false) {
  const painel = $('#painel-reparo');
  if (!painel || painel.hidden) return;
  painel.hidden = true;
  const botao = document.querySelector(`#out [data-reparo="${painel.dataset.fkey}"], #out [data-rejeitado="${painel.dataset.fkey}"]`);
  if (devolverFoco && botao) botao.focus();
}

// A sugestão escolhida na gaveta aberta: { fKey, voo, opcao } ou null
export function opcaoDoPainel(i) {
  const fKey = $('#painel-reparo').dataset.fkey;
  const voo = vooDaChave(fKey), opcao = opcoesAbertas[i];
  if (doRejeitado) return opcao ? { fKey, voo: null, opcao, rejeitado: true } : null;
  return voo && opcao ? { fKey, voo, opcao, cancelado: doCancelado } : null;
}

// A escala mudou com a gaveta aberta: as sugestões são refeitas; sem o conflito, a gaveta fecha
export function atualizarPainelDeReparo() {
  if (!painelDeReparoAberto()) return;
  if (doRejeitado) {
    const fKey = $('#painel-reparo').dataset.fkey;
    if (rejeicoesDosPedidos(estadoDaEscala(), RES).has(fKey)) abrirPainelDoRejeitado(fKey, { focar: false });
    else fecharPainelDeReparo();
    return;
  }
  const voo = vooDaChave($('#painel-reparo').dataset.fkey);
  if (voo && (voo.conflito || (doCancelado && cancelamentoAproveitavel(S, voo, { data: DATA, hoje: hojeISO() })))) abrirPainelDeReparo(voo.fKey, { focar: false });
  else fecharPainelDeReparo();
}
