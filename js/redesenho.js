// Os desenhos da tela, num registro: cada tela registra o próprio no módulo de eventos dela (js/eventos/), com o nome do
// papel dele ('alunos', 'escala') e os momentos em que ele é refeito. Quem muda os dados chama redesenhar(momento), ou
// redesenharPorNome(nome) para refazer a tela de outro módulo, e não importa a tela: trocar o módulo de uma tela não muda
// quem a redesenha. Cada desenho roda por semFalhar (js/sem-falhar.js): um que falha vai para o console (e os testes E2E
// falham com ele), e os outros, a gravação e o histórico continuam.
// Os momentos: 'dados' (os dados de uma data chegaram: a abertura e carregarData), 'consulta' (a tela volta ao que está
// gravado: quem só consulta, e depois de um conflito), 'releitura' (lerDadosDeNovo), 'escala' (a escala foi refeita),
// 'perfil' (setRole), 'pedidos' (os pedidos da data foram lidos), 'data-aberta' (uma data aberta, antes dos dados dela) e
// 'sessao' (a abertura e a gravação da data).
// Este módulo não importa nenhuma tela
import { semFalhar } from './sem-falhar.js';

const MOMENTOS = ['dados', 'consulta', 'releitura', 'escala', 'perfil', 'pedidos', 'data-aberta', 'sessao'];
const desenhos = new Map();

// Um nome repetido ou um momento que não está na lista é erro (o teste dos desenhos registrados confere os dois)
// comMomento: o desenho recebe o momento em que é refeito (a lista e o detalhe refazem tudo no 'consulta'); os outros são
// chamados sem nada
export function registrarDesenho(nome, desenhar, { em = [], ordem = 50, comMomento = false } = {}) {
  if (desenhos.has(nome)) throw new Error(`O desenho "${nome}" já está registrado.`);
  if (typeof desenhar !== 'function') throw new Error(`O desenho "${nome}" não é uma função.`);
  for (const momento of em) {
    if (!MOMENTOS.includes(momento)) throw new Error(`O desenho "${nome}" pede um momento que não existe: "${momento}".`);
  }
  desenhos.set(nome, { nome, desenhar, em: [...em], ordem, comMomento });
}

// Os desenhos registrados, na ordem em que são refeitos (a ordem; no empate, a do registro)
export function desenhosRegistrados() {
  return [...desenhos.values()].sort((a, b) => a.ordem - b.ordem).map(({ nome, em, ordem }) => ({ nome, em: [...em], ordem }));
}

// Refaz os desenhos de um momento, por ordem
export function redesenhar(momento) {
  if (!MOMENTOS.includes(momento)) throw new Error(`O momento "${momento}" não existe.`);
  for (const { nome, em } of desenhosRegistrados()) {
    const { desenhar, comMomento } = desenhos.get(nome);
    if (em.includes(momento)) semFalhar(comMomento ? () => desenhar(momento) : desenhar);
  }
}

// Refaz os desenhos pelo nome, na ordem dada. Um nome sem registro é erro
export function redesenharPorNome(...nomes) {
  for (const nome of nomes) {
    if (!desenhos.has(nome)) throw new Error(`O desenho "${nome}" não está registrado.`);
  }
  for (const nome of nomes) semFalhar(desenhos.get(nome).desenhar);
}
