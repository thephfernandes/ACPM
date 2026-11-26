// Sugestões para um conflito na escala aprovada: sem refazer o dia, o que pode voar no lugar do voo fixo que
// ficou impossível. No mesmo horário: outro avião do mesmo tipo (um que já saiu, com a menor folga, e depois o da
// frente do hangar), outro instrutor (habilitado, disponível, livre, sem bloqueio do aluno, dentro do peso e da lei; o
// tanque cheio primeiro, depois quem tem menos horas no dia e menos habilitações) ou os dois. Sem nada no mesmo horário,
// o primeiro horário mais tarde no mesmo dia, dentro da disponibilidade do aluno. Depois, soltar o voo (o motor o escala
// de novo; quando o pedido mudou, é a única sugestão) e, por último, cancelar. Cada sugestão é uma mudança no voo fixo;
// na turma de Ground, em todos os alunos dela. Os aviões e os instrutores que servem vêm de js/candidatos.js, com os
// outros voos do dia no horário marcado de cada um.
// O voo cancelado da data aberta também tem sugestões (sugerirParaCancelado): o aluno não perde o voo porque o instrutor ou
// o avião faltou, a não ser que seja impossível. O motivo do cancelamento sai da busca (o instrutor, o avião ou o horário).
// Na ordem: o mesmo horário e o mesmo avião, com outro instrutor; o mesmo horário, outro avião; o horário mais perto, antes
// ou depois; outro tipo de recurso que a missão permite. A lista do conflito também ganha os dois últimos (o horário fora da
// disponibilidade e outro tipo mudam também o pedido: repararComOPedido). Fora da disponibilidade e em outro tipo, a
// sugestão pede a confirmação com o aluno; a que faz do voo local o 7º do horário, a do operador
import { GROUND_EQ_TYPE, T, NI, MIS, MISSOES_LOCAIS, LIMITE_DE_VOOS_LOCAIS } from './config.js';
import { CAMPOS_DO_PEDIDO } from './dias.js';
import { normalizeMissionFields } from './rules.js';
import { HORARIOS_INICIAIS, horariosDaMissao, periodoDoMinuto, fimDasMissoesDoDia } from './horarios.js';
import { STATUS_EM_ANDAMENTO, intervaloEfetivo } from './status.js';
import { disponibilidadeDoAluno, doesGroundGateFlight } from './rules.js';
import { pedidoDoAluno } from './voo.js';
import { nomeDoRecurso } from './categorias.js';
import { hm } from './format.js';
import { gruposDoConflito } from './conflitos.js';
import { statusDoVoo, pedidosDosVoos } from './voo.js';
import { pinoDoVoo } from './fixos.js';
import { runAllocationEngine } from './engine.js';
import { instrutoresDoPedido } from './instrutor-escolhido.js';
import { ocupacaoDaEscala, problemaDoAluno, avioesQueServem, instrutoresQueServem } from './candidatos.js';
import { inativoNoEstado } from './inativos.js';

// A turma de Ground muda inteira; o voo, sozinho
const doGrupo = (resultado, voo) => (voo.isGround ? resultado.out.filter(o => o.classKey === voo.classKey) : [voo]);

