import { describe, expect, it } from 'vitest'

const {
  calcularPontuacaoSimulado,
  calcularPontuacaoAgregadaSimulado,
  criarPerfilPontuacaoLegadoSimulado,
  restaurarResultadoPontuacaoSimulado,
  validarPerfilPontuacaoSimulado,
  normalizarPerfilPontuacaoSimulado
} = globalThis

function perfilSimples(sobrescritas = {}) {
  return {
    ...criarPerfilPontuacaoLegadoSimulado(),
    ...sobrescritas,
    valores: {
      correta: 1,
      errada: 0,
      branca: 0,
      ...(sobrescritas.valores || {})
    },
    anuladas: {
      tratamento: 'zero',
      valorEspecifico: 0,
      ...(sobrescritas.anuladas || {})
    },
    arredondamento: {
      modo: 'matematico',
      casasDecimais: 2,
      etapa: 'final',
      ...(sobrescritas.arredondamento || {})
    },
    pesos: {
      padrao: 1,
      questoes: {},
      disciplinas: {},
      blocos: {},
      tipos: {},
      ...(sobrescritas.pesos || {})
    },
    minimos: {
      notaTotal: null,
      percentualTotal: null,
      acertos: null,
      maxErros: null,
      blocos: {},
      disciplinas: {},
      ...(sobrescritas.minimos || {})
    },
    eliminacao: {
      notaNegativa: false,
      maxErros: null,
      blocos: {},
      disciplinas: {},
      ...(sobrescritas.eliminacao || {})
    }
  }
}

function questoesBase() {
  return [
    { id: 'q1', gabarito: 'A', materia_id: 'constitucional', bloco_id: 'basico', tipo_questao: 'multipla' },
    { id: 'q2', gabarito: 'B', materia_id: 'administrativo', bloco_id: 'basico', tipo_questao: 'multipla' },
    { id: 'q3', gabarito: 'C', materia_id: 'penal', bloco_id: 'especifico', tipo_questao: 'multipla' },
    { id: 'q4', gabarito: 'D', materia_id: 'penal', bloco_id: 'especifico', tipo_questao: 'multipla' }
  ]
}

function respostas(...pares) {
  return pares.map(([questao_id, resposta]) => ({ questao_id, resposta }))
}

