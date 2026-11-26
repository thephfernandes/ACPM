// A aba Cursos: os cursos (as tabelas dos cursos, em S.programa) e o programa de cada um, fase a fase, com as missões na
// ordem em que o aluno voa. Um curso de cada vez: no alto, um botão por curso (os encerrados só com "Mostrar
// encerrados"); a aba abre no último curso escolhido (até a página recarregar) ou no primeiro ativo. Sob o título do
// curso, os alunos dele por fase e o índice das fases (por módulo, com quantos alunos estão em cada uma), que leva à fase.
// As fases seguidas com o mesmo módulo ficam sob um título só; cada fase recolhe e abre no título dela ("Abrir todas" e
// "Recolher todas" no índice), diz quando abre, e cada missão, quando voar ("Depois das anteriores", "Livre na fase" ou
// "Depois de…" missões anteriores), as marcas (dispensada, avaliação) e, no Noturno em trechos, o trecho. O
// Administrador (neste navegador, o Operador) cria cursos ("+ Novo curso", com o programa vazio ou um modelo), muda o
// nome, encerra e reativa, põe o cronograma do PP no PP ainda vazio ou numa fase só, e inclui, muda, reordena e tira
// fases e missões e volta com as retiradas; os outros perfis leem o programa em texto. A cada alteração a aba é refeita
// no lugar: o foco continua onde estava, e as caixas abertas ("Depois de…", as retiradas, os alunos, as alterações), as
// fases recolhidas e o formulário do curso novo continuam como estavam. Ela é refeita também ao abrir e junto com as
// outras abas (a data carregada, os dados lidos de novo, o conflito, a troca de perfil): aberta, nunca fica com os
// controles de antes. Sem os programas (a leitura falhou, ou eles ainda esperam a conversão do cadastro), ela diz por quê.
import { MIS, DURACAO_MAXIMA_H } from '../config.js';
import { percursoDoCurso, rotuloDaFase, nomeDaFase, requisitosPossiveis } from '../programa.js';
import { MODELOS } from '../modelos-de-curso.js';
import { GRUPOS_DE_HABILITACAO, nomeDaHabilitacao } from '../habilitacoes.js';
import { FUSO_DO_AEROCLUBE } from '../agenda.js';
import { nomeDaData } from '../agendamento.js';
import { ApiClient } from '../storage.js';
import { gerenciaContas } from '../perfis.js';
import { S, RES, DATA, isGestor, dadoIndisponivel } from '../state.js';
import { inativo } from '../inativos.js';
import { esc, opts, fmtH, hojeISO } from '../format.js';
import { $, trocarConteudo, trocarElemento } from '../dom.js';
import { ligada } from '../funcionalidades.js';
import { progressoDoAluno, cursoDoResultado, faseDoAluno } from './etapas.js';

// Os programas que não foram lidos, ou que ainda estão no cadastro: o que a aba mostra no lugar deles (o mesmo texto do
// aviso do topo, em js/actions.js). A próxima missão e o progresso ficam desligados; com o progresso desligado para todos
// (js/funcionalidades.js), só a tela fica sem os programas
const PENDENTES = 'Os programas dos cursos ainda não foram trazidos do cadastro (isso acontece na primeira abertura de um Operador ou Administrador depois da atualização)';
export const SEM_OS_PROGRAMAS = ligada('progresso') ? {
  cursos: 'Não foi possível ler os programas dos cursos: a próxima missão, o progresso e a missão do curso no agendamento ficam desligados.',
  'cursos-pendentes': `${PENDENTES}: a próxima missão e o progresso ficam desligados.`
} : {
  cursos: 'Não foi possível ler os programas dos cursos: a tela Cursos fica sem eles.',
  'cursos-pendentes': `${PENDENTES}: a tela Cursos espera por eles.`
};
export const programasIndisponiveis = () => Object.keys(SEM_OS_PROGRAMAS).filter(parte => dadoIndisponivel(parte));

// Depois de um conflito a tela fica só para consulta, também para o Administrador
export const podeEditarCursos = () => !ApiClient.readOnly && (ApiClient.perfil ? gerenciaContas(ApiClient.perfil) : !isGestor());

// O código de uma missão com resultados não muda (os resultados guardam o código; o nome muda): vale o que o programa lido
// diz e o que a data leu dos resultados (um resultado registrado depois da leitura do programa). Os códigos com resultado
// são contados uma vez por leitura dos resultados (registrar um resultado troca a lista)
const comResultado = new WeakMap();
function codigosComResultado() {
  const situacao = (S.resultados && S.resultados.situacao) || [];
  if (!comResultado.has(situacao)) comResultado.set(situacao, new Set(situacao.map(r => `${r.curso}|${r.missao}`)));
  return comResultado.get(situacao);
}
export const codigoTravado = (sigla, m) => m.comResultados || codigosComResultado().has(`${sigla}|${m.codigo}`);
const TRAVADO = 'Já há resultados com este código: o código não muda (o nome muda)';
// Algum resultado do curso (lido com a data, ou registrado depois) leva o código, com ou sem missão
export const codigoComResultados = (sigla, codigo) => codigosComResultado().has(`${sigla}|${codigo}`);

