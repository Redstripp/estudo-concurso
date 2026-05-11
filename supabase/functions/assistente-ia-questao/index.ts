import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

type QuestaoPayload = {
  materia?: string
  assunto_edital?: string
  materias_disponiveis?: string[]
  assuntos_disponiveis?: string[]
  banca?: string
  tipo_questao?: string
  motivos_disponiveis?: string[]
  niveis_confianca_disponiveis?: string[]
  motivo_atual?: string
  nivel_confianca_atual?: string
  enunciado?: string
  alternativas?: Record<string, string>
  alternativas_formatadas?: string
  alternativa_marcada?: string
  alternativa_correta?: string
  comentario?: string
  pegadinhas_atuais?: string
  conceito_atual?: string
  reconhecer_atual?: string
  acao_atual?: string
}

type CotaIA = {
  permitido: boolean
  usado: number
  limite: number
  restante: number
  data: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return responderJson({ ok: true })
  }

  if (req.method !== 'POST') {
    return responderJson({ erro: 'Metodo nao permitido.' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const serviceKey = obterServiceRoleKey()
    const authHeader = req.headers.get('Authorization') || ''
    const usuario = await obterUsuarioAutenticado(supabaseUrl, supabaseAnonKey, authHeader)
    const { questao } = await req.json()
    const questaoLimpa = sanitizarQuestao(questao || {})

    if (!questaoLimpa.enunciado && !questaoLimpa.comentario && !questaoLimpa.alternativas_formatadas) {
      return responderJson({ erro: 'Envie enunciado, alternativas ou comentario para analise.' }, 400)
    }

    validarConfiguracaoIA()

    const limiteDiario = Math.max(1, Number(Deno.env.get('IA_LIMITE_DIARIO') || 20))
    const cota = await consumirCotaIA(supabaseUrl, serviceKey, usuario.id, limiteDiario)

    if (!cota.permitido) {
      return responderJson({
        erro: 'Limite diario de analises com IA atingido.',
        cota
      }, 429)
    }

    const campos = await chamarModeloIA(questaoLimpa)

    return responderJson({
      campos,
      cota
    })
  } catch (erro) {
    console.error('Erro na assistente de IA:', erro)
    return responderJson({
      erro: erro instanceof Error ? erro.message : 'Erro inesperado na assistente de IA.'
    }, definirStatusErro(erro))
  }
})

function responderJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8'
    }
  })
}

async function obterUsuarioAutenticado(supabaseUrl: string, anonKey: string, authHeader: string) {
  if (!supabaseUrl || !anonKey) throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY ausente na Edge Function.')
  if (!authHeader.toLowerCase().startsWith('bearer ')) throw new Error('Usuario nao autenticado.')

  const resposta = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authHeader
    }
  })

  if (!resposta.ok) throw new Error('Nao foi possivel validar a sessao do usuario.')

  return await resposta.json()
}

function obterServiceRoleKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!secretKeys) throw new Error('Configure SUPABASE_SERVICE_ROLE_KEY nos secrets da Edge Function.')

  try {
    const parsed = JSON.parse(secretKeys)
    const candidatos = [
      parsed.service_role,
      parsed.serviceRole,
      parsed.service_role_key,
      parsed.SUPABASE_SERVICE_ROLE_KEY
    ].filter(Boolean)

    if (candidatos[0]) return candidatos[0]
  } catch {
    // Mantem a mensagem objetiva abaixo.
  }

  throw new Error('Configure SUPABASE_SERVICE_ROLE_KEY nos secrets da Edge Function.')
}

async function consumirCotaIA(supabaseUrl: string, serviceKey: string, userId: string, limite: number): Promise<CotaIA> {
  const resposta = await fetch(`${supabaseUrl}/rest/v1/rpc/consumir_cota_ia`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_limite: limite
    })
  })

  const texto = await resposta.text()
  const corpo = parseJsonSeguro(texto)

  if (!resposta.ok) {
    throw new Error('Execute o arquivo supabase-ia-assistente.sql no SQL Editor antes de usar a IA.')
  }

  const linha = Array.isArray(corpo) ? corpo[0] : corpo
  if (!linha) throw new Error('Nao foi possivel verificar a cota diaria da IA.')

  return {
    permitido: Boolean(linha.permitido),
    usado: Number(linha.usado || 0),
    limite: Number(linha.limite || limite),
    restante: Number(linha.restante || 0),
    data: String(linha.data || '')
  }
}

