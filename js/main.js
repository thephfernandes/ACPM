/**
 * AutoEscala - ACPM: ponto de entrada (eventos da interface e inicialização).
 *
 *   js/config.js    Configurações operacionais (janelas, frota, missões, limites de peso)
 *   js/rules.js     Regras das missões (Ground School, nível mínimo, precedência, normalização)
 *   js/format.js    Formatação de horários, durações e opções de seleção
 *   js/engine.js    Motor de alocação determinístico (função pura)
 *   js/storage.js   Camada de dados (migrações, link compartilhado) sobre js/backends/ (local ou Supabase)
 *   js/sessao.js    Login e perfil de acesso no modo compartilhado (Supabase)
 *   js/state.js     Estado compartilhado entre os módulos
 *   js/actions.js   Perfil de acesso, data, histórico e escala
 *   js/dom.js       Utilitários de DOM
 *   js/views/       Renderização das abas (recursos, cadastros, demanda, escala, BI e navegação)
 *   js/export.js    Exportação CSV e PDF
 */
import { WIN, NI, T, GROUND_EQ_TYPE, GROUND_REG, GROUND_DURATION_MIN, GROUND_DURATION_H, MIS, PRE } from './config.js';
import { novoRecurso, matriculasDoTipo } from './frota.js';
import { HORARIOS_PADRAO, DE_30_EM_30, horariosDaMissao, ajustarPreferencias, paraMinuto } from './horarios.js';
import { hm, fmtH, fmtDurLabel, pad, amanhaISO, isoMenosDias } from './format.js';
import { isGroundMission, blank, rotuloDaDisponibilidade, normalizeMissionFields } from './rules.js';
import { habilitacoesDoNivel, normalizarHabilitacoes, nomeDaHabilitacao, podeFazer } from './habilitacoes.js';
import { ApiClient } from './storage.js';
import { S, RES, AUDIT_LOG, DATA, setS, setRES, setAuditLog, setTLMode, isGestor, insBy, stuBy, getMissionTarget } from './state.js';
import { $, showToast, focusLast, mostrarAviso, avisoAberto } from './dom.js';
import { show } from './views/tabs.js';
import { rBI, alternarTodosDoBI } from './views/bi.js';
import { renderAuditPanel, rOut, alternarTempo, abrirPopupDoMapa, fecharPopupDoMapa, popupDoMapaAberto, reposicionarPopupDoMapa } from './views/escala.js';
import { pedirDetalheDoStatus, dialogoDeStatusAberto } from './views/dialogo-status.js';
import { acaoDoPainel } from './views/painel-aeroporto.js';
import { abrirPainelDeDados, fecharPainelDeDados, salvarPainelDeDados, carregarDadosPessoais } from './views/dados-pessoais.js';
import { abrirPainelDeReparo, fecharPainelDeReparo, opcaoDoPainel, painelDeReparoAberto } from './views/reparo.js';
import { aplicarReparo } from './reparo.js';
import { OPCOES_DE_BURACOS, OPCOES_DE_HORARIOS, normalizarCriterios } from './criterios.js';
import { normalizarCursos, normalizarCursoDoAluno, novaMissaoDoCurso, codigoValido } from './cursos.js';
import { rCursos, mostrarVistaDosAlunos, podeEditarCursos, atualizarLinhaDoPrograma } from './views/cursos.js';
import { proximaDoPedido } from './views/etapas.js';
import { STATUS_COM_DETALHE, textoParaOHistorico } from './status.js';
import { pinoDoVoo, normalizarFixos } from './fixos.js';
import { singleDemandRowHTML, cnt, rDem, applyDemandFilters } from './views/demanda.js';
import { rIns, rAlu, applyInstructorFilters, preencherFiltroDeHabilitacoes, mostrarVistaDosInstrutores, abrirPainelDoInstrutor, fecharPainelDoInstrutor, atualizarLinhaDoCadastro, atualizarLinhaDoAluno, rPainelDoInstrutor, rLimites, podeEditarLimites } from './views/cadastros.js';
import { LIMITES_DA_LEI, normalizarLimites, comHorasExternas } from './limites.js';
import { rRec, rRevisao, rHangar, alternarGrupoDaFrota, NOMES_DAS_CATEGORIAS } from './views/recursos.js';
import { normalizarHangar, moverNoHangar } from './hangar.js';
import { opcoesDeCategoria, categoriaDoTipo } from './categorias.js';
import { setRole, save, logChange, refazerEscala, escalaCalculada, marcarEscalaSoCalculada, gravarEscalaCalculada, abrirData, historicoParaPainel, carregarData, carregarBI } from './actions.js';
import { exp, pdf } from './export.js';
import { projetoSupabase } from './config-supabase.js';
import { CATEGORIAS_DO_RODIZIO, ajustarFilas } from './rodizio.js';
import { rRodizio } from './views/rodizio.js';
import { abrirConta, carregarContas, gerarSenha, mensagem } from './views/conta.js';
import { rManual } from './views/manual.js';
import { atualizarSelosDaEscala, lerPedidosDaData } from './views/selos.js';
import { importarSolicitacoes, disponibilidadeDaSolicitacao } from './agenda.js';
import { abrirAgenda, carregarMes, mudarMes, escolherDia, diaDaAgenda, lembrarRegistradoPor, podeEditarAgenda, rAgenda, preencherHorariosDaAgenda } from './views/agenda.js';
import { ESQUEMA } from './migracoes.js';
import { iniciarSessaoSupabase } from './sessao.js';

const activeTimers = new WeakMap();

document.addEventListener('click', e => {
  const g = e.target.closest('[data-t],[data-go]');
  if (g) {
    const aba = g.dataset.t || g.dataset.go;
    show(aba);
    if (aba === 'bi') carregarBI();
    if (aba === 'age') abrirAgenda();
    try { window.scrollTo(0, 0); } catch (x) {}
    return;
  }
  const tlBtn = e.target.closest('[data-tl]');
  if (tlBtn) {
    setTLMode(tlBtn.dataset.tl);
    rOut();
    return;
  }
  // Painel: os dois quadros ou um só, pausar a troca e tela cheia
  const fidsBtn = e.target.closest('[data-fids]');
  if (fidsBtn) {
    acaoDoPainel(fidsBtn.dataset.fids);
    return;
  }
  // Recolher e abrir: os horários da Lista (Escala) e as categorias da frota (Recursos)
  const tempo = e.target.closest('[data-recolher-tempo]');
  if (tempo) { alternarTempo(+tempo.dataset.recolherTempo); return; }
  const grupo = e.target.closest('[data-recolher-grupo]');
  if (grupo) { alternarGrupoDaFrota(grupo.dataset.recolherGrupo); return; }
  const vistaIns = e.target.closest('[data-vista-ins]');
  if (vistaIns) { mostrarVistaDosInstrutores(vistaIns.dataset.vistaIns); return; }
  const vistaAlu = e.target.closest('[data-vista-alu]');
  if (vistaAlu) { mostrarVistaDosAlunos(vistaAlu.dataset.vistaAlu); return; }
  const todosDoBI = e.target.closest('[data-bi-todos]');
  if (todosDoBI) { alternarTodosDoBI(todosDoBI.dataset.biTodos); return; }
  // Links para uma parte do Manual
  const manual = e.target.closest('[data-manual]');
  if (manual) {
    e.preventDefault();
    show('manual');
    $('#' + manual.dataset.manual).scrollIntoView({ block: 'start' });
  }
});

// Popup do voo no mapa da escala: a barra abre e fecha; Esc (o foco volta para a barra) e um clique fora fecham, e ele
// acompanha a barra quando a página ou o mapa rolam
document.addEventListener('click', e => {
  const barra = e.target.closest('#out .tl-bar');
  if (barra) {
    if (barra.getAttribute('aria-expanded') === 'true') fecharPopupDoMapa();
    else abrirPopupDoMapa(barra);
    return;
  }
  if (popupDoMapaAberto() && !e.target.closest('#tl-pop, #dlg-status')) fecharPopupDoMapa();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && popupDoMapaAberto() && !dialogoDeStatusAberto()) fecharPopupDoMapa({ devolverFoco: true });
});
document.addEventListener('scroll', reposicionarPopupDoMapa, { capture: true, passive: true });
window.addEventListener('resize', reposicionarPopupDoMapa);

