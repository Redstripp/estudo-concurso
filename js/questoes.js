// js/questoes.js

let alternativaMarcada  = null
let alternativaCorreta  = null
let numAlternativas     = 2
let tipoQuestaoAtual    = 'Errada'
let modoRegistroQuestao = 'rapido'
let questoesInicializado = false
let filtroCadernoErrosAtual = 'todos'
let questoesEmMemoria = []
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
    <option value="${escaparHtmlQuestao(valor)}" ${valor === valorAtual ? 'selected' : ''}>${escaparHtmlQuestao(valor)}</option>
  `).join('')
}

function escaparHtmlQuestao(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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

  select.innerHTML = '<option value="">Carregando...</option>'

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

  if (typeof carregarTopicosEditalParaSelect === 'function') {
    await carregarTopicosEditalParaSelect('q-edital-topico', materiaId, topicoAtualId, 'Sem assunto específico')
    return
  }

  const select = document.getElementById('q-edital-topico')
  if (select) select.innerHTML = '<option value="">Sem assunto específico</option>'
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

      numAlternativas    = parseInt(btn.dataset.num)
      alternativaMarcada = null
      alternativaCorreta = null

      gerarCamposAlternativas(numAlternativas)
      gerarBotoesAlternativas(numAlternativas)
    })
  })
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
      sincronizarTipoQuestaoPorCampos()
      sugerirAcaoCorretivaPorMotivo('q')
    })
  document.getElementById('q-nivel-confianca')
    ?.addEventListener('change', sincronizarTipoQuestaoPorCampos)

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

function sincronizarTipoQuestaoPorCampos() {
  const motivo = document.getElementById('q-motivo-erro')?.value
  const confianca = document.getElementById('q-nivel-confianca')?.value
  const configChutada = obterConfigTipoQuestao('Chutada')

  if (configChutada.motivos.includes(motivo) || configChutada.niveis.includes(confianca)) {
    selecionarTipoQuestao('Chutada', true)
    return
  }
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
      <p>Complete: ${escaparHtmlQuestao(essenciais.join(', '))}.</p>
    `
    return
  }

  if (recomendados.length > 0) {
    box.innerHTML = `
      <strong>Pode salvar em modo rápido</strong>
      <p>Se deixar sem preencher, o sistema marca como "A diagnosticar" e mostra depois em diagnóstico a reforçar.</p>
      <ul>${recomendados.slice(0, 4).map(item => `<li>${escaparHtmlQuestao(item)}</li>`).join('')}</ul>
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
    <button class="pegadinha-chip" type="button" data-pegadinha="${escaparHtmlQuestao(pegadinha)}">
      ${escaparHtmlQuestao(pegadinha)}
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
function gerarCamposAlternativas(num) {
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
    linha.querySelector('input')?.addEventListener('input', atualizarAssistenteDiagnosticoMinimo)
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
          <span class="alt-letra">${escaparHtmlQuestao(letra)}</span>
          <span class="alt-texto">${escaparHtmlQuestao(texto)}</span>
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
      <h4>${escaparHtmlQuestao(titulo)}</h4>
      <div class="duplicada-meta">
        <span>${escaparHtmlQuestao(q.materiaNome)}</span>
        ${q.topicoNome ? `<span>${escaparHtmlQuestao(q.topicoNome)}</span>` : ''}
        ${q.banca ? `<span>${escaparHtmlQuestao(q.banca)}</span>` : ''}
        <span>${escaparHtmlQuestao(q.data)}</span>
        <span>${escaparHtmlQuestao(obterRotuloTipoQuestao(q.tipoQuestao))}</span>
      </div>
      <p class="duplicada-enunciado">${escaparHtmlQuestao(q.enunciado)}</p>
      <div class="lista-alternativas-card">${alternativas}</div>
      <div class="card-questao-alternativas">
        <span class="tag-errada">Marquei: ${escaparHtmlQuestao(q.alternativaMarcada)}</span>
        <span class="tag-certa">Correta: ${escaparHtmlQuestao(q.alternativaCorreta)}</span>
      </div>
      ${diagnosticos.length > 0 ? `
        <div class="card-questao-diagnostico duplicada-diagnostico">
          ${diagnosticos.map(([rotulo, texto]) => `
            <div class="diagnostico-item">
              <span class="diagnostico-rotulo">${escaparHtmlQuestao(rotulo)}</span>
              <p>${escaparHtmlQuestao(texto)}</p>
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
    pegadinha
  })
}

function montarPromptDiagnosticoChatGPT(dados) {
  return `Você é uma IA assistente de estudos para concursos. Vou te enviar uma questão e/ou o comentário do professor, banca ou alunos.

Sua tarefa é usar esse material apenas como fonte e preencher os campos de diagnóstico do meu caderno de erros, incluindo as pegadinhas da questão.

Não substitua nem reescreva o comentário original. Use o comentário do professor/alunos apenas para entender a questão. Se o comentário tiver informações conflitantes, priorize a explicação mais técnica/provável. Se faltar informação, diga isso de forma objetiva. Não invente regra, artigo ou fundamento que não apareça no material.

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

Responda exatamente no formato abaixo, mantendo os rótulos em letras maiúsculas:

PEGADINHAS:
[aponte objetivamente as armadilhas da questão. Quando possível, use uma ou mais destas categorias: Palavra absoluta; Exceção escondida; Alternativa parcialmente correta; Inversão de conceito; Troca de termos parecidos; Interpretação induzida; Cobrança literal; Detalhe sutil no enunciado; Confusão entre conceitos; Outro. Se não houver pegadinha clara, diga "Não identifiquei pegadinha relevante".]

CONCEITO:
[diga qual regra, conceito, artigo, fórmula, entendimento ou ideia central resolve a questão]

RECONHECER:
[mostre quais palavras-chave, sinais no enunciado ou padrão de cobrança indicam que devo aplicar esse conceito]

ACAO:
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

function abrirColarRespostaChatGPT() {
  abrirModalColarRespostaChatGPT('cadastro')
}

function abrirColarRespostaChatGPTEdicao() {
  abrirModalColarRespostaChatGPT('edicao')
}

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
    .addEventListener('click', () => aplicarRespostaChatGPT(modal, destino))

  document.getElementById('texto-resposta-chatgpt').focus()
}

function aplicarRespostaChatGPT(modal, destino = 'cadastro') {
  const texto = document.getElementById('texto-resposta-chatgpt').value
  const feedback = document.getElementById('msg-resposta-chatgpt')
  const campos = extrairCamposRespostaChatGPT(texto)
  const alvos = obterCamposRespostaChatGPT(destino)
  const preenchidos = []
  const comentarioPreservado = Boolean(campos.comentario)

  if (campos.pegadinhas && alvos.pegadinhas) {
    alvos.pegadinhas.value = campos.pegadinhas
    sincronizarChipsPegadinha(document.getElementById(`${destino === 'edicao' ? 'edit' : 'q'}-pegadinha-chips`), campos.pegadinhas)
    preenchidos.push('Pegadinhas')
  }

  if (campos.conceito && alvos.conceito) {
    alvos.conceito.value = campos.conceito
    preenchidos.push('Conceito')
  }

  if (campos.reconhecer && alvos.reconhecer) {
    alvos.reconhecer.value = campos.reconhecer
    preenchidos.push('Reconhecer')
  }

  if (campos.acao && alvos.acao) {
    alvos.acao.value = campos.acao
    preenchidos.push('Ação')
  }

  if (preenchidos.length === 0) {
    feedback.textContent = 'Não encontrei os rótulos PEGADINHAS, CONCEITO, RECONHECER e ACAO. O comentário original foi preservado.'
    feedback.className = 'prompt-chatgpt-feedback prompt-chatgpt-feedback--erro'
    return
  }

  feedback.textContent = `${preenchidos.join(', ')} preenchido${preenchidos.length > 1 ? 's' : ''}.${comentarioPreservado ? ' Comentário original preservado.' : ''}`
  feedback.className = 'prompt-chatgpt-feedback'

  setTimeout(() => modal.remove(), 700)
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
  if (normalizado.includes('COMENTARIO') || normalizado.includes('OBSERVACAO')) return 'comentario'
  if (normalizado.includes('PEGADINHA') || normalizado.includes('ARMADILHA')) return 'pegadinhas'
  if (normalizado.includes('CONCEITO') || normalizado.includes('REGRA')) return 'conceito'
  if (normalizado.includes('RECONHECER')) return 'reconhecer'
  if (normalizado === 'ACAO' || normalizado.includes('ACAO CORRETIVA')) return 'acao'
  return null
}

// ============================================
// OBTER OU CRIAR SESSÃO DE HOJE
// ============================================
async function obterOuCriarSessaoDeHoje() {
  const agora = new Date()
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`

  const { data: sessaoExistente } = await db
    .from('sessoes_estudo')
    .select('id, total_questoes')
    .eq('user_id', window.usuarioAtual.id)
    .eq('data', hoje)
    .single()

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

  if (error) return null
  return novaSessao
}

function dataQuestaoHoje() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

function adicionarDiasQuestao(dataISO, dias) {
  const data = new Date(`${dataISO}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
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
      btn.textContent = '💾 Salvar Questão'
      abrirModalQuestaoDuplicada(dadosQuestao, duplicada)
      return
    }
  }

  btn.disabled = true
  btn.textContent = 'Salvando...'

  const sessao = await obterOuCriarSessaoDeHoje()
  if (!sessao) {
    mostrarMsgQuestao('Erro ao criar sessão de estudo.', 'erro')
    btn.disabled    = false
    btn.textContent = '💾 Salvar Questão'
    return
  }

  const { error: erroQuestao } = await db
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
      revisar_novamente_em: adicionarDiasQuestao(dataQuestaoHoje(), 1),
      revisao_etapa:       0,
      motivo_erro:         motivoErro,
      nivel_confianca:     nivelConfianca,
      comentario:          comentario || null,
      conceito_chave:      conceitoChave || null,
      como_reconhecer:     comoReconhecer || null,
      acao_corretiva:      acaoCorretiva || null
    })

  if (erroQuestao) {
    console.error(erroQuestao)
    mostrarMsgQuestao('Erro ao salvar questão. Execute os SQLs de melhoria e do edital no Supabase se ainda não fez.', 'erro')

    // Feedback visual de erro no botão
    const textoOriginalErro = btn.textContent
    btn.style.background = 'var(--cor-erro)'
    btn.textContent = '✗ Erro ao salvar'

    setTimeout(() => {
      btn.style.background = ''
      btn.textContent = '💾 Salvar Questão'
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

  await db
    .from('sessoes_estudo')
    .update({ total_questoes: sessao.total_questoes + 1 })
    .eq('id', sessao.id)

  // Reseta formulário
  document.getElementById('q-materia').value    = ''
  document.getElementById('q-edital-topico').value = ''
  document.getElementById('q-banca').value = ''
  document.getElementById('q-pegadinha-banca').value = ''
  document.getElementById('q-enunciado').value  = ''
  document.getElementById('q-comentario').value = ''
  document.getElementById('q-conceito-chave').value = ''
  document.getElementById('q-como-reconhecer').value = ''
  document.getElementById('q-acao-corretiva').value = ''
  document.getElementById('q-motivo-erro').value = ''
  document.getElementById('q-nivel-confianca').value = ''
  sincronizarChipsPegadinha(document.getElementById('q-pegadinha-chips'), '')
  selecionarTipoQuestao('Errada', false)
  carregarTopicosQuestao()
  alternativaMarcada = null
  alternativaCorreta = null
  gerarCamposAlternativas(numAlternativas)
  gerarBotoesAlternativas(numAlternativas)
  atualizarAssistenteDiagnosticoMinimo()

  // Feedback visual de sucesso no botão
  const textoOriginal = btn.textContent
  btn.style.background = 'var(--cor-sucesso)'
  btn.textContent = '✓ Salvo!'

  setTimeout(() => {
    btn.style.background = ''
    btn.textContent = textoOriginal
  }, 2000)

  mostrarMsgQuestao('Questão salva com sucesso!', 'sucesso')
  setTimeout(() => mostrarMsgQuestao('', ''), 3000)

  // Carrega questões e marca o primeiro card como novo
  await carregarQuestoes(true)
  if (typeof avaliarConquistasUsuario === 'function') {
    await avaliarConquistasUsuario({ atualizarPerfil: true })
  }
  mostrarMsgQuestao('Questão salva com sucesso!', 'sucesso')
  setTimeout(() => mostrarMsgQuestao('', ''), 3000)

  carregarQuestoes()
  if (typeof avaliarConquistasUsuario === 'function') {
    await avaliarConquistasUsuario({ atualizarPerfil: true })
  }
  atualizarTelasAposRegistro()
}

async function atualizarTelasAposRegistro() {
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

  const resultados = await Promise.allSettled(tarefas)
  resultados.forEach(resultado => {
    if (resultado.status === 'rejected') console.error(resultado.reason)
  })
}

// ============================================
// CARREGAR LISTA DE QUESTÕES
// ============================================
async function carregarQuestoes(marcarPrimeiroComoNovo = false) {
  const lista       = document.getElementById('lista-questoes')
  const placeholder = document.getElementById('placeholder-questoes')

  placeholder.textContent   = '⏳ Carregando questões...'
  placeholder.style.display = 'block'

  const { data, error } = await db
    .from('questoes')
    .select('id, materia_id, edital_topico_id, banca, pegadinha_banca, enunciado, alternativas, alternativa_marcada, alternativa_correta, tipo_questao, status_revisao, revisar_novamente_em, revisao_ultima_data, revisao_ultima_resultado, revisao_total_acertos, revisao_total_erros, revisao_etapa, motivo_erro, nivel_confianca, comentario, conceito_chave, como_reconhecer, acao_corretiva, criado_em, materias(nome), edital_topicos(titulo, status)')
    .eq('user_id', window.usuarioAtual.id)
    .order('criado_em', { ascending: false })

  if (error) {
    console.error(error)
    placeholder.textContent = '❌ Erro ao carregar questões. Execute os SQLs de melhoria e do edital no Supabase.'
    return
  }

  lista.innerHTML = ''
  renderizarAcoesCadernoErros(data || [])

  if (!data || data.length === 0) {
    placeholder.textContent   = '❌ Nenhuma questão cadastrada ainda.'
    placeholder.style.display = 'block'
    lista.appendChild(placeholder)
    return
  }

  placeholder.style.display = 'none'
  lista.appendChild(placeholder)
  questoesEmMemoria = data
  const dadosFiltrados = filtrarQuestoesCadernoErros(data)
  renderizarListaQuestoes(dadosFiltrados)

  if (dadosFiltrados.length === 0) {
    placeholder.textContent = obterMensagemFiltroCadernoErros()
    placeholder.style.display = 'block'
    return
  }

  const pendentesErradas = dadosFiltrados.filter(q =>
    normalizarStatusRevisao(q) !== 'recuperada' &&
    normalizarTipoQuestao(q) === 'Errada'
  )
  const pendentesChutadas = dadosFiltrados.filter(q =>
    normalizarStatusRevisao(q) !== 'recuperada' &&
    normalizarTipoQuestao(q) === 'Chutada'
  )
  const recuperadas = dadosFiltrados.filter(q => normalizarStatusRevisao(q) === 'recuperada')

  let primeiroCardAdicionado = false

  if (pendentesErradas.length > 0) {
    lista.appendChild(criarCabecalhoGrupoQuestoes(
      'Erros por falta de domínio',
      `${formatarQuantidadeQuestoes(pendentesErradas.length)} com correção obrigatória`
    ))
    pendentesErradas.forEach(q => {
      const card = criarCardQuestao(q)
      if (marcarPrimeiroComoNovo && !primeiroCardAdicionado) {
        card.classList.add('card-questao--novo')
        primeiroCardAdicionado = true
      }
      lista.appendChild(card)
    })
  }

  if (pendentesChutadas.length > 0) {
    lista.appendChild(criarCabecalhoGrupoQuestoes(
      'Acertos no chute e baixa confiança',
      `${formatarQuantidadeQuestoes(pendentesChutadas.length)} para confirmar domínio`
    ))
    pendentesChutadas.forEach(q => {
      const card = criarCardQuestao(q)
      if (marcarPrimeiroComoNovo && !primeiroCardAdicionado) {
        card.classList.add('card-questao--novo')
        primeiroCardAdicionado = true
      }
      lista.appendChild(card)
    })
  }

  if (recuperadas.length > 0) {
    lista.appendChild(criarCabecalhoGrupoQuestoes(
      'Questões recuperadas',
      `${formatarQuantidadeQuestoes(recuperadas.length)} fora da fila crítica`
    ))
    recuperadas.forEach(q => {
      const card = criarCardQuestao(q)
      if (marcarPrimeiroComoNovo && !primeiroCardAdicionado) {
        card.classList.add('card-questao--novo')
        primeiroCardAdicionado = true
      }
      lista.appendChild(card)
    })
  }
}

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
          ${escaparHtmlQuestao(rotulo)} <span>${total}</span>
        </button>
      `).join('')}
    </div>
  `

  container.querySelectorAll('[data-filtro-caderno]').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroCadernoErrosAtual = btn.dataset.filtroCaderno || 'todos'
      carregarQuestoes()
    })
  })
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

