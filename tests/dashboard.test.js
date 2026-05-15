import { describe, it, expect } from 'vitest'

const {
  criarEstadoVazioDashboard,
  criarCardsDashboardVazios,
  criarPeriodoArquivamento,
  montarResumoArquivamentoMensal,
  criarResumoMateriaArquivamento,
  normalizarTipoArquivamento,
  formatarDataBRArquivamento,
  obterClasseAproveitamentoDashboard,
  criarDonutAproveitamentoDashboard
} = globalThis

describe('dashboard helpers', () => {
  it('cria estado vazio escapando HTML recebido', () => {
    const html = criarEstadoVazioDashboard('<b>Titulo</b>', 'A & B')

    expect(html).toContain('&lt;b&gt;Titulo&lt;/b&gt;')
    expect(html).toContain('A &amp; B')
  })

  it('cria os cards vazios do dashboard', () => {
    const html = criarCardsDashboardVazios()

    expect(html).toContain('dash-resumo-principal')
    expect(html).toContain('0%')
  })

  it('monta o periodo mensal de arquivamento a partir do mes alvo', () => {
    const periodo = criarPeriodoArquivamento(new Date('2026-05-01T12:00:00'), {
      podeLimpar: true,
      fimDeMes: true,
      pendente: true
    })

    expect(periodo).toMatchObject({
      inicio: '2026-05-01',
      fim: '2026-05-31',
      periodoMes: '2026-05-01',
      podeLimpar: true,
      fimDeMes: true,
      pendente: true
    })
  })

  it('monta resumo mensal com erradas, chutadas e acertos por materia', () => {
    const periodo = { inicio: '2026-05-01', fim: '2026-05-31', periodoMes: '2026-05-01' }
    const resumo = montarResumoArquivamentoMensal({
      questoes: [
        {
          id: 'q1',
          materia_id: 'm2',
          tipo_questao: 'Errada',
          motivo_erro: 'Conteudo',
          nivel_confianca: 'Baixa',
          materias: { nome: 'Constitucional' }
        },
        {
          id: 'q2',
          materia_id: 'm1',
          tipo_questao: 'Chutada',
          motivo_erro: 'Chute completo',
          nivel_confianca: 'Chutei',
          materias: { nome: 'Administrativo' }
        }
      ],
      questoesCertas: [
        { materia_id: 'm1', quantidade: 3, materias: { nome: 'Administrativo' } },
        { materia_id: 'm2', quantidade: 2, materias: { nome: 'Constitucional' } }
      ],
      simulados: [{ id: 's1' }]
    }, periodo)

    expect(resumo).toMatchObject({
      totalDetalhadas: 2,
      totalAcertos: 5,
      totalErradas: 1,
      totalChutadas: 1,
      totalGeral: 7,
      totalSimulados: 1
    })
    expect(resumo.desempenhoPorMateria.map(m => m.materia)).toEqual(['Administrativo', 'Constitucional'])
    expect(resumo.desempenhoPorMateria[0]).toMatchObject({
      materia_id: 'm1',
      acertos: 3,
      chutadas: 1,
      total: 4,
      aproveitamento: 75
    })
  })

  it('cria resumo vazio de materia e normaliza tipos de questao', () => {
    expect(criarResumoMateriaArquivamento('Direito', 'm1')).toEqual({
      materia_id: 'm1',
      materia: 'Direito',
      acertos: 0,
      erradas: 0,
      chutadas: 0,
      detalhadas: 0
    })
    expect(normalizarTipoArquivamento({ tipo_questao: 'Chutada' })).toBe('Chutada')
    expect(normalizarTipoArquivamento({ tipo_questao: 'Outro' })).toBe('Errada')
  })

  it('formata data e classes de aproveitamento', () => {
    expect(formatarDataBRArquivamento('2026-05-15')).toBe('15/05/2026')
    expect(obterClasseAproveitamentoDashboard(80)).toBe('alto')
    expect(obterClasseAproveitamentoDashboard(60)).toBe('medio')
    expect(obterClasseAproveitamentoDashboard(49)).toBe('baixo')
  })

  it('limita o donut de aproveitamento entre 0 e 100', () => {
    expect(criarDonutAproveitamentoDashboard(120)).toContain('stroke-dasharray="100 0"')
    expect(criarDonutAproveitamentoDashboard(-10)).toContain('stroke-dasharray="0 100"')
  })
})
