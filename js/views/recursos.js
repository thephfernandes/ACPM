// Aba Recursos, em duas vistas (js/views/vistas.js). A Disponibilidade do dia vale para a data aberta no topo: os horários
// fechados nesta data (js/views/fechamentos.js), a tabela dos aviões e simuladores (disponível ou em manutenção, as horas até a revisão de 50 horas e o que
// o avião voa na escala do dia; cada categoria recolhe e abre) e, ao lado dela, a ordem no hangar. O Cadastro vale para
// todas as datas: a frota, com os atributos e o Retirar, e os horários de decolagem (js/views/horarios.js). A busca pela
// matrícula e as categorias (js/views/filtros-dos-recursos.js) valem para a tabela, a frota e os horários, nunca para o
// hangar; a barra diz quantos recursos aparecem.
import { AIRCRAFT_EQ_TYPES, SIM_EQ_TYPES, REVISAO_H, GROUND_REG } from '../config.js';
import { ligada } from '../funcionalidades.js';
import { normalizarHangar } from '../hangar.js';
import { FROTA_INICIAL, ATRIBUTOS_DO_RECURSO, atributoVale, exigenciasDoAviao, habilitacaoDoAviao, salaDisponivel } from '../frota.js';
import { nomeDoRecurso } from '../categorias.js';
import { nomeDaHabilitacao } from '../habilitacoes.js';
import { S, RES, voosQueVoam, isGestor, inativoNaDataAberta } from '../state.js';
import { umPorUnidade } from '../voo.js';
import { $, trocarConteudo } from '../dom.js';
import { hm, fmtH, esc } from '../format.js';
import { rHorarios } from './horarios.js';
import { rFechamentos } from './fechamentos.js';
import { recursoAVista, filtrandoRecursos, SALA_GROUND } from './filtros-dos-recursos.js';
import { mostrarVista } from './vistas.js';

// Os grupos usam os ids das categorias do filtro (js/categorias.js)
const GRUPOS = [...AIRCRAFT_EQ_TYPES.map(tipo => ({ id: tipo, rotulo: tipo, tipos: [tipo] })), { id: 'sim', rotulo: 'Simuladores', tipos: SIM_EQ_TYPES }];
// Os recursos de cada grupo, na ordem da frota do cadastro: todos e os que os filtros deixam à vista (o grupo sem nenhum à
// vista não aparece)
const gruposDaFrota = () => GRUPOS.map(grupo => {
  const recursos = grupo.tipos.flatMap(tipo => (S.frota || []).filter(f => f.tipo === tipo));
  return { ...grupo, recursos, aVista: recursos.filter(recursoAVista) };
}).filter(g => g.aVista.length);

// Categorias recolhidas (continuam assim quando a escala é refeita, até recarregar a página)
const recolhidos = new Set();
export function alternarGrupoDaFrota(id) {
  const recolher = !recolhidos.has(id);
  if (recolher) recolhidos.add(id);
  else recolhidos.delete(id);
  document.querySelectorAll(`#revisao tr[data-r][data-grupo="${id}"]`).forEach(tr => { tr.hidden = recolher; });
  const botao = document.querySelector(`#revisao [data-recolher-grupo="${id}"]`);
  if (botao) botao.setAttribute('aria-expanded', String(!recolher));
}

// Disponível nesta data: a Sala Ground pelo "Disponível" dela (S4: sem a chave, disponível); os outros, pelo av
const disponivel = r => (r === GROUND_REG ? salaDisponivel(S.av) : Boolean(S.av[r]));

function situacao(r, voadas, revisao) {
  if (r === GROUND_REG && !disponivel(r)) return '<span class="tag">Indisponível</span>';
  if (!disponivel(r)) return '<span class="tag">Em manutenção</span>';
  if (revisao && revisao.paraAs !== null) {
    return `<span class="tag er">Parou para revisão de 50 horas ${revisao.voadas ? 'às ' + hm(revisao.paraAs) : '(sem saldo hoje)'}</span>`;
  }
  if (!voadas) return '<span class="sm">—</span>';
  return `${fmtH(voadas)} na escala${revisao ? ` · termina com ${fmtH(horasDisponiveis(revisao.fim))} disponíveis` : ''}`;
}

