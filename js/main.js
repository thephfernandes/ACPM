/**
 * AutoEscala - ACPM: ponto de entrada. Liga os eventos da tela (js/eventos/, uma aba por módulo) e abre o app.
 *
 *   js/config.js    Configurações operacionais (janelas, frota, missões, limites de peso)
 *   js/rules.js     Regras das missões (Ground School, precedência, normalização)
 *   js/format.js    Formatação de horários, durações e datas
 *   js/engine.js    Motor de alocação determinístico (função pura)
 *   js/storage.js   Camada de dados (estado inicial e migrações) sobre js/backends/ (local ou Supabase)
 *   js/sessao.js    Login e perfil de acesso no modo compartilhado (Supabase)
 *   js/funcionalidades.js  As funcionalidades que podem ficar desligadas (o hangar e o progresso nos cursos)
 *   js/state.js     Estado compartilhado entre os módulos
 *   js/actions.js   Perfil de acesso, data, histórico e escala; gravarAlteracao, o jeito de os eventos mudarem os dados
 *   js/dom.js       Utilitários de DOM
 *   js/views/       Renderização das abas
 *   js/eventos/     Os eventos de cada aba: registro.js (as ações dos botões e os campos das tabelas, com a trava de quem
 *                   só consulta) e confirmacao.js (o único jeito de confirmar)
 *   js/export.js    Exportação CSV, PDF e a planilha do Excel
 */
import './eventos/navegacao.js';
import './eventos/linha.js';
import './eventos/trilho.js';
import './eventos/escala.js';
import './eventos/instrutores.js';
import './eventos/alunos.js';
import './eventos/historico.js';
import './eventos/topo.js';
import './eventos/demanda.js';
import './eventos/bi.js';
import './eventos/recursos.js';
import './eventos/conta.js';
import './eventos/agenda.js';
import './eventos/rodizio.js';
import './eventos/cursos.js';
// O diálogo "Agendar voo" (js/eventos/agendamento.js) vem com a Escala, que o importa; Instrutores traz os limites da lei e
// o painel dos dados pessoais, e a Demanda, o "Importar da agenda" (test/unit/eventos-ligados.test.js)
import { setRole, abrirData, lerData, dadosPreparados, carregarBI } from './actions.js';
import { redesenhar } from './redesenho.js';
import { ehDomingo, primeiraDataAberta } from './agenda.js';
import { projetoSupabase, enderecoSemBanco } from './config-supabase.js';
import { aplicarFuncionalidades } from './funcionalidades.js';
import { iniciarDicas } from './dicas.js';
import { configurarMeteorologia } from './meteorologia.js';
import { $, showToast, mostrarAviso, avisoAberto, avisarDoLink } from './dom.js';
import { amanhaISO, somarDias } from './format.js';
import { iniciarSessaoSupabase } from './sessao.js';
import { iniciarSomenteLeitura } from './somente-leitura.js';
import { RES, modoCompartilhado } from './state.js';
import { ApiClient } from './storage.js';
import { iniciarTema } from './eventos/topo.js';
import { avisoDeDomingo } from './eventos/trilho.js';
import { programaSendoGravado } from './eventos/cursos.js';
import { podeEditarAgenda } from './views/agenda.js';
import { carregarDadosPessoais } from './views/dados-pessoais.js';
import { rOut } from './views/escala.js';
import { lerPedidosDaData } from './views/selos.js';
import { diaAbrindo } from './views/trilho.js';
import { ligarEndereco, mostrarTela, telaAberta, telaFoiEscolhida, destinoDoHash } from './views/telas.js';
import { telaDeAbertura, dataDeAbertura } from './telas.js';

// Fechar ou recarregar a página com alterações esperando a conexão, ou com o programa de um curso ainda sendo gravado, pede
// confirmação (elas se perderiam)
window.addEventListener('beforeunload', e => {
  if (!ApiClient.temGravacoesPendentes() && !programaSendoGravado()) return;
  e.preventDefault();
  e.returnValue = '';
});

