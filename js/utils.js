// js/utils.js
// Utilitários globais para o sistema

function escaparHtmlSeguro(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderizarTextoComMarkdownBasicoSeguro(texto) {
  const escapado = escaparHtmlSeguro(texto)
  return escapado
    .replace(/\*\*([^\s*](?:[\s\S]*?[^\s*])?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^\s*](?:[\s\S]*?[^\s*])?)\*/g, '$1<strong>$2</strong>')
}

function formatarQuantidadeQuestoes(quantidade) {
  const total = Number(quantidade) || 0
  return total === 1 ? '1 questão' : `${total} questões`
}

function contarOcorrenciasValores(valores, opcoes = {}) {
  const fallback = opcoes.fallback || ''
  const contagem = {}

  ;(valores || []).forEach(valor => {
    const chave = String(valor ?? '').trim() || fallback
    if (!chave) return
    contagem[chave] = (contagem[chave] || 0) + 1
  })

  return Object.entries(contagem)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
}

function avaliarQualidadeDiagnosticoQuestao(q = {}) {
  const motivo = valorDiagnostico(q, 'motivo_erro', 'motivoErro')
  const confianca = valorDiagnostico(q, 'nivel_confianca', 'nivelConfianca')
  const conceito = valorDiagnostico(q, 'conceito_chave', 'conceitoChave')
  const reconhecer = valorDiagnostico(q, 'como_reconhecer', 'comoReconhecer')
  const acao = valorDiagnostico(q, 'acao_corretiva', 'acaoCorretiva')
  const pegadinha = valorDiagnostico(q, 'pegadinha_banca', 'pegadinhaBanca')
  const topico = valorDiagnostico(q, 'edital_topico_id', 'editalTopicoId') || q.edital_topicos?.titulo
  const comentario = valorDiagnostico(q, 'comentario', 'comentario')
  const ausentes = []
  const avisos = []

  if (!campoDiagnosticoPreenchido(motivo)) ausentes.push('causa do erro')
  if (!campoDiagnosticoPreenchido(confianca)) ausentes.push('confiança')
  if (!campoDiagnosticoPreenchido(conceito, 8)) ausentes.push('conceito ou regra')
  if (!campoDiagnosticoPreenchido(reconhecer, 8)) ausentes.push('como reconhecer')
  if (!campoDiagnosticoPreenchido(acao, 8)) ausentes.push('ação corretiva')

  const motivoTexto = String(motivo || '').toLowerCase()
  const parecePegadinha = motivoTexto.includes('pegadinha') || motivoTexto.includes('interpreta') || String(pegadinha || '').trim()
  if (parecePegadinha && !campoDiagnosticoPreenchido(pegadinha, 8)) ausentes.push('pegadinha da questão')

  if (!campoDiagnosticoPreenchido(topico)) avisos.push('sem assunto do edital')
  if (!campoDiagnosticoPreenchido(comentario, 8) && !campoDiagnosticoPreenchido(pegadinha, 8)) {
    avisos.push('sem comentário ou pegadinha')
  }

  const pontos = [
    motivo,
    confianca,
    conceito,
    reconhecer,
    acao,
    pegadinha,
    topico,
    comentario
  ].reduce((total, valor) => total + (campoDiagnosticoPreenchido(valor, 8) ? 1 : 0), 0)

  let status = 'completo'
  if (ausentes.includes('causa do erro') || ausentes.includes('confiança') || ausentes.length >= 3) {
    status = 'incompleto'
  } else if (ausentes.length > 0 || avisos.length > 0 || pontos < 6) {
    status = 'fraco'
  }

  const config = {
    completo: {
      rotulo: 'Diagnóstico forte',
      classe: 'diagnostico-qualidade--forte',
      resumo: 'Tem dados suficientes para alimentar bem a revisão inteligente.'
    },
    fraco: {
      rotulo: 'Diagnóstico fraco',
      classe: 'diagnostico-qualidade--fraco',
      resumo: 'Dá para revisar, mas faltam detalhes para o sistema entender melhor o padrão.'
    },
    incompleto: {
      rotulo: 'Diagnóstico incompleto',
      classe: 'diagnostico-qualidade--incompleto',
      resumo: 'Complete os campos essenciais para a questão entrar melhor na inteligência do sistema.'
    }
  }

  return {
    status,
    rotulo: config[status].rotulo,
    classe: config[status].classe,
    resumo: config[status].resumo,
    ausentes,
    avisos,
    pontos
  }
}

function valorDiagnostico(q, snake, camel) {
  return q?.[snake] ?? q?.[camel] ?? ''
}

function campoDiagnosticoPreenchido(valor, tamanhoMinimo = 1) {
  const texto = String(valor ?? '').trim()
  if (['A diagnosticar', 'Não informado'].includes(texto)) return false
  return texto.length >= tamanhoMinimo
}

function criarResumoQualidadeDiagnostico(qualidade, limite = 4) {
  const faltando = [...(qualidade?.ausentes || []), ...(qualidade?.avisos || [])]
  if (faltando.length === 0) return qualidade?.resumo || ''
  return `Falta ${faltando.slice(0, limite).join(', ')}${faltando.length > limite ? '...' : ''}.`
}

