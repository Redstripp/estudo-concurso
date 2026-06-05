import { describe, it, expect } from 'vitest'

const {
  renderizarTextoEditalComMarkdownBasico,
  criarCardTopicoEdital,
  criarCardPegadinhaEdital,
  validarDataProvaEdital,
  filtrarTopicosEditalPorMateria,
  obterTextoBotaoConfigEdital
} = globalThis

function criarElementoHtmlEdital(html, seletor) {
  const container = document.createElement('div')
  container.innerHTML = html
  return container.querySelector(seletor)
}

function criarTopicoEditalMarkdown(sobrescritas = {}) {
  return {
    id: 'topico-edital-1',
    materia_id: 'materia-1',
    titulo: '**Controle de constitucionalidade**',
    status: 'revisar',
    peso: 4,
    observacoes: 'Revisar **controle difuso** e <script>alert(1)</script>.',
    materias: { nome: '**Direito Constitucional**' },
    ...sobrescritas
  }
}

function criarStatsTopicoEditalTeste() {
  return {
    total: 3,
    erradas: 2,
    chutadas: 0,
    pendentes: 1,
    recuperadas: 0,
    acertosRevisao: 1,
    errosRevisao: 1,
    ultimaRevisao: '2026-06-05'
  }
}

function criarPegadinhaEditalMarkdown(sobrescritas = {}) {
  return {
    id: 'pegadinha-edital-1',
    banca: '**CEBRASPE**',
    padrao: 'Troca **competência do órgão** e <img src=x onerror=alert(1)>.',
    acao: 'Confirmar **quem pratica o ato** antes de responder.',
    materias: { nome: '**Direito Administrativo**' },
    edital_topicos: { titulo: '**Atos administrativos**' },
    ...sobrescritas
  }
}

