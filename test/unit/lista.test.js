// O componente de lista (js/lista.js, puro): o que a lista mostra (a busca, os filtros, os inativos, os fixos, os grupos,
// as linhas que ficam até um filtro mudar), a contagem, o HTML de cada parte (os controles irmãos do botão que escolhe, uma
// só parada do Tab), os estados vazios, as teclas, a conciliação da escolha e os vizinhos
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listaAVista, textoDaContagem, partesDaLista, linhaHtml, grupoHtml, vazioHtml, teclaNaLista, primeiraDaBusca, conciliar,
  vizinhoNaLista, corDoAvatar, paradaDaLista
} from '../../js/lista.js';

const estadoNovo = (mais = {}) => ({
  busca: '', comInativos: false, recolhidos: new Set(), mantidos: new Set(), vistos: new Set(), selecionado: null, parada: null,
  pedida: null, perdidos: new Set(), ...mais
});
const item = (id, mais = {}) => ({ id, titulo: `Aluno ${id}`, busca: [`Aluno ${id}`], atributos: `data-k="s" data-id="${id}"`, valores: {}, ...mais });
const modelo = (mais = {}) => ({ fixos: [], grupos: [], itens: [item(1000), item(1001, { titulo: 'José Ávila', busca: ['José Ávila', '123456'] }), item(1002, { inativo: true })], estado: 'pronto', ...mais });
const ids = vista => vista.blocos.flatMap(b => b.itens.map(i => i.id));
const NOMES = ['aluno', 'alunos'];

