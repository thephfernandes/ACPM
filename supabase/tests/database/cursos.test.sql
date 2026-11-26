-- Os cursos, as fases e as missões em tabelas próprias. Quem lê a escala lê os programas; a TV, a conta sem perfil e o
-- anônimo, não. Só o Administrador grava, o curso inteiro e a partir da versão lida (cada recusa traz o campo na dica), e
-- ninguém grava direto nas tabelas. O Noturno pode vir em trechos (a ida, a noite e a volta, juntas na fase). A conversão
-- única do programa guardado no cadastro vale só antes do formato dos cursos (public.formato_dos_cursos(), que monta os
-- cadastros de teste: nenhum número de formato fica aqui). As verificações da gravação são os casos de
-- test/helpers/casos-do-programa.js, com os mesmos dados (o nome do caso é a descrição;
-- test/unit/espelho-do-banco.test.js confere). Os cursos de teste são o ZZ9 e o ZZ8, o aluno fica acima de 99000 e o
-- cadastro é trocado: a transação é desfeita no final.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(105);

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-f000-000000000001', 'administrador@cursos.acpm.invalid', now(), now()),
  ('00000000-0000-4000-f000-000000000002', 'operador@cursos.acpm.invalid', now(), now()),
  ('00000000-0000-4000-f000-000000000003', 'gestor@cursos.acpm.invalid', now(), now()),
  ('00000000-0000-4000-f000-000000000004', 'secretaria@cursos.acpm.invalid', now(), now()),
  ('00000000-0000-4000-f000-000000000005', 'painel@cursos.acpm.invalid', now(), now()),
  ('00000000-0000-4000-f000-000000000006', 'sem-perfil@cursos.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-f000-000000000001', 'administrador', 'Administrador de teste'),
  ('00000000-0000-4000-f000-000000000002', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-f000-000000000003', 'gestor', 'Gestor de teste'),
  ('00000000-0000-4000-f000-000000000004', 'secretaria', 'Secretaria de teste'),
  ('00000000-0000-4000-f000-000000000005', 'painel', 'TV de teste');

-- O cadastro já no formato dos cursos, na versão 7 (o banco de prévia tem o seu), e o curso ZZ8, com uma fase (o id de
-- outro curso)
delete from public.documentos where chave = 'cadastro';
insert into public.documentos (chave, conteudo, versao)
  values ('cadastro', jsonb_build_object('esquema', public.formato_dos_cursos(), 'stu', '[]'::jsonb, 'ins', '[]'::jsonb), 7);
insert into public.cursos (sigla, nome, ordem) values ('ZZ8', 'Outro curso de teste', 998);
insert into public.fases_do_curso (id, curso, nome, ordem) values ('00000000-0000-4000-9008-000000000001', 'ZZ8', 'Fase do outro curso', 0);

-- O código e a dica da recusa ("22023 codigo"; só o código quando não há dica), ou "sem erro". Nada fica gravado: sem
-- erro, a gravação também é desfeita (as verificações seguintes partem do mesmo estado)
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

-- O programa do curso de teste ZZ9 (PROGRAMA em test/helpers/casos-do-programa.js)
create function pg_temp.programa()
  returns jsonb language sql as $$ select '{"nome": "Curso de teste", "ativo": true,
  "fases": [
    {"id": "00000000-0000-4000-9001-000000000001", "nome": "Fase 1 – Duplo comando", "modulo": "Módulo 01 – Treinamento", "regra": "ordem", "requer": []},
    {"id": "00000000-0000-4000-9001-000000000002", "nome": "Fase 2 – Solo", "modulo": "Módulo 01 – Treinamento", "regra": "ordem", "requer": []},
    {"id": "00000000-0000-4000-9001-000000000003", "nome": "Fase 3 – Noturno", "modulo": null, "regra": "depois", "requer": ["00000000-0000-4000-9001-000000000001"]}
  ],
  "missoes": [
    {"id": "00000000-0000-4000-9002-000000000001", "fase": "00000000-0000-4000-9001-000000000001", "codigo": "ZZ9-01", "nome": "Primeiro voo", "mis": "Voo Local", "eq": "C152", "nb": 1, "regra": "ordem", "requer": [], "dispensada": false, "avaliacao": false, "exige": []},
    {"id": "00000000-0000-4000-9002-000000000002", "fase": "00000000-0000-4000-9001-000000000001", "codigo": "ZZ9-02", "nome": "Ground do C152", "mis": "Ground C152", "eq": "Sala Ground", "nb": 1.5, "regra": "livre", "requer": [], "dispensada": false, "avaliacao": false, "exige": []},
    {"id": "00000000-0000-4000-9002-000000000003", "fase": "00000000-0000-4000-9001-000000000002", "codigo": "ZZ9-03", "nome": "Adaptação", "mis": "Voo Local", "eq": "C152", "nb": 1, "regra": "ordem", "requer": [], "dispensada": true, "avaliacao": false, "exige": []},
    {"id": "00000000-0000-4000-9002-000000000004", "fase": "00000000-0000-4000-9001-000000000002", "codigo": "ZZ9-04", "nome": "Solo", "mis": "Voo Solo", "eq": "C152", "nb": 1, "regra": "depois", "requer": ["00000000-0000-4000-9002-000000000001"], "dispensada": false, "avaliacao": true, "exige": []},
    {"id": "00000000-0000-4000-9002-000000000005", "fase": "00000000-0000-4000-9001-000000000003", "codigo": "ZZ9-05", "nome": "Noturno", "mis": "Noturno", "eq": "C172", "nb": 3, "regra": "ordem", "requer": [], "dispensada": false, "avaliacao": false, "exige": []}
  ]}'::jsonb $$;

