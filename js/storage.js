// Camada de acesso a dados: estado inicial, migrações de schema e persistência por um backend (localStorage ou
// Supabase).
import { WIN, DEFAULT_LIM } from './config.js';
import { FROTA_INICIAL, normalizarFrota } from './frota.js';
import { pad, LIMITE_DO_NOME } from './format.js';
import { normalizeMissionFields, proximoMid } from './rules.js';
import { HORARIOS_INICIAIS, normalizarHorarios } from './horarios.js';
import { backendLocal, CHAVES_LOCAIS, CHAVE_LEGADA } from './backends/local.js';
import { separar, juntar, diaPadrao, diaParaCopiar, converterLegado, biDosDias } from './dias.js';
import { ESQUEMA, migrarCadastro, migrarDia, precisaMigrar, renomearSimulador } from './migracoes.js';
import { habilitacoesDoNivel, normalizarHabilitacoes } from './habilitacoes.js';
import { ajustarFilas } from './rodizio.js';
import { normalizarDetalhes, normalizarStatus } from './status.js';
import { normalizarEscalaGravada } from './escala-gravada.js';
import { normalizarHangar } from './hangar.js';
import { LIMITES_DA_LEI, normalizarLimites, comHorasExternas } from './limites.js';
import { normalizarFixos, normalizarAprovacao } from './fixos.js';
import { normalizarCriterios } from './criterios.js';
import { normalizarCursos, normalizarCursoDoAluno } from './cursos.js';

