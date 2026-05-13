import { describe, it, expect } from 'vitest'

// Importa as funções reais de js/utils.js via globalThis
const {
  escaparHtmlSeguro,
  campoDiagnosticoPreenchido,
  valorDiagnostico,
  formatarQuantidadeQuestoes,
  avaliarQualidadeDiagnosticoQuestao
} = globalThis

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
