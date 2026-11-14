// Gaveta das sugestões para um conflito na escala aprovada (fase 12): o voo, o motivo do conflito e o que pode voar no
// lugar, cada sugestão com "Aplicar"; soltar o voo (o app escala de novo); por último, cancelar o voo (pede o motivo, como no status). Na escala de hoje, só
// horários que ainda não passaram
import { S, RES, DATA } from '../state.js';
import { sugerirReparos } from '../reparo.js';
import { GRUPO_DO_CONFLITO } from '../conflitos.js';
import { nomeDoRecurso } from '../categorias.js';
import { esc, hm, hojeISO } from '../format.js';
import { $ } from '../dom.js';

let opcoesAbertas = [];

const minutoDeAgora = () => { const agora = new Date(); return agora.getHours() * 60 + agora.getMinutes(); };
const vooDaChave = fKey => (RES && Array.isArray(RES.out) ? RES.out.find(o => o.fKey === fKey) : null);

export const painelDeReparoAberto = () => Boolean($('#painel-reparo') && !$('#painel-reparo').hidden);

export function abrirPainelDeReparo(fKey, { focar = true } = {}) {
  const voo = vooDaChave(fKey);
  if (!voo || !voo.conflito) return;
  const painel = $('#painel-reparo');
  opcoesAbertas = sugerirReparos(S, RES, fKey, { depoisDe: DATA === hojeISO() ? minutoDeAgora() : null });
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
  painel.hidden = false;
  const primeiro = painel.querySelector('[data-reparo-aplicar]');
  if (focar && primeiro) primeiro.focus();
}

// devolverFoco: volta ao botão "Sugestões" do voo (quando ele ainda está na tela)
export function fecharPainelDeReparo(devolverFoco = false) {
  const painel = $('#painel-reparo');
  if (!painel || painel.hidden) return;
  painel.hidden = true;
  const botao = document.querySelector(`#out [data-reparo="${painel.dataset.fkey}"]`);
  if (devolverFoco && botao) botao.focus();
}

// A sugestão escolhida na gaveta aberta: { fKey, voo, opcao } ou null
export function opcaoDoPainel(i) {
  const fKey = $('#painel-reparo').dataset.fkey;
  const voo = vooDaChave(fKey), opcao = opcoesAbertas[i];
  return voo && opcao ? { fKey, voo, opcao } : null;
}

// A escala mudou com a gaveta aberta: as sugestões são refeitas; sem o conflito, a gaveta fecha
export function atualizarPainelDeReparo() {
  if (!painelDeReparoAberto()) return;
  const voo = vooDaChave($('#painel-reparo').dataset.fkey);
  if (voo && voo.conflito) abrirPainelDeReparo(voo.fKey, { focar: false });
  else fecharPainelDeReparo();
}
