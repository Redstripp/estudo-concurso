// js/anotacoes-ui.js

const ID_RAIZ_ANOTACOES_UI = 'anotacoes-ui'
const documentosComAtalhoAnotacoesUi = new WeakSet()
const janelasComEventosAnotacoesUi = new WeakSet()
const botoesMenuComAnotacoesUi = new WeakSet()
const estadosAnotacoesUi = new WeakMap()
let sequenciaTracosAnotacoesUi = 0

const USUARIO_ANOTACOES_UI = 'anonimo'
const VIEW_ID_PADRAO_ANOTACOES_UI = 'secao:desconhecida'
const MAX_PONTOS_TRACO_ANOTACOES_UI = 1000
const CHAVE_POSICAO_ANOTACOES_UI = 'estudoConcursoAnotacoesUiPosicao:v1'
const DISTANCIA_MINIMA_ARRASTE_ANOTACOES_UI = 6
const MARGEM_POSICAO_ANOTACOES_UI = 8
const LARGURA_PADRAO_TOGGLE_ANOTACOES_UI = 120
const ALTURA_PADRAO_TOGGLE_ANOTACOES_UI = 42
const LARGURA_PADRAO_TOOLBAR_ANOTACOES_UI = 560
const ALTURA_PADRAO_TOOLBAR_ANOTACOES_UI = 56

const CORES_CANVAS_ANOTACOES_UI = {
  black: '#111827',
  red: '#dc2626',
  blue: '#2563eb',
  green: '#16a34a',
  yellow: '#facc15',
  white: '#ffffff'
}

const ESPESSURAS_CANVAS_ANOTACOES_UI = {
  thin: 2,
  medium: 4,
  thick: 7
}

const OPACIDADE_MARCA_TEXTO_ANOTACOES_UI = 0.35
const FERRAMENTAS_DESENHO_ANOTACOES_UI = new Set(['pen', 'highlighter', 'eraser'])

const FERRAMENTAS_ANOTACOES_UI = [
  { valor: 'pen', rotulo: 'Lapis', icone: 'L' },
  { valor: 'highlighter', rotulo: 'Marca-texto', icone: 'M' },
  { valor: 'eraser', rotulo: 'Borracha', icone: 'B' }
]

const CORES_ANOTACOES_UI = [
  { valor: 'black', rotulo: 'Preto' },
  { valor: 'red', rotulo: 'Vermelho' },
  { valor: 'blue', rotulo: 'Azul' },
  { valor: 'green', rotulo: 'Verde' },
  { valor: 'yellow', rotulo: 'Amarelo' },
  { valor: 'white', rotulo: 'Branco' }
]

const ESPESSURAS_ANOTACOES_UI = [
  { valor: 'thin', rotulo: 'Fino' },
  { valor: 'medium', rotulo: 'Medio' },
  { valor: 'thick', rotulo: 'Grosso' }
]

function criarBotaoAnotacoesUi({ classe, rotulo, texto, grupo, valor }) {
  const botao = document.createElement('button')
  botao.type = 'button'
  botao.className = classe
  botao.setAttribute('aria-label', rotulo)
  botao.title = rotulo
  botao.textContent = texto

  if (grupo) {
    botao.dataset.grupoAnotacoes = grupo
    botao.dataset.valorAnotacoes = valor
    botao.setAttribute('aria-pressed', 'false')
  }

  return botao
}

function criarGrupoAnotacoesUi(rotulo) {
  const grupo = document.createElement('div')
  grupo.className = 'anotacoes-toolbar-grupo'
  grupo.setAttribute('role', 'group')
  grupo.setAttribute('aria-label', rotulo)
  return grupo
}

function criarToolbarAnotacoesUi() {
  const toolbar = document.createElement('div')
  toolbar.id = 'anotacoes-toolbar'
  toolbar.className = 'anotacoes-toolbar'
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', 'Controles de anotacoes livres')
  toolbar.hidden = true

  const ferramentas = criarGrupoAnotacoesUi('Ferramentas')
  FERRAMENTAS_ANOTACOES_UI.forEach(({ valor, rotulo, icone }) => {
    ferramentas.appendChild(criarBotaoAnotacoesUi({
      classe: 'anotacoes-controle anotacoes-controle--ferramenta',
      rotulo,
      texto: icone,
      grupo: 'ferramenta',
      valor
    }))
  })

  const cores = criarGrupoAnotacoesUi('Cores')
  CORES_ANOTACOES_UI.forEach(({ valor, rotulo }) => {
    const botao = criarBotaoAnotacoesUi({
      classe: `anotacoes-controle anotacoes-cor anotacoes-cor--${valor}`,
      rotulo: `Cor ${rotulo.toLowerCase()}`,
      texto: '',
      grupo: 'cor',
      valor
    })
    cores.appendChild(botao)
  })

  const espessuras = criarGrupoAnotacoesUi('Espessuras')
  ESPESSURAS_ANOTACOES_UI.forEach(({ valor, rotulo }) => {
    const botao = criarBotaoAnotacoesUi({
      classe: `anotacoes-controle anotacoes-espessura anotacoes-espessura--${valor}`,
      rotulo: `Espessura ${rotulo.toLowerCase()}`,
      texto: '',
      grupo: 'espessura',
      valor
    })
    const linha = document.createElement('span')
    linha.className = 'anotacoes-espessura-linha'
    linha.setAttribute('aria-hidden', 'true')
    botao.appendChild(linha)
    espessuras.appendChild(botao)
  })

  const limpar = criarBotaoAnotacoesUi({
    classe: 'anotacoes-controle anotacoes-controle--limpar',
    rotulo: 'Limpar anotacoes da secao atual',
    texto: 'Limpar'
  })
  limpar.setAttribute('aria-disabled', 'true')
  limpar.disabled = true

  toolbar.append(ferramentas, cores, espessuras, limpar)
  return toolbar
}

