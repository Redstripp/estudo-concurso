-- RPCs transacionais para CRUD remoto de perfis de pontuacao.
-- Migration local/aditiva: nao aplicar remotamente nesta etapa.

create table if not exists public.scoring_profile_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null,
  operation_id uuid not null,
  request_hash text not null,
  status text not null default 'processing',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, operation_id),
  unique (user_id, operation_type, operation_id),
  constraint scoring_profile_operations_type_check check (
    operation_type in (
      'create_profile',
      'save_current_version',
      'duplicate_profile',
      'create_version',
      'replace_blocks'
    )
  ),
  constraint scoring_profile_operations_status_check check (status in ('processing', 'completed')),
  constraint scoring_profile_operations_hash_check check (char_length(request_hash) >= 16),
  constraint scoring_profile_operations_completed_check check (
    (status = 'processing' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  )
);

alter table public.scoring_profile_operations enable row level security;

create or replace function public.reserve_scoring_profile_operation(
  p_user_id uuid,
  p_operation_type text,
  p_operation_id uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.scoring_profile_operations%rowtype;
begin
  if p_user_id is null then
    raise exception 'auth.uid() is null'
      using errcode = '42501';
  end if;

  if p_operation_id is null then
    raise exception 'scoring_profile_operation_id_required'
      using errcode = '23514';
  end if;

  insert into public.scoring_profile_operations (
    user_id,
    operation_type,
    operation_id,
    request_hash,
    status,
    result
  )
  values (
    p_user_id,
    p_operation_type,
    p_operation_id,
    p_request_hash,
    'processing',
    '{}'::jsonb
  )
  on conflict (user_id, operation_id) do nothing;

  if found then
    return null;
  end if;

  select *
    into v_existing
    from public.scoring_profile_operations
   where user_id = p_user_id
     and operation_id = p_operation_id
   for update;

  if not found then
    raise exception 'scoring_profile_operation_missing'
      using errcode = '23514';
  end if;

  if v_existing.operation_type <> p_operation_type then
    raise exception 'scoring_profile_operation_type_mismatch'
      using errcode = '23505';
  end if;

  if v_existing.request_hash <> p_request_hash then
    raise exception 'scoring_profile_operation_payload_mismatch'
      using errcode = '23505';
  end if;

  if v_existing.status = 'completed' then
    return v_existing.result;
  end if;

  raise exception 'scoring_profile_operation_in_progress'
    using errcode = '55P03';
end;
$$;

create or replace function public.complete_scoring_profile_operation(
  p_user_id uuid,
  p_operation_type text,
  p_operation_id uuid,
  p_request_hash text,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  update public.scoring_profile_operations
     set status = 'completed',
         result = coalesce(p_result, '{}'::jsonb),
         completed_at = now()
   where user_id = p_user_id
     and operation_type = p_operation_type
     and operation_id = p_operation_id
     and request_hash = p_request_hash
     and status = 'processing'
  returning result into v_result;

  if not found then
    raise exception 'scoring_profile_operation_not_reserved'
      using errcode = '23514';
  end if;

  return v_result;
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

  update public.scoring_profile_versions v
     set locked_at = coalesce(v.locked_at, now())
    from public.scoring_profiles p
   where p.id = v.profile_id
     and v.profile_id = new.scoring_profile_id
     and v.version = new.scoring_profile_version
     and (p.scope = 'system' or p.user_id = new.user_id);

  if not found then
    raise exception 'scoring_profile_version_not_found'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.insert_scoring_profile_blocks_from_json(
  p_profile_version_id uuid,
  p_user_id uuid,
  p_blocks jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invalid_count integer;
begin
  if jsonb_typeof(coalesce(p_blocks, '[]'::jsonb)) <> 'array' then
    raise exception 'scoring_profile_blocks_must_be_array'
      using errcode = '23514';
  end if;

  select count(*)
    into invalid_count
    from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) as bloco(item)
   where nullif(trim(coalesce(bloco.item->>'id', bloco.item->>'block_key', bloco.item->>'codigo', bloco.item->>'nome')), '') is null
      or nullif(trim(coalesce(bloco.item->>'nome', bloco.item->>'name', bloco.item->>'id', bloco.item->>'block_key')), '') is null
      or (
        bloco.item ? 'peso'
        and nullif(bloco.item->>'peso', '') is not null
        and (bloco.item->>'peso')::numeric < 0
      )
      or (
        bloco.item ? 'weight'
        and nullif(bloco.item->>'weight', '') is not null
        and (bloco.item->>'weight')::numeric < 0
      )
      or (
        bloco.item ? 'percentualMinimo'
        and nullif(bloco.item->>'percentualMinimo', '') is not null
        and ((bloco.item->>'percentualMinimo')::numeric < 0 or (bloco.item->>'percentualMinimo')::numeric > 100)
      )
      or (
        bloco.item ? 'min_percent'
        and nullif(bloco.item->>'min_percent', '') is not null
        and ((bloco.item->>'min_percent')::numeric < 0 or (bloco.item->>'min_percent')::numeric > 100)
      );

  if invalid_count > 0 then
    raise exception 'scoring_profile_blocks_invalid'
      using errcode = '23514';
  end if;

  insert into public.scoring_profile_blocks (
    profile_version_id,
    user_id,
    block_key,
    name,
    weight,
    min_score,
    min_percent,
    metadata
  )
  select
    p_profile_version_id,
    p_user_id,
    nullif(trim(coalesce(bloco.item->>'id', bloco.item->>'block_key', bloco.item->>'codigo', bloco.item->>'nome')), ''),
    nullif(trim(coalesce(bloco.item->>'nome', bloco.item->>'name', bloco.item->>'id', bloco.item->>'block_key')), ''),
    nullif(coalesce(bloco.item->>'peso', bloco.item->>'weight'), '')::numeric,
    nullif(coalesce(bloco.item->>'notaMinima', bloco.item->>'min_score'), '')::numeric,
    nullif(coalesce(bloco.item->>'percentualMinimo', bloco.item->>'min_percent'), '')::numeric,
    jsonb_strip_nulls(jsonb_build_object(
      'disciplinas', coalesce(bloco.item->'disciplinas', '[]'::jsonb),
      'questoes', coalesce(bloco.item->'questoes', '[]'::jsonb),
      'ordem', bloco.ordem
    ))
  from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) with ordinality as bloco(item, ordem);
end;
$$;

create or replace function public.create_scoring_profile_with_version(
  p_operation_id uuid,
  p_profile_key text,
  p_name text,
  p_description text,
  p_active boolean,
  p_profile_metadata jsonb,
  p_version jsonb,
  p_blocks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_version_id uuid;
  v_profile_key text := nullif(trim(p_profile_key), '');
  v_name text := nullif(trim(p_name), '');
  v_version_number integer := 1;
  v_request_hash text;
  v_existing_result jsonb;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'auth.uid() is null'
      using errcode = '42501';
  end if;

  if v_profile_key is null or char_length(v_profile_key) < 2 then
    raise exception 'scoring_profile_key_invalid'
      using errcode = '23514';
  end if;

  if v_name is null or char_length(v_name) < 2 then
    raise exception 'scoring_profile_name_invalid'
      using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_version, '{}'::jsonb)) <> 'object' then
    raise exception 'scoring_profile_version_must_be_object'
      using errcode = '23514';
  end if;

  v_request_hash = md5(jsonb_build_object(
    'profile_key', v_profile_key,
    'name', v_name,
    'description', nullif(trim(p_description), ''),
    'active', coalesce(p_active, true),
    'profile_metadata', coalesce(p_profile_metadata, '{}'::jsonb),
    'version', coalesce(p_version, '{}'::jsonb),
    'blocks', coalesce(p_blocks, '[]'::jsonb)
  )::text);

  v_existing_result = public.reserve_scoring_profile_operation(v_uid, 'create_profile', p_operation_id, v_request_hash);
  if v_existing_result is not null then
    return v_existing_result;
  end if;

  insert into public.scoring_profiles (
    user_id,
    scope,
    profile_key,
    name,
    description,
    active,
    current_version,
    metadata
  )
  values (
    v_uid,
    'user',
    v_profile_key,
    v_name,
    nullif(trim(p_description), ''),
    coalesce(p_active, true),
    v_version_number,
    coalesce(p_profile_metadata, '{}'::jsonb)
  )
  returning id into v_profile_id;

  insert into public.scoring_profile_versions (
    profile_id,
    user_id,
    version,
    mode,
    rules,
    weights,
    blocks,
    minimum_criteria,
    elimination_criteria,
    rounding,
    metadata
  )
  values (
    v_profile_id,
    v_uid,
    v_version_number,
    coalesce(nullif(p_version->>'mode', ''), 'simple'),
    coalesce(p_version->'rules', '{}'::jsonb),
    coalesce(p_version->'weights', '{}'::jsonb),
    coalesce(p_version->'blocks', '[]'::jsonb),
    coalesce(p_version->'minimum_criteria', '{}'::jsonb),
    coalesce(p_version->'elimination_criteria', '{}'::jsonb),
    coalesce(p_version->'rounding', '{}'::jsonb),
    coalesce(p_version->'metadata', '{}'::jsonb)
  )
  returning id into v_version_id;

  perform public.insert_scoring_profile_blocks_from_json(v_version_id, v_uid, p_blocks);

  v_result = jsonb_build_object(
    'profile_id', v_profile_id,
    'version_id', v_version_id,
    'version', v_version_number
  );

  return public.complete_scoring_profile_operation(v_uid, 'create_profile', p_operation_id, v_request_hash, v_result);
