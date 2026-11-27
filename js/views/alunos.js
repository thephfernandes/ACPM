// Alunos como lista e detalhe (o componente: js/views/mestre-detalhe.js): os modelos que a tela dá a ele, lidos do estado.
// A linha: o nome, o CANAC (para quem vê os dados pessoais) e o curso, o progresso (com o progresso ligado) e o ponto de
// quem está sem peso. O detalhe: o cadastro (nome, peso, curso, "Priorizar com", "Não escalar com"), os dados pessoais
// (para quem os vê: js/views/editor-de-dados-pessoais.js) e "Excluir aluno…" no rodapé. Os campos têm os data-f de sempre:
// js/eventos/alunos.js grava
import { LIMITE_DO_NOME, numeroBr } from '../format.js';
import { S, insBy, stuBy, inativoNaDataAberta } from '../state.js';
import { inativo } from '../inativos.js';
import { SEM_CURSO } from '../cursos.js';
import { canacDe, podeVerDadosPessoais } from './dados-pessoais.js';
import { progressoEmTexto } from './etapas.js';
import { secaoDosDadosPessoais, marcaDaPessoa, recusasDe } from './editor-de-dados-pessoais.js';
import { cursosConhecidos } from './filtro-dos-cursos.js';

// O instrutor já escolhido que ficou inativo continua na etiqueta, com "(inativo)"; a lista oferece só os ativos
const nomeComInativo = x => (inativoNaDataAberta(x) ? `${x.nm} (inativo)` : x.nm);

// O curso do aluno: os cursos ativos (a aba Cursos), e o curso dele quando está encerrado ("(encerrado)") ou não existe
// ("(curso desconhecido)"). Sem os programas lidos, os três cursos com que o app começa (o servidor sempre os tem:
// nenhum curso é apagado) e o curso dele que não é um deles, só pela sigla (nada é dito sobre ele)
function opcoesDoCurso(s) {
  const { semProgramas, programa } = cursosConhecidos();
  const atual = s.curso ? programa.find(c => c.sigla === s.curso) : null;
  const doAluno = !s.curso || (atual && atual.ativo) ? []
    : [[s.curso, atual ? `${s.curso} · ${atual.nome} (encerrado)` : semProgramas ? s.curso : `${s.curso} (curso desconhecido)`]];
  return [['', '—'], ...programa.filter(c => c.ativo).map(c => [c.sigla, `${c.sigla} · ${c.nome}`]), ...doAluno];
}
// O nome do curso do aluno, para o subtítulo e para quem só consulta
function nomeDoCurso(s) {
  if (!s.curso) return '';
  const curso = cursosConhecidos().programa.find(c => c.sigla === s.curso);
  return curso ? `${s.curso} · ${curso.nome}` : s.curso;
}

// O ponto da linha: os dados pessoais não salvos (o rascunho, a recusa) e o peso que falta
function pontoDoAluno(s) {
  const marca = marcaDaPessoa('aluno', s.id);
  const semPeso = s.kg ? '' : 'sem peso';
  if (marca) return { ponto: marca.ponto, pontoRotulo: [marca.rotulo, semPeso].filter(Boolean).join('; ') };
  return { ponto: semPeso ? 'aviso' : '', pontoRotulo: semPeso };
}

// A linha de um aluno
function itemDoAluno(s) {
  const veDados = podeVerDadosPessoais();
  const canac = veDados ? canacDe('aluno', s.id) : '';
  const progresso = progressoEmTexto(s);
  return {
    id: s.id,
    titulo: s.nm,
    linha2: [canac ? `CANAC ${canac}` : '', s.curso || 'sem curso'].filter(Boolean).join(' · '),
    meta: progresso ? progresso.contagem : '',
    linha3: progresso ? progresso.resto : '',
    ...pontoDoAluno(s),
    inativo: inativo(s),
    // O "Ativo" do cadastro (js/eventos/inativos.js): um clique em cada sentido
    chave: { marcado: !inativo(s), texto: 'Ativo', rotulo: `${s.nm} ativo no cadastro`, atributos: 'data-act="ativo" data-de="aluno"' },
    atributos: `data-k="s" data-id="${s.id}"`,
    busca: [s.nm, canac].filter(Boolean),
    valores: { curso: [s.curso || SEM_CURSO] }
  };
}

