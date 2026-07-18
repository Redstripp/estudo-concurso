-- Melhoria 1: repeticao espacada individualizada por questao (sm2_v1)
-- Migration aditiva. Nao remove nem renomeia dados legados.

alter table public.configuracoes_revisao
  add column if not exists review_scheduler_mode text not null default 'legacy',
  add column if not exists review_timezone text not null default 'America/Recife',
  add column if not exists review_max_interval_days integer not null default 365;

alter table public.configuracoes_revisao
  drop constraint if exists configuracoes_revisao_scheduler_mode_check,
  add constraint configuracoes_revisao_scheduler_mode_check
    check (review_scheduler_mode in ('legacy', 'sm2_v1'));

alter table public.configuracoes_revisao
  drop constraint if exists configuracoes_revisao_max_interval_check,
  add constraint configuracoes_revisao_max_interval_check
    check (review_max_interval_days between 1 and 3650);

alter table public.questoes_revisoes
  add column if not exists scheduler_algorithm text,
  add column if not exists review_grade integer,
  add column if not exists source_attempt_id uuid,
  add column if not exists response_time_ms integer;

alter table public.questoes_revisoes
  drop constraint if exists questoes_revisoes_review_grade_check,
  add constraint questoes_revisoes_review_grade_check
    check (review_grade is null or review_grade between 0 and 5);

alter table public.questoes_revisoes
  drop constraint if exists questoes_revisoes_response_time_check,
  add constraint questoes_revisoes_response_time_check
    check (response_time_ms is null or response_time_ms >= 0);

create unique index if not exists questoes_revisoes_source_attempt_uidx
  on public.questoes_revisoes (user_id, source_attempt_id)
  where source_attempt_id is not null;

create table if not exists public.questao_review_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  questao_id uuid not null references public.questoes(id) on delete cascade,
  algorithm_version text not null default 'sm2_v1',
  state_origin text not null default 'new',
  easiness_factor numeric(6, 3) not null default 2.5,
  repetition_count integer not null default 0,
  interval_days integer not null default 0,
  lapse_count integer not null default 0,
  correct_streak integer not null default 0,
  total_reviews integer not null default 0,
  last_grade integer,
  last_result text,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, questao_id),
  constraint questao_review_states_algorithm_check check (algorithm_version = 'sm2_v1'),
  constraint questao_review_states_origin_check check (state_origin in ('new', 'migrated')),
  constraint questao_review_states_ease_check check (easiness_factor >= 1.3),
  constraint questao_review_states_counts_check check (
    repetition_count >= 0
    and interval_days >= 0
    and lapse_count >= 0
    and correct_streak >= 0
    and total_reviews >= 0
  ),
  constraint questao_review_states_grade_check check (last_grade is null or last_grade between 0 and 5),
  constraint questao_review_states_result_check check (
    last_result is null or last_result in ('correct', 'incorrect')
  )
);

create index if not exists questao_review_states_user_due_idx
  on public.questao_review_states (user_id, next_review_at);

create index if not exists questao_review_states_user_priority_idx
  on public.questao_review_states (
    user_id,
    next_review_at,
    lapse_count desc,
    easiness_factor asc,
    correct_streak asc,
    last_reviewed_at asc,
    questao_id asc
  );

create table if not exists public.questao_review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  questao_id uuid not null references public.questoes(id) on delete cascade,
  source_attempt_id uuid,
  algorithm_version text not null default 'sm2_v1',
  event_origin text not null default 'new',
  grade integer not null,
  was_correct boolean not null,
  reviewed_at timestamptz not null default now(),
  previous_interval_days integer not null default 0,
  new_interval_days integer not null,
  previous_due_at timestamptz,
  next_review_at timestamptz not null,
  response_time_ms integer,
  created_at timestamptz not null default now(),
  unique (user_id, source_attempt_id),
  constraint questao_review_events_algorithm_check check (algorithm_version = 'sm2_v1'),
  constraint questao_review_events_origin_check check (event_origin in ('new', 'migrated')),
  constraint questao_review_events_grade_check check (grade between 0 and 5),
  constraint questao_review_events_intervals_check check (
    previous_interval_days >= 0
    and new_interval_days >= 1
  ),
  constraint questao_review_events_response_time_check check (
    response_time_ms is null or response_time_ms >= 0
  )
);

create index if not exists questao_review_events_user_reviewed_idx
  on public.questao_review_events (user_id, reviewed_at desc);

create index if not exists questao_review_events_question_idx
  on public.questao_review_events (questao_id, reviewed_at desc);

alter table public.questao_review_states enable row level security;
alter table public.questao_review_events enable row level security;

drop policy if exists questao_review_states_select_proprios on public.questao_review_states;
create policy questao_review_states_select_proprios
on public.questao_review_states
for select
using (auth.uid() = user_id);

