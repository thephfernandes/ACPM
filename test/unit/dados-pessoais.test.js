// Dados pessoais de alunos e instrutores (fase 9): CPF, CANAC, nascimento, celular e e-mail. Ficam fora do cadastro,
// numa tabela que só operadores, administradores e a secretaria leem; o servidor valida de novo. O histórico registra
// só quais campos mudaram, nunca os valores.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPOS_PESSOAIS, cpfValido, validarDadosPessoais, formatarCpf, formatarCelular, camposAlterados, gravarDadosPessoais, semQuemSaiu, nomeNoCadastro } from '../../js/dados-pessoais.js';

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

// Revisão de 14/11: a mesma regra do servidor (salvar_dados_pessoais) para o modo local e o servidor dos testes
describe('Dados pessoais: gravar com a versão lida', () => {
  const cadastro = { stu: [{ id: 1000, nm: 'Ana Souza' }, { id: 1001, nm: 'Bia' }], ins: [{ id: 7, nm: 'Instrutor 07' }] };
  const opcoes = (extra = {}) => ({ hoje: '2026-11-14', autor: 'Rayane', agora: '2026-11-14T12:00:00.000Z', cadastro, ...extra });

  it('grava, diz quando e o que mudou (a descrição do histórico, sem os valores)', () => {
    const r = gravarDadosPessoais({}, 'aluno', 1000, { cpf: '529.982.247-25', canac: '123456' }, opcoes({ atualizadoEmLido: null }));
    assert.deepEqual(r.tabela, { 'aluno:1000': { cpf: '52998224725', canac: '123456', atualizado_em: '2026-11-14T12:00:00.000Z', atualizado_por: 'Rayane' } });
    assert.equal(r.atualizado_em, '2026-11-14T12:00:00.000Z');
    assert.equal(r.descricao, 'Dados pessoais de Ana Souza atualizados: CPF, CANAC');
    const igual = gravarDadosPessoais(r.tabela, 'aluno', 1000, { cpf: '52998224725', canac: '123456' }, opcoes({ atualizadoEmLido: r.atualizado_em, agora: '2026-11-14T13:00:00.000Z' }));
    assert.equal(igual.descricao, null, 'sem mudança, nada para o histórico');
  });

  it('outra pessoa gravou antes (a versão lida não é a guardada): recusa com o código do servidor', () => {
    const { tabela } = gravarDadosPessoais({}, 'aluno', 1000, { canac: '123456' }, opcoes({ atualizadoEmLido: null }));
    assert.throws(() => gravarDadosPessoais(tabela, 'aluno', 1000, { canac: '654321' }, opcoes({ atualizadoEmLido: null })), e => e.code === 'PT409');
    assert.throws(() => gravarDadosPessoais(tabela, 'aluno', 1000, { canac: '654321' }, opcoes({ atualizadoEmLido: '2000-01-01T00:00:00.000Z' })), e => e.code === 'PT409');
  });

  it('só quem está no cadastro', () => {
    assert.equal(nomeNoCadastro(cadastro, 'instrutor', 7), 'Instrutor 07');
    assert.equal(nomeNoCadastro(cadastro, 'aluno', 7), null);
    assert.throws(() => gravarDadosPessoais({}, 'aluno', 1003, { canac: '123456' }, opcoes({ atualizadoEmLido: null })), e => e.code === 'P0002');
  });

  it('quem sai do cadastro leva os dados pessoais junto', () => {
    const tabela = { 'aluno:1000': { canac: '1' }, 'aluno:1002': { canac: '2' }, 'instrutor:7': { canac: '3' }, 'instrutor:8': { canac: '4' } };
    assert.deepEqual(Object.keys(semQuemSaiu(tabela, cadastro)), ['aluno:1000', 'instrutor:7']);
    assert.equal(semQuemSaiu(tabela, { stu: [] }), tabela, 'sem as duas listas no cadastro, nada sai');
  });
});
