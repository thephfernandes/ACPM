// Exportação da escala do dia em CSV e PDF (jsPDF + AutoTable carregados no index.html).
import { hm, WLB, fmtH } from './format.js';
import { sumUniqueOperationalHours, consolidateTimelineSlots } from './engine.js';
import { S, RES, DATA } from './state.js';
import { $, showToast } from './dom.js';
import { HT } from './views/escala.js';
import { montarCsv, nomeDoCsv } from './csv.js';
import { textoDoStatus } from './status.js';

export async function sv(fn, data) {
  let dl = null;
  try { dl = window.claude ? await claude.use('downloads') : null; } catch (e) {}
  if (dl) {
    try { await dl.save({ filename: fn, data }); return true; }
    catch (e) { return !!(e && e.code === 'declined'); }
  }
  if (window.claude) return false;
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8' });
    const u = URL.createObjectURL(blob), l = document.createElement('a');
    l.href = u; l.download = fn; document.body.appendChild(l); l.click(); l.remove();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
    return true;
  } catch (e) { return false; }
}

// CSV para o portal de agendamento: agrupado por avião, em ordem de horário (js/csv.js)
export async function exp() {
  if (!RES) { showToast('Não há escala para exportar nesta data.'); return; }
  const c = montarCsv(RES, S.fStatus || {}, S.fObs || {});
  if (await sv(nomeDoCsv(DATA), c)) { showToast('CSV exportado.', 'ok'); return; }
  $('#csv').value = c;
  $('#csvbox').hidden = false;
}

export async function pdf() {
  if (!RES) { showToast('Não há escala para o PDF nesta data.'); return; }
  if (!window.jspdf) { showToast('A biblioteca de PDF não carregou. Verifique a conexão e recarregue a página.'); return; }

  const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const { out, al, tot } = RES;
  // O documento é a escala de voo do dia; o programa que o gerou, o AutoEscala (nos metadados do PDF)
  doc.setProperties({ title: `Escala de Voo - ACPM - ${DATA.split('-').reverse().join('/')}`, creator: 'AutoEscala - ACPM' });
  const rej = al.filter(a => a.t === 'err').length;
  const dt = DATA.split('-').reverse().join('/');
  const H = { fillColor: [18, 38, 58] };
  const Y = () => doc.lastAutoTable.finalY + 8;
  const hrs = a => fmtH(sumUniqueOperationalHours(a));

  doc.setFontSize(18); doc.text('Escala de Voo - ACPM', 14, 15);
  doc.setFontSize(11);
  doc.text(`Data da escala: ${dt}     Emitida em: ${new Date().toLocaleString('pt-BR')}`, 14, 22);
  doc.text(`Missões na demanda: ${tot}     Atendidas: ${tot - rej}     Horas escaladas: ${hrs(out)}     Alertas: ${al.length}`, 14, 28);

  const body = [];
  let cw = -1;
  out.forEach(o => {
    if (o.w !== cw) {
      cw = o.w;
      body.push([{ content: `${WLB(o.w)}  -  ${out.filter(x => x.w === o.w).length} lançamento(s) iniciando`, colSpan: 9, styles: { fillColor: [222, 230, 238], fontStyle: 'bold' } }]);
    }
    // Status com o detalhe (o novo horário do atraso ou o motivo do cancelamento)
    const status = textoDoStatus((S.fStatus && S.fStatus[o.fKey]) || o.status || 'Confirmado', S.fObs && S.fObs[o.fKey]);
    const pesoComCombustivel = o.kg ? `${o.kg} kg${o.comb ? ` · abastecer ${o.comb.abastecerGal} gal` : ''}` : '-';
    body.push([`${hm(o.a)}-${hm(o.b)}`, o.s, o.mis, o.r, o.ins, HT(o), pesoComCombustivel, o.tag, status]);
  });

  doc.autoTable({ startY: 33, head: [['Horário','Aluno','Missão','Equipamento','Instrutor','Duração','Peso tripulação','Encaixe','Status']], body, styles: { fontSize: 9 }, headStyles: H });

  const grp = k => {
    const g = {};
    out.forEach(o => (g[o[k]] = g[o[k]] || []).push(o));
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  };
  const lst = a => consolidateTimelineSlots(a).map(o => `${hm(o.a)}-${hm(o.b)} ${o.students.join(', ')} (${o.mis})`).join('; ');
  const tb = (t, head, rows) => {
    let y = Y();
    if (y > 165) { doc.addPage(); y = 15; }
    doc.setFontSize(13); doc.text(t, 14, y);
    doc.autoTable({ startY: y + 3, head: [head], body: rows, styles: { fontSize: 9 }, headStyles: H });
  };

  tb('Quadro por instrutor', ['Instrutor','Horas','Horários e alunos'], grp('ins').map(([n, a]) => [n, hrs(a), lst(a)]));
  tb('Quadro por equipamento / sala', ['Recurso','Horas','Horários e alunos'], grp('r').map(([n, a]) => [n, hrs(a), lst(a)]));
  if (al.length) tb('Alertas e pendências', ['Situação','Aluno','Detalhe'], al.map(a => [a.t === 'err' ? 'Rejeitado' : 'Aviso', a.s, a.m]));

  let y = Y();
  if (y > 185) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.text('Responsável pela escala: ______________________________      Visto do Chefe de Operações: ______________________________', 14, y + 8);

  const n = doc.getNumberOfPages(), pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(8);
    doc.text(`ACPM - Escala de ${dt} - Página ${i} de ${n}`, pw - 14, ph - 6, { align: 'right' });
  }

  if (await sv(`escala-acpm-${dt.split('/').reverse().join('-')}.pdf`, doc.output('blob'))) showToast('PDF emitido.', 'ok');
  else showToast('O download direto não está disponível neste modo de visualização.');
}
