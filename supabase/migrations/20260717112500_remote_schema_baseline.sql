-- Baseline canonico do banco remoto de desenvolvimento antes do SM-2.
-- Gerado a partir de snapshot somente-leitura do schema remoto em 2026-07-17.
-- Nao representa registro remoto em supabase_migrations; isso exige autorizacao futura.

create schema if not exists "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

set check_function_bodies = false;

create schema if not exists "public";
CREATE FUNCTION "public"."consumir_cota_ia"("p_user_id" "uuid", "p_limite" integer DEFAULT 20) RETURNS TABLE("permitido" boolean, "usado" integer, "limite" integer, "restante" integer, "data" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
CREATE FUNCTION "public"."criar_perfil_automatico"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE FUNCTION "public"."obter_resumo_gamificacao"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
with usuario as (
  select auth.uid() as user_id
),
questoes_usuario as (
  select q.*
  from public.questoes q
  join usuario u on q.user_id = u.user_id
),
resumo_questoes as (
  select
    count(*)::integer as total_questoes,
    (count(*) filter (
      where char_length(trim(coalesce(conceito_chave, ''))) >= 3
        and char_length(trim(coalesce(como_reconhecer, ''))) >= 3
        and char_length(trim(coalesce(acao_corretiva, ''))) >= 3
    ))::integer as total_diagnostico_completo,
    (count(*) filter (
      where lower(trim(coalesce(motivo_erro, ''))) not in ('', 'a diagnosticar', 'nao informado', 'não informado')
        and lower(trim(coalesce(nivel_confianca, ''))) not in ('', 'a diagnosticar', 'nao informado', 'não informado')
        and char_length(trim(coalesce(conceito_chave, ''))) >= 8
        and char_length(trim(coalesce(como_reconhecer, ''))) >= 8
        and char_length(trim(coalesce(acao_corretiva, ''))) >= 8
        and char_length(trim(coalesce(comentario, ''))) >= 8
    ))::integer as total_diagnostico_forte
  from questoes_usuario
),
motivo_contagens as (
  select count(*)::integer as total
  from questoes_usuario
  where lower(trim(coalesce(motivo_erro, ''))) not in ('', 'a diagnosticar', 'nao informado', 'não informado')
  group by trim(motivo_erro)
),
revisoes as (
  select (
    exists (
      select 1
      from public.questoes_revisoes r
      join usuario u on r.user_id = u.user_id
    )
    or exists (
      select 1
      from public.configuracoes_revisao c
      join usuario u on c.user_id = u.user_id
      where c.ultima_revisao_geral is not null
    )
  ) as revisao_concluida
),
dias_atividade as (
  select distinct dia
  from (
    select q.criado_em::date as dia
    from public.questoes q
    join usuario u on q.user_id = u.user_id
    union
    select qc.criado_em::date as dia
    from public.questoes_certas qc
    join usuario u on qc.user_id = u.user_id
    union
    select c.ultima_revisao_geral::date as dia
    from public.configuracoes_revisao c
    join usuario u on c.user_id = u.user_id
    where c.ultima_revisao_geral is not null
  ) atividade
  where dia is not null
),
dias_ordenados as (
  select
    dia,
    dia - (row_number() over (order by dia))::integer as grupo
  from dias_atividade
),
base_streak as (
  select case
    when exists (select 1 from dias_atividade where dia = current_date) then current_date
    when exists (select 1 from dias_atividade where dia = current_date - 1) then current_date - 1
    else null::date
  end as dia
),
streak_atual as (
  select count(atual.dia)::integer as total
  from base_streak b
  left join dias_ordenados base on base.dia = b.dia
  left join dias_ordenados atual
    on atual.grupo = base.grupo
   and atual.dia <= b.dia
),
recorde_streak as (
  select coalesce(max(total), 0)::integer as total
  from (
    select count(*)::integer as total
    from dias_ordenados
    group by grupo
  ) sequencias
)
select jsonb_build_object(
  'total_questoes', (select total_questoes from resumo_questoes),
  'total_diagnostico_completo', (select total_diagnostico_completo from resumo_questoes),
  'total_diagnostico_forte', (select total_diagnostico_forte from resumo_questoes),
  'motivo_repetido', coalesce((select bool_or(total >= 5) from motivo_contagens), false),
  'revisao_concluida', (select revisao_concluida from revisoes),
  'streak', (select total from streak_atual),
  'recorde', greatest((select total from recorde_streak), (select total from streak_atual)),
  'atividade_hoje', exists (select 1 from dias_atividade where dia = current_date),
  'sequencia_em_risco', (
    (select total from streak_atual) > 0
    and not exists (select 1 from dias_atividade where dia = current_date)
  )
);
$$;
CREATE TABLE "public"."configuracoes_revisao" (
    "user_id" "uuid" NOT NULL,
    "dias_revisao" integer[] DEFAULT ARRAY[6] NOT NULL,
    "tempo_revisao_minutos" integer DEFAULT 60 NOT NULL,
    "ultima_revisao_geral" "date",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "configuracoes_revisao_dias_check" CHECK (((("array_length"("dias_revisao", 1) >= 1) AND ("array_length"("dias_revisao", 1) <= 7)) AND ("dias_revisao" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]))),
    CONSTRAINT "configuracoes_revisao_tempo_check" CHECK ((("tempo_revisao_minutos" >= 10) AND ("tempo_revisao_minutos" <= 240)))
);
CREATE TABLE "public"."edital_config" (
    "user_id" "uuid" NOT NULL,
    "concurso_alvo" "text",
    "data_prova" "date",
    "meta_questoes_reta_final" integer DEFAULT 30,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "edital_config_meta_check" CHECK ((("meta_questoes_reta_final" IS NULL) OR ("meta_questoes_reta_final" > 0)))
);
CREATE TABLE "public"."edital_topicos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "materia_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "status" "text" DEFAULT 'nao_estudado'::"text" NOT NULL,
    "peso" integer DEFAULT 3 NOT NULL,
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "edital_topicos_peso_check" CHECK ((("peso" >= 1) AND ("peso" <= 5))),
    CONSTRAINT "edital_topicos_status_check" CHECK (("status" = ANY (ARRAY['nao_estudado'::"text", 'estudado'::"text", 'revisar'::"text", 'dominado'::"text", 'dificuldade'::"text"]))),
    CONSTRAINT "edital_topicos_titulo_check" CHECK (("char_length"(TRIM(BOTH FROM "titulo")) >= 2))
);
CREATE TABLE "public"."estatisticas_mensais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "periodo_mes" "date" NOT NULL,
    "periodo_inicio" "date" NOT NULL,
    "periodo_fim" "date" NOT NULL,
    "total_questoes" integer DEFAULT 0 NOT NULL,
    "total_acertos" integer DEFAULT 0 NOT NULL,
    "total_erradas" integer DEFAULT 0 NOT NULL,
    "total_chutadas" integer DEFAULT 0 NOT NULL,
    "desempenho_por_materia" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "motivos" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "confianca" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "arquivado_em" timestamp with time zone,
    CONSTRAINT "estatisticas_mensais_totais_check" CHECK ((("total_questoes" >= 0) AND ("total_acertos" >= 0) AND ("total_erradas" >= 0) AND ("total_chutadas" >= 0)))
);
CREATE TABLE "public"."flashcard_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "flashcard_id" "uuid" NOT NULL,
    "quality" integer NOT NULL,
    "reviewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "old_interval_days" integer,
    "new_interval_days" integer,
    "old_ease_factor" numeric,
    "new_ease_factor" numeric,
    "old_repetitions" integer,
    "new_repetitions" integer,
    "was_correct" boolean NOT NULL,
    CONSTRAINT "flashcard_reviews_new_ease_factor_check" CHECK ((("new_ease_factor" IS NULL) OR ("new_ease_factor" >= 1.3))),
    CONSTRAINT "flashcard_reviews_new_interval_days_check" CHECK ((("new_interval_days" IS NULL) OR ("new_interval_days" >= 1))),
    CONSTRAINT "flashcard_reviews_new_repetitions_check" CHECK ((("new_repetitions" IS NULL) OR ("new_repetitions" >= 0))),
    CONSTRAINT "flashcard_reviews_old_ease_factor_check" CHECK ((("old_ease_factor" IS NULL) OR ("old_ease_factor" >= 1.3))),
    CONSTRAINT "flashcard_reviews_old_interval_days_check" CHECK ((("old_interval_days" IS NULL) OR ("old_interval_days" >= 1))),
    CONSTRAINT "flashcard_reviews_old_repetitions_check" CHECK ((("old_repetitions" IS NULL) OR ("old_repetitions" >= 0))),
    CONSTRAINT "flashcard_reviews_quality_check" CHECK ((("quality" >= 0) AND ("quality" <= 5)))
);
CREATE TABLE "public"."flashcards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "materia_id" "uuid",
    "frente" "text" NOT NULL,
    "verso" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "ativo" boolean DEFAULT true NOT NULL,
    "estado" "text" DEFAULT 'novo'::"text" NOT NULL,
    "ease_factor" numeric DEFAULT 2.5 NOT NULL,
    "repetitions" integer DEFAULT 0 NOT NULL,
    "interval_days" integer DEFAULT 1 NOT NULL,
    "due_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "last_reviewed_at" timestamp with time zone,
    "total_reviews" integer DEFAULT 0 NOT NULL,
    "correct_reviews" integer DEFAULT 0 NOT NULL,
    "lapses" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "flashcards_correct_reviews_check" CHECK (("correct_reviews" >= 0)),
    CONSTRAINT "flashcards_ease_factor_check" CHECK (("ease_factor" >= 1.3)),
    CONSTRAINT "flashcards_estado_check" CHECK (("estado" = ANY (ARRAY['novo'::"text", 'aprendendo'::"text", 'revisando'::"text"]))),
    CONSTRAINT "flashcards_frente_check" CHECK (("char_length"(TRIM(BOTH FROM "frente")) > 0)),
    CONSTRAINT "flashcards_interval_days_check" CHECK (("interval_days" >= 1)),
    CONSTRAINT "flashcards_lapses_check" CHECK (("lapses" >= 0)),
    CONSTRAINT "flashcards_repetitions_check" CHECK (("repetitions" >= 0)),
    CONSTRAINT "flashcards_total_reviews_check" CHECK (("total_reviews" >= 0)),
    CONSTRAINT "flashcards_verso_check" CHECK (("char_length"(TRIM(BOTH FROM "verso")) > 0))
);
CREATE TABLE "public"."ia_uso_diario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "data" "date" DEFAULT CURRENT_DATE NOT NULL,
    "total_analises" integer DEFAULT 0 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ia_uso_diario_total_check" CHECK (("total_analises" >= 0))
);
CREATE TABLE "public"."lei_seca_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "materia_id" "uuid",
    "edital_topico_id" "uuid",
    "norma" "text",
    "artigo" "text",
    "texto" "text" NOT NULL,
    "importancia" integer DEFAULT 3 NOT NULL,
    "status" "text" DEFAULT 'ler'::"text" NOT NULL,
    "revisao_etapa" integer DEFAULT 0 NOT NULL,
    "revisar_em" "date" DEFAULT CURRENT_DATE,
    "ultima_revisao" "date",
    "total_revisoes" integer DEFAULT 0 NOT NULL,
    "total_erros" integer DEFAULT 0 NOT NULL,
    "anotacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lei_seca_importancia_check" CHECK ((("importancia" >= 1) AND ("importancia" <= 5))),
    CONSTRAINT "lei_seca_status_check" CHECK (("status" = ANY (ARRAY['ler'::"text", 'revisar'::"text", 'dominado'::"text"]))),
    CONSTRAINT "lei_seca_texto_check" CHECK (("char_length"(TRIM(BOTH FROM "texto")) >= 3)),
    CONSTRAINT "lei_seca_totais_check" CHECK ((("revisao_etapa" >= 0) AND ("total_revisoes" >= 0) AND ("total_erros" >= 0)))
);
CREATE TABLE "public"."materias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE TABLE "public"."pegadinhas_banca" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "materia_id" "uuid",
    "edital_topico_id" "uuid",
    "banca" "text",
    "padrao" "text" NOT NULL,
    "exemplo" "text",
    "acao" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pegadinhas_banca_padrao_check" CHECK (("char_length"(TRIM(BOTH FROM "padrao")) >= 3))
);
CREATE TABLE "public"."planejamento_semanal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "dia_semana" integer NOT NULL,
    "materia_id" "uuid" NOT NULL,
    "ordem" integer DEFAULT 1 NOT NULL,
    "meta_questoes" integer DEFAULT 20 NOT NULL,
    "tipo_estudo" "text" DEFAULT 'misto'::"text" NOT NULL,
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "planejamento_semanal_dia_check" CHECK ((("dia_semana" >= 1) AND ("dia_semana" <= 7))),
    CONSTRAINT "planejamento_semanal_meta_check" CHECK (("meta_questoes" > 0)),
    CONSTRAINT "planejamento_semanal_tipo_check" CHECK (("tipo_estudo" = ANY (ARRAY['misto'::"text", 'teoria'::"text", 'questoes'::"text", 'revisao'::"text", 'lei_seca'::"text"])))
);
CREATE TABLE "public"."plano_dia_materias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "materia_id" "uuid" NOT NULL,
    "meta_questoes" integer DEFAULT 10 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plano_dia_materias_meta_questoes_check" CHECK (("meta_questoes" > 0))
);
CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "tema" "text" DEFAULT 'claro'::"text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta_diaria" integer DEFAULT 30,
    "meta_minima" integer DEFAULT 5,
    "meta_maxima" integer DEFAULT 10,
    CONSTRAINT "profiles_tema_check" CHECK (("tema" = ANY (ARRAY['claro'::"text", 'escuro'::"text"])))
);
CREATE TABLE "public"."questoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sessao_id" "uuid" NOT NULL,
    "materia_id" "uuid" NOT NULL,
    "enunciado" "text" NOT NULL,
    "alternativas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "alternativa_correta" "text" NOT NULL,
    "alternativa_marcada" "text" NOT NULL,
    "comentario" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "motivo_erro" "text",
    "nivel_confianca" "text",
    "tipo_questao" "text" DEFAULT 'Errada'::"text" NOT NULL,
    "status_revisao" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "revisar_novamente_em" "date" DEFAULT CURRENT_DATE,
    "revisao_ultima_data" "date",
    "revisao_ultima_resultado" "text",
    "revisao_total_acertos" integer DEFAULT 0 NOT NULL,
    "revisao_total_erros" integer DEFAULT 0 NOT NULL,
    "ultima_confianca_revisao" "text",
    "conceito_chave" "text",
    "como_reconhecer" "text",
    "acao_corretiva" "text",
    "edital_topico_id" "uuid",
    "banca" "text",
    "pegadinha_banca" "text",
    "revisao_etapa" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "questoes_revisao_etapa_check" CHECK (("revisao_etapa" >= 0)),
    CONSTRAINT "questoes_revisao_totais_check" CHECK ((("revisao_total_acertos" >= 0) AND ("revisao_total_erros" >= 0))),
    CONSTRAINT "questoes_revisao_ultima_resultado_check" CHECK ((("revisao_ultima_resultado" IS NULL) OR ("revisao_ultima_resultado" = ANY (ARRAY['Acertou'::"text", 'Errou'::"text"])))),
    CONSTRAINT "questoes_status_revisao_check" CHECK (("status_revisao" = ANY (ARRAY['pendente'::"text", 'recuperada'::"text"]))),
    CONSTRAINT "questoes_tipo_questao_check" CHECK (("tipo_questao" = ANY (ARRAY['Errada'::"text", 'Chutada'::"text"]))),
    CONSTRAINT "questoes_ultima_confianca_revisao_check" CHECK ((("ultima_confianca_revisao" IS NULL) OR ("ultima_confianca_revisao" = ANY (ARRAY['Chutei'::"text", 'Dúvida'::"text", 'Confiante'::"text"]))))
);
CREATE TABLE "public"."questoes_certas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sessao_id" "uuid" NOT NULL,
    "materia_id" "uuid" NOT NULL,
    "quantidade" integer NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "questoes_certas_quantidade_check" CHECK (("quantidade" > 0))
);
CREATE TABLE "public"."questoes_revisoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "questao_id" "uuid" NOT NULL,
    "data_revisao" "date" DEFAULT CURRENT_DATE NOT NULL,
    "resultado" "text" NOT NULL,
    "revisar_novamente_em" "date",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resposta_marcada" "text",
    "nivel_confianca" "text",
    "motivo_erro" "text",
    "conceito_chave" "text",
    "como_reconhecer" "text",
    "acao_corretiva" "text",
    CONSTRAINT "questoes_revisoes_nivel_confianca_check" CHECK ((("nivel_confianca" IS NULL) OR ("nivel_confianca" = ANY (ARRAY['Chutei'::"text", 'Dúvida'::"text", 'Confiante'::"text"])))),
    CONSTRAINT "questoes_revisoes_resultado_check" CHECK (("resultado" = ANY (ARRAY['Acertou'::"text", 'Errou'::"text"])))
);
CREATE TABLE "public"."sessoes_estudo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "total_questoes" integer DEFAULT 0 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sessoes_estudo_total_questoes_check" CHECK (("total_questoes" >= 0))
);
CREATE TABLE "public"."simulados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "data" "date" DEFAULT CURRENT_DATE NOT NULL,
    "nome" "text" NOT NULL,
    "banca" "text",
    "total_questoes" integer NOT NULL,
    "certas" integer NOT NULL,
    "erradas" integer NOT NULL,
    "tempo_minutos" integer,
    "nota_percentual" numeric(5,2) NOT NULL,
    "comentario" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "simulados_certas_check" CHECK (("certas" >= 0)),
    CONSTRAINT "simulados_erradas_check" CHECK (("erradas" >= 0)),
    CONSTRAINT "simulados_nota_percentual_check" CHECK ((("nota_percentual" >= (0)::numeric) AND ("nota_percentual" <= (100)::numeric))),
    CONSTRAINT "simulados_tempo_minutos_check" CHECK ((("tempo_minutos" IS NULL) OR ("tempo_minutos" >= 0))),
    CONSTRAINT "simulados_total_questoes_check" CHECK (("total_questoes" > 0))
);
CREATE TABLE "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_key" "text" NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);
ALTER TABLE ONLY "public"."configuracoes_revisao"
    ADD CONSTRAINT "configuracoes_revisao_pkey" PRIMARY KEY ("user_id");
