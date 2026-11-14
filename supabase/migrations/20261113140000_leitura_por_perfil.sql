-- Fase 9: só os perfis da escala leem os dados dela. Até aqui, qualquer conta com perfil lia os documentos, os dias,
-- o histórico e a agenda; o perfil novo "painel" (a TV da recepção) não lê nada disso: ele vê só o quadro do dia, por
-- uma função própria. Nada muda para quem já tem acesso (operador, administrador, gestor e secretaria).

-- Quem chama é de um perfil da escala? (O administrador conta como operador em public.perfil_atual.) A comparação é
-- por texto: os perfis novos não entram sem uma mudança aqui.
create function public.le_a_escala()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(public.perfil_atual()::text in ('operador', 'gestor', 'secretaria'), false)
$$;
revoke execute on function public.le_a_escala() from public, anon;
grant execute on function public.le_a_escala() to authenticated;

drop policy "contas com perfil leem" on public.documentos;
create policy "perfis da escala leem" on public.documentos
  for select to authenticated
  using ((select public.le_a_escala()));

drop policy "contas com perfil leem" on public.dias;
create policy "perfis da escala leem" on public.dias
  for select to authenticated
  using ((select public.le_a_escala()));

drop policy "contas com perfil leem" on public.historico;
create policy "perfis da escala leem" on public.historico
  for select to authenticated
  using ((select public.le_a_escala()));

drop policy "contas com perfil leem" on public.solicitacoes;
create policy "perfis da escala leem" on public.solicitacoes
  for select to authenticated
  using ((select public.le_a_escala()));
