import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  listarPerfisPontuacao,
  criarPerfilPontuacao,
  ativarPerfilPontuacao,
  normalizarErroScoringProfileService,
  criarPerfilPontuacaoLegadoSimulado,
  prepararOperacaoScoringProfileService
} = globalThis

const PROFILE_ID = '11111111-1111-4111-8111-111111111111'
const VERSION_ID = '22222222-2222-4222-8222-222222222222'

function criarPerfilRemotoRow(sobrescritas = {}) {
  return {
    id: PROFILE_ID,
    user_id: 'user-a',
    scope: 'user',
    profile_key: 'perfil-remoto',
    name: 'Perfil remoto',
    description: 'Descricao remota',
    active: true,
    current_version: 1,
    metadata: {},
    ...sobrescritas
  }
}

function criarVersaoRow(sobrescritas = {}) {
  return {
    id: VERSION_ID,
    profile_id: PROFILE_ID,
    user_id: 'user-a',
    version: 1,
    mode: 'negative_marking',
    rules: {
      valores: { correta: 2, errada: -1, branca: 0, anulada: 0 },
      anuladas: { tratamento: 'zero', valorEspecifico: 0 },
      notaMaxima: null
    },
    weights: { padrao: 1, questoes: {}, disciplinas: {}, blocos: {}, tipos: {} },
    blocks: [],
    minimum_criteria: {},
    elimination_criteria: {},
    rounding: { modo: 'matematico', casasDecimais: 2, etapa: 'final' },
    metadata: {},
    locked_at: null,
    ...sobrescritas
  }
}

function criarBlocoRow(sobrescritas = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    profile_version_id: VERSION_ID,
    user_id: 'user-a',
    block_key: 'geral',
    name: 'Geral',
    weight: 1,
    min_score: 4,
    min_percent: 50,
    metadata: { disciplinas: ['constitucional'], questoes: [] },
    ...sobrescritas
  }
}

function criarChainSupabase(tabela, resultado, chamadas) {
  const chain = {}
  const registrar = (metodo, args) => {
    chamadas.push({ tabela, metodo, args })
    return chain
  }
  ;['select', 'order', 'eq', 'in', 'update'].forEach(metodo => {
    chain[metodo] = vi.fn((...args) => registrar(metodo, args))
  })
  chain.single = vi.fn(() => {
    chamadas.push({ tabela, metodo: 'single', args: [] })
    return Promise.resolve(resultado)
  })
  chain.then = (resolve, reject) => Promise.resolve(resultado).then(resolve, reject)
  chain.catch = reject => Promise.resolve(resultado).catch(reject)
  return chain
}

function configurarDb(resultados = {}, rpcResultado = { data: null, error: null }) {
  const chamadas = []
  globalThis.db = {
    from: vi.fn(tabela => criarChainSupabase(tabela, resultados[tabela] || { data: [], error: null }, chamadas)),
    rpc: vi.fn(() => Promise.resolve(rpcResultado))
  }
  return chamadas
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  globalThis.window.usuarioAtual = { id: 'user-a' }
  delete globalThis.db
})

