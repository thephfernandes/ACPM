// Formatação de horários, datas, durações e textos exibidos na interface, no CSV e no PDF.
import { GROUND_DURATION_H } from './config.js';
// Os nove inícios congelados vêm de js/tempos.js, não de js/horarios.js, que importa este módulo
import { INICIOS_DOS_TEMPOS } from './tempos.js';

export const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
// Uma duração em minutos: 570 → "9h30", 600 → "10h00"
export const duracaoHm = min => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
// O rótulo de um grupo da Lista e do PDF (J, S1): o horário de início dos voos dele; o das 17:30 é o do noturno
export const rotuloDoInicio = m => hm(m) + (m === INICIOS_DOS_TEMPOS[INICIOS_DOS_TEMPOS.length - 1] ? ' · noturno' : '');

// Um número com a vírgula decimal (1,5)
export const numeroBr = n => String(n).replace('.', ',');
// Um peso em kg, em décimos e com a vírgula, sem a unidade: "80,8", "150". A soma de dois pesos com décimos traz o resto
// do ponto flutuante (40,1 + 40,7 dá 80.80000000000001), que não aparece na Escala, no PDF nem no CSV
export const pesoBr = kg => numeroBr(Math.round((+kg || 0) * 10) / 10);
// As horas digitadas, com vírgula ou ponto, em décimos de hora (NaN se não for um número)
export const lerHoras = texto => Math.round(parseFloat(String(texto).replace(',', '.')) * 10) / 10;
// Horas arredondadas em décimos, com vírgula: "2 h", "1,5 h"
export const fmtH = v => `${numeroBr(Math.round((+v || 0) * 10) / 10)} h`;
// A duração do Ground na tela (1,5 h)
export const DURACAO_DO_GROUND = '01h30 (1,5 h)';
export const fmtDurLabel = h => (+h === GROUND_DURATION_H ? DURACAO_DO_GROUND : fmtH(h));

export const pad = i => 'Aluno ' + String(i + 1).padStart(2, '0');

// Datas no formato AAAA-MM-DD (hoje e amanhã no fuso do navegador)
const isoLocal = t => new Date(t - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const hojeISO = () => isoLocal(new Date());
export const amanhaISO = () => isoLocal(new Date(Date.now() + 864e5));
// A data AAAA-MM-DD alguns dias depois (ou antes, com dias negativos), pelo calendário
export const somarDias = (iso, dias) => new Date(Date.parse(iso + 'T12:00:00Z') + dias * 864e5).toISOString().slice(0, 10);

// Rótulo da data em uso no topo: "quarta-feira, 11/11" (com o ano quando não é o de hoje) e "hoje", "amanhã" ou "ontem"
const DIAS_DA_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
// O minuto do dia (0 a 1439) no relógio do navegador
export const minutoDoDia = (data = new Date()) => data.getHours() * 60 + data.getMinutes();

export function rotuloDaData(data, hoje) {
  const [ano, mes, dia] = data.split('-');
  const semana = DIAS_DA_SEMANA[new Date(Date.parse(data + 'T12:00:00Z')).getUTCDay()];
  const relativo = data === hoje ? 'hoje' : data === somarDias(hoje, 1) ? 'amanhã' : data === somarDias(hoje, -1) ? 'ontem' : '';
  const diaMes = `${dia}/${mes}${ano === hoje.slice(0, 4) ? '' : '/' + ano}`;
  // semanaCurta ("qua."): para a tela estreita, onde o nome inteiro não cabe
  return { dia: `${semana}, ${diaMes}`, semana, semanaCurta: `${semana.slice(0, 3)}.`, data: diaMes, relativo };
}
export const fimDoMes = iso => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7), 0)).toISOString().slice(0, 10);

// Uma data AAAA-MM-DD que existe no calendário (2026-02-30 não)
export const dataIsoValida = texto => {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const data = new Date(`${texto}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
};

// O nome de uma pessoa no cadastro: sem espaços a mais e com até 80 caracteres (vazio fica o anterior)
export const LIMITE_DO_NOME = 80;
export const nomeLimpo = (valor, anterior) => String(valor).trim().replace(/\s+/g, ' ').slice(0, LIMITE_DO_NOME).trim() || anterior;

// As iniciais do primeiro e do último nome (ou a primeira letra do e-mail): o menu da conta e os avatares das listas
export const iniciais = nome => {
  const partes = String(nome ?? '').split(/[\s@.]+/).filter(Boolean);
  return ((partes[0] || '?')[0] + (partes.length > 1 && !String(nome).includes('@') ? partes[partes.length - 1][0] : '')).toUpperCase();
};

// A chave de uma busca: o texto sem os acentos (os sinais que a forma NFD separa da letra: “joao” acha “João”, “conceicao”
// acha “Conceição”), em minúsculas, sem os espaços das pontas e com um espaço só entre as palavras. As buscas comparam a
// chave do que se digita com a de cada nome
export const chaveDeBusca = texto => String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

// Texto para dentro de HTML, inclusive de atributos com aspas duplas ou simples
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const opts = (a, sel) => a.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`).join('');
