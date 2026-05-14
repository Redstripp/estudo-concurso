// js/planejamento.js

let planejamentoInicializado = false
let planejamentoEstado = {
  materias: [],
  topicos: [],
  grade: [],
  leiSeca: [],
  config: null,
  perfil: null
}

const DIAS_PLANEJAMENTO = [
  { valor: 1, nome: 'Segunda-feira' },
  { valor: 2, nome: 'Terça-feira' },
  { valor: 3, nome: 'Quarta-feira' },
  { valor: 4, nome: 'Quinta-feira' },
  { valor: 5, nome: 'Sexta-feira' },
  { valor: 6, nome: 'Sábado' },
  { valor: 7, nome: 'Domingo' }
]

const TIPOS_ESTUDO_PLANEJAMENTO = {
  misto: 'Misto',
  teoria: 'Teoria',
  questoes: 'Questões',
  revisao: 'Revisão',
  lei_seca: 'Lei Seca'
}

function inicializarPlanejamento() {
  if (!planejamentoInicializado) {
    planejamentoInicializado = true
    const hoje = dataPlanejamentoHoje()
    if (document.getElementById('fila-data') && !document.getElementById('fila-data').value) {
      document.getElementById('fila-data').value = hoje
    }

    document.getElementById('btn-salvar-planejamento')?.addEventListener('click', salvarItemPlanejamentoSemanal)
    document.getElementById('btn-aplicar-planejamento-hoje')?.addEventListener('click', () => gerarPlanoDiaPeloPlanejamento())
    document.getElementById('btn-gerar-plano-semanal')?.addEventListener('click', () => gerarPlanoDiaPeloPlanejamento())
    document.getElementById('btn-salvar-meta-central')?.addEventListener('click', salvarMetaCentralPlanejamento)
    document.getElementById('meta-central-materia')?.addEventListener('input', atualizarPreviewMetaCentralPlanejamento)
    document.getElementById('planejamento-dia')?.addEventListener('change', atualizarPreviewMetaCentralPlanejamento)
    document.getElementById('btn-gerar-fila-inteligente')?.addEventListener('click', gerarFilaInteligente)
    document.getElementById('btn-gerar-simulado-assunto')?.addEventListener('click', gerarSimuladoPorAssunto)
    document.getElementById('btn-atualizar-pronto-prova')?.addEventListener('click', gerarRelatorioProntoProva)
    document.getElementById('btn-salvar-lei-seca')?.addEventListener('click', salvarItemLeiSeca)

    document.getElementById('simulado-assunto-materia')?.addEventListener('change', () => {
      popularTopicosPlanejamento('simulado-assunto-topico', document.getElementById('simulado-assunto-materia').value, 'Selecione um assunto')
    })
    document.getElementById('lei-materia')?.addEventListener('change', () => {
      popularTopicosPlanejamento('lei-topico', document.getElementById('lei-materia').value, 'Sem assunto')
    })
  }

  carregarPlanejamento()
}

async function carregarPlanejamento() {
  try {
    const userId = window.usuarioAtual.id
    const [materiasResp, topicosResp, gradeResp, leiResp, configResp, perfilResp] = await Promise.all([
      db.from('materias').select('id, nome').eq('user_id', userId).order('nome', { ascending: true }),
      db.from('edital_topicos').select('id, materia_id, titulo, status, peso, materias(nome)').eq('user_id', userId).order('titulo', { ascending: true }),
      db.from('planejamento_semanal').select('id, dia_semana, materia_id, ordem, meta_questoes, tipo_estudo, observacoes, materias(nome)').eq('user_id', userId).order('dia_semana', { ascending: true }).order('ordem', { ascending: true }),
      db.from('lei_seca_itens').select('id, materia_id, edital_topico_id, norma, artigo, texto, importancia, status, revisao_etapa, revisar_em, ultima_revisao, total_revisoes, total_erros, anotacoes, materias(nome), edital_topicos(titulo)').eq('user_id', userId).order('revisar_em', { ascending: true, nullsFirst: false }),
      db.from('edital_config').select('*').eq('user_id', userId).maybeSingle(),
      db.from('profiles').select('meta_diaria, meta_minima, meta_maxima').eq('id', userId).maybeSingle()
    ])

    if (materiasResp.error) throw materiasResp.error
    if (topicosResp.error) throw topicosResp.error
    if (gradeResp.error) throw gradeResp.error
    if (leiResp.error) throw leiResp.error
    if (configResp.error) throw configResp.error
    if (perfilResp.error) throw perfilResp.error

    planejamentoEstado = {
      materias: materiasResp.data || [],
      topicos: topicosResp.data || [],
      grade: gradeResp.data || [],
      leiSeca: leiResp.data || [],
      config: configResp.data || null,
      perfil: perfilResp.data || null
    }

    popularMateriasPlanejamento()
    popularTopicosPlanejamento('simulado-assunto-topico', document.getElementById('simulado-assunto-materia')?.value || '', 'Selecione um assunto')
    popularTopicosPlanejamento('lei-topico', document.getElementById('lei-materia')?.value || '', 'Sem assunto')
    atualizarCampoMetaCentralPlanejamento()
    renderizarGradeSemanal()
    renderizarLeiSeca()
    gerarRelatorioProntoProva()
  } catch (erro) {
    console.error(erro)
    mostrarErroPlanejamento('Execute o arquivo supabase-planejamento-inteligente.sql no Supabase para habilitar esta aba.')
  }
}

