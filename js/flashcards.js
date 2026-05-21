// js/flashcards.js

// ============================================
// CAMADA DE DADOS DOS FLASHCARDS
// ============================================

const CAMPOS_FLASHCARD =
  'id, user_id, materia_id, frente, verso, tags, ativo, estado, ease_factor, repetitions, interval_days, due_date, last_reviewed_at, total_reviews, correct_reviews, lapses, created_at, updated_at'

const MENSAGEM_LOGIN_FLASHCARDS = 'E necessario estar logado para usar flashcards.'
const MENSAGEM_SUPABASE_FLASHCARDS = 'Configuracao do Supabase nao encontrada. Verifique o arquivo js/config.js.'
const ABA_FLASHCARDS_PADRAO = 'revisar-hoje'
let flashcardsInicializado = false

function obterClienteSupabaseFlashcards() {
  if (typeof globalThis !== 'undefined' && globalThis.db) return globalThis.db
  if (typeof window !== 'undefined' && window.db) return window.db
  if (typeof db !== 'undefined') return db
  return null
}

function criarErroFlashcards(mensagem, detalhes = null) {
  const erro = new Error(mensagem)
  if (detalhes) erro.detalhes = detalhes
  return erro
}

function respostaErroFlashcards(mensagem, detalhes = null) {
  if (detalhes) console.error(detalhes)
  return { data: null, error: criarErroFlashcards(mensagem, detalhes) }
}

async function obterUsuarioAutenticadoFlashcards() {
  const cliente = obterClienteSupabaseFlashcards()
  if (!cliente) {
    throw criarErroFlashcards(MENSAGEM_SUPABASE_FLASHCARDS)
  }

  if (cliente.auth && typeof cliente.auth.getUser === 'function') {
    const { data, error } = await cliente.auth.getUser()
    if (error) {
      throw criarErroFlashcards(MENSAGEM_LOGIN_FLASHCARDS, error)
    }
    if (data?.user?.id) return data.user
  }

  const usuarioAtual = globalThis.window?.usuarioAtual || globalThis.usuarioAtual
  if (usuarioAtual?.id) return usuarioAtual

  throw criarErroFlashcards(MENSAGEM_LOGIN_FLASHCARDS)
}

function dataISOFlashcards(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function dataHojeFlashcards() {
  return dataISOFlashcards(new Date())
}

function adicionarDiasFlashcards(dataISO, dias) {
  const data = new Date(`${dataISO}T12:00:00`)
  data.setDate(data.getDate() + Number(dias || 0))
  return dataISOFlashcards(data)
}

function normalizarTextoObrigatorioFlashcards(valor) {
  return String(valor || '').trim()
}

function normalizarTagsFlashcards(tags) {
  if (!Array.isArray(tags)) return []
  return tags
    .map(tag => String(tag || '').trim())
    .filter(Boolean)
}

function normalizarMateriaIdFlashcards(materiaId) {
  if (materiaId === undefined) return undefined
  if (materiaId === null) return null
  const normalizado = String(materiaId).trim()
  return normalizado || null
}

function obterEstadoFlashcardPorResultado(resultado) {
  if (['novo', 'aprendendo', 'revisando'].includes(resultado?.estado)) {
    return resultado.estado
  }
  if (resultado?.dueAgainToday || !resultado?.wasCorrect) return 'aprendendo'
  return Number(resultado?.repetitions || 0) >= 2 ? 'revisando' : 'aprendendo'
}

function normalizarResultadoRevisaoFlashcards(resultado = {}) {
  const quality = Number(resultado.quality)
  const repetitions = Number(resultado.repetitions)
  const intervalDays = Number(resultado.intervalDays ?? resultado.interval_days)
  const easeFactor = Number(resultado.easeFactor ?? resultado.ease_factor)
  const wasCorrect = Boolean(resultado.wasCorrect ?? resultado.was_correct ?? quality >= 3)
  const dueAgainToday = Boolean(resultado.dueAgainToday ?? resultado.due_again_today)

  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw criarErroFlashcards('A qualidade da revisao deve ser um numero inteiro entre 0 e 5.')
  }
  if (!Number.isInteger(repetitions) || repetitions < 0) {
    throw criarErroFlashcards('As repeticoes da revisao devem ser um numero inteiro maior ou igual a 0.')
  }
  if (!Number.isInteger(intervalDays) || intervalDays < 1) {
    throw criarErroFlashcards('O intervalo da revisao deve ser um numero inteiro maior ou igual a 1.')
  }
  if (!Number.isFinite(easeFactor) || easeFactor < 1.3) {
    throw criarErroFlashcards('O fator de facilidade da revisao deve ser maior ou igual a 1.3.')
  }

  return {
    quality,
    repetitions,
    intervalDays,
    easeFactor,
    wasCorrect,
    dueAgainToday,
    estado: obterEstadoFlashcardPorResultado({
      ...resultado,
      repetitions,
      wasCorrect,
      dueAgainToday
    })
  }
}