// Dados pessoais de um aluno ou instrutor: o botão da linha abre o painel; Cancelar, ✕ e Esc fecham (o foco volta para
// o botão). Salvar valida e grava; o histórico registra só os nomes dos campos que mudaram
document.addEventListener('click', e => {
  const botao = e.target.closest('[data-dados]');
  if (botao) {
    const [tipo, id] = botao.dataset.dados.split(':');
    abrirPainelDeDados(tipo, +id, botao);
    return;
  }
  if (e.target.closest('#btn-fechar-dados, #btn-cancelar-dados')) fecharPainelDeDados(true);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#painel-dados').hidden && !dialogoDeStatusAberto()) fecharPainelDeDados(true);
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'form-dados') return;
  e.preventDefault();
  const salvo = await salvarPainelDeDados();
  if (!salvo) return;
  fecharPainelDeDados(true);
  showToast(`Dados pessoais de ${salvo.nome} salvos.`, 'ok');
  if (salvo.alterados.length) logChange('mod', `Dados pessoais de ${salvo.nome} atualizados: ${salvo.alterados.join(', ')}`);
});

// Painel das habilitações de um instrutor: ✕ e Esc fecham (o foco volta para o botão que abriu)
document.addEventListener('click', e => {
  if (e.target.closest('#btn-fechar-painel-instrutor')) fecharPainelDoInstrutor(true);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#painel-instrutor').hidden) fecharPainelDoInstrutor(true);
});

document.addEventListener('input', e => {
  if (e.target.id === 'flt-dem') { applyDemandFilters(); return; }
  if (e.target.id === 'flt-esc-q') { rOut(); return; }
  if (e.target.id === 'bi-flt-ins') { rBI(); return; }
  if (e.target.dataset.flt === 'inst') { applyInstructorFilters(); return; }
  const f = e.target.dataset.flt;
  if (!f) return;
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('#' + f + ' .cd').forEach(c => {
    c.hidden = !c.querySelector('.nm').value.toLowerCase().includes(q);
  });
});

// Botões que pedem confirmação: o primeiro clique troca o texto; o segundo, em até 3,5 s, confirma
const confirmado = (b, txt) => {
  const o = b.dataset.o || (b.dataset.o = b.textContent);
  if (activeTimers.has(b)) clearTimeout(activeTimers.get(b));
  if (!b.dataset.arm) {
    b.dataset.arm = 1; b.textContent = txt;
    activeTimers.set(b, setTimeout(() => { b.dataset.arm = ''; b.textContent = o; activeTimers.delete(b); }, 3500));
    return false;
  }
  b.dataset.arm = ''; b.textContent = o; activeTimers.delete(b);
  return true;
};
const armed = (id, txt, fn) => {
  $(id).onclick = e => {
    if (isGestor()) return;
    if (confirmado(e.target, txt)) fn();
  };
};

// Exportar é usar a escala: a escala só calculada fica gravada (quem só consulta não grava)
$('#exp').onclick = () => { gravarEscalaCalculada(); return exp(); };
$('#pdf').onclick = () => { gravarEscalaCalculada(); return pdf(); };

$('#role-sel').onchange = e => {
  if (ApiClient.readOnly) {
    setRole('gestor', true);
    return;
  }
  setRole(e.target.value);
  if (RES) rOut();
};

const modoCompartilhado = () => document.body.dataset.backend === 'supabase';

// No modo compartilhado o link leva só a data: quem abre entra com a própria conta e lê do servidor
function linkDaData(data) {
  const url = new URL(window.location.href);
  const projeto = url.searchParams.get('supabase');
  url.search = '';
  if (projeto) url.searchParams.set('supabase', projeto);
  url.searchParams.set('data', data);
  return url.toString();
}

$('#btn-share-link').onclick = async () => {
  const compartilhado = modoCompartilhado();
  const url = compartilhado ? linkDaData(DATA) : ApiClient.encodeShareableURL(S, DATA);
  try {
    await navigator.clipboard.writeText(url);
    showToast(compartilhado ? 'Link da escala copiado (quem abrir entra com a própria conta).' : 'Link de Gestor (somente leitura) copiado!', 'ok');
  } catch (e) {
    prompt(compartilhado ? 'Copie o link da escala:' : 'Copie o link abaixo (abre bloqueado no perfil Gestor):', url);
  }
};

// Histórico: gaveta lateral sobre a aba aberta; o botão abre e fecha, ✕ e Esc fecham
const gavetaDoHistorico = $('#historico');
function mostrarHistorico(abrir) {
  gavetaDoHistorico.hidden = !abrir;
  $('#btn-open-log').setAttribute('aria-expanded', String(abrir));
  if (!abrir) return;
  $('#historico-data').textContent = $('#dt-rotulo').textContent;
  $('#btn-fechar-historico').focus();
}
$('#btn-open-log').onclick = () => mostrarHistorico(gavetaDoHistorico.hidden);
$('#btn-fechar-historico').onclick = () => mostrarHistorico(false);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !gavetaDoHistorico.hidden) mostrarHistorico(false);
});

// Só no modo local: no modo compartilhado o histórico é permanente (o botão fica oculto)
$('#btn-clear-log').onclick = async () => {
  if (isGestor() || !ApiClient.backend.limparHistorico) return;
  await ApiClient.backend.limparHistorico(DATA);
  setAuditLog([]);
  renderAuditPanel();
  showToast('Histórico limpo.', 'ok');
};

// Cada data tem a sua escala: trocar a data abre a escala daquela data (o gestor do modo compartilhado também navega).
// Data vazia ou que não carregou: o campo volta para a data aberta
$('#dt').onchange = e => {
  const data = e.target.value;
  if ((isGestor() && !modoCompartilhado()) || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    e.target.value = DATA;
    return;
  }
  carregarData(data).catch(() => {
    if (e.target.value === data) e.target.value = DATA;
    showToast('Não foi possível abrir essa data. Verifique a conexão e tente de novo.');
  });
};
// ‹ e ›: o dia anterior e o seguinte. Um clique no rótulo da data abre o calendário do navegador
const irParaDia = dias => {
  const dt = $('#dt');
  if (dt.disabled) return;
  dt.value = isoMenosDias(DATA, -dias);
  dt.dispatchEvent(new Event('change'));
};
$('#dt-ant').onclick = () => irParaDia(-1);
$('#dt-prox').onclick = () => irParaDia(1);
$('#dt').addEventListener('click', e => { try { e.target.showPicker(); } catch (x) {} });

// Menus suspensos (conta e "Mais" da Demanda): abrem e fecham no botão; Esc ou um clique fora fecham
function ligarMenu(botao, menu, { fecharAoEscolher = true } = {}) {
  const fechar = () => { menu.hidden = true; botao.setAttribute('aria-expanded', 'false'); };
  botao.onclick = () => {
    const abrir = menu.hidden;
    menu.hidden = !abrir;
    botao.setAttribute('aria-expanded', String(abrir));
    const primeiro = abrir && menu.querySelector('[role^="menuitem"]:not([hidden])');
    if (primeiro) primeiro.focus();
  };
  if (fecharAoEscolher) menu.addEventListener('click', e => { if (e.target.closest('[role="menuitem"]')) fechar(); });
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target) && !botao.contains(e.target)) fechar(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || menu.hidden) return;
    fechar();
    botao.focus();
  });
  return fechar;
}
ligarMenu($('#btn-menu-conta'), $('#menu-conta'));
// "Limpar demanda" pede confirmação no próprio menu (dois cliques): o menu só fecha depois
const fecharMenuMais = ligarMenu($('#btn-mais-dem'), $('#menu-mais-dem'), { fecharAoEscolher: false });

// "Pôr um aluno na demanda": quem ainda não voa passa a voar na data, com o pedido que já tinha
function incluirAluno() {
  const campo = $('#incluir-aluno');
  const nome = campo.value.trim().toLowerCase();
  if (!nome || isGestor()) return;
  const s = S.stu.find(x => x.nm.toLowerCase() === nome);
  if (!s) { showToast('Aluno não encontrado. Cadastre-o na aba Alunos.'); return; }
  campo.value = '';
  if (s.fly) { showToast(`${s.nm} já está na demanda.`); return; }
  s.fly = true;
  save();
  logChange('inc', `${s.nm} incluído na demanda`, { kind: 'setFly', stuId: s.id, mid: 0, val: false, label: '↶ Reverter' });
  rDem();
  const linha = document.querySelector(`#dem tr[data-k="d"][data-id="${s.id}"][data-mid="0"]`);
  if (linha) linha.scrollIntoView({ block: 'center' });
}
$('#incluir-aluno').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  incluirAluno();
});
// Escolher um nome da lista inclui na hora
$('#incluir-aluno').addEventListener('input', e => { if (e.inputType === 'insertReplacementText') incluirAluno(); });

