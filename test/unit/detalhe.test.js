// O componente de lista e detalhe, a parte do detalhe (js/detalhe.js, puro): cada campo "Rótulo: valor" (o controle para
// quem edita, o texto para quem só consulta, o erro desenhado com o que foi digitado), as seções (recolhidas, com o
// escopo), o cabeçalho com "Anterior" e "Próximo", o rodapé e as partes que js/dom.js troca por chave
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { campoHtml, secaoHtml, cabecalhoHtml, partesDoDetalhe, detalheHtml, vazioDoDetalheHtml } from '../../js/detalhe.js';

const PESO = { id: 'kg', rotulo: 'Peso (kg)', tipo: 'numero', valor: 82, texto: '82 kg', atributos: 'data-f="kg" min="1" max="300"' };
const MODELO = {
  atributos: 'data-k="s" data-id="1000"', id: 1000, titulo: 'Aluno 1000', subtitulo: 'CANAC 123456 · PP', aviso: '',
  secoes: [
    { id: 'cadastro', titulo: 'Cadastro', icone: 'i-conta', escopo: 'todas as datas', campos: [PESO] },
    { id: 'dados', titulo: 'Dados pessoais', escopo: 'todas as datas', campos: [], html: '<div data-pessoa="aluno:1000"></div>' }
  ],
  rodape: [{ id: 'excluir', texto: 'Excluir aluno…', rotulo: 'Excluir Aluno 1000', atributos: 'data-act="dels"', soEdicao: true }]
};
const OPCOES = { nomes: ['aluno', 'alunos'], rotulo: 'Alunos', anterior: '999', proximo: null };

