// A Escala: o mapa e o popup do voo (e o clique no mapa que agenda), os filtros, exportar e compartilhar, o status do voo,
// aprovar e reabrir, os critérios da compactação e as sugestões para um conflito (o resultado da missão do curso:
// js/eventos/resultados.js)
import { gravarAlteracao, gravarEscalaCalculada, aindaNaoAbriu } from '../actions.js';
import { opcoesDeCategoria } from '../categorias.js';
import { OPCOES_DE_BURACOS, OPCOES_DE_HORARIOS, normalizarCriterios } from '../criterios.js';
import { $, showToast, anunciar, algumDialogoAberto, gavetaDoEsc, focarNoTitulo } from '../dom.js';
import { exp, pdf, planilha } from '../export.js';
import { fixosAoMudarStatus, fixosAoReabrir, fixosAoAprovar, normalizarFixos } from '../fixos.js';
import { hm, hojeISO } from '../format.js';
import { aplicarReparo, aproveitarCancelado, desfazerAproveitamento, repararComOPedido } from '../reparo.js';
import { S, RES, DATA, AUDIT_LOG, isGestor, modoCompartilhado, insBy } from '../state.js';
import { escolherInstrutor, escolhasDaUnidade, escolherNosPedidos, reverterEscolha, reverterReparo } from '../instrutor-escolhido.js';
import { agendamentosEmVolta } from '../reversoes.js';
import { STATUS_COM_DETALHE, textoParaOHistorico, detalheAoMudarStatus, rotuloDoStatus } from '../status.js';
import { ApiClient } from '../storage.js';
import { agendarNoMapa } from './agendamento.js';
import { confirmado } from './confirmacao.js';
import { aoAcionar, aoMudarCampo, aoReverter } from './registro.js';
import { vooDaChave } from './resultados.js';
import { pedirDetalheDoStatus } from '../views/dialogo-status.js';
import { rOut, lembrarCaixa, botaoDoInstrutor, seletorDeInstrutor, abrirPopupDoMapa, fecharPopupDoMapa, popupDoMapaAberto, reposicionarPopupDoMapa, tabNoPopup } from '../views/escala.js';
import { abrirPainelDeReparo, abrirPainelDoRejeitado, fecharPainelDeReparo, opcaoDoPainel, focarNoVoo } from '../views/reparo.js';
import { registrarDesenho, redesenharPorNome } from '../redesenho.js';
import { voosComInativos } from '../inativos.js';
import { registrarTela } from '../views/telas.js';

// O desenho da Escala (js/redesenho.js): refeito em todos os momentos, quando há escala
registrarDesenho('escala', () => { if (RES) rOut(); }, { em: ['dados', 'consulta', 'releitura', 'escala'], ordem: 80 });

// O minuto de um clique na faixa de uma linha do mapa: a posição dele dentro da faixa (sem a borda), entre o início e o
// fim do mapa (data-inicio e data-fim), de 5 em 5 minutos; na largura da faixa ou, com o eixo invertido, na altura
function minutoDoClique(faixa, { clientX, clientY }) {
  const mapa = faixa.closest('.tl-wrap');
  const { inicio, fim } = mapa.dataset;
  const caixa = faixa.getBoundingClientRect();
  // Com o eixo invertido, as horas descem: a posição é a do clique na altura da faixa
  const fracao = mapa.classList.contains('transposto')
    ? (clientY - caixa.top - faixa.clientTop) / faixa.clientHeight
    : (clientX - caixa.left - faixa.clientLeft) / faixa.clientWidth;
  return Math.round((+inicio + Math.min(1, Math.max(0, fracao)) * (fim - inicio)) / 5) * 5;
}

// A caixa do resumo que a pessoa abre ou recolhe fica assim nos redesenhos (o toggle não sobe: ouvido na captura). O
// redesenho cria a caixa já no estado lembrado, então o toggle dela só repete o que já está guardado
document.addEventListener('toggle', e => {
  const caixa = e.target instanceof Element && e.target.closest('#out details.caixa[data-caixa]');
  if (caixa === e.target) lembrarCaixa(caixa.dataset.caixa, caixa.open);
}, true);

