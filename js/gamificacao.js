// js/gamificacao.js

const CHAVE_REVISOES_CONCLUIDAS_GAMIFICACAO = 'estudoConcursoRevisoesConcluidas'
const CHAVE_RECORDE_STREAK_GAMIFICACAO = 'estudoConcursoRecordeStreak'
const CHAVE_BADGES_LOCAL_GAMIFICACAO = 'estudoConcursoBadges'

const BADGES_GAMIFICACAO = [
  {
    chave: 'primeiro_erro',
    icone: '\u{1F947}',
    nome: 'Primeiro Erro Registrado',
    descricao: '1\u00aa quest\u00e3o no caderno'
  },
  {
    chave: 'streak_3',
    icone: '\u{1F4C5}',
    nome: '3 Dias Seguidos',
    descricao: 'streak de 3 dias'
  },
  {
    chave: 'questoes_10',
    icone: '\u{1F51F}',
    nome: '10 Quest\u00f5es',
    descricao: '10 quest\u00f5es registradas'
  },
  {
    chave: 'diagnostico_completo',
    icone: '\u{1F50D}',
    nome: 'Diagn\u00f3stico Completo',
    descricao: '1 quest\u00e3o com conceito, reconhecimento e a\u00e7\u00e3o'
  },
  {
    chave: 'primeira_revisao',
    icone: '\u{1F501}',
    nome: 'Primeira Revis\u00e3o Conclu\u00edda',
    descricao: '1\u00ba clique em Marcar revis\u00e3o conclu\u00edda'
  },
  {
    chave: 'questoes_100',
    icone: '\u{1F4AF}',
    nome: '100 Quest\u00f5es',
    descricao: '100 quest\u00f5es registradas'
  },
  {
    chave: 'cacador_padroes',
    icone: '\u{1F9E0}',
    nome: 'Ca\u00e7ador de Padr\u00f5es',
    descricao: 'mesmo motivo de erro 5x ou mais'
  },
  {
    chave: 'streak_7',
    icone: '\u{1F5D3}\uFE0F',
    nome: '7 Dias Seguidos',
    descricao: 'streak de 7 dias'
  },
  {
    chave: 'diagnostico_forte_10',
    icone: '\u2B50',
    nome: 'Diagn\u00f3stico Forte',
    descricao: '10 quest\u00f5es com diagn\u00f3stico forte'
  },
  {
    chave: 'streak_30',
    icone: '\u{1F3C6}',
    nome: '30 Dias Seguidos',
    descricao: 'streak de 30 dias'
  }
]

async function obterResumoStreakGamificacao(userId = window.usuarioAtual?.id) {
  if (!userId) {
    return { streak: 0, recorde: 0, atividadeHoje: false, sequenciaEmRisco: false, datas: [] }
  }

  const datas = await buscarDatasAtividadeGamificacao(userId)
  const hoje = dataHojeGamificacao()
  const ontem = adicionarDiasGamificacao(hoje, -1)
  const conjunto = new Set(datas)
  const atividadeHoje = conjunto.has(hoje)
  const base = atividadeHoje ? hoje : conjunto.has(ontem) ? ontem : null
  const streak = base ? contarSequenciaGamificacao(conjunto, base) : 0
  const recordeCalculado = calcularRecordeGamificacao(datas)
  const recordeSalvo = obterRecordeStreakLocal(userId)
  const recorde = Math.max(recordeCalculado, recordeSalvo, streak)

  salvarRecordeStreakLocal(userId, recorde)

  return {
    streak,
    recorde,
    atividadeHoje,
    sequenciaEmRisco: !atividadeHoje,
    datas
  }
}

async function buscarDatasAtividadeGamificacao(userId) {
  const datas = new Set()
  const hoje = dataHojeGamificacao()
  const dataLimite = adicionarDiasGamificacao(hoje, -120)

  const [questoesResp, certasResp, configResp] = await Promise.all([
    db
      .from('questoes')
      .select('criado_em')
      .eq('user_id', userId)
      .gte('criado_em', dataLimite)
      .order('criado_em', { ascending: true })
      .limit(2000),
    db
      .from('questoes_certas')
      .select('criado_em')
      .eq('user_id', userId)
      .gte('criado_em', dataLimite)
      .order('criado_em', { ascending: true })
      .limit(2000),
    db
      .from('configuracoes_revisao')
      .select('ultima_revisao_geral')
      .eq('user_id', userId)
      .maybeSingle()
  ])

  if (questoesResp.error) {
    throw criarErroGamificacao('Nao foi possivel calcular sua sequencia por questoes registradas.', questoesResp.error)
  }
  if (certasResp.error) {
    throw criarErroGamificacao('Nao foi possivel calcular sua sequencia por acertos registrados.', certasResp.error)
  }

  ;(questoesResp.data || []).forEach(item => adicionarDataNormalizadaGamificacao(datas, item.criado_em))
  ;(certasResp.data || []).forEach(item => adicionarDataNormalizadaGamificacao(datas, item.criado_em))
  if (configResp.data?.ultima_revisao_geral) adicionarDataNormalizadaGamificacao(datas, configResp.data.ultima_revisao_geral)
  carregarRevisoesConcluidasLocais(userId).forEach(data => adicionarDataNormalizadaGamificacao(datas, data))

  return Array.from(datas).sort()
}

