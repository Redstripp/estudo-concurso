// js/questoes.js

let alternativaMarcada  = null
let alternativaCorreta  = null
let numAlternativas     = 2
let tipoQuestaoAtual    = 'Errada'
let modoRegistroQuestao = 'rapido'
let questoesInicializado = false
let filtroCadernoErrosAtual = 'todos'
let questoesEmMemoria = []
let questaoRecemSalvaId = null
let timeoutBusca

const LETRAS = ['A', 'B', 'C', 'D', 'E']
const TIPOS_QUESTAO = ['Errada', 'Chutada']
const CONFIG_TIPO_QUESTAO = {
  Errada: {
    rotulo: 'Errada realmente',
    labelMarcada: 'Qual alternativa você marcou? (errada)',
    labelMotivo: 'Causa do erro',
    labelConfianca: 'Confiança quando errou',
    motivos: [
      'A diagnosticar',
      'Falta de conteúdo',
      'Interpretação incorreta',
      'Desatenção',
      'Confusão entre conceitos',
      'Esquecimento',
      'Falta de domínio teórico',
      'Dúvida entre alternativas',
      'Falta de revisão',
      'Pegadinha',
      'Cálculo'
    ],
    niveis: ['Não informado', 'Baixa confiança', 'Dúvida', 'Confiante mas errei']
  },
  Chutada: {
    rotulo: 'Chutada / baixa confiança',
    labelMarcada: 'Qual alternativa você marcou no chute?',
    labelMotivo: 'Motivo da insegurança',
    labelConfianca: 'Grau de segurança',
    motivos: [
      'A diagnosticar',
      'Eliminação parcial',
      'Dúvida entre alternativas',
      'Falta de certeza',
      'Chute completo',
      'Reconhecimento superficial do conteúdo'
    ],
    niveis: ['Não informado', 'Chutei', 'Dúvida forte', 'Quase confiante']
  }
}
const MOTIVOS_ERRO = CONFIG_TIPO_QUESTAO.Errada.motivos
const NIVEIS_CONFIANCA = [...new Set([
  ...CONFIG_TIPO_QUESTAO.Errada.niveis,
  ...CONFIG_TIPO_QUESTAO.Chutada.niveis
])]
const MODELO_RESPOSTA_CHATGPT = `COMENTÁRIO:
[Explique a questão com base no material fornecido.]

PEGADINHAS:
[Liste as pegadinhas.]

CONCEITO:
[Explique o conceito central.]

RECONHECER:
[Explique como reconhecer na próxima vez.]

AÇÃO CORRETIVA:
[Explique o que devo fazer para não errar novamente.]`
const PEGADINHAS_PREDEFINIDAS = [
  'Palavra absoluta',
  'Exceção escondida',
  'Alternativa parcialmente correta',
  'Inversão de conceito',
  'Troca de termos parecidos',
  'Interpretação induzida',
  'Cobrança literal',
  'Detalhe sutil no enunciado',
  'Confusão entre conceitos',
  'Outro'
]

function renderizarOptionsEstudo(valores, valorAtual) {
  return valores.map(valor => `
    <option value="${escaparHtmlSeguro(valor)}" ${valor === valorAtual ? 'selected' : ''}>${escaparHtmlSeguro(valor)}</option>
  `).join('')
}

function normalizarTipoQuestao(q) {
  if (q?.tipo_questao === 'Chutada' || q?.tipo_questao === 'Errada') return q.tipo_questao
  if (
    q?.motivo_erro === 'Chute' ||
    CONFIG_TIPO_QUESTAO.Chutada.motivos.includes(q?.motivo_erro) ||
    q?.nivel_confianca === 'Chutei'
  ) return 'Chutada'
  return 'Errada'
}

function obterRotuloTipoQuestao(tipo) {
  return obterConfigTipoQuestao(tipo).rotulo
}

function obterClasseTipoQuestao(tipo) {
  return tipo === 'Chutada' ? 'tag-tipo-questao--chutada' : 'tag-tipo-questao--errada'
}

function normalizarStatusRevisao(q) {
  return q?.status_revisao === 'recuperada' ? 'recuperada' : 'pendente'
}

function obterConfigTipoQuestao(tipo) {
  return CONFIG_TIPO_QUESTAO[tipo === 'Chutada' ? 'Chutada' : 'Errada']
}

function questaoChutadaAcertada(q) {
  return normalizarTipoQuestao(q) === 'Chutada' && q?.alternativa_marcada === q?.alternativa_correta
}

// ============================================
// INICIALIZAR MÓDULO (só roda uma vez)
// ============================================
function inicializarQuestoes() {
  if (questoesInicializado) {
    carregarMateriasNoSelect()
    carregarTopicosQuestao()
    carregarQuestoes()
    return
  }

  questoesInicializado = true

  gerarCamposAlternativas(numAlternativas)
  gerarBotoesAlternativas(numAlternativas)
  renderizarChipsPegadinha('q-pegadinha-chips', 'q-pegadinha-banca')
  inicializarSeletorNumAlternativas()
  inicializarSeletorTipoQuestao()
  inicializarModoRegistroQuestao()
  carregarMateriasNoSelect()
  carregarTopicosQuestao()
  carregarQuestoes()
  inicializarAcertos() // ✅ adicionado aqui

  document.getElementById('btn-salvar-questao')
    .addEventListener('click', salvarQuestao)

  document.getElementById('btn-analisar-ia')
    ?.addEventListener('click', () => analisarQuestaoComIA('cadastro'))

  document.getElementById('btn-gerar-prompt-chatgpt')
    ?.addEventListener('click', abrirPromptChatGPT)

  document.getElementById('btn-copiar-modelo-resposta-chatgpt')
    ?.addEventListener('click', copiarModeloRespostaChatGPT)

  document.getElementById('btn-colar-resposta-chatgpt')
    ?.addEventListener('click', abrirColarRespostaChatGPT)

  document.getElementById('q-materia')
    ?.addEventListener('change', async () => {
      await carregarTopicosQuestao()
      atualizarAssistenteDiagnosticoMinimo()
    })

  const inputBusca = document.getElementById('busca-caderno');
  if (inputBusca) {
    inputBusca.addEventListener('input', (e) => {
      clearTimeout(timeoutBusca);
      timeoutBusca = setTimeout(() => {
        filtrarQuestoesBusca(e.target.value);
      }, 300);
    });
  }

  const selectOrdenacao = document.getElementById('ordenacao-caderno');
  if (selectOrdenacao) {
    selectOrdenacao.addEventListener('change', () => {
      // Reaplica o filtro atual com a nova ordenação
      const termo = document.getElementById('busca-caderno')?.value || '';
      filtrarQuestoesBusca(termo);
    });
  }

  inicializarAssistenteDiagnosticoMinimo()
}

// ============================================
// CARREGAR MATÉRIAS NO SELECT
// ============================================
async function carregarMateriasNoSelect() {
  const select = document.getElementById('q-materia')

  select.innerHTML = '<option value="">⏳ Buscando opções...</option>'

  const { data, error } = await db
    .from('materias')
    .select('id, nome')
    .eq('user_id', window.usuarioAtual.id)
    .order('nome', { ascending: true })

  select.innerHTML = '<option value="">Selecione uma matéria...</option>'

  if (error || !data || data.length === 0) {
    select.innerHTML = '<option value="">Nenhuma matéria cadastrada</option>'
    return
  }

  data.forEach(m => {
    const option = document.createElement('option')
    option.value = m.id
    option.textContent = m.nome
    select.appendChild(option)
  })
}

async function carregarTopicosQuestao(topicoAtualId = '') {
  const materiaId = document.getElementById('q-materia')?.value || ''
  await carregarTopicosQuestaoParaSelect('q-edital-topico', materiaId, topicoAtualId, 'Sem assunto específico')
}

async function carregarTopicosQuestaoParaSelect(selectId, materiaId = '', topicoAtualId = '', textoVazio = 'Sem assunto específico') {
  if (typeof carregarTopicosEditalParaSelect === 'function') {
    await carregarTopicosEditalParaSelect(selectId, materiaId, topicoAtualId, textoVazio)
    return
  }

  const select = document.getElementById(selectId)
  if (!select) return

  select.innerHTML = '<option value="">Buscando lista de assuntos do edital...</option>'

  try {
    let query = db
      .from('edital_topicos')
      .select('id, materia_id, titulo, materias(nome)')
      .eq('user_id', window.usuarioAtual.id)
      .order('titulo', { ascending: true })

    if (materiaId) query = query.eq('materia_id', materiaId)

    const { data, error } = await query
    if (error) throw error

    popularTopicosQuestaoSelect(select, data || [], materiaId, topicoAtualId, textoVazio)
  } catch (erro) {
    console.warn('Não foi possível carregar assuntos do edital em Questões.', erro)
    select.innerHTML = '<option value="">Execute o SQL do edital</option>'
  }
}

function popularTopicosQuestaoSelect(select, topicos, materiaId = '', topicoAtualId = '', textoVazio = 'Sem assunto específico') {
  const filtrados = (topicos || [])
    .filter(topico => !materiaId || topico.materia_id === materiaId)
    .sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'))

  select.innerHTML = ''
  const optionVazio = document.createElement('option')
  optionVazio.value = ''
  optionVazio.textContent = textoVazio
  select.appendChild(optionVazio)

  filtrados.forEach(topico => {
    const materia = topico.materias?.nome ? ` · ${topico.materias.nome}` : ''
    const option = document.createElement('option')
    option.value = topico.id
    option.textContent = `${topico.titulo}${materia}`
    if (topico.id === topicoAtualId) option.selected = true
    select.appendChild(option)
  })
}

function obterTextoTopicoSelecionado(selectId) {
  const select = document.getElementById(selectId)
  if (!select?.value) return ''
  return select.selectedOptions?.[0]?.text?.trim() || ''
}

// ============================================
// SELETOR DE NÚMERO DE ALTERNATIVAS
// ============================================
function inicializarSeletorNumAlternativas() {
  const botoes = document.querySelectorAll('.btn-num')

  botoes.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      botoes.forEach(b => b.classList.remove('ativo-num'))
      btn.classList.add('ativo-num')

      alterarQuantidadeAlternativas(parseInt(btn.dataset.num))
    })
  })
}

function alterarQuantidadeAlternativas(quantidade) {
  const alternativasAtuais = coletarTextosAlternativas()
  const letrasValidas = LETRAS.slice(0, quantidade)

  alternativaMarcada = letrasValidas.includes(alternativaMarcada) ? alternativaMarcada : null
  alternativaCorreta = letrasValidas.includes(alternativaCorreta) ? alternativaCorreta : null
  numAlternativas = quantidade

  gerarCamposAlternativas(numAlternativas, alternativasAtuais)
  gerarBotoesAlternativas(numAlternativas)
}

function inicializarSeletorTipoQuestao() {
  const botoes = document.querySelectorAll('#grupo-tipo-questao .btn-tipo-questao')

  botoes.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      selecionarTipoQuestao(btn.dataset.tipo)
    })
  })

  document.getElementById('q-motivo-erro')
    ?.addEventListener('change', () => {
      sincronizarTipoQuestaoPorCampos('motivo')
      sugerirAcaoCorretivaPorMotivo('q')
    })
  document.getElementById('q-nivel-confianca')
    ?.addEventListener('change', () => sincronizarTipoQuestaoPorCampos('confianca'))

  atualizarCamposFormularioPorTipo(tipoQuestaoAtual, true)
}

function selecionarTipoQuestao(tipo, preservarValores = false) {
  tipoQuestaoAtual = tipo === 'Chutada' ? 'Chutada' : 'Errada'

  document.querySelectorAll('#grupo-tipo-questao .btn-tipo-questao').forEach(btn => {
    btn.classList.toggle('ativo-tipo', btn.dataset.tipo === tipoQuestaoAtual)
  })

  atualizarCamposFormularioPorTipo(tipoQuestaoAtual, preservarValores)
}

function atualizarCamposFormularioPorTipo(tipo, preservarValores = false) {
  const config = obterConfigTipoQuestao(tipo)
  const labelMarcada = document.getElementById('label-alternativa-marcada')
  const labelMotivo = document.getElementById('label-motivo-questao')
  const labelConfianca = document.getElementById('label-confianca-questao')
  const motivo = document.getElementById('q-motivo-erro')
  const confianca = document.getElementById('q-nivel-confianca')

  if (labelMarcada) labelMarcada.textContent = config.labelMarcada
  if (labelMotivo) labelMotivo.textContent = config.labelMotivo
  if (labelConfianca) labelConfianca.textContent = config.labelConfianca

  if (motivo) {
    const valorAtual = preservarValores && config.motivos.includes(motivo.value) ? motivo.value : ''
    motivo.innerHTML = `<option value="">Selecione...</option>${renderizarOptionsEstudo(config.motivos, valorAtual)}`
    motivo.value = valorAtual
  }

  if (confianca) {
    const valorAtual = preservarValores && config.niveis.includes(confianca.value) ? confianca.value : ''
    confianca.innerHTML = `<option value="">Selecione...</option>${renderizarOptionsEstudo(config.niveis, valorAtual)}`
    confianca.value = valorAtual
  }

  atualizarAssistenteDiagnosticoMinimo()
}

function sincronizarTipoQuestaoPorCampos(campoAlterado = '') {
  const motivo = document.getElementById('q-motivo-erro')?.value
  const confianca = document.getElementById('q-nivel-confianca')?.value
  const tipoInferido = obterTipoQuestaoPorCampos(motivo, confianca, campoAlterado)

  if (tipoInferido && tipoInferido !== tipoQuestaoAtual) {
    selecionarTipoQuestao(tipoInferido, true)
  }
}

function obterTipoQuestaoPorCampos(motivo, confianca, campoPrioritario = '') {
  const tipoMotivo = obterTipoQuestaoPorValorCampo('motivo', motivo)
  const tipoConfianca = obterTipoQuestaoPorValorCampo('confianca', confianca)

  if (campoPrioritario === 'motivo' && tipoMotivo) return tipoMotivo
  if (campoPrioritario === 'confianca' && tipoConfianca) return tipoConfianca
  if (tipoMotivo && tipoConfianca && tipoMotivo !== tipoConfianca) return ''

  return tipoMotivo || tipoConfianca || ''
}

function obterTipoQuestaoPorValorCampo(campo, valor) {
  const chave = campo === 'confianca' ? 'niveis' : 'motivos'
  const configErrada = obterConfigTipoQuestao('Errada')
  const configChutada = obterConfigTipoQuestao('Chutada')
  const existeEmErrada = configErrada[chave].includes(valor)
  const existeEmChutada = configChutada[chave].includes(valor)

  if (existeEmChutada && !existeEmErrada) return 'Chutada'
  if (existeEmErrada && !existeEmChutada) return 'Errada'
  return ''
}

function inicializarModoRegistroQuestao() {
  document.querySelectorAll('[data-modo-registro]').forEach(btn => {
    btn.addEventListener('click', () => selecionarModoRegistroQuestao(btn.dataset.modoRegistro))
  })

  selecionarModoRegistroQuestao(modoRegistroQuestao)
}

function selecionarModoRegistroQuestao(modo) {
  modoRegistroQuestao = modo === 'completo' ? 'completo' : 'rapido'

  document.querySelectorAll('[data-modo-registro]').forEach(btn => {
    btn.classList.toggle('ativo', btn.dataset.modoRegistro === modoRegistroQuestao)
  })

  const detalhes = document.getElementById('registro-diagnostico-detalhado')
  const info = document.getElementById('registro-modo-info')

  if (detalhes) detalhes.classList.toggle('registro-detalhes-oculto', modoRegistroQuestao === 'rapido')
  if (info) {
    info.textContent = modoRegistroQuestao === 'rapido'
      ? 'Use o modo rápido para registrar a questão sem travar o estudo. O sistema sinaliza depois o que precisa completar.'
      : 'Use o diagnóstico completo quando já souber a regra, como reconhecer o padrão e qual ação corretiva aplicar.'
  }

  atualizarAssistenteDiagnosticoMinimo()
}

