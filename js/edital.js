// js/edital.js

let editalInicializado = false
let editalEstado = {
  materias: [],
  topicos: [],
  questoes: [],
  pegadinhas: [],
  config: null,
  perfil: null
}

const STATUS_EDITAL = {
  nao_estudado: { rotulo: 'Não estudado', classe: 'status-nao-estudado', peso: 10 },
  estudado: { rotulo: 'Estudado', classe: 'status-estudado', peso: 4 },
  revisar: { rotulo: 'Revisar', classe: 'status-revisar', peso: 8 },
  dominado: { rotulo: 'Dominado', classe: 'status-dominado', peso: 0 },
  dificuldade: { rotulo: 'Muita dificuldade', classe: 'status-dificuldade', peso: 12 }
}

async function inicializarEdital() {
  if (!editalInicializado) {
    editalInicializado = true
    document.getElementById('btn-salvar-edital-config')?.addEventListener('click', salvarConfigEdital)
    document.getElementById('btn-salvar-edital-topico')?.addEventListener('click', salvarTopicoEdital)
    document.getElementById('btn-salvar-pegadinha')?.addEventListener('click', salvarPegadinhaBanca)
    document.getElementById('pegadinha-materia')?.addEventListener('change', () => {
      popularSelectTopicosEdital('pegadinha-topico', document.getElementById('pegadinha-materia').value, '')
    })
  }

  await carregarEdital()
}

async function carregarEdital() {
  const painel = document.getElementById('edital-painel')
  if (painel) painel.innerHTML = '<p class="texto-placeholder">Carregando edital...</p>'

  try {
    const userId = window.usuarioAtual.id
    const [materiasResp, configResp, topicosResp, questoesResp, pegadinhasResp, perfilResp] = await Promise.all([
      db.from('materias').select('id, nome').eq('user_id', userId).order('nome', { ascending: true }),
      db.from('edital_config').select('*').eq('user_id', userId).maybeSingle(),
      db.from('edital_topicos').select('id, materia_id, titulo, status, peso, observacoes, criado_em, materias(nome)').eq('user_id', userId).order('criado_em', { ascending: true }),
      db.from('questoes').select('id, materia_id, edital_topico_id, tipo_questao, status_revisao, revisao_total_acertos, revisao_total_erros, revisao_ultima_data, criado_em').eq('user_id', userId),
      db.from('pegadinhas_banca').select('id, materia_id, edital_topico_id, banca, padrao, exemplo, acao, criado_em, materias(nome), edital_topicos(titulo)').eq('user_id', userId).order('criado_em', { ascending: false }),
      db.from('profiles').select('meta_diaria, meta_minima, meta_maxima').eq('id', userId).maybeSingle()
    ])

    if (materiasResp.error) throw materiasResp.error
    if (configResp.error) throw configResp.error
    if (topicosResp.error) throw topicosResp.error
    if (questoesResp.error) throw questoesResp.error
    if (pegadinhasResp.error) throw pegadinhasResp.error
    if (perfilResp.error) throw perfilResp.error

    editalEstado = {
      materias: materiasResp.data || [],
      config: configResp.data || null,
      topicos: topicosResp.data || [],
      questoes: questoesResp.data || [],
      pegadinhas: pegadinhasResp.data || [],
      perfil: perfilResp.data || null
    }

    preencherFormularioConfigEdital(editalEstado.config)
    popularSelectMateriasEdital()
    popularSelectTopicosEdital('pegadinha-topico', document.getElementById('pegadinha-materia')?.value || '', '')
    renderizarEdital()
    renderizarPegadinhasBanca()
  } catch (erro) {
    console.error(erro)
    mostrarErroEdital('Não foi possível carregar o edital. Execute o arquivo supabase-edital-concurso.sql no Supabase e tente novamente.')
  }
}

