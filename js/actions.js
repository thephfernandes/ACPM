// Ações que alteram o estado: perfil de acesso, data da escala, histórico de alterações, geração da escala e BI.
import { escreverDataNoEndereco } from './endereco.js';
import { somarDias, fimDoMes, LIMITE_DO_NOME } from './format.js';
import { aplicarSomenteLeitura } from './somente-leitura.js';
import { escalaDaAlteracao } from './edicao-do-voo.js';
import { normalizarEscalaGravada } from './escala-gravada.js';
import { ligada } from './funcionalidades.js';
import { ApiClient } from './storage.js';
import { S, RES, AUDIT_LOG, BI_HISTORY, DATA, setS, setRES, setAuditLog, setBIHistory, setData, isGestor, dadoIndisponivel, modoCompartilhado, estadoDaEscala, comOsMotivosDaTela, escalaDoMotor } from './state.js';
import { $, mostrarAviso, avisoAberto, showToast } from './dom.js';
import { comHorasExternas } from './limites.js';
import { comRepousoDoNoturno } from './noturno.js';
import { redesenhar, redesenharPorNome } from './redesenho.js';
import { SEM_OS_PROGRAMAS } from './views/cursos.js';
import { podeEditarAgenda } from './views/agenda.js';
import { lerPedidosDaData } from './views/selos.js';

// Abre uma data: a única que escreve a data aberta e o ?data= do endereço (recarregar continua nela). Não lê nada e não
// desenha: quem mostra a data (o nome no topo, o calendário, a data base do BI) se redesenha no momento 'data-aberta'
// naoEscolhida: a data que aparece enquanto o app abre (o login, os dados chegando) ainda não é a da abertura e não vai para o
// endereço (recarregar ali a tomaria pela do link)
export function abrirData(data, { naoEscolhida = false } = {}) {
  setData(data);
  if (!naoEscolhida) escreverDataNoEndereco(data);
  document.body.dataset.data = data;
  redesenhar('data-aberta');
}

// somenteConsulta: daqui em diante nada é gravado (o Gestor e a Secretaria no modo compartilhado, ou depois de um conflito)
export function setRole(role, somenteConsulta = false) {
  if (somenteConsulta) ApiClient.readOnly = true;
  const validRole = (ApiClient.readOnly || role === 'gestor') ? 'gestor' : 'operador';
  document.body.setAttribute('data-role', validRole);
  const sel = $('#role-sel');
  if (sel) {
    sel.value = validRole;
    sel.disabled = ApiClient.readOnly;
  }
  // Agenda: quem pode registrar pedidos (operadores e secretaria; no modo local, fora do perfil Gestor)
  document.body.dataset.agenda = podeEditarAgenda() ? 'edita' : 'consulta';
  // A linha, os selos e o que muda com o perfil
  redesenhar('perfil');
  // Os campos da tela, desligados ou ligados conforme o perfil
  aplicarSomenteLeitura();
}

// As horas dos instrutores, os resultados ou os programas dos cursos que não foram lidos (ou os programas que ainda estão
// no cadastro, esperando a conversão): o aviso fica até a leitura dar certo, e o que depende disso fica desligado
// (Aprovar escala; a próxima missão, o progresso e o resultado, com o progresso ligado: js/funcionalidades.js). Os textos
// dos programas são os que a aba Cursos mostra no lugar deles
export const SEM_OS_DADOS = {
  horas: 'Não foi possível ler as horas de voo dos instrutores: os limites do mês e do ano não estão sendo conferidos, e Aprovar escala fica desligado.',
  resultados: ligada('progresso')
    ? 'Não foi possível ler os resultados das missões dos cursos: a próxima missão e o registro de resultados ficam desligados.'
    : 'Não foi possível ler os resultados das missões dos cursos: o app não confere se um código do programa ou um voo agendado já tem resultado.',
  ...SEM_OS_PROGRAMAS
};
function avisarDadosIndisponiveis() {
  const partes = (S.indisponiveis || []).filter(p => Object.hasOwn(SEM_OS_DADOS, p));
  $('#aviso-dados').hidden = !partes.length;
  $('#aviso-dados-texto').textContent = partes.map(p => SEM_OS_DADOS[p]).join(' ');
}

