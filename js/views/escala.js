// Aba Escala: resumo do dia, a lista dos voos (ou o mapa por recurso ou por instrutor) e o histórico da data.
import { FLIGHT_STATUSES, GROUND_REG, GROUND_EQ_TYPE, NOTURNO, T } from '../config.js';
import { CODIGOS_DE_AVISO, CODIGOS_DO_AGENDADO } from '../conflitos.js';
import { textoDoCombustivel } from '../combustivel.js';
import { hm, WLB, fmtH, esc, rotuloDaData, hojeISO, duracaoHm, DURACAO_DO_GROUND, pesoBr, chaveDeBusca } from '../format.js';
import { isGroundMission } from '../rules.js';
import { categoriaDoTipo, nomeDoRecurso } from '../categorias.js';
import { textoDoDetalhe, classeDoStatus, rotuloDoStatus, STATUS_COM_DETALHE } from '../status.js';
import { validarReversao } from '../reversoes.js';
import { linhasDoQuadro, quadroDoDia } from '../quadro.js';
import { painelDaEscala } from './painel-aeroporto.js';
import { botaoDeDica } from '../dicas.js';
import { atualizarPainelDeReparo } from './reparo.js';
import { atualizarAgendamento } from './agendamento.js';
import { resultadoNaEscala } from './etapas.js';
import { OPCOES_DE_BURACOS, OPCOES_DE_HORARIOS, normalizarCriterios } from '../criterios.js';
import { metricasDaEscala } from '../metricas.js';
import { ligada } from '../funcionalidades.js';
import { sumUniqueOperationalHours, consolidateTimelineSlots } from '../engine.js';
import { S, RES, AUDIT_LOG, TL_MODE, EIXO_INVERTIDO, OCULTAR_INDISPONIVEIS, DATA, isGestor, dadoIndisponivel, estadoDaEscala, inativoNaDataAberta } from '../state.js';
import { cancelamentoAproveitavel } from '../reparo.js';
import { rejeicoesDosPedidos } from '../rejeicoes.js';
import { motivoDoFixo } from '../fixos.js';
import { instrutoresDoVoo } from '../instrutor-escolhido.js';
import { $, posicionarJunto, trocarConteudo, visivel } from '../dom.js';
import { statusDoVoo, unidadeDoVoo } from '../voo.js';
import { voosComInativos, textoDoVooComInativo } from '../inativos.js';

export const HT = o => (o.isGround || isGroundMission(o.mis) ? DURACAO_DO_GROUND : fmtH(o.h) + (o.ss !== '1/1' ? ` (sessão ${o.ss})` : ''));

function missionColorClass(mis) {
  if (isGroundMission(mis)) return 'm-gnd';
  if (mis === 'Simulador') return 'm-sim';
  if (mis === 'Voo Local' || mis === 'Voo Solo') return 'm-pp';
  if (mis === 'Navegação' || mis === 'Parafuso' || mis === 'IFR') return 'm-pc';
  if (mis === 'Noturno') return 'm-nt';
  return 'm-mu';
}

// Popup do voo no mapa: um só, fixo na tela e fora do painel que rola (dentro dele o popup seria cortado e, nas
// primeiras linhas, sumiria sob os filtros e o cabeçalho). Cada barra guarda a chave do voo; o conteúdo sai do registro
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
      <span>Instrutor:</span><span>${botaoDoInstrutor(principal, 'Instrutor do voo')}</span>
      <span>Recurso:</span><span>${esc(nomeDoRecurso(o.r))}</span>
      <span>Missão:</span><span>${esc(o.mis)}</span>
      <span>Peso Trip.:</span><span>${o.kg ? `${pesoBr(o.kg)} kg` : '—'}</span>
      ${o.comb ? `<span>Combustível:</span><span>${textoDoCombustivel(o.comb)}</span>` : ''}
      <span>Status:</span>
      <span>
        <select class="st-sel st-${classeDoStatus(st)}" data-f="fstatus" data-fkey="${esc(principal.fKey)}" aria-label="Status do voo"${isGestor() ? ' disabled' : ''}>
          ${FLIGHT_STATUSES.map(v => `<option value="${v}"${v === st ? ' selected' : ''}>${rotuloDoStatus(v, principal)}</option>`).join('')}
        </select>
        ${detalheDoStatus(principal)}${st === 'Cancelado' ? botaoDoCancelado(principal) : ''}
      </span>
    </div>
    ${ehGround(o) && ativos.length ? `<button type="button" class="tl-pop-btn edit-only" data-act="agendar" data-agendar="t:${esc(unidadeDoVoo(o))}" aria-haspopup="dialog">+ Aluno na turma</button>` : ''}
    ${!turma && o.stuId && !principal.trecho ? `<button type="button" class="tl-pop-btn edit-only" data-act="rm-fly" data-id="${esc(o.stuId)}" data-mid="${esc(o.mid || 0)}">✕ Excluir da escala</button>` : ''}`;
}

const barraDoPopup = () => (popupDe === null ? null : document.querySelector(`#out .tl-bar[data-pop="${CSS.escape(popupDe)}"]`));

// focar: aberto pela pessoa (clique ou Enter na barra), o foco vai para o primeiro controle do popup
export function abrirPopupDoMapa(barra, { focar = false } = {}) {
  const o = VOOS_DO_MAPA.get(barra.dataset.pop), pop = $('#tl-pop');
  if (!o || !pop) return;
  fecharPopupDoMapa();
  pop.innerHTML = conteudoDoPopup(o);
  pop.hidden = false;
  barra.setAttribute('aria-expanded', 'true');
  popupDe = barra.dataset.pop;
  posicionarJunto(pop, barra);
  if (focar) controlesDoPopup()[0]?.focus();
}

const controlesDoPopup = () => [...$('#tl-pop').querySelectorAll('select, button, input, [tabindex="0"]')].filter(c => !c.disabled && visivel(c));

