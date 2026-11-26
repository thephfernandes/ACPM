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
// ou depois; outro tipo de recurso que a missão permite. A lista do conflito também ganha o horário mais perto antes dele
import { GROUND_EQ_TYPE, T, NI, MIS } from './config.js';
import { CAMPOS_DO_PEDIDO } from './dias.js';
import { normalizeMissionFields } from './rules.js';
import { HORARIOS_INICIAIS, horariosDaMissao, periodoDoMinuto, fimDasMissoesDoDia } from './horarios.js';
import { STATUS_EM_ANDAMENTO } from './status.js';
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

export function sugerirReparos(estado, resultado, fKey, { maximo = 3, depoisDe = null } = {}) {
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

  // Sem nada até aqui: o horário mais perto antes deste, dentro da disponibilidade do aluno (o reparo muda só o voo
  // fixo e o instrutor escolhido; outro tipo e a disponibilidade mudam o pedido, e ficam com o voo cancelado)
  if (!opcoes.length && !pedidoMudou) {
    const antes = buscaDoVoo(estado, resultado, voo, grupo, { depoisDe }).outroHorario({ so: m => m < voo.a });
    if (antes && !antes.confirmar) opcoes.push(antes);
  }

  // Soltar: o voo deixa de ser fixo e o motor o escala de novo, em volta dos outros (não vale para o voo em andamento)
  const emAndamento = grupo.some(v => STATUS_EM_ANDAMENTO.includes(statusDoVoo(v, estado.fStatus)));
  const soltar = emAndamento ? [] : [{ tipo: 'soltar', texto: 'Soltar o voo: o app escolhe de novo o horário, o avião e o instrutor', mudancas: null, soltar: true }];
  return [...opcoes.slice(0, maximo), ...soltar, { tipo: 'cancelar', texto: 'Cancelar o voo (pede o motivo)', mudancas: null, motivo: motivoDoConflito(voo.conflito, inativoNoEstado(estado, (Array.isArray(estado.frota) ? estado.frota : []).find(f => f.reg === voo.r))) }];
}

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

// O voo cancelado que ainda pode ser aproveitado: o da data aberta de hoje em diante, sem resultado registrado, que não foi
// cancelado porque o aluno faltou (e não é a volta do noturno de ontem)
export function cancelamentoAproveitavel(estado, voo, { data, hoje }) {
  if (!voo || voo.trecho || statusDoVoo(voo, estado.fStatus) !== 'Cancelado' || !data || !hoje || data < hoje) return false;
  const detalhe = (estado.fObs || {})[voo.fKey];
  if (detalhe && detalhe.motivo === 'Aluno ausente') return false;
  return !((estado.resultados || {}).doDia || []).some(r => r && r.voo === voo.fKey);
}

