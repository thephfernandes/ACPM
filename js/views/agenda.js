// Agenda de Solicitações: a agenda de papel da secretaria, digitalizada. A lista dos pedidos da data aberta (com a
// situação de cada pedido na demanda), lida do mesmo lugar que a linha usa (js/views/selos.js), e o registro de pedidos,
// com a data do pedido no próprio formulário ("Data do pedido") e o prazo das 13:00 do dia anterior. O calendário é o do
// trilho (js/views/trilho.js).
import { MIS } from '../config.js';
import { duracaoFixaDaMissao } from '../rules.js';
import { horariosDaMissao } from '../horarios.js';
import { S, DATA, isGestor, inativoNaDataAberta, stuBy } from '../state.js';
import { inativo } from '../inativos.js';
import { ApiClient } from '../storage.js';
import { $, trocarConteudo } from '../dom.js';
import { esc, opts, hm, fmtH, somarDias } from '../format.js';
import { registraNaAgenda, operaEscala } from '../perfis.js';
import { recursosDaMissao, recursoValido, JANELAS_DA_AGENDA, FUSO_DO_AEROCLUBE, prazoDaAgendaPermite, prazoDaData, primeiraDataAberta, hojeEmSaoPaulo, datasParaRegistrar } from '../agenda.js';
import { pedidosDaDataAberta } from './selos.js';

const CHAVE_REGISTRADO_POR = 'acpm_agenda_registrado_por';

// A Agenda só se desenha depois de aberta uma vez. O formulário: a data do pedido escolhida, a data aberta quando ela foi
// escolhida (outra data aberta volta o campo ao começo) e os pedidos de uma data que não é a aberta (lidos quando o campo
// muda para ela; sem eles, os dois avisos do formulário ficam de fora, e o servidor ainda confere o limite)
let agendaAberta = false;
let abertaDoFormulario = null;
let dataDoFormulario = null;
let outraData = { data: null, lista: null };

// Quem pode registrar e cancelar: no modo local, quem não está no perfil Gestor; no compartilhado, operadores,
// administradores e a secretaria. A exceção da coordenação é de quem opera a escala (o servidor confere de novo)
export const podeEditarAgenda = () => (ApiClient.perfil ? registraNaAgenda(ApiClient.perfil) : !isGestor());
const podeUsarExcecao = () => (ApiClient.perfil ? operaEscala(ApiClient.perfil) : !isGestor());
// Importar para a demanda também é de quem opera a escala
const podeImportar = podeUsarExcecao;

const ddmm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dataPorExtenso = iso => {
  const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
  return `${semana}, ${ddmm(iso)}/${iso.slice(0, 4)}`;
};
const quando = instante => new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_DO_AEROCLUBE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
}).format(new Date(instante)).replace(',', '');
// O horário e a duração do pedido; os pedidos feitos por período mostram o período
const disponibilidade = p => (p.janela === 'horario'
  ? `${p.horario} · ${fmtH(p.horas === null || p.horas === undefined ? 1 : +p.horas)}`
  : JANELAS_DA_AGENDA.find(([j]) => j === p.janela)?.[1] ?? p.janela);

// Os pedidos de uma data, para os dois avisos do formulário (o limite de voos locais e o voo já marcado): os da data
// aberta, da mesma leitura da lista; os de outra data, da leitura feita quando o campo mudou para ela; sem leitura, null
export function pedidosDaData(dia) {
  const aberta = pedidosDaDataAberta();
  if (dia === DATA) return aberta.leitura === 'lidos' ? aberta.lista : null;
  return outraData.data === dia ? outraData.lista : null;
}
export async function lerOutraData(dia) {
  if (dia === DATA) return;
  outraData = { data: dia, lista: null };
  try {
    const lista = await ApiClient.agenda(dia, dia);
    if (outraData.data === dia) outraData = { data: dia, lista };
  } catch {
    // Sem os pedidos dessa data, os avisos do formulário ficam de fora (o servidor confere o limite)
  }
}
export const pedidosDoAluno = (lista, aluno, dia) => lista.filter(p => p.aluno === aluno && p.data === dia && !p.cancelada_em);
// A missão com o recurso (o pedido de antes não o tem)
export const missaoDoPedido = p => (recursoValido(p) ? `${p.missao} · ${p.recurso}` : p.missao);
export const descreverPedido = p => `${missaoDoPedido(p)} às ${p.horario || disponibilidade(p)}`;

// A Agenda aberta (pela linha ou pelo endereço): lê os pedidos da data e se desenha
export function mostrarAgenda() {
  agendaAberta = true;
  rAgenda();
}