function obterMetaCentralPlanejamento() {
  const perfil = planejamentoEstado.perfil || {}
  return Number(perfil.meta_diaria || perfil.meta_maxima || perfil.meta_minima || 30)
}

function atualizarCampoMetaCentralPlanejamento() {
  const input = document.getElementById('meta-central-materia')
  if (input) input.value = obterMetaCentralPlanejamento()
  atualizarPreviewMetaCentralPlanejamento()
}

function atualizarPreviewMetaCentralPlanejamento() {
  const preview = document.getElementById('meta-central-preview')
  if (!preview) return

  const input = document.getElementById('meta-central-materia')
  const meta = Number(input?.value) || obterMetaCentralPlanejamento()
  const dia = Number(document.getElementById('planejamento-dia')?.value) || converterDiaSemanaPlanejamento(dataPlanejamentoHoje())
  const materiasNoDia = planejamentoEstado.grade.filter(item => item.dia_semana === dia).length || 3
  const total = meta * materiasNoDia
  const plural = materiasNoDia === 1 ? 'matéria' : 'matérias'

  preview.textContent = `${meta} questões por matéria x ${materiasNoDia} ${plural} = ${total} questões no dia.`
}

async function salvarMetaCentralPlanejamento() {
  const input = document.getElementById('meta-central-materia')
  const msg = document.getElementById('msg-meta-central')
  const meta = Number(input?.value)

  if (!meta || meta < 1) {
    if (msg) {
      msg.textContent = 'Digite uma meta válida.'
      msg.className = 'msg-materia erro'
    }
    return
  }

  const { error } = await db
    .from('profiles')
    .update({
      meta_diaria: meta,
      meta_minima: meta,
      meta_maxima: meta
    })
    .eq('id', window.usuarioAtual.id)

  if (error) {
    if (msg) {
      msg.textContent = 'Erro ao salvar a meta central.'
      msg.className = 'msg-materia erro'
    }
    return
  }

  planejamentoEstado.perfil = {
    ...(planejamentoEstado.perfil || {}),
    meta_diaria: meta,
    meta_minima: meta,
    meta_maxima: meta
  }

  const gradeResp = await db
    .from('planejamento_semanal')
    .update({
      meta_questoes: meta,
      atualizado_em: new Date().toISOString()
    })
    .eq('user_id', window.usuarioAtual.id)

  if (!gradeResp.error) {
    planejamentoEstado.grade = planejamentoEstado.grade.map(item => ({
      ...item,
      meta_questoes: meta
    }))
  }

  if (msg) {
    msg.textContent = 'Meta central salva.'
    msg.className = 'msg-materia sucesso'
  }

  atualizarPreviewMetaCentralPlanejamento()
  renderizarGradeSemanal()
}

function popularMateriasPlanejamento() {
  const selects = [
    ['planejamento-materia', 'Selecione uma matéria...'],
    ['simulado-assunto-materia', 'Todas as matérias'],
    ['lei-materia', 'Sem matéria']
  ]

  selects.forEach(([id, textoInicial]) => {
    const select = document.getElementById(id)
    if (!select) return
    const valorAtual = select.value
    select.innerHTML = `<option value="">${textoInicial}</option>`
    planejamentoEstado.materias.forEach(materia => {
      const option = document.createElement('option')
      option.value = materia.id
      option.textContent = materia.nome
      if (materia.id === valorAtual) option.selected = true
      select.appendChild(option)
    })
  })
}

function popularTopicosPlanejamento(selectId, materiaId = '', textoInicial = 'Sem assunto', valorAtual = '') {
  const select = document.getElementById(selectId)
  if (!select) return
  const selecionado = valorAtual || select.value
  const topicos = planejamentoEstado.topicos
    .filter(topico => !materiaId || topico.materia_id === materiaId)
    .sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'))

  select.innerHTML = `<option value="">${textoInicial}</option>`
  topicos.forEach(topico => {
    const option = document.createElement('option')
    option.value = topico.id
    option.textContent = `${topico.titulo}${topico.materias?.nome ? ` · ${topico.materias.nome}` : ''}`
    if (topico.id === selecionado) option.selected = true
    select.appendChild(option)
  })
}