// Tab depois do último controle (ou Shift+Tab antes do primeiro) fecha o popup e volta para a barra, de onde o Tab segue
export function tabNoPopup(e) {
  if (e.key !== 'Tab' || popupDe === null) return;
  const controles = controlesDoPopup();
  const saindo = e.shiftKey ? document.activeElement === controles[0] : document.activeElement === controles.at(-1);
  if (!controles.length || !saindo) return;
  e.preventDefault();
  fecharPopupDoMapa({ devolverFoco: true });
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
  if (barra && visivel(barra)) posicionarJunto($('#tl-pop'), barra);
  else fecharPopupDoMapa();
}

// Depois de redesenhar o mapa: o popup aberto volta para a mesma barra, com o conteúdo novo
function reancorarPopupDoMapa() {
  if (popupDe === null) return;
  const barra = barraDoPopup();
  if (!barra || !visivel(barra)) { fecharPopupDoMapa(); return; }
  const chave = popupDe;
  popupDe = null;
  const foco = document.activeElement && $('#tl-pop').contains(document.activeElement) ? document.activeElement.dataset.f : null;
  abrirPopupDoMapa(barra);
  if (popupDe === chave && foco) { const campo = $(`#tl-pop [data-f="${foco}"]`); if (campo) campo.focus(); }
}

// O mapa é a vista escolhida (Por recurso ou Por instrutor). Na Lista e no Painel, ele fica escondido, só com as linhas
// dos voos: sem as linhas livres e sem o "+"
const vistaDoMapa = () => TL_MODE === 'eq' || TL_MODE === 'ins';

// As linhas do mapa, com os voos de cada uma: por recurso, na ordem da matrícula; por instrutor, pelo id (dois
// instrutores com o mesmo nome ficam em linhas separadas), na ordem do nome e do id. livres: as linhas sem voo que também
// aparecem ([chave, rótulo]), intercaladas na mesma ordem. A escala gravada só exige a chave do voo
// (js/escala-gravada.js): o voo gravado sem o id do instrutor fica na linha do nome dele e, sem o nome, leva o do cadastro
function linhasDoMapa(voos, porInstrutor, livres) {
  const linhas = new Map();
  const linha = (chave, rotulo) => linhas.get(chave) || linhas.set(chave, { chave, rotulo: String(rotulo ?? ''), voos: [] }).get(chave);
  const doInstrutor = o => linha(o.insId ?? o.ins, o.ins ?? (S.ins.find(x => x.id === o.insId) || {}).nm);
  voos.forEach(o => (porInstrutor ? doInstrutor(o) : linha(o.r, nomeDoRecurso(o.r))).voos.push(o));
  livres.forEach(([chave, rotulo]) => linha(chave, rotulo));
  return [...linhas.values()].sort(porInstrutor
    ? (x, y) => x.rotulo.localeCompare(y.rotulo) || x.chave - y.chave
    : (x, y) => String(x.chave).localeCompare(String(y.chave)));
}

// O que a linha diz e faz: as horas do dia (no recurso, com o tipo antes). Nas vistas do mapa, o "+" que agenda nela (no
// recurso ou com o instrutor) e o clique no espaço livre da faixa; o avião em manutenção fica apagado ("em manutenção"),
// e ele, o recurso que saiu da frota, o instrutor fora do cadastro e o inativo não agendam (a faixa fica inerte)
function detalhesDaLinha(linha, porInstrutor, mapa) {
  const horas = fmtH(sumUniqueOperationalHours(linha.voos, statusDe));
  if (porInstrutor) {
    const agenda = mapa && S.ins.some(x => x.id === linha.chave && !inativoNaDataAberta(x));
    return {
      sub: horas, dados: `data-ins="${esc(linha.chave)}"`, manutencao: false, inerte: mapa && !agenda,
      agendar: agenda ? { valor: `i:${linha.chave}`, nome: `Agendar com ${linha.rotulo}` } : null
    };
  }
  const r = linha.chave, ground = r === GROUND_REG;
  const recurso = ground ? null : (S.frota || []).find(f => f.reg === r) || null;
  const manutencao = mapa && Boolean(recurso) && !S.av[r];
  const inativoAqui = mapa && Boolean(recurso) && inativoNaDataAberta(recurso);
  const agenda = mapa && (ground || (Boolean(recurso) && !manutencao && !inativoAqui));
  const tipo = ground ? '' : (linha.voos.length ? linha.voos[0].eqType : recurso && recurso.tipo) || '';
  return {
    sub: [tipo, horas, manutencao ? 'em manutenção' : '', inativoAqui ? 'inativo' : ''].filter(Boolean).join(' · '), dados: `data-r="${esc(r)}"`, manutencao, inerte: mapa && !agenda,
    agendar: agenda ? { valor: `r:${r}`, nome: `Agendar ${ground ? 'na Sala Ground' : `no ${r}`}` } : null
  };
}

