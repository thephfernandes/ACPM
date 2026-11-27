// Os cursos e o programa deles, na aba Cursos: só o Administrador (neste navegador, o Operador) muda, com o programa lido
// das tabelas dos cursos. Cada alteração é uma operação de js/programa.js sobre o curso da tela, conferida antes como o
// servidor confere (com um problema, a aba volta a mostrar o curso como estava e o aviso diz qual); a ordem nova que poria
// uma fase ou uma missão antes do que ela espera ("depois de…") é recusada com o motivo. O curso muda na tela na hora e
// vai para a gravação do curso inteiro (ApiClient.salvarCurso), em fila: uma gravação de cada vez, na ordem das
// alterações, cada uma com o curso como ficou naquela alteração e a versão confirmada pela gravação anterior (o curso novo
// parte da versão 0, que o cria). Uma recusa (ou a falta de conexão) descarta o resto da fila do curso, e a tela volta a
// mostrar o programa gravado, lido de novo, com o aviso do motivo; nada disso trava o resto da tela (outra pessoa que
// mudou o programa não é um conflito da escala). As alterações do programa não entram no histórico da data: ficam nas
// versões do curso, que a aba lista. O que só muda o que se vê (o curso na tela, "Mostrar encerrados", recolher e abrir
// as fases e o índice das fases) vale para todos os perfis, também enquanto a data abre: não são ações (data-act).
// Antes de a escala abrir (js/actions.js, aindaNaoAbriu), o programa não muda: os botões recusam em registro.js, e os
// campos e o curso novo, aqui, com o mesmo aviso
import { aindaNaoAbriu, gravarAlteracao } from '../actions.js';
import {
  conteudoDoCurso, incluirMissao, mudarMissao, moverMissao, retirarMissao, validarCurso, percursoDoCurso, nomeDaFase, incluirFase, mudarFase,
  moverFase, retirarFase, restaurarFase, restaurarMissao, definirRegra, marcarMissao, moverMissaoParaFase, ordemRecusada, definirTrecho, mudarCurso,
  aplicarModelo, novoCurso, exigirNaMissao, LIMITE_DO_EXIGE
} from '../programa.js';
import { nomeDaHabilitacao } from '../habilitacoes.js';
import { MODELOS } from '../modelos-de-curso.js';
import { codigoValido } from '../cursos.js';
import { ApiClient } from '../storage.js';
import { $, showToast, fecharNoEsc, ponteiroApertado, depoisDoClique } from '../dom.js';
import { duracaoDigitada, ERRO_DA_DURACAO } from '../rules.js';
import { S, estadoDaEscala } from '../state.js';
import { confirmado } from './confirmacao.js';
import { aoAcionar } from './registro.js';
import {
  rCursos, podeEditarCursos, programasIndisponiveis, codigoTravado, codigoComResultados, codigoNaDemanda, codigosReservados, mostrarAlteracoes,
  nomesDosRequisitos, listaComE, exigeSemInstrutor, textoDoExigeSemInstrutor, filtrarCursos, recolherFase, recolherTodasAsFases, irParaFase
} from '../views/cursos.js';

import { registrarDesenho, redesenharPorNome } from '../redesenho.js';
import { registrarTela } from '../views/telas.js';

// O desenho de Cursos (js/redesenho.js)
registrarDesenho('cursos', rCursos, { em: ['dados', 'consulta', 'releitura'], ordem: 40 });
registrarTela('cur', { aoMostrar: () => rCursos() });

// As últimas alterações de cada curso, como o servidor as devolve; o tamanho da descrição de uma alteração
const ALTERACOES_NA_TELA = 20, LIMITE_DA_DESCRICAO = 500;

// As gravações esperando, por curso (a sigla): a versão confirmada pela última gravação, o curso que ela gravou, o curso
// como a tela o mostra (com todas as alterações da fila) e a fila. O curso sai daqui quando a fila esvazia
const filas = new Map();
// O último curso confirmado por uma gravação desta tela, por sigla: uma leitura que saiu antes da gravação e chegou depois
// (a da data trocada) não faz a alteração seguinte partir do programa de antes
const confirmados = new Map();

// Alguma alteração do programa esperando ou sendo gravada: fechar ou recarregar a página agora a perderia (js/main.js pede
// confirmação, como com as alterações da escala esperando a conexão)
export const programaSendoGravado = () => filas.size > 0;

const naTela = sigla => (S.programa || []).find(c => c.sigla === sigla) || null;
// O curso na tela: no lugar do de mesma sigla; o curso novo, no fim da lista
const porNaTela = curso => {
  const programa = S.programa || [];
  S.programa = programa.some(c => c.sigla === curso.sigla) ? programa.map(c => (c.sigla === curso.sigla ? curso : c)) : [...programa, curso];
};

// O que as missões do curso exigem do INVA nos pedidos da data aberta (o estado da escala o deriva de S.programa, F1d).
// Uma alteração do programa que muda isso refaz e grava a escala da data (gravarAlteracao sem descrição: a alteração fica
// nas versões do curso, não no histórico da data), como uma habilitação marcada em Instrutores; também a escala já
// gravada, que a data mostraria como estava ao abrir de novo
const exigenciasDaData = () => JSON.stringify(estadoDaEscala().stu.map(s => [s.exige || null, (s.extra || []).map(ex => ex.exige || null)]));
function refazerEscalaSeMudou(antes) {
  if (exigenciasDaData() !== antes) gravarAlteracao('mod', null);
}