describe('ScoringProfileService', () => {
  it('lista legado virtual, perfis remotos e perfis locais marcados como locais', async () => {
    localStorage.setItem('estudoConcursoScoringProfiles:v1', JSON.stringify([
      { ...criarPerfilPontuacaoLegadoSimulado(), id: 'perfil-local', nome: 'Perfil local' }
    ]))
    const chamadas = configurarDb({
      scoring_profiles: { data: [criarPerfilRemotoRow()], error: null },
      scoring_profile_versions: { data: [criarVersaoRow()], error: null },
      scoring_profile_blocks: { data: [criarBlocoRow()], error: null }
    })

    const perfis = await listarPerfisPontuacao()

    expect(perfis.map(perfil => perfil.id)).toEqual([
      'legacy_simple',
      PROFILE_ID,
      'local:perfil-local'
    ])
    expect(perfis[1]).toMatchObject({
      nome: 'Perfil remoto',
      modo: 'negative_marking',
      valores: { correta: 2, errada: -1 },
      metadados: { origem: 'remoto', remoto: true, versionId: VERSION_ID }
    })
    expect(perfis[1].blocos[0]).toMatchObject({ id: 'geral', nome: 'Geral', notaMinima: 4 })
    expect(perfis[2].metadados).toMatchObject({ origem: 'local', local: true, remoto: false, localId: 'perfil-local' })
    expect(chamadas).toEqual(expect.arrayContaining([
      expect.objectContaining({ tabela: 'scoring_profiles', metodo: 'select' }),
      expect.objectContaining({ tabela: 'scoring_profile_versions', metodo: 'in', args: ['profile_id', [PROFILE_ID]] }),
      expect.objectContaining({ tabela: 'scoring_profile_blocks', metodo: 'in', args: ['profile_version_id', [VERSION_ID]] })
    ]))
  })

  it('cria perfil por RPC transacional e recarrega a versao completa', async () => {
    configurarDb({
      scoring_profiles: { data: criarPerfilRemotoRow(), error: null },
      scoring_profile_versions: { data: criarVersaoRow(), error: null },
      scoring_profile_blocks: { data: [criarBlocoRow()], error: null }
    }, {
      data: { profile_id: PROFILE_ID, version_id: VERSION_ID, version: 1 },
      error: null
    })

    const perfil = await criarPerfilPontuacao({
      ...criarPerfilPontuacaoLegadoSimulado(),
      id: 'local:rascunho',
      nome: 'Novo perfil',
      blocos: [{ id: 'geral', nome: 'Geral', peso: 1, notaMinima: 4 }]
    })

    expect(globalThis.db.rpc).toHaveBeenCalledWith('create_scoring_profile_with_version', expect.objectContaining({
      p_operation_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      p_name: 'Novo perfil',
      p_profile_key: expect.stringMatching(/^novo-perfil-[0-9a-f]{12}$/),
      p_version: expect.objectContaining({ mode: 'simple' }),
      p_blocks: [expect.objectContaining({ id: 'geral', nome: 'Geral' })]
    }))
    expect(perfil.id).toBe(PROFILE_ID)
  })

  it('reusa operation_id pendente para retry do mesmo payload', async () => {
    configurarDb({
      scoring_profiles: { data: null, error: { status: 503, message: 'server error after commit' } },
      scoring_profile_versions: { data: criarVersaoRow(), error: null },
      scoring_profile_blocks: { data: [criarBlocoRow()], error: null }
    }, {
      data: { profile_id: PROFILE_ID, version_id: VERSION_ID, version: 1 },
      error: null
    })
    const payload = {
      ...criarPerfilPontuacaoLegadoSimulado(),
      nome: 'Perfil retry'
    }

    await expect(criarPerfilPontuacao(payload)).rejects.toMatchObject({ tipo: 'rede' })
    const primeira = globalThis.db.rpc.mock.calls[0][1].p_operation_id

    configurarDb({
      scoring_profiles: { data: criarPerfilRemotoRow(), error: null },
      scoring_profile_versions: { data: criarVersaoRow(), error: null },
      scoring_profile_blocks: { data: [criarBlocoRow()], error: null }
    }, {
      data: { profile_id: PROFILE_ID, version_id: VERSION_ID, version: 1 },
      error: null
    })

    await criarPerfilPontuacao(payload)
    expect(globalThis.db.rpc.mock.calls[0][1].p_operation_id).toBe(primeira)
  })

  it('gera UUID seguro com getRandomValues quando randomUUID nao existe', () => {
    const originalCrypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues(bytes) {
          bytes.forEach((_, indice) => { bytes[indice] = indice + 1 })
          return bytes
        }
      }
    })

    const operacao = prepararOperacaoScoringProfileService('create_profile', 'fallback', { nome: 'Fallback' })

    expect(operacao.operationId).toMatch(/^01020304-0506-4708-890a-0b0c0d0e0f10$/)
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto })
  })

  it('classifica RPC ausente como migration pendente sem sucesso falso', async () => {
    configurarDb({}, {
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.create_scoring_profile_with_version in the schema cache' }
    })

    await expect(criarPerfilPontuacao({
      ...criarPerfilPontuacaoLegadoSimulado(),
      nome: 'Novo perfil'
    })).rejects.toMatchObject({
      tipo: 'migration',
      message: expect.stringContaining('migration local')
    })
  })

  it('nao confunde RLS com schema ausente ao ativar perfil', async () => {
    configurarDb({
      scoring_profiles: {
        data: null,
        error: { code: '42501', message: 'new row violates row-level security policy' }
      }
    })

    await expect(ativarPerfilPontuacao(PROFILE_ID)).rejects.toMatchObject({
      tipo: 'rls',
      message: expect.stringContaining('permissao')
    })
  })

  it('diferencia validacao, rede e imutabilidade', () => {
    expect(normalizarErroScoringProfileService({ code: '23514', message: 'check constraint' }).tipo).toBe('validacao')
    expect(normalizarErroScoringProfileService({ status: 503, message: 'server error' }).tipo).toBe('rede')
    expect(normalizarErroScoringProfileService({ message: 'scoring_profile_version_already_used' }).tipo).toBe('imutabilidade')
    expect(normalizarErroScoringProfileService({ message: 'scoring_profile_operation_payload_mismatch' }).tipo).toBe('idempotencia_conflito')
  })
})
