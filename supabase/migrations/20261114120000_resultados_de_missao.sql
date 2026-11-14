-- Fase 14: o resultado de cada missão dos cursos (PP, PC e INVA), registrado pelo operador na escala. A tabela só
-- cresce: um registro novo vale por cima do anterior (a situação da missão é o último registro, e "pendente" desfaz um
-- engano), e ninguém grava direto, altera nem apaga. Quem lê a escala lê os resultados; grava-se só por
-- public.registrar_resultado.
create table public.resultados_de_missao (
  id bigint generated always as identity primary key,
  aluno integer not null check (aluno > 0),
  curso text not null check (curso in ('PP', 'PC', 'INVA')),
  missao text not null check (missao ~ '^[A-Z0-9][A-Z0-9.-]{0,14}$'),
  resultado text not null check (resultado in ('aprovado', 'reprovado', 'pendente')),
  data date not null,
  voo text check (voo ~ '^[0-9]+_[0-9]+_[0-9]+$'),
  registrado_em timestamptz not null default now(),
  registrado_por text
);
comment on table public.resultados_de_missao is 'Resultados das missões dos cursos (só acréscimo; vale o último de cada aluno, curso e missão). Gravação somente por public.registrar_resultado.';
create index resultados_de_missao_por_missao on public.resultados_de_missao (aluno, curso, missao, id desc);
create index resultados_de_missao_por_data on public.resultados_de_missao (data);

alter table public.resultados_de_missao enable row level security;
revoke all on public.resultados_de_missao from anon;
revoke insert, update, delete, truncate on public.resultados_de_missao from authenticated;

create policy "quem lê a escala lê os resultados" on public.resultados_de_missao
  for select to authenticated
  using ((select public.le_a_escala()));

-- Registra o resultado de uma missão (o operador; o administrador conta como operador). O código da missão vira
-- maiúsculo; o voo é a chave dele na escala da data (aluno_missão_sessão), quando houver
create function public.registrar_resultado(p_aluno integer, p_curso text, p_missao text, p_resultado text, p_data date, p_voo text)
  returns bigint
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  novo bigint;
begin
  if public.perfil_atual() is distinct from 'operador' then
    raise exception 'somente operadores registram resultados' using errcode = '42501';
  end if;
  insert into public.resultados_de_missao (aluno, curso, missao, resultado, data, voo, registrado_por)
  values (p_aluno, p_curso, upper(trim(p_missao)), p_resultado, p_data, p_voo,
    (select coalesce(nullif(p.nome, ''), u.email) from auth.users u left join public.perfis p on p.usuario = u.id where u.id = auth.uid()))
  returning id into novo;
  return novo;
end;
$$;
revoke execute on function public.registrar_resultado(integer, text, text, text, date, text) from public, anon;
grant execute on function public.registrar_resultado(integer, text, text, text, date, text) to authenticated;

-- A situação de cada missão: o último registro de cada aluno, curso e missão, num documento só (sem o limite de linhas
-- da API). Quem não lê a escala recebe a lista vazia
create function public.situacao_das_missoes()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select case when public.le_a_escala() then coalesce(jsonb_agg(jsonb_build_object(
      'aluno', r.aluno, 'curso', r.curso, 'missao', r.missao, 'resultado', r.resultado, 'data', r.data, 'voo', r.voo,
      'registrado_em', r.registrado_em, 'registrado_por', r.registrado_por) order by r.aluno, r.curso, r.missao), '[]'::jsonb)
    else '[]'::jsonb end
  from (select distinct on (aluno, curso, missao) * from public.resultados_de_missao order by aluno, curso, missao, id desc) r
$$;
revoke execute on function public.situacao_das_missoes() from public, anon;
grant execute on function public.situacao_das_missoes() to authenticated;