function tratarRespostaSupabaseFlashcards(resposta, mensagemErro) {
  if (resposta.error) {
    return respostaErroFlashcards(mensagemErro, resposta.error)
  }
  return resposta
}

function selecionarAbaFlashcards(aba, raiz = document) {
  const abaSelecionada = aba || ABA_FLASHCARDS_PADRAO

  raiz.querySelectorAll('[data-flashcards-aba]').forEach(botao => {
    const ativa = botao.dataset.flashcardsAba === abaSelecionada
    botao.classList.toggle('ativa', ativa)
    botao.setAttribute('aria-selected', ativa ? 'true' : 'false')
  })

  raiz.querySelectorAll('.flashcards-painel').forEach(painel => {
    const ativo = painel.id === `flashcards-painel-${abaSelecionada}`
    painel.hidden = !ativo
  })
}

function atualizarIndicadoresFlashcardsVazios(raiz = document) {
  const pendentesHoje = raiz.getElementById?.('flashcards-pendentes-hoje')
  const totalCards = raiz.getElementById?.('flashcards-total-cards')
  const cardsHoje = raiz.getElementById?.('flashcards-cards-hoje')
  const taxaAcerto = raiz.getElementById?.('flashcards-taxa-acerto')
  const sequencia = raiz.getElementById?.('flashcards-sequencia-estudos')

  if (pendentesHoje) pendentesHoje.textContent = 'Cards pendentes hoje: 0'
  if (totalCards) totalCards.textContent = '0'
  if (cardsHoje) cardsHoje.textContent = '0'
  if (taxaAcerto) taxaAcerto.textContent = '0%'
  if (sequencia) sequencia.textContent = '0'
}

function inicializarFlashcards() {
  const secao = document.getElementById('secao-flashcards')
  if (!secao) return

  if (!flashcardsInicializado) {
    secao.querySelectorAll('[data-flashcards-aba]').forEach(botao => {
      botao.addEventListener('click', () => selecionarAbaFlashcards(botao.dataset.flashcardsAba, secao))
    })
    flashcardsInicializado = true
  }

  atualizarIndicadoresFlashcardsVazios(document)
  selecionarAbaFlashcards(ABA_FLASHCARDS_PADRAO, secao)
}

async function criarFlashcard(dados = {}) {
  let usuario
  try {
    usuario = await obterUsuarioAutenticadoFlashcards()
  } catch (erro) {
    return respostaErroFlashcards(erro.message, erro.detalhes)
  }

  const frente = normalizarTextoObrigatorioFlashcards(dados.frente)
  if (!frente) {
    return respostaErroFlashcards('Informe a frente do flashcard.')
  }

  const verso = normalizarTextoObrigatorioFlashcards(dados.verso)
  if (!verso) {
    return respostaErroFlashcards('Informe o verso do flashcard.')
  }

  const payload = {
    user_id: usuario.id,
    frente,
    verso,
    ativo: true,
    estado: 'novo',
    ease_factor: 2.5,
    repetitions: 0,
    interval_days: 1,
    due_date: dataHojeFlashcards()
  }

  const materiaId = normalizarMateriaIdFlashcards(dados.materia_id)
  if (materiaId !== undefined) payload.materia_id = materiaId
  if (Array.isArray(dados.tags)) payload.tags = normalizarTagsFlashcards(dados.tags)

  const resposta = await obterClienteSupabaseFlashcards()
    .from('flashcards')
    .insert(payload)
    .select(CAMPOS_FLASHCARD)
    .single()

  return tratarRespostaSupabaseFlashcards(
    resposta,
    'Nao foi possivel criar o flashcard. Verifique sua conexao e tente novamente.'
  )
}

