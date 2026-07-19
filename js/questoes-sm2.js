// js/questoes-sm2.js

const QUESTAO_SM2_ALGORITHM_VERSION = 'sm2_v1'
const QUESTAO_SM2_EASE_FACTOR_PADRAO = 2.5
const QUESTAO_SM2_EASE_FACTOR_MINIMO = 1.3
const QUESTAO_SM2_INTERVALO_MAXIMO_PADRAO = 365
const QUESTAO_SM2_TIMEZONE_PADRAO = 'America/Recife'
const MS_DIA_QUESTAO_SM2 = 24 * 60 * 60 * 1000

function criarEstadoInicialQuestaoSm2(overrides = {}) {
  return {
    algorithm_version: QUESTAO_SM2_ALGORITHM_VERSION,
    easiness_factor: QUESTAO_SM2_EASE_FACTOR_PADRAO,
    repetition_count: 0,
    interval_days: 0,
    lapse_count: 0,
    correct_streak: 0,
    total_reviews: 0,
    last_grade: null,
    last_result: null,
    last_reviewed_at: null,
    next_review_at: null,
    created_at: null,
    updated_at: null,
    ...overrides
  }
}

function validarGradeQuestaoSm2(grade) {
  const valor = Number(grade)
  if (!Number.isInteger(valor) || valor < 0 || valor > 5) {
    throw new Error('grade deve ser um numero inteiro entre 0 e 5.')
  }
  return valor
}

function validarInteiroNaoNegativoQuestaoSm2(nome, valor, padrao = 0) {
  const numero = valor === null || valor === undefined || valor === '' ? padrao : Number(valor)
  if (!Number.isInteger(numero) || numero < 0) {
    throw new Error(`${nome} deve ser um numero inteiro maior ou igual a 0.`)
  }
  return numero
}

function validarNumeroNaoNegativoQuestaoSm2(nome, valor, padrao = 0) {
  const numero = valor === null || valor === undefined || valor === '' ? padrao : Number(valor)
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`${nome} deve ser um numero maior ou igual a 0.`)
  }
  return numero
}

function normalizarEaseFactorQuestaoSm2(valor) {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return QUESTAO_SM2_EASE_FACTOR_PADRAO
  return Math.max(numero, QUESTAO_SM2_EASE_FACTOR_MINIMO)
}

function normalizarIntervaloMaximoQuestaoSm2(valor) {
  const numero = Number(valor || QUESTAO_SM2_INTERVALO_MAXIMO_PADRAO)
  if (!Number.isInteger(numero) || numero < 1) return QUESTAO_SM2_INTERVALO_MAXIMO_PADRAO
  return numero
}

function atualizarEaseFactorQuestaoSm2(easeFactor, grade) {
  const diferenca = 5 - grade
  const proximo = easeFactor + (0.1 - diferenca * (0.08 + diferenca * 0.02))
  return Math.max(Number(proximo.toFixed(6)), QUESTAO_SM2_EASE_FACTOR_MINIMO)
}

function validarDataIsoQuestaoSm2(valor, nome = 'reviewedAt') {
  const data = new Date(valor)
  if (!valor || Number.isNaN(data.getTime())) {
    throw new Error(`${nome} deve ser uma data ISO valida.`)
  }
  return data
}

function adicionarDiasUtcQuestaoSm2(data, dias) {
  return new Date(data.getTime() + Number(dias) * MS_DIA_QUESTAO_SM2)
}

function scheduleQuestionReview(currentState = {}, reviewInput = {}, reviewedAt, options = {}) {
  const estadoAnterior = criarEstadoInicialQuestaoSm2(currentState || {})
  const grade = validarGradeQuestaoSm2(reviewInput.grade ?? reviewInput.quality)
  const dataRevisao = validarDataIsoQuestaoSm2(reviewedAt)
  const intervaloMaximo = normalizarIntervaloMaximoQuestaoSm2(options.maxIntervalDays)
  const easeFactorAnterior = normalizarEaseFactorQuestaoSm2(estadoAnterior.easiness_factor)
  const repetitionAnterior = validarInteiroNaoNegativoQuestaoSm2('repetition_count', estadoAnterior.repetition_count)
  const intervaloAnterior = validarInteiroNaoNegativoQuestaoSm2('interval_days', estadoAnterior.interval_days)
  const lapsesAnterior = validarInteiroNaoNegativoQuestaoSm2('lapse_count', estadoAnterior.lapse_count)
  const streakAnterior = validarInteiroNaoNegativoQuestaoSm2('correct_streak', estadoAnterior.correct_streak)
  const totalAnterior = validarInteiroNaoNegativoQuestaoSm2('total_reviews', estadoAnterior.total_reviews)
  const easeFactor = atualizarEaseFactorQuestaoSm2(easeFactorAnterior, grade)
  const acertou = grade >= 3

  let repetitionCount = 0
  let intervalDays = 1
  let lapseCount = lapsesAnterior
  let correctStreak = 0

  if (acertou) {
    repetitionCount = repetitionAnterior + 1
    correctStreak = streakAnterior + 1

    if (repetitionCount === 1) {
      intervalDays = 1
    } else if (repetitionCount === 2) {
      intervalDays = 6
    } else {
      intervalDays = Math.max(1, Math.round(intervaloAnterior * easeFactorAnterior))
    }
  } else {
    lapseCount += 1
    repetitionCount = 0
    correctStreak = 0
    intervalDays = 1
  }

  intervalDays = Math.max(1, Math.min(intervalDays, intervaloMaximo))
  const nextReviewAt = adicionarDiasUtcQuestaoSm2(dataRevisao, intervalDays).toISOString()

  return {
    ...estadoAnterior,
    algorithm_version: QUESTAO_SM2_ALGORITHM_VERSION,
    easiness_factor: easeFactor,
    repetition_count: repetitionCount,
    interval_days: intervalDays,
    lapse_count: lapseCount,
    correct_streak: correctStreak,
    total_reviews: totalAnterior + 1,
    last_grade: grade,
    last_result: acertou ? 'correct' : 'incorrect',
    last_reviewed_at: dataRevisao.toISOString(),
    next_review_at: nextReviewAt,
    updated_at: dataRevisao.toISOString()
  }
}

