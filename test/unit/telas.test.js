// As telas do app (js/telas.js): quem vê cada uma, a tela da abertura e o endereço (#/<tela>[/<item>])
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TELAS, ESTAGIOS, podeVer, telaDeAbertura, dataDeAbertura, destinoDoEndereco, enderecoDoDestino, linhaAbertaPorPadrao,
  classeDaLargura, trilhoFixo, lerPreferencias
} from '../../js/telas.js';

const PERFIS = ['operador', 'administrador', 'gestor', 'secretaria'];

describe('Quem vê cada tela', () => {
  it('as quatro etapas, na ordem, cada uma com a sua tela', () => {
    assert.deepEqual(ESTAGIOS, ['pedidos', 'processamento', 'escala', 'aprovar']);
    assert.deepEqual(ESTAGIOS.map(e => Object.keys(TELAS).find(t => TELAS[t].estagio === e)), ['age', 'dem', 'esc', 'apr']);
  });

  it('o rótulo de cada tela é o nome dela hoje', () => {
    assert.deepEqual(Object.fromEntries(Object.entries(TELAS).map(([id, t]) => [id, t.rotulo])), {
      age: 'Agenda', dem: 'Demanda', esc: 'Escala', apr: 'Aprovar', alu: 'Alunos', ins: 'Instrutores', rec: 'Recursos',
      cur: 'Cursos', rod: 'Rodízio', bi: 'BI', manual: 'Manual', conta: 'Minha conta'
    });
  });

  it('Operador, Administrador e Gestor veem todas as telas', () => {
    for (const perfil of ['operador', 'administrador', 'gestor']) {
      for (const tela of Object.keys(TELAS)) assert.equal(podeVer(tela, perfil), true, `${perfil} ${tela}`);
    }
  });

  it('a Secretaria: Agenda, Escala, Aprovar, Alunos, Instrutores, Cursos, o Manual e a conta', () => {
    const dela = Object.keys(TELAS).filter(t => podeVer(t, 'secretaria'));
    assert.deepEqual(dela, ['age', 'esc', 'apr', 'alu', 'ins', 'cur', 'manual', 'conta']);
  });

  it('no modo local (sem perfil), todas as telas menos a conta', () => {
    assert.deepEqual(Object.keys(TELAS).filter(t => podeVer(t, null)), Object.keys(TELAS).filter(t => t !== 'conta'));
  });

  it('uma tela que não existe ninguém vê', () => {
    for (const perfil of [...PERFIS, null]) assert.equal(podeVer('xyz', perfil), false);
  });

  it('a tela da abertura: a Agenda para a Secretaria, a Escala para os outros', () => {
    assert.equal(telaDeAbertura('secretaria'), 'age');
    for (const perfil of ['operador', 'administrador', 'gestor', null]) assert.equal(telaDeAbertura(perfil), 'esc');
  });
});

describe('O endereço', () => {
  it('lê a tela e o item', () => {
    assert.deepEqual(destinoDoEndereco('#/alu'), { tela: 'alu', item: null });
    assert.deepEqual(destinoDoEndereco('#/alu/1012'), { tela: 'alu', item: '1012' });
    assert.deepEqual(destinoDoEndereco('#/rec/PR-VOB'), { tela: 'rec', item: 'PR-VOB' });
    assert.deepEqual(destinoDoEndereco('#/esc/fora-1012_0_1'), { tela: 'esc', item: 'fora-1012_0_1' });
    assert.deepEqual(destinoDoEndereco('#/apr'), { tela: 'apr', item: null });
    assert.deepEqual(destinoDoEndereco('#/manual/manual-aba-rodizio'), { tela: 'manual', item: 'manual-aba-rodizio' });
  });

  it('recusa o que não é uma tela: a volta do login, o vazio, uma tela desconhecida, um item com espaço, acento ou longo', () => {
    for (const hash of ['#access_token=abc&type=recovery', '#/', '#/xyz', '#/alu/Maria Silva', '#/alu/João', `#/alu/${'1'.repeat(41)}`, '', '#conteudo', null, undefined, '#/alu/1/2']) {
      assert.equal(destinoDoEndereco(hash), null, String(hash));
    }
  });

  it('enderecoDoDestino é o inverso', () => {
    for (const hash of ['#/alu', '#/alu/1012', '#/rec/PR-VOB', '#/apr', '#/conta/usuarios']) assert.equal(enderecoDoDestino(destinoDoEndereco(hash)), hash);
    assert.equal(enderecoDoDestino({ tela: 'esc' }), '#/esc');
  });
});