function inicializarAssistenteDiagnosticoMinimo() {
  const ids = [
    'q-edital-topico',
    'q-banca',
    'q-enunciado',
    'q-comentario',
    'q-pegadinha-banca',
    'q-conceito-chave',
    'q-como-reconhecer',
    'q-acao-corretiva',
    'q-motivo-erro',
    'q-nivel-confianca'
  ]

  ids.forEach(id => {
    const campo = document.getElementById(id)
    if (!campo || campo.dataset.assistenteDiagnostico === 'true') return

    campo.dataset.assistenteDiagnostico = 'true'
    campo.addEventListener('input', atualizarAssistenteDiagnosticoMinimo)
    campo.addEventListener('change', atualizarAssistenteDiagnosticoMinimo)
  })

  atualizarAssistenteDiagnosticoMinimo()
}

function atualizarAssistenteDiagnosticoMinimo() {
  const box = document.getElementById('diagnostico-minimo-box')
  if (!box) return

  const dados = montarDadosQuestaoFormulario()
  const recomendados = []
  const essenciais = []

  if (!dados.materiaId) essenciais.push('matéria')
  if (!dados.enunciado) essenciais.push('enunciado')
  if (!dados.alternativaMarcada) essenciais.push('alternativa marcada')
  if (!dados.alternativaCorreta) essenciais.push('gabarito')

  const alternativasPreenchidas = Object.values(dados.alternativas).filter(Boolean).length
  if (alternativasPreenchidas < numAlternativas) essenciais.push('texto das alternativas')

  if (!dados.editalTopicoId) recomendados.push('assunto do edital')
  if (!campoDiagnosticoManualPreenchido(dados.motivoErro)) recomendados.push('causa do erro')
  if (!campoDiagnosticoManualPreenchido(dados.nivelConfianca)) recomendados.push('confiança')

  const motivoTexto = String(dados.motivoErro || '').toLowerCase()
  const pedePegadinha = motivoTexto.includes('pegadinha') || motivoTexto.includes('interpreta') || motivoTexto.includes('confus')
  if (pedePegadinha && !dados.pegadinhaBanca) recomendados.push('pegadinha da questão')

  if (modoRegistroQuestao === 'completo') {
    if (!dados.conceitoChave) recomendados.push('conceito ou regra')
    if (!dados.comoReconhecer) recomendados.push('como reconhecer')
    if (!dados.acaoCorretiva) recomendados.push('ação corretiva')
  }

  box.classList.toggle('diagnostico-minimo-box--ok', essenciais.length === 0 && recomendados.length === 0)
  box.classList.toggle('diagnostico-minimo-box--atencao', essenciais.length === 0 && recomendados.length > 0)

  if (essenciais.length > 0) {
    box.innerHTML = `
      <strong>Para salvar, falta o essencial</strong>
      <p>Complete: ${escaparHtmlSeguro(essenciais.join(', '))}.</p>
    `
    return
  }

  if (recomendados.length > 0) {
    box.innerHTML = `
      <strong>Pode salvar em modo rápido</strong>
      <p>Se deixar sem preencher, o sistema marca como "A diagnosticar" e mostra depois em diagnóstico a reforçar.</p>
      <ul>${recomendados.slice(0, 4).map(item => `<li>${escaparHtmlSeguro(item)}</li>`).join('')}</ul>
    `
    return
  }

  box.innerHTML = `
    <strong>Registro bem alimentado</strong>
    <p>Esses dados já ajudam a fila inteligente a priorizar revisão, padrão de erro e pegadinhas.</p>
  `
}

function campoDiagnosticoManualPreenchido(valor) {
  const texto = String(valor || '').trim()
  return Boolean(texto && texto !== 'A diagnosticar' && texto !== 'Não informado')
}

function renderizarChipsPegadinha(containerId, textareaId) {
  const container = document.getElementById(containerId)
  const textarea = document.getElementById(textareaId)
  if (!container || !textarea) return

  container.innerHTML = PEGADINHAS_PREDEFINIDAS.map(pegadinha => `
    <button class="pegadinha-chip" type="button" data-pegadinha="${escaparHtmlSeguro(pegadinha)}">
      ${escaparHtmlSeguro(pegadinha)}
    </button>
  `).join('')

  container.querySelectorAll('.pegadinha-chip').forEach(btn => {
    btn.addEventListener('click', () => alternarPegadinhaChip(textarea, btn.dataset.pegadinha || '', container))
  })

  textarea.addEventListener('input', () => sincronizarChipsPegadinha(container, textarea.value))
  sincronizarChipsPegadinha(container, textarea.value)
}

function alternarPegadinhaChip(textarea, pegadinha, container) {
  if (!textarea || !pegadinha) return

  const partes = obterPegadinhasTexto(textarea.value)
  const normalizada = normalizarPegadinhaTexto(pegadinha)
  const existe = partes.some(item => normalizarPegadinhaTexto(item) === normalizada)
  const novasPartes = existe
    ? partes.filter(item => normalizarPegadinhaTexto(item) !== normalizada)
    : [...partes, pegadinha]

  textarea.value = novasPartes.join('; ')
  sincronizarChipsPegadinha(container, textarea.value)
}

function sincronizarChipsPegadinha(container, texto) {
  if (!container) return
  const selecionadas = obterPegadinhasTexto(texto).map(normalizarPegadinhaTexto)

  container.querySelectorAll('.pegadinha-chip').forEach(btn => {
    btn.classList.toggle('ativo', selecionadas.includes(normalizarPegadinhaTexto(btn.dataset.pegadinha || '')))
  })
}

