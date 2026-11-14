-- Fase 9: dados pessoais de alunos e instrutores (CPF, CANAC, nascimento, celular e e-mail), fora do cadastro. Só
-- operadores, administradores e a secretaria leem, e só a função salvar_dados_pessoais grava (ela valida tudo). O
-- cadastro (lido por todos os perfis da escala), o link compartilhado e o histórico nunca levam esses dados.

-- Os dois dígitos verificadores do CPF (11 dígitos, não todos iguais). Sem CPF (null), sem resposta
create function public.cpf_valido(p_cpf text)
  returns boolean
  language plpgsql
  immutable
  strict
  set search_path = ''
as $$
declare
  soma integer;
  resto integer;
begin
  if p_cpf !~ '^[0-9]{11}$' or translate(p_cpf, substr(p_cpf, 1, 1), '') = '' then
    return false;
  end if;
  for n in 9..10 loop
    soma := 0;
    for i in 1..n loop
      soma := soma + substr(p_cpf, i, 1)::integer * (n + 2 - i);
    end loop;
    resto := soma % 11;
    if (case when resto < 2 then 0 else 11 - resto end) <> substr(p_cpf, n + 1, 1)::integer then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create table public.dados_pessoais (
  tipo text not null check (tipo in ('aluno', 'instrutor')),
  id_cadastro integer not null check (id_cadastro > 0),
  cpf text check (public.cpf_valido(cpf)),
  canac text check (canac ~ '^[0-9]{6}$'),
  nascimento date check (nascimento >= date '1900-01-01'),
  celular text check (celular ~ '^[1-9]{2}9[0-9]{8}$'),
  email text check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  atualizado_em timestamptz not null default now(),
  atualizado_por text,
  primary key (tipo, id_cadastro)
);
comment on table public.dados_pessoais is 'Dados pessoais de alunos e instrutores (pelo id do cadastro). Gravação somente por public.salvar_dados_pessoais.';
-- CPF e CANAC não se repetem entre alunos (nem entre instrutores); um instrutor pode ter o CPF de um aluno
create unique index dados_pessoais_cpf_unico on public.dados_pessoais (tipo, cpf) where cpf is not null;
create unique index dados_pessoais_canac_unico on public.dados_pessoais (tipo, canac) where canac is not null;

alter table public.dados_pessoais enable row level security;
revoke all on public.dados_pessoais from anon;

-- Quem chama lê e grava dados pessoais? Operador (o administrador conta como operador) e secretaria
create function public.le_dados_pessoais()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(public.perfil_atual()::text in ('operador', 'secretaria'), false)
$$;
revoke execute on function public.le_dados_pessoais() from public, anon;
grant execute on function public.le_dados_pessoais() to authenticated;

create policy "operadores e secretaria leem" on public.dados_pessoais
  for select to authenticated
  using ((select public.le_dados_pessoais()));

-- Grava os dados pessoais de um aluno ou instrutor. Os campos chegam como texto (com ou sem pontuação); campo vazio
-- fica vazio, e sem nenhum dado a linha sai. A mensagem de cada erro diz o campo; a dica (hint) também.
create function public.salvar_dados_pessoais(p_tipo text, p_id integer, p_dados jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_cpf text := nullif(regexp_replace(coalesce(p_dados->>'cpf', ''), '[^0-9]', '', 'g'), '');
  v_canac text := nullif(regexp_replace(coalesce(p_dados->>'canac', ''), '[^0-9]', '', 'g'), '');
  v_nascimento_texto text := nullif(trim(coalesce(p_dados->>'nascimento', '')), '');
  v_nascimento date;
  v_celular text := nullif(regexp_replace(coalesce(p_dados->>'celular', ''), '[^0-9]', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_dados->>'email', ''))), '');
  v_quem text := case when p_tipo = 'aluno' then 'aluno' else 'instrutor' end;
begin
  if not public.le_dados_pessoais() then
    raise exception 'somente operadores e a secretaria alteram dados pessoais' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('aluno', 'instrutor') or p_id is null or p_id <= 0 then
    raise exception 'aluno ou instrutor inválido' using errcode = '22023';
  end if;
  if v_cpf is not null and not public.cpf_valido(v_cpf) then
    raise exception 'CPF inválido' using errcode = '22023', hint = 'cpf';
  end if;
  if v_canac is not null and v_canac !~ '^[0-9]{6}$' then
    raise exception 'o CANAC tem 6 dígitos' using errcode = '22023', hint = 'canac';
  end if;
  if v_nascimento_texto is not null then
    if v_nascimento_texto !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'data de nascimento inválida' using errcode = '22023', hint = 'nascimento';
    end if;
    begin
      v_nascimento := v_nascimento_texto::date;
    exception when others then
      raise exception 'data de nascimento inválida' using errcode = '22023', hint = 'nascimento';
    end;
    if v_nascimento < date '1900-01-01' or v_nascimento > (now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'data de nascimento inválida' using errcode = '22023', hint = 'nascimento';
    end if;
  end if;
  if v_celular is not null and v_celular !~ '^[1-9]{2}9[0-9]{8}$' then
    raise exception 'celular inválido (DDD e 9 dígitos)' using errcode = '22023', hint = 'celular';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'e-mail inválido' using errcode = '22023', hint = 'email';
  end if;
  if v_cpf is not null and exists (select 1 from public.dados_pessoais where tipo = p_tipo and cpf = v_cpf and id_cadastro <> p_id) then
    raise exception 'CPF já cadastrado para outro %', v_quem using errcode = '23505', hint = 'cpf';
  end if;
  if v_canac is not null and exists (select 1 from public.dados_pessoais where tipo = p_tipo and canac = v_canac and id_cadastro <> p_id) then
    raise exception 'CANAC já cadastrado para outro %', v_quem using errcode = '23505', hint = 'canac';
  end if;

  if v_cpf is null and v_canac is null and v_nascimento is null and v_celular is null and v_email is null then
    delete from public.dados_pessoais where tipo = p_tipo and id_cadastro = p_id;
    return;
  end if;
  insert into public.dados_pessoais (tipo, id_cadastro, cpf, canac, nascimento, celular, email, atualizado_em, atualizado_por)
  values (p_tipo, p_id, v_cpf, v_canac, v_nascimento, v_celular, v_email, now(),
    (select coalesce(nullif(p.nome, ''), u.email) from auth.users u left join public.perfis p on p.usuario = u.id where u.id = auth.uid()))
  on conflict (tipo, id_cadastro) do update set
    cpf = excluded.cpf, canac = excluded.canac, nascimento = excluded.nascimento, celular = excluded.celular,
    email = excluded.email, atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por;
end;
$$;
revoke execute on function public.salvar_dados_pessoais(text, integer, jsonb) from public, anon;
grant execute on function public.salvar_dados_pessoais(text, integer, jsonb) to authenticated;
