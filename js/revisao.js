// js/revisao.js

let revisaoInicializado = false
let treinoRevisaoQuestoes = []
let treinoRevisaoIndice = 0
let treinoRevisaoAcertos = 0
let treinoRevisaoErros = 0
let treinoRevisaoRespostaSelecionada = null
let treinoRevisaoPreResposta = ''
let treinoRevisaoChecklist = { comando: false, pegadinha: false, tipo: false }
let filaRevisaoInteligenteAtual = []
let filaRevisaoCompletaAtual = []
let treinoRevisaoConfianca = ''
let treinoRevisaoResultados = []
let modoFocoAtivo = false

function alternarModoFoco() {
  if (modoFocoAtivo) {
    desativarModoFoco()
  } else {
    ativarModoFoco()
  }
}

function ativarModoFoco() {
  modoFocoAtivo = true
  document.body.classList.add('modo-foco')
  const btnModoFoco = document.getElementById('btn-modo-foco-revisao')
  if (btnModoFoco) {
    btnModoFoco.textContent = 'Sair do modo foco'
  }
}

function desativarModoFoco() {
  modoFocoAtivo = false
  document.body.classList.remove('modo-foco')
  const btnModoFoco = document.getElementById('btn-modo-foco-revisao')
  if (btnModoFoco) {
    btnModoFoco.textContent = 'Entrar em modo foco'
  }
}

const NIVEIS_CONFIANCA_TREINO_REVISAO = ['Chutei', 'Dúvida', 'Confiante']
let treinoPegadinhasQuestoes = []
let treinoPegadinhasIndice = 0
let treinoPegadinhasRevelada = false
let revisaoConfiguracaoAtual = null

const DIAS_REVISAO_SEMANA = [
  { valor: 1, curto: 'Seg', nome: 'segunda' },
  { valor: 2, curto: 'Ter', nome: 'terca' },
  { valor: 3, curto: 'Qua', nome: 'quarta' },
  { valor: 4, curto: 'Qui', nome: 'quinta' },
  { valor: 5, curto: 'Sex', nome: 'sexta' },
  { valor: 6, curto: 'Sab', nome: 'sabado' },
  { valor: 7, curto: 'Dom', nome: 'domingo' }
]

// ============================================
// INICIALIZAR
// ============================================
async function inicializarRevisao() {
  await carregarMateriasNoFiltro()
  await carregarConfiguracaoRevisaoTela()

  if (!revisaoInicializado) {
    revisaoInicializado = true
    document.getElementById('btn-filtrar-revisao')
      .addEventListener('click', filtrarRevisao)
    document.getElementById('btn-iniciar-treino-revisao')
      .addEventListener('click', iniciarTreinoRevisao)
    document.getElementById('btn-modo-foco-revisao')
      ?.addEventListener('click', alternarModoFoco)
    document.getElementById('btn-salvar-config-revisao')
      ?.addEventListener('click', salvarConfiguracaoRevisaoTela)
    document.getElementById('btn-gerar-fila-revisao')
      ?.addEventListener('click', () => gerarFilaRevisaoInteligente({ manual: true }))
    document.getElementById('btn-treino-pegadinhas')
      ?.addEventListener('click', iniciarTreinoPegadinhas)
    document.getElementById('btn-finalizar-ciclo-revisao')
      ?.addEventListener('click', finalizarCicloRevisao)
  }
}

// ============================================
// CARREGAR MATÉRIAS NO FILTRO
// ============================================
async function carregarMateriasNoFiltro() {
  const select = document.getElementById('filtro-materia-revisao')
  select.innerHTML = '<option value="all">Todas as matérias</option>'

  const { data } = await db
    .from('materias')
    .select('id, nome')
    .eq('user_id', window.usuarioAtual.id)
    .order('nome', { ascending: true })

  if (data) {
    data.forEach(m => {
      const opt = document.createElement('option')
      opt.value = m.id
      opt.textContent = m.nome
      select.appendChild(opt)
    })
  }
}

// ============================================
// CONFIGURACAO DOS DIAS DE REVISAO
// ============================================
async function carregarConfiguracaoRevisaoTela() {
  if (!window.usuarioAtual?.id) return

  const config = await obterConfiguracaoRevisaoUsuario(window.usuarioAtual.id)
  revisaoConfiguracaoAtual = config
  aplicarConfiguracaoRevisaoTela(config)

  const container = document.getElementById('revisao-relatorio-inteligente')
  if (container) {
    if (ehDiaDeRevisaoHoje(config)) {
      await gerarFilaRevisaoInteligente({ automatico: true })
    } else {
      container.innerHTML = criarEstadoAguardandoRevisao(config)
      document.getElementById('btn-gerar-fila-fora-do-dia')
        ?.addEventListener('click', () => gerarFilaRevisaoInteligente({ manual: true }))
    }
  }
}

async function obterConfiguracaoRevisaoUsuario(userId = window.usuarioAtual?.id) {
  const padrao = criarConfiguracaoRevisaoPadrao(userId)
  if (!userId) return padrao

  try {
    const { data, error } = await db
      .from('configuracoes_revisao')
      .select('user_id, dias_revisao, tempo_revisao_minutos, ultima_revisao_geral, atualizado_em')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return normalizarConfiguracaoRevisao(data || carregarConfiguracaoRevisaoLocal(userId) || padrao, userId)
  } catch (erro) {
    console.warn('Configuracao de revisao usando armazenamento local.', erro)
    return normalizarConfiguracaoRevisao(carregarConfiguracaoRevisaoLocal(userId) || padrao, userId)
  }
}

