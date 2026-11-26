// O trilho: o botão da data no topo, o calendário (um clique, Enter ou Espaço abre a data; as setas, Home, End, PageUp e
// PageDown andam pela grade; Esc volta ao botão da data), as setas do mês, "Fixar ao lado" e o painel que fecha. É o único
// que troca a data depois da abertura (carregarData). Os desenhos: o nome da data no botão, o mês da data aberta, o
// calendário e os pedidos de cada dia
import { carregarData, dadosLidos } from '../actions.js';
import { $, showToast, anunciar } from '../dom.js';
import { dataIsoValida, hojeISO, rotuloDaData } from '../format.js';
import { diaDaTecla, somarMeses } from '../calendario.js';
import { DATA } from '../state.js';
import { ApiClient } from '../storage.js';
import { classeDaLargura, trilhoFixo, lerPreferencias } from '../telas.js';
import { registrarDesenho } from '../redesenho.js';
import {
  rTrilho, rAvisos, rRotuloDaData, mostrarTrilho, estadoDoTrilho, mostrarMes, mesDoTrilho, marcarAbrindo, diaAbrindo,
  guardarContagem, semanasAVista, focarNoCalendario
} from '../views/trilho.js';

const CHAVE = 'acpm_trilho';
const DOMINGO = 'O aeroclube não opera aos domingos: não há escala nem pedidos.';

// O aviso do domingo (um link para um domingo abre a segunda)
export const avisoDeDomingo = segunda => `O aeroclube não opera aos domingos: abrimos segunda-feira, ${segunda.slice(8, 10)}/${segunda.slice(5, 7)}.`;

const ehDomingo = iso => new Date(iso + 'T12:00:00Z').getUTCDay() === 0;

// Os pedidos de cada dia das semanas à vista (para todos os perfis). Só depois de os dados da primeira data chegarem: antes
// da sessão, o app ainda lê deste navegador. Sem resposta, os dias ficam sem número
let leitura = 0;
function lerContagem() {
  if (!dadosLidos) return;
  const vez = ++leitura;
  const semanas = semanasAVista();
  const mes = mesDoTrilho();
  ApiClient.contagemDaAgenda(semanas[0][0], semanas.at(-1).at(-1))
    .then(valores => valores, () => ({}))
    .then(valores => {
      if (vez !== leitura || mes !== mesDoTrilho()) return;
      guardarContagem(valores);
      rTrilho();
    });
}

// Os desenhos (js/redesenho.js): ao abrir uma data, o nome dela no topo e o mês dela no calendário; o calendário em todos os
// momentos; os pedidos de cada dia quando os dados chegam e depois de os pedidos mudarem
registrarDesenho('rotulo-da-data', rRotuloDaData, { em: ['data-aberta'], ordem: 1 });
registrarDesenho('mes-do-trilho', () => { if (DATA) mostrarMes(DATA.slice(0, 7)); }, { em: ['data-aberta'], ordem: 3 });
registrarDesenho('trilho', rTrilho, { em: ['data-aberta', 'dados', 'consulta', 'releitura', 'escala', 'perfil', 'pedidos'], ordem: 97 });
registrarDesenho('contagem-do-trilho', lerContagem, { em: ['dados', 'pedidos'], ordem: 98 });
// Os avisos da data: com os dados dela (enquanto outra data abre, ficam os da aberta)
registrarDesenho('avisos-da-data', rAvisos, { em: ['dados', 'consulta', 'releitura', 'escala', 'perfil', 'pedidos'], ordem: 97 });

function preferencias() {
  try {
    return lerPreferencias(localStorage.getItem(CHAVE));
  } catch {
    return {};
  }
}

// Ao lado ou não, pela largura da janela e pelo que a pessoa guardou; o painel aberto fecha quando a largura muda de classe
function aplicarLargura() {
  mostrarTrilho(trilhoFixo(classeDaLargura(window.innerWidth), preferencias()) ? 'fixo' : 'fechado');
  rTrilho();
}
aplicarLargura();
matchMedia('(min-width: 1024px)').addEventListener('change', aplicarLargura);
matchMedia('(min-width: 1280px)').addEventListener('change', aplicarLargura);

// Abre a data escolhida no calendário. Até os dados dela chegarem, a data aberta, o anel e o topo continuam na de antes; o
// dia escolhido fica "abrindo". Aberta, ela é anunciada; o painel fecha e o foco volta ao botão da data (ao lado, o foco
// fica no dia)
async function escolherData(dia) {
  if (dia === DATA || !dataIsoValida(dia)) return;
  if (ehDomingo(dia)) { showToast(DOMINGO); return; }
  const estado = estadoDoTrilho();
  marcarAbrindo(dia);
  rTrilho();
  try {
    await carregarData(dia);
  } catch {
    if (diaAbrindo() === dia) marcarAbrindo(null);
    rTrilho();
    showToast('Não foi possível abrir essa data. Verifique a conexão e tente de novo.');
    return;
  }
  if (diaAbrindo() !== dia) return;
  marcarAbrindo(null);
  rTrilho();
  if (DATA !== dia) return;
  anunciar(`Data aberta: ${rotuloDaData(dia, hojeISO()).dia}`);
  if (estado === 'aberto' && estadoDoTrilho() === 'aberto') {
    mostrarTrilho('fechado');
    $('#btn-data').focus();
  } else if (estadoDoTrilho() === 'fixo') focarNoCalendario(dia);
}

function mudarMes(meses) {
  mostrarMes(somarMeses(mesDoTrilho(), meses));
  rTrilho();
  lerContagem();
}

// O botão da data: com o trilho ao lado, leva o foco ao calendário; solto, abre e fecha o painel
$('#btn-data').onclick = () => {
  const estado = estadoDoTrilho();
  if (estado === 'fixo') { focarNoCalendario(); return; }
  if (estado === 'aberto') { mostrarTrilho('fechado'); return; }
  if (DATA) mostrarMes(DATA.slice(0, 7));
  mostrarTrilho('aberto');
  rTrilho();
  lerContagem();
  focarNoCalendario();
};

$('#trilho').addEventListener('click', e => {
  const botao = e.target.closest('.cal-dia');
  if (!botao) return;
  const dia = botao.dataset.dia;
  if (botao.classList.contains('domingo')) { showToast(DOMINGO); return; }
  escolherData(dia);
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
  mostrarTrilho(fixo ? 'fixo' : 'fechado');
  if (fixo) focarNoCalendario();
  else $('#btn-data').focus();
};
$('#btn-fechar-trilho').onclick = () => {
  mostrarTrilho('fechado');
  $('#btn-data').focus();
};

// As teclas da grade; Esc fecha o painel (ao lado, só volta ao botão da data)
$('#trilho').addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    if (estadoDoTrilho() === 'aberto') mostrarTrilho('fechado');
    $('#btn-data').focus();
    return;
  }
  const botao = e.target.closest('.cal-dia');
  const alvo = botao && diaDaTecla(botao.dataset.dia, e.key);
  if (!alvo) return;
  e.preventDefault();
  if (!semanasAVista().flat().includes(alvo)) {
    mostrarMes(alvo.slice(0, 7));
    rTrilho();
    lerContagem();
  }
  focarNoCalendario(alvo);
});
