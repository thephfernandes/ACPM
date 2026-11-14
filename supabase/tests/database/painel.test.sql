-- Fase 9: a TV da recepção. O perfil "painel" não lê nenhuma tabela (nem os documentos, os dias, o histórico, a agenda
-- ou os dados pessoais) e não grava nada: ele vê só o quadro de hoje (horário de São Paulo) pela função painel_do_dia,
-- com o aluno abreviado ("Maria S.") e, do detalhe do status, só a categoria do motivo e o novo horário.
-- Roda dentro de uma transação desfeita no final: não deixa dados no banco.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-a000-000000000031', 'painel@painel.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000032', 'operador@painel.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000033', 'sem-perfil@painel.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000034', 'admin@painel.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-a000-000000000031', 'painel', 'TV da recepção'),
  ('00000000-0000-4000-a000-000000000032', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-a000-000000000034', 'administrador', 'Admin de teste');

-- A escala de hoje: um voo atrasado, um cancelado por "Outro" (com texto) e uma turma de Ground
delete from public.dias where data = (now() at time zone 'America/Sao_Paulo')::date;
insert into public.dias (data, conteudo) values ((now() at time zone 'America/Sao_Paulo')::date, jsonb_build_object(
  'esquema', 13,
  'fStatus', jsonb_build_object('1000_0_1', 'Atrasado', '1001_0_1', 'Cancelado'),
  'fObs', jsonb_build_object('1000_0_1', jsonb_build_object('novoInicio', 640), '1001_0_1', jsonb_build_object('motivo', 'Outro', 'texto', 'Aluno com febre')),
  'resultado', jsonb_build_object('out', jsonb_build_array(
    jsonb_build_object('fKey', '1000_0_1', 'classKey', '1000_0_1', 'isGround', false, 'a', 610, 'b', 670, 'r', 'PR-VOB', 'eqType', 'C152',
      's', 'Maria Silva Santos', 'ins', 'Instrutor 01', 'insId', 1, 'stuId', 1000, 'kg', 140, 'mis', 'Voo Local', 'status', 'Confirmado'),
    jsonb_build_object('fKey', '1001_0_1', 'classKey', '1001_0_1', 'isGround', false, 'a', 390, 'b', 450, 'r', 'PP-ABP', 'eqType', 'C172',
      's', 'João', 'ins', 'Instrutor 02', 'insId', 2, 'stuId', 1001, 'kg', 150, 'mis', 'IFR', 'status', 'Confirmado'),
    jsonb_build_object('fKey', '1002_0_1', 'classKey', 'GND_Ground C152_1_3', 'isGround', true, 'a', 500, 'b', 590, 'r', 'SALA-GROUND',
      'eqType', 'Sala Ground', 's', 'Ana Paula Costa', 'ins', 'Instrutor 03', 'mis', 'Ground C152', 'status', 'Confirmado')
  ))
));

-- Estrutura
select ok('painel' = any(enum_range(null::public.perfil_acesso)::text[]), 'perfil painel existe');
select has_function('public', 'painel_do_dia', 'função painel_do_dia existe');
select is(public.nome_curto('Maria Silva Santos'), 'Maria S.', 'nome abreviado: o primeiro nome e a inicial do último');
select is(public.nome_curto('João'), 'João', 'um nome só fica inteiro');
select is(public.nome_curto('  Ana   Paula  '), 'Ana P.', 'espaços a mais não contam');
select is(public.nome_curto('Aluno 12'), 'Aluno 12', 'um número no fim fica inteiro');

set local role authenticated;

-- Painel: não lê nenhuma tabela
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000031","role":"authenticated"}', true);
select ok(not exists (select 1 from public.documentos), 'painel não lê os documentos');
select ok(not exists (select 1 from public.dias), 'painel não lê os dias');
select ok(not exists (select 1 from public.historico), 'painel não lê o histórico');
select ok(not exists (select 1 from public.solicitacoes), 'painel não lê a agenda');
select ok(not exists (select 1 from public.dados_pessoais), 'painel não lê os dados pessoais');
select throws_ok($$ select public.salvar_dia(current_date, '{}', 0) $$, '42501', null, 'painel não grava a escala');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1000, '{"canac":"123456"}') $$, '42501', null, 'painel não grava dados pessoais');

-- Painel: o quadro de hoje
select is(public.painel_do_dia()->>'data', ((now() at time zone 'America/Sao_Paulo')::date)::text, 'o quadro é o de hoje (São Paulo)');
select is(jsonb_array_length(public.painel_do_dia()->'voos'), 3, 'todos os voos do dia');
select is((select array_agg(v->>'s' order by (v->>'a')::integer) from jsonb_array_elements(public.painel_do_dia()->'voos') v),
  array['João', 'Ana C.', 'Maria S.'], 'em ordem de decolagem, com o aluno abreviado');
select is((select v->>'kg' from jsonb_array_elements(public.painel_do_dia()->'voos') v limit 1), null, 'sem o peso (nem o que o quadro não mostra)');
select is(public.painel_do_dia()->'fStatus', '{"1000_0_1": "Atrasado", "1001_0_1": "Cancelado"}'::jsonb, 'com o status de cada voo');
select is(public.painel_do_dia()->'fObs', '{"1000_0_1": {"novoInicio": 640}, "1001_0_1": {"motivo": "Outro"}}'::jsonb,
  'do detalhe do status, o novo horário e a categoria do motivo (sem o texto livre)');

-- Operador também vê o quadro; conta sem perfil, não
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000032","role":"authenticated"}', true);
select is(jsonb_array_length(public.painel_do_dia()->'voos'), 3, 'operador também vê o quadro');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000033","role":"authenticated"}', true);
select throws_ok($$ select public.painel_do_dia() $$, '42501', null, 'conta sem perfil não vê o quadro');

-- O administrador cria a conta da TV
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000034","role":"authenticated"}', true);
select lives_ok($$ select public.criar_conta('tv@painel.acpm.invalid', 'uma senha bem comprida', 'painel', 'TV da recepção') $$, 'administrador cria uma conta de painel');

-- Visitante anônimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.painel_do_dia() $$, '42501', null, 'anônimo não vê o quadro');

select * from finish();
rollback;
