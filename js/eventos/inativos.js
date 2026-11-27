// O "Ativo" do cadastro (F2): a chave da linha (button.lista-chave[role=switch][data-act="ativo"][data-de]) de um aluno, um
// instrutor ou um recurso. Um clique em cada sentido: desligado, o inativo vale na data aberta de hoje em diante (o motor lê
// o estado derivado, js/inativos.js), e as datas passadas não mudam; o mesmo clique o liga de novo, e o Histórico o
// reverte (setInativo). A notificação e o leitor de tela dizem o que mudou na data aberta. Um módulo só para os três
// cadastros, importado uma vez, por js/main.js
import { gravarAlteracao } from '../actions.js';
import { anunciar, showToast } from '../dom.js';
import { hojeISO } from '../format.js';
import { inativo, inativoValeEm, usoNaData, avisoDoInativo } from '../inativos.js';
import { redesenharPorNome } from '../redesenho.js';
import { S, RES, DATA, insBy, stuBy } from '../state.js';
import { aoAcionar, aoReverter } from './registro.js';

// Cada cadastro: onde está o registro, o nome dele e o desenho da tela dele (e o que mais mostra os ativos)
const CADASTROS = {
  aluno: { achar: id => stuBy(+id), id: v => +v, nome: x => x.nm, redesenhar: () => redesenharPorNome('alunos', 'pedidos-do-dia') },
  instrutor: { achar: id => insBy(+id), id: v => +v, nome: x => x.nm, redesenhar: () => redesenharPorNome('instrutores', 'alunos', 'pedidos-do-dia') },
  recurso: { achar: reg => (S.frota || []).find(f => f.reg === reg), id: v => String(v), nome: x => x.reg, redesenhar: () => redesenharPorNome('recursos') }
};

// Liga ou desliga, com a entrada no Histórico (a reversão devolve o de antes) e o aviso
function mudarInativo(de, id, ficaInativo, { reverte = null } = {}) {
  const cadastro = CADASTROS[de];
  const item = cadastro && cadastro.achar(id);
  if (!item || inativo(item) === ficaInativo) return;
  const uso = ficaInativo ? usoNaData(S, RES, { de, id: cadastro.id(id) }) : null;
  if (ficaInativo) item.inativo = true;
  else delete item.inativo;
  const nome = cadastro.nome(item);
  const texto = `${nome}: ${ficaInativo ? 'inativo' : 'ativo'} no cadastro`;
  const gravou = reverte
    ? gravarAlteracao('mod', `Revertido: ${texto}`, null, reverte)
    : gravarAlteracao('mod', texto, { kind: 'setInativo', de, id: cadastro.id(id), inativo: !ficaInativo, label: '↶ Reverter' });
  if (!gravou) {
    if (ficaInativo) delete item.inativo;
    else item.inativo = true;
    return;
  }
  cadastro.redesenhar();
  const aviso = avisoDoInativo({ de, nome, inativo: ficaInativo, uso, valeNaData: inativoValeEm(DATA, hojeISO()) });
  showToast(aviso, 'ok');
  anunciar(aviso);
}

// A chave: aria-checked é o "Ativo" de agora; o clique o inverte
aoAcionar('ativo', b => {
  const linha = b.closest('[data-id]');
  if (!linha || !Object.hasOwn(CADASTROS, b.dataset.de)) return;
  mudarInativo(b.dataset.de, linha.dataset.id, b.getAttribute('aria-checked') === 'true');
});

aoReverter('setInativo', (rev, entrada) => mudarInativo(rev.de, rev.id, rev.inativo, { reverte: entrada.id }));
