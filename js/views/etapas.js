// A missão do curso no dia: a próxima missão de cada aluno e as outras do curso (para a Demanda), o progresso (para
// Alunos), a fase de cada aluno (para a aba Cursos) e o resultado de cada voo (para a escala). Os resultados e o
// programa dos cursos chegam com a data
// (S.resultados: a situação de cada missão e os registros da data; S.programa: as tabelas dos cursos) e não são gravados
// no dia. A próxima missão e o progresso seguem as regras do programa (js/progresso.js).
import { MIS } from '../config.js';
import { indiceDoPrograma, rotuloDaFase, rotuloDaMissao, percursoDoCurso, noturnosDoCurso } from '../programa.js';
import { estadoDoAluno, proximasMissoes, progressoNoCurso, missoesDoDia, motivoDoBloqueio } from '../progresso.js';
import { situacaoPorMissao, resultadoDoVoo } from '../resultados.js';
import { S, isGestor, stuBy, dadoIndisponivel, getMissionTarget } from '../state.js';
import { esc, opts, fmtDurLabel } from '../format.js';
import { duracaoFixaDaMissao } from '../rules.js';
import { ligada } from '../funcionalidades.js';

const resultados = () => S.resultados || { situacao: [], doDia: [] };
// A situação de cada missão, calculada uma vez por leitura dos resultados (registrar um resultado troca a lista)
const situacoes = new WeakMap();
function situacao() {
  const registros = resultados().situacao || [];
  if (!situacoes.has(registros)) situacoes.set(registros, situacaoPorMissao(registros));
  return situacoes.get(registros);
}

// O programa de onde saem a próxima missão, o progresso e a missão dos pedidos da agenda: o das tabelas dos cursos, lido
// com a data; nenhum quando faltam os resultados ou os programas, ou quando eles ainda esperam a conversão do cadastro
// (nada é inferido de uma situação ou de um programa vazios), e nenhum antes de a data abrir. Com o progresso desligado
// (js/funcionalidades.js), nenhum: sem a próxima missão, as outras do curso, o progresso, a fase e a missão na importação
export function programaParaInferir() {
  if (!ligada('progresso')) return [];
  if (['resultados', 'cursos', 'cursos-pendentes'].some(parte => dadoIndisponivel(parte))) return [];
  return S.programa || [];
}
const cursoDoAluno = stu => (stu.curso && indiceDoPrograma(programaParaInferir()).curso(stu.curso)) || null;

// A próxima missão para um pedido do aluno: a primeira liberada do programa. As missões dos outros pedidos dele no dia
// (que voam e não foram cancelados) contam como feitas e não voltam. O código vai como id: é a etapa do pedido; o curso
// (a sigla) vai com ela (o Noturno em trechos vai pela noite, com os translados no rótulo). encerrado: o curso foi
// encerrado (Usar pede confirmação, como no agendamento)
export function proximaDoPedido(stu, mid) {
  const curso = cursoDoAluno(stu);
  if (!curso) return null;
  const doDia = missoesDoDia(curso, stu, { fStatus: S.fStatus, mid: mid || 0 });
  const { padrao } = proximasMissoes(curso, situacao(), stu.id, { planejadas: doDia, exceto: doDia });
  return padrao && {
    id: padrao.codigo, nome: padrao.nome, mis: padrao.mis, eq: padrao.eq, nb: padrao.nb, curso: curso.sigla, rotulo: rotuloDaMissao(curso, padrao),
    encerrado: curso.ativo === false
  };
}

// As horas do voo da missão: a duração fixa dela vale mais que a do programa (o Noturno voa as 4 h do dia, a ida e a
// noite, mesmo com a noite de 3 h no programa), como no pedido que Usar monta (normalizeMissionFields)
const horasDoVoo = m => fmtDurLabel(duracaoFixaDaMissao(m.mis) || m.nb);
const descricaoDaMissao = m => `${m.id}: ${m.nome} · ${m.mis} · ${MIS[m.mis].isGround ? '1h30' : horasDoVoo(m)}${MIS[m.mis].isGround ? '' : ` · ${m.eq}`}`;

