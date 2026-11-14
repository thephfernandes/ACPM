// Perfis de acesso no modo compartilhado e o que cada um pode fazer. O Administrador tem tudo o que o Operador tem e,
// além disso, cria e exclui contas. (O servidor confere tudo de novo: estas regras só decidem o que a tela mostra.)
export const ROTULOS = { operador: 'Operador', gestor: 'Gestor', secretaria: 'Secretaria', administrador: 'Administrador', painel: 'Painel (TV da recepção)' };
export const PERFIS = Object.keys(ROTULOS);

export const operaEscala = perfil => perfil === 'operador' || perfil === 'administrador';
export const registraNaAgenda = perfil => operaEscala(perfil) || perfil === 'secretaria';
export const gerenciaContas = perfil => perfil === 'administrador';
// A TV da recepção só vê o painel de partidas e chegadas (painel.html)
export const soPainel = perfil => perfil === 'painel';
// Dados pessoais de alunos e instrutores (CPF, CANAC, nascimento, celular e e-mail): operadores, administradores e a secretaria
export const veDadosPessoais = perfil => operaEscala(perfil) || perfil === 'secretaria';
