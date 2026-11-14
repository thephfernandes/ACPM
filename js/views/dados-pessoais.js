// Painel dos dados pessoais (fase 9): CPF, CANAC, nascimento, celular e e-mail de um aluno ou instrutor, ao lado da
// tabela. Só operadores, administradores e a secretaria veem (no modo local, fora do perfil Gestor). Os dados ficam só
// aqui, fora do estado: nunca vão para o cadastro, o link compartilhado, o CSV, o PDF ou o BI.
import { CAMPOS_PESSOAIS, validarDadosPessoais, formatarCpf, formatarCelular, camposAlterados } from '../dados-pessoais.js';
import { ApiClient } from '../storage.js';
import { veDadosPessoais } from '../perfis.js';
import { isGestor, insBy, stuBy } from '../state.js';
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

export function abrirPainelDeDados(tipo, id, botao) {
  const p = pessoa(tipo, id);
  if (!p || !podeVerDadosPessoais()) return;
  const dados = DADOS[tipo][id] || {};
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
  $('#dado-cpf').focus();
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
  try {
    await ApiClient.salvarDadosPessoais(tipo, id, dados);
  } catch (e) {
    if (e.campo) mostrarErros({ [e.campo]: comoFrase(e.message) });
    else $('#dados-erro').textContent = 'Não foi possível salvar. Verifique a conexão e tente de novo.';
    return null;
  }
  const antes = DADOS[tipo][id] || {};
  if (Object.keys(dados).length) DADOS[tipo][id] = { ...dados, atualizado_em: new Date().toISOString(), atualizado_por: ApiClient.autorAtual || null };
  else delete DADOS[tipo][id];
  atualizarColunas();
  return { nome: pessoa(tipo, id).nm, alterados: camposAlterados(antes, dados) };
}
