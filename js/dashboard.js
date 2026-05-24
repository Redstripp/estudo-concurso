// js/dashboard.js

const CHAVE_CHECKLIST_INICIAL_OCULTO = 'estudoConcursoChecklistInicialOculto'
const TAMANHO_PAGINA_CENTRAL_HOJE = 1000
const CAMPOS_QUESTOES_CENTRAL_HOJE = [
  'id',
  'enunciado',
  'alternativas',
  'alternativa_marcada',
  'alternativa_correta',
  'tipo_questao',
  'status_revisao',
  'revisar_novamente_em',
  'revisao_ultima_data',
  'revisao_ultima_resultado',
  'revisao_total_acertos',
  'revisao_total_erros',
  'revisao_etapa',
  'motivo_erro',
  'nivel_confianca',
  'comentario',
  'criado_em',
  'materia_id',
  'edital_topico_id',
  'banca',
  'pegadinha_banca',
  'conceito_chave',
  'como_reconhecer',
  'acao_corretiva',
  'materias(nome)',
  'edital_topicos(titulo, status, peso)'
].join(', ')

let _dashboardCarregando = false

async function inicializarDashboard() {
  if (_dashboardCarregando) return
  _dashboardCarregando = true

  try {
    const centralHoje = document.getElementById('dashboard-central-hoje')
    const cards = document.getElementById('dashboard-cards')
    const grafico = document.getElementById('dashboard-grafico')
    const arquivamento = document.getElementById('dashboard-arquivamento')
    const relatorioErros = document.getElementById('dashboard-relatorio-erros')

    if (centralHoje) centralHoje.innerHTML = criarEstadoVazioDashboard('Central de Hoje', 'Seu resumo do dia aparece aqui assim que os dados forem lidos.')
    if (cards) cards.innerHTML = criarCardsDashboardVazios()
    if (grafico) grafico.innerHTML = criarEstadoVazioDashboard('Atividade semanal', 'Seu gráfico de atividade aparece após o primeiro registro. Comece pelo Caderno de Erros.')
    if (arquivamento) arquivamento.innerHTML = criarEstadoVazioDashboard('Ciclo mensal', 'O ciclo mensal aparece aqui quando houver questões registradas no período.')
    if (relatorioErros) relatorioErros.innerHTML = criarEstadoVazioDashboard('Treinador de padrões', 'Preencha o motivo do erro e o conceito ao registrar questões — o sistema vai mostrar aqui o que está se repetindo.')

    const userId = window.usuarioAtual?.id
    
    if (!userId) {
      const erro = new Error('Usuário não autenticado.')
      erro.detalhe = 'Faça login novamente para acessar o dashboard.'
      mostrarErroDashboard('dashboard-central-hoje', 'Erro de autenticação', erro.message, erro.detalhe)
      mostrarErroDashboard('dashboard-cards', 'Erro de autenticação', erro.message, erro.detalhe)
      mostrarErroDashboard('dashboard-grafico', 'Erro de autenticação', erro.message, erro.detalhe)
      mostrarErroDashboard('dashboard-arquivamento', 'Erro de autenticação', erro.message, erro.detalhe)
      mostrarErroDashboard('dashboard-relatorio-erros', 'Erro de autenticação', erro.message, erro.detalhe)
      return
    }
    
    await Promise.all([
      carregarCentralHojeComErro(userId),
      carregarCardsDashboardComErro(userId)
    ])

    if (window.modoInterfaceAtual === 'essencial') return

    await Promise.all([
      carregarArquivamentoMensalComErro(userId),
      carregarGraficoDashboardComErro(userId),
      carregarRelatorioErrosRecorrentesComErro(userId)
    ])
  } finally {
    _dashboardCarregando = false
  }
}

function criarEstadoVazioDashboard(titulo, texto) {
  return `
    <div class="dashboard-estado-vazio">
      <strong>${escaparHtmlSeguro(titulo)}</strong>
      <p>${escaparHtmlSeguro(texto)}</p>
    </div>
  `
}

function criarCardsDashboardVazios() {
  return `
    <div class="dash-resumo-principal">
      <div class="dash-card dash-card--vazio">
        <div class="dash-card-valor">0</div>
        <div class="dash-card-label">questões no caderno</div>
      </div>
      <div class="dash-card dash-card--vazio">
        <div class="dash-card-valor">0%</div>
        <div class="dash-card-label">aproveitamento geral</div>
      </div>
      <div class="dash-card dash-card--vazio">
        <div class="dash-card-valor">0</div>
        <div class="dash-card-label">dias seguidos</div>
      </div>
      <div class="dash-card dash-card--vazio">
        <div class="dash-card-valor">0</div>
        <div class="dash-card-label">revisões pendentes</div>
      </div>
    </div>
  `
}

async function carregarCardsDashboardComErro(userId) {
  try {
    await carregarCardsDashboard(userId)
  } catch (erro) {
    console.error(erro)
    mostrarErroDashboard(
      'dashboard-cards',
      'Não foi possível carregar os cards',
      erro.message || 'Verifique sua conexão e tente novamente.',
      erro.detalhe
    )
  }
}

async function carregarGraficoDashboardComErro(userId) {
  try {
    await carregarGrafico(userId)
    await carregarRankingMaterias(userId)
  } catch (erro) {
    console.error(erro)
    mostrarErroDashboard(
      'dashboard-grafico',
      'Não foi possível carregar o gráfico',
      erro.message || 'Verifique sua conexão e tente novamente.',
      erro.detalhe
    )
  }
}

async function carregarArquivamentoMensalComErro(userId) {
  try {
    await carregarArquivamentoMensal(userId)
  } catch (erro) {
    console.error(erro)
    mostrarErroDashboard(
      'dashboard-arquivamento',
      'Não foi possível carregar o ciclo mensal',
      erro.message || 'Verifique sua conexão e tente novamente.',
      erro.detalhe
    )
  }
}

async function carregarRelatorioErrosRecorrentesComErro(userId) {
  try {
    await carregarRelatorioErrosRecorrentes(userId)
  } catch (erro) {
    console.error(erro)
    mostrarErroDashboard(
      'dashboard-relatorio-erros',
      'Não foi possível carregar o relatório de erros',
      erro.message || 'Verifique sua conexão e tente novamente.',
      erro.detalhe
    )
  }
}

function mostrarErroDashboard(containerId, titulo, mensagem, detalhe) {
  const container = document.getElementById(containerId)
  if (!container) return

  container.innerHTML = `
    <div class="estado-erro">
      <h3 class="estado-erro-titulo">${escaparHtmlSeguro(titulo)}</h3>
      <p class="estado-erro-texto">${escaparHtmlSeguro(mensagem)}</p>
      ${detalhe ? `<p class="estado-erro-detalhe">${escaparHtmlSeguro(detalhe)}</p>` : ''}
      <button class="btn-secundario" type="button">Tentar novamente</button>
    </div>
  `

  const btn = container.querySelector('button')
  if (btn) {
    const novoBtn = btn.cloneNode(true)
    btn.parentNode.replaceChild(novoBtn, btn)
    // CORREÇÃO: setTimeout quebra a pilha de chamadas síncrona
    novoBtn.addEventListener('click', () => {
      setTimeout(inicializarDashboard, 0)
    })
  }
}

function criarErroConsultaDashboard(mensagem, erroOriginal) {
  const erro = new Error(mensagem)
  erro.detalhe = erroOriginal?.message || erroOriginal?.details || ''
  return erro
}

// ─── CENTRAL DE HOJE ─────────────────────────────────────────

async function carregarCentralHojeComErro(userId) {
  try {
    await carregarCentralHoje(userId)
  } catch (erro) {
    console.error(erro)
    mostrarErroDashboard(
      'dashboard-central-hoje',
      'Não foi possível carregar a Central de Hoje',
      erro.message || 'Verifique sua conexão e tente novamente.',
      erro.detalhe
    )
  }
}

async function carregarCentralHoje(userId) {
  const container = document.getElementById('dashboard-central-hoje')
  if (!container) return

  const hoje = dataISO(new Date())
  const diaSemanaHoje = calcularDiaSemanaCentralHoje(hoje)
  
  // Configuração base
  const configPromessa = typeof obterConfiguracaoRevisaoUsuario === 'function'
    ? obterConfiguracaoRevisaoUsuario(userId)
    : Promise.resolve({ dias_revisao: [6], tempo_revisao_minutos: 60, ultima_revisao_geral: null })

  // Busca paginada para o relatorio usar todas as pendentes, nao uma amostra.
  const questoesPromessa = buscarQuestoesPendentesCentralHoje(userId)

  // Executa tudo em paralelo junto com as outras consultas originais
  const [config, questoes, planoResp, editalResp, planejamentoResp] = await Promise.all([
    configPromessa,
    questoesPromessa,
    db.from('plano_dia_materias').select('id, data, meta_questoes, materias(nome)').eq('user_id', userId).eq('data', hoje).order('criado_em', { ascending: true }),
    db.from('edital_config').select('data_prova, concurso_alvo').eq('user_id', userId).maybeSingle(),
    db.from('planejamento_semanal').select('id, dia_semana, materia_id, meta_questoes, tipo_estudo, materias(nome)').eq('user_id', userId).eq('dia_semana', diaSemanaHoje).order('ordem', { ascending: true })
  ])

  const planoGerado = planoResp.error ? [] : (planoResp.data || [])
  const planejamentoHoje = planejamentoResp.error ? [] : (planejamentoResp.data || [])
  
  const plano = planoGerado.length > 0
    ? planoGerado
    : planejamentoHoje.map(item => ({
        ...item,
        data: hoje,
        origem_planejamento: true
      }))
      
  const planoOrigem = planoGerado.length > 0
    ? 'plano-dia'
    : planejamentoHoje.length > 0
      ? 'planejamento-semanal'
      : 'vazio'
      
  const editalConfig = editalResp.error ? null : editalResp.data
  
  const relatorio = typeof montarRelatorioFilaRevisao === 'function'
    ? montarRelatorioFilaRevisao(questoes, config, editalConfig)
    : montarResumoCentralHojeBasico(questoes)

  const ehRevisao = typeof ehDiaDeRevisaoHoje === 'function' ? ehDiaDeRevisaoHoje(config) : false
  const proxima = typeof calcularProximaDataRevisao === 'function' ? calcularProximaDataRevisao(config.dias_revisao) : hoje
  
  const questoesHoje = questoes.filter(q => String(q.criado_em || '').substring(0, 10) === hoje).length
  const errosHoje = questoes.filter(q => String(q.criado_em || '').substring(0, 10) === hoje && normalizarTipoArquivamento(q) !== 'Chutada').length

  container.innerHTML = criarPainelCentralHoje({
    hoje,
    config,
    relatorio,
    ehRevisao,
    proxima,
    questoesHoje,
    errosHoje,
    plano,
    planoOrigem,
    editalConfig
  })

  // Gerencia listeners dos botões da Central de Hoje usando delegação de eventos
  const containerCentral = document.getElementById('dashboard-central-hoje')
  if (containerCentral && !containerCentral.dataset.listenersCentralHoje) {
    containerCentral.dataset.listenersCentralHoje = 'true'
    
    containerCentral.addEventListener('click', (e) => {
      const btnAtalho = e.target.closest('[data-central-atalho]')
      const btnGerarPlano = e.target.closest('[data-central-gerar-plano]')
      
      if (btnAtalho) {
        const destino = btnAtalho.dataset.centralAtalho
        if (typeof navegarPara === 'function') navegarPara(destino)
        if (destino === 'revisao' && typeof gerarFilaRevisaoInteligente === 'function') {
          setTimeout(() => gerarFilaRevisaoInteligente({ manual: true }), 150)
        }
      }
      
      if (btnGerarPlano) {
        ;(async () => {
          if (typeof gerarPlanoDiaPeloPlanejamento !== 'function') return
          await gerarPlanoDiaPeloPlanejamento(hoje)
          await carregarCentralHoje(userId)
        })()
      }
    })
  }
}