// "Tentar de novo": lê de novo o que faltou; a escala é refeita com as horas (o voo além do limite do mês aparece). Os
// programas que esperavam a conversão do cadastro (ela é feita na abertura de um Operador ou Administrador; quem só
// consulta pode ter aberto antes): o formato do cadastro é lido de novo e, com a conversão feita, valem os programas
// lidos agora (sem eles, o aviso passa a ser o dos programas que não foram lidos)
export async function lerDadosDeNovo() {
  const data = DATA;
  const pendentes = dadoIndisponivel('cursos-pendentes');
  const [{ horasBase, resultados, programa }, aindaNoCadastro] = await Promise.all([
    ApiClient.lerDadosAParte(data),
    pendentes ? ApiClient.programaAindaNoCadastro().catch(() => true) : true
  ]);
  if (DATA !== data) return;
  const convertidos = pendentes && !aindaNoCadastro;
  if (horasBase && dadoIndisponivel('horas')) {
    S.horasBase = horasBase;
    S.horasDosInstrutores = comRepousoDoNoturno(comHorasExternas(horasBase, S.ins, data), S.noturnosDaVespera);
  }
  if (resultados && dadoIndisponivel('resultados')) S.resultados = resultados;
  if (programa && (dadoIndisponivel('cursos') || convertidos)) S.programa = programa;
  // O que foi lido sai do aviso
  const lidos = new Map([['horas', horasBase], ['resultados', resultados], ['cursos', programa], ['cursos-pendentes', convertidos]]);
  S.indisponiveis = (S.indisponiveis || []).filter(p => !lidos.get(p));
  if (convertidos && !programa && !S.indisponiveis.includes('cursos')) S.indisponiveis = [...S.indisponiveis, 'cursos'];
  avisarDadosIndisponiveis();
  if (!S.indisponiveis.length) showToast('Dados lidos.', 'ok');
  if (horasBase && !isGestor()) save();
  redesenhar('releitura');
}

// Uma gravação que não deu certo. Sem conexão, o aviso conta as alterações esperando (as entradas "gravando…" do
// histórico), que são gravadas sozinhas; uma recusa definitiva do servidor pede para recarregar
export function avisarFalhaDeGravacao(erro, documento, { definitivo = false } = {}) {
  if (avisoAberto() === 'conflito') return;
  if (definitivo) {
    const motivo = erro && erro.code === '42501' ? 'a sua conta não tem permissão' : (erro && erro.message) || 'erro desconhecido';
    mostrarAviso('erro', documento === 'historico'
      ? `O servidor recusou o registro da última alteração no histórico (${motivo}).`
      : `O servidor recusou a última alteração (${motivo}): ela não foi salva. Recarregue a página para voltar à escala gravada.`);
    return;
  }
  avisarAlteracoesEsperando();
}

function avisarAlteracoesEsperando() {
  const n = AUDIT_LOG.filter(e => e.estado === 'gravando').length;
  // Sem alteração do operador esperando (ex.: a atualização dos dados ao abrir), o aviso não conta alterações
  if (!n) {
    mostrarAviso('espera', 'Sem conexão com o servidor: gravando de novo assim que a conexão voltar; não feche esta página.', { recarregar: false });
    return;
  }
  mostrarAviso('espera', n > 1
    ? `Sem conexão com o servidor: ${n} alterações esperando para serem gravadas. Elas são gravadas sozinhas quando a conexão voltar; não feche esta página.`
    : 'Sem conexão com o servidor: 1 alteração esperando para ser gravada. Ela é gravada sozinha quando a conexão voltar; não feche esta página.',
  { recarregar: false });
}

// Um conflito na gravação (js/backends/supabase.js, aoConflito). No cadastro (outra pessoa mudou um aluno, um instrutor, a
// frota), com a data já lida e sem ser pelo formato: a data é lida de novo, sem travar a tela, e o aviso diz o que não foi
// gravado (responde 'releitura', e o backend continua gravando depois da leitura). Os outros (o dia, o formato, um conflito
// enquanto a data abre) travam a tela, como sempre
export function aposConflito(documento, { formato = false } = {}) {
  if (documento !== 'cadastro' || formato || !dadosLidos) {
    travarAposConflito({ formato });
    return 'travar';
  }
  // As alterações cuja gravação não foi confirmada: as entradas "gravando…" do histórico sem a marca da gravação que deu
  // certo (uma alteração já gravada cuja entrada ainda vai para o servidor não está perdida)
  const perdidas = AUDIT_LOG.filter(e => e.estado === 'gravando' && !e.alteracaoGravada).map(e => e.desc);
  setTimeout(() => relerAposConflito(perdidas));
  return 'releitura';
}

