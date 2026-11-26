-- O pedido da agenda com a missão do curso e a confirmação do 7º voo local (a migração
-- 20261127100000_missao_do_curso_e_limite_do_pedido): as colunas, a função de 13 argumentos e as de 11 e de 10, que ficam.
-- Cada caso de test/helpers/casos-da-agenda.js é uma verificação daqui, com o nome do caso na descrição
-- (test/unit/espelho-do-banco.test.js confere), partindo do curso ZZ1 e da agenda com os voos locais do caso às 08:20.
-- Roda dentro de uma transação desfeita no final.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(36);

delete from public.solicitacoes;
insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-d400-000000000001', 'secretaria@teste-agenda-missao.acpm.invalid', now(), now()),
  ('00000000-0000-4000-d400-000000000002', 'operador@teste-agenda-missao.acpm.invalid', now(), now()),
  ('00000000-0000-4000-d400-000000000003', 'gestor@teste-agenda-missao.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-d400-000000000001', 'secretaria', 'Secretaria de teste'),
  ('00000000-0000-4000-d400-000000000002', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-d400-000000000003', 'gestor', 'Gestor de teste');

-- O curso ZZ1 dos casos (CURSO_DOS_CASOS): a Fase 1, com a NAV-150NM (Navegação, C152, 3 h), a LOC-01 (Voo Local) e a
-- RET-01 (retirada do programa); a Fase 2, retirada, com a FR-01
insert into public.cursos (sigla, nome, ordem) values ('ZZ1', 'Curso dos casos da agenda', 997);
insert into public.fases_do_curso (id, curso, nome, ordem, removida) values
  ('00000000-0000-4000-9101-000000000001', 'ZZ1', 'Fase 1', 0, false),
  ('00000000-0000-4000-9101-000000000002', 'ZZ1', 'Fase 2', 1, true);
insert into public.missoes_do_curso (id, curso, fase, codigo, nome, tipo_de_missao, recurso, horas, ordem, removida) values
  ('00000000-0000-4000-9102-000000000001', 'ZZ1', '00000000-0000-4000-9101-000000000001', 'NAV-150NM', 'NAV-150NM', 'Navegação', 'C152', 3, 0, false),
  ('00000000-0000-4000-9102-000000000002', 'ZZ1', '00000000-0000-4000-9101-000000000001', 'LOC-01', 'LOC-01', 'Voo Local', 'C152', 1, 1, false),
  ('00000000-0000-4000-9102-000000000003', 'ZZ1', '00000000-0000-4000-9101-000000000001', 'RET-01', 'RET-01', 'Voo Local', 'C152', 1, 2, true),
  ('00000000-0000-4000-9102-000000000004', 'ZZ1', '00000000-0000-4000-9101-000000000002', 'FR-01', 'FR-01', 'Voo Local', 'C152', 1, 0, false);

-- A data dos pedidos: daqui a cinco dias (a segunda, quando cai num domingo), no prazo
create function pg_temp.d()
  returns date language sql as $$ select current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end $$;
-- Um pedido pela função de 13 argumentos, como o app manda
create function pg_temp.registrar(p_missao text, p_recurso text, p_horario text default '08:20', p_horas numeric default 1,
  p_missao_do_curso uuid default null, p_confirmar boolean default false, p_aluno integer default 1000)
  returns bigint language sql as $$
  select public.registrar_solicitacao(pg_temp.d(), p_aluno, 'Aluno de teste', p_missao, 'horario', p_horario, p_horas, 'Maria', null, false,
    p_recurso, p_missao_do_curso, p_confirmar)
$$;
-- O código e a dica da recusa ("22023 recurso"; só o código quando não há dica), ou "sem erro". Nada fica gravado
create function pg_temp.erro(p_sql text)
  returns text language plpgsql as $$
declare
  codigo text;
  dica text;
begin
  execute p_sql;
  raise exception 'pg_temp.erro: sem erro';
exception when others then
  get stacked diagnostics codigo = returned_sqlstate, dica = pg_exception_hint;
  if sqlerrm = 'pg_temp.erro: sem erro' then
    return 'sem erro';
  end if;
  return codigo || coalesce(' ' || nullif(dica, ''), '');
end;
$$;
-- O que fica guardado do pedido de um aluno: as horas, o recurso, a missão do curso e se a confirmação foi registrada
create function pg_temp.guardado(p_aluno integer)
  returns table (horas numeric, recurso text, missao_do_curso uuid, limite_confirmado boolean) language sql as $$
  select s.horas, s.recurso, s.missao_do_curso, s.limite_confirmado_por is not null and s.limite_confirmado_em is not null
  from public.solicitacoes s where s.aluno = p_aluno
$$;

-- As colunas e as funções
select has_column('public', 'solicitacoes', 'missao_do_curso', 'a agenda guarda a missão do curso');
select has_column('public', 'solicitacoes', 'limite_confirmado_por', 'a agenda guarda quem confirmou o 7º voo local');
select has_column('public', 'solicitacoes', 'limite_confirmado_em', 'a agenda guarda quando o 7º voo local foi confirmado');
select has_function('public', 'registrar_solicitacao',
  array['date', 'integer', 'text', 'text', 'text', 'text', 'numeric', 'text', 'text', 'boolean', 'text', 'uuid', 'boolean'],
  'a função nova, com a missão do curso e a confirmação');
select has_function('public', 'registrar_solicitacao', array['date', 'integer', 'text', 'text', 'text', 'text', 'numeric', 'text', 'text', 'boolean', 'text'],
  'a função de 11 argumentos continua');
select has_function('public', 'registrar_solicitacao', array['date', 'integer', 'text', 'text', 'text', 'text', 'numeric', 'text', 'text', 'boolean'],
  'a função de 10 argumentos continua');
select ok(not has_function_privilege('anon', 'public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text, uuid, boolean)', 'execute'),
  'o anônimo não chama a função nova');
select ok(has_function_privilege('authenticated', 'public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text, uuid, boolean)', 'execute'),
  'quem está conectado chama a função nova');
select ok((select prosecdef from pg_proc where oid = 'public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text, uuid, boolean)'::regprocedure),
  'a função nova é security definer');
select is((select proconfig from pg_proc where oid = 'public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text, uuid, boolean)'::regprocedure),
  array['search_path=""'], 'com o search_path vazio');
select ok(has_column_privilege('authenticated', 'public.solicitacoes', 'missao_do_curso', 'select'), 'quem lê a agenda lê a missão do curso');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d400-000000000001","role":"authenticated"}', true);

-- Com as três funções, a chamada pelos nomes acha uma só: os 11 nomes, a de 11 (que não confere o horário do Voo Solo),
-- e os 10, a de 10
select lives_ok($$ select public.registrar_solicitacao(p_data => pg_temp.d(), p_aluno => 4001, p_aluno_nome => 'Aluno', p_missao => 'Voo Solo',
  p_janela => 'horario', p_horario => '12:40', p_horas => 1, p_registrado_por => 'Maria', p_observacao => null, p_excecao => false, p_recurso => 'C152') $$,
  'a chamada pelos 11 nomes acha a função de 11, com as três instaladas');
select lives_ok($$ select public.registrar_solicitacao(p_data => pg_temp.d(), p_aluno => 4002, p_aluno_nome => 'Aluno', p_missao => 'Navegação',
  p_janela => 'horario', p_horario => '12:40', p_horas => 1, p_registrado_por => 'Maria', p_observacao => null, p_excecao => false) $$,
  'a chamada pelos 10 nomes acha a função de 10, com as três instaladas');

-- O recurso
select is(pg_temp.erro($$ select pg_temp.registrar('Navegação', null) $$), '22023 recurso', 'sem recurso: recusado (recurso)');
select is(pg_temp.erro($$ select pg_temp.registrar('Navegação', '  ') $$), '22023 recurso', 'recurso em branco: recusado (recurso)');
select is(pg_temp.erro($$ select pg_temp.registrar('Noturno', 'C152', '17:30') $$), '22023 recurso', 'recurso que a missão não permite: recusado (recurso)');
select is(pg_temp.erro($$ select pg_temp.registrar('Ground C152', 'C152') $$), '22023 recurso', 'Ground fora da Sala Ground: recusado (recurso)');
select pg_temp.registrar('Ground C152', 'Sala Ground', '08:20', null, null, false, 3001);
select results_eq($$ select * from pg_temp.guardado(3001) $$, $$ values (1.5::numeric, 'Sala Ground'::text, null::uuid, false) $$, 'Ground sem as horas: 1,5 h');

-- Os horários fixos
select is(pg_temp.erro($$ select pg_temp.registrar('Noturno', 'C172', '16:20', 4) $$), '22023 horario', 'Noturno fora das 17:30: recusado (horario)');
select pg_temp.registrar('Noturno', 'C172', '17:30', 4, null, false, 3002);
select results_eq($$ select * from pg_temp.guardado(3002) $$, $$ values (4::numeric, 'C172'::text, null::uuid, false) $$, 'Noturno às 17:30: aceito');
select is(pg_temp.erro($$ select pg_temp.registrar('Voo Solo', 'C152', '08:20') $$), '22023 horario', 'Voo Solo fora das 06:30: recusado (horario)');
select pg_temp.registrar('Voo Solo', 'PA-34', '06:30', 1, null, false, 3003);
select results_eq($$ select * from pg_temp.guardado(3003) $$, $$ values (1::numeric, 'PA-34'::text, null::uuid, false) $$, 'Voo Solo às 06:30 no PA-34: aceito');

-- A missão do curso
select is(pg_temp.erro($$ select pg_temp.registrar('Navegação', 'C152', '08:20', 1, '00000000-0000-4000-9102-000000000009') $$), '22023 missao',
  'missão do curso que não existe: recusada (missao)');
select is(pg_temp.erro($$ select pg_temp.registrar('Voo Local', 'C152', '08:20', 1, '00000000-0000-4000-9102-000000000003') $$), '22023 missao',
  'missão do curso retirada do programa: recusada (missao)');
select is(pg_temp.erro($$ select pg_temp.registrar('Voo Local', 'C152', '08:20', 1, '00000000-0000-4000-9102-000000000004') $$), '22023 missao',
  'missão do curso numa fase retirada: recusada (missao)');
select is(pg_temp.erro($$ select pg_temp.registrar('Voo Local', 'C152', '08:20', 1, '00000000-0000-4000-9102-000000000001') $$), '22023 missao',
  'missão do curso de outro tipo: recusada (missao)');
select pg_temp.registrar('Navegação', 'C152', '08:20', 3, '00000000-0000-4000-9102-000000000001', false, 3004);
select results_eq($$ select * from pg_temp.guardado(3004) $$, $$ values (3::numeric, 'C152'::text, '00000000-0000-4000-9102-000000000001'::uuid, false) $$,
  'missão do curso: guardada no pedido');
select pg_temp.registrar('Navegação', 'PA-34', '07:30', 1, '00000000-0000-4000-9102-000000000001', false, 3005);
select results_eq($$ select * from pg_temp.guardado(3005) $$, $$ values (1::numeric, 'PA-34'::text, '00000000-0000-4000-9102-000000000001'::uuid, false) $$,
  'missão do curso noutro recurso: aceita');

-- O limite de voos locais: cinco às 08:20; o sexto com a confirmação (ainda havia vaga) não registra nada
select pg_temp.registrar('Voo Local', 'C152', '08:20', 1, null, false, 2000 + n) from generate_series(0, 4) n;
select pg_temp.registrar('Voo Local', 'C152', '08:20', 1, null, true, 3006);
select results_eq($$ select * from pg_temp.guardado(3006) $$, $$ values (1::numeric, 'C152'::text, null::uuid, false) $$, 'a confirmação com vaga: nada registrado');
select is(pg_temp.erro($$ select pg_temp.registrar('Voo Local', 'C152') $$), 'PT422 locais', 'o 7º voo local sem a confirmação: recusado (locais)');
select pg_temp.registrar('Navegação', 'C152', '08:20', 1, null, true, 3007);
select results_eq($$ select * from pg_temp.guardado(3007) $$, $$ values (1::numeric, 'C152'::text, null::uuid, false) $$, 'a confirmação noutra missão: nada registrado');
select pg_temp.registrar('TGL (TMA)', 'C152', '08:20', 1, null, true, 3008);
select results_eq($$ select * from pg_temp.guardado(3008) $$, $$ values (1::numeric, 'C152'::text, null::uuid, true) $$,
  'o 7º voo local confirmado: registrado com quem confirmou');
select is((select limite_confirmado_por from public.solicitacoes where aluno = 3008), 'Secretaria de teste', 'quem confirmou é o nome da conta');
select pg_temp.registrar('Voo Local', 'C152', '10:10', 1, null, false, 3009);
select results_eq($$ select * from pg_temp.guardado(3009) $$, $$ values (1::numeric, 'C152'::text, null::uuid, false) $$, 'o 7º voo local noutro horário: aceito');

-- O prazo e quem pode continuam: a exceção é do operador; o gestor não registra
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d400-000000000002","role":"authenticated"}', true);
select lives_ok($$ select public.registrar_solicitacao(current_date, 5000, 'Aluno', 'Navegação', 'horario', '07:30', 3, 'Coordenação', null, true,
  'PA-34', '00000000-0000-4000-9102-000000000001', false) $$, 'o operador registra pela exceção da coordenação, com a missão do curso');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d400-000000000003","role":"authenticated"}', true);
select is(pg_temp.erro($$ select pg_temp.registrar('Navegação', 'C152', '08:20', 1, null, false, 5001) $$), '42501', 'o gestor não registra pela função nova');

select * from finish();
rollback;
