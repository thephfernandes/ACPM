// O voo agendado pelo operador na Escala ("+ Agendar voo"; o diálogo é js/views/agendamento.js): um pedido do aluno (o
// principal, quando ele não voa e o dia não guarda nada da chave dele; senão, uma missão extra) e o voo fixo com a marca
// agendado (js/fixos.js), no horário, no recurso e com o instrutor que o operador confirmou. O que o operador define vale
// mais que a escolha do app: o pedido também guarda o instrutor (insId), como a escolha na Escala.
// O diálogo sugere o resto: a missão, pelo progresso do aluno e pelas regras do programa (js/progresso.js); o recurso e o
// instrutor, pelos candidatos do horário contra os voos fixos (js/candidatos.js: o motor encaixa os outros em volta); o
// horário, pelo contexto (a barra da Escala: o primeiro horário livre); a duração, pela missão; o peso, pelo cadastro de
// cada um. A conferência roda o motor numa cópia do estado, com a mesma função que grava (aplicarAgendamento): o que o
// motor marcaria como conflito, no voo novo ou num voo que não estava em conflito, não deixa agendar; as regras do curso,
// as que o motor não confere nos voos fixos, o peso que falta e o voo que sai da escala pedem uma confirmação; o resto é
// informação. O bloqueio vem com as alternativas livres (outro horário, outro recurso, outro instrutor). Um voo de hoje
// do aluno também é agendado: o que está na escala muda de lugar ("Mover"), e o que ficou fora entra ("Encaixar"), com o
// mesmo pedido. No Ground, o aluno entra numa turma do dia ou abre uma turma nova. Tudo aqui é puro: a tela só desenha o
// que sai daqui.
import { MIS, T, NI, DAY, GROUND_EQ_TYPE, GROUND_REG, GROUND_DURATION_MIN, DEFAULT_LIM, MINUTOS_DO_DIA, NOTURNO, MISSOES_LOCAIS, LIMITE_DE_VOOS_LOCAIS } from './config.js';
import {
  alvoDoNovoPedido, normalizeMissionFields, duracaoFixaDaMissao, duracaoPadraoDaMissao, duracaoValida, duracaoDigitada, isGroundMission,
  disponibilidadeDoAluno, rotuloDaDisponibilidade, pesoDigitado, ERRO_DA_DURACAO, ERRO_DO_PESO
} from './rules.js';
import { horariosDaMissao, periodoDoMinuto, paraMinuto } from './horarios.js';
import { ocupacaoDaEscala, avioesQueServem, instrutoresQueServem, problemaDoRecurso, problemaDoAluno } from './candidatos.js';
import { estadoDoAluno, proximasMissoes, progressoNoCurso, missoesDoDia } from './progresso.js';
import { indiceDoPrograma, percursoDoCurso, rotuloDaFase, rotuloDaMissao, noturnosDoCurso } from './programa.js';
import { chaveDoVoo, statusDoVoo, pedidoDoAluno, ocupacaoDoVoo } from './voo.js';
import { CAMPOS_DO_PEDIDO } from './dias.js';
import { runAllocationEngine } from './engine.js';
import { naOrdemDoMotor, rejeicoesDosPedidos } from './rejeicoes.js';
import { CODIGOS_DO_AGENDADO, GRUPO_DO_CONFLITO } from './conflitos.js';
import { fixoPeloStatus, motivoDoFixo } from './fixos.js';
import { STATUS_EM_ANDAMENTO, rotuloDoStatus, intervaloEfetivo } from './status.js';
import { pesoECombustivel, textoDoCombustivel } from './combustivel.js';
import { NOTA_DO_PROBLEMA } from './instrutor-escolhido.js';
import { sobrepoe } from './viabilidade.js';
import { hm, fmtH, numeroBr, rotuloDaData, somarDias, duracaoHm } from './format.js';
import { normalizarLimites } from './limites.js';
import { repousoAntesDaVolta } from './noturno.js';
import { nomeDoRecurso } from './categorias.js';
import { CATEGORIAS_DO_RODIZIO, categoriaDoRodizio, ajustarFilas } from './rodizio.js';
import { FROTA_INICIAL, recursoDaFrota, motivoDoAviao } from './frota.js';
import { podeFazer, nomeDaHabilitacao, PREFIXO_DA_HABILITACAO_DO_AVIAO } from './habilitacoes.js';
import { ehDomingo } from './agenda.js';
import { inativoNoEstado } from './inativos.js';

const frotaDo = estado => (Array.isArray(estado.frota) ? estado.frota : FROTA_INICIAL);
const ativo = (o, fStatus) => statusDoVoo(o, fStatus) !== 'Cancelado';
const pedidosQueVoam = stu => [stu, ...(stu.extra || [])].filter(p => p.fly);
const porNome = (x, y) => x.nm.localeCompare(y.nm, 'pt-BR') || x.id - y.id;
const maiuscula = texto => texto.charAt(0).toUpperCase() + texto.slice(1);
const minuscula = texto => texto.charAt(0).toLowerCase() + texto.slice(1);
// "A", "A e B", "A, B e C"
const juntar = lista => (lista.length < 2 ? lista.join('') : `${lista.slice(0, -1).join(', ')} e ${lista.at(-1)}`);
const ddmm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const camposDoPedido = p => Object.fromEntries(CAMPOS_DO_PEDIDO.filter(c => p[c] !== undefined).map(c => [c, p[c]]));
const rotuloDoVoo = o => (o.mid ? `${o.s} (${o.mis})` : o.s);
// Onde o voo está: "no PR-VOB", ou "na sala de Ground"; os horários do tipo: "horários do C152", ou "horários das aulas de
// Ground"
const noRecurso = r => (r === GROUND_REG ? 'na sala de Ground' : `no ${nomeDoRecurso(r)}`);
const horariosDoTipo = tipo => (tipo === GROUND_EQ_TYPE ? 'horários das aulas de Ground' : `horários do ${tipo}`);

// A data aberta nos textos do diálogo, pelo nome certo: hoje, amanhã (a data que o operador costuma montar) ou a data
// ("12/11"; em outro ano, com o ano). Três formas: depois de "de" ("Na demanda de amanhã"), depois de um verbo ("voa
// amanhã às 08:20"; a data, "em 12/11") e antes de um horário ("amanhã 08:20"). Sem a data, "do dia" e nada
export function nomeDaData({ data, hoje } = {}) {
  const { relativo = '', data: diaMes = '' } = data && hoje ? rotuloDaData(data, hoje) : {};
  const nome = ['hoje', 'amanhã'].includes(relativo) ? relativo : diaMes;
  return { de: nome ? `de ${nome}` : 'do dia', quando: nome && nome === diaMes ? `em ${nome}` : nome, curto: nome };
}
// O horário de um voo na data: "amanhã 08:20" (sem a data, só o horário)
const naData = (dia, minuto) => [dia.curto, hm(minuto)].filter(Boolean).join(' ');
// O verbo com a data e os horários: "voa amanhã às 06:30, 10:10"
const naDataAs = (dia, verbo, horarios) => [verbo, dia.quando, `às ${horarios}`].filter(Boolean).join(' ');

// ---------------------------------------------------------------------------------------------------------------------
// O contexto e os horários

// O contexto de onde o diálogo abriu (data-agendar): a barra da Escala ('dia'), a linha de um recurso ('r:PR-VOB') ou de
// um instrutor ('i:7') no mapa, um horário da lista ('w:2'), a turma de Ground ('t:<turma>'), ou o clique no mapa
// ({ r ou insId, minuto }). minuto: de onde a busca do horário parte; desde e ate: os limites dela (null: sem limite);
// perto: o horário mais perto do minuto (o clique), senão o primeiro livre a partir dele. Na data de hoje, a partir de agora
export function contextoInicial(valor, { data, hoje, agora = 0 } = {}) {
  const agoraNaData = data === hoje ? agora : null;
  const contexto = {
    valor: typeof valor === 'string' ? valor : null, origem: 'dia', r: null, insId: null, classKey: null, w: null,
    minuto: agoraNaData ?? 0, desde: agoraNaData, ate: null, perto: false
  };
  if (valor && typeof valor === 'object') {
    return {
      ...contexto, origem: 'mapa', r: typeof valor.r === 'string' ? valor.r : null, insId: Number.isInteger(valor.insId) ? valor.insId : null,
      minuto: Number.isInteger(valor.minuto) ? valor.minuto : contexto.minuto, desde: null, perto: true
    };
  }
  const [tipo, ...resto] = String(valor || 'dia').split(':');
  const arg = resto.join(':');
  if (tipo === 'r' && arg) return { ...contexto, origem: 'recurso', r: arg };
  if (tipo === 'i' && /^\d+$/.test(arg) && +arg > 0) return { ...contexto, origem: 'instrutor', insId: +arg };
  if (tipo === 'w' && /^[0-8]$/.test(arg)) {
    const w = +arg;
    return { ...contexto, origem: 'periodo', w, minuto: T[w], desde: T[w], ate: w < NI ? T[w + 1] : MINUTOS_DO_DIA };
  }
  if (tipo === 't' && arg) return { ...contexto, origem: 'turma', classKey: arg };
  return contexto;
}

// Os horários de decolagem do agendamento: o Ground, só nas janelas do dia (T[0] a T[7]); o resto, os da missão no tipo
// (o Noturno às 17:30, o Voo Solo às 06:30, o PA-34 de 30 em 30 minutos, os outros, a lista da categoria). Só os que caem
// numa janela de operação aberta nesta data
export function horariosDoAgendamento(estado, { mis, tipo }) {
  const lista = isGroundMission(mis) ? DAY.map(w => T[w]) : horariosDaMissao(estado.horarios, mis, tipo);
  return lista.filter(m => !Array.isArray(estado.win) || estado.win[periodoDoMinuto(m)]);
}

// O horário da lista mais perto do minuto em que a linha (o recurso ou o instrutor) está livre (livre(horário)); no
// empate, o mais cedo; nenhum livre, o mais perto. Sem horários, null
export function encaixarHorario(minuto, lista, livre = () => true) {
  const naOrdem = [...lista].sort((x, y) => Math.abs(x - minuto) - Math.abs(y - minuto) || x - y);
  return naOrdem.find(m => livre(m)) ?? naOrdem[0] ?? null;
}

// As horas do voo agendado: a duração que não muda (o Ground, 1h30; o Noturno, 4 h no dia), a da missão do programa, a
// do pedido que muda de lugar, a padrão da missão (o simulador, 2 h) ou 1 h. fixa: o campo fica travado
export function duracaoDoAgendamento({ mis, missao = null, pedido = null }) {
  const fixa = duracaoFixaDaMissao(mis);
  if (fixa) return { horas: fixa, fixa: true };
  return { horas: duracaoValida((missao && missao.nb) || (pedido && pedido.nb) || duracaoPadraoDaMissao(mis)), fixa: false };
}

// ---------------------------------------------------------------------------------------------------------------------
// A ocupação do dia: os voos fixos (que o agendamento não tira do lugar) e todos (os outros, o motor reorganiza)

// Calculada uma vez por escala (a base do diálogo) e voo que muda de lugar. exceto: as chaves dos voos que não contam (o
// voo movido não ocupa o lugar de onde sai)
const ocupacoesDaBase = new WeakMap();
function ocupacoes(estado, base, exceto = []) {
  if (!ocupacoesDaBase.has(base)) ocupacoesDaBase.set(base, new Map());
  const daBase = ocupacoesDaBase.get(base), chave = exceto.join('|');
  if (!daBase.has(chave)) {
    const voos = naOrdemDoMotor(estado, base.out);
    const opcoes = { fStatus: estado.fStatus || {}, fObs: estado.fObs || {}, efetivo: true, exceto };
    daBase.set(chave, { fixos: ocupacaoDaEscala(voos, { ...opcoes, soFixos: true }), todos: ocupacaoDaEscala(voos, opcoes) });
  }
  return daBase.get(chave);
}

// O horário s serve ao voo de minutos no recurso r, com o instrutor x (sem ele, qualquer um) e para o aluno, contra os
// voos fixos (sem os de exceto): o recurso, o aluno e o instrutor livres (a volta do noturno ocupa até as 10:10)
function livreNosFixos(estado, base, { stu, r, x, mis, tipo, minutos, ground, stuKg, curso, exceto = [] }) {
  const { fixos } = ocupacoes(estado, base, exceto);
  return s => {
    if (r && problemaDoRecurso(estado, fixos, r, { a: s, b: s + minutos, ground })) return false;
    if (problemaDoAluno(fixos, stu.id, { a: s, b: s + minutos })) return false;
    if (!x) return true;
    const doInstrutor = instrutoresQueServem(estado, fixos, { mis, tipo, a: s, b: s + minutos, alunos: [stu], stuKg, curso, r }).find(c => c.x === x);
    return Boolean(doInstrutor) && !doInstrutor.problemas.length;
  };
}

// As turmas de Ground da missão na escala (sem os voos de exceto): a chave, o horário, o instrutor e quantos alunos, na
// ordem do horário. A turma cancelada não conta
function turmasDoDia(estado, base, mis, exceto = []) {
  const fora = new Set(exceto);
  const turmas = new Map();
  for (const o of base.out) {
    if (!o.isGround || o.mis !== mis || !o.classKey || fora.has(o.fKey) || !ativo(o, estado.fStatus)) continue;
    if (!turmas.has(o.classKey)) turmas.set(o.classKey, { classKey: o.classKey, mis, a: o.a, b: o.b, insId: o.insId, ins: o.ins, n: 0 });
    turmas.get(o.classKey).n++;
  }
  return [...turmas.values()].sort((p, q) => p.a - q.a || p.insId - q.insId);
}
const textoDaTurma = t => `Entrar na turma das ${hm(t.a)} com ${t.ins} (${t.n} ${t.n === 1 ? 'aluno' : 'alunos'})`;

