-- Revisão de 14/11: o dia gravado.
-- - Um dia não nasce num formato mais antigo que o do cadastro: uma aba aberta com a versão anterior do app (depois da
--   atualização do cadastro) não cria mais dias no formato antigo.
-- - As recusas por formato (do dia e do cadastro) vêm com a dica "formato": o app diz que foi atualizado e pede para
--   recarregar, em vez de dizer que outra pessoa gravou antes. O código continua PT409 (as abas antigas recarregam).
-- - O dia só leva os status da lista ("Pousou" já vale), em chaves de voo: quem tem conta de operador grava pela API.
-- - dias_em_formato_antigo: as datas gravadas num formato anterior ao pedido. A atualização do formato lê só essas, e
--   não baixa mais todos os dias (uma consulta devolve no máximo 1000 linhas).
create or replace function public.salvar_dia(p_data date, p_conteudo jsonb, p_versao_lida integer)
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

  if public.esquema_do_conteudo(p_conteudo) < greatest(
       coalesce((select public.esquema_do_conteudo(conteudo) from public.dias where data = p_data), 0),
       coalesce((select public.esquema_do_conteudo(conteudo) from public.documentos where chave = 'cadastro'), 0)) then
    raise exception 'a escala de % está num formato mais antigo que o dos dados; recarregue a página', p_data
      using errcode = 'PT409', hint = 'formato';
  end if;

  if p_conteudo ? 'fStatus' and (jsonb_typeof(p_conteudo -> 'fStatus') is distinct from 'object' or exists (
       select 1 from jsonb_each(p_conteudo -> 'fStatus') as e(chave, status)
       where chave !~ '^[0-9]+_[0-9]+_[0-9]+$' or jsonb_typeof(status) <> 'string'
          or (status #>> '{}') <> all (array['Pendente', 'Confirmado', 'Atrasado', 'Em Voo', 'Cancelado', 'Pousou']))) then
    raise exception 'status de voo fora da lista' using errcode = '23514';
  end if;

  if p_versao_lida = 0 then
    insert into public.dias (data, conteudo, versao, atualizado_por)
    values (p_data, p_conteudo, 1, auth.uid())
    on conflict (data) do nothing
    returning versao into nova_versao;
  else
    update public.dias
    set conteudo = p_conteudo, versao = versao + 1, atualizado_por = auth.uid(), atualizado_em = now()
    where data = p_data and versao = p_versao_lida
    returning versao into nova_versao;
  end if;

  if nova_versao is null then
    raise exception 'a escala de % foi alterada por outra pessoa', p_data using errcode = 'PT409';
  end if;
  return nova_versao;
end;
$$;

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
  return nova_versao;
end;
$$;

create function public.dias_em_formato_antigo(p_esquema integer)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  if public.perfil_atual() is distinct from 'operador' then
    raise exception 'somente operadores atualizam o formato dos dados' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(data order by data) from public.dias where public.esquema_do_conteudo(conteudo) < p_esquema), '[]'::jsonb);
end;
$$;
revoke execute on function public.dias_em_formato_antigo(integer) from public, anon;
grant execute on function public.dias_em_formato_antigo(integer) to authenticated;