// Popup do voo no mapa da escala: a barra abre e fecha; Esc (o foco volta para a barra) e um clique fora fecham, e ele
// acompanha a barra quando a página ou o mapa rolam. Um diálogo aberto por cima (o do status) fica com o Esc e com os
// cliques dentro dele: o popup continua aberto. Dentro ou fora é pelo caminho do clique, fixado quando ele começa: o
// nome do instrutor, já trocado pela lista (js/eventos/registro.js) e fora da página, continua dentro do popup.
// Sem popup aberto, um clique (ou toque) no espaço livre de uma linha do mapa agenda nela: o diálogo abre com o recurso
// ou o instrutor da linha e o horário da lista mais perto do clique (js/agendamento.js). Com o popup aberto, o clique só
// fecha o popup
document.addEventListener('click', e => {
  const barra = e.target.closest('#out .tl-bar');
  if (barra) {
    if (barra.getAttribute('aria-expanded') === 'true') fecharPopupDoMapa();
    else abrirPopupDoMapa(barra, { focar: true });
    return;
  }
  if (popupDoMapaAberto()) {
    const dentro = e.composedPath().some(el => el instanceof Element && el.matches('#tl-pop, dialog'));
    if (!dentro) fecharPopupDoMapa();
    return;
  }
  const faixa = e.target.closest('#out .tl-track:not(.inerte)');
  if (!faixa || isGestor()) return;
  const { r, ins } = faixa.dataset;
  agendarNoMapa({ ...(ins ? { insId: +ins } : { r }), minuto: minutoDoClique(faixa, e) });
});
// O Esc fecha só o popup, a camada de cima: ouvido na captura, ele para aqui e não chega às gavetas e aos painéis
// de trás (o Histórico, as Sugestões, as habilitações), que continuam abertos. O Esc na lista do instrutor é dela
// (volta ao nome, abaixo, com o popup aberto)
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !popupDoMapaAberto() || algumDialogoAberto()) return;
  if (e.target.closest && e.target.closest('select[data-a="insVoo"]')) return;
  e.stopPropagation();
  fecharPopupDoMapa({ devolverFoco: true });
}, true);
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('#tl-pop')) tabNoPopup(e);
});
document.addEventListener('scroll', reposicionarPopupDoMapa, { capture: true, passive: true });
window.addEventListener('resize', reposicionarPopupDoMapa);

// Depois de um filtro, o leitor de tela ouve quantos voos ficaram (a lista muda sem o foco sair do filtro); na busca,
// quando a digitação para
let anuncioDoFiltro = null;
function filtrar(esperar = 0) {
  const voos = rOut();
  clearTimeout(anuncioDoFiltro);
  const texto = voos ? `${voos === 1 ? '1 voo' : `${voos} voos`} na escala com esses filtros.` : 'Nenhum voo na escala com esses filtros.';
  anuncioDoFiltro = setTimeout(() => anunciar(texto), esperar);
}
document.addEventListener('input', e => {
  if (e.target.id === 'flt-esc-q') filtrar(500);
});
$('#flt-esc-eq').onchange = () => filtrar();
// Categoria; o filtro de recurso mostra só os da categoria escolhida
$('#flt-esc-cat').innerHTML = opcoesDeCategoria();
$('#flt-esc-cat').onchange = () => filtrar();

// Exportar é usar a escala: a escala só calculada fica gravada (quem só consulta não grava)
$('#exp').onclick = () => { gravarEscalaCalculada(); exp(); };
$('#pdf').onclick = () => { gravarEscalaCalculada(); pdf(); };
$('#xlsx').onclick = () => { gravarEscalaCalculada(); planilha(); };

