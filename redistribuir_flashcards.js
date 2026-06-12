import { pathToFileURL } from 'node:url'

const DATA_BASE_PADRAO = '2026-06-12'
const DATA_INICIAL_PADRAO = '2026-06-15'
const CARDS_POR_DIA_PADRAO = 50
const CARDS_POR_REQUISICAO = 50
const CARDS_POR_PAGINA = 1000
const QUANTIDADE_EXEMPLOS = 10

function obterVariavelAmbiente(nome) {
  return String(process.env[nome] || '').trim()
}

function dataISO(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

export function adicionarDiasRedistribuicaoFlashcards(dataBase, dias) {
  const data = new Date(`${dataBase}T12:00:00`)
  data.setDate(data.getDate() + Number(dias || 0))
  return dataISO(data)
}

export function calcularNovaDueDateFlashcard(indice, dataInicial = DATA_INICIAL_PADRAO, cardsPorDia = CARDS_POR_DIA_PADRAO) {
  const indiceNumerico = Number(indice)
  const limiteDiario = Number(cardsPorDia)

  if (!Number.isInteger(indiceNumerico) || indiceNumerico < 0) {
    throw new Error('Indice do card deve ser um inteiro nao negativo.')
  }

  if (!Number.isInteger(limiteDiario) || limiteDiario <= 0) {
    throw new Error('CARDS_POR_DIA deve ser um inteiro positivo.')
  }

  return adicionarDiasRedistribuicaoFlashcards(dataInicial, Math.floor(indiceNumerico / limiteDiario))
}

function normalizarCardsPorDia(valor) {
  if (!valor) return CARDS_POR_DIA_PADRAO

  const cardsPorDia = Number(valor)
  if (!Number.isInteger(cardsPorDia) || cardsPorDia <= 0) {
    throw new Error('CARDS_POR_DIA deve ser um inteiro positivo.')
  }

  return cardsPorDia
}

function redistribuicaoConfirmada() {
  return obterVariavelAmbiente('CONFIRMAR_REDISTRIBUICAO').toUpperCase() === 'SIM'
}

function obterConfiguracao() {
  const supabaseUrl = obterVariavelAmbiente('SUPABASE_URL').replace(/\/+$/, '')
  const supabaseServiceKey =
    obterVariavelAmbiente('SUPABASE_SERVICE_ROLE_KEY') ||
    obterVariavelAmbiente('SUPABASE_SERVICE_KEY')
  const userId = obterVariavelAmbiente('USER_ID')
  const cardsPorDia = normalizarCardsPorDia(obterVariavelAmbiente('CARDS_POR_DIA'))

  if (!supabaseUrl) throw new Error('SUPABASE_URL nao informado.')
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY nao informado. SUPABASE_SERVICE_KEY tambem e aceito por compatibilidade.')
  }
  if (!userId) throw new Error('USER_ID nao informado. O script sempre exige usuario alvo.')

  return {
    supabaseUrl,
    supabaseServiceKey,
    userId,
    cardsPorDia,
    dataBase: DATA_BASE_PADRAO,
    dataInicial: DATA_INICIAL_PADRAO,
    aplicar: redistribuicaoConfirmada()
  }
}