-- O programa com o Noturno em trechos: na Fase 3, a ida (ZZ9-06), a noite (a ZZ9-05) e a volta (ZZ9-07), juntas e nesta
-- ordem (NOTURNO_EM_TRECHOS em test/helpers/casos-do-programa.js)
create function pg_temp.noturno()
  returns jsonb language sql as $$ select '{"nome": "Curso de teste", "ativo": true,
  "fases": [
    {"id": "00000000-0000-4000-9001-000000000001", "nome": "Fase 1 – Duplo comando", "modulo": "Módulo 01 – Treinamento", "regra": "ordem", "requer": []},
    {"id": "00000000-0000-4000-9001-000000000002", "nome": "Fase 2 – Solo", "modulo": "Módulo 01 – Treinamento", "regra": "ordem", "requer": []},
    {"id": "00000000-0000-4000-9001-000000000003", "nome": "Fase 3 – Noturno", "modulo": null, "regra": "depois", "requer": ["00000000-0000-4000-9001-000000000001"]}
  ],
  "missoes": [
    {"id": "00000000-0000-4000-9002-000000000001", "fase": "00000000-0000-4000-9001-000000000001", "codigo": "ZZ9-01", "nome": "Primeiro voo", "mis": "Voo Local", "eq": "C152", "nb": 1, "regra": "ordem", "requer": [], "dispensada": false, "avaliacao": false, "exige": []},
    {"id": "00000000-0000-4000-9002-000000000002", "fase": "00000000-0000-4000-9001-000000000001", "codigo": "ZZ9-02", "nome": "Ground do C152", "mis": "Ground C152", "eq": "Sala Ground", "nb": 1.5, "regra": "livre", "requer": [], "dispensada": false, "avaliacao": false, "exige": []},
    {"id": "00000000-0000-4000-9002-000000000003", "fase": "00000000-0000-4000-9001-000000000002", "codigo": "ZZ9-03", "nome": "Adaptação", "mis": "Voo Local", "eq": "C152", "nb": 1, "regra": "ordem", "requer": [], "dispensada": true, "avaliacao": false, "exige": []},
    {"id": "00000000-0000-4000-9002-000000000004", "fase": "00000000-0000-4000-9001-000000000002", "codigo": "ZZ9-04", "nome": "Solo", "mis": "Voo Solo", "eq": "C152", "nb": 1, "regra": "depois", "requer": ["00000000-0000-4000-9002-000000000001"], "dispensada": false, "avaliacao": true, "exige": []},
    {"id": "00000000-0000-4000-9002-000000000006", "fase": "00000000-0000-4000-9001-000000000003", "codigo": "ZZ9-06", "nome": "Translado de ida", "mis": "Noturno", "eq": "C172", "nb": 1, "regra": "ordem", "requer": [], "dispensada": false, "avaliacao": false, "exige": [], "trecho": "ida"},
    {"id": "00000000-0000-4000-9002-000000000005", "fase": "00000000-0000-4000-9001-000000000003", "codigo": "ZZ9-05", "nome": "Noturno", "mis": "Noturno", "eq": "C172", "nb": 3, "regra": "ordem", "requer": [], "dispensada": false, "avaliacao": false, "exige": [], "trecho": "noite"},
    {"id": "00000000-0000-4000-9002-000000000007", "fase": "00000000-0000-4000-9001-000000000003", "codigo": "ZZ9-07", "nome": "Translado de volta", "mis": "Noturno", "eq": "C172", "nb": 1, "regra": "ordem", "requer": [], "dispensada": false, "avaliacao": false, "exige": [], "trecho": "volta"}
  ]}'::jsonb $$;

-- O programa com os códigos de ZZ9-02 e ZZ9-03 trocados
create function pg_temp.trocados()
  returns jsonb language sql as $$
  select jsonb_set(jsonb_set(pg_temp.programa(), '{missoes,1,codigo}', '"ZZ9-03"'), '{missoes,2,codigo}', '"ZZ9-02"')
$$;

-- O programa guardado no cadastro, como o app manda na conversão: o ZZ8 e um curso que não existe (o ZZ7)
create function pg_temp.legado()
  returns jsonb language sql as $$ select '[
  {"sigla": "ZZ8",
   "fases": [{"id": "00000000-0000-4000-9003-000000000001", "nome": "Programa", "modulo": null, "regra": "ordem", "requer": []}],
   "missoes": [
     {"id": "00000000-0000-4000-9004-000000000001", "fase": "00000000-0000-4000-9003-000000000001", "codigo": "ZZ8-01", "nome": "Voo local", "mis": "Voo Local", "eq": "C152", "nb": 1, "regra": "ordem", "requer": [], "dispensada": false, "avaliacao": false},
     {"id": "00000000-0000-4000-9004-000000000002", "fase": "00000000-0000-4000-9003-000000000001", "codigo": "ZZ8-02", "nome": "Navegação", "mis": "Navegação", "eq": "C152", "nb": 2.5, "regra": "ordem", "requer": [], "dispensada": false, "avaliacao": false}]},
  {"sigla": "ZZ7", "fases": [], "missoes": []}]'::jsonb $$;

-- O resultado de uma consulta (um jsonb), com o que ela gravou desfeito: as verificações seguintes partem do mesmo estado
create function pg_temp.desfeito(p_sql text)
  returns jsonb language plpgsql as $$