ALTER TABLE ONLY "public"."edital_config"
    ADD CONSTRAINT "edital_config_pkey" PRIMARY KEY ("user_id");
ALTER TABLE ONLY "public"."edital_topicos"
    ADD CONSTRAINT "edital_topicos_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."estatisticas_mensais"
    ADD CONSTRAINT "estatisticas_mensais_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."estatisticas_mensais"
    ADD CONSTRAINT "estatisticas_mensais_user_id_periodo_mes_key" UNIQUE ("user_id", "periodo_mes");
ALTER TABLE ONLY "public"."flashcard_reviews"
    ADD CONSTRAINT "flashcard_reviews_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."flashcards"
    ADD CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."ia_uso_diario"
    ADD CONSTRAINT "ia_uso_diario_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."ia_uso_diario"
    ADD CONSTRAINT "ia_uso_diario_user_id_data_key" UNIQUE ("user_id", "data");
ALTER TABLE ONLY "public"."lei_seca_itens"
    ADD CONSTRAINT "lei_seca_itens_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."materias"
    ADD CONSTRAINT "materias_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."pegadinhas_banca"
    ADD CONSTRAINT "pegadinhas_banca_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."planejamento_semanal"
    ADD CONSTRAINT "planejamento_semanal_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."planejamento_semanal"
    ADD CONSTRAINT "planejamento_semanal_user_id_dia_semana_materia_id_key" UNIQUE ("user_id", "dia_semana", "materia_id");
