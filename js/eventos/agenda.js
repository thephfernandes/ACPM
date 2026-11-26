// A Agenda: os pedidos da data aberta, registrar (cada pedido para a data dele, "Data do pedido") e cancelar (importar os
// pedidos da data para a Demanda: js/eventos/importacao.js)
import { vagaDeVooLocal, HORARIOS_FIXOS } from '../agenda.js';
import { DURACAO_MAXIMA_H, LIMITE_DE_VOOS_LOCAIS } from '../config.js';
import { $, showToast } from '../dom.js';
import { duracaoDigitada, ERRO_DA_DURACAO } from '../rules.js';
import { S, DATA } from '../state.js';
import { ApiClient } from '../storage.js';
import { confirmado } from './confirmacao.js';
import { aoAcionar } from './registro.js';
import {
  abrirAgenda, rAgenda, podeEditarAgenda, lembrarRegistradoPor, descreverPedido, missaoDoPedido, pedidoDaLista, dataCurta, dataDoFormulario,
  escolherDataDoPedido, pedidosDoFormulario, lerPedidosDaAgenda, marcarInvalidos, focarNoPrimeiroInvalido, apagarErroDaAgenda, desarmarConfirmacaoDaAgenda,
  nomearRegistrar, botaoArmado, missaoEscolhida, rHorariosDoPedido, atualizarRecursoEHorario, esvaziarPedidoRegistrado, escolherNaAgenda, escolherMissaoNaAgenda, emLista
} from '../views/agenda.js';
import { lerPedidosDaData } from '../views/selos.js';
import { lerContagemDosDias } from '../views/trilho.js';
import { registrarDesenho } from '../redesenho.js';
import { registrarTela } from '../views/telas.js';

// O desenho da Agenda (js/redesenho.js), pelo papel: os pedidos. Ele não faz nada até a Agenda ser aberta
registrarDesenho('pedidos', rAgenda, { em: ['dados', 'releitura', 'perfil', 'pedidos'], ordem: 95 });
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

