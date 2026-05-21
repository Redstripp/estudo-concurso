import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '../js/flashcards.js'

const {
  inicializarFlashcards,
  selecionarAbaFlashcards,
  criarFlashcard,
  listarFlashcards,
  listarFlashcardsDevidosHoje,
  atualizarFlashcard,
  desativarFlashcard,
  registrarRevisaoFlashcard
} = globalThis

const dbOriginal = globalThis.db
const windowOriginal = globalThis.window
const appHtml = readFileSync(new URL('../app.html', import.meta.url), 'utf8')
const appJs = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8')

function criarAuthMock(userId = 'user-1') {
  return {
    getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null }, error: null }))
  }
}

function criarQueryLista(resposta = { data: [], error: null }) {
  return {
    ...resposta,
    select: vi.fn(function () { return this }),
    eq: vi.fn(function () { return this }),
    lte: vi.fn(function () { return this }),
    order: vi.fn(function () { return this })
  }
}

afterEach(() => {
  globalThis.db = dbOriginal
  globalThis.window = windowOriginal
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('esqueleto visual dos flashcards', () => {
  it('adiciona a secao Flashcards e o item de menu principal', () => {
    expect(appHtml).toContain('data-secao="flashcards"')
    expect(appHtml).toContain('id="secao-flashcards"')
    expect(appHtml).toContain('Flashcards')
  })

  it('mantem as quatro abas internas esperadas', () => {
    expect(appHtml).toContain('data-flashcards-aba="revisar-hoje"')
    expect(appHtml).toContain('data-flashcards-aba="todos"')
    expect(appHtml).toContain('data-flashcards-aba="adicionar"')
    expect(appHtml).toContain('data-flashcards-aba="estatisticas"')
    expect(appHtml).toContain('Revisar Hoje')
    expect(appHtml).toContain('Todos os Cards')
    expect(appHtml).toContain('Adicionar Card')
  })

  it('mantem placeholders da primeira versao visual', () => {
    expect(appHtml).toContain('Nenhum card pendente para hoje.')
    expect(appHtml).toContain('Nenhum flashcard cadastrado ainda.')
    expect(appHtml).toContain('id="flashcard-frente"')
    expect(appHtml).toContain('id="flashcard-verso"')
    expect(appHtml).toContain('id="flashcard-tags"')
    expect(appHtml).toContain('Total de cards')
    expect(appHtml).toContain('Cards para hoje')
    expect(appHtml).toContain('Taxa de acerto')
    expect(appHtml).toContain('Sequ')
  })

  it('carrega js/flashcards.js antes de js/app.js', () => {
    const posicaoFlashcards = appHtml.indexOf('src="js/flashcards.js"')
    const posicaoApp = appHtml.indexOf('src="js/app.js"')

    expect(posicaoFlashcards).toBeGreaterThan(-1)
    expect(posicaoApp).toBeGreaterThan(-1)
    expect(posicaoFlashcards).toBeLessThan(posicaoApp)
  })

  it('registra inicializador sem remover navegacao existente', () => {
    expect(appJs).toContain('flashcards: () => inicializarFlashcards()')
    expect(appJs).toContain('dashboard: () => inicializarDashboard()')
    expect(appJs).toContain('revisao: () => inicializarRevisao()')
    expect(appHtml).toContain('data-secao="dashboard"')
    expect(appHtml).toContain('data-secao="revisao"')
  })

  it('inicializador nao quebra e alterna abas internas', () => {
    document.body.innerHTML = `
      <section id="secao-flashcards">
        <button class="flashcards-aba" data-flashcards-aba="revisar-hoje" aria-selected="false"></button>
        <button class="flashcards-aba" data-flashcards-aba="todos" aria-selected="false"></button>
        <div class="flashcards-painel" id="flashcards-painel-revisar-hoje" hidden></div>
        <div class="flashcards-painel" id="flashcards-painel-todos" hidden></div>
        <span id="flashcards-pendentes-hoje"></span>
        <strong id="flashcards-total-cards"></strong>
        <strong id="flashcards-cards-hoje"></strong>
        <strong id="flashcards-taxa-acerto"></strong>
        <strong id="flashcards-sequencia-estudos"></strong>
      </section>
    `

    expect(() => inicializarFlashcards()).not.toThrow()
    expect(document.getElementById('flashcards-painel-revisar-hoje').hidden).toBe(false)
    expect(document.querySelector('[data-flashcards-aba="revisar-hoje"]').getAttribute('aria-selected')).toBe('true')
    expect(document.getElementById('flashcards-pendentes-hoje').textContent).toBe('Cards pendentes hoje: 0')

    selecionarAbaFlashcards('todos', document.getElementById('secao-flashcards'))

    expect(document.getElementById('flashcards-painel-revisar-hoje').hidden).toBe(true)
    expect(document.getElementById('flashcards-painel-todos').hidden).toBe(false)
    expect(document.querySelector('[data-flashcards-aba="todos"]').getAttribute('aria-selected')).toBe('true')
  })

  it('continua expondo as funcoes de dados existentes', () => {
    expect(globalThis.criarFlashcard).toBe(criarFlashcard)
    expect(globalThis.listarFlashcards).toBe(listarFlashcards)
    expect(globalThis.listarFlashcardsDevidosHoje).toBe(listarFlashcardsDevidosHoje)
    expect(globalThis.atualizarFlashcard).toBe(atualizarFlashcard)
    expect(globalThis.desativarFlashcard).toBe(desativarFlashcard)
    expect(globalThis.registrarRevisaoFlashcard).toBe(registrarRevisaoFlashcard)
  })
})

describe('camada de dados dos flashcards', () => {
  it('criarFlashcard monta payload correto', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))

    const single = vi.fn(async () => ({ data: { id: 'card-1' }, error: null }))
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    const resultado = await criarFlashcard({
      user_id: 'usuario-injetado',
      materia_id: 'mat-1',
      frente: '  Frente do card  ',
      verso: '  Verso do card  ',
      tags: [' direito ', '', 'constitucional']
    })

    expect(resultado.error).toBeNull()
    expect(from).toHaveBeenCalledWith('flashcards')
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      materia_id: 'mat-1',
      frente: 'Frente do card',
      verso: 'Verso do card',
      tags: ['direito', 'constitucional'],
      ativo: true,
      estado: 'novo',
      ease_factor: 2.5,
      repetitions: 0,
      interval_days: 1,
      due_date: '2026-05-20'
    })
  })

  it('criarFlashcard usa user_id da sessao, nao da entrada', async () => {
    const single = vi.fn(async () => ({ data: { id: 'card-1' }, error: null }))
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))
    globalThis.db = { auth: criarAuthMock('user-real'), from }

    await criarFlashcard({
      user_id: 'user-falso',
      frente: 'Frente',
      verso: 'Verso'
    })

    expect(insert.mock.calls[0][0].user_id).toBe('user-real')
  })

  it('criarFlashcard rejeita frente vazia', async () => {
    const from = vi.fn()
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    const resultado = await criarFlashcard({ frente: '   ', verso: 'Verso' })

    expect(resultado.error.message).toBe('Informe a frente do flashcard.')
    expect(from).not.toHaveBeenCalled()
  })

  it('criarFlashcard rejeita verso vazia', async () => {
    const from = vi.fn()
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    const resultado = await criarFlashcard({ frente: 'Frente', verso: '   ' })

    expect(resultado.error.message).toBe('Informe o verso do flashcard.')
    expect(from).not.toHaveBeenCalled()
  })

  it('listarFlashcards chama a tabela flashcards', async () => {
    const query = criarQueryLista({ data: [{ id: 'card-1' }], error: null })
    const from = vi.fn(() => query)
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    const resultado = await listarFlashcards()

    expect(resultado.data).toEqual([{ id: 'card-1' }])
    expect(from).toHaveBeenCalledWith('flashcards')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('listarFlashcardsDevidosHoje filtra due_date menor ou igual a hoje e ativo true', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))

    const query = criarQueryLista({ data: [], error: null })
    const from = vi.fn(() => query)
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    await listarFlashcardsDevidosHoje()

    expect(from).toHaveBeenCalledWith('flashcards')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(query.eq).toHaveBeenCalledWith('ativo', true)
    expect(query.lte).toHaveBeenCalledWith('due_date', '2026-05-20')
  })

  it('atualizarFlashcard nao permite trocar user_id manualmente', async () => {
    const single = vi.fn(async () => ({ data: { id: 'card-1' }, error: null }))
    const select = vi.fn(() => ({ single }))
    const updateChain = {
      eq: vi.fn(function () { return this }),
      select
    }
    const update = vi.fn(() => updateChain)
    const from = vi.fn(() => ({ update }))
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    await atualizarFlashcard('card-1', {
      user_id: 'user-falso',
      frente: 'Nova frente',
      verso: 'Novo verso',
      tags: ['tag'],
      materia_id: 'mat-1',
      ativo: true
    })

    const payload = update.mock.calls[0][0]
    expect(payload).not.toHaveProperty('user_id')
    expect(payload).toMatchObject({
      frente: 'Nova frente',
      verso: 'Novo verso',
      tags: ['tag'],
      materia_id: 'mat-1',
      ativo: true
    })
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'card-1')
    expect(updateChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('desativarFlashcard envia ativo false', async () => {
    const single = vi.fn(async () => ({ data: { id: 'card-1', ativo: false }, error: null }))
    const select = vi.fn(() => ({ single }))
    const updateChain = {
      eq: vi.fn(function () { return this }),
      select
    }
    const update = vi.fn(() => updateChain)
    const from = vi.fn(() => ({ update }))
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    await desativarFlashcard('card-1')

    expect(update.mock.calls[0][0]).toMatchObject({ ativo: false })
  })

  it('registrarRevisaoFlashcard atualiza flashcards e insere em flashcard_reviews', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))

    const consultaCard = {
      select: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      single: vi.fn(async () => ({
        data: {
          id: 'card-1',
          interval_days: 6,
          ease_factor: 2.5,
          repetitions: 2,
          total_reviews: 4,
          correct_reviews: 3,
          lapses: 1
        },
        error: null
      }))
    }
    const atualizacaoCard = {
      update: vi.fn(function () { return this }),
      eq: vi.fn(function () { return this }),
      select: vi.fn(function () { return this }),
      single: vi.fn(async () => ({ data: { id: 'card-1' }, error: null }))
    }
    const historico = {
      insert: vi.fn(async () => ({ data: [{ id: 'review-1' }], error: null }))
    }
    let chamadasFlashcards = 0
    const from = vi.fn((tabela) => {
      if (tabela === 'flashcards') {
        chamadasFlashcards += 1
        return chamadasFlashcards === 1 ? consultaCard : atualizacaoCard
      }
      if (tabela === 'flashcard_reviews') return historico
      throw new Error(`Tabela inesperada: ${tabela}`)
    })
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    const resultado = await registrarRevisaoFlashcard('card-1', {
      quality: 5,
      repetitions: 3,
      intervalDays: 15,
      easeFactor: 2.6,
      dueAgainToday: false,
      wasCorrect: true
    })

    expect(resultado.error).toBeNull()
    expect(atualizacaoCard.update).toHaveBeenCalledWith(expect.objectContaining({
      ease_factor: 2.6,
      repetitions: 3,
      interval_days: 15,
      due_date: '2026-06-04',
      total_reviews: 5,
      correct_reviews: 4,
      lapses: 1,
      estado: 'revisando'
    }))
    expect(historico.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      flashcard_id: 'card-1',
      quality: 5,
      old_interval_days: 6,
      new_interval_days: 15,
      old_ease_factor: 2.5,
      new_ease_factor: 2.6,
      old_repetitions: 2,
      new_repetitions: 3,
      was_correct: true
    })
  })

  it('erro de Supabase retorna mensagem controlada', async () => {
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    const single = vi.fn(async () => ({ data: null, error: { message: 'erro tecnico' } }))
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    const resultado = await criarFlashcard({ frente: 'Frente', verso: 'Verso' })

    expect(resultado.error.message).toBe('Nao foi possivel criar o flashcard. Verifique sua conexao e tente novamente.')
    expect(erroConsole).toHaveBeenCalledWith({ message: 'erro tecnico' })
  })

  it('usuario nao logado gera erro amigavel', async () => {
    const from = vi.fn()
    globalThis.window.usuarioAtual = null
    globalThis.db = { auth: criarAuthMock(null), from }

    const resultado = await criarFlashcard({ frente: 'Frente', verso: 'Verso' })

    expect(resultado.error.message).toBe('E necessario estar logado para usar flashcards.')
    expect(from).not.toHaveBeenCalled()
  })
})
