// A Agenda: registrar e cancelar pedidos, com a data do pedido no formulário (importar os pedidos da data para a
// Demanda: js/eventos/importacao.js). A data aberta muda pelo trilho
import { vagaDeVooLocal } from '../agenda.js';
import { DURACAO_MAXIMA_H, LIMITE_DE_VOOS_LOCAIS, MIS } from '../config.js';
import { $, showToast } from '../dom.js';
import { duracaoDigitada, ERRO_DA_DURACAO } from '../rules.js';
import { S, DATA } from '../state.js';
import { ApiClient } from '../storage.js';
import { confirmado } from './confirmacao.js';
import { aoAcionar } from './registro.js';
import { mostrarAgenda, diaDoPedido, escolherDataDoPedido, lerOutraData, pedidosDaData, lembrarRegistradoPor, podeEditarAgenda, rAgenda, rHorariosDoPedido, atualizarRecursoEHorario, esvaziarPedidoRegistrado, escolherNaAgenda, escolherMissaoNaAgenda, emLista, pedidosDoAluno, descreverPedido, missaoDoPedido } from '../views/agenda.js';
import { lerPedidosDaData } from '../views/selos.js';
import { registrarDesenho } from '../redesenho.js';
import { registrarTela } from '../views/telas.js';

// O desenho da Agenda (js/redesenho.js), pelo papel: os pedidos. Ele não faz nada até a Agenda ser aberta; depois, segue os
// dados da data, os pedidos lidos, a data aberta e o perfil
registrarDesenho('pedidos', rAgenda, { em: ['dados', 'pedidos', 'data-aberta', 'perfil'], ordem: 95 });
// Aberta, a Agenda lê os pedidos da data aberta (a lista e a linha usam a mesma leitura)
registrarTela('age', { aoMostrar: () => { mostrarAgenda(); lerPedidosDaData(); } });
// Cada alteração refaz a escala: os horários do cadastro podem ter mudado com a Agenda aberta
registrarDesenho('horarios-do-pedido', rHorariosDoPedido, { em: ['escala'], ordem: 96 });

// A data do pedido: o prazo e a Exceção da Coordenação seguem ela; os pedidos dela são lidos para os avisos do formulário
$('#ag-data').onchange = () => {
  escolherDataDoPedido($('#ag-data').value);
  desarmarConfirmacaoDaAgenda();
  lerOutraData($('#ag-data').value);
  rAgenda();
};

// Os campos do pedido com erro (aria-invalid): o leitor de tela diz qual campo e lê o motivo (#ag-erro é a descrição deles)
const marcarInvalidos = (...ids) => ['#ag-aluno', '#ag-missao', '#ag-recurso', '#ag-horario', '#ag-horas', '#ag-por'].forEach(id => $(id).setAttribute('aria-invalid', String(ids.includes(id))));