// Os códigos do curso que a Demanda da data aberta leva: os pedidos dela (o principal e os extras de cada aluno, no
// curso da missão do pedido, senão no do aluno) e os voos da escala dela (no curso do resultado). O resultado do voo vai
// para o código do pedido: enquanto um pedido o leva, ele não muda (o nome muda) nem vai para outra missão. Por código,
// os alunos, pelo nome, sem repetir, na ordem do cadastro
function codigosDaDemanda(sigla) {
  const porCodigo = new Map();
  const anotar = (curso, codigo, nome) => {
    if (curso !== sigla || !codigo) return;
    const nomes = porCodigo.get(codigo) || [];
    if (!nomes.includes(nome)) porCodigo.set(codigo, [...nomes, nome]);
  };
  for (const s of S.stu || []) {
    for (const p of [s, ...(s.extra || [])]) anotar(p.cursoDaEtapa || s.curso, p.etapa, s.nm);
  }
  for (const o of (RES && RES.out) || []) if (o.etapa) anotar(cursoDoResultado(o), o.etapa, o.s);
  return porCodigo;
}
// Onde a Demanda leva o código, para os avisos: "na Demanda de amanhã (Maria e João)"; '' quando ela não o leva
export function codigoNaDemanda(sigla, codigo) {
  const nomes = codigosDaDemanda(sigla).get(codigo);
  return nomes ? `na Demanda ${nomeDaData({ data: DATA, hoje: hojeISO() }).de} (${resumoDaLista(nomes)})` : '';
}
// Os códigos que os resultados do curso ou a Demanda da data aberta levam (com missão ou sem). O que não tem missão fica
// reservado: na missão que o recebesse, os resultados (e o resultado do voo do pedido) passariam a ser dela, de quem
// não a voou. O "+ Missão" pula todos (js/programa.js, incluirMissao)
export function codigosReservados(sigla) {
  const comResultados = [...codigosComResultado()].filter(chave => chave.startsWith(`${sigla}|`)).map(chave => chave.slice(sigla.length + 1));
  return [...new Set([...comResultados, ...codigosDaDemanda(sigla).keys()])];
}
// A trava do código de uma missão, para o título e o cadeado: os resultados ou a Demanda da data aberta; '' sem trava
function travaDoCodigo(sigla, m) {
  if (codigoTravado(sigla, m)) return TRAVADO;
  const naDemanda = codigoNaDemanda(sigla, m.codigo);
  return naDemanda ? `Este código está ${naDemanda}: ele não muda enquanto um pedido o leva (o nome muda)` : '';
}

// "A, B e C"
export const listaComE = nomes => (nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0] || '');
// O que uma fase ou uma missão espera ("depois de…"): os nomes curtos das fases (ou, com nomear, o nome que ela dá a cada
// fase: nomeDaFase, depois de "da") ou os códigos das missões, na ordem do curso
export function nomesDosRequisitos(curso, item, nomear = rotuloDaFase) {
  const fases = new Map(curso.fases.map(f => [f.id, f])), missoes = new Map(curso.missoes.map(m => [m.id, m]));
  return item.requer.map(id => (fases.has(id) ? nomear(fases.get(id)) : missoes.has(id) ? missoes.get(id).codigo : null)).filter(Boolean);
}
// A lista no resumo da caixa "Depois de…": até três nomes, e quantos mais
const resumoDaLista = nomes => (nomes.length > 3 ? `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}` : listaComE(nomes));

// As regras de quando a fase abre e de quando voar a missão; "Depois de…" desligada quando não há nada antes para esperar
const QUANDO_ABRE = [['ordem', 'Depois das fases anteriores'], ['livre', 'Desde o início do curso'], ['depois', 'Depois de…']];
const QUANDO_VOAR = [['ordem', 'Depois das anteriores'], ['livre', 'Livre na fase'], ['depois', 'Depois de…']];
const opcoesDaRegra = (rotulos, regra, semAnteriores) => rotulos.map(([valor, rotulo]) =>
  `<option value="${valor}"${valor === regra ? ' selected' : ''}${valor === 'depois' && semAnteriores ? ' disabled' : ''}>${rotulo}</option>`).join('');
// Quando voar, em texto (para quem só consulta): "Depois das anteriores", "Livre na fase" ou "Depois de TSL-01"
const quandoVoar = (curso, m) => (m.regra === 'livre' ? 'Livre na fase'
  : m.regra === 'depois' ? `Depois de ${listaComE(nomesDosRequisitos(curso, m))}` : 'Depois das anteriores');

const opcoesDoRecurso = m => opts(MIS[m.mis].eq.map(e => [e, e]), m.eq);
const quantas = (n, uma, varias) => `${n} ${n === 1 ? uma : varias}`;

// O trecho do Noturno de dois dias (os de NOTURNO.trechos, em js/config.js) numa missão Noturno: a ida para BH, a noite em
// BH ou a volta do dia seguinte. Para quem muda, a lista embaixo do tipo de missão; para quem só consulta, o texto
const TRECHOS_DO_NOTURNO = [['', 'Nenhum'], ['ida', 'Ida'], ['noite', 'Noite'], ['volta', 'Volta']];
const trechoQueEdita = (m, codigo) => (m.mis === 'Noturno'
  ? `<label class="trecho-do-noturno"><span>Trecho</span> <select data-cf="trecho" data-dica="trecho-do-noturno" aria-label="Trecho do Noturno de ${codigo}">${opts(TRECHOS_DO_NOTURNO, m.trecho || '')}</select></label>`
  : '');
const trechoDeConsulta = m => {
  const trecho = m.mis === 'Noturno' && TRECHOS_DO_NOTURNO.find(([valor]) => valor && valor === m.trecho);
  return trecho ? ` · <span class="trecho-do-noturno" data-dica="trecho-do-noturno">${trecho[1].toLowerCase()}</span>` : '';
};
// Os nomes dos botões de uma missão: o ✕ de uma missão com resultados diz que eles ficam
const ROTULOS = { 'missao-subir': 'Subir', 'missao-descer': 'Descer' };
const rotuloDoBotao = (act, sigla, m) => (act === 'missao-retirar'
  ? `Tirar ${m.codigo} do programa${codigoTravado(sigla, m) ? '; os resultados ficam no histórico' : ''}`
  : `${ROTULOS[act]} ${m.codigo}`);

// A caixa "Depois de…" de uma fase: o resumo (o que ela espera) e uma marca para cada fase anterior
function requisitosDaFase(curso, f, abertas) {
  const marcadas = new Set(f.requer), id = `requisitos-${f.id}`;
  const fases = requisitosPossiveis(curso, f.id).map(g => `<label class="chk"><input type="checkbox" data-cfa="requer" data-fase="${esc(g.id)}" value="${esc(g.id)}"${marcadas.has(g.id) ? ' checked' : ''}> ${esc(rotuloDaFase(g))}</label>`);
  return `<details class="requisitos"${abertas.has(id) ? ' open' : ''}><summary id="${esc(id)}">Depois de: ${esc(resumoDaLista(nomesDosRequisitos(curso, f)))}</summary>
    <fieldset><legend>A ${esc(nomeDaFase(f))} abre depois de</legend>${fases.join('')}</fieldset></details>`;
}

