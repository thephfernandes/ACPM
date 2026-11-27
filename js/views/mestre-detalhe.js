// O componente de lista e detalhe: a lista à esquerda (js/views/lista.js) e o registro escolhido à direita
// (js/views/detalhe.js), como um cliente de e-mail. Daqui saem a escolha (um clique, as setas, o endereço), o detalhe numa
// vista só (abaixo de 800 px: a lista, depois o detalhe, e Voltar devolve a lista), "Anterior" e "Próximo" (também
// Ctrl+, e Ctrl+.), o Esc, o registro novo que espera a gravação e o desenho que espera o clique acabar. O endereço é da
// casca (js/views/telas.js): o registro escolhido fica nele (#/alu/1000), e o componente nunca mexe no histórico sozinho.
// criarMestreDetalhe só registra: os ouvintes ficam no documento, para os elementos da lista dele (data-lista, #det-<id>),
// e nenhum elemento é lido antes do primeiro desenho
import { algumDialogoAberto, gavetaDoEsc, ponteiroApertado, depoisDoClique, anunciar } from '../dom.js';
import { vizinhoNaLista, teclaNaLista, primeiraDaBusca } from '../lista.js';
import { criarLista } from './lista.js';
import { criarDetalhe } from './detalhe.js';
import { itemNoEndereco, telaAberta } from './telas.js';

// Uma vista só: abaixo de 800 px de largura da janela (a moldura de altura fixa começa nos mesmos 800 px)
const umaVista = () => typeof matchMedia === 'function' && matchMedia('(max-width: 799px)').matches;
// O endereço da escolha espera as setas pararem
const ESPERA_DO_ENDERECO = 300;

