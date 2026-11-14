// Manual (botão "Manual" no topo): o texto está em index.html; as tabelas de regras são geradas do código.
import { $ } from '../dom.js';
import { esc } from '../format.js';
import { missoesDoManual, janelasDoManual, pesosDoManual, combustivelDoManual, rodizioDoManual } from '../manual.js';

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
}