drop policy if exists questao_review_states_insert_proprios on public.questao_review_states;
create policy questao_review_states_insert_proprios
on public.questao_review_states
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.questoes q
    where q.id = questao_id
      and q.user_id = auth.uid()
  )
);

drop policy if exists questao_review_states_update_proprios on public.questao_review_states;
create policy questao_review_states_update_proprios
on public.questao_review_states
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.questoes q
    where q.id = questao_id
      and q.user_id = auth.uid()
  )
);

drop policy if exists questao_review_events_select_proprios on public.questao_review_events;
create policy questao_review_events_select_proprios
on public.questao_review_events
for select
using (auth.uid() = user_id);

drop policy if exists questao_review_events_insert_proprios on public.questao_review_events;
-- Eventos sao historico imutavel para o cliente. Insercoes acontecem pela RPC security definer.

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
  'migrated',
  2.5,
  case
    when q.revisao_ultima_resultado = 'Acertou' then greatest(1, least(coalesce(q.revisao_etapa, 0), 2))
    else 0
  end,
  greatest(
    0,
    coalesce(
      q.revisar_novamente_em - coalesce(q.revisao_ultima_data, q.criado_em::date),
      0
    )
  ),
  greatest(0, coalesce(q.revisao_total_erros, 0)),
  case when q.revisao_ultima_resultado = 'Acertou' then 1 else 0 end,
  greatest(0, coalesce(q.revisao_total_acertos, 0) + coalesce(q.revisao_total_erros, 0)),
  case
    when q.revisao_ultima_resultado = 'Acertou' then 4
    when q.revisao_ultima_resultado = 'Errou' then 1
    else null
  end,
  case
    when q.revisao_ultima_resultado = 'Acertou' then 'correct'
    when q.revisao_ultima_resultado = 'Errou' then 'incorrect'
    else null
  end,
  case
    when q.revisao_ultima_data is not null then q.revisao_ultima_data::timestamp at time zone 'UTC'
    else null
  end,
  -- Mantem vencimentos legados ja atrasados para que aparecam na fila ao ativar SM-2.
  -- Quando nao ha data legada, usa current_date para evitar data historica causada por nulo.
  coalesce(q.revisar_novamente_em, current_date)::timestamp at time zone 'UTC'
from public.questoes q
where q.status_revisao = 'pendente'
on conflict (user_id, questao_id) do nothing;

insert into public.questao_review_events (
  user_id,
  questao_id,
  source_attempt_id,
  algorithm_version,
  event_origin,
  grade,
  was_correct,
  reviewed_at,
  previous_interval_days,
  new_interval_days,
  previous_due_at,
  next_review_at,
  response_time_ms,
  created_at
)
select
  r.user_id,
  r.questao_id,
  r.id,
  'sm2_v1',
  'migrated',
  case when r.resultado = 'Acertou' then 4 else 1 end,
  r.resultado = 'Acertou',
  r.criado_em,
  0,
  greatest(1, coalesce(r.revisar_novamente_em - r.data_revisao, 1)),
  null,
  coalesce(r.revisar_novamente_em, r.data_revisao + 1)::timestamp at time zone 'UTC',
  null,
  r.criado_em
from public.questoes_revisoes r
on conflict (user_id, source_attempt_id) do nothing;

