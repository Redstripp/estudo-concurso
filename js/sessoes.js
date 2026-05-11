// js/sessoes.js

let desempenhoInicializado = false

// ============================================
// INICIALIZAR MÓDULO (só roda uma vez)
// ============================================
function inicializarDesempenho() {
  if (desempenhoInicializado) {
    carregarDesempenho()
    return
  }
  desempenhoInicializado = true
  carregarDesempenho()
}

// ============================================
// CARREGAR DESEMPENHO COMPLETO
// ============================================
async function carregarDesempenho() {
  const lista       = document.getElementById('lista-sessoes')
  const placeholder = document.getElementById('placeholder-sessoes')

  placeholder.textContent   = '⏳ Carregando histórico...'
  placeholder.style.display = 'block'
  lista.innerHTML           = ''
  lista.appendChild(placeholder)

  const { data: sessoes, error: erroSessoes } = await db
    .from('sessoes_estudo')
    .select('id, data')
    .eq('user_id', window.usuarioAtual.id)
    .order('data', { ascending: false })

  if (erroSessoes || !sessoes || sessoes.length === 0) {
    placeholder.textContent = '📅 Nenhuma sessão de estudo registrada ainda.'
    atualizarResumoTopo(0, 0)
    return
  }

  // Busca questões para revisão
  const { data: erradas } = await db
    .from('questoes')
    .select('sessao_id, materia_id, materias(nome)')
    .eq('user_id', window.usuarioAtual.id)

  // Busca questões certas (com id para poder editar/excluir)
  const { data: certas } = await db
    .from('questoes_certas')
    .select('id, sessao_id, materia_id, quantidade, materias(nome)')
    .eq('user_id', window.usuarioAtual.id)

  // Agrupa por sessão
  const erradasPorSessao = {}
  ;(erradas || []).forEach(q => {
    if (!erradasPorSessao[q.sessao_id]) erradasPorSessao[q.sessao_id] = []
    erradasPorSessao[q.sessao_id].push(q)
  })

  const certasPorSessao = {}
  ;(certas || []).forEach(q => {
    if (!certasPorSessao[q.sessao_id]) certasPorSessao[q.sessao_id] = []
    certasPorSessao[q.sessao_id].push(q)
  })

  // Totais gerais
  const totalErradas = (erradas || []).length
  const totalCertas  = (certas  || []).reduce((acc, q) => acc + q.quantidade, 0)
  atualizarResumoTopo(sessoes.length, totalErradas + totalCertas)

  placeholder.style.display = 'none'

  sessoes.forEach(sessao => {
    const card = criarCardSessao(
      sessao,
      erradasPorSessao[sessao.id] || [],
      certasPorSessao[sessao.id]  || []
    )
    lista.appendChild(card)
  })
}

// ============================================
// ATUALIZAR RESUMO DO TOPO
// ============================================
function atualizarResumoTopo(totalDias, totalGeral) {
  document.getElementById('total-dias').textContent           = totalDias
  document.getElementById('total-questoes-geral').textContent = totalGeral

  const media = totalDias > 0
    ? (totalGeral / totalDias).toFixed(1)
    : '0'
  document.getElementById('media-dia').textContent = media
}

// ============================================
// CRIAR CARD DE SESSÃO
// ============================================
function criarCardSessao(sessao, erradas, certas) {
  const card = document.createElement('div')
  card.className    = 'card-sessao'
  card.dataset.sessaoId = sessao.id

  const [ano, mes, dia] = sessao.data.split('-')
  const dataFormatada   = `${dia}/${mes}/${ano}`

  const agora     = new Date()
  const hoje      = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
  const ehHoje    = sessao.data === hoje
  const badgeHoje = ehHoje ? '<span class="badge-hoje">Hoje</span>' : ''

  const totalErradas = erradas.length
  const totalCertas  = certas.reduce((acc, q) => acc + q.quantidade, 0)
  const totalSessao  = totalErradas + totalCertas

  card.innerHTML = `
    <div class="card-sessao-topo">
      <div class="card-sessao-data-grupo">
        <span class="card-sessao-data">📅 ${dataFormatada}</span>
        ${badgeHoje}
      </div>
      <div class="card-sessao-resumo-nums">
        <span class="resumo-total-sessao">${totalSessao} feitas</span>
        <span class="resumo-certa-sessao">✅ ${totalCertas}</span>
        <span class="resumo-errada-sessao">❌ ${totalErradas}</span>
      </div>
    </div>
    <div class="card-sessao-materias" id="materias-sessao-${sessao.id}">
      ${renderizarLinhasMaterias(erradas, certas, sessao.id)}
    </div>
  `

  return card
}

