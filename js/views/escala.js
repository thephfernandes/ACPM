// Aba Escala: resumo do dia, a lista dos voos (ou o mapa por recurso ou por instrutor) e o histórico da data.
import { FLIGHT_STATUSES, GROUND_REG } from '../config.js';
import { hm, WLB, fmtH, esc } from '../format.js';
import { isGroundMission } from '../rules.js';
import { categoriaDoTipo, nomeDoRecurso } from '../categorias.js';
import { textoDoDetalhe, classeDoStatus } from '../status.js';
import { validarReversao } from '../reversoes.js';
import { linhasDoQuadro, quadroDoDia } from '../quadro.js';
import { painelDaEscala } from './painel-aeroporto.js';
import { atualizarPainelDeReparo } from './reparo.js';
import { resultadoNaEscala } from './etapas.js';
import { OPCOES_DE_BURACOS, OPCOES_DE_HORARIOS, normalizarCriterios } from '../criterios.js';
import { metricasDaEscala } from '../metricas.js';
import { sumUniqueOperationalHours, consolidateTimelineSlots } from '../engine.js';
import { S, RES, AUDIT_LOG, TL_MODE, DATA, isGestor, dadoIndisponivel } from '../state.js';
import { motivoDoFixo } from '../fixos.js';
import { $ } from '../dom.js';

export const HT = o => (o.isGround || isGroundMission(o.mis) ? '01h30 (1,5 h)' : o.h + ' h' + (o.ss !== '1/1' ? ` (sessão ${o.ss})` : ''));

export function missionColorClass(mis) {
  if (isGroundMission(mis)) return 'm-gnd';
  if (mis === 'Simulador') return 'm-sim';
  if (mis === 'Voo Local' || mis === 'Voo Solo') return 'm-pp';
  if (mis === 'Navegação' || mis === 'Parafuso' || mis === 'IFR') return 'm-pc';
  if (mis === 'Noturno') return 'm-nt';
  return 'm-mu';
}

// Popup do voo no mapa: um só, fixo na tela e fora do painel que rola (dentro dele o popup era cortado e, nas
// primeiras linhas, sumia sob os filtros e o cabeçalho). Cada barra guarda a chave do voo; o conteúdo sai do registro
// feito no último desenho do mapa, e o popup aberto acompanha a escala refeita (ex.: depois de mudar o status nele)
const VOOS_DO_MAPA = new Map();
let popupDe = null;

function conteudoDoPopup(o) {
  const ativos = o.items.filter(it => statusDe(it) !== 'Cancelado');
  const principal = ativos[0] || o.items[0];
  const st = ativos.length ? statusDe(principal) : 'Cancelado';
  const turma = o.students.length > 1;
  return `<div class="tl-pop-hd"><span>${hm(o.a)} – ${hm(o.b)}</span><span>${HT(o)}</span></div>
    <div class="tl-pop-grid">
      <span>${turma ? 'Turma:' : 'Aluno:'}</span><span>${esc(turma ? `${o.students.length} alunos: ${o.students.join(', ')}` : o.s)}</span>
      <span>Instrutor:</span><span>${esc(o.ins)}</span>
      <span>Recurso:</span><span>${esc(nomeDoRecurso(o.r))}</span>
      <span>Missão:</span><span>${esc(o.mis)}</span>
      <span>Peso Trip.:</span><span>${o.kg ? `${o.kg} kg` : '—'}</span>
      ${o.comb ? `<span>Combustível:</span><span>${textoDoCombustivel(o.comb)}</span>` : ''}
      <span>Status:</span>
      <span>
        <select class="st-sel st-${classeDoStatus(st)}" data-f="fstatus" data-fkey="${esc(principal.fKey)}" aria-label="Status do voo"${isGestor() ? ' disabled' : ''}>
          ${FLIGHT_STATUSES.map(v => `<option value="${v}"${v === st ? ' selected' : ''}>${v}</option>`).join('')}
        </select>
        ${detalheDoStatus(principal)}
      </span>
    </div>
    ${!turma && o.stuId ? `<button type="button" class="tl-pop-btn edit-only" data-act="rm-fly" data-id="${esc(o.stuId)}" data-mid="${esc(o.mid || 0)}">✕ Excluir da escala</button>` : ''}`;
}

