import { describe, it, expect } from 'vitest'

const {
  renderizarTextoPlanejamentoComMarkdownBasico,
  criarCardLeiSeca,
  montarRelatorioProntoProva,
  montarFilaInteligente,
  converterDiaSemanaPlanejamento,
  adicionarDiasPlanejamento,
  dataPlanejamentoISO
} = globalThis

function criarElementoCardLeiSeca(sobrescritas = {}) {
  const container = document.createElement('div')
  container.innerHTML = criarCardLeiSeca({
    id: 'lei-seca-1',
    norma: 'Constituição Federal',
    artigo: 'art. 37',
    texto: 'Texto literal da norma',
    anotacoes: 'Atenção à **exceção constitucional**.',
    importancia: 4,
    status: 'revisar',
    revisar_em: '2099-06-10',
    total_revisoes: 2,
    total_erros: 1,
    materias: { nome: 'Direito Constitucional' },
    edital_topicos: { titulo: 'Administração Pública' },
    ...sobrescritas
  })
  return container.querySelector('.lei-seca-card')
}

describe('Markdown basico nas anotacoes de Lei Seca', () => {
  it('renderiza negrito seguro somente nas anotacoes exibidas', () => {
    const card = criarElementoCardLeiSeca({
      anotacoes: 'Atenção à **exceção constitucional** e <script>alert(1)</script>.'
    })
    const anotacao = card.querySelectorAll('.lei-seca-meta')[1]

    expect(anotacao.innerHTML).toContain('<strong>exceção constitucional</strong>')
    expect(anotacao.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(card.querySelector('script')).toBeNull()
  })

  it('preserva Markdown incompleto nas anotacoes', () => {
    expect(renderizarTextoPlanejamentoComMarkdownBasico('*sem fechamento')).toBe('*sem fechamento')
  })

  it('mantem texto literal e campos editaveis sem Markdown renderizado', () => {
    const textoLiteral = 'Artigo com **expressão literal** e <b>texto</b>.'
    const anotacoesEditaveis = 'Anotação com **exceção** e <script>alert(1)</script>.'
    const textareaTexto = document.createElement('textarea')
    const textareaAnotacoes = document.createElement('textarea')
    textareaTexto.value = textoLiteral
    textareaAnotacoes.value = anotacoesEditaveis

    const card = criarElementoCardLeiSeca({
      texto: textoLiteral,
      anotacoes: anotacoesEditaveis
    })
    const textoExibido = card.querySelector('.lei-seca-texto')

    expect(textoExibido.textContent).toBe(textoLiteral)
    expect(textoExibido.innerHTML).not.toContain('<strong>')
    expect(textoExibido.innerHTML).toContain('&lt;b&gt;texto&lt;/b&gt;')
    expect(textareaTexto.value).toBe(textoLiteral)
    expect(textareaAnotacoes.value).toBe(anotacoesEditaveis)
    expect(card.querySelector('textarea, input, select')).toBeNull()
  })

  it('mantem norma, artigo, materia, topico, metricas, botoes e atributos inalterados', () => {
    const card = criarElementoCardLeiSeca({
      id: 'lei-seca-atributos',
      norma: '**Constituição Federal**',
      artigo: '*art. 37*',
      materias: { nome: '**Direito Constitucional**' },
      edital_topicos: { titulo: '*Administração Pública*' }
    })

    expect(card.querySelector('.lei-seca-topo strong').textContent)
      .toBe('**Constituição Federal** · *art. 37*')
    expect(card.querySelector('.lei-seca-topo .lei-seca-meta').textContent)
      .toBe('**Direito Constitucional** · *Administração Pública*')
    expect(card.querySelector('.questao-tags-estudo').textContent).toContain('Importância 4')
    expect(card.querySelector('.questao-tags-estudo').textContent).toContain('2 revisões')
    expect(card.querySelector('.questao-tags-estudo').textContent).toContain('1 erros')
    expect(card.querySelector('.btn-lei-revisado').textContent).toBe('Revisei')
    expect(card.querySelector('.btn-lei-revisado').dataset.id).toBe('lei-seca-atributos')
    expect(card.querySelector('.btn-lei-revisado').className)
      .toBe('btn-secundario btn-lei-revisado')
  })
})

describe('montarRelatorioProntoProva', () => {
  it('calcula o relatório com edital, questões, revisões e Lei Seca', () => {
    const relatorio = montarRelatorioProntoProva({
      topicos: [
        { id: 't1', status: 'dominado', titulo: 'Atos administrativos', materias: { nome: 'Administrativo' } },
        { id: 't2', status: 'revisar', titulo: 'Controle de constitucionalidade', materias: { nome: 'Constitucional' } }
      ],
      questoes: [
        { tipo_questao: 'Errada', status_revisao: 'pendente', revisar_novamente_em: '2000-01-01' },
        { tipo_questao: 'Chutada', status_revisao: 'ok', revisar_novamente_em: null }
      ],
      certas: [
        { materia_id: 'm1', quantidade: 2 }
      ],
      leiSeca: [
        { status: 'ler' }
      ],
      config: {
        concurso_alvo: 'TJ',
        data_prova: null
      }
    })

    expect(relatorio).toMatchObject({
      score: 65,
      dominio: 50,
      aproveitamento: 50,
      vencidas: 1,
      leiPendentes: 1,
      concurso: 'TJ'
    })
    expect(relatorio.criticos).toHaveLength(1)
  })
})

describe('planejamento inteligente', () => {
  it('converte datas e soma dias sem depender do fuso do navegador', () => {
    expect(converterDiaSemanaPlanejamento('2026-05-17')).toBe(7)
    expect(converterDiaSemanaPlanejamento('2026-05-18')).toBe(1)
    expect(adicionarDiasPlanejamento('2026-02-28', 1)).toBe('2026-03-01')
    expect(dataPlanejamentoISO(new Date('2026-05-15T12:00:00'))).toBe('2026-05-15')
  })

  it('monta fila inteligente combinando grade, revisoes, edital e Lei Seca', () => {
    const fila = montarFilaInteligente({
      materias: [
        { id: 'm1', nome: 'Administrativo' },
        { id: 'm2', nome: 'Constitucional' }
      ],
      grade: [
        { materia_id: 'm1', dia_semana: 5, tipo_estudo: 'questoes' }
      ],
      certas: [
        { materia_id: 'm1', quantidade: 4 },
        { materia_id: 'm2', quantidade: 1 }
      ],
      questoes: [
        {
          materia_id: 'm2',
          tipo_questao: 'Errada',
          status_revisao: 'pendente',
          revisar_novamente_em: '2026-05-10',
          revisao_total_erros: 2
        }
      ],
      topicos: [
        { materia_id: 'm1', titulo: 'Atos administrativos', status: 'dificuldade', peso: 4 }
      ],
      leiSeca: [
        { materia_id: 'm2', status: 'ler', revisar_em: '2026-05-01', importancia: 4 }
      ],
      perfil: { meta_diaria: 20 },
      config: { data_prova: null }
    }, '2026-05-15')

    const administrativo = fila.find(item => item.materiaId === 'm1')
    const constitucional = fila.find(item => item.materiaId === 'm2')

    expect(administrativo).toMatchObject({
      materia: 'Administrativo',
      planejadaHoje: true,
      recomendacao: 'Teoria dirigida',
      meta: 20
    })
    expect(constitucional).toMatchObject({
      materia: 'Constitucional',
      vencidas: 1,
      leiVencida: 1,
      recomendacao: 'Revisão espaçada',
      meta: 20
    })
  })
})