// O modelo da lista. O aviso: os dados pessoais de um aluno que o servidor recusou (o primeiro que não está aberto), com
// "Abrir"
export function modeloDosAlunos(escolhido = null) {
  const recusa = recusasDe('aluno').find(r => String(r.id) !== String(escolhido) && stuBy(+r.id));
  const aviso = recusa ? { texto: `Os dados pessoais de ${stuBy(+recusa.id).nm} não foram salvos: ${recusa.texto.replace(/\.$/, '')}.`, abrir: recusa.id } : null;
  return { fixos: [], grupos: [], itens: S.stu.map(itemDoAluno), estado: 'pronto', aviso };
}

// As etiquetas de um dos dois campos de instrutores ("Priorizar com", "Não escalar com") e a lista que acrescenta
function instrutoresDoAluno(s, { ids, rotuloDoX, classe, campo, vazio, fora }) {
  return {
    itens: ids.map(insBy).filter(Boolean).map(x => ({ texto: nomeComInativo(x), rotulo: rotuloDoX(x), atributos: `data-act="${campo === 'bl' ? 'unbl' : 'unvc'}" data-b="${x.id}"`, classe })),
    acrescentar: { atributos: `data-f="${campo}"`, vazio, rotulo: vazio.replace('…', ''), opcoes: S.ins.filter(x => !fora.includes(x.id) && !inativo(x)).map(x => [String(x.id), x.nm]) }
  };
}

// O detalhe de um aluno (null: ele saiu do cadastro)
export function detalheDoAluno(id) {
  const s = stuBy(+id);
  if (!s) return null;
  const veDados = podeVerDadosPessoais();
  const canac = veDados ? canacDe('aluno', s.id) : '';
  const progresso = progressoEmTexto(s);
  const voaCom = s.voaCom || [];
  const campos = [
    { id: 'nm', rotulo: 'Nome', tipo: 'texto', valor: s.nm, atributos: `data-f="nm" maxlength="${LIMITE_DO_NOME}"` },
    { id: 'kg', rotulo: 'Peso (kg)', tipo: 'numero', valor: s.kg || '', texto: s.kg ? `${numeroBr(s.kg)} kg` : 'sem peso', falta: !s.kg, atributos: 'data-f="kg" min="1" max="300" step="0.1" placeholder="sem peso"' },
    { id: 'curso', rotulo: 'Curso', tipo: 'selecao', valor: s.curso || '', texto: nomeDoCurso(s) || '—', opcoes: opcoesDoCurso(s), atributos: 'data-f="curso"' },
    ...(progresso ? [{ id: 'progresso', rotulo: 'Progresso', tipo: 'leitura', texto: `${progresso.contagem} · ${progresso.resto}`, dica: ['progresso', 'O que é o progresso?'] }] : []),
    {
      id: 'voaCom', rotulo: 'Priorizar com', tipo: 'etiquetas', classe: 'voa-com', dica: ['voa-com', 'O que é Priorizar com?'],
      ...instrutoresDoAluno(s, { ids: voaCom, campo: 'voaCom', classe: 'par', vazio: 'Priorizar com…', fora: [...voaCom, ...s.bl], rotuloDoX: x => `Tirar ${x.nm} de Priorizar com` })
    },
    {
      id: 'bl', rotulo: 'Não escalar com', tipo: 'etiquetas', classe: 'nao-escalar', dica: ['nao-escalar-com', 'O que é Não escalar com?'],
      ...instrutoresDoAluno(s, { ids: s.bl, campo: 'bl', classe: '', vazio: 'Não escalar com…', fora: s.bl, rotuloDoX: x => `Voltar a escalar com ${x.nm}` })
    }
  ];
  const dados = secaoDosDadosPessoais('alu', 'aluno', s.id);
  const secoes = [{ id: 'cadastro', titulo: 'Cadastro', icone: 'i-conta', escopo: 'todas as datas', campos }, ...(dados ? [dados] : [])];
  return {
    atributos: `data-k="s" data-id="${s.id}"`,
    id: s.id,
    titulo: s.nm,
    subtitulo: [canac ? `CANAC ${canac}` : '', nomeDoCurso(s) || 'sem curso'].filter(Boolean).join(' · '),
    aviso: inativo(s) ? 'Inativo no cadastro: não entra em pedido novo de hoje em diante (os voos que ele já tem continuam). As datas passadas ficam como estão. Para ativar de novo, ligue “Ativo” na linha dele.' : '',
    secoes,
    rodape: [{ id: 'excluir', texto: 'Excluir aluno…', rotulo: `Excluir ${s.nm}`, atributos: 'data-act="dels"', soEdicao: true }]
  };
}