async function salvarConfiguracaoRevisaoUsuario(config, userId = window.usuarioAtual?.id) {
  const normalizada = normalizarConfiguracaoRevisao(config, userId)
  salvarConfiguracaoRevisaoLocal(normalizada, userId)

  try {
    const { error } = await db
      .from('configuracoes_revisao')
      .upsert({
        user_id: userId,
        dias_revisao: normalizada.dias_revisao,
        tempo_revisao_minutos: normalizada.tempo_revisao_minutos,
        ultima_revisao_geral: normalizada.ultima_revisao_geral,
        atualizado_em: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (error) throw error
    return { salvoNoBanco: true, config: normalizada }
  } catch (erro) {
    console.warn('Nao foi possivel salvar configuracao de revisao no Supabase. Mantido localmente.', erro)
    return { salvoNoBanco: false, config: normalizada }
  }
}

function criarConfiguracaoRevisaoPadrao(userId) {
  return {
    user_id: userId || null,
    dias_revisao: [6],
    tempo_revisao_minutos: 60,
    ultima_revisao_geral: null
  }
}

function normalizarConfiguracaoRevisao(config, userId) {
  const padrao = criarConfiguracaoRevisaoPadrao(userId)
  const dias = Array.isArray(config?.dias_revisao)
    ? config.dias_revisao
    : String(config?.dias_revisao || '')
      .split(',')
      .map(valor => Number(valor.trim()))

  const diasValidos = [...new Set(dias
    .map(Number)
    .filter(valor => valor >= 1 && valor <= 7))]
    .sort((a, b) => a - b)

  return {
    user_id: userId || config?.user_id || padrao.user_id,
    dias_revisao: diasValidos.length > 0 ? diasValidos : padrao.dias_revisao,
    tempo_revisao_minutos: Math.min(240, Math.max(10, Number(config?.tempo_revisao_minutos || padrao.tempo_revisao_minutos))),
    ultima_revisao_geral: config?.ultima_revisao_geral || null,
    atualizado_em: config?.atualizado_em || null
  }
}

function chaveConfiguracaoRevisaoLocal(userId) {
  return `estudoConcursoConfigRevisao:${userId}`
}

function carregarConfiguracaoRevisaoLocal(userId) {
  try {
    const bruto = localStorage.getItem(chaveConfiguracaoRevisaoLocal(userId))
    return bruto ? JSON.parse(bruto) : null
  } catch {
    return null
  }
}

function salvarConfiguracaoRevisaoLocal(config, userId = window.usuarioAtual?.id) {
  if (!userId) return
  try {
    localStorage.setItem(chaveConfiguracaoRevisaoLocal(userId), JSON.stringify(config))
  } catch (erro) {
    console.warn('Nao foi possivel salvar configuracao local de revisao.', erro)
  }
}

function aplicarConfiguracaoRevisaoTela(config) {
  document.querySelectorAll('#revisao-dias-config input[type="checkbox"]').forEach(input => {
    input.checked = config.dias_revisao.includes(Number(input.value))
  })

  const inputTempo = document.getElementById('revisao-tempo-minutos')
  if (inputTempo) inputTempo.value = config.tempo_revisao_minutos

  const status = document.getElementById('revisao-config-status')
  if (status) {
    const proxima = calcularProximaDataRevisao(config.dias_revisao)
    status.textContent = ehDiaDeRevisaoHoje(config)
      ? 'Hoje e dia de revisao'
      : `Proxima: ${formatarDataCurtaRevisao(proxima)}`
  }
}

async function salvarConfiguracaoRevisaoTela() {
  const msg = document.getElementById('msg-config-revisao')
  const btn = document.getElementById('btn-salvar-config-revisao')
  const dias = Array.from(document.querySelectorAll('#revisao-dias-config input[type="checkbox"]:checked'))
    .map(input => Number(input.value))
  const tempo = Number(document.getElementById('revisao-tempo-minutos')?.value || 60)

  if (dias.length === 0) {
    if (msg) {
      msg.textContent = 'Escolha pelo menos um dia de revisao.'
      msg.className = 'msg-materia erro'
    }
    return
  }

  if (btn) {
    btn.disabled = true
    btn.textContent = 'Salvando...'
  }

  const resultado = await salvarConfiguracaoRevisaoUsuario({
    ...(revisaoConfiguracaoAtual || {}),
    dias_revisao: dias,
    tempo_revisao_minutos: tempo
  })

  revisaoConfiguracaoAtual = resultado.config
  aplicarConfiguracaoRevisaoTela(resultado.config)

  if (btn) {
    btn.disabled = false
    btn.textContent = 'Salvar dias'
  }

  if (msg) {
    msg.textContent = resultado.salvoNoBanco
      ? 'Dias de revisao salvos.'
      : 'Dias salvos neste navegador. Execute o SQL da configuracao para sincronizar no Supabase.'
    msg.className = resultado.salvoNoBanco ? 'msg-materia sucesso' : 'msg-materia'
  }

  const container = document.getElementById('revisao-relatorio-inteligente')
  if (container) {
    container.innerHTML = ehDiaDeRevisaoHoje(resultado.config)
      ? '<p class="texto-placeholder">Hoje e dia de revisao. Clique em Gerar fila inteligente.</p>'
      : criarEstadoAguardandoRevisao(resultado.config)
    document.getElementById('btn-gerar-fila-fora-do-dia')
      ?.addEventListener('click', () => gerarFilaRevisaoInteligente({ manual: true }))
  }
}

async function finalizarCicloRevisao() {
  const msg = document.getElementById('msg-config-revisao')
  const confirmar = confirm('Marcar a revisao de hoje como concluida? Isso inicia um novo ciclo para os proximos erros acumulados.')
  if (!confirmar) return

  const config = {
    ...(revisaoConfiguracaoAtual || await obterConfiguracaoRevisaoUsuario()),
    ultima_revisao_geral: dataRevisaoHoje()
  }
  const resultado = await salvarConfiguracaoRevisaoUsuario(config)
  revisaoConfiguracaoAtual = resultado.config
  aplicarConfiguracaoRevisaoTela(resultado.config)

  if (typeof registrarRevisaoConcluidaGamificacao === 'function') {
    registrarRevisaoConcluidaGamificacao(window.usuarioAtual?.id)
  }

  if (msg) {
    msg.textContent = resultado.salvoNoBanco
      ? 'Ciclo de revisao concluido. A proxima fila considera os erros novos a partir de hoje.'
      : 'Ciclo marcado neste navegador. Execute o SQL da configuracao para sincronizar no Supabase.'
    msg.className = resultado.salvoNoBanco ? 'msg-materia sucesso' : 'msg-materia'
  }

  if (typeof avaliarConquistasUsuario === 'function') {
    await avaliarConquistasUsuario({ atualizarPerfil: true })
  }
  await gerarFilaRevisaoInteligente({ manual: true })
}

function ehDiaDeRevisaoHoje(config) {
  return normalizarConfiguracaoRevisao(config, window.usuarioAtual?.id).dias_revisao.includes(obterDiaSemanaRevisao())
}

function obterDiaSemanaRevisao(data = new Date()) {
  const dia = data.getDay()
  return dia === 0 ? 7 : dia
}

function calcularProximaDataRevisao(diasRevisao, referencia = new Date()) {
  const dias = normalizarConfiguracaoRevisao({ dias_revisao: diasRevisao }, window.usuarioAtual?.id).dias_revisao
  const base = new Date(referencia)
  base.setHours(12, 0, 0, 0)

  for (let i = 0; i <= 14; i += 1) {
    const data = new Date(base)
    data.setDate(base.getDate() + i)
    if (dias.includes(obterDiaSemanaRevisao(data))) return dataISORevisao(data)
  }

  return dataISORevisao(base)
}

function criarEstadoAguardandoRevisao(config) {
  const proxima = calcularProximaDataRevisao(config.dias_revisao)
  const diasTexto = textoDiasRevisao(config.dias_revisao)
  return `
    <div class="revisao-estado-dia">
      <div>
        <h3>Proxima revisao: ${escaparHtmlSeguro(formatarDataCurtaRevisao(proxima))}</h3>
        <p>Seus dias configurados sao ${escaparHtmlSeguro(diasTexto)}. A fila inteligente continua disponivel quando quiser revisar antes.</p>
      </div>
      <button class="btn-secundario" type="button" id="btn-gerar-fila-fora-do-dia">Gerar mesmo assim</button>
    </div>
  `
}

function textoDiasRevisao(dias) {
  const diasOrdenados = normalizarConfiguracaoRevisao({ dias_revisao: dias }, window.usuarioAtual?.id).dias_revisao
  if (diasOrdenados.length === 7) return 'todos os dias'
  return diasOrdenados
    .map(valor => DIAS_REVISAO_SEMANA.find(dia => dia.valor === valor)?.curto || valor)
    .join(', ')
}

function dataISORevisao(data) {
  return dataISO(data)
}

function formatarDataCurtaRevisao(dataISO) {
  return formatarDataCurta(dataISO)
}

// ============================================
// CALCULAR INTERVALO DA SEMANA
// ============================================
function calcularIntervaloSemana(semanaAtras) {
  // Pega segunda-feira da semana desejada
  const hoje = new Date()
  const diaSemana = hoje.getDay() // 0=dom, 1=seg...
  const diasAteLSegunda = diaSemana === 0 ? 6 : diaSemana - 1

  const segunda = new Date(hoje)
  segunda.setDate(hoje.getDate() - diasAteLSegunda - semanaAtras * 7)
  segunda.setHours(0, 0, 0, 0)

  const domingo = new Date(segunda)
  domingo.setDate(segunda.getDate() + 6)
  domingo.setHours(23, 59, 59, 999)

  return {
    inicio: segunda.toISOString().substring(0, 10),
    fim:    domingo.toISOString().substring(0, 10)
  }
}

// ============================================
// FILTRAR E RENDERIZAR
// ============================================
async function filtrarRevisao() {
  const lista      = document.getElementById('lista-revisao')
  const contador   = document.getElementById('revisao-contador')
  const btnModoFoco = document.getElementById('btn-modo-foco-revisao')
  
  // Desativar modo foco ao sair do treino
  if (modoFocoAtivo) desativarModoFoco()
  
  // Esconder botão de modo foco quando voltar para lista
  if (btnModoFoco) btnModoFoco.style.display = 'none'
  
  lista.innerHTML = '<p class="texto-placeholder">⏳ Buscando suas revisões pendentes...</p>'
  contador.style.display = 'none'

  const { data, error } = await buscarQuestoesRevisao()

  if (error) {
    lista.innerHTML = '<p class="texto-placeholder">❌ Erro ao buscar questões.</p>'
    return
  }

  if (!data || data.length === 0) {
    lista.innerHTML = '<p class="texto-placeholder">📭 Nenhuma questão encontrada com esses filtros.</p>'
    return
  }

  // Mostra contador
  const nomeSemana = document.getElementById('filtro-semana').selectedOptions[0].text
  const nomeMateria = document.getElementById('filtro-materia-revisao').selectedOptions[0].text
  contador.textContent = `${formatarQuantidadeQuestoes(data.length)} encontrada${data.length !== 1 ? 's' : ''} — ${nomeMateria} · ${nomeSemana}`
  contador.style.display = 'block'

  // Renderiza cards
  lista.innerHTML = ''
  lista.appendChild(criarResumoInteligenteRevisao(data))
  data.forEach((q, i) => lista.appendChild(criarCardRevisao(q, i + 1)))
}

async function buscarQuestoesRevisao() {
  const semanaVal  = document.getElementById('filtro-semana').value
  const materiaVal = document.getElementById('filtro-materia-revisao').value

  let query = db
    .from('questoes')
    .select('id, enunciado, alternativas, alternativa_marcada, alternativa_correta, tipo_questao, status_revisao, revisar_novamente_em, revisao_total_acertos, revisao_total_erros, revisao_etapa, motivo_erro, nivel_confianca, comentario, criado_em, materia_id, edital_topico_id, banca, pegadinha_banca, conceito_chave, como_reconhecer, acao_corretiva, materias(nome), edital_topicos(titulo, status)')
    .eq('user_id', window.usuarioAtual.id)
    .eq('status_revisao', 'pendente')

  if (materiaVal !== 'all') {
    query = query.eq('materia_id', materiaVal)
  }

  if (semanaVal === 'due') {
    query = query
      .lte('revisar_novamente_em', dataRevisaoHoje())
      .order('revisar_novamente_em', { ascending: true, nullsFirst: false })
  } else {
    query = query.order('criado_em', { ascending: false })
  }

  if (semanaVal !== 'all' && semanaVal !== 'due') {
    const { inicio, fim } = calcularIntervaloSemana(parseInt(semanaVal))
    query = query.gte('criado_em', inicio).lte('criado_em', fim + 'T23:59:59')
  }

  query = query.limit(300)

  return query
}

// ============================================
// FILA INTELIGENTE DE REVISAO
// ============================================
async function gerarFilaRevisaoInteligente(opcoes = {}) {
  const container = document.getElementById('revisao-relatorio-inteligente')
  if (container) container.innerHTML = '<p class="texto-placeholder">Montando sua fila inteligente...</p>'

  try {
    const userId = window.usuarioAtual.id
    const [config, dados] = await Promise.all([
      obterConfiguracaoRevisaoUsuario(userId),
      buscarDadosFilaRevisao(userId)
    ])

    revisaoConfiguracaoAtual = config
    aplicarConfiguracaoRevisaoTela(config)

    const relatorio = montarRelatorioFilaRevisao(dados.questoes, config, dados.editalConfig, dados.revisoes)
    filaRevisaoInteligenteAtual = relatorio.fila
    filaRevisaoCompletaAtual = relatorio.filaCompleta || relatorio.fila

    if (container) {
      container.innerHTML = criarPainelFilaRevisao(relatorio, config, opcoes)
      vincularAcoesPainelFilaRevisao()
    }

    return relatorio
  } catch (erro) {
    console.error(erro)
    if (container) {
      container.innerHTML = `
        <div class="estado-erro">
          <h3 class="estado-erro-titulo">Nao foi possivel gerar a fila</h3>
          <p class="estado-erro-texto">${escaparHtmlSeguro(erro.message || 'Verifique sua conexao e tente novamente.')}</p>
          <button class="btn-secundario" type="button" id="btn-tentar-fila-revisao">Tentar novamente</button>
        </div>
      `
      document.getElementById('btn-tentar-fila-revisao')
        ?.addEventListener('click', () => gerarFilaRevisaoInteligente({ manual: true }))
    }
    return null
  }
}

async function buscarDadosFilaRevisao(userId) {
  const [questoesResp, editalResp, revisoesResp] = await Promise.all([
    db
      .from('questoes')
      .select('id, enunciado, alternativas, alternativa_marcada, alternativa_correta, tipo_questao, status_revisao, revisar_novamente_em, revisao_ultima_data, revisao_ultima_resultado, revisao_total_acertos, revisao_total_erros, revisao_etapa, motivo_erro, nivel_confianca, comentario, criado_em, materia_id, edital_topico_id, banca, pegadinha_banca, conceito_chave, como_reconhecer, acao_corretiva, materias(nome), edital_topicos(titulo, status, peso)')
      .eq('user_id', userId)
      .eq('status_revisao', 'pendente')
      .order('criado_em', { ascending: false })
      .limit(800),
    db
      .from('edital_config')
      .select('data_prova, concurso_alvo')
      .eq('user_id', userId)
      .maybeSingle(),
    db
      .from('questoes_revisoes')
      .select('id, questao_id, data_revisao, resultado, nivel_confianca, criado_em')
      .eq('user_id', userId)
      .order('data_revisao', { ascending: false })
      .limit(300)
  ])

  if (questoesResp.error) throw questoesResp.error
  if (revisoesResp.error) console.error(revisoesResp.error)

  return {
    questoes: questoesResp.data || [],
    editalConfig: editalResp.error ? null : editalResp.data,
    revisoes: revisoesResp.error ? [] : (revisoesResp.data || [])
  }
}

function montarRelatorioFilaRevisao(questoes, config, editalConfig = null, revisoes = []) {
  const hoje = dataRevisaoHoje()
  const base = selecionarQuestoesCicloRevisao(questoes, config, hoje)
  const porMateria = contarValoresRevisao(base.map(q => q.materias?.nome || 'Sem materia'))
  const porMotivo = contarValoresRevisao(base.map(q => q.motivo_erro || 'Sem motivo preenchido'))
  const porTopico = contarValoresRevisao(base.map(q => q.edital_topicos?.titulo || 'Sem assunto do edital'))
  const porPegadinha = contarValoresRevisao(base.flatMap(q => classificarPegadinhasRevisao(q.pegadinha_banca)))
  const diasAteProva = calcularDiasAteProvaRevisao(editalConfig?.data_prova)

  const filaCompleta = base
    .map(q => pontuarQuestaoFilaRevisao(q, {
      hoje,
      porMateria,
      porMotivo,
      porTopico,
      porPegadinha,
      diasAteProva
    }))
    .sort((a, b) => b.prioridade_revisao - a.prioridade_revisao || String(b.criado_em).localeCompare(String(a.criado_em)))

  const limite = Math.max(5, Math.min(60, Math.ceil(Number(config.tempo_revisao_minutos || 60) / 4)))
  const fila = filaCompleta.slice(0, limite)
  const qualidadesDiagnostico = base.map(q => avaliarQualidadeDiagnosticoQuestao(q))
  const semDiagnostico = qualidadesDiagnostico.filter(q => q.status === 'incompleto').length
  const diagnosticoFraco = qualidadesDiagnostico.filter(q => q.status === 'fraco').length
  const diagnosticoForte = qualidadesDiagnostico.filter(q => q.status === 'completo').length
  const comPegadinhas = base.filter(q => String(q.pegadinha_banca || '').trim()).length
  const vencidas = base.filter(q => q.revisar_novamente_em && q.revisar_novamente_em <= hoje).length
  const semAssunto = base.filter(q => !q.edital_topico_id).length
  const periodoTexto = config.ultima_revisao_geral
    ? `desde ${formatarDataCurtaRevisao(config.ultima_revisao_geral)}`
    : 'desde o inicio do caderno'

  return {
    totalPendente: questoes.length,
    totalCiclo: base.length,
    fila,
    filaCompleta,
    porMateria,
    porMotivo,
    porTopico,
    porPegadinha,
    semDiagnostico,
    diagnosticoFraco,
    diagnosticoForte,
    comPegadinhas,
    vencidas,
    semAssunto,
    periodoTexto,
    diasAteProva,
    editalConfig,
    calibracaoConfianca: montarCalibracaoConfiancaRevisao(revisoes),
    historicoCiclos: montarHistoricoEvolucaoCiclo(revisoes),
    acoes: montarAcoesFilaRevisao({ porMateria, porMotivo, porTopico, porPegadinha, semDiagnostico, diagnosticoFraco, vencidas, comPegadinhas, semAssunto, fila })
  }
}

function montarCalibracaoConfiancaRevisao(revisoes = []) {
  const base = (revisoes || []).filter(r => r.nivel_confianca)
  const mapa = {}

  base.forEach(r => {
    const chave = r.nivel_confianca || 'Sem confianca'
    if (!mapa[chave]) mapa[chave] = { nome: chave, total: 0, acertos: 0, erros: 0, percentual: 0 }
    mapa[chave].total += 1
    if (r.resultado === 'Acertou') mapa[chave].acertos += 1
    else mapa[chave].erros += 1
  })

  const itens = Object.values(mapa)
    .map(item => ({
      ...item,
      percentual: item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0
    }))
    .sort((a, b) => {
      const ordemA = NIVEIS_CONFIANCA_TREINO_REVISAO.indexOf(a.nome)
      const ordemB = NIVEIS_CONFIANCA_TREINO_REVISAO.indexOf(b.nome)
      return (ordemA === -1 ? 99 : ordemA) - (ordemB === -1 ? 99 : ordemB)
    })

  const confiante = itens.find(item => item.nome === 'Confiante')
  const duvida = itens.find(item => item.nome === 'Dúvida')
  const chute = itens.find(item => item.nome === 'Chutei')
  let resumo = 'Registre a confianca antes do gabarito para medir se sua seguranca combina com seus acertos.'

  if (confiante && confiante.total >= 3 && confiante.percentual < 70) {
    resumo = 'Sua confianca esta alta demais para o resultado. Use o modo pre-resposta com mais rigor antes de marcar.'
  } else if (duvida && duvida.percentual >= 70) {
    resumo = 'Voce acerta bastante mesmo em duvida. Vale revisar criterio de decisao para ganhar seguranca.'
  } else if (chute && chute.total > 0 && chute.percentual >= 50) {
    resumo = 'Os chutes estao virando acerto com frequencia. Transforme esses casos em diagnostico para separar intuicao de dominio.'
  } else if (base.length > 0) {
    resumo = 'Compare confianca e resultado para saber se o problema e conteudo, pressa ou excesso de seguranca.'
  }

  return { total: base.length, itens, resumo }
}

function montarHistoricoEvolucaoCiclo(revisoes = []) {
  const mapa = {}

  ;(revisoes || []).forEach(r => {
    const data = String(r.data_revisao || '').substring(0, 10)
    if (!data) return
    if (!mapa[data]) mapa[data] = { data, total: 0, acertos: 0, erros: 0, percentual: 0 }
    mapa[data].total += 1
    if (r.resultado === 'Acertou') mapa[data].acertos += 1
    else mapa[data].erros += 1
  })

  const itens = Object.values(mapa)
    .map(item => ({
      ...item,
      percentual: item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0
    }))
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 6)

  const atual = itens[0]
  const anterior = itens[1]
  let tendencia = 'Registre revisoes para comparar a evolucao dos ciclos.'

  if (atual && anterior) {
    const delta = atual.percentual - anterior.percentual
    if (delta > 0) tendencia = `Melhora de ${delta} ponto${delta !== 1 ? 's' : ''} em relacao ao ciclo anterior.`
    else if (delta < 0) tendencia = `Queda de ${Math.abs(delta)} ponto${Math.abs(delta) !== 1 ? 's' : ''}. Revise causa raiz antes de aumentar volume.`
    else tendencia = 'Ciclo estavel. Busque reduzir erros repetidos e diagnosticos fracos.'
  } else if (atual) {
    tendencia = 'Primeiro ciclo registrado. Os proximos vao mostrar tendencia.'
  }

  return { itens, tendencia }
}

function selecionarQuestoesCicloRevisao(questoes, config, hoje) {
  const lista = questoes || []
  const ultima = config?.ultima_revisao_geral
  if (!ultima) return lista

  const novasOuVencidas = lista.filter(q => {
    const criada = String(q.criado_em || '').substring(0, 10)
    const vencida = q.revisar_novamente_em && q.revisar_novamente_em <= hoje
    const nuncaRevisada = !q.revisao_ultima_data
    return criada >= ultima || vencida || nuncaRevisada
  })

  return novasOuVencidas.length > 0 ? novasOuVencidas : lista
}

function pontuarQuestaoFilaRevisao(q, contexto) {
  let pontos = 0
  const motivos = []
  const hoje = contexto.hoje
  const tipo = normalizarTipoResumoRevisao(q)
  const materia = q.materias?.nome || 'Sem materia'
  const motivo = q.motivo_erro || 'Sem motivo preenchido'
  const topico = q.edital_topicos?.titulo || 'Sem assunto do edital'
  const recorrenciaMateria = obterTotalContagemRevisao(contexto.porMateria, materia)
  const recorrenciaMotivo = obterTotalContagemRevisao(contexto.porMotivo, motivo)
  const recorrenciaTopico = obterTotalContagemRevisao(contexto.porTopico, topico)
  const pesoTopico = Number(q.edital_topicos?.peso || 0)
  const diasSemContato = calcularDiasSemContatoRevisao(q, hoje)
  const qualidadeDiagnostico = avaliarQualidadeDiagnosticoQuestao(q)

  if (q.revisar_novamente_em && q.revisar_novamente_em <= hoje) {
    pontos += 18
    motivos.push('revisao vencida')
  }

  if (!q.revisao_ultima_data) {
    pontos += 12
    motivos.push('ainda nao revisada')
  }

  if (tipo === 'Errada') {
    pontos += 6
    motivos.push('erro real')
  } else {
    pontos += 4
    motivos.push('chute/baixa confianca')
  }

  if (recorrenciaMateria > 1) {
    pontos += Math.min(14, recorrenciaMateria * 1.8)
    motivos.push('materia recorrente')
  }

  if (recorrenciaMotivo > 1) {
    pontos += Math.min(16, recorrenciaMotivo * 2.2)
    motivos.push('tipo de erro recorrente')
  }

  if (recorrenciaTopico > 1 && topico !== 'Sem assunto do edital') {
    pontos += Math.min(12, recorrenciaTopico * 2)
    motivos.push('assunto recorrente')
  }

  if (Number(q.revisao_total_erros || 0) > 0) {
    pontos += Math.min(18, Number(q.revisao_total_erros || 0) * 7)
    motivos.push('errou em revisao anterior')
  }

  if (q.pegadinha_banca) {
    pontos += 8
    motivos.push('tem pegadinha registrada')
  }

  if (motivo.toLowerCase().includes('pegadinha')) {
    pontos += 8
    motivos.push('erro por pegadinha')
  }

  if (motivo.toLowerCase().includes('interpreta')) {
    pontos += 6
    motivos.push('interpretação')
  }

  if (motivo.toLowerCase().includes('aten')) {
    pontos += 5
    motivos.push('atenção')
  }

  if (motivo.toLowerCase().includes('esquec')) {
    pontos += 5
    motivos.push('esquecimento')
  }

  if (diasSemContato > 7) {
    pontos += Math.min(15, Math.round(diasSemContato / 2))
    motivos.push(`${diasSemContato} dias sem contato`)
  }

  if (pesoTopico > 0) {
    pontos += pesoTopico * 2.5
    motivos.push(`peso ${pesoTopico} no edital`)
  }

  if (['dificuldade', 'revisar', 'nao_estudado'].includes(q.edital_topicos?.status)) {
    const pesoStatus = q.edital_topicos.status === 'dificuldade' ? 12 : q.edital_topicos.status === 'revisar' ? 8 : 6
    pontos += pesoStatus
    motivos.push('assunto fraco no edital')
  }

  if (contexto.diasAteProva !== null && contexto.diasAteProva >= 0 && contexto.diasAteProva <= 30) {
    pontos += 5 + pesoTopico
    motivos.push('reta final')
  }

  if (qualidadeDiagnostico.status === 'incompleto') {
    pontos += 9
    motivos.push('diagnostico incompleto')
  } else if (qualidadeDiagnostico.status === 'fraco') {
    pontos += 5
    motivos.push('diagnostico fraco')
  }

  return {
    ...q,
    prioridade_revisao: Math.round(pontos),
    motivos_prioridade_revisao: [...new Set(motivos)].slice(0, 5)
  }
}

function obterTotalContagemRevisao(lista, nome) {
  return (lista || []).find(item => item.nome === nome)?.total || 0
}

function calcularDiasSemContatoRevisao(q, hojeISO) {
  const base = q.revisao_ultima_data || String(q.criado_em || '').substring(0, 10)
  if (!base) return 0
  const inicio = new Date(`${base.substring(0, 10)}T12:00:00`)
  const fim = new Date(`${hojeISO}T12:00:00`)
  return Math.max(0, Math.round((fim - inicio) / 86400000))
}

function calcularDiasAteProvaRevisao(dataProva) {
  return calcularDiasAteProva(dataProva)
}

function classificarPegadinhasRevisao(texto) {
  const valor = String(texto || '').toLowerCase()
  if (!valor.trim()) return ['Sem pegadinha preenchida']

  const categorias = []
  if (/(sempre|nunca|somente|apenas|exclusivamente|obrigatoriamente)/.test(valor)) categorias.push('Palavra absoluta')
  if (/(excecao|exceção|salvo|exceto|ressalva)/.test(valor)) categorias.push('Excecao escondida')
  if (/(inversao|inversão|oposto|contrario|contrário|troca)/.test(valor)) categorias.push('Inversao ou troca de conceito')
  if (/(parcialmente|incompleta|meia verdade|quase correta)/.test(valor)) categorias.push('Alternativa parcialmente correta')
  if (/(literal|lei seca|artigo|inciso)/.test(valor)) categorias.push('Cobranca literal')
  if (/(ambigua|ambígua|induz|interpretacao|interpretação)/.test(valor)) categorias.push('Interpretacao induzida')

  return categorias.length > 0 ? categorias : ['Pegadinha especifica']
}

function montarAcoesFilaRevisao(relatorio) {
  const acoes = []
  const materia = relatorio.porMateria[0]
  const motivo = relatorio.porMotivo.find(item => item.nome !== 'Sem motivo preenchido')
  const topico = relatorio.porTopico.find(item => item.nome !== 'Sem assunto do edital')
  const pegadinha = relatorio.porPegadinha.find(item => item.nome !== 'Sem pegadinha preenchida')

  if (materia) acoes.push(`Comece por ${materia.nome}, que concentra ${formatarQuantidadeQuestoes(materia.total)} neste ciclo.`)
  if (topico) acoes.push(`Separe um bloco curto para o assunto "${topico.nome}", pois ele se repetiu ${topico.total} vez${topico.total !== 1 ? 'es' : ''}.`)
  if (motivo) acoes.push(`Revise o padrao de erro "${motivo.nome}" antes de refazer questoes.`)
  if (pegadinha) acoes.push(`Faca o treino de pegadinhas com foco em "${pegadinha.nome}".`)
  if (relatorio.vencidas > 0) acoes.push(`Priorize ${formatarQuantidadeQuestoes(relatorio.vencidas)} com revisao vencida.`)
  if (relatorio.semDiagnostico > 0) acoes.push(`Complete o diagnostico essencial de ${formatarQuantidadeQuestoes(relatorio.semDiagnostico)} para a fila ficar mais precisa.`)
  if (relatorio.diagnosticoFraco > 0) acoes.push(`Reforce ${formatarQuantidadeQuestoes(relatorio.diagnosticoFraco)} com diagnostico fraco: elas revelam menos padroes do que poderiam.`)
  if (relatorio.semAssunto > 0) acoes.push(`Vincule ${formatarQuantidadeQuestoes(relatorio.semAssunto)} ao assunto do edital para a prioridade considerar peso e cobertura.`)

  const motivoNome = String(motivo?.nome || '').toLowerCase()
  if (/falta de conte[uú]do|dom[ií]nio/.test(motivoNome)) {
    acoes.push('Volte a teoria do assunto principal antes dos flashcards; depois refaca questoes semelhantes.')
  }
  if (/desaten|aten[cç][aã]o/.test(motivoNome)) {
    acoes.push('Antes de responder, marque mentalmente comando, excecoes e palavras absolutas do enunciado.')
  }
  if (/interpreta/.test(motivoNome)) {
    acoes.push('Treine explicar o comando da questao em uma frase antes de olhar as alternativas.')
  }

  return acoes.length > 0 ? acoes.slice(0, 5) : ['Revise a fila em blocos curtos e registre o resultado dos flashcards.']
}

function criarPainelFilaRevisao(relatorio, config, opcoes = {}) {
  if (relatorio.totalCiclo === 0) {
    return `
      <div class="revisao-fila-card">
        <div class="revisao-fila-topo">
          <div>
            <h3>Nada acumulado para revisar</h3>
            <p>Quando voce registrar erros ou chutes, esta area responde o que revisar no dia escolhido.</p>
          </div>
          <span class="tag-estudo">${escaparHtmlSeguro(textoDiasRevisao(config.dias_revisao))}</span>
        </div>
        <div class="revisao-fila-acoes">
          <button class="btn-secundario" data-revisao-atalho="questoes" type="button">Registrar questao errada</button>
        </div>
      </div>
    `
  }

  const hojeRevisao = ehDiaDeRevisaoHoje(config)
  const titulo = hojeRevisao || opcoes.manual ? 'O que revisar agora' : 'Fila inteligente preparada'
  const materiaPrincipal = relatorio.porMateria[0]?.nome || '-'
  const motivoPrincipal = relatorio.porMotivo.find(item => item.nome !== 'Sem motivo preenchido')?.nome || '-'
  const topicoPrincipal = relatorio.porTopico.find(item => item.nome !== 'Sem assunto do edital')?.nome || '-'
  const pegadinhaPrincipal = relatorio.porPegadinha.find(item => item.nome !== 'Sem pegadinha preenchida')?.nome || '-'

  return `
    <div class="revisao-fila-card">
      <div class="revisao-fila-topo">
        <div>
          <h3>${escaparHtmlSeguro(titulo)}</h3>
          <p>Analise dos erros acumulados ${escaparHtmlSeguro(relatorio.periodoTexto)}. Foco em revisar o que mais tende a se repetir.</p>
        </div>
        <div class="revisao-fila-tags">
          <span class="tag-estudo">${hojeRevisao ? 'Dia de revisao' : `Proxima: ${formatarDataCurtaRevisao(calcularProximaDataRevisao(config.dias_revisao))}`}</span>
          <span class="tag-estudo">${config.tempo_revisao_minutos} min</span>
        </div>
      </div>

      <div class="revisao-fila-metricas">
        <div><strong>${relatorio.totalCiclo}</strong><span>erros no ciclo</span></div>
        <div><strong>${relatorio.fila.length}</strong><span>na fila de hoje</span></div>
        <div><strong>${relatorio.vencidas}</strong><span>revisoes vencidas</span></div>
        <div><strong>${relatorio.comPegadinhas}</strong><span>com pegadinhas</span></div>
        <div><strong>${relatorio.semDiagnostico + relatorio.diagnosticoFraco}</strong><span>diagnostico a reforcar</span></div>
        <div><strong>${relatorio.semAssunto}</strong><span>sem assunto do edital</span></div>
      </div>

      ${criarRitualSemanalRevisao(relatorio)}
      ${criarPainelCalibracaoHistoricoRevisao(relatorio)}

      <div class="revisao-fila-corpo">
        <section class="revisao-fila-painel">
          <h4>Fila prioritaria</h4>
          ${criarListaFilaPrioritaria(relatorio.fila.slice(0, 8))}
        </section>
        <section class="revisao-fila-painel">
          <h4>Diagnostico do ciclo</h4>
          <div class="revisao-fila-diagnostico">
            <div><strong>${escaparHtmlSeguro(materiaPrincipal)}</strong><span>materia mais recorrente</span></div>
            <div><strong>${escaparHtmlSeguro(topicoPrincipal)}</strong><span>assunto mais recorrente</span></div>
            <div><strong>${escaparHtmlSeguro(motivoPrincipal)}</strong><span>tipo de erro dominante</span></div>
            <div><strong>${escaparHtmlSeguro(pegadinhaPrincipal)}</strong><span>pegadinha mais comum</span></div>
          </div>
          <h4 class="revisao-fila-subtitulo">Assuntos criticos</h4>
          ${criarChipsRevisao(relatorio.porTopico.filter(item => item.nome !== 'Sem assunto do edital').slice(0, 7))}
          <h4 class="revisao-fila-subtitulo">Tipos de erro</h4>
          ${criarChipsRevisao(relatorio.porMotivo.slice(0, 7))}
          ${criarBotoesTreinoCausaRaiz(relatorio.porMotivo)}
          <h4 class="revisao-fila-subtitulo">Pegadinhas</h4>
          ${criarChipsRevisao(relatorio.porPegadinha.filter(item => item.nome !== 'Sem pegadinha preenchida').slice(0, 7))}
        </section>
        <section class="revisao-fila-painel">
          <h4>Acoes sugeridas</h4>
          <ul class="revisao-fila-acoes-lista">
            ${relatorio.acoes.map(acao => `<li>${escaparHtmlSeguro(acao)}</li>`).join('')}
          </ul>
        </section>
      </div>

      <div class="revisao-fila-acoes">
        <button class="btn-primario" id="btn-iniciar-fila-inteligente" type="button">Iniciar fila nos flashcards</button>
        <button class="btn-secundario" id="btn-revisar-assunto-critico" type="button">Revisar assunto critico</button>
        <button class="btn-secundario" id="btn-treinar-pegadinhas-fila" type="button">Treinar pegadinhas</button>
        <button class="btn-secundario" data-revisao-atalho="questoes" type="button">Completar diagnosticos</button>
      </div>
    </div>
  `
}

function criarPainelCalibracaoHistoricoRevisao(relatorio) {
  const calibracao = relatorio.calibracaoConfianca || { total: 0, itens: [], resumo: '' }
  const historico = relatorio.historicoCiclos || { itens: [], tendencia: '' }

  return `
    <div class="revisao-inteligencia-grid">
      <section class="revisao-mini-painel">
        <div>
          <span class="central-hoje-label">Calibracao de confianca</span>
          <h4>Seguranca x resultado</h4>
          <p>${escaparHtmlSeguro(calibracao.resumo)}</p>
        </div>
        ${criarListaCalibracaoConfianca(calibracao.itens)}
      </section>
      <section class="revisao-mini-painel">
        <div>
          <span class="central-hoje-label">Historico do ciclo</span>
          <h4>Evolucao das revisoes</h4>
          <p>${escaparHtmlSeguro(historico.tendencia)}</p>
        </div>
        ${criarListaHistoricoCiclos(historico.itens)}
      </section>
    </div>
  `
}

function criarListaCalibracaoConfianca(itens = []) {
  if (!itens.length) return '<p class="texto-placeholder">Ainda sem respostas calibradas.</p>'

  return `
    <div class="calibracao-lista">
      ${itens.map(item => `
        <div>
          <strong>${escaparHtmlSeguro(item.nome)}</strong>
          <span>${item.percentual}% de acerto · ${item.total}</span>
        </div>
      `).join('')}
    </div>
  `
}

function criarListaHistoricoCiclos(itens = []) {
  if (!itens.length) return '<p class="texto-placeholder">Ainda sem ciclos registrados.</p>'

  return `
    <div class="historico-ciclo-lista">
      ${itens.map(item => `
        <div>
          <strong>${escaparHtmlSeguro(formatarDataCurtaRevisao(item.data))}</strong>
          <span>${item.percentual}% · ${item.acertos}A/${item.erros}E</span>
        </div>
      `).join('')}
    </div>
  `
}

function criarBotoesTreinoCausaRaiz(itens = []) {
  const causas = (itens || [])
    .filter(item => item.nome && item.nome !== 'Sem motivo preenchido')
    .slice(0, 4)

  if (!causas.length) return ''

  return `
    <div class="treino-causa-raiz-acoes" aria-label="Treino por causa raiz">
      ${causas.map(item => `
        <button class="btn-chip-acao" type="button" data-treino-causa-raiz="${escaparHtmlSeguro(item.nome)}">
          Treinar ${escaparHtmlSeguro(item.nome)} (${item.total})
        </button>
      `).join('')}
    </div>
  `
}

function criarRitualSemanalRevisao(relatorio) {
  const assunto = relatorio.porTopico.find(item => item.nome !== 'Sem assunto do edital')
  const motivo = relatorio.porMotivo.find(item => item.nome !== 'Sem motivo preenchido')
  const pegadinha = relatorio.porPegadinha.find(item => item.nome !== 'Sem pegadinha preenchida')
  const diagnosticosAjustar = Number(relatorio.semDiagnostico || 0) + Number(relatorio.diagnosticoFraco || 0)

  const passos = []
  if (assunto) passos.push(`Refaca primeiro questoes de "${assunto.nome}" e anote a regra que resolve.`)
  if (motivo) passos.push(`Observe se o erro "${motivo.nome}" aparece antes de culpar apenas o conteudo.`)
  if (pegadinha) passos.push(`Separe 10 minutos para treinar a pegadinha "${pegadinha.nome}".`)
  if (diagnosticosAjustar > 0) passos.push(`Melhore ${formatarQuantidadeQuestoes(diagnosticosAjustar)} com diagnostico fraco ou incompleto.`)

  if (passos.length === 0) return ''

  return `
    <div class="revisao-ritual-card">
      <div>
        <span class="central-hoje-label">Ritual semanal</span>
        <h4>Fechamento do ciclo de erros</h4>
        <p>Use estes passos para transformar a revisao em decisao pratica, nao apenas em mais questoes.</p>
      </div>
      <ol>
        ${passos.slice(0, 4).map(passo => `<li>${escaparHtmlSeguro(passo)}</li>`).join('')}
      </ol>
    </div>
  `
}

function criarListaFilaPrioritaria(fila) {
  if (!fila || fila.length === 0) return '<p class="texto-placeholder">Nenhuma questao prioritaria encontrada.</p>'

  return `
    <div class="revisao-fila-lista">
      ${fila.map((q, index) => `
        <article class="revisao-fila-item">
          <span class="revisao-fila-posicao">${index + 1}</span>
          <div>
            <strong>${escaparHtmlSeguro(q.materias?.nome || 'Sem materia')}</strong>
            <p>${escaparHtmlSeguro(q.edital_topicos?.titulo || q.motivo_erro || 'Sem assunto definido')}</p>
            <small>${escaparHtmlSeguro((q.motivos_prioridade_revisao || []).join(' · ') || 'prioridade calculada')}</small>
          </div>
          <div class="revisao-fila-item-tags">
            <span class="diagnostico-qualidade-tag ${avaliarQualidadeDiagnosticoQuestao(q).classe}">${escaparHtmlSeguro(avaliarQualidadeDiagnosticoQuestao(q).rotulo)}</span>
            <span class="tag-estudo">${q.prioridade_revisao}</span>
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function criarChipsRevisao(itens) {
  if (!itens || itens.length === 0) return '<p class="texto-placeholder">Sem dados preenchidos.</p>'
  return `
    <div class="revisao-fila-chips">
      ${itens.map(item => `<span>${escaparHtmlSeguro(item.nome)} · ${item.total}</span>`).join('')}
    </div>
  `
}

function vincularAcoesPainelFilaRevisao() {
  document.getElementById('btn-iniciar-fila-inteligente')
    ?.addEventListener('click', iniciarTreinoFilaInteligente)
  document.getElementById('btn-revisar-assunto-critico')
    ?.addEventListener('click', iniciarTreinoAssuntoCritico)
  document.getElementById('btn-treinar-pegadinhas-fila')
    ?.addEventListener('click', iniciarTreinoPegadinhas)
  document.querySelectorAll('[data-treino-causa-raiz]').forEach(btn => {
    btn.addEventListener('click', () => iniciarTreinoCausaRaiz(btn.dataset.treinoCausaRaiz))
  })
  document.querySelectorAll('[data-revisao-atalho]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof navegarPara === 'function') navegarPara(btn.dataset.revisaoAtalho)
    })
  })
}

