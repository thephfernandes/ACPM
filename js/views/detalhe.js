// O controle do detalhe (js/detalhe.js monta; aqui, a página): o registro escolhido desenhado na região do detalhe
// (#det-<id>), as seções recolhidas (guardadas por lista enquanto a página está aberta), os erros dos campos (o valor
// recusado fica no campo, com a mensagem, até ser gravado, o Esc ou outro registro) e o estado vazio. O mesmo registro é
// redesenhado parte por parte (trocarPorChave); outro registro, inteiro (trocarConteudo)
import { trocarPorChave, trocarConteudo, anunciar } from '../dom.js';
import { partesDoDetalhe, detalheHtml, vazioDoDetalheHtml } from '../detalhe.js';
import { esc } from '../format.js';

// vazio: o texto com nada escolhido, ou { elemento: '<id>' } (um bloco fixo da página, mostrado com nada escolhido e nunca
// redesenhado: o formulário de um pedido novo). detalhe(id): o modelo do registro, ou null (saiu do cadastro); edita():
// quem edita vê os controles, quem só consulta, o texto
export function criarDetalhe({ id, nomes, rotulo, vazio = '', detalhe, edita }) {
  const erros = new Map();
  const recolhidas = new Set();
  let desenhado = null;
  let avisoSemEscolha = '';

  const regiao = () => document.getElementById(`det-${id}`);
  // O lugar do desenho, dentro da região: o bloco fixo do vazio, quando há, fica fora dele
  function lugar() {
    const r = regiao();
    if (!r) return null;
    let l = r.querySelector(':scope > .det-lugar');
    if (!l) {
      l = document.createElement('div');
      l.className = 'det-lugar';
      r.append(l);
    }
    return l;
  }
  const estatico = () => (vazio && typeof vazio === 'object' && vazio.elemento ? document.getElementById(vazio.elemento) : null);

  // Desenha o registro sel (ou o vazio). anterior e proximo: os vizinhos na lista ("Anterior", "Próximo"). Responde quantas
  // partes ficaram retidas
  function desenhar(sel, { momento = null, anterior = null, proximo = null, forcar = false } = {}) {
    const l = lugar();
    if (!l) return 0;
    const modelo = sel !== null && sel !== undefined ? detalhe(sel) : null;
    const fixo = estatico();
    if (!modelo) {
      if (fixo) fixo.hidden = false;
      const texto = typeof vazio === 'string' ? vazio : '';
      const html = (avisoSemEscolha ? `<p class="det-aviso" role="status">${esc(avisoSemEscolha)}</p>` : '') + (fixo || !texto ? '' : vazioDoDetalheHtml(texto));
      if (desenhado !== null || l.innerHTML !== html) trocarConteudo(l, html);
      desenhado = null;
      erros.clear();
      return 0;
    }
    if (fixo) fixo.hidden = true;
    if (momento === 'consulta') erros.clear();
    const opcoes = { edita: edita(), erros, recolhidas, nomes, rotulo, anterior, proximo };
    const atual = l.firstElementChild;
    if (momento !== 'consulta' && desenhado === String(sel) && atual && atual.matches('.det')) {
      return trocarPorChave(atual, partesDoDetalhe(id, modelo, opcoes), { reter: !forcar }).retidas;
    }
    trocarConteudo(l, detalheHtml(id, modelo, opcoes));
    desenhado = String(sel);
    return 0;
  }

  // O id do campo do detalhe a partir do controle (det-<id>-<campo>)
  const campoDe = el => (el && el.id && el.id.startsWith(`det-${id}-`) ? el.id.slice(`det-${id}-`.length) : null);

  return {
    desenhar, campoDe, regiao,
    desenhado: () => desenhado,
    // Outro registro escolhido: os erros e o aviso do vazio saem
    trocouDeRegistro() {
      erros.clear();
      avisoSemEscolha = '';
    },
    // O aviso que fica no lugar do detalhe enquanto nada é escolhido ("Este aluno saiu do cadastro.")
    avisarSemEscolha(texto) {
      avisoSemEscolha = texto;
    },
    alternarSecao(secao) {
      if (recolhidas.has(secao)) recolhidas.delete(secao);
      else recolhidas.add(secao);
    },
    // Um valor recusado: fica no campo, com a mensagem (e é dito ao leitor de tela)
    erroNoCampo(campo, texto) {
      const el = document.getElementById(`det-${id}-${campo}`);
      erros.set(campo, { digitado: el ? el.value : '', texto });
      anunciar(texto);
    },
    temErro: campo => erros.has(campo),
    limparErro: campo => erros.delete(campo),
    focarNoTitulo() {
      const titulo = document.getElementById(`det-${id}-titulo`);
      if (titulo) titulo.focus();
      return Boolean(titulo);
    }
  };
}