describe('campoHtml: um campo "Rótulo: valor"', () => {
  it('o número: o rótulo ligado ao campo, os atributos da tela, o erro descrito pelo campo', () => {
    const html = campoHtml('alu', PESO);
    assert.match(html, /^<div class="det-campo" data-campo="kg"><span class="det-rotulo"><label for="det-alu-kg">Peso \(kg\)<\/label><\/span>/);
    assert.match(html, /<input id="det-alu-kg" type="number" value="82" data-f="kg" min="1" max="300" aria-describedby="det-alu-kg-erro">/);
    assert.match(html, /<small class="erro-campo" id="det-alu-kg-erro"><\/small>/);
  });

  it('quem só consulta lê o texto, sem controle', () => {
    const html = campoHtml('alu', PESO, { edita: false });
    assert.doesNotMatch(html, /<input|<select|<label/);
    assert.match(html, /<span class="det-rotulo" id="det-alu-kg-rotulo">Peso \(kg\)<\/span><div class="det-valor" aria-labelledby="det-alu-kg-rotulo">82 kg<\/div>/);
  });

  it('o erro fica no campo com o que foi digitado, aria-invalid e a mensagem; nada é escrito sem escapar', () => {
    const html = campoHtml('alu', PESO, { erro: { digitado: '400"><b>', texto: 'O peso vai de 1 a 300 kg.' } });
    assert.match(html, /value="400&quot;&gt;&lt;b&gt;"/);
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /<small class="erro-campo" id="det-alu-kg-erro">O peso vai de 1 a 300 kg.<\/small>/);
  });

  it('o texto, a data, o telefone e o e-mail; a falta (sem peso) marca o campo', () => {
    assert.match(campoHtml('alu', { id: 'nm', rotulo: 'Nome', tipo: 'texto', valor: 'Ana <x>', atributos: 'data-f="nm"' }), /<input id="det-alu-nm" type="text" value="Ana &lt;x&gt;" data-f="nm"/);
    assert.match(campoHtml('alu', { id: 'n', rotulo: 'Nascimento', tipo: 'data', valor: '2000-01-02' }), /type="date" value="2000-01-02"/);
    assert.match(campoHtml('alu', { id: 't', rotulo: 'Celular', tipo: 'tel', valor: '' }), /type="tel" value=""/);
    assert.match(campoHtml('alu', { id: 'e', rotulo: 'E-mail', tipo: 'email', valor: '' }), /type="email"/);
    assert.match(campoHtml('alu', { ...PESO, valor: '', falta: true }), /class="falta"/);
  });

  it('a seleção, com a opção escolhida; a dica ao lado do rótulo, fora do label', () => {
    const html = campoHtml('alu', { id: 'curso', rotulo: 'Curso', tipo: 'selecao', valor: 'PP', opcoes: [['', '—'], ['PP', 'PP · Piloto Privado']], atributos: 'data-f="curso"', dica: ['progresso', 'O que é o progresso?'] });
    assert.match(html, /<select id="det-alu-curso" data-f="curso" aria-describedby="det-alu-curso-erro"><option value="">—<\/option><option value="PP" selected>PP · Piloto Privado<\/option><\/select>/);
    assert.match(html, /<\/label><button type="button" class="dica-btn" data-dica="progresso" aria-label="O que é o progresso\?" aria-expanded="false"><\/button><\/span>/);
    assert.match(campoHtml('alu', { id: 'curso', rotulo: 'Curso', tipo: 'selecao', valor: 'PP', texto: 'PP · Piloto Privado', opcoes: [] }, { edita: false }), />PP · Piloto Privado<\/div>/);
  });

  it('as etiquetas: cada uma com o ✕ (o nome dele) e a lista que acrescenta; só consulta: as etiquetas, ou "—"', () => {
    const campo = {
      id: 'voaCom', rotulo: 'Priorizar com', tipo: 'etiquetas', classe: 'voa-com',
      itens: [{ texto: 'Instrutor 01', rotulo: 'Tirar Instrutor 01 de Priorizar com', atributos: 'data-act="unvc" data-b="1"', classe: 'par' }],
      acrescentar: { atributos: 'data-f="voaCom"', vazio: 'Priorizar com…', opcoes: [['2', 'Instrutor 02']] }
    };
    const html = campoHtml('alu', campo);
    assert.match(html, /<div class="bl det-etiquetas voa-com"><span class="tg par">Instrutor 01<button type="button" class="edit-only" data-act="unvc" data-b="1" aria-label="Tirar Instrutor 01 de Priorizar com">✕<\/button><\/span>/);
    assert.match(html, /<select id="det-alu-voaCom" class="edit-only" data-f="voaCom"[^>]*><option value="">Priorizar com…<\/option><option value="2">Instrutor 02<\/option><\/select>/);
    assert.match(campoHtml('alu', campo, { edita: false }), /<span class="tg par">Instrutor 01<\/span>/);
    assert.doesNotMatch(campoHtml('alu', campo, { edita: false }), /<button|<select/);
    assert.match(campoHtml('alu', { ...campo, itens: [] }, { edita: false }), />—<\/div>/);
  });

  it('o html da tela vai como está; leitura é texto', () => {
    assert.match(campoHtml('alu', { id: 'faixas', tipo: 'html', html: '<div class="grade"></div>' }), /<div class="det-campo det-campo-html" data-campo="faixas"><div class="grade"><\/div><\/div>/);
    assert.match(campoHtml('alu', { id: 'p', rotulo: 'Progresso', tipo: 'leitura', texto: '13/46' }), /<div class="det-valor" aria-labelledby="det-alu-p-rotulo">13\/46<\/div>/);
  });
});

