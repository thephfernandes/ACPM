// A linha do dia (js/linha-do-dia.js): os quatro cartões (Agenda, Demanda, Escala, Aprovar), cada um com o valor dele, o
// estado (o pior das tarefas) e as tarefas, o selo de Recursos e os avisos da data. Dados fictícios, sem o motor
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { linhaDoDia, selosDosCadastros, avisosDaData } from '../../js/linha-do-dia.js';

const DATA = '2026-11-11', HOJE = '2026-11-10';

function contexto({ pedidos = [], leitura = 'lidos', out = [], al = [], tot = 0, res = true, frota, av = {}, ins, importadas = [], aprovacao = null, revisao = {}, perfil = null, opera = true, horasLidas = true, stu = [], indisponiveis = [] } = {}) {
  return {
    S: {
      frota: frota ?? [{ reg: 'PR-AAA', tipo: 'C152' }, { reg: 'PR-BBB', tipo: 'C152' }],
      av, ins: ins ?? [{ id: 1, nm: 'Instrutor 01', on: true }, { id: 2, nm: 'Instrutor 02', on: true }],
      stu, importadas, aprovacao
    },
    RES: res ? { out, al, tot, revisao } : null,
    pedidos: leitura === 'lidos' ? pedidos : null,
    leituraDosPedidos: leitura,
    perfil, opera, horasLidas, indisponiveis, data: DATA, hoje: HOJE
  };
}
const pedido = (id, extra = {}) => ({ id, data: DATA, aluno: 1000 + id, cancelada_em: null, ...extra });
const cartao = (ctx, id) => linhaDoDia(ctx).find(c => c.id === id);
const tarefa = (ctx, cartaoId, tarefaId) => cartao(ctx, cartaoId).tarefas.find(t => t.id === tarefaId);
const voo = n => Array.from({ length: n }, (_, i) => ({ fKey: `${1000 + i}_0_1` }));