function obterPegadinhasTexto(texto) {
  return String(texto || '')
    .split(/[;\n,]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizarPegadinhaTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sugerirAcaoCorretivaPorMotivo(prefixo) {
  const motivo = document.getElementById(`${prefixo}-motivo-erro`)?.value || ''
  const campoAcao = document.getElementById(`${prefixo}-acao-corretiva`)
  if (!campoAcao || campoAcao.value.trim()) return

  const sugestao = obterAcaoCorretivaSugerida(motivo)
  if (sugestao) campoAcao.value = sugestao
}

function obterAcaoCorretivaSugerida(motivo) {
  const normalizado = normalizarPegadinhaTexto(motivo)
  if (!normalizado) return ''
  if (normalizado.includes('falta de conteudo') || normalizado.includes('dominio teorico')) {
    return 'Voltar à teoria do assunto e fazer uma rodada curta de questões semelhantes.'
  }
  if (normalizado.includes('interpretacao')) {
    return 'Antes de responder, reescrever o comando da questão com minhas palavras.'
  }
  if (normalizado.includes('desatencao')) {
    return 'Marcar palavras-chave, exceções e comandos negativos antes de olhar as alternativas.'
  }
  if (normalizado.includes('confusao')) {
    return 'Criar uma comparação entre os conceitos confundidos e revisar exemplos.'
  }
  if (normalizado.includes('esquecimento') || normalizado.includes('falta de revisao')) {
    return 'Criar flashcard curto e revisar novamente no próximo ciclo.'
  }
  if (normalizado.includes('pegadinha')) {
    return 'Treinar a leitura da armadilha e registrar o padrão de pegadinha para revisar depois.'
  }
  if (normalizado.includes('duvida') || normalizado.includes('chute') || normalizado.includes('falta de certeza')) {
    return 'Registrar a regra de decisão que diferenciava as alternativas e refazer questões do mesmo assunto.'
  }
  if (normalizado.includes('calculo')) {
    return 'Refazer o cálculo passo a passo e anotar a fórmula ou procedimento que faltou.'
  }
  return ''
}

// ============================================
// GERAR CAMPOS DE TEXTO DAS ALTERNATIVAS
// ============================================
function gerarCamposAlternativas(num, valores = {}) {
  const container = document.getElementById('campos-alternativas')
  container.innerHTML = ''

  for (let i = 0; i < num; i++) {
    const letra = LETRAS[i]

    const linha = document.createElement('div')
    linha.className = 'linha-alternativa'

    linha.innerHTML = `
      <span class="badge-letra">${letra}</span>
      <input
        type="text"
        id="alt-${letra}"
        class="input-texto"
        placeholder="Texto da alternativa ${letra}..."
      />
    `

    container.appendChild(linha)
    const input = linha.querySelector('input')
    if (input) {
      input.value = valores[letra] || ''
      input.addEventListener('input', atualizarAssistenteDiagnosticoMinimo)
    }
  }
}

// ============================================
// GERAR BOTÕES DE SELEÇÃO (marcada / correta)
// ============================================
function gerarBotoesAlternativas(num) {
  const grupoMarcada = document.getElementById('grupo-marcada')
  const grupoCorreta = document.getElementById('grupo-correta')

  grupoMarcada.innerHTML = ''
  grupoCorreta.innerHTML = ''

  for (let i = 0; i < num; i++) {
    const letra = LETRAS[i]

    // Botão marcada (errada)
    const btnM = document.createElement('button')
    btnM.className   = 'btn-letra'
    btnM.textContent = letra
    btnM.type        = 'button'
    if (alternativaMarcada === letra) btnM.classList.add('selecionado-errado')
    btnM.addEventListener('click', (e) => {
      e.preventDefault()
      grupoMarcada.querySelectorAll('.btn-letra')
        .forEach(b => b.classList.remove('selecionado-errado'))
      btnM.classList.add('selecionado-errado')
      alternativaMarcada = letra
      atualizarAssistenteDiagnosticoMinimo()
    })
    grupoMarcada.appendChild(btnM)

    // Botão correta
    const btnC = document.createElement('button')
    btnC.className   = 'btn-letra'
    btnC.textContent = letra
    btnC.type        = 'button'
    if (alternativaCorreta === letra) btnC.classList.add('selecionado-certo')
    btnC.addEventListener('click', (e) => {
      e.preventDefault()
      grupoCorreta.querySelectorAll('.btn-letra')
        .forEach(b => b.classList.remove('selecionado-certo'))
      btnC.classList.add('selecionado-certo')
      alternativaCorreta = letra
      atualizarAssistenteDiagnosticoMinimo()
    })
    grupoCorreta.appendChild(btnC)
  }
}

// ============================================
// COLETAR TEXTOS DAS ALTERNATIVAS
// ============================================
function coletarTextosAlternativas() {
  const alternativas = {}
  for (let i = 0; i < numAlternativas; i++) {
    const letra = LETRAS[i]
    const input = document.getElementById(`alt-${letra}`)
    alternativas[letra] = input ? input.value.trim() : ''
  }
  return alternativas
}

function montarDadosQuestaoFormulario() {
  const selectMateria = document.getElementById('q-materia')
  const materiaId = selectMateria.value

  return {
    materiaId,
    materiaNome: materiaId ? selectMateria.selectedOptions?.[0]?.text?.trim() || 'Matéria selecionada' : '',
    editalTopicoId: document.getElementById('q-edital-topico')?.value || null,
    banca: document.getElementById('q-banca')?.value.trim() || '',
    pegadinhaBanca: document.getElementById('q-pegadinha-banca')?.value.trim() || '',
    enunciado: document.getElementById('q-enunciado').value.trim(),
    comentario: document.getElementById('q-comentario').value.trim(),
    conceitoChave: document.getElementById('q-conceito-chave')?.value.trim() || '',
    comoReconhecer: document.getElementById('q-como-reconhecer')?.value.trim() || '',
    acaoCorretiva: document.getElementById('q-acao-corretiva')?.value.trim() || '',
    motivoErro: document.getElementById('q-motivo-erro').value,
    nivelConfianca: document.getElementById('q-nivel-confianca').value,
    tipoQuestao: tipoQuestaoAtual,
    alternativaMarcada,
    alternativaCorreta,
    alternativas: coletarTextosAlternativas()
  }
}

async function buscarPossivelQuestaoDuplicada(dadosQuestao) {
  const { data, error } = await db
    .from('questoes')
    .select('id, materia_id, edital_topico_id, banca, pegadinha_banca, enunciado, alternativas, alternativa_marcada, alternativa_correta, tipo_questao, status_revisao, motivo_erro, nivel_confianca, comentario, conceito_chave, como_reconhecer, acao_corretiva, criado_em, materias(nome), edital_topicos(titulo, status)')
    .eq('user_id', window.usuarioAtual.id)
    .order('criado_em', { ascending: false })
    .limit(250)

  if (error) {
    console.warn('Não foi possível verificar duplicidade da questão.', error)
    return null
  }

  const candidatas = (data || [])
    .map(questao => ({
      questao,
      similaridade: calcularSimilaridadeQuestoes(dadosQuestao, questao)
    }))
    .filter(item => item.similaridade >= 0.78)
    .sort((a, b) => b.similaridade - a.similaridade)

  return candidatas[0] || null
}

function calcularSimilaridadeQuestoes(dadosQuestao, questaoExistente) {
  const enunciadoNovo = normalizarTextoDuplicidade(dadosQuestao.enunciado)
  const enunciadoExistente = normalizarTextoDuplicidade(questaoExistente.enunciado)

  if (!enunciadoNovo || !enunciadoExistente) return 0
  if (enunciadoNovo === enunciadoExistente) return 1

  const textoNovo = normalizarTextoDuplicidade(`${dadosQuestao.enunciado} ${Object.values(dadosQuestao.alternativas || {}).join(' ')}`)
  const textoExistente = normalizarTextoDuplicidade(`${questaoExistente.enunciado || ''} ${Object.values(questaoExistente.alternativas || {}).join(' ')}`)
  const similaridadeEnunciado = calcularSimilaridadePorTokens(enunciadoNovo, enunciadoExistente)
  const similaridadeCompleta = calcularSimilaridadePorTokens(textoNovo, textoExistente)
  const proporcaoTamanho = Math.min(enunciadoNovo.length, enunciadoExistente.length) / Math.max(enunciadoNovo.length, enunciadoExistente.length)
  const contemTrecho = proporcaoTamanho > 0.7 && (enunciadoNovo.includes(enunciadoExistente) || enunciadoExistente.includes(enunciadoNovo))
  const bonusGabarito = questaoExistente.alternativa_correta === dadosQuestao.alternativaCorreta ? 0.04 : 0

  return Math.min(1, Math.max(similaridadeEnunciado, similaridadeCompleta, contemTrecho ? 0.9 : 0) + bonusGabarito)
}

function normalizarTextoDuplicidade(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function calcularSimilaridadePorTokens(textoA, textoB) {
  const tokensA = new Set(textoA.split(' ').filter(token => token.length > 2))
  const tokensB = new Set(textoB.split(' ').filter(token => token.length > 2))

  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let intersecao = 0
  tokensA.forEach(token => {
    if (tokensB.has(token)) intersecao += 1
  })

  return intersecao / Math.max(tokensA.size, tokensB.size)
}

function abrirModalQuestaoDuplicada(dadosQuestao, duplicada) {
  document.getElementById('modal-questao-duplicada')?.remove()

  const modal = document.createElement('div')
  modal.id = 'modal-questao-duplicada'
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal-caixa modal-caixa--larga">
      <div class="modal-topo">
        <div>
          <h3>Possível questão duplicada</h3>
          <p class="modal-subtitulo">Semelhança aproximada: ${Math.round(duplicada.similaridade * 100)}%. Confira antes de salvar.</p>
        </div>
        <button class="modal-fechar" id="btn-fechar-duplicada" type="button">×</button>
      </div>
      <div class="duplicada-comparacao">
        ${criarPainelComparacaoQuestao('Você está tentando salvar', normalizarQuestaoNovaParaComparacao(dadosQuestao))}
        ${criarPainelComparacaoQuestao('Questão já cadastrada', normalizarQuestaoExistenteParaComparacao(duplicada.questao))}
      </div>
      <div class="duplicada-acoes">
        <button class="btn-secundario" id="btn-cancelar-duplicada" type="button">Não salvar agora</button>
        <button class="btn-secundario" id="btn-editar-duplicada-existente" type="button">Editar a existente</button>
        <button class="btn-primario" id="btn-salvar-duplicada-mesmo-assim" type="button">Salvar mesmo assim</button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove()
  })

  document.getElementById('btn-fechar-duplicada').addEventListener('click', () => modal.remove())
  document.getElementById('btn-cancelar-duplicada').addEventListener('click', () => modal.remove())
  document.getElementById('btn-editar-duplicada-existente').addEventListener('click', () => {
    modal.remove()
    abrirModalEdicao(duplicada.questao)
  })
  document.getElementById('btn-salvar-duplicada-mesmo-assim').addEventListener('click', () => {
    modal.remove()
    salvarQuestao({ ignorarDuplicidade: true })
  })
}

function normalizarQuestaoNovaParaComparacao(dadosQuestao) {
  return {
    materiaNome: dadosQuestao.materiaNome,
    topicoNome: obterTextoTopicoSelecionado('q-edital-topico'),
    banca: dadosQuestao.banca,
    data: 'Ainda não salva',
    tipoQuestao: dadosQuestao.tipoQuestao,
    enunciado: dadosQuestao.enunciado,
    alternativas: dadosQuestao.alternativas,
    alternativaMarcada: dadosQuestao.alternativaMarcada,
    alternativaCorreta: dadosQuestao.alternativaCorreta,
    motivoErro: dadosQuestao.motivoErro,
    nivelConfianca: dadosQuestao.nivelConfianca,
    comentario: dadosQuestao.comentario,
    pegadinhaBanca: dadosQuestao.pegadinhaBanca,
    conceitoChave: dadosQuestao.conceitoChave,
    comoReconhecer: dadosQuestao.comoReconhecer,
    acaoCorretiva: dadosQuestao.acaoCorretiva
  }
}

function normalizarQuestaoExistenteParaComparacao(q) {
  return {
    materiaNome: q.materias?.nome || 'Sem matéria',
    topicoNome: q.edital_topicos?.titulo || '',
    banca: q.banca || '',
    data: q.criado_em ? new Date(q.criado_em).toLocaleDateString('pt-BR') : 'Sem data',
    tipoQuestao: normalizarTipoQuestao(q),
    enunciado: q.enunciado,
    alternativas: q.alternativas,
    alternativaMarcada: q.alternativa_marcada,
    alternativaCorreta: q.alternativa_correta,
    motivoErro: q.motivo_erro,
    nivelConfianca: q.nivel_confianca,
    comentario: q.comentario,
    pegadinhaBanca: q.pegadinha_banca,
    conceitoChave: q.conceito_chave,
    comoReconhecer: q.como_reconhecer,
    acaoCorretiva: q.acao_corretiva
  }
}

function criarPainelComparacaoQuestao(titulo, q) {
  const alternativas = q.alternativas && typeof q.alternativas === 'object'
    ? Object.entries(q.alternativas).map(([letra, texto]) => `
        <div class="alternativa-card ${letra === q.alternativaCorreta ? 'alt-certa' : ''} ${letra === q.alternativaMarcada && letra !== q.alternativaCorreta ? 'alt-errada' : ''}">
          <span class="alt-letra">${escaparHtmlSeguro(letra)}</span>
          <span class="alt-texto">${escaparHtmlSeguro(texto)}</span>
        </div>
      `).join('')
    : '<p class="duplicada-vazio">Sem alternativas registradas.</p>'

  const diagnosticos = [
    q.motivoErro ? ['Motivo', q.motivoErro] : null,
    q.nivelConfianca ? ['Confiança', q.nivelConfianca] : null,
    q.comentario ? ['Comentário', q.comentario] : null,
    q.pegadinhaBanca ? ['Pegadinhas', q.pegadinhaBanca] : null,
    q.conceitoChave ? ['Conceito', q.conceitoChave] : null,
    q.comoReconhecer ? ['Reconhecer', q.comoReconhecer] : null,
    q.acaoCorretiva ? ['Ação', q.acaoCorretiva] : null
  ].filter(Boolean)

  return `
    <section class="duplicada-painel">
      <h4>${escaparHtmlSeguro(titulo)}</h4>
      <div class="duplicada-meta">
        <span>${escaparHtmlSeguro(q.materiaNome)}</span>
        ${q.topicoNome ? `<span>${escaparHtmlSeguro(q.topicoNome)}</span>` : ''}
        ${q.banca ? `<span>${escaparHtmlSeguro(q.banca)}</span>` : ''}
        <span>${escaparHtmlSeguro(q.data)}</span>
        <span>${escaparHtmlSeguro(obterRotuloTipoQuestao(q.tipoQuestao))}</span>
      </div>
      <p class="duplicada-enunciado">${escaparHtmlSeguro(q.enunciado)}</p>
      <div class="lista-alternativas-card">${alternativas}</div>
      <div class="card-questao-alternativas">
        <span class="tag-errada">Marquei: ${escaparHtmlSeguro(q.alternativaMarcada)}</span>
        <span class="tag-certa">Correta: ${escaparHtmlSeguro(q.alternativaCorreta)}</span>
      </div>
      ${diagnosticos.length > 0 ? `
        <div class="card-questao-diagnostico duplicada-diagnostico">
          ${diagnosticos.map(([rotulo, texto]) => `
            <div class="diagnostico-item">
              <span class="diagnostico-rotulo">${escaparHtmlSeguro(rotulo)}</span>
              <p>${escaparHtmlSeguro(texto)}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </section>
  `
}

// ============================================
// ASSISTENTE DE IA PARA DIAGNÓSTICO DA QUESTÃO
// ============================================
async function analisarQuestaoComIA(destino = 'cadastro') {
  const botao = document.getElementById(destino === 'edicao' ? 'btn-analisar-ia-edicao' : 'btn-analisar-ia')
  const rotuloOriginal = botao?.textContent?.trim() || 'Analisar com IA e sugerir preenchimento'
  const dados = coletarDadosAssistenteIA(destino)

  if (!dados.enunciado && !dados.comentario) {
    mostrarMsgAssistenteIA(destino, 'Cole o enunciado, as alternativas ou o comentário antes de analisar com IA.', 'erro')
    return
  }

  if (typeof db === 'undefined' || !db?.functions?.invoke) {
    mostrarMsgAssistenteIA(destino, 'A integração com IA precisa do Supabase Functions disponível no projeto.', 'erro')
    return
  }

  if (botao) {
    botao.disabled = true
    botao.textContent = 'Analisando com IA...'
  }

  mostrarMsgAssistenteIA(destino, 'A IA está analisando a questão. Isso pode levar alguns segundos.', '')

  try {
    const { data, error } = await db.functions.invoke('assistente-ia-questao', {
      body: { questao: dados }
    })

    if (error) throw error
    if (!data?.campos) throw new Error('A IA não retornou campos estruturados.')

    const preenchidos = await aplicarSugestoesAssistenteIA(destino, data.campos)

    if (preenchidos.length === 0) {
      mostrarMsgAssistenteIA(destino, 'A IA respondeu, mas não encontrei sugestões úteis para preencher os campos.', 'erro')
      return
    }

    const restante = Number.isFinite(data?.cota?.restante)
      ? ` Restam ${data.cota.restante} análise${data.cota.restante === 1 ? '' : 's'} hoje.`
      : ''

    mostrarMsgAssistenteIA(
      destino,
      `Sugestões aplicadas: ${preenchidos.join(', ')}. Revise antes de salvar.${restante}`,
      'sucesso'
    )
  } catch (erro) {
    console.error('Erro ao analisar questão com IA:', erro)
    mostrarMsgAssistenteIA(destino, obterMensagemErroAssistenteIA(erro), 'erro')
  } finally {
    if (botao) {
      botao.disabled = false
      botao.textContent = rotuloOriginal
    }
  }
}

function coletarDadosAssistenteIA(destino = 'cadastro') {
  const edicao = destino === 'edicao'
  const prefixo = edicao ? 'edit' : 'q'
  const selectMateria = document.getElementById(`${prefixo}-materia`)
  const selectTopico = document.getElementById(`${prefixo}-edital-topico`)
  const tipoQuestao = edicao
    ? document.getElementById('edit-tipo-questao')?.value || ''
    : tipoQuestaoAtual
  const alternativas = edicao ? coletarTextosAlternativasEdicao() : coletarTextosAlternativas()
  const marcada = edicao ? obterAlternativaSelecionadaEdicao('marcada') : alternativaMarcada
  const correta = edicao ? obterAlternativaSelecionadaEdicao('correta') : alternativaCorreta
  const motivosDisponiveis = [...new Set([
    ...CONFIG_TIPO_QUESTAO.Errada.motivos,
    ...CONFIG_TIPO_QUESTAO.Chutada.motivos
  ])]
  const niveisDisponiveis = [...new Set([
    ...CONFIG_TIPO_QUESTAO.Errada.niveis,
    ...CONFIG_TIPO_QUESTAO.Chutada.niveis
  ])]

  return {
    materia: selectMateria?.value ? selectMateria.selectedOptions?.[0]?.text?.trim() || '' : '',
    assunto_edital: selectTopico?.value ? selectTopico.selectedOptions?.[0]?.text?.trim() || '' : '',
    materias_disponiveis: obterOptionsTextoSelect(selectMateria),
    assuntos_disponiveis: obterOptionsTextoSelect(selectTopico),
    banca: document.getElementById(`${prefixo}-banca`)?.value.trim() || '',
    tipo_questao: tipoQuestao,
    motivos_disponiveis: motivosDisponiveis,
    niveis_confianca_disponiveis: niveisDisponiveis,
    motivo_atual: document.getElementById(`${prefixo}-motivo-erro`)?.value || '',
    nivel_confianca_atual: document.getElementById(`${prefixo}-nivel-confianca`)?.value || '',
    enunciado: document.getElementById(`${prefixo}-enunciado`)?.value.trim() || '',
    alternativas,
    alternativas_formatadas: formatarAlternativasPrompt(alternativas),
    alternativa_marcada: formatarAlternativaSelecionadaPrompt(marcada, alternativas),
    alternativa_correta: formatarAlternativaSelecionadaPrompt(correta, alternativas),
    comentario: document.getElementById(`${prefixo}-comentario`)?.value.trim() || '',
    pegadinhas_atuais: document.getElementById(`${prefixo}-pegadinha-banca`)?.value.trim() || '',
    conceito_atual: document.getElementById(`${prefixo}-conceito-chave`)?.value.trim() || '',
    reconhecer_atual: document.getElementById(`${prefixo}-como-reconhecer`)?.value.trim() || '',
    acao_atual: document.getElementById(`${prefixo}-acao-corretiva`)?.value.trim() || ''
  }
}

function obterOptionsTextoSelect(select) {
  if (!select) return []
  return Array.from(select.options)
    .map(option => option.textContent?.trim() || '')
    .filter(texto => texto && !/^selecione|^sem assunto|^nenhuma/i.test(texto))
}

async function aplicarSugestoesAssistenteIA(destino, campos) {
  const prefixo = destino === 'edicao' ? 'edit' : 'q'
  const preenchidos = []
  const alvos = obterCamposRespostaChatGPT(destino)

  const tipoQuestao = normalizarTipoSugeridoIA(campos.tipo_questao_sugerido)
  if (tipoQuestao) {
    if (destino === 'edicao') {
      const selectTipo = document.getElementById('edit-tipo-questao')
      if (selectTipo && selectTipo.value !== tipoQuestao) {
        selectTipo.value = tipoQuestao
        atualizarCamposEdicaoPorTipo(tipoQuestao, true)
        preenchidos.push('tipo da questão')
      }
    } else if (tipoQuestao !== tipoQuestaoAtual) {
      selecionarTipoQuestao(tipoQuestao, true)
      preenchidos.push('tipo da questão')
    }
  }

  if (await selecionarMateriaPorSugestaoIA(destino, campos.materia_sugerida)) {
    preenchidos.push('matéria')
  }

  if (selecionarOptionPorTexto(`${prefixo}-edital-topico`, campos.assunto_sugerido, true)) {
    preenchidos.push('assunto do edital')
  }

  if (preencherCampoTextoIA(document.getElementById(`${prefixo}-banca`), campos.banca_sugerida)) {
    preenchidos.push('banca')
  }

  if (selecionarOptionPorTexto(`${prefixo}-motivo-erro`, campos.motivo_erro_sugerido, false)) {
    preenchidos.push('motivo do erro')
  }

  if (selecionarOptionPorTexto(`${prefixo}-nivel-confianca`, campos.nivel_confianca_sugerido, false)) {
    preenchidos.push('confiança')
  }

  const reconhecer = juntarPartesIA([
    campos.reconhecer,
    campos.tipo_cobranca ? `Tipo de cobrança: ${campos.tipo_cobranca}` : '',
    campos.explicacao_curta ? `Explicação curta: ${campos.explicacao_curta}` : ''
  ])
  const acao = juntarPartesIA([
    campos.acao,
    campos.observacao_revisao ? `Observação para revisão: ${campos.observacao_revisao}` : ''
  ])

  if (preencherCampoTextoIA(alvos.pegadinhas, campos.pegadinhas)) preenchidos.push('pegadinhas')
  if (campos.pegadinhas) sincronizarChipsPegadinha(document.getElementById(`${prefixo}-pegadinha-chips`), alvos.pegadinhas?.value || '')
  if (preencherCampoTextoIA(alvos.conceito, campos.conceito)) preenchidos.push('conceito')
  if (preencherCampoTextoIA(alvos.reconhecer, reconhecer)) preenchidos.push('como reconhecer')
  if (acao && alvos.acao) {
    const sugestaoAutomatica = obterAcaoCorretivaSugerida(document.getElementById(`${prefixo}-motivo-erro`)?.value || '')
    if (sugestaoAutomatica && normalizarTextoIA(alvos.acao.value) === normalizarTextoIA(sugestaoAutomatica)) {
      alvos.acao.value = ''
    }
  }
  if (preencherCampoTextoIA(alvos.acao, acao)) preenchidos.push('ação corretiva')

  return preenchidos
}

async function selecionarMateriaPorSugestaoIA(destino, materiaSugerida) {
  const prefixo = destino === 'edicao' ? 'edit' : 'q'
  const select = document.getElementById(`${prefixo}-materia`)

  if (!selecionarOptionPorTexto(`${prefixo}-materia`, materiaSugerida, true)) return false

  if (destino === 'edicao') {
    await carregarTopicosEdicao(select.value, '')
  } else {
    await carregarTopicosQuestao()
  }

  return true
}

function preencherCampoTextoIA(campo, valor) {
  const texto = String(valor || '').trim()
  if (!campo || !texto) return false

  const atual = campo.value.trim()
  if (!atual) {
    campo.value = texto
    return true
  }

  if (normalizarTextoIA(atual).includes(normalizarTextoIA(texto))) return false

  campo.value = `${atual}\n\nSugestão da IA: ${texto}`
  return true
}

function selecionarOptionPorTexto(selectId, texto, apenasSeVazio = false) {
  const select = document.getElementById(selectId)
  const alvo = normalizarTextoIA(texto)
  if (!select || !alvo) return false
  if (apenasSeVazio && select.value) return false

  const opcoes = Array.from(select.options).filter(option => option.value)
  const encontrada = opcoes.find(option => normalizarTextoIA(option.textContent) === alvo)
    || opcoes.find(option => normalizarTextoIA(option.textContent).includes(alvo) || alvo.includes(normalizarTextoIA(option.textContent)))

  if (!encontrada || select.value === encontrada.value) return false
  select.value = encontrada.value
  return true
}

function normalizarTipoSugeridoIA(tipo) {
  const normalizado = normalizarTextoIA(tipo)
  if (!normalizado) return ''
  if (normalizado.includes('chutada') || normalizado.includes('chute')) return 'Chutada'
  if (normalizado.includes('errada') || normalizado.includes('erro')) return 'Errada'
  return ''
}

function juntarPartesIA(partes) {
  return partes
    .map(parte => String(parte || '').trim())
    .filter(Boolean)
    .join('\n')
}

function normalizarTextoIA(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function mostrarMsgAssistenteIA(destino, texto, tipo) {
  const msg = document.getElementById(destino === 'edicao' ? 'msg-edicao' : 'msg-questao')
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo || ''}`.trim()
}

function obterMensagemErroAssistenteIA(erro) {
  const mensagem = erro?.message || ''
  const status = erro?.context?.status || erro?.status

  if (status === 404 || /not found|404/i.test(mensagem)) {
    return 'A função assistente-ia-questao ainda não está configurada no Supabase. Use o prompt da IA enquanto isso.'
  }

  if (status === 429 || /429|limit|quota|cota|limite/i.test(mensagem)) {
    return 'Você atingiu o limite diário de análises com IA. Tente novamente amanhã ou use o prompt manual.'
  }

  if ([401, 403].includes(status) || /401|403|auth|jwt|unauthorized/i.test(mensagem)) {
    return 'Não foi possível confirmar sua sessão para usar a IA. Saia e entre novamente.'
  }

  if (status >= 500 || /edge function returned/i.test(mensagem)) {
    return 'A função de IA respondeu com erro interno. Abra os Logs da Edge Function para ver o motivo exato.'
  }

  return 'Não foi possível analisar com IA agora. Confira a configuração da função no Supabase ou use o prompt manual.'
}

function abrirPromptChatGPT() {
  const prompt = gerarPromptChatGPT()
  abrirModalPromptChatGPT(prompt)
}

function abrirPromptChatGPTEdicao() {
  const prompt = gerarPromptChatGPTEdicao()
  abrirModalPromptChatGPT(prompt)
}

function abrirModalPromptChatGPT(prompt) {
  document.getElementById('modal-prompt-chatgpt')?.remove()

  const modal = document.createElement('div')
  modal.id = 'modal-prompt-chatgpt'
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal-caixa">
      <div class="modal-topo">
        <h3>Prompt para IA</h3>
        <button class="modal-fechar" id="btn-fechar-prompt-chatgpt" type="button">✕</button>
      </div>
      <textarea
        id="texto-prompt-chatgpt"
        class="input-texto input-textarea prompt-chatgpt-textarea"
        spellcheck="false"
      ></textarea>
      <div class="prompt-chatgpt-acoes">
        <button class="btn-primario" id="btn-copiar-prompt-chatgpt" type="button">Copiar prompt</button>
        <button class="btn-secundario" id="btn-cancelar-prompt-chatgpt" type="button">Fechar</button>
      </div>
      <p class="prompt-chatgpt-feedback" id="msg-prompt-chatgpt"></p>
    </div>
  `

  document.body.appendChild(modal)

  const textarea = document.getElementById('texto-prompt-chatgpt')
  textarea.value = prompt
  textarea.focus()
  textarea.select()

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove()
  })

  document.getElementById('btn-fechar-prompt-chatgpt')
    .addEventListener('click', () => modal.remove())

  document.getElementById('btn-cancelar-prompt-chatgpt')
    .addEventListener('click', () => modal.remove())

  document.getElementById('btn-copiar-prompt-chatgpt')
    .addEventListener('click', copiarPromptChatGPT)
}

function gerarPromptChatGPT() {
  const selectMateria = document.getElementById('q-materia')
  const materia = selectMateria?.value
    ? selectMateria.selectedOptions?.[0]?.text?.trim() || ''
    : ''
  const enunciado = document.getElementById('q-enunciado')?.value.trim() || ''
  const comentario = document.getElementById('q-comentario')?.value.trim() || ''
  const selectTopico = document.getElementById('q-edital-topico')
  const topico = selectTopico?.value ? selectTopico.selectedOptions?.[0]?.text?.trim() || '' : ''
  const banca = document.getElementById('q-banca')?.value.trim() || ''
  const motivoErro = document.getElementById('q-motivo-erro')?.value || ''
  const pegadinha = document.getElementById('q-pegadinha-banca')?.value.trim() || ''
  const alternativas = coletarTextosAlternativas()
  const textoAlternativas = formatarAlternativasPrompt(alternativas)
  const textoMarcada = formatarAlternativaSelecionadaPrompt(alternativaMarcada, alternativas)
  const textoCorreta = formatarAlternativaSelecionadaPrompt(alternativaCorreta, alternativas)

  return montarPromptDiagnosticoChatGPT({
    materia,
    topico,
    banca,
    tipoQuestao: tipoQuestaoAtual,
    enunciado,
    textoAlternativas,
    textoMarcada,
    textoCorreta,
    comentario,
    motivoErro,
    pegadinha
  })
}

function gerarPromptChatGPTEdicao() {
  const selectMateria = document.getElementById('edit-materia')
  const materia = selectMateria?.value
    ? selectMateria.selectedOptions?.[0]?.text?.trim() || ''
    : ''
  const enunciado = document.getElementById('edit-enunciado')?.value.trim() || ''
  const comentario = document.getElementById('edit-comentario')?.value.trim() || ''
  const selectTopico = document.getElementById('edit-edital-topico')
  const topico = selectTopico?.value ? selectTopico.selectedOptions?.[0]?.text?.trim() || '' : ''
  const banca = document.getElementById('edit-banca')?.value.trim() || ''
  const motivoErro = document.getElementById('edit-motivo-erro')?.value || ''
  const pegadinha = document.getElementById('edit-pegadinha-banca')?.value.trim() || ''
  const tipoQuestao = document.getElementById('edit-tipo-questao')?.value || ''
  const alternativas = coletarTextosAlternativasEdicao()
  const textoAlternativas = formatarAlternativasPrompt(alternativas)
  const textoMarcada = formatarAlternativaSelecionadaPrompt(obterAlternativaSelecionadaEdicao('marcada'), alternativas)
  const textoCorreta = formatarAlternativaSelecionadaPrompt(obterAlternativaSelecionadaEdicao('correta'), alternativas)

  return montarPromptDiagnosticoChatGPT({
    materia,
    topico,
    banca,
    tipoQuestao,
    enunciado,
    textoAlternativas,
    textoMarcada,
    textoCorreta,
    comentario,
    motivoErro,
    pegadinha
  })
}

function montarPromptDiagnosticoChatGPT(dados) {
  const temComentario = Boolean(String(dados.comentario || '').trim())
  const orientacaoComentario = temComentario
    ? 'Use o comentário do professor/alunos como fonte principal para entender a questão e transformar essa fonte em uma explicação didática para estudo. Se o comentário tiver informações conflitantes, priorize a explicação mais técnica/provável.'
    : 'Como não há comentário original, analise o enunciado, as alternativas, a alternativa correta, a alternativa marcada e o motivo do erro, se houver. Mesmo sem comentário original, tente explicar a questão com base no material disponível, sem inventar fundamento externo.'

  return `Você é uma IA assistente de estudos para concursos. Vou te enviar uma questão e/ou o comentário do professor, banca ou alunos.

Sua tarefa é usar esse material apenas como fonte e preencher os campos de diagnóstico do meu caderno de erros, incluindo as pegadinhas da questão.

${orientacaoComentario}

Não invente lei, artigo, súmula, jurisprudência, doutrina ou fundamento que não apareça no material fornecido. Se faltar informação, diga objetivamente que falta informação.

Analise também armadilhas comuns de concursos presentes no enunciado e nas alternativas, como:
- palavras absolutas ou restritivas: sempre, nunca, somente, apenas, todos, nenhum;
- trocas de conceitos parecidos;
- inversão de lógica;
- exceções escondidas;
- termos ambíguos;
- mudanças sutis na redação;
- alternativas parcialmente corretas;
- interpretação induzida ao erro;
- cobrança literal de lei versus interpretação doutrinária.

Responda exatamente no formato abaixo, sem mudar os rótulos, sem adicionar rótulos extras e sem usar subtítulos dentro dos campos. Dentro de PEGADINHAS, não inicie linhas com termos que pareçam rótulos oficiais, como CONCEITO:, RECONHECER: ou AÇÃO CORRETIVA:.

COMENTÁRIO:
- Alternativa correta: explique de forma didática por que está correta.
- Alternativa marcada pelo usuário, se houver: explique por que está errada.
- Demais alternativas: explique por que estão erradas, quando houver informação suficiente no enunciado, nas alternativas ou no comentário fornecido.
- Síntese do aprendizado: explique o conceito central cobrado pela banca, a armadilha ou raciocínio que poderia levar ao erro e o que devo memorizar para não errar novamente.
- Se faltar informação para justificar alguma alternativa, diga objetivamente que o material não traz informação suficiente para explicar aquela alternativa.

PEGADINHAS:
[aponte objetivamente as armadilhas da questão em texto corrido ou lista simples. Se não houver pegadinha clara, diga "Não identifiquei pegadinha relevante".]

CONCEITO:
[diga qual regra, conceito, artigo, fórmula, entendimento ou ideia central resolve a questão]

RECONHECER:
[mostre quais palavras-chave, sinais no enunciado ou padrão de cobrança indicam que devo aplicar esse conceito]

AÇÃO CORRETIVA:
[dê uma ação prática para evitar repetir o erro, como revisar um tópico, fazer questões semelhantes, criar flashcard ou memorizar uma distinção]

Dados da questão:

Matéria:
${valorOuNaoInformado(dados.materia)}

Assunto do edital:
${valorOuNaoInformado(dados.topico)}

Banca:
${valorOuNaoInformado(dados.banca)}

Tipo de registro:
${valorOuNaoInformado(dados.tipoQuestao)}

Motivo do erro:
${valorOuNaoInformado(dados.motivoErro)}

Enunciado:
${valorOuNaoInformado(dados.enunciado)}

Alternativas:
${valorOuNaoInformado(dados.textoAlternativas)}

Alternativa que marquei:
${valorOuNaoInformado(dados.textoMarcada)}

Alternativa correta:
${valorOuNaoInformado(dados.textoCorreta)}

Comentário/observação original, se houver, para usar apenas como fonte:
${valorOuNaoInformado(dados.comentario)}

Pegadinhas da questão já percebidas:
${valorOuNaoInformado(dados.pegadinha)}`
}

function coletarTextosAlternativasEdicao() {
  const alternativas = {}
  document.querySelectorAll('.edit-alt').forEach(input => {
    alternativas[input.dataset.letra] = input.value.trim()
  })
  return alternativas
}

function obterAlternativaSelecionadaEdicao(tipo) {
  const seletor = tipo === 'correta'
    ? '.edit-btn-correta.selecionado-certo'
    : '.edit-btn-marcada.selecionado-errado'
  return document.querySelector(seletor)?.dataset.letra || ''
}

function formatarAlternativasPrompt(alternativas) {
  return Object.entries(alternativas)
    .filter(([, texto]) => texto)
    .map(([letra, texto]) => `${letra}) ${texto}`)
    .join('\n')
}

function formatarAlternativaSelecionadaPrompt(letra, alternativas) {
  if (!letra) return ''
  const texto = alternativas[letra]
  return texto ? `${letra}) ${texto}` : letra
}

function valorOuNaoInformado(valor) {
  return String(valor || '').trim() || '[não informado]'
}

async function copiarPromptChatGPT() {
  const textarea = document.getElementById('texto-prompt-chatgpt')
  const feedback = document.getElementById('msg-prompt-chatgpt')

  try {
    await navigator.clipboard.writeText(textarea.value)
    feedback.textContent = 'Prompt copiado.'
  } catch {
    textarea.focus()
    textarea.select()
    document.execCommand('copy')
    feedback.textContent = 'Prompt selecionado para copiar.'
  }
}

async function copiarModeloRespostaChatGPT(event) {
  const botao = event?.currentTarget
  const textoOriginal = botao?.textContent

  try {
    await navigator.clipboard.writeText(MODELO_RESPOSTA_CHATGPT)
    if (botao) botao.textContent = 'Modelo copiado.'
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = MODELO_RESPOSTA_CHATGPT
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
    if (botao) botao.textContent = 'Modelo selecionado para copiar.'
  }

  if (botao && textoOriginal) {
    setTimeout(() => {
      botao.textContent = textoOriginal
    }, 1400)
  }
}

function abrirColarRespostaChatGPT() {
  abrirModalColarRespostaChatGPT('cadastro')
}

function abrirColarRespostaChatGPTEdicao() {
  abrirModalColarRespostaChatGPT('edicao')
}

const CAMPOS_PREVIA_RESPOSTA_CHATGPT = [
  { chave: 'comentario', rotulo: 'Comentário' },
  { chave: 'pegadinhas', rotulo: 'Pegadinhas' },
  { chave: 'conceito', rotulo: 'Conceito' },
  { chave: 'reconhecer', rotulo: 'Como reconhecer na próxima vez' },
  { chave: 'acao', rotulo: 'Ação corretiva' }
]

function abrirModalColarRespostaChatGPT(destino = 'cadastro') {
  document.getElementById('modal-resposta-chatgpt')?.remove()

  const modal = document.createElement('div')
  modal.id = 'modal-resposta-chatgpt'
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal-caixa">
      <div class="modal-topo">
        <h3>Colar resposta da IA</h3>
        <button class="modal-fechar" id="btn-fechar-resposta-chatgpt" type="button">✕</button>
      </div>
      <textarea
        id="texto-resposta-chatgpt"
        class="input-texto input-textarea prompt-chatgpt-textarea"
        placeholder="Cole aqui a resposta que veio com PEGADINHAS, CONCEITO, RECONHECER e ACAO..."
        spellcheck="false"
      ></textarea>
      <div class="prompt-chatgpt-acoes">
        <button class="btn-primario" id="btn-aplicar-resposta-chatgpt" type="button">Preencher campos</button>
        <button class="btn-secundario" id="btn-cancelar-resposta-chatgpt" type="button">Fechar</button>
      </div>
      <p class="prompt-chatgpt-feedback" id="msg-resposta-chatgpt"></p>
    </div>
  `

  document.body.appendChild(modal)

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove()
  })

  document.getElementById('btn-fechar-resposta-chatgpt')
    .addEventListener('click', () => modal.remove())

  document.getElementById('btn-cancelar-resposta-chatgpt')
    .addEventListener('click', () => modal.remove())

  document.getElementById('btn-aplicar-resposta-chatgpt')
    .addEventListener('click', () => previsualizarRespostaChatGPT(modal, destino))

  document.getElementById('texto-resposta-chatgpt').focus()
}

function previsualizarRespostaChatGPT(modal, destino = 'cadastro') {
  const texto = document.getElementById('texto-resposta-chatgpt')?.value || ''
  const feedback = document.getElementById('msg-resposta-chatgpt')
  const campos = extrairCamposRespostaChatGPT(texto)

  if (!respostaChatGPTTemCampoIdentificado(campos)) {
    feedback.textContent = 'Não encontrei os rótulos COMENTÁRIO, PEGADINHAS, CONCEITO, RECONHECER e ACAO. O comentário original foi preservado.'
    feedback.className = 'prompt-chatgpt-feedback prompt-chatgpt-feedback--erro'
    return
  }

  mostrarPreviaRespostaChatGPT(modal, destino, campos)
}

function mostrarPreviaRespostaChatGPT(modal, destino, campos) {
  const decisoes = obterDecisoesPreviaRespostaChatGPT(campos, destino)
  const blocos = decisoes.map(({ chave, rotulo, valor, conflitoManual, sugestaoAutomatica }) => {
    const avisoConflito = conflitoManual
      ? `
        <div class="preview-resposta-ia-aviso">
          <strong>Este campo já possui conteúdo.</strong>
          <div class="preview-resposta-ia-escolhas" role="radiogroup" aria-label="Escolha para ${escaparHtmlSeguro(rotulo)}">
            <label>
              <input type="radio" name="preview-resposta-${chave}" data-preview-campo="${chave}" value="manter" checked>
              Manter texto atual
            </label>
            <label>
              <input type="radio" name="preview-resposta-${chave}" data-preview-campo="${chave}" value="substituir">
              Substituir pela IA
            </label>
          </div>
        </div>
      `
      : ''
    const avisoAutomatico = sugestaoAutomatica
      ? '<p class="preview-resposta-ia-info">Este campo tem apenas uma sugestão automática e será substituído pela IA.</p>'
      : ''

    return `
      <section class="preview-resposta-ia-bloco">
        <h4>${escaparHtmlSeguro(rotulo)}</h4>
        <p class="preview-resposta-ia-texto ${valor ? '' : 'preview-resposta-ia-vazio'}">${escaparHtmlSeguro(valor || 'Não identificado na resposta da IA.')}</p>
        ${avisoConflito}
        ${avisoAutomatico}
      </section>
    `
  }).join('')

  modal.innerHTML = `
    <div class="modal-caixa modal-caixa--preview-ia">
      <div class="modal-topo">
        <h3>Prévia da resposta da IA</h3>
        <button class="modal-fechar" id="btn-fechar-preview-resposta-chatgpt" type="button">✕</button>
      </div>
      <p class="preview-resposta-ia-subtitulo">Confira os campos identificados antes de preencher o caderno de erros.</p>
      <div class="preview-resposta-ia-grid">
        ${blocos}
      </div>
      <div class="prompt-chatgpt-acoes preview-resposta-ia-acoes">
        <button class="btn-primario" id="btn-confirmar-preview-resposta-chatgpt" type="button">Preencher campos</button>
        <button class="btn-secundario" id="btn-cancelar-preview-resposta-chatgpt" type="button">Cancelar</button>
      </div>
      <p class="prompt-chatgpt-feedback" id="msg-preview-resposta-chatgpt"></p>
    </div>
  `

  document.getElementById('btn-fechar-preview-resposta-chatgpt')
    .addEventListener('click', () => modal.remove())

  document.getElementById('btn-cancelar-preview-resposta-chatgpt')
    .addEventListener('click', () => modal.remove())

  document.getElementById('btn-confirmar-preview-resposta-chatgpt')
    .addEventListener('click', () => {
      const escolhas = obterEscolhasPreviaRespostaChatGPT(modal)
      const preenchidos = preencherCamposRespostaChatGPT(campos, destino, escolhas)
      if (preenchidos.length === 0 && !respostaChatGPTTemCampoIdentificado(campos)) {
        const feedback = document.getElementById('msg-preview-resposta-chatgpt')
        feedback.textContent = 'Não foi possível preencher campos nesta tela.'
        feedback.className = 'prompt-chatgpt-feedback prompt-chatgpt-feedback--erro'
        return
      }
      modal.remove()
    })
}

function obterDecisoesPreviaRespostaChatGPT(campos, destino) {
  const alvos = obterCamposRespostaChatGPT(destino)
  return CAMPOS_PREVIA_RESPOSTA_CHATGPT.map(({ chave, rotulo }) => {
    const valor = campos[chave] || ''
    const valorAtual = alvos[chave]?.value?.trim() || ''
    const sugestaoAutomatica = Boolean(valor && valorAtual && campoTemSugestaoAutomaticaRespostaChatGPT(chave, valorAtual, destino))
    const conflitoManual = Boolean(valor && valorAtual && !sugestaoAutomatica)
    return { chave, rotulo, valor, valorAtual, conflitoManual, sugestaoAutomatica }
  })
}

function obterEscolhasPreviaRespostaChatGPT(modal) {
  const escolhas = {}
  modal.querySelectorAll('input[data-preview-campo]:checked').forEach(input => {
    escolhas[input.dataset.previewCampo] = input.value
  })
  return escolhas
}

function respostaChatGPTTemCampoIdentificado(campos) {
  return CAMPOS_PREVIA_RESPOSTA_CHATGPT.some(({ chave }) => Boolean(campos[chave]))
}

function aplicarRespostaChatGPT(modal, destino = 'cadastro') {
  const texto = document.getElementById('texto-resposta-chatgpt').value
  const feedback = document.getElementById('msg-resposta-chatgpt')
  const campos = extrairCamposRespostaChatGPT(texto)
  const preenchidos = preencherCamposRespostaChatGPT(campos, destino)

  if (preenchidos.length === 0) {
    feedback.textContent = 'Não encontrei os rótulos COMENTÁRIO, PEGADINHAS, CONCEITO, RECONHECER e ACAO. O comentário original foi preservado.'
    feedback.className = 'prompt-chatgpt-feedback prompt-chatgpt-feedback--erro'
    return
  }

  feedback.textContent = `${preenchidos.join(', ')} preenchido${preenchidos.length > 1 ? 's' : ''}.`
  feedback.className = 'prompt-chatgpt-feedback'

  setTimeout(() => modal.remove(), 700)
}

function preencherCamposRespostaChatGPT(campos, destino = 'cadastro', escolhas = {}) {
  const alvos = obterCamposRespostaChatGPT(destino)
  const preenchidos = []

  if (devePreencherCampoRespostaChatGPT('comentario', campos.comentario, alvos.comentario, destino, escolhas)) {
    alvos.comentario.value = campos.comentario
    preenchidos.push('Comentário')
  }

  if (devePreencherCampoRespostaChatGPT('pegadinhas', campos.pegadinhas, alvos.pegadinhas, destino, escolhas)) {
    alvos.pegadinhas.value = campos.pegadinhas
    sincronizarChipsPegadinha(document.getElementById(`${destino === 'edicao' ? 'edit' : 'q'}-pegadinha-chips`), campos.pegadinhas)
    preenchidos.push('Pegadinhas')
  }

  if (devePreencherCampoRespostaChatGPT('conceito', campos.conceito, alvos.conceito, destino, escolhas)) {
    alvos.conceito.value = campos.conceito
    preenchidos.push('Conceito')
  }

  if (devePreencherCampoRespostaChatGPT('reconhecer', campos.reconhecer, alvos.reconhecer, destino, escolhas)) {
    alvos.reconhecer.value = campos.reconhecer
    preenchidos.push('Reconhecer')
  }

  if (devePreencherCampoRespostaChatGPT('acao', campos.acao, alvos.acao, destino, escolhas)) {
    alvos.acao.value = campos.acao
    preenchidos.push('Ação')
  }

  return preenchidos
}

function devePreencherCampoRespostaChatGPT(chave, valor, campo, destino, escolhas = {}) {
  if (!valor || !campo) return false
  const valorAtual = campo.value.trim()
  if (!valorAtual) return true
  if (campoTemSugestaoAutomaticaRespostaChatGPT(chave, valorAtual, destino)) return true
  return escolhas[chave] === 'substituir'
}

function campoTemSugestaoAutomaticaRespostaChatGPT(chave, valorAtual, destino) {
  if (chave !== 'acao' || !valorAtual) return false
  const prefixo = destino === 'edicao' ? 'edit' : 'q'
  const motivo = document.getElementById(`${prefixo}-motivo-erro`)?.value || ''
  const sugestao = obterAcaoCorretivaSugerida(motivo)
  return Boolean(sugestao && normalizarTextoIA(valorAtual) === normalizarTextoIA(sugestao))
}

function obterCamposRespostaChatGPT(destino) {
  const prefixo = destino === 'edicao' ? 'edit' : 'q'
  return {
    comentario: document.getElementById(`${prefixo}-comentario`),
    pegadinhas: document.getElementById(`${prefixo}-pegadinha-banca`),
    conceito: document.getElementById(`${prefixo}-conceito-chave`),
    reconhecer: document.getElementById(`${prefixo}-como-reconhecer`),
    acao: document.getElementById(`${prefixo}-acao-corretiva`)
  }
}

function extrairCamposRespostaChatGPT(texto) {
  const campos = { comentario: '', pegadinhas: '', conceito: '', reconhecer: '', acao: '' }
  let campoAtual = null

  texto.split(/\r?\n/).forEach(linhaOriginal => {
    const linha = linhaOriginal.trimEnd()
    const comDoisPontos = linha.match(/^\s*(?:\d+\.\s*)?([^:]{2,80})\s*:\s*(.*)$/)

    if (comDoisPontos) {
      const chave = identificarCampoRespostaChatGPT(comDoisPontos[1])
      if (chave) {
        campoAtual = chave
        if (comDoisPontos[2]) campos[campoAtual] += `${comDoisPontos[2].trim()}\n`
        return
      }
    }

    const chaveLinhaInteira = identificarCampoRespostaChatGPT(linha)
    if (chaveLinhaInteira && linha.length <= 40) {
      campoAtual = chaveLinhaInteira
      return
    }

    if (campoAtual) campos[campoAtual] += `${linha}\n`
  })

  Object.keys(campos).forEach(chave => {
    campos[chave] = campos[chave].trim()
  })

  return campos
}

function identificarCampoRespostaChatGPT(rotulo) {
  const normalizado = rotulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalizado) return null
  return {
    COMENTARIO: 'comentario',
    'COMENTARIO DO PROFESSOR': 'comentario',
    EXPLICACAO: 'comentario',
    OBSERVACAO: 'comentario',
    PEGADINHA: 'pegadinhas',
    PEGADINHAS: 'pegadinhas',
    CONCEITO: 'conceito',
    'CONCEITO CHAVE': 'conceito',
    RECONHECER: 'reconhecer',
    'COMO RECONHECER': 'reconhecer',
    'COMO RECONHECER NA PROXIMA VEZ': 'reconhecer',
    ACAO: 'acao',
    'ACAO CORRETIVA': 'acao'
  }[normalizado] || null
}

// ============================================
// OBTER OU CRIAR SESSÃO DE HOJE
// ============================================
async function obterOuCriarSessaoDeHoje() {
  const agora = new Date()
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`

  const { data: sessaoExistente, error: erroSessaoExistente } = await db
    .from('sessoes_estudo')
    .select('id, total_questoes')
    .eq('user_id', window.usuarioAtual.id)
    .eq('data', hoje)
    .maybeSingle()

  if (erroSessaoExistente) {
    console.error('Erro ao buscar sessão de estudo do dia.', erroSessaoExistente)
    return null
  }

  if (sessaoExistente) return sessaoExistente

  const { data: novaSessao, error } = await db
    .from('sessoes_estudo')
    .insert({
      user_id:        window.usuarioAtual.id,
      data:           hoje,
      total_questoes: 0
    })
    .select('id, total_questoes')
    .single()

  if (error) {
    console.error('Erro ao criar sessão de estudo do dia.', error)
    return null
  }
  return novaSessao
}

async function recalcularTotalQuestoesSessao(sessaoId) {
  if (!sessaoId || typeof window === 'undefined' || !window.usuarioAtual?.id) return

  const userId = window.usuarioAtual.id
  const [erradasResp, certasResp] = await Promise.all([
    db
      .from('questoes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('sessao_id', sessaoId),
    db
      .from('questoes_certas')
      .select('quantidade')
      .eq('user_id', userId)
      .eq('sessao_id', sessaoId)
  ])

  if (erradasResp.error || certasResp.error) {
    console.warn('Nao foi possivel recalcular o total da sessao.', erradasResp.error || certasResp.error)
    return
  }

  const totalErradas = Number(erradasResp.count) || 0
  const totalCertas = (certasResp.data || [])
    .reduce((acc, registro) => acc + (Number(registro.quantidade) || 0), 0)

  const { error } = await db
    .from('sessoes_estudo')
    .update({ total_questoes: totalErradas + totalCertas })
    .eq('id', sessaoId)
    .eq('user_id', userId)

  if (error) {
    console.warn('Nao foi possivel atualizar o total da sessao.', error)
  }
}

// ============================================
// SALVAR QUESTÃO
// ============================================
async function salvarQuestao(opcoes = {}) {
  const dadosQuestao = montarDadosQuestaoFormulario()
  const materiaId = dadosQuestao.materiaId
  const editalTopicoId = dadosQuestao.editalTopicoId
  const banca = dadosQuestao.banca
  const pegadinhaBanca = dadosQuestao.pegadinhaBanca
  const enunciado = dadosQuestao.enunciado
  const comentario = dadosQuestao.comentario
  const conceitoChave = dadosQuestao.conceitoChave
  const comoReconhecer = dadosQuestao.comoReconhecer
  const acaoCorretiva = dadosQuestao.acaoCorretiva
  let motivoErro = dadosQuestao.motivoErro
  let nivelConfianca = dadosQuestao.nivelConfianca
  const tipoQuestao = dadosQuestao.tipoQuestao
  const configTipoQuestao = obterConfigTipoQuestao(tipoQuestao)
  const btn        = document.getElementById('btn-salvar-questao')
  const alternativas = dadosQuestao.alternativas
  const textoBotaoSalvar = btn.dataset.textoOriginal || btn.textContent
  btn.dataset.textoOriginal = textoBotaoSalvar

  if (modoRegistroQuestao === 'rapido') {
    if (!configTipoQuestao.motivos.includes(motivoErro)) {
      dadosQuestao.motivoErro = 'A diagnosticar'
      motivoErro = dadosQuestao.motivoErro
    }

    if (!configTipoQuestao.niveis.includes(nivelConfianca)) {
      dadosQuestao.nivelConfianca = 'Não informado'
      nivelConfianca = dadosQuestao.nivelConfianca
    }
  }

  if (!materiaId) {
    mostrarMsgQuestao('Selecione uma matéria.', 'erro')
    return
  }
  if (!enunciado) {
    mostrarMsgQuestao('Digite o enunciado da questão.', 'erro')
    return
  }

  for (let i = 0; i < numAlternativas; i++) {
    const letra = LETRAS[i]
    if (!alternativas[letra]) {
      mostrarMsgQuestao(`Preencha o texto da alternativa ${letra}.`, 'erro')
      return
    }
  }

  if (!alternativaMarcada) {
    mostrarMsgQuestao('Selecione a alternativa que você marcou.', 'erro')
    return
  }
  if (!alternativaCorreta) {
    mostrarMsgQuestao('Selecione a alternativa correta.', 'erro')
    return
  }
  if (tipoQuestao === 'Errada' && alternativaMarcada === alternativaCorreta) {
    mostrarMsgQuestao('Para questão errada, a alternativa marcada precisa ser diferente da correta. Se você acertou no chute, selecione "Chutada".', 'erro')
    return
  }

  if (!motivoErro || !configTipoQuestao.motivos.includes(motivoErro)) {
    mostrarMsgQuestao(`Selecione uma opção válida em "${configTipoQuestao.labelMotivo}".`, 'erro')
    return
  }
  if (!nivelConfianca || !configTipoQuestao.niveis.includes(nivelConfianca)) {
    mostrarMsgQuestao(`Selecione uma opção válida em "${configTipoQuestao.labelConfianca}".`, 'erro')
    return
  }
  if (modoRegistroQuestao === 'completo' && !campoDiagnosticoManualPreenchido(motivoErro)) {
    mostrarMsgQuestao(`Selecione uma opção específica em "${configTipoQuestao.labelMotivo}".`, 'erro')
    return
  }
  if (modoRegistroQuestao === 'completo' && !campoDiagnosticoManualPreenchido(nivelConfianca)) {
    mostrarMsgQuestao(`Selecione uma opção específica em "${configTipoQuestao.labelConfianca}".`, 'erro')
    return
  }
  if (modoRegistroQuestao === 'completo' && !conceitoChave) {
    mostrarMsgQuestao('Registre o conceito ou regra que resolve a questão.', 'erro')
    return
  }
  if (modoRegistroQuestao === 'completo' && !comoReconhecer) {
    mostrarMsgQuestao('Registre como reconhecer esse tipo de questão na próxima vez.', 'erro')
    return
  }
  if (modoRegistroQuestao === 'completo' && !acaoCorretiva) {
    mostrarMsgQuestao('Registre uma ação corretiva para esse erro.', 'erro')
    return
  }

  if (!opcoes.ignorarDuplicidade) {
    btn.disabled = true
    btn.textContent = 'Verificando...'

    const duplicada = await buscarPossivelQuestaoDuplicada(dadosQuestao)
    if (duplicada) {
      btn.disabled = false
      btn.textContent = textoBotaoSalvar
      abrirModalQuestaoDuplicada(dadosQuestao, duplicada)
      return
    }
  }

  btn.disabled = true
  btn.textContent = 'Salvando...'

  const sessao = await obterOuCriarSessaoDeHoje()
  if (!sessao) {
    mostrarMsgQuestao('Não foi possível preparar a sessão de estudo de hoje. Verifique sua conexão e tente novamente.', 'erro')
    btn.disabled    = false
    btn.textContent = textoBotaoSalvar
    return
  }

  const { data: questaoSalva, error: erroQuestao } = await db
    .from('questoes')
    .insert({
      user_id:             window.usuarioAtual.id,
      sessao_id:           sessao.id,
      materia_id:          materiaId,
      edital_topico_id:    editalTopicoId || null,
      banca:               banca || null,
      pegadinha_banca:     pegadinhaBanca || null,
      enunciado:           enunciado,
      alternativas:        alternativas,
      alternativa_correta: alternativaCorreta,
      alternativa_marcada: alternativaMarcada,
      tipo_questao:        tipoQuestao,
      status_revisao:      'pendente',
      revisar_novamente_em: adicionarDias(dataHoje(), 1),
      revisao_etapa:       0,
      motivo_erro:         motivoErro,
      nivel_confianca:     nivelConfianca,
      comentario:          comentario || null,
      conceito_chave:      conceitoChave || null,
      como_reconhecer:     comoReconhecer || null,
      acao_corretiva:      acaoCorretiva || null
    })
    .select('id')
    .single()

  if (erroQuestao) {
    console.error(erroQuestao)
    mostrarMsgQuestao('Não foi possível salvar a questão. Confira os SQLs de melhoria e do edital no Supabase e tente novamente.', 'erro')

    // Feedback visual de erro no botão
    btn.style.background = 'var(--cor-erro)'
    btn.textContent = '✗ Erro ao salvar'

    setTimeout(() => {
      btn.style.background = ''
      btn.disabled = false
      btn.textContent = textoBotaoSalvar
    }, 3000)

    return
  }

  if (pegadinhaBanca && typeof registrarPegadinhaDaQuestao === 'function') {
    registrarPegadinhaDaQuestao({
      materiaId,
      topicoId: editalTopicoId,
      banca,
      padrao: pegadinhaBanca
    })
  }

  await recalcularTotalQuestoesSessao(sessao.id)

  limparFormularioQuestaoAposSalvar()

  // Feedback visual de sucesso no botão
  btn.style.background = 'var(--cor-sucesso)'
  btn.textContent = '✓ Salvo!'

  setTimeout(() => {
    btn.style.background = ''
    btn.disabled = false
    btn.textContent = textoBotaoSalvar
  }, 2000)

  mostrarMsgQuestao('Questão salva com sucesso!', 'sucesso')
  setTimeout(() => mostrarMsgQuestao('', ''), 3000)

  questaoRecemSalvaId = questaoSalva?.id || null
  prepararCadernoParaQuestaoNova()

  if (typeof avaliarConquistasUsuario === 'function') {
    await avaliarConquistasUsuario({ atualizarPerfil: true })
  }
  await atualizarTelasAposRegistro({ questaoNova: true })
}

function limparFormularioQuestaoAposSalvar() {
  [
    'q-materia',
    'q-edital-topico',
    'q-banca',
    'q-pegadinha-banca',
    'q-enunciado',
    'q-comentario',
    'q-conceito-chave',
    'q-como-reconhecer',
    'q-acao-corretiva',
    'q-motivo-erro',
    'q-nivel-confianca'
  ].forEach(id => definirValorCampoQuestao(id, ''))

  sincronizarChipsPegadinha(document.getElementById('q-pegadinha-chips'), '')
  selecionarTipoQuestao('Errada', false)
  carregarTopicosQuestao()
  alternativaMarcada = null
  alternativaCorreta = null
  gerarCamposAlternativas(numAlternativas)
  gerarBotoesAlternativas(numAlternativas)
  atualizarAssistenteDiagnosticoMinimo()
}

function definirValorCampoQuestao(id, valor) {
  const campo = document.getElementById(id)
  if (campo) campo.value = valor
}

async function atualizarTelasAposRegistro(opcoes = {}) {
  const tarefas = []

  if (typeof inicializarDashboard === 'function') {
    tarefas.push(inicializarDashboard())
  }

  if (
    typeof carregarEstatisticas === 'function' &&
    typeof estatisticasInicializado !== 'undefined' &&
    estatisticasInicializado
  ) {
    tarefas.push(carregarEstatisticas())
  }

  if (
    typeof carregarDesempenho === 'function' &&
    typeof desempenhoInicializado !== 'undefined' &&
    desempenhoInicializado
  ) {
    tarefas.push(carregarDesempenho())
  }

  if (
    typeof carregarPlanoDia === 'function' &&
    typeof planoInicializado !== 'undefined' &&
    planoInicializado
  ) {
    tarefas.push(carregarPlanoDia())
  }

  // Atualiza a memória das questões (independente da tela visível)
  if (typeof carregarQuestoesEmMemoria === 'function') {
    tarefas.push(carregarQuestoesEmMemoria())
  }

  // Se a seção de questões estiver visível, recarrega a lista na tela
  const secaoQuestoes = document.getElementById('secao-questoes')
  if (secaoQuestoes && !secaoQuestoes.classList.contains('escondido')) {
    if (typeof carregarQuestoes === 'function') {
      tarefas.push(carregarQuestoes(Boolean(opcoes.questaoNova)))
    }
  }

  const resultados = await Promise.allSettled(tarefas)
  resultados.forEach(resultado => {
    if (resultado.status === 'rejected') console.error(resultado.reason)
  })
}

// ============================================
// CARREGAR LISTA DE QUESTÕES
// ============================================

// Função para carregar questões apenas em memória (sem renderizar)
async function carregarQuestoesEmMemoria() {
  const { data, error } = await db
    .from('questoes')
    .select('id, materia_id, edital_topico_id, banca, pegadinha_banca, enunciado, alternativas, alternativa_marcada, alternativa_correta, tipo_questao, status_revisao, revisar_novamente_em, revisao_ultima_data, revisao_ultima_resultado, revisao_total_acertos, revisao_total_erros, revisao_etapa, motivo_erro, nivel_confianca, comentario, conceito_chave, como_reconhecer, acao_corretiva, criado_em, materias(nome), edital_topicos(titulo, status)')
    .eq('user_id', window.usuarioAtual.id)
    .order('criado_em', { ascending: false })

  if (error) {
    console.error('Erro ao carregar questões em memória:', error)
    return
  }

  questoesEmMemoria = data || []
}

async function carregarQuestoes(marcarPrimeiroComoNovo = false) {

  const secaoQuestoes = document.getElementById('secao-questoes')
  
  // Verifica se a seção de questões está visível
  if (!secaoQuestoes || secaoQuestoes.classList.contains('escondido')) {
    // Seção não está visível, não tenta carregar ainda
    return
  }

  const lista = document.getElementById('lista-questoes')

  if (!lista) {
    // Elementos não existem: provavelmente a tela de questões não está visível
    // Não tenta recursão para evitar loop infinito
    return
  }

  mostrarPlaceholderQuestoes(lista, '⏳ Buscando suas questões...')

  const { data, error } = await db
    .from('questoes')
    .select('id, materia_id, edital_topico_id, banca, pegadinha_banca, enunciado, alternativas, alternativa_marcada, alternativa_correta, tipo_questao, status_revisao, revisar_novamente_em, revisao_ultima_data, revisao_ultima_resultado, revisao_total_acertos, revisao_total_erros, revisao_etapa, motivo_erro, nivel_confianca, comentario, conceito_chave, como_reconhecer, acao_corretiva, criado_em, materias(nome), edital_topicos(titulo, status)')
    .eq('user_id', window.usuarioAtual.id)
    .order('criado_em', { ascending: false })

  if (error) {
    console.error(error)
    mostrarPlaceholderQuestoes(lista, '❌ Não foi possível carregar as questões. Confira os SQLs de melhoria e do edital no Supabase e tente novamente.')
    return
  }

  questoesEmMemoria = data || []
  renderizarAcoesCadernoErros(questoesEmMemoria)
  atualizarListaQuestoesCaderno({ marcarPrimeiroComoNovo })
}

function mostrarPlaceholderQuestoes(lista, texto) {
  let placeholder = document.getElementById('placeholder-questoes')
  if (!placeholder) {
    placeholder = document.createElement('p')
    placeholder.id = 'placeholder-questoes'
    placeholder.className = 'texto-placeholder'
  }

  placeholder.textContent = texto
  placeholder.style.display = 'block'
  lista.replaceChildren(placeholder)
}

// Variável para controlar se o listener de delegação já foi adicionado
let listenerDelegacaoAdicionado = false


function renderizarAcoesCadernoErros(questoes) {
  const container = document.getElementById('caderno-erros-acoes')
  if (!container) return
  
  const lista = questoes || []
  const semAssunto = lista.filter(q => !q.edital_topico_id).length
  const diagnosticoReforcar = lista.filter(q => avaliarQualidadeDiagnosticoQuestao(q).status !== 'completo').length
  const comPegadinha = lista.filter(q => String(q.pegadinha_banca || '').trim()).length
  
  if (lista.length === 0) {
    container.innerHTML = ''
    return
  }
  
  const filtros = [
    ['todos', 'Todas', lista.length],
    ['diagnostico', 'Completar diagnóstico', diagnosticoReforcar],
    ['sem-assunto', 'Sem assunto do edital', semAssunto],
    ['pegadinhas', 'Com pegadinhas', comPegadinha]
  ]
  
  container.innerHTML = `
    <div class="caderno-erros-acoes-topo">
      <div>
        <h3>Atalhos do caderno</h3>
        <p>Use regras internas para encontrar o que enfraquece a revisão: diagnóstico incompleto, assunto sem vínculo e pegadinhas salvas.</p>
      </div>
      <span class="tag-estudo">${formatarQuantidadeQuestoes(lista.length)} no caderno</span>
    </div>
    <div class="caderno-erros-filtros">
      ${filtros.map(([filtro, rotulo, total]) => `
        <button class="btn-secundario ${filtroCadernoErrosAtual === filtro ? 'ativo' : ''}" type="button" data-filtro-caderno="${filtro}">
          ${escaparHtmlSeguro(rotulo)} <span>${total}</span>
        </button>
      `).join('')}
    </div>
  `
  
  // Usa delegação de eventos: adiciona o listener apenas UMA vez no container
  if (!listenerDelegacaoAdicionado) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filtro-caderno]')
      if (btn) {
        filtroCadernoErrosAtual = btn.dataset.filtroCaderno || 'todos'
        renderizarAcoesCadernoErros(questoesEmMemoria)
        atualizarListaQuestoesCaderno()
      }
    })
    listenerDelegacaoAdicionado = true
  }
}
function filtrarQuestoesCadernoErros(questoes) {
  const lista = questoes || []
  if (filtroCadernoErrosAtual === 'diagnostico') {
    return lista.filter(q => avaliarQualidadeDiagnosticoQuestao(q).status !== 'completo')
  }
  if (filtroCadernoErrosAtual === 'sem-assunto') {
    return lista.filter(q => !q.edital_topico_id)
  }
  if (filtroCadernoErrosAtual === 'pegadinhas') {
    return lista.filter(q => String(q.pegadinha_banca || '').trim())
  }
  return lista
}

