import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(
  new URL('../supabase/migrations/20260719211000_bootstrap_sm2_states_on_activation.sql', import.meta.url),
  'utf8'
)

const DIA_PERMITIDO = '2026-07-22'
const DIA_NAO_PERMITIDO = '2026-07-19'

function criarBanco() {
  return {
    configuracoes: new Map(),
    questoes: [],
    revisoes: [],
    states: [],
    events: []
  }
}

function clonarBanco(db) {
  return {
    configuracoes: new Map(Array.from(db.configuracoes.entries()).map(([id, config]) => [id, structuredClone(config)])),
    questoes: structuredClone(db.questoes),
    revisoes: structuredClone(db.revisoes),
    states: structuredClone(db.states),
    events: structuredClone(db.events)
  }
}

function restaurarBanco(db, snapshot) {
  db.configuracoes = snapshot.configuracoes
  db.questoes = snapshot.questoes
  db.revisoes = snapshot.revisoes
  db.states = snapshot.states
  db.events = snapshot.events
}

function criarUsuario(db, userId, overrides = {}) {
  db.configuracoes.set(userId, {
    user_id: userId,
    review_scheduler_mode: 'legacy',
    review_timezone: 'America/Recife',
    review_max_interval_days: 365,
    dias_revisao: [3, 6],
    ...overrides
  })
}

function criarQuestao(db, userId, overrides = {}) {
  const questao = {
    id: overrides.id || `q-${db.questoes.length + 1}`,
    user_id: userId,
    status_revisao: 'pendente',
    revisar_novamente_em: '2026-07-20',
    revisao_ultima_data: null,
    revisao_ultima_resultado: null,
    revisao_etapa: 0,
    revisao_total_acertos: 0,
    revisao_total_erros: 0,
    criado_em: '2026-07-19T12:00:00.000Z',
    ...overrides
  }

  db.questoes.push(questao)
  return questao
}

function criarRevisaoLegada(db, userId, questaoId, overrides = {}) {
  const revisao = {
    id: overrides.id || `r-${db.revisoes.length + 1}`,
    user_id: userId,
    questao_id: questaoId,
    data_revisao: '2026-07-15',
    resultado: 'Errou',
    revisar_novamente_em: '2026-07-16',
    criado_em: '2026-07-15T12:00:00.000Z',
    ...overrides
  }

  db.revisoes.push(revisao)
  return revisao
}

function ordenarRevisoesDesc(revisoes) {
  return [...revisoes].sort((a, b) => {
    const data = String(b.data_revisao).localeCompare(String(a.data_revisao))
    if (data !== 0) return data
    const criado = String(b.criado_em).localeCompare(String(a.criado_em))
    if (criado !== 0) return criado
    return String(b.id).localeCompare(String(a.id))
  })
}

function diasEntre(dataFim, dataInicio) {
  return Math.max(0, Math.round((new Date(`${dataFim}T00:00:00.000Z`) - new Date(`${dataInicio}T00:00:00.000Z`)) / 86400000))
}

