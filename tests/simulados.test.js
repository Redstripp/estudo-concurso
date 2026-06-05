import { describe, it, expect } from 'vitest'

const {
  renderizarTextoSimuladoComMarkdownBasico,
  criarCardSimuladoRevisao,
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

function criarQuestaoSimuladoMarkdown(sobrescritas = {}) {
  return {
    id: 'simulado-md-1',
    enunciado: 'Enunciado com **controle difuso** e <script>alert(1)</script>',
    alternativas: {
      A: '*Alternativa* com <img src=x onerror=alert(1)>',
      B: 'Alternativa correta'
    },
    alternativa_marcada: 'A',
    alternativa_correta: 'B',
    tipo_questao: 'Errada',
    status_revisao: 'pendente',
    revisar_novamente_em: '2026-06-10',
    revisao_total_acertos: 0,
    revisao_total_erros: 1,
    revisao_etapa: 0,
    motivo_erro: 'Falta de conteúdo',
    nivel_confianca: 'Dúvida',
    comentario: 'Comentário com **regra central**',
    conceito_chave: 'Conceito com **competência**',
    como_reconhecer: 'Reconhecer por *termo absoluto*',
    acao_corretiva: 'Revisar **artigo seco**',
    criado_em: '2026-06-04T12:00:00.000Z',
    materias: { nome: 'Direito Constitucional' },
    edital_topicos: { titulo: 'Controle de constitucionalidade' },
    banca: 'CEBRASPE',
    pegadinha_banca: 'Pegadinha com *palavra absoluta*',
    ...sobrescritas
  }
}

describe('Markdown basico nos cards de Simulados', () => {
  it('renderiza negrito seguro no enunciado e nas alternativas', () => {
    const card = criarCardSimuladoRevisao(criarQuestaoSimuladoMarkdown(), 1)

    expect(card.querySelector('.card-revisao-enunciado').innerHTML)
      .toContain('<strong>controle difuso</strong>')
    expect(card.querySelector('.alt-texto').innerHTML)
      .toContain('<strong>Alternativa</strong>')
    expect(card.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(card.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(card.querySelector('script')).toBeNull()
    expect(card.querySelector('img')).toBeNull()
  })

  it('renderiza negrito seguro em comentario e diagnosticos exibidos', () => {
    const card = criarCardSimuladoRevisao(criarQuestaoSimuladoMarkdown(), 1)

    expect(card.innerHTML).toContain('<strong>regra central</strong>')
    expect(card.innerHTML).toContain('<strong>palavra absoluta</strong>')
    expect(card.innerHTML).toContain('<strong>competência</strong>')
    expect(card.innerHTML).toContain('<strong>termo absoluto</strong>')
    expect(card.innerHTML).toContain('<strong>artigo seco</strong>')
    expect(card.innerHTML).not.toContain('<script>')
  })

  it('mantem campos editaveis com Markdown literal, sem renderizar HTML', () => {
    const campos = {
      '.simulado-diagnostico-conceito': 'Conceito com **competência** e <script>alert(1)</script>',
      '.simulado-diagnostico-reconhecer': 'Reconhecer por *termo absoluto*',
      '.simulado-diagnostico-acao': 'Revisar **artigo seco**'
    }
    const card = criarCardSimuladoRevisao(criarQuestaoSimuladoMarkdown({
      conceito_chave: campos['.simulado-diagnostico-conceito'],
      como_reconhecer: campos['.simulado-diagnostico-reconhecer'],
      acao_corretiva: campos['.simulado-diagnostico-acao']
    }), 1)

    Object.entries(campos).forEach(([seletor, valor]) => {
      const textarea = card.querySelector(seletor)
      expect(textarea.value).toBe(valor)
      expect(textarea.innerHTML).not.toContain('<strong>')
      expect(textarea.querySelector('strong')).toBeNull()
    })
    expect(card.querySelector('.simulado-pre-resposta').innerHTML).not.toContain('<strong>')
  })

  it('preserva Markdown incompleto', () => {
    expect(renderizarTextoSimuladoComMarkdownBasico('*sem fechamento')).toBe('*sem fechamento')
  })
})

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