function renderizarListaQuestoes(listaParaExibir) {
  const container = document.getElementById('lista-questoes');
  if (!container) return;

  container.innerHTML = '';

  if (listaParaExibir.length === 0) {
    container.innerHTML = `
      <div class="estado-vazio">
        <p>Nenhuma questão encontrada com este filtro.</p>
      </div>`;
    return;
  }

  // Reutiliza a lógica de criação dos cards que já existe no seu código
  // (Ajuste o nome da função abaixo se a sua tiver outro nome, ex: criarCardQuestao)
  listaParaExibir.forEach(item => {
    const card = criarCardQuestao(item); 
    container.appendChild(card);
  });
}

function obterMensagemFiltroCadernoErros() {
  if (filtroCadernoErrosAtual === 'diagnostico') return '✅ Nenhuma questão com diagnóstico incompleto ou fraco.'
  if (filtroCadernoErrosAtual === 'sem-assunto') return '✅ Todas as questões estão vinculadas a algum assunto do edital.'
  if (filtroCadernoErrosAtual === 'pegadinhas') return 'Nenhuma questão com pegadinha registrada ainda.'
  return 'Nenhuma questão encontrada para este filtro.'
}

function filtrarQuestoesBusca(termo) {
  const termoNormalizado = termo.toLowerCase().trim();
  const infoElemento = document.getElementById('resultado-busca-info');
  
  if (!termoNormalizado) {
    renderizarListaQuestoes(questoesEmMemoria);
    if (infoElemento) infoElemento.textContent = '';
    return;
  }

  const filtradas = questoesEmMemoria.filter(q => {
    const enunciado = (q.enunciado || '').toLowerCase();
    const motivo = (q.motivo_erro || '').toLowerCase();
    const materia = (q.materias?.nome || '').toLowerCase();
    
    return enunciado.includes(termoNormalizado) || 
           motivo.includes(termoNormalizado) || 
           materia.includes(termoNormalizado);
  });

  const criterio = document.getElementById('ordenacao-caderno')?.value || 'recente';
  const ordenadas = ordenarQuestoes(filtradas, criterio);
  renderizarListaQuestoes(ordenadas);
  
  if (infoElemento) {
    infoElemento.textContent = `${filtradas.length} resultado(s) encontrado(s)`;
  }
}

