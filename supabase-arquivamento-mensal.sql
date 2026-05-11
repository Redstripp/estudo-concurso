-- Execute este arquivo uma vez no Supabase para habilitar o arquivamento mensal.
-- Ele cria uma tabela de resumos mensais para preservar estatísticas antes da limpeza.

create table if not exists public.estatisticas_mensais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  periodo_mes date not null,
  periodo_inicio date not null,
  periodo_fim date not null,
  total_questoes integer not null default 0,
  total_acertos integer not null default 0,
  total_erradas integer not null default 0,
  total_chutadas integer not null default 0,
  desempenho_por_materia jsonb not null default '[]'::jsonb,
  motivos jsonb not null default '{}'::jsonb,
  confianca jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  arquivado_em timestamptz,
  unique (user_id, periodo_mes),
  constraint estatisticas_mensais_totais_check check (
    total_questoes >= 0
    and total_acertos >= 0
    and total_erradas >= 0
    and total_chutadas >= 0
  )
);

create index if not exists estatisticas_mensais_user_periodo_idx
  on public.estatisticas_mensais (user_id, periodo_mes desc);

alter table public.estatisticas_mensais enable row level security;

drop policy if exists estatisticas_mensais_proprias on public.estatisticas_mensais;
create policy estatisticas_mensais_proprias
on public.estatisticas_mensais
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.estatisticas_mensais to authenticated;
