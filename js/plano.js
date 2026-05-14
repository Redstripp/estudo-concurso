// js/plano.js

let planoInicializado = false
let materiasPlanoCache = []
let metaCentralPlano = 30

function inicializarPlanoDia() {
  if (!planoInicializado) {
    planoInicializado = true
    const inputData = document.getElementById('plano-data')
    if (inputData && !inputData.value) inputData.value = dataISOHoje()

    document.getElementById('plano-data')?.addEventListener('change', carregarPlanoDia)
    document.getElementById('plano-meta')?.addEventListener('input', event => {
      event.currentTarget.dataset.editado = 'true'
    })
    document.getElementById('btn-adicionar-plano')?.addEventListener('click', salvarMateriaNoPlano)
    document.getElementById('btn-gerar-plano-semanal')?.addEventListener('click', gerarPlanoSemanalNoPlanoDia)
  }

  carregarMetaCentralPlano()
  carregarMateriasPlano()
  carregarPlanoDia()
}

async function gerarPlanoSemanalNoPlanoDia() {
  const btn = document.getElementById('btn-gerar-plano-semanal')
  const data = document.getElementById('plano-data')?.value || dataISOHoje()

  if (typeof gerarPlanoDiaPeloPlanejamento !== 'function') {
    mostrarMsgPlano('Não foi possível carregar o gerador do planejamento semanal.', 'erro')
    return
  }

  if (btn) {
    btn.disabled = true
    btn.dataset.textoOriginal = btn.dataset.textoOriginal || btn.textContent
    btn.textContent = 'Gerando...'
  }

  try {
    await gerarPlanoDiaPeloPlanejamento(data)
  } finally {
    if (btn) {
      btn.disabled = false
      btn.textContent = btn.dataset.textoOriginal || 'Gerar pelo planejamento semanal'
    }
  }
}

async function carregarMetaCentralPlano() {
  const inputMeta = document.getElementById('plano-meta')
  if (!inputMeta) return

  const { data, error } = await db
    .from('profiles')
    .select('meta_diaria, meta_minima, meta_maxima')
    .eq('id', window.usuarioAtual.id)
    .maybeSingle()

  if (error) return

  metaCentralPlano = Number(data?.meta_diaria || data?.meta_maxima || data?.meta_minima || 30)
  if (inputMeta.dataset.editado !== 'true') inputMeta.value = metaCentralPlano
}

async function carregarMateriasPlano() {
  const select = document.getElementById('plano-materia')
  if (!select) return

  select.innerHTML = '<option value="">Buscando lista de matérias...</option>'

  const { data, error } = await db
    .from('materias')
    .select('id, nome')
    .eq('user_id', window.usuarioAtual.id)
    .order('nome', { ascending: true })

  if (error) {
    select.innerHTML = '<option value="">Erro ao carregar matérias</option>'
    return
  }

  materiasPlanoCache = data || []
  select.innerHTML = '<option value="">Selecione uma matéria...</option>'
  materiasPlanoCache.forEach(m => {
    const opt = document.createElement('option')
    opt.value = m.id
    opt.textContent = m.nome
    select.appendChild(opt)
  })
}

async function salvarMateriaNoPlano() {
  const data = document.getElementById('plano-data').value
  const materiaId = document.getElementById('plano-materia').value
  const meta = parseInt(document.getElementById('plano-meta').value)

  if (!data) {
    mostrarMsgPlano('Escolha a data do plano.', 'erro')
    return
  }

  if (!materiaId) {
    mostrarMsgPlano('Escolha uma matéria.', 'erro')
    return
  }

  if (!meta || meta < 1) {
    mostrarMsgPlano('Digite uma quantidade válida para essa matéria.', 'erro')
    return
  }

  const { error } = await db
    .from('plano_dia_materias')
    .upsert({
      user_id: window.usuarioAtual.id,
      data,
      materia_id: materiaId,
      meta_questoes: meta
    }, { onConflict: 'user_id,data,materia_id' })

  if (error) {
    console.error(error)
    mostrarMsgPlano('Erro ao salvar. Execute o SQL de melhoria no Supabase se ainda não fez.', 'erro')
    return
  }

  document.getElementById('plano-materia').value = ''
  mostrarMsgPlano('Matéria adicionada ao plano.', 'sucesso')
  await carregarPlanoDia()
}

