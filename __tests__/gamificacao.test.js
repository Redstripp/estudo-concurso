import { describe, it, expect } from 'vitest'

// Funções extraídas de js/gamificacao.js para teste puro
function dataHojeGamificacao() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

function adicionarDiasGamificacao(dataISO, dias) {
  const data = new Date(`${dataISO}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function calcularRecordeGamificacao(datas) {
  const ordenadas = [...new Set(datas)].sort()
  if (ordenadas.length === 0) return 0

  let recorde = 1
  let atual = 1

  for (let i = 1; i < ordenadas.length; i += 1) {
    const anterior = ordenadas[i - 1]
    const esperada = adicionarDiasGamificacao(anterior, 1)
    if (ordenadas[i] === esperada) {
      atual += 1
    } else {
      atual = 1
    }
    recorde = Math.max(recorde, atual)
  }

  return recorde
}

function contarSequenciaGamificacao(conjunto, dataBase) {
  let total = 0
  let data = dataBase

  while (conjunto.has(data)) {
    total += 1
    data = adicionarDiasGamificacao(data, -1)
  }

  return total
}

function adicionarDataNormalizadaGamificacao(conjunto, valor) {
  const data = String(valor || '').substring(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) conjunto.add(data)
}

describe('calcularRecordeGamificacao', () => {
  it('Array vazio deve retornar 0', () => {
    expect(calcularRecordeGamificacao([])).toBe(0)
  })

  it("['2025-01-01'] deve retornar 1", () => {
    expect(calcularRecordeGamificacao(['2025-01-01'])).toBe(1)
  })

  it("['2025-01-01', '2025-01-02', '2025-01-03'] deve retornar 3", () => {
    expect(calcularRecordeGamificacao(['2025-01-01', '2025-01-02', '2025-01-03'])).toBe(3)
  })

  it("['2025-01-01', '2025-01-03'] (com gap) deve retornar 1", () => {
    expect(calcularRecordeGamificacao(['2025-01-01', '2025-01-03'])).toBe(1)
  })

  it("['2025-01-01', '2025-01-02', '2025-01-04', '2025-01-05'] deve retornar 2", () => {
    expect(calcularRecordeGamificacao(['2025-01-01', '2025-01-02', '2025-01-04', '2025-01-05'])).toBe(2)
  })
})

describe('contarSequenciaGamificacao', () => {
  it('Sequência de 3 dias consecutivos deve retornar 3', () => {
    const conjunto = new Set(['2025-01-01', '2025-01-02', '2025-01-03'])
    expect(contarSequenciaGamificacao(conjunto, '2025-01-03')).toBe(3)
  })

  it('Um dia isolado deve retornar 1', () => {
    const conjunto = new Set(['2025-01-01'])
    expect(contarSequenciaGamificacao(conjunto, '2025-01-01')).toBe(1)
  })

  it('Data não presente no conjunto deve retornar 0', () => {
    const conjunto = new Set(['2025-01-01', '2025-01-02'])
    expect(contarSequenciaGamificacao(conjunto, '2025-01-03')).toBe(0)
  })
})

describe('adicionarDiasGamificacao', () => {
  it("'2025-01-01' + 1 deve retornar '2025-01-02'", () => {
    expect(adicionarDiasGamificacao('2025-01-01', 1)).toBe('2025-01-02')
  })

  it("'2025-01-31' + 1 deve retornar '2025-02-01'", () => {
    expect(adicionarDiasGamificacao('2025-01-31', 1)).toBe('2025-02-01')
  })

  it("'2025-01-05' - 3 deve retornar '2025-01-02'", () => {
    expect(adicionarDiasGamificacao('2025-01-05', -3)).toBe('2025-01-02')
  })
})

describe('adicionarDataNormalizadaGamificacao', () => {
  it("Deve adicionar '2025-01-01' ao conjunto para um timestamp ISO válido", () => {
    const conjunto = new Set()
    adicionarDataNormalizadaGamificacao(conjunto, '2025-01-01T10:00:00Z')
    expect(conjunto.has('2025-01-01')).toBe(true)
  })

  it('Deve ignorar strings inválidas', () => {
    const conjunto = new Set()
    adicionarDataNormalizadaGamificacao(conjunto, 'invalido')
    expect(conjunto.size).toBe(0)
  })

  it('Deve ignorar null e undefined', () => {
    const conjunto = new Set()
    adicionarDataNormalizadaGamificacao(conjunto, null)
    adicionarDataNormalizadaGamificacao(conjunto, undefined)
    expect(conjunto.size).toBe(0)
  })
})