async function iniciarTreinoCausaRaiz(motivo) {
  let base = filaRevisaoCompletaAtual.length ? filaRevisaoCompletaAtual : filaRevisaoInteligenteAtual

  if (!base.length) {
    const relatorio = await gerarFilaRevisaoInteligente({ manual: true })
    base = relatorio?.filaCompleta || relatorio?.fila || []
  }

  const listaFiltrada = base
    .filter(q => q.motivo_erro === motivo)
    .sort((a, b) => Number(b.prioridade_revisao || 0) - Number(a.prioridade_revisao || 0))
    .slice(0, 30)
  const lista = document.getElementById('lista-revisao')
  const contador = document.getElementById('revisao-contador')

  if (!listaFiltrada.length) {
    if (lista) lista.innerHTML = '<p class="texto-placeholder">Nenhuma questao encontrada para essa causa raiz.</p>'
    if (contador) contador.style.display = 'none'
    return
  }

  treinoRevisaoQuestoes = listaFiltrada
  treinoRevisaoIndice = 0
  treinoRevisaoAcertos = 0
  treinoRevisaoErros = 0
  treinoRevisaoRespostaSelecionada = null
  treinoRevisaoPreResposta = ''
  treinoRevisaoChecklist = { comando: false, pegadinha: false, tipo: false }
  treinoRevisaoConfianca = ''
  treinoRevisaoResultados = []
  renderizarTreinoRevisao()
}

