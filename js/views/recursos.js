// Aba Recursos: janelas de operação e a frota numa tabela só: disponível ou em manutenção, horas desde a última
// revisão de 50 horas, saldo até a revisão e o que o avião voa na escala do dia. A tabela mostra uma categoria ou
// todas, e cada categoria recolhe e abre. Embaixo, a ordem dos aviões no hangar.
import { WIN, NI, AIRCRAFT_EQ_TYPES, SIM_EQ_TYPES, REVISAO_H } from '../config.js';
import { normalizarHangar } from '../hangar.js';
import { FROTA_INICIAL } from '../frota.js';
import { S, RES } from '../state.js';
import { $ } from '../dom.js';
import { hm, fmtH, esc } from '../format.js';
import { CATEGORIAS_COM_HORARIOS } from '../horarios.js';

// Os grupos usam os ids das categorias do filtro (js/categorias.js)
const GRUPOS = [...AIRCRAFT_EQ_TYPES.map(tipo => ({ id: tipo, rotulo: tipo, tipos: [tipo] })), { id: 'sim', rotulo: 'Simuladores', tipos: SIM_EQ_TYPES }];

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

function situacao(r, voadas, revisao) {
  if (!S.av[r]) return '<span class="tag">Em manutenção</span>';
  if (revisao && revisao.paraAs !== null) {
    return `<span class="tag er">Parou para revisão de 50 horas ${revisao.voadas ? 'às ' + hm(revisao.paraAs) : '(sem saldo hoje)'}</span>`;
  }
  if (!voadas) return '<span class="sm">—</span>';
  return `${fmtH(voadas)} na escala${revisao ? ` · termina com ${fmtH(revisao.fim)}` : ''}`;
}

// Saldo até a revisão, com uma barra: âmbar abaixo de 10 h e vermelha abaixo de 5 h
function saldo(horas) {
  const resta = Math.max(0, REVISAO_H - horas);
  const cor = resta < 5 ? 'er' : resta < 10 ? 'wa' : '';
  const largura = Math.max(2, Math.min(100, (resta / REVISAO_H) * 100)).toFixed(0);
  return `<span class="saldo">${fmtH(resta)}</span><span class="barra ${cor}"><i style="width:${largura}%"></i></span>`;
}

function linha({ reg: r, tipo, soParafuso }, grupo, voadas, revisao) {
  const aviao = AIRCRAFT_EQ_TYPES.includes(tipo);
  const horas = S.horas[r];
  const temHoras = typeof horas === 'number';
  const parafuso = soParafuso ? ' <span class="tag fb" title="Exclusivo para a missão de Parafuso">Só Parafuso</span>' : '';
  return `<tr data-r="${esc(r)}" data-grupo="${grupo}"${S.av[r] ? '' : ' class="manutencao"'}${recolhidos.has(grupo) ? ' hidden' : ''}>
    <td><label class="alvo"><input type="checkbox" class="sw" data-a="av" data-id="${esc(r)}"${S.av[r] ? ' checked' : ''} aria-label="${esc(r)} disponível"></label></td>
    <td><b>${esc(r)}</b>${aviao ? '' : ` <small class="sm">${tipo}</small>`}${parafuso}</td>
    <td>${aviao ? `<input type="number" class="horas" min="0" max="60" step="0.1" inputmode="decimal" data-a="horas" data-horas="${esc(r)}" value="${temHoras ? horas : ''}" placeholder="—" aria-label="Horas do ${esc(r)} desde a última revisão"> h` : ''}</td>
    <td>${aviao && temHoras ? saldo(horas) : ''}</td>
    <td>${situacao(r, voadas, revisao)}</td>
    <td class="edit-only acoes-frota">${aviao ? `<button class="btn quiet rev" data-act="revisao" data-id="${esc(r)}">Revisão feita</button>` : ''}<button class="btn quiet rev ret" data-act="retirar-recurso" data-id="${esc(r)}" aria-label="Retirar ${esc(r)} da frota">Retirar</button></td>
  </tr>`;
}

