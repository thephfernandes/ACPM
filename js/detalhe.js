// O componente de lista e detalhe, a parte do detalhe, sem DOM e sem o estado do app: o modelo do registro escolhido
// entra, e sai o HTML das partes (o cabeçalho, o aviso, cada seção, o rodapé), cada uma com data-chave (js/dom.js troca só
// a que mudou). Os campos são linhas "Rótulo: valor" editadas no lugar: o controle tem o data-f ou o data-a da tela (o
// handler de sempre grava no change); para quem só consulta, o texto. Quem desenha é js/views/detalhe.js.
//
// O modelo: { atributos (os do registro: data-k e data-id), id, titulo, subtitulo, iniciais, icone, aviso, acoes ([{ id,
//   rotulo, icone, atributos }], os ícones da tela ao lado de "Anterior" e "Próximo"), secoes, rodape ([{ id, texto, rotulo,
//   atributos, soEdicao }]) }
// A seção: { id, titulo, icone, escopo ("todas as datas", "nesta data · sex 20/11"), campos, html (o que a tela desenha
//   embaixo dos campos) }
// O campo: { id, rotulo, tipo, valor, texto (o que quem só consulta lê), atributos, dica ([termo, rótulo do "?"]), falta,
//   opcoes ([[valor, rótulo]]), itens e acrescentar (as etiquetas), classe, html }; tipo: 'texto', 'numero', 'data', 'tel',
//   'email', 'selecao', 'etiquetas', 'leitura' ou 'html'
import { esc, iniciais } from './format.js';
import { corDoAvatar } from './lista.js';

const TIPO_DO_INPUT = { texto: 'text', numero: 'number', data: 'date', tel: 'tel', email: 'email' };
const atributos = a => (a ? ` ${a}` : '');
const dicaHtml = dica => (dica ? `<button type="button" class="dica-btn" data-dica="${esc(dica[0])}" aria-label="${esc(dica[1])}" aria-expanded="false"></button>` : '');
const opcoesHtml = (opcoes, valor) => opcoes.map(([v, r]) => `<option value="${esc(v)}"${valor !== undefined && String(v) === String(valor) ? ' selected' : ''}>${esc(r)}</option>`).join('');

// Uma etiqueta (o instrutor de "Priorizar com"), com o ✕ para quem edita
const etiquetaHtml = (e, edita) => `<span class="tg${e.classe ? ` ${esc(e.classe)}` : ''}">${esc(e.texto)}${edita && e.atributos
  ? `<button type="button" class="edit-only"${atributos(e.atributos)} aria-label="${esc(e.rotulo)}">✕</button>` : ''}</span>`;

