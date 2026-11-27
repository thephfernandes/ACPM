// Recursos: a frota (acrescentar e retirar), a disponibilidade e as horas até a revisão de 50 horas, as janelas de
// operação, o hangar, os horários de decolagem e os filtros (a busca pela matrícula e as categorias)
import { gravarAlteracao, aindaNaoAbriu } from '../actions.js';
import { categoriaDoTipo, nomeDoRecurso, doNomeDaCategoria } from '../categorias.js';
import { REVISAO_H, GROUND_REG } from '../config.js';
import { $, showToast, fecharNoEsc } from '../dom.js';
import { fmtH, lerHoras } from '../format.js';
import { ligada } from '../funcionalidades.js';
import { novoRecurso, ATRIBUTOS_DO_RECURSO, atributoVale, comAtributo } from '../frota.js';
import { normalizarHangar, moverNoHangar } from '../hangar.js';
import { horariosDaMissao, ajustarPreferencias, descreverHorarios } from '../horarios.js';
import { S, isGestor, getMissionTarget, inativoNaDataAberta } from '../state.js';
import { confirmado } from './confirmacao.js';
import { aoAcionar, aoMudarCampo, aoReverter } from './registro.js';
import { registrarDesenho, redesenharPorNome } from '../redesenho.js';
// "Horários fechados nesta data" (J): os eventos dela
import './fechamentos.js';
import { filtrarRecursos, limparFiltrosDosRecursos, manterRecursoAVista, criarFiltroDasCategorias } from '../views/filtros-dos-recursos.js';
import { abrirEditorDosHorarios, fecharEditorDosHorarios, tirarDoRascunho, porNoRascunho, escolherModelo, rascunhoDosHorarios, editorDosHorariosAberto } from '../views/horarios.js';
import { rRec, rRevisao, rHangar, alternarAtributos, aplicarFiltrosDosRecursos, alternarGrupoDaFrota } from '../views/recursos.js';
import { mostrarVista, vistaDa } from '../views/vistas.js';

// Os desenhos de Recursos (js/redesenho.js): a revisão de 50 horas e o hangar acompanham a escala
registrarDesenho('revisao', rRevisao, { em: ['escala'], ordem: 5 });
registrarDesenho('hangar', rHangar, { em: ['escala'], ordem: 6 });
registrarDesenho('recursos', rRec, { em: ['dados', 'consulta'], ordem: 10 });

// As categorias da frota que recolhem (Disponibilidade do dia) e as duas vistas de Recursos (Disponibilidade do dia e
// Cadastro, no controle segmentado: js/views/vistas.js)
document.addEventListener('click', e => {
  const grupo = e.target.closest('[data-recolher-grupo]');
  if (grupo) { alternarGrupoDaFrota(grupo.dataset.recolherGrupo); return; }
  const vista = e.target.closest('[data-vista-rec]');
  if (vista) mostrarVista('rec', vista.dataset.vistaRec);
});

// O campo do recurso com erro (aria-invalid); o motivo (#rec-erro) é a descrição dele: o leitor de tela diz os dois
const CAMPOS_DO_RECURSO = { reg: '#rec-reg', tipo: '#rec-tipo' };
const marcarCampoDoRecurso = campo => Object.entries(CAMPOS_DO_RECURSO).forEach(([nome, id]) => {
  if (nome === campo) $(id).setAttribute('aria-invalid', 'true');
  else $(id).removeAttribute('aria-invalid');
});

