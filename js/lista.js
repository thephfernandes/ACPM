// O componente de lista e detalhe, a parte da lista, sem DOM e sem o estado do app: um modelo entra (os itens que a tela
// montou), e saem o que a lista mostra (listaAVista), a contagem, o HTML de cada parte (cada uma um elemento com
// data-chave, que js/dom.js troca só quando muda: trocarPorChave), o que cada tecla faz, a escolha conciliada com o modelo
// e os vizinhos. Quem lê o estado e desenha é js/views/lista.js; o modelo de cada tela, o módulo dela (js/views/alunos.js).
//
// O item (uma linha): { id, titulo, linha2, meta, linha3, ponto ('', 'ok', 'aviso', 'erro', 'info'), pontoRotulo,
//   iniciais, icone, inativo, apagado, bloco (HTML só de leitura embaixo das três linhas), chave (o "Ativo" do cadastro:
//   { marcado, texto, rotulo, atributos }), rapida (a chave desta data: a mesma forma), acao ({ texto, rotulo, atributos },
//   no lugar da chave), grupo, atributos (os do li: data-k e data-id), busca (os textos que a busca compara), valores (o que
//   os filtros de vários valores comparam) }
// O grupo: { id, titulo, resumo, idDoDetalhe (o cabeçalho que se escolhe, com detalhe próprio) }
// O modelo: { fixos: [item], grupos: [grupo], itens: [item], estado: 'pronto' | 'lendo' | 'falhou' }
// O estado da lista (na memória, por lista): { busca, comInativos, recolhidos, mantidos, vistos, selecionado, parada,
//   pedida, perdidos }; os ids guardados são texto (os do endereço também)
import { esc, chaveDeBusca, iniciais } from './format.js';

const texto = id => String(id);
const chaveDoItem = (prefixo, id) => `${prefixo}:${texto(id)}`;

// A cor do avatar: cinco, pelo id (o número; num texto, a soma dos códigos das letras)
export function corDoAvatar(id) {
  const n = typeof id === 'number' && Number.isFinite(id) ? Math.abs(Math.trunc(id))
    : [...texto(id)].reduce((soma, c) => soma + c.charCodeAt(0), 0);
  return `av${(n % 5) + 1}`;
}

