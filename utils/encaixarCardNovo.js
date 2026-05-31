(function () {
  const LIMITE_DIARIO_TEMPORARIO = 50
  const DIAS_JANELA_TEMPORARIA = 14

  function obterClienteSupabaseEncaixeFlashcard() {
    if (typeof globalThis !== 'undefined' && globalThis.db) return globalThis.db
    if (typeof window !== 'undefined' && window.db) return window.db
    if (typeof db !== 'undefined') return db
    return null
  }

  function dataISOEncaixeFlashcard(data) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
  }

  function dataHojeEncaixeFlashcard() {
    return dataISOEncaixeFlashcard(new Date())
  }

  function adicionarDiasEncaixeFlashcard(dataISO, dias) {
    const data = new Date(`${dataISO}T12:00:00`)
    data.setDate(data.getDate() + Number(dias || 0))
    return dataISOEncaixeFlashcard(data)
  }

  function criarErroEncaixeFlashcard(mensagem, detalhes = null) {
    const erro = new Error(mensagem)
    if (detalhes) erro.detalhes = detalhes
    return erro
  }

  async function calcularDueDateEncaixeFlashcard(userId, opcoes = {}) {
    const usuarioId = String(userId || '').trim()
    if (!usuarioId) {
      throw criarErroEncaixeFlashcard('Usuario nao informado para encaixar o flashcard.')
    }

    const cliente = opcoes.cliente || obterClienteSupabaseEncaixeFlashcard()
    if (!cliente) {
      throw criarErroEncaixeFlashcard('Configuracao do Supabase nao encontrada para encaixar o flashcard.')
    }

    const hoje = opcoes.hoje || dataHojeEncaixeFlashcard()
    const dataLimite = adicionarDiasEncaixeFlashcard(hoje, DIAS_JANELA_TEMPORARIA - 1)

    const resposta = await cliente
      .from('flashcards')
      .select('due_date')
      .eq('user_id', usuarioId)
      .eq('ativo', true)
      .gte('due_date', hoje)
      .lte('due_date', dataLimite)

    if (resposta.error) {
      throw criarErroEncaixeFlashcard('Nao foi possivel contar os flashcards agendados.', resposta.error)
    }

    const contagemPorData = new Map()
    for (let indice = 0; indice < DIAS_JANELA_TEMPORARIA; indice += 1) {
      contagemPorData.set(adicionarDiasEncaixeFlashcard(hoje, indice), 0)
    }

    for (const card of resposta.data || []) {
      const dueDate = String(card?.due_date || '').substring(0, 10)
      if (contagemPorData.has(dueDate)) {
        contagemPorData.set(dueDate, contagemPorData.get(dueDate) + 1)
      }
    }

    for (const [data, total] of contagemPorData.entries()) {
      if (total < LIMITE_DIARIO_TEMPORARIO) return data
    }

    return adicionarDiasEncaixeFlashcard(hoje, DIAS_JANELA_TEMPORARIA)
  }

  async function encaixarCardNovo(cardId, userId, opcoes = {}) {
    const id = String(cardId || '').trim()
    if (!id) {
      return { data: null, error: criarErroEncaixeFlashcard('Flashcard nao informado para encaixe.') }
    }

    const cliente = opcoes.cliente || obterClienteSupabaseEncaixeFlashcard()
    if (!cliente) {
      return { data: null, error: criarErroEncaixeFlashcard('Configuracao do Supabase nao encontrada para encaixar o flashcard.') }
    }

    let dueDate
    try {
      dueDate = await calcularDueDateEncaixeFlashcard(userId, { ...opcoes, cliente })
    } catch (erro) {
      return { data: null, error: erro }
    }

    const resposta = await cliente
      .from('flashcards')
      .update({ due_date: dueDate })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, due_date')
      .single()

    if (resposta.error) {
      return {
        data: null,
        error: criarErroEncaixeFlashcard('Nao foi possivel encaixar o flashcard novo.', resposta.error)
      }
    }

    return resposta
  }

  if (typeof globalThis !== 'undefined') {
    // TEMPORÁRIO — remover após redistribuição resolvida
    globalThis.calcularDueDateEncaixeFlashcard = calcularDueDateEncaixeFlashcard
    globalThis.encaixarCardNovo = encaixarCardNovo
  }
})()