export function sugerirReparos(estado, resultado, fKey, { maximo = 3, depoisDe = null, motor = runAllocationEngine } = {}) {
  const voo = resultado.out.find(o => o.fKey === fKey);
  if (!voo || !voo.conflito) return [];
  const grupo = doGrupo(resultado, voo);
  // Os outros voos do dia (sem o voo, ou a turma, e sem os cancelados), no horário marcado
  const ocupacao = ocupacaoDaEscala(resultado.out, { fStatus: estado.fStatus, exceto: grupo.map(o => o.fKey) });
  const alunos = new Map(estado.stu.map(s => [s.id, s]));
  const pedidoDo = pedidosDosVoos(estado.stu);
  const tipo = voo.isGround ? GROUND_EQ_TYPE : voo.eqType;
  // Os requisitos do voo: a missão, o tipo e o curso do aluno (o noturno do PC é IFR; js/frota.js)
  const curso = (alunos.get(voo.stuId) || {}).curso;

  // Os aviões que servem ao voo (o tipo, o "Só Parafuso" e o "Só VFR") e, com o instrutor, os em que ele voa
  const avioesPara = (a, b, instrutor = null) => avioesQueServem(estado, ocupacao, { tipo, mis: voo.mis, curso, a, b, ground: voo.isGround, instrutor })
    .filter(c => !c.problema).map(c => c.r);
  // Os instrutores que servem no avião r (o avião com habilitação própria exige a dele), cada um com o combustível a
  // menos com ele ({ x, problemas, reducao })
  const instrutoresPara = (a, b, r = voo.r) => instrutoresQueServem(estado, ocupacao,
    { mis: voo.mis, tipo, a, b, alunos: grupo.map(v => alunos.get(v.stuId)), stuKg: voo.stuKg, curso, r }).filter(c => !c.problemas.length);
  const comCombustivel = (texto, { reducao }) => (reducao > 0 ? `${texto} · reduzir ${reducao} gal` : texto);

  // O que o conflito pede, pelo código: o pedido mudou (só soltar), o horário não serve (outro
  // horário), ou o avião e o instrutor
  const grupos = gruposDoConflito(voo);
  const pedidoMudou = grupos.has('pedido');
  const problemaNoAviao = grupos.has('aviao');
  const problemaNoInstrutor = grupos.has('instrutor');
  const problemaNoAluno = grupos.has('horario');
  const atual = estado.ins.find(x => x.id === voo.insId);
  const opcoes = [];

  // No mesmo horário
  if (!problemaNoAluno && !pedidoMudou) {
    const { a, b } = voo;
    const avioes = avioesPara(a, b), instrutores = instrutoresPara(a, b);
    // Outro avião com o mesmo instrutor: um em que ele voa
    if (problemaNoAviao && !problemaNoInstrutor) avioesPara(a, b, atual).forEach(r => opcoes.push({ tipo: 'aviao', texto: `Trocar o avião: ${nomeDoRecurso(r)}`, mudancas: { r } }));
    if (problemaNoInstrutor && !problemaNoAviao) {
      instrutores.forEach(c => opcoes.push({ tipo: 'instrutor', texto: comCombustivel(`Trocar o instrutor: ${c.x.nm}`, c), mudancas: { insId: c.x.id } }));
    }
    // Os dois: o primeiro avião que tem um instrutor que serve (com a habilitação própria dele, quando o avião exige)
    const par = problemaNoAviao && problemaNoInstrutor ? avioes.map(r => [r, instrutoresPara(a, b, r)[0]]).find(([, c]) => c) : null;
    if (par) {
      const [r, c] = par;
      opcoes.push({ tipo: 'ambos', texto: comCombustivel(`Trocar o avião e o instrutor: ${nomeDoRecurso(r)}, com ${c.x.nm}`, c), mudancas: { r, insId: c.x.id } });
    }
  }

  // Sem nada no mesmo horário: o primeiro horário mais tarde, no mesmo dia, com o avião e o instrutor de antes quando
  // eles servem. Vale a disponibilidade de cada aluno, e o Ground termina antes dos voos que dependem dele. O fim é o
  // do motor para cada aluno (fimDasMissoesDoDia): com um Noturno na demanda do dia, as outras missões até as 17:30
  if (!opcoes.length && !pedidoMudou) {
    const duracao = voo.b - voo.a;
    const inicios = voo.isGround ? T.slice(0, NI) : horariosDaMissao(estado.horarios || HORARIOS_INICIAIS, voo.mis, tipo);
    const fimDoAluno = fimDasMissoesDoDia(estado.stu);
    const fimDoDia = Math.min(...grupo.map(v => fimDoAluno(v.stuId, voo.mis, tipo)));
    const voosDoAluno = v => ocupacao.alunos.get(v.stuId) || [];
    // (a volta do noturno de ontem não depende do Ground de hoje)
    const voosQueDependem = voo.isGround
      ? grupo.flatMap(voosDoAluno).filter(o => !o.isGround && !o.trecho && doesGroundGateFlight(voo.mis, { mis: o.mis, eq: o.eqType }))
      : [];
    const limite = Math.min(fimDoDia, ...voosQueDependem.map(o => o.a));
    const alunosPodem = (a, b) => grupo.every(v => {
      const permitidas = disponibilidadeDoAluno((pedidoDo(v) || {}).jan);
      return (!permitidas || permitidas(a)) && !problemaDoAluno(ocupacao, v.stuId, { a, b });
    });
    for (const m of inicios) {
      if (m <= Math.max(voo.a, depoisDe ?? -1) || m + duracao > limite || !estado.win[periodoDoMinuto(m)] || !alunosPodem(m, m + duracao)) continue;
      // O avião de antes, quando ele ainda serve ao voo e está livre; senão, um em que o instrutor de antes voa, ou outro
      const r = !voo.isGround && avioesPara(m, m + duracao).includes(voo.r) ? voo.r : avioesPara(m, m + duracao, atual)[0] || avioesPara(m, m + duracao)[0];
      const instrutores = r ? instrutoresPara(m, m + duracao, r) : [];
      const c = instrutores.find(i => i.x === atual) || instrutores[0];
      if (!r || !c) continue;
      opcoes.push({
        tipo: 'horario',
        texto: comCombustivel(`Passar para as ${hm(m)}, ${voo.isGround ? 'na' : 'no'} ${nomeDoRecurso(r)}, com ${c.x.nm}`, c),
        mudancas: { a: m, b: m + duracao, ...(voo.isGround ? {} : { r }), insId: c.x.id }
      });
      break;
    }
  }

  // Depois, sempre (até o máximo): os dois últimos grupos do voo cancelado (buscaDoVoo). O horário mais perto, antes ou
  // depois, dentro da disponibilidade do pedido ou fora dela (com o horário mais tarde já sugerido acima, só os de antes e
  // os de fora); e outro tipo de recurso que a missão permite. Fora da disponibilidade e em outro tipo, a sugestão pede a
  // confirmação com o aluno e muda também o pedido (repararComOPedido)
  if (!pedidoMudou) {
    const busca = buscaDoVoo(estado, resultado, voo, grupo, { depoisDe });
    const maisTarde = opcoes.some(o => o.tipo === 'horario');
    const horario = busca.outroHorario(maisTarde ? { so: x => x < voo.a || !busca.naDisponibilidade(x) } : {});
    const repetida = o => opcoes.some(x => x.mudancas && ['a', 'r', 'insId'].every(c => (x.mudancas[c] ?? voo[c]) === (o.mudancas[c] ?? voo[c])));
    for (const opcao of [horario, busca.outroTipo()]) if (opcao && !repetida(opcao)) opcoes.push(noReparo(opcao));
  }

  // Cada sugestão conferida no motor, aplicada como o reparo a aplica (com o pedido, quando ela o muda)
  const aplicar = (copia, opcao) => {
    if (opcao.pedido) repararComOPedido(copia, resultado, fKey, opcao);
    else copia.fixos = aplicarReparo(copia.fixos || {}, resultado, fKey, opcao);
  };
  const conferidas = conferirNoMotor(estado, voo, grupo.map(o => o.fKey), opcoes, { aplicar, motor, maximo, cancelado: false });
  // Soltar: o voo deixa de ser fixo e o motor o escala de novo, em volta dos outros (não vale para o voo em andamento)
  const emAndamento = grupo.some(v => STATUS_EM_ANDAMENTO.includes(statusDoVoo(v, estado.fStatus)));
  const soltar = emAndamento ? [] : [{ tipo: 'soltar', texto: 'Soltar o voo: o app escolhe de novo o horário, o avião e o instrutor', mudancas: null, soltar: true }];
  return [...conferidas, ...soltar, { tipo: 'cancelar', texto: 'Cancelar o voo (pede o motivo)', mudancas: null, motivo: motivoDoConflito(voo.conflito, inativoNoEstado(estado, (Array.isArray(estado.frota) ? estado.frota : []).find(f => f.reg === voo.r))) }];
}