// O que a lista mostra. Um item é desenhado quando está no alcance de "Mostrar inativos" (o apagado sempre está) e passa
// na busca e nos filtros (passa), ou quando é mantido (o novo, o alterado agora) ou foi visto no último desenho (uma linha
// não some debaixo do ponteiro: quem limpa os vistos é a mudança de um filtro). Os fixos vêm antes, nunca filtrados nem
// contados; depois cada grupo com os itens dele (o grupo sem item à vista não aparece; o recolhido, só o cabeçalho, a não
// ser com texto na busca) e os itens sem grupo
export function listaAVista(modelo, estado, { chave = chaveDeBusca, passa = () => true, filtrando = false } = {}) {
  const situacao = modelo && modelo.estado ? modelo.estado : 'pronto';
  const fixos = situacao === 'pronto' ? [...(modelo.fixos || [])] : [];
  const itens = situacao === 'pronto' ? [...(modelo.itens || [])] : [];
  const busca = chave(estado.busca || '');
  const buscando = Boolean(busca);
  const casa = item => !busca || (item.busca || []).some(t => chave(t).includes(busca));
  const noAlcance = item => estado.comInativos || item.apagado || !item.inativo;
  const desenhado = item => (noAlcance(item) && casa(item) && passa(item))
    || estado.mantidos.has(texto(item.id)) || estado.vistos.has(texto(item.id));
  const passam = itens.filter(desenhado);
  const deGrupo = new Map((modelo.grupos || []).map(g => [g.id, g]));
  const blocos = [];
  for (const grupo of modelo.grupos || []) {
    const doGrupo = passam.filter(i => i.grupo === grupo.id);
    if (!doGrupo.length) continue;
    blocos.push({ grupo, itens: estado.recolhidos.has(grupo.id) && !buscando ? [] : doGrupo });
  }
  const semGrupo = passam.filter(i => !i.grupo || !deGrupo.has(i.grupo));
  if (semGrupo.length) blocos.push({ grupo: null, itens: semGrupo });

  // As paradas (o que as setas percorrem) e os registros (o que se escolhe: os itens, os fixos e os cabeçalhos com detalhe)
  const paradas = [], registros = [];
  for (const f of fixos) { paradas.push(chaveDoItem('f', f.id)); registros.push({ chave: chaveDoItem('f', f.id), id: texto(f.id) }); }
  for (const { grupo, itens: doBloco } of blocos) {
    if (grupo) {
      paradas.push(chaveDoItem('g', grupo.id));
      if (grupo.idDoDetalhe !== undefined && grupo.idDoDetalhe !== null) registros.push({ chave: chaveDoItem('g', grupo.id), id: texto(grupo.idDoDetalhe) });
    }
    for (const i of doBloco) { paradas.push(chaveDoItem('i', i.id)); registros.push({ chave: chaveDoItem('i', i.id), id: texto(i.id) }); }
  }

  const total = itens.filter(i => estado.comInativos || i.apagado || !i.inativo).length;
  const inativos = itens.filter(i => i.inativo && !i.apagado).length;
  const inativosQuePassam = estado.comInativos ? 0 : itens.filter(i => i.inativo && !i.apagado && casa(i) && passa(i)).length;
  const filtrou = buscando || filtrando;
  let vazio = null;
  if (situacao === 'lendo' || situacao === 'falhou') vazio = situacao;
  else if (!itens.length) vazio = 'sem-itens';
  else if (!passam.length) vazio = inativosQuePassam ? (filtrou ? 'filtros-inativos' : 'inativos') : 'filtros';
  return {
    fixos, blocos, paradas, registros, total, aVista: passam.length, inativos, inativosQuePassam, filtrando: filtrou, vazio,
    ids: new Set(passam.map(i => texto(i.id)))
  };
}

// "12 de 40 alunos" com algum filtro; "40 alunos" sem; nada sem itens
export function textoDaContagem(vista, [um, varios]) {
  if (!vista.total) return '';
  const nome = vista.total === 1 ? um : varios;
  return vista.filtrando ? `${vista.aVista} de ${vista.total} ${nome}` : `${vista.total} ${nome}`;
}

const tab = parada => (parada ? '0' : '-1');
const atributos = a => (a ? ` ${a}` : '');

// A chave (o "Ativo" do cadastro): um botão com role="switch", a palavra à vista
const chaveHtml = (c, parada) => `<button type="button" class="lista-chave edit-only" role="switch" aria-checked="${c.marcado ? 'true' : 'false'}"${atributos(c.atributos)} aria-label="${esc(c.rotulo)}" tabindex="${tab(parada)}">${esc(c.texto)}</button>`;
// A chave desta data (o "Vem", o "Disponível"): a caixa de sempre, com a palavra
const rapidaHtml = (r, parada) => `<label class="alvo lista-rapida edit-only"><input type="checkbox" class="sw"${atributos(r.atributos)}${r.marcado ? ' checked' : ''} aria-label="${esc(r.rotulo)}" tabindex="${tab(parada)}"> ${esc(r.texto)}</label>`;
// A ação da linha (o "Aprovar" de um pedido), no lugar da chave: não escolhe a linha
const acaoHtml = (a, parada) => `<button type="button" class="btn quiet lista-acao edit-only"${atributos(a.atributos)} aria-label="${esc(a.rotulo)}" tabindex="${tab(parada)}">${esc(a.texto)}</button>`;

const avatarHtml = (item, classe = '') => `<span class="lista-avatar${classe} ${corDoAvatar(item.id)}" aria-hidden="true">${item.icone
  ? `<svg class="ico" aria-hidden="true"><use href="#${esc(item.icone)}"/></svg>` : esc(item.iniciais || iniciais(item.titulo || ''))}</span>`;