// O curso de onde a alteração parte: com gravações esperando, o da fila (com todas elas); senão, o da tela, a não ser
// que ele seja mais antigo que o confirmado aqui
function cursoAtual(sigla) {
  if (filas.has(sigla)) return filas.get(sigla).curso;
  const lido = naTela(sigla), gravado = confirmados.get(sigla);
  return lido && gravado && gravado.versao > lido.versao ? gravado : lido;
}

// O texto de um aviso: com a primeira letra maiúscula e o ponto final
const frase = texto => {
  const t = String(texto || '').trim();
  return t && `${t[0].toUpperCase()}${t.slice(1)}${/[.!?]$/.test(t) ? '' : '.'}`;
};

// O curso como fica, conferido como o servidor confere: com um problema, nada muda e o aviso diz qual
function conferido(novo) {
  const erro = validarCurso(conteudoDoCurso(novo));
  if (erro) showToast(frase(erro.message));
  return !erro;
}

// A ordem nova que poria uma fase ou uma missão antes do que ela espera é recusada, com o motivo
function ordemValida(novo, movido) {
  const recusa = ordemRecusada(novo, movido);
  if (recusa) showToast(recusa);
  return !recusa;
}

// A aba refeita depois de um campo mudar. O campo digitado que perde o foco para um clique avisa a mudança no mousedown
// desse clique, antes do mouseup e do click: refeita nessa hora, a aba tiraria da tela o botão ou a marca apertada, e o
// clique se perderia (seria preciso clicar de novo). O curso já mudou; a aba é refeita logo depois do clique (que age
// sobre o curso como ficou) ou na próxima tecla, se o próprio clique não a refez. As marcas e as listas avisam a mudança
// no click: a aba é refeita na hora
const DIGITADO = 'input:not([type="checkbox"])';
let esperarOClique = false;
function refazerAba() {
  const lugar = $('#cursos');
  if (!esperarOClique || !lugar) {
    rCursos();
    return;
  }
  const comoEstava = lugar.firstElementChild;
  function refazer() {
    if (lugar.firstElementChild !== comoEstava) return;
    // O clique armou um ✕ (o primeiro dos dois cliques de "Tirar"): a aba espera o segundo, ou o ✕ voltar a ser o que era
    if (lugar.querySelector('[data-arm="1"]')) {
      setTimeout(refazer, 500);
      return;
    }
    // O clique pode ter posto o cursor num campo de texto: ele continua onde o clique o pôs
    const ativo = document.activeElement;
    const cursor = ativo && lugar.contains(ativo) && ativo.matches(DIGITADO) && ativo.selectionStart !== null
      ? [ativo.value, ativo.selectionStart, ativo.selectionEnd, ativo.selectionDirection] : null;
    rCursos();
    const novo = document.activeElement;
    if (cursor && novo !== ativo && novo.matches(DIGITADO) && novo.value === cursor[0]) novo.setSelectionRange(cursor[1], cursor[2], cursor[3]);
  }
  // Depois do clique (js/dom.js: o botão solto, a próxima tecla ou a janela sem o foco)
  depoisDoClique(refazer);
}

// Uma alteração que não vale: o aviso, e a aba volta a mostrar o curso como está (o campo mexido também)
const recusar = texto => {
  showToast(texto);
  refazerAba();
};

// O aviso de uma gravação do programa que não deu certo, pelo código da recusa (e pelo campo dela)
function avisoDaRecusa(erro, sigla) {
  const { code, campo, message } = erro || {};
  if (code === 'PT409') {
    if (campo === 'formato') return 'Os programas ainda estão sendo trazidos do cadastro. Recarregue a página.';
    // O curso novo com a sigla de um curso que outra pessoa criou antes
    if (campo === 'sigla') return `Outra pessoa já criou o curso ${sigla}: a tela mostra os cursos como estão.`;
    return `Outra pessoa mudou o programa do ${sigla}: a tela mostra a versão atual. Refaça a alteração.`;
  }
  // Depois de um conflito, a tela fica só para consulta: nada mais é gravado, nem o programa
  if (code === '42501') return ApiClient.readOnly ? 'A tela está só para consulta: a alteração do programa não foi gravada.' : 'Só o Administrador muda os cursos.';
  if (code === '23514' && campo === 'codigo') {
    const travado = /missão (\S+) já tem resultados/.exec(message || '');
    return `Já há resultados com ${travado ? `o código ${travado[1]}` : 'este código'}: ele não muda (o nome muda).`;
  }
  if (['22023', '23505', '23514', 'P0002'].includes(code) && message) return frase(message);
  return 'Sem conexão: a alteração do programa não foi gravada.';
}

