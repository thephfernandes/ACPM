-- Retorno da operação (14/11): no máximo 6 voos locais (Voo Local, Voo Solo e TGL) no mesmo horário; o 7º pedido é
-- recusado (PT422). Outras missões e pedidos cancelados não contam. Pela função de 13 argumentos (a migração
-- missao_do_curso_e_limite_do_pedido), o 7º passa com a confirmação, que fica registrada; com vaga, ela não registra nada.
-- Roda dentro de uma transação desfeita no final.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

delete from public.solicitacoes;
insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-d200-000000000001', 'secretaria@teste-agenda-locais.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values ('00000000-0000-4000-d200-000000000001', 'secretaria', 'Secretaria de teste');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d200-000000000001","role":"authenticated"}', true);
select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 1000 + n, 'Aluno', (array['Voo Local', 'Voo Solo', 'TGL (TMA)'])[1 + n % 3], 'horario', '08:20', 1, 'Maria', null, false)
from generate_series(1, 6) n;
select is((select count(*)::int from public.solicitacoes), 6, 'seis voos locais às 08:20');
select throws_ok($$ select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 2000, 'Aluno', 'Voo Local', 'horario', '08:20', 1, 'Maria', null, false) $$,
  'PT422', null, 'o sétimo voo local no mesmo horário é recusado');
select lives_ok($$ select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 2001, 'Aluno', 'Navegação', 'horario', '08:20', 1, 'Maria', null, false) $$,
  'outra missão no mesmo horário passa');
select lives_ok($$ select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 2002, 'Aluno', 'Voo Local', 'horario', '10:10', 1, 'Maria', null, false) $$,
  'outro horário passa');
select public.cancelar_solicitacao((select min(id) from public.solicitacoes), 'Maria');
select lives_ok($$ select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 2003, 'Aluno', 'TGL (TMA)', 'horario', '08:20', 1, 'Maria', null, false) $$,
  'com um cancelado, abre a vaga');
-- A função de 13 argumentos: o 7º às 08:20 confirmado fica registrado, com quem confirmou; às 10:10 (um local), a
-- confirmação não registra nada
select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 2004, 'Aluno', 'Voo Local', 'horario', '08:20', 1, 'Maria', null, false, 'C152', null, true);
select results_eq($$ select limite_confirmado_por, limite_confirmado_em is not null from public.solicitacoes where aluno = 2004 $$,
  $$ values ('Secretaria de teste'::text, true) $$, 'pela função de 13 argumentos, o 7º voo local confirmado fica registrado com quem confirmou');
select public.registrar_solicitacao((current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end), 2005, 'Aluno', 'Voo Local', 'horario', '10:10', 1, 'Maria', null, false, 'C152', null, true);
select results_eq($$ select limite_confirmado_por, limite_confirmado_em from public.solicitacoes where aluno = 2005 $$,
  $$ values (null::text, null::timestamptz) $$, 'pela função de 13 argumentos, a confirmação com vaga não registra nada');

select * from finish();
rollback;
