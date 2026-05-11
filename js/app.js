// js/app.js

const CHAVE_SECAO_ATUAL = 'estudoConcursoSecaoAtual'
const CHAVE_MODO_INTERFACE = 'estudoConcursoModoInterface'
const CHAVE_ONBOARDING_CONCLUIDO = 'onboarding_concluido'
const SECOES_INTERFACE_AVANCADA = new Set(['edital', 'plano', 'planejamento', 'simulados', 'desempenho', 'estatisticas'])
let avisoArquivamentoToken = 0
let onboardingAtivoEstado = null

const AJUDA_SECOES = {
  dashboard: {
    titulo: 'Dashboard',
    descricao: 'Mostra uma visão geral do seu estudo, com progresso, pontos críticos e alertas importantes.',
    itens: [
      ['Central de Hoje', 'Mostra o que estudar, erros registrados hoje, próxima revisão e atalhos para registrar erro ou iniciar a fila.'],
      ['Cards principais', 'Resumo rápido de questões feitas, acertos, erros, aproveitamento, matérias estudadas e sequência de dias.'],
      ['Ciclo mensal de revisão', 'Ajuda a arquivar questões antigas, gerar PDF do mês e controlar o espaço usado no Supabase.'],
      ['Gráficos e ranking', 'Mostram evolução recente e matérias que mais precisam de atenção.'],
      ['Treinador de padrões de erro', 'Agrupa matéria, motivo, confiança, pegadinhas e qualidade do diagnóstico para mostrar o que está se repetindo.']
    ]
  },
  materias: {
    titulo: 'Matérias',
    descricao: 'Serve para cadastrar as disciplinas que aparecem no seu edital ou rotina de estudos.',
    itens: [
      ['Nova matéria', 'Cria uma disciplina para usar em questões, plano do dia, edital, simulados e estatísticas.'],
      ['Lista de matérias', 'Mostra o que já foi cadastrado e permite excluir o que não será mais usado.']
    ]
  },
  edital: {
    titulo: 'Edital Verticalizado',
    descricao: 'Organiza o edital por assunto e transforma o sistema em um mapa de preparação para concurso.',
    itens: [
      ['Reta final', 'Define concurso e data da prova; as prioridades usam a meta central do Planejamento.'],
      ['Assuntos do edital', 'Permite cadastrar tópicos, peso e status como não estudado, revisar, dominado ou dificuldade.'],
      ['Prioridades', 'Cruza peso, erros e status para mostrar onde estudar primeiro.'],
      ['Pegadinhas da banca', 'Registra padrões de cobrança, trocas comuns e cuidados para não repetir erros.']
    ]
  },
  plano: {
    titulo: 'Plano do Dia',
    descricao: 'Mostra o que estudar em uma data específica e calcula metas por matéria.',
    itens: [
      ['Data', 'Escolhe o dia que você quer montar ou consultar.'],
      ['Matéria e meta', 'Permite adicionar manualmente uma matéria; por padrão usa a meta central por matéria.'],
      ['Gerar pelo planejamento semanal', 'Puxa automaticamente as matérias previstas na aba Planejamento.'],
      ['Cards do plano', 'Mostram meta, desempenho, semáforo e sugestão de reforço por matéria.']
    ]
  },
  planejamento: {
    titulo: 'Planejamento Semanal',
    descricao: 'Monta sua rotina semanal e gera uma fila inteligente com o que estudar hoje.',
    itens: [
      ['Meta central', 'Define quantas questões valem para cada matéria planejada; o total do dia é calculado pela quantidade de matérias.'],
      ['Grade semanal', 'Define quais matérias entram em cada dia e qual tipo de estudo será feito.'],
      ['Gerar Plano do Dia', 'Transforma a grade do dia atual em entradas automáticas no Plano do Dia.'],
      ['Fila diária inteligente', 'Prioriza revisões vencidas, erros, chutes, edital, Lei Seca e proximidade da prova.'],
      ['Simulado por assunto', 'Gera um treino só com questões vinculadas a um tópico do edital.'],
      ['Pronto para a prova', 'Calcula um diagnóstico geral de preparação.'],
      ['Modo Lei Seca', 'Guarda artigos e trechos literais para leitura, marcação e revisão espaçada.']
    ]
  },
  questoes: {
    titulo: 'Caderno de Erros',
    descricao: 'É a base do método: registre erros, chutes e baixa confiança para descobrir padrões e alimentar revisões inteligentes.',
    itens: [
      ['Registrar acertos', 'Salva quantas questões você acertou com segurança em cada matéria.'],
      ['Nova entrada no caderno', 'Registra questão errada ou chutada, alternativas, gabarito, causa do erro e diagnóstico.'],
      ['Assistente de IA', 'Analisa a questão, sugere diagnóstico e também gera um prompt neutro para preencher pegadinhas, conceito, reconhecimento e ação corretiva sem apagar o comentário original.'],
      ['Pegadinhas da questão', 'Registra armadilhas como palavra absoluta, exceção escondida, inversão lógica, troca de conceito e alternativa parcialmente correta.'],
      ['Assunto e banca', 'Ligam a questão ao edital e ao padrão de cobrança da banca.'],
      ['Lista de questões', 'Mostra pendentes, chutadas e recuperadas, com opção de editar ou excluir.']
    ]
  },
  simulados: {
    titulo: 'Simulados',
    descricao: 'Serve para treinar questões críticas e registrar simulados completos.',
    itens: [
      ['Simulado de revisão', 'Gera um treino com questões pendentes do seu caderno.'],
      ['Confiança antes do gabarito', 'Evita autoengano e mede se você sabia mesmo ou chutou.'],
      ['Diagnóstico da revisão', 'Após errar ou acertar sem domínio, permite ajustar causa, conceito e ação corretiva.'],
      ['Novo simulado', 'Registra prova, banca, número de questões, acertos, erros, tempo e nota.']
    ]
  },
  desempenho: {
    titulo: 'Desempenho Diário',
    descricao: 'Mostra sua produção por dia e ajuda a enxergar constância.',
    itens: [
      ['Resumo rápido', 'Mostra dias estudados, total de questões e média diária.'],
      ['Sessões de estudo', 'Lista dias registrados e o volume de questões feitas.']
    ]
  },
  revisao: {
    titulo: 'Revisão Inteligente',
    descricao: 'É a tela que transforma erros acumulados em uma fila de revisão com motivo, prioridade e treino ativo.',
    itens: [
      ['Dias de revisão', 'Permite escolher qualquer combinação de dias para o sistema montar a fila automaticamente.'],
      ['Fila inteligente', 'Prioriza erros acumulados, recorrência, pegadinhas, dificuldade, edital, revisão vencida e tempo sem contato.'],
      ['Treino de pegadinhas', 'Mostra a questão e pede para você lembrar qual era a armadilha antes de revelar a explicação.'],
      ['Filtro por semana', 'Escolhe questões desta semana, semanas anteriores, todas ou só vencidas para hoje.'],
      ['Filtro por matéria', 'Foca a revisão em uma disciplina específica.'],
      ['Resumo inteligente', 'Mostra padrões do lote antes de você revisar.'],
      ['Flashcards', 'Você escolhe a alternativa, confirma e só depois vê o gabarito.'],
      ['Ciclo 24h/7d/30d', 'Quando registra a revisão, o sistema agenda o próximo contato.']
    ]
  },
  estatisticas: {
    titulo: 'Estatísticas',
    descricao: 'Mostra desempenho por matéria e período, juntando acertos, erros e histórico arquivado.',
    itens: [
      ['Abas de período', 'Alterna entre hoje, semana, geral ou intervalo personalizado.'],
      ['Aproveitamento', 'Ajuda a identificar matérias fortes e fracas.'],
      ['Histórico arquivado', 'Considera resumos mensais mesmo depois de limpar questões antigas.']
    ]
  },
  perfil: {
    titulo: 'Perfil',
    descricao: 'Centraliza configurações pessoais, senha e backup dos dados.',
    itens: [
      ['Alterar senha', 'Permite definir uma nova senha, inclusive após recuperação por e-mail.'],
      ['Backup dos dados', 'Exporta um arquivo JSON com suas informações para guardar fora do Supabase.'],
      ['Manual do Sistema', 'Abre o guia completo para aprender a registrar erros, configurar revisões e acompanhar evolução.'],
      ['Modo de Uso', 'Alterna entre Modo Essencial, para começar simples, e Sistema Completo, com todas as abas avançadas.']
    ]
  }
}