end;
$$;

create or replace function public.save_scoring_profile_current_version(
  p_operation_id uuid,
  p_profile_id uuid,
  p_name text,
  p_description text,
  p_active boolean,
  p_profile_metadata jsonb,
  p_version jsonb,
  p_blocks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.scoring_profiles%rowtype;
  v_version public.scoring_profile_versions%rowtype;
  v_request_hash text;
  v_existing_result jsonb;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'auth.uid() is null'
      using errcode = '42501';
  end if;

  v_request_hash = md5(jsonb_build_object(
    'profile_id', p_profile_id,
    'name', nullif(trim(p_name), ''),
    'description', nullif(trim(p_description), ''),
    'active', p_active,
    'profile_metadata', coalesce(p_profile_metadata, '{}'::jsonb),
    'version', coalesce(p_version, '{}'::jsonb),
    'blocks', coalesce(p_blocks, '[]'::jsonb)
  )::text);

  v_existing_result = public.reserve_scoring_profile_operation(v_uid, 'save_current_version', p_operation_id, v_request_hash);
  if v_existing_result is not null then
    return v_existing_result;
  end if;

  select *
    into v_profile
    from public.scoring_profiles
   where id = p_profile_id
     and scope = 'user'
     and user_id = v_uid
   for update;

  if not found then
    raise exception 'scoring_profile_not_found'
      using errcode = '42501';
  end if;

  select *
    into v_version
    from public.scoring_profile_versions
   where profile_id = p_profile_id
     and version = v_profile.current_version
     and user_id = v_uid
   for update;

  if not found then
    raise exception 'scoring_profile_version_not_found'
      using errcode = '23514';
  end if;

  if v_version.locked_at is not null then
    raise exception 'scoring_profile_version_already_used'
      using errcode = '23514';
  end if;

  update public.scoring_profiles
     set name = nullif(trim(p_name), ''),
         description = nullif(trim(p_description), ''),
         active = coalesce(p_active, active),
         metadata = coalesce(p_profile_metadata, '{}'::jsonb)
   where id = p_profile_id
     and user_id = v_uid;

  update public.scoring_profile_versions
     set mode = coalesce(nullif(p_version->>'mode', ''), mode),
         rules = coalesce(p_version->'rules', rules),
         weights = coalesce(p_version->'weights', weights),
         blocks = coalesce(p_version->'blocks', blocks),
         minimum_criteria = coalesce(p_version->'minimum_criteria', minimum_criteria),
         elimination_criteria = coalesce(p_version->'elimination_criteria', elimination_criteria),
         rounding = coalesce(p_version->'rounding', rounding),
         metadata = coalesce(p_version->'metadata', metadata)
   where id = v_version.id
     and user_id = v_uid;

  delete from public.scoring_profile_blocks
   where profile_version_id = v_version.id
     and user_id = v_uid;

  perform public.insert_scoring_profile_blocks_from_json(v_version.id, v_uid, p_blocks);

  v_result = jsonb_build_object(
    'profile_id', p_profile_id,
    'version_id', v_version.id,
    'version', v_version.version
  );

  return public.complete_scoring_profile_operation(v_uid, 'save_current_version', p_operation_id, v_request_hash, v_result);
end;
$$;

create or replace function public.duplicate_scoring_profile(
  p_operation_id uuid,
  p_source_profile_id uuid,
  p_source_version integer,
  p_profile_key text,
  p_name text,
  p_description text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_source_profile public.scoring_profiles%rowtype;
  v_source_version public.scoring_profile_versions%rowtype;
  v_profile_id uuid;
  v_version_id uuid;
  v_request_hash text;
  v_existing_result jsonb;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'auth.uid() is null'
      using errcode = '42501';
  end if;

  v_request_hash = md5(jsonb_build_object(
    'source_profile_id', p_source_profile_id,
    'source_version', p_source_version,
    'profile_key', nullif(trim(p_profile_key), ''),
    'name', nullif(trim(p_name), ''),
    'description', nullif(trim(p_description), ''),
    'active', coalesce(p_active, true)
  )::text);

  v_existing_result = public.reserve_scoring_profile_operation(v_uid, 'duplicate_profile', p_operation_id, v_request_hash);
  if v_existing_result is not null then
    return v_existing_result;
  end if;

  select *
    into v_source_profile
    from public.scoring_profiles
   where id = p_source_profile_id
     and (scope = 'system' or user_id = v_uid);

  if not found then
    raise exception 'scoring_profile_not_found'
      using errcode = '42501';
  end if;

  select *
    into v_source_version
    from public.scoring_profile_versions
   where profile_id = p_source_profile_id
     and version = coalesce(p_source_version, v_source_profile.current_version);

  if not found then
    raise exception 'scoring_profile_version_not_found'
      using errcode = '23514';
  end if;

  insert into public.scoring_profiles (
    user_id,
    scope,
    profile_key,
    name,
    description,
    active,
    current_version,
    metadata
  )
  values (
    v_uid,
    'user',
    nullif(trim(p_profile_key), ''),
    nullif(trim(p_name), ''),
    coalesce(nullif(trim(p_description), ''), v_source_profile.description),
    coalesce(p_active, true),
    1,
    jsonb_build_object(
      'duplicated_from_profile_id', p_source_profile_id,
      'duplicated_from_version', v_source_version.version
    )
  )
  returning id into v_profile_id;

  insert into public.scoring_profile_versions (
    profile_id,
    user_id,
    version,
    mode,
    rules,
    weights,
    blocks,
    minimum_criteria,
    elimination_criteria,
    rounding,
    metadata
  )
  values (
    v_profile_id,
    v_uid,
    1,
    v_source_version.mode,
    v_source_version.rules,
    v_source_version.weights,
    v_source_version.blocks,
    v_source_version.minimum_criteria,
    v_source_version.elimination_criteria,
    v_source_version.rounding,
    coalesce(v_source_version.metadata, '{}'::jsonb) || jsonb_build_object('duplicated_from_version_id', v_source_version.id)
  )
  returning id into v_version_id;

  insert into public.scoring_profile_blocks (
    profile_version_id,
    user_id,
    block_key,
    name,
    weight,
    min_score,
    min_percent,
    metadata
  )
  select
    v_version_id,
    v_uid,
    block_key,
    name,
    weight,
    min_score,
    min_percent,
    metadata
  from public.scoring_profile_blocks
  where profile_version_id = v_source_version.id;

  if not exists (
    select 1
      from public.scoring_profile_blocks
     where profile_version_id = v_version_id
  ) then
    perform public.insert_scoring_profile_blocks_from_json(v_version_id, v_uid, v_source_version.blocks);
  end if;

  v_result = jsonb_build_object(
    'profile_id', v_profile_id,
    'version_id', v_version_id,
    'version', 1
  );

  return public.complete_scoring_profile_operation(v_uid, 'duplicate_profile', p_operation_id, v_request_hash, v_result);
end;
$$;

create or replace function public.create_scoring_profile_new_version(
  p_operation_id uuid,
  p_profile_id uuid,
  p_name text,
  p_description text,
  p_active boolean,
  p_profile_metadata jsonb,
  p_version jsonb,
  p_blocks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.scoring_profiles%rowtype;
  v_version_number integer;
  v_version_id uuid;
  v_request_hash text;
  v_existing_result jsonb;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'auth.uid() is null'
      using errcode = '42501';
  end if;

  v_request_hash = md5(jsonb_build_object(
    'profile_id', p_profile_id,
    'name', nullif(trim(p_name), ''),
    'description', nullif(trim(p_description), ''),
    'active', p_active,
    'profile_metadata', coalesce(p_profile_metadata, '{}'::jsonb),
    'version', coalesce(p_version, '{}'::jsonb),
    'blocks', coalesce(p_blocks, '[]'::jsonb)
  )::text);

  v_existing_result = public.reserve_scoring_profile_operation(v_uid, 'create_version', p_operation_id, v_request_hash);
  if v_existing_result is not null then
    return v_existing_result;
  end if;

  select *
    into v_profile
    from public.scoring_profiles
   where id = p_profile_id
     and scope = 'user'
     and user_id = v_uid
   for update;

  if not found then
    raise exception 'scoring_profile_not_found'
      using errcode = '42501';
  end if;

  select coalesce(max(version), 0) + 1
    into v_version_number
    from public.scoring_profile_versions
   where profile_id = p_profile_id;

  insert into public.scoring_profile_versions (
    profile_id,
    user_id,
    version,
    mode,
    rules,
    weights,
    blocks,
    minimum_criteria,
    elimination_criteria,
    rounding,
    metadata
  )
  values (
    p_profile_id,
    v_uid,
    v_version_number,
    coalesce(nullif(p_version->>'mode', ''), 'simple'),
    coalesce(p_version->'rules', '{}'::jsonb),
    coalesce(p_version->'weights', '{}'::jsonb),
    coalesce(p_version->'blocks', '[]'::jsonb),
    coalesce(p_version->'minimum_criteria', '{}'::jsonb),
    coalesce(p_version->'elimination_criteria', '{}'::jsonb),
    coalesce(p_version->'rounding', '{}'::jsonb),
    coalesce(p_version->'metadata', '{}'::jsonb)
  )
  returning id into v_version_id;

  perform public.insert_scoring_profile_blocks_from_json(v_version_id, v_uid, p_blocks);

  update public.scoring_profiles
     set name = nullif(trim(p_name), ''),
         description = nullif(trim(p_description), ''),
         active = coalesce(p_active, active),
         current_version = v_version_number,
         metadata = coalesce(p_profile_metadata, '{}'::jsonb)
   where id = p_profile_id
     and user_id = v_uid;

  v_result = jsonb_build_object(
    'profile_id', p_profile_id,
    'version_id', v_version_id,
    'version', v_version_number
  );

  return public.complete_scoring_profile_operation(v_uid, 'create_version', p_operation_id, v_request_hash, v_result);
end;
$$;

create or replace function public.replace_scoring_profile_blocks(
  p_operation_id uuid,
  p_profile_id uuid,
  p_version integer,
  p_blocks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_version public.scoring_profile_versions%rowtype;
  v_request_hash text;
  v_existing_result jsonb;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'auth.uid() is null'
      using errcode = '42501';
  end if;

  v_request_hash = md5(jsonb_build_object(
    'profile_id', p_profile_id,
    'version', p_version,
    'blocks', coalesce(p_blocks, '[]'::jsonb)
  )::text);

  v_existing_result = public.reserve_scoring_profile_operation(v_uid, 'replace_blocks', p_operation_id, v_request_hash);
  if v_existing_result is not null then
    return v_existing_result;
  end if;

  select v.*
    into v_version
    from public.scoring_profile_versions v
    join public.scoring_profiles p on p.id = v.profile_id
   where v.profile_id = p_profile_id
     and v.version = p_version
     and p.scope = 'user'
     and p.user_id = v_uid
     and v.user_id = v_uid
   for update;

  if not found then
    raise exception 'scoring_profile_version_not_found'
      using errcode = '42501';
  end if;

  if v_version.locked_at is not null then
    raise exception 'scoring_profile_version_already_used'
      using errcode = '23514';
  end if;

  delete from public.scoring_profile_blocks
   where profile_version_id = v_version.id
     and user_id = v_uid;

  perform public.insert_scoring_profile_blocks_from_json(v_version.id, v_uid, p_blocks);

  update public.scoring_profile_versions
     set blocks = coalesce(p_blocks, '[]'::jsonb)
   where id = v_version.id
     and user_id = v_uid;

  v_result = jsonb_build_object(
    'profile_id', p_profile_id,
    'version_id', v_version.id,
    'version', v_version.version
  );

  return public.complete_scoring_profile_operation(v_uid, 'replace_blocks', p_operation_id, v_request_hash, v_result);
end;
$$;

revoke all on function public.insert_scoring_profile_blocks_from_json(uuid, uuid, jsonb) from public;
revoke all on function public.reserve_scoring_profile_operation(uuid, text, uuid, text) from public;
revoke all on function public.complete_scoring_profile_operation(uuid, text, uuid, text, jsonb) from public;
revoke all on function public.lock_scoring_profile_version_from_simulado() from public;
revoke all on function public.create_scoring_profile_with_version(uuid, text, text, text, boolean, jsonb, jsonb, jsonb) from public;
revoke all on function public.save_scoring_profile_current_version(uuid, uuid, text, text, boolean, jsonb, jsonb, jsonb) from public;
revoke all on function public.duplicate_scoring_profile(uuid, uuid, integer, text, text, text, boolean) from public;
revoke all on function public.create_scoring_profile_new_version(uuid, uuid, text, text, boolean, jsonb, jsonb, jsonb) from public;
revoke all on function public.replace_scoring_profile_blocks(uuid, uuid, integer, jsonb) from public;

revoke all on table public.scoring_profile_operations from public;
revoke all on table public.scoring_profile_operations from anon;
revoke all on table public.scoring_profile_operations from authenticated;

grant execute on function public.create_scoring_profile_with_version(uuid, text, text, text, boolean, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.save_scoring_profile_current_version(uuid, uuid, text, text, boolean, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.duplicate_scoring_profile(uuid, uuid, integer, text, text, text, boolean) to authenticated;
grant execute on function public.create_scoring_profile_new_version(uuid, uuid, text, text, boolean, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.replace_scoring_profile_blocks(uuid, uuid, integer, jsonb) to authenticated;

comment on table public.scoring_profile_operations
  is 'Registro interno de idempotencia para operacoes transacionais de perfis de pontuacao.';
comment on function public.lock_scoring_profile_version_from_simulado()
  is 'Trava versao usada por simulado somente quando o perfil pertence ao usuario do simulado ou e de sistema.';
comment on function public.create_scoring_profile_with_version(uuid, text, text, text, boolean, jsonb, jsonb, jsonb)
  is 'Cria perfil, primeira versao e blocos em uma unica transacao idempotente usando auth.uid().';
comment on function public.duplicate_scoring_profile(uuid, uuid, integer, text, text, text, boolean)
  is 'Duplica perfil acessivel para um novo perfil do usuario autenticado sem copiar IDs e com retry idempotente.';
comment on function public.create_scoring_profile_new_version(uuid, uuid, text, text, boolean, jsonb, jsonb, jsonb)
  is 'Cria nova versao de perfil proprio e promove current_version de forma atomica e idempotente.';
