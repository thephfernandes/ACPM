// Backend local: os documentos da escala ficam no localStorage deste navegador (modo sem login).
// cadastro e dia:AAAA-MM-DD são o formato por data; estado, escala, historico e bi são os documentos antigos, que
// migrarDocumentosAntigos (storage.js) converte para o formato por data.
import { prazoDaAgendaPermite, RECURSO_DO_PEDIDO, recusaDoPedido } from '../agenda.js';
import { gravarDadosPessoais, semQuemSaiu } from '../dados-pessoais.js';
import { acumularHoras } from '../limites.js';
import { hojeISO } from '../format.js';
import { situacaoPorMissao, validarRegistro } from '../resultados.js';
import { cursosIniciais, gravarCurso, importarProgramas, programaComResultados } from '../programa.js';
import { GROUND_DURATION_H, DURACAO_MAXIMA_H, MISSOES_LOCAIS, LIMITE_DE_VOOS_LOCAIS } from '../config.js';
import { duracaoDigitada } from '../rules.js';

const CHAVES_LOCAIS = { cadastro: 'acpm4_cadastro', estado: 'acpm3', escala: 'acpm3_res', historico: 'acpm3_audit', bi: 'acpm3_bi' };
export const CHAVE_LEGADA = 'acpm2';
const PREFIXO_DIA = 'acpm4_dia_';
const CHAVE_HISTORICO = 'acpm4_historico';
const CHAVE_AGENDA = 'acpm4_agenda';
const CHAVE_DADOS_PESSOAIS = 'acpm4_dados_pessoais';
const CHAVE_RESULTADOS = 'acpm4_resultados';
// O programa dos cursos (as tabelas dos cursos do servidor): { cursos, alteracoes }, com as últimas 200 alterações
const CHAVE_CURSOS = 'acpm4_cursos';
const ALTERACOES_GUARDADAS = 200;
const DOCUMENTO_DIA = /^dia:(\d{4}-\d{2}-\d{2})$/;

const chaveLocal = documento => {
  const dia = DOCUMENTO_DIA.exec(documento);
  if (dia) return PREFIXO_DIA + dia[1];
  if (!Object.hasOwn(CHAVES_LOCAIS, documento)) throw new Error(`documento desconhecido: ${documento}`);
  return CHAVES_LOCAIS[documento];
};

const lerJson = chave => {
  try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; }
};

function datasGuardadas() {
  const datas = [];
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (chave && chave.startsWith(PREFIXO_DIA)) datas.push(chave.slice(PREFIXO_DIA.length));
  }
  return datas.sort();
}

// Ids crescentes para o histórico, a agenda e os resultados (o modo local não tem servidor para numerar as entradas)
const proximoId = lista => Math.max(Date.now(), ...lista.map(e => e.id + 1));

// O formato de um documento guardado, como no servidor (public.esquema_do_conteudo): o número inteiro do campo
// "esquema"; sem ele, 0
const formatoDe = conteudo => (conteudo && typeof conteudo.esquema === 'number' ? Math.floor(conteudo.esquema) : 0);

// Os cursos guardados neste navegador, no formato do servidor, e as alterações do programa. Sem nada gravado, os
// cursos com que o servidor começa (PP, PC e INVA, vazios): a leitura não grava a chave
function cursosGuardados() {
  const guardados = lerJson(CHAVE_CURSOS);
  if (!guardados || !Array.isArray(guardados.cursos)) return { cursos: cursosIniciais(), alteracoes: [] };
  return { cursos: guardados.cursos, alteracoes: Array.isArray(guardados.alteracoes) ? guardados.alteracoes : [] };
}
const gravarCursos = (cursos, alteracoes) => localStorage.setItem(CHAVE_CURSOS, JSON.stringify({ cursos, alteracoes: alteracoes.slice(-ALTERACOES_GUARDADAS) }));
// O que a gravação dos cursos confere, como no servidor: os cursos, os resultados (o código com resultados não muda) e
// o cadastro (o formato dele; o modo local não tem a versão do servidor: 0)
const estadoDosCursos = cursos => {
  const cadastro = lerJson(CHAVES_LOCAIS.cadastro);
  return { cursos, resultados: lerJson(CHAVE_RESULTADOS) || [], cadastro: cadastro === null ? null : { esquema: formatoDe(cadastro), versao: 0 } };
};

// Erros da agenda com o mesmo código do servidor (PT403: fora do prazo; 23514: dado inválido; P0002: não achado)
const erroDaAgenda = (code, message, campo = null) => Object.assign(new Error(message), { code, campo });
const textoObrigatorio = (valor, max) => typeof valor === 'string' && valor.trim().length >= 1 && valor.trim().length <= max;

