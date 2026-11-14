// Backend Supabase: documentos compartilhados no banco, com controle de concorrência otimista (versão lida).
// cadastro (e os documentos da fase 2) ficam na tabela documentos e são gravados por salvar_documento;
// dia:AAAA-MM-DD fica na tabela dias e é gravado por salvar_dia. O histórico é a tabela historico.
// - Gravações do mesmo documento saem em série, sempre com o conteúdo mais recente
// - Se outra pessoa gravou antes (conflito), o backend para de gravar e avisa por aoConflito (formato: true quando a
//   recusa é pelo formato dos dados, de uma versão mais nova do app)
// - Sem conexão ou com o servidor fora do ar, a alteração não se perde: a gravação avisa por aoErro e tenta de novo
//   sozinha, esperando cada vez mais (e na hora em que a conexão volta); aoGravar avisa quando der certo. Uma recusa
//   definitiva (sem permissão, dado inválido) avisa por aoErro com definitivo: true e não tenta de novo
// - Sessão expirada (401): a alteração espera o novo login (aoSessaoExpirada devolve quando a pessoa entrou de novo) e é
//   gravada depois
const DOCUMENTO_DIA = /^dia:(\d{4}-\d{2}-\d{2})$/;

// Sem resposta (status 0), servidor fora do ar (5xx), tempo esgotado (408) ou muitas requisições (429): vale tentar de novo
const transitorio = status => !status || status === 408 || status === 429 || status >= 500;
// A espera antes de cada nova tentativa: 2 s, 4 s, 8 s… até 30 s; a volta da conexão encerra a espera
const esperaPadrao = tentativa => new Promise(resolve => {
  const fim = () => {
    clearTimeout(relogio);
    if (typeof removeEventListener === 'function') removeEventListener('online', fim);
    resolve();
  };
  const relogio = setTimeout(fim, Math.min(30000, 1000 * 2 ** tentativa));
  if (typeof addEventListener === 'function') addEventListener('online', fim);
});

const erroComCodigo = error => Object.assign(new Error(error.message), { code: error.code || String(error.status || '') });

