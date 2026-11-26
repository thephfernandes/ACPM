// A barra do topo: o perfil no modo local, o menu da conta (Minha conta, Usuários, o tema e o Manual) e o aviso dos dados
// que não foram lidos (a data: js/eventos/trilho.js)
import { setRole, lerDadosDeNovo } from '../actions.js';
import { $, ligarMenu } from '../dom.js';
import { ApiClient } from '../storage.js';
import { abrirConta } from '../views/conta.js';
import { rManual } from '../views/manual.js';
import { atualizarSelos } from '../views/selos.js';
import { registrarDesenho, redesenharPorNome } from '../redesenho.js';
import { registrarTela, escolherTela } from '../views/telas.js';
import { gerenciaContas } from '../perfis.js';

// Os selos que ficam fora da linha (js/views/selos.js): o de Recursos na Disponibilidade do dia e o botão de importar
registrarDesenho('selos', atualizarSelos, { em: ['dados', 'escala', 'perfil', 'pedidos'], ordem: 99 });

// O perfil (neste navegador). A aba Cursos é refeita: aberta, ela mostra ou tira na hora os controles de quem muda o
// programa
$('#role-sel').onchange = e => {
  setRole(e.target.value);
  redesenharPorNome('cursos', 'escala');
};

ligarMenu($('#btn-menu-conta'), $('#menu-conta'));

// Tema: um interruptor (sol e lua) no menu da conta. Sem escolha gravada, vale o tema do sistema
const temaEscuro = () => {
  const escolhido = document.documentElement.getAttribute('data-theme');
  return escolhido ? escolhido === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};
const mostrarTema = () => $('#btn-theme').setAttribute('aria-checked', String(temaEscuro()));
$('#btn-theme').onclick = () => {
  const proximo = temaEscuro() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', proximo);
  try {
    localStorage.setItem(ApiClient.KEY_THEME, proximo);
  } catch {
    // Sem o armazenamento do navegador (navegação privada, por exemplo), o tema vale só nesta visita
  }
  mostrarTema();
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mostrarTema);
// O tema gravado neste navegador (sem ele, o do sistema)
export function iniciarTema() {
  try {
    const savedTheme = localStorage.getItem(ApiClient.KEY_THEME);
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  } catch {
    // Sem o armazenamento do navegador, o tema segue o do sistema
  }
  mostrarTema();
}

// Manual: abre de qualquer aba (as tabelas de regras são montadas uma vez, a partir do código)
rManual();
// O Manual (o link #/manual do topo; #/manual/<id>, uma parte dele): o lugar do item vem à vista
registrarTela('manual', { aoMostrar: item => (item && document.getElementById(item)) || null });

// Minha conta e Usuários (administrador: a mesma página, direto na lista de contas). O foco vai para o título da página
// aberta pelo menu
registrarTela('conta', {
  aoMostrar: async item => {
    await abrirConta();
    return item === 'usuarios' && gerenciaContas(ApiClient.perfil) ? $('#usuarios') : null;
  }
});
$('#btn-conta').onclick = () => escolherTela('conta', { focar: true });
$('#btn-usuarios').onclick = () => escolherTela('conta', { item: 'usuarios', focar: true });

// As horas dos instrutores ou os resultados dos cursos que não foram lidos: "Tentar de novo" lê outra vez
$('#btn-tentar-dados').onclick = async e => {
  e.target.disabled = true;
  try { await lerDadosDeNovo(); } finally { e.target.disabled = false; }
};
