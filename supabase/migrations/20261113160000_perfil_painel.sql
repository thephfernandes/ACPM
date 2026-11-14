-- Fase 9: perfil "painel", a TV da recepção. Não lê nenhuma tabela da escala (veja leitura_por_perfil) e não grava
-- nada: vê só o quadro do dia, pela função painel_do_dia.
-- (Valor novo de enum fica numa migração própria: só pode ser usado depois de gravado.)
alter type public.perfil_acesso add value if not exists 'painel';
