// Aba BI: horas por recurso, instrutor e missão (dia, semana e mês). Os filtros seguem a Escala: a categoria e,
// dentro dela, um recurso.
import { GROUND_EQ_TYPE, GROUND_REG, MIS } from '../config.js';
import { fmtH, esc } from '../format.js';
import { isGroundMission, migrateLegacyMissionName } from '../rules.js';
import { S, BI_HISTORY } from '../state.js';
import { categoriaDoTipo, nomeDoRecurso } from '../categorias.js';
import { $ } from '../dom.js';

// Renderizador do Dashboard Business Intelligence (BI)
export function getDaysDiff(d1Str, d2Str) {
  const d1 = new Date(d1Str + 'T12:00:00');
  const d2 = new Date(d2Str + 'T12:00:00');
  return Math.round((d1 - d2) / 86400000);
}

// Horas por avião e por instrutor: os 10 maiores, com "Ver todos" para abrir a lista inteira
const MAIORES = 10;
const verTodos = { eq: false, ins: false };
export function alternarTodosDoBI(tabela) {
  verTodos[tabela] = !verTodos[tabela];
  rBI();
}
const botaoVerTodos = (tabela, total) => (total > MAIORES
  ? `<button class="btn quiet" type="button" data-bi-todos="${tabela}">${verTodos[tabela] ? `Ver só os ${MAIORES} maiores` : `Ver todos (${total})`}</button>`
  : '');
const visiveis = (tabela, lista) => (verTodos[tabela] ? lista : lista.slice(0, MAIORES));