// As outras missões do curso do aluno para um pedido ("Outra missão do curso", na Demanda), na ordem do curso: as
// liberadas, que valem na hora (a que depende do resultado de um voo do dia diz de qual), e as fora da ordem, cada uma
// com o motivo (motivoDoBloqueio), que pedem confirmação; a que não tem motivo não é escolhida sozinha e fica de fora. As
// missões dos outros pedidos dele no dia contam como na próxima missão; a do próprio pedido não volta. O Noturno em
// trechos vai pela noite, como na próxima missão: os translados dele nunca vão sozinhos, nem o dispensado. Sem o
// programa do curso (ou sem os resultados), nenhuma: null
function outrasMissoes(stu, d, mid) {
  const curso = cursoDoAluno(stu);
  if (!curso) return null;
  const mapa = situacao();
  const doDia = missoesDoDia(curso, stu, { fStatus: S.fStatus, mid: mid || 0 });
  const { porMissao } = estadoDoAluno(curso, mapa, stu.id, { planejadas: doDia, exceto: doDia });
  const { missoes } = percursoDoCurso(curso);
  const codigo = new Map(missoes.map(m => [m.id, m.codigo]));
  const doPedido = m => m.codigo === d.etapa && (d.cursoDaEtapa || stu.curso) === curso.sigla;
  const noturnos = noturnosDoCurso(curso);
  const translado = m => noturnos.has(m.id) && noturnos.get(m.id).noite.id !== m.id;
  const liberadas = [], foraDaOrdem = [];
  for (const m of missoes.filter(x => !doPedido(x) && !translado(x))) {
    const estado = porMissao.get(m.id);
    if (['liberada', 'condicional'].includes(estado.estado)) {
      liberadas.push({ missao: m, dependeDe: estado.dependeDe.map(id => codigo.get(id)) });
      continue;
    }
    const motivo = motivoDoBloqueio(curso, m, estado, { mapa, aluno: stu.id });
    if (motivo) foraDaOrdem.push({ missao: m, motivo });
  }
  return { curso, liberadas, foraDaOrdem };
}

// A missão do curso escolhida em "Outra missão do curso" para o pedido: { missao, curso (a sigla), liberada, motivo,
// encerrado }. A liberada vale na hora; a fora da ordem pede confirmação, e no curso encerrado, todas pedem (desenho
// §4.9, como no agendamento). null: ela não é uma das outras missões do pedido (o programa ou os resultados mudaram)
export function outraMissaoDoPedido(stu, d, mid, codigo) {
  const outras = outrasMissoes(stu, d, mid);
  const liberada = outras && outras.liberadas.find(x => x.missao.codigo === codigo);
  const fora = outras && !liberada && outras.foraDaOrdem.find(x => x.missao.codigo === codigo);
  if (!liberada && !fora) return null;
  return {
    missao: (liberada || fora).missao, curso: outras.curso.sigla, liberada: Boolean(liberada), motivo: fora ? fora.motivo : '',
    encerrado: outras.curso.ativo === false
  };
}

// O que pede a confirmação da missão escolhida para o pedido (a fora da ordem; a do curso encerrado): o texto do botão,
// o do botão armado e os motivos (o nome do botão, a dica e o histórico)
export function confirmacaoDaMissao({ missao: { codigo }, curso, liberada, motivo, encerrado }) {
  const como = liberada ? 'do curso encerrado' : 'fora da ordem';
  const motivos = [liberada ? '' : motivo, encerrado ? `curso ${curso} encerrado` : ''].filter(Boolean).join('; ');
  return { botao: `Usar ${codigo} ${como}`, armado: `Confirmar: ${codigo} ${como}`, motivos };
}

// A missão na lista: o código (a noite de um Noturno em trechos com os translados, como na próxima missão), o tipo, o
// recurso e as horas
const resumoDaMissao = (curso, m) => `${rotuloDaMissao(curso, m)} · ${m.mis} · ${MIS[m.mis].isGround ? '1h30' : `${m.eq} · ${horasDoVoo(m)}`}`;
const emLista = codigos => (codigos.length > 1 ? `${codigos.slice(0, -1).join(', ')} e ${codigos.at(-1)}` : codigos[0]);

// A lista "Outra missão do curso" do pedido: o primeiro item só dá nome à lista (escolher uma missão é que age)
function outraMissaoNaDemanda(stu, outras) {
  const { curso, liberadas, foraDaOrdem } = outras;
  if (!liberadas.length && !foraDaOrdem.length) return '';
  const grupo = (rotulo, itens) => (itens.length ? `<optgroup label="${esc(rotulo)}">${opts(itens)}</optgroup>` : '');
  // No curso encerrado, as liberadas também pedem confirmação
  const encerrado = curso.ativo === false ? ' (curso encerrado: pede confirmação)' : '';
  return ` <select class="edit-only outra-missao" data-f="outra-missao" aria-label="Outra missão do curso para ${esc(stu.nm)}">`
    + '<option value="" selected>Outra missão…</option>'
    + grupo(`Liberadas no ${curso.sigla}${encerrado}`, liberadas.map(({ missao: m, dependeDe }) =>
      [m.codigo, `${resumoDaMissao(curso, m)}${dependeDe.length ? ` — depende do resultado de ${emLista(dependeDe)}` : ''}`]))
    + grupo('Fora da ordem (pede confirmação)', foraDaOrdem.map(({ missao: m, motivo }) => [m.codigo, `${resumoDaMissao(curso, m)} (${motivo})`]))
    + '</select>';
}

// A missão escolhida para o pedido que pede confirmação (a fora da ordem; no curso encerrado, também a liberada) espera
// neste botão, que aparece armado (js/eventos/demanda.js)
export const botaoForaDaOrdem = (stu, escolha) => {
  const { codigo } = escolha.missao;
  const { botao, motivos } = confirmacaoDaMissao(escolha);
  const dica = escolha.liberada ? 'data-dica="curso-encerrado"' : 'data-dica="fora-da-ordem"';
  return ` <button type="button" class="btn quiet edit-only usar-proxima" data-act="usar-fora-da-ordem" data-codigo="${esc(codigo)}" ${dica} data-dica-caso="${esc(`${codigo}: ${motivos}`)}" aria-label="${esc(`${botao} para ${stu.nm} (${motivos})`)}">${esc(botao)}</button>`;
};

