-- A agenda guarda o recurso do pedido (o tipo: C152, C172, PA-34, Sim. Mono, Sim. Multi ou Sala Ground): os horários são
-- os do recurso escolhido, e a demanda recebe o pedido nele.
-- - Coluna recurso: até 30 letras, números, espaços, pontos e hífens; os pedidos de antes ficam sem (a demanda usa o
--   recurso padrão da missão). Quem lê a agenda lê a coluna (a regra de leitura e os direitos são da tabela inteira).
-- - registrar_solicitacao com o recurso (p_recurso, o 11º argumento, sem valor padrão: o PostgREST escolhe a função pelos
--   nomes dos argumentos, e as duas nunca se confundem). O resto é a de 10 argumentos, sem mudança: quem pode, o horário
--   específico, a duração, os 6 voos locais, o prazo e a exceção da coordenação.
-- - A função de 10 argumentos continua para as abas abertas antes do app novo; os pedidos dela ficam sem recurso.
alter table public.solicitacoes add column recurso text
  check (recurso is null or recurso ~ '^[A-Za-z0-9]([A-Za-z0-9 .-]{0,28}[A-Za-z0-9])?$');
comment on column public.solicitacoes.recurso is 'O tipo de recurso do pedido (C152, PA-34…); vazio nos pedidos de antes: o padrão da missão.';

create function public.registrar_solicitacao(
  p_data date, p_aluno integer, p_aluno_nome text, p_missao text, p_janela text, p_horario text, p_horas numeric,
  p_registrado_por text, p_observacao text, p_excecao boolean,
  p_recurso text
)
  returns bigint
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  quem text := public.perfil_atual()::text;
  no_prazo boolean := public.prazo_da_agenda_permite(p_data, now());
  v_horas numeric := round(p_horas, 1);
  nova bigint;
begin
  if quem is null or quem not in ('secretaria', 'operador') then
    raise exception 'somente a secretaria e os operadores registram pedidos na agenda' using errcode = '42501';
  end if;
  if p_janela is distinct from 'horario' or p_horario is null then
    raise exception 'o pedido é num horário específico' using errcode = '22023', hint = 'horario';
  end if;
  if p_missao like 'Ground%' then
    v_horas := 1.5;
  elsif v_horas is null or v_horas <= 0 or v_horas > 5 then
    raise exception 'a duração vai de 0,1 h a 5 h' using errcode = '22023', hint = 'horas';
  end if;
  -- No máximo 6 voos locais (Voo Local, Voo Solo e TGL) no mesmo horário; o bloqueio por data e horário evita que dois
  -- pedidos ao mesmo tempo passem do limite
  if p_missao in ('Voo Local', 'Voo Solo', 'TGL (TMA)') then
    perform pg_advisory_xact_lock(hashtext('agenda-locais:' || p_data::text || ':' || p_horario));
    if (select count(*) from public.solicitacoes s
        where s.data = p_data and s.janela = 'horario' and s.horario = p_horario and s.cancelada_em is null
          and s.missao in ('Voo Local', 'Voo Solo', 'TGL (TMA)')) >= 6 then
      raise exception 'já há 6 voos locais (Voo Local, Voo Solo e TGL) às %, o máximo no mesmo horário', p_horario
        using errcode = 'PT422', hint = 'locais';
    end if;
  end if;
  if not no_prazo then
    if not coalesce(p_excecao, false) then
      raise exception 'prazo encerrado: pedido para o dia seguinte só até as 13:00' using errcode = 'PT403';
    end if;
    if quem <> 'operador' then
      raise exception 'a exceção da coordenação é só para operadores' using errcode = '42501';
    end if;
  end if;

  insert into public.solicitacoes (data, aluno, aluno_nome, missao, janela, horario, horas, recurso, observacao, registrado_por, usuario, conta, excecao)
  values (
    p_data, p_aluno, trim(p_aluno_nome), p_missao, p_janela, p_horario, v_horas, nullif(trim(p_recurso), ''), nullif(trim(p_observacao), ''), trim(p_registrado_por),
    auth.uid(),
    (select coalesce(nullif(p.nome, ''), u.email) from auth.users u left join public.perfis p on p.usuario = u.id where u.id = auth.uid()),
    not no_prazo
  )
  returning id into nova;
  return nova;
end;
$$;
revoke execute on function public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text) from public, anon;
grant execute on function public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text) to authenticated;