// Acima da barra (ou abaixo, quando não cabe), sempre inteiro na tela; a seta aponta para o meio da barra
const MARGEM = 8, DISTANCIA = 10;
function posicionarPopup(pop, barra) {
  const r = barra.getBoundingClientRect();
  const { offsetWidth: largura, offsetHeight: altura } = pop;
  const acima = r.top - DISTANCIA - altura >= MARGEM || r.bottom + DISTANCIA + altura > innerHeight - MARGEM && r.top > innerHeight - r.bottom;
  const topo = Math.min(Math.max(acima ? r.top - DISTANCIA - altura : r.bottom + DISTANCIA, MARGEM), innerHeight - altura - MARGEM);
  const meio = r.left + r.width / 2;
  const esquerda = Math.min(Math.max(meio - largura / 2, MARGEM), innerWidth - largura - MARGEM);
  pop.style.top = `${Math.round(topo)}px`;
  pop.style.left = `${Math.round(esquerda)}px`;
  pop.style.setProperty('--seta', `${Math.round(Math.min(Math.max(meio - esquerda, 14), largura - 14))}px`);
  pop.classList.toggle('abaixo', !acima);
}

const barraDoPopup = () => (popupDe === null ? null : document.querySelector(`#out .tl-bar[data-pop="${CSS.escape(popupDe)}"]`));

export function abrirPopupDoMapa(barra) {
  const o = VOOS_DO_MAPA.get(barra.dataset.pop), pop = $('#tl-pop');
  if (!o || !pop) return;
  fecharPopupDoMapa();
  pop.innerHTML = conteudoDoPopup(o);
  pop.hidden = false;
  barra.setAttribute('aria-expanded', 'true');
  popupDe = barra.dataset.pop;
  posicionarPopup(pop, barra);
}

export function fecharPopupDoMapa({ devolverFoco = false } = {}) {
  const pop = $('#tl-pop'), barra = barraDoPopup();
  if (pop) pop.hidden = true;
  popupDe = null;
  if (!barra) return;
  barra.setAttribute('aria-expanded', 'false');
  if (devolverFoco) barra.focus();
}

export const popupDoMapaAberto = () => popupDe !== null;

// Rolagem ou mudança de tamanho da janela: o popup acompanha a barra (e fecha se ela sumiu)
export function reposicionarPopupDoMapa() {
  if (popupDe === null) return;
  const barra = barraDoPopup();
  if (barra && barra.checkVisibility()) posicionarPopup($('#tl-pop'), barra);
  else fecharPopupDoMapa();
}

// Depois de redesenhar o mapa: o popup aberto volta para a mesma barra, com o conteúdo novo
function reancorarPopupDoMapa() {
  if (popupDe === null) return;
  const barra = barraDoPopup();
  if (!barra || !barra.checkVisibility()) { fecharPopupDoMapa(); return; }
  const chave = popupDe;
  popupDe = null;
  const foco = document.activeElement && $('#tl-pop').contains(document.activeElement) ? document.activeElement.dataset.f : null;
  abrirPopupDoMapa(barra);
  if (popupDe === chave && foco) { const campo = $(`#tl-pop [data-f="${foco}"]`); if (campo) campo.focus(); }
}

export function buildTimelineGroup(out, groupKey, subLabelFn, barLine1Fn, barLine2Fn, minStart, maxEnd) {
  const span = maxEnd - minStart;
  const groups = {};
  out.forEach(o => (groups[o[groupKey]] = groups[o[groupKey]] || []).push(o));

  const ticks = [];
  for (let m = minStart; m <= maxEnd; m += 60) ticks.push(`<span>${hm(m)}</span>`);

  const rowsHTML = Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(key => {
    const rawFlights = groups[key];
    const activeH = sumUniqueOperationalHours(rawFlights, o => (S.fStatus && S.fStatus[o.fKey]) || o.status || 'Confirmado');
    const sub = subLabelFn(rawFlights[0], activeH);
    const consolidated = consolidateTimelineSlots(rawFlights);

    const bars = consolidated.map(o => {
      const left = ((o.a - minStart) / span) * 100;
      const width = ((o.b - o.a) / span) * 100;
      const cls = missionColorClass(o.mis);

      // Turma coletiva: cancelada só quando todos os alunos estão cancelados
      const activeItems = o.items.filter(it => statusDe(it) !== 'Cancelado');
      const stKey = classeDoStatus(activeItems.length ? statusDe(activeItems[0]) : 'Cancelado');
      const chave = o.classKey || o.fKey || `${groupKey}:${key}:${o.a}`;
      VOOS_DO_MAPA.set(chave, o);

      return `<button type="button" class="tl-bar ${cls} tl-st-${stKey}" data-pop="${esc(chave)}" aria-haspopup="dialog" aria-controls="tl-pop" aria-expanded="false" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%">
        <span class="tl-bar-t1">${barLine1Fn(o)}</span>
        <span class="tl-bar-t2">${barLine2Fn(o)}</span>
      </button>`;
    }).join('');

    return `<div class="tl-row">
      <div class="tl-lbl"><span>${esc(nomeDoRecurso(key))}</span> <small>${sub}</small></div>
      <div class="tl-track">${bars}</div>
    </div>`;
  }).join('');

  return `<div class="tl-wrap"><div class="tl-axis">${ticks.join('')}</div>${rowsHTML}</div>`;
}

