import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  renderizarTextoSimuladoComMarkdownBasico,
  criarCardSimuladoRevisao,
  calcularProximaRevisaoSimulado,
  calcularEtapaRevisaoSimulado24730,
  normalizarTipoQuestaoSimulado,
  obterRotuloFiltroTipo,
  obterRotuloPeriodoSimuladoRevisao,
  filtrarQuestoesPorPeriodoRevisao,
  formatarDataISOParaSimulado,
  adicionarDiasDataISO,
  embaralharQuestoes,
  formatarDataSimulado,
  buscarQuestoesSimuladoRevisaoSm2,
  criarTextoAgendaSimulado,
  mapearRespostaSimuladoParaGradeSm2,
  registrarResultadoRevisao,
  registrarResultadoRevisaoSm2,
  salvarDiagnosticoSimulado,
  abrirDiagnosticoSimulado
} = globalThis

function criarQuestaoSimuladoMarkdown(sobrescritas = {}) {
  return {
    id: 'simulado-md-1',
    enunciado: 'Enunciado com **controle difuso** e <script>alert(1)</script>',
    alternativas: {
      A: '*Alternativa* com <img src=x onerror=alert(1)>',
      B: 'Alternativa correta'
    },
    alternativa_marcada: 'A',
    alternativa_correta: 'B',
    tipo_questao: 'Errada',
    status_revisao: 'pendente',
    revisar_novamente_em: '2026-06-10',
    revisao_total_acertos: 0,
    revisao_total_erros: 1,
    revisao_etapa: 0,
    motivo_erro: 'Falta de conteúdo',
    nivel_confianca: 'Dúvida',
    comentario: 'Comentário com **regra central**',
    conceito_chave: 'Conceito com **competência**',
    como_reconhecer: 'Reconhecer por *termo absoluto*',
    acao_corretiva: 'Revisar **artigo seco**',
    criado_em: '2026-06-04T12:00:00.000Z',
    materias: { nome: 'Direito Constitucional' },
    edital_topicos: { titulo: 'Controle de constitucionalidade' },
    banca: 'CEBRASPE',
    pegadinha_banca: 'Pegadinha com *palavra absoluta*',
    ...sobrescritas
  }
}

function criarStateSm2(sobrescritas = {}) {
  return {
    id: `state-${sobrescritas.questao_id || 'q-sm2'}`,
    user_id: 'user-a',
    questao_id: sobrescritas.questao_id || 'q-sm2',
    algorithm_version: 'sm2_v1',
    easiness_factor: 2.5,
    repetition_count: 1,
    interval_days: 1,
    lapse_count: 0,
    correct_streak: 1,
    total_reviews: 1,
    next_review_at: '2026-07-21T12:00:00.000Z',
    last_reviewed_at: '2026-07-20T12:00:00.000Z',
    questoes: criarQuestaoSimuladoMarkdown({
      id: sobrescritas.questao_id || 'q-sm2',
      status_revisao: 'pendente',
      revisar_novamente_em: '2026-07-20'
    }),
    ...sobrescritas
  }
}

function criarConsultaSupabase(resultado, tabela, chamadas) {
  const chain = {}
  const registrar = (metodo, args) => chamadas.push({ tabela, metodo, args })
  ;['select', 'eq', 'lte', 'order', 'limit', 'delete'].forEach(metodo => {
    chain[metodo] = vi.fn((...args) => {
      registrar(metodo, args)
      return chain
    })
  })
  chain.insert = vi.fn((payload) => {
    registrar('insert', [payload])
    return chain
  })
  chain.update = vi.fn((payload) => {
    registrar('update', [payload])
    return chain
  })
  chain.maybeSingle = vi.fn(() => {
    registrar('maybeSingle', [])
    return Promise.resolve(resultado)
  })
  chain.single = vi.fn(() => {
    registrar('single', [])
    return Promise.resolve(resultado)
  })
  chain.then = (resolve, reject) => Promise.resolve(resultado).then(resolve, reject)
  chain.catch = (reject) => Promise.resolve(resultado).catch(reject)
  return chain
}

function configurarDbSupabase(resultados = {}, rpcResultado = { data: null, error: null }) {
  const chamadas = []
  globalThis.db = {
    from: vi.fn((tabela) => criarConsultaSupabase(
      typeof resultados[tabela] === 'function' ? resultados[tabela](chamadas) : (resultados[tabela] || { data: [], error: null }),
      tabela,
      chamadas
    )),
    rpc: vi.fn(() => Promise.resolve(rpcResultado))
  }
  return chamadas
}

beforeEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  globalThis.window.usuarioAtual = { id: 'user-a' }
  delete globalThis.atualizarTelasAposRegistro
  delete globalThis.carregarQuestoes
  delete globalThis.carregarEstatisticas
})

describe('Markdown basico nos cards de Simulados', () => {
  it('renderiza negrito seguro no enunciado e nas alternativas', () => {
    const card = criarCardSimuladoRevisao(criarQuestaoSimuladoMarkdown(), 1)

    expect(card.querySelector('.card-revisao-enunciado').innerHTML)
      .toContain('<strong>controle difuso</strong>')
    expect(card.querySelector('.alt-texto').innerHTML)
      .toContain('<strong>Alternativa</strong>')
    expect(card.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(card.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(card.querySelector('script')).toBeNull()
    expect(card.querySelector('img')).toBeNull()
  })

  it('renderiza negrito seguro em comentario e diagnosticos exibidos', () => {
    const card = criarCardSimuladoRevisao(criarQuestaoSimuladoMarkdown(), 1)

    expect(card.innerHTML).toContain('<strong>regra central</strong>')
    expect(card.innerHTML).toContain('<strong>palavra absoluta</strong>')
    expect(card.innerHTML).toContain('<strong>competência</strong>')
    expect(card.innerHTML).toContain('<strong>termo absoluto</strong>')
    expect(card.innerHTML).toContain('<strong>artigo seco</strong>')
    expect(card.innerHTML).not.toContain('<script>')
  })

  it('mantem campos editaveis com Markdown literal, sem renderizar HTML', () => {
    const campos = {
      '.simulado-diagnostico-conceito': 'Conceito com **competência** e <script>alert(1)</script>',
      '.simulado-diagnostico-reconhecer': 'Reconhecer por *termo absoluto*',
      '.simulado-diagnostico-acao': 'Revisar **artigo seco**'
    }
    const card = criarCardSimuladoRevisao(criarQuestaoSimuladoMarkdown({
      conceito_chave: campos['.simulado-diagnostico-conceito'],
      como_reconhecer: campos['.simulado-diagnostico-reconhecer'],
      acao_corretiva: campos['.simulado-diagnostico-acao']
    }), 1)

    Object.entries(campos).forEach(([seletor, valor]) => {
      const textarea = card.querySelector(seletor)
      expect(textarea.value).toBe(valor)
      expect(textarea.innerHTML).not.toContain('<strong>')
      expect(textarea.querySelector('strong')).toBeNull()
    })
    expect(card.querySelector('.simulado-pre-resposta').innerHTML).not.toContain('<strong>')
  })

  it('preserva Markdown incompleto', () => {
    expect(renderizarTextoSimuladoComMarkdownBasico('*sem fechamento')).toBe('*sem fechamento')
  })
})

describe('simulados helpers', () => {
  it('calcula proxima revisao no ciclo 24h/7d/30d', () => {
    expect(calcularProximaRevisaoSimulado('2026-05-15', { revisao_etapa: 0 }, false, 'Confiante')).toBe('2026-05-16')
    expect(calcularProximaRevisaoSimulado('2026-05-15', { revisao_etapa: 0 }, true, 'Confiante')).toBe('2026-05-22')
    expect(calcularProximaRevisaoSimulado('2026-05-15', { revisao_etapa: 1 }, true, 'Confiante')).toBe('2026-06-14')
    expect(calcularProximaRevisaoSimulado('2026-05-15', { revisao_etapa: 2 }, true, 'Duvida')).toBe('2026-06-14')
    expect(calcularProximaRevisaoSimulado('2026-05-15', { revisao_etapa: 2 }, true, 'Confiante')).toBeNull()
  })

  it('calcula etapa de revisao de simulado', () => {
    expect(calcularEtapaRevisaoSimulado24730({ revisao_etapa: 2 }, false, 'Confiante', '2026-05-16')).toBe(0)
    expect(calcularEtapaRevisaoSimulado24730({ revisao_etapa: 1 }, true, 'Duvida', '2026-06-14')).toBe(1)
    expect(calcularEtapaRevisaoSimulado24730({ revisao_etapa: 1 }, true, 'Confiante', '2026-06-14')).toBe(2)
    expect(calcularEtapaRevisaoSimulado24730({ revisao_etapa: 2 }, true, 'Confiante', null)).toBe(3)
  })

  it('normaliza tipo de questao e rotulos de filtro', () => {
    expect(normalizarTipoQuestaoSimulado({ motivo_erro: 'Chute completo' })).toBe('Chutada')
    expect(normalizarTipoQuestaoSimulado({ tipo_questao: 'Errada' })).toBe('Errada')
    expect(obterRotuloFiltroTipo('Chutada')).toContain('baixa')
    expect(obterRotuloFiltroTipo('Errada')).toContain('erros')
    expect(obterRotuloPeriodoSimuladoRevisao('30')).toContain('4')
    expect(obterRotuloPeriodoSimuladoRevisao('all')).toContain('Todas')
  })

  it('retorna todas as questoes quando periodo de revisao e all', () => {
    const questoes = [{ id: 'q1' }, { id: 'q2' }]

    expect(filtrarQuestoesPorPeriodoRevisao(questoes, 'all')).toBe(questoes)
  })

  it('formata e desloca datas ISO', () => {
    expect(formatarDataISOParaSimulado(new Date('2026-05-15T12:00:00'))).toBe('2026-05-15')
    expect(adicionarDiasDataISO('2026-02-28', 1)).toBe('2026-03-01')
    expect(formatarDataSimulado('2026-05-15')).toBe('15/05/2026')
  })

  it('embaralha em uma copia sem mutar a lista original', () => {
    const questoes = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]
    const embaralhadas = embaralharQuestoes(questoes)

    expect(embaralhadas).not.toBe(questoes)
    expect(questoes.map(q => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(embaralhadas.map(q => q.id).sort()).toEqual(['q1', 'q2', 'q3'])
  })
})

describe('Simulados integrado ao scheduler SM-2', () => {
  const configSm2 = {
    review_scheduler_mode: 'sm2_v1',
    dias_revisao: [3, 6],
    review_timezone: 'America/Recife',
    review_max_interval_days: 365
  }

  it('lista somente states vencidos do usuario em dia permitido', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-22T12:00:00.000Z'))
    const due = criarStateSm2({ questao_id: 'q-due', next_review_at: '2026-07-21T12:00:00.000Z' })
    const futuro = criarStateSm2({ questao_id: 'q-future', next_review_at: '2026-07-23T12:00:00.000Z' })
    const outroUsuario = criarStateSm2({ questao_id: 'q-other', user_id: 'user-b', next_review_at: '2026-07-21T12:00:00.000Z' })
    const chamadas = configurarDbSupabase({
      questao_review_states: { data: [due, futuro, outroUsuario], error: null }
    })

    const resultado = await buscarQuestoesSimuladoRevisaoSm2('user-a', configSm2, 10)

    expect(resultado.hojePermitido).toBe(true)
    expect(resultado.data.map(q => q.id)).toEqual(['q-due'])
    expect(globalThis.db.from).toHaveBeenCalledWith('questao_review_states')
    expect(chamadas).toEqual(expect.arrayContaining([
      expect.objectContaining({ tabela: 'questao_review_states', metodo: 'eq', args: ['user_id', 'user-a'] }),
      expect.objectContaining({ tabela: 'questao_review_states', metodo: 'lte', args: ['next_review_at', expect.any(String)] })
    ]))
  })

  it('nao consulta states quando hoje nao e dia de revisao escolhido', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T12:00:00.000Z'))
    configurarDbSupabase({
      questao_review_states: { data: [criarStateSm2()], error: null }
    })

    const resultado = await buscarQuestoesSimuladoRevisaoSm2('user-a', configSm2, 10)

    expect(resultado.data).toEqual([])
    expect(resultado.hojePermitido).toBe(false)
    expect(resultado.proximaSessaoPermitida.dataISO).toBe('2026-07-22')
    expect(globalThis.db.from).not.toHaveBeenCalled()
  })

  it('recalcula a proxima oportunidade quando os dias mudam sem alterar o vencimento tecnico', () => {
    const state = { algorithm_version: 'sm2_v1', next_review_at: '2026-07-21T12:00:00.000Z' }
    const agendaQuartaSabado = globalThis.avaliarAgendaQuestaoSm2(state, configSm2, '2026-07-20T12:00:00.000Z')
    const agendaSabado = globalThis.avaliarAgendaQuestaoSm2(state, { ...configSm2, dias_revisao: [6] }, '2026-07-20T12:00:00.000Z')

    expect(agendaQuartaSabado.vencimentoTecnicoISO).toBe(state.next_review_at)
    expect(agendaQuartaSabado.proximaSessaoPermitida.dataISO).toBe('2026-07-22')
    expect(agendaSabado.vencimentoTecnicoISO).toBe(state.next_review_at)
    expect(agendaSabado.proximaSessaoPermitida.dataISO).toBe('2026-07-25')
  })

  it('exibe vencimento tecnico e proxima sessao permitida vindos do state', () => {
    const agenda = globalThis.avaliarAgendaQuestaoSm2(
      { algorithm_version: 'sm2_v1', next_review_at: '2026-07-21T12:00:00.000Z' },
      configSm2,
      '2026-07-20T12:00:00.000Z'
    )
    const texto = criarTextoAgendaSimulado({
      scheduler_mode: 'sm2_v1',
      review_state: { algorithm_version: 'sm2_v1', next_review_at: '2026-07-21T12:00:00.000Z' },
      agenda_sm2: agenda,
      revisar_novamente_em: '2026-08-30'
    })

    expect(texto).toBe('Venceu em 21/07. Próxima sessão permitida: 22/07.')
  })

  it('mapeia respostas do Simulados para grades SM-2 coerentes', () => {
    expect(mapearRespostaSimuladoParaGradeSm2(false, 'Confiante')).toBe(1)
    expect(mapearRespostaSimuladoParaGradeSm2(true, 'Dúvida')).toBe(3)
    expect(mapearRespostaSimuladoParaGradeSm2(true, 'Chutei')).toBe(3)
    expect(mapearRespostaSimuladoParaGradeSm2(true, 'Confiante')).toBe(4)
  })

  it('bloqueia aba antiga quando o state ja esta futuro antes de escrever', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-22T12:00:00.000Z'))
    const q = criarQuestaoSimuladoMarkdown({
      id: 'q-stale',
      scheduler_mode: 'sm2_v1',
      review_state: { algorithm_version: 'sm2_v1', next_review_at: '2026-07-21T12:00:00.000Z' }
    })
    const card = criarCardSimuladoRevisao(q, 1)
    const chamadas = configurarDbSupabase({
      questao_review_states: {
        data: criarStateSm2({ questao_id: 'q-stale', next_review_at: '2026-07-23T12:00:00.000Z' }),
        error: null
      }
    })

    await registrarResultadoRevisaoSm2(q, 'Acertou', card, 'B', 'Confiante', configSm2)

    expect(globalThis.db.rpc).not.toHaveBeenCalled()
    expect(chamadas.some(chamada => chamada.metodo === 'insert')).toBe(false)
    expect(chamadas.some(chamada => chamada.metodo === 'update')).toBe(false)
    expect(card.querySelector('.simulado-revisao-feedback').textContent).toContain('já foi revisada')
  })

  it('registra por RPC com source_attempt_id e impede duplo clique', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-22T12:00:00.000Z'))
    const q = criarQuestaoSimuladoMarkdown({
      id: 'q-rpc',
      scheduler_mode: 'sm2_v1',
      review_state: { algorithm_version: 'sm2_v1', next_review_at: '2026-07-21T12:00:00.000Z' }
    })
    const card = criarCardSimuladoRevisao(q, 1)
    const chamadas = configurarDbSupabase({
      questao_review_states: {
        data: criarStateSm2({ questao_id: 'q-rpc', next_review_at: '2026-07-21T12:00:00.000Z' }),
        error: null
      }
    }, {
      data: {
        event_id: 'event-1',
        interval_days: 6,
        next_review_at: '2026-07-28T12:00:00.000Z',
        state: {
          algorithm_version: 'sm2_v1',
          next_review_at: '2026-07-28T12:00:00.000Z',
          interval_days: 6,
          total_reviews: 2
        }
      },
      error: null
    })

    const primeira = registrarResultadoRevisaoSm2(q, 'Acertou', card, 'B', 'Confiante', configSm2)
    const segunda = registrarResultadoRevisaoSm2(q, 'Acertou', card, 'B', 'Confiante', configSm2)
    await Promise.all([primeira, segunda])

    expect(globalThis.db.rpc).toHaveBeenCalledTimes(1)
    expect(globalThis.db.rpc).toHaveBeenCalledWith('registrar_revisao_questao_sm2', expect.objectContaining({
      p_questao_id: 'q-rpc',
      p_grade: 4,
      p_was_correct: true,
      p_source_attempt_id: expect.any(String),
      p_answer: 'B'
    }))
    expect(chamadas.some(chamada => chamada.tabela === 'questoes_revisoes' && chamada.metodo === 'insert')).toBe(false)
    expect(card.querySelector('.simulado-revisao-gabarito').classList.contains('escondido')).toBe(false)
    expect(card.querySelector('.simulado-diagnostico').dataset.schedulerAlgorithm).toBe('sm2_v1')
  })

  it('falha de RPC nao revela gabarito nem avanca a interface', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-22T12:00:00.000Z'))
    const q = criarQuestaoSimuladoMarkdown({
      id: 'q-fail',
      scheduler_mode: 'sm2_v1',
      review_state: { algorithm_version: 'sm2_v1', next_review_at: '2026-07-21T12:00:00.000Z' }
    })
    const card = criarCardSimuladoRevisao(q, 1)
    configurarDbSupabase({
      questao_review_states: {
        data: criarStateSm2({ questao_id: 'q-fail', next_review_at: '2026-07-21T12:00:00.000Z' }),
        error: null
      }
    }, { data: null, error: { message: 'rpc indisponivel' } })

    await registrarResultadoRevisaoSm2(q, 'Errou', card, 'A', 'Dúvida', configSm2)

    expect(globalThis.db.rpc).toHaveBeenCalledTimes(1)
    expect(card.querySelector('.simulado-revisao-gabarito').classList.contains('escondido')).toBe(true)
    expect(card.classList.contains('simulado-revisao-card--resolvido')).toBe(false)
    expect(card.querySelector('.btn-registrar-resposta').disabled).toBe(false)
  })

  it('salvar diagnostico SM-2 atualiza somente campos auxiliares e linha de compatibilidade segura', async () => {
    const q = criarQuestaoSimuladoMarkdown({ id: 'q-diag', scheduler_mode: 'sm2_v1' })
    const card = criarCardSimuladoRevisao(q, 1)
    card.dataset.confiancaResposta = 'Dúvida'
    abrirDiagnosticoSimulado(card, 'Dúvida', null, {
      schedulerAlgorithm: 'sm2_v1',
      sourceAttemptId: 'attempt-1'
    })
    card.querySelector('.simulado-diagnostico-motivo').value = 'Falta de conteúdo'
    card.querySelector('.simulado-diagnostico-conceito').value = 'Competencia constitucional'
    card.querySelector('.simulado-diagnostico-reconhecer').value = 'Reconhecer pela materia cobrada'
    card.querySelector('.simulado-diagnostico-acao').value = 'Revisar lei seca'
    const chamadas = configurarDbSupabase({
      questoes: { data: null, error: null },
      questoes_revisoes: { data: null, error: null }
    })

    await salvarDiagnosticoSimulado(q, card)

    expect(chamadas).toEqual(expect.arrayContaining([
      expect.objectContaining({ tabela: 'questoes', metodo: 'update', args: [expect.objectContaining({ motivo_erro: 'Falta de conteúdo' })] }),
      expect.objectContaining({ tabela: 'questoes_revisoes', metodo: 'eq', args: ['source_attempt_id', 'attempt-1'] }),
      expect.objectContaining({ tabela: 'questoes_revisoes', metodo: 'eq', args: ['scheduler_algorithm', 'sm2_v1'] })
    ]))
    expect(chamadas.some(chamada => chamada.tabela === 'questoes_revisoes' && chamada.metodo === 'insert')).toBe(false)
    expect(chamadas.some(chamada => chamada.tabela === 'questao_review_states')).toBe(false)
    expect(chamadas.some(chamada => chamada.tabela === 'questao_review_events')).toBe(false)
  })

  it('usuario legacy preserva insert historico, update legado e nao chama RPC SM-2', async () => {
    const q = criarQuestaoSimuladoMarkdown({ id: 'q-legacy', scheduler_mode: 'legacy' })
    const card = criarCardSimuladoRevisao(q, 1)
    const chamadas = configurarDbSupabase({
      configuracoes_revisao: {
        data: {
          review_scheduler_mode: 'legacy',
          dias_revisao: [6],
          review_timezone: 'America/Recife',
          review_max_interval_days: 365
        },
        error: null
      },
      questoes_revisoes: { data: { id: 'rev-legacy' }, error: null },
      questoes: { data: null, error: null }
    })

    await registrarResultadoRevisao(q, 'Errou', card, 'A', 'Dúvida')

    expect(globalThis.db.rpc).not.toHaveBeenCalled()
    expect(chamadas).toEqual(expect.arrayContaining([
      expect.objectContaining({ tabela: 'questoes_revisoes', metodo: 'insert' }),
      expect.objectContaining({ tabela: 'questoes', metodo: 'update' })
    ]))
  })
})