async function salvarItemPlanejamentoSemanal() {
  const dia = Number(document.getElementById('planejamento-dia').value)
  const materiaId = document.getElementById('planejamento-materia').value
  const tipo = document.getElementById('planejamento-tipo').value
  const meta = obterMetaCentralPlanejamento()

  if (!materiaId) {
    mostrarMsgPlanejamento('Escolha uma matéria.', 'erro')
    return
  }

  const ordem = planejamentoEstado.grade.filter(item => item.dia_semana === dia).length + 1
  const { error } = await db.from('planejamento_semanal').upsert({
    user_id: window.usuarioAtual.id,
    dia_semana: dia,
    materia_id: materiaId,
    ordem,
    meta_questoes: meta,
    tipo_estudo: tipo,
    atualizado_em: new Date().toISOString()
  }, { onConflict: 'user_id,dia_semana,materia_id' })

  if (error) {
    console.error(error)
    mostrarMsgPlanejamento('Erro ao salvar. Execute o SQL do planejamento no Supabase.', 'erro')
    return
  }

  document.getElementById('planejamento-materia').value = ''
  mostrarMsgPlanejamento(`Matéria adicionada com meta de ${meta} questões.`, 'sucesso')
  await carregarPlanejamento()
}

function renderizarGradeSemanal() {
  const container = document.getElementById('planejamento-semanal-grade')
  if (!container) return

  container.innerHTML = DIAS_PLANEJAMENTO.map(dia => {
    const itens = planejamentoEstado.grade.filter(item => item.dia_semana === dia.valor)
    return `
      <section class="planejamento-dia-card">
        <h4>${dia.nome}</h4>
        <div class="planejamento-dia-lista">
          ${itens.length > 0 ? itens.map(criarItemGradeSemanal).join('') : '<p class="texto-placeholder">Dia livre ou sem matérias.</p>'}
        </div>
      </section>
    `
  }).join('')

  container.querySelectorAll('.btn-remover-planejamento').forEach(btn => {
    btn.addEventListener('click', () => removerItemPlanejamento(btn.dataset.id))
  })
}

function criarItemGradeSemanal(item) {
  const meta = obterMetaCentralPlanejamento()
  return `
    <article class="planejamento-item">
      <div class="planejamento-item-topo">
        <strong>${escaparHtmlSeguro(item.materias?.nome || 'Sem matéria')}</strong>
        <button class="btn-secundario btn-remover-planejamento" type="button" data-id="${item.id}">Remover</button>
      </div>
      <p class="planejamento-item-meta">${escaparHtmlSeguro(TIPOS_ESTUDO_PLANEJAMENTO[item.tipo_estudo] || 'Misto')} · ${meta} questões por matéria</p>
    </article>
  `
}

async function removerItemPlanejamento(id) {
  const { error } = await db
    .from('planejamento_semanal')
    .delete()
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)

  if (error) {
    mostrarMsgPlanejamento('Erro ao remover matéria do planejamento.', 'erro')
    return
  }

  mostrarMsgPlanejamento('Matéria removida.', 'sucesso')
  await carregarPlanejamento()
}

async function gerarPlanoDiaPeloPlanejamento(dataAlvo) {
  const data = dataAlvo || document.getElementById('plano-data')?.value || document.getElementById('fila-data')?.value || dataPlanejamentoHoje()
  const diaSemana = converterDiaSemanaPlanejamento(data)
  const itens = planejamentoEstado.grade.length
    ? planejamentoEstado.grade.filter(item => item.dia_semana === diaSemana)
    : await buscarGradeSemanalDia(diaSemana)

  if (!itens || itens.length === 0) {
    mostrarMsgPlanejamento('Não há matérias no planejamento semanal para essa data.', 'erro')
    if (typeof mostrarMsgPlano === 'function') mostrarMsgPlano('Não há matérias no planejamento semanal para essa data.', 'erro')
    return
  }

  const metaCentral = obterMetaCentralPlanejamento()
  const registros = itens.map(item => ({
    user_id: window.usuarioAtual.id,
    data,
    materia_id: item.materia_id,
    meta_questoes: metaCentral
  }))

  const { error } = await db
    .from('plano_dia_materias')
    .upsert(registros, { onConflict: 'user_id,data,materia_id' })

  if (error) {
    console.error(error)
    mostrarMsgPlanejamento('Erro ao gerar Plano do Dia pelo planejamento semanal.', 'erro')
    if (typeof mostrarMsgPlano === 'function') mostrarMsgPlano('Erro ao gerar pelo planejamento semanal.', 'erro')
    return
  }

  mostrarMsgPlanejamento(`Plano do Dia gerado: ${metaCentral} questões para cada matéria.`, 'sucesso')
  if (typeof mostrarMsgPlano === 'function') mostrarMsgPlano(`Plano do Dia gerado com ${metaCentral} questões por matéria.`, 'sucesso')
  if (document.getElementById('plano-data')?.value === data && typeof carregarPlanoDia === 'function') {
    await carregarPlanoDia()
  }
}

async function buscarGradeSemanalDia(diaSemana) {
  const { data, error } = await db
    .from('planejamento_semanal')
    .select('id, dia_semana, materia_id, meta_questoes, tipo_estudo, materias(nome)')
    .eq('user_id', window.usuarioAtual.id)
    .eq('dia_semana', diaSemana)
    .order('ordem', { ascending: true })

  if (error) throw error
  return data || []
}

