// O diálogo "Agendar voo" (#dlg-agendar, aberto pela Escala): o operador escolhe o aluno, a missão, o recurso, o
// instrutor, o horário, a duração e o peso; o resto vem do formulário (js/agendamento.js), refeito na hora a cada mudança.
// A conferência (o motor numa cópia do estado) roda 150 ms depois da última mudança, com "calculando…" na prévia; o envio
// com a conferência pendente roda ela antes. Enquanto o diálogo está aberto, tudo o que ele diz fica dentro dele (sob um
// diálogo modal, o aviso e o anúncio da página saem da árvore de acessibilidade). Os bloqueios não deixam agendar (o
// primeiro vai para o alerta, com o foco no campo dele), e as alternativas livres deles (outro horário, recurso ou
// instrutor) são botões que escolhem na hora; os avisos pedem "Agendar mesmo assim" (o peso que falta para antes no
// campo dele); outro conjunto de avisos pede outra confirmação. Um voo de hoje do aluno muda de lugar ("Mover o voo") ou
// entra na escala ("Encaixar o voo"); no Ground, o select Instrutor também tem as turmas do dia. Esc e Voltar desistem,
// e nada muda.
import { S, DATA, isGestor, stuBy, dadoIndisponivel, estadoDaEscala } from '../state.js';
import { ApiClient } from '../storage.js';
import { runAllocationEngine } from '../engine.js';
import { ligada } from '../funcionalidades.js';
import { situacaoPorMissao } from '../resultados.js';
import { contextoInicial, formularioDoAgendamento, simularAgendamento, avaliarAgendamento, comPesos, assinaturaDosAvisos, escolhasDaAlternativa } from '../agendamento.js';
import { $ } from '../dom.js';
import { esc, hm, hojeISO, minutoDoDia } from '../format.js';

// O diálogo aberto: o contexto, a escala de agora (base), o que o operador escolheu e mudou, o formulário e a conferência
let pedido = null;
const ESPERA_DA_CONFERENCIA = 150;

// A situação de cada missão, calculada uma vez por leitura dos resultados
const situacoes = new WeakMap();
function situacao() {
  const registros = (S.resultados && S.resultados.situacao) || [];
  if (!situacoes.has(registros)) situacoes.set(registros, situacaoPorMissao(registros));
  return situacoes.get(registros);
}

// O que o diálogo sabe da data: o programa (sem os programas, nenhum, e a missão do aluno com curso não é sugerida), se
// a ordem do curso pode ser conferida (sem os resultados, não), a data, hoje, agora e se as horas dos instrutores foram
// lidas. Com o progresso desligado (js/funcionalidades.js), como sem os programas: nenhuma missão do curso nas opções, e a
// missão do aluno com curso não é sugerida
function ambiente() {
  const programaIndisponivel = !ligada('progresso') || ['cursos', 'cursos-pendentes'].some(dadoIndisponivel);
  const programa = programaIndisponivel ? [] : S.programa || [];
  return {
    programa, programaIndisponivel, inferir: !dadoIndisponivel('resultados') && programa.length > 0, situacao: situacao(),
    data: DATA, hoje: hojeISO(), agora: minutoDoDia(), semHoras: dadoIndisponivel('horas')
  };
}

// Os campos que o formulário preenche (o select ou o input de cada um)
const CAMPOS = ['agd-aluno', 'agd-missao', 'agd-tipo', 'agd-recurso', 'agd-instrutor', 'agd-horario', 'agd-outro-horario', 'agd-horas', 'agd-kg-aluno', 'agd-kg-instrutor'];
const campo = id => document.getElementById(id);
// O texto de um campo numérico: o que não é número (validity.badInput: o navegador esvazia o value) fica inválido
const textoDoCampo = el => (el.validity && el.validity.badInput ? '?' : el.value);