async function iniciarTreinoAssuntoCritico() {
  let base = filaRevisaoCompletaAtual.length ? filaRevisaoCompletaAtual : filaRevisaoInteligenteAtual

  if (!base.length) {
    const relatorio = await gerarFilaRevisaoInteligente({ manual: true })
    base = relatorio?.filaCompleta || relatorio?.fila || []
  }

  const assunto = contarValoresRevisao(base.map(q => q.edital_topicos?.titulo || 'Sem assunto do edital'))
    .find(item => item.nome !== 'Sem assunto do edital')
  const lista = document.getElementById('lista-revisao')
  const contador = document.getElementById('revisao-contador')

  if (!assunto) {
    if (lista) lista.innerHTML = '<p class="texto-placeholder">Nenhum assunto critico vinculado ao edital. Vincule questoes ao assunto do edital para usar este treino.</p>'
    if (contador) contador.style.display = 'none'
    return
  }

  treinoRevisaoQuestoes = base
    .filter(q => q.edital_topicos?.titulo === assunto.nome)
    .sort((a, b) => Number(b.prioridade_revisao || 0) - Number(a.prioridade_revisao || 0))
    .slice(0, 30)
  treinoRevisaoIndice = 0
  treinoRevisaoAcertos = 0
  treinoRevisaoErros = 0
  treinoRevisaoRespostaSelecionada = null
  treinoRevisaoPreResposta = ''
  treinoRevisaoChecklist = { comando: false, pegadinha: false, tipo: false }
  treinoRevisaoConfianca = ''
  treinoRevisaoResultados = []
  renderizarTreinoRevisao()
}