// ============================================
// PROTEÇÃO DE PÁGINA + INICIALIZAÇÃO
// ============================================
async function inicializar() {
  const redefinicaoSenha = obterDadosRedefinicaoSenha()
  let sessao = null

  if (redefinicaoSenha.accessToken && redefinicaoSenha.refreshToken) {
    const { data: dadosSessao, error } = await db.auth.setSession({
      access_token: redefinicaoSenha.accessToken,
      refresh_token: redefinicaoSenha.refreshToken
    })

    if (!error) sessao = dadosSessao.session
  }

  if (!sessao) {
    const { data } = await db.auth.getSession()
    sessao = data.session
  }

  if (!sessao) {
    window.location.href = obterUrlArquivoApp('index.html')
    return
  }

  window.usuarioAtual = sessao.user
  await carregarPerfil()
  await inicializarModoInterface()
  inicializarNavegacao()
  inicializarAjudaContextual()
  inicializarTema()
  inicializarMenu()
  inicializarLogout()
  inicializarAcaoFlutuante()
  navegarPara(redefinicaoSenha.ehRecuperacao ? 'perfil' : obterSecaoInicial())

  if (redefinicaoSenha.ehRecuperacao) {
    mostrarAvisoRedefinicaoSenha()
  } else {
    setTimeout(verificarOnboardingAtivo, 250)
  }
}

function obterUrlArquivoApp(nomeArquivo) {
  const url = new URL(window.location.href)
  const partes = url.pathname.split('/')
  const ultimo = partes[partes.length - 1]

  if (ultimo.includes('.')) {
    partes[partes.length - 1] = nomeArquivo
    url.pathname = partes.join('/')
  } else {
    url.pathname = `${url.pathname.replace(/\/?$/, '/')}${nomeArquivo}`
  }

  url.search = ''
  url.hash = ''
  return url.href
}

function obterDadosRedefinicaoSenha() {
  const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'))
  const searchParams = new URLSearchParams(window.location.search)
  const tipo = hashParams.get('type') || searchParams.get('type')

  return {
    ehRecuperacao: tipo === 'recovery' || Boolean(hashParams.get('access_token')),
    accessToken: hashParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token')
  }
}

function mostrarAvisoRedefinicaoSenha() {
  navegarPara('perfil')

  const msg = document.getElementById('msg-senha')
  if (msg) {
    msg.textContent = 'Digite sua nova senha abaixo.'
    msg.className = 'msg-materia sucesso'
  }

  window.history.replaceState({}, document.title, obterUrlArquivoApp('app.html'))
}

// ============================================
// CARREGAR PERFIL DO USUÁRIO
// ============================================
async function carregarPerfil() {
  const { data, error } = await db
    .from('profiles')
    .select('nome, tema')
    .eq('id', window.usuarioAtual.id)
    .single()

  if (error || !data) return

  window.perfilAtual = data

  const nome = data.nome || 'Usuário'
  document.getElementById('usuario-nome').textContent = nome
  document.getElementById('usuario-avatar').textContent = nome.charAt(0).toUpperCase()

  aplicarTema(data.tema || 'claro')
}

// ============================================
// MODO ESSENCIAL / SISTEMA COMPLETO
// ============================================
async function inicializarModoInterface() {
  const modoSalvo = localStorage.getItem(CHAVE_MODO_INTERFACE)
  const modoInicial = modoSalvo || await inferirModoInicialInterface()

  aplicarModoInterface(modoInicial, false)

  document.getElementById('btn-alternar-modo-interface')
    ?.addEventListener('click', alternarModoInterface)
  document.getElementById('btn-ativar-completo-dashboard')
    ?.addEventListener('click', () => aplicarModoInterface('completo'))
  document.getElementById('btn-modo-interface-perfil')
    ?.addEventListener('click', alternarModoInterface)
}

async function inferirModoInicialInterface() {
  try {
    const [materiasResp, questoesResp] = await Promise.all([
      db.from('materias').select('*', { count: 'exact', head: true }).eq('user_id', window.usuarioAtual.id),
      db.from('questoes').select('*', { count: 'exact', head: true }).eq('user_id', window.usuarioAtual.id)
    ])

    const totalDados = Number(materiasResp.count || 0) + Number(questoesResp.count || 0)
    return totalDados > 0 ? 'completo' : 'essencial'
  } catch (erro) {
    console.warn('Não foi possível inferir o modo inicial da interface.', erro)
    return 'essencial'
  }
}

function alternarModoInterface() {
  aplicarModoInterface(obterModoInterfaceAtual() === 'essencial' ? 'completo' : 'essencial')
}

function obterModoInterfaceAtual() {
  if (document.body.dataset.modoInterface === 'completo') return 'completo'
  return localStorage.getItem(CHAVE_MODO_INTERFACE) === 'completo' ? 'completo' : 'essencial'
}