async function gerarFilaInteligente() {
  const container = document.getElementById('fila-inteligente-resultado')
  const data = document.getElementById('fila-data')?.value || dataPlanejamentoHoje()
  if (!container) return

  container.innerHTML = '<p class="texto-placeholder">Calculando prioridades...</p>'

  try {
    const dados = await buscarDadosInteligentesPlanejamento()
    const fila = montarFilaInteligente(dados, data)
    renderizarFilaInteligente(fila, data)
  } catch (erro) {
    console.error(erro)
    container.innerHTML = '<p class="texto-placeholder">Não foi possível gerar a fila inteligente. Execute os SQLs do edital e do planejamento.</p>'
  }
}

async function buscarDadosInteligentesPlanejamento() {
  const userId = window.usuarioAtual.id
  const [materiasResp, topicosResp, questoesResp, certasResp, leiResp, configResp, gradeResp, perfilResp] = await Promise.all([
    db.from('materias').select('id, nome').eq('user_id', userId),
    db.from('edital_topicos').select('id, materia_id, titulo, status, peso, materias(nome)').eq('user_id', userId),
    db.from('questoes').select('id, materia_id, edital_topico_id, tipo_questao, status_revisao, revisar_novamente_em, revisao_total_erros, criado_em, materias(nome), edital_topicos(titulo, status, peso)').eq('user_id', userId),
    db.from('questoes_certas').select('materia_id, quantidade, criado_em').eq('user_id', userId),
    db.from('lei_seca_itens').select('id, materia_id, edital_topico_id, status, revisar_em, importancia, total_erros, materias(nome), edital_topicos(titulo)').eq('user_id', userId),
    db.from('edital_config').select('*').eq('user_id', userId).maybeSingle(),
    db.from('planejamento_semanal').select('id, dia_semana, materia_id, meta_questoes, tipo_estudo, materias(nome)').eq('user_id', userId),
    db.from('profiles').select('meta_diaria, meta_minima, meta_maxima').eq('id', userId).maybeSingle()
  ])

  ;[materiasResp, topicosResp, questoesResp, certasResp, leiResp, configResp, gradeResp, perfilResp].forEach(resp => {
    if (resp.error) throw resp.error
  })

  return {
    materias: materiasResp.data || [],
    topicos: topicosResp.data || [],
    questoes: questoesResp.data || [],
    certas: certasResp.data || [],
    leiSeca: leiResp.data || [],
    config: configResp.data || null,
    grade: gradeResp.data || [],
    perfil: perfilResp.data || null
  }
}

function montarFilaInteligente(dados, data) {
  const diaSemana = converterDiaSemanaPlanejamento(data)
  const diasProva = calcularDiasAteProvaPlanejamento(dados.config?.data_prova)
  const metaCentral = Number(dados.perfil?.meta_diaria || dados.perfil?.meta_maxima || dados.perfil?.meta_minima || obterMetaCentralPlanejamento())
  const porMateria = {}

  dados.materias.forEach(materia => {
    porMateria[materia.id] = {
      materiaId: materia.id,
      materia: materia.nome,
      score: 0,
      erradas: 0,
      chutadas: 0,
      vencidas: 0,
      certas: 0,
      topicosCriticos: [],
      leiVencida: 0,
      planejadaHoje: false,
      recomendacao: 'Questões',
      motivo: []
    }
  })

  dados.grade.filter(item => item.dia_semana === diaSemana).forEach(item => {
    const alvo = porMateria[item.materia_id]
    if (!alvo) return
    alvo.planejadaHoje = true
    alvo.score += 8
    alvo.recomendacao = TIPOS_ESTUDO_PLANEJAMENTO[item.tipo_estudo] || 'Misto'
    alvo.motivo.push('está na grade semanal de hoje')
  })

  dados.certas.forEach(item => {
    const alvo = porMateria[item.materia_id]
    if (alvo) alvo.certas += Number(item.quantidade || 0)
  })

  dados.questoes.forEach(q => {
    const alvo = porMateria[q.materia_id]
    if (!alvo) return

    const vencida = q.status_revisao === 'pendente' && q.revisar_novamente_em && q.revisar_novamente_em <= data
    const errosRevisao = Number(q.revisao_total_erros || 0)

    if (q.tipo_questao === 'Chutada') {
      alvo.chutadas += 1
      alvo.score += 2
    } else {
      alvo.erradas += 1
      alvo.score += 3
    }

    if (vencida) {
      alvo.vencidas += 1
      alvo.score += 9
    }

    if (errosRevisao > 0) alvo.score += errosRevisao * 2
  })

  dados.topicos.forEach(topico => {
    const alvo = porMateria[topico.materia_id]
    if (!alvo) return

    let acrescimo = Number(topico.peso || 3)
    if (topico.status === 'dificuldade') acrescimo += 14
    if (topico.status === 'revisar') acrescimo += 10
    if (topico.status === 'nao_estudado') acrescimo += diasProva !== null && diasProva <= 30 ? 12 : 7
    if (topico.status === 'dominado') acrescimo = 0

    if (acrescimo > 0) {
      alvo.score += acrescimo
      alvo.topicosCriticos.push(topico)
    }
  })

  dados.leiSeca.forEach(item => {
    const alvo = porMateria[item.materia_id]
    if (!alvo) return
    const vencida = item.status !== 'dominado' && (!item.revisar_em || item.revisar_em <= data)
    if (vencida) {
      alvo.leiVencida += 1
      alvo.score += 7 + Number(item.importancia || 3)
    }
  })

  Object.values(porMateria).forEach(item => {
    const total = item.certas + item.erradas + item.chutadas
    const aproveitamento = total > 0 ? Math.round((item.certas / total) * 100) : null
    item.aproveitamento = aproveitamento

    if (aproveitamento !== null && aproveitamento < 60) {
      item.score += 12
      item.motivo.push(`aproveitamento baixo (${aproveitamento}%)`)
    }

    if (item.vencidas > 0) {
      item.recomendacao = 'Revisão espaçada'
      item.motivo.push(`${item.vencidas} revisão${item.vencidas !== 1 ? 'ões' : ''} vencida${item.vencidas !== 1 ? 's' : ''}`)
    } else if (item.leiVencida > 0) {
      item.recomendacao = 'Lei Seca'
      item.motivo.push(`${item.leiVencida} item${item.leiVencida !== 1 ? 's' : ''} de Lei Seca`)
    } else if (item.topicosCriticos.some(t => ['nao_estudado', 'dificuldade'].includes(t.status))) {
      item.recomendacao = 'Teoria dirigida'
      item.motivo.push('assuntos críticos do edital')
    } else if (item.erradas || item.chutadas) {
      item.recomendacao = 'Questões'
      item.motivo.push('erros e chutes acumulados')
    }

    if (diasProva !== null && diasProva <= 20 && item.topicosCriticos.length > 0) {
      item.score += 8
      item.motivo.push('prova próxima')
    }

    item.meta = metaCentral
  })

  return Object.values(porMateria)
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}