describe('Markdown basico nos textos livres do Edital', () => {
  it('renderiza negrito seguro somente nas observacoes do topico', () => {
    const card = criarElementoHtmlEdital(
      criarCardTopicoEdital(criarTopicoEditalMarkdown(), criarStatsTopicoEditalTeste()),
      '.edital-topico-card'
    )
    const observacoes = card.querySelector('.edital-topico-observacao')

    expect(observacoes.innerHTML).toContain('<strong>controle difuso</strong>')
    expect(observacoes.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(card.querySelector('script')).toBeNull()
  })

  it('renderiza negrito seguro no padrao e na acao da pegadinha', () => {
    const card = criarElementoHtmlEdital(
      criarCardPegadinhaEdital(criarPegadinhaEditalMarkdown()),
      '.pegadinha-card'
    )

    expect(card.querySelector('.pegadinha-padrao').innerHTML)
      .toContain('<strong>competência do órgão</strong>')
    expect(card.querySelector('.pegadinha-acao').innerHTML)
      .toContain('<strong>quem pratica o ato</strong>')
    expect(card.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(card.querySelector('img')).toBeNull()
  })

  it('preserva Markdown incompleto e escapa HTML bruto', () => {
    expect(renderizarTextoEditalComMarkdownBasico('*sem fechamento'))
      .toBe('*sem fechamento')
    expect(renderizarTextoEditalComMarkdownBasico('<b>texto bruto</b>'))
      .toBe('&lt;b&gt;texto bruto&lt;/b&gt;')
  })

  it('mantem campos editaveis com conteudo literal', () => {
    const valores = [
      'Observação com **negrito**',
      'Padrão com **negrito**',
      'Ação com <script>alert(1)</script>'
    ]
    const campos = valores.map(valor => {
      const textarea = document.createElement('textarea')
      textarea.value = valor
      return textarea
    })

    campos.forEach((campo, indice) => {
      expect(campo.value).toBe(valores[indice])
      expect(campo.innerHTML).not.toContain('<strong>')
    })
  })

  it('mantem titulo, materia, status, peso, metricas, filtro, botao e atributos inalterados', () => {
    const topico = criarTopicoEditalMarkdown()
    const card = criarElementoHtmlEdital(
      criarCardTopicoEdital(topico, criarStatsTopicoEditalTeste()),
      '.edital-topico-card'
    )
    const filtro = document.createElement('select')
    filtro.innerHTML = '<option value="materia-1">**Direito Constitucional**</option>'

    expect(card.querySelector('h4').textContent).toBe(topico.titulo)
    expect(card.querySelector('.tag-materia').textContent).toBe(topico.materias.nome)
    expect(card.querySelector('.tag-estudo').textContent).toBe('Peso 4')
    expect(card.querySelector('.edital-status-select').value).toBe('revisar')
    expect(card.querySelector('.edital-status-select').dataset.id).toBe(topico.id)
    expect(card.querySelector('.edital-status-select').getAttribute('aria-label')).toBe('Status do assunto')
    expect(card.querySelector('.edital-topico-metricas').textContent).toContain('3 questões')
    expect(card.querySelector('.btn-excluir-topico-edital').textContent).toBe('Excluir assunto')
    expect(card.querySelector('.btn-excluir-topico-edital').dataset.id).toBe(topico.id)
    expect(filtro.value).toBe('materia-1')
    expect(filtro.textContent).toBe('**Direito Constitucional**')
  })

  it('exibe com seguranca pegadinha que pode ser originada de Questoes', () => {
    const pegadinha = criarPegadinhaEditalMarkdown({
      padrao: 'Questão registrou **palavra absoluta** e <script>alert(1)</script>.'
    })
    const card = criarElementoHtmlEdital(criarCardPegadinhaEdital(pegadinha), '.pegadinha-card')

    expect(card.querySelector('.pegadinha-padrao').innerHTML)
      .toContain('<strong>palavra absoluta</strong>')
    expect(card.querySelector('.tag-estudo').textContent).toBe(pegadinha.banca)
    expect(card.querySelector('.tag-materia').textContent).toBe(pegadinha.materias.nome)
    expect(card.querySelector('.btn-excluir-pegadinha').dataset.id).toBe(pegadinha.id)
    expect(card.querySelector('script')).toBeNull()
  })
})

describe('validarDataProvaEdital', () => {
  it('permite campo vazio para limpar a data da prova', () => {
    expect(validarDataProvaEdital('', { hoje: '2026-05-14' })).toEqual({
      data: null,
      erro: ''
    })
  })

  it('rejeita formato inválido', () => {
    expect(validarDataProvaEdital('14/05/2026', { hoje: '2026-05-14' }).erro)
      .toBe('Digite uma data válida para a prova.')
  })

  it('rejeita datas impossíveis', () => {
    expect(validarDataProvaEdital('2026-02-31', { hoje: '2026-05-14' }).erro)
      .toBe('Digite uma data válida para a prova.')
  })

  it('rejeita datas no passado', () => {
    expect(validarDataProvaEdital('2026-05-13', { hoje: '2026-05-14' }).erro)
      .toBe('A data da prova não pode estar no passado.')
  })

  it('aceita hoje ou uma data futura', () => {
    expect(validarDataProvaEdital('2026-05-14', { hoje: '2026-05-14' })).toEqual({
      data: '2026-05-14',
      erro: ''
    })
    expect(validarDataProvaEdital('2026-06-01', { hoje: '2026-05-14' })).toEqual({
      data: '2026-06-01',
      erro: ''
    })
  })
})

describe('filtrarTopicosEditalPorMateria', () => {
  const topicos = [
    { id: 't1', materia_id: 'm1', titulo: 'Constitucional' },
    { id: 't2', materia_id: 'm2', titulo: 'Português' },
    { id: 't3', materia_id: 'm1', titulo: 'Administrativo' }
  ]

  it('retorna todos os assuntos quando nenhuma matéria foi escolhida', () => {
    expect(filtrarTopicosEditalPorMateria(topicos, '')).toEqual(topicos)
  })

  it('retorna apenas os assuntos da matéria selecionada', () => {
    expect(filtrarTopicosEditalPorMateria(topicos, 'm1')).toEqual([
      topicos[0],
      topicos[2]
    ])
  })
})

describe('obterTextoBotaoConfigEdital', () => {
  it('usa texto de atualização quando a reta final já tem concurso ou data', () => {
    expect(obterTextoBotaoConfigEdital({ concurso_alvo: 'TJ', data_prova: null }))
      .toBe('Atualizar reta final')
    expect(obterTextoBotaoConfigEdital({ concurso_alvo: null, data_prova: '2026-06-01' }))
      .toBe('Atualizar reta final')
  })

  it('usa texto de criação quando não existe reta final preenchida', () => {
    expect(obterTextoBotaoConfigEdital(null)).toBe('Salvar reta final')
    expect(obterTextoBotaoConfigEdital({ concurso_alvo: null, data_prova: null }))
      .toBe('Salvar reta final')
  })
})
