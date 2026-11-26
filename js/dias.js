// Escala por data. O estado da aplicação (o mesmo formato usado pelo motor e pelas telas) é guardado em
// duas partes: o cadastro, igual em todas as datas (instrutores, alunos e a frota), e o dia, com o que muda de
// uma data para outra (janelas, aeronaves, disponibilidade dos instrutores, demanda e status dos voos).
import { WIN, AIRCRAFT_EQ_TYPES } from './config.js';
import { blank } from './rules.js';
import { normalizarStatus } from './status.js';
import { filasDoDiaSeguinte } from './rodizio.js';
import { FROTA_INICIAL, normalizarFrota } from './frota.js';
import { normalizarHorarios } from './horarios.js';
import { normalizarHangar } from './hangar.js';
import { normalizarLimites } from './limites.js';
import { normalizarFixos, normalizarAprovacao } from './fixos.js';
import { CRITERIOS_PADRAO, normalizarCriterios } from './criterios.js';
import { normalizarCursos } from './cursos.js';
import { normalizarPainel } from './config-do-painel.js';
import { dataIsoValida } from './format.js';

// Os campos do pedido do dia (o pedido principal é o próprio aluno: o resto dele é do cadastro). jan: disponibilidade do
// aluno (só quando o pedido tem uma); etapa: o código da missão do curso; solicitacao: o id do pedido da agenda que virou
// este voo; insId: o instrutor escolhido pelo operador (só quando há um); limiteConfirmado: o 7º voo local do horário
// confirmado na Agenda (só true, formato 27). Desfazer um voo agendado na Escala devolve
// estes campos do pedido como estavam (js/reversoes.js)
export const CAMPOS_DO_PEDIDO = ['fly', 'mis', 'eq', 'p1', 'p2', 'nb', 'ss', 'pr', 'jan', 'etapa', 'solicitacao', 'insId', 'cursoDaEtapa', 'limiteConfirmado'];

// Cada recurso da frota começa disponível; o dia guarda só o que muda
const avDaFrota = frota => Object.fromEntries(frota.map(f => [f.reg, true]));

// horas: horas de voo de cada avião desde a última revisão de 50 horas, no início do dia (só dos aviões informados)
// filas: filas do rodízio (cheque, MLTE, noturno e C172) no início do dia
// importadas: solicitações da agenda já importadas para a demanda do dia
// fObs: o detalhe do status de cada voo (motivo do cancelamento, novo horário do atraso)
// hangar: a ordem dos aviões no hangar, da frente para o fundo (sem ela, a ordem da frota)
// fixos e aprovacao: a escala aprovada (os voos fixos e quem aprovou), que vale só para a própria data
// criterios: os critérios da compactação (os buracos e os horários), que continuam na data seguinte
export const diaPadrao = () => ({ win: WIN.map(() => true), av: avDaFrota(FROTA_INICIAL), ins: {}, pedidos: {}, fStatus: {}, fObs: {}, horas: {}, filas: {}, hangar: normalizarHangar(null, FROTA_INICIAL), fixos: {}, aprovacao: null, criterios: { ...CRITERIOS_PADRAO }, importadas: [] });