function renderizarFilaInteligente(fila, data) {
  const container = document.getElementById('fila-inteligente-resultado')
  if (!container) return

  if (fila.length === 0) {
    container.innerHTML = '<p class="texto-placeholder">Nenhuma prioridade encontrada. Cadastre edital, questões ou Lei Seca para alimentar a fila.</p>'
    return
  }

  const totalMeta = fila.reduce((acc, item) => acc + item.meta, 0)
  container.innerHTML = `
    <div class="fila-resumo-grid">
      <div class="edital-resumo-card"><span>Data</span><strong>${formatarDataPlanejamento(data)}</strong></div>
      <div class="edital-resumo-card"><span>Prioridades</span><strong>${fila.length}</strong></div>
      <div class="edital-resumo-card"><span>Meta sugerida</span><strong>${totalMeta} questões</strong></div>
    </div>
    ${fila.map(criarCardFilaInteligente).join('')}
  `

  container.querySelectorAll('.btn-adicionar-fila-plano').forEach(btn => {
    btn.addEventListener('click', () => adicionarMateriaFilaAoPlano(btn.dataset.materiaId, Number(btn.dataset.meta), data))
  })
}

function criarCardFilaInteligente(item) {
  const motivos = item.motivo.length ? item.motivo.join(' · ') : 'prioridade calculada pelo sistema'
  const topicos = item.topicosCriticos.slice(0, 3).map(t => t.titulo).join(', ')
  return `
    <article class="fila-card">
      <div class="fila-card-topo">
        <div>
          <h4>${escaparHtmlSeguro(item.materia)}</h4>
          <p>${escaparHtmlSeguro(item.recomendacao)} · ${escaparHtmlSeguro(motivos)}</p>
        </div>
        <span class="fila-score">${Math.round(item.score)}</span>
      </div>
      <div class="questao-tags-estudo">
        <span class="tag-estudo">${item.meta} questões sugeridas</span>
        <span class="tag-estudo">${item.vencidas} revisões vencidas</span>
        <span class="tag-estudo">${item.erradas} erradas</span>
        <span class="tag-estudo">${item.chutadas} chutadas</span>
        ${item.aproveitamento !== null ? `<span class="tag-estudo">${item.aproveitamento}% aproveitamento</span>` : ''}
      </div>
      ${topicos ? `<p>${escaparHtmlSeguro(topicos)}</p>` : ''}
      <div class="fila-card-acoes">
        <button class="btn-secundario btn-adicionar-fila-plano" type="button" data-materia-id="${item.materiaId}" data-meta="${item.meta}">Adicionar ao Plano do Dia</button>
      </div>
    </article>
  `
}

async function adicionarMateriaFilaAoPlano(materiaId, meta, data) {
  const { error } = await db.from('plano_dia_materias').upsert({
    user_id: window.usuarioAtual.id,
    data,
    materia_id: materiaId,
    meta_questoes: meta
  }, { onConflict: 'user_id,data,materia_id' })

  if (error) {
    mostrarMsgPlanejamento('Erro ao adicionar prioridade ao Plano do Dia.', 'erro')
    return
  }

  mostrarMsgPlanejamento('Prioridade adicionada ao Plano do Dia.', 'sucesso')
}