// A sugestão conferida no motor, numa cópia do estado com ela aplicada (aplicar): fica só a que põe o voo onde ela diz. Na
// escala não aprovada o motor refaz em volta dos fixos os voos que não são fixos: a sugestão que muda ou tira algum deles
// (fora a unidade: o voo, ou a turma que muda com ele) diz quais (muda: as chaves) e pede a confirmação, como o diálogo do
// agendamento. O aviso do 7º voo local conta os locais do horário nessa escala (no conflito, só no horário novo: no mesmo,
// o voo já sai nele). Até maximo sugestões, na ordem
function conferirNoMotor(estado, voo, unidade, opcoes, { aplicar, motor, maximo, cancelado }) {
  const fora = new Set(unidade);
  const conferidas = [];
  let antes = null;
  for (const { aluno = null, ...opcao } of opcoes) {
    if (conferidas.length >= maximo) break;
    const copia = { ...estado, stu: structuredClone(estado.stu) };
    aplicar(copia, opcao);
    const sim = motor(copia);
    // O lugar que a sugestão dá ao voo (a do conflito muda só o que diz)
    const { a, r, insId } = { a: voo.a, r: voo.r, insId: voo.insId, ...opcao.mudancas };
    const novo = sim.out.find(o => o.fKey === voo.fKey);
    if (!novo || novo.a !== a || novo.insId !== insId || (!voo.isGround && novo.r !== r)) continue;
    antes = antes || motor(estado);
    const depois = new Map(sim.out.map(o => [o.fKey, o]));
    const mudados = antes.out.filter(o => !fora.has(o.fKey) && !mesmoLugar(o, depois.get(o.fKey)));
    const locais = cancelado || a !== voo.a ? avisoDosLocais(copia, sim, voo, fora, a) : null;
    const outros = mudados.length ? `Muda também ${mudados.length === 1 ? 'outro voo' : `${mudados.length} outros voos`}: ${
      mudados.slice(0, 4).map(o => oQueMuda(o, depois.get(o.fKey))).join('; ')}${mudados.length > 4 ? `; e mais ${mudados.length - 4}` : ''}.` : null;
    conferidas.push(comConfirmacao(mudados.length ? { ...opcao, muda: mudados.map(o => o.fKey) } : opcao, { aluno, locais, outros }));
  }
  return conferidas;
}

const mesmoLugar = (o, d) => Boolean(d) && d.a === o.a && d.b === o.b && d.r === o.r && d.insId === o.insId;
const rotuloDoVoo = o => (o.mid ? `${o.s} (${o.mis})` : o.s);
// O outro voo que a sugestão muda: "Aluno 1005, das 10:10 para as 11:30, no PP-LJV", ou "Aluno 1005 sai da escala"
function oQueMuda(o, d) {
  if (!d) return `${rotuloDoVoo(o)} sai da escala`;
  const partes = [
    d.a !== o.a ? `das ${hm(o.a)} para as ${hm(d.a)}` : d.b !== o.b ? `até as ${hm(d.b)}` : null,
    d.r !== o.r ? `${d.isGround ? 'na' : 'no'} ${nomeDoRecurso(d.r)}` : null,
    d.insId !== o.insId ? `com ${d.ins}` : null
  ].filter(Boolean);
  return `${rotuloDoVoo(o)}, ${partes.join(', ')}`;
}

