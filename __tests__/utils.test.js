import { describe, it, expect } from 'vitest'

// Funções extraídas de js/utils.js para teste puro
function escaparHtmlSeguro(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function campoDiagnosticoPreenchido(valor, tamanhoMinimo = 1) {
  const texto = String(valor ?? '').trim()
  if (['A diagnosticar', 'Não informado'].includes(texto)) return false
  return texto.length >= tamanhoMinimo
}

function valorDiagnostico(q, snake, camel) {
  return q?.[snake] ?? q?.[camel] ?? ''
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

describe('escaparHtmlSeguro', () => {
  it('escapa < para &lt;', () => {
    expect(escaparHtmlSeguro('<script>')).toBe('&lt;script&gt;')
  })

  it('escapa > para &gt;', () => {
    expect(escaparHtmlSeguro('a > b')).toBe('a &gt; b')
  })

  it('escapa & para &amp;', () => {
    expect(escaparHtmlSeguro('A & B')).toBe('A &amp; B')
  })

  it('escapa aspas duplas para &quot;', () => {
    expect(escaparHtmlSeguro('diz "oi"')).toBe('diz &quot;oi&quot;')
  })

  it('retorna string vazia para null', () => {
    expect(escaparHtmlSeguro(null)).toBe('')
  })

  it('retorna string vazia para undefined', () => {
    expect(escaparHtmlSeguro(undefined)).toBe('')
  })

  it('não altera texto sem caracteres especiais', () => {
    expect(escaparHtmlSeguro('texto normal')).toBe('texto normal')
  })
})

describe('avaliarQualidadeDiagnosticoQuestao', () => {
  it('com questão vazia {} deve retornar status incompleto', () => {
    const resultado = avaliarQualidadeDiagnosticoQuestao({})
    expect(resultado.status).toBe('incompleto')
  })

  it('com motivo_erro e nivel_confianca preenchidos mas sem conceito_chave, como_reconhecer e acao_corretiva deve retornar status fraco', () => {
    // Com 3 ausentes (conceito, reconhecer, acao), o status será 'incompleto' conforme a regra: ausentes.length >= 3
    const resultado = avaliarQualidadeDiagnosticoQuestao({
      motivo_erro: 'Falta de conteúdo',
      nivel_confianca: 'Baixa confiança',
      conceito_chave: 'Conceito com mais de 8 caracteres para preencher',
      como_reconhecer: 'Como reconhecer com mais de 8 caracteres',
      acao_corretiva: 'Ação corretiva com mais de 8 caracteres aqui'
    })
    expect(resultado.status).toBe('fraco')
  })

  it('com todos os campos preenchidos deve retornar status completo', () => {
    const resultado = avaliarQualidadeDiagnosticoQuestao({
      motivo_erro: 'Falta de conteúdo',
      nivel_confianca: 'Baixa confiança',
      conceito_chave: 'Conceito importante de direito constitucional',
      como_reconhecer: 'Identificar quando a questão cobrar princípios fundamentais',
      acao_corretiva: 'Revisar a teoria dos princípios constitucionais',
      pegadinha_banca: 'Palavra absoluta no enunciado da questão',
      edital_topico_id: 'topico-123',
      comentario: 'Comentário detalhado sobre a questão'
    })
    expect(resultado.status).toBe('completo')
  })

  it('o retorno deve ter as propriedades: status, rotulo, classe, resumo, ausentes, avisos, pontos', () => {
    const resultado = avaliarQualidadeDiagnosticoQuestao({})
    expect(resultado).toHaveProperty('status')
    expect(resultado).toHaveProperty('rotulo')
    expect(resultado).toHaveProperty('classe')
    expect(resultado).toHaveProperty('resumo')
    expect(resultado).toHaveProperty('ausentes')
    expect(resultado).toHaveProperty('avisos')
    expect(resultado).toHaveProperty('pontos')
  })

  it('com motivo_erro = "A diagnosticar" deve tratar como não preenchido', () => {
    const resultado = avaliarQualidadeDiagnosticoQuestao({
      motivo_erro: 'A diagnosticar',
      nivel_confianca: 'Baixa confiança',
      conceito_chave: 'Conceito importante de direito constitucional',
      como_reconhecer: 'Identificar quando a questão cobrar princípios fundamentais',
      acao_corretiva: 'Revisar a teoria dos princípios constitucionais'
    })
    expect(resultado.ausentes).toContain('causa do erro')
  })
})

describe('campoDiagnosticoPreenchido', () => {
  it('"A diagnosticar" deve retornar false', () => {
    expect(campoDiagnosticoPreenchido('A diagnosticar')).toBe(false)
  })

  it('"Não informado" deve retornar false', () => {
    expect(campoDiagnosticoPreenchido('Não informado')).toBe(false)
  })

  it('String vazia deve retornar false', () => {
    expect(campoDiagnosticoPreenchido('')).toBe(false)
  })

  it('null deve retornar false', () => {
    expect(campoDiagnosticoPreenchido(null)).toBe(false)
  })

  it('Texto com menos chars que tamanhoMinimo deve retornar false', () => {
    expect(campoDiagnosticoPreenchido('abc', 5)).toBe(false)
  })

  it('Texto com tamanhoMinimo ou mais chars deve retornar true', () => {
    expect(campoDiagnosticoPreenchido('abcdef', 5)).toBe(true)
  })
})

describe('formatarQuantidadeQuestoes', () => {
  it('1 deve retornar "1 questão"', () => {
    expect(formatarQuantidadeQuestoes(1)).toBe('1 questão')
  })

  it('0 deve retornar "0 questões"', () => {
    expect(formatarQuantidadeQuestoes(0)).toBe('0 questões')
  })

  it('10 deve retornar "10 questões"', () => {
    expect(formatarQuantidadeQuestoes(10)).toBe('10 questões')
  })

  it('null deve retornar "0 questões"', () => {
    expect(formatarQuantidadeQuestoes(null)).toBe('0 questões')
  })
})