// No modo compartilhado o link leva só a data: quem abre entra com a própria conta e lê do servidor
function linkDaData(data) {
  const url = new URL(window.location.href);
  const projeto = url.searchParams.get('supabase');
  // Só a data: sem a tela (o fragmento) e sem os outros parâmetros
  url.search = '';
  url.hash = '';
  if (projeto) url.searchParams.set('supabase', projeto);
  url.searchParams.set('data', data);
  return url.toString();
}

// Sem o servidor, a escala fica só neste navegador: não há link que leve a escala inteira no endereço (exporia nomes,
// pesos e horas)
$('#btn-share-link').onclick = async () => {
  if (!modoCompartilhado()) {
    showToast('Sem o servidor, a escala fica só neste navegador: o link da escala é do app publicado, com login.');
    return;
  }
  const url = linkDaData(DATA);
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link da escala copiado (quem abrir entra com a própria conta).', 'ok');
  } catch {
    prompt('Copie o link da escala:', url);
  }
};

// Status do voo: Atrasado e Cancelado pedem o detalhe (a nova decolagem ou o motivo) antes de valer; desistir deixa o
// status anterior. O histórico registra só a categoria do motivo
function aplicarStatus(fKey, status, detalhe) {
  if (!S.fStatus) S.fStatus = {};
  if (!S.fObs) S.fObs = {};
  S.fStatus[fKey] = status;
  // Sem o diálogo, o novo horário do atraso segue no Em Voo e no Pousou; nos outros, o detalhe sai
  const novo = detalhe || detalheAoMudarStatus(S.fObs[fKey], status);
  if (novo) S.fObs[fKey] = novo;
  else delete S.fObs[fKey];
  const voo = vooDaChave(fKey);
  // Em Voo, Atrasado, Pousou e Cancelado fixam o voo: uma alteração na escala não o tira do lugar (o cancelado fica
  // onde estava, sem ocupar nada). Fora da escala aprovada, Pendente ou Confirmado o soltam, menos o fixo pelo operador
  // na Escala (o instrutor escolhido e o voo agendado)
  if (voo) S.fixos = fixosAoMudarStatus(S.fixos, voo, status, { aprovada: Boolean(S.aprovacao) });
  const textoDoStatus = status === 'Pousou' ? rotuloDoStatus(status, voo) : textoParaOHistorico(status, detalhe);
  gravarAlteracao('mod', `Status de ${voo ? `${voo.s} (${hm(voo.a)}–${hm(voo.b)})` : fKey}: ${textoDoStatus}`);
}
function mudarStatus(fKey, status) {
  const voo = vooDaChave(fKey);
  if (!voo || !STATUS_COM_DETALHE.includes(status)) { aplicarStatus(fKey, status, null); return; }
  pedirDetalheDoStatus({ voo, status, aoConfirmar: detalhe => aplicarStatus(fKey, status, detalhe), aoDesistir: () => rOut() });
}
aoMudarCampo('fstatus', t => mudarStatus(t.dataset.fkey, t.value));

// O nome do instrutor abre a lista no lugar dele; sair dela sem mudar (o foco sai, ou Esc) volta ao nome
const elementoDe = html => { const t = document.createElement('template'); t.innerHTML = html; return t.content.firstElementChild; };
aoAcionar('trocar-instrutor', b => {
  const voo = vooDaChave(b.dataset.fkey);
  if (!voo || !RES) return;
  const lista = elementoDe(seletorDeInstrutor(voo, b.dataset.rotulo));
  b.replaceWith(lista);
  lista.focus();
  try { lista.showPicker(); } catch { /* sem showPicker (ou sem o gesto do usuário): a lista fica com o foco */ }
});
function voltarAoNome(lista, { focar = false } = {}) {
  const voo = vooDaChave(lista.dataset.fkey);
  if (!lista.isConnected || !voo) return;
  const botao = elementoDe(botaoDoInstrutor(voo, lista.dataset.rotulo));
  lista.replaceWith(botao);
  if (focar) botao.focus();
}
document.addEventListener('focusout', e => {
  const lista = e.target.closest && e.target.closest('select[data-a="insVoo"]');
  if (lista) setTimeout(() => voltarAoNome(lista));
});
document.addEventListener('keydown', e => {
  const lista = e.key === 'Escape' && e.target.closest && e.target.closest('select[data-a="insVoo"]');
  if (!lista) return;
  e.stopPropagation();
  voltarAoNome(lista, { focar: true });
}, true);