create or replace function public.registrar_revisao_questao_sm2(
  p_questao_id uuid,
  p_grade integer,
  p_was_correct boolean,
  p_reviewed_at timestamptz default now(),
  p_source_attempt_id uuid default null,
  p_response_time_ms integer default null,
  p_answer text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_questao public.questoes%rowtype;
  v_state public.questao_review_states%rowtype;
  v_event public.questao_review_events%rowtype;
  v_max_interval integer := 365;
  v_previous_interval integer := 0;
  v_previous_due timestamptz := null;
  v_old_ease numeric := 2.5;
  v_new_ease numeric := 2.5;
  v_new_repetition integer := 0;
  v_new_interval integer := 1;
  v_new_lapses integer := 0;
  v_new_streak integer := 0;
  v_total_reviews integer := 1;
  v_next_review_at timestamptz;
  v_result text;
  v_was_correct boolean := false;
  v_legacy_due date;
begin
  if v_user_id is null then
    raise exception 'usuario_nao_autenticado' using errcode = '28000';
  end if;

  if p_questao_id is null then
    raise exception 'questao_id_obrigatorio' using errcode = '22023';
  end if;

  if p_grade is null or p_grade < 0 or p_grade > 5 then
    raise exception 'grade_invalida' using errcode = '22023';
  end if;

  if p_reviewed_at is null then
    raise exception 'data_revisao_invalida' using errcode = '22023';
  end if;

  if p_was_correct is not null and p_was_correct <> (p_grade >= 3) then
    raise exception 'resultado_inconsistente_com_grade' using errcode = '22023';
  end if;

  if p_response_time_ms is not null and p_response_time_ms < 0 then
    raise exception 'response_time_invalido' using errcode = '22023';
  end if;

  if p_source_attempt_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_user_id::text || ':' || p_source_attempt_id::text, 0)
    );

    select *
    into v_event
    from public.questao_review_events
    where user_id = v_user_id
      and source_attempt_id = p_source_attempt_id;

    if found then
      if v_event.questao_id <> p_questao_id then
        raise exception 'source_attempt_id_conflita_com_outra_questao' using errcode = '23505';
      end if;

      select *
      into v_state
      from public.questao_review_states
      where user_id = v_user_id
        and questao_id = v_event.questao_id;

      return jsonb_build_object(
        'idempotent', true,
        'event_id', v_event.id,
        'state', to_jsonb(v_state),
        'next_review_at', v_state.next_review_at,
        'interval_days', v_state.interval_days
      );
    end if;
  end if;

  select *
  into v_questao
  from public.questoes
  where id = p_questao_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'questao_nao_encontrada_ou_de_outro_usuario' using errcode = '42501';
  end if;

  select coalesce(review_max_interval_days, 365)
  into v_max_interval
  from public.configuracoes_revisao
  where user_id = v_user_id;

  if not found then
    v_max_interval := 365;
  end if;

  insert into public.questao_review_states (user_id, questao_id, algorithm_version, state_origin)
  values (v_user_id, p_questao_id, 'sm2_v1', 'new')
  on conflict (user_id, questao_id) do nothing;

  select *
  into v_state
  from public.questao_review_states
  where user_id = v_user_id
    and questao_id = p_questao_id
  for update;

  if not found then
    raise exception 'estado_nao_encontrado' using errcode = '40001';
  end if;

  if p_source_attempt_id is not null then
    select *
    into v_event
    from public.questao_review_events
    where user_id = v_user_id
      and source_attempt_id = p_source_attempt_id;

    if found then
      if v_event.questao_id <> p_questao_id then
        raise exception 'source_attempt_id_conflita_com_outra_questao' using errcode = '23505';
      end if;

      return jsonb_build_object(
        'idempotent', true,
        'event_id', v_event.id,
        'state', to_jsonb(v_state),
        'next_review_at', v_state.next_review_at,
        'interval_days', v_state.interval_days
      );
    end if;
  end if;

  v_previous_interval := greatest(0, coalesce(v_state.interval_days, 0));
  v_previous_due := v_state.next_review_at;
  v_old_ease := greatest(1.3, coalesce(v_state.easiness_factor, 2.5));
  v_new_ease := greatest(
    1.3,
    v_old_ease + (0.1 - (5 - p_grade) * (0.08 + (5 - p_grade) * 0.02))
  );

  v_was_correct := p_grade >= 3;

  if not v_was_correct then
    v_new_repetition := 0;
    v_new_interval := 1;
    v_new_lapses := coalesce(v_state.lapse_count, 0) + 1;
    v_new_streak := 0;
    v_result := 'incorrect';
  else
    v_new_repetition := coalesce(v_state.repetition_count, 0) + 1;
    v_new_lapses := coalesce(v_state.lapse_count, 0);
    v_new_streak := coalesce(v_state.correct_streak, 0) + 1;
    v_result := 'correct';

    if v_new_repetition = 1 then
      v_new_interval := 1;
    elsif v_new_repetition = 2 then
      v_new_interval := 6;
    else
      v_new_interval := greatest(1, round(greatest(1, v_previous_interval) * v_old_ease)::integer);
    end if;
  end if;

  v_new_interval := least(v_new_interval, greatest(1, coalesce(v_max_interval, 365)));
  v_total_reviews := coalesce(v_state.total_reviews, 0) + 1;
  v_next_review_at := p_reviewed_at + make_interval(days => v_new_interval);
  v_legacy_due := v_next_review_at::date;

  insert into public.questao_review_events (
    user_id,
    questao_id,
    source_attempt_id,
    algorithm_version,
    event_origin,
    grade,
    was_correct,
    reviewed_at,
    previous_interval_days,
    new_interval_days,
    previous_due_at,
    next_review_at,
    response_time_ms
  )
  values (
    v_user_id,
    p_questao_id,
    p_source_attempt_id,
    'sm2_v1',
    'new',
    p_grade,
    v_was_correct,
    p_reviewed_at,
    v_previous_interval,
    v_new_interval,
    v_previous_due,
    v_next_review_at,
    p_response_time_ms
  )
  returning * into v_event;

  update public.questao_review_states
  set
    algorithm_version = 'sm2_v1',
    easiness_factor = v_new_ease,
    repetition_count = v_new_repetition,
    interval_days = v_new_interval,
    lapse_count = v_new_lapses,
    correct_streak = v_new_streak,
    total_reviews = v_total_reviews,
    last_grade = p_grade,
    last_result = v_result,
    last_reviewed_at = p_reviewed_at,
    next_review_at = v_next_review_at,
    updated_at = now()
  where id = v_state.id
  returning * into v_state;

  insert into public.questoes_revisoes (
    user_id,
    questao_id,
    data_revisao,
    resultado,
    revisar_novamente_em,
    resposta_marcada,
    nivel_confianca,
    scheduler_algorithm,
    review_grade,
    source_attempt_id,
    response_time_ms
  )
  values (
    v_user_id,
    p_questao_id,
    p_reviewed_at::date,
    case when v_was_correct then 'Acertou' else 'Errou' end,
    v_legacy_due,
    p_answer,
    null,
    'sm2_v1',
    p_grade,
    p_source_attempt_id,
    p_response_time_ms
  )
  on conflict (user_id, source_attempt_id) where source_attempt_id is not null do nothing;

  update public.questoes
  set
    status_revisao = 'pendente',
    revisar_novamente_em = v_legacy_due,
    revisao_ultima_data = p_reviewed_at::date,
    revisao_ultima_resultado = case when v_was_correct then 'Acertou' else 'Errou' end,
    revisao_etapa = least(v_new_repetition, 3),
    revisao_total_acertos = coalesce(revisao_total_acertos, 0) + case when v_was_correct then 1 else 0 end,
    revisao_total_erros = coalesce(revisao_total_erros, 0) + case when v_was_correct then 0 else 1 end
  where id = p_questao_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'idempotent', false,
    'event_id', v_event.id,
    'state', to_jsonb(v_state),
    'next_review_at', v_state.next_review_at,
    'interval_days', v_state.interval_days
  );