function criarErroGamificacao(mensagem, erroOriginal) {
  const erro = new Error(mensagem)
  erro.detalhe = erroOriginal?.message || erroOriginal?.details || ''
  return erro
}

function adicionarDataNormalizadaGamificacao(conjunto, valor) {
  const data = String(valor || '').substring(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) conjunto.add(data)
}

function contarSequenciaGamificacao(conjunto, dataBase) {
  let total = 0
  let data = dataBase

  while (conjunto.has(data)) {
    total += 1
    data = adicionarDiasGamificacao(data, -1)
  }

  return total
}

function calcularRecordeGamificacao(datas) {
  const ordenadas = [...new Set(datas)].sort()
  if (ordenadas.length === 0) return 0

  let recorde = 1
  let atual = 1

  for (let i = 1; i < ordenadas.length; i += 1) {
    const anterior = ordenadas[i - 1]
    const esperada = adicionarDiasGamificacao(anterior, 1)
    if (ordenadas[i] === esperada) {
      atual += 1
    } else {
      atual = 1
    }
    recorde = Math.max(recorde, atual)
  }

  return recorde
}

async function avaliarConquistasUsuario(opcoes = {}) {
  const userId = window.usuarioAtual?.id
  if (!userId) return []

  const mostrarToasts = opcoes.mostrarToasts !== false
  const dados = await buscarDadosConquistasGamificacao(userId)
  const conquistadasAtuais = await buscarBadgesConquistados(userId)
  const novas = BADGES_GAMIFICACAO
    .filter(badge => dados.condicoes[badge.chave])
    .filter(badge => !conquistadasAtuais.has(badge.chave))

  for (const badge of novas) {
    const salva = await salvarBadgeConquistado(userId, badge.chave)
    if (salva && mostrarToasts) mostrarToastConquista(badge)
  }

  if (opcoes.atualizarPerfil) {
    await carregarConquistasPerfil({ avaliar: false })
  }

  return novas
}

async function buscarDadosConquistasGamificacao(userId) {
  const [questoesResp, configResp, streak] = await Promise.all([
    db
      .from('questoes')
      .select('id, motivo_erro, conceito_chave, como_reconhecer, acao_corretiva, pegadinha_banca, criado_em')
      .eq('user_id', userId)
      .limit(5000),
    db
      .from('configuracoes_revisao')
      .select('ultima_revisao_geral')
      .eq('user_id', userId)
      .maybeSingle(),
    obterResumoStreakGamificacao(userId)
  ])

  if (questoesResp.error) {
    throw criarErroGamificacao('Nao foi possivel avaliar suas conquistas.', questoesResp.error)
  }

  const questoes = questoesResp.data || []
  const totalQuestoes = questoes.length
  const totalDiagnosticoCompleto = questoes.filter(q =>
    campoConquistaPreenchido(q.conceito_chave) &&
    campoConquistaPreenchido(q.como_reconhecer) &&
    campoConquistaPreenchido(q.acao_corretiva)
  ).length
  const totalDiagnosticoForte = questoes.filter(q =>
    typeof avaliarQualidadeDiagnosticoQuestao === 'function' &&
    avaliarQualidadeDiagnosticoQuestao(q).status === 'completo'
  ).length
  const motivoRepetido = Object.values(questoes.reduce((acc, q) => {
    const motivo = String(q.motivo_erro || '').trim()
    if (!motivo || motivo === 'A diagnosticar') return acc
    acc[motivo] = (acc[motivo] || 0) + 1
    return acc
  }, {})).some(total => total >= 5)
  const revisaoConcluida = Boolean(
    configResp.data?.ultima_revisao_geral ||
    carregarRevisoesConcluidasLocais(userId).length
  )
  const maiorStreak = Math.max(streak.streak, streak.recorde)

  return {
    questoes,
    streak,
    condicoes: {
      primeiro_erro: totalQuestoes >= 1,
      streak_3: maiorStreak >= 3,
      questoes_10: totalQuestoes >= 10,
      diagnostico_completo: totalDiagnosticoCompleto >= 1,
      primeira_revisao: revisaoConcluida,
      questoes_100: totalQuestoes >= 100,
      cacador_padroes: motivoRepetido,
      streak_7: maiorStreak >= 7,
      diagnostico_forte_10: totalDiagnosticoForte >= 10,
      streak_30: maiorStreak >= 30
    }
  }
}