ALTER TABLE ONLY "public"."plano_dia_materias"
    ADD CONSTRAINT "plano_dia_materias_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."plano_dia_materias"
    ADD CONSTRAINT "plano_dia_materias_user_id_data_materia_id_key" UNIQUE ("user_id", "data", "materia_id");
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."questoes_certas"
    ADD CONSTRAINT "questoes_certas_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."questoes"
    ADD CONSTRAINT "questoes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."questoes_revisoes"
    ADD CONSTRAINT "questoes_revisoes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."sessoes_estudo"
    ADD CONSTRAINT "sessoes_estudo_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."sessoes_estudo"
    ADD CONSTRAINT "sessoes_estudo_user_id_data_key" UNIQUE ("user_id", "data");
ALTER TABLE ONLY "public"."simulados"
    ADD CONSTRAINT "simulados_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_badge_key_key" UNIQUE ("user_id", "badge_key");
CREATE INDEX "configuracoes_revisao_user_idx" ON "public"."configuracoes_revisao" USING "btree" ("user_id");
CREATE INDEX "edital_config_user_idx" ON "public"."edital_config" USING "btree" ("user_id");
CREATE INDEX "edital_topicos_user_materia_idx" ON "public"."edital_topicos" USING "btree" ("user_id", "materia_id", "status");
CREATE INDEX "estatisticas_mensais_user_periodo_idx" ON "public"."estatisticas_mensais" USING "btree" ("user_id", "periodo_mes" DESC);
CREATE INDEX "flashcard_reviews_flashcard_id_idx" ON "public"."flashcard_reviews" USING "btree" ("flashcard_id");
CREATE INDEX "flashcard_reviews_user_id_idx" ON "public"."flashcard_reviews" USING "btree" ("user_id");
CREATE INDEX "flashcard_reviews_user_reviewed_at_idx" ON "public"."flashcard_reviews" USING "btree" ("user_id", "reviewed_at");
CREATE INDEX "flashcards_user_ativo_idx" ON "public"."flashcards" USING "btree" ("user_id", "ativo");
CREATE INDEX "flashcards_user_due_date_idx" ON "public"."flashcards" USING "btree" ("user_id", "due_date");
CREATE INDEX "flashcards_user_estado_idx" ON "public"."flashcards" USING "btree" ("user_id", "estado");
CREATE INDEX "flashcards_user_id_idx" ON "public"."flashcards" USING "btree" ("user_id");
CREATE INDEX "ia_uso_diario_user_data_idx" ON "public"."ia_uso_diario" USING "btree" ("user_id", "data" DESC);
CREATE INDEX "lei_seca_user_materia_idx" ON "public"."lei_seca_itens" USING "btree" ("user_id", "materia_id", "edital_topico_id");
CREATE INDEX "lei_seca_user_revisao_idx" ON "public"."lei_seca_itens" USING "btree" ("user_id", "status", "revisar_em");
CREATE INDEX "pegadinhas_banca_user_idx" ON "public"."pegadinhas_banca" USING "btree" ("user_id", "materia_id", "edital_topico_id");
CREATE INDEX "planejamento_semanal_user_dia_idx" ON "public"."planejamento_semanal" USING "btree" ("user_id", "dia_semana", "ordem");
CREATE INDEX "plano_dia_materias_user_data_idx" ON "public"."plano_dia_materias" USING "btree" ("user_id", "data");
CREATE INDEX "questoes_certas_user_criado_idx" ON "public"."questoes_certas" USING "btree" ("user_id", "criado_em");
CREATE INDEX "questoes_revisoes_questao_idx" ON "public"."questoes_revisoes" USING "btree" ("questao_id", "data_revisao" DESC);
CREATE INDEX "questoes_revisoes_user_data_idx" ON "public"."questoes_revisoes" USING "btree" ("user_id", "data_revisao" DESC);
CREATE INDEX "questoes_user_criado_idx" ON "public"."questoes" USING "btree" ("user_id", "criado_em");
CREATE INDEX "questoes_user_revisao_idx" ON "public"."questoes" USING "btree" ("user_id", "status_revisao", "revisar_novamente_em");
CREATE INDEX "questoes_user_topico_idx" ON "public"."questoes" USING "btree" ("user_id", "edital_topico_id");
CREATE INDEX "simulados_user_data_idx" ON "public"."simulados" USING "btree" ("user_id", "data" DESC);
CREATE INDEX "user_badges_user_idx" ON "public"."user_badges" USING "btree" ("user_id", "unlocked_at" DESC);
ALTER TABLE ONLY "public"."configuracoes_revisao"
    ADD CONSTRAINT "configuracoes_revisao_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."edital_config"
    ADD CONSTRAINT "edital_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."edital_topicos"
    ADD CONSTRAINT "edital_topicos_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."edital_topicos"
    ADD CONSTRAINT "edital_topicos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."estatisticas_mensais"
    ADD CONSTRAINT "estatisticas_mensais_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."flashcard_reviews"
    ADD CONSTRAINT "flashcard_reviews_flashcard_id_fkey" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."flashcard_reviews"
    ADD CONSTRAINT "flashcard_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."flashcards"
    ADD CONSTRAINT "flashcards_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."flashcards"
    ADD CONSTRAINT "flashcards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."ia_uso_diario"
    ADD CONSTRAINT "ia_uso_diario_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."lei_seca_itens"
    ADD CONSTRAINT "lei_seca_itens_edital_topico_id_fkey" FOREIGN KEY ("edital_topico_id") REFERENCES "public"."edital_topicos"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."lei_seca_itens"
    ADD CONSTRAINT "lei_seca_itens_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."lei_seca_itens"
    ADD CONSTRAINT "lei_seca_itens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."materias"
    ADD CONSTRAINT "materias_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."pegadinhas_banca"
    ADD CONSTRAINT "pegadinhas_banca_edital_topico_id_fkey" FOREIGN KEY ("edital_topico_id") REFERENCES "public"."edital_topicos"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."pegadinhas_banca"
    ADD CONSTRAINT "pegadinhas_banca_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."pegadinhas_banca"
    ADD CONSTRAINT "pegadinhas_banca_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."planejamento_semanal"
    ADD CONSTRAINT "planejamento_semanal_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."planejamento_semanal"
    ADD CONSTRAINT "planejamento_semanal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."plano_dia_materias"
    ADD CONSTRAINT "plano_dia_materias_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."plano_dia_materias"
    ADD CONSTRAINT "plano_dia_materias_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."questoes_certas"
    ADD CONSTRAINT "questoes_certas_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."questoes_certas"
    ADD CONSTRAINT "questoes_certas_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "public"."sessoes_estudo"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."questoes_certas"
    ADD CONSTRAINT "questoes_certas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."questoes"
    ADD CONSTRAINT "questoes_edital_topico_id_fkey" FOREIGN KEY ("edital_topico_id") REFERENCES "public"."edital_topicos"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."questoes"
    ADD CONSTRAINT "questoes_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id") ON DELETE RESTRICT;