function bootstrapSm2States(db, userId) {
  const questoesElegiveis = db.questoes.filter(q => q.user_id === userId && q.status_revisao === 'pendente')

  for (const q of questoesElegiveis) {
    if (db.states.some(s => s.user_id === userId && s.questao_id === q.id)) continue

    const ultimaRevisao = ordenarRevisoesDesc(
      db.revisoes.filter(r => r.user_id === userId && r.questao_id === q.id)
    )[0]
    const dataInicial = ultimaRevisao?.revisar_novamente_em || q.revisar_novamente_em || q.criado_em.slice(0, 10)
    const dataUltimaRevisao = q.revisao_ultima_data || ultimaRevisao?.data_revisao || null
    const ultimoResultado = q.revisao_ultima_resultado || ultimaRevisao?.resultado || null

    db.states.push({
      id: `state-${db.states.length + 1}`,
      user_id: userId,
      questao_id: q.id,
      algorithm_version: 'sm2_v1',
      state_origin: 'activation_bootstrap',
      easiness_factor: 2.5,
      repetition_count: ultimoResultado === 'Acertou' ? Math.max(1, Math.min(q.revisao_etapa || 0, 2)) : 0,
      interval_days: diasEntre(dataInicial, dataUltimaRevisao || q.criado_em.slice(0, 10)),
      lapse_count: Math.max(0, q.revisao_total_erros || 0),
      correct_streak: ultimoResultado === 'Acertou' ? 1 : 0,
      total_reviews: Math.max(0, (q.revisao_total_acertos || 0) + (q.revisao_total_erros || 0)),
      last_grade: ultimoResultado === 'Acertou' ? 4 : ultimoResultado === 'Errou' ? 1 : null,
      last_result: ultimoResultado === 'Acertou' ? 'correct' : ultimoResultado === 'Errou' ? 'incorrect' : null,
      last_reviewed_at: dataUltimaRevisao ? `${dataUltimaRevisao}T00:00:00.000Z` : null,
      next_review_at: `${dataInicial}T00:00:00.000Z`
    })
  }
}

function ativarSm2(db, userId, options = {}) {
  const snapshot = clonarBanco(db)

  try {
    const config = db.configuracoes.get(userId)
    const modoAnterior = config.review_scheduler_mode
    config.review_scheduler_mode = 'sm2_v1'

    if (options.falharBootstrap) {
      throw new Error('bootstrap_falhou')
    }

    if (modoAnterior !== 'sm2_v1') {
      bootstrapSm2States(db, userId)
    }
  } catch (erro) {
    restaurarBanco(db, snapshot)
    throw erro
  }
}

function voltarParaLegacy(db, userId) {
  db.configuracoes.get(userId).review_scheduler_mode = 'legacy'
}

function filaSm2(db, userId, dataISO = DIA_PERMITIDO) {
  const config = db.configuracoes.get(userId)
  const diaSemana = converterDiaSemanaQuestaoSm2(dataISO, config.review_timezone)
  if (!config.dias_revisao.includes(diaSemana)) return []

  const fimDia = `${dataISO}T23:59:59.999Z`
  return db.states
    .filter(s => s.user_id === userId && s.next_review_at && s.next_review_at <= fimDia)
    .map(s => ({ ...db.questoes.find(q => q.id === s.questao_id), review_state: s, scheduler_mode: 'sm2_v1' }))
    .filter(q => q.id)
}

function registrarRevisaoSm2(db, userId, questaoId, sourceAttemptId) {
  const eventoExistente = db.events.find(e => e.user_id === userId && e.source_attempt_id === sourceAttemptId)
  if (eventoExistente) {
    return {
      idempotent: true,
      event: eventoExistente,
      state: db.states.find(s => s.user_id === userId && s.questao_id === questaoId)
    }
  }

  const state = db.states.find(s => s.user_id === userId && s.questao_id === questaoId)
  const proximo = scheduleQuestionReview(state, { grade: 4 }, '2026-07-22T12:00:00.000Z', { maxIntervalDays: 365 })
  Object.assign(state, proximo)

  const event = {
    id: `event-${db.events.length + 1}`,
    user_id: userId,
    questao_id: questaoId,
    source_attempt_id: sourceAttemptId,
    grade: 4,
    was_correct: true,
    next_review_at: proximo.next_review_at
  }
  db.events.push(event)

  return { idempotent: false, event, state }
}