// A caixa "Depois de…" de uma missão: o resumo e as missões anteriores, por fase (as de fases anteriores também valem)
function requisitosDaMissao(curso, m, abertas) {
  const marcadas = new Set(m.requer), id = `requisitos-${m.id}`, possiveis = requisitosPossiveis(curso, m.id);
  const grupos = percursoDoCurso(curso).fases.map(f => [f, possiveis.filter(x => x.fase === f.id)]).filter(([, lista]) => lista.length);
  const marca = x => `<label class="chk"><input type="checkbox" data-cf="requer" data-missao="${esc(x.id)}" value="${esc(x.id)}" aria-label="${esc(m.codigo)} depois de ${esc(x.codigo)}"${marcadas.has(x.id) ? ' checked' : ''}> ${esc(x.codigo)}</label>`;
  return `<details class="requisitos"${abertas.has(id) ? ' open' : ''}><summary id="${esc(id)}">Depois de: ${esc(resumoDaLista(nomesDosRequisitos(curso, m)))}</summary>
    ${grupos.map(([f, lista]) => `<fieldset><legend>${esc(rotuloDaFase(f))}</legend>${lista.map(marca).join('')}</fieldset>`).join('')}</details>`;
}

// O que a missão exige do INVA além do tipo de missão e do recurso (exige: ids do registro das habilitações), e as que
// nenhum INVA ativo do cadastro tem: os voos dela ficam fora da escala até um INVA ter (regra a: o aviso fica na linha)
const nomesDoExige = m => (m.exige || []).map(nomeDaHabilitacao);
export const exigeSemInstrutor = m => (m.exige || []).filter(h => !S.ins.some(x => !inativo(x) && Array.isArray(x.hab) && x.hab.includes(h)));
export const textoDoExigeSemInstrutor = lista => `Nenhum INVA ativo tem ${resumoDaLista(lista.map(nomeDaHabilitacao))}`;
function avisoDoExige(m) {
  const faltam = exigeSemInstrutor(m);
  return faltam.length ? `<p class="aviso-exige" data-aviso-exige>${esc(textoDoExigeSemInstrutor(faltam))}: os voos ficam fora da escala.</p>` : '';
}

// A caixa "Habilitações que o INVA precisa" de uma missão: o resumo (nenhuma além do tipo, ou as marcadas) e uma marca
// para cada habilitação do registro, nos grupos do painel "Editar habilitações" (a própria de um recurso não entra: ela
// é do recurso)
function exigeDaMissao(m, abertas) {
  const marcadas = new Set(m.exige || []), id = `exige-${m.id}`, codigo = esc(m.codigo);
  const marca = h => `<label class="chk"><input type="checkbox" data-cf="exige" value="${esc(h)}" aria-label="${codigo} exige ${esc(nomeDaHabilitacao(h))}"${marcadas.has(h) ? ' checked' : ''}> ${esc(nomeDaHabilitacao(h))}</label>`;
  const resumo = marcadas.size ? nomesDoExige(m).join(' + ') : 'nenhuma além da missão e do recurso';
  return `<details class="exige"${abertas.has(id) ? ' open' : ''}><summary id="${esc(id)}">Habilitações que o INVA precisa: ${esc(resumo)}</summary>
    ${GRUPOS_DE_HABILITACAO.map(g => `<fieldset><legend>${esc(g.titulo)}</legend>${g.ids.map(marca).join('')}</fieldset>`).join('')}</details>${avisoDoExige(m)}`;
}

// Uma missão da fase, para quem muda: o número na fase, o código (travado com resultados ou com a Demanda da data aberta
// levando o código, com o cadeado e o motivo), o nome, o tipo de missão, o recurso, as horas, quando voar (com a caixa
// "Depois de…"), as marcas e os botões (subir, descer, tirar) com a fase dela. onde: "do PP" (o curso com uma fase só)
// ou "da Fase 6"
function linhaQueEdita(curso, fase, m, i, total, fases, onde, abertas) {
  const ground = Boolean(MIS[m.mis].isGround), trava = travaDoCodigo(curso.sigla, m), codigo = esc(m.codigo);
  const botao = (act, texto, desligado) => `<button type="button" class="x" data-act="${act}" aria-label="${esc(rotuloDoBotao(act, curso.sigla, m))}"${desligado ? ' disabled' : ''}>${texto}</button>`;
  const outraFase = fases.length > 1 ? `<select data-cf="fase" aria-label="Fase de ${codigo}">${opts(fases.map(f => [f.id, rotuloDaFase(f)]), m.fase)}</select>` : '';
  // A primeira missão do curso não tem nada antes para esperar
  const semAnteriores = percursoDoCurso(curso).posicao.get(m.id) === 0;
  return `<tr data-missao="${esc(m.id)}" data-fase="${esc(fase.id)}" data-i="${i}">
    <td class="n">${i + 1}</td>
    <td class="c-codigo"><input data-cf="codigo" class="codigo" value="${codigo}" maxlength="15" autocomplete="off" aria-label="Código da ${i + 1}ª missão ${esc(onde)}"${trava ? ` readonly title="${esc(trava)}"` : ''}>${trava ? `<svg class="ico" role="img" aria-label="${esc(trava)}"><use href="#i-cadeado"/></svg>` : ''}</td>
    <td class="c-nome"><input data-cf="nome" value="${esc(m.nome)}" maxlength="80" autocomplete="off" aria-label="Nome de ${codigo}"></td>
    <td class="c-mis"><select data-cf="mis" aria-label="Missão de ${codigo}">${opts(Object.keys(MIS).map(k => [k, k]), m.mis)}</select>${trechoQueEdita(m, codigo)}</td>
    <td class="c-eq"><select data-cf="eq" aria-label="Recurso de ${codigo}"${ground ? ' disabled' : ''}>${opcoesDoRecurso(m)}</select></td>
    <td class="c-nb"><input type="number" class="duracao" data-cf="nb" min="0.1" max="${DURACAO_MAXIMA_H}" step="0.1" inputmode="decimal" value="${esc(m.nb)}" aria-label="Horas de ${codigo}"${ground ? ' disabled' : ''}></td>
    <td class="c-quando"><select data-cf="regra" aria-label="Quando voar ${codigo}">${opcoesDaRegra(QUANDO_VOAR, m.regra, semAnteriores)}</select>${m.regra === 'depois' ? requisitosDaMissao(curso, m, abertas) : ''}</td>
    <td class="c-marcas"><label class="chk"><input type="checkbox" data-cf="dispensada" aria-label="${codigo} dispensada"${m.dispensada ? ' checked' : ''}> Dispensada</label> <label class="chk"><input type="checkbox" data-cf="avaliacao" aria-label="${codigo} de avaliação"${m.avaliacao ? ' checked' : ''}> Avaliação</label>${exigeDaMissao(m, abertas)}</td>
    <td class="acoes"><div class="acoes-da-missao">${botao('missao-subir', '↑', i === 0)}${botao('missao-descer', '↓', i === total - 1)}${botao('missao-retirar', '✕', false)}${outraFase}</div></td>
  </tr>`;
}

