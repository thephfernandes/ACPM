// Os dados pessoais (CPF, CANAC, nascimento, celular e e-mail) no detalhe de uma pessoa: uma seção com "Salvar" e
// "Desfazer". Os campos aparecem na hora com o que está guardado (js/views/dados-pessoais.js) e ficam desligados até a
// pessoa ser lida, 250 ms depois de a escolha parar nela (a gravação leva de volta a versão lida). O que se digita é o
// rascunho daquela pessoa: fica na memória quando outra é escolhida, e a linha dela ganha o ponto "dados pessoais não
// salvos". "Salvar" (ou Enter) confere os cinco campos e grava de uma vez (uma entrada no histórico, como sempre), depois da
// gravação que incluiu a pessoa no cadastro; "Desfazer" joga o rascunho fora. Uma recusa fica com a pessoa (o ponto, o
// aviso da lista, a mensagem no campo quando ela é aberta de novo). Nada disso vai para o estado, o CSV, o PDF, o BI ou o
// link: o Gestor não vê a seção
import { ultimaGravacao, mostrarNoHistorico } from '../actions.js';
import { CAMPOS_PESSOAIS, validarDadosPessoais, formatarCpf, formatarCelular } from '../dados-pessoais.js';
import { anunciar, showToast } from '../dom.js';
import { esc, hojeISO } from '../format.js';
import { DATA } from '../state.js';
import { ApiClient } from '../storage.js';
import { dadosDe, guardarDados, podeVerDadosPessoais, podeEditarDadosPessoais } from './dados-pessoais.js';

const VALOR = { cpf: formatarCpf, celular: formatarCelular };
const TIPOS = { cpf: ['text', 'numeric', '000.000.000-00'], canac: ['text', 'numeric', '6 dígitos'], nascimento: ['date', '', ''], celular: ['tel', 'tel', '(37) 99999-9999'], email: ['email', 'email', 'nome@exemplo.com'] };
// A leitura espera a escolha parar (as setas passando por várias pessoas não leem cada uma)
const ESPERA_DA_LEITURA = 250;

// O estado de cada pessoa ('aluno:1000'), na memória
const PESSOAS = new Map();
const chaveDa = (tipo, id) => `${tipo}:${id}`;
function pessoa(tipo, id) {
  const chave = chaveDa(tipo, id);
  if (!PESSOAS.has(chave)) {
    PESSOAS.set(chave, { versao: null, lida: false, lendo: false, falhou: false, rascunho: null, versaoDoRascunho: null, enviando: false, recusa: null, erros: {}, pedido: 0, aviso: '' });
  }
  return PESSOAS.get(chave);
}
// O que cada tela redesenha quando os dados de uma pessoa mudam (pessoaEscolhida)
const aoMudarDe = new Map();
// forcar: a seção é refeita mesmo com o foco num campo dela (a gravação e a recusa mudam o que ela mostra)
const avisar = (tipo, { forcar = false } = {}) => { const fazer = aoMudarDe.get(tipo); if (fazer) fazer({ forcar }); };

const quando = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const comoFrase = texto => (texto.charAt(0).toUpperCase() + texto.slice(1)).replace(/\.?$/, '.');

// Os valores dos campos: o rascunho, senão o que está guardado
function valores(tipo, id) {
  const p = pessoa(tipo, id);
  if (p.rascunho) return p.rascunho;
  const guardados = dadosDe(tipo, id) || {};
  return Object.fromEntries(CAMPOS_PESSOAIS.map(({ id: c }) => [c, VALOR[c] ? VALOR[c](guardados[c]) : guardados[c] || '']));
}

