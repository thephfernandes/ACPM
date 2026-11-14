-- Fase 9: o quadro do dia para a TV da recepção (partidas e chegadas, como nos aeroportos). Qualquer perfil vê; a TV
-- (perfil "painel") só vê isto. Vai só o que o quadro mostra: os voos de hoje (horário de São Paulo) com o aluno
-- abreviado ("Maria S."), o instrutor, a missão, o recurso e os horários, o status de cada voo e, do detalhe do
-- status, o novo horário do atraso e a categoria do motivo do cancelamento (o texto livre não vai).

-- O primeiro nome e a inicial do último: "Maria Silva Santos" vira "Maria S."; um nome só fica inteiro
create function public.nome_curto(p_nome text)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select case when cardinality(partes) > 1 then partes[1] || ' ' || left(partes[cardinality(partes)], 1) || '.' else partes[1] end
  from (select regexp_split_to_array(trim(coalesce(p_nome, '')), '\s+') as partes) p
$$;
revoke execute on function public.nome_curto(text) from public, anon;
grant execute on function public.nome_curto(text) to authenticated;

create function public.painel_do_dia()
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
        's', public.nome_curto(o->>'s'), 'ins', o->>'ins', 'mis', o->>'mis', 'status', o->>'status'
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
