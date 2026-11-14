// Backend Supabase: documentos compartilhados no banco, com controle de concorrência otimista (versão lida).
// cadastro (e os documentos da fase 2) ficam na tabela documentos e são gravados por salvar_documento;
// dia:AAAA-MM-DD fica na tabela dias e é gravado por salvar_dia. O histórico é a tabela historico.
// - Gravações do mesmo documento saem em série, sempre com o conteúdo mais recente
// - Se outra pessoa gravou antes (conflito), o backend para de gravar e avisa por aoConflito (formato: true quando a
//   recusa é pelo formato dos dados, de uma versão mais nova do app)
// - Erros de rede avisam por aoErro; a próxima alteração tenta gravar de novo (aoGravar avisa quando der certo)
const DOCUMENTO_DIA = /^dia:(\d{4}-\d{2}-\d{2})$/;

const erroComCodigo = error => Object.assign(new Error(error.message), { code: error.code || String(error.status || '') });

export function criarBackendSupabase(cliente, { aoConflito = () => {}, aoErro = () => {}, aoGravar = () => {} } = {}) {
  const versoes = {};
  const pendentes = {};
  const emAndamento = {};
  let bloqueado = false;

  // As leituras esperam as gravações em andamento deste navegador: nunca voltam a um conteúdo (ou versão) anterior
  const gravacoesConcluidas = () => Promise.allSettled(Object.values(emAndamento));

  async function enviar(documento) {
    try {
      while (!bloqueado && Object.hasOwn(pendentes, documento)) {
        const conteudo = pendentes[documento];
        delete pendentes[documento];
        const dia = DOCUMENTO_DIA.exec(documento);
        const versaoLida = versoes[documento] ?? 0;
        const { data, error } = dia
          ? await cliente.rpc('salvar_dia', { p_data: dia[1], p_conteudo: conteudo, p_versao_lida: versaoLida })
          : await cliente.rpc('salvar_documento', { p_chave: documento, p_conteudo: conteudo, p_versao_lida: versaoLida });
        if (error) {
          delete pendentes[documento];
          if (error.code === 'PT409') {
            bloqueado = true;
            aoConflito(documento, { formato: error.hint === 'formato' });
          } else {
            aoErro(error, documento);
          }
          return false;
        }
        versoes[documento] = data;
        aoGravar(documento);
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

    // Depois de um conflito nada mais é registrado (a alteração não foi salva)
    async registrar({ data, tipo, descricao, reverter = null, reverte = null }) {
      if (bloqueado) return null;
      const { data: id, error } = await cliente.rpc('registrar_historico', {
        p_data: data, p_tipo: tipo, p_descricao: descricao, p_reverter: reverter, p_reverte: reverte
      });
      if (error) {
        aoErro(error, 'historico');
        return null;
      }
      return id;
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

    async salvarDadosPessoais(tipo, id, dados) {
      const { error } = await cliente.rpc('salvar_dados_pessoais', { p_tipo: tipo, p_id: id, p_dados: dados });
      if (error) throw Object.assign(erroComCodigo(error), { campo: error.hint || null });
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
