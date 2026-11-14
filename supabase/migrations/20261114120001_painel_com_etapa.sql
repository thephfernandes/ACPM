-- Fase 14: o quadro da TV da recepção mostra também a missão do curso de cada voo ("PP-07 · Navegação"), como o
-- Painel da Escala. O resto continua igual (fase 9): só o que o quadro mostra, com o aluno abreviado.
create or replace function public.painel_do_dia()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  dia jsonb;
begin
  if public.perfil_atual() is null then
    raise exception 'sem acesso ao painel' using errcode = '42501';
  end if;
  select conteudo into dia from public.dias where data = hoje;
  -- Dia ainda sem escala gravada: o quadro diz que não há escala
  if dia is null or jsonb_typeof(dia->'resultado') is distinct from 'object' or jsonb_typeof(dia->'resultado'->'out') is distinct from 'array' then
    return jsonb_build_object('data', hoje, 'voos', null, 'fStatus', '{}'::jsonb, 'fObs', '{}'::jsonb);
  end if;
  return jsonb_build_object(
    'data', hoje,
    'voos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fKey', o->>'fKey', 'classKey', o->>'classKey', 'isGround', coalesce(o->>'isGround' = 'true', false),
        'a', (o->>'a')::integer, 'b', (o->>'b')::integer, 'r', o->>'r', 'eqType', o->>'eqType',
        's', public.nome_curto(o->>'s'), 'ins', o->>'ins', 'mis', o->>'mis', 'etapa', o->>'etapa', 'status', o->>'status'
      ) order by (o->>'a')::integer, o->>'fKey')
      from jsonb_array_elements(dia->'resultado'->'out') o
      where jsonb_typeof(o) = 'object' and o->>'a' ~ '^[0-9]+$' and o->>'b' ~ '^[0-9]+$'
    ), '[]'::jsonb),
    'fStatus', case when jsonb_typeof(dia->'fStatus') = 'object' then dia->'fStatus' else '{}'::jsonb end,
    'fObs', coalesce((
      select jsonb_object_agg(chave, jsonb_strip_nulls(jsonb_build_object(
        'motivo', detalhe->>'motivo',
        'novoInicio', case when detalhe->>'novoInicio' ~ '^[0-9]+$' then (detalhe->>'novoInicio')::integer end)))
      from jsonb_each(case when jsonb_typeof(dia->'fObs') = 'object' then dia->'fObs' else '{}'::jsonb end) as e(chave, detalhe)
      where jsonb_typeof(detalhe) = 'object'
    ), '{}'::jsonb)
  );
end;
$$;
revoke execute on function public.painel_do_dia() from public, anon;
grant execute on function public.painel_do_dia() to authenticated;
