// Servidor Supabase falso para os testes E2E, atendido por rotas do Playwright (sem rede).
// Segue o contrato do banco real (supabase/tests/database): login por e-mail e senha, perfil por conta,
// documentos e escalas por data com versão (salvar_documento e salvar_dia respondem 409 / PT409 em conflito e
// 403 sem perfil de operador), histórico que só cresce (registrar_historico e importar_historico) e o programa dos
// cursos nas tabelas (programa_dos_cursos, salvar_curso e importar_cursos, com as regras da gravação de js/programa.js,
// as mesmas do modo local). Este arquivo é o roteador; a agenda e os dados pessoais ficam em test/e2e/falso/.
import { createHash } from 'node:crypto';
import { separar } from '../../js/dias.js';
import { migrarCadastro, migrarDia } from '../../js/migracoes.js';
import { criarAgenda, FUNCOES_DA_AGENDA } from './falso/agenda.js';
import { criarDadosPessoais, veDadosPessoais } from './falso/dados-pessoais.js';
import { quadroDoDia } from '../../js/quadro.js';
import { acumularHoras } from '../../js/limites.js';
import { situacaoPorMissao, validarRegistro } from '../../js/resultados.js';
import { normalizarCursos } from '../../js/cursos.js';
import { cursosIniciais, gravarCurso, importarProgramas, programaComResultados, programaDoLegado } from '../../js/programa.js';

export const URL_TESTE = 'https://acpm-teste.supabase.invalid';

export const CONTAS = {
  operador: { email: 'operador@teste.acpm', senha: 'senha-do-operador', id: '00000000-0000-4000-a000-000000000001', perfil: 'operador', nome: 'Operador de Teste' },
  gestor: { email: 'gestor@teste.acpm', senha: 'senha-do-gestor', id: '00000000-0000-4000-a000-000000000002', perfil: 'gestor', nome: 'Gestor de Teste' },
  semPerfil: { email: 'sem-perfil@teste.acpm', senha: 'senha-sem-perfil', id: '00000000-0000-4000-a000-000000000003', perfil: null, nome: '' },
  secretaria: { email: 'secretaria@teste.acpm', senha: 'senha-da-secretaria', id: '00000000-0000-4000-a000-000000000004', perfil: 'secretaria', nome: 'Secretaria de Teste' },
  administrador: { email: 'admin@teste.acpm', senha: 'senha-do-administrador', id: '00000000-0000-4000-a000-000000000005', perfil: 'administrador', nome: 'Admin de Teste' },
  painel: { email: 'tv@teste.acpm', senha: 'senha-da-tv', id: '00000000-0000-4000-a000-000000000006', perfil: 'painel', nome: 'TV da recepção' }
};

// Documentos no formato por data mais antigo (sem a versão do formato) a partir de um estado da aplicação
export function documentosFase3(estado, data) {
  // A frota só fica no cadastro do formato 11 em diante
  const { cadastro: { frota, ...cadastro }, dia } = separar(estado);
  return { documentos: { cadastro }, dias: { [data]: { ...dia, resultado: null } } };
}

// O relógio do servidor, o mesmo instante do relógio fixo das páginas (AGORA, em test/e2e/fixtures.js)
const RELOGIO_DAS_PAGINAS = '2026-11-10T12:00:00-03:00';