// O mapa: as marcas do eixo ficam no minuto delas (--pos), cada voo do início (--ini) ao fim (--dur) e cada listra da
// faixa é uma hora (--hora), em qualquer largura; o início e o fim do mapa (data-inicio e data-fim, em minutos) dão o
// horário de um clique na faixa (js/eventos/escala.js). Com o eixo invertido (.transposto), o CSS põe as linhas em
// colunas e as horas descendo (--horas dá a altura)
function buildTimelineGroup(linhas, porInstrutor, barLine1Fn, barLine2Fn, minStart, maxEnd) {
  const span = maxEnd - minStart;
  const mapa = vistaDoMapa();

  const ticks = [];
  for (let m = minStart; m <= maxEnd; m += 60) ticks.push(`<span${m === maxEnd ? ' class="fim"' : ''} style="--pos:${(((m - minStart) / span) * 100).toFixed(2)}%">${hm(m)}</span>`);

  const rowsHTML = linhas.map(linha => {
    const { sub, dados, manutencao, inerte, agendar } = detalhesDaLinha(linha, porInstrutor, mapa);
    const consolidated = consolidateTimelineSlots(linha.voos);

    const bars = consolidated.map(o => {
      const left = ((o.a - minStart) / span) * 100;
      const width = ((o.b - o.a) / span) * 100;
      const cls = missionColorClass(o.mis);

      // Turma coletiva: cancelada só quando todos os alunos estão cancelados
      const activeItems = o.items.filter(it => statusDe(it) !== 'Cancelado');
      const status = activeItems.length ? statusDe(activeItems[0]) : 'Cancelado';
      const stKey = classeDoStatus(status);
      const chave = unidadeDoVoo(o) || `${porInstrutor ? 'ins' : 'r'}:${linha.chave}:${o.a}`;
      VOOS_DO_MAPA.set(chave, o);

      return `<button type="button" class="tl-bar ${cls} tl-st-${stKey}" data-pop="${esc(chave)}" aria-haspopup="dialog" aria-controls="tl-pop" aria-expanded="false" style="--ini:${left.toFixed(2)}%;--dur:${width.toFixed(2)}%">
        <span class="tl-bar-t1">${barLine1Fn(o)}</span>
        <span class="tl-bar-t2">${barLine2Fn(o)}</span>
        <span class="sr">, ${esc(rotuloDoStatus(status, o))}</span>
      </button>`;
    }).join('');
    // O "+" da linha: só o ícone (o nome fica no aria-label), para o texto da linha continuar o mesmo
    const mais = agendar ? `<button type="button" class="tl-agendar edit-only" data-act="agendar" data-agendar="${esc(agendar.valor)}" aria-label="${esc(agendar.nome)}" aria-haspopup="dialog"><svg class="ico" aria-hidden="true"><use href="#i-mais"/></svg></button>` : '';

    // O nome que não cabe na coluna termina em reticências: o title mostra o nome inteiro (no celular, ele quebra em
    // linhas, css/escala.css)
    return `<div class="tl-row${manutencao ? ' tl-manutencao' : ''}" ${dados}>
      <div class="tl-lbl"><span title="${esc(linha.rotulo)}">${esc(linha.rotulo)}</span> <small>${esc(sub)}</small>${mais}</div>
      <div class="tl-track${inerte ? ' inerte' : ''}" ${dados}>${bars}</div>
    </div>`;
  }).join('');

  const transposto = mapa && EIXO_INVERTIDO;
  return `<div class="tl-wrap${transposto ? ' transposto' : ''}" data-inicio="${minStart}" data-fim="${maxEnd}" style="--hora:${(6000 / span).toFixed(4)}%;--horas:${(span / 60).toFixed(2)}"><div class="tl-axis">${ticks.join('')}</div>${rowsHTML}</div>`;
}

// O mapa dos voos (com as linhas livres, nas vistas do mapa). Sem voo nenhum à vista, só a grade das linhas livres, sem a
// legenda
function renderVisualTimeline(voos, livres = []) {
  VOOS_DO_MAPA.clear();
  const porInstrutor = TL_MODE === 'ins';
  const linhas = linhasDoMapa(voos, porInstrutor, livres);
  if (!linhas.length) return '';
  const minStart = 360; // 06:00
  const maxEnd = Math.max(1080, ...voos.map(o => o.b));

  const chartHTML = porInstrutor
    ? buildTimelineGroup(
        linhas,
        true,
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
        linhas,
        false,
        o => o.students.length > 1
          ? `${hm(o.a)}–${hm(o.b)} · ${esc(o.mis)} (${o.students.length} alunos)`
          : `${hm(o.a)}–${hm(o.b)} · ${esc(o.s)}`,
        o => o.students.length > 1
          ? `${esc(o.ins)} · ${esc(o.students.join(', '))}`
          : `${esc(o.mis)} · ${esc(o.ins)}`,
        minStart,
        maxEnd
      );

  const legenda = !voos.length ? '' : `<div class="tl-legend">
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
    </div>`;
  return `<div class="pn mapa">
    ${legenda}
    ${chartHTML}
  </div>`;
}

// Histórico da data (na gaveta lateral, com a data no título) e o número de alterações no botão do topo
export function renderAuditPanel() {
  const titulo = $('#historico-data');
  if (titulo) titulo.textContent = rotuloDaData(DATA, hojeISO()).dia;
  // Entradas revertidas (apontadas por uma reversão) não aparecem no painel
  const revertidas = new Set(AUDIT_LOG.map(e => e.reverte).filter(id => id !== null && id !== undefined));
  const historico = AUDIT_LOG.filter(e => !revertidas.has(e.id));
  const badgeCnt = $('#log-cnt');
  if (badgeCnt) badgeCnt.textContent = historico.length;

  const logListEl = $('#audit-log-list');
  if (logListEl) {
    if (!historico.length) {
      trocarConteudo(logListEl, `<div class="audit-item"><span class="h">Sem alterações registradas nesta data.</span></div>`);
    } else {
      trocarConteudo(logListEl, historico.map(item => {
        const tipo = ['inc', 'exc', 'mod'].includes(item.type) ? item.type : 'mod';
        const lbl = tipo === 'inc' ? 'Inclusão' : tipo === 'exc' ? 'Exclusão' : 'Edição';
        // Só a reversão no formato que o app grava vira botão
        const reversao = item.id !== null && item.id !== undefined ? validarReversao(item.revert, S.frota) : null;
        const btnRevert = reversao
          ? `<button class="x edit-only" data-act="rev-log" data-logid="${esc(item.id)}">${esc(reversao.label)}</button>`
          : '';
        const autor = item.autor ? ` <span class="sm audit-autor">${esc(item.autor)}</span>` : '';
        const importado = item.importado ? ' <span class="sm">(importado)</span>' : '';
        // A alteração ainda sendo gravada, ou recusada pelo servidor
        const estado = item.estado === 'gravando' ? ' <span class="sm audit-estado">gravando…</span>'
          : item.estado === 'nao-gravada' ? ' <span class="sm audit-estado nao-gravada">não gravada</span>' : '';
        return `<div class="audit-item">
          <div><span class="sm">[${esc(item.ts)}]</span>${autor} <span class="audit-badge ${tipo}">${lbl}</span> <span class="audit-desc">${esc(item.desc)}</span>${importado}${estado}</div>
          ${btnRevert}
        </div>`;
      }).join(''));
    }
  }
}