describe('A linha do dia', () => {
  it('quatro cartões, na ordem das etapas, cada um com a tela dele', () => {
    assert.deepEqual(linhaDoDia(contexto()).map(c => [c.id, c.tela]), [['pedidos', 'age'], ['processamento', 'dem'], ['escala', 'esc'], ['aprovar', 'apr']]);
  });

  it('Agenda: os pedidos não cancelados da data; os ainda não importados pedem atenção', () => {
    const ctx = contexto({ pedidos: [pedido(1), pedido(2), pedido(3, { cancelada_em: '2026-11-10T10:00:00Z' })], importadas: [1] });
    const c = cartao(ctx, 'pedidos');
    assert.equal(c.valor, '2');
    assert.equal(c.estado, 'atencao');
    assert.deepEqual(c.tarefas.map(t => [t.id, t.rotulo, t.valor, t.estado]), [
      ['registrados', 'pedidos da data', '2', 'feito'], ['nao-importados', 'ainda não importados', '1', 'atencao']
    ]);
    assert.deepEqual(c.tarefas[0].destino, { tela: 'age' });
  });

  it('Agenda: todos importados, feito; sem pedidos, pendente; a leitura que falhou, falhou', () => {
    assert.equal(cartao(contexto({ pedidos: [pedido(1)], importadas: [1] }), 'pedidos').estado, 'feito');
    const vazio = cartao(contexto(), 'pedidos');
    assert.deepEqual(vazio.tarefas.map(t => t.estado), ['pendente', 'nenhum']);
    assert.equal(vazio.estado, 'pendente');
    const erro = cartao(contexto({ leitura: 'erro' }), 'pedidos');
    assert.deepEqual(erro.tarefas.map(t => t.estado), ['falhou', 'falhou']);
    assert.equal(erro.estado, 'falhou');
    assert.equal(erro.valor, '—');
  });

  it('o pedido de um aluno inativo não conta como ainda não importado', () => {
    const ctx = contexto({ pedidos: [pedido(1)], stu: [{ id: 1001, nm: 'Aluno Fictício', inativo: true }] });
    assert.equal(tarefa(ctx, 'pedidos', 'nao-importados').valor, '0');
  });

  it('quem não opera a escala (Gestor, Secretaria) não vê "ainda não importados"', () => {
    const ctx = contexto({ pedidos: [pedido(1)], opera: false });
    assert.deepEqual(cartao(ctx, 'pedidos').tarefas.map(t => t.id), ['registrados']);
    assert.equal(cartao(ctx, 'pedidos').estado, 'feito');
  });

  it('Demanda: as missões pedidas; os recursos e os instrutores que vêm', () => {
    const ctx = contexto({ tot: 7, out: voo(7), av: { 'PR-BBB': false }, ins: [{ id: 1, on: true }, { id: 2, on: false }, { id: 3, on: true }] });
    const c = cartao(ctx, 'processamento');
    assert.equal(c.valor, '7');
    assert.deepEqual(c.tarefas.map(t => [t.id, t.valor, t.estado, t.destino.tela]), [['recursos', '1 de 2', 'feito', 'rec'], ['invas', '2 de 3', 'feito', 'ins']]);
    assert.equal(c.estado, 'feito');
  });

  it('Demanda: nenhum recurso disponível falha; um avião parado ou perto da revisão pede atenção; a frota vazia fica pendente', () => {
    assert.equal(tarefa(contexto({ av: { 'PR-AAA': false, 'PR-BBB': false } }), 'processamento', 'recursos').estado, 'falhou');
    assert.equal(tarefa(contexto({ revisao: { 'PR-AAA': { paraAs: null, fim: 47 } } }), 'processamento', 'recursos').estado, 'atencao');
    assert.equal(tarefa(contexto({ revisao: { 'PR-AAA': { paraAs: 600, fim: 50 } } }), 'processamento', 'recursos').estado, 'atencao');
    assert.equal(tarefa(contexto({ revisao: { 'PR-AAA': { paraAs: null, fim: 30 } } }), 'processamento', 'recursos').estado, 'feito');
    assert.equal(tarefa(contexto({ frota: [] }), 'processamento', 'recursos').estado, 'pendente');
  });

  it('Demanda: ninguém vem falha com missões pedidas e não conta sem elas; sem as horas dos instrutores, atenção', () => {
    const ninguem = [{ id: 1, on: false }];
    assert.equal(tarefa(contexto({ tot: 2, ins: ninguem }), 'processamento', 'invas').estado, 'falhou');
    assert.equal(tarefa(contexto({ tot: 0, ins: ninguem }), 'processamento', 'invas').estado, 'nenhum');
    assert.equal(tarefa(contexto({ horasLidas: false }), 'processamento', 'invas').estado, 'atencao');
    assert.equal(tarefa(contexto({ ins: [] }), 'processamento', 'invas').estado, 'pendente');
  });

  it('Demanda: o instrutor e o recurso inativos não contam, de hoje em diante', () => {
    const ctx = contexto({ frota: [{ reg: 'PR-AAA', tipo: 'C152' }, { reg: 'PR-BBB', tipo: 'C152', inativo: true }], ins: [{ id: 1, on: true }, { id: 2, on: true, inativo: true }] });
    assert.equal(tarefa(ctx, 'processamento', 'recursos').valor, '1 de 1');
    assert.equal(tarefa(ctx, 'processamento', 'invas').valor, '1 de 1');
  });

  it('Escala: na escala de quantas pedidas; o que não entrou falha; conflitos falham; avisos pedem atenção', () => {
    const al = [{ t: 'err' }, { t: 'conf' }, { t: 'warn' }, { t: 'warn' }];
    const c = cartao(contexto({ tot: 21, out: voo(20), al }), 'escala');
    assert.equal(c.valor, '20 de 21');
    assert.deepEqual(c.tarefas.map(t => [t.id, t.valor, t.estado]), [['montada', '20 de 21', 'falhou'], ['conflitos', '3', 'falhou']]);
    assert.equal(c.estado, 'falhou');
    const avisos = cartao(contexto({ tot: 3, out: voo(3), al: [{ t: 'warn' }] }), 'escala');
    assert.deepEqual(avisos.tarefas.map(t => t.estado), ['feito', 'atencao']);
    assert.equal(avisos.estado, 'atencao');
  });

  it('Escala: tudo certo, feito; sem missões pedidas, pendente', () => {
    assert.equal(cartao(contexto({ tot: 2, out: voo(2) }), 'escala').estado, 'feito');
    const vazia = cartao(contexto({ tot: 0 }), 'escala');
    assert.deepEqual(vazia.tarefas.map(t => t.estado), ['pendente', 'pendente']);
    assert.equal(vazia.valor, '0 de 0');
  });

  it('Aprovar: a hora e quem aprovou; não aprovada, pendente; sem as horas, atenção; sem voo, nenhum', () => {
    const em = new Date(2026, 10, 10, 18, 5).toISOString();
    const aprovada = cartao(contexto({ tot: 1, out: voo(1), aprovacao: { em, por: 'Operador 01' } }), 'aprovar');
    assert.equal(aprovada.valor, '18:05');
    assert.deepEqual(aprovada.tarefas.map(t => [t.id, t.rotulo, t.estado]), [['aprovada', 'aprovada às 18:05 por Operador 01', 'feito']]);
    const pendente = cartao(contexto({ tot: 1, out: voo(1) }), 'aprovar');
    assert.deepEqual([pendente.valor, pendente.estado, pendente.tarefas[0].rotulo], ['—', 'pendente', 'não aprovada']);
    assert.equal(cartao(contexto({ tot: 1, out: voo(1), horasLidas: false }), 'aprovar').estado, 'atencao');
    const semVoo = cartao(contexto({ tot: 0 }), 'aprovar');
    assert.deepEqual([semVoo.estado, semVoo.tarefas[0].rotulo], ['nenhum', 'nenhum voo']);
  });

  it('o estado do cartão é o pior das tarefas; "nenhum" não conta', () => {
    const ctx = contexto({ pedidos: [pedido(1)], importadas: [] });
    assert.equal(cartao(ctx, 'pedidos').estado, 'atencao');
    assert.equal(cartao(contexto({ tot: 0, ins: [{ id: 1, on: false }] }), 'processamento').estado, 'feito');
  });

  it('cada valor tem o mesmo sentido em todos os estados: a dica diz qual', () => {
    for (const ctx of [contexto(), contexto({ tot: 5, out: voo(4), al: [{ t: 'err' }], pedidos: [pedido(1)] }), contexto({ leitura: 'erro' })]) {
      const [pedidos, demanda, escala] = linhaDoDia(ctx);
      assert.match(pedidos.dica, /^(\d+ pedidos? nesta data|Os pedidos desta data não foram lidos)/);
      assert.match(demanda.dica, /^\d+ miss(ão pedida|ões pedidas)$/);
      assert.match(escala.dica, /^\d+ de \d+ miss(ão|ões) na escala$/);
    }
  });

  it('sem a escala (a data ainda abrindo), nada falha', () => {
    const cartoes = linhaDoDia(contexto({ res: false, leitura: 'lendo' }));
    assert.equal(cartoes.length, 4);
    assert.ok(cartoes.every(c => c.estado !== 'falhou'));
  });
});

