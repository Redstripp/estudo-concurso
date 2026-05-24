import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const {
  criarEstadoVazioDashboard,
  criarCardsDashboardVazios,
  criarPeriodoArquivamento,
  criarValorMesPdfPadrao,
  criarPeriodoPdfMensalSelecionado,
  criarPainelArquivamentoMensal,
  montarResumoArquivamentoMensal,
  criarResumoMateriaArquivamento,
  normalizarTipoArquivamento,
  formatarDataBRArquivamento,
  obterClasseAproveitamentoDashboard,
  criarDonutAproveitamentoDashboard
} = globalThis

const dashboardSource = readFileSync(new URL('../js/dashboard.js', import.meta.url), 'utf8')

function extrairFuncaoDashboard(nome) {
  const inicio = dashboardSource.indexOf(`async function ${nome}`)
  if (inicio === -1) throw new Error(`Funcao ${nome} nao encontrada.`)

  const abertura = dashboardSource.indexOf('{', inicio)
  let profundidade = 0

  for (let indice = abertura; indice < dashboardSource.length; indice += 1) {
    if (dashboardSource[indice] === '{') profundidade += 1
    if (dashboardSource[indice] === '}') profundidade -= 1
    if (profundidade === 0) return dashboardSource.slice(inicio, indice + 1)
  }

  throw new Error(`Nao foi possivel extrair ${nome}.`)
}

function criarArquivarELimparMesParaTeste(dependencias) {
  const fonte = extrairFuncaoDashboard('arquivarELimparMes')
  return Function(
    'relatorioMensalGerado',
    'db',
    'prompt',
    'buscarDadosArquivamentoMensal',
    'montarResumoArquivamentoMensal',
    'salvarResumoMensal',
    'recalcularTotalQuestoesSessao',
    'inicializarDashboard',
    'verificarAvisoArquivamentoPendente',
    'console',
    `${fonte}; return arquivarELimparMes;`
  )(
    dependencias.relatorioMensalGerado,
    dependencias.db,
    dependencias.prompt,
    dependencias.buscarDadosArquivamentoMensal,
    dependencias.montarResumoArquivamentoMensal,
    dependencias.salvarResumoMensal,
    dependencias.recalcularTotalQuestoesSessao,
    dependencias.inicializarDashboard,
    dependencias.verificarAvisoArquivamentoPendente,
    console
  )
}

function criarSalvarResumoMensalParaTeste(db) {
  const fonte = extrairFuncaoDashboard('salvarResumoMensal')
  return Function('db', `${fonte}; return salvarResumoMensal;`)(db)
}

function criarBuscarDadosArquivamentoMensalParaTeste(db) {
  const fonte = extrairFuncaoDashboard('buscarDadosArquivamentoMensal')
  return Function(
    'db',
    'criarErroConsultaDashboard',
    `${fonte}; return buscarDadosArquivamentoMensal;`
  )(db, (mensagem, erro) => new Error(`${mensagem} ${erro?.message || ''}`.trim()))
}

function criarGerarPdfArquivamentoMensalParaTeste(dependencias) {
  const fonte = extrairFuncaoDashboard('gerarPdfArquivamentoMensal')
  return Function(
    'buscarDadosArquivamentoMensal',
    'montarResumoArquivamentoMensal',
    'abrirRelatorioMensalParaImpressao',
    'marcarRelatorioMensalGerado',
    'atualizarBloqueioArquivamentoAposPdf',
    'console',
    `${fonte}; return gerarPdfArquivamentoMensal;`
  )(
    dependencias.buscarDadosArquivamentoMensal,
    dependencias.montarResumoArquivamentoMensal,
    dependencias.abrirRelatorioMensalParaImpressao,
    dependencias.marcarRelatorioMensalGerado,
    dependencias.atualizarBloqueioArquivamentoAposPdf,
    console
  )
}

function criarPeriodoArquivamentoTeste() {
  return {
    inicio: '2026-05-01',
    fim: '2026-05-31',
    fimDataHora: '2026-05-31T23:59:59.999Z',
    periodoMes: '2026-05-01',
    rotulo: 'maio de 2026'
  }
}

function montarMensagemArquivamento() {
  document.body.innerHTML = '<p id="msg-arquivamento-mensal"></p>'
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  sessionStorage.clear()
})

