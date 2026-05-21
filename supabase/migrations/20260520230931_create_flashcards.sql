-- Estrutura inicial dos flashcards.
-- Objetivo: criar apenas tabelas, constraints, RLS, policies, grants e indices.
-- Esta migration nao altera dados existentes, nao cria tela e nao conecta o SM-2 ao frontend.

begin;

-- 1. Tabela principal dos flashcards.
-- Cada card pertence a um usuario autenticado e pode ser associado opcionalmente
-- a uma materia ja existente. Os campos de SM-2 ficam persistidos por card.
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  materia_id uuid null references public.materias(id) on delete set null,
  frente text not null,
  verso text not null,
  tags text[] default '{}'::text[],
  ativo boolean not null default true,
  estado text not null default 'novo',
  ease_factor numeric not null default 2.5,
  repetitions integer not null default 0,
  interval_days integer not null default 1,
  due_date date not null default current_date,
  last_reviewed_at timestamptz null,
  total_reviews integer not null default 0,
  correct_reviews integer not null default 0,
  lapses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flashcards_estado_check check (estado in ('novo', 'aprendendo', 'revisando')),
  constraint flashcards_ease_factor_check check (ease_factor >= 1.3),
  constraint flashcards_repetitions_check check (repetitions >= 0),
  constraint flashcards_interval_days_check check (interval_days >= 1),
  constraint flashcards_total_reviews_check check (total_reviews >= 0),
  constraint flashcards_correct_reviews_check check (correct_reviews >= 0),
  constraint flashcards_lapses_check check (lapses >= 0),
  constraint flashcards_frente_check check (char_length(trim(frente)) > 0),
  constraint flashcards_verso_check check (char_length(trim(verso)) > 0)
);

-- 2. Tabela de historico das revisoes.
-- Mantem o registro de cada avaliacao sem permitir edicao ou remocao pelo
-- frontend autenticado nesta primeira etapa.
create table if not exists public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  quality integer not null,
  reviewed_at timestamptz not null default now(),
  old_interval_days integer null,
  new_interval_days integer null,
  old_ease_factor numeric null,
  new_ease_factor numeric null,
  old_repetitions integer null,
  new_repetitions integer null,
  was_correct boolean not null,
  constraint flashcard_reviews_quality_check check (quality between 0 and 5),
  constraint flashcard_reviews_old_interval_days_check check (
    old_interval_days is null or old_interval_days >= 1
  ),
  constraint flashcard_reviews_new_interval_days_check check (
    new_interval_days is null or new_interval_days >= 1
  ),
  constraint flashcard_reviews_old_ease_factor_check check (
    old_ease_factor is null or old_ease_factor >= 1.3
  ),
  constraint flashcard_reviews_new_ease_factor_check check (
    new_ease_factor is null or new_ease_factor >= 1.3
  ),
  constraint flashcard_reviews_old_repetitions_check check (
    old_repetitions is null or old_repetitions >= 0
  ),
  constraint flashcard_reviews_new_repetitions_check check (
    new_repetitions is null or new_repetitions >= 0
  )
);

-- 3. Indices para consultas principais da funcionalidade.
-- Cobrem listagem por usuario, revisoes do dia, filtros por estado/ativo
-- e historico por card ou por periodo.
create index if not exists flashcards_user_id_idx
  on public.flashcards (user_id);

create index if not exists flashcards_user_due_date_idx
  on public.flashcards (user_id, due_date);

create index if not exists flashcards_user_estado_idx
  on public.flashcards (user_id, estado);

create index if not exists flashcards_user_ativo_idx
  on public.flashcards (user_id, ativo);

create index if not exists flashcard_reviews_user_id_idx
  on public.flashcard_reviews (user_id);

create index if not exists flashcard_reviews_flashcard_id_idx
  on public.flashcard_reviews (flashcard_id);

create index if not exists flashcard_reviews_user_reviewed_at_idx
  on public.flashcard_reviews (user_id, reviewed_at);

-- 4. RLS das tabelas de flashcards.
-- As policies abaixo restringem cada usuario autenticado aos proprios dados.
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;

drop policy if exists flashcards_select_proprios on public.flashcards;
create policy flashcards_select_proprios
on public.flashcards
for select
using (auth.uid() = user_id);

drop policy if exists flashcards_insert_proprios on public.flashcards;
create policy flashcards_insert_proprios
on public.flashcards
for insert
with check (auth.uid() = user_id);

drop policy if exists flashcards_update_proprios on public.flashcards;
create policy flashcards_update_proprios
on public.flashcards
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists flashcards_delete_proprios on public.flashcards;
create policy flashcards_delete_proprios
on public.flashcards
for delete
using (auth.uid() = user_id);

drop policy if exists flashcard_reviews_select_proprias on public.flashcard_reviews;
create policy flashcard_reviews_select_proprias
on public.flashcard_reviews
for select
using (auth.uid() = user_id);

drop policy if exists flashcard_reviews_insert_proprias on public.flashcard_reviews;
create policy flashcard_reviews_insert_proprias
on public.flashcard_reviews
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.flashcards
    where flashcards.id = flashcard_reviews.flashcard_id
      and flashcards.user_id = auth.uid()
  )
);

-- 5. Grants seguros.
-- PUBLIC e anon ficam sem privilegios diretos. authenticated recebe apenas
-- as operacoes necessarias, sem TRUNCATE, REFERENCES ou TRIGGER.
revoke all privileges on table
  public.flashcards,
  public.flashcard_reviews
from public;

revoke all privileges on table
  public.flashcards,
  public.flashcard_reviews
from anon;

revoke all privileges on table
  public.flashcards,
  public.flashcard_reviews
from authenticated;

grant select, insert, update, delete on table public.flashcards to authenticated;
grant select, insert on table public.flashcard_reviews to authenticated;

commit;