declare
  v_resultado jsonb;
begin
  begin
    execute p_sql into v_resultado;
    raise exception 'pg_temp.desfeito';
  exception when others then
    if sqlerrm <> 'pg_temp.desfeito' then
      raise;
    end if;
  end;
  return v_resultado;
end;
$$;

-- Grava o ZZ9 (a partir da versão 1) e devolve a versão que a gravação deu e o trecho de cada missão que tem um, na
-- ordem do programa, como quem lê a escala recebe (programa_dos_cursos)
create function pg_temp.com_trechos(p_curso jsonb)
  returns jsonb language plpgsql as $$
declare
  v_retorno jsonb := public.salvar_curso('ZZ9', 1, p_curso, 'ZZ9: alteração de teste') -> 'versao';
begin
  return jsonb_build_object('retorno', v_retorno, 'trechos', (
    select coalesce(jsonb_agg(jsonb_build_array(m.e ->> 'codigo', m.e -> 'trecho') order by m.i), '[]'::jsonb)
    from jsonb_array_elements(public.programa_dos_cursos()) c, jsonb_array_elements(c -> 'missoes') with ordinality m(e, i)
    where c ->> 'sigla' = 'ZZ9' and m.e ? 'trecho'));
end;
$$;

-- Grava o ZZ9 com estes conteúdos, um depois do outro (a partir da versão 1), e devolve a última versão que a gravação deu
-- e o que cada missão que exige alguma habilitação do INVA exige, na ordem do programa, como quem lê a escala recebe
create function pg_temp.com_exige(variadic p_cursos jsonb[])
  returns jsonb language plpgsql as $$
declare
  v_versao integer := 1;
  v_curso jsonb;
begin
  foreach v_curso in array p_cursos loop
    v_versao := (public.salvar_curso('ZZ9', v_versao, v_curso, 'ZZ9: alteração de teste') ->> 'versao')::integer;
  end loop;
  return jsonb_build_object('retorno', v_versao, 'exige', (
    select coalesce(jsonb_agg(jsonb_build_array(m.e ->> 'codigo', m.e -> 'exige') order by m.i), '[]'::jsonb)
    from jsonb_array_elements(public.programa_dos_cursos()) c, jsonb_array_elements(c -> 'missoes') with ordinality m(e, i)
    where c ->> 'sigla' = 'ZZ9' and jsonb_array_length(m.e -> 'exige') > 0));
end;
$$;

-- O conteúdo sem a lista exige nas missões (como a aba de antes da migração 20261127110000 manda)
create function pg_temp.sem_exige(p_curso jsonb)
  returns jsonb language sql as $$
  select jsonb_set(p_curso, '{missoes}', (select coalesce(jsonb_agg(e - 'exige' order by i), '[]'::jsonb)
    from jsonb_array_elements(p_curso -> 'missoes') with ordinality t(e, i)))
$$;

-- O ZZ9 como ficou: a versão, o código de cada missão (por id) e se saiu do programa, e a última versão registrada
create function pg_temp.zz9()
  returns jsonb language sql as $$
  select jsonb_build_object(
    'versao', (select versao from public.cursos where sigla = 'ZZ9'),
    'missoes', (select jsonb_agg(jsonb_build_array(codigo, removida) order by id) from public.missoes_do_curso where curso = 'ZZ9'),
    'alteracao', (select jsonb_build_array(versao, descricao, registrado_por) from public.versoes_dos_cursos where curso = 'ZZ9' order by id desc limit 1))
$$;

-- Grava o ZZ9 (a versão lida e o conteúdo) e devolve a versão que a gravação deu e como ele ficou
create function pg_temp.gravar(p_versao integer, p_curso jsonb, p_descricao text default 'ZZ9: alteração de teste')
  returns jsonb language plpgsql as $$
declare
  v_retorno jsonb := public.salvar_curso('ZZ9', p_versao, p_curso, p_descricao) -> 'versao';
begin
  return jsonb_build_object('retorno', v_retorno) || pg_temp.zz9();
end;
$$;

-- Faz a conversão e devolve quantas missões vieram e como o ZZ8 ficou: a versão, as fases e as missões em ordem e a
-- última versão registrada
create function pg_temp.importar(p_cursos jsonb, p_versao integer)
  returns jsonb language plpgsql as $$
declare
  v_trazidas integer := public.importar_cursos(p_cursos, p_versao);
begin
  return jsonb_build_object('trazidas', v_trazidas,
    'versao', (select versao from public.cursos where sigla = 'ZZ8'),
    'fases', (select jsonb_agg(nome order by ordem) from public.fases_do_curso where curso = 'ZZ8'),
    'missoes', (select jsonb_agg(codigo order by ordem) from public.missoes_do_curso where curso = 'ZZ8'),
    'alteracao', (select jsonb_build_array(versao, descricao, registrado_por) from public.versoes_dos_cursos where curso = 'ZZ8' order by id desc limit 1));
end;
$$;

