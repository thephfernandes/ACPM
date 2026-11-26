// Agenda de Solicitações: a agenda de papel da secretaria, digitalizada. Os pedidos da data aberta (com a situação de cada um
// na demanda) e o registro de pedidos, cada um para a data dele ("Data do pedido"), com o prazo das 13:00 do dia anterior.
import { MIS } from '../config.js';
import { duracaoFixaDaMissao } from '../rules.js';
import { horariosDaMissao } from '../horarios.js';
import { S, DATA, isGestor, inativoNaDataAberta, stuBy } from '../state.js';
import { inativo } from '../inativos.js';
import { ApiClient } from '../storage.js';
import { $, trocarConteudo } from '../dom.js';
import { esc, opts, hm, fmtH, somarDias } from '../format.js';
import { registraNaAgenda, operaEscala } from '../perfis.js';
import { recursosDaMissao, recursoValido, JANELAS_DA_AGENDA, FUSO_DO_AEROCLUBE, prazoDaAgendaPermite, prazoDaData, datasParaRegistrar, hojeEmSaoPaulo } from '../agenda.js';
import { pedidosDaDataAberta, pedidosDaDataAbertaLidos, lerPedidosDaData } from './selos.js';

const CHAVE_REGISTRADO_POR = 'acpm_agenda_registrado_por';

// Até a Agenda ser aberta uma vez, ela não é desenhada
let agendaAberta = false;
export function abrirAgenda() {
  agendaAberta = true;
  // Aberta de novo, os pedidos da data do formulário também são lidos de novo
  lidosPara = null;
}

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

// A missão com o recurso (o pedido de antes não o tem)
export const missaoDoPedido = p => (recursoValido(p) ? `${p.missao} · ${p.recurso}` : p.missao);
export const descreverPedido = p => `${missaoDoPedido(p)} às ${p.horario || disponibilidade(p)}`;
// Um pedido da lista (a da data aberta), para a confirmação do cancelamento
export const pedidoDaLista = id => (pedidosDaDataAberta().lista || []).find(p => p.id === id);

// "Data do pedido": a data em que o pedido vai ser registrado, um campo dele (a tela continua na data aberta). Começa na data
// aberta, se ela aceita pedidos, ou na primeira que aceita; volta a isso quando a data aberta muda e fica entre um registro
// e outro
let dataDoPedido = null;
let abertaDoCampo = null;
let opcoesDesenhadas = null;
export const dataDoFormulario = () => dataDoPedido;
export function escolherDataDoPedido(data) {
  dataDoPedido = data;
  mudouADataDoPedido();
  desenharFormulario();
}
// Outra data: o que o formulário dizia da anterior (o erro, a confirmação armada) sai
function mudouADataDoPedido() {
  desarmarConfirmacaoDaAgenda();
  apagarErroDaAgenda();
}
// O "Registrar mesmo assim" (o aluno que já tem voo marcado) volta a ser "Registrar pedido"
export function desarmarConfirmacaoDaAgenda() {
  delete $('#form-agenda').dataset.confirmado;
  nomearRegistrar();
}
// Enquanto um pedido é registrado (a leitura dos pedidos da data dele, a gravação), o botão clicado diz "Registrando…"
export function nomearRegistrar() {
  const form = $('#form-agenda');
  if (!form.hasAttribute('aria-busy')) form.querySelector('[type="submit"]').textContent = form.dataset.confirmado ? 'Registrar mesmo assim' : 'Registrar pedido';
}
// Os campos do pedido com erro (aria-invalid): o leitor de tela diz qual campo e lê o motivo (#ag-erro é a descrição deles)
export const marcarInvalidos = (...ids) => ['#ag-aluno', '#ag-missao', '#ag-recurso', '#ag-horario', '#ag-horas', '#ag-por'].forEach(id => $(id).setAttribute('aria-invalid', String(ids.includes(id))));
export function apagarErroDaAgenda() {
  $('#ag-erro').textContent = '';
  marcarInvalidos();
}

// "sex 20/11 (amanhã) · prazo encerrado"
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const dataCurta = iso => `${DIAS_CURTOS[new Date(iso + 'T12:00:00Z').getUTCDay()]} ${ddmm(iso)}`;
function rotuloDaOpcao({ data, fechada }, hoje) {
  const relativo = data === hoje ? ' (hoje)' : data === somarDias(hoje, 1) ? ' (amanhã)' : '';
  return `${dataCurta(data)}${relativo}${fechada ? ' · prazo encerrado' : ''}`;
}

// Os pedidos da data do formulário, para o aviso de voo já marcado e o limite de voos locais: os da data aberta são os de
// js/views/selos.js; os de outra data são lidos uma vez para cada par de data aberta e data do campo (o que foi lido antes
// de a data aberta mudar pode ser de antes de um pedido), quando o perfil passa a registrar e ao abrir a Agenda. Quem
// registra espera pela leitura; se ela falhou (null), as duas conferências não são feitas (o servidor ainda recusa o 7º
// voo local)
let deOutraData = { data: null, leitura: null };
let lidosPara = null;
function lerDeOutraData(data) {
  deOutraData = { data, leitura: ApiClient.agenda(data, data).catch(() => null) };
}
function lerPedidosDoFormulario() {
  const para = podeEditarAgenda() && dataDoPedido !== DATA ? `${DATA} ${dataDoPedido}` : null;
  if (para === lidosPara) return;
  lidosPara = para;
  if (para) lerDeOutraData(dataDoPedido);
}
export async function pedidosDoFormulario(data) {
  if (data === DATA) {
    const daData = await pedidosDaDataAbertaLidos();
    // Outra data pode ter aberto durante a espera
    if (daData.data === data) return daData.lista;
  }
  if (deOutraData.data !== data) lerDeOutraData(data);
  return deOutraData.leitura;
}
// Depois de registrar: os pedidos da data em que ele entrou são lidos de novo
export async function lerPedidosDaAgenda(data) {
  if (data !== DATA && data === dataDoPedido) lerDeOutraData(data);
  else await lerPedidosDaData();
}