const PERTO_DO_LIMITE_KG = 10;
const ehGround = o => o.isGround || isGroundMission(o.mis);
const duracao = o => (ehGround(o) ? '1h30' : fmtH(o.h)) + (o.ss && o.ss !== '1/1' ? ` · sessão ${o.ss}` : '');
const statusDe = o => statusDoVoo(o, S.fStatus);

// O noturno de dois dias: no dia, o translado e o noturno em BH, com a volta amanhã; no dia seguinte, a volta de BH, com
// a hora em que o instrutor, o aluno e o avião ficam livres
const trechoDoNoturno = o => (o.mis !== 'Noturno' ? ''
  : o.trecho === 'volta' ? ` <small data-dica="noturno">volta de BH · livres às ${hm(o.livreAs)}</small>`
    : ` <small data-dica="noturno">translado + 3 h em BH · volta amanhã às ${hm(NOTURNO.voltaInicio)}</small>`);

// A preferência só aparece quando o voo não ficou na 1ª
function preferencia(o) {
  if (o.baseTag === 'Pref. 2') return ' <span class="tag" data-dica="segunda-preferencia">2ª preferência</span>';
  if (o.baseTag === 'Próximo livre') return ' <span class="tag fb" data-dica="horario-livre">horário livre</span>';
  if (o.baseTag === 'Horário ajustado') return ' <span class="tag fb" data-dica="horario-ajustado">horário ajustado</span>';
  return '';
}

// Peso da tripulação só nos aviões, em décimos, contra o limite (em destaque a menos de 10 kg dele)
function peso(o) {
  if (!o.limKg) return '';
  if (!o.kg) return '<span class="tag fb" data-dica="sem-peso">sem peso</span>';
  return `<span class="${o.kg > o.limKg - PERTO_DO_LIMITE_KG ? 'perto' : ''}">${pesoBr(o.kg)}</span> <span class="sm">/ ${o.limKg} kg</span>${seloDoCombustivel(o)}`;
}

// Acima do limite com os tanques cheios, o voo sai com menos combustível: quanto reduzir (e, na dica, quanto abastecer).
// A dica diz o caso deste voo (quanto abastecer) antes da explicação
const seloDoCombustivel = o => (o.comb ? ` <span class="tag comb" data-dica="reduzir-combustivel" data-dica-caso="${textoDoCombustivel(o.comb)}">reduzir ${o.comb.reduzirGal} gal</span>` : '');

function seletorDeStatus(o) {
  const st = statusDe(o);
  return `<select class="st-sel st-${classeDoStatus(st)}" data-f="fstatus" data-fkey="${esc(o.fKey)}" aria-label="Status de ${esc(o.s)}" data-dica="status"${isGestor() ? ' disabled' : ''}>
    ${FLIGHT_STATUSES.map(v => `<option value="${v}"${v === st ? ' selected' : ''}>${rotuloDoStatus(v, o)}</option>`).join('')}
  </select>${detalheDoStatus(o)}`;
}

// O instrutor do voo (na turma de Ground, da turma inteira). Para o operador, o nome é um botão que abre a lista no
// lugar dele (seletorDeInstrutor). Escolher um instrutor fixa o voo onde está, com ele (o resto da escala é refeito em
// volta); "Automático" devolve a escolha ao app. O instrutor escolhido pelo operador aparece em destaque
export function botaoDoInstrutor(o, rotulo) {
  const nome = esc(o.ins);
  const escolhido = o.insEscolhido ? ' <span class="sm escolhido-marca">escolhido</span>' : '';
  // A volta do noturno é a continuação do voo de ontem: o instrutor não muda nela
  if (isGestor() || !o.stuId || o.trecho) return nome + escolhido;
  return `<button type="button" class="ins-btn${o.insEscolhido ? ' escolhido' : ''}" data-act="trocar-instrutor" data-fkey="${esc(o.fKey)}" data-rotulo="${esc(rotulo)}" title="Trocar o instrutor" aria-label="${esc(rotulo)}: ${nome}${o.insEscolhido ? ', escolhido pelo operador' : o.insPar ? ', do Priorizar com do aluno' : ''}. Trocar">${nome}</button>`;
}

// A lista do instrutor do voo: sem escolha, a primeira opção é quem o app pôs; os instrutores que não servem no horário
// aparecem com o motivo, e o operador pode escolher mesmo assim (o voo fica em conflito, com as sugestões)
export function seletorDeInstrutor(o, rotulo) {
  const lista = instrutoresDoVoo(estadoDaEscala(), RES, o.fKey).filter(x => o.insEscolhido || x.id !== o.insId)
    .map(x => `<option value="${x.id}"${o.insEscolhido && x.id === o.insId ? ' selected' : ''}>${esc(x.nota ? `${x.nm} (${x.nota})` : x.nm)}</option>`);
  const automatico = o.insEscolhido ? 'Automático (o app escolhe)' : `${o.ins} (${o.insPar ? 'Priorizar com do aluno' : 'escolhido pelo app'})`;
  return `<select class="ins-sel" data-a="insVoo" data-fkey="${esc(o.fKey)}" data-rotulo="${esc(rotulo)}" aria-label="${esc(rotulo)}"><option value=""${o.insEscolhido ? '' : ' selected'}>${esc(automatico)}</option>${lista.join('')}</select>`;
}

// O detalhe do status (o motivo do cancelamento ou a nova decolagem do atraso): um clique permite alterá-lo. Em voo e
// depois do pouso, a decolagem do atraso só aparece
function detalheDoStatus(o) {
  const texto = textoDoDetalhe(statusDe(o), S.fObs && S.fObs[o.fKey]);
  if (!texto) return '';
  return isGestor() || !STATUS_COM_DETALHE.includes(statusDe(o))
    ? `<span class="st-detalhe">${esc(texto)}</span>`
    : `<button type="button" class="st-detalhe" data-act="detalhe-status" data-fkey="${esc(o.fKey)}" title="Alterar o detalhe do status">${esc(texto)}</button>`;
}