// Uma gravação que não deu certo: o resto da fila do curso já saiu, e a tela volta a mostrar o programa gravado, lido de
// novo (o curso com gravações esperando continua como a tela o mostra, também o curso novo que ainda não foi criado); sem
// conexão, o último curso confirmado (o curso novo que não foi criado sai da tela). O aviso diz o motivo. O foco que
// estava no curso novo que saiu da tela vai para "+ Novo curso" (não fica perdido no alto da página)
async function mostrarOGravado(sigla, gravado, erro) {
  let programa = null;
  try {
    programa = await ApiClient.lerProgramas();
  } catch {
    // Sem conexão: fica o último curso confirmado
  }
  const exigenciasAntes = exigenciasDaData();
  if (programa) {
    const esperando = [...filas.values()].map(f => f.curso).filter(c => !programa.some(p => p.sigla === c.sigla));
    S.programa = [...programa.map(c => (filas.has(c.sigla) ? filas.get(c.sigla).curso : c)), ...esperando];
  } else if (gravado) {
    porNaTela(gravado);
  } else {
    S.programa = (S.programa || []).filter(c => c.sigla !== sigla);
  }
  refazerEscalaSeMudou(exigenciasAntes);
  const ativo = document.activeElement;
  const focoNoCurso = Boolean(ativo && ativo.closest(`#cursos .curso[data-curso="${sigla}"]`));
  rCursos(); redesenharPorNome('alunos', 'pedidos-do-dia');
  if (focoNoCurso && !naTela(sigla)) focar(['#cur-novo']);
  showToast(avisoDaRecusa(erro, sigla));
}

// As gravações do curso, uma de cada vez, na ordem das alterações: cada uma com o curso como ficou naquela alteração e a
// versão confirmada pela anterior. A gravação confirmada vira a versão nova do curso, com a alteração na lista dele
async function enviar(sigla, fila) {
  fila.enviando = true;
  while (fila.itens.length) {
    const item = fila.itens[0];
    let resposta;
    try {
      resposta = await ApiClient.salvarCurso(sigla, fila.versao, item.conteudo, item.descricao);
      if (!resposta || !Number.isInteger(resposta.versao)) throw new Error('a gravação do curso voltou sem a versão nova');
    } catch (erro) {
      filas.delete(sigla);
      await mostrarOGravado(sigla, fila.gravado, erro);
      return;
    }
    fila.itens.shift();
    fila.versao = resposta.versao;
    const alteracao = { versao: resposta.versao, descricao: item.descricao, registrado_em: resposta.atualizado_em ?? null, registrado_por: ApiClient.autorAtual || null };
    fila.gravado = { ...item.curso, versao: resposta.versao, alteracoes: [alteracao, ...((fila.gravado && fila.gravado.alteracoes) || [])].slice(0, ALTERACOES_NA_TELA) };
  }
  filas.delete(sigla);
  confirmados.set(sigla, fila.gravado);
  // A tela fica com a versão gravada (o conteúdo é o que ela já mostra; muda só a lista das alterações). Se o programa
  // foi lido de novo enquanto a fila andava (a data trocada), ela volta a mostrar o que ficou gravado
  const mostrado = naTela(sigla);
  porNaTela(fila.gravado);
  if (mostrado !== fila.curso) {
    rCursos(); redesenharPorNome('alunos', 'pedidos-do-dia');
  } else {
    mostrarAlteracoes(fila.gravado);
  }
}

// Uma alteração conferida: o curso muda na tela (e com ele a próxima missão e o progresso dos alunos) e entra na fila de
// gravação. curso: o curso de onde ela partiu (cursoAtual; null: o curso novo, que a gravação cria). A descrição leva a
// sigla na frente ("PP: CT-03 alterada"), menos a do curso inteiro ('Curso MLTE criado: Multimotor', 'PC encerrado').
// Antes de a escala abrir, nada entra na fila (cada entrada já recusou, com o aviso, antes de mexer no curso: aqui é só a
// garantia, como em gravarAlteracao). A fila que já andava continua: as alterações dela vieram com os dados lidos
function alterar(curso, novo, descricao, { comSigla = true } = {}) {
  if (aindaNaoAbriu()) return;
  const sigla = novo.sigla;
  if (!filas.has(sigla)) filas.set(sigla, { versao: curso ? curso.versao : 0, gravado: curso, curso: novo, itens: [], enviando: false });
  const fila = filas.get(sigla);
  fila.curso = novo;
  fila.itens.push({ curso: novo, conteudo: conteudoDoCurso(novo), descricao: comSigla ? `${sigla}: ${descricao}` : descricao });
  const exigenciasAntes = exigenciasDaData();
  porNaTela(novo);
  // Primeiro a fila sai para o servidor; depois a escala (quando o que as missões exigem do INVA mudou), Alunos e a
  // Demanda são refeitos (um desenho que falha não a segura)
  if (!fila.enviando) enviar(sigla, fila);
  refazerEscalaSeMudou(exigenciasAntes);
  redesenharPorNome('alunos', 'pedidos-do-dia');
}

// Quem muda o programa, com ele na tela (lido das tabelas dos cursos)
const editavel = () => podeEditarCursos() && !programasIndisponiveis().length;

// O curso de um botão ou de um campo (o do cartão, como está agora), a fase do bloco e a missão da linha
function ondeNoPrograma(el) {
  const cartao = el.closest('.curso[data-curso]'), bloco = el.closest('.fase[data-fase]'), tr = el.closest('tr[data-missao]');
  const curso = cartao ? cursoAtual(cartao.dataset.curso) : null;
  const fase = curso && bloco ? curso.fases.find(f => f.id === bloco.dataset.fase && !f.removida) || null : null;
  const missao = curso && tr ? curso.missoes.find(m => m.id === tr.dataset.missao && !m.removida) || null : null;
  return { curso, fase, missao, tr };
}

