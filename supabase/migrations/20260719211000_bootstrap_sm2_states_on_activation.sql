-- Bootstrap transacional de estados SM-2 na ativacao por usuario.
-- A migration apenas instala a trigger; nao ativa usuarios nem cria eventos.

alter table public.questao_review_states
  drop constraint if exists questao_review_states_origin_check,
  add constraint questao_review_states_origin_check
    check (state_origin in ('new', 'migrated', 'activation_bootstrap'));

create or replace function public.bootstrap_sm2_states_on_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.review_scheduler_mode = 'sm2_v1'
     and old.review_scheduler_mode is distinct from 'sm2_v1' then
    insert into public.questao_review_states (
      user_id,
      questao_id,
      algorithm_version,
      state_origin,
      easiness_factor,
      repetition_count,
      interval_days,
      lapse_count,
      correct_streak,
      total_reviews,
      last_grade,
      last_result,
      last_reviewed_at,
      next_review_at
    )
    select
      q.user_id,
      q.id,
      'sm2_v1',
      'activation_bootstrap',
      2.5,
      case
        when datas.last_result = 'Acertou' then greatest(1, least(coalesce(q.revisao_etapa, 0), 2))
        else 0
      end,
      greatest(0, datas.initial_due_date - coalesce(datas.last_review_date, q.criado_em::date)),
      greatest(0, coalesce(q.revisao_total_erros, 0)),
      case when datas.last_result = 'Acertou' then 1 else 0 end,
      greatest(0, coalesce(q.revisao_total_acertos, 0) + coalesce(q.revisao_total_erros, 0)),
      case
        when datas.last_result = 'Acertou' then 4
        when datas.last_result = 'Errou' then 1
        else null
      end,
      case
        when datas.last_result = 'Acertou' then 'correct'
        when datas.last_result = 'Errou' then 'incorrect'
        else null
      end,
      case
        when datas.last_review_date is not null then datas.last_review_date::timestamp at time zone 'UTC'
        else null
      end,
      datas.initial_due_date::timestamp at time zone 'UTC'
    from public.questoes q
    left join lateral (
      select
        r.data_revisao,
        r.resultado,
        r.revisar_novamente_em,
        r.criado_em
      from public.questoes_revisoes r
      where r.user_id = new.user_id
        and r.questao_id = q.id
      order by r.data_revisao desc, r.criado_em desc, r.id desc
      limit 1
    ) ultima_revisao on true
    cross join lateral (
      select
        coalesce(ultima_revisao.revisar_novamente_em, q.revisar_novamente_em, q.criado_em::date) as initial_due_date,
        coalesce(q.revisao_ultima_data, ultima_revisao.data_revisao) as last_review_date,
        coalesce(q.revisao_ultima_resultado, ultima_revisao.resultado) as last_result
    ) datas
    where q.user_id = new.user_id
      and q.status_revisao = 'pendente'
    on conflict (user_id, questao_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.bootstrap_sm2_states_on_activation() from public;
revoke all on function public.bootstrap_sm2_states_on_activation() from anon;
revoke all on function public.bootstrap_sm2_states_on_activation() from authenticated;
revoke all on function public.bootstrap_sm2_states_on_activation() from service_role;

drop trigger if exists bootstrap_sm2_states_on_activation on public.configuracoes_revisao;
create trigger bootstrap_sm2_states_on_activation
after update of review_scheduler_mode on public.configuracoes_revisao
for each row
when (
  old.review_scheduler_mode is distinct from 'sm2_v1'
  and new.review_scheduler_mode = 'sm2_v1'
)
execute function public.bootstrap_sm2_states_on_activation();