// Recursos: acrescentar um recurso à frota (matrícula, categoria e, no C152, "Só Parafuso"). "+ Novo recurso", na barra
// da aba, abre o Cadastro com o formulário em cima da frota (como "+ Novo instrutor"; o formulário que ficou aberto lá
// continua com o que foi digitado); no Cadastro, ele abre e fecha o formulário. Fechado por Cancelar ou depois de
// acrescentar, o foco volta ao botão
function mostrarFormDoRecurso(abrir) {
  $('#form-recurso').hidden = !abrir;
  $('#btn-novo-recurso').setAttribute('aria-expanded', String(abrir));
  $('#rec-erro').textContent = '';
  marcarCampoDoRecurso(null);
  if (!abrir) return;
  $('#form-recurso').reset();
  $('#rec-parafuso-rotulo').hidden = true;
  $('#rec-reg').focus();
}
$('#btn-novo-recurso').onclick = () => {
  const deOutraVista = vistaDa('rec') !== 'cadastro';
  mostrarVista('rec', 'cadastro');
  if (deOutraVista && !$('#form-recurso').hidden) $('#rec-reg').focus();
  else mostrarFormDoRecurso($('#form-recurso').hidden);
};
$('#rec-cancelar').onclick = () => {
  mostrarFormDoRecurso(false);
  $('#btn-novo-recurso').focus();
};
$('#rec-tipo').onchange = () => {
  $('#rec-parafuso-rotulo').hidden = $('#rec-tipo').value !== 'C152';
  if ($('#rec-tipo').value !== 'C152') $('#rec-parafuso').checked = false;
};
$('#form-recurso').onsubmit = e => {
  e.preventDefault();
  if (isGestor() || aindaNaoAbriu()) return;
  const { recurso, erro, campo } = novoRecurso(S.frota, { reg: $('#rec-reg').value, tipo: $('#rec-tipo').value, soParafuso: $('#rec-parafuso').checked });
  if (erro) { $('#rec-erro').textContent = erro; marcarCampoDoRecurso(campo); return; }
  S.frota.push(recurso);
  S.av[recurso.reg] = true;
  // O recurso novo aparece mesmo fora dos filtros (até eles mudarem)
  manterRecursoAVista(recurso.reg);
  gravarAlteracao('inc', `Recurso adicionado: ${recurso.reg} (${recurso.tipo}${recurso.soParafuso ? ', só Parafuso' : ''})`);
  rRec();
  mostrarFormDoRecurso(false);
  $('#btn-novo-recurso').focus();
  showToast(`${recurso.reg} adicionado à frota.`, 'ok');
};

// Os atributos de um recurso (Só Parafuso, Só VFR e Habilitação própria): o botão abre as caixas no próprio recurso, e
// cada mudança vale para todas as datas (a escala é refeita) e entra no histórico, que desfaz
aoAcionar('atributos-recurso', b => alternarAtributos(b.dataset.id));
// O atributo marcado ou desmarcado no recurso (a habilitação própria também em exige: js/frota.js, comAtributo)
function marcarAtributo(reg, atributo, val) {
  const i = (S.frota || []).findIndex(f => f.reg === reg);
  if (i < 0 || !atributoVale(atributo, S.frota[i].tipo)) return false;
  S.frota[i] = comAtributo(S.frota[i], atributo, val);
  return true;
}
aoMudarCampo('atributo', t => {
  const { r: reg, atributo } = t.dataset;
  if (!marcarAtributo(reg, atributo, t.checked)) return;
  gravarAlteracao('mod', `${reg}: ${ATRIBUTOS_DO_RECURSO[atributo].nome} ${t.checked ? 'marcado' : 'desmarcado'}`, {
    kind: 'setAtributo', reg, atributo, val: !t.checked, label: '↶ Reverter'
  });
  rRec(); redesenharPorNome('instrutores', 'habilitacoes-do-instrutor', 'pedidos-do-dia');
  document.querySelector(`[data-a="atributo"][data-r="${CSS.escape(reg)}"][data-atributo="${atributo}"]`)?.focus();
});

// Os filtros: a busca pela matrícula e as categorias, nas duas vistas. Na digitação, a contagem espera a pessoa parar.
// "Limpar filtros" aparece na tabela e na frota quando eles não deixam nenhum recurso; sem data-act, ele vale também para
// quem só consulta. O campo começa como o filtro, vazio (o navegador que devolve o texto de antes de recarregar a página
// não deixa o campo diferente do filtro)
const ESPERA_DA_DIGITACAO = 500;
$('#flt-rec-mat').value = '';
$('#flt-rec-mat').addEventListener('input', e => {
  filtrarRecursos({ matricula: e.target.value });
  aplicarFiltrosDosRecursos({ esperar: ESPERA_DA_DIGITACAO });
});
const categorias = criarFiltroDasCategorias(marcadas => {
  filtrarRecursos({ categorias: marcadas });
  aplicarFiltrosDosRecursos();
});
document.addEventListener('click', e => {
  if (!e.target.closest('[data-limpar-recursos]')) return;
  limparFiltrosDosRecursos();
  $('#flt-rec-mat').value = '';
  categorias.limpar();
  aplicarFiltrosDosRecursos();
  $('#flt-rec-mat').focus();
});