// Confere o pedido do formulário e o registra. Registrado, devolve o que falta fazer: ler os pedidos de novo. excecao: o
// botão é a Exceção da Coordenação (depois do prazo)
async function conferirERegistrar(excecao) {
  apagarErroDaAgenda();
  const aluno = S.stu.find(s => s.id === +$('#ag-aluno').value);
  const por = $('#ag-por').value.trim();
  // A lista dos horários como está agora no cadastro: o horário que saiu dela não é registrado
  const horarioNaTela = $('#ag-horario').value;
  atualizarRecursoEHorario();
  const { tipo: missao, doCurso } = missaoEscolhida(), recurso = $('#ag-recurso').value, horario = $('#ag-horario').value;
  // A missão espera o aluno, o recurso espera a missão, e o horário, os três: só falta o que já pode ser escolhido
  const faltam = [
    !aluno && ['#ag-aluno', 'o aluno'], aluno && !missao && ['#ag-missao', 'a missão'], missao && !recurso && ['#ag-recurso', 'o recurso'],
    aluno && missao && recurso && !horario && ['#ag-horario', 'o horário']
  ].filter(Boolean);
  const recusar = (texto, ...campos) => { $('#ag-erro').textContent = texto; marcarInvalidos(...campos); focarNoPrimeiroInvalido(); return null; };
  if (faltam.length || !por) {
    return recusar([
      faltam.length ? `Escolha ${emLista(faltam.map(([, nome]) => nome))}.` : '', por ? '' : 'Informe quem anotou o pedido (“Registrado por”).'
    ].filter(Boolean).join(' '), ...faltam.map(([campo]) => campo), ...(por ? [] : ['#ag-por']));
  }
  if (horario !== horarioNaTela) return recusar('Os horários deste recurso mudaram no cadastro: confira o horário e registre de novo.', '#ag-horario');
  // A duração: de 0,1 h a 5 h, em décimos (o Ground tem 01h30)
  const horas = duracaoDigitada($('#ag-horas').value);
  if (horas === null) return recusar(ERRO_DA_DURACAO, '#ag-horas');
  const dia = dataDoFormulario(), botao = excecao ? 'excecao' : 'registrar', chave = chaveDaConfirmacao(botao);
  const pedido = { data: dia, horario, missao, recurso };
  const observacao = $('#ag-obs').value;
  // As causas que pedem a confirmação (sem os pedidos da data lidos, as duas conferências não são feitas, e quem diz do 7º
  // voo local é o servidor): o 7º voo local no horário (o próximo com vaga) e o voo já marcado do aluno na data (pode ser
  // um reagendamento feito por outra pessoa). A confirmação armada para este pedido vale para as causas que ela mostrou;
  // uma que ela não mostrou pede de novo
  const pedidos = await pedidosDoFormulario(dia) || [];
  const vaga = vagaDeVooLocal(pedidos, pedido, S.horarios);
  const marcados = pedidos.filter(p => p.aluno === aluno.id && p.data === dia && !p.cancelada_em);
  const causas = [...(marcados.length ? ['marcado'] : []), ...(vaga.ok ? [] : ['locais'])];
  const confirmadas = $('#form-agenda').dataset.confirmado === chave ? causasConfirmadas : [];
  const contexto = { aluno, dia, marcados, pedido, locais: vaga.locais, proximo: vaga.proximo };
  if (causas.some(c => !confirmadas.includes(c))) return armarConfirmacao(chave, causas, contexto);
  try {
    await ApiClient.registrarSolicitacao({
      ...pedido, aluno: aluno.id, aluno_nome: aluno.nm, janela: 'horario', horas, observacao, registrado_por: por, excecao,
      missaoDoCurso: doCurso ? doCurso.id : null, confirmarLimite: confirmadas.includes('locais')
    });
  } catch (err) {
    // Outra pessoa registrou o 6º local no mesmo horário enquanto isso (ou os pedidos da data não foram lidos): o servidor
    // recusou, e o formulário pede a confirmação dele, com as causas já mostradas (quantos já há: os 6 que o servidor contou)
    if (err.code === 'PT422') {
      const cheio = [...pedidos, ...Array.from({ length: LIMITE_DE_VOOS_LOCAIS }, () => ({ ...pedido, janela: 'horario', cancelada_em: null }))];
      return armarConfirmacao(chave, [...new Set([...confirmadas, 'locais'])],
        { ...contexto, locais: Math.max(LIMITE_DE_VOOS_LOCAIS, vaga.locais || 0), proximo: vagaDeVooLocal(cheio, pedido, S.horarios).proximo });
    }
    return recusar(...recusaDoServidor(err, missao));
  }
  lembrarRegistradoPor(por);
  desarmarConfirmacaoDaAgenda();
  esvaziarPedidoRegistrado();
  // A lista é a da data aberta: o pedido de outra data diz para qual ele foi
  const para = dia === DATA ? '' : ` para ${dataCurta(dia)}`;
  showToast(excecao ? `Pedido registrado${para} pela Exceção da Coordenação.` : `Pedido registrado${para}.`, 'ok');
  return () => Promise.all([lerPedidosDaAgenda(dia), lerContagemDosDias()]);
}

// O texto e o campo da recusa do servidor (o código e a dica dele)
function recusaDoServidor(err, missao) {
  const fixo = HORARIOS_FIXOS[missao];
  if (err.code === '22023' && err.campo === 'recurso') return ['O servidor não aceitou este recurso para a missão: escolha o recurso de novo.', '#ag-recurso'];
  if (err.code === '22023' && err.campo === 'horario' && fixo) return [`${missao} sai sempre às ${fixo}: escolha o horário de novo.`, '#ag-horario'];
  if (err.code === '22023' && err.campo === 'missao') {
    return ['Esta missão do curso saiu do programa ou mudou de tipo em Cursos: escolha a missão de novo.', '#ag-missao'];
  }
  return [{
    PT403: 'Prazo encerrado para esta data: os pedidos vão até as 13:00 do dia anterior (a segunda, até sábado às 10:00).',
    42501: 'Esta conta não pode registrar este pedido (a Exceção da Coordenação é só para operadores).',
    23514: 'Pedido incompleto: confira aluno, missão, recurso, horário e quem anotou.',
    22023: `Pedido inválido: o horário é obrigatório, e a duração vai de 0,1 h a ${DURACAO_MAXIMA_H} h.`
  }[err.code] || 'Não foi possível registrar o pedido. Verifique a conexão e tente de novo.'];
}

