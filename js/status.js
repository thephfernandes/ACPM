// Status do voo com detalhes (fase 8). O atraso guarda o novo horário de decolagem; o cancelamento, o motivo (de uma
// lista; em "Outro", um texto curto). Os detalhes ficam no dia (fObs), ao lado do status (fStatus), e só valem para o
// status atual do voo. O histórico guarda só a categoria do motivo, nunca o texto livre.
import { FLIGHT_STATUSES } from './config.js';
import { hm } from './format.js';
import { nomeDoRecurso } from './categorias.js';

export const MOTIVOS_DE_CANCELAMENTO = ['Meteorologia', 'Manutenção da aeronave', 'Aluno ausente', 'Instrutor indisponível', 'Operacional', 'Outro'];
export const LIMITE_DO_TEXTO = 140;
export const STATUS_COM_DETALHE = ['Atrasado', 'Cancelado'];

const FIM_DO_DIA = 24 * 60;
const CHAVE_DO_VOO = /^\d+_\d+_\d+$/;
const limparTexto = texto => (typeof texto === 'string' ? texto.trim().replace(/\s+/g, ' ') : '');

// O detalhe que o operador informou, validado: { detalhe } (null para os status sem detalhe) ou { erro }
export function validarDetalhe(status, dados, inicio) {
  if (status === 'Cancelado') {
    const motivo = dados && dados.motivo;
    if (!MOTIVOS_DE_CANCELAMENTO.includes(motivo)) return { erro: 'Escolha o motivo do cancelamento.' };
    if (motivo !== 'Outro') return { detalhe: { motivo } };
    const texto = limparTexto(dados.texto);
    if (!texto) return { erro: 'Descreva o motivo do cancelamento.' };
    if (texto.length > LIMITE_DO_TEXTO) return { erro: `O motivo tem no máximo ${LIMITE_DO_TEXTO} caracteres.` };
    return { detalhe: { motivo, texto } };
  }
  if (status === 'Atrasado') {
    const novoInicio = dados && dados.novoInicio;
    if (!Number.isInteger(novoInicio) || novoInicio <= inicio || novoInicio >= FIM_DO_DIA) {
      return { erro: `A nova decolagem precisa ser depois das ${hm(inicio)}, no mesmo dia.` };
    }
    return { detalhe: { novoInicio } };
  }
  return { detalhe: null };
}

// Os status guardados que valem: os da lista, em chaves de voo (revisão de 14/11: o resto, gravado fora do formato
// pela API, sai ao abrir)
export function normalizarStatus(fStatus) {
  const dados = fStatus && typeof fStatus === 'object' && !Array.isArray(fStatus) ? fStatus : {};
  return Object.fromEntries(Object.entries(dados).filter(([fKey, st]) => CHAVE_DO_VOO.test(fKey) && FLIGHT_STATUSES.includes(st)));
}

// A classe CSS de cada status vem de uma lista fixa (o texto do status nunca entra no HTML como classe)
const CLASSES_DOS_STATUS = { Pendente: 'Pendente', Confirmado: 'Confirmado', Atrasado: 'Atrasado', 'Em Voo': 'EmVoo', Cancelado: 'Cancelado' };
export const classeDoStatus = st => (Object.hasOwn(CLASSES_DOS_STATUS, st) ? CLASSES_DOS_STATUS[st] : 'Confirmado');

// Os detalhes guardados que valem: os do status atual de cada voo, nos formatos válidos ("Outro" sem o texto vale:
// o link do Gestor não leva o texto)
export function normalizarDetalhes(fObs, fStatus) {
  const dados = fObs && typeof fObs === 'object' ? fObs : {};
  const status = fStatus && typeof fStatus === 'object' ? fStatus : {};
  return Object.fromEntries(Object.entries(dados).flatMap(([fKey, d]) => {
    if (!CHAVE_DO_VOO.test(fKey) || !d || typeof d !== 'object') return [];
    if (status[fKey] === 'Cancelado' && MOTIVOS_DE_CANCELAMENTO.includes(d.motivo)) {
      const texto = d.motivo === 'Outro' ? limparTexto(d.texto).slice(0, LIMITE_DO_TEXTO) : '';
      return [[fKey, texto ? { motivo: d.motivo, texto } : { motivo: d.motivo }]];
    }
    if (status[fKey] === 'Atrasado' && Number.isInteger(d.novoInicio) && d.novoInicio > 0 && d.novoInicio < FIM_DO_DIA) {
      return [[fKey, { novoInicio: d.novoInicio }]];
    }
    return [];
  }));
}