export function renderVisualTimeline(out) {
  VOOS_DO_MAPA.clear();
  if (!out.length) return '';
  const minStart = 360; // 06:00
  const maxEnd = Math.max(1080, ...out.map(o => o.b));

  const chartHTML = TL_MODE === 'ins'
    ? buildTimelineGroup(
        out,
        'ins',
        (first, totalH) => fmtH(totalH),
        o => o.students.length > 1
          ? `${hm(o.a)}–${hm(o.b)} · Turma (${o.students.length} alunos)`
          : `${hm(o.a)}–${hm(o.b)} · ${esc(o.r)}`,
        o => o.students.length > 1
          ? `${esc(o.mis)}: ${esc(o.students.join(', '))}`
          : `${esc(o.s)} · ${esc(o.mis)}`,
        minStart,
        maxEnd
      )
    : buildTimelineGroup(
        out,
        'r',
        (first, totalH) => [first.r === GROUND_REG ? '' : first.eqType, fmtH(totalH)].filter(Boolean).join(' · '),
        o => o.students.length > 1
          ? `${hm(o.a)}–${hm(o.b)} · ${esc(o.mis)} (${o.students.length} alunos)`
          : `${hm(o.a)}–${hm(o.b)} · ${esc(o.s)}`,
        o => o.students.length > 1
          ? `${esc(o.ins)} · ${esc(o.students.join(', '))}`
          : `${esc(o.mis)} · ${esc(o.ins)}`,
        minStart,
        maxEnd
      );

  return `<div class="pn mapa">
    <div class="tl-legend">
      <span><i class="tl-dot m-gnd"></i>Ground School (01h30)</span>
      <span><i class="tl-dot m-sim"></i>Simulador</span>
      <span><i class="tl-dot m-pp"></i>Voo Local / Solo</span>
      <span><i class="tl-dot m-pc"></i>Navegação / Parafuso / IFR</span>
      <span><i class="tl-dot m-nt"></i>Noturno</span>
      <span><i class="tl-dot m-mu"></i>Multimotor</span>
      <span><i class="tl-dot tl-dot-atrasado"></i>Atrasado</span>
      <span><i class="tl-dot tl-dot-emvoo"></i>Em voo</span>
      <span><i class="tl-dot tl-dot-pendente"></i>Pendente</span>
      <span><i class="tl-dot tl-dot-cancelado"></i>Cancelado</span>
    </div>
    ${chartHTML}
  </div>`;
}

