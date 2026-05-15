import { describe, it, expect, afterEach } from 'vitest'

const {
  montarItemPlano,
  criarCardPlano,
  intervaloSemanaPlano,
  diferencaDiasPlano,
  dataISOPlano,
  mostrarMsgPlano
} = globalThis

describe('plano helpers', () => {
  afterEach(() => {
    document.getElementById('fixture-plano')?.remove()
  })

  it('marca item sem historico como atencao e aumenta a meta sugerida', () => {
    const item = montarItemPlano({
      id: 'p1',
      data: '2026-05-13',
      meta_questoes: 10,
      materias: { nome: 'Direito' }
    }, {
      certasSemana: 0,
      erradasSemana: 0,
      certasHistorico: 0,
      erradasHistorico: 0,
      ultimaData: null
    })

    expect(item).toMatchObject({
      nomeMateria: 'Direito',
      status: 'atencao',
      metaSugerida: 13,
      totalSemana: 0,
      aproveitamentoSemana: null,
      aproveitamentoHistorico: null,
      diasSemEstudar: null
    })
  })

  it('prioriza materia com baixo aproveitamento ou muitos dias sem estudo', () => {
    const item = montarItemPlano({
      id: 'p2',
      data: '2026-05-13',
      meta_questoes: 10,
      materias: { nome: 'Constitucional' }
    }, {
      certasSemana: 2,
      erradasSemana: 8,
      certasHistorico: 4,
      erradasHistorico: 6,
      ultimaData: '2026-05-01'
    })

    expect(item.status).toBe('priorizar')
    expect(item.metaSugerida).toBe(15)
    expect(item.aproveitamentoSemana).toBe(20)
    expect(item.aproveitamentoHistorico).toBe(40)
    expect(item.diasSemEstudar).toBe(12)
  })

  it('cria card do plano escapando texto e preservando controles', () => {
    const item = montarItemPlano({
      id: 'p3',
      data: '2026-05-13',
      meta_questoes: 8,
      materias: { nome: 'Direito <b>' }
    }, {
      certasSemana: 8,
      erradasSemana: 2,
      certasHistorico: 16,
      erradasHistorico: 4,
      ultimaData: '2026-05-13'
    })

    const card = criarCardPlano(item)

    expect(card.className).toContain(`plano-card--${item.status}`)
    expect(card.querySelector('.plano-card-titulo').textContent).toBe('Direito <b>')
    expect(card.innerHTML).not.toContain('<b>')
    expect(card.querySelector('.plano-meta-edicao').value).toBe('8')
  })

  it('calcula intervalo da semana e diferenca entre datas', () => {
    expect(intervaloSemanaPlano('2026-05-13')).toEqual({
      inicio: '2026-05-11',
      fim: '2026-05-17'
    })
    expect(diferencaDiasPlano('2026-05-10', '2026-05-13')).toBe(3)
    expect(diferencaDiasPlano('2026-05-13', '2026-05-10')).toBe(0)
    expect(dataISOPlano(new Date('2026-05-15T12:00:00'))).toBe('2026-05-15')
  })

  it('mostra mensagem do plano quando o elemento existe', () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="fixture-plano"><p id="msg-plano"></p></div>')

    mostrarMsgPlano('Atualizado', 'sucesso')

    const msg = document.getElementById('msg-plano')
    expect(msg.textContent).toBe('Atualizado')
    expect(msg.className).toBe('msg-materia sucesso')
  })
})
