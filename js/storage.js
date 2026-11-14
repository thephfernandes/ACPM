// Camada de acesso a dados: estado inicial, migrações de schema, persistência por um backend
// (localStorage ou Supabase) e o link compartilhável que abre a escala no perfil Gestor.
import { WIN, NI, DEFAULT_LIM, FLIGHT_STATUSES, AIRCRAFT_EQ_TYPES } from './config.js';
import { FROTA_INICIAL, normalizarFrota } from './frota.js';
import { pad, LIMITE_DO_NOME } from './format.js';
import { blank, normalizeMissionFields, disponibilidadeValida } from './rules.js';
import { HORARIOS_INICIAIS, normalizarHorarios, preferenciaValida } from './horarios.js';
import { backendLocal, CHAVES_LOCAIS, CHAVE_LEGADA } from './backends/local.js';
import { separar, juntar, diaPadrao, diaParaCopiar, converterLegado, biDosDias } from './dias.js';
import { ESQUEMA, migrarCadastro, migrarDia, precisaMigrar, renomearSimulador } from './migracoes.js';
import { habilitacoesDoNivel, normalizarHabilitacoes } from './habilitacoes.js';
import { ajustarFilas, CATEGORIAS_DO_RODIZIO } from './rodizio.js';
import { normalizarDetalhes, normalizarStatus } from './status.js';
import { normalizarEscalaGravada } from './escala-gravada.js';
import { normalizarHangar } from './hangar.js';
import { LIMITES_DA_LEI, normalizarLimites, comHorasExternas } from './limites.js';
import { normalizarFixos, normalizarAprovacao } from './fixos.js';
import { normalizarCriterios } from './criterios.js';
import { normalizarCursos, normalizarCursoDoAluno, codigoValido } from './cursos.js';

