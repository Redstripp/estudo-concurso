// setup.js - Configuração global para testes Vitest
// Este arquivo é executado antes de todos os testes

import { escaparHtmlSeguro, calcularPorcentagem, formatarData } from '../js/utils.js'
import * as gamificacao from '../js/gamificacao.js'
import * as questoes from '../js/questoes.js'

// Configurar ambiente para simular navegador quando necessário
if (typeof window === 'undefined') {
  global.window = {}
}

// Expor funções utilitárias globalmente para testes que precisam
global.escaparHtmlSeguro = escaparHtmlSeguro
global.calcularPorcentagem = calcularPorcentagem
global.formatarData = formatarData

// Expor funções de gamificacao
global.dataHojeGamificacao = gamificacao.dataHojeGamificacao
global.adicionarDiasGamificacao = gamificacao.adicionarDiasGamificacao
global.calcularRecordeGamificacao = gamificacao.calcularRecordeGamificacao
global.contarSequenciaGamificacao = gamificacao.contarSequenciaGamificacao
global.adicionarDataNormalizadaGamificacao = gamificacao.adicionarDataNormalizadaGamificacao

// Expor funções de questoes
global.escaparHtmlQuestao = questoes.escaparHtmlQuestao
global.CONFIG_TIPO_QUESTAO = questoes.CONFIG_TIPO_QUESTAO
global.normalizarTipoQuestao = questoes.normalizarTipoQuestao
global.normalizarStatusRevisao = questoes.normalizarStatusRevisao
global.questaoChutadaAcertada = questoes.questaoChutadaAcertada
global.normalizarTextoDuplicidade = questoes.normalizarTextoDuplicidade