// O foco depois de refazer a aba: o primeiro dos elementos que existe e está ligado (selecionar: o texto do campo). O que
// fica numa fase recolhida (a missão levada para outra fase ou de volta ao programa) abre a fase
function focar(seletores, { selecionar = false } = {}) {
  const el = seletores.map(s => s && $(s)).find(x => x && !x.disabled);
  if (!el) return;
  const fase = el.closest('#cursos .fase.recolhida');
  if (fase && !el.closest('.fase-cab')) recolherFase(fase.dataset.fase, true);
  el.focus();
  if (selecionar) el.select();
}
// A caixa "Depois de…" de uma fase ou de uma missão, aberta (quem acabou de escolher "Depois de…" escolhe a lista)
function abrirRequisitos(id) {
  const resumo = document.getElementById(`requisitos-${id}`);
  if (resumo) resumo.parentElement.open = true;
}

// A fase nos textos, só no curso com mais de uma ("na Fase 2", "na fase Programa": nomeDaFase); no curso com uma fase
// só, ela não é dita
function naFase(curso, faseId) {
  const { fases } = percursoDoCurso(curso);
  const fase = fases.find(f => f.id === faseId);
  return fases.length > 1 && fase ? ` na ${nomeDaFase(fase)}` : '';
}

// A regra na descrição da alteração: "PE-04 livre na fase", "NOT depois de TSL-01", "Fase 6 depois de Fase 4". Uma lista
// longa demais para a descrição vira quantas são
function regraNaDescricao(curso, item, nome, ehFase) {
  if (item.regra === 'livre') return `${nome} ${ehFase ? 'desde o início do curso' : 'livre na fase'}`;
  if (item.regra === 'ordem') return `${nome} ${ehFase ? 'depois das fases anteriores' : 'depois das anteriores'}`;
  const nomes = nomesDosRequisitos(curso, item), texto = `${nome} depois de ${listaComE(nomes)}`;
  return [...`${curso.sigla}: ${texto}`].length <= LIMITE_DA_DESCRICAO ? texto : `${nome} depois de ${nomes.length} ${ehFase ? 'fases' : 'missões'}`;
}

// A regra perdida ao voltar ao programa (js/programa.js, regraDeVolta): o aviso
function avisoDaRegraPerdida(nome, regraPerdida, ehFase) {
  const voltou = `${nome} voltou “${ehFase ? 'depois das fases anteriores' : 'depois das anteriores'}”`;
  return regraPerdida === 'requisitos-fora'
    ? `${voltou}: ${ehFase ? 'as fases' : 'as missões'} que ela esperava não estão mais antes dela.`
    : `${voltou}: a lista “Depois de…” não fica guardada fora do programa. Escolha de novo em “${ehFase ? 'Abre' : 'Quando voar'}”.`;
}

// Incluir, subir, descer e tirar (com confirmação) uma missão refazem a aba, com o foco no que foi mexido
aoAcionar(['missao-nova', 'missao-subir', 'missao-descer', 'missao-retirar'], b => {
  if (!editavel()) return;
  const { curso, missao: m } = ondeNoPrograma(b);
  if (!curso) return;
  const a = b.dataset.act;
  if (a === 'missao-nova') {
    // O código novo pula os que os resultados ou a Demanda da data aberta levam, também sem missão
    const r = incluirMissao(curso, b.dataset.fase || null, undefined, codigosReservados(curso.sigla));
    if (!r || !conferido(r.curso)) return;
    alterar(curso, r.curso, `${r.missao.codigo} incluída${naFase(r.curso, r.missao.fase)}`);
    rCursos();
    // O nome da missão nova em foco, selecionado: o que for digitado fica no lugar do código
    focar([`#cursos tr[data-missao="${r.missao.id}"] [data-cf="nome"]`], { selecionar: true });
    return;
  }
  if (!m) return;
  if (a === 'missao-retirar') {
    if (!confirmado(b, 'Confirmar')) return;
    const novo = retirarMissao(curso, m.id);
    if (!novo || !conferido(novo)) return;
    alterar(curso, novo, `${m.codigo} tirada do programa`);
    rCursos();
    // O foco vai para a missão que ficou no lugar (ou para a anterior; na fase vazia, para o "+ Missão" dela)
    const antes = percursoDoCurso(curso).porFase.get(m.fase) || [], depois = percursoDoCurso(novo).porFase.get(m.fase) || [];
    const vizinha = depois[Math.min(antes.indexOf(m), depois.length - 1)];
    focar([vizinha && `#cursos tr[data-missao="${vizinha.id}"] [data-cf="codigo"]`, `#cursos [data-act="missao-nova"][data-fase="${m.fase}"]`]);
    return;
  }
  const novo = moverMissao(curso, m.id, a === 'missao-subir' ? -1 : 1);
  if (!novo || !ordemValida(novo, m.id) || !conferido(novo)) return;
  const posicao = (percursoDoCurso(novo).porFase.get(m.fase) || []).findIndex(x => x.id === m.id);
  alterar(curso, novo, `${m.codigo} passou para ${posicao + 1}ª`);
  rCursos();
  focar([`#cursos tr[data-missao="${m.id}"] [data-act="${a}"]`, `#cursos tr[data-missao="${m.id}"] [data-cf="codigo"]`]);
});