function popularSelectMateriasEdital() {
  const selects = [
    document.getElementById('edital-materia'),
    document.getElementById('pegadinha-materia')
  ].filter(Boolean)

  selects.forEach(select => {
    const valorAtual = select.value
    const opcaoInicial = select.id === 'pegadinha-materia'
      ? '<option value="">Todas / sem matéria</option>'
      : '<option value="">Selecione uma matéria...</option>'

    select.innerHTML = opcaoInicial
    editalEstado.materias.forEach(materia => {
      const option = document.createElement('option')
      option.value = materia.id
      option.textContent = materia.nome
      if (materia.id === valorAtual) option.selected = true
      select.appendChild(option)
    })
  })
}

async function carregarTopicosEditalParaSelect(selectId, materiaId = '', topicoAtualId = '', textoVazio = 'Sem assunto específico') {
  const select = document.getElementById(selectId)
  if (!select) return

  select.innerHTML = '<option value="">Carregando assuntos...</option>'

  try {
    let query = db
      .from('edital_topicos')
      .select('id, materia_id, titulo, materias(nome)')
      .eq('user_id', window.usuarioAtual.id)
      .order('titulo', { ascending: true })

    if (materiaId) query = query.eq('materia_id', materiaId)

    const { data, error } = await query
    if (error) throw error

    popularSelectTopicosEdital(selectId, materiaId, topicoAtualId, textoVazio, data || [])
  } catch (erro) {
    console.warn('Não foi possível carregar assuntos do edital.', erro)
    select.innerHTML = '<option value="">Execute o SQL do edital</option>'
  }
}

function popularSelectTopicosEdital(selectId, materiaId = '', topicoAtualId = '', textoVazio = 'Sem assunto específico', topicosFonte = editalEstado.topicos) {
  const select = document.getElementById(selectId)
  if (!select) return

  const topicos = (topicosFonte || [])
    .filter(topico => !materiaId || topico.materia_id === materiaId)
    .sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'))

  select.innerHTML = `<option value="">${textoVazio}</option>`

  topicos.forEach(topico => {
    const materia = topico.materias?.nome ? ` · ${topico.materias.nome}` : ''
    const option = document.createElement('option')
    option.value = topico.id
    option.textContent = `${topico.titulo}${materia}`
    if (topico.id === topicoAtualId) option.selected = true
    select.appendChild(option)
  })
}

function preencherFormularioConfigEdital(config) {
  document.getElementById('edital-concurso').value = config?.concurso_alvo || ''
  document.getElementById('edital-data-prova').value = config?.data_prova || ''
  const infoMeta = document.getElementById('edital-meta-central-info')
  if (infoMeta) {
    infoMeta.textContent = `Usa ${obterMetaCentralEdital()} questões por matéria, definido no Planejamento.`
  }
}

function obterMetaCentralEdital() {
  const perfil = editalEstado.perfil || {}
  return Number(perfil.meta_diaria || perfil.meta_maxima || perfil.meta_minima || 30)
}

async function salvarConfigEdital() {
  const btn = document.getElementById('btn-salvar-edital-config')
  const msg = document.getElementById('msg-edital-config')
  const concurso = document.getElementById('edital-concurso').value.trim()
  const dataProva = document.getElementById('edital-data-prova').value || null
  const meta = obterMetaCentralEdital()

  btn.disabled = true
  btn.textContent = 'Salvando...'
  msg.textContent = ''

  const { error } = await db
    .from('edital_config')
    .upsert({
      user_id: window.usuarioAtual.id,
      concurso_alvo: concurso || null,
      data_prova: dataProva,
      meta_questoes_reta_final: meta,
      atualizado_em: new Date().toISOString()
    }, { onConflict: 'user_id' })

  btn.disabled = false
  btn.textContent = 'Salvar reta final'

  if (error) {
    console.error(error)
    msg.textContent = 'Erro ao salvar. Execute o SQL do edital no Supabase.'
    msg.className = 'msg-materia erro'
    return
  }

  msg.textContent = 'Reta final salva.'
  msg.className = 'msg-materia sucesso'
  await carregarEdital()
}

