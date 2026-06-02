// js/flashcards.js

// ============================================
// CAMADA DE DADOS DOS FLASHCARDS
// ============================================

const CAMPOS_FLASHCARD =
  'id, user_id, materia_id, frente, verso, tags, ativo, estado, ease_factor, repetitions, interval_days, due_date, last_reviewed_at, total_reviews, correct_reviews, lapses, created_at, updated_at, materias(nome)'
const CAMPOS_REVISAO_FLASHCARD =
  'id, user_id, flashcard_id, quality, reviewed_at, was_correct'

const MENSAGEM_LOGIN_FLASHCARDS = 'E necessario estar logado para usar flashcards.'
const MENSAGEM_SUPABASE_FLASHCARDS = 'Configuracao do Supabase nao encontrada. Verifique o arquivo js/config.js.'
const ABA_FLASHCARDS_PADRAO = 'revisar-hoje'
const QUALIDADES_FLASHCARD = [0, 1, 2, 3, 4, 5]
const EASE_FACTOR_PADRAO_FLASHCARD = 2.5
const EASE_FACTOR_MINIMO_FLASHCARD = 1.3
const DIAS_ALERTA_ACUMULO_FLASHCARD = 2
const FLASHCARDS_CARDS_POR_PAGINA = 20
let flashcardsInicializado = false
let flashcardsSessaoHoje = []
let flashcardAtualSessao = null
let flashcardsTotalSessaoHoje = 0
let flashcardsSessaoRevisaoAtiva = false
let flashcardsListaTodos = []
let flashcardsListaPaginaAtual = 1
let flashcardsListaFiltrosAssinatura = ''
let flashcardsMaterias = []

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

function converterDiaSemanaFlashcards(dataISO) {
  const dia = new Date(`${dataISO}T12:00:00`).getDay()
  return dia === 0 ? 7 : dia
}

function adicionarDiasFlashcards(dataISO, dias) {
  const data = new Date(`${dataISO}T12:00:00`)
  data.setDate(data.getDate() + Number(dias || 0))
  return dataISOFlashcards(data)
}

function formatarProximaRevisaoFlashcard(data) {
  const dueDate = obterDataComparacaoFlashcard(data)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return 'sem data definida'

  const dataRevisao = new Date(`${dueDate}T12:00:00`)
  if (Number.isNaN(dataRevisao.getTime())) return 'sem data definida'

  const hoje = dataHojeFlashcards()
  const dataHoje = new Date(`${hoje}T12:00:00`)
  const diferencaDias = Math.round((dataRevisao.getTime() - dataHoje.getTime()) / 86400000)

  if (diferencaDias === 0) return `hoje (${dueDate})`
  if (diferencaDias === 1) return `amanhã (${dueDate})`
  if (diferencaDias < 0) {
    const diasAtraso = Math.abs(diferencaDias)
    return `atrasado há ${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'} (${dueDate})`
  }
  return `em ${diferencaDias} ${diferencaDias === 1 ? 'dia' : 'dias'} (${dueDate})`
}

function normalizarTextoObrigatorioFlashcards(valor) {
  return String(valor || '').trim()
}

function normalizarTextoBuscaFlashcards(valor) {
  return String(valor || '').trim().toLowerCase()
}