// "+ Fase", subir, descer e tirar uma fase (com confirmação; só a fase sem missões sai), com o foco no que foi mexido
aoAcionar(['fase-nova', 'fase-subir', 'fase-descer', 'fase-retirar'], b => {
  if (!editavel()) return;
  const { curso, fase: f } = ondeNoPrograma(b);
  if (!curso) return;
  const a = b.dataset.act;
  if (a === 'fase-nova') {
    const r = incluirFase(curso);
    if (!conferido(r.curso)) return;
    alterar(curso, r.curso, `${nomeDaFase(r.fase)} incluída`);
    rCursos();
    focar([`#cursos .fase[data-fase="${r.fase.id}"] [data-cfa="nome"]`], { selecionar: true });
    return;
  }
  if (!f) return;
  if (a === 'fase-retirar') {
    if (!confirmado(b, 'Confirmar')) return;
    const novo = retirarFase(curso, f.id);
    if (!novo || !conferido(novo)) return;
    alterar(curso, novo, `${nomeDaFase(f)} tirada do programa`);
    rCursos();
    // O foco vai para a fase que ficou no lugar (ou para a anterior; sem nenhuma, para o "+ Fase" do curso)
    const antes = percursoDoCurso(curso).fases, depois = percursoDoCurso(novo).fases;
    const vizinha = depois[Math.min(antes.indexOf(f), depois.length - 1)];
    focar([vizinha && `#cursos .fase[data-fase="${vizinha.id}"] [data-cfa="nome"]`, `#cursos .curso[data-curso="${curso.sigla}"] [data-act="fase-nova"]`]);
    return;
  }
  const novo = moverFase(curso, f.id, a === 'fase-subir' ? -1 : 1);
  if (!novo || !ordemValida(novo, f.id) || !conferido(novo)) return;
  const posicao = percursoDoCurso(novo).fases.findIndex(x => x.id === f.id);
  alterar(curso, novo, `${nomeDaFase(f)} passou para ${posicao + 1}ª`);
  rCursos();
  focar([`#cursos .fase[data-fase="${f.id}"] [data-act="${a}"]`, `#cursos .fase[data-fase="${f.id}"] [data-cfa="nome"]`]);
});

// "Voltar ao programa": a fase ou a missão volta ao lugar de antes, com a regra; a regra "depois de…" que não pôde
// voltar (a lista não está mais antes dela, ou não ficou guardada) vira "depois das anteriores", com o aviso. A missão
// de uma fase fora do programa espera a fase voltar
aoAcionar(['fase-restaurar', 'missao-restaurar'], b => {
  if (!editavel()) return;
  const { curso } = ondeNoPrograma(b);
  if (!curso) return;
  if (b.dataset.act === 'fase-restaurar') {
    const f = curso.fases.find(x => x.id === b.dataset.fase && x.removida);
    const r = f && restaurarFase(curso, f.id);
    if (!r || !conferido(r.curso)) return;
    alterar(curso, r.curso, `${nomeDaFase(f)} de volta ao programa`);
    rCursos();
    focar([`#cursos .fase[data-fase="${f.id}"] [data-cfa="nome"]`]);
    if (r.regraPerdida) showToast(`A ${avisoDaRegraPerdida(nomeDaFase(f), r.regraPerdida, true)}`);
    return;
  }
  const m = curso.missoes.find(x => x.id === b.dataset.missao && x.removida);
  if (!m) return;
  const fase = curso.fases.find(x => x.id === m.fase);
  if (!fase || fase.removida) {
    showToast(`A missão ${m.codigo} é ${fase ? `da ${nomeDaFase(fase)}, que está` : 'de uma fase'} fora do programa: volte com a fase antes.`);
    return;
  }
  const r = restaurarMissao(curso, m.id);
  if (!r || !conferido(r.curso)) return;
  alterar(curso, r.curso, `${m.codigo} de volta ao programa`);
  rCursos();
  focar([`#cursos tr[data-missao="${m.id}"] [data-cf="codigo"]`]);
  if (r.regraPerdida) showToast(`A missão ${avisoDaRegraPerdida(m.codigo, r.regraPerdida, false)}`);
});

// O trecho do Noturno na descrição da alteração: "TSL-01 é a ida do Noturno"
const TRECHOS = { ida: 'a ida', noite: 'a noite', volta: 'a volta' };

// O código digitado para uma missão, conferido: o motivo da recusa, ou ''. O código é o que os resultados e os pedidos
// guardam (o resultado do voo vai para o código do pedido). Ele não muda quando já há resultados com ele, nem quando a
// Demanda da data aberta o leva (o nome muda); e não vale o código de outra missão do curso (também a tirada do
// programa, que guarda o seu), nem o que, sem missão, os resultados ou a Demanda ainda levam: os resultados e o voo
// passariam para a missão que o recebesse
function recusaDoCodigo(curso, m, valor) {
  if (valor === m.codigo) return '';
  if (codigoTravado(curso.sigla, m)) return `Já há resultados com o código ${m.codigo}: ele não muda (o nome muda).`;
  const naDemanda = codigoNaDemanda(curso.sigla, m.codigo);
  if (naDemanda) return `O código ${m.codigo} está ${naDemanda}: ele não muda enquanto um pedido o leva (o nome muda).`;
  if (!codigoValido(valor)) return 'O código da missão usa letras, números, ponto e hífen (até 15).';
  const outra = curso.missoes.find(o => o.id !== m.id && o.codigo === valor);
  if (outra) return outra.removida ? `O código ${valor} é de uma missão tirada do programa do ${curso.sigla} (ela guarda o código).` : `O código ${valor} já existe no ${curso.sigla}.`;
  if (codigoComResultados(curso.sigla, valor)) return `Já há resultados com o código ${valor} no ${curso.sigla}: ele não vai para outra missão (os resultados passariam para ela).`;
  const doPedido = codigoNaDemanda(curso.sigla, valor);
  return doPedido ? `O código ${valor} está ${doPedido}: ele não vai para outra missão (o voo passaria para ela).` : '';
}