async function salvarTopicoEdital() {
  const materiaId = document.getElementById('edital-materia').value
  const titulo = document.getElementById('edital-topico-titulo').value.trim()
  const status = document.getElementById('edital-topico-status').value
  const peso = Number(document.getElementById('edital-topico-peso').value) || 3
  const observacoes = document.getElementById('edital-topico-observacoes').value.trim()
  const msg = document.getElementById('msg-edital-topico')
  const btn = document.getElementById('btn-salvar-edital-topico')

  if (!materiaId) {
    msg.textContent = 'Selecione a matéria.'
    msg.className = 'msg-materia erro'
    return
  }
  if (titulo.length < 2) {
    msg.textContent = 'Digite o assunto do edital.'
    msg.className = 'msg-materia erro'
    return
  }

  btn.disabled = true
  btn.textContent = 'Salvando...'

  const { error } = await db.from('edital_topicos').insert({
    user_id: window.usuarioAtual.id,
    materia_id: materiaId,
    titulo,
    status,
    peso,
    observacoes: observacoes || null
  })

  btn.disabled = false
  btn.textContent = 'Adicionar assunto'

  if (error) {
    console.error(error)
    msg.textContent = 'Erro ao salvar assunto. Execute o SQL do edital no Supabase.'
    msg.className = 'msg-materia erro'
    return
  }

  document.getElementById('edital-topico-titulo').value = ''
  document.getElementById('edital-topico-observacoes').value = ''
  msg.textContent = 'Assunto adicionado.'
  msg.className = 'msg-materia sucesso'
  await carregarEdital()
}

function renderizarEdital() {
  const painel = document.getElementById('edital-painel')
  if (!painel) return

  const resumo = montarResumoEdital()
  renderizarResumoRetaFinal(resumo)

  if (editalEstado.topicos.length === 0) {
    painel.innerHTML = '<p class="texto-placeholder">Cadastre os assuntos do edital para começar a verticalização.</p>'
    return
  }

  const prioridades = calcularPrioridadesEdital(resumo).slice(0, 6)

  painel.innerHTML = `
    <div class="edital-resumo-grid">
      ${criarCardResumoEdital('Assuntos', resumo.totalTopicos)}
      ${criarCardResumoEdital('Dominados', resumo.status.dominado || 0)}
      ${criarCardResumoEdital('Para revisar', (resumo.status.revisar || 0) + (resumo.status.dificuldade || 0))}
      ${criarCardResumoEdital('Questões vinculadas', resumo.questoesVinculadas)}
    </div>
    <div class="edital-bloco">
      <div class="edital-bloco-topo">
        <h3>Prioridades da reta final</h3>
        <span class="tag-estudo">${prioridades.length} foco${prioridades.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="edital-prioridades">
        ${prioridades.length > 0 ? prioridades.map(criarCardPrioridadeEdital).join('') : '<p class="texto-placeholder">Sem prioridade crítica no momento.</p>'}
      </div>
    </div>
    <div class="edital-bloco">
      <div class="edital-bloco-topo">
        <h3>Assuntos do edital</h3>
        <span class="tag-estudo">${resumo.percentualDominio}% dominado</span>
      </div>
      <div class="edital-topicos-lista">
        ${editalEstado.topicos.map(topico => criarCardTopicoEdital(topico, resumo.statsPorTopico[topico.id] || criarStatsTopico())).join('')}
      </div>
    </div>
  `

  painel.querySelectorAll('.edital-status-select').forEach(select => {
    select.addEventListener('change', () => atualizarStatusTopicoEdital(select.dataset.id, select.value))
  })

  painel.querySelectorAll('.btn-excluir-topico-edital').forEach(btn => {
    btn.addEventListener('click', () => excluirTopicoEdital(btn.dataset.id))
  })
}