describe('listaAVista: o que a lista mostra', () => {
  it('sem filtros: os ativos, na ordem do cadastro; o inativo fica fora e é contado à parte', () => {
    const vista = listaAVista(modelo(), estadoNovo());
    assert.deepEqual(ids(vista), [1000, 1001]);
    assert.equal(vista.total, 2);
    assert.equal(vista.aVista, 2);
    assert.equal(vista.inativos, 1);
    assert.equal(vista.vazio, null);
  });

  it('a busca compara sem acentos e sem maiúsculas cada texto do item (o CANAC só quando o item o traz)', () => {
    assert.deepEqual(ids(listaAVista(modelo(), estadoNovo({ busca: 'jose avi' }))), [1001]);
    assert.deepEqual(ids(listaAVista(modelo(), estadoNovo({ busca: '2345' }))), [1001]);
    assert.deepEqual(ids(listaAVista(modelo({ itens: [item(1001, { titulo: 'José', busca: ['José'] })] }), estadoNovo({ busca: '2345' }))), []);
  });

  it('a chave da busca é a da tela (a matrícula sem o hífen, em Recursos)', () => {
    const chave = t => String(t).toUpperCase().replace(/-/g, '');
    const m = modelo({ itens: [item('PR-VOB', { busca: ['PR-VOB'] }), item('PR-IGU', { busca: ['PR-IGU'] })] });
    assert.deepEqual(ids(listaAVista(m, estadoNovo({ busca: 'prvo' }), { chave })), ['PR-VOB']);
  });

  it('os filtros de vários valores (passa) valem junto com a busca; com eles, a contagem é "N de M"', () => {
    const m = modelo({ itens: [item(1, { valores: { curso: ['PP'] } }), item(2, { valores: { curso: ['PC'] } })] });
    const vista = listaAVista(m, estadoNovo(), { passa: i => i.valores.curso.includes('PP'), filtrando: true });
    assert.deepEqual(ids(vista), [1]);
    assert.equal(textoDaContagem(vista, NOMES), '1 de 2 alunos');
    assert.equal(textoDaContagem(listaAVista(m, estadoNovo()), NOMES), '2 alunos');
    assert.equal(textoDaContagem(listaAVista(modelo({ itens: [item(1)] }), estadoNovo()), NOMES), '1 aluno');
    assert.equal(textoDaContagem(listaAVista(modelo({ itens: [] }), estadoNovo()), NOMES), '');
  });

  it('"Mostrar inativos": o inativo aparece e passa a contar no total', () => {
    const vista = listaAVista(modelo(), estadoNovo({ comInativos: true }));
    assert.deepEqual(ids(vista), [1000, 1001, 1002]);
    assert.equal(vista.total, 3);
  });

  it('o item apagado nunca some e não conta como inativo', () => {
    const m = modelo({ itens: [item(1), item(2, { apagado: true })] });
    const vista = listaAVista(m, estadoNovo());
    assert.deepEqual(ids(vista), [1, 2]);
    assert.equal(vista.inativos, 0);
  });

  it('a linha vista no último desenho e a mantida (o aluno novo) ficam até um filtro mudar', () => {
    const m = modelo();
    assert.deepEqual(ids(listaAVista(m, estadoNovo({ busca: 'jose', vistos: new Set(['1000']) }))), [1000, 1001]);
    assert.deepEqual(ids(listaAVista(m, estadoNovo({ busca: 'jose', mantidos: new Set(['1002']) }))), [1001, 1002]);
  });

  it('os fixos vêm primeiro, nunca são filtrados nem contados', () => {
    const m = modelo({ fixos: [item('hangar', { titulo: 'Ordem no hangar', busca: [] })] });
    const vista = listaAVista(m, estadoNovo({ busca: 'jose' }), { filtrando: true });
    assert.deepEqual(vista.fixos.map(f => f.id), ['hangar']);
    assert.equal(vista.total, 2);
    assert.equal(vista.paradas[0], 'f:hangar');
  });

  it('os grupos: um grupo sem item à vista não é desenhado; o recolhido não mostra os itens; com texto na busca, todos abertos', () => {
    const m = modelo({
      grupos: [{ id: 'C152', titulo: 'C152' }, { id: 'C172', titulo: 'C172', idDoDetalhe: 'cat:C172' }, { id: 'SIM', titulo: 'Simulador' }],
      itens: [item('A', { grupo: 'C152', busca: ['A'] }), item('B', { grupo: 'C172', busca: ['B'] }), item('C', { busca: ['C'] })]
    });
    const vista = listaAVista(m, estadoNovo({ recolhidos: new Set(['C152']) }));
    assert.deepEqual(vista.blocos.map(b => [b.grupo && b.grupo.id, b.itens.map(i => i.id)]), [['C152', []], ['C172', ['B']], [null, ['C']]]);
    assert.deepEqual(vista.paradas, ['g:C152', 'g:C172', 'i:B', 'i:C']);
    assert.equal(vista.aVista, 3, 'o recolhido continua contado');
    const buscando = listaAVista(m, estadoNovo({ recolhidos: new Set(['C152']), busca: 'a' }));
    assert.deepEqual(buscando.blocos.map(b => [b.grupo && b.grupo.id, b.itens.map(i => i.id)]), [['C152', ['A']]]);
  });

  it('os estados vazios: sem itens, os filtros escondem todos, só inativos passariam, lendo, falhou', () => {
    assert.equal(listaAVista(modelo({ itens: [] }), estadoNovo()).vazio, 'sem-itens');
    assert.equal(listaAVista(modelo(), estadoNovo({ busca: 'ninguém' }), { filtrando: true }).vazio, 'filtros');
    const soInativo = listaAVista(modelo(), estadoNovo({ busca: 'aluno 1002' }), { filtrando: true });
    assert.equal(soInativo.vazio, 'filtros-inativos');
    assert.equal(soInativo.inativosQuePassam, 1);
    assert.equal(listaAVista(modelo({ itens: [item(1, { inativo: true })] }), estadoNovo()).vazio, 'inativos');
    assert.equal(listaAVista(modelo({ estado: 'lendo' }), estadoNovo()).vazio, 'lendo');
    assert.equal(listaAVista(modelo({ estado: 'falhou' }), estadoNovo()).vazio, 'falhou');
  });
});