$('#bi-dt').onchange = () => carregarBI();
$('#bi-flt-eq').onchange = () => rBI();
$('#bi-flt-cat').onchange = () => rBI();
$('#flt-dem-mis').onchange = applyDemandFilters;
preencherFiltroDeHabilitacoes();
$('#flt-dem-mis').insertAdjacentHTML('beforeend', Object.keys(MIS).map(m => `<option value="${m}">${m}</option>`).join(''));
$('#flt-ins-hab').onchange = applyInstructorFilters;
$('#flt-esc-eq').onchange = () => rOut();
// Recursos: acrescentar um recurso à frota (matrícula, categoria e, no C152, "Só Parafuso")
function mostrarFormDoRecurso(abrir) {
  $('#form-recurso').hidden = !abrir;
  $('#btn-novo-recurso').setAttribute('aria-expanded', String(abrir));
  $('#rec-erro').textContent = '';
  if (!abrir) return;
  $('#form-recurso').reset();
  $('#rec-parafuso-rotulo').hidden = true;
  $('#rec-reg').focus();
}
$('#btn-novo-recurso').onclick = () => mostrarFormDoRecurso($('#form-recurso').hidden);
$('#rec-cancelar').onclick = () => mostrarFormDoRecurso(false);
$('#rec-tipo').onchange = () => {
  $('#rec-parafuso-rotulo').hidden = $('#rec-tipo').value !== 'C152';
  if ($('#rec-tipo').value !== 'C152') $('#rec-parafuso').checked = false;
};
$('#form-recurso').onsubmit = e => {
  e.preventDefault();
  if (isGestor()) return;
  const { recurso, erro } = novoRecurso(S.frota, { reg: $('#rec-reg').value, tipo: $('#rec-tipo').value, soParafuso: $('#rec-parafuso').checked });
  if (erro) { $('#rec-erro').textContent = erro; return; }
  S.frota.push(recurso);
  S.av[recurso.reg] = true;
  logChange('inc', `Recurso adicionado: ${recurso.reg} (${recurso.tipo}${recurso.soParafuso ? ', só Parafuso' : ''})`);
  save(); rRec();
  mostrarFormDoRecurso(false);
  showToast(`${recurso.reg} adicionado à frota.`, 'ok');
};

// Categoria (Escala, Recursos e BI); na Escala e no BI, o filtro de recurso mostra só os da categoria escolhida
$('#flt-esc-cat').innerHTML = opcoesDeCategoria();
$('#bi-flt-cat').innerHTML = opcoesDeCategoria();
$('#flt-rec-cat').innerHTML = opcoesDeCategoria({ comGround: false });
$('#flt-esc-cat').onchange = () => rOut();
$('#flt-rec-cat').onchange = () => rRevisao();

// Tema: um interruptor (sol e lua) no menu da conta. Sem escolha gravada, vale o tema do sistema
const temaEscuro = () => {
  const escolhido = document.documentElement.getAttribute('data-theme');
  return escolhido ? escolhido === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};
const mostrarTema = () => $('#btn-theme').setAttribute('aria-checked', String(temaEscuro()));
$('#btn-theme').onclick = () => {
  const proximo = temaEscuro() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', proximo);
  try { localStorage.setItem(ApiClient.KEY_THEME, proximo); } catch (e) {}
  mostrarTema();
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mostrarTema);

armed('#clr', 'Confirmar limpeza', () => {
  if (isGestor()) return;
  S.stu.forEach(d => { Object.assign(d, blank()); d.extra = []; });
  save(); rDem();
  logChange('exc', 'Demanda limpa');
  fecharMenuMais();
});

// Só no modo local: grava 30 dias simulados (marcados como simulados) nas datas que ainda não têm escala
armed('#btn-bi-sim', 'Confirmar simulação', async () => {
  if (isGestor() || modoCompartilhado()) return;
  const refStr = ($('#bi-dt') && $('#bi-dt').value) || ($('#dt') && $('#dt').value);
  const existentes = new Set((await ApiClient.backend.listarDias(isoMenosDias(refStr, 30), refStr)).map(d => d.data));
  const baseDate = new Date(refStr + 'T12:00:00');
  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  // Só missões que algum instrutor ativo pode fazer (sem checadores cadastrados, não há voo de cheque simulado)
  const allMis = Object.keys(MIS).filter(m => S.ins.some(x => x.on && MIS[m].eq.some(eq => podeFazer(x, m, eq))));
  const stuPool = S.stu.length ? S.stu : Array.from({ length: 15 }, (_, i) => ({ nm: pad(i) }));

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const d = new Date(baseDate.getTime() - dayOffset * 86400000);
    const iso = d.toISOString().slice(0, 10);
    if (existentes.has(iso)) continue;

    const flights = [];
    const numFlights = 10 + Math.floor(rnd() * 14);
    for (let f = 0; f < numFlights; f++) {
      const mis = pick([...allMis, 'Voo Local', 'Voo Local', 'Navegação', 'IFR']);
      const isGnd = isGroundMission(mis);
      const eqType = isGnd ? GROUND_EQ_TYPE : pick(MIS[mis].eq);
      // Um recurso da frota do tipo (o Parafuso no C152, num avião "Só Parafuso"); tipo sem recurso: sem esse voo.
      // Com um recurso só (a sala de Ground, o avião do Parafuso), não há sorteio
      const doTipo = isGnd ? [GROUND_REG] : matriculasDoTipo(S.frota, eqType, { parafuso: mis === 'Parafuso' });
      if (!doTipo.length) continue;
      const reg = doTipo.length === 1 ? doTipo[0] : pick(doTipo);
      // Grounds simulados com os instrutores menos habilitados (como os A01–A02 de antes)
      const qualIns = isGnd
        ? S.ins.filter(x => podeFazer(x, mis, eqType) && x.hab.length <= habilitacoesDoNivel(2).length)
        : S.ins.filter(x => podeFazer(x, mis, eqType));
      const ins = pick(qualIns.length ? qualIns : S.ins);
      const stu = pick(stuPool);
      const h = isGnd ? GROUND_DURATION_H : 1 + Math.floor(rnd() * 3);
      const durMin = isGnd ? GROUND_DURATION_MIN : h * 60;
      const w = mis === 'Noturno' ? 8 : Math.floor(rnd() * 7);
      flights.push({
        isGround: isGnd,
        classKey: isGnd ? `SIM_${iso}_${mis}_${w}_${ins.id}` : `SIM_${iso}_${f}`,
        w, a: T[w], b: T[w] + durMin,
        s: stu.nm, mis, h, ss: '1/1',
        r: reg, eqType, ins: ins.nm, status: 'Confirmado'
      });
    }
    await ApiClient.backend.gravar(`dia:${iso}`, { simulado: true, resultado: { out: flights, al: [], tot: numFlights, rej: 0, data: iso }, esquema: ESQUEMA });
  }
  await carregarBI();
  showToast('Histórico de 30 dias simulado.', 'ok');
});

// Só no modo local: remove os dias simulados (as escalas reais continuam)
armed('#btn-bi-clr', 'Confirmar limpeza', async () => {
  if (isGestor() || !ApiClient.backend.removerDiasSimulados) return;
  await ApiClient.backend.removerDiasSimulados();
  await carregarBI();
  showToast('Dias simulados removidos do BI.', 'ok');
});

// Minha conta: trocar a senha e o e-mail (modo compartilhado; vale para todos os perfis)
// Manual: abre de qualquer aba (as tabelas de regras são montadas uma vez, a partir do código)
rManual();
$('#btn-manual').onclick = () => {
  show('manual');
  try { window.scrollTo(0, 0); } catch (x) {}
};

$('#btn-conta').onclick = () => { show('conta'); abrirConta(); };
// Usuários (administrador): a mesma página, direto na lista de contas
$('#btn-usuarios').onclick = async () => {
  show('conta');
  await abrirConta();
  $('#usuarios').scrollIntoView({ block: 'start' });
};

$('#form-senha').onsubmit = async e => {
  e.preventDefault();
  const nova = $('#senha-nova').value;
  if (nova !== $('#senha-repetida').value) return mensagem('#senha-msg', 'As duas senhas novas não são iguais.');
  try {
    await ApiClient.alterarSenha($('#senha-atual').value, nova);
  } catch (err) {
    return mensagem('#senha-msg', {
      senha_atual: 'Senha atual incorreta.',
      weak_password: 'A nova senha precisa ter pelo menos 12 caracteres.',
      same_password: 'A nova senha precisa ser diferente da atual.'
    }[err.code] || 'Não foi possível trocar a senha. Verifique a conexão e tente de novo.');
  }
  $('#form-senha').reset();
  mensagem('#senha-msg', 'Senha trocada.', 'ok');
};