// Uma missão da fase, para quem só consulta: tudo em texto, e as marcas como etiquetas
function linhaDeConsulta(curso, fase, m, i) {
  const marcas = [m.dispensada ? '<span class="tag" data-dica="dispensada">dispensada</span>' : '', m.avaliacao ? '<span class="tag">AVAL</span>' : '',
    (m.exige || []).length ? `<span class="tag exige" data-dica="habilitacoes-da-missao">INVA: ${esc(nomesDoExige(m).join(' + '))}</span>${avisoDoExige(m)}` : ''];
  return `<tr data-missao="${esc(m.id)}" data-fase="${esc(fase.id)}" data-i="${i}">
    <td class="n">${i + 1}</td>
    <td class="c-codigo codigo">${esc(m.codigo)}</td>
    <td class="c-nome">${esc(m.nome)}</td>
    <td class="c-mis">${esc(m.mis)}${trechoDeConsulta(m)}</td>
    <td class="c-eq">${esc(m.eq)}</td>
    <td class="c-nb">${esc(fmtH(m.nb))}</td>
    <td class="c-quando">${esc(quandoVoar(curso, m))}</td>
    <td class="c-marcas">${marcas.filter(Boolean).join(' ')}</td>
  </tr>`;
}

// As fases recolhidas, pelo id: continuam assim quando a aba é refeita e quando outro curso é escolhido, até a página
// recarregar. A fase vem aberta
const recolhidas = new Set();
// O título da fase: um botão que recolhe e abre a fase (as missões e o "+ Missão"; o cabeçalho fica), com a seta. É o
// nome da tabela da fase (o id) e o destino do índice. Para quem muda, o nome fica no campo ao lado: no botão, só a seta
// (o nome vai para o leitor de tela)
function tituloDaFase(f, nivel, edita) {
  const nome = edita ? `<span class="sr">${esc(f.nome)}</span>` : esc(f.nome);
  return `<${nivel} class="fase-titulo" id="fase-${esc(f.id)}"><button type="button" class="fase-btn" data-recolher-fase="${esc(f.id)}" aria-expanded="${!recolhidas.has(f.id)}"><svg class="ico seta" aria-hidden="true"><use href="#i-baixo"/></svg>${nome}</button></${nivel}>`;
}

// O cabeçalho da fase, para quem muda: o título (a seta; o nome, para o leitor de tela e a tabela), o nome, o módulo (com
// os módulos em uso), quando ela abre (com a caixa "Depois de…") e os botões: subir, descer e tirar (só a fase sem
// missões). Os nomes dos campos e dos botões dizem a fase ("Nome da Fase 2", "Subir a fase Programa": nomeDaFase)
function cabecalhoQueEdita(curso, f, i, total, comMissoes, nivel, abertas) {
  const rotulo = esc(nomeDaFase(f));
  const botao = (act, texto, nome, desligado, dica = '') => `<button type="button" class="x" data-act="${act}" aria-label="${nome}"${dica ? ` title="${dica}"` : ''}${desligado ? ' disabled' : ''}>${texto}</button>`;
  return `<div class="fase-cab">
    ${tituloDaFase(f, nivel, true)}
    <label class="campo-da-fase nome-da-fase"><span>Nome</span> <input data-cfa="nome" value="${esc(f.nome)}" maxlength="80" autocomplete="off" aria-label="Nome da ${rotulo}"></label>
    <label class="campo-da-fase modulo-da-fase"><span>Módulo</span> <input data-cfa="modulo" value="${esc(f.modulo || '')}" maxlength="80" autocomplete="off" list="cur-modulos" aria-label="Módulo da ${rotulo}"></label>
    <label class="campo-da-fase"><span>Abre</span> <select data-cfa="regra" aria-label="Quando a ${rotulo} abre">${opcoesDaRegra(QUANDO_ABRE, f.regra, i === 0)}</select></label>
    ${f.regra === 'depois' ? requisitosDaFase(curso, f, abertas) : ''}
    <span class="acoes">${botao('fase-subir', '↑', `Subir a ${rotulo}`, i === 0)}${botao('fase-descer', '↓', `Descer a ${rotulo}`, i === total - 1)}${botao('fase-retirar', '✕', `Tirar a ${rotulo} do programa`, comMissoes, comMissoes ? 'Só a fase sem missões sai do programa: tire as missões dela ou mude-as de fase antes' : '')}</span>
  </div>`;
}

// O cabeçalho da fase, para quem só consulta: o título (o nome, no botão que recolhe e abre) e, quando ela não espera só
// as fases anteriores, quando abre
function cabecalhoDeConsulta(curso, f, nivel) {
  const abre = f.regra === 'livre' ? 'Abre desde o início do curso'
    : f.regra === 'depois' ? `Abre depois ${listaComE(nomesDosRequisitos(curso, f, nomeDaFase).map(nome => `da ${nome}`))}` : '';
  return `<div class="fase-cab">${tituloDaFase(f, nivel, false)}${abre ? `<p class="regra">${esc(abre)}</p>` : ''}</div>`;
}

