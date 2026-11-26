// Os pedidos da data aberta (a linha, o trilho, a Agenda e a Demanda leem daqui) e os dois selos que ainda não são da linha: o de Recursos no
// botão da Disponibilidade do dia (aviões parados ou com menos de 5 h até a revisão de 50 horas) e o número de pedidos no
// botão de importar, na Demanda
import { $ } from '../dom.js';
import { RES, S, DATA, isGestor, inativoNaDataAberta, stuBy } from '../state.js';
import { REVISAO_H } from '../config.js';
import { ApiClient } from '../storage.js';
import { redesenhar } from '../redesenho.js';

const PERTO_DA_REVISAO_H = 5;

// Pedidos da agenda para a data aberta: lidos ao abrir a data e depois de mudanças na agenda. leitura: 'lendo', 'lidos' ou
// 'erro' (sem conexão: a linha diz que falhou)
let pedidosDaData = { data: null, lista: null, leitura: 'lendo' };
let leituras = 0;
let emCurso = null;

export function lerPedidosDaData() {
  const leitura = { data: DATA, vez: ++leituras };
  emCurso = leitura;
  leitura.fim = ler(leitura);
  return leitura.fim;
}

async function ler({ data, vez }) {
  let lista = null, leitura = 'lidos';
  try {
    lista = await ApiClient.agenda(data, data);
  } catch {
    leitura = 'erro';
  }
  // Outra data aberta, ou uma leitura pedida depois desta (a resposta dela é a que vale)
  if (vez !== leituras) return;
  emCurso = null;
  if (data !== DATA) return;
  pedidosDaData = { data, lista, leitura };
  redesenhar('pedidos');
}

// Os pedidos da data aberta e o estado da leitura (de outra data: ainda lendo)
export const pedidosDaDataAberta = () => (pedidosDaData.data === DATA ? pedidosDaData : { data: DATA, lista: null, leitura: 'lendo' });

// Os mesmos, depois da leitura em curso (a data que acabou de abrir, um pedido que acabou de ser registrado)
export async function pedidosDaDataAbertaLidos() {
  while (emCurso && emCurso.data === DATA) await emCurso.fim;
  if (pedidosDaDataAberta().leitura === 'lendo') await lerPedidosDaData();
  return pedidosDaDataAberta();
}

const pedidosPendentes = () => (pedidosDaDataAberta().lista || [])
  .filter(s => !s.cancelada_em && !(S.importadas || []).includes(s.id) && !inativoNaDataAberta(stuBy(s.aluno)));

export function atualizarSelos() {
  const revisao = (RES && RES.revisao) || {};
  const atencao = Object.entries(revisao)
    .filter(([r, v]) => S.av[r] !== false && !inativoNaDataAberta((S.frota || []).find(f => f.reg === r)) && (v.paraAs !== null || REVISAO_H - v.fim < PERTO_DA_REVISAO_H)).length;
  const selo = $('#selo-rec-dia');
  if (selo) {
    selo.hidden = !atencao;
    selo.textContent = atencao ? String(atencao) : '';
    selo.className = 'aba-selo aviso';
    selo.title = atencao ? `${atencao} ${atencao === 1 ? 'avião parado ou perto' : 'aviões parados ou perto'} da revisão de 50 horas` : '';
  }
  // Na Demanda, o botão diz quantos pedidos há para importar (e só se destaca quando há). Quem consulta não importa
  const n = isGestor() ? 0 : pedidosPendentes().length;
  const botao = $('#importar-agenda');
  if (!botao) return;
  botao.textContent = n ? `Importar ${n} ${n === 1 ? 'pedido' : 'pedidos'} da agenda` : 'Importar da agenda';
  botao.classList.toggle('sec', !n);
}
