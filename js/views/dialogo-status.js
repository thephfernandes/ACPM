// Diálogo do detalhe do status (fase 8): Cancelado pede o motivo (em "Outro", uma descrição curta) e Atrasado, a nova
// decolagem. Confirmar devolve o detalhe validado (js/status.js); Voltar, Esc ou fechar desistem, e o status continua
// o anterior.
import { MOTIVOS_DE_CANCELAMENTO, LIMITE_DO_TEXTO, validarDetalhe } from '../status.js';
import { hm, esc, fmtH } from '../format.js';
import { paraMinuto } from '../horarios.js';
import { nomeDoRecurso } from '../categorias.js';
import { $ } from '../dom.js';

let pedido = null;

function camposDoCancelamento(detalhe) {
  const atual = detalhe && detalhe.motivo;
  return `<fieldset class="motivos">
      <legend>Motivo</legend>
      ${MOTIVOS_DE_CANCELAMENTO.map(m => `<label class="chk"><input type="radio" name="motivo" value="${esc(m)}"${m === atual ? ' checked' : ''}> ${esc(m)}</label>`).join('')}
    </fieldset>
    <div class="campo" id="st-outro-rotulo"${atual === 'Outro' ? '' : ' hidden'}>
      <label for="st-outro">Descreva o motivo</label>
      <input type="text" id="st-outro" maxlength="${LIMITE_DO_TEXTO}" autocomplete="off" aria-describedby="st-outro-dica" value="${esc((detalhe && detalhe.texto) || '')}">
      <small class="h" id="st-outro-dica">Sem dados de saúde ou outros dados pessoais.</small>
    </div>`;
}

function camposDoAtraso(voo, detalhe) {
  return `<label class="campo">Nova decolagem
      <input type="time" id="st-novo" step="300" value="${detalhe && Number.isInteger(detalhe.novoInicio) ? hm(detalhe.novoInicio) : ''}">
    </label>
    <p class="h">O voo continua com ${fmtH((voo.b - voo.a) / 60)}; a escala avisa se o atraso invadir outro voo do mesmo avião, instrutor ou aluno.</p>`;
}

function ligar() {
  const dlg = $('#dlg-status');
  if (dlg.dataset.ligado) return;
  dlg.dataset.ligado = '1';
  $('#form-status').addEventListener('submit', e => {
    e.preventDefault();
    if (!pedido) return;
    const dados = pedido.status === 'Cancelado'
      ? { motivo: (dlg.querySelector('input[name="motivo"]:checked') || {}).value, texto: $('#st-outro').value }
      : { novoInicio: paraMinuto($('#st-novo').value) };
    const { detalhe, erro } = validarDetalhe(pedido.status, dados, pedido.voo.a, pedido.voo.b - pedido.voo.a);
    if (erro) { $('#st-erro').textContent = erro; return; }
    const { aoConfirmar } = pedido;
    pedido = null;
    dlg.close();
    aoConfirmar(detalhe);
  });
  // "Outro" mostra o campo da descrição
  dlg.addEventListener('change', e => {
    if (e.target.name !== 'motivo') return;
    const outro = e.target.value === 'Outro';
    $('#st-outro-rotulo').hidden = !outro;
    if (outro) $('#st-outro').focus();
  });
  $('#st-voltar').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => {
    if (!pedido) return;
    const { aoDesistir } = pedido;
    pedido = null;
    aoDesistir();
  });
}

export const dialogoDeStatusAberto = () => Boolean($('#dlg-status') && $('#dlg-status').open);

export function pedirDetalheDoStatus({ voo, status, detalhe = null, aoConfirmar, aoDesistir = () => {} }) {
  ligar();
  const dlg = $('#dlg-status');
  pedido = { voo, status, aoConfirmar, aoDesistir };
  $('#dlg-status-titulo').textContent = status === 'Cancelado' ? 'Cancelar o voo' : 'Voo atrasado';
  $('#dlg-status-voo').textContent = [voo.s, `${hm(voo.a)}–${hm(voo.b)}`, voo.mis, nomeDoRecurso(voo.r)].join(' · ');
  $('#dlg-status-campos').innerHTML = status === 'Cancelado' ? camposDoCancelamento(detalhe) : camposDoAtraso(voo, detalhe);
  $('#st-erro').textContent = '';
  dlg.showModal();
  const primeiro = dlg.querySelector(status === 'Cancelado' ? 'input[name="motivo"]:checked' : '#st-novo') || dlg.querySelector('input[name="motivo"]');
  if (primeiro) primeiro.focus();
}