// O instrutor escolhido na Escala: o voo (na turma de Ground, a turma inteira) fica onde está, fixo, com ele, e o resto
// da escala é refeito em volta; o pedido também guarda a escolha. "Automático" devolve a escolha ao app (fora da escala
// aprovada, o voo deixa de ser fixo). O histórico desfaz
aoMudarCampo('insVoo', t => {
  const voo = vooDaChave(t.dataset.fkey);
  if (!voo) return;
  const x = t.value ? insBy(+t.value) : null;
  const { antes, alunos } = escolherInstrutor(S, RES, { stuId: voo.stuId, mid: voo.mid || 0 }, x ? x.id : null, { noLugar: true });
  const quem = alunos > 1 ? `turma de ${voo.mis}` : voo.s;
  gravarAlteracao('mod', `Instrutor de ${quem} (${hm(voo.a)}–${hm(voo.b)}): ${x ? x.nm : 'automático'}`, { kind: 'restaurarEscolha', ...antes, label: '↶ Reverter' });
  redesenharPorNome('pedidos-do-dia');
  showToast(x ? `${x.nm} fica com o voo; o resto da escala foi refeito em volta.` : 'O app volta a escolher o instrutor deste voo.', 'ok');
});

// Um clique no detalhe do status (motivo ou nova decolagem) permite alterá-lo; o status continua o mesmo
aoAcionar('detalhe-status', b => {
  const fKey = b.dataset.fkey, status = S.fStatus && S.fStatus[fKey], voo = vooDaChave(fKey);
  if (!voo || !STATUS_COM_DETALHE.includes(status)) return;
  pedirDetalheDoStatus({ voo, status, detalhe: S.fObs && S.fObs[fKey], aoConfirmar: detalhe => aplicarStatus(fKey, status, detalhe) });
});

// Aprovar a escala: todos os voos ficam fixos e o selo diz quando e quem aprovou. Reabrir solta os voos: a
// escala volta a ser refeita inteira a cada alteração. Os dois pedem confirmação
document.addEventListener('click', e => {
  const aprovar = e.target.closest('#btn-aprovar'), reabrir = e.target.closest('#btn-reabrir');
  if ((!aprovar && !reabrir) || isGestor() || !RES || aindaNaoAbriu()) return;
  if (aprovar) {
    if (!confirmado(aprovar, 'Confirmar aprovação')) return;
    // O voo fixo pelo operador na Escala (o instrutor escolhido e o voo agendado) continua com a marca: reabrir a escala
    // não o solta. O agendado fora da escala (o pedido foi tirado dela) continua fixo, para o voo voltar ao lugar dele
    S.fixos = fixosAoAprovar(S.fixos, RES.out);
    S.aprovacao = { em: new Date().toISOString(), por: ApiClient.autorAtual || '' };
    gravarAlteracao('mod', `Escala aprovada: ${RES.out.length} ${RES.out.length === 1 ? 'voo fixado' : 'voos fixados'}`);
    showToast('Escala aprovada: os voos ficam fixos.', 'ok');
    // O botão virou "Reabrir": o foco vai para ele
    $('#btn-reabrir')?.focus();
  } else {
    if (!confirmado(reabrir, 'Confirmar reabertura')) return;
    // Os voos em andamento (Em Voo, Atrasado, Pousou, Cancelado) e os fixados pelo operador na Escala continuam fixos
    S.fixos = fixosAoReabrir(S.fixos, S.fStatus);
    S.aprovacao = null;
    gravarAlteracao('mod', 'Escala reaberta: volta a ser refeita a cada alteração');
    showToast('Escala reaberta.', 'ok');
    $('#btn-aprovar')?.focus();
  }
});