async function carregarPlanoDia() {
  const lista = document.getElementById('lista-plano-dia')
  const resumo = document.getElementById('plano-resumo')
  const data = document.getElementById('plano-data')?.value || dataISOHoje()
  if (!lista) return

  lista.innerHTML = '<p class="texto-placeholder">⏳ Buscando seu plano do dia...</p>'
  if (resumo) resumo.innerHTML = ''

  const { data: plano, error } = await db
    .from('plano_dia_materias')
    .select('id, data, materia_id, meta_questoes, materias(nome)')
    .eq('user_id', window.usuarioAtual.id)
    .eq('data', data)
    .order('criado_em', { ascending: true })

  if (error) {
    console.error(error)
    lista.innerHTML = ''
    lista.appendChild(criarEstadoErroPlano(
      'Não foi possível carregar o Plano do Dia',
      'Execute o arquivo supabase-melhoria-estudos.sql no Supabase e tente novamente.',
      error.message
    ))
    return
  }

  if (!plano || plano.length === 0) {
    lista.innerHTML = '<p class="texto-placeholder">Nenhuma matéria planejada para esta data.</p>'
    return
  }

  const materiaIds = plano.map(item => item.materia_id)
  let metricas
  try {
    metricas = await calcularMetricasPlano(window.usuarioAtual.id, materiaIds, data)
  } catch (erroMetricas) {
    console.error(erroMetricas)
    lista.innerHTML = ''
    lista.appendChild(criarEstadoErroPlano(
      'Não foi possível calcular o semáforo semanal',
      'Verifique sua conexão e tente novamente.',
      erroMetricas.message
    ))
    return
  }

  const itens = plano.map(item => montarItemPlano(item, metricas[item.materia_id]))

  renderizarResumoPlano(itens)

  lista.innerHTML = ''
  itens.forEach(item => lista.appendChild(criarCardPlano(item)))
}

async function calcularMetricasPlano(userId, materiaIds, dataReferencia) {
  const { inicio, fim } = intervaloSemana(dataReferencia)

  const { data: sessoes, error: erroSessoes } = await db
    .from('sessoes_estudo')
    .select('id, data')
    .eq('user_id', userId)
    .lte('data', dataReferencia)
    .order('data', { ascending: false })
    .limit(180)

  if (erroSessoes) throw erroSessoes

  const sessoesLista = sessoes || []
  const idsSessoes = sessoesLista.map(s => s.id)
  const sessoesPorId = {}
  sessoesLista.forEach(s => { sessoesPorId[s.id] = s.data.substring(0, 10) })

  const metricas = {}
  materiaIds.forEach(id => {
    metricas[id] = {
      certasSemana: 0,
      erradasSemana: 0,
      certasHistorico: 0,
      erradasHistorico: 0,
      ultimaData: null
    }
  })

  if (idsSessoes.length === 0) return metricas

  const [erradasResp, certasResp] = await Promise.all([
    db
      .from('questoes')
      .select('sessao_id, materia_id')
      .eq('user_id', userId)
      .in('materia_id', materiaIds)
      .in('sessao_id', idsSessoes),
    db
      .from('questoes_certas')
      .select('sessao_id, materia_id, quantidade')
      .eq('user_id', userId)
      .in('materia_id', materiaIds)
      .in('sessao_id', idsSessoes)
  ])

  if (erradasResp.error) throw erradasResp.error
  if (certasResp.error) throw certasResp.error

  ;(erradasResp.data || []).forEach(q => {
    const m = metricas[q.materia_id]
    const dataSessao = sessoesPorId[q.sessao_id]
    if (!m || !dataSessao) return

    m.erradasHistorico += 1
    if (dataSessao >= inicio && dataSessao <= fim) m.erradasSemana += 1
    if (!m.ultimaData || dataSessao > m.ultimaData) m.ultimaData = dataSessao
  })

  ;(certasResp.data || []).forEach(q => {
    const m = metricas[q.materia_id]
    const dataSessao = sessoesPorId[q.sessao_id]
    const qtd = Number(q.quantidade) || 0
    if (!m || !dataSessao) return

    m.certasHistorico += qtd
    if (dataSessao >= inicio && dataSessao <= fim) m.certasSemana += qtd
    if (!m.ultimaData || dataSessao > m.ultimaData) m.ultimaData = dataSessao
  })

  return metricas
}