function validarConfiguracaoIA() {
  const apiKey = obterApiKeyIA()
  const baseUrl = obterBaseUrlIA()
  const modelo = obterModeloIA()

  if (!apiKey) throw new Error('Configure DEEPSEEK_API_KEY ou IA_API_KEY nos secrets da Edge Function.')
  if (!baseUrl) throw new Error('Configure IA_BASE_URL ou use IA_PROVIDER=deepseek.')
  if (!modelo) throw new Error('Configure IA_MODEL ou use IA_PROVIDER=deepseek.')
}

async function chamarModeloIA(questao: QuestaoPayload) {
  const resposta = await fetch(`${removerBarraFinal(obterBaseUrlIA())}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${obterApiKeyIA()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: obterModeloIA(),
      messages: [
        { role: 'system', content: montarPromptSistema() },
        { role: 'user', content: `Analise esta questao em json:\n${JSON.stringify(questao, null, 2)}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1400,
      stream: false
    })
  })

  const texto = await resposta.text()
  const corpo = parseJsonSeguro(texto)

  if (!resposta.ok) {
    throw new Error(corpo?.error?.message || 'A API de IA recusou a solicitacao.')
  }

  const conteudo = corpo?.choices?.[0]?.message?.content
  if (!conteudo) throw new Error('A IA retornou resposta vazia.')

  return normalizarCamposIA(extrairJsonIA(conteudo))
}

function montarPromptSistema() {
  return `Voce e uma IA assistente de estudos para concursos publicos.

Sua funcao e transformar uma questao errada ou chutada em diagnostico util para revisao inteligente.

Regras importantes:
- Responda apenas em json valido.
- Nao substitua nem reescreva o comentario original do usuario.
- Use comentario, enunciado, alternativas, gabarito e dados existentes apenas como fonte.
- Se faltar informacao, seja honesto e deixe o campo objetivo.
- Nao invente artigo, fundamento, jurisprudencia, formula ou regra que nao esteja clara no material.
- Priorize explicacoes curtas, praticas e revisaveis.
- Se houver listas de materias, assuntos, motivos ou confianca disponiveis, tente usar exatamente os nomes existentes.
- Detecte pegadinhas comuns: palavras absolutas, excecoes escondidas, inversao de logica, troca de conceitos, alternativa parcialmente correta, termo ambiguo, cobranca literal de lei, interpretacao induzida ao erro e detalhe sutil no enunciado.

Formato json obrigatorio:
{
  "materia_sugerida": "",
  "assunto_sugerido": "",
  "banca_sugerida": "",
  "tipo_questao_sugerido": "Errada ou Chutada",
  "motivo_erro_sugerido": "",
  "nivel_confianca_sugerido": "",
  "pegadinhas": "",
  "conceito": "",
  "reconhecer": "",
  "acao": "",
  "tipo_cobranca": "lei seca, interpretacao, memorizacao, raciocinio ou mista",
  "observacao_revisao": "",
  "explicacao_curta": ""
}`
}

function sanitizarQuestao(questao: QuestaoPayload): QuestaoPayload {
  return {
    materia: limitarTexto(questao.materia, 120),
    assunto_edital: limitarTexto(questao.assunto_edital, 180),
    materias_disponiveis: limitarLista(questao.materias_disponiveis, 80, 120),
    assuntos_disponiveis: limitarLista(questao.assuntos_disponiveis, 120, 180),
    banca: limitarTexto(questao.banca, 80),
    tipo_questao: limitarTexto(questao.tipo_questao, 30),
    motivos_disponiveis: limitarLista(questao.motivos_disponiveis, 30, 80),
    niveis_confianca_disponiveis: limitarLista(questao.niveis_confianca_disponiveis, 20, 80),
    motivo_atual: limitarTexto(questao.motivo_atual, 80),
    nivel_confianca_atual: limitarTexto(questao.nivel_confianca_atual, 80),
    enunciado: limitarTexto(questao.enunciado, 5000),
    alternativas: limitarAlternativas(questao.alternativas),
    alternativas_formatadas: limitarTexto(questao.alternativas_formatadas, 3500),
    alternativa_marcada: limitarTexto(questao.alternativa_marcada, 500),
    alternativa_correta: limitarTexto(questao.alternativa_correta, 500),
    comentario: limitarTexto(questao.comentario, 4500),
    pegadinhas_atuais: limitarTexto(questao.pegadinhas_atuais, 1200),
    conceito_atual: limitarTexto(questao.conceito_atual, 1200),
    reconhecer_atual: limitarTexto(questao.reconhecer_atual, 1200),
    acao_atual: limitarTexto(questao.acao_atual, 1200)
  }
}