describe('secaoHtml: uma seção', () => {
  it('o botão diz se está aberta e o que controla; o corpo é o grupo dela; o escopo ao lado do título', () => {
    const html = secaoHtml('alu', MODELO.secoes[0]);
    assert.match(html, /^<div class="det-secao-bloco" data-chave="s:cadastro"><h4 class="det-secao"><button type="button" class="det-secao-btn" id="sec-alu-cadastro" data-secao="cadastro" aria-expanded="true" aria-controls="sec-alu-cadastro-corpo">/);
    assert.match(html, /<use href="#i-conta"\/><\/svg>Cadastro <small class="det-escopo">todas as datas<\/small>/);
    assert.match(html, /<div class="det-secao-corpo" id="sec-alu-cadastro-corpo" role="group" aria-labelledby="sec-alu-cadastro">/);
    assert.match(html, /id="det-alu-kg"/);
  });

  it('recolhida: aria-expanded false e o corpo escondido; o erro de um campo vem de erros', () => {
    assert.match(secaoHtml('alu', MODELO.secoes[0], { recolhida: true }), /aria-expanded="false"[\s\S]*id="sec-alu-cadastro-corpo" role="group" aria-labelledby="sec-alu-cadastro" hidden>/);
    const comErro = secaoHtml('alu', MODELO.secoes[0], { erros: new Map([['kg', { digitado: '0', texto: 'O peso vai de 1 a 300 kg.' }]]) });
    assert.match(comErro, /value="0"[^>]*aria-invalid="true"/);
  });
});

describe('o cabeçalho, as partes e o detalhe', () => {
  it('o cabeçalho: a volta para a lista, o avatar, o título que recebe o foco e "Anterior" e "Próximo" com nome (o da ponta desligado)', () => {
    const html = cabecalhoHtml('alu', MODELO, OPCOES);
    assert.match(html, /<a class="btn quiet voltar md-voltar" id="det-alu-voltar" href="#\/alu" data-lista-voltar="alu">‹ Alunos<\/a>/);
    assert.match(html, /<span class="lista-avatar grande av1" aria-hidden="true">A1<\/span>/);
    assert.match(html, /<h3 class="det-titulo" id="det-alu-titulo" tabindex="-1">Aluno 1000<\/h3><p class="det-sub">CANAC 123456 · PP<\/p>/);
    assert.match(html, /<button type="button" class="det-acao" id="det-alu-anterior" data-lista-anterior="alu" aria-label="Aluno anterior" title="Anterior \(Ctrl\+,\)" aria-keyshortcuts="Control\+Comma">/);
    assert.match(html, /<button type="button" class="det-acao" id="det-alu-proximo" data-lista-proximo="alu" aria-label="Próximo aluno" title="Próximo \(Ctrl\+\.\)" aria-keyshortcuts="Control\+Period" aria-disabled="true">/);
  });

  it('as partes: cab, aviso, uma por seção, rodapé; o rodapé só de edição some para quem só consulta', () => {
    const partes = partesDoDetalhe('alu', MODELO, OPCOES);
    assert.deepEqual(partes.map(p => p.chave), ['cab', 'aviso', 's:cadastro', 's:dados', 'rodape']);
    for (const p of partes) assert.match(p.html, new RegExp(`^<[a-z0-9]+ [^>]*data-chave="${p.chave}"`));
    assert.match(partes[4].html, /<button type="button" class="btn quiet edit-only" id="det-alu-excluir" data-act="dels" aria-label="Excluir Aluno 1000">Excluir aluno…<\/button>/);
    assert.doesNotMatch(partesDoDetalhe('alu', MODELO, { ...OPCOES, edita: false })[4].html, /Excluir/);
    assert.match(partes[1].html, /<p class="det-aviso" id="det-alu-aviso" role="status" data-chave="aviso" hidden><\/p>/);
    assert.match(partesDoDetalhe('alu', { ...MODELO, aviso: 'Inativo no cadastro.' }, OPCOES)[1].html, /data-chave="aviso">Inativo no cadastro.<\/p>/);
  });

  it('o detalhe inteiro tem os atributos da tela (registro.js acha o aluno); sem nada escolhido, o texto', () => {
    assert.match(detalheHtml('alu', MODELO, OPCOES), /^<div class="det" data-k="s" data-id="1000">/);
    assert.equal(vazioDoDetalheHtml('Escolha um aluno na lista.'), '<p class="det-vazio h">Escolha um aluno na lista.</p>');
  });
});
