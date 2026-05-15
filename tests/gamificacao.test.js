import { describe, it, expect, vi } from 'vitest'

// Importa as funções reais de js/gamificacao.js via globalThis
const {
  avaliarConquistasUsuario,
  buscarDadosConquistasGamificacao,
  obterResumoStreakGamificacao,
  normalizarResumoGamificacaoBanco,
  adicionarDias,
  calcularRecordeGamificacao,
  contarSequenciaGamificacao,
  adicionarDataNormalizadaGamificacao
} = globalThis

describe('avaliarConquistasUsuario', () => {
  it('deve retornar lista vazia quando a coleta de dados falhar', async () => {
    const windowOriginal = globalThis.window
    const tinhaDb = Object.prototype.hasOwnProperty.call(globalThis, 'db')
    const dbOriginal = globalThis.db
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      globalThis.window = { usuarioAtual: { id: 'user-erro' } }
      globalThis.db = {
        from: () => {
          throw new Error('Tabela indisponivel')
        }
      }

      await expect(avaliarConquistasUsuario()).resolves.toEqual([])
      expect(warnSpy).toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
      globalThis.window = windowOriginal
      if (tinhaDb) {
        globalThis.db = dbOriginal
      } else {
        delete globalThis.db
      }
    }
  })
})

describe('resumo de gamificacao via RPC', () => {
  it('normaliza o payload retornado pela funcao do banco', () => {
    expect(normalizarResumoGamificacaoBanco({
      total_questoes: 100,
      total_diagnostico_completo: 4,
      total_diagnostico_forte: 2,
      motivo_repetido: true,
      revisao_concluida: true,
      streak: 7,
      recorde: 9,
      atividade_hoje: true,
      sequencia_em_risco: false
    })).toEqual({
      totalQuestoes: 100,
      totalDiagnosticoCompleto: 4,
      totalDiagnosticoForte: 2,
      motivoRepetido: true,
      revisaoConcluida: true,
      streak: {
        streak: 7,
        recorde: 9,
        atividadeHoje: true,
        sequenciaEmRisco: false,
        datas: []
      }
    })
  })

  it('busca conquistas pela RPC sem carregar linhas brutas de questoes', async () => {
    const dbOriginal = globalThis.db
    const localStorageOriginal = globalThis.localStorage
    const rpc = vi.fn(async () => ({
      data: {
        total_questoes: 100,
        total_diagnostico_completo: 1,
        total_diagnostico_forte: 10,
        motivo_repetido: true,
        revisao_concluida: true,
        streak: 7,
        recorde: 30,
        atividade_hoje: true,
        sequencia_em_risco: false
      },
      error: null
    }))
    const from = vi.fn(() => {
      throw new Error('Nao deve buscar registros brutos')
    })

    globalThis.db = { rpc, from }

    try {
      const dados = await buscarDadosConquistasGamificacao('user-rpc')

      expect(rpc).toHaveBeenCalledWith('obter_resumo_gamificacao')
      expect(from).not.toHaveBeenCalled()
      expect(dados.condicoes).toMatchObject({
        primeiro_erro: true,
        questoes_100: true,
        diagnostico_completo: true,
        diagnostico_forte_10: true,
        cacador_padroes: true,
        streak_30: true
      })
    } finally {
      globalThis.db = dbOriginal
      globalThis.localStorage = localStorageOriginal
    }
  })

  it('combina atividade local de hoje com streak calculado no banco ate ontem', async () => {
    const dbOriginal = globalThis.db
    const hoje = globalThis.dataHoje()
    const chave = 'estudoConcursoRevisoesConcluidas:user-streak'

    localStorage.setItem(chave, JSON.stringify([hoje]))
    globalThis.db = {
      rpc: vi.fn(async () => ({
        data: {
          streak: 4,
          recorde: 4,
          atividade_hoje: false,
          sequencia_em_risco: true
        },
        error: null
      }))
    }

    try {
      const resumo = await obterResumoStreakGamificacao('user-streak')

      expect(resumo.streak).toBe(5)
      expect(resumo.recorde).toBe(5)
      expect(resumo.atividadeHoje).toBe(true)
      expect(resumo.sequenciaEmRisco).toBe(false)
    } finally {
      localStorage.removeItem(chave)
      localStorage.removeItem('estudoConcursoRecordeStreak:user-streak')
      globalThis.db = dbOriginal
    }
  })
})

describe('calcularRecordeGamificacao', () => {
  it('Array vazio deve retornar 0', () => {
    expect(calcularRecordeGamificacao([])).toBe(0)
  })

  it("['2025-01-01'] deve retornar 1", () => {
    expect(calcularRecordeGamificacao(['2025-01-01'])).toBe(1)
  })

  it("['2025-01-01', '2025-01-02', '2025-01-03'] deve retornar 3", () => {
    expect(calcularRecordeGamificacao(['2025-01-01', '2025-01-02', '2025-01-03'])).toBe(3)
  })

  it("['2025-01-01', '2025-01-03'] (com gap) deve retornar 1", () => {
    expect(calcularRecordeGamificacao(['2025-01-01', '2025-01-03'])).toBe(1)
  })

  it("['2025-01-01', '2025-01-02', '2025-01-04', '2025-01-05'] deve retornar 2", () => {
    expect(calcularRecordeGamificacao(['2025-01-01', '2025-01-02', '2025-01-04', '2025-01-05'])).toBe(2)
  })
})

describe('contarSequenciaGamificacao', () => {
  it('Sequência de 3 dias consecutivos deve retornar 3', () => {
    const conjunto = new Set(['2025-01-01', '2025-01-02', '2025-01-03'])
    expect(contarSequenciaGamificacao(conjunto, '2025-01-03')).toBe(3)
  })

  it('Um dia isolado deve retornar 1', () => {
    const conjunto = new Set(['2025-01-01'])
    expect(contarSequenciaGamificacao(conjunto, '2025-01-01')).toBe(1)
  })

  it('Data não presente no conjunto deve retornar 0', () => {
    const conjunto = new Set(['2025-01-01', '2025-01-02'])
    expect(contarSequenciaGamificacao(conjunto, '2025-01-03')).toBe(0)
  })
})

describe('adicionarDias', () => {
  it("'2025-01-01' + 1 deve retornar '2025-01-02'", () => {
    expect(adicionarDias('2025-01-01', 1)).toBe('2025-01-02')
  })

  it("'2025-01-31' + 1 deve retornar '2025-02-01'", () => {
    expect(adicionarDias('2025-01-31', 1)).toBe('2025-02-01')
  })

  it("'2025-01-05' - 3 deve retornar '2025-01-02'", () => {
    expect(adicionarDias('2025-01-05', -3)).toBe('2025-01-02')
  })
})

describe('adicionarDataNormalizadaGamificacao', () => {
  it("Deve adicionar '2025-01-01' ao conjunto para um timestamp ISO válido", () => {
    const conjunto = new Set()
    adicionarDataNormalizadaGamificacao(conjunto, '2025-01-01T10:00:00Z')
    expect(conjunto.has('2025-01-01')).toBe(true)
  })

  it('Deve ignorar strings inválidas', () => {
    const conjunto = new Set()
    adicionarDataNormalizadaGamificacao(conjunto, 'invalido')
    expect(conjunto.size).toBe(0)
  })

  it('Deve ignorar null e undefined', () => {
    const conjunto = new Set()
    adicionarDataNormalizadaGamificacao(conjunto, null)
    adicionarDataNormalizadaGamificacao(conjunto, undefined)
    expect(conjunto.size).toBe(0)
  })
})