$('#form-email').onsubmit = async e => {
  e.preventDefault();
  const novo = $('#email-novo').value.trim().toLowerCase();
  if (novo === ApiClient.emailAtual) return mensagem('#email-msg', 'Este já é o seu e-mail.');
  try {
    await ApiClient.alterarEmail($('#email-senha').value, novo, window.location.origin + window.location.pathname);
  } catch (err) {
    return mensagem('#email-msg', {
      senha_atual: 'Senha atual incorreta.',
      email_exists: 'Já existe uma conta com este e-mail.'
    }[err.code] || 'Não foi possível pedir a troca do e-mail (o envio da confirmação falhou). Tente de novo mais tarde ou fale com um administrador.');
  }
  $('#form-email').reset();
  mensagem('#email-msg', `Enviamos um link de confirmação para ${ApiClient.emailAtual} e para ${novo}. O e-mail muda depois que os dois links forem abertos.`, 'ok');
};

// Usuários (só administradores; o servidor confere): criar e excluir contas
$('#nc-gerar').onclick = () => { $('#nc-senha').value = gerarSenha(); };
$('#form-nova-conta').onsubmit = async e => {
  e.preventDefault();
  const email = $('#nc-email').value.trim().toLowerCase();
  try {
    await ApiClient.criarConta({ email, senha: $('#nc-senha').value, perfil: $('#nc-perfil').value, nome: $('#nc-nome').value.trim() });
  } catch (err) {
    return mensagem('#nc-msg', {
      23505: 'Já existe uma conta com este e-mail.',
      22023: 'Confira o nome, o e-mail e a senha (pelo menos 12 caracteres).',
      42501: 'Só administradores criam contas.'
    }[err.code] || 'Não foi possível criar a conta. Verifique a conexão e tente de novo.');
  }
  $('#form-nova-conta').reset();
  mensagem('#nc-msg', `Conta criada para ${email}. Passe a senha inicial para a pessoa; ela pode trocar em “Minha conta”.`, 'ok');
  await carregarContas();
};

async function excluirConta(b) {
  if (!confirmado(b, 'Confirmar exclusão')) return;
  try {
    await ApiClient.excluirConta(b.dataset.id);
    showToast(`Conta de ${b.dataset.email} excluída.`, 'ok');
  } catch (err) {
    showToast(err.code === '22023' ? 'Não é possível excluir a própria conta.' : 'Não foi possível excluir a conta. Verifique a conexão e tente de novo.');
  }
  await carregarContas();
}

// Agenda: o calendário é livre para navegar (inclusive para o Gestor)
document.addEventListener('click', e => {
  const cal = e.target.closest('[data-cal]');
  if (!cal) return;
  if (cal.dataset.cal === 'mes') mudarMes(+cal.dataset.delta);
  else escolherDia(cal.dataset.dia);
});

// Demanda e Agenda: traz os pedidos da agenda da secretaria para a data aberta (só acrescenta; não importa o mesmo
// pedido de novo)
async function importarDaAgenda() {
  if (isGestor()) return;
  let solicitacoes;
  try {
    solicitacoes = await ApiClient.agenda(DATA, DATA);
  } catch (e) {
    showToast('Não foi possível ler a agenda. Verifique a conexão e tente de novo.');
    return;
  }
  const pendentes = solicitacoes.filter(s => !s.cancelada_em && !S.importadas.includes(s.id));
  if (!pendentes.length) {
    showToast(`Nenhum pedido novo na agenda para ${DATA.slice(8, 10)}/${DATA.slice(5, 7)}.`);
    return;
  }
  const resumo = importarSolicitacoes(S, pendentes, { situacao: (S.resultados && S.resultados.situacao) || [] });
  pendentes.filter(s => S.stu.some(x => x.id === s.aluno)).forEach(s => {
    logChange('inc', `Agenda: ${s.aluno_nome} incluído (${s.missao} · ${rotuloDaDisponibilidade(disponibilidadeDaSolicitacao(s))})`);
  });
  save(); rDem(); rAgenda();
  showToast(`${resumo.novos + resumo.atualizados} pedido(s) da agenda na demanda` +
    (resumo.semAluno ? ` · ${resumo.semAluno} de aluno que não está mais no cadastro` : '') + '.', 'ok');
}
$('#importar-agenda').onclick = importarDaAgenda;
$('#agenda-importar').onclick = importarDaAgenda;

// Agenda: registrar um pedido (pela exceção da coordenação, fora do prazo) e cancelar (com confirmação)
async function registrarPedido(excecao) {
  if (!podeEditarAgenda()) return;
  $('#ag-erro').textContent = '';
  const aluno = S.stu.find(s => s.id === +$('#ag-aluno').value);
  const por = $('#ag-por').value.trim();
  if (!aluno || !por) {
    $('#ag-erro').textContent = 'Escolha o aluno e informe quem anotou o pedido (“Registrado por”).';
    return;
  }
  const janela = $('#ag-janela').value;
  try {
    await ApiClient.registrarSolicitacao({
      data: diaDaAgenda(), aluno: aluno.id, aluno_nome: aluno.nm, missao: $('#ag-missao').value, janela,
      horario: janela === 'horario' ? $('#ag-horario').value : null, observacao: $('#ag-obs').value, registrado_por: por, excecao
    });
  } catch (err) {
    $('#ag-erro').textContent = {
      PT403: 'Prazo encerrado: pedido para o dia seguinte só até as 13:00 do dia anterior.',
      42501: 'Esta conta não pode registrar este pedido (a Exceção da Coordenação é só para operadores).',
      23514: 'Pedido incompleto: confira aluno, missão, disponibilidade e quem anotou.'
    }[err.code] || 'Não foi possível registrar o pedido. Verifique a conexão e tente de novo.';
    return;
  }
  lembrarRegistradoPor(por);
  $('#ag-obs').value = '';
  $('#ag-aluno').value = '';
  showToast(excecao ? 'Pedido registrado pela Exceção da Coordenação.' : 'Pedido registrado.', 'ok');
  await carregarMes();
  lerPedidosDaData();
}
$('#form-agenda').onsubmit = e => { e.preventDefault(); registrarPedido(false); };
$('#ag-excecao').onclick = () => registrarPedido(true);
$('#ag-janela').onchange = () => { $('#ag-horario-rotulo').hidden = $('#ag-janela').value !== 'horario'; };
$('#ag-missao').onchange = preencherHorariosDaAgenda;