function ordenarQuestoes(lista, criterio) {
  return [...lista].sort((a, b) => {
    const qa = a.questoes || a;
    const qb = b.questoes || b;
    const matA = (a.materias?.nome || '').toLowerCase();
    const matB = (b.materias?.nome || '').toLowerCase();

    switch (criterio) {
      case 'antigas':
        return new Date(qa.criado_em) - new Date(qb.criado_em);
      
      case 'materia':
        return matA.localeCompare(matB);
      
      case 'diagnostico':
        // Usa utilitário existente (assumindo que está global ou importado)
        const scoreA = typeof avaliarQualidadeDiagnosticoQuestao === 'function' 
          ? avaliarQualidadeDiagnosticoQuestao(qa) 
          : 0;
        const scoreB = typeof avaliarQualidadeDiagnosticoQuestao === 'function' 
          ? avaliarQualidadeDiagnosticoQuestao(qb) 
          : 0;
        return scoreA - scoreB; // Menor score (pior) primeiro
      
      case 'revisao':
        if (!qa.revisar_novamente_em && !qb.revisar_novamente_em) return 0;
        if (!qa.revisar_novamente_em) return 1; // Nulos no fim
        if (!qb.revisar_novamente_em) return -1;
        return new Date(qa.revisar_novamente_em) - new Date(qb.revisar_novamente_em);
      
      case 'recente':
      default:
        return new Date(qb.criado_em) - new Date(qa.criado_em);
    }
  });
}