// Uma fase do programa: o cabeçalho, a tabela das missões e, para quem muda, o "+ Missão" dela; recolhida, só o
// cabeçalho. nivel: o título da fase (h5 sob o título de um módulo; h4 sem módulo). No curso com mais de uma fase, os
// nomes dizem a fase ("da Fase 2", "na fase Programa": nomeDaFase)
function blocoDaFase(curso, fase, i, fases, missoes, edita, nivel, abertas) {
  const rotulo = nomeDaFase(fase), variasFases = fases.length > 1, onde = variasFases ? `da ${rotulo}` : `do ${curso.sigla}`;
  const cabecalho = edita ? cabecalhoQueEdita(curso, fase, i, fases.length, missoes.length > 0, nivel, abertas) : cabecalhoDeConsulta(curso, fase, nivel);
  const linhas = missoes.map((m, j) => (edita ? linhaQueEdita(curso, fase, m, j, missoes.length, fases, onde, abertas) : linhaDeConsulta(curso, fase, m, j)));
  const colunas = `<th>#</th><th>Código</th><th>Nome</th><th>Missão</th><th>Recurso</th><th>Horas</th><th>Quando voar<button type="button" class="dica-btn" data-dica="quando-voar" aria-label="O que é Quando voar?" aria-expanded="false"></button></th><th>Marcas</th>${edita ? '<th aria-label="Ações"></th>' : ''}`;
  const tabela = missoes.length
    ? `<div class="tw"><table class="cadastro programa${edita ? '' : ' consulta'}" aria-labelledby="fase-${esc(fase.id)}"><thead><tr>${colunas}</tr></thead><tbody>${linhas.join('')}</tbody></table></div>`
    : '<p class="h">Nenhuma missão nesta fase.</p>';
  return `<div class="fase${recolhidas.has(fase.id) ? ' recolhida' : ''}" data-fase="${esc(fase.id)}">
    ${cabecalho}
    ${tabela}
    ${edita ? `<button type="button" class="btn sec" data-act="missao-nova" data-fase="${esc(fase.id)}">+ Missão${variasFases ? ` na ${esc(rotulo)}` : ''}</button>` : ''}
  </div>`;
}

// As fases e as missões tiradas do programa (elas guardam o código), com "Voltar ao programa" para quem muda
function retiradasDoCurso(curso, edita, abertas) {
  const fasesFora = curso.fases.filter(f => f.removida), missoesFora = curso.missoes.filter(m => m.removida);
  if (!fasesFora.length && !missoesFora.length) return '';
  const daFase = new Map(curso.fases.map(f => [f.id, f])), id = `retiradas-${curso.sigla}`;
  const voltar = (act, atributo, alvo, nome) => (edita
    ? ` <button type="button" class="btn quiet" data-act="${act}" ${atributo}="${esc(alvo)}" aria-label="Voltar ao programa: ${esc(nome)}">Voltar ao programa</button>` : '');
  const missao = m => {
    const fase = daFase.get(m.fase);
    return `<li><span><b>${esc(m.codigo)}</b>${m.nome !== m.codigo ? ` ${esc(m.nome)}` : ''}${fase ? ` · ${esc(rotuloDaFase(fase))}` : ''}</span>${voltar('missao-restaurar', 'data-missao', m.id, m.codigo)}</li>`;
  };
  return `<details class="retiradas"${abertas.has(id) ? ' open' : ''}><summary id="${esc(id)}">Retiradas (${fasesFora.length + missoesFora.length})</summary><ul>
    ${fasesFora.map(f => `<li><span>${esc(f.nome)}</span>${voltar('fase-restaurar', 'data-fase', f.id, nomeDaFase(f))}</li>`).join('')}${missoesFora.map(missao).join('')}
  </ul></details>`;
}

// As últimas alterações do programa (a mais recente primeiro): quando, quem e o que mudou
const HORA_DA_ALTERACAO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_DO_AEROCLUBE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
function alteracoesDoCurso(curso, aberta) {
  const lista = curso.alteracoes || [];
  if (!lista.length) return '';
  const item = a => {
    const instante = Date.parse(a.registrado_em);
    const quando = Number.isFinite(instante) ? `[${HORA_DA_ALTERACAO.format(instante).replace(',', '')}] ` : '';
    return `<li>${esc(quando)}${a.registrado_por ? `${esc(a.registrado_por)} · ` : ''}${esc(a.descricao)}</li>`;
  };
  return `<details class="alteracoes"${aberta ? ' open' : ''}><summary id="alteracoes-${esc(curso.sigla)}">Alterações do programa</summary><ol>${lista.map(item).join('')}</ol></details>`;
}

// A turma do curso: os alunos dele (os de Alunos com este curso), pelo nome, e, quando o progresso se conhece (com os
// programas e os resultados, num curso com missões que contam), a fase em que cada um está (a do progresso: a primeira
// fase aberta em que falta missão) e os que concluíram. porFase: os alunos de cada fase (pelo id), na ordem do nome
function turmaDoCurso(curso) {
  const alunos = (S.stu || []).filter(s => s.curso === curso.sigla && !inativo(s)).sort((a, b) => a.nm.localeCompare(b.nm, 'pt-BR'));
  const onde = alunos.map(faseDoAluno);
  if (!alunos.length || onde.some(o => !o || (!o.concluido && !o.fase))) return { alunos, porFase: new Map(), concluidos: [], porFaseConhecida: false };
  const porFase = new Map(), concluidos = [];
  alunos.forEach((s, i) => {
    const { fase, concluido } = onde[i];
    if (concluido) concluidos.push(s);
    else porFase.set(fase.id, [...(porFase.get(fase.id) || []), s]);
  });
  return { alunos, porFase, concluidos, porFaseConhecida: true };
}