const sobrepoeVoo = (a, b) => o => sobrepoe(a, b, ...ocupacaoDoVoo(o));
const ocupaDaLista = (mapa, chave, a, b) => (mapa.get(chave) || []).find(sobrepoeVoo(a, b)) || null;
const textoDoVooFixo = o => (o.trecho === 'volta' ? `volta do noturno (livre às ${hm(o.livreAs)})`
  : o.isGround ? `turma fixa ${hm(o.a)}–${hm(o.b)} (${o.mis})` : `voo fixo ${hm(o.a)}–${hm(o.b)} (${o.s})`);

// ---------------------------------------------------------------------------------------------------------------------
// O curso do aluno: a próxima missão, o progresso e por que uma missão está fora da ordem

// O programa do aluno (null: sem curso, ou o curso não está no programa)
const cursoDoAluno = (ambiente, stu) => (stu && stu.curso && indiceDoPrograma(ambiente.programa || []).curso(stu.curso)) || null;

// As missões do curso que o aluno já tem no dia (os pedidos dele que voam, menos os cancelados: não são sugeridas de
// novo), as dos voos dele na escala que terminam até o horário a (contam como feitas sob condição: dependem do resultado)
// e o voo de cada uma (pelo id da missão). mid: o pedido que muda de lugar (o dele não conta; null: nenhum)
function missoesNoDia(estado, base, curso, stu, a, mid = null) {
  const idDe = new Map(curso.missoes.map(m => [m.codigo, m.id]));
  const voos = base.out.filter(o => o.stuId === stu.id && (mid === null || (o.mid || 0) !== mid) && o.etapa && !o.trecho && ativo(o, estado.fStatus) && idDe.has(o.etapa));
  return {
    exceto: missoesDoDia(curso, stu, { fStatus: estado.fStatus, mid }),
    planejadas: new Set(voos.filter(o => o.b <= a).map(o => idDe.get(o.etapa))),
    voos: new Map(voos.map(o => [idDe.get(o.etapa), o]))
  };
}

// O motivo curto de o pedido ter ficado fora da escala, pelo código da rejeição do motor
const FORA_DA_ESCALA = {
  'equipamento-da-missao': 'a missão não voa nesse tipo de avião', 'ground-pendente': 'o Ground antes dele ficou fora',
  'ground-antes-do-voo-fixo': 'sem horário antes do voo fixo', 'so-parafuso': 'sem o avião do Parafuso', 'sem-aviao': 'sem avião disponível',
  'sem-instrutor-habilitado': 'sem instrutor habilitado', 'disponibilidade-do-aluno': 'fora da disponibilidade do aluno',
  'depois-do-ground': 'sem horário depois do Ground', 'sem-horario': 'sem horário aberto', 'aluno-ocupado': 'o aluno já voa nos horários',
  'avioes-ocupados': 'sem avião livre', 'sala-ocupada': 'a sala de Ground ocupada', revisao: 'sem saldo até a revisão de 50 h',
  'instrutores-indisponiveis': 'sem instrutor disponível', 'instrutores-ocupados': 'sem instrutor livre', bloqueio: 'em Não escalar com',
  'limite-da-lei': 'o limite da lei', peso: 'o peso acima do limite', 'limite-de-locais': 'o limite de voos locais no horário',
  'instrutor-escolhido': 'o instrutor escolhido não serve', 'habilitacao-do-aviao': 'sem a habilitação própria do avião'
};
// As recusas da base ligadas aos pedidos (js/rejeicoes.js), uma vez por base
const recusasDaBase = new WeakMap();
const recusasDe = (estado, base) => {
  if (!recusasDaBase.has(base)) recusasDaBase.set(base, rejeicoesDosPedidos(estado, base));
  return recusasDaBase.get(base);
};
// Por que o pedido ficou fora da escala: a recusa do motor ligada a ele (dois alunos de mesmo nome não se confundem)
function motivoDeFora(estado, base, stu, p) {
  const err = recusasDe(estado, base).get(chaveDoVoo(stu.id, p.mid || 0));
  return (err && FORA_DA_ESCALA[err.codigo]) || 'sem lugar na escala';
}

// A missão do curso de um pedido do aluno (o código dele, no curso dele), com o estado dela no horário a sem o próprio
// pedido (o voo que muda de lugar não conta como feito nem como do dia): a ordem do curso é conferida de novo no horário
// novo. Sem a missão no programa, null; sem os resultados, o estado fica null
function missaoDoPedido(estado, base, ambiente, stu, p, a) {
  const sigla = p.cursoDaEtapa || stu.curso;
  const indice = indiceDoPrograma(ambiente.programa || []);
  const curso = p.etapa && sigla ? indice.curso(sigla) : null;
  const m = curso ? indice.missaoPorCodigo(sigla, p.etapa) : null;
  if (!m || m.removida) return null;
  const comum = { missao: m, sigla, rotulo: rotuloDaMissao(curso, m) };
  if (!ambiente.inferir) return { ...comum, estado: null };
  const mid = p.mid || 0;
  const { exceto, planejadas, voos } = missoesNoDia(estado, base, curso, stu, a, mid);
  const info = estadoDoAluno(curso, ambiente.situacao, stu.id, { planejadas, exceto }).porMissao.get(m.id);
  if (!info || info.estado === 'no-noturno') return { ...comum, estado: null };
  const motivo = info.estado === 'bloqueada' ? motivoDaMissao(curso, ambiente, stu, m, info, voos) : '';
  return { ...comum, estado: info.estado, motivo, dependeDe: descreverDependencias(curso, info.dependeDe, voos, nomeDaData(ambiente)) };
}

// Os voos do aluno na data (o grupo "Voos de amanhã do aluno" do select Missão): cada pedido dele que voa. O que está
// na escala muda de lugar ("Mover PP-07 · Navegação (amanhã 10:10, PR-VOC)"); o que ficou fora entra ("Encaixar PP-07 ·
// Navegação (ficou fora: sem avião livre)"); o em andamento e o cancelado ficam desligados, com o status. O pedido
// continua o mesmo: a missão, a missão do curso, o status e o detalhe dele
function voosDeHoje(estado, base, ambiente, stu, a) {
  const naEscala = new Map(base.out.filter(o => o.stuId === stu.id && !o.trecho).map(o => [o.fKey, o]));
  const dia = nomeDaData(ambiente);
  return pedidosQueVoam(stu).map(p => {
    const mid = p.mid || 0, fKey = chaveDoVoo(stu.id, mid);
    const voo = naEscala.get(fKey) || null;
    const status = statusDoVoo(voo || { fKey }, estado.fStatus);
    const travado = [...STATUS_EM_ANDAMENTO, 'Cancelado'].includes(status) ? status : null;
    const doCurso = missaoDoPedido(estado, base, ambiente, stu, p, a);
    const nome = `${doCurso ? doCurso.rotulo : p.etapa || ''}${p.etapa ? ' · ' : ''}${p.mis}`;
    const texto = `${voo ? `Mover ${nome} (${naData(dia, voo.a)}, ${nomeDoRecurso(voo.r)})` : `Encaixar ${nome} (ficou fora: ${motivoDeFora(estado, base, stu, p)})`}`
      + (travado ? ` — ${rotuloDoStatus(travado, voo).toLowerCase()}` : '');
    return {
      valor: `pedido:${mid}`, texto, desligada: Boolean(travado),
      info: { tipo: 'pedido', acao: voo ? 'mover' : 'encaixar', mid, pedido: p, voo, status: travado, mis: p.mis, eq: p.eq, ...doCurso }
    };
  });
}

// A preferência de cada missão pelo contexto (a linha clicada no mapa): no recurso, 2 quando o programa faz a missão no
// tipo dele (o Ground na sala; o avião Só Parafuso só para o Parafuso), 1 quando a missão só permite o tipo (o voo fica
// com a missão do curso, com aviso) e 0 quando o recurso não serve; no instrutor, 2 quando ele pode dar a missão. Sem
// contexto, todas iguais (a primeira candidata). curso: a sigla (o Noturno do PC é IFR: só no avião homologado IFR, com
// o instrutor IFR)
function preferenciaDoContexto(estado, contexto, curso) {
  if (contexto.r === GROUND_REG) return m => (isGroundMission(m.mis) ? 2 : 0);
  if (contexto.r) {
    const recurso = recursoDaFrota(frotaDo(estado), contexto.r);
    return m => {
      if (!recurso || isGroundMission(m.mis) || !MIS[m.mis].eq.includes(recurso.tipo)) return 0;
      if (motivoDoAviao(recurso, { mis: m.mis, eq: recurso.tipo, curso })) return 0;
      return m.eq === recurso.tipo ? 2 : 1;
    };
  }
  if (contexto.insId) {
    const x = estado.ins.find(i => i.id === contexto.insId);
    return m => (x && podeFazer(x, m.mis, isGroundMission(m.mis) ? GROUND_EQ_TYPE : m.eq, { curso }) ? 2 : 0);
  }
  return () => 2;
}

// Por que a missão está fora da ordem (nas opções e no aviso): a missão do dia que voa depois ("PE-01 voa depois, às
// 13:40"), as fases que ela espera ("a Fase 6 abre depois da Fase 4: faltam TMA-04 e TMA-05") ou as missões que faltam
// ("falta PE-03 (reprovada em 14/11)")
function motivoDaMissao(curso, ambiente, stu, m, info, voosDoDia) {
  const porId = new Map(curso.missoes.map(x => [x.id, x]));
  const listar = ids => {
    const codigos = ids.map(id => porId.get(id).codigo);
    return codigos.length <= 3 ? juntar(codigos) : `${codigos.slice(0, 3).join(', ')} e mais ${codigos.length - 3}`;
  };
  const falta = ids => `${ids.length === 1 ? 'falta' : 'faltam'} ${listar(ids)}`;
  const voaDepois = info.faltam.map(id => voosDoDia.get(id)).find(Boolean);
  if (voaDepois) return `${voaDepois.etapa} voa depois, às ${hm(voaDepois.a)}`;
  if (info.fasesFechadas.length) {
    const fases = new Map(curso.fases.map(f => [f.id, f]));
    const daFase = new Set(curso.missoes.filter(x => info.fasesFechadas.includes(x.fase)).map(x => x.id));
    const faltam = info.faltam.filter(id => daFase.has(id));
    const esperadas = info.fasesFechadas.map((id, i) => `${i ? 'da ' : ''}${rotuloDaFase(fases.get(id))}`);
    return `a ${rotuloDaFase(fases.get(m.fase))} abre depois da ${juntar(esperadas)}${faltam.length ? `: ${falta(faltam)}` : ''}`;
  }
  if (!info.faltam.length) return 'fora da ordem do programa';
  const registro = info.faltam.length === 1 ? (ambiente.situacao || new Map()).get(`${stu.id}|${curso.sigla}|${porId.get(info.faltam[0]).codigo}`) : null;
  return `${falta(info.faltam)}${registro && registro.resultado === 'reprovado' && registro.data ? ` (reprovada em ${ddmm(registro.data)})` : ''}`;
}

// A missão na lista: o código (a noite de um Noturno em trechos com os translados, como na próxima missão), o tipo, o
// recurso e as horas do voo (a duração fixa da missão vale mais que a do programa: o Noturno voa as 4 h do dia, a ida e
// a noite, mesmo com a noite de 3 h no programa)
const descreverMissao = (curso, m) => `${rotuloDaMissao(curso, m)} · ${m.mis}${isGroundMission(m.mis) ? ' · 1h30' : ` · ${m.eq} · ${fmtH(duracaoFixaDaMissao(m.mis) || m.nb)}`}`;
// O rótulo da missão seguido de um parêntese (na nota, a fase dela): o Noturno em trechos fica "NOT, com TSL-01 e
// TSL-02 (Fase 6)", sem dois parênteses seguidos
const rotuloAntesDoParentese = (curso, m) => rotuloDaMissao(curso, m).replace(/ \((com [^)]+)\)$/, ', $1');
// As missões de que uma depende, com o voo de cada uma na data ("IN-01 (amanhã 06:30)"); dia: nomeDaData
const descreverDependencias = (curso, ids, voosDoDia, dia) => juntar(ids.map(id => {
  const voo = voosDoDia.get(id);
  const m = curso.missoes.find(x => x.id === id);
  return voo ? `${m.codigo} (${naData(dia, voo.a)})` : m.codigo;
}));

// Os alunos (o select Aluno), em grupos: os que têm um pedido que ficou fora da escala, os que voam na data e os outros.
// Cada um com o curso e a próxima missão, os horários em que já voa e, com o instrutor do contexto, o "Não escalar com"
export function opcoesDeAluno(estado, base, ambiente, contexto = {}) {
  const naEscala = new Set(base.out.map(o => o.fKey));
  const instrutor = contexto.insId ? estado.ins.find(x => x.id === contexto.insId) : null;
  const dia = nomeDaData(ambiente);
  const grupos = [['Ficaram fora da escala', []], [`Na demanda ${dia.de}`, []], ['Outros alunos', []]];
  for (const stu of [...estado.stu].sort(porNome)) {
    const pedidos = pedidosQueVoam(stu);
    const curso = ambiente.inferir ? cursoDoAluno(ambiente, stu) : null;
    let proxima = null;
    if (curso) {
      const doDia = missoesDoDia(curso, stu, { fStatus: estado.fStatus });
      proxima = proximasMissoes(curso, ambiente.situacao, stu.id, { planejadas: doDia, exceto: doDia }).padrao;
    }
    const voos = base.out.filter(o => o.stuId === stu.id && ativo(o, estado.fStatus));
    const texto = [
      stu.nm, stu.curso ? ` — ${stu.curso}${proxima ? ` · próxima ${rotuloDaMissao(curso, proxima)}` : ''}` : '',
      voos.length ? ` · ${naDataAs(dia, 'voa', voos.map(o => hm(o.a)).join(', '))}` : '',
      instrutor && (stu.bl || []).includes(instrutor.id) ? ` · não voa com ${instrutor.nm}` : ''
    ].join('');
    const fora = pedidos.some(p => !naEscala.has(chaveDoVoo(stu.id, p.mid || 0)));
    const grupo = fora ? 0 : pedidos.length ? 1 : 2;
    // O aluno inativo no cadastro só aparece com um pedido na data (fora da escala ou nela), nunca em "Outros alunos"
    if (grupo === 2 && inativoNoEstado(estado, stu)) continue;
    grupos[grupo][1].push({ valor: stu.id, texto });
  }
  return grupos.filter(([, opcoes]) => opcoes.length).map(([rotulo, opcoes]) => ({ rotulo, opcoes }));
}

