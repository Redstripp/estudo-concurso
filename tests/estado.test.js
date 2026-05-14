import { describe, it, expect, beforeEach } from 'vitest'

// Importação compatível com ES modules
const modulo = await import('../js/estado.js')
const Estado = modulo.default || modulo.Estado || globalThis.Estado

describe('Estado Global Centralizado', () => {
  beforeEach(() => {
    // Resetar estado antes de cada teste
    if (Estado && typeof Estado.resetAll === 'function') {
      Estado.resetAll()
    }
  })

  describe('Estrutura do Estado', () => {
    it('deve ter módulo questoes com valores padrão corretos', () => {
      expect(Estado.questoes).toBeDefined()
      expect(Estado.questoes.alternativaMarcada).toBe(null)
      expect(Estado.questoes.alternativaCorreta).toBe(null)
      expect(Estado.questoes.numAlternativas).toBe(2)
      expect(Estado.questoes.tipoQuestaoAtual).toBe('Errada')
      expect(Estado.questoes.modoRegistroQuestao).toBe('rapido')
      expect(Estado.questoes.inicializado).toBe(false)
      expect(Estado.questoes.filtroCadernoErrosAtual).toBe('todos')
      expect(Estado.questoes.questoesEmMemoria).toEqual([])
      expect(Estado.questoes.timeoutBusca).toBe(null)
    })

    it('deve ter módulo revisao com valores padrão corretos', () => {
      expect(Estado.revisao).toBeDefined()
      expect(Estado.revisao.inicializado).toBe(false)
      expect(Estado.revisao.treinoRevisaoQuestoes).toEqual([])
      expect(Estado.revisao.treinoRevisaoIndice).toBe(0)
      expect(Estado.revisao.treinoRevisaoChecklist).toEqual({ comando: false, pegadinha: false, tipo: false })
    })

    it('deve ter todos os módulos necessários', () => {
      expect(Estado.edital).toBeDefined()
      expect(Estado.estatisticas).toBeDefined()
      expect(Estado.materias).toBeDefined()
      expect(Estado.planejamento).toBeDefined()
      expect(Estado.plano).toBeDefined()
      expect(Estado.desempenho).toBeDefined()
      expect(Estado.simulados).toBeDefined()
      expect(Estado.app).toBeDefined()
    })
  })

  describe('Método get', () => {
    it('deve retornar valor correto de um módulo', () => {
      expect(Estado.get('questoes', 'tipoQuestaoAtual')).toBe('Errada')
      expect(Estado.get('questoes', 'numAlternativas')).toBe(2)
    })

    it('deve retornar valor padrão quando chave não existe', () => {
      expect(Estado.get('questoes', 'chaveInexistente', 'padrao')).toBe('padrao')
      expect(Estado.get('questoes', 'chaveInexistente')).toBe(null)
    })

    it('deve retornar aviso e valor padrão quando módulo não existe', () => {
      const resultado = Estado.get('moduloInexistente', 'chave')
      expect(resultado).toBe(null)
    })

    it('deve retornar objeto completo do módulo quando chave não especificada', () => {
      const questoesCompleto = Estado.get('questoes')
      expect(questoesCompleto).toEqual(Estado.questoes)
    })
  })

  describe('Método set', () => {
    it('deve alterar valor de uma propriedade', () => {
      const sucesso = Estado.set('questoes', 'tipoQuestaoAtual', 'Chutada')
      expect(sucesso).toBe(true)
      expect(Estado.questoes.tipoQuestaoAtual).toBe('Chutada')
    })

    it('deve alterar valor de array', () => {
      const novaQuestao = { id: 1, texto: 'Teste' }
      const sucesso = Estado.set('questoes', 'questoesEmMemoria', [novaQuestao])
      expect(sucesso).toBe(true)
      expect(Estado.questoes.questoesEmMemoria).toEqual([novaQuestao])
    })

    it('deve retornar false quando módulo não existe', () => {
      const sucesso = Estado.set('moduloInexistente', 'chave', 'valor')
      expect(sucesso).toBe(false)
    })

    it('deve retornar false quando chave não é especificada', () => {
      const sucesso = Estado.set('questoes', undefined, 'valor')
      expect(sucesso).toBe(false)
    })
  })

  describe('Método reset', () => {
    it('deve resetar booleanos para false', () => {
      Estado.set('questoes', 'inicializado', true)
      Estado.reset('questoes')
      expect(Estado.questoes.inicializado).toBe(false)
    })

    it('deve resetar arrays para vazio', () => {
      Estado.set('questoes', 'questoesEmMemoria', [{ id: 1 }])
      Estado.reset('questoes')
      expect(Estado.questoes.questoesEmMemoria).toEqual([])
    })

    it('deve manter strings padrão', () => {
      Estado.set('questoes', 'tipoQuestaoAtual', 'OutroTipo')
      Estado.reset('questoes')
      expect(Estado.questoes.tipoQuestaoAtual).toBe('Errada')
    })

    it('deve manter números padrão', () => {
      Estado.set('questoes', 'numAlternativas', 5)
      Estado.reset('questoes')
      expect(Estado.questoes.numAlternativas).toBe(2)
    })

    it('deve retornar false quando módulo não existe', () => {
      const sucesso = Estado.reset('moduloInexistente')
      expect(sucesso).toBe(false)
    })
  })

  describe('Método resetAll', () => {
    it('deve resetar todos os módulos', () => {
      Estado.set('questoes', 'inicializado', true)
      Estado.set('revisao', 'inicializado', true)
      Estado.set('edital', 'inicializado', true)
      
      Estado.resetAll()
      
      expect(Estado.questoes.inicializado).toBe(false)
      expect(Estado.revisao.inicializado).toBe(false)
      expect(Estado.edital.inicializado).toBe(false)
    })
  })

  describe('Isolamento de estado', () => {
    it('deve isolar estado entre diferentes contextos', () => {
      Estado.set('questoes', 'tipoQuestaoAtual', 'Chutada')
      Estado.set('questoes', 'alternativaMarcada', 'C')
      
      expect(Estado.questoes.tipoQuestaoAtual).toBe('Chutada')
      expect(Estado.questoes.alternativaMarcada).toBe('C')
      
      Estado.reset('questoes')
      
      expect(Estado.questoes.tipoQuestaoAtual).toBe('Errada')
      expect(Estado.questoes.alternativaMarcada).toBe(null)
    })
  })
})
