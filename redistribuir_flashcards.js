const LIMITE_DIARIO = 50
const FLASHCARDS_POR_REQUISICAO = 50

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
const SUPABASE_SERVICE_KEY = String(process.env.SUPABASE_SERVICE_KEY || '').trim()
const USER_ID_ALVO = String(process.env.FLASHCARDS_USER_ID || process.env.USER_ID || '').trim()
const CONFIRMACAO_REDISTRIBUICAO = String(process.env.CONFIRMAR_REDISTRIBUICAO || '').trim().toUpperCase()

function abortar(mensagem) {
  console.error(`Erro: ${mensagem}`)
  process.exit(1)
}

function validarAmbiente() {
  if (!SUPABASE_URL) abortar('SUPABASE_URL nao informado.')
  if (!SUPABASE_SERVICE_KEY) abortar('SUPABASE_SERVICE_KEY nao informado. Use a service_role key, nunca anon key.')
  if (!USER_ID_ALVO) abortar('Informe FLASHCARDS_USER_ID ou USER_ID para filtrar o usuario alvo.')
}

function redistribuicaoConfirmada() {
  return CONFIRMACAO_REDISTRIBUICAO === 'SIM'
}

function dataISO(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function dataHojeLocal() {
  return dataISO(new Date())
}

function adicionarDias(dataBase, dias) {
  const data = new Date(`${dataBase}T12:00:00`)
  data.setDate(data.getDate() + Number(dias || 0))
  return dataISO(data)
}

async function chamarSupabase(caminho, opcoes = {}) {
  const metodo = opcoes.metodo || 'GET'
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  }

  if (metodo === 'PATCH') {
    headers.Prefer = 'return=representation'
  }

  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    method: metodo,
    headers,
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined
  })

  const texto = await resposta.text()
  let dados = null
  if (texto) {
    try {
      dados = JSON.parse(texto)
    } catch {
      dados = texto
    }
  }

  if (!resposta.ok) {
    const detalhe = typeof dados === 'string' ? dados : JSON.stringify(dados)
    throw new Error(`Supabase retornou HTTP ${resposta.status}: ${detalhe}`)
  }

  return dados || []
}

async function buscarCardsVencidos(hoje, usarCreatedAt = true) {
  const parametros = new URLSearchParams()
  parametros.set('select', usarCreatedAt ? 'id,due_date,created_at' : 'id,due_date')
  parametros.set('user_id', `eq.${USER_ID_ALVO}`)
  parametros.set('ativo', 'eq.true')
  parametros.set('due_date', `lte.${hoje}`)
  parametros.set('order', usarCreatedAt ? 'due_date.asc,created_at.asc,id.asc' : 'due_date.asc,id.asc')

  return chamarSupabase(`flashcards?${parametros.toString()}`)
}

async function buscarCardsVencidosComFallback(hoje) {
  try {
    return await buscarCardsVencidos(hoje, true)
  } catch (erro) {
    if (!String(erro.message || '').includes('created_at')) throw erro
    console.warn('Aviso: coluna created_at indisponivel. Repetindo ordenacao por due_date e id.')
    return buscarCardsVencidos(hoje, false)
  }
}

function montarPlano(cards, hoje) {
  const grupos = []

  cards.forEach((card, indice) => {
    const indiceGrupo = Math.floor(indice / LIMITE_DIARIO)
    if (!grupos[indiceGrupo]) {
      grupos[indiceGrupo] = {
        data: adicionarDias(hoje, indiceGrupo),
        cards: []
      }
    }
    grupos[indiceGrupo].cards.push(card)
  })

  return grupos
}

function exibirPlano(cards, grupos) {
  console.log('Plano de redistribuicao de flashcards')
  console.log(`Total de cards encontrados: ${cards.length}`)

  if (grupos.length === 0) {
    console.log('Nenhum card vencido ou devido hoje foi encontrado para redistribuir.')
    return
  }

  console.log('Quantidade por data:')
  grupos.forEach((grupo) => {
    console.log(`- ${grupo.data}: ${grupo.cards.length}`)
  })
  console.log(`Intervalo de datas afetado: ${grupos[0].data} ate ${grupos[grupos.length - 1].data}`)
}

function dividirEmLotes(lista, tamanho) {
  const lotes = []
  for (let indice = 0; indice < lista.length; indice += tamanho) {
    lotes.push(lista.slice(indice, indice + tamanho))
  }
  return lotes
}

async function atualizarGrupo(grupo, hoje) {
  let atualizados = 0
  const lotes = dividirEmLotes(grupo.cards, FLASHCARDS_POR_REQUISICAO)

  for (const lote of lotes) {
    const parametros = new URLSearchParams()
    parametros.set('id', `in.(${lote.map(card => card.id).join(',')})`)
    parametros.set('user_id', `eq.${USER_ID_ALVO}`)
    parametros.set('ativo', 'eq.true')
    parametros.set('due_date', `lte.${hoje}`)

    const resposta = await chamarSupabase(`flashcards?${parametros.toString()}`, {
      metodo: 'PATCH',
      corpo: { due_date: grupo.data }
    })

    atualizados += Array.isArray(resposta) ? resposta.length : 0
  }

  return atualizados
}

async function main() {
  validarAmbiente()

  const hoje = dataHojeLocal()
  const cards = await buscarCardsVencidosComFallback(hoje)
  const grupos = montarPlano(cards, hoje)

  exibirPlano(cards, grupos)

  if (!redistribuicaoConfirmada()) {
    console.log('PREVIA CONCLUIDA: nenhum card foi atualizado.')
    console.log('Para aplicar os updates reais, defina CONFIRMAR_REDISTRIBUICAO=SIM e execute novamente.')
    return
  }

  let totalAtualizados = 0
  for (const grupo of grupos) {
    try {
      const atualizados = await atualizarGrupo(grupo, hoje)
      totalAtualizados += atualizados
      console.log(`Atualizados ${atualizados} card(s) para ${grupo.data}.`)
    } catch (erro) {
      console.error(`Erro ao atualizar cards para ${grupo.data}: ${erro.message}`)
      process.exit(1)
    }
  }

  console.log(`Concluido. Total de cards atualizados com sucesso: ${totalAtualizados}`)
}

main().catch((erro) => {
  console.error(`Erro inesperado: ${erro.message}`)
  process.exit(1)
})