// Histórico da data (na gaveta lateral) e o número de alterações no botão do topo
export function renderAuditPanel() {
  // Entradas revertidas (apontadas por uma reversão) não aparecem no painel
  const revertidas = new Set(AUDIT_LOG.map(e => e.reverte).filter(id => id !== null && id !== undefined));
  const historico = AUDIT_LOG.filter(e => !revertidas.has(e.id));
  const badgeCnt = $('#log-cnt');
  if (badgeCnt) badgeCnt.textContent = historico.length;

  const logListEl = $('#audit-log-list');
  if (logListEl) {
    if (!historico.length) {
      logListEl.innerHTML = `<div class="audit-item"><span class="h">Sem alterações registradas nesta data.</span></div>`;
    } else {
      logListEl.innerHTML = historico.map(item => {
        const tipo = ['inc', 'exc', 'mod'].includes(item.type) ? item.type : 'mod';
        const lbl = tipo === 'inc' ? 'Inclusão' : tipo === 'exc' ? 'Exclusão' : 'Edição';
        // Só a reversão no formato que o app grava vira botão (revisão de 14/11)
        const reversao = item.id !== null && item.id !== undefined ? validarReversao(item.revert, S.frota) : null;
        const btnRevert = reversao
          ? `<button class="x edit-only" data-act="rev-log" data-logid="${esc(item.id)}">${esc(reversao.label)}</button>`
          : '';
        const autor = item.autor ? ` <span class="sm audit-autor">${esc(item.autor)}</span>` : '';
        const importado = item.importado ? ' <span class="sm">(importado)</span>' : '';
        // A alteração ainda sendo gravada, ou recusada pelo servidor (revisão de 14/11)
        const estado = item.estado === 'gravando' ? ' <span class="sm audit-estado">gravando…</span>'
          : item.estado === 'nao-gravada' ? ' <span class="sm audit-estado nao-gravada">não gravada</span>' : '';
        return `<div class="audit-item">
          <div><span class="sm">[${esc(item.ts)}]</span>${autor} <span class="audit-badge ${tipo}">${lbl}</span> <span class="audit-desc">${esc(item.desc)}</span>${importado}${estado}</div>
          ${btnRevert}
        </div>`;
      }).join('');
    }
  }
}

const PERTO_DO_LIMITE_KG = 10;
const ehGround = o => o.isGround || isGroundMission(o.mis);
const duracao = o => (ehGround(o) ? '1h30' : fmtH(o.h)) + (o.ss && o.ss !== '1/1' ? ` · sessão ${o.ss}` : '');
const statusDe = o => (S.fStatus && S.fStatus[o.fKey]) || o.status || 'Confirmado';

// A preferência só aparece quando o voo não ficou na 1ª
function preferencia(o) {
  if (o.baseTag === 'Pref. 2') return ' <span class="tag">2ª preferência</span>';
  if (o.baseTag === 'Próximo livre') return ' <span class="tag fb">horário livre</span>';
  if (o.baseTag === 'Horário ajustado') return ' <span class="tag fb" title="A compactação mudou o horário para fechar um buraco do dia (pela regra dos horários escolhida)">horário ajustado</span>';
  return '';
}

// Peso da tripulação só nos aviões, contra o limite (em destaque a menos de 10 kg dele)
function peso(o) {
  if (!o.limKg) return '';
  if (!o.kg) return '<span class="tag fb">sem peso</span>';
  return `<span class="${o.kg > o.limKg - PERTO_DO_LIMITE_KG ? 'perto' : ''}">${o.kg}</span> <span class="sm">/ ${o.limKg} kg</span>${seloDoCombustivel(o)}`;
}

// Acima do limite com os tanques cheios, o voo sai com menos combustível: quanto reduzir (e, na dica, quanto abastecer)
const horasEMinutos = min => `${Math.floor(min / 60)}h${String(Math.round(min) % 60).padStart(2, '0')}`;
const textoDoCombustivel = c => `Abastecer até ${c.abastecerGal} gal (${c.reduzirGal} a menos que o tanque cheio); o voo, o táxi e a reserva pedem ${c.minimoGal} gal; autonomia de ${horasEMinutos(c.autonomiaMin)}.`;
const seloDoCombustivel = o => (o.comb ? ` <span class="tag comb" title="${textoDoCombustivel(o.comb)}">reduzir ${o.comb.reduzirGal} gal</span>` : '');

function seletorDeStatus(o) {
  const st = statusDe(o);
  return `<select class="st-sel st-${classeDoStatus(st)}" data-f="fstatus" data-fkey="${esc(o.fKey)}" aria-label="Status de ${esc(o.s)}"${isGestor() ? ' disabled' : ''}>
    ${FLIGHT_STATUSES.map(v => `<option value="${v}"${v === st ? ' selected' : ''}>${v}</option>`).join('')}
  </select>${detalheDoStatus(o)}`;
}

