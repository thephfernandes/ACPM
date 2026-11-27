// Alunos: a lista e o detalhe (o componente: js/views/mestre-detalhe.js, com os modelos de js/views/alunos.js), incluir,
// excluir, os campos do cadastro, "Priorizar com" e "Não escalar com". Os campos são gravados ao sair deles (change), pelo
// mesmo caminho de sempre (registro.js, gravarAlteracao); o valor recusado fica no campo, com a mensagem
import { gravarAlteracao, ultimaGravacao } from '../actions.js';
import { normalizarCursoDoAluno } from '../cursos.js';
import { nomeLimpo, numeroBr } from '../format.js';
import { blank, pesoDoTexto, ERRO_DO_PESO } from '../rules.js';
import { S, insBy, stuBy, isGestor } from '../state.js';
import { confirmado } from './confirmacao.js';
import { aoAcionar, aoMudarCampo } from './registro.js';
import { registrarDesenho, redesenharPorNome } from '../redesenho.js';
import { criarMestreDetalhe } from '../views/mestre-detalhe.js';
import { modeloDosAlunos, detalheDoAluno } from '../views/alunos.js';
import { aoMudarDadosPessoais } from '../views/dados-pessoais.js';
import { pessoaEscolhida } from '../views/editor-de-dados-pessoais.js';
import { criarFiltroDosCursos } from '../views/filtro-dos-cursos.js';
import { registrarTela } from '../views/telas.js';

const tela = criarMestreDetalhe({
  id: 'alu',
  rotulo: 'Alunos',
  nomes: ['aluno', 'alunos'],
  semItens: 'Nenhum aluno cadastrado. Clique em “+ Novo aluno” acima para cadastrar.',
  vazio: 'Escolha um aluno na lista.',
  // O filtro dos cursos (o mesmo da Demanda: as marcas valem nas duas telas)
  filtros: [{ criar: aoMudar => criarFiltroDosCursos('flt-alu-cur', aoMudar), valores: item => item.valores.curso }],
  modelo: () => modeloDosAlunos(tela.selecionado()),
  // O aluno escolhido: os dados pessoais dele são lidos (250 ms depois de a escolha parar nele)
  detalhe: id => {
    pessoaEscolhida('aluno', +id, opcoes => tela.desenhar(opcoes));
    return detalheDoAluno(id);
  },
  edita: () => !isGestor()
});

// O desenho de Alunos (js/redesenho.js): os dados de uma data, quem só consulta, a releitura e o perfil
registrarDesenho('alunos', tela.desenhar, { em: ['dados', 'consulta', 'releitura', 'perfil'], ordem: 30, comMomento: true });
// O endereço: #/alu/<id> escolhe o aluno (numa vista só, abre o detalhe)
registrarTela('alu', { aoMostrar: (item, opcoes) => tela.aoMostrar(item, opcoes) });
// O CANAC das linhas acompanha os dados pessoais
aoMudarDadosPessoais(() => tela.desenhar());

// O aluno novo: escolhido, com o nome selecionado, à vista mesmo fora da busca (até ela mudar)
aoAcionar('adds', () => {
  const novo = { id: S.nid++, nm: 'Novo aluno', kg: 0, bl: [], extra: [], ...blank() };
  S.stu.push(novo);
  if (!gravarAlteracao('inc', `Aluno cadastrado: ${novo.nm}`)) { S.stu = S.stu.filter(x => x !== novo); return; }
  tela.novo(novo.id, ultimaGravacao());
  redesenharPorNome('pedidos-do-dia');
  tela.focarNoCampo('nm', { selecionar: true });
});

// O ✕ de uma etiqueta: o foco vai para a lista do mesmo campo (o ✕ sumiu)
aoAcionar('unbl', (b, { id }) => {
  const s = stuBy(id);
  const blkIns = insBy(+b.dataset.b);
  s.bl = s.bl.filter(v => v !== +b.dataset.b);
  gravarAlteracao('mod', `${s.nm}: volta a ser escalado com ${blkIns ? blkIns.nm : ''}`);
  tela.desenhar();
  tela.focarNoCampo('bl');
  redesenharPorNome('pedidos-do-dia');
});

aoAcionar('unvc', (b, { id }) => {
  const s = stuBy(id);
  const ins = insBy(+b.dataset.b);
  s.voaCom = (s.voaCom || []).filter(v => v !== +b.dataset.b);
  if (!s.voaCom.length) delete s.voaCom;
  gravarAlteracao('mod', `${s.nm}: deixa de priorizar ${ins ? ins.nm : ''}`);
  tela.desenhar();
  tela.focarNoCampo('voaCom');
  redesenharPorNome('pedidos-do-dia');
});

// "Excluir aluno…", no rodapé do detalhe: dois cliques
aoAcionar('dels', (b, { id }) => {
  if (!confirmado(b, 'Confirmar exclusão')) return;
  const target = stuBy(id);
  S.stu = S.stu.filter(x => x.id !== id);
  gravarAlteracao('exc', `Aluno excluído: ${target ? target.nm : id}`);
  tela.removido(id);
  redesenharPorNome('instrutores', 'pedidos-do-dia');
});

// Os campos do cadastro de um aluno, no detalhe
aoMudarCampo('s', (t, { f, id }) => {
  const s = stuBy(id);
  if (!s) return;
  let historico;
  if (f === 'nm') {
    const old = s.nm;
    s.nm = nomeLimpo(t.value, s.nm);
    historico = ['mod', `Aluno: ${old} → ${s.nm}`];
  } else if (f === 'kg') {
    const kg = pesoDoTexto(t.value, t.validity.badInput);
    if (kg === null) { tela.erroNoCampo('kg', ERRO_DO_PESO); return; }
    s.kg = kg;
    historico = ['mod', `Peso ${s.nm}: ${numeroBr(s.kg)} kg`];
  } else if (f === 'bl' && t.value) {
    s.bl.push(+t.value);
    // Quem não voa com o aluno sai do “Priorizar com” dele
    if (s.voaCom) s.voaCom = s.voaCom.filter(v => v !== +t.value);
    if (s.voaCom && !s.voaCom.length) delete s.voaCom;
    const ins = insBy(+t.value);
    historico = ['exc', `${s.nm}: não escalar com ${ins ? ins.nm : ''}`];
  } else if (f === 'voaCom' && t.value) {
    s.voaCom = [...(s.voaCom || []), +t.value];
    const ins = insBy(+t.value);
    historico = ['mod', `${s.nm}: priorizar com ${ins ? ins.nm : ''}`];
  } else if (f === 'curso') {
    // O curso do aluno: qualquer sigla no formato (também a de um curso que o Administrador criou na aba Cursos)
    const curso = normalizarCursoDoAluno(t.value);
    if (curso) s.curso = curso;
    else delete s.curso;
    historico = ['mod', `Curso de ${s.nm}: ${curso || 'nenhum'}`];
  } else return;
  gravarAlteracao(...historico);
  tela.desenhar();
  // As listas de instrutores: o foco fica na lista que mudou (a opção escolhida saiu dela)
  if (f === 'bl' || f === 'voaCom') tela.focarNoCampo(f);
  // A Demanda mostra o nome do aluno, o “Priorizar com” dele (no Automático do instrutor) e as missões do curso dele
  if (['nm', 'voaCom', 'bl', 'curso'].includes(f)) redesenharPorNome('pedidos-do-dia');
});