// Critérios da compactação: a escala é refeita com o critério novo (com a escala aprovada, não mudam)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-criterio]');
  if (!b || b.getAttribute('aria-disabled') === 'true' || isGestor() || S.aprovacao || aindaNaoAbriu()) return;
  const campo = b.dataset.criterio, antes = normalizarCriterios(S.criterios);
  if (antes[campo] === b.dataset.valor) return;
  S.criterios = normalizarCriterios({ ...antes, [campo]: b.dataset.valor });
  const opcoes = campo === 'buracos' ? OPCOES_DE_BURACOS : OPCOES_DE_HORARIOS;
  const nome = id => opcoes.find(([v]) => v === id)[1];
  gravarAlteracao('mod', `Compactação: ${campo === 'buracos' ? 'buracos' : 'horários'} ${nome(antes[campo])} → ${nome(S.criterios[campo])}`);
});

// Sugestões para um conflito: a gaveta abre pelo botão do conflito. "Aplicar" muda o voo fixo (na turma de
// Ground, a turma inteira) e "Soltar" o tira dos fixos; o histórico guarda os fixos de antes, para reverter. Cancelar
// abre o diálogo do status, já com o motivo do conflito marcado
// Aberta do popup do mapa, a gaveta fica no lugar dele (o popup fecha): o Esc fecha a gaveta e volta para o voo. Aplicada a
// sugestão, o foco vai para o voo (o botão "Sugestões" dele não existe mais)
document.addEventListener('click', e => {
  const abrirSugestoes = e.target.closest('[data-reparo]');
  const doRejeitado = !abrirSugestoes && e.target.closest('[data-rejeitado]');
  if ((abrirSugestoes || doRejeitado) && !isGestor() && popupDoMapaAberto()) fecharPopupDoMapa();
  if (abrirSugestoes) { if (!isGestor()) abrirPainelDeReparo(abrirSugestoes.dataset.reparo); return; }
  if (doRejeitado) { if (!isGestor()) abrirPainelDoRejeitado(doRejeitado.dataset.rejeitado); return; }
  if (e.target.closest('#btn-fechar-reparo')) { fecharPainelDeReparo(true); return; }
  const botao = e.target.closest('[data-reparo-aplicar]');
  if (!botao || isGestor() || aindaNaoAbriu()) return;
  const escolha = opcaoDoPainel(+botao.dataset.reparoAplicar);
  if (!escolha) return;
  const { fKey, voo, opcao, cancelado, rejeitado } = escolha;
  // O pedido recusado: a escolha do instrutor muda (0: "Automático"), com a reversão da escolha de sempre
  if (rejeitado) {
    fecharPainelDeReparo();
    const [stuId, mid] = fKey.split('_').map(Number);
    const x = opcao.insId ? insBy(opcao.insId) : null;
    const { antes } = escolherInstrutor(S, RES, { stuId, mid }, x ? x.id : null);
    gravarAlteracao('mod', `Pedido recusado encaixado: ${opcao.texto}`, { kind: 'restaurarEscolha', ...antes, label: '↶ Reverter' });
    redesenharPorNome('pedidos-do-dia');
    focarNoVoo(fKey);
    showToast('Instrutor escolhido: o pedido entra na escala.', 'ok');
    return;
  }
  // A sugestão fora da disponibilidade do pedido ou em outro tipo pede a confirmação com o aluno, e a que faz do voo o 7º
  // local do horário, a do operador (dois cliques)
  if (opcao.confirmar && !confirmado(botao, opcao.armado || 'Confirmei com o aluno')) return;
  // O voo cancelado aproveitado: aplicada, a sugestão fixa o voo no lugar dela e o volta para Pendente, e o pedido muda
  // com ela
  if (cancelado) {
    fecharPainelDeReparo();
    const rev = aproveitarCancelado(S, RES, fKey, opcao);
    if (!rev) return;
    gravarAlteracao('mod', `Voo cancelado aproveitado: ${voo.s} (${hm(voo.a)}–${hm(voo.b)}): ${opcao.texto}`, { ...rev, label: '↶ Reverter' });
    redesenharPorNome('pedidos-do-dia');
    focarNoVoo(fKey);
    showToast('Voo aproveitado: ele volta para Pendente, no lugar da sugestão.', 'ok');
    return;
  }
  fecharPainelDeReparo();
  if (!opcao.mudancas && !opcao.soltar) {
    pedirDetalheDoStatus({ voo, status: 'Cancelado', detalhe: opcao.motivo ? { motivo: opcao.motivo } : null, aoConfirmar: detalhe => aplicarStatus(fKey, 'Cancelado', detalhe) });
    return;
  }
  // A sugestão do conflito que muda também o pedido (a disponibilidade, o tipo): o voo fixo e o pedido mudam juntos, e o
  // histórico desfaz os dois (a reversão do aproveitamento)
  if (opcao.pedido) {
    const rev = repararComOPedido(S, RES, fKey, opcao);
    if (!rev) return;
    gravarAlteracao('mod', `Reparo: ${voo.s} (${hm(voo.a)}–${hm(voo.b)}): ${opcao.texto}`, { ...rev, label: '↶ Reverter' });
    redesenharPorNome('pedidos-do-dia');
    focarNoVoo(fKey);
    showToast('Sugestão aplicada: o voo continua fixo, e o pedido muda com ela.', 'ok');
    return;
  }
  const antes = S.fixos || {};
  // O instrutor escolhido dos pedidos acompanha o reparo: trocar o instrutor passa a escolha para o novo; soltar o voo
  // devolve a escolha ao app
  const escolhas = escolhasDaUnidade(S, RES, fKey);
  if (opcao.soltar) escolherNosPedidos(S, escolhas, null);
  else if (opcao.mudancas.insId) escolherNosPedidos(S, escolhas, opcao.mudancas.insId);
  S.fixos = aplicarReparo(antes, RES, fKey, opcao);
  // Os voos que mudaram ou saíram dos fixos (soltar): o histórico guarda como estavam
  const mudados = Object.keys(antes).filter(k => S.fixos[k] !== antes[k]);
  gravarAlteracao('mod', `Reparo: ${voo.s} (${hm(voo.a)}–${hm(voo.b)}): ${opcao.soltar ? 'Soltar o voo' : opcao.texto}`, {
    kind: 'restaurarFixos', fixos: Object.fromEntries(mudados.map(k => [k, antes[k]])), ...(escolhas.length ? { pedidos: escolhas } : {}), label: '↶ Reverter'
  });
  if (escolhas.length) redesenharPorNome('pedidos-do-dia');
  focarNoVoo(fKey);
  showToast(opcao.soltar ? 'Voo solto: o app escalou de novo.' : 'Sugestão aplicada: o voo continua fixo.', 'ok');
});
// O Esc fecha a gaveta quando ela é a de cima ou tem o foco (js/dom.js); com um diálogo aberto por cima (o do status, o
// do agendamento), o Esc fecha só o diálogo
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && gavetaDoEsc(e) === $('#painel-reparo') && !algumDialogoAberto()) fecharPainelDeReparo(true);
});

