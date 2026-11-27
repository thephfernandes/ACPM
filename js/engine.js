// Motor de alocação determinístico da escala do dia e utilitários de horas e de ocupação.
// runAllocationEngine é uma função pura: recebe o estado e devolve { out, al, tot } sem alterá-lo.
import { MIS, DEFAULT_LIM, GROUND_EQ_TYPE, GROUND_REG, GROUND_DURATION_MIN, GROUND_DURATION_H, AIRCRAFT_EQ_TYPES, MISSOES_LOCAIS, LIMITE_DE_VOOS_LOCAIS, MINUTOS_DO_DIA } from './config.js';
import { FROTA_INICIAL, matriculasDoTipo, matriculasParaOVoo, motivoDoAviao, instrutorVoaNoAviao, recursoDaFrota, salaDisponivel } from './frota.js';
import { hm, fmtH } from './format.js';
import { isGroundMission, doesGroundGateFlight, disponibilidadeDoAluno, disponibilidadeAtual, rotuloDaDisponibilidade, duracaoValida, duracaoFixaDaMissao, minutoConfirmado } from './rules.js';
import { horariosDaMissao, horariosDoTipo, periodoDoMinuto, minutoDaPreferencia, ordenarPelaPreferencia } from './horarios.js';
import { categoriaDoTipo } from './categorias.js';
import { horarioAberto } from './fechamentos.js';
import { podeFazer, descreverExigencias } from './habilitacoes.js';
import { categoriaDoRodizio } from './rodizio.js';
import { intervaloEfetivo, STATUS_EM_ANDAMENTO } from './status.js';
import { sobrepoe, livre, cabeNoSaldo, folgaAte, problemasDoInstrutor } from './viabilidade.js';
import { reducaoNecessaria, combustivelDoVoo } from './combustivel.js';
import { compactar, custoDaEscala } from './compactar.js';
import { contextoDaEscala, contextoDaEscalaMontada, filaDosPedidos, conferirFixos, concluirEscala, avisosDoPriorizarCom } from './conferencia.js';
import { chaveDoVoo, statusDoVoo, unidadeDoVoo, ocupacaoDoVoo, compromissoDoVoo, exigeDosVoos, pedidosDosVoos } from './voo.js';
import { menorPrimeiro, soma, paradasEntre } from './util.js';

// Entre os instrutores possíveis, primeiro os que têm menos habilitações: os mais versáteis ficam livres
const qtdHabilitacoes = x => (Array.isArray(x.hab) ? x.hab.length : 0);

// Os instrutores que servem para o horário (as regras em js/viabilidade.js). Sem nenhum, a regra que barrou o que
// chegou mais longe nelas diz o motivo da rejeição: disponível e habilitado, livre, sem bloqueio, dentro da lei e do peso
const ETAPAS_DO_INSTRUTOR = ['disp', 'busy', 'bloq', 'limite', 'peso'];
const ETAPA_DO_PROBLEMA = { 'instrutor-indisponivel': 0, habilitacao: 0, 'instrutor-ocupado': 1, bloqueio: 2, 'limite-da-lei': 3, peso: 4 };
function instrutoresQueServem(instrutores, problemasDe) {
  const servem = [];
  let maisLonge = 0;
  for (const x of instrutores) {
    const [problema] = problemasDe(x);
    if (problema) maisLonge = Math.max(maisLonge, ETAPA_DO_PROBLEMA[problema.codigo]);
    else servem.push(x);
  }
  return { servem, barrou: servem.length ? null : ETAPAS_DO_INSTRUTOR[maisLonge] };
}

// Continuidade de avião (eficiência de pátio): a alocação segue a prioridade dos pedidos, não o horário, e às vezes
// deixa um instrutor em duas matrículas do mesmo tipo. Depois de alocar, as matrículas de cada tipo de avião são
// redistribuídas com o instrutor como unidade: quem tem mais voos escolhe primeiro e fica com uma matrícula livre em
// todos os seus horários; se não houver, voo a voo, primeiro nas matrículas que ele já usa. Só a matrícula muda
// (aluno, instrutor e horário continuam); o PR-JPL continua só para o Parafuso e aviões em manutenção não entram.
// A redistribuição só vale quando diminui as trocas de avião (senão, ou se algum voo não couber, fica a original).
// Por último, quem ainda estiver em duas matrículas passa para uma que esteja livre em todos os horários dele.

// O tempo parado dos aviões (minutos entre um voo e o seguinte de cada matrícula)
function paradoDosAvioes(voos, matricula) {
  const porMatricula = new Map();
  voos.forEach(o => (porMatricula.get(matricula(o)) || porMatricula.set(matricula(o), []).get(matricula(o))).push([o.a, o.b]));
  return soma([...porMatricula.values()].flatMap(paradasEntre));
}

// Matrículas a mais (do mesmo tipo) por instrutor no dia
function trocasDeAviao(voos, matricula) {
  const porInstrutor = new Map();
  voos.forEach(o => (porInstrutor.get(o.insId) || porInstrutor.set(o.insId, new Set()).get(o.insId)).add(matricula(o)));
  return [...porInstrutor.values()].reduce((total, regs) => total + regs.size - 1, 0);
}

// As matrículas chegam na ordem do hangar. Cada instrutor, pela hora do primeiro voo, vai para o avião onde o dia
// inteiro dele cabe: primeiro um que já saiu, com a menor folga até os voos dele; senão, o primeiro do hangar. serve: se o
// avião serve ao voo (os requisitos do voo e o que o avião exige do instrutor)
function redistribuirTipo(voos, matriculas, saldo, fixos = [], serve = () => true) {
  const ocupacao = new Map(matriculas.map(r => [r, fixos.filter(o => o.r === r).map(o => [o.a, o.b])]));
  const horas = new Map(matriculas.map(r => [r, fixos.filter(o => o.r === r).reduce((total, o) => total + o.h, 0)]));
  const cabe = (r, f) => serve(r, f) && livre(ocupacao.get(r), f.a, f.b) && cabeNoSaldo(horas.get(r), f.h, saldo(r));
  const blocos = new Map();
  voos.forEach(o => (blocos.get(o.insId) || blocos.set(o.insId, []).get(o.insId)).push(o));
  const primeiro = bloco => Math.min(...bloco.map(o => o.a));
  const ordem = [...blocos.values()].sort((x, y) => primeiro(x) - primeiro(y) || y.length - x.length);
  const folgaDoBloco = (r, bloco) => Math.min(...bloco.map(f => folgaAte(ocupacao.get(r), f.a, f.b)));
  const nova = new Map();
  for (const bloco of ordem) {
    const horasDoBloco = bloco.reduce((total, f) => total + f.h, 0);
    const inteira = matriculas.filter(r => bloco.every(f => cabe(r, f)) && cabeNoSaldo(horas.get(r), horasDoBloco, saldo(r)))
      .sort((a, b) => menorPrimeiro(folgaDoBloco(a, bloco), folgaDoBloco(b, bloco)))[0];
    for (const f of [...bloco].sort((x, y) => x.a - y.a)) {
      const jaUsadas = [...new Set(bloco.filter(o => nova.has(o)).map(o => nova.get(o)))];
      const r = inteira || [...jaUsadas, ...matriculas.filter(m => !jaUsadas.includes(m))].find(m => cabe(m, f));
      if (!r) return null;
      ocupacao.get(r).push([f.a, f.b]);
      horas.set(r, horas.get(r) + f.h);
      nova.set(f, r);
    }
  }
  return nova;
}

