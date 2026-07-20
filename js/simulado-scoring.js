// js/simulado-scoring.js
// Motor puro para pontuacao configuravel de simulados.

const SIMULADO_SCORING_PROFILE_LEGACY_SIMPLE = {
  id: 'legacy_simple',
  nome: 'Padrao atual',
  descricao: 'Replica o comportamento historico: nota percentual = certas / total.',
  ativo: true,
  versao: 1,
  modo: 'simple',
  valores: {
    correta: 1,
    errada: 0,
    branca: 0,
    anulada: 0
  },
  anuladas: {
    tratamento: 'zero',
    valorEspecifico: 0
  },
  arredondamento: {
    modo: 'matematico',
    casasDecimais: 2,
    etapa: 'final'
  },
  notaMaxima: null,
  pesos: {
    padrao: 1,
    questoes: {},
    disciplinas: {},
    blocos: {},
    tipos: {}
  },
  blocos: [],
  minimos: {
    notaTotal: null,
    percentualTotal: null,
    acertos: null,
    maxErros: null,
    blocos: {},
    disciplinas: {}
  },
  eliminacao: {
    notaNegativa: false,
    maxErros: null,
    blocos: {},
    disciplinas: {}
  },
  metadados: {
    sistema: true,
    retrocompatibilidade: true
  }
}

const MODOS_PONTUACAO_SIMULADO = ['simple', 'negative_marking', 'weighted', 'hybrid']
const TRATAMENTOS_ANULADA_SIMULADO = ['grant_correct', 'exclude', 'zero', 'specific']
const MODOS_ARREDONDAMENTO_SIMULADO = ['none', 'matematico', 'truncar', 'cima']

function clonarPontuacaoSimulado(valor) {
  return JSON.parse(JSON.stringify(valor))
}

function numeroPontuacaoSimulado(valor, fallback = 0) {
  if (valor === null || valor === undefined || valor === '') return fallback
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : fallback
}

