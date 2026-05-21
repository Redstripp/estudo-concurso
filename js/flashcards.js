// js/flashcards.js

// ============================================
// CAMADA DE DADOS DOS FLASHCARDS
// ============================================

const CAMPOS_FLASHCARD =
  'id, user_id, materia_id, frente, verso, tags, ativo, estado, ease_factor, repetitions, interval_days, due_date, last_reviewed_at, total_reviews, correct_reviews, lapses, created_at, updated_at'

const MENSAGEM_LOGIN_FLASHCARDS = 'E necessario estar logado para usar flashcards.'
const MENSAGEM_SUPABASE_FLASHCARDS = 'Configuracao do Supabase nao encontrada. Verifique o arquivo js/config.js.'
const ABA_FLASHCARDS_PADRAO = 'revisar-hoje'
const QUALIDADES_FLASHCARD = [0, 1, 2, 3, 4, 5]
const EASE_FACTOR_PADRAO_FLASHCARD = 2.5
const EASE_FACTOR_MINIMO_FLASHCARD = 1.3
let flashcardsInicializado = false
let flashcardsSessaoHoje = []
let flashcardAtualSessao = null
let flashcardsTotalSessaoHoje = 0

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

function normalizarInteiroNaoNegativoFlashcards(valor, fallback = 0) {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 0 ? numero : fallback
}

function normalizarEaseFactorSM2Flashcards(easeFactor) {
  const numero = Number(easeFactor)
  if (!Number.isFinite(numero)) return EASE_FACTOR_PADRAO_FLASHCARD
  return Math.max(numero, EASE_FACTOR_MINIMO_FLASHCARD)
}

function atualizarEaseFactorSM2Flashcards(easeFactor, quality) {
  const diferencaQualidade = 5 - quality
  const novoEaseFactor =
    easeFactor + (0.1 - diferencaQualidade * (0.08 + diferencaQualidade * 0.02))

  return Math.max(novoEaseFactor, EASE_FACTOR_MINIMO_FLASHCARD)
}

