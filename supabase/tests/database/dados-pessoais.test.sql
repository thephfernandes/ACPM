-- Fase 9: dados pessoais de alunos e instrutores (CPF, CANAC, nascimento, celular e e-mail). Só operadores,
-- administradores e a secretaria leem e gravam (pela função, que valida tudo); gestor, conta sem perfil e anônimo não.
-- Roda dentro de uma transação desfeita no final: não deixa dados no banco.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(36);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-a000-000000000021', 'operador@dados.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000022', 'administrador@dados.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000023', 'secretaria@dados.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000024', 'gestor@dados.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000025', 'sem-perfil@dados.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-a000-000000000021', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-a000-000000000022', 'administrador', 'Administrador de teste'),
  ('00000000-0000-4000-a000-000000000023', 'secretaria', 'Secretaria de teste'),
  ('00000000-0000-4000-a000-000000000024', 'gestor', 'Gestor de teste');
-- Começa sem dados pessoais (a transação é desfeita no final)
delete from public.dados_pessoais;

-- Estrutura
select has_table('public', 'dados_pessoais', 'tabela de dados pessoais existe');
select ok((select relrowsecurity from pg_class where oid = 'public.dados_pessoais'::regclass), 'RLS ativo em dados_pessoais');
select has_function('public', 'salvar_dados_pessoais', array['text', 'integer', 'jsonb'], 'função salvar_dados_pessoais existe');

-- CPF: os dois dígitos verificadores
select ok(public.cpf_valido('52998224725'), 'CPF válido');
select ok(public.cpf_valido('11144477735'), 'outro CPF válido');
select ok(not public.cpf_valido('52998224724'), 'dígito verificador errado');
select ok(not public.cpf_valido('11111111111'), 'todos os dígitos iguais não vale');
select ok(not public.cpf_valido('5299822472'), 'CPF com 10 dígitos não vale');

set local role authenticated;

-- Operador grava (normalizado: só dígitos, e-mail em minúsculas) e lê
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000021","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_dados_pessoais('aluno', 1000, '{"cpf":"529.982.247-25","canac":"123456","nascimento":"2001-05-20","celular":"(37) 99123-4567","email":" Ana@Exemplo.com "}') $$,
  'operador grava os dados pessoais de um aluno');
select results_eq($$ select cpf, canac, nascimento, celular, email, atualizado_por from public.dados_pessoais where tipo = 'aluno' and id_cadastro = 1000 $$,
  $$ values ('52998224725', '123456', '2001-05-20'::date, '37991234567', 'ana@exemplo.com', 'Operador de teste') $$,
  'guarda só os dígitos, o e-mail em minúsculas e quem gravou');
select lives_ok($$ select public.salvar_dados_pessoais('aluno', 1000, '{"cpf":"52998224725","celular":"37991234567"}') $$, 'operador altera os dados');
select results_eq($$ select canac, email from public.dados_pessoais where tipo = 'aluno' and id_cadastro = 1000 $$,
  $$ values (null::text, null::text) $$, 'campo vazio fica vazio');

-- Validação no servidor
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1001, '{"cpf":"52998224724"}') $$, '22023', 'CPF inválido', 'CPF inválido é rejeitado');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1001, '{"canac":"12345"}') $$, '22023', 'o CANAC tem 6 dígitos', 'CANAC com 5 dígitos é rejeitado');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1001, '{"nascimento":"2999-01-01"}') $$, '22023', 'data de nascimento inválida', 'nascimento no futuro é rejeitado');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1001, '{"nascimento":"20/05/2001"}') $$, '22023', 'data de nascimento inválida', 'nascimento fora do formato é rejeitado');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1001, '{"celular":"3733334444"}') $$, '22023', 'celular inválido (DDD e 9 dígitos)', 'telefone fixo é rejeitado');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1001, '{"email":"ana@"}') $$, '22023', 'e-mail inválido', 'e-mail inválido é rejeitado');
select throws_ok($$ select public.salvar_dados_pessoais('professor', 1001, '{"canac":"123456"}') $$, '22023', 'aluno ou instrutor inválido', 'tipo inválido é rejeitado');

-- CPF e CANAC não se repetem entre alunos (um instrutor pode ter o mesmo CPF de um aluno: a mesma pessoa)
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1001, '{"cpf":"529.982.247-25"}') $$, '23505', 'CPF já cadastrado para outro aluno', 'CPF repetido entre alunos é rejeitado');
select lives_ok($$ select public.salvar_dados_pessoais('aluno', 1001, '{"canac":"654321"}') $$, 'outro aluno com outro CANAC');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1002, '{"canac":"654321"}') $$, '23505', 'CANAC já cadastrado para outro aluno', 'CANAC repetido entre alunos é rejeitado');
select lives_ok($$ select public.salvar_dados_pessoais('instrutor', 7, '{"cpf":"52998224725"}') $$, 'instrutor com o CPF de um aluno (a mesma pessoa)');

-- Tudo vazio apaga os dados da pessoa
select lives_ok($$ select public.salvar_dados_pessoais('aluno', 1001, '{"canac":""}') $$, 'gravar sem nenhum dado');
select is_empty($$ select 1 from public.dados_pessoais where tipo = 'aluno' and id_cadastro = 1001 $$, 'sem nenhum dado, a linha sai');

-- Escrita direta na tabela é bloqueada
select throws_ok($$ insert into public.dados_pessoais (tipo, id_cadastro, canac) values ('aluno', 1003, '111111') $$, '42501', null, 'insert direto é bloqueado');
select is_empty($$ update public.dados_pessoais set canac = '222222' returning 1 $$, 'update direto não altera nada');

-- Administrador e secretaria gravam e leem
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000022","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_dados_pessoais('instrutor', 8, '{"canac":"333333"}') $$, 'administrador grava');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000023","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_dados_pessoais('aluno', 1004, '{"email":"bia@exemplo.com"}') $$, 'secretaria grava');
select is((select count(*)::integer from public.dados_pessoais), 4, 'secretaria lê todos os dados pessoais');

-- Gestor e conta sem perfil: nem leem nem gravam
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000024","role":"authenticated"}', true);
select is_empty($$ select 1 from public.dados_pessoais $$, 'gestor não lê dados pessoais');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1000, '{"canac":"999999"}') $$, '42501', null, 'gestor não grava dados pessoais');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000025","role":"authenticated"}', true);
select is_empty($$ select 1 from public.dados_pessoais $$, 'conta sem perfil não lê dados pessoais');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1000, '{"canac":"999999"}') $$, '42501', null, 'conta sem perfil não grava dados pessoais');

-- Visitante anônimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select 1 from public.dados_pessoais $$, '42501', null, 'anônimo não acessa dados pessoais');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1000, '{}') $$, '42501', null, 'anônimo não executa salvar_dados_pessoais');

select * from finish();
rollback;