export function criarBackendSupabase(cliente, { aoConflito = () => {}, aoErro = () => {}, aoGravar = () => {}, aoSessaoExpirada = null, esperar = esperaPadrao } = {}) {
  // A sessão expirou (401): espera o novo login, quando o app sabe pedir; senão, conta como recusa definitiva
  const sessaoExpirada = status => status === 401 && aoSessaoExpirada !== null;
  const versoes = {};
  const pendentes = {};
  const emAndamento = {};
  let registrando = 0;
  let bloqueado = false;

  // As leituras esperam as gravações em andamento deste navegador: nunca voltam a um conteúdo (ou versão) anterior
  const gravacoesConcluidas = () => Promise.allSettled(Object.values(emAndamento));

  async function enviar(documento) {
    let tentativa = 0;
    try {
      while (!bloqueado && Object.hasOwn(pendentes, documento)) {
        const conteudo = pendentes[documento];
        delete pendentes[documento];
        const dia = DOCUMENTO_DIA.exec(documento);
        const versaoLida = versoes[documento] ?? 0;
        const { data, error, status } = dia
          ? await cliente.rpc('salvar_dia', { p_data: dia[1], p_conteudo: conteudo, p_versao_lida: versaoLida })
          : await cliente.rpc('salvar_documento', { p_chave: documento, p_conteudo: conteudo, p_versao_lida: versaoLida });
        if (!error) {
          tentativa = 0;
          versoes[documento] = data;
          aoGravar(documento);
          continue;
        }
        if (error.code === 'PT409') {
          delete pendentes[documento];
          bloqueado = true;
          aoConflito(documento, { formato: error.hint === 'formato' });
          return false;
        }
        if (sessaoExpirada(status)) {
          if (!Object.hasOwn(pendentes, documento)) pendentes[documento] = conteudo;
          await aoSessaoExpirada();
          continue;
        }
        if (!transitorio(status)) {
          delete pendentes[documento];
          aoErro(error, documento, { definitivo: true });
          return false;
        }
        // Sem conexão: o conteúdo volta a esperar (se não chegou um mais recente) e a gravação tenta de novo
        if (!Object.hasOwn(pendentes, documento)) pendentes[documento] = conteudo;
        aoErro(error, documento, { definitivo: false });
        await esperar(++tentativa);
      }
      return !bloqueado;
    } finally {
      delete emAndamento[documento];
    }
  }

  async function conferirSenha(email, senha) {
    const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
    if (error) throw Object.assign(new Error('senha atual incorreta'), { code: 'senha_atual' });
  }

  return {
    async ler(documento) {
      await gravacoesConcluidas();
      const dia = DOCUMENTO_DIA.exec(documento);
      const consulta = dia
        ? cliente.from('dias').select('conteudo, versao').eq('data', dia[1])
        : cliente.from('documentos').select('conteudo, versao').eq('chave', documento);
      const { data, error } = await consulta.maybeSingle();
      if (error) throw new Error(error.message);
      versoes[documento] = data ? data.versao : 0;
      return data ? data.conteudo : null;
    },

    gravar(documento, conteudo) {
      if (bloqueado) return Promise.resolve(false);
      pendentes[documento] = conteudo;
      return (emAndamento[documento] ||= enviar(documento));
    },

    // Há alteração esperando para ser gravada (sendo enviada, ou esperando a conexão voltar)?
    temGravacoesPendentes() {
      return registrando > 0 || Object.keys(emAndamento).length > 0 || Object.keys(pendentes).length > 0;
    },

    async listarDias(de, ate) {
      await gravacoesConcluidas();
      const { data, error } = await cliente.from('dias').select('data, conteudo').gte('data', de).lte('data', ate).order('data');
      if (error) throw new Error(error.message);
      return data;
    },

    // As datas gravadas num formato anterior (a atualização do formato lê só essas)
    async diasEmFormatoAntigo(esquema) {
      const { data, error } = await cliente.rpc('dias_em_formato_antigo', { p_esquema: esquema });
      if (error) throw erroComCodigo(error);
      return data || [];
    },

    async diaAnterior(data) {
      await gravacoesConcluidas();
      const { data: anterior, error } = await cliente.from('dias').select('data, conteudo')
        .lt('data', data).order('data', { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return anterior;
    },

    // Depois de um conflito nada mais é registrado (a alteração não foi salva). Sem conexão, tenta de novo como as gravações
    async registrar({ data, tipo, descricao, reverter = null, reverte = null }) {
      registrando++;
      try {
        for (let tentativa = 1; !bloqueado; tentativa++) {
          const { data: id, error, status } = await cliente.rpc('registrar_historico', {
            p_data: data, p_tipo: tipo, p_descricao: descricao, p_reverter: reverter, p_reverte: reverte
          });
          if (!error) {
            aoGravar('historico');
            return id;
          }
          if (sessaoExpirada(status)) {
            await aoSessaoExpirada();
            continue;
          }
          aoErro(error, 'historico', { definitivo: !transitorio(status) });
          if (!transitorio(status)) return null;
          await esperar(tentativa);
        }
        return null;
      } finally {
        registrando--;
      }
    },

    async listarHistorico(data) {
      const { data: entradas, error } = await cliente.from('historico')
        .select('id, data, registrado_em, autor, tipo, descricao, reverter, reverte, importado')
        .eq('data', data).order('registrado_em', { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return entradas;
    },

    // Contas: só administradores (o servidor confere); o código do erro é repassado
    async listarContas() {
      const { data, error } = await cliente.rpc('listar_contas');
      if (error) throw erroComCodigo(error);
      return data;
    },

    async criarConta({ email, senha, perfil, nome }) {
      const { data, error } = await cliente.rpc('criar_conta', { p_email: email, p_senha: senha, p_perfil: perfil, p_nome: nome });
      if (error) throw erroComCodigo(error);
      return data;
    },

    async excluirConta(usuario) {
      const { error } = await cliente.rpc('excluir_conta', { p_usuario: usuario });
      if (error) throw erroComCodigo(error);
    },

    // Minha conta: confere a senha atual antes de trocar a senha ou o e-mail (o e-mail novo só vale depois de
    // confirmado pelos links que o Supabase manda para o e-mail atual e para o novo)
    async alterarSenha(email, atual, nova) {
      await conferirSenha(email, atual);
      const { error } = await cliente.auth.updateUser({ password: nova });
      if (error) throw erroComCodigo(error);
    },

    async alterarEmail(email, atual, novo, redirecionarPara) {
      await conferirSenha(email, atual);
      const { data, error } = await cliente.auth.updateUser({ email: novo }, { emailRedirectTo: redirecionarPara });
      if (error) throw erroComCodigo(error);
      return data.user;
    },

    // Agenda de solicitações: o servidor aplica o prazo das 13:00 e quem pode registrar (o código do erro é repassado)
    async listarSolicitacoes(de, ate) {
      const { data, error } = await cliente.from('solicitacoes').select('*').gte('data', de).lte('data', ate).order('data').order('registrado_em');
      if (error) throw new Error(error.message);
      return data;
    },

    async registrarSolicitacao({ data, aluno, aluno_nome, missao, janela, horario = null, observacao = null, registrado_por, excecao = false }) {
      const { data: id, error } = await cliente.rpc('registrar_solicitacao', {
        p_data: data, p_aluno: aluno, p_aluno_nome: aluno_nome, p_missao: missao, p_janela: janela, p_horario: horario,
        p_registrado_por: registrado_por, p_observacao: observacao, p_excecao: excecao
      });
      if (error) throw Object.assign(new Error(error.message), { code: error.code });
      return id;
    },

    async cancelarSolicitacao(id, por) {
      const { error } = await cliente.rpc('cancelar_solicitacao', { p_id: id, p_cancelada_por: por });
      if (error) throw Object.assign(new Error(error.message), { code: error.code });
    },

    // As horas de voo de cada instrutor antes da data (limites da lei): o servidor soma as escalas guardadas
    async horasDosInstrutores(data) {
      const { data: horas, error } = await cliente.rpc('horas_dos_instrutores', { p_data: data });
      if (error) throw erroComCodigo(error);
      return horas || {};
    },

    // Dados pessoais: o servidor decide quem lê e grava (operadores e secretaria) e valida tudo; o campo do erro vem na
    // dica (hint)
    async listarDadosPessoais(tipo) {
      const { data, error } = await cliente.from('dados_pessoais')
        .select('id_cadastro, cpf, canac, nascimento, celular, email, atualizado_em, atualizado_por').eq('tipo', tipo);
      if (error) throw erroComCodigo(error);
      return Object.fromEntries(data.map(({ id_cadastro, ...dados }) => [id_cadastro, Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== null))]));
    },

    // Os dados de uma pessoa, lidos ao abrir o painel, com a versão (atualizado_em) que a gravação leva de volta
    async lerDadosPessoais(tipo, id) {
      const { data, error } = await cliente.from('dados_pessoais')
        .select('cpf, canac, nascimento, celular, email, atualizado_em, atualizado_por').eq('tipo', tipo).eq('id_cadastro', id).maybeSingle();
      if (error) throw erroComCodigo(error);
      return data ? Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null)) : {};
    },

    // Grava a partir da versão lida (outra pessoa gravou antes: PT409); o servidor registra o histórico da data
    async salvarDadosPessoais(tipo, id, dados, { atualizadoEm = null, data = null } = {}) {
      const { data: resposta, error } = await cliente.rpc('salvar_dados_pessoais', {
        p_tipo: tipo, p_id: id, p_dados: dados, p_atualizado_em: atualizadoEm, p_data: data
      });
      if (error) throw Object.assign(erroComCodigo(error), { campo: error.hint || null });
      return resposta;
    },

    // Resultados das missões dos cursos: grava-se só pela função (o servidor valida e diz quem registrou); a situação de
    // cada missão vem pronta (o último registro), e os registros de uma data, da tabela
    async registrarResultado({ aluno, curso, missao, resultado, data, voo = null }) {
      const { data: id, error } = await cliente.rpc('registrar_resultado', { p_aluno: aluno, p_curso: curso, p_missao: missao, p_resultado: resultado, p_data: data, p_voo: voo });
      if (error) throw erroComCodigo(error);
      return id;
    },

    async situacaoDasMissoes() {
      const { data: situacao, error } = await cliente.rpc('situacao_das_missoes');
      if (error) throw erroComCodigo(error);
      return situacao || [];
    },

    async resultadosDoDia(data) {
      const { data: linhas, error } = await cliente.from('resultados_de_missao')
        .select('id, aluno, curso, missao, resultado, data, voo, registrado_em, registrado_por').eq('data', data).order('id');
      if (error) throw erroComCodigo(error);
      return linhas;
    },

    async importarHistorico(data, entradas) {
      const { data: importadas, error } = await cliente.rpc('importar_historico', { p_data: data, p_entradas: entradas });
      if (error) throw new Error(error.message);
      return importadas;
    }
  };
}
