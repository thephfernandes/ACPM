-- Fase 11: as horas de voo de cada instrutor antes de uma data (no mês, no semestre e no ano dela) e o fim do último
-- compromisso na véspera, a partir das escalas gravadas: só voo em avião, sem os cancelados. Quem lê a escala vê; a TV
-- e o anônimo, não. Os dias de teste ficam em 2099 (a transação é desfeita no final).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-a000-000000000041', 'operador@limites.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000042', 'gestor@limites.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000043', 'painel@limites.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-a000-000000000041', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-a000-000000000042', 'gestor', 'Gestor de teste'),
  ('00000000-0000-4000-a000-000000000043', 'painel', 'TV de teste');

create function pg_temp.voo(p_ins integer, p_a integer, p_h numeric default 1, p_tipo text default 'C152', p_chave text default null)
  returns jsonb language sql as $$
  select jsonb_build_object('fKey', coalesce(p_chave, p_ins || '_' || p_a || '_1'), 'insId', p_ins, 'eqType', p_tipo, 'a', p_a, 'b', p_a + (p_h * 60)::integer, 'h', p_h)
$$;
insert into public.dias (data, conteudo) values
  ('2098-12-30', jsonb_build_object('resultado', jsonb_build_object('out', jsonb_build_array(pg_temp.voo(1, 390))))),
  ('2099-05-10', jsonb_build_object('resultado', jsonb_build_object('out', jsonb_build_array(pg_temp.voo(1, 390))))),
  ('2099-07-01', jsonb_build_object('resultado', jsonb_build_object('out', jsonb_build_array(pg_temp.voo(1, 390), pg_temp.voo(2, 390))))),
  ('2099-11-02', jsonb_build_object('resultado', jsonb_build_object('out', jsonb_build_array(pg_temp.voo(1, 390, 2))))),
  ('2099-11-09', jsonb_build_object(
    'fStatus', jsonb_build_object('cancelado', 'Cancelado'),
    'resultado', jsonb_build_object('out', jsonb_build_array(
      pg_temp.voo(1, 980), pg_temp.voo(2, 1050, 1, 'C172'),
      pg_temp.voo(2, 610, 1, 'C152', 'cancelado'), pg_temp.voo(1, 700, 1, 'Sim. Mono'))))),
  ('2099-11-10', jsonb_build_object('resultado', jsonb_build_object('out', jsonb_build_array(pg_temp.voo(1, 390)))));

select has_function('public', 'horas_dos_instrutores', array['date'], 'função horas_dos_instrutores existe');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000041","role":"authenticated"}', true);
select is(public.horas_dos_instrutores('2099-11-10'),
  '{"1": {"mes": 3, "semestre": 4, "ano": 5, "fimAnterior": 1040}, "2": {"mes": 1, "semestre": 2, "ano": 2, "fimAnterior": 1110}}'::jsonb,
  'no mês, no semestre e no ano; só avião, sem cancelados; e o fim do último compromisso da véspera');
select is(public.horas_dos_instrutores('2099-01-01'), '{}'::jsonb, '1º de janeiro: o ano começa do zero (e a véspera não tem escala)');
select is(public.horas_dos_instrutores('2098-12-31'), '{"1": {"mes": 1, "semestre": 1, "ano": 1, "fimAnterior": 450}}'::jsonb,
  'o último dia do ano conta o ano todo e a véspera');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000042","role":"authenticated"}', true);
select is((public.horas_dos_instrutores('2099-11-10')->'1'->'ano')::numeric, 5::numeric, 'o gestor também vê');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000043","role":"authenticated"}', true);
select is(public.horas_dos_instrutores('2099-11-10'), '{}'::jsonb, 'a TV não lê as escalas');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.horas_dos_instrutores('2099-11-10') $$, '42501', null, 'anônimo não executa');

select * from finish();
rollback;