// A seção "Dados pessoais" do detalhe (lista: o id da lista, que dá os ids dos campos), ou null para quem não vê
export function secaoDosDadosPessoais(lista, tipo, id) {
  if (!podeVerDadosPessoais()) return null;
  const p = pessoa(tipo, id);
  const edita = podeEditarDadosPessoais();
  const v = valores(tipo, id);
  const guardados = dadosDe(tipo, id) || {};
  const prefixo = `det-${lista}`;
  const campo = ({ id: c, rotulo }) => {
    const idDoCampo = `${prefixo}-${c}`;
    if (!edita) {
      return `<div class="det-campo"><span class="det-rotulo" id="${idDoCampo}-rotulo">${rotulo}</span><div class="det-valor" aria-labelledby="${idDoCampo}-rotulo">${esc(v[c] || '—')}</div></div>`;
    }
    const [type, inputmode, placeholder] = TIPOS[c];
    const erro = p.erros[c] || '';
    return `<div class="det-campo"><span class="det-rotulo"><label for="${idDoCampo}">${rotulo}</label></span><div class="det-valor">`
      + `<input id="${idDoCampo}" class="dado-campo" data-dado="${c}" type="${type}" value="${esc(v[c] || '')}"${inputmode ? ` inputmode="${inputmode}"` : ''}${placeholder ? ` placeholder="${placeholder}"` : ''} autocomplete="off"`
      + `${p.lida && !p.enviando ? '' : ' disabled'} aria-describedby="${idDoCampo}-erro"${erro ? ' aria-invalid="true"' : ''}>`
      + `<small class="erro-campo" id="${idDoCampo}-erro">${esc(erro)}</small></div></div>`;
  };
  const aviso = p.enviando ? '' : p.recusa && !p.recusa.campo ? p.recusa.texto : p.falhou ? 'Não foi possível ler os dados pessoais.' : p.lendo || (!p.lida && edita) ? 'Lendo os dados…' : p.aviso;
  const tentar = p.falhou && !p.lendo ? ` <button type="button" class="btn quiet" id="${prefixo}-dados-tentar" data-ler-dados="${tipo}:${id}">Tentar de novo</button>` : '';
  const rodape = p.enviando ? 'Salvando…'
    : guardados.atualizado_em ? `Atualizado em ${quando(guardados.atualizado_em)}${guardados.atualizado_por ? ` por ${esc(guardados.atualizado_por)}` : ''}.` : '';
  const acoes = edita ? `<div class="det-dados-acoes"><button type="button" class="btn quiet" id="${prefixo}-dados-desfazer" data-desfazer-dados="${tipo}:${id}"${p.rascunho ? '' : ' hidden'}>Desfazer</button>`
    + `<button type="submit" class="btn" id="${prefixo}-dados-salvar"${p.lida && !p.enviando ? '' : ' disabled'}>Salvar</button></div>` : '';
  const html = `<div class="dados-pessoais" data-pessoa="${tipo}:${id}"><p class="h">Só operadores, administradores e a secretaria veem estes dados. Eles não vão para a escala, o CSV, o PDF nem o link compartilhado.</p>`
    + `<form class="dados-form" data-lista="${lista}" novalidate>${CAMPOS_PESSOAIS.map(campo).join('')}`
    + `<p class="det-dados-aviso${p.recusa || p.falhou ? ' erro' : ''}" id="${prefixo}-dados-aviso" role="alert">${esc(aviso)}${tentar}</p>`
    + `${acoes}<p class="h det-dados-rodape" aria-live="polite">${rodape}</p></form></div>`;
  return { id: 'dados', titulo: 'Dados pessoais', icone: 'i-cadeado', escopo: 'todas as datas', campos: [], html };
}

// A marca da pessoa na linha dela: o rascunho não salvo ("aviso") ou a recusa ("erro"); null sem nada
export function marcaDaPessoa(tipo, id) {
  const p = PESSOAS.get(chaveDa(tipo, id));
  if (!p) return null;
  if (p.recusa) return { ponto: 'erro', rotulo: 'dados pessoais não salvos' };
  if (p.rascunho || p.enviando) return { ponto: 'aviso', rotulo: 'dados pessoais não salvos' };
  return null;
}

// Há rascunho, gravação em andamento ou recusa não vista? (sair da página pergunta antes: js/main.js)
export const dadosPessoaisPendentes = () => [...PESSOAS.values()].some(p => p.rascunho || p.enviando || p.recusa);

// Lê a pessoa (a versão que a gravação leva de volta). A resposta de uma leitura que ficou para trás não vale
async function ler(tipo, id) {
  const p = pessoa(tipo, id);
  const pedido = ++p.pedido;
  p.lendo = true;
  p.falhou = false;
  let dados;
  try {
    dados = await ApiClient.lerDadosPessoais(tipo, id);
  } catch {
    if (pedido !== p.pedido) return;
    p.lendo = false;
    p.falhou = true;
    avisar(tipo);
    return;
  }
  if (pedido !== p.pedido || p.enviando) return;
  p.lendo = false;
  p.lida = true;
  p.versao = dados.atualizado_em || null;
  guardarDados(tipo, id, Object.keys(dados).length ? dados : null);
  avisar(tipo);
}

// A escolha parou numa pessoa: a leitura, 250 ms depois (a escolha que muda antes cancela). aoMudar: o que a tela
// redesenha quando os dados dela chegam ou mudam
const esperas = new Map();
// A última pessoa escolhida de cada tipo: a leitura que falhou só se repete numa escolha nova dela (ou em "Tentar de novo"),
// não a cada desenho (cada um, com a leitura falhando, pediria outra: as tentativas não parariam)
const escolhidas = new Map();
export function pessoaEscolhida(tipo, id, aoMudar) {
  aoMudarDe.set(tipo, aoMudar);
  const nova = escolhidas.get(tipo) !== id;
  escolhidas.set(tipo, id);
  clearTimeout(esperas.get(tipo));
  if (id === null || id === undefined || !podeVerDadosPessoais()) return;
  const p = pessoa(tipo, id);
  if (p.lida || p.lendo || p.enviando || (p.falhou && !nova)) return;
  esperas.set(tipo, setTimeout(() => ler(tipo, id), ESPERA_DA_LEITURA));
}

// "Tentar de novo" depois de uma leitura que falhou
export function lerDeNovo(tipo, id) {
  ler(tipo, id);
  avisar(tipo);
}