const opcao = (o, valor) => `<option value="${esc(o.valor)}"${String(o.valor) === String(valor) ? ' selected' : ''}${o.desligada ? ' disabled' : ''}>${esc(o.texto)}</option>`;
const emGrupos = (grupos, valor) => grupos.map(g => `<optgroup label="${esc(g.rotulo)}">${g.opcoes.map(o => opcao(o, valor)).join('')}</optgroup>`).join('');
// Troca o conteúdo só quando muda (o select com o foco continua o mesmo elemento, com a mesma lista aberta)
const desenhado = new WeakMap();
function trocar(el, html) {
  if (desenhado.get(el) === html) return;
  el.innerHTML = html;
  desenhado.set(el, html);
}
function preencher(id, html, valor) {
  const el = campo(id);
  trocar(el, html);
  el.value = valor === null || valor === undefined ? '' : String(valor);
}
// O valor de um campo de digitar: o campo com o foco fica como a pessoa está digitando (um número pela metade, que o
// navegador ainda não aceita, não é apagado)
const definir = (id, valor) => {
  const el = campo(id);
  if (el !== document.activeElement && el.value !== valor) el.value = valor;
};

// O título do diálogo pelo que o agendamento faz (o voo de hoje do aluno: mover ou encaixar)
const TITULO = { agendar: 'Agendar voo', mover: 'Mover o voo', encaixar: 'Encaixar o voo' };
// O valor de uma turma de Ground do dia no select Instrutor ("turma:<chave>")
const turmaDoValor = valor => typeof valor === 'string' && valor.startsWith('turma:');

// Com o progresso desligado (js/funcionalidades.js), o formulário vai sem os programas (ambiente): o curso encerrado do
// aluno, que é do cadastro dos cursos, é marcado aqui, e o grupo dos tipos de missão não fala da missão do curso (nenhuma
// está na lista)
function infoDoAluno(f) {
  const info = f.alunoInfo || '';
  const sigla = !ligada('progresso') && f.aluno ? (stuBy(Number(f.aluno)) || {}).curso : '';
  const encerrado = Boolean(sigla) && (S.programa || []).some(c => c.sigla === sigla && c.ativo === false);
  return encerrado && info.startsWith(sigla) ? `${sigla} (encerrado)${info.slice(sigla.length)}` : info;
}
function gruposDeMissao(f) {
  if (ligada('progresso')) return f.missoes.grupos;
  return f.missoes.grupos.map(g => (g.opcoes.some(o => o.valor.startsWith('tipo:')) ? { ...g, rotulo: 'Tipos de missão' } : g));
}

function desenharFormulario() {
  const f = pedido.formulario;
  const sem = !f.aluno;
  preencher('agd-aluno', `<option value="">Escolha o aluno</option>${emGrupos(f.alunos, f.aluno)}`, f.aluno);
  campo('agd-aluno-info').textContent = infoDoAluno(f);
  const missoes = f.missoes ? `${f.missao ? '' : '<option value="">Escolha a missão</option>'}${emGrupos(gruposDeMissao(f), f.missao)}` : '';
  preencher('agd-missao', missoes, f.missao || '');
  // Com o progresso desligado, sem a nota (ela só diria que faltam os programas, que não são mostrados de propósito)
  campo('agd-missao-nota').textContent = (ligada('progresso') && f.missoes && f.missoes.nota) || '';
  campo('agd-tipo-rotulo').hidden = !f.tipos;
  preencher('agd-tipo', f.tipos ? `<option value="">Escolha o tipo</option>${f.tipos.map(m => opcao({ valor: m, texto: m }, f.tipo)).join('')}` : '', f.tipo || '');
  preencher('agd-recurso', (f.recursos || []).map(o => opcao(o, f.recurso)).join(''), f.recurso || '');
  preencher('agd-instrutor', emGrupos(f.instrutores || [], f.instrutor), f.instrutor || '');
  const horarios = f.horarios ? f.horarios.opcoes.map(o => opcao(o, f.horario)).join('') + (f.horarios.outro ? opcao({ valor: 'outro', texto: 'Outro horário…' }, f.horario) : '') : '';
  preencher('agd-horario', horarios, f.horario ?? '');
  campo('agd-outro-rotulo').hidden = f.horario !== 'outro';
  if (f.horario === 'outro') definir('agd-outro-horario', f.outroHorario || '');
  if (f.horas) definir('agd-horas', f.horas.valor);
  campo('agd-peso').hidden = !(f.peso && f.peso.visivel);
  if (f.peso) {
    definir('agd-kg-aluno', f.peso.aluno);
    definir('agd-kg-instrutor', f.peso.instrutor);
    campo('agd-peso-resumo').textContent = f.peso.resumo;
  }
  // A descrição do diálogo (aria-describedby): de onde ele abriu, desde antes do aluno, e depois o horário escolhido
  campo('agd-contexto').textContent = f.contextoTexto || '';
  // O título diz o que acontece: um voo novo, o voo de hoje que muda de lugar ou o que entra na escala
  campo('agd-titulo').textContent = TITULO[f.acao] || TITULO.agendar;
  // Sem o aluno, os outros campos esperam; a duração fixa (o Ground, o Noturno) fica travada
  for (const id of CAMPOS.slice(1)) campo(id).disabled = sem || pedido.travado;
  campo('agd-aluno').disabled = Boolean(pedido.travado);
  if (f.horas && f.horas.fixa) campo('agd-horas').disabled = true;
}

