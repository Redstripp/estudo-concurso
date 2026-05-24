// js/estatisticas.js

let estatisticasInicializado = false
let periodoEstatisticasAtual = 'geral'
let periodoPersonalizadoAtual = null
let metaMinimaAtual = 30
let metaMaximaAtual = 30

const PERIODOS_ESTATISTICAS = {
  hoje: {
    titulo: 'Hoje',
    descricao: 'Questões registradas hoje'
  },
  semana: {
    titulo: 'Últimos 7 dias',
    descricao: 'Questões dos últimos 7 dias'
  },
  geral: {
    titulo: 'Geral',
    descricao: 'Acumulado total'
  },
  personalizado: {
    titulo: 'Personalizado',
    descricao: 'Período escolhido'
  }
}

// ============================================
// INICIALIZAR
// ============================================
async function inicializarEstatisticas() {
  if (!estatisticasInicializado) {
    estatisticasInicializado = true
    inicializarAbasEstatisticas()
  }

  await carregarEstatisticas()
}

function inicializarAbasEstatisticas() {
  preencherPeriodoPersonalizadoPadrao()

  document.querySelectorAll('[data-periodo-estatisticas]').forEach(aba => {
    aba.addEventListener('click', async () => {
      const periodo = aba.dataset.periodoEstatisticas
      if (!periodo || periodo === periodoEstatisticasAtual) return

      periodoEstatisticasAtual = periodo
      atualizarAbasEstatisticas()
      await carregarEstatisticas()
    })
  })

  const btnAplicar = document.getElementById('btn-aplicar-periodo-estatisticas')
  if (btnAplicar) {
    btnAplicar.addEventListener('click', async () => {
      periodoEstatisticasAtual = 'personalizado'
      atualizarAbasEstatisticas()
      await carregarEstatisticas()
    })
  }

  atualizarAbasEstatisticas()
}

function atualizarAbasEstatisticas() {
  document.querySelectorAll('[data-periodo-estatisticas]').forEach(aba => {
    const ativa = aba.dataset.periodoEstatisticas === periodoEstatisticasAtual
    aba.classList.toggle('ativa', ativa)
    aba.setAttribute('aria-selected', ativa ? 'true' : 'false')
  })

  const filtro = document.getElementById('estatisticas-filtro-personalizado')
  if (filtro) {
    filtro.classList.toggle('escondido', periodoEstatisticasAtual !== 'personalizado')
  }
}

function preencherPeriodoPersonalizadoPadrao() {
  const inicioInput = document.getElementById('estatisticas-data-inicio')
  const fimInput = document.getElementById('estatisticas-data-fim')
  if (!inicioInput || !fimInput) return

  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(hoje.getDate() - 29)

  inicioInput.value = inicioInput.value || formatarDataISO(inicio)
  fimInput.value = fimInput.value || formatarDataISO(hoje)
}