// A data do pedido no formulário
export const diaDoPedido = () => $('#ag-data').value || dataDoFormulario;

export function lembrarRegistradoPor(nome) {
  try {
    localStorage.setItem(CHAVE_REGISTRADO_POR, nome);
  } catch {
    // Sem o armazenamento do navegador, o nome só não fica lembrado para o próximo pedido
  }
}

// O prazo do dia escolhido: até as 13:00 do dia de operação anterior; a segunda, até sábado às 10:00; o domingo não
// opera
const DIAS_DA_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const diaDaSemana = iso => DIAS_DA_SEMANA[new Date(iso + 'T12:00:00Z').getUTCDay()];
function prazoDoDia(diaEscolhido) {
  const prazo = prazoDaData(diaEscolhido);
  if (!prazo) return 'O aeroclube não opera aos domingos: não há escala nem pedidos.';
  const hoje = hojeEmSaoPaulo();
  const quando = prazo.dia === hoje ? 'hoje' : prazo.dia === somarDias(hoje, 1) ? `amanhã (${ddmm(prazo.dia)})` : `${diaDaSemana(prazo.dia)} (${ddmm(prazo.dia)})`;
  const dia = diaEscolhido === somarDias(hoje, 1) ? `amanhã (${ddmm(diaEscolhido)})` : `${diaDaSemana(diaEscolhido)} (${ddmm(diaEscolhido)})`;
  if (!prazoDaAgendaPermite(diaEscolhido)) {
    return `Prazo encerrado para ${ddmm(diaEscolhido)}: os pedidos iam até ${quando === 'hoje' ? 'hoje' : quando} às ${prazo.hora}.` +
      (podeUsarExcecao() ? ' Se for estritamente necessário, use a Exceção da Coordenação.' : '');
  }
  return `Pedidos para ${dia} até ${quando} às ${prazo.hora}.`;
}

// Na data aberta no topo, a situação de cada pedido: já importado para a demanda ou ainda não (nas outras datas a
// demanda não está carregada)
const importado = p => (S.importadas || []).includes(p.id);
// O pedido do aluno inativo no cadastro fica registrado, fora dos pendentes: ele entra quando o aluno voltar a ativo
const deAlunoInativo = p => inativoNaDataAberta(stuBy(p.aluno));
const pendentesDaDataAberta = () => (pedidosDaData(DATA) || []).filter(p => p.data === DATA && !p.cancelada_em && !importado(p) && !deAlunoInativo(p));
function situacao(p) {
  // Cancelado: a etiqueta numa linha; quem cancelou e quando ficam na dica (e para o leitor de tela)
  if (p.cancelada_em) {
    const detalhe = `por ${esc(p.cancelada_por)} em ${quando(p.cancelada_em)}`;
    return `<span class="tag" title="Cancelado ${detalhe}">Cancelado</span><span class="sr"> ${detalhe}</span>`;
  }
  if (p.data !== DATA) return '';
  if (importado(p)) return '<span class="tag grp">Na demanda</span>';
  return deAlunoInativo(p) ? '<span class="tag">Aluno inativo</span>' : '<span class="tag fb">Ainda não importado</span>';
}

function listaHTML() {
  const { leitura } = pedidosDaDataAberta();
  if (leitura === 'erro') return '<p class="h">Não foi possível ler os pedidos desta data. Verifique a conexão.</p>';
  if (leitura !== 'lidos') return '<p class="h">Lendo os pedidos desta data…</p>';
  const doDia = (pedidosDaData(DATA) || []).filter(p => p.data === DATA);
  if (!doDia.length) return '<p class="h">Nenhum pedido para esta data.</p>';
  // Uma linha por pedido: a observação fica sob o nome do aluno e a conta que registrou, na dica de "Registrado por"
  // (quase sempre é a mesma em todas as linhas)
  return `<table><thead><tr><th>Registrado em</th><th>Aluno</th><th>Fase / missão</th><th>Horário</th><th>Registrado por</th><th>Situação</th><th aria-label="Ações"></th></tr></thead>
    <tbody>${doDia.map(p => `<tr${p.cancelada_em ? ' class="cancel"' : ''}>
      <td>${quando(p.registrado_em)}</td>
      <td><b>${esc(p.aluno_nome)}</b>${p.observacao ? `<small class="obs">${esc(p.observacao)}</small>` : ''}</td>
      <td>${esc(missaoDoPedido(p))}</td>
      <td>${esc(disponibilidade(p))}</td>
      <td class="por"${p.conta && p.conta !== p.registrado_por ? ` title="Conta: ${esc(p.conta)}"` : ''}>${esc(p.registrado_por)}${p.excecao ? ' <span class="tag fb">Exceção da coordenação</span>' : ''}</td>
      <td class="situacao">${situacao(p)}</td>
      <td>${p.cancelada_em ? '' : `<button class="x agenda-acao" data-act="cancelar-pedido" data-id="${p.id}">Cancelar</button>`}</td>
    </tr>`).join('')}</tbody></table>`;
}

