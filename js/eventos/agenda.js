// A Agenda: os pedidos da data aberta, registrar (cada pedido para a data dele, "Data do pedido") e cancelar (importar os
// pedidos da data para a Demanda: js/eventos/importacao.js)
import { vagaDeVooLocal } from '../agenda.js';
import { DURACAO_MAXIMA_H, LIMITE_DE_VOOS_LOCAIS, MIS } from '../config.js';
import { $, showToast } from '../dom.js';
import { duracaoDigitada, ERRO_DA_DURACAO } from '../rules.js';
import { S, DATA } from '../state.js';
import { ApiClient } from '../storage.js';
import { confirmado } from './confirmacao.js';
import { aoAcionar } from './registro.js';
import {
  abrirAgenda, rAgenda, podeEditarAgenda, lembrarRegistradoPor, descreverPedido, missaoDoPedido, pedidoDaLista, dataCurta, dataDoFormulario,
  escolherDataDoPedido, pedidosDoFormulario, lerPedidosDaAgenda, marcarInvalidos, apagarErroDaAgenda, desarmarConfirmacaoDaAgenda, nomearRegistrar,
  rHorariosDoPedido, atualizarRecursoEHorario, esvaziarPedidoRegistrado, escolherNaAgenda, escolherMissaoNaAgenda, emLista
} from '../views/agenda.js';
import { lerPedidosDaData } from '../views/selos.js';
import { lerContagemDosDias } from '../views/trilho.js';
import { registrarDesenho } from '../redesenho.js';
import { registrarTela } from '../views/telas.js';

// O desenho da Agenda (js/redesenho.js), pelo papel: os pedidos. Ele não faz nada até a Agenda ser aberta
registrarDesenho('pedidos', rAgenda, { em: ['dados', 'perfil', 'pedidos'], ordem: 95 });
// Cada alteração refaz a escala: os horários do cadastro podem ter mudado com a Agenda aberta
registrarDesenho('horarios-do-pedido', rHorariosDoPedido, { em: ['escala'], ordem: 96 });
// Aberta, a Agenda lê de novo os pedidos da data aberta, os da data do pedido e os de cada dia do calendário
registrarTela('age', {
  aoMostrar: () => {
    abrirAgenda();
    lerPedidosDaData();
    lerContagemDosDias();
    rAgenda();
  }
});

// Agenda: registrar um pedido (pela exceção da coordenação, fora do prazo) e cancelar (com confirmação). Um de cada vez: o
// segundo clique (ou Enter), enquanto o primeiro espera a leitura ou a gravação, registraria o mesmo pedido de novo
async function registrarPedido(botao, excecao) {
  const form = $('#form-agenda');
  if (!podeEditarAgenda() || form.hasAttribute('aria-busy')) return;
  const nome = botao.textContent;
  form.setAttribute('aria-busy', 'true');
  botao.textContent = 'Registrando…';
  let depois;
  try {
    depois = await conferirERegistrar(excecao);
  } finally {
    form.removeAttribute('aria-busy');
    botao.textContent = nome;
    nomearRegistrar();
  }
  await depois?.();
}

