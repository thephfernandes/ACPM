// O trilho: o botão da data no topo, o calendário (um clique, Enter ou Espaço abre a data; as setas, Home, End, PageUp e
// PageDown andam pela grade; Esc volta ao botão da data), as setas do mês, "Fixar ao lado" e o painel que fecha. É o único
// que troca a data depois da abertura (carregarData). Os desenhos: o nome da data no botão, o mês da data aberta, o
// calendário com os avisos da data e os pedidos de cada dia
import { carregarData, dadosLidos } from '../actions.js';
import { ehDomingo } from '../agenda.js';
import { $, showToast, anunciar, fecharNoEsc } from '../dom.js';
import { dataIsoValida, hojeISO, rotuloDaData } from '../format.js';
import { diaDaTecla, somarMeses } from '../calendario.js';
import { DATA } from '../state.js';
import { classeDaLargura, trilhoFixo, lerPreferencias } from '../telas.js';
import { registrarDesenho } from '../redesenho.js';
import {
  rTrilho, rRotuloDaData, mostrarTrilho, estadoDoTrilho, mostrarMes, mesDoTrilho, marcarAbrindo, diaAbrindo,
  semanasAVista, focarNoCalendario, lerContagemDosDias, contarComOsDados
} from '../views/trilho.js';

const CHAVE = 'acpm_trilho';
const DOMINGO = 'O aeroclube não opera aos domingos: não há escala nem pedidos.';

// O aviso do domingo (um link para um domingo abre a segunda)
export const avisoDeDomingo = segunda => `O aeroclube não opera aos domingos: abrimos segunda-feira, ${segunda.slice(8, 10)}/${segunda.slice(5, 7)}.`;

// Os desenhos (js/redesenho.js): ao abrir uma data, o nome dela no topo e o mês dela no calendário; o calendário em todos os
// momentos; os pedidos de cada dia quando os dados chegam (se o mês à vista ainda não foi contado)
registrarDesenho('rotulo-da-data', rRotuloDaData, { em: ['data-aberta'], ordem: 1 });
registrarDesenho('mes-do-trilho', () => { if (DATA) mostrarMes(DATA.slice(0, 7)); }, { em: ['data-aberta'], ordem: 3 });
registrarDesenho('trilho', rTrilho, { em: ['data-aberta', 'dados', 'consulta', 'releitura', 'escala', 'perfil', 'pedidos'], ordem: 97 });
registrarDesenho('contagem-do-trilho', contarComOsDados, { em: ['dados'], ordem: 98 });

function preferencias() {
  try {
    return lerPreferencias(localStorage.getItem(CHAVE));
  } catch {
    return {};
  }
}

// Ao lado ou não, pela largura da janela e pelo que a pessoa guardou; o painel aberto fecha quando a largura muda de classe
function aplicarLargura() {
  const foco = document.activeElement, noTrilho = $('#trilho').contains(foco);
  mostrarTrilho(trilhoFixo(classeDaLargura(window.innerWidth), preferencias()) ? 'fixo' : 'fechado');
  rTrilho();
  // O foco que sumiu com o trilho (ou com o botão de fechar dele) vai para o botão da data
  if (noTrilho && (!foco.isConnected || foco.closest('[hidden]'))) $('#btn-data').focus();
}
aplicarLargura();
matchMedia('(min-width: 1024px)').addEventListener('change', aplicarLargura);
matchMedia('(min-width: 1280px)').addEventListener('change', aplicarLargura);

// Fecha o painel e devolve o foco ao botão da data
function fecharPainel() {
  mostrarTrilho('fechado');
  $('#btn-data').focus();
}

