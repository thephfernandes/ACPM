// Versões do formato dos dados guardados (cadastro e dias). Cada versão tem um passo que transforma o formato
// anterior no seguinte sem perder nada: campos que o passo não conhece são mantidos. As leituras aplicam os passos
// que faltam, então o app sempre trabalha no formato atual; no primeiro acesso de um operador depois de uma mudança,
// os dados guardados são regravados no formato atual (ApiClient.atualizarFormatoGravado).
// Sem o campo "esquema": formato da fase 3 (versão 4).
import { habilitacoesDoNivel } from './habilitacoes.js';
import { FROTA_INICIAL } from './frota.js';
import { HORARIOS_INICIAIS, minutoDaPreferencia, ajustarPreferencias } from './horarios.js';
import { disponibilidadeAtual } from './rules.js';
import { LIMITES_DA_LEI } from './limites.js';
import { cursosVazios } from './cursos.js';

export const ESQUEMA = 18;

// Um pedido do dia com as preferências em minutos e a disponibilidade no formato atual (formato 12)
function pedidoEmMinutos(pedido) {
  if (!pedido || typeof pedido !== 'object') return pedido;
  const novo = { ...pedido };
  if ('p1' in pedido) novo.p1 = minutoDaPreferencia(pedido.p1);
  if ('p2' in pedido) novo.p2 = minutoDaPreferencia(pedido.p2);
  if ('jan' in pedido) {
    const jan = disponibilidadeAtual(pedido.jan);
    if (jan) novo.jan = jan;
    else delete novo.jan;
  }
  // O PA-34 passa a sair de 30 em 30 minutos: a preferência vai para o horário mais próximo da lista nova
  if (novo.eq === 'PA-34') ajustarPreferencias(novo, HORARIOS_INICIAIS['PA-34']);
  if (Array.isArray(pedido.extra)) novo.extra = pedido.extra.map(pedidoEmMinutos);
  return novo;
}

// Versão 5 (fase 4): simuladores com os nomes usados no aeroclube
const SIMULADORES_RENOMEADOS = { 'SIM-MONO-1': 'SIM-MONO-A', 'SIM-MONO-2': 'SIM-MONO-C', 'SIM-MULTI-1': 'SIM-MLTE-E', 'SIM-MULTI-2': 'SIM-MLTE-D' };
export const renomearSimulador = r => (Object.hasOwn(SIMULADORES_RENOMEADOS, r) ? SIMULADORES_RENOMEADOS[r] : r);