async function cancelarPedido(b) {
  if (!podeEditarAgenda() || !confirmado(b, 'Confirmar cancelamento')) return;
  const por = $('#ag-por').value.trim();
  if (!por) {
    $('#ag-erro').textContent = 'Informe seu nome em “Registrado por” para cancelar o pedido.';
    return;
  }
  try {
    await ApiClient.cancelarSolicitacao(+b.dataset.id, por);
    showToast('Pedido cancelado.', 'ok');
  } catch (err) {
    $('#ag-erro').textContent = 'Não foi possível cancelar o pedido. Verifique a conexão e tente de novo.';
  }
  await carregarMes();
  lerPedidosDaData();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  if (b.dataset.act === 'cancelar-pedido') { cancelarPedido(b); return; }
  if (b.dataset.act === 'excluir-conta') { excluirConta(b); return; }
  if (isGestor()) { e.preventDefault(); return; }
  const a = b.dataset.act, c = b.closest('[data-k]'), id = c ? +c.dataset.id : +b.dataset.id || 0;
  const mid = b.dataset.mid !== undefined ? +b.dataset.mid : (c && c.dataset.mid !== undefined ? +c.dataset.mid : 0);

  // A próxima missão do curso (fase 14): o pedido vira a missão do programa (tipo, recurso e horas) e o aluno voa
  if (a === 'usar-proxima') {
    const s = stuBy(id), target = getMissionTarget(id, mid);
    const m = s && target ? proximaDoPedido(s, mid) : null;
    if (!m) return;
    Object.assign(target, { fly: true, mis: m.mis, eq: m.eq, nb: m.nb, etapa: m.id });
    ajustarPreferencias(target, horariosDaMissao(S.horarios, target.mis, target.eq));
    normalizeMissionFields(target);
    logChange('inc', `${s.nm}: ${m.id} na demanda (${m.mis} · ${m.eq} · ${fmtDurLabel(m.nb)})`);
    save(); rDem();
    return;
  }

  if (a === 'add-mis') {
    const s = stuBy(id);
    if (!s) return;
    if (!Array.isArray(s.extra)) s.extra = [];
    const newEx = {
      mid: S.nid++,
      fly: true,
      mis: 'Voo Local',
      eq: 'C152',
      p1: T[4],
      p2: T[6],
      nb: 1,
      ss: 1,
      pr: s.pr || 3
    };
    s.extra.push(newEx);
    save();
    rDem();
    logChange('inc', `Missão extra adicionada para ${s.nm}`);
    showToast(`Nova missão adicionada para ${s.nm}.`, 'ok');
    return;
  }

  // Um clique no detalhe do status (motivo ou nova decolagem) permite alterá-lo; o status continua o mesmo
  if (a === 'detalhe-status') {
    const fKey = b.dataset.fkey, status = S.fStatus && S.fStatus[fKey], voo = vooDaChave(fKey);
    if (!voo || !STATUS_COM_DETALHE.includes(status)) return;
    pedirDetalheDoStatus({ voo, status, detalhe: S.fObs && S.fObs[fKey], aoConfirmar: detalhe => aplicarStatus(fKey, status, detalhe) });
    return;
  }

  if (a === 'del-mis') {
    const s = stuBy(id);
    if (!s || !Array.isArray(s.extra)) return;
    s.extra = s.extra.filter(ex => ex.mid !== mid);
    save();
    rDem();
    logChange('exc', `Missão extra removida de ${s.nm}`);
    return;
  }

  if (a === 'rm-fly') {
    const s = stuBy(id);
    const target = getMissionTarget(id, mid);
    if (!s || !target || !target.fly) return;
    target.fly = false;
    save();
    logChange('exc', `Tirado da escala: ${s.nm} (${target.mis} · ${target.eq})`, {
      kind: 'setFly', stuId: s.id, mid, val: true, label: '↶ Restaurar'
    });
    rDem();
    showToast(`Tirado da escala: ${s.nm} (${target.mis}).`, 'ok');
    return;
  }

  // Reverter registra uma nova entrada que aponta a revertida (o histórico só cresce)
  if (a === 'rev-log') {
    const logId = +b.dataset.logid;
    const entry = AUDIT_LOG.find(x => x.id === logId);
    if (!entry || !entry.revert) return;
    const rev = entry.revert;

    if (rev.kind === 'setFly') {
      const st = stuBy(rev.stuId);
      const target = getMissionTarget(rev.stuId, rev.mid || 0);
      if (st && target) {
        target.fly = rev.val;
        logChange(rev.val ? 'inc' : 'exc', `Revertido: ${st.nm} (${target.mis})`, null, entry.id);
        save(); rDem();
      }
    } else if (rev.kind === 'setAv') {
      S.av[rev.reg] = rev.val;
      logChange(rev.val ? 'inc' : 'exc', `Revertido: ${rev.reg} ${rev.val ? 'disponível' : 'em manutenção'}`, null, entry.id);
      save(); rRec();
    } else if (rev.kind === 'setInsOn') {
      const ins = insBy(rev.insId);
      if (ins) {
        ins.on = rev.val;
        logChange(rev.val ? 'inc' : 'exc', `Revertido: ${ins.nm} ${rev.val ? 'disponível' : 'indisponível'}`, null, entry.id);
        save(); rIns();
      }
    } else if (rev.kind === 'restaurarFixos' && rev.fixos && typeof rev.fixos === 'object') {
      // Um reparo desfeito: os voos voltam a ser fixos como antes dele
      S.fixos = normalizarFixos({ ...(S.fixos || {}), ...rev.fixos });
      logChange('mod', `Revertido: ${entry.desc}`, null, entry.id);
      save();
    } else if (rev.kind === 'readicionarRecurso' && rev.recurso && !S.frota.some(f => f.reg === rev.recurso.reg)) {
      // Um recurso retirado volta para a frota, como estava
      S.frota.push({ ...rev.recurso });
      S.av[rev.recurso.reg] = rev.av !== false;
      logChange('inc', `Revertido: ${rev.recurso.reg} de volta à frota`, null, entry.id);
      save(); rRec();
    }
    return;
  }

  // Horários de decolagem de uma categoria (Recursos); os pedidos dela acompanham (o horário mais próximo da lista nova)
  if (a === 'remover-horario' || a === 'adicionar-horario' || a === 'horarios-padrao' || a === 'horarios-30') {
    const cat = b.dataset.cat;
    const nome = NOMES_DAS_CATEGORIAS[cat];
    const atual = (S.horarios && S.horarios[cat]) || [];
    let lista, descricao;
    if (a === 'remover-horario') {
      if (atual.length <= 1) { showToast('Cada categoria precisa de pelo menos um horário.'); return; }
      lista = atual.filter(m => m !== +b.dataset.min);
      descricao = `sem ${hm(+b.dataset.min)}`;
    } else if (a === 'adicionar-horario') {
      const minuto = paraMinuto(b.closest('.horarios-cat').querySelector('.hr-novo').value);
      if (minuto === null || minuto < 6 * 60 || minuto > 17 * 60) { showToast('Escolha um horário entre 06:00 e 17:00.'); return; }
      lista = [...new Set([...atual, minuto])].sort((x, y) => x - y);
      descricao = `com ${hm(minuto)}`;
    } else if (a === 'horarios-padrao') {
      lista = [...HORARIOS_PADRAO];
      descricao = 'as janelas do dia';
    } else {
      lista = [...DE_30_EM_30];
      descricao = 'de 30 em 30 minutos';
    }
    S.horarios = { ...S.horarios, [cat]: lista };
    S.stu.forEach(s => [s, ...(s.extra || [])].forEach(p => {
      if (categoriaDoTipo(p.eq) === cat) ajustarPreferencias(p, horariosDaMissao(S.horarios, p.mis, p.eq));
    }));
    logChange('mod', `Horários de decolagem do ${nome}: ${descricao}`);
    save(); rRec(); rDem();
    return;
  }

  // Retirar um recurso da frota (pede confirmação; o histórico desfaz)
  if (a === 'retirar-recurso') {
    if (!confirmado(b, 'Confirmar retirada')) return;
    const recurso = S.frota.find(f => f.reg === b.dataset.id);
    if (!recurso) return;
    S.frota = S.frota.filter(f => f !== recurso);
    logChange('exc', `Recurso retirado: ${recurso.reg} (${recurso.tipo})`, {
      kind: 'readicionarRecurso', recurso: { ...recurso }, av: S.av[recurso.reg] !== false, label: '↶ Reverter'
    });
    save(); rRec();
    showToast(`${recurso.reg} retirado da frota.`, 'ok');
    return;
  }

  // Hangar: sobe, desce ou põe na frente um avião (na data aberta; a data seguinte começa com esta ordem)
  if (a === 'hangar-subir' || a === 'hangar-descer' || a === 'hangar-frente') {
    const r = b.dataset.id;
    S.hangar = moverNoHangar(normalizarHangar(S.hangar, S.frota), r, a.slice('hangar-'.length));
    logChange('mod', `Hangar: ${r} passou para ${S.hangar.indexOf(r) + 1}º`);
    save();
    rHangar();
    return;
  }

  // Rodízio: ajusta a posição de um instrutor na fila da categoria (na data aberta)
  if (a === 'fila-subir' || a === 'fila-descer' || a === 'fila-inicio') {
    const cat = b.dataset.cat, insId = +b.dataset.id;
    S.filas = ajustarFilas(S.filas, S.ins);
    const fila = S.filas[cat].filter(x => x !== insId);
    const antes = S.filas[cat].indexOf(insId);
    const depois = a === 'fila-inicio' ? 0 : Math.max(0, Math.min(fila.length, antes + (a === 'fila-subir' ? -1 : 1)));
    fila.splice(depois, 0, insId);
    S.filas[cat] = fila;
    const categoria = CATEGORIAS_DO_RODIZIO.find(c => c.id === cat);
    logChange('mod', `Rodízio · ${categoria.nome}: ${insBy(insId).nm} passou para ${depois + 1}º`);
    save();
    rRodizio();
    return;
  }

  // Revisão de 50 horas feita: as horas do avião desde a última revisão voltam a zero (pede confirmação)
  if (a === 'revisao') {
    if (isGestor() || !confirmado(b, 'Confirmar revisão')) return;
    S.horas[b.dataset.id] = 0;
    logChange('mod', `${b.dataset.id}: revisão de 50 horas feita (horas zeradas)`);
    save(); rRec();
    return;
  }

  if (a === 'editar-habs') {
    abrirPainelDoInstrutor(+b.dataset.id);
    return;
  }

  // O instrutor novo aparece no cadastro, com o nome selecionado para digitar
  if (a === 'addi') {
    const newIns = { id: S.nid++, nm: 'Novo instrutor', on: true, hab: habilitacoesDoNivel(1), kg: 0, aw: WIN.map((_, i) => i < 8) };
    S.ins.push(newIns);
    mostrarVistaDosInstrutores('cadastro');
    save(); rIns(); rAlu(); focusLast('#inst .nm');
    logChange('inc', `Instrutor adicionado: ${newIns.nm}`);
  } else if (a === 'adds') {
    const newStu = { id: S.nid++, nm: 'Novo aluno', kg: 0, bl: [], extra: [], ...blank() };
    S.stu.push(newStu);
    save(); rAlu(); rDem(); focusLast('#alu .nm');
    logChange('inc', `Aluno cadastrado: ${newStu.nm}`);
  } else if (a === 'unbl') {
    const s = stuBy(id);
    const blkIns = insBy(+b.dataset.b);
    s.bl = s.bl.filter(v => v !== +b.dataset.b);
    save(); atualizarLinhaDoAluno(s, { naoEscalar: true });
    logChange('mod', `${s.nm}: volta a ser escalado com ${blkIns ? blkIns.nm : ''}`);
  } else if (a === 'deli' || a === 'dels') {
    if (activeTimers.has(b)) clearTimeout(activeTimers.get(b));
    if (!b.dataset.arm) {
      b.dataset.arm = 1; b.textContent = 'Confirmar'; b.classList.add('arm');
      const tid = setTimeout(() => { b.dataset.arm = ''; b.textContent = '✕'; b.classList.remove('arm'); activeTimers.delete(b); }, 3000);
      activeTimers.set(b, tid);
      return;
    }
    activeTimers.delete(b);
    if (a === 'deli') {
      const target = insBy(id);
      if (+$('#painel-instrutor').dataset.id === id) fecharPainelDoInstrutor();
      S.ins = S.ins.filter(x => x.id !== id);
      S.stu.forEach(s => s.bl = s.bl.filter(v => v !== id));
      logChange('exc', `Instrutor excluído: ${target ? target.nm : id}`);
    } else {
      const target = stuBy(id);
      S.stu = S.stu.filter(x => x.id !== id);
      logChange('exc', `Aluno excluído: ${target ? target.nm : id}`);
    }
    save(); rIns(); rAlu(); rDem();
  }
});