-- Estrutura
select has_table('public', 'cursos', 'tabela cursos existe');
select has_table('public', 'fases_do_curso', 'tabela fases_do_curso existe');
select has_table('public', 'missoes_do_curso', 'tabela missoes_do_curso existe');
select has_table('public', 'requisitos_das_fases', 'tabela requisitos_das_fases existe');
select has_table('public', 'requisitos_das_missoes', 'tabela requisitos_das_missoes existe');
select has_table('public', 'versoes_dos_cursos', 'tabela versoes_dos_cursos existe');
select ok((select relrowsecurity from pg_class where oid = 'public.cursos'::regclass), 'RLS ativo em cursos');
select ok((select relrowsecurity from pg_class where oid = 'public.fases_do_curso'::regclass), 'RLS ativo em fases_do_curso');
select ok((select relrowsecurity from pg_class where oid = 'public.missoes_do_curso'::regclass), 'RLS ativo em missoes_do_curso');
select ok((select relrowsecurity from pg_class where oid = 'public.requisitos_das_fases'::regclass), 'RLS ativo em requisitos_das_fases');
select ok((select relrowsecurity from pg_class where oid = 'public.requisitos_das_missoes'::regclass), 'RLS ativo em requisitos_das_missoes');
select ok((select relrowsecurity from pg_class where oid = 'public.versoes_dos_cursos'::regclass), 'RLS ativo em versoes_dos_cursos');
select policies_are('public', 'cursos', array['quem lê a escala lê os cursos'], 'cursos: lidos por quem lê a escala');
select policies_are('public', 'fases_do_curso', array['quem lê a escala lê as fases'], 'fases: lidas por quem lê a escala');
select policies_are('public', 'missoes_do_curso', array['quem lê a escala lê as missões'], 'missões: lidas por quem lê a escala');
select policies_are('public', 'requisitos_das_fases', array['quem lê a escala lê os requisitos'], 'requisitos das fases: lidos por quem lê a escala');
select policies_are('public', 'requisitos_das_missoes', array['quem lê a escala lê os requisitos'], 'requisitos das missões: lidos por quem lê a escala');
select policies_are('public', 'versoes_dos_cursos', array['quem lê a escala lê as versões'], 'versões: lidas por quem lê a escala');
select has_function('public', 'programa_dos_cursos', array[]::name[], 'função programa_dos_cursos existe');
select has_function('public', 'salvar_curso', array['text', 'integer', 'jsonb', 'text'], 'função salvar_curso existe');
select has_function('public', 'importar_cursos', array['jsonb', 'integer'], 'função importar_cursos existe');
select has_function('public', 'missao_e_recurso_validos', array['text', 'text', 'numeric'], 'função missao_e_recurso_validos existe');
select has_column('public', 'missoes_do_curso', 'trecho', 'coluna trecho (o trecho do Noturno) existe em missoes_do_curso');
-- O que a missão exige do INVA (migração 20261127110000): a lista, vazia em todas as missões que já estavam (regra a)
select has_column('public', 'missoes_do_curso', 'exige', 'coluna exige (o que a missão exige do INVA) existe em missoes_do_curso');
select col_type_is('public', 'missoes_do_curso', 'exige', 'text[]', 'exige é uma lista de textos');
select col_not_null('public', 'missoes_do_curso', 'exige', 'exige nunca é nula');
select col_has_default('public', 'missoes_do_curso', 'exige', 'exige começa vazia');
select has_function('public', 'exige_da_missao_valido', array['text[]'], 'função exige_da_missao_valido existe');
select is((select count(*)::integer from public.missoes_do_curso where exige <> '{}'), 0,
  'nenhuma missão do curso exige habilitação do INVA depois da migração (regra a)');
-- A conversão compara o programa sem o trecho do Noturno
select is(public.assinatura_do_programa(pg_temp.noturno()),
  public.assinatura_do_programa(pg_temp.noturno() #- '{missoes,4,trecho}' #- '{missoes,5,trecho}' #- '{missoes,6,trecho}'),
  'a assinatura do programa não conta o trecho do Noturno');
-- Cada gravação de um curso (a conversão do cadastro também) soma uma versão e registra uma linha em versoes_dos_cursos
select results_eq($$ select c.sigla, c.ordem, c.versao - (select count(*)::integer from public.versoes_dos_cursos v where v.curso = c.sigla)
                     from public.cursos c where c.sigla in ('PP', 'PC', 'INVA') order by c.ordem $$,
  $$ values ('PP', 0, 1), ('PC', 1, 1), ('INVA', 2, 1) $$, 'PP, PC e INVA vêm prontos, nesta ordem, na versão 1');

set local role authenticated;

-- Quem lê a escala lê os programas (num documento só); a TV e a conta sem perfil recebem a lista vazia
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000002","role":"authenticated"}', true);
select ok(jsonb_array_length(public.programa_dos_cursos()) >= 3, 'operador lê os programas dos cursos');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000001","role":"authenticated"}', true);
select ok(jsonb_array_length(public.programa_dos_cursos()) >= 3, 'administrador lê os programas dos cursos');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000003","role":"authenticated"}', true);
select ok(jsonb_array_length(public.programa_dos_cursos()) >= 3, 'gestor lê os programas dos cursos');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000004","role":"authenticated"}', true);
select ok(jsonb_array_length(public.programa_dos_cursos()) >= 3, 'secretaria lê os programas dos cursos');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000005","role":"authenticated"}', true);
select is(public.programa_dos_cursos(), '[]'::jsonb, 'a TV não lê os programas');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000006","role":"authenticated"}', true);
select is(public.programa_dos_cursos(), '[]'::jsonb, 'conta sem perfil não lê os programas');

-- O Administrador cria o ZZ9
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000001","role":"authenticated"}', true);
select is(pg_temp.gravar(0, pg_temp.programa(), 'Curso ZZ9 criado: Curso de teste'), '{"retorno": 1, "versao": 1,
  "missoes": [["ZZ9-01", false], ["ZZ9-02", false], ["ZZ9-03", false], ["ZZ9-04", false], ["ZZ9-05", false]],
  "alteracao": [1, "Curso ZZ9 criado: Curso de teste", "Administrador de teste"]}'::jsonb,
  'o Administrador cria um curso: versão 1, com quem gravou');

