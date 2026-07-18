import { describe, expect, it } from 'vitest'

const {
  classificarEstadoFilaQuestaoSm2,
  converterDiaSemanaQuestaoSm2,
  criarEstadoInicialQuestaoSm2,
  mapearResultadoParaGradeQuestaoSm2,
  obterJanelaDiaFusoQuestaoSm2,
  ordenarFilaQuestaoSm2,
  scheduleQuestionReview
} = globalThis

const DATA_BASE = '2026-07-17T12:00:00.000Z'

describe('scheduleQuestionReview sm2_v1', () => {
  it('cria estado inicial seguro', () => {
    expect(criarEstadoInicialQuestaoSm2()).toMatchObject({
      algorithm_version: 'sm2_v1',
      easiness_factor: 2.5,
      repetition_count: 0,
      interval_days: 0,
      lapse_count: 0,
      correct_streak: 0,
      total_reviews: 0
    })
  })

  it('agenda primeira resposta correta para 1 dia', () => {
    const resultado = scheduleQuestionReview({}, { grade: 4 }, DATA_BASE)

    expect(resultado).toMatchObject({
      algorithm_version: 'sm2_v1',
      repetition_count: 1,
      interval_days: 1,
      correct_streak: 1,
      lapse_count: 0,
      total_reviews: 1,
      last_grade: 4,
      last_result: 'correct'
    })
    expect(resultado.next_review_at).toBe('2026-07-18T12:00:00.000Z')
  })

  it('agenda segunda resposta correta para 6 dias', () => {
    const estado = scheduleQuestionReview({}, { grade: 4 }, DATA_BASE)
    const resultado = scheduleQuestionReview(estado, { grade: 4 }, '2026-07-18T12:00:00.000Z')

    expect(resultado.repetition_count).toBe(2)
    expect(resultado.interval_days).toBe(6)
    expect(resultado.next_review_at).toBe('2026-07-24T12:00:00.000Z')
  })

  it('usa intervalo anterior multiplicado pelo fator de facilidade na terceira resposta correta', () => {
    const estado = criarEstadoInicialQuestaoSm2({
      easiness_factor: 2.5,
      repetition_count: 2,
      interval_days: 6,
      correct_streak: 2,
      total_reviews: 2
    })

    const resultado = scheduleQuestionReview(estado, { grade: 4 }, DATA_BASE)

    expect(resultado.repetition_count).toBe(3)
    expect(resultado.interval_days).toBe(15)
  })

  it('diferencia resposta dificil, boa e facil', () => {
    const dificil = scheduleQuestionReview({}, { grade: 3 }, DATA_BASE)
    const bom = scheduleQuestionReview({}, { grade: 4 }, DATA_BASE)
    const facil = scheduleQuestionReview({}, { grade: 5 }, DATA_BASE)

    expect(dificil.easiness_factor).toBeCloseTo(2.36, 5)
    expect(bom.easiness_factor).toBeCloseTo(2.5, 5)
    expect(facil.easiness_factor).toBeCloseTo(2.6, 5)
  })

  it('reseta repeticoes em resposta errada e incrementa lapso', () => {
    const estado = criarEstadoInicialQuestaoSm2({
      repetition_count: 4,
      interval_days: 30,
      correct_streak: 4,
      lapse_count: 2,
      total_reviews: 8
    })

    const resultado = scheduleQuestionReview(estado, { grade: 1 }, DATA_BASE)

    expect(resultado).toMatchObject({
      repetition_count: 0,
      interval_days: 1,
      correct_streak: 0,
      lapse_count: 3,
      total_reviews: 9,
      last_result: 'incorrect'
    })
  })

  it('permite acerto apos erro reiniciando a sequencia', () => {
    const erro = scheduleQuestionReview({ lapse_count: 1 }, { grade: 1 }, DATA_BASE)
    const acerto = scheduleQuestionReview(erro, { grade: 4 }, '2026-07-18T12:00:00.000Z')

    expect(acerto.repetition_count).toBe(1)
    expect(acerto.correct_streak).toBe(1)
    expect(acerto.lapse_count).toBe(2)
  })

  it('respeita fator minimo de 1.3', () => {
    const resultado = scheduleQuestionReview({ easiness_factor: 1.3 }, { grade: 0 }, DATA_BASE)

    expect(resultado.easiness_factor).toBe(1.3)
  })

  it('respeita limite maximo de intervalo', () => {
    const estado = criarEstadoInicialQuestaoSm2({
      easiness_factor: 2.5,
      repetition_count: 5,
      interval_days: 300
    })

    const resultado = scheduleQuestionReview(estado, { grade: 5 }, DATA_BASE, { maxIntervalDays: 365 })

    expect(resultado.interval_days).toBe(365)
  })

  it('rejeita nota invalida', () => {
    expect(() => scheduleQuestionReview({}, { grade: 6 }, DATA_BASE))
      .toThrow('grade deve ser um numero inteiro entre 0 e 5')
  })

  it('rejeita estado negativo', () => {
    expect(() => scheduleQuestionReview({ interval_days: -1 }, { grade: 4 }, DATA_BASE))
      .toThrow('interval_days deve ser um numero inteiro maior ou igual a 0')
  })

  it('rejeita data invalida', () => {
    expect(() => scheduleQuestionReview({}, { grade: 4 }, 'invalida'))
      .toThrow('reviewedAt deve ser uma data ISO valida')
  })

  it('nao modifica o objeto de entrada', () => {
    const estado = criarEstadoInicialQuestaoSm2({ total_reviews: 3 })
    const copia = JSON.parse(JSON.stringify(estado))

    scheduleQuestionReview(estado, { grade: 4 }, DATA_BASE)

    expect(estado).toEqual(copia)
  })

  it('e deterministico para as mesmas entradas', () => {
    const estado = criarEstadoInicialQuestaoSm2({ repetition_count: 2, interval_days: 6 })

    expect(scheduleQuestionReview(estado, { grade: 5 }, DATA_BASE))
      .toEqual(scheduleQuestionReview(estado, { grade: 5 }, DATA_BASE))
  })

  it('trata virada de mes, ano e ano bissexto', () => {
    expect(scheduleQuestionReview({}, { grade: 4 }, '2026-01-31T12:00:00.000Z').next_review_at)
      .toBe('2026-02-01T12:00:00.000Z')
    expect(scheduleQuestionReview({}, { grade: 4 }, '2026-12-31T12:00:00.000Z').next_review_at)
      .toBe('2027-01-01T12:00:00.000Z')
    expect(scheduleQuestionReview({}, { grade: 4 }, '2028-02-28T12:00:00.000Z').next_review_at)
      .toBe('2028-02-29T12:00:00.000Z')
  })
})

