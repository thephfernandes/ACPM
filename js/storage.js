// Camada de acesso a dados: estado inicial, migrações de schema e persistência por um backend (localStorage ou
// Supabase).
import { WIN } from './config.js';
import { FROTA_INICIAL, normalizarFrota } from './frota.js';
import { pad, LIMITE_DO_NOME, hojeISO } from './format.js';
import { normalizeMissionFields, proximoMid, pesoValido } from './rules.js';
import { HORARIOS_INICIAIS, normalizarHorarios } from './horarios.js';
import { backendLocal } from './backends/local.js';
import { separar, juntar, diaPadrao, diaParaCopiar, converterLegado, biDosDias } from './dias.js';
import { ESQUEMA, migrarCadastro, migrarDia, precisaMigrar, antesDosCursosProprios, renomearSimulador } from './migracoes.js';
import { habilitacoesDoNivel, normalizarHabilitacoes } from './habilitacoes.js';
import { ajustarFilas } from './rodizio.js';
import { normalizarDetalhes, normalizarStatus } from './status.js';
import { normalizarEscalaGravada } from './escala-gravada.js';
import { normalizarHangar } from './hangar.js';
import { LIMITES_DA_LEI, normalizarLimites, comHorasExternas } from './limites.js';
import { noturnosDaVespera, comRepousoDoNoturno, voltasConferem } from './noturno.js';
import { normalizarFixos, normalizarAprovacao } from './fixos.js';
import { normalizarCriterios } from './criterios.js';
import { normalizarPainel } from './config-do-painel.js';
import { normalizarCursos, normalizarCursoDoAluno } from './cursos.js';
import { normalizarProgramas, programaDoLegado } from './programa.js';
import { inativo, inativoValeEm, ativosNaData } from './inativos.js';

// A recusa de quem só consulta (o Gestor e a Secretaria no modo compartilhado, ou a tela travada depois de um
// conflito), com o código do servidor
const somenteLeitura = () => Promise.reject(Object.assign(new Error('somente leitura'), { code: '42501' }));

// O programa dos cursos ainda no cadastro (guardado: o cadastro como está gravado): antes do formato dos cursos, com
// missões no programa de algum curso, as tabelas ainda não o têm (a conversão única é feita na primeira abertura de um
// Operador ou Administrador; quem só consulta pode chegar antes)
const programaNoCadastro = guardado => antesDosCursosProprios(guardado) && Object.values(normalizarCursos(guardado.cursos)).some(missoes => missoes.length > 0);