export function separar(estado) {
  return {
    cadastro: {
      nid: estado.nid,
      // O nível A01–A09 (lv) fica só como cópia, em quem o tem: as habilitações (hab) valem no lugar dele
      ins: estado.ins.map(({ id, nm, lv, kg, hab, horasExternas, inativo }) => ({
        id, nm, ...(lv === undefined ? {} : { lv }), kg, hab: [...(hab || [])],
        // O instrutor inativo (formato 26): só true fica
        ...(inativo === true ? { inativo: true } : {}),
        // Horas de voo fora do app, por mês ('AAAA-MM'; 'AAAA-00': antes deste mês, no ano)
        ...(horasExternas && Object.keys(horasExternas).length ? { horasExternas: { ...horasExternas } } : {})
      })),
      // voaCom: os instrutores do aluno (o par permanente), só quando há
      // O aluno inativo (formato 26): só true fica
      stu: estado.stu.map(({ id, nm, kg, bl, voaCom, curso, inativo }) => ({ id, nm, kg, bl: [...(bl || [])], ...(voaCom && voaCom.length ? { voaCom: [...voaCom] } : {}), ...(curso ? { curso } : {}), ...(inativo === true ? { inativo: true } : {}) })),
      ...(Array.isArray(estado.frota) ? { frota: estado.frota.map(f => ({ ...f, ...(Array.isArray(f.exige) ? { exige: [...f.exige] } : {}) })) } : {}),
      ...(estado.horarios ? { horarios: structuredClone(estado.horarios) } : {}),
      ...(estado.limites ? { limites: { ...estado.limites } } : {}),
      ...(estado.cursos ? { cursos: structuredClone(estado.cursos) } : {}),
      // A configuração do painel (o quadro e as colunas), só depois de mudada: sem ela, vale o padrão
      ...(estado.painel ? { painel: normalizarPainel(estado.painel) } : {})
    },
    dia: {
      win: [...estado.win],
      av: { ...estado.av },
      ins: Object.fromEntries(estado.ins.map(x => [x.id, { on: x.on, aw: [...x.aw] }])),
      pedidos: Object.fromEntries(estado.stu.map(s => [s.id, {
        ...Object.fromEntries(CAMPOS_DO_PEDIDO.filter(c => s[c] !== undefined).map(c => [c, s[c]])),
        extra: structuredClone(s.extra || [])
      }])),
      fStatus: { ...(estado.fStatus || {}) },
      fObs: structuredClone(estado.fObs || {}),
      horas: { ...(estado.horas || {}) },
      filas: structuredClone(estado.filas || {}),
      hangar: [...(estado.hangar || [])],
      fixos: structuredClone(estado.fixos || {}),
      aprovacao: estado.aprovacao ? { ...estado.aprovacao } : null,
      criterios: normalizarCriterios(estado.criterios),
      importadas: [...(estado.importadas || [])]
    }
  };
}

// Junta cadastro e dia num estado novo (sem compartilhar objetos com o dia guardado).
// Quem não aparece no dia fica disponível (instrutor) ou sem missão (aluno).
export function juntar(cadastro, dia = diaPadrao()) {
  const disponibilidade = dia.ins || {};
  const pedidos = dia.pedidos || {};
  const frota = Array.isArray(cadastro.frota) ? normalizarFrota(cadastro.frota) : FROTA_INICIAL;
  return {
    schemaVer: 4,
    ...(Array.isArray(cadastro.frota) ? { frota } : {}),
    ...(cadastro.horarios ? { horarios: normalizarHorarios(cadastro.horarios) } : {}),
    ...(cadastro.limites ? { limites: normalizarLimites(cadastro.limites) } : {}),
    ...(cadastro.cursos ? { cursos: normalizarCursos(cadastro.cursos) } : {}),
    ...(cadastro.painel ? { painel: normalizarPainel(cadastro.painel) } : {}),
    win: Array.isArray(dia.win) ? [...dia.win] : WIN.map(() => true),
    av: { ...avDaFrota(frota), ...(dia.av || {}) },
    nid: cadastro.nid,
    ins: cadastro.ins.map(x => {
      const d = disponibilidade[x.id];
      return { ...x, on: d ? d.on !== false : true, aw: d && Array.isArray(d.aw) ? [...d.aw] : WIN.map(() => true) };
    }),
    stu: cadastro.stu.map(s => ({
      ...s,
      bl: [...(s.bl || [])],
      ...(s.voaCom ? { voaCom: [...s.voaCom] } : {}),
      ...(pedidos[s.id] ? structuredClone(pedidos[s.id]) : { ...blank(), extra: [] })
    })),
    fStatus: normalizarStatus(dia.fStatus),
    fObs: structuredClone(dia.fObs || {}),
    horas: { ...(dia.horas || {}) },
    filas: structuredClone(dia.filas || {}),
    hangar: normalizarHangar(dia.hangar, frota),
    fixos: normalizarFixos(dia.fixos),
    aprovacao: normalizarAprovacao(dia.aprovacao),
    criterios: normalizarCriterios(dia.criterios),
    importadas: [...(dia.importadas || [])]
  };
}