// ============================================
// RENDERIZAR LINHAS DE MATÉRIA
// ============================================
function renderizarLinhasMaterias(erradas, certas, sessaoId) {
  const erradasPorMateria = {}
  erradas.forEach(q => {
    const nome = q.materias?.nome || 'Sem matéria'
    erradasPorMateria[nome] = (erradasPorMateria[nome] || 0) + 1
  })

  const todasMaterias = new Set([
    ...Object.keys(erradasPorMateria),
    ...certas.map(q => q.materias?.nome || 'Sem matéria')
  ])

  if (todasMaterias.size === 0) {
    return '<p class="sem-materias">Nenhuma questão registrada nesta sessão.</p>'
  }

  return Array.from(todasMaterias).map(nome => {
    const qtdErradas = erradasPorMateria[nome] || 0

    const registrosCertas = certas.filter(q => (q.materias?.nome || 'Sem matéria') === nome)
    const qtdCertasTotal  = registrosCertas.reduce((acc, q) => acc + q.quantidade, 0)

    // Cada registro de certa tem seus próprios botões de editar/excluir
    const linhasRegistros = registrosCertas.map(reg => `
      <div class="registro-certa-linha" id="registro-${reg.id}">
        <span class="registro-certa-qtd">✅ ${reg.quantidade} certas registradas</span>
        <div class="registro-certa-acoes">
          <button class="btn-acao-mini btn-editar-acerto"
            data-id="${reg.id}"
            data-qtd="${reg.quantidade}"
            type="button"
            title="Editar quantidade">✏️</button>
          <button class="btn-acao-mini btn-excluir-acerto"
            data-id="${reg.id}"
            data-sessao="${sessaoId}"
            type="button"
            title="Excluir registro">🗑️</button>
        </div>
      </div>
    `).join('')

    return `
      <div class="sessao-materia-bloco">
        <div class="sessao-materia-cabecalho">
          <span class="sessao-materia-nome">${escaparHtmlSeguro(nome)}</span>
          <span class="sessao-materia-stats">
            <span class="stat-total">${qtdErradas + qtdCertasTotal} feitas</span>
            <span class="stat-certa">✅ ${qtdCertasTotal}</span>
            <span class="stat-errada">❌ ${qtdErradas}</span>
          </span>
        </div>
        ${linhasRegistros}
      </div>
    `
  }).join('')
}

// ============================================
// EVENTOS DELEGADOS — editar e excluir acertos
// ============================================
document.addEventListener('click', async (e) => {

  // ── EXCLUIR ──────────────────────────────
  if (e.target.closest('.btn-excluir-acerto')) {
    const btn      = e.target.closest('.btn-excluir-acerto')
    const id       = btn.dataset.id

    if (!confirm('Excluir este registro de acertos?')) return

    const { error } = await db
      .from('questoes_certas')
      .delete()
      .eq('id', id)
      .eq('user_id', window.usuarioAtual.id)

    if (error) {
      alert('Erro ao excluir. Tente novamente.')
      return
    }

    carregarDesempenho()
    return
  }

  // ── EDITAR ───────────────────────────────
  if (e.target.closest('.btn-editar-acerto')) {
    const btn      = e.target.closest('.btn-editar-acerto')
    const id       = btn.dataset.id
    const qtdAtual = parseInt(btn.dataset.qtd)

    abrirModalEdicaoAcerto(id, qtdAtual)
    return
  }
})

// ============================================
// MODAL DE EDIÇÃO DE ACERTO
// ============================================
function abrirModalEdicaoAcerto(id, qtdAtual) {
  document.getElementById('modal-acerto-edicao')?.remove()

  const modal = document.createElement('div')
  modal.id        = 'modal-acerto-edicao'
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal-caixa" style="max-width: 360px;">
      <div class="modal-topo">
        <h3>✏️ Editar quantidade</h3>
        <button class="modal-fechar" id="btn-fechar-modal-acerto" type="button">✕</button>
      </div>
      <div class="campo-form">
        <label class="campo-label">Nova quantidade de acertos</label>
        <input
          type="number"
          id="input-nova-qtd"
          class="input-texto"
          value="${qtdAtual}"
          min="1"
          max="999"
        />
      </div>
      <button class="btn-primario" id="btn-confirmar-edicao-acerto" type="button">
        💾 Salvar
      </button>
      <p class="msg-materia" id="msg-edicao-acerto"></p>
    </div>
  `

  document.body.appendChild(modal)

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove()
  })
  document.getElementById('btn-fechar-modal-acerto')
    .addEventListener('click', () => modal.remove())

  document.getElementById('btn-confirmar-edicao-acerto')
    .addEventListener('click', async () => {
      const novaQtd = parseInt(document.getElementById('input-nova-qtd').value)

      if (!novaQtd || novaQtd < 1) {
        const msg = document.getElementById('msg-edicao-acerto')
        msg.textContent = 'Digite uma quantidade válida.'
        msg.className   = 'msg-materia erro'
        return
      }

      const { error } = await db
        .from('questoes_certas')
        .update({ quantidade: novaQtd })
        .eq('id', id)
        .eq('user_id', window.usuarioAtual.id)

      if (error) {
        const msg = document.getElementById('msg-edicao-acerto')
        msg.textContent = 'Erro ao salvar. Tente novamente.'
        msg.className   = 'msg-materia erro'
        return
      }

      modal.remove()
      carregarDesempenho()
    })
}