describe('O selo de Recursos', () => {
  it('os aviões parados ou perto da revisão de 50 horas, também na Secretaria e no Gestor', () => {
    const ctx = contexto({ revisao: { 'PR-AAA': { paraAs: 600, fim: 50 }, 'PR-BBB': { paraAs: null, fim: 46 } } });
    assert.deepEqual(selosDosCadastros(ctx), { rec: { valor: '2', estado: 'atencao', dica: '2 aviões parados ou perto da revisão de 50 horas' } });
  });

  it('nenhum: sem selo; o avião indisponível ou inativo não conta', () => {
    assert.deepEqual(selosDosCadastros(contexto()), {});
    assert.deepEqual(selosDosCadastros(contexto({ av: { 'PR-AAA': false }, revisao: { 'PR-AAA': { paraAs: 600, fim: 50 } } })), {});
    const inativo = contexto({ frota: [{ reg: 'PR-AAA', tipo: 'C152', inativo: true }], revisao: { 'PR-AAA': { paraAs: 600, fim: 50 } } });
    assert.deepEqual(selosDosCadastros(inativo), {});
    assert.equal(selosDosCadastros(contexto({ revisao: { 'PR-AAA': { paraAs: null, fim: 46 } } })).rec.dica, '1 avião parado ou perto da revisão de 50 horas');
  });
});