export const ApiClient = {
  KEY_THEME: 'acpm3_theme',
  // Onde os documentos ficam: backend local (localStorage) ou Supabase (login)
  backend: backendLocal,
  // Nome de quem está alterando (modo compartilhado), mostrado no histórico
  autorAtual: null,
  // Somente consulta (o Gestor e a Secretaria no modo compartilhado, ou a tela travada depois de um conflito): nada é
  // gravado e a tela fica no perfil Gestor
  readOnly: false,
  // Perfil e e-mail da conta no modo compartilhado (operador, gestor, secretaria ou administrador); null no modo local
  perfil: null,
  emailAtual: null,

  createFreshState() {
    const state = {
      schemaVer: 4,
      win: WIN.map(() => true),
      av: {},
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

  // ativos: o inativo do cadastro vale na data (de hoje em diante): as filas do rodízio e o hangar ficam com os ativos
  normalizeAndMigrateState(x, { ativos = false } = {}) {
    if (!x || !Array.isArray(x.stu) || !Array.isArray(x.ins)) return this.createFreshState();
    // Os limites de peso de cada avião não ficam no estado (o motor usa os da configuração): um estado antigo com eles
    // fica sem
    delete x.lim;
    // O que vem gravado pode ter sido escrito fora do app (pela API): só os status da lista valem
    x.fStatus = normalizarStatus(x.fStatus);
    // Detalhes do status: só os que valem para o status atual de cada voo
    x.fObs = normalizarDetalhes(x.fObs, x.fStatus);
    // Escala aprovada: os voos fixos e quem aprovou
    x.fixos = normalizarFixos(x.fixos);
    x.aprovacao = normalizarAprovacao(x.aprovacao);
    // Critérios da compactação
    x.criterios = normalizarCriterios(x.criterios);
    if (!x.horas || typeof x.horas !== 'object' || Array.isArray(x.horas)) x.horas = {};
    x.horas = Object.fromEntries(Object.entries(x.horas).filter(([, h]) => typeof h === 'number' && Number.isFinite(h) && h >= 0 && h <= 60));
    x.importadas = Array.isArray(x.importadas) ? x.importadas.filter(id => Number.isInteger(id) && id > 0) : [];
    x.win = Array.isArray(x.win) && x.win.length === WIN.length ? x.win.map(v => v !== false) : WIN.map(() => true);
    if (!x.nid || x.nid < 1000) x.nid = 1000;
    // A frota: disponibilidade e horas só dos recursos dela; um recurso que o dia não conhece começa disponível
    // (os simuladores com os nomes anteriores à versão 5 são renomeados antes)
    x.frota = normalizarFrota(x.frota);
    // Horários de decolagem de cada categoria
    x.horarios = normalizarHorarios(x.horarios);
    // Ordem dos aviões no hangar: só os da frota; quem falta entra no fundo
    x.hangar = normalizarHangar(x.hangar, ativos ? x.frota.filter(f => !inativo(f)) : x.frota);
    // Limites da Lei do Aeronauta e as horas de voo fora do app de cada instrutor ('AAAA-MM' ou 'AAAA-00')
    x.limites = normalizarLimites(x.limites);
    // O programa dos cursos e o curso de cada aluno
    x.cursos = normalizarCursos(x.cursos);
    // A configuração do painel: só quando foi mudada (sem ela, o padrão)
    if (x.painel) x.painel = normalizarPainel(x.painel);
    else delete x.painel;
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

    // Pessoas nos tipos certos: sem id inteiro, a pessoa sai; nome de até 80 caracteres; peso de 0 a 300 kg;
    // disponibilidade com uma janela por período; bloqueios só com ids
    const nome = (v, padrao) => (typeof v === 'string' && v.trim() ? v.slice(0, LIMITE_DO_NOME) : padrao);
    const comId = p => Boolean(p) && typeof p === 'object' && Number.isInteger(p.id) && p.id > 0;
    x.ins = x.ins.filter(comId);
    x.ins.forEach(i => {
      Object.assign(i, { nm: nome(i.nm, `Instrutor ${i.id}`), on: i.on !== false, kg: pesoValido(i.kg) });
      // Inativo no cadastro (formato 26): só true fica
      if (i.inativo !== true) delete i.inativo;
      i.aw = Array.isArray(i.aw) && i.aw.length === WIN.length ? i.aw.map(v => v === true) : WIN.map(() => true);
    });
    x.stu = x.stu.filter(comId);
    x.stu.forEach(s => {
      Object.assign(s, { nm: nome(s.nm, `Aluno ${s.id}`), kg: pesoValido(s.kg), bl: Array.isArray(s.bl) ? s.bl.filter(id => Number.isInteger(id) && id > 0) : [] });
      if (s.inativo !== true) delete s.inativo;
      // “Priorizar com”: só ids, sem repetir e sem os de “Não escalar com”; vazio, o campo sai
      const pares = Array.isArray(s.voaCom) ? [...new Set(s.voaCom.filter(id => Number.isInteger(id) && id > 0 && !s.bl.includes(id)))] : [];
      if (pares.length) s.voaCom = pares;
      else delete s.voaCom;
      s.extra = Array.isArray(s.extra) ? s.extra.filter(ex => ex && typeof ex === 'object') : [];
    });

    // Habilitações individuais: quem só tem o nível A01–A09 (anterior à versão 6) recebe o que o nível permitia
    x.ins.forEach(i => { i.hab = Array.isArray(i.hab) ? normalizarHabilitacoes(i.hab) : habilitacoesDoNivel(i.lv); });

    // Filas do rodízio só com os instrutores habilitados (um instrutor recém-habilitado entra no fim)
    x.filas = ajustarFilas(x.filas, ativos ? x.ins.filter(i => !inativo(i)) : x.ins);

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

  // Escala por data ------------------------------------------------------------------------
  // JSON do cadastro lido ou gravado por último: o cadastro só é regravado quando muda
  cadastroGravado: undefined,

  // Estado e escala de uma data. Data sem escala começa com uma cópia do dia anterior (nada é gravado).
  // Dados num formato anterior chegam já no formato atual (o que está gravado é atualizado na próxima gravação)
  async carregarDia(data) {
    const guardado = await this.backend.ler('cadastro');
    this.cadastroGravado = guardado ? JSON.stringify(guardado) : undefined;
    const cadastro = migrarCadastro(guardado);
    const dia = migrarDia(await this.backend.ler(`dia:${data}`));
    // O inativo do cadastro vale de hoje em diante: as filas e o hangar da data são os dos ativos
    const vale = inativoValeEm(data, hojeISO());
    const instrutores = ativosNaData((cadastro && cadastro.ins) || [], data, hojeISO());
    // O dia guardado antes da data: a cópia da data nova e, quando é ontem, os noturnos que voltam de BH hoje
    const anterior = await this.backend.diaAnterior(data);
    const base = dia || diaParaCopiar(migrarDia((anterior || {}).conteudo), instrutores);
    const estado = this.normalizeAndMigrateState(juntar(cadastro || { nid: 1000, ins: [], stu: [] }, base || diaPadrao()), { ativos: vale });
    // As horas de voo de cada instrutor antes da data e o fim de ontem (limites da lei), mais as de fora do app. Não são
    // gravadas (vão à parte, para o estado da tela): saem das escalas guardadas a cada abertura. Sem resposta, o motor
    // confere só os limites do dia
    // Sem resposta, a data abre assim mesmo e diz o que ficou indisponível: a tela avisa e desliga o que
    // depende disso (Aprovar escala sem as horas; a próxima missão e o resultado sem os resultados)
    const lidos = await this.lerDadosAParte(data);
    const horasBase = lidos.horasBase || {};
    // Os noturnos de ontem: a volta de BH entra hoje na escala, e o repouso deles é um aviso (js/noturno.js)
    const noturnos = noturnosDaVespera(anterior, data);
    if (noturnos.length) estado.noturnosDaVespera = noturnos;
    const horasDosInstrutores = comRepousoDoNoturno(comHorasExternas(horasBase, estado.ins, data), noturnos);
    // A escala gravada só vale no formato do motor; adulterada, a tela usa a escala calculada. Também quando as voltas do
    // noturno dela não conferem com os noturnos de ontem (o noturno mudou depois): a calculada é gravada na próxima alteração
    const gravada = dia ? normalizarEscalaGravada(dia.resultado) : null;
    const escala = gravada && voltasConferem(gravada, noturnos) ? gravada : null;
    const resultados = lidos.resultados || { situacao: [], doDia: [] };
    // O programa dos cursos ainda no cadastro (programaNoCadastro): a tela diz por que a próxima missão e o progresso
    // ficam desligados
    const indisponiveis = [...(lidos.horasBase ? [] : ['horas']), ...(lidos.resultados ? [] : ['resultados']),
      ...(lidos.programa ? [] : ['cursos']), ...(programaNoCadastro(guardado) ? ['cursos-pendentes'] : [])];
    return { estado, escala, novo: !dia, horasBase, horasDosInstrutores, resultados, programa: lidos.programa || [], indisponiveis };
  },

  // O que vai à parte do dia (não é gravado nele): as horas de voo de cada instrutor antes da data (limites da lei), os
  // resultados das missões dos cursos (a situação de cada missão e os registros da data) e o programa dos cursos (as
  // tabelas dos cursos; neste navegador, acpm4_cursos). Sem resposta, null
  async lerDadosAParte(data) {
    const ler = async fn => fn();
    const [horasBase, resultados, programa] = await Promise.all([
      ler(() => this.backend.horasDosInstrutores(data)).then(h => h || {}, () => null),
      ler(() => Promise.all([this.backend.situacaoDasMissoes(), this.backend.resultadosDoDia(data)]))
        .then(([situacao, doDia]) => ({ situacao: situacao || [], doDia: doDia || [] }), () => null),
      ler(() => this.lerProgramas()).catch(() => null)
    ]);
    return { horasBase, resultados, programa };
  },

  async salvarDia(data, estado, escala) {
    if (this.readOnly) return false;
    const partes = separar(estado);
    const cadastro = { ...partes.cadastro, esquema: ESQUEMA };
    const dia = { ...partes.dia, esquema: ESQUEMA };
    const json = JSON.stringify(cadastro);
    // O cadastro primeiro; o dia só depois que o cadastro foi gravado (o dia não fica gravado com pessoas
    // ou pedidos que o cadastro gravado não tem)
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

  // Os pedidos não cancelados de cada dia, de de a ate: { 'AAAA-MM-DD': n } (o calendário do trilho)
  async contagemDaAgenda(de, ate) {
    const contagem = {};
    for (const p of await this.agenda(de, ate)) if (!p.cancelada_em) contagem[p.data] = (contagem[p.data] || 0) + 1;
    return contagem;
  },

  registrarSolicitacao(dados) {
    return this.backend.registrarSolicitacao(dados);
  },

  cancelarSolicitacao(id, por) {
    return this.backend.cancelarSolicitacao(id, por);
  },

  // Dados pessoais: fora do estado e do cadastro. No modo compartilhado o servidor decide quem lê e grava
  // (operadores, administradores e a secretaria, que entra no modo só leitura da escala)
  listarDadosPessoais(tipo) {
    return this.backend.listarDadosPessoais(tipo);
  },

  lerDadosPessoais(tipo, id) {
    return this.backend.lerDadosPessoais(tipo, id);
  },

  // Grava a partir da versão lida ao abrir o painel; o histórico da data (registrado junto) vem na resposta
  salvarDadosPessoais(tipo, id, dados, { atualizadoEm = null, data = null } = {}) {
    return this.backend.salvarDadosPessoais(tipo, id, dados, { autor: this.autorAtual || null, atualizadoEm, data });
  },

  // Resultados das missões dos cursos: fora do estado; o servidor decide quem lê (os perfis da escala) e quem
  // registra (operadores e administradores)
  registrarResultado(registro) {
    if (this.readOnly) return somenteLeitura();
    return this.backend.registrarResultado(registro, { autor: this.autorAtual || null });
  },

  // O programa dos cursos (as tabelas dos cursos; no modo local, este navegador), nos formatos certos: lido de novo
  // depois de uma gravação recusada. Sem resposta, o erro vai para quem chamou
  async lerProgramas() {
    return normalizarProgramas(await this.backend.programaDosCursos());
  },

  // O programa dos cursos ainda espera a conversão do cadastro (programaNoCadastro)? "Tentar de novo", na tela aberta
  // antes dela, pergunta: o cadastro é lido de novo só para isso, sem mudar a versão que a gravação seguinte dele leva (os
  // dados da tela continuam os lidos com a data). Sem resposta, o erro vai para quem chamou
  async programaAindaNoCadastro() {
    return programaNoCadastro(await this.backend.ler('cadastro', { guardarVersao: false }));
  },

  // Grava o curso inteiro (o nome, se está ativo, as fases e as missões) a partir da versão lida (0 cria), com a
  // descrição da alteração. No modo compartilhado, só o Administrador (o servidor confere); a recusa vem com o código e
  // o campo (e.campo)
  salvarCurso(sigla, versaoLida, conteudo, descricao) {
    if (this.readOnly) return somenteLeitura();
    return this.backend.salvarCurso(sigla, versaoLida, conteudo, { descricao, autor: this.autorAtual || null });
  },

  // A conversão única do programa guardado no cadastro (cadastro.cursos, que fica como cópia) para as tabelas dos cursos:
  // cada curso numa fase só, com as missões na mesma ordem (programaDoLegado, com ids novos). Os três cursos vão, também
  // os vazios: o servidor pula o que já é igual e, com o cadastro já no formato dos cursos, não grava nada. Uma recusa ou
  // a falta de conexão vai para quem chamou (a conversão é retomada na próxima abertura)
  importarProgramaDoCadastro(cadastro) {
    return this.backend.importarCursos(programaDoLegado(normalizarCursos(cadastro && cadastro.cursos)), { autor: this.autorAtual || null });
  },

  // O METAR e o TAF do painel (js/meteorologia.js), pela função do servidor. Sem servidor (este navegador): null, sem
  // busca (o painel diz "Meteorologia indisponível")
  meteorologia() {
    return typeof this.backend.meteorologia === 'function' ? this.backend.meteorologia() : null;
  },

  async biDoPeriodo(de, ate) {
    return biDosDias((await this.backend.listarDias(de, ate)).map(d => ({ ...d, conteudo: migrarDia(d.conteudo) })));
  },

  // Converte os documentos antigos (estado, escala, histórico e BI) para o formato por data, uma vez só.
  // A origem pode ser outro backend (envio dos dados do navegador). Os documentos antigos ficam como cópia;
  // dias que já existem não são sobrescritos e o cadastro é gravado por último (marca a migração como concluída). Antes
  // dele, o programa dos cursos vai para as tabelas dos cursos (o cadastro já sai no formato dos cursos, que encerra a
  // conversão do programa). Se uma gravação falhar, para com erro antes do cadastro: a conversão é retomada na próxima
  // abertura.
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
    await this.importarProgramaDoCadastro(plano.cadastro);
    const cadastro = migrarCadastro(plano.cadastro);
    if (!await this.backend.gravar('cadastro', cadastro)) throw new Error('A conversão dos dados não terminou (cadastro).');
    this.cadastroGravado = JSON.stringify(cadastro);
    return plano.dataAtual;
  },

  // Regrava no formato atual tudo o que está num formato anterior: todos os dias e, por último, o cadastro (que
  // marca a atualização como concluída). Antes do formato dos cursos, o programa guardado no cadastro vai para as tabelas
  // dos cursos depois dos dias e antes do cadastro: gravado no formato dos cursos, o cadastro encerra essa conversão, que
  // não volta a ser feita. Se uma gravação (ou a conversão) falhar, para com erro: é retomada na próxima abertura.
  async atualizarFormatoGravado() {
    if (this.readOnly) return false;
    const cadastro = await this.backend.ler('cadastro');
    if (!precisaMigrar(cadastro)) return false;
    for (const data of await this.backend.diasEmFormatoAntigo(ESQUEMA)) {
      const dia = await this.backend.ler(`dia:${data}`);
      if (!precisaMigrar(dia)) continue;
      if (!await this.backend.gravar(`dia:${data}`, migrarDia(dia))) throw new Error(`A atualização dos dados não terminou (dia ${data}).`);
    }
    if (antesDosCursosProprios(cadastro)) await this.importarProgramaDoCadastro(cadastro);
    const novo = migrarCadastro(cadastro);
    if (!await this.backend.gravar('cadastro', novo)) throw new Error('A atualização dos dados não terminou (cadastro).');
    this.cadastroGravado = JSON.stringify(novo);
    return true;
  }
};