// ============================================
// CARREGAR TUDO
// ============================================
async function carregarEstatisticas() {
  const lista = document.getElementById('lista-estatisticas')
  if (!lista) return

  lista.innerHTML = '<p class="texto-placeholder">⏳ Calculando suas estatísticas...</p>'

  try {
    const userId = window.usuarioAtual.id

    const [perfilResp, materiasResp] = await Promise.all([
      db
        .from('profiles')
        .select('meta_diaria, meta_minima, meta_maxima')
        .eq('id', userId)
        .single(),
      db
        .from('materias')
        .select('id, nome')
        .eq('user_id', userId)
        .order('nome', { ascending: true })
    ])

    if (perfilResp.error && perfilResp.error.code !== 'PGRST116') {
      throw criarErroConsulta('Não foi possível carregar suas metas.', perfilResp.error)
    }

    if (materiasResp.error) {
      throw criarErroConsulta('Não foi possível carregar suas matérias.', materiasResp.error)
    }

    const perfil = perfilResp.data
    const materias = materiasResp.data
    const metaCentral = perfil?.meta_diaria || perfil?.meta_maxima || perfil?.meta_minima || 30

    metaMinimaAtual = metaCentral
    metaMaximaAtual = metaCentral

    if (!materias || materias.length === 0) {
      lista.innerHTML = '<p class="texto-placeholder">📚 Nenhuma matéria cadastrada ainda.</p>'
      return
    }

    const [dadosPeriodo, dadosHoje, relatorioEvolucao] = await Promise.all([
      buscarQuestoesPorPeriodo(userId, periodoEstatisticasAtual, materias),
      buscarQuestoesPorPeriodo(userId, 'hoje', materias),
      buscarRelatorioEvolucao(userId)
    ])

    const erradasPorMateria = agruparErradasPorMateria(dadosPeriodo.erradas)
    const certasPorMateria = agruparCertasPorMateria(dadosPeriodo.certas)
    const erradasHojePorMateria = agruparErradasPorMateria(dadosHoje.erradas)
    const certasHojePorMateria = agruparCertasPorMateria(dadosHoje.certas)

    const dadosMaterias = materias.map(m => {
      const erradas = erradasPorMateria[m.id] || 0
      const certas = certasPorMateria[m.id] || 0
      const total = erradas + certas
      const aproveitamento = total > 0 ? Math.round((certas / total) * 100) : null

      const erradasH = erradasHojePorMateria[m.id] || 0
      const certasH = certasHojePorMateria[m.id] || 0
      const totalHoje = erradasH + certasH

      return { ...m, erradas, certas, total, aproveitamento, totalHoje }
    })

    dadosMaterias.sort((a, b) => {
      if (a.total === 0 && b.total === 0) return a.nome.localeCompare(b.nome)
      if (a.total === 0) return 1
      if (b.total === 0) return -1
      if (a.aproveitamento === null) return 1
      if (b.aproveitamento === null) return -1
      return a.aproveitamento - b.aproveitamento
    })

    lista.innerHTML = ''
    lista.appendChild(criarResumoPeriodo(dadosPeriodo))
    lista.appendChild(criarCardRelatorioEvolucao(relatorioEvolucao))
    lista.appendChild(criarCardMeta(metaCentral))

    dadosMaterias.forEach(m => {
      lista.appendChild(criarCardEstatisticaMateria(m, metaCentral))
    })
  } catch (erro) {
    console.error(erro)
    mostrarErroEstatisticas(erro)
  }
}

async function buscarQuestoesPorPeriodo(userId, periodo, materias = []) {
  if (periodo === 'geral') {
    const [erradasResp, certasResp, arquivadas] = await Promise.all([
      db
        .from('questoes')
        .select('materia_id, criado_em')
        .eq('user_id', userId),
      db
        .from('questoes_certas')
        .select('materia_id, quantidade, criado_em')
        .eq('user_id', userId),
      buscarEstatisticasMensaisArquivadas(userId)
    ])

    if (erradasResp.error) {
      throw criarErroConsulta('Não foi possível carregar as questões para revisão.', erradasResp.error)
    }

    if (certasResp.error) {
      throw criarErroConsulta('Não foi possível carregar as questões certas.', certasResp.error)
    }

    const mesesComDetalhes = criarMesesComDetalhesEstatisticas(erradasResp.data || [], certasResp.data || [])
    const arquivadasPorMateria = criarRegistrosArquivadosPorMateria(arquivadas, materias, mesesComDetalhes)

    return {
      erradas: [...(erradasResp.data || []), ...arquivadasPorMateria.erradas],
      certas: [...(certasResp.data || []), ...arquivadasPorMateria.certas]
    }
  }

  const intervalo = obterIntervaloPeriodo(periodo)
  const sessoesResp = await db
    .from('sessoes_estudo')
    .select('id')
    .eq('user_id', userId)
    .gte('data', intervalo.inicio)
    .lte('data', intervalo.fim)

  if (sessoesResp.error) {
    throw criarErroConsulta('Não foi possível carregar as sessões do período.', sessoesResp.error)
  }

  const idsSessoes = (sessoesResp.data || []).map(s => s.id)
  if (idsSessoes.length === 0) {
    return { erradas: [], certas: [] }
  }

  const [erradasResp, certasResp] = await Promise.all([
    db
      .from('questoes')
      .select('materia_id')
      .eq('user_id', userId)
      .in('sessao_id', idsSessoes),
    db
      .from('questoes_certas')
      .select('materia_id, quantidade')
      .eq('user_id', userId)
      .in('sessao_id', idsSessoes)
  ])

  if (erradasResp.error) {
    throw criarErroConsulta('Não foi possível carregar as questões para revisão do período.', erradasResp.error)
  }

  if (certasResp.error) {
    throw criarErroConsulta('Não foi possível carregar as questões certas do período.', certasResp.error)
  }

  return {
    erradas: erradasResp.data || [],
    certas: certasResp.data || []
  }
}