function limitarTexto(valor: unknown, limite: number) {
  return String(valor || '').trim().slice(0, limite)
}

function limitarLista(lista: unknown, maxItens: number, maxTexto: number) {
  if (!Array.isArray(lista)) return []
  return lista.map(item => limitarTexto(item, maxTexto)).filter(Boolean).slice(0, maxItens)
}

function limitarAlternativas(alternativas: unknown) {
  if (!alternativas || typeof alternativas !== 'object' || Array.isArray(alternativas)) return {}
  return Object.fromEntries(
    Object.entries(alternativas as Record<string, unknown>)
      .slice(0, 8)
      .map(([letra, texto]) => [limitarTexto(letra, 3), limitarTexto(texto, 1000)])
  )
}

function extrairJsonIA(conteudo: string) {
  try {
    return JSON.parse(conteudo)
  } catch {
    const trecho = conteudo.match(/\{[\s\S]*\}/)?.[0]
    if (!trecho) throw new Error('A IA nao retornou json valido.')
    return JSON.parse(trecho)
  }
}

function parseJsonSeguro(texto: string) {
  if (!texto) return null
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}

function normalizarCamposIA(campos: Record<string, unknown>) {
  return {
    materia_sugerida: limitarTexto(campos.materia_sugerida, 120),
    assunto_sugerido: limitarTexto(campos.assunto_sugerido, 180),
    banca_sugerida: limitarTexto(campos.banca_sugerida, 80),
    tipo_questao_sugerido: limitarTexto(campos.tipo_questao_sugerido, 30),
    motivo_erro_sugerido: limitarTexto(campos.motivo_erro_sugerido, 80),
    nivel_confianca_sugerido: limitarTexto(campos.nivel_confianca_sugerido, 80),
    pegadinhas: limitarTexto(campos.pegadinhas, 1200),
    conceito: limitarTexto(campos.conceito, 1200),
    reconhecer: limitarTexto(campos.reconhecer, 1200),
    acao: limitarTexto(campos.acao, 1200),
    tipo_cobranca: limitarTexto(campos.tipo_cobranca, 120),
    observacao_revisao: limitarTexto(campos.observacao_revisao, 700),
    explicacao_curta: limitarTexto(campos.explicacao_curta, 700)
  }
}

function obterApiKeyIA() {
  return Deno.env.get('IA_API_KEY') || Deno.env.get('DEEPSEEK_API_KEY') || ''
}

function obterBaseUrlIA() {
  const provider = (Deno.env.get('IA_PROVIDER') || 'deepseek').toLowerCase()
  if (Deno.env.get('IA_BASE_URL')) return Deno.env.get('IA_BASE_URL') || ''
  if (provider === 'deepseek') return 'https://api.deepseek.com'
  return ''
}

function obterModeloIA() {
  const provider = (Deno.env.get('IA_PROVIDER') || 'deepseek').toLowerCase()
  if (Deno.env.get('IA_MODEL')) return Deno.env.get('IA_MODEL') || ''
  if (provider === 'deepseek') return 'deepseek-v4-flash'
  return ''
}

function removerBarraFinal(url: string) {
  return url.replace(/\/+$/, '')
}

function definirStatusErro(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : ''
  if (/autenticado|sessao|jwt|auth/i.test(mensagem)) return 401
  if (/limite|cota|quota/i.test(mensagem)) return 429
  if (/configure|sql editor|ausente/i.test(mensagem)) return 500
  return 400
}
