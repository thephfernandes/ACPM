// O controle da lista (js/lista.js monta; aqui, o estado na memória e a página): a busca, os filtros de vários valores
// (criados no primeiro desenho que acha a lista), "Mostrar inativos", "Limpar filtros", a contagem, os grupos recolhidos e a
// parada do Tab. Cada desenho troca só as linhas que mudaram (trocarPorChave). Quem escolhe, abre o detalhe e mexe no
// endereço é js/views/mestre-detalhe.js, pelo aoMudarFiltro e pelos métodos devolvidos
import { $, trocarPorChave, trocarConteudo } from '../dom.js';
import { chaveDeBusca, esc } from '../format.js';
import { listaAVista, textoDaContagem, partesDaLista, conciliar } from '../lista.js';

// Na digitação, a contagem espera a pessoa parar (o leitor de tela não a dita a cada letra)
const ESPERA_DA_CONTAGEM = 500;
// Uma parte retida (um botão armado, um campo com texto digitado) é desenhada de novo depois
const ESPERA_DA_RETIDA = 600;

// id: o da ul (ul#<id>[data-lista="<id>"]), que também dá os ids da barra: [data-flt="<id>"] (a busca), #<id>-contagem,
// #<id>-inativos. nomes: ['aluno', 'alunos']; semItens: o texto da lista sem nenhum item; chaveDaBusca: como a busca
// compara (sem acentos; em Recursos, a matrícula sem o hífen); filtros: [{ criar(aoMudar), valores(item) }]; modelo(): o
// modelo de agora (js/lista.js), que pode trazer o aviso da lista ({ texto, abrir: id }), o estado da leitura ('lendo',
// 'falhou', com textoDoEstado e tentar())
export function criarLista({ id, nomes, semItens = '', chaveDaBusca = chaveDeBusca, filtros = [], modelo, redesenhar }) {
  const estado = {
    busca: '', comInativos: false, recolhidos: new Set(), mantidos: new Set(), vistos: new Set(), selecionado: null,
    parada: null, pedida: null, naoConfirmados: new Map(), perdidos: new Set()
  };
  let criados = null;
  let vista = null;
  let ultimoModelo = null;
  let esperaDaContagem = null;
  let esperaDaRetida = null;

  const lugar = () => document.getElementById(id);
  const busca = () => document.querySelector(`[data-flt="${id}"]`);

  // Os filtros de vários valores: criados uma vez, no primeiro desenho que acha a lista (a página já tem os botões)
  function criarFiltros() {
    if (criados) return;
    criados = filtros.map(f => ({ filtro: f.criar(() => filtroMudou()), valores: f.valores }));
  }
  const filtrando = () => Boolean(criados && criados.some(({ filtro }) => filtro.valores().length > 0));
  function passa(item) {
    if (!criados) return true;
    return criados.every(({ filtro, valores }) => filtro.quemPassa()(valores(item)));
  }

  // Um filtro mudou (a busca, as marcas, "Mostrar inativos", "Limpar filtros"): vale para todas as linhas, também as que
  // ficavam à vista (as vistas no último desenho e as mantidas)
  function filtroMudou({ esperar = 0 } = {}) {
    estado.vistos.clear();
    estado.mantidos.clear();
    redesenhar({ esperarContagem: esperar });
  }

  function escreverContagem(texto, esperar) {
    clearTimeout(esperaDaContagem);
    const escrever = () => {
      const el = $(`#${id}-contagem`);
      if (el && el.textContent !== texto) el.textContent = texto;
    };
    if (esperar) esperaDaContagem = setTimeout(escrever, esperar);
    else escrever();
  }

  function desenharInativos() {
    const botao = $(`#${id}-inativos`);
    if (!botao || !vista) return;
    botao.hidden = !vista.inativos && !estado.comInativos;
    botao.setAttribute('aria-pressed', String(estado.comInativos));
    const texto = vista.inativos ? `Mostrar inativos (${vista.inativos})` : 'Mostrar inativos';
    if (botao.textContent !== texto) botao.textContent = texto;
  }

  // O aviso da lista (#<id>-aviso): o que o modelo diz sobre um registro que não está aberto (os dados pessoais que não
  // foram salvos), com "Abrir"
  function desenharAviso() {
    const lugarDoAviso = $(`#${id}-aviso`);
    if (!lugarDoAviso) return;
    const aviso = ultimoModelo && ultimoModelo.aviso;
    const html = aviso ? `${esc(aviso.texto)}${aviso.abrir !== undefined && aviso.abrir !== null
      ? ` <button type="button" class="btn quiet" id="${id}-aviso-abrir" data-lista-abrir="${id}" data-item="${esc(aviso.abrir)}">Abrir</button>` : ''}` : '';
    lugarDoAviso.hidden = !aviso;
    if (lugarDoAviso.innerHTML !== html) trocarConteudo(lugarDoAviso, html);
  }

  // Desenha a lista. Responde se a escolha saiu do modelo (saiu) e quantas partes ficaram retidas
  function desenhar({ momento = null, esperarContagem = 0 } = {}) {
    const ul = lugar();
    if (!ul) return { desenhou: false, saiu: false };
    criarFiltros();
    for (const { filtro } of criados) filtro.desenhar();
    ultimoModelo = modelo();
    const conciliada = conciliar(estado, ultimoModelo);
    estado.selecionado = conciliada.selecionado;
    estado.pedida = conciliada.pedida;
    vista = listaAVista(ultimoModelo, estado, { chave: chaveDaBusca, passa, filtrando: filtrando() });
    const textos = { nomes, semItens, textoDoEstado: ultimoModelo.textoDoEstado || '' };
    const partes = partesDaLista(id, vista, estado, textos);
    let retidas = 0;
    // Quem só consulta e o conflito: a lista volta ao que está gravado, inteira (o que estava digitado não fica)
    if (momento === 'consulta') trocarConteudo(ul, partes.map(p => p.html).join(''));
    else ({ retidas } = trocarPorChave(ul, partes));
    estado.vistos = new Set(vista.ids);
    for (const m of [...estado.mantidos]) if (!vista.ids.has(m)) estado.mantidos.delete(m);
    escreverContagem(textoDaContagem(vista, nomes), esperarContagem);
    desenharInativos();
    desenharAviso();
    clearTimeout(esperaDaRetida);
    if (retidas) esperaDaRetida = setTimeout(() => redesenhar(), ESPERA_DA_RETIDA);
    return { desenhou: true, saiu: conciliada.saiu };
  }

  // A busca: filtra na hora; só a contagem espera
  function buscar(texto) {
    estado.busca = texto;
    filtroMudou({ esperar: ESPERA_DA_CONTAGEM });
  }

  function alternarInativos() {
    estado.comInativos = !estado.comInativos;
    filtroMudou();
  }

  // "Limpar filtros": a busca e as marcas vazias; o foco vai para a busca
  function limpar() {
    estado.busca = '';
    const campo = busca();
    if (campo) campo.value = '';
    if (criados) for (const { filtro } of criados) filtro.limpar();
    filtroMudou();
    if (campo) campo.focus();
  }

  function alternarGrupo(grupo, recolher = !estado.recolhidos.has(grupo)) {
    if (recolher) estado.recolhidos.add(grupo);
    else estado.recolhidos.delete(grupo);
    redesenhar();
  }

  // O botão da linha de um id escolhível (o item, o fixo, o cabeçalho com detalhe)
  const botaoDe = idItem => {
    const ul = lugar();
    return ul && idItem !== null && idItem !== undefined ? ul.querySelector(`.lista-botao[data-item="${CSS.escape(String(idItem))}"]`) : null;
  };
  const chaveDe = idItem => (vista ? (vista.registros.find(r => r.id === String(idItem)) || {}).chave ?? null : null);
  const botaoDaParada = chave => {
    const li = lugar() && lugar().querySelector(`:scope > [data-chave="${CSS.escape(chave)}"]`);
    return li ? li.querySelector('.lista-botao') : null;
  };

  return {
    estado, desenhar, buscar, alternarInativos, limpar, alternarGrupo, filtroMudou, botaoDe, chaveDe, botaoDaParada,
    vista: () => vista,
    // A busca, para a tela que a lê ao abrir (o navegador pode ter devolvido o texto de antes de recarregar)
    sincronizarBusca() {
      const campo = busca();
      if (campo && campo.value !== estado.busca) campo.value = estado.busca;
    }
  };
}