async function buscarEstatisticasMensaisArquivadas(userId) {
  const { data, error } = await db
    .from('estatisticas_mensais')
    .select('periodo_mes, periodo_inicio, desempenho_por_materia')
    .eq('user_id', userId)

  if (error) return []
  return data || []
}

function normalizarMesEstatisticas(valor) {
  const mes = String(valor || '').substring(0, 7)
  return /^\d{4}-\d{2}$/.test(mes) ? mes : null
}

function criarMesesComDetalhesEstatisticas(...listas) {
  const meses = new Set()

  listas.forEach(lista => {
    ;(lista || []).forEach(item => {
      const mes = normalizarMesEstatisticas(item?.criado_em)
      if (mes) meses.add(mes)
    })
  })

  return meses
}

function estatisticaMensalTemDetalhes(registro, mesesComDetalhes) {
  const mes = normalizarMesEstatisticas(registro?.periodo_mes || registro?.periodo_inicio)
  return Boolean(mes && mesesComDetalhes?.has(mes))
}

function criarRegistrosArquivadosPorMateria(registros, materias, mesesComDetalhes = new Set()) {
  const materiasPorNome = new Map((materias || []).map(m => [m.nome, m.id]))
  const erradas = []
  const certas = []

  ;(registros || []).forEach(registro => {
    if (estatisticaMensalTemDetalhes(registro, mesesComDetalhes)) return

    ;(registro.desempenho_por_materia || []).forEach(m => {
      const materiaId = m.materia_id || materiasPorNome.get(m.materia) || `arquivada:${m.materia || 'Sem matéria'}`
      const totalErradas = (Number(m.erradas) || 0) + (Number(m.chutadas) || 0)
      const totalCertas = Number(m.acertos) || 0

      if (totalErradas > 0) erradas.push({ materia_id: materiaId, quantidade: totalErradas })
      if (totalCertas > 0) certas.push({ materia_id: materiaId, quantidade: totalCertas })
    })
  })

  return { erradas, certas }
}

async function buscarRelatorioEvolucao(userId) {
  const inicio30 = obterDataRelativaISO(29)

  const [simuladosResp, revisoesResp, questoesResp] = await Promise.all([
    db
      .from('simulados')
      .select('data, nome, nota_percentual, total_questoes, certas, erradas, tempo_minutos')
      .eq('user_id', userId)
      .order('data', { ascending: false })
      .limit(8),
    buscarRevisoesRelatorioEvolucao(userId, inicio30),
    buscarQuestoesRelatorioEvolucao(userId)
  ])

  if (simuladosResp.error) {
    throw criarErroConsulta('Não foi possível carregar os simulados do relatório.', simuladosResp.error)
  }

  if (revisoesResp.error) {
    throw criarErroConsulta('Não foi possível carregar as revisões do relatório.', revisoesResp.error)
  }

  if (questoesResp.error) {
    throw criarErroConsulta('Não foi possível carregar as questões para revisão do relatório.', questoesResp.error)
  }

  return montarRelatorioEvolucao({
    simulados: simuladosResp.data || [],
    revisoes: revisoesResp.data || [],
    questoes: questoesResp.data || []
  })
}

