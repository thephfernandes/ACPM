// A tela só de consulta do perfil Gestor (revisão de 14/11). Antes, uma regra do CSS tirava os cliques dos campos
// (pointer-events: none): a tela parecia editável para o leitor de tela e nenhuma dica aparecia. Agora os campos ficam
// desligados (disabled) por um lugar só, inclusive os que a tela desenha depois; voltando ao Operador, os que este
// módulo desligou voltam. Os campos de filtro, de busca, da data (no servidor), da agenda e da conta continuam.
const CAMPOS = [
  'main input:not(.flt-ctrl):not(.agenda-campo):not(.conta-campo):not(#onlyfly):not(#bi-dt):not(#dt)',
  'main select:not(.flt-ctrl):not(.agenda-campo):not(.conta-campo)',
  '#painel-instrutor input'
].join(', ');

const consulta = () => document.body.dataset.role === 'gestor';

function desligar(raiz) {
  const campos = raiz.matches && raiz.matches(CAMPOS) ? [raiz] : [];
  campos.push(...(raiz.querySelectorAll ? raiz.querySelectorAll(CAMPOS) : []));
  for (const el of campos) {
    if (el.disabled) continue;
    el.disabled = true;
    el.dataset.soLeitura = '1';
  }
}

// Liga ou desliga conforme o perfil atual
export function aplicarSomenteLeitura() {
  if (consulta()) { desligar(document.body); return; }
  for (const el of document.querySelectorAll('[data-so-leitura]')) {
    el.disabled = false;
    delete el.dataset.soLeitura;
  }
}

export function iniciarSomenteLeitura() {
  new MutationObserver(mudancas => {
    if (!consulta()) return;
    for (const m of mudancas) for (const no of m.addedNodes) if (no.nodeType === 1) desligar(no);
  }).observe(document.body, { childList: true, subtree: true });
  aplicarSomenteLeitura();
}