// O detalhe sozinho, como aparece ao lado do status na escala: "nova decolagem 10:40" ou o motivo (vazio sem detalhe)
export function textoDoDetalhe(status, detalhe) {
  if (status === 'Atrasado' && detalhe && Number.isInteger(detalhe.novoInicio)) return `nova decolagem ${hm(detalhe.novoInicio)}`;
  if (status === 'Cancelado' && detalhe && detalhe.motivo) return detalhe.motivo === 'Outro' && detalhe.texto ? detalhe.texto : detalhe.motivo;
  return '';
}

// O status com o detalhe, como aparece no CSV, no PDF e no painel. textoLivre: false deixa só a categoria do motivo (o
// que sai do app: o texto livre pode ter dados pessoais)
export function textoDoStatus(status, detalhe, { textoLivre = true } = {}) {
  const texto = textoDoDetalhe(status, textoLivre || !detalhe ? detalhe : { ...detalhe, texto: undefined });
  return texto ? `${status}: ${texto}` : status;
}

// No histórico, só a categoria do motivo (o texto livre pode ter dados pessoais)
export function textoParaOHistorico(status, detalhe) {
  if (status === 'Atrasado' && detalhe && Number.isInteger(detalhe.novoInicio)) return `Atrasado (nova decolagem ${hm(detalhe.novoInicio)})`;
  if (status === 'Cancelado' && detalhe && detalhe.motivo) return `Cancelado (${detalhe.motivo})`;
  return status;
}

// O voo atrasado sai no novo horário, com a mesma duração
export function intervaloEfetivo(o, status, detalhe) {
  if (status !== 'Atrasado' || !detalhe || !Number.isInteger(detalhe.novoInicio)) return { a: o.a, b: o.b };
  return { a: detalhe.novoInicio, b: detalhe.novoInicio + (o.b - o.a) };
}

// Atrasos que invadem outro voo do mesmo recurso, do mesmo instrutor ou do mesmo aluno (cada um no seu horário
// efetivo). Voo cancelado não conta, os alunos de uma mesma turma de Ground não conflitam entre si e a turma
// atingida conta uma vez (pelo primeiro aluno dela)
export function conflitosDeAtraso(out, fStatus = {}, fObs = {}) {
  const statusDe = o => fStatus[o.fKey] || o.status || 'Confirmado';
  const ativos = out.filter(o => statusDe(o) !== 'Cancelado').map(o => ({ o, ...intervaloEfetivo(o, statusDe(o), fObs[o.fKey]) }));
  const conflitos = [];
  for (const x of ativos) {
    if (statusDe(x.o) !== 'Atrasado' || !fObs[x.o.fKey]) continue;
    const atingidos = new Set();
    for (const y of ativos) {
      if (y === x || (x.o.classKey && x.o.classKey === y.o.classKey) || !(x.a < y.b && y.a < x.b)) continue;
      const grupo = y.o.classKey || y.o.fKey;
      if (atingidos.has(grupo)) continue;
      const motivos = [];
      if (x.o.r === y.o.r) motivos.push('recurso');
      if (x.o.insId !== undefined && x.o.insId === y.o.insId) motivos.push('instrutor');
      if (x.o.stuId !== undefined && x.o.stuId === y.o.stuId) motivos.push('aluno');
      if (!motivos.length) continue;
      atingidos.add(grupo);
      conflitos.push({ fKey: x.o.fKey, com: y.o.fKey, motivos });
    }
  }
  return conflitos;
}

// Os avisos dos conflitos de atraso, no formato dos alertas da escala
export function avisosDeAtraso(out, fStatus = {}, fObs = {}) {
  const porChave = new Map(out.map(o => [o.fKey, o]));
  return conflitosDeAtraso(out, fStatus, fObs).map(({ fKey, com, motivos }) => {
    const x = porChave.get(fKey), y = porChave.get(com);
    const { a, b } = intervaloEfetivo(x, 'Atrasado', fObs[fKey]);
    const outro = intervaloEfetivo(y, fStatus[com] || y.status, fObs[com]);
    const mesmo = motivos.map(m => (m === 'recurso' ? `mesmo recurso (${nomeDoRecurso(x.r)})` : m === 'instrutor' ? `mesmo instrutor (${x.ins})` : 'mesmo aluno'));
    return {
      t: 'warn',
      s: x.s,
      m: `Atraso: a nova decolagem às ${hm(a)} (pouso às ${hm(b)}) se sobrepõe ao voo das ${hm(outro.a)} de ${y.s}: ${mesmo.join(' e ')}.`
    };
  });
}