// Confere o pedido do formulário e o registra. Registrado, devolve o que falta fazer: ler os pedidos de novo
async function conferirERegistrar(excecao) {
  apagarErroDaAgenda();
  const aluno = S.stu.find(s => s.id === +$('#ag-aluno').value);
  const por = $('#ag-por').value.trim();
  // A lista dos horários como está agora no cadastro: o horário que saiu dela não é registrado
  const horarioNaTela = $('#ag-horario').value;
  atualizarRecursoEHorario();
  const missao = $('#ag-missao').value, recurso = $('#ag-recurso').value, horario = $('#ag-horario').value;
  // O recurso espera a missão, e o horário, os três: só falta o que já pode ser escolhido
  const faltam = [
    !aluno && ['#ag-aluno', 'o aluno'], !missao && ['#ag-missao', 'a missão'], missao && !recurso && ['#ag-recurso', 'o recurso'],
    aluno && missao && recurso && !horario && ['#ag-horario', 'o horário']
  ].filter(Boolean);
  if (faltam.length || !por) {
    $('#ag-erro').textContent = [
      faltam.length ? `Escolha ${emLista(faltam.map(([, nome]) => nome))}.` : '', por ? '' : 'Informe quem anotou o pedido (“Registrado por”).'
    ].filter(Boolean).join(' ');
    marcarInvalidos(...faltam.map(([campo]) => campo), ...(por ? [] : ['#ag-por']));
    return null;
  }
  if (horario !== horarioNaTela) {
    $('#ag-erro').textContent = 'Os horários deste recurso mudaram no cadastro: confira o horário e registre de novo.';
    marcarInvalidos('#ag-horario');
    return null;
  }
  // A duração: de 0,1 h a 5 h, em décimos (o Ground tem 01h30)
  const horas = duracaoDigitada($('#ag-horas').value);
  if (horas === null) {
    $('#ag-erro').textContent = ERRO_DA_DURACAO;
    marcarInvalidos('#ag-horas');
    return null;
  }
  const dia = dataDoFormulario(), confirmacao = chaveDaConfirmacao();
  // No máximo 6 voos locais no mesmo horário: o horário está indisponível, com o próximo (sem os pedidos da data lidos, esta
  // conferência e a do voo já marcado não são feitas)
  const pedido = { data: dia, horario, missao, recurso };
  const observacao = $('#ag-obs').value;
  const pedidos = await pedidosDoFormulario(dia) || [];
  const vaga = vagaDeVooLocal(pedidos, pedido, S.horarios);
  if (!vaga.ok) { $('#ag-erro').textContent = semVagaDeVooLocal(pedido, vaga.proximo); marcarInvalidos('#ag-horario'); return null; }
  // O aluno que já tem voo marcado na data: pode ser um reagendamento feito por outra pessoa; o segundo clique confirma
  const marcados = pedidos.filter(p => p.aluno === aluno.id && p.data === dia && !p.cancelada_em);
  if (marcados.length && $('#form-agenda').dataset.confirmado !== confirmacao) {
    $('#form-agenda').dataset.confirmado = confirmacao;
    avisoDoVooMarcado = `${aluno.nm} já tem voo marcado em ${dia.slice(8, 10)}/${dia.slice(5, 7)}: ${marcados.map(descreverPedido).join('; ')}. É um reagendamento ou mais um voo? Para registrar mais este, clique em “Registrar mesmo assim”.`;
    $('#ag-erro').textContent = avisoDoVooMarcado;
    return null;
  }
  try {
    await ApiClient.registrarSolicitacao({
      ...pedido, aluno: aluno.id, aluno_nome: aluno.nm, janela: 'horario', horas, observacao, registrado_por: por, excecao
    });
  } catch (err) {
    if (err.code === 'agenda-sem-recurso') marcarInvalidos('#ag-recurso');
    $('#ag-erro').textContent = {
      // O app novo com o servidor de antes (a migração agenda_com_recurso): o recurso se perderia, e nada foi registrado
      'agenda-sem-recurso': `O servidor precisa ser atualizado para guardar o recurso do pedido: até lá, ${missao} só pode ser pedida no ${MIS[missao].defEq}. Nada foi registrado. Avise a administração do app.`,
      PT403: 'Prazo encerrado para esta data: os pedidos vão até as 13:00 do dia anterior (a segunda, até sábado às 10:00).',
      42501: 'Esta conta não pode registrar este pedido (a Exceção da Coordenação é só para operadores).',
      23514: 'Pedido incompleto: confira aluno, missão, recurso, horário e quem anotou.',
      22023: `Pedido inválido: o horário é obrigatório, e a duração vai de 0,1 h a ${DURACAO_MAXIMA_H} h.`,
      // Outra pessoa agendou o 6º local no mesmo horário enquanto isso: o servidor recusou
      PT422: semVagaDeVooLocal(pedido, vagaDeVooLocal([...pedidos, ...Array.from({ length: LIMITE_DE_VOOS_LOCAIS }, () => ({ ...pedido, janela: 'horario', cancelada_em: null }))], pedido, S.horarios).proximo)
    }[err.code] || 'Não foi possível registrar o pedido. Verifique a conexão e tente de novo.';
    return null;
  }
  lembrarRegistradoPor(por);
  desarmarConfirmacaoDaAgenda();
  esvaziarPedidoRegistrado();
  // A lista é a da data aberta: o pedido de outra data diz para qual ele foi
  const para = dia === DATA ? '' : ` para ${dataCurta(dia)}`;
  showToast(excecao ? `Pedido registrado${para} pela Exceção da Coordenação.` : `Pedido registrado${para}.`, 'ok');
  return () => Promise.all([lerPedidosDaAgenda(dia), lerContagemDosDias()]);
}
// O horário sem vaga de voo local: o motivo e o próximo horário possível
function semVagaDeVooLocal({ horario, missao }, proximo) {
  const depois = missao === 'Voo Solo' ? 'O Voo Solo sai sempre às 06:30.' : proximo ? `Próximo horário possível: ${proximo}.` : 'Nenhum horário mais tarde tem vaga.';
  return `Horário indisponível: já há ${LIMITE_DE_VOOS_LOCAIS} voos locais (Voo Local, Voo Solo e TGL) às ${horario}, o máximo no mesmo horário (determinação da diretoria). ${depois}`;
}