aoMudarCampo('av', t => {
  const reg = t.dataset.id;
  S.av[reg] = t.checked;
  // A Sala Ground não entra em manutenção: fica indisponível na data (S4)
  const fora = reg === GROUND_REG ? 'Indisponível' : 'Manutenção';
  gravarAlteracao(t.checked ? 'inc' : 'exc', `${nomeDoRecurso(reg)}: ${t.checked ? 'Disponível' : fora}`, {
    kind: 'setAv', reg, val: !t.checked, label: '↶ Reverter'
  });
  rRec();
});

aoMudarCampo('horas', t => {
  // As horas disponíveis até a revisão de 50 horas; o dia guarda as horas desde a revisão (50 menos as
  // disponíveis). Vazio: sem controle para o avião
  const reg = t.dataset.horas;
  const disponiveis = t.value === '' ? null : lerHoras(t.value);
  if (disponiveis !== null && !(disponiveis >= 0 && disponiveis <= REVISAO_H)) {
    showToast(`As horas disponíveis vão de 0 a ${REVISAO_H}.`);
    rRec();
    return;
  }
  if (disponiveis === null) delete S.horas[reg];
  else S.horas[reg] = Math.round((REVISAO_H - disponiveis) * 10) / 10;
  gravarAlteracao('mod', `${reg}: ${disponiveis === null ? 'horas disponíveis não informadas' : `${fmtH(disponiveis)} disponíveis até a revisão de 50 horas`}`);
  rRec();
});

// Retirar um recurso da frota (pede confirmação; o histórico desfaz). Instrutores é refeito: a habilitação própria do
// recurso sai do painel "Editar habilitações" e do filtro das habilitações
aoAcionar('retirar-recurso', b => {
  if (!confirmado(b, 'Confirmar retirada')) return;
  const recurso = S.frota.find(f => f.reg === b.dataset.id);
  if (!recurso) return;
  S.frota = S.frota.filter(f => f !== recurso);
  gravarAlteracao('exc', `Recurso retirado: ${recurso.reg} (${recurso.tipo})`, {
    kind: 'readicionarRecurso', recurso: { ...recurso }, av: S.av[recurso.reg] !== false, label: '↶ Reverter'
  });
  rRec(); redesenharPorNome('instrutores');
  showToast(`${recurso.reg} retirado da frota.`, 'ok');
});

// Hangar: sobe, desce ou põe na frente um avião (na data aberta; a data seguinte começa com esta ordem)
aoAcionar(['hangar-subir', 'hangar-descer', 'hangar-frente'], b => {
  if (!ligada('hangar')) return;
  const a = b.dataset.act;
  const r = b.dataset.id;
  S.hangar = moverNoHangar(normalizarHangar(S.hangar, S.frota.filter(f => !inativoNaDataAberta(f))), r, a.slice('hangar-'.length));
  gravarAlteracao('mod', `Hangar: ${r} passou para ${S.hangar.indexOf(r) + 1}º`);
  rHangar();
});

// Revisão de 50 horas feita: as horas do avião desde a última revisão voltam a zero (pede confirmação)
aoAcionar('revisao', b => {
  if (isGestor() || !confirmado(b, 'Confirmar revisão')) return;
  S.horas[b.dataset.id] = 0;
  gravarAlteracao('mod', `${b.dataset.id}: revisão de 50 horas feita (${REVISAO_H} h disponíveis)`);
  rRec();
});

// Horários de decolagem (um resumo e o botão Editar). O editor trabalha num rascunho; só "Salvar" muda a lista, e os
// pedidos da categoria acompanham (o horário mais próximo da lista nova). Uma entrada no histórico desfaz a lista e os
// pedidos que mudaram
aoAcionar('editar-horarios', b => abrirEditorDosHorarios(b.dataset.cat));
aoAcionar('rascunho-tirar', b => tirarDoRascunho(+b.dataset.min));
aoAcionar('rascunho-por', () => porNoRascunho());
aoAcionar('cancelar-horarios', () => fecharEditorDosHorarios());
aoAcionar('salvar-horarios', () => salvarHorarios());

