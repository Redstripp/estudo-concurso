// js/anotacoes.js

const VERSAO_ANOTACOES = 1
const PREFIXO_CHAVE_ANOTACOES = 'estudoConcursoAnotacoes'
const VIEW_ID_PADRAO_ANOTACOES = 'secao:desconhecida'
const LARGURA_REFERENCIA_PADRAO_ANOTACOES = 1200
const MAX_TRACOS_ANOTACOES = 200
const MAX_PONTOS_POR_TRACO_ANOTACOES = 1000
const MAX_COORDENADA_ANOTACOES = 10000000

const FERRAMENTAS_ANOTACOES = new Set(['pen', 'highlighter', 'eraser'])
const CORES_ANOTACOES = new Set(['black', 'red', 'blue', 'green', 'yellow', 'white'])
const ESPESSURAS_ANOTACOES = new Set(['thin', 'medium', 'thick'])

function normalizarParteChaveAnotacoes(valor, fallback, limite = 240) {
  const texto = ['string', 'number'].includes(typeof valor) ? String(valor).trim() : ''
  const seguro = texto
    .replace(/[^a-zA-Z0-9._:@/-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, limite)

  return seguro || fallback
}

function normalizarUserIdAnotacoes(userId) {
  return normalizarParteChaveAnotacoes(userId, 'anonimo', 120)
}

function normalizarViewIdAnotacoes(viewId) {
  const seguro = normalizarParteChaveAnotacoes(viewId, VIEW_ID_PADRAO_ANOTACOES)
  const formatoValido = /^secao:[a-zA-Z0-9._-]+(?:\/sub:[a-zA-Z0-9._-]+)?$/
  return formatoValido.test(seguro) ? seguro : VIEW_ID_PADRAO_ANOTACOES
}

function normalizarLarguraReferenciaAnotacoes(referenceWidth) {
  const largura = Number(referenceWidth)
  return Number.isFinite(largura) && largura > 0 && largura <= MAX_COORDENADA_ANOTACOES
    ? largura
    : LARGURA_REFERENCIA_PADRAO_ANOTACOES
}

function criarDataIsoAnotacoes(valor) {
  const data = typeof valor === 'string' ? new Date(valor) : new Date()
  return Number.isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString()
}

function criarChaveAnotacoes({ userId, viewId } = {}) {
  const usuarioSeguro = normalizarUserIdAnotacoes(userId)
  const viewIdSeguro = normalizarViewIdAnotacoes(viewId)
  return `${PREFIXO_CHAVE_ANOTACOES}:v${VERSAO_ANOTACOES}:${usuarioSeguro}:${viewIdSeguro}`
}

function criarEstadoAnotacoesVazio({ userId, viewId, referenceWidth } = {}) {
  return {
    version: VERSAO_ANOTACOES,
    userId: normalizarUserIdAnotacoes(userId),
    viewId: normalizarViewIdAnotacoes(viewId),
    referenceWidth: normalizarLarguraReferenciaAnotacoes(referenceWidth),
    updatedAt: criarDataIsoAnotacoes(),
    strokes: []
  }
}

function normalizarPontoAnotacoes(ponto) {
  if (!ponto || typeof ponto !== 'object' || Array.isArray(ponto)) return null
  if (typeof ponto.x !== 'number' || typeof ponto.y !== 'number') return null
  if (!Number.isFinite(ponto.x) || !Number.isFinite(ponto.y)) return null
  if (ponto.x < 0 || ponto.y < 0) return null
  if (ponto.x > MAX_COORDENADA_ANOTACOES || ponto.y > MAX_COORDENADA_ANOTACOES) return null

  return { x: ponto.x, y: ponto.y }
}

function normalizarOpacidadeAnotacoes(opacity, tool) {
  if (typeof opacity === 'number' && Number.isFinite(opacity)) {
    return Math.min(1, Math.max(0, opacity))
  }
  return tool === 'highlighter' ? 0.35 : 1
}

function normalizarTracoAnotacoes(traco, indice) {
  if (!traco || typeof traco !== 'object' || Array.isArray(traco)) return null
  if (!FERRAMENTAS_ANOTACOES.has(traco.tool)) return null
  if (!CORES_ANOTACOES.has(traco.color)) return null
  if (!ESPESSURAS_ANOTACOES.has(traco.thickness)) return null
  if (!Array.isArray(traco.points)) return null

  const points = traco.points
    .slice(0, MAX_PONTOS_POR_TRACO_ANOTACOES)
    .map(normalizarPontoAnotacoes)
    .filter(Boolean)

  if (points.length === 0) return null

  return {
    id: normalizarParteChaveAnotacoes(traco.id, `traco-${indice + 1}`, 120),
    tool: traco.tool,
    color: traco.color,
    thickness: traco.thickness,
    opacity: normalizarOpacidadeAnotacoes(traco.opacity, traco.tool),
    points,
    createdAt: criarDataIsoAnotacoes(traco.createdAt)
  }
}

function normalizarEstadoAnotacoes(raw, contexto = {}) {
  const vazio = criarEstadoAnotacoesVazio(contexto)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return vazio
  if (raw.version !== VERSAO_ANOTACOES) return vazio

  const userIdRaw = normalizarUserIdAnotacoes(raw.userId)
  const viewIdRaw = normalizarViewIdAnotacoes(raw.viewId)
  if (userIdRaw !== vazio.userId || viewIdRaw !== vazio.viewId) return vazio

  const strokes = Array.isArray(raw.strokes)
    ? raw.strokes
      .slice(0, MAX_TRACOS_ANOTACOES)
      .map(normalizarTracoAnotacoes)
      .filter(Boolean)
    : []

  return {
    version: VERSAO_ANOTACOES,
    userId: vazio.userId,
    viewId: vazio.viewId,
    referenceWidth: normalizarLarguraReferenciaAnotacoes(raw.referenceWidth ?? contexto.referenceWidth),
    updatedAt: criarDataIsoAnotacoes(raw.updatedAt),
    strokes
  }
}

function obterStorageAnotacoes(storage) {
  if (storage) return storage
  return typeof localStorage !== 'undefined' ? localStorage : null
}

function carregarAnotacoes({ userId, viewId, referenceWidth, storage } = {}) {
  const contexto = { userId, viewId, referenceWidth }
  const vazio = criarEstadoAnotacoesVazio(contexto)
  const storageAtual = obterStorageAnotacoes(storage)
  if (!storageAtual || typeof storageAtual.getItem !== 'function') return vazio

  try {
    const bruto = storageAtual.getItem(criarChaveAnotacoes(contexto))
    return bruto ? normalizarEstadoAnotacoes(JSON.parse(bruto), contexto) : vazio
  } catch {
    return vazio
  }
}

function erroQuotaAnotacoes(erro) {
  return erro?.name === 'QuotaExceededError' || erro?.code === 22 || erro?.code === 1014
}

function salvarAnotacoes(estado, { storage } = {}) {
  const storageAtual = obterStorageAnotacoes(storage)
  if (!storageAtual || typeof storageAtual.setItem !== 'function') {
    return { ok: false, motivo: 'storage-indisponivel' }
  }

  const normalizado = normalizarEstadoAnotacoes(estado, estado)
  normalizado.updatedAt = criarDataIsoAnotacoes()

  try {
    const chave = criarChaveAnotacoes(normalizado)
    storageAtual.setItem(chave, JSON.stringify(normalizado))
    return { ok: true, chave, estado: normalizado }
  } catch (erro) {
    return {
      ok: false,
      motivo: erroQuotaAnotacoes(erro) ? 'quota-excedida' : 'falha-storage'
    }
  }
}

function limparAnotacoes({ userId, viewId, storage } = {}) {
  const storageAtual = obterStorageAnotacoes(storage)
  if (!storageAtual || typeof storageAtual.removeItem !== 'function') {
    return { ok: false, motivo: 'storage-indisponivel' }
  }

  try {
    const chave = criarChaveAnotacoes({ userId, viewId })
    storageAtual.removeItem(chave)
    return { ok: true, chave }
  } catch {
    return { ok: false, motivo: 'falha-storage' }
  }
}

const AnotacoesLivres = Object.freeze({
  criarEstadoAnotacoesVazio,
  criarChaveAnotacoes,
  normalizarEstadoAnotacoes,
  carregarAnotacoes,
  salvarAnotacoes,
  limparAnotacoes
})

if (typeof globalThis !== 'undefined') {
  globalThis.AnotacoesLivres = AnotacoesLivres
}