// Os alunos do curso, cada um com o progresso no programa (como em Alunos): no curso com mais de uma fase, por fase, na
// ordem do programa (os que concluíram no fim); senão, pelo nome. Com o progresso desligado (js/funcionalidades.js), só os
// nomes
function alunosDoCurso(curso, fases, turma, abertas) {
  const { alunos, porFase, concluidos, porFaseConhecida } = turma;
  if (!alunos.length) return '';
  const id = `alunos-${curso.sigla}`;
  const aluno = s => {
    const progresso = progressoDoAluno(s);
    return `<li>${esc(s.nm)}${progresso ? ` · ${progresso}` : ''}</li>`;
  };
  // Um grupo: o nome dele, com quantos são, e a lista (que o leitor de tela lê com o nome do grupo)
  const grupo = (chave, nome, lista) => `<p class="turma-da-fase" id="${esc(`${id}-${chave}`)}">${esc(nome)} <span class="quantos">(${lista.length})</span></p><ul aria-labelledby="${esc(`${id}-${chave}`)}">${lista.map(aluno).join('')}</ul>`;
  const corpo = porFaseConhecida && fases.length > 1
    ? [...fases.filter(f => porFase.has(f.id)).map(f => grupo(f.id, f.nome, porFase.get(f.id))), concluidos.length ? grupo('concluidos', 'Concluíram o curso', concluidos) : ''].join('')
    : `<ul>${alunos.map(aluno).join('')}</ul>`;
  return `<details class="alunos-do-curso"${abertas.has(id) ? ' open' : ''}><summary id="${esc(id)}">${quantas(alunos.length, 'aluno', 'alunos')} no ${esc(curso.sigla)}</summary>${corpo}</details>`;
}

// O índice das fases do curso (com mais de uma fase): os módulos e, em cada um, as fases, cada uma com quantos alunos
// estão nela; o clique leva à fase (js/eventos/cursos.js, irParaFase). No celular, o nome curto ("Fase 4"). No fim, "Abrir
// todas" e "Recolher todas"
function indiceDasFases(curso, fases, turma) {
  if (fases.length < 2) return '';
  // As fases seguidas do mesmo módulo, juntas (como os títulos dos módulos no programa)
  const modulos = [];
  for (const f of fases) {
    if (modulos.length && modulos.at(-1).modulo === f.modulo) modulos.at(-1).fases.push(f);
    else modulos.push({ modulo: f.modulo, fases: [f] });
  }
  const link = f => {
    const rotulo = rotuloDaFase(f), resto = f.nome.slice(rotulo.length), n = (turma.porFase.get(f.id) || []).length;
    return `<li><a href="#fase-${esc(f.id)}" data-ir-fase="${esc(f.id)}">${esc(rotulo)}${resto ? `<span class="resto-do-nome">${esc(resto)}</span>` : ''}</a>${n ? ` <span class="alunos-na-fase" data-dica="alunos-na-fase">${quantas(n, 'aluno', 'alunos')}</span>` : ''}</li>`;
  };
  const modulo = ({ modulo: nome, fases: lista }, i) => (nome
    ? `<div class="indice-modulo"><span class="indice-modulo-nome" id="indice-modulo-${i}">${esc(nome)}</span><ul aria-labelledby="indice-modulo-${i}">${lista.map(link).join('')}</ul></div>`
    : `<div class="indice-modulo"><ul>${lista.map(link).join('')}</ul></div>`);
  return `<nav class="indice-das-fases" aria-label="Fases do ${esc(curso.sigla)}">
    <div class="indice-modulos">${modulos.map(modulo).join('')}</div>
    <div class="indice-acoes"><button type="button" class="btn quiet" id="fases-abrir">Abrir todas</button><button type="button" class="btn quiet" id="fases-recolher">Recolher todas</button></div>
  </nav>`;
}

// Os modelos de programa feitos para o curso (o cronograma do PP, no PP), oferecidos enquanto o programa está vazio ou numa
// fase só (o programa trazido do cadastro): as chaves deles em MODELOS
const modelosDoCurso = (curso, fases, missoes) => (!missoes.length || fases.length === 1
  ? Object.keys(MODELOS).filter(chave => MODELOS[chave].curso === curso.sigla) : []);
// O botão de um modelo: "Usar o cronograma do PP (P.I PPA 001A)"
const textoDoModelo = chave => `Usar o cronograma do ${MODELOS[chave].curso} (${MODELOS[chave].documento})`;

// O cabeçalho do curso: a sigla, o nome, quantas fases (quando são mais de uma), quantas missões contam e quantas são
// dispensadas, e a etiqueta do encerrado. Para quem muda: o nome do curso, encerrar ou reativar e o modelo do programa
function cabecalhoDoCurso(curso, edita, { fases, missoes }) {
  const sigla = esc(curso.sigla), dispensadas = missoes.filter(m => m.dispensada).length;
  const resumo = `${esc(curso.nome)}${fases.length > 1 ? ` · <span data-dica="fase-do-curso">${fases.length} fases</span>` : ''} · ${quantas(missoes.length - dispensadas, 'missão', 'missões')}${dispensadas ? ` (<span data-dica="dispensada">${quantas(dispensadas, 'dispensada', 'dispensadas')}</span>)` : ''}`;
  const titulo = `<h3 id="curso-${sigla}">${sigla} <small>${resumo}</small>${curso.ativo ? '' : ' <span class="tag encerrado">encerrado</span>'}</h3>`;
  if (!edita) return `<div class="curso-cab">${titulo}</div>`;
  const [act, acao] = curso.ativo ? ['curso-encerrar', 'Encerrar'] : ['curso-reativar', 'Reativar'];
  return `<div class="curso-cab">${titulo}
    <label class="campo-do-curso"><span>Nome</span> <input data-cc="nome" value="${esc(curso.nome)}" maxlength="80" autocomplete="off" aria-label="Nome do curso ${sigla}"></label>
    <span class="acoes-do-curso"><button type="button" class="btn sec" data-act="${act}" aria-label="${acao} o curso ${sigla}">${acao} o curso</button>${modelosDoCurso(curso, fases, missoes).map(chave => `<button type="button" class="btn sec" data-act="curso-modelo" data-modelo="${esc(chave)}">${esc(textoDoModelo(chave))}</button>`).join('')}</span>
  </div>`;
}