const PASSOS = {
  5: {
    cadastro: cadastro => cadastro,
    dia: dia => {
      const novo = { ...dia };
      if (dia.av && typeof dia.av === 'object') {
        novo.av = Object.fromEntries(Object.entries(dia.av).map(([r, disponivel]) => [renomearSimulador(r), disponivel]));
      }
      if (dia.resultado && Array.isArray(dia.resultado.out)) {
        novo.resultado = { ...dia.resultado, out: dia.resultado.out.map(o => (o && typeof o.r === 'string' ? { ...o, r: renomearSimulador(o.r) } : o)) };
      }
      return novo;
    }
  },
  // Versão 6 (fase 4): habilitações individuais no lugar dos níveis cumulativos A01–A09. Cada instrutor recebe
  // exatamente o que o seu nível permitia; o nível fica no registro só como cópia (não é mais usado)
  6: {
    cadastro: cadastro => (Array.isArray(cadastro.ins)
      ? { ...cadastro, ins: cadastro.ins.map(x => (x && !Array.isArray(x.hab) ? { ...x, hab: habilitacoesDoNivel(x.lv) } : x)) }
      : cadastro),
    dia: dia => dia
  },
  // Versão 7 (fase 4): os dias guardam as horas de cada avião até a revisão de 50 horas (campo "horas"). O passo não
  // muda nada; a versão nova impede que uma aba com a versão anterior do app grave os dias sem esse campo
  7: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 8 (fase 4): os dias guardam as filas do rodízio (campo "filas"), pelo mesmo motivo da versão 7
  8: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 9 (fase 4): os pedidos guardam a disponibilidade do aluno (campo "jan"), pelo mesmo motivo
  9: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 10 (fase 4): os dias guardam as solicitações da agenda já importadas (campo "importadas"), pelo mesmo motivo
  10: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 11 (fase 7): a frota sai do código e vai para o cadastro (matrícula, tipo e "Só Parafuso"). O cadastro
  // que não tem a frota recebe a que estava no código
  11: {
    cadastro: cadastro => {
      if (Array.isArray(cadastro.frota)) return cadastro;
      // A frota entra antes de "esquema", na ordem em que o app grava (o cadastro não é regravado à toa)
      const { esquema, ...resto } = cadastro;
      return { ...resto, frota: FROTA_INICIAL.map(f => ({ ...f })), ...(esquema === undefined ? {} : { esquema }) };
    },
    dia: dia => dia
  },
  // Versão 12 (fase 7): o cadastro guarda os horários de decolagem de cada categoria (o PA-34 sai de 30 em 30
  // minutos); os pedidos guardam as preferências em minutos (antes, o número da janela) e "h5" vira "h820"
  12: {
    cadastro: cadastro => {
      if (cadastro.horarios && typeof cadastro.horarios === 'object') return cadastro;
      const { esquema, ...resto } = cadastro;
      return { ...resto, horarios: structuredClone(HORARIOS_INICIAIS), ...(esquema === undefined ? {} : { esquema }) };
    },
    dia: dia => (dia.pedidos && typeof dia.pedidos === 'object'
      ? { ...dia, pedidos: Object.fromEntries(Object.entries(dia.pedidos).map(([id, pedido]) => [id, pedidoEmMinutos(pedido)])) }
      : dia)
  },
  // Versão 13 (fase 8): os dias guardam o detalhe do status de cada voo (campo "fObs": o motivo do cancelamento e o
  // novo horário do atraso). O passo não muda nada; a versão nova impede que uma aba com a versão anterior do app
  // grave os dias sem esse campo
  13: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 14 (fase 10): os dias guardam a ordem dos aviões no hangar (campo "hangar"), pelo mesmo motivo da versão 13
  14: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 15 (fase 11): o cadastro guarda os limites dos instrutores pela Lei do Aeronauta (os padrões da lei) e cada
  // instrutor pode ter as horas de voo fora do app (horasExternas)
  15: {
    cadastro: cadastro => {
      if (cadastro.limites && typeof cadastro.limites === 'object') return cadastro;
      const { esquema, ...resto } = cadastro;
      return { ...resto, limites: { ...LIMITES_DA_LEI }, ...(esquema === undefined ? {} : { esquema }) };
    },
    dia: dia => dia
  },
  // Versão 16 (fase 12): os dias guardam a escala aprovada (os voos fixos e quem aprovou), pelo mesmo motivo da versão 13
  16: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 17 (fase 13): os dias guardam os critérios da compactação (campo "criterios"), pelo mesmo motivo da versão 13
  17: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 18 (fase 14): o cadastro guarda o programa dos cursos (PP, PC e INVA; começa vazio) e o curso de cada aluno
  18: {
    cadastro: cadastro => {
      if (cadastro.cursos && typeof cadastro.cursos === 'object') return cadastro;
      const { esquema, ...resto } = cadastro;
      return { ...resto, cursos: cursosVazios(), ...(esquema === undefined ? {} : { esquema }) };
    },
    dia: dia => dia
  }
};

const versaoDe = doc => (typeof doc.esquema === 'number' ? doc.esquema : 4);

export const precisaMigrar = doc => Boolean(doc) && typeof doc === 'object' && versaoDe(doc) < ESQUEMA;

function migrar(doc, parte) {
  if (!doc || typeof doc !== 'object') return doc;
  let atual = doc;
  for (let versao = versaoDe(doc) + 1; versao <= ESQUEMA; versao++) atual = { ...PASSOS[versao][parte](atual), esquema: versao };
  return atual;
}

export const migrarCadastro = cadastro => migrar(cadastro, 'cadastro');
export const migrarDia = dia => migrar(dia, 'dia');