// "Sugestões" no voo cancelado que ainda pode voar (a data aberta de hoje em diante, sem resultado, sem "Aluno ausente")
const botaoDoCancelado = o => (cancelamentoAproveitavel(S, o, { data: DATA, hoje: hojeISO() })
  ? ` <button type="button" class="btn quiet edit-only" data-reparo="${esc(o.fKey)}" title="O que pode voar no lugar deste voo cancelado">Sugestões</button>`
  : '');

const acao = o => (o.stuId && !o.trecho
  ? `<button class="x" data-act="rm-fly" data-id="${esc(o.stuId)}" data-mid="${esc(o.mid || 0)}" aria-label="Tirar ${esc(o.s)} da escala" title="Tirar da escala">✕</button>`
  : '');

// Escala aprovada: o selo diz quando (e quem) aprovou e o botão reabre; sem aprovação, o botão aprova
function rAprovacao(temVoos) {
  const lugar = $('#aprovacao'), selo = $('#selo-aprovada');
  if (!lugar || !selo) return;
  selo.hidden = !S.aprovacao;
  if (S.aprovacao) {
    const em = new Date(S.aprovacao.em);
    const hora = `${String(em.getHours()).padStart(2, '0')}:${String(em.getMinutes()).padStart(2, '0')}`;
    selo.dataset.dica = 'aprovar-escala';
    selo.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#i-cadeado"/></svg>Aprovada às ${hora}${S.aprovacao.por ? ` por ${esc(S.aprovacao.por)}` : ''}`;
    trocarConteudo(lugar, '<button type="button" class="btn sec edit-only" id="btn-reabrir" data-dica="reabrir">Reabrir</button>');
  } else {
    // Sem as horas dos instrutores, os limites do mês e do ano não foram conferidos: não aprova
    const semHoras = dadoIndisponivel('horas');
    // Desligado (sem as horas), o title do navegador explica; ligado, a dica do glossário
    const explicacao = semHoras ? ' title="As horas de voo dos instrutores não foram lidas: os limites do mês e do ano não foram conferidos" disabled' : ' data-dica="aprovar-escala"';
    trocarConteudo(lugar, temVoos ? `<button type="button" class="btn edit-only" id="btn-aprovar"${explicacao}>Aprovar escala</button>` : '');
  }
}

// Compactação: os critérios do dia. Com a escala aprovada (os voos fixos não mudam) e no Gestor, só aparecem. A linha
// some sem voos e sem aprovação
function rCompactacao(out) {
  const lugar = $('#compactacao');
  if (!lugar) return;
  lugar.hidden = !out.length && !S.aprovacao;
  const criterios = normalizarCriterios(S.criterios);
  const travado = isGestor() || Boolean(S.aprovacao);
  // Cada critério e cada opção com a dica do glossário
  // Travados, os botões ficam com aria-disabled (o foco e a dica continuam); na escala aprovada, a dica diz por quê
  const dicaDa = id => (S.aprovacao && !isGestor() ? 'criterios-travados' : `criterio-${id}`);
  const grupo = (campo, rotulo, dica, opcoes) => `<span class="flt-rotulo"><span>${rotulo}</span><button type="button" class="dica-btn" data-dica="${dica}" aria-label="O que é ${rotulo}?" aria-expanded="false"></button> <span class="seg" role="group" aria-label="${rotulo}">${opcoes.map(([id, nome]) =>
    `<button type="button" data-criterio="${campo}" data-valor="${id}" data-dica="${dicaDa(id)}" aria-pressed="${criterios[campo] === id}"${criterios[campo] === id ? ' class="on"' : ''}${travado ? ' aria-disabled="true"' : ''}>${esc(nome)}</button>`).join('')}</span></span>`;
  trocarConteudo($('#criterios'), grupo('buracos', 'Buracos', 'buracos', OPCOES_DE_BURACOS) + grupo('horarios', 'Horários', 'horarios', OPCOES_DE_HORARIOS));
}

const horasEMinutos = min => duracaoHm(Math.round(min));

// O tempo parado que sobra na escala (sem os voos cancelados), ao lado do resumo: o efeito dos critérios da compactação (as
// saídas do hangar, só com o hangar ligado)
function tempoParado(out) {
  const m = metricasDaEscala(out.filter(o => statusDe(o) !== 'Cancelado'));
  return `<div class="parado" id="tempo-parado" data-dica="tempo-parado">
      <div><strong>${horasEMinutos(m.instrutoresParadoMin)}</strong> INVAs parados</div>
      <div><strong>${horasEMinutos(m.avioesParadoMin)}</strong> aviões parados</div>
      ${ligada('hangar') ? `<div><strong>${m.saidasDoHangar}</strong> ${m.saidasDoHangar === 1 ? 'saída' : 'saídas'} do hangar</div>` : ''}
    </div>`;
}

