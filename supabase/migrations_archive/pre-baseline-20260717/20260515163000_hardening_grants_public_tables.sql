-- Hardening de privilegios das tabelas public usadas pelo app.
-- Objetivo: remover privilegios diretos de PUBLIC/anon e limitar authenticated
-- aos privilegios realmente usados pelo frontend autenticado.
-- Esta migration nao altera dados, nao recria tabelas e nao remove policies.

begin;

-- 1. Revoga todo acesso direto de PUBLIC nas tabelas do app.
-- PUBLIC representa todos os roles; por isso deve ser revogado antes
-- das concessoes explicitas para authenticated.
revoke all privileges on table
  public.profiles,
  public.materias,
  public.edital_config,
  public.edital_topicos,
  public.pegadinhas_banca,
  public.planejamento_semanal,
  public.lei_seca_itens,
  public.sessoes_estudo,
  public.questoes,
  public.questoes_certas,
  public.questoes_revisoes,
  public.user_badges,
  public.simulados,
  public.plano_dia_materias,
  public.estatisticas_mensais,
  public.configuracoes_revisao,
  public.ia_uso_diario
from public;

-- 2. Revoga todo acesso direto da role anon nas tabelas do app.
revoke all privileges on table
  public.profiles,
  public.materias,
  public.edital_config,
  public.edital_topicos,
  public.pegadinhas_banca,
  public.planejamento_semanal,
  public.lei_seca_itens,
  public.sessoes_estudo,
  public.questoes,
  public.questoes_certas,
  public.questoes_revisoes,
  public.user_badges,
  public.simulados,
  public.plano_dia_materias,
  public.estatisticas_mensais,
  public.configuracoes_revisao,
  public.ia_uso_diario
from anon;

-- 3. Recria os privilegios da role authenticated nas tabelas normais do app.
-- Primeiro remove privilegios excessivos, depois concede apenas
-- SELECT, INSERT, UPDATE e DELETE. As policies RLS continuam responsaveis
-- por restringir cada usuario aos proprios dados.
revoke all privileges on table
  public.profiles,
  public.materias,
  public.edital_config,
  public.edital_topicos,
  public.pegadinhas_banca,
  public.planejamento_semanal,
  public.lei_seca_itens,
  public.sessoes_estudo,
  public.questoes,
  public.questoes_certas,
  public.questoes_revisoes,
  public.user_badges,
  public.simulados,
  public.plano_dia_materias,
  public.estatisticas_mensais,
  public.configuracoes_revisao
from authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.materias,
  public.edital_config,
  public.edital_topicos,
  public.pegadinhas_banca,
  public.planejamento_semanal,
  public.lei_seca_itens,
  public.sessoes_estudo,
  public.questoes,
  public.questoes_certas,
  public.questoes_revisoes,
  public.user_badges,
  public.simulados,
  public.plano_dia_materias,
  public.estatisticas_mensais,
  public.configuracoes_revisao
to authenticated;

-- 4. Protege ia_uso_diario contra escrita direta pelo frontend.
-- Usuario autenticado pode consultar apenas o proprio uso via RLS.
-- Escrita permanece reservada ao backend/service_role usado pela Edge Function.
revoke all privileges on table public.ia_uso_diario from authenticated;
grant select on table public.ia_uso_diario to authenticated;

-- 5. Mantem a funcao sensivel de consumo de cota sem EXECUTE para PUBLIC,
-- anon e authenticated. Ela deve continuar sendo chamada apenas pelo backend
-- com service_role.
revoke execute on function public.consumir_cota_ia(uuid, integer) from public;
revoke execute on function public.consumir_cota_ia(uuid, integer) from anon;
revoke execute on function public.consumir_cota_ia(uuid, integer) from authenticated;
grant execute on function public.consumir_cota_ia(uuid, integer) to service_role;

-- 6. Mantem a RPC de gamificacao disponivel apenas para usuarios logados.
-- Revogar de PUBLIC e anon evita execucao anonima herdada.
-- O frontend usa essa funcao e ela roda como security invoker.
revoke execute on function public.obter_resumo_gamificacao() from public;
revoke execute on function public.obter_resumo_gamificacao() from anon;
revoke execute on function public.obter_resumo_gamificacao() from authenticated;
grant execute on function public.obter_resumo_gamificacao() to authenticated;

commit;
