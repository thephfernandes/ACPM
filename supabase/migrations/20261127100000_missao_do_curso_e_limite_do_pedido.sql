-- A agenda guarda a missão do curso do pedido e a confirmação do 7º voo local no mesmo horário (o passo F1c da linha de
-- produção; as regras 7 e 10 da Agenda em docs/PLAN.md).
-- - Coluna missao_do_curso: o id da missão do programa do curso (public.missoes_do_curso, que nunca é apagada: a retirada
--   fica marcada) que o aluno vai voar; vazia no pedido sem missão do curso (o aluno sem curso, e os pedidos de antes).
--   Sem chave estrangeira: a função confere a missão quando o pedido é registrado, e a conversão única do programa
--   (public.importar_cursos) continua podendo refazer as tabelas antes do formato dos cursos.
-- - Colunas limite_confirmado_por e limite_confirmado_em: quem confirmou o 7º voo local no horário (o nome da conta, como
--   em conta) e quando; vazias em todos os outros pedidos.
-- - registrar_solicitacao com 13 argumentos: a de 11 (o recurso) com a missão do curso (p_missao_do_curso) e a confirmação
--   do limite (p_confirmar_limite), nenhum com valor padrão (o PostgREST escolhe a função pelos nomes dos argumentos, e as
--   três nunca se confundem). As regras da de 11 continuam (quem pode, o horário específico, a duração, os 6 voos locais,
--   o prazo e a exceção da coordenação), e a nova também recusa (22023, com a dica do campo):
--   - o pedido sem recurso, ou num recurso que a missão não permite com essas horas (public.missao_e_recurso_validos,
--     depois de o Ground ficar com 1,5 h): recurso;
--   - o Noturno fora das 17:30 e o Voo Solo fora das 06:30: horario;
--   - a missão do curso que não existe, que saiu do programa (ela ou a fase dela) ou que é de outro tipo de missão: missao.
--   O recurso da missão do curso não é comparado com o do pedido (uma limitação do aluno pode trocá-lo), nem o curso
--   dela com o do aluno, nem o horário com os horários de decolagem do recurso: são dados do cadastro.
--   O 7º voo local no mesmo horário passa com p_confirmar_limite, e a confirmação fica registrada quando há 6 ou mais
--   (com o bloqueio do horário); com menos, ou noutra missão, ela não registra nada. Sem ela, PT422, como antes.
-- - As funções de 11 e de 10 argumentos ficam como estão (as abas abertas do app de antes); os pedidos delas não têm missão
--   do curso nem confirmação.
alter table public.solicitacoes
  add column missao_do_curso uuid,
  add column limite_confirmado_por text,
  add column limite_confirmado_em timestamptz,
  add constraint solicitacoes_limite_confirmado check ((limite_confirmado_por is null) = (limite_confirmado_em is null));
comment on column public.solicitacoes.missao_do_curso is 'A missão do programa do curso (public.missoes_do_curso.id) do pedido; vazia sem missão do curso.';
comment on column public.solicitacoes.limite_confirmado_por is 'Quem confirmou o 7º voo local no mesmo horário (o nome da conta); vazio nos outros pedidos.';
comment on column public.solicitacoes.limite_confirmado_em is 'Quando o 7º voo local no mesmo horário foi confirmado; vazio nos outros pedidos.';

create function public.registrar_solicitacao(
  p_data date, p_aluno integer, p_aluno_nome text, p_missao text, p_janela text, p_horario text, p_horas numeric,
  p_registrado_por text, p_observacao text, p_excecao boolean,
  p_recurso text, p_missao_do_curso uuid, p_confirmar_limite boolean
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
  v_recurso text := nullif(trim(p_recurso), '');
  v_alem_do_limite boolean := false;
  v_conta text;
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
  -- O recurso: obrigatório e um dos que a missão permite, com as horas
  if v_recurso is null then
    raise exception 'o pedido precisa do recurso' using errcode = '22023', hint = 'recurso';
  end if;
  if public.missao_e_recurso_validos(p_missao, v_recurso, v_horas) is not true then
    raise exception 'a missão % não é feita no % com essas horas', p_missao, v_recurso using errcode = '22023', hint = 'recurso';
  end if;
  -- Os horários fixos (os do app: js/horarios.js, horariosDaMissao)
  if p_missao = 'Noturno' and p_horario is distinct from '17:30' then
    raise exception 'o Noturno sai sempre às 17:30' using errcode = '22023', hint = 'horario';
  end if;
  if p_missao = 'Voo Solo' and p_horario is distinct from '06:30' then
    raise exception 'o Voo Solo sai sempre às 06:30' using errcode = '22023', hint = 'horario';
  end if;
  -- A missão do curso: existe, está no programa (nem ela nem a fase dela foram retiradas) e é do tipo do pedido
  if p_missao_do_curso is not null and not exists (
    select 1 from public.missoes_do_curso m join public.fases_do_curso f on f.id = m.fase
    where m.id = p_missao_do_curso and not m.removida and not f.removida and m.tipo_de_missao = p_missao
  ) then
    raise exception 'a missão do curso não existe, saiu do programa ou é de outro tipo' using errcode = '22023', hint = 'missao';
  end if;
  -- No máximo 6 voos locais (Voo Local, Voo Solo e TGL) no mesmo horário, a não ser com a confirmação; o bloqueio por data
  -- e horário evita que dois pedidos ao mesmo tempo passem do limite sem ela (e conta o que a confirmação registra)
  if p_missao in ('Voo Local', 'Voo Solo', 'TGL (TMA)') then
    perform pg_advisory_xact_lock(hashtext('agenda-locais:' || p_data::text || ':' || p_horario));
    if (select count(*) from public.solicitacoes s
        where s.data = p_data and s.janela = 'horario' and s.horario = p_horario and s.cancelada_em is null
          and s.missao in ('Voo Local', 'Voo Solo', 'TGL (TMA)')) >= 6 then
      if not coalesce(p_confirmar_limite, false) then
        raise exception 'já há 6 voos locais (Voo Local, Voo Solo e TGL) às %, o máximo no mesmo horário', p_horario
          using errcode = 'PT422', hint = 'locais';
      end if;
      v_alem_do_limite := true;
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

  v_conta := (select coalesce(nullif(p.nome, ''), u.email) from auth.users u left join public.perfis p on p.usuario = u.id where u.id = auth.uid());
  insert into public.solicitacoes (data, aluno, aluno_nome, missao, janela, horario, horas, recurso, missao_do_curso, observacao, registrado_por,
    usuario, conta, excecao, limite_confirmado_por, limite_confirmado_em)
  values (
    p_data, p_aluno, trim(p_aluno_nome), p_missao, p_janela, p_horario, v_horas, v_recurso, p_missao_do_curso, nullif(trim(p_observacao), ''), trim(p_registrado_por),
    auth.uid(), v_conta, not no_prazo,
    case when v_alem_do_limite then coalesce(v_conta, '') end, case when v_alem_do_limite then now() end
  )
  returning id into nova;
  return nova;
end;
$$;
revoke execute on function public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text, uuid, boolean) from public, anon;
grant execute on function public.registrar_solicitacao(date, integer, text, text, text, text, numeric, text, text, boolean, text, uuid, boolean) to authenticated;