export function lembrarRegistradoPor(nome) {
  try {
    localStorage.setItem(CHAVE_REGISTRADO_POR, nome);
  } catch {
    // Sem o armazenamento do navegador, o nome só não fica lembrado para o próximo pedido
  }
}

// O prazo da data do pedido: até as 13:00 do dia de operação anterior; a segunda, até sábado às 10:00
const DIAS_DA_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const diaDaSemana = iso => DIAS_DA_SEMANA[new Date(iso + 'T12:00:00Z').getUTCDay()];
function textoDoPrazo() {
  const prazo = prazoDaData(dataDoPedido);
  if (!prazo) return 'O aeroclube não opera aos domingos: não há escala nem pedidos.';
  const hoje = hojeEmSaoPaulo();
  const quando = prazo.dia === hoje ? 'hoje' : prazo.dia === somarDias(hoje, 1) ? `amanhã (${ddmm(prazo.dia)})` : `${diaDaSemana(prazo.dia)} (${ddmm(prazo.dia)})`;
  const dia = dataDoPedido === somarDias(hoje, 1) ? `amanhã (${ddmm(dataDoPedido)})` : `${diaDaSemana(dataDoPedido)} (${ddmm(dataDoPedido)})`;
  if (!prazoDaAgendaPermite(dataDoPedido)) {
    return `Prazo encerrado para ${ddmm(dataDoPedido)}: os pedidos iam até ${quando} às ${prazo.hora}.` +
      (podeUsarExcecao() ? ' Se for estritamente necessário, use a Exceção da Coordenação.' : '');
  }
  return `Pedidos para ${dia} até ${quando} às ${prazo.hora}.`;
}

// A situação de cada pedido da data aberta: já importado para a demanda ou ainda não
const importado = p => (S.importadas || []).includes(p.id);
// O pedido do aluno inativo no cadastro fica registrado, fora dos pendentes: ele entra quando o aluno voltar a ativo
const deAlunoInativo = p => inativoNaDataAberta(stuBy(p.aluno));
const pendentesDaDataAberta = () => (pedidosDaDataAberta().lista || []).filter(p => !p.cancelada_em && !importado(p) && !deAlunoInativo(p));
function situacao(p) {
  // Cancelado: a etiqueta numa linha; quem cancelou e quando ficam na dica (e para o leitor de tela)
  if (p.cancelada_em) {
    const detalhe = `por ${esc(p.cancelada_por)} em ${quando(p.cancelada_em)}`;
    return `<span class="tag" title="Cancelado ${detalhe}">Cancelado</span><span class="sr"> ${detalhe}</span>`;
  }
  if (importado(p)) return '<span class="tag grp">Na demanda</span>';
  return deAlunoInativo(p) ? '<span class="tag">Aluno inativo</span>' : '<span class="tag fb">Ainda não importado</span>';
}

function listaHTML() {
  const { lista: doDia, leitura } = pedidosDaDataAberta();
  if (leitura === 'lendo') return '<p class="h">Lendo os pedidos desta data…</p>';
  if (leitura === 'erro') return '<p class="h">Não foi possível ler os pedidos desta data. Verifique a conexão.</p>';
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

// A data do pedido, o prazo dela e os botões: registrar, até o prazo; a exceção, depois dele, de quem opera a escala
function desenharFormulario() {
  const hoje = hojeEmSaoPaulo();
  const { opcoes, padrao } = datasParaRegistrar(hoje, DATA, { excecao: podeUsarExcecao() });
  const antes = dataDoPedido;
  if (abertaDoCampo !== DATA || !opcoes.some(o => o.data === dataDoPedido)) dataDoPedido = padrao;
  abertaDoCampo = DATA;
  if (dataDoPedido !== antes) mudouADataDoPedido();
  lerPedidosDoFormulario();
  const campo = $('#ag-data');
  const html = opts(opcoes.map(o => [o.data, rotuloDaOpcao(o, hoje)]), dataDoPedido);
  // Iguais, as opções ficam (a lista pode estar aberta)
  if (opcoesDesenhadas !== html) { campo.innerHTML = html; opcoesDesenhadas = html; }
  campo.value = dataDoPedido;
  $('#agenda-prazo').textContent = textoDoPrazo();
  const aberto = prazoDaAgendaPermite(dataDoPedido);
  $('#form-agenda [type="submit"]').disabled = !aberto;
  $('#ag-excecao').hidden = aberto || !podeUsarExcecao();
}

export function rAgenda() {
  if (!agendaAberta || !DATA) return;
  $('#agenda-data').textContent = dataPorExtenso(DATA);
  trocarConteudo($('#agenda-lista'), listaHTML());
  const pendentes = pendentesDaDataAberta().length;
  $('#agenda-importar').hidden = !pendentes || !podeImportar();
  $('#agenda-importar').textContent = `Importar ${pendentes} ${pendentes === 1 ? 'pedido' : 'pedidos'} para a demanda`;

  // Formulário: a data, os alunos do cadastro, as missões, a disponibilidade e quem anotou (lembrado neste computador)
  desenharFormulario();
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
}
