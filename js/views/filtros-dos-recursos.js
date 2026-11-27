// Os filtros da aba Recursos, nas duas vistas: a matrícula buscada e as categorias marcadas (aparece o recurso de uma
// delas: uma ou outra; nenhuma marcada, todas). Eles valem para a tabela dos aviões e simuladores, para a frota e para os
// horários de decolagem, que são por categoria (os das categorias marcadas e, com a busca, os das categorias dos recursos
// achados). Nunca para a ordem no hangar: Subir e Descer trocariam o avião com os escondidos (js/hangar.js, moverNoHangar
// anda na lista inteira). Os filtros ficam aqui, e não só nos campos, e valem de novo a cada redesenho
// (js/views/recursos.js, js/views/horarios.js). O recurso acrescentado agora e a categoria dos horários editados agora
// continuam à vista mesmo fora dos filtros, até eles mudarem: é ali que está quem acabou de mexer (e o foco do teclado)
import { CATEGORIAS, categoriaDoTipo } from '../categorias.js';
import { GROUND_REG, GROUND_EQ_TYPE } from '../config.js';
import { chaveDeBusca } from '../format.js';
import { S } from '../state.js';
import { criarFiltroMultiplo } from './filtro-multiplo.js';

const filtros = { matricula: '', categorias: [] };
const mantidos = { recursos: new Set(), horarios: new Set() };

// A chave da matrícula: a da busca (sem acentos, em minúsculas), sem os hífens e os espaços: “vob”, “PR VOB” e “prvob”
// acham o PR-VOB
const chaveDaMatricula = texto => chaveDeBusca(texto).replace(/[\s-]/g, '');
const buscada = () => chaveDaMatricula(filtros.matricula);
const matriculaPassa = reg => chaveDaMatricula(reg).includes(buscada());
const categoriaPassa = id => !filtros.categorias.length || filtros.categorias.includes(id);

export const filtrandoRecursos = () => Boolean(buscada()) || filtros.categorias.length > 0;

// O recurso aparece na tabela e na frota: passa nos filtros, ou acabou de ser acrescentado
export const recursoAVista = f => mantidos.recursos.has(f.reg) || (categoriaPassa(categoriaDoTipo(f.tipo)) && matriculaPassa(f.reg));

// A Sala Ground: fora da frota, mas um recurso da aba (a linha dela na tabela desta data, os horários dela, a contagem)
export const SALA_GROUND = Object.freeze({ reg: GROUND_REG, tipo: GROUND_EQ_TYPE });

// Os horários de decolagem de uma categoria aparecem: a categoria passa e, com a busca, algum recurso dela foi achado (a
// Sala Ground também); ou eles acabaram de ser editados
export const horariosAVista = cat => mantidos.horarios.has(cat)
  || (categoriaPassa(cat) && (!buscada() || [...(S.frota || []), SALA_GROUND].some(f => categoriaDoTipo(f.tipo) === cat && matriculaPassa(f.reg))));

// Um filtro mudou ({ matricula } ou { categorias }): vale para todos, também o que acabou de ser acrescentado ou editado
export function filtrarRecursos(mudanca) {
  Object.assign(filtros, mudanca);
  mantidos.recursos.clear();
  mantidos.horarios.clear();
}

// "Limpar filtros": a busca vazia e nenhuma categoria marcada
export const limparFiltrosDosRecursos = () => filtrarRecursos({ matricula: '', categorias: [] });

export const manterRecursoAVista = reg => { mantidos.recursos.add(reg); };
export const manterHorariosAVista = cat => { mantidos.horarios.add(cat); };

// "Categoria ▾", o filtro de vários valores (js/views/filtro-multiplo.js) com a regra "alguma": um recurso é de uma
// categoria só, e aparece o de alguma das marcadas. As opções são todas as categorias, a Sala Ground entre elas (os
// horários de decolagem dela estão em Recursos desde o J). O componente desenha as caixas (com flt-ctrl, sem data-act, data-f ou data-a: o Gestor também filtra, e
// marcar não é uma alteração dos dados) e guarda as marcas; aoMudar recebe as categorias marcadas, e limpar() as desmarca
// sem avisar ("Limpar filtros")
export function criarFiltroDasCategorias(aoMudar) {
  const filtro = criarFiltroMultiplo({
    id: 'flt-rec-cat', nome: 'Categoria', todas: 'Todas as categorias', regra: 'alguma',
    frase: 'Mostra os recursos de alguma das categorias marcadas.', dica: ['filtro-das-categorias', 'Filtro das categorias'],
    grupos: () => [{ titulo: 'Categorias', opcoes: CATEGORIAS.map(c => [c.id, c.nome]) }],
    aoMudar: () => aoMudar(filtro.valores())
  });
  return filtro;
}