// As horas disponíveis até a revisão (a operadora lança as disponíveis; o dia guarda as horas desde a revisão, 50 menos
// as disponíveis)
const horasDisponiveis = horas => Math.round(Math.max(0, REVISAO_H - horas) * 10) / 10;

// A barra das horas disponíveis: âmbar abaixo de 10 h e vermelha abaixo de 5 h
function barra(horas) {
  const resta = horasDisponiveis(horas);
  const cor = resta < 5 ? 'er' : resta < 10 ? 'wa' : '';
  const largura = Math.max(2, Math.min(100, (resta / REVISAO_H) * 100)).toFixed(0);
  return `<span class="barra ${cor}"><i style="width:${largura}%"></i></span>`;
}

function linha(recurso, grupo, voadas, revisao) {
  const { reg: r, tipo } = recurso;
  const aviao = AIRCRAFT_EQ_TYPES.includes(tipo);
  const horas = S.horas[r];
  const temHoras = typeof horas === 'number';
  const parafuso = etiquetasDoRecurso(recurso);
  const sala = r === GROUND_REG;
  return `<tr data-r="${esc(r)}" data-grupo="${grupo}"${disponivel(r) ? '' : ' class="manutencao"'}${recolhidos.has(grupo) ? ' hidden' : ''}>
    <td><label class="alvo"><input type="checkbox" class="sw" data-a="av" data-id="${esc(r)}"${disponivel(r) ? ' checked' : ''} aria-label="${esc(nomeDoRecurso(r))} disponível"></label></td>
    <td><b>${esc(nomeDoRecurso(r))}</b>${aviao || sala ? '' : ` <small class="sm">${tipo}</small>`}${parafuso}</td>
    <td>${aviao ? `<span class="horas-disp"><input type="number" class="horas" min="0" max="${REVISAO_H}" step="0.1" inputmode="decimal" data-a="horas" data-horas="${esc(r)}" value="${temHoras ? horasDisponiveis(horas) : ''}" placeholder="—" aria-label="Horas disponíveis do ${esc(r)} até a revisão"> h${temHoras ? barra(horas) : ''}</span>` : ''}</td>
    <td>${situacao(r, voadas, revisao)}</td>
    <td class="edit-only acoes-frota">${aviao ? `<button class="btn quiet rev" data-act="revisao" data-id="${esc(r)}">Revisão feita</button>` : ''}</td>
  </tr>`;
}

// Quando os filtros não deixam nenhum recurso: o motivo e "Limpar filtros" (sem data-act: vale também para o Gestor). O
// id do botão faz o foco de quem usa o teclado continuar nele quando a tabela ou a frota são refeitas
const NENHUM = 'Nenhum recurso com esses filtros.';
const botaoDeLimpar = lugar => `<button type="button" class="btn quiet" id="limpar-filtros-${lugar}" data-limpar-recursos>Limpar filtros</button>`;
const semResultado = () => filtrandoRecursos() && (S.frota || []).length > 0;