function criarAlertaCadastroFracoQuestao(qualidade) {
  if (!qualidade || qualidade.status === 'completo') return ''

  const titulo = qualidade.status === 'incompleto'
    ? 'Pouco útil para revisão'
    : 'Cadastro pode melhorar'
  const texto = criarResumoQualidadeDiagnostico(qualidade, 5)

  return `
    <div class="cadastro-fraco-alerta ${qualidade.classe}">
      <strong>${escaparHtmlSeguro(titulo)}</strong>
      <span>${escaparHtmlSeguro(texto)}</span>
    </div>
  `
}

function calcularPorcentagem(parcial, total) {
  if (total === 0) return 0
  return Math.round((parcial / total) * 100 * 100) / 100
}

function formatarData(data) {
  if (!(data instanceof Date) || isNaN(data.getTime())) return ''
  const dia = String(data.getDate()).padStart(2, '0')
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const ano = data.getFullYear()
  return `${dia}/${mes}/${ano}`
}

// ============================================
// FUNÇÕES DE DATA - UTILITÁRIOS GLOBAIS
// ============================================

/**
 * Converte uma data para formato ISO (YYYY-MM-DD)
 * @param {Date} data - Objeto Date
 * @returns {string} Data no formato ISO
 */
function dataISO(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

/**
 * Retorna a data de hoje em formato ISO (YYYY-MM-DD)
 * @returns {string} Data de hoje no formato ISO
 */
function dataHoje() {
  return dataISO(new Date())
}

/**
 * Adiciona dias a uma data ISO e retorna nova data ISO
 * @param {string} dataISO - Data no formato ISO (YYYY-MM-DD)
 * @param {number} dias - Quantidade de dias para adicionar
 * @returns {string} Nova data no formato ISO
 */
function adicionarDias(dataISO, dias) {
  const data = new Date(`${dataISO}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return data.toISOString().split('T')[0]
}

/**
 * Calcula dias até uma data de prova
 * @param {string} dataProva - Data da prova no formato ISO
 * @returns {number|null} Quantidade de dias ou null se sem data
 */
function calcularDiasAteProva(dataProva) {
  if (!dataProva) return null
  const hoje = new Date(dataHoje() + 'T12:00:00')
  const prova = new Date(`${dataProva}T12:00:00`)
  if (Number.isNaN(prova.getTime())) return null
  return Math.ceil((prova - hoje) / 86400000)
}

/**
 * Retorna o dia anterior a uma data ISO
 * @param {string} dataStr - Data no formato ISO
 * @returns {string} Dia anterior no formato ISO
 */
function diaAnterior(dataStr) {
  const d = new Date(dataStr + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return dataISO(d)
}

/**
 * Formata data ISO para formato curto brasileiro (DD/MM/YYYY)
 * @param {string} dataISO - Data no formato ISO
 * @returns {string} Data formatada ou '-' se vazio
 */
function formatarDataCurta(dataISO) {
  if (!dataISO) return '-'
  const [ano, mes, dia] = dataISO.substring(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

// Exportações apenas para testes (Vitest)
// No navegador, essas linhas são ignoradas pois o script é carregado como tradicional
if (typeof globalThis !== 'undefined' && typeof globalThis.window === 'undefined') {
  // Ambiente Node/Vitest
  const exportsObj = {
    escaparHtmlSeguro,
    renderizarTextoComMarkdownBasicoSeguro,
    formatarQuantidadeQuestoes,
    contarOcorrenciasValores,
    avaliarQualidadeDiagnosticoQuestao,
    valorDiagnostico,
    campoDiagnosticoPreenchido,
    criarResumoQualidadeDiagnostico,
    criarAlertaCadastroFracoQuestao,
    calcularPorcentagem,
    formatarData,
    dataISO,
    dataHoje,
    adicionarDias,
    calcularDiasAteProva,
    diaAnterior,
    formatarDataCurta
  }
  
  // Compatibilidade com ES modules no Vitest
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj
  }
  
  // Para Vitest com type: module
  globalThis.escaparHtmlSeguro = escaparHtmlSeguro
  globalThis.renderizarTextoComMarkdownBasicoSeguro = renderizarTextoComMarkdownBasicoSeguro
  globalThis.formatarQuantidadeQuestoes = formatarQuantidadeQuestoes
  globalThis.contarOcorrenciasValores = contarOcorrenciasValores
  globalThis.avaliarQualidadeDiagnosticoQuestao = avaliarQualidadeDiagnosticoQuestao
  globalThis.valorDiagnostico = valorDiagnostico
  globalThis.campoDiagnosticoPreenchido = campoDiagnosticoPreenchido
  globalThis.criarResumoQualidadeDiagnostico = criarResumoQualidadeDiagnostico
  globalThis.criarAlertaCadastroFracoQuestao = criarAlertaCadastroFracoQuestao
  globalThis.calcularPorcentagem = calcularPorcentagem
  globalThis.formatarData = formatarData
  globalThis.dataISO = dataISO
  globalThis.dataHoje = dataHoje
  globalThis.adicionarDias = adicionarDias
  globalThis.calcularDiasAteProva = calcularDiasAteProva
  globalThis.diaAnterior = diaAnterior
  globalThis.formatarDataCurta = formatarDataCurta
}