function calcularProximaRevisaoSM2Flashcards(card = {}, qualityInformada) {
  const quality = Number(qualityInformada)
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw criarErroFlashcards('A qualidade da revisao deve ser um numero inteiro entre 0 e 5.')
  }

  const repetitions = normalizarInteiroNaoNegativoFlashcards(card.repetitions, 0)
  const intervalDays = normalizarInteiroNaoNegativoFlashcards(card.interval_days ?? card.intervalDays, 0)
  const easeFactorAtual = normalizarEaseFactorSM2Flashcards(card.ease_factor ?? card.easeFactor)
  const easeFactor = atualizarEaseFactorSM2Flashcards(easeFactorAtual, quality)
  const wasCorrect = quality >= 3

  if (!wasCorrect) {
    return {
      quality,
      repetitions: 0,
      intervalDays: 1,
      easeFactor,
      dueAgainToday: true,
      wasCorrect: false
    }
  }

  const proximasRepeticoes = repetitions + 1
  let proximoIntervalo = 1

  if (proximasRepeticoes === 2) {
    proximoIntervalo = 6
  } else if (proximasRepeticoes > 2) {
    proximoIntervalo = Math.ceil(intervalDays * easeFactorAtual)
  }

  return {
    quality,
    repetitions: proximasRepeticoes,
    intervalDays: proximoIntervalo,
    easeFactor,
    dueAgainToday: false,
    wasCorrect: true
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

function mostrarMensagemFlashcards(texto, tipo = '') {
  const msg = document.getElementById('msg-flashcards')
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo}`.trim()
}

function obterDadosFormularioFlashcards() {
  const frente = normalizarTextoObrigatorioFlashcards(document.getElementById('flashcard-frente')?.value)
  const verso = normalizarTextoObrigatorioFlashcards(document.getElementById('flashcard-verso')?.value)
  const tagsTexto = document.getElementById('flashcard-tags')?.value || ''
  const tags = tagsTexto
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)

  return { frente, verso, tags }
}

function limparFormularioFlashcards() {
  const frente = document.getElementById('flashcard-frente')
  const verso = document.getElementById('flashcard-verso')
  const tags = document.getElementById('flashcard-tags')

  if (frente) frente.value = ''
  if (verso) verso.value = ''
  if (tags) tags.value = ''
}

function criarElementoFlashcardLista(card) {
  const item = document.createElement('article')
  item.className = 'card-questao flashcard-lista-item'

  const frente = document.createElement('h4')
  frente.className = 'card-form-titulo'
  frente.textContent = card.frente || 'Sem frente'

  const verso = document.createElement('p')
  verso.className = 'card-questao-comentario'
  verso.textContent = card.verso || 'Sem verso'

  const meta = document.createElement('div')
  meta.className = 'revisao-tags'

  const estado = document.createElement('span')
  estado.className = 'tag-estudo'
  estado.textContent = `Estado: ${card.estado || 'novo'}`
  meta.appendChild(estado)

  const proximaRevisao = document.createElement('span')
  proximaRevisao.className = 'tag-estudo'
  proximaRevisao.textContent = `Proxima revisao: ${card.due_date || '-'}`
  meta.appendChild(proximaRevisao)

  if (Array.isArray(card.tags) && card.tags.length > 0) {
    const tags = document.createElement('span')
    tags.className = 'tag-estudo'
    tags.textContent = `Tags: ${card.tags.join(', ')}`
    meta.appendChild(tags)
  }

  item.append(frente, verso, meta)
  return item
}

function renderizarListaFlashcards(cards = []) {
  const lista = document.getElementById('flashcards-lista')
  if (!lista) return

  lista.replaceChildren()

  if (!Array.isArray(cards) || cards.length === 0) {
    const vazio = document.createElement('p')
    vazio.className = 'texto-placeholder'
    vazio.textContent = 'Nenhum flashcard cadastrado ainda.'
    lista.appendChild(vazio)
    return
  }

  cards.forEach(card => lista.appendChild(criarElementoFlashcardLista(card)))
}

function obterDataComparacaoFlashcard(data) {
  return String(data || '').slice(0, 10)
}

function flashcardDevidoHoje(card) {
  if (!card || card.ativo === false) return false
  const dueDate = obterDataComparacaoFlashcard(card.due_date)
  return Boolean(dueDate) && dueDate <= dataHojeFlashcards()
}

function embaralharFlashcardsSessao(cards = []) {
  const copia = [...cards]
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

function atualizarIndicadoresRevisaoFlashcards() {
  const pendentesHoje = document.getElementById('flashcards-pendentes-hoje')
  const progresso = document.getElementById('flashcards-progresso-sessao')
  const restantes = flashcardsSessaoHoje.length
  const concluidos = Math.max(0, flashcardsTotalSessaoHoje - restantes)

  if (pendentesHoje) pendentesHoje.textContent = `Cards pendentes hoje: ${restantes}`
  if (progresso) progresso.textContent = `Progresso: ${concluidos}/${flashcardsTotalSessaoHoje}`
}

function criarElementoRevisaoFlashcard(card) {
  const item = document.createElement('article')
  item.className = 'card-questao flashcard-revisao-item'

  const tituloFrente = document.createElement('span')
  tituloFrente.className = 'tag-estudo'
  tituloFrente.textContent = 'Frente'

  const frente = document.createElement('h4')
  frente.className = 'card-form-titulo'
  frente.textContent = card.frente || 'Sem frente'

  const botaoMostrar = document.createElement('button')
  botaoMostrar.className = 'btn-secundario'
  botaoMostrar.id = 'btn-mostrar-resposta-flashcard'
  botaoMostrar.type = 'button'
  botaoMostrar.textContent = 'Mostrar resposta'

  const versoArea = document.createElement('div')
  versoArea.id = 'flashcards-verso-atual'
  versoArea.hidden = true

  const tituloVerso = document.createElement('span')
  tituloVerso.className = 'tag-estudo'
  tituloVerso.textContent = 'Verso'

  const verso = document.createElement('p')
  verso.className = 'card-questao-comentario'
  verso.textContent = card.verso || 'Sem verso'
  versoArea.append(tituloVerso, verso)

  const avaliacao = document.createElement('div')
  avaliacao.id = 'flashcards-avaliacao-atual'
  avaliacao.className = 'revisao-tags'
  avaliacao.hidden = true

  const instrucao = document.createElement('p')
  instrucao.className = 'texto-apoio'
  instrucao.textContent = 'Avalie sua resposta de 0 a 5.'
  avaliacao.appendChild(instrucao)

  QUALIDADES_FLASHCARD.forEach(quality => {
    const botao = document.createElement('button')
    botao.className = quality >= 3 ? 'btn-primario' : 'btn-secundario'
    botao.type = 'button'
    botao.dataset.flashcardQuality = String(quality)
    botao.textContent = String(quality)
    avaliacao.appendChild(botao)
  })

  item.append(tituloFrente, frente, botaoMostrar, versoArea, avaliacao)
  return item
}

function renderizarRevisaoFlashcardsHoje() {
  const vazio = document.getElementById('flashcards-revisar-vazio')
  const areaCard = document.getElementById('flashcards-revisao-card')
  const botaoIniciar = document.getElementById('btn-iniciar-revisao-flashcards')

  atualizarIndicadoresRevisaoFlashcards()
  if (areaCard) areaCard.replaceChildren()

  if (flashcardAtualSessao) {
    if (vazio) {
      vazio.hidden = true
      vazio.textContent = ''
    }
    if (botaoIniciar) {
      botaoIniciar.disabled = true
      botaoIniciar.textContent = 'Sessão em andamento'
    }
    if (areaCard) areaCard.appendChild(criarElementoRevisaoFlashcard(flashcardAtualSessao))
    return
  }

  if (botaoIniciar) {
    botaoIniciar.disabled = flashcardsSessaoHoje.length === 0
    botaoIniciar.textContent = 'Iniciar revisão'
  }

  if (!vazio) return
  vazio.hidden = false
  vazio.textContent = flashcardsSessaoHoje.length > 0
    ? `${flashcardsSessaoHoje.length} card(s) pendente(s) para hoje.`
    : 'Nenhum card pendente para hoje.'
}

function mostrarMensagemRevisaoFlashcards(texto) {
  const vazio = document.getElementById('flashcards-revisar-vazio')
  if (!vazio) return
  vazio.hidden = false
  vazio.textContent = texto
}

async function carregarFlashcardsRevisarHoje() {
  const vazio = document.getElementById('flashcards-revisar-vazio')
  const areaCard = document.getElementById('flashcards-revisao-card')
  const botaoIniciar = document.getElementById('btn-iniciar-revisao-flashcards')

  if (vazio) {
    vazio.hidden = false
    vazio.textContent = 'Carregando flashcards de hoje...'
  }
  if (areaCard) areaCard.replaceChildren()
  if (botaoIniciar) botaoIniciar.disabled = true

  const listar = globalThis.listarFlashcardsDevidosHoje || listarFlashcardsDevidosHoje
  const resultado = await listar()

  if (resultado.error) {
    flashcardsSessaoHoje = []
    flashcardAtualSessao = null
    flashcardsTotalSessaoHoje = 0
    atualizarIndicadoresRevisaoFlashcards()
    mostrarMensagemRevisaoFlashcards(
      resultado.error.message || 'Nao foi possivel carregar seus flashcards de hoje. Verifique sua conexao e tente novamente.'
    )
    return resultado
  }

  const cardsDevidos = Array.isArray(resultado.data)
    ? resultado.data.filter(flashcardDevidoHoje)
    : []
  flashcardsSessaoHoje = embaralharFlashcardsSessao(cardsDevidos)
  flashcardAtualSessao = null
  flashcardsTotalSessaoHoje = flashcardsSessaoHoje.length
  renderizarRevisaoFlashcardsHoje()

  return { ...resultado, data: cardsDevidos }
}

function iniciarSessaoRevisaoFlashcards() {
  if (flashcardsSessaoHoje.length === 0) {
    renderizarRevisaoFlashcardsHoje()
    return { data: null, error: null }
  }

  flashcardAtualSessao = flashcardsSessaoHoje[0]
  renderizarRevisaoFlashcardsHoje()
  return { data: flashcardAtualSessao, error: null }
}

function mostrarRespostaFlashcardAtual() {
  const verso = document.getElementById('flashcards-verso-atual')
  const avaliacao = document.getElementById('flashcards-avaliacao-atual')
  const botaoMostrar = document.getElementById('btn-mostrar-resposta-flashcard')

  if (verso) verso.hidden = false
  if (avaliacao) avaliacao.hidden = false
  if (botaoMostrar) botaoMostrar.hidden = true

  return { data: flashcardAtualSessao, error: null }
}

function obterFlashcardAtualizadoAposRevisao(card, resultadoSM2, resposta) {
  const cardAtualizado = resposta?.data?.flashcard
  if (cardAtualizado) return cardAtualizado

  return {
    ...card,
    repetitions: resultadoSM2.repetitions,
    interval_days: resultadoSM2.intervalDays,
    ease_factor: resultadoSM2.easeFactor,
    due_date: dataHojeFlashcards(),
    estado: obterEstadoFlashcardPorResultado(resultadoSM2)
  }
}

async function avaliarFlashcardAtual(quality) {
  if (!flashcardAtualSessao) {
    return respostaErroFlashcards('Nao ha flashcard em revisao no momento.')
  }

  let resultadoSM2
  try {
    resultadoSM2 = calcularProximaRevisaoSM2Flashcards(flashcardAtualSessao, quality)
  } catch (erro) {
    return respostaErroFlashcards(erro.message, erro.detalhes)
  }

  const registrar = globalThis.registrarRevisaoFlashcard || registrarRevisaoFlashcard
  const resposta = await registrar(flashcardAtualSessao.id, resultadoSM2)

  if (resposta.error) {
    mostrarMensagemRevisaoFlashcards(
      resposta.error.message || 'Nao foi possivel registrar a revisao do flashcard. Verifique sua conexao e tente novamente.'
    )
    return resposta
  }

  const cardRevisado = flashcardAtualSessao
  flashcardsSessaoHoje.shift()

  if (resultadoSM2.dueAgainToday) {
    flashcardsSessaoHoje.push(obterFlashcardAtualizadoAposRevisao(cardRevisado, resultadoSM2, resposta))
  }

  flashcardAtualSessao = flashcardsSessaoHoje[0] || null
  renderizarRevisaoFlashcardsHoje()

  return {
    ...resposta,
    resultadoSM2
  }
}

async function carregarListaFlashcards() {
  const lista = document.getElementById('flashcards-lista')
  if (!lista) return { data: [], error: null }

  lista.innerHTML = '<p class="texto-placeholder">Carregando flashcards...</p>'

  const listar = globalThis.listarFlashcards || listarFlashcards
  const resultado = await listar()

  if (resultado.error) {
    lista.innerHTML = '<p class="texto-placeholder">Nao foi possivel carregar seus flashcards. Verifique sua conexao e tente novamente.</p>'
    return resultado
  }

  renderizarListaFlashcards(resultado.data || [])
  return resultado
}

async function salvarFlashcardTela() {
  const btn = document.getElementById('btn-salvar-flashcard')
  const dados = obterDadosFormularioFlashcards()

  if (!dados.frente) {
    mostrarMensagemFlashcards('Informe a frente do flashcard.', 'erro')
    return { data: null, error: criarErroFlashcards('Informe a frente do flashcard.') }
  }

  if (!dados.verso) {
    mostrarMensagemFlashcards('Informe o verso do flashcard.', 'erro')
    return { data: null, error: criarErroFlashcards('Informe o verso do flashcard.') }
  }

  if (btn) {
    btn.disabled = true
    btn.textContent = 'Salvando...'
  }
  mostrarMensagemFlashcards('')

  const criar = globalThis.criarFlashcard || criarFlashcard
  const resultado = await criar({
    frente: dados.frente,
    verso: dados.verso,
    tags: dados.tags
  })

  if (btn) {
    btn.disabled = false
    btn.textContent = 'Salvar Card'
  }

  if (resultado.error) {
    mostrarMensagemFlashcards(resultado.error.message || 'Nao foi possivel salvar o flashcard.', 'erro')
    return resultado
  }

  limparFormularioFlashcards()
  mostrarMensagemFlashcards('Flashcard salvo com sucesso!', 'sucesso')
  await carregarListaFlashcards()
  return resultado
}

function manipularCliqueFlashcards(event) {
  const alvo = event.target
  if (!alvo || typeof alvo.closest !== 'function') return

  if (alvo.closest('#btn-iniciar-revisao-flashcards')) {
    iniciarSessaoRevisaoFlashcards()
    return
  }

  if (alvo.closest('#btn-mostrar-resposta-flashcard')) {
    mostrarRespostaFlashcardAtual()
    return
  }

  const botaoAvaliacao = alvo.closest('[data-flashcard-quality]')
  if (botaoAvaliacao) {
    avaliarFlashcardAtual(botaoAvaliacao.dataset.flashcardQuality)
  }
}

function inicializarFlashcards() {
  const secao = document.getElementById('secao-flashcards')
  if (!secao) return

  if (!flashcardsInicializado) {
    secao.querySelectorAll('[data-flashcards-aba]').forEach(botao => {
      botao.addEventListener('click', () => {
        selecionarAbaFlashcards(botao.dataset.flashcardsAba, secao)
        if (botao.dataset.flashcardsAba === 'todos') carregarListaFlashcards()
        if (botao.dataset.flashcardsAba === 'revisar-hoje') carregarFlashcardsRevisarHoje()
      })
    })
    secao.addEventListener('click', manipularCliqueFlashcards)
    document.getElementById('btn-salvar-flashcard')?.addEventListener('click', salvarFlashcardTela)
    flashcardsInicializado = true
  }

  atualizarIndicadoresFlashcardsVazios(document)
  selecionarAbaFlashcards(ABA_FLASHCARDS_PADRAO, secao)
  carregarFlashcardsRevisarHoje()
  carregarListaFlashcards()
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
  globalThis.salvarFlashcardTela = salvarFlashcardTela
  globalThis.carregarListaFlashcards = carregarListaFlashcards
  globalThis.renderizarListaFlashcards = renderizarListaFlashcards
  globalThis.carregarFlashcardsRevisarHoje = carregarFlashcardsRevisarHoje
  globalThis.iniciarSessaoRevisaoFlashcards = iniciarSessaoRevisaoFlashcards
  globalThis.mostrarRespostaFlashcardAtual = mostrarRespostaFlashcardAtual
  globalThis.avaliarFlashcardAtual = avaliarFlashcardAtual
  globalThis.renderizarRevisaoFlashcardsHoje = renderizarRevisaoFlashcardsHoje
  globalThis.calcularProximaRevisaoSM2Flashcards = calcularProximaRevisaoSM2Flashcards
  globalThis.criarFlashcard = criarFlashcard
  globalThis.listarFlashcards = listarFlashcards
  globalThis.listarFlashcardsDevidosHoje = listarFlashcardsDevidosHoje
  globalThis.atualizarFlashcard = atualizarFlashcard
  globalThis.desativarFlashcard = desativarFlashcard
  globalThis.registrarRevisaoFlashcard = registrarRevisaoFlashcard
}