-- Um resultado em ZZ9-01: o código dela não muda mais
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000002","role":"authenticated"}', true);
select public.registrar_resultado(99001, 'ZZ9', 'ZZ9-01', 'aprovado', '2099-11-10', null) > 0 as registrado;

-- O gestor lê o programa como o app usa: as fases e as missões em ordem, a regra, os requisitos e as marcas
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000003","role":"authenticated"}', true);
select is((select e - 'alteracoes' from jsonb_array_elements(public.programa_dos_cursos()) e where e ->> 'sigla' = 'ZZ9'), '{
  "sigla": "ZZ9", "nome": "Curso de teste", "ordem": 999, "ativo": true, "versao": 1,
  "fases": [
    {"id": "00000000-0000-4000-9001-000000000001", "nome": "Fase 1 – Duplo comando", "modulo": "Módulo 01 – Treinamento", "ordem": 0, "regra": "ordem", "requer": [], "removida": false},
    {"id": "00000000-0000-4000-9001-000000000002", "nome": "Fase 2 – Solo", "modulo": "Módulo 01 – Treinamento", "ordem": 1, "regra": "ordem", "requer": [], "removida": false},
    {"id": "00000000-0000-4000-9001-000000000003", "nome": "Fase 3 – Noturno", "modulo": null, "ordem": 2, "regra": "depois", "requer": ["00000000-0000-4000-9001-000000000001"], "removida": false}
  ],
  "missoes": [
    {"id": "00000000-0000-4000-9002-000000000001", "fase": "00000000-0000-4000-9001-000000000001", "codigo": "ZZ9-01", "nome": "Primeiro voo", "mis": "Voo Local", "eq": "C152", "nb": 1, "ordem": 0, "regra": "ordem", "requer": [], "dispensada": false, "avaliacao": false, "exige": [], "removida": false, "comResultados": true},
    {"id": "00000000-0000-4000-9002-000000000002", "fase": "00000000-0000-4000-9001-000000000001", "codigo": "ZZ9-02", "nome": "Ground do C152", "mis": "Ground C152", "eq": "Sala Ground", "nb": 1.5, "ordem": 1, "regra": "livre", "requer": [], "dispensada": false, "avaliacao": false, "exige": [], "removida": false, "comResultados": false},
    {"id": "00000000-0000-4000-9002-000000000003", "fase": "00000000-0000-4000-9001-000000000002", "codigo": "ZZ9-03", "nome": "Adaptação", "mis": "Voo Local", "eq": "C152", "nb": 1, "ordem": 0, "regra": "ordem", "requer": [], "dispensada": true, "avaliacao": false, "exige": [], "removida": false, "comResultados": false},
    {"id": "00000000-0000-4000-9002-000000000004", "fase": "00000000-0000-4000-9001-000000000002", "codigo": "ZZ9-04", "nome": "Solo", "mis": "Voo Solo", "eq": "C152", "nb": 1, "ordem": 1, "regra": "depois", "requer": ["00000000-0000-4000-9002-000000000001"], "dispensada": false, "avaliacao": true, "exige": [], "removida": false, "comResultados": false},
    {"id": "00000000-0000-4000-9002-000000000005", "fase": "00000000-0000-4000-9001-000000000003", "codigo": "ZZ9-05", "nome": "Noturno", "mis": "Noturno", "eq": "C172", "nb": 3, "ordem": 0, "regra": "ordem", "requer": [], "dispensada": false, "avaliacao": false, "exige": [], "removida": false, "comResultados": false}
  ]}'::jsonb, 'o programa volta com as fases e as missões em ordem, os requisitos e quais missões já têm resultados');

-- O que o Administrador não grava (o ZZ9 continua na versão 1)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000001","role":"authenticated"}', true);
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 0, pg_temp.programa(), 'ZZ9: alteração de teste') $$), 'PT409 sigla',
  'criar um curso que já existe é conflito (PT409, sigla)');