// Avisos agrupados pelo código: alunos e instrutores sem peso, aviões que param para a revisão, atrasos, instrutores
// perto do limite da lei e os voos agendados fora das regras (um por voo). Os avisos sem código (de uma escala gravada
// antes deles) entram em "outros"
function resumoDosAvisos(avisos) {
  const doCodigo = codigo => avisos.filter(a => a.codigo === codigo);
  const quantos = (lista, campo) => new Set(lista.map(a => a[campo]).filter(id => id !== undefined)).size;
  const semPeso = quantos(doCodigo('sem-peso'), 'stuId');
  const instrutoresSemPeso = quantos(doCodigo('sem-peso'), 'insId');
  const revisao = doCodigo('revisao').length;
  const atrasos = doCodigo('atraso').length;
  const limites = quantos(doCodigo('perto-do-limite'), 'insId');
  const semPar = doCodigo('voa-com').length;
  const saiu = doCodigo('escolhido-saiu').length;
  const repouso = quantos(doCodigo('repouso-do-noturno'), 'insId');
  const foraDaRegra = quantos(avisos.filter(a => CODIGOS_DO_AGENDADO.includes(a.codigo)), 'fKey');
  const outros = avisos.filter(a => !CODIGOS_DE_AVISO.includes(a.codigo)).length;
  const partes = [
    semPeso && `${semPeso} ${semPeso === 1 ? 'aluno sem peso' : 'alunos sem peso'}`,
    instrutoresSemPeso && `${instrutoresSemPeso} ${instrutoresSemPeso === 1 ? 'instrutor sem peso' : 'instrutores sem peso'}`,
    revisao && `${revisao} ${revisao === 1 ? 'avião para' : 'aviões param'} para a revisão de 50 horas`,
    atrasos && `${atrasos} ${atrasos === 1 ? 'atraso com conflito' : 'atrasos com conflito'}`,
    limites && `${limites} ${limites === 1 ? 'instrutor perto' : 'instrutores perto'} do limite da lei`,
    semPar && `${semPar} ${semPar === 1 ? 'voo sem' : 'voos sem'} o instrutor de Priorizar com`,
    saiu && `${saiu} ${saiu === 1 ? 'voo com o instrutor escolhido' : 'voos com o instrutor escolhido'} fora do cadastro`,
    repouso && `${repouso} ${repouso === 1 ? 'instrutor' : 'instrutores'} sem o repouso da lei antes da volta do noturno`,
    foraDaRegra && `${foraDaRegra} ${foraDaRegra === 1 ? 'agendamento' : 'agendamentos'} fora da regra`,
    outros && `${outros} ${outros === 1 ? 'outro' : 'outros'}`
  ].filter(Boolean);
  return `${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'}: ${partes.join(' · ')}`;
}

// As caixas do resumo (erros, conflitos, avisos, inativos) abrem recolhidas; a que a pessoa abriu continua aberta quando
// a escala é redesenhada (a troca de vista, do eixo, de filtro ou uma alteração), até recarregar a página
const caixasAbertas = new Set();
export const lembrarCaixa = (nome, aberta) => { if (aberta) caixasAbertas.add(nome); else caixasAbertas.delete(nome); };
const caixa = (nome, classes, conteudo) => `<details class="caixa ${classes}" data-caixa="${nome}"${caixasAbertas.has(nome) ? ' open' : ''}>${conteudo}</details>`;

function resumo(out, al, tot) {
  const erros = al.filter(a => a.t === 'err');
  const conflitos = al.filter(a => a.t === 'conf');
  const avisos = al.filter(a => a.t !== 'err' && a.t !== 'conf');
  const horas = sumUniqueOperationalHours(out, statusDe);
  const item = a => `<li class="al ${a.t}"><b>${esc(a.s)}</b> ${esc(a.m)}</li>`;
  // A recusa do pedido cujo instrutor escolhido não serve: "Sugestões" (o pedido dela vem do pareamento, js/rejeicoes.js)
  const pedidoDaRecusa = new Map([...rejeicoesDosPedidos(estadoDaEscala(), RES)].map(([fKey, a]) => [a, fKey]));
  const erro = a => {
    const fKey = a.codigo === 'instrutor-escolhido' ? pedidoDaRecusa.get(a) : null;
    return `<li class="al ${a.t}"><b>${esc(a.s)}</b> ${esc(a.m)}${fKey ? ` <button type="button" class="btn quiet edit-only" data-rejeitado="${esc(fKey)}" title="Outro instrutor que encaixa este pedido">Sugestões</button>` : ''}</li>`;
  };
  const nomes = [...new Set(erros.map(a => a.s))].join(', ');
  let h = `<div class="resumo">
    <div class="st">
      <div><strong>${tot}</strong> missões pedidas</div>
      <div><strong>${tot - erros.length}</strong> escaladas</div>
      <div><strong>${fmtH(horas)}</strong> de voo e aula</div>
    </div>${tempoParado(out)}`;
  if (erros.length) {
    h += caixa('erros', 'erros', `<summary>${erros.length === 1 ? '1 missão não entrou' : `${erros.length} missões não entraram`} na escala: ${esc(nomes)}</summary>
      <ul>${erros.map(erro).join('')}</ul>`);
  }
  // Voos fixos que ficaram impossíveis (da escala aprovada, agendados ou com o instrutor escolhido na Escala): continuam no
  // lugar até o operador resolver
  const conflito = a => `<li class="al ${a.t}"><b>${esc(a.s)}</b> ${esc(a.m)}${a.fKey ? ` <button type="button" class="btn quiet edit-only" data-reparo="${esc(a.fKey)}" title="O que pode voar no lugar deste voo">Sugestões</button>` : ''}</li>`;
  const n = conflitos.length;
  const emConflito = S.aprovacao ? `${n} ${n === 1 ? 'voo em conflito' : 'voos em conflito'} na escala aprovada` : `${n} ${n === 1 ? 'voo fixo' : 'voos fixos'} em conflito`;
  if (n) h += caixa('conflitos', 'conflitos', `<summary>${emConflito}</summary><ul>${conflitos.map(conflito).join('')}</ul>`);
  if (avisos.length) h += caixa('avisos', 'avisos', `<summary>${resumoDosAvisos(avisos)}</summary><ul>${avisos.map(item).join('')}</ul>`);
  return h + caixaDosInativos(out) + '</div>';
}

