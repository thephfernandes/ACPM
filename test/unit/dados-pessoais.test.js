// Dados pessoais de alunos e instrutores (fase 9): CPF, CANAC, nascimento, celular e e-mail. Ficam fora do cadastro,
// numa tabela que só operadores, administradores e a secretaria leem; o servidor valida de novo. O histórico registra
// só quais campos mudaram, nunca os valores.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPOS_PESSOAIS, cpfValido, validarDadosPessoais, formatarCpf, formatarCelular, camposAlterados } from '../../js/dados-pessoais.js';

describe('Dados pessoais: validação', () => {
  it('os campos: CPF, CANAC, nascimento, celular e e-mail', () => {
    assert.deepEqual(CAMPOS_PESSOAIS.map(c => [c.id, c.rotulo]), [
      ['cpf', 'CPF'], ['canac', 'CANAC'], ['nascimento', 'Nascimento'], ['celular', 'Celular'], ['email', 'E-mail']
    ]);
  });

  it('CPF: 11 dígitos com os verificadores certos (com ou sem pontos e traço); todos iguais não vale', () => {
    assert.equal(cpfValido('529.982.247-25'), true);
    assert.equal(cpfValido('11144477735'), true);
    assert.equal(cpfValido('529.982.247-24'), false);
    assert.equal(cpfValido('111.111.111-11'), false);
    assert.equal(cpfValido('1234567890'), false);
    assert.equal(cpfValido(''), false);
  });

  it('valida e normaliza: só dígitos no CPF, CANAC e celular; e-mail em minúsculas; vazio fica de fora', () => {
    const { dados, erros } = validarDadosPessoais({
      cpf: '529.982.247-25', canac: ' 123456 ', nascimento: '2001-05-20', celular: '(37) 99123-4567', email: ' Ana@Exemplo.com '
    }, '2026-11-13');
    assert.deepEqual(erros, {});
    assert.deepEqual(dados, { cpf: '52998224725', canac: '123456', nascimento: '2001-05-20', celular: '37991234567', email: 'ana@exemplo.com' });
    assert.deepEqual(validarDadosPessoais({ cpf: '', canac: ' ', email: '' }, '2026-11-13'), { dados: {}, erros: {} });
  });

  it('cada campo inválido tem a sua mensagem', () => {
    const { erros } = validarDadosPessoais({ cpf: '529.982.247-24', canac: '12345', nascimento: '2030-01-01', celular: '3733334444', email: 'ana@' }, '2026-11-13');
    assert.deepEqual(erros, {
      cpf: 'CPF inválido.',
      canac: 'O CANAC tem 6 dígitos.',
      nascimento: 'Data de nascimento inválida.',
      celular: 'Celular com DDD e 9 dígitos, como (37) 99123-4567.',
      email: 'E-mail inválido.'
    });
    assert.equal(validarDadosPessoais({ nascimento: '1899-12-31' }, '2026-11-13').erros.nascimento, 'Data de nascimento inválida.');
    assert.equal(validarDadosPessoais({ nascimento: '2026-02-30' }, '2026-11-13').erros.nascimento, 'Data de nascimento inválida.');
    assert.equal(validarDadosPessoais({ celular: '03991234567' }, '2026-11-13').erros.celular !== undefined, true, 'DDD não começa com 0');
  });
});

describe('Dados pessoais: na tela e no histórico', () => {
  it('CPF com pontos e traço, celular com DDD entre parênteses', () => {
    assert.equal(formatarCpf('52998224725'), '529.982.247-25');
    assert.equal(formatarCelular('37991234567'), '(37) 99123-4567');
    assert.equal(formatarCpf(''), '');
    assert.equal(formatarCelular(undefined), '');
  });

  it('o histórico registra só os nomes dos campos que mudaram, nunca os valores', () => {
    assert.deepEqual(camposAlterados({ cpf: '52998224725', email: 'a@b.com' }, { cpf: '52998224725', celular: '37991234567' }), ['Celular', 'E-mail']);
    assert.deepEqual(camposAlterados({}, {}), []);
    assert.deepEqual(camposAlterados(null, { canac: '123456' }), ['CANAC']);
  });
});
