import { describe, expect, it } from 'vitest'

import { calcularNovaDueDateFlashcard } from '../redistribuir_flashcards.js'

describe('redistribuicao temporaria de flashcards', () => {
  it('calcula a nova due_date respeitando blocos de 50 cards por dia', () => {
    expect(calcularNovaDueDateFlashcard(0, '2026-06-15', 50)).toBe('2026-06-15')
    expect(calcularNovaDueDateFlashcard(49, '2026-06-15', 50)).toBe('2026-06-15')
    expect(calcularNovaDueDateFlashcard(50, '2026-06-15', 50)).toBe('2026-06-16')
    expect(calcularNovaDueDateFlashcard(99, '2026-06-15', 50)).toBe('2026-06-16')
    expect(calcularNovaDueDateFlashcard(100, '2026-06-15', 50)).toBe('2026-06-17')
  })
})
