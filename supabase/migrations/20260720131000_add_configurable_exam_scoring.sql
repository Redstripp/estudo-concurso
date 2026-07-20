-- Pontuacao configuravel para simulados.
-- Migration local/aditiva: nao regrava simulados antigos e nao toca no scheduler SM-2.

create table if not exists public.scoring_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  scope text not null default 'user',
  profile_key text not null,
  name text not null,
  description text,
  active boolean not null default true,
  current_version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scoring_profiles_scope_check check (scope in ('user', 'system')),
  constraint scoring_profiles_owner_check check (
    (scope = 'system' and user_id is null)
    or (scope = 'user' and user_id is not null)
  ),
  constraint scoring_profiles_version_check check (current_version >= 1),
  constraint scoring_profiles_key_check check (char_length(trim(profile_key)) >= 2),
  constraint scoring_profiles_name_check check (char_length(trim(name)) >= 2)
);

create unique index if not exists scoring_profiles_user_key_uidx
  on public.scoring_profiles (user_id, profile_key)
  where user_id is not null;

create unique index if not exists scoring_profiles_system_key_uidx
  on public.scoring_profiles (profile_key)
  where scope = 'system';

create table if not exists public.scoring_profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.scoring_profiles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  version integer not null,
  mode text not null,
  rules jsonb not null,
  weights jsonb not null default '{}'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  minimum_criteria jsonb not null default '{}'::jsonb,
  elimination_criteria jsonb not null default '{}'::jsonb,
  rounding jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, version),
  constraint scoring_profile_versions_version_check check (version >= 1),
  constraint scoring_profile_versions_mode_check check (mode in ('simple', 'negative_marking', 'weighted', 'hybrid')),
  constraint scoring_profile_versions_rules_object_check check (jsonb_typeof(rules) = 'object'),
  constraint scoring_profile_versions_weights_object_check check (jsonb_typeof(weights) = 'object'),
  constraint scoring_profile_versions_blocks_array_check check (jsonb_typeof(blocks) = 'array')
);

create index if not exists scoring_profile_versions_profile_idx
  on public.scoring_profile_versions (profile_id, version desc);

create table if not exists public.scoring_profile_blocks (
  id uuid primary key default gen_random_uuid(),
  profile_version_id uuid not null references public.scoring_profile_versions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  block_key text not null,
  name text not null,
  weight numeric,
  min_score numeric,
  min_percent numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (profile_version_id, block_key),
  constraint scoring_profile_blocks_key_check check (char_length(trim(block_key)) >= 1),
  constraint scoring_profile_blocks_weight_check check (weight is null or weight >= 0),
  constraint scoring_profile_blocks_min_score_check check (min_score is null or min_score >= 0),
  constraint scoring_profile_blocks_min_percent_check check (min_percent is null or (min_percent >= 0 and min_percent <= 100))
);

alter table public.simulados
  add column if not exists scoring_profile_id uuid references public.scoring_profiles(id) on delete set null,
  add column if not exists scoring_profile_version integer,
  add column if not exists scoring_snapshot jsonb,
  add column if not exists score_raw numeric,
  add column if not exists score_final numeric,
  add column if not exists score_max numeric,
  add column if not exists score_status text,
  add column if not exists score_breakdown jsonb,
  add column if not exists blank_count integer not null default 0,
  add column if not exists annulled_count integer not null default 0;

alter table public.simulados
  drop constraint if exists simulados_scoring_profile_version_check,
  add constraint simulados_scoring_profile_version_check
    check (scoring_profile_version is null or scoring_profile_version >= 1),
  drop constraint if exists simulados_score_max_check,
  add constraint simulados_score_max_check
    check (score_max is null or score_max >= 0),
  drop constraint if exists simulados_score_status_check,
  add constraint simulados_score_status_check
    check (score_status is null or score_status in ('aprovado', 'reprovado', 'eliminado', 'legado')),
  drop constraint if exists simulados_blank_count_check,
  add constraint simulados_blank_count_check
    check (blank_count >= 0),
  drop constraint if exists simulados_annulled_count_check,
  add constraint simulados_annulled_count_check
    check (annulled_count >= 0),
  drop constraint if exists simulados_totalizacao_scoring_check,
  add constraint simulados_totalizacao_scoring_check
    check (certas + erradas + blank_count + annulled_count <= total_questoes);

create index if not exists simulados_scoring_profile_idx
  on public.simulados (user_id, scoring_profile_id, scoring_profile_version);