describe('dashboard helpers', () => {
  it('cria estado vazio escapando HTML recebido', () => {
    const html = criarEstadoVazioDashboard('<b>Titulo</b>', 'A & B')

    expect(html).toContain('&lt;b&gt;Titulo&lt;/b&gt;')
    expect(html).toContain('A &amp; B')
  })

  it('cria os cards vazios do dashboard', () => {
    const html = criarCardsDashboardVazios()

    expect(html).toContain('dash-resumo-principal')
    expect(html).toContain('0%')
  })

  it('monta o periodo mensal de arquivamento a partir do mes alvo', () => {
    const periodo = criarPeriodoArquivamento(new Date('2026-05-01T12:00:00'), {
      podeLimpar: true,
      fimDeMes: true,
      pendente: true
    })

    expect(periodo).toMatchObject({
      inicio: '2026-05-01',
      fim: '2026-05-31',
      periodoMes: '2026-05-01',
      podeLimpar: true,
      fimDeMes: true,
      pendente: true
    })
  })

  it('usa o mes atual como periodo padrao do PDF mensal', () => {
    const dataBase = new Date('2026-05-24T12:00:00')
    const periodo = criarPeriodoPdfMensalSelecionado('', dataBase)

    expect(criarValorMesPdfPadrao(dataBase)).toBe('2026-05')
    expect(periodo).toMatchObject({
      inicio: '2026-05-01',
      fim: '2026-05-31',
      periodoMes: '2026-05-01'
    })
  })

  it('renderiza seletor de mes e ano para o PDF mensal', () => {
    const html = criarPainelArquivamentoMensal(
      criarPeriodoArquivamentoTeste(),
      { totalDetalhadas: 1, totalErradas: 1, totalChutadas: 0, totalAcertos: 0 },
      { tabelaDisponivel: true, data: null },
      null
    )

    expect(html).toContain('Mês do PDF')
    expect(html).toContain('id="input-mes-pdf-mensal"')
    expect(html).toContain('type="month"')
    expect(html).toContain('Gerar PDF do período selecionado')
  })

  it('monta periodo do PDF a partir do mes e ano selecionados', () => {
    const dataBase = new Date('2026-05-24T12:00:00')
    const periodo = criarPeriodoPdfMensalSelecionado('2026-04', dataBase)
    const futuro = criarPeriodoPdfMensalSelecionado('2026-06', dataBase)

    expect(periodo).toMatchObject({
      inicio: '2026-04-01',
      fim: '2026-04-30',
      periodoMes: '2026-04-01'
    })
    expect(futuro).toMatchObject({
      inicio: '2026-05-01',
      fim: '2026-05-31',
      periodoMes: '2026-05-01'
    })
  })

  it('gera PDF usando o periodo selecionado', async () => {
    montarMensagemArquivamento()
    const periodoSelecionado = criarPeriodoPdfMensalSelecionado('2026-04', new Date('2026-05-24T12:00:00'))
    const janela = { closed: false, document: { write: vi.fn() } }
    const windowOpenOriginal = globalThis.window.open
    globalThis.window.open = vi.fn(() => janela)
    const buscarDadosArquivamentoMensal = vi.fn(async () => ({ questoes: [], sessoes: [], questoesCertas: [], simulados: [] }))
    const montarResumo = vi.fn(() => ({ totalDetalhadas: 0 }))
    const abrirRelatorio = vi.fn()
    const marcarRelatorio = vi.fn()
    const atualizarBloqueio = vi.fn()
    const gerarPdf = criarGerarPdfArquivamentoMensalParaTeste({
      buscarDadosArquivamentoMensal,
      montarResumoArquivamentoMensal: montarResumo,
      abrirRelatorioMensalParaImpressao: abrirRelatorio,
      marcarRelatorioMensalGerado: marcarRelatorio,
      atualizarBloqueioArquivamentoAposPdf: atualizarBloqueio
    })

    try {
      await gerarPdf('user-1', periodoSelecionado, { atualizarBloqueioArquivamento: false })
    } finally {
      globalThis.window.open = windowOpenOriginal
    }

    expect(buscarDadosArquivamentoMensal).toHaveBeenCalledWith('user-1', expect.objectContaining({
      inicio: '2026-04-01',
      fim: '2026-04-30',
      periodoMes: '2026-04-01'
    }))
    expect(abrirRelatorio).toHaveBeenCalledWith(janela, expect.objectContaining({ periodoMes: '2026-04-01' }), expect.any(Object), expect.any(Object))
    expect(marcarRelatorio).toHaveBeenCalledWith(expect.objectContaining({ periodoMes: '2026-04-01' }))
    expect(atualizarBloqueio).not.toHaveBeenCalled()
  })

  it('busca dados do PDF mensal filtrando questoes por criado_em no periodo', async () => {
    const deleteQuestao = vi.fn()
    const questoesChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      gte: vi.fn(function () { return this }),
      lte: vi.fn(function () { return this }),
      order: vi.fn(async function () { return { data: [], error: null } }),
      delete: deleteQuestao
    }
    const sessoesChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      gte: vi.fn(function () { return this }),
      lte: vi.fn(async function () { return { data: [], error: null } })
    }
    const simuladosChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      gte: vi.fn(function () { return this }),
      lte: vi.fn(function () { return this }),
      order: vi.fn(async function () { return { data: [], error: null } })
    }
    const from = vi.fn(tabela => ({
      questoes: questoesChain,
      sessoes_estudo: sessoesChain,
      simulados: simuladosChain
    })[tabela])
    const buscarDadosArquivamentoMensal = criarBuscarDadosArquivamentoMensalParaTeste({ from })

    await buscarDadosArquivamentoMensal('user-1', criarPeriodoArquivamentoTeste())

    expect(from).toHaveBeenCalledWith('questoes')
    expect(questoesChain.gte).toHaveBeenCalledWith('criado_em', '2026-05-01T00:00:00')
    expect(questoesChain.lte).toHaveBeenCalledWith('criado_em', '2026-05-31T23:59:59.999Z')
    expect(deleteQuestao).not.toHaveBeenCalled()
  })

  it('monta resumo mensal com erradas, chutadas e acertos por materia', () => {
    const periodo = { inicio: '2026-05-01', fim: '2026-05-31', periodoMes: '2026-05-01' }
    const resumo = montarResumoArquivamentoMensal({
      questoes: [
        {
          id: 'q1',
          materia_id: 'm2',
          tipo_questao: 'Errada',
          motivo_erro: 'Conteudo',
          nivel_confianca: 'Baixa',
          materias: { nome: 'Constitucional' }
        },
        {
          id: 'q2',
          materia_id: 'm1',
          tipo_questao: 'Chutada',
          motivo_erro: 'Chute completo',
          nivel_confianca: 'Chutei',
          materias: { nome: 'Administrativo' }
        }
      ],
      questoesCertas: [
        { materia_id: 'm1', quantidade: 3, materias: { nome: 'Administrativo' } },
        { materia_id: 'm2', quantidade: 2, materias: { nome: 'Constitucional' } }
      ],
      simulados: [{ id: 's1' }]
    }, periodo)

    expect(resumo).toMatchObject({
      totalDetalhadas: 2,
      totalAcertos: 5,
      totalErradas: 1,
      totalChutadas: 1,
      totalGeral: 7,
      totalSimulados: 1
    })
    expect(resumo.desempenhoPorMateria.map(m => m.materia)).toEqual(['Administrativo', 'Constitucional'])
    expect(resumo.desempenhoPorMateria[0]).toMatchObject({
      materia_id: 'm1',
      acertos: 3,
      chutadas: 1,
      total: 4,
      aproveitamento: 75
    })
  })

  it('cria resumo vazio de materia e normaliza tipos de questao', () => {
    expect(criarResumoMateriaArquivamento('Direito', 'm1')).toEqual({
      materia_id: 'm1',
      materia: 'Direito',
      acertos: 0,
      erradas: 0,
      chutadas: 0,
      detalhadas: 0
    })
    expect(normalizarTipoArquivamento({ tipo_questao: 'Chutada' })).toBe('Chutada')
    expect(normalizarTipoArquivamento({ tipo_questao: 'Outro' })).toBe('Errada')
  })

  it('formata data e classes de aproveitamento', () => {
    expect(formatarDataBRArquivamento('2026-05-15')).toBe('15/05/2026')
    expect(obterClasseAproveitamentoDashboard(80)).toBe('alto')
    expect(obterClasseAproveitamentoDashboard(60)).toBe('medio')
    expect(obterClasseAproveitamentoDashboard(49)).toBe('baixo')
  })

  it('limita o donut de aproveitamento entre 0 e 100', () => {
    expect(criarDonutAproveitamentoDashboard(120)).toContain('stroke-dasharray="100 0"')
    expect(criarDonutAproveitamentoDashboard(-10)).toContain('stroke-dasharray="0 100"')
  })

  it('nao arquiva sem relatorio mensal marcado como gerado', async () => {
    montarMensagemArquivamento()
    const deleteQuestao = vi.fn()
    const from = vi.fn(() => ({ delete: deleteQuestao }))
    const salvarResumoMensal = vi.fn()
    const prompt = vi.fn()
    const arquivarELimparMes = criarArquivarELimparMesParaTeste({
      relatorioMensalGerado: vi.fn(() => false),
      db: { from },
      prompt,
      buscarDadosArquivamentoMensal: vi.fn(),
      montarResumoArquivamentoMensal: vi.fn(),
      salvarResumoMensal,
      inicializarDashboard: vi.fn()
    })

    await arquivarELimparMes('user-1', criarPeriodoArquivamentoTeste())

    expect(prompt).not.toHaveBeenCalled()
    expect(salvarResumoMensal).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
    expect(deleteQuestao).not.toHaveBeenCalled()
    expect(document.getElementById('msg-arquivamento-mensal').textContent).toContain('Gere o PDF')
  })

  it('exige confirmacao ARQUIVAR antes de salvar o resumo mensal', async () => {
    montarMensagemArquivamento()
    const deleteQuestao = vi.fn()
    const from = vi.fn(() => ({ delete: deleteQuestao }))
    const salvarResumoMensal = vi.fn()
    const arquivarELimparMes = criarArquivarELimparMesParaTeste({
      relatorioMensalGerado: vi.fn(() => true),
      db: { from },
      prompt: vi.fn(() => 'cancelar'),
      buscarDadosArquivamentoMensal: vi.fn(),
      montarResumoArquivamentoMensal: vi.fn(),
      salvarResumoMensal,
      inicializarDashboard: vi.fn()
    })

    await arquivarELimparMes('user-1', criarPeriodoArquivamentoTeste())

    expect(salvarResumoMensal).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
    expect(deleteQuestao).not.toHaveBeenCalled()
  })

  it('salva o resumo mensal sem apagar questoes detalhadas', async () => {
    montarMensagemArquivamento()
    const periodo = criarPeriodoArquivamentoTeste()
    const dados = { questoes: [{ id: 'q1' }], sessoes: [{ id: 's1' }] }
    const resumo = { totalDetalhadas: 1 }
    const deleteQuestao = vi.fn()
    const from = vi.fn(() => ({ delete: deleteQuestao }))
    const salvarResumoMensal = vi.fn(async () => {})
    const recalcularTotalQuestoesSessao = vi.fn(async () => {})
    const arquivarELimparMes = criarArquivarELimparMesParaTeste({
      relatorioMensalGerado: vi.fn(() => true),
      db: { from },
      prompt: vi.fn(() => 'ARQUIVAR'),
      buscarDadosArquivamentoMensal: vi.fn(async () => dados),
      montarResumoArquivamentoMensal: vi.fn(() => resumo),
      salvarResumoMensal,
      recalcularTotalQuestoesSessao,
      inicializarDashboard: vi.fn(async () => {}),
      verificarAvisoArquivamentoPendente: vi.fn()
    })

    await arquivarELimparMes('user-1', periodo)

    expect(salvarResumoMensal).toHaveBeenCalledWith('user-1', periodo, resumo)
    expect(from).not.toHaveBeenCalled()
    expect(deleteQuestao).not.toHaveBeenCalled()
    expect(recalcularTotalQuestoesSessao).not.toHaveBeenCalled()
    expect(document.getElementById('msg-arquivamento-mensal').textContent).toContain('questões detalhadas foram mantidas')
  })

  it('salva o resumo mensal na tabela estatisticas_mensais', async () => {
    const upsert = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => ({ upsert }))
    const salvarResumoMensal = criarSalvarResumoMensalParaTeste({ from })
    const periodo = criarPeriodoArquivamentoTeste()
    const resumo = {
      totalGeral: 7,
      totalAcertos: 5,
      totalErradas: 1,
      totalChutadas: 1,
      desempenhoPorMateria: [{ materia: 'Direito', acertos: 5 }],
      motivos: { Conteudo: 1 },
      confianca: { Baixa: 1 }
    }

    await salvarResumoMensal('user-1', periodo, resumo)

    expect(from).toHaveBeenCalledWith('estatisticas_mensais')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      periodo_mes: '2026-05-01',
      total_questoes: 7,
      total_acertos: 5,
      total_erradas: 1,
      total_chutadas: 1
    }), { onConflict: 'user_id,periodo_mes' })
  })
})