function montarItemPlano(item, metricas) {
  const totalSemana = metricas.certasSemana + metricas.erradasSemana
  const totalHistorico = metricas.certasHistorico + metricas.erradasHistorico
  const aproveitamentoSemana = totalSemana > 0
    ? Math.round((metricas.certasSemana / totalSemana) * 100)
    : null
  const aproveitamentoHistorico = totalHistorico > 0
    ? Math.round((metricas.certasHistorico / totalHistorico) * 100)
    : null
  const diasSemEstudar = metricas.ultimaData
    ? diferencaDias(metricas.ultimaData, item.data)
    : null

  let status = 'ok'
  let tituloStatus = 'Em dia'
  let motivo = 'Mantenha a meta dessa matéria.'
  let fatorMeta = 1

  if (totalHistorico === 0) {
    status = 'atencao'
    tituloStatus = 'Atenção'
    motivo = 'Sem histórico nessa matéria.'
    fatorMeta = 1.25
  } else if (
    aproveitamentoHistorico < 60 ||
    (aproveitamentoSemana !== null && aproveitamentoSemana < 60) ||
    diasSemEstudar >= 7
  ) {
    status = 'priorizar'
    tituloStatus = 'Priorizar'
    motivo = 'Aproveitamento baixo ou muitos dias sem estudo.'
    fatorMeta = 1.5
  } else if (
    aproveitamentoHistorico < 70 ||
    totalSemana < item.meta_questoes ||
    diasSemEstudar >= 5
  ) {
    status = 'atencao'
    tituloStatus = 'Atenção'
    motivo = 'Vale reforçar esta matéria nesta semana.'
    fatorMeta = 1.25
  }

  const metaSugerida = Math.max(item.meta_questoes, Math.ceil(item.meta_questoes * fatorMeta))

  return {
    ...item,
    nomeMateria: item.materias?.nome || 'Sem matéria',
    metricas,
    totalSemana,
    aproveitamentoSemana,
    aproveitamentoHistorico,
    diasSemEstudar,
    status,
    tituloStatus,
    motivo,
    metaSugerida
  }
}

function criarCardPlano(item) {
  const card = document.createElement('div')
  card.className = `plano-card plano-card--${item.status}`

  const aproveitamentoTexto = item.aproveitamentoHistorico !== null
    ? `${item.aproveitamentoHistorico}% histórico`
    : 'Sem histórico'
  const semanaTexto = item.aproveitamentoSemana !== null
    ? `${item.aproveitamentoSemana}% na semana`
    : 'Sem questões na semana'
  const ultimaTexto = item.diasSemEstudar === null
    ? 'Nunca estudada'
    : item.diasSemEstudar === 0
      ? 'Estudada hoje'
      : `${item.diasSemEstudar} dia${item.diasSemEstudar !== 1 ? 's' : ''} sem estudar`

  card.innerHTML = `
    <div class="plano-card-topo">
      <div>
        <h3 class="plano-card-titulo">${escaparHtmlSeguro(item.nomeMateria)}</h3>
        <p class="plano-card-subtitulo">${escaparHtmlSeguro(item.motivo)}</p>
      </div>
      <span class="plano-status plano-status--${item.status}">${item.tituloStatus}</span>
    </div>
    <div class="plano-metricas">
      <div>
        <span class="plano-metrica-valor">${item.meta_questoes}</span>
        <span class="plano-metrica-label">Meta do dia</span>
      </div>
      <div>
        <span class="plano-metrica-valor">${item.metaSugerida}</span>
        <span class="plano-metrica-label">Meta sugerida</span>
      </div>
      <div>
        <span class="plano-metrica-valor">${item.totalSemana}</span>
        <span class="plano-metrica-label">Feitas na semana</span>
      </div>
    </div>
    <div class="questao-tags-estudo">
      <span class="tag-estudo">${escaparHtmlSeguro(aproveitamentoTexto)}</span>
      <span class="tag-estudo">${escaparHtmlSeguro(semanaTexto)}</span>
      <span class="tag-estudo">${escaparHtmlSeguro(ultimaTexto)}</span>
    </div>
    <div class="plano-card-acoes">
      <input type="number" class="input-texto plano-meta-edicao" min="1" max="999" value="${item.meta_questoes}">
      <button class="btn-acao btn-atualizar-plano" type="button">Atualizar meta</button>
      <button class="btn-acao btn-excluir btn-remover-plano" type="button">Remover</button>
    </div>
  `

  card.querySelector('.btn-atualizar-plano').addEventListener('click', () => atualizarMetaPlano(item.id, card))
  card.querySelector('.btn-remover-plano').addEventListener('click', () => removerMateriaPlano(item.id))
  return card
}