// "↶ Reverter" no histórico (js/eventos/historico.js): os tipos desta tela. A reversão chega validada (js/reversoes.js)
// O voo cancelado aproveitado, desfeito: o pino, o status, o motivo e o pedido de antes
aoReverter('aproveitarCancelado', (rev, entry) => {
  desfazerAproveitamento(S, rev);
  S.fixos = normalizarFixos(S.fixos);
  redesenharPorNome('pedidos-do-dia');
  gravarAlteracao('mod', `Revertido: ${entry.desc}`, null, entry.id);
});
aoReverter('restaurarFixos', (rev, entry) => {
  // Um reparo desfeito: os voos voltam a ser fixos como antes dele, e o instrutor escolhido dos pedidos também. O voo
  // agendado volta só enquanto o agendamento continua: o histórico diz qual foi desfeito ou feito depois do reparo
  // (js/reversoes.js e js/instrutor-escolhido.js)
  reverterReparo(S, rev, agendamentosEmVolta(S, AUDIT_LOG, entry, S.frota));
  S.fixos = normalizarFixos(S.fixos);
  if (rev.pedidos) redesenharPorNome('pedidos-do-dia');
  gravarAlteracao('mod', `Revertido: ${entry.desc}`, null, entry.id);
});

aoReverter('restaurarEscolha', (rev, entry) => {
  // O instrutor escolhido volta como estava, e os voos fixos também; o voo agendado, só enquanto o agendamento
  // continua (js/reversoes.js e js/instrutor-escolhido.js)
  reverterEscolha(S, rev, agendamentosEmVolta(S, AUDIT_LOG, entry, S.frota));
  S.fixos = normalizarFixos(S.fixos);
  gravarAlteracao('mod', `Revertido: ${entry.desc}`, null, entry.id);
  redesenharPorNome('pedidos-do-dia');
});