select is(pg_temp.erro($$ select public.salvar_curso('z9', 0, '{"nome": "Curso inválido", "ativo": true, "fases": [], "missoes": []}', 'ZZ9: alteração de teste') $$),
  '22023 sigla', 'sigla fora do formato é recusada (22023, sigla)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ7', 1, '{"nome": "Curso que não existe", "ativo": true, "fases": [], "missoes": []}', 'ZZ9: alteração de teste') $$),
  'P0002', 'gravar um curso que não existe é recusado (P0002)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,1,codigo}', '"zz9 02"'), 'ZZ9: alteração de teste') $$),
  '22023 codigo', 'código fora do formato é recusado (22023, codigo)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,1,codigo}', '"ZZ9-01"'), 'ZZ9: alteração de teste') $$),
  '23505 codigo', 'código repetido no programa é recusado (23505, codigo)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,4,eq}', '"C152"'), 'ZZ9: alteração de teste') $$),
  '22023 mis', 'Noturno no C152 é recusado (22023, mis)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,1,nb}', '1'), 'ZZ9: alteração de teste') $$),
  '22023 mis', 'Ground com 1 h é recusado (22023, mis)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,0,nb}', '6'), 'ZZ9: alteração de teste') $$),
  '22023 mis', 'missão de 6 h é recusada (22023, mis)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1,
    jsonb_set(pg_temp.programa(), '{missoes,3,requer}', '["00000000-0000-4000-9002-000000000005"]'), 'ZZ9: alteração de teste') $$),
  '22023 requer', 'missão "depois de" uma missão posterior é recusada (22023, requer)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,4,regra}', '"depois"'), 'ZZ9: alteração de teste') $$),
  '22023 requer', '"depois de…" sem nenhuma missão é recusado (22023, requer)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1,
    jsonb_set(jsonb_set(pg_temp.programa(), '{fases,1,regra}', '"depois"'), '{fases,1,requer}', '["00000000-0000-4000-9001-000000000003"]'), 'ZZ9: alteração de teste') $$),
  '22023 requer', 'fase "depois de" uma fase posterior é recusada (22023, requer)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1,
    jsonb_set(pg_temp.programa(), '{missoes,4,fase}', '"00000000-0000-4000-9001-000000000009"'), 'ZZ9: alteração de teste') $$),
  '22023 fase', 'missão numa fase fora do programa é recusada (22023, fase)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{fases}', (pg_temp.programa() -> 'fases')
    || '[{"id": "00000000-0000-4000-9008-000000000001", "nome": "Fase de outro curso", "modulo": null, "regra": "ordem", "requer": []}]'), 'ZZ9: alteração de teste') $$),
  '22023 id', 'fase de outro curso é recusada (22023, id)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,0,codigo}', '"ZZ9-10"'), 'ZZ9: alteração de teste') $$),
  '23514 codigo', 'o código de uma missão com resultados não muda (23514, codigo)');
-- A descrição, o curso e os outros campos do programa: cada dica da gravação
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, pg_temp.programa(), '') $$),
  '22023 descricao', 'a descrição vazia é recusada (22023, descricao)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{nome}', '" "'), 'ZZ9: alteração de teste') $$),
  '22023 nome', 'o curso sem nome é recusado (22023, nome)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{ativo}', '"sim"'), 'ZZ9: alteração de teste') $$),
  '22023 ativo', '"ativo" fora de sim ou não é recusado (22023, ativo)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, pg_temp.programa() - 'missoes', 'ZZ9: alteração de teste') $$),
  '22023 limite', 'o programa sem a lista de missões é recusado (22023, limite)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1,
    jsonb_set(pg_temp.programa(), '{missoes,4,id}', '"00000000-0000-4000-9002-0000000000AB"'), 'ZZ9: alteração de teste') $$),
  '22023 id', 'id com letra maiúscula é recusado (22023, id)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{fases,1,nome}', '""'), 'ZZ9: alteração de teste') $$),
  '22023 nome', 'fase sem nome é recusada (22023, nome)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{fases,0,modulo}', '""'), 'ZZ9: alteração de teste') $$),
  '22023 modulo', 'módulo vazio é recusado (22023, modulo)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,0,regra}', '"sempre"'), 'ZZ9: alteração de teste') $$),
  '22023 regra', 'regra fora da lista é recusada (22023, regra)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,2,dispensada}', '"sim"'), 'ZZ9: alteração de teste') $$),
  '22023 dispensada', '"dispensada" fora de sim ou não é recusada (22023, dispensada)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,3,avaliacao}', '1'), 'ZZ9: alteração de teste') $$),
  '22023 avaliacao', '"avaliação" fora de sim ou não é recusada (22023, avaliacao)');
-- O Noturno em trechos: o que vale volta com o trecho de cada missão (e nada fica gravado); o resto é recusado
select is(pg_temp.desfeito($$ select pg_temp.com_trechos(pg_temp.noturno()) $$),
  '{"retorno": 2, "trechos": [["ZZ9-06", "ida"], ["ZZ9-05", "noite"], ["ZZ9-07", "volta"]]}'::jsonb,
  'o Noturno com a ida, a noite e a volta, juntas na fase');
select is(pg_temp.desfeito($$ select pg_temp.com_trechos(jsonb_set(pg_temp.programa(), '{missoes,4,trecho}', '"noite"')) $$),
  '{"retorno": 2, "trechos": [["ZZ9-05", "noite"]]}'::jsonb, 'o Noturno só com a noite');