async function iniciarTreinoFilaInteligente() {
  if (!filaRevisaoInteligenteAtual.length) {
    const relatorio = await gerarFilaRevisaoInteligente({ manual: true })
    if (!relatorio?.fila?.length) return
  }

  treinoRevisaoQuestoes = filaRevisaoInteligenteAtual
  treinoRevisaoIndice = 0
  treinoRevisaoAcertos = 0
  treinoRevisaoErros = 0
  treinoRevisaoRespostaSelecionada = null
  treinoRevisaoPreResposta = ''
  treinoRevisaoChecklist = { comando: false, pegadinha: false, tipo: false }
  treinoRevisaoConfianca = ''
  treinoRevisaoResultados = []
  renderizarTreinoRevisao()
}

async function iniciarTreinoRevisao() {
  const lista = document.getElementById('lista-revisao')
  const contador = document.getElementById('revisao-contador')
  const btnModoFoco = document.getElementById('btn-modo-foco-revisao')

  lista.innerHTML = '<p class="texto-placeholder">⏳ Preparando seu treino de revisão...</p>'
  contador.style.display = 'none'

  // Mostrar botão de modo foco durante o treino
  if (btnModoFoco) btnModoFoco.style.display = 'inline-block'

  const { data, error } = await buscarQuestoesRevisao()

  if (error) {
    lista.innerHTML = '<p class="texto-placeholder">❌ Erro ao preparar o treino.</p>'
    if (btnModoFoco) btnModoFoco.style.display = 'none'
    return
  }

  if (!data || data.length === 0) {
    lista.innerHTML = '<p class="texto-placeholder">📭 Nenhuma questão pendente para treinar com esses filtros.</p>'
    if (btnModoFoco) btnModoFoco.style.display = 'none'
    return
  }

  treinoRevisaoQuestoes = data
  treinoRevisaoIndice = 0
  treinoRevisaoAcertos = 0
  treinoRevisaoErros = 0
  treinoRevisaoRespostaSelecionada = null
  treinoRevisaoPreResposta = ''
  treinoRevisaoChecklist = { comando: false, pegadinha: false, tipo: false }
  treinoRevisaoConfianca = ''
  treinoRevisaoResultados = []
  renderizarTreinoRevisao()
}

async function iniciarTreinoPegadinhas() {
  const lista = document.getElementById('lista-revisao')
  const contador = document.getElementById('revisao-contador')

  if (lista) lista.innerHTML = '<p class="texto-placeholder">⏳ Preparando treino de pegadinhas...</p>'
  if (contador) contador.style.display = 'none'

  try {
    const userId = window.usuarioAtual.id
    const [config, dados] = await Promise.all([
      obterConfiguracaoRevisaoUsuario(userId),
      buscarDadosFilaRevisao(userId)
    ])
    const relatorio = montarRelatorioFilaRevisao(dados.questoes, config, dados.editalConfig)
    const base = (filaRevisaoInteligenteAtual.length ? filaRevisaoInteligenteAtual : relatorio.filaCompleta)
      .filter(q => String(q.pegadinha_banca || '').trim())

    if (base.length === 0) {
      lista.innerHTML = '<p class="texto-placeholder">Nenhuma pegadinha salva para treinar ainda.</p>'
      return
    }

    treinoPegadinhasQuestoes = base
    treinoPegadinhasIndice = 0
    treinoPegadinhasRevelada = false
    renderizarTreinoPegadinha()
  } catch (erro) {
    console.error(erro)
    if (lista) lista.innerHTML = '<p class="texto-placeholder">Nao foi possivel preparar o treino de pegadinhas.</p>'
  }
}

function renderizarTreinoPegadinha() {
  const lista = document.getElementById('lista-revisao')
  const contador = document.getElementById('revisao-contador')
  const q = treinoPegadinhasQuestoes[treinoPegadinhasIndice]

  if (!q) {
    if (contador) contador.style.display = 'none'
    if (lista) {
      lista.innerHTML = `
        <div class="treino-revisao-final">
          <h3>Treino de pegadinhas concluido</h3>
          <p>Voce revisou ${formatarQuantidadeQuestoes(treinoPegadinhasQuestoes.length)} com armadilhas registradas.</p>
          ${criarBotaoVoltarListaRevisao()}
        </div>
      `
      vincularBotaoVoltarListaRevisao(lista)
    }
    return
  }

  if (contador) {
    contador.textContent = `Pegadinha ${treinoPegadinhasIndice + 1}/${treinoPegadinhasQuestoes.length}`
    contador.style.display = 'block'
  }

  if (!lista) return
  lista.innerHTML = ''
  lista.appendChild(criarCardTreinoPegadinha(q))
}

