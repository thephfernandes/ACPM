-- Fase 14: os resultados das missões dos cursos. A tabela só cresce: o operador registra pela função (aprovado,
-- reprovado ou pendente, que desfaz um engano), e ninguém grava direto, altera nem apaga. Quem lê a escala lê; a TV e o
-- anônimo, não. A situação de cada missão é o último registro. Os alunos de teste ficam acima de 99000 (a transação é
-- desfeita no final).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-a000-000000000051', 'operador@resultados.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000052', 'gestor@resultados.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000053', 'painel@resultados.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-a000-000000000051', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-a000-000000000052', 'gestor', 'Gestor de teste'),
  ('00000000-0000-4000-a000-000000000053', 'painel', 'TV de teste');

-- A situação só dos alunos de teste, sem a hora do registro
create function pg_temp.situacao()
  returns jsonb language sql as $$
  select coalesce(jsonb_agg(e - 'registrado_em' order by e->>'aluno', e->>'curso', e->>'missao'), '[]'::jsonb)
  from jsonb_array_elements(public.situacao_das_missoes()) e where (e->>'aluno')::integer > 99000
$$;

select has_table('public', 'resultados_de_missao', 'tabela resultados_de_missao existe');
select has_function('public', 'registrar_resultado', array['integer', 'text', 'text', 'text', 'date', 'text'], 'função registrar_resultado existe');
select has_function('public', 'situacao_das_missoes', 'função situacao_das_missoes existe');

-- O operador registra; o último registro vale
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000051","role":"authenticated"}', true);
select ok(public.registrar_resultado(99001, 'PP', 'PP-07', 'reprovado', '2099-11-10', '99001_0_1') > 0, 'o operador registra um resultado');
select ok(public.registrar_resultado(99001, 'PP', ' pp-07 ', 'aprovado', '2099-11-12', '99001_0_1') > 0, 'o código vira maiúsculo, sem espaços');
select ok(public.registrar_resultado(99001, 'PP', 'PP-08', 'aprovado', '2099-11-12', null) > 0, 'sem o voo também vale');
select ok(public.registrar_resultado(99002, 'PC', 'PC-01', 'aprovado', '2099-11-12', '99002_0_1') > 0, 'outro aluno, outro curso');
select ok(public.registrar_resultado(99002, 'PC', 'PC-01', 'pendente', '2099-11-12', '99002_0_1') > 0, 'pendente desfaz um engano');
select is(pg_temp.situacao(), '[
  {"aluno": 99001, "curso": "PP", "missao": "PP-07", "resultado": "aprovado", "data": "2099-11-12", "voo": "99001_0_1", "registrado_por": "Operador de teste"},
  {"aluno": 99001, "curso": "PP", "missao": "PP-08", "resultado": "aprovado", "data": "2099-11-12", "voo": null, "registrado_por": "Operador de teste"},
  {"aluno": 99002, "curso": "PC", "missao": "PC-01", "resultado": "pendente", "data": "2099-11-12", "voo": "99002_0_1", "registrado_por": "Operador de teste"}
]'::jsonb, 'a situação de cada missão é o último registro, com quem registrou');
select is((select count(*)::integer from public.resultados_de_missao where aluno > 99000), 5, 'os registros anteriores continuam (só acréscimo)');

-- Valores fora do formato
select throws_ok($$ select public.registrar_resultado(99001, 'XX', 'PP-07', 'aprovado', '2099-11-10', null) $$, '23514', null, 'curso inválido');
select throws_ok($$ select public.registrar_resultado(99001, 'PP', 'PP 07', 'aprovado', '2099-11-10', null) $$, '23514', null, 'código inválido');
select throws_ok($$ select public.registrar_resultado(99001, 'PP', 'PP-07', 'talvez', '2099-11-10', null) $$, '23514', null, 'resultado inválido');
select throws_ok($$ select public.registrar_resultado(99001, 'PP', 'PP-07', 'aprovado', '2099-11-10', 'voo') $$, '23514', null, 'voo inválido');
select throws_ok($$ select public.registrar_resultado(0, 'PP', 'PP-07', 'aprovado', '2099-11-10', null) $$, '23514', null, 'aluno inválido');

-- Ninguém grava direto, altera nem apaga
select throws_ok($$ insert into public.resultados_de_missao (aluno, curso, missao, resultado, data) values (99003, 'PP', 'PP-01', 'aprovado', '2099-11-10') $$,
  '42501', null, 'ninguém grava direto na tabela');
select throws_ok($$ update public.resultados_de_missao set resultado = 'aprovado' where aluno > 99000 $$, '42501', null, 'ninguém altera');
select throws_ok($$ delete from public.resultados_de_missao where aluno > 99000 $$, '42501', null, 'ninguém apaga');

-- O gestor lê, não registra
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000052","role":"authenticated"}', true);
select is(jsonb_array_length(pg_temp.situacao()), 3, 'o gestor lê a situação');
select is((select count(*)::integer from public.resultados_de_missao where aluno > 99000 and data = '2099-11-12'), 4, 'e os registros do dia');
select throws_ok($$ select public.registrar_resultado(99001, 'PP', 'PP-09', 'aprovado', '2099-11-12', null) $$, '42501', null, 'o gestor não registra');

-- A TV não lê nem registra
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000053","role":"authenticated"}', true);
select is(pg_temp.situacao(), '[]'::jsonb, 'a TV não lê a situação');
select is((select count(*)::integer from public.resultados_de_missao where aluno > 99000), 0, 'nem os registros');
select throws_ok($$ select public.registrar_resultado(99001, 'PP', 'PP-09', 'aprovado', '2099-11-12', null) $$, '42501', null, 'nem registra');

-- O anônimo não chega na tabela
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select count(*) from public.resultados_de_missao $$, '42501', null, 'anônimo não lê');

select * from finish();
rollback;
