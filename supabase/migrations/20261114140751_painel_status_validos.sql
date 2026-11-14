-- Revisão de 14/11: quem tem uma conta de operador consegue gravar qualquer coisa no dia pela API. O quadro da TV leva
-- só o que está no formato do app: os status da lista ("Pousou" já vale; o desconhecido da linha vira "Confirmado"),
-- as chaves de voo, os motivos da lista e os horários do dia, com os textos cortados. A linha sem chave de voo ou sem
-- horário válido no dia sai, e um número fora do formato não derruba mais o quadro. O resto continua igual (fases 9 e
-- 14): só o que o quadro mostra, com o aluno abreviado.
create or replace function public.painel_do_dia()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  status_validos constant text[] := array['Pendente', 'Confirmado', 'Atrasado', 'Em Voo', 'Cancelado', 'Pousou'];
  motivos constant text[] := array['Meteorologia', 'Manutenção da aeronave', 'Aluno ausente', 'Instrutor indisponível', 'Operacional', 'Outro'];
  chave_do_voo constant text := '^[0-9]{1,12}_[0-9]{1,6}_[0-9]{1,6}$';
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
        'fKey', o->>'fKey', 'classKey', left(o->>'classKey', 80), 'isGround', coalesce(o->>'isGround' = 'true', false),
        'a', h.a, 'b', h.b, 'r', left(o->>'r', 15), 'eqType', left(o->>'eqType', 30),
        's', left(public.nome_curto(left(o->>'s', 200)), 80), 'ins', left(o->>'ins', 80), 'mis', left(o->>'mis', 60),
        'etapa', case when o->>'etapa' ~ '^[A-Z0-9][A-Z0-9.-]{0,14}$' then o->>'etapa' end,
        'status', case when o->>'status' = any (status_validos) then o->>'status' else 'Confirmado' end
      ) order by h.a, o->>'fKey')
      from jsonb_array_elements(dia->'resultado'->'out') o
      -- Os horários só viram número quando têm até 4 dígitos (o case garante a ordem: o número grande não chega ao cast)
      cross join lateral (select
        case when o->>'a' ~ '^[0-9]{1,4}$' then (o->>'a')::integer end as a,
        case when o->>'b' ~ '^[0-9]{1,4}$' then (o->>'b')::integer end as b) h
      where jsonb_typeof(o) = 'object' and o->>'fKey' ~ chave_do_voo and h.a < h.b and h.b <= 1440
    ), '[]'::jsonb),
    'fStatus', coalesce((
      select jsonb_object_agg(chave, status)
      from jsonb_each_text(case when jsonb_typeof(dia->'fStatus') = 'object' then dia->'fStatus' else '{}'::jsonb end) as e(chave, status)
      where chave ~ chave_do_voo and status = any (status_validos)
    ), '{}'::jsonb),
    -- Do detalhe do status, só a categoria do motivo (da lista, sem o texto livre) e o novo horário (no dia)
    'fObs', coalesce((
      select jsonb_object_agg(chave, detalhe)
      from (
        select chave, jsonb_strip_nulls(jsonb_build_object(
          'motivo', case when d->>'motivo' = any (motivos) then d->>'motivo' end,
          'novoInicio', case when d->>'novoInicio' ~ '^[0-9]{1,4}$' then
            case when (d->>'novoInicio')::integer between 1 and 1439 then (d->>'novoInicio')::integer end end)) as detalhe
        from jsonb_each(case when jsonb_typeof(dia->'fObs') = 'object' then dia->'fObs' else '{}'::jsonb end) as e(chave, d)
        where chave ~ chave_do_voo and jsonb_typeof(d) = 'object'
      ) limpos
      where detalhe <> '{}'::jsonb
    ), '{}'::jsonb)
  );
end;
$$;
revoke execute on function public.painel_do_dia() from public, anon;
grant execute on function public.painel_do_dia() to authenticated;