function criarCardTreinoPegadinha(q) {
  const card = document.createElement('div')
  card.className = 'treino-revisao-card treino-pegadinha-card'
  const alternativas = criarAlternativasTreinoPegadinha(q)
  const nomeMateria = q.materias?.nome || 'Sem materia'

  card.innerHTML = `
    <div class="treino-revisao-topo">
      <div>
        <span class="tag-materia">${escaparHtmlSeguro(nomeMateria)}</span>
        ${q.edital_topicos?.titulo ? `<span class="tag-estudo">Edital: ${escaparHtmlSeguro(q.edital_topicos.titulo)}</span>` : ''}
        ${q.banca ? `<span class="tag-estudo">Banca: ${escaparHtmlSeguro(q.banca)}</span>` : ''}
      </div>
      <span class="revisao-numero">#${treinoPegadinhasIndice + 1}</span>
    </div>
    <p class="treino-pegadinha-pergunta">Qual era a pegadinha aqui?</p>
    <p class="card-revisao-enunciado">${escaparHtmlSeguro(q.enunciado)}</p>
    <div class="lista-alternativas-card">${alternativas}</div>
    ${treinoPegadinhasRevelada ? `
      <div class="card-questao-diagnostico">
        <div class="diagnostico-item">
          <span class="diagnostico-rotulo">Pegadinha</span>
          <p>${escaparHtmlSeguro(q.pegadinha_banca)}</p>
        </div>
        ${q.como_reconhecer ? `
          <div class="diagnostico-item">
            <span class="diagnostico-rotulo">Como reconhecer</span>
            <p>${escaparHtmlSeguro(q.como_reconhecer)}</p>
          </div>
        ` : ''}
        ${q.acao_corretiva ? `
          <div class="diagnostico-item">
            <span class="diagnostico-rotulo">Acao corretiva</span>
            <p>${escaparHtmlSeguro(q.acao_corretiva)}</p>
          </div>
        ` : ''}
      </div>
    ` : '<p class="texto-placeholder treino-revisao-dica">Tente responder mentalmente antes de revelar a armadilha.</p>'}
    <div class="treino-revisao-acoes">
      ${treinoPegadinhasRevelada
        ? '<button class="btn-primario" id="btn-proxima-pegadinha" type="button">Proxima pegadinha</button>'
        : '<button class="btn-primario" id="btn-revelar-pegadinha" type="button">Revelar pegadinha</button>'}
      <button class="btn-secundario" id="btn-sair-treino-pegadinha" type="button">Voltar para lista</button>
    </div>
  `

  card.querySelector('#btn-revelar-pegadinha')?.addEventListener('click', () => {
    treinoPegadinhasRevelada = true
    renderizarTreinoPegadinha()
  })
  card.querySelector('#btn-proxima-pegadinha')?.addEventListener('click', avancarTreinoPegadinha)
  card.querySelector('#btn-sair-treino-pegadinha')?.addEventListener('click', filtrarRevisao)

  return card
}

function criarAlternativasTreinoPegadinha(q) {
  if (!q.alternativas || typeof q.alternativas !== 'object') return ''
  return Object.entries(q.alternativas).map(([letra, texto]) => `
    <div class="alternativa-card">
      <span class="alt-letra">${escaparHtmlSeguro(letra)}</span>
      <span class="alt-texto">${escaparHtmlSeguro(texto)}</span>
    </div>
  `).join('')
}

function avancarTreinoPegadinha() {
  treinoPegadinhasIndice += 1
  treinoPegadinhasRevelada = false
  renderizarTreinoPegadinha()
}

function renderizarTreinoRevisao(gabaritoVisivel = false) {
  const lista = document.getElementById('lista-revisao')
  const contador = document.getElementById('revisao-contador')
  const q = treinoRevisaoQuestoes[treinoRevisaoIndice]

  if (!q) {
    if (contador) contador.style.display = 'none'
    if (!lista) return
    lista.innerHTML = criarResumoFinalTreinoRevisao()
    vincularBotaoVoltarListaRevisao(lista)
    return
  }

  if (!lista || !contador) return
  contador.textContent = `Flashcard ${treinoRevisaoIndice + 1}/${treinoRevisaoQuestoes.length} — ${treinoRevisaoAcertos} acerto${treinoRevisaoAcertos !== 1 ? 's' : ''}, ${treinoRevisaoErros} erro${treinoRevisaoErros !== 1 ? 's' : ''}`
  contador.style.display = 'block'
  lista.innerHTML = ''
  if (treinoRevisaoIndice === 0 && !gabaritoVisivel) {
    lista.appendChild(criarResumoInteligenteRevisao(treinoRevisaoQuestoes, true))
  }
  lista.appendChild(criarCardTreinoRevisao(q, gabaritoVisivel))
}

function criarResumoFinalTreinoRevisao() {
  const total = treinoRevisaoResultados.length
  const aproveitamento = total > 0 ? Math.round((treinoRevisaoAcertos / total) * 100) : 0
  const calibracao = montarCalibracaoConfiancaRevisao(treinoRevisaoResultados.map(item => ({
    resultado: item.resultado,
    nivel_confianca: item.nivelConfianca
  })))
  const erros = treinoRevisaoResultados.filter(item => !item.acertou)
  const porMateria = contarValoresRevisao(erros.map(item => item.questao.materias?.nome || 'Sem materia'))
  const porMotivo = contarValoresRevisao(erros.map(item => item.questao.motivo_erro || 'Sem motivo preenchido'))
  const porTopico = contarValoresRevisao(erros.map(item => item.questao.edital_topicos?.titulo || 'Sem assunto do edital'))
  const acoes = montarAcoesResumoFinalRevisao({ porMateria, porMotivo, porTopico, calibracao, erros })

  return `
    <div class="treino-revisao-final">
      <span class="central-hoje-label">Resumo automatico da revisao</span>
      <h3>Flashcards concluidos</h3>
      <p>${treinoRevisaoAcertos} acerto${treinoRevisaoAcertos !== 1 ? 's' : ''} e ${treinoRevisaoErros} erro${treinoRevisaoErros !== 1 ? 's' : ''} registrados.</p>
      <div class="resumo-final-grid">
        <div><strong>${aproveitamento}%</strong><span>aproveitamento</span></div>
        <div><strong>${escaparHtmlSeguro(porMateria[0]?.nome || '-')}</strong><span>materia que mais errou</span></div>
        <div><strong>${escaparHtmlSeguro(porMotivo[0]?.nome || '-')}</strong><span>causa raiz principal</span></div>
        <div><strong>${escaparHtmlSeguro(porTopico.find(item => item.nome !== 'Sem assunto do edital')?.nome || '-')}</strong><span>assunto critico</span></div>
      </div>
      <div class="resumo-final-blocos">
        <section>
          <h4>Calibracao de confianca</h4>
          ${criarListaCalibracaoConfianca(calibracao.itens)}
        </section>
        <section>
          <h4>Proxima acao</h4>
          <ul class="revisao-fila-acoes-lista">
            ${acoes.map(acao => `<li>${escaparHtmlSeguro(acao)}</li>`).join('')}
          </ul>
        </section>
      </div>
      ${criarBotaoVoltarListaRevisao()}
    </div>
  `
}

function criarBotaoVoltarListaRevisao() {
  return '<button class="btn-secundario" id="btn-voltar-lista-revisao" data-revisao-acao="voltar-lista" type="button">Voltar para lista</button>'
}

function vincularBotaoVoltarListaRevisao(container = document) {
  container
    .querySelector('[data-revisao-acao="voltar-lista"]')
    ?.addEventListener('click', filtrarRevisao)
}

function montarAcoesResumoFinalRevisao({ porMateria, porMotivo, porTopico, calibracao, erros }) {
  const acoes = []
  const materia = porMateria[0]
  const motivo = porMotivo.find(item => item.nome !== 'Sem motivo preenchido')
  const topico = porTopico.find(item => item.nome !== 'Sem assunto do edital')
  const confiante = calibracao.itens.find(item => item.nome === 'Confiante')

  if (materia) acoes.push(`Revise ${materia.nome} antes de iniciar um novo bloco de questoes.`)
  if (topico) acoes.push(`Refaca questoes do assunto "${topico.nome}" ainda hoje ou no proximo dia de revisao.`)
  if (motivo) acoes.push(`Treine a causa raiz "${motivo.nome}" em uma rodada curta.`)
  if (confiante && confiante.erros > 0) acoes.push('Houve erro mesmo com confianca alta. Reforce o checklist antes de responder.')
  if (erros.length === 0) acoes.push('Sessao sem erros registrados. Mantenha a revisao no ciclo ate confirmar dominio.')
  if (acoes.length === 0) acoes.push('Continue registrando resultados para o sistema apontar o proximo foco.')

  return acoes.slice(0, 4)
}