// O formulário: a missão decide os recursos, e os dois, os horários. O campo com um valor só o recebe sozinho (data-sozinho):
// ele não é uma escolha da pessoa, e não fica para a missão seguinte. O horário escolhido que espera a lista (a missão ou o
// recurso ainda por escolher, ou a missão de um horário só) volta quando ela o tem; quando ela não o tem, o campo diz por que
// ele saiu. O campo diz também quando o horário posto pelo app sai ou dá lugar a outro
let horarioEscolhido = '';
let avisoDoHorario = '';

// As opções só mudam quando são outras: o redesenho não mexe no campo que a pessoa está usando
function preencher(campo, valores, vazio, valor, escolhido) {
  const opcoes = [...(vazio ? [['', vazio]] : []), ...valores.map(v => [v, v])];
  if (JSON.stringify(opcoes) !== JSON.stringify([...campo.options].map(o => [o.value, o.text]))) campo.innerHTML = opts(opcoes, valor);
  campo.value = valor;
  if (valor && valor !== escolhido) campo.dataset.sozinho = '1';
  else delete campo.dataset.sozinho;
}
const escolhaDaPessoa = campo => (campo.dataset.sozinho ? '' : campo.value);
// O valor que fica: o escolhido, se a lista o tem; o único da lista; senão, nenhum
const valorNaLista = (lista, escolhido) => (lista.includes(escolhido) ? escolhido : lista.length === 1 ? lista[0] : '');

function atualizarRecurso() {
  const campo = $('#ag-recurso'), missao = $('#ag-missao').value;
  const tipos = recursosDaMissao(missao), escolhido = escolhaDaPessoa(campo);
  preencher(campo, tipos, tipos.length === 1 ? null : missao ? 'Escolha o recurso…' : 'Escolha antes a missão…', valorNaLista(tipos, escolhido), escolhido);
  campo.disabled = !missao;
}