function prepararCadernoParaQuestaoNova() {
  filtroCadernoErrosAtual = 'todos'

  const busca = document.getElementById('busca-caderno')
  if (busca) busca.value = ''

  const ordenacao = document.getElementById('ordenacao-caderno')
  if (ordenacao) ordenacao.value = 'recente'
}

function renderizarListaQuestoes(listaParaExibir, opcoes = {}) {
  const container = document.getElementById('lista-questoes');
  if (!container) return;

  container.innerHTML = '';

  if (listaParaExibir.length === 0) {
    container.innerHTML = `
      <div class="estado-vazio">
        <p>${escaparHtmlSeguro(opcoes.mensagemVazia || 'Nenhuma questão encontrada com este filtro.')}</p>
      </div>`;
    return;
  }

  let primeiroCardAdicionado = false;

  listaParaExibir.forEach(q => {
    const card = criarCardQuestao(q);
    if (opcoes.marcarPrimeiroComoNovo && !primeiroCardAdicionado) {
      card.classList.add('card-questao--novo');
      primeiroCardAdicionado = true;
    }
    container.appendChild(card);
  });
}

function obterMensagemFiltroCadernoErros() {
  if (filtroCadernoErrosAtual === 'diagnostico') return '✅ Nenhuma questão com diagnóstico incompleto ou fraco.'
  if (filtroCadernoErrosAtual === 'sem-assunto') return '✅ Todas as questões estão vinculadas a algum assunto do edital.'
  if (filtroCadernoErrosAtual === 'pegadinhas') return 'Nenhuma questão com pegadinha registrada ainda.'
  return 'Nenhuma questão encontrada para este filtro.'
}