// O aluno no diálogo: o curso, a fase, as aprovadas, a próxima missão, os voos dele na data e o pedido que ficou fora da
// escala ("PP · Fase 4 · 12/46 · próxima TMA-03 · já voa amanhã às 08:20 (TMA-02, PR-VOC)")
function infoDoAluno(estado, base, ambiente, stu) {
  const partes = [];
  const curso = cursoDoAluno(ambiente, stu);
  if (stu.curso) partes.push(`${stu.curso}${curso && curso.ativo === false ? ' (encerrado)' : ''}`);
  if (curso && ambiente.inferir) {
    const { aprovadas, total, faseAtual, proxima } = progressoNoCurso(curso, ambiente.situacao, stu.id);
    if (faseAtual && percursoDoCurso(curso).fases.length > 1) partes.push(rotuloDaFase(faseAtual));
    if (total) partes.push(`${aprovadas}/${total}`);
    if (proxima) partes.push(`próxima ${rotuloDaMissao(curso, proxima)}`);
  }
  const voos = base.out.filter(o => o.stuId === stu.id && ativo(o, estado.fStatus));
  if (voos.length) partes.push(naDataAs(nomeDaData(ambiente), 'já voa', voos.map(o => `${hm(o.a)} (${[o.etapa || o.mis, nomeDoRecurso(o.r)].join(', ')})`).join('; ')));
  const naEscala = new Set(base.out.map(o => o.fKey));
  const fora = pedidosQueVoam(stu).filter(p => !naEscala.has(chaveDoVoo(stu.id, p.mid || 0)));
  if (fora.length) partes.push(`ficou fora da escala: ${fora.map(p => p.mis).join(', ')}`);
  return partes.join(' · ');
}

// As missões que o aluno pode voar (o select Missão), em grupos: os voos do aluno na data (mover o que está na escala,
// encaixar o que ficou fora), as liberadas do curso (a condicional diz de que resultado depende), as outras missões do
// curso, fora da ordem (com o motivo: pedem confirmação), e as missões sem o curso (os tipos de missão que o recurso
// serve, e "Outro tipo de missão…"). Sem os resultados, as missões do curso vêm sem a ordem conferida, e não há missão
// padrão. O Noturno em trechos vai pela noite, como na próxima missão (com os translados no nome): os translados dele
// nunca vão sozinhos, nem o dispensado (o pedido leva o código da noite, e o resultado é dela). A missão padrão, nesta
// ordem: na turma de Ground do contexto, o Ground dela (o pedido do aluno com ele, a missão do curso ou o tipo); o pedido
// que ficou fora da escala ("Encaixar"); o pedido que já tem a próxima missão do curso, contada sem os voos de hoje
// ("Mover": o diálogo nunca sugere a seguinte por cima de um pedido que já existe); a próxima do curso; o tipo de missão.
// Devolve os grupos (cada opção: valor, texto e o que a conferência usa), a missão padrão (valor, ou null) e a nota com a
// próxima e as outras liberadas
export function opcoesDeMissao(estado, base, ambiente, stu, { a = 0, contexto = {}, recurso = null, turma = null } = {}) {
  const curso = cursoDoAluno(ambiente, stu);
  const grupos = [];
  let padrao = null, nota = '';
  const dia = nomeDaData(ambiente);
  const deHoje = voosDeHoje(estado, base, ambiente, stu, a);
  if (deHoje.length) grupos.push({ rotulo: `Voos ${dia.de} do aluno`, opcoes: deHoje });
  let liberadasDoCurso = [];
  if (curso) {
    const percurso = percursoDoCurso(curso);
    const faseDe = new Map(percurso.fases.map(f => [f.id, f]));
    const variasFases = percurso.fases.length > 1;
    const comum = m => ({ tipo: 'missao', missao: m, mis: m.mis, eq: m.eq, sigla: curso.sigla });
    const noturnos = noturnosDoCurso(curso);
    const missoes = percurso.missoes.filter(m => !noturnos.has(m.id) || noturnos.get(m.id).noite.id === m.id);
    if (ambiente.inferir) {
      const { exceto, planejadas, voos } = missoesNoDia(estado, base, curso, stu, a);
      const { porMissao } = estadoDoAluno(curso, ambiente.situacao, stu.id, { planejadas, exceto });
      const { padrao: proxima, candidatas } = proximasMissoes(curso, ambiente.situacao, stu.id, {
        planejadas, exceto, preferencia: preferenciaDoContexto(estado, contexto, curso.sigla)
      });
      const liberadas = candidatas.map(m => {
        const info = porMissao.get(m.id);
        const dependeDe = descreverDependencias(curso, info.dependeDe, voos, dia);
        const depende = info.estado === 'condicional' ? ` — depende do resultado de ${dependeDe}` : '';
        return { valor: `missao:${m.id}`, texto: `${descreverMissao(curso, m)}${depende}`, info: { ...comum(m), estado: info.estado, dependeDe } };
      });
      const foraDaOrdem = missoes.filter(m => !candidatas.includes(m)).map(m => {
        const info = porMissao.get(m.id) || { estado: 'bloqueada', faltam: [], fasesFechadas: [], dependeDe: [] };
        const voo = info.estado === 'no-dia' ? [...(voos.values())].find(o => o.etapa === m.codigo) : null;
        const motivo = info.estado === 'aprovada' ? 'já aprovada' : info.estado === 'dispensada' ? 'dispensada'
          : info.estado === 'no-dia' ? (voo ? `já no voo ${dia.de} às ${hm(voo.a)}` : `já em outro pedido ${dia.de}`)
            : motivoDaMissao(curso, ambiente, stu, m, info, voos);
        const texto = info.estado === 'bloqueada' ? `${descreverMissao(curso, m)} — ${motivo}` : `${descreverMissao(curso, m)} (${motivo})`;
        return { valor: `missao:${m.id}`, texto, info: { ...comum(m), estado: info.estado, motivo } };
      });
      liberadasDoCurso = liberadas;
      if (liberadas.length) grupos.push({ rotulo: `Liberadas no ${curso.sigla}`, opcoes: liberadas });
      if (foraDaOrdem.length) grupos.push({ rotulo: 'Fora da ordem (pede confirmação)', opcoes: foraDaOrdem });
      if (proxima) {
        padrao = `missao:${proxima.id}`;
        const onde = m => {
          const fase = faseDe.get(m.fase);
          return m.regra === 'livre' ? `livre na ${rotuloDaFase(fase)}` : variasFases ? rotuloDaFase(fase) : '';
        };
        const comOnde = m => (onde(m) ? `${rotuloAntesDoParentese(curso, m)} (${onde(m)})` : rotuloDaMissao(curso, m));
        const outras = candidatas.filter(m => m !== proxima);
        nota = `Próxima do ${curso.sigla}: ${comOnde(proxima)}.${outras.length ? ` Também ${outras.length === 1 ? 'liberada' : 'liberadas'}: ${outras.map(comOnde).join(', ')}.` : ''}`;
      } else nota = percurso.missoes.length ? `Nenhuma missão do ${curso.sigla} liberada agora.` : `O programa do ${curso.sigla} não tem missões.`;
    } else {
      grupos.push({
        rotulo: `Missões do ${curso.sigla} (a ordem não foi conferida)`,
        opcoes: missoes.map(m => ({ valor: `missao:${m.id}`, texto: descreverMissao(curso, m), info: { ...comum(m), estado: null } }))
      });
      nota = 'Sem os resultados dos cursos, a ordem do programa não é conferida: escolha a missão.';
    }
    if (curso.ativo === false) nota = `O curso ${curso.sigla} está encerrado. ${nota}`;
  }
  // Sem os programas dos cursos (a leitura falhou, ou ainda não foram trazidos do cadastro), as missões do curso do aluno
  // não aparecem, e nenhuma missão é sugerida: o operador escolhe
  const semPrograma = !curso && Boolean(stu.curso) && Boolean(ambiente.programaIndisponivel);
  if (semPrograma) nota = `Sem os programas dos cursos, as missões do ${stu.curso} não aparecem: escolha a missão.`;
  else if (!curso && stu.curso && (ambiente.programa || []).length) nota = `O curso ${stu.curso} não está no programa dos cursos.`;
  // Sem missão do curso: os tipos de missão que o recurso serve (sem recurso, todos), e os outros pelo "Tipo de missão"
  const serve = mis => !recurso || (recurso === GROUND_REG ? isGroundMission(mis)
    : !isGroundMission(mis) && MIS[mis].eq.includes(recurso.tipo) && !motivoDoAviao(recurso, { mis, eq: recurso.tipo, curso: stu.curso }));
  const tipos = Object.keys(MIS).filter(serve);
  grupos.push({
    rotulo: 'Sem missão do curso',
    opcoes: [...tipos.map(mis => ({ valor: `tipo:${mis}`, texto: mis, info: { tipo: 'tipo', mis } })),
      ...(recurso ? [{ valor: 'tipo:', texto: 'Outro tipo de missão…', info: { tipo: 'outro' } }] : [])]
  });
  if (!padrao && !semPrograma && (!curso || ambiente.inferir)) padrao = `tipo:${tipos.includes('Voo Local') ? 'Voo Local' : tipos[0] || 'Voo Local'}`;
  // Os voos do aluno na data vêm antes da próxima missão: o que ficou fora; o que já tem a próxima do curso (sem os voos
  // da data, ela seria a sugerida). Na turma de Ground, o Ground dela
  const movivel = o => !o.desligada;
  const fora = deHoje.find(o => o.info.acao === 'encaixar' && movivel(o));
  const semOHoje = curso && ambiente.inferir ? proximasMissoes(curso, ambiente.situacao, stu.id, { planejadas: new Set(), exceto: new Set() }).padrao : null;
  const comAProxima = semOHoje && deHoje.find(o => o.info.acao === 'mover' && movivel(o) && o.info.missao && o.info.missao.id === semOHoje.id && o.info.sigla === curso.sigla);
  if (turma) {
    const doAluno = [...deHoje].sort((p, q) => (p.info.acao === 'encaixar' ? 0 : 1) - (q.info.acao === 'encaixar' ? 0 : 1))
      .find(o => movivel(o) && o.info.mis === turma.mis);
    const doCurso = liberadasDoCurso.find(o => o.info.mis === turma.mis);
    padrao = (doAluno || doCurso || { valor: tipos.includes(turma.mis) ? `tipo:${turma.mis}` : padrao }).valor;
  } else if (fora) padrao = fora.valor;
  else if (comAProxima) padrao = comAProxima.valor;
  return { grupos, padrao, nota };
}

// ---------------------------------------------------------------------------------------------------------------------
// Os candidatos: os recursos e os instrutores no horário, contra os voos fixos

function textoDoRecurso(problema, { mis, instrutor }) {
  return {
    'aviao-indisponivel': () => 'em manutenção',
    'aviao-ocupado': () => textoDoVooFixo(problema.voo),
    'sala-ocupada': () => textoDoVooFixo(problema.voo),
    revisao: () => 'sem saldo até a revisão de 50 h',
    'so-parafuso': () => (mis === 'Parafuso' ? 'não é Só Parafuso' : 'só Parafuso'),
    'so-vfr': () => 'só VFR (o voo é IFR)',
    'tipo-de-aviao': () => 'outro tipo',
    habilitacao: () => textoDaHabilitacaoQueFalta(problema.motivo, instrutor)
  }[problema.codigo]?.() || problema.codigo;
}

// O que o recurso exige e o instrutor não tem: a habilitação própria (aviao:<matrícula>) como sempre; outra, pelo nome
function textoDaHabilitacaoQueFalta(motivo, instrutor) {
  const quem = instrutor ? ` (${instrutor.nm} não tem)` : '';
  return !motivo || motivo.startsWith(PREFIXO_DA_HABILITACAO_DO_AVIAO) ? `exige a habilitação própria${quem}` : `exige a habilitação ${nomeDaHabilitacao(motivo)}${quem}`;
}