function manterInstrutorNoMesmoAviao(out, state, saldo, frota, posicao, serve) {
  // Os aviões "Só Parafuso" ficam de fora: o Parafuso no C152 só pode ir para eles
  const soParafuso = matriculasDoTipo(frota, 'C152', { parafuso: true });
  for (const tipo of AIRCRAFT_EQ_TYPES) {
    // O voo com status de andamento fica no avião dele, como o fixo
    const preso = o => o.fixo || [...STATUS_EM_ANDAMENTO, 'Cancelado'].includes(statusDoVoo(o, state.fStatus));
    const voos = out.filter(o => o.eqType === tipo && !soParafuso.includes(o.r) && !preso(o));
    // Os voos fixos (escala aprovada) ficam no avião deles e ocupam o horário (o atrasado, o horário novo); o cancelado
    // não ocupa nada
    const fixosDoTipo = out.filter(o => o.eqType === tipo && preso(o) && statusDoVoo(o, state.fStatus) !== 'Cancelado')
      .map(o => { const e = intervaloEfetivo(o, statusDoVoo(o, state.fStatus), (state.fObs || {})[o.fKey]); const [a, b] = ocupacaoDoVoo(o, e.a, e.b); return { ...o, a, b }; });
    const matriculas = matriculasDoTipo(frota, tipo).filter(r => state.av[r]).sort((a, b) => posicao(a) - posicao(b));
    const nova = redistribuirTipo(voos, matriculas, saldo, fixosDoTipo, serve);
    // A distribuição nova vale quando tem menos trocas de avião; com as mesmas trocas, menos aviões fora do hangar e,
    // com os mesmos aviões, menos tempo parado
    const pontos = matricula => [trocasDeAviao(voos, matricula), new Set(voos.map(matricula)).size, paradoDosAvioes(voos, matricula)];
    const [novos, atuais] = nova && voos.length ? [pontos(o => nova.get(o)), pontos(o => o.r)] : [null, null];
    if (novos && (novos[0] - atuais[0] || novos[1] - atuais[1] || novos[2] - atuais[2]) < 0) voos.forEach(o => { o.r = nova.get(o); });

    // Cada mudança tira uma troca do dia, então a repetição termina; uma mudança pode liberar outra
    const horasDe = lista => lista.reduce((total, o) => total + o.h, 0);
    const livreEmTodos = (r, meus) => meus.every(f => serve(r, f) && ![...voos, ...fixosDoTipo].some(o => !meus.includes(o) && o.r === r && sobrepoe(o.a, o.b, f.a, f.b))) &&
      cabeNoSaldo(horasDe([...voos, ...fixosDoTipo].filter(o => o.r === r && !meus.includes(o))), horasDe(meus), saldo(r));
    let mudou = true;
    while (mudou) {
      mudou = false;
      for (const insId of new Set(voos.map(o => o.insId))) {
        const meus = voos.filter(o => o.insId === insId);
        const usadas = [...new Set(meus.map(o => o.r))];
        if (usadas.length < 2) continue;
        const voosEm = r => meus.filter(o => o.r === r).length;
        const destino = [...usadas.sort((a, b) => voosEm(b) - voosEm(a)), ...matriculas.filter(r => !usadas.includes(r))]
          .find(r => livreEmTodos(r, meus));
        if (destino) {
          meus.forEach(o => { o.r = destino; });
          mudou = true;
        }
      }
    }
  }
}

// Comparação de chaves de ordenação: a primeira posição diferente decide
const vemAntes = (a, b) => { const i = a.findIndex((v, k) => v !== b[k]); return i >= 0 && a[i] < b[i]; };

// O tempo parado de um instrutor (minutos entre um compromisso e o seguinte), pelas unidades dele no dia
function paradoDasUnidades(unidades) {
  return soma(paradasEntre(unidades.map(u => [u.a, u.b])));
}

// Divisão igual das horas do dia: depois de montada a escala, voos e aulas passam do instrutor com mais
// horas para o com menos, enquanto todas as regras continuam valendo: a habilitação, a disponibilidade durante todo o
// voo, o horário livre, o bloqueio do aluno, o peso e o aluno não repetir o instrutor no dia. Os voos do rodízio
// (cheque, MLTE, noturno e C172) ficam com quem a fila escolheu, e o voo com o instrutor escolhido pelo operador (ou o
// do “Priorizar com” do aluno), com ele; a turma de Ground se move inteira e conta 1h30 uma vez. Cada troca diminui a soma dos quadrados das horas, então a repetição termina. O voo cancelado não conta nem
// ocupa o instrutor, o atrasado ocupa o horário novo, e o voo com status de andamento não muda de instrutor
function equalizarHoras(out, state, limites, historico) {
  const ativos = state.ins.filter(x => x.on);
  const alunos = new Map(state.stu.map(s => [s.id, s]));
  // O que a missão do curso dos pedidos da unidade exige do INVA (quem recebe a unidade também precisa ter)
  const exigeDa = exigeDosVoos(state.stu);
  const grupos = new Map();
  out.forEach(o => {
    const chave = unidadeDoVoo(o);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(o);
  });
  // A unidade cancelada (todos os alunos dela) fica de fora; o aluno cancelado de uma turma acompanha a turma
  const unidades = [...grupos.values()].filter(voos => voos.some(v => statusDoVoo(v, state.fStatus) !== 'Cancelado')).map(voos => {
    const v = voos.find(o => statusDoVoo(o, state.fStatus) !== 'Cancelado');
    return {
      voos, ...intervaloEfetivo(v, statusDoVoo(v, state.fStatus), (state.fObs || {})[v.fKey]), h: v.h, mis: v.mis, eqType: v.eqType, isGround: v.isGround,
      // O instrutor escolhido pelo operador (na Demanda ou na Escala) e o do “Priorizar com” do aluno não mudam
      presa: voos.some(o => o.fixo || o.insEscolhido || o.insPar || STATUS_EM_ANDAMENTO.includes(statusDoVoo(o, state.fStatus)))
    };
  });
  const instrutorDa = u => u.voos[0].insId;
  const daQuem = id => unidades.filter(u => instrutorDa(u) === id);

  // O receptor serve para a unidade (o combustível não piora e o peso dele precisa estar informado) e nenhum aluno
  // dela já voa com ele no dia
  const compromisso = u => compromissoDoVoo(u.voos[0], u.a, u.b);
  const podeReceber = (x, u) => {
    if (instrutorDa(u) === x.id) return false;
    const deles = daQuem(x.id);
    if (u.voos.some(v => deles.some(o => o.voos.some(w => w.stuId === v.stuId)))) return false;
    const [v] = u.voos;
    // O curso do aluno e o avião do voo (o noturno do PC exige IFR; o avião com habilitação própria, a dele)
    const recurso = u.isGround ? null : recursoDaFrota(Array.isArray(state.frota) ? state.frota : FROTA_INICIAL, v.r);
    return !problemasDoInstrutor(x, { mis: u.mis, tipo: u.isGround ? GROUND_EQ_TYPE : u.eqType, a: u.a, b: u.b, alunos: u.voos.map(o => alunos.get(o.stuId)), stuKg: v.stuKg, curso: (alunos.get(v.stuId) || {}).curso, recurso, exige: exigeDa(u.voos) },
      { compromissos: deles.map(compromisso), historico: historico(x.id), limites, peso: { reducaoMaxima: v.comb ? v.comb.reduzirGal : 0, exigirPesoDoInstrutor: true } }).length;
  };

  for (let rodada = 0; rodada < 1000; rodada++) {
    const horas = new Map(ativos.map(x => [x.id, 0]));
    unidades.forEach(u => horas.set(instrutorDa(u), (horas.get(instrutorDa(u)) || 0) + u.h));
    // Do instrutor com mais horas, entre as passagens válidas, a que deixa menos tempo parado no dia dos dois;
    // empatadas, para quem tem menos horas, menos habilitações e o menor id, e o voo mais cedo
    let troca = null;
    for (const doador of [...horas.keys()].sort((p, q) => horas.get(q) - horas.get(p) || p - q)) {
      const meus = daQuem(doador);
      for (const u of meus.filter(o => !categoriaDoRodizio(o.mis, o.eqType) && !o.presa)) {
        const semEle = paradoDasUnidades(meus.filter(o => o !== u)) - paradoDasUnidades(meus);
        for (const x of ativos) {
          if (!(horas.get(x.id) + u.h < horas.get(doador) - 1e-9) || !podeReceber(x, u)) continue;
          const deles = daQuem(x.id);
          const chave = [semEle + paradoDasUnidades([...deles, u]) - paradoDasUnidades(deles), horas.get(x.id), qtdHabilitacoes(x), x.id, u.a];
          if (!troca || vemAntes(chave, troca.chave)) troca = { u, x, chave };
        }
      }
      if (troca) break;
    }
    if (!troca) return;
    for (const v of troca.u.voos) {
      v.insId = troca.x.id;
      v.ins = troca.x.nm;
      v.insKg = troca.x.kg || 0;
      v.kg = v.stuKg && troca.x.kg ? v.stuKg + troca.x.kg : 0;
      if (!v.isGround) {
        delete v.comb;
        Object.assign(v, combustivelDoVoo(v.stuKg, troca.x.kg, v.eqType, v.b - v.a, v.mis));
      }
    }
  }
}

