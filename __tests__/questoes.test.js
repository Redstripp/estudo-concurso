import { describe, it, expect } from 'vitest'

// Funções extraídas de js/questoes.js para teste puro
function escaparHtmlQuestao(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const CONFIG_TIPO_QUESTAO = {
  Errada: {
    rotulo: 'Errada realmente',
    motivos: [
      'A diagnosticar',
      'Falta de conteúdo',
      'Interpretação incorreta',
      'Desatenção',
      'Confusão entre conceitos',
      'Esquecimento',
      'Falta de domínio teórico',
      'Dúvida entre alternativas',
      'Falta de revisão',
      'Pegadinha',
      'Cálculo'
    ],
    niveis: ['Não informado', 'Baixa confiança', 'Dúvida', 'Confiante mas errei']
  },
  Chutada: {
    rotulo: 'Chutada / baixa confiança',
    motivos: [
      'A diagnosticar',
      'Eliminação parcial',
      'Dúvida entre alternativas',
      'Falta de certeza',
      'Chute completo',
      'Reconhecimento superficial do conteúdo'
    ],
    niveis: ['Não informado', 'Chutei', 'Dúvida forte', 'Quase confiante']
  }
}

function normalizarTipoQuestao(q) {
  if (q?.tipo_questao === 'Chutada' || q?.tipo_questao === 'Errada') return q.tipo_questao
  if (
    q?.motivo_erro === 'Chute' ||
    CONFIG_TIPO_QUESTAO.Chutada.motivos.includes(q?.motivo_erro) ||
    q?.nivel_confianca === 'Chutei'
  ) return 'Chutada'
  return 'Errada'
}

function normalizarStatusRevisao(q) {
  return q?.status_revisao === 'recuperada' ? 'recuperada' : 'pendente'
}

function questaoChutadaAcertada(q) {
  return normalizarTipoQuestao(q) === 'Chutada' && q?.alternativa_marcada === q?.alternativa_correta
}

function normalizarTextoDuplicidade(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('escaparHtmlQuestao', () => {
  it('escapa < para &lt;', () => {
    expect(escaparHtmlQuestao('<script>')).toBe('&lt;script&gt;')
  })

  it('escapa > para &gt;', () => {
    expect(escaparHtmlQuestao('a > b')).toBe('a &gt; b')
  })

  it('escapa & para &amp;', () => {
    expect(escaparHtmlQuestao('A & B')).toBe('A &amp; B')
  })

  it('escapa aspas duplas para &quot;', () => {
    expect(escaparHtmlQuestao('diz "oi"')).toBe('diz &quot;oi&quot;')
  })

  it('retorna string vazia para null', () => {
    expect(escaparHtmlQuestao(null)).toBe('')
  })

  it('retorna string vazia para undefined', () => {
    expect(escaparHtmlQuestao(undefined)).toBe('')
  })

  it('não altera texto sem caracteres especiais', () => {
    expect(escaparHtmlQuestao('texto normal')).toBe('texto normal')
  })
})

describe('normalizarTipoQuestao', () => {
  it("{ tipo_questao: 'Chutada' } deve retornar 'Chutada'", () => {
    expect(normalizarTipoQuestao({ tipo_questao: 'Chutada' })).toBe('Chutada')
  })

  it("{ tipo_questao: 'Errada' } deve retornar 'Errada'", () => {
    expect(normalizarTipoQuestao({ tipo_questao: 'Errada' })).toBe('Errada')
  })

  it("{ motivo_erro: 'Chute completo' } deve retornar 'Chutada'", () => {
    expect(normalizarTipoQuestao({ motivo_erro: 'Chute completo' })).toBe('Chutada')
  })

  it("{ nivel_confianca: 'Chutei' } deve retornar 'Chutada'", () => {
    expect(normalizarTipoQuestao({ nivel_confianca: 'Chutei' })).toBe('Chutada')
  })

  it('{} deve retornar Errada', () => {
    expect(normalizarTipoQuestao({})).toBe('Errada')
  })
})

describe('normalizarStatusRevisao', () => {
  it("{ status_revisao: 'recuperada' } deve retornar 'recuperada'", () => {
    expect(normalizarStatusRevisao({ status_revisao: 'recuperada' })).toBe('recuperada')
  })

  it("{ status_revisao: 'pendente' } deve retornar 'pendente'", () => {
    expect(normalizarStatusRevisao({ status_revisao: 'pendente' })).toBe('pendente')
  })

  it('{} deve retornar pendente', () => {
    expect(normalizarStatusRevisao({})).toBe('pendente')
  })
})

describe('questaoChutadaAcertada', () => {
  it('Questão Chutada com marcada === correta deve retornar true', () => {
    const questao = {
      tipo_questao: 'Chutada',
      alternativa_marcada: 'A',
      alternativa_correta: 'A'
    }
    expect(questaoChutadaAcertada(questao)).toBe(true)
  })

  it('Questão Chutada com marcada !== correta deve retornar false', () => {
    const questao = {
      tipo_questao: 'Chutada',
      alternativa_marcada: 'A',
      alternativa_correta: 'B'
    }
    expect(questaoChutadaAcertada(questao)).toBe(false)
  })

  it('Questão Errada com marcada === correta deve retornar false', () => {
    const questao = {
      tipo_questao: 'Errada',
      alternativa_marcada: 'A',
      alternativa_correta: 'A'
    }
    expect(questaoChutadaAcertada(questao)).toBe(false)
  })
})

describe('normalizarTextoDuplicidade', () => {
  it('Deve remover acentos', () => {
    expect(normalizarTextoDuplicidade('café')).toBe('cafe')
    expect(normalizarTextoDuplicidade('órgão')).toBe('orgao')
  })

  it('Deve converter para minúsculas', () => {
    expect(normalizarTextoDuplicidade('TEXTO')).toBe('texto')
  })

  it('Deve remover caracteres especiais', () => {
    expect(normalizarTextoDuplicidade('texto@#!especial')).toBe('texto especial')
  })

  it('Deve retornar string vazia para null', () => {
    expect(normalizarTextoDuplicidade(null)).toBe('')
  })
})