function atualizarListaQuestoesCaderno(opcoes = {}) {
  const listaBase = Array.isArray(questoesEmMemoria) ? questoesEmMemoria : []
  const termoBusca = String(document.getElementById('busca-caderno')?.value || '').toLowerCase().trim()
  const filtradasPorAtalho = filtrarQuestoesCadernoErros(listaBase)
  const filtradasPorBusca = termoBusca
    ? filtradasPorAtalho.filter(q => questaoCorrespondeBuscaCaderno(q, termoBusca))
    : filtradasPorAtalho
  const criterio = document.getElementById('ordenacao-caderno')?.value || 'recente'
  let ordenadas = ordenarQuestoes(filtradasPorBusca, criterio)

  if (opcoes.marcarPrimeiroComoNovo && questaoRecemSalvaId) {
    ordenadas = colocarQuestaoNoInicio(ordenadas, questaoRecemSalvaId)
  }

  renderizarListaQuestoes(ordenadas, {
    marcarPrimeiroComoNovo: Boolean(opcoes.marcarPrimeiroComoNovo),
    mensagemVazia: obterMensagemListaQuestoesVazia(listaBase.length, filtradasPorAtalho.length, termoBusca)
  })
  atualizarResultadoBuscaCaderno(termoBusca, filtradasPorBusca.length, filtradasPorAtalho.length)

  if (opcoes.marcarPrimeiroComoNovo) questaoRecemSalvaId = null
}