// No máximo 6 voos locais saem no mesmo horário (a regra do 7º local: avisa e pede a confirmação). O aviso da sugestão que
// põe o voo local às m, onde já saem 6 na escala do motor com ela (os outros voos que não foram cancelados, no horário
// efetivo, sem o voo e a turma dele: fora), ou null
function avisoDosLocais(estado, resultado, voo, fora, m) {
  if (voo.isGround || !MISSOES_LOCAIS.includes(voo.mis)) return null;
  const locais = resultado.out.filter(o => {
    if (fora.has(o.fKey) || o.isGround || !MISSOES_LOCAIS.includes(o.mis)) return false;
    const status = statusDoVoo(o, estado.fStatus);
    return status !== 'Cancelado' && intervaloEfetivo(o, status, (estado.fObs || {})[o.fKey]).a === m;
  }).length;
  return locais >= LIMITE_DE_VOOS_LOCAIS
    ? `Às ${hm(m)}, o ${locais + 1}º voo local do horário: no máximo ${LIMITE_DE_VOOS_LOCAIS} voos locais saem no mesmo horário.` : null;
}

// A sugestão que pede a confirmação: a com o aluno (fora da disponibilidade do pedido, outro tipo), a do limite de locais
// e a que muda outros voos, uma frase cada; o botão armado diz qual ("Confirmei com o aluno" quando ela é com o aluno)
function comConfirmacao(opcao, { aluno = null, locais = null, outros = null }) {
  if (!aluno && !locais && !outros) return opcao;
  return { ...opcao, confirmar: [aluno, locais, outros].filter(Boolean).join(' '), armado: aluno ? 'Confirmei com o aluno' : 'Aplicar mesmo assim' };
}

// A sugestão da busca na lista do conflito: o instrutor escolhido acompanha o reparo como sempre (escolhasDaUnidade, no
// aplicar); o pedido vai junto só quando a sugestão muda a disponibilidade ou o tipo
const noReparo = ({ pedido, ...opcao }) => (pedido.jan === undefined && pedido.eq === undefined ? opcao : { ...opcao, pedido });

// O motivo de cancelamento que o conflito sugere (o diálogo do status já abre com ele marcado). O avião inativo no cadastro
// aparece indisponível, mas não está em manutenção: nenhum motivo
function motivoDoConflito(conflito, aviaoInativo = false) {
  if (conflito.some(c => /instrutor (saiu|não está disponível)/.test(c))) return 'Instrutor indisponível';
  if (conflito.includes('o avião está indisponível')) return aviaoInativo ? null : 'Manutenção da aeronave';
  return null;
}

// A sugestão aplicada nos voos fixos (devolve os fixos novos): na turma de Ground, em todos os alunos fixos dela. Soltar
// tira o voo (ou a turma) dos fixos
export function aplicarReparo(fixos, resultado, fKey, opcao) {
  const voo = resultado.out.find(o => o.fKey === fKey);
  if (!voo || !opcao || !(opcao.mudancas || opcao.soltar)) return fixos;
  const chaves = doGrupo(resultado, voo).map(o => o.fKey).filter(k => fixos[k]);
  if (opcao.soltar) return Object.fromEntries(Object.entries(fixos).filter(([k]) => !chaves.includes(k)));
  return { ...fixos, ...Object.fromEntries(chaves.map(k => [k, { ...fixos[k], ...opcao.mudancas }])) };
}

// ---------------------------------------------------------------------------------------------------------------------
// O voo cancelado

// As Sugestões do voo cancelado e da recusa do instrutor escolhido valem para a data aberta de hoje em diante: o que já
// passou não muda
export const dataQueAindaVoa = ({ data, hoje }) => Boolean(data && hoje && data >= hoje);

// O voo cancelado que ainda pode ser aproveitado: o da data aberta de hoje em diante, sem resultado registrado, que não foi
// cancelado porque o aluno faltou (e não é a volta do noturno de ontem)
export function cancelamentoAproveitavel(estado, voo, { data, hoje }) {
  if (!voo || voo.trecho || statusDoVoo(voo, estado.fStatus) !== 'Cancelado' || !dataQueAindaVoa({ data, hoje })) return false;
  const detalhe = (estado.fObs || {})[voo.fKey];
  if (detalhe && detalhe.motivo === 'Aluno ausente') return false;
  return !((estado.resultados || {}).doDia || []).some(r => r && r.voo === voo.fKey);
}