function montarResumoEdital() {
  const status = {}
  const statsPorTopico = {}
  let questoesVinculadas = 0

  editalEstado.topicos.forEach(topico => {
    status[topico.status] = (status[topico.status] || 0) + 1
    statsPorTopico[topico.id] = criarStatsTopico()
  })

  editalEstado.questoes.forEach(questao => {
    if (!questao.edital_topico_id || !statsPorTopico[questao.edital_topico_id]) return
    questoesVinculadas += 1
    const stats = statsPorTopico[questao.edital_topico_id]
    stats.total += 1
    if (questao.tipo_questao === 'Chutada') stats.chutadas += 1
    else stats.erradas += 1
    if (questao.status_revisao === 'pendente') stats.pendentes += 1
    if (questao.status_revisao === 'recuperada') stats.recuperadas += 1
    stats.acertosRevisao += Number(questao.revisao_total_acertos || 0)
    stats.errosRevisao += Number(questao.revisao_total_erros || 0)
    if (questao.revisao_ultima_data && (!stats.ultimaRevisao || questao.revisao_ultima_data > stats.ultimaRevisao)) {
      stats.ultimaRevisao = questao.revisao_ultima_data
    }
  })

  const totalTopicos = editalEstado.topicos.length
  const percentualDominio = totalTopicos
    ? Math.round(((status.dominado || 0) / totalTopicos) * 100)
    : 0

  return {
    totalTopicos,
    status,
    statsPorTopico,
    questoesVinculadas,
    percentualDominio
  }
}

function criarStatsTopico() {
  return {
    total: 0,
    erradas: 0,
    chutadas: 0,
    pendentes: 0,
    recuperadas: 0,
    acertosRevisao: 0,
    errosRevisao: 0,
    ultimaRevisao: null
  }
}

function renderizarResumoRetaFinal(resumo) {
  const container = document.getElementById('edital-reta-final-resumo')
  if (!container) return

  const config = editalEstado.config
  const diasRestantes = calcularDiasAteProva(config?.data_prova)
  const concurso = config?.concurso_alvo || 'Concurso alvo'
  const meta = obterMetaCentralEdital()

  if (!config?.data_prova) {
    container.innerHTML = '<p class="texto-placeholder">Cadastre a data da prova para ativar o modo reta final.</p>'
    return
  }

  const textoDias = diasRestantes < 0
    ? 'Prova já passou'
    : diasRestantes === 0
      ? 'Prova hoje'
      : `${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restantes`
  const totalPendente = (resumo.status.nao_estudado || 0) + (resumo.status.revisar || 0) + (resumo.status.dificuldade || 0)
  const questoesSugeridas = diasRestantes > 0 ? Math.max(meta, Math.ceil(totalPendente * 12 / Math.max(diasRestantes, 1))) : meta

  container.innerHTML = `
    <div class="edital-reta-final-card">
      <div>
        <span class="edital-reta-final-label">${escaparHtmlSeguro(concurso)}</span>
        <strong>${textoDias}</strong>
      </div>
      <div>
        <span class="edital-reta-final-label">Assuntos críticos</span>
        <strong>${totalPendente}</strong>
      </div>
      <div>
        <span class="edital-reta-final-label">Meta sugerida</span>
        <strong>${questoesSugeridas} questões/dia</strong>
      </div>
    </div>
  `
}

function calcularDiasAteProva(dataProva) {
  if (!dataProva) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const prova = new Date(`${dataProva}T00:00:00`)
  return Math.ceil((prova - hoje) / 86400000)
}

function calcularPrioridadesEdital(resumo) {
  return editalEstado.topicos
    .map(topico => {
      const stats = resumo.statsPorTopico[topico.id] || criarStatsTopico()
      const configStatus = STATUS_EDITAL[topico.status] || STATUS_EDITAL.nao_estudado
      const pontuacao = configStatus.peso + Number(topico.peso || 3) * 2 + stats.erradas * 3 + stats.chutadas * 2 + stats.errosRevisao * 2 + stats.pendentes
      return { topico, stats, pontuacao }
    })
    .filter(item => item.pontuacao > 5 && item.topico.status !== 'dominado')
    .sort((a, b) => b.pontuacao - a.pontuacao)
}

function criarCardResumoEdital(rotulo, valor) {
  return `
    <div class="edital-resumo-card">
      <span>${escaparHtmlSeguro(rotulo)}</span>
      <strong>${escaparHtmlSeguro(valor)}</strong>
    </div>
  `
}