function obterRaizAnotacoesUi() {
  return document.getElementById(ID_RAIZ_ANOTACOES_UI)
}

function obterSecaoAtivaAnotacoesUi() {
  return document.querySelector('.secao:not(.escondido)') || null
}

function obterViewIdAnotacoesUi(secao = obterSecaoAtivaAnotacoesUi()) {
  const id = secao?.id || ''
  return id.startsWith('secao:') || !id.startsWith('secao-')
    ? VIEW_ID_PADRAO_ANOTACOES_UI
    : `secao:${id.slice('secao-'.length)}`
}

function obterEstadoRuntimeAnotacoesUi(raiz = obterRaizAnotacoesUi()) {
  return raiz ? estadosAnotacoesUi.get(raiz) : null
}

function obterEstadoAnotacoesUi() {
  const raiz = obterRaizAnotacoesUi()
  if (!raiz) return null
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)

  return {
    ativo: raiz.dataset.ativo === 'true',
    ferramenta: raiz.dataset.ferramenta,
    cor: raiz.dataset.cor,
    espessura: raiz.dataset.espessura,
    viewId: runtime?.viewId || VIEW_ID_PADRAO_ANOTACOES_UI,
    quantidadeTracos: runtime?.estado?.strokes?.length || 0
  }
}

function obterBotaoLimparAnotacoesUi(raiz = obterRaizAnotacoesUi()) {
  return raiz?.querySelector('.anotacoes-controle--limpar') || null
}

function atualizarEstadoLimparAnotacoesUi(raiz = obterRaizAnotacoesUi()) {
  const botao = obterBotaoLimparAnotacoesUi(raiz)
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  if (!botao) return

  const habilitado = (runtime?.estado?.strokes?.length || 0) > 0
  botao.disabled = !habilitado
  botao.setAttribute('aria-disabled', String(!habilitado))
  botao.title = habilitado
    ? 'Limpar anotacoes da secao atual'
    : 'Sem anotacoes para limpar nesta secao'
}

function obterLarguraReferenciaAnotacoesUi(secao) {
  return secao?.scrollWidth
    || secao?.getBoundingClientRect?.().width
    || window.innerWidth
    || 1200
}

function carregarEstadoSecaoAnotacoesUi(viewId, secao) {
  const modelo = globalThis.AnotacoesLivres
  if (!modelo?.carregarAnotacoes) return { strokes: [] }

  return modelo.carregarAnotacoes({
    userId: USUARIO_ANOTACOES_UI,
    viewId,
    referenceWidth: obterLarguraReferenciaAnotacoesUi(secao)
  })
}

function obterContextoCanvasAnotacoesUi(canvas) {
  try {
    return canvas?.getContext?.('2d') || null
  } catch {
    return null
  }
}

function obterDprAnotacoesUi() {
  const dpr = Number(window.devicePixelRatio)
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1
}

function obterDimensoesViewportAnotacoesUi() {
  return {
    largura: Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || 1)),
    altura: Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || 1))
  }
}

function ajustarCanvasAnotacoesUi(raiz = obterRaizAnotacoesUi()) {
  const canvas = raiz?.querySelector('#anotacoes-canvas')
  if (!canvas) return

  const { largura, altura } = obterDimensoesViewportAnotacoesUi()
  const dpr = obterDprAnotacoesUi()

  canvas.width = Math.round(largura * dpr)
  canvas.height = Math.round(altura * dpr)
  canvas.style.width = `${largura}px`
  canvas.style.height = `${altura}px`

  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  if (runtime) runtime.temDesenhoRenderizado = false

  const contexto = obterContextoCanvasAnotacoesUi(canvas)
  contexto?.setTransform?.(dpr, 0, 0, dpr, 0, 0)
}

function obterRetanguloNormalizadoAnotacoesUi(elemento) {
  const retangulo = elemento?.getBoundingClientRect?.()
  if (!retangulo) return null

  const left = Number(retangulo.left)
  const top = Number(retangulo.top)
  const right = Number.isFinite(Number(retangulo.right))
    ? Number(retangulo.right)
    : left + Number(retangulo.width)
  const bottom = Number.isFinite(Number(retangulo.bottom))
    ? Number(retangulo.bottom)
    : top + Number(retangulo.height)

  if (![left, top, right, bottom].every(Number.isFinite)) return null
  return { left, top, right, bottom }
}

function obterStoragePosicaoAnotacoesUi() {
  try {
    return window.localStorage || globalThis.localStorage || null
  } catch {
    return null
  }
}

function carregarPosicoesAnotacoesUi() {
  const storage = obterStoragePosicaoAnotacoesUi()
  if (!storage?.getItem) return {}

  try {
    const bruto = storage.getItem(CHAVE_POSICAO_ANOTACOES_UI)
    const posicoes = bruto ? JSON.parse(bruto) : {}
    return posicoes && typeof posicoes === 'object' && !Array.isArray(posicoes) ? posicoes : {}
  } catch {
    return {}
  }
}

function salvarPosicoesAnotacoesUi(posicoes) {
  const storage = obterStoragePosicaoAnotacoesUi()
  if (!storage?.setItem) return false

  try {
    storage.setItem(CHAVE_POSICAO_ANOTACOES_UI, JSON.stringify(posicoes))
    return true
  } catch {
    return false
  }
}

