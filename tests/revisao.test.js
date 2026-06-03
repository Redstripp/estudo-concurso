import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const appHtml = readFileSync(new URL('../app.html', import.meta.url), 'utf8')
const revisaoJs = readFileSync(new URL('../js/revisao.js', import.meta.url), 'utf8')

const {
  renderizarTextoRevisaoComMarkdownBasico,
  criarCardTreinoPegadinha,
  calcularProximaRevisao24730,
  calcularEtapaRevisao24730,
  preRespostaTreinoCompleta,
  criarDiagnosticoTreino,
  criarCardTreinoRevisao,
  criarCardRevisao
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

describe('preRespostaTreinoCompleta', () => {
  it('aceita conceito preenchido com ao menos um item do checklist marcado', () => {
    expect(preRespostaTreinoCompleta({
      texto: 'CF 37',
      checklist: { comando: true, pegadinha: false, tipo: false }
    })).toBe(true)
  })

  it('bloqueia quando o conceito está vazio', () => {
    expect(preRespostaTreinoCompleta({
      texto: '   ',
      checklist: { comando: true, pegadinha: true, tipo: true }
    })).toBe(false)
  })

  it('bloqueia quando nenhum item do checklist foi marcado', () => {
    expect(preRespostaTreinoCompleta({
      texto: 'Lei seca',
      checklist: { comando: false, pegadinha: false, tipo: false }
    })).toBe(false)
  })
})

describe('Markdown basico na Revisao Inteligente', () => {
  function criarQuestaoRevisao(sobrescritas = {}) {
    return {
      id: 'rev-md-1',
      enunciado: 'Enunciado com **controle difuso** e <script>alert(1)</script>',
      alternativas: {
        A: '*Alternativa* errada',
        B: 'Alternativa correta'
      },
      alternativa_marcada: 'A',
      alternativa_correta: 'B',
      tipo_questao: 'Errada',
      status_revisao: 'pendente',
      revisao_total_acertos: 0,
      revisao_total_erros: 0,
      revisao_etapa: 0,
      motivo_erro: 'Falta de conteudo',
      nivel_confianca: 'Duvida',
      comentario: 'Comentario com **regra central**',
      pegadinha_banca: 'Pegadinha com *palavra absoluta*',
      conceito_chave: 'Conceito com **competencia**',
      como_reconhecer: 'Reconhecer por *termo absoluto*',
      acao_corretiva: 'Revisar **artigo seco**',
      criado_em: '2026-05-20T12:00:00.000Z',
      materias: { nome: 'Direito Constitucional' },
      edital_topicos: { titulo: 'Controle de constitucionalidade' },
      ...sobrescritas
    }
  }

  it('renderiza negrito em enunciado, comentario e pegadinhas sem XSS', () => {
    const card = criarCardRevisao(criarQuestaoRevisao(), 1)

    expect(card.querySelector('.card-revisao-enunciado').innerHTML)
      .toContain('<strong>controle difuso</strong>')
    expect(card.querySelector('.card-questao-comentario').innerHTML)
      .toContain('<strong>regra central</strong>')
    expect(card.innerHTML).toContain('<strong>palavra absoluta</strong>')
    expect(card.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(card.innerHTML).not.toContain('<script>')
  })

  it('renderiza negrito no diagnostico do treino', () => {
    const html = criarDiagnosticoTreino(criarQuestaoRevisao())

    expect(html).toContain('<strong>competencia</strong>')
    expect(html).toContain('<strong>termo absoluto</strong>')
    expect(html).toContain('<strong>artigo seco</strong>')
    expect(html).not.toContain('<script>')
  })

  it('mantem treino de pegadinhas funcionando com texto seguro', () => {
    const card = criarCardTreinoPegadinha(criarQuestaoRevisao())

    expect(card.querySelector('.card-revisao-enunciado').innerHTML)
      .toContain('<strong>controle difuso</strong>')
    expect(card.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(card.querySelector('#btn-revelar-pegadinha')).not.toBeNull()
  })

  it('nao aplica Markdown em campos editaveis do treino', () => {
    const card = criarCardTreinoRevisao(criarQuestaoRevisao(), false)

    expect(card.querySelector('.card-revisao-enunciado').innerHTML)
      .toContain('<strong>controle difuso</strong>')
    expect(card.querySelector('#treino-pre-resposta').innerHTML).not.toContain('<strong>')
    expect(revisaoJs).not.toContain('renderizarTextoRevisaoComMarkdownBasico(treinoRevisaoPreResposta')
  })

  it('helper local preserva texto normal e asterisco sem fechamento', () => {
    expect(renderizarTextoRevisaoComMarkdownBasico('texto normal')).toBe('texto normal')
    expect(renderizarTextoRevisaoComMarkdownBasico('*sem fechamento')).toBe('*sem fechamento')
  })
})

describe('calcularEtapaRevisao24730', () => {
  it('deve manter a etapa quando acertar sem confianca e houver nova revisao', () => {
    expect(calcularEtapaRevisao24730({ revisao_etapa: 0 }, true, 'Dúvida', '2026-05-15')).toBe(0)
    expect(calcularEtapaRevisao24730({ revisao_etapa: 1 }, true, 'Chutei', '2026-05-21')).toBe(1)
    expect(calcularEtapaRevisao24730({ revisao_etapa: 2 }, true, 'Dúvida', '2026-06-13')).toBe(2)
  })
})

describe('clareza do treino filtrado da Revisao', () => {
  it('usa rotulo claro para treinar a lista filtrada', () => {
    const inicioBotao = appHtml.indexOf('id="btn-iniciar-treino-revisao"')
    const trechoBotao = appHtml.slice(inicioBotao, inicioBotao + 260)

    expect(trechoBotao).toContain('Treinar lista filtrada')
    expect(trechoBotao).not.toContain('Flashcards')
  })

  it('explica que a lista vazia depende dos filtros atuais', () => {
    expect(revisaoJs).toContain('Nenhuma questão pendente com estes filtros')
    expect(revisaoJs).toContain('Use a fila inteligente para revisar itens priorizados do ciclo')
    expect(revisaoJs).not.toContain('Nenhuma questão pendente para treinar com esses filtros')
  })
})
