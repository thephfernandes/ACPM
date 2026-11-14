// TV da recepção (fase 9): o painel de partidas e chegadas de hoje na tela toda (js/views/painel-aeroporto.js). No modo
// compartilhado, a TV entra com a conta dela (perfil "painel", que só vê o quadro, pela função painel_do_dia) e busca o
// quadro a cada minuto; neste navegador (sem servidor), lê o dia gravado aqui. Recarrega toda madrugada, para pegar as
// versões novas do app, e mantém a tela acesa. A TV fica numa tela pública (revisão de 14/11): ela só aceita a conta da
// TV e guarda a sessão numa chave só dela.
import { projetoSupabase, chaveDaSessao } from './config-supabase.js';
import { soPainel } from './perfis.js';
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

// O perfil da conta conectada: null sem perfil, undefined quando não deu para saber (sem conexão)
async function perfilDaConta(cliente) {
  const { data, error } = await cliente.from('perfis').select('perfil').maybeSingle();
  return error ? undefined : data ? data.perfil : null;
}

// Só a conta da TV entra: outra conta sai na hora
function pedirLogin(cliente) {
  const form = document.getElementById('form-login');
  form.hidden = false;
  document.getElementById('login-email').focus();
  return new Promise(resolve => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const erro = document.getElementById('login-erro');
      erro.textContent = '';
      const { error } = await cliente.auth.signInWithPassword({
        email: document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-senha').value
      });
      if (error) { erro.textContent = 'E-mail ou senha incorretos.'; return; }
      const perfil = await perfilDaConta(cliente);
      if (!soPainel(perfil)) {
        await cliente.auth.signOut({ scope: 'local' }).catch(() => {});
        erro.textContent = perfil === undefined
          ? 'Não foi possível verificar a conta. Verifique a conexão e tente de novo.'
          : 'Esta conta não é a da TV. Entre com a conta da TV (perfil Painel).';
        return;
      }
      form.hidden = true;
      resolve();
    });
  });
}

// A TV que entrou antes da revisão de 14/11 guardou a sessão na chave do app. Se for a conta da TV, a sessão passa para
// a chave da TV (sem pedir a senha de novo); a sessão de outra conta fica onde está
async function trazerSessaoDoApp(projeto) {
  const doApp = chaveDaSessao(projeto), daTV = chaveDaSessao(projeto, { painel: true });
  if (localStorage.getItem(daTV) || !localStorage.getItem(doApp)) return;
  const app = window.supabase.createClient(projeto.url, projeto.chave, { auth: { storageKey: doApp, autoRefreshToken: false, detectSessionInUrl: false } });
  if (!soPainel(await perfilDaConta(app))) return;
  localStorage.setItem(daTV, localStorage.getItem(doApp));
  localStorage.removeItem(doApp);
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
    // A conta da TV que entra pelo app vem para cá já conectada (o app passa a sessão para a chave da TV)
    await trazerSessaoDoApp(projeto);
    const cliente = window.supabase.createClient(projeto.url, projeto.chave, { auth: { storageKey: chaveDaSessao(projeto, { painel: true }) } });
    const { data } = await cliente.auth.getSession();
    // A sessão guardada continua valendo enquanto a conta for a da TV (sem conexão, a TV segue com ela)
    const perfil = data.session ? await perfilDaConta(cliente) : null;
    if (!data.session || (perfil !== undefined && !soPainel(perfil))) {
      if (data.session) await cliente.auth.signOut({ scope: 'local' }).catch(() => {});
      await pedirLogin(cliente);
    }
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