// O detalhe do status (o motivo do cancelamento ou a nova decolagem do atraso): um clique permite alterá-lo
function detalheDoStatus(o) {
  const texto = textoDoDetalhe(statusDe(o), S.fObs && S.fObs[o.fKey]);
  if (!texto) return '';
  return isGestor()
    ? `<span class="st-detalhe">${esc(texto)}</span>`
    : `<button type="button" class="st-detalhe" data-act="detalhe-status" data-fkey="${esc(o.fKey)}" title="Alterar o detalhe do status">${esc(texto)}</button>`;
}

const acao = o => (o.stuId
  ? `<button class="x" data-act="rm-fly" data-id="${esc(o.stuId)}" data-mid="${esc(o.mid || 0)}" aria-label="Tirar ${esc(o.s)} da escala" title="Tirar da escala">✕</button>`
  : '');

// Escala aprovada (fase 12): o selo diz quando (e quem) aprovou e o botão reabre; sem aprovação, o botão aprova
function rAprovacao(temVoos) {
  const lugar = $('#aprovacao'), selo = $('#selo-aprovada');
  if (!lugar || !selo) return;
  selo.hidden = !S.aprovacao;
  if (S.aprovacao) {
    const em = new Date(S.aprovacao.em);
    const hora = `${String(em.getHours()).padStart(2, '0')}:${String(em.getMinutes()).padStart(2, '0')}`;
    selo.title = 'Os voos estão fixos: uma alteração não tira ninguém do lugar; o pedido novo entra em volta. Voo que ficar impossível aparece em conflito.';
    selo.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#i-cadeado"/></svg>Aprovada às ${hora}${S.aprovacao.por ? ` por ${esc(S.aprovacao.por)}` : ''}`;
    lugar.innerHTML = `<button type="button" class="btn sec edit-only" id="btn-reabrir" title="Os voos deixam de ser fixos e a escala volta a ser refeita inteira a cada alteração">Reabrir</button>`;
  } else {
    // Sem as horas dos instrutores, os limites do mês e do ano não foram conferidos: não aprova (revisão de 14/11)
    const semHoras = dadoIndisponivel('horas');
    const dica = semHoras ? 'As horas de voo dos instrutores não foram lidas: os limites do mês e do ano não foram conferidos' : 'Fixa os voos: depois disso, as alterações não tiram ninguém do lugar';
    lugar.innerHTML = temVoos ? `<button type="button" class="btn edit-only" id="btn-aprovar" title="${dica}"${semHoras ? ' disabled' : ''}>Aprovar escala</button>` : '';
  }
}

// Compactação (fase 13): os critérios do dia. Com a escala aprovada (os voos fixos não mudam) e no Gestor, só aparecem.
// A linha some sem voos e sem aprovação
function rCompactacao(out) {
  const lugar = $('#compactacao');
  if (!lugar) return;
  lugar.hidden = !out.length && !S.aprovacao;
  const criterios = normalizarCriterios(S.criterios);
  const travado = isGestor() || Boolean(S.aprovacao);
  const grupo = (campo, rotulo, opcoes) => `<span class="flt-rotulo"><span>${rotulo}</span> <span class="seg" role="group" aria-label="${rotulo}">${opcoes.map(([id, nome, dica]) =>
    `<button type="button" data-criterio="${campo}" data-valor="${id}" aria-pressed="${criterios[campo] === id}"${criterios[campo] === id ? ' class="on"' : ''} title="${esc(dica)}"${travado ? ' disabled' : ''}>${esc(nome)}</button>`).join('')}</span></span>`;
  $('#criterios').title = S.aprovacao && !isGestor() ? 'Com a escala aprovada, os voos fixos não mudam: reabra a escala para mudar os critérios.' : '';
  $('#criterios').innerHTML = grupo('buracos', 'Buracos', OPCOES_DE_BURACOS) + grupo('horarios', 'Horários', OPCOES_DE_HORARIOS);
}

// O tempo parado que sobra na escala (sem os voos cancelados), ao lado do resumo: o efeito dos critérios da compactação
function tempoParado(out) {
  const m = metricasDaEscala(out.filter(o => statusDe(o) !== 'Cancelado'));
  return `<div class="parado" id="tempo-parado" title="Tempo entre um voo e o seguinte de cada instrutor e de cada avião (sem os voos cancelados); parado 2 h ou mais, o avião volta para o hangar">
      <div><strong>${horasEMinutos(m.instrutoresParadoMin)}</strong> INVAs parados</div>
      <div><strong>${horasEMinutos(m.avioesParadoMin)}</strong> aviões parados</div>
      <div><strong>${m.saidasDoHangar}</strong> ${m.saidasDoHangar === 1 ? 'saída' : 'saídas'} do hangar</div>
    </div>`;
}

