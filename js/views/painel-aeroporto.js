// Painel no estilo dos aeroportos (fase 8), como os painéis da INFRAERO: o quadro de Partidas (todas as do dia) e o de
// Chegadas (as que ainda não pousaram) se alternam página a página a cada 10 segundos, com o relógio e a página no
// canto. O operador pode deixar um quadro só, pausar a troca e abrir em tela cheia (para um monitor ou TV). Só mostra:
// o status muda na Lista e no mapa. A TV da recepção (painel.html) usa o mesmo painel, na tela toda e sem os botões.
import { hm, esc, hojeISO, rotuloDaData } from '../format.js';
import { quadroDePartidas, quadroDeChegadas, minutoDoQuadro, telasDoPainel } from '../quadro.js';

export const TROCA_MS = 10000;
const POR_PAGINA = 12;
const QUADROS = {
  partidas: { titulo: 'Partidas', icone: 'i-decolagem', vazio: 'Nenhuma partida' },
  chegadas: { titulo: 'Chegadas', icone: 'i-pouso', vazio: 'Nenhuma chegada pendente' }
};
const COLUNAS = ['Horário', 'Missão', 'Modelo', 'Aeronave', 'Aluno', 'Instrutor', 'Previsto', 'Observação'];

// modo: 'alternar' (os dois quadros) ou um quadro só; tela: a posição na sequência; fonte: de onde vêm as linhas;
// seletor: onde está o painel; inteiro: na tela toda (a TV), com as linhas que couberem
const estado = { modo: 'alternar', tela: 0, pausado: false, fonte: null, relogio: null, ultimaTroca: 0, seletor: '#out .fids', inteiro: false };

const MODELOS = { 'Sim. Mono': 'SIM MONO', 'Sim. Multi': 'SIM MULTI' };
const classeDoModelo = modelo => modelo.replace(/[^A-Za-z0-9]/g, '');

function linhaHtml(l) {
  return `<tr class="fids-${l.classe}">
      <td class="f-hora">${hm(l.horario)}</td>
      <td class="f-missao">${esc(l.missao)}</td>
      <td class="f-modelo"><span class="fids-cia fids-cia-${classeDoModelo(l.modelo)}">${esc(MODELOS[l.modelo] || l.modelo)}</span></td>
      <td class="f-aeronave">${esc(l.aeronave)}</td>
      <td class="f-aluno">${esc(l.aluno)}</td>
      <td class="f-instr">${esc(l.instrutor)}</td>
      <td class="f-prev">${l.previsto === null ? '' : hm(l.previsto)}</td>
      <td class="f-obs">${esc(l.observacao)}</td>
    </tr>`;
}

// Quantas linhas cabem: na página, 12; em tela cheia, as que couberem na altura da tela
function porPagina() {
  const cheia = document.fullscreenElement && document.fullscreenElement.classList.contains('fids') ? document.fullscreenElement : null;
  const quadro = cheia || (estado.inteiro && document.querySelector(estado.seletor));
  if (!quadro) return POR_PAGINA;
  const linha = parseFloat(getComputedStyle(quadro).getPropertyValue('--fids-linha')) || 48;
  return Math.max(8, Math.floor((innerHeight * 0.8) / linha));
}

function telasAgora() {
  const { linhas, data } = estado.fonte();
  const agora = new Date();
  const minuto = minutoDoQuadro(data, hojeISO(), agora.getHours() * 60 + agora.getMinutes());
  const todas = telasDoPainel(quadroDePartidas(linhas), quadroDeChegadas(linhas, minuto), porPagina());
  return estado.modo === 'alternar' ? todas : todas.filter(t => t.quadro === estado.modo);
}

function quadroHtml() {
  const telas = telasAgora();
  estado.tela = estado.tela % telas.length;
  const tela = telas[estado.tela];
  const { titulo, icone } = QUADROS[tela.quadro];
  const { data, semEscala = false, aviso = null } = estado.fonte();
  const vazio = semEscala ? 'A escala de hoje ainda não foi publicada.' : QUADROS[tela.quadro].vazio;
  const hoje = hojeISO();
  const agora = new Date();
  const linhas = tela.linhas.length
    ? tela.linhas.map(linhaHtml).join('')
    : `<tr class="fids-nada"><td colspan="${COLUNAS.length}">${vazio}</td></tr>`;
  // Linhas vazias completam a página: o quadro tem sempre a mesma altura, como no aeroporto
  const vazias = '<tr class="fids-vazia" aria-hidden="true"><td colspan="8">&nbsp;</td></tr>'.repeat(Math.max(0, porPagina() - Math.max(1, tela.linhas.length)));
  return `<div class="fids-topo">
      <img class="fids-logo" src="img/acpm-aguia.png" alt="ACPM">
      <div class="fids-nome"><h3 class="fids-titulo">${titulo}</h3>${data === hoje ? '' : `<small class="fids-data">${esc(rotuloDaData(data, hoje).dia)}</small>`}</div>
      <svg class="fids-aviao" aria-hidden="true"><use href="#${icone}"/></svg>
      <div class="fids-relogio"><b>${hm(agora.getHours() * 60 + agora.getMinutes())}</b><small>página ${tela.pagina}/${tela.paginas}</small>${aviso === null ? '' : `<small class="fids-aviso">${esc(aviso)}</small>`}</div>
    </div>
    <table class="fids-tabela">
      <caption class="sr">${titulo}${tela.paginas > 1 ? `, página ${tela.pagina} de ${tela.paginas}` : ''}</caption>
      <thead><tr>${COLUNAS.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead>
      <tbody>${linhas}${vazias}</tbody>
    </table>`;
}

