-- Resumo de gamificacao no banco.
-- Execute uma vez em bancos existentes para evitar carregar listas grandes no cliente.

create index if not exists questoes_user_criado_idx
  on public.questoes (user_id, criado_em);

create index if not exists questoes_certas_user_criado_idx
  on public.questoes_certas (user_id, criado_em);

create or replace function public.obter_resumo_gamificacao()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with usuario as (
  select auth.uid() as user_id
),
questoes_usuario as (
  select q.*
  from public.questoes q
  join usuario u on q.user_id = u.user_id
),
resumo_questoes as (
  select
    count(*)::integer as total_questoes,
    (count(*) filter (
      where char_length(trim(coalesce(conceito_chave, ''))) >= 3
        and char_length(trim(coalesce(como_reconhecer, ''))) >= 3
        and char_length(trim(coalesce(acao_corretiva, ''))) >= 3
    ))::integer as total_diagnostico_completo,
    (count(*) filter (
      where lower(trim(coalesce(motivo_erro, ''))) not in ('', 'a diagnosticar', 'nao informado', 'não informado')
        and lower(trim(coalesce(nivel_confianca, ''))) not in ('', 'a diagnosticar', 'nao informado', 'não informado')
        and char_length(trim(coalesce(conceito_chave, ''))) >= 8
        and char_length(trim(coalesce(como_reconhecer, ''))) >= 8
        and char_length(trim(coalesce(acao_corretiva, ''))) >= 8
        and char_length(trim(coalesce(comentario, ''))) >= 8
    ))::integer as total_diagnostico_forte
  from questoes_usuario
),
motivo_contagens as (
  select count(*)::integer as total
  from questoes_usuario
  where lower(trim(coalesce(motivo_erro, ''))) not in ('', 'a diagnosticar', 'nao informado', 'não informado')
  group by trim(motivo_erro)
),
revisoes as (
  select (
    exists (
      select 1
      from public.questoes_revisoes r
      join usuario u on r.user_id = u.user_id
    )
    or exists (
      select 1
      from public.configuracoes_revisao c
      join usuario u on c.user_id = u.user_id
      where c.ultima_revisao_geral is not null
    )
  ) as revisao_concluida
),
dias_atividade as (
  select distinct dia
  from (
    select q.criado_em::date as dia
    from public.questoes q
    join usuario u on q.user_id = u.user_id
    union
    select qc.criado_em::date as dia
    from public.questoes_certas qc
    join usuario u on qc.user_id = u.user_id
    union
    select c.ultima_revisao_geral::date as dia
    from public.configuracoes_revisao c
    join usuario u on c.user_id = u.user_id
    where c.ultima_revisao_geral is not null
  ) atividade
  where dia is not null
),
dias_ordenados as (
  select
    dia,
    dia - (row_number() over (order by dia))::integer as grupo
  from dias_atividade
),
base_streak as (
  select case
    when exists (select 1 from dias_atividade where dia = current_date) then current_date
    when exists (select 1 from dias_atividade where dia = current_date - 1) then current_date - 1
    else null::date
  end as dia
),
streak_atual as (
  select count(atual.dia)::integer as total
  from base_streak b
  left join dias_ordenados base on base.dia = b.dia
  left join dias_ordenados atual
    on atual.grupo = base.grupo
   and atual.dia <= b.dia
),
recorde_streak as (
  select coalesce(max(total), 0)::integer as total
  from (
    select count(*)::integer as total
    from dias_ordenados
    group by grupo
  ) sequencias
)
select jsonb_build_object(
  'total_questoes', (select total_questoes from resumo_questoes),
  'total_diagnostico_completo', (select total_diagnostico_completo from resumo_questoes),
  'total_diagnostico_forte', (select total_diagnostico_forte from resumo_questoes),
  'motivo_repetido', coalesce((select bool_or(total >= 5) from motivo_contagens), false),
  'revisao_concluida', (select revisao_concluida from revisoes),
  'streak', (select total from streak_atual),
  'recorde', greatest((select total from recorde_streak), (select total from streak_atual)),
  'atividade_hoje', exists (select 1 from dias_atividade where dia = current_date),
  'sequencia_em_risco', (
    (select total from streak_atual) > 0
    and not exists (select 1 from dias_atividade where dia = current_date)
  )
);
$$;

revoke all on function public.obter_resumo_gamificacao() from public;
revoke all on function public.obter_resumo_gamificacao() from anon;
grant execute on function public.obter_resumo_gamificacao() to authenticated;