// Por que os instrutores do “Priorizar com” do aluno não puderam: o que vale para todos eles (não vêm, sem a habilitação, em
// “Não escalar com”) ou a regra que mais barrou na busca só com eles (fc: as contagens da busca)
const MOTIVO_SEM_PAR = {
  disp: 'indisponível nos horários possíveis', busy: 'ocupado nos horários possíveis', bloq: 'em “Não escalar com”',
  limite: 'no limite da Lei do Aeronauta', peso: 'peso acima do limite do avião',
  aviaoProprio: 'sem a habilitação própria dos aviões livres'
};
function motivoSemPar(doPar, stu, d, tipo, fc) {
  if (doPar.every(x => !x.on)) return 'fora nesta data';
  const habilitado = x => podeFazer(x, d.mis, tipo, { curso: stu.curso, exige: d.exige });
  if (doPar.every(x => !x.on || !habilitado(x))) return 'sem a habilitação da missão';
  if (doPar.every(x => !x.on || !habilitado(x) || (stu.bl || []).includes(x.id))) return 'em “Não escalar com”';
  const contagens = Object.entries(fc || {}).filter(([k, n]) => n && Object.hasOwn(MOTIVO_SEM_PAR, k)).sort((a, b) => b[1] - a[1]);
  return contagens.length ? MOTIVO_SEM_PAR[contagens[0][0]] : 'sem horário possível com ele';
}

// As recusas por falta de lugar no horário: os 6 voos locais (o 7º não confirmado), os aviões e os instrutores
const RECUSAS_QUE_ESPERAM = ['limite-de-locais', 'avioes-ocupados', 'instrutores-ocupados'];

// O minuto pelo qual o pedido (d) recusado espera: o horário exato dele (o jan h<minuto>), quando a recusa é só por falta de
// lugar nele; senão (sem horário exato, ou recusado por outro motivo), null
function minutoDaEspera(d, recusa) {
  const exato = disponibilidadeAtual(d.jan);
  return typeof exato === 'string' && /^h\d+$/.test(exato) && RECUSAS_QUE_ESPERAM.includes(recusa.codigo) ? Number(exato.slice(1)) : null;
}

// O “Priorizar com” escolhe o instrutor, não o horário (F1h, N9; Pedro, 2026-11-26: a ordem da fila fica com o horário).
// Depois de montada a escala (a divisão das horas, a compactação e a troca de matrículas), os voos que começam no mesmo
// horário trocam de instrutor entre si, ou passam para um instrutor sem voo nele, para que o maior número de alunos voe com
// um instrutor do “Priorizar com”: na ordem da fila, cada aluno que ficou com outro instrutor procura o caminho mais curto
// (ele vai para um instrutor do “Priorizar com” dele; quem estava com esse vai para outro que sirva ao voo dele; e assim por
// diante, até um instrutor sem voo no horário ou o que o aluno deixou), na ordem dos instrutores do aluno e do cadastro.
// Nenhum horário nem avião muda, e todas as regras continuam valendo: a habilitação (com o que a missão do curso exige e a
// habilitação própria do avião), a disponibilidade durante o voo inteiro, o horário livre, a lei, o “Não escalar com” e o
// peso (com o peso do instrutor informado, sem menos combustível que antes). Não trocam de instrutor: os voos fixos e os com
// status, o do instrutor escolhido para o dia, as turmas de Ground, a volta do noturno e o voo cujo aviso do peso nomeia o
// instrutor (sem o peso dele); quem já está com um instrutor do “Priorizar com” só passa para outro do “Priorizar com” dele.
// O rodízio (C172, PA-34, cheques, Noturno) não muda: o voo de uma categoria do rodízio troca de instrutor com um voo da
// mesma categoria (cada instrutor continua com os mesmos voos da categoria), e só passa para um instrutor sem voo no
// horário quando ele é do “Priorizar com” do aluno (como na fila, onde o “Priorizar com” vem antes da vez no rodízio);
// nenhum voo tira o instrutor de um voo do rodízio sem pôr nele outro da mesma categoria. Devolve se algum voo mudou
function parearNoHorario(out, state, { limites, historico, frota, act }) {
  const alunos = new Map(state.stu.map(s => [s.id, s]));
  const porId = new Map(state.ins.map(x => [x.id, x]));
  const pedidoDe = pedidosDosVoos(state.stu);
  const lugarNaFila = new Map(act.map((item, i) => [chaveDoVoo(item.stuId, item.mid), i]));
  const status = o => statusDoVoo(o, state.fStatus);
  const ativo = o => status(o) !== 'Cancelado';
  const paresDe = o => ((alunos.get(o.stuId) || {}).voaCom || []).filter(id => porId.has(id));
  const movel = o => !o.fixo && !o.trecho && !o.isGround && !o.insEscolhido && ativo(o) && !STATUS_EM_ANDAMENTO.includes(status(o))
    && alunos.has(o.stuId) && Boolean(pedidoDe(o)) && (!o.limKg || o.insKg > 0);
  // Os compromissos do instrutor no dia (as unidades dele, a turma de Ground uma vez; a cancelada não ocupa), sem o voo que
  // sai dele
  const compromissosDe = (id, sai) => {
    const unidades = new Map();
    for (const v of out) {
      if (v.insId !== id || v === sai) continue;
      const chave = unidadeDoVoo(v);
      (unidades.get(chave) || unidades.set(chave, []).get(chave)).push(v);
    }
    return [...unidades.values()].filter(voos => voos.some(ativo)).map(voos => {
      const v = voos.find(ativo);
      const e = intervaloEfetivo(v, status(v), (state.fObs || {})[v.fKey]);
      return compromissoDoVoo(v, e.a, e.b);
    });
  };
  // O instrutor x serve ao voo o, quando o voo sai (o que está com x no horário, que também troca de instrutor)
  const serve = (o, x, sai) => {
    const s = alunos.get(o.stuId);
    if (o.limKg && !x.kg) return false;
    return !problemasDoInstrutor(x, { mis: o.mis, tipo: o.eqType, a: o.a, b: o.b, alunos: [s], stuKg: s.kg, curso: s.curso, recurso: recursoDaFrota(frota, o.r), exige: pedidoDe(o).exige },
      { compromissos: compromissosDe(x.id, sai), historico: historico(x.id), limites, peso: { reducaoMaxima: o.comb ? o.comb.reduzirGal : 0, exigirPesoDoInstrutor: true } }).length;
  };
  // Para quem o voo pode passar: o aluno sem o instrutor dele e quem está com um, só para os do “Priorizar com”; os outros,
  // para qualquer um do cadastro
  const destinos = (o, b) => (o === b || paresDe(o).includes(o.insId) ? paresDe(o) : state.ins.map(x => x.id))
    .filter(id => id !== o.insId);
  // O voo o passar para o instrutor id, que está com o voo dono no horário (ou com nenhum), mexe no rodízio: tira um voo do
  // rodízio do instrutor sem pôr outro da mesma categoria, ou põe um voo do rodízio num instrutor no lugar de outro de
  // outra categoria (a não ser que o instrutor seja do “Priorizar com” do aluno)
  const categoria = o => categoriaDoRodizio(o.mis, o.eqType);
  const mexeNoRodizio = (o, id, dono) => (dono && categoria(dono) && categoria(dono) !== categoria(o))
    || (categoria(o) && !paresDe(o).includes(id) && (!dono || categoria(dono) !== categoria(o)));
  const caminho = b => {
    const doHorario = out.filter(v => v.a === b.a && movel(v));
    const comO = id => doHorario.find(v => v.insId === id) || null;
    const visto = new Set();
    const fila = [{ o: b, passos: [] }];
    while (fila.length) {
      const { o, passos } = fila.shift();
      for (const id of destinos(o, b)) {
        if (visto.has(id)) continue;
        const dono = comO(id);
        if (mexeNoRodizio(o, id, dono) || !serve(o, porId.get(id), dono)) continue;
        visto.add(id);
        const ate = [...passos, [o, porId.get(id)]];
        // Termina num instrutor sem voo no horário ou no que o aluno deixou
        if (!dono || dono === b) return ate;
        fila.push({ o: dono, passos: ate });
      }
    }
    return null;
  };
  const trocar = (o, x) => {
    o.insId = x.id;
    o.ins = x.nm;
    o.insKg = x.kg || 0;
    o.kg = o.stuKg && x.kg ? o.stuKg + x.kg : 0;
    delete o.comb;
    Object.assign(o, combustivelDoVoo(o.stuKg, x.kg, o.eqType, o.b - o.a, o.mis));
    if (paresDe(o).includes(x.id)) o.insPar = true;
  };
  let mudou = false;
  const semOPar = out.filter(o => movel(o) && paresDe(o).length && !paresDe(o).includes(o.insId))
    .sort((p, q) => (lugarNaFila.get(p.fKey) ?? Infinity) - (lugarNaFila.get(q.fKey) ?? Infinity));
  for (const b of semOPar) {
    // Um caminho de antes pode ter passado o voo para um instrutor dele
    if (paresDe(b).includes(b.insId)) continue;
    const passos = caminho(b);
    if (!passos) continue;
    passos.forEach(([o, x]) => trocar(o, x));
    mudou = true;
  }
  return mudou;
}

