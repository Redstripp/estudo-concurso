import { describe, it, expect } from 'vitest'

// Importa as funções reais de js/questoes.js via globalThis
const {
  escaparHtmlSeguro,
  CONFIG_TIPO_QUESTAO,
  normalizarTipoQuestao,
  normalizarStatusRevisao,
  obterTipoQuestaoPorCampos,
  questaoChutadaAcertada,
  normalizarTextoDuplicidade,
  ordenarQuestoes
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

describe('obterTipoQuestaoPorCampos', () => {
  it('identifica Chutada por motivo exclusivo de chute', () => {
    expect(obterTipoQuestaoPorCampos('Chute completo', '', 'motivo')).toBe('Chutada')
  })

  it('identifica Errada por motivo exclusivo de erro', () => {
    expect(obterTipoQuestaoPorCampos('Falta de conteúdo', '', 'motivo')).toBe('Errada')
  })

  it('prioriza o campo alterado para reverter de Chutada para Errada', () => {
    expect(obterTipoQuestaoPorCampos('Falta de conteúdo', 'Chutei', 'motivo')).toBe('Errada')
  })

  it('não força troca de tipo com valores compartilhados', () => {
    expect(obterTipoQuestaoPorCampos('Dúvida entre alternativas', 'Não informado')).toBe('')
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

describe('ordenarQuestoes', () => {
  const questoes = [
    {
      id: 'antiga',
      criado_em: '2025-01-01T10:00:00Z',
      revisar_novamente_em: '2025-01-10',
      materias: { nome: 'Zoologia' },
      motivo_erro: 'A diagnosticar',
      nivel_confianca: 'Não informado'
    },
    {
      id: 'recente',
      criado_em: '2025-01-03T10:00:00Z',
      revisar_novamente_em: '2025-01-08',
      materias: { nome: 'Administrativo' },
      motivo_erro: 'Desatenção',
      nivel_confianca: 'Dúvida',
      conceito_chave: 'Conceito suficiente',
      como_reconhecer: 'Reconhecer pelo comando da questão',
      acao_corretiva: 'Revisar antes de responder',
      comentario: 'Comentário útil para revisão'
    },
    {
      id: 'meio',
      criado_em: '2025-01-02T10:00:00Z',
      revisar_novamente_em: '2025-01-09',
      materias: { nome: 'Constitucional' },
      motivo_erro: 'Pegadinha',
      nivel_confianca: 'Baixa confiança'
    }
  ]

  it('ordena mais recentes primeiro', () => {
    expect(ordenarQuestoes(questoes, 'recente').map(q => q.id)).toEqual(['recente', 'meio', 'antiga'])
  })

  it('ordena mais antigas primeiro', () => {
    expect(ordenarQuestoes(questoes, 'antigas').map(q => q.id)).toEqual(['antiga', 'meio', 'recente'])
  })

  it('ordena por matéria em ordem alfabética', () => {
    expect(ordenarQuestoes(questoes, 'materia').map(q => q.id)).toEqual(['recente', 'meio', 'antiga'])
  })

  it('ordena revisão vencida primeiro pela data de revisão', () => {
    expect(ordenarQuestoes(questoes, 'revisao').map(q => q.id)).toEqual(['recente', 'meio', 'antiga'])
  })

  it('ordena diagnóstico mais fraco primeiro', () => {
    expect(ordenarQuestoes(questoes, 'diagnostico').map(q => q.id)).toEqual(['antiga', 'meio', 'recente'])
  })
})