// A frota, por tipo: refeita junto com a escala (as horas voadas no dia e onde cada avião para). O cabeçalho do grupo
// conta todos os recursos da categoria, também os que os filtros escondem
export function rRevisao() {
  const resumo = (RES && RES.revisao) || {};
  // As horas de cada recurso na escala: uma vez por unidade (a turma de Ground tem uma linha por aluno, mas ocupa a sala
  // uma vez só, como no mapa)
  const voadas = {};
  umPorUnidade(voosQueVoam()).forEach(o => { voadas[o.r] = (voadas[o.r] || 0) + o.h; });
  // A Sala Ground (S4) é o último grupo da tabela desta data, com o "Disponível" dela e sem horas: ela não é da frota (não
  // está no Cadastro), mas passa pelos mesmos filtros (a categoria ground, a busca pela matrícula)
  const daSala = { id: 'ground', rotulo: 'Sala Ground', recursos: [SALA_GROUND] };
  const comASala = [...gruposDaFrota(), { ...daSala, aVista: daSala.recursos.filter(recursoAVista) }].filter(g => g.aVista.length);
  const grupos = comASala.map(({ id, rotulo, recursos, aVista }) => {
    const disponiveis = recursos.filter(f => disponivel(f.reg)).length;
    return `<tr class="grupo"><td colspan="5"><button type="button" class="grupo-btn" data-recolher-grupo="${id}" aria-expanded="${!recolhidos.has(id)}"><svg class="ico seta" aria-hidden="true"><use href="#i-baixo"/></svg>${rotulo} <small>${disponiveis} de ${recursos.length} disponíveis</small></button></td></tr>` +
      aVista.map(f => linha(f, id, voadas[f.reg] || 0, resumo[f.reg])).join('');
  });
  trocarConteudo($('#revisao'), grupos.length || !semResultado() ? grupos.join('')
    : `<tr class="sem-resultado"><td colspan="5" class="h"><div class="sem-resultado-texto">${NENHUM} ${botaoDeLimpar('revisao')}</div></td></tr>`);
}

// Os atributos marcados de um recurso, como etiquetas (a dica explica cada um)
const DICA_DO_ATRIBUTO = { soParafuso: 'so-parafuso', soVfr: 'so-vfr', habilitacaoPropria: 'habilitacao-propria' };
// (a habilitação própria é a do recurso em exige; o que mais ele exige do instrutor aparece pelo nome)
const etiquetasDoRecurso = f => [
  ...Object.keys(ATRIBUTOS_DO_RECURSO).filter(a => f[a]).map(a => ` <span class="tag fb" data-dica="${DICA_DO_ATRIBUTO[a]}">${ATRIBUTOS_DO_RECURSO[a].nome}</span>`),
  ...exigenciasDoAviao(f).filter(h => h !== habilitacaoDoAviao(f.reg)).map(h => ` <span class="tag fb" data-dica="habilitacao-propria">Exige ${esc(nomeDaHabilitacao(h))}</span>`)
].join('');
// O recurso com os atributos abertos para editar (um por vez)
let atributosAbertos = null;
export function alternarAtributos(reg) { atributosAbertos = atributosAbertos === reg ? null : reg; rFrota(); }
const editorDeAtributos = f => `<fieldset class="atributos-recurso"><legend class="sr">Atributos de ${esc(f.reg)}</legend>${Object.keys(ATRIBUTOS_DO_RECURSO).filter(a => atributoVale(a, f.tipo))
  .map(a => `<label class="chk"><input type="checkbox" data-a="atributo" data-r="${esc(f.reg)}" data-atributo="${a}"${f[a] ? ' checked' : ''}> ${ATRIBUTOS_DO_RECURSO[a].nome}</label>`).join('')}</fieldset>`;

// A frota (vale para todas as datas): cada recurso uma vez, por categoria, com os atributos (Só Parafuso, Só VFR e
// Habilitação própria), Atributos (para marcar) e o Retirar. A disponibilidade e as horas ficam na tabela desta data
function rFrota() {
  const lista = $('#frota');
  if (!lista) return;
  const grupos = gruposDaFrota().map(({ rotulo, recursos, aVista }) =>
    `<li class="grupo"><h5>${rotulo} <small>${recursos.length} ${recursos.length === 1 ? 'recurso' : 'recursos'}</small></h5><ul class="frota-itens">` +
      aVista.map(f => `<li class="frota-item${atributosAbertos === f.reg ? ' aberto' : ''}" data-r="${esc(f.reg)}">
        ${isGestor() ? `<b>${esc(f.reg)}</b>` : `<button type="button" class="frota-reg" data-act="atributos-recurso" data-id="${esc(f.reg)}" aria-expanded="${atributosAbertos === f.reg}" aria-label="Atributos de ${esc(f.reg)}" title="Atributos (Só Parafuso, Só VFR, Habilitação própria)">${esc(f.reg)}</button>`}${AIRCRAFT_EQ_TYPES.includes(f.tipo) ? '' : ` <small class="sm">${esc(f.tipo)}</small>`}${etiquetasDoRecurso(f)}
        <button class="btn quiet rev ret edit-only" data-act="retirar-recurso" data-id="${esc(f.reg)}" aria-label="Retirar ${esc(f.reg)} da frota">Retirar</button>
        ${atributosAbertos === f.reg ? editorDeAtributos(f) : ''}
      </li>`).join('') + '</ul></li>');
  trocarConteudo(lista, grupos.length || !semResultado() ? grupos.join('')
    : `<li class="sem-resultado h">${NENHUM} ${botaoDeLimpar('frota')}</li>`);
}