// opcoes.compactar: false monta a escala sem a compactação; opcoes.dividirHoras: false, sem a divisão igual das horas;
// opcoes.trocarMatriculas: false, sem a troca de matrículas para o instrutor ficar no mesmo avião; opcoes.parearNoHorario:
// false, sem o pareamento do “Priorizar com” no horário; opcoes.antesDoF1h: true, o motor de antes do F1h (na fila, o aluno
// com “Priorizar com” antes da ordem dos agendamentos, sem o pareamento, sem a lista de espera e com os avisos do “Priorizar
// com” de antes: o motor que gravou test/fixtures/conferencia-do-motor.json) (para comparar, medir e testar)
// O trecho do motivo do avião ocupado ('avioes-ocupados') que fala da prioridade dos pedidos (no fim do motivo, ou antes do
// lugar na lista de espera: "; 1º na lista de espera das 08:20", F1h)
const PELA_PRIORIDADE = ' (ocupados por pedidos de prioridade maior)';
// O que fala da prioridade, por código: o trecho do avião ocupado e, na disputa do “Priorizar com” ('voa-com', F1h), por que
// o outro ficou com o instrutor ("ficou com Aluno B (prioridade maior); ...", js/conferencia.js, porQueFicou)
const DA_PRIORIDADE = {
  'avioes-ocupados': / \(ocupados por pedidos de prioridade maior\)(?=[.;])/,
  'voa-com': / \(prioridade maior\)(?=[.;])/
};
// O resultado com os motivos sem falar da prioridade: o que a tela mostra com a prioridade desligada
// (js/funcionalidades.js; js/state.js, comOsMotivosDaTela), em que todos os pedidos têm a mesma. Não muda o resultado: os
// outros alertas continuam os mesmos objetos, e, sem nenhum, devolve o próprio resultado
export function semAPrioridadeNosMotivos(resultado) {
  const comAPrioridade = a => Object.hasOwn(DA_PRIORIDADE, a.codigo) && typeof a.m === 'string' && DA_PRIORIDADE[a.codigo].test(a.m);
  if (!resultado.al.some(comAPrioridade)) return resultado;
  return { ...resultado, al: resultado.al.map(a => (comAPrioridade(a) ? { ...a, m: a.m.replace(DA_PRIORIDADE[a.codigo], '') } : a)) };
}