// Os campos de uma missão: o código (recusaDoCodigo), o nome, o tipo de missão, o trecho do Noturno, o recurso, as
// horas, quando voar e a lista "Depois de…", as marcas e a fase
function mudarCampoDaMissao(campo) {
  const { curso, missao: m, tr } = ondeNoPrograma(campo);
  if (!m) return;
  const cf = campo.dataset.cf;
  let novo;
  if (cf === 'regra') {
    novo = definirRegra(curso, m.id, campo.value);
  } else if (cf === 'requer') {
    const lista = [...tr.querySelectorAll('[data-cf="requer"]:checked')].map(x => x.value);
    if (!lista.length) return recusar(`A missão ${m.codigo} espera pelo menos uma missão: para não esperar nenhuma, escolha “Livre na fase”.`);
    novo = definirRegra(curso, m.id, 'depois', lista);
  } else if (cf === 'dispensada' || cf === 'avaliacao') {
    novo = marcarMissao(curso, m.id, cf, campo.checked);
  } else if (cf === 'exige') {
    // As habilitações que o INVA precisa: a lista inteira, como está marcada na caixa da missão (até 10, como o servidor
    // guarda: a 11ª é recusada com o motivo)
    const lista = [...tr.querySelectorAll('[data-cf="exige"]:checked')].map(x => x.value);
    if (lista.length > LIMITE_DO_EXIGE) return recusar(`A missão ${m.codigo} exige do INVA no máximo ${LIMITE_DO_EXIGE} habilitações além da missão e do recurso: desmarque uma antes de marcar outra.`);
    novo = exigirNaMissao(curso, m.id, lista);
  } else if (cf === 'trecho') {
    // O Noturno desmanchado (a ida sem a noite logo depois, por exemplo) é recusado na conferência, com o motivo
    novo = definirTrecho(curso, m.id, campo.value);
  } else if (cf === 'fase') {
    novo = moverMissaoParaFase(curso, m.id, campo.value);
    if (novo && !ordemValida(novo, m.id)) return refazerAba();
  } else {
    let valor = campo.value;
    if (cf === 'codigo') {
      valor = campo.value.trim().toUpperCase();
      const erro = recusaDoCodigo(curso, m, valor);
      if (erro) return recusar(erro);
    } else if (cf === 'nb') {
      // As horas: de 0,1 h a 5 h, em décimos; fora disso, não vale
      valor = duracaoDigitada(campo.value);
      if (valor === null) return recusar(ERRO_DA_DURACAO);
    }
    novo = mudarMissao(curso, m.id, cf, valor);
  }
  // Nada mudou (o código em minúsculas, o nome com espaços a mais) ou a alteração não vale: a aba volta a mostrar a
  // missão como está
  if (!novo || !conferido(novo)) return refazerAba();
  const salva = novo.missoes.find(x => x.id === m.id);
  // O código novo diz o de antes ("PP: CT-03 → CT-3A"): as alterações do programa mostram de onde ele veio
  const descricao = cf === 'codigo' ? `${m.codigo} → ${salva.codigo}`
    : cf === 'regra' || cf === 'requer' ? regraNaDescricao(novo, salva, salva.codigo, false)
      : cf === 'dispensada' ? `${salva.codigo} ${salva.dispensada ? 'dispensada' : 'deixa de ser dispensada'}`
        : cf === 'avaliacao' ? `${salva.codigo} ${salva.avaliacao ? 'é avaliação' : 'deixa de ser avaliação'}`
          : cf === 'exige' ? (salva.exige.length ? `${salva.codigo} exige do INVA ${listaComE(salva.exige.map(nomeDaHabilitacao))}` : `${salva.codigo} não exige mais habilitação do INVA além da missão e do recurso`)
          : cf === 'trecho' ? `${salva.codigo} ${salva.trecho ? `é ${TRECHOS[salva.trecho]} do Noturno` : 'deixa de ser trecho do Noturno'}`
            : cf === 'fase' ? `${salva.codigo} passou para a ${nomeDaFase(novo.fases.find(f => f.id === salva.fase))}`
              : `${salva.codigo} alterada`;
  alterar(curso, novo, descricao);
  refazerAba();
  if (cf === 'regra' && salva.regra === 'depois') abrirRequisitos(m.id);
  // Marcada antes de algum INVA ativo ter (regra a): nada a impede, e o aviso diz o que acontece com os voos dela
  const semInstrutor = cf === 'exige' ? exigeSemInstrutor(salva).filter(h => !(m.exige || []).includes(h)) : [];
  if (semInstrutor.length) showToast(`${textoDoExigeSemInstrutor(semInstrutor)}: os voos de ${salva.codigo} ficam fora da escala até um INVA ter (marque em Instrutores › Editar habilitações).`);
  // A missão foi para outra fase: o foco a acompanha
  if (cf === 'fase') focar([`#cursos tr[data-missao="${m.id}"] [data-cf="fase"]`]);
}