function numeroOpcionalPontuacaoSimulado(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

function normalizarPrecisaoPontuacaoSimulado(valor, casasDecimais = 10) {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return 0
  const casas = Math.max(0, Math.trunc(numeroPontuacaoSimulado(casasDecimais, 10)))
  const fator = 10 ** casas
  const normalizado = Math.round((numero + Number.EPSILON) * fator) / fator
  return Object.is(normalizado, -0) ? 0 : normalizado
}

function normalizarIdPontuacaoSimulado(valor) {
  return String(valor ?? '').trim()
}

function criarPerfilPontuacaoLegadoSimulado() {
  return clonarPontuacaoSimulado(SIMULADO_SCORING_PROFILE_LEGACY_SIMPLE)
}

function normalizarPerfilPontuacaoSimulado(perfil = {}) {
  const base = criarPerfilPontuacaoLegadoSimulado()
  const normalizado = {
    ...base,
    ...clonarPontuacaoSimulado(perfil || {}),
    valores: {
      ...base.valores,
      ...(perfil?.valores || {})
    },
    anuladas: {
      ...base.anuladas,
      ...(perfil?.anuladas || {})
    },
    arredondamento: {
      ...base.arredondamento,
      ...(perfil?.arredondamento || {})
    },
    pesos: {
      ...base.pesos,
      ...(perfil?.pesos || {}),
      questoes: { ...(base.pesos.questoes || {}), ...(perfil?.pesos?.questoes || {}) },
      disciplinas: { ...(base.pesos.disciplinas || {}), ...(perfil?.pesos?.disciplinas || {}) },
      blocos: { ...(base.pesos.blocos || {}), ...(perfil?.pesos?.blocos || {}) },
      tipos: { ...(base.pesos.tipos || {}), ...(perfil?.pesos?.tipos || {}) }
    },
    minimos: {
      ...base.minimos,
      ...(perfil?.minimos || {}),
      blocos: { ...(base.minimos.blocos || {}), ...(perfil?.minimos?.blocos || {}) },
      disciplinas: { ...(base.minimos.disciplinas || {}), ...(perfil?.minimos?.disciplinas || {}) }
    },
    eliminacao: {
      ...base.eliminacao,
      ...(perfil?.eliminacao || {}),
      blocos: { ...(base.eliminacao.blocos || {}), ...(perfil?.eliminacao?.blocos || {}) },
      disciplinas: { ...(base.eliminacao.disciplinas || {}), ...(perfil?.eliminacao?.disciplinas || {}) }
    },
    metadados: {
      ...base.metadados,
      ...(perfil?.metadados || {})
    }
  }

  normalizado.id = normalizarIdPontuacaoSimulado(normalizado.id) || 'perfil_local'
  normalizado.nome = normalizarIdPontuacaoSimulado(normalizado.nome) || 'Perfil de pontuacao'
  normalizado.descricao = String(normalizado.descricao || '')
  normalizado.versao = Math.max(1, Math.trunc(numeroPontuacaoSimulado(normalizado.versao, 1)))
  normalizado.ativo = normalizado.ativo !== false
  normalizado.modo = MODOS_PONTUACAO_SIMULADO.includes(normalizado.modo) ? normalizado.modo : 'simple'
  normalizado.valores.correta = numeroPontuacaoSimulado(normalizado.valores.correta, 1)
  normalizado.valores.errada = numeroPontuacaoSimulado(normalizado.valores.errada, 0)
  normalizado.valores.branca = numeroPontuacaoSimulado(normalizado.valores.branca, 0)
  normalizado.valores.anulada = numeroPontuacaoSimulado(normalizado.valores.anulada, 0)
  normalizado.anuladas.tratamento = TRATAMENTOS_ANULADA_SIMULADO.includes(normalizado.anuladas.tratamento)
    ? normalizado.anuladas.tratamento
    : 'zero'
  normalizado.anuladas.valorEspecifico = numeroPontuacaoSimulado(normalizado.anuladas.valorEspecifico, 0)
  normalizado.arredondamento.modo = MODOS_ARREDONDAMENTO_SIMULADO.includes(normalizado.arredondamento.modo)
    ? normalizado.arredondamento.modo
    : 'matematico'
  normalizado.arredondamento.casasDecimais = Math.max(0, Math.trunc(numeroPontuacaoSimulado(normalizado.arredondamento.casasDecimais, 2)))
  normalizado.arredondamento.etapa = ['questao', 'bloco', 'final'].includes(normalizado.arredondamento.etapa)
    ? normalizado.arredondamento.etapa
    : 'final'
  normalizado.notaMaxima = numeroOpcionalPontuacaoSimulado(normalizado.notaMaxima)
  normalizado.pesos.padrao = numeroPontuacaoSimulado(normalizado.pesos.padrao, 1)
  normalizado.blocos = Array.isArray(normalizado.blocos) ? normalizado.blocos.map(bloco => ({
    id: normalizarIdPontuacaoSimulado(bloco.id || bloco.codigo || bloco.nome),
    nome: normalizarIdPontuacaoSimulado(bloco.nome || bloco.id || bloco.codigo),
    peso: numeroOpcionalPontuacaoSimulado(bloco.peso),
    notaMinima: numeroOpcionalPontuacaoSimulado(bloco.notaMinima),
    percentualMinimo: numeroOpcionalPontuacaoSimulado(bloco.percentualMinimo),
    disciplinas: Array.isArray(bloco.disciplinas)
      ? bloco.disciplinas.map(normalizarIdPontuacaoSimulado).filter(Boolean)
      : [],
    questoes: Array.isArray(bloco.questoes)
      ? bloco.questoes.map(normalizarIdPontuacaoSimulado).filter(Boolean)
      : []
  })).filter(bloco => bloco.id) : []

  normalizado.blocos.forEach(bloco => {
    if (bloco.peso !== null) normalizado.pesos.blocos[bloco.id] = bloco.peso
    if (bloco.notaMinima !== null || bloco.percentualMinimo !== null) {
      normalizado.minimos.blocos[bloco.id] = {
        ...(normalizado.minimos.blocos[bloco.id] || {}),
        nota: bloco.notaMinima,
        percentual: bloco.percentualMinimo
      }
    }
  })

  return normalizado
}

function validarPerfilPontuacaoSimulado(perfil = {}) {
  const p = normalizarPerfilPontuacaoSimulado(perfil)
  const erros = []

  if (!p.nome) erros.push('Informe um nome para o perfil.')
  if (!MODOS_PONTUACAO_SIMULADO.includes(p.modo)) erros.push('Escolha um modo de calculo valido.')
  if (p.versao < 1) erros.push('A versao do perfil deve ser maior que zero.')
  if (p.arredondamento.casasDecimais < 0) erros.push('Casas decimais nao pode ser negativo.')
  if (p.valores.correta < 0) erros.push('Valor da correta nao pode ser negativo.')
  if (!Number.isFinite(p.valores.correta) || !Number.isFinite(p.valores.errada) || !Number.isFinite(p.valores.branca)) {
    erros.push('Valores de correta, errada e branca precisam ser numericos.')
  }
  if (p.anuladas.tratamento === 'specific' && !Number.isFinite(Number(perfil?.anuladas?.valorEspecifico ?? p.anuladas.valorEspecifico))) {
    erros.push('Valor especifico de anulada precisa ser numerico.')
  }
  if (p.notaMaxima !== null && p.notaMaxima < 0) erros.push('Nota maxima nao pode ser negativa.')
  if (p.notaMaxima !== null && p.minimos.notaTotal !== null && p.minimos.notaTotal !== undefined && Number(p.minimos.notaTotal) > p.notaMaxima) {
    erros.push('Nota minima total nao pode ser maior que a nota maxima.')
  }
  if (p.minimos.percentualTotal !== null && p.minimos.percentualTotal !== undefined && Number(p.minimos.percentualTotal) > 100) {
    erros.push('Percentual minimo total nao pode ser maior que 100%.')
  }
  if (!TRATAMENTOS_ANULADA_SIMULADO.includes(p.anuladas.tratamento)) erros.push('Defina o tratamento de questoes anuladas.')

  const pesos = [
    p.pesos.padrao,
    ...Object.values(p.pesos.questoes || {}),
    ...Object.values(p.pesos.disciplinas || {}),
    ...Object.values(p.pesos.blocos || {}),
    ...Object.values(p.pesos.tipos || {})
  ]
  if (pesos.some(valor => !Number.isFinite(Number(valor)))) erros.push('Todos os pesos precisam ser numericos.')
  if (pesos.some(valor => Number(valor) < 0)) erros.push('Pesos nao podem ser negativos.')

  const idsBlocos = new Set()
  p.blocos.forEach(bloco => {
    if (idsBlocos.has(bloco.id)) erros.push(`O bloco "${bloco.id}" esta duplicado.`)
    idsBlocos.add(bloco.id)
  })
  const questoesPorBloco = new Map()
  p.blocos.forEach(bloco => {
    ;(bloco.questoes || []).forEach(questaoId => {
      if (questoesPorBloco.has(questaoId)) {
        erros.push(`A questao "${questaoId}" esta em mais de um bloco.`)
      }
      questoesPorBloco.set(questaoId, bloco.id)
    })
  })

  const criteriosNumericos = [
    ['nota minima total', p.minimos.notaTotal],
    ['percentual minimo total', p.minimos.percentualTotal],
    ['minimo de acertos', p.minimos.acertos],
    ['maximo de erros', p.minimos.maxErros],
    ['maximo de erros eliminatorio', p.eliminacao.maxErros]
  ]
  criteriosNumericos.forEach(([nome, valor]) => {
    if (valor !== null && valor !== undefined && (!Number.isFinite(Number(valor)) || Number(valor) < 0)) {
      erros.push(`O criterio "${nome}" deve ser um numero positivo.`)
    }
  })

  if (p.modo === 'negative_marking' && p.valores.errada >= 0) {
    erros.push('No modo com penalizacao, o valor da errada deve ser negativo.')
  }

  return {
    ok: erros.length === 0,
    erros,
    perfil: p
  }
}

function arredondarValorPontuacaoSimulado(valor, arredondamento = {}) {
  const modo = arredondamento.modo || 'none'
  const casas = Math.max(0, Math.trunc(numeroPontuacaoSimulado(arredondamento.casasDecimais, 2)))
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return 0
  if (modo === 'none') return normalizarPrecisaoPontuacaoSimulado(numero)
  const fator = 10 ** casas
  if (modo === 'truncar') return normalizarPrecisaoPontuacaoSimulado(Math.trunc(numero * fator) / fator)
  if (modo === 'cima') return normalizarPrecisaoPontuacaoSimulado(Math.ceil(numero * fator) / fator)
  return normalizarPrecisaoPontuacaoSimulado(Math.round((numero + Number.EPSILON) * fator) / fator)
}

function obterMapaRespostasPontuacaoSimulado(respostas = []) {
  const mapa = new Map()
  ;(respostas || []).forEach(resposta => {
    const id = normalizarIdPontuacaoSimulado(resposta.questao_id || resposta.questaoId || resposta.id)
    if (id && !mapa.has(id)) mapa.set(id, resposta)
  })
  return mapa
}

function obterGabaritoQuestaoPontuacaoSimulado(questao = {}, gabarito = {}) {
  const id = normalizarIdPontuacaoSimulado(questao.id || questao.questao_id || questao.questaoId)
  if (Object.prototype.hasOwnProperty.call(gabarito || {}, id)) return gabarito[id]
  return questao.gabarito ?? questao.alternativa_correta ?? questao.resposta_correta ?? null
}

function normalizarRespostaPontuacaoSimulado(valor) {
  return String(valor ?? '').trim().toUpperCase()
}

function obterRespostaMarcadaPontuacaoSimulado(resposta = {}) {
  return resposta?.resposta_marcada ?? resposta?.resposta ?? resposta?.answer ?? resposta?.marcada ?? ''
}

function obterIdQuestaoPontuacaoSimulado(questao = {}, indice = 0) {
  return normalizarIdPontuacaoSimulado(questao.id || questao.questao_id || questao.questaoId || `q${indice + 1}`)
}

function obterIdRespostaPontuacaoSimulado(resposta = {}) {
  return normalizarIdPontuacaoSimulado(resposta.questao_id || resposta.questaoId || resposta.id)
}

function respostaExisteNasAlternativasPontuacaoSimulado(questao = {}, resposta = {}) {
  const marcada = obterRespostaMarcadaPontuacaoSimulado(resposta)
  if (marcada === null || marcada === undefined || String(marcada).trim() === '') return true

  const alternativas = questao.alternativas
  if (!alternativas) return true

  const marcadaNormalizada = normalizarRespostaPontuacaoSimulado(marcada)
  if (Array.isArray(alternativas)) {
    const letras = alternativas.map((_, indice) => String.fromCharCode(65 + indice))
    const valores = alternativas.map(normalizarRespostaPontuacaoSimulado)
    return letras.includes(marcadaNormalizada) || valores.includes(marcadaNormalizada)
  }

  if (typeof alternativas === 'object') {
    return Object.keys(alternativas).map(normalizarRespostaPontuacaoSimulado).includes(marcadaNormalizada)
  }

  return true
}

function validarEntradasPontuacaoSimulado(questoes = [], respostas = []) {
  const erros = []
  const questoesNormalizadas = []
  const questoesPorId = new Map()

  ;(Array.isArray(questoes) ? questoes : []).forEach((questao, indice) => {
    const id = obterIdQuestaoPontuacaoSimulado(questao, indice)
    if (questoesPorId.has(id)) erros.push(`Questao duplicada: ${id}.`)
    const normalizada = { ...questao, id }
    questoesPorId.set(id, normalizada)
    questoesNormalizadas.push(normalizada)
  })

  const respostasPorId = new Map()
  ;(Array.isArray(respostas) ? respostas : []).forEach(resposta => {
    const id = obterIdRespostaPontuacaoSimulado(resposta)
    if (!id) {
      erros.push('Resposta sem questao associada.')
      return
    }
    if (respostasPorId.has(id)) erros.push(`Resposta duplicada para a questao: ${id}.`)
    respostasPorId.set(id, resposta)
    if (!questoesPorId.has(id)) {
      erros.push(`Resposta referencia questao ausente: ${id}.`)
      return
    }
    if (!respostaExisteNasAlternativasPontuacaoSimulado(questoesPorId.get(id), resposta)) {
      erros.push(`Resposta invalida para a questao: ${id}.`)
    }
  })

  return {
    ok: erros.length === 0,
    erros,
    questoes: questoesNormalizadas,
    respostas: respostasPorId
  }
}

function obterBlocoQuestaoPontuacaoSimulado(questao = {}, perfil = {}) {
  const id = normalizarIdPontuacaoSimulado(questao.id || questao.questao_id || questao.questaoId)
  const blocoDireto = normalizarIdPontuacaoSimulado(questao.bloco_id || questao.blocoId || questao.bloco)
  if (blocoDireto) return blocoDireto
  const materia = normalizarIdPontuacaoSimulado(questao.materia_id || questao.disciplina_id || questao.disciplina)
  const blocoPorQuestao = (perfil.blocos || []).find(bloco => Array.isArray(bloco.questoes) && bloco.questoes.includes(id))
  if (blocoPorQuestao) return blocoPorQuestao.id
  const blocoPorMateria = (perfil.blocos || []).find(bloco => Array.isArray(bloco.disciplinas) && bloco.disciplinas.includes(materia))
  return blocoPorMateria?.id || ''
}

function obterPesoQuestaoPontuacaoSimulado(questao = {}, perfil = {}) {
  const id = normalizarIdPontuacaoSimulado(questao.id || questao.questao_id || questao.questaoId)
  const disciplina = normalizarIdPontuacaoSimulado(questao.materia_id || questao.disciplina_id || questao.disciplina)
  const bloco = obterBlocoQuestaoPontuacaoSimulado(questao, perfil)
  const tipo = normalizarIdPontuacaoSimulado(questao.tipo_questao || questao.tipo)
  const pesos = perfil.pesos || {}

  if (id && Object.prototype.hasOwnProperty.call(pesos.questoes || {}, id)) return numeroPontuacaoSimulado(pesos.questoes[id], 1)
  if (disciplina && Object.prototype.hasOwnProperty.call(pesos.disciplinas || {}, disciplina)) return numeroPontuacaoSimulado(pesos.disciplinas[disciplina], 1)
  if (bloco && Object.prototype.hasOwnProperty.call(pesos.blocos || {}, bloco)) return numeroPontuacaoSimulado(pesos.blocos[bloco], 1)
  if (tipo && Object.prototype.hasOwnProperty.call(pesos.tipos || {}, tipo)) return numeroPontuacaoSimulado(pesos.tipos[tipo], 1)
  return numeroPontuacaoSimulado(pesos.padrao, 1)
}

function classificarQuestaoPontuacaoSimulado(questao = {}, resposta = {}, gabarito = {}) {
  if (questao.anulada || questao.status === 'anulada' || resposta?.status === 'anulada') return 'anulada'

  const gabaritoQuestao = obterGabaritoQuestaoPontuacaoSimulado(questao, gabarito)
  if (gabaritoQuestao === null || gabaritoQuestao === undefined || gabaritoQuestao === '') return 'sem_gabarito'

  const marcada = obterRespostaMarcadaPontuacaoSimulado(resposta)
  if (marcada === null || marcada === undefined || String(marcada).trim() === '') return 'branca'
  return normalizarRespostaPontuacaoSimulado(marcada) === normalizarRespostaPontuacaoSimulado(gabaritoQuestao)
    ? 'correta'
    : 'errada'
}

function obterValorBasePontuacaoSimulado(status, perfil) {
  if (status === 'correta') return perfil.valores.correta
  if (status === 'errada') return perfil.valores.errada
  if (status === 'branca') return perfil.valores.branca
  if (status === 'sem_gabarito') return perfil.valores.branca
  if (status === 'anulada') {
    if (perfil.anuladas.tratamento === 'grant_correct') return perfil.valores.correta
    if (perfil.anuladas.tratamento === 'specific') return perfil.anuladas.valorEspecifico
    return 0
  }
  return 0
}

function questaoEntraDenominadorPontuacaoSimulado(status, perfil) {
  if (status === 'anulada' && perfil.anuladas.tratamento === 'exclude') return false
  if (status === 'sem_gabarito') return false
  return true
}

function criarAcumuladorPontuacaoSimulado(id = 'total', nome = 'Total') {
  return {
    id,
    nome,
    totalQuestoes: 0,
    respondidas: 0,
    corretas: 0,
    erradas: 0,
    brancas: 0,
    anuladas: 0,
    semGabarito: 0,
    denominadorQuestoes: 0,
    questoesExcluidas: 0,
    pontosPositivos: 0,
    penalidades: 0,
    notaBruta: 0,
    notaMaxima: 0,
    percentual: 0
  }
}

function somarQuestaoAcumuladorPontuacaoSimulado(acumulador, detalhe, status) {
  acumulador.totalQuestoes += 1
  if (detalhe.entraDenominador) acumulador.denominadorQuestoes += 1
  else acumulador.questoesExcluidas += 1
  if (status !== 'branca' && status !== 'sem_gabarito') acumulador.respondidas += 1
  if (status === 'correta') acumulador.corretas += 1
  if (status === 'errada') acumulador.erradas += 1
  if (status === 'branca') acumulador.brancas += 1
  if (status === 'anulada') acumulador.anuladas += 1
  if (status === 'sem_gabarito') acumulador.semGabarito += 1
  if (detalhe.pontos >= 0) acumulador.pontosPositivos += detalhe.pontos
  else acumulador.penalidades += detalhe.pontos
  acumulador.notaBruta = normalizarPrecisaoPontuacaoSimulado(acumulador.notaBruta + detalhe.pontos)
  acumulador.notaMaxima = normalizarPrecisaoPontuacaoSimulado(acumulador.notaMaxima + detalhe.valorMaximo)
}

function finalizarAcumuladorPontuacaoSimulado(acumulador, arredondamento) {
  acumulador.percentual = acumulador.notaMaxima > 0
    ? arredondarValorPontuacaoSimulado((acumulador.notaBruta / acumulador.notaMaxima) * 100, { modo: 'matematico', casasDecimais: 2 })
    : 0
  if (arredondamento?.etapa === 'bloco') {
    acumulador.notaBruta = arredondarValorPontuacaoSimulado(acumulador.notaBruta, arredondamento)
  } else {
    acumulador.notaBruta = normalizarPrecisaoPontuacaoSimulado(acumulador.notaBruta)
  }
  acumulador.pontosPositivos = arredondarValorPontuacaoSimulado(acumulador.pontosPositivos, { modo: 'matematico', casasDecimais: 6 })
  acumulador.penalidades = arredondarValorPontuacaoSimulado(acumulador.penalidades, { modo: 'matematico', casasDecimais: 6 })
  acumulador.notaMaxima = normalizarPrecisaoPontuacaoSimulado(acumulador.notaMaxima)
  return acumulador
}

function avaliarCriteriosPontuacaoSimulado(resultado, perfil) {
  const avaliados = []
  const eliminacoes = []
  const reprovacoes = []

  const adicionar = (tipo, id, aprovado, valor, minimo, mensagem, eliminatorio = false) => {
    const item = { tipo, id, aprovado, valor, minimo, mensagem, eliminatorio }
    avaliados.push(item)
    if (!aprovado && eliminatorio) eliminacoes.push(mensagem)
    else if (!aprovado) reprovacoes.push(mensagem)
  }

  const min = perfil.minimos || {}
  const elim = perfil.eliminacao || {}

  if (min.notaTotal !== null && min.notaTotal !== undefined) {
    adicionar('nota_total', 'total', resultado.notaFinal >= Number(min.notaTotal), resultado.notaFinal, Number(min.notaTotal), `Nota final menor que ${min.notaTotal}.`)
  }
  if (min.percentualTotal !== null && min.percentualTotal !== undefined) {
    adicionar('percentual_total', 'total', resultado.percentual >= Number(min.percentualTotal), resultado.percentual, Number(min.percentualTotal), `Percentual menor que ${min.percentualTotal}%.`)
  }
  if (min.acertos !== null && min.acertos !== undefined) {
    adicionar('acertos', 'total', resultado.contagens.corretas >= Number(min.acertos), resultado.contagens.corretas, Number(min.acertos), `Acertos abaixo de ${min.acertos}.`)
  }
  if (min.maxErros !== null && min.maxErros !== undefined) {
    adicionar('max_erros', 'total', resultado.contagens.erradas <= Number(min.maxErros), resultado.contagens.erradas, Number(min.maxErros), `Erros acima de ${min.maxErros}.`)
  }
  if (elim.notaNegativa) {
    adicionar('nota_negativa', 'total', resultado.notaFinal >= 0, resultado.notaFinal, 0, 'Nota final negativa.', true)
  }
  if (elim.maxErros !== null && elim.maxErros !== undefined) {
    adicionar('max_erros_eliminatorio', 'total', resultado.contagens.erradas <= Number(elim.maxErros), resultado.contagens.erradas, Number(elim.maxErros), `Erros acima do limite eliminatorio de ${elim.maxErros}.`, true)
  }

  Object.entries(min.blocos || {}).forEach(([blocoId, regra]) => {
    const bloco = resultado.blocos.find(item => item.id === blocoId)
    if (!bloco) return
    if (regra?.nota !== null && regra?.nota !== undefined) {
      adicionar('nota_bloco', blocoId, bloco.notaBruta >= Number(regra.nota), bloco.notaBruta, Number(regra.nota), `Bloco ${bloco.nome || blocoId} abaixo da nota minima.`)
    }
    if (regra?.percentual !== null && regra?.percentual !== undefined) {
      adicionar('percentual_bloco', blocoId, bloco.percentual >= Number(regra.percentual), bloco.percentual, Number(regra.percentual), `Bloco ${bloco.nome || blocoId} abaixo do percentual minimo.`)
    }
  })

  Object.entries(elim.blocos || {}).forEach(([blocoId, regra]) => {
    const bloco = resultado.blocos.find(item => item.id === blocoId)
    if (!bloco) return
    if (regra?.percentual !== null && regra?.percentual !== undefined) {
      adicionar('percentual_bloco_eliminatorio', blocoId, bloco.percentual >= Number(regra.percentual), bloco.percentual, Number(regra.percentual), `Bloco ${bloco.nome || blocoId} abaixo do minimo eliminatorio.`, true)
    }
  })

  Object.entries(min.disciplinas || {}).forEach(([disciplinaId, regra]) => {
    const disciplina = resultado.disciplinas.find(item => item.id === disciplinaId)
    if (!disciplina) return
    const notaMinima = regra?.nota ?? regra?.notaMinima
    const percentualMinimo = regra?.percentual ?? regra?.percentualMinimo
    if (notaMinima !== null && notaMinima !== undefined) {
      adicionar('nota_disciplina', disciplinaId, disciplina.notaBruta >= Number(notaMinima), disciplina.notaBruta, Number(notaMinima), `Disciplina ${disciplina.nome || disciplinaId} abaixo da nota minima.`)
    }
    if (percentualMinimo !== null && percentualMinimo !== undefined) {
      adicionar('percentual_disciplina', disciplinaId, disciplina.percentual >= Number(percentualMinimo), disciplina.percentual, Number(percentualMinimo), `Disciplina ${disciplina.nome || disciplinaId} abaixo do percentual minimo.`)
    }
  })

  Object.entries(elim.disciplinas || {}).forEach(([disciplinaId, regra]) => {
    const disciplina = resultado.disciplinas.find(item => item.id === disciplinaId)
    if (!disciplina) return
    const percentualMinimo = regra?.percentual ?? regra?.percentualMinimo
    if (percentualMinimo !== null && percentualMinimo !== undefined) {
      adicionar('percentual_disciplina_eliminatorio', disciplinaId, disciplina.percentual >= Number(percentualMinimo), disciplina.percentual, Number(percentualMinimo), `Disciplina ${disciplina.nome || disciplinaId} abaixo do minimo eliminatorio.`, true)
    }
  })

  let status = 'aprovado'
  if (eliminacoes.length > 0) status = 'eliminado'
  else if (reprovacoes.length > 0) status = 'reprovado'

  return {
    status,
    aprovado: status === 'aprovado',
    eliminado: status === 'eliminado',
    motivos: [...eliminacoes, ...reprovacoes],
    criterios: avaliados
  }
}

function criarSnapshotPontuacaoSimulado(resultado, perfil) {
  return {
    tipo: 'simulado_scoring_snapshot',
    perfil: {
      id: perfil.id,
      nome: perfil.nome,
      versao: perfil.versao,
      modo: perfil.modo,
      regras: clonarPontuacaoSimulado(perfil)
    },
    contagens: resultado.contagens,
    valores: {
      notaBruta: resultado.notaBruta,
      notaFinal: resultado.notaFinal,
      notaMaxima: resultado.notaMaxima,
      percentual: resultado.percentual,
      pontosPositivos: resultado.pontosPositivos,
      penalidades: resultado.penalidades
    },
    blocos: resultado.blocos,
    disciplinas: resultado.disciplinas,
    detalhes: resultado.detalhes,
    criterios: resultado.criterios,
    status: resultado.status,
    motivoEliminacao: resultado.motivoEliminacao,
    motivos: resultado.motivos || []
  }
}

function calcularPontuacaoSimulado({ respostas = [], gabarito = {}, questoes = [], perfil = {} } = {}) {
  const validacao = validarPerfilPontuacaoSimulado(perfil)
  if (!validacao.ok) {
    return {
      ok: false,
      erros: validacao.erros
    }
  }

  const perfilNormalizado = validacao.perfil
  const validacaoEntradas = validarEntradasPontuacaoSimulado(questoes, respostas)
  if (!validacaoEntradas.ok) {
    return {
      ok: false,
      erros: validacaoEntradas.erros
    }
  }

  const mapaRespostas = validacaoEntradas.respostas
  const detalhes = []
  const total = criarAcumuladorPontuacaoSimulado()
  const blocosMap = new Map()
  const disciplinasMap = new Map()

  validacaoEntradas.questoes.forEach(questao => {
    const id = questao.id
    const resposta = mapaRespostas.get(id) || {}
    const status = classificarQuestaoPontuacaoSimulado(questao, resposta, gabarito)
    const peso = obterPesoQuestaoPontuacaoSimulado(questao, perfilNormalizado)
    const valorBase = obterValorBasePontuacaoSimulado(status, perfilNormalizado)
    const entraDenominador = questaoEntraDenominadorPontuacaoSimulado(status, perfilNormalizado)
    const valorMaximo = entraDenominador ? normalizarPrecisaoPontuacaoSimulado(Math.max(0, perfilNormalizado.valores.correta * peso)) : 0
    let pontos = normalizarPrecisaoPontuacaoSimulado(valorBase * peso)

    if (perfilNormalizado.arredondamento.etapa === 'questao') {
      pontos = arredondarValorPontuacaoSimulado(pontos, perfilNormalizado.arredondamento)
    }

    const blocoId = obterBlocoQuestaoPontuacaoSimulado(questao, perfilNormalizado) || 'sem_bloco'
    const disciplinaId = normalizarIdPontuacaoSimulado(questao.materia_id || questao.disciplina_id || questao.disciplina) || 'sem_disciplina'
    const detalhe = {
      questaoId: id,
      status,
      peso,
      valorBase,
      pontos,
      valorMaximo,
      entraDenominador,
      blocoId,
      disciplinaId,
      tipo: normalizarIdPontuacaoSimulado(questao.tipo_questao || questao.tipo)
    }

    detalhes.push(detalhe)
    somarQuestaoAcumuladorPontuacaoSimulado(total, detalhe, status)

    if (!blocosMap.has(blocoId)) {
      const blocoPerfil = (perfilNormalizado.blocos || []).find(bloco => bloco.id === blocoId)
      blocosMap.set(blocoId, criarAcumuladorPontuacaoSimulado(blocoId, blocoPerfil?.nome || (blocoId === 'sem_bloco' ? 'Sem bloco' : blocoId)))
    }
    somarQuestaoAcumuladorPontuacaoSimulado(blocosMap.get(blocoId), detalhe, status)

    if (!disciplinasMap.has(disciplinaId)) {
      disciplinasMap.set(disciplinaId, criarAcumuladorPontuacaoSimulado(disciplinaId, disciplinaId === 'sem_disciplina' ? 'Sem disciplina' : disciplinaId))
    }
    somarQuestaoAcumuladorPontuacaoSimulado(disciplinasMap.get(disciplinaId), detalhe, status)
  })

  const blocos = Array.from(blocosMap.values())
    .map(bloco => finalizarAcumuladorPontuacaoSimulado(bloco, perfilNormalizado.arredondamento))
    .sort((a, b) => a.nome.localeCompare(b.nome))
  const disciplinas = Array.from(disciplinasMap.values())
    .map(disciplina => finalizarAcumuladorPontuacaoSimulado(disciplina, perfilNormalizado.arredondamento))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  finalizarAcumuladorPontuacaoSimulado(total, perfilNormalizado.arredondamento)

  const notaBruta = normalizarPrecisaoPontuacaoSimulado(total.notaBruta)
  const notaFinalBase = perfilNormalizado.notaMaxima !== null
    ? normalizarPrecisaoPontuacaoSimulado(Math.min(notaBruta, perfilNormalizado.notaMaxima))
    : notaBruta
  const notaFinal = perfilNormalizado.arredondamento.etapa === 'final'
    ? arredondarValorPontuacaoSimulado(notaFinalBase, perfilNormalizado.arredondamento)
    : normalizarPrecisaoPontuacaoSimulado(notaFinalBase)
  const notaMaxima = normalizarPrecisaoPontuacaoSimulado(perfilNormalizado.notaMaxima !== null ? perfilNormalizado.notaMaxima : total.notaMaxima)
  const percentual = notaMaxima > 0
    ? arredondarValorPontuacaoSimulado((notaFinal / notaMaxima) * 100, { modo: 'matematico', casasDecimais: 2 })
    : 0

  const resultado = {
    ok: true,
    perfil: perfilNormalizado,
    contagens: {
      total: total.totalQuestoes,
      respondidas: total.respondidas,
      corretas: total.corretas,
      erradas: total.erradas,
      brancas: total.brancas,
      anuladas: total.anuladas,
      semGabarito: total.semGabarito,
      denominador: total.denominadorQuestoes,
      excluidas: total.questoesExcluidas
    },
    pontosPositivos: arredondarValorPontuacaoSimulado(total.pontosPositivos, { modo: 'matematico', casasDecimais: 6 }),
    penalidades: arredondarValorPontuacaoSimulado(total.penalidades, { modo: 'matematico', casasDecimais: 6 }),
    notaBruta,
    notaFinal,
    notaMaxima,
    percentual,
    blocos,
    disciplinas,
    detalhes
  }

  const criterios = avaliarCriteriosPontuacaoSimulado(resultado, perfilNormalizado)
  resultado.status = criterios.status
  resultado.aprovado = criterios.aprovado
  resultado.eliminado = criterios.eliminado
  resultado.motivoEliminacao = criterios.motivos[0] || null
  resultado.motivos = criterios.motivos
  resultado.criterios = criterios.criterios
  resultado.snapshot = criarSnapshotPontuacaoSimulado(resultado, perfilNormalizado)

  return resultado
}

function criarQuestoesAgregadasPontuacaoSimulado({ total, certas, erradas, brancas = 0, anuladas = 0 } = {}) {
  const totalQuestoes = Math.max(0, Math.trunc(numeroPontuacaoSimulado(total, 0)))
  const totalCertas = Math.max(0, Math.trunc(numeroPontuacaoSimulado(certas, 0)))
  const totalErradas = Math.max(0, Math.trunc(numeroPontuacaoSimulado(erradas, 0)))
  const totalBrancas = Math.max(0, Math.trunc(numeroPontuacaoSimulado(brancas, 0)))
  const totalAnuladas = Math.max(0, Math.trunc(numeroPontuacaoSimulado(anuladas, 0)))
  const questoes = []
  const respostas = []
  let indice = 1

  const adicionar = (quantidade, tipo) => {
    for (let i = 0; i < quantidade && questoes.length < totalQuestoes; i += 1) {
      const id = `agregada-${indice}`
      const anulada = tipo === 'anulada'
      questoes.push({ id, gabarito: 'A', bloco_id: 'geral', anulada })
      if (tipo === 'correta') respostas.push({ questao_id: id, resposta: 'A' })
      if (tipo === 'errada') respostas.push({ questao_id: id, resposta: 'B' })
      if (tipo === 'anulada') respostas.push({ questao_id: id, resposta: '' })
      indice += 1
    }
  }

  adicionar(totalCertas, 'correta')
  adicionar(totalErradas, 'errada')
  adicionar(totalBrancas, 'branca')
  adicionar(totalAnuladas, 'anulada')
  adicionar(totalQuestoes - questoes.length, 'branca')

  return { questoes, respostas, gabarito: {} }
}

function calcularPontuacaoAgregadaSimulado(contagens, perfil) {
  const entrada = criarQuestoesAgregadasPontuacaoSimulado(contagens)
  return calcularPontuacaoSimulado({ ...entrada, perfil })
}

function restaurarResultadoPontuacaoSimulado(simulado = {}) {
  if (simulado.scoring_snapshot?.valores) {
    return {
      perfilNome: simulado.scoring_snapshot.perfil?.nome || 'Perfil salvo',
      perfilVersao: simulado.scoring_snapshot.perfil?.versao || simulado.scoring_profile_version || 1,
      status: simulado.scoring_snapshot.status || simulado.score_status || 'aprovado',
      notaFinal: numeroPontuacaoSimulado(simulado.score_final, simulado.scoring_snapshot.valores.notaFinal),
      notaBruta: numeroPontuacaoSimulado(simulado.score_raw, simulado.scoring_snapshot.valores.notaBruta),
      notaMaxima: numeroPontuacaoSimulado(simulado.score_max, simulado.scoring_snapshot.valores.notaMaxima),
      percentual: numeroPontuacaoSimulado(simulado.nota_percentual, simulado.scoring_snapshot.valores.percentual),
      contagens: simulado.scoring_snapshot.contagens || {},
      blocos: simulado.scoring_snapshot.blocos || [],
      criterios: simulado.scoring_snapshot.criterios || []
    }
  }

  const total = numeroPontuacaoSimulado(simulado.total_questoes, 0)
  const certas = numeroPontuacaoSimulado(simulado.certas, 0)
  const erradas = numeroPontuacaoSimulado(simulado.erradas, 0)
  const brancas = Math.max(0, total - certas - erradas)
  const percentual = numeroPontuacaoSimulado(simulado.nota_percentual, total > 0 ? (certas / total) * 100 : 0)

  return {
    perfilNome: 'Padrao atual',
    perfilVersao: 1,
    status: 'legado',
    notaFinal: certas,
    notaBruta: certas,
    notaMaxima: total,
    percentual,
    contagens: { total, corretas: certas, erradas, brancas, anuladas: 0 },
    blocos: [],
    criterios: []
  }
}

const SimuladoScoring = {
  SIMULADO_SCORING_PROFILE_LEGACY_SIMPLE,
  MODOS_PONTUACAO_SIMULADO,
  TRATAMENTOS_ANULADA_SIMULADO,
  MODOS_ARREDONDAMENTO_SIMULADO,
  criarPerfilPontuacaoLegadoSimulado,
  normalizarPerfilPontuacaoSimulado,
  validarPerfilPontuacaoSimulado,
  arredondarValorPontuacaoSimulado,
  calcularPontuacaoSimulado,
  calcularPontuacaoAgregadaSimulado,
  criarQuestoesAgregadasPontuacaoSimulado,
  criarSnapshotPontuacaoSimulado,
  restaurarResultadoPontuacaoSimulado
}

if (typeof globalThis !== 'undefined') {
  globalThis.SimuladoScoring = SimuladoScoring
  Object.assign(globalThis, SimuladoScoring)
}
