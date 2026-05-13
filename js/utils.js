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

function formatarQuantidadeQuestoes(quantidade) {
  const total = Number(quantidade) || 0
  return total === 1 ? '1 questão' : `${total} questões`
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

// Exportações apenas para testes (Vitest)
// No navegador, essas linhas são ignoradas pois o script é carregado como tradicional
if (typeof globalThis !== 'undefined' && typeof globalThis.window === 'undefined') {
  // Ambiente Node/Vitest
  const exportsObj = {
    escaparHtmlSeguro,
    formatarQuantidadeQuestoes,
    avaliarQualidadeDiagnosticoQuestao,
    valorDiagnostico,
    campoDiagnosticoPreenchido,
    criarResumoQualidadeDiagnostico,
    criarAlertaCadastroFracoQuestao,
    calcularPorcentagem,
    formatarData
  }
  
  // Compatibilidade com ES modules no Vitest
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj
  }
  
  // Para Vitest com type: module
  globalThis.escaparHtmlSeguro = escaparHtmlSeguro
  globalThis.formatarQuantidadeQuestoes = formatarQuantidadeQuestoes
  globalThis.avaliarQualidadeDiagnosticoQuestao = avaliarQualidadeDiagnosticoQuestao
  globalThis.valorDiagnostico = valorDiagnostico
  globalThis.campoDiagnosticoPreenchido = campoDiagnosticoPreenchido
  globalThis.criarResumoQualidadeDiagnostico = criarResumoQualidadeDiagnostico
  globalThis.criarAlertaCadastroFracoQuestao = criarAlertaCadastroFracoQuestao
  globalThis.calcularPorcentagem = calcularPorcentagem
  globalThis.formatarData = formatarData
}