// Os recursos para a missão no horário [a, b) (o select Recurso), contra os voos fixos. O que não serve vem desligado, com
// o motivo: em manutenção, o voo fixo que ocupa, a revisão de 50 horas, o Só Parafuso e o Só VFR, a habilitação própria
// que o instrutor não tem. O que só tem voos que não são fixos no horário vem com a nota "ocupado agora (o app
// reorganiza)". Na ordem: os que servem; os do tipo do programa (sem programa, o tipo padrão da missão): o do tipo que o
// app libera, tirando de lá um voo que não é fixo, vem antes do livre de outro tipo, que pediria a confirmação do recurso
// do programa; os livres (sem voo nenhum no horário, depois os ocupados só por voos que não são fixos); os do instrutor no
// dia; a menor folga; a frente do hangar. exceto: o voo que muda de lugar (não ocupa o recurso de onde sai)
export function opcoesDeRecurso(estado, base, { mis, eq = null, curso, a, b, instrutor = null, exceto = [] }) {
  const { fixos, todos } = ocupacoes(estado, base, exceto);
  const ground = isGroundMission(mis);
  const tipos = ground ? [GROUND_EQ_TYPE] : MIS[mis].eq;
  const preferido = ground ? GROUND_EQ_TYPE : tipos.includes(eq) ? eq : MIS[mis].defEq;
  const doInstrutor = new Set(instrutor ? base.out.filter(o => o.insId === instrutor.id && !exceto.includes(o.fKey) && ativo(o, estado.fStatus)).map(o => o.r) : []);
  return tipos.flatMap(tipo => avioesQueServem(estado, fixos, { tipo, mis, curso, a, b, ground, instrutor }).map(c => ({ ...c, tipo })))
    .map((c, k) => ({ ...c, k, ocupadoAgora: !c.problema && Boolean(problemaDoRecurso(estado, todos, c.r, { a, b, ground })) }))
    .sort((p, q) => Boolean(p.problema) - Boolean(q.problema) || (q.tipo === preferido) - (p.tipo === preferido) || p.ocupadoAgora - q.ocupadoAgora
      || doInstrutor.has(q.r) - doInstrutor.has(p.r) || (p.folga === q.folga ? 0 : p.folga - q.folga) || p.k - q.k)
    .map(c => ({
      valor: c.r, tipo: c.tipo, problema: c.problema, desligada: Boolean(c.problema), ocupadoAgora: c.ocupadoAgora,
      texto: `${nomeDoRecurso(c.r)}${ground ? '' : ` · ${c.tipo}`}${c.problema ? ` — ${textoDoRecurso(c.problema, { mis, instrutor })}` : c.ocupadoAgora ? ' — ocupado agora (o app reorganiza)' : ''}`
    }));
}

// O rodízio da categoria no dia (js/rodizio.js): os voos da categoria de cada instrutor na escala (sem os de exceto e a
// volta do noturno, que contou ontem) e a posição de cada um na fila. Sem categoria, nenhum voo e a mesma posição
function rodizioDoDia(estado, base, categoria, exceto = []) {
  const fila = categoria ? ajustarFilas(estado.filas, estado.ins)[categoria] : [];
  const naCategoria = new Map();
  if (categoria) {
    for (const o of base.out) {
      if (!o.trecho && !exceto.includes(o.fKey) && ativo(o, estado.fStatus) && categoriaDoRodizio(o.mis, o.eqType) === categoria) naCategoria.set(o.insId, (naCategoria.get(o.insId) || 0) + 1);
    }
  }
  return { naCategoria, posicao: id => (fila.includes(id) ? fila.indexOf(id) : Infinity) };
}

// Os instrutores para o voo [a, b) (o select Instrutor), em grupos: os que servem neste horário; os com aviso (o
// indisponível, que o agendamento pode marcar disponível, e o ocupado só com voos que não são fixos: o app reorganiza) e
// os que não servem (desligados: a habilitação, o "Não escalar com", o voo fixo no horário, o limite da lei, o peso
// acima do limite mesmo com o mínimo de combustível), com os textos curtos da Escala. Na ordem: o tanque cheio; nas
// categorias do rodízio, menos voos da categoria no dia e a fila; menos horas no dia, menos habilitações, o id. exceto: o
// voo que muda de lugar (não ocupa o instrutor no horário de onde sai, nem conta no rodízio)
export function opcoesDeInstrutor(estado, base, { mis, tipo, a, b, stu, stuKg = 0, curso, r = null, exceto = [] }) {
  const { fixos, todos } = ocupacoes(estado, base, exceto);
  const categoria = categoriaDoRodizio(mis, tipo);
  const { naCategoria, posicao } = rodizioDoDia(estado, base, categoria, exceto);
  const pares = new Set(stu.voaCom || []);
  const lista = instrutoresQueServem(estado, fixos, { mis, tipo, a, b, alunos: [stu], stuKg, curso, r })
    .map((c, k) => ({ ...c, k }))
    .sort((p, q) => (p.reducao > 0) - (q.reducao > 0)
      || (categoria ? (naCategoria.get(p.x.id) || 0) - (naCategoria.get(q.x.id) || 0) || (posicao(p.x.id) === posicao(q.x.id) ? 0 : posicao(p.x.id) - posicao(q.x.id)) : 0)
      || p.k - q.k);
  const grupos = { servem: [], aviso: [], nao: [] };
  for (const { x, problemas, reducao } of lista) {
    const codigos = problemas.map(p => p.codigo);
    const par = pares.has(x.id) ? ' · Priorizar com' : '';
    const opcao = { valor: x.id, problemas: codigos, reducao, x };
    if (!codigos.length) {
      const agora = ocupaDaLista(todos.instrutores, x.id, a, b);
      grupos[agora ? 'aviso' : 'servem'].push({ ...opcao, texto: `${x.nm}${par}${agora ? ' — ocupado agora (o app reorganiza)' : ''}` });
    } else if (codigos.every(c => c === 'instrutor-indisponivel')) {
      grupos.aviso.push({ ...opcao, texto: `${x.nm}${par} — ${NOTA_DO_PROBLEMA['instrutor-indisponivel']}` });
    } else {
      const codigo = codigos.find(c => c !== 'instrutor-indisponivel');
      const voo = codigo === 'instrutor-ocupado' ? ocupaDaLista(fixos.instrutores, x.id, a, b) : null;
      grupos.nao.push({ ...opcao, desligada: true, texto: `${x.nm}${par} — ${voo ? `ocupado: ${textoDoVooFixo(voo)}` : NOTA_DO_PROBLEMA[codigo] || codigo}` });
    }
  }
  return [['Servem neste horário', grupos.servem], ['Com aviso', grupos.aviso], ['Não servem', grupos.nao]]
    .filter(([, opcoes]) => opcoes.length).map(([rotulo, opcoes]) => ({ rotulo, opcoes }));
}

// ---------------------------------------------------------------------------------------------------------------------
// O formulário: o que o diálogo mostra, montado dos dados e do que o operador escolheu

const BLOQUEIO_SEM_ALUNO = { codigo: 'sem-aluno', texto: 'Escolha o aluno: a missão, o horário e o peso vêm dele.', campo: 'agd-aluno' };

// O peso de um campo: vazio é sem peso (0), como no cadastro; fora de 1 a 300 kg, null
const pesoDoCampo = texto => (String(texto ?? '').trim() === '' ? 0 : pesoDigitado(texto));