describe('A linha aberta por padrão', () => {
  it('só quando cabe numa fileira e a janela é alta', () => {
    assert.equal(linhaAbertaPorPadrao(1540, 760), true);
    assert.equal(linhaAbertaPorPadrao(1539, 1080), false);
    assert.equal(linhaAbertaPorPadrao(1888, 759), false);
  });
});

describe('A data da abertura', () => {
  const base = { amanha: '2026-11-11', primeiraAberta: '2026-11-12' };
  it('a data do link vale para todos os perfis', () => {
    for (const perfil of ['operador', 'administrador', 'gestor', 'secretaria', null]) assert.deepEqual(dataDeAbertura({ ...base, pedida: '2026-11-20', perfil }), { data: '2026-11-20', aviso: null });
  });
  it('um domingo no link abre a segunda, com o aviso', () => {
    assert.deepEqual(dataDeAbertura({ ...base, pedida: '2026-11-15', perfil: 'operador' }), { data: '2026-11-16', aviso: 'domingo' });
  });
  it('uma data que não existe abre amanhã, com o aviso', () => {
    assert.deepEqual(dataDeAbertura({ ...base, pedida: '2026-02-30', perfil: 'operador' }), { data: '2026-11-11', aviso: 'invalida' });
  });
  it('sem data no link: a Secretaria na primeira data que aceita pedidos; os outros amanhã', () => {
    assert.deepEqual(dataDeAbertura({ ...base, pedida: null, perfil: 'secretaria' }), { data: '2026-11-12', aviso: null });
    assert.deepEqual(dataDeAbertura({ ...base, pedida: null, perfil: 'gestor' }), { data: '2026-11-11', aviso: null });
  });
});

describe('O trilho ao lado', () => {
  it('a classe da largura da janela', () => {
    assert.equal(classeDaLargura(1023), 'estreita');
    assert.equal(classeDaLargura(1024), 'media');
    assert.equal(classeDaLargura(1279), 'media');
    assert.equal(classeDaLargura(1280), 'larga');
  });
  it('por padrão na larga; o guardado vale por classe; nunca na estreita', () => {
    assert.equal(trilhoFixo('larga', {}), true);
    assert.equal(trilhoFixo('media', {}), false);
    assert.equal(trilhoFixo('estreita', { estreita: 'fixo' }), false);
    assert.equal(trilhoFixo('larga', { larga: 'solto' }), false);
    assert.equal(trilhoFixo('media', { media: 'fixo' }), true);
  });
  it('lerPreferencias: o JSON guardado, ou nada', () => {
    assert.deepEqual(lerPreferencias('{"media":"fixo","larga":"solto"}'), { media: 'fixo', larga: 'solto' });
    for (const texto of [null, '', 'xyz', '[1,2]', '"fixo"', '{"media":"meio"}']) assert.deepEqual(lerPreferencias(texto), {}, String(texto));
  });
});

describe('O trilho em index.html', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

  it('a região do trilho, entre a linha e a tela, com o botão da data que a abre', () => {
    assert.match(html, /<aside class="trilho" id="trilho" aria-label="Data e avisos" data-regiao="trilho" hidden>/);
    assert.ok(html.indexOf('id="linha"') < html.indexOf('id="trilho"') && html.indexOf('id="trilho"') < html.indexOf('<main id="conteudo"'));
    assert.match(html, /id="btn-data" aria-controls="trilho"/);
  });

  it('o ícone do trilho (i-trilho) está no sprite e no botão "Fixar ao lado"', () => {
    assert.match(html, /<symbol id="i-trilho"/);
    assert.match(html, /id="btn-fixar-trilho"[^>]*>.*?#i-trilho/);
  });
});