function criarCardTreinoRevisao(q, gabaritoVisivel) {
  const card = document.createElement('div')
  card.className = 'treino-revisao-card'

  const nomeMateria = q.materias?.nome || 'Sem matéria'
  const respostaSelecionada = treinoRevisaoRespostaSelecionada
  const acertou = respostaSelecionada && respostaSelecionada === q.alternativa_correta
  const resultado = acertou ? 'Acertou' : 'Errou'
  const alternativas = criarAlternativasTreino(q, gabaritoVisivel, respostaSelecionada)
  const diagnostico = gabaritoVisivel ? criarDiagnosticoTreino(q) : ''
  const opcoesConfianca = renderizarOptionsConfiancaTreino(treinoRevisaoConfianca)
  const totalQuestoes = treinoRevisaoQuestoes.length
  const questaoAtual = treinoRevisaoIndice + 1
  const percentualProgresso = totalQuestoes > 0 ? (questaoAtual / totalQuestoes) * 100 : 0

  card.innerHTML = `
    <div class="revisao-progresso">
      <span>Questão ${questaoAtual} de ${totalQuestoes}</span>
      <div class="revisao-progresso-barra">
        <div class="revisao-progresso-fill" style="width: ${percentualProgresso}%"></div>
      </div>
    </div>
    <div class="treino-revisao-topo">
      <div>
        <span class="tag-materia">${escaparHtmlSeguro(nomeMateria)}</span>
        <span class="tag-tipo-questao ${typeof obterClasseTipoQuestao === 'function' ? obterClasseTipoQuestao(q.tipo_questao) : ''}">
          ${escaparHtmlSeguro(q.tipo_questao || 'Errada')}
        </span>
        ${q.edital_topicos?.titulo ? `<span class="tag-estudo">Edital: ${escaparHtmlSeguro(q.edital_topicos.titulo)}</span>` : ''}
        ${q.banca ? `<span class="tag-estudo">Banca: ${escaparHtmlSeguro(q.banca)}</span>` : ''}
      </div>
      <span class="revisao-numero">#${treinoRevisaoIndice + 1}</span>
    </div>
    <p class="card-revisao-enunciado">${escaparHtmlSeguro(q.enunciado)}</p>
    ${!gabaritoVisivel ? `
      <div class="modo-pre-resposta">
        <label class="campo-label">Antes de marcar: qual conceito resolve?</label>
        <textarea class="input-texto input-textarea" id="treino-pre-resposta" rows="2" placeholder="Escreva a regra, pista ou raciocínio antes de confirmar a alternativa...">${escaparHtmlSeguro(treinoRevisaoPreResposta || '')}</textarea>
      </div>
      <div class="checklist-resposta" aria-label="Checklist antes de responder">
        <label><input type="checkbox" class="treino-check-item" data-check="comando" ${treinoRevisaoChecklist.comando ? 'checked' : ''}> Li o comando da questão</label>
        <label><input type="checkbox" class="treino-check-item" data-check="pegadinha" ${treinoRevisaoChecklist.pegadinha ? 'checked' : ''}> Procurei exceções ou palavras absolutas</label>
        <label><input type="checkbox" class="treino-check-item" data-check="tipo" ${treinoRevisaoChecklist.tipo ? 'checked' : ''}> Diferenciei lei seca, interpretação ou raciocínio</label>
      </div>
      <div class="treino-confianca-bloco">
        <label class="campo-label">Confiança antes do gabarito</label>
        <select class="input-texto" id="treino-confianca-resposta">
          <option value="">Selecione...</option>
          ${opcoesConfianca}
        </select>
      </div>
    ` : ''}
    <div class="lista-alternativas-card">${alternativas}</div>
    ${gabaritoVisivel ? `
      <p class="treino-revisao-resultado ${acertou ? 'treino-revisao-resultado--acerto' : 'treino-revisao-resultado--erro'}">
        ${acertou ? 'Você acertou.' : 'Você errou.'}
      </p>
      <div class="treino-revisao-gabarito">
        <span class="tag-certa">Correta: ${escaparHtmlSeguro(q.alternativa_correta)}</span>
        <span class="${acertou ? 'tag-certa' : 'tag-errada'}">Sua resposta: ${escaparHtmlSeguro(respostaSelecionada || '-')}</span>
        <span class="tag-estudo">Você marcou antes: ${escaparHtmlSeguro(q.alternativa_marcada)}</span>
        <span class="tag-estudo">Confiança agora: ${escaparHtmlSeguro(treinoRevisaoConfianca || '-')}</span>
      </div>
      ${diagnostico}
    ` : '<p class="texto-placeholder treino-revisao-dica">Selecione uma alternativa e confirme para revelar o gabarito.</p>'}
    <p class="prompt-chatgpt-feedback prompt-chatgpt-feedback--erro" id="msg-treino-revisao"></p>
    <div class="treino-revisao-acoes">
      ${gabaritoVisivel
        ? `<button class="btn-primario" id="btn-registrar-treino" type="button">Registrar ${acertou ? 'acerto' : 'erro'} e avançar</button>
           <button class="btn-secundario" id="btn-treino-pular" type="button">Pular</button>`
        : `<button class="btn-primario" id="btn-confirmar-resposta-treino" type="button" ${prontoParaConfirmarTreino() ? '' : 'disabled'}>Confirmar resposta</button>
           <button class="btn-secundario" id="btn-sair-treino" type="button">Voltar para lista</button>`}
    </div>
  `

  card.querySelectorAll('.treino-resposta-opcao').forEach(btn => {
    btn.addEventListener('click', () => selecionarRespostaTreinoRevisao(btn.dataset.letra))
  })
  card.querySelector('#treino-pre-resposta')?.addEventListener('input', (e) => {
    treinoRevisaoPreResposta = e.target.value
    atualizarBotaoConfirmarTreino(card)
  })
  card.querySelectorAll('.treino-check-item').forEach(input => {
    input.addEventListener('change', () => {
      treinoRevisaoChecklist[input.dataset.check] = input.checked
      atualizarBotaoConfirmarTreino(card)
    })
  })
  card.querySelector('#treino-confianca-resposta')?.addEventListener('change', (e) => {
    treinoRevisaoConfianca = e.target.value
    atualizarBotaoConfirmarTreino(card)
  })
  card.querySelector('#btn-confirmar-resposta-treino')?.addEventListener('click', confirmarRespostaTreinoRevisao)
  card.querySelector('#btn-sair-treino')?.addEventListener('click', filtrarRevisao)
  card.querySelector('#btn-registrar-treino')?.addEventListener('click', () => registrarTreinoRevisao(q, resultado))
  card.querySelector('#btn-treino-pular')?.addEventListener('click', avancarTreinoRevisao)

  return card
}

function criarAlternativasTreino(q, gabaritoVisivel, respostaSelecionada) {
  if (!q.alternativas || typeof q.alternativas !== 'object') return ''

  return Object.entries(q.alternativas).map(([letra, texto]) => {
    const correta = letra === q.alternativa_correta
    const selecionada = letra === respostaSelecionada
    const classe = gabaritoVisivel
      ? `${correta ? 'alt-certa' : ''} ${selecionada && !correta ? 'alt-errada' : ''}`
      : `${selecionada ? 'treino-resposta-opcao--selecionada' : ''}`
    const badges = gabaritoVisivel
      ? `${selecionada ? `<span class="alt-badge ${correta ? 'alt-badge-certa' : 'alt-badge-errada'}">Sua resposta</span>` : ''}
         ${correta ? '<span class="alt-badge alt-badge-certa">Correta</span>' : ''}`
      : ''

    return `
      <button class="alternativa-card treino-resposta-opcao ${classe}" type="button" data-letra="${escaparHtmlSeguro(letra)}" ${gabaritoVisivel ? 'disabled' : ''}>
        <span class="alt-letra">${escaparHtmlSeguro(letra)}</span>
        <span class="alt-texto">${escaparHtmlSeguro(texto)}</span>
        ${badges}
      </button>
    `
  }).join('')
}

function selecionarRespostaTreinoRevisao(letra) {
  if (!preRespostaTreinoCompleta()) {
    const msg = document.getElementById('msg-treino-revisao')
    if (msg) msg.textContent = 'Antes de marcar, escreva o conceito e conclua o checklist.'
    return
  }

  treinoRevisaoRespostaSelecionada = letra
  renderizarTreinoRevisao(false)
}

function confirmarRespostaTreinoRevisao() {
  const msg = document.getElementById('msg-treino-revisao')

  if (!treinoRevisaoRespostaSelecionada) {
    msg.textContent = 'Selecione uma alternativa antes de confirmar.'
    return
  }
  if (!preRespostaTreinoCompleta()) {
    msg.textContent = 'Preencha o conceito antes da resposta e marque o checklist.'
    return
  }
  if (!treinoRevisaoConfianca) {
    msg.textContent = 'Selecione sua confiança antes de revelar o gabarito.'
    return
  }

  renderizarTreinoRevisao(true)
}

function atualizarBotaoConfirmarTreino(card) {
  const btn = card.querySelector('#btn-confirmar-resposta-treino')
  if (!btn) return
  btn.disabled = !prontoParaConfirmarTreino()
}

function prontoParaConfirmarTreino() {
  return Boolean(treinoRevisaoRespostaSelecionada && treinoRevisaoConfianca && preRespostaTreinoCompleta())
}

function renderizarOptionsConfiancaTreino(valorAtual = '') {
  return NIVEIS_CONFIANCA_TREINO_REVISAO.map(valor => `
    <option value="${escaparHtmlSeguro(valor)}" ${valor === valorAtual ? 'selected' : ''}>${escaparHtmlSeguro(valor)}</option>
  `).join('')
}

function preRespostaTreinoCompleta() {
  return treinoRevisaoPreResposta.trim().length >= 8 &&
    treinoRevisaoChecklist.comando &&
    treinoRevisaoChecklist.pegadinha &&
    treinoRevisaoChecklist.tipo
}

function criarDiagnosticoTreino(q) {
  const itens = [
    q.motivo_erro ? ['Motivo', q.motivo_erro] : null,
    q.nivel_confianca ? ['Confiança', q.nivel_confianca] : null,
    q.comentario ? ['Comentário', q.comentario] : null,
    q.pegadinha_banca ? ['Pegadinhas', q.pegadinha_banca] : null,
    q.conceito_chave ? ['Conceito', q.conceito_chave] : null,
    q.como_reconhecer ? ['Reconhecer', q.como_reconhecer] : null,
    q.acao_corretiva ? ['Ação', q.acao_corretiva] : null
  ].filter(Boolean)

  if (itens.length === 0) return ''

  return `
    <div class="card-questao-diagnostico">
      ${itens.map(([rotulo, texto]) => `
        <div class="diagnostico-item">
          <span class="diagnostico-rotulo">${escaparHtmlSeguro(rotulo)}</span>
          <p>${escaparHtmlSeguro(texto)}</p>
        </div>
      `).join('')}
    </div>
  `
}

async function registrarTreinoRevisao(q, resultado) {
  const msg = document.getElementById('msg-treino-revisao')
  const acertou = resultado === 'Acertou'
  const hoje = dataRevisaoHoje()
  const nivelConfianca = treinoRevisaoConfianca
  const proximaRevisao = calcularProximaRevisao24730(q, hoje, acertou, nivelConfianca)
  const proximaEtapa = calcularEtapaRevisao24730(q, acertou, nivelConfianca, proximaRevisao)

  msg.textContent = 'Registrando...'

  const { error: erroHistorico } = await db
    .from('questoes_revisoes')
    .insert({
      user_id: window.usuarioAtual.id,
      questao_id: q.id,
      data_revisao: hoje,
      resultado,
      resposta_marcada: treinoRevisaoRespostaSelecionada,
      nivel_confianca: nivelConfianca,
      revisar_novamente_em: proximaRevisao
    })

  if (erroHistorico) {
    console.error(erroHistorico)
    msg.textContent = 'Erro ao registrar revisão.'
    return
  }

  const { error: erroQuestao } = await db
    .from('questoes')
    .update({
      status_revisao: acertou && !proximaRevisao ? 'recuperada' : 'pendente',
      revisar_novamente_em: proximaRevisao,
      revisao_ultima_data: hoje,
      revisao_ultima_resultado: resultado,
      ultima_confianca_revisao: nivelConfianca,
      revisao_etapa: proximaEtapa,
      revisao_total_acertos: Number(q.revisao_total_acertos || 0) + (acertou ? 1 : 0),
      revisao_total_erros: Number(q.revisao_total_erros || 0) + (acertou ? 0 : 1)
    })
    .eq('id', q.id)
    .eq('user_id', window.usuarioAtual.id)

  if (erroQuestao) {
    console.error(erroQuestao)
    msg.textContent = 'Histórico salvo, mas a fila não foi atualizada.'
    return
  }

  if (acertou) treinoRevisaoAcertos += 1
  else treinoRevisaoErros += 1
  treinoRevisaoResultados.push({
    questao: q,
    resultado,
    acertou,
    nivelConfianca,
    resposta: treinoRevisaoRespostaSelecionada
  })

  avancarTreinoRevisao()
}

function avancarTreinoRevisao() {
  treinoRevisaoIndice += 1
  treinoRevisaoRespostaSelecionada = null
  treinoRevisaoPreResposta = ''
  treinoRevisaoChecklist = { comando: false, pegadinha: false, tipo: false }
  treinoRevisaoConfianca = ''
  renderizarTreinoRevisao(false)
}

