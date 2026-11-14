// Perfis de acesso no modo compartilhado e o que cada um pode fazer.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PERFIS, ROTULOS, operaEscala, registraNaAgenda, gerenciaContas, veDadosPessoais, soPainel } from '../../js/perfis.js';

describe('Perfis de acesso', () => {
  it('cinco perfis, com os nomes da tela', () => {
    assert.deepEqual(PERFIS, ['operador', 'gestor', 'secretaria', 'administrador', 'painel']);
    assert.deepEqual(PERFIS.map(p => ROTULOS[p]), ['Operador', 'Gestor', 'Secretaria', 'Administrador', 'Painel (TV da recepção)']);
  });

  it('dados pessoais: operadores, administradores e a secretaria; a TV da recepção só vê o painel', () => {
    assert.deepEqual(PERFIS.map(veDadosPessoais), [true, false, true, true, false]);
    assert.deepEqual(PERFIS.map(soPainel), [false, false, false, false, true]);
  });

  it('o administrador tem tudo o que o operador tem e, além disso, gerencia as contas', () => {
    const pode = p => [operaEscala(p), registraNaAgenda(p), gerenciaContas(p)];
    assert.deepEqual(pode('administrador'), [true, true, true]);
    assert.deepEqual(pode('operador'), [true, true, false]);
    assert.deepEqual(pode('secretaria'), [false, true, false]);
    assert.deepEqual(pode('gestor'), [false, false, false]);
    assert.deepEqual(pode('painel'), [false, false, false]);
    assert.deepEqual(pode(null), [false, false, false]);
    assert.deepEqual(pode('constructor'), [false, false, false]);
  });
});
