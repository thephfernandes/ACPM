// Servidor Supabase falso para os testes E2E, atendido por rotas do Playwright (sem rede).
// Segue o contrato do banco real (supabase/tests/database): login por e-mail e senha, perfil por conta,
// documentos e escalas por data com versão (salvar_documento e salvar_dia respondem 409 / PT409 em conflito e
// 403 sem perfil de operador) e histórico que só cresce (registrar_historico e importar_historico).
import { separar } from '../../js/dias.js';
import { migrarCadastro, migrarDia } from '../../js/migracoes.js';
import { prazoDaAgendaPermite } from '../../js/agenda.js';
import { gravarDadosPessoais, semQuemSaiu } from '../../js/dados-pessoais.js';
import { quadroDoDia } from '../../js/quadro.js';
import { acumularHoras } from '../../js/limites.js';
import { situacaoPorMissao, validarRegistro } from '../../js/resultados.js';

export const URL_TESTE = 'https://acpm-teste.supabase.invalid';

export const CONTAS = {
  operador: { email: 'operador@teste.acpm', senha: 'senha-do-operador', id: '00000000-0000-4000-a000-000000000001', perfil: 'operador', nome: 'Operador de Teste' },
  gestor: { email: 'gestor@teste.acpm', senha: 'senha-do-gestor', id: '00000000-0000-4000-a000-000000000002', perfil: 'gestor', nome: 'Gestor de Teste' },
  semPerfil: { email: 'sem-perfil@teste.acpm', senha: 'senha-sem-perfil', id: '00000000-0000-4000-a000-000000000003', perfil: null, nome: '' },
  secretaria: { email: 'secretaria@teste.acpm', senha: 'senha-da-secretaria', id: '00000000-0000-4000-a000-000000000004', perfil: 'secretaria', nome: 'Secretaria de Teste' },
  administrador: { email: 'admin@teste.acpm', senha: 'senha-do-administrador', id: '00000000-0000-4000-a000-000000000005', perfil: 'administrador', nome: 'Admin de Teste' },
  painel: { email: 'tv@teste.acpm', senha: 'senha-da-tv', id: '00000000-0000-4000-a000-000000000006', perfil: 'painel', nome: 'TV da recepção' }
};

// Documentos no formato por data da fase 3 (sem a versão do formato) a partir de um estado da aplicação
export function documentosFase3(estado, data) {
  // A frota só passou a ficar no cadastro no formato 11
  const { cadastro: { frota, ...cadastro }, dia } = separar(estado);
  return { documentos: { cadastro }, dias: { [data]: { ...dia, resultado: null } } };
}