// Um campo. erro: { digitado, texto } (o valor recusado fica no campo, com a mensagem, até ser gravado, o Esc ou outro
// registro)
export function campoHtml(lista, campo, { edita = true, erro = null } = {}) {
  const id = `det-${lista}-${campo.id}`;
  const inicio = `<div class="det-campo" data-campo="${esc(campo.id)}">`;
  if (campo.tipo === 'html') return `<div class="det-campo det-campo-html" data-campo="${esc(campo.id)}">${campo.html || ''}</div>`;
  const leitura = conteudo => `${inicio}<span class="det-rotulo" id="${id}-rotulo">${esc(campo.rotulo)}${dicaHtml(campo.dica)}</span><div class="det-valor" aria-labelledby="${id}-rotulo">${conteudo}</div></div>`;
  if (campo.tipo === 'etiquetas') {
    const itens = campo.itens || [];
    if (!edita) return leitura(itens.length ? `<div class="bl det-etiquetas${campo.classe ? ` ${esc(campo.classe)}` : ''}">${itens.map(e => etiquetaHtml(e, false)).join('')}</div>` : '—');
    const a = campo.acrescentar;
    const lista = a ? `<select id="${id}" class="edit-only"${atributos(a.atributos)} aria-label="${esc(a.rotulo || campo.rotulo)}"><option value="">${esc(a.vazio || '')}</option>${opcoesHtml(a.opcoes || [])}</select>` : '';
    return `${inicio}<span class="det-rotulo"><label for="${id}">${esc(campo.rotulo)}</label>${dicaHtml(campo.dica)}</span>`
      + `<div class="det-valor"><div class="bl det-etiquetas${campo.classe ? ` ${esc(campo.classe)}` : ''}">${itens.map(e => etiquetaHtml(e, true)).join('')}${lista}</div></div></div>`;
  }
  const textoParaLer = campo.texto !== undefined ? campo.texto : campo.valor ?? '';
  if (campo.tipo === 'leitura' || !edita) return leitura(esc(textoParaLer === '' ? '—' : textoParaLer));
  const invalido = erro ? ' aria-invalid="true"' : '';
  const descricao = ` aria-describedby="${id}-erro"`;
  let controle;
  if (campo.tipo === 'selecao') {
    controle = `<select id="${id}"${atributos(campo.atributos)}${descricao}${invalido}>${opcoesHtml(campo.opcoes || [], erro ? erro.digitado : campo.valor)}</select>`;
  } else {
    const valor = erro ? erro.digitado : campo.valor ?? '';
    controle = `<input id="${id}" type="${TIPO_DO_INPUT[campo.tipo] || 'text'}" value="${esc(valor)}"${campo.falta ? ' class="falta"' : ''}${atributos(campo.atributos)}${descricao}${invalido}>`;
  }
  return `${inicio}<span class="det-rotulo"><label for="${id}">${esc(campo.rotulo)}</label>${dicaHtml(campo.dica)}</span>`
    + `<div class="det-valor">${controle}<small class="erro-campo" id="${id}-erro">${erro ? esc(erro.texto) : ''}</small></div></div>`;
}

// Uma seção: o botão que recolhe (no título, com o ícone, o escopo e a seta) e o corpo, um grupo com os campos
export function secaoHtml(lista, secao, { recolhida = false, edita = true, erros = new Map() } = {}) {
  const id = `sec-${lista}-${secao.id}`;
  const icone = secao.icone ? `<svg class="ico" aria-hidden="true"><use href="#${esc(secao.icone)}"/></svg>` : '';
  const escopo = secao.escopo ? ` <small class="det-escopo">${esc(secao.escopo)}</small>` : '';
  const resumo = secao.resumo ? ` <small class="det-resumo">${esc(secao.resumo)}</small>` : '';
  const campos = (secao.campos || []).map(c => campoHtml(lista, c, { edita, erro: erros.get(c.id) || null })).join('');
  return `<div class="det-secao-bloco" data-chave="s:${esc(secao.id)}"><h4 class="det-secao"><button type="button" class="det-secao-btn" id="${id}" data-secao="${esc(secao.id)}" aria-expanded="${recolhida ? 'false' : 'true'}" aria-controls="${id}-corpo">`
    + `${icone}${esc(secao.titulo)}${escopo}${resumo}<svg class="ico seta" aria-hidden="true"><use href="#i-baixo"/></svg></button></h4>`
    + `<div class="det-secao-corpo" id="${id}-corpo" role="group" aria-labelledby="${id}"${recolhida ? ' hidden' : ''}>${campos}${secao.html || ''}</div></div>`;
}

const maiuscula = t => t.charAt(0).toUpperCase() + t.slice(1);

