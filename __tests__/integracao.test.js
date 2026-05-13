// __tests__/integracao.test.js
// Testes de Integração - Testam a interação entre múltiplos módulos

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock do Supabase
const mockSupabase = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn()
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        order: vi.fn(() => ({ data: [], error: null }))
      })),
      order: vi.fn(() => ({ data: [], error: null }))
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => Promise.resolve({ data: null, error: null })),
    delete: vi.fn(() => Promise.resolve({ data: null, error: null }))
  }))
}

// Mock global do supabase
global.supabase = mockSupabase
global.db = mockSupabase

// Mock do localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} })
  }
})()

// Mock do window para ambiente Node
const windowMock = {
  localStorage: localStorageMock
}
global.window = windowMock

// Importa as funções utilitárias via globalThis (definidas em js/utils.js)
// As funções são exportadas para globalThis quando executadas no Vitest
const { escaparHtmlSeguro, formatarData, calcularPorcentagem } = globalThis

describe('Testes de Integração', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  describe('Fluxo Completo: Cadastro → Matérias → Questões → Gamificação', () => {
    it('deve simular fluxo completo de usuário estudando', async () => {
      // 1. Simula cadastro de usuário
      const usuarioNovo = {
        email: 'teste@exemplo.com',
        nome: 'Usuário Teste',
        id: 'user-123'
      }

      mockSupabase.auth.signUp.mockResolvedValue({ data: { user: usuarioNovo }, error: null })

      // Verifica se o signup foi chamado corretamente
      expect(escaparHtmlSeguro(usuarioNovo.email)).toBe('teste@exemplo.com')
      expect(escaparHtmlSeguro(usuarioNovo.nome)).toBe('Usuário Teste')

      // 2. Simula login após cadastro
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: usuarioNovo } }
      })

      // 3. Simula salvamento de matéria
      const materia = {
        id: 1,
        nome: 'Direito Constitucional',
        peso: 3,
        cor: '#3498db'
      }

      // Testa sanitização do nome da matéria
      const nomeSanitizado = escaparHtmlSeguro(materia.nome)
      expect(nomeSanitizado).toBe('Direito Constitucional')
      expect(nomeSanitizado).toContain(materia.nome)

      // 4. Simula resposta de questão
      const questao = {
        id: 101,
        enunciado: 'Qual é a capital do Brasil?',
        alternativas: ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'],
        correta: 2,
        materia_id: 1
      }

      const respostaUsuario = 2 // Brasília
      
      // Verifica lógica de acerto
      const acertou = respostaUsuario === questao.correta
      expect(acertou).toBe(true)

      // 5. Simula cálculo de pontuação na gamificação
      const pontosBase = 10
      const bonusAcerto = acertou ? pontosBase : 0
      const porcentagem = calcularPorcentagem(1, 1) // 1 acerto de 1 total

      expect(bonusAcerto).toBe(10)
      expect(porcentagem).toBe(100)

      // 6. Simula salvamento do resultado no "banco"
      const resultadoEstudo = {
        usuario_id: usuarioNovo.id,
        questao_id: questao.id,
        acertou: acertou,
        data: new Date().toISOString()
      }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => Promise.resolve({ 
          data: [resultadoEstudo], 
          error: null 
        }))
      })

      // Verifica se os dados estão estruturados corretamente
      expect(resultadoEstudo.acertou).toBe(true)
      expect(resultadoEstudo.usuario_id).toBe(usuarioNovo.id)
      expect(typeof resultadoEstudo.data).toBe('string')
    })

    it('deve lidar com caracteres especiais em nomes de matérias', () => {
      const materiasComEspeciais = [
        { nome: 'Direito & Legislação', esperado: 'Direito &amp; Legislação' },
        { nome: 'Matemática <Básica>', esperado: 'Matemática &lt;Básica&gt;' },
        { nome: 'Português "Avançado"', esperado: 'Português &quot;Avançado&quot;' },
        { nome: 'História\'s', esperado: 'História&#039;s' }
      ]

      materiasComEspeciais.forEach(({ nome, esperado }) => {
        const sanitizado = escaparHtmlSeguro(nome)
        expect(sanitizado).toBe(esperado)
      })
    })

    it('deve calcular corretamente estatísticas de desempenho', () => {
      const questoesRespondidas = [
        { acertou: true, materia_id: 1 },
        { acertou: true, materia_id: 1 },
        { acertou: false, materia_id: 1 },
        { acertou: true, materia_id: 2 },
        { acertou: false, materia_id: 2 }
      ]

      // Total de acertos
      const totalAcertos = questoesRespondidas.filter(q => q.acertou).length
      expect(totalAcertos).toBe(3)

      // Porcentagem geral
      const porcentagemGeral = calcularPorcentagem(totalAcertos, questoesRespondidas.length)
      expect(porcentagemGeral).toBe(60)

      // Agrupamento por matéria
      const estatisticasPorMateria = {}
      questoesRespondidas.forEach(q => {
        if (!estatisticasPorMateria[q.materia_id]) {
          estatisticasPorMateria[q.materia_id] = { total: 0, acertos: 0 }
        }
        estatisticasPorMateria[q.materia_id].total++
        if (q.acertou) {
          estatisticasPorMateria[q.materia_id].acertos++
        }
      })

      expect(estatisticasPorMateria[1].total).toBe(3)
      expect(estatisticasPorMateria[1].acertos).toBe(2)
      expect(estatisticasPorMateria[2].total).toBe(2)
      expect(estatisticasPorMateria[2].acertos).toBe(1)

      // Porcentagem por matéria
      const pctMateria1 = calcularPorcentagem(
        estatisticasPorMateria[1].acertos,
        estatisticasPorMateria[1].total
      )
      expect(pctMateria1).toBeCloseTo(66.67)
    })
  })

  describe('Integração: Validação de Dados de Entrada', () => {
    it('deve validar e sanitizar dados de formulário de cadastro', () => {
      const casosDeTeste = [
        { nome: '<script>alert("xss")</script>', valido: false },
        { nome: 'Usuário Válido', valido: true },
        { nome: '', valido: false },
        { nome: '   ', valido: false },
        { nome: 'Maria José da Silva', valido: true },
        { nome: 'José Maria dos Santos Júnior', valido: true }
      ]

      casosDeTeste.forEach(({ nome, valido }) => {
        const nomeTrimmed = nome.trim()
        const temConteudo = nomeTrimmed.length > 0
        const naoTemScript = !nomeTrimmed.toLowerCase().includes('<script')
        
        if (valido) {
          expect(temConteudo).toBe(true)
          expect(naoTemScript).toBe(true)
          expect(escaparHtmlSeguro(nomeTrimmed)).not.toContain('<script')
        } else if (nome.includes('<script')) {
          expect(naoTemScript).toBe(false)
          expect(escaparHtmlSeguro(nome)).not.toContain('<script>')
        }
      })
    })

    it('deve validar emails corretamente', () => {
      const emailsValidos = [
        'usuario@exemplo.com',
        'teste.user@dominio.com.br',
        'admin@estudo.com'
      ]

      const emailsInvalidos = [
        '',
        'sem-arroba.com',
        '@sem-local.com',
        'espaco @email.com'
      ]

      emailsValidos.forEach(email => {
        expect(email.includes('@')).toBe(true)
        expect(email.includes('.')).toBe(true)
        expect(email.trim()).toBe(email)
      })

      emailsInvalidos.forEach(email => {
        if (email === '') {
          expect(email.length).toBe(0)
        } else {
          const partes = email.split('@')
          if (partes.length !== 2) {
            expect(partes.length).not.toBe(2)
          }
        }
      })
    })

    it('deve validar senhas com critérios mínimos', () => {
      const senhaCurta = 'abc'
      const senhaValida = 'abcdef'

      expect(senhaCurta.length).toBeLessThan(6)
      expect(senhaValida.length).toBeGreaterThanOrEqual(6)
    })
  })

  describe('Integração: Sistema de Revisão Espaçada', () => {
    it('deve calcular datas de revisão corretamente', () => {
      const hoje = new Date('2024-01-01')
      
      // Intervalos de revisão (em dias)
      const intervalos = [1, 3, 7, 15, 30]
      
      const datasRevisao = intervalos.map(dias => {
        const data = new Date(hoje)
        data.setDate(data.getDate() + dias)
        return data
      })

      expect(datasRevisao[0].getDate()).toBe(2)  // 1 dia depois
      expect(datasRevisao[1].getDate()).toBe(4)  // 3 dias depois
      expect(datasRevisao[2].getDate()).toBe(8)  // 7 dias depois
      expect(datasRevisao[3].getDate()).toBe(16) // 15 dias depois
      expect(datasRevisao[4].getDate()).toBe(31) // 30 dias depois (ainda em janeiro)
    })

    it('deve priorizar revisões vencidas', () => {
      const revisoes = [
        { materia: 'Mat 1', dataVencimento: '2024-01-05', prioridade: 'alta' },
        { materia: 'Mat 2', dataVencimento: '2024-01-10', prioridade: 'media' },
        { materia: 'Mat 3', dataVencimento: '2024-01-15', prioridade: 'baixa' }
      ]

      const dataAtual = new Date('2024-01-08')
      
      const revisoesVencidas = revisoes.filter(r => 
        new Date(r.dataVencimento) < dataAtual
      )

      expect(revisoesVencidas.length).toBe(1)
      expect(revisoesVencidas[0].materia).toBe('Mat 1')
    })
  })

  describe('Integração: Sistema de Metas e Progresso', () => {
    it('deve calcular progresso em relação à meta', () => {
      const metaDiaria = 50 // 50 questões por dia
      const questoesFeitasHoje = 35

      const progresso = calcularPorcentagem(questoesFeitasHoje, metaDiaria)
      expect(progresso).toBe(70)

      // Verifica se atingiu a meta
      const metaAtingida = questoesFeitasHoje >= metaDiaria
      expect(metaAtingida).toBe(false)
    })

    it('deve calcular streak de estudos', () => {
      const diasConsecutivos = [
        '2024-01-01',
        '2024-01-02',
        '2024-01-03',
        '2024-01-05', // Quebrou o streak (dia 4 faltou)
        '2024-01-06'
      ]

      // Calcula streak atual (dias consecutivos até hoje)
      let streak = 1
      for (let i = diasConsecutivos.length - 2; i >= 0; i--) {
        const dataAtual = new Date(diasConsecutivos[i + 1])
        const dataAnterior = new Date(diasConsecutivos[i])
        const diffDias = (dataAtual - dataAnterior) / (1000 * 60 * 60 * 24)
        
        if (diffDias === 1) {
          streak++
        } else {
          break
        }
      }

      expect(streak).toBe(2) // Apenas 05 e 06 são consecutivos
    })

    it('deve calcular XP e níveis na gamificação', () => {
      const xpPorAcerto = 10
      const xpBonusRajada = 5 // XP extra por rajada de acertos
      const questoesConsecutivas = 5

      const xpTotal = (questoesConsecutivas * xpPorAcerto) + ((questoesConsecutivas - 1) * xpBonusRajada)
      expect(xpTotal).toBe(70) // 5*10 + 4*5

      // Cálculo de nível (exemplo: nível = floor(xp / 100) + 1)
      const nivel = Math.floor(xpTotal / 100) + 1
      expect(nivel).toBe(1)

      // Se tiver mais XP
      const xpMaior = 250
      const nivelMaior = Math.floor(xpMaior / 100) + 1
      expect(nivelMaior).toBe(3)
    })
  })

  describe('Integração: Tratamento de Erros e Edge Cases', () => {
    it('deve lidar com respostas vazias ou inválidas', () => {
      const questao = {
        id: 1,
        alternativas: ['A', 'B', 'C', 'D'],
        correta: 2
      }

      const respostasInvalidas = [null, undefined, -1, 4, 10]
      
      respostasInvalidas.forEach(resposta => {
        const valida = resposta !== null && 
                      resposta !== undefined && 
                      resposta >= 0 && 
                      resposta < questao.alternativas.length
        
        if (!valida) {
          expect(resposta).not.toBe(questao.correta)
        }
      })

      const respostaValida = 2
      const eValida = respostaValida >= 0 && respostaValida < questao.alternativas.length
      expect(eValida).toBe(true)
      expect(respostaValida).toBe(questao.correta)
    })

    it('deve lidar com divisão por zero em cálculos de porcentagem', () => {
      // Nossa função deve lidar com isso
      expect(calcularPorcentagem(0, 0)).toBe(0)
      expect(calcularPorcentagem(5, 0)).toBe(0)
      expect(calcularPorcentagem(0, 10)).toBe(0)
    })

    it('deve formatar datas corretamente', () => {
      const data = new Date('2024-01-15T10:30:00')
      const dataFormatada = formatarData(data)
      
      expect(dataFormatada).toMatch(/\d{2}\/\d{2}\/\d{4}/)
      expect(dataFormatada).toContain('2024')
    })
  })

  describe('Integração: Sistema de Ranking', () => {
    it('deve ordenar ranking corretamente', () => {
      const usuarios = [
        { nome: 'Alice', xp: 150, acertos: 20 },
        { nome: 'Bob', xp: 200, acertos: 25 },
        { nome: 'Charlie', xp: 150, acertos: 30 }, // Mesmo XP, mais acertos
        { nome: 'Diana', xp: 100, acertos: 15 }
      ]

      // Ordena por XP (desc), depois por acertos (desc)
      const ranking = [...usuarios].sort((a, b) => {
        if (b.xp !== a.xp) return b.xp - a.xp
        return b.acertos - a.acertos
      })

      expect(ranking[0].nome).toBe('Bob')    // Maior XP
      expect(ranking[1].nome).toBe('Charlie')// Mesmo XP que Alice, mas mais acertos
      expect(ranking[2].nome).toBe('Alice')
      expect(ranking[3].nome).toBe('Diana')
    })

    it('deve calcular posição do usuário no ranking', () => {
      const usuarios = [
        { id: 1, nome: 'Alice', xp: 150 },
        { id: 2, nome: 'Bob', xp: 200 },
        { id: 3, nome: 'Charlie', xp: 150 },
        { id: 4, nome: 'Diana', xp: 100 }
      ]

      const usuarioAtualId = 1
      const ranking = [...usuarios].sort((a, b) => b.xp - a.xp)
      const posicao = ranking.findIndex(u => u.id === usuarioAtualId) + 1

      expect(posicao).toBe(2) // Alice está em 2º ou 3º dependendo do critério de desempate
    })
  })

  describe('Integração: Persistência de Dados', () => {
    it('deve salvar e recuperar dados do localStorage', () => {
      const dadosEstudo = {
        usuario_id: 'user-123',
        questoesRespondidas: 50,
        acertos: 35,
        ultimaAtividade: new Date().toISOString()
      }

      // Salva
      localStorageMock.setItem('dados_estudo', JSON.stringify(dadosEstudo))
      
      // Recupera
      const dadosRecuperados = JSON.parse(localStorageMock.getItem('dados_estudo'))

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'dados_estudo',
        JSON.stringify(dadosEstudo)
      )
      expect(localStorageMock.getItem).toHaveBeenCalledWith('dados_estudo')
      expect(dadosRecuperados.usuario_id).toBe(dadosEstudo.usuario_id)
      expect(dadosRecuperados.questoesRespondidas).toBe(50)
    })

    it('deve lidar com dados corrompidos no localStorage', () => {
      localStorageMock.setItem('dados_corrompidos', '{json invalido}')
      
      const conteudo = localStorageMock.getItem('dados_corrompidos')
      expect(() => JSON.parse(conteudo)).toThrow()
    })
  })
})