function criarCardPrioridadeEdital(item) {
  const materia = item.topico.materias?.nome || 'Sem matéria'
  const status = STATUS_EDITAL[item.topico.status] || STATUS_EDITAL.nao_estudado
  return `
    <article class="edital-prioridade-card">
      <div class="edital-card-topo">
        <span class="tag-materia">${escaparHtmlSeguro(materia)}</span>
        <span class="edital-status ${status.classe}">${status.rotulo}</span>
      </div>
      <h4>${escaparHtmlSeguro(item.topico.titulo)}</h4>
      <p>${item.stats.pendentes} pendente${item.stats.pendentes !== 1 ? 's' : ''} · ${item.stats.errosRevisao} erro${item.stats.errosRevisao !== 1 ? 's' : ''} em revisão · peso ${item.topico.peso}</p>
    </article>
  `
}

function criarCardTopicoEdital(topico, stats) {
  const totalRevisoes = stats.acertosRevisao + stats.errosRevisao
  const percentualRecuperacao = totalRevisoes > 0
    ? Math.round((stats.acertosRevisao / totalRevisoes) * 100)
    : null
  const entraNaRevisao = stats.pendentes > 0 || ['revisar', 'dificuldade', 'nao_estudado'].includes(topico.status)
  const ultimaRevisao = stats.ultimaRevisao ? formatarDataEdital(stats.ultimaRevisao) : 'Nunca'
  const materia = topico.materias?.nome || 'Sem matéria'
  const status = STATUS_EDITAL[topico.status] || STATUS_EDITAL.nao_estudado
  return `
    <article class="edital-topico-card">
      <div class="edital-card-topo">
        <div>
          <span class="tag-materia">${escaparHtmlSeguro(materia)}</span>
          <span class="tag-estudo">Peso ${escaparHtmlSeguro(topico.peso)}</span>
        </div>
        <select class="input-texto edital-status-select" data-id="${topico.id}" aria-label="Status do assunto">
          ${Object.entries(STATUS_EDITAL).map(([valor, config]) => `
            <option value="${valor}" ${valor === topico.status ? 'selected' : ''}>${config.rotulo}</option>
          `).join('')}
        </select>
      </div>
      <h4>${escaparHtmlSeguro(topico.titulo)}</h4>
      ${topico.observacoes ? `<p class="edital-topico-observacao">${escaparHtmlSeguro(topico.observacoes)}</p>` : ''}
      <div class="edital-topico-metricas">
        <span>${stats.total} ${stats.total === 1 ? 'questão' : 'questões'}</span>
        <span>${stats.pendentes} pendente${stats.pendentes !== 1 ? 's' : ''}</span>
        <span>${percentualRecuperacao === null ? '-' : `${percentualRecuperacao}%`} recuperação</span>
        <span>Última revisão: ${escaparHtmlSeguro(ultimaRevisao)}</span>
        <span>${entraNaRevisao ? 'Entra na próxima revisão' : 'Fora da fila no momento'}</span>
      </div>
      <button class="btn-secundario btn-excluir-topico-edital" type="button" data-id="${topico.id}">Excluir assunto</button>
    </article>
  `
}

function formatarDataEdital(dataISO) {
  if (!dataISO) return '-'
  const [ano, mes, dia] = dataISO.substring(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

async function atualizarStatusTopicoEdital(id, status) {
  const { error } = await db
    .from('edital_topicos')
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)

  if (error) {
    console.error(error)
    alert('Erro ao atualizar status do assunto.')
    return
  }

  await carregarEdital()
}

async function excluirTopicoEdital(id) {
  if (!confirm('Deseja excluir este assunto do edital? As questões vinculadas não serão apagadas.')) return

  const { error } = await db
    .from('edital_topicos')
    .delete()
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)

  if (error) {
    console.error(error)
    alert('Erro ao excluir assunto.')
    return
  }

  await carregarEdital()
}