// Os itens da conferência: bloqueios, avisos e notas (com os botões do conserto, como "Marcar disponível", e as
// alternativas livres de cada bloqueio, em grupos: "Horários livres: 08:20 10:10")
const botao = o => `<button type="button" class="btn quiet" data-agd-opcao="${esc(o.opcao)}">${esc(o.texto)}</button>`;
// Cada grupo de alternativas tem o nome dele, o rótulo que aparece ("Horários livres"): o leitor de tela diz o grupo
// antes dos botões ("08:20" sozinho não diz o que é). id: o do item, o mesmo enquanto a conferência não muda (o
// conteúdo só é trocado quando muda)
const alternativas = (grupos, id) => (grupos || []).map((g, k) => `<div class="agd-chips" role="group" aria-labelledby="${id}-${k}"><span><span id="${id}-${k}">${esc(g.rotulo)}</span>:</span> ${g.opcoes.map(botao).join(' ')}</div>`).join('');
const item = (i, id) => `<li data-codigo="${esc(i.codigo)}">${esc(i.texto)}${(i.opcoes || []).map(o => ` ${botao(o)}`).join('')}${alternativas(i.alternativas, id)}</li>`;
function desenharConferencia() {
  const av = pedido.avaliacao;
  const conferencia = $('#agd-conferencia');
  // Antes de escolher o aluno, o "Escolha o aluno" é uma orientação, não um erro
  const soOrientacao = av.bloqueios.length === 1 && av.bloqueios[0].codigo === 'sem-aluno';
  const html = (nome, lista) => trocar(conferencia.querySelector(`.agd-${nome}`), lista.map((i, n) => item(i, `agd-alt-${nome}-${n}`)).join(''));
  html('bloqueios', soOrientacao ? [] : av.bloqueios);
  html('avisos', av.avisos);
  html('notas', soOrientacao ? [...av.bloqueios, ...av.notas] : av.notas);
  desenharPrevia();
  // Outro conjunto de avisos desarma a confirmação
  const form = $('#form-agendar');
  if (form.dataset.confirmado !== undefined && form.dataset.confirmado !== assinaturaDosAvisos(av.avisos)) desarmar();
}

// A prévia ("O que muda na escala"): o voo agendado e cada voo que muda de lugar, sai ou entra (js/agendamento.js)
function desenharPrevia() {
  const ul = $('#agd-previa ul');
  const previa = pedido.avaliacao && pedido.avaliacao.previa;
  let linhas;
  if (pedido.pendente) linhas = ['calculando…'];
  else if (!previa || !previa.novo) linhas = ['Complete o voo para ver o que muda na escala.'];
  else linhas = previa.linhas;
  trocar(ul, linhas.map(l => `<li>${esc(l)}</li>`).join(''));
}