end;
$$;

create or replace function public.obter_metricas_revisao_sm2(
  p_days integer default 60
)
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  with usuario as (
    select auth.uid() as user_id
  ),
  eventos as (
    select e.*
    from public.questao_review_events e
    join usuario u on u.user_id = e.user_id
    where e.reviewed_at >= now() - make_interval(days => greatest(1, coalesce(p_days, 60)))
  ),
  estados as (
    select s.*
    from public.questao_review_states s
    join usuario u on u.user_id = s.user_id
  )
  select jsonb_build_object(
    'algorithm_version', 'sm2_v1',
    'window_days', greatest(1, coalesce(p_days, 60)),
    'sample_size', (select count(*) from eventos),
    'scheduled_accuracy', coalesce((select round(avg(case when was_correct then 1 else 0 end) * 100)::integer from eventos), 0),
    'items_sm2_v1', (select count(*) from estados where algorithm_version = 'sm2_v1'),
    'overdue_items', (select count(*) from estados where next_review_at <= now()),
    'avg_lapses_per_question', coalesce((select round(avg(lapse_count)::numeric, 2) from estados), 0),
    'accuracy_by_interval', coalesce((
      select jsonb_agg(item order by faixa)
      from (
        select
          case
            when new_interval_days <= 1 then '1d'
            when new_interval_days <= 6 then '2-6d'
            when new_interval_days <= 30 then '7-30d'
            when new_interval_days <= 60 then '31-60d'
            else '60d+'
          end as faixa,
          count(*) as total,
          round(avg(case when was_correct then 1 else 0 end) * 100)::integer as accuracy
        from eventos
        group by 1
      ) item
    ), '[]'::jsonb),
    'message', case
      when (select count(*) from eventos) < 30 then 'Ainda nao ha dados suficientes para comparacao.'
      else 'Metricas calculadas para o scheduler sm2_v1.'
    end
  );
$$;

revoke all on function public.registrar_revisao_questao_sm2(uuid, integer, boolean, timestamptz, uuid, integer, text) from public;
revoke all on function public.registrar_revisao_questao_sm2(uuid, integer, boolean, timestamptz, uuid, integer, text) from anon;
grant execute on function public.registrar_revisao_questao_sm2(uuid, integer, boolean, timestamptz, uuid, integer, text) to authenticated;

revoke all on function public.obter_metricas_revisao_sm2(integer) from public;
revoke all on function public.obter_metricas_revisao_sm2(integer) from anon;
grant execute on function public.obter_metricas_revisao_sm2(integer) to authenticated;

revoke all on table public.questao_review_states from public;
revoke all on table public.questao_review_states from anon;
revoke all on table public.questao_review_events from public;
revoke all on table public.questao_review_events from anon;
revoke all on table public.questao_review_events from authenticated;

grant select, insert, update on table public.questao_review_states to authenticated;
grant select on table public.questao_review_events to authenticated;