// O formulário do agendamento, montado dos dados (estado; base: a escala calculada agora; ambiente: o programa, a situação
// das missões, a data, hoje e agora) e do que o operador já escolheu (escolhas: o valor de cada campo; tocados: os campos
// que ele mudou, que ficam como ele deixou), na ordem: aluno → missão → recurso e instrutor → horário → duração → peso.
// Os campos que ele não mudou recebem o padrão: a missão do progresso (ou o voo de hoje do aluno que ficou fora ou que já
// tem a próxima missão); o recurso e o instrutor que servem no horário de onde o contexto parte; o horário livre do
// recurso e do instrutor; a duração da missão; o peso do cadastro. O voo de hoje que muda de lugar não ocupa o lugar de
// onde sai, fica com o instrutor escolhido do pedido e, sem ele, com o do voo de agora quando serve. No Ground, o
// instrutor pode ser uma turma do dia (entrar nela: o horário e o instrutor são os dela). Devolve as opções de cada campo,
// o valor escolhido, os textos de apoio, os bloqueios de formato e a proposta (o que aplicar)
export function formularioDoAgendamento(estado, base, ambiente, contexto, escolhas = {}, tocados = new Set()) {
  const f = { contexto, formato: [], notas: [], alunos: opcoesDeAluno(estado, base, ambiente, contexto), aluno: null, acao: null, proposta: null };
  const frota = frotaDo(estado);
  // A turma de Ground do contexto ("+ Aluno na turma"): o horário parte dela, na sala
  const daTurma = contexto.classKey ? base.out.find(o => o.isGround && o.classKey === contexto.classKey && ativo(o, estado.fStatus)) || null : null;
  const turmaDoContexto = daTurma ? { classKey: daTurma.classKey, mis: daTurma.mis, a: daTurma.a, ins: daTurma.ins } : null;
  // A descrição do diálogo diz de onde ele abriu desde antes do aluno (sem o horário, que vem dele): a linha do recurso
  // ou do instrutor, o horário da lista, o clique no mapa, a turma ou a data
  f.contextoTexto = textoDoContexto(contexto, ambiente, {
    r: contexto.r, tipo: contexto.r && contexto.r !== GROUND_REG ? (recursoDaFrota(frota, contexto.r) || {}).tipo || null : null,
    turma: turmaDoContexto, instrutor: contexto.insId ? estado.ins.find(i => i.id === contexto.insId) || null : null
  });
  const stu = estado.stu.find(s => s.id === escolhas.aluno) || null;
  if (!stu) { f.formato.push(BLOQUEIO_SEM_ALUNO); return f; }
  f.aluno = stu.id;
  f.alunoInfo = infoDoAluno(estado, base, ambiente, stu);
  const curso = stu.curso || null;
  const ctx = turmaDoContexto ? { ...contexto, r: GROUND_REG, minuto: turmaDoContexto.a, perto: true } : contexto;
  const recursoAtual = (escolhas.recurso && escolhas.recurso !== GROUND_REG ? recursoDaFrota(frota, escolhas.recurso) : escolhas.recurso)
    || (ctx.r && ctx.r !== GROUND_REG ? recursoDaFrota(frota, ctx.r) : ctx.r) || null;

  // A missão: a escolhida, ou a padrão (o voo de hoje do aluno, a próxima do curso no horário escolhido, ou no de onde o
  // contexto parte; sem curso, o tipo)
  const inicio = tocados.has('horario') && Number.isInteger(escolhas.horario) ? escolhas.horario : ctx.minuto;
  const daMissao = opcoesDeMissao(estado, base, ambiente, stu, { a: inicio, contexto: ctx, recurso: recursoAtual, turma: turmaDoContexto });
  const valores = new Set(daMissao.grupos.flatMap(g => g.opcoes.map(o => o.valor)));
  const missao = tocados.has('missao') && valores.has(escolhas.missao) ? escolhas.missao : daMissao.padrao;
  const opcaoDe = (grupos, valor) => grupos.flatMap(g => g.opcoes).find(o => o.valor === valor) || null;
  let info = (missao && opcaoDe(daMissao.grupos, missao) || {}).info || null;
  if (info && info.tipo === 'outro') {
    f.tipos = Object.keys(MIS);
    f.tipo = Object.hasOwn(MIS, escolhas.tipo) ? escolhas.tipo : null;
    info = f.tipo ? { tipo: 'tipo', mis: f.tipo, outro: true } : null;
  }
  f.missoes = daMissao;
  f.missao = missao || '';
  if (!info) {
    f.formato.push({ codigo: 'sem-missao', texto: 'Escolha a missão.', campo: missao ? 'agd-tipo' : 'agd-missao' });
    return f;
  }
  // O voo de hoje do aluno que muda de lugar (ou entra na escala): ele não ocupa o lugar de onde sai. O em andamento e o
  // cancelado ficam onde estão
  const movido = info.tipo === 'pedido' ? info : null;
  const exceto = movido ? [chaveDoVoo(stu.id, movido.mid)] : [];
  f.acao = movido ? movido.acao : null;
  if (movido && movido.status) {
    const texto = movido.status === 'Cancelado' ? `O voo de ${stu.nm} foi cancelado: ele não muda de lugar.`
      : `O voo de ${stu.nm} já está em andamento (${rotuloDoStatus(movido.status, movido.voo).toLowerCase()}): mude o status em vez de mover.`;
    f.formato.push({ codigo: 'voo-em-andamento', texto, campo: 'agd-missao' });
    return f;
  }
  const { mis } = info;
  const ground = isGroundMission(mis);

  // A duração (o Ground e o Noturno: fixa; a do programa; a do pedido que muda de lugar)
  const padraoDaDuracao = duracaoDoAgendamento({ mis, missao: info.tipo === 'missao' ? info.missao : null, pedido: movido ? movido.pedido : null });
  const horas = padraoDaDuracao.fixa || !tocados.has('horas') ? padraoDaDuracao.horas : duracaoDigitada(escolhas.horas);
  f.horas = { valor: padraoDaDuracao.fixa || !tocados.has('horas') ? String(horas) : String(escolhas.horas ?? ''), fixa: padraoDaDuracao.fixa };
  const minutos = ground ? GROUND_DURATION_MIN : Math.round((horas || padraoDaDuracao.horas) * 60);

  // A turma de Ground em que o aluno entra: a escolhida no select Instrutor, ou a do contexto
  const turmas = ground ? turmasDoDia(estado, base, mis, exceto) : [];
  const turmaDe = valor => turmas.find(t => `turma:${t.classKey}` === valor) || null;
  const turma = !ground ? null : tocados.has('instrutor') ? turmaDe(escolhas.instrutor)
    : turmaDoContexto && turmaDoContexto.mis === mis ? turmaDe(`turma:${turmaDoContexto.classKey}`) : null;

  // O recurso e o instrutor no horário de onde o contexto parte; depois, o horário livre deles, e de novo os padrões nele
  const preferido = ground ? GROUND_EQ_TYPE : MIS[mis].eq.includes(info.eq) ? info.eq : recursoAtual && MIS[mis].eq.includes(recursoAtual.tipo) ? recursoAtual.tipo : MIS[mis].defEq;
  const listaDoTipo = tipo => horariosDoAgendamento(estado, { mis, tipo });
  const outro = escolhas.horario === 'outro' && !ground;
  const tocado = (campo, lista) => tocados.has(campo) && lista.includes(escolhas[campo]);
  const primeiroNaLista = lista => lista.find(s => s >= (ctx.desde ?? 0) && (ctx.ate === null || s < ctx.ate)) ?? null;
  const alunoKg = tocados.has('kgAluno') ? pesoDoCampo(escolhas.kgAluno) : stu.kg || 0;
  const pesoDoInstrutor = x => {
    const digitado = (escolhas.kgInstrutor || {})[x.id];
    return digitado !== undefined ? pesoDoCampo(digitado) : x.kg || 0;
  };
  // Algum instrutor serve no recurso no horário, contra os voos fixos (o avião com habilitação própria pede a dele)
  const algumInstrutorServe = (a, r) => instrutoresQueServem(estado, ocupacoes(estado, base, exceto).fixos, {
    mis, tipo: tipoDe(r), a, b: a + minutos, alunos: [stu], stuKg: alunoKg || 0, curso, r
  }).some(c => !c.problemas.length);
  // O recurso que o operador escolheu (ou o do contexto) fica enquanto serve à missão. Sem ele, o do voo que muda de
  // lugar, quando está livre no horário; senão o primeiro que serve; sem o instrutor escolhido, o primeiro do mesmo tipo
  // em que algum instrutor serve: o avião com habilitação própria que ninguém do horário tem não vira o padrão (o peso e
  // a habilitação da missão valem para o tipo inteiro: trocar de tipo fica com o operador)
  const doVoo = movido && movido.voo ? movido.voo : null;
  const escolherRecurso = (a, x) => {
    const opcoes = opcoesDeRecurso(estado, base, { mis, eq: preferido, curso, a, b: a + minutos, instrutor: x, exceto });
    const valores = opcoes.map(o => o.valor);
    const proprio = tocado('recurso', valores) && serveAMissao(escolhas.recurso) ? escolhas.recurso
      : ctx.r && valores.includes(ctx.r) && serveAMissao(ctx.r) ? ctx.r : null;
    const ligadas = opcoes.filter(o => !o.desligada);
    const doTipo = ligadas.filter(o => o.tipo === (ligadas[0] || {}).tipo);
    const oDoVoo = doVoo && serveAMissao(doVoo.r) ? ligadas.find(o => o.valor === doVoo.r && !o.ocupadoAgora) : null;
    const padrao = oDoVoo || (x ? ligadas[0] : doTipo.find(o => algumInstrutorServe(a, o.valor)) || ligadas[0]) || opcoes[0] || {};
    return { opcoes, r: proprio || padrao.valor || null, fixo: Boolean(proprio) };
  };
  const tipoDe = r => (ground ? GROUND_EQ_TYPE : (recursoDaFrota(frota, r) || {}).tipo || preferido);
  // O instrutor: o que o operador escolheu; o escolhido do pedido que muda de lugar; o da linha clicada; o primeiro do
  // "Priorizar com" do aluno que serve; o do voo que muda de lugar, quando serve; a ordem da lista
  const doPedido = movido && movido.pedido.insId ? movido.pedido.insId : null;
  const escolherInstrutor = (a, r) => {
    const grupos = opcoesDeInstrutor(estado, base, { mis, tipo: tipoDe(r), a, b: a + minutos, stu, stuKg: alunoKg || 0, curso, r, exceto });
    const todas = grupos.flatMap(g => g.opcoes);
    const habilitadas = todas.filter(o => !o.desligada);
    const servem = (grupos.find(g => g.rotulo === 'Servem neste horário') || { opcoes: [] }).opcoes;
    const existe = id => Boolean(id) && todas.some(o => o.valor === id);
    const proprio = tocado('instrutor', todas.map(o => o.valor)) ? escolhas.instrutor
      : existe(doPedido) ? doPedido : existe(ctx.insId) ? ctx.insId : null;
    const doPar = (stu.voaCom || []).find(id => servem.some(o => o.valor === id));
    const doVooAgora = doVoo && servem.some(o => o.valor === doVoo.insId) ? doVoo.insId : null;
    return { grupos, insId: proprio ?? doPar ?? doVooAgora ?? (habilitadas[0] || todas[0] || {}).valor ?? null, fixo: proprio !== null };
  };

  // O tipo do recurso que o operador escolheu (ou o do contexto), quando ele serve à missão (o tipo e os atributos: o Só
  // Parafuso, o Só VFR no voo IFR); senão, o preferido. O instrutor que o operador escolheu (o do pedido, ou o do contexto)
  // já conta na escolha do recurso (a habilitação própria do avião)
  const serveAMissao = r => {
    if (!r || ground || r === GROUND_REG) return Boolean(r) && ground && r === GROUND_REG;
    const recurso = recursoDaFrota(frota, r);
    return Boolean(recurso) && MIS[mis].eq.includes(recurso.tipo) && !motivoDoAviao(recurso, { mis, eq: recurso.tipo, curso });
  };
  const recursoDoOperador = [tocados.has('recurso') ? escolhas.recurso : null, ctx.r].find(serveAMissao) || null;
  const idDoOperador = tocados.has('instrutor') ? escolhas.instrutor : doPedido ?? ctx.insId;
  const instrutorDoOperador = estado.ins.find(i => i.id === (turma ? turma.insId : idDoOperador)) || null;
  let lista = listaDoTipo(recursoDoOperador ? tipoDe(recursoDoOperador) : preferido);
  let a = turma ? turma.a : outro ? paraMinuto(escolhas.outroHorario) : tocado('horario', lista) ? escolhas.horario : null;
  const horarioDoOperador = a !== null || outro;
  const ancora = ctx.perto ? ctx.minuto : primeiroNaLista(lista) ?? ctx.minuto;
  const inicial = a ?? ancora;
  let rec = escolherRecurso(inicial, instrutorDoOperador);
  let ins = escolherInstrutor(inicial, rec.r);
  if (!horarioDoOperador) {
    // O horário livre do recurso, do instrutor e do aluno (nos voos fixos; a volta do noturno ocupa até as 10:10): o mais
    // perto do clique, ou o primeiro a partir do início do contexto (na janela do horário da lista). O voo que muda de
    // lugar sai do horário em que está, no mesmo recurso
    lista = listaDoTipo(tipoDe(rec.r));
    const instrutor = estado.ins.find(i => i.id === ins.insId) || null;
    const livreAgora = livreNosFixos(estado, base, { stu, r: rec.r, x: instrutor, mis, tipo: tipoDe(rec.r), minutos, ground, stuKg: alunoKg || 0, curso, exceto });
    const livre = s => !(doVoo && s === doVoo.a && rec.r === doVoo.r) && livreAgora(s);
    const naJanela = lista.filter(s => (ctx.desde === null || s >= ctx.desde) && (ctx.ate === null || s < ctx.ate));
    a = ctx.perto || !naJanela.length ? encaixarHorario(ancora, lista, livre) : encaixarHorario(naJanela[0], naJanela, livre);
    // No horário encontrado, os padrões de novo: o recurso do mesmo tipo e o instrutor que melhor servem nele
    if (a !== null) {
      const novo = escolherRecurso(a, instrutorDoOperador);
      rec = { ...novo, r: !novo.fixo && novo.r && tipoDe(novo.r) === tipoDe(rec.r) ? novo.r : rec.r };
      ins = escolherInstrutor(a, rec.r);
    }
  }
  const x = turma ? instrutorDoOperador : estado.ins.find(i => i.id === ins.insId) || null;
  // Com o instrutor, os recursos de novo: o avião com habilitação própria que ele não tem fica desligado
  if (a !== null && x) {
    const comInstrutor = escolherRecurso(a, x);
    rec = { ...comInstrutor, r: rec.r };
  }
  // Na turma, a sala é a dela (a turma não ocupa a sala para quem entra nela)
  if (turma) rec = { opcoes: [{ valor: GROUND_REG, tipo: GROUND_EQ_TYPE, problema: null, desligada: false, texto: `${nomeDoRecurso(GROUND_REG)} · turma das ${hm(turma.a)}` }], r: GROUND_REG, fixo: true };
  const tipo = tipoDe(rec.r);
  lista = listaDoTipo(tipo);
  if (turma && !lista.includes(turma.a)) lista = [...lista, turma.a].sort((p, q) => p - q);
  const b = a === null ? null : turma ? turma.b : a + minutos;

  f.recursos = rec.opcoes;
  f.recurso = rec.r;
  // No Ground, as turmas do dia vêm antes dos instrutores de uma turma nova
  const opcoesDasTurmas = turmas.map(t => {
    const bloqueado = (stu.bl || []).includes(t.insId);
    return { valor: `turma:${t.classKey}`, texto: `${textoDaTurma(t)}${bloqueado ? ` — ${NOTA_DO_PROBLEMA.bloqueio}` : ''}`, desligada: bloqueado, turma: t };
  });
  f.instrutores = [...(opcoesDasTurmas.length ? [{ rotulo: `Turmas ${nomeDaData(ambiente).de}`, opcoes: opcoesDasTurmas }] : []), ...ins.grupos];
  f.instrutor = turma ? `turma:${turma.classKey}` : x ? x.id : null;
  f.horario = outro ? 'outro' : a;
  f.outroHorario = outro ? escolhas.outroHorario || '' : '';
  // Os horários do recurso, com "(ocupado)" onde o recurso ou o instrutor já tem um voo fixo (na turma, o horário dela);
  // outro horário, nos aviões e simuladores
  const { fixos } = ocupacoes(estado, base, exceto);
  const ocupado = s => Boolean((rec.r && ocupaDaLista(fixos.recursos, rec.r, s, s + minutos)) || (x && ocupaDaLista(fixos.instrutores, x.id, s, s + minutos)));
  const textoDoHorario = s => `${hm(s)}${turma && s === turma.a ? ' (turma)' : ocupado(s) ? ' (ocupado)' : ''}`;
  f.horarios = { opcoes: lista.map(s => ({ valor: s, texto: textoDoHorario(s) })), outro: !ground };

  // As missões de novo, no horário e no recurso escolhidos: o estado da missão do curso (liberada, condicional, fora da
  // ordem) vale para o horário, e os tipos sem o curso são os que o recurso serve
  const noHorario = opcoesDeMissao(estado, base, ambiente, stu, {
    a: a ?? inicio, contexto: ctx, recurso: rec.r && rec.r !== GROUND_REG ? recursoDaFrota(frota, rec.r) : rec.r, turma: turmaDoContexto
  });
  f.missoes = { ...noHorario, padrao: daMissao.padrao };
  const atual = info.tipo === 'missao' || info.tipo === 'pedido' ? opcaoDe(noHorario.grupos, missao) : null;
  if (atual) info = atual.info;
  f.missaoInfo = info;

  // O peso, nos aviões: o do cadastro, ou o digitado (o do instrutor, para cada instrutor)
  const lim = DEFAULT_LIM[tipo] || 0;
  const insKg = x ? pesoDoInstrutor(x) : 0;
  f.peso = {
    visivel: Boolean(lim),
    aluno: tocados.has('kgAluno') ? String(escolhas.kgAluno ?? '') : stu.kg ? String(stu.kg) : '',
    instrutor: x && (escolhas.kgInstrutor || {})[x.id] !== undefined ? String(escolhas.kgInstrutor[x.id]) : x && x.kg ? String(x.kg) : '',
    resumo: ''
  };
  if (lim && a !== null && alunoKg !== null && insKg !== null) f.peso.resumo = resumoDoPeso({ stuKg: alunoKg, insKg, tipo, minutos, mis, lim });

  // O contexto, no alto do diálogo, com o horário escolhido. O recurso do contexto que não serve à missão dá lugar a
  // outro, e o contexto diz por quê; o que serve e o operador trocou, ele mesmo escolheu (nada a explicar)
  const recursoTrocado = !turmaDoContexto && ctx.r && rec.r && ctx.r !== rec.r && !serveAMissao(ctx.r) ? ctx.r : null;
  f.contextoTexto = textoDoContexto(ctx, ambiente, { r: rec.r, tipo, a, recursoTrocado, mis, turma: turmaDoContexto, instrutor: x });
  if ((mis === 'Noturno' || mis === 'Voo Solo') && a !== null && inicial !== a && !horarioDoOperador) {
    f.notas.push({ codigo: 'horario-da-missao', texto: `O ${mis} sai às ${hm(a)}.` });
  }

  // Os bloqueios de formato, na ordem dos campos
  const formato = f.formato;
  if (!rec.r) formato.push({ codigo: 'sem-recurso', texto: `Nenhum recurso para ${mis} na frota.`, campo: 'agd-recurso' });
  else if (ground !== (rec.r === GROUND_REG)) formato.push({ codigo: 'ground-ou-voo', texto: 'O Ground é na sala de Ground; o voo, num avião ou simulador.', campo: 'agd-recurso' });
  if (!x) formato.push({ codigo: 'sem-instrutor', texto: turma ? 'O instrutor da turma saiu do cadastro.' : 'Escolha o instrutor.', campo: 'agd-instrutor' });
  if (a === null) formato.push({ codigo: 'horario-invalido', texto: outro ? 'Informe o horário de decolagem (hh:mm).' : 'Nenhum horário de decolagem aberto para esta missão nesta data.', campo: outro ? 'agd-outro-horario' : 'agd-horario' });
  if (horas === null) formato.push({ codigo: 'duracao', texto: ERRO_DA_DURACAO, campo: 'agd-horas' });
  else if (b !== null && b > MINUTOS_DO_DIA) formato.push({ codigo: 'depois-da-meia-noite', texto: 'O voo terminaria depois da meia-noite.', campo: outro ? 'agd-outro-horario' : 'agd-horario' });
  if (lim && alunoKg === null) formato.push({ codigo: 'peso-invalido', texto: ERRO_DO_PESO, campo: 'agd-kg-aluno' });
  if (lim && x && insKg === null) formato.push({ codigo: 'peso-invalido', texto: ERRO_DO_PESO, campo: 'agd-kg-instrutor' });
  if (formato.length) return f;

  f.proposta = {
    stuId: stu.id, mis, eq: ground ? GROUND_EQ_TYPE : tipo, nb: ground ? GROUND_DURATION_MIN / 60 : horas, a, b, r: rec.r, insId: x.id,
    missao: info.tipo === 'missao' ? { sigla: info.sigla, codigo: info.missao.codigo } : null,
    pesos: lim ? { aluno: alunoKg, instrutor: insKg } : null,
    disponibilizar: escolhas.disponibilizar === x.id ? { insId: x.id } : null,
    // O voo de hoje do aluno que muda de lugar (de onde: o horário e o recurso de agora) ou entra na escala
    ...(movido ? { pedido: { mid: movido.mid, acao: movido.acao, de: doVoo ? { a: doVoo.a, r: doVoo.r } : null } } : {}),
    // A turma de Ground em que o aluno entra
    ...(turma ? { turma: { classKey: turma.classKey } } : {})
  };
  f.selecao = {
    stu, x, r: rec.r, tipo, a, b, mis, info, ground, horas, fixa: padraoDaDuracao.fixa, minutos: b - a, lista, exceto, turma, movido,
    stuKg: alunoKg || 0, curso
  };
  return f;
}