// Um curso: o cabeçalho; os alunos, por fase, e o índice das fases; as fases, sob o título do módulo delas; "+ Fase", as
// retiradas e as alterações. O curso sem nenhuma fase tem o "+ Missão" que começa a Fase 1
function cartaoDoCurso(curso, edita, abertas) {
  const percurso = percursoDoCurso(curso), { fases, porFase } = percurso, turma = turmaDoCurso(curso);
  let modulo = null;
  const corpo = fases.length
    ? fases.map((f, i) => {
      const titulo = f.modulo && f.modulo !== modulo ? `<h4 class="modulo">${esc(f.modulo)}</h4>` : '';
      modulo = f.modulo;
      return titulo + blocoDaFase(curso, f, i, fases, porFase.get(f.id), edita, f.modulo ? 'h5' : 'h4', abertas);
    }).join('')
    : `<p class="h">Nenhuma missão no programa.${edita ? ' Use “+ Missão” para incluir a primeira (ela começa a Fase 1), ou “+ Fase” para começar pelas fases.' : ''}</p>${edita ? '<button type="button" class="btn sec" data-act="missao-nova">+ Missão</button>' : ''}`;
  return `<div class="pn curso${curso.ativo ? '' : ' encerrado'}" data-curso="${esc(curso.sigla)}">
    ${cabecalhoDoCurso(curso, edita, percurso)}
    ${alunosDoCurso(curso, fases, turma, abertas)}
    ${indiceDasFases(curso, fases, turma)}
    ${corpo}
    ${edita ? '<button type="button" class="btn sec" data-act="fase-nova">+ Fase</button>' : ''}
    ${retiradasDoCurso(curso, edita, abertas)}
    ${alteracoesDoCurso(curso, abertas.has(`alteracoes-${curso.sigla}`))}
  </div>`;
}

// O curso na tela e "Mostrar encerrados", para todos os perfis: a escolha fica na memória até a página recarregar. O
// encerrado aparece só com "Mostrar encerrados"
const filtro = { curso: '', encerrados: false };
// Muda a escolha ({ curso, encerrados }, os dois ou um só); quem muda refaz a aba
export function filtrarCursos(mudanca) {
  Object.assign(filtro, mudanca);
}
const aparece = curso => curso.ativo || filtro.encerrados;
// O curso na tela: o escolhido, se ele aparece; senão (nenhum escolhido, ou o escolhido encerrado sem "Mostrar
// encerrados", ou que não existe mais: o curso novo que o servidor recusou), o primeiro ativo, na ordem dos cursos; sem
// nenhum ativo, o primeiro encerrado, com "Mostrar encerrados"
function cursoNaTela(programa) {
  const aparecem = programa.filter(aparece);
  return aparecem.find(c => c.sigla === filtro.curso) || aparecem.find(c => c.ativo) || aparecem[0] || null;
}

// A barra da aba: um botão por curso (o da tela, pressionado; no celular, só a sigla), "Mostrar encerrados" e, para quem
// muda, "+ Novo curso". Os botões dos cursos não são ações (sem data-act): valem para todos os perfis, também enquanto a
// data abre
function barraDosCursos(programa, naTela, edita, formularioAberto) {
  const botao = c => `<button type="button" id="cur-ver-${esc(c.sigla)}" data-ver-curso="${esc(c.sigla)}"${c === naTela ? ' class="on"' : ''} aria-pressed="${c === naTela}"><span class="sigla">${esc(c.sigla)}</span><span class="nome-do-curso"> · ${esc(c.nome)}</span>${c.ativo ? '' : '<span class="curso-encerrado"> (encerrado)</span>'}</button>`;
  const aparecem = programa.filter(aparece);
  return `<div class="bar barra-dos-cursos">
    ${aparecem.length ? `<div class="seg seg-dos-cursos" role="group" aria-label="Curso">${aparecem.map(botao).join('')}</div>` : ''}
    <label class="chk"><input type="checkbox" id="cur-encerrados" class="flt-ctrl"${filtro.encerrados ? ' checked' : ''}> Mostrar encerrados</label>
    <span class="cresce"></span>
    ${edita ? `<button type="button" class="btn" id="cur-novo" data-act="curso-novo" aria-expanded="${formularioAberto}" aria-controls="form-curso">+ Novo curso</button>` : ''}
  </div>`;
}

// O formulário "+ Novo curso" (para quem muda): a sigla, o nome e com que programa começar (vazio, ou um modelo). Aberto,
// ele continua como estava quando a aba é refeita: o que foi digitado, a escolha, o erro e os campos marcados com ele
const FORMULARIO_FECHADO = { aberto: false, sigla: '', nome: '', comeco: 'vazio', erro: '', invalidos: [] };
function formularioComoEsta(lugar) {
  const form = lugar.querySelector('#form-curso');
  if (!form || form.hidden) return FORMULARIO_FECHADO;
  const marcado = form.querySelector('[name="cur-comeco"]:checked');
  return {
    aberto: true, sigla: form.querySelector('#cur-sigla').value, nome: form.querySelector('#cur-nome').value, comeco: marcado ? marcado.value : 'vazio',
    erro: form.querySelector('#cur-erro').textContent, invalidos: [...form.querySelectorAll('[aria-invalid="true"]')].map(x => x.id)
  };
}
function formularioDoCurso(f) {
  const campo = (id, rotulo, valor, maximo) => `<label class="campo">${rotulo} <input id="${id}" maxlength="${maximo}" autocomplete="off" aria-describedby="cur-erro" value="${esc(valor)}"${f.invalidos.includes(id) ? ' aria-invalid="true"' : ''}></label>`;
  const comeco = (valor, rotulo) => `<label class="chk"><input type="radio" name="cur-comeco" value="${esc(valor)}"${f.comeco === valor ? ' checked' : ''}> ${esc(rotulo)}</label>`;
  return `<form id="form-curso" class="pn" novalidate${f.aberto ? '' : ' hidden'}>
    ${campo('cur-sigla', 'Sigla', f.sigla, 10)}
    ${campo('cur-nome', 'Nome', f.nome, 80)}
    <fieldset><legend>Começar com</legend>${comeco('vazio', 'Programa vazio')}${Object.entries(MODELOS).map(([chave, m]) => comeco(chave, `${m.nome} (${m.documento})`)).join('')}</fieldset>
    <p class="erro-campo" id="cur-erro" role="alert">${esc(f.erro)}</p>
    <div class="dlg-acoes"><button type="button" class="btn sec" id="cur-cancelar">Cancelar</button><button class="btn">Criar o curso</button></div>
  </form>`;
}

