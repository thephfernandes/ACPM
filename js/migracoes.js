// Versões do formato dos dados guardados (cadastro e dias). Cada versão tem um passo que transforma o formato
// anterior no seguinte sem perder nada: campos que o passo não conhece são mantidos. As leituras aplicam os passos
// que faltam, então o app sempre trabalha no formato atual; no primeiro acesso de um operador depois de uma mudança,
// os dados guardados são regravados no formato atual (ApiClient.atualizarFormatoGravado).
// Sem o campo "esquema": versão 4 (o primeiro formato por data).
import { habilitacoesDoNivel, marcasDoChecadorAntigo, habilitacaoDoAviao } from './habilitacoes.js';
import { FROTA_INICIAL } from './frota.js';
import { HORARIOS_INICIAIS, minutoDaPreferencia, ajustarPreferencias } from './horarios.js';
import { disponibilidadeAtual } from './rules.js';
import { LIMITES_DA_LEI } from './limites.js';
import { cursosVazios } from './cursos.js';

export const ESQUEMA = 27;
// O formato dos cursos: o formato do cadastro a partir do qual os programas vivem nas tabelas próprias (antes dele, vale
// o programa guardado no cadastro, que a conversão única traz para as tabelas). O 22 é o do instrutor escolhido e o 23,
// o dos atributos da frota; um aumento é esta linha mais public.formato_dos_cursos() (a migração dos cursos), com o
// passo dele renumerado aqui embaixo
export const FORMATO_DOS_CURSOS = 24;

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
  // Na versão 12 o PA-34 sai de 30 em 30 minutos: a preferência vai para o horário mais próximo da lista nova
  if (novo.eq === 'PA-34') ajustarPreferencias(novo, HORARIOS_INICIAIS['PA-34']);
  if (Array.isArray(pedido.extra)) novo.extra = pedido.extra.map(pedidoEmMinutos);
  return novo;
}

