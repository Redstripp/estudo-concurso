import { describe, it, expect } from 'vitest'

const {
  montarRelatorioEvolucao,
  normalizarTipoQuestaoRelatorio,
  contarValoresEstatisticas,
  formatarDataBREstatisticas,
  agruparErradasPorMateria,
  agruparCertasPorMateria,
  calcularResumoPeriodo,
  formatarDeltaRelatorio,
  escaparHtmlEstatisticas
} = globalThis

describe('estatisticas helpers', () => {
  it('monta relatorio de evolucao com simulados, revisoes e pendencias', () => {
    const relatorio = montarRelatorioEvolucao({
      simulados: [
        { id: 's1', data: '2026-05-10', nota_percentual: 80 },
        { id: 's0', data: '2026-05-01', nota_percentual: 70 }
      ],
      revisoes: [
        { resultado: 'Acertou', nivel_confianca: 'Duvida' },
        { resultado: 'Errou', nivel_confianca: 'Confiante' },
        { resultado: 'Acertou', nivel_confianca: 'Confiante' }
      ],
      questoes: [
        { status_revisao: 'pendente', tipo_questao: 'Errada', motivo_erro: 'Conteudo' },
        { status_revisao: 'pendente', tipo_questao: 'Chutada', motivo_erro: 'Chute completo' },
        { status_revisao: 'recuperada', tipo_questao: 'Errada' }
      ]
    })

    expect(relatorio).toMatchObject({
      notaAtual: 80,
      deltaSimulado: 10,
      totalRevisoes: 3,
      acertosRevisao: 2,
      errosRevisao: 1,
      aproveitamentoRevisao: 67,
      acertosSemDominio: 1,
      pendentes: 2,
      errosDominio: 1,
      baixaConfianca: 1,
      recuperadas: 1,
      semDiagnostico: 2
    })
  })

  it('normaliza tipo de questao para relatorio', () => {
    expect(normalizarTipoQuestaoRelatorio({ tipo_questao: 'Chutada' })).toBe('Chutada')
    expect(normalizarTipoQuestaoRelatorio({ motivo_erro: 'Chute completo' })).toBe('Chutada')
    expect(normalizarTipoQuestaoRelatorio({ nivel_confianca: 'Chutei' })).toBe('Chutada')
    expect(normalizarTipoQuestaoRelatorio({})).toBe('Errada')
  })

  it('conta valores ordenando por total e nome', () => {
    expect(contarValoresEstatisticas(['B', 'A', 'B', 'A', 'A'])).toEqual([
      { nome: 'A', total: 3 },
      { nome: 'B', total: 2 }
    ])
  })

  it('agrupa erradas e certas por materia', () => {
    expect(agruparErradasPorMateria([
      { materia_id: 'm1' },
      { materia_id: 'm1', quantidade: 2 },
      { materia_id: 'm2', quantidade: 'x' }
    ])).toEqual({ m1: 3, m2: 1 })

    expect(agruparCertasPorMateria([
      { materia_id: 'm1', quantidade: 4 },
      { materia_id: 'm1', quantidade: 1 },
      { materia_id: 'm2', quantidade: 'x' }
    ])).toEqual({ m1: 5, m2: 0 })
  })

  it('calcula resumo do periodo', () => {
    expect(calcularResumoPeriodo({
      erradas: [{ quantidade: 2 }, {}],
      certas: [{ quantidade: 7 }]
    })).toEqual({
      total: 10,
      totalCertas: 7,
      totalErradas: 3,
      aproveitamento: 70
    })
  })

  it('formata datas, deltas e HTML seguro', () => {
    expect(formatarDataBREstatisticas('2026-05-15')).toBe('15/05/2026')
    expect(formatarDeltaRelatorio(2.5)).toEqual({ texto: '+2.5 pts', classe: 'relatorio-delta--positivo' })
    expect(formatarDeltaRelatorio(-1)).toEqual({ texto: '-1.0 pts', classe: 'relatorio-delta--negativo' })
    expect(formatarDeltaRelatorio(null)).toEqual({ texto: 'Sem comparação', classe: 'relatorio-delta--neutro' })
    expect(escaparHtmlEstatisticas('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;')
  })
})