// O peso da tripulação no avião: dentro do limite, com o tanque cheio; acima, quanto abastecer; nem com o mínimo de
// combustível, o bloqueio. Sem um dos pesos, o limite não é conferido
function resumoDoPeso({ stuKg, insKg, tipo, minutos, mis, lim }) {
  if (!stuKg || !insKg) return `Sem ${!stuKg && !insKg ? 'os pesos' : 'um dos pesos'}, o limite de ${lim} kg do ${tipo} não é conferido.`;
  const r = pesoECombustivel({ stuKg, insKg, tipo, minutos, mis });
  const kg = `${numeroBr(Math.round(r.kg * 10) / 10)} kg de ${lim} kg no ${tipo}`;
  if (!r.cabe) return 'Acima do limite mesmo com o mínimo de combustível.';
  if (!r.reduzirGal) return `${kg}: tanque cheio.`;
  return `${kg}: ${minuscula(textoDoCombustivel(r))}`;
}

// A descrição do diálogo: de onde ele abriu e o horário que o formulário escolheu (a: o horário; null: nenhum aberto
// para a missão; sem ele, o aluno ainda não foi escolhido). A linha de um recurso ("PR-VOB · C152 · o primeiro horário
// livre: 06:30") ou de um instrutor ("Com Instrutor 07 · …"), o horário da lista ("… a partir das 10:10: 10:10"), o
// clique no mapa ("… clique perto das 10:25 → 10:10 (horários do C152)"), a turma de Ground ou a barra da Escala (a data)
function textoDoContexto(contexto, ambiente, { r = null, tipo = null, a, recursoTrocado = null, mis = null, turma = null, instrutor = null }) {
  const onde = r ? `${nomeDoRecurso(r)}${r === GROUND_REG || !tipo ? '' : ` · ${tipo}`}` : '';
  // O instrutor da linha (o "+" ou o clique na linha dele no mapa)
  const com = instrutor && (contexto.origem === 'instrutor' || (contexto.origem === 'mapa' && contexto.insId)) ? `Com ${instrutor.nm}` : '';
  // Sem horário (nenhum aberto para a missão na data), o contexto diz isso, sem o horário pela metade
  const comAluno = a !== undefined;
  const quando = comAluno && a !== null ? hm(a) : null;
  const horario = texto => (!comAluno ? texto : quando ? `${texto}: ${quando}` : 'nenhum horário de decolagem aberto');
  let partes;
  // A turma de Ground de onde o diálogo abriu ("+ Aluno na turma"): a missão, o horário e o instrutor dela
  if (turma) partes = [`Turma de ${turma.mis} das ${hm(turma.a)} com ${turma.ins}`];
  else if (contexto.origem === 'mapa') {
    const clique = `clique perto das ${hm(contexto.minuto)}`;
    partes = [com, onde, !comAluno ? clique : quando ? `${clique} → ${quando} (${horariosDoTipo(tipo)})` : horario(clique)];
  } else if (contexto.origem === 'periodo') partes = [onde, horario(`o primeiro horário livre a partir das ${hm(contexto.desde)}`)];
  else if (contexto.origem === 'recurso') partes = [onde, horario('o primeiro horário livre')];
  else if (contexto.origem === 'instrutor') partes = [com, horario('o primeiro horário livre')];
  else {
    const data = ambiente.data && ambiente.hoje ? rotuloDaData(ambiente.data, ambiente.hoje).dia : '';
    partes = [data, horario(contexto.desde !== null && ambiente.data === ambiente.hoje ? 'o primeiro horário livre a partir de agora' : 'o primeiro horário livre')];
  }
  const texto = maiuscula(partes.filter(Boolean).join(' · '));
  if (!recursoTrocado) return texto;
  const doContexto = recursoTrocado === GROUND_REG ? 'A sala de Ground' : `O ${nomeDoRecurso(recursoTrocado)}`;
  return `${texto}. ${doContexto} não serve ao ${mis}: o voo vai ${noRecurso(r)}.`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Aplicar, simular e conferir

// A chave da turma nova de Ground: nenhuma (o motor usa a chave do voo), menos quando a chave do voo já é a chave da turma
// de outro voo fixo (o aluno que abriu a turma muda de lugar, e quem entrou nela fica com a chave dela): então uma chave
// como as do motor ("GND_<missão>_<período>_<instrutor>"), que nenhum outro voo fixo usa. Duas turmas com a mesma chave
// seriam uma turma só para o motor, e a segunda não ocuparia a sala nem o instrutor no horário dela
function chaveDaTurmaNova(fixos, fKey, { mis, a, insId }) {
  const usadas = new Set(Object.entries(fixos).filter(([chave]) => chave !== fKey).map(([, p]) => p.classKey).filter(Boolean));
  if (!usadas.has(fKey)) return null;
  const base = `GND_${mis}_${T.includes(a) ? T.indexOf(a) : periodoDoMinuto(a)}_${insId}`;
  let chave = base;
  for (let n = 2; usadas.has(chave); n++) chave = `${base}_${n}`;
  return chave;
}

// Agenda o voo no estado (o do app, ao confirmar; uma cópia, na simulação): o pedido (o principal, quando ele não voa e a
// chave está limpa; senão uma missão extra nova), com a missão, o recurso, as horas, a preferência no horário agendado, a
// missão do curso e o instrutor (o do operador vale mais que a escolha do app); o voo fixo com a marca agendado (na turma
// de Ground em que o aluno entra, com a chave dela; a turma nova fica com a chave do voo, ou com outra quando a do voo já
// é a de outra turma: chaveDaTurmaNova); os pesos digitados no cadastro
// de cada um; e, com "Marcar disponível", o instrutor disponível nos períodos do voo. O voo de hoje do aluno que muda de
// lugar (ou entra na escala) é o mesmo pedido: ele fica com a missão e a missão do curso, recebe o recurso, as horas, o
// horário e o instrutor, e perde a disponibilidade que não inclui o horário novo. Devolve como estava (a reversão do
// histórico): o pedido de antes (o principal, só quando é ele o pedido do voo; a missão extra nova sai inteira; o pedido
// movido), o voo fixo e a disponibilidade de antes, os pesos que mudaram e o pedido como o agendamento o deixou
export function aplicarAgendamento(estado, base, proposta) {
  const aluno = estado.stu.find(s => s.id === proposta.stuId);
  const movido = proposta.pedido || null;
  // O pedido de antes: o que muda de lugar; o principal como estava, antes de alvoDoNovoPedido o limpar (só vale quando é
  // ele o pedido do voo)
  const principal = movido ? null : camposDoPedido(aluno);
  const alvo = movido ? pedidoDoAluno(aluno, movido.mid) : alvoDoNovoPedido(estado, aluno);
  const doMovido = movido ? camposDoPedido(alvo) : null;
  const mid = alvo === aluno ? 0 : alvo.mid;
  const fKey = chaveDoVoo(aluno.id, mid);
  const fixo = (estado.fixos || {})[fKey] || null;
  Object.assign(alvo, { fly: true, eq: proposta.eq, nb: proposta.nb, p1: proposta.a, p2: -1, insId: proposta.insId });
  if (!movido) {
    alvo.mis = proposta.mis;
    if (proposta.missao) Object.assign(alvo, { etapa: proposta.missao.codigo, cursoDaEtapa: proposta.missao.sigla });
    else { delete alvo.etapa; delete alvo.cursoDaEtapa; }
  }
  const permitidas = disponibilidadeDoAluno(alvo.jan);
  if (permitidas && !permitidas(proposta.a)) delete alvo.jan;
  normalizeMissionFields(alvo);
  const ground = isGroundMission(alvo.mis);
  const classKey = !ground ? null : proposta.turma ? proposta.turma.classKey : chaveDaTurmaNova(estado.fixos || {}, fKey, { mis: alvo.mis, a: proposta.a, insId: proposta.insId });
  estado.fixos = {
    ...(estado.fixos || {}),
    [fKey]: { a: proposta.a, b: proposta.b, r: ground ? GROUND_REG : proposta.r, insId: proposta.insId, ...(classKey ? { classKey } : {}), agendado: true }
  };
  const x = estado.ins.find(i => i.id === proposta.insId) || null;
  const pesos = [];
  if (proposta.pesos) {
    for (const [pessoa, tipo, kg] of [[aluno, 'aluno', proposta.pesos.aluno], [x, 'instrutor', proposta.pesos.instrutor]]) {
      if (!pessoa || !Number.isFinite(kg) || kg === (pessoa.kg || 0)) continue;
      pessoa.kg = kg;
      pesos.push({ tipo, id: pessoa.id, nm: pessoa.nm, kg });
    }
  }
  let disponibilidade = null;
  if (proposta.disponibilizar && x) {
    disponibilidade = { insId: x.id, on: x.on, aw: [...x.aw] };
    x.on = true;
    x.aw = x.aw.map((v, k) => v || sobrepoe(proposta.a, proposta.b, T[k], k < NI ? T[k + 1] : MINUTOS_DO_DIA));
  }
  return {
    stuId: aluno.id, mid, criado: !movido, pedido: movido ? doMovido : mid === 0 ? principal : null, fixo, disponibilidade, pesos, criadoComo: camposDoPedido(alvo)
  };
}

// O estado com os pesos digitados (só os pesos): a escala dele separa o que os pesos sozinhos mudam do que o agendamento
// muda. Sem peso digitado diferente do cadastro, o próprio estado
export function comPesos(estado, proposta) {
  if (!proposta || !proposta.pesos) return estado;
  const aluno = estado.stu.find(s => s.id === proposta.stuId), x = estado.ins.find(i => i.id === proposta.insId);
  const mudaAluno = aluno && proposta.pesos.aluno !== (aluno.kg || 0), mudaInstrutor = x && proposta.pesos.instrutor !== (x.kg || 0);
  if (!mudaAluno && !mudaInstrutor) return estado;
  return {
    ...estado,
    stu: mudaAluno ? estado.stu.map(s => (s === aluno ? { ...s, kg: proposta.pesos.aluno } : s)) : estado.stu,
    ins: mudaInstrutor ? estado.ins.map(i => (i === x ? { ...i, kg: proposta.pesos.instrutor } : i)) : estado.ins
  };
}

// A simulação: a mesma função que grava, numa cópia do estado, e o motor nela (a escala que fica se o operador confirmar)
export function simularAgendamento(estado, base, proposta, motor = runAllocationEngine) {
  const copia = {
    ...estado, stu: structuredClone(estado.stu), ins: structuredClone(estado.ins), fixos: { ...(estado.fixos || {}) },
    fStatus: { ...(estado.fStatus || {}) }, fObs: { ...(estado.fObs || {}) }
  };
  const antes = aplicarAgendamento(copia, base, proposta);
  return { sim: motor(copia), estadoDaSim: copia, antes, fKey: chaveDoVoo(antes.stuId, antes.mid) };
}

// O campo do diálogo de cada grupo de conflito (o foco vai para ele)
const CAMPO_DO_GRUPO = { instrutor: 'agd-instrutor', aviao: 'agd-recurso', horario: 'agd-horario', pedido: 'agd-missao' };
// O resumo de cada aviso confirmado, para o histórico
const RESUMO_DO_AVISO = {
  'fora-dos-horarios': 'fora dos horários de decolagem', 'depois-das-17h30': 'depois das 17:30', 'limite-de-locais': 'acima do limite de voos locais no horário',
  'antes-do-ground': 'antes do Ground', 'sem-peso': 'sem peso'
};

// As alternativas de cada bloqueio (os botões com o que está livre), até ALTERNATIVAS de cada: os horários, os recursos e
// os instrutores; no peso, os instrutores que cabem nele
const ALTERNATIVAS = 3;
const ROTULO_DAS_ALTERNATIVAS = { horarios: 'Horários livres', recursos: 'Recursos livres', instrutores: 'Instrutores livres', maisLeves: 'Instrutores que cabem no peso' };
const ALTERNATIVAS_DO_GRUPO = { instrutor: ['instrutores', 'horarios'], aviao: ['recursos', 'horarios'], horario: ['horarios'], pedido: [] };

// As alternativas livres para o voo escolhido (selecao, do formulário), contra os voos fixos (o voo que muda de lugar não
// conta), cada uma calculada só quando um bloqueio pede: os horários da lista em que o recurso, o instrutor e o aluno
// estão livres (os mais perto do escolhido, na ordem do dia); os recursos do mesmo tipo que servem no horário com o
// instrutor (os livres antes: trocar de tipo muda os horários, o peso e a habilitação, e fica com o operador); os
// instrutores que servem no horário (na ordem da lista); no peso, os que servem com peso informado (o peso deles cabe no
// avião). Na turma de Ground, o horário e o instrutor são os da turma: sem alternativas deles
function alternativasDoVoo(estado, base, selecao) {
  const { stu, x, r, tipo, a, b, mis, ground, lista, exceto, turma, stuKg, curso } = selecao;
  const minutos = b - a;
  const servem = () => ((opcoesDeInstrutor(estado, base, { mis, tipo, a, b, stu, stuKg, curso, r, exceto })
    .find(g => g.rotulo === 'Servem neste horário') || { opcoes: [] }).opcoes.filter(o => o.valor !== x.id));
  return {
    horarios: () => {
      if (turma) return [];
      const livre = livreNosFixos(estado, base, { stu, r, x, mis, tipo, minutos, ground, stuKg, curso, exceto });
      return lista.filter(s => s !== a && s + minutos <= MINUTOS_DO_DIA && livre(s))
        .sort((p, q) => Math.abs(p - a) - Math.abs(q - a) || p - q).slice(0, ALTERNATIVAS).sort((p, q) => p - q)
        .map(s => ({ opcao: `horario:${s}`, texto: hm(s) }));
    },
    recursos: () => (ground ? [] : opcoesDeRecurso(estado, base, { mis, eq: tipo, curso, a, b, instrutor: x, exceto })
      .filter(o => !o.desligada && o.valor !== r && o.tipo === tipo).slice(0, ALTERNATIVAS).map(o => ({ opcao: `recurso:${o.valor}`, texto: nomeDoRecurso(o.valor) }))),
    instrutores: () => (turma ? [] : servem().slice(0, ALTERNATIVAS).map(o => ({ opcao: `instrutor:${o.valor}`, texto: o.x.nm }))),
    maisLeves: () => servem().filter(o => o.x.kg > 0).slice(0, ALTERNATIVAS).map(o => ({ opcao: `instrutor:${o.valor}`, texto: `${o.x.nm} (${numeroBr(o.x.kg)} kg)` }))
  };
}

// A alternativa escolhida num bloqueio (o botão "horario:<minuto>", "recurso:<matrícula>" ou "instrutor:<id>"): o campo
// dela recebe o valor, como se o operador o escolhesse, e os outros ficam como o formulário os mostra agora (a missão, o
// horário, o recurso e o instrutor: a alternativa foi calculada com eles; o valor que o operador escolheu antes e o
// formulário trocou não volta). Devolve as escolhas e os campos tocados novos, ou null (não é uma alternativa)
export function escolhasDaAlternativa(formulario, escolhas, tocados, valor) {
  const [campo, ...resto] = String(valor).split(':');
  const arg = resto.join(':');
  if (!['horario', 'recurso', 'instrutor'].includes(campo) || !arg || (campo !== 'recurso' && !/^\d+$/.test(arg))) return null;
  const novas = { ...escolhas }, novos = new Set(tocados);
  const agora = {
    missao: formulario.missao || null, horario: Number.isInteger(formulario.horario) ? formulario.horario : null,
    recurso: formulario.recurso || null, instrutor: Number.isInteger(formulario.instrutor) ? formulario.instrutor : null
  };
  for (const [c, v] of Object.entries(agora)) {
    if (c !== campo && v !== null) { novas[c] = v; novos.add(c); }
  }
  novas[campo] = campo === 'recurso' ? arg : +arg;
  novos.add(campo);
  return { escolhas: novas, tocados: novos };
}

// Por que o voo saiu da escala na simulação: a recusa do motor ligada ao pedido dele (js/rejeicoes.js), no estado da
// simulação: ' (o motivo)', ou ''
function motivoDaSaida(estadoDaSim, sim, o) {
  const err = estadoDaSim ? recusasDe(estadoDaSim, sim).get(o.fKey) : null;
  return err ? ` (${minuscula(err.m.replace(/^Rejeitado: /, '').replace(/\.$/, ''))})` : '';
}

// A prévia ("O que muda na escala"): o voo agendado (o que muda de lugar diz de onde sai; o que entra, que estava fora) e,
// em até LINHAS_DA_PREVIA linhas, cada voo que muda de horário, recurso ou instrutor ("Aluno 1003: 10:10 → 11:30, PR-VOB →
// PR-VOC"), sai da escala (com o motivo do motor) ou entra nela (estava fora e agora cabe), mais "e mais N"
const LINHAS_DA_PREVIA = 8;
function linhasDaPrevia({ novo, movidos, saem, entram }, { antes, sim, estadoDaSim, movido }) {
  const recurso = o => nomeDoRecurso(o.r);
  const de = !movido ? '' : movido.voo ? ` (era ${hm(movido.voo.a)} ${noRecurso(movido.voo.r)})` : ' (estava fora da escala)';
  const mudancas = o => {
    const era = antes.get(o.fKey);
    return [era.a !== o.a ? `${hm(era.a)} → ${hm(o.a)}` : '', era.r !== o.r ? `${recurso(era)} → ${recurso(o)}` : '', era.insId !== o.insId ? `${era.ins} → ${o.ins}` : '']
      .filter(Boolean).join(', ');
  };
  const outras = [
    ...movidos.map(o => `${rotuloDoVoo(o)}: ${mudancas(o)}`),
    ...saem.map(o => `Sai: ${rotuloDoVoo(o)}${motivoDaSaida(estadoDaSim, sim, o)}`),
    ...entram.map(o => `Entra: ${rotuloDoVoo(o)} · ${hm(o.a)}–${hm(o.b)} · ${recurso(o)}`)
  ];
  return [
    ...(novo ? [`${movido && movido.voo ? 'Muda' : 'Entra'}: ${novo.s} · ${novo.mis} · ${hm(novo.a)}–${hm(novo.b)} · ${recurso(novo)} · ${novo.ins}${de}`] : []),
    ...outras.slice(0, LINHAS_DA_PREVIA), ...(outras.length > LINHAS_DA_PREVIA ? [`e mais ${outras.length - LINHAS_DA_PREVIA}`] : []),
    ...(outras.length ? [] : ['Nenhum outro voo muda.'])
  ];
}

// A disponibilidade do aluno em palavras: "de manhã", "à tarde", "à noite" ou "às 07:30"
const QUANDO_DISPONIVEL = { manha: 'de manhã', tarde: 'à tarde', noite: 'à noite' };
const quandoDisponivel = jan => QUANDO_DISPONIVEL[jan] || rotuloDaDisponibilidade(jan);

// A conferência do agendamento (formulario, a simulação sim e a chave fKey do voo novo; baseComPesos: a escala com os
// pesos digitados, sem o agendamento):
// - bloqueios (não deixa agendar): os de formato; cada conflito do voo novo na simulação (o instrutor indisponível, com
//   "Marcar disponível"; os outros, com as alternativas livres); outro voo que fica em conflito por causa do agendamento;
// - avisos (pedem uma confirmação): as regras do curso (no voo que muda de lugar, a ordem no horário novo e o tipo de
//   avião que muda), as regras que o motor não confere nos voos agendados (os horários de decolagem, o pouso até as
//   17:30, o limite de voos locais, o Ground antes), o peso que falta, os voos que saem da escala, o conflito que o peso
//   digitado cria em outro voo, o horário que já passou, a data passada, o domingo, os limites da lei sem as horas; no
//   voo que muda de lugar, a disponibilidade do aluno que não inclui o horário novo (ela sai do pedido) e o voo fixo pela
//   escala aprovada que muda de lugar;
// - notas (só informação), com a vez na fila do rodízio e, no Noturno, a volta e o repouso do instrutor até ela.
// Cada item: { codigo, texto, campo?, opcoes?, alternativas?, resumo? (o texto curto do histórico) }. previa: o voo novo,
// os voos que mudam de lugar, saem ou entram, e as linhas que a tela mostra
export function avaliarAgendamento({ estado, baseComPesos, base = baseComPesos, sim, estadoDaSim = null, fKey, formulario, ambiente = {} }) {
  const bloqueios = [...formulario.formato], avisos = [], notas = [...formulario.notas];
  if (bloqueios.length || !sim || !formulario.selecao) return { bloqueios, avisos, notas, previa: null };
  const { stu, x, r, tipo, a, b, mis, info, horas, fixa, ground, movido, exceto } = formulario.selecao;
  const novo = sim.out.find(o => o.fKey === fKey) || null;

  // Bloqueios: os conflitos do voo novo e os que ele cria nos outros, com as alternativas livres (cada tipo de alternativa
  // vai no primeiro bloqueio que a pede)
  const alternativas = alternativasDoVoo(estado, base, formulario.selecao);
  const dadas = new Set();
  const comAlternativas = (item, tipos) => {
    const grupos = tipos.filter(t => !dadas.has(t) && dadas.add(t)).map(t => ({ rotulo: ROTULO_DAS_ALTERNATIVAS[t], opcoes: alternativas[t]() }))
      .filter(g => g.opcoes.length);
    if (grupos.length) item.alternativas = grupos;
    return item;
  };
  if (!novo) bloqueios.push({ codigo: 'sem-voo', texto: 'O voo não entrou na escala.', campo: 'agd-horario' });
  else {
    (novo.conflitoCodigos || []).forEach((codigo, i) => {
      const grupo = GRUPO_DO_CONFLITO[codigo];
      const item = { codigo, texto: `${maiuscula(novo.conflito[i])}.`, campo: CAMPO_DO_GRUPO[grupo] || 'agd-horario' };
      if (codigo === 'instrutor-indisponivel') item.opcoes = [{ opcao: 'disponibilizar', texto: `Marcar ${x.nm} disponível às ${hm(a)}` }];
      else comAlternativas(item, codigo === 'peso' ? ['maisLeves'] : ALTERNATIVAS_DO_GRUPO[grupo] || []);
      bloqueios.push(item);
    });
  }
  const antes = new Map(baseComPesos.out.map(o => [o.fKey, o]));
  for (const o of sim.out) {
    if (o.fKey === fKey || !o.conflito || (antes.get(o.fKey) || {}).conflito) continue;
    bloqueios.push(comAlternativas({ codigo: 'conflito-em-outro-voo', texto: `Agendar aqui deixa o voo de ${rotuloDoVoo(o)} em conflito: ${o.conflito.join('; ')}.`, campo: 'agd-horario' },
      ['horarios', 'recursos', 'instrutores']));
  }

  // Avisos: as regras do curso
  if (info.tipo === 'missao') {
    const { missao: m, sigla } = info;
    const curso = indiceDoPrograma(ambiente.programa || []).curso(sigla);
    if (!ambiente.inferir) avisos.push({ codigo: 'ordem-nao-conferida', texto: `Sem os resultados dos cursos, a ordem do programa não foi conferida (${m.codigo}).`, resumo: 'ordem do curso não conferida' });
    else if (info.estado === 'bloqueada') avisos.push({ codigo: 'fora-da-ordem', texto: `${m.codigo} fora da ordem: ${info.motivo}.`, resumo: `fora da ordem (${info.motivo})`, campo: 'agd-missao' });
    else if (info.estado === 'aprovada') avisos.push({ codigo: 'ja-aprovada', texto: `${m.codigo} já foi aprovada: o aluno voa a missão de novo.`, resumo: `${m.codigo} já aprovada`, campo: 'agd-missao' });
    else if (info.estado === 'dispensada') avisos.push({ codigo: 'dispensada', texto: `${m.codigo} é dispensada no ${sigla}.`, resumo: `${m.codigo} dispensada`, campo: 'agd-missao' });
    else if (info.estado === 'no-dia') avisos.push({ codigo: 'repetida-no-dia', texto: `${m.codigo} ${info.motivo.replace(/^já /, 'já está ')}: o aluno voa a missão duas vezes no dia.`, resumo: `${m.codigo} repetida no dia`, campo: 'agd-missao' });
    if (sigla !== stu.curso) avisos.push({ codigo: 'outro-curso', texto: `${m.codigo} é do ${sigla}, e ${stu.nm} está no ${stu.curso || 'nenhum curso'}.`, resumo: 'missão de outro curso', campo: 'agd-missao' });
    if (curso && curso.ativo === false) avisos.push({ codigo: 'curso-encerrado', texto: `O curso ${sigla} está encerrado.`, resumo: 'curso encerrado', campo: 'agd-missao' });
    if (!isGroundMission(mis) && tipo !== m.eq) {
      avisos.push({ codigo: 'recurso-do-programa', texto: `O programa faz ${m.codigo} no ${m.eq}; o voo vai no ${tipo}, e a missão continua ${m.codigo}.`, resumo: `${m.codigo} no ${tipo}`, campo: 'agd-recurso' });
    }
  } else if (movido && info.missao) {
    // O voo de hoje que muda de lugar continua com a missão: a ordem do curso no horário novo (uma missão do dia que voa
    // depois dela) e o tipo de avião que muda
    const m = info.missao;
    if (info.estado === 'bloqueada') avisos.push({ codigo: 'fora-da-ordem', texto: `${m.codigo} fora da ordem: ${info.motivo}.`, resumo: `fora da ordem (${info.motivo})`, campo: 'agd-horario' });
    if (!ground && tipo !== movido.pedido.eq && tipo !== m.eq) {
      avisos.push({ codigo: 'recurso-do-programa', texto: `O programa faz ${m.codigo} no ${m.eq}; o voo vai no ${tipo}, e a missão continua ${m.codigo}.`, resumo: `${m.codigo} no ${tipo}`, campo: 'agd-recurso' });
    }
  }
  // O voo de hoje que muda de lugar: a disponibilidade do aluno que não inclui o horário novo sai do pedido; o voo fixo
  // pela escala aprovada (ou pelo status) deixa o lugar em que estava fixo
  if (movido) {
    const { jan } = movido.pedido;
    const permitidas = disponibilidadeDoAluno(jan);
    if (permitidas && !permitidas(a)) {
      avisos.push({ codigo: 'disponibilidade-do-aluno', texto: `${stu.nm} está disponível só ${quandoDisponivel(jan)}: agendado às ${hm(a)}, o pedido fica sem a disponibilidade.`, resumo: 'fora da disponibilidade do aluno', campo: 'agd-horario' });
    }
    const pino = (estado.fixos || {})[fKey];
    const muda = movido.voo && (movido.voo.a !== a || movido.voo.r !== r || movido.voo.insId !== x.id);
    if (muda && pino && !pino.agendado && (estado.aprovacao || fixoPeloStatus(fKey, estado.fStatus))) {
      const porque = motivoDoFixo(fKey, { fStatus: estado.fStatus, aprovacao: estado.aprovacao, voo: movido.voo, fixos: estado.fixos }).replace(/^Voo fixo: /, '');
      avisos.push({
        codigo: 'fixo-muda', texto: `O voo de ${stu.nm} está fixo (${porque}): ele sai das ${hm(movido.voo.a)} ${noRecurso(movido.voo.r)} e fica fixo no horário novo.`,
        resumo: 'voo fixo muda de lugar', campo: 'agd-horario'
      });
    }
  }
  // As regras que o motor não confere nos voos agendados e o peso que falta (os avisos do motor com a chave do voo novo)
  for (const al of sim.al) {
    if (al.t !== 'warn' || al.fKey !== fKey || ![...CODIGOS_DO_AGENDADO, 'sem-peso'].includes(al.codigo)) continue;
    const campo = al.codigo === 'sem-peso' ? (!(formulario.proposta.pesos || {}).aluno ? 'agd-kg-aluno' : 'agd-kg-instrutor')
      : al.codigo === 'antes-do-ground' ? 'agd-horario' : al.codigo === 'depois-das-17h30' ? 'agd-horas' : 'agd-horario';
    avisos.push({ codigo: al.codigo, texto: al.m, resumo: RESUMO_DO_AVISO[al.codigo], campo });
  }
  // O limite de voos locais no horário: o motor avisa o agendado que ele confere depois do 6º, e ele confere os agendados
  // na ordem dos pedidos (o aluno que vem antes no cadastro, ou com mais prioridade, é conferido antes dos agendados de
  // antes): o aviso dele pode ficar num voo agendado antes. O voo novo que deixa mais de 6 voos locais saindo no horário
  // dele pede a confirmação do mesmo jeito
  if (novo && !ground && MISSOES_LOCAIS.includes(mis) && !avisos.some(av => av.codigo === 'limite-de-locais')) {
    const saida = o => intervaloEfetivo(o, statusDoVoo(o, estado.fStatus), (estado.fObs || {})[o.fKey]).a;
    const locais = sim.out.filter(o => !o.isGround && MISSOES_LOCAIS.includes(o.mis) && ativo(o, estado.fStatus) && saida(o) === saida(novo)).length;
    if (locais > LIMITE_DE_VOOS_LOCAIS) {
      avisos.push({
        codigo: 'limite-de-locais', texto: `Agendado às ${hm(a)} como o ${locais}º voo local do horário: no máximo ${LIMITE_DE_VOOS_LOCAIS} voos locais saem no mesmo horário.`,
        resumo: RESUMO_DO_AVISO['limite-de-locais'], campo: 'agd-horario'
      });
    }
  }
  // Os voos que saem da escala (com o motivo do motor) e o conflito que o peso digitado sozinho cria em outro voo
  const naSim = new Set(sim.out.map(o => o.fKey));
  const saem = baseComPesos.out.filter(o => o.fKey !== fKey && !naSim.has(o.fKey));
  if (saem.length) {
    avisos.push({
      codigo: 'saem', texto: `Agendar aqui tira da escala: ${saem.slice(0, 8).map(o => `${rotuloDoVoo(o)}${motivoDaSaida(estadoDaSim, sim, o)}`).join('; ')}${saem.length > 8 ? ` e mais ${saem.length - 8}` : ''}.`,
      resumo: `tira ${saem.length} ${saem.length === 1 ? 'voo' : 'voos'} da escala`
    });
  }
  if (baseComPesos !== base) {
    const daBase = new Map(base.out.map(o => [o.fKey, o]));
    for (const o of baseComPesos.out) {
      if (!o.conflito || (daBase.get(o.fKey) || {}).conflito) continue;
      avisos.push({ codigo: 'peso-muda-outro-voo', texto: `Com o peso digitado, o voo de ${rotuloDoVoo(o)} fica em conflito: ${o.conflito.join('; ')}.`, resumo: `o peso muda o voo de ${rotuloDoVoo(o)}`, campo: 'agd-kg-aluno' });
    }
  }
  // A data e o horário
  if (ambiente.data && ambiente.hoje && ambiente.data < ambiente.hoje) avisos.push({ codigo: 'data-passada', texto: 'A data já passou.', resumo: 'data passada' });
  else if (ambiente.data === ambiente.hoje && a < ambiente.agora) avisos.push({ codigo: 'horario-passado', texto: `O horário ${hm(a)} já passou.`, resumo: 'horário que já passou', campo: 'agd-horario' });
  if (ambiente.data && ehDomingo(ambiente.data)) avisos.push({ codigo: 'domingo', texto: 'O aeroclube não opera aos domingos.', resumo: 'domingo' });
  if (ambiente.semHoras) {
    avisos.push({ codigo: 'lei-nao-conferida', texto: 'Sem as horas de voo dos instrutores, os limites da lei do mês e do ano não foram conferidos.', resumo: 'limites da lei não conferidos' });
  }

  // Notas
  if ((info.tipo === 'missao' || movido) && info.missao && info.estado === 'condicional') notas.push({ codigo: 'condicional', texto: `${info.missao.codigo} depende do resultado de ${info.dependeDe}.` });
  if (info.tipo === 'missao' && !fixa && horas !== info.missao.nb) {
    notas.push({ codigo: 'duracao-do-programa', texto: `A duração (${fmtH(horas)}) é diferente da do programa para ${info.missao.codigo} (${fmtH(info.missao.nb)}).` });
  }
  if (novo && novo.comb) notas.push({ codigo: 'reduzir-combustivel', texto: `O avião sai com menos combustível: reduzir ${novo.comb.reduzirGal} gal.` });
  if ((stu.voaCom || []).length && !stu.voaCom.includes(x.id)) notas.push({ codigo: 'fora-do-priorizar', texto: `${x.nm} está fora do Priorizar com de ${stu.nm}.` });
  if (formulario.proposta.disponibilizar) notas.push({ codigo: 'disponibilizar', texto: `${x.nm} fica disponível às ${hm(a)} com o agendamento.` });
  // A vez na fila do rodízio da categoria (o voo da categoria vai para quem tem menos voos dela no dia, depois para o
  // primeiro da fila), entre os instrutores que servem no horário
  const categoria = ground ? null : categoriaDoRodizio(mis, tipo);
  if (categoria) {
    const { naCategoria, posicao } = rodizioDoDia(estado, base, categoria, exceto);
    const vez = instrutoresQueServem(estado, ocupacoes(estado, base, exceto).fixos, { mis, tipo, a, b, alunos: [stu], stuKg: formulario.selecao.stuKg, curso: formulario.selecao.curso, r })
      .filter(c => !c.problemas.length).map(c => c.x)
      .sort((p, q) => (naCategoria.get(p.id) || 0) - (naCategoria.get(q.id) || 0) || (posicao(p.id) === posicao(q.id) ? 0 : posicao(p.id) - posicao(q.id)) || p.id - q.id)[0];
    if (vez) notas.push({ codigo: 'rodizio', texto: `Na fila do rodízio (${CATEGORIAS_DO_RODIZIO.find(c => c.id === categoria).nome}), a vez é de ${vez.nm}.` });
  }
  if (estado.aprovacao) notas.push({ codigo: 'escala-aprovada', texto: 'A escala está aprovada: o voo novo entra fixo e os outros não mudam.' });
  if (mis === 'Noturno') {
    // A volta é no dia seguinte ao da data aberta: amanhã só quando a data é hoje
    const volta = nomeDaData({ data: ambiente.data && somarDias(ambiente.data, 1), hoje: ambiente.hoje });
    notas.push({ codigo: 'noturno', texto: `O Noturno volta ${volta.quando || 'no dia seguinte'} às ${hm(NOTURNO.voltaInicio)}; o instrutor, o aluno e o avião ficam livres às ${hm(NOTURNO.livreAs)}.` });
    // O repouso da lei antes da volta (do fim do noturno, em BH, à volta das 07:30): abaixo do mínimo, a escala do dia da
    // volta avisa (repouso-do-noturno, js/engine.js), e o agendamento já diz quanto fica. A decisão do aeroclube é avisar
    // a lei, não isentar: é uma nota, sem confirmação
    const limites = normalizarLimites(estado.limites);
    const repouso = limites.repousoMin === null ? null : repousoAntesDaVolta(b, limites);
    if (repouso !== null && repouso < limites.repousoMin) {
      notas.push({
        codigo: 'repouso-do-noturno',
        texto: `Limite da lei: ${x.nm} fica com ${duracaoHm(repouso)} de repouso entre o noturno (até ${hm(b)}) e o translado de volta (${hm(NOTURNO.voltaInicio)}), menos que as ${duracaoHm(limites.repousoMin)} da lei; a escala ${volta.curto ? volta.de : 'do dia seguinte'} avisa.`
      });
    }
  }
  // Os outros pedidos do aluno que ficaram fora da escala (o que entra agora não)
  const naBase = new Set(baseComPesos.out.map(o => o.fKey));
  const fora = pedidosQueVoam(stu).filter(p => chaveDoVoo(stu.id, p.mid || 0) !== fKey && !naBase.has(chaveDoVoo(stu.id, p.mid || 0)));
  if (fora.length) notas.push({ codigo: 'pedido-fora', texto: `${stu.nm} tem ${fora.length === 1 ? 'um pedido' : 'pedidos'} que ficou fora da escala (${fora.map(p => p.mis).join(', ')}): ${fora.length === 1 ? 'ele continua' : 'eles continuam'} fora.` });

  // A prévia: o voo novo e o que muda nos outros
  const movidos = sim.out.filter(o => {
    const era = antes.get(o.fKey);
    return o.fKey !== fKey && era && (era.a !== o.a || era.r !== o.r || era.insId !== o.insId);
  });
  const entram = sim.out.filter(o => o.fKey !== fKey && !antes.has(o.fKey));
  const previa = { novo, movidos, saem, entram, r, a, b };
  return { bloqueios, avisos, notas, previa: { ...previa, linhas: linhasDaPrevia(previa, { antes, sim, estadoDaSim, movido }) } };
}

// A assinatura dos avisos: a confirmação vale para estes avisos; outro conjunto pede outra
export const assinaturaDosAvisos = avisos => avisos.map(a => `${a.codigo}:${a.texto}`).join('|');

// O texto do histórico (até 500 caracteres): o aluno, a missão, o horário, o recurso e o instrutor (o voo que mudou de
// lugar diz de onde saiu; o que entrou na escala, que estava fora; o aluno que entrou numa turma de Ground, que entrou
// nela), os avisos confirmados e o instrutor marcado disponível. estado: como estava antes do agendamento
export function descricaoDoAgendamento(estado, proposta, { avisos = [] } = {}) {
  const stu = estado.stu.find(s => s.id === proposta.stuId), x = estado.ins.find(i => i.id === proposta.insId);
  const movido = proposta.pedido || null;
  const doPedido = movido && stu ? pedidoDoAluno(stu, movido.mid) : null;
  const etapa = proposta.missao ? proposta.missao.codigo : doPedido && doPedido.etapa;
  const missao = etapa ? `${etapa} (${proposta.mis})` : proposta.mis;
  const onde = nomeDoRecurso(isGroundMission(proposta.mis) ? GROUND_REG : proposta.r);
  const de = !movido ? '' : movido.de ? ` (era ${hm(movido.de.a)} ${noRecurso(movido.de.r)})` : ' (estava fora da escala)';
  const naTurma = proposta.turma ? ' · entrou na turma' : '';
  const inicio = `${estado.aprovacao ? 'Agendado na escala aprovada' : 'Agendado na escala'}: ${stu ? stu.nm : proposta.stuId} · ${missao} · ${hm(proposta.a)}–${hm(proposta.b)} · ${onde} · ${x ? x.nm : proposta.insId}${de}${naTurma}`;
  const disponivel = proposta.disponibilizar ? ` · ${x ? x.nm : proposta.insId} marcado disponível às ${hm(proposta.a)}` : '';
  const resumos = avisos.map(a => a.resumo || a.codigo);
  let confirmado = resumos.length ? ` · confirmado: ${resumos.join('; ')}` : '';
  const LIMITE = 500;
  if (inicio.length + confirmado.length + disponivel.length > LIMITE) {
    confirmado = `${confirmado.slice(0, Math.max(0, LIMITE - inicio.length - disponivel.length - 1))}…`;
  }
  return `${inicio}${confirmado}${disponivel}`.slice(0, LIMITE);
}

// A reversão do histórico ("↶ Desfazer"): o que aplicarAgendamento devolveu, no formato de js/reversoes.js
export const reversaoDoAgendamento = ({ stuId, mid, criado, pedido, fixo, disponibilidade, criadoComo }) =>
  ({ kind: 'desfazerAgendamento', stuId, mid, criado, pedido, fixo, disponibilidade, criadoComo, label: '↶ Desfazer' });

// Os pesos digitados que foram para o cadastro: uma entrada do histórico cada (sem reversão, como os pesos editados no
// cadastro)
export const historicoDosPesos = ({ pesos = [] }) => pesos.map(p => `Peso ${p.nm}: ${numeroBr(p.kg)} kg (agendamento)`);