function aplicarModoInterface(modo, persistir = true) {
  const modoNormalizado = modo === 'completo' ? 'completo' : 'essencial'

  if (persistir) localStorage.setItem(CHAVE_MODO_INTERFACE, modoNormalizado)
  document.body.dataset.modoInterface = modoNormalizado
  window.modoInterfaceAtual = modoNormalizado

  const modoEssencial = modoNormalizado === 'essencial'
  const label = document.getElementById('modo-interface-label')
  const descricao = document.getElementById('modo-interface-descricao')
  const botaoSidebar = document.getElementById('btn-alternar-modo-interface')
  const botaoPerfil = document.getElementById('btn-modo-interface-perfil')
  const textoPerfil = document.getElementById('perfil-modo-interface-texto')
  const banner = document.getElementById('modo-essencial-banner')

  if (label) label.textContent = modoEssencial ? 'Modo Essencial' : 'Sistema Completo'
  if (descricao) {
    descricao.textContent = modoEssencial
      ? 'Mostra apenas o fluxo principal.'
      : 'Todas as abas e relatórios estão visíveis.'
  }
  if (botaoSidebar) botaoSidebar.textContent = modoEssencial ? 'Ver sistema completo' : 'Voltar ao essencial'
  if (botaoPerfil) botaoPerfil.textContent = modoEssencial ? 'Ver sistema completo' : 'Voltar ao Modo Essencial'
  if (textoPerfil) {
    textoPerfil.textContent = modoEssencial
      ? 'Você está no Modo Essencial. Ele reduz distrações e mostra só o caminho principal: matérias, caderno de erros e revisão.'
      : 'Você está no sistema completo. Todas as abas, relatórios, simulados, edital e planejamento ficam disponíveis.'
  }
  if (banner) banner.hidden = !modoEssencial

  if (modoEssencial && SECOES_INTERFACE_AVANCADA.has(localStorage.getItem(CHAVE_SECAO_ATUAL))) {
    localStorage.setItem(CHAVE_SECAO_ATUAL, 'dashboard')
  }

  const secaoVisivel = document.querySelector('.secao:not(.escondido)')?.id?.replace('secao-', '')
  if (modoEssencial && SECOES_INTERFACE_AVANCADA.has(secaoVisivel) && typeof navegarPara === 'function') {
    navegarPara('dashboard')
  }

  if (!modoEssencial && persistir && secaoVisivel === 'dashboard' && typeof inicializarDashboard === 'function') {
    inicializarDashboard()
  }
}

// ============================================
// ONBOARDING ATIVO
// ============================================
async function verificarOnboardingAtivo() {
  if (localStorage.getItem(CHAVE_ONBOARDING_CONCLUIDO) === 'true') return
  if (!window.usuarioAtual?.id || document.getElementById('modal-onboarding-ativo')) return

  try {
    const [materiasResp, questoesResp] = await Promise.all([
      db.from('materias').select('*', { count: 'exact', head: true }).eq('user_id', window.usuarioAtual.id),
      db.from('questoes').select('*', { count: 'exact', head: true }).eq('user_id', window.usuarioAtual.id)
    ])

    if (materiasResp.error || questoesResp.error) return
    if (Number(materiasResp.count || 0) === 0 && Number(questoesResp.count || 0) === 0) {
      abrirOnboardingAtivo()
    }
  } catch (erro) {
    console.warn('Não foi possível verificar o onboarding ativo.', erro)
  }
}

function abrirOnboardingAtivo() {
  onboardingAtivoEstado = {
    passo: 1,
    materia: null,
    diasRevisao: [],
    numAlternativas: 2,
    marcada: '',
    correta: '',
    tipo: 'Errada',
    questaoSalva: false,
    mensagem: ''
  }

  document.getElementById('modal-onboarding-ativo')?.remove()

  const modal = document.createElement('div')
  modal.id = 'modal-onboarding-ativo'
  modal.className = 'modal-overlay modal-onboarding-overlay'
  modal.innerHTML = '<div class="modal-caixa modal-onboarding-caixa" id="onboarding-conteudo"></div>'
  document.body.appendChild(modal)

  renderizarOnboardingAtivo()
}

function renderizarOnboardingAtivo() {
  const container = document.getElementById('onboarding-conteudo')
  if (!container || !onboardingAtivoEstado) return

  const passo = onboardingAtivoEstado.passo
  container.innerHTML = `
    ${passo <= 4 ? criarProgressoOnboarding(passo) : ''}
    ${passo === 1 ? criarPassoBoasVindasOnboarding() : ''}
    ${passo === 2 ? criarPassoMateriaOnboarding() : ''}
    ${passo === 3 ? criarPassoDiasRevisaoOnboarding() : ''}
    ${passo === 4 ? criarPassoPrimeiroErroOnboarding() : ''}
    ${passo === 5 ? criarPassoFinalOnboarding() : ''}
  `

  vincularEventosOnboarding()
}

function criarProgressoOnboarding(passo) {
  const bolinhas = [1, 2, 3, 4].map(item => `
    <span class="onboarding-progresso-ponto ${item <= passo ? 'ativo' : ''}"></span>
  `).join('')

  return `
    <div class="onboarding-progresso">
      <span>Passo ${passo} de 4</span>
      <div>${bolinhas}</div>
    </div>
  `
}

function criarPassoBoasVindasOnboarding() {
  return `
    <div class="onboarding-passo">
      <h3>Bem-vindo ao Estudo Concurso</h3>
      <p>Em 4 passos rápidos você configura o essencial para começar.</p>
      <button class="btn-primario" id="onboarding-comecar" type="button">Começar →</button>
    </div>
  `
}

function criarPassoMateriaOnboarding() {
  const materia = onboardingAtivoEstado.materia
  const podeAvancar = Boolean(materia?.id)

  return `
    <div class="onboarding-passo">
      <h3>Primeira matéria</h3>
      <p>Cadastre a primeira disciplina que vai aparecer no seu caderno de erros.</p>
      <div class="form-linha onboarding-form-linha">
        <input id="onboarding-materia-nome" class="input-texto" type="text" placeholder="Ex: Português, Matemática, Direito..." maxlength="80">
        <button class="btn-primario" id="onboarding-adicionar-materia" type="button">Adicionar</button>
      </div>
      ${materia ? `<div class="onboarding-resumo-ok">Matéria adicionada: <strong>${escaparHtmlSeguro(materia.nome)}</strong></div>` : ''}
      <p class="msg-materia" id="onboarding-msg"></p>
      <div class="onboarding-acoes">
        <button class="btn-primario" id="onboarding-proximo-materia" type="button" ${podeAvancar ? '' : 'disabled'}>Próximo →</button>
      </div>
    </div>
  `
}