async function listarFlashcards() {
  let usuario
  try {
    usuario = await obterUsuarioAutenticadoFlashcards()
  } catch (erro) {
    return respostaErroFlashcards(erro.message, erro.detalhes)
  }

  const resposta = await obterClienteSupabaseFlashcards()
    .from('flashcards')
    .select(CAMPOS_FLASHCARD)
    .eq('user_id', usuario.id)
    .order('created_at', { ascending: false })

  return tratarRespostaSupabaseFlashcards(
    resposta,
    'Nao foi possivel listar os flashcards. Verifique sua conexao e tente novamente.'
  )
}

async function listarFlashcardsDevidosHoje() {
  let usuario
  try {
    usuario = await obterUsuarioAutenticadoFlashcards()
  } catch (erro) {
    return respostaErroFlashcards(erro.message, erro.detalhes)
  }

  const resposta = await obterClienteSupabaseFlashcards()
    .from('flashcards')
    .select(CAMPOS_FLASHCARD)
    .eq('user_id', usuario.id)
    .eq('ativo', true)
    .lte('due_date', dataHojeFlashcards())
    .order('due_date', { ascending: true })

  return tratarRespostaSupabaseFlashcards(
    resposta,
    'Nao foi possivel listar os flashcards de hoje. Verifique sua conexao e tente novamente.'
  )
}

async function atualizarFlashcard(id, dados = {}) {
  let usuario
  try {
    usuario = await obterUsuarioAutenticadoFlashcards()
  } catch (erro) {
    return respostaErroFlashcards(erro.message, erro.detalhes)
  }

  if (!id) {
    return respostaErroFlashcards('Informe o flashcard que deve ser atualizado.')
  }

  const payload = {}

  if (Object.prototype.hasOwnProperty.call(dados, 'frente')) {
    const frente = normalizarTextoObrigatorioFlashcards(dados.frente)
    if (!frente) return respostaErroFlashcards('Informe a frente do flashcard.')
    payload.frente = frente
  }

  if (Object.prototype.hasOwnProperty.call(dados, 'verso')) {
    const verso = normalizarTextoObrigatorioFlashcards(dados.verso)
    if (!verso) return respostaErroFlashcards('Informe o verso do flashcard.')
    payload.verso = verso
  }

  if (Object.prototype.hasOwnProperty.call(dados, 'tags')) {
    payload.tags = normalizarTagsFlashcards(dados.tags)
  }

  if (Object.prototype.hasOwnProperty.call(dados, 'materia_id')) {
    payload.materia_id = normalizarMateriaIdFlashcards(dados.materia_id)
  }

  if (Object.prototype.hasOwnProperty.call(dados, 'ativo')) {
    payload.ativo = Boolean(dados.ativo)
  }

  payload.updated_at = new Date().toISOString()

  const resposta = await obterClienteSupabaseFlashcards()
    .from('flashcards')
    .update(payload)
    .eq('id', id)
    .eq('user_id', usuario.id)
    .select(CAMPOS_FLASHCARD)
    .single()

  return tratarRespostaSupabaseFlashcards(
    resposta,
    'Nao foi possivel atualizar o flashcard. Verifique sua conexao e tente novamente.'
  )
}

async function desativarFlashcard(id) {
  return atualizarFlashcard(id, { ativo: false })
}