// Aprovar a escala (fase 12): todos os voos ficam fixos e o selo diz quando e quem aprovou. Reabrir solta os voos: a
// escala volta a ser refeita inteira a cada alteração. Os dois pedem confirmação
document.addEventListener('click', e => {
  const aprovar = e.target.closest('#btn-aprovar'), reabrir = e.target.closest('#btn-reabrir');
  if ((!aprovar && !reabrir) || isGestor() || !RES) return;
  if (aprovar) {
    if (!confirmado(aprovar, 'Confirmar aprovação')) return;
    S.fixos = Object.fromEntries(RES.out.map(o => [o.fKey, pinoDoVoo(o)]));
    S.aprovacao = { em: new Date().toISOString(), por: ApiClient.autorAtual || '' };
    save();
    logChange('mod', `Escala aprovada: ${RES.out.length} ${RES.out.length === 1 ? 'voo fixado' : 'voos fixados'}`);
    showToast('Escala aprovada: os voos ficam fixos.', 'ok');
  } else {
    if (!confirmado(reabrir, 'Confirmar reabertura')) return;
    S.fixos = {};
    S.aprovacao = null;
    save();
    logChange('mod', 'Escala reaberta: volta a ser refeita a cada alteração');
    showToast('Escala reaberta.', 'ok');
  }
});

// O programa dos cursos (fase 14), em Alunos › Cursos: só o Administrador (neste navegador, o Operador) muda. Incluir,
// subir, descer e tirar (com confirmação) refazem a tabela; os campos mudam no lugar. O código vale uma vez por curso
const ondeNoPrograma = el => { const tr = el.closest('tr[data-curso]'); return { curso: tr.dataset.curso, i: +tr.dataset.i, tr }; };
const gravarPrograma = (curso, lista) => { S.cursos = normalizarCursos({ ...normalizarCursos(S.cursos), [curso]: lista }); save(); };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act^="curso-"]');
  if (!b || !podeEditarCursos()) return;
  const a = b.dataset.act;
  if (a === 'curso-nova') {
    const curso = b.dataset.curso, lista = normalizarCursos(S.cursos)[curso];
    const nova = novaMissaoDoCurso(curso, lista);
    gravarPrograma(curso, [...lista, nova]);
    logChange('inc', `Programa do ${curso}: ${nova.id} incluída`);
    rCursos();
    $(`#cursos tr[data-curso="${curso}"][data-i="${lista.length}"] [data-cf="nome"]`).focus();
    return;
  }
  const { curso, i } = ondeNoPrograma(b);
  const lista = normalizarCursos(S.cursos)[curso], m = lista[i];
  if (!m) return;
  if (a === 'curso-remover') {
    if (!confirmado(b, 'Confirmar')) return;
    gravarPrograma(curso, lista.filter((_, j) => j !== i));
    logChange('exc', `Programa do ${curso}: ${m.id} removida`);
    rCursos();
    return;
  }
  const j = a === 'curso-subir' ? i - 1 : i + 1;
  if (j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  gravarPrograma(curso, lista);
  logChange('mod', `Programa do ${curso}: ${m.id} passou para ${j + 1}ª`);
  rCursos();
  const mesmo = $(`#cursos tr[data-curso="${curso}"][data-i="${j}"] [data-act="${a}"]`);
  (mesmo && !mesmo.disabled ? mesmo : $(`#cursos tr[data-curso="${curso}"][data-i="${j}"] [data-cf="id"]`)).focus();
});
document.addEventListener('change', e => {
  const campo = e.target.closest('#cursos [data-cf]');
  if (!campo || !podeEditarCursos()) return;
  const { curso, i, tr } = ondeNoPrograma(campo);
  const lista = normalizarCursos(S.cursos)[curso];
  if (!lista[i]) return;
  const m = { ...lista[i] }, cf = campo.dataset.cf;
  if (cf === 'id') {
    const id = campo.value.trim().toUpperCase();
    const erro = !codigoValido(id) ? 'O código da missão usa letras, números, ponto e hífen (até 15).'
      : lista.some((o, j) => j !== i && o.id === id) ? `O código ${id} já existe no ${curso}.` : '';
    if (erro) { showToast(erro); campo.value = m.id; return; }
    m.id = id;
  } else {
    m[cf] = cf === 'nb' ? +campo.value : campo.value;
  }
  lista[i] = m;
  gravarPrograma(curso, lista);
  const salvo = normalizarCursos(S.cursos)[curso][i];
  atualizarLinhaDoPrograma(tr, salvo);
  logChange('mod', `Programa do ${curso}: ${salvo.id} alterada`);
});

// Critérios da compactação (fase 13): a escala é refeita com o critério novo (com a escala aprovada, não mudam)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-criterio]');
  if (!b || b.disabled || isGestor() || S.aprovacao) return;
  const campo = b.dataset.criterio, antes = normalizarCriterios(S.criterios);
  if (antes[campo] === b.dataset.valor) return;
  S.criterios = normalizarCriterios({ ...antes, [campo]: b.dataset.valor });
  const opcoes = campo === 'buracos' ? OPCOES_DE_BURACOS : OPCOES_DE_HORARIOS;
  const nome = id => opcoes.find(([v]) => v === id)[1];
  save();
  logChange('mod', `Compactação: ${campo === 'buracos' ? 'buracos' : 'horários'} ${nome(antes[campo])} → ${nome(S.criterios[campo])}`);
});