describe('Os avisos da data', () => {
  const ids = ctx => avisosDaData(ctx).map(a => a.id);

  it('nada a resolver: nenhum aviso', () => {
    assert.deepEqual(avisosDaData(contexto()), []);
    assert.deepEqual(avisosDaData(contexto({ res: false, leitura: 'lendo' })), []);
  });

  it('um por alerta da escala, com o horário do voo dele quando ele está na escala', () => {
    const out = [{ fKey: '1000_0_1', a: 500, b: 560 }];
    const al = [
      { t: 'conf', s: 'Aluno 01', m: 'Conflito na escala aprovada: avião em manutenção.', fKey: '1000_0_1' },
      { t: 'err', s: 'Aluno 02', m: 'Rejeitado: sem avião.', codigo: 'sem-recurso' },
      { t: 'warn', s: 'Aluno 03', m: 'Fora da escala.', fKey: '1003_0_1' }
    ];
    assert.deepEqual(avisosDaData(contexto({ out, al, tot: 3 })), [
      { id: 'err:sem-recurso', gravidade: 'erro', minuto: null, titulo: 'Aluno 02', texto: 'Rejeitado: sem avião.', destino: { tela: 'esc' } },
      { id: 'conf:1000_0_1', gravidade: 'erro', minuto: 500, duracaoMin: 60, titulo: 'Aluno 01', texto: 'Conflito na escala aprovada: avião em manutenção.', destino: { tela: 'esc' } },
      { id: 'warn:1003_0_1', gravidade: 'aviso', minuto: null, titulo: 'Aluno 03', texto: 'Fora da escala.', destino: { tela: 'esc' } }
    ]);
  });

  it('a ordem: erro antes de aviso; em cada um, os sem horário primeiro, depois pelo horário e pelo id', () => {
    const out = [{ fKey: '1_0_1', a: 900, b: 960 }, { fKey: '2_0_1', a: 390, b: 450 }, { fKey: '3_0_1', a: 390, b: 450 }];
    const al = [
      { t: 'warn', s: 'f', m: '', fKey: '2_0_1' }, { t: 'conf', s: 'c', m: '', fKey: '1_0_1' }, { t: 'conf', s: 'b', m: '', fKey: '3_0_1' },
      { t: 'conf', s: 'a', m: '', fKey: '2_0_1' }, { t: 'err', s: 'e', m: '', stuId: 1009, codigo: 'x' }
    ];
    assert.deepEqual(ids(contexto({ out, al })), ['err:x-1009', 'conf:2_0_1', 'conf:3_0_1', 'conf:1_0_1', 'warn:2_0_1']);
  });

  it('dois alertas do mesmo voo têm ids diferentes', () => {
    const al = [{ t: 'warn', s: 'Aluno 01', m: 'A', fKey: '1_0_1' }, { t: 'warn', s: 'Aluno 01', m: 'B', fKey: '1_0_1' }];
    assert.deepEqual(ids(contexto({ al })), ['warn:1_0_1', 'warn:1_0_1:2']);
  });

  it('os aviões parados ou perto da revisão: em Recursos; a Secretaria, que não a vê, sem destino', () => {
    const revisao = { 'PR-AAA': { fim: 47, paraAs: null }, 'PR-BBB': { fim: 50, paraAs: 600 } };
    const [aviso] = avisosDaData(contexto({ revisao }));
    assert.deepEqual(aviso, { id: 'recursos', gravidade: 'aviso', minuto: null, titulo: '2 aviões parados ou perto da revisão de 50 horas', texto: '', destino: { tela: 'rec' } });
    assert.deepEqual(avisosDaData(contexto({ revisao, perfil: 'secretaria', opera: false })).map(a => a.destino), [null]);
    assert.deepEqual(avisosDaData(contexto({ revisao, perfil: 'gestor', opera: false })).map(a => a.destino), [{ tela: 'rec' }]);
  });

  it('os pedidos que ainda não estão na demanda: só para quem opera, e só lidos', () => {
    const pedidos = [pedido(1), pedido(2), pedido(3, { cancelada_em: 'x' })];
    assert.deepEqual(avisosDaData(contexto({ pedidos })).map(a => [a.id, a.titulo, a.gravidade, a.destino]), [['nao-importados', '2 pedidos da agenda ainda não estão na demanda', 'aviso', { tela: 'age' }]]);
    assert.equal(avisosDaData(contexto({ pedidos, importadas: [1] }))[0].titulo, '1 pedido da agenda ainda não está na demanda');
    assert.deepEqual(avisosDaData(contexto({ pedidos, importadas: [1, 2] })), []);
    assert.deepEqual(avisosDaData(contexto({ pedidos, opera: false })), []);
    assert.deepEqual(avisosDaData(contexto({ pedidos, leitura: 'lendo' })), []);
  });

  it('os pedidos que não foram lidos, para todos os perfis', () => {
    for (const opera of [true, false]) {
      assert.deepEqual(avisosDaData(contexto({ leitura: 'erro', opera })).map(a => [a.id, a.titulo, a.gravidade, a.destino]),
        [['pedidos-nao-lidos', 'Não foi possível ler os pedidos desta data.', 'aviso', { tela: 'age' }]]);
    }
  });

  it('o que a data não leu: as horas são erro, o resto é aviso, sem destino (a faixa do alto tem "Tentar de novo")', () => {
    const indisponiveis = [{ id: 'resultados', texto: 'Sem os resultados.' }, { id: 'horas', texto: 'Sem as horas.' }, { id: 'cursos', texto: 'Sem os programas.' }];
    assert.deepEqual(avisosDaData(contexto({ indisponiveis })).map(a => [a.id, a.gravidade, a.titulo, a.destino]), [
      ['dados:horas', 'erro', 'Sem as horas.', null], ['dados:cursos', 'aviso', 'Sem os programas.', null], ['dados:resultados', 'aviso', 'Sem os resultados.', null]
    ]);
  });
});