// Os campos de uma fase: o nome (vazio não vale), o módulo, quando ela abre e a lista "Depois de…"
function mudarCampoDaFase(campo) {
  const { curso, fase: f } = ondeNoPrograma(campo);
  if (!f) return;
  const cfa = campo.dataset.cfa, rotulo = nomeDaFase(f);
  let novo = null;
  if (cfa === 'nome' && !campo.value.trim()) return recusar('O nome da fase vai de 1 a 80 caracteres.');
  if (cfa === 'nome' || cfa === 'modulo') {
    novo = mudarFase(curso, f.id, cfa, campo.value);
  } else if (cfa === 'regra') {
    novo = definirRegra(curso, f.id, campo.value);
  } else if (cfa === 'requer') {
    const lista = [...campo.closest('.fase-cab').querySelectorAll('[data-cfa="requer"]:checked')].map(x => x.value);
    if (!lista.length) return recusar(`A ${rotulo} espera pelo menos uma fase: para não esperar nenhuma, escolha “Desde o início do curso”.`);
    novo = definirRegra(curso, f.id, 'depois', lista);
  }
  if (!novo || !conferido(novo)) return refazerAba();
  const salva = novo.fases.find(x => x.id === f.id);
  alterar(curso, novo, cfa === 'regra' || cfa === 'requer' ? regraNaDescricao(novo, salva, nomeDaFase(salva), true) : `${nomeDaFase(salva)} alterada`);
  refazerAba();
  if (cfa === 'regra' && salva.regra === 'depois') abrirRequisitos(f.id);
}

// O nome do curso (vazio não vale)
function mudarCampoDoCurso(campo) {
  const { curso } = ondeNoPrograma(campo);
  if (!curso) return;
  if (!campo.value.trim()) return recusar('O nome do curso vai de 1 a 80 caracteres.');
  const novo = mudarCurso(curso, 'nome', campo.value);
  if (!novo || !conferido(novo)) return refazerAba();
  alterar(curso, novo, `Curso ${curso.sigla} renomeado: ${novo.nome}`, { comSigla: false });
  refazerAba();
}

// Os campos mudam o curso, e a aba é refeita no lugar (o foco continua no campo, ou vai para o seguinte no Tab; o campo
// digitado que perdeu o foco para um clique, depois do clique: refazerAba). Antes de a escala abrir, nenhum campo muda o
// curso (também o trecho do Noturno): o aviso, e a aba volta a mostrar o programa como está
document.addEventListener('change', e => {
  const campo = e.target.closest('#cursos [data-cc], #cursos [data-cf], #cursos [data-cfa]');
  if (!campo || !editavel()) return;
  if (aindaNaoAbriu()) { rCursos(); return; }
  esperarOClique = ponteiroApertado() && campo.matches(DIGITADO);
  try {
    if (campo.hasAttribute('data-cc')) mudarCampoDoCurso(campo);
    else if (campo.hasAttribute('data-cfa')) mudarCampoDaFase(campo);
    else mudarCampoDaMissao(campo);
  } finally {
    esperarOClique = false;
  }
});

// "Mostrar encerrados", para todos os perfis (também quem só consulta): os botões dos cursos encerrados aparecem ou somem
// (o encerrado que estava na tela dá o lugar ao primeiro ativo)
document.addEventListener('change', e => {
  if (e.target.id !== 'cur-encerrados') return;
  filtrarCursos({ encerrados: e.target.checked });
  rCursos();
});

// O que só muda o que se vê, para todos os perfis: o curso na tela (o foco fica no botão dele), recolher e abrir uma fase
// (no título dela) ou todas, e os links do índice das fases
document.addEventListener('click', e => {
  if (!(e.target instanceof Element) || !e.target.closest('#cursos')) return;
  const curso = e.target.closest('[data-ver-curso]'), fase = e.target.closest('[data-recolher-fase]'), link = e.target.closest('[data-ir-fase]');
  if (curso) {
    filtrarCursos({ curso: curso.dataset.verCurso });
    rCursos();
  } else if (fase) {
    recolherFase(fase.dataset.recolherFase);
  } else if (link) {
    e.preventDefault();
    irParaFase(link.dataset.irFase);
  } else if (e.target.closest('#fases-abrir, #fases-recolher')) {
    recolherTodasAsFases(Boolean(e.target.closest('#fases-recolher')));
  }
});

// Os cursos ------------------------------------------------------------------------------------------------------------

const quantas = (n, uma, varias) => `${n} ${n === 1 ? uma : varias}`;

// Encerrar (com confirmação) e reativar um curso. O encerrado sai das matrículas novas (Alunos); os alunos que já estão
// nele continuam, com a próxima missão e o progresso. Ele continua à vista na aba ("Mostrar encerrados" fica marcado),
// com o foco em "Reativar o curso"
aoAcionar(['curso-encerrar', 'curso-reativar'], b => {
  if (!editavel()) return;
  const { curso } = ondeNoPrograma(b);
  if (!curso) return;
  const encerrar = b.dataset.act === 'curso-encerrar';
  if (encerrar && !confirmado(b, 'Confirmar encerramento')) return;
  const novo = mudarCurso(curso, 'ativo', !encerrar);
  if (!novo || !conferido(novo)) return;
  alterar(curso, novo, `${curso.sigla} ${encerrar ? 'encerrado' : 'reativado'}`, { comSigla: false });
  if (encerrar) filtrarCursos({ encerrados: true });
  rCursos();
  focar([`#cursos .curso[data-curso="${curso.sigla}"] [data-act="${encerrar ? 'curso-reativar' : 'curso-encerrar'}"]`]);
  showToast(encerrar ? `${curso.sigla} encerrado: ele sai da lista dos cursos em Alunos; quem já está nele continua.` : `${curso.sigla} reativado.`, 'ok');
});