// Uma linha: o li (com os atributos da tela) tem o botão que escolhe (o ponto, o avatar e as três linhas) e, ao lado
// dele, os controles (nada interativo um dentro do outro). Só a linha da parada fica no Tab
export function linhaHtml(lista, item, { selecionado = false, parada = false, prefixo = 'i' } = {}) {
  const classes = ['lista-linha', item.inativo ? 'inativo' : '', item.apagado ? 'apagado' : ''].filter(Boolean).join(' ');
  const ponto = item.ponto ? `<span class="lista-ponto ${esc(item.ponto)}"${item.pontoRotulo ? ` title="${esc(item.pontoRotulo)}"` : ''} aria-hidden="true"></span>` : '<span class="lista-ponto" aria-hidden="true"></span>';
  const etiqueta = item.inativo ? ' <span class="tag lista-inativo">inativo</span>' : '';
  const l2 = item.linha2 || item.meta || etiqueta
    ? `<span class="lista-l2"><span class="lista-l2-texto">${esc(item.linha2 || '')}</span>${etiqueta}${item.meta ? `<small class="lista-meta">${esc(item.meta)}</small>` : ''}</span>` : '';
  const controles = item.acao ? acaoHtml(item.acao, parada)
    : (item.chave ? chaveHtml(item.chave, parada) : '') + (item.rapida && !item.inativo ? rapidaHtml(item.rapida, parada) : '');
  return `<li class="${classes}" data-chave="${chaveDoItem(prefixo, esc(item.id))}"${atributos(item.atributos)}>`
    + `<button type="button" class="lista-botao" id="lin-${lista}-${esc(item.id)}" data-item="${esc(item.id)}"${selecionado ? ' aria-current="true"' : ''} tabindex="${tab(parada)}">`
    + ponto + avatarHtml(item)
    + `<span class="lista-texto"><b class="lista-titulo">${esc(item.titulo || '')}</b>${l2}`
    + (item.linha3 ? `<small class="lista-l3">${esc(item.linha3)}</small>` : '')
    + (item.bloco ? `<span class="lista-bloco">${item.bloco}</span>` : '')
    + (item.pontoRotulo ? `<span class="sr">${esc(item.pontoRotulo)}</span>` : '')
    + `</span></button>${controles}</li>`;
}

const setaHtml = '<svg class="ico seta" aria-hidden="true"><use href="#i-baixo"/></svg>';