select is(pg_temp.desfeito($$ select pg_temp.com_trechos(pg_temp.noturno() #- '{missoes,6}') $$),
  '{"retorno": 2, "trechos": [["ZZ9-06", "ida"], ["ZZ9-05", "noite"]]}'::jsonb, 'o Noturno com a ida e a noite, sem a volta');
select is(pg_temp.desfeito($$ select pg_temp.com_trechos(pg_temp.noturno() #- '{missoes,4}') $$),
  '{"retorno": 2, "trechos": [["ZZ9-05", "noite"], ["ZZ9-07", "volta"]]}'::jsonb, 'o Noturno com a noite e a volta, sem a ida');
-- O que a missão exige do INVA: a lista volta na leitura; sem ela, a missão fica com a que tinha (nada fica gravado)
select is(pg_temp.desfeito($$ select pg_temp.com_exige(jsonb_set(pg_temp.programa(), '{missoes,3,exige}', '["endosso_solo"]')) $$),
  '{"retorno": 2, "exige": [["ZZ9-04", ["endosso_solo"]]]}'::jsonb, 'a missão guarda as habilitações que exige do INVA');
select is(pg_temp.desfeito($$ select pg_temp.com_exige(jsonb_set(pg_temp.programa(), '{missoes,3,exige}', '["endosso_solo"]'),
    pg_temp.sem_exige(pg_temp.programa())) $$),
  '{"retorno": 3, "exige": [["ZZ9-04", ["endosso_solo"]]]}'::jsonb, 'a missão sem a lista exige fica com o que exigia do INVA');
select is(pg_temp.desfeito($$ select pg_temp.com_exige(jsonb_set(pg_temp.programa(), '{missoes,3,exige}', '["endosso_solo"]'), pg_temp.programa()) $$),
  '{"retorno": 3, "exige": []}'::jsonb, 'a lista exige vazia tira o que a missão exigia do INVA');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,3,exige}', '["Endosso Solo"]'), 'ZZ9: alteração de teste') $$),
  '22023 exige', 'exige com um id fora do formato é recusado (22023, exige)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,3,exige}',
    (select jsonb_agg('hab_' || n) from generate_series(0, 10) n)), 'ZZ9: alteração de teste') $$),
  '22023 exige', 'exige com mais de 10 habilitações é recusado (22023, exige)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.programa(), '{missoes,3,exige}', '"endosso_solo"'), 'ZZ9: alteração de teste') $$),
  '22023 exige', 'exige fora de uma lista é recusado (22023, exige)');
select is((select versao from public.cursos where sigla = 'ZZ9'), 1, 'e o ZZ9 continua na versão 1');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.noturno(), '{missoes,4,mis}', '"Navegação"'), 'ZZ9: alteração de teste') $$),
  '22023 trecho', 'trecho numa missão que não é Noturno é recusado (22023, trecho)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.noturno(), '{missoes,4,trecho}', '"translado"'), 'ZZ9: alteração de teste') $$),
  '22023 trecho', 'trecho fora da lista é recusado (22023, trecho)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.noturno() #- '{missoes,6}', '{missoes,5,trecho}', 'null'), 'ZZ9: alteração de teste') $$),
  '22023 trecho', 'a ida sem a noite logo depois é recusada (22023, trecho)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.noturno() #- '{missoes,4}', '{missoes,4,trecho}', 'null'), 'ZZ9: alteração de teste') $$),
  '22023 trecho', 'a volta sem a noite logo antes é recusada (22023, trecho)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.noturno(), '{missoes,6,trecho}', '"noite"'), 'ZZ9: alteração de teste') $$),
  '22023 trecho', 'duas noites no mesmo Noturno são recusadas (22023, trecho)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_insert(pg_temp.noturno(), '{missoes,6}',
    '{"id": "00000000-0000-4000-9002-000000000008", "fase": "00000000-0000-4000-9001-000000000003", "codigo": "ZZ9-08", "nome": "Voo local em BH", "mis": "Voo Local", "eq": "C172", "nb": 1}'),
    'ZZ9: alteração de teste') $$),
  '22023 trecho', 'outra missão no meio do Noturno é recusada (22023, trecho)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, jsonb_set(pg_temp.noturno(), '{missoes,4,fase}', '"00000000-0000-4000-9001-000000000002"'), 'ZZ9: alteração de teste') $$),
  '22023 trecho', 'o Noturno em duas fases é recusado (22023, trecho)');

-- Tirar, trocar e voltar: o que não vem sai do programa e fica guardado (com o código)
select is(pg_temp.gravar(1, pg_temp.programa() #- '{missoes,4}'), '{"retorno": 2, "versao": 2,
  "missoes": [["ZZ9-01", false], ["ZZ9-02", false], ["ZZ9-03", false], ["ZZ9-04", false], ["ZZ9-05", true]],
  "alteracao": [2, "ZZ9: alteração de teste", "Administrador de teste"]}'::jsonb,
  'a missão que não vem sai do programa, sem ser apagada');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 1, pg_temp.programa() #- '{missoes,4}', 'ZZ9: alteração de teste') $$), 'PT409',
  'gravar a partir de uma versão antiga é conflito (PT409)');
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 2, jsonb_set(pg_temp.programa(), '{missoes,4}', (pg_temp.programa() -> 'missoes' -> 4)
    || '{"id": "00000000-0000-4000-9002-000000000006", "nome": "Outro noturno"}'), 'ZZ9: alteração de teste') $$),
  '23505 codigo', 'o código de uma missão retirada fica reservado (23505, codigo)');
select is(pg_temp.gravar(2, pg_temp.trocados() #- '{missoes,4}'), '{"retorno": 3, "versao": 3,
  "missoes": [["ZZ9-01", false], ["ZZ9-03", false], ["ZZ9-02", false], ["ZZ9-04", false], ["ZZ9-05", true]],
  "alteracao": [3, "ZZ9: alteração de teste", "Administrador de teste"]}'::jsonb,
  'dois códigos trocam de missão numa gravação só');
select lives_ok($$ set constraints public.missoes_do_curso_codigo_unico immediate $$, 'e os códigos continuam únicos no curso');
select is(pg_temp.gravar(3, pg_temp.trocados()), '{"retorno": 4, "versao": 4,
  "missoes": [["ZZ9-01", false], ["ZZ9-03", false], ["ZZ9-02", false], ["ZZ9-04", false], ["ZZ9-05", false]],
  "alteracao": [4, "ZZ9: alteração de teste", "Administrador de teste"]}'::jsonb,
  'a missão retirada volta ao programa');