async function buscarRevisoesRelatorioEvolucao(userId, inicio30) {
  const consultaComConfianca = await db
    .from('questoes_revisoes')
    .select('data_revisao, resultado, nivel_confianca')
    .eq('user_id', userId)
    .gte('data_revisao', inicio30)
    .order('data_revisao', { ascending: true })

  if (!consultaComConfianca.error) return consultaComConfianca

  return db
    .from('questoes_revisoes')
    .select('data_revisao, resultado')
    .eq('user_id', userId)
    .gte('data_revisao', inicio30)
    .order('data_revisao', { ascending: true })
}

async function buscarQuestoesRelatorioEvolucao(userId) {
  const consultaCompleta = await db
    .from('questoes')
    .select('status_revisao, tipo_questao, motivo_erro, nivel_confianca, revisao_total_acertos, revisao_total_erros, conceito_chave, acao_corretiva, materias(nome)')
    .eq('user_id', userId)
    .limit(500)

  if (!consultaCompleta.error) return consultaCompleta

  return db
    .from('questoes')
    .select('status_revisao, tipo_questao, motivo_erro, nivel_confianca, revisao_total_acertos, revisao_total_erros, materias(nome)')
    .eq('user_id', userId)
    .limit(500)
}

function montarRelatorioEvolucao({ simulados, revisoes, questoes }) {
  const simuladosRecentes = [...simulados].sort((a, b) => {
    if (a.data === b.data) return 0
    return a.data < b.data ? 1 : -1
  })
  const ultimoSimulado = simuladosRecentes[0] || null
  const simuladoAnterior = simuladosRecentes[1] || null
  const notaAtual = ultimoSimulado ? Number(ultimoSimulado.nota_percentual || 0) : null
  const notaAnterior = simuladoAnterior ? Number(simuladoAnterior.nota_percentual || 0) : null
  const deltaSimulado = notaAtual !== null && notaAnterior !== null
    ? notaAtual - notaAnterior
    : null

  const totalRevisoes = revisoes.length
  const acertosRevisao = revisoes.filter(r => r.resultado === 'Acertou').length
  const errosRevisao = revisoes.filter(r => r.resultado === 'Errou').length
  const aproveitamentoRevisao = totalRevisoes > 0 ? Math.round((acertosRevisao / totalRevisoes) * 100) : null
  const acertosSemDominio = revisoes.filter(r =>
    r.resultado === 'Acertou' &&
    r.nivel_confianca &&
    r.nivel_confianca !== 'Confiante'
  ).length

  const pendentes = questoes.filter(q => q.status_revisao !== 'recuperada')
  const recuperadas = questoes.filter(q => q.status_revisao === 'recuperada')
  const errosDominio = pendentes.filter(q => normalizarTipoQuestaoRelatorio(q) === 'Errada').length
  const baixaConfianca = pendentes.filter(q => normalizarTipoQuestaoRelatorio(q) === 'Chutada').length
  const semDiagnostico = pendentes.filter(q => !q.conceito_chave || !q.acao_corretiva).length
  const motivos = contarValores(pendentes.map(q => q.motivo_erro).filter(Boolean)).slice(0, 3)

  return {
    simuladosRecentes,
    ultimoSimulado,
    notaAtual,
    deltaSimulado,
    totalRevisoes,
    acertosRevisao,
    errosRevisao,
    aproveitamentoRevisao,
    acertosSemDominio,
    pendentes: pendentes.length,
    errosDominio,
    baixaConfianca,
    recuperadas: recuperadas.length,
    semDiagnostico,
    motivos
  }
}

function normalizarTipoQuestaoRelatorio(q) {
  if (q?.tipo_questao === 'Chutada' || q?.tipo_questao === 'Errada') return q.tipo_questao
  if (q?.motivo_erro === 'Chute' || q?.motivo_erro === 'Chute completo' || q?.nivel_confianca === 'Chutei') return 'Chutada'
  return 'Errada'
}