function obterPerfilViewportAnotacoesUi() {
  return obterDimensoesViewportAnotacoesUi().largura <= 768 ? 'mobile' : 'desktop'
}

function normalizarPosicaoSalvaAnotacoesUi(posicao) {
  const x = Number(posicao?.x)
  const y = Number(posicao?.y)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

function obterDimensoesElementoAnotacoesUi(elemento, fallback) {
  const retangulo = obterRetanguloNormalizadoAnotacoesUi(elemento)
  const largura = retangulo ? retangulo.right - retangulo.left : Number(elemento?.offsetWidth)
  const altura = retangulo ? retangulo.bottom - retangulo.top : Number(elemento?.offsetHeight)

  return {
    largura: Number.isFinite(largura) && largura > 0 ? largura : fallback.largura,
    altura: Number.isFinite(altura) && altura > 0 ? altura : fallback.altura
  }
}

function limitarPosicaoElementoAnotacoesUi(posicao, elemento, fallback) {
  const { largura, altura } = obterDimensoesViewportAnotacoesUi()
  const dimensoes = obterDimensoesElementoAnotacoesUi(elemento, fallback)
  const maxX = Math.max(MARGEM_POSICAO_ANOTACOES_UI, largura - dimensoes.largura - MARGEM_POSICAO_ANOTACOES_UI)
  const maxY = Math.max(MARGEM_POSICAO_ANOTACOES_UI, altura - dimensoes.altura - MARGEM_POSICAO_ANOTACOES_UI)
  const x = Number(posicao?.x)
  const y = Number(posicao?.y)

  return {
    x: Math.round(Math.min(maxX, Math.max(MARGEM_POSICAO_ANOTACOES_UI, Number.isFinite(x) ? x : MARGEM_POSICAO_ANOTACOES_UI))),
    y: Math.round(Math.min(maxY, Math.max(MARGEM_POSICAO_ANOTACOES_UI, Number.isFinite(y) ? y : MARGEM_POSICAO_ANOTACOES_UI)))
  }
}

function aplicarPosicaoToggleAnotacoesUi(toggle, posicao) {
  toggle.style.left = `${posicao.x}px`
  toggle.style.top = `${posicao.y}px`
  toggle.style.right = 'auto'
  toggle.style.bottom = 'auto'
}

function limparPosicaoToggleAnotacoesUi(toggle) {
  toggle.style.left = ''
  toggle.style.top = ''
  toggle.style.right = ''
  toggle.style.bottom = ''
}

function obterPosicaoAtualToggleAnotacoesUi(toggle) {
  const retangulo = obterRetanguloNormalizadoAnotacoesUi(toggle)
  return {
    x: retangulo?.left ?? MARGEM_POSICAO_ANOTACOES_UI,
    y: retangulo?.top ?? MARGEM_POSICAO_ANOTACOES_UI
  }
}

function salvarPosicaoToggleAnotacoesUi(posicao, perfil = obterPerfilViewportAnotacoesUi()) {
  const posicoes = carregarPosicoesAnotacoesUi()
  posicoes[perfil] = {
    x: Math.round(posicao.x),
    y: Math.round(posicao.y),
    updatedAt: new Date().toISOString()
  }
  return salvarPosicoesAnotacoesUi(posicoes)
}

function posicaoDiferenteAnotacoesUi(a, b) {
  return Math.round(a?.x) !== Math.round(b?.x) || Math.round(a?.y) !== Math.round(b?.y)
}

function posicionarToolbarAnotacoesUi(raiz = obterRaizAnotacoesUi()) {
  const toggle = raiz?.querySelector('#btn-anotacoes-toggle')
  const toolbar = raiz?.querySelector('#anotacoes-toolbar')
  const retanguloToggle = obterRetanguloNormalizadoAnotacoesUi(toggle)
  if (!toggle || !toolbar || !retanguloToggle) return

  const { largura, altura } = obterDimensoesViewportAnotacoesUi()
  const dimensoesToolbar = obterDimensoesElementoAnotacoesUi(toolbar, {
    largura: LARGURA_PADRAO_TOOLBAR_ANOTACOES_UI,
    altura: ALTURA_PADRAO_TOOLBAR_ANOTACOES_UI
  })
  const espaco = 10
  const abreAcima = retanguloToggle.top - dimensoesToolbar.altura - espaco >= MARGEM_POSICAO_ANOTACOES_UI
  const topDesejado = abreAcima
    ? retanguloToggle.top - dimensoesToolbar.altura - espaco
    : retanguloToggle.bottom + espaco
  const maxLeft = Math.max(MARGEM_POSICAO_ANOTACOES_UI, largura - dimensoesToolbar.largura - MARGEM_POSICAO_ANOTACOES_UI)
  const maxTop = Math.max(MARGEM_POSICAO_ANOTACOES_UI, altura - dimensoesToolbar.altura - MARGEM_POSICAO_ANOTACOES_UI)
  const left = Math.round(Math.min(maxLeft, Math.max(MARGEM_POSICAO_ANOTACOES_UI, retanguloToggle.left)))
  const top = Math.round(Math.min(maxTop, Math.max(MARGEM_POSICAO_ANOTACOES_UI, topDesejado)))

  toolbar.style.left = `${left}px`
  toolbar.style.top = `${top}px`
  toolbar.style.right = 'auto'
  toolbar.style.bottom = 'auto'
  toolbar.dataset.direcao = abreAcima ? 'acima' : 'abaixo'
}

function aplicarPosicaoSalvaAnotacoesUi(raiz = obterRaizAnotacoesUi(), { salvarLimitada = false } = {}) {
  const toggle = raiz?.querySelector('#btn-anotacoes-toggle')
  if (!toggle) return

  const perfil = obterPerfilViewportAnotacoesUi()
  const posicaoSalva = normalizarPosicaoSalvaAnotacoesUi(carregarPosicoesAnotacoesUi()[perfil])
  if (!posicaoSalva) {
    limparPosicaoToggleAnotacoesUi(toggle)
    posicionarToolbarAnotacoesUi(raiz)
    return
  }

  const limitada = limitarPosicaoElementoAnotacoesUi(posicaoSalva, toggle, {
    largura: LARGURA_PADRAO_TOGGLE_ANOTACOES_UI,
    altura: ALTURA_PADRAO_TOGGLE_ANOTACOES_UI
  })
  aplicarPosicaoToggleAnotacoesUi(toggle, limitada)
  if (salvarLimitada && posicaoDiferenteAnotacoesUi(posicaoSalva, limitada)) {
    salvarPosicaoToggleAnotacoesUi(limitada, perfil)
  }
  posicionarToolbarAnotacoesUi(raiz)
}

function elementoVisivelAnotacoesUi(elemento) {
  if (!elemento) return false
  const estilo = typeof window.getComputedStyle === 'function'
    ? window.getComputedStyle(elemento)
    : null
  return estilo?.display !== 'none'
    && estilo?.visibility !== 'hidden'
    && estilo?.opacity !== '0'
}

function obterLimiteSuperiorGlobalAnotacoesUi(alturaViewport) {
  const header = document.querySelector('.header-mobile')
  const retangulo = elementoVisivelAnotacoesUi(header)
    ? obterRetanguloNormalizadoAnotacoesUi(header)
    : null
  if (!retangulo || retangulo.bottom <= 0 || retangulo.top >= alturaViewport) return 0
  return Math.min(alturaViewport, Math.max(0, retangulo.bottom))
}

function obterAreaDesenhavelAnotacoesUi(secao) {
  const retangulo = obterRetanguloNormalizadoAnotacoesUi(secao)
  if (!retangulo) return null

  const { largura, altura } = obterDimensoesViewportAnotacoesUi()
  const left = Math.max(0, retangulo.left)
  const top = Math.max(0, retangulo.top, obterLimiteSuperiorGlobalAnotacoesUi(altura))
  const right = Math.min(largura, retangulo.right)
  const bottom = Math.min(altura, retangulo.bottom)

  if (right <= left || bottom <= top) return null
  return { left, top, right, bottom }
}

function atualizarAreaInterativaCanvasAnotacoesUi(raiz = obterRaizAnotacoesUi()) {
  const canvas = raiz?.querySelector('#anotacoes-canvas')
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  if (!canvas || !runtime) return null

  const area = obterAreaDesenhavelAnotacoesUi(runtime.secao)
  const { largura, altura } = obterDimensoesViewportAnotacoesUi()
  runtime.areaDesenhavel = area

  if (!area) {
    canvas.style.clipPath = 'inset(100% 0 0 0)'
    return null
  }

  const top = Math.max(0, Math.round(area.top))
  const right = Math.max(0, Math.round(largura - area.right))
  const bottom = Math.max(0, Math.round(altura - area.bottom))
  const left = Math.max(0, Math.round(area.left))
  canvas.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`
  return area
}

function pontoEstaNaAreaDesenhavelAnotacoesUi(evento, secao) {
  if (!Number.isFinite(evento?.clientX) || !Number.isFinite(evento?.clientY)) return false
  const area = atualizarAreaInterativaCanvasAnotacoesUi()
    || obterAreaDesenhavelAnotacoesUi(secao)
  if (!area) return false
  return evento.clientX >= area.left
    && evento.clientX <= area.right
    && evento.clientY >= area.top
    && evento.clientY <= area.bottom
}

function obterPontoConteudoAnotacoesUi(evento, secao) {
  if (!secao || !Number.isFinite(evento?.clientX) || !Number.isFinite(evento?.clientY)) return null
  if (!pontoEstaNaAreaDesenhavelAnotacoesUi(evento, secao)) return null
  const retangulo = obterRetanguloNormalizadoAnotacoesUi(secao)
  if (!retangulo) return null

  const x = evento.clientX - retangulo.left + (secao.scrollLeft || 0)
  const y = evento.clientY - retangulo.top + (secao.scrollTop || 0)
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return null
  return { x, y }
}

function obterPontoViewportAnotacoesUi(ponto, secao) {
  const retangulo = secao?.getBoundingClientRect?.()
  if (!retangulo) return null
  return {
    x: retangulo.left - (secao.scrollLeft || 0) + ponto.x,
    y: retangulo.top - (secao.scrollTop || 0) + ponto.y
  }
}

function configurarContextoTracoAnotacoesUi(contexto, traco) {
  const usandoBorracha = traco.tool === 'eraser'
  contexto.globalCompositeOperation = usandoBorracha ? 'destination-out' : 'source-over'
  contexto.strokeStyle = usandoBorracha
    ? CORES_CANVAS_ANOTACOES_UI.black
    : CORES_CANVAS_ANOTACOES_UI[traco.color] || CORES_CANVAS_ANOTACOES_UI.black
  contexto.lineWidth = ESPESSURAS_CANVAS_ANOTACOES_UI[traco.thickness] || ESPESSURAS_CANVAS_ANOTACOES_UI.medium
  contexto.lineCap = 'round'
  contexto.lineJoin = 'round'
  contexto.globalAlpha = usandoBorracha ? 1 : traco.opacity ?? 1
}

function ferramentaDesenhaTracoAnotacoesUi(ferramenta) {
  return FERRAMENTAS_DESENHO_ANOTACOES_UI.has(ferramenta)
}

function obterOpacidadeFerramentaAnotacoesUi(ferramenta) {
  return ferramenta === 'highlighter' ? OPACIDADE_MARCA_TEXTO_ANOTACOES_UI : 1
}

function obterCorFerramentaAnotacoesUi(ferramenta, corSelecionada) {
  return ferramenta === 'eraser' ? 'black' : corSelecionada
}

function desenharTracoAnotacoesUi(contexto, traco, secao) {
  if (!contexto || !ferramentaDesenhaTracoAnotacoesUi(traco?.tool) || !Array.isArray(traco.points) || traco.points.length < 2) return
  const pontos = traco.points.map(ponto => obterPontoViewportAnotacoesUi(ponto, secao)).filter(Boolean)
  if (pontos.length < 2) return

  contexto.save?.()
  configurarContextoTracoAnotacoesUi(contexto, traco)
  contexto.beginPath()
  contexto.moveTo(pontos[0].x, pontos[0].y)
  pontos.slice(1).forEach(ponto => contexto.lineTo(ponto.x, ponto.y))
  contexto.stroke()
  contexto.restore?.()
}

function redesenharAnotacoesUi(raiz = obterRaizAnotacoesUi()) {
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  const canvas = raiz?.querySelector('#anotacoes-canvas')
  if (!runtime || !canvas) return

  const tracos = [...(runtime.estado?.strokes || [])]
  if (runtime.tracoAtual) tracos.push(runtime.tracoAtual)
  if (tracos.length === 0 && !runtime.temDesenhoRenderizado) return

  const contexto = obterContextoCanvasAnotacoesUi(canvas)
  if (!contexto) return

  const dpr = obterDprAnotacoesUi()
  contexto.setTransform?.(dpr, 0, 0, dpr, 0, 0)
  contexto.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
  tracos.forEach(traco => desenharTracoAnotacoesUi(contexto, traco, runtime.secao))
  runtime.temDesenhoRenderizado = tracos.length > 0
}

function agendarRedesenhoAnotacoesUi({ ajustarCanvas = false } = {}) {
  const raiz = obterRaizAnotacoesUi()
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  if (!runtime) return

  runtime.ajustarCanvasPendente ||= ajustarCanvas
  if (runtime.rafId !== null) return

  const agendar = typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window)
    : callback => setTimeout(callback, 0)

  runtime.rafId = agendar(() => {
    runtime.rafId = null
    if (runtime.ajustarCanvasPendente) {
      ajustarCanvasAnotacoesUi(raiz)
    }
    runtime.ajustarCanvasPendente = false
    atualizarAreaInterativaCanvasAnotacoesUi(raiz)
    redesenharAnotacoesUi(raiz)
  })
}

function cancelarTracoAtualAnotacoesUi(raiz = obterRaizAnotacoesUi()) {
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  if (!runtime?.tracoAtual) return
  runtime.tracoAtual = null
  runtime.pointerId = null
  redesenharAnotacoesUi(raiz)
}

function atualizarSecaoAnotacoesUi(raiz = obterRaizAnotacoesUi()) {
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  if (!runtime) return VIEW_ID_PADRAO_ANOTACOES_UI

  const secaoAtiva = obterSecaoAtivaAnotacoesUi()
  const secao = secaoAtiva || document.querySelector('.conteudo-principal') || document.documentElement
  const viewId = obterViewIdAnotacoesUi(secaoAtiva)
  if (runtime.viewId === viewId && runtime.secao === secao) return viewId

  runtime.tracoAtual = null
  runtime.pointerId = null
  runtime.secao = secao
  runtime.viewId = viewId
  runtime.estado = carregarEstadoSecaoAnotacoesUi(viewId, secao)
  raiz.dataset.viewId = viewId
  atualizarAreaInterativaCanvasAnotacoesUi(raiz)
  redesenharAnotacoesUi(raiz)
  atualizarEstadoLimparAnotacoesUi(raiz)
  return viewId
}

function atualizarSelecaoAnotacoesUi(raiz, grupo, valor) {
  raiz.dataset[grupo] = valor
  raiz.querySelectorAll(`[data-grupo-anotacoes="${grupo}"]`).forEach(botao => {
    const selecionado = botao.dataset.valorAnotacoes === valor
    botao.classList.toggle('is-selected', selecionado)
    botao.setAttribute('aria-pressed', String(selecionado))
  })
}

function definirModoAnotacoesUi(ativo) {
  const raiz = obterRaizAnotacoesUi()
  if (!raiz) return false

  const modoAtivo = Boolean(ativo)
  const toggle = raiz.querySelector('#btn-anotacoes-toggle')
  const toolbar = raiz.querySelector('#anotacoes-toolbar')
  const canvas = raiz.querySelector('#anotacoes-canvas')

  raiz.dataset.ativo = String(modoAtivo)
  raiz.classList.toggle('anotacoes-ui--ativa', modoAtivo)
  toggle.classList.toggle('is-active', modoAtivo)
  toggle.setAttribute('aria-pressed', String(modoAtivo))
  toggle.setAttribute('aria-label', modoAtivo ? 'Desativar anotacoes livres' : 'Ativar anotacoes livres')
  toggle.title = modoAtivo ? 'Desativar anotacoes livres' : 'Ativar anotacoes livres'
  toolbar.hidden = !modoAtivo
  if (modoAtivo) posicionarToolbarAnotacoesUi(raiz)
  canvas.classList.toggle('anotacoes-canvas--ativa', modoAtivo)
  canvas.style.pointerEvents = modoAtivo ? 'auto' : 'none'
  atualizarAreaInterativaCanvasAnotacoesUi(raiz)
  document.body.classList.toggle('modo-anotacoes-ativo', modoAtivo)
  if (!modoAtivo) cancelarTracoAtualAnotacoesUi(raiz)
  return modoAtivo
}

function elementoEditavelAnotacoesUi(elemento) {
  if (!elemento || elemento === document) return false
  if (elemento.isContentEditable) return true
  return Boolean(elemento.closest?.('input, textarea, select, [contenteditable]'))
}

function existeModalVisivelAnotacoesUi() {
  return Array.from(document.querySelectorAll('.modal-overlay')).some(modal => {
    return !modal.hidden
      && modal.getAttribute('aria-hidden') !== 'true'
      && modal.style.display !== 'none'
  })
}

function tratarEscapeAnotacoesUi(evento) {
  if (evento.key !== 'Escape') return
  if (!obterEstadoAnotacoesUi()?.ativo) return
  if (elementoEditavelAnotacoesUi(evento.target)) return
  if (existeModalVisivelAnotacoesUi()) return
  definirModoAnotacoesUi(false)
}

function podeIniciarTracoAnotacoesUi(evento, raiz) {
  const estado = obterEstadoAnotacoesUi()
  if (!estado?.ativo || !ferramentaDesenhaTracoAnotacoesUi(estado.ferramenta)) return false
  if (evento?.isPrimary === false) return false
  if (!Number.isFinite(evento?.pointerId)) return false
  if (Number.isFinite(evento?.button) && evento.button !== 0) return false
  return Boolean(obterEstadoRuntimeAnotacoesUi(raiz)?.secao)
}

function adicionarPontoTracoAnotacoesUi(runtime, ponto) {
  if (!ponto || !runtime?.tracoAtual) return false
  if (runtime.tracoAtual.points.length >= MAX_PONTOS_TRACO_ANOTACOES_UI) return false
  const ultimo = runtime.tracoAtual.points.at(-1)
  if (ultimo?.x === ponto.x && ultimo?.y === ponto.y) return false
  runtime.tracoAtual.points.push(ponto)
  return true
}

function alterarCapturaPointerAnotacoesUi(elemento, metodo, pointerId) {
  try {
    elemento?.[metodo]?.(pointerId)
  } catch {
    // A captura pode nao existir ou ja ter sido liberada pelo navegador.
  }
}

function iniciarArrasteToggleAnotacoesUi(evento) {
  if (evento?.isPrimary === false) return
  if (!Number.isFinite(evento?.pointerId)) return
  if (Number.isFinite(evento?.button) && evento.button !== 0) return
  if (!Number.isFinite(evento?.clientX) || !Number.isFinite(evento?.clientY)) return

  const raiz = obterRaizAnotacoesUi()
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  if (!runtime) return

  runtime.arrasteToggle = {
    arrastando: false,
    inicioX: evento.clientX,
    inicioY: evento.clientY,
    origem: obterPosicaoAtualToggleAnotacoesUi(evento.currentTarget),
    pointerId: evento.pointerId,
    ultimaPosicao: null
  }
  alterarCapturaPointerAnotacoesUi(evento.currentTarget, 'setPointerCapture', evento.pointerId)
}

function continuarArrasteToggleAnotacoesUi(evento) {
  const raiz = obterRaizAnotacoesUi()
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  const arraste = runtime?.arrasteToggle
  if (!arraste || arraste.pointerId !== evento.pointerId) return

  const dx = evento.clientX - arraste.inicioX
  const dy = evento.clientY - arraste.inicioY
  if (!arraste.arrastando && Math.hypot(dx, dy) < DISTANCIA_MINIMA_ARRASTE_ANOTACOES_UI) return

  arraste.arrastando = true
  evento.currentTarget.classList.add('is-dragging')
  const posicao = limitarPosicaoElementoAnotacoesUi({
    x: arraste.origem.x + dx,
    y: arraste.origem.y + dy
  }, evento.currentTarget, {
    largura: LARGURA_PADRAO_TOGGLE_ANOTACOES_UI,
    altura: ALTURA_PADRAO_TOGGLE_ANOTACOES_UI
  })
  arraste.ultimaPosicao = posicao
  aplicarPosicaoToggleAnotacoesUi(evento.currentTarget, posicao)
  posicionarToolbarAnotacoesUi(raiz)
  evento.preventDefault?.()
}

function finalizarArrasteToggleAnotacoesUi(evento) {
  const raiz = obterRaizAnotacoesUi()
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  const arraste = runtime?.arrasteToggle
  if (!arraste || arraste.pointerId !== evento.pointerId) return

  alterarCapturaPointerAnotacoesUi(evento.currentTarget, 'releasePointerCapture', evento.pointerId)
  evento.currentTarget.classList.remove('is-dragging')
  runtime.arrasteToggle = null

  if (!arraste.arrastando) return

  runtime.suprimirCliqueToggle = true
  salvarPosicaoToggleAnotacoesUi(arraste.ultimaPosicao || obterPosicaoAtualToggleAnotacoesUi(evento.currentTarget))
  evento.preventDefault?.()
}

function cancelarArrasteToggleAnotacoesUi(evento) {
  const runtime = obterEstadoRuntimeAnotacoesUi()
  const arraste = runtime?.arrasteToggle
  if (!arraste || arraste.pointerId !== evento.pointerId) return

  alterarCapturaPointerAnotacoesUi(evento.currentTarget, 'releasePointerCapture', evento.pointerId)
  evento.currentTarget.classList.remove('is-dragging')
  runtime.arrasteToggle = null
}

function iniciarTracoAnotacoesUi(evento) {
  const raiz = obterRaizAnotacoesUi()
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  if (!runtime || !podeIniciarTracoAnotacoesUi(evento, raiz)) return

  const ponto = obterPontoConteudoAnotacoesUi(evento, runtime.secao)
  if (!ponto) return

  runtime.pointerId = evento.pointerId
  const ferramenta = raiz.dataset.ferramenta
  runtime.tracoAtual = {
    id: `traco-${Date.now()}-${++sequenciaTracosAnotacoesUi}`,
    tool: ferramenta,
    color: obterCorFerramentaAnotacoesUi(ferramenta, raiz.dataset.cor),
    thickness: raiz.dataset.espessura,
    opacity: obterOpacidadeFerramentaAnotacoesUi(ferramenta),
    points: [ponto],
    createdAt: new Date().toISOString()
  }
  alterarCapturaPointerAnotacoesUi(evento.currentTarget, 'setPointerCapture', evento.pointerId)
  evento.preventDefault?.()
}

function continuarTracoAnotacoesUi(evento) {
  const raiz = obterRaizAnotacoesUi()
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  if (!runtime?.tracoAtual || runtime.pointerId !== evento.pointerId) return

  const ponto = obterPontoConteudoAnotacoesUi(evento, runtime.secao)
  if (!adicionarPontoTracoAnotacoesUi(runtime, ponto)) return
  redesenharAnotacoesUi(raiz)
  evento.preventDefault?.()
}

function finalizarTracoAnotacoesUi(evento) {
  const raiz = obterRaizAnotacoesUi()
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  if (!runtime?.tracoAtual || runtime.pointerId !== evento.pointerId) return

  adicionarPontoTracoAnotacoesUi(runtime, obterPontoConteudoAnotacoesUi(evento, runtime.secao))
  const traco = runtime.tracoAtual
  runtime.tracoAtual = null
  runtime.pointerId = null
  alterarCapturaPointerAnotacoesUi(evento.currentTarget, 'releasePointerCapture', evento.pointerId)

  if (traco.points.length < 2) {
    redesenharAnotacoesUi(raiz)
    return
  }

  const modelo = globalThis.AnotacoesLivres
  const estado = {
    ...runtime.estado,
    userId: USUARIO_ANOTACOES_UI,
    viewId: runtime.viewId,
    referenceWidth: obterLarguraReferenciaAnotacoesUi(runtime.secao),
    strokes: [...(runtime.estado?.strokes || []).slice(-199), traco]
  }
  const resultado = modelo?.salvarAnotacoes?.(estado)
  if (resultado?.ok) runtime.estado = resultado.estado
  redesenharAnotacoesUi(raiz)
  atualizarEstadoLimparAnotacoesUi(raiz)
  evento.preventDefault?.()
}

function cancelarPointerAnotacoesUi(evento) {
  const runtime = obterEstadoRuntimeAnotacoesUi()
  if (!runtime?.tracoAtual || runtime.pointerId !== evento.pointerId) return
  alterarCapturaPointerAnotacoesUi(evento.currentTarget, 'releasePointerCapture', evento.pointerId)
  cancelarTracoAtualAnotacoesUi()
}

function criarEstadoVazioRuntimeAnotacoesUi(runtime) {
  const modelo = globalThis.AnotacoesLivres
  return modelo?.criarEstadoAnotacoesVazio?.({
    userId: USUARIO_ANOTACOES_UI,
    viewId: runtime.viewId,
    referenceWidth: obterLarguraReferenciaAnotacoesUi(runtime.secao)
  }) || { strokes: [] }
}

function limparAnotacoesSecaoAtualUi(raiz = obterRaizAnotacoesUi()) {
  const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
  if (!runtime || (runtime.estado?.strokes?.length || 0) === 0) return false

  const confirmado = typeof window.confirm === 'function'
    ? window.confirm('Limpar anotacoes desta secao?')
    : true
  if (!confirmado) return false

  const modelo = globalThis.AnotacoesLivres
  const resultado = modelo?.limparAnotacoes?.({
    userId: USUARIO_ANOTACOES_UI,
    viewId: runtime.viewId
  })
  if (!resultado?.ok) return false

  runtime.tracoAtual = null
  runtime.pointerId = null
  runtime.estado = criarEstadoVazioRuntimeAnotacoesUi(runtime)
  redesenharAnotacoesUi(raiz)
  atualizarEstadoLimparAnotacoesUi(raiz)
  return true
}

function observarSecoesAnotacoesUi(raiz) {
  const Observer = window.MutationObserver
  if (typeof Observer !== 'function') return

  const observer = new Observer(() => atualizarSecaoAnotacoesUi(raiz))
  document.querySelectorAll('.secao').forEach(secao => {
    observer.observe(secao, { attributes: true, attributeFilter: ['class'] })
  })
  obterEstadoRuntimeAnotacoesUi(raiz).observer = observer
}

function instalarEventosGlobaisAnotacoesUi() {
  if (janelasComEventosAnotacoesUi.has(window)) return
  window.addEventListener('scroll', () => agendarRedesenhoAnotacoesUi(), { passive: true })
  window.addEventListener('resize', () => {
    aplicarPosicaoSalvaAnotacoesUi(obterRaizAnotacoesUi(), { salvarLimitada: true })
    agendarRedesenhoAnotacoesUi({ ajustarCanvas: true })
  })
  janelasComEventosAnotacoesUi.add(window)
}

function instalarIntegracaoMenuMobileAnotacoesUi() {
  const btnMenu = document.getElementById('btn-menu')
  if (!btnMenu || botoesMenuComAnotacoesUi.has(btnMenu)) return

  btnMenu.addEventListener('click', () => {
    if (obterEstadoAnotacoesUi()?.ativo) definirModoAnotacoesUi(false)
  }, { capture: true })
  botoesMenuComAnotacoesUi.add(btnMenu)
}

function inicializarAnotacoesUi() {
  const existente = obterRaizAnotacoesUi()
  if (existente) return existente

  const raiz = document.createElement('div')
  raiz.id = ID_RAIZ_ANOTACOES_UI
  raiz.className = 'anotacoes-ui'
  raiz.dataset.ativo = 'false'
  raiz.dataset.ferramenta = 'pen'
  raiz.dataset.cor = 'black'
  raiz.dataset.espessura = 'medium'

  const canvas = document.createElement('canvas')
  canvas.id = 'anotacoes-canvas'
  canvas.className = 'anotacoes-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.pointerEvents = 'none'
  canvas.style.touchAction = 'none'

  const toolbar = criarToolbarAnotacoesUi()
  const toggle = criarBotaoAnotacoesUi({
    classe: 'anotacoes-toggle',
    rotulo: 'Ativar anotacoes livres',
    texto: '\u270e Anotar'
  })
  toggle.id = 'btn-anotacoes-toggle'
  toggle.setAttribute('aria-pressed', 'false')

  toggle.addEventListener('pointerdown', iniciarArrasteToggleAnotacoesUi)
  toggle.addEventListener('pointermove', continuarArrasteToggleAnotacoesUi)
  toggle.addEventListener('pointerup', finalizarArrasteToggleAnotacoesUi)
  toggle.addEventListener('pointercancel', cancelarArrasteToggleAnotacoesUi)
  toggle.addEventListener('click', evento => {
    const runtime = obterEstadoRuntimeAnotacoesUi(raiz)
    if (runtime?.suprimirCliqueToggle) {
      runtime.suprimirCliqueToggle = false
      evento.preventDefault?.()
      return
    }
    definirModoAnotacoesUi(!obterEstadoAnotacoesUi()?.ativo)
  })

  toolbar.addEventListener('click', evento => {
    const botaoLimpar = evento.target.closest?.('.anotacoes-controle--limpar')
    if (botaoLimpar && toolbar.contains(botaoLimpar)) {
      limparAnotacoesSecaoAtualUi(raiz)
      return
    }

    const botao = evento.target.closest?.('[data-grupo-anotacoes]')
    if (!botao || !toolbar.contains(botao)) return
    atualizarSelecaoAnotacoesUi(raiz, botao.dataset.grupoAnotacoes, botao.dataset.valorAnotacoes)
    if (botao.dataset.grupoAnotacoes === 'ferramenta' && botao.dataset.valorAnotacoes !== 'pen') {
      cancelarTracoAtualAnotacoesUi(raiz)
    }
  })

  canvas.addEventListener('pointerdown', iniciarTracoAnotacoesUi)
  canvas.addEventListener('pointermove', continuarTracoAnotacoesUi)
  canvas.addEventListener('pointerup', finalizarTracoAnotacoesUi)
  canvas.addEventListener('pointercancel', cancelarPointerAnotacoesUi)

  raiz.append(canvas, toolbar, toggle)
  document.body.appendChild(raiz)
  estadosAnotacoesUi.set(raiz, {
    ajustarCanvasPendente: false,
    arrasteToggle: null,
    estado: { strokes: [] },
    pointerId: null,
    rafId: null,
    secao: null,
    suprimirCliqueToggle: false,
    temDesenhoRenderizado: false,
    tracoAtual: null,
    viewId: null
  })
  atualizarSelecaoAnotacoesUi(raiz, 'ferramenta', 'pen')
  atualizarSelecaoAnotacoesUi(raiz, 'cor', 'black')
  atualizarSelecaoAnotacoesUi(raiz, 'espessura', 'medium')
  ajustarCanvasAnotacoesUi(raiz)
  atualizarSecaoAnotacoesUi(raiz)
  aplicarPosicaoSalvaAnotacoesUi(raiz, { salvarLimitada: true })
  observarSecoesAnotacoesUi(raiz)
  instalarEventosGlobaisAnotacoesUi()
  instalarIntegracaoMenuMobileAnotacoesUi()

  if (!documentosComAtalhoAnotacoesUi.has(document)) {
    document.addEventListener('keydown', tratarEscapeAnotacoesUi)
    documentosComAtalhoAnotacoesUi.add(document)
  }

  return raiz
}

const AnotacoesLivresUi = Object.freeze({
  inicializarAnotacoesUi,
  definirModoAnotacoesUi,
  obterEstadoAnotacoesUi,
  obterViewIdAnotacoesUi
})

if (typeof globalThis !== 'undefined') {
  globalThis.AnotacoesLivresUi = AnotacoesLivresUi
}

if (typeof document !== 'undefined' && document.body) {
  inicializarAnotacoesUi()
}
