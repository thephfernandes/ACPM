// As reversões do histórico. O que "Reverter" desfaz vem gravado no histórico (no servidor, por
// quem tem conta de operador), então só vale no formato que o próprio app produz: a reversão fora dele não vira botão
// nem é aplicada. Um recurso retirado volta pela mesma validação do "+ Novo recurso". Cada campo tem o tipo conferido
// antes de ser usado: a validação nunca lança, e a entrada adulterada só fica sem o botão (o painel continua desenhado).
// Desfazer um voo agendado na Escala também fica aqui: quando ele não é desfeito e o que volta como estava; e o que a
// reversão de uma mudança nos voos fixos não devolve depois de um agendamento.
import { novoRecurso, MATRICULA, ATRIBUTOS_DO_RECURSO } from './frota.js';
import { normalizarFixos, fixoPeloStatus, pinoDeVoltaNaTurma } from './fixos.js';
import { CATEGORIAS_COM_HORARIOS, normalizarHorarios } from './horarios.js';
import { disponibilidadeValida, normalizeMissionFields } from './rules.js';
import { MINUTOS_DO_DIA, MIS, WIN, FLIGHT_STATUSES } from './config.js';
import { CHAVE_DO_VOO, chaveDoVoo, pedidoDoAluno } from './voo.js';
import { CAMPOS_DO_PEDIDO } from './dias.js';
import { STATUS_EM_ANDAMENTO, normalizarDetalhes } from './status.js';

const idValido = v => Number.isInteger(v) && v > 0;
const rotuloValido = v => typeof v === 'string' && v.length <= 40;
const rotulo = v => (rotuloValido(v) ? v : '↶ Reverter');
const objeto = v => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const ausente = v => v === null || v === undefined;
// Um campo do pedido é um valor simples: texto, número, sim ou não (null fica de fora na normalização). Uma lista ou um
// objeto gravado no histórico não é campo de pedido: a normalização o converteria em texto (['Noturno'] passaria por
// 'Noturno', sem o horário do Noturno) ou lançaria uma exceção (um objeto com "toString": null, que o JSON permite), e aí
// nem o histórico nem a escala da data seriam desenhados
const valorSimples = v => v === null || ['string', 'number', 'boolean'].includes(typeof v);

// O pedido de antes de um agendamento: só os campos do pedido (CAMPOS_DO_PEDIDO), com valores simples, uma missão do
// app (o nome, em texto) e o "voa" sim ou não; o resto vai para os formatos do app (normalizeMissionFields). Fora disso,
// null
function pedidoDeAntes(p) {
  if (!objeto(p) || !Object.entries(p).every(([c, v]) => CAMPOS_DO_PEDIDO.includes(c) && valorSimples(v))) return null;
  if (typeof p.mis !== 'string' || !Object.hasOwn(MIS, p.mis) || typeof p.fly !== 'boolean') return null;
  const pedido = { ...p };
  normalizeMissionFields(pedido);
  return pedido;
}

// A disponibilidade de antes de um instrutor no dia: se ele vem (on) e cada horário do dia (aw); fora disso, null
const disponibilidadeDeAntes = d => (objeto(d) && idValido(d.insId) && typeof d.on === 'boolean' && Array.isArray(d.aw)
  && d.aw.length === WIN.length && d.aw.every(v => typeof v === 'boolean') ? { insId: d.insId, on: d.on, aw: [...d.aw] } : null);