// A frota, por tipo: refeita junto com a escala (as horas voadas no dia e onde cada avião para)
export function rRevisao() {
  const resumo = (RES && RES.revisao) || {};
  const voadas = {};
  ((RES && RES.out) || []).forEach(o => { voadas[o.r] = (voadas[o.r] || 0) + o.h; });
  const categoria = ($('#flt-rec-cat') && $('#flt-rec-cat').value) || '';
  $('#revisao').innerHTML = GRUPOS.filter(g => !categoria || g.id === categoria).map(({ id, rotulo, tipos }) => {
    // A frota do cadastro, na ordem de cada tipo (uma categoria sem recursos não aparece)
    const recursos = tipos.flatMap(tipo => (S.frota || []).filter(f => f.tipo === tipo));
    if (!recursos.length) return '';
    const disponiveis = recursos.filter(f => S.av[f.reg]).length;
    return `<tr class="grupo"><td colspan="6"><button type="button" class="grupo-btn" data-recolher-grupo="${id}" aria-expanded="${!recolhidos.has(id)}"><svg class="ico seta" aria-hidden="true"><use href="#i-baixo"/></svg>${rotulo} <small>${disponiveis} de ${recursos.length} disponíveis</small></button></td></tr>` +
      recursos.map(f => linha(f, id, voadas[f.reg] || 0, resumo[f.reg])).join('');
  }).join('');
}

// Horários de decolagem de cada categoria: tirar (✕), pôr um horário e os modelos (as janelas do dia e de 30 em 30)
export const NOMES_DAS_CATEGORIAS = { C152: 'C152', C172: 'C172', sim: 'Simulador', 'PA-34': 'PA-34' };
export function rHorarios() {
  $('#horarios').innerHTML = CATEGORIAS_COM_HORARIOS.map(cat => {
    const nome = NOMES_DAS_CATEGORIAS[cat];
    const lista = (S.horarios && S.horarios[cat]) || [];
    return `<div class="horarios-cat" data-cat="${cat}">
      <b class="horarios-nome">${esc(nome)}</b>
      <span class="horarios-lista">${lista.map(m => `<span class="hr-chip">${hm(m)}<button type="button" class="edit-only" data-act="remover-horario" data-cat="${cat}" data-min="${m}" aria-label="Tirar ${hm(m)} dos horários do ${esc(nome)}"><svg class="ico" aria-hidden="true"><use href="#i-fechar"/></svg></button></span>`).join('')}</span>
      <span class="horarios-acoes edit-only">
        <input type="time" class="hr-novo" step="300" min="06:00" max="17:00" aria-label="Novo horário do ${esc(nome)}">
        <button type="button" class="btn quiet" data-act="adicionar-horario" data-cat="${cat}">Adicionar</button>
        <button type="button" class="btn quiet" data-act="horarios-padrao" data-cat="${cat}">Janelas do dia</button>
        <button type="button" class="btn quiet" data-act="horarios-30" data-cat="${cat}">De 30 em 30 min</button>
      </span>
    </div>`;
  }).join('');
}

export function rRec() {
  $('#wins').innerHTML = WIN.map((w, i) => `<label class="janela${S.win[i] ? '' : ' off'}"><input type="checkbox" class="sw" data-a="win" data-i="${i}"${S.win[i] ? ' checked' : ''}><b>${w}</b> <small>${i == NI ? 'noturno' : (i + 1) + 'º'}</small></label>`).join('');
  rHorarios();
  rRevisao();
  rHangar();
}

// A ordem dos aviões no hangar, da frente para o fundo, com o que cada um voa na escala da data; os botões aparecem com
// o mouse ou o foco (como no Rodízio)
export function rHangar() {
  const lista = $('#hangar');
  if (!lista) return;
  const frota = S.frota || FROTA_INICIAL;
  const hangar = normalizarHangar(S.hangar, frota);
  const voos = (RES && RES.out) || [];
  lista.innerHTML = hangar.map((r, i) => {
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
  }).join('');
}
