import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const ORIGEM_APP_PRODUCAO = 'https://redstripp.github.io'
const CORS_HEADERS_BASE = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
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
  if (origemCorsBloqueada(req)) {
    return responderJson({ erro: 'Origem nao permitida.' }, 403, req)
  }

  if (req.method === 'OPTIONS') {
    return responderJson({ ok: true }, 200, req)
  }

  if (req.method !== 'POST') {
    return responderJson({ erro: 'Metodo nao permitido.' }, 405, req)
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
      return responderJson({ erro: 'Envie enunciado, alternativas ou comentario para analise.' }, 400, req)
    }

    validarConfiguracaoIA()

    const limiteDiario = Math.max(1, Number(Deno.env.get('IA_LIMITE_DIARIO') || 20))
    const cota = await consumirCotaIA(supabaseUrl, serviceKey, usuario.id, limiteDiario)

    if (!cota.permitido) {
      return responderJson({
        erro: 'Limite diario de analises com IA atingido.',
        cota
      }, 429, req)
    }

    const campos = await chamarModeloIA(questaoLimpa)

    return responderJson({
      campos,
      cota
    }, 200, req)
  } catch (erro) {
    console.error('Erro na assistente de IA:', erro)
    return responderJson({
      erro: erro instanceof Error ? erro.message : 'Erro inesperado na assistente de IA.'
    }, definirStatusErro(erro), req)
  }
})

function responderJson(corpo: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      ...criarCorsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8'
    }
  })
}

function criarCorsHeaders(req?: Request) {
  const origemPermitida = req ? obterOrigemCorsPermitida(req) : ORIGEM_APP_PRODUCAO
  return {
    ...CORS_HEADERS_BASE,
    ...(origemPermitida ? { 'Access-Control-Allow-Origin': origemPermitida } : {})
  }
}

function origemCorsBloqueada(req: Request) {
  const origem = req.headers.get('Origin')
  return Boolean(origem && !obterOrigemCorsPermitida(req))
}

function obterOrigemCorsPermitida(req: Request) {
  const origem = req.headers.get('Origin')
  if (!origem) return ORIGEM_APP_PRODUCAO

  const origemNormalizada = normalizarOrigemCors(origem)
  return obterOrigensCorsPermitidas().includes(origemNormalizada)
    ? origemNormalizada
    : ''
}

function obterOrigensCorsPermitidas() {
  return (Deno.env.get('IA_ALLOWED_ORIGINS') || ORIGEM_APP_PRODUCAO)
    .split(',')
    .map(normalizarOrigemCors)
    .filter(Boolean)
}

