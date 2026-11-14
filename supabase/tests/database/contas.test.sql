-- Fase 5: perfil Administrador e as contas que ele gerencia. Roda dentro de uma transação desfeita no final.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-e000-000000000001', 'admin@teste-contas.acpm.invalid', now(), now()),
  ('00000000-0000-4000-e000-000000000002', 'operador@teste-contas.acpm.invalid', now(), now()),
  ('00000000-0000-4000-e000-000000000003', 'gestor@teste-contas.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-e000-000000000001', 'administrador', 'Admin de teste'),
  ('00000000-0000-4000-e000-000000000002', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-e000-000000000003', 'gestor', 'Gestor de teste');
delete from public.solicitacoes;

set local role authenticated;

-- Administrador: tudo o que o operador faz
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-000000000001","role":"authenticated"}', true);
select is(public.perfil_atual(), 'operador'::perfil_acesso, 'nas regras da escala, o administrador conta como operador');
select is(public.administrador_atual(), true, 'e é reconhecido como administrador');
select lives_ok($$ select public.salvar_dia('2099-01-01', '{"esquema":99}', (select coalesce(max(versao), 0) from public.dias where data = '2099-01-01')) $$,
  'administrador grava a escala');
select isnt(public.registrar_historico('2099-01-01', 'mod', 'Alteração do administrador'), null, 'administrador registra no histórico');
select isnt(public.registrar_solicitacao(current_date, 1000, 'Aluno 1000', 'Voo Local', 'manha', null, 'Coordenação', null, true), null,
  'administrador usa a exceção da coordenação');
select is((select perfil from public.perfis where usuario = '00000000-0000-4000-e000-000000000001'), 'administrador'::perfil_acesso,
  'o perfil de verdade continua administrador');

-- Listar contas
select ok((select count(*) from public.listar_contas() where email like '%@teste-contas.acpm.invalid') = 3, 'administrador lista as contas');
select results_eq($$ select nome, perfil from public.listar_contas() where email = 'gestor@teste-contas.acpm.invalid' $$,
  $$ values ('Gestor de teste', 'gestor'::perfil_acesso) $$, 'com nome e perfil');

-- Criar conta
select isnt(public.criar_conta(' Nova@Teste-Contas.ACPM.invalid ', 'uma senha bem longa', 'secretaria', ' Nova Secretaria '), null,
  'administrador cria uma conta');
-- As tabelas de autenticação só o dono do banco lê: as conferências abaixo saem do papel de usuário logado
reset role;
select results_eq($$ select email::text, email_confirmed_at is not null, encrypted_password = extensions.crypt('uma senha bem longa', encrypted_password)
                     from auth.users where email = 'nova@teste-contas.acpm.invalid' $$,
  $$ values ('nova@teste-contas.acpm.invalid', true, true) $$, 'e-mail em minúsculas, já confirmado, e a senha em bcrypt');
select is((select count(*)::int from auth.identities i join auth.users u on u.id = i.user_id where u.email = 'nova@teste-contas.acpm.invalid' and i.provider = 'email'), 1,
  'com a identidade de e-mail (para o login)');
select results_eq($$ select p.perfil, p.nome from public.perfis p join auth.users u on u.id = p.usuario where u.email = 'nova@teste-contas.acpm.invalid' $$,
  $$ values ('secretaria'::perfil_acesso, 'Nova Secretaria') $$, 'e o perfil e o nome');
set local role authenticated;
select throws_ok($$ select public.criar_conta('nova@teste-contas.acpm.invalid', 'uma senha bem longa', 'gestor', 'De novo') $$, '23505', null,
  'e-mail já usado é recusado');
select throws_ok($$ select public.criar_conta('outra@teste-contas.acpm.invalid', 'curta', 'gestor', 'Outra') $$, '22023', null,
  'senha com menos de 12 caracteres é recusada');
select throws_ok($$ select public.criar_conta('sem-arroba', 'uma senha bem longa', 'gestor', 'Outra') $$, '22023', null, 'e-mail inválido é recusado');
select throws_ok($$ select public.criar_conta('outra@teste-contas.acpm.invalid', 'uma senha bem longa', 'gestor', '  ') $$, '22023', null,
  'nome é obrigatório');

-- Excluir conta
reset role;
select set_config('acpm.nova', (select id::text from auth.users where email = 'nova@teste-contas.acpm.invalid'), true);
set local role authenticated;
select lives_ok($$ select public.excluir_conta(current_setting('acpm.nova')::uuid) $$, 'administrador exclui uma conta');
reset role;
select is((select count(*)::int from auth.users where email = 'nova@teste-contas.acpm.invalid'), 0, 'a conta some');
select is((select count(*)::int from public.perfis where usuario = current_setting('acpm.nova')::uuid), 0, 'e o perfil vai junto');
set local role authenticated;
select throws_ok($$ select public.excluir_conta('00000000-0000-4000-e000-000000000001') $$, '22023', null, 'ninguém exclui a própria conta');
select throws_ok($$ select public.excluir_conta('00000000-0000-4000-e000-00000000ffff') $$, 'P0002', null, 'conta inexistente');

-- O operador registra uma alteração; o administrador exclui a conta dele: o registro fica, com o nome do autor
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-000000000002","role":"authenticated"}', true);
select isnt(public.registrar_historico('2099-01-01', 'mod', 'Alteração do operador'), null, 'operador registra no histórico');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select public.excluir_conta('00000000-0000-4000-e000-000000000002') $$, 'administrador exclui a conta do operador');
reset role;
select results_eq($$ select usuario, autor from public.historico where descricao = 'Alteração do operador' $$,
  $$ values (null::uuid, 'Operador de teste') $$, 'o histórico dele continua, com o nome do autor');
set local role authenticated;

-- Quem não é administrador não gerencia contas
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-000000000003","role":"authenticated"}', true);
select is(public.administrador_atual(), false, 'gestor não é administrador');
select throws_ok($$ select * from public.listar_contas() $$, '42501', null, 'gestor não lista contas');
select throws_ok($$ select public.criar_conta('x@teste-contas.acpm.invalid', 'uma senha bem longa', 'gestor', 'X') $$, '42501', null, 'gestor não cria contas');
select throws_ok($$ select public.excluir_conta('00000000-0000-4000-e000-000000000001') $$, '42501', null, 'gestor não exclui contas');

select * from finish();
rollback;
