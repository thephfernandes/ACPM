// O calendário do trilho, sem DOM: as semanas de um mês (de domingo a sábado), o dia de cada tecla, a parada do Tab, o que
// cada dia diz ao leitor de tela e a linha da data aberta ("Amanhã · quarta-feira · 11 de novembro")
import { somarDias, fimDoMes } from './format.js';

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const maiuscula = texto => texto.charAt(0).toUpperCase() + texto.slice(1);
const diaDaSemana = iso => new Date(iso + 'T12:00:00Z').getUTCDay();

// 'AAAA-MM' + n meses
export function somarMeses(mes, n) {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, m - 1 + n, 1)).toISOString().slice(0, 7);
}

export const nomeDoMes = mes => `${maiuscula(MESES[+mes.slice(5, 7) - 1])} de ${mes.slice(0, 4)}`;

// As semanas inteiras que cobrem o mês: listas de sete datas, de domingo a sábado (de quatro a seis semanas)
export function semanasDoMes(mes) {
  const primeiro = `${mes}-01`;
  const fim = fimDoMes(primeiro);
  let dia = somarDias(primeiro, -diaDaSemana(primeiro));
  const semanas = [];
  while (dia <= fim) {
    const semana = [];
    for (let i = 0; i < 7; i++) { semana.push(dia); dia = somarDias(dia, 1); }
    semanas.push(semana);
  }
  return semanas;
}

// O mesmo dia n meses antes ou depois (o último do mês, quando ele é mais curto)
function mesmoDiaEm(iso, n) {
  const mes = somarMeses(iso.slice(0, 7), n);
  const ultimo = fimDoMes(`${mes}-01`);
  const dia = `${mes}-${iso.slice(8, 10)}`;
  return dia > ultimo ? ultimo : dia;
}

// O dia para onde a tecla leva o foco na grade; outra tecla: null
export function diaDaTecla(dia, tecla) {
  switch (tecla) {
    case 'ArrowLeft': return somarDias(dia, -1);
    case 'ArrowRight': return somarDias(dia, 1);
    case 'ArrowUp': return somarDias(dia, -7);
    case 'ArrowDown': return somarDias(dia, 7);
    case 'Home': return somarDias(dia, -diaDaSemana(dia));
    case 'End': return somarDias(dia, 6 - diaDaSemana(dia));
    case 'PageUp': return mesmoDiaEm(dia, -1);
    case 'PageDown': return mesmoDiaEm(dia, 1);
    default: return null;
  }
}

// A única parada do Tab na grade: a data aberta, quando está à vista; senão hoje, quando está; senão o dia 1 do mês à vista
export function paradaDoTab(semanas, { aberta, hoje }) {
  const dias = semanas.flat();
  if (dias.includes(aberta)) return aberta;
  if (dias.includes(hoje)) return hoje;
  const meio = semanas[1] ? semanas[1][0] : dias[0];
  return `${meio.slice(0, 7)}-01`;
}

const dataPorExtenso = iso => `${+iso.slice(8, 10)} de ${MESES[+iso.slice(5, 7) - 1]}`;

// O nome do dia para o leitor de tela: a data completa, depois hoje, amanhã, domingo, data aberta ou abrindo, e os pedidos
export function descricaoDoDia(dia, { hoje, aberta, qtd = 0, abrindo = null }) {
  const partes = [`${DIAS[diaDaSemana(dia)]}, ${dataPorExtenso(dia)} de ${dia.slice(0, 4)}`];
  if (dia === hoje) partes.push('hoje');
  if (dia === somarDias(hoje, 1)) partes.push('amanhã');
  if (diaDaSemana(dia) === 0) partes.push('domingo: o aeroclube não opera');
  if (dia === abrindo) partes.push('abrindo');
  else if (dia === aberta) partes.push('data aberta');
  const pedidos = qtd ? `: ${qtd} ${qtd === 1 ? 'pedido' : 'pedidos'}` : '';
  return partes.join(', ') + pedidos;
}

// "Amanhã · quarta-feira · 11 de novembro"; sem hoje ou amanhã, "Sexta-feira · 20 de novembro"; o ano só em outro ano
export function linhaDaData(data, hoje) {
  const relativo = data === hoje ? 'Hoje' : data === somarDias(hoje, 1) ? 'Amanhã' : '';
  const semana = DIAS[diaDaSemana(data)];
  const ano = data.slice(0, 4) === hoje.slice(0, 4) ? '' : ` de ${data.slice(0, 4)}`;
  const partes = relativo ? [relativo, semana] : [maiuscula(semana)];
  return [...partes, dataPorExtenso(data) + ano].join(' · ');
}