// Validação do link compartilhado: o conteúdo vem da URL, então só entram os tipos e as faixas que a interface produz
const LIMITE = { instrutores: 200, alunos: 500, extras: 10, bloqueios: 50, matriculas: 100, nome: 80 };
const inteiro = (v, min, max, padrao) => (Number.isInteger(v) && v >= min && v <= max ? v : padrao);
const numero = (v, min, max, padrao) => (typeof v === 'number' && v >= min && v <= max ? v : padrao);
const texto = (v, max = LIMITE.nome) => (typeof v === 'string' ? v.slice(0, max) : '');
const lista = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const id = v => inteiro(v, 1, Number.MAX_SAFE_INTEGER, null);
const pedido = (mis, eq, p1, p2, nb, ss, pr, jan, etapa) => ({
  mis: texto(mis), eq: texto(eq),
  // Preferências em minutos (links anteriores ao formato 12 trazem o número da janela, convertido ao normalizar)
  p1: preferenciaValida(p1), p2: preferenciaValida(p2),
  nb: numero(nb, 1, 11, 1), ss: inteiro(ss, 1, 3, 1), pr: inteiro(pr, 1, 5, 3),
  ...(disponibilidadeValida(jan) ? { jan } : {}),
  // A missão do curso (fase 14; os links anteriores não a trazem)
  ...(typeof etapa === 'string' && codigoValido(etapa) ? { etapa } : {})
});

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
        if (!Number.isInteger(ex.mid) || ex.mid <= 0) ex.mid = x.nid++;
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
    const horasBase = await this.horasDosInstrutores(data);
    const horasDosInstrutores = comHorasExternas(horasBase, estado.ins, data);
    // A escala gravada só vale no formato do motor (revisão de 14/11); adulterada, a tela usa a escala calculada
    const escala = dia ? normalizarEscalaGravada(dia.resultado) : null;
    const resultados = await this.resultadosDaData(data);
    return { estado, escala, novo: !dia, horasBase, horasDosInstrutores, resultados };
  },

  // Os resultados das missões dos cursos (fase 14): a situação de cada missão e os registros da data. Vão à parte (não
  // são gravados no dia); sem resposta, ficam vazios
  async resultadosDaData(data) {
    try {
      const [situacao, doDia] = await Promise.all([this.backend.situacaoDasMissoes(), this.backend.resultadosDoDia(data)]);
      return { situacao: situacao || [], doDia: doDia || [] };
    } catch (e) {
      return { situacao: [], doDia: [] };
    }
  },

  async horasDosInstrutores(data) {
    try {
      return (await this.backend.horasDosInstrutores(data)) || {};
    } catch (e) {
      return {};
    }
  },

  async salvarDia(data, estado, escala) {
    if (this.readOnly) return false;
    const partes = separar(estado);
    const cadastro = { ...partes.cadastro, esquema: ESQUEMA };
    const dia = { ...partes.dia, esquema: ESQUEMA };
    const json = JSON.stringify(cadastro);
    const gravacoes = [];
    if (json !== this.cadastroGravado) {
      gravacoes.push(this.backend.gravar('cadastro', cadastro).then(ok => {
        if (ok) this.cadastroGravado = json;
        return ok;
      }));
    }
    gravacoes.push(this.backend.gravar(`dia:${data}`, { ...dia, resultado: escala || null }));
    return (await Promise.all(gravacoes)).every(Boolean);
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
    for (const { data } of await this.backend.listarDias('0001-01-01', '9999-12-31')) {
      const dia = await this.backend.ler(`dia:${data}`);
      if (!precisaMigrar(dia)) continue;
      if (!await this.backend.gravar(`dia:${data}`, migrarDia(dia))) throw new Error(`A atualização dos dados não terminou (dia ${data}).`);
    }
    const novo = migrarCadastro(cadastro);
    if (!await this.backend.gravar('cadastro', novo)) throw new Error('A atualização dos dados não terminou (cadastro).');
    this.cadastroGravado = JSON.stringify(novo);
    return true;
  },

  encodeShareableURL(state, dateStr) {
    const compact = {
      d: dateStr,
      w: state.win.map(v => v ? 1 : 0),
      fr: (state.frota || []).map(f => [f.reg, f.tipo, f.soParafuso ? 1 : 0]),
      hr: state.horarios || null,
      avOff: Object.keys(state.av).filter(k => !state.av[k]),
      ins: state.ins.map(x => [x.id, x.nm, x.on ? 1 : 0, x.hab, x.kg, x.aw.map(a => a ? 1 : 0)]),
      st: state.fStatus || {},
      // Detalhes do status: a categoria do motivo e o novo horário (o texto livre do motivo não vai no link)
      ob: Object.fromEntries(Object.entries(state.fObs || {}).map(([fKey, d]) => [fKey, d.motivo ? { m: d.motivo } : { n: d.novoInicio }])),
      // Revisão de 50 horas e filas do rodízio: quem abre o link gera a mesma escala
      h: state.horas || {},
      f: state.filas || {},
      hg: state.hangar || [],
      // A escala aprovada: os voos fixos e quem aprovou
      fx: state.fixos || {},
      ap: state.aprovacao || null,
      // Os critérios da compactação (quem abre o link gera a mesma escala)
      cr: state.criterios || null,
      // Limites da lei e as horas passadas de cada instrutor (quem abre o link gera a mesma escala)
      li: state.limites || null,
      hi: state.horasDosInstrutores || {},
      fly: state.stu
        .filter(s => s.fly || (s.extra && s.extra.some(ex => ex.fly)))
        .map(s => [
          s.id, s.nm, s.kg, s.bl,
          s.fly ? 1 : 0, s.mis, s.eq, s.p1, s.p2, s.nb, s.ss, s.pr,
          (s.extra || []).filter(ex => ex.fly).map(ex => [ex.mid, ex.mis, ex.eq, ex.p1, ex.p2, ex.nb, ex.ss, ex.pr, ex.jan || '', ex.etapa || '']),
          s.jan || '', s.etapa || ''
        ])
    };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
    const url = new URL(window.location.href);
    url.searchParams.set('role', 'gestor');
    url.searchParams.set('share', b64);
    return url.toString();
  },

  applySharedURLIfPresent(state) {
    try {
      const params = new URLSearchParams(window.location.search);
      const share = params.get('share');
      if (!share) return null;
      const decoded = JSON.parse(decodeURIComponent(escape(atob(share))));
      if (!decoded || typeof decoded !== 'object') return null;
      if (Array.isArray(decoded.w)) state.win = WIN.map((_, i) => Boolean(decoded.w[i]));
      state.lim = { ...DEFAULT_LIM };
      // A frota de quem compartilhou (links anteriores à fase 7 não a trazem: fica a frota inicial)
      if (Array.isArray(decoded.fr)) {
        state.frota = normalizarFrota(lista(decoded.fr, LIMITE.matriculas).filter(Array.isArray)
          .map(([reg, tipo, parafuso]) => ({ reg, tipo, soParafuso: parafuso === 1 })));
        state.av = Object.fromEntries(state.frota.map(f => [f.reg, true]));
      }
      // Os horários de decolagem de quem compartilhou (links anteriores à fase 7: os iniciais)
      if (decoded.hr && typeof decoded.hr === 'object') state.horarios = normalizarHorarios(decoded.hr);
      if (decoded.st && typeof decoded.st === 'object') {
        state.fStatus = Object.fromEntries(Object.entries(decoded.st)
          .filter(([fKey, st]) => /^\d+_\d+_\d+$/.test(fKey) && FLIGHT_STATUSES.includes(st)));
      }
      if (decoded.ob && typeof decoded.ob === 'object') {
        state.fObs = normalizarDetalhes(Object.fromEntries(Object.entries(decoded.ob)
          .filter(([, d]) => d && typeof d === 'object')
          .map(([fKey, d]) => [fKey, { motivo: d.m, novoInicio: d.n }])), state.fStatus);
      }
      if (decoded.li && typeof decoded.li === 'object') state.limites = normalizarLimites(decoded.li);
      if (decoded.fx && typeof decoded.fx === 'object') state.fixos = normalizarFixos(decoded.fx);
      if (decoded.ap !== undefined) state.aprovacao = normalizarAprovacao(decoded.ap);
      if (decoded.cr !== undefined) state.criterios = normalizarCriterios(decoded.cr);
      if (decoded.hi && typeof decoded.hi === 'object') {
        const numero = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
        state.horasDosInstrutores = Object.fromEntries(Object.entries(decoded.hi)
          .filter(([id, h]) => /^\d+$/.test(id) && h && typeof h === 'object')
          .map(([id, h]) => [id, { mes: numero(h.mes), semestre: numero(h.semestre), ano: numero(h.ano),
            fimAnterior: Number.isInteger(h.fimAnterior) && h.fimAnterior >= 0 && h.fimAnterior <= 1440 ? h.fimAnterior : null }]));
      }
      // A ordem do hangar de quem compartilhou (links anteriores à fase 10: a ordem da frota)
      if (Array.isArray(decoded.hg)) state.hangar = normalizarHangar(decoded.hg.filter(r => typeof r === 'string'), normalizarFrota(state.frota));
      if (decoded.h && typeof decoded.h === 'object') {
        const avioes = normalizarFrota(state.frota).filter(f => AIRCRAFT_EQ_TYPES.includes(f.tipo)).map(f => f.reg);
        state.horas = Object.fromEntries(Object.entries(decoded.h)
          .filter(([r, horas]) => avioes.includes(r) && typeof horas === 'number' && horas >= 0 && horas <= 60));
      }
      if (decoded.f && typeof decoded.f === 'object') {
        state.filas = Object.fromEntries(CATEGORIAS_DO_RODIZIO.map(({ id: cat }) => [cat, lista(decoded.f[cat], LIMITE.instrutores).map(id).filter(x => x !== null)]));
      }
      Object.keys(state.av).forEach(k => state.av[k] = true);
      lista(decoded.avOff, LIMITE.matriculas).map(renomearSimulador).forEach(k => { if (Object.hasOwn(state.av, k)) state.av[k] = false; });

      if (Array.isArray(decoded.ins)) {
        // Habilitações: lista conhecida; links antigos trazem o nível A01–A09 no lugar
        state.ins = lista(decoded.ins, LIMITE.instrutores).filter(Array.isArray).map(([insId, nm, on, hab, kg, aw]) => ({
          id: id(insId), nm: texto(nm), on: Boolean(on),
          hab: Array.isArray(hab) ? normalizarHabilitacoes(hab) : habilitacoesDoNivel(inteiro(hab, 1, 9, 1)),
          kg: numero(kg, 0, 300, 0),
          aw: Array.isArray(aw) ? WIN.map((_, i) => Boolean(aw[i])) : WIN.map(() => true)
        })).filter(x => x.id !== null);
      } else if (Array.isArray(decoded.inOff)) {
        state.ins.forEach(x => x.on = !decoded.inOff.includes(x.id));
      }

      state.stu = [];

      lista(decoded.fly, LIMITE.alunos).forEach(row => {
        const stuId = Array.isArray(row) ? id(row[0]) : null;
        if (stuId === null) return;
        const [, nm, kg, bl] = row;
        const cadastro = { nm: texto(nm), kg: numero(kg, 0, 300, 0), bl: lista(bl, LIMITE.bloqueios).map(id).filter(b => b !== null) };
        let target = state.stu.find(s => s.id === stuId);
        if (!target) {
          target = { id: stuId, ...cadastro, extra: [], ...blank() };
          state.stu.push(target);
        }
        if (row.length >= 12) {
          const [, , , , flyFlag, mis, eq, p1, p2, nb, ss, pr, extraArr, jan, etapa] = row;
          Object.assign(target, cadastro, {
            fly: Boolean(flyFlag), ...pedido(mis, eq, p1, p2, nb, ss, pr, jan, etapa),
            extra: lista(extraArr, LIMITE.extras).filter(Array.isArray)
              .map(([mid, ...campos]) => ({ mid: id(mid), fly: true, ...pedido(...campos) }))
              .filter(ex => ex.mid !== null)
          });
          target.extra.forEach(normalizeMissionFields);
          normalizeMissionFields(target);
        } else {
          const [, , , , mis, eq, p1, p2, nb, ss, pr] = row;
          Object.assign(target, cadastro, { fly: true, ...pedido(mis, eq, p1, p2, nb, ss, pr), extra: [] });
          normalizeMissionFields(target);
        }
      });
      return typeof decoded.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(decoded.d) ? decoded.d : null;
    } catch (e) { return null; }
  }
};