// O resultado da missão do curso (fase 14), na linha do voo: vai para o servidor (só acréscimo) e entra na situação do
// aluno (o progresso e a próxima missão mudam). Sem conexão, o seletor volta ao que estava
document.addEventListener('change', async e => {
  const sel = e.target.closest('[data-resultado]');
  if (!sel || isGestor()) return;
  const o = vooDaChave(sel.dataset.resultado), stu = o ? stuBy(o.stuId) : null;
  if (!o || !o.etapa || !stu || !stu.curso) return;
  const registro = { aluno: o.stuId, curso: stu.curso, missao: o.etapa, resultado: sel.value, data: DATA, voo: o.fKey };
  sel.disabled = true;
  try {
    const id = await ApiClient.registrarResultado(registro);
    const novo = { id, ...registro, registrado_em: new Date().toISOString(), registrado_por: ApiClient.autorAtual || null };
    const atual = S.resultados || { situacao: [], doDia: [] };
    const mesmaMissao = r => r.aluno === novo.aluno && r.curso === novo.curso && r.missao === novo.missao;
    S.resultados = { situacao: [...atual.situacao.filter(r => !mesmaMissao(r)), novo], doDia: [...atual.doDia, novo] };
    logChange('mod', `Resultado de ${o.s} em ${o.etapa}: ${sel.value}`);
  } catch (err) {
    showToast('Não foi possível registrar o resultado. Verifique a conexão e tente de novo.');
  }
  rOut(); rAlu(); rDem();
});

// Sugestões para um conflito (fase 12): a gaveta abre pelo botão do conflito. "Aplicar" muda o voo fixo (na turma de
// Ground, a turma inteira) e o histórico guarda os fixos de antes, para reverter; cancelar abre o diálogo do status, já
// com o motivo do conflito marcado
document.addEventListener('click', e => {
  const abrirSugestoes = e.target.closest('[data-reparo]');
  if (abrirSugestoes) { if (!isGestor()) abrirPainelDeReparo(abrirSugestoes.dataset.reparo); return; }
  if (e.target.closest('#btn-fechar-reparo')) { fecharPainelDeReparo(true); return; }
  const botao = e.target.closest('[data-reparo-aplicar]');
  if (!botao || isGestor()) return;
  const escolha = opcaoDoPainel(+botao.dataset.reparoAplicar);
  if (!escolha) return;
  const { fKey, voo, opcao } = escolha;
  fecharPainelDeReparo();
  if (!opcao.mudancas) {
    pedirDetalheDoStatus({ voo, status: 'Cancelado', detalhe: opcao.motivo ? { motivo: opcao.motivo } : null, aoConfirmar: detalhe => aplicarStatus(fKey, 'Cancelado', detalhe) });
    return;
  }
  const antes = S.fixos || {};
  S.fixos = aplicarReparo(antes, RES, fKey, opcao);
  const mudados = Object.keys(S.fixos).filter(k => S.fixos[k] !== antes[k]);
  save();
  logChange('mod', `Reparo: ${voo.s} (${hm(voo.a)}–${hm(voo.b)}): ${opcao.texto}`, {
    kind: 'restaurarFixos', fixos: Object.fromEntries(mudados.map(k => [k, antes[k]])), label: '↶ Reverter'
  });
  showToast('Sugestão aplicada: o voo continua fixo.', 'ok');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && painelDeReparoAberto() && !dialogoDeStatusAberto()) fecharPainelDeReparo(true);
});

// Status do voo: Atrasado e Cancelado pedem o detalhe (a nova decolagem ou o motivo) antes de valer; desistir deixa o
// status anterior. O histórico registra só a categoria do motivo
const vooDaChave = fKey => (RES && Array.isArray(RES.out) ? RES.out.find(o => o.fKey === fKey) : null);
function aplicarStatus(fKey, status, detalhe) {
  if (!S.fStatus) S.fStatus = {};
  if (!S.fObs) S.fObs = {};
  S.fStatus[fKey] = status;
  if (detalhe) S.fObs[fKey] = detalhe;
  else delete S.fObs[fKey];
  const voo = vooDaChave(fKey);
  if (voo) voo.status = status;
  // Em Voo e Atrasado fixam o voo (fase 12): uma alteração na escala não o tira do lugar
  if (voo && (status === 'Em Voo' || status === 'Atrasado')) S.fixos = { ...(S.fixos || {}), [fKey]: S.fixos && S.fixos[fKey] ? S.fixos[fKey] : pinoDoVoo(voo) };
  save();
  logChange('mod', `Status de ${voo ? `${voo.s} (${hm(voo.a)}–${hm(voo.b)})` : fKey}: ${textoParaOHistorico(status, detalhe)}`);
}
function mudarStatus(fKey, status) {
  const voo = vooDaChave(fKey);
  if (!voo || !STATUS_COM_DETALHE.includes(status)) { aplicarStatus(fKey, status, null); return; }
  pedirDetalheDoStatus({ voo, status, aoConfirmar: detalhe => aplicarStatus(fKey, status, detalhe), aoDesistir: () => rOut() });
}

// Limites da lei (fase 11), no cadastro dos instrutores: só o Administrador muda (neste navegador, o Operador). Vazio é
// sem limite; os campos em horas viram minutos onde o limite é guardado em minutos
const ROTULOS_DOS_LIMITES = { vooPorJornadaMin: 'voo por jornada', jornadaMin: 'jornada', vooMesH: 'voo no mês', vooSemestreH: 'voo no semestre', vooAnoH: 'voo no ano', repousoMin: 'repouso' };
const emHoras = (chave, valor) => (valor === null ? 'sem limite' : `${String(chave.endsWith('Min') ? valor / 60 : valor).replace('.', ',')} h`);
document.addEventListener('change', e => {
  const campo = e.target.closest('[data-limite]');
  if (!campo || !podeEditarLimites()) return;
  const chave = campo.dataset.limite, divisor = +campo.dataset.divisor;
  const antes = normalizarLimites(S.limites);
  const valor = campo.value.trim() === '' ? null : Math.max(0, +campo.value) * divisor;
  if (valor !== null && !Number.isFinite(valor)) { rLimites(); return; }
  S.limites = normalizarLimites({ ...antes, [chave]: valor });
  logChange('mod', `Limites da lei: ${ROTULOS_DOS_LIMITES[chave]} ${emHoras(chave, antes[chave])} → ${emHoras(chave, S.limites[chave])}`);
  save();
  rLimites();
});
document.addEventListener('click', e => {
  if (!e.target.closest('[data-limites-padrao]') || !podeEditarLimites()) return;
  S.limites = { ...LIMITES_DA_LEI };
  logChange('mod', 'Limites da lei: de volta aos valores da lei');
  save();
  rLimites();
});