async function buscarQuestoesPendentesCentralHoje(userId) {
  const questoes = []
  let inicio = 0
  let totalEsperado = null

  while (true) {
    const fim = inicio + TAMANHO_PAGINA_CENTRAL_HOJE - 1
    const consulta = db
      .from('questoes')
      .select(CAMPOS_QUESTOES_CENTRAL_HOJE, totalEsperado === null ? { count: 'exact' } : undefined)
      .eq('user_id', userId)
      .eq('status_revisao', 'pendente')
      .order('criado_em', { ascending: false })
      .range(inicio, fim)

    const { data, error, count } = await consulta
    if (error) {
      throw criarErroConsultaDashboard('Não foi possível buscar suas revisões pendentes.', error)
    }

    const pagina = data || []
    if (totalEsperado === null && typeof count === 'number') totalEsperado = count
    questoes.push(...pagina)

    if (pagina.length === 0) break
    if (totalEsperado !== null && questoes.length >= totalEsperado) break
    if (pagina.length < TAMANHO_PAGINA_CENTRAL_HOJE) break

    inicio += TAMANHO_PAGINA_CENTRAL_HOJE
  }

  return questoes
}

function calcularDiaSemanaCentralHoje(dataISO) {
  if (typeof converterDiaSemanaPlanejamento === 'function') {
    return converterDiaSemanaPlanejamento(dataISO)
  }
  const dia = new Date(`${dataISO}T12:00:00`).getDay()
  return dia === 0 ? 7 : dia
}

function montarResumoCentralHojeBasico(questoes) {
  const porMateria = contarOcorrenciasRelatorioErros((questoes || []).map(q => q.materias?.nome || 'Sem matéria'))
  return {
    totalPendente: questoes.length,
    totalCiclo: questoes.length,
    fila: questoes.slice(0, 10),
    porMateria,
    porMotivo: [],
    porTopico: [],
    porPegadinha: [],
    vencidas: 0,
    comPegadinhas: 0,
    semDiagnostico: 0,
    diagnosticoFraco: 0,
    diagnosticoForte: 0,
    semAssunto: 0
  }
}

function criarPainelCentralHoje(dados) {
  const usandoPlanejamentoSemanal = dados.planoOrigem === 'planejamento-semanal'
  const proximoPasso = obterProximoPassoCentral(dados)
  const planoTexto = dados.plano.length > 0
    ? dados.plano.map(item => `${item.materias?.nome || 'Sem matéria'} (${item.meta_questoes})`).slice(0, 4).join(' · ')
    : 'Nenhuma matéria no Plano do Dia ou no Planejamento Semanal de hoje'
  const tituloPlanoHoje = usandoPlanejamentoSemanal
    ? 'O que estudar hoje (planejamento semanal)'
    : 'O que estudar hoje'
  const foco = dados.relatorio.fila?.[0]
  const focoTexto = foco
    ? `${foco.materias?.nome || 'Sem matéria'}${foco.edital_topicos?.titulo ? ` · ${foco.edital_topicos.titulo}` : ''}`
    : 'Sem revisão pendente'
  const diasTexto = typeof textoDiasRevisao === 'function' ? textoDiasRevisao(dados.config.dias_revisao) : 'sábado'
  const proximaTexto = typeof formatarDataCurtaRevisao === 'function' ? formatarDataCurtaRevisao(dados.proxima) : formatarDataBRArquivamento(dados.proxima)
  const totalPendente = Number(dados.relatorio.totalPendente || 0)
  const temRevisaoPendente = totalPendente > 0
  const totalMetaDia = dados.plano.reduce((acc, item) => acc + (Number(item.meta_questoes) || 0), 0)
  const metaDiaTexto = dados.plano.length
    ? `${totalMetaDia} ${totalMetaDia === 1 ? 'questão' : 'questões'} previstas no plano`
    : 'Sem meta configurada para hoje'
  const acaoPrincipal = temRevisaoPendente
    ? { texto: 'Abrir Revisão Inteligente', secao: 'revisao' }
    : { texto: 'Registrar erro', secao: 'questoes' }
  const acaoSecundaria = temRevisaoPendente
    ? { texto: 'Registrar erro', secao: 'questoes' }
    : { texto: 'Ver fila', secao: 'revisao' }

  return `
    <section class="central-hoje-card">
      <div class="central-hoje-topo">
        <div>
          <span class="central-hoje-label">Central de Hoje</span>
          <h3>${dados.ehRevisao ? 'Hoje é dia de revisão' : 'Hoje: registrar, diagnosticar e manter o ciclo leve'}</h3>
          <p>${dados.ehRevisao
            ? 'A fila inteligente já pode transformar os erros acumulados em revisão prática.'
            : `Próxima revisão em ${escaparHtmlSeguro(proximaTexto)}. Dias configurados: ${escaparHtmlSeguro(diasTexto)}.`}</p>
        </div>
        <div class="central-hoje-acoes">
          <button class="btn-primario" data-central-atalho="${escaparHtmlSeguro(acaoPrincipal.secao)}" type="button">${escaparHtmlSeguro(acaoPrincipal.texto)}</button>
          <button class="btn-secundario" data-central-atalho="${escaparHtmlSeguro(acaoSecundaria.secao)}" type="button">${escaparHtmlSeguro(acaoSecundaria.texto)}</button>
          ${usandoPlanejamentoSemanal ? '<button class="btn-secundario" data-central-gerar-plano type="button">Gerar plano de hoje</button>' : ''}
        </div>
      </div>

      <div class="central-hoje-visual">
        <div class="${temRevisaoPendente ? 'central-hoje-visual-item central-hoje-visual-item--pendente' : 'central-hoje-visual-item central-hoje-visual-item--ok'}">
          <span class="central-hoje-visual-icone">${temRevisaoPendente ? '&#11036;' : '&#9989;'}</span>
          <div>
            <strong>Revisão do dia</strong>
            <p>${temRevisaoPendente ? `${totalPendente} ${totalPendente === 1 ? 'questão' : 'questões'} para revisar` : 'Nada para revisar hoje'}</p>
          </div>
        </div>
        <div class="central-hoje-visual-item">
          <span class="central-hoje-visual-icone">&#128221;</span>
          <div>
            <strong>Registro de hoje</strong>
            <p>${dados.questoesHoje} ${dados.questoesHoje === 1 ? 'questão' : 'questões'} registrada${dados.questoesHoje !== 1 ? 's' : ''} hoje</p>
          </div>
        </div>
        <div class="central-hoje-visual-item">
          <span class="central-hoje-visual-icone">&#127919;</span>
          <div>
            <strong>Meta do dia</strong>
            <p>${escaparHtmlSeguro(metaDiaTexto)}</p>
          </div>
        </div>
      </div>

      <div class="central-proximo-passo">
        <div>
          <span class="central-hoje-label">Próximo melhor passo</span>
          <strong>${escaparHtmlSeguro(proximoPasso.titulo)}</strong>
          <p>${escaparHtmlSeguro(proximoPasso.texto)}</p>
        </div>
        <button class="${proximoPasso.primario ? 'btn-primario' : 'btn-secundario'}" ${proximoPasso.gerarPlano ? 'data-central-gerar-plano' : `data-central-atalho="${escaparHtmlSeguro(proximoPasso.secao)}"`} type="button">
          ${escaparHtmlSeguro(proximoPasso.acao)}
        </button>
      </div>

      <div class="central-hoje-metricas">
        <div><strong>${dados.questoesHoje}</strong><span>questões registradas hoje</span></div>
        <div><strong>${dados.errosHoje}</strong><span>erros reais hoje</span></div>
        <div><strong>${dados.relatorio.totalPendente}</strong><span>revisões pendentes</span></div>
        <div><strong>${dados.relatorio.totalCiclo}</strong><span>erros para o ciclo</span></div>
      </div>

      ${criarPainelMetaQualidadeCentral(dados.relatorio)}

      <div class="central-hoje-corpo">
        <div>
          <strong>${escaparHtmlSeguro(tituloPlanoHoje)}</strong>
          <p>${escaparHtmlSeguro(planoTexto)}</p>
        </div>
        <div>
          <strong>Foco da revisão</strong>
          <p>${escaparHtmlSeguro(focoTexto)}</p>
        </div>
        <div>
          <strong>Padrão em atenção</strong>
          <p>${escaparHtmlSeguro(dados.relatorio.porMotivo?.find(item => item.nome !== 'Sem motivo preenchido')?.nome || 'Ainda sem padrão dominante')}</p>
        </div>
      </div>

      <div class="central-hoje-manual">
        <span>Novo por aqui?</span>
        <a href="manual-uso.html" target="_blank" rel="noopener">Baixe o manual de uso</a>
      </div>
    </section>
  `
}

function obterProximoPassoCentral(dados) {
  const diagnosticosAjustar = Number(dados.relatorio.semDiagnostico || 0) + Number(dados.relatorio.diagnosticoFraco || 0)

  if (dados.planoOrigem === 'planejamento-semanal') {
    return {
      titulo: 'Transformar a grade semanal em plano de hoje',
      texto: 'A Central já encontrou as matérias previstas para hoje. Gere o Plano do Dia para acompanhar meta e progresso por matéria.',
      acao: 'Gerar plano de hoje',
      gerarPlano: true,
      primario: true
    }
  }

  if (dados.ehRevisao && Number(dados.relatorio.fila?.length || 0) > 0) {
    return {
      titulo: 'Iniciar a revisão inteligente',
      texto: 'Hoje é dia configurado de revisão. Comece pela fila priorizada para atacar os erros com maior chance de se repetir.',
      acao: 'Iniciar revisão',
      secao: 'revisao',
      primario: true
    }
  }

  if (diagnosticosAjustar > 0) {
    return {
      titulo: 'Melhorar diagnósticos fracos',
      texto: `${diagnosticosAjustar} ${diagnosticosAjustar === 1 ? 'questão precisa' : 'questões precisam'} de mais contexto para gerar revisões melhores.`,
      acao: 'Completar diagnósticos',
      secao: 'questoes',
      primario: true
    }
  }

  if (Number(dados.relatorio.totalCiclo || 0) > 0) {
    return {
      titulo: 'Conferir a fila antes de estudar mais',
      texto: 'Já existem erros acumulados no ciclo. Veja a prioridade antes de abrir um novo bloco de questões.',
      acao: 'Ver fila',
      secao: 'revisao',
      primario: false
    }
  }

  if (!dados.plano.length) {
    if (window.modoInterfaceAtual === 'essencial') {
      return {
        titulo: 'Começar pelo primeiro erro útil',
        texto: 'No Modo Essencial, o caminho é simples: estude, resolva questões e registre apenas os erros que precisam virar revisão.',
        acao: 'Registrar erro',
        secao: 'questoes',
        primario: true
      }
    }

    return {
      titulo: 'Definir o estudo de hoje',
      texto: 'Monte ou gere o Plano do Dia para transformar sua rotina semanal em metas por matéria.',
      acao: 'Planejar semana',
      secao: 'planejamento',
      primario: true
    }
  }

  return {
    titulo: 'Registrar o próximo erro útil',
    texto: 'Depois de estudar e resolver questões, registre o erro com causa, assunto e pegadinha quando houver.',
    acao: 'Registrar erro',
    secao: 'questoes',
    primario: true
  }
}