// Formato acpm2 (7 janelas) convertido para as 9 janelas atuais
function converterAcpm2(o) {
  if (!(o && o.stu && o.ins && o.lim)) return null;
  const OLD = [0,1,2,2,3,3,4,5,6], NEW = [0,1,2,4,6,7,8];
  o.win = OLD.map(k => o.win[k]);
  o.ins.forEach(i => i.aw = OLD.map(k => i.aw[k]));
  o.stu.forEach(d => {
    d.p1 = d.p1 < 0 ? -1 : NEW[d.p1];
    d.p2 = d.p2 < 0 ? -1 : NEW[d.p2];
    d.ss = 1;
  });
  return o;
}

export const backendLocal = {
  async ler(documento) {
    const chave = chaveLocal(documento);
    try {
      const x = JSON.parse(localStorage.getItem(chave));
      if (x || documento !== 'estado') return x;
      return converterAcpm2(JSON.parse(localStorage.getItem(CHAVE_LEGADA)));
    } catch { return null; }
  },

  async gravar(documento, conteudo) {
    const chave = chaveLocal(documento);
    try {
      localStorage.setItem(chave, JSON.stringify(conteudo));
      // Como o servidor: quem sai do cadastro leva os dados pessoais junto
      if (documento === 'cadastro') {
        const dados = lerJson(CHAVE_DADOS_PESSOAIS);
        if (dados) localStorage.setItem(CHAVE_DADOS_PESSOAIS, JSON.stringify(semQuemSaiu(dados, conteudo)));
      }
      return true;
    } catch { return false; }
  },

  // As datas guardadas num formato anterior (a atualização do formato lê só essas); o dia ilegível também
  async diasEmFormatoAntigo(esquema) {
    return datasGuardadas().filter(d => formatoDe(lerJson(PREFIXO_DIA + d)) < esquema);
  },

  async listarDias(de, ate) {
    return datasGuardadas()
      .filter(d => d >= de && d <= ate)
      .map(d => ({ data: d, conteudo: lerJson(PREFIXO_DIA + d) }))
      .filter(dia => dia.conteudo !== null);
  },

  async diaAnterior(data) {
    const anterior = datasGuardadas().filter(d => d < data).pop();
    return anterior ? { data: anterior, conteudo: lerJson(PREFIXO_DIA + anterior) } : null;
  },

  // Histórico local: guarda as últimas 1000 entradas
  async registrar({ data, tipo, descricao, reverter = null, reverte = null }) {
    const lista = lerJson(CHAVE_HISTORICO) || [];
    const id = proximoId(lista);
    lista.push({ id, data, registrado_em: new Date().toISOString(), autor: null, tipo, descricao, reverter, reverte, importado: false });
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista.slice(-1000)));
    return id;
  },

  async listarHistorico(data) {
    return (lerJson(CHAVE_HISTORICO) || [])
      .filter(e => e.data === data)
      .sort((a, b) => (a.registrado_em < b.registrado_em) - (a.registrado_em > b.registrado_em) || b.id - a.id);
  },

  // Só no modo local: o botão "Limpar" do histórico e o "Limpar BI" (dias simulados)
  async limparHistorico(data) {
    const lista = (lerJson(CHAVE_HISTORICO) || []).filter(e => e.data !== data);
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista));
  },

  async removerDiasSimulados() {
    for (const d of datasGuardadas()) {
      const dia = lerJson(PREFIXO_DIA + d);
      if (dia && dia.simulado) localStorage.removeItem(PREFIXO_DIA + d);
    }
  },

  // Agenda de solicitações neste navegador. Sem login, quem usa tem os direitos de operador (inclusive a exceção)
  async listarSolicitacoes(de, ate) {
    const ordem = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    return (lerJson(CHAVE_AGENDA) || []).filter(s => s.data >= de && s.data <= ate)
      .sort((a, b) => ordem(a.data, b.data) || ordem(a.registrado_em, b.registrado_em));
  },

  // Como a função de 13 argumentos do servidor (a migração missao_do_curso_e_limite_do_pedido), na mesma ordem: o pedido é
  // num horário específico, com a duração de 0,1 a 5 h (o Ground, 01h30); o recurso, o horário fixo e a missão do curso
  // (recusaDoPedido, com os cursos deste navegador); no máximo LIMITE_DE_VOOS_LOCAIS voos locais no mesmo horário, a não
  // ser com a confirmação (confirmarLimite), que fica registrada quando o limite foi passado (quem: quem anotou, já que
  // este navegador não tem conta); o prazo e a exceção da coordenação; e os textos e o formato do recurso
  async registrarSolicitacao({ data, aluno, aluno_nome, missao, janela, horario = null, horas, observacao = null, registrado_por, excecao = false, recurso = null, missaoDoCurso = null, confirmarLimite = false }, agora = new Date()) {
    if (janela !== 'horario' || !/^[0-2][0-9]:[0-5][0-9]$/.test(horario || '')) throw erroDaAgenda('22023', 'o pedido é num horário específico', 'horario');
    const h = String(missao).startsWith('Ground') ? GROUND_DURATION_H : duracaoDigitada(horas);
    if (h === null) throw erroDaAgenda('22023', `a duração vai de 0,1 h a ${DURACAO_MAXIMA_H} h`, 'horas');
    const recusa = recusaDoPedido({ missao, recurso, horario, horas: h, missaoDoCurso }, cursosGuardados().cursos);
    if (recusa) throw erroDaAgenda(recusa.code, recusa.mensagem, recusa.campo);
    const lista = lerJson(CHAVE_AGENDA) || [];
    const local = m => MISSOES_LOCAIS.includes(m);
    const alemDoLimite = local(missao) && lista.filter(s => s.data === data && !s.cancelada_em && s.horario === horario && local(s.missao)).length >= LIMITE_DE_VOOS_LOCAIS;
    if (alemDoLimite && !confirmarLimite) throw erroDaAgenda('PT422', `já há ${LIMITE_DE_VOOS_LOCAIS} voos locais às ${horario}`, 'locais');
    const noPrazo = prazoDaAgendaPermite(data, agora);
    if (!noPrazo && !excecao) throw erroDaAgenda('PT403', 'prazo encerrado: pedido para o dia seguinte só até as 13:00');
    if (!textoObrigatorio(registrado_por, 80) || !textoObrigatorio(aluno_nome, 80) || !textoObrigatorio(missao, 60)) {
      throw erroDaAgenda('23514', 'pedido incompleto: confira aluno, missão, horário e quem anotou');
    }
    const tipo = recurso.trim();
    if (!RECURSO_DO_PEDIDO.test(tipo)) throw erroDaAgenda('23514', 'recurso inválido');
    const id = proximoId(lista);
    lista.push({
      id, data, aluno, aluno_nome: aluno_nome.trim(), missao, janela, horario, horas: h, recurso: tipo, missao_do_curso: missaoDoCurso || null,
      observacao: (observacao || '').trim().slice(0, 300) || null, registrado_por: registrado_por.trim(),
      registrado_em: agora.toISOString(), conta: null, excecao: !noPrazo,
      limite_confirmado_por: alemDoLimite ? registrado_por.trim() : null, limite_confirmado_em: alemDoLimite ? agora.toISOString() : null,
      cancelada_em: null, cancelada_por: null
    });
    localStorage.setItem(CHAVE_AGENDA, JSON.stringify(lista));
    return id;
  },

  async cancelarSolicitacao(id, por, agora = new Date()) {
    const lista = lerJson(CHAVE_AGENDA) || [];
    const solicitacao = lista.find(s => s.id === id && !s.cancelada_em);
    if (!solicitacao) throw erroDaAgenda('P0002', `pedido ${id} não encontrado ou já cancelado`);
    if (!textoObrigatorio(por, 80)) throw erroDaAgenda('23514', 'informe quem cancelou');
    Object.assign(solicitacao, { cancelada_em: agora.toISOString(), cancelada_por: por.trim() });
    localStorage.setItem(CHAVE_AGENDA, JSON.stringify(lista));
  },

  // As horas de voo de cada instrutor antes da data (limites da lei), com a mesma conta do servidor
  async horasDosInstrutores(data) {
    const dias = datasGuardadas().filter(d => d < data && d >= `${String(+data.slice(0, 4) - 1)}-12-31`)
      .map(d => ({ data: d, conteudo: lerJson(PREFIXO_DIA + d) })).filter(d => d.conteudo);
    return acumularHoras(dias, data);
  },

  // Dados pessoais neste navegador (fora do cadastro), com a mesma regra do servidor
  async listarDadosPessoais(tipo) {
    return Object.fromEntries(Object.entries(lerJson(CHAVE_DADOS_PESSOAIS) || {})
      .filter(([chave]) => chave.startsWith(`${tipo}:`))
      .map(([chave, dados]) => [Number(chave.slice(tipo.length + 1)), dados]));
  },

  async lerDadosPessoais(tipo, id) {
    return (lerJson(CHAVE_DADOS_PESSOAIS) || {})[`${tipo}:${id}`] || {};
  },

  // Como o servidor: a partir da versão lida, só para quem está no cadastro, e o histórico da data registra os campos
  async salvarDadosPessoais(tipo, id, dados, { autor = null, agora = new Date(), atualizadoEm = null, data = null } = {}) {
    const r = gravarDadosPessoais(lerJson(CHAVE_DADOS_PESSOAIS) || {}, tipo, id, dados, {
      hoje: hojeISO(), autor, agora: agora.toISOString(), atualizadoEmLido: atualizadoEm, cadastro: lerJson(CHAVES_LOCAIS.cadastro)
    });
    localStorage.setItem(CHAVE_DADOS_PESSOAIS, JSON.stringify(r.tabela));
    const historico = r.descricao ? { id: await this.registrar({ data: data || hojeISO(), tipo: 'mod', descricao: r.descricao }), descricao: r.descricao } : null;
    return { atualizado_em: r.atualizado_em, atualizado_por: autor, historico };
  },

  // Resultados das missões dos cursos neste navegador, com as regras do servidor: só acréscimo; vale o último registro;
  // o curso tem de existir (um dos cursos guardados)
  async registrarResultado(registro, { autor = null, agora = new Date() } = {}) {
    const lista = lerJson(CHAVE_RESULTADOS) || [];
    const id = proximoId(lista);
    const cursos = cursosGuardados().cursos.map(c => c.sigla);
    lista.push({ id, ...validarRegistro(registro, { cursos }), registrado_em: agora.toISOString(), registrado_por: autor });
    localStorage.setItem(CHAVE_RESULTADOS, JSON.stringify(lista));
    return id;
  },

  async situacaoDasMissoes() {
    return [...situacaoPorMissao(lerJson(CHAVE_RESULTADOS) || []).values()].map(({ id, ...r }) => r);
  },

  async resultadosDoDia(data) {
    return (lerJson(CHAVE_RESULTADOS) || []).filter(r => r.data === data);
  },

  // O programa dos cursos neste navegador, como o servidor devolve (programa_dos_cursos): se cada missão já tem
  // resultados e as últimas 20 alterações de cada curso
  async programaDosCursos() {
    const { cursos, alteracoes } = cursosGuardados();
    return programaComResultados({ cursos, resultados: lerJson(CHAVE_RESULTADOS) || [], alteracoes });
  },

  // Grava o curso inteiro a partir da versão lida (0 cria) com as regras do servidor (gravarCurso, em js/programa.js):
  // a recusa vem com o código e o campo, como a do servidor, e nada é gravado. Antes do formato dos cursos (o cadastro
  // deste navegador num formato anterior), o programa espera a conversão
  async salvarCurso(sigla, versaoLida, conteudo, { descricao, autor = null, agora = new Date() } = {}) {
    const guardados = cursosGuardados();
    const r = gravarCurso(estadoDosCursos(guardados.cursos), { sigla, versaoLida, conteudo, descricao, autor, agora: agora.toISOString() });
    gravarCursos(r.cursos, [...guardados.alteracoes, r.alteracao]);
    return r.retorno;
  },

  // A conversão única do programa guardado no cadastro (importarProgramas, em js/programa.js): com o cadastro deste
  // navegador no formato dos cursos, nada (0); o curso igual ao guardado é pulado, e a chave só é gravada quando algum
  // curso muda
  async importarCursos(programas, { autor = null, agora = new Date() } = {}) {
    const guardados = cursosGuardados();
    const r = importarProgramas(estadoDosCursos(guardados.cursos), { programas, versaoDoCadastro: 0, autor, agora: agora.toISOString() });
    if (r.alteracoes.length) gravarCursos(r.cursos, [...guardados.alteracoes, ...r.alteracoes]);
    return r.retorno;
  },

  async importarHistorico(data, entradas) {
    const lista = lerJson(CHAVE_HISTORICO) || [];
    if (lista.some(e => e.importado)) return 0;
    let id = proximoId(lista);
    for (const e of entradas) {
      lista.push({ id: id++, data, registrado_em: e.registrado_em || new Date().toISOString(), autor: null,
        tipo: e.tipo, descricao: e.descricao, reverter: null, reverte: null, importado: true });
    }
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista.slice(-1000)));
    return entradas.length;
  }
};