const botaoDoModo = (modo, rotulo) => `<button type="button" data-fids="${modo}" aria-pressed="${estado.modo === modo}"${estado.modo === modo ? ' class="on"' : ''}>${rotulo}</button>`;

// O painel da Escala: os botões (os dois quadros ou um só, pausar e tela cheia) e o quadro
export function painelDaEscala(fonte) {
  estado.fonte = fonte;
  estado.seletor = '#out .fids';
  estado.inteiro = false;
  ligarRelogio();
  return `<div class="fids-controles">
      <div class="seg" role="group" aria-label="Quadros do painel">
        ${botaoDoModo('alternar', 'Partidas e chegadas')}${botaoDoModo('partidas', 'Partidas')}${botaoDoModo('chegadas', 'Chegadas')}
      </div>
      <button type="button" class="btn sec" data-fids="pausar" aria-pressed="${estado.pausado}">${estado.pausado ? 'Continuar' : 'Pausar'}</button>
      <button type="button" class="btn sec" data-fids="tela-cheia">Tela cheia</button>
    </div>
    <div class="fids" role="region" aria-label="Painel de partidas e chegadas">${quadroHtml()}</div>`;
}

function redesenhar() {
  const quadro = document.querySelector(estado.seletor);
  if (quadro && estado.fonte) quadro.innerHTML = quadroHtml();
}

// A TV da recepção: o painel na tela toda, sem os botões (alterna sempre). atualizarPainel redesenha na hora (dados novos)
export function painelNaTela(elemento, fonte) {
  estado.fonte = fonte;
  estado.seletor = `#${elemento.id}`;
  estado.inteiro = true;
  elemento.classList.add('fids', 'inteiro');
  elemento.setAttribute('role', 'region');
  elemento.setAttribute('aria-label', 'Painel de partidas e chegadas');
  elemento.innerHTML = quadroHtml();
  ligarRelogio();
}
export const atualizarPainel = redesenhar;

// O relógio do painel: a cada segundo, a hora; a cada 10 segundos, a próxima página (se não estiver pausado). Para
// sozinho quando o painel sai da tela
function ligarRelogio() {
  if (estado.relogio) return;
  estado.ultimaTroca = Date.now();
  estado.relogio = setInterval(() => {
    if (!document.querySelector(estado.seletor) || !estado.fonte) {
      clearInterval(estado.relogio);
      estado.relogio = null;
      return;
    }
    if (!estado.pausado && Date.now() - estado.ultimaTroca >= TROCA_MS) {
      estado.tela += 1;
      estado.ultimaTroca = Date.now();
    }
    redesenhar();
  }, 1000);
}

// Os botões do painel: o modo (os dois quadros ou um só), pausar e tela cheia
export function acaoDoPainel(acao) {
  if (acao === 'pausar') {
    estado.pausado = !estado.pausado;
    estado.ultimaTroca = Date.now();
    const botao = document.querySelector('#out [data-fids="pausar"]');
    botao.setAttribute('aria-pressed', String(estado.pausado));
    botao.textContent = estado.pausado ? 'Continuar' : 'Pausar';
    return;
  }
  if (acao === 'tela-cheia') {
    const quadro = document.querySelector('#out .fids');
    if (quadro && quadro.requestFullscreen) quadro.requestFullscreen().then(redesenhar, () => {});
    return;
  }
  estado.modo = acao;
  estado.tela = 0;
  estado.ultimaTroca = Date.now();
  document.querySelectorAll('#out [data-fids]').forEach(b => {
    if (!QUADROS[b.dataset.fids] && b.dataset.fids !== 'alternar') return;
    const ativo = b.dataset.fids === acao;
    b.setAttribute('aria-pressed', String(ativo));
    b.classList.toggle('on', ativo);
  });
  redesenhar();
}

// Ao entrar e sair da tela cheia, o número de linhas por página muda
document.addEventListener('fullscreenchange', redesenhar);
