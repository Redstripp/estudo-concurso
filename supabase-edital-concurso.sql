-- Melhorias voltadas a concurso:
-- edital verticalizado, reta final, pegadinhas da banca e ciclo 24h/7d/30d.
-- Execute uma vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.edital_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  concurso_alvo text,
  data_prova date,
  meta_questoes_reta_final integer default 30,
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  constraint edital_config_meta_check check (
    meta_questoes_reta_final is null
    or meta_questoes_reta_final > 0
  )
);

create table if not exists public.edital_topicos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  materia_id uuid not null references public.materias(id) on delete cascade,
  titulo text not null,
  status text not null default 'nao_estudado',
  peso integer not null default 3,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint edital_topicos_titulo_check check (char_length(trim(titulo)) >= 2),
  constraint edital_topicos_status_check check (
    status in ('nao_estudado', 'estudado', 'revisar', 'dominado', 'dificuldade')
  ),
  constraint edital_topicos_peso_check check (peso between 1 and 5)
);

create table if not exists public.pegadinhas_banca (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  materia_id uuid references public.materias(id) on delete set null,
  edital_topico_id uuid references public.edital_topicos(id) on delete set null,
  banca text,
  padrao text not null,
  exemplo text,
  acao text,
  criado_em timestamptz not null default now(),
  constraint pegadinhas_banca_padrao_check check (char_length(trim(padrao)) >= 3)
);

alter table public.questoes
  add column if not exists edital_topico_id uuid references public.edital_topicos(id) on delete set null;

alter table public.questoes
  add column if not exists banca text;

alter table public.questoes
  add column if not exists pegadinha_banca text;

alter table public.questoes
  add column if not exists revisao_etapa integer not null default 0;

do $$
begin
  alter table public.questoes
    add constraint questoes_revisao_etapa_check check (revisao_etapa >= 0);
exception
  when duplicate_object then null;
end $$;

create index if not exists edital_config_user_idx
  on public.edital_config (user_id);

create index if not exists edital_topicos_user_materia_idx
  on public.edital_topicos (user_id, materia_id, status);

create index if not exists pegadinhas_banca_user_idx
  on public.pegadinhas_banca (user_id, materia_id, edital_topico_id);

create index if not exists questoes_user_topico_idx
  on public.questoes (user_id, edital_topico_id);

alter table public.edital_config enable row level security;
alter table public.edital_topicos enable row level security;
alter table public.pegadinhas_banca enable row level security;

drop policy if exists edital_config_propria on public.edital_config;
create policy edital_config_propria
on public.edital_config
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists edital_topicos_proprios on public.edital_topicos;
create policy edital_topicos_proprios
on public.edital_topicos
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists pegadinhas_banca_proprias on public.pegadinhas_banca;
create policy pegadinhas_banca_proprias
on public.pegadinhas_banca
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.edital_config,
  public.edital_topicos,
  public.pegadinhas_banca
to authenticated;
