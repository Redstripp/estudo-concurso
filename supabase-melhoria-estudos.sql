-- Migracao incremental para bancos que ja tinham as tabelas base do projeto.
-- Em projetos novos, execute supabase/schema.sql em vez deste arquivo.

create extension if not exists pgcrypto;

alter table public.questoes
  add column if not exists motivo_erro text,
  add column if not exists nivel_confianca text,
  add column if not exists tipo_questao text default 'Errada',
  add column if not exists status_revisao text default 'pendente',
  add column if not exists revisar_novamente_em date default current_date,
  add column if not exists revisao_ultima_data date,
  add column if not exists revisao_ultima_resultado text,
  add column if not exists ultima_confianca_revisao text,
  add column if not exists revisao_total_acertos integer default 0,
  add column if not exists revisao_total_erros integer default 0,
  add column if not exists conceito_chave text,
  add column if not exists como_reconhecer text,
  add column if not exists acao_corretiva text;

update public.questoes
set
  tipo_questao = coalesce(tipo_questao, 'Errada'),
  status_revisao = coalesce(status_revisao, 'pendente'),
  revisar_novamente_em = coalesce(revisar_novamente_em, current_date),
  revisao_total_acertos = coalesce(revisao_total_acertos, 0),
  revisao_total_erros = coalesce(revisao_total_erros, 0);

alter table public.questoes
  alter column tipo_questao set not null,
  alter column status_revisao set not null,
  alter column revisao_total_acertos set not null,
  alter column revisao_total_erros set not null;

alter table public.questoes
  drop constraint if exists questoes_motivo_erro_check,
  drop constraint if exists questoes_nivel_confianca_check,
  drop constraint if exists questoes_tipo_questao_check,
  drop constraint if exists questoes_status_revisao_check,
  drop constraint if exists questoes_revisao_ultima_resultado_check,
  drop constraint if exists questoes_ultima_confianca_revisao_check,
  drop constraint if exists questoes_revisao_totais_check;

alter table public.questoes
  add constraint questoes_tipo_questao_check
  check (tipo_questao in ('Errada', 'Chutada')),
  add constraint questoes_status_revisao_check
  check (status_revisao in ('pendente', 'recuperada')),
  add constraint questoes_revisao_ultima_resultado_check
  check (
    revisao_ultima_resultado is null
    or revisao_ultima_resultado in ('Acertou', 'Errou')
  ),
  add constraint questoes_ultima_confianca_revisao_check
  check (
    ultima_confianca_revisao is null
    or ultima_confianca_revisao in ('Chutei', 'Dúvida', 'Confiante')
  ),
  add constraint questoes_revisao_totais_check
  check (revisao_total_acertos >= 0 and revisao_total_erros >= 0);

create index if not exists questoes_user_revisao_idx
  on public.questoes (user_id, status_revisao, revisar_novamente_em);

create table if not exists public.questoes_revisoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  questao_id uuid not null references public.questoes(id) on delete cascade,
  data_revisao date not null default current_date,
  resultado text not null,
  resposta_marcada text,
  revisar_novamente_em date,
  criado_em timestamptz not null default now()
);

alter table public.questoes_revisoes
  add column if not exists resposta_marcada text,
  add column if not exists revisar_novamente_em date,
  add column if not exists nivel_confianca text,
  add column if not exists motivo_erro text,
  add column if not exists conceito_chave text,
  add column if not exists como_reconhecer text,
  add column if not exists acao_corretiva text;

alter table public.questoes_revisoes
  drop constraint if exists questoes_revisoes_resultado_check,
  drop constraint if exists questoes_revisoes_nivel_confianca_check;

alter table public.questoes_revisoes
  add constraint questoes_revisoes_resultado_check
  check (resultado in ('Acertou', 'Errou')),
  add constraint questoes_revisoes_nivel_confianca_check
  check (
    nivel_confianca is null
    or nivel_confianca in ('Chutei', 'Dúvida', 'Confiante')
  );

create index if not exists questoes_revisoes_user_data_idx
  on public.questoes_revisoes (user_id, data_revisao desc);

create index if not exists questoes_revisoes_questao_idx
  on public.questoes_revisoes (questao_id, data_revisao desc);

alter table public.questoes_revisoes enable row level security;

drop policy if exists questoes_revisoes_proprias on public.questoes_revisoes;
create policy questoes_revisoes_proprias
on public.questoes_revisoes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.simulados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null default current_date,
  nome text not null,
  banca text,
  total_questoes integer not null check (total_questoes > 0),
  certas integer not null check (certas >= 0),
  erradas integer not null check (erradas >= 0),
  tempo_minutos integer check (tempo_minutos is null or tempo_minutos >= 0),
  nota_percentual numeric(5,2) not null check (nota_percentual >= 0 and nota_percentual <= 100),
  comentario text,
  criado_em timestamptz not null default now()
);

create index if not exists simulados_user_data_idx
  on public.simulados (user_id, data desc);

alter table public.simulados enable row level security;

drop policy if exists simulados_proprios on public.simulados;
create policy simulados_proprios
on public.simulados
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.plano_dia_materias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  materia_id uuid not null references public.materias(id) on delete cascade,
  meta_questoes integer not null default 10 check (meta_questoes > 0),
  criado_em timestamptz not null default now(),
  unique (user_id, data, materia_id)
);

create index if not exists plano_dia_materias_user_data_idx
  on public.plano_dia_materias (user_id, data);

alter table public.plano_dia_materias enable row level security;

drop policy if exists plano_dia_materias_proprias on public.plano_dia_materias;
create policy plano_dia_materias_proprias
on public.plano_dia_materias
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
