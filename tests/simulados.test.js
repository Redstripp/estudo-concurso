import { describe, it, expect } from 'vitest'

const {
  calcularProximaRevisaoSimulado,
  calcularEtapaRevisaoSimulado24730,
  normalizarTipoQuestaoSimulado,
  obterRotuloFiltroTipo,
  obterRotuloPeriodoSimuladoRevisao,
  filtrarQuestoesPorPeriodoRevisao,
  formatarDataISOParaSimulado,
  adicionarDiasDataISO,
  embaralharQuestoes,
  formatarDataSimulado
} = globalThis

describe('simulados helpers', () => {
  it('calcula proxima revisao no ciclo 24h/7d/30d', () => {
    expect(calcularProximaRevisaoSimulado('2026-05-15', { revisao_etapa: 0 }, false, 'Confiante')).toBe('2026-05-16')
    expect(calcularProximaRevisaoSimulado('2026-05-15', { revisao_etapa: 0 }, true, 'Confiante')).toBe('2026-05-22')
    expect(calcularProximaRevisaoSimulado('2026-05-15', { revisao_etapa: 1 }, true, 'Confiante')).toBe('2026-06-14')
    expect(calcularProximaRevisaoSimulado('2026-05-15', { revisao_etapa: 2 }, true, 'Duvida')).toBe('2026-06-14')
    expect(calcularProximaRevisaoSimulado('2026-05-15', { revisao_etapa: 2 }, true, 'Confiante')).toBeNull()
  })

  it('calcula etapa de revisao de simulado', () => {
    expect(calcularEtapaRevisaoSimulado24730({ revisao_etapa: 2 }, false, 'Confiante', '2026-05-16')).toBe(0)
    expect(calcularEtapaRevisaoSimulado24730({ revisao_etapa: 1 }, true, 'Duvida', '2026-06-14')).toBe(1)
    expect(calcularEtapaRevisaoSimulado24730({ revisao_etapa: 1 }, true, 'Confiante', '2026-06-14')).toBe(2)
    expect(calcularEtapaRevisaoSimulado24730({ revisao_etapa: 2 }, true, 'Confiante', null)).toBe(3)
  })

  it('normaliza tipo de questao e rotulos de filtro', () => {
    expect(normalizarTipoQuestaoSimulado({ motivo_erro: 'Chute completo' })).toBe('Chutada')
    expect(normalizarTipoQuestaoSimulado({ tipo_questao: 'Errada' })).toBe('Errada')
    expect(obterRotuloFiltroTipo('Chutada')).toContain('baixa')
    expect(obterRotuloFiltroTipo('Errada')).toContain('erros')
    expect(obterRotuloPeriodoSimuladoRevisao('30')).toContain('4')
    expect(obterRotuloPeriodoSimuladoRevisao('all')).toContain('Todas')
  })

  it('retorna todas as questoes quando periodo de revisao e all', () => {
    const questoes = [{ id: 'q1' }, { id: 'q2' }]

    expect(filtrarQuestoesPorPeriodoRevisao(questoes, 'all')).toBe(questoes)
  })

  it('formata e desloca datas ISO', () => {
    expect(formatarDataISOParaSimulado(new Date('2026-05-15T12:00:00'))).toBe('2026-05-15')
    expect(adicionarDiasDataISO('2026-02-28', 1)).toBe('2026-03-01')
    expect(formatarDataSimulado('2026-05-15')).toBe('15/05/2026')
  })

  it('embaralha em uma copia sem mutar a lista original', () => {
    const questoes = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]
    const embaralhadas = embaralharQuestoes(questoes)

    expect(embaralhadas).not.toBe(questoes)
    expect(questoes.map(q => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(embaralhadas.map(q => q.id).sort()).toEqual(['q1', 'q2', 'q3'])
  })
})