export function runAllocationEngine(state, opcoes = {}) {
  const antesDoF1h = opcoes.antesDoF1h === true;
  // O que a escala gasta enquanto é montada e o que o estado diz de fixo (js/conferencia.js)
  const ctx = contextoDaEscala(state);
  const { frota, soParafuso, nomesSoParafuso, serveAoVoo, horarios, fechamentos, posicao, limites, historico, fimDoAluno, filas, saldo, fixos, chaveFixa } = ctx;
  const out = [], al = [];
  // A fila dos pedidos, na ordem do motor (js/conferencia.js)
  const act = filaDosPedidos(state, ctx, { antesDoF1h });
  const free = (mp, id, s, e) => livre(mp[id], s, e);
  // Os voos que ficaram sem o instrutor do “Priorizar com” do aluno (fKey → o aviso, que sai no fim)
  const semPar = new Map();
  // A volta do noturno de ontem e os voos fixos, conferidos de novo com as regras do motor (js/conferencia.js): os fixos
  // entram primeiro, no lugar deles, e o resto é encaixado em volta
  conferirFixos(state, ctx, act, out, al);

  // Encaixa o pedido da fila (item) na escala, com o que ela gasta (c: o contexto do motor, na fila; ou o da escala já
  // montada, para a lista de espera): a linha vai para out e o semPar; os avisos e a recusa, para alertas
  const encaixar = (item, c, alertas) => {
    const { used, stuBusy, stuLastPick, load, eu, compromissos, insAircraft, openGroundClasses, stuGroundStatus, voosNaCategoria, locaisNoHorario } = c;
    const { stu, stuId, mid, ref: d, stuOrder } = item;
    const m = MIS[d.mis] || MIS['Voo Local'];
    const nm = stu.nm;
    const labelStu = mid ? `${nm} (${d.mis})` : nm;
    const isGnd = Boolean(m.isGround);
    // Disponibilidade do aluno: o voo (ou o Ground) só começa nesses horários (por período ou num horário exato)
    const permitidas = disponibilidadeDoAluno(d.jan);
    const naDisponibilidade = minuto => !permitidas || permitidas(minuto);
    // Preferências em minutos (o número da janela dos dados antigos vale como o horário dela)
    const preferidos = [minutoDaPreferencia(d.p1), minutoDaPreferencia(d.p2)];

    // O instrutor escolhido pelo operador para o pedido: o motor procura o horário e o avião só com ele. O que impede o
    // voo em qualquer horário (fora do dia, sem a habilitação, em "Não escalar com") recusa logo. O escolhido que saiu
    // do cadastro (excluído depois de escolhido, numa data que não estava aberta) não vale mais: a exclusão também é do
    // operador, e o pedido volta para o Automático (com o “Priorizar com” do aluno), com o aviso no fim
    const escolhido = d.insId ? state.ins.find(x => x.id === d.insId) || null : null;
    const tipoDoPedido = isGnd ? GROUND_EQ_TYPE : d.eq;
    const quem = escolhido ? `o instrutor escolhido (${escolhido.nm})` : '';
    const impedimento = !escolhido ? null
      : !escolhido.on ? `${quem} não está disponível nesta data`
        : !podeFazer(escolhido, d.mis, tipoDoPedido, { curso: stu.curso, exige: d.exige }) ? `${quem} não tem a habilitação de ${d.mis}${isGnd ? '' : ` no ${d.eq}`} (${descreverExigencias(d.mis, tipoDoPedido, { curso: stu.curso, exige: d.exige })})`
          : (stu.bl || []).includes(escolhido.id) ? `${quem} está em “Não escalar com” deste aluno` : null;
    if (impedimento) {
      alertas.push({ t: 'err', s: labelStu, m: `Rejeitado: ${impedimento}.`, codigo: 'instrutor-escolhido' });
      return;
    }
    // As passadas da busca do instrutor: só o escolhido; ou primeiro os do “Priorizar com” do aluno (o par permanente, do
    // cadastro) em todos os horários e, sem nenhum deles, todos os instrutores, com o aviso; ou todos
    const doPar = escolhido ? [] : (stu.voaCom || []).map(id => state.ins.find(x => x.id === id)).filter(Boolean);
    const passadas = escolhido ? [{ pool: [escolhido], marca: { insEscolhido: true } }]
      : doPar.length ? [{ pool: doPar, marca: { insPar: true } }, { pool: state.ins, marca: {}, semPar: true }]
        : [{ pool: state.ins, marca: {} }];
    // O voo que ficou sem o instrutor do “Priorizar com”: o motivo vem da passada só com eles (fc: as contagens dela). O aviso
    // sai no fim, com o instrutor que ficou com o voo depois da divisão das horas e da compactação
    const anotarSemPar = fc => semPar.set(chaveDoVoo(stuId, mid), { s: labelStu, nomes: doPar.map(i => i.nm).join(', '), motivo: motivoSemPar(doPar, stu, d, tipoDoPedido, fc), pares: doPar.map(i => i.id) });

    // ========================================================================
    // RAMO A: ALOCAÇÃO DE GROUND SCHOOL (01h30 = 90 MIN · TURMA COLETIVA)
    // ========================================================================
    if (isGnd) {
      // A missão do curso do pedido pode exigir mais do INVA (exige): a turma aberta também precisa servir a ele
      const habilitado = x => podeFazer(x, d.mis, GROUND_EQ_TYPE, { exige: d.exige });
      const exigeMais = Array.isArray(d.exige) && d.exige.length > 0;
      const durMin = GROUND_DURATION_MIN; // 90 min (1.5 h)
      const endMax = fimDoAluno(stuId, d.mis, GROUND_EQ_TYPE);
      // Os horários de decolagem da Sala Ground (Recursos; sem a lista dela, os oito horários padrão), em minutos. Com a
      // sala indisponível na data (S4), nenhum: nenhuma aula entra, e o voo que depende dela espera (ground-pendente)
      const salaLivre = salaDisponivel(state.av);
      const starts = !salaLivre ? [] : horariosDoTipo(horarios, GROUND_EQ_TYPE).filter(m => horarioAberto(fechamentos, m, 'ground') && m + durMin <= endMax && naDisponibilidade(m));

      // Se o aluno também tem um voo dependente hoje com horário preferido, prioriza janelas que terminem antes do voo
      const dependentFlights = act.filter(other => other.stuId === stuId && doesGroundGateFlight(d.mis, other.ref));
      // O voo dependente que já está fixo é um prazo: o Ground termina antes dele
      const prazoFixo = Math.min(Infinity, ...out.filter(o => o.stuId === stuId && o.fixo && !o.isGround && !o.trecho && o.status !== 'Cancelado'
        && doesGroundGateFlight(d.mis, { mis: o.mis, eq: o.eqType })).map(o => o.a));
      const earliestFlightPrefMin = Math.min(prazoFixo, dependentFlights.reduce((minT, flt) => {
        const fp1 = minutoDaPreferencia(flt.ref.p1);
        return (fp1 >= 0 && fp1 < minT) ? fp1 : minT;
      }, Infinity));

      // A 1ª e a 2ª preferência, depois os outros horários pela distância da 1ª
      const semPrazo = ordenarPelaPreferencia(starts, preferidos[0], preferidos[1]);
      const candidatos = semPrazo.filter(m => m + durMin <= prazoFixo);
      // Prioriza os horários que terminam antes do voo preferido do aluno, mantendo a cascata Pref.1 -> Pref.2 -> Próximo livre
      candidatos.sort((m1, m2) => {
        const ok1 = m1 + durMin <= earliestFlightPrefMin ? 0 : 1;
        const ok2 = m2 + durMin <= earliestFlightPrefMin ? 0 : 1;
        return ok1 - ok2;
      });

      const existingClasses = salaLivre ? openGroundClasses[d.mis] || [] : [];
      let chosenClass = null, fcGnd, fcDoPar = null, passadaUsada = null;
      for (const passada of passadas) {
        const naPassada = x => passada.pool.includes(x);

        // 1ª Tentativa: Unir-se a uma turma já aberta da mesma temática de Ground (mesmo horário e mesmo instrutor)
        // A turma da 1ª preferência, depois a da 2ª, depois as outras (pelo horário: a turma fixa fora dos horários da
        // Sala Ground não vale como a preferência que o aluno não tem)
        const ordemDaPreferencia = c => { const i = preferidos.indexOf(c.a); return i < 0 ? 2 : i; };
        const orderedExisting = [...existingClasses].filter(c => c.b <= prazoFixo && c.b <= endMax).sort((c1, c2) => {
          const inPref1 = ordemDaPreferencia(c1);
          const inPref2 = ordemDaPreferencia(c2);
          if (inPref1 !== inPref2) return inPref1 - inPref2;
          const okFlt1 = c1.b <= earliestFlightPrefMin ? 0 : 1;
          const okFlt2 = c2.b <= earliestFlightPrefMin ? 0 : 1;
          return okFlt1 - okFlt2;
        });

        for (const cls of orderedExisting) {
          // A turma precisa começar na disponibilidade do aluno (manhã, tarde ou um horário exato)
          if (!naDisponibilidade(cls.a)) continue;
          if (!free(stuBusy, stuId, cls.a, cls.b)) continue;
          if (stu.bl.includes(cls.x.id)) continue;
          if (!naPassada(cls.x)) continue;
          if (exigeMais && !habilitado(cls.x)) continue;
          if (cls.b > earliestFlightPrefMin && candidatos.some(m => m + durMin <= earliestFlightPrefMin)) continue;
          chosenClass = cls;
          break;
        }

        // 2ª Tentativa: Abrir nova turma de Ground se não pôde ingressar em turma existente
        fcGnd = { stu_busy: 0, sala: 0, disp: 0, busy: 0, bloq: 0, limite: 0 };
        if (!chosenClass) {
          // Verifica restrições de bloqueio de todos os alunos da mesma turma potencial para escolher um instrutor comum
          const cohortBlocked = new Set(stu.bl);
          act.forEach(other => {
            if (other.ref.mis === d.mis) other.stu.bl.forEach(bId => cohortBlocked.add(bId));
          });

          for (const a of candidatos) {
            // A chave e o w da turma: o tempo de antes em que ela começa (os goldens e os dados gravados os guardam)
            const b = a + durMin, w = periodoDoMinuto(a);
            if (!free(stuBusy, stuId, a, b)) { fcGnd.stu_busy++; continue; }

            // A turma aberta que começa no mesmo minuto
            const sameWinCls = existingClasses.find(c => c.a === a && !stu.bl.includes(c.x.id) && naPassada(c.x) && (!exigeMais || habilitado(c.x)));
            if (sameWinCls) {
              chosenClass = sameWinCls;
              break;
            }

            // Há uma única sala de Ground: só abre turma nova com a sala livre durante toda a 01h30
            if (!free(used, GROUND_REG, a, b)) { fcGnd.sala++; continue; }

            const { servem: f2, barrou } = instrutoresQueServem(passada.pool, x => problemasDoInstrutor(x, { mis: d.mis, tipo: GROUND_EQ_TYPE, a, b, alunos: [stu], exige: d.exige },
              { compromissos: compromissos[x.id] || [], historico: historico(x.id), limites }));
            if (barrou) { fcGnd[barrou]++; continue; }

            // Ordena instrutores priorizando: não bloqueado pela turma -> MENOS HABILITAÇÕES -> menor carga no dia
            f2.sort((x1, x2) =>
              (cohortBlocked.has(x1.id) - cohortBlocked.has(x2.id)) ||
              (qtdHabilitacoes(x1) - qtdHabilitacoes(x2)) ||
              ((load[x1.id] || 0) - (load[x2.id] || 0))
            );

            const pickedIns = f2[0];
            // A chave da turma não repete a de outra (uma turma fixa passada para outro horário guarda a chave de antes)
            const usadas = new Set([...out.map(o => o.classKey), ...Object.values(fixos).map(p => p.classKey).filter(Boolean)]);
            const base = `GND_${d.mis}_${w}_${pickedIns.id}`;
            let classKey = base;
            for (let n = 2; usadas.has(classKey); n++) classKey = `${base}_${n}`;
            chosenClass = { classKey, mis: d.mis, w, a, b, x: pickedIns, count: 0 };
            (openGroundClasses[d.mis] = openGroundClasses[d.mis] || []).push(chosenClass);

            // Marca o instrutor e a sala ocupados neste intervalo (outros alunos do MESMO Ground entram via chosenClass)
            (compromissos[pickedIns.id] ||= []).push({ a, b, voo: false });
            (used[GROUND_REG] = used[GROUND_REG] || []).push([a, b]);
            load[pickedIns.id] = (load[pickedIns.id] || 0) + GROUND_DURATION_H;
            eu[GROUND_REG] = (eu[GROUND_REG] || 0) + GROUND_DURATION_H;
            break;
          }
        }
        if (chosenClass) { passadaUsada = passada; break; }
        if (!passada.semPar) fcDoPar = fcGnd;
      }

      if (chosenClass) {
        chosenClass.count++;
        (stuBusy[stuId] = stuBusy[stuId] || []).push([chosenClass.a, chosenClass.b]);

        // Registra que o aluno concluiu este Ground às chosenClass.b (liberando voos a partir de chosenClass.b)
        const stGnds = stuGroundStatus[stuId] || [];
        const gRec = stGnds.find(g => g.mis === d.mis && g.allocatedEnd === null) || stGnds.find(g => g.mis === d.mis);
        if (gRec) gRec.allocatedEnd = chosenClass.b;

        const fKey = chaveDoVoo(stuId, mid);
        const baseTag = chosenClass.a === preferidos[0] ? 'Pref. 1' : chosenClass.a === preferidos[1] ? 'Pref. 2' : 'Próximo livre';

        out.push({
          fKey,
          classKey: chosenClass.classKey,
          isGround: true,
          // A turma sempre guarda o tempo de antes em que começa; a fixa sem ele (gravada assim) fica no período em que começa
          w: chosenClass.w >= 0 ? chosenClass.w : periodoDoMinuto(chosenClass.a), a: chosenClass.a, b: chosenClass.b,
          o: stuOrder,
          stuId,
          mid,
          insId: chosenClass.x.id,
          eqType: GROUND_EQ_TYPE,
          s: nm, mis: d.mis, h: GROUND_DURATION_H, ss: '1/1',
          // A missão do curso
          ...(d.etapa ? { etapa: d.etapa } : {}),
          r: GROUND_REG, ins: chosenClass.x.nm,
          stuKg: stu.kg || 0,
          insKg: chosenClass.x.kg || 0,
          limKg: 0,
          kg: 0,
          baseTag,
          tag: baseTag,
          status: statusDoVoo({ fKey }, state.fStatus),
          ...passadaUsada.marca
        });
        if (passadaUsada.semPar) anotarSemPar(fcDoPar);
      } else {
        // O motivo, com o código que diz onde resolver
        let codigo, why;
        if (!salaLivre) {
          [codigo, why] = ['sala-indisponivel', 'a Sala Ground está indisponível nesta data'];
        } else if (!state.ins.some(x => x.on && habilitado(x))) {
          [codigo, why] = ['sem-instrutor-habilitado', `nenhum instrutor ativo tem a habilitação de ${d.mis} (${descreverExigencias(d.mis, GROUND_EQ_TYPE, { exige: d.exige })})`];
        } else if (semPrazo.length && !candidatos.length) {
          [codigo, why] = ['ground-antes-do-voo-fixo', `o Ground precisa terminar antes do voo fixo das ${hm(prazoFixo)}, e não há horário para ele antes disso`];
        } else if (!starts.length) {
          [codigo, why] = permitidas
            ? ['disponibilidade-do-aluno', `nenhum horário aberto na disponibilidade do aluno (${rotuloDaDisponibilidade(d.jan)}) comporta 01h30 de Ground`]
            : ['sem-horario', `nenhum horário aberto comporta 01h30 de Ground${endMax < MINUTOS_DO_DIA ? ` até as ${hm(endMax)}` : ''}`];
        } else {
          const key = Object.keys(fcGnd).sort((a, b) => fcGnd[b] - fcGnd[a])[0];
          [codigo, why] = {
            stu_busy: ['aluno-ocupado', 'o aluno já tem outra missão nos horários possíveis'],
            sala: ['sala-ocupada', 'a sala de Ground já está ocupada por outra turma nos horários possíveis'],
            disp: ['instrutores-indisponiveis', escolhido ? `${quem} não está disponível durante as 01h30 nos horários possíveis` : 'nenhum instrutor habilitado está disponível durante as 01h30 nos horários possíveis'],
            busy: ['instrutores-ocupados', escolhido ? `${quem} já tem outro compromisso nos horários possíveis` : 'os instrutores habilitados já têm outro compromisso nos horários possíveis'],
            bloq: ['bloqueio', 'os instrutores habilitados e livres estão em “Não escalar com” deste aluno'],
            limite: ['limite-da-lei', escolhido ? `${quem} passaria dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários possíveis` : 'nenhum instrutor dentro dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários possíveis']
          }[key];
        }
        alertas.push({ t: 'err', s: labelStu, m: `Rejeitado: ${why}.`, codigo });
      }
      return;
    }

    // ========================================================================
    // RAMO B: ALOCAÇÃO DE MISSÕES DE VOO E SIMULADOR
    // ========================================================================
    const lim = DEFAULT_LIM[d.eq] || 0;
    // Um voo por pedido, com as horas pedidas (para dividir no dia, "+ missão")
    const H = duracaoFixaDaMissao(d.mis) || duracaoValida(d.nb);
    const night = d.mis === 'Noturno';
    const isParafuso = d.mis === 'Parafuso';
    const local = MISSOES_LOCAIS.includes(d.mis);
    // O 7º voo local confirmado passa do limite só no minuto do pedido (Q8)
    const confirmadoEm = minutoConfirmado(d);
    const exige = descreverExigencias(d.mis, d.eq, { curso: stu.curso, exige: d.exige });
    // Voo de categoria do rodízio: primeiro quem ainda não voou nela hoje, depois a ordem da fila
    const categoria = categoriaDoRodizio(d.mis, d.eq);
    const voosHoje = x => (categoria ? voosNaCategoria[`${categoria}:${x.id}`] || 0 : 0);
    const naFila = x => { const i = categoria ? filas[categoria].indexOf(x.id) : 0; return i < 0 ? Number.MAX_SAFE_INTEGER : i; };

    // 1. Validação de equipamento permitido para a missão
    if (!m.eq.includes(d.eq)) {
      alertas.push({
        t: 'err',
        s: labelStu,
        m: `Rejeitado: a missão “${d.mis}” só voa em ${m.eq.join(' ou ')} (o pedido está no ${d.eq}).`,
        codigo: 'equipamento-da-missao'
      });
      return;
    }

    // 2. Validação de Precedência de Ground School (Ground deve ocorrer antes do 1º voo da temática)
    const gatingGrounds = (stuGroundStatus[stuId] || []).filter(g => doesGroundGateFlight(g.mis, d));
    const unallocatedGround = gatingGrounds.find(g => g.allocatedEnd === null);
    if (unallocatedGround) {
      alertas.push({
        t: 'err',
        s: labelStu,
        m: `Rejeitado: o “${unallocatedGround.mis}” de hoje, que vem antes deste voo, não entrou na escala.`,
        codigo: 'ground-pendente'
      });
      return;
    }
    const minStartAfterGround = gatingGrounds.reduce((maxEnd, g) => Math.max(maxEnd, g.allocatedEnd || 0), 0);

    // Os horários de decolagem da categoria (o noturno, às 17:30), abertos nesta data e na disponibilidade do aluno
    const categoriaDoPedido = categoriaDoTipo(d.eq);
    const starts = horariosDaMissao(horarios, d.mis, d.eq).filter(m => horarioAberto(fechamentos, m, categoriaDoPedido) && naDisponibilidade(m));
    const endMax = fimDoAluno(stuId, d.mis, d.eq);
    const dur = Math.round(H * 60);
    // Os horários possíveis: a 1ª e a 2ª preferência, depois os outros pela distância da 1ª; w é o período (a janela de
    // operação em que o voo começa), para agrupar a escala
    const pf = preferidos;
    const inicios = ordenarPelaPreferencia(starts, pf[0], pf[1])
      .filter(m => m >= minStartAfterGround && m + dur <= endMax)
      .map(m => ({ w: periodoDoMinuto(m), a: m, b: m + dur }));

    // Os aviões que servem ao voo (js/frota.js): o tipo, o "Só Parafuso" (o Parafuso no C152 só nele, e ele só no
    // Parafuso) e o "Só VFR" (o voo IFR, inclusive o noturno do PC, só no avião homologado IFR)
    const vooDoPedido = { mis: d.mis, eq: d.eq, curso: stu.curso };
    const fleetPool = matriculasParaOVoo(frota, vooDoPedido);
    // O instrutor voa no avião: o avião com habilitação própria (o PR-VOM) exige a dele
    const voaNo = (x, r) => instrutorVoaNoAviao(x, recursoDaFrota(frota, r));

    // Duas tentativas: com o tanque cheio em todos os horários; só se nenhum par couber assim, com menos combustível
    // (o par que precisa reduzir menos vem antes)
    let fc, ch = null, fcDoPar = null, passadaUsada = null;
    const reducao = x => reducaoNecessaria({ stuKg: stu.kg, insKg: x.kg, tipo: d.eq, minutos: dur, mis: d.mis });
    const prev = stuLastPick[stuId] || null;
    for (const passada of passadas) {
      for (const comMenosCombustivel of [false, true]) {
        fc = { locais: 0, stu_busy: 0, eq: 0, revisao: 0, disp: 0, busy: 0, bloq: 0, limite: 0, peso: 0, aviaoProprio: 0 };
        if (comMenosCombustivel && !lim) break;
        for (const p of inicios) {
          // No máximo 6 voos locais saindo no mesmo horário (o confirmado, no minuto dele, passa)
          if (local && p.a !== confirmadoEm && (locaisNoHorario[p.a] || 0) >= LIMITE_DE_VOOS_LOCAIS) { fc.locais++; continue; }
          if (!free(stuBusy, stuId, p.a, p.b)) { fc.stu_busy++; continue; }

          const livres = fleetPool.filter(r => state.av[r] && free(used, r, p.a, p.b));
          if (!livres.length) { fc.eq++; continue; }
          const eqs = livres.filter(r => cabeNoSaldo(eu[r] || 0, dur / 60, saldo(r)));
          if (!eqs.length) { fc.revisao++; continue; }

          // Na primeira tentativa, só com o tanque cheio
          const { servem: habilitados, barrou } = instrutoresQueServem(passada.pool, x => problemasDoInstrutor(x, { mis: d.mis, tipo: d.eq, a: p.a, b: p.b, alunos: [stu], stuKg: stu.kg, curso: stu.curso, exige: d.exige },
            { compromissos: compromissos[x.id] || [], historico: historico(x.id), limites, peso: { reducaoMaxima: comMenosCombustivel ? Infinity : 0 } }));
          if (barrou) { fc[barrou]++; continue; }
          // O par instrutor e avião: só quem voa em algum dos aviões livres (o avião com habilitação própria exige a dele)
          const ins = habilitados.filter(x => eqs.some(r => voaNo(x, r)));
          if (!ins.length) { fc.aviaoProprio++; continue; }

          // Quando o peso importa (o avião tem limite e o aluno, o peso), o instrutor com o peso informado vem antes: sem
          // ele, o limite não é conferido
          const pesoImporta = Boolean(lim && stu.kg);
          ins.sort((a, b) => (comMenosCombustivel && reducao(a) - reducao(b)) || (pesoImporta && !a.kg - !b.kg) || (prev && (a.id === prev.x.id) - (b.id === prev.x.id)) ||
            voosHoje(a) - voosHoje(b) || naFila(a) - naFila(b) ||
            qtdHabilitacoes(a) - qtdHabilitacoes(b) || (load[a.id] || 0) - (load[b.id] || 0));

          // O instrutor fica no mesmo avião durante o dia: primeiro o avião que ele já usou hoje, depois o rodízio do aluno
          // (evita o avião anterior dele); então um avião que já saiu, com a menor folga até o voo (fecha os buracos do dia),
          // e por último o primeiro do hangar
          const x = ins[0];
          const ordemNoInstrutor = r => { const i = (insAircraft[x.id] || []).indexOf(r); return i < 0 ? Infinity : i; };
          const doInstrutor = eqs.filter(r => voaNo(x, r));
          doInstrutor.sort((a, b) => menorPrimeiro(ordemNoInstrutor(a), ordemNoInstrutor(b)) || (prev && (a === prev.r) - (b === prev.r)) ||
            menorPrimeiro(folgaAte(used[a] || [], p.a, p.b), folgaAte(used[b] || [], p.a, p.b)) || posicao(a) - posicao(b));

          ch = { p, r: doInstrutor[0], x };
          break;
        }
        if (ch || !fc.peso) break;
      }
      if (ch) { passadaUsada = passada; break; }
      if (!passada.semPar) fcDoPar = fc;
    }

    if (ch) {
      const { p, r, x } = ch, hh = dur / 60;
      (used[r] = used[r] || []).push([p.a, p.b]);
      (compromissos[x.id] ||= []).push({ a: p.a, b: p.b, voo: AIRCRAFT_EQ_TYPES.includes(d.eq) });
      (stuBusy[stuId] = stuBusy[stuId] || []).push([p.a, p.b]);
      stuLastPick[stuId] = { r, x };
      const avioesDoInstrutor = (insAircraft[x.id] = insAircraft[x.id] || []);
      if (!avioesDoInstrutor.includes(r)) avioesDoInstrutor.push(r);

      const fKey = chaveDoVoo(stuId, mid);
      const baseTag = p.a === pf[0] ? 'Pref. 1' : p.a === pf[1] ? 'Pref. 2' : 'Próximo livre';
      out.push({
        fKey,
        classKey: fKey,
        isGround: false,
        w: p.w, a: p.a, b: p.b,
        o: stuOrder,
        stuId,
        mid,
        insId: x.id,
        eqType: d.eq,
        s: nm, mis: d.mis, h: hh, ss: '1/1',
        ...(d.etapa ? { etapa: d.etapa } : {}),
        r, ins: x.nm,
        stuKg: stu.kg || 0,
        insKg: x.kg || 0,
        limKg: lim,
        kg: stu.kg && x.kg ? stu.kg + x.kg : 0,
        ...combustivelDoVoo(stu.kg, x.kg, d.eq, dur, d.mis),
        baseTag,
        tag: baseTag,
        status: statusDoVoo({ fKey }, state.fStatus),
        ...passadaUsada.marca
      });
      if (passadaUsada.semPar) anotarSemPar(fcDoPar);

      eu[r] = (eu[r] || 0) + hh;
      if (local && p.a !== confirmadoEm) locaisNoHorario[p.a] = (locaisNoHorario[p.a] || 0) + 1;
      load[x.id] = (load[x.id] || 0) + hh;
      if (categoria) voosNaCategoria[`${categoria}:${x.id}`] = voosHoje(x) + 1;

      if (lim && (!stu.kg || !x.kg)) {
        // O aviso diz de quem é o peso que falta
        const quem = !stu.kg && !x.kg ? `Pesos do aluno e de ${x.nm} não informados` : !stu.kg ? 'Peso do aluno não informado' : `Peso de ${x.nm} não informado`;
        alertas.push({ t: 'warn', s: labelStu, m: `${quem} (0 kg): verificação de limite (${lim} kg) no ${d.eq} não realizada.`, codigo: 'sem-peso', ...(stu.kg ? {} : { stuId }), ...(x.kg ? {} : { insId: x.id }) });
      }
    } else {
      // O motivo, com o código que diz onde resolver
      let codigo, why;
      if (isParafuso && d.eq === 'C152' && !soParafuso.some(r => state.av[r])) {
        [codigo, why] = ['so-parafuso', soParafuso.length
          ? `o ${nomesSoParafuso} (só para Parafuso no C152) está em manutenção`
          : 'não há na frota um C152 marcado como “Só Parafuso” (em Recursos)'];
      } else if (frota.some(f => f.tipo === d.eq && state.av[f.reg] && motivoDoAviao(f, vooDoPedido) === 'so-vfr') && !fleetPool.some(r => state.av[r])) {
        [codigo, why] = ['sem-aviao', `nenhum ${d.eq} homologado IFR disponível (o voo é IFR; os disponíveis são “Só VFR”)`];
      } else if (!fleetPool.some(r => state.av[r])) {
        [codigo, why] = ['sem-aviao', `nenhum ${d.eq} disponível (todos em manutenção)`];
      } else if (!state.ins.some(x => x.on && podeFazer(x, d.mis, d.eq, { curso: stu.curso, exige: d.exige }))) {
        [codigo, why] = ['sem-instrutor-habilitado', `nenhum instrutor ativo tem a habilitação de ${d.mis} no ${d.eq} (${exige})`];
      } else if (!inicios.length && permitidas) {
        [codigo, why] = ['disponibilidade-do-aluno', `nenhum horário aberto na disponibilidade do aluno (${rotuloDaDisponibilidade(d.jan)}) comporta ${fmtH(H)}`];
      } else if (!inicios.length) {
        [codigo, why] = minStartAfterGround > 0
          ? ['depois-do-ground', `nenhum horário aberto depois do Ground (${hm(minStartAfterGround)}) comporta ${fmtH(H)} até as ${hm(endMax)}`]
          : ['sem-horario', `nenhum horário aberto comporta ${fmtH(H)}${night ? ' a partir das 17:30' : endMax < MINUTOS_DO_DIA ? ` até as ${hm(endMax)}` : ''}`];
      } else {
        const key = Object.keys(fc).sort((a, b) => fc[b] - fc[a])[0];
        [codigo, why] = {
          stu_busy: ['aluno-ocupado', 'o aluno já tem outra missão nos horários possíveis'],
          eq: ['avioes-ocupados', isParafuso && d.eq === 'C152'
            ? `o ${nomesSoParafuso} (só para Parafuso) já está ocupado nos horários possíveis`
            : frota.some(f => f.tipo === d.eq && state.av[f.reg] && motivoDoAviao(f, vooDoPedido) === 'so-vfr')
              ? `nenhum ${d.eq} homologado IFR livre nos horários possíveis (o voo é IFR; os “Só VFR” não servem a ele)`
              : `nenhum ${d.eq} livre nos horários possíveis${PELA_PRIORIDADE}`],
          revisao: ['revisao', `os ${d.eq} livres estão sem saldo até a revisão de 50 horas`],
          disp: ['instrutores-indisponiveis', escolhido ? `${quem} não está disponível durante o voo inteiro nos horários possíveis` : `nenhum instrutor habilitado (${exige}) está disponível durante o voo inteiro nos horários possíveis`],
          busy: ['instrutores-ocupados', escolhido ? `${quem} já tem outro compromisso nos horários possíveis` : `os instrutores habilitados (${exige}) já têm outro compromisso nos horários possíveis`],
          bloq: ['bloqueio', `os instrutores habilitados (${exige}) e livres estão em “Não escalar com” deste aluno`],
          limite: ['limite-da-lei', escolhido ? `${quem} passaria dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários possíveis` : 'nenhum instrutor dentro dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários possíveis'],
          locais: ['limite-de-locais', `já há ${LIMITE_DE_VOOS_LOCAIS} voos locais (Voo Local, Voo Solo e TGL) em todos os horários possíveis, o máximo no mesmo horário`],
          peso: ['peso', `peso aluno + ${escolhido ? quem : 'instrutor'} acima do limite de ${lim} kg do ${d.eq}, mesmo com o mínimo de combustível`],
          aviaoProprio: ['habilitacao-do-aviao', `os ${d.eq} livres exigem a habilitação própria deles, e ${escolhido ? `${quem} não a tem` : 'nenhum instrutor livre a tem'} (marque em Instrutores › Cadastro)`]
        }[key];
      }
      alertas.push({ t: 'err', s: labelStu, m: `Rejeitado: ${why}.`, codigo });
    }
  };

  // A fila: cada pedido sem pino, na ordem do motor. A lista de espera (N14, U3; Pedro, 2026-11-26: “if it is not
  // confirmed we form a waiting list”): o pedido com um horário exato recusado só por falta de lugar nele (os 6 voos
  // locais, os aviões, os instrutores) espera por esse horário, na ordem da fila
  const naEspera = [];
  for (const item of act) {
    if (chaveFixa(item)) continue;
    const antes = al.length;
    encaixar(item, ctx, al);
    const recusa = al.slice(antes).find(a => a.t === 'err');
    const minuto = recusa && !antesDoF1h ? minutoDaEspera(item.ref, recusa) : null;
    if (minuto !== null) naEspera.push({ item, recusa, minuto });
  }

  if (opcoes.dividirHoras !== false) equalizarHoras(out, state, limites, historico);
  // Compactação: a escala compactada vale quando, já com as matrículas trocadas, custa menos pelo critério do
  // dia do que a escala sem compactar (a troca de matrículas mexe no tempo parado dos aviões)
  const compactada = opcoes.compactar === false ? null : out.map(o => ({ ...o }));
  const trocarMatriculas = lista => { if (opcoes.trocarMatriculas !== false) manterInstrutorNoMesmoAviao(lista, state, saldo, frota, posicao, serveAoVoo); };
  if (compactada && compactar(compactada, state, { saldo, posicao, limites, historico })) {
    trocarMatriculas(compactada);
    trocarMatriculas(out);
    if (custoDaEscala(compactada, state) < custoDaEscala(out, state) - 1e-9) out.splice(0, out.length, ...compactada);
  } else {
    trocarMatriculas(out);
  }
  // Depois da compactação, cada pedido da lista de espera tenta de novo o horário dele, na ordem da fila, com o que a escala
  // do fim gasta (o lugar que a compactação liberou vai para ele): encaixado, a recusa sai, e os avisos dele ficam no lugar
  // dela. Os que continuam esperando ficam com o lugar na lista do horário deles (1º, 2º…), na recusa
  if (naEspera.length) {
    const c = contextoDaEscalaMontada(state, out, { antesDoF1h });
    for (const espera of [...naEspera]) {
      const alertas = [];
      encaixar(espera.item, c, alertas);
      if (!out.some(o => o.fKey === chaveDoVoo(espera.item.stuId, espera.item.mid))) continue;
      al.splice(al.indexOf(espera.recusa), 1, ...alertas.filter(a => a.t !== 'err'));
      naEspera.splice(naEspera.indexOf(espera), 1);
    }
  }
  const lugares = {};
  for (const { recusa, minuto } of naEspera) {
    lugares[minuto] = (lugares[minuto] || 0) + 1;
    recusa.m = `${recusa.m.replace(/\.$/, '')}; ${lugares[minuto]}º na lista de espera das ${hm(minuto)}.`;
    recusa.espera = { minuto, lugar: lugares[minuto] };
  }
  // O “Priorizar com” escolhe o instrutor entre os voos de cada horário, sem mudar nenhum horário nem avião (F1h): a troca
  // de matrículas não roda de novo (o avião de cada voo já serve ao instrutor novo: parearNoHorario confere a habilitação
  // própria do avião)
  if (!antesDoF1h && opcoes.parearNoHorario !== false) parearNoHorario(out, state, { limites, historico, frota, act });
  // O voo sem o instrutor do “Priorizar com”: o aviso diz quem ficou com ele (se a divisão das horas, a compactação ou o
  // pareamento no horário o passaram para um instrutor do “Priorizar com”, não há aviso). Com o F1h, os avisos do
  // “Priorizar com” saem de js/conferencia.js (avisosDoPriorizarCom): também as disputas e os voos postos à mão fora dele,
  // um por voo
  for (const o of out) {
    const sem = semPar.get(o.fKey);
    if (!sem) continue;
    if (sem.pares.includes(o.insId)) { o.insPar = true; continue; }
    if (antesDoF1h) al.push({ t: 'warn', s: sem.s, m: `Sem o instrutor de “Priorizar com” (${sem.nomes}: ${sem.motivo}): o voo ficou com ${o.ins}.`, codigo: 'voa-com', stuId: o.stuId, insId: o.insId });
  }
  if (!antesDoF1h) al.push(...avisosDoPriorizarCom(state, out, { semPar }));
  // O que o motor confere depois de montar a escala, sem mover nenhum voo (js/conferencia.js)
  const revisao = concluirEscala(state, ctx, out, al);
  return { out, al, tot: act.length, revisao };
}

