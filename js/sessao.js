// Login e perfil no modo compartilhado (Supabase): pede e-mail e senha, carrega o perfil da conta
// (Operador edita, Gestor só consulta) e liga o ApiClient ao banco.
import { ApiClient } from './storage.js';
import { criarBackendSupabase } from './backends/supabase.js';
import { backendLocal } from './backends/local.js';
import { setRole, travarAposConflito } from './actions.js';
import { $, mostrarAviso, avisoAberto, fecharAviso, avisarDoLink } from './dom.js';
import { amanhaISO, esc } from './format.js';
import { ROTULOS, operaEscala, gerenciaContas, soPainel } from './perfis.js';
import { retornoDoLink } from './retorno-do-link.js';
import { chaveDaSessao, passarSessaoParaATV } from './config-supabase.js';


function pedirLogin(cliente) {
  document.body.dataset.login = 'sim';
  $('#login-email').focus();
  return new Promise(resolve => {
    $('#form-login').onsubmit = async e => {
      e.preventDefault();
      $('#btn-entrar').disabled = true;
      $('#login-erro').textContent = '';
      const { data, error } = await cliente.auth.signInWithPassword({
        email: $('#login-email').value.trim(),
        password: $('#login-senha').value
      });
      $('#btn-entrar').disabled = false;
      if (error) {
        $('#login-erro').textContent = error.status === 400
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar. Verifique a conexão e tente de novo.';
        return;
      }
      $('#login-senha').value = '';
      resolve(data.session);
    };
  });
}

// Primeiro acesso de um operador com o servidor vazio: oferece enviar os dados que este navegador já tinha
// (modo local). Documentos que já existem no servidor nunca são sobrescritos.
async function oferecerEnvioDosDadosLocais() {
  const servidor = ApiClient.backend;
  if (await servidor.ler('cadastro') || await servidor.ler('estado')) return;
  const local = await backendLocal.ler('estado');
  if (!local || !Array.isArray(local.ins) || !Array.isArray(local.stu)) return;

  document.body.dataset.login = 'sim';
  $('#form-login').hidden = true;
  $('#envio-local').hidden = false;
  $('#envio-local-texto').textContent = `Este navegador tem dados da escala (${local.ins.length} instrutores e ${local.stu.length} alunos) que ainda não estão no servidor. Enviá-los para que todos usem os mesmos dados?`;
  const enviar = await new Promise(resolve => {
    $('#btn-enviar-local').onclick = () => resolve(true);
    $('#btn-ignorar-local').onclick = () => resolve(false);
  });
  $('#envio-local').hidden = true;
  if (!enviar) return;

  // Os dados do navegador (formato da fase 2) chegam ao servidor já no formato por data
  await ApiClient.migrarDocumentosAntigos(amanhaISO(), backendLocal);
}

// Sai só deste navegador (o padrão do Supabase encerra as sessões da conta em todos os aparelhos)
async function sair(cliente) {
  await cliente.auth.signOut({ scope: 'local' });
  window.location.reload();
}

const AVISOS_DO_LINK = {
  'falta-outro': 'Link confirmado. Para concluir a troca de e-mail, abra também o link enviado para o outro endereço.',
  invalido: 'Este link de confirmação expirou ou já foi usado. Se a troca de e-mail não foi concluída, peça de novo em Minha conta.'
};

// Iniciais do primeiro e do último nome (ou a primeira letra do e-mail)
const iniciais = nome => {
  const partes = nome.split(/[\s@.]+/).filter(Boolean);
  return ((partes[0] || '?')[0] + (partes.length > 1 && !nome.includes('@') ? partes[partes.length - 1][0] : '')).toUpperCase();
};

// Devolve true quando o app pode carregar os dados (conta com perfil); false deixa o aviso na tela
export async function iniciarSessaoSupabase(projeto) {
  document.body.dataset.backend = 'supabase';
  // Volta de um link de confirmação da troca de e-mail. A mensagem e o erro saem da URL antes de o supabase-js
  // ler o fragmento (um recarregamento não repete o aviso); a sessão nova, quando vem, fica para ele
  const retorno = retornoDoLink(window.location.hash);
  if (retorno === 'falta-outro' || retorno === 'invalido') {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    avisarDoLink(AVISOS_DO_LINK[retorno], retorno === 'invalido' ? 'erro' : 'ok');
  }
  const cliente = window.supabase.createClient(projeto.url, projeto.chave, { auth: { storageKey: chaveDaSessao(projeto) } });
  const { data } = await cliente.auth.getSession();
  const sessao = data.session || await pedirLogin(cliente);
  if (retorno === 'concluida') avisarDoLink(`Troca de e-mail concluída: agora você entra com ${sessao.user.email}.`, 'ok');

  const { data: perfil, error } = await cliente.from('perfis').select('perfil, nome').maybeSingle();
  if (error) throw new Error(`Não foi possível carregar o perfil: ${error.message}`);
  if (!perfil) {
    document.body.dataset.login = 'sim';
    $('#form-login').hidden = true;
    $('#sem-acesso').hidden = false;
    $('#sem-acesso-email').textContent = sessao.user.email;
    $('#btn-sair-sem-acesso').onclick = () => sair(cliente);
    return false;
  }

  // A conta da TV da recepção só vê o painel: vai direto para ele, com a sessão (o app não fica conectado com ela)
  if (soPainel(perfil.perfil)) {
    passarSessaoParaATV(projeto);
    window.location.replace(`painel.html${window.location.search}`);
    return false;
  }

  delete document.body.dataset.login;
  ApiClient.backend = criarBackendSupabase(cliente, {
    aoConflito: (documento, motivo) => travarAposConflito(motivo),
    aoErro: () => { if (avisoAberto() !== 'conflito') mostrarAviso('erro', 'Não foi possível salvar a última alteração. Verifique a conexão: a próxima alteração tentará salvar de novo.'); },
    aoGravar: () => fecharAviso('erro')
  });
  $('#btn-share-link').title = 'Copiar o link da escala desta data (quem abrir entra com a própria conta)';
  // No menu da conta: o nome e o perfil (o texto continua "Nome · Perfil"), as iniciais e os itens da conta
  const nome = perfil.nome || sessao.user.email;
  $('#usuario').innerHTML = `<b>${esc(nome)}</b><span class="hd-sep"> · </span><small>${esc(ROTULOS[perfil.perfil] || perfil.perfil)}</small>`;
  $('#usuario').hidden = false;
  $('#usuario-iniciais').textContent = iniciais(nome);
  $('#btn-sair').hidden = false;
  $('#btn-conta').hidden = false;
  $('#btn-usuarios').hidden = !gerenciaContas(perfil.perfil);
  document.body.dataset.perfil = perfil.perfil;
  $('#btn-sair').onclick = () => sair(cliente);
  ApiClient.autorAtual = perfil.nome || sessao.user.email;
  // Operador e Administrador editam a escala; Gestor e Secretaria só consultam (a Secretaria registra na agenda)
  ApiClient.perfil = perfil.perfil;
  ApiClient.emailAtual = sessao.user.email;
  setRole(operaEscala(perfil.perfil) ? 'operador' : 'gestor', !operaEscala(perfil.perfil));
  if (operaEscala(perfil.perfil)) await oferecerEnvioDosDadosLocais();
  delete document.body.dataset.login;
  return true;
}