function questaoCorrespondeBuscaCaderno(q, termoNormalizado) {
  const campos = [
    q.enunciado,
    q.motivo_erro,
    q.nivel_confianca,
    q.comentario,
    q.pegadinha_banca,
    q.banca,
    q.materias?.nome,
    q.edital_topicos?.titulo
  ]

  return campos.some(campo => String(campo || '').toLowerCase().includes(termoNormalizado))
}

function colocarQuestaoNoInicio(lista, questaoId) {
  const indice = lista.findIndex(q => q.id === questaoId)
  if (indice <= 0) return lista

  const copia = [...lista]
  const [questao] = copia.splice(indice, 1)
  return [questao, ...copia]
}

function obterMensagemListaQuestoesVazia(totalQuestoes, totalAposAtalho, termoBusca) {
  if (totalQuestoes === 0) {
    return 'Resolva exercícios e registre seu primeiro erro aqui. Quanto mais cedo começar, mais rápido o sistema aprende seus padrões.'
  }
  if (termoBusca) return 'Nenhuma questão encontrada para esta busca.'
  if (totalAposAtalho === 0) return obterMensagemFiltroCadernoErros()
  return 'Nenhuma questão encontrada com os filtros atuais.'
}

function atualizarResultadoBuscaCaderno(termoBusca, totalBusca, totalFiltro) {
  const infoElemento = document.getElementById('resultado-busca-info')
  if (!infoElemento) return

  if (!termoBusca) {
    infoElemento.textContent = ''
    return
  }

  const complementoFiltro = totalFiltro !== questoesEmMemoria.length
    ? ` de ${totalFiltro} neste atalho`
    : ''
  infoElemento.textContent = `${totalBusca} resultado(s) encontrado(s)${complementoFiltro}`
}

function filtrarQuestoesBusca() {
  atualizarListaQuestoesCaderno()
}

function ordenarQuestoes(lista, criterio) {
  return [...lista].sort((a, b) => {
    const qa = a.questoes || a;
    const qb = b.questoes || b;
    const matA = (qa.materias?.nome || '').toLowerCase();
    const matB = (qb.materias?.nome || '').toLowerCase();

    switch (criterio) {
      case 'antigas':
        return compararDatasQuestao(qa.criado_em, qb.criado_em);
      
      case 'materia':
        return matA.localeCompare(matB, 'pt-BR') || compararDatasQuestao(qb.criado_em, qa.criado_em);
      
      case 'diagnostico':
        return compararDiagnosticoQuestoes(qa, qb);
      
      case 'revisao':
        if (!qa.revisar_novamente_em && !qb.revisar_novamente_em) {
          return compararDatasQuestao(qb.criado_em, qa.criado_em);
        }
        if (!qa.revisar_novamente_em) return 1; // Nulos no fim
        if (!qb.revisar_novamente_em) return -1;
        return compararDatasQuestao(qa.revisar_novamente_em, qb.revisar_novamente_em) ||
          compararDatasQuestao(qb.criado_em, qa.criado_em);
      
      case 'recente':
      default:
        return compararDatasQuestao(qb.criado_em, qa.criado_em);
    }
  });
}