async function gerarSimuladoPorAssunto() {
  const topicoId = document.getElementById('simulado-assunto-topico').value
  const limite = Number(document.getElementById('simulado-assunto-limite').value) || 10
  const container = document.getElementById('simulado-assunto-resultado')

  if (!topicoId) {
    mostrarMsgSimuladoAssunto('Escolha um assunto do edital.', 'erro')
    return
  }

  container.innerHTML = '<p class="texto-placeholder">Montando simulado por assunto...</p>'

  const { data, error } = await db
    .from('questoes')
    .select('id, enunciado, alternativas, alternativa_marcada, alternativa_correta, tipo_questao, status_revisao, revisar_novamente_em, revisao_total_acertos, revisao_total_erros, revisao_etapa, revisao_ultima_data, revisao_ultima_resultado, motivo_erro, nivel_confianca, comentario, conceito_chave, como_reconhecer, acao_corretiva, criado_em, materias(nome), edital_topicos(titulo, status), banca, pegadinha_banca')
    .eq('user_id', window.usuarioAtual.id)
    .eq('edital_topico_id', topicoId)
    .limit(300)

  if (error) {
    console.error(error)
    mostrarMsgSimuladoAssunto('Erro ao buscar questões desse assunto.', 'erro')
    return
  }

  const questoes = embaralharPlanejamento(data || []).slice(0, Math.min(limite, 100))

  if (questoes.length === 0) {
    container.innerHTML = '<p class="texto-placeholder">Nenhuma questão vinculada a esse assunto ainda.</p>'
    return
  }

  container.innerHTML = `
    <div class="simulado-revisao-resumo">
      <div>
        <h3 class="simulado-revisao-titulo">Simulado por assunto</h3>
        <p class="simulado-revisao-subtitulo">${questoes.length} ${questoes.length === 1 ? 'questão' : 'questões'} do edital</p>
      </div>
    </div>
    <div class="simulado-revisao-lista"></div>
  `

  const lista = container.querySelector('.simulado-revisao-lista')
  questoes.forEach((q, index) => {
    if (typeof criarCardSimuladoRevisao === 'function') {
      lista.appendChild(criarCardSimuladoRevisao(q, index + 1))
    } else {
      lista.appendChild(criarCardSimplesSimuladoAssunto(q, index + 1))
    }
  })

  mostrarMsgSimuladoAssunto(`Simulado gerado com ${formatarQuantidadeQuestoes(questoes.length)}.`, 'sucesso')
}

function criarCardSimplesSimuladoAssunto(q, numero) {
  const card = document.createElement('div')
  card.className = 'card-revisao'
  card.innerHTML = `
    <span class="revisao-numero">#${numero}</span>
    <p class="card-revisao-enunciado">${escaparHtmlSeguro(q.enunciado)}</p>
    <p class="tag-certa">Correta: ${escaparHtmlSeguro(q.alternativa_correta || '-')}</p>
  `
  return card
}

async function gerarRelatorioProntoProva() {
  const container = document.getElementById('relatorio-pronto-prova')
  if (!container) return

  try {
    const dados = await buscarDadosInteligentesPlanejamento()
    const relatorio = montarRelatorioProntoProva(dados)
    renderizarRelatorioProntoProva(relatorio)
  } catch (erro) {
    console.warn('Não foi possível atualizar o relatório de prova.', erro)
    container.innerHTML = '<p class="texto-placeholder">Execute os SQLs do edital e do planejamento para gerar o relatório.</p>'
  }
}

function montarRelatorioProntoProva(dados) {
  const totalTopicos = dados.topicos.length
  const dominados = dados.topicos.filter(t => t.status === 'dominado').length
  const criticos = dados.topicos.filter(t => ['dificuldade', 'revisar', 'nao_estudado'].includes(t.status))
  const questoes = dados.questoes
  const certas = dados.certas.reduce((acc, item) => acc + Number(item.quantidade || 0), 0)
  const erradas = questoes.filter(q => q.tipo_questao !== 'Chutada').length
  const chutadas = questoes.filter(q => q.tipo_questao === 'Chutada').length
  const vencidas = questoes.filter(q => q.status_revisao === 'pendente' && q.revisar_novamente_em && q.revisar_novamente_em <= dataPlanejamentoHoje()).length
  const leiPendentes = dados.leiSeca.filter(item => item.status !== 'dominado').length
  const totalQuestoes = certas + erradas + chutadas
  const aproveitamento = totalQuestoes > 0 ? Math.round((certas / totalQuestoes) * 100) : 0
  const dominio = totalTopicos > 0 ? Math.round((dominados / totalTopicos) * 100) : 0
  const revisaoScore = Math.max(0, 100 - vencidas * 6)
  const leiScore = dados.leiSeca.length > 0 ? Math.max(0, 100 - leiPendentes * 8) : 70
  const score = Math.round(dominio * 0.35 + aproveitamento * 0.3 + revisaoScore * 0.2 + leiScore * 0.15)

  return {
    score,
    dominio,
    aproveitamento,
    vencidas,
    leiPendentes,
    criticos,
    diasProva: calcularDiasAteProvaPlanejamento(dados.config?.data_prova),
    concurso: dados.config?.concurso_alvo || 'Concurso alvo'
  }
}

