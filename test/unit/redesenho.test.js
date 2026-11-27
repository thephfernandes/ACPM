// O registro dos desenhos da tela (js/redesenho.js): cada tela registra o próprio, e quem muda os dados redesenha por
// momento ou pelo nome. Cada teste usa um registro novo (o módulo importado de novo, com outro endereço)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

let contador = 0;
const registroNovo = () => import(`../../js/redesenho.js?teste=${++contador}`);

// Um desenho que falha vai para o console.error: o teste guarda o que foi escrito, sem sujar a saída
function comConsoleCalado(fazer) {
  const original = console.error, escritos = [];
  console.error = (...partes) => escritos.push(partes);
  try {
    fazer();
  } finally {
    console.error = original;
  }
  return escritos;
}

describe('registrarDesenho', () => {
  it('um nome repetido é erro', async () => {
    const { registrarDesenho } = await registroNovo();
    registrarDesenho('alunos', () => {}, { em: ['dados'] });
    assert.throws(() => registrarDesenho('alunos', () => {}), /já está registrado/);
  });

  it('um momento que não está na lista é erro (também o "solicitacoes" que ninguém criou)', async () => {
    const { registrarDesenho } = await registroNovo();
    assert.throws(() => registrarDesenho('pedidos', () => {}, { em: ['solicitacoes'] }), /momento que não existe/);
    assert.throws(() => registrarDesenho('outro', () => {}, { em: ['dados', 'trilho'] }), /momento que não existe/);
  });

  it('o desenho é uma função', async () => {
    const { registrarDesenho } = await registroNovo();
    assert.throws(() => registrarDesenho('alunos', null), /não é uma função/);
  });

  it('os registrados saem por ordem; no empate, na ordem do registro', async () => {
    const { registrarDesenho, desenhosRegistrados } = await registroNovo();
    registrarDesenho('b', () => {}, { em: ['escala'], ordem: 20 });
    registrarDesenho('a', () => {}, { em: ['dados'], ordem: 10 });
    registrarDesenho('c', () => {}, { ordem: 20 });
    assert.deepEqual(desenhosRegistrados(), [
      { nome: 'a', em: ['dados'], ordem: 10 },
      { nome: 'b', em: ['escala'], ordem: 20 },
      { nome: 'c', em: [], ordem: 20 }
    ]);
  });
});

describe('redesenhar', () => {
  it('refaz só os desenhos do momento, por ordem', async () => {
    const { registrarDesenho, redesenhar } = await registroNovo();
    const feitos = [];
    registrarDesenho('escala', () => feitos.push('escala'), { em: ['dados', 'escala'], ordem: 80 });
    registrarDesenho('recursos', () => feitos.push('recursos'), { em: ['dados', 'consulta'], ordem: 10 });
    registrarDesenho('bi', () => feitos.push('bi'), { em: ['escala'], ordem: 90 });
    registrarDesenho('habilitacoes', () => feitos.push('habilitacoes'));
    redesenhar('dados');
    assert.deepEqual(feitos, ['recursos', 'escala']);
    feitos.length = 0;
    redesenhar('escala');
    assert.deepEqual(feitos, ['escala', 'bi']);
  });

  // A lista e o detalhe (F2) refazem tudo no 'consulta': o desenho com comMomento recebe o momento; os outros, nada
  it('o desenho com comMomento recebe o momento; os outros são chamados sem nada', async () => {
    const { registrarDesenho, redesenhar, redesenharPorNome } = await registroNovo();
    const recebidos = [];
    registrarDesenho('alunos', (...args) => recebidos.push(['alunos', ...args]), { em: ['dados', 'consulta'], comMomento: true });
    registrarDesenho('escala', (...args) => recebidos.push(['escala', ...args]), { em: ['consulta'] });
    redesenhar('consulta');
    redesenhar('dados');
    redesenharPorNome('alunos');
    assert.deepEqual(recebidos, [['alunos', 'consulta'], ['escala'], ['alunos', 'dados'], ['alunos']]);
  });

  it('um momento que não existe é erro', async () => {
    const { redesenhar } = await registroNovo();
    assert.throws(() => redesenhar('solicitacoes'), /não existe/);
  });

  it('um desenho que falha vai para o console, e os seguintes são feitos', async () => {
    const { registrarDesenho, redesenhar } = await registroNovo();
    const feitos = [];
    registrarDesenho('quebra', () => { throw new Error('faltou #out'); }, { em: ['escala'], ordem: 1 });
    registrarDesenho('depois', () => feitos.push('depois'), { em: ['escala'], ordem: 2 });
    const escritos = comConsoleCalado(() => redesenhar('escala'));
    assert.deepEqual(feitos, ['depois']);
    assert.equal(escritos.length, 1);
    assert.match(String(escritos[0][0].message), /faltou #out/);
  });
});

describe('redesenharPorNome', () => {
  it('refaz os desenhos pedidos, na ordem dada (a do nome, não a do registro)', async () => {
    const { registrarDesenho, redesenharPorNome } = await registroNovo();
    const feitos = [];
    registrarDesenho('alunos', () => feitos.push('alunos'), { ordem: 30 });
    registrarDesenho('instrutores', () => feitos.push('instrutores'), { ordem: 20 });
    registrarDesenho('pedidos-do-dia', () => feitos.push('pedidos-do-dia'), { ordem: 60 });
    redesenharPorNome('pedidos-do-dia', 'alunos');
    assert.deepEqual(feitos, ['pedidos-do-dia', 'alunos']);
  });

  it('um nome sem registro é erro, e nada é refeito', async () => {
    const { registrarDesenho, redesenharPorNome } = await registroNovo();
    const feitos = [];
    registrarDesenho('alunos', () => feitos.push('alunos'));
    assert.throws(() => redesenharPorNome('alunos', 'demanda'), /não está registrado/);
    assert.deepEqual(feitos, []);
  });

  it('um desenho que falha vai para o console, e os seguintes são feitos', async () => {
    const { registrarDesenho, redesenharPorNome } = await registroNovo();
    const feitos = [];
    registrarDesenho('quebra', () => { throw new Error('x'); });
    registrarDesenho('depois', () => feitos.push('depois'));
    const escritos = comConsoleCalado(() => redesenharPorNome('quebra', 'depois'));
    assert.deepEqual(feitos, ['depois']);
    assert.equal(escritos.length, 1);
  });
});