// Inicialização Assíncrona
(async function bootstrap() {
  iniciarTema();
  // O que a página diz das funcionalidades desligadas sai dela (e o que só vale sem as ligadas)
  aplicarFuncionalidades(document);
  // O endereço é lido antes de tudo: abrir uma data, ou uma tela, põe a data nele
  const params = new URLSearchParams(window.location.search);
  // O endereço: os links #/<tela>, Voltar e Avançar. A tela do endereço aparece já (no modo compartilhado, o login fica por
  // cima dela até a sessão abrir)
  ligarEndereco();
  const doEndereco = destinoDoHash(window.location.hash);
  if (doEndereco) mostrarTela(doEndereco.tela, { item: doEndereco.item, nativo: Boolean(doEndereco.nativo), historico: 'nenhum', ler: false });
  // As dicas dos termos e a tela só de consulta do Gestor
  iniciarDicas();
  iniciarSomenteLeitura();
  // A meteorologia do painel vem do servidor (a função meteorologia); neste navegador, não há
  configurarMeteorologia(() => ApiClient.meteorologia());

  // Amanhã, ou a segunda quando amanhã é domingo
  const amanha = ehDomingo(amanhaISO()) ? somarDias(amanhaISO(), 1) : amanhaISO();
  abrirData(amanha, { naoEscolhida: true });

  // Um link com a escala inteira no endereço (share=) não vale: sai do endereço, com o aviso
  if (params.has('share')) {
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState(window.history.state, '', url);
    avisarDoLink('Este link antigo levava a escala no próprio endereço e não vale mais. Peça um link novo a quem compartilhou.', 'erro');
  }
  // A data do link (?data=): vale para todos os perfis (js/telas.js, dataDeAbertura)
  const pedida = params.get('data');

  // Num endereço que não é o do app, o modo local (sem o banco) avisa no alto, antes dos dados (e também se eles falharem)
  if (enderecoSemBanco()) $('#aviso-endereco').hidden = false;

  // Sessão e dados. Se algo falhar (sem conexão, conversão pela metade), o app não abre com dados incompletos:
  // fica o aviso para recarregar (nada se perde; o que faltou é retomado na próxima abertura)
  try {
    // No site publicado os dados ficam no Supabase, com login; em localhost, no modo local
    const projeto = projetoSupabase();
    if (projeto && !(await iniciarSessaoSupabase(projeto))) return;

    // Primeira abertura com a escala por data: converte os documentos sem data (estado, escala, historico e bi), do
    // servidor ou deste navegador.
    // Depois de uma mudança no formato dos dados, regrava no formato atual o que estiver num formato anterior
    await ApiClient.migrarDocumentosAntigos(amanha);
    await ApiClient.atualizarFormatoGravado();
    // Daqui em diante as datas podem ser lidas. Uma troca de data feita antes disso esperou (a leitura da abertura, pedida
    // depois, fica no lugar dela); se algo falhou até aqui, nenhuma data abre (js/actions.js, dadosPreparados)
    dadosPreparados();

    // A data da abertura: a do link (um domingo abre a segunda; uma que não existe, amanhã); sem link, a Secretaria abre na
    // primeira data que ainda aceita pedidos e os outros amanhã
    // A que a pessoa já escolheu no calendário, à vista desde o começo, vale mais que as duas
    const escolhida = diaAbrindo();
    const { data, aviso } = escolhida ? { data: escolhida, aviso: null }
      : dataDeAbertura({ pedida, perfil: ApiClient.perfil, amanha, primeiraAberta: primeiraDataAberta() });
    // Os dados da data. Até eles chegarem, e se a leitura falhar, nada é gravado (js/actions.js, lerData); uma data
    // escolhida enquanto eles chegavam abre depois, no lugar deles
    abrirData(data);
    if (await lerData(data)) {
      if (aviso === 'domingo') showToast(avisoDeDomingo(data));
      else if (aviso === 'invalida') showToast(`A data do link não existe (${pedida.slice(0, 20)}). A escala aberta é a de amanhã.`);
    }
  } catch (e) {
    console.warn(e);
    dadosPreparados(false);
    if (avisoAberto() !== 'conflito') mostrarAviso('falha', 'Não foi possível preparar os dados da escala. Verifique a conexão e recarregue a página; nada foi perdido.');
    return;
  }

  // No modo compartilhado o perfil vem da conta: role= da URL não vale
  if (!modoCompartilhado() && params.get('role')) setRole(params.get('role'), false);

  // As abas com os dados lidos, também a que a pessoa abriu enquanto eles carregavam (Cursos ou Rodízio, por exemplo)
  redesenhar('dados');
  // Sem a escala da data (outra data foi escolhida enquanto esta abria), a Escala mostra a data vazia até a outra chegar,
  // como antes do registro: o desenho registrado só refaz a Escala quando há escala
  if (!RES) rOut();
  document.body.dataset.agenda = podeEditarAgenda() ? 'edita' : 'consulta';
  // Dados pessoais (para a coluna CANAC das tabelas), para quem pode vê-los
  carregarDadosPessoais();

  // A tela da abertura: a que a pessoa escolheu enquanto os dados carregavam (um clique, Voltar, um endereço digitado), a do
  // endereço ou a do perfil (a Agenda para a Secretaria, a Escala para os outros). Ela é mostrada de novo agora, com os
  // dados lidos e o perfil conferido
  // (o destino lido no começo: o item do endereço vale uma vez e já saiu dele)
  const destino = telaFoiEscolhida() ? { tela: telaAberta(), item: null } : (doEndereco || { tela: telaDeAbertura(ApiClient.perfil), item: null });
  await mostrarTela(destino.tela, { item: destino.item, nativo: Boolean(destino.nativo), historico: 'substituir' });

  lerPedidosDaData();
  carregarBI();
  // Fim da abertura: daqui em diante, só a pessoa muda a aba. Os testes E2E esperam por esta marca (appPronto, em
  // test/e2e/telas/casca.js)
  document.body.dataset.pronto = '1';
})();