async function salvarPegadinhaBanca() {
  const materiaId = document.getElementById('pegadinha-materia').value || null
  const topicoId = document.getElementById('pegadinha-topico').value || null
  const banca = document.getElementById('pegadinha-banca').value.trim()
  const padrao = document.getElementById('pegadinha-padrao').value.trim()
  const acao = document.getElementById('pegadinha-acao').value.trim()
  const msg = document.getElementById('msg-pegadinha')
  const btn = document.getElementById('btn-salvar-pegadinha')

  if (padrao.length < 3) {
    msg.textContent = 'Descreva o padrão da pegadinha.'
    msg.className = 'msg-materia erro'
    return
  }

  btn.disabled = true
  btn.textContent = 'Salvando...'

  const { error } = await db.from('pegadinhas_banca').insert({
    user_id: window.usuarioAtual.id,
    materia_id: materiaId,
    edital_topico_id: topicoId,
    banca: banca || null,
    padrao,
    acao: acao || null
  })

  btn.disabled = false
  btn.textContent = 'Salvar pegadinha'

  if (error) {
    console.error(error)
    msg.textContent = 'Erro ao salvar pegadinha. Execute o SQL do edital no Supabase.'
    msg.className = 'msg-materia erro'
    return
  }

  document.getElementById('pegadinha-padrao').value = ''
  document.getElementById('pegadinha-acao').value = ''
  msg.textContent = 'Pegadinha salva.'
  msg.className = 'msg-materia sucesso'
  await carregarEdital()
}

function renderizarPegadinhasBanca() {
  const lista = document.getElementById('lista-pegadinhas')
  if (!lista) return

  if (editalEstado.pegadinhas.length === 0) {
    lista.innerHTML = '<p class="texto-placeholder">Nenhuma pegadinha cadastrada ainda.</p>'
    return
  }

  lista.innerHTML = editalEstado.pegadinhas.map(pegadinha => `
    <article class="pegadinha-card">
      <div class="edital-card-topo">
        <div>
          ${pegadinha.banca ? `<span class="tag-estudo">${escaparHtmlSeguro(pegadinha.banca)}</span>` : ''}
          ${pegadinha.materias?.nome ? `<span class="tag-materia">${escaparHtmlSeguro(pegadinha.materias.nome)}</span>` : ''}
          ${pegadinha.edital_topicos?.titulo ? `<span class="tag-estudo">${escaparHtmlSeguro(pegadinha.edital_topicos.titulo)}</span>` : ''}
        </div>
        <button class="btn-secundario btn-excluir-pegadinha" type="button" data-id="${pegadinha.id}">Excluir</button>
      </div>
      <p class="pegadinha-padrao">${escaparHtmlSeguro(pegadinha.padrao)}</p>
      ${pegadinha.acao ? `<p class="pegadinha-acao">${escaparHtmlSeguro(pegadinha.acao)}</p>` : ''}
    </article>
  `).join('')

  lista.querySelectorAll('.btn-excluir-pegadinha').forEach(btn => {
    btn.addEventListener('click', () => excluirPegadinhaBanca(btn.dataset.id))
  })
}

async function excluirPegadinhaBanca(id) {
  if (!confirm('Deseja excluir esta pegadinha?')) return

  const { error } = await db
    .from('pegadinhas_banca')
    .delete()
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)

  if (error) {
    console.error(error)
    alert('Erro ao excluir pegadinha.')
    return
  }

  await carregarEdital()
}

async function registrarPegadinhaDaQuestao({ materiaId, topicoId, banca, padrao }) {
  const texto = String(padrao || '').trim()
  if (!texto) return

  try {
    await db.from('pegadinhas_banca').insert({
      user_id: window.usuarioAtual.id,
      materia_id: materiaId || null,
      edital_topico_id: topicoId || null,
      banca: String(banca || '').trim() || null,
      padrao: texto
    })
  } catch (erro) {
    console.warn('Não foi possível salvar a pegadinha da questão.', erro)
  }
}

function mostrarErroEdital(mensagem) {
  const painel = document.getElementById('edital-painel')
  if (!painel) return
  painel.innerHTML = `
    <div class="estado-erro">
      <h3 class="estado-erro-titulo">Erro no edital</h3>
      <p class="estado-erro-texto">${escaparHtmlSeguro(mensagem)}</p>
      <button class="btn-secundario" type="button" id="btn-recarregar-edital">Tentar novamente</button>
    </div>
  `
  document.getElementById('btn-recarregar-edital')?.addEventListener('click', carregarEdital)
}