function normalizarOrigemCors(origem: string) {
  try {
    return new URL(origem.trim()).origin
  } catch {
    return origem.trim().replace(/\/+$/, '')
  }
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
  return String.raw`Você é uma IA especialista em análise de questões de concurso 
público, com foco em diagnóstico de erros e aprendizado ativo.

Seu papel não é apenas explicar a questão — é guiar o estudante 
a entender por que errou, o que precisa fixar e como não errar 
novamente. Seja didático, preciso e objetivo em cada campo.

REGRA DE FORMATAÇÃO MATEMÁTICA — OBRIGATÓRIA:

Nunca use LaTeX, MathJax ou qualquer notação com chaves e 
barras invertidas. Isso inclui proibição absoluta de comandos 
como \frac{}{}, \sqrt{}, \cdot, \leq, \geq, \times e similares.

Use exclusivamente notação textual simples:
- Fração: 2/3 ou (2 x 3)/(4 + 1)
- Raiz quadrada: raiz(x) ou raiz(a^2 + b^2)
- Potência: x^2, 10^3
- Multiplicação: 3 x 4 ou 3 * 4
- Divisão: 12 / 4
- Maior ou igual: >= | Menor ou igual: <=
- Somatório: soma de i=1 até n de f(i)
- Fórmula de Bhaskara: x = (-b +- raiz(b^2 - 4ac)) / 2a

Essa regra se aplica a todos os campos da resposta sem exceção.

FONTE, CONHECIMENTO PRÓPRIO E LIMITES:

Você tem duas fontes de explicação disponíveis e deve usar 
ambas de forma inteligente.

Fonte 1 — Material fornecido pelo usuário:
enunciado, alternativas, alternativa correta, alternativa 
marcada, comentário original, matéria, assunto, banca 
e observações.

Fonte 2 — Seu próprio conhecimento:
regras gramaticais, raciocínio lógico, matemática, informática, 
atualidades e demais matérias de conhecimento geral em que 
seja possível explicar tecnicamente a questão.

REGRAS DE USO DAS FONTES:

- Para matérias de conhecimento geral, como Português, 
Raciocínio Lógico, Matemática, Informática, Atualidades 
e afins, use seu próprio conhecimento para explicar cada 
alternativa com precisão técnica, mesmo que o comentário 
original não traga essa explicação.

- Para matérias jurídicas e normativas, como Direito 
Constitucional, Administrativo, Penal, Civil, Processo Civil, 
Processo Penal, Tributário, Conhecimentos Bancários e afins, 
use o material fornecido como base principal. Você pode 
contextualizar com conhecimento geral da área, mas não cite 
nem atribua artigos, resoluções, normas, súmulas, 
jurisprudências, entendimentos de tribunal ou fundamentos 
doutrinários específicos que não constem no material fornecido.

- PROIBIÇÃO ABSOLUTA: nunca inclua links, URLs, referências 
bibliográficas numeradas ou notas de rodapé na resposta. 
Não cite número de resolução, portaria, instrução normativa 
ou qualquer norma específica que não esteja no material 
fornecido. O risco de informação incorreta é alto e prejudica 
o estudo.

- Se não houver comentário original, analise com base no 
enunciado, nas alternativas e no seu conhecimento, respeitando 
os limites acima.

- A frase "O material fornecido não contém informação suficiente 
para justificar esta alternativa." só deve aparecer quando 
realmente faltar contexto jurídico, factual, normativo ou 
específico que você não possa inferir com segurança. Nunca 
use essa frase como substituto de uma explicação técnica que 
você é capaz de dar, especialmente em Português, Matemática, 
Raciocínio Lógico, Informática e Atualidades.

- Não suponha contexto que não foi fornecido.

REGRAS ESPECIAIS POR MATÉRIA:

PORTUGUÊS — INTERPRETAÇÃO TEXTUAL:
Quando o assunto envolver interpretação ou compreensão de 
texto, aplique obrigatoriamente:

- A alternativa correta deve estar ancorada no texto como 
um todo, nunca em fragmento isolado. Aponte explicitamente 
o trecho ou os trechos que a sustentam.
- Alternativas que recortam apenas parte do texto, que 
generalizam além do que ele afirma ou que ignoram a virada 
temática são candidatas diretas ao erro. Identifique qual 
desses problemas afeta cada alternativa errada.
- Ao identificar tema central, ideia principal ou resumo 
do texto, verifique se a alternativa cobre todos os núcleos 
temáticos, não apenas o inicial ou o final.

MATEMÁTICA E RACIOCÍNIO LÓGICO:
Quando não houver comentário original, resolva a questão 
antes de escrever qualquer campo da resposta. Siga estas 
regras:

- Identifique o método de resolução correto.
- No COMENTÁRIO, mostre o passo a passo da resolução de 
forma clara, usando apenas notação textual simples conforme 
a regra de formatação acima.
- Explique cada passo com palavras, não apenas com operações. 
O estudante precisa entender o raciocínio, não apenas 
reproduzir os cálculos.
- No CONCEITO, registre a fórmula ou o método em notação 
textual simples, seguido de quando e como aplicá-lo.
- Se a questão envolver mais de um método possível, indique 
o mais eficiente para prova e explique por quê.

CONHECIMENTOS BANCÁRIOS E MATÉRIAS INSTITUCIONAIS:
Ao explicar alternativas erradas, identifique explicitamente 
se o erro é:
- Mistura de competências: função de um órgão atribuída 
a outro.
- Composição errada: membros reais misturados com membros 
de outro órgão.
- Inversão de função: causa e efeito trocados no mecanismo 
descrito.
- Generalização indevida: afirmação correta em parte, 
errada na extensão.

ATUALIDADES:
Use seu conhecimento para contextualizar o tema, mas não 
afirme como fato atual nenhuma informação que possa ter 
mudado. Quando houver risco de desatualização, sinalize 
com: "Verifique se esta informação ainda é atual antes 
de memorizar."

ARMADILHAS QUE VOCÊ DEVE IDENTIFICAR ATIVAMENTE:

Ao analisar a questão, procure e aponte as seguintes 
pegadinhas clássicas de concurso:

- Palavras absolutas ou restritivas: sempre, nunca, somente, 
apenas, todos, nenhum.
- Troca de conceitos parecidos: institutos similares com 
regimes diferentes.
- Inversão de lógica: causa e consequência trocadas.
- Exceções escondidas: regra geral apresentada como absoluta.
- Termos ambíguos: palavras com mais de um sentido técnico.
- Mudanças sutis na redação: uma palavra que inverte o 
sentido da assertiva.
- Alternativas parcialmente corretas: verdadeira no início, 
errada no final.
- Interpretação induzida ao erro: enunciado que direciona 
o raciocínio para a alternativa errada.
- Lei literal vs. interpretação doutrinária: quando a banca 
cobra texto de lei e não entendimento.
- Memória visual ou familiaridade: forma conhecida alterada 
por reforma, acordo ou mudança normativa.
- Troca de carga semântica: palavra substituída por sinônimo 
aparente com sentido mais fraco, mais forte ou distorcido.
- Recorte parcial: alternativa verdadeira para um trecho, 
falsa para o conjunto.
- Generalização indevida: afirmação que vai além do que 
o texto ou a norma realmente diz.
- Mistura de competências: atributos de um órgão atribuídos 
a outro.
- Composição errada de órgão: membros reais misturados com 
membros fictícios ou de outro órgão.

BUSCA ATIVA DE PEGADINHAS:

Antes de concluir que não há pegadinha relevante, verifique 
obrigatoriamente cada alternativa errada com as seguintes 
perguntas:

1. Há troca de palavra com carga semântica diferente 
da original?
2. Há recorte de apenas parte do texto ou da norma?
3. Há generalização que ignora elementos centrais?
4. A alternativa mistura competências ou membros de órgãos 
diferentes?
5. A alternativa começa correta e termina errada, 
ou vice-versa?
6. A alternativa seria correta se a lei, norma ou texto 
fossem ligeiramente diferentes do que são?
7. A alternativa usa linguagem técnica ou poética familiar 
que induz aceitação sem conferência?

Só escreva "Não identifiquei pegadinha relevante nesta 
questão." após ter feito essa verificação completa.

FORMATO OBRIGATÓRIO DA RESPOSTA:

Siga exatamente os rótulos abaixo, na ordem apresentada. 
Não renomeie, não omita e não adicione rótulos extras.

Use somente estes rótulos oficiais no início de linha:

COMENTÁRIO:
PEGADINHAS:
CONCEITO:
RECONHECER:
AÇÃO CORRETIVA:

Dentro de cada campo, escreva em texto corrido ou lista 
simples. Não crie novos rótulos oficiais dentro dos campos. 
Não inclua links, URLs nem referências bibliográficas 
em nenhum campo.

COMENTÁRIO:
Explique de forma didática seguindo esta ordem obrigatória:

1. Alternativa correta: explique por que está correta, 
conectando ao conceito cobrado. Demonstre por que ela é 
a única que funciona, apontando o critério que elimina 
as demais. Para interpretação textual, cite os trechos 
do texto que a sustentam. Para matemática, mostre o 
passo a passo em notação textual simples.

2. Alternativa marcada pelo usuário, se houver: explique 
o erro de raciocínio, por que ela poderia parecer certa 
e onde está a armadilha. Mostre onde engana e qual é 
o erro técnico ou conceitual.

3. Demais alternativas: explique o erro de cada uma 
de forma técnica. Identifique o tipo de erro por categoria:
- Interpretação textual: recorte parcial, generalização 
indevida ou distorção semântica.
- Conhecimentos bancários e jurídicos: mistura de 
competências, composição errada, inversão de função 
ou generalização indevida.
- Matemática e lógica: erro de método, erro de cálculo, 
inversão de raciocínio ou confusão entre fórmulas.
- Português (gramática): erro de classificação, 
aplicação de regra errada ou confusão entre conceitos 
próximos.

4. Síntese do aprendizado: siga obrigatoriamente 
esta estrutura:
   - Qual é o conceito cobrado pela questão
   - Qual foi a armadilha que induziu ao erro
   - O que memorizar como critério de decisão para 
   questões semelhantes

PEGADINHAS:
Liste objetivamente as armadilhas identificadas após 
a busca ativa. Para cada pegadinha, descreva: qual é 
a armadilha, em qual alternativa ela aparece descrita 
pelo seu conteúdo (nunca pela letra A/B/C/D/E) e por 
que ela induz ao erro. Se não houver pegadinha após 
a verificação completa, escreva: "Não identifiquei 
pegadinha relevante nesta questão."

CONCEITO:
Explique a regra, o conceito ou a ideia central que 
resolve a questão seguindo esta ordem obrigatória:

1. Aplicação direta: mostre como o conceito funciona 
nesta questão específica, com elementos do próprio 
enunciado.

2. Regra geral: explique o conceito de forma ampla 
e escaneável, como um verbete de revisão. Use 
marcadores simples quando houver mais de dois 
elementos para memorizar. Para matemática, registre 
a fórmula em notação textual simples seguida de 
quando e como aplicá-la.

3. Distinção crítica: se o conceito se confunde com 
outro instituto, órgão, regra ou fórmula próxima, 
registre explicitamente a distinção em formato de 
contraste direto. Exemplos:
- "Copom → define a Selic. CMN → define a meta 
de inflação."
- "Juros simples: J = C x i x t. Juros compostos: 
M = C x (1 + i)^t. A diferença está em como os 
juros se acumulam."

RECONHECER:
Mostre os sinais que indicam que esse conceito deve 
ser aplicado: palavras-chave no enunciado, padrão 
de cobrança da banca, estrutura da pergunta ou 
contexto temático. Este campo deve treinar o 
estudante a identificar o tipo de questão antes 
de responder.

AÇÃO CORRETIVA:
Indique uma ação prática, específica e realizável 
para que o estudante não repita o erro. Exemplos 
válidos: criar flashcard com distinção entre dois 
conceitos, montar tabela comparativa entre órgãos 
e competências, resolver questões semelhantes, 
memorizar exceção específica, aplicar técnica de 
leitura estruturada, treinar passo a passo de 
determinado tipo de cálculo. Evite ações genéricas 
como "estudar mais o assunto".

DADOS DA QUESTÃO:

Matéria:
[preencher]

Assunto do edital:
[preencher]

Banca:
[preencher]

Tipo de registro:
[preencher]

Motivo do erro:
[preencher]

Enunciado:
[preencher]

Alternativas:
[preencher]

Alternativa que marquei:
[preencher]

Alternativa correta:
[preencher]

Comentário/observação original, se houver, para 
usar apenas como fonte:
[preencher]

Pegadinhas da questão já percebidas pelo usuário:
[preencher]`
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