create or replace function public.touch_scoring_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.lock_scoring_profile_version_from_simulado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scoring_profile_id is null then
    return new;
  end if;

  if new.scoring_profile_version is null then
    raise exception 'scoring_profile_version_required'
      using errcode = '23514';
  end if;

  update public.scoring_profile_versions
     set locked_at = coalesce(locked_at, now())
   where profile_id = new.scoring_profile_id
     and version = new.scoring_profile_version;

  if not found then
    raise exception 'scoring_profile_version_not_found'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_used_scoring_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.simulados s
     where s.scoring_profile_id = old.id
  ) then
    raise exception 'scoring_profile_already_used'
      using errcode = '23514';
  end if;

  return old;
end;
$$;

create or replace function public.prevent_used_scoring_profile_version_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_used boolean;
begin
  select exists (
    select 1
      from public.simulados s
     where s.scoring_profile_id = old.profile_id
       and s.scoring_profile_version = old.version
  )
    into version_used;

  if tg_op = 'UPDATE'
     and old.locked_at is null
     and new.locked_at is not null
     and ((to_jsonb(new) - 'locked_at' - 'updated_at') = (to_jsonb(old) - 'locked_at' - 'updated_at')) then
    return new;
  end if;

  if old.locked_at is not null or version_used then
    raise exception 'scoring_profile_version_already_used'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_used_scoring_profile_block_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_version_id uuid;
  version_used boolean;
begin
  if tg_op = 'INSERT' then
    target_version_id = new.profile_version_id;
  elsif tg_op = 'DELETE' then
    target_version_id = old.profile_version_id;
  else
    target_version_id = old.profile_version_id;

    select (v.locked_at is not null) or exists (
        select 1
          from public.simulados s
         where s.scoring_profile_id = v.profile_id
           and s.scoring_profile_version = v.version
      )
      into version_used
      from public.scoring_profile_versions v
     where v.id = target_version_id;

    if coalesce(version_used, true) then
      raise exception 'scoring_profile_blocks_already_used'
        using errcode = '23514';
    end if;

    target_version_id = new.profile_version_id;
  end if;

  select (v.locked_at is not null) or exists (
      select 1
        from public.simulados s
       where s.scoring_profile_id = v.profile_id
         and s.scoring_profile_version = v.version
    )
    into version_used
    from public.scoring_profile_versions v
   where v.id = target_version_id;

  if coalesce(version_used, true) then
    raise exception 'scoring_profile_blocks_already_used'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists scoring_profiles_touch_updated_at on public.scoring_profiles;
create trigger scoring_profiles_touch_updated_at
before update on public.scoring_profiles
for each row
execute function public.touch_scoring_updated_at();

drop trigger if exists scoring_profile_versions_touch_updated_at on public.scoring_profile_versions;
create trigger scoring_profile_versions_touch_updated_at
before update on public.scoring_profile_versions
for each row
execute function public.touch_scoring_updated_at();

drop trigger if exists scoring_profiles_prevent_used_delete on public.scoring_profiles;
create trigger scoring_profiles_prevent_used_delete
before delete on public.scoring_profiles
for each row
execute function public.prevent_used_scoring_profile_delete();

drop trigger if exists scoring_profile_versions_prevent_used_changes on public.scoring_profile_versions;
create trigger scoring_profile_versions_prevent_used_changes
before update or delete on public.scoring_profile_versions
for each row
execute function public.prevent_used_scoring_profile_version_changes();

drop trigger if exists scoring_profile_blocks_prevent_used_changes on public.scoring_profile_blocks;
create trigger scoring_profile_blocks_prevent_used_changes
before insert or update or delete on public.scoring_profile_blocks
for each row
execute function public.prevent_used_scoring_profile_block_changes();

drop trigger if exists simulados_lock_scoring_profile_version on public.simulados;
create trigger simulados_lock_scoring_profile_version
before insert or update of scoring_profile_id, scoring_profile_version on public.simulados
for each row
execute function public.lock_scoring_profile_version_from_simulado();

alter table public.scoring_profiles enable row level security;
alter table public.scoring_profile_versions enable row level security;
alter table public.scoring_profile_blocks enable row level security;

drop policy if exists scoring_profiles_select_own_or_system on public.scoring_profiles;
create policy scoring_profiles_select_own_or_system
on public.scoring_profiles
for select
using (scope = 'system' or auth.uid() = user_id);

drop policy if exists scoring_profiles_insert_own on public.scoring_profiles;
create policy scoring_profiles_insert_own
on public.scoring_profiles
for insert
with check (scope = 'user' and auth.uid() = user_id);

