// Manual (botão "Manual" no topo): o texto está em index.html; as tabelas de regras são geradas do código.
import { $ } from '../dom.js';
import { esc } from '../format.js';
import { missoesDoManual, janelasDoManual, pesosDoManual, combustivelDoManual, rodizioDoManual, glossarioDoManual } from '../manual.js';

const itens = lista => lista.map(item => `<li>${esc(item)}</li>`).join('');
// Hífen que não quebra a linha: "PA-34" não se parte no meio da tabela
const celula = texto => `<td>${esc(texto).replace(/-/g, '\u2011')}</td>`;

export function rManual() {
  $('#manual-janelas').innerHTML = itens(janelasDoManual());
  $('#manual-rodizio').innerHTML = itens(rodizioDoManual());
  $('#manual-pesos').textContent = pesosDoManual().map(([tipo, kg]) => `${tipo}: ${kg}`).join('; ');
  $('#manual-combustivel').textContent = combustivelDoManual().join('; ');
  $('#manual-missoes tbody').innerHTML = missoesDoManual()
    .map(l => `<tr>${[l.missao, l.equipamentos, l.quem, l.obs].map(celula).join('')}</tr>`)
    .join('');
  // O Glossário: o mesmo texto das dicas, aba por aba (revisão de 14/11)
  $('#manual-glossario-lista').innerHTML = glossarioDoManual().map(({ aba, termos }) =>
    `<h4>${esc(aba)}</h4><dl class="glossario">${termos.map(t => `<dt>${esc(t.termo)}</dt><dd>${esc(t.texto)}</dd>`).join('')}</dl>`).join('');
}