function compararDiagnosticoQuestoes(a, b) {
  const qualidadeA = typeof avaliarQualidadeDiagnosticoQuestao === 'function'
    ? avaliarQualidadeDiagnosticoQuestao(a)
    : { status: 'completo', pontos: 0 }
  const qualidadeB = typeof avaliarQualidadeDiagnosticoQuestao === 'function'
    ? avaliarQualidadeDiagnosticoQuestao(b)
    : { status: 'completo', pontos: 0 }

  return prioridadeDiagnosticoQuestao(qualidadeA.status) - prioridadeDiagnosticoQuestao(qualidadeB.status) ||
    Number(qualidadeA.pontos || 0) - Number(qualidadeB.pontos || 0) ||
    compararDatasQuestao(b.criado_em, a.criado_em)
}

function prioridadeDiagnosticoQuestao(status) {
  const prioridade = {
    incompleto: 0,
    fraco: 1,
    completo: 2
  }
  return prioridade[status] ?? 3
}

function compararDatasQuestao(dataA, dataB) {
  const valorA = Date.parse(dataA || '')
  const valorB = Date.parse(dataB || '')

  if (Number.isNaN(valorA) && Number.isNaN(valorB)) return 0
  if (Number.isNaN(valorA)) return 1
  if (Number.isNaN(valorB)) return -1
  return valorA - valorB
}

function criarCabecalhoGrupoQuestoes(titulo, resumo) {
  const header = document.createElement('div')
  header.className = 'questoes-grupo-header'
  header.innerHTML = `
    <h3 class="questoes-grupo-titulo">${escaparHtmlSeguro(titulo)}</h3>
    <span class="questoes-grupo-resumo">${escaparHtmlSeguro(resumo)}</span>
  `
  return header
}

// ============================================
// CRIAR CARD DE QUESTÃO
// ============================================
function criarCardQuestao(q) {
  const card = document.createElement('div')

  const enunciadoCurto = q.enunciado.length > 120
    ? q.enunciado.substring(0, 120) + '...'
    : q.enunciado

  const nomeMateria = q.materias ? q.materias.nome : 'Sem matéria'
  const data = new Date(q.criado_em).toLocaleDateString('pt-BR')
  const tipoQuestao = normalizarTipoQuestao(q)
  const statusRevisao = normalizarStatusRevisao(q)
  const totalErrosRevisao = Number(q.revisao_total_erros || 0)
  const ehChutada = tipoQuestao === 'Chutada'
  const acertadaNoChute = questaoChutadaAcertada(q)
  const classeTagMarcada = ehChutada ? 'tag-chutada' : 'tag-errada'
  const textoTagMarcada = ehChutada
    ? `${acertadaNoChute ? 'Acertei no chute' : 'Chutei'}: ${q.alternativa_marcada}`
    : `Marquei: ${q.alternativa_marcada}`
  const rotuloMotivo = ehChutada ? 'Insegurança' : 'Erro'
  const rotuloTipo = acertadaNoChute ? 'Acertada no chute' : obterRotuloTipoQuestao(tipoQuestao)
  const qualidadeDiagnostico = avaliarQualidadeDiagnosticoQuestao(q)
  const resumoQualidade = criarResumoQualidadeDiagnostico(qualidadeDiagnostico)
  const alertaCadastro = criarAlertaCadastroFracoQuestao(qualidadeDiagnostico)
  card.className = `card-questao card-questao--${tipoQuestao === 'Chutada' ? 'chutada' : 'errada'}`
  if (statusRevisao === 'recuperada') card.classList.add('card-questao--recuperada')
  if (qualidadeDiagnostico.status !== 'completo') card.classList.add(`card-questao--diagnostico-${qualidadeDiagnostico.status}`)

  const diagnosticos = [
    q.conceito_chave ? ['Conceito', q.conceito_chave] : null,
    q.como_reconhecer ? ['Reconhecer', q.como_reconhecer] : null,
    q.acao_corretiva ? ['Ação', q.acao_corretiva] : null
  ].filter(Boolean)

  const blocoDiagnostico = diagnosticos.length > 0
    ? `<div class="card-questao-diagnostico">
        ${diagnosticos.map(([rotulo, texto]) => `
          <div class="diagnostico-item">
            <span class="diagnostico-rotulo">${escaparHtmlSeguro(rotulo)}</span>
            <p>${escaparHtmlSeguro(texto)}</p>
          </div>
        `).join('')}
      </div>`
    : ''

  let listaAlternativas = ''
  if (q.alternativas && typeof q.alternativas === 'object') {
    listaAlternativas = Object.entries(q.alternativas)
      .map(([letra, texto]) => {
        const marcadaIncorreta = letra === q.alternativa_marcada && letra !== q.alternativa_correta
        const classeMarcada = marcadaIncorreta ? (ehChutada ? 'alt-chutada' : 'alt-errada') : ''
        return `
        <div class="alternativa-card ${classeMarcada} ${letra === q.alternativa_correta ? 'alt-certa' : ''}">
          <span class="alt-letra">${escaparHtmlSeguro(letra)}</span>
          <span class="alt-texto">${escaparHtmlSeguro(texto)}</span>
        </div>
      `
      }).join('')
  }

  card.innerHTML = `
    <div class="card-questao-topo">
      <span class="tag-materia">${escaparHtmlSeguro(nomeMateria)}</span>
      <span class="card-questao-data">${data}</span>
    </div>
    <p class="card-questao-enunciado">${escaparHtmlSeguro(enunciadoCurto)}</p>
    <div class="lista-alternativas-card">${listaAlternativas}</div>
    <div class="card-questao-alternativas">
      <span class="${classeTagMarcada}">${escaparHtmlSeguro(textoTagMarcada)}</span>
      <span class="tag-certa">Correta: ${escaparHtmlSeguro(q.alternativa_correta)}</span>
    </div>
    <div class="questao-tags-estudo">
      <span class="tag-tipo-questao ${obterClasseTipoQuestao(tipoQuestao)}">${rotuloTipo}</span>
      ${statusRevisao === 'recuperada' ? '<span class="tag-revisao tag-revisao--acerto">Recuperada no simulado</span>' : ''}
      ${totalErrosRevisao > 0 ? `<span class="tag-revisao tag-revisao--erro">${totalErrosRevisao} erro${totalErrosRevisao !== 1 ? 's' : ''} em revisão</span>` : ''}
      ${q.edital_topicos?.titulo ? `<span class="tag-estudo">Edital: ${escaparHtmlSeguro(q.edital_topicos.titulo)}</span>` : ''}
      ${q.banca ? `<span class="tag-estudo">Banca: ${escaparHtmlSeguro(q.banca)}</span>` : ''}
      ${Number(q.revisao_etapa || 0) > 0 ? `<span class="tag-estudo">Ciclo 24/7/30: etapa ${Number(q.revisao_etapa || 0)}</span>` : ''}
      ${q.motivo_erro ? `<span class="tag-estudo">${escaparHtmlSeguro(rotuloMotivo)}: ${escaparHtmlSeguro(q.motivo_erro)}</span>` : ''}
      ${q.nivel_confianca ? `<span class="tag-estudo">Confiança: ${escaparHtmlSeguro(q.nivel_confianca)}</span>` : ''}
      <span class="diagnostico-qualidade-tag ${qualidadeDiagnostico.classe}">${escaparHtmlSeguro(qualidadeDiagnostico.rotulo)}</span>
    </div>
    ${q.comentario ? `<p class="card-questao-comentario">💬 ${escaparHtmlSeguro(q.comentario)}</p>` : ''}
    ${q.pegadinha_banca ? `<p class="card-questao-comentario card-questao-pegadinha"><strong>Pegadinhas da questão:</strong> ${escaparHtmlSeguro(q.pegadinha_banca)}</p>` : ''}
    ${alertaCadastro}
    ${qualidadeDiagnostico.status !== 'completo' ? `
      <div class="diagnostico-qualidade-alerta ${qualidadeDiagnostico.classe}">
        <strong>${escaparHtmlSeguro(qualidadeDiagnostico.rotulo)}</strong>
        <span>${escaparHtmlSeguro(resumoQualidade)}</span>
      </div>
    ` : ''}
    ${blocoDiagnostico}
    <div class="card-questao-acoes">
      <button class="btn-acao btn-editar" data-id="${q.id}" type="button">✏️ Editar</button>
      <button class="btn-acao btn-excluir" data-id="${q.id}" type="button">🗑️ Excluir</button>
    </div>
  `

  // Botão excluir
  card.querySelector('.btn-excluir').addEventListener('click', () => excluirQuestao(q.id, card))

  // Botão editar (próxima etapa)
  card.querySelector('.btn-editar').addEventListener('click', () => abrirModalEdicao(q))

  return card
}

// ============================================
// EXCLUIR QUESTÃO
// ============================================
async function excluirQuestao(id, card) {
  if (!confirm('Tem certeza que deseja excluir esta questão?')) return

  const { data: questaoExcluida, error } = await db
    .from('questoes')
    .delete()
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)
    .select('sessao_id')
    .maybeSingle()

  if (error) {
    console.error(error)
    alert('Não foi possível excluir a questão. Verifique sua conexão e tente novamente.')
    return
  }

  await recalcularTotalQuestoesSessao(questaoExcluida?.sessao_id)
  card.remove()
  await carregarQuestoes()
  atualizarTelasAposRegistro()
}

// ============================================
// MODAL DE EDIÇÃO
// ============================================
function atualizarCamposEdicaoPorTipo(tipo, preservarValores = false) {
  const config = obterConfigTipoQuestao(tipo)
  const labelMotivo = document.getElementById('edit-label-motivo-questao')
  const labelConfianca = document.getElementById('edit-label-confianca-questao')
  const motivo = document.getElementById('edit-motivo-erro')
  const confianca = document.getElementById('edit-nivel-confianca')

  if (labelMotivo) labelMotivo.textContent = config.labelMotivo
  if (labelConfianca) labelConfianca.textContent = config.labelConfianca

  if (motivo) {
    const valorAtual = preservarValores && config.motivos.includes(motivo.value) ? motivo.value : ''
    motivo.innerHTML = `<option value="">Selecione...</option>${renderizarOptionsEstudo(config.motivos, valorAtual)}`
    motivo.value = valorAtual
  }

  if (confianca) {
    const valorAtual = preservarValores && config.niveis.includes(confianca.value) ? confianca.value : ''
    confianca.innerHTML = `<option value="">Selecione...</option>${renderizarOptionsEstudo(config.niveis, valorAtual)}`
    confianca.value = valorAtual
  }
}