// "Refazer a escala" (o aviso dos voos com quem ficou inativo): a escala é refeita sem o instrutor ou o recurso inativo e
// gravada, com a entrada no histórico; nada mais muda
aoAcionar('refazer-escala', () => {
  const nomes = voosComInativos(S, RES, { data: DATA, hoje: hojeISO() }).filter(i => i.de !== 'aluno').map(i => i.nome);
  gravarAlteracao('mod', nomes.length ? `Escala refeita: ${nomes.join(', ')} ${nomes.length > 1 ? 'estão inativos' : 'está inativo'}` : 'Escala refeita sem os inativos do cadastro');
});

// Aprovar (#/apr): até ter a tela dela, a aprovação fica na barra da compactação da Escala. Ela vem à vista, contornada por
// um instante, e o foco vai para o botão dela (Aprovar escala ou Reabrir), com o estado dito ao leitor de tela; sem botão
// (quem só consulta, a escala sem voo ou sem as horas dos instrutores), o foco vai para o título da Escala, com o porquê
const DESTAQUE_MS = 1200;
function mostrarAprovacao() {
  const barra = $('#compactacao');
  const alvo = S.aprovacao ? $('#selo-aprovada') : $('#aprovacao');
  const botao = [...document.querySelectorAll('#aprovacao button')].find(b => !b.disabled && b.getClientRects().length);
  const semVoo = !RES || !RES.out.length;
  let texto;
  if (S.aprovacao) {
    const em = new Date(S.aprovacao.em);
    texto = `Escala aprovada às ${hm(em.getHours() * 60 + em.getMinutes())}${S.aprovacao.por ? ` por ${S.aprovacao.por}` : ''}.`;
  } else if (semVoo) texto = 'Nenhum voo nesta data: não há escala para aprovar.';
  else if (!botao && isGestor()) texto = 'Escala ainda não aprovada. Quem só consulta não aprova.';
  else if (!botao) texto = 'Escala ainda não aprovada: as horas de voo dos instrutores não foram lidas.';
  else texto = 'Escala ainda não aprovada.';
  if (alvo && !alvo.hidden && alvo.getClientRects().length) {
    alvo.classList.add('destaque');
    setTimeout(() => alvo.classList.remove('destaque'), DESTAQUE_MS);
  }
  if (botao) botao.focus({ preventScroll: true });
  else focarNoTitulo($('#s-esc'));
  anunciar(texto);
  return { lugar: barra && !barra.hidden ? barra : null, focou: true };
}
registrarTela('apr', { aoMostrar: () => mostrarAprovacao() });