// Agenda: registrar um pedido (pela exceção da coordenação, fora do prazo) e cancelar (com confirmação)
// Até o servidor responder, outro clique (ou Enter) não registra o mesmo pedido de novo
let registrando = false;
async function registrarPedido(excecao) {
  if (!podeEditarAgenda() || registrando) return;
  $('#ag-erro').textContent = '';
  marcarInvalidos();
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
    return;
  }
  if (horario !== horarioNaTela) {
    $('#ag-erro').textContent = 'Os horários deste recurso mudaram no cadastro: confira o horário e registre de novo.';
    marcarInvalidos('#ag-horario');
    return;
  }
  // A duração: de 0,1 h a 5 h, em décimos (o Ground tem 01h30)
  const horas = duracaoDigitada($('#ag-horas').value);
  if (horas === null) {
    $('#ag-erro').textContent = ERRO_DA_DURACAO;
    marcarInvalidos('#ag-horas');
    return;
  }
  const dia = diaDoPedido(), confirmacao = chaveDaConfirmacao();
  // Os pedidos da data do pedido (sem a leitura deles, os dois avisos ficam de fora; o servidor confere o limite)
  const doDia = pedidosDaData(dia) || [];
  // No máximo 6 voos locais no mesmo horário: o horário está indisponível, com o próximo
  const pedido = { data: dia, horario, missao, recurso };
  const vaga = vagaDeVooLocal(doDia, pedido, S.horarios);
  if (!vaga.ok) { $('#ag-erro').textContent = semVagaDeVooLocal(pedido, vaga.proximo); marcarInvalidos('#ag-horario'); return; }
  // O aluno que já tem voo marcado na data: pode ser um reagendamento feito por outra pessoa; o segundo clique confirma
  const marcados = pedidosDoAluno(doDia, aluno.id, dia);
  if (marcados.length && $('#form-agenda').dataset.confirmado !== confirmacao) {
    $('#form-agenda').dataset.confirmado = confirmacao;
    $('#form-agenda [type="submit"]').textContent = 'Registrar mesmo assim';
    avisoDoVooMarcado = `${aluno.nm} já tem voo marcado em ${dia.slice(8, 10)}/${dia.slice(5, 7)}: ${marcados.map(descreverPedido).join('; ')}. É um reagendamento ou mais um voo? Para registrar mais este, clique em “Registrar mesmo assim”.`;
    $('#ag-erro').textContent = avisoDoVooMarcado;
    return;
  }
  registrando = true;
  try {
    await ApiClient.registrarSolicitacao({
      data: dia, aluno: aluno.id, aluno_nome: aluno.nm, missao, recurso, janela: 'horario',
      horario, horas, observacao: $('#ag-obs').value, registrado_por: por, excecao
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
      PT422: semVagaDeVooLocal(pedido, vagaDeVooLocal([...doDia, ...Array.from({ length: LIMITE_DE_VOOS_LOCAIS }, () => ({ ...pedido, janela: 'horario', cancelada_em: null }))], pedido, S.horarios).proximo)
    }[err.code] || 'Não foi possível registrar o pedido. Verifique a conexão e tente de novo.';
    return;
  } finally {
    registrando = false;
  }
  lembrarRegistradoPor(por);
  desarmarConfirmacaoDaAgenda();
  esvaziarPedidoRegistrado();
  showToast(excecao ? 'Pedido registrado pela Exceção da Coordenação.' : 'Pedido registrado.', 'ok');
  await lerOutraData(dia);
  lerPedidosDaData();
}
// O horário sem vaga de voo local: o motivo e o próximo horário possível
function semVagaDeVooLocal({ horario, missao }, proximo) {
  const depois = missao === 'Voo Solo' ? 'O Voo Solo sai sempre às 06:30.' : proximo ? `Próximo horário possível: ${proximo}.` : 'Nenhum horário mais tarde tem vaga.';
  return `Horário indisponível: já há ${LIMITE_DE_VOOS_LOCAIS} voos locais (Voo Local, Voo Solo e TGL) às ${horario}, o máximo no mesmo horário (determinação da diretoria). ${depois}`;
}

// O aviso do voo já marcado arma o botão para um aluno numa data: trocar um dos dois desfaz a confirmação
let avisoDoVooMarcado = '';
const chaveDaConfirmacao = () => `${+$('#ag-aluno').value}|${diaDoPedido()}`;
function desarmarConfirmacaoDaAgenda() {
  delete $('#form-agenda').dataset.confirmado;
  $('#form-agenda [type="submit"]').textContent = 'Registrar pedido';
}
$('#form-agenda').onsubmit = e => { e.preventDefault(); registrarPedido(false); };
$('#ag-excecao').onclick = () => registrarPedido(true);
// Uma escolha nova: o erro era do pedido de antes. Com o botão ainda armado, o aviso do voo já marcado fica (ou volta, no
// lugar do erro que o substituiu)
const aoEscolher = escolher => () => {
  escolher();
  const armado = $('#form-agenda').dataset.confirmado === chaveDaConfirmacao();
  if (!armado) desarmarConfirmacaoDaAgenda();
  const texto = armado ? avisoDoVooMarcado : '';
  if ($('#ag-erro').textContent !== texto) $('#ag-erro').textContent = texto;
  marcarInvalidos();
};
$('#ag-aluno').onchange = aoEscolher(escolherNaAgenda);
$('#ag-missao').onchange = aoEscolher(escolherMissaoNaAgenda);
$('#ag-recurso').onchange = aoEscolher(escolherNaAgenda);
$('#ag-horario').onchange = aoEscolher(escolherNaAgenda);

async function cancelarPedido(b) {
  const pedido = (pedidosDaData(DATA) || []).find(p => p.id === +b.dataset.id);
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
  lerPedidosDaData();
}
aoAcionar('cancelar-pedido', cancelarPedido, { confereAPermissao: true });