// A busca de um lugar para o voo (o cancelado, ou o do conflito, nos dois últimos grupos): os aviões e os instrutores que
// servem em cada horário e tipo, contra os outros voos do dia (o atrasado na nova decolagem); sem o que saiu pelo motivo
// (o instrutor, o avião, o horário); nunca passa por cima das habilitações, do peso, da lei, do "Não escalar com" nem dos
// períodos fechados
function buscaDoVoo(estado, resultado, voo, grupo, { depoisDe = null, semInstrutor = null, semAviao = null, semHorario = false } = {}) {
  // O voo atrasado ocupa o horário novo (o aviso dos locais também conta assim)
  const ocupacao = ocupacaoDaEscala(resultado.out, { fStatus: estado.fStatus, fObs: estado.fObs, efetivo: true, exceto: grupo.map(o => o.fKey) });
  const alunos = new Map(estado.stu.map(s => [s.id, s]));
  const pedidoDo = pedidosDosVoos(estado.stu);
  const curso = (alunos.get(voo.stuId) || {}).curso;
  const duracao = voo.b - voo.a;
  const tipoDoVoo = voo.isGround ? GROUND_EQ_TYPE : voo.eqType;
  const passou = m => depoisDe !== null && m <= depoisDe;
  const avioes = (tipo, a, b, instrutor = null) => avioesQueServem(estado, ocupacao, { tipo, mis: voo.mis, curso, a, b, ground: voo.isGround, instrutor })
    .filter(c => !c.problema && c.r !== semAviao).map(c => c.r);
  const instrutores = (tipo, a, b, r) => instrutoresQueServem(estado, ocupacao,
    { mis: voo.mis, tipo, a, b, alunos: grupo.map(v => alunos.get(v.stuId)), stuKg: voo.stuKg, curso, r: voo.isGround ? null : r })
    .filter(c => !c.problemas.length && c.x.id !== semInstrutor);
  // Até quando o aluno pode ir (o do motor) e, no Ground, antes dos voos que dependem dele
  const fimDoAluno = fimDasMissoesDoDia(estado.stu);
  const fimDoDia = Math.min(...grupo.map(v => fimDoAluno(v.stuId, voo.mis, tipoDoVoo)));
  const voosQueDependem = voo.isGround
    ? grupo.flatMap(v => ocupacao.alunos.get(v.stuId) || []).filter(o => !o.isGround && !o.trecho && doesGroundGateFlight(voo.mis, { mis: o.mis, eq: o.eqType }))
    : [];
  const limite = Math.min(fimDoDia, ...voosQueDependem.map(o => o.a));
  // O horário serve ao aluno (livre nele) e está na disponibilidade do pedido? (fora dela, só com o aluno)
  const alunoLivre = (a, b) => grupo.every(v => !problemaDoAluno(ocupacao, v.stuId, { a, b }));
  const naDisponibilidade = a => grupo.every(v => { const permitidas = disponibilidadeDoAluno((pedidoDo(v) || {}).jan); return !permitidas || permitidas(a); });
  // O voo começa depois do fim do Ground de que depende (o do aluno no dia, no tipo do voo)
  const inicioMinimo = tipo => (voo.isGround ? 0 : Math.max(0, ...grupo.flatMap(v => ocupacao.alunos.get(v.stuId) || [])
    .filter(o => o.isGround && doesGroundGateFlight(o.mis, { mis: voo.mis, eq: tipo })).map(o => o.b)));
  const horarioAberto = (m, tipo = tipoDoVoo) => m + duracao <= limite && m >= inicioMinimo(tipo) && Boolean(estado.win[periodoDoMinuto(m)])
    && !passou(m) && alunoLivre(m, m + duracao);
  const inicios = tipo => (voo.isGround ? T.slice(0, NI) : horariosDaMissao(estado.horarios || HORARIOS_INICIAIS, voo.mis, tipo));
  const atual = estado.ins.find(x => x.id === voo.insId);
  const comCombustivel = (texto, { reducao }) => (reducao > 0 ? `${texto} · reduzir ${reducao} gal` : texto);
  const noOuNa = r => `${voo.isGround ? 'na' : 'no'} ${nomeDoRecurso(r)}`;

  // Um lugar num horário e tipo: o avião (o de antes quando serve; senão um em que o instrutor de antes voa; senão outro)
  // e o instrutor (o de antes quando serve; senão o primeiro que serve)
  function lugar(tipo, m) {
    const b = m + duracao;
    const lista = avioes(tipo, m, b);
    const r = lista.includes(voo.r) ? voo.r : avioes(tipo, m, b, atual)[0] || lista[0];
    if (!r) return null;
    const lista2 = instrutores(tipo, m, b, r);
    const c = lista2.find(i => i.x === atual) || lista2[0];
    return c ? { r, c } : null;
  }
  const opcao = (tipoDaOpcao, tipo, m, { r, c }, rotulo) => {
    const fora = !naDisponibilidade(m), outroTipo = tipo !== tipoDoVoo;
    // aluno: a frase da confirmação com o aluno (conferirNoMotor a junta às outras)
    return {
      tipo: tipoDaOpcao,
      texto: comCombustivel(rotulo, c),
      mudancas: { a: m, b: m + duracao, ...(voo.isGround ? {} : { r }), insId: c.x.id },
      pedido: { insId: c.x.id, ...(fora ? { jan: `h${m}` } : {}), ...(outroTipo ? { eq: tipo } : {}) },
      aluno: fora || outroTipo ? `Confirme com o aluno: ${[fora ? `às ${hm(m)}, fora da disponibilidade do pedido` : '', outroTipo ? `no ${tipo}` : ''].filter(Boolean).join(', ')}.` : null
    };
  };
  // Os horários de um tipo: primeiro os da disponibilidade do pedido, depois os de fora (que pedem a confirmação com o
  // aluno); em cada parte, do mais perto do voo para o mais longe (empatados, o mais cedo)
  const pertoDoVoo = lista => [...lista].sort((x, y) => Number(!naDisponibilidade(x)) - Number(!naDisponibilidade(y))
    || Math.abs(x - voo.a) - Math.abs(y - voo.a) || x - y);

  return {
    tipoDoVoo,
    naDisponibilidade,
    // O mesmo horário, com as regras dos outros (o período aberto também)
    mesmoHorarioDisponivel: !semHorario && horarioAberto(voo.a),
    periodoFechado: !estado.win[periodoDoMinuto(voo.a)],
    // 1. O mesmo horário e o mesmo avião, com outro instrutor (até dois; o de antes seria o próprio voo cancelado)
    mesmoAviao(maximo = 2) {
      if (semAviao === voo.r) return [];
      const { a, b } = voo;
      // O avião, ou a sala de Ground, livre no horário
      if (!avioes(tipoDoVoo, a, b).includes(voo.r)) return [];
      return instrutores(tipoDoVoo, a, b, voo.r).filter(c => c.x.id !== voo.insId).slice(0, maximo)
        .map(c => opcao('instrutor', tipoDoVoo, a, { r: voo.r, c }, `${hm(a)} ${noOuNa(voo.r)}, com ${c.x.nm}`));
    },
    // 2. O mesmo horário, outro avião e o instrutor que serve nele: primeiro um avião em que o instrutor de antes voa, com
    // ele (só o avião faltou); senão, outro avião e o primeiro instrutor que serve
    outroAviao() {
      if (voo.isGround) return null;
      const { a, b } = voo;
      const outros = avioes(tipoDoVoo, a, b).filter(x => x !== voo.r);
      const comOAtual = atual && atual.id !== semInstrutor ? avioes(tipoDoVoo, a, b, atual).filter(x => x !== voo.r) : [];
      for (const r of [...comOAtual, ...outros.filter(x => !comOAtual.includes(x))]) {
        const lista = instrutores(tipoDoVoo, a, b, r);
        const c = lista.find(i => i.x === atual) || lista[0];
        if (c) return opcao('aviao', tipoDoVoo, a, { r, c }, `${hm(a)} ${noOuNa(r)}, com ${c.x.nm}`);
      }
      return null;
    },
    // 3. O horário mais perto, antes ou depois (so: os que valem, para o conflito só os de antes)
    outroHorario({ so = () => true } = {}) {
      for (const m of pertoDoVoo(inicios(tipoDoVoo).filter(x => x !== voo.a && so(x)))) {
        if (!horarioAberto(m)) continue;
        const l = lugar(tipoDoVoo, m);
        if (l) return opcao('horario', tipoDoVoo, m, l, `Passar para as ${hm(m)}, ${noOuNa(l.r)}, com ${l.c.x.nm}`);
      }
      return null;
    },
    // Por que nenhum horário do tipo serve: cada motivo com os seus horários ("o período está fechado (06:30, 08:20)"),
    // na ordem das regras; o mesmo horário do voo fica de fora no tipo dele (ele tem a linha própria) e quando saiu pelo
    // motivo. Vazio quando o tipo não tem outro horário
    porQueNao(tipo = tipoDoVoo) {
      const motivos = new Map();
      for (const m of inicios(tipo).filter(x => x !== voo.a || (tipo !== tipoDoVoo && !semHorario))) {
        const b = m + duracao;
        const motivo = passou(m) ? 'já passou'
          : !estado.win[periodoDoMinuto(m)] ? 'o período está fechado'
            : b > limite ? (b > fimDoDia ? 'passa do fim do dia do aluno' : 'passa do voo que depende do Ground')
              : m < inicioMinimo(tipo) ? 'antes do fim do Ground do aluno'
                : !alunoLivre(m, b) ? 'o aluno não está livre'
                  : !avioes(tipo, m, b).length ? (voo.isGround ? 'a sala não está livre' : 'nenhum avião livre')
                    : !lugar(tipo, m) ? 'nenhum instrutor que sirva'
                      : 'o voo não fica nele com os outros voos';
        if (!motivos.has(motivo)) motivos.set(motivo, []);
        motivos.get(motivo).push(m);
      }
      // (uma lista longa, como a dos horários de meia em meia hora, vai do primeiro ao último)
      const horarios = ms => (ms.length > 8 ? `${hm(ms[0])} a ${hm(ms.at(-1))}, ${ms.length} horários` : ms.map(hm).join(', '));
      return [...motivos].map(([motivo, ms]) => `${motivo} (${horarios(ms)})`).join('; ');
    },
    // 4. Outro tipo de recurso que a missão permite, no horário mais perto
    outroTipo() {
      if (voo.isGround) return null;
      for (const tipo of ((MIS[voo.mis] || {}).eq || []).filter(t => t !== tipoDoVoo)) {
        for (const m of pertoDoVoo(inicios(tipo).filter(x => (semHorario ? x !== voo.a : true)))) {
          if (!horarioAberto(m, tipo)) continue;
          const l = lugar(tipo, m);
          if (l) return opcao('tipo', tipo, m, l, `No ${tipo}: ${hm(m)} ${noOuNa(l.r)}, com ${l.c.x.nm}`);
        }
      }
      return null;
    }
  };
}

