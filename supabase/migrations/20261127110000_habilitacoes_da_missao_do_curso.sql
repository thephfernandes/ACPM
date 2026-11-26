-- O que a missão do curso exige do INVA (o passo F1d da linha de produção, "missão do curso"; N2 e a regra a em
-- docs/PLAN.md). O registro das habilitações é um só (js/habilitacoes.js): o que o INVA tem (ins[].hab), o que o recurso
-- exige (frota[].exige) e o que a missão do curso exige são listas de ids dele.
-- - Coluna exige em public.missoes_do_curso: os ids que a missão exige do INVA, além do tipo de missão, do recurso e do
--   curso; até 10, cada um com letras minúsculas, números e _ (public.exige_da_missao_valido, também na tabela). Toda
--   missão começa vazia, e esta migração não marca nenhuma (regra a: o Pedro marca em Cursos, depois dos INVAs).
-- - public.programa_do_curso (a leitura, programa_dos_cursos, e a versão registrada) devolve a lista de cada missão.
-- - public.gravar_programa (salvar_curso e importar_cursos gravam por ela) confere e grava a lista (22023, exige). A
--   missão que vem sem a chave (ou com null) fica com a lista que tinha (a aba de antes, a conversão do cadastro); a nova,
--   vazia. A assinatura do programa (a conversão pula o programa igual) não conta a lista.
-- As verificações são as de supabase/tests/database/cursos.test.sql, com os casos de test/helpers/casos-do-programa.js.
create function public.exige_da_missao_valido(p_exige text[])
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select p_exige is not null and cardinality(p_exige) <= 10
    and not exists (select 1 from unnest(p_exige) h where h is null or h !~ '^[a-z0-9_]{1,40}$')
$$;
revoke execute on function public.exige_da_missao_valido(text[]) from public, anon, authenticated;

alter table public.missoes_do_curso
  add column exige text[] not null default '{}',
  add constraint missoes_do_curso_exige check (public.exige_da_missao_valido(exige));
comment on column public.missoes_do_curso.exige is 'As habilitações (ids do registro do app, js/habilitacoes.js) que a missão exige do INVA, além das do tipo de missão e do recurso; até 10. Vazia até ser marcada em Cursos.';

-- Um curso no formato do app, agora com o que cada missão exige do INVA (exige)
create or replace function public.programa_do_curso(p_sigla text)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select jsonb_build_object(
    'sigla', c.sigla, 'nome', c.nome, 'ordem', c.ordem, 'ativo', c.ativo, 'versao', c.versao,
    'fases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'nome', f.nome, 'modulo', f.modulo, 'ordem', f.ordem, 'regra', f.regra,
        'requer', coalesce((select jsonb_agg(r.requer order by g.ordem, r.requer)
          from public.requisitos_das_fases r join public.fases_do_curso g on g.id = r.requer where r.fase = f.id), '[]'::jsonb),
        'removida', f.removida) order by f.removida, f.ordem, f.id)
      from public.fases_do_curso f where f.curso = c.sigla), '[]'::jsonb),
    'missoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'fase', m.fase, 'codigo', m.codigo, 'nome', m.nome, 'mis', m.tipo_de_missao, 'eq', m.recurso, 'nb', m.horas,
        'ordem', m.ordem, 'regra', m.regra,
        'requer', coalesce((select jsonb_agg(r.requer order by gf.ordem, g.ordem, r.requer)
          from public.requisitos_das_missoes r join public.missoes_do_curso g on g.id = r.requer
          join public.fases_do_curso gf on gf.id = g.fase where r.missao = m.id), '[]'::jsonb),
        'dispensada', m.dispensada, 'avaliacao', m.avaliacao, 'exige', to_jsonb(m.exige), 'removida', m.removida,
        -- Os códigos com resultados, numa consulta só (pelo índice de curso e missão)
        'comResultados', m.codigo in (select x.missao from public.resultados_de_missao x where x.curso = p_sigla))
        || case when m.trecho is null then '{}'::jsonb else jsonb_build_object('trecho', m.trecho) end
        order by m.removida, f.ordem, m.ordem, m.id)
      from public.missoes_do_curso m join public.fases_do_curso f on f.id = m.fase where m.curso = c.sigla), '[]'::jsonb),
    'alteracoes', coalesce((
      select jsonb_agg(jsonb_build_object('versao', v.versao, 'descricao', v.descricao, 'registrado_em', v.registrado_em,
        'registrado_por', v.registrado_por) order by v.id desc)
      from (select * from public.versoes_dos_cursos where curso = c.sigla order by id desc limit 20) v), '[]'::jsonb))
  from public.cursos c where c.sigla = p_sigla
