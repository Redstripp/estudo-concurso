-- Schema do banco usado pelo projeto Estudo Concurso.
-- Este arquivo foi alinhado com a estrutura exportada do Supabase existente.
-- Use em projetos novos; em banco ja existente, compare antes de executar.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  tema text not null default 'claro'::text,
  criado_em timestamptz not null default now(),
  meta_diaria integer default 30,
  meta_minima integer default 5,
  meta_maxima integer default 10,
  constraint profiles_tema_check check (tema in ('claro', 'escuro')),
  constraint profiles_metas_check check (
    meta_minima is null
    or meta_maxima is null
    or (meta_minima > 0 and meta_maxima > 0 and meta_minima <= meta_maxima)
  )
);

create table if not exists public.materias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now(),
  constraint materias_nome_minimo_check check (char_length(trim(nome)) >= 2)
);

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

create table if not exists public.sessoes_estudo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  total_questoes integer not null default 0,
  criado_em timestamptz not null default now(),
  constraint sessoes_estudo_total_check check (total_questoes >= 0),
  unique (user_id, data)
);

create table if not exists public.questoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sessao_id uuid not null references public.sessoes_estudo(id),
  materia_id uuid not null references public.materias(id),
  enunciado text not null,
  alternativas jsonb not null default '[]'::jsonb,
  alternativa_correta text not null,
  alternativa_marcada text not null,
  comentario text,
  criado_em timestamptz not null default now(),
  motivo_erro text,
  nivel_confianca text,
  tipo_questao text not null default 'Errada'::text,
  status_revisao text not null default 'pendente'::text,
  revisar_novamente_em date default current_date,
  revisao_ultima_data date,
  revisao_ultima_resultado text,
  revisao_total_acertos integer not null default 0,
  revisao_total_erros integer not null default 0,
  ultima_confianca_revisao text,
  conceito_chave text,
  como_reconhecer text,
  acao_corretiva text,
  edital_topico_id uuid references public.edital_topicos(id) on delete set null,
  banca text,
  pegadinha_banca text,
  revisao_etapa integer not null default 0,
  constraint questoes_tipo_questao_check check (tipo_questao in ('Errada', 'Chutada')),
  constraint questoes_status_revisao_check check (status_revisao in ('pendente', 'recuperada')),
  constraint questoes_revisao_ultima_resultado_check check (
    revisao_ultima_resultado is null
    or revisao_ultima_resultado in ('Acertou', 'Errou')
  ),
  constraint questoes_ultima_confianca_revisao_check check (
    ultima_confianca_revisao is null
    or ultima_confianca_revisao in ('Chutei', 'Dúvida', 'Confiante')
  ),
  constraint questoes_revisao_totais_check check (
    revisao_total_acertos >= 0
    and revisao_total_erros >= 0
  ),
  constraint questoes_revisao_etapa_check check (revisao_etapa >= 0)
);

create table if not exists public.questoes_certas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sessao_id uuid not null references public.sessoes_estudo(id),
  materia_id uuid not null references public.materias(id),
  quantidade integer not null,
  criado_em timestamptz default now(),
  constraint questoes_certas_quantidade_check check (quantidade > 0)
);

create table if not exists public.questoes_revisoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  questao_id uuid not null references public.questoes(id) on delete cascade,
  data_revisao date not null default current_date,
  resultado text not null,
  revisar_novamente_em date,
  criado_em timestamptz not null default now(),
  resposta_marcada text,
  nivel_confianca text,
  motivo_erro text,
  conceito_chave text,
  como_reconhecer text,
  acao_corretiva text,
  constraint questoes_revisoes_resultado_check check (resultado in ('Acertou', 'Errou')),
  constraint questoes_revisoes_nivel_confianca_check check (
    nivel_confianca is null
    or nivel_confianca in ('Chutei', 'Dúvida', 'Confiante')
  )
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  unlocked_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  unique (user_id, badge_key)
);

create index if not exists user_badges_user_idx
on public.user_badges (user_id, unlocked_at desc);

create table if not exists public.simulados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null default current_date,
  nome text not null,
  banca text,
  total_questoes integer not null,
  certas integer not null,
  erradas integer not null,
  tempo_minutos integer,
  nota_percentual numeric not null,
  comentario text,
  criado_em timestamptz not null default now(),
  constraint simulados_total_check check (total_questoes > 0),
  constraint simulados_certas_check check (certas >= 0),
  constraint simulados_erradas_check check (erradas >= 0),
  constraint simulados_totalizacao_check check (certas + erradas <= total_questoes),
  constraint simulados_tempo_check check (tempo_minutos is null or tempo_minutos >= 0),
  constraint simulados_nota_check check (nota_percentual >= 0 and nota_percentual <= 100)
);

create table if not exists public.plano_dia_materias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  materia_id uuid not null references public.materias(id) on delete cascade,
  meta_questoes integer not null default 10,
  criado_em timestamptz not null default now(),
  constraint plano_dia_materias_meta_check check (meta_questoes > 0),
  unique (user_id, data, materia_id)
);

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

create index if not exists plano_dia_materias_user_data_idx
  on public.plano_dia_materias (user_id, data);