// A busca de um lugar para o voo (o cancelado, ou o do conflito, nos dois últimos grupos): os aviões e os instrutores que
// servem em cada horário e tipo, contra os outros voos do dia; sem o que saiu pelo motivo (o instrutor, o avião, o
// horário); nunca passa por cima das habilitações, do peso, da lei, do "Não escalar com" nem dos períodos fechados
function buscaDoVoo(estado, resultado, voo, grupo, { depoisDe = null, semInstrutor = null, semAviao = null, semHorario = false } = {}) {
  const ocupacao = ocupacaoDaEscala(resultado.out, { fStatus: estado.fStatus, exceto: grupo.map(o => o.fKey) });
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
    return {
      tipo: tipoDaOpcao,
      texto: comCombustivel(rotulo, c),
      mudancas: { a: m, b: m + duracao, ...(voo.isGround ? {} : { r }), insId: c.x.id },
      pedido: { insId: c.x.id, ...(fora ? { jan: `h${m}` } : {}), ...(outroTipo ? { eq: tipo } : {}) },
      ...(fora || outroTipo ? { confirmar: `Confirme com o aluno: ${[fora ? `às ${hm(m)}, fora da disponibilidade do pedido` : '', outroTipo ? `no ${tipo}` : ''].filter(Boolean).join(', ')}.` } : {})
    };
  };
  // Os horários de um tipo: primeiro os da disponibilidade do pedido, depois os de fora (que pedem a confirmação com o
  // aluno); em cada parte, do mais perto do voo para o mais longe (empatados, o mais cedo)
  const pertoDoVoo = lista => [...lista].sort((x, y) => Number(!naDisponibilidade(x)) - Number(!naDisponibilidade(y))
    || Math.abs(x - voo.a) - Math.abs(y - voo.a) || x - y);

  return {
    tipoDoVoo,
    mesmoHorarioDisponivel: !semHorario && !passou(voo.a) && voo.a + duracao <= limite && alunoLivre(voo.a, voo.b),
    // 1. O mesmo horário e o mesmo avião, com outro instrutor (até dois)
    mesmoAviao(maximo = 2) {
      if (semAviao === voo.r) return [];
      const { a, b } = voo;
      // O avião, ou a sala de Ground, livre no horário
      if (!avioes(tipoDoVoo, a, b).includes(voo.r)) return [];
      return instrutores(tipoDoVoo, a, b, voo.r).slice(0, maximo).map(c => opcao('instrutor', tipoDoVoo, a, { r: voo.r, c },
        `${hm(a)} ${noOuNa(voo.r)}, com ${c.x.nm}`));
    },
    // 2. O mesmo horário, outro avião (e o instrutor que serve nele)
    outroAviao() {
      if (voo.isGround) return null;
      const { a, b } = voo;
      for (const r of avioes(tipoDoVoo, a, b).filter(x => x !== voo.r)) {
        const c = instrutores(tipoDoVoo, a, b, r)[0];
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
export function sugerirParaCancelado(estado, resultado, fKey, { depoisDe = null, maximo = 5 } = {}) {
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
  if (opcoes.length) return { opcoes: opcoes.slice(0, maximo), impossivel: [] };
  const tipos = ((MIS[voo.mis] || {}).eq || []).filter(t => t !== busca.tipoDoVoo);
  return {
    opcoes: [],
    impossivel: [
      motivo === 'Meteorologia' || motivo === 'Operacional' ? `No mesmo horário: o voo foi cancelado por ${motivo.toLowerCase()} nele.`
        : !busca.mesmoHorarioDisponivel ? `No mesmo horário: ${depoisDe !== null && voo.a <= depoisDe ? 'ele já passou' : 'o aluno não está livre nele'}.`
          : 'No mesmo horário: nenhum avião com um instrutor que sirva.',
      'Em outro horário: nenhum, até o fim do dia, com o avião e o instrutor livres.',
      tipos.length ? `Em outro tipo de recurso (${tipos.join(', ')}): nenhum livre.` : `Em outro tipo de recurso: a missão só voa no ${busca.tipoDoVoo}.`
    ]
  };
}

const camposDoPedido = p => Object.fromEntries(CAMPOS_DO_PEDIDO.filter(c => p[c] !== undefined).map(c => [c, p[c]]));

// Aplica a sugestão no voo cancelado (no estado, como gravarAlteracao espera): o voo fica fixo no lugar da sugestão
// (agendado: o lugar é do operador), volta para Pendente sem o motivo do cancelamento, e o pedido recebe o que a sugestão
// muda (o instrutor, a disponibilidade, o tipo). Na turma de Ground, todos os cancelados dela. Devolve a reversão
// (aproveitarCancelado), com o pino, o status, o detalhe e o pedido de antes de cada um; null quando não aplica
export function aproveitarCancelado(estado, resultado, fKey, opcao) {
  const voo = resultado.out.find(o => o.fKey === fKey);
  if (!voo || !opcao || !opcao.mudancas) return null;
  const grupo = doGrupo(resultado, voo).filter(v => statusDoVoo(v, estado.fStatus) === 'Cancelado');
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
  estado.fStatus = { ...(estado.fStatus || {}) };
  estado.fObs = { ...(estado.fObs || {}) };
  for (const v of grupo) {
    const aluno = estado.stu.find(s => s.id === v.stuId);
    const ref = aluno ? pedidoDoAluno(aluno, v.mid || 0) : null;
    if (!ref) continue;
    voos.push({ fKey: v.fKey, fixo: estado.fixos[v.fKey] || null, status: estado.fStatus[v.fKey] || null, detalhe: estado.fObs[v.fKey] || null });
    pedidos.push({ stuId: v.stuId, mid: v.mid || 0, pedido: camposDoPedido(ref) });
    estado.fixos[v.fKey] = { ...pinoDoVoo(v), ...opcao.mudancas, ...(chave ? { classKey: chave } : {}), agendado: true };
    estado.fStatus[v.fKey] = 'Pendente';
    delete estado.fObs[v.fKey];
    Object.assign(ref, opcao.pedido || {});
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
// ("Automático" diz quem o app daria). A recusa do motor continua até o operador escolher. [{ insId (0: Automático),
// texto }]
export function sugestoesDoRejeitado(estado, resultado, fKey, motor = runAllocationEngine) {
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
    if (!novo) continue;
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
