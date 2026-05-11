-- Configuracao dos dias de revisao por usuario
-- Execute uma vez no SQL Editor do Supabase.

create table if not exists public.configuracoes_revisao (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dias_revisao integer[] not null default array[6],
  tempo_revisao_minutos integer not null default 60,
  ultima_revisao_geral date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint configuracoes_revisao_dias_check check (
    array_length(dias_revisao, 1) between 1 and 7
    and dias_revisao <@ array[1, 2, 3, 4, 5, 6, 7]
  ),
  constraint configuracoes_revisao_tempo_check check (
    tempo_revisao_minutos between 10 and 240
  )
);

create index if not exists configuracoes_revisao_user_idx
  on public.configuracoes_revisao (user_id);

alter table public.configuracoes_revisao enable row level security;

drop policy if exists configuracoes_revisao_proprias on public.configuracoes_revisao;
create policy configuracoes_revisao_proprias
on public.configuracoes_revisao
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.configuracoes_revisao to authenticated;
