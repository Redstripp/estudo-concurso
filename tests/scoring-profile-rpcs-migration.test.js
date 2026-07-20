import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(
  new URL('../supabase/migrations/20260720143000_add_scoring_profile_crud_rpcs.sql', import.meta.url),
  'utf8'
)

describe('migration local de RPCs de perfis de pontuacao', () => {
  it('cria RPCs transacionais para operacoes multietapas', () => {
    expect(migrationSql).toContain('create table if not exists public.scoring_profile_operations')
    expect(migrationSql).toContain('unique (user_id, operation_id)')
    expect(migrationSql).toContain('unique (user_id, operation_type, operation_id)')
    expect(migrationSql).toContain('create or replace function public.reserve_scoring_profile_operation')
    expect(migrationSql).toContain('create or replace function public.complete_scoring_profile_operation')
    expect(migrationSql).toContain('create or replace function public.create_scoring_profile_with_version')
    expect(migrationSql).toContain('create or replace function public.save_scoring_profile_current_version')
    expect(migrationSql).toContain('create or replace function public.duplicate_scoring_profile')
    expect(migrationSql).toContain('create or replace function public.create_scoring_profile_new_version')
    expect(migrationSql).toContain('create or replace function public.replace_scoring_profile_blocks')
    expect(migrationSql).toMatch(/create or replace function public\.create_scoring_profile_with_version\(\s*p_operation_id uuid/is)
    expect(migrationSql).toMatch(/create or replace function public\.duplicate_scoring_profile\(\s*p_operation_id uuid/is)
    expect(migrationSql).toMatch(/create or replace function public\.create_scoring_profile_new_version\(\s*p_operation_id uuid/is)
  })

  it('usa auth.uid e nao confia em user_id enviado pelo cliente', () => {
    expect(migrationSql).toMatch(/v_uid uuid := auth\.uid\(\)/)
    expect(migrationSql).toContain("scope = 'user'")
    expect(migrationSql).toContain('and user_id = v_uid')
    expect(migrationSql).not.toMatch(/create or replace function public\.create_scoring_profile_with_version\([^)]*p_user_id/is)
    expect(migrationSql).not.toMatch(/create or replace function public\.duplicate_scoring_profile\([^)]*p_user_id/is)
  })

  it('usa search_path seguro e grants minimos para authenticated', () => {
    expect(migrationSql.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(5)
    expect(migrationSql).toContain('revoke all on function public.create_scoring_profile_with_version')
    expect(migrationSql).toContain('grant execute on function public.create_scoring_profile_with_version')
    expect(migrationSql).not.toContain('grant execute on function public.insert_scoring_profile_blocks_from_json')
    expect(migrationSql).not.toContain('grant execute on function public.reserve_scoring_profile_operation')
    expect(migrationSql).toContain('revoke all on table public.scoring_profile_operations from authenticated')
  })

  it('preserva imutabilidade e nao toca objetos SM-2', () => {
    expect(migrationSql).toContain('scoring_profile_version_already_used')
    expect(migrationSql).toContain('locked_at is not null')
    expect(migrationSql).toContain('create or replace function public.lock_scoring_profile_version_from_simulado')
    expect(migrationSql).toContain("and (p.scope = 'system' or p.user_id = new.user_id)")
    expect(migrationSql).not.toContain('questao_review_states')
    expect(migrationSql).not.toContain('questao_review_events')
    expect(migrationSql).not.toContain('registrar_revisao_questao_sm2')
  })

  it('rejeita retry com payload ou tipo conflitante', () => {
    expect(migrationSql).toContain('scoring_profile_operation_payload_mismatch')
    expect(migrationSql).toContain('scoring_profile_operation_type_mismatch')
    expect(migrationSql).toContain('request_hash')
    expect(migrationSql).toContain('on conflict (user_id, operation_id) do nothing')
    expect(migrationSql).toContain("reserve_scoring_profile_operation(v_uid, 'create_profile'")
    expect(migrationSql).toContain("reserve_scoring_profile_operation(v_uid, 'save_current_version'")
    expect(migrationSql).toContain("reserve_scoring_profile_operation(v_uid, 'duplicate_profile'")
    expect(migrationSql).toContain("reserve_scoring_profile_operation(v_uid, 'create_version'")
    expect(migrationSql).toContain("reserve_scoring_profile_operation(v_uid, 'replace_blocks'")
  })
})