function desarmar() {
  const form = $('#form-agendar');
  delete form.dataset.confirmado;
  $('#agd-confirmar').textContent = 'Agendar';
  $('#agd-erro').textContent = '';
}

// Os campos com erro (aria-invalid): o leitor de tela diz qual campo e lê o motivo no alerta
function marcarInvalido(id = null) {
  for (const c of CAMPOS) campo(c).setAttribute('aria-invalid', String(c === id));
}

// O formulário de novo (na hora) e a conferência depois da espera
function recalcular({ conferirJa = false } = {}) {
  pedido.ambiente = ambiente();
  pedido.formulario = formularioDoAgendamento(estadoDaEscala(), pedido.base, pedido.ambiente, pedido.contexto, pedido.escolhas, pedido.tocados);
  desenharFormulario();
  clearTimeout(pedido.temporizador);
  if (pedido.formulario.formato.length) {
    pedido.pendente = false;
    pedido.avaliacao = { bloqueios: pedido.formulario.formato, avisos: [], notas: pedido.formulario.notas, previa: null };
    desenharConferencia();
    return;
  }
  pedido.pendente = true;
  desenharPrevia();
  if (conferirJa) conferir();
  else pedido.temporizador = setTimeout(conferir, ESPERA_DA_CONFERENCIA);
}

// A conferência: a escala com os pesos digitados (guardada por par de pesos), a simulação e a avaliação
function conferir() {
  if (!pedido || !pedido.pendente) return;
  clearTimeout(pedido.temporizador);
  const f = pedido.formulario;
  // A lista e a simulação leem o estado da escala (sem os inativos de hoje em diante, js/inativos.js)
  const estado = estadoDaEscala();
  const estadoComPesos = comPesos(estado, f.proposta);
  let baseComPesos = pedido.base;
  if (estadoComPesos !== estado) {
    const chave = `${f.proposta.stuId}:${f.proposta.pesos.aluno}|${f.proposta.insId}:${f.proposta.pesos.instrutor}`;
    if (!pedido.comPesos.has(chave)) pedido.comPesos.set(chave, runAllocationEngine(estadoComPesos));
    baseComPesos = pedido.comPesos.get(chave);
  }
  const { sim, estadoDaSim, fKey } = simularAgendamento(estado, pedido.base, f.proposta);
  pedido.avaliacao = avaliarAgendamento({ estado, base: pedido.base, baseComPesos, sim, estadoDaSim, fKey, formulario: f, ambiente: pedido.ambiente });
  pedido.pendente = false;
  desenharConferencia();
}

