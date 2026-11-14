// TV da recepção (fase 9): o painel de partidas e chegadas de hoje na tela toda (js/views/painel-aeroporto.js). No modo
// compartilhado, a TV entra com a conta dela (perfil "painel", que só vê o quadro, pela função painel_do_dia) e busca o
// quadro a cada minuto; neste navegador (sem servidor), lê o dia gravado aqui. Recarrega toda madrugada, para pegar as
// versões novas do app, e mantém a tela acesa.
import { projetoSupabase } from './config-supabase.js';
import { backendLocal } from './backends/local.js';
import { linhasDoQuadro, quadroDoDia } from './quadro.js';
import { painelNaTela, atualizarPainel } from './views/painel-aeroporto.js';
import { hm, hojeISO } from './format.js';

const BUSCA_MS = 60000;
const SEM_CONEXAO_MS = 3 * 60000;
let quadro = { data: hojeISO(), voos: null, fStatus: {}, fObs: {} };
let ultimaBusca = null;

const horaDe = instante => { const d = new Date(instante); return hm(d.getHours() * 60 + d.getMinutes()); };
const fonte = () => ({
  linhas: quadro.voos ? linhasDoQuadro(quadro.voos, quadro.fStatus, quadro.fObs) : [],
  data: quadro.data,
  semEscala: !quadro.voos,
  aviso: ultimaBusca !== null && Date.now() - ultimaBusca > SEM_CONEXAO_MS ? `Sem conexão desde ${horaDe(ultimaBusca)}` : ''
});

// Busca o quadro e redesenha; sem resposta, continua o último quadro e o aviso diz desde quando
async function atualizar(buscar) {
  try {
    const novo = await buscar();
    quadro = { data: novo.data || hojeISO(), voos: novo.voos, fStatus: novo.fStatus || {}, fObs: novo.fObs || {} };
    ultimaBusca = Date.now();
  } catch (e) {
    // o aviso aparece depois de 3 minutos sem resposta
  }
  atualizarPainel();
}

// O dia gravado neste navegador (modo sem servidor), como o servidor entregaria
const buscarNesteNavegador = async () => ({ data: hojeISO(), ...quadroDoDia(await backendLocal.ler(`dia:${hojeISO()}`)) });

function pedirLogin(cliente) {
  const form = document.getElementById('form-login');
  form.hidden = false;
  document.getElementById('login-email').focus();
  return new Promise(resolve => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const erro = document.getElementById('login-erro');
      erro.textContent = '';
      const { data, error } = await cliente.auth.signInWithPassword({
        email: document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-senha').value
      });
      if (error) { erro.textContent = 'E-mail ou senha incorretos.'; return; }
      form.hidden = true;
      resolve(data.session);
    });
  });
}

function manterTelaAcesa() {
  const pedir = () => {
    if (navigator.wakeLock && document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(() => {});
  };
  document.addEventListener('visibilitychange', pedir);
  pedir();
}

// Às 03:00 a página recarrega: pega as versões novas do app e começa o dia limpa
function recarregarDeMadrugada() {
  const agora = new Date(), proxima = new Date(agora);
  proxima.setHours(3, 0, 0, 0);
  if (proxima <= agora) proxima.setDate(proxima.getDate() + 1);
  setTimeout(() => window.location.reload(), proxima - agora);
}

async function iniciar() {
  const projeto = projetoSupabase();
  let buscar = buscarNesteNavegador;
  if (projeto) {
    // A mesma sessão do app: a conta da TV que abre o app vem para cá já conectada
    const cliente = window.supabase.createClient(projeto.url, projeto.chave, { auth: { storageKey: `acpm-${projeto.nome}` } });
    const { data } = await cliente.auth.getSession();
    if (!data.session) await pedirLogin(cliente);
    buscar = async () => {
      const { data: novo, error } = await cliente.rpc('painel_do_dia');
      if (error) throw error;
      return novo;
    };
  }
  await atualizar(buscar);
  const tela = document.getElementById('quadro');
  tela.hidden = false;
  painelNaTela(tela, fonte);
  setInterval(() => atualizar(buscar), BUSCA_MS);
  manterTelaAcesa();
  recarregarDeMadrugada();
}

iniciar();
