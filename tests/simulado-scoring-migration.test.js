import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(
  new URL('../supabase/migrations/20260720131000_add_configurable_exam_scoring.sql', import.meta.url),
  'utf8'
)

describe('migration local de pontuacao configuravel', () => {
  it('cria estruturas aditivas de perfil, versao, bloco e snapshot', () => {
    expect(migrationSql).toContain('create table if not exists public.scoring_profiles')
    expect(migrationSql).toContain('create table if not exists public.scoring_profile_versions')
    expect(migrationSql).toContain('create table if not exists public.scoring_profile_blocks')
    expect(migrationSql).toContain('alter table public.simulados')
    expect(migrationSql).toContain('add column if not exists scoring_snapshot jsonb')
    expect(migrationSql).toContain('add column if not exists score_final numeric')
    expect(migrationSql).toContain('add column if not exists blank_count integer not null default 0')
  })

  it('habilita RLS e isola perfis pelo auth.uid', () => {
    expect(migrationSql).toContain('alter table public.scoring_profiles enable row level security')
    expect(migrationSql).toContain('alter table public.scoring_profile_versions enable row level security')
    expect(migrationSql).toContain('alter table public.scoring_profile_blocks enable row level security')
    expect(migrationSql).toMatch(/auth\.uid\(\)\s*=\s*user_id/)
    expect(migrationSql).toContain("scope = 'system' or auth.uid() = user_id")
    expect(migrationSql).toContain("scope = 'user' and auth.uid() = user_id")
    expect(migrationSql).toContain('scoring_profiles_delete_own_unused')
    expect(migrationSql).toContain('not exists (')
  })

  it('protege versoes e blocos usados por simulados', () => {
    expect(migrationSql).toContain('lock_scoring_profile_version_from_simulado')
    expect(migrationSql).toContain('prevent_used_scoring_profile_version_changes')
    expect(migrationSql).toContain('prevent_used_scoring_profile_block_changes')
    expect(migrationSql).toContain('prevent_used_scoring_profile_delete')
    expect(migrationSql).toContain('scoring_profile_version_already_used')
    expect(migrationSql).toContain('scoring_profile_blocks_already_used')
    expect(migrationSql).toContain('simulados_lock_scoring_profile_version')
    expect(migrationSql).toContain("set search_path = ''")
    expect(migrationSql).toContain('revoke all on function public.lock_scoring_profile_version_from_simulado() from public')
  })

  it('evita escrita publica e nao altera objetos SM-2', () => {
    expect(migrationSql).toContain('revoke all on table public.scoring_profiles from public')
    expect(migrationSql).toContain('revoke all on table public.scoring_profile_versions from anon')
    expect(migrationSql).not.toContain('questao_review_states')
    expect(migrationSql).not.toContain('questao_review_events')
    expect(migrationSql).not.toContain('registrar_revisao_questao_sm2')
    expect(migrationSql).not.toContain('bootstrap_sm2_states_on_activation')
  })
})