function contarValores(valores) {
  const mapa = {}
  valores.forEach(valor => {
    mapa[valor] = (mapa[valor] || 0) + 1
  })

  return Object.entries(mapa)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
}

function obterDataRelativaISO(diasAtras) {
  const data = new Date()
  data.setDate(data.getDate() - diasAtras)
  return formatarDataISO(data)
}

function obterIntervaloPeriodo(periodo) {
  const hoje = new Date()
  const fim = formatarDataISO(hoje)

  if (periodo === 'semana') {
    const inicio = new Date(hoje)
    inicio.setDate(hoje.getDate() - 6)
    return {
      inicio: formatarDataISO(inicio),
      fim
    }
  }

  if (periodo === 'personalizado') {
    const inicioInput = document.getElementById('estatisticas-data-inicio')
    const fimInput = document.getElementById('estatisticas-data-fim')
    const inicio = inicioInput?.value
    const fimCustom = fimInput?.value

    if (!inicio || !fimCustom) {
      throw new Error('Escolha uma data de início e uma data de fim para filtrar as estatísticas.')
    }

    if (inicio > fimCustom) {
      throw new Error('A data de início não pode ser maior que a data de fim.')
    }

    periodoPersonalizadoAtual = { inicio, fim: fimCustom }
    return periodoPersonalizadoAtual
  }

  return {
    inicio: fim,
    fim
  }
}