// Uma mudança num campo: o valor vai para as escolhas, e o campo fica como o operador deixou
function aoMudar(e) {
  if (!pedido || pedido.travado) return;
  const el = e.target;
  const { escolhas, tocados } = pedido;
  switch (el.id) {
    case 'agd-aluno':
      escolhas.aluno = el.value ? +el.value : null;
      // Outro aluno: a missão, a duração e o peso vêm dele
      ['missao', 'tipo', 'horas', 'kgAluno'].forEach(c => tocados.delete(c));
      delete escolhas.kgAluno;
      break;
    case 'agd-missao':
      escolhas.missao = el.value;
      tocados.add('missao');
      tocados.delete('horas');
      break;
    case 'agd-tipo': escolhas.tipo = el.value; tocados.delete('horas'); break;
    case 'agd-recurso': escolhas.recurso = el.value; tocados.add('recurso'); break;
    case 'agd-instrutor':
      // Uma turma de Ground do dia: o horário passa a ser o dela
      escolhas.instrutor = turmaDoValor(el.value) ? el.value : +el.value;
      tocados.add('instrutor');
      if (turmaDoValor(el.value)) tocados.delete('horario');
      break;
    case 'agd-horario':
      escolhas.horario = el.value === 'outro' ? 'outro' : +el.value;
      if (el.value === 'outro' && !escolhas.outroHorario && Number.isInteger(pedido.formulario.horario)) escolhas.outroHorario = hm(pedido.formulario.horario);
      tocados.add('horario');
      // Outro horário sai da turma de Ground: o aluno abre uma turma nova, com o instrutor que serve nele
      if (turmaDoValor(escolhas.instrutor)) { tocados.delete('instrutor'); delete escolhas.instrutor; }
      break;
    case 'agd-outro-horario': escolhas.outroHorario = el.value; break;
    case 'agd-horas': escolhas.horas = textoDoCampo(el); tocados.add('horas'); break;
    case 'agd-kg-aluno': escolhas.kgAluno = textoDoCampo(el); tocados.add('kgAluno'); break;
    // O peso digitado de cada instrutor fica com ele enquanto o diálogo está aberto
    case 'agd-kg-instrutor':
      if (pedido.formulario.instrutor) escolhas.kgInstrutor = { ...(escolhas.kgInstrutor || {}), [pedido.formulario.instrutor]: textoDoCampo(el) };
      break;
    default: return;
  }
  // O recurso de agora (o que o formulário escolheu) é o ponto de partida dos tipos de missão sem o curso
  if (!tocados.has('recurso') && pedido.formulario.recurso) escolhas.recurso = pedido.formulario.recurso;
  marcarInvalido();
  $('#agd-erro').textContent = '';
  recalcular();
}

// Uma opção da conferência (data-agd-opcao): "disponibilizar", ou a alternativa livre "horario:<minuto>",
// "recurso:<matrícula>" ou "instrutor:<id>", que vale como o campo escolhido pelo operador. A alternativa muda só o campo
// dela: os outros ficam como estão agora (ela foi calculada com eles; js/agendamento.js). Responde se havia o que escolher
function escolherOpcao(valor) {
  const f = pedido.formulario;
  if (valor === 'disponibilizar') {
    // O instrutor do voo (na turma de Ground, o da turma)
    const insId = Number.isInteger(f.instrutor) ? f.instrutor : f.selecao && f.selecao.x ? f.selecao.x.id : null;
    if (!insId) return false;
    pedido.escolhas.disponibilizar = insId;
    return true;
  }
  const novas = escolhasDaAlternativa(f, pedido.escolhas, pedido.tocados, valor);
  if (!novas) return false;
  pedido.escolhas = novas.escolhas;
  pedido.tocados = novas.tocados;
  return true;
}

function ligar() {
  const dlg = $('#dlg-agendar');
  if (dlg.dataset.ligado) return;
  dlg.dataset.ligado = '1';
  const form = $('#form-agendar');
  form.addEventListener('change', aoMudar);
  // Os números e o outro horário: a cada tecla (a conferência espera a digitação parar)
  form.addEventListener('input', e => { if (e.target.matches('input')) aoMudar(e); });
  form.addEventListener('submit', e => { e.preventDefault(); enviar(); });
  // O conserto de um bloqueio: "Marcar disponível" (o instrutor fica disponível nos períodos do voo, com o agendamento),
  // ou uma alternativa livre (o horário, o recurso ou o instrutor, como se o operador o escolhesse no campo dele). O foco
  // vai para "Agendar": o botão clicado sai com a conferência refeita
  form.addEventListener('click', e => {
    const b = e.target.closest('[data-agd-opcao]');
    if (!b || !pedido || pedido.travado) return;
    if (!escolherOpcao(b.dataset.agdOpcao)) return;
    marcarInvalido();
    $('#agd-erro').textContent = '';
    recalcular({ conferirJa: true });
    $('#agd-confirmar').focus();
  });
  $('#agd-voltar').addEventListener('click', () => dlg.close());
  // Esc ou Voltar: desiste (nada muda). Depois de confirmar, o pedido já saiu, e o fechamento não desiste
  dlg.addEventListener('close', () => {
    if (!pedido) return;
    clearTimeout(pedido.temporizador);
    pedido = null;
  });
}

