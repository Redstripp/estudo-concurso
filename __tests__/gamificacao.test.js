import { describe, it, expect } from 'vitest'

// Importa as funções reais de js/gamificacao.js via globalThis
const {
  dataHojeGamificacao,
  adicionarDiasGamificacao,
  calcularRecordeGamificacao,
  contarSequenciaGamificacao,
  adicionarDataNormalizadaGamificacao
} = globalThis

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

describe('adicionarDiasGamificacao', () => {
  it("'2025-01-01' + 1 deve retornar '2025-01-02'", () => {
    expect(adicionarDiasGamificacao('2025-01-01', 1)).toBe('2025-01-02')
  })

  it("'2025-01-31' + 1 deve retornar '2025-02-01'", () => {
    expect(adicionarDiasGamificacao('2025-01-31', 1)).toBe('2025-02-01')
  })

  it("'2025-01-05' - 3 deve retornar '2025-01-02'", () => {
    expect(adicionarDiasGamificacao('2025-01-05', -3)).toBe('2025-01-02')
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