ALTER TABLE ONLY "public"."questoes_revisoes"
    ADD CONSTRAINT "questoes_revisoes_questao_id_fkey" FOREIGN KEY ("questao_id") REFERENCES "public"."questoes"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."questoes_revisoes"
    ADD CONSTRAINT "questoes_revisoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."questoes"
    ADD CONSTRAINT "questoes_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "public"."sessoes_estudo"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."questoes"
    ADD CONSTRAINT "questoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."sessoes_estudo"
    ADD CONSTRAINT "sessoes_estudo_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."simulados"
    ADD CONSTRAINT "simulados_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE "public"."configuracoes_revisao" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "configuracoes_revisao_proprias" ON "public"."configuracoes_revisao" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."edital_config" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edital_config_propria" ON "public"."edital_config" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."edital_topicos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edital_topicos_proprios" ON "public"."edital_topicos" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."estatisticas_mensais" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estatisticas_mensais_proprias" ON "public"."estatisticas_mensais" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."flashcard_reviews" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flashcard_reviews_insert_proprias" ON "public"."flashcard_reviews" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."flashcards"
  WHERE (("flashcards"."id" = "flashcard_reviews"."flashcard_id") AND ("flashcards"."user_id" = "auth"."uid"()))))));
CREATE POLICY "flashcard_reviews_select_proprias" ON "public"."flashcard_reviews" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."flashcards" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flashcards_delete_proprios" ON "public"."flashcards" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "flashcards_insert_proprios" ON "public"."flashcards" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (("materia_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."materias"
  WHERE (("materias"."id" = "flashcards"."materia_id") AND ("materias"."user_id" = "auth"."uid"())))))));