// Na Demanda: o código do pedido (com o curso dele), ou o botão com a próxima missão do programa (no curso encerrado, ele
// pede confirmação), e a lista das outras missões do curso
export function etapaNaDemanda(stu, d, mid) {
  const outras = outrasMissoes(stu, d, mid);
  const lista = outras ? outraMissaoNaDemanda(stu, outras) : '';
  if (d.etapa) return ` <span class="etapa" title="Missão do curso ${esc(d.cursoDaEtapa || stu.curso || '')}">${esc(d.etapa)}</span>${lista}`;
  const proxima = proximaDoPedido(stu, mid);
  const titulo = proxima && `${descricaoDaMissao(proxima)}${proxima.encerrado ? ` (curso ${proxima.curso} encerrado: pede confirmação)` : ''}`;
  return (proxima
    ? ` <button type="button" class="btn quiet edit-only usar-proxima" data-act="usar-proxima" data-id="${esc(stu.id)}" data-mid="${esc(mid)}" title="${esc(titulo)}">Próxima: ${esc(proxima.rotulo)} · Usar</button>`
    : '') + lista;
}

// Em Alunos: as aprovadas sobre as missões que contam (a dispensada não conta), a fase em que o aluno está (quando o
// curso tem mais de uma) e a próxima missão, como texto: { contagem: '13/46', resto: 'Fase 5 · próxima NAV-01' }. null sem
// progresso (sem curso, sem os programas, com o progresso desligado: js/funcionalidades.js)
export function progressoEmTexto(stu) {
  const curso = cursoDoAluno(stu);
  if (!curso) return null;
  const { aprovadas, total, faseAtual, proxima } = progressoNoCurso(curso, situacao(), stu.id);
  if (!total) return null;
  const fase = faseAtual && indiceDoPrograma(programaParaInferir()).percurso(curso.sigla).fases.length > 1 ? rotuloDaFase(faseAtual) : '';
  return { contagem: `${aprovadas}/${total}`, resto: [fase, proxima ? `próxima ${rotuloDaMissao(curso, proxima)}` : 'concluído'].filter(Boolean).join(' · ') };
}

// O progresso numa linha (a lista dos alunos da aba Cursos)
export function progressoDoAluno(stu) {
  const p = progressoEmTexto(stu);
  return p ? `<small class="progresso" data-dica="progresso">${p.contagem} · ${esc(p.resto)}</small>` : '';
}

// Na aba Cursos (os alunos por fase): a fase em que o aluno está no curso dele (a do progresso: a primeira fase aberta em
// que falta missão) e se ele concluiu. null quando o progresso não se conhece: sem os programas ou os resultados, ou no
// curso sem missões que contam
export function faseDoAluno(stu) {
  const curso = cursoDoAluno(stu);
  if (!curso) return null;
  const { total, faseAtual, concluido } = progressoNoCurso(curso, situacao(), stu.id);
  return total ? { fase: faseAtual, concluido } : null;
}

// O curso do resultado de um voo da escala (a sigla): o da missão do pedido (o aluno pode ter trocado de curso depois que
// ela foi para o pedido), quando o pedido ainda é essa missão; senão (o pedido de antes do curso da missão), o do aluno.
// Sem nenhum, null
export function cursoDoResultado(o) {
  const stu = stuBy(o.stuId), pedido = getMissionTarget(o.stuId, o.mid || 0);
  return (pedido && pedido.etapa === o.etapa && pedido.cursoDaEtapa) || (stu && stu.curso) || null;
}

// Na escala, com o status do aluno: o código da missão do curso e o resultado (o operador registra; os outros veem). Com o
// progresso desligado, só o código (os resultados registrados continuam guardados)
export function resultadoNaEscala(o) {
  if (!o.etapa) return '';
  const codigo = `<span class="etapa" data-dica="missao-do-curso">${esc(o.etapa)}</span>`;
  if (!ligada('progresso')) return `<span class="resultado">${codigo}</span>`;
  const registrado = resultadoDoVoo(resultados().doDia, o.fKey);
  const atual = ['aprovado', 'reprovado'].includes(registrado) ? registrado : 'pendente';
  if (isGestor() || !cursoDoResultado(o)) {
    return `<span class="resultado">${codigo}${atual !== 'pendente' ? ` <span class="res res-${atual}">${atual === 'aprovado' ? 'Aprovado' : 'Reprovado'}</span>` : ''}</span>`;
  }
  return `<span class="resultado">${codigo} <select class="res-sel res-${atual}" data-resultado="${esc(o.fKey)}" aria-label="Resultado de ${esc(o.s)} em ${esc(o.etapa)}" data-dica="resultado"${dadoIndisponivel('resultados') ? ' disabled' : ''}>${opts([['pendente', 'Resultado'], ['aprovado', 'Aprovado'], ['reprovado', 'Reprovado']], atual)}</select></span>`;
}
