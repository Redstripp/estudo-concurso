// js/estado.js
// Módulo centralizado para gerenciamento de estado da aplicação
// Elimina variáveis globais soltas e previne bugs difíceis de rastrear

const Estado = {
  // Estado do módulo questoes.js
  questoes: {
    alternativaMarcada: null,
    alternativaCorreta: null,
    numAlternativas: 2,
    tipoQuestaoAtual: 'Errada',
    modoRegistroQuestao: 'rapido',
    inicializado: false,
    filtroCadernoErrosAtual: 'todos',
    questoesEmMemoria: [],
    timeoutBusca: null
  },

  // Estado do módulo revisao.js
  revisao: {
    inicializado: false,
    treinoRevisaoQuestoes: [],
    treinoRevisaoIndice: 0,
    treinoRevisaoAcertos: 0,
    treinoRevisaoErros: 0,
    treinoRevisaoRespostaSelecionada: null,
    treinoRevisaoPreResposta: '',
    treinoRevisaoChecklist: { comando: false, pegadinha: false, tipo: false },
    filaRevisaoInteligenteAtual: [],
    filaRevisaoCompletaAtual: [],
    treinoRevisaoConfianca: '',
    treinoRevisaoResultados: [],
    modoFocoAtivo: false,
    treinoPegadinhasQuestoes: [],
    treinoPegadinhasIndice: 0,
    treinoPegadinhasRevelada: false,
    configuracaoAtual: null
  },

  // Estado do módulo edital.js
  edital: {
    inicializado: false,
    estado: {}
  },

  // Estado do módulo estatisticas.js
  estatisticas: {
    inicializado: false,
    periodoAtual: 'geral',
    periodoPersonalizado: null,
    metaMinima: 30,
    metaMaxima: 30
  },

  // Estado do módulo materias.js
  materias: {
    inicializado: false
  },

  // Estado do módulo planejamento.js
  planejamento: {
    inicializado: false,
    estado: {}
  },

  // Estado do módulo plano.js
  plano: {
    inicializado: false,
    materiasPlanoCache: [],
    metaCentralPlano: 30
  },

  // Estado do módulo desempenho.js (sessoes.js)
  desempenho: {
    inicializado: false
  },

  // Estado do módulo simulados.js
  simulados: {
    inicializado: false
  },

  // Estado do módulo app.js
  app: {
    avisoArquivamentoToken: 0,
    onboardingAtivoEstado: null,
    logoutPendente: null
  }
}

// Funções utilitárias para manipulação segura do estado
Estado.get = function(modulo, chave, valorPadrao = null) {
  if (!this[modulo]) {
    console.warn(`Módulo '${modulo}' não existe no Estado`)
    return valorPadrao
  }
  
  if (chave === undefined) {
    return this[modulo]
  }
  
  return this[modulo][chave] !== undefined ? this[modulo][chave] : valorPadrao
}

Estado.set = function(modulo, chave, valor) {
  if (!this[modulo]) {
    console.error(`Módulo '${modulo}' não existe no Estado`)
    return false
  }
  
  if (chave === undefined) {
    console.error('Chave deve ser especificada')
    return false
  }
  
  this[modulo][chave] = valor
  return true
}

Estado.reset = function(modulo) {
  if (!this[modulo]) {
    console.error(`Módulo '${modulo}' não existe no Estado`)
    return false
  }
  
  // Reseta para valores padrão definidos no objeto Estado original
  const valoresPadrao = {
    questoes: {
      alternativaMarcada: null,
      alternativaCorreta: null,
      numAlternativas: 2,
      tipoQuestaoAtual: 'Errada',
      modoRegistroQuestao: 'rapido',
      inicializado: false,
      filtroCadernoErrosAtual: 'todos',
      questoesEmMemoria: [],
      timeoutBusca: null
    },
    revisao: {
      inicializado: false,
      treinoRevisaoQuestoes: [],
      treinoRevisaoIndice: 0,
      treinoRevisaoAcertos: 0,
      treinoRevisaoErros: 0,
      treinoRevisaoRespostaSelecionada: null,
      treinoRevisaoPreResposta: '',
      treinoRevisaoChecklist: { comando: false, pegadinha: false, tipo: false },
      filaRevisaoInteligenteAtual: [],
      filaRevisaoCompletaAtual: [],
      treinoRevisaoConfianca: '',
      treinoRevisaoResultados: [],
      modoFocoAtivo: false,
      treinoPegadinhasQuestoes: [],
      treinoPegadinhasIndice: 0,
      treinoPegadinhasRevelada: false,
      configuracaoAtual: null
    },
    edital: {
      inicializado: false,
      estado: {}
    },
    estatisticas: {
      inicializado: false,
      periodoAtual: 'geral',
      periodoPersonalizado: null,
      metaMinima: 30,
      metaMaxima: 30
    },
    materias: {
      inicializado: false
    },
    planejamento: {
      inicializado: false,
      estado: {}
    },
    plano: {
      inicializado: false,
      materiasPlanoCache: [],
      metaCentralPlano: 30
    },
    desempenho: {
      inicializado: false
    },
    simulados: {
      inicializado: false
    },
    app: {
      avisoArquivamentoToken: 0,
      onboardingAtivoEstado: null,
      logoutPendente: null
    }
  }
  
  // Restaura valores padrão do módulo
  if (valoresPadrao[modulo]) {
    for (const chave in valoresPadrao[modulo]) {
      this[modulo][chave] = JSON.parse(JSON.stringify(valoresPadrao[modulo][chave]))
    }
  }
  
  return true
}

Estado.resetAll = function() {
  for (const modulo in this) {
    if (typeof this[modulo] === 'object' && !Array.isArray(this[modulo]) && 
        modulo !== 'resetAll' && modulo !== 'get' && modulo !== 'set' && modulo !== 'reset') {
      this.reset(modulo)
    }
  }
}

// Exportações para testes (Vitest) e navegador
if (typeof window !== 'undefined') {
  // Ambiente navegador
  window.Estado = Estado
}

// Também exporta como default para ES modules
export default Estado