// Sincronização em tempo real de alterações (com trava estrita para Perfil Gestor e Links Compartilhados)
document.addEventListener('change', e => {
  const t = e.target, f = t.dataset.f, a = t.dataset.a;
  if (t.id === 'onlyfly') { $('#dem').classList.toggle('only', t.checked); return; }

  // Trava de segurança: impede qualquer mutação de estado se estiver em modo Gestor
  if ((a || f) && isGestor()) {
    e.preventDefault();
    rRec(); rIns(); rAlu(); rDem();
    if (RES) rOut();
    return;
  }

  if (f === 'fstatus') {
    mudarStatus(t.dataset.fkey, t.value);
    return;
  }

  if (a) {
    if (a === 'win') {
      const idx = +t.dataset.i;
      S.win[idx] = t.checked;
      logChange(t.checked ? 'inc' : 'exc', `Janela ${WIN[idx]} ${t.checked ? 'ativa' : 'inativa'}`);
    } else if (a === 'av') {
      const reg = t.dataset.id;
      S.av[reg] = t.checked;
      logChange(t.checked ? 'inc' : 'exc', `${reg}: ${t.checked ? 'Disponível' : 'Manutenção'}`, {
        kind: 'setAv', reg, val: !t.checked, label: '↶ Reverter'
      });
    } else if (a === 'horas') {
      // Horas desde a última revisão de 50 horas; vazio: sem controle para o avião
      const reg = t.dataset.horas;
      const horas = t.value === '' ? null : Math.round(Math.max(0, +t.value) * 10) / 10;
      if (horas === null || Number.isNaN(horas)) delete S.horas[reg];
      else S.horas[reg] = horas;
      logChange('mod', `${reg}: ${horas === null || Number.isNaN(horas) ? 'horas desde a revisão não informadas' : fmtH(horas) + ' desde a última revisão de 50 horas'}`);
    }
    save(); rRec();
    return;
  }

  const c = t.closest('[data-k]');
  if (!c || !f) return;
  const k = c.dataset.k, id = +c.dataset.id;
  const mid = c.dataset.mid !== undefined ? +c.dataset.mid : 0;

  if (k === 'i') {
    const x = insBy(id);
    if (f === 'on') {
      x.on = t.checked;
      logChange(t.checked ? 'inc' : 'exc', `${x.nm}: ${t.checked ? 'Disponível' : 'Indisponível'}`, {
        kind: 'setInsOn', insId: x.id, val: !t.checked, label: '↶ Reverter'
      });
    } else if (f === 'nm') {
      const old = x.nm;
      x.nm = t.value.trim() || x.nm;
      logChange('mod', `Instrutor: ${old} → ${x.nm}`);
    } else if (f === 'kg') {
      x.kg = +t.value || 0;
      logChange('mod', `Peso ${x.nm}: ${x.kg} kg`);
    } else if (f === 'hab') {
      const h = t.dataset.h;
      x.hab = normalizarHabilitacoes(t.checked ? [...x.hab, h] : x.hab.filter(k => k !== h));
      logChange('mod', `Habilitação ${t.checked ? 'incluída' : 'retirada'}: ${x.nm} · ${nomeDaHabilitacao(h)}`);
    } else if (f === 'ext-mes' || f === 'ext-ano') {
      // Horas de voo fora do app (limites da lei): neste mês ou, no ano, antes deste mês
      const chave = f === 'ext-mes' ? DATA.slice(0, 7) : `${DATA.slice(0, 4)}-00`;
      const horas = Math.round(Math.min(2000, Math.max(0, +t.value || 0)) * 10) / 10;
      x.horasExternas = { ...(x.horasExternas || {}) };
      if (horas > 0) x.horasExternas[chave] = horas;
      else delete x.horasExternas[chave];
      if (!Object.keys(x.horasExternas).length) delete x.horasExternas;
      S.horasDosInstrutores = comHorasExternas(S.horasBase || {}, S.ins, DATA);
      logChange('mod', `Horas de voo fora do app de ${x.nm} (${f === 'ext-mes' ? 'neste mês' : 'no ano, antes deste mês'}): ${String(horas).replace('.', ',')} h`);
      save();
      rPainelDoInstrutor();
      return;
    } else if (f === 'aw') {
      x.aw[+t.dataset.w] = t.checked;
    } else if (f === 'pre') {
      if (!t.value) return;
      x.aw = WIN.map((_, i) => PRE[t.value].includes(i));
    }
    // A grade do dia é refeita com a escala; a linha do cadastro é atualizada no lugar
    save();
    atualizarLinhaDoCadastro(x);
    if (f === 'nm') rAlu();
  } else {
    const s = stuBy(id);
    if (k === 's') {
      if (f === 'nm') {
        const old = s.nm;
        s.nm = t.value.trim() || s.nm;
        logChange('mod', `Aluno: ${old} → ${s.nm}`);
      } else if (f === 'kg') {
        s.kg = +t.value || 0;
        logChange('mod', `Peso ${s.nm}: ${s.kg} kg`);
      } else if (f === 'bl' && t.value) {
        s.bl.push(+t.value);
        const ins = insBy(+t.value);
        logChange('exc', `${s.nm}: não escalar com ${ins ? ins.nm : ''}`);
      } else if (f === 'curso') {
        // O curso do aluno (fase 14)
        const curso = normalizarCursoDoAluno(t.value);
        if (curso) s.curso = curso;
        else delete s.curso;
        logChange('mod', `Curso de ${s.nm}: ${curso || 'nenhum'}`);
      }
      save(); atualizarLinhaDoAluno(s, { naoEscalar: f === 'bl' });
      if (f === 'nm') rDem();
    } else {
      const target = getMissionTarget(id, mid);
      if (!target) return;
      if (f === 'fly') {
        target.fly = t.checked;
        logChange(
          target.fly ? 'inc' : 'exc',
          `${s.nm} ${target.fly ? 'incluído' : 'retirado'} (${target.mis} · ${target.eq} · ${fmtDurLabel(target.nb)})`,
          { kind: 'setFly', stuId: s.id, mid, val: !target.fly, label: target.fly ? '✕ Excluir' : '↶ Restaurar' }
        );
      } else if (f === 'jan') {
        // Disponibilidade do aluno: o voo só começa nessas janelas (vazio: qualquer horário)
        if (t.value) target.jan = t.value;
        else delete target.jan;
        logChange('mod', `Pedido ${s.nm}: disponibilidade ${rotuloDaDisponibilidade(target.jan)} (${target.mis})`);
      } else {
        target[f] = (f === 'mis' || f === 'eq') ? t.value : +t.value;
        // Missão, recurso ou horas mudados à mão: o pedido deixa de ser a missão do curso (fase 14)
        if (['mis', 'eq', 'nb'].includes(f)) delete target.etapa;
        if (f === 'mis') {
          const mRule = MIS[target.mis] || MIS['Voo Local'];
          if (!mRule.eq.includes(target.eq)) {
            target.eq = mRule.defEq;
          }
          if (mRule.isGround) {
            target.eq = GROUND_EQ_TYPE;
            target.nb = GROUND_DURATION_H;
          } else if (+target.nb === GROUND_DURATION_H || !Number.isInteger(+target.nb)) {
            target.nb = 1;
          }
        }
        // Os horários da missão e do avião novos (o Noturno sai às 17:30; o PA-34 tem os seus)
        if (f === 'mis' || f === 'eq') ajustarPreferencias(target, horariosDaMissao(S.horarios, target.mis, target.eq));
        logChange('mod', `Pedido ${s.nm}: ${target.mis} · ${target.eq} · ${fmtDurLabel(target.nb)}`);
      }
      save();
      c.outerHTML = singleDemandRowHTML(s, target, mid);
      cnt();
      renderAuditPanel();
    }
  }
});

// Inicialização Assíncrona
(async function bootstrap() {
  try {
    const savedTheme = localStorage.getItem(ApiClient.KEY_THEME);
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  } catch (e) {}
  mostrarTema();

  const amanha = amanhaISO();
  abrirData(amanha);

  const params = new URLSearchParams(window.location.search);
  const pedida = params.get('data');
  const data = /^\d{4}-\d{2}-\d{2}$/.test(pedida || '') ? pedida : amanha;

  // Sessão e dados. Se algo falhar (sem conexão, conversão pela metade), o app não abre com dados incompletos:
  // fica o aviso para recarregar (nada se perde; o que faltou é retomado na próxima abertura)
  try {
    // No site publicado os dados ficam no Supabase, com login; em localhost, no modo local
    const projeto = projetoSupabase();
    if (projeto && !(await iniciarSessaoSupabase(projeto))) return;

    // Primeira abertura com a escala por data: converte os documentos da fase 2 (do servidor ou deste navegador).
    // Depois de uma mudança no formato dos dados, regrava no formato atual o que estiver num formato anterior
    await ApiClient.migrarDocumentosAntigos(amanha);
    await ApiClient.atualizarFormatoGravado();

    abrirData(data);
    const { estado, escala, horasBase, horasDosInstrutores, resultados } = await ApiClient.carregarDia(data);
    setS({ ...estado, horasBase, horasDosInstrutores, resultados });
    // Data sem escala gravada: a escala calculada aparece na hora (é gravada junto com a primeira alteração)
    setRES(escala || escalaCalculada());
    marcarEscalaSoCalculada(!escala);
    setAuditLog(await historicoParaPainel(data));
  } catch (e) {
    console.warn(e);
    if (avisoAberto() !== 'conflito') mostrarAviso('falha', 'Não foi possível preparar os dados da escala. Verifique a conexão e recarregue a página; nada foi perdido.');
    return;
  }

  // No modo compartilhado os dados vêm do servidor e o perfil vem da conta: share= e role= da URL não valem
  const compartilhado = modoCompartilhado();
  const hasShare = !compartilhado && params.has('share');
  const sharedDate = compartilhado ? null : ApiClient.applySharedURLIfPresent(S);

  // Se aberto via link compartilhado, força bloqueio estrito no perfil Gestor sem permitir troca para Operador
  if (hasShare) {
    setRole('gestor', true);
  } else if (!compartilhado && params.get('role')) {
    setRole(params.get('role'), false);
  }

  rRec(); rIns(); rAlu(); rDem(); renderAuditPanel();
  document.body.dataset.agenda = podeEditarAgenda() ? 'edita' : 'consulta';
  // Dados pessoais (para a coluna CANAC das tabelas), para quem pode vê-los
  carregarDadosPessoais();

  // A Secretaria trabalha na agenda: o app abre nela
  if (ApiClient.perfil === 'secretaria') {
    show('age');
    abrirAgenda();
  }

  if (sharedDate) {
    abrirData(sharedDate);
    refazerEscala();
    show('esc');
    showToast('Escala compartilhada carregada (Modo Gestor Somente Leitura).');
  } else {
    rOut();
  }
  atualizarSelosDaEscala();
  lerPedidosDaData();
  carregarBI();
})();