function atualizarHorario() {
  const campo = $('#ag-horario'), aluno = $('#ag-aluno').value, missao = $('#ag-missao').value, recurso = $('#ag-recurso').value;
  const lista = missao && recurso ? horariosDaMissao(S.horarios, missao, recurso).map(hm) : [];
  const doApp = campo.dataset.sozinho ? campo.value : '';
  const escolhido = escolhaDaPessoa(campo) || horarioEscolhido;
  const valor = valorNaLista(lista, escolhido);
  horarioEscolhido = lista.length > 1 || valor === escolhido ? '' : escolhido;
  // O horário do app que continua no campo não é dito de novo
  if (lista.length && !(doApp && valor === doApp)) {
    if (escolhido && valor !== escolhido) avisoDoHorario = `O horário ${escolhido} não é um dos de ${missao} (${recurso}). ${valor ? `Agora é ${valor}.` : 'Escolha outro.'}`;
    else if (doApp) avisoDoHorario = valor ? `O horário agora é ${valor}.` : `O horário ${doApp} era o único da escolha anterior. Escolha o horário.`;
  }
  preencher(campo, lista, lista.length === 1 ? null : 'Escolha o horário…', valor, escolhido);
  campo.disabled = !(aluno && missao && recurso);
  const faltam = [!aluno && 'o aluno', !missao && 'a missão', !recurso && 'o recurso'].filter(Boolean);
  const texto = [avisoDoHorario, faltam.length ? `Antes, escolha ${emLista(faltam)}.` : ''].filter(Boolean).join(' ');
  if ($('#ag-horario-motivo').textContent !== texto) $('#ag-horario-motivo').textContent = texto;
}
export const emLista = itens => (itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}` : itens.join(''));

// Os horários do recurso escolhido, como estão agora no cadastro (a missão, o recurso e o horário que ainda valem ficam)
export function atualizarRecursoEHorario() {
  atualizarRecurso();
  atualizarHorario();
}

// Uma escolha nova (o aluno, a missão, o recurso ou o horário): o aviso do horário que saiu era da anterior
export function escolherNaAgenda() {
  avisoDoHorario = '';
  atualizarRecursoEHorario();
}

// Os horários que mudaram no cadastro com a Agenda aberta (o "↶ Reverter" do Histórico, por exemplo): só eles são refeitos
export function rHorariosDoPedido() {
  if ($('#ag-missao').options.length) atualizarRecursoEHorario();
}

// Depois de registrar, saem o aluno e a observação; a missão, o recurso e o horário do pedido ficam, e o horário escolhido
// antes dele não vale mais
export function esvaziarPedidoRegistrado() {
  $('#ag-obs').value = '';
  $('#ag-aluno').value = '';
  horarioEscolhido = '';
  escolherNaAgenda();
}

// A missão nova: a duração dela, os recursos e os horários
export function escolherMissaoNaAgenda() {
  const missao = $('#ag-missao').value;
  const padrao = Object.hasOwn(MIS, missao) && MIS[missao].duracaoPadrao;
  const horas = $('#ag-horas');
  // O Ground (01h30) e o Noturno (4 h no dia: o translado e o noturno em BH) têm a duração fixa
  const fixa = duracaoFixaDaMissao(missao);
  if (fixa) { horas.dataset.antes = horas.dataset.antes || horas.value; horas.value = String(fixa); horas.disabled = true; }
  else if (horas.disabled) { horas.value = horas.dataset.antes || '1'; delete horas.dataset.antes; horas.disabled = false; }
  // A missão com duração padrão (o simulador, 2 h) começa com ela; saindo dela, volta a 1 h
  if (!fixa && padrao) { horas.value = String(padrao); horas.dataset.padrao = '1'; }
  else if (!fixa && horas.dataset.padrao) { horas.value = '1'; delete horas.dataset.padrao; }
  escolherNaAgenda();
}

// As opções de "Data do pedido": ela começa na data aberta, quando ela aceita pedidos, e senão na primeira que aceita; e
// volta para lá quando a data aberta muda
function rDataDoPedido() {
  const datas = datasParaRegistrar({ aberta: DATA, excecao: podeUsarExcecao() });
  const inicial = datas.some(d => d.data === DATA && !d.encerrado) ? DATA : primeiraDataAberta();
  if (abertaDoFormulario !== DATA || !datas.some(d => d.data === dataDoFormulario)) {
    abertaDoFormulario = DATA;
    dataDoFormulario = inicial;
  }
  $('#ag-data').innerHTML = opts(datas.map(d => [d.data, d.rotulo]), dataDoFormulario);
  $('#ag-data').value = dataDoFormulario;
}
export function escolherDataDoPedido(dia) { dataDoFormulario = dia; }

export function rAgenda() {
  if (!agendaAberta || !DATA) return;
  rDataDoPedido();
  const dia = diaDoPedido();
  $('#agenda-prazo').textContent = prazoDoDia(dia);
  $('#agenda-data').textContent = dataPorExtenso(DATA);
  trocarConteudo($('#agenda-lista'), listaHTML());
  const pendentes = pendentesDaDataAberta().length;
  $('#agenda-importar').hidden = !pendentes || !podeImportar();
  $('#agenda-importar').textContent = `Importar ${pendentes} ${pendentes === 1 ? 'pedido' : 'pedidos'} para a demanda`;

  // Formulário: alunos do cadastro, missões, disponibilidade e quem anotou (lembrado neste computador)
  const aluno = $('#ag-aluno').value;
  $('#ag-aluno').innerHTML = `<option value="">Escolha o aluno…</option>` +
    [...S.stu].filter(s => !inativo(s)).sort((a, b) => a.nm.localeCompare(b.nm)).map(s => `<option value="${s.id}">${esc(s.nm)}</option>`).join('');
  $('#ag-aluno').value = aluno;
  if (!$('#ag-missao').options.length) {
    $('#ag-missao').innerHTML = opts([['', 'Escolha a missão…'], ...Object.keys(MIS).map(m => [m, m])], '');
    try {
      $('#ag-por').value = localStorage.getItem(CHAVE_REGISTRADO_POR) || '';
    } catch {
      // Sem o armazenamento do navegador, o campo começa vazio
    }
  }
  // O aluno que saiu do cadastro (ou ficou inativo) sai do campo; os horários acompanham o cadastro
  if ($('#ag-aluno').selectedIndex < 0) $('#ag-aluno').value = '';
  atualizarRecursoEHorario();
  const aberto = prazoDaAgendaPermite(dia);
  $('#form-agenda [type="submit"]').disabled = !aberto;
  $('#ag-excecao').hidden = aberto || !podeUsarExcecao();
}