describe('bootstrap SM-2 na ativacao', () => {
  it('instala trigger transacional sem criar eventos nem ativar usuarios', () => {
    expect(migrationSql).toContain('create or replace function public.bootstrap_sm2_states_on_activation()')
    expect(migrationSql).toContain('returns trigger')
    expect(migrationSql).toContain('security definer')
    expect(migrationSql).toContain("set search_path = ''")
    expect(migrationSql).toContain('after update of review_scheduler_mode')
    expect(migrationSql).toContain("old.review_scheduler_mode is distinct from 'sm2_v1'")
    expect(migrationSql).toContain("new.review_scheduler_mode = 'sm2_v1'")
    expect(migrationSql).toContain('new.user_id')
    expect(migrationSql).toContain('on conflict (user_id, questao_id) do nothing')
    expect(migrationSql).toContain("'activation_bootstrap'")
    expect(migrationSql).not.toMatch(/insert\s+into\s+public\.questao_review_events/i)
    expect(migrationSql).not.toMatch(/update\s+public\.questoes\b/i)
    expect(migrationSql).not.toMatch(/atualizado_em\s*=/i)
    expect(migrationSql).not.toMatch(/update\s+public\.configuracoes_revisao\s+set\s+review_scheduler_mode\s*=\s*'sm2_v1'/i)
  })

  it('revoga execute direto da trigger function dos papeis da API', () => {
    expect(migrationSql).toContain('revoke all on function public.bootstrap_sm2_states_on_activation() from public')
    expect(migrationSql).toContain('revoke all on function public.bootstrap_sm2_states_on_activation() from anon')
    expect(migrationSql).toContain('revoke all on function public.bootstrap_sm2_states_on_activation() from authenticated')
    expect(migrationSql).toContain('revoke all on function public.bootstrap_sm2_states_on_activation() from service_role')
    expect(migrationSql).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.bootstrap_sm2_states_on_activation/i)
  })

  it('cria exatamente um state para questao pendente preexistente e zero eventos', () => {
    const db = criarBanco()
    criarUsuario(db, 'user-a')
    criarUsuario(db, 'user-b')
    const questao = criarQuestao(db, 'user-a', { id: 'q-a', revisar_novamente_em: '2026-07-20' })

    ativarSm2(db, 'user-a')

    expect(db.states).toHaveLength(1)
    expect(db.events).toHaveLength(0)
    expect(db.states[0]).toMatchObject({
      user_id: 'user-a',
      questao_id: questao.id,
      state_origin: 'activation_bootstrap',
      algorithm_version: 'sm2_v1',
      next_review_at: '2026-07-20T00:00:00.000Z'
    })
    expect(filaSm2(db, 'user-a').map(q => q.id)).toEqual(['q-a'])
  })

  it('mantem isolamento por usuario e usuario vazio sem states', () => {
    const db = criarBanco()
    criarUsuario(db, 'user-a')
    criarUsuario(db, 'user-b')
    criarUsuario(db, 'user-c')
    criarQuestao(db, 'user-a', { id: 'q-a' })
    criarQuestao(db, 'user-b', { id: 'q-b' })

    ativarSm2(db, 'user-a')

    expect(db.configuracoes.get('user-b').review_scheduler_mode).toBe('legacy')
    expect(db.states.map(s => s.questao_id)).toEqual(['q-a'])
    expect(db.states.some(s => s.user_id === 'user-b')).toBe(false)
    expect(db.states.some(s => s.user_id === 'user-c')).toBe(false)
  })

  it('e idempotente e preserva state em rollback operacional para legacy', () => {
    const db = criarBanco()
    criarUsuario(db, 'user-a')
    criarQuestao(db, 'user-a', { id: 'q-a', revisar_novamente_em: '2026-07-20' })

    ativarSm2(db, 'user-a')
    const primeiroState = structuredClone(db.states[0])
    ativarSm2(db, 'user-a')
    voltarParaLegacy(db, 'user-a')
    ativarSm2(db, 'user-a')

    expect(db.states).toHaveLength(1)
    expect(db.states[0]).toEqual(primeiroState)
  })

  it('nao sobrescreve state preexistente nem cria state para questao recuperada', () => {
    const db = criarBanco()
    criarUsuario(db, 'user-a')
    criarQuestao(db, 'user-a', { id: 'q-pendente' })
    criarQuestao(db, 'user-a', { id: 'q-recuperada', status_revisao: 'recuperada' })
    db.states.push({
      id: 'state-existente',
      user_id: 'user-a',
      questao_id: 'q-pendente',
      state_origin: 'new',
      next_review_at: '2026-08-01T00:00:00.000Z'
    })

    ativarSm2(db, 'user-a')

    expect(db.states).toHaveLength(1)
    expect(db.states[0]).toMatchObject({
      id: 'state-existente',
      state_origin: 'new',
      next_review_at: '2026-08-01T00:00:00.000Z'
    })
    expect(db.states.some(s => s.questao_id === 'q-recuperada')).toBe(false)
  })

  it('preserva datas legadas vencidas, futuras e usa data da questao sem revisao', () => {
    const db = criarBanco()
    criarUsuario(db, 'user-a')
    criarQuestao(db, 'user-a', { id: 'q-vencida', revisar_novamente_em: '2026-07-25' })
    criarRevisaoLegada(db, 'user-a', 'q-vencida', {
      data_revisao: '2026-07-10',
      resultado: 'Errou',
      revisar_novamente_em: '2026-07-12'
    })
    criarQuestao(db, 'user-a', { id: 'q-futura', revisar_novamente_em: '2026-07-20' })
    criarRevisaoLegada(db, 'user-a', 'q-futura', {
      data_revisao: '2026-07-15',
      resultado: 'Acertou',
      revisar_novamente_em: '2026-08-01'
    })
    criarQuestao(db, 'user-a', {
      id: 'q-sem-revisao',
      revisar_novamente_em: null,
      criado_em: '2026-07-18T09:00:00.000Z'
    })

    ativarSm2(db, 'user-a')

    expect(db.states.find(s => s.questao_id === 'q-vencida').next_review_at).toBe('2026-07-12T00:00:00.000Z')
    expect(db.states.find(s => s.questao_id === 'q-futura').next_review_at).toBe('2026-08-01T00:00:00.000Z')
    expect(db.states.find(s => s.questao_id === 'q-sem-revisao').next_review_at).toBe('2026-07-18T00:00:00.000Z')
    expect(filaSm2(db, 'user-a', DIA_NAO_PERMITIDO)).toEqual([])
    expect(filaSm2(db, 'user-a', DIA_PERMITIDO).map(q => q.id)).toEqual(['q-vencida', 'q-sem-revisao'])
  })

  it('prova o fluxo sintetico: ativacao, primeira revisao e retry idempotente', () => {
    const db = criarBanco()
    criarUsuario(db, 'user-a')
    criarUsuario(db, 'user-b')
    criarQuestao(db, 'user-a', { id: 'q-piloto', revisar_novamente_em: '2026-07-20' })

    expect(db.states).toHaveLength(0)
    ativarSm2(db, 'user-a')
    expect(filaSm2(db, 'user-a').map(q => q.id)).toEqual(['q-piloto'])

    const primeira = registrarRevisaoSm2(db, 'user-a', 'q-piloto', 'attempt-1')
    const retry = registrarRevisaoSm2(db, 'user-a', 'q-piloto', 'attempt-1')

    expect(primeira.idempotent).toBe(false)
    expect(retry.idempotent).toBe(true)
    expect(db.events).toHaveLength(1)
    expect(db.states).toHaveLength(1)
    expect(db.states[0].total_reviews).toBe(1)
    expect(db.configuracoes.get('user-b').review_scheduler_mode).toBe('legacy')
    expect(db.states.some(s => s.user_id === 'user-b')).toBe(false)
  })

  it('simula atomicidade: falha no bootstrap impede persistencia do modo sm2_v1', () => {
    const db = criarBanco()
    criarUsuario(db, 'user-a')
    criarQuestao(db, 'user-a', { id: 'q-a' })

    expect(() => ativarSm2(db, 'user-a', { falharBootstrap: true })).toThrow('bootstrap_falhou')

    expect(db.configuracoes.get('user-a').review_scheduler_mode).toBe('legacy')
    expect(db.states).toHaveLength(0)
  })
})