function criarPassoDiasRevisaoOnboarding() {
  const dias = [
    { valor: 1, label: 'Seg' },
    { valor: 2, label: 'Ter' },
    { valor: 3, label: 'Qua' },
    { valor: 4, label: 'Qui' },
    { valor: 5, label: 'Sex' },
    { valor: 6, label: 'Sab' },
    { valor: 7, label: 'Dom' }
  ]
  const selecionados = onboardingAtivoEstado.diasRevisao

  return `
    <div class="onboarding-passo">
      <h3>Dias de revisão</h3>
      <p>Escolha quando o sistema deve organizar os erros acumulados para revisar.</p>
      <div class="onboarding-dias-grid">
        ${dias.map(dia => `
          <label class="onboarding-dia">
            <input type="checkbox" value="${dia.valor}" ${selecionados.includes(dia.valor) ? 'checked' : ''}>
            <span>${dia.label}</span>
          </label>
        `).join('')}
      </div>
      <p class="msg-materia" id="onboarding-msg"></p>
      <div class="onboarding-acoes">
        <button class="btn-primario" id="onboarding-salvar-dias" type="button" ${selecionados.length > 0 ? '' : 'disabled'}>Próximo →</button>
      </div>
    </div>
  `
}

function criarPassoPrimeiroErroOnboarding() {
  const letras = ['A', 'B', 'C', 'D', 'E'].slice(0, onboardingAtivoEstado.numAlternativas)
  const numeros = [2, 3, 4, 5]

  return `
    <div class="onboarding-passo">
      <h3>Primeiro erro</h3>
      <p>Registre um erro simples agora ou pule para começar a usar o sistema.</p>
      <div class="onboarding-materia-fixa">
        Matéria selecionada: <strong>${escaparHtmlSeguro(onboardingAtivoEstado.materia?.nome || 'Primeira matéria')}</strong>
      </div>

      <div class="campo-form">
        <label class="campo-label" for="onboarding-enunciado">Enunciado da questão</label>
        <textarea id="onboarding-enunciado" class="input-texto input-textarea" rows="3" placeholder="Cole ou digite o enunciado..."></textarea>
      </div>

      <div class="campo-form">
        <label class="campo-label">Número de alternativas</label>
        <div class="grupo-botoes">
          ${numeros.map(num => `<button class="btn-num ${num === onboardingAtivoEstado.numAlternativas ? 'ativo-num' : ''}" data-onboarding-num="${num}" type="button">${num}</button>`).join('')}
        </div>
      </div>

      <div class="onboarding-alternativas">
        ${letras.map(letra => `
          <div class="linha-alternativa">
            <span class="badge-letra">${letra}</span>
            <input id="onboarding-alt-${letra}" class="input-texto" type="text" placeholder="Texto da alternativa ${letra}">
          </div>
        `).join('')}
      </div>

      <div class="form-grid-duas-colunas">
        <div class="campo-form">
          <label class="campo-label">Qual alternativa você marcou?</label>
          <div class="grupo-botoes">
            ${letras.map(letra => `<button class="btn-letra ${letra === onboardingAtivoEstado.marcada ? 'selecionado-errado' : ''}" data-onboarding-marcada="${letra}" type="button">${letra}</button>`).join('')}
          </div>
        </div>
        <div class="campo-form">
          <label class="campo-label">Qual era a correta?</label>
          <div class="grupo-botoes">
            ${letras.map(letra => `<button class="btn-letra ${letra === onboardingAtivoEstado.correta ? 'selecionado-certo' : ''}" data-onboarding-correta="${letra}" type="button">${letra}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="form-grid-duas-colunas">
        <div class="campo-form">
          <label class="campo-label">Tipo da questão</label>
          <div class="grupo-botoes grupo-tipo-questao">
            <button class="btn-tipo-questao ${onboardingAtivoEstado.tipo === 'Errada' ? 'ativo-tipo' : ''}" data-onboarding-tipo="Errada" type="button">Errada realmente</button>
            <button class="btn-tipo-questao ${onboardingAtivoEstado.tipo === 'Chutada' ? 'ativo-tipo' : ''}" data-onboarding-tipo="Chutada" type="button">Chutada</button>
          </div>
        </div>
        <div class="campo-form">
          <label class="campo-label" for="onboarding-motivo">Causa inicial</label>
          <select id="onboarding-motivo" class="input-texto">
            <option value="A diagnosticar">A diagnosticar</option>
            <option value="Falta de conteúdo">Falta de conteúdo</option>
            <option value="Interpretação incorreta">Interpretação incorreta</option>
            <option value="Desatenção">Desatenção</option>
            <option value="Pegadinha">Pegadinha</option>
            <option value="Dúvida entre alternativas">Dúvida entre alternativas</option>
          </select>
        </div>
      </div>

      <p class="msg-materia" id="onboarding-msg"></p>
      <div class="onboarding-acoes onboarding-acoes--separadas">
        <button class="btn-primario" id="onboarding-salvar-erro" type="button">Salvar e concluir</button>
        <button class="btn-link-onboarding" id="onboarding-pular-erro" type="button">Pular por agora</button>
      </div>
    </div>
  `
}

function criarPassoFinalOnboarding() {
  const diasTexto = textoDiasOnboarding(onboardingAtivoEstado.diasRevisao)

  return `
    <div class="onboarding-passo onboarding-final">
      <h3>Configuração inicial concluída</h3>
      <p>Você já tem o essencial para começar a usar o Estudo Concurso.</p>
      <ul>
        <li>Matéria: <strong>${escaparHtmlSeguro(onboardingAtivoEstado.materia?.nome || 'configurada')}</strong></li>
        <li>Dias de revisão: <strong>${escaparHtmlSeguro(diasTexto)}</strong></li>
        <li>Primeiro erro: <strong>${onboardingAtivoEstado.questaoSalva ? 'salvo no caderno' : 'pulado por agora'}</strong></li>
      </ul>
      <button class="btn-primario" id="onboarding-ir-dashboard" type="button">Ir para o Dashboard</button>
    </div>
  `
}

function vincularEventosOnboarding() {
  document.getElementById('onboarding-comecar')
    ?.addEventListener('click', () => avancarOnboarding(2))

  document.getElementById('onboarding-adicionar-materia')
    ?.addEventListener('click', adicionarMateriaOnboarding)
  document.getElementById('onboarding-materia-nome')
    ?.addEventListener('keydown', e => {
      if (e.key === 'Enter') adicionarMateriaOnboarding()
    })
  document.getElementById('onboarding-proximo-materia')
    ?.addEventListener('click', () => avancarOnboarding(3))

  document.querySelectorAll('.onboarding-dia input').forEach(input => {
    input.addEventListener('change', () => {
      onboardingAtivoEstado.diasRevisao = Array.from(document.querySelectorAll('.onboarding-dia input:checked')).map(item => Number(item.value))
      document.getElementById('onboarding-salvar-dias').disabled = onboardingAtivoEstado.diasRevisao.length === 0
    })
  })
  document.getElementById('onboarding-salvar-dias')
    ?.addEventListener('click', salvarDiasOnboarding)

  document.querySelectorAll('[data-onboarding-num]').forEach(btn => {
    btn.addEventListener('click', () => {
      onboardingAtivoEstado.numAlternativas = Number(btn.dataset.onboardingNum)
      onboardingAtivoEstado.marcada = ''
      onboardingAtivoEstado.correta = ''
      renderizarOnboardingAtivo()
    })
  })
  document.querySelectorAll('[data-onboarding-marcada]').forEach(btn => {
    btn.addEventListener('click', () => selecionarBotaoOnboarding(btn, 'marcada', 'selecionado-errado'))
  })
  document.querySelectorAll('[data-onboarding-correta]').forEach(btn => {
    btn.addEventListener('click', () => selecionarBotaoOnboarding(btn, 'correta', 'selecionado-certo'))
  })
  document.querySelectorAll('[data-onboarding-tipo]').forEach(btn => {
    btn.addEventListener('click', () => selecionarTipoOnboarding(btn))
  })
  document.getElementById('onboarding-salvar-erro')
    ?.addEventListener('click', salvarPrimeiroErroOnboarding)
  document.getElementById('onboarding-pular-erro')
    ?.addEventListener('click', () => concluirOnboardingAtivo(false))
  document.getElementById('onboarding-ir-dashboard')
    ?.addEventListener('click', fecharOnboardingAtivo)
}

function avancarOnboarding(passo) {
  onboardingAtivoEstado.passo = passo
  onboardingAtivoEstado.mensagem = ''
  renderizarOnboardingAtivo()
}

async function adicionarMateriaOnboarding() {
  const input = document.getElementById('onboarding-materia-nome')
  const btn = document.getElementById('onboarding-adicionar-materia')
  const nome = input?.value.trim() || ''

  if (nome.length < 2) {
    mostrarMsgOnboarding('Digite uma matéria com pelo menos 2 caracteres.', 'erro')
    return
  }

  btn.disabled = true
  btn.textContent = 'Salvando...'

  const resultado = typeof salvarMateriaUsuario === 'function'
    ? await salvarMateriaUsuario(nome)
    : await db.from('materias').insert({ user_id: window.usuarioAtual.id, nome }).select('id, nome, criado_em').single()

  btn.disabled = false
  btn.textContent = 'Adicionar'

  if (resultado.error) {
    mostrarMsgOnboarding('Não foi possível salvar a matéria. Tente novamente.', 'erro')
    return
  }

  onboardingAtivoEstado.materia = resultado.data
  if (typeof carregarMaterias === 'function') carregarMaterias()
  renderizarOnboardingAtivo()
}

async function salvarDiasOnboarding() {
  if (onboardingAtivoEstado.diasRevisao.length === 0) {
    mostrarMsgOnboarding('Escolha pelo menos um dia de revisão.', 'erro')
    return
  }

  const btn = document.getElementById('onboarding-salvar-dias')
  btn.disabled = true
  btn.textContent = 'Salvando...'

  if (typeof salvarConfiguracaoRevisaoUsuario === 'function') {
    await salvarConfiguracaoRevisaoUsuario({
      dias_revisao: onboardingAtivoEstado.diasRevisao,
      tempo_revisao_minutos: 60
    })
  }

  btn.disabled = false
  avancarOnboarding(4)
}

function selecionarBotaoOnboarding(btn, campo, classe) {
  btn.parentElement.querySelectorAll('.btn-letra').forEach(item => item.classList.remove(classe))
  btn.classList.add(classe)
  onboardingAtivoEstado[campo] = btn.dataset[`onboarding${campo.charAt(0).toUpperCase()}${campo.slice(1)}`]
}

function selecionarTipoOnboarding(btn) {
  btn.parentElement.querySelectorAll('.btn-tipo-questao').forEach(item => item.classList.remove('ativo-tipo'))
  btn.classList.add('ativo-tipo')
  onboardingAtivoEstado.tipo = btn.dataset.onboardingTipo === 'Chutada' ? 'Chutada' : 'Errada'
}

async function salvarPrimeiroErroOnboarding() {
  const btn = document.getElementById('onboarding-salvar-erro')
  const dados = obterDadosPrimeiroErroOnboarding()

  if (!dados.enunciado) {
    mostrarMsgOnboarding('Digite o enunciado da questão.', 'erro')
    return
  }
  if (Object.values(dados.alternativas).some(valor => !valor)) {
    mostrarMsgOnboarding('Preencha o texto das alternativas exibidas.', 'erro')
    return
  }
  if (!dados.alternativa_marcada || !dados.alternativa_correta) {
    mostrarMsgOnboarding('Marque a alternativa escolhida e a correta.', 'erro')
    return
  }
  if (dados.tipo_questao === 'Errada' && dados.alternativa_marcada === dados.alternativa_correta) {
    mostrarMsgOnboarding('Se marcou a correta, use o tipo "Chutada" ou escolha uma alternativa marcada diferente.', 'erro')
    return
  }

  btn.disabled = true
  btn.textContent = 'Salvando...'

  try {
    const sessao = typeof obterOuCriarSessaoDeHoje === 'function'
      ? await obterOuCriarSessaoDeHoje()
      : null

    if (!sessao) throw new Error('Não foi possível criar a sessão de estudo.')

    const hoje = typeof dataQuestaoHoje === 'function' ? dataQuestaoHoje() : dataHojeOnboarding()
    const revisarEm = typeof adicionarDiasQuestao === 'function' ? adicionarDiasQuestao(hoje, 1) : adicionarDiasOnboarding(hoje, 1)
    const { error } = await db.from('questoes').insert({
      user_id: window.usuarioAtual.id,
      sessao_id: sessao.id,
      materia_id: onboardingAtivoEstado.materia.id,
      edital_topico_id: null,
      banca: null,
      pegadinha_banca: null,
      enunciado: dados.enunciado,
      alternativas: dados.alternativas,
      alternativa_correta: dados.alternativa_correta,
      alternativa_marcada: dados.alternativa_marcada,
      tipo_questao: dados.tipo_questao,
      status_revisao: 'pendente',
      revisar_novamente_em: revisarEm,
      revisao_etapa: 0,
      motivo_erro: dados.motivo_erro,
      nivel_confianca: 'Não informado',
      comentario: null,
      conceito_chave: null,
      como_reconhecer: null,
      acao_corretiva: null
    })

    if (error) throw error

    await db
      .from('sessoes_estudo')
      .update({ total_questoes: Number(sessao.total_questoes || 0) + 1 })
      .eq('id', sessao.id)

    if (typeof atualizarTelasAposRegistro === 'function') atualizarTelasAposRegistro()
    concluirOnboardingAtivo(true)
  } catch (erro) {
    console.error(erro)
    mostrarMsgOnboarding('Não foi possível salvar o primeiro erro. Você pode pular por agora.', 'erro')
    btn.disabled = false
    btn.textContent = 'Salvar e concluir'
  }
}

function obterDadosPrimeiroErroOnboarding() {
  const letras = ['A', 'B', 'C', 'D', 'E'].slice(0, onboardingAtivoEstado.numAlternativas)
  const alternativas = {}

  letras.forEach(letra => {
    alternativas[letra] = document.getElementById(`onboarding-alt-${letra}`)?.value.trim() || ''
  })

  return {
    enunciado: document.getElementById('onboarding-enunciado')?.value.trim() || '',
    alternativas,
    alternativa_marcada: onboardingAtivoEstado.marcada,
    alternativa_correta: onboardingAtivoEstado.correta,
    tipo_questao: onboardingAtivoEstado.tipo,
    motivo_erro: document.getElementById('onboarding-motivo')?.value || 'A diagnosticar'
  }
}

function concluirOnboardingAtivo(questaoSalva) {
  onboardingAtivoEstado.questaoSalva = Boolean(questaoSalva)
  onboardingAtivoEstado.passo = 5
  localStorage.setItem(CHAVE_ONBOARDING_CONCLUIDO, 'true')
  renderizarOnboardingAtivo()
}

function fecharOnboardingAtivo() {
  document.getElementById('modal-onboarding-ativo')?.remove()
  navegarPara('dashboard')
  if (typeof inicializarDashboard === 'function') inicializarDashboard()
}

function mostrarMsgOnboarding(texto, tipo = '') {
  const msg = document.getElementById('onboarding-msg')
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo}`
}