// Os mesmos documentos no formato atual (o que o app grava hoje), com a frota do estado (ou a inicial)
export function documentosAtuais(estado, data) {
  const { cadastro, dia } = separar(estado);
  return { documentos: { cadastro: migrarCadastro(cadastro) }, dias: { [data]: migrarDia({ ...dia, resultado: null }) } };
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

// Um servidor pode atender vários contextos do navegador (ex.: operador e gestor vendo os mesmos dados)
// agora: o relógio do servidor para o prazo da agenda (o mesmo instante do relógio fixo das páginas)
export function criarSupabaseFalso({ documentos = {}, dias = {}, historico: historicoInicial = [], agora = new Date('2026-11-10T12:00:00-03:00') } = {}) {
  const banco = new Map(Object.entries(documentos).map(([chave, conteudo]) => [chave, { conteudo, versao: 1 }]));
  const tabelaDias = new Map(Object.entries(dias).map(([data, conteudo]) => [data, { conteudo, versao: 1 }]));
  // As entradas do histórico já gravadas (no formato da tabela historico)
  const historico = historicoInicial.map(h => ({ ...h }));
  const solicitacoes = [];
  // Dados pessoais ('aluno:1000' → campos, atualizado_em e atualizado_por): operadores e secretaria leem e gravam
  const dadosPessoais = new Map();
  // Resultados das missões dos cursos (fase 14): só acréscimo
  const resultados = [];
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
  const emitirToken = conta => {
    const token = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: conta.id, email: emailDe(conta), role: 'authenticated', aud: 'authenticated', exp: exp() })}.assinatura`;
    sessoes.set(token, conta);
    return token;
  };
  const gravacoes = [];
  const saidas = [];
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  let falhasDeGravacao = 0;
  let gravacoesDeDados = 0;
  let statusDaFalha = 503;
  let leiturasDeDiasSeguras = null;
  let gravacoesSeguras = null;
  let desconectado = false;
  const seguradas = new Map();
  const falhas = new Map();

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

  const atender = async route => {
    const req = route.request();
    const url = new URL(req.url());
    const responder = (status, corpo) => route.fulfill({
      status, headers: { ...cors, 'Content-Type': 'application/json' }, body: corpo === undefined ? '' : JSON.stringify(corpo)
    });
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
    const veDados = conta && ['operador', 'administrador', 'secretaria'].includes(conta.perfil);
    // Os perfis da escala leem os documentos, os dias, o histórico e a agenda (a TV, perfil "painel", não)
    const leEscala = conta && ['operador', 'administrador', 'gestor', 'secretaria'].includes(conta.perfil);

    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const { email, password } = req.postDataJSON();
      const alvo = todasAsContas().find(c => emailDe(c) === email && senhaDe(c) === password);
      if (!alvo) return responder(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      const token = emitirToken(alvo);
      return responder(200, { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp(), refresh_token: `renovar-${alvo.id}`, user: usuario(alvo, emailDe(alvo)) });
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
    if (url.pathname === '/auth/v1/logout') {
      saidas.push(url.searchParams.get('scope'));
      sessoes.delete((req.headers().authorization || '').replace(/^Bearer /, ''));
      return route.fulfill({ status: 204, headers: cors });
    }

    if (req.method() === 'GET') {
      if (url.pathname === '/rest/v1/perfis') return responder(200, comPerfil ? [{ perfil: conta.perfil, nome: conta.nome }] : []);
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
        const linhas = [...dadosPessoais].map(([chave, d]) => ({ tipo: chave.split(':')[0], id_cadastro: Number(chave.split(':')[1]), cpf: null, canac: null, nascimento: null, celular: null, email: null, ...d }));
        return responder(200, consultar(linhas, url).map(({ tipo, ...linha }) => linha));
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

      // Agenda: secretaria e operadores registram; fora do prazo, só operadores pela exceção da coordenação
      if (funcao === 'registrar_solicitacao' || funcao === 'cancelar_solicitacao') {
        if (!conta || !['secretaria', 'operador', 'administrador'].includes(conta.perfil)) return responder(403, { code: '42501', message: 'sem permissão na agenda' });
        if (funcao === 'cancelar_solicitacao') {
          const s = solicitacoes.find(x => x.id === args.p_id && !x.cancelada_em);
          if (!s) return responder(404, { code: 'P0002', message: 'pedido não encontrado' });
          Object.assign(s, { cancelada_em: agora.toISOString(), cancelada_por: args.p_cancelada_por.trim() });
          return responder(204);
        }
        const noPrazo = prazoDaAgendaPermite(args.p_data, agora);
        if (!noPrazo && !args.p_excecao) return responder(403, { code: 'PT403', message: 'prazo encerrado' });
        if (!noPrazo && !['operador', 'administrador'].includes(conta.perfil)) return responder(403, { code: '42501', message: 'exceção só para operadores' });
        const id = solicitacoes.length + 1;
        solicitacoes.push({
          id, data: args.p_data, aluno: args.p_aluno, aluno_nome: args.p_aluno_nome.trim(), missao: args.p_missao, janela: args.p_janela,
          horario: args.p_horario, observacao: (args.p_observacao || '').trim() || null, registrado_por: args.p_registrado_por.trim(),
          registrado_em: agora.toISOString(), usuario: conta.id, conta: conta.nome, excecao: !noPrazo, cancelada_em: null, cancelada_por: null
        });
        return responder(200, id);
      }
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
        return responder(200, { data: hoje, ...quadroDoDia(dia ? dia.conteudo : null) });
      }
      // A situação de cada missão (o último registro); quem não lê a escala recebe a lista vazia
      if (funcao === 'situacao_das_missoes') return responder(200, leEscala ? [...situacaoPorMissao(resultados).values()].map(({ id, ...r }) => r) : []);
      if (funcao === 'salvar_dados_pessoais') {
        if (!veDados) return responder(403, { code: '42501', message: 'somente operadores e a secretaria alteram dados pessoais' });
        try {
          const cadastro = banco.get('cadastro');
          // Cada gravação com a sua data (como o clock_timestamp do banco)
          const quando = new Date(agora.getTime() + gravacoesDeDados++).toISOString();
          const r = gravarDadosPessoais(Object.fromEntries(dadosPessoais), args.p_tipo, args.p_id, args.p_dados,
            { hoje: agora.toISOString().slice(0, 10), autor: conta.nome, agora: quando, atualizadoEmLido: args.p_atualizado_em, cadastro: cadastro && cadastro.conteudo });
          dadosPessoais.clear();
          Object.entries(r.tabela).forEach(([chave, d]) => dadosPessoais.set(chave, d));
          let entrada = null;
          if (r.descricao) {
            const id = historico.length + 1;
            historico.push({ id, data: args.p_data, registrado_em: quando, usuario: conta.id, autor: conta.nome, tipo: 'mod', descricao: r.descricao, reverter: null, reverte: null, importado: false });
            entrada = { id, descricao: r.descricao };
          }
          return responder(200, { atualizado_em: r.atualizado_em, atualizado_por: conta.nome, historico: entrada });
        } catch (e) {
          return responder({ 23505: 409, PT409: 409, P0002: 404 }[e.code] || 400, { code: e.code, message: e.message.replace(/\.$/, ''), hint: e.campo });
        }
      }
      if (!operador) return responder(403, { code: '42501', message: 'somente operadores podem alterar a escala' });
      if (funcao === 'salvar_documento') {
        // Depois da conversão (o cadastro existe), os documentos da fase 2 ficam só como cópia
        if (args.p_chave !== 'cadastro' && banco.has('cadastro')) return responder(409, { code: 'PT409', message: `${args.p_chave} é da versão anterior do app`, hint: 'formato' });
        const resposta = salvar(banco, args.p_chave, args.p_conteudo, args.p_versao_lida);
        // Quem sai do cadastro leva os dados pessoais junto
        if (resposta[0] === 200 && args.p_chave === 'cadastro') {
          const ficam = semQuemSaiu(Object.fromEntries(dadosPessoais), args.p_conteudo);
          for (const chave of [...dadosPessoais.keys()]) if (!Object.hasOwn(ficam, chave)) dadosPessoais.delete(chave);
        }
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
          const r = validarRegistro({ aluno: args.p_aluno, curso: args.p_curso, missao: args.p_missao, resultado: args.p_resultado, data: args.p_data, voo: args.p_voo });
          resultados.push({ id: resultados.length + 1, ...r, registrado_em: new Date(Date.now() + resultados.length).toISOString(), registrado_por: conta.nome });
          return responder(200, resultados.length);
        } catch (e) {
          return responder(400, { code: e.code, message: e.message });
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
      return `#access_token=${emitirToken(conta)}&expires_at=${expira}&expires_in=3600&refresh_token=renovar-${conta.id}&token_type=bearer&type=email_change`;
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
    // As sessões abertas expiram (quem estava conectado precisa entrar de novo)
    expirarSessoes() { sessoes.clear(); },
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
