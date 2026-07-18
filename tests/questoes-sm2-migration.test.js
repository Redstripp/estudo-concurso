import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(
  new URL('../supabase/migrations/20260717113000_add_question_sm2_scheduler.sql', import.meta.url),
  'utf8'
)
const revisaoJs = readFileSync(new URL('../js/revisao.js', import.meta.url), 'utf8')
const questoesJs = readFileSync(new URL('../js/questoes.js', import.meta.url), 'utf8')

function diasEntre(dataFim, dataInicio) {
  return Math.round((new Date(`${dataFim}T00:00:00.000Z`) - new Date(`${dataInicio}T00:00:00.000Z`)) / 86400000)
}

function simularBackfillEstadoQuestao(q, currentDate = '2026-07-17') {
  if (q.status_revisao !== 'pendente') return null

  const baseIntervalo = q.revisao_ultima_data || q.criado_em.slice(0, 10)
  const dataVencimento = q.revisar_novamente_em || currentDate

  return {
    state_origin: 'migrated',
    easiness_factor: 2.5,
    repetition_count: q.revisao_ultima_resultado === 'Acertou'
      ? Math.max(1, Math.min(q.revisao_etapa || 0, 2))
      : 0,
    interval_days: Math.max(0, diasEntre(dataVencimento, baseIntervalo)),
    lapse_count: Math.max(0, q.revisao_total_erros || 0),
    correct_streak: q.revisao_ultima_resultado === 'Acertou' ? 1 : 0,
    total_reviews: Math.max(0, (q.revisao_total_acertos || 0) + (q.revisao_total_erros || 0)),
    next_review_at: `${dataVencimento} 00:00:00+00`
  }
}

describe('migration do scheduler de questoes sm2_v1', () => {
  it('cria estado individual, eventos e feature flag sem comandos destrutivos', () => {
    expect(migrationSql).toContain('create table if not exists public.questao_review_states')
    expect(migrationSql).toContain('create table if not exists public.questao_review_events')
    expect(migrationSql).toContain("review_scheduler_mode text not null default 'legacy'")
    expect(migrationSql).toContain("review_timezone text not null default 'America/Recife'")
    expect(migrationSql).toContain('unique (user_id, questao_id)')
    expect(migrationSql).toContain('questao_review_states_user_due_idx')
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b/i)
    expect(migrationSql).not.toMatch(/\bdelete\s+from\b/i)
    expect(migrationSql).not.toMatch(/\btruncate\b/i)
  })

  it('protege isolamento por usuario com RLS, grants minimos e auth.uid()', () => {
    expect(migrationSql).toContain('alter table public.questao_review_states enable row level security')
    expect(migrationSql).toContain('alter table public.questao_review_events enable row level security')
    expect(migrationSql).toContain('using (auth.uid() = user_id)')
    expect(migrationSql).toContain('with check (')
    expect(migrationSql).toContain('q.user_id = auth.uid()')
    expect(migrationSql).toContain('revoke all on table public.questao_review_states from public')
    expect(migrationSql).toContain('revoke all on table public.questao_review_events from anon')
    expect(migrationSql).toContain('grant select, insert, update on table public.questao_review_states to authenticated')
    expect(migrationSql).toContain('revoke all on table public.questao_review_events from authenticated')
    expect(migrationSql).toContain('grant select on table public.questao_review_events to authenticated')
    expect(migrationSql).not.toContain('grant select, insert on table public.questao_review_events to authenticated')
    expect(migrationSql).not.toContain('create policy questao_review_events_insert_proprios')
  })

  it('registra revisao por RPC transacional, idempotente e sem aceitar user_id do frontend', () => {
    expect(migrationSql).toContain('create or replace function public.registrar_revisao_questao_sm2')
    expect(migrationSql).toContain('security definer')
    expect(migrationSql).toContain('set search_path = public, auth')
    expect(migrationSql).toContain('v_user_id uuid := auth.uid()')
    expect(migrationSql).not.toContain('p_user_id')
    expect(migrationSql).toContain('for update')
    expect(migrationSql).toContain('source_attempt_id = p_source_attempt_id')
    expect(migrationSql).toContain('pg_catalog.pg_advisory_xact_lock')
    expect(migrationSql).toContain('source_attempt_id_conflita_com_outra_questao')
    expect(migrationSql).toContain('if v_event.questao_id <> p_questao_id then')
    expect(migrationSql).toContain('data_revisao_invalida')
    expect(migrationSql).toContain('resultado_inconsistente_com_grade')
    expect(migrationSql).toContain('grant execute on function public.registrar_revisao_questao_sm2')
  })

  it('documenta backfill vencido e evita data historica quando a data legada esta nula', () => {
    expect(migrationSql).toContain('Mantem vencimentos legados ja atrasados')
    expect(migrationSql).toContain('Quando nao ha data legada, usa current_date')
    expect(migrationSql).toContain("where q.status_revisao = 'pendente'")
    expect(migrationSql).toContain('coalesce(q.revisar_novamente_em, current_date)::timestamp at time zone')
  })

  it('contrato do backfill cobre pendente vencida, sem ultima data e recem-criada', () => {
    expect(simularBackfillEstadoQuestao({
      status_revisao: 'pendente',
      revisar_novamente_em: '2026-05-19',
      revisao_ultima_data: null,
      criado_em: '2026-05-18T12:00:00.000Z',
      revisao_ultima_resultado: null
    })).toMatchObject({
      interval_days: 1,
      next_review_at: '2026-05-19 00:00:00+00'
    })

    expect(simularBackfillEstadoQuestao({
      status_revisao: 'pendente',
      revisar_novamente_em: null,
      revisao_ultima_data: null,
      criado_em: '2026-07-17T12:00:00.000Z',
      revisao_ultima_resultado: null
    })).toMatchObject({
      interval_days: 0,
      next_review_at: '2026-07-17 00:00:00+00'
    })

    expect(simularBackfillEstadoQuestao({
      status_revisao: 'recuperada',
      revisar_novamente_em: '2026-05-19',
      revisao_ultima_data: '2026-05-18',
      criado_em: '2026-05-18T12:00:00.000Z'
    })).toBeNull()
  })

  it('frontend usa a RPC para revisoes SM-2 e cria tentativa idempotente', () => {
    expect(revisaoJs).toContain("db.rpc('registrar_revisao_questao_sm2'")
    expect(revisaoJs).toContain('p_source_attempt_id: obterTentativaTreinoRevisao()')
    expect(revisaoJs).toContain('questaoUsaSchedulerSm2(q)')
    expect(questoesJs).toContain('registrarQuestaoNoSchedulerSm2SeAtivo')
    expect(questoesJs).toContain('p_source_attempt_id: questaoId')
  })
})
