-- O pedido da agenda guarda o recurso (o tipo: C152, PA-34, Sim. Mono…): a coluna, a função com o recurso (11 argumentos),
-- com as mesmas regras da de 10, e a de 10, que continua para as abas abertas do app de antes. Roda dentro de uma
-- transação desfeita no final.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

delete from public.solicitacoes;
insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-d300-000000000001', 'secretaria@teste-agenda-recurso.acpm.invalid', now(), now()),
  ('00000000-0000-4000-d300-000000000002', 'operador@teste-agenda-recurso.acpm.invalid', now(), now()),
  ('00000000-0000-4000-d300-000000000003', 'gestor@teste-agenda-recurso.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-d300-000000000001', 'secretaria', 'Secretaria de teste'),
  ('00000000-0000-4000-d300-000000000002', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-d300-000000000003', 'gestor', 'Gestor de teste');

select has_column('public', 'solicitacoes', 'recurso', 'a agenda guarda o recurso');
select col_is_null('public', 'solicitacoes', 'recurso', 'o recurso pode faltar (os pedidos de antes)');
select has_function('public', 'registrar_solicitacao', array['date', 'integer', 'text', 'text', 'text', 'text', 'numeric', 'text', 'text', 'boolean', 'text'],
  'a função nova, com o recurso');
select has_function('public', 'registrar_solicitacao', array['date', 'integer', 'text', 'text', 'text', 'text', 'numeric', 'text', 'text', 'boolean'],
  'a função sem o recurso continua para as abas abertas');
select ok(not has_function_privilege('anon', 'public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text)', 'execute'),
  'o anônimo não chama a função nova');
select ok(has_function_privilege('authenticated', 'public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text)', 'execute'),
  'quem está conectado chama a função nova');
select ok((select prosecdef from pg_proc where oid = 'public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text)'::regprocedure),
  'a função nova é security definer');
select is((select proconfig from pg_proc where oid = 'public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text)'::regprocedure),
  array['search_path=""'], 'com o search_path vazio');
select ok(has_column_privilege('authenticated', 'public.solicitacoes', 'recurso', 'select'), 'quem lê a agenda lê o recurso');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d300-000000000001","role":"authenticated"}', true);
select isnt(public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1000, 'Aluno 1000', 'Navegação', 'horario', '07:30', 2.6, 'Maria', null, false, ' PA-34 '), null,
  'a secretaria registra o pedido com o recurso');
select results_eq($$ select recurso, horario, horas, excecao, conta from public.solicitacoes where aluno = 1000 $$,
  $$ values ('PA-34'::text, '07:30'::text, 2.6::numeric, false, 'Secretaria de teste'::text) $$, 'guarda o recurso, sem os espaços das pontas, com o resto do pedido');
select isnt(public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1001, 'Aluno 1001', 'Ground C152', 'horario', '06:30', 3, 'Maria', null, false, 'Sala Ground'), null,
  'registra um Ground');
select results_eq($$ select recurso, horas from public.solicitacoes where aluno = 1001 $$, $$ values ('Sala Ground'::text, 1.5::numeric) $$, 'o Ground tem sempre 01h30');
select lives_ok($$ select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1002, 'Aluno', 'Simulador', 'horario', '08:20', 2, 'Maria', null, false, 'Sim. Mono') $$,
  'o simulador, com o ponto e o espaço do nome');
select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1003, 'Aluno', 'Navegação', 'horario', '08:20', 1, 'Maria', null, false, '  ');
select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1003, 'Aluno', 'Navegação', 'horario', '10:10', 1, 'Maria', null, false, null);
select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1003, 'Aluno', 'Navegação', 'horario', '11:30', 1, 'Maria', null, false);
select is((select count(*)::int from public.solicitacoes where aluno = 1003 and recurso is null), 3, 'vazio, nulo e pela função de antes: sem recurso');
select throws_ok($$ select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1000, 'Aluno', 'Navegação', 'horario', '10:10', 1, 'Maria', null, false, '<b>') $$,
  '23514', null, 'o recurso só tem letras, números, espaço, ponto e hífen');
select throws_ok($$ select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1000, 'Aluno', 'Navegação', 'horario', '10:10', 1, 'Maria', null, false, repeat('C', 31)) $$,
  '23514', null, 'o recurso tem até 30 letras');
select throws_ok($$ select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1000, 'Aluno', 'Navegação', 'manha', null, 1, 'Maria', null, false, 'C152') $$,
  '22023', null, 'o horário continua obrigatório');
select throws_ok($$ select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1000, 'Aluno', 'Navegação', 'horario', '10:10', 5.5, 'Maria', null, false, 'C152') $$,
  '22023', null, 'a duração continua até 5 h');
select throws_ok($$ select public.registrar_solicitacao(current_date, 1000, 'Aluno', 'Navegação', 'horario', '10:10', 1, 'Maria', null, false, 'C152') $$,
  'PT403', null, 'o prazo continua valendo');
select throws_ok($$ select public.registrar_solicitacao(current_date, 1000, 'Aluno', 'Navegação', 'horario', '10:10', 1, 'Maria', null, true, 'C152') $$,
  '42501', null, 'a exceção continua só dos operadores');
-- O limite de 6 voos locais conta os pedidos das duas funções e de todos os recursos
select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 2000 + n, 'Aluno', 'Voo Local', 'horario', '08:20', 1, 'Maria', null, false)
from generate_series(1, 3) n;
select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 2010 + n, 'Aluno', 'Voo Local', 'horario', '08:20', 1, 'Maria', null, false, 'C172')
from generate_series(1, 3) n;
select throws_ok($$ select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 2020, 'Aluno', 'TGL (TMA)', 'horario', '08:20', 1, 'Maria', null, false, 'PA-34') $$,
  'PT422', null, 'o sétimo voo local no mesmo horário é recusado, em qualquer recurso');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d300-000000000002","role":"authenticated"}', true);
select lives_ok($$ select public.registrar_solicitacao(current_date, 3000, 'Aluno', 'Navegação', 'horario', '07:30', 1, 'Coordenação', null, true, 'PA-34') $$,
  'o operador registra pela exceção da coordenação');
select results_eq($$ select recurso, excecao from public.solicitacoes where aluno = 3000 $$, $$ values ('PA-34'::text, true) $$, 'marcado como exceção, com o recurso');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d300-000000000003","role":"authenticated"}', true);
select is((select recurso from public.solicitacoes where aluno = 1000), 'PA-34', 'o gestor lê o recurso');
select throws_ok($$ select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1000, 'Aluno', 'Navegação', 'horario', '10:10', 1, 'Maria', null, false, 'C152') $$,
  '42501', null, 'o gestor não registra');

select * from finish();
rollback;