async function chamarSupabase(config, caminho, opcoes = {}) {
  const metodo = opcoes.metodo || 'GET'
  const headers = {
    apikey: config.supabaseServiceKey,
    Authorization: `Bearer ${config.supabaseServiceKey}`,
    'Content-Type': 'application/json',
    ...(opcoes.headers || {})
  }

  if (metodo === 'PATCH') headers.Prefer = 'return=representation'

  const resposta = await fetch(`${config.supabaseUrl}/rest/v1/${caminho}`, {
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

function montarQueryCardsAcumulados(config) {
  const parametros = new URLSearchParams()
  parametros.set('select', 'id,due_date,created_at')
  parametros.set('user_id', `eq.${config.userId}`)
  parametros.set('ativo', 'eq.true')
  parametros.set('due_date', `lte.${config.dataBase}`)
  parametros.set('order', 'due_date.asc,created_at.asc,id.asc')
  return `flashcards?${parametros.toString()}`
}

async function buscarCardsAcumulados(config) {
  const caminho = montarQueryCardsAcumulados(config)
  const cards = []
  let inicio = 0

  while (true) {
    const fim = inicio + CARDS_POR_PAGINA - 1
    const pagina = await chamarSupabase(config, caminho, {
      headers: {
        Range: `${inicio}-${fim}`,
        'Range-Unit': 'items'
      }
    })

    cards.push(...pagina)
    if (!Array.isArray(pagina) || pagina.length < CARDS_POR_PAGINA) break
    inicio += CARDS_POR_PAGINA
  }

  return cards
}

export function montarPlanoRedistribuicaoFlashcards(
  cards,
  dataInicial = DATA_INICIAL_PADRAO,
  cardsPorDia = CARDS_POR_DIA_PADRAO
) {
  return (Array.isArray(cards) ? cards : []).map((card, indice) => ({
    id: card.id,
    dueDateAtual: String(card.due_date || '').slice(0, 10),
    novaDueDate: calcularNovaDueDateFlashcard(indice, dataInicial, cardsPorDia)
  }))
}

function contarPorData(lista, campo) {
  const totais = new Map()

  for (const item of lista) {
    const data = String(item?.[campo] || 'sem-data').slice(0, 10) || 'sem-data'
    totais.set(data, (totais.get(data) || 0) + 1)
  }

  return [...totais.entries()].sort(([dataA], [dataB]) => dataA.localeCompare(dataB))
}

function imprimirDistribuicao(titulo, distribuicao) {
  console.log(titulo)

  if (distribuicao.length === 0) {
    console.log('- nenhuma data encontrada')
    return
  }

  distribuicao.forEach(([data, total]) => {
    console.log(`- ${data}: ${total}`)
  })
}

function imprimirExemplos(plano) {
  console.log('Exemplos de redistribuicao:')

  if (plano.length === 0) {
    console.log('- nenhum card encontrado')
    return
  }

  plano.slice(0, QUANTIDADE_EXEMPLOS).forEach(item => {
    console.log(`- id=${item.id} | due_date atual=${item.dueDateAtual} | nova due_date=${item.novaDueDate}`)
  })
}

function imprimirResumo(config, cards, plano) {
  console.log('Plano temporario de redistribuicao de flashcards')
  console.log(`Total de cards encontrados: ${cards.length}`)
  console.log(`Data base usada: ${config.dataBase}`)
  console.log(`Data inicial da redistribuicao: ${config.dataInicial}`)
  console.log(`Limite de cards por dia: ${config.cardsPorDia}`)
  console.log(`Modo: ${config.aplicar ? 'APLICACAO REAL CONFIRMADA' : 'DRY-RUN'}`)
  console.log('')

  imprimirDistribuicao('Distribuicao atual por due_date:', contarPorData(cards, 'due_date'))
  console.log('')
  imprimirDistribuicao('Distribuicao proposta por nova due_date:', contarPorData(plano, 'novaDueDate'))
  console.log('')
  imprimirExemplos(plano)
}

function dividirEmLotes(lista, tamanho) {
  const lotes = []
  for (let indice = 0; indice < lista.length; indice += tamanho) {
    lotes.push(lista.slice(indice, indice + tamanho))
  }
  return lotes
}

async function atualizarGrupo(config, novaDueDate, itens) {
  let atualizados = 0

  for (const lote of dividirEmLotes(itens, CARDS_POR_REQUISICAO)) {
    const parametros = new URLSearchParams()
    parametros.set('id', `in.(${lote.map(item => item.id).join(',')})`)
    parametros.set('user_id', `eq.${config.userId}`)
    parametros.set('ativo', 'eq.true')
    parametros.set('due_date', `lte.${config.dataBase}`)

    const resposta = await chamarSupabase(config, `flashcards?${parametros.toString()}`, {
      metodo: 'PATCH',
      corpo: { due_date: novaDueDate }
    })

    atualizados += Array.isArray(resposta) ? resposta.length : 0
  }

  return atualizados
}

async function aplicarRedistribuicao(config, plano) {
  const grupos = new Map()

  for (const item of plano) {
    if (!grupos.has(item.novaDueDate)) grupos.set(item.novaDueDate, [])
    grupos.get(item.novaDueDate).push(item)
  }

  let totalAtualizados = 0

  for (const [novaDueDate, itens] of grupos.entries()) {
    const atualizados = await atualizarGrupo(config, novaDueDate, itens)
    totalAtualizados += atualizados
    console.log(`Atualizados ${atualizados} card(s) para ${novaDueDate}.`)
  }

  return totalAtualizados
}

async function main() {
  const config = obterConfiguracao()
  const cards = await buscarCardsAcumulados(config)
  const plano = montarPlanoRedistribuicaoFlashcards(cards, config.dataInicial, config.cardsPorDia)

  imprimirResumo(config, cards, plano)

  if (!config.aplicar) {
    console.log('')
    console.log('DRY-RUN CONCLUIDO: nenhum dado foi alterado.')
    console.log('Para aplicar de verdade, execute novamente com CONFIRMAR_REDISTRIBUICAO=SIM.')
    return
  }

  console.log('')
  console.log('CONFIRMAR_REDISTRIBUICAO=SIM detectado. Aplicando atualizacao real somente em flashcards.due_date...')
  const totalAtualizados = await aplicarRedistribuicao(config, plano)
  console.log(`Concluido. Total de cards atualizados: ${totalAtualizados}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(erro => {
    console.error(`Erro: ${erro.message}`)
    process.exit(1)
  })
}