function textoDiasOnboarding(dias) {
  const mapa = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sab', 7: 'Dom' }
  return (dias || []).map(dia => mapa[dia]).filter(Boolean).join(', ') || 'não configurado'
}

function dataHojeOnboarding() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

function adicionarDiasOnboarding(dataISO, dias) {
  const data = new Date(`${dataISO}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

// ============================================
// NAVEGAÇÃO ENTRE SEÇÕES
// ============================================
function inicializarNavegacao() {
  const itensNav = document.querySelectorAll('.nav-item')

  itensNav.forEach(item => {
    item.addEventListener('click', () => {
      const secao = item.dataset.secao
      navegarPara(secao)
      fecharSidebar()
    })
  })
}

function inicializarAcaoFlutuante() {
  const botao = document.getElementById('btn-acao-flutuante')
  if (!botao || botao.dataset.inicializado === 'true') return

  botao.dataset.inicializado = 'true'
  botao.addEventListener('click', () => {
    navegarPara('questoes')
    setTimeout(() => {
      document.getElementById('card-acertos')?.nextElementSibling?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  })
}

function navegarPara(secao) {
  let secaoDestino = secaoExiste(secao) ? secao : 'dashboard'
  if (obterModoInterfaceAtual() === 'essencial' && SECOES_INTERFACE_AVANCADA.has(secaoDestino)) {
    secaoDestino = 'dashboard'
  }

  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('ativo'))
  document.querySelectorAll('.secao').forEach(s => s.classList.add('escondido'))
  
  const itemAtivo = document.querySelector(`.nav-item[data-secao="${secaoDestino}"]`)
  if (itemAtivo) {
    itemAtivo.classList.add('ativo')
    atualizarTituloMobile(itemAtivo)
  }
  
  const secaoAtiva = document.getElementById(`secao-${secaoDestino}`)
  if (secaoAtiva) secaoAtiva.classList.remove('escondido')

  localStorage.setItem(CHAVE_SECAO_ATUAL, secaoDestino)

  if (secaoDestino === 'materias') inicializarMaterias()
  if (secaoDestino === 'edital') inicializarEdital()
  if (secaoDestino === 'plano') inicializarPlanoDia()
  if (secaoDestino === 'planejamento') inicializarPlanejamento()
  if (secaoDestino === 'questoes') inicializarQuestoes()
  if (secaoDestino === 'simulados') inicializarSimulados()
  if (secaoDestino === 'desempenho') inicializarDesempenho()
  if (secaoDestino === 'dashboard') inicializarDashboard()
  if (secaoDestino === 'revisao') inicializarRevisao()
  if (secaoDestino === 'estatisticas') inicializarEstatisticas()
  if (secaoDestino === 'perfil') inicializarPerfil()

  verificarAvisoArquivamentoPendente()
}

function atualizarTituloMobile(itemAtivo) {
  const titulo = document.querySelector('.header-titulo')
  if (!titulo || !itemAtivo) return

  const icone = itemAtivo.querySelector('.nav-icone')?.textContent?.trim()
  const texto = itemAtivo.querySelector('.nav-texto')?.textContent?.trim()
  titulo.textContent = [icone, texto].filter(Boolean).join(' ') || 'Estudo Concurso'
}

function obterSecaoInicial() {
  const salva = localStorage.getItem(CHAVE_SECAO_ATUAL)
  return secaoExiste(salva) ? salva : 'dashboard'
}

function secaoExiste(secao) {
  return Boolean(secao && document.getElementById(`secao-${secao}`))
}

function inicializarAjudaContextual() {
  Object.entries(AJUDA_SECOES).forEach(([secao, ajuda]) => {
    const elemento = document.getElementById(`secao-${secao}`)
    if (!elemento || elemento.dataset.ajudaInicializada === 'true') return

    const header = obterOuCriarHeaderAjuda(elemento)
    if (!header) return

    const botao = document.createElement('button')
    botao.className = 'btn-ajuda-secao'
    botao.type = 'button'
    botao.title = `Ajuda: ${ajuda.titulo}`
    botao.setAttribute('aria-label', `Abrir ajuda sobre ${ajuda.titulo}`)
    botao.textContent = '?'
    botao.addEventListener('click', () => abrirAjudaSecao(secao))

    header.appendChild(botao)
    elemento.dataset.ajudaInicializada = 'true'
  })
}

function obterOuCriarHeaderAjuda(secao) {
  let header = secao.querySelector(':scope > .secao-header')

  if (!header) {
    const titulo = secao.querySelector(':scope > h2')
    if (!titulo) return null

    header = document.createElement('div')
    header.className = 'secao-header'
    titulo.classList.add('secao-titulo')
    secao.insertBefore(header, titulo)
    header.appendChild(titulo)
  }

  if (!header.querySelector('.secao-header-texto')) {
    const wrapper = document.createElement('div')
    wrapper.className = 'secao-header-texto'
    Array.from(header.childNodes).forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('btn-ajuda-secao')) return
      wrapper.appendChild(node)
    })
    header.insertBefore(wrapper, header.firstChild)
  }

  header.classList.add('secao-header-com-ajuda')
  return header
}

function abrirAjudaSecao(secao) {
  const ajuda = AJUDA_SECOES[secao]
  if (!ajuda) return

  document.getElementById('modal-ajuda-secao')?.remove()

  const modal = document.createElement('div')
  modal.id = 'modal-ajuda-secao'
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal-caixa modal-caixa-ajuda">
      <div class="modal-topo">
        <div>
          <h3>${escaparHtmlSeguro(ajuda.titulo)}</h3>
          <p class="ajuda-descricao">${escaparHtmlSeguro(ajuda.descricao)}</p>
        </div>
        <button class="modal-fechar" id="btn-fechar-ajuda-secao" type="button">×</button>
      </div>
      <div class="ajuda-lista">
        ${ajuda.itens.map(([titulo, texto]) => `
          <article class="ajuda-item">
            <h4>${escaparHtmlSeguro(titulo)}</h4>
            <p>${escaparHtmlSeguro(texto)}</p>
          </article>
        `).join('')}
      </div>
      <div class="prompt-chatgpt-acoes">
        <button class="btn-secundario" id="btn-cancelar-ajuda-secao" type="button">Fechar</button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove()
  })

  document.getElementById('btn-fechar-ajuda-secao')?.addEventListener('click', () => modal.remove())
  document.getElementById('btn-cancelar-ajuda-secao')?.addEventListener('click', () => modal.remove())
}

async function verificarAvisoArquivamentoPendente() {
  if (!window.usuarioAtual?.id) return

  const token = ++avisoArquivamentoToken

  try {
    const pendente = await buscarArquivamentoPendenteAviso(window.usuarioAtual.id)
    if (token !== avisoArquivamentoToken) return

    if (!pendente) {
      ocultarAvisoArquivamento()
      return
    }

    mostrarAvisoArquivamento(pendente)
  } catch (erro) {
    console.warn('Não foi possível verificar arquivamentos pendentes.', erro)
  }
}

async function buscarArquivamentoPendenteAviso(userId) {
  const hoje = new Date()
  const inicioMesAtual = dataISOApp(new Date(hoje.getFullYear(), hoje.getMonth(), 1))

  const { data, count, error } = await db
    .from('questoes')
    .select('criado_em', { count: 'exact' })
    .eq('user_id', userId)
    .lt('criado_em', `${inicioMesAtual}T00:00:00`)
    .order('criado_em', { ascending: true })
    .limit(1)

  if (error || !count) return null

  const periodo = criarPeriodoAvisoArquivamento(data?.[0]?.criado_em)
  return {
    total: count,
    rotulo: periodo.rotulo
  }
}

function criarPeriodoAvisoArquivamento(criadoEm) {
  const dataBase = criadoEm ? criadoEm.substring(0, 10) : dataISOApp(new Date())
  const [ano, mes] = dataBase.split('-').map(Number)
  const data = new Date(ano, mes - 1, 1)

  return {
    rotulo: data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }
}

function mostrarAvisoArquivamento(pendente) {
  let aviso = document.getElementById('aviso-arquivamento-pendente')
  const palavraQuestoes = pendente.total === 1 ? 'questão' : 'questões'

  if (!aviso) {
    aviso = document.createElement('div')
    aviso.id = 'aviso-arquivamento-pendente'
    aviso.className = 'aviso-arquivamento-pendente'
    document.body.appendChild(aviso)
  }

  aviso.innerHTML = `
    <div class="aviso-arquivamento-texto">
      <strong>Arquivamento mensal pendente</strong>
      <span>${pendente.total} ${palavraQuestoes} de ${escaparHtmlSeguro(pendente.rotulo)} ainda ocupa${pendente.total !== 1 ? 'm' : ''} espaço no Supabase. Gere o PDF e arquive quando puder.</span>
    </div>
    <div class="aviso-arquivamento-acoes">
      <button class="btn-secundario" type="button" data-aviso-arquivamento-ir>Ver arquivamento</button>
      <button class="btn-secundario" type="button" data-aviso-arquivamento-fechar>Depois</button>
    </div>
  `

  aviso.querySelector('[data-aviso-arquivamento-ir]').addEventListener('click', () => {
    ocultarAvisoArquivamento()
    navegarPara('dashboard')
    setTimeout(() => {
      document.getElementById('dashboard-arquivamento')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 250)
  })

  aviso.querySelector('[data-aviso-arquivamento-fechar]').addEventListener('click', ocultarAvisoArquivamento)
}

function ocultarAvisoArquivamento() {
  document.getElementById('aviso-arquivamento-pendente')?.remove()
}

function dataISOApp(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

// ============================================
// TEMA CLARO / ESCURO
// ============================================
function inicializarTema() {
  document.getElementById('btn-tema').addEventListener('click', async () => {
    const temaAtual = document.body.classList.contains('tema-escuro') ? 'escuro' : 'claro'
    const novoTema  = temaAtual === 'claro' ? 'escuro' : 'claro'

    aplicarTema(novoTema)

    await db
      .from('profiles')
      .update({ tema: novoTema })
      .eq('id', window.usuarioAtual.id)
  })
}

function aplicarTema(tema) {
  document.body.classList.remove('tema-claro', 'tema-escuro')
  document.body.classList.add(`tema-${tema}`)

  const icone = document.getElementById('icone-tema')
  const texto = document.getElementById('texto-tema')

  if (tema === 'escuro') {
    icone.textContent = '☀️'
    texto.textContent = 'Tema claro'
  } else {
    icone.textContent = '🌙'
    texto.textContent = 'Tema escuro'
  }
}

// ============================================
// MENU MOBILE
// ============================================
function inicializarMenu() {
  const btnMenu = document.getElementById('btn-menu')
  const overlay = document.getElementById('overlay')

  btnMenu.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar')
    const abriu = sidebar.classList.toggle('aberta')
    overlay.classList.toggle('visivel', abriu)
    btnMenu.setAttribute('aria-expanded', String(abriu))
  })

  overlay.addEventListener('click', fecharSidebar)
}

function fecharSidebar() {
  document.getElementById('sidebar').classList.remove('aberta')
  document.getElementById('overlay').classList.remove('visivel')
  document.getElementById('btn-menu')?.setAttribute('aria-expanded', 'false')
}

// ============================================
// LOGOUT ✅ agora é uma função separada
// ============================================
function inicializarLogout() {
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await db.auth.signOut()
    window.location.href = 'index.html'
  })
}

// ============================================
// PERFIL — ALTERAR SENHA
// ============================================
function inicializarPerfil() {
  const btn = document.getElementById('btn-alterar-senha')
  inicializarBackupPerfil()
  if (typeof carregarConquistasPerfil === 'function') {
    carregarConquistasPerfil()
  }

  // Remove listener anterior para não duplicar
  const btnNovo = btn.cloneNode(true)
  btn.parentNode.replaceChild(btnNovo, btn)

  btnNovo.addEventListener('click', async () => {
    const nova      = document.getElementById('nova-senha').value
    const confirmar = document.getElementById('confirmar-senha').value
    const msg       = document.getElementById('msg-senha')

    msg.textContent = ''
    msg.className   = 'msg-materia'

    if (!nova || !confirmar) {
      msg.textContent = 'Preencha os dois campos.'
      msg.className   = 'msg-materia erro'
      return
    }

    if (nova.length < 6) {
      msg.textContent = 'A senha deve ter no mínimo 6 caracteres.'
      msg.className   = 'msg-materia erro'
      return
    }

    if (nova !== confirmar) {
      msg.textContent = 'As senhas não coincidem.'
      msg.className   = 'msg-materia erro'
      return
    }

    btnNovo.disabled    = true
    btnNovo.textContent = 'Salvando...'

    const { error } = await db.auth.updateUser({ password: nova })

    btnNovo.disabled    = false
    btnNovo.textContent = '💾 Salvar nova senha'

    if (error) {
      msg.textContent = 'Erro ao alterar senha. Tente novamente.'
      msg.className   = 'msg-materia erro'
      return
    }

    msg.textContent = '✅ Senha alterada com sucesso!'
    msg.className   = 'msg-materia sucesso'
    document.getElementById('nova-senha').value      = ''
    document.getElementById('confirmar-senha').value = ''
  })
}

function inicializarBackupPerfil() {
  const btn = document.getElementById('btn-exportar-backup')
  if (!btn || btn.dataset.inicializado === 'true') return

  btn.dataset.inicializado = 'true'
  btn.addEventListener('click', exportarBackup)
}

async function exportarBackup() {
  const btn = document.getElementById('btn-exportar-backup')
  const msg = document.getElementById('msg-backup')

  btn.disabled = true
  btn.textContent = 'Gerando backup...'
  msg.textContent = ''
  msg.className = 'msg-materia'

  try {
    const userId = window.usuarioAtual.id
    const [
      perfil,
      materias,
      editalConfig,
      editalTopicos,
      pegadinhasBanca,
      planejamentoSemanal,
      leiSecaItens,
      configuracoesRevisao,
      sessoes,
      questoes,
      questoesCertas,
      revisoes,
      simulados,
      plano,
      estatisticasMensais,
      badges
    ] = await Promise.all([
      buscarBackupTabela('profiles', 'id', userId),
      buscarBackupTabela('materias', 'user_id', userId),
      buscarBackupTabelaOpcional('edital_config', 'user_id', userId),
      buscarBackupTabelaOpcional('edital_topicos', 'user_id', userId),
      buscarBackupTabelaOpcional('pegadinhas_banca', 'user_id', userId),
      buscarBackupTabelaOpcional('planejamento_semanal', 'user_id', userId),
      buscarBackupTabelaOpcional('lei_seca_itens', 'user_id', userId),
      buscarBackupTabelaOpcional('configuracoes_revisao', 'user_id', userId),
      buscarBackupTabela('sessoes_estudo', 'user_id', userId),
      buscarBackupTabela('questoes', 'user_id', userId),
      buscarBackupTabela('questoes_certas', 'user_id', userId),
      buscarBackupTabela('questoes_revisoes', 'user_id', userId),
      buscarBackupTabela('simulados', 'user_id', userId),
      buscarBackupTabela('plano_dia_materias', 'user_id', userId),
      buscarBackupTabelaOpcional('estatisticas_mensais', 'user_id', userId),
      buscarBackupTabelaOpcional('user_badges', 'user_id', userId)
    ])

    const backup = {
      app: 'estudo-concurso',
      versao_backup: 1,
      exportado_em: new Date().toISOString(),
      user_id: userId,
      dados: {
        profiles: perfil,
        materias,
        edital_config: editalConfig,
        edital_topicos: editalTopicos,
        pegadinhas_banca: pegadinhasBanca,
        planejamento_semanal: planejamentoSemanal,
        lei_seca_itens: leiSecaItens,
        configuracoes_revisao: configuracoesRevisao,
        sessoes_estudo: sessoes,
        questoes,
        questoes_certas: questoesCertas,
        questoes_revisoes: revisoes,
        simulados,
        plano_dia_materias: plano,
        estatisticas_mensais: estatisticasMensais,
        user_badges: badges
      }
    }

    baixarJsonBackup(backup)
    msg.textContent = 'Backup exportado com sucesso.'
    msg.className = 'msg-materia sucesso'
  } catch (erro) {
    console.error(erro)
    msg.textContent = 'Erro ao exportar backup. Tente novamente.'
    msg.className = 'msg-materia erro'
  } finally {
    btn.disabled = false
    btn.textContent = 'Exportar backup'
  }
}

async function buscarBackupTabela(tabela, colunaUsuario, userId) {
  const tamanhoPagina = 1000
  let inicio = 0
  let todos = []

  while (true) {
    const { data, error } = await db
      .from(tabela)
      .select('*')
      .eq(colunaUsuario, userId)
      .range(inicio, inicio + tamanhoPagina - 1)

    if (error) throw error

    const pagina = data || []
    todos = todos.concat(pagina)

    if (pagina.length < tamanhoPagina) break
    inicio += tamanhoPagina
  }

  return todos
}

async function buscarBackupTabelaOpcional(tabela, colunaUsuario, userId) {
  try {
    return await buscarBackupTabela(tabela, colunaUsuario, userId)
  } catch (erro) {
    console.warn(`Tabela opcional ${tabela} não foi incluída no backup.`, erro)
    return []
  }
}

function baixarJsonBackup(backup) {
  const data = new Date()
  const dataNome = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `estudo-concurso-backup-${dataNome}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// ============================================
// INICIA TUDO
// ============================================
inicializar()
