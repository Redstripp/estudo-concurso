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
  criarDonutAproveitamentoDashboard,
  criarMesesComDetalhesDashboard,
  somarTotaisMensaisArquivadosDashboard
} = globalThis

const dashboardSource = readFileSync(new URL('../js/dashboard.js', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8')
const estiloSource = readFileSync(new URL('../css/estilo.css', import.meta.url), 'utf8')

function extrairFuncaoDashboard(nome) {
  const inicio = dashboardSource.indexOf(`async function ${nome}(`)
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

function extrairFuncaoApp(nome) {
  const assinaturas = [`async function ${nome}(`, `function ${nome}(`]
  const inicio = assinaturas
    .map(assinatura => appSource.indexOf(assinatura))
    .filter(indice => indice >= 0)
    .sort((a, b) => a - b)[0]
  if (inicio === undefined) throw new Error(`Funcao ${nome} nao encontrada.`)

  const abertura = appSource.indexOf('{', inicio)
  let profundidade = 0

  for (let indice = abertura; indice < appSource.length; indice += 1) {
    if (appSource[indice] === '{') profundidade += 1
    if (appSource[indice] === '}') profundidade -= 1
    if (profundidade === 0) return appSource.slice(inicio, indice + 1)
  }

  throw new Error(`Nao foi possivel extrair ${nome}.`)
}

function dataISOTeste(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function criarBuscarArquivamentoPendenteAvisoParaTeste(db) {
  const fonte = [
    'criarDataInicioMesAvisoArquivamento',
    'contarQuestoesPeriodoArquivamentoAviso',
    'periodoArquivadoAviso',
    'criarPeriodoAvisoArquivamento',
    'buscarArquivamentoPendenteAviso'
  ].map(extrairFuncaoApp).join('\n')

  return Function('db', 'dataISO', `${fonte}; return buscarArquivamentoPendenteAviso;`)(db, dataISOTeste)
}

function criarVerificarAvisoArquivamentoPendenteParaTeste(dependencias) {
  const fonte = [
    'ocultarAvisoArquivamento',
    'verificarAvisoArquivamentoPendente'
  ].map(extrairFuncaoApp).join('\n')

  return Function(
    'window',
    'buscarArquivamentoPendenteAviso',
    'mostrarAvisoArquivamento',
    'console',
    `let avisoArquivamentoToken = 0; ${fonte}; return verificarAvisoArquivamentoPendente;`
  )(
    dependencias.window,
    dependencias.buscarArquivamentoPendenteAviso,
    dependencias.mostrarAvisoArquivamento,
    console
  )
}

function criarDbAvisoArquivamento(respostasPorTabela) {
  const filas = Object.fromEntries(
    Object.entries(respostasPorTabela).map(([tabela, respostas]) => [tabela, [...respostas]])
  )
  const chamadas = []
  const from = vi.fn((tabela) => {
    const resposta = filas[tabela]?.shift()
    if (!resposta) throw new Error(`Resposta nao configurada para ${tabela}`)

    const chain = {}
    ;['select', 'eq', 'lt', 'gte', 'lte', 'order'].forEach(metodo => {
      chain[metodo] = vi.fn(function (...args) {
        chamadas.push({ tabela, metodo, args })
        return this
      })
    })
    chain.limit = vi.fn(async function (...args) {
      chamadas.push({ tabela, metodo: 'limit', args })
      return resposta
    })
    chain.maybeSingle = vi.fn(async function (...args) {
      chamadas.push({ tabela, metodo: 'maybeSingle', args })
      return resposta
    })
    return chain
  })

  return { db: { from }, from, chamadas }
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

function criarCarregarGraficoParaTeste(db) {
  const fonte = extrairFuncaoDashboard('carregarGrafico')
  return Function(
    'db',
    'document',
    'criarErroConsultaDashboard',
    'formatarDiaSemanaGrafico',
    'criarSvgAtividadeSemanalDashboard',
    `${fonte}; return carregarGrafico;`
  )(
    db,
    document,
    (mensagem, erro) => new Error(`${mensagem} ${erro?.message || ''}`.trim()),
    data => data,
    (dias, labels, valores) => `<div data-dias="${dias.join(',')}" data-valores="${valores.join(',')}"></div>`
  )
}

function criarBuscarResumoSessaoHojeDashboardParaTeste(db) {
  const fonte = extrairFuncaoDashboard('buscarResumoSessaoHojeDashboard')
  return Function(
    'db',
    'normalizarTipoArquivamento',
    'criarErroConsultaDashboard',
    `${fonte}; return buscarResumoSessaoHojeDashboard;`
  )(
    db,
    normalizarTipoArquivamento,
    (mensagem, erro) => new Error(`${mensagem} ${erro?.message || ''}`.trim())
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
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  sessionStorage.clear()
})

describe('dashboard helpers', () => {
  it('marca o body enquanto o aviso de arquivamento esta visivel', () => {
    expect(appSource).toContain("document.body.classList.add('aviso-arquivamento-visivel')")
    expect(appSource).toContain("document.body.classList.remove('aviso-arquivamento-visivel')")
    expect(estiloSource).toContain('body.aviso-arquivamento-visivel .aviso-arquivamento-pendente')
  })

  it('mostra aviso quando ha questao antiga sem resumo mensal arquivado', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T12:00:00'))
    const { db, chamadas } = criarDbAvisoArquivamento({
      questoes: [
        { data: [{ criado_em: '2026-05-12T10:00:00Z' }], count: 5, error: null },
        { data: [{ id: 'q1' }], count: 5, error: null }
      ],
      estatisticas_mensais: [
        { data: null, error: null }
      ]
    })
    const buscarArquivamentoPendenteAviso = criarBuscarArquivamentoPendenteAvisoParaTeste(db)

    const pendente = await buscarArquivamentoPendenteAviso('user-1')

    expect(pendente).toMatchObject({
      total: 5,
      periodoMes: '2026-05-01'
    })
    expect(chamadas).toContainEqual({
      tabela: 'estatisticas_mensais',
      metodo: 'eq',
      args: ['periodo_mes', '2026-05-01']
    })
  })

  it('nao mostra aviso quando o mes antigo ja foi arquivado', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T12:00:00'))
    const { db } = criarDbAvisoArquivamento({
      questoes: [
        { data: [{ criado_em: '2026-05-12T10:00:00Z' }], count: 5, error: null },
        { data: [{ id: 'q1' }], count: 5, error: null }
      ],
      estatisticas_mensais: [
        { data: { arquivado_em: '2026-06-01T10:00:00Z' }, error: null }
      ]
    })
    const buscarArquivamentoPendenteAviso = criarBuscarArquivamentoPendenteAvisoParaTeste(db)

    const pendente = await buscarArquivamentoPendenteAviso('user-1')

    expect(pendente).toBeNull()
  })

  it('nao esconde outro mes antigo pendente quando o primeiro ja foi arquivado', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T12:00:00'))
    const { db } = criarDbAvisoArquivamento({
      questoes: [
        { data: [{ criado_em: '2026-05-12T10:00:00Z' }], count: 9, error: null },
        { data: [{ id: 'q1' }], count: 5, error: null },
        { data: [{ id: 'q6' }], count: 4, error: null }
      ],
      estatisticas_mensais: [
        { data: { arquivado_em: '2026-06-01T10:00:00Z' }, error: null },
        { data: null, error: null }
      ]
    })
    const buscarArquivamentoPendenteAviso = criarBuscarArquivamentoPendenteAvisoParaTeste(db)

    const pendente = await buscarArquivamentoPendenteAviso('user-1')

    expect(pendente).toMatchObject({
      total: 4,
      periodoMes: '2026-06-01'
    })
  })

  it('remove a classe do body quando nao ha aviso pendente', async () => {
    document.body.innerHTML = '<div id="aviso-arquivamento-pendente"></div>'
    document.body.classList.add('aviso-arquivamento-visivel')
    const verificarAvisoArquivamentoPendente = criarVerificarAvisoArquivamentoPendenteParaTeste({
      window: { usuarioAtual: { id: 'user-1' } },
      buscarArquivamentoPendenteAviso: vi.fn(async () => null),
      mostrarAvisoArquivamento: vi.fn()
    })

    await verificarAvisoArquivamentoPendente()

    expect(document.getElementById('aviso-arquivamento-pendente')).toBeNull()
    expect(document.body.classList.contains('aviso-arquivamento-visivel')).toBe(false)
  })

  it('cria estado vazio escapando HTML recebido', () => {
    const html = criarEstadoVazioDashboard('<b>Titulo</b>', 'A & B')

    expect(html).toContain('&lt;b&gt;Titulo&lt;/b&gt;')
    expect(html).toContain('A &amp; B')
  })

  it('cria os cards vazios do dashboard', () => {
    const html = criarCardsDashboardVazios()

    expect(html).toContain('dash-resumo-principal')
    expect(html).toContain('0%')
    expect(html).toContain('aproveitamento histórico')
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

  it('nao soma estatisticas mensais quando o dashboard tem detalhes do mesmo mes', () => {
    const mesesComDetalhes = criarMesesComDetalhesDashboard([
      { criado_em: '2026-05-10T12:00:00Z' }
    ])
    const totais = somarTotaisMensaisArquivadosDashboard([
      {
        periodo_mes: '2026-05-01',
        total_questoes: 10,
        total_acertos: 6,
        total_erradas: 3,
        total_chutadas: 1,
        desempenho_por_materia: [{ materia_id: 'm1', materia: 'Direito', acertos: 6, erradas: 3, chutadas: 1 }]
      }
    ], mesesComDetalhes)

    expect(totais.totalQuestoes).toBe(0)
    expect(totais.totalAcertos).toBe(0)
    expect(totais.listaPorMateria).toEqual([])
  })

  it('mantem estatisticas mensais como historico quando o dashboard nao tem detalhes do mes', () => {
    const mesesComDetalhes = criarMesesComDetalhesDashboard([
      { criado_em: '2026-05-10T12:00:00Z' }
    ])
    const totais = somarTotaisMensaisArquivadosDashboard([
      {
        periodo_mes: '2026-04-01',
        total_questoes: 7,
        total_acertos: 4,
        total_erradas: 2,
        total_chutadas: 1,
        desempenho_por_materia: [{ materia_id: 'm1', materia: 'Direito', acertos: 4, erradas: 2, chutadas: 1 }]
      }
    ], mesesComDetalhes)

    expect(totais).toMatchObject({
      totalQuestoes: 7,
      totalAcertos: 4,
      totalErradas: 2,
      totalChutadas: 1
    })
    expect(totais.porMateria.m1).toMatchObject({ acertos: 4, erradas: 2, chutadas: 1 })
  })

  it('calcula os registros de hoje pela sessao do dia na Central de Hoje', async () => {
    const sessoesChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () {
        if (this.eq.mock.calls.length === 2) {
          return Promise.resolve({ data: [{ id: 'sessao-hoje' }], error: null })
        }
        return this
      })
    }
    const questoesChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      in: vi.fn(async function () {
        return {
          data: Array.from({ length: 31 }, () => ({
            tipo_questao: 'Errada',
            criado_em: '2026-05-24T23:30:00Z'
          })),
          error: null
        }
      })
    }
    const certasChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      in: vi.fn(async function () {
        return {
          data: [{ quantidade: 74, criado_em: '2026-05-24T23:30:00Z' }],
          error: null
        }
      })
    }
    const from = vi.fn(tabela => ({
      sessoes_estudo: sessoesChain,
      questoes: questoesChain,
      questoes_certas: certasChain
    })[tabela])
    const buscarResumo = criarBuscarResumoSessaoHojeDashboardParaTeste({ from })

    const resumo = await buscarResumo('user-1', '2026-05-25')

    expect(sessoesChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(sessoesChain.eq).toHaveBeenCalledWith('data', '2026-05-25')
    expect(questoesChain.select).toHaveBeenCalledWith('tipo_questao, motivo_erro')
    expect(certasChain.select).toHaveBeenCalledWith('quantidade')
    expect(questoesChain.in).toHaveBeenCalledWith('sessao_id', ['sessao-hoje'])
    expect(certasChain.in).toHaveBeenCalledWith('sessao_id', ['sessao-hoje'])
    expect(resumo).toEqual({ questoesHoje: 105, errosHoje: 31 })
  })

  it('nao conta questoes chutadas como erros reais de hoje', async () => {
    const sessoesChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () {
        if (this.eq.mock.calls.length === 2) {
          return Promise.resolve({ data: [{ id: 'sessao-hoje' }], error: null })
        }
        return this
      })
    }
    const questoesChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      in: vi.fn(async function () {
        return {
          data: [
            { tipo_questao: 'Errada', criado_em: '2026-05-25T10:00:00Z' },
            { tipo_questao: 'Chutada', criado_em: '2026-05-25T10:05:00Z' }
          ],
          error: null
        }
      })
    }
    const certasChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      in: vi.fn(async function () {
        return { data: [], error: null }
      })
    }
    const from = vi.fn(tabela => ({
      sessoes_estudo: sessoesChain,
      questoes: questoesChain,
      questoes_certas: certasChain
    })[tabela])
    const buscarResumo = criarBuscarResumoSessaoHojeDashboardParaTeste({ from })

    const resumo = await buscarResumo('user-1', '2026-05-25')

    expect(resumo).toEqual({ questoesHoje: 2, errosHoje: 1 })
  })

  it('conta atividade semanal pela data da sessao, nao pelo criado_em das questoes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-25T12:00:00'))
    document.body.innerHTML = '<div id="dashboard-grafico"></div>'
    const sessoesChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      gte: vi.fn(function () { return this }),
      lte: vi.fn(async function () {
        return { data: [{ id: 'sessao-hoje', data: '2026-05-25' }], error: null }
      })
    }
    const questoesChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      in: vi.fn(async function () {
        return {
          data: Array.from({ length: 31 }, () => ({
            sessao_id: 'sessao-hoje',
            criado_em: '2026-05-24T23:30:00Z'
          })),
          error: null
        }
      })
    }
    const certasChain = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      in: vi.fn(async function () {
        return {
          data: [{ sessao_id: 'sessao-hoje', quantidade: 64, criado_em: '2026-05-24T23:30:00Z' }],
          error: null
        }
      })
    }
    const from = vi.fn(tabela => ({
      sessoes_estudo: sessoesChain,
      questoes: questoesChain,
      questoes_certas: certasChain
    })[tabela])
    const carregarGrafico = criarCarregarGraficoParaTeste({ from })

    try {
      await carregarGrafico('user-1')
    } finally {
      vi.useRealTimers()
    }

    expect(sessoesChain.gte).toHaveBeenCalledWith('data', '2026-05-19')
    expect(sessoesChain.lte).toHaveBeenCalledWith('data', '2026-05-25')
    expect(questoesChain.select).toHaveBeenCalledWith('sessao_id')
    expect(certasChain.select).toHaveBeenCalledWith('sessao_id, quantidade')
    expect(questoesChain.in).toHaveBeenCalledWith('sessao_id', ['sessao-hoje'])
    expect(certasChain.in).toHaveBeenCalledWith('sessao_id', ['sessao-hoje'])
    expect(document.getElementById('dashboard-grafico').innerHTML).toContain('data-valores="0,0,0,0,0,0,95"')
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
    const verificarAvisoArquivamentoPendente = vi.fn()
    const arquivarELimparMes = criarArquivarELimparMesParaTeste({
      relatorioMensalGerado: vi.fn(() => true),
      db: { from },
      prompt: vi.fn(() => 'ARQUIVAR'),
      buscarDadosArquivamentoMensal: vi.fn(async () => dados),
      montarResumoArquivamentoMensal: vi.fn(() => resumo),
      salvarResumoMensal,
      recalcularTotalQuestoesSessao,
      inicializarDashboard: vi.fn(async () => {}),
      verificarAvisoArquivamentoPendente
    })

    await arquivarELimparMes('user-1', periodo)

    expect(salvarResumoMensal).toHaveBeenCalledWith('user-1', periodo, resumo)
    expect(from).not.toHaveBeenCalled()
    expect(deleteQuestao).not.toHaveBeenCalled()
    expect(recalcularTotalQuestoesSessao).not.toHaveBeenCalled()
    expect(verificarAvisoArquivamentoPendente).toHaveBeenCalled()
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