// A reversão limpa (só os campos dela), ou null
export function validarReversao(rev, frota) {
  if (!rev || typeof rev !== 'object' || Array.isArray(rev)) return null;
  const label = rotulo(rev.label);
  if (rev.kind === 'setFly') {
    const mid = rev.mid === undefined ? 0 : rev.mid;
    // extras: as missões extras que saíram junto com a principal
    const extras = Array.isArray(rev.extras) && rev.extras.length <= 20 && rev.extras.every(m => Number.isInteger(m) && m > 0) ? rev.extras : null;
    if (rev.extras !== undefined && !extras) return null;
    return idValido(rev.stuId) && Number.isInteger(mid) && mid >= 0 && typeof rev.val === 'boolean'
      ? { kind: 'setFly', stuId: rev.stuId, mid, val: rev.val, ...(extras ? { extras: [...extras] } : {}), label } : null;
  }
  if (rev.kind === 'setAv') {
    return typeof rev.reg === 'string' && MATRICULA.test(rev.reg) && typeof rev.val === 'boolean' ? { kind: 'setAv', reg: rev.reg, val: rev.val, label } : null;
  }
  // Um atributo de um recurso (Só Parafuso, Só VFR ou Habilitação própria). Os tipos antes de tudo: o Object.hasOwn
  // converte o nome em texto, e um objeto que não vira texto (sem toString) lançaria
  if (rev.kind === 'setAtributo') {
    return typeof rev.reg === 'string' && typeof rev.atributo === 'string' && typeof rev.val === 'boolean'
      && MATRICULA.test(rev.reg) && Object.hasOwn(ATRIBUTOS_DO_RECURSO, rev.atributo)
      ? { kind: 'setAtributo', reg: rev.reg, atributo: rev.atributo, val: rev.val, label } : null;
  }
  if (rev.kind === 'setInsOn') return idValido(rev.insId) && typeof rev.val === 'boolean' ? { kind: 'setInsOn', insId: rev.insId, val: rev.val, label } : null;
  if (rev.kind === 'restaurarFixos') {
    const fixos = rev.fixos && typeof rev.fixos === 'object' ? normalizarFixos(rev.fixos) : {};
    // O reparo também muda o instrutor escolhido dos pedidos: como estavam
    const pedidos = rev.pedidos === undefined ? [] : rev.pedidos;
    if (!Array.isArray(pedidos) || pedidos.length > 100 || !pedidos.every(p => p && idValido(p.stuId) && Number.isInteger(p.mid) && p.mid >= 0 && idValido(p.insId))) return null;
    return Object.keys(fixos).length ? { kind: 'restaurarFixos', fixos, ...(pedidos.length ? { pedidos: pedidos.map(p => ({ stuId: p.stuId, mid: p.mid, insId: p.insId })) } : {}), label } : null;
  }
  // O instrutor escolhido de antes (insId 0: "Automático") nos pedidos, e os voos fixos como estavam (soltar: os que
  // não eram fixos)
  if (rev.kind === 'restaurarEscolha') {
    if (!Array.isArray(rev.pedidos) || !rev.pedidos.length || rev.pedidos.length > 100 || !Array.isArray(rev.soltar) || rev.soltar.length > 100) return null;
    const pedidos = rev.pedidos.map(p => (p && typeof p === 'object' && idValido(p.stuId) && Number.isInteger(p.mid) && p.mid >= 0
      && (p.insId === 0 || idValido(p.insId)) ? { stuId: p.stuId, mid: p.mid, insId: p.insId } : null));
    const fixos = rev.fixos && typeof rev.fixos === 'object' ? normalizarFixos(rev.fixos) : {};
    if (!pedidos.every(Boolean) || !rev.soltar.every(k => typeof k === 'string' && CHAVE_DO_VOO.test(k))) return null;
    return { kind: 'restaurarEscolha', pedidos, fixos, soltar: [...rev.soltar], label };
  }
  // Os horários de uma categoria e os pedidos que mudaram com eles
  if (rev.kind === 'restaurarHorarios') {
    if (!CATEGORIAS_COM_HORARIOS.includes(rev.cat) || !Array.isArray(rev.lista) || !Array.isArray(rev.pedidos) || rev.pedidos.length > 500) return null;
    const lista = normalizarHorarios({ [rev.cat]: rev.lista })[rev.cat];
    if (lista.length !== rev.lista.length) return null;
    const preferencia = v => Number.isInteger(v) && v >= -1 && v <= MINUTOS_DO_DIA;
    const pedidos = rev.pedidos.map(p => (p && typeof p === 'object' && idValido(p.stuId) && Number.isInteger(p.mid) && p.mid >= 0
      && preferencia(p.p1) && preferencia(p.p2) && (p.jan === undefined || disponibilidadeValida(p.jan))
      ? { stuId: p.stuId, mid: p.mid, p1: p.p1, p2: p.p2, ...(p.jan === undefined ? {} : { jan: p.jan }) } : null));
    return pedidos.every(Boolean) ? { kind: 'restaurarHorarios', cat: rev.cat, lista, pedidos, label } : null;
  }
  // O voo cancelado aproveitado pelas Sugestões: o pino, o status e o detalhe de antes de cada voo (null: não havia) e o
  // pedido de antes de cada aluno (os campos do pedido, como no agendamento)
  if (rev.kind === 'aproveitarCancelado') {
    if (!Array.isArray(rev.voos) || !rev.voos.length || rev.voos.length > 100 || !Array.isArray(rev.pedidos) || rev.pedidos.length > 100) return null;
    const voos = rev.voos.map(v => {
      if (!objeto(v) || typeof v.fKey !== 'string' || !CHAVE_DO_VOO.test(v.fKey)) return null;
      const fixo = ausente(v.fixo) ? null : normalizarFixos({ [v.fKey]: v.fixo })[v.fKey] || null;
      const status = ausente(v.status) ? null : FLIGHT_STATUSES.includes(v.status) ? v.status : undefined;
      const detalhe = ausente(v.detalhe) ? null : normalizarDetalhes({ [v.fKey]: v.detalhe }, { [v.fKey]: v.status })[v.fKey] || undefined;
      if ((!ausente(v.fixo) && !fixo) || status === undefined || detalhe === undefined) return null;
      return { fKey: v.fKey, fixo, status, detalhe };
    });
    const pedidos = rev.pedidos.map(p => (objeto(p) && idValido(p.stuId) && Number.isInteger(p.mid) && p.mid >= 0 && pedidoDeAntes(p.pedido)
      ? { stuId: p.stuId, mid: p.mid, pedido: pedidoDeAntes(p.pedido) } : null));
    return voos.every(Boolean) && pedidos.every(Boolean) ? { kind: 'aproveitarCancelado', voos, pedidos, label } : null;
  }
  if (rev.kind === 'readicionarRecurso') {
    const { recurso } = novoRecurso(frota, rev.recurso && typeof rev.recurso === 'object' ? rev.recurso : {});
    return recurso ? { kind: 'readicionarRecurso', recurso, av: rev.av !== false, label } : null;
  }
  // Um voo agendado na Escala: o pedido como estava (null: o agendamento criou uma missão extra, que sai), o voo fixo de
  // antes (null: não era fixo) e a disponibilidade do instrutor de antes (null: não mudou). criado: o agendamento criou o
  // voo (sem ele, o voo de hoje do aluno mudou de lugar ou entrou na escala); criadoComo: o pedido como o agendamento o
  // deixou (desfazer só mexe no pedido que ainda é ele). Aqui o rótulo fora do formato (ou em branco: o botão ficaria sem
  // nome) também invalida a reversão
  if (rev.kind === 'desfazerAgendamento') {
    const { stuId, mid, criado } = rev;
    if (!idValido(stuId) || !Number.isInteger(mid) || mid < 0 || typeof criado !== 'boolean' || !rotuloValido(rev.label) || !rev.label.trim()) return null;
    const fKey = chaveDoVoo(stuId, mid);
    const pedido = ausente(rev.pedido) ? null : pedidoDeAntes(rev.pedido);
    const fixo = ausente(rev.fixo) ? null : normalizarFixos({ [fKey]: rev.fixo })[fKey] || null;
    const disponibilidade = ausente(rev.disponibilidade) ? null : disponibilidadeDeAntes(rev.disponibilidade);
    const criadoComo = ausente(rev.criadoComo) ? null : pedidoDeAntes(rev.criadoComo);
    // Sem o pedido de antes, só o voo criado numa missão extra
    const pedidoRuim = ausente(rev.pedido) ? !criado || mid === 0 : !pedido;
    if (pedidoRuim || (!ausente(rev.fixo) && !fixo) || (!ausente(rev.disponibilidade) && !disponibilidade)) return null;
    if (!ausente(rev.criadoComo) && !criadoComo) return null;
    return { kind: 'desfazerAgendamento', stuId, mid, criado, pedido, fixo, disponibilidade, ...(criadoComo ? { criadoComo } : {}), label: rev.label };
  }
  return null;
}

