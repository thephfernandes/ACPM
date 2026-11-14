-- Fase 4: o conteúdo dos documentos e dos dias guarda a versão do formato (campo "esquema"). O servidor não aceita
-- um conteúdo num formato mais antigo do que o guardado: uma aba com a versão anterior do app não desfaz a
-- atualização dos dados. Revisão de 14/11: nem cria um dia num formato mais antigo que o do cadastro (a recusa vem com
-- a dica "formato", para o app pedir para recarregar), e o dia só leva os status da lista. Roda dentro de uma
-- transação desfeita no final: não deixa dados no banco.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

-- A dica da recusa: "formato" quando o app precisa ser recarregado (e não quando outra pessoa gravou antes)
create function pg_temp.dica(p_sql text)
  returns text language plpgsql as $$
declare
  dica text;
begin
  execute p_sql;
  return 'sem erro';
exception when others then
  get stacked diagnostics dica = pg_exception_hint;
  return coalesce(nullif(dica, ''), 'sem dica');
end;
$$;

delete from public.dias;
delete from public.documentos where chave = 'cadastro';

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-c000-000000000001', 'operador@teste-f4.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-c000-000000000001', 'operador', 'Operador de teste');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-000000000001","role":"authenticated"}', true);

-- Dias
select is(public.salvar_dia('2026-11-11', '{"v":1}', 0), 1, 'dia sem versão de formato (fase 3) é aceito');
select is(public.salvar_dia('2026-11-11', '{"esquema":5,"v":2}', 1), 2, 'atualizar o formato do dia é aceito');
select throws_ok($$ select public.salvar_dia('2026-11-11', '{"v":3}', 2) $$, 'PT409', null,
  'voltar o dia a um formato mais antigo é recusado (aba com a versão anterior do app)');
select is(public.salvar_dia('2026-11-11', '{"esquema":5,"v":3}', 2), 3, 'o mesmo formato continua sendo gravado');
select throws_ok($$ select public.salvar_dia('2026-11-11', '{"esquema":"5","v":4}', 3) $$, 'PT409', null,
  'versão de formato que não é número conta como a mais antiga');
select is((select conteudo ->> 'v' from public.dias where data = '2026-11-11'), '3', 'o dia guardado não mudou com as recusas');

-- Cadastro (tabela documentos)
select is(public.salvar_documento('cadastro', '{"ins":[]}', 0), 1, 'cadastro sem versão de formato (fase 3) é aceito');
select is(public.salvar_documento('cadastro', '{"esquema":5,"ins":[]}', 1), 2, 'atualizar o formato do cadastro é aceito');
select throws_ok($$ select public.salvar_documento('cadastro', '{"ins":[1]}', 2) $$, 'PT409', null,
  'voltar o cadastro a um formato mais antigo é recusado');


-- Um dia novo não pode nascer num formato mais antigo que o do cadastro (o cadastro já está no formato 5)
select throws_ok($$ select public.salvar_dia('2026-11-12', '{"esquema":4}', 0) $$, 'PT409', null,
  'um dia novo num formato mais antigo que o do cadastro é recusado (aba com a versão anterior do app)');
select is(pg_temp.dica($$ select public.salvar_dia('2026-11-12', '{"esquema":4}', 0) $$), 'formato', 'com a dica "formato"');
select is(pg_temp.dica($$ select public.salvar_dia('2026-11-11', '{"v":5}', 3) $$), 'formato', 'voltar o formato do dia também');
select is(pg_temp.dica($$ select public.salvar_documento('cadastro', '{"ins":[1]}', 2) $$), 'formato', 'e o do cadastro');
select is(pg_temp.dica($$ select public.salvar_dia('2026-11-11', '{"esquema":5,"v":9}', 1) $$), 'sem dica',
  'quando outra pessoa gravou antes, a recusa vem sem a dica');
select is(public.salvar_dia('2026-11-12', '{"esquema":5}', 0), 1, 'no formato do cadastro, o dia novo é aceito');

-- Só os status da lista ("Pousou" já vale), em chaves de voo
select is(public.salvar_dia('2026-11-12', '{"esquema":5,"fStatus":{"1000_0_1":"Pousou","1001_0_1":"Em Voo"}}', 1), 2, 'status da lista são aceitos');
select throws_ok($$ select public.salvar_dia('2026-11-12', '{"esquema":5,"fStatus":{"1000_0_1":"<b>x</b>"}}', 2) $$, '23514', null,
  'um status fora da lista é recusado');
select throws_ok($$ select public.salvar_dia('2026-11-12', '{"esquema":5,"fStatus":{"\"><b>":"Cancelado"}}', 2) $$, '23514', null,
  'um status numa chave que não é de voo é recusado');

-- As datas num formato anterior (a atualização do formato lê só essas, e não todos os dias)
select is(public.dias_em_formato_antigo(6), '["2026-11-11", "2026-11-12"]'::jsonb, 'as datas num formato anterior ao pedido');

select * from finish();
rollback;