// Os voos da escala com quem ficou inativo no cadastro (a escala gravada continua mostrando os voos dele até ser refeita):
// um item por pessoa ou recurso. Com um instrutor ou um recurso, "Refazer a escala" a refaz sem ele; o voo do aluno inativo
// não muda ao refazer (o pedido dele continua): ele se resolve na Demanda
function caixaDosInativos(out) {
  const itens = voosComInativos(S, { out }, { data: DATA, hoje: hojeISO() });
  if (!itens.length) return '';
  const n = itens.reduce((total, i) => total + i.voos, 0);
  const linha = i => `<li class="al warn">${esc(textoDoVooComInativo(i))}${i.de === 'aluno' ? ' <a class="btn quiet" href="#/dem" data-focar>Abrir a Demanda</a>' : ''}</li>`;
  const refazer = itens.some(i => i.de !== 'aluno') ? '<button type="button" class="btn quiet edit-only" data-act="refazer-escala">Refazer a escala</button>' : '';
  return caixa('inativos', 'avisos inativos', `<summary>${n} ${n === 1 ? 'voo' : 'voos'} com quem está inativo no cadastro</summary><ul>${itens.map(linha).join('')}</ul>${refazer}`);
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

// O voo agendado fora das regras (os avisos dele, um texto por regra), ao lado do horário: na dica, o caso dele
function seloForaDaRegra(grupo, foraDaRegra) {
  const casos = [...new Set(grupo.flatMap(o => foraDaRegra.get(o.fKey) || []))];
  return casos.length ? ` <span class="tag fb" data-dica="fora-da-regra" data-dica-caso="${esc(casos.join(' '))}">fora da regra</span>` : '';
}

// Uma linha por voo. Na turma de Ground, horário, missão, sala e instrutor aparecem uma vez; cada aluno tem a
// sua linha, com o seu status e a sua ação. Um clique no horário recolhe ou abre os voos dele
function tabela(voos, al) {
  // Os avisos das regras que cada voo agendado pulou, pela chave do voo
  const foraDaRegra = new Map();
  for (const a of al) {
    if (a.t === 'warn' && a.fKey && CODIGOS_DO_AGENDADO.includes(a.codigo)) foraDaRegra.set(a.fKey, [...(foraDaRegra.get(a.fKey) || []), a.m]);
  }
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
      // O "+" do horário agenda a partir dele: só o ícone (o nome fica no aria-label), e o texto da linha continua o mesmo
      h += `<tr class="win" data-w="${o.w}"><td colspan="8"><button type="button" class="win-btn" data-recolher-tempo="${o.w}" aria-expanded="${!recolhido}"><svg class="ico seta" aria-hidden="true"><use href="#i-baixo"/></svg>${WLB(o.w)} <small>${n} ${n === 1 ? 'decolagem ou aula' : 'decolagens e aulas'}</small></button><button type="button" class="win-agendar edit-only" data-act="agendar" data-agendar="w:${o.w}" aria-label="Agendar às ${hm(T[o.w])}" aria-haspopup="dialog"><svg class="ico" aria-hidden="true"><use href="#i-mais"/></svg></button></td></tr>`;
    }
    const rs = grupo.length > 1 ? ` rowspan="${grupo.length}"` : '';
    const cancelado = voo => {
      const classes = [statusDe(voo) === 'Cancelado' ? 'st-Cancelado' : '', voo.conflito ? 'em-conflito' : ''].filter(Boolean);
      return classes.length ? ` class="${classes.join(' ')}"` : '';
    };
    // O cadeado diz por que o voo está fixo: o status de andamento, o agendamento na Escala, a escala aprovada ou o
    // instrutor escolhido na Escala (as marcas estão nos voos fixos do dia)
    const motivo = esc(motivoDoFixo(o.fKey, { fStatus: S.fStatus, aprovacao: S.aprovacao, voo: o, fixos: S.fixos }));
    const fixo = o.fixo ? ` <svg class="ico fixo" role="img" aria-label="${motivo}" data-dica="voo-fixo" data-dica-termo="${motivo}"><use href="#i-cadeado"/></svg>` : '';
    const doTempo = ` data-w="${o.w}"${recolhido ? ' hidden' : ''}`;
    h += `<tr${cancelado(o)}${doTempo}>
      <td class="c-hr hr"${rs}>${hm(o.a)}–${hm(o.b)} <small>${duracao(o)}</small>${fixo}${preferencia(o)}${seloForaDaRegra(grupo, foraDaRegra)}${o.conflito ? ' <span class="tag er" data-dica="conflito">conflito</span>' : ''}</td>
      <td class="c-aluno"><b>${esc(o.s)}</b></td>
      <td class="c-missao"${rs}>${esc(o.mis)}${grupo.length > 1 ? ` <small data-dica="turma">Turma de ${grupo.length} alunos</small>` : ''}${trechoDoNoturno(o)}</td>
      <td class="c-aviao nw"${rs}>${esc(nomeDoRecurso(o.r))}${ehGround(o) ? '' : ` <small>${esc(o.eqType || '')}</small>`}</td>
      <td class="c-instr nw"${rs}>${botaoDoInstrutor(o, `Instrutor de ${grupo.length > 1 ? `${o.mis} (turma)` : o.s}`)}</td>
      <td class="c-peso nw"${rs}>${peso(o)}</td>
      <td class="c-status">${seletorDeStatus(o)}${resultadoNaEscala(o)}${botaoDoCancelado(o)}</td>
      <td class="c-acao edit-only acao">${acao(o)}</td>
    </tr>`;
    for (const aluno of grupo.slice(1)) {
      h += `<tr class="membro${statusDe(aluno) === 'Cancelado' ? ' st-Cancelado' : ''}"${doTempo}><td class="c-aluno"><b>${esc(aluno.s)}</b></td><td class="c-status">${seletorDeStatus(aluno)}${resultadoNaEscala(aluno)}${botaoDoCancelado(aluno)}</td><td class="c-acao edit-only acao">${acao(aluno)}</td></tr>`;
    }
  }
  return h + '</tbody></table></div>';
}

// Painel: as missões do dia ou, no estilo dos aeroportos, partidas e chegadas, com os voos dos filtros e a configuração
// do painel (js/views/painel-aeroporto.js). Feito para um monitor ou uma TV: as mesmas reduções da TV da recepção (o
// aluno abreviado e só a categoria do motivo)
function painelDoDia(voos) {
  const quadro = quadroDoDia({ resultado: { out: voos }, fStatus: S.fStatus, fObs: S.fObs });
  return `<div class="painel-dia">${painelDaEscala(() => ({ linhas: linhasDoQuadro(quadro.voos || [], quadro.fStatus, quadro.fObs), data: DATA, painel: S.painel }), botaoDeDica('painel-missoes', 'o quadro Missões'))}</div>`;
}