function dataRevisaoHoje() {
  return dataHoje()
}

function adicionarDiasRevisao(dataISO, dias) {
  return adicionarDias(dataISO, dias)
}

function calcularProximaRevisao24730(q, hoje, acertou, nivelConfianca = 'Confiante') {
  if (!acertou) return adicionarDiasRevisao(hoje, 1)

  const etapaAtual = Number(q.revisao_etapa || 0)
  if (etapaAtual <= 0) return adicionarDiasRevisao(hoje, 7)
  if (etapaAtual === 1) return adicionarDiasRevisao(hoje, 30)
  if (nivelConfianca !== 'Confiante') return adicionarDiasRevisao(hoje, 30)
  return null
}

function calcularEtapaRevisao24730(q, acertou, nivelConfianca = 'Confiante', proximaRevisao = null) {
  if (!acertou) return 0
  if (nivelConfianca !== 'Confiante' && proximaRevisao) return Math.min(Number(q.revisao_etapa || 0), 2)
  return Math.min(Number(q.revisao_etapa || 0) + 1, 3)
}

function criarResumoInteligenteRevisao(questoes, modoTreino = false) {
  const resumo = montarResumoInteligenteRevisao(questoes)
  const card = document.createElement('div')
  card.className = 'resumo-revisao-inteligente'

  const focoPrincipal = resumo.focos[0] || 'Revise as questões mais recentes e marque o que ainda gerar dúvida.'

  card.innerHTML = `
    <div class="resumo-revisao-topo">
      <div>
        <h3>Resumo inteligente${modoTreino ? ' dos flashcards' : ''}</h3>
        <p>${escaparHtmlSeguro(focoPrincipal)}</p>
      </div>
      <span class="tag-estudo">${resumo.total} pendente${resumo.total !== 1 ? 's' : ''}</span>
    </div>
    <div class="resumo-revisao-metricas">
      <div><strong>${resumo.erradas}</strong><span>erros reais</span></div>
      <div><strong>${resumo.chutadas}</strong><span>chutes/dúvidas</span></div>
      <div><strong>${resumo.vencidas}</strong><span>vencidas</span></div>
      <div><strong>${resumo.semDiagnostico}</strong><span>sem diagnóstico</span></div>
    </div>
    <div class="resumo-revisao-corpo">
      <div>
        <strong>Ponto de atenção</strong>
        <p>${escaparHtmlSeguro(resumo.materiaCritica ? `${resumo.materiaCritica.nome}: ${formatarQuantidadeQuestoes(resumo.materiaCritica.total)}` : 'Sem matéria crítica definida.')}</p>
      </div>
      <div>
        <strong>Padrão mais comum</strong>
        <p>${escaparHtmlSeguro(resumo.motivoCritico ? `${resumo.motivoCritico.nome}: ${resumo.motivoCritico.total}` : 'Ainda sem motivo recorrente.')}</p>
      </div>
      <div>
        <strong>Ação sugerida</strong>
        <p>${escaparHtmlSeguro(resumo.focos[1] || resumo.focos[0] || 'Comece pelas vencidas e complete os diagnósticos incompletos.')}</p>
      </div>
    </div>
  `

  return card
}

function montarResumoInteligenteRevisao(questoes) {
  const hoje = dataRevisaoHoje()
  const lista = questoes || []
  const porMateria = contarValoresRevisao(lista.map(q => q.materias?.nome || 'Sem matéria'))
  const porMotivo = contarValoresRevisao(lista.map(q => q.motivo_erro).filter(Boolean))
  const materiaCritica = porMateria[0] || null
  const motivoCritico = porMotivo[0] || null
  const erradas = lista.filter(q => normalizarTipoResumoRevisao(q) === 'Errada').length
  const chutadas = lista.filter(q => normalizarTipoResumoRevisao(q) === 'Chutada').length
  const vencidas = lista.filter(q => q.revisar_novamente_em && q.revisar_novamente_em <= hoje).length
  const semDiagnostico = lista.filter(q => !q.conceito_chave || !q.como_reconhecer || !q.acao_corretiva).length
  const focos = []

  if (vencidas > 0) {
    focos.push(`Comece ${vencidas === 1 ? 'pela' : 'pelas'} ${formatarQuantidadeQuestoes(vencidas)} com revisão vencida.`)
  }

  if (materiaCritica) {
    focos.push(`Priorize ${materiaCritica.nome}, que concentra mais itens neste filtro.`)
  }

  if (motivoCritico) {
    focos.push(`Ataque o padrão "${motivoCritico.nome}" antes de avançar para outro bloco.`)
  }

  if (semDiagnostico > 0) {
    focos.push(`Complete o diagnóstico ${semDiagnostico === 1 ? 'da' : 'das'} ${formatarQuantidadeQuestoes(semDiagnostico)} sem conceito, reconhecimento ou ação corretiva.`)
  }

  if (chutadas > erradas && chutadas > 0) {
    focos.push('Separe as chutadas das erradas reais: aqui o problema principal parece ser confiança.')
  }

  if (focos.length === 0) {
    focos.push('O filtro está equilibrado. Revise em bloco curto e registre o resultado do treino.')
  }

  return {
    total: lista.length,
    erradas,
    chutadas,
    vencidas,
    semDiagnostico,
    materiaCritica,
    motivoCritico,
    focos
  }
}

function normalizarTipoResumoRevisao(q) {
  if (typeof normalizarTipoQuestao === 'function') return normalizarTipoQuestao(q)
  return q?.tipo_questao === 'Chutada' ? 'Chutada' : 'Errada'
}

function contarValoresRevisao(valores) {
  const contagem = {}
  valores.forEach(valor => {
    contagem[valor] = (contagem[valor] || 0) + 1
  })

  return Object.entries(contagem)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
}

// ============================================
// CRIAR CARD DE REVISÃO (completo)
// ============================================
function criarCardRevisao(q, numero) {
  const card = document.createElement('div')
  card.className = 'card-revisao'

  const nomeMateria = q.materias?.nome || 'Sem matéria'
  const data = new Date(q.criado_em).toLocaleDateString('pt-BR')
  const tipoQuestao = typeof normalizarTipoQuestao === 'function'
    ? normalizarTipoQuestao(q)
    : (q.tipo_questao === 'Chutada' ? 'Chutada' : 'Errada')
  const ehChutada = tipoQuestao === 'Chutada'
  const acertadaNoChute = ehChutada && q.alternativa_marcada === q.alternativa_correta
  const classeTagMarcada = ehChutada ? 'tag-chutada' : 'tag-errada'
  const textoMarcada = ehChutada
    ? `${acertadaNoChute ? 'Acertei no chute' : 'Chutei'}: ${q.alternativa_marcada}`
    : `Marquei: ${q.alternativa_marcada}`
  const rotuloMotivo = ehChutada ? 'Insegurança' : 'Erro'
  const qualidadeDiagnostico = avaliarQualidadeDiagnosticoQuestao(q)
  const resumoQualidade = criarResumoQualidadeDiagnostico(qualidadeDiagnostico)
  const alertaCadastro = criarAlertaCadastroFracoQuestao(qualidadeDiagnostico)

  // Alternativas completas
  let listaAlternativas = ''
  if (q.alternativas && typeof q.alternativas === 'object') {
    listaAlternativas = Object.entries(q.alternativas).map(([letra, texto]) => {
      const marcadaIncorreta = letra === q.alternativa_marcada && letra !== q.alternativa_correta
      const classeMarcada = marcadaIncorreta ? (ehChutada ? 'alt-chutada' : 'alt-errada') : ''
      const badgeMarcada = letra === q.alternativa_marcada
        ? `<span class="alt-badge ${ehChutada ? 'alt-badge-chutada' : 'alt-badge-errada'}">${ehChutada ? 'Chute' : 'Marquei'}</span>`
        : ''
      return `
      <div class="alternativa-card
        ${classeMarcada}
        ${letra === q.alternativa_correta ? 'alt-certa'  : ''}">
        <span class="alt-letra">${escaparHtmlSeguro(letra)}</span>
        <span class="alt-texto">${escaparHtmlSeguro(texto)}</span>
        ${badgeMarcada}
        ${letra === q.alternativa_correta ? '<span class="alt-badge alt-badge-certa">Correta</span>'  : ''}
      </div>
    `
    }).join('')
  }

  card.innerHTML = `
    <div class="card-revisao-topo">
      <div class="card-revisao-meta">
        <span class="revisao-numero">#${numero}</span>
        <span class="tag-materia">${escaparHtmlSeguro(nomeMateria)}</span>
        <span class="card-questao-data">${data}</span>
      </div>
      <div class="revisao-tags">
        <span class="${classeTagMarcada}">${escaparHtmlSeguro(textoMarcada)}</span>
        <span class="tag-certa">Correta: ${escaparHtmlSeguro(q.alternativa_correta)}</span>
        <span class="tag-tipo-questao ${typeof obterClasseTipoQuestao === 'function' ? obterClasseTipoQuestao(tipoQuestao) : ''}">
          ${escaparHtmlSeguro(acertadaNoChute ? 'Acertada no chute' : (typeof obterRotuloTipoQuestao === 'function' ? obterRotuloTipoQuestao(tipoQuestao) : tipoQuestao))}
        </span>
        ${q.edital_topicos?.titulo ? `<span class="tag-estudo">Edital: ${escaparHtmlSeguro(q.edital_topicos.titulo)}</span>` : ''}
        ${q.banca ? `<span class="tag-estudo">Banca: ${escaparHtmlSeguro(q.banca)}</span>` : ''}
        ${Number(q.revisao_etapa || 0) > 0 ? `<span class="tag-estudo">Ciclo 24/7/30: etapa ${Number(q.revisao_etapa || 0)}</span>` : ''}
        ${q.motivo_erro ? `<span class="tag-estudo">${escaparHtmlSeguro(rotuloMotivo)}: ${escaparHtmlSeguro(q.motivo_erro)}</span>` : ''}
        ${q.nivel_confianca ? `<span class="tag-estudo">Confiança: ${escaparHtmlSeguro(q.nivel_confianca)}</span>` : ''}
        <span class="diagnostico-qualidade-tag ${qualidadeDiagnostico.classe}">${escaparHtmlSeguro(qualidadeDiagnostico.rotulo)}</span>
      </div>
    </div>
    <p class="card-revisao-enunciado">${escaparHtmlSeguro(q.enunciado)}</p>
    <div class="lista-alternativas-card">${listaAlternativas}</div>
    ${q.comentario
      ? `<p class="card-questao-comentario">💬 ${escaparHtmlSeguro(q.comentario)}</p>`
      : ''}
    ${q.pegadinha_banca
      ? `<p class="card-questao-comentario card-questao-pegadinha"><strong>Pegadinhas da questão:</strong> ${escaparHtmlSeguro(q.pegadinha_banca)}</p>`
      : ''}
    ${alertaCadastro}
    ${qualidadeDiagnostico.status !== 'completo' ? `
      <div class="diagnostico-qualidade-alerta ${qualidadeDiagnostico.classe}">
        <strong>${escaparHtmlSeguro(qualidadeDiagnostico.rotulo)}</strong>
        <span>${escaparHtmlSeguro(resumoQualidade)}</span>
      </div>
    ` : ''}
  `

  return card
}