$$;
revoke execute on function public.programa_do_curso(text) from public, anon, authenticated;

-- Confere e grava o programa de um curso, agora com o que cada missão exige do INVA (exige: pode faltar)
create or replace function public.gravar_programa(p_sigla text, p_curso jsonb, p_substituir boolean)
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_fases jsonb := p_curso -> 'fases';
  v_missoes jsonb := p_curso -> 'missoes';
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_codigo text;
  -- O que cada missão guardada exige do INVA (pelo id), lido antes de gravar: a missão que vem sem a lista fica com o dela
  v_exige jsonb;
begin
  -- 1. Listas de objetos (sempre as duas: sem elas, o programa inteiro sairia); no máximo 50 fases e 200 missões
  if jsonb_typeof(v_fases) is distinct from 'array' or jsonb_typeof(v_missoes) is distinct from 'array'
     or exists (select 1 from jsonb_array_elements(v_fases) e where jsonb_typeof(e) <> 'object')
     or exists (select 1 from jsonb_array_elements(v_missoes) e where jsonb_typeof(e) <> 'object') then
    raise exception 'as fases e as missões do programa vão em listas' using errcode = '22023', hint = 'limite';
  end if;
  v_fases := coalesce((select jsonb_agg(e order by i) from jsonb_array_elements(v_fases) with ordinality t(e, i)
    where e -> 'removida' is distinct from 'true'::jsonb), '[]'::jsonb);
  v_missoes := coalesce((select jsonb_agg(e order by i) from jsonb_array_elements(v_missoes) with ordinality t(e, i)
    where e -> 'removida' is distinct from 'true'::jsonb), '[]'::jsonb);
  if jsonb_array_length(v_fases) > 50 or jsonb_array_length(v_missoes) > 200 then
    raise exception 'o programa tem no máximo 50 fases e 200 missões' using errcode = '22023', hint = 'limite';
  end if;

  -- 2. Os ids: uuid em minúsculas, sem repetir no programa e de nenhum outro curso (antes de gravar qualquer coisa)
  if exists (select 1 from (select e -> 'id' as id from jsonb_array_elements(v_fases) e
                            union all select e -> 'id' from jsonb_array_elements(v_missoes) e) x
             where jsonb_typeof(x.id) is distinct from 'string' or (x.id #>> '{}') !~ v_uuid) then
    raise exception 'cada fase e cada missão do programa têm um id (uuid)' using errcode = '22023', hint = 'id';
  end if;
  if exists (select 1 from (select e -> 'id' as id from jsonb_array_elements(v_fases) e
                            union all select e -> 'id' from jsonb_array_elements(v_missoes) e) x
             group by x.id having count(*) > 1) then
    raise exception 'o mesmo id aparece mais de uma vez no programa' using errcode = '22023', hint = 'id';
  end if;
  if exists (select 1 from jsonb_array_elements(v_fases) e join public.fases_do_curso f on f.id = (e ->> 'id')::uuid where f.curso <> p_sigla)
     or exists (select 1 from jsonb_array_elements(v_missoes) e join public.missoes_do_curso m on m.id = (e ->> 'id')::uuid where m.curso <> p_sigla) then
    raise exception 'o programa do curso % traz uma fase ou uma missão de outro curso', p_sigla using errcode = '22023', hint = 'id';
  end if;

  -- 3. Os campos, um de cada vez (o módulo, a regra, os requisitos, "dispensada" e "avaliação" podem faltar: sem módulo,
  -- "depois das anteriores", nenhum, não e não)
  if exists (select 1 from jsonb_array_elements(v_fases) e
             where jsonb_typeof(e -> 'nome') is distinct from 'string' or char_length(btrim(e ->> 'nome')) not between 1 and 80) then
    raise exception 'o nome da fase vai de 1 a 80 caracteres' using errcode = '22023', hint = 'nome';
  end if;
  if exists (select 1 from jsonb_array_elements(v_fases) e
             where coalesce(jsonb_typeof(e -> 'modulo'), 'null') <> 'null'
               and (jsonb_typeof(e -> 'modulo') <> 'string' or char_length(btrim(e ->> 'modulo')) not between 1 and 80)) then
    raise exception 'o módulo da fase vai de 1 a 80 caracteres' using errcode = '22023', hint = 'modulo';
  end if;
  if exists (select 1 from jsonb_array_elements(v_fases) e where coalesce(e ->> 'regra', 'ordem') not in ('ordem', 'livre', 'depois')) then
    raise exception 'a regra da fase é "ordem", "livre" ou "depois"' using errcode = '22023', hint = 'regra';
  end if;
  if exists (select 1 from jsonb_array_elements(v_missoes) e
             where not exists (select 1 from jsonb_array_elements(v_fases) f where f -> 'id' = e -> 'fase')) then
    raise exception 'cada missão fica numa fase do programa' using errcode = '22023', hint = 'fase';
  end if;
  select coalesce(e ->> 'codigo', '') into v_codigo from jsonb_array_elements(v_missoes) e
  where jsonb_typeof(e -> 'codigo') is distinct from 'string' or e ->> 'codigo' !~ '^[A-Z0-9][A-Z0-9.-]{0,14}$'
  limit 1;
  if found then
    raise exception 'código de missão inválido: "%" (letras maiúsculas, números, ponto e hífen, até 15)', v_codigo
      using errcode = '22023', hint = 'codigo';
  end if;
  if exists (select 1 from jsonb_array_elements(v_missoes) e
             where jsonb_typeof(e -> 'nome') is distinct from 'string' or char_length(btrim(e ->> 'nome')) not between 1 and 80) then
    raise exception 'o nome da missão vai de 1 a 80 caracteres' using errcode = '22023', hint = 'nome';
  end if;
  select e ->> 'codigo' into v_codigo from jsonb_array_elements(v_missoes) e
  where case when jsonb_typeof(e -> 'nb') = 'number'
          then public.missao_e_recurso_validos(e ->> 'mis', e ->> 'eq', round((e ->> 'nb')::numeric, 1)) is not true
          else true end
  limit 1;
  if found then
    raise exception 'a missão % não serve com esse recurso ou essas horas (o Ground é na Sala Ground, com 1,5 h; até 5 h)', v_codigo
      using errcode = '22023', hint = 'mis';
  end if;
  if exists (select 1 from jsonb_array_elements(v_missoes) e where coalesce(e ->> 'regra', 'ordem') not in ('ordem', 'livre', 'depois')) then
    raise exception 'a regra da missão é "ordem", "livre" ou "depois"' using errcode = '22023', hint = 'regra';
  end if;
  if exists (select 1 from jsonb_array_elements(v_missoes) e where coalesce(jsonb_typeof(e -> 'dispensada'), 'null') not in ('null', 'boolean')) then
    raise exception '"dispensada" é sim ou não' using errcode = '22023', hint = 'dispensada';
  end if;
  if exists (select 1 from jsonb_array_elements(v_missoes) e where coalesce(jsonb_typeof(e -> 'avaliacao'), 'null') not in ('null', 'boolean')) then
    raise exception '"avaliação" é sim ou não' using errcode = '22023', hint = 'avaliacao';
  end if;
  -- O que a missão exige do INVA (pode faltar: a missão fica com o que exigia; nova, nada): até 10 ids do registro das
  -- habilitações do app (letras minúsculas, números e _)
  if exists (select 1 from jsonb_array_elements(v_missoes) e
             where coalesce(jsonb_typeof(e -> 'exige'), 'null') <> 'null'
               and case when jsonb_typeof(e -> 'exige') <> 'array' then true
                        when jsonb_array_length(e -> 'exige') > 10 then true
                        else exists (select 1 from jsonb_array_elements(e -> 'exige') h
                                     where jsonb_typeof(h) <> 'string' or (h #>> '{}') !~ '^[a-z0-9_]{1,40}$') end) then
    raise exception 'a missão exige do INVA até 10 habilitações do registro (letras minúsculas, números e _)' using errcode = '22023', hint = 'exige';
  end if;
  -- O trecho do Noturno (pode faltar): a ida, a noite ou a volta, só numa missão Noturno. Na fase, as missões com trecho
  -- que vêm uma logo depois da outra são um Noturno só: a ida (se houver; nada com trecho antes dela, a noite logo
  -- depois), uma noite (antes dela, nada com trecho ou a ida; depois, nada com trecho ou a volta) e a volta (se houver; a
  -- noite logo antes, nada com trecho depois)
  if exists (select 1 from jsonb_array_elements(v_missoes) e
             where coalesce(jsonb_typeof(e -> 'trecho'), 'null') <> 'null'
               and (jsonb_typeof(e -> 'trecho') <> 'string' or e ->> 'trecho' not in ('ida', 'noite', 'volta') or e ->> 'mis' <> 'Noturno')) then
    raise exception 'o trecho do Noturno é "ida", "noite" ou "volta", e só numa missão Noturno' using errcode = '22023', hint = 'trecho';
  end if;
  if exists (
    select 1 from (
      select t.trecho, lag(t.trecho) over w as antes, lead(t.trecho) over w as depois
      from (select m.e ->> 'trecho' as trecho, m.e -> 'fase' as fase, m.i from jsonb_array_elements(v_missoes) with ordinality m(e, i)) t
      window w as (partition by t.fase order by t.i)) s
    where (s.trecho = 'ida' and (s.antes is not null or s.depois is distinct from 'noite'))
       or (s.trecho = 'noite' and (coalesce(s.antes, 'ida') <> 'ida' or coalesce(s.depois, 'volta') <> 'volta'))
       or (s.trecho = 'volta' and (s.antes is distinct from 'noite' or s.depois is not null))) then
    raise exception 'cada Noturno fica junto na fase: a ida (se houver), uma noite e a volta (se houver), nesta ordem, sem outra missão no meio'
      using errcode = '22023', hint = 'trecho';
  end if;

  -- 4. Os códigos não se repetem no programa nem com os das missões do curso que ficam fora dele (a retirada guarda o
  -- código); a restrição adiada da tabela é a rede de segurança
  select e ->> 'codigo' into v_codigo from jsonb_array_elements(v_missoes) e
  group by e ->> 'codigo' having count(*) > 1 order by 1 limit 1;
  if found then
    raise exception 'o código % aparece mais de uma vez no programa', v_codigo using errcode = '23505', hint = 'codigo';
  end if;
  if not p_substituir then
    select m.codigo into v_codigo from public.missoes_do_curso m
    where m.curso = p_sigla
      and not exists (select 1 from jsonb_array_elements(v_missoes) e where (e ->> 'id')::uuid = m.id)
      and exists (select 1 from jsonb_array_elements(v_missoes) e where e ->> 'codigo' = m.codigo)
    order by m.codigo limit 1;
    if found then
      raise exception 'o código % já é de outra missão do curso (a missão retirada guarda o código: volte com ela ao programa)', v_codigo
        using errcode = '23505', hint = 'codigo';
    end if;
  end if;

  -- 5. "Depois de…": ids do programa, do mesmo tipo, sem repetir e sempre anteriores (nunca o próprio item); e a regra
  -- "depois" tem pelo menos um, as outras nenhum
  if exists (
    select 1 from jsonb_array_elements(v_fases) with ordinality f(e, i)
    cross join lateral (select case when jsonb_typeof(f.e -> 'requer') = 'array' then f.e -> 'requer' else '[]'::jsonb end as lista) r
    where coalesce(jsonb_typeof(f.e -> 'requer'), 'null') not in ('null', 'array')
       or (coalesce(f.e ->> 'regra', 'ordem') = 'depois') <> (jsonb_array_length(r.lista) > 0)
       or exists (select 1 from jsonb_array_elements(r.lista) x
                  where not exists (select 1 from jsonb_array_elements(v_fases) with ordinality g(e, j) where g.e -> 'id' = x and g.j < f.i))
       or (select count(*) <> count(distinct x) from jsonb_array_elements(r.lista) x)) then
    raise exception 'uma fase "depois de…" espera fases anteriores do programa (e só ela espera)' using errcode = '22023', hint = 'requer';
  end if;
  if exists (
    with fases as (select f.e -> 'id' as id, f.i from jsonb_array_elements(v_fases) with ordinality f(e, i)),
    missoes as (
      select m.e, m.e -> 'id' as id, fa.i as fase, row_number() over (partition by fa.i order by m.i) as i
      from jsonb_array_elements(v_missoes) with ordinality m(e, i) join fases fa on fa.id = m.e -> 'fase')
    select 1 from missoes m
    cross join lateral (select case when jsonb_typeof(m.e -> 'requer') = 'array' then m.e -> 'requer' else '[]'::jsonb end as lista) r
    where coalesce(jsonb_typeof(m.e -> 'requer'), 'null') not in ('null', 'array')
       or (coalesce(m.e ->> 'regra', 'ordem') = 'depois') <> (jsonb_array_length(r.lista) > 0)
       or exists (select 1 from jsonb_array_elements(r.lista) x
                  where not exists (select 1 from missoes n where n.id = x and (n.fase, n.i) < (m.fase, m.i)))
       or (select count(*) <> count(distinct x) from jsonb_array_elements(r.lista) x)) then
    raise exception 'uma missão "depois de…" espera missões anteriores do programa (e só ela espera)' using errcode = '22023', hint = 'requer';
  end if;

  -- 6. O código de uma missão com resultados não muda (o nome muda)
  if not p_substituir then
    select m.codigo into v_codigo from public.missoes_do_curso m join jsonb_array_elements(v_missoes) e on (e ->> 'id')::uuid = m.id
    where m.curso = p_sigla and m.codigo <> e ->> 'codigo'
      and exists (select 1 from public.resultados_de_missao r where r.curso = p_sigla and r.missao = m.codigo)
    order by m.codigo limit 1;
    if found then
      raise exception 'a missão % já tem resultados: o código não muda (o nome muda)', v_codigo using errcode = '23514', hint = 'codigo';
    end if;
  end if;

  -- 7. A gravação. O que as missões guardadas exigem do INVA, antes de a conversão apagar o programa. Os requisitos são
  -- refeitos (as únicas linhas apagadas, fora da conversão)
  v_exige := coalesce((select jsonb_object_agg(m.id::text, to_jsonb(m.exige)) from public.missoes_do_curso m where m.curso = p_sigla), '{}'::jsonb);
  delete from public.requisitos_das_missoes where curso = p_sigla;
  delete from public.requisitos_das_fases where curso = p_sigla;
  -- 8. Na conversão do cadastro, o programa guardado sai inteiro (nada aponta para ele ainda)
  if p_substituir then
    delete from public.missoes_do_curso where curso = p_sigla;
    delete from public.fases_do_curso where curso = p_sigla;
  end if;
  insert into public.fases_do_curso as f (id, curso, nome, modulo, ordem, regra, removida)
  select (e ->> 'id')::uuid, p_sigla, e ->> 'nome', e ->> 'modulo', (i - 1)::integer, coalesce(e ->> 'regra', 'ordem'), false
  from jsonb_array_elements(v_fases) with ordinality t(e, i)
  on conflict (id) do update set nome = excluded.nome, modulo = excluded.modulo, ordem = excluded.ordem, regra = excluded.regra,
    removida = false
  where f.curso = p_sigla;
  insert into public.missoes_do_curso as m (id, curso, fase, codigo, nome, tipo_de_missao, recurso, horas, ordem, regra, dispensada,
    avaliacao, trecho, exige, removida)
  select (e ->> 'id')::uuid, p_sigla, (e ->> 'fase')::uuid, e ->> 'codigo', e ->> 'nome', e ->> 'mis', e ->> 'eq',
    round((e ->> 'nb')::numeric, 1), (row_number() over (partition by e ->> 'fase' order by i) - 1)::integer,
    coalesce(e ->> 'regra', 'ordem'), coalesce((e ->> 'dispensada')::boolean, false), coalesce((e ->> 'avaliacao')::boolean, false),
    e ->> 'trecho',
    array(select x.h from jsonb_array_elements_text(case when jsonb_typeof(e -> 'exige') = 'array' then e -> 'exige'
                                                        else coalesce(v_exige -> (e ->> 'id'), '[]'::jsonb) end) with ordinality x(h, n)
          order by x.n),
    false
  from jsonb_array_elements(v_missoes) with ordinality t(e, i)
  on conflict (id) do update set fase = excluded.fase, codigo = excluded.codigo, nome = excluded.nome,
    tipo_de_missao = excluded.tipo_de_missao, recurso = excluded.recurso, horas = excluded.horas, ordem = excluded.ordem,
    regra = excluded.regra, dispensada = excluded.dispensada, avaliacao = excluded.avaliacao, trecho = excluded.trecho,
    exige = excluded.exige, removida = false
  where m.curso = p_sigla;
  -- O que não veio sai do programa, sem ser apagado
  update public.fases_do_curso f set removida = true
  where f.curso = p_sigla and not f.removida
    and not exists (select 1 from jsonb_array_elements(v_fases) e where (e ->> 'id')::uuid = f.id);
  update public.missoes_do_curso m set removida = true
  where m.curso = p_sigla and not m.removida
    and not exists (select 1 from jsonb_array_elements(v_missoes) e where (e ->> 'id')::uuid = m.id);
  insert into public.requisitos_das_fases (curso, fase, requer)
  select p_sigla, (e ->> 'id')::uuid, (x #>> '{}')::uuid
  from jsonb_array_elements(v_fases) e, jsonb_array_elements(case when jsonb_typeof(e -> 'requer') = 'array' then e -> 'requer' else '[]'::jsonb end) x;
  insert into public.requisitos_das_missoes (curso, missao, requer)
  select p_sigla, (e ->> 'id')::uuid, (x #>> '{}')::uuid
  from jsonb_array_elements(v_missoes) e, jsonb_array_elements(case when jsonb_typeof(e -> 'requer') = 'array' then e -> 'requer' else '[]'::jsonb end) x;
  return jsonb_array_length(v_missoes);
end;
$$;
revoke execute on function public.gravar_programa(text, jsonb, boolean) from public, anon, authenticated;