describe('linhaHtml: uma linha', () => {
  const comControles = item(1000, {
    linha2: 'CANAC 123456 · PP', meta: '13/46', linha3: 'Fase 5', ponto: 'aviso', pontoRotulo: 'sem peso', bloco: '<span class="tira">06:30</span>',
    chave: { marcado: true, texto: 'Ativo', rotulo: 'Aluno 1000 ativo no cadastro', atributos: 'data-act="ativo" data-de="aluno"' },
    rapida: { marcado: false, texto: 'Vem', rotulo: 'Aluno 1000 vem em 20/11', atributos: 'data-f="on"' }
  });

  it('o li tem os atributos da tela e a chave; o botão que escolhe e os controles são irmãos (nada interativo dentro de outro)', () => {
    const html = linhaHtml('alu', comControles, { selecionado: true, parada: true });
    assert.match(html, /^<li class="lista-linha" data-chave="i:1000" data-k="s" data-id="1000">/);
    assert.match(html, /<button type="button" class="lista-botao" id="lin-alu-1000" data-item="1000" aria-current="true" tabindex="0">/);
    const botao = html.slice(html.indexOf('<button'), html.indexOf('</button>'));
    assert.doesNotMatch(botao.slice(1), /<button|<input|<select|<a /, 'nada interativo dentro do botão');
    assert.match(html, /<\/button><button type="button" class="lista-chave edit-only" role="switch" aria-checked="true" data-act="ativo" data-de="aluno" aria-label="Aluno 1000 ativo no cadastro" tabindex="0">Ativo<\/button>/);
    assert.match(html, /<label class="alvo lista-rapida edit-only"><input type="checkbox" class="sw" data-f="on" aria-label="Aluno 1000 vem em 20\/11" tabindex="0"> Vem<\/label>/);
  });

  it('as três linhas, o ponto (com o rótulo para o leitor de tela), o avatar e o bloco embaixo', () => {
    const html = linhaHtml('alu', comControles);
    assert.match(html, /<span class="lista-ponto aviso" title="sem peso" aria-hidden="true"><\/span>/);
    assert.match(html, /<span class="lista-avatar av1" aria-hidden="true">A1<\/span>/);
    assert.match(html, /<b class="lista-titulo">Aluno 1000<\/b>/);
    assert.match(html, /<span class="lista-l2"><span class="lista-l2-texto">CANAC 123456 · PP<\/span><small class="lista-meta">13\/46<\/small><\/span>/);
    assert.match(html, /<small class="lista-l3">Fase 5<\/small>/);
    assert.match(html, /<span class="sr">sem peso<\/span>/);
    assert.match(html, /<span class="lista-bloco"><span class="tira">06:30<\/span><\/span>/);
  });

  it('fora da parada, o botão e os controles saem do Tab (tabindex -1); sem escolha, sem aria-current', () => {
    const html = linhaHtml('alu', comControles);
    assert.match(html, /id="lin-alu-1000" data-item="1000" tabindex="-1"/);
    assert.doesNotMatch(html, /aria-current/);
    assert.doesNotMatch(html, /tabindex="0"/);
  });

  it('a ação fica no lugar da chave; sem chave, rápida e ação, nenhum controle', () => {
    const comAcao = linhaHtml('ped', item(7, { acao: { texto: 'Aprovar', rotulo: 'Aprovar o pedido de Aluno 7', atributos: 'data-act="aprovar"' }, chave: { marcado: true, texto: 'Ativo', rotulo: 'x', atributos: '' } }));
    assert.match(comAcao, /<button type="button" class="btn quiet lista-acao edit-only" data-act="aprovar" aria-label="Aprovar o pedido de Aluno 7" tabindex="-1">Aprovar<\/button>/);
    assert.doesNotMatch(comAcao, /lista-chave/);
    const nada = linhaHtml('alu', item(8));
    assert.equal((nada.match(/<button/g) || []).length, 1);
    assert.doesNotMatch(nada, /<input|lista-chave|lista-acao/);
  });

  it('inativo: o título discreto e a etiqueta "inativo"; apagado: só o título discreto', () => {
    assert.match(linhaHtml('alu', item(9, { inativo: true })), /^<li class="lista-linha inativo"[\s\S]*<span class="tag lista-inativo">inativo<\/span>/);
    const apagado = linhaHtml('alu', item(9, { apagado: true }));
    assert.match(apagado, /^<li class="lista-linha apagado"/);
    assert.doesNotMatch(apagado, />inativo</);
  });

  it('o texto vindo de fora é escapado; o avatar de um recurso é o ícone', () => {
    const html = linhaHtml('alu', item('<x>', { titulo: '<img src=x onerror=alert(1)>', linha2: '"&"' }));
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, /&quot;&amp;&quot;/);
    assert.match(linhaHtml('rec', item('PR-VOB', { icone: 'i-aviao' })), /<span class="lista-avatar av\d" aria-hidden="true"><svg class="ico" aria-hidden="true"><use href="#i-aviao"\/><\/svg><\/span>/);
  });
});

describe('grupoHtml: o cabeçalho de um grupo', () => {
  it('sem detalhe próprio: um botão só, que recolhe (aria-expanded)', () => {
    const html = grupoHtml('rec', { id: 'C152', titulo: 'C152', resumo: '12 de 13 disponíveis' }, { recolhido: true, parada: true });
    assert.match(html, /^<li class="lista-grupo recolhido" data-chave="g:C152">/);
    assert.match(html, /<button type="button" class="lista-botao lista-grupo-botao" id="grp-rec-C152" data-lista-grupo="C152" aria-expanded="false" tabindex="0">/);
    assert.match(html, /C152 <small>12 de 13 disponíveis<\/small>/);
  });

  it('com detalhe próprio: a seta recolhe (fora do Tab) e o título escolhe', () => {
    const html = grupoHtml('rec', { id: 'C172', titulo: 'C172', idDoDetalhe: 'cat:C172' }, { selecionado: true });
    assert.match(html, /<button type="button" class="lista-seta" id="grp-rec-C172" data-lista-grupo="C172" aria-expanded="true" aria-label="Recolher C172" tabindex="-1">/);
    assert.match(html, /<button type="button" class="lista-botao" id="lin-rec-cat:C172" data-item="cat:C172" aria-current="true" tabindex="-1">/);
  });
});