// O que pode voar no lugar do voo cancelado: { opcoes, impossivel }. Cada opção muda o voo (mudancas, o novo pino) e o
// pedido (pedido: o instrutor escolhido; a disponibilidade, quando o horário está fora dela; o tipo, em outro tipo); com
// confirmar, ela pede antes a confirmação com o aluno. Sem nenhuma: impossivel, o porquê de cada grupo
export function sugerirParaCancelado(estado, resultado, fKey, { depoisDe = null, maximo = 5, motor = runAllocationEngine } = {}) {
  const voo = resultado.out.find(o => o.fKey === fKey);
  if (!voo) return { opcoes: [], impossivel: [] };
  const grupo = doGrupo(resultado, voo).filter(v => statusDoVoo(v, estado.fStatus) === 'Cancelado');
  const motivo = ((estado.fObs || {})[fKey] || {}).motivo;
  const busca = buscaDoVoo(estado, resultado, voo, grupo, {
    depoisDe,
    semInstrutor: motivo === 'Instrutor indisponível' ? voo.insId : null,
    // O Ground não tem avião: a manutenção não tira a sala da busca
    semAviao: motivo === 'Manutenção da aeronave' && !voo.isGround ? voo.r : null,
    semHorario: motivo === 'Meteorologia' || motivo === 'Operacional'
  });
  const opcoes = [];
  if (busca.mesmoHorarioDisponivel) {
    opcoes.push(...busca.mesmoAviao());
    const outro = busca.outroAviao();
    if (outro) opcoes.push(outro);
  }
  const horario = busca.outroHorario();
  if (horario) opcoes.push(horario);
  const tipo = busca.outroTipo();
  if (tipo) opcoes.push(tipo);
  const conferidas = conferirNoMotor(estado, voo, grupo.map(o => o.fKey), opcoes, {
    aplicar: (copia, opcao) => aproveitarCancelado(copia, resultado, fKey, opcao), motor, maximo, cancelado: true
  });
  if (conferidas.length) return { opcoes: conferidas, impossivel: [] };
  const tipos = ((MIS[voo.mis] || {}).eq || []).filter(t => t !== busca.tipoDoVoo);
  return {
    opcoes: [],
    impossivel: [
      motivo === 'Meteorologia' || motivo === 'Operacional' ? `No mesmo horário: o voo foi cancelado por ${motivo.toLowerCase()} nele.`
        : !busca.mesmoHorarioDisponivel ? `No mesmo horário: ${depoisDe !== null && voo.a <= depoisDe ? 'ele já passou' : busca.periodoFechado ? 'o período está fechado' : 'o aluno não está livre nele'}.`
          : 'No mesmo horário: nenhum avião com um instrutor que sirva.',
      `Em outro horário: ${busca.porQueNao() || 'a missão não tem outro horário'}.`,
      tipos.length ? `Em outro tipo de recurso: ${tipos.map(t => `no ${t}, ${busca.porQueNao(t) || 'nenhum horário'}`).join('; ')}.`
        : `Em outro tipo de recurso: a missão só voa no ${busca.tipoDoVoo}.`
    ]
  };
}