// O id (uuid) de uma fase ou de uma missão do programa trazido do cadastro, tirado da sigla e do código (a fase única
// do curso usa o nome dela, "Programa"): o mesmo estado dá sempre os mesmos ids
const idDoLegado = (sigla, codigo) => {
  const h = createHash('sha1').update(`${sigla}:${codigo}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

// O programa guardado no cadastro (os cursos do estado) como o banco fica depois da conversão única (importar_cursos,
// pela mesma regra: importarProgramas), feita pelo operador de teste no relógio das páginas: o programa de cada curso
// (programaDoLegado de normalizarCursos, com os ids tirados da sigla e do código) entra no lugar do dos cursos com que o
// banco começa. O curso com missões fica numa fase só, "Programa", na versão 2, com a versão registrada da conversão; o
// curso sem missões é igual ao do começo e fica como estava (sem fases, na versão 1). No formato de programa_dos_cursos:
// as alterações de cada curso, a mais recente primeiro
function programaConvertido(cursosDoCadastro) {
  const { cursos, alteracoes } = importarProgramas({ cursos: cursosIniciais(), cadastro: null }, {
    programas: programaDoLegado(normalizarCursos(cursosDoCadastro), idDoLegado), versaoDoCadastro: 0, autor: CONTAS.operador.nome,
    agora: new Date(RELOGIO_DAS_PAGINAS).toISOString()
  });
  return cursos.map(c => ({ ...c, alteracoes: alteracoes.filter(a => a.curso === c.sigla).reverse().map(({ curso, ...a }) => a) }));
}

// Os mesmos documentos no formato atual (o que o app grava hoje), com a frota do estado (ou a inicial), e o programa do
// cadastro já nas tabelas dos cursos, como a conversão única deixa (cursos). Com o cadastro no formato atual, o app não
// faz a conversão: sem o programa nas tabelas, ficaria sem programa nenhum
export function documentosAtuais(estado, data) {
  const { cadastro, dia } = separar(estado);
  return {
    documentos: { cadastro: migrarCadastro(cadastro) },
    dias: { [data]: migrarDia({ ...dia, resultado: null }) },
    cursos: programaConvertido(estado.cursos)
  };
}

const base64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const usuario = (conta, email = conta.email) => ({
  id: conta.id, aud: 'authenticated', role: 'authenticated', email,
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
  created_at: '2026-11-10T12:00:00Z', updated_at: '2026-11-10T12:00:00Z'
});

// Filtros do PostgREST usados pelo app: coluna=eq.x, gte.x, lte.x, lt.x; order=coluna.asc|desc; limit=n
function consultar(linhas, url) {
  const operadores = { eq: (a, b) => a === b, gte: (a, b) => a >= b, lte: (a, b) => a <= b, lt: (a, b) => a < b };
  let resultado = linhas;
  for (const [coluna, valor] of url.searchParams) {
    if (['select', 'order', 'limit'].includes(coluna)) continue;
    const [op, ...resto] = valor.split('.');
    const alvo = resto.join('.');
    resultado = resultado.filter(l => operadores[op](String(l[coluna]), alvo));
  }
  const ordem = url.searchParams.get('order');
  if (ordem) {
    const criterios = ordem.split(',').map(c => c.split('.'));
    const comparar = (a, b, [coluna, sentido]) => (a[coluna] < b[coluna] ? -1 : a[coluna] > b[coluna] ? 1 : 0) * (sentido === 'desc' ? -1 : 1);
    resultado = [...resultado].sort((a, b) => criterios.reduce((r, c) => r || comparar(a, b, c), 0));
  }
  // Como no Supabase, uma consulta devolve no máximo 1000 linhas
  const limite = Math.min(Number(url.searchParams.get('limit') || LINHAS_POR_CONSULTA), LINHAS_POR_CONSULTA);
  return resultado.slice(0, limite);
}
const LINHAS_POR_CONSULTA = 1000;

// O METAR e o TAF que a função meteorologia entrega (supabase/functions/meteorologia), no relógio das páginas (10/11/2026
// 12:00 em São Paulo, 15:00Z): Pampulha observado às 14:00Z, sem TAF em vigor (o caso do aviso), e Confins às 15:00Z,
// com o TAF em grupos (as mensagens de 20/11/2026, com a data trocada)
export const METEOROLOGIA_DE_TESTE = {
  gerado: '2026-11-10T15:00:00.000Z',
  estacoes: [
    { icao: 'SBBH', nome: 'Pampulha', metar: 'METAR SBBH 101400Z 30005KT 9999 BKN025 FEW035TCU SCT090 26/16 Q1017', taf: null, observado: '2026-11-10T14:00:00.000Z' },
    {
      icao: 'SBCF', nome: 'Confins', metar: 'METAR SBCF 101500Z 36007KT 9999 BKN023 SCT100 27/22 Q1016',
      taf: 'TAF SBCF 100800Z 1012/1112 34005KT 7000 SCT016 TX28/1018Z TN19/1109Z BECMG 1015/1017 9999 SCT035 TEMPO 1018/1021 TS SCT035 FEW040CB PROB30 1107/1111 2000 BR SCT002 RMK PGM',
      observado: '2026-11-10T15:00:00.000Z'
    }
  ]
};

// A configuração do painel que painel_do_dia entrega (migração 20261120150000_painel_do_dia_com_a_configuracao.sql): o
// campo "painel" do cadastro, só no formato do app (o quadro da lista; as colunas conhecidas, uma vez, com "on"
// booleano; as listas 'auto', 'uma' ou 'duas'); sem ela, null. O quadro e as listas fora da lista saem (o null que o
// jsonb_strip_nulls tira)
const QUADROS_DO_PAINEL = ['missoes', 'alternar', 'partidas', 'chegadas'];
const COLUNAS_DO_PAINEL = ['horario', 'aeronave', 'modelo', 'aluno', 'instrutor', 'missao', 'previsto', 'observacao'];
const LISTAS_DO_PAINEL = ['auto', 'uma', 'duas'];
function painelDoCadastro(cadastro) {
  const guardado = cadastro && cadastro.painel;
  if (!guardado || typeof guardado !== 'object' || Array.isArray(guardado)) return null;
  const vistas = new Set();
  const colunas = (Array.isArray(guardado.colunas) ? guardado.colunas : [])
    .filter(c => c && typeof c === 'object' && !Array.isArray(c) && COLUNAS_DO_PAINEL.includes(c.id) && !vistas.has(c.id) && vistas.add(c.id))
    .map(c => ({ id: c.id, on: c.on === true }));
  return {
    ...(QUADROS_DO_PAINEL.includes(guardado.quadro) ? { quadro: guardado.quadro } : {}),
    ...(LISTAS_DO_PAINEL.includes(guardado.listas) ? { listas: guardado.listas } : {}),
    colunas
  };
}

// Um servidor pode atender vários contextos do navegador (ex.: operador e gestor vendo os mesmos dados)
// agora: o relógio do servidor para o prazo da agenda (o mesmo instante do relógio fixo das páginas)
// cursos: o programa dos cursos nas tabelas, no formato de programa_dos_cursos (sem comResultados, que vem dos
// resultados; as alteracoes de cada curso, a mais recente primeiro, são as versões registradas dele, e podem faltar);
// sem ele, os cursos com que o banco começa (PP, PC e INVA, vazios)
// meteorologia: o que a função meteorologia entrega; null: a função não foi publicada (404 do Supabase)
// painelDoDiaAntigo: o painel_do_dia de antes da migração 20261120150000 (sem a configuração do painel)
// agendaSemRecurso: a agenda de antes da migração 20261125230000 (registrar_solicitacao sem o recurso)
// validadeDaSessao: quantos segundos a sessão vale, no relógio da página (o Auth manda só o expires_in, e o supabase-js
// conta do relógio dele); sem ela, a sessão vale até bem depois do relógio fixo das páginas
export function criarSupabaseFalso({ documentos = {}, dias = {}, historico: historicoInicial = [], cursos: cursosGuardados = cursosIniciais(), agora = new Date(RELOGIO_DAS_PAGINAS), nomes = {}, meteorologia: meteorologiaInicial = METEOROLOGIA_DE_TESTE, painelDoDiaAntigo = false, agendaSemRecurso = false, validadeDaSessao = null } = {}) {
  const banco = new Map(Object.entries(documentos).map(([chave, conteudo]) => [chave, { conteudo, versao: 1 }]));
  const tabelaDias = new Map(Object.entries(dias).map(([data, conteudo]) => [data, { conteudo, versao: 1 }]));
  // As entradas do histórico já gravadas (no formato da tabela historico)
  const historico = historicoInicial.map(h => ({ ...h }));
  // A agenda (as solicitações) e os dados pessoais: test/e2e/falso/
  const agenda = criarAgenda({ agora, semRecurso: agendaSemRecurso });
  const { solicitacoes } = agenda;
  const pessoais = criarDadosPessoais({ agora, historico, cadastro: () => banco.get('cadastro') });
  const { dadosPessoais } = pessoais;
  // Resultados das missões dos cursos: só acréscimo
  const resultados = [];
  // O programa dos cursos (cursos, fases e missões), com o padrão das colunas no que faltar (ordem 0, ativo, versão 1;
  // sem fases nem missões), e as versões registradas de cada curso ({ curso, versao, descricao, registrado_em,
  // registrado_por }), na ordem. As regras da gravação devolvem a lista nova: cada gravação troca a lista inteira
  const iniciais = structuredClone(cursosGuardados);
  let cursos = iniciais.map(({ alteracoes, ...c }) => ({ ordem: 0, ativo: true, versao: 1, fases: [], missoes: [], ...c }));
  const alteracoesDosCursos = iniciais.flatMap(c => (Array.isArray(c.alteracoes) ? [...c.alteracoes].reverse() : []).map(a => ({ curso: c.sigla, ...a })));
  let gravacoesDosCursos = 0;
  const sessoes = new Map();
  // Contas criadas pelo administrador, senhas e e-mails trocados e pedidos de troca de e-mail (só neste servidor)
  const contasCriadas = [];
  const senhas = new Map();
  const emails = new Map();
  const trocasDeEmail = [];
  const todasAsContas = () => [...Object.values(CONTAS), ...contasCriadas];
  const senhaDe = c => (senhas.has(c.id) ? senhas.get(c.id) : c.senha);
  const emailDe = c => (emails.has(c.id) ? emails.get(c.id) : c.email);
  const exp = () => Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;  // longe no futuro: o relógio da página é fixo
  // Cada token de sessão (JWT) é único (o número no fim), e o último de cada conta fica anotado
  let tokensEmitidos = 0;
  const ultimoToken = new Map();
  const emitirToken = conta => {
    const token = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: conta.id, email: emailDe(conta), role: 'authenticated', aud: 'authenticated', exp: exp(), n: ++tokensEmitidos })}.assinatura`;
    sessoes.set(token, conta);
    ultimoToken.set(conta.id, token);
    return token;
  };
  // Os refresh tokens: cada um vale uma vez (a renovação troca os dois tokens) e sai com o logout da sessão dele ou com
  // a revogação. renovacoes: os pedidos de renovação (o perfil e se foi aceito)
  const renovaveis = new Map();
  const renovacaoDoToken = new Map();
  const renovacoes = [];
  const emitirRenovacao = (conta, token) => {
    const renovacao = `renovar-${conta.id}-${tokensEmitidos}`;
    renovaveis.set(renovacao, conta);
    renovacaoDoToken.set(token, renovacao);
    return renovacao;
  };
  // A sessão que o Auth devolve no login e na renovação
  const novaSessao = conta => {
    const token = emitirToken(conta);
    return {
      access_token: token, token_type: 'bearer', expires_in: validadeDaSessao || 3600, ...(validadeDaSessao ? {} : { expires_at: exp() }),
      refresh_token: emitirRenovacao(conta, token), user: usuario(conta, emailDe(conta))
    };
  };
  const gravacoes = [];
  const saidas = [];
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  let falhasDeGravacao = 0;
  let statusDaFalha = 503;
  let leiturasDeDiasSeguras = null;
  let gravacoesSeguras = null;
  let desconectado = false;
  const seguradas = new Map();
  const falhas = new Map();
  let meteorologia = meteorologiaInicial;
  const chamadasDaMeteorologia = [];

  // Versão do formato do conteúdo (campo esquema); o servidor não aceita voltar a um formato mais antigo
  const esquema = conteudo => (conteudo && typeof conteudo.esquema === 'number' ? Math.floor(conteudo.esquema) : 0);
  const STATUS = ['Pendente', 'Confirmado', 'Atrasado', 'Em Voo', 'Cancelado', 'Pousou'];
  const statusValidos = conteudo => !conteudo || !Object.hasOwn(conteudo, 'fStatus') || (conteudo.fStatus && typeof conteudo.fStatus === 'object' &&
    !Array.isArray(conteudo.fStatus) && Object.entries(conteudo.fStatus).every(([fKey, st]) => /^\d+_\d+_\d+$/.test(fKey) && STATUS.includes(st)));
  const salvar = (mapa, chave, conteudo, versaoLida, { formatoMinimo = 0 } = {}) => {
    const atual = mapa.get(chave);
    if (esquema(conteudo) < Math.max(atual ? esquema(atual.conteudo) : 0, formatoMinimo)) {
      return [409, { code: 'PT409', message: `${chave} está num formato mais antigo que o dos dados; recarregue a página`, hint: 'formato' }];
    }
    const versaoAtual = atual ? atual.versao : 0;
    if (versaoLida !== versaoAtual) return [409, { code: 'PT409', message: `${chave} foi alterado por outra pessoa` }];
    mapa.set(chave, { conteudo, versao: versaoAtual + 1 });
    return [200, versaoAtual + 1];
  };
  // O que as regras da gravação dos cursos conferem (gravarCurso e importarProgramas, de js/programa.js), como no banco:
  // os cursos guardados, os resultados (o código com resultados não muda) e o cadastro (o formato e a versão dele, ou
  // null sem cadastro). Com o cadastro antes do formato dos cursos (FORMATO_DOS_CURSOS, de js/migracoes.js), salvar_curso
  // espera a conversão; dele em diante, importar_cursos não grava mais nada
  const estadoDosCursos = () => {
    const cadastro = banco.get('cadastro');
    return { cursos, resultados, cadastro: cadastro ? { esquema: esquema(cadastro.conteudo), versao: cadastro.versao } : null };
  };
  // Quem grava nos cursos, como o banco registra (o nome do perfil, senão o e-mail), e quando: no relógio das páginas,
  // um instante depois a cada gravação
  const autorNosCursos = c => nomes[c.id] || c.nome || emailDe(c);
  const agoraNosCursos = () => new Date(agora.getTime() + gravacoesDosCursos++).toISOString();

  const atender = async route => {
    const req = route.request();
    const url = new URL(req.url());
    const responder = (status, corpo) => route.fulfill({
      status, headers: { ...cors, 'Content-Type': 'application/json' }, body: corpo === undefined ? '' : JSON.stringify(corpo)
    });
    // A recusa das regras dos cursos como o PostgREST manda: o status pelo código (PT409 e 23505: 409; P0002: 404;
    // 22023 e 23514: 400), a mensagem e a dica (o campo; null quando não há)
    const recusaDosCursos = e => responder({ PT409: 409, 23505: 409, P0002: 404 }[e.code] || 400, { code: e.code, message: e.message, hint: e.campo ?? null });
    if (desconectado) return route.abort('internetdisconnected');
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    for (const [caminho, espera] of seguradas) if (url.pathname.endsWith(caminho)) await espera;
    for (const [caminho, n] of falhas) {
      if (!url.pathname.endsWith(caminho) || n <= 0) continue;
      falhas.set(caminho, n - 1);
      return route.fulfill({ status: 503, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Service Unavailable' }) });
    }
    const portador = (req.headers().authorization || '').replace(/^Bearer /, '');
    const conta = sessoes.get(portador);
    // Um token de sessão (JWT) que o servidor não conhece mais: sessão expirada
    if (!conta && portador.split('.').length === 3 && url.pathname.startsWith('/rest/v1/')) {
      return route.fulfill({ status: 401, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'PGRST301', message: 'JWT expired' }) });
    }
    const comPerfil = conta && conta.perfil;
    const operador = conta && ['operador', 'administrador'].includes(conta.perfil);
    const veDados = veDadosPessoais(conta);
    // Os perfis da escala leem os documentos, os dias, o histórico e a agenda (a TV, perfil "painel", não)
    const leEscala = conta && ['operador', 'administrador', 'gestor', 'secretaria'].includes(conta.perfil);

    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const { email, password } = req.postDataJSON();
      const alvo = todasAsContas().find(c => emailDe(c) === email && senhaDe(c) === password);
      if (!alvo) return responder(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return responder(200, novaSessao(alvo));
    }
    // A renovação da sessão: o refresh token vale uma vez; revogado ou já usado, a recusa do Auth
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const { refresh_token: renovacao } = req.postDataJSON();
      const alvo = renovaveis.get(renovacao);
      renovacoes.push({ perfil: alvo ? alvo.perfil : null, aceita: Boolean(alvo) });
      if (!alvo) return responder(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
      renovaveis.delete(renovacao);
      return responder(200, novaSessao(alvo));
    }
    if (url.pathname === '/auth/v1/user') {
      if (!conta) return responder(401, { code: 401, msg: 'invalid JWT' });
      if (req.method() !== 'PUT') return responder(200, usuario(conta, emailDe(conta)));
      // Minha conta: senha nova vale na hora; e-mail novo fica pendente até a confirmação pelos links
      const { password, email } = req.postDataJSON();
      if (password !== undefined) {
        if (password.length < 12) return responder(422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 12 characters.' });
        senhas.set(conta.id, password);
      }
      if (email !== undefined) trocasDeEmail.push({ de: emailDe(conta), para: email, redirecionar: url.searchParams.get('redirect_to') });
      return responder(200, { ...usuario(conta, emailDe(conta)), ...(email !== undefined ? { new_email: email } : {}) });
    }
    // A função meteorologia (Edge Function): só com a sessão de uma conta (o gateway confere o JWT); sem a função
    // publicada, o 404 do Supabase
    if (url.pathname === '/functions/v1/meteorologia') {
      chamadasDaMeteorologia.push({ metodo: req.method(), conta: conta ? conta.perfil : null });
      if (meteorologia === null) return responder(404, { code: 'NOT_FOUND', message: 'Requested function was not found' });
      if (!conta) return responder(401, { code: 401, message: 'Invalid JWT' });
      return responder(200, meteorologia);
    }
    if (url.pathname === '/auth/v1/logout') {
      saidas.push(url.searchParams.get('scope'));
      const saiu = (req.headers().authorization || '').replace(/^Bearer /, '');
      sessoes.delete(saiu);
      renovaveis.delete(renovacaoDoToken.get(saiu));
      return route.fulfill({ status: 204, headers: cors });
    }

    if (req.method() === 'GET') {
      if (url.pathname === '/rest/v1/perfis') return responder(200, comPerfil ? [{ perfil: conta.perfil, nome: nomes[conta.id] || conta.nome }] : []);
      if (!comPerfil) return responder(200, []);
      if (!leEscala && ['/rest/v1/documentos', '/rest/v1/dias', '/rest/v1/historico', '/rest/v1/solicitacoes'].includes(url.pathname)) return responder(200, []);
      if (url.pathname === '/rest/v1/documentos') {
        return responder(200, consultar([...banco].map(([chave, d]) => ({ chave, ...d })), url).map(({ conteudo, versao }) => ({ conteudo, versao })));
      }
      if (url.pathname === '/rest/v1/dias') {
        await leiturasDeDiasSeguras;
        return responder(200, consultar([...tabelaDias].map(([data, d]) => ({ data, ...d })), url));
      }
      if (url.pathname === '/rest/v1/historico') return responder(200, consultar(historico, url));
      if (url.pathname === '/rest/v1/solicitacoes') return responder(200, consultar(solicitacoes, url));
      if (url.pathname === '/rest/v1/resultados_de_missao') return responder(200, leEscala ? consultar(resultados, url) : []);
      if (url.pathname === '/rest/v1/dados_pessoais') {
        if (!veDados) return responder(200, []);
        return responder(200, consultar(pessoais.linhas(), url).map(({ tipo, ...linha }) => linha));
      }
    }

    if (req.method() === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')) {
      const funcao = url.pathname.slice('/rest/v1/rpc/'.length);
      const args = req.postDataJSON();
      if (funcao === 'salvar_documento' || funcao === 'salvar_dia') {
        await gravacoesSeguras;
        const chave = funcao === 'salvar_dia' ? `dia:${args.p_data}` : args.p_chave;
        gravacoes.push({ chave, versaoLida: args.p_versao_lida, por: conta && conta.email });
        if (falhasDeGravacao > 0) {
          falhasDeGravacao--;
          return responder(statusDaFalha, statusDaFalha === 503 ? { message: 'Service Unavailable' } : { code: '23514', message: 'conteúdo recusado' });
        }
      }
      // Contas: só o administrador lista, cria e exclui (ninguém exclui a própria conta)
      if (['listar_contas', 'criar_conta', 'excluir_conta'].includes(funcao)) {
        if (!conta || conta.perfil !== 'administrador') return responder(403, { code: '42501', message: 'somente administradores gerenciam contas' });
        if (funcao === 'listar_contas') {
          return responder(200, todasAsContas().map(c => ({ usuario: c.id, email: emailDe(c), nome: c.nome, perfil: c.perfil || null, criado_em: '2026-11-01T12:00:00Z', ultimo_acesso: null })));
        }
        if (funcao === 'criar_conta') {
          if ((args.p_senha || '').length < 12 || !(args.p_nome || '').trim()) return responder(400, { code: '22023', message: 'dados inválidos' });
          if (todasAsContas().some(c => emailDe(c) === args.p_email.trim().toLowerCase())) return responder(409, { code: '23505', message: 'já existe' });
          const nova = { email: args.p_email.trim().toLowerCase(), senha: args.p_senha, id: `00000000-0000-4000-b000-${String(contasCriadas.length + 1).padStart(12, '0')}`, perfil: args.p_perfil, nome: args.p_nome.trim() };
          contasCriadas.push(nova);
          return responder(200, nova.id);
        }
        if (args.p_usuario === conta.id) return responder(400, { code: '22023', message: 'não é possível excluir a própria conta' });
        const i = contasCriadas.findIndex(c => c.id === args.p_usuario);
        if (i < 0) return responder(404, { code: 'P0002', message: 'conta não encontrada' });
        contasCriadas.splice(i, 1);
        return responder(204);
      }

      // Agenda: test/e2e/falso/agenda.js
      if (FUNCOES_DA_AGENDA.includes(funcao)) return responder(...agenda.atender(funcao, args, conta));
      // As horas de voo de cada instrutor antes da data (limites da lei); quem não lê as escalas recebe vazio
      if (funcao === 'horas_dos_instrutores') {
        if (!leEscala) return responder(200, {});
        return responder(200, acumularHoras([...tabelaDias].map(([data, d]) => ({ data, conteudo: d.conteudo })), args.p_data));
      }
      // O quadro de hoje (São Paulo) para a TV da recepção: qualquer perfil vê
      if (funcao === 'painel_do_dia') {
        if (!comPerfil) return responder(403, { code: '42501', message: 'sem acesso ao painel' });
        const hoje = new Date(agora.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
        const dia = tabelaDias.get(hoje);
        const quadro = { data: hoje, ...quadroDoDia(dia ? dia.conteudo : null) };
        const cadastro = banco.get('cadastro');
        return responder(200, painelDoDiaAntigo ? quadro : { ...quadro, painel: painelDoCadastro(cadastro ? cadastro.conteudo : null) });
      }
      // A situação de cada missão (o último registro); quem não lê a escala recebe a lista vazia
      if (funcao === 'situacao_das_missoes') return responder(200, leEscala ? [...situacaoPorMissao(resultados).values()].map(({ id, ...r }) => r) : []);
      // Dados pessoais: test/e2e/falso/dados-pessoais.js
      if (funcao === 'salvar_dados_pessoais') return responder(...pessoais.salvar(args, conta));
      // O programa dos cursos: quem lê a escala lê todos os cursos num documento só (os outros perfis recebem a lista
      // vazia), com os códigos que já têm resultados e as últimas alterações de cada curso
      if (funcao === 'programa_dos_cursos') {
        return responder(200, leEscala ? programaComResultados({ cursos, resultados, alteracoes: alteracoesDosCursos }) : []);
      }
      // Só o Administrador grava o curso inteiro, a partir da versão lida (0 cria), com as regras do banco; antes do
      // formato dos cursos, espera a conversão (PT409, formato)
      if (funcao === 'salvar_curso') {
        if (!conta || conta.perfil !== 'administrador') return responder(403, { code: '42501', message: 'somente o Administrador altera os cursos' });
        try {
          const r = gravarCurso(estadoDosCursos(), {
            sigla: args.p_sigla, versaoLida: args.p_versao_lida, conteudo: args.p_curso, descricao: args.p_descricao, autor: autorNosCursos(conta), agora: agoraNosCursos()
          });
          cursos = r.cursos;
          alteracoesDosCursos.push(r.alteracao);
          return responder(200, r.retorno);
        } catch (e) {
          return recusaDosCursos(e);
        }
      }
      if (!operador) return responder(403, { code: '42501', message: 'somente operadores podem alterar a escala' });
      if (funcao === 'salvar_documento') {
        // Depois da conversão (o cadastro existe), os documentos da versão anterior do app ficam só como cópia
        if (args.p_chave !== 'cadastro' && banco.has('cadastro')) return responder(409, { code: 'PT409', message: `${args.p_chave} é da versão anterior do app`, hint: 'formato' });
        const resposta = salvar(banco, args.p_chave, args.p_conteudo, args.p_versao_lida);
        // Quem sai do cadastro leva os dados pessoais junto
        if (resposta[0] === 200 && args.p_chave === 'cadastro') pessoais.aposGravarCadastro(args.p_conteudo);
        return responder(...resposta);
      }
      if (funcao === 'salvar_dia') {
        // Um dia não nasce num formato mais antigo que o do cadastro, e só leva os status da lista
        const cadastro = banco.get('cadastro');
        if (!statusValidos(args.p_conteudo)) return responder(400, { code: '23514', message: 'status de voo fora da lista' });
        return responder(...salvar(tabelaDias, args.p_data, args.p_conteudo, args.p_versao_lida, { formatoMinimo: cadastro ? esquema(cadastro.conteudo) : 0 }));
      }
      if (funcao === 'dias_em_formato_antigo') {
        if (!operador) return responder(403, { code: '42501', message: 'somente operadores atualizam o formato dos dados' });
        return responder(200, [...tabelaDias].filter(([, d]) => esquema(d.conteudo) < args.p_esquema).map(([data]) => data).sort());
      }
      if (funcao === 'registrar_resultado') {
        try {
          // O curso tem de existir: um dos cursos das tabelas (o encerrado também)
          const r = validarRegistro({ aluno: args.p_aluno, curso: args.p_curso, missao: args.p_missao, resultado: args.p_resultado, data: args.p_data, voo: args.p_voo },
            { cursos: cursos.map(c => c.sigla) });
          resultados.push({ id: resultados.length + 1, ...r, registrado_em: new Date(Date.now() + resultados.length).toISOString(), registrado_por: conta.nome });
          return responder(200, resultados.length);
        } catch (e) {
          return responder(400, { code: e.code, message: e.message });
        }
      }
      // A conversão única do programa guardado no cadastro (importarProgramas): com o cadastro já no formato dos cursos,
      // nada (0, nunca mais); com o cadastro alterado depois da leitura, PT409. Não é uma gravação de documento: não entra
      // em gravacoes
      if (funcao === 'importar_cursos') {
        try {
          const r = importarProgramas(estadoDosCursos(), {
            programas: args.p_cursos, versaoDoCadastro: args.p_versao_do_cadastro, autor: autorNosCursos(conta), agora: agoraNosCursos()
          });
          cursos = r.cursos;
          alteracoesDosCursos.push(...r.alteracoes);
          return responder(200, r.retorno);
        } catch (e) {
          return recusaDosCursos(e);
        }
      }
      if (funcao === 'registrar_historico') {
        const id = historico.length + 1;
        historico.push({ id, data: args.p_data, registrado_em: new Date(Date.now() + id).toISOString(), usuario: conta.id, autor: conta.nome,
          tipo: args.p_tipo, descricao: args.p_descricao, reverter: args.p_reverter ?? null, reverte: args.p_reverte ?? null, importado: false });
        return responder(200, id);
      }
      if (funcao === 'importar_historico') {
        if (historico.some(h => h.importado)) return responder(200, 0);
        for (const e of args.p_entradas) {
          historico.push({ id: historico.length + 1, data: args.p_data, registrado_em: e.registrado_em || new Date().toISOString(), usuario: null, autor: null,
            tipo: e.tipo, descricao: e.descricao, reverter: null, reverte: null, importado: true });
        }
        return responder(200, args.p_entradas.length);
      }
    }
    return responder(404, { message: `rota não simulada: ${req.method()} ${url.pathname}` });
  };

  return {
    banco,
    dias: tabelaDias,
    historico,
    solicitacoes,
    dadosPessoais,
    resultados,
    // O programa dos cursos como está agora nas tabelas (cada gravação troca a lista)
    get cursos() { return cursos; },
    contasCriadas,
    trocasDeEmail,
    senhaDe,
    gravacoes,
    saidas,
    instalar: context => context.route(`${URL_TESTE}/**`, atender),
    // Os dois links da última troca de e-mail abertos: o e-mail novo passa a valer e o Auth devolve o fragmento
    // com a sessão que acompanha a volta ao site (fluxo implícito do supabase-js)
    confirmarTrocaDeEmail() {
      const { de, para } = trocasDeEmail.at(-1);
      const conta = todasAsContas().find(c => emailDe(c) === de);
      emails.set(conta.id, para);
      const expira = Math.floor(agora.getTime() / 1000) + 3600;
      const token = emitirToken(conta);
      return `#access_token=${token}&expires_at=${expira}&expires_in=3600&refresh_token=${emitirRenovacao(conta, token)}&token_type=bearer&type=email_change`;
    },
    // Simula indisponibilidade do servidor nas próximas gravações
    // (503: fora do ar, o app tenta de novo; 400: recusa definitiva)
    falharGravacoes(n, status = 503) { falhasDeGravacao = n; statusDaFalha = status; },
    // As próximas n requisições a um caminho recebem 503 (servidor fora do ar)
    falhar(caminho, n = 1) { falhas.set(caminho, n); },
    // Segura as requisições a um caminho (ex.: '/rpc/registrar_resultado') até chamar a função devolvida
    segurar(caminho) {
      let liberar;
      seguradas.set(caminho, new Promise(resolve => { liberar = resolve; }));
      return () => { seguradas.delete(caminho); liberar(); };
    },
    // A função meteorologia: as chamadas (o método e o perfil de quem chamou) e o que ela passa a entregar (null: sem a
    // função publicada)
    chamadasDaMeteorologia,
    trocarMeteorologia(dados) { meteorologia = dados; },
    // As sessões abertas expiram (quem estava conectado precisa entrar de novo, ou renovar a sessão)
    expirarSessoes() { sessoes.clear(); },
    // Só o último token de sessão de cada conta continua valendo (os anteriores expiraram)
    expirarTokensAnteriores() {
      const ultimos = new Set(ultimoToken.values());
      for (const token of [...sessoes.keys()]) if (!ultimos.has(token)) sessoes.delete(token);
    },
    // As sessões abertas são revogadas: os tokens e os refresh tokens deixam de valer (só o login volta)
    revogarSessoes() { sessoes.clear(); renovaveis.clear(); },
    // Os pedidos de renovação da sessão ({ perfil, aceita })
    renovacoes,
    // A senha da conta muda (fora deste navegador: o administrador, ou a pessoa em outro aparelho)
    trocarSenha(conta, senha) { senhas.set(conta.id, senha); },
    // Sem conexão: nenhuma requisição chega ao servidor até reconectar
    desconectar() { desconectado = true; },
    reconectar() { desconectado = false; },
    // Segura as gravações (do cadastro e dos dias) até chamar a função devolvida (uma gravação que demora)
    segurarGravacoes() {
      let liberar;
      gravacoesSeguras = new Promise(resolve => { liberar = resolve; });
      return () => { gravacoesSeguras = null; liberar(); };
    },
    // Segura as leituras da tabela dias até chamar a função devolvida (uma data que demora a carregar)
    segurarLeiturasDeDias() {
      let liberar;
      leiturasDeDiasSeguras = new Promise(resolve => { liberar = resolve; });
      return () => { leiturasDeDiasSeguras = null; liberar(); };
    },
    // Simula a gravação de outra pessoa (para testar conflitos)
    alterarPorOutraPessoa(chave, conteudo) {
      const atual = banco.get(chave);
      banco.set(chave, { conteudo, versao: (atual ? atual.versao : 0) + 1 });
    },
    alterarDiaPorOutraPessoa(data, conteudo) {
      const atual = tabelaDias.get(data);
      tabelaDias.set(data, { conteudo, versao: (atual ? atual.versao : 0) + 1 });
    }
  };
}

export async function instalarSupabaseFalso(context, opcoes) {
  const servidor = criarSupabaseFalso(opcoes);
  await servidor.instalar(context);
  return servidor;
}