// Na tela estreita, a tabela de cada fase rola para o lado: refeita a aba, ela fica onde estava (e não volta ao começo a
// cada marca clicada na direita dela), com o elemento em foco à vista
const TABELA_DA_FASE = '.fase[data-fase] > .tw';
function manterRolagens(lugar, rolagens) {
  for (const tw of lugar.querySelectorAll(TABELA_DA_FASE)) tw.scrollLeft = rolagens.get(tw.parentElement.dataset.fase) || 0;
  const ativo = document.activeElement, tw = ativo && lugar.contains(ativo) ? ativo.closest('.tw') : null;
  if (!tw) return;
  const el = ativo.getBoundingClientRect(), caixa = tw.getBoundingClientRect();
  if (el.left < caixa.left) tw.scrollLeft -= caixa.left - el.left;
  else if (el.right > caixa.right) tw.scrollLeft += Math.min(el.right - caixa.right, el.left - caixa.left);
}

export function rCursos() {
  const lugar = $('#cursos');
  if (!lugar) return;
  const faltam = programasIndisponiveis();
  if (faltam.length) {
    trocarConteudo(lugar, `<p class="h">${faltam.map(parte => SEM_OS_PROGRAMAS[parte]).join(' ')}</p>`);
    return;
  }
  const edita = podeEditarCursos(), programa = S.programa || [];
  const abertas = new Set([...lugar.querySelectorAll('details[open] > summary[id]')].map(s => s.id));
  const rolagens = new Map([...lugar.querySelectorAll(TABELA_DA_FASE)].map(tw => [tw.parentElement.dataset.fase, tw.scrollLeft]));
  const formulario = edita ? formularioComoEsta(lugar) : FORMULARIO_FECHADO;
  // O cursor de quem digita no formulário continua onde estava
  const ativo = document.activeElement;
  const cursor = formulario.aberto && ativo && ativo.matches('#form-curso input:not([type="radio"])') ? [ativo.id, ativo.selectionStart, ativo.selectionEnd] : null;
  // Um curso de cada vez. O que ficou na tela no lugar do escolhido passa a ser o escolhido: o encerrado escondido por
  // "Mostrar encerrados" não volta sozinho quando os encerrados aparecem de novo
  const naTela = cursoNaTela(programa);
  if (naTela) filtro.curso = naTela.sigla;
  const modulos = [...new Set(programa.flatMap(c => percursoDoCurso(c).fases.map(f => f.modulo).filter(Boolean)))];
  const encerrados = programa.filter(c => !c.ativo).length;
  // Antes de a data abrir, sem programa: a aba é refeita quando ele chega
  trocarConteudo(lugar, barraDosCursos(programa, naTela, edita, formulario.aberto)
    + (edita ? formularioDoCurso(formulario) : '')
    + `<p class="h">O programa de cada curso, em fases (as fases de um módulo juntas), na ordem em que o aluno voa: quando cada fase abre e, em cada missão, o código (PP-07), o nome, o tipo de missão da escala, o recurso, as horas e quando voar. ${edita ? 'Só o Administrador muda.' : 'Só o Administrador muda; aqui é consulta.'}</p>`
    + (programa.length && !naTela ? `<p class="h">Nenhum curso ativo.${encerrados ? ' Marque “Mostrar encerrados” para ver os encerrados.' : ''}</p>` : '')
    + (naTela ? cartaoDoCurso(naTela, edita, abertas) : '')
    + (edita ? `<datalist id="cur-modulos">${modulos.map(m => `<option value="${esc(m)}"></option>`).join('')}</datalist>` : ''));
  if (cursor && document.activeElement && document.activeElement.id === cursor[0]) document.activeElement.setSelectionRange(cursor[1], cursor[2]);
  manterRolagens(lugar, rolagens);
}

// Recolhe ou abre uma fase (aberta: true abre, false recolhe; sem ele, troca), também na tela, sem refazer a aba
export function recolherFase(id, aberta = recolhidas.has(id)) {
  if (aberta) recolhidas.delete(id);
  else recolhidas.add(id);
  const bloco = $(`#cursos .fase[data-fase="${CSS.escape(id)}"]`);
  if (!bloco) return;
  bloco.classList.toggle('recolhida', !aberta);
  const botao = bloco.querySelector('[data-recolher-fase]');
  if (botao) botao.setAttribute('aria-expanded', String(aberta));
}
// "Abrir todas" e "Recolher todas": as fases do curso na tela
export function recolherTodasAsFases(recolher) {
  for (const bloco of document.querySelectorAll('#cursos .fase[data-fase]')) recolherFase(bloco.dataset.fase, !recolher);
}
// Um link do índice: a fase (aberta, se estava recolhida) vem para o alto da tela, e o foco vai para o título dela (o
// botão que a recolhe, com o nome), sem rolar de novo. O destino da rolagem é o bloco da fase: o título de quem muda é
// só a seta
export function irParaFase(id) {
  const bloco = $(`#cursos .fase[data-fase="${CSS.escape(id)}"]`);
  if (!bloco) return;
  recolherFase(id, true);
  bloco.scrollIntoView({ block: 'start' });
  const titulo = bloco.querySelector('[data-recolher-fase]');
  if (titulo) titulo.focus({ preventScroll: true });
}

// Só a lista das alterações de um curso, depois de uma gravação confirmada (o resto da aba já mostra o curso como ficou;
// refazer a aba inteira perderia o que está sendo digitado em outro campo). A primeira alteração de um curso põe a lista
// no fim do cartão dele
export function mostrarAlteracoes(curso) {
  const cartao = $(`#cursos .curso[data-curso="${CSS.escape(curso.sigla)}"]`);
  if (!cartao) return;
  const caixa = cartao.querySelector(':scope > details.alteracoes');
  if (caixa) trocarElemento(caixa, alteracoesDoCurso(curso, caixa.open));
  else cartao.insertAdjacentHTML('beforeend', alteracoesDoCurso(curso, false));
}