describe('vazioHtml e partesDaLista', () => {
  const textos = { nomes: NOMES, semItens: 'Nenhum aluno cadastrado.' };
  it('os cinco estados vazios', () => {
    assert.match(vazioHtml('alu', { vazio: 'sem-itens' }, textos), /<li class="lista-vazia" data-chave="vazio">Nenhum aluno cadastrado.<\/li>/);
    assert.match(vazioHtml('alu', { vazio: 'filtros' }, textos), /Nenhum aluno com esses filtros. <button type="button" class="btn quiet" id="limpar-filtros-alu" data-lista-limpar="alu">Limpar filtros<\/button>/);
    const inativos = vazioHtml('alu', { vazio: 'filtros-inativos', inativosQuePassam: 2 }, textos);
    assert.match(inativos, /Nenhum aluno ativo com esses filtros; 2 inativos passam\./);
    assert.match(inativos, /data-lista-inativos="alu">Mostrar inativos<\/button>/);
    assert.match(inativos, /id="limpar-filtros-alu"/);
    assert.match(vazioHtml('alu', { vazio: 'inativos', inativos: 1 }, textos), /Nenhum aluno ativo; 1 inativo\./);
    assert.match(vazioHtml('ped', { vazio: 'lendo' }, { ...textos, textoDoEstado: 'Lendo os pedidos…' }), /<li class="lista-vazia" data-chave="estado" role="status">Lendo os pedidos…<\/li>/);
    assert.match(vazioHtml('ped', { vazio: 'falhou' }, { ...textos, textoDoEstado: 'Não foi possível ler os pedidos.' }), /Não foi possível ler os pedidos. <button type="button" class="btn quiet" id="tentar-ped" data-lista-tentar="ped">Tentar de novo<\/button>/);
  });

  it('as partes: as chaves na ordem (fixos, grupos e itens, o vazio), uma só parada do Tab', () => {
    const m = modelo({ fixos: [item('hangar', { busca: [] })], grupos: [{ id: 'G', titulo: 'G' }], itens: [item(1, { grupo: 'G' }), item(2)] });
    const estado = estadoNovo({ selecionado: '2' });
    const vista = listaAVista(m, estado);
    const partes = partesDaLista('alu', vista, estado, textos);
    assert.deepEqual(partes.map(p => p.chave), ['f:hangar', 'g:G', 'i:1', 'i:2']);
    assert.equal(partes.map(p => p.html).join('').match(/tabindex="0"/g).length, 1);
    assert.match(partes[3].html, /id="lin-alu-2" data-item="2" aria-current="true" tabindex="0"/);
    const vazio = listaAVista(modelo({ itens: [] }), estadoNovo());
    assert.deepEqual(partesDaLista('alu', vazio, estadoNovo(), textos).map(p => p.chave), ['vazio']);
  });

  it('a parada: a última com foco, se está à vista; senão a escolhida; senão a primeira', () => {
    const vista = listaAVista(modelo(), estadoNovo());
    assert.equal(paradaDaLista(vista, estadoNovo({ parada: 'i:1001', selecionado: '1000' })), 'i:1001');
    assert.equal(paradaDaLista(vista, estadoNovo({ parada: 'i:999', selecionado: '1001' })), 'i:1001');
    assert.equal(paradaDaLista(vista, estadoNovo()), 'i:1000');
  });
});