// opcoes: { id ('alu': ul#alu, #det-alu, section#s-alu), rotulo ('Alunos'), nomes (['aluno', 'alunos']), semItens, vazio
//   (o texto com nada escolhido, ou { elemento }), chaveDaBusca, filtros, modelo(), detalhe(id), edita(), secao (a seção
//   da tela, quando não é s-<id>) }
export function criarMestreDetalhe(opcoes) {
  const { id, rotulo, nomes, secao = `s-${id}` } = opcoes;
  const [um] = nomes;
  let adiado = false;
  let esperaDoEndereco = null;

  const lista = criarLista({ ...opcoes, redesenhar: desenhar });
  const estado = lista.estado;
  const detalhe = criarDetalhe({ id, nomes, rotulo, vazio: opcoes.vazio, detalhe: opcoes.detalhe, edita: opcoes.edita || (() => true) });
  const elSecao = () => document.getElementById(secao);
  const aberta = () => telaAberta() === id;
  let esperaDaRetida = null;

  // data-vendo="ambos" é da tela (as duas regiões em sequência, no celular): o componente nunca o troca, e com ele a tela
  // se comporta como com duas vistas (o detalhe não abre por cima da lista, e o Esc volta à linha)
  const ambos = () => { const s = elSecao(); return Boolean(s && s.dataset.vendo === 'ambos'); };
  const vistaUnica = () => umaVista() && !ambos();
  function mudarVista(vendo) {
    const s = elSecao();
    if (s && s.dataset.vendo !== 'ambos') s.dataset.vendo = vendo;
  }
  const vendoODetalhe = () => { const s = elSecao(); return Boolean(s && s.dataset.vendo === 'detalhe'); };
  // O foco que se perdeu: no body, ou num elemento que saiu da vista (a região escondida, a tela de antes)
  const focoPerdido = () => {
    const ativo = document.activeElement;
    return !ativo || ativo === document.body || !ativo.getClientRects().length;
  };
  // A entrada que abriu o detalhe numa vista só sai do histórico (Voltar; a casca refaz a lista), em vez de ficar uma
  // entrada morta com o mesmo endereço; sem ela, a entrada atual fica só com a tela
  function sairDaEntradaDoDetalhe() {
    if (vistaUnica() && aberta() && window.history.state && window.history.state.detalhe === id) window.history.back();
    else if (aberta()) enderecar(null);
  }

  // O endereço do registro: o novo que o servidor ainda não confirmou é "novo" (o id dele pode ser o de outra pessoa)
  const noEndereco = sel => (sel === null || sel === undefined ? null : estado.naoConfirmados.has(sel) ? 'novo' : sel);
  function enderecar(sel, { empilhar = false } = {}) {
    clearTimeout(esperaDoEndereco);
    if (aberta()) itemNoEndereco(id, noEndereco(sel), { empilhar, detalhe: empilhar ? id : null });
  }

  // Desenha a lista e o detalhe. Com o botão do mouse apertado (um campo digitado avisa a mudança no mousedown do clique
  // que tira o foco dele), espera o clique acabar: o que está sendo clicado não sai da tela
  function desenhar(momento = null) {
    const opcoesDoDesenho = momento && typeof momento === 'object' ? momento : { momento };
    if (ponteiroApertado() && opcoesDoDesenho.momento !== 'consulta') {
      if (!adiado) {
        adiado = true;
        depoisDoClique(() => { adiado = false; desenhar(); });
      }
      return;
    }
    const regiao = detalhe.regiao();
    const focoNoDetalhe = Boolean(regiao && regiao.contains(document.activeElement));
    const { desenhou, saiu } = lista.desenhar(opcoesDoDesenho);
    if (!desenhou) return;
    if (saiu) {
      detalhe.trocouDeRegistro();
      detalhe.avisarSemEscolha(`Este ${um} saiu do cadastro.`);
      anunciar(`Este ${um} saiu do cadastro.`);
      const naVistaDoDetalhe = vistaUnica() && vendoODetalhe();
      if (naVistaDoDetalhe) { mudarVista('lista'); sairDaEntradaDoDetalhe(); } else if (aberta()) enderecar(null);
    }
    const vista = lista.vista();
    const retidas = detalhe.desenhar(estado.selecionado, {
      momento: opcoesDoDesenho.momento,
      forcar: Boolean(opcoesDoDesenho.forcar),
      anterior: vizinhoNaLista(vista, estado.selecionado, -1),
      proximo: vizinhoNaLista(vista, estado.selecionado, 1)
    });
    // O registro saiu com o foco no detalhe: o foco vai para a região dele (que diz por quê); numa vista só, para a lista
    if (saiu && focoNoDetalhe && focoPerdido()) focarDepoisDeSair();
    // Uma espera só: o desenho seguinte refaz o que ficou retido (cada desenho não começa outra)
    clearTimeout(esperaDaRetida);
    esperaDaRetida = retidas ? setTimeout(() => { esperaDaRetida = null; desenhar(); }, 600) : null;
  }

  // O foco depois de o registro aberto sair (do cadastro, ou a inclusão recusada): a região do detalhe, à vista; senão a
  // parada da lista
  function focarDepoisDeSair() {
    const r = detalhe.regiao();
    if (r && r.getClientRects().length) { r.focus(); return; }
    const vista = lista.vista();
    const parada = vista && vista.paradas.length ? (estado.parada && vista.paradas.includes(estado.parada) ? estado.parada : vista.paradas[0]) : null;
    const botao = parada && lista.botaoDaParada(parada);
    if (botao) botao.focus();
  }

  // A vista do detalhe (numa vista só): a entrada nova no histórico (Voltar devolve a lista), o topo, o foco no título
  function abrirDetalhe({ empilhar = true } = {}) {
    if (empilhar) enderecar(estado.selecionado, { empilhar: true });
    mudarVista('detalhe');
    window.scrollTo(0, 0);
    // Com nada escolhido (o vazio fixo: o formulário de um item novo), o foco vai para a região
    if (!detalhe.focarNoTitulo()) { const r = detalhe.regiao(); if (r) r.focus(); }
  }

  // A lista de volta (numa vista só), com o foco na linha escolhida
  function voltarParaALista({ focar = true } = {}) {
    mudarVista('lista');
    const botao = lista.botaoDe(estado.selecionado);
    if (focar && botao) {
      botao.focus({ preventScroll: true });
      botao.scrollIntoView({ block: 'nearest' });
    }
  }

  // Escolhe um registro (null: nenhum). origem: 'clique', 'teclas' (as setas: o endereço espera elas pararem),
  // 'vizinho' ("Anterior", "Próximo"), 'endereco' (a casca: não mexe no endereço), 'novo'
  function escolher(sel, { abrir = false, origem = 'clique' } = {}) {
    const novo = sel === null || sel === undefined ? null : String(sel);
    // Escolhido de novo (também pelo endereço), o id de uma inclusão recusada vale outra vez: é o registro de quem o
    // gravou (o endereço nunca levou o id recusado: até a confirmação ele é "novo")
    if (novo !== null) estado.perdidos.delete(novo);
    if (estado.selecionado !== novo) detalhe.trocouDeRegistro();
    detalhe.avisarSemEscolha('');
    // Do endereço, o registro é pedido: vira a escolha no primeiro desenho cujo modelo o tem (os dados podem não ter
    // chegado); os outros escolhem na hora
    if (origem === 'endereco' && novo !== null) estado.pedida = novo;
    else { estado.selecionado = novo; estado.pedida = null; }
    // A parada do Tab vai para a escolhida (a que a lista ainda não tem, um registro novo: a da escolha, no desenho)
    estado.parada = novo !== null ? lista.chaveDe(novo) : estado.parada;
    desenhar();
    // Numa vista só, o detalhe abre; com nada escolhido, o vazio dele (o bloco fixo: o formulário de um item novo), numa
    // entrada nova do histórico (Voltar devolve a lista)
    if (abrir && vistaUnica()) {
      if (novo === null) { enderecar(null, { empilhar: true }); abrirDetalhe({ empilhar: false }); return; }
      abrirDetalhe({ empilhar: origem !== 'endereco' });
      return;
    }
    if (origem === 'endereco') return;
    if (origem === 'teclas') {
      clearTimeout(esperaDoEndereco);
      esperaDoEndereco = setTimeout(() => enderecar(estado.selecionado), ESPERA_DO_ENDERECO);
    } else enderecar(novo);
  }

  // O vizinho do escolhido ("Anterior": -1, "Próximo": 1). De um campo, o campo é gravado antes (o blur faz o change) e o
  // foco vai para o mesmo campo do vizinho
  function irAoVizinho(passo, { campo = null } = {}) {
    const vizinho = vizinhoNaLista(lista.vista(), estado.selecionado, passo);
    if (vizinho === null) return false;
    // O elemento do foco: o campo, ou o botão ("Anterior", "Próximo"), que o detalhe do vizinho também tem
    const ativo = campo || document.activeElement;
    const seletor = ativo && ativo.id && detalhe.regiao() && detalhe.regiao().contains(ativo) ? `#${CSS.escape(ativo.id)}` : null;
    if (campo && campo.matches('input, select, textarea')) campo.blur();
    escolher(vizinho, { origem: 'vizinho' });
    const mesmo = seletor && document.querySelector(seletor);
    if (mesmo) {
      mesmo.focus();
      if (campo && mesmo.select && mesmo.matches('input:not([type="checkbox"])')) mesmo.select();
    } else if (campo) detalhe.focarNoTitulo();
    return true;
  }

  // ——— Os ouvintes, no documento ———
  const naLista = el => el instanceof Element && el.closest(`ul[data-lista="${id}"]`);
  const noDetalhe = el => el instanceof Element && el.closest(`#det-${id}`);

  document.addEventListener('input', e => {
    if (e.target instanceof Element && e.target.matches(`[data-flt="${id}"]`)) lista.buscar(e.target.value);
  });

  document.addEventListener('click', e => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest(`#${id}-inativos`)) { lista.alternarInativos(); return; }
    // "Mostrar inativos" do vazio sai da lista com o redesenho: o foco vai para a primeira linha que apareceu (sem
    // nenhuma, para a busca)
    if (e.target.closest(`[data-lista-inativos="${id}"]`)) {
      lista.alternarInativos();
      const vista = lista.vista();
      const parada = vista && (primeiraDaBusca(vista, Boolean(estado.busca.trim())) || vista.paradas[0]);
      if (parada) { estado.parada = parada; desenhar(); }
      const destino = (parada && lista.botaoDaParada(parada)) || document.querySelector(`[data-flt="${id}"]`);
      if (destino) destino.focus();
      return;
    }
    if (e.target.closest(`[data-lista-limpar="${id}"]`)) { lista.limpar(); return; }
    if (e.target.closest(`[data-lista-tentar="${id}"]`)) { const m = opcoes.modelo(); if (m && m.tentar) m.tentar(); return; }
    const abrirDoAviso = e.target.closest(`[data-lista-abrir="${id}"]`);
    if (abrirDoAviso) { escolher(abrirDoAviso.dataset.item, { abrir: true }); detalhe.focarNoTitulo(); return; }
    const ul = naLista(e.target);
    if (ul) {
      const grupo = e.target.closest('[data-lista-grupo]');
      if (grupo) { lista.alternarGrupo(grupo.dataset.listaGrupo); return; }
      const botao = e.target.closest('.lista-botao[data-item]');
      if (botao) escolher(botao.dataset.item, { abrir: true });
      return;
    }
    const det = noDetalhe(e.target);
    if (!det) return;
    const secaoBtn = e.target.closest('.det-secao-btn[data-secao]');
    if (secaoBtn) { detalhe.alternarSecao(secaoBtn.dataset.secao); desenhar(); return; }
    const anterior = e.target.closest(`[data-lista-anterior="${id}"]`), proximo = e.target.closest(`[data-lista-proximo="${id}"]`);
    if (anterior || proximo) { irAoVizinho(anterior ? -1 : 1); return; }
    // "‹ Alunos": a entrada que abriu o detalhe sai do histórico (Voltar), e a casca devolve a lista
    const voltar = e.target.closest(`[data-lista-voltar="${id}"]`);
    if (voltar && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (window.history.state && window.history.state.detalhe === id) window.history.back();
      else { voltarParaALista(); enderecar(null); }
    }
  });

  // A parada do Tab acompanha o foco
  document.addEventListener('focusin', e => {
    const ul = naLista(e.target);
    const li = ul && e.target.closest(`ul[data-lista="${id}"] > [data-chave]`);
    if (!li || estado.parada === li.dataset.chave) return;
    estado.parada = li.dataset.chave;
    desenhar();
  });

  // As teclas na lista e na busca
  document.addEventListener('keydown', e => {
    if (!(e.target instanceof Element) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.matches(`[data-flt="${id}"]`)) {
      const vista = lista.vista();
      if (!vista) return;
      const comTexto = Boolean(e.target.value.trim());
      if (e.key === 'ArrowDown') {
        const parada = primeiraDaBusca(vista, comTexto);
        const botao = parada && lista.botaoDaParada(parada);
        if (!botao) return;
        e.preventDefault();
        const sel = botao.dataset.item;
        if (sel !== undefined) escolher(sel, { origem: 'teclas' });
        (lista.botaoDaParada(parada) || botao).focus();
      } else if (e.key === 'Enter' && comTexto) {
        const parada = primeiraDaBusca(vista, true);
        const botao = parada && lista.botaoDaParada(parada);
        if (!botao) return;
        e.preventDefault();
        escolher(botao.dataset.item, { abrir: true });
        if (!vistaUnica()) detalhe.focarNoTitulo();
      }
      return;
    }
    // A linha mesma também: o foco que o redesenho deixou nela (data-foco-neutro) quando a ação dela saiu ("Aprovar" que
    // aprova); as teclas contam dali
    const li = naLista(e.target) && e.target.closest('[data-chave]');
    if (!li || !(e.target.matches('.lista-botao, .lista-seta') || (e.target === li && li.hasAttribute('data-foco-neutro')))) return;
    if (e.key === ' ') return;
    const r = teclaNaLista(lista.vista(), li.dataset.chave, e.key);
    if (!r) return;
    e.preventDefault();
    if (r.grupo !== undefined) {
      estado.parada = li.dataset.chave;
      lista.alternarGrupo(r.grupo, r.recolher);
      const botao = lista.botaoDaParada(li.dataset.chave);
      if (botao) botao.focus();
      return;
    }
    if (r.detalhe) {
      if (vistaUnica()) abrirDetalhe();
      else detalhe.focarNoTitulo();
      return;
    }
    estado.parada = r.ir;
    if (r.escolher !== null && r.escolher !== undefined) escolher(r.escolher, { origem: 'teclas' });
    else desenhar();
    const botao = lista.botaoDaParada(r.ir);
    if (botao) botao.focus();
  });

  // As teclas no detalhe: Ctrl+. e Ctrl+, (o vizinho); o Esc num campo digitado devolve o valor gravado (e tira o erro); o
  // Esc no resto do detalhe volta à linha (numa vista só, à lista). Com uma gaveta ou um diálogo aberto, o Esc é deles
  document.addEventListener('keydown', e => {
    const det = noDetalhe(e.target);
    if (!det) return;
    if (e.ctrlKey && !e.altKey && !e.metaKey && (e.key === '.' || e.key === ',')) {
      e.preventDefault();
      irAoVizinho(e.key === '.' ? 1 : -1, { campo: e.target.closest('[data-f], [data-a], [data-dado]') });
      return;
    }
    if (e.key !== 'Escape' || e.defaultPrevented || gavetaDoEsc(e) !== null || algumDialogoAberto()) return;
    const campo = e.target.matches('input:not([type="checkbox"]), textarea') ? e.target : null;
    const nome = campo && detalhe.campoDe(campo);
    if (campo && (campo.value !== campo.defaultValue || (nome && detalhe.temErro(nome)))) {
      e.preventDefault();
      if (nome && detalhe.temErro(nome)) { detalhe.limparErro(nome); desenhar({ forcar: true }); }
      const atual = nome ? document.getElementById(`det-${id}-${nome}`) : campo;
      if (atual && atual.value !== atual.defaultValue) {
        atual.value = atual.defaultValue;
        // Um campo dos dados pessoais: o rascunho acompanha o que a tela mostra (o input que a digitação daria)
        if (atual.matches('[data-dado]')) atual.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (atual) atual.focus();
      return;
    }
    if (e.target.matches('select')) return;
    e.preventDefault();
    if (vistaUnica()) {
      if (window.history.state && window.history.state.detalhe === id) window.history.back();
      else { voltarParaALista(); enderecar(null); }
    } else voltarParaALista();
  });

  // O erro de um campo sai quando ele muda de novo (antes do handler da tela, que pode recusar outra vez)
  document.addEventListener('change', e => {
    if (!noDetalhe(e.target)) return;
    const nome = detalhe.campoDe(e.target);
    if (nome) detalhe.limparErro(nome);
  }, true);

  return {
    desenhar,
    escolher,
    selecionado: () => estado.selecionado,
    voltarParaALista,
    // O que a tela faz ao aparecer (js/views/telas.js): com um item no endereço, escolhe o registro (numa vista só, o
    // detalhe aparece); sem item, a lista (com duas vistas, a escolha que estava na memória volta para o endereço).
    // Responde o item que fica no endereço
    aoMostrar(item, { historico = null } = {}) {
      const s = elSecao();
      if (item !== null && item !== undefined) {
        const sel = item === 'novo' ? [...estado.naoConfirmados.keys()].find(k => k === estado.selecionado) ?? null : String(item);
        if (sel === null) { voltarParaALista({ focar: false }); return { item: null }; }
        escolher(sel, { origem: 'endereco' });
        const escolhido = estado.selecionado === sel;
        if (vistaUnica() && escolhido) {
          mudarVista('detalhe');
          // Avançar (ou o endereço) até o detalhe: o foco, que estava na linha agora escondida, vai para o título
          const focou = historico === 'nenhum' && focoPerdido() && detalhe.focarNoTitulo();
          return { item: noEndereco(sel), lugar: detalhe.regiao(), focou };
        }
        // Voltar até a tela (duas vistas): o foco que ficou na tela de antes vai para a linha do registro
        const botao = escolhido && historico === 'nenhum' && focoPerdido() && lista.botaoDe(sel);
        if (botao) botao.focus({ preventScroll: true });
        return { item: escolhido ? noEndereco(sel) : estado.pedida ? sel : null, ...(botao ? { focou: true } : {}) };
      }
      if (vistaUnica()) {
        const voltando = Boolean(s && s.dataset.vendo === 'detalhe' && historico === 'nenhum');
        voltarParaALista({ focar: voltando });
        return { item: null, focou: voltando };
      }
      return { item: noEndereco(estado.selecionado) };
    },
    // O registro que a tela acabou de criar ("+ Novo aluno"): escolhido, à vista mesmo fora dos filtros, "novo" no endereço
    // até a gravação (gravacao: a promessa dela) ser confirmada; recusada, ele sai da escolha e o detalhe diz por quê
    novo(idNovo, gravacao) {
      const sel = String(idNovo);
      estado.naoConfirmados.set(sel, gravacao);
      estado.mantidos.add(sel);
      escolher(sel, { abrir: true, origem: 'novo' });
      Promise.resolve(gravacao).then(gravou => {
        estado.naoConfirmados.delete(sel);
        if (gravou) { if (estado.selecionado === sel) enderecar(sel); return; }
        estado.perdidos.add(sel);
        estado.mantidos.delete(sel);
        if (estado.selecionado !== sel) return;
        const focoNoDetalhe = Boolean(detalhe.regiao() && detalhe.regiao().contains(document.activeElement));
        const naVistaDoDetalhe = vistaUnica() && vendoODetalhe();
        estado.selecionado = null;
        detalhe.trocouDeRegistro();
        detalhe.avisarSemEscolha(`A inclusão do ${um} novo não foi confirmada pelo servidor.`);
        desenhar();
        if (naVistaDoDetalhe) { mudarVista('lista'); sairDaEntradaDoDetalhe(); } else enderecar(null);
        if (focoNoDetalhe) focarDepoisDeSair();
      });
    },
    // O registro excluído pela tela: nada escolhido, o foco na linha que ficou no lugar dele
    removido(idRemovido) {
      const vista = lista.vista();
      const antes = vista ? vista.registros.findIndex(r => r.id === String(idRemovido)) : -1;
      if (estado.selecionado === String(idRemovido)) estado.selecionado = null;
      const naVistaDoDetalhe = vistaUnica() && vendoODetalhe();
      detalhe.trocouDeRegistro();
      desenhar();
      mudarVista('lista');
      // Numa vista só, a entrada que abriu o detalhe sai do histórico (o Voltar seguinte sai da tela)
      if (naVistaDoDetalhe) sairDaEntradaDoDetalhe();
      else enderecar(null);
      const depois = lista.vista();
      const destino = depois && depois.registros[Math.min(Math.max(antes, 0), depois.registros.length - 1)];
      const botao = destino && lista.botaoDe(destino.id);
      if (botao) { estado.parada = destino.chave; desenhar(); (lista.botaoDe(destino.id) || botao).focus(); }
    },
    // Um valor recusado: fica no campo, com a mensagem; o foco fica onde a pessoa o pôs
    erroNoCampo(campo, texto) {
      detalhe.erroNoCampo(campo, texto);
      desenhar({ forcar: true });
    },
    focarNoCampo(campo, { selecionar = false } = {}) {
      const el = document.getElementById(`det-${id}-${campo}`);
      if (!el) return;
      el.focus();
      if (selecionar && el.select) el.select();
    }
  };
}
