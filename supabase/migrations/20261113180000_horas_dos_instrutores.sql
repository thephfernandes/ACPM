-- Fase 11: as horas de voo de cada instrutor antes de uma data (no mês, no semestre e no ano dela, pelo calendário) e o
-- fim do último compromisso (voo, simulador ou Ground) na véspera, a partir das escalas gravadas: só voo em avião (C152,
-- C172 e PA-34), sem os cancelados. O app usa para os limites da Lei do Aeronauta (js/limites.js faz a mesma conta no
-- modo local). Quem não lê as escalas (a TV, perfil "painel") recebe um resultado vazio.
create function public.horas_dos_instrutores(p_data date)
  returns jsonb
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  with voos as (
    select d.data, o
    from public.dias d,
      jsonb_array_elements(case when jsonb_typeof(d.conteudo->'resultado'->'out') = 'array' then d.conteudo->'resultado'->'out' else '[]'::jsonb end) o
    where d.data < p_data
      and d.data >= least(date_trunc('year', p_data)::date, p_data - 1)
      and jsonb_typeof(o) = 'object'
      and coalesce(d.conteudo->'fStatus'->>(o->>'fKey'), o->>'status', 'Confirmado') <> 'Cancelado'
  ),
  horas as (
    select o->>'insId' as ins,
      sum((o->>'h')::numeric) filter (where date_trunc('month', data) = date_trunc('month', p_data)) as mes,
      sum((o->>'h')::numeric) filter (where (extract(month from data) <= 6) = (extract(month from p_data) <= 6)) as semestre,
      sum((o->>'h')::numeric) as ano
    from voos
    where data >= date_trunc('year', p_data) and o->>'eqType' in ('C152', 'C172', 'PA-34')
    group by 1
  ),
  vespera as (
    select o->>'insId' as ins, max((o->>'b')::integer) as fim
    from voos
    where data = p_data - 1
    group by 1
  )
  select coalesce(jsonb_object_agg(coalesce(h.ins, v.ins), jsonb_build_object(
    'mes', round(coalesce(h.mes, 0), 1), 'semestre', round(coalesce(h.semestre, 0), 1), 'ano', round(coalesce(h.ano, 0), 1),
    'fimAnterior', v.fim)), '{}'::jsonb)
  from horas h full join vespera v on v.ins = h.ins
$$;
revoke execute on function public.horas_dos_instrutores(date) from public, anon;
grant execute on function public.horas_dos_instrutores(date) to authenticated;