// O texto do aviso depois do conflito no cadastro: até cinco alterações (os textos do histórico, sem dado pessoal), e o
// número das outras
function avisoDaReleitura(perdidas) {
  const inicio = 'Outra pessoa alterou o cadastro enquanto você editava: a tela mostra a versão atual';
  if (!perdidas.length) return `${inicio}, e a sua última alteração não foi gravada. Refaça o que ainda for preciso.`;
  const lista = perdidas.slice(0, 5).join('; ') + (perdidas.length > 5 ? `; e mais ${perdidas.length - 5}` : '');
  return `${inicio}, e ${perdidas.length > 1 ? 'estas alterações não foram gravadas' : 'esta alteração não foi gravada'}: ${lista}. Refaça o que ainda for preciso.`;
}

// Lê a data aberta de novo (o cadastro e o dia, com as versões de agora: nada é gravado até chegarem) e avisa. A leitura
// que falha trava a tela, como o conflito de antes
async function relerAposConflito(perdidas) {
  try {
    if (!await lerData(DATA)) return;
  } catch {
    travarAposConflito();
    return;
  }
  $('#escala-atualizada').hidden = true;
  redesenhar('dados');
  lerPedidosDaData();
  mostrarAviso('refazer', avisoDaReleitura(perdidas), { recarregar: false, fechar: true });
}

// Depois de um conflito nada mais é gravado: a tela fica só para consulta até recarregar, com o aviso
export function travarAposConflito({ formato = false } = {}) {
  setRole('gestor', true);
  redesenhar('consulta');
  mostrarAviso('conflito', formato
    ? 'O app foi atualizado. Recarregue a página para continuar (a sua última alteração não foi salva).'
    : 'Outra pessoa alterou a escala enquanto você editava. A tela ficou só para consulta: recarregue para ver a versão atual e continuar (a sua última alteração não foi salva).');
}

// Os dados da data aberta foram lidos (setS com os dados dela, em lerData)? Até lá nada é gravado: na abertura do app S
// ainda é o estado inicial, sem os alunos e os instrutores, e numa troca de data S é o da data anterior, mas o cadastro já
// foi lido de novo (a gravação levaria a versão nova com o conteúdo velho, por cima do que outra pessoa mudou). Depois de
// uma leitura que falhou também não: só quando uma data abrir de novo (ou recarregando a página)
export let dadosLidos = false;
// Antes de a escala abrir, a mudança é recusada, com o aviso (responde true): quem chama não muda nada, e a tela fica
// como estava
export function aindaNaoAbriu() {
  if (dadosLidos) return false;
  showToast('A escala ainda não abriu: nada foi mudado. Espere os dados chegarem ou recarregue a página.');
  return true;
}

// A escala acompanha os dados: cada alteração do operador refaz a escala da data (o motor leva milissegundos) e
// grava os dados e a escala juntos. Ao abrir a aba Escala, ela já está pronta
// A gravação mais recente da escala: as entradas do histórico esperam por ela
let gravacaoAtual = Promise.resolve(true);
// A gravação mais recente, para quem espera a alteração que acabou de fazer (o aluno novo fica "novo" no endereço até ela;
// os dados pessoais dele esperam por ela): responde se deu certo
export const ultimaGravacao = () => gravacaoAtual;