// Quantos recursos aparecem: "3 de 27 recursos" com algum filtro, "27 recursos" sem nenhum (a frota e a Sala Ground, as
// linhas da tabela desta data). A região é de status (o leitor de tela dita quando o texto muda); na digitação da busca,
// ela espera a pessoa parar
let esperaDaContagem = null;
function contarRecursos(esperar) {
  const frota = S.frota || [];
  const recursos = [...frota, SALA_GROUND];
  const nome = recursos.length === 1 ? 'recurso' : 'recursos';
  const texto = !frota.length ? '' : filtrandoRecursos() ? `${recursos.filter(recursoAVista).length} de ${recursos.length} ${nome}` : `${recursos.length} ${nome}`;
  clearTimeout(esperaDaContagem);
  const escrever = () => {
    const lugar = $('#rec-contagem');
    if (lugar && lugar.textContent !== texto) lugar.textContent = texto;
  };
  if (esperar) esperaDaContagem = setTimeout(escrever, esperar);
  else escrever();
}

// Os filtros mudaram: a tabela, a frota, os horários e a contagem (o hangar e as janelas não mudam)
export function aplicarFiltrosDosRecursos({ esperar = 0 } = {}) {
  rRevisao();
  rFrota();
  rHorarios();
  contarRecursos(esperar);
}

export function rRec() {
  mostrarVista('rec');
  rFechamentos();
  rHangar();
  aplicarFiltrosDosRecursos();
}

// A ordem dos aviões no hangar, da frente para o fundo, com o que cada um voa na escala da data; os botões aparecem com
// o mouse ou o foco (como no Rodízio). Sempre com todos os aviões: os filtros não valem aqui (Subir e Descer andam na
// lista inteira). Com o hangar desligado (js/funcionalidades.js), o painel não está na página
export function rHangar() {
  const lista = $('#hangar');
  if (!lista || !ligada('hangar')) return;
  // Na data em que o inativo vale, a ordem é a dos ativos: o inativo sai e volta no fundo (js/inativos.js)
  const frota = (S.frota || FROTA_INICIAL).filter(f => !inativoNaDataAberta(f));
  const hangar = normalizarHangar(S.hangar, frota);
  const voos = voosQueVoam();
  trocarConteudo(lista, hangar.map((r, i) => {
    const tipo = (frota.find(f => f.reg === r) || {}).tipo || '';
    const naEscala = voos.filter(o => o.r === r).length;
    const situacao = S.av[r] === false ? '<span class="tag fb">manutenção</span>'
      : naEscala ? `<span class="tag grp">${naEscala} ${naEscala === 1 ? 'voo' : 'voos'} nesta data</span>` : '';
    const botao = (acao, icone, rotulo, desligado) =>
      `<button class="x" data-act="hangar-${acao}" data-id="${esc(r)}" aria-label="${rotulo}" title="${rotulo}"${desligado ? ' disabled' : ''}><svg class="ico"><use href="#${icone}"/></svg></button>`;
    return `<li data-id="${esc(r)}">
        <span class="pos">${i + 1}º</span>
        <b>${esc(r)}</b> <small>${esc(tipo)}</small>
        ${situacao}
        <span class="acoes edit-only">
          ${botao('subir', 'i-cima', `Subir ${esc(r)}`, i === 0)}${botao('descer', 'i-baixo', `Descer ${esc(r)}`, i === hangar.length - 1)}${botao('frente', 'i-topo', `Pôr ${esc(r)} na frente do hangar`, i === 0)}
        </span>
      </li>`;
  }).join(''));
}