// A missão do pedido: o tipo de missão, o recurso, as horas e a missão do curso. O pedido que muda de missão na Demanda
// solta o voo agendado nele (js/eventos/demanda.js)
const MISSAO_DO_PEDIDO = ['mis', 'eq', 'nb', 'etapa'];
// O que identifica o pedido criado pelo agendamento: a missão e a preferência (o horário agendado). Voar ou não, a
// prioridade, o instrutor e a disponibilidade mudam sem ele deixar de ser o mesmo
const IDENTIDADE_DO_PEDIDO = [...MISSAO_DO_PEDIDO, 'p1', 'p2'];
const mesmoPedido = (p, q) => IDENTIDADE_DO_PEDIDO.every(c => p[c] === q[c]);

// O motivo do voo com resultado registrado (js/eventos/agendamento.js diz o que fazer, sem o resultado na tela)
export const VOO_COM_RESULTADO = 'O voo já tem resultado registrado.';

// O voo agendado na Escala que já está em andamento (Em Voo, Atrasado ou Pousou) ou que já tem resultado registrado não
// é desfeito: o texto do aviso, ou ''. Sem os resultados dos cursos (a leitura falhou: estado.indisponiveis), os
// registros do dia vêm vazios e não dá para conferir; desfazer fica desligado até "Tentar de novo" (o aviso do topo)
// ler os resultados, como o registro de resultados. O pedido do agendamento (o criado, o que mudou de lugar ou o que
// entrou na escala) que mudou depois dele (outra missão, recurso, duração ou horário, ou outro pedido no mesmo número de
// missão extra, que foi tirada e criada de novo) também não: desfazer tiraria ou trocaria um voo que o agendamento não
// deixou assim. Sem o aluno no cadastro, ou sem o pedido do voo que mudou de lugar ou entrou na escala (tirado da
// Demanda depois), não há o que desfazer; o voo criado numa missão extra que saiu da Demanda é desfeito (a chave dele
// fica limpa)
export function motivoParaNaoDesfazer(estado, { stuId, mid, criado, criadoComo = null }) {
  const fKey = chaveDoVoo(stuId, mid);
  const aluno = estado.stu.find(s => s.id === stuId);
  const atual = aluno ? pedidoDoAluno(aluno, mid) : null;
  if (!aluno) return 'O aluno deste voo saiu do cadastro: não há o que desfazer.';
  if (!criado && !atual) return 'O pedido deste voo saiu da Demanda: não há o que desfazer.';
  if (atual && criadoComo && !mesmoPedido(atual, criadoComo)) return 'O pedido mudou depois do agendamento: desfazer agora mexeria em outro voo. Mude o pedido na Demanda.';
  if (STATUS_EM_ANDAMENTO.includes((estado.fStatus || {})[fKey])) return 'O voo já está em andamento: mude o status em vez de desfazer.';
  if ((estado.indisponiveis || []).includes('resultados')) {
    return 'Sem os resultados dos cursos, o app não confere se o voo já tem resultado: clique em "Tentar de novo" no aviso e desfaça depois.';
  }
  if (((estado.resultados || {}).doDia || []).some(r => r && r.voo === fKey)) return VOO_COM_RESULTADO;
  return '';
}