function renderizarRelatorioProntoProva(relatorio) {
  const container = document.getElementById('relatorio-pronto-prova')
  const situacao = relatorio.score >= 80 ? 'Boa preparação' : relatorio.score >= 60 ? 'Atenção estratégica' : 'Risco alto'
  const topicosCriticos = relatorio.criticos.slice(0, 8)

  container.innerHTML = `
    <div class="relatorio-prova-grid">
      <div class="relatorio-prova-bloco">
        <span class="pronto-score">${relatorio.score}%</span>
        <h4>${situacao}</h4>
        <p>${escaparHtmlSeguro(relatorio.concurso)}${relatorio.diasProva !== null ? ` · ${relatorio.diasProva} dia${relatorio.diasProva !== 1 ? 's' : ''} até a prova` : ''}</p>
      </div>
      <div class="relatorio-prova-bloco"><h4>Edital</h4><p>${relatorio.dominio}% dos assuntos dominados.</p></div>
      <div class="relatorio-prova-bloco"><h4>Desempenho</h4><p>${relatorio.aproveitamento}% de aproveitamento geral estimado.</p></div>
      <div class="relatorio-prova-bloco"><h4>Revisões</h4><p>${relatorio.vencidas} ${relatorio.vencidas === 1 ? 'questão vencida' : 'questões vencidas'}.</p></div>
      <div class="relatorio-prova-bloco"><h4>Lei Seca</h4><p>${relatorio.leiPendentes} item${relatorio.leiPendentes !== 1 ? 's' : ''} pendente${relatorio.leiPendentes !== 1 ? 's' : ''}.</p></div>
    </div>
    <div class="relatorio-prova-bloco">
      <h4>Assuntos críticos</h4>
      ${topicosCriticos.length > 0
        ? `<div class="questao-tags-estudo">${topicosCriticos.map(t => `<span class="tag-estudo">${escaparHtmlSeguro(t.titulo)} · ${escaparHtmlSeguro(t.materias?.nome || 'Sem matéria')}</span>`).join('')}</div>`
        : '<p>Nenhum assunto crítico marcado no edital.</p>'}
    </div>
  `
}

async function salvarItemLeiSeca() {
  const materiaId = document.getElementById('lei-materia').value || null
  const topicoId = document.getElementById('lei-topico').value || null
  const norma = document.getElementById('lei-norma').value.trim()
  const artigo = document.getElementById('lei-artigo').value.trim()
  const importancia = Number(document.getElementById('lei-importancia').value) || 3
  const texto = document.getElementById('lei-texto').value.trim()
  const anotacoes = document.getElementById('lei-anotacoes').value.trim()

  if (texto.length < 3) {
    mostrarMsgLeiSeca('Cole o texto literal para estudar.', 'erro')
    return
  }

  const { error } = await db.from('lei_seca_itens').insert({
    user_id: window.usuarioAtual.id,
    materia_id: materiaId,
    edital_topico_id: topicoId,
    norma: norma || null,
    artigo: artigo || null,
    texto,
    importancia,
    anotacoes: anotacoes || null,
    status: 'ler',
    revisar_em: dataPlanejamentoHoje()
  })

  if (error) {
    console.error(error)
    mostrarMsgLeiSeca('Erro ao salvar item de Lei Seca. Execute o SQL do planejamento.', 'erro')
    return
  }

  document.getElementById('lei-texto').value = ''
  document.getElementById('lei-anotacoes').value = ''
  mostrarMsgLeiSeca('Item de Lei Seca salvo.', 'sucesso')
  await carregarPlanejamento()
}

function renderizarLeiSeca() {
  const lista = document.getElementById('lista-lei-seca')
  if (!lista) return

  if (planejamentoEstado.leiSeca.length === 0) {
    lista.innerHTML = '<p class="texto-placeholder">Nenhum item de Lei Seca cadastrado ainda.</p>'
    return
  }

  const hoje = dataPlanejamentoHoje()
  const ordenados = [...planejamentoEstado.leiSeca].sort((a, b) => {
    const av = a.status !== 'dominado' && (!a.revisar_em || a.revisar_em <= hoje) ? 0 : 1
    const bv = b.status !== 'dominado' && (!b.revisar_em || b.revisar_em <= hoje) ? 0 : 1
    return av - bv
  })

  lista.innerHTML = ordenados.map(criarCardLeiSeca).join('')
  lista.querySelectorAll('.btn-lei-revisado').forEach(btn => {
    btn.addEventListener('click', () => registrarRevisaoLeiSeca(btn.dataset.id, true))
  })
  lista.querySelectorAll('.btn-lei-errei').forEach(btn => {
    btn.addEventListener('click', () => registrarRevisaoLeiSeca(btn.dataset.id, false))
  })
  lista.querySelectorAll('.btn-lei-excluir').forEach(btn => {
    btn.addEventListener('click', () => excluirItemLeiSeca(btn.dataset.id))
  })
}