function criarPainelMetaQualidadeCentral(relatorio = {}) {
  const totalCiclo = Number(relatorio.totalCiclo || 0)
  const fortes = Number(relatorio.diagnosticoForte || 0)
  const diagnosticosAjustar = Number(relatorio.semDiagnostico || 0) + Number(relatorio.diagnosticoFraco || 0)
  const semAssunto = Number(relatorio.semAssunto || 0)
  const comPegadinhas = Number(relatorio.comPegadinhas || 0)
  const qualidade = totalCiclo > 0 ? Math.round((fortes / totalCiclo) * 100) : 0
  const classeQualidade = qualidade >= 70 ? 'alta' : qualidade >= 40 ? 'media' : 'baixa'
  const texto = totalCiclo === 0
    ? 'Registre erros com motivo, assunto e pegadinhas quando houver para criar revisões melhores.'
    : diagnosticosAjustar === 0 && semAssunto === 0
      ? 'Os erros do ciclo estão bem classificados. A fila consegue priorizar com mais segurança.'
      : 'Antes de aumentar a quantidade, melhore a classificação dos erros que ainda estão fracos.'

  return `
    <div class="central-qualidade">
      <div>
        <span class="central-hoje-label">Meta de qualidade</span>
        <strong>${qualidade}% dos erros do ciclo com diagnóstico forte</strong>
        <p>${escaparHtmlSeguro(texto)}</p>
        <div class="qualidade-progresso qualidade-progresso--${classeQualidade}">
          <div class="qualidade-progresso-barra">
            <span class="qualidade-progresso-preenchimento" style="width: ${qualidade}%;"></span>
            <span class="qualidade-progresso-referencia" title="Meta de 70%"></span>
          </div>
          <small>${fortes} de ${totalCiclo} questões com diagnóstico completo</small>
        </div>
      </div>
      <div class="central-qualidade-metricas">
        <span>${diagnosticosAjustar} a reforçar</span>
        <span>${semAssunto} sem assunto</span>
        <span>${comPegadinhas} com pegadinha</span>
      </div>
    </div>
  `
}

// ─── ARQUIVAMENTO MENSAL ─────────────────────────────────

async function carregarArquivamentoMensal(userId) {
  const container = document.getElementById('dashboard-arquivamento')
  if (!container) return

  let periodo = await obterPeriodoArquivamentoMensal(userId)
  const mostrarProtecaoBanco = usuarioPodeVerProtecaoBanco()
  const protecaoBancoPromessa = mostrarProtecaoBanco ? buscarProtecaoBancoCheio(userId) : Promise.resolve(null)
  let dados = await buscarDadosArquivamentoMensal(userId, periodo)
  let resumo = montarResumoArquivamentoMensal(dados, periodo)

  if (periodo.cicloAnteriorAutomatico && resumo.totalDetalhadas === 0) {
    periodo = criarPeriodoArquivamento(criarDataInicioMesAtualArquivamento())
    dados = await buscarDadosArquivamentoMensal(userId, periodo)
    resumo = montarResumoArquivamentoMensal(dados, periodo)
  }

  const [resumoSalvo, protecaoBanco] = await Promise.all([
    buscarResumoMensalSalvo(userId, periodo),
    protecaoBancoPromessa
  ])

  container.innerHTML = criarPainelArquivamentoMensal(periodo, resumo, resumoSalvo, protecaoBanco)

  // Remove listeners antigos antes de adicionar novos
  const btnPdf = container.querySelector('#btn-gerar-pdf-mensal')
  const inputMesPdf = container.querySelector('#input-mes-pdf-mensal')
  if (btnPdf) {
    const novoBtnPdf = btnPdf.cloneNode(true)
    btnPdf.parentNode.replaceChild(novoBtnPdf, btnPdf)
    novoBtnPdf.addEventListener('click', () => {
      const periodoPdf = criarPeriodoPdfMensalSelecionado(inputMesPdf?.value)
      gerarPdfArquivamentoMensal(userId, periodoPdf, {
        atualizarBloqueioArquivamento: periodoPdf.periodoMes === periodo.periodoMes
      })
    })
  }

  const btnArquivar = container.querySelector('#btn-arquivar-limpar-mensal')
  if (btnArquivar) {
    const novoBtnArquivar = btnArquivar.cloneNode(true)
    btnArquivar.parentNode.replaceChild(novoBtnArquivar, btnArquivar)
    novoBtnArquivar.addEventListener('click', () => arquivarELimparMes(userId, periodo))
  }
}

async function obterPeriodoArquivamentoMensal(userId) {
  const pendente = await buscarPeriodoPendenteArquivamento(userId)
  if (pendente) return criarPeriodoArquivamento(pendente.data, { pendente: true, podeLimpar: true })

  const hoje = new Date()
  const dia = hoje.getDate()
  const alvo = dia <= 7
    ? new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    : new Date(hoje.getFullYear(), hoje.getMonth(), 1)

  return criarPeriodoArquivamento(alvo, {
    podeLimpar: dia <= 7,
    fimDeMes: dia >= 25,
    cicloAnteriorAutomatico: dia <= 7
  })
}

async function buscarPeriodoPendenteArquivamento(userId) {
  const hoje = new Date()
  const inicioMesAtual = dataISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1))

  const { data, count, error } = await db
    .from('questoes')
    .select('criado_em', { count: 'exact' })
    .eq('user_id', userId)
    .lt('criado_em', `${inicioMesAtual}T00:00:00`)
    .order('criado_em', { ascending: true })
    .limit(1)

  if (error) throw criarErroConsultaDashboard('Não foi possível verificar ciclos antigos pendentes.', error)
  if (!count || !data?.[0]?.criado_em) return null

  const [ano, mes] = data[0].criado_em.substring(0, 10).split('-').map(Number)
  return {
    data: new Date(ano, mes - 1, 1),
    total: count
  }
}

function criarPeriodoArquivamento(alvo, opcoes = {}) {
  const hoje = new Date()
  const dia = hoje.getDate()
  const fim = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0)
  const fimDataHora = new Date(fim)
  fimDataHora.setHours(23, 59, 59, 999)

  return {
    inicio: dataISO(alvo),
    fim: dataISO(fim),
    fimDataHora: fimDataHora.toISOString(),
    periodoMes: dataISO(alvo),
    rotulo: alvo.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    podeLimpar: Boolean(opcoes.podeLimpar),
    fimDeMes: Boolean(opcoes.fimDeMes),
    pendente: Boolean(opcoes.pendente),
    cicloAnteriorAutomatico: Boolean(opcoes.cicloAnteriorAutomatico),
    diasParaVirada: Math.max(0, fim.getDate() - dia + 1)
  }
}

function criarDataInicioMesAtualArquivamento() {
  const hoje = new Date()
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
}

function criarValorMesPdfPadrao(dataBase = new Date()) {
  const ano = dataBase.getFullYear()
  const mes = String(dataBase.getMonth() + 1).padStart(2, '0')
  return `${ano}-${mes}`
}

function criarPeriodoPdfMensalSelecionado(valorMes, dataBase = new Date()) {
  const valorPadrao = criarValorMesPdfPadrao(dataBase)
  const texto = String(valorMes || '')
  const match = /^(\d{4})-(\d{2})$/.exec(texto)
  const mes = Number(match?.[2])
  const valor = match && mes >= 1 && mes <= 12 ? texto : valorPadrao
  const valorSeguro = valor > valorPadrao ? valorPadrao : valor
  const [anoSelecionado, mesSelecionado] = valorSeguro.split('-').map(Number)
  return criarPeriodoArquivamento(new Date(anoSelecionado, mesSelecionado - 1, 1))
}

async function buscarDadosArquivamentoMensal(userId, periodo) {
  const [questoesResp, sessoesResp, simuladosResp] = await Promise.all([
    db
      .from('questoes')
      .select('id, materia_id, enunciado, alternativas, alternativa_marcada, alternativa_correta, tipo_questao, motivo_erro, nivel_confianca, comentario, pegadinha_banca, conceito_chave, como_reconhecer, acao_corretiva, criado_em, materias(nome)')
      .eq('user_id', userId)
      .gte('criado_em', `${periodo.inicio}T00:00:00`)
      .lte('criado_em', periodo.fimDataHora)
      .order('criado_em', { ascending: true }),
    db
      .from('sessoes_estudo')
      .select('id, data, total_questoes')
      .eq('user_id', userId)
      .gte('data', periodo.inicio)
      .lte('data', periodo.fim),
    db
      .from('simulados')
      .select('id, data, nome, banca, total_questoes, certas, erradas, tempo_minutos, nota_percentual, comentario')
      .eq('user_id', userId)
      .gte('data', periodo.inicio)
      .lte('data', periodo.fim)
      .order('data', { ascending: true })
  ])

  if (questoesResp.error) throw criarErroConsultaDashboard('Não foi possível buscar as questões do ciclo mensal.', questoesResp.error)
  if (sessoesResp.error) throw criarErroConsultaDashboard('Não foi possível buscar as sessões do ciclo mensal.', sessoesResp.error)
  if (simuladosResp.error) throw criarErroConsultaDashboard('Não foi possível buscar os simulados do ciclo mensal.', simuladosResp.error)

  const sessoes = sessoesResp.data || []
  const idsSessoes = sessoes.map(s => s.id)
  let questoesCertas = []

  if (idsSessoes.length > 0) {
    const certasResp = await db
      .from('questoes_certas')
      .select('id, sessao_id, materia_id, quantidade, criado_em, materias(nome)')
      .eq('user_id', userId)
      .in('sessao_id', idsSessoes)

    if (certasResp.error) throw criarErroConsultaDashboard('Não foi possível buscar os acertos do ciclo mensal.', certasResp.error)
    questoesCertas = certasResp.data || []
  }

  return {
    questoes: questoesResp.data || [],
    sessoes,
    questoesCertas,
    simulados: simuladosResp.data || []
  }
}

async function buscarResumoMensalSalvo(userId, periodo) {
  const { data, error } = await db
    .from('estatisticas_mensais')
    .select('id, arquivado_em, total_questoes, total_acertos, total_erradas, total_chutadas')
    .eq('user_id', userId)
    .eq('periodo_mes', periodo.periodoMes)
    .maybeSingle()

  if (error) return { tabelaDisponivel: false, data: null }
  return { tabelaDisponivel: true, data }
}

function montarResumoArquivamentoMensal(dados, periodo) {
  const porMateria = {}
  const motivos = {}
  const confianca = {}
  const questoes = dados.questoes || []
  const certas = dados.questoesCertas || []

  questoes.forEach(q => {
    const materia = q.materias?.nome || 'Sem matéria'
    const chave = q.materia_id || materia
    if (!porMateria[chave]) porMateria[chave] = criarResumoMateriaArquivamento(materia, q.materia_id)

    porMateria[chave].detalhadas += 1
    if (normalizarTipoArquivamento(q) === 'Chutada') porMateria[chave].chutadas += 1
    else porMateria[chave].erradas += 1

    if (q.motivo_erro) motivos[q.motivo_erro] = (motivos[q.motivo_erro] || 0) + 1
    if (q.nivel_confianca) confianca[q.nivel_confianca] = (confianca[q.nivel_confianca] || 0) + 1
  })

  certas.forEach(q => {
    const materia = q.materias?.nome || 'Sem matéria'
    const qtd = Number(q.quantidade) || 0
    const chave = q.materia_id || materia
    if (!porMateria[chave]) porMateria[chave] = criarResumoMateriaArquivamento(materia, q.materia_id)
    porMateria[chave].acertos += qtd
  })

  const desempenhoPorMateria = Object.values(porMateria)
    .map(m => ({
      ...m,
      total: m.acertos + m.erradas + m.chutadas,
      aproveitamento: m.acertos + m.erradas + m.chutadas > 0
        ? Math.round((m.acertos / (m.acertos + m.erradas + m.chutadas)) * 100)
        : null
    }))
    .sort((a, b) => a.materia.localeCompare(b.materia))

  const totalAcertos = certas.reduce((acc, q) => acc + (Number(q.quantidade) || 0), 0)
  const totalChutadas = questoes.filter(q => normalizarTipoArquivamento(q) === 'Chutada').length
  const totalErradas = questoes.length - totalChutadas

  return {
    periodo,
    totalDetalhadas: questoes.length,
    totalAcertos,
    totalErradas,
    totalChutadas,
    totalGeral: totalAcertos + questoes.length,
    desempenhoPorMateria,
    motivos,
    confianca,
    totalSimulados: dados.simulados.length
  }
}

function criarResumoMateriaArquivamento(materia, materiaId = null) {
  return {
    materia_id: materiaId,
    materia,
    acertos: 0,
    erradas: 0,
    chutadas: 0,
    detalhadas: 0
  }
}

function normalizarTipoArquivamento(q) {
  if (q?.tipo_questao === 'Chutada') return 'Chutada'
  return 'Errada'
}

function chaveRelatorioMensalGerado(periodo) {
  return `estudoConcursoPdfMensal:${periodo.periodoMes}`
}

