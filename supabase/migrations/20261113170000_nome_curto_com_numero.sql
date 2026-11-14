-- Fase 9: no quadro da TV, um número no fim do nome fica inteiro ("Aluno 12", e não "Aluno 1."); o resto continua
-- como antes (o primeiro nome e a inicial do último; um nome só fica inteiro).
create or replace function public.nome_curto(p_nome text)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select case
    when cardinality(partes) < 2 then partes[1]
    when partes[cardinality(partes)] ~ '[0-9]' then partes[1] || ' ' || partes[cardinality(partes)]
    else partes[1] || ' ' || left(partes[cardinality(partes)], 1) || '.'
  end
  from (select regexp_split_to_array(trim(coalesce(p_nome, '')), '\s+') as partes) p
$$;
