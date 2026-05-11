-- Assistente de IA: controle diario de uso por usuario.
-- Execute uma vez no SQL Editor do Supabase antes de ativar a Edge Function.

create table if not exists public.ia_uso_diario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null default current_date,
  total_analises integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, data),
  constraint ia_uso_diario_total_check check (total_analises >= 0)
);

create index if not exists ia_uso_diario_user_data_idx
  on public.ia_uso_diario (user_id, data desc);

alter table public.ia_uso_diario enable row level security;

drop policy if exists ia_uso_diario_select_proprio on public.ia_uso_diario;
create policy ia_uso_diario_select_proprio
on public.ia_uso_diario
for select
using (auth.uid() = user_id);

create or replace function public.consumir_cota_ia(
  p_user_id uuid,
  p_limite integer default 20
)
returns table (
  permitido boolean,
  usado integer,
  limite integer,
  restante integer,
  data date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data date := current_date;
  v_limite integer := greatest(coalesce(p_limite, 20), 1);
  v_usado integer;
begin
  if p_user_id is null then
    raise exception 'p_user_id obrigatorio';
  end if;

  insert into public.ia_uso_diario (user_id, data, total_analises)
  values (p_user_id, v_data, 0)
  on conflict (user_id, data) do nothing;

  select total_analises
  into v_usado
  from public.ia_uso_diario
  where user_id = p_user_id
    and data = v_data
  for update;

  if v_usado >= v_limite then
    return query
      select false, v_usado, v_limite, 0, v_data;
    return;
  end if;

  v_usado := v_usado + 1;

  update public.ia_uso_diario
  set total_analises = v_usado,
      atualizado_em = now()
  where user_id = p_user_id
    and data = v_data;

  return query
    select true, v_usado, v_limite, greatest(v_limite - v_usado, 0), v_data;
end;
$$;

revoke all on function public.consumir_cota_ia(uuid, integer) from public;
revoke all on function public.consumir_cota_ia(uuid, integer) from anon;
revoke all on function public.consumir_cota_ia(uuid, integer) from authenticated;
grant execute on function public.consumir_cota_ia(uuid, integer) to service_role;

grant select on table public.ia_uso_diario to authenticated;
grant all on table public.ia_uso_diario to service_role;