function renderizarResumoPlano(itens) {
  const resumo = document.getElementById('plano-resumo')
  if (!resumo) return

  const total = itens.length
  const priorizar = itens.filter(i => i.status === 'priorizar').length
  const atencao = itens.filter(i => i.status === 'atencao').length
  const metaSugerida = itens.reduce((acc, item) => acc + item.metaSugerida, 0)

  resumo.innerHTML = `
    <div class="resumo-card">
      <span class="resumo-numero">${total}</span>
      <span class="resumo-label">Matérias no plano</span>
    </div>
    <div class="resumo-card">
      <span class="resumo-numero">${priorizar}</span>
      <span class="resumo-label">Para priorizar</span>
    </div>
    <div class="resumo-card">
      <span class="resumo-numero">${atencao}</span>
      <span class="resumo-label">Em atenção</span>
    </div>
    <div class="resumo-card">
      <span class="resumo-numero">${metaSugerida}</span>
      <span class="resumo-label">Questões sugeridas</span>
    </div>
  `
}

async function atualizarMetaPlano(id, card) {
  const novaMeta = parseInt(card.querySelector('.plano-meta-edicao').value)
  if (!novaMeta || novaMeta < 1) {
    mostrarMsgPlano('Digite uma meta válida.', 'erro')
    return
  }

  const { error } = await db
    .from('plano_dia_materias')
    .update({ meta_questoes: novaMeta })
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)

  if (error) {
    mostrarMsgPlano('Erro ao atualizar meta.', 'erro')
    return
  }

  mostrarMsgPlano('Meta atualizada.', 'sucesso')
  await carregarPlanoDia()
}

async function removerMateriaPlano(id) {
  const { error } = await db
    .from('plano_dia_materias')
    .delete()
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)

  if (error) {
    mostrarMsgPlano('Erro ao remover matéria.', 'erro')
    return
  }

  mostrarMsgPlano('Matéria removida do plano.', 'sucesso')
  await carregarPlanoDia()
}

function criarEstadoErroPlano(titulo, mensagem, detalhe) {
  const div = document.createElement('div')
  div.className = 'estado-erro'
  div.innerHTML = `
    <h3 class="estado-erro-titulo">${escaparHtmlSeguro(titulo)}</h3>
    <p class="estado-erro-texto">${escaparHtmlSeguro(mensagem)}</p>
    ${detalhe ? `<p class="estado-erro-detalhe">${escaparHtmlSeguro(detalhe)}</p>` : ''}
    <button class="btn-secundario" type="button">Tentar novamente</button>
  `
  div.querySelector('button').addEventListener('click', carregarPlanoDia)
  return div
}

function intervaloSemana(dataStr) {
  const data = new Date(dataStr + 'T12:00:00')
  const diaSemana = data.getDay()
  const diasAteSegunda = diaSemana === 0 ? 6 : diaSemana - 1
  const inicio = new Date(data)
  inicio.setDate(data.getDate() - diasAteSegunda)
  const fim = new Date(inicio)
  fim.setDate(inicio.getDate() + 6)

  return {
    inicio: dataISO(inicio),
    fim: dataISO(fim)
  }
}

function diferencaDias(inicio, fim) {
  const d1 = new Date(inicio + 'T12:00:00')
  const d2 = new Date(fim + 'T12:00:00')
  return Math.max(Math.round((d2 - d1) / 86400000), 0)
}

function dataISOHoje() {
  return dataHoje()
}

function dataISO(data) {
  if (!data) {
    const hoje = new Date()
    return hoje.toISOString().split('T')[0]
  }
  const d = new Date(data)
  if (isNaN(d.getTime())) {
    const hoje = new Date()
    return hoje.toISOString().split('T')[0]
  }
  return d.toISOString().split('T')[0]
}

function mostrarMsgPlano(texto, tipo) {
  const msg = document.getElementById('msg-plano')
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo}`
}