const camposDoPedido = p => Object.fromEntries(CAMPOS_DO_PEDIDO.filter(c => p[c] !== undefined).map(c => [c, p[c]]));

// Aplica a sugestão no voo cancelado (no estado, como gravarAlteracao espera): o voo fica fixo no lugar da sugestão
// (agendado: o lugar é do operador), volta para Pendente sem o motivo do cancelamento, e o pedido recebe o que a sugestão
// muda (a disponibilidade, o tipo e, no pedido que tem um, o instrutor escolhido; o pino guarda o instrutor da sugestão).
// Na turma de Ground, todos os cancelados dela. Devolve a reversão
// (aproveitarCancelado), com o pino, o status, o detalhe e o pedido de antes de cada um; null quando não aplica
export function aproveitarCancelado(estado, resultado, fKey, opcao) {
  const voo = resultado.out.find(o => o.fKey === fKey);
  if (!voo || !opcao || !opcao.mudancas) return null;
  const grupo = doGrupo(resultado, voo).filter(v => statusDoVoo(v, estado.fStatus) === 'Cancelado');
  return mudarOVooEOPedido(estado, resultado, voo, grupo, opcao, { cancelado: true });
}

// Aplica no conflito a sugestão que também muda o pedido (o horário fora da disponibilidade, outro tipo): o voo fixo (na
// turma de Ground, os fixos dela) muda como no reparo de sempre, o status fica, e o pedido recebe a disponibilidade e o
// tipo da sugestão (o instrutor escolhido, só no pedido que tem um, como no reparo). A reversão é a do aproveitamento
// do cancelado (o pino, o status, o detalhe e o pedido de antes); null quando não aplica
export function repararComOPedido(estado, resultado, fKey, opcao) {
  const voo = resultado.out.find(o => o.fKey === fKey);
  if (!voo || !opcao || !opcao.mudancas || !opcao.pedido) return null;
  const grupo = doGrupo(resultado, voo).filter(v => Object.hasOwn(estado.fixos || {}, v.fKey));
  return mudarOVooEOPedido(estado, resultado, voo, grupo, opcao, { cancelado: false });
}