// Versão 5: simuladores com os nomes usados no aeroclube
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
  // Versão 6: habilitações individuais no lugar dos níveis cumulativos A01–A09. Cada instrutor recebe
  // exatamente o que o seu nível permitia; o nível fica no registro só como cópia (sem uso)
  6: {
    cadastro: cadastro => (Array.isArray(cadastro.ins)
      ? { ...cadastro, ins: cadastro.ins.map(x => (x && !Array.isArray(x.hab) ? { ...x, hab: habilitacoesDoNivel(x.lv) } : x)) }
      : cadastro),
    dia: dia => dia
  },
  // Versão 7: os dias guardam as horas de cada avião até a revisão de 50 horas (campo "horas"). O passo não
  // muda nada; a versão nova impede que uma aba com a versão anterior do app grave os dias sem esse campo
  7: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 8: os dias guardam as filas do rodízio (campo "filas"), pelo mesmo motivo da versão 7
  8: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 9: os pedidos guardam a disponibilidade do aluno (campo "jan"), pelo mesmo motivo
  9: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 10: os dias guardam as solicitações da agenda já importadas (campo "importadas"), pelo mesmo motivo
  10: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 11: a frota sai do código e vai para o cadastro (matrícula, tipo e "Só Parafuso"). O cadastro
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
  // Versão 12: o cadastro guarda os horários de decolagem de cada categoria (o PA-34 sai de 30 em 30
  // minutos); os pedidos guardam as preferências em minutos (até a versão 11, o número da janela) e "h5" vira "h820"
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
  // Versão 13: os dias guardam o detalhe do status de cada voo (campo "fObs": o motivo do cancelamento e o
  // novo horário do atraso). O passo não muda nada; a versão nova impede que uma aba com a versão anterior do app
  // grave os dias sem esse campo
  13: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 14: os dias guardam a ordem dos aviões no hangar (campo "hangar"), pelo mesmo motivo da versão 13
  14: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 15: o cadastro guarda os limites dos instrutores pela Lei do Aeronauta (os padrões da lei) e cada
  // instrutor pode ter as horas de voo fora do app (horasExternas)
  15: {
    cadastro: cadastro => {
      if (cadastro.limites && typeof cadastro.limites === 'object') return cadastro;
      const { esquema, ...resto } = cadastro;
      return { ...resto, limites: { ...LIMITES_DA_LEI }, ...(esquema === undefined ? {} : { esquema }) };
    },
    dia: dia => dia
  },
  // Versão 16: os dias guardam a escala aprovada (os voos fixos e quem aprovou), pelo mesmo motivo da versão 13
  16: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 17: os dias guardam os critérios da compactação (campo "criterios"), pelo mesmo motivo da versão 13
  17: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 18: o cadastro guarda o programa dos cursos (PP, PC e INVA; começa vazio) e o curso de cada aluno
  18: {
    cadastro: cadastro => {
      if (cadastro.cursos && typeof cadastro.cursos === 'object') return cadastro;
      const { esquema, ...resto } = cadastro;
      return { ...resto, cursos: cursosVazios(), ...(esquema === undefined ? {} : { esquema }) };
    },
    dia: dia => dia
  },
  // Versão 19: o C152 vira uma habilitação do avião, como o C172 e o PA-34; todo instrutor do cadastro a recebe
  // (todos voavam o C152)
  19: {
    cadastro: cadastro => ({
      ...cadastro,
      ins: Array.isArray(cadastro.ins)
        ? cadastro.ins.map(x => (x && typeof x === 'object' ? { ...x, hab: [...new Set([...(Array.isArray(x.hab) ? x.hab : []), 'c152'])] } : x))
        : cadastro.ins
    }),
    dia: dia => dia
  },
  // Versão 20: o checador é credenciado por partes (o curso PP, PC ou INVA; o motor MNTE ou MLTE; as regras VFR ou
  // IFR), e o cheque exige as três. Cada checador antigo recebe as marcas que davam os mesmos cheques
  20: {
    cadastro: cadastro => ({
      ...cadastro,
      ins: Array.isArray(cadastro.ins)
        ? cadastro.ins.map(x => (x && typeof x === 'object' && Array.isArray(x.hab) ? { ...x, hab: marcasDoChecadorAntigo(x.hab) } : x))
        : cadastro.ins
    }),
    dia: dia => dia
  },
  // Versão 21: o status "Pousou". Os dados não mudam; o número novo faz a aba da versão anterior (que
  // não conhece o Pousou e o tiraria do dia ao abrir) recusar o dia e pedir para recarregar
  21: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 22: o pedido do dia pode levar o instrutor escolhido pelo operador (campo "insId") e o aluno do cadastro, os
  // instrutores dele ("voaCom"). Os dados não mudam; o número novo faz a aba da versão anterior (que tiraria os campos
  // ao gravar) recusar os dados e pedir para recarregar
  22: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 23: os atributos dos recursos da frota (js/frota.js). O PR-CPL não é homologado IFR ("Só VFR") e o PR-VOM
  // exige do instrutor a habilitação própria dele (ninguém a tem até ser marcada em Instrutores); o que já estiver
  // marcado fica. As habilitações dos instrutores passam a aceitar a do avião ("aviao:PR-VOM")
  23: {
    cadastro: cadastro => (Array.isArray(cadastro.frota) ? {
      ...cadastro,
      frota: cadastro.frota.map(f => {
        if (!f || typeof f !== 'object') return f;
        if (f.reg === 'PR-CPL' && f.tipo === 'C172' && f.soVfr === undefined) return { ...f, soVfr: true };
        if (f.reg === 'PR-VOM' && f.tipo === 'PA-34' && f.habilitacaoPropria === undefined) return { ...f, habilitacaoPropria: true };
        return f;
      })
    } : cadastro),
    dia: dia => dia
  },
  // Versão 24 (o formato dos cursos, FORMATO_DOS_CURSOS): o programa dos cursos vai para tabelas próprias. O cadastro
  // guarda a cópia de antes ("cursos"), que ninguém mais grava; os voos fixos podem levar "agendado" (o voo agendado na
  // Escala) e os pedidos, "cursoDaEtapa" (o curso da missão do pedido). Os dados não mudam; o número novo faz a aba da
  // versão anterior recusar a gravação e pedir para recarregar (sem tirar esses campos do dia), e o cadastro gravado nele
  // marca a conversão única do programa como feita (ApiClient.atualizarFormatoGravado)
  24: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 25: o cadastro pode levar a configuração do painel (campo "painel": o quadro com que ele abre e as colunas;
  // js/config-do-painel.js). Os dados não mudam; o número novo faz a aba da versão anterior (que tiraria o campo ao
  // gravar o cadastro, e o painel e a TV voltariam ao padrão) recusar a gravação e pedir para recarregar
  25: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  },
  // Versão 26: o que o recurso exige do instrutor é uma lista, "exige" (ids do registro das habilitações, js/habilitacoes.js,
  // ou a habilitação própria "aviao:<matrícula>"). O recurso com a habilitação própria e sem a lista ganha a dele; a marca
  // fica, como espelho. O número também protege o "inativo" de alunos, instrutores e recursos (só true), que a aba da
  // versão anterior tiraria ao gravar o cadastro
  26: {
    cadastro: cadastro => (Array.isArray(cadastro.frota) ? {
      ...cadastro,
      frota: cadastro.frota.map(f => (f && typeof f === 'object' && f.habilitacaoPropria === true && f.exige === undefined && typeof f.reg === 'string'
        ? { ...f, exige: [habilitacaoDoAviao(f.reg.trim().toUpperCase())] } : f))
    } : cadastro),
    dia: dia => dia
  },
  // Versão 27: as habilitações Endosso Solo (endosso_solo) e Voo de Navegação ≥ 150 NM (navegacao_150) nos instrutores, que
  // a aba da versão anterior tiraria como desconhecidas ao gravar o cadastro, e a confirmação do 7º voo local no pedido do
  // dia (limiteConfirmado, só true). Nada é convertido: ninguém recebe as habilitações novas (são marcadas em Instrutores)
  27: {
    cadastro: cadastro => cadastro,
    dia: dia => dia
  }
};

const versaoDe = doc => (typeof doc.esquema === 'number' ? doc.esquema : 4);

export const precisaMigrar = doc => Boolean(doc) && typeof doc === 'object' && versaoDe(doc) < ESQUEMA;

// O cadastro guardado antes do formato dos cursos: o programa de cada curso ainda é o do cadastro ("cursos"), que a
// conversão única leva para as tabelas dos cursos antes de o cadastro ser regravado no formato atual
export const antesDosCursosProprios = doc => Boolean(doc) && typeof doc === 'object' && versaoDe(doc) < FORMATO_DOS_CURSOS;

function migrar(doc, parte) {
  if (!doc || typeof doc !== 'object') return doc;
  let atual = doc;
  for (let versao = versaoDe(doc) + 1; versao <= ESQUEMA; versao++) atual = { ...PASSOS[versao][parte](atual), esquema: versao };
  return atual;
}

export const migrarCadastro = cadastro => migrar(cadastro, 'cadastro');
export const migrarDia = dia => migrar(dia, 'dia');
