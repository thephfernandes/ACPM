// O endereço da página: a tela aberta no fragmento (#/<tela>[/<item>], js/telas.js) e a data aberta em ?data=. A data nunca
// entra no histórico do navegador: Voltar troca a tela, não a data. Tudo dentro de try: a página dentro de um iframe não
// muda o endereço (a tela e a data só não vão para ele)
import { enderecoDoDestino } from './telas.js';

// Uma tela nova no histórico: antes, a rolagem da tela atual fica guardada na entrada dela (Voltar a devolve). marca: o que
// a entrada nova guarda além da rolagem (o detalhe aberto numa vista só: { detalhe: 'alu' }, que "‹ Alunos" desfaz com Voltar)
export function empilharTela(destino, marca = {}) {
  try {
    window.history.replaceState({ ...(window.history.state || {}), rolagem: window.scrollY }, '');
    window.history.pushState({ rolagem: 0, ...marca }, '', enderecoDoDestino(destino));
  } catch {
    // Sem mudar o endereço, a tela abre do mesmo jeito
  }
}

// A tela no lugar da entrada atual (a abertura, o item lido uma vez), com o estado da entrada mantido
export function substituirTela(destino) {
  try {
    window.history.replaceState(window.history.state, '', enderecoDoDestino(destino));
  } catch {
    // Sem mudar o endereço, a tela abre do mesmo jeito
  }
}

// A data em ?data=, na entrada atual: a tela e os outros parâmetros ficam. Sem data, a última que foi para o endereço (uma
// navegação a leva para a entrada dela); antes da primeira (a abertura), nada
let ultima = null;
export function escreverDataNoEndereco(data = ultima) {
  if (!data) return;
  ultima = data;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('data') === data) return;
    url.searchParams.set('data', data);
    window.history.replaceState(window.history.state, '', url);
  } catch {
    // A data só não vai para o link
  }
}

// O endereço sem a tela ("Sair": a próxima conta abre na tela dela)
export function limparTelaDoEndereco() {
  try {
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(window.history.state, '', url);
  } catch {
    // Nada a limpar
  }
}