// O aviso do voo já marcado arma o botão para um aluno numa data: trocar um dos dois desfaz a confirmação
let avisoDoVooMarcado = '';
const chaveDaConfirmacao = () => `${+$('#ag-aluno').value}|${dataDoFormulario()}`;
$('#form-agenda').onsubmit = e => { e.preventDefault(); registrarPedido($('#form-agenda [type="submit"]'), false); };
$('#ag-excecao').onclick = () => registrarPedido($('#ag-excecao'), true);
// Uma escolha nova: o erro era do pedido de antes. Com o botão ainda armado, o aviso do voo já marcado fica (ou volta, no
// lugar do erro que o substituiu); trocar a data o desarma (escolherDataDoPedido)
const aoEscolher = escolher => () => {
  escolher();
  const armado = $('#form-agenda').dataset.confirmado === chaveDaConfirmacao();
  if (!armado) desarmarConfirmacaoDaAgenda();
  const texto = armado ? avisoDoVooMarcado : '';
  if ($('#ag-erro').textContent !== texto) $('#ag-erro').textContent = texto;
  marcarInvalidos();
};
$('#ag-data').onchange = e => escolherDataDoPedido(e.target.value);
$('#ag-aluno').onchange = aoEscolher(escolherNaAgenda);
$('#ag-missao').onchange = aoEscolher(escolherMissaoNaAgenda);
$('#ag-recurso').onchange = aoEscolher(escolherNaAgenda);
$('#ag-horario').onchange = aoEscolher(escolherNaAgenda);

async function cancelarPedido(b) {
  const pedido = pedidoDaLista(+b.dataset.id);
  if (!podeEditarAgenda() || !confirmado(b, `Confirmar cancelamento${pedido ? `: ${missaoDoPedido(pedido)}` : ''}`)) return;
  const por = $('#ag-por').value.trim();
  if (!por) {
    $('#ag-erro').textContent = 'Informe seu nome em “Registrado por” para cancelar o pedido.';
    marcarInvalidos('#ag-por');
    return;
  }
  try {
    await ApiClient.cancelarSolicitacao(+b.dataset.id, por);
    showToast('Pedido cancelado.', 'ok');
  } catch {
    $('#ag-erro').textContent = 'Não foi possível cancelar o pedido. Verifique a conexão e tente de novo.';
  }
  await Promise.all([lerPedidosDaData(), lerContagemDosDias()]);
}
aoAcionar('cancelar-pedido', cancelarPedido, { confereAPermissao: true });
