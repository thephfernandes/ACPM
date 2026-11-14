// Formatação de horários, durações, níveis e textos exibidos na interface, no CSV e no PDF.
import { WIN, NI } from './config.js';

export const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export const WLB = i => `${WIN[i]} · ${i + 1}º tempo` + (i == NI ? ' (noturno)' : '');

// Formatação limpa de horas (suporta 1.5 h = 01h30 do Ground School e horas inteiras de voo)
export const fmtH = v => {
  const n = Math.round((+v || 0) * 10) / 10;
  return Number.isInteger(n) ? `${n} h` : `${String(n).replace('.', ',')} h`;
};
export const fmtDurLabel = h => (+h === 1.5 ? '01h30 (1,5 h)' : `${h} h`);

export const pad = i => 'Aluno ' + String(i + 1).padStart(2, '0');

// Datas no formato AAAA-MM-DD (hoje e amanhã no fuso do navegador)
const isoLocal = t => new Date(t - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const hojeISO = () => isoLocal(new Date());
export const amanhaISO = () => isoLocal(new Date(Date.now() + 864e5));
export const isoMenosDias = (iso, dias) => new Date(Date.parse(iso + 'T12:00:00Z') - dias * 864e5).toISOString().slice(0, 10);

// Rótulo da data em uso no topo: "quarta-feira, 11/11" (com o ano quando não é o de hoje) e "hoje", "amanhã" ou "ontem"
const DIAS_DA_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export function rotuloDaData(data, hoje) {
  const [ano, mes, dia] = data.split('-');
  const semana = DIAS_DA_SEMANA[new Date(Date.parse(data + 'T12:00:00Z')).getUTCDay()];
  const relativo = data === hoje ? 'hoje' : data === isoMenosDias(hoje, -1) ? 'amanhã' : data === isoMenosDias(hoje, 1) ? 'ontem' : '';
  return { dia: `${semana}, ${dia}/${mes}${ano === hoje.slice(0, 4) ? '' : '/' + ano}`, relativo };
}
export const fimDoMes = iso => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7), 0)).toISOString().slice(0, 10);

// Texto para dentro de HTML, inclusive de atributos com aspas duplas ou simples
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const opts = (a, sel) => a.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`).join('');