// Nova data: começa com a disponibilidade, a ordem do hangar e os critérios da compactação do dia anterior, sem status
// dos voos (nem os detalhes) nem escala gerada; as horas até a revisão e as filas do rodízio já contam os voos do dia
// anterior (instrutores: o cadastro, para as filas). A demanda começa vazia: a agenda é o centro dos agendamentos, e a
// demanda do dia vem de "Importar da agenda"
export function diaParaCopiar(anterior, instrutores = []) {
  if (!anterior || !anterior.ins || !anterior.pedidos) return diaPadrao();
  const { win, av, ins, pedidos: anteriores, hangar = null, criterios } = structuredClone(anterior);
  const pedidos = Object.fromEntries(Object.keys(anteriores).map(id => [id, { ...blank(), extra: [] }]));
  return { win, av, ins, pedidos, fStatus: {}, fObs: {}, horas: horasDoDiaSeguinte(anterior), filas: filasDoDiaSeguinte(anterior, instrutores), hangar: hangar || normalizarHangar(null, FROTA_INICIAL), fixos: {}, aprovacao: null, criterios: normalizarCriterios(criterios), importadas: [] };
}

// Horas desde a última revisão no início do dia seguinte: as do dia mais os voos dele que não foram cancelados
// (avião sem horas informadas continua sem)
export function horasDoDiaSeguinte(dia) {
  const horas = { ...(dia.horas || {}) };
  const out = dia.resultado && Array.isArray(dia.resultado.out) ? dia.resultado.out : [];
  const status = dia.fStatus || {};
  for (const o of out) {
    if (!Object.hasOwn(horas, o.r) || !AIRCRAFT_EQ_TYPES.includes(o.eqType)) continue;
    if ((status[o.fKey] || o.status) === 'Cancelado') continue;
    horas[o.r] = Math.round((horas[o.r] + (+o.h || 0)) * 10) / 10;
  }
  return horas;
}

// A escala dos documentos antigos nem sempre tem a data: usa a gravada, senão o dia do BI com a mesma escala
export function inferirDataDaEscala(escala, bi, padrao) {
  if (escala && dataIsoValida(escala.data)) return escala.data;
  if (escala && Array.isArray(escala.out)) {
    const alvo = JSON.stringify(escala.out);
    const igual = Object.keys(bi || {}).sort().reverse().find(d => bi[d] && JSON.stringify(bi[d].out) === alvo);
    if (igual) return igual;
  }
  return padrao;
}

// O id das entradas do histórico dos documentos antigos é o Date.now() de quando foram criadas
const horarioDoId = id => (Number.isFinite(id) && id > Date.UTC(2020, 0, 1) && id < Date.UTC(2100, 0, 1) ? new Date(id).toISOString() : null);

// Converte os documentos antigos (estado já normalizado, escala, histórico e BI) no formato por data
export function converterLegado({ estado, escala, historico, bi }, dataPadrao) {
  const dataAtual = inferirDataDaEscala(escala, bi, dataPadrao);
  const { cadastro, dia } = separar(estado);
  const dias = { [dataAtual]: { ...dia, resultado: escala && Array.isArray(escala.out) ? escala : null } };
  for (const [data, registro] of Object.entries(bi || {})) {
    if (data === dataAtual || !dataIsoValida(data) || !registro || !Array.isArray(registro.out)) continue;
    dias[data] = {
      importado: true,
      resultado: { out: registro.out, al: [], tot: registro.tot ?? registro.out.length, rej: registro.rej ?? 0, data }
    };
  }
  const entradas = (historico || [])
    .filter(e => e && ['inc', 'exc', 'mod'].includes(e.type) && e.desc)
    .map(e => ({ registrado_em: horarioDoId(e.id), tipo: e.type, descricao: String(e.desc) }));
  return { cadastro, dataAtual, dias, historico: entradas };
}

// BI a partir das escalas guardadas: { data: { out, tot, rej } } para cada data com escala gerada
export function biDosDias(dias) {
  return Object.fromEntries(dias
    .filter(d => d.conteudo && d.conteudo.resultado && Array.isArray(d.conteudo.resultado.out))
    .map(({ data, conteudo: { resultado: r } }) => [data, {
      out: r.out,
      tot: r.tot,
      rej: r.rej ?? (r.al || []).filter(a => a.t === 'err').length
    }]));
}