// O cabeçalho de um grupo. Sem detalhe próprio, um botão só (recolhe e abre); com detalhe, a seta recolhe (fora do Tab)
// e o título escolhe o grupo, como um item
export function grupoHtml(lista, grupo, { recolhido = false, parada = false, selecionado = false } = {}) {
  const resumo = grupo.resumo ? ` <small>${esc(grupo.resumo)}</small>` : '';
  const aberto = recolhido ? 'false' : 'true';
  const inicio = `<li class="lista-grupo${recolhido ? ' recolhido' : ''}" data-chave="g:${esc(grupo.id)}">`;
  if (grupo.idDoDetalhe === undefined || grupo.idDoDetalhe === null) {
    return `${inicio}<button type="button" class="lista-botao lista-grupo-botao" id="grp-${lista}-${esc(grupo.id)}" data-lista-grupo="${esc(grupo.id)}" aria-expanded="${aberto}" tabindex="${tab(parada)}">${setaHtml}${esc(grupo.titulo)}${resumo}</button></li>`;
  }
  return `${inicio}<button type="button" class="lista-seta" id="grp-${lista}-${esc(grupo.id)}" data-lista-grupo="${esc(grupo.id)}" aria-expanded="${aberto}" aria-label="${recolhido ? 'Abrir' : 'Recolher'} ${esc(grupo.titulo)}" tabindex="-1">${setaHtml}</button>`
    + `<button type="button" class="lista-botao" id="lin-${lista}-${esc(grupo.idDoDetalhe)}" data-item="${esc(grupo.idDoDetalhe)}"${selecionado ? ' aria-current="true"' : ''} tabindex="${tab(parada)}">${esc(grupo.titulo)}${resumo}</button></li>`;
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const limparHtml = lista => `<button type="button" class="btn quiet" id="limpar-filtros-${lista}" data-lista-limpar="${lista}">Limpar filtros</button>`;
const inativosHtml = lista => `<button type="button" class="btn quiet" data-lista-inativos="${lista}">Mostrar inativos</button>`;

// O estado vazio da lista: sem itens, os filtros escondem todos (e quantos inativos passariam), lendo, a leitura falhou
export function vazioHtml(lista, vista, { nomes: [um], semItens = '', textoDoEstado = '' }) {
  const li = (chave, conteudo, extra = '') => `<li class="lista-vazia" data-chave="${chave}"${extra}>${conteudo}</li>`;
  switch (vista.vazio) {
    case 'lendo': return li('estado', esc(textoDoEstado), ' role="status"');
    case 'falhou': return li('estado', `${esc(textoDoEstado)} <button type="button" class="btn quiet" id="tentar-${lista}" data-lista-tentar="${lista}">Tentar de novo</button>`);
    case 'sem-itens': return li('vazio', esc(semItens));
    case 'inativos': return li('vazio', `Nenhum ${um} ativo; ${plural(vista.inativos, 'inativo', 'inativos')}. ${inativosHtml(lista)}`);
    case 'filtros-inativos': return li('vazio', `Nenhum ${um} ativo com esses filtros; ${plural(vista.inativosQuePassam, 'inativo passa', 'inativos passam')}. ${inativosHtml(lista)} ${limparHtml(lista)}`);
    default: return li('vazio', `Nenhum ${um} com esses filtros. ${limparHtml(lista)}`);
  }
}

// A parada do Tab: a última que teve o foco, se está à vista; senão a da escolha; senão a primeira
export function paradaDaLista(vista, estado) {
  if (estado.parada && vista.paradas.includes(estado.parada)) return estado.parada;
  const escolhida = estado.selecionado !== null && estado.selecionado !== undefined
    && vista.registros.find(r => r.id === texto(estado.selecionado));
  return escolhida ? escolhida.chave : vista.paradas[0] || null;
}

// As partes da lista, na ordem: os fixos, cada grupo e os itens dele, os sem grupo; ou o estado vazio
export function partesDaLista(lista, vista, estado, textos) {
  if (vista.vazio && !vista.fixos.length) return [{ chave: vista.vazio === 'lendo' || vista.vazio === 'falhou' ? 'estado' : 'vazio', html: vazioHtml(lista, vista, textos) }];
  const parada = paradaDaLista(vista, estado);
  const escolhido = estado.selecionado === null || estado.selecionado === undefined ? null : texto(estado.selecionado);
  const partes = vista.fixos.map(f => ({
    chave: chaveDoItem('f', f.id),
    html: linhaHtml(lista, f, { prefixo: 'f', selecionado: escolhido === texto(f.id), parada: parada === chaveDoItem('f', f.id) })
  }));
  for (const { grupo, itens } of vista.blocos) {
    if (grupo) {
      partes.push({ chave: chaveDoItem('g', grupo.id), html: grupoHtml(lista, grupo, {
        recolhido: estado.recolhidos.has(grupo.id) && !itens.length, parada: parada === chaveDoItem('g', grupo.id),
        selecionado: grupo.idDoDetalhe !== undefined && escolhido === texto(grupo.idDoDetalhe)
      }) });
    }
    for (const item of itens) {
      partes.push({ chave: chaveDoItem('i', item.id), html: linhaHtml(lista, item, { selecionado: escolhido === texto(item.id), parada: parada === chaveDoItem('i', item.id) }) });
    }
  }
  if (vista.vazio) partes.push({ chave: 'vazio', html: vazioHtml(lista, vista, textos) });
  return partes;
}

// O id que a parada escolhe (o item, o fixo, o cabeçalho com detalhe), ou null (o cabeçalho que só recolhe)
const idDaParada = (vista, parada) => (vista.registros.find(r => r.chave === parada) || {}).id ?? null;
const grupoDaParada = (vista, parada) => {
  if (!parada || !parada.startsWith('g:')) return null;
  const bloco = vista.blocos.find(b => b.grupo && chaveDoItem('g', b.grupo.id) === parada);
  return bloco ? bloco.grupo : null;
};

// O que uma tecla faz na lista, a partir da parada atual: { ir, escolher } (as setas, Home e End: o foco vai e a parada
// alcançada é escolhida), { detalhe: true } (Enter e →), { grupo, recolher } (← e → num grupo), ou null
export function teclaNaLista(vista, atual, tecla) {
  const i = vista.paradas.indexOf(atual);
  const grupo = grupoDaParada(vista, atual);
  const ir = destino => (destino === undefined || destino === null || destino === atual ? null : { ir: destino, escolher: idDaParada(vista, destino) });
  switch (tecla) {
    case 'ArrowDown': return i < 0 ? ir(vista.paradas[0]) : ir(vista.paradas[i + 1]);
    case 'ArrowUp': return i <= 0 ? null : ir(vista.paradas[i - 1]);
    case 'Home': return ir(vista.paradas[0]);
    case 'End': return ir(vista.paradas[vista.paradas.length - 1]);
    case 'ArrowLeft': return grupo && !vista.blocos.find(b => b.grupo === grupo && !b.itens.length) ? { grupo: grupo.id, recolher: true } : null;
    case 'ArrowRight':
    case 'Enter': {
      if (!grupo) return i < 0 ? null : { detalhe: true };
      const recolhido = vista.blocos.some(b => b.grupo === grupo && !b.itens.length);
      if (recolhido) return { grupo: grupo.id, recolher: false };
      if (grupo.idDoDetalhe !== undefined && grupo.idDoDetalhe !== null) return { detalhe: true };
      return tecla === 'Enter' ? { grupo: grupo.id, recolher: true } : null;
    }
    default: return null;
  }
}

// ↓ na busca: a primeira parada; com texto na busca, o primeiro item (sem os fixos e os cabeçalhos dos grupos)
export function primeiraDaBusca(vista, comTexto) {
  if (!comTexto) return vista.paradas[0] || null;
  return vista.paradas.find(p => p.startsWith('i:')) || null;
}

// A escolha diante do modelo de agora: a que saiu do modelo, ou se perdeu (a inclusão que o servidor recusou), sai (saiu:
// true); a pedida (o endereço, antes de os dados chegarem) vira a escolha no primeiro modelo que a tem
export function conciliar(estado, modelo) {
  const existe = new Set([...(modelo.fixos || []), ...(modelo.itens || [])].map(i => texto(i.id)));
  for (const g of modelo.grupos || []) if (g.idDoDetalhe !== undefined && g.idDoDetalhe !== null) existe.add(texto(g.idDoDetalhe));
  const valida = id => id !== null && id !== undefined && existe.has(texto(id)) && !estado.perdidos.has(texto(id));
  if (estado.pedida !== null && estado.pedida !== undefined && valida(estado.pedida)) {
    return { selecionado: texto(estado.pedida), pedida: null, saiu: false };
  }
  const tinha = estado.selecionado !== null && estado.selecionado !== undefined;
  const fica = tinha && valida(estado.selecionado);
  return { selecionado: fica ? texto(estado.selecionado) : null, pedida: estado.pedida ?? null, saiu: tinha && !fica };
}

// O registro antes (passo -1) ou depois (1) do id, entre os que a lista mostra; null nas pontas e fora da lista
export function vizinhoNaLista(vista, id, passo) {
  const i = vista.registros.findIndex(r => r.id === texto(id));
  if (i < 0) return null;
  const vizinho = vista.registros[i + passo];
  return vizinho ? vizinho.id : null;
}