async function buscarFlashcardParaRevisao(id, userId) {
  return obterClienteSupabaseFlashcards()
    .from('flashcards')
    .select('id, user_id, interval_days, ease_factor, repetitions, total_reviews, correct_reviews, lapses')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
}

async function registrarRevisaoFlashcard(id, resultado = {}) {
  let usuario
  let resultadoNormalizado
  try {
    usuario = await obterUsuarioAutenticadoFlashcards()
    resultadoNormalizado = normalizarResultadoRevisaoFlashcards(resultado)
  } catch (erro) {
    return respostaErroFlashcards(erro.message, erro.detalhes)
  }

  if (!id) {
    return respostaErroFlashcards('Informe o flashcard revisado.')
  }

  const respostaCard = await buscarFlashcardParaRevisao(id, usuario.id)
  if (respostaCard.error) {
    return respostaErroFlashcards(
      'Nao foi possivel carregar o flashcard revisado. Verifique sua conexao e tente novamente.',
      respostaCard.error
    )
  }

  const flashcard = respostaCard.data
  const hoje = dataHojeFlashcards()
  const agora = new Date().toISOString()
  const dueDate = resultadoNormalizado.dueAgainToday
    ? hoje
    : adicionarDiasFlashcards(hoje, resultadoNormalizado.intervalDays)

  const payloadAtualizacao = {
    ease_factor: resultadoNormalizado.easeFactor,
    repetitions: resultadoNormalizado.repetitions,
    interval_days: resultadoNormalizado.intervalDays,
    due_date: dueDate,
    last_reviewed_at: agora,
    total_reviews: Number(flashcard.total_reviews || 0) + 1,
    correct_reviews: Number(flashcard.correct_reviews || 0) + (resultadoNormalizado.wasCorrect ? 1 : 0),
    lapses: Number(flashcard.lapses || 0) + (resultadoNormalizado.wasCorrect ? 0 : 1),
    estado: resultadoNormalizado.estado,
    updated_at: agora
  }

  const respostaAtualizacao = await obterClienteSupabaseFlashcards()
    .from('flashcards')
    .update(payloadAtualizacao)
    .eq('id', id)
    .eq('user_id', usuario.id)
    .select(CAMPOS_FLASHCARD)
    .single()

  if (respostaAtualizacao.error) {
    return respostaErroFlashcards(
      'Nao foi possivel atualizar a revisao do flashcard. Verifique sua conexao e tente novamente.',
      respostaAtualizacao.error
    )
  }

  const payloadHistorico = {
    user_id: usuario.id,
    flashcard_id: id,
    quality: resultadoNormalizado.quality,
    old_interval_days: flashcard.interval_days,
    new_interval_days: resultadoNormalizado.intervalDays,
    old_ease_factor: flashcard.ease_factor,
    new_ease_factor: resultadoNormalizado.easeFactor,
    old_repetitions: flashcard.repetitions,
    new_repetitions: resultadoNormalizado.repetitions,
    was_correct: resultadoNormalizado.wasCorrect
  }

  const respostaHistorico = await obterClienteSupabaseFlashcards()
    .from('flashcard_reviews')
    .insert(payloadHistorico)

  if (respostaHistorico.error) {
    return respostaErroFlashcards(
      'A revisao foi atualizada, mas nao foi possivel registrar o historico. Verifique sua conexao e tente novamente.',
      respostaHistorico.error
    )
  }

  return {
    data: {
      flashcard: respostaAtualizacao.data,
      review: respostaHistorico.data || null
    },
    error: null
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.inicializarFlashcards = inicializarFlashcards
  globalThis.selecionarAbaFlashcards = selecionarAbaFlashcards
  globalThis.criarFlashcard = criarFlashcard
  globalThis.listarFlashcards = listarFlashcards
  globalThis.listarFlashcardsDevidosHoje = listarFlashcardsDevidosHoje
  globalThis.atualizarFlashcard = atualizarFlashcard
  globalThis.desativarFlashcard = desativarFlashcard
  globalThis.registrarRevisaoFlashcard = registrarRevisaoFlashcard
}
