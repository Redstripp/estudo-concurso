import { describe, it, expect, vi } from 'vitest'

// Importa as funções reais de js/questoes.js via globalThis
const {
  escaparHtmlSeguro,
  CONFIG_TIPO_QUESTAO,
  normalizarTipoQuestao,
  normalizarStatusRevisao,
  obterTipoQuestaoPorCampos,
  questaoChutadaAcertada,
  normalizarTextoDuplicidade,
  ordenarQuestoes,
  extrairCamposRespostaChatGPT,
  identificarCampoRespostaChatGPT,
  obterOuCriarSessaoDeHoje,
  recalcularTotalQuestoesSessao
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

describe('parser da resposta manual da IA', () => {
  it('nao transforma linhas de pegadinhas com conceito em rotulo CONCEITO', () => {
    const resposta = `PEGADINHAS:
Troca de termos parecidos: a questão troca características da Sociedade de Empréstimo entre Pessoas e da Sociedade de Crédito Direto.
Inversão de conceito: a afirmativa II atribui à Sociedade de Empréstimo entre Pessoas a oferta de crédito com recursos próprios, mas o comentário informa que são recursos de terceiros.
Inversão de conceito: a afirmativa III diz que a Sociedade de Crédito Direto pode captar recursos diretamente do público, mas ela não está autorizada a fazer isso.
Confusão entre conceitos: a afirmativa IV atribui à Sociedade de Crédito Direto a infraestrutura eletrônica para conectar credores e tomadores, mas essa característica é da Sociedade de Empréstimo entre Pessoas.

CONCEITO:
Diferença entre os dois tipos de fintechs de crédito: Sociedade de Empréstimo entre Pessoas realiza intermediação financeira entre credores e devedores, usando recursos de terceiros e oferecendo infraestrutura eletrônica para conectar credores e tomadores. Sociedade de Crédito Direto não está autorizada a captar recursos diretamente do público para concessão de crédito.

RECONHECER:
Observar os nomes das instituições: “Sociedade de Empréstimo entre Pessoas” e “Sociedade de Crédito Direto”. Quando a questão mencionar “intermediação”, “recursos de terceiros” ou “conectar credores e tomadores”, associar à Sociedade de Empréstimo entre Pessoas. Quando aparecer “captar recursos diretamente do público”, identificar como afirmação incorreta para Sociedade de Crédito Direto.

ACAO:
Criar um quadro comparativo entre Sociedade de Empréstimo entre Pessoas e Sociedade de Crédito Direto, destacando: quem usa recursos próprios ou de terceiros, quem conecta credores e tomadores, quem faz intermediação e quem não pode captar recursos diretamente do público. Fazer questões semelhantes focando nas trocas de características entre essas duas fintechs.`

    const campos = extrairCamposRespostaChatGPT(resposta)

    expect(campos.pegadinhas.split('\n')).toEqual([
      'Troca de termos parecidos: a questão troca características da Sociedade de Empréstimo entre Pessoas e da Sociedade de Crédito Direto.',
      'Inversão de conceito: a afirmativa II atribui à Sociedade de Empréstimo entre Pessoas a oferta de crédito com recursos próprios, mas o comentário informa que são recursos de terceiros.',
      'Inversão de conceito: a afirmativa III diz que a Sociedade de Crédito Direto pode captar recursos diretamente do público, mas ela não está autorizada a fazer isso.',
      'Confusão entre conceitos: a afirmativa IV atribui à Sociedade de Crédito Direto a infraestrutura eletrônica para conectar credores e tomadores, mas essa característica é da Sociedade de Empréstimo entre Pessoas.'
    ])
    expect(campos.conceito).toBe('Diferença entre os dois tipos de fintechs de crédito: Sociedade de Empréstimo entre Pessoas realiza intermediação financeira entre credores e devedores, usando recursos de terceiros e oferecendo infraestrutura eletrônica para conectar credores e tomadores. Sociedade de Crédito Direto não está autorizada a captar recursos diretamente do público para concessão de crédito.')
    expect(campos.reconhecer).toBe('Observar os nomes das instituições: “Sociedade de Empréstimo entre Pessoas” e “Sociedade de Crédito Direto”. Quando a questão mencionar “intermediação”, “recursos de terceiros” ou “conectar credores e tomadores”, associar à Sociedade de Empréstimo entre Pessoas. Quando aparecer “captar recursos diretamente do público”, identificar como afirmação incorreta para Sociedade de Crédito Direto.')
    expect(campos.acao).toBe('Criar um quadro comparativo entre Sociedade de Empréstimo entre Pessoas e Sociedade de Crédito Direto, destacando: quem usa recursos próprios ou de terceiros, quem conecta credores e tomadores, quem faz intermediação e quem não pode captar recursos diretamente do público. Fazer questões semelhantes focando nas trocas de características entre essas duas fintechs.')
    expect(campos.conceito).not.toContain('Inversão de conceito:')
    expect(campos.conceito).not.toContain('Confusão entre conceitos:')
  })

  it('reconhece apenas rotulos oficiais isolados', () => {
    expect(identificarCampoRespostaChatGPT('PEGADINHAS')).toBe('pegadinhas')
    expect(identificarCampoRespostaChatGPT('PEGADINHA')).toBe('pegadinhas')
    expect(identificarCampoRespostaChatGPT('CONCEITO')).toBe('conceito')
    expect(identificarCampoRespostaChatGPT('CONCEITO-CHAVE')).toBe('conceito')
    expect(identificarCampoRespostaChatGPT('RECONHECER')).toBe('reconhecer')
    expect(identificarCampoRespostaChatGPT('COMO RECONHECER')).toBe('reconhecer')
    expect(identificarCampoRespostaChatGPT('COMO RECONHECER NA PRÓXIMA VEZ')).toBe('reconhecer')
    expect(identificarCampoRespostaChatGPT('ACAO')).toBe('acao')
    expect(identificarCampoRespostaChatGPT('AÇÃO')).toBe('acao')
    expect(identificarCampoRespostaChatGPT('ACAO CORRETIVA')).toBe('acao')
    expect(identificarCampoRespostaChatGPT('AÇÃO CORRETIVA')).toBe('acao')
    expect(identificarCampoRespostaChatGPT('Inversão de conceito')).toBeNull()
    expect(identificarCampoRespostaChatGPT('Confusão entre conceitos')).toBeNull()
    expect(identificarCampoRespostaChatGPT('Troca de conceitos')).toBeNull()
    expect(identificarCampoRespostaChatGPT('Troca de termos parecidos')).toBeNull()
    expect(identificarCampoRespostaChatGPT('Explicação')).toBeNull()
    expect(identificarCampoRespostaChatGPT('Interpretação')).toBeNull()
  })

  it('nao confunde EXPLICACAO com ACAO', () => {
    const campos = extrairCamposRespostaChatGPT(`PEGADINHAS:
Primeira linha.

EXPLICAÇÃO:
Esta linha não deve virar ação.

ACAO:
Fazer revisão direcionada.`)

    expect(campos.pegadinhas).toBe('Primeira linha.\n\nEXPLICAÇÃO:\nEsta linha não deve virar ação.')
    expect(campos.acao).toBe('Fazer revisão direcionada.')
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

describe('obterOuCriarSessaoDeHoje', () => {
  it('usa maybeSingle e cria a sessão quando ainda não existe registro no dia', async () => {
    const dbAnterior = globalThis.db
    const windowAnterior = globalThis.window
    let consultaSessaoUsouMaybeSingle = false
    let fromCount = 0

    const consultaSessao = {
      select() { return this },
      eq() { return this },
      single() { throw new Error('Não deve usar single na busca de sessão existente') },
      async maybeSingle() {
        consultaSessaoUsouMaybeSingle = true
        return { data: null, error: null }
      }
    }
    const criacaoSessao = {
      payload: null,
      insert(payload) {
        this.payload = payload
        return this
      },
      select() { return this },
      async single() {
        return { data: { id: 'sessao-nova', total_questoes: 0 }, error: null }
      }
    }

    globalThis.window = { usuarioAtual: { id: 'usuario-1' } }
    globalThis.db = {
      from(tabela) {
        expect(tabela).toBe('sessoes_estudo')
        fromCount += 1
        return fromCount === 1 ? consultaSessao : criacaoSessao
      }
    }

    try {
      const sessao = await obterOuCriarSessaoDeHoje()

      expect(consultaSessaoUsouMaybeSingle).toBe(true)
      expect(criacaoSessao.payload.user_id).toBe('usuario-1')
      expect(criacaoSessao.payload.total_questoes).toBe(0)
      expect(sessao).toEqual({ id: 'sessao-nova', total_questoes: 0 })
    } finally {
      globalThis.db = dbAnterior
      globalThis.window = windowAnterior
    }
  })
})

describe('recalcularTotalQuestoesSessao', () => {
  it('recalcula total da sessao somando erradas e acertos registrados', async () => {
    const dbAnterior = globalThis.db
    const usuarioAnterior = window.usuarioAtual
    const questoesChain = {
      error: null,
      count: 2,
      select: vi.fn(() => questoesChain),
      eq: vi.fn(() => questoesChain)
    }
    const certasChain = {
      error: null,
      data: [{ quantidade: 3 }, { quantidade: 2 }],
      select: vi.fn(() => certasChain),
      eq: vi.fn(() => certasChain)
    }
    const sessaoChain = {
      error: null,
      update: vi.fn(() => sessaoChain),
      eq: vi.fn(() => sessaoChain)
    }
    const from = vi.fn(tabela => {
      if (tabela === 'questoes') return questoesChain
      if (tabela === 'questoes_certas') return certasChain
      if (tabela === 'sessoes_estudo') return sessaoChain
      throw new Error(`Tabela inesperada: ${tabela}`)
    })

    globalThis.db = { from }
    window.usuarioAtual = { id: 'user-1' }

    try {
      await recalcularTotalQuestoesSessao('sessao-1')

      expect(sessaoChain.update).toHaveBeenCalledWith({ total_questoes: 7 })
      expect(sessaoChain.eq).toHaveBeenCalledWith('id', 'sessao-1')
      expect(sessaoChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    } finally {
      globalThis.db = dbAnterior
      window.usuarioAtual = usuarioAnterior
    }
  })
})