create index if not exists edital_config_user_idx
  on public.edital_config (user_id);

create index if not exists edital_topicos_user_materia_idx
  on public.edital_topicos (user_id, materia_id, status);

create index if not exists pegadinhas_banca_user_idx
  on public.pegadinhas_banca (user_id, materia_id, edital_topico_id);

create index if not exists planejamento_semanal_user_dia_idx
  on public.planejamento_semanal (user_id, dia_semana, ordem);

create index if not exists lei_seca_user_revisao_idx
  on public.lei_seca_itens (user_id, status, revisar_em);

create index if not exists lei_seca_user_materia_idx
  on public.lei_seca_itens (user_id, materia_id, edital_topico_id);

create index if not exists questoes_user_revisao_idx
  on public.questoes (user_id, status_revisao, revisar_novamente_em);

create index if not exists questoes_user_topico_idx
  on public.questoes (user_id, edital_topico_id);

create index if not exists questoes_revisoes_questao_idx
  on public.questoes_revisoes (questao_id, data_revisao desc);

create index if not exists questoes_revisoes_user_data_idx
  on public.questoes_revisoes (user_id, data_revisao desc);

create index if not exists simulados_user_data_idx
  on public.simulados (user_id, data desc);

create index if not exists estatisticas_mensais_user_periodo_idx
  on public.estatisticas_mensais (user_id, periodo_mes desc);

create index if not exists configuracoes_revisao_user_idx
  on public.configuracoes_revisao (user_id);

create index if not exists ia_uso_diario_user_data_idx
  on public.ia_uso_diario (user_id, data desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), 'Usuario')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.materias enable row level security;
alter table public.edital_config enable row level security;
alter table public.edital_topicos enable row level security;
alter table public.pegadinhas_banca enable row level security;
alter table public.planejamento_semanal enable row level security;
alter table public.lei_seca_itens enable row level security;
alter table public.sessoes_estudo enable row level security;
alter table public.questoes enable row level security;
alter table public.questoes_certas enable row level security;
alter table public.questoes_revisoes enable row level security;
alter table public.user_badges enable row level security;
alter table public.simulados enable row level security;
alter table public.plano_dia_materias enable row level security;
alter table public.estatisticas_mensais enable row level security;
alter table public.configuracoes_revisao enable row level security;
alter table public.ia_uso_diario enable row level security;

drop policy if exists perfil_proprio on public.profiles;
create policy perfil_proprio
on public.profiles
for all
using (auth.uid() = id);

drop policy if exists materias_proprias on public.materias;
create policy materias_proprias
on public.materias
for all
using (auth.uid() = user_id);

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

drop policy if exists sessoes_proprias on public.sessoes_estudo;
create policy sessoes_proprias
on public.sessoes_estudo
for all
using (auth.uid() = user_id);

drop policy if exists questoes_proprias on public.questoes;
create policy questoes_proprias
on public.questoes
for all
using (auth.uid() = user_id);

drop policy if exists usuarios_questoes_certas on public.questoes_certas;
create policy usuarios_questoes_certas
on public.questoes_certas
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists questoes_revisoes_proprias on public.questoes_revisoes;
create policy questoes_revisoes_proprias
on public.questoes_revisoes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists user_badges_proprios on public.user_badges;
create policy user_badges_proprios
on public.user_badges
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists simulados_proprios on public.simulados;
create policy simulados_proprios
on public.simulados
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists plano_dia_materias_proprias on public.plano_dia_materias;
create policy plano_dia_materias_proprias
on public.plano_dia_materias
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists estatisticas_mensais_proprias on public.estatisticas_mensais;
create policy estatisticas_mensais_proprias
on public.estatisticas_mensais
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists configuracoes_revisao_proprias on public.configuracoes_revisao;
create policy configuracoes_revisao_proprias
on public.configuracoes_revisao
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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
  on conflict on constraint ia_uso_diario_user_id_data_key do nothing;

  select total_analises
  into v_usado
  from public.ia_uso_diario uso
  where uso.user_id = p_user_id
    and uso.data = v_data
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
  where ia_uso_diario.user_id = p_user_id
    and ia_uso_diario.data = v_data;

  return query
    select true, v_usado, v_limite, greatest(v_limite - v_usado, 0), v_data;
end;
$$;

revoke all on function public.consumir_cota_ia(uuid, integer) from public;
revoke all on function public.consumir_cota_ia(uuid, integer) from anon;
revoke all on function public.consumir_cota_ia(uuid, integer) from authenticated;
grant execute on function public.consumir_cota_ia(uuid, integer) to service_role;

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.materias,
  public.edital_config,
  public.edital_topicos,
  public.pegadinhas_banca,
  public.planejamento_semanal,
  public.lei_seca_itens,
  public.sessoes_estudo,
  public.questoes,
  public.questoes_certas,
  public.questoes_revisoes,
  public.user_badges,
  public.simulados,
  public.plano_dia_materias,
  public.estatisticas_mensais,
  public.configuracoes_revisao
to authenticated;

grant select on table public.ia_uso_diario to authenticated;
grant all on table public.ia_uso_diario to service_role;