// A confirmação: o aviso de cada causa, e o botão em uso (o envio, ou a Exceção da Coordenação depois do prazo) passa a
// "Registrar mesmo assim", armado para este pedido (o aluno, a data, a missão, o recurso, o horário e o botão) e para estas
// causas
let causasConfirmadas = [];
let avisoDaConfirmacao = '';
const chaveDaConfirmacao = botao => [+$('#ag-aluno').value, dataDoFormulario(), $('#ag-missao').value, $('#ag-recurso').value, $('#ag-horario').value, botao].join('|');
function armarConfirmacao(chave, causas, { aluno, dia, marcados, pedido, locais: quantos, proximo }) {
  const marcado = causas.includes('marcado')
    ? `${aluno.nm} já tem voo marcado em ${dia.slice(8, 10)}/${dia.slice(5, 7)}: ${marcados.map(descreverPedido).join('; ')}. É um reagendamento ou mais um voo?` : '';
  const locais = causas.includes('locais') ? semVagaDeVooLocal(pedido, quantos, proximo) : '';
  const fim = !locais ? 'Para registrar mais este, clique em “Registrar mesmo assim”.'
    : !marcado ? `Para registrar este como o ${quantos + 1}º, clique em “Registrar mesmo assim”.` : 'Para registrar mesmo assim, clique em “Registrar mesmo assim”.';
  causasConfirmadas = causas;
  avisoDaConfirmacao = [marcado, locais, fim].filter(Boolean).join(' ');
  $('#form-agenda').dataset.confirmado = chave;
  $('#ag-erro').textContent = avisoDaConfirmacao;
  marcarInvalidos();
  return null;
}
// O horário cheio de voos locais: o motivo (quantos já há: 6, ou mais com o 7º confirmado) e o próximo horário com vaga
function semVagaDeVooLocal({ horario, missao }, quantos, proximo) {
  const depois = missao === 'Voo Solo' ? 'O Voo Solo sai sempre às 06:30.' : proximo ? `Próximo horário com vaga: ${proximo}.` : 'Nenhum horário mais tarde tem vaga.';
  return `Horário cheio: já há ${quantos} voos locais (Voo Local, Voo Solo e TGL) às ${horario}, o máximo no mesmo horário (determinação da diretoria). ${depois}`;
}

// O segundo clique de um duplo clique (detail 2 ou mais) não faz nada: o primeiro arma a confirmação, e o segundo a daria
// sem o aviso ter sido lido (e o pedido ficaria com a confirmação do 7º voo local). Confirma um clique depois do aviso
const segundoClique = e => e.detail > 1;
$('#form-agenda [type="submit"]').addEventListener('click', e => { if (segundoClique(e)) e.preventDefault(); });
$('#form-agenda').onsubmit = e => { e.preventDefault(); registrarPedido($('#form-agenda [type="submit"]'), false); };
$('#ag-excecao').onclick = e => { if (!segundoClique(e)) registrarPedido($('#ag-excecao'), true); };
// Uma escolha nova: o erro era do pedido de antes. A confirmação armada vale para o pedido como estava: trocar o aluno, a
// missão, o recurso ou o horário a desfaz (trocar a data também: escolherDataDoPedido). Com ela ainda armada (a escolha que
// não mudou nada), o aviso fica, ou volta no lugar do erro que o substituiu
const aoEscolher = escolher => () => {
  escolher();
  const form = $('#form-agenda');
  const armado = Boolean(form.dataset.confirmado) && form.dataset.confirmado === chaveDaConfirmacao(botaoArmado());
  if (!armado) desarmarConfirmacaoDaAgenda();
  const texto = armado ? avisoDaConfirmacao : '';
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