// Salvar os horários do editor: a lista nova da categoria, os pedidos dela ajustados e uma entrada no histórico que desfaz
// os dois. Sem mudança, só fecha. O rascunho parte da lista de quando o editor abriu: se a lista da categoria mudou
// depois (a data aberta foi lida de novo, com o cadastro que outra pessoa mudou, ou o histórico reverteu os horários),
// salvar apagaria essa mudança sem conflito. Nada é salvo, e o editor fecha com o aviso
const mesmaLista = (a, b) => a.length === b.length && a.every((m, i) => m === b[i]);
function salvarHorarios() {
  const rascunho = rascunhoDosHorarios();
  if (!rascunho) return;
  const { cat, lista, base } = rascunho;
  const anterior = [...((S.horarios && S.horarios[cat]) || [])];
  if (mesmaLista(anterior, lista)) { fecharEditorDosHorarios(); return; }
  if (!mesmaLista(anterior, base)) {
    fecharEditorDosHorarios();
    showToast(`Os horários ${doNomeDaCategoria(cat)} mudaram depois que o editor abriu: nada foi salvo. Confira a lista e edite de novo.`);
    return;
  }
  S.horarios = { ...S.horarios, [cat]: lista };
  const pedidos = [];
  S.stu.forEach(s => [s, ...(s.extra || [])].forEach(p => {
    if (categoriaDoTipo(p.eq) !== cat) return;
    const antes = { p1: p.p1, p2: p.p2, jan: p.jan };
    ajustarPreferencias(p, horariosDaMissao(S.horarios, p.mis, p.eq));
    if (p.p1 === antes.p1 && p.p2 === antes.p2 && p.jan === antes.jan) return;
    pedidos.push({ stuId: s.id, mid: p === s ? 0 : p.mid, p1: antes.p1, p2: antes.p2, ...(antes.jan === undefined ? {} : { jan: antes.jan }) });
  }));
  gravarAlteracao('mod', `Horários de decolagem ${doNomeDaCategoria(cat)}: ${descreverHorarios(lista)}`,
    { kind: 'restaurarHorarios', cat, lista: anterior, pedidos, label: '↶ Reverter' });
  rRec(); redesenharPorNome('pedidos-do-dia');
  fecharEditorDosHorarios();
}
// O modelo escolhido no editor troca a lista do rascunho; Enter no campo põe o horário; Esc, com o foco nos horários,
// descarta o rascunho e fecha só o editor (o Histórico aberto continua aberto)
document.addEventListener('change', e => {
  if (e.target.name === 'hr-modelo' && e.target.closest('#horarios')) escolherModelo(e.target.value);
});
document.addEventListener('keydown', e => {
  if (!editorDosHorariosAberto() || !e.target.closest || !e.target.closest('#horarios')) return;
  if (e.key === 'Enter' && e.target.classList.contains('hr-novo')) { e.preventDefault(); porNoRascunho(); }
});
fecharNoEsc(() => (editorDosHorariosAberto() ? $('#horarios') : null), fecharEditorDosHorarios);

// "↶ Reverter" no histórico (js/eventos/historico.js): os tipos desta tela. A reversão chega validada (js/reversoes.js)
aoReverter('setAv', (rev, entry) => {
  S.av[rev.reg] = rev.val;
  const fora = rev.reg === GROUND_REG ? 'indisponível' : 'em manutenção';
  gravarAlteracao(rev.val ? 'inc' : 'exc', `Revertido: ${nomeDoRecurso(rev.reg)} ${rev.val ? 'disponível' : fora}`, null, entry.id);
  rRec();
});

aoReverter('setAtributo', (rev, entry) => {
  if (marcarAtributo(rev.reg, rev.atributo, rev.val)) {
    gravarAlteracao('mod', `Revertido: ${entry.desc}`, null, entry.id);
    rRec(); redesenharPorNome('instrutores', 'pedidos-do-dia');
  }
});

aoReverter('restaurarHorarios', (rev, entry) => {
  // Os horários de uma categoria voltam como estavam, e os pedidos que mudaram com eles também
  S.horarios = { ...S.horarios, [rev.cat]: [...rev.lista] };
  rev.pedidos.forEach(({ stuId, mid, p1, p2, jan }) => {
    const alvo = getMissionTarget(stuId, mid);
    if (!alvo) return;
    Object.assign(alvo, { p1, p2 });
    if (jan !== undefined) alvo.jan = jan;
  });
  gravarAlteracao('mod', `Revertido: ${entry.desc}`, null, entry.id);
  rRec(); redesenharPorNome('pedidos-do-dia');
});

aoReverter('readicionarRecurso', (rev, entry) => {
  // Um recurso retirado volta para a frota, como estava (com a habilitação própria, em Instrutores)
  S.frota.push({ ...rev.recurso });
  S.av[rev.recurso.reg] = rev.av !== false;
  gravarAlteracao('inc', `Revertido: ${rev.recurso.reg} de volta à frota`, null, entry.id);
  rRec(); redesenharPorNome('instrutores');
});