// Desfaz um voo agendado na Escala (a reversão validada acima):
// - o voo que o agendamento criou sai: a missão extra é retirada, ou o pedido principal volta como estava; a chave do
//   voo fica limpa (sem voo fixo, status nem detalhe);
// - o voo movido ou encaixado volta como estava: o pedido (com o instrutor escolhido de antes) e o voo fixo de antes
//   (sem voo fixo antes, ele deixa de ser fixo, e o app o põe de novo na escala; na escala aprovada, em volta dos voos
//   fixos, como um pedido que chegou depois da aprovação); o status e o detalhe dele continuam. Ele já voava antes do
//   agendamento (só o pedido que voa muda de lugar): o "Voa" desligado depois dele continua desligado, e o aluno que o
//   operador tirou da escala não volta para ela (volta para o lugar de antes quando voar de novo). Na turma de Ground,
//   o voo fixo de antes volta para a turma só enquanto ela está como ele a deixou (js/fixos.js, pinoDeVoltaNaTurma). O
//   voo cancelado depois do agendamento, sem voo fixo antes, fica fixo onde foi cancelado, sem a marca do agendamento
//   (como o voo fixo pelo status: o cancelado não volta para a escala, nem ocupa outro lugar);
// - o instrutor marcado disponível no agendamento volta como estava.
// O peso digitado no agendamento fica no cadastro: é da pessoa. Responde se desfez: sem o aluno, ou sem o pedido do voo
// movido (já retirado da demanda), não há o que desfazer (motivoParaNaoDesfazer diz por quê)
export function desfazerAgendamento(estado, { stuId, mid, criado, pedido, fixo, disponibilidade }) {
  const aluno = estado.stu.find(s => s.id === stuId);
  const alvo = aluno ? pedidoDoAluno(aluno, mid) : null;
  if (!aluno || (!criado && !alvo)) return false;
  const fKey = chaveDoVoo(stuId, mid);
  if (!pedido) aluno.extra = (aluno.extra || []).filter(ex => ex.mid !== mid);
  else if (alvo) {
    // Os campos do pedido de agora saem e os de antes voltam; o resto do aluno (o cadastro) e as missões extras ficam. O
    // voo movido ou encaixado que não voa mais continua sem voar
    const voa = alvo.fly;
    CAMPOS_DO_PEDIDO.forEach(c => { delete alvo[c]; });
    Object.assign(alvo, pedido);
    if (!criado && !voa) alvo.fly = false;
    normalizeMissionFields(alvo);
  }
  if (criado) [estado.fixos, estado.fStatus, estado.fObs].forEach(mapa => { if (mapa) delete mapa[fKey]; });
  else if (fixo) estado.fixos = { ...(estado.fixos || {}), [fKey]: { ...pinoDeVoltaNaTurma(estado.fixos, fKey, fixo, alvo.mis) } };
  else if (estado.fixos && estado.fixos[fKey] && fixoPeloStatus(fKey, estado.fStatus)) {
    const { agendado: _, ...peloStatus } = estado.fixos[fKey];
    estado.fixos[fKey] = peloStatus;
  } else if (estado.fixos) delete estado.fixos[fKey];
  if (disponibilidade) {
    const x = estado.ins.find(i => i.id === disponibilidade.insId);
    if (x) Object.assign(x, { on: disponibilidade.on, aw: [...disponibilidade.aw] });
  }
  return true;
}

