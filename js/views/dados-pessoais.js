// Painel dos dados pessoais (fase 9): CPF, CANAC, nascimento, celular e e-mail de um aluno ou instrutor, ao lado da
// tabela. Só operadores, administradores e a secretaria veem (no modo local, fora do perfil Gestor). Os dados ficam só
// aqui, fora do estado: nunca vão para o cadastro, o link compartilhado, o CSV, o PDF ou o BI.
import { CAMPOS_PESSOAIS, validarDadosPessoais, formatarCpf, formatarCelular } from '../dados-pessoais.js';
import { ApiClient } from '../storage.js';
import { veDadosPessoais } from '../perfis.js';
import { isGestor, insBy, stuBy, DATA } from '../state.js';
import { esc, hojeISO } from '../format.js';
import { $ } from '../dom.js';

const DADOS = { aluno: {}, instrutor: {} };
const pessoa = (tipo, id) => (tipo === 'aluno' ? stuBy(id) : insBy(id));

// No modo compartilhado, pelo perfil; no modo local, fora do perfil Gestor (e do link compartilhado)
export const podeVerDadosPessoais = () => (ApiClient.perfil ? veDadosPessoais(ApiClient.perfil) : !isGestor());
export const canacDe = (tipo, id) => (DADOS[tipo][id] && DADOS[tipo][id].canac) || '';

function atualizarColunas() {
  document.querySelectorAll('#alu tr[data-id] .c-canac').forEach(td => { td.textContent = canacDe('aluno', +td.closest('tr').dataset.id); });
  document.querySelectorAll('#inst tr[data-id] .c-canac').forEach(td => { td.textContent = canacDe('instrutor', +td.closest('tr').dataset.id); });
}

export async function carregarDadosPessoais() {
  if (!podeVerDadosPessoais()) return;
  try {
    const [alunos, instrutores] = await Promise.all([ApiClient.listarDadosPessoais('aluno'), ApiClient.listarDadosPessoais('instrutor')]);
    DADOS.aluno = alunos;
    DADOS.instrutor = instrutores;
    atualizarColunas();
  } catch (e) {
    // Sem os dados pessoais, as tabelas continuam funcionando (a coluna fica vazia)
  }
}

const VALOR = { cpf: formatarCpf, celular: formatarCelular };
const TIPOS = { cpf: ['text', 'numeric', '000.000.000-00'], canac: ['text', 'numeric', '6 dígitos'], nascimento: ['date', '', ''], celular: ['tel', 'tel', '(37) 99999-9999'], email: ['email', 'email', 'nome@exemplo.com'] };

function campoHtml({ id, rotulo }, dados) {
  const [type, inputmode, placeholder] = TIPOS[id];
  const valor = VALOR[id] ? VALOR[id](dados[id]) : dados[id] || '';
  return `<div class="campo-dado">
      <label for="dado-${id}">${rotulo}</label>
      <input type="${type}" id="dado-${id}" name="${id}" value="${esc(valor)}"${inputmode ? ` inputmode="${inputmode}"` : ''}${placeholder ? ` placeholder="${placeholder}"` : ''} autocomplete="off" aria-describedby="erro-${id}">
      <small class="erro-campo" id="erro-${id}" data-erro="${id}"></small>
    </div>`;
}

const quando = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// A leitura feita ao abrir o painel (revisão de 14/11): a gravação leva de volta a versão lida (atualizado_em). Sem a
// leitura, o painel não deixa salvar (salvar a partir de dados velhos apagaria o que outra pessoa gravou)
let leitura = { pedido: 0, atualizadoEm: null, lida: false };

export async function abrirPainelDeDados(tipo, id, botao) {
  const p = pessoa(tipo, id);
  if (!p || !podeVerDadosPessoais()) return;
  const pedido = ++leitura.pedido;
  leitura = { pedido, atualizadoEm: null, lida: false };
  desenharPainel(tipo, id, botao, p, DADOS[tipo][id] || {});
  habilitarPainel(false, 'Lendo os dados…');
  let dados;
  try {
    dados = await ApiClient.lerDadosPessoais(tipo, id);
  } catch (e) {
    if (pedido !== leitura.pedido) return;
    habilitarPainel(false, 'Não foi possível ler os dados pessoais. Feche e tente de novo.');
    return;
  }
  if (pedido !== leitura.pedido || $('#painel-dados').hidden) return;
  leitura = { pedido, atualizadoEm: dados.atualizado_em || null, lida: true };
  if (Object.keys(dados).length) DADOS[tipo][id] = dados;
  else delete DADOS[tipo][id];
  atualizarColunas();
  desenharPainel(tipo, id, botao, p, dados);
  habilitarPainel(true, '');
  $('#dado-cpf').focus();
}