function normalizarRotuloCampoRicoFlashcard(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function identificarCampoRicoVersoFlashcard(rotulo) {
  return {
    VERSO: 'verso',
    CONTEXTO: 'contexto',
    RECONHECER: 'reconhecer',
    'ALERTA DE BANCA': 'alertaBanca'
  }[normalizarRotuloCampoRicoFlashcard(rotulo)] || null
}

function extrairCamposRicosDoVersoFlashcard(verso) {
  const textoOriginal = String(verso || '').trim()
  const fallback = {
    estruturado: false,
    verso: textoOriginal,
    contexto: '',
    reconhecer: '',
    alertaBanca: ''
  }

  if (!textoOriginal) return fallback

  const campos = {
    verso: '',
    contexto: '',
    reconhecer: '',
    alertaBanca: ''
  }
  let campoAtual = null
  let encontrouRotulo = false

  textoOriginal.split(/\r?\n/).forEach(linhaOriginal => {
    const rotulo = linhaOriginal.match(/^\s*([^:]{2,80})\s*:\s*(.*)$/)
    if (rotulo) {
      const campo = identificarCampoRicoVersoFlashcard(rotulo[1])
      if (campo) {
        campoAtual = campo
        encontrouRotulo = true
        if (rotulo[2]) campos[campoAtual] += `${rotulo[2].trim()}\n`
        return
      }
    }

    if (campoAtual) campos[campoAtual] += `${linhaOriginal.trimEnd()}\n`
  })

  Object.keys(campos).forEach(chave => {
    campos[chave] = campos[chave].trim()
  })

  if (!encontrouRotulo || !campos.verso) return fallback

  return {
    estruturado: true,
    ...campos
  }
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

function obterNomeMateriaFlashcard(card) {
  if (card?.materias?.nome) return card.materias.nome
  const materia = flashcardsMaterias.find(item => item.id === card?.materia_id)
  return materia?.nome || 'Sem matéria'
}

function criarParagrafoVersoFlashcard(texto) {
  const paragrafo = document.createElement('p')
  paragrafo.className = 'card-questao-comentario'
  paragrafo.textContent = texto || 'Sem verso'
  return paragrafo
}

function criarBlocoCampoRicoFlashcard(titulo, texto) {
  const bloco = document.createElement('div')
  bloco.className = 'flashcard-campo-rico'

  const rotulo = document.createElement('span')
  rotulo.className = 'tag-estudo'
  rotulo.textContent = titulo

  bloco.append(rotulo, criarParagrafoVersoFlashcard(texto))
  return bloco
}

function criarElementoVersoFlashcard(verso) {
  const campos = extrairCamposRicosDoVersoFlashcard(verso)
  if (!campos.estruturado) return criarParagrafoVersoFlashcard(campos.verso)

  const container = document.createElement('div')
  container.className = 'flashcard-verso-rico'
  container.appendChild(criarParagrafoVersoFlashcard(campos.verso))

  if (campos.contexto) container.appendChild(criarBlocoCampoRicoFlashcard('Contexto', campos.contexto))
  if (campos.reconhecer) container.appendChild(criarBlocoCampoRicoFlashcard('Como reconhecer', campos.reconhecer))
  if (campos.alertaBanca) container.appendChild(criarBlocoCampoRicoFlashcard('Alerta de banca', campos.alertaBanca))

  return container
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

function listaFlashcardsJaCarregada() {
  return document.getElementById('flashcards-lista')?.dataset.flashcardsListaCarregada === 'true'
}

function resetarPaginacaoListaFlashcards() {
  flashcardsListaPaginaAtual = 1
}

function totalPaginasListaFlashcards(totalCards = 0) {
  return Math.max(1, Math.ceil(totalCards / FLASHCARDS_CARDS_POR_PAGINA))
}

function ajustarPaginaListaFlashcards(totalCards = 0) {
  const totalPaginas = totalPaginasListaFlashcards(totalCards)
  flashcardsListaPaginaAtual = Math.min(Math.max(flashcardsListaPaginaAtual, 1), totalPaginas)
  return totalPaginas
}

function obterAssinaturaFiltrosFlashcards(filtros = {}) {
  return [
    filtros.busca || '',
    filtros.estado || '',
    filtros.vencimento || '',
    filtros.tag || '',
    filtros.materia || ''
  ].join('|')
}

function atualizarIndicadoresFlashcardsVazios(raiz = document) {
  const pendentesHoje = raiz.getElementById?.('flashcards-pendentes-hoje')
  const resumoVencimento = raiz.getElementById?.('flashcards-resumo-vencimento')
  const totalCards = raiz.getElementById?.('flashcards-total-cards')
  const cardsHoje = raiz.getElementById?.('flashcards-cards-hoje')
  const cardsNovos = raiz.getElementById?.('flashcards-cards-novos')
  const cardsAprendendo = raiz.getElementById?.('flashcards-cards-aprendendo')
  const cardsRevisando = raiz.getElementById?.('flashcards-cards-revisando')
  const totalRevisoes = raiz.getElementById?.('flashcards-total-revisoes')
  const totalAcertos = raiz.getElementById?.('flashcards-total-acertos')
  const taxaAcerto = raiz.getElementById?.('flashcards-taxa-acerto')
  const totalErros = raiz.getElementById?.('flashcards-total-erros')
  const sequencia = raiz.getElementById?.('flashcards-sequencia-estudos')

  if (pendentesHoje) pendentesHoje.textContent = '0 cards vencidos/devidos'
  if (resumoVencimento) resumoVencimento.textContent = '0 atrasado(s) · 0 para hoje'
  if (totalCards) totalCards.textContent = '0'
  if (cardsHoje) cardsHoje.textContent = '0'
  if (cardsNovos) cardsNovos.textContent = '0'
  if (cardsAprendendo) cardsAprendendo.textContent = '0'
  if (cardsRevisando) cardsRevisando.textContent = '0'
  if (totalRevisoes) totalRevisoes.textContent = '0'
  if (totalAcertos) totalAcertos.textContent = '0'
  if (taxaAcerto) taxaAcerto.textContent = '0%'
  if (totalErros) totalErros.textContent = '0'
  if (sequencia) sequencia.textContent = '0'
}

function mostrarMensagemFlashcards(texto, tipo = '') {
  const msg = document.getElementById('msg-flashcards')
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo}`.trim()
}

function obterMensagemListaFlashcards() {
  const existente = document.getElementById('msg-flashcards-lista')
  if (existente) return existente

  const lista = document.getElementById('flashcards-lista')
  if (!lista) return null

  const msg = document.createElement('p')
  msg.id = 'msg-flashcards-lista'
  msg.className = 'msg-materia'
  lista.insertAdjacentElement('afterend', msg)
  return msg
}

function mostrarMensagemListaFlashcards(texto, tipo = '') {
  const msg = obterMensagemListaFlashcards()
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo}`.trim()
}

function obterFiltrosFlashcards(raiz = document) {
  return {
    busca: normalizarTextoBuscaFlashcards(raiz.getElementById?.('flashcards-busca')?.value),
    estado: raiz.getElementById?.('flashcards-filtro-estado')?.value || 'todos',
    vencimento: raiz.getElementById?.('flashcards-filtro-vencimento')?.value || 'todos',
    tag: normalizarTextoBuscaFlashcards(raiz.getElementById?.('flashcards-filtro-tag')?.value),
    materia: raiz.getElementById?.('flashcards-filtro-materia')?.value || 'todos'
  }
}

function filtrosFlashcardsAtivos(filtros = obterFiltrosFlashcards()) {
  return Boolean(
    filtros.busca ||
    filtros.tag ||
    (filtros.estado && filtros.estado !== 'todos') ||
    (filtros.vencimento && filtros.vencimento !== 'todos') ||
    (filtros.materia && filtros.materia !== 'todos')
  )
}

function textoPesquisavelFlashcard(card) {
  return [
    card?.frente,
    card?.verso,
    ...(Array.isArray(card?.tags) ? card.tags : [])
  ]
    .map(normalizarTextoBuscaFlashcards)
    .join(' ')
}

function flashcardPassaFiltroBusca(card, busca) {
  if (!busca) return true
  return textoPesquisavelFlashcard(card).includes(busca)
}

function flashcardPassaFiltroTag(card, tag) {
  if (!tag) return true
  if (!Array.isArray(card?.tags)) return false
  return card.tags.some(tagCard => normalizarTextoBuscaFlashcards(tagCard).includes(tag))
}

function flashcardPassaFiltroEstado(card, estado) {
  if (!estado || estado === 'todos') return true
  return (card?.estado || 'novo') === estado
}

function flashcardPassaFiltroVencimento(card, vencimento) {
  if (!vencimento || vencimento === 'todos') return true
  const dueDate = obterDataComparacaoFlashcard(card?.due_date)
  if (!dueDate) return false
  if (vencimento === 'hoje') return dueDate <= dataHojeFlashcards()
  if (vencimento === 'futuros') return dueDate > dataHojeFlashcards()
  return true
}

function flashcardPassaFiltroMateria(card, materia) {
  if (!materia || materia === 'todos') return true
  if (materia === 'sem-materia') return !card?.materia_id
  return card?.materia_id === materia
}

function aplicarFiltrosFlashcards(cards = [], filtros = obterFiltrosFlashcards()) {
  const lista = Array.isArray(cards) ? cards : []
  return lista.filter(card =>
    card?.ativo !== false &&
    flashcardPassaFiltroBusca(card, filtros.busca) &&
    flashcardPassaFiltroTag(card, filtros.tag) &&
    flashcardPassaFiltroEstado(card, filtros.estado) &&
    flashcardPassaFiltroVencimento(card, filtros.vencimento) &&
    flashcardPassaFiltroMateria(card, filtros.materia)
  )
}

function popularSelectMateriaFlashcards(select, materias = [], valorVazio, textoVazio) {
  if (!select) return
  const valorAtual = select.value
  select.replaceChildren()

  const optionVazio = document.createElement('option')
  optionVazio.value = valorVazio
  optionVazio.textContent = textoVazio
  select.appendChild(optionVazio)

  materias.forEach(materia => {
    const option = document.createElement('option')
    option.value = materia.id
    option.textContent = materia.nome
    select.appendChild(option)
  })

  if ([...select.options].some(option => option.value === valorAtual)) {
    select.value = valorAtual
  }
}

function atualizarSelectsMateriaFlashcards(materias = flashcardsMaterias) {
  popularSelectMateriaFlashcards(
    document.getElementById('flashcard-materia'),
    materias,
    '',
    'Sem matéria'
  )

  const filtroMateria = document.getElementById('flashcards-filtro-materia')
  if (filtroMateria) {
    const valorAtual = filtroMateria.value
    filtroMateria.replaceChildren()

    const todas = document.createElement('option')
    todas.value = 'todos'
    todas.textContent = 'Todas as matérias'
    filtroMateria.appendChild(todas)

    const semMateria = document.createElement('option')
    semMateria.value = 'sem-materia'
    semMateria.textContent = 'Sem matéria'
    filtroMateria.appendChild(semMateria)

    materias.forEach(materia => {
      const option = document.createElement('option')
      option.value = materia.id
      option.textContent = materia.nome
      filtroMateria.appendChild(option)
    })

    if ([...filtroMateria.options].some(option => option.value === valorAtual)) {
      filtroMateria.value = valorAtual
    }
  }
}

function obterDadosFormularioFlashcards() {
  const frente = normalizarTextoObrigatorioFlashcards(document.getElementById('flashcard-frente')?.value)
  const verso = normalizarTextoObrigatorioFlashcards(document.getElementById('flashcard-verso')?.value)
  const tagsTexto = document.getElementById('flashcard-tags')?.value || ''
  const materiaId = normalizarMateriaIdFlashcards(document.getElementById('flashcard-materia')?.value)
  const tags = tagsTexto
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)

  return { frente, verso, tags, materia_id: materiaId || undefined }
}

function limparFormularioFlashcards() {
  const frente = document.getElementById('flashcard-frente')
  const verso = document.getElementById('flashcard-verso')
  const tags = document.getElementById('flashcard-tags')

  if (frente) frente.value = ''
  if (verso) verso.value = ''
  if (tags) tags.value = ''
  const materia = document.getElementById('flashcard-materia')
  if (materia) materia.value = ''
}

function obterTagsTextoFlashcard(card) {
  return Array.isArray(card?.tags) ? card.tags.join(', ') : ''
}

function criarCampoEdicaoFlashcard(nome, rotulo, valor, tipo = 'textarea') {
  const campo = document.createElement('div')
  campo.className = 'campo-form'

  const label = document.createElement('label')
  label.className = 'campo-label'
  label.textContent = rotulo

  const input = document.createElement(tipo)
  input.className = tipo === 'textarea' ? 'input-texto input-textarea' : 'input-texto'
  input.dataset.flashcardEdicao = nome
  input.value = valor || ''
  if (tipo === 'textarea') input.rows = 3

  campo.append(label, input)
  return campo
}

function mostrarMensagemEdicaoFlashcard(item, texto, tipo = '') {
  const msg = item?.querySelector?.('[data-flashcard-edicao-msg]')
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo}`.trim()
}

function obterDadosEdicaoFlashcard(item) {
  const frente = normalizarTextoObrigatorioFlashcards(item.querySelector('[data-flashcard-edicao="frente"]')?.value)
  const verso = normalizarTextoObrigatorioFlashcards(item.querySelector('[data-flashcard-edicao="verso"]')?.value)
  const tagsTexto = item.querySelector('[data-flashcard-edicao="tags"]')?.value || ''
  const tags = tagsTexto
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)

  return { frente, verso, tags }
}

function abrirEdicaoFlashcardLista(card, item) {
  if (!item || !card) return

  item.replaceChildren()

  const titulo = document.createElement('h4')
  titulo.className = 'card-form-titulo'
  titulo.textContent = 'Editar flashcard'

  const acoes = document.createElement('div')
  acoes.className = 'flashcard-lista-acoes'

  const salvar = document.createElement('button')
  salvar.className = 'btn-primario'
  salvar.type = 'button'
  salvar.textContent = 'Salvar edicao'
  salvar.addEventListener('click', () => salvarEdicaoFlashcardLista(card.id, item))

  const cancelar = document.createElement('button')
  cancelar.className = 'btn-secundario'
  cancelar.type = 'button'
  cancelar.textContent = 'Cancelar'
  cancelar.addEventListener('click', () => item.replaceWith(criarElementoFlashcardLista(card)))

  const msg = document.createElement('p')
  msg.className = 'msg-materia'
  msg.dataset.flashcardEdicaoMsg = 'true'

  acoes.append(salvar, cancelar)
  item.append(
    titulo,
    criarCampoEdicaoFlashcard('frente', 'Frente', card.frente),
    criarCampoEdicaoFlashcard('verso', 'Verso', card.verso),
    criarCampoEdicaoFlashcard('tags', 'Tags, opcional', obterTagsTextoFlashcard(card), 'input'),
    acoes,
    msg
  )
}

async function salvarEdicaoFlashcardLista(id, item) {
  if (!item) return respostaErroFlashcards('Informe o flashcard que deve ser atualizado.')

  const dados = obterDadosEdicaoFlashcard(item)

  if (!dados.frente) {
    mostrarMensagemEdicaoFlashcard(item, 'Informe a frente do flashcard.', 'erro')
    return { data: null, error: criarErroFlashcards('Informe a frente do flashcard.') }
  }

  if (!dados.verso) {
    mostrarMensagemEdicaoFlashcard(item, 'Informe o verso do flashcard.', 'erro')
    return { data: null, error: criarErroFlashcards('Informe o verso do flashcard.') }
  }

  const atualizar = globalThis.atualizarFlashcard || atualizarFlashcard
  const resultado = await atualizar(id, {
    frente: dados.frente,
    verso: dados.verso,
    tags: dados.tags
  })

  if (resultado.error) {
    mostrarMensagemEdicaoFlashcard(
      item,
      resultado.error.message || 'Nao foi possivel atualizar o flashcard.',
      'erro'
    )
    return resultado
  }

  await carregarListaFlashcards()
  mostrarMensagemListaFlashcards('Flashcard atualizado com sucesso.', 'sucesso')
  return resultado
}

function mostrarConfirmacaoDesativarFlashcardLista(card, item) {
  if (!item || !card) return

  item.querySelector('.flashcard-confirmacao-desativar')?.remove()

  const confirmacao = document.createElement('div')
  confirmacao.className = 'flashcard-confirmacao-desativar'

  const texto = document.createElement('p')
  texto.className = 'texto-apoio'
  texto.textContent = 'Desativar este flashcard? Ele deixara de aparecer na lista de cards ativos.'

  const confirmar = document.createElement('button')
  confirmar.className = 'btn-primario'
  confirmar.type = 'button'
  confirmar.textContent = 'Confirmar desativacao'
  confirmar.addEventListener('click', () => confirmarDesativacaoFlashcardLista(card.id, item))

  const cancelar = document.createElement('button')
  cancelar.className = 'btn-secundario'
  cancelar.type = 'button'
  cancelar.textContent = 'Cancelar'
  cancelar.addEventListener('click', () => confirmacao.remove())

  const msg = document.createElement('p')
  msg.className = 'msg-materia'
  msg.dataset.flashcardEdicaoMsg = 'true'

  confirmacao.append(texto, confirmar, cancelar, msg)
  item.appendChild(confirmacao)
}

async function confirmarDesativacaoFlashcardLista(id, item) {
  const desativar = globalThis.desativarFlashcard || desativarFlashcard
  const resultado = await desativar(id)

  if (resultado.error) {
    mostrarMensagemEdicaoFlashcard(
      item,
      resultado.error.message || 'Nao foi possivel desativar o flashcard.',
      'erro'
    )
    return resultado
  }

  removerFlashcardDaSessaoAtual(id)
  item?.remove()
  await carregarListaFlashcards()
  mostrarMensagemListaFlashcards('Flashcard desativado com sucesso.', 'sucesso')
  return resultado
}

function criarElementoFlashcardLista(card) {
  const item = document.createElement('article')
  item.className = 'card-questao flashcard-lista-item'
  if (card?.id) item.dataset.flashcardId = card.id

  const frente = document.createElement('h4')
  frente.className = 'card-form-titulo'
  frente.textContent = card.frente || 'Sem frente'

  const verso = criarElementoVersoFlashcard(card.verso)

  const meta = document.createElement('div')
  meta.className = 'revisao-tags'

  const estado = document.createElement('span')
  estado.className = 'tag-estudo'
  estado.textContent = `Estado: ${card.estado || 'novo'}`
  meta.appendChild(estado)

  const proximaRevisao = document.createElement('span')
  proximaRevisao.className = 'tag-estudo'
  proximaRevisao.textContent = `Proxima revisao: ${formatarProximaRevisaoFlashcard(card.due_date)}`
  meta.appendChild(proximaRevisao)

  if (Array.isArray(card.tags) && card.tags.length > 0) {
    const tags = document.createElement('span')
    tags.className = 'tag-estudo'
    tags.textContent = `Tags: ${card.tags.join(', ')}`
    meta.appendChild(tags)
  }

  const materia = document.createElement('span')
  materia.className = 'tag-estudo'
  materia.textContent = `Matéria: ${obterNomeMateriaFlashcard(card)}`
  meta.appendChild(materia)

  const acoes = document.createElement('div')
  acoes.className = 'flashcard-lista-acoes'

  const editar = document.createElement('button')
  editar.className = 'btn-secundario'
  editar.type = 'button'
  editar.textContent = 'Editar'
  editar.disabled = !card?.id
  editar.addEventListener('click', () => abrirEdicaoFlashcardLista(card, item))

  const desativar = document.createElement('button')
  desativar.className = 'btn-secundario'
  desativar.type = 'button'
  desativar.textContent = 'Desativar'
  desativar.disabled = !card?.id
  desativar.addEventListener('click', () => mostrarConfirmacaoDesativarFlashcardLista(card, item))

  acoes.append(editar, desativar)
  item.append(frente, verso, meta, acoes)
  return item
}

function criarBotaoPaginacaoFlashcards(texto, paginaDestino, desabilitado = false) {
  const botao = document.createElement('button')
  botao.className = 'btn-secundario'
  botao.type = 'button'
  botao.textContent = texto
  botao.disabled = desabilitado
  botao.addEventListener('click', () => {
    flashcardsListaPaginaAtual = paginaDestino
    renderizarListaFlashcardsFiltrada()
  })
  return botao
}

function criarControlesPaginacaoFlashcards(totalCards, totalPaginas) {
  const inicio = (flashcardsListaPaginaAtual - 1) * FLASHCARDS_CARDS_POR_PAGINA + 1
  const fim = Math.min(flashcardsListaPaginaAtual * FLASHCARDS_CARDS_POR_PAGINA, totalCards)

  const container = document.createElement('div')
  container.className = 'flashcards-paginacao'

  const resumo = document.createElement('p')
  resumo.className = 'texto-apoio'
  resumo.textContent = `Mostrando ${inicio}-${fim} de ${totalCards} cards`

  const navegacao = document.createElement('div')
  navegacao.className = 'flashcard-lista-acoes'

  const pagina = document.createElement('span')
  pagina.className = 'tag-estudo'
  pagina.textContent = `Pagina ${flashcardsListaPaginaAtual} de ${totalPaginas}`

  const anterior = criarBotaoPaginacaoFlashcards(
    'Anterior',
    flashcardsListaPaginaAtual - 1,
    flashcardsListaPaginaAtual <= 1
  )
  const proxima = criarBotaoPaginacaoFlashcards(
    'Proxima',
    flashcardsListaPaginaAtual + 1,
    flashcardsListaPaginaAtual >= totalPaginas
  )

  navegacao.append(anterior, pagina, proxima)
  container.append(resumo, navegacao)
  return container
}

function renderizarListaFlashcards(cards = [], opcoes = {}) {
  const lista = document.getElementById('flashcards-lista')
  if (!lista) return

  lista.replaceChildren()

  const cardsAtivos = Array.isArray(cards)
    ? cards.filter(card => card?.ativo !== false)
    : []

  if (cardsAtivos.length === 0) {
    const vazio = document.createElement('p')
    vazio.className = 'texto-placeholder'
    vazio.textContent = opcoes.mensagemVazia || 'Nenhum flashcard cadastrado ainda.'
    lista.appendChild(vazio)
    resetarPaginacaoListaFlashcards()
    return
  }

  const totalPaginas = opcoes.paginar ? ajustarPaginaListaFlashcards(cardsAtivos.length) : 1
  const indiceInicial = opcoes.paginar
    ? (flashcardsListaPaginaAtual - 1) * FLASHCARDS_CARDS_POR_PAGINA
    : 0
  const indiceFinal = opcoes.paginar
    ? indiceInicial + FLASHCARDS_CARDS_POR_PAGINA
    : cardsAtivos.length
  const cardsPagina = cardsAtivos.slice(indiceInicial, indiceFinal)

  cardsPagina.forEach(card => lista.appendChild(criarElementoFlashcardLista(card)))
  if (opcoes.paginar) lista.appendChild(criarControlesPaginacaoFlashcards(cardsAtivos.length, totalPaginas))
}

function renderizarListaFlashcardsFiltrada() {
  const filtros = obterFiltrosFlashcards()
  const assinaturaFiltros = obterAssinaturaFiltrosFlashcards(filtros)
  if (assinaturaFiltros !== flashcardsListaFiltrosAssinatura) {
    flashcardsListaFiltrosAssinatura = assinaturaFiltros
    resetarPaginacaoListaFlashcards()
  }
  const cardsFiltrados = aplicarFiltrosFlashcards(flashcardsListaTodos, filtros)
  const mensagemVazia = filtrosFlashcardsAtivos(filtros)
    ? 'Nenhum flashcard encontrado com os filtros atuais.'
    : 'Nenhum flashcard cadastrado ainda.'

  renderizarListaFlashcards(cardsFiltrados, { mensagemVazia, paginar: true })
}

function limparFiltrosFlashcards() {
  const busca = document.getElementById('flashcards-busca')
  const estado = document.getElementById('flashcards-filtro-estado')
  const vencimento = document.getElementById('flashcards-filtro-vencimento')
  const tag = document.getElementById('flashcards-filtro-tag')
  const materia = document.getElementById('flashcards-filtro-materia')

  if (busca) busca.value = ''
  if (estado) estado.value = 'todos'
  if (vencimento) vencimento.value = 'todos'
  if (tag) tag.value = ''
  if (materia) materia.value = 'todos'

  resetarPaginacaoListaFlashcards()
  renderizarListaFlashcardsFiltrada()
}

function inicializarFiltrosFlashcards(secao = document) {
  const busca = secao.querySelector?.('#flashcards-busca')
  const estado = secao.querySelector?.('#flashcards-filtro-estado')
  const vencimento = secao.querySelector?.('#flashcards-filtro-vencimento')
  const tag = secao.querySelector?.('#flashcards-filtro-tag')
  const materia = secao.querySelector?.('#flashcards-filtro-materia')
  const limpar = secao.querySelector?.('#btn-limpar-filtros-flashcards')

  busca?.addEventListener('input', renderizarListaFlashcardsFiltrada)
  estado?.addEventListener('change', renderizarListaFlashcardsFiltrada)
  vencimento?.addEventListener('change', renderizarListaFlashcardsFiltrada)
  tag?.addEventListener('input', renderizarListaFlashcardsFiltrada)
  materia?.addEventListener('change', renderizarListaFlashcardsFiltrada)
  limpar?.addEventListener('click', limparFiltrosFlashcards)
}

function obterDataComparacaoFlashcard(data) {
  return String(data || '').slice(0, 10)
}

function flashcardDevidoHoje(card) {
  if (!card || card.ativo === false) return false
  const dueDate = obterDataComparacaoFlashcard(card.due_date)
  return Boolean(dueDate) && dueDate <= dataHojeFlashcards()
}

function flashcardVencidoAlertaAcumulo(card, dataReferencia = dataHojeFlashcards()) {
  if (!card || card.ativo === false) return false
  const dueDate = obterDataComparacaoFlashcard(card.due_date)
  const dataLimite = adicionarDiasFlashcards(dataReferencia, -DIAS_ALERTA_ACUMULO_FLASHCARD)
  return Boolean(dueDate) && dueDate <= dataLimite
}

function contarCardsAcumuladosFlashcards(cards = [], dataReferencia = dataHojeFlashcards()) {
  return (Array.isArray(cards) ? cards : []).filter(card =>
    flashcardVencidoAlertaAcumulo(card, dataReferencia)
  ).length
}

function navegarParaRevisaoUrgenteFlashcards() {
  const secao = document.getElementById('secao-flashcards')
  selecionarAbaFlashcards('revisar-hoje', secao || document)
  carregarFlashcardsRevisarHoje()
  carregarEstudoDiaFlashcards()
  document.getElementById('flashcards-revisao-urgente')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
}

function renderizarAlertaAcumuloFlashcards(quantidade = 0) {
  const alerta = document.getElementById('flashcards-alerta-acumulo')
  const texto = document.getElementById('flashcards-alerta-acumulo-texto')
  const botao = document.getElementById('btn-revisar-alerta-flashcards')
  const total = Number(quantidade || 0)

  if (botao) botao.onclick = navegarParaRevisaoUrgenteFlashcards
  if (!alerta) return

  if (total <= 0) {
    alerta.hidden = true
    if (texto) texto.textContent = ''
    return
  }

  alerta.hidden = false
  if (texto) {
    texto.textContent = `⚠️ Você tem ${total} cards vencidos há mais de 2 dias. Ignorá-los pode comprometer sua memorização.`
  }
}

async function carregarAlertaAcumuloFlashcards() {
  const listar = globalThis.listarFlashcardsDevidosHoje || listarFlashcardsDevidosHoje
  const resultado = await listar()

  if (resultado.error) {
    renderizarAlertaAcumuloFlashcards(0)
    return { data: 0, error: resultado.error }
  }

  const quantidade = contarCardsAcumuladosFlashcards(resultado.data || [])
  renderizarAlertaAcumuloFlashcards(quantidade)
  return { data: quantidade, error: null }
}

function embaralharFlashcardsSessao(cards = []) {
  const copia = [...cards]
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

function contarVencimentosRevisaoUrgenteFlashcards(cards = flashcardsSessaoHoje) {
  const hoje = dataHojeFlashcards()
  return (Array.isArray(cards) ? cards : []).reduce((totais, card) => {
    const dueDate = obterDataComparacaoFlashcard(card?.due_date)
    if (dueDate && dueDate < hoje) totais.atrasados += 1
    if (dueDate === hoje) totais.paraHoje += 1
    return totais
  }, { atrasados: 0, paraHoje: 0 })
}

function atualizarIndicadoresRevisaoFlashcards() {
  const pendentesHoje = document.getElementById('flashcards-pendentes-hoje')
  const progresso = document.getElementById('flashcards-progresso-sessao')
  const resumoVencimento = document.getElementById('flashcards-resumo-vencimento')
  const restantes = flashcardsSessaoHoje.length
  const concluidos = Math.max(0, flashcardsTotalSessaoHoje - restantes)
  const vencimentos = contarVencimentosRevisaoUrgenteFlashcards()

  if (pendentesHoje) pendentesHoje.textContent = `${restantes} cards vencidos/devidos`
  if (progresso) progresso.textContent = `Progresso: ${concluidos}/${flashcardsTotalSessaoHoje}`
  if (resumoVencimento) resumoVencimento.textContent = `${vencimentos.atrasados} atrasado(s) · ${vencimentos.paraHoje} para hoje`
}

function sessaoRevisaoFlashcardsEmAndamento() {
  const areaCard = document.getElementById('flashcards-revisao-card')
  return Boolean(flashcardsSessaoRevisaoAtiva && flashcardAtualSessao && areaCard?.children.length)
}

function contarFlashcardsConcluidosSessao() {
  return Math.max(0, flashcardsTotalSessaoHoje - flashcardsSessaoHoje.length)
}

function atualizarTotalSessaoFlashcards(concluidos) {
  flashcardsTotalSessaoHoje = concluidos + flashcardsSessaoHoje.length
}

function sincronizarSessaoRevisaoFlashcards(cardsDevidos = []) {
  const concluidos = contarFlashcardsConcluidosSessao()
  const cardsPorId = new Map(cardsDevidos.map(card => [card.id, card]))
  const idsFilaAtual = new Set(flashcardsSessaoHoje.map(card => card?.id).filter(Boolean))
  const filaPreservada = flashcardsSessaoHoje
    .map(card => cardsPorId.get(card?.id))
    .filter(Boolean)
  const novosCardsDevidos = cardsDevidos.filter(card => card?.id && !idsFilaAtual.has(card.id))

  flashcardsSessaoHoje = [...filaPreservada, ...novosCardsDevidos]
  flashcardAtualSessao = flashcardsSessaoHoje[0] || null
  atualizarTotalSessaoFlashcards(concluidos)
  if (!flashcardAtualSessao) flashcardsSessaoRevisaoAtiva = false
}

function removerFlashcardDaSessaoAtual(id) {
  if (!id || !sessaoRevisaoFlashcardsEmAndamento()) return

  const estavaNaFila = flashcardsSessaoHoje.some(card => card?.id === id)
  if (!estavaNaFila) return

  const concluidos = contarFlashcardsConcluidosSessao()
  flashcardsSessaoHoje = flashcardsSessaoHoje.filter(card => card?.id !== id)
  flashcardAtualSessao = flashcardsSessaoHoje[0] || null
  atualizarTotalSessaoFlashcards(concluidos)
  if (!flashcardAtualSessao) flashcardsSessaoRevisaoAtiva = false
  renderizarRevisaoFlashcardsHoje()
}

function renderizarEstudoDiaFlashcards() {
  const status = document.getElementById('flashcards-estudo-dia-status')
  const mensagem = document.getElementById('flashcards-estudo-dia-vazio')
  const lista = obterListaEstudoDiaFlashcards()

  if (status) status.textContent = 'Planejamento'
  if (mensagem) {
    mensagem.hidden = false
    mensagem.textContent = 'Carregando estudo do dia...'
  }
  if (lista) lista.replaceChildren()
}

function obterListaEstudoDiaFlashcards() {
  const secao = document.getElementById('flashcards-estudo-dia')
  if (!secao) return null

  let lista = document.getElementById('flashcards-estudo-dia-lista')
  if (!lista) {
    lista = document.createElement('div')
    lista.id = 'flashcards-estudo-dia-lista'
    secao.appendChild(lista)
  }
  return lista
}

function mostrarMensagemEstudoDiaFlashcards(texto, statusTexto = 'Planejamento') {
  const status = document.getElementById('flashcards-estudo-dia-status')
  const mensagem = document.getElementById('flashcards-estudo-dia-vazio')
  const lista = obterListaEstudoDiaFlashcards()

  if (status) status.textContent = statusTexto
  if (mensagem) {
    mensagem.hidden = false
    mensagem.textContent = texto
  }
  if (lista) lista.replaceChildren()
}

function obterMateriaPlanejadaIdFlashcards(item) {
  return normalizarMateriaIdFlashcards(item?.materia_id)
}

function obterNomeMateriaPlanejadaFlashcards(materiaId, materiasPlanejadas = []) {
  const planejada = materiasPlanejadas.find(item => obterMateriaPlanejadaIdFlashcards(item) === materiaId)
  return planejada?.materias?.nome || planejada?.nome || obterNomeMateriaFlashcard({ materia_id: materiaId })
}

function selecionarCardsNovosEstudoDiaFlashcards(cards = [], materiasPlanejadas = []) {
  const materiaIds = new Set(
    (Array.isArray(materiasPlanejadas) ? materiasPlanejadas : [])
      .map(obterMateriaPlanejadaIdFlashcards)
      .filter(Boolean)
  )

  if (materiaIds.size === 0) return []

  return (Array.isArray(cards) ? cards : []).filter(card =>
    card?.ativo !== false &&
    (card?.estado || 'novo') === 'novo' &&
    Boolean(card?.materia_id) &&
    materiaIds.has(card.materia_id)
  )
}

function criarElementoEstudoDiaFlashcard(card, materiasPlanejadas = []) {
  const item = document.createElement('article')
  item.className = 'card-questao flashcard-estudo-dia-item'

  const tag = document.createElement('span')
  tag.className = 'tag-estudo'
  tag.textContent = 'Novo'

  const frente = document.createElement('h4')
  frente.className = 'card-form-titulo'
  frente.textContent = card.frente || 'Sem frente'

  const materia = document.createElement('p')
  materia.className = 'texto-apoio'
  materia.textContent = `Matéria: ${obterNomeMateriaPlanejadaFlashcards(card.materia_id, materiasPlanejadas)}`

  item.append(tag, frente, materia)
  return item
}

function renderizarCardsEstudoDiaFlashcards(cards = [], materiasPlanejadas = []) {
  const status = document.getElementById('flashcards-estudo-dia-status')
  const mensagem = document.getElementById('flashcards-estudo-dia-vazio')
  const lista = obterListaEstudoDiaFlashcards()

  if (status) status.textContent = `${cards.length} card(s) novo(s)`
  if (mensagem) {
    mensagem.hidden = true
    mensagem.textContent = ''
  }
  if (!lista) return

  lista.replaceChildren()
  cards.forEach(card => lista.appendChild(criarElementoEstudoDiaFlashcard(card, materiasPlanejadas)))
}

async function carregarEstudoDiaFlashcards() {
  renderizarEstudoDiaFlashcards()

  const listarMaterias = globalThis.listarMateriasPlanejadasHojeFlashcards || listarMateriasPlanejadasHojeFlashcards
  const resultadoMaterias = await listarMaterias()

  if (resultadoMaterias.error) {
    mostrarMensagemEstudoDiaFlashcards(
      resultadoMaterias.error.message || 'Nao foi possivel carregar o estudo do dia. Verifique sua conexao e tente novamente.',
      'Erro'
    )
    return { data: [], materias: [], error: resultadoMaterias.error }
  }

  const materiasPlanejadas = resultadoMaterias.data || []
  if (materiasPlanejadas.length === 0) {
    mostrarMensagemEstudoDiaFlashcards('Nenhuma matéria programada para hoje. Configure seu planejamento.')
    return { data: [], materias: [], error: null }
  }

  const listarCards = globalThis.listarFlashcards || listarFlashcards
  const resultadoCards = await listarCards()

  if (resultadoCards.error) {
    mostrarMensagemEstudoDiaFlashcards(
      resultadoCards.error.message || 'Nao foi possivel carregar os flashcards do estudo do dia. Verifique sua conexao e tente novamente.',
      'Erro'
    )
    return { data: [], materias: materiasPlanejadas, error: resultadoCards.error }
  }

  const cardsNovos = selecionarCardsNovosEstudoDiaFlashcards(resultadoCards.data || [], materiasPlanejadas)

  if (cardsNovos.length === 0) {
    mostrarMensagemEstudoDiaFlashcards('Não há cards novos para as matérias planejadas hoje.')
    return { data: [], materias: materiasPlanejadas, error: null }
  }

  renderizarCardsEstudoDiaFlashcards(cardsNovos, materiasPlanejadas)
  return { data: cardsNovos, materias: materiasPlanejadas, error: null }
}

function obterDataRevisaoFlashcard(revisao) {
  return String(revisao?.reviewed_at || '').slice(0, 10)
}

function revisarFoiAcertoFlashcard(revisao) {
  if (typeof revisao?.was_correct === 'boolean') return revisao.was_correct
  return Number(revisao?.quality) >= 3
}

function calcularSequenciaEstudosFlashcards(revisoes = []) {
  const diasRevisados = new Set(
    revisoes
      .map(obterDataRevisaoFlashcard)
      .filter(Boolean)
  )

  let dataAtual = dataHojeFlashcards()
  let sequencia = 0

  while (diasRevisados.has(dataAtual)) {
    sequencia += 1
    dataAtual = adicionarDiasFlashcards(dataAtual, -1)
  }

  return sequencia
}

function calcularEstatisticasFlashcards(cards = [], revisoes = []) {
  const cardsAtivos = Array.isArray(cards)
    ? cards.filter(card => card?.ativo !== false)
    : []
  const revisoesLista = Array.isArray(revisoes) ? revisoes : []
  const totalRevisoes = revisoesLista.length
  const totalAcertos = revisoesLista.filter(revisarFoiAcertoFlashcard).length
  const totalErros = totalRevisoes - totalAcertos
  const hoje = dataHojeFlashcards()
  const cardsAtrasados = cardsAtivos.filter(card => {
    const dueDate = obterDataComparacaoFlashcard(card?.due_date)
    return Boolean(dueDate) && dueDate < hoje
  }).length
  const cardsParaHoje = cardsAtivos.filter(card =>
    obterDataComparacaoFlashcard(card?.due_date) === hoje
  ).length

  return {
    totalCards: cardsAtivos.length,
    cardsHoje: cardsAtivos.filter(flashcardDevidoHoje).length,
    cardsAtrasados,
    cardsParaHoje,
    cardsNovos: cardsAtivos.filter(card => (card.estado || 'novo') === 'novo').length,
    cardsAprendendo: cardsAtivos.filter(card => card.estado === 'aprendendo').length,
    cardsRevisando: cardsAtivos.filter(card => card.estado === 'revisando').length,
    totalRevisoes,
    totalAcertos,
    taxaAcerto: totalRevisoes > 0 ? Math.round((totalAcertos / totalRevisoes) * 100) : 0,
    totalErros,
    sequenciaEstudos: calcularSequenciaEstudosFlashcards(revisoesLista)
  }
}

function definirTextoElementoFlashcards(id, texto) {
  const elemento = document.getElementById(id)
  if (elemento) elemento.textContent = String(texto)
}

function renderizarEstatisticasFlashcards(estatisticas = calcularEstatisticasFlashcards()) {
  definirTextoElementoFlashcards('flashcards-total-cards', estatisticas.totalCards || 0)
  definirTextoElementoFlashcards('flashcards-cards-hoje', estatisticas.cardsHoje || 0)
  definirTextoElementoFlashcards('flashcards-cards-atrasados', estatisticas.cardsAtrasados || 0)
  definirTextoElementoFlashcards('flashcards-cards-para-hoje', estatisticas.cardsParaHoje || 0)
  definirTextoElementoFlashcards('flashcards-cards-novos', estatisticas.cardsNovos || 0)
  definirTextoElementoFlashcards('flashcards-cards-aprendendo', estatisticas.cardsAprendendo || 0)
  definirTextoElementoFlashcards('flashcards-cards-revisando', estatisticas.cardsRevisando || 0)
  definirTextoElementoFlashcards('flashcards-total-revisoes', estatisticas.totalRevisoes || 0)
  definirTextoElementoFlashcards('flashcards-total-acertos', estatisticas.totalAcertos || 0)
  definirTextoElementoFlashcards('flashcards-taxa-acerto', `${estatisticas.taxaAcerto || 0}%`)
  definirTextoElementoFlashcards('flashcards-total-erros', estatisticas.totalErros || 0)
  definirTextoElementoFlashcards('flashcards-sequencia-estudos', estatisticas.sequenciaEstudos || 0)

  const msg = document.getElementById('msg-flashcards-estatisticas')
  if (msg) {
    msg.textContent = ''
    msg.className = 'msg-materia'
  }
}

function mostrarErroEstatisticasFlashcards(mensagem) {
  renderizarEstatisticasFlashcards()
  const msg = document.getElementById('msg-flashcards-estatisticas')
  if (!msg) return
  msg.textContent = mensagem
  msg.className = 'msg-materia erro'
}

async function carregarEstatisticasFlashcards() {
  const listarCards = globalThis.listarFlashcards || listarFlashcards
  const listarRevisoes = globalThis.listarRevisoesFlashcards || listarRevisoesFlashcards
  const [resultadoCards, resultadoRevisoes] = await Promise.all([
    listarCards(),
    listarRevisoes()
  ])

  const erro = resultadoCards.error || resultadoRevisoes.error
  if (erro) {
    const mensagem = erro.message || 'Nao foi possivel carregar as estatisticas dos flashcards. Verifique sua conexao e tente novamente.'
    mostrarErroEstatisticasFlashcards(mensagem)
    return { data: null, error: erro }
  }

  const estatisticas = calcularEstatisticasFlashcards(resultadoCards.data || [], resultadoRevisoes.data || [])
  renderizarEstatisticasFlashcards(estatisticas)
  return { data: estatisticas, error: null }
}

async function carregarMateriasFlashcards() {
  const listar = globalThis.listarMateriasFlashcards || listarMateriasFlashcards
  const resultado = await listar()

  if (resultado.error) {
    flashcardsMaterias = []
    atualizarSelectsMateriaFlashcards([])
    return resultado
  }

  flashcardsMaterias = resultado.data || []
  atualizarSelectsMateriaFlashcards(flashcardsMaterias)
  if (listaFlashcardsJaCarregada()) renderizarListaFlashcardsFiltrada()
  return resultado
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

  const verso = criarElementoVersoFlashcard(card.verso)
  versoArea.append(tituloVerso, verso)

  const avaliacao = document.createElement('div')
  avaliacao.id = 'flashcards-avaliacao-atual'
  avaliacao.className = 'revisao-tags'
  avaliacao.hidden = true

  const instrucao = document.createElement('p')
  instrucao.className = 'texto-apoio'
  instrucao.textContent = 'Avalie sua resposta de 0 a 5.'
  avaliacao.appendChild(instrucao)

  const legenda = document.createElement('p')
  legenda.className = 'texto-apoio'
  legenda.textContent = 'Como avaliar: 0-2: errei ou não lembrei - o card volta para revisar hoje. 3: acertei com dificuldade. 4: acertei bem. 5: acertei com facilidade - o intervalo aumenta mais.'
  avaliacao.appendChild(legenda)

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
    ? `${flashcardsSessaoHoje.length} card(s) vencido(s)/devido(s) para revisar.`
    : 'Nenhuma revisão pendente. Ótimo trabalho!'
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
  const preservarSessaoAtual = sessaoRevisaoFlashcardsEmAndamento()

  if (vazio) {
    vazio.hidden = false
    vazio.textContent = 'Carregando revisão urgente...'
  }
  if (areaCard && !preservarSessaoAtual) areaCard.replaceChildren()
  if (botaoIniciar) botaoIniciar.disabled = true

  const listar = globalThis.listarFlashcardsDevidosHoje || listarFlashcardsDevidosHoje
  const resultado = await listar()

  if (resultado.error) {
    flashcardsSessaoHoje = []
    flashcardAtualSessao = null
    flashcardsTotalSessaoHoje = 0
    flashcardsSessaoRevisaoAtiva = false
    if (areaCard) areaCard.replaceChildren()
    atualizarIndicadoresRevisaoFlashcards()
    mostrarMensagemRevisaoFlashcards(
      resultado.error.message || 'Nao foi possivel carregar seus flashcards de hoje. Verifique sua conexao e tente novamente.'
    )
    return resultado
  }

  const cardsDevidos = Array.isArray(resultado.data)
    ? resultado.data.filter(flashcardDevidoHoje)
    : []

  if (preservarSessaoAtual) {
    sincronizarSessaoRevisaoFlashcards(cardsDevidos)
  } else {
    flashcardsSessaoHoje = embaralharFlashcardsSessao(cardsDevidos)
    flashcardAtualSessao = null
    flashcardsTotalSessaoHoje = flashcardsSessaoHoje.length
    flashcardsSessaoRevisaoAtiva = false
  }

  renderizarRevisaoFlashcardsHoje()

  return { ...resultado, data: cardsDevidos }
}

function iniciarSessaoRevisaoFlashcards() {
  if (flashcardsSessaoHoje.length === 0) {
    renderizarRevisaoFlashcardsHoje()
    return { data: null, error: null }
  }

  flashcardsSessaoRevisaoAtiva = true
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

function rolarParaTopoDoFlashcardAtual() {
  const alvo = document.getElementById('flashcards-revisao-card') ||
    document.getElementById('flashcards-revisao-urgente')

  alvo?.scrollIntoView?.({ block: 'start' })
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
  if (!flashcardAtualSessao) flashcardsSessaoRevisaoAtiva = false
  renderizarRevisaoFlashcardsHoje()
  if (flashcardAtualSessao) rolarParaTopoDoFlashcardAtual()

  return {
    ...resposta,
    resultadoSM2
  }
}

async function carregarListaFlashcards() {
  const lista = document.getElementById('flashcards-lista')
  if (!lista) return { data: [], error: null }

  const primeiraCarga = !listaFlashcardsJaCarregada()
  lista.innerHTML = '<p class="texto-placeholder">Carregando flashcards...</p>'

  const listar = globalThis.listarFlashcards || listarFlashcards
  const resultado = await listar()

  if (resultado.error) {
    delete lista.dataset.flashcardsListaCarregada
    lista.innerHTML = '<p class="texto-placeholder">Nao foi possivel carregar seus flashcards. Verifique sua conexao e tente novamente.</p>'
    return resultado
  }

  flashcardsListaTodos = resultado.data || []
  if (primeiraCarga) resetarPaginacaoListaFlashcards()
  lista.dataset.flashcardsListaCarregada = 'true'
  renderizarListaFlashcardsFiltrada()
  return resultado
}

async function carregarListaFlashcardsSeNecessario() {
  if (listaFlashcardsJaCarregada()) {
    renderizarListaFlashcardsFiltrada()
    return { data: flashcardsListaTodos, error: null }
  }
  return carregarListaFlashcards()
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
  const payload = {
    frente: dados.frente,
    verso: dados.verso,
    tags: dados.tags
  }
  if (dados.materia_id) payload.materia_id = dados.materia_id

  const resultado = await criar(payload)

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
        if (botao.dataset.flashcardsAba === 'todos') carregarListaFlashcardsSeNecessario()
        if (botao.dataset.flashcardsAba === 'revisar-hoje') {
          carregarFlashcardsRevisarHoje()
          carregarEstudoDiaFlashcards()
        }
        if (botao.dataset.flashcardsAba === 'estatisticas') carregarEstatisticasFlashcards()
      })
    })
    secao.addEventListener('click', manipularCliqueFlashcards)
    document.getElementById('btn-salvar-flashcard')?.addEventListener('click', salvarFlashcardTela)
    inicializarFiltrosFlashcards(secao)
    flashcardsInicializado = true
  }

  atualizarIndicadoresFlashcardsVazios(document)
  renderizarEstudoDiaFlashcards()
  selecionarAbaFlashcards(ABA_FLASHCARDS_PADRAO, secao)
  carregarMateriasFlashcards()
  carregarFlashcardsRevisarHoje()
  carregarEstudoDiaFlashcards()
  carregarAlertaAcumuloFlashcards()
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

async function listarMateriasPlanejadasHojeFlashcards(dataReferencia = dataHojeFlashcards()) {
  let usuario
  try {
    usuario = await obterUsuarioAutenticadoFlashcards()
  } catch (erro) {
    return respostaErroFlashcards(erro.message, erro.detalhes)
  }

  const resposta = await obterClienteSupabaseFlashcards()
    .from('planejamento_semanal')
    .select('id, dia_semana, materia_id, materias(nome)')
    .eq('user_id', usuario.id)
    .eq('dia_semana', converterDiaSemanaFlashcards(dataReferencia))
    .order('ordem', { ascending: true })

  return tratarRespostaSupabaseFlashcards(
    resposta,
    'Nao foi possivel carregar as materias planejadas para hoje. Verifique sua conexao e tente novamente.'
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

async function listarRevisoesFlashcards() {
  let usuario
  try {
    usuario = await obterUsuarioAutenticadoFlashcards()
  } catch (erro) {
    return respostaErroFlashcards(erro.message, erro.detalhes)
  }

  const resposta = await obterClienteSupabaseFlashcards()
    .from('flashcard_reviews')
    .select(CAMPOS_REVISAO_FLASHCARD)
    .eq('user_id', usuario.id)
    .order('reviewed_at', { ascending: false })

  return tratarRespostaSupabaseFlashcards(
    resposta,
    'Nao foi possivel listar as revisoes dos flashcards. Verifique sua conexao e tente novamente.'
  )
}

async function listarMateriasFlashcards() {
  let usuario
  try {
    usuario = await obterUsuarioAutenticadoFlashcards()
  } catch (erro) {
    return respostaErroFlashcards(erro.message, erro.detalhes)
  }

  const resposta = await obterClienteSupabaseFlashcards()
    .from('materias')
    .select('id, nome')
    .eq('user_id', usuario.id)
    .order('nome', { ascending: true })

  return tratarRespostaSupabaseFlashcards(
    resposta,
    'Nao foi possivel carregar as materias dos flashcards. Verifique sua conexao e tente novamente.'
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
  globalThis.abrirEdicaoFlashcardLista = abrirEdicaoFlashcardLista
  globalThis.salvarEdicaoFlashcardLista = salvarEdicaoFlashcardLista
  globalThis.mostrarConfirmacaoDesativarFlashcardLista = mostrarConfirmacaoDesativarFlashcardLista
  globalThis.confirmarDesativacaoFlashcardLista = confirmarDesativacaoFlashcardLista
  globalThis.obterFiltrosFlashcards = obterFiltrosFlashcards
  globalThis.aplicarFiltrosFlashcards = aplicarFiltrosFlashcards
  globalThis.renderizarListaFlashcardsFiltrada = renderizarListaFlashcardsFiltrada
  globalThis.limparFiltrosFlashcards = limparFiltrosFlashcards
  globalThis.carregarListaFlashcards = carregarListaFlashcards
  globalThis.renderizarListaFlashcards = renderizarListaFlashcards
  globalThis.carregarFlashcardsRevisarHoje = carregarFlashcardsRevisarHoje
  globalThis.iniciarSessaoRevisaoFlashcards = iniciarSessaoRevisaoFlashcards
  globalThis.mostrarRespostaFlashcardAtual = mostrarRespostaFlashcardAtual
  globalThis.avaliarFlashcardAtual = avaliarFlashcardAtual
  globalThis.renderizarRevisaoFlashcardsHoje = renderizarRevisaoFlashcardsHoje
  globalThis.renderizarEstudoDiaFlashcards = renderizarEstudoDiaFlashcards
  globalThis.carregarEstudoDiaFlashcards = carregarEstudoDiaFlashcards
  globalThis.renderizarAlertaAcumuloFlashcards = renderizarAlertaAcumuloFlashcards
  globalThis.carregarAlertaAcumuloFlashcards = carregarAlertaAcumuloFlashcards
  globalThis.contarCardsAcumuladosFlashcards = contarCardsAcumuladosFlashcards
  globalThis.navegarParaRevisaoUrgenteFlashcards = navegarParaRevisaoUrgenteFlashcards
  globalThis.selecionarCardsNovosEstudoDiaFlashcards = selecionarCardsNovosEstudoDiaFlashcards
  globalThis.extrairCamposRicosDoVersoFlashcard = extrairCamposRicosDoVersoFlashcard
  globalThis.calcularProximaRevisaoSM2Flashcards = calcularProximaRevisaoSM2Flashcards
  globalThis.calcularEstatisticasFlashcards = calcularEstatisticasFlashcards
  globalThis.renderizarEstatisticasFlashcards = renderizarEstatisticasFlashcards
  globalThis.carregarEstatisticasFlashcards = carregarEstatisticasFlashcards
  globalThis.criarFlashcard = criarFlashcard
  globalThis.listarFlashcards = listarFlashcards
  globalThis.listarMateriasPlanejadasHojeFlashcards = listarMateriasPlanejadasHojeFlashcards
  globalThis.listarFlashcardsDevidosHoje = listarFlashcardsDevidosHoje
  globalThis.listarRevisoesFlashcards = listarRevisoesFlashcards
  globalThis.listarMateriasFlashcards = listarMateriasFlashcards
  globalThis.carregarMateriasFlashcards = carregarMateriasFlashcards
  globalThis.atualizarFlashcard = atualizarFlashcard
  globalThis.desativarFlashcard = desativarFlashcard
  globalThis.registrarRevisaoFlashcard = registrarRevisaoFlashcard
}
