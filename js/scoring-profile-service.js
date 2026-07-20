// js/scoring-profile-service.js
// Camada central para CRUD remoto de perfis de pontuacao de simulados.

const SCORING_PROFILE_SERVICE_LOCAL_STORAGE_KEY = 'estudoConcursoScoringProfiles:v1'
const SCORING_PROFILE_SERVICE_OPERATION_STORAGE_PREFIX = 'estudoConcursoScoringProfileOperation:v1'
const SCORING_PROFILE_SERVICE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function clonarScoringProfileService(valor) {
  return JSON.parse(JSON.stringify(valor))
}

function obterClienteScoringProfileService() {
  if (typeof db !== 'undefined' && db) return db
  return globalThis.db || null
}

function obterUsuarioAtualScoringProfileService() {
  return globalThis.window?.usuarioAtual || globalThis.usuarioAtual || null
}

function criarErroScoringProfileService(tipo, mensagem, erroOriginal = null) {
  const erro = new Error(mensagem)
  erro.name = 'ScoringProfileServiceError'
  erro.tipo = tipo
  erro.original = erroOriginal || null
  erro.code = erroOriginal?.code
  erro.status = erroOriginal?.status || erroOriginal?.statusCode
  return erro
}

function normalizarErroScoringProfileService(erroOriginal, contexto = 'operacao') {
  if (erroOriginal?.name === 'ScoringProfileServiceError') return erroOriginal

  const codigo = String(erroOriginal?.code || '').toUpperCase()
  const status = Number(erroOriginal?.status || erroOriginal?.statusCode || 0)
  const texto = [erroOriginal?.message, erroOriginal?.details, erroOriginal?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (codigo === '42883' || codigo === 'PGRST202' || /function .* does not exist|could not find .*function|schema cache.*function/.test(texto)) {
    return criarErroScoringProfileService(
      'migration',
      'A migration local das RPCs de pontuacao ainda nao foi publicada. Nenhum perfil foi salvo.',
      erroOriginal
    )
  }

  if (status === 401 || /jwt|auth session|not authenticated|unauthenticated|auth\.uid\(\) is null/.test(texto)) {
    return criarErroScoringProfileService('autenticacao', 'Entre novamente para gerenciar perfis de pontuacao.', erroOriginal)
  }

  if (codigo === '42501' || status === 403 || /row-level security|permission denied|rls/.test(texto)) {
    return criarErroScoringProfileService('rls', 'Voce nao tem permissao para acessar esse perfil de pontuacao.', erroOriginal)
  }

  if (/already_used|locked|imutavel|immutable|scoring_profile_version_already_used|scoring_profile_blocks_already_used/.test(texto)) {
    return criarErroScoringProfileService('imutabilidade', 'Esta versao ja foi usada em simulado. Crie uma nova versao para alterar regras ou blocos.', erroOriginal)
  }

  if (/operation_payload_mismatch|operation_type_mismatch|scoring_profile_operation_payload_mismatch|scoring_profile_operation_type_mismatch/.test(texto)) {
    return criarErroScoringProfileService('idempotencia_conflito', 'Esta tentativa ja foi registrada com dados diferentes. Revise a tela e inicie uma nova acao.', erroOriginal)
  }

  if (/operation_in_progress|scoring_profile_operation_in_progress/.test(texto) || codigo === '55P03') {
    return criarErroScoringProfileService('idempotencia_pendente', 'Esta operacao ainda esta em andamento. Aguarde alguns segundos e tente novamente.', erroOriginal)
  }

  if (['23502', '23503', '23505', '23514', '22P02', '22001'].includes(codigo) || /constraint|duplicate|violates|invalid/.test(texto)) {
    return criarErroScoringProfileService('validacao', 'Revise os dados do perfil de pontuacao e tente novamente.', erroOriginal)
  }

  if ([408, 429, 500, 502, 503, 504].includes(status) || /network|failed to fetch|timeout|timed out|server error/.test(texto)) {
    return criarErroScoringProfileService('rede', 'Nao foi possivel falar com o servidor. Tente novamente sem repetir cliques.', erroOriginal)
  }

  return criarErroScoringProfileService('desconhecido', `Nao foi possivel concluir ${contexto}.`, erroOriginal)
}

async function validarSessaoScoringProfileService() {
  const cliente = obterClienteScoringProfileService()
  if (!cliente) {
    throw criarErroScoringProfileService('rede', 'Cliente Supabase indisponivel para perfis de pontuacao.')
  }

  const usuario = obterUsuarioAtualScoringProfileService()
  if (usuario?.id) return { cliente, userId: usuario.id }

  if (cliente.auth?.getUser) {
    const { data, error } = await cliente.auth.getUser()
    if (error) throw normalizarErroScoringProfileService(error, 'validar sessao')
    if (data?.user?.id) return { cliente, userId: data.user.id }
  }

  throw criarErroScoringProfileService('autenticacao', 'Entre para gerenciar perfis de pontuacao.')
}

function obterMensagemErroScoringProfileService(erro) {
  return normalizarErroScoringProfileService(erro).message
}

function normalizarTextoScoringProfileService(valor) {
  return String(valor ?? '').trim()
}

function gerarChaveScoringProfileService(nome, prefixo = 'perfil', operationId = '') {
  const base = normalizarTextoScoringProfileService(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const slug = base || prefixo
  const sufixo = normalizarTextoScoringProfileService(operationId).replace(/-/g, '').slice(0, 12) || Date.now().toString(36)
  return `${slug}-${sufixo}`
}

function stringificarEstavelScoringProfileService(valor) {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor)
  if (Array.isArray(valor)) return `[${valor.map(stringificarEstavelScoringProfileService).join(',')}]`
  return `{${Object.keys(valor).sort().map(chave => `${JSON.stringify(chave)}:${stringificarEstavelScoringProfileService(valor[chave])}`).join(',')}}`
}

function criarFingerprintScoringProfileService(valor) {
  const texto = stringificarEstavelScoringProfileService(valor)
  let hash = 0
  for (let i = 0; i < texto.length; i += 1) {
    hash = ((hash << 5) - hash + texto.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

function obterArmazenamentoOperacaoScoringProfileService(persistente = false) {
  if (persistente) return globalThis.localStorage || globalThis.window?.localStorage || null
  return globalThis.sessionStorage || globalThis.window?.sessionStorage || globalThis.localStorage || globalThis.window?.localStorage || null
}

function gerarUuidOperacaoScoringProfileService() {
  const cryptoObj = globalThis.crypto || globalThis.window?.crypto
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID()
  if (!cryptoObj?.getRandomValues) {
    throw criarErroScoringProfileService('validacao', 'Este navegador nao possui gerador seguro de UUID para operacoes remotas.')
  }

  const bytes = new Uint8Array(16)
  cryptoObj.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function prepararOperacaoScoringProfileService(tipo, chave, payload, opcoes = {}) {
  const operationIdInformado = normalizarTextoScoringProfileService(opcoes.operationId)
  if (operationIdInformado) {
    if (!SCORING_PROFILE_SERVICE_UUID_RE.test(operationIdInformado)) {
      throw criarErroScoringProfileService('validacao', 'Identificador de operacao invalido.')
    }
    return { operationId: operationIdInformado, storageKey: null }
  }

  const fingerprint = criarFingerprintScoringProfileService(payload)
  const storageKey = `${SCORING_PROFILE_SERVICE_OPERATION_STORAGE_PREFIX}:${tipo}:${normalizarTextoScoringProfileService(chave) || 'novo'}:${fingerprint}`
  const storage = obterArmazenamentoOperacaoScoringProfileService(Boolean(opcoes.persistente))
  const existente = storage?.getItem(storageKey)
  if (SCORING_PROFILE_SERVICE_UUID_RE.test(existente || '')) {
    return { operationId: existente, storageKey, storage }
  }

  const operationId = gerarUuidOperacaoScoringProfileService()
  storage?.setItem(storageKey, operationId)
  return { operationId, storageKey, storage }
}

function concluirOperacaoScoringProfileService(operacao) {
  if (operacao?.storageKey && operacao.storage) {
    operacao.storage.removeItem(operacao.storageKey)
  }
}

function limparMetadadosScoringProfileService(metadados = {}) {
  const clone = { ...(metadados || {}) }
  ;[
    'origem',
    'remoto',
    'sistema',
    'local',
    'bloqueado',
    'profileKey',
    'versionId',
    'lockedAt',
    'userId',
    'scope',
    'currentVersion',
    'importOperationId'
  ].forEach(chave => delete clone[chave])
  return clone
}

function obterPerfilLegadoScoringProfileService() {
  const perfil = typeof criarPerfilPontuacaoLegadoSimulado === 'function'
    ? criarPerfilPontuacaoLegadoSimulado()
    : {
        id: 'legacy_simple',
        nome: 'Padrao atual',
        descricao: 'Replica o comportamento historico: nota percentual = certas / total.',
        ativo: true,
        versao: 1,
        modo: 'simple',
        valores: { correta: 1, errada: 0, branca: 0, anulada: 0 },
        anuladas: { tratamento: 'zero', valorEspecifico: 0 },
        arredondamento: { modo: 'matematico', casasDecimais: 2, etapa: 'final' },
        notaMaxima: null,
        pesos: { padrao: 1, questoes: {}, disciplinas: {}, blocos: {}, tipos: {} },
        blocos: [],
        minimos: {},
        eliminacao: {},
        metadados: {}
      }

  return {
    ...perfil,
    metadados: {
      ...(perfil.metadados || {}),
      origem: 'virtual',
      sistema: true,
      remoto: false,
      local: false,
      bloqueado: true
    }
  }
}

function normalizarPerfilMotorScoringProfileService(perfil) {
  return typeof normalizarPerfilPontuacaoSimulado === 'function'
    ? normalizarPerfilPontuacaoSimulado(perfil)
    : perfil
}

function carregarPerfisLocaisScoringProfileService() {
  const storage = globalThis.localStorage || globalThis.window?.localStorage
  if (!storage) return []

  try {
    const salvos = JSON.parse(storage.getItem(SCORING_PROFILE_SERVICE_LOCAL_STORAGE_KEY) || '[]')
    if (!Array.isArray(salvos)) return []

    return salvos
      .filter(perfil => perfil?.id && perfil.id !== 'legacy_simple')
      .map(perfil => {
        const localId = normalizarTextoScoringProfileService(perfil.id)
        const normalizado = normalizarPerfilMotorScoringProfileService({
          ...perfil,
          id: `local:${localId}`,
          metadados: {
            ...(perfil.metadados || {}),
            origem: 'local',
            local: true,
            remoto: false,
            localId,
            importadoPara: perfil.metadados?.importadoPara || null,
            importadoEm: perfil.metadados?.importadoEm || null
          }
        })
        normalizado.id = `local:${localId}`
        normalizado.ativo = perfil.ativo !== false
        normalizado.metadados = {
          ...(normalizado.metadados || {}),
          origem: 'local',
          local: true,
          remoto: false,
          localId,
          importadoPara: perfil.metadados?.importadoPara || null,
          importadoEm: perfil.metadados?.importadoEm || null
        }
        return normalizado
      })
  } catch (erro) {
    console.warn('Nao foi possivel ler perfis locais de pontuacao.', erro)
    return []
  }
}

function registrarImportacaoLocalScoringProfileService(localId, perfilRemotoId) {
  const storage = globalThis.localStorage || globalThis.window?.localStorage
  if (!storage || !localId || !perfilRemotoId) return

  try {
    const salvos = JSON.parse(storage.getItem(SCORING_PROFILE_SERVICE_LOCAL_STORAGE_KEY) || '[]')
    if (!Array.isArray(salvos)) return
    const atualizados = salvos.map(perfil => {
      if (String(perfil?.id) !== String(localId)) return perfil
      return {
        ...perfil,
        metadados: {
          ...(perfil.metadados || {}),
          importadoPara: perfilRemotoId,
          importadoEm: new Date().toISOString(),
          importOperationId: null
        }
      }
    })
    storage.setItem(SCORING_PROFILE_SERVICE_LOCAL_STORAGE_KEY, JSON.stringify(atualizados))
  } catch (erro) {
    console.warn('Nao foi possivel marcar perfil local como importado.', erro)
  }
}

function registrarOperacaoImportacaoLocalScoringProfileService(localId, operationId) {
  const storage = globalThis.localStorage || globalThis.window?.localStorage
  if (!storage || !localId || !operationId) return

  try {
    const salvos = JSON.parse(storage.getItem(SCORING_PROFILE_SERVICE_LOCAL_STORAGE_KEY) || '[]')
    if (!Array.isArray(salvos)) return
    const atualizados = salvos.map(perfil => {
      if (String(perfil?.id) !== String(localId)) return perfil
      return {
        ...perfil,
        metadados: {
          ...(perfil.metadados || {}),
          importOperationId: operationId
        }
      }
    })
    storage.setItem(SCORING_PROFILE_SERVICE_LOCAL_STORAGE_KEY, JSON.stringify(atualizados))
  } catch (erro) {
    console.warn('Nao foi possivel registrar operacao de importacao local.', erro)
  }
}

function normalizarBlocosScoringProfileService(blocosJson = [], linhasBlocos = []) {
  const origem = Array.isArray(linhasBlocos) && linhasBlocos.length > 0
    ? linhasBlocos.map(linha => ({
        id: linha.block_key,
        nome: linha.name,
        peso: linha.weight,
        notaMinima: linha.min_score,
        percentualMinimo: linha.min_percent,
        disciplinas: linha.metadata?.disciplinas || [],
        questoes: linha.metadata?.questoes || []
      }))
    : (Array.isArray(blocosJson) ? blocosJson : [])

  return origem
    .map(bloco => ({
      id: normalizarTextoScoringProfileService(bloco.id || bloco.block_key || bloco.codigo || bloco.nome),
      nome: normalizarTextoScoringProfileService(bloco.nome || bloco.name || bloco.id || bloco.block_key),
      peso: bloco.peso ?? bloco.weight ?? null,
      notaMinima: bloco.notaMinima ?? bloco.min_score ?? null,
      percentualMinimo: bloco.percentualMinimo ?? bloco.min_percent ?? null,
      disciplinas: Array.isArray(bloco.disciplinas) ? bloco.disciplinas : [],
      questoes: Array.isArray(bloco.questoes) ? bloco.questoes : []
    }))
    .filter(bloco => bloco.id)
    .sort((a, b) => a.id.localeCompare(b.id))
}

function normalizarPerfilRemotoScoringProfileService(linhaPerfil, linhaVersao, linhasBlocos = []) {
  const regras = linhaVersao?.rules || {}
  const blocos = normalizarBlocosScoringProfileService(linhaVersao?.blocks || [], linhasBlocos)
  const perfil = {
    id: linhaPerfil.id,
    nome: linhaPerfil.name,
    descricao: linhaPerfil.description || '',
    ativo: linhaPerfil.active !== false,
    versao: Number(linhaVersao?.version || linhaPerfil.current_version || 1),
    modo: linhaVersao?.mode || regras.modo || 'simple',
    valores: regras.valores || regras.values || {},
    anuladas: regras.anuladas || regras.annulled || {},
    arredondamento: linhaVersao?.rounding || regras.arredondamento || {},
    notaMaxima: regras.notaMaxima ?? regras.scoreMax ?? null,
    pesos: linhaVersao?.weights || regras.pesos || {},
    blocos,
    minimos: linhaVersao?.minimum_criteria || regras.minimos || {},
    eliminacao: linhaVersao?.elimination_criteria || regras.eliminacao || {},
    metadados: {
      ...(linhaPerfil.metadata || {}),
      ...(linhaVersao?.metadata || {}),
      origem: linhaPerfil.scope === 'system' ? 'sistema' : 'remoto',
      remoto: true,
      sistema: linhaPerfil.scope === 'system',
      local: false,
      bloqueado: Boolean(linhaVersao?.locked_at),
      profileKey: linhaPerfil.profile_key,
      versionId: linhaVersao?.id || null,
      lockedAt: linhaVersao?.locked_at || null,
      userId: linhaPerfil.user_id || null,
      scope: linhaPerfil.scope,
      currentVersion: linhaPerfil.current_version
    }
  }

  const normalizado = normalizarPerfilMotorScoringProfileService(perfil)
  normalizado.id = linhaPerfil.id
  normalizado.nome = linhaPerfil.name
  normalizado.descricao = linhaPerfil.description || ''
  normalizado.ativo = linhaPerfil.active !== false
  normalizado.versao = Number(linhaVersao?.version || linhaPerfil.current_version || 1)
  normalizado.blocos = blocos
  normalizado.metadados = perfil.metadados
  return normalizado
}

function ordenarPerfisScoringProfileService(perfis) {
  const pesoOrigem = { virtual: 0, sistema: 1, remoto: 2, local: 3 }
  return [...perfis].sort((a, b) => {
    const origemA = a.metadados?.origem || 'remoto'
    const origemB = b.metadados?.origem || 'remoto'
    if ((pesoOrigem[origemA] ?? 9) !== (pesoOrigem[origemB] ?? 9)) {
      return (pesoOrigem[origemA] ?? 9) - (pesoOrigem[origemB] ?? 9)
    }
    if (a.ativo !== b.ativo) return a.ativo === false ? 1 : -1
    const nome = String(a.nome || '').localeCompare(String(b.nome || ''))
    if (nome !== 0) return nome
    return Number(a.versao || 1) - Number(b.versao || 1)
  })
}

function comporListaPerfisScoringProfileService(perfisRemotos = []) {
  const legado = obterPerfilLegadoScoringProfileService()
  const locais = carregarPerfisLocaisScoringProfileService()
  const remotosSemLegadoDuplicado = perfisRemotos.filter(perfil => {
    if (perfil.id === legado.id) return false
    const chave = String(perfil.metadados?.profileKey || '').toLowerCase()
    return chave !== 'legacy_simple' && chave !== 'legacy-simple'
  })
  return ordenarPerfisScoringProfileService([legado, ...remotosSemLegadoDuplicado, ...locais])
}

async function consultarScoringProfileService(consulta, contexto) {
  const resposta = await consulta
  if (resposta?.error) throw normalizarErroScoringProfileService(resposta.error, contexto)
  return resposta?.data ?? []
}

async function listarPerfisPontuacao() {
  const { cliente } = await validarSessaoScoringProfileService()

  const perfis = await consultarScoringProfileService(
    cliente
      .from('scoring_profiles')
      .select('id, user_id, scope, profile_key, name, description, active, current_version, metadata, created_at, updated_at')
      .order('scope', { ascending: true })
      .order('name', { ascending: true })
      .order('current_version', { ascending: true }),
    'listar perfis de pontuacao'
  )

  if (!perfis.length) return comporListaPerfisScoringProfileService([])

  const idsPerfis = perfis.map(perfil => perfil.id)
  const versoes = await consultarScoringProfileService(
    cliente
      .from('scoring_profile_versions')
      .select('id, profile_id, user_id, version, mode, rules, weights, blocks, minimum_criteria, elimination_criteria, rounding, metadata, locked_at, created_at, updated_at')
      .in('profile_id', idsPerfis)
      .order('profile_id', { ascending: true })
      .order('version', { ascending: false }),
    'listar versoes de pontuacao'
  )

  const versoesAtuais = perfis
    .map(perfil => versoes.find(versao => versao.profile_id === perfil.id && Number(versao.version) === Number(perfil.current_version))
      || versoes.find(versao => versao.profile_id === perfil.id))
    .filter(Boolean)

  const idsVersoes = versoesAtuais.map(versao => versao.id)
  const blocos = idsVersoes.length
    ? await consultarScoringProfileService(
        cliente
          .from('scoring_profile_blocks')
          .select('id, profile_version_id, user_id, block_key, name, weight, min_score, min_percent, metadata, created_at')
          .in('profile_version_id', idsVersoes)
          .order('block_key', { ascending: true }),
        'listar blocos de pontuacao'
      )
    : []

  const remotos = perfis.map(perfil => {
    const versao = versoesAtuais.find(item => item.profile_id === perfil.id)
    const blocosVersao = blocos.filter(bloco => bloco.profile_version_id === versao?.id)
    return normalizarPerfilRemotoScoringProfileService(perfil, versao, blocosVersao)
  })

  return comporListaPerfisScoringProfileService(remotos)
}

function validarPerfilScoringProfileService(perfil) {
  const validacao = typeof validarPerfilPontuacaoSimulado === 'function'
    ? validarPerfilPontuacaoSimulado(perfil)
    : { ok: true, perfil }

  if (!validacao.ok) {
    throw criarErroScoringProfileService('validacao', validacao.erros.join(' '))
  }

  return validacao.perfil
}

function serializarVersaoScoringProfileService(perfil) {
  const p = validarPerfilScoringProfileService(perfil)
  return {
    version: Number(p.versao || 1),
    mode: p.modo,
    rules: {
      valores: p.valores || {},
      anuladas: p.anuladas || {},
      notaMaxima: p.notaMaxima ?? null
    },
    weights: p.pesos || {},
    blocks: p.blocos || [],
    minimum_criteria: p.minimos || {},
    elimination_criteria: p.eliminacao || {},
    rounding: p.arredondamento || {},
    metadata: limparMetadadosScoringProfileService(p.metadados || {})
  }
}

function serializarBlocosScoringProfileService(perfil) {
  const p = validarPerfilScoringProfileService(perfil)
  return (p.blocos || []).map(bloco => ({
    id: bloco.id,
    nome: bloco.nome || bloco.id,
    peso: bloco.peso,
    notaMinima: bloco.notaMinima,
    percentualMinimo: bloco.percentualMinimo,
    disciplinas: bloco.disciplinas || [],
    questoes: bloco.questoes || []
  }))
}

async function executarRpcScoringProfileService(cliente, nome, args, contexto) {
  if (!cliente.rpc) {
    throw criarErroScoringProfileService('migration', 'RPCs de pontuacao indisponiveis no cliente Supabase.')
  }
  const { data, error } = await cliente.rpc(nome, args)
  if (error) throw normalizarErroScoringProfileService(error, contexto)
  return data || {}
}

function obterIdRemotoScoringProfileService(perfilId) {
  const id = normalizarTextoScoringProfileService(perfilId)
  return SCORING_PROFILE_SERVICE_UUID_RE.test(id) ? id : null
}

async function obterPerfilPontuacao(profileId) {
  return carregarVersaoCompleta(profileId)
}

async function carregarVersaoCompleta(profileId, version = null) {
  const id = obterIdRemotoScoringProfileService(profileId)
  if (!id) throw criarErroScoringProfileService('validacao', 'Perfil remoto invalido.')

  const { cliente } = await validarSessaoScoringProfileService()
  const perfil = await consultarScoringProfileService(
    cliente
      .from('scoring_profiles')
      .select('id, user_id, scope, profile_key, name, description, active, current_version, metadata, created_at, updated_at')
      .eq('id', id)
      .single(),
    'carregar perfil de pontuacao'
  )

  const versaoBusca = version || perfil.current_version
  const versao = await consultarScoringProfileService(
    cliente
      .from('scoring_profile_versions')
      .select('id, profile_id, user_id, version, mode, rules, weights, blocks, minimum_criteria, elimination_criteria, rounding, metadata, locked_at, created_at, updated_at')
      .eq('profile_id', id)
      .eq('version', versaoBusca)
      .single(),
    'carregar versao de pontuacao'
  )

  const blocos = await consultarScoringProfileService(
    cliente
      .from('scoring_profile_blocks')
      .select('id, profile_version_id, user_id, block_key, name, weight, min_score, min_percent, metadata, created_at')
      .eq('profile_version_id', versao.id)
      .order('block_key', { ascending: true }),
    'carregar blocos de pontuacao'
  )

  return normalizarPerfilRemotoScoringProfileService(perfil, versao, blocos)
}

async function criarPerfilPontuacao(perfil, opcoes = {}) {
  const p = validarPerfilScoringProfileService({
    ...perfil,
    id: perfil.id && obterIdRemotoScoringProfileService(perfil.id) ? perfil.id : undefined,
    versao: 1
  })
  const { cliente } = await validarSessaoScoringProfileService()
  const versao = serializarVersaoScoringProfileService({ ...p, versao: 1 })
  const blocos = serializarBlocosScoringProfileService(p)
  const operacao = prepararOperacaoScoringProfileService(
    opcoes.operationType || 'create_profile',
    opcoes.operationKey || p.metadados?.importadoDePerfilLocal || p.metadados?.criadoAPartirDe || p.nome,
    {
      nome: p.nome,
      descricao: p.descricao || null,
      ativo: p.ativo !== false,
      metadados: limparMetadadosScoringProfileService(p.metadados || {}),
      versao,
      blocos
    },
    opcoes
  )
  const profileKey = gerarChaveScoringProfileService(p.nome, 'perfil', operacao.operationId)
  const resultado = await executarRpcScoringProfileService(cliente, 'create_scoring_profile_with_version', {
    p_operation_id: operacao.operationId,
    p_profile_key: profileKey,
    p_name: p.nome,
    p_description: p.descricao || null,
    p_active: p.ativo !== false,
    p_profile_metadata: limparMetadadosScoringProfileService(p.metadados || {}),
    p_version: versao,
    p_blocks: blocos
  }, 'criar perfil de pontuacao')

  const completo = await carregarVersaoCompleta(resultado.profile_id || resultado.id, resultado.version || 1)
  concluirOperacaoScoringProfileService(operacao)
  return completo
}

async function salvarPerfilPontuacao(perfil, opcoes = {}) {
  const id = obterIdRemotoScoringProfileService(perfil.id)
  if (!id) return criarPerfilPontuacao(perfil, opcoes)

  const p = validarPerfilScoringProfileService(perfil)
  const { cliente } = await validarSessaoScoringProfileService()
  const versao = serializarVersaoScoringProfileService(p)
  const blocos = serializarBlocosScoringProfileService(p)
  const operacao = prepararOperacaoScoringProfileService('save_current_version', id, {
    id,
    nome: p.nome,
    descricao: p.descricao || null,
    ativo: p.ativo !== false,
    metadados: limparMetadadosScoringProfileService(p.metadados || {}),
    versao,
    blocos
  }, opcoes)
  const resultado = await executarRpcScoringProfileService(cliente, 'save_scoring_profile_current_version', {
    p_operation_id: operacao.operationId,
    p_profile_id: id,
    p_name: p.nome,
    p_description: p.descricao || null,
    p_active: p.ativo !== false,
    p_profile_metadata: limparMetadadosScoringProfileService(p.metadados || {}),
    p_version: versao,
    p_blocks: blocos
  }, 'salvar perfil de pontuacao')

  const completo = await carregarVersaoCompleta(resultado.profile_id || id, resultado.version || p.versao)
  concluirOperacaoScoringProfileService(operacao)
  return completo
}

async function duplicarPerfilPontuacao(perfil, nome = null, opcoes = {}) {
  const nomeCopia = normalizarTextoScoringProfileService(nome || `${perfil.nome || 'Perfil'} - copia`)
  const id = obterIdRemotoScoringProfileService(perfil.id)

  if (!id || perfil.metadados?.origem === 'local' || perfil.metadados?.origem === 'virtual') {
    return criarPerfilPontuacao({
      ...perfil,
      id: undefined,
      nome: nomeCopia,
      versao: 1,
      metadados: {
        ...(perfil.metadados || {}),
        duplicadoDe: perfil.metadados?.localId || perfil.id,
        origemOriginal: perfil.metadados?.origem || 'local'
      }
    }, { ...opcoes, operationType: 'duplicate_profile', operationKey: perfil.metadados?.localId || perfil.id || nomeCopia })
  }

  const { cliente } = await validarSessaoScoringProfileService()
  const operacao = prepararOperacaoScoringProfileService('duplicate_profile', id, {
    sourceProfileId: id,
    sourceVersion: Number(perfil.versao || perfil.metadados?.currentVersion || 1),
    nome: nomeCopia,
    descricao: perfil.descricao || null,
    ativo: true
  }, opcoes)
  const profileKey = gerarChaveScoringProfileService(nomeCopia, 'perfil', operacao.operationId)
  const resultado = await executarRpcScoringProfileService(cliente, 'duplicate_scoring_profile', {
    p_operation_id: operacao.operationId,
    p_source_profile_id: id,
    p_source_version: Number(perfil.versao || perfil.metadados?.currentVersion || 1),
    p_profile_key: profileKey,
    p_name: nomeCopia,
    p_description: perfil.descricao || null,
    p_active: true
  }, 'duplicar perfil de pontuacao')

  const completo = await carregarVersaoCompleta(resultado.profile_id || resultado.id, resultado.version || 1)
  concluirOperacaoScoringProfileService(operacao)
  return completo
}

async function criarNovaVersaoPontuacao(perfil, opcoes = {}) {
  const id = obterIdRemotoScoringProfileService(perfil.id)
  if (!id) throw criarErroScoringProfileService('validacao', 'Crie um perfil remoto antes de versionar.')

  const p = validarPerfilScoringProfileService({
    ...perfil,
    versao: Number(perfil.versao || 1) + 1
  })
  const { cliente } = await validarSessaoScoringProfileService()
  const versao = serializarVersaoScoringProfileService(p)
  const blocos = serializarBlocosScoringProfileService(p)
  const operacao = prepararOperacaoScoringProfileService('create_version', id, {
    id,
    nome: p.nome,
    descricao: p.descricao || null,
    ativo: p.ativo !== false,
    metadados: limparMetadadosScoringProfileService(p.metadados || {}),
    versao,
    blocos
  }, opcoes)
  const resultado = await executarRpcScoringProfileService(cliente, 'create_scoring_profile_new_version', {
    p_operation_id: operacao.operationId,
    p_profile_id: id,
    p_name: p.nome,
    p_description: p.descricao || null,
    p_active: p.ativo !== false,
    p_profile_metadata: limparMetadadosScoringProfileService(p.metadados || {}),
    p_version: versao,
    p_blocks: blocos
  }, 'criar nova versao de pontuacao')

  const completo = await carregarVersaoCompleta(resultado.profile_id || id, resultado.version || p.versao)
  concluirOperacaoScoringProfileService(operacao)
  return completo
}

async function salvarBlocosPontuacao(profileId, version, blocos = [], opcoes = {}) {
  const id = obterIdRemotoScoringProfileService(profileId)
  if (!id) throw criarErroScoringProfileService('validacao', 'Perfil remoto invalido para salvar blocos.')
  const { cliente } = await validarSessaoScoringProfileService()
  const operacao = prepararOperacaoScoringProfileService('replace_blocks', `${id}:${Number(version || 1)}`, {
    id,
    version: Number(version || 1),
    blocos
  }, opcoes)
  const resultado = await executarRpcScoringProfileService(cliente, 'replace_scoring_profile_blocks', {
    p_operation_id: operacao.operationId,
    p_profile_id: id,
    p_version: Number(version || 1),
    p_blocks: blocos
  }, 'salvar blocos de pontuacao')
  const completo = await carregarVersaoCompleta(resultado.profile_id || id, resultado.version || version)
  concluirOperacaoScoringProfileService(operacao)
  return completo
}

async function alterarAtivoScoringProfileService(profileId, ativo) {
  const id = obterIdRemotoScoringProfileService(profileId)
  if (!id) throw criarErroScoringProfileService('validacao', 'Perfil remoto invalido.')
  const { cliente, userId } = await validarSessaoScoringProfileService()
  const resposta = await cliente
    .from('scoring_profiles')
    .update({ active: Boolean(ativo) })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .single()
  if (resposta?.error) throw normalizarErroScoringProfileService(resposta.error, ativo ? 'ativar perfil' : 'desativar perfil')
  return carregarVersaoCompleta(id)
}

function ativarPerfilPontuacao(profileId) {
  return alterarAtivoScoringProfileService(profileId, true)
}

function desativarPerfilPontuacao(profileId) {
  return alterarAtivoScoringProfileService(profileId, false)
}

async function verificarVersaoUtilizada(profileId, version = null) {
  const perfil = await carregarVersaoCompleta(profileId, version)
  return {
    utilizada: Boolean(perfil.metadados?.lockedAt || perfil.metadados?.bloqueado),
    lockedAt: perfil.metadados?.lockedAt || null,
    perfil
  }
}

async function importarPerfilLocalPontuacao(localProfileId, opcoes = {}) {
  const locais = carregarPerfisLocaisScoringProfileService()
  const perfil = locais.find(item => item.id === localProfileId || item.metadados?.localId === localProfileId)
  if (!perfil) throw criarErroScoringProfileService('validacao', 'Perfil local nao encontrado para importacao.')

  const localId = perfil.metadados?.localId || localProfileId
  const operationIdLocal = opcoes.operationId || perfil.metadados?.importOperationId || gerarUuidOperacaoScoringProfileService()
  registrarOperacaoImportacaoLocalScoringProfileService(localId, operationIdLocal)

  const opcoesImportacao = {
    ...opcoes,
    operationId: operationIdLocal,
    operationType: 'import_local_profile',
    operationKey: localId,
    persistente: true
  }
  const remoto = await criarPerfilPontuacao({
    ...perfil,
    id: undefined,
    versao: 1,
    metadados: {
      ...(perfil.metadados || {}),
      importadoDePerfilLocal: localId
    }
  }, opcoesImportacao)
  registrarImportacaoLocalScoringProfileService(localId, remoto.id)
  return remoto
}

const ScoringProfileService = {
  listarPerfisPontuacao,
  obterPerfilPontuacao,
  criarPerfilPontuacao,
  duplicarPerfilPontuacao,
  criarNovaVersaoPontuacao,
  salvarPerfilPontuacao,
  salvarBlocosPontuacao,
  ativarPerfilPontuacao,
  desativarPerfilPontuacao,
  carregarVersaoCompleta,
  verificarVersaoUtilizada,
  importarPerfilLocalPontuacao,
  carregarPerfisLocaisScoringProfileService,
  normalizarErroScoringProfileService,
  obterMensagemErroScoringProfileService,
  serializarVersaoScoringProfileService,
  serializarBlocosScoringProfileService,
  gerarUuidOperacaoScoringProfileService,
  prepararOperacaoScoringProfileService
}

if (typeof globalThis !== 'undefined') {
  globalThis.ScoringProfileService = ScoringProfileService
  Object.assign(globalThis, ScoringProfileService)
}