describe('motor de pontuacao configuravel de simulados', () => {
  it('perfil A simples preserva comportamento atual com todas corretas', () => {
    const resultado = calcularPontuacaoSimulado({
      questoes: questoesBase(),
      respostas: respostas(['q1', 'A'], ['q2', 'B'], ['q3', 'C'], ['q4', 'D']),
      perfil: perfilSimples()
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.contagens).toMatchObject({ corretas: 4, erradas: 0, brancas: 0 })
    expect(resultado.notaFinal).toBe(4)
    expect(resultado.notaMaxima).toBe(4)
    expect(resultado.percentual).toBe(100)
  })

  it('perfil simples contabiliza todas erradas e todas em branco', () => {
    const erradas = calcularPontuacaoSimulado({
      questoes: questoesBase(),
      respostas: respostas(['q1', 'B'], ['q2', 'C'], ['q3', 'D'], ['q4', 'A']),
      perfil: perfilSimples()
    })
    const brancas = calcularPontuacaoSimulado({
      questoes: questoesBase(),
      respostas: [],
      perfil: perfilSimples()
    })

    expect(erradas.contagens.erradas).toBe(4)
    expect(erradas.notaFinal).toBe(0)
    expect(brancas.contagens.brancas).toBe(4)
    expect(brancas.percentual).toBe(0)
  })

  it('perfil B penalizacao integral permite nota negativa', () => {
    const resultado = calcularPontuacaoAgregadaSimulado(
      { total: 4, certas: 1, erradas: 3, brancas: 0 },
      perfilSimples({ modo: 'negative_marking', valores: { correta: 1, errada: -1, branca: 0 } })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.notaFinal).toBe(-2)
    expect(resultado.percentual).toBe(-50)
  })

  it('perfil C penalizacao parcial aceita decimais', () => {
    const resultado = calcularPontuacaoAgregadaSimulado(
      { total: 4, certas: 2, erradas: 2, brancas: 0 },
      perfilSimples({ modo: 'negative_marking', valores: { correta: 1, errada: -0.5, branca: 0 } })
    )

    expect(resultado.notaFinal).toBe(1)
    expect(resultado.percentual).toBe(25)
  })

  it('arredonda matematicamente e trunca com casas configuraveis', () => {
    const matematico = calcularPontuacaoAgregadaSimulado(
      { total: 3, certas: 2, erradas: 1, brancas: 0 },
      perfilSimples({ valores: { correta: 0.333, errada: 0, branca: 0 }, arredondamento: { modo: 'matematico', casasDecimais: 2, etapa: 'final' } })
    )
    const truncado = calcularPontuacaoAgregadaSimulado(
      { total: 3, certas: 2, erradas: 1, brancas: 0 },
      perfilSimples({ valores: { correta: 0.333, errada: 0, branca: 0 }, arredondamento: { modo: 'truncar', casasDecimais: 2, etapa: 'final' } })
    )

    expect(matematico.notaFinal).toBe(0.67)
    expect(truncado.notaFinal).toBe(0.66)
  })

  it('normaliza decimais fracionarios sem ruido antes da persistencia', () => {
    const resultado = calcularPontuacaoSimulado({
      questoes: [
        { id: 'q1', gabarito: 'A' },
        { id: 'q2', gabarito: 'B' },
        { id: 'q3', gabarito: 'C' }
      ],
      respostas: respostas(['q1', 'A'], ['q2', 'A'], ['q3', 'C']),
      perfil: perfilSimples({
        modo: 'hybrid',
        valores: { correta: 0.1, errada: -0.25, branca: 0 },
        pesos: { padrao: 0.5 },
        arredondamento: { modo: 'none', casasDecimais: 2, etapa: 'final' }
      })
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.notaBruta).toBe(-0.025)
    expect(resultado.notaFinal).toBe(-0.025)
    expect(resultado.pontosPositivos).toBe(0.1)
    expect(resultado.penalidades).toBe(-0.125)
    expect(Number.isFinite(resultado.percentual)).toBe(true)
  })

  it('arredonda para cima somente no resultado final quando configurado', () => {
    const resultado = calcularPontuacaoAgregadaSimulado(
      { total: 3, certas: 2, erradas: 1, brancas: 0 },
      perfilSimples({ valores: { correta: 0.333, errada: 0 }, arredondamento: { modo: 'cima', casasDecimais: 2, etapa: 'final' } })
    )

    expect(resultado.notaBruta).toBe(0.666)
    expect(resultado.notaFinal).toBe(0.67)
  })

  it('perfil D ponderado respeita precedencia questao > disciplina > bloco > tipo > padrao', () => {
    const perfil = perfilSimples({
      modo: 'weighted',
      pesos: {
        padrao: 1,
        tipos: { multipla: 2 },
        blocos: { basico: 3 },
        disciplinas: { constitucional: 4 },
        questoes: { q1: 5 }
      }
    })
    const resultado = calcularPontuacaoSimulado({
      questoes: questoesBase(),
      respostas: respostas(['q1', 'A'], ['q2', 'B'], ['q3', 'C']),
      perfil
    })

    expect(resultado.detalhes.find(d => d.questaoId === 'q1').peso).toBe(5)
    expect(resultado.detalhes.find(d => d.questaoId === 'q2').peso).toBe(3)
    expect(resultado.detalhes.find(d => d.questaoId === 'q3').peso).toBe(2)
    expect(resultado.notaFinal).toBe(10)
  })

  it('calcula blocos e reprova por minimo de bloco', () => {
    const resultado = calcularPontuacaoSimulado({
      questoes: questoesBase(),
      respostas: respostas(['q1', 'A'], ['q2', 'B'], ['q3', 'A'], ['q4', 'A']),
      perfil: perfilSimples({
        modo: 'weighted',
        blocos: [
          { id: 'basico', nome: 'Basico', peso: 1, notaMinima: 2 },
          { id: 'especifico', nome: 'Especifico', peso: 2, notaMinima: 2 }
        ]
      })
    })

    expect(resultado.blocos.find(b => b.id === 'basico')).toMatchObject({ notaBruta: 2, notaMaxima: 2 })
    expect(resultado.blocos.find(b => b.id === 'especifico')).toMatchObject({ notaBruta: 0, notaMaxima: 4 })
    expect(resultado.status).toBe('reprovado')
    expect(resultado.criterios.some(c => c.tipo === 'nota_bloco' && !c.aprovado)).toBe(true)
  })

  it('avalia minimo por disciplina e preserva todos os criterios avaliados', () => {
    const resultado = calcularPontuacaoSimulado({
      questoes: questoesBase(),
      respostas: respostas(['q1', 'A'], ['q2', 'B'], ['q3', 'C'], ['q4', 'A']),
      perfil: perfilSimples({
        minimos: {
          disciplinas: {
            penal: { percentual: 60 }
          }
        }
      })
    })

    expect(resultado.status).toBe('reprovado')
    expect(resultado.disciplinas.find(d => d.id === 'penal')).toMatchObject({ totalQuestoes: 2, percentual: 50 })
    expect(resultado.criterios).toEqual(expect.arrayContaining([
      expect.objectContaining({ tipo: 'percentual_disciplina', id: 'penal', aprovado: false })
    ]))
  })

  it('aplica minimo total e eliminacao por nota negativa sem confundir com erro tecnico', () => {
    const reprovado = calcularPontuacaoAgregadaSimulado(
      { total: 5, certas: 2, erradas: 3, brancas: 0 },
      perfilSimples({ minimos: { notaTotal: 3 } })
    )
    const eliminado = calcularPontuacaoAgregadaSimulado(
      { total: 4, certas: 1, erradas: 3, brancas: 0 },
      perfilSimples({ modo: 'negative_marking', valores: { correta: 1, errada: -1 }, eliminacao: { notaNegativa: true } })
    )

    expect(reprovado.ok).toBe(true)
    expect(reprovado.status).toBe('reprovado')
    expect(eliminado.ok).toBe(true)
    expect(eliminado.status).toBe('eliminado')
    expect(eliminado.motivoEliminacao).toContain('negativa')
  })

  it('registra multiplos motivos simultaneos de reprovacao e eliminacao', () => {
    const resultado = calcularPontuacaoAgregadaSimulado(
      { total: 4, certas: 1, erradas: 3, brancas: 0 },
      perfilSimples({
        modo: 'negative_marking',
        valores: { correta: 1, errada: -1 },
        minimos: { notaTotal: 2, percentualTotal: 60, maxErros: 1 },
        eliminacao: { notaNegativa: true, maxErros: 2 }
      })
    )

    expect(resultado.status).toBe('eliminado')
    expect(resultado.motivos.length).toBeGreaterThanOrEqual(5)
    expect(resultado.criterios.filter(c => !c.aprovado).length).toBeGreaterThanOrEqual(5)
  })

  it('perfil E exclui anuladas do denominador', () => {
    const resultado = calcularPontuacaoSimulado({
      questoes: [{ id: 'q1', gabarito: 'A' }, { id: 'q2', gabarito: 'B', anulada: true }],
      respostas: respostas(['q1', 'A'], ['q2', '']),
      perfil: perfilSimples({ anuladas: { tratamento: 'exclude' } })
    })

    expect(resultado.contagens.anuladas).toBe(1)
    expect(resultado.notaFinal).toBe(1)
    expect(resultado.notaMaxima).toBe(1)
    expect(resultado.percentual).toBe(100)
  })

  it('perfil F credita anuladas como acerto', () => {
    const resultado = calcularPontuacaoSimulado({
      questoes: [{ id: 'q1', gabarito: 'A' }, { id: 'q2', gabarito: 'B', anulada: true }],
      respostas: respostas(['q1', 'A']),
      perfil: perfilSimples({ anuladas: { tratamento: 'grant_correct' } })
    })

    expect(resultado.notaFinal).toBe(2)
    expect(resultado.notaMaxima).toBe(2)
    expect(resultado.percentual).toBe(100)
  })

  it('questao sem gabarito nao entra no denominador', () => {
    const resultado = calcularPontuacaoSimulado({
      questoes: [{ id: 'q1', gabarito: 'A' }, { id: 'q2' }],
      respostas: respostas(['q1', 'A'], ['q2', 'B']),
      perfil: perfilSimples()
    })

    expect(resultado.contagens.semGabarito).toBe(1)
    expect(resultado.notaMaxima).toBe(1)
    expect(resultado.percentual).toBe(100)
  })

  it('mantem categorias exclusivas e expõe denominador e excluidas', () => {
    const resultado = calcularPontuacaoSimulado({
      questoes: [
        { id: 'q1', gabarito: 'A' },
        { id: 'q2', gabarito: 'B' },
        { id: 'q3', gabarito: 'C' },
        { id: 'q4', gabarito: 'D', anulada: true },
        { id: 'q5' }
      ],
      respostas: respostas(['q1', 'A'], ['q2', 'A'], ['q4', 'D'], ['q5', 'A']),
      perfil: perfilSimples({ anuladas: { tratamento: 'exclude' } })
    })

    const c = resultado.contagens
    expect(c.corretas + c.erradas + c.brancas + c.anuladas + c.semGabarito).toBe(c.total)
    expect(c).toMatchObject({ total: 5, corretas: 1, erradas: 1, brancas: 1, anuladas: 1, semGabarito: 1, denominador: 3, excluidas: 2 })
  })

  it('rejeita respostas duplicadas, ausentes e invalidas sem contar categorias', () => {
    const duplicada = calcularPontuacaoSimulado({
      questoes: [{ id: 'q1', gabarito: 'A' }, { id: 'q1', gabarito: 'B' }],
      respostas: [],
      perfil: perfilSimples()
    })
    const respostaDuplicada = calcularPontuacaoSimulado({
      questoes: [{ id: 'q1', gabarito: 'A' }],
      respostas: respostas(['q1', 'A'], ['q1', 'B']),
      perfil: perfilSimples()
    })
    const ausente = calcularPontuacaoSimulado({
      questoes: [{ id: 'q1', gabarito: 'A' }],
      respostas: respostas(['q2', 'A']),
      perfil: perfilSimples()
    })
    const invalida = calcularPontuacaoSimulado({
      questoes: [{ id: 'q1', gabarito: 'A', alternativas: { A: 'um', B: 'dois' } }],
      respostas: respostas(['q1', 'Z']),
      perfil: perfilSimples()
    })

    expect(duplicada).toMatchObject({ ok: false })
    expect(duplicada.erros.join(' ')).toContain('duplicada')
    expect(respostaDuplicada.erros.join(' ')).toContain('Resposta duplicada')
    expect(ausente.erros.join(' ')).toContain('questao ausente')
    expect(invalida.erros.join(' ')).toContain('Resposta invalida')
  })

  it('rejeita perfil invalido com mensagens compreensiveis', () => {
    const validacao = validarPerfilPontuacaoSimulado(perfilSimples({
      modo: 'negative_marking',
      valores: { errada: 0 },
      notaMaxima: 10,
      minimos: { notaTotal: 11 }
    }))

    expect(validacao.ok).toBe(false)
    expect(validacao.erros.join(' ')).toContain('Nota minima total')
    expect(validacao.erros.join(' ')).toContain('penalizacao')
  })

  it('rejeita peso negativo, bloco duplicado e questao em blocos simultaneos', () => {
    const validacao = validarPerfilPontuacaoSimulado(perfilSimples({
      pesos: { padrao: 1, questoes: { q1: -1 } },
      blocos: [
        { id: 'basico', nome: 'Basico', questoes: ['q2'] },
        { id: 'basico', nome: 'Basico repetido' },
        { id: 'especifico', nome: 'Especifico', questoes: ['q2'] }
      ]
    }))

    expect(validacao.ok).toBe(false)
    expect(validacao.erros.join(' ')).toContain('Pesos nao podem ser negativos')
    expect(validacao.erros.join(' ')).toContain('duplicado')
    expect(validacao.erros.join(' ')).toContain('mais de um bloco')
  })

  it('snapshot preserva resultado quando o perfil muda depois', () => {
    const perfil = perfilSimples({ id: 'perfil-mutavel', valores: { correta: 1, errada: -0.5 } })
    const resultado = calcularPontuacaoAgregadaSimulado({ total: 2, certas: 1, erradas: 1 }, perfil)
    perfil.valores.errada = -1
    const restaurado = restaurarResultadoPontuacaoSimulado({
      total_questoes: 2,
      certas: 1,
      erradas: 1,
      nota_percentual: resultado.percentual,
      scoring_snapshot: resultado.snapshot,
      score_final: resultado.notaFinal,
      score_raw: resultado.notaBruta,
      score_max: resultado.notaMaxima,
      score_status: resultado.status
    })

    expect(restaurado.notaFinal).toBe(0.5)
    expect(restaurado.perfilNome).toBe('Padrao atual')
    expect(resultado.snapshot.detalhes).toHaveLength(2)
  })

  it('resultado antigo e interpretado como legacy_simple sem regravar dados', () => {
    const restaurado = restaurarResultadoPontuacaoSimulado({
      total_questoes: 10,
      certas: 7,
      erradas: 2,
      nota_percentual: 70
    })

    expect(restaurado.perfilNome).toBe('Padrao atual')
    expect(restaurado.contagens.brancas).toBe(1)
    expect(restaurado.percentual).toBe(70)
  })

  it('resultado antigo com total zero permanece legado e nao fabrica snapshot', () => {
    const restaurado = restaurarResultadoPontuacaoSimulado({
      total_questoes: 0,
      certas: 0,
      erradas: 0,
      nota_percentual: null,
      comentario: null
    })

    expect(restaurado.status).toBe('legado')
    expect(restaurado.notaMaxima).toBe(0)
    expect(restaurado.percentual).toBe(0)
    expect(restaurado.criterios).toEqual([])
  })

  it('normalizacao nao mistura pesos entre usuarios sinteticos', () => {
    const perfilUsuarioA = normalizarPerfilPontuacaoSimulado(perfilSimples({
      pesos: { disciplinas: { constitucional: 2 } },
      metadados: { user_id: 'usuario-a' }
    }))
    const perfilUsuarioB = normalizarPerfilPontuacaoSimulado(perfilSimples({
      metadados: { user_id: 'usuario-b' }
    }))
    const q = [{ id: 'q1', gabarito: 'A', materia_id: 'constitucional' }]

    expect(calcularPontuacaoSimulado({ questoes: q, respostas: respostas(['q1', 'A']), perfil: perfilUsuarioA }).notaFinal).toBe(2)
    expect(calcularPontuacaoSimulado({ questoes: q, respostas: respostas(['q1', 'A']), perfil: perfilUsuarioB }).notaFinal).toBe(1)
  })
})