// O voo (o grupo) no lugar da sugestão e o pedido com o que ela muda, devolvendo a reversão. cancelado: o voo volta para
// Pendente, sem o motivo, e o pino passa a ser do operador (agendado); sem ele, o pino de antes recebe as mudanças. O
// instrutor da sugestão vira o escolhido só no pedido que já tinha um: no outro, ele fica no pino
function mudarOVooEOPedido(estado, resultado, voo, grupo, opcao, { cancelado }) {
  const voos = [], pedidos = [];
  // A turma de Ground que muda de horário ou de instrutor é outra turma: uma chave nova para os alunos aproveitados, a não
  // ser que eles voltem para a turma de mesmo horário e instrutor (duas turmas com a mesma chave seriam uma só no motor)
  // (os outros da turma: as linhas do resultado, fixas ou não)
  let chave = null;
  if (voo.isGround && grupo.length) {
    const { a, b, insId } = { ...pinoDoVoo(grupo[0]), ...opcao.mudancas };
    const fica = resultado.out.filter(o => o.isGround && o.classKey === voo.classKey && !grupo.includes(o));
    const usadas = new Set(resultado.out.filter(o => o.isGround).map(o => o.classKey));
    if (fica.length && !fica.every(o => o.a === a && o.b === b && o.insId === insId)) {
      chave = grupo[0].fKey;
      for (let n = 2; usadas.has(chave); n++) chave = `${grupo[0].fKey}_${n}`;
    }
  }
  estado.fixos = { ...(estado.fixos || {}) };
  if (cancelado) {
    estado.fStatus = { ...(estado.fStatus || {}) };
    estado.fObs = { ...(estado.fObs || {}) };
  }
  for (const v of grupo) {
    const aluno = estado.stu.find(s => s.id === v.stuId);
    const ref = aluno ? pedidoDoAluno(aluno, v.mid || 0) : null;
    if (!ref) continue;
    voos.push({ fKey: v.fKey, fixo: estado.fixos[v.fKey] || null, status: (estado.fStatus || {})[v.fKey] || null, detalhe: (estado.fObs || {})[v.fKey] || null });
    pedidos.push({ stuId: v.stuId, mid: v.mid || 0, pedido: camposDoPedido(ref) });
    const novaTurma = chave ? { classKey: chave } : {};
    if (cancelado) {
      estado.fixos[v.fKey] = { ...pinoDoVoo(v), ...opcao.mudancas, ...novaTurma, agendado: true };
      estado.fStatus[v.fKey] = 'Pendente';
      delete estado.fObs[v.fKey];
    } else estado.fixos[v.fKey] = { ...estado.fixos[v.fKey], ...opcao.mudancas, ...novaTurma };
    const { insId, ...doPedido } = opcao.pedido || {};
    Object.assign(ref, doPedido);
    if (insId && ref.insId) ref.insId = insId;
    normalizeMissionFields(ref);
  }
  return voos.length ? { kind: 'aproveitarCancelado', voos, pedidos } : null;
}

// Desfaz o aproveitamento (a reversão validada): o pino, o status, o detalhe e os campos do pedido de antes
export function desfazerAproveitamento(estado, { voos, pedidos }) {
  estado.fixos = { ...(estado.fixos || {}) };
  estado.fStatus = { ...(estado.fStatus || {}) };
  estado.fObs = { ...(estado.fObs || {}) };
  for (const { fKey, fixo, status, detalhe } of voos) {
    if (fixo) estado.fixos[fKey] = fixo; else delete estado.fixos[fKey];
    if (status) estado.fStatus[fKey] = status; else delete estado.fStatus[fKey];
    if (detalhe) estado.fObs[fKey] = detalhe; else delete estado.fObs[fKey];
  }
  for (const { stuId, mid, pedido } of pedidos) {
    const aluno = estado.stu.find(s => s.id === stuId);
    const ref = aluno ? pedidoDoAluno(aluno, mid) : null;
    if (!ref) continue;
    CAMPOS_DO_PEDIDO.forEach(c => { delete ref[c]; });
    Object.assign(ref, pedido);
    normalizeMissionFields(ref);
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// O pedido recusado porque o instrutor escolhido não serve

// O que encaixa o pedido recusado (fKey: a chave do voo que ele seria): o motor roda numa cópia com cada outro instrutor
// que pode fazer o pedido e com "Automático"; só fica o que faz o pedido entrar sem tirar nem mudar nenhum outro voo
// ("Automático" diz quem o app daria). A recusa do motor continua até o operador escolher. depoisDe: na escala de hoje, o
// minuto de agora (o pedido que entraria nele ou antes fica de fora, como no voo cancelado). [{ insId (0: Automático),
// texto }]
export function sugestoesDoRejeitado(estado, resultado, fKey, { depoisDe = null, motor = runAllocationEngine } = {}) {
  const [stuId, mid] = fKey.split('_').map(Number);
  const aluno = estado.stu.find(s => s.id === stuId);
  const pedido = aluno ? pedidoDoAluno(aluno, mid) : null;
  if (!pedido || !resultado) return [];
  const antes = new Map(resultado.out.map(o => [o.fKey, o]));
  const candidatos = [
    ...instrutoresDoPedido(estado, aluno, pedido).filter(o => o.nota === '' && o.id !== pedido.insId).map(o => o.id),
    ...(pedido.insId ? [0] : [])
  ];
  const opcoes = [];
  for (const insId of candidatos) {
    const copia = { ...estado, stu: structuredClone(estado.stu) };
    const ref = pedidoDoAluno(copia.stu.find(s => s.id === stuId), mid);
    if (insId) ref.insId = insId; else delete ref.insId;
    const sim = motor(copia);
    const novo = sim.out.find(o => o.fKey === fKey);
    if (!novo || (depoisDe !== null && novo.a <= depoisDe)) continue;
    const outros = sim.out.filter(o => o.fKey !== fKey);
    const mudou = outros.length !== resultado.out.length || outros.some(o => {
      const era = antes.get(o.fKey);
      return !era || era.a !== o.a || era.b !== o.b || era.r !== o.r || era.insId !== o.insId;
    });
    if (mudou) continue;
    const lugar = `${hm(novo.a)} ${novo.isGround ? 'na' : 'no'} ${nomeDoRecurso(novo.r)}`;
    opcoes.push({ insId, texto: insId ? `Com ${novo.ins}: ${lugar}` : `Automático (o app escolhe ${novo.ins}): ${lugar}` });
  }
  return opcoes;
}