function campoConquistaPreenchido(valor) {
  return String(valor || '').trim().length >= 3
}

async function carregarConquistasPerfil(opcoes = {}) {
  const container = document.getElementById('perfil-conquistas-grid')
  if (!container || !window.usuarioAtual?.id) return

  container.innerHTML = '<p class="texto-placeholder">Buscando suas conquistas...</p>'

  try {
    if (opcoes.avaliar !== false) {
      await avaliarConquistasUsuario({ mostrarToasts: true, atualizarPerfil: false })
    }

    const conquistadas = await buscarBadgesConquistados(window.usuarioAtual.id)
    container.innerHTML = BADGES_GAMIFICACAO
      .map(badge => criarCardConquistaPerfil(badge, conquistadas.has(badge.chave)))
      .join('')
  } catch (erro) {
    console.error(erro)
    container.innerHTML = '<p class="texto-placeholder">Nao foi possivel carregar as conquistas agora.</p>'
  }
}

function criarCardConquistaPerfil(badge, conquistada) {
  return `
    <article class="conquista-card ${conquistada ? 'conquista-card--ativa' : 'conquista-card--bloqueada'}">
      <span class="conquista-icone">${conquistada ? badge.icone : '\u{1F512}'}</span>
      <strong>${escaparHtmlSeguro(badge.nome)}</strong>
      <p>${escaparHtmlSeguro(badge.descricao)}</p>
    </article>
  `
}

async function buscarBadgesConquistados(userId) {
  const locais = new Set(carregarBadgesLocais(userId))

  try {
    const { data, error } = await db
      .from('user_badges')
      .select('badge_key')
      .eq('user_id', userId)

    if (error) throw error
    ;(data || []).forEach(item => locais.add(item.badge_key))
  } catch (erro) {
    console.warn('Badges usando armazenamento local. Execute o SQL das conquistas para persistir no Supabase.', erro)
  }

  return locais
}

async function salvarBadgeConquistado(userId, badgeKey) {
  const locais = new Set(carregarBadgesLocais(userId))
  if (locais.has(badgeKey)) return false

  try {
    const { error } = await db
      .from('user_badges')
      .insert({
        user_id: userId,
        badge_key: badgeKey
      })

    if (error && error.code !== '23505') throw error
  } catch (erro) {
    console.warn('Badge salvo localmente por falta da tabela user_badges.', erro)
  }

  locais.add(badgeKey)
  salvarBadgesLocais(userId, Array.from(locais))
  return true
}

function mostrarToastConquista(badge) {
  let container = document.getElementById('toast-conquista-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-conquista-container'
    container.className = 'toast-conquista-container'
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.className = 'toast-conquista'
  toast.textContent = `\u{1F3C5} Nova conquista: ${badge.nome}!`
  container.appendChild(toast)

  setTimeout(() => {
    toast.classList.add('toast-conquista--saindo')
    setTimeout(() => toast.remove(), 250)
  }, 4000)
}

function registrarRevisaoConcluidaGamificacao(userId = window.usuarioAtual?.id) {
  if (!userId) return
  const datas = new Set(carregarRevisoesConcluidasLocais(userId))
  datas.add(dataHojeGamificacao())
  localStorage.setItem(chaveRevisoesConcluidasGamificacao(userId), JSON.stringify(Array.from(datas).sort()))
}

function carregarRevisoesConcluidasLocais(userId) {
  try {
    return JSON.parse(localStorage.getItem(chaveRevisoesConcluidasGamificacao(userId)) || '[]')
  } catch {
    return []
  }
}

function chaveRevisoesConcluidasGamificacao(userId) {
  return `${CHAVE_REVISOES_CONCLUIDAS_GAMIFICACAO}:${userId}`
}

function carregarBadgesLocais(userId) {
  try {
    return JSON.parse(localStorage.getItem(`${CHAVE_BADGES_LOCAL_GAMIFICACAO}:${userId}`) || '[]')
  } catch {
    return []
  }
}

function salvarBadgesLocais(userId, badges) {
  localStorage.setItem(`${CHAVE_BADGES_LOCAL_GAMIFICACAO}:${userId}`, JSON.stringify(badges))
}

function obterRecordeStreakLocal(userId) {
  return Number(localStorage.getItem(`${CHAVE_RECORDE_STREAK_GAMIFICACAO}:${userId}`) || 0)
}

function salvarRecordeStreakLocal(userId, recorde) {
  localStorage.setItem(`${CHAVE_RECORDE_STREAK_GAMIFICACAO}:${userId}`, String(recorde))
}

function dataHojeGamificacao() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

function adicionarDiasGamificacao(dataISO, dias) {
  const data = new Date(`${dataISO}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}
