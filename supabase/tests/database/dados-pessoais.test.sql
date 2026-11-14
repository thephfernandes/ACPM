-- Fase 9: dados pessoais de alunos e instrutores (CPF, CANAC, nascimento, celular e e-mail). Só operadores,
-- administradores e a secretaria leem e gravam (pela função, que valida tudo); gestor, conta sem perfil e anônimo não.
-- Revisão de 14/11: a gravação leva a versão lida (atualizado_em) e é recusada quando outra pessoa gravou antes; só vale
-- para quem está no cadastro; a própria função registra no histórico os campos que mudaram (nunca os valores), também
-- para a secretaria; e quem sai do cadastro leva os dados pessoais junto.
-- Roda dentro de uma transação desfeita no final: não deixa dados no banco.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(47);

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
-- Começa sem dados pessoais, com um cadastro conhecido (a transação é desfeita no final)
delete from public.dados_pessoais;
delete from public.documentos where chave = 'cadastro';
insert into public.documentos (chave, conteudo, versao) values ('cadastro', '{"esquema": 18,
  "stu": [{"id": 1000, "nm": "Ana Souza"}, {"id": 1001, "nm": "Bia"}, {"id": 1002, "nm": "Caio"}, {"id": 1004, "nm": "Duda"}],
  "ins": [{"id": 7, "nm": "Instrutor 07"}, {"id": 8, "nm": "Instrutor 08"}]}', 1);

-- Grava com a versão lida, na data de 11/11 (como o app: lê, mostra, grava)
create function pg_temp.salvar(p_tipo text, p_id integer, p_dados jsonb)
  returns jsonb language sql as $$
  select public.salvar_dados_pessoais(p_tipo, p_id, p_dados,
    (select atualizado_em from public.dados_pessoais where tipo = p_tipo and id_cadastro = p_id), date '2026-11-11')
$$;

-- Estrutura
select has_table('public', 'dados_pessoais', 'tabela de dados pessoais existe');
select ok((select relrowsecurity from pg_class where oid = 'public.dados_pessoais'::regclass), 'RLS ativo em dados_pessoais');
select has_function('public', 'salvar_dados_pessoais', array['text', 'integer', 'jsonb', 'timestamptz', 'date'], 'função salvar_dados_pessoais existe (com a versão lida e a data)');
-- A versão antiga fica até o app novo estar no ar (o app em produção ainda a chama); uma migração depois a tira
select has_function('public', 'salvar_dados_pessoais', array['text', 'integer', 'jsonb'], 'a versão antiga continua enquanto o app anterior estiver no ar');

-- CPF: os dois dígitos verificadores
select ok(public.cpf_valido('52998224725'), 'CPF válido');
select ok(public.cpf_valido('11144477735'), 'outro CPF válido');
select ok(not public.cpf_valido('52998224724'), 'dígito verificador errado');
select ok(not public.cpf_valido('11111111111'), 'todos os dígitos iguais não vale');
select ok(not public.cpf_valido('5299822472'), 'CPF com 10 dígitos não vale');

set local role authenticated;

-- Operador grava (normalizado: só dígitos, e-mail em minúsculas) e lê
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000021","role":"authenticated"}', true);
select lives_ok($$ select pg_temp.salvar('aluno', 1000, '{"cpf":"529.982.247-25","canac":"123456","nascimento":"2001-05-20","celular":"(37) 99123-4567","email":" Ana@Exemplo.com "}') $$,
  'operador grava os dados pessoais de um aluno');
select results_eq($$ select cpf, canac, nascimento, celular, email, atualizado_por from public.dados_pessoais where tipo = 'aluno' and id_cadastro = 1000 $$,
  $$ values ('52998224725', '123456', '2001-05-20'::date, '37991234567', 'ana@exemplo.com', 'Operador de teste') $$,
  'guarda só os dígitos, o e-mail em minúsculas e quem gravou');
select lives_ok($$ select pg_temp.salvar('aluno', 1000, '{"cpf":"52998224725","celular":"37991234567"}') $$, 'operador altera os dados');
select results_eq($$ select canac, email from public.dados_pessoais where tipo = 'aluno' and id_cadastro = 1000 $$,
  $$ values (null::text, null::text) $$, 'campo vazio fica vazio');

-- O histórico registra os campos que mudaram (nunca os valores), na data, com quem gravou
select is((select array_agg(descricao order by id) from public.historico where data = '2026-11-11' and descricao like 'Dados pessoais%'),
  array['Dados pessoais de Ana Souza atualizados: CPF, CANAC, Nascimento, Celular, E-mail', 'Dados pessoais de Ana Souza atualizados: CANAC, Nascimento, E-mail'],
  'o histórico registra só os nomes dos campos que mudaram');
select is((select autor from public.historico where descricao like 'Dados pessoais de Ana%' order by id desc limit 1), 'Operador de teste', 'com quem gravou');
select is(pg_temp.salvar('aluno', 1000, '{"cpf":"52998224725","celular":"37991234567"}')->'historico', 'null'::jsonb, 'sem mudança, nada vai para o histórico');

-- A versão lida: outra pessoa gravou antes, a gravação é recusada
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1000, '{"canac":"111111"}', '2000-01-01', '2026-11-11') $$, 'PT409', null,
  'gravar a partir de uma versão antiga é recusado');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1000, '{"canac":"111111"}', null, '2026-11-11') $$, 'PT409', null,
  'gravar como se não houvesse dados, quando outra pessoa já gravou, é recusado');
select is((select canac from public.dados_pessoais where tipo = 'aluno' and id_cadastro = 1000), null, 'os dados não mudaram com as recusas');

