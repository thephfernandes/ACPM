// Categorias de recurso dos filtros da Escala, de Recursos e do BI, na ordem da operação: C152, C172, Simulador,
// PA-34 e a Sala Ground (com os seus horários de decolagem em Recursos desde o J). Os recursos de cada categoria vêm da
// frota do cadastro; a Sala Ground é o recurso SALA-GROUND, fora da frota.
import { GROUND_REG, GROUND_EQ_TYPE } from './config.js';
import { esc } from './format.js';

export const CATEGORIAS = [
  { id: 'C152', nome: 'C152', tipos: ['C152'] },
  { id: 'C172', nome: 'C172', tipos: ['C172'] },
  { id: 'sim', nome: 'Simulador', tipos: ['Sim. Mono', 'Sim. Multi'] },
  { id: 'PA-34', nome: 'PA-34', tipos: ['PA-34'] },
  { id: 'ground', nome: 'Sala Ground', tipos: [GROUND_EQ_TYPE] }
];

// O nome da categoria com a preposição certa: "do C152", "do Simulador", "da Sala Ground" (os horários de quem)
export const doNomeDaCategoria = id => {
  const c = CATEGORIAS.find(x => x.id === id);
  return c ? `${id === 'ground' ? 'da' : 'do'} ${c.nome}` : `do ${id}`;
};

export const nomeDoRecurso = r => (r === GROUND_REG ? 'Sala Ground' : r);

// A categoria de um tipo (C152, Sim. Mono, Sala Ground…): vale também para um recurso que já saiu da frota
export const categoriaDoTipo = tipo => (CATEGORIAS.find(c => c.tipos.includes(tipo)) || { id: null }).id;

// Opções do seletor da Escala e do BI: "Todos" e as categorias (Recursos marca as categorias em caixas:
// js/views/filtros-dos-recursos.js)
export const opcoesDeCategoria = () => '<option value="">Todos</option>' +
  CATEGORIAS.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
