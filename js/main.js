/**
 * Escala de Voo — ACPM: ponto de entrada (eventos da interface e inicialização).
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
import { WIN, NI, T, EQ, GROUND_EQ_TYPE, GROUND_REG, GROUND_DURATION_MIN, GROUND_DURATION_H, ACROBAT_REG, MIS, PRE } from './config.js';
import { hm, fmtH, fmtDurLabel, pad, amanhaISO, isoMenosDias } from './format.js';
import { isGroundMission, blank, rotuloDaDisponibilidade } from './rules.js';
import { habilitacoesDoNivel, normalizarHabilitacoes, nomeDaHabilitacao, podeFazer } from './habilitacoes.js';
import { ApiClient } from './storage.js';
import { S, RES, AUDIT_LOG, DATA, setS, setRES, setAuditLog, setTLMode, isGestor, insBy, stuBy, getMissionTarget } from './state.js';
import { $, showToast, msg, focusLast, mostrarAviso, avisoAberto } from './dom.js';
import { show } from './views/tabs.js';
import { rBI, alternarTodosDoBI } from './views/bi.js';
import { renderAuditPanel, rOut } from './views/escala.js';
import { singleDemandRowHTML, cnt, rDem, applyDemandFilters } from './views/demanda.js';
import { rIns, rAlu, applyInstructorFilters, preencherFiltroDeHabilitacoes, mostrarVistaDosInstrutores, abrirPainelDoInstrutor, fecharPainelDoInstrutor, atualizarLinhaDoCadastro, atualizarLinhaDoAluno } from './views/cadastros.js';
import { rRec } from './views/recursos.js';
import { setRole, save, logChange, refazerEscala, escalaCalculada, marcarEscalaSoCalculada, gravarEscalaCalculada, abrirData, historicoParaPainel, carregarData, carregarBI } from './actions.js';
import { exp, pdf } from './export.js';
import { projetoSupabase } from './config-supabase.js';
import { CATEGORIAS_DO_RODIZIO, ajustarFilas } from './rodizio.js';
import { rRodizio } from './views/rodizio.js';
import { abrirConta, carregarContas, gerarSenha, mensagem } from './views/conta.js';
import { rManual } from './views/manual.js';
import { atualizarSelosDaEscala, lerPedidosDaData } from './views/selos.js';
import { importarSolicitacoes, disponibilidadeDaSolicitacao } from './agenda.js';
import { abrirAgenda, carregarMes, mudarMes, escolherDia, diaDaAgenda, lembrarRegistradoPor, podeEditarAgenda, rAgenda } from './views/agenda.js';
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
  const vistaIns = e.target.closest('[data-vista-ins]');
  if (vistaIns) { mostrarVistaDosInstrutores(vistaIns.dataset.vistaIns); return; }
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
    showToast(compartilhado ? 'Link da escala copiado (quem abrir entra com a própria conta).' : 'Link de Gestor (somente leitura) copiado!');
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
  showToast('Histórico limpo.');
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
$('#flt-dem-mis').onchange = applyDemandFilters;
preencherFiltroDeHabilitacoes();
$('#flt-dem-mis').insertAdjacentHTML('beforeend', Object.keys(MIS).map(m => `<option value="${m}">${m}</option>`).join(''));
$('#flt-ins-hab').onchange = applyInstructorFilters;
$('#flt-esc-eq').onchange = () => rOut();

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
      const reg = isGnd
        ? GROUND_REG
        : (mis === 'Parafuso' && eqType === 'C152')
          ? ACROBAT_REG
          : pick(EQ[eqType].filter(r => r !== ACROBAT_REG));
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
  showToast('Histórico de 30 dias simulado.');
});

// Só no modo local: remove os dias simulados (as escalas reais continuam)
armed('#btn-bi-clr', 'Confirmar limpeza', async () => {
  if (isGestor() || !ApiClient.backend.removerDiasSimulados) return;
  await ApiClient.backend.removerDiasSimulados();
  await carregarBI();
  showToast('Dias simulados removidos do BI.');
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
    showToast(`Conta de ${b.dataset.email} excluída.`);
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
  const resumo = importarSolicitacoes(S, pendentes);
  pendentes.filter(s => S.stu.some(x => x.id === s.aluno)).forEach(s => {
    logChange('inc', `Agenda: ${s.aluno_nome} incluído (${s.missao} · ${rotuloDaDisponibilidade(disponibilidadeDaSolicitacao(s))})`);
  });
  save(); rDem(); rAgenda();
  showToast(`${resumo.novos + resumo.atualizados} pedido(s) da agenda na demanda` +
    (resumo.semAluno ? ` · ${resumo.semAluno} de aluno que não está mais no cadastro` : '') + '.');
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
  showToast(excecao ? 'Pedido registrado pela Exceção da Coordenação.' : 'Pedido registrado.');
  await carregarMes();
  lerPedidosDaData();
}
$('#form-agenda').onsubmit = e => { e.preventDefault(); registrarPedido(false); };
$('#ag-excecao').onclick = () => registrarPedido(true);
$('#ag-janela').onchange = () => { $('#ag-horario-rotulo').hidden = $('#ag-janela').value !== 'horario'; };

async function cancelarPedido(b) {
  if (!podeEditarAgenda() || !confirmado(b, 'Confirmar cancelamento')) return;
  const por = $('#ag-por').value.trim();
  if (!por) {
    $('#ag-erro').textContent = 'Informe seu nome em “Registrado por” para cancelar o pedido.';
    return;
  }
  try {
    await ApiClient.cancelarSolicitacao(+b.dataset.id, por);
    showToast('Pedido cancelado.');
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

  if (a === 'add-mis') {
    const s = stuBy(id);
    if (!s) return;
    if (!Array.isArray(s.extra)) s.extra = [];
    const newEx = {
      mid: S.nid++,
      fly: true,
      mis: 'Voo Local',
      eq: 'C152',
      p1: 4,
      p2: 6,
      nb: 1,
      ss: 1,
      pr: s.pr || 3
    };
    s.extra.push(newEx);
    save();
    rDem();
    logChange('inc', `Missão extra adicionada para ${s.nm}`);
    showToast(`Nova missão adicionada para ${s.nm}.`);
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
    msg(`Inclusão de ${s.nm} (${target.mis}) removida.`);
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
    }
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
    const fkey = t.dataset.fkey;
    if (!S.fStatus) S.fStatus = {};
    S.fStatus[fkey] = t.value;
    let flightDesc = fkey;
    if (RES && Array.isArray(RES.out)) {
      const targetFlight = RES.out.find(o => o.fKey === fkey);
      if (targetFlight) {
        targetFlight.status = t.value;
        flightDesc = `${targetFlight.s} (${hm(targetFlight.a)}–${hm(targetFlight.b)})`;
      }
    }
    save();
    logChange('mod', `Status de ${flightDesc}: ${t.value}`);
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
        if (f === 'mis') {
          const mRule = MIS[target.mis] || MIS['Voo Local'];
          if (!mRule.eq.includes(target.eq)) {
            target.eq = mRule.defEq;
          }
          if (mRule.isGround) {
            target.eq = GROUND_EQ_TYPE;
            target.nb = GROUND_DURATION_H;
            if (target.p1 === NI) { target.p1 = 0; target.p2 = 1; }
          } else {
            if (+target.nb === GROUND_DURATION_H || !Number.isInteger(+target.nb)) target.nb = 1;
            if (target.mis === 'Noturno') {
              target.p1 = NI;
              target.p2 = NI;
            } else if (target.p1 === NI) {
              target.p1 = 1;
              target.p2 = 2;
            }
          }
        }
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
    const { estado, escala } = await ApiClient.carregarDia(data);
    setS(estado);
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
