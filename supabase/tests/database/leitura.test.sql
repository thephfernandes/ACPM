-- Fase 9: só os perfis da escala (operador, administrador, gestor e secretaria) leem os documentos, os dias, o
-- histórico e a agenda; conta sem perfil e visitante anônimo, não. (O perfil "painel", da TV da recepção, está em
-- painel.test.sql.) Roda dentro de uma transação desfeita no final: não deixa dados no banco.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(29);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-a000-000000000011', 'operador@leitura.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000012', 'administrador@leitura.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000013', 'gestor@leitura.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000014', 'secretaria@leitura.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000015', 'sem-perfil@leitura.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-a000-000000000011', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-a000-000000000012', 'administrador', 'Administrador de teste'),
  ('00000000-0000-4000-a000-000000000013', 'gestor', 'Gestor de teste'),
  ('00000000-0000-4000-a000-000000000014', 'secretaria', 'Secretaria de teste');

-- Um registro em cada tabela
insert into public.documentos (chave, conteudo) values ('bi', '{}') on conflict (chave) do nothing;
insert into public.dias (data, conteudo) values ('2099-01-01', '{}');
insert into public.historico (data, tipo, descricao) values ('2099-01-01', 'mod', 'teste de leitura');
insert into public.solicitacoes (data, aluno, aluno_nome, missao, janela, registrado_por)
  values ('2099-01-01', 1000, 'Aluno de teste', 'Voo Local', 'manha', 'Teste');

-- Estrutura: a leitura é pela lista dos perfis da escala (antes: qualquer conta com perfil)
select has_function('public', 'le_a_escala', 'função le_a_escala existe');
select policies_are('public', 'documentos', array['perfis da escala leem'], 'documentos: lidos pelos perfis da escala');
select policies_are('public', 'dias', array['perfis da escala leem'], 'dias: lidos pelos perfis da escala');
select policies_are('public', 'historico', array['perfis da escala leem'], 'histórico: lido pelos perfis da escala');
select policies_are('public', 'solicitacoes', array['perfis da escala leem'], 'agenda: lida pelos perfis da escala');

set local role authenticated;

-- Operador
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000011","role":"authenticated"}', true);
select ok(exists (select 1 from public.documentos), 'operador lê os documentos');
select ok(exists (select 1 from public.dias where data = '2099-01-01'), 'operador lê os dias');
select ok(exists (select 1 from public.historico where data = '2099-01-01'), 'operador lê o histórico');
select ok(exists (select 1 from public.solicitacoes where data = '2099-01-01'), 'operador lê a agenda');

-- Administrador
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000012","role":"authenticated"}', true);
select ok(exists (select 1 from public.documentos), 'administrador lê os documentos');
select ok(exists (select 1 from public.dias where data = '2099-01-01'), 'administrador lê os dias');
select ok(exists (select 1 from public.historico where data = '2099-01-01'), 'administrador lê o histórico');
select ok(exists (select 1 from public.solicitacoes where data = '2099-01-01'), 'administrador lê a agenda');

-- Gestor
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000013","role":"authenticated"}', true);
select ok(exists (select 1 from public.documentos), 'gestor lê os documentos');
select ok(exists (select 1 from public.dias where data = '2099-01-01'), 'gestor lê os dias');
select ok(exists (select 1 from public.historico where data = '2099-01-01'), 'gestor lê o histórico');
select ok(exists (select 1 from public.solicitacoes where data = '2099-01-01'), 'gestor lê a agenda');

-- Secretaria
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000014","role":"authenticated"}', true);
select ok(exists (select 1 from public.documentos), 'secretaria lê os documentos');
select ok(exists (select 1 from public.dias where data = '2099-01-01'), 'secretaria lê os dias');
select ok(exists (select 1 from public.historico where data = '2099-01-01'), 'secretaria lê o histórico');
select ok(exists (select 1 from public.solicitacoes where data = '2099-01-01'), 'secretaria lê a agenda');

-- Conta sem perfil
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000015","role":"authenticated"}', true);
select ok(not exists (select 1 from public.documentos), 'conta sem perfil não lê os documentos');
select ok(not exists (select 1 from public.dias), 'conta sem perfil não lê os dias');
select ok(not exists (select 1 from public.historico), 'conta sem perfil não lê o histórico');
select ok(not exists (select 1 from public.solicitacoes), 'conta sem perfil não lê a agenda');

-- Visitante anônimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select 1 from public.documentos $$, '42501', null, 'anônimo não acessa os documentos');
select throws_ok($$ select 1 from public.dias $$, '42501', null, 'anônimo não acessa os dias');
select throws_ok($$ select 1 from public.historico $$, '42501', null, 'anônimo não acessa o histórico');
select throws_ok($$ select 1 from public.solicitacoes $$, '42501', null, 'anônimo não acessa a agenda');

select * from finish();
rollback;