-- Só quem está no cadastro
select throws_ok($$ select pg_temp.salvar('aluno', 1003, '{"canac":"111111"}') $$, 'P0002', null, 'quem não está no cadastro é recusado');

-- Validação no servidor
select throws_ok($$ select pg_temp.salvar('aluno', 1001, '{"cpf":"52998224724"}') $$, '22023', 'CPF inválido', 'CPF inválido é rejeitado');
select throws_ok($$ select pg_temp.salvar('aluno', 1001, '{"canac":"12345"}') $$, '22023', 'o CANAC tem 6 dígitos', 'CANAC com 5 dígitos é rejeitado');
select throws_ok($$ select pg_temp.salvar('aluno', 1001, '{"nascimento":"2999-01-01"}') $$, '22023', 'data de nascimento inválida', 'nascimento no futuro é rejeitado');
select throws_ok($$ select pg_temp.salvar('aluno', 1001, '{"nascimento":"20/05/2001"}') $$, '22023', 'data de nascimento inválida', 'nascimento fora do formato é rejeitado');
select throws_ok($$ select pg_temp.salvar('aluno', 1001, '{"celular":"3733334444"}') $$, '22023', 'celular inválido (DDD e 9 dígitos)', 'telefone fixo é rejeitado');
select throws_ok($$ select pg_temp.salvar('aluno', 1001, '{"email":"ana@"}') $$, '22023', 'e-mail inválido', 'e-mail inválido é rejeitado');
select throws_ok($$ select pg_temp.salvar('professor', 1001, '{"canac":"123456"}') $$, '22023', 'aluno ou instrutor inválido', 'tipo inválido é rejeitado');

-- CPF e CANAC não se repetem entre alunos (um instrutor pode ter o mesmo CPF de um aluno: a mesma pessoa)
select throws_ok($$ select pg_temp.salvar('aluno', 1001, '{"cpf":"529.982.247-25"}') $$, '23505', 'CPF já cadastrado para outro aluno', 'CPF repetido entre alunos é rejeitado');
select lives_ok($$ select pg_temp.salvar('aluno', 1001, '{"canac":"654321"}') $$, 'outro aluno com outro CANAC');
select throws_ok($$ select pg_temp.salvar('aluno', 1002, '{"canac":"654321"}') $$, '23505', 'CANAC já cadastrado para outro aluno', 'CANAC repetido entre alunos é rejeitado');
select lives_ok($$ select pg_temp.salvar('instrutor', 7, '{"cpf":"52998224725"}') $$, 'instrutor com o CPF de um aluno (a mesma pessoa)');

-- Tudo vazio apaga os dados da pessoa
select lives_ok($$ select pg_temp.salvar('aluno', 1001, '{"canac":""}') $$, 'gravar sem nenhum dado');
select is_empty($$ select 1 from public.dados_pessoais where tipo = 'aluno' and id_cadastro = 1001 $$, 'sem nenhum dado, a linha sai');

-- Escrita direta na tabela é bloqueada
select throws_ok($$ insert into public.dados_pessoais (tipo, id_cadastro, canac) values ('aluno', 1003, '111111') $$, '42501', null, 'insert direto é bloqueado');
select is_empty($$ update public.dados_pessoais set canac = '222222' returning 1 $$, 'update direto não altera nada');

-- Administrador e secretaria gravam e leem
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000022","role":"authenticated"}', true);
select lives_ok($$ select pg_temp.salvar('instrutor', 8, '{"canac":"333333"}') $$, 'administrador grava');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000023","role":"authenticated"}', true);
select lives_ok($$ select pg_temp.salvar('aluno', 1004, '{"email":"bia@exemplo.com"}') $$, 'secretaria grava');
select is((select autor from public.historico where descricao = 'Dados pessoais de Duda atualizados: E-mail'), 'Secretaria de teste',
  'a alteração da secretaria também vai para o histórico');
select is((select count(*)::integer from public.dados_pessoais), 4, 'secretaria lê todos os dados pessoais');

-- Quem sai do cadastro leva os dados pessoais junto (o cadastro gravado sem a Duda e sem o Instrutor 08)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000021","role":"authenticated"}', true);
select is(public.salvar_documento('cadastro', '{"esquema": 18,
  "stu": [{"id": 1000, "nm": "Ana Souza"}, {"id": 1001, "nm": "Bia"}, {"id": 1002, "nm": "Caio"}], "ins": [{"id": 7, "nm": "Instrutor 07"}]}', 1), 2,
  'o operador grava o cadastro sem uma aluna e um instrutor');
select is((select array_agg(tipo || ':' || id_cadastro order by tipo, id_cadastro) from public.dados_pessoais), array['aluno:1000', 'instrutor:7'],
  'os dados pessoais de quem saiu do cadastro saem junto');

-- Gestor e conta sem perfil: nem leem nem gravam
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000024","role":"authenticated"}', true);
select is_empty($$ select 1 from public.dados_pessoais $$, 'gestor não lê dados pessoais');
select throws_ok($$ select pg_temp.salvar('aluno', 1000, '{"canac":"999999"}') $$, '42501', null, 'gestor não grava dados pessoais');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000025","role":"authenticated"}', true);
select is_empty($$ select 1 from public.dados_pessoais $$, 'conta sem perfil não lê dados pessoais');
select throws_ok($$ select pg_temp.salvar('aluno', 1000, '{"canac":"999999"}') $$, '42501', null, 'conta sem perfil não grava dados pessoais');

-- Visitante anônimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select 1 from public.dados_pessoais $$, '42501', null, 'anônimo não acessa dados pessoais');
select throws_ok($$ select public.salvar_dados_pessoais('aluno', 1000, '{}', null, null) $$, '42501', null, 'anônimo não executa salvar_dados_pessoais');

select * from finish();
rollback;