// Abre a data escolhida no calendário. Até os dados dela chegarem, a data aberta, o anel e o topo continuam na de antes; o
// dia escolhido fica "abrindo". Aberta, ela é anunciada; o painel fecha e o foco volta ao botão da data (ao lado, o foco
// fica no dia). Quem foi para outro lugar enquanto ela abria (um campo da tela) continua lá. Vale a última escolha: o clique
// na data que continua aberta, com outra abrindo ou depois de outra não abrir, a lê de novo (e ela volta a gravar)
let escolhas = 0;
async function escolherData(dia) {
  if ((dia === DATA && dadosLidos) || dia === diaAbrindo() || !dataIsoValida(dia)) return;
  if (ehDomingo(dia)) { showToast(DOMINGO); return; }
  const vez = ++escolhas;
  marcarAbrindo(dia);
  rTrilho();
  let falhou = false;
  try {
    await carregarData(dia);
  } catch {
    falhou = true;
  }
  // Outra data foi escolhida depois desta (ou esta, de novo): a marca e o aviso são dela
  if (vez !== escolhas) return;
  marcarAbrindo(null);
  rTrilho();
  if (falhou) { showToast('Não foi possível abrir essa data. Verifique a conexão e tente de novo.'); return; }
  anunciar(`Data aberta: ${rotuloDaData(dia, hojeISO()).dia}`);
  const foco = document.activeElement;
  const emLugarNenhum = !foco || foco === document.body;
  if (estadoDoTrilho() === 'aberto') {
    if (emLugarNenhum || $('#trilho').contains(foco) || foco === $('#btn-data')) fecharPainel();
    else mostrarTrilho('fechado');
  } else if (estadoDoTrilho() === 'fixo' && emLugarNenhum) focarNoCalendario(dia);
}

function mudarMes(meses) {
  mostrarMes(somarMeses(mesDoTrilho(), meses));
  rTrilho();
  lerContagemDosDias();
}

// O botão da data: com o trilho ao lado, leva o foco ao calendário; solto, abre e fecha o painel
$('#btn-data').onclick = () => {
  const estado = estadoDoTrilho();
  if (estado === 'fixo') { focarNoCalendario(); return; }
  if (estado === 'aberto') { mostrarTrilho('fechado'); return; }
  if (DATA) mostrarMes(DATA.slice(0, 7));
  mostrarTrilho('aberto');
  rTrilho();
  lerContagemDosDias();
  focarNoCalendario();
};

$('#trilho').addEventListener('click', e => {
  const botao = e.target.closest('.cal-dia');
  if (botao) { escolherData(botao.dataset.dia); return; }
  // O aviso leva à tela onde se resolve: o painel aberto sai da frente dela
  if (e.target.closest('a.aviso-item') && estadoDoTrilho() === 'aberto' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) mostrarTrilho('fechado');
});
$('#cal-mes-ant').onclick = () => mudarMes(-1);
$('#cal-mes-prox').onclick = () => mudarMes(1);

// Fixar ao lado (da largura média em diante): fica guardado para a classe da largura
$('#btn-fixar-trilho').onclick = () => {
  const classe = classeDaLargura(window.innerWidth);
  if (classe === 'estreita') return;
  const fixo = estadoDoTrilho() !== 'fixo';
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...preferencias(), [classe]: fixo ? 'fixo' : 'solto' }));
  } catch {
    // Sem o armazenamento do navegador, a escolha vale até recarregar
  }
  if (!fixo) { fecharPainel(); return; }
  mostrarTrilho('fixo');
  focarNoCalendario();
};
$('#btn-fechar-trilho').onclick = fecharPainel;

// Esc: o painel fecha (com o foco nele, no botão da data ou em lugar nenhum); ao lado, na grade, o foco volta ao botão
fecharNoEsc(() => (estadoDoTrilho() === 'aberto' ? [$('#btn-data'), $('#trilho')] : null), fecharPainel, { semFoco: true });
$('#cal').addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.stopPropagation();
    $('#btn-data').focus();
    return;
  }
  // Alt e ← ou Cmd e ← (Voltar), Ctrl e Home: do navegador
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const botao = e.target.closest('.cal-dia');
  const alvo = botao && diaDaTecla(botao.dataset.dia, e.key);
  if (!alvo) return;
  e.preventDefault();
  // PageUp e PageDown vão sempre ao mês do dia; as outras, só quando ele não está à vista
  if (e.key.startsWith('Page') ? alvo.slice(0, 7) !== mesDoTrilho() : !semanasAVista().flat().includes(alvo)) {
    mostrarMes(alvo.slice(0, 7));
    rTrilho();
    lerContagemDosDias();
  }
  focarNoCalendario(alvo);
});
