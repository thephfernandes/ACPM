// Backend local: os documentos da escala ficam no localStorage deste navegador (modo sem login).
// cadastro e dia:AAAA-MM-DD são o formato por data (fase 3); estado, escala, historico e bi, o da fase 2.
import { prazoDaAgendaPermite } from '../agenda.js';
import { gravarDadosPessoais, semQuemSaiu } from '../dados-pessoais.js';
import { acumularHoras } from '../limites.js';
import { hojeISO } from '../format.js';
import { situacaoPorMissao, validarRegistro } from '../resultados.js';

export const CHAVES_LOCAIS = { cadastro: 'acpm4_cadastro', estado: 'acpm3', escala: 'acpm3_res', historico: 'acpm3_audit', bi: 'acpm3_bi' };
export const CHAVE_LEGADA = 'acpm2';
const PREFIXO_DIA = 'acpm4_dia_';
const CHAVE_HISTORICO = 'acpm4_historico';
const CHAVE_AGENDA = 'acpm4_agenda';
const CHAVE_DADOS_PESSOAIS = 'acpm4_dados_pessoais';
const CHAVE_RESULTADOS = 'acpm4_resultados';
const DOCUMENTO_DIA = /^dia:(\d{4}-\d{2}-\d{2})$/;

const chaveLocal = documento => {
  const dia = DOCUMENTO_DIA.exec(documento);
  if (dia) return PREFIXO_DIA + dia[1];
  if (!Object.hasOwn(CHAVES_LOCAIS, documento)) throw new Error(`documento desconhecido: ${documento}`);
  return CHAVES_LOCAIS[documento];
};

const lerJson = chave => {
  try { return JSON.parse(localStorage.getItem(chave)); } catch (e) { return null; }
};

function datasGuardadas() {
  const datas = [];
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (chave && chave.startsWith(PREFIXO_DIA)) datas.push(chave.slice(PREFIXO_DIA.length));
  }
  return datas.sort();
}

// Ids crescentes para o histórico local (o modo local não tem servidor para numerar as entradas)
const proximoId = lista => Math.max(Date.now(), ...lista.map(e => e.id + 1));

// Erros da agenda com o mesmo código do servidor (PT403: fora do prazo; 23514: dado inválido; P0002: não achado)
const erroDaAgenda = (code, message) => Object.assign(new Error(message), { code });
const textoObrigatorio = (valor, max) => typeof valor === 'string' && valor.trim().length >= 1 && valor.trim().length <= max;
const JANELAS = ['manha', 'tarde', 'noite', 'horario'];

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
    } catch (e) { return null; }
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
    } catch (e) { return false; }
  },

  // As datas guardadas num formato anterior (a atualização do formato lê só essas); o dia ilegível também
  async diasEmFormatoAntigo(esquema) {
    const versao = c => (c && typeof c.esquema === 'number' ? Math.floor(c.esquema) : 0);
    return datasGuardadas().filter(d => versao(lerJson(PREFIXO_DIA + d)) < esquema);
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

  async registrarSolicitacao({ data, aluno, aluno_nome, missao, janela, horario = null, observacao = null, registrado_por, excecao = false }, agora = new Date()) {
    const noPrazo = prazoDaAgendaPermite(data, agora);
    if (!noPrazo && !excecao) throw erroDaAgenda('PT403', 'prazo encerrado: pedido para o dia seguinte só até as 13:00');
    if (!textoObrigatorio(registrado_por, 80) || !textoObrigatorio(aluno_nome, 80) || !textoObrigatorio(missao, 60) ||
        !JANELAS.includes(janela) || (janela === 'horario') !== /^[0-2][0-9]:[0-5][0-9]$/.test(horario || '')) {
      throw erroDaAgenda('23514', 'pedido incompleto: confira aluno, missão, disponibilidade e quem anotou');
    }
    const lista = lerJson(CHAVE_AGENDA) || [];
    const id = proximoId(lista);
    lista.push({
      id, data, aluno, aluno_nome: aluno_nome.trim(), missao, janela, horario: janela === 'horario' ? horario : null,
      observacao: (observacao || '').trim().slice(0, 300) || null, registrado_por: registrado_por.trim(),
      registrado_em: agora.toISOString(), conta: null, excecao: !noPrazo, cancelada_em: null, cancelada_por: null
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

  // Resultados das missões dos cursos neste navegador, com as regras do servidor: só acréscimo; vale o último registro
  async registrarResultado(registro, { autor = null, agora = new Date() } = {}) {
    const lista = lerJson(CHAVE_RESULTADOS) || [];
    const id = proximoId(lista);
    lista.push({ id, ...validarRegistro(registro), registrado_em: agora.toISOString(), registrado_por: autor });
    localStorage.setItem(CHAVE_RESULTADOS, JSON.stringify(lista));
    return id;
  },

  async situacaoDasMissoes() {
    return [...situacaoPorMissao(lerJson(CHAVE_RESULTADOS) || []).values()].map(({ id, ...r }) => r);
  },

  async resultadosDoDia(data) {
    return (lerJson(CHAVE_RESULTADOS) || []).filter(r => r.data === data);
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