// Avisos agrupados por tipo: alunos e instrutores sem peso, aviões que param para a revisão e outros. O aviso de peso
// diz de quem é o peso que falta (revisão de 14/11): "Peso do aluno", "Peso de Instrutor 01" ou "Pesos do aluno e de…"
const INSTRUTOR_SEM_PESO = /^Pesos? (?:do aluno e )?de (.+?) não informados? \(/;
function resumoDosAvisos(avisos) {
  const ehPeso = a => /^Pesos? d/.test(a.m);
  const ehRevisao = a => a.m.startsWith('Aeronave parou');
  const ehAtraso = a => a.m.startsWith('Atraso:');
  const ehLimite = a => a.m.startsWith('Limite da lei:');
  const semPeso = new Set(avisos.filter(a => ehPeso(a) && /^Pesos? do aluno/.test(a.m)).map(a => a.s.replace(/ \(.*\)$/, ''))).size;
  const instrutoresSemPeso = new Set(avisos.filter(ehPeso).map(a => (INSTRUTOR_SEM_PESO.exec(a.m) || [])[1]).filter(Boolean)).size;
  const revisao = avisos.filter(ehRevisao).length;
  const atrasos = avisos.filter(ehAtraso).length;
  const limites = new Set(avisos.filter(ehLimite).map(a => a.s)).size;
  const outros = avisos.filter(a => !ehPeso(a) && !ehRevisao(a) && !ehAtraso(a) && !ehLimite(a)).length;
  const partes = [
    semPeso && `${semPeso} ${semPeso === 1 ? 'aluno sem peso' : 'alunos sem peso'}`,
    instrutoresSemPeso && `${instrutoresSemPeso} ${instrutoresSemPeso === 1 ? 'instrutor sem peso' : 'instrutores sem peso'}`,
    revisao && `${revisao} ${revisao === 1 ? 'avião para' : 'aviões param'} para a revisão de 50 horas`,
    atrasos && `${atrasos} ${atrasos === 1 ? 'atraso com conflito' : 'atrasos com conflito'}`,
    limites && `${limites} ${limites === 1 ? 'instrutor perto' : 'instrutores perto'} do limite da lei`,
    outros && `${outros} ${outros === 1 ? 'outro' : 'outros'}`
  ].filter(Boolean);
  return `${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'}: ${partes.join(' · ')}`;
}

function resumo(out, al, tot) {
  const erros = al.filter(a => a.t === 'err');
  const conflitos = al.filter(a => a.t === 'conf');
  const avisos = al.filter(a => a.t !== 'err' && a.t !== 'conf');
  const horas = sumUniqueOperationalHours(out, statusDe);
  const item = a => `<li class="al ${a.t}"><b>${esc(a.s)}</b> ${esc(a.m)}</li>`;
  const nomes = [...new Set(erros.map(a => a.s))].join(', ');
  let h = `<div class="resumo">
    <div class="st">
      <div><strong>${tot}</strong> missões pedidas</div>
      <div><strong>${tot - erros.length}</strong> escaladas</div>
      <div><strong>${fmtH(horas)}</strong> de voo e aula</div>
    </div>${tempoParado(out)}`;
  if (erros.length) {
    h += `<details class="caixa erros" open><summary>${erros.length === 1 ? '1 missão não entrou' : `${erros.length} missões não entraram`} na escala: ${esc(nomes)}</summary>
      <ul>${erros.map(item).join('')}</ul></details>`;
  }
  // Voos fixos que ficaram impossíveis (escala aprovada): continuam no lugar até o operador resolver
  const conflito = a => `<li class="al ${a.t}"><b>${esc(a.s)}</b> ${esc(a.m)}${a.fKey ? ` <button type="button" class="btn quiet edit-only" data-reparo="${esc(a.fKey)}" title="O que pode voar no lugar deste voo">Sugestões</button>` : ''}</li>`;
  if (conflitos.length) h += `<details class="caixa conflitos" open><summary>${conflitos.length} ${conflitos.length === 1 ? 'voo em conflito' : 'voos em conflito'} na escala aprovada</summary><ul>${conflitos.map(conflito).join('')}</ul></details>`;
  if (avisos.length) h += `<details class="caixa avisos"><summary>${resumoDosAvisos(avisos)}</summary><ul>${avisos.map(item).join('')}</ul></details>`;
  return h + '</div>';
}

// Horários recolhidos na Lista (continuam assim quando a escala é refeita, até recarregar a página)
const temposRecolhidos = new Set();
export function alternarTempo(w) {
  const recolher = !temposRecolhidos.has(w);
  if (recolher) temposRecolhidos.add(w);
  else temposRecolhidos.delete(w);
  document.querySelectorAll(`#out .tabela-escala tbody tr[data-w="${w}"]:not(.win)`).forEach(tr => { tr.hidden = recolher; });
  const botao = document.querySelector(`#out [data-recolher-tempo="${w}"]`);
  if (botao) botao.setAttribute('aria-expanded', String(!recolher));
}

// Uma linha por voo. Na turma de Ground, horário, missão, sala e instrutor aparecem uma vez; cada aluno tem a
// sua linha, com o seu status e a sua ação. Um clique no horário recolhe ou abre os voos dele
function tabela(voos) {
  const grupos = [];
  const turmas = new Map();
  for (const o of voos) {
    const chave = ehGround(o) && o.classKey ? o.classKey : null;
    if (chave && turmas.has(chave)) { turmas.get(chave).push(o); continue; }
    const grupo = [o];
    if (chave) turmas.set(chave, grupo);
    grupos.push(grupo);
  }
  const porTempo = {};
  grupos.forEach(g => { porTempo[g[0].w] = (porTempo[g[0].w] || 0) + 1; });

  let h = `<div class="tw tabela-escala"><table><thead><tr><th>Horário</th><th>Aluno</th><th>Missão</th><th>Recurso</th><th>Instrutor</th><th>Peso</th><th>Status</th><th class="edit-only" aria-label="Ação"></th></tr></thead><tbody>`;
  let tempo = -1;
  for (const grupo of grupos) {
    const o = grupo[0];
    const recolhido = temposRecolhidos.has(o.w);
    if (o.w !== tempo) {
      tempo = o.w;
      const n = porTempo[o.w];
      h += `<tr class="win" data-w="${o.w}"><td colspan="8"><button type="button" class="win-btn" data-recolher-tempo="${o.w}" aria-expanded="${!recolhido}"><svg class="ico seta" aria-hidden="true"><use href="#i-baixo"/></svg>${WLB(o.w)} <small>${n} ${n === 1 ? 'decolagem ou aula' : 'decolagens e aulas'}</small></button></td></tr>`;
    }
    const rs = grupo.length > 1 ? ` rowspan="${grupo.length}"` : '';
    const cancelado = voo => {
      const classes = [statusDe(voo) === 'Cancelado' ? 'st-Cancelado' : '', voo.conflito ? 'em-conflito' : ''].filter(Boolean);
      return classes.length ? ` class="${classes.join(' ')}"` : '';
    };
    // O cadeado diz por que o voo está fixo: o status de andamento ou a escala aprovada (revisão de 14/11)
    const motivo = esc(motivoDoFixo(o.fKey, { fStatus: S.fStatus, aprovacao: S.aprovacao }));
    const fixo = o.fixo ? ` <svg class="ico fixo" role="img" aria-label="${motivo}"><title>${motivo}</title><use href="#i-cadeado"/></svg>` : '';
    const doTempo = ` data-w="${o.w}"${recolhido ? ' hidden' : ''}`;
    h += `<tr${cancelado(o)}${doTempo}>
      <td class="c-hr hr"${rs}>${hm(o.a)}–${hm(o.b)} <small>${duracao(o)}</small>${fixo}${preferencia(o)}${o.conflito ? ' <span class="tag er">conflito</span>' : ''}</td>
      <td class="c-aluno"><b>${esc(o.s)}</b></td>
      <td class="c-missao"${rs}>${esc(o.mis)}${grupo.length > 1 ? ` <small>Turma de ${grupo.length} alunos</small>` : ''}</td>
      <td class="c-aviao nw"${rs}>${esc(nomeDoRecurso(o.r))}${ehGround(o) ? '' : ` <small>${esc(o.eqType || '')}</small>`}</td>
      <td class="c-instr nw"${rs}>${esc(o.ins)}</td>
      <td class="c-peso nw"${rs}>${peso(o)}</td>
      <td class="c-status">${seletorDeStatus(o)}${resultadoNaEscala(o)}</td>
      <td class="c-acao edit-only acao">${acao(o)}</td>
    </tr>`;
    for (const aluno of grupo.slice(1)) {
      h += `<tr class="membro${statusDe(aluno) === 'Cancelado' ? ' st-Cancelado' : ''}"${doTempo}><td class="c-aluno"><b>${esc(aluno.s)}</b></td><td class="c-status">${seletorDeStatus(aluno)}${resultadoNaEscala(aluno)}</td><td class="c-acao edit-only acao">${acao(aluno)}</td></tr>`;
    }
  }
  return h + '</tbody></table></div>';
}

// Painel: partidas e chegadas no estilo dos aeroportos, com os voos dos filtros (js/views/painel-aeroporto.js). Feito para
// um monitor ou uma TV: as mesmas reduções da TV da recepção (o aluno abreviado e só a categoria do motivo)
function painelDoDia(voos) {
  const quadro = quadroDoDia({ resultado: { out: voos }, fStatus: S.fStatus, fObs: S.fObs });
  return `<div class="painel-dia">${painelDaEscala(() => ({ linhas: linhasDoQuadro(quadro.voos || [], quadro.fStatus, quadro.fObs), data: DATA }))}</div>`;
}

// A escala é refeita a cada alteração (save em actions.js): aqui ela só é desenhada, na visão escolhida na barra
export function rOut() {
  document.querySelectorAll('#s-esc [data-tl]').forEach(b => b.classList.toggle('on', b.dataset.tl === TL_MODE));
  $('#out').dataset.vista = TL_MODE === 'lista' || TL_MODE === 'painel' ? TL_MODE : 'mapa';
  if (!RES || (!RES.out.length && !RES.al.length)) {
    $('#out').innerHTML = `<p class="h">Nenhum voo nesta data. Marque quem vai voar na aba Demanda: a escala é montada automaticamente.</p>`;
    rCompactacao([]);
    rAprovacao(false);
    atualizarPainelDeReparo();
    return;
  }
  const { out, al, tot } = RES;

  // Filtros: a categoria e, dentro dela, um recurso (só os que estão na escala da data)
  const categoria = ($('#flt-esc-cat') && $('#flt-esc-cat').value) || '';
  const tipoDoRecurso = new Map(out.map(o => [o.r, o.eqType]));
  const daCategoria = r => !categoria || categoriaDoTipo(tipoDoRecurso.get(r)) === categoria;
  const usados = [...new Set(out.map(o => o.r))].filter(daCategoria).sort();
  const eqFilterEl = $('#flt-esc-eq');
  let curEqFilter = eqFilterEl ? eqFilterEl.value : '';
  if (!usados.includes(curEqFilter)) curEqFilter = '';
  if (eqFilterEl) {
    eqFilterEl.innerHTML = '<option value="">Todos</option>' +
      usados.map(r => `<option value="${esc(r)}"${r === curEqFilter ? ' selected' : ''}>${esc(nomeDoRecurso(r))}</option>`).join('');
  }
  const qFilter = ($('#flt-esc-q') && $('#flt-esc-q').value || '').toLowerCase();
  const voos = out.filter(o => {
    if (!daCategoria(o.r) || (curEqFilter && o.r !== curEqFilter)) return false;
    if (qFilter && !o.s.toLowerCase().includes(qFilter) && !o.ins.toLowerCase().includes(qFilter) && !o.mis.toLowerCase().includes(qFilter)) return false;
    return true;
  });

  rAprovacao(out.length > 0);
  rCompactacao(out);
  let h = resumo(out, al, tot);
  if (!voos.length) h += `<p class="h">${tot ? 'Nenhum voo na escala com esses filtros.' : 'Nenhuma missão marcada na Demanda.'}</p>`;
  else h += tabela(voos) + renderVisualTimeline(voos) + (TL_MODE === 'painel' ? painelDoDia(voos) : '');
  $('#out').innerHTML = h;
  reancorarPopupDoMapa();
  atualizarPainelDeReparo();
}