export function rBI() {
  const container = $('#bi-content');
  if (!container) return;

  const refDate = ($('#bi-dt') && $('#bi-dt').value) || ($('#dt') && $('#dt').value) || new Date().toISOString().slice(0, 10);
  const refMonth = refDate.slice(0, 7);
  const categoria = ($('#bi-flt-cat') && $('#bi-flt-cat').value) || '';
  const fltInsQ = ($('#bi-flt-ins') && $('#bi-flt-ins').value || '').toLowerCase();

  const eqStats = {};
  const frota = S.frota || [];
  frota.forEach(({ reg, tipo }) => { eqStats[reg] = { reg, type: tipo, d: 0, w: 0, m: 0, flightsM: 0 }; });
  eqStats[GROUND_REG] = { reg: GROUND_REG, type: GROUND_EQ_TYPE, d: 0, w: 0, m: 0, flightsM: 0 };

  const insStats = {};
  S.ins.forEach(x => { insStats[x.nm] = { nm: x.nm, on: x.on, d: 0, w: 0, m: 0, flightsM: 0 }; });

  const misStats = {};
  Object.keys(MIS).forEach(m => { misStats[m] = { mis: m, d: 0, w: 0, m: 0 }; });

  let totH_D = 0, totH_W = 0, totH_M = 0;
  let totF_D = 0, totF_W = 0, totF_M = 0;
  let daysRecordedInMonth = 0;

  Object.entries(BI_HISTORY).forEach(([dt, record]) => {
    if (!record || !Array.isArray(record.out)) return;
    const isDay = dt === refDate;
    const diffDays = getDaysDiff(refDate, dt);
    const isWeek = diffDays >= 0 && diffDays < 7;
    const isMonth = dt.slice(0, 7) === refMonth;

    if (isMonth && record.out.length > 0) daysRecordedInMonth++;

    // Deduplica turmas coletivas de Ground School no mesmo dia para somar 1,5 h uma única vez por turma
    const seenDayClasses = new Set();

    record.out.forEach(o => {
      if (o.status === 'Cancelado') return;
      const h = +o.h || 0;
      const normMis = migrateLegacyMissionName(o.mis);
      const isGnd = Boolean(o.isGround || isGroundMission(normMis));
      const cKey = o.classKey || `${dt}_${o.w}_${o.a}_${normMis}_${o.ins}`;

      if (isGnd) {
        if (seenDayClasses.has(cKey)) return;
        seenDayClasses.add(cKey);
      }

      if (isDay) { totH_D += h; totF_D++; }
      if (isWeek) { totH_W += h; totF_W++; }
      if (isMonth) { totH_M += h; totF_M++; }

      if (!eqStats[o.r]) eqStats[o.r] = { reg: o.r, type: o.eqType || 'Outro', d: 0, w: 0, m: 0, flightsM: 0 };
      if (isDay) eqStats[o.r].d += h;
      if (isWeek) eqStats[o.r].w += h;
      if (isMonth) { eqStats[o.r].m += h; eqStats[o.r].flightsM++; }

      if (!insStats[o.ins]) insStats[o.ins] = { nm: o.ins, on: true, d: 0, w: 0, m: 0, flightsM: 0 };
      if (isDay) insStats[o.ins].d += h;
      if (isWeek) insStats[o.ins].w += h;
      if (isMonth) { insStats[o.ins].m += h; insStats[o.ins].flightsM++; }

      if (!misStats[normMis]) misStats[normMis] = { mis: normMis, d: 0, w: 0, m: 0 };
      if (isDay) misStats[normMis].d += h;
      if (isWeek) misStats[normMis].w += h;
      if (isMonth) misStats[normMis].m += h;
    });
  });

  // Categoria e, dentro dela, um recurso: o filtro de recurso lista só os da categoria (e volta a "Todos" se a
  // categoria muda e o recurso não é dela)
  const daCategoria = r => !categoria || categoriaDoTipo(eqStats[r].type) === categoria;
  const recursos = Object.keys(eqStats).filter(daCategoria).sort();
  const eqFilterEl = $('#bi-flt-eq');
  let recurso = eqFilterEl ? eqFilterEl.value : '';
  if (!recursos.includes(recurso)) recurso = '';
  if (eqFilterEl) {
    eqFilterEl.innerHTML = '<option value="">Todos</option>' +
      recursos.map(r => `<option value="${esc(r)}"${r === recurso ? ' selected' : ''}>${esc(nomeDoRecurso(r))}</option>`).join('');
  }
  const eqList = Object.values(eqStats)
    .filter(e => daCategoria(e.reg) && (!recurso || e.reg === recurso))
    .sort((a, b) => b.m - a.m || b.w - a.w || b.d - a.d || a.reg.localeCompare(b.reg));

  const insList = Object.values(insStats)
    .filter(x => !fltInsQ || x.nm.toLowerCase().includes(fltInsQ))
    .sort((a, b) => b.m - a.m || b.w - a.w || b.d - a.d || a.nm.localeCompare(b.nm));

  const maxEqM = Math.max(1, ...eqList.map(e => e.m));
  const maxInsM = Math.max(1, ...insList.map(x => x.m));
  const maxMisM = Math.max(1, ...Object.values(misStats).map(m => m.m));
  const fmtDateBR = refDate.split('-').reverse().join('/');

  container.innerHTML = `
    <div class="st">
      <div><strong>${fmtH(totH_D)}</strong>No dia (${fmtDateBR})<small>${totF_D} voos/aulas ativas</small></div>
      <div><strong>${fmtH(totH_W)}</strong>Na semana (7 dias)<small>${totF_W} voos/aulas ativas</small></div>
      <div><strong>${fmtH(totH_M)}</strong>No mês (${refMonth.split('-').reverse().join('/')})<small>${daysRecordedInMonth} dias registrados</small></div>
      <div><strong>${frota.filter(f => S.av[f.reg]).length}/${frota.length}</strong>Recursos disponíveis<small>${S.ins.filter(x => x.on).length}/${S.ins.length} instrutores</small></div>
    </div>

    <div class="bi-grid-2">
      <div class="pn">
        <h3>Horas por recurso (dia, semana e mês)</h3>
        <div class="tw">
          <table style="min-width:100%" data-bi="eq">
            <thead><tr><th>Recurso</th><th>Tipo</th><th>Dia</th><th>Semana</th><th>Mês</th><th>Uso</th></tr></thead>
            <tbody>
              ${visiveis('eq', eqList).map(e => {
                const pct = Math.round((e.m / maxEqM) * 100);
                const naFrota = frota.find(f => f.reg === e.reg);
                const disp = e.reg === GROUND_REG ? ''
                  : !naFrota ? ' <span class="tag">Retirado</span>'
                  : !S.av[e.reg] ? ' <span class="tag fb">Manut.</span>' : '';
                const acro = naFrota && naFrota.soParafuso ? ' <span class="tag">Acrobat</span>' : '';
                return `<tr>
                  <td><b>${esc(nomeDoRecurso(e.reg))}</b>${acro}${disp}</td>
                  <td class="sm">${e.reg === GROUND_REG ? '' : esc(e.type)}</td>
                  <td><b>${fmtH(e.d)}</b></td>
                  <td>${fmtH(e.w)}</td>
                  <td><b>${fmtH(e.m)}</b></td>
                  <td><div class="bi-bar-wrap"><div class="bi-bar-fill" style="width:${pct}%"></div></div></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${botaoVerTodos('eq', eqList.length)}
      </div>

      <div class="pn">
        <h3>Horas por instrutor (dia, semana e mês)</h3>
        <div class="tw">
          <table style="min-width:100%" data-bi="ins">
            <thead><tr><th>Instrutor</th><th>Dia</th><th>Semana</th><th>Mês</th><th>Carga</th></tr></thead>
            <tbody>
              ${visiveis('ins', insList).map(x => {
                const pct = Math.round((x.m / maxInsM) * 100);
                return `<tr>
                  <td><b>${esc(x.nm)}</b></td>
                  <td><b>${fmtH(x.d)}</b></td>
                  <td>${fmtH(x.w)}</td>
                  <td><b>${fmtH(x.m)}</b></td>
                  <td><div class="bi-bar-wrap"><div class="bi-bar-fill" style="width:${pct}%"></div></div></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${botaoVerTodos('ins', insList.length)}
      </div>
    </div>

    <div class="pn">
      <h3>Horas por missão</h3>
      <div class="tw">
        <table style="min-width:100%">
          <thead><tr><th>Missão</th><th>Recursos permitidos</th><th>Dia</th><th>Semana</th><th>Mês</th><th>Proporção</th></tr></thead>
          <tbody>
            ${Object.values(misStats).map(ms => {
              const rule = MIS[ms.mis] || MIS['Voo Local'];
              const eqDesc = ms.mis === 'Parafuso'
                ? 'C152 (PR-JPL) / C172 / PA-34'
                : rule.eq.join(' / ');
              const pct = Math.round((ms.m / maxMisM) * 100);
              return `<tr>
                <td><b>${esc(ms.mis)}</b></td>
                <td>${esc(eqDesc)}</td>
                <td><b>${fmtH(ms.d)}</b></td>
                <td>${fmtH(ms.w)}</td>
                <td><b>${fmtH(ms.m)}</b></td>
                <td><div class="bi-bar-wrap"><div class="bi-bar-fill" style="width:${pct}%"></div></div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
