// CSV da escala para o lançamento no portal de agendamento do aeroclube. A operadora lança avião por avião, então
// as linhas vêm agrupadas por avião/equipamento e em ordem de horário dentro de cada um. Abre direto no Excel:
// separador ";", UTF-8 com BOM e quebras de linha do Windows.
import { GROUND_EQ_TYPE } from './config.js';
import { hm } from './format.js';
import { textoDoStatus } from './status.js';

// Ordem dos grupos: aviões (C152, C172, PA-34), simuladores e a sala de Ground; em cada tipo, pela matrícula
const ORDEM_DOS_TIPOS = ['C152', 'C172', 'PA-34', 'Sim. Mono', 'Sim. Multi', GROUND_EQ_TYPE];
const ordemDoTipo = o => { const i = ORDEM_DOS_TIPOS.indexOf(o.eqType); return i < 0 ? ORDEM_DOS_TIPOS.length : i; };

export const CABECALHO = ['Avião / Equipamento', 'Horário', 'Aluno', 'Fase / Missão', 'Instrutor', 'Observações'];

export const nomeDoCsv = data => `escala-acpm-${data}.csv`;

// Observações pertinentes ao lançamento: status diferente de confirmado (com o novo horário do atraso ou a categoria do
// motivo do cancelamento; o texto livre não sai do app), turma de Ground, o peso da tripulação (aluno + instrutor) contra
// o limite do avião e o avião que para para a revisão de 50 horas naquele dia
function observacoes(o, status, detalhe, revisao) {
  const notas = [];
  if (status !== 'Confirmado') notas.push(`Status: ${textoDoStatus(status, detalhe, { textoLivre: false })}`);
  if (o.isGround && o.groupSize > 1) notas.push(`Turma de Ground com ${o.groupSize} alunos`);
  if (o.limKg) {
    if (!o.stuKg) notas.push(`Peso do aluno não informado: limite de ${o.limKg} kg do ${o.eqType} não verificado`);
    else if (!o.insKg) notas.push(`Peso do instrutor não informado: limite de ${o.limKg} kg do ${o.eqType} não verificado`);
    else if (o.comb) {
      // Acima do limite com os tanques cheios: o voo sai com menos combustível (fase 10)
      const { abastecerGal, reduzirGal, minimoGal } = o.comb;
      notas.push(`Peso aluno + instrutor: ${o.stuKg + o.insKg} kg (limite do ${o.eqType} com os tanques cheios: ${o.limKg} kg) · combustível: abastecer até ${abastecerGal} gal (${reduzirGal} a menos); o voo, o táxi e a reserva pedem ${minimoGal} gal`);
    } else {
      const total = o.stuKg + o.insKg;
      notas.push(`Peso aluno + instrutor: ${total} kg (limite do ${o.eqType}: ${o.limKg} kg) · ${total <= o.limKg ? 'dentro do envelope' : 'ACIMA DO LIMITE'}`);
    }
  }
  const parada = revisao && Object.hasOwn(revisao, o.r) ? revisao[o.r].paraAs : null;
  if (parada !== null && parada !== undefined) notas.push(`Avião para para a revisão de 50 horas às ${hm(parada)}`);
  return notas.join(' · ');
}

export function linhasDoCsv(res, fStatus = {}, fObs = {}) {
  return [...res.out]
    .sort((a, b) => ordemDoTipo(a) - ordemDoTipo(b) || a.r.localeCompare(b.r) || a.a - b.a || a.o - b.o)
    .map(o => {
      const status = fStatus[o.fKey] || o.status || 'Confirmado';
      // A missão do curso (fase 14) vem antes do tipo de missão: "PP-07 · Navegação"
      const missao = (o.etapa ? `${o.etapa} · ` : '') + (o.ss && o.ss !== '1/1' ? `${o.mis} (sessão ${o.ss})` : o.mis);
      return [o.r, `${hm(o.a)}–${hm(o.b)}`, o.s, missao, o.ins, observacoes(o, status, fObs[o.fKey], res.revisao)];
    });
}

// Um texto que o Excel leria como fórmula (começando com =, +, -, @, tabulação ou retorno) vai com um apóstrofo na
// frente (revisão de 14/11: um nome gravado como "=HYPERLINK(...)" viraria um link no arquivo)
const PARECE_FORMULA = /^[=+\-@\t\r]/;
const celula = v => { const texto = String(v); return '"' + (PARECE_FORMULA.test(texto) ? `'${texto}` : texto).replace(/"/g, '""') + '"'; };

export function montarCsv(res, fStatus = {}, fObs = {}) {
  const q = celula;
  const linhas = [CABECALHO, ...linhasDoCsv(res, fStatus, fObs)].map(l => l.map(q).join(';'));
  if (res.al.length) {
    linhas.push('');
    linhas.push(['Alertas', 'Aluno', 'Mensagem'].map(q).join(';'));
    res.al.forEach(a => linhas.push([a.t === 'err' ? 'Rejeitado' : 'Aviso', a.s, a.m].map(q).join(';')));
  }
  return '﻿' + linhas.join('\r\n');
}