// O que o modelo faz no programa, no botão armado: "12 missões ficam, 35 entram, 28 saem" (sem as partes vazias)
function resumoDoModelo({ mantidas, novas, retiradas }) {
  const partes = [[mantidas, 'fica', 'ficam'], [novas, 'entra', 'entram'], [retiradas, 'sai', 'saem']].filter(([n]) => n > 0);
  return partes.map(([n, uma, varias], i) => `${n}${i ? '' : ` ${n === 1 ? 'missão' : 'missões'}`} ${n === 1 ? uma : varias}`).join(', ');
}

// "Usar o cronograma do PP" (no PP vazio ou numa fase só): o programa passa a ser o do modelo (aplicarModelo). O primeiro
// clique arma o botão com o que acontece (as missões que ficam, entram e saem); o segundo aplica. Nada é gravado sem ele
aoAcionar('curso-modelo', b => {
  if (!editavel()) return;
  const { curso } = ondeNoPrograma(b);
  const modelo = Object.hasOwn(MODELOS, b.dataset.modelo) ? MODELOS[b.dataset.modelo] : null;
  if (!curso || !modelo) return;
  const r = aplicarModelo(curso, modelo);
  if (!confirmado(b, `Confirmar: ${resumoDoModelo(r)}`) || !conferido(r.curso)) return;
  alterar(curso, r.curso, `cronograma ${modelo.documento} aplicado (${quantas(r.mantidas, 'mantida', 'mantidas')}, ${quantas(r.novas, 'nova', 'novas')}, ${quantas(r.retiradas, 'retirada', 'retiradas')})`);
  rCursos();
  focar([`#cursos .curso[data-curso="${curso.sigla}"] [data-cc="nome"]`]);
});

// "+ Novo curso": o formulário abre (e fecha) embaixo da barra, vazio e com o foco na sigla; fechado, o foco volta ao botão.
// Cancelar e Esc (com o foco no formulário) fecham sem criar nada
function mostrarFormularioDoCurso(abrir) {
  const form = $('#form-curso'), botao = $('#cur-novo');
  if (!form || !botao) return;
  form.hidden = !abrir;
  botao.setAttribute('aria-expanded', String(abrir));
  $('#cur-sigla').value = '';
  $('#cur-nome').value = '';
  form.querySelector('[name="cur-comeco"][value="vazio"]').checked = true;
  marcarCampoDoCurso(null, '');
  (abrir ? $('#cur-sigla') : botao).focus();
}
// O erro do curso novo: o motivo em #cur-erro (a descrição dos dois campos: o leitor de tela diz os dois) e o campo com
// o problema marcado (aria-invalid)
function marcarCampoDoCurso(campo, erro) {
  $('#cur-erro').textContent = erro;
  for (const nome of ['sigla', 'nome']) {
    if (nome === campo) $(`#cur-${nome}`).setAttribute('aria-invalid', 'true');
    else $(`#cur-${nome}`).removeAttribute('aria-invalid');
  }
}
aoAcionar('curso-novo', () => {
  if (editavel()) mostrarFormularioDoCurso($('#form-curso').hidden);
});
document.addEventListener('click', e => {
  if (e.target.closest('#cur-cancelar')) mostrarFormularioDoCurso(false);
});
fecharNoEsc(() => { const form = $('#form-curso'); return form && !form.hidden ? form : null; }, () => mostrarFormularioDoCurso(false));

// "Criar o curso": a sigla (em maiúsculas; no formato e uma vez só, também entre os encerrados) e o nome, conferidos no
// formulário (o erro fica embaixo dos campos, com o campo marcado); o programa vazio ou o modelo escolhido. O curso entra
// na tela na hora, escolhido no filtro, e vai para a gravação (a versão 0 o cria). O foco vai para "+ Fase" (com o
// modelo, para o nome do curso, no alto do programa). Antes de a escala abrir, o curso não é criado: o aviso, e o
// formulário fica como está
document.addEventListener('submit', e => {
  if (e.target.id !== 'form-curso') return;
  e.preventDefault();
  if (!editavel() || aindaNaoAbriu()) return;
  const comeco = e.target.querySelector('[name="cur-comeco"]:checked');
  const modelo = comeco && Object.hasOwn(MODELOS, comeco.value) ? MODELOS[comeco.value] : null;
  const { curso, erro, campo } = novoCurso(S.programa || [], { sigla: $('#cur-sigla').value, nome: $('#cur-nome').value, modelo });
  if (erro) {
    marcarCampoDoCurso(campo, erro);
    $(`#cur-${campo}`).focus();
    return;
  }
  if (!conferido(curso)) return;
  alterar(null, curso, `Curso ${curso.sigla} criado: ${curso.nome}${modelo ? ` (com o cronograma ${modelo.documento})` : ''}`, { comSigla: false });
  mostrarFormularioDoCurso(false);
  filtrarCursos({ curso: curso.sigla });
  rCursos();
  const noCartao = seletor => `#cursos .curso[data-curso="${curso.sigla}"] ${seletor}`;
  focar(modelo ? [noCartao('[data-cc="nome"]')] : [noCartao('[data-act="fase-nova"]')]);
});