function relatorioMensalGerado(periodo) {
  return sessionStorage.getItem(chaveRelatorioMensalGerado(periodo)) === 'sim'
}

function marcarRelatorioMensalGerado(periodo) {
  sessionStorage.setItem(chaveRelatorioMensalGerado(periodo), 'sim')
}

function atualizarBloqueioArquivamentoAposPdf(periodo, resumo) {
  document.getElementById('aviso-pdf-obrigatorio')?.remove()

  const btnArquivar = document.getElementById('btn-arquivar-limpar-mensal')
  if (btnArquivar && periodo.podeLimpar && resumo.totalDetalhadas > 0) {
    btnArquivar.disabled = false
  }
}

function usuarioPodeVerProtecaoBanco() {
  const emailUsuario = window.usuarioAtual?.email?.toLowerCase()
  if (!emailUsuario) return false

  const admins = normalizarEmailsAdmin(window.ADMIN_EMAILS)
  return admins.includes(emailUsuario)
}

function normalizarEmailsAdmin(valor) {
  if (Array.isArray(valor)) {
    return valor
      .map(email => String(email).trim().toLowerCase())
      .filter(Boolean)
  }

  if (typeof valor === 'string') {
    return valor
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)
  }

  return []
}

async function buscarProtecaoBancoCheio(userId) {
  const hoje = new Date()
  const inicioMesAtual = dataISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1))

  const [totalResp, antigasResp] = await Promise.all([
    db
      .from('questoes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    db
      .from('questoes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lt('criado_em', `${inicioMesAtual}T00:00:00`)
  ])

  if (totalResp.error || antigasResp.error) {
    return {
      disponivel: false,
      nivel: 'neutro',
      totalDetalhadas: 0,
      antigas: 0,
      estimativaMb: 0
    }
  }

  const totalDetalhadas = totalResp.count || 0
  const antigas = antigasResp.count || 0
  const estimativaMb = Math.round(totalDetalhadas * 0.008 * 10) / 10
  let nivel = 'ok'

  if (totalDetalhadas >= 2200 || estimativaMb >= 18) nivel = 'critico'
  else if (totalDetalhadas >= 1200 || estimativaMb >= 10 || antigas >= 500) nivel = 'aviso'
  else if (antigas > 0) nivel = 'atencao'

  return {
    disponivel: true,
    nivel,
    totalDetalhadas,
    antigas,
    estimativaMb
  }
}

function criarPainelProtecaoBancoCheio(protecao) {
  if (!protecao?.disponivel) return ''

  const textos = {
    ok: 'Volume saudável de questões detalhadas.',
    atencao: 'Há questões antigas que já podem ter o resumo mensal registrado.',
    aviso: 'O volume de questões detalhadas está subindo. Acompanhe os ciclos antigos e registre os resumos mensais.',
    critico: 'Atenção: o volume estimado está alto. Acompanhe os dados e considere arquivar registros antigos quando necessário.'
  }

  return `
    <div class="protecao-banco protecao-banco--${protecao.nivel}">
      <div>
        <strong>Proteção contra banco cheio</strong>
        <p>${escaparHtmlSeguro(textos[protecao.nivel] || textos.ok)}</p>
      </div>
      <div class="protecao-banco-metricas">
        <span>${protecao.totalDetalhadas} detalhadas ativas</span>
        <span>${protecao.antigas} de meses anteriores</span>
        <span>Volume estimado: ~${protecao.estimativaMb} MB</span>
      </div>
    </div>
  `
}

function criarPainelArquivamentoMensal(periodo, resumo, resumoSalvo, protecaoBanco) {
  const mesPdfPadrao = criarValorMesPdfPadrao()
  const statusTexto = periodo.pendente
    ? `Há questões de ${periodo.rotulo} pendentes. Gere o PDF e arquive o resumo mensal sem apagar suas questões.`
    : periodo.podeLimpar
    ? `O ciclo de ${periodo.rotulo} já pode ter o resumo mensal arquivado.`
    : periodo.fimDeMes
      ? `Faltam cerca de ${periodo.diasParaVirada} dia${periodo.diasParaVirada !== 1 ? 's' : ''} para virar o mês. Gere o PDF antes de arquivar o resumo.`
      : `O ciclo de ${periodo.rotulo} está em andamento.`

  const avisoTabela = resumoSalvo.tabelaDisponivel
    ? ''
    : '<p class="arquivamento-alerta">Para salvar o resumo mensal, execute antes o arquivo supabase-arquivamento-mensal.sql no Supabase.</p>'

  const arquivadoTexto = resumoSalvo.data?.arquivado_em
    ? `<span class="tag-revisao tag-revisao--acerto">Arquivado em ${formatarDataHoraArquivamento(resumoSalvo.data.arquivado_em)}</span>`
    : ''
  const pdfGerado = relatorioMensalGerado(periodo)
  const podeArquivar = periodo.podeLimpar && resumo.totalDetalhadas > 0 && resumoSalvo.tabelaDisponivel && pdfGerado
  const avisoPdf = periodo.podeLimpar && resumo.totalDetalhadas > 0 && resumoSalvo.tabelaDisponivel && !pdfGerado
    ? '<p class="arquivamento-alerta" id="aviso-pdf-obrigatorio">Gere o PDF deste ciclo antes de arquivar o resumo mensal.</p>'
    : ''

  return `
    <div class="arquivamento-card">
      <div class="arquivamento-topo">
        <div>
          <h3>Ciclo mensal de revisão</h3>
          <p>${escaparHtmlSeguro(statusTexto)}</p>
        </div>
        <div class="arquivamento-tags">
          <span class="tag-estudo">${escaparHtmlSeguro(periodo.rotulo)}</span>
          ${arquivadoTexto}
        </div>
      </div>
      <div class="arquivamento-metricas">
        <div><strong>${resumo.totalDetalhadas}</strong><span>questões detalhadas</span></div>
        <div><strong>${resumo.totalErradas}</strong><span>erradas</span></div>
        <div><strong>${resumo.totalChutadas}</strong><span>chutadas</span></div>
        <div><strong>${resumo.totalAcertos}</strong><span>acertos preservados</span></div>
      </div>
      ${avisoTabela}
      ${avisoPdf}
      ${criarPainelProtecaoBancoCheio(protecaoBanco)}
      <div class="arquivamento-pdf-opcoes">
        <label for="input-mes-pdf-mensal">Mês do PDF</label>
        <input id="input-mes-pdf-mensal" type="month" value="${mesPdfPadrao}" max="${mesPdfPadrao}" />
        <small>Selecione o mês que deseja exportar.</small>
      </div>
      <div class="arquivamento-acoes">
        <button class="btn-secundario" id="btn-gerar-pdf-mensal" type="button">Gerar PDF do período selecionado</button>
        <button class="btn-secundario" id="btn-arquivar-limpar-mensal" type="button" ${podeArquivar ? '' : 'disabled'}>
          Arquivar resumo mensal
        </button>
      </div>
      <p class="arquivamento-ajuda">As questões detalhadas serão mantidas para revisão futura.</p>
      <p class="msg-materia" id="msg-arquivamento-mensal"></p>
    </div>
  `
}

async function gerarPdfArquivamentoMensal(userId, periodo, opcoes) {
  const opcoesPdf = opcoes || {}
  const msg = document.getElementById('msg-arquivamento-mensal')
  const janela = window.open('', '_blank')

  if (!janela) {
    if (msg) {
      msg.textContent = 'O navegador bloqueou a janela do relatório. Permita pop-ups para este site e tente novamente.'
      msg.className = 'msg-materia erro'
    }
    return
  }

  janela.document.write('<p style="font-family: Arial, sans-serif; padding: 24px;">Gerando relatório...</p>')
  if (msg) {
    msg.textContent = 'Gerando relatório...'
    msg.className = 'msg-materia'
  }

  try {
    const dados = await buscarDadosArquivamentoMensal(userId, periodo)
    const resumo = montarResumoArquivamentoMensal(dados, periodo)
    abrirRelatorioMensalParaImpressao(janela, periodo, dados, resumo)
    marcarRelatorioMensalGerado(periodo)
    if (opcoesPdf.atualizarBloqueioArquivamento !== false) {
      atualizarBloqueioArquivamentoAposPdf(periodo, resumo)
    }
    if (msg) {
      msg.textContent = 'Relatório aberto. Use Imprimir > Salvar como PDF.'
      msg.className = 'msg-materia sucesso'
    }
  } catch (erro) {
    console.error(erro)
    if (!janela.closed) janela.close()
    if (msg) {
      msg.textContent = 'Não foi possível gerar o relatório. Verifique se o navegador permitiu a nova janela e tente novamente.'
      msg.className = 'msg-materia erro'
    }
  }
}

async function arquivarELimparMes(userId, periodo) {
  const msg = document.getElementById('msg-arquivamento-mensal')

  if (!relatorioMensalGerado(periodo)) {
    msg.textContent = 'Gere o PDF deste ciclo antes de arquivar o resumo mensal.'
    msg.className = 'msg-materia erro'
    return
  }

  const confirmacao = prompt(`Digite ARQUIVAR para salvar o resumo de ${periodo.rotulo}. As questões detalhadas serão mantidas.`)
  if (confirmacao !== 'ARQUIVAR') return

  msg.textContent = 'Arquivando resumo mensal...'
  msg.className = 'msg-materia'

  try {
    const dados = await buscarDadosArquivamentoMensal(userId, periodo)
    const resumo = montarResumoArquivamentoMensal(dados, periodo)

    if (resumo.totalDetalhadas === 0) {
      msg.textContent = 'Não há questões detalhadas neste ciclo.'
      msg.className = 'msg-materia erro'
      return
    }

    await salvarResumoMensal(userId, periodo, resumo)

    msg.textContent = 'Resumo salvo. As questões detalhadas foram mantidas.'
    msg.className = 'msg-materia sucesso'
    await inicializarDashboard()
    if (typeof verificarAvisoArquivamentoPendente === 'function') verificarAvisoArquivamentoPendente()
  } catch (erro) {
    console.error(erro)
    msg.textContent = erro?.message?.includes('estatisticas_mensais')
      ? 'Execute o arquivo supabase-arquivamento-mensal.sql no Supabase e tente novamente.'
      : 'Não foi possível salvar o resumo mensal. Verifique sua conexão e tente novamente.'
    msg.className = 'msg-materia erro'
  }
}

async function salvarResumoMensal(userId, periodo, resumo) {
  const { error } = await db
    .from('estatisticas_mensais')
    .upsert({
      user_id: userId,
      periodo_mes: periodo.periodoMes,
      periodo_inicio: periodo.inicio,
      periodo_fim: periodo.fim,
      total_questoes: resumo.totalGeral,
      total_acertos: resumo.totalAcertos,
      total_erradas: resumo.totalErradas,
      total_chutadas: resumo.totalChutadas,
      desempenho_por_materia: resumo.desempenhoPorMateria,
      motivos: resumo.motivos,
      confianca: resumo.confianca,
      arquivado_em: new Date().toISOString()
    }, { onConflict: 'user_id,periodo_mes' })

  if (error) throw error
}

function abrirRelatorioMensalParaImpressao(janela, periodo, dados, resumo) {
  const html = criarHtmlRelatorioMensal(periodo, dados, resumo)
  janela.document.open()
  janela.document.write(html)
  janela.document.close()
  janela.focus()

  setTimeout(() => {
    if (!janela.closed) janela.print()
  }, 500)
}

function criarHtmlRelatorioMensal(periodo, dados, resumo) {
  const geradoEm = formatarDataHoraArquivamento(new Date().toISOString())
  const desempenho = criarTabelaDesempenhoRelatorio(resumo.desempenhoPorMateria)
  const questoes = criarQuestoesRelatorio(dados.questoes || [])
  const simulados = criarSimuladosRelatorio(dados.simulados || [])
  const motivos = criarListaContagemRelatorio('Motivos mais frequentes', resumo.motivos)
  const confianca = criarListaContagemRelatorio('Nível de confiança', resumo.confianca)

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Arquivo mensal - ${escaparHtmlSeguro(periodo.rotulo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { color: #172033; font-family: Arial, sans-serif; line-height: 1.45; margin: 0; padding: 32px; }
    h1, h2, h3 { margin: 0; }
    h1 { font-size: 28px; }
    h2 { border-bottom: 1px solid #d8dee9; font-size: 18px; margin: 28px 0 12px; padding-bottom: 8px; }
    h3 { font-size: 15px; margin-bottom: 8px; }
    p { margin: 0; }
    table { border-collapse: collapse; margin-top: 10px; width: 100%; }
    th, td { border: 1px solid #d8dee9; font-size: 12px; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f2f5f9; }
    .cabecalho { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .subtitulo { color: #667085; font-size: 13px; margin-top: 6px; }
    .cards { display: grid; gap: 10px; grid-template-columns: repeat(4, 1fr); margin: 20px 0; }
    .card { border: 1px solid #d8dee9; border-radius: 8px; padding: 12px; }
    .valor { display: block; font-size: 24px; font-weight: 700; line-height: 1; }
    .label { color: #667085; display: block; font-size: 11px; margin-top: 5px; text-transform: uppercase; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .chip { background: #f2f5f9; border: 1px solid #d8dee9; border-radius: 999px; font-size: 12px; padding: 4px 10px; }
    .materia { break-inside: avoid; margin-top: 18px; }
    .questao { border: 1px solid #d8dee9; border-radius: 8px; break-inside: avoid; margin: 10px 0; padding: 12px; }
    .questao-topo { color: #667085; display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; margin-bottom: 8px; }
    .tag { background: #eef6ff; border-radius: 999px; color: #0b5cab; display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 8px; }
    .texto { white-space: pre-wrap; }
    .alternativas { margin: 10px 0; }
    .alternativa { border: 1px solid #d8dee9; border-radius: 6px; margin-bottom: 5px; padding: 6px 8px; }
    .alternativa-correta { border-color: #16a34a; }
    .alternativa-marcada { border-color: #dc2626; }
    .campos { display: grid; gap: 8px; grid-template-columns: repeat(2, 1fr); margin-top: 10px; }
    .campo { background: #f8fafc; border: 1px solid #d8dee9; border-radius: 6px; padding: 8px; }
    .campo strong { display: block; font-size: 11px; margin-bottom: 3px; text-transform: uppercase; }
    .vazio { color: #667085; font-style: italic; }
    @media print {
      body { padding: 18mm; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <header class="cabecalho">
    <div>
      <h1>Arquivo mensal de revisão</h1>
      <p class="subtitulo">${escaparHtmlSeguro(periodo.rotulo)} • ${formatarDataBRArquivamento(periodo.inicio)} a ${formatarDataBRArquivamento(periodo.fim)}</p>
    </div>
    <p class="subtitulo">Gerado em ${escaparHtmlSeguro(geradoEm)}</p>
  </header>

  <section class="cards">
    <div class="card"><span class="valor">${resumo.totalGeral}</span><span class="label">Questões no ciclo</span></div>
    <div class="card"><span class="valor">${resumo.totalAcertos}</span><span class="label">Acertos preservados</span></div>
    <div class="card"><span class="valor">${resumo.totalErradas}</span><span class="label">Erradas</span></div>
    <div class="card"><span class="valor">${resumo.totalChutadas}</span><span class="label">Chutadas</span></div>
  </section>

  <section>
    <h2>Desempenho por matéria</h2>
    ${desempenho}
  </section>

  <section>
    <h2>Diagnóstico do mês</h2>
    ${motivos}
    ${confianca}
  </section>

  <section>
    <h2>Questões erradas e chutadas</h2>
    ${questoes}
  </section>

  <section>
    <h2>Simulados do período</h2>
    ${simulados}
  </section>
</body>
</html>`
}

function criarTabelaDesempenhoRelatorio(desempenhoPorMateria) {
  if (!desempenhoPorMateria || desempenhoPorMateria.length === 0) {
    return '<p class="vazio">Nenhuma questão registrada neste ciclo.</p>'
  }

  const linhas = desempenhoPorMateria.map(m => `
    <tr>
      <td>${escaparHtmlSeguro(m.materia)}</td>
      <td>${m.acertos}</td>
      <td>${m.erradas}</td>
      <td>${m.chutadas}</td>
      <td>${m.total}</td>
      <td>${m.aproveitamento === null ? '-' : `${m.aproveitamento}%`}</td>
    </tr>
  `).join('')

  return `
    <table>
      <thead>
        <tr>
          <th>Matéria</th>
          <th>Acertos</th>
          <th>Erradas</th>
          <th>Chutadas</th>
          <th>Total</th>
          <th>Aproveitamento</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  `
}

function criarListaContagemRelatorio(titulo, valores) {
  const entradas = Object.entries(valores || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  if (entradas.length === 0) {
    return `
      <div class="campo">
        <strong>${escaparHtmlSeguro(titulo)}</strong>
        <span class="vazio">Sem dados registrados.</span>
      </div>
    `
  }

  return `
    <div class="campo">
      <strong>${escaparHtmlSeguro(titulo)}</strong>
      <div class="chips">
        ${entradas.map(([nome, total]) => `<span class="chip">${escaparHtmlSeguro(nome)}: ${total}</span>`).join('')}
      </div>
    </div>
  `
}

function criarQuestoesRelatorio(questoes) {
  if (!questoes || questoes.length === 0) {
    return '<p class="vazio">Nenhuma questão errada ou chutada registrada neste ciclo.</p>'
  }

  const grupos = agruparQuestoesRelatorio(questoes)
  return Object.entries(grupos).map(([materia, itens]) => `
    <div class="materia">
      <h3>${escaparHtmlSeguro(materia)} (${itens.length})</h3>
      ${itens.map(criarQuestaoRelatorio).join('')}
    </div>
  `).join('')
}

function agruparQuestoesRelatorio(questoes) {
  return questoes.reduce((grupos, q) => {
    const materia = q.materias?.nome || 'Sem matéria'
    if (!grupos[materia]) grupos[materia] = []
    grupos[materia].push(q)
    return grupos
  }, {})
}

function criarQuestaoRelatorio(q) {
  const tipo = normalizarTipoArquivamento(q)
  const data = q.criado_em ? formatarDataHoraArquivamento(q.criado_em) : '-'

  return `
    <article class="questao">
      <div class="questao-topo">
        <span class="tag">${escaparHtmlSeguro(tipo)}</span>
        <span>${escaparHtmlSeguro(data)}</span>
      </div>
      <p class="texto">${escaparHtmlSeguro(q.enunciado || 'Sem enunciado')}</p>
      <div class="alternativas">${criarAlternativasRelatorio(q)}</div>
      <div class="campos">
        ${criarCampoRelatorio('Resposta marcada', q.alternativa_marcada)}
        ${criarCampoRelatorio('Resposta correta', q.alternativa_correta)}
        ${criarCampoRelatorio(tipo === 'Chutada' ? 'Motivo do chute' : 'Motivo do erro', q.motivo_erro)}
        ${criarCampoRelatorio('Nível de confiança', q.nivel_confianca)}
        ${criarCampoRelatorio('Comentário / observação', q.comentario)}
        ${criarCampoRelatorio('Pegadinhas da questão', q.pegadinha_banca)}
        ${criarCampoRelatorio('Conceito ou regra', q.conceito_chave)}
        ${criarCampoRelatorio('Como reconhecer', q.como_reconhecer)}
        ${criarCampoRelatorio('Ação corretiva', q.acao_corretiva)}
      </div>
    </article>
  `
}

function criarAlternativasRelatorio(q) {
  const alternativas = normalizarAlternativasRelatorio(q.alternativas)
  if (Object.keys(alternativas).length === 0) {
    return '<p class="vazio">Alternativas não registradas.</p>'
  }

  return Object.entries(alternativas).map(([letra, texto]) => {
    const classes = ['alternativa']
    if (letra === q.alternativa_correta) classes.push('alternativa-correta')
    if (letra === q.alternativa_marcada && letra !== q.alternativa_correta) classes.push('alternativa-marcada')

    return `
      <div class="${classes.join(' ')}">
        <strong>${escaparHtmlSeguro(letra)})</strong> ${escaparHtmlSeguro(texto)}
      </div>
    `
  }).join('')
}

function normalizarAlternativasRelatorio(alternativas) {
  if (!alternativas) return {}
  if (typeof alternativas === 'object' && !Array.isArray(alternativas)) return alternativas

  if (Array.isArray(alternativas)) {
    return alternativas.reduce((acc, texto, indice) => {
      acc[String.fromCharCode(65 + indice)] = texto
      return acc
    }, {})
  }

  if (typeof alternativas === 'string') {
    try {
      const parseado = JSON.parse(alternativas)
      return normalizarAlternativasRelatorio(parseado)
    } catch {
      return {}
    }
  }

  return {}
}

function criarCampoRelatorio(rotulo, valor) {
  return `
    <div class="campo">
      <strong>${escaparHtmlSeguro(rotulo)}</strong>
      <span>${valor ? escaparHtmlSeguro(valor) : '<span class="vazio">Não informado</span>'}</span>
    </div>
  `
}

function criarSimuladosRelatorio(simulados) {
  if (!simulados || simulados.length === 0) {
    return '<p class="vazio">Nenhum simulado registrado neste ciclo.</p>'
  }

  const linhas = simulados.map(s => `
    <tr>
      <td>${formatarDataBRArquivamento(s.data)}</td>
      <td>${escaparHtmlSeguro(s.nome || '-')}</td>
      <td>${escaparHtmlSeguro(s.banca || '-')}</td>
      <td>${Number(s.total_questoes) || 0}</td>
      <td>${Number(s.certas) || 0}</td>
      <td>${Number(s.erradas) || 0}</td>
      <td>${s.nota_percentual === null || s.nota_percentual === undefined ? '-' : `${Number(s.nota_percentual).toFixed(1)}%`}</td>
      <td>${escaparHtmlSeguro(s.comentario || '-')}</td>
    </tr>
  `).join('')

  return `
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Nome</th>
          <th>Banca</th>
          <th>Total</th>
          <th>Certas</th>
          <th>Erradas</th>
          <th>Nota</th>
          <th>Comentário</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  `
}

function formatarDataBRArquivamento(dataStr) {
  if (!dataStr) return '-'
  const [ano, mes, dia] = dataStr.substring(0, 10).split('-')
  if (!ano || !mes || !dia) return dataStr
  return `${dia}/${mes}/${ano}`
}

function formatarDataHoraArquivamento(valor) {
  if (!valor) return '-'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return valor
  return data.toLocaleString('pt-BR')
}

async function buscarTotaisMensaisArquivados(userId, mesesComDetalhes = new Set()) {
  const { data, error } = await db
    .from('estatisticas_mensais')
    .select('periodo_mes, periodo_inicio, total_questoes, total_acertos, total_erradas, total_chutadas, desempenho_por_materia')
    .eq('user_id', userId)

  if (error) return criarTotaisMensaisArquivadosVazios()
  return somarTotaisMensaisArquivadosDashboard(data || [], mesesComDetalhes)
}

function normalizarMesDashboard(valor) {
  const mes = String(valor || '').substring(0, 7)
  return /^\d{4}-\d{2}$/.test(mes) ? mes : null
}

function criarMesesComDetalhesDashboard(...listas) {
  const meses = new Set()

  listas.forEach(lista => {
    ;(lista || []).forEach(item => {
      const mes = normalizarMesDashboard(item?.criado_em)
      if (mes) meses.add(mes)
    })
  })

  return meses
}

function estatisticaMensalDashboardTemDetalhes(registro, mesesComDetalhes) {
  const mes = normalizarMesDashboard(registro?.periodo_mes || registro?.periodo_inicio)
  return Boolean(mes && mesesComDetalhes?.has(mes))
}

function somarTotaisMensaisArquivadosDashboard(registros, mesesComDetalhes = new Set()) {
  const totais = criarTotaisMensaisArquivadosVazios()

  ;(registros || []).forEach(registro => {
    if (estatisticaMensalDashboardTemDetalhes(registro, mesesComDetalhes)) return

    totais.totalQuestoes += Number(registro.total_questoes) || 0
    totais.totalAcertos += Number(registro.total_acertos) || 0
    totais.totalErradas += Number(registro.total_erradas) || 0
    totais.totalChutadas += Number(registro.total_chutadas) || 0

    ;(registro.desempenho_por_materia || []).forEach(m => {
      const nome = m.materia || 'Sem matéria'
      const chave = m.materia_id || `nome:${nome}`

      if (!totais.porMateria[chave]) {
        totais.porMateria[chave] = {
          materia_id: m.materia_id || null,
          materia: nome,
          acertos: 0,
          erradas: 0,
          chutadas: 0
        }
      }

      totais.porMateria[chave].acertos += Number(m.acertos) || 0
      totais.porMateria[chave].erradas += Number(m.erradas) || 0
      totais.porMateria[chave].chutadas += Number(m.chutadas) || 0
    })
  })

  totais.listaPorMateria = Object.values(totais.porMateria)
  return totais
}

function criarTotaisMensaisArquivadosVazios() {
  return {
    totalQuestoes: 0,
    totalAcertos: 0,
    totalErradas: 0,
    totalChutadas: 0,
    porMateria: {},
    listaPorMateria: []
  }
}

function obterTotaisArquivadosDaMateria(totaisArquivados, materia) {
  return totaisArquivados.porMateria[materia.id] ||
    totaisArquivados.porMateria[`nome:${materia.nome}`] ||
    { acertos: 0, erradas: 0, chutadas: 0 }
}

// ─── CARDS ───────────────────────────────────────────────

// ─── RELATÓRIO DE ERROS RECORRENTES ────────────────────────

async function carregarRelatorioErrosRecorrentes(userId) {
  const container = document.getElementById('dashboard-relatorio-erros')
  if (!container) return

  const { data, error } = await db
    .from('questoes')
    .select('id, materia_id, edital_topico_id, enunciado, tipo_questao, status_revisao, motivo_erro, nivel_confianca, comentario, pegadinha_banca, conceito_chave, como_reconhecer, acao_corretiva, criado_em, materias(nome), edital_topicos(titulo)')
    .eq('user_id', userId)
    .order('criado_em', { ascending: false })
    .limit(500)

  if (error) {
    throw criarErroConsultaDashboard('Não foi possível analisar seus erros recorrentes.', error)
  }

  const relatorio = montarRelatorioErrosRecorrentes(data || [])
  container.innerHTML = criarPainelRelatorioErrosRecorrentes(relatorio)

  // Remove listeners antigos antes de adicionar novos
  container.querySelectorAll('[data-dashboard-atalho]').forEach(btn => {
    const novoBtn = btn.cloneNode(true)
    btn.parentNode.replaceChild(novoBtn, btn)
  })

  container.querySelectorAll('[data-dashboard-atalho]').forEach(btn => {
    btn.addEventListener('click', () => {
      const secao = btn.dataset.dashboardAtalho
      if (typeof navegarPara === 'function') navegarPara(secao)
    })
  })
}

function montarRelatorioErrosRecorrentes(questoes) {
  const lista = questoes || []
  const pendentes = lista.filter(q => q.status_revisao !== 'recuperada')
  const base = pendentes.length > 0 ? pendentes : lista
  const porMotivo = contarOcorrenciasRelatorioErros(base.map(q => q.motivo_erro || 'Sem motivo preenchido'))
  const porMateria = contarOcorrenciasRelatorioErros(base.map(q => q.materias?.nome || 'Sem matéria'))
  const porConfianca = contarOcorrenciasRelatorioErros(base.map(q => q.nivel_confianca || 'Sem confiança preenchida'))
  const porPegadinha = contarOcorrenciasRelatorioErros(base.flatMap(q => classificarPegadinhasRelatorioErros(q.pegadinha_banca)))
  const padroes = contarPadroesMateriaMotivo(base)
  const chutadas = base.filter(q => normalizarTipoArquivamento(q) === 'Chutada').length
  const erradas = base.length - chutadas
  const qualidadesDiagnostico = base.map(q => avaliarQualidadeDiagnosticoQuestao(q))
  const semDiagnostico = qualidadesDiagnostico.filter(q => q.status === 'incompleto').length
  const diagnosticoFraco = qualidadesDiagnostico.filter(q => q.status === 'fraco').length
  const diagnosticoForte = qualidadesDiagnostico.filter(q => q.status === 'completo').length
  const semAssunto = base.filter(q => !q.edital_topico_id).length
  const recuperadas = lista.length - pendentes.length
  const acoes = montarAcoesRelatorioErros({ base, porMotivo, porMateria, porConfianca, porPegadinha, padroes, chutadas, erradas, semDiagnostico, diagnosticoFraco, semAssunto })

  return {
    total: base.length,
    totalDetalhadas: lista.length,
    pendentes: pendentes.length,
    recuperadas,
    erradas,
    chutadas,
    semDiagnostico,
    diagnosticoFraco,
    diagnosticoForte,
    semAssunto,
    porMotivo,
    porMateria,
    porConfianca,
    porPegadinha,
    padroes,
    acoes
  }
}

function classificarPegadinhasRelatorioErros(texto) {
  const valor = String(texto || '').toLowerCase()
  if (!valor.trim()) return ['Sem pegadinha preenchida']

  const categorias = []
  if (/(sempre|nunca|somente|apenas|todos|nenhum|obrigatoriamente|exclusivamente)/i.test(valor)) categorias.push('Palavra absoluta ou restritiva')
  if (/(troca|confus|conceito|compet[eê]ncia|parecido|diferen[cç]a)/i.test(valor)) categorias.push('Troca de conceitos parecidos')
  if (/(invers[aã]o|inverte|contr[aá]rio|exceto|incorreta|n[aã]o se aplica)/i.test(valor)) categorias.push('Inversão lógica')
  if (/(exce[cç][aã]o|ressalva|salvo|exceto|desde que)/i.test(valor)) categorias.push('Exceção escondida')
  if (/(amb[ií]gu|duplo sentido|termo aberto|subjetivo)/i.test(valor)) categorias.push('Termo ambíguo')
  if (/(sutil|red[aç][aã]o|palavra|mudan[cç]a|detalhe)/i.test(valor)) categorias.push('Mudança sutil na redação')
  if (/(parcialmente|incompleta|quase correta|meia verdade)/i.test(valor)) categorias.push('Alternativa parcialmente correta')
  if (/(induz|interpreta[cç][aã]o|parece|armadilha)/i.test(valor)) categorias.push('Interpretação induzida ao erro')
  if (/(lei seca|literal|doutrin|jurisprud|artigo)/i.test(valor)) categorias.push('Lei seca versus interpretação')

  return categorias.length > 0 ? categorias : ['Outras pegadinhas registradas']
}

function contarOcorrenciasRelatorioErros(valores) {
  return contarOcorrenciasValores(valores, { fallback: 'Não informado' })
}

function contarPadroesMateriaMotivo(questoes) {
  const mapa = {}

  questoes.forEach(q => {
    const materia = q.materias?.nome || 'Sem matéria'
    const motivo = q.motivo_erro || 'Sem motivo preenchido'
    const chave = `${materia}||${motivo}`

    if (!mapa[chave]) {
      mapa[chave] = { materia, motivo, total: 0, chutadas: 0, erradas: 0 }
    }

    mapa[chave].total += 1
    if (normalizarTipoArquivamento(q) === 'Chutada') mapa[chave].chutadas += 1
    else mapa[chave].erradas += 1
  })

  return Object.values(mapa)
    .filter(item => item.total > 1)
    .sort((a, b) => b.total - a.total || a.materia.localeCompare(b.materia))
    .slice(0, 5)
}

function montarAcoesRelatorioErros(relatorio) {
  const acoes = []
  const principal = relatorio.padroes[0]
  const motivo = relatorio.porMotivo[0]
  const materia = relatorio.porMateria[0]
  const confianca = relatorio.porConfianca[0]
  const pegadinha = relatorio.porPegadinha?.find(item => item.nome !== 'Sem pegadinha preenchida')

  if (principal) {
    acoes.push(`Priorize ${principal.materia}: o padrão "${principal.motivo}" apareceu ${principal.total} vezes.`)
  } else if (materia && motivo && relatorio.base.length > 0) {
    acoes.push(`Faça uma rodada curta focada em ${materia.nome} e observe se o motivo "${motivo.nome}" se repete.`)
  }

  if (relatorio.semDiagnostico > 0) {
    acoes.push(`Complete o diagnóstico essencial em ${formatarQuantidadeQuestoes(relatorio.semDiagnostico)}.`)
  }

  if (relatorio.diagnosticoFraco > 0) {
    acoes.push(`Reforce ${formatarQuantidadeQuestoes(relatorio.diagnosticoFraco)} com diagnóstico fraco para o sistema detectar padrões melhores.`)
  }

  if (relatorio.semAssunto > 0) {
    acoes.push(`Vincule ${formatarQuantidadeQuestoes(relatorio.semAssunto)} ao assunto do edital para melhorar a prioridade da revisão.`)
  }

  if (relatorio.chutadas > relatorio.erradas && relatorio.chutadas > 0) {
    acoes.push('Separe os chutes das erradas reais: o problema dominante parece ser segurança na resposta.')
  }

  const motivoNome = String(motivo?.nome || '').toLowerCase()
  if (/falta de conte[uú]do|dom[ií]nio/.test(motivoNome)) {
    acoes.push('Antes dos flashcards, volte à teoria do assunto crítico e registre uma regra curta no diagnóstico.')
  }
  if (/desaten|aten[cç][aã]o/.test(motivoNome)) {
    acoes.push('Faça uma rodada curta lendo só comandos e palavras restritivas antes de responder novas questões.')
  }
  if (/interpreta/.test(motivoNome)) {
    acoes.push('Treine reescrever o comando da questão com suas palavras antes de olhar as alternativas.')
  }

  if (confianca && confianca.nome !== 'Sem confiança preenchida' && confianca.total >= 2) {
    acoes.push(`Antes dos flashcards, anote uma regra de decisão para reduzir respostas em "${confianca.nome}".`)
  }

  if (pegadinha && pegadinha.nome !== 'Sem pegadinha preenchida' && pegadinha.total >= 2) {
    acoes.push(`Treine identificação de "${pegadinha.nome}" antes de responder questões da matéria crítica.`)
  }

  if (acoes.length === 0) {
    acoes.push('Registre mais questões e preencha os diagnósticos para o sistema identificar padrões confiáveis.')
  }

  return acoes.slice(0, 4)
}

function criarPainelRelatorioErrosRecorrentes(relatorio) {
  if (relatorio.total === 0) {
    return `
      <div class="relatorio-erros-card">
        <div class="relatorio-erros-topo">
          <div>
            <h3>Treinador de padrões de erro</h3>
            <p>Quando você registrar questões erradas ou chutadas, o sistema vai apontar os padrões que mais se repetem.</p>
          </div>
          <span class="tag-estudo">Sem dados ainda</span>
        </div>
        <div class="relatorio-erros-acoes">
          <button class="btn-secundario" data-dashboard-atalho="questoes" type="button">Registrar questão</button>
        </div>
      </div>
    `
  }

  const motivoPrincipal = relatorio.porMotivo[0]
  const materiaPrincipal = relatorio.porMateria[0]
  const pegadinhaPrincipal = relatorio.porPegadinha?.find(item => item.nome !== 'Sem pegadinha preenchida')
  const foco = relatorio.padroes[0]
    ? `${relatorio.padroes[0].materia} · ${relatorio.padroes[0].motivo}`
    : pegadinhaPrincipal?.nome || motivoPrincipal?.nome || 'Padrão em formação'

  return `
    <div class="relatorio-erros-card">
      <div class="relatorio-erros-topo">
        <div>
          <h3>Treinador de padrões de erro</h3>
          <p>Analisa seus erros para mostrar não só a matéria fraca, mas o comportamento que está se repetindo.</p>
        </div>
        <span class="tag-estudo">${formatarQuantidadeQuestoes(relatorio.total)} analisadas</span>
      </div>

      <div class="relatorio-erros-grid">
        <div><strong>${escaparHtmlSeguro(foco)}</strong><span>padrão principal</span></div>
        <div><strong>${escaparHtmlSeguro(materiaPrincipal?.nome || '-')}</strong><span>matéria mais recorrente</span></div>
        <div><strong>${relatorio.chutadas}</strong><span>chutes/baixa confiança</span></div>
        <div><strong>${relatorio.semDiagnostico + relatorio.diagnosticoFraco}</strong><span>diagnóstico a reforçar</span></div>
        <div><strong>${relatorio.semAssunto}</strong><span>sem assunto do edital</span></div>
        <div><strong>${relatorio.diagnosticoForte}</strong><span>diagnósticos fortes</span></div>
      </div>

      <div class="relatorio-erros-corpo">
        <section class="relatorio-erros-painel">
          <h4>Padrões mais repetidos</h4>
          ${criarListaPadroesErros(relatorio.padroes)}
        </section>
        <section class="relatorio-erros-painel">
          <h4>Motivos frequentes</h4>
          ${criarChipsRelatorioErros(relatorio.porMotivo.slice(0, 6))}
          <h4 class="relatorio-erros-subtitulo">Pegadinhas recorrentes</h4>
          ${criarChipsRelatorioErros((relatorio.porPegadinha || []).filter(item => item.nome !== 'Sem pegadinha preenchida').slice(0, 6))}
          <h4 class="relatorio-erros-subtitulo">Confiança</h4>
          ${criarChipsRelatorioErros(relatorio.porConfianca.slice(0, 4))}
        </section>
        <section class="relatorio-erros-painel">
          <h4>Ações sugeridas</h4>
          <ul class="relatorio-erros-acoes-lista">
            ${relatorio.acoes.map(acao => `<li>${escaparHtmlSeguro(acao)}</li>`).join('')}
          </ul>
        </section>
      </div>

      <div class="relatorio-erros-acoes">
        <button class="btn-secundario" data-dashboard-atalho="revisao" type="button">Abrir Revisão Inteligente</button>
        <button class="btn-secundario" data-dashboard-atalho="questoes" type="button">Completar diagnósticos</button>
      </div>
    </div>
  `
}

function criarListaPadroesErros(padroes) {
  if (!padroes || padroes.length === 0) {
    return '<p class="relatorio-erros-vazio">Ainda não há repetição forte entre matéria e motivo.</p>'
  }

  return `
    <div class="relatorio-erros-padroes">
      ${padroes.map(item => `
        <div class="relatorio-erros-padrao">
          <strong>${escaparHtmlSeguro(item.materia)}</strong>
          <span>${escaparHtmlSeguro(item.motivo)} · ${item.total}x</span>
        </div>
      `).join('')}
    </div>
  `
}

function criarChipsRelatorioErros(itens) {
  if (!itens || itens.length === 0) {
    return '<p class="relatorio-erros-vazio">Sem dados preenchidos.</p>'
  }

  return `
    <div class="relatorio-erros-chips">
      ${itens.map(item => `<span>${escaparHtmlSeguro(item.nome)} · ${item.total}</span>`).join('')}
    </div>
  `
}

async function carregarCardsDashboard(userId) {
  const [totalErradasResp, certasResp, totalMateriasResp, questoesComMateriaResp, pendentesResp, revisoesFeitasResp] = await Promise.all([
    db
      .from('questoes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    db
      .from('questoes_certas')
      .select('quantidade, criado_em')
      .eq('user_id', userId),
    db
      .from('materias')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    db
      .from('questoes')
      .select('materia_id, criado_em, materias(nome)')
      .eq('user_id', userId),
    db
      .from('questoes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status_revisao', 'pendente'),
    db
      .from('questoes_revisoes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
  ])

  if (totalErradasResp.error) {
    throw criarErroConsultaDashboard('Não foi possível contar suas questões para revisão.', totalErradasResp.error)
  }

  if (certasResp.error) {
    throw criarErroConsultaDashboard('Não foi possível somar suas questões certas.', certasResp.error)
  }

  if (totalMateriasResp.error) {
    throw criarErroConsultaDashboard('Não foi possível contar suas matérias.', totalMateriasResp.error)
  }

  if (questoesComMateriaResp.error) {
    throw criarErroConsultaDashboard('Não foi possível identificar a matéria com mais erros.', questoesComMateriaResp.error)
  }

  if (pendentesResp.error) {
    throw criarErroConsultaDashboard('Não foi possível contar suas revisões pendentes.', pendentesResp.error)
  }

  if (revisoesFeitasResp.error) {
    throw criarErroConsultaDashboard('Não foi possível contar suas revisões feitas.', revisoesFeitasResp.error)
  }

  const mesesComDetalhes = criarMesesComDetalhesDashboard(questoesComMateriaResp.data || [], certasResp.data || [])
  const totaisArquivados = await buscarTotaisMensaisArquivados(userId, mesesComDetalhes)
  const totalErradasAtivas = totalErradasResp.count || 0
  const totalCertasAtivas = (certasResp.data || []).reduce((acc, r) => acc + (Number(r.quantidade) || 0), 0)
  const totalErradasArquivadas = totaisArquivados.totalErradas + totaisArquivados.totalChutadas
  const totalErradas = totalErradasAtivas + totalErradasArquivadas
  const totalCertas = totalCertasAtivas + totaisArquivados.totalAcertos
  const totalGeral = totalErradasAtivas + totalCertasAtivas + totaisArquivados.totalQuestoes
  const aproveitamento = totalGeral > 0 ? Math.round((totalCertas / totalGeral) * 100) : 0
  const totalMaterias = totalMateriasResp.count || 0
  const totalRevisoesPendentes = pendentesResp.count || 0
  const totalRevisoesFeitas = revisoesFeitasResp.count || 0

  let materiaCampea = '—'
  const contagem = {}
  for (const q of questoesComMateriaResp.data || []) {
    const nome = q.materias?.nome || 'Sem matéria'
    contagem[nome] = (contagem[nome] || 0) + 1
  }

  totaisArquivados.listaPorMateria.forEach(m => {
    const totalDetalhado = (Number(m.erradas) || 0) + (Number(m.chutadas) || 0)
    if (totalDetalhado > 0) contagem[m.materia] = (contagem[m.materia] || 0) + totalDetalhado
  })

  if (Object.keys(contagem).length > 0) {
    materiaCampea = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])[0][0]
  }

  const streakResumo = await obterResumoStreakGamificacao(userId)
  const container = document.getElementById('dashboard-cards')
  if (!container) return

  container.innerHTML = `
    ${criarOnboardingDashboard(totalMaterias, totalGeral, totalRevisoesFeitas)}
    <div class="dash-resumo-principal">
      <article class="dash-card dash-card--principal">
        <div class="dash-card-topo">
          <span class="dash-card-icone">&#128202;</span>
          <span class="dash-card-tag">Caderno</span>
        </div>
        <div class="dash-card-valor dash-card-valor--grande">${totalGeral}</div>
        <div class="dash-card-label">questões no caderno</div>
        <p class="dash-card-subtexto">${totalGeral > 0 ? 'Base para diagnosticar padrões e revisar melhor.' : 'Registre o primeiro erro para começar o histórico.'}</p>
      </article>

      <article class="dash-card dash-card--principal dash-card--aproveitamento dash-card--aproveitamento-${obterClasseAproveitamentoDashboard(aproveitamento)}">
        <div class="dash-card-topo">
          <span class="dash-card-icone">&#127919;</span>
          <span class="dash-card-tag">Aproveitamento</span>
        </div>
        ${criarDonutAproveitamentoDashboard(aproveitamento)}
        <div class="dash-card-label">aproveitamento geral</div>
      </article>

      <article class="dash-card dash-card--principal">
        <div class="dash-card-topo">
          <span class="dash-card-icone">&#128293;</span>
          <span class="dash-card-tag">Sequência</span>
        </div>
        <div class="dash-card-valor dash-card-valor--grande">${streakResumo.streak}</div>
        <div class="dash-card-label">dias seguidos</div>
        <p class="dash-card-subtexto">Recorde: ${streakResumo.recorde} dia${streakResumo.recorde !== 1 ? 's' : ''}</p>
        ${streakResumo.sequenciaEmRisco ? '<span class="dash-card-alerta">Sua sequência está em risco!</span>' : ''}
      </article>

      <button class="dash-card dash-card--principal dash-card--clicavel ${totalRevisoesPendentes === 0 ? 'dash-card--revisao-ok' : totalRevisoesPendentes <= 5 ? 'dash-card--revisao-alerta' : 'dash-card--revisao-critica'}" data-dashboard-atalho="revisao" type="button">
        <div class="dash-card-topo">
          <span class="dash-card-icone">${totalRevisoesPendentes === 0 ? '&#9989;' : '&#9888;&#65039;'}</span>
          <span class="dash-card-tag">Revisão</span>
        </div>
        <div class="dash-card-valor dash-card-valor--grande">${totalRevisoesPendentes === 0 ? '✓' : totalRevisoesPendentes}</div>
        <div class="dash-card-label">${totalRevisoesPendentes === 0 ? 'Em dia' : 'revisões pendentes'}</div>
        <p class="dash-card-subtexto">${totalRevisoesPendentes === 0 ? 'Nenhuma pendência agora.' : 'Clique para abrir a Revisão Inteligente.'}</p>
      </button>
    </div>

    <div class="dash-metricas-secundarias">
      <div class="dash-mini-card dash-mini-card--certa">
        <span>&#9989;</span>
        <strong>${totalCertas}</strong>
        <small>questões certas</small>
      </div>
      <div class="dash-mini-card dash-mini-card--errada">
        <span>&#10060;</span>
        <strong>${totalErradas}</strong>
        <small>erros e chutes</small>
      </div>
      <div class="dash-mini-card">
        <span>&#128218;</span>
        <strong>${totalMaterias}</strong>
        <small>matérias estudadas</small>
      </div>
      <div class="dash-mini-card">
        <span>&#9888;&#65039;</span>
        <strong>${escaparHtmlSeguro(materiaCampea)}</strong>
        <small>matéria com mais revisão</small>
      </div>
    </div>
  `

  container.querySelectorAll('[data-dashboard-atalho]').forEach(btn => {
    const novoBtn = btn.cloneNode(true)
    btn.parentNode.replaceChild(novoBtn, btn)
  })

  container.querySelectorAll('[data-dashboard-atalho]').forEach(btn => {
    btn.addEventListener('click', () => {
      const secao = btn.dataset.dashboardAtalho
      if (typeof navegarPara === 'function') navegarPara(secao)
    })
  })

  const btnOcultar = container.querySelector('[data-dashboard-ocultar-checklist]')
  if (btnOcultar) {
    const novoBtn = btnOcultar.cloneNode(true)
    btnOcultar.parentNode.replaceChild(novoBtn, btnOcultar)
    novoBtn.addEventListener('click', () => {
      localStorage.setItem(CHAVE_CHECKLIST_INICIAL_OCULTO, '1')
      inicializarDashboard()
    })
  }
}

function obterClasseAproveitamentoDashboard(aproveitamento) {
  if (aproveitamento >= 70) return 'alto'
  if (aproveitamento >= 50) return 'medio'
  return 'baixo'
}

function criarDonutAproveitamentoDashboard(aproveitamento) {
  const pct = Math.max(0, Math.min(100, Number(aproveitamento) || 0))
  return `
    <div class="dash-donut" aria-label="Aproveitamento geral de ${pct}%">
      <svg viewBox="0 0 42 42" role="img" aria-hidden="true">
        <circle class="dash-donut-fundo" cx="21" cy="21" r="15.9155"></circle>
        <circle class="dash-donut-progresso" cx="21" cy="21" r="15.9155" stroke-dasharray="${pct} ${100 - pct}"></circle>
      </svg>
      <span>${pct}%</span>
    </div>
  `
}

function criarOnboardingDashboard(totalMaterias, totalGeral, totalRevisoesFeitas = 0) {
  const checklistOculto = localStorage.getItem(CHAVE_CHECKLIST_INICIAL_OCULTO) === '1'
  const temMateria = totalMaterias > 0
  const temQuestao = totalGeral > 0
  const temRevisao = totalRevisoesFeitas > 0
  const podeUsarFlashcards = temQuestao

  if (checklistOculto && temMateria && temQuestao && temRevisao) return ''

  const itens = [
    {
      feito: temMateria,
      titulo: '1. Criar matérias',
      texto: temMateria ? `${totalMaterias} matéria${totalMaterias !== 1 ? 's' : ''} cadastrada${totalMaterias !== 1 ? 's' : ''}.` : 'Cadastre pelo menos uma matéria para organizar seus erros.',
      acao: 'Criar matéria',
      secao: 'materias'
    },
    {
      feito: temQuestao,
      titulo: '2. Registrar erros',
      texto: temQuestao ? `${formatarQuantidadeQuestoes(totalGeral)} já registrada${totalGeral !== 1 ? 's' : ''}.` : 'Salve uma questão errada, chutada ou uma quantidade de acertos.',
      acao: 'Registrar questão',
      secao: 'questoes'
    },
    {
      feito: temRevisao,
      titulo: '3. Revisar com fila',
      texto: temRevisao
        ? `${formatarQuantidadeQuestoes(totalRevisoesFeitas)} já revisada${totalRevisoesFeitas !== 1 ? 's' : ''}.`
        : podeUsarFlashcards ? 'Abra Revisão Inteligente, filtre as pendentes e treine antes de revelar o gabarito.' : 'Os flashcards aparecem depois que você registra questões no Caderno de Erros.',
      acao: 'Abrir flashcards',
      secao: 'revisao'
    },
    {
      feito: false,
      titulo: '4. Planejar a semana',
      texto: 'Defina as matérias de cada dia para a Central de Hoje puxar automaticamente sua rotina.',
      acao: 'Planejar semana',
      secao: 'planejamento'
    }
  ]

  return `
    <div class="onboarding-dashboard onboarding-dashboard--checklist">
      <div class="onboarding-dashboard-texto">
        <h3>Fluxo principal do método</h3>
        <p>Comece simples: matéria, erro registrado, revisão inteligente e planejamento semanal. O restante entra como apoio.</p>
        <div class="onboarding-checklist">
          ${itens.map(item => `
            <div class="onboarding-checklist-item ${item.feito ? 'onboarding-checklist-item--feito' : ''}">
              <span class="onboarding-checklist-status">${item.feito ? '✓' : '•'}</span>
              <div>
                <strong>${escaparHtmlSeguro(item.titulo)}</strong>
                <p>${escaparHtmlSeguro(item.texto)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="onboarding-dashboard-acoes">
        ${itens.map(item => `
          <button class="btn-secundario" data-dashboard-atalho="${escaparHtmlSeguro(item.secao)}" type="button">${escaparHtmlSeguro(item.acao)}</button>
        `).join('')}
        ${temMateria && temQuestao ? '<button class="btn-secundario" data-dashboard-ocultar-checklist type="button">Ocultar checklist</button>' : ''}
      </div>
    </div>
  `
}

async function carregarGrafico(userId) {
  const dias = []
  const labels = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    dias.push(iso)
    labels.push(formatarDiaSemanaGrafico(iso))
  }

  const inicio = `${dias[0]}T00:00:00`
  const fim = `${dias[6]}T23:59:59`
  const [erradasResp, certasResp] = await Promise.all([
    db
      .from('questoes')
      .select('criado_em')
      .eq('user_id', userId)
      .gte('criado_em', inicio)
      .lte('criado_em', fim),
    db
      .from('questoes_certas')
      .select('criado_em, quantidade')
      .eq('user_id', userId)
      .gte('criado_em', inicio)
      .lte('criado_em', fim)
  ])

  if (erradasResp.error) {
    throw criarErroConsultaDashboard('Não foi possível carregar as questões para revisão do gráfico.', erradasResp.error)
  }

  if (certasResp.error) {
    throw criarErroConsultaDashboard('Não foi possível carregar as questões certas do gráfico.', certasResp.error)
  }

  const mapaValores = Object.fromEntries(dias.map(data => [data, 0]))
  ;(erradasResp.data || []).forEach(q => {
    const data = String(q.criado_em || '').substring(0, 10)
    if (Object.prototype.hasOwnProperty.call(mapaValores, data)) mapaValores[data] += 1
  })
  ;(certasResp.data || []).forEach(q => {
    const data = String(q.criado_em || '').substring(0, 10)
    if (Object.prototype.hasOwnProperty.call(mapaValores, data)) mapaValores[data] += Number(q.quantidade) || 0
  })

  const valores = dias.map(d => mapaValores[d] || 0)
  const container = document.getElementById('dashboard-grafico')
  if (!container) return

  const totalPeriodo = valores.reduce((acc, valor) => acc + valor, 0)
  container.innerHTML = `
    <div class="grafico-svg-cabecalho">
      <div>
        <h3 class="grafico-titulo">Atividade semanal</h3>
        <p>Questões registradas nos últimos 7 dias.</p>
      </div>
      <span>${totalPeriodo} ${totalPeriodo === 1 ? 'questão' : 'questões'}</span>
    </div>
    ${totalPeriodo > 0
      ? `<div class="grafico-svg-wrap">${criarSvgAtividadeSemanalDashboard(dias, labels, valores)}</div>`
      : '<div class="grafico-placeholder">Seu gráfico de atividade aparece após o primeiro registro. Comece pelo Caderno de Erros.</div>'}
  `
}

function criarSvgAtividadeSemanalDashboard(dias, labels, valores) {
  const largura = 720
  const altura = 240
  const margem = { topo: 24, direita: 18, baixo: 42, esquerda: 38 }
  const areaLargura = largura - margem.esquerda - margem.direita
  const areaAltura = altura - margem.topo - margem.baixo
  const baseY = margem.topo + areaAltura
  const gap = 18
  const barraLargura = Math.max(34, (areaLargura - (gap * 6)) / 7)
  const maximo = Math.max(...valores, 1)
  const hoje = dataHoje()

  const barras = dias.map((dia, i) => {
    const valor = valores[i]
    const alturaBarra = valor > 0 ? Math.max(8, Math.round((valor / maximo) * areaAltura)) : 5
    const x = margem.esquerda + i * (barraLargura + gap)
    const y = baseY - alturaBarra
    const classe = dia === hoje
      ? 'grafico-svg-barra grafico-svg-barra--hoje'
      : valor > 0
        ? 'grafico-svg-barra'
        : 'grafico-svg-barra grafico-svg-barra--vazia'

    return `
      <g>
        ${valor > 0 ? `<text class="grafico-svg-valor" x="${x + barraLargura / 2}" y="${Math.max(14, y - 7)}" text-anchor="middle">${valor}</text>` : ''}
        <rect class="${classe}" x="${x}" y="${y}" width="${barraLargura}" height="${alturaBarra}" rx="6"></rect>
        <text class="grafico-svg-label" x="${x + barraLargura / 2}" y="${baseY + 24}" text-anchor="middle">${escaparHtmlSeguro(labels[i])}</text>
      </g>
    `
  }).join('')

  const meio = Math.ceil(maximo / 2)
  const yMeio = baseY - Math.round((meio / maximo) * areaAltura)

  return `
    <svg class="grafico-svg" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de atividade semanal">
      <line class="grafico-svg-eixo" x1="${margem.esquerda}" y1="${baseY}" x2="${largura - margem.direita}" y2="${baseY}"></line>
      <line class="grafico-svg-grade" x1="${margem.esquerda}" y1="${yMeio}" x2="${largura - margem.direita}" y2="${yMeio}"></line>
      <text class="grafico-svg-y" x="8" y="${baseY + 4}">0</text>
      <text class="grafico-svg-y" x="8" y="${yMeio + 4}">${meio}</text>
      <text class="grafico-svg-y" x="8" y="${margem.topo + 4}">${maximo}</text>
      ${barras}
    </svg>
  `
}

function formatarDiaSemanaGrafico(dataStr) {
  const dia = new Date(`${dataStr}T12:00:00`).getDay()
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][dia]
}

// ─── RANKING DE MATÉRIAS ─────────────────────────────────

async function carregarRankingMaterias(userId) {
  const container = document.getElementById('dashboard-grafico')
  if (!container) return

  const materiasResp = await db
    .from('materias')
    .select('id, nome')
    .eq('user_id', userId)

  if (materiasResp.error) {
    throw criarErroConsultaDashboard('Não foi possível carregar o ranking de matérias.', materiasResp.error)
  }

  const materias = materiasResp.data || []
  const erradasResp = await db
    .from('questoes')
    .select('materia_id, criado_em')
    .eq('user_id', userId)

  if (erradasResp.error) {
    throw criarErroConsultaDashboard('Não foi possível carregar os erros do ranking.', erradasResp.error)
  }

  const mesesComDetalhes = criarMesesComDetalhesDashboard(erradasResp.data || [])
  const totaisArquivados = await buscarTotaisMensaisArquivados(userId, mesesComDetalhes)
  const erradasPorMateria = {}
  ;(erradasResp.data || []).forEach(q => {
    erradasPorMateria[q.materia_id] = (erradasPorMateria[q.materia_id] || 0) + 1
  })

  const dados = materias
    .map(m => {
      const arquivadas = obterTotaisArquivadosDaMateria(totaisArquivados, m)
      const e = (erradasPorMateria[m.id] || 0) + (Number(arquivadas.erradas) || 0) + (Number(arquivadas.chutadas) || 0)
      return { nome: m.nome, erros: e }
    })
    .filter(m => m.erros > 0)
    .sort((a, b) => b.erros - a.erros)
    .slice(0, 3)

  const maximo = Math.max(...dados.map(m => m.erros), 1)

  const itens = dados.map((m, i) => {
    const progresso = Math.max(8, Math.round((m.erros / maximo) * 100))

    return `
      <div class="ranking-item">
        <div class="ranking-topo">
          <span class="ranking-medalha">#${i + 1}</span>
          <span class="ranking-nome">${escaparHtmlSeguro(m.nome)}</span>
          <span class="ranking-pct">${m.erros} erro${m.erros !== 1 ? 's' : ''}</span>
        </div>
        <div class="estat-barra-fundo">
          <div class="estat-barra-progresso ranking-barra-erros" style="width: ${progresso}%;"></div>
        </div>
      </div>
    `
  }).join('')

  const secaoRanking = document.createElement('div')
  secaoRanking.className = 'ranking-container'
  secaoRanking.innerHTML = `
    <h3 class="grafico-titulo">Matérias que mais pedem atenção</h3>
    ${dados.length > 0
      ? `<div class="ranking-lista">${itens}</div>`
      : '<div class="grafico-placeholder">Registre questões para ver seus pontos de atenção aqui.</div>'}
  `

  container.appendChild(secaoRanking)
}

// Exportações apenas para testes (Vitest)
if (typeof globalThis !== 'undefined' && typeof globalThis.window === 'undefined') {
  globalThis.criarEstadoVazioDashboard = criarEstadoVazioDashboard
  globalThis.criarCardsDashboardVazios = criarCardsDashboardVazios
  globalThis.criarPeriodoArquivamento = criarPeriodoArquivamento
  globalThis.criarValorMesPdfPadrao = criarValorMesPdfPadrao
  globalThis.criarPeriodoPdfMensalSelecionado = criarPeriodoPdfMensalSelecionado
  globalThis.criarPainelArquivamentoMensal = criarPainelArquivamentoMensal
  globalThis.montarResumoArquivamentoMensal = montarResumoArquivamentoMensal
  globalThis.criarResumoMateriaArquivamento = criarResumoMateriaArquivamento
  globalThis.normalizarTipoArquivamento = normalizarTipoArquivamento
  globalThis.formatarDataBRArquivamento = formatarDataBRArquivamento
  globalThis.obterClasseAproveitamentoDashboard = obterClasseAproveitamentoDashboard
  globalThis.criarDonutAproveitamentoDashboard = criarDonutAproveitamentoDashboard
  globalThis.criarMesesComDetalhesDashboard = criarMesesComDetalhesDashboard
  globalThis.somarTotaisMensaisArquivadosDashboard = somarTotaisMensaisArquivadosDashboard
}