// Reverter uma mudança nos voos fixos (a troca do instrutor ou um reparo das Sugestões: a entrada do histórico) depois de
// um agendamento na Escala. O histórico da data (as entradas, a mais nova primeiro) diz, por chave de voo, o que a
// reversão não devolve (js/fixos.js, fixosQueVoltam):
// - mudados: a chave de um agendamento feito depois da mudança, que não foi desfeito (o voo fixo e o instrutor escolhido
//   do pedido são os dele), e a de um agendamento de antes dela que foi desfeito depois ("↶ Desfazer" devolveu a chave e o
//   pedido como eram antes do agendamento): nem o voo fixo nem o instrutor escolhido de antes da mudança voltam;
// - soltos: a do agendamento de antes da mudança cujo pedido saiu da Demanda ou mudou de missão (a Demanda soltou o voo
//   agendado): o voo agendado de antes dela não volta.
// O agendamento de antes da mudança, em cada chave, é o último dela que não foi desfeito antes da mudança
export function agendamentosEmVolta(estado, historico, entrada, frota) {
  const mudados = new Set(), soltos = new Set();
  const i = historico.indexOf(entrada);
  if (i < 0) return { mudados, soltos };
  const depois = historico.slice(0, i), antes = historico.slice(i + 1);
  const desfeitas = entradas => new Set(entradas.map(e => e.reverte).filter(id => !ausente(id)));
  const desfeitasDepois = desfeitas(depois), desfeitasAntes = desfeitas(antes);
  const agendamento = e => {
    const rev = validarReversao(e.revert, frota);
    return rev && rev.kind === 'desfazerAgendamento' ? rev : null;
  };
  for (const e of depois) {
    const rev = agendamento(e);
    if (rev && !desfeitasDepois.has(e.id)) mudados.add(chaveDoVoo(rev.stuId, rev.mid));
  }
  const vistas = new Set();
  for (const e of antes) {
    const rev = agendamento(e);
    const fKey = rev ? chaveDoVoo(rev.stuId, rev.mid) : null;
    if (!rev || desfeitasAntes.has(e.id) || vistas.has(fKey)) continue;
    vistas.add(fKey);
    if (desfeitasDepois.has(e.id)) { mudados.add(fKey); continue; }
    const aluno = estado.stu.find(s => s.id === rev.stuId);
    const pedido = aluno ? pedidoDoAluno(aluno, rev.mid) : null;
    if (!pedido || (rev.criadoComo && MISSAO_DO_PEDIDO.some(c => pedido[c] !== rev.criadoComo[c]))) soltos.add(fKey);
  }
  return { mudados, soltos };
}