// Refaz e grava a escala; responde se a gravação deu certo. Os eventos da tela gravam por gravarAlteracao
// A ordem: a escala é refeita com os dados da tela (sem desenhar), gravada, e só então redesenhada. salvarDia copia os dados
// antes de esperar o servidor (js/storage.js), e um desenho que falha (js/redesenho.js, semFalhar) não impede a gravação
// nem a entrada do histórico que vem depois dela
// resultado: a escala que a alteração deixou sem o motor (a escala aprovada, gravarAlteracao); sem ela, a escala refeita
function save(resultado = null) {
  if (isGestor() || !dadosLidos) return Promise.resolve(false);
  setRES(resultado || escalaCalculada());
  syncBIHistoryForCurrentDate();
  gravacaoAtual = ApiClient.salvarDia(DATA, S, RES);
  // Neste navegador (sem servidor), a gravação só falha quando o armazenamento recusa (o espaço pode ter acabado)
  if (!modoCompartilhado()) {
    gravacaoAtual.then(gravou => {
      if (!gravou) mostrarAviso('erro', 'Não foi possível salvar neste navegador (o espaço de armazenamento pode ter acabado): a última alteração não foi salva. Exporte o CSV para não perder a escala.', { recarregar: false });
    });
  }
  escalaSoCalculada = false;
  // A escala refeita e o que depende dela (a revisão de 50 horas, o hangar, a grade dos instrutores, o Histórico, o BI e
  // os selos)
  redesenhar('escala');
  // A barra da escala mostra quando ela foi refeita (sem a barra na página, só não mostra)
  const agora = new Date(), texto = $('#escala-atualizada-texto'), marca = $('#escala-atualizada');
  if (texto && marca) {
    texto.textContent = `Atualizada às ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    marca.hidden = false;
  }
  return gravacaoAtual;
}

// Uma alteração do operador nos dados da data: grava (a escala é refeita) e registra no histórico, nesta ordem e no
// mesmo evento (a entrada do histórico espera pela gravação que leva a alteração). É o único jeito de os eventos da
// tela mudarem os dados. Sem descrição, só grava (as janelas de um instrutor, por exemplo, não entram no histórico); com
// uma lista, registra uma entrada por item (a importação da Agenda, um aluno por entrada). Quem só consulta não grava, e
// nada é gravado antes de a escala abrir. Responde se gravou.
// { resultado }: a alteração de um voo na escala aprovada, sem o motor (F1g): a escala que ela deixou é gravada como
// está. Só vale na data aprovada, para a escala da data aberta e no formato da escala gravada (normalizarEscalaGravada);
// fora disso nada é gravado, S volta como estava (foto: o dia antes da alteração, fotoDaEscalaTravada) e a escala da tela
// também
export function gravarAlteracao(tipo, descricao, reverter = null, reverte = null, { resultado = null, foto = null } = {}) {
  if (isGestor() || aindaNaoAbriu()) return false;
  if (resultado) {
    const escala = S.aprovacao && resultado.data === DATA ? normalizarEscalaGravada(resultado) : null;
    if (!escala) {
      if (foto) setS(foto.S);
      showToast('A alteração não pôde ser gravada; recarregue a página.');
      redesenhar('escala');
      return false;
    }
    save(escala);
  } else save();
  for (const texto of Array.isArray(descricao) ? descricao : [descricao]) {
    if (texto) logChange(tipo, texto, reverter, reverte);
  }
  return true;
}

// A escala aprovada não é refeita por uma alteração de voo feita na Escala (o editor, o instrutor, o status, o "✕", as
// Sugestões, o agendamento e as reversões deles): antes de mudar S, a foto do dia (para voltar se a gravação for
// recusada), o estado que fez a escala da tela (para ligar as recusas aos pedidos) e a data. Fora da escala aprovada, null
export function fotoDaEscalaTravada() {
  if (!S.aprovacao || !RES) return null;
  return { S: structuredClone(S), estado: structuredClone(estadoDaEscala()), data: DATA };
}

// Grava uma alteração de voo feita na Escala. Com a foto (a escala aprovada), sem o motor: a escala da tela conferida de
// novo (js/edicao-do-voo.js); o pedido que entra no dia (sem pino, linha nem recusa) pede o motor, em volta dos voos
// fixos (R5). Sem a foto, como as outras alterações (o motor refaz a escala). recusas: as que a reversão devolve
export function gravarNaEscala(foto, tipo, descricao, reverter = null, reverte = null, { recusas = [] } = {}) {
  if (!foto) return gravarAlteracao(tipo, descricao, reverter, reverte);
  const { resultado, motor } = escalaDaAlteracao(estadoDaEscala(), { ...RES, data: foto.data }, { aprovada: true, antes: foto.estado, recusas, motor: () => null });
  return gravarAlteracao(tipo, descricao, reverter, reverte, motor ? {} : { resultado, foto });
}

// Escala só calculada (data aberta ainda sem escala gravada): é gravada na primeira alteração ou quando é exportada
// (CSV ou PDF), para entrar no BI e nas horas e no rodízio da data seguinte. Abrir uma data não grava nada
let escalaSoCalculada = false;
export function gravarEscalaCalculada() {
  if (escalaSoCalculada) save();
}

// A descrição de uma entrada do histórico tem até 500 caracteres, ao gravar e ao abrir
const LIMITE_DA_DESCRICAO = 500;
const textoAte = (texto, limite) => (texto === null || texto === undefined ? texto : String(texto).slice(0, limite));

// A entrada aparece na hora, "gravando…". Ela só vai para o servidor depois da gravação que leva a alteração (a que
// acabou de sair ou a que sai logo depois, no mesmo evento): uma alteração recusada não entra no histórico e fica
// "não gravada". O id (que permite reverter) chega quando o registro é gravado.
// reverte: id da entrada que esta alteração desfaz (ela deixa de aparecer no painel)
export function logChange(type, texto, revertAction = null, reverte = null) {
  if (isGestor() || !dadosLidos) return;
  const desc = textoAte(texto, LIMITE_DA_DESCRICAO);
  const entry = {
    id: null,
    ts: new Date().toTimeString().slice(0, 8),
    type,
    desc,
    revert: revertAction,
    reverte,
    autor: ApiClient.autorAtual,
    importado: false,
    estado: 'gravando'
  };
  AUDIT_LOG.unshift(entry);
  redesenharPorNome('historico');
  if (avisoAberto() === 'espera') avisarAlteracoesEsperando();
  const data = DATA;
  queueMicrotask(() => gravacaoAtual.then(async gravou => {
    // A alteração foi gravada: a entrada não é mais uma alteração perdida, mesmo esperando o registro no servidor
    if (gravou) entry.alteracaoGravada = true;
    const id = gravou ? await ApiClient.registrarHistorico(data, { tipo: type, descricao: desc, reverter: revertAction, reverte }) : null;
    if (id === null || id === undefined) entry.estado = 'nao-gravada';
    else {
      entry.id = id;
      delete entry.estado;
    }
    redesenharPorNome('historico');
  }));
}

// Entradas importadas mostram também o dia em que foram feitas: ficam todas numa data só, com o horário original
function horario(iso, importado) {
  const d = new Date(iso);
  const hora = d.toTimeString().slice(0, 8);
  return importado ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hora.slice(0, 5)}` : hora;
}

// Uma entrada que o servidor já registrou (os dados pessoais: a própria função registra os campos que mudaram)
export function mostrarNoHistorico({ id, descricao }) {
  AUDIT_LOG.unshift({ id, ts: new Date().toTimeString().slice(0, 8), type: 'mod', desc: descricao, revert: null, reverte: null, autor: ApiClient.autorAtual, importado: false });
  redesenharPorNome('historico');
}

async function historicoParaPainel(data) {
  return (await ApiClient.historicoDoDia(data)).map(e => ({
    id: e.id,
    ts: horario(e.registrado_em, e.importado),
    type: e.tipo,
    desc: textoAte(e.descricao, LIMITE_DA_DESCRICAO),
    revert: e.importado ? null : e.reverter,
    reverte: e.reverte,
    autor: textoAte(e.autor, LIMITE_DO_NOME),
    importado: e.importado
  }));
}

// A abertura do app prepara os dados antes de ler a primeira data (main.js: a conversão dos documentos antigos e a
// atualização do formato). Até lá nenhuma data é lida, e se a preparação falhar nenhuma abre: o cadastro que a
// conversão ainda não gravou viria vazio, e a primeira alteração gravaria esse cadastro vazio (a conversão ficaria por
// feita, sem os alunos e os instrutores de antes)
let liberarLeituras, recusarLeituras;
const dadosProntos = new Promise((resolve, reject) => { liberarLeituras = resolve; recusarLeituras = reject; });
dadosProntos.catch(() => {});
export function dadosPreparados(prontos = true) {
  if (prontos) liberarLeituras();
  else recusarLeituras(new Error('A abertura do app não preparou os dados.'));
}

// Lê os dados de uma data e os põe na tela (o estado, a escala e o histórico): a abertura do app e as trocas de data.
// Enquanto ela abre nada é gravado. As leituras saem uma de cada vez, na ordem pedida: cada leitura do cadastro e do dia
// guarda a versão que a gravação seguinte leva (js/backends/supabase.js), e a resposta de uma leitura que ficou para trás
// chegando depois da mais nova deixaria valendo a versão dela com os dados da mais nova na tela (a gravação passaria por
// cima, sem conflito, do que outra pessoa mudou entre as duas). A troca que ficou para trás antes de começar a ler nem
// lê; a que ficou para trás lendo só vai para a tela se for da data aberta (a da abertura do app, quando outra data foi
// escolhida enquanto ela lia), e aí nada é gravado até a mais nova chegar. Responde se os dados foram para a tela
let pedidoDeData = 0;
let leituraAnterior = Promise.resolve();
export async function lerData(data) {
  const pedido = ++pedidoDeData;
  dadosLidos = false;
  const anterior = leituraAnterior;
  let terminou;
  leituraAnterior = new Promise(resolve => { terminou = resolve; });
  try {
    await dadosProntos;
    await anterior;
    if (pedido !== pedidoDeData) return false;
    const { estado, escala, horasBase, horasDosInstrutores, resultados, programa, indisponiveis } = await ApiClient.carregarDia(data);
    const historico = await historicoParaPainel(data);
    const maisNova = pedido === pedidoDeData;
    if (!maisNova && data !== DATA) return false;
    abrirData(data);
    // O programa dos cursos (as tabelas dos cursos) e o que não foi lido dele ('cursos', ou 'cursos-pendentes' esperando a
    // conversão) chegam com os dados da data: até eles, nada grava, também o programa
    setS({ ...estado, horasBase, horasDosInstrutores, resultados, programa, indisponiveis });
    avisarDadosIndisponiveis();
    // Data sem escala gravada (por exemplo, uma data nova, copiada da anterior): a escala calculada aparece na hora
    // e é gravada junto com a primeira alteração
    setRES(escala ? comOsMotivosDaTela(escala) : escalaCalculada());
    escalaSoCalculada = !escala;
    setAuditLog(historico);
    dadosLidos = maisNova;
    return true;
  } finally {
    terminou();
  }
}

// Abre a escala de outra data. As abas são refeitas com os dados dela, também a do Rodízio: aberta, ela mostraria as
// filas da data anterior, e o clique agiria sobre uma fila que a pessoa não está vendo. A data está aberta com os dados na
// tela: os pedidos dela e o BI do período chegam depois, sem segurar quem a abriu
export async function carregarData(data) {
  if (!await lerData(data)) return;
  $('#escala-atualizada').hidden = true;
  redesenhar('dados');
  lerPedidosDaData();
  carregarBI();
}

// BI das escalas guardadas no mês da data base (e nos 7 dias até ela), com a escala da tela já incluída.
// Sem conexão, o BI continua como estava
let pedidoDeBI = 0;
export async function carregarBI() {
  const ref = $('#bi-dt').value || DATA;
  const inicioMes = ref.slice(0, 8) + '01';
  const inicioSemana = somarDias(ref, -6);
  const pedido = ++pedidoDeBI;
  let bi;
  try {
    bi = await ApiClient.biDoPeriodo(inicioSemana < inicioMes ? inicioSemana : inicioMes, fimDoMes(ref));
  } catch {
    return;
  }
  if (pedido !== pedidoDeBI) return;
  setBIHistory(bi);
  syncBIHistoryForCurrentDate();
  redesenharPorNome('bi');
}

// O BI em memória acompanha a escala da tela (que pode ainda estar sendo gravada)
function syncBIHistoryForCurrentDate() {
  if (ApiClient.readOnly) return;
  if (!DATA) return;
  if (RES) {
    BI_HISTORY[DATA] = {
      out: RES.out.map(o => ({ ...o })),
      tot: RES.tot,
      rej: RES.al.filter(a => a.t === 'err').length
    };
  } else {
    delete BI_HISTORY[DATA];
  }
}

// Escala da data calculada a partir dos dados da tela (sem os inativos do cadastro, de hoje em diante: estadoDaEscala). Ela
// guarda a data para a qual foi feita (no modo compartilhado, todos veem essa data). Os motivos são os da tela
// (escalaDoMotor, como os da escala gravada)
const escalaCalculada = () => ({ ...escalaDoMotor(estadoDaEscala()), data: DATA });