describe('datas e fila do scheduler de questoes', () => {
  it('usa America/Recife como fuso padrao do scheduler de questoes', () => {
    expect(globalThis.QUESTAO_SM2_TIMEZONE_PADRAO).toBe('America/Recife')
  })

  it('calcula janela de dia em diferentes fusos horarios', () => {
    const recife = obterJanelaDiaFusoQuestaoSm2(new Date('2026-07-17T15:00:00.000Z'), 'America/Recife')
    const utc = obterJanelaDiaFusoQuestaoSm2(new Date('2026-07-17T15:00:00.000Z'), 'UTC')

    expect(recife.dataISO).toBe('2026-07-17')
    expect(utc.dataISO).toBe('2026-07-17')
    expect(recife.inicio).toBe('2026-07-17T03:00:00.000Z')
    expect(recife.inicio).not.toBe(utc.inicio)
  })

  it('mantem consistencia em horario de verao de fuso que aplica DST', () => {
    const janela = obterJanelaDiaFusoQuestaoSm2(new Date('2026-03-08T12:00:00.000Z'), 'America/New_York')

    expect(janela.dataISO).toBe('2026-03-08')
    expect(new Date(janela.fimExclusivo).getTime()).toBeGreaterThan(new Date(janela.inicio).getTime())
  })

  it('converte dia da semana no fuso informado', () => {
    expect(converterDiaSemanaQuestaoSm2('2026-07-17', 'UTC')).toBe(5)
  })

  it('ordena vencida ha mais tempo antes das demais', () => {
    const fila = ordenarFilaQuestaoSm2([
      { questao_id: 'b', next_review_at: '2026-07-16T12:00:00.000Z', lapse_count: 0 },
      { questao_id: 'a', next_review_at: '2026-06-17T12:00:00.000Z', lapse_count: 0 }
    ])

    expect(fila.map(item => item.questao_id)).toEqual(['a', 'b'])
  })

  it('prioriza mais lapsos quando o vencimento e equivalente', () => {
    const fila = ordenarFilaQuestaoSm2([
      { questao_id: 'a', next_review_at: DATA_BASE, lapse_count: 1 },
      { questao_id: 'b', next_review_at: DATA_BASE, lapse_count: 3 }
    ])

    expect(fila.map(item => item.questao_id)).toEqual(['b', 'a'])
  })

  it('usa desempate deterministico por id', () => {
    const fila = ordenarFilaQuestaoSm2([
      { questao_id: 'b', next_review_at: DATA_BASE },
      { questao_id: 'a', next_review_at: DATA_BASE }
    ])

    expect(fila.map(item => item.questao_id)).toEqual(['a', 'b'])
  })

  it('classifica atrasada, hoje, proxima e sem agendamento', () => {
    const janela = obterJanelaDiaFusoQuestaoSm2('2026-07-17', 'UTC')

    expect(classificarEstadoFilaQuestaoSm2({ next_review_at: '2026-07-16T23:00:00.000Z' }, janela)).toBe('atrasada')
    expect(classificarEstadoFilaQuestaoSm2({ next_review_at: '2026-07-17T12:00:00.000Z' }, janela)).toBe('hoje')
    expect(classificarEstadoFilaQuestaoSm2({ next_review_at: '2026-07-18T12:00:00.000Z' }, janela)).toBe('proxima')
    expect(classificarEstadoFilaQuestaoSm2({}, janela)).toBe('sem_agendamento')
  })
})

describe('mapeamento de resultado para grade', () => {
  it('mapeia erro para 1 e acerto sem avaliacao para 4', () => {
    expect(mapearResultadoParaGradeQuestaoSm2({ wasCorrect: false, qualidade: 'facil' })).toBe(1)
    expect(mapearResultadoParaGradeQuestaoSm2({ wasCorrect: true })).toBe(4)
  })

  it('mapeia classificacao opcional de acerto', () => {
    expect(mapearResultadoParaGradeQuestaoSm2({ wasCorrect: true, qualidade: 'dificil' })).toBe(3)
    expect(mapearResultadoParaGradeQuestaoSm2({ wasCorrect: true, qualidade: 'bom' })).toBe(4)
    expect(mapearResultadoParaGradeQuestaoSm2({ wasCorrect: true, qualidade: 'facil' })).toBe(5)
  })
})