CREATE POLICY "flashcards_select_proprios" ON "public"."flashcards" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "flashcards_update_proprios" ON "public"."flashcards" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND (("materia_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."materias"
  WHERE (("materias"."id" = "flashcards"."materia_id") AND ("materias"."user_id" = "auth"."uid"())))))));
ALTER TABLE "public"."ia_uso_diario" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_uso_diario_select_proprio" ON "public"."ia_uso_diario" FOR SELECT USING (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."lei_seca_itens" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lei_seca_itens_proprios" ON "public"."lei_seca_itens" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."materias" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materias_proprias" ON "public"."materias" USING (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."pegadinhas_banca" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pegadinhas_banca_proprias" ON "public"."pegadinhas_banca" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "perfil_proprio" ON "public"."profiles" USING (("auth"."uid"() = "id"));
ALTER TABLE "public"."planejamento_semanal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planejamento_semanal_proprio" ON "public"."planejamento_semanal" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."plano_dia_materias" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plano_dia_materias_proprias" ON "public"."plano_dia_materias" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."questoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."questoes_certas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questoes_proprias" ON "public"."questoes" USING (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."questoes_revisoes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questoes_revisoes_proprias" ON "public"."questoes_revisoes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."sessoes_estudo" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessoes_proprias" ON "public"."sessoes_estudo" USING (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."simulados" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simulados_proprios" ON "public"."simulados" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_badges_proprios" ON "public"."user_badges" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "usuarios_questoes_certas" ON "public"."questoes_certas" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
REVOKE ALL ON FUNCTION "public"."consumir_cota_ia"("p_user_id" "uuid", "p_limite" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consumir_cota_ia"("p_user_id" "uuid", "p_limite" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."criar_perfil_automatico"() TO "anon";
GRANT ALL ON FUNCTION "public"."criar_perfil_automatico"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_perfil_automatico"() TO "service_role";
REVOKE ALL ON FUNCTION "public"."obter_resumo_gamificacao"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_resumo_gamificacao"() TO "service_role";
GRANT ALL ON FUNCTION "public"."obter_resumo_gamificacao"() TO "authenticated";

REVOKE ALL ON TABLE
  "public"."configuracoes_revisao",
  "public"."edital_config",
  "public"."edital_topicos",
  "public"."estatisticas_mensais",
  "public"."flashcard_reviews",
  "public"."flashcards",
  "public"."ia_uso_diario",
  "public"."lei_seca_itens",
  "public"."materias",
  "public"."pegadinhas_banca",
  "public"."planejamento_semanal",
  "public"."plano_dia_materias",
  "public"."profiles",
  "public"."questoes",
  "public"."questoes_certas",
  "public"."questoes_revisoes",
  "public"."sessoes_estudo",
  "public"."simulados",
  "public"."user_badges"
FROM PUBLIC;

REVOKE ALL ON TABLE
  "public"."configuracoes_revisao",
  "public"."edital_config",
  "public"."edital_topicos",
  "public"."estatisticas_mensais",
  "public"."flashcard_reviews",
  "public"."flashcards",
  "public"."ia_uso_diario",
  "public"."lei_seca_itens",
  "public"."materias",
  "public"."pegadinhas_banca",
  "public"."planejamento_semanal",
  "public"."plano_dia_materias",
  "public"."profiles",
  "public"."questoes",
  "public"."questoes_certas",
  "public"."questoes_revisoes",
  "public"."sessoes_estudo",
  "public"."simulados",
  "public"."user_badges"
FROM "anon";

REVOKE ALL ON TABLE
  "public"."configuracoes_revisao",
  "public"."edital_config",
  "public"."edital_topicos",
  "public"."estatisticas_mensais",
  "public"."flashcard_reviews",
  "public"."flashcards",
  "public"."ia_uso_diario",
  "public"."lei_seca_itens",
  "public"."materias",
  "public"."pegadinhas_banca",
  "public"."planejamento_semanal",
  "public"."plano_dia_materias",
  "public"."profiles",
  "public"."questoes",
  "public"."questoes_certas",
  "public"."questoes_revisoes",
  "public"."sessoes_estudo",
  "public"."simulados",
  "public"."user_badges"
FROM "authenticated";

GRANT ALL ON TABLE "public"."configuracoes_revisao" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."configuracoes_revisao" TO "authenticated";
GRANT ALL ON TABLE "public"."edital_config" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."edital_config" TO "authenticated";
GRANT ALL ON TABLE "public"."edital_topicos" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."edital_topicos" TO "authenticated";
GRANT ALL ON TABLE "public"."estatisticas_mensais" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."estatisticas_mensais" TO "authenticated";
GRANT ALL ON TABLE "public"."flashcard_reviews" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."flashcard_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."flashcards" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flashcards" TO "authenticated";
GRANT ALL ON TABLE "public"."ia_uso_diario" TO "service_role";
GRANT SELECT ON TABLE "public"."ia_uso_diario" TO "authenticated";
GRANT ALL ON TABLE "public"."lei_seca_itens" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lei_seca_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."materias" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."materias" TO "authenticated";
GRANT ALL ON TABLE "public"."pegadinhas_banca" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."pegadinhas_banca" TO "authenticated";
GRANT ALL ON TABLE "public"."planejamento_semanal" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."planejamento_semanal" TO "authenticated";
GRANT ALL ON TABLE "public"."plano_dia_materias" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."plano_dia_materias" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."questoes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."questoes" TO "authenticated";
GRANT ALL ON TABLE "public"."questoes_certas" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."questoes_certas" TO "authenticated";
GRANT ALL ON TABLE "public"."questoes_revisoes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."questoes_revisoes" TO "authenticated";
GRANT ALL ON TABLE "public"."sessoes_estudo" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sessoes_estudo" TO "authenticated";
GRANT ALL ON TABLE "public"."simulados" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."simulados" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_badges" TO "authenticated";

-- Objeto personalizado fora de public: perfil automatico em novos usuarios Auth.
drop trigger if exists "trigger_criar_perfil" on "auth"."users";
create trigger "trigger_criar_perfil"
after insert on "auth"."users"
for each row execute function "public"."criar_perfil_automatico"();
