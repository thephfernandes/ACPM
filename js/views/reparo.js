// Gaveta das sugestões para um conflito na escala aprovada: o voo, o motivo do conflito e o que pode voar no lugar,
// cada sugestão com "Aplicar"; soltar o voo (o app escala de novo); por último, cancelar o voo (pede o motivo, como no
// status). Também para o voo cancelado (aproveitar o voo: js/reparo.js, sugerirParaCancelado), com o motivo do
// cancelamento e, sem nada, "Impossível nesta data" com o porquê. Na escala de hoje, só horários que ainda não passaram
import { S, RES, DATA, estadoDaEscala } from '../state.js';
import { sugerirReparos, sugerirParaCancelado, cancelamentoAproveitavel, sugestoesDoRejeitado, dataQueAindaVoa } from '../reparo.js';
import { rejeicoesDosPedidos } from '../rejeicoes.js';
import { GRUPO_DO_CONFLITO } from '../conflitos.js';
import { nomeDoRecurso } from '../categorias.js';
import { esc, hm, hojeISO, minutoDoDia } from '../format.js';
import { $, abrirGaveta, visivel } from '../dom.js';

let opcoesAbertas = [];
let doCancelado = false;
let doRejeitado = false;

const vooDaChave = fKey => (RES && Array.isArray(RES.out) ? RES.out.find(o => o.fKey === fKey) : null);

// A frase de cima das sugestões: "sem mexer nos outros voos" só quando nenhuma muda outro voo (na escala não aprovada, o
// motor refaz os voos que não são fixos: a sugestão que muda algum diz qual)
const oQuePodeVoar = opcoes => (opcoes.some(o => o.muda)
  ? 'O que pode voar no lugar. A sugestão que muda outros voos diz quais e pede a confirmação.'
  : 'O que pode voar no lugar, sem mexer nos outros voos.');

// A frase da confirmação, numa linha própria abaixo do texto da sugestão (o espaço a separa também para o leitor de tela)
const confirmacao = o => (o.confirmar ? ` <small class="confirmar-aluno">${esc(o.confirmar)}</small>` : '');

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
        ? `${oQuePodeVoar(sugestoes)} Aplicada, a sugestão vale para o voo fixo e fica no histórico (dá para reverter).`
        : 'Nenhum avião ou instrutor serve neste horário, nem mais tarde hoje.'}</p>
    <ol class="opcoes-reparo">${opcoesAbertas.map((o, i) => `<li class="${esc(o.tipo)}">
      <span>${esc(o.mudancas || o.soltar ? o.texto : o.motivo ? `Motivo: ${o.motivo}` : 'Pede o motivo')}${confirmacao(o)}</span>
      <button type="button" class="btn${o.mudancas ? '' : ' sec'}" data-reparo-aplicar="${i}"${o.confirmar ? ' data-confirmar' : ''}>${o.mudancas ? 'Aplicar' : o.soltar ? 'Soltar' : 'Cancelar o voo'}</button>
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
    ? `<p class="h">${oQuePodeVoar(opcoes)} Aplicada, a sugestão volta o voo para Pendente, no lugar dela, e fica no histórico (dá para reverter).</p>
      <ol class="opcoes-reparo">${opcoes.map((o, i) => `<li class="${esc(o.tipo)}">
        <span>${esc(o.texto)}${confirmacao(o)}</span>
        <button type="button" class="btn" data-reparo-aplicar="${i}"${o.confirmar ? ' data-confirmar' : ''}>Aplicar</button>
      </li>`).join('')}</ol>`
    : `<p class="motivo-conflito"><b>Impossível nesta data.</b></p><ul class="impossivel">${impossivel.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`}`;
  if (focar || painel.hidden) abrirGaveta(painel);
  const primeiro = painel.querySelector('[data-reparo-aplicar]') || painel.querySelector('#btn-fechar-reparo');
  if (focar && primeiro) primeiro.focus();
}

// O pedido recusado porque o instrutor escolhido não serve: outro instrutor (ou "Automático") que o encaixa sem mudar
// nenhum outro voo; aplicada, a escolha do pedido muda (a recusa do motor fica até o operador escolher). Só de hoje em
// diante e, hoje, num horário que ainda não passou
export function abrirPainelDoRejeitado(fKey, { focar = true } = {}) {
  const estado = estadoDaEscala();
  const recusa = rejeicoesDosPedidos(estado, RES).get(fKey);
  if (!recusa || !dataQueAindaVoa({ data: DATA, hoje: hojeISO() })) return;
  const painel = $('#painel-reparo');
  const hoje = DATA === hojeISO();
  opcoesAbertas = sugestoesDoRejeitado(estado, RES, fKey, { depoisDe: hoje ? minutoDoDia() : null });
  // Hoje, sem nada: com outro instrutor o app poria o pedido num horário que já passou (o motor não sabe a hora)?
  const soNoPassado = !opcoesAbertas.length && hoje && sugestoesDoRejeitado(estado, RES, fKey).length > 0;
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
    : soNoPassado
      ? '<p class="h">Com outro instrutor, o app escala este pedido num horário que já passou. Para um horário mais tarde hoje, agende o voo em <i>+ Agendar voo</i>; senão, o pedido fica recusado até a escolha mudar na Demanda.</p>'
      : '<p class="h">Nenhum outro instrutor encaixa este pedido sem mudar outro voo. O pedido fica recusado até a escolha mudar na Demanda.</p>'}`;
  if (focar || painel.hidden) abrirGaveta(painel);
  const primeiro = painel.querySelector('[data-reparo-aplicar]') || painel.querySelector('#btn-fechar-reparo');
  if (focar && primeiro) primeiro.focus();
}

// devolverFoco: volta ao botão "Sugestões" do voo (quando ele ainda está na tela) ou, sem ele (no mapa, o botão é do
// popup, que fechou), ao voo
export function fecharPainelDeReparo(devolverFoco = false) {
  const painel = $('#painel-reparo');
  if (!painel || painel.hidden) return;
  painel.hidden = true;
  if (devolverFoco) focarNoVoo(painel.dataset.fkey, { botao: true });
}

// O foco no voo, o primeiro visível: o botão "Sugestões" dele (botao: na caixa ou na linha), o status dele na lista ou a
// barra dele no mapa. Depois de aplicar, sem o botão: o voo mudou de lugar ou de status
export function focarNoVoo(fKey, { botao = false } = {}) {
  const k = CSS.escape(fKey);
  const seletores = [...(botao ? [`#out [data-reparo="${k}"]`, `#out [data-rejeitado="${k}"]`] : []),
    `#out select[data-f="fstatus"][data-fkey="${k}"]`, `#out .tl-bar[data-pop="${k}"]`];
  const alvo = seletores.map(s => [...document.querySelectorAll(s)].find(visivel)).find(Boolean);
  if (alvo) alvo.focus();
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
    if (dataQueAindaVoa({ data: DATA, hoje: hojeISO() }) && rejeicoesDosPedidos(estadoDaEscala(), RES).has(fKey)) abrirPainelDoRejeitado(fKey, { focar: false });
    else fecharPainelDeReparo();
    return;
  }
  const voo = vooDaChave($('#painel-reparo').dataset.fkey);
  if (voo && (voo.conflito || (doCancelado && cancelamentoAproveitavel(S, voo, { data: DATA, hoje: hojeISO() })))) abrirPainelDeReparo(voo.fKey, { focar: false });
  else fecharPainelDeReparo();
}