drop policy if exists scoring_profiles_update_own on public.scoring_profiles;
create policy scoring_profiles_update_own
on public.scoring_profiles
for update
using (scope = 'user' and auth.uid() = user_id)
with check (scope = 'user' and auth.uid() = user_id);

drop policy if exists scoring_profiles_delete_own_unused on public.scoring_profiles;
create policy scoring_profiles_delete_own_unused
on public.scoring_profiles
for delete
using (
  scope = 'user'
  and auth.uid() = user_id
  and not exists (
    select 1
    from public.simulados s
    where s.scoring_profile_id = scoring_profiles.id
  )
);

drop policy if exists scoring_profile_versions_select_own_or_system on public.scoring_profile_versions;
create policy scoring_profile_versions_select_own_or_system
on public.scoring_profile_versions
for select
using (
  exists (
    select 1 from public.scoring_profiles p
    where p.id = profile_id
      and (p.scope = 'system' or p.user_id = auth.uid())
  )
);

drop policy if exists scoring_profile_versions_insert_own on public.scoring_profile_versions;
create policy scoring_profile_versions_insert_own
on public.scoring_profile_versions
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.scoring_profiles p
    where p.id = profile_id
      and p.scope = 'user'
      and p.user_id = auth.uid()
  )
);

drop policy if exists scoring_profile_versions_update_own_unlocked on public.scoring_profile_versions;
create policy scoring_profile_versions_update_own_unlocked
on public.scoring_profile_versions
for update
using (auth.uid() = user_id and locked_at is null)
with check (auth.uid() = user_id);

drop policy if exists scoring_profile_blocks_select_own_or_system on public.scoring_profile_blocks;
create policy scoring_profile_blocks_select_own_or_system
on public.scoring_profile_blocks
for select
using (
  exists (
    select 1
    from public.scoring_profile_versions v
    join public.scoring_profiles p on p.id = v.profile_id
    where v.id = profile_version_id
      and (p.scope = 'system' or p.user_id = auth.uid())
  )
);

drop policy if exists scoring_profile_blocks_insert_own on public.scoring_profile_blocks;
create policy scoring_profile_blocks_insert_own
on public.scoring_profile_blocks
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.scoring_profile_versions v
    join public.scoring_profiles p on p.id = v.profile_id
    where v.id = profile_version_id
      and p.scope = 'user'
      and p.user_id = auth.uid()
      and v.locked_at is null
  )
);

drop policy if exists scoring_profile_blocks_update_own on public.scoring_profile_blocks;
create policy scoring_profile_blocks_update_own
on public.scoring_profile_blocks
for update
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.scoring_profile_versions v
    join public.scoring_profiles p on p.id = v.profile_id
    where v.id = profile_version_id
      and p.scope = 'user'
      and p.user_id = auth.uid()
      and v.locked_at is null
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.scoring_profile_versions v
    join public.scoring_profiles p on p.id = v.profile_id
    where v.id = profile_version_id
      and p.scope = 'user'
      and p.user_id = auth.uid()
      and v.locked_at is null
  )
);

revoke all on table public.scoring_profiles from public;
revoke all on table public.scoring_profiles from anon;
revoke all on table public.scoring_profile_versions from public;
revoke all on table public.scoring_profile_versions from anon;
revoke all on table public.scoring_profile_blocks from public;
revoke all on table public.scoring_profile_blocks from anon;

grant select, insert, update, delete on table public.scoring_profiles to authenticated;
grant select, insert, update on table public.scoring_profile_versions to authenticated;
grant select, insert, update on table public.scoring_profile_blocks to authenticated;

revoke all on function public.touch_scoring_updated_at() from public;
revoke all on function public.lock_scoring_profile_version_from_simulado() from public;
revoke all on function public.prevent_used_scoring_profile_delete() from public;
revoke all on function public.prevent_used_scoring_profile_version_changes() from public;
revoke all on function public.prevent_used_scoring_profile_block_changes() from public;

comment on table public.scoring_profiles is 'Perfis configuraveis de pontuacao de simulados; isolados por usuario ou marcados como sistema.';
comment on table public.scoring_profile_versions is 'Versoes imutaveis de perfis de pontuacao apos uso em simulados.';
comment on table public.scoring_profile_blocks is 'Blocos opcionais por versao de perfil de pontuacao.';
comment on column public.simulados.scoring_snapshot is 'Snapshot autossuficiente da regra de pontuacao usada no simulado.';