function mapearResultadoParaGradeQuestaoSm2({ wasCorrect, resultado, qualidade } = {}) {
  const acertou = typeof wasCorrect === 'boolean'
    ? wasCorrect
    : resultado === 'Acertou' || resultado === 'correct'

  if (!acertou) return 1

  if (qualidade === 'dificil' || qualidade === 'Difícil' || qualidade === 'Dificil') return 3
  if (qualidade === 'facil' || qualidade === 'Fácil' || qualidade === 'Facil') return 5
  if (Number.isInteger(Number(qualidade))) {
    const grade = validarGradeQuestaoSm2(Number(qualidade))
    return Math.max(3, grade)
  }

  return 4
}

function validarTimeZoneQuestaoSm2(timeZone) {
  const valor = String(timeZone || QUESTAO_SM2_TIMEZONE_PADRAO).trim()
  try {
    Intl.DateTimeFormat('en-US', { timeZone: valor }).format(new Date())
    return valor
  } catch {
    return QUESTAO_SM2_TIMEZONE_PADRAO
  }
}

function obterPartesDataFusoQuestaoSm2(data, timeZone) {
  const formatador = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: validarTimeZoneQuestaoSm2(timeZone),
    year: 'numeric'
  })
  const partes = Object.fromEntries(formatador.formatToParts(data).map(parte => [parte.type, parte.value]))
  const horaNormalizada = partes.hour === '24' ? '00' : partes.hour

  return {
    year: Number(partes.year),
    month: Number(partes.month),
    day: Number(partes.day),
    hour: Number(horaNormalizada),
    minute: Number(partes.minute),
    second: Number(partes.second)
  }
}

function compararPartesDataQuestaoSm2(a, b) {
  return Date.UTC(a.year, a.month - 1, a.day, a.hour || 0, a.minute || 0, a.second || 0) -
    Date.UTC(b.year, b.month - 1, b.day, b.hour || 0, b.minute || 0, b.second || 0)
}

function obterInicioDiaUtcPorFusoQuestaoSm2(dataISO, timeZone = QUESTAO_SM2_TIMEZONE_PADRAO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataISO))) {
    throw new Error('dataISO deve estar no formato YYYY-MM-DD.')
  }

  const [year, month, day] = dataISO.split('-').map(Number)
  const alvo = { year, month, day, hour: 0, minute: 0, second: 0 }
  let estimativa = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))

  for (let i = 0; i < 6; i += 1) {
    const partes = obterPartesDataFusoQuestaoSm2(estimativa, timeZone)
    const diferenca = compararPartesDataQuestaoSm2(alvo, partes)
    if (diferenca === 0) break
    estimativa = new Date(estimativa.getTime() + diferenca)
  }

  return estimativa
}

function dataLocalISOQuestaoSm2(data = new Date(), timeZone = QUESTAO_SM2_TIMEZONE_PADRAO) {
  const partes = obterPartesDataFusoQuestaoSm2(data, timeZone)
  return `${String(partes.year).padStart(4, '0')}-${String(partes.month).padStart(2, '0')}-${String(partes.day).padStart(2, '0')}`
}

function adicionarDiasDataISOQuestaoSm2(dataISO, dias) {
  const inicio = obterInicioDiaUtcPorFusoQuestaoSm2(dataISO, 'UTC')
  return adicionarDiasUtcQuestaoSm2(inicio, dias).toISOString().slice(0, 10)
}