select is(pg_temp.gravar(4, jsonb_set(pg_temp.trocados(), '{missoes,3,removida}', 'true')), '{"retorno": 5, "versao": 5,
  "missoes": [["ZZ9-01", false], ["ZZ9-03", false], ["ZZ9-02", false], ["ZZ9-04", true], ["ZZ9-05", false]],
  "alteracao": [5, "ZZ9: alteração de teste", "Administrador de teste"]}'::jsonb,
  'a missão marcada como retirada também sai do programa');

-- Só o Administrador grava os cursos, e ninguém grava direto nas tabelas
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_curso('ZZ9', 5, pg_temp.programa(), 'ZZ9: alteração de teste') $$, '42501', null, 'o operador não grava os cursos');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_curso('ZZ9', 5, pg_temp.programa(), 'ZZ9: alteração de teste') $$, '42501', null, 'o gestor não grava os cursos');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000001","role":"authenticated"}', true);
select throws_ok($$ insert into public.cursos (sigla, nome) values ('ZZ6', 'Direto na tabela') $$, '42501', null, 'ninguém cria um curso direto na tabela');
select throws_ok($$ update public.missoes_do_curso set nome = 'Direto na tabela' where curso = 'ZZ9' $$, '42501', null, 'ninguém altera as missões direto');
select throws_ok($$ delete from public.versoes_dos_cursos where curso = 'ZZ9' $$, '42501', null, 'ninguém apaga as versões');

-- A tabela também guarda o trecho só numa missão Noturno
reset role;
select throws_ok($$ update public.missoes_do_curso set trecho = 'ida' where curso = 'ZZ9' and codigo = 'ZZ9-01' $$, '23514', null,
  'o trecho só fica numa missão Noturno, também direto na tabela');
select throws_ok($$ update public.missoes_do_curso set exige = array['Endosso Solo'] where curso = 'ZZ9' and codigo = 'ZZ9-01' $$, '23514', null,
  'a lista exige fica no formato, também direto na tabela');

-- A conversão única, com o cadastro ainda no formato de antes (um abaixo do formato dos cursos, na versão 7)
update public.documentos set conteudo = jsonb_build_object('esquema', public.formato_dos_cursos() - 1, 'stu', '[]'::jsonb, 'ins', '[]'::jsonb)
where chave = 'cadastro';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000001","role":"authenticated"}', true);
select is(pg_temp.erro($$ select public.salvar_curso('ZZ9', 5, jsonb_set(pg_temp.trocados(), '{missoes,3,removida}', 'true'), 'ZZ9: alteração de teste') $$),
  'PT409 formato', 'antes do formato dos cursos, o Administrador espera a conversão (PT409, formato)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.importar_cursos(pg_temp.legado(), 7) $$, '42501', null, 'o gestor não faz a conversão');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000002","role":"authenticated"}', true);
select is(pg_temp.desfeito($$ select pg_temp.importar(jsonb_build_array(pg_temp.legado() -> 0 #- '{missoes,1}', pg_temp.legado() -> 0), 7) $$),
  '{"trazidas": 3, "versao": 3, "fases": ["Programa"], "missoes": ["ZZ8-01", "ZZ8-02"], "alteracao": [3, "Programa trazido do cadastro (2 missões)", "Operador de teste"]}'::jsonb,
  'o mesmo curso duas vezes na conversão: vale a ordem da lista');
select is(pg_temp.importar(pg_temp.legado(), 7), '{"trazidas": 2, "versao": 2, "fases": ["Programa"], "missoes": ["ZZ8-01", "ZZ8-02"],
  "alteracao": [2, "Programa trazido do cadastro (2 missões)", "Operador de teste"]}'::jsonb,
  'o operador traz o programa do cadastro (antes do formato dos cursos, a versão lida)');
select is((select count(*)::integer from public.missoes_do_curso where curso = 'ZZ8' and exige <> '{}'), 0,
  'a conversão do cadastro traz as missões sem exigir nada do INVA');
select is(pg_temp.importar(pg_temp.legado(), 7), '{"trazidas": 0, "versao": 2, "fases": ["Programa"], "missoes": ["ZZ8-01", "ZZ8-02"],
  "alteracao": [2, "Programa trazido do cadastro (2 missões)", "Operador de teste"]}'::jsonb,
  'trazer o mesmo programa de novo não grava nada');
select is(pg_temp.erro($$ select public.importar_cursos(pg_temp.legado(), 6) $$), 'PT409', 'cadastro alterado depois da leitura é conflito (PT409)');
-- O cadastro convertido (no formato dos cursos)
reset role;
update public.documentos set conteudo = jsonb_build_object('esquema', public.formato_dos_cursos(), 'stu', '[]'::jsonb, 'ins', '[]'::jsonb)
where chave = 'cadastro';
select is((select public.esquema_do_conteudo(conteudo) from public.documentos where chave = 'cadastro'), public.formato_dos_cursos(),
  'o cadastro convertido está no formato dos cursos');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-000000000002","role":"authenticated"}', true);
select is(pg_temp.importar(jsonb_build_array(pg_temp.legado() -> 0 #- '{missoes,1}'), 7), '{"trazidas": 0, "versao": 2, "fases": ["Programa"],
  "missoes": ["ZZ8-01", "ZZ8-02"], "alteracao": [2, "Programa trazido do cadastro (2 missões)", "Operador de teste"]}'::jsonb,
  'no formato dos cursos, a conversão não grava mais nada');

-- O anônimo não lê
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.programa_dos_cursos() $$, '42501', null, 'anônimo não lê os programas');

select * from finish();
rollback;