function abrirModalEdicao(q) {
  // Remove modal anterior se existir
  document.getElementById('modal-edicao')?.remove()

  const nomeMateria = q.materias ? q.materias.nome : ''
  const letras = Object.keys(q.alternativas || {})
  const tipoQuestao = normalizarTipoQuestao(q)
  const configEdicao = obterConfigTipoQuestao(tipoQuestao)

  const camposAlternativas = letras.map(letra => `
    <div class="linha-alternativa">
      <span class="badge-letra">${escaparHtmlSeguro(letra)}</span>
      <input type="text" class="input-texto edit-alt" data-letra="${escaparHtmlSeguro(letra)}"
        value="${escaparHtmlSeguro(q.alternativas[letra] || '')}" />
    </div>
  `).join('')

  const botoesAlternativas = letras.map(letra => `
    <button type="button"
      class="btn-letra edit-btn-marcada ${letra === q.alternativa_marcada ? 'selecionado-errado' : ''}"
      data-letra="${escaparHtmlSeguro(letra)}">${escaparHtmlSeguro(letra)}</button>
  `).join('')

  const botoesCorreta = letras.map(letra => `
    <button type="button"
      class="btn-letra edit-btn-correta ${letra === q.alternativa_correta ? 'selecionado-certo' : ''}"
      data-letra="${escaparHtmlSeguro(letra)}">${escaparHtmlSeguro(letra)}</button>
  `).join('')

  const modal = document.createElement('div')
  modal.id = 'modal-edicao'
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal-caixa">
      <div class="modal-topo">
        <h3>✏️ Editar Questão</h3>
        <button class="modal-fechar" id="btn-fechar-modal" type="button">✕</button>
      </div>

      <div class="campo-form">
        <label class="campo-label">Matéria</label>
        <select id="edit-materia" class="input-texto">
          <option value="">⏳ Buscando opções...</option>
        </select>
      </div>

      <div class="form-grid-duas-colunas">
        <div class="campo-form">
          <label class="campo-label">Assunto do edital</label>
          <select id="edit-edital-topico" class="input-texto">
            <option value="">Sem assunto específico</option>
          </select>
        </div>
        <div class="campo-form">
          <label class="campo-label">Banca</label>
          <input id="edit-banca" class="input-texto" type="text" maxlength="80" value="${escaparHtmlSeguro(q.banca || '')}" />
        </div>
      </div>

      <div class="campo-form">
        <label class="campo-label">Enunciado</label>
        <textarea id="edit-enunciado" class="input-texto input-textarea" rows="4">${escaparHtmlSeguro(q.enunciado)}</textarea>
      </div>

      <div class="campo-form">
        <label class="campo-label">Alternativas</label>
        ${camposAlternativas}
      </div>

      <div class="campo-form">
        <label class="campo-label">Alternativa que você marcou (errada)</label>
        <div class="grupo-botoes" id="edit-grupo-marcada">${botoesAlternativas}</div>
      </div>

      <div class="campo-form">
        <label class="campo-label">Alternativa correta</label>
        <div class="grupo-botoes" id="edit-grupo-correta">${botoesCorreta}</div>
      </div>

      <div class="campo-form">
        <label class="campo-label">Tipo da questão</label>
        <select id="edit-tipo-questao" class="input-texto">
          ${renderizarOptionsEstudo(TIPOS_QUESTAO, tipoQuestao)}
        </select>
      </div>

      <div class="form-grid-duas-colunas">
        <div class="campo-form">
          <label class="campo-label" id="edit-label-motivo-questao">${escaparHtmlSeguro(configEdicao.labelMotivo)}</label>
          <select id="edit-motivo-erro" class="input-texto">
            <option value="">Selecione...</option>
            ${renderizarOptionsEstudo(configEdicao.motivos, q.motivo_erro || '')}
          </select>
        </div>
        <div class="campo-form">
          <label class="campo-label" id="edit-label-confianca-questao">${escaparHtmlSeguro(configEdicao.labelConfianca)}</label>
          <select id="edit-nivel-confianca" class="input-texto">
            <option value="">Selecione...</option>
            ${renderizarOptionsEstudo(configEdicao.niveis, q.nivel_confianca || '')}
          </select>
        </div>
      </div>

      <div class="campo-form">
        <label class="campo-label">Comentário (opcional)</label>
        <textarea id="edit-comentario" class="input-texto input-textarea" rows="2">${escaparHtmlSeguro(q.comentario || '')}</textarea>
      </div>

      <div class="campo-form">
        <label class="campo-label">Pegadinhas da Questão (opcional)</label>
        <div class="pegadinha-chips" id="edit-pegadinha-chips" aria-label="Pegadinhas rápidas"></div>
        <textarea id="edit-pegadinha-banca" class="input-texto input-textarea" rows="2" placeholder="Ex: palavra absoluta, exceção escondida, alternativa parcialmente correta, troca de conceito...">${escaparHtmlSeguro(q.pegadinha_banca || '')}</textarea>
      </div>

      <div class="assistente-prompt">
        <button class="btn-primario btn-ia-analise" id="btn-analisar-ia-edicao" type="button" hidden>
          Analisar com IA e sugerir preenchimento
        </button>
        <button class="btn-secundario btn-prompt-chatgpt" id="btn-gerar-prompt-chatgpt-edicao" type="button">
          Prompt para a IA preencher campos e pegadinhas
        </button>
        <button class="btn-secundario btn-prompt-chatgpt" id="btn-copiar-modelo-resposta-chatgpt-edicao" type="button">
          Copiar modelo de resposta
        </button>
        <button class="btn-secundario btn-prompt-chatgpt" id="btn-colar-resposta-chatgpt-edicao" type="button">
          Colar resposta da IA e preencher os campos
        </button>
        <p class="assistente-ia-info" hidden>A análise integrada sugere campos sem salvar automaticamente e sem substituir seu comentário original.</p>
      </div>

      <div class="caderno-erros-grid">
        <div class="campo-form">
          <label class="campo-label">Conceito ou regra que resolve</label>
          <textarea id="edit-conceito-chave" class="input-texto input-textarea" rows="2">${escaparHtmlSeguro(q.conceito_chave || '')}</textarea>
        </div>
        <div class="campo-form">
          <label class="campo-label">Como reconhecer na próxima vez</label>
          <textarea id="edit-como-reconhecer" class="input-texto input-textarea" rows="2">${escaparHtmlSeguro(q.como_reconhecer || '')}</textarea>
        </div>
        <div class="campo-form caderno-erros-grid-full">
          <label class="campo-label">Ação corretiva</label>
          <textarea id="edit-acao-corretiva" class="input-texto input-textarea" rows="2">${escaparHtmlSeguro(q.acao_corretiva || '')}</textarea>
        </div>
      </div>

      <button class="btn-primario" id="btn-salvar-edicao" type="button">💾 Salvar Alterações</button>
      <p class="msg-materia" id="msg-edicao"></p>
    </div>
  `

  document.body.appendChild(modal)

  // Fecha ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove()
  })
  document.getElementById('btn-fechar-modal').addEventListener('click', () => modal.remove())
  renderizarChipsPegadinha('edit-pegadinha-chips', 'edit-pegadinha-banca')

  document.getElementById('btn-analisar-ia-edicao')
    ?.addEventListener('click', () => analisarQuestaoComIA('edicao'))

  document.getElementById('btn-gerar-prompt-chatgpt-edicao')
    ?.addEventListener('click', abrirPromptChatGPTEdicao)

  document.getElementById('btn-copiar-modelo-resposta-chatgpt-edicao')
    ?.addEventListener('click', copiarModeloRespostaChatGPT)

  document.getElementById('btn-colar-resposta-chatgpt-edicao')
    ?.addEventListener('click', abrirColarRespostaChatGPTEdicao)

  // Carrega matérias no select do modal
  carregarMateriasNoSelectEdicao(q.materia_id)
  carregarTopicosEdicao(q.materia_id, q.edital_topico_id || '')

  document.getElementById('edit-materia')?.addEventListener('change', (e) => {
    carregarTopicosEdicao(e.target.value, '')
  })

  // Controle dos botões de alternativa marcada
  let editMarcada = q.alternativa_marcada
  let editCorreta = q.alternativa_correta

  document.getElementById('edit-grupo-marcada').querySelectorAll('.edit-btn-marcada')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.edit-btn-marcada').forEach(b => b.classList.remove('selecionado-errado'))
        btn.classList.add('selecionado-errado')
        editMarcada = btn.dataset.letra
      })
    })

  document.getElementById('edit-grupo-correta').querySelectorAll('.edit-btn-correta')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.edit-btn-correta').forEach(b => b.classList.remove('selecionado-certo'))
        btn.classList.add('selecionado-certo')
        editCorreta = btn.dataset.letra
      })
    })

  const editTipoQuestao = document.getElementById('edit-tipo-questao')
  const editMotivoErro = document.getElementById('edit-motivo-erro')
  const editNivelConfianca = document.getElementById('edit-nivel-confianca')

  editTipoQuestao.addEventListener('change', (e) => {
    atualizarCamposEdicaoPorTipo(e.target.value)
  })

  ;[editMotivoErro, editNivelConfianca].forEach(campo => {
    campo.addEventListener('change', () => {
      const campoAlterado = campo === editMotivoErro ? 'motivo' : 'confianca'
      if (campoAlterado === 'motivo') sugerirAcaoCorretivaPorMotivo('edit')

      const tipoInferido = obterTipoQuestaoPorCampos(
        editMotivoErro.value,
        editNivelConfianca.value,
        campoAlterado
      )

      if (tipoInferido && editTipoQuestao.value !== tipoInferido) {
        editTipoQuestao.value = tipoInferido
        atualizarCamposEdicaoPorTipo(tipoInferido, true)
      }
    })
  })

  // Salvar edição
  document.getElementById('btn-salvar-edicao').addEventListener('click', async () => {
    const novaMateria   = document.getElementById('edit-materia').value
    const novoTopicoEdital = document.getElementById('edit-edital-topico').value || null
    const novaBanca = document.getElementById('edit-banca').value.trim()
    const novaPegadinhaBanca = document.getElementById('edit-pegadinha-banca').value.trim()
    const novoEnunciado = document.getElementById('edit-enunciado').value.trim()
    const novoComentario = document.getElementById('edit-comentario').value.trim()
    const novoTipoQuestao = document.getElementById('edit-tipo-questao').value
    const configNovoTipoQuestao = obterConfigTipoQuestao(novoTipoQuestao)
    const novoMotivoErro = document.getElementById('edit-motivo-erro').value
    const novoNivelConfianca = document.getElementById('edit-nivel-confianca').value
    const novoConceitoChave = document.getElementById('edit-conceito-chave').value.trim()
    const novoComoReconhecer = document.getElementById('edit-como-reconhecer').value.trim()
    const novaAcaoCorretiva = document.getElementById('edit-acao-corretiva').value.trim()

    const novasAlternativas = {}
    document.querySelectorAll('.edit-alt').forEach(input => {
      novasAlternativas[input.dataset.letra] = input.value.trim()
    })

    if (!novaMateria || !novoEnunciado || !editMarcada || !editCorreta) {
      document.getElementById('msg-edicao').textContent = 'Preencha todos os campos obrigatórios.'
      document.getElementById('msg-edicao').className = 'msg-materia erro'
      return
    }

    if (novoTipoQuestao === 'Errada' && editMarcada === editCorreta) {
      document.getElementById('msg-edicao').textContent = 'Para questão errada, a alternativa marcada precisa ser diferente da correta. Se acertou no chute, use o tipo Chutada.'
      document.getElementById('msg-edicao').className = 'msg-materia erro'
      return
    }

    if (!novoTipoQuestao || !novoMotivoErro || !novoNivelConfianca) {
      document.getElementById('msg-edicao').textContent = 'Selecione tipo, motivo e confiança.'
      document.getElementById('msg-edicao').className = 'msg-materia erro'
      return
    }

    if (!configNovoTipoQuestao.motivos.includes(novoMotivoErro) || !configNovoTipoQuestao.niveis.includes(novoNivelConfianca)) {
      document.getElementById('msg-edicao').textContent = 'Selecione motivo e confiança compatíveis com o tipo da questão.'
      document.getElementById('msg-edicao').className = 'msg-materia erro'
      return
    }

    const { error } = await db
      .from('questoes')
      .update({
        materia_id:          novaMateria,
        edital_topico_id:    novoTopicoEdital,
        banca:               novaBanca || null,
        pegadinha_banca:     novaPegadinhaBanca || null,
        enunciado:           novoEnunciado,
        alternativas:        novasAlternativas,
        alternativa_marcada: editMarcada,
        alternativa_correta: editCorreta,
        tipo_questao:        novoTipoQuestao,
        motivo_erro:         novoMotivoErro,
        nivel_confianca:     novoNivelConfianca,
        comentario:          novoComentario || null,
        conceito_chave:      novoConceitoChave || null,
        como_reconhecer:     novoComoReconhecer || null,
        acao_corretiva:      novaAcaoCorretiva || null
      })
      .eq('id', q.id)
      .eq('user_id', window.usuarioAtual.id)

    if (error) {
      console.error(error)
      document.getElementById('msg-edicao').textContent = 'Não foi possível salvar as alterações da questão. Verifique sua conexão e tente novamente.'
      document.getElementById('msg-edicao').className = 'msg-materia erro'
      return
    }

    if (novaPegadinhaBanca && novaPegadinhaBanca !== (q.pegadinha_banca || '') && typeof registrarPegadinhaDaQuestao === 'function') {
      registrarPegadinhaDaQuestao({
        materiaId: novaMateria,
        topicoId: novoTopicoEdital,
        banca: novaBanca,
        padrao: novaPegadinhaBanca
      })
    }

    modal.remove()
    carregarQuestoes()
    atualizarTelasAposRegistro()
  })
}

async function carregarMateriasNoSelectEdicao(materiaAtualId) {
  const select = document.getElementById('edit-materia')

  const { data } = await db
    .from('materias')
    .select('id, nome')
    .eq('user_id', window.usuarioAtual.id)
    .order('nome', { ascending: true })

  select.innerHTML = '<option value="">Selecione...</option>'

  if (data) {
    data.forEach(m => {
      const opt = document.createElement('option')
      opt.value = m.id
      opt.textContent = m.nome
      if (m.id === materiaAtualId) opt.selected = true
      select.appendChild(opt)
    })
  }
}

async function carregarTopicosEdicao(materiaId, topicoAtualId = '') {
  await carregarTopicosQuestaoParaSelect('edit-edital-topico', materiaId, topicoAtualId, 'Sem assunto específico')
}

// ============================================
// MENSAGEM DE FEEDBACK
// ============================================
function mostrarMsgQuestao(texto, tipo) {
  const msg     = document.getElementById('msg-questao')
  msg.textContent = texto
  msg.className   = `msg-materia ${tipo}`
}

// ============================================
// ACERTOS
// ============================================
function inicializarAcertos() {
  adicionarLinhaAcerto()

  document.getElementById('btn-add-linha-acerto')
    .addEventListener('click', adicionarLinhaAcerto)

  document.getElementById('btn-salvar-acertos')
    .addEventListener('click', salvarAcertos)
}

function adicionarLinhaAcerto() {
  const container = document.getElementById('linhas-acertos')

  const selectOrigem = document.getElementById('q-materia')
  const opcoes = Array.from(selectOrigem.options)
    .filter(o => o.value !== '')
    .map(o => `<option value="${escaparHtmlSeguro(o.value)}">${escaparHtmlSeguro(o.text)}</option>`)
    .join('')

  if (opcoes.length === 0) {
    mostrarMsgQuestao('Cadastre ao menos uma matéria antes.', 'erro')
    return
  }

  const linha = document.createElement('div')
  linha.className = 'linha-acerto'
  linha.innerHTML = `
    <select class="input-texto acerto-materia">
      <option value="">Selecione a matéria...</option>
      ${opcoes}
    </select>
    <input
      type="number"
      class="input-texto acerto-quantidade"
      placeholder="Qtd"
      min="1"
      max="999"
    />
    <button class="btn-remover-linha" type="button" title="Remover">✕</button>
  `

  linha.querySelector('.btn-remover-linha').addEventListener('click', () => {
    if (document.querySelectorAll('.linha-acerto').length > 1) {
      linha.remove()
    }
  })

  container.appendChild(linha)
}

async function salvarAcertos() {
  const linhas = document.querySelectorAll('.linha-acerto')
  const registros = []

  for (const linha of linhas) {
    const materiaId  = linha.querySelector('.acerto-materia').value
    const quantidade = parseInt(linha.querySelector('.acerto-quantidade').value)

    if (!materiaId || !quantidade || quantidade < 1) continue
    registros.push({ materiaId, quantidade })
  }

  if (registros.length === 0) {
    mostrarMsgAcertos('Preencha ao menos uma matéria com quantidade.', 'erro')
    return
  }

  // Reutiliza a mesma função de sessão já existente no arquivo
  const sessao = await obterOuCriarSessaoDeHoje()
  if (!sessao) {
    mostrarMsgAcertos('Não foi possível preparar a sessão de estudo de hoje. Verifique sua conexão e tente novamente.', 'erro')
    return
  }

  const inserir = registros.map(r => ({
    user_id:    window.usuarioAtual.id,
    sessao_id:  sessao.id,
    materia_id: r.materiaId,
    quantidade: r.quantidade
  }))

  const { error } = await db.from('questoes_certas').insert(inserir)

  if (error) {
    console.error(error)
    mostrarMsgAcertos('Não foi possível salvar os acertos. Verifique sua conexão e tente novamente.', 'erro')
    return
  }

  mostrarMsgAcertos('✅ Acertos registrados com sucesso!', 'sucesso')
  await recalcularTotalQuestoesSessao(sessao.id)
  document.getElementById('linhas-acertos').innerHTML = ''
  adicionarLinhaAcerto()
  if (typeof avaliarConquistasUsuario === 'function') {
    await avaliarConquistasUsuario({ atualizarPerfil: true })
  }
  atualizarTelasAposRegistro()
}

function mostrarMsgAcertos(texto, tipo) {
  const msg = document.getElementById('msg-acertos')
  msg.textContent = texto
  msg.className   = `msg-materia ${tipo}`
}

function formularioQuestaoTemConteudo() {
  const enunciado = document.getElementById('q-enunciado')?.value?.trim()
  const marcada = alternativaMarcada
  const correta = alternativaCorreta
  return Boolean(enunciado || marcada || correta)
}

// Exportações apenas para testes (Vitest)
// No navegador, essas linhas são ignoradas pois o script é carregado como tradicional
if (typeof globalThis !== 'undefined' && typeof globalThis.window === 'undefined') {
  // Ambiente Node/Vitest
  const exportsObj = {
    MODELO_RESPOSTA_CHATGPT,
    CONFIG_TIPO_QUESTAO,
    normalizarTipoQuestao,
    normalizarStatusRevisao,
    obterTipoQuestaoPorCampos,
    questaoChutadaAcertada,
    normalizarTextoDuplicidade,
    alterarQuantidadeAlternativas,
    ordenarQuestoes,
    carregarQuestoesEmMemoria,
    montarPromptDiagnosticoChatGPT,
    copiarModeloRespostaChatGPT,
    previsualizarRespostaChatGPT,
    aplicarRespostaChatGPT,
    extrairCamposRespostaChatGPT,
    identificarCampoRespostaChatGPT,
    obterOuCriarSessaoDeHoje,
    recalcularTotalQuestoesSessao
  }
  
  // Compatibilidade com ES modules no Vitest
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj
  }
  
  // Para Vitest com type: module
  globalThis.MODELO_RESPOSTA_CHATGPT = MODELO_RESPOSTA_CHATGPT
  globalThis.CONFIG_TIPO_QUESTAO = CONFIG_TIPO_QUESTAO
  globalThis.normalizarTipoQuestao = normalizarTipoQuestao
  globalThis.normalizarStatusRevisao = normalizarStatusRevisao
  globalThis.obterTipoQuestaoPorCampos = obterTipoQuestaoPorCampos
  globalThis.questaoChutadaAcertada = questaoChutadaAcertada
  globalThis.normalizarTextoDuplicidade = normalizarTextoDuplicidade
  globalThis.alterarQuantidadeAlternativas = alterarQuantidadeAlternativas
  globalThis.ordenarQuestoes = ordenarQuestoes
  globalThis.carregarQuestoesEmMemoria = carregarQuestoesEmMemoria
  globalThis.montarPromptDiagnosticoChatGPT = montarPromptDiagnosticoChatGPT
  globalThis.copiarModeloRespostaChatGPT = copiarModeloRespostaChatGPT
  globalThis.previsualizarRespostaChatGPT = previsualizarRespostaChatGPT
  globalThis.aplicarRespostaChatGPT = aplicarRespostaChatGPT
  globalThis.extrairCamposRespostaChatGPT = extrairCamposRespostaChatGPT
  globalThis.identificarCampoRespostaChatGPT = identificarCampoRespostaChatGPT
  globalThis.obterOuCriarSessaoDeHoje = obterOuCriarSessaoDeHoje
  globalThis.recalcularTotalQuestoesSessao = recalcularTotalQuestoesSessao
}