// Os filtros da Escala: a categoria (o tipo de cada recurso vem da escala, da frota ou é a sala de Ground), o recurso (só
// os que estão na escala da data) e a busca (o aluno, o instrutor ou a missão, sem acentos)
function filtrosDaEscala(out) {
  const categoria = ($('#flt-esc-cat') && $('#flt-esc-cat').value) || '';
  const tipoDoRecurso = new Map([...(S.frota || []).map(f => [f.reg, f.tipo]), [GROUND_REG, GROUND_EQ_TYPE], ...out.map(o => [o.r, o.eqType])]);
  const daCategoria = r => !categoria || categoriaDoTipo(tipoDoRecurso.get(r)) === categoria;
  const usados = [...new Set(out.map(o => o.r))].filter(daCategoria).sort();
  const eqFilterEl = $('#flt-esc-eq');
  const recurso = eqFilterEl && usados.includes(eqFilterEl.value) ? eqFilterEl.value : '';
  const texto = chaveDeBusca($('#flt-esc-q') && $('#flt-esc-q').value);
  return { categoria, daCategoria, usados, recurso, texto };
}

// As linhas sem voo do mapa (só nas vistas do mapa), para agendar nelas: Por recurso, todos os recursos da frota e a sala
// de Ground, na categoria do filtro; Por instrutor, os instrutores disponíveis no dia (os inativos, não). Com um recurso escolhido ou uma
// busca (Por instrutor, também com uma categoria: o instrutor com voos só de outra categoria pareceria livre), só as linhas
// com voos. "Ocultar indisponíveis" tira os recursos desligados na data; o que ainda tem voo (um fixo em conflito) continua,
// com o voo à vista
function linhasLivres({ categoria, daCategoria, recurso, texto }) {
  if (!vistaDoMapa() || recurso || texto) return [];
  if (TL_MODE === 'ins') return categoria ? [] : S.ins.filter(x => x.on && !inativoNaDataAberta(x)).map(x => [x.id, x.nm]);
  return [...(S.frota || []).filter(f => !inativoNaDataAberta(f) && !(OCULTAR_INDISPONIVEIS && !S.av[f.reg])).map(f => f.reg), GROUND_REG].filter(daCategoria).map(r => [r, nomeDoRecurso(r)]);
}

// A escala é refeita a cada alteração (save em actions.js): aqui ela só é desenhada, na visão escolhida na barra.
// Devolve quantos voos ficaram à vista com os filtros
export function rOut() {
  document.querySelectorAll('#s-esc [data-tl]').forEach(b => {
    b.classList.toggle('on', b.dataset.tl === TL_MODE);
    b.setAttribute('aria-pressed', String(b.dataset.tl === TL_MODE));
  });
  $('#out').dataset.vista = TL_MODE === 'lista' || TL_MODE === 'painel' ? TL_MODE : 'mapa';
  // Inverter o eixo só vale nas vistas do mapa
  const eixo = $('#btn-eixo');
  if (eixo) {
    eixo.hidden = !vistaDoMapa();
    eixo.setAttribute('aria-pressed', String(EIXO_INVERTIDO));
    eixo.classList.toggle('on', EIXO_INVERTIDO);
  }
  // Ocultar indisponíveis só vale no mapa Por recurso
  const indisponiveis = $('#btn-indisponiveis');
  if (indisponiveis) {
    indisponiveis.hidden = TL_MODE !== 'eq';
    indisponiveis.setAttribute('aria-pressed', String(OCULTAR_INDISPONIVEIS));
    indisponiveis.classList.toggle('on', OCULTAR_INDISPONIVEIS);
  }
  if (!RES || (!RES.out.length && !RES.al.length)) {
    // Sem voos, nas vistas do mapa, a grade das linhas livres fica embaixo do texto: o "+" e o clique agendam nela
    const grade = renderVisualTimeline([], linhasLivres(filtrosDaEscala([])));
    trocarConteudo($('#out'), `<p class="h">Nenhum voo nesta data. Marque quem vai voar na Demanda: a escala é montada automaticamente.</p>${grade}`);
    rCompactacao([]);
    rAprovacao(false);
    atualizarPainelDeReparo();
    atualizarAgendamento();
    return 0;
  }
  const { out, al, tot } = RES;

  // Filtros: a categoria e, dentro dela, um recurso (só os que estão na escala da data)
  const filtros = filtrosDaEscala(out);
  const { daCategoria, usados, recurso: curEqFilter, texto: qFilter } = filtros;
  const eqFilterEl = $('#flt-esc-eq');
  if (eqFilterEl) {
    eqFilterEl.innerHTML = '<option value="">Todos</option>' +
      usados.map(r => `<option value="${esc(r)}"${r === curEqFilter ? ' selected' : ''}>${esc(nomeDoRecurso(r))}</option>`).join('');
  }
  const voos = out.filter(o => {
    if (!daCategoria(o.r) || (curEqFilter && o.r !== curEqFilter)) return false;
    if (qFilter && ![o.s, o.ins, o.mis].some(t => chaveDeBusca(t).includes(qFilter))) return false;
    return true;
  });

  rAprovacao(out.length > 0);
  rCompactacao(out);
  let h = resumo(out, al, tot);
  const livres = linhasLivres(filtros);
  if (!voos.length) h += `<p class="h">${tot ? 'Nenhum voo na escala com esses filtros.' : 'Nenhuma missão marcada na Demanda.'}</p>${renderVisualTimeline([], livres)}`;
  else h += tabela(voos, al) + renderVisualTimeline(voos, livres) + (TL_MODE === 'painel' ? painelDoDia(voos) : '');
  trocarConteudo($('#out'), h);
  reancorarPopupDoMapa();
  atualizarPainelDeReparo();
  // O diálogo do agendamento aberto confere de novo com a escala nova
  atualizarAgendamento();
  return voos.length;
}
