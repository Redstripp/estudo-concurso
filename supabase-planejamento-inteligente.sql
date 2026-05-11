-- Planejamento semanal, fila inteligente e modo Lei Seca.
-- Execute uma vez no SQL Editor do Supabase depois dos SQLs anteriores.

create extension if not exists pgcrypto;

create table if not exists public.planejamento_semanal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dia_semana integer not null,
  materia_id uuid not null references public.materias(id) on delete cascade,
  ordem integer not null default 1,
  meta_questoes integer not null default 20,
  tipo_estudo text not null default 'misto',
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, dia_semana, materia_id),
  constraint planejamento_semanal_dia_check check (dia_semana between 1 and 7),
  constraint planejamento_semanal_meta_check check (meta_questoes > 0),
  constraint planejamento_semanal_tipo_check check (
    tipo_estudo in ('misto', 'teoria', 'questoes', 'revisao', 'lei_seca')
  )
);

create table if not exists public.lei_seca_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  materia_id uuid references public.materias(id) on delete set null,
  edital_topico_id uuid references public.edital_topicos(id) on delete set null,
  norma text,
  artigo text,
  texto text not null,
  importancia integer not null default 3,
  status text not null default 'ler',
  revisao_etapa integer not null default 0,
  revisar_em date default current_date,
  ultima_revisao date,
  total_revisoes integer not null default 0,
  total_erros integer not null default 0,
  anotacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint lei_seca_texto_check check (char_length(trim(texto)) >= 3),
  constraint lei_seca_importancia_check check (importancia between 1 and 5),
  constraint lei_seca_status_check check (status in ('ler', 'revisar', 'dominado')),
  constraint lei_seca_totais_check check (
    revisao_etapa >= 0
    and total_revisoes >= 0
    and total_erros >= 0
  )
);

create index if not exists planejamento_semanal_user_dia_idx
  on public.planejamento_semanal (user_id, dia_semana, ordem);

create index if not exists lei_seca_user_revisao_idx
  on public.lei_seca_itens (user_id, status, revisar_em);

create index if not exists lei_seca_user_materia_idx
  on public.lei_seca_itens (user_id, materia_id, edital_topico_id);

alter table public.planejamento_semanal enable row level security;
alter table public.lei_seca_itens enable row level security;

drop policy if exists planejamento_semanal_proprio on public.planejamento_semanal;
create policy planejamento_semanal_proprio
on public.planejamento_semanal
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists lei_seca_itens_proprios on public.lei_seca_itens;
create policy lei_seca_itens_proprios
on public.lei_seca_itens
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.planejamento_semanal,
  public.lei_seca_itens
to authenticated;