describe('teclaNaLista e primeiraDaBusca', () => {
  const m = modelo({
    fixos: [item('fixo', { busca: [] })],
    grupos: [{ id: 'G', titulo: 'G' }, { id: 'H', titulo: 'H', idDoDetalhe: 'cat:H' }],
    itens: [item(1, { grupo: 'G' }), item(2, { grupo: 'H' }), item(3)]
  });
  const vista = listaAVista(m, estadoNovo({ recolhidos: new Set(['G']) }));

  it('↓ ↑ Home End andam pelas paradas desenhadas (os itens do grupo recolhido não), e escolhem', () => {
    assert.deepEqual(vista.paradas, ['f:fixo', 'g:G', 'g:H', 'i:2', 'i:3']);
    assert.deepEqual(teclaNaLista(vista, 'f:fixo', 'ArrowDown'), { ir: 'g:G', escolher: null });
    assert.deepEqual(teclaNaLista(vista, 'g:G', 'ArrowDown'), { ir: 'g:H', escolher: 'cat:H' });
    assert.deepEqual(teclaNaLista(vista, 'i:2', 'ArrowUp'), { ir: 'g:H', escolher: 'cat:H' });
    assert.deepEqual(teclaNaLista(vista, 'i:2', 'End'), { ir: 'i:3', escolher: '3' });
    assert.deepEqual(teclaNaLista(vista, 'i:3', 'Home'), { ir: 'f:fixo', escolher: 'fixo' });
    assert.equal(teclaNaLista(vista, 'i:3', 'ArrowDown'), null, 'no fim, nada');
    assert.equal(teclaNaLista(vista, 'f:fixo', 'ArrowUp'), null);
  });

  it('Enter e → vão ao detalhe; num grupo, ← recolhe e → abre o recolhido (o aberto com detalhe vai ao detalhe)', () => {
    assert.deepEqual(teclaNaLista(vista, 'i:3', 'Enter'), { detalhe: true });
    assert.deepEqual(teclaNaLista(vista, 'i:3', 'ArrowRight'), { detalhe: true });
    assert.deepEqual(teclaNaLista(vista, 'g:G', 'ArrowRight'), { grupo: 'G', recolher: false });
    assert.deepEqual(teclaNaLista(vista, 'g:H', 'ArrowLeft'), { grupo: 'H', recolher: true });
    assert.deepEqual(teclaNaLista(vista, 'g:H', 'ArrowRight'), { detalhe: true });
    assert.equal(teclaNaLista(vista, 'g:G', 'ArrowLeft'), null, 'o recolhido não recolhe de novo');
    assert.deepEqual(teclaNaLista(vista, 'g:G', 'Enter'), { grupo: 'G', recolher: false });
    assert.equal(teclaNaLista(vista, 'i:3', 'a'), null);
  });

  it('da busca: ↓ vai à primeira parada; com texto, ao primeiro item (sem os fixos e os cabeçalhos)', () => {
    assert.equal(primeiraDaBusca(vista, false), 'f:fixo');
    assert.equal(primeiraDaBusca(vista, true), 'i:2');
    assert.equal(primeiraDaBusca(listaAVista(modelo({ itens: [] }), estadoNovo()), true), null);
  });
});

describe('conciliar e vizinhoNaLista', () => {
  it('a escolha que saiu do modelo, ou se perdeu (a inclusão recusada), sai; a pedida (o endereço) entra quando o modelo a tem', () => {
    const m = modelo();
    assert.deepEqual(conciliar(estadoNovo({ selecionado: '1000' }), m), { selecionado: '1000', pedida: null, saiu: false });
    assert.deepEqual(conciliar(estadoNovo({ selecionado: '7' }), m), { selecionado: null, pedida: null, saiu: true });
    assert.deepEqual(conciliar(estadoNovo({ selecionado: '1001', perdidos: new Set(['1001']) }), m), { selecionado: null, pedida: null, saiu: true });
    assert.deepEqual(conciliar(estadoNovo({ selecionado: '1000', pedida: '1001' }), m), { selecionado: '1001', pedida: null, saiu: false });
    assert.deepEqual(conciliar(estadoNovo({ pedida: '5' }), m), { selecionado: null, pedida: '5', saiu: false });
    assert.deepEqual(conciliar(estadoNovo({ selecionado: 'cat:C172' }), modelo({ grupos: [{ id: 'C172', titulo: 'C172', idDoDetalhe: 'cat:C172' }] })),
      { selecionado: 'cat:C172', pedida: null, saiu: false });
  });

  it('o anterior e o próximo entre os desenhados (null nas pontas)', () => {
    const vista = listaAVista(modelo({ fixos: [item('f', { busca: [] })] }), estadoNovo());
    assert.equal(vizinhoNaLista(vista, '1000', 1), '1001');
    assert.equal(vizinhoNaLista(vista, '1000', -1), 'f');
    assert.equal(vizinhoNaLista(vista, 'f', -1), null);
    assert.equal(vizinhoNaLista(vista, '1001', 1), null);
    assert.equal(vizinhoNaLista(vista, '999', 1), null, 'quem não está à vista não tem vizinho');
  });

  it('a cor do avatar: cinco, pelo id (número ou texto)', () => {
    assert.equal(corDoAvatar(1000), 'av1');
    assert.equal(corDoAvatar(1004), 'av5');
    assert.equal(corDoAvatar(1005), 'av1');
    assert.match(corDoAvatar('PR-VOB'), /^av[1-5]$/);
    assert.equal(corDoAvatar('PR-VOB'), corDoAvatar('PR-VOB'));
  });
});