function formatarDataISO(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function formatarDataBR(dataStr) {
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

function criarErroConsulta(mensagem, erroOriginal) {
  const erro = new Error(mensagem)
  erro.detalhe = erroOriginal?.message || erroOriginal?.details || ''
  return erro
}

function mostrarErroEstatisticas(erro) {
  const lista = document.getElementById('lista-estatisticas')
  if (!lista) return

  lista.innerHTML = ''
  lista.appendChild(criarEstadoErro(
    'Não foi possível carregar as estatísticas',
    erro.message || 'Verifique sua conexão e tente novamente.',
    erro.detalhe,
    carregarEstatisticas
  ))
}

function criarEstadoErro(titulo, mensagem, detalhe, aoTentarNovamente) {
  const div = document.createElement('div')
  div.className = 'estado-erro'
  div.innerHTML = `
    <h3 class="estado-erro-titulo">${escaparHtmlEstatisticas(titulo)}</h3>
    <p class="estado-erro-texto">${escaparHtmlEstatisticas(mensagem)}</p>
    ${detalhe ? `<p class="estado-erro-detalhe">${escaparHtmlEstatisticas(detalhe)}</p>` : ''}
    <button class="btn-secundario" type="button">Tentar novamente</button>
  `

  div.querySelector('button').addEventListener('click', aoTentarNovamente)
  return div
}

function agruparErradasPorMateria(erradas) {
  const agrupadas = {}

  ;(erradas || []).forEach(q => {
    agrupadas[q.materia_id] = (agrupadas[q.materia_id] || 0) + (Number(q.quantidade) || 1)
  })

  return agrupadas
}

function agruparCertasPorMateria(certas) {
  const agrupadas = {}

  ;(certas || []).forEach(q => {
    agrupadas[q.materia_id] = (agrupadas[q.materia_id] || 0) + (Number(q.quantidade) || 0)
  })

  return agrupadas
}

function calcularResumoPeriodo(dadosPeriodo) {
  const totalErradas = (dadosPeriodo.erradas || []).reduce((acc, q) => acc + (Number(q.quantidade) || 1), 0)
  const totalCertas = (dadosPeriodo.certas || []).reduce((acc, q) => acc + (Number(q.quantidade) || 0), 0)
  const total = totalErradas + totalCertas
  const aproveitamento = total > 0 ? Math.round((totalCertas / total) * 100) : 0

  return { total, totalCertas, totalErradas, aproveitamento }
}

function obterInfoPeriodoAtual() {
  if (periodoEstatisticasAtual === 'personalizado' && periodoPersonalizadoAtual) {
    return {
      titulo: 'Personalizado',
      descricao: `${formatarDataBR(periodoPersonalizadoAtual.inicio)} a ${formatarDataBR(periodoPersonalizadoAtual.fim)}`
    }
  }

  return PERIODOS_ESTATISTICAS[periodoEstatisticasAtual] || PERIODOS_ESTATISTICAS.geral
}

// ============================================
// RESUMO DO PERIODO
// ============================================
function criarResumoPeriodo(dadosPeriodo) {
  const resumo = calcularResumoPeriodo(dadosPeriodo)
  const periodo = obterInfoPeriodoAtual()
  const div = document.createElement('div')
  div.className = 'estat-resumo-periodo'

  div.innerHTML = `
    <div class="estat-resumo-topo">
      <div>
        <h3 class="estat-resumo-titulo">${periodo.titulo}</h3>
        <p class="estat-resumo-subtitulo">${periodo.descricao}</p>
      </div>
    </div>
    <div class="estat-resumo-grid">
      <div class="estat-resumo-card">
        <span class="estat-resumo-valor">${resumo.total}</span>
        <span class="estat-resumo-label">Feitas</span>
      </div>
      <div class="estat-resumo-card estat-resumo-card--certa">
        <span class="estat-resumo-valor">${resumo.totalCertas}</span>
        <span class="estat-resumo-label">Certas</span>
      </div>
      <div class="estat-resumo-card estat-resumo-card--errada">
        <span class="estat-resumo-valor">${resumo.totalErradas}</span>
        <span class="estat-resumo-label">Para revisão</span>
      </div>
      <div class="estat-resumo-card estat-resumo-card--aproveitamento">
        <span class="estat-resumo-valor">${resumo.aproveitamento}%</span>
        <span class="estat-resumo-label">Aproveitamento</span>
      </div>
    </div>
  `

  return div
}

function criarCardRelatorioEvolucao(relatorio) {
  const div = document.createElement('div')
  div.className = 'relatorio-evolucao'

  const notaAtual = relatorio.notaAtual !== null ? `${relatorio.notaAtual.toFixed(1)}%` : '-'
  const delta = formatarDeltaRelatorio(relatorio.deltaSimulado)
  const aproveitamentoRevisao = relatorio.aproveitamentoRevisao !== null
    ? `${relatorio.aproveitamentoRevisao}%`
    : '-'
  const barras = criarBarrasSimuladosRelatorio(relatorio.simuladosRecentes)
  const motivos = relatorio.motivos.length > 0
    ? relatorio.motivos.map(m => `
      <span class="relatorio-chip">${escaparHtmlEstatisticas(m.nome)}: ${m.total}</span>
    `).join('')
    : '<span class="relatorio-chip">Sem padrão crítico ainda</span>'
  const focos = criarFocosRelatorio(relatorio)

  div.innerHTML = `
    <div class="relatorio-evolucao-topo">
      <div>
        <h3 class="relatorio-evolucao-titulo">Relatório de evolução</h3>
        <p class="relatorio-evolucao-subtitulo">Simulados, revisões e pontos críticos dos últimos ciclos</p>
      </div>
      <span class="relatorio-delta ${delta.classe}">${delta.texto}</span>
    </div>
    <div class="relatorio-evolucao-grid">
      <div class="relatorio-kpi">
        <span class="relatorio-kpi-valor">${notaAtual}</span>
        <span class="relatorio-kpi-label">Último simulado</span>
      </div>
      <div class="relatorio-kpi">
        <span class="relatorio-kpi-valor">${aproveitamentoRevisao}</span>
        <span class="relatorio-kpi-label">Revisões 30 dias</span>
      </div>
      <div class="relatorio-kpi">
        <span class="relatorio-kpi-valor">${relatorio.errosDominio}</span>
        <span class="relatorio-kpi-label">Erros reais</span>
      </div>
      <div class="relatorio-kpi">
        <span class="relatorio-kpi-valor">${relatorio.baixaConfianca}</span>
        <span class="relatorio-kpi-label">Baixa confiança</span>
      </div>
    </div>
    <div class="relatorio-evolucao-corpo">
      <div class="relatorio-painel">
        <h4 class="relatorio-painel-titulo">Simulados recentes</h4>
        ${barras}
      </div>
      <div class="relatorio-painel">
        <h4 class="relatorio-painel-titulo">Causas mais frequentes</h4>
        <div class="relatorio-chips">${motivos}</div>
      </div>
      <div class="relatorio-painel relatorio-painel--foco">
        <h4 class="relatorio-painel-titulo">Foco sugerido</h4>
        <ul class="relatorio-focos">
          ${focos.map(foco => `<li>${escaparHtmlEstatisticas(foco)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `

  return div
}

function criarBarrasSimuladosRelatorio(simuladosRecentes) {
  const simulados = [...simuladosRecentes].slice(0, 6).reverse()

  if (simulados.length === 0) {
    return '<p class="relatorio-vazio">Nenhum simulado registrado.</p>'
  }

  return `
    <div class="relatorio-barras">
      ${simulados.map(simulado => {
        const nota = Math.max(0, Math.min(Number(simulado.nota_percentual || 0), 100))
        const altura = Math.max(8, nota)
        return `
          <div class="relatorio-barra-item">
            <div class="relatorio-barra-trilho">
              <span class="relatorio-barra" style="height: ${altura}%;"></span>
            </div>
            <span class="relatorio-barra-valor">${nota.toFixed(0)}%</span>
            <span class="relatorio-barra-label">${formatarDataBR(simulado.data).slice(0, 5)}</span>
          </div>
        `
      }).join('')}
    </div>
  `
}

function criarFocosRelatorio(relatorio) {
  const focos = []

  if (relatorio.deltaSimulado !== null && relatorio.deltaSimulado < -3) {
    focos.push('Revisar o último simulado antes de fazer outro bloco grande.')
  }

  if (relatorio.motivos[0]) {
    focos.push(`Atacar primeiro os erros de ${relatorio.motivos[0].nome}.`)
  }

  if (relatorio.acertosSemDominio > 0) {
    focos.push('Repetir as questões acertadas com chute ou dúvida antes de tirar da fila.')
  }

  if (relatorio.semDiagnostico > 0) {
    focos.push('Completar o diagnóstico das questões pendentes sem conceito ou ação corretiva.')
  }

  if (focos.length === 0) {
    focos.push('Manter o ciclo atual e aumentar gradualmente a dificuldade dos simulados.')
  }

  return focos.slice(0, 3)
}

function formatarDeltaRelatorio(delta) {
  if (delta === null) return { texto: 'Sem comparação', classe: 'relatorio-delta--neutro' }

  const prefixo = delta > 0 ? '+' : ''
  const texto = `${prefixo}${delta.toFixed(1)} pts`

  if (delta > 0) return { texto, classe: 'relatorio-delta--positivo' }
  if (delta < 0) return { texto, classe: 'relatorio-delta--negativo' }
  return { texto, classe: 'relatorio-delta--neutro' }
}

function escaparHtmlEstatisticas(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

// ============================================
// CARD DE CONFIGURACAO DA META
// ============================================
function criarCardMeta(metaCentral) {
  const div = document.createElement('div')
  div.className = 'card-form card-meta-config'
  div.innerHTML = `
    <div class="meta-config-linha">
      <div>
        <h3 class="card-form-titulo" style="margin-bottom: 4px;">🎯 Meta central por matéria</h3>
        <p style="font-size: 0.85rem; color: var(--cor-texto-suave);">
          A meta é configurada no Planejamento e vale para cada matéria escolhida no dia.
        </p>
      </div>
      <div class="meta-config-input meta-config-input--leitura">
        <strong>${metaCentral}</strong>
        <span>questões por matéria</span>
        <button class="btn-secundario" id="btn-abrir-meta-central" type="button">Alterar no Planejamento</button>
      </div>
    </div>
    <p class="meta-central-preview">Exemplo: 3 matérias planejadas = ${metaCentral * 3} questões no dia.</p>
  `

  div.querySelector('#btn-abrir-meta-central')?.addEventListener('click', () => {
    if (typeof navegarPara === 'function') navegarPara('planejamento')
  })

  return div
}

// ============================================
// CARD DE ESTATISTICA POR MATERIA
// ============================================
function criarCardEstatisticaMateria(m, metaCentral) {
  const card = document.createElement('div')
  card.className = 'card-estatistica'

  const aprovText = m.aproveitamento !== null ? `${m.aproveitamento}%` : '-'

  let corAprov = 'var(--cor-texto-suave)'
  if (m.aproveitamento !== null) {
    if (m.aproveitamento >= 70) corAprov = 'var(--cor-sucesso)'
    else if (m.aproveitamento >= 50) corAprov = 'var(--cor-aviso)'
    else corAprov = 'var(--cor-erro)'
  }

  const progresso = Math.min(Math.round((m.totalHoje / metaCentral) * 100), 100)
  const atingiuMeta = m.totalHoje >= metaCentral

  let corBarra = 'var(--cor-primaria)'
  if (atingiuMeta) corBarra = 'var(--cor-sucesso)'

  let iconeStatus = ''
  if (atingiuMeta) iconeStatus = '✅'

  card.innerHTML = `
    <div class="estat-cabecalho">
      <span class="estat-nome">${escaparHtmlEstatisticas(m.nome)}</span>
      <span class="estat-aproveitamento" style="color: ${corAprov};">
        ${aprovText} aproveitamento
      </span>
    </div>

    <div class="estat-numeros">
      <div class="estat-num">
        <span class="estat-num-valor">${m.total}</span>
        <span class="estat-num-label">Total feitas</span>
      </div>
      <div class="estat-num">
        <span class="estat-num-valor" style="color: var(--cor-sucesso);">${m.certas}</span>
        <span class="estat-num-label">Certas</span>
      </div>
      <div class="estat-num">
        <span class="estat-num-valor" style="color: var(--cor-erro);">${m.erradas}</span>
        <span class="estat-num-label">Revisão</span>
      </div>
    </div>

    <div class="estat-meta">
      <div class="estat-meta-topo">
        <span class="estat-meta-label">
          Meta hoje: ${m.totalHoje}/${metaCentral} questões
          ${iconeStatus}
        </span>
        <span class="estat-meta-pct">${progresso}%</span>
      </div>
      <div class="estat-barra-fundo">
        <div class="estat-barra-progresso" style="width: ${progresso}%; background: ${corBarra};"></div>
      </div>
    </div>
  `

  return card
}

// Exportações apenas para testes (Vitest)
if (typeof globalThis !== 'undefined' && typeof globalThis.window === 'undefined') {
  globalThis.montarRelatorioEvolucao = montarRelatorioEvolucao
  globalThis.normalizarTipoQuestaoRelatorio = normalizarTipoQuestaoRelatorio
  globalThis.contarValoresEstatisticas = contarValores
  globalThis.formatarDataBREstatisticas = formatarDataBR
  globalThis.agruparErradasPorMateria = agruparErradasPorMateria
  globalThis.agruparCertasPorMateria = agruparCertasPorMateria
  globalThis.calcularResumoPeriodo = calcularResumoPeriodo
  globalThis.formatarDeltaRelatorio = formatarDeltaRelatorio
  globalThis.escaparHtmlEstatisticas = escaparHtmlEstatisticas
  globalThis.criarMesesComDetalhesEstatisticas = criarMesesComDetalhesEstatisticas
  globalThis.criarRegistrosArquivadosPorMateria = criarRegistrosArquivadosPorMateria
}