function enviar() {
  if (!pedido) return;
  const form = $('#form-agendar'), erro = $('#agd-erro');
  if (isGestor() || ApiClient.readOnly) { travar(); return; }
  if (pedido.pendente) conferir();
  const { bloqueios, avisos } = pedido.avaliacao;
  if (bloqueios.length) {
    const [primeiro] = bloqueios;
    erro.textContent = primeiro.texto;
    marcarInvalido(primeiro.campo);
    const el = primeiro.campo && campo(primeiro.campo);
    if (el && !el.disabled && !el.closest('[hidden]')) el.focus();
    return;
  }
  const assinatura = assinaturaDosAvisos(avisos);
  if (avisos.length && form.dataset.confirmado !== assinatura) {
    form.dataset.confirmado = assinatura;
    $('#agd-confirmar').textContent = 'Agendar mesmo assim';
    erro.textContent = `${avisos.length === 1 ? 'Confira o aviso acima' : `Confira os ${avisos.length} avisos acima`}; para agendar assim mesmo, clique em “Agendar mesmo assim”.`;
    // O peso que falta para antes, no campo dele
    const semPeso = avisos.find(a => a.codigo === 'sem-peso');
    marcarInvalido(semPeso ? semPeso.campo : null);
    if (semPeso && campo(semPeso.campo)) campo(semPeso.campo).focus();
    return;
  }
  const { aoConfirmar, base, contexto, formulario, avaliacao } = pedido;
  pedido = null;
  $('#dlg-agendar').close();
  aoConfirmar({ proposta: formulario.proposta, base, avaliacao, contexto });
}

// A tela ficou só para consulta (o Gestor, ou o conflito de gravação com o diálogo aberto): nada é agendado. O campo
// ou o botão com o foco fica desligado, e o foco cairia na página (o Tab seguinte sairia dela): ele vai para "Voltar",
// o que sobra para fazer
function travar() {
  pedido.travado = true;
  clearTimeout(pedido.temporizador);
  desenharFormulario();
  $('#agd-confirmar').disabled = true;
  $('#agd-erro').textContent = 'A tela ficou só para consulta: o voo não foi agendado.';
  const dlg = $('#dlg-agendar'), foco = document.activeElement;
  if (dlg.open && (!foco || !dlg.contains(foco) || foco.disabled)) $('#agd-voltar').focus();
}

// Abre o diálogo pelo contexto (o data-agendar do botão). aoConfirmar recebe a proposta, a escala de agora (base), a
// conferência e o contexto, depois de o diálogo fechar
export function abrirAgendamento(valor, { aoConfirmar }) {
  if (isGestor() || ApiClient.readOnly) return;
  ligar();
  const amb = ambiente();
  pedido = {
    contexto: contextoInicial(valor, amb), ambiente: amb, base: runAllocationEngine(estadoDaEscala()), escolhas: {}, tocados: new Set(), aoConfirmar,
    comPesos: new Map(), pendente: false, travado: false, temporizador: null
  };
  desarmar();
  marcarInvalido();
  $('#agd-confirmar').disabled = false;
  $('#agd-titulo').textContent = 'Agendar voo';
  $('#agd-previa').open = false;
  recalcular();
  $('#dlg-agendar').showModal();
  campo('agd-aluno').focus();
}

// A escala da tela mudou com o diálogo aberto (rOut): a conferência é refeita com a escala nova; a tela que ficou só para
// consulta trava o diálogo
export function atualizarAgendamento() {
  if (!pedido || pedido.travado) return;
  if (isGestor() || ApiClient.readOnly) { travar(); return; }
  pedido.base = runAllocationEngine(estadoDaEscala());
  pedido.comPesos.clear();
  recalcular();
}