// O cabeçalho: a volta para a lista (só com uma vista, abaixo de 800 px), o avatar, o título (recebe o foco), o subtítulo
// e as ações de ícone: as da tela e "Anterior" e "Próximo" (o registro de antes e o de depois na lista; na ponta, desligado)
export function cabecalhoHtml(lista, modelo, { nomes: [um] = ['item'], rotulo = '', anterior = null, proximo = null } = {}) {
  const avatar = `<span class="lista-avatar grande ${corDoAvatar(modelo.id ?? modelo.titulo)}" aria-hidden="true">${modelo.icone
    ? `<svg class="ico" aria-hidden="true"><use href="#${esc(modelo.icone)}"/></svg>` : esc(modelo.iniciais || iniciais(modelo.titulo || ''))}</span>`;
  const acao = a => `<button type="button" class="det-acao edit-only"${atributos(a.atributos)} aria-label="${esc(a.rotulo)}" title="${esc(a.rotulo)}"><svg class="ico" aria-hidden="true"><use href="#${esc(a.icone)}"/></svg></button>`;
  const desligado = v => (v === null || v === undefined ? ' aria-disabled="true"' : '');
  return `<div class="det-cab" data-chave="cab"><a class="btn quiet voltar md-voltar" id="det-${lista}-voltar" href="#/${lista}" data-lista-voltar="${lista}">‹ ${esc(rotulo)}</a>`
    + `${avatar}<div class="det-nome"><h3 class="det-titulo" id="det-${lista}-titulo" tabindex="-1">${esc(modelo.titulo || '')}</h3>${modelo.subtitulo ? `<p class="det-sub">${esc(modelo.subtitulo)}</p>` : ''}</div>`
    + `<div class="det-acoes" role="group" aria-label="Ações">${(modelo.acoes || []).map(acao).join('')}`
    + `<button type="button" class="det-acao" id="det-${lista}-anterior" data-lista-anterior="${lista}" aria-label="${esc(maiuscula(um))} anterior" title="Anterior (Ctrl+,)" aria-keyshortcuts="Control+Comma"${desligado(anterior)}><svg class="ico" aria-hidden="true"><use href="#i-cima"/></svg></button>`
    + `<button type="button" class="det-acao" id="det-${lista}-proximo" data-lista-proximo="${lista}" aria-label="Próximo ${esc(um)}" title="Próximo (Ctrl+.)" aria-keyshortcuts="Control+Period"${desligado(proximo)}><svg class="ico" aria-hidden="true"><use href="#i-baixo"/></svg></button>`
    + '</div></div>';
}

// As partes do detalhe, na ordem: o cabeçalho, o aviso (vazio fica escondido), uma por seção, o rodapé (as ações de texto;
// as de edição, só para quem edita)
export function partesDoDetalhe(lista, modelo, { edita = true, erros = new Map(), recolhidas = new Set(), ...opcoes } = {}) {
  const rodape = (modelo.rodape || []).filter(a => edita || !a.soEdicao).map(a => `<button type="button" class="btn quiet${a.soEdicao ? ' edit-only' : ''}" id="det-${lista}-${esc(a.id)}"${atributos(a.atributos)} aria-label="${esc(a.rotulo || a.texto)}">${esc(a.texto)}</button>`).join('');
  return [
    { chave: 'cab', html: cabecalhoHtml(lista, modelo, opcoes) },
    { chave: 'aviso', html: `<p class="det-aviso" id="det-${lista}-aviso" role="status" data-chave="aviso"${modelo.aviso ? '' : ' hidden'}>${esc(modelo.aviso || '')}</p>` },
    ...(modelo.secoes || []).map(s => ({ chave: `s:${s.id}`, html: secaoHtml(lista, s, { recolhida: recolhidas.has(s.id), edita, erros }) })),
    { chave: 'rodape', html: `<div class="det-rodape" data-chave="rodape">${modelo.rodapeTexto ? `<p class="h">${esc(modelo.rodapeTexto)}</p>` : ''}${rodape}</div>` }
  ];
}

// O detalhe inteiro (outro registro: tudo de novo), com os atributos do registro, que js/eventos/registro.js lê
export const detalheHtml = (lista, modelo, opcoes) => `<div class="det"${atributos(modelo.atributos)}>${partesDoDetalhe(lista, modelo, opcoes).map(p => p.html).join('')}</div>`;

// Nada escolhido
export const vazioDoDetalheHtml = texto => `<p class="det-vazio h">${esc(texto)}</p>`;