export const ApiClient = {
  KEY_STATE: CHAVES_LOCAIS.estado,
  KEY_LEGACY: CHAVE_LEGADA,
  KEY_RESULT: CHAVES_LOCAIS.escala,
  KEY_AUDIT: CHAVES_LOCAIS.historico,
  KEY_BI: CHAVES_LOCAIS.bi,
  KEY_THEME: 'acpm3_theme',
  // Onde os documentos ficam: backend local (localStorage) ou Supabase (login)
  backend: backendLocal,
  // Nome de quem está alterando (modo compartilhado), mostrado no histórico
  autorAtual: null,
  // Link compartilhado: nada é gravado e a interface fica travada no perfil Gestor
  readOnly: false,
  // Perfil e e-mail da conta no modo compartilhado (operador, gestor, secretaria ou administrador); null no modo local
  perfil: null,
  emailAtual: null,

  createFreshState() {
    const state = {
      schemaVer: 4,
      win: WIN.map(() => true),
      av: {},
      lim: { ...DEFAULT_LIM },
      nid: 1000,
      // Sem cadastro: no modo compartilhado os instrutores e alunos vêm do servidor
      ins: [],
      stu: [],
      fStatus: {},
      fObs: {},
      horas: {},
      importadas: [],
      frota: FROTA_INICIAL.map(f => ({ ...f })),
      horarios: normalizarHorarios(HORARIOS_INICIAIS),
      hangar: normalizarHangar(null, FROTA_INICIAL),
      limites: { ...LIMITES_DA_LEI }
    };
    state.frota.forEach(f => { state.av[f.reg] = true; });
    return state;
  },

  normalizeAndMigrateState(x) {
    if (!x || !Array.isArray(x.stu) || !Array.isArray(x.ins)) return this.createFreshState();
    x.lim = { ...DEFAULT_LIM };
    // Revisão de 14/11: o que vem gravado pode ter sido escrito fora do app (pela API); só os status da lista valem
    x.fStatus = normalizarStatus(x.fStatus);
    // Detalhes do status (fase 8): só os que valem para o status atual de cada voo
    x.fObs = normalizarDetalhes(x.fObs, x.fStatus);
    // Escala aprovada (fase 12): os voos fixos e quem aprovou
    x.fixos = normalizarFixos(x.fixos);
    x.aprovacao = normalizarAprovacao(x.aprovacao);
    // Critérios da compactação (fase 13)
    x.criterios = normalizarCriterios(x.criterios);
    if (!x.horas || typeof x.horas !== 'object' || Array.isArray(x.horas)) x.horas = {};
    x.horas = Object.fromEntries(Object.entries(x.horas).filter(([, h]) => typeof h === 'number' && Number.isFinite(h) && h >= 0 && h <= 60));
    x.importadas = Array.isArray(x.importadas) ? x.importadas.filter(id => Number.isInteger(id) && id > 0) : [];
    x.win = Array.isArray(x.win) && x.win.length === WIN.length ? x.win.map(v => v !== false) : WIN.map(() => true);
    if (!x.nid || x.nid < 1000) x.nid = 1000;
    // A frota (fase 7): disponibilidade e horas só dos recursos dela; um recurso que o dia não conhece começa disponível
    // (os simuladores com os nomes de antes da fase 4 são renomeados antes)
    x.frota = normalizarFrota(x.frota);
    // Horários de decolagem de cada categoria (fase 7)
    x.horarios = normalizarHorarios(x.horarios);
    // Ordem dos aviões no hangar (fase 10): só os da frota; quem falta entra no fundo
    x.hangar = normalizarHangar(x.hangar, x.frota);
    // Limites da Lei do Aeronauta (fase 11) e as horas de voo fora do app de cada instrutor ('AAAA-MM' ou 'AAAA-00')
    x.limites = normalizarLimites(x.limites);
    // O programa dos cursos e o curso de cada aluno (fase 14)
    x.cursos = normalizarCursos(x.cursos);
    x.stu.forEach(s => {
      const curso = normalizarCursoDoAluno(s.curso);
      if (curso) s.curso = curso;
      else delete s.curso;
    });
    x.ins.forEach(i => {
      const externas = i.horasExternas && typeof i.horasExternas === 'object' ? i.horasExternas : {};
      const validas = Object.entries(externas).filter(([quando, horas]) => /^\d{4}-(0\d|1[0-2])$/.test(quando) && typeof horas === 'number' && horas > 0 && horas <= 2000);
      if (validas.length) i.horasExternas = Object.fromEntries(validas);
      else delete i.horasExternas;
    });
    const naFrota = r => x.frota.some(f => f.reg === r);
    const av = Object.fromEntries(Object.entries(x.av && typeof x.av === 'object' ? x.av : {}).map(([r, v]) => [renomearSimulador(r), v]));
    x.av = Object.fromEntries(x.frota.map(f => [f.reg, typeof av[f.reg] === 'boolean' ? av[f.reg] : true]));
    x.horas = Object.fromEntries(Object.entries(x.horas).map(([r, h]) => [renomearSimulador(r), h]).filter(([r]) => naFrota(r)));

    if (!x.schemaVer || x.schemaVer < 3) {
      // Versões antigas: mantém os instrutores do navegador (e os ids, usados nos bloqueios), completando campos ausentes
      x.ins = x.ins.map((old, idx) => ({
        id: Number.isInteger(old.id) ? old.id : idx + 1,
        nm: typeof old.nm === 'string' ? old.nm : `Instrutor ${idx + 1}`,
        on: old.on !== false,
        lv: old.lv >= 1 && old.lv <= 9 ? old.lv : 1,
        kg: old.kg > 0 ? old.kg : 0,
        aw: Array.isArray(old.aw) && old.aw.length === WIN.length ? old.aw : WIN.map(() => true),
        ...(Array.isArray(old.hab) ? { hab: old.hab } : {})
      }));

      const isDefaultPlaceholderList =
        x.stu.length === 50 &&
        x.stu.every((s, i) => s.nm === pad(i) && !s.fly && (!s.extra || !s.extra.length));
      if (isDefaultPlaceholderList) {
        x.stu = [];
      }
    }

    x.schemaVer = 4;

    // Pessoas nos tipos certos (revisão de 14/11): sem id inteiro, a pessoa sai; nome de até 80 caracteres; peso de 0 a
    // 300 kg; disponibilidade com uma janela por período; bloqueios só com ids
    const nome = (v, padrao) => (typeof v === 'string' && v.trim() ? v.slice(0, LIMITE_DO_NOME) : padrao);
    const peso = v => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 300 ? v : 0);
    const comId = p => Boolean(p) && typeof p === 'object' && Number.isInteger(p.id) && p.id > 0;
    x.ins = x.ins.filter(comId);
    x.ins.forEach(i => {
      Object.assign(i, { nm: nome(i.nm, `Instrutor ${i.id}`), on: i.on !== false, kg: peso(i.kg) });
      i.aw = Array.isArray(i.aw) && i.aw.length === WIN.length ? i.aw.map(v => v === true) : WIN.map(() => true);
    });
    x.stu = x.stu.filter(comId);
    x.stu.forEach(s => {
      Object.assign(s, { nm: nome(s.nm, `Aluno ${s.id}`), kg: peso(s.kg), bl: Array.isArray(s.bl) ? s.bl.filter(id => Number.isInteger(id) && id > 0) : [] });
      s.extra = Array.isArray(s.extra) ? s.extra.filter(ex => ex && typeof ex === 'object') : [];
    });

    // Habilitações individuais (fase 4): quem só tem o nível A01–A09 recebe o que o nível permitia
    x.ins.forEach(i => { i.hab = Array.isArray(i.hab) ? normalizarHabilitacoes(i.hab) : habilitacoesDoNivel(i.lv); });

    // Filas do rodízio só com os instrutores habilitados (quem passou a ser habilitado entra no fim)
    x.filas = ajustarFilas(x.filas, x.ins);

    x.stu.forEach(s => {
      normalizeMissionFields(s);
      if (!Array.isArray(s.extra)) s.extra = [];
      s.extra.forEach(ex => {
        if (!Number.isInteger(ex.mid) || ex.mid <= 0) ex.mid = proximoMid(x, s);
        normalizeMissionFields(ex);
      });
    });

    return x;
  },

  // Escala por data (fase 3) ------------------------------------------------------------------------
  // JSON do cadastro lido ou gravado por último: o cadastro só é regravado quando muda
  cadastroGravado: undefined,

  // Estado e escala de uma data. Data sem escala começa com uma cópia do dia anterior (nada é gravado).
  // Dados num formato anterior chegam já no formato atual (o que está gravado é atualizado na próxima gravação)
  async carregarDia(data) {
    const guardado = await this.backend.ler('cadastro');
    this.cadastroGravado = guardado ? JSON.stringify(guardado) : undefined;
    const cadastro = migrarCadastro(guardado);
    const dia = migrarDia(await this.backend.ler(`dia:${data}`));
    const instrutores = (cadastro && cadastro.ins) || [];
    const base = dia || diaParaCopiar(migrarDia((await this.backend.diaAnterior(data) || {}).conteudo), instrutores);
    const estado = this.normalizeAndMigrateState(juntar(cadastro || { nid: 1000, ins: [], stu: [] }, base || diaPadrao()));
    // As horas de voo de cada instrutor antes da data e o fim de ontem (limites da lei), mais as de fora do app. Não são
    // gravadas (vão à parte, para o estado da tela): saem das escalas guardadas a cada abertura. Sem resposta, o motor
    // confere só os limites do dia
    // Sem resposta (revisão de 14/11), a data abre assim mesmo e diz o que ficou indisponível: a tela avisa e desliga o que
    // depende disso (Aprovar escala sem as horas; a próxima missão e o resultado sem os resultados)
    const lidos = await this.lerDadosAParte(data);
    const horasBase = lidos.horasBase || {};
    const horasDosInstrutores = comHorasExternas(horasBase, estado.ins, data);
    // A escala gravada só vale no formato do motor (revisão de 14/11); adulterada, a tela usa a escala calculada
    const escala = dia ? normalizarEscalaGravada(dia.resultado) : null;
    const resultados = lidos.resultados || { situacao: [], doDia: [] };
    const indisponiveis = [...(lidos.horasBase ? [] : ['horas']), ...(lidos.resultados ? [] : ['resultados'])];
    return { estado, escala, novo: !dia, horasBase, horasDosInstrutores, resultados, indisponiveis };
  },

  // O que vai à parte do dia (não é gravado nele): as horas de voo de cada instrutor antes da data (limites da lei) e os
  // resultados das missões dos cursos (fase 14: a situação de cada missão e os registros da data). Sem resposta, null
  async lerDadosAParte(data) {
    const ler = async fn => fn();
    const [horasBase, resultados] = await Promise.all([
      ler(() => this.backend.horasDosInstrutores(data)).then(h => h || {}, () => null),
      ler(() => Promise.all([this.backend.situacaoDasMissoes(), this.backend.resultadosDoDia(data)]))
        .then(([situacao, doDia]) => ({ situacao: situacao || [], doDia: doDia || [] }), () => null)
    ]);
    return { horasBase, resultados };
  },

  async salvarDia(data, estado, escala) {
    if (this.readOnly) return false;
    const partes = separar(estado);
    const cadastro = { ...partes.cadastro, esquema: ESQUEMA };
    const dia = { ...partes.dia, esquema: ESQUEMA };
    const json = JSON.stringify(cadastro);
    // O cadastro primeiro; o dia só depois que o cadastro foi gravado (revisão de 14/11: o dia não fica gravado com
    // pessoas ou pedidos que o cadastro gravado não tem)
    if (json !== this.cadastroGravado) {
      if (!await this.backend.gravar('cadastro', cadastro)) return false;
      this.cadastroGravado = json;
    }
    return this.backend.gravar(`dia:${data}`, { ...dia, resultado: escala || null });
  },

  // Há alteração esperando para ser gravada no servidor (o modo local grava na hora)?
  temGravacoesPendentes() {
    return Boolean(this.backend.temGravacoesPendentes && this.backend.temGravacoesPendentes());
  },

  async registrarHistorico(data, entrada) {
    if (this.readOnly) return null;
    return this.backend.registrar({ data, ...entrada });
  },

  historicoDoDia(data) {
    return this.backend.listarHistorico(data);
  },

  // Contas (modo compartilhado): a própria conta e, para administradores, as contas de todos
  contas() {
    return this.backend.listarContas();
  },

  criarConta(dados) {
    return this.backend.criarConta(dados);
  },

  excluirConta(usuario) {
    return this.backend.excluirConta(usuario);
  },

  alterarSenha(atual, nova) {
    return this.backend.alterarSenha(this.emailAtual, atual, nova);
  },

  alterarEmail(atual, novo, redirecionarPara) {
    return this.backend.alterarEmail(this.emailAtual, atual, novo, redirecionarPara);
  },

  // Agenda de solicitações (no modo compartilhado, o servidor decide quem registra: secretaria e operadores)
  agenda(de, ate) {
    return this.backend.listarSolicitacoes(de, ate);
  },

  registrarSolicitacao(dados) {
    return this.backend.registrarSolicitacao(dados);
  },

  cancelarSolicitacao(id, por) {
    return this.backend.cancelarSolicitacao(id, por);
  },

  // Dados pessoais (fase 9): fora do estado e do cadastro. No modo compartilhado o servidor decide quem lê e grava
  // (operadores, administradores e a secretaria, que entra no modo só leitura da escala)
  listarDadosPessoais(tipo) {
    return this.backend.listarDadosPessoais(tipo);
  },

  salvarDadosPessoais(tipo, id, dados) {
    return this.backend.salvarDadosPessoais(tipo, id, dados, { autor: this.autorAtual || null });
  },

  // Resultados das missões dos cursos (fase 14): fora do estado; o servidor decide quem lê (os perfis da escala) e quem
  // registra (operadores e administradores)
  registrarResultado(registro) {
    if (this.readOnly) return Promise.reject(Object.assign(new Error('somente leitura'), { code: '42501' }));
    return this.backend.registrarResultado(registro, { autor: this.autorAtual || null });
  },

  situacaoDasMissoes() {
    return this.backend.situacaoDasMissoes();
  },

  resultadosDoDia(data) {
    return this.backend.resultadosDoDia(data);
  },

  async biDoPeriodo(de, ate) {
    return biDosDias((await this.backend.listarDias(de, ate)).map(d => ({ ...d, conteudo: migrarDia(d.conteudo) })));
  },

  // Converte os documentos da fase 2 (estado, escala, histórico e BI) para o formato por data, uma vez só.
  // A origem pode ser outro backend (envio dos dados do navegador). Os documentos antigos ficam como cópia;
  // dias que já existem não são sobrescritos e o cadastro é gravado por último (marca a migração como concluída).
  // Se uma gravação falhar, para com erro antes do cadastro: a conversão é retomada na próxima abertura.
  async migrarDocumentosAntigos(dataPadrao, origem = this.backend) {
    if (this.readOnly || await this.backend.ler('cadastro')) return null;
    const estado = await origem.ler('estado');
    if (!estado || !Array.isArray(estado.ins) || !Array.isArray(estado.stu)) return null;
    const plano = converterLegado({
      estado: this.normalizeAndMigrateState(estado),
      escala: await origem.ler('escala'),
      historico: await origem.ler('historico'),
      bi: await origem.ler('bi')
    }, dataPadrao);
    for (const [data, conteudo] of Object.entries(plano.dias)) {
      if (await this.backend.ler(`dia:${data}`)) continue;
      if (!await this.backend.gravar(`dia:${data}`, migrarDia(conteudo))) throw new Error(`A conversão dos dados não terminou (dia ${data}).`);
    }
    if (plano.historico.length) await this.backend.importarHistorico(plano.dataAtual, plano.historico);
    const cadastro = migrarCadastro(plano.cadastro);
    if (!await this.backend.gravar('cadastro', cadastro)) throw new Error('A conversão dos dados não terminou (cadastro).');
    this.cadastroGravado = JSON.stringify(cadastro);
    return plano.dataAtual;
  },

  // Regrava no formato atual tudo o que está num formato anterior: todos os dias e, por último, o cadastro (que
  // marca a atualização como concluída). Se uma gravação falhar, para com erro: é retomada na próxima abertura.
  async atualizarFormatoGravado() {
    if (this.readOnly) return false;
    const cadastro = await this.backend.ler('cadastro');
    if (!precisaMigrar(cadastro)) return false;
    for (const data of await this.backend.diasEmFormatoAntigo(ESQUEMA)) {
      const dia = await this.backend.ler(`dia:${data}`);
      if (!precisaMigrar(dia)) continue;
      if (!await this.backend.gravar(`dia:${data}`, migrarDia(dia))) throw new Error(`A atualização dos dados não terminou (dia ${data}).`);
    }
    const novo = migrarCadastro(cadastro);
    if (!await this.backend.gravar('cadastro', novo)) throw new Error('A atualização dos dados não terminou (cadastro).');
    this.cadastroGravado = JSON.stringify(novo);
    return true;
  }
};
