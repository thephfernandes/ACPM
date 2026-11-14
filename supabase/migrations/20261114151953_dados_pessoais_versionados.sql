-- Revisão de 14/11: os dados pessoais.
-- - A gravação leva a versão lida (atualizado_em; null quando a pessoa ainda não tinha dados): se outra pessoa gravou
--   antes, é recusada (PT409), em vez de apagar o que a outra pessoa gravou. A data de atualização usa o relógio (e não
--   o início da transação), para cada gravação ter a sua.
-- - Só vale para quem está no cadastro (P0002).
-- - A própria função registra no histórico da data (p_data) os nomes dos campos que mudaram, nunca os valores: a
--   alteração da secretaria (que não grava o histórico da escala) também fica registrada.
-- - Quem sai do cadastro leva os dados pessoais junto: ao gravar o cadastro, os dados de quem não está mais nele saem
--   (o que já sobrou de pessoas excluídas antes sai na próxima gravação do cadastro).
-- - A versão antiga, salvar_dados_pessoais(text, integer, jsonb), continua até o app novo estar no ar: o app anterior
--   ainda a chama. Uma migração depois do merge a tira.

create function public.salvar_dados_pessoais(p_tipo text, p_id integer, p_dados jsonb, p_atualizado_em timestamptz, p_data date)
  returns jsonb
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
  v_nome text;
  v_atual public.dados_pessoais;
  v_alterados text[];
  v_autor text := (select coalesce(nullif(p.nome, ''), u.email) from auth.users u left join public.perfis p on p.usuario = u.id where u.id = auth.uid());
  v_agora timestamptz := clock_timestamp();
  v_historico jsonb := null;
  v_descricao text;
  v_id bigint;
begin
  if not public.le_dados_pessoais() then
    raise exception 'somente operadores e a secretaria alteram dados pessoais' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('aluno', 'instrutor') or p_id is null or p_id <= 0 then
    raise exception 'aluno ou instrutor inválido' using errcode = '22023';
  end if;

  -- A pessoa no cadastro (o nome vai para o histórico)
  select left(p ->> 'nm', 80) into v_nome
  from public.documentos d, jsonb_array_elements(case when jsonb_typeof(d.conteudo -> (case when p_tipo = 'aluno' then 'stu' else 'ins' end)) = 'array'
    then d.conteudo -> (case when p_tipo = 'aluno' then 'stu' else 'ins' end) else '[]'::jsonb end) p
  where d.chave = 'cadastro' and p ->> 'id' = p_id::text
  limit 1;
  if not found then
    raise exception '% que não está no cadastro', v_quem using errcode = 'P0002';
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

  -- A versão lida: a linha travada até o fim da gravação
  select * into v_atual from public.dados_pessoais where tipo = p_tipo and id_cadastro = p_id for update;
  if v_atual.atualizado_em is distinct from p_atualizado_em then
    raise exception 'os dados pessoais foram alterados por outra pessoa; abra de novo para ver a versão atual' using errcode = 'PT409';
  end if;

  -- Os campos que mudaram, na ordem da tela
  v_alterados := array_remove(array[
    case when v_atual.cpf is distinct from v_cpf then 'CPF' end,
    case when v_atual.canac is distinct from v_canac then 'CANAC' end,
    case when v_atual.nascimento is distinct from v_nascimento then 'Nascimento' end,
    case when v_atual.celular is distinct from v_celular then 'Celular' end,
    case when v_atual.email is distinct from v_email then 'E-mail' end], null);

  if v_cpf is null and v_canac is null and v_nascimento is null and v_celular is null and v_email is null then
    delete from public.dados_pessoais where tipo = p_tipo and id_cadastro = p_id;
    v_agora := null;
  else
    insert into public.dados_pessoais (tipo, id_cadastro, cpf, canac, nascimento, celular, email, atualizado_em, atualizado_por)
    values (p_tipo, p_id, v_cpf, v_canac, v_nascimento, v_celular, v_email, v_agora, v_autor)
    on conflict (tipo, id_cadastro) do update set
      cpf = excluded.cpf, canac = excluded.canac, nascimento = excluded.nascimento, celular = excluded.celular,
      email = excluded.email, atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por;
  end if;

  if cardinality(v_alterados) > 0 then
    v_descricao := left(format('Dados pessoais de %s atualizados: %s', coalesce(nullif(v_nome, ''), v_quem), array_to_string(v_alterados, ', ')), 500);
    insert into public.historico (data, usuario, autor, tipo, descricao)
    values (coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date), auth.uid(), v_autor, 'mod', v_descricao)
    returning id into v_id;
    v_historico := jsonb_build_object('id', v_id, 'descricao', v_descricao);
  end if;
  return jsonb_build_object('atualizado_em', v_agora, 'atualizado_por', v_autor, 'historico', v_historico);
end;
$$;
revoke execute on function public.salvar_dados_pessoais(text, integer, jsonb, timestamptz, date) from public, anon;
grant execute on function public.salvar_dados_pessoais(text, integer, jsonb, timestamptz, date) to authenticated;

-- O cadastro: como antes (revisão de 14/11, formato_e_status_do_dia), e quem sai dele leva os dados pessoais junto
create or replace function public.salvar_documento(p_chave text, p_conteudo jsonb, p_versao_lida integer)
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  nova_versao integer;
begin
  if public.perfil_atual() is distinct from 'operador' then
    raise exception 'somente operadores podem alterar a escala' using errcode = '42501';
  end if;

  if p_chave <> 'cadastro' and exists (select 1 from public.documentos where chave = 'cadastro') then
    raise exception 'o documento % é da versão anterior do app; recarregue a página', p_chave
      using errcode = 'PT409', hint = 'formato';
  end if;

  if public.esquema_do_conteudo(p_conteudo) <
     coalesce((select public.esquema_do_conteudo(conteudo) from public.documentos where chave = p_chave), 0) then
    raise exception 'o documento % está num formato mais novo; recarregue a página', p_chave
      using errcode = 'PT409', hint = 'formato';
  end if;

  if p_versao_lida = 0 then
    insert into public.documentos (chave, conteudo, versao, atualizado_por)
    values (p_chave, p_conteudo, 1, auth.uid())
    on conflict (chave) do nothing
    returning versao into nova_versao;
  else
    update public.documentos
    set conteudo = p_conteudo, versao = versao + 1, atualizado_por = auth.uid(), atualizado_em = now()
    where chave = p_chave and versao = p_versao_lida
    returning versao into nova_versao;
  end if;

  if nova_versao is null then
    raise exception 'o documento % foi alterado por outra pessoa', p_chave using errcode = 'PT409';
  end if;

  -- Os dados pessoais de quem não está mais no cadastro saem (só com as duas listas no cadastro)
  if p_chave = 'cadastro' and jsonb_typeof(p_conteudo -> 'stu') = 'array' and jsonb_typeof(p_conteudo -> 'ins') = 'array' then
    delete from public.dados_pessoais d
    where not exists (
      select 1 from jsonb_array_elements(p_conteudo -> (case when d.tipo = 'aluno' then 'stu' else 'ins' end)) p
      where p ->> 'id' = d.id_cadastro::text);
  end if;
  return nova_versao;
end;
$$;