function criarCardLeiSeca(item) {
  const vencido = item.status !== 'dominado' && (!item.revisar_em || item.revisar_em <= dataPlanejamentoHoje())
  return `
    <article class="lei-seca-card">
      <div class="lei-seca-topo">
        <div>
          <strong>${escaparHtmlSeguro([item.norma, item.artigo].filter(Boolean).join(' · ') || 'Lei Seca')}</strong>
          <p class="lei-seca-meta">${escaparHtmlSeguro(item.materias?.nome || 'Sem matéria')}${item.edital_topicos?.titulo ? ` · ${escaparHtmlSeguro(item.edital_topicos.titulo)}` : ''}</p>
        </div>
        <span class="tag-estudo">${vencido ? 'Revisar hoje' : item.status}</span>
      </div>
      <p class="lei-seca-texto">${escaparHtmlSeguro(item.texto)}</p>
      ${item.anotacoes ? `<p class="lei-seca-meta">${escaparHtmlSeguro(item.anotacoes)}</p>` : ''}
      <div class="questao-tags-estudo">
        <span class="tag-estudo">Importância ${item.importancia}</span>
        <span class="tag-estudo">${item.total_revisoes} revisões</span>
        <span class="tag-estudo">${item.total_erros} erros</span>
        ${item.revisar_em ? `<span class="tag-estudo">Revisar: ${formatarDataPlanejamento(item.revisar_em)}</span>` : ''}
      </div>
      <div class="lei-seca-acoes">
        <button class="btn-secundario btn-lei-revisado" type="button" data-id="${item.id}">Revisei</button>
        <button class="btn-secundario btn-lei-errei" type="button" data-id="${item.id}">Errei literalidade</button>
        <button class="btn-secundario btn-lei-excluir" type="button" data-id="${item.id}">Excluir</button>
      </div>
    </article>
  `
}

async function registrarRevisaoLeiSeca(id, acertou) {
  const item = planejamentoEstado.leiSeca.find(i => i.id === id)
  if (!item) return

  const hoje = dataPlanejamentoHoje()
  const etapaAtual = Number(item.revisao_etapa || 0)
  const proximaEtapa = acertou ? Math.min(etapaAtual + 1, 3) : 0
  const proximaData = acertou
    ? etapaAtual <= 0
      ? adicionarDiasPlanejamento(hoje, 7)
      : etapaAtual === 1
        ? adicionarDiasPlanejamento(hoje, 30)
        : null
    : adicionarDiasPlanejamento(hoje, 1)

  const { error } = await db
    .from('lei_seca_itens')
    .update({
      status: acertou && !proximaData ? 'dominado' : 'revisar',
      revisao_etapa: proximaEtapa,
      revisar_em: proximaData,
      ultima_revisao: hoje,
      total_revisoes: Number(item.total_revisoes || 0) + 1,
      total_erros: Number(item.total_erros || 0) + (acertou ? 0 : 1),
      atualizado_em: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)

  if (error) {
    mostrarMsgLeiSeca('Erro ao registrar revisão de Lei Seca.', 'erro')
    return
  }

  mostrarMsgLeiSeca(acertou ? 'Revisão registrada.' : 'Erro registrado. O item volta amanhã.', 'sucesso')
  await carregarPlanejamento()
}

async function excluirItemLeiSeca(id) {
  if (!confirm('Deseja excluir este item de Lei Seca?')) return

  const { error } = await db
    .from('lei_seca_itens')
    .delete()
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)

  if (error) {
    mostrarMsgLeiSeca('Erro ao excluir item.', 'erro')
    return
  }

  mostrarMsgLeiSeca('Item excluído.', 'sucesso')
  await carregarPlanejamento()
}

function converterDiaSemanaPlanejamento(dataISO) {
  const dia = new Date(`${dataISO}T12:00:00`).getDay()
  return dia === 0 ? 7 : dia
}

function calcularDiasAteProvaPlanejamento(dataProva) {
  if (!dataProva) return null
  const hoje = new Date(`${dataPlanejamentoHoje()}T00:00:00`)
  const prova = new Date(`${dataProva}T00:00:00`)
  return Math.ceil((prova - hoje) / 86400000)
}

function adicionarDiasPlanejamento(dataISO, dias) {
  const data = new Date(`${dataISO}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return dataPlanejamentoISO(data)
}

function dataPlanejamentoHoje() {
  return dataPlanejamentoISO(new Date())
}

function dataPlanejamentoISO(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function formatarDataPlanejamento(dataISO) {
  return new Date(`${dataISO}T12:00:00`).toLocaleDateString('pt-BR')
}

function embaralharPlanejamento(lista) {
  return [...lista].sort(() => Math.random() - 0.5)
}

function mostrarMsgPlanejamento(texto, tipo) {
  const msg = document.getElementById('msg-planejamento')
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo || ''}`
}

function mostrarMsgSimuladoAssunto(texto, tipo) {
  const msg = document.getElementById('msg-simulado-assunto')
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo || ''}`
}

function mostrarMsgLeiSeca(texto, tipo) {
  const msg = document.getElementById('msg-lei-seca')
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo || ''}`
}

function mostrarErroPlanejamento(mensagem) {
  ;['planejamento-semanal-grade', 'fila-inteligente-resultado', 'lista-lei-seca', 'relatorio-pronto-prova'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.innerHTML = `<p class="texto-placeholder">${escaparHtmlSeguro(mensagem)}</p>`
  })
}