function criarCabecalhoGrupoQuestoes(titulo, resumo) {
  const header = document.createElement('div')
  header.className = 'questoes-grupo-header'
  header.innerHTML = `
    <h3 class="questoes-grupo-titulo">${escaparHtmlQuestao(titulo)}</h3>
    <span class="questoes-grupo-resumo">${escaparHtmlQuestao(resumo)}</span>
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
            <span class="diagnostico-rotulo">${escaparHtmlQuestao(rotulo)}</span>
            <p>${escaparHtmlQuestao(texto)}</p>
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
          <span class="alt-letra">${escaparHtmlQuestao(letra)}</span>
          <span class="alt-texto">${escaparHtmlQuestao(texto)}</span>
        </div>
      `
      }).join('')
  }

  card.innerHTML = `
    <div class="card-questao-topo">
      <span class="tag-materia">${escaparHtmlQuestao(nomeMateria)}</span>
      <span class="card-questao-data">${data}</span>
    </div>
    <p class="card-questao-enunciado">${escaparHtmlQuestao(enunciadoCurto)}</p>
    <div class="lista-alternativas-card">${listaAlternativas}</div>
    <div class="card-questao-alternativas">
      <span class="${classeTagMarcada}">${escaparHtmlQuestao(textoTagMarcada)}</span>
      <span class="tag-certa">Correta: ${escaparHtmlQuestao(q.alternativa_correta)}</span>
    </div>
    <div class="questao-tags-estudo">
      <span class="tag-tipo-questao ${obterClasseTipoQuestao(tipoQuestao)}">${rotuloTipo}</span>
      ${statusRevisao === 'recuperada' ? '<span class="tag-revisao tag-revisao--acerto">Recuperada no simulado</span>' : ''}
      ${totalErrosRevisao > 0 ? `<span class="tag-revisao tag-revisao--erro">${totalErrosRevisao} erro${totalErrosRevisao !== 1 ? 's' : ''} em revisão</span>` : ''}
      ${q.edital_topicos?.titulo ? `<span class="tag-estudo">Edital: ${escaparHtmlQuestao(q.edital_topicos.titulo)}</span>` : ''}
      ${q.banca ? `<span class="tag-estudo">Banca: ${escaparHtmlQuestao(q.banca)}</span>` : ''}
      ${Number(q.revisao_etapa || 0) > 0 ? `<span class="tag-estudo">Ciclo 24/7/30: etapa ${Number(q.revisao_etapa || 0)}</span>` : ''}
      ${q.motivo_erro ? `<span class="tag-estudo">${escaparHtmlQuestao(rotuloMotivo)}: ${escaparHtmlQuestao(q.motivo_erro)}</span>` : ''}
      ${q.nivel_confianca ? `<span class="tag-estudo">Confiança: ${escaparHtmlQuestao(q.nivel_confianca)}</span>` : ''}
      <span class="diagnostico-qualidade-tag ${qualidadeDiagnostico.classe}">${escaparHtmlQuestao(qualidadeDiagnostico.rotulo)}</span>
    </div>
    ${q.comentario ? `<p class="card-questao-comentario">💬 ${escaparHtmlQuestao(q.comentario)}</p>` : ''}
    ${q.pegadinha_banca ? `<p class="card-questao-comentario card-questao-pegadinha"><strong>Pegadinhas da questão:</strong> ${escaparHtmlQuestao(q.pegadinha_banca)}</p>` : ''}
    ${alertaCadastro}
    ${qualidadeDiagnostico.status !== 'completo' ? `
      <div class="diagnostico-qualidade-alerta ${qualidadeDiagnostico.classe}">
        <strong>${escaparHtmlQuestao(qualidadeDiagnostico.rotulo)}</strong>
        <span>${escaparHtmlQuestao(resumoQualidade)}</span>
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

  const { error } = await db
    .from('questoes')
    .delete()
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)

  if (error) {
    alert('Erro ao excluir. Tente novamente.')
    return
  }

  card.remove()
  carregarQuestoes()

  // Mostra placeholder se não sobrou nenhuma
  const lista = document.getElementById('lista-questoes')
  if (lista.querySelectorAll('.card-questao').length === 0) {
    document.getElementById('placeholder-questoes').style.display = 'block'
  }

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
      <span class="badge-letra">${escaparHtmlQuestao(letra)}</span>
      <input type="text" class="input-texto edit-alt" data-letra="${escaparHtmlQuestao(letra)}"
        value="${escaparHtmlQuestao(q.alternativas[letra] || '')}" />
    </div>
  `).join('')

  const botoesAlternativas = letras.map(letra => `
    <button type="button"
      class="btn-letra edit-btn-marcada ${letra === q.alternativa_marcada ? 'selecionado-errado' : ''}"
      data-letra="${escaparHtmlQuestao(letra)}">${escaparHtmlQuestao(letra)}</button>
  `).join('')

  const botoesCorreta = letras.map(letra => `
    <button type="button"
      class="btn-letra edit-btn-correta ${letra === q.alternativa_correta ? 'selecionado-certo' : ''}"
      data-letra="${escaparHtmlQuestao(letra)}">${escaparHtmlQuestao(letra)}</button>
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
          <option value="">Carregando...</option>
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
          <input id="edit-banca" class="input-texto" type="text" maxlength="80" value="${escaparHtmlQuestao(q.banca || '')}" />
        </div>
      </div>

      <div class="campo-form">
        <label class="campo-label">Enunciado</label>
        <textarea id="edit-enunciado" class="input-texto input-textarea" rows="4">${escaparHtmlQuestao(q.enunciado)}</textarea>
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
          <label class="campo-label" id="edit-label-motivo-questao">${escaparHtmlQuestao(configEdicao.labelMotivo)}</label>
          <select id="edit-motivo-erro" class="input-texto">
            <option value="">Selecione...</option>
            ${renderizarOptionsEstudo(configEdicao.motivos, q.motivo_erro || '')}
          </select>
        </div>
        <div class="campo-form">
          <label class="campo-label" id="edit-label-confianca-questao">${escaparHtmlQuestao(configEdicao.labelConfianca)}</label>
          <select id="edit-nivel-confianca" class="input-texto">
            <option value="">Selecione...</option>
            ${renderizarOptionsEstudo(configEdicao.niveis, q.nivel_confianca || '')}
          </select>
        </div>
      </div>

      <div class="campo-form">
        <label class="campo-label">Comentário (opcional)</label>
        <textarea id="edit-comentario" class="input-texto input-textarea" rows="2">${escaparHtmlQuestao(q.comentario || '')}</textarea>
      </div>

      <div class="campo-form">
        <label class="campo-label">Pegadinhas da Questão (opcional)</label>
        <div class="pegadinha-chips" id="edit-pegadinha-chips" aria-label="Pegadinhas rápidas"></div>
        <textarea id="edit-pegadinha-banca" class="input-texto input-textarea" rows="2" placeholder="Ex: palavra absoluta, exceção escondida, alternativa parcialmente correta, troca de conceito...">${escaparHtmlQuestao(q.pegadinha_banca || '')}</textarea>
      </div>

      <div class="assistente-prompt">
        <button class="btn-primario btn-ia-analise" id="btn-analisar-ia-edicao" type="button" hidden>
          Analisar com IA e sugerir preenchimento
        </button>
        <button class="btn-secundario btn-prompt-chatgpt" id="btn-gerar-prompt-chatgpt-edicao" type="button">
          Prompt para a IA preencher campos e pegadinhas
        </button>
        <button class="btn-secundario btn-prompt-chatgpt" id="btn-colar-resposta-chatgpt-edicao" type="button">
          Colar resposta da IA e preencher os campos
        </button>
        <p class="assistente-ia-info" hidden>A análise integrada sugere campos sem salvar automaticamente e sem substituir seu comentário original.</p>
      </div>

      <div class="caderno-erros-grid">
        <div class="campo-form">
          <label class="campo-label">Conceito ou regra que resolve</label>
          <textarea id="edit-conceito-chave" class="input-texto input-textarea" rows="2">${escaparHtmlQuestao(q.conceito_chave || '')}</textarea>
        </div>
        <div class="campo-form">
          <label class="campo-label">Como reconhecer na próxima vez</label>
          <textarea id="edit-como-reconhecer" class="input-texto input-textarea" rows="2">${escaparHtmlQuestao(q.como_reconhecer || '')}</textarea>
        </div>
        <div class="campo-form caderno-erros-grid-full">
          <label class="campo-label">Ação corretiva</label>
          <textarea id="edit-acao-corretiva" class="input-texto input-textarea" rows="2">${escaparHtmlQuestao(q.acao_corretiva || '')}</textarea>
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
      if (campo === editMotivoErro) sugerirAcaoCorretivaPorMotivo('edit')
      const configChutada = obterConfigTipoQuestao('Chutada')
      const ehChute = configChutada.motivos.includes(editMotivoErro.value) || configChutada.niveis.includes(editNivelConfianca.value)
      if (ehChute && editTipoQuestao.value !== 'Chutada') {
        editTipoQuestao.value = 'Chutada'
        atualizarCamposEdicaoPorTipo('Chutada', true)
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
      document.getElementById('msg-edicao').textContent = 'Erro ao salvar. Tente novamente.'
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
  if (typeof carregarTopicosEditalParaSelect === 'function') {
    await carregarTopicosEditalParaSelect('edit-edital-topico', materiaId, topicoAtualId, 'Sem assunto específico')
    return
  }

  const select = document.getElementById('edit-edital-topico')
  if (select) select.innerHTML = '<option value="">Sem assunto específico</option>'
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
    .map(o => `<option value="${escaparHtmlQuestao(o.value)}">${escaparHtmlQuestao(o.text)}</option>`)
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
    mostrarMsgAcertos('Erro ao obter sessão. Tente novamente.', 'erro')
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
    mostrarMsgAcertos('Erro ao salvar. Tente novamente.', 'erro')
    console.error(error)
    return
  }

  mostrarMsgAcertos('✅ Acertos registrados com sucesso!', 'sucesso')
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