// O que foi digitado: o rascunho da pessoa (os cinco campos como estão), com a versão em que ele começou. Os campos de
// volta ao que está guardado (o Esc, ou o texto apagado à mão) não são rascunho. Responde se há rascunho
export function digitou(tipo, id, form) {
  const p = pessoa(tipo, id);
  const versaoAntes = p.rascunho ? p.versaoDoRascunho : p.versao;
  p.rascunho = null;
  const guardados = valores(tipo, id);
  const digitado = Object.fromEntries(CAMPOS_PESSOAIS.map(({ id: c }) => {
    const el = form.querySelector(`[data-dado="${c}"]`);
    return [c, el ? el.value : ''];
  }));
  const igual = CAMPOS_PESSOAIS.every(({ id: c }) => (digitado[c] || '') === (guardados[c] || ''));
  p.rascunho = igual ? null : digitado;
  p.versaoDoRascunho = igual ? null : versaoAntes;
  p.recusa = null;
  avisar(tipo);
  return Boolean(p.rascunho);
}

// "Desfazer": o rascunho sai
export function desfazer(tipo, id) {
  const p = pessoa(tipo, id);
  p.rascunho = null;
  p.versaoDoRascunho = null;
  p.erros = {};
  p.recusa = null;
  avisar(tipo);
}

// "Salvar": confere, espera a gravação que incluiu a pessoa e grava. nome: o da pessoa, para os avisos
export async function salvar(tipo, id, form, nome) {
  const p = pessoa(tipo, id);
  if (!p.lida || p.enviando) return;
  const entrada = p.rascunho || Object.fromEntries(CAMPOS_PESSOAIS.map(({ id: c }) => [c, (form.querySelector(`[data-dado="${c}"]`) || {}).value || '']));
  const { dados, erros } = validarDadosPessoais(entrada, hojeISO());
  p.erros = erros;
  p.recusa = null;
  p.aviso = '';
  if (Object.keys(erros).length) {
    avisar(tipo, { forcar: true });
    const primeiro = form.ownerDocument.getElementById(`det-${form.dataset.lista}-${Object.keys(erros)[0]}`);
    if (primeiro) primeiro.focus();
    anunciar(Object.values(erros)[0]);
    return;
  }
  const data = DATA;
  const versao = p.rascunho ? p.versaoDoRascunho : p.versao;
  p.enviando = true;
  // "Salvando…" (com o foco num campo, a seção espera: o Enter não perde o lugar)
  avisar(tipo);
  const recusar = texto => {
    p.enviando = false;
    p.recusa = { campo: null, texto };
    avisar(tipo, { forcar: true });
  };
  if (!await ultimaGravacao()) {
    recusar(`O cadastro de ${nome} não foi gravado: os dados pessoais não foram enviados.`);
    return;
  }
  let resposta;
  try {
    resposta = await ApiClient.salvarDadosPessoais(tipo, id, dados, { atualizadoEm: versao, data });
  } catch (e) {
    if (e.campo) {
      p.enviando = false;
      p.erros = { [e.campo]: comoFrase(e.message) };
      p.recusa = { campo: e.campo, texto: comoFrase(e.message) };
      avisar(tipo, { forcar: true });
      return;
    }
    if (e.code === 'PT409') {
      p.enviando = false;
      p.rascunho = null;
      p.lida = false;
      p.aviso = `Outra pessoa alterou os dados de ${nome} enquanto você editava: a tela mostra a versão atual. Refaça a alteração.`;
      await ler(tipo, id);
      p.aviso = `Outra pessoa alterou os dados de ${nome} enquanto você editava: a tela mostra a versão atual. Refaça a alteração.`;
      avisar(tipo, { forcar: true });
      return;
    }
    if (e.code === 'P0002') { recusar('Esta pessoa não está no cadastro gravado. Espere a alteração ser gravada e tente de novo.'); return; }
    if (e.code === '42501') { recusar('A sua conta não pode alterar dados pessoais.'); return; }
    recusar('Não foi possível salvar. Verifique a conexão e tente de novo.');
    return;
  }
  guardarDados(tipo, id, Object.keys(dados).length ? { ...dados, atualizado_em: resposta.atualizado_em, atualizado_por: resposta.atualizado_por || null } : null);
  p.versao = resposta.atualizado_em || null;
  p.rascunho = null;
  p.versaoDoRascunho = null;
  p.enviando = false;
  p.erros = {};
  avisar(tipo, { forcar: true });
  // O histórico já foi registrado junto com a gravação (o servidor registra os campos que mudaram)
  if (resposta.historico && data === DATA) mostrarNoHistorico(resposta.historico);
  showToast(`Dados pessoais de ${nome} salvos.`, 'ok');
  anunciar(`Dados pessoais de ${nome} salvos.`);
}

// As pessoas com uma recusa (para o aviso da lista, quando ela não está aberta)
export const recusasDe = tipo => [...PESSOAS.entries()].filter(([chave, p]) => chave.startsWith(`${tipo}:`) && p.recusa).map(([chave, p]) => ({ id: chave.slice(tipo.length + 1), texto: p.recusa.texto }));