// Calcula horas operacionais deduplicando turmas coletivas de Ground School
export function sumUniqueOperationalHours(flights, statusLookupFn) {
  const seenClasses = new Set();
  let total = 0;
  flights.forEach(o => {
    const st = statusLookupFn ? statusLookupFn(o) : statusDoVoo(o);
    if (st === 'Cancelado') return;
    const key = unidadeDoVoo(o) || `${o.w}_${o.a}_${o.b}_${o.mis}_${o.ins}`;
    if (o.isGround || isGroundMission(o.mis)) {
      if (seenClasses.has(key)) return;
      seenClasses.add(key);
    }
    total += (+o.h || 0);
  });
  return Math.round(total * 10) / 10;
}

/**
 * Agrupa voos para o Mapa Visual de Ocupação:
 * - Turmas coletivas de Ground School no mesmo horário/instrutor são consolidadas em uma única barra visual,
 *   evitando sobreposição de barras e contabilizando 1,5 h uma única vez para o instrutor/sala.
 */
export function consolidateTimelineSlots(flights) {
  const slots = [];
  const groundMap = new Map();

  flights.forEach(o => {
    if (o.isGround || isGroundMission(o.mis)) {
      const k = o.classKey || `GND_${o.mis}_${o.w}_${o.ins}`;
      if (!groundMap.has(k)) {
        const clone = { ...o, students: [o.s], items: [o] };
        groundMap.set(k, clone);
        slots.push(clone);
      } else {
        const g = groundMap.get(k);
        g.students.push(o.s);
        g.items.push(o);
      }
    } else {
      slots.push({ ...o, students: [o.s], items: [o] });
    }
  });

  return slots;
}
