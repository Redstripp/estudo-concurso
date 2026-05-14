import { describe, it, expect } from 'vitest'

const {
  calcularProximaRevisao24730,
  calcularEtapaRevisao24730
} = globalThis

describe('calcularProximaRevisao24730', () => {
  it('deve repetir a etapa 0 em 1 dia quando acertar sem confianca', () => {
    expect(calcularProximaRevisao24730({ revisao_etapa: 0 }, '2026-05-14', true, 'Dúvida'))
      .toBe('2026-05-15')
  })

  it('deve repetir a etapa 1 em 7 dias quando acertar sem confianca', () => {
    expect(calcularProximaRevisao24730({ revisao_etapa: 1 }, '2026-05-14', true, 'Chutei'))
      .toBe('2026-05-21')
  })

  it('deve repetir a etapa 2 em 30 dias quando acertar sem confianca', () => {
    expect(calcularProximaRevisao24730({ revisao_etapa: 2 }, '2026-05-14', true, 'Dúvida'))
      .toBe('2026-06-13')
  })

  it('deve avancar normalmente quando acertar com confianca', () => {
    expect(calcularProximaRevisao24730({ revisao_etapa: 0 }, '2026-05-14', true, 'Confiante'))
      .toBe('2026-05-21')
    expect(calcularProximaRevisao24730({ revisao_etapa: 1 }, '2026-05-14', true, 'Confiante'))
      .toBe('2026-06-13')
    expect(calcularProximaRevisao24730({ revisao_etapa: 2 }, '2026-05-14', true, 'Confiante'))
      .toBeNull()
  })

  it('deve voltar para 1 dia quando errar', () => {
    expect(calcularProximaRevisao24730({ revisao_etapa: 2 }, '2026-05-14', false, 'Confiante'))
      .toBe('2026-05-15')
  })
})

describe('calcularEtapaRevisao24730', () => {
  it('deve manter a etapa quando acertar sem confianca e houver nova revisao', () => {
    expect(calcularEtapaRevisao24730({ revisao_etapa: 0 }, true, 'Dúvida', '2026-05-15')).toBe(0)
    expect(calcularEtapaRevisao24730({ revisao_etapa: 1 }, true, 'Chutei', '2026-05-21')).toBe(1)
    expect(calcularEtapaRevisao24730({ revisao_etapa: 2 }, true, 'Dúvida', '2026-06-13')).toBe(2)
  })
})