function habilitarPainel(sim, mensagem) {
  document.querySelectorAll('#form-dados input, #form-dados button[type="submit"]').forEach(el => { el.disabled = !sim; });
  $('#dados-erro').textContent = mensagem;
}

function desenharPainel(tipo, id, botao, p, dados) {
  const painel = $('#painel-dados');
  painel.dataset.tipo = tipo;
  painel.dataset.id = id;
  painel.dataset.botao = botao ? `[data-dados="${tipo}:${id}"]` : '';
  painel.innerHTML = `<div class="gaveta-cab">
      <h2 id="painel-dados-titulo">Dados pessoais <small>${esc(p.nm)}</small></h2>
      <button class="x" type="button" id="btn-fechar-dados" aria-label="Fechar o painel">✕</button>
    </div>
    <p class="h">Só operadores, administradores e a secretaria veem estes dados. Eles não vão para a escala, o CSV, o PDF nem o link compartilhado.</p>
    <form id="form-dados" class="form-dados" novalidate>
      ${CAMPOS_PESSOAIS.map(c => campoHtml(c, dados)).join('')}
      <p class="erro-campo" id="dados-erro" role="alert"></p>
      <div class="dlg-acoes">
        <button type="button" class="btn sec" id="btn-cancelar-dados">Cancelar</button>
        <button type="submit" class="btn">Salvar</button>
      </div>
      ${dados.atualizado_em ? `<p class="h">Atualizado em ${quando(dados.atualizado_em)}${dados.atualizado_por ? ` por ${esc(dados.atualizado_por)}` : ''}.</p>` : ''}
    </form>`;
  painel.hidden = false;
}

export function fecharPainelDeDados(devolverFoco = false) {
  const painel = $('#painel-dados');
  if (painel.hidden) return;
  painel.hidden = true;
  const botao = painel.dataset.botao && document.querySelector(painel.dataset.botao);
  if (devolverFoco && botao) botao.focus();
}

const comoFrase = texto => (texto.charAt(0).toUpperCase() + texto.slice(1)).replace(/\.?$/, '.');

function mostrarErros(erros) {
  document.querySelectorAll('#form-dados [data-erro]').forEach(el => {
    el.textContent = erros[el.dataset.erro] || '';
    $(`#dado-${el.dataset.erro}`).setAttribute('aria-invalid', String(Boolean(erros[el.dataset.erro])));
  });
  const [primeiro] = Object.keys(erros);
  if (primeiro) $(`#dado-${primeiro}`).focus();
}

// Valida, grava e atualiza a tabela. Devolve o nome e os campos que mudaram (para o aviso e o histórico) ou null
export async function salvarPainelDeDados() {
  const painel = $('#painel-dados');
  const tipo = painel.dataset.tipo, id = +painel.dataset.id;
  const entrada = Object.fromEntries(CAMPOS_PESSOAIS.map(({ id: c }) => [c, $(`#dado-${c}`).value]));
  $('#dados-erro').textContent = '';
  const { dados, erros } = validarDadosPessoais(entrada, hojeISO());
  mostrarErros(erros);
  if (Object.keys(erros).length) return null;
  if (!leitura.lida) return null;
  const data = DATA;
  let resposta;
  try {
    resposta = await ApiClient.salvarDadosPessoais(tipo, id, dados, { atualizadoEm: leitura.atualizadoEm, data });
  } catch (e) {
    if (e.campo) mostrarErros({ [e.campo]: comoFrase(e.message) });
    else if (e.code === 'PT409') $('#dados-erro').textContent = 'Outra pessoa alterou estes dados enquanto você editava. Feche e abra de novo para ver a versão atual.';
    else if (e.code === 'P0002') $('#dados-erro').textContent = 'Esta pessoa não está no cadastro gravado. Espere a alteração ser gravada e tente de novo.';
    else $('#dados-erro').textContent = 'Não foi possível salvar. Verifique a conexão e tente de novo.';
    return null;
  }
  if (Object.keys(dados).length) DADOS[tipo][id] = { ...dados, atualizado_em: resposta.atualizado_em, atualizado_por: resposta.atualizado_por || null };
  else delete DADOS[tipo][id];
  leitura = { ...leitura, atualizadoEm: resposta.atualizado_em || null };
  atualizarColunas();
  // O histórico já foi registrado junto com a gravação (o servidor registra os campos que mudaram)
  return { nome: pessoa(tipo, id).nm, historico: resposta.historico || null, data };
}