function obterJanelaDiaFusoQuestaoSm2(data = new Date(), timeZone = QUESTAO_SM2_TIMEZONE_PADRAO) {
  const dataISO = typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)
    ? data
    : dataLocalISOQuestaoSm2(data instanceof Date ? data : new Date(data), timeZone)
  const inicio = obterInicioDiaUtcPorFusoQuestaoSm2(dataISO, timeZone)
  const proximoDiaISO = adicionarDiasDataISOQuestaoSm2(dataISO, 1)
  const fimExclusivo = obterInicioDiaUtcPorFusoQuestaoSm2(proximoDiaISO, timeZone)

  return {
    dataISO,
    inicio: inicio.toISOString(),
    fimExclusivo: fimExclusivo.toISOString(),
    fimInclusivo: new Date(fimExclusivo.getTime() - 1).toISOString()
  }
}

function converterDiaSemanaQuestaoSm2(dataISO, timeZone = QUESTAO_SM2_TIMEZONE_PADRAO) {
  const inicio = obterInicioDiaUtcPorFusoQuestaoSm2(dataISO, timeZone)
  const formatador = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: validarTimeZoneQuestaoSm2(timeZone) })
  const dia = formatador.format(inicio)
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[dia] || 1
}

function calcularDiasAtrasoQuestaoSm2(nextReviewAt, referencia = new Date()) {
  const vencimento = validarDataIsoQuestaoSm2(nextReviewAt, 'next_review_at')
  const dataReferencia = referencia instanceof Date ? referencia : validarDataIsoQuestaoSm2(referencia, 'referencia')
  return Math.max(0, Math.floor((dataReferencia.getTime() - vencimento.getTime()) / MS_DIA_QUESTAO_SM2))
}

function compararItensFilaQuestaoSm2(a, b) {
  const dataA = new Date(a.next_review_at || a.review_state?.next_review_at || 0).getTime()
  const dataB = new Date(b.next_review_at || b.review_state?.next_review_at || 0).getTime()
  if (dataA !== dataB) return dataA - dataB

  const lapsesA = Number(a.lapse_count ?? a.review_state?.lapse_count ?? 0)
  const lapsesB = Number(b.lapse_count ?? b.review_state?.lapse_count ?? 0)
  if (lapsesA !== lapsesB) return lapsesB - lapsesA

  const easeA = Number(a.easiness_factor ?? a.review_state?.easiness_factor ?? QUESTAO_SM2_EASE_FACTOR_PADRAO)
  const easeB = Number(b.easiness_factor ?? b.review_state?.easiness_factor ?? QUESTAO_SM2_EASE_FACTOR_PADRAO)
  if (easeA !== easeB) return easeA - easeB

  const streakA = Number(a.correct_streak ?? a.review_state?.correct_streak ?? 0)
  const streakB = Number(b.correct_streak ?? b.review_state?.correct_streak ?? 0)
  if (streakA !== streakB) return streakA - streakB

  const lastA = new Date(a.last_reviewed_at || a.review_state?.last_reviewed_at || 0).getTime()
  const lastB = new Date(b.last_reviewed_at || b.review_state?.last_reviewed_at || 0).getTime()
  if (lastA !== lastB) return lastA - lastB

  return String(a.questao_id || a.id || '').localeCompare(String(b.questao_id || b.id || ''))
}

function ordenarFilaQuestaoSm2(itens = []) {
  return [...itens].sort(compararItensFilaQuestaoSm2)
}

function classificarEstadoFilaQuestaoSm2(item, janela) {
  const nextReviewAt = item.next_review_at || item.review_state?.next_review_at
  if (!nextReviewAt) return 'sem_agendamento'
  const vencimento = new Date(nextReviewAt).getTime()
  const inicio = new Date(janela.inicio).getTime()
  const fim = new Date(janela.fimExclusivo).getTime()

  if (vencimento < inicio) return 'atrasada'
  if (vencimento < fim) return 'hoje'
  return 'proxima'
}

if (typeof globalThis !== 'undefined') {
  globalThis.QUESTAO_SM2_ALGORITHM_VERSION = QUESTAO_SM2_ALGORITHM_VERSION
  globalThis.QUESTAO_SM2_TIMEZONE_PADRAO = QUESTAO_SM2_TIMEZONE_PADRAO
  globalThis.criarEstadoInicialQuestaoSm2 = criarEstadoInicialQuestaoSm2
  globalThis.scheduleQuestionReview = scheduleQuestionReview
  globalThis.mapearResultadoParaGradeQuestaoSm2 = mapearResultadoParaGradeQuestaoSm2
  globalThis.validarTimeZoneQuestaoSm2 = validarTimeZoneQuestaoSm2
  globalThis.obterJanelaDiaFusoQuestaoSm2 = obterJanelaDiaFusoQuestaoSm2
  globalThis.converterDiaSemanaQuestaoSm2 = converterDiaSemanaQuestaoSm2
  globalThis.calcularDiasAtrasoQuestaoSm2 = calcularDiasAtrasoQuestaoSm2
  globalThis.ordenarFilaQuestaoSm2 = ordenarFilaQuestaoSm2
  globalThis.classificarEstadoFilaQuestaoSm2 = classificarEstadoFilaQuestaoSm2
}
