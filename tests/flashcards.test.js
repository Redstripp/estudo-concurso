import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '../js/flashcards.js'

const {
  inicializarFlashcards,
  selecionarAbaFlashcards,
  salvarFlashcardTela,
  abrirEdicaoFlashcardLista,
  salvarEdicaoFlashcardLista,
  mostrarConfirmacaoDesativarFlashcardLista,
  confirmarDesativacaoFlashcardLista,
  aplicarFiltrosFlashcards,
  renderizarListaFlashcardsFiltrada,
  limparFiltrosFlashcards,
  carregarListaFlashcards,
  renderizarListaFlashcards,
  carregarFlashcardsRevisarHoje,
  iniciarSessaoRevisaoFlashcards,
  mostrarRespostaFlashcardAtual,
  avaliarFlashcardAtual,
  carregarEstudoDiaFlashcards,
  carregarAlertaAcumuloFlashcards,
  contarCardsAcumuladosFlashcards,
  navegarParaRevisaoUrgenteFlashcards,
  renderizarAlertaAcumuloFlashcards,
  selecionarCardsNovosEstudoDiaFlashcards,
  extrairCamposRicosDoVersoFlashcard,
  calcularProximaRevisaoSM2Flashcards,
  calcularEstatisticasFlashcards,
  renderizarEstatisticasFlashcards,
  carregarEstatisticasFlashcards,
  carregarMateriasFlashcards,
  criarFlashcard,
  listarFlashcards,
  listarMateriasPlanejadasHojeFlashcards,
  listarFlashcardsDevidosHoje,
  listarRevisoesFlashcards,
  listarMateriasFlashcards,
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

function montarFormularioFlashcards() {
  document.body.innerHTML = `
    <section id="secao-flashcards">
      <div id="flashcards-lista"></div>
      <textarea id="flashcard-frente"></textarea>
      <textarea id="flashcard-verso"></textarea>
      <input id="flashcard-tags" />
      <select id="flashcard-materia">
        <option value="">Sem matéria</option>
        <option value="mat-1">Direito Constitucional</option>
      </select>
      <button id="btn-salvar-flashcard" type="button">Salvar Card</button>
      <p id="msg-flashcards"></p>
    </section>
  `
}

function montarListaFlashcardsComFiltros() {
  document.body.innerHTML = `
    <section id="secao-flashcards">
      <input id="flashcards-busca" />
      <select id="flashcards-filtro-estado">
        <option value="todos">Todos</option>
        <option value="novo">Novo</option>
        <option value="aprendendo">Aprendendo</option>
        <option value="revisando">Revisando</option>
      </select>
      <select id="flashcards-filtro-vencimento">
        <option value="todos">Todos</option>
        <option value="hoje">Para hoje</option>
        <option value="futuros">Futuros</option>
      </select>
      <input id="flashcards-filtro-tag" />
      <select id="flashcards-filtro-materia">
        <option value="todos">Todas as matérias</option>
        <option value="sem-materia">Sem matéria</option>
        <option value="mat-1">Direito Constitucional</option>
        <option value="mat-2">Direito Administrativo</option>
      </select>
      <button id="btn-limpar-filtros-flashcards" type="button">Limpar filtros</button>
      <div id="flashcards-lista"></div>
    </section>
  `
}

function montarSecaoRevisaoFlashcards() {
  document.body.innerHTML = `
    <section id="secao-flashcards">
      <div id="flashcards-alerta-acumulo" hidden>
        <p id="flashcards-alerta-acumulo-texto"></p>
        <button id="btn-revisar-alerta-flashcards" type="button">Revisar agora</button>
      </div>
      <button class="flashcards-aba" data-flashcards-aba="revisar-hoje" aria-selected="false"></button>
      <button class="flashcards-aba" data-flashcards-aba="todos" aria-selected="false"></button>
      <div class="flashcards-painel" id="flashcards-painel-revisar-hoje" hidden>
      <div id="flashcards-revisao-urgente">
        <span id="flashcards-pendentes-hoje"></span>
        <p id="flashcards-progresso-sessao"></p>
        <p id="flashcards-resumo-vencimento"></p>
        <p id="flashcards-revisar-vazio"></p>
        <div id="flashcards-revisao-card"></div>
        <button id="btn-iniciar-revisao-flashcards" type="button" disabled>Iniciar revisao</button>
      </div>
      <div id="flashcards-estudo-dia">
        <span id="flashcards-estudo-dia-status"></span>
        <p id="flashcards-estudo-dia-vazio"></p>
        <div id="flashcards-estudo-dia-lista"></div>
      </div>
      </div>
      <div class="flashcards-painel" id="flashcards-painel-todos" hidden></div>
    </section>
  `
}

function montarSecaoEstatisticasFlashcards() {
  document.body.innerHTML = `
    <section id="secao-flashcards">
      <strong id="flashcards-total-cards"></strong>
      <strong id="flashcards-cards-hoje"></strong>
      <strong id="flashcards-cards-atrasados"></strong>
      <strong id="flashcards-cards-para-hoje"></strong>
      <strong id="flashcards-cards-novos"></strong>
      <strong id="flashcards-cards-aprendendo"></strong>
      <strong id="flashcards-cards-revisando"></strong>
      <strong id="flashcards-total-revisoes"></strong>
      <strong id="flashcards-total-acertos"></strong>
      <strong id="flashcards-taxa-acerto"></strong>
      <strong id="flashcards-total-erros"></strong>
      <strong id="flashcards-sequencia-estudos"></strong>
      <p id="msg-flashcards-estatisticas"></p>
    </section>
  `
}

function criarCardRevisao(sobrescritas = {}) {
  return {
    id: 'card-1',
    frente: 'Frente do card',
    verso: 'Verso do card',
    ativo: true,
    due_date: '2026-05-20',
    repetitions: 0,
    interval_days: 1,
    ease_factor: 2.5,
    ...sobrescritas
  }
}

function criarCardsFiltroFlashcards() {
  return [
    criarCardRevisao({
      id: 'card-novo',
      frente: 'Controle difuso',
      verso: 'Pode ser exercido por qualquer juiz.',
      estado: 'novo',
      due_date: '2026-05-20',
      materia_id: 'mat-1',
      materias: { nome: 'Direito Constitucional' },
      tags: ['constitucional', 'controle']
    }),
    criarCardRevisao({
      id: 'card-aprendendo',
      frente: 'Prazo administrativo',
      verso: 'Conta em dias uteis quando a lei indicar.',
      estado: 'aprendendo',
      due_date: '2026-05-22',
      materia_id: 'mat-2',
      materias: { nome: 'Direito Administrativo' },
      tags: ['administrativo', 'prazos']
    }),
    criarCardRevisao({
      id: 'card-revisando',
      frente: 'Recurso ordinario',
      verso: 'Cabimento em hipoteses constitucionais.',
      estado: 'revisando',
      due_date: '2026-05-19',
      materia_id: null,
      tags: ['processo', 'recursos']
    })
  ]
}

function criarCardsPaginacaoFlashcards(total = 25, sobrescritas = {}) {
  return Array.from({ length: total }, (_, indice) => {
    const numero = String(indice + 1).padStart(2, '0')
    return criarCardRevisao({
      id: `card-${numero}`,
      frente: `Card ${numero}`,
      verso: `Verso ${numero}`,
      estado: 'novo',
      due_date: '2026-05-20',
      ...(sobrescritas[indice + 1] || {})
    })
  })
}

function obterBotaoListaFlashcards(texto) {
  return [...document.querySelectorAll('#flashcards-lista button')]
    .find(botao => botao.textContent === texto)
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

  it('separa Revisar Hoje em Revisao Urgente e Estudo do Dia', () => {
    expect(appHtml).toContain('id="flashcards-revisao-urgente"')
    expect(appHtml).toContain('id="flashcards-resumo-vencimento"')
    expect(appHtml).toContain('Revisão Urgente')
    expect(appHtml).toContain('id="flashcards-estudo-dia"')
    expect(appHtml).toContain('Estudo do Dia')
    expect(appHtml).toContain('id="flashcards-estudo-dia-vazio"')
  })

  it('adiciona alerta de acumulo de flashcards vencidos', () => {
    expect(appHtml).toContain('id="flashcards-alerta-acumulo"')
    expect(appHtml).toContain('id="flashcards-alerta-acumulo-texto"')
    expect(appHtml).toContain('id="btn-revisar-alerta-flashcards"')
    expect(appHtml).toContain('Revisar agora')
  })

  it('adiciona filtros e busca em Todos os Cards', () => {
    expect(appHtml).toContain('id="flashcards-busca"')
    expect(appHtml).toContain('id="flashcards-filtro-estado"')
    expect(appHtml).toContain('id="flashcards-filtro-vencimento"')
    expect(appHtml).toContain('id="flashcards-filtro-tag"')
    expect(appHtml).toContain('id="flashcards-filtro-materia"')
    expect(appHtml).toContain('id="btn-limpar-filtros-flashcards"')
  })

  it('mantem placeholders da primeira versao visual', () => {
    expect(appHtml).toContain('Nenhuma revisão pendente. Ótimo trabalho!')
    expect(appHtml).toContain('Carregando estudo do dia...')
    expect(appHtml).toContain('id="flashcards-estudo-dia-lista"')
    expect(appHtml).toContain('Nenhum flashcard cadastrado ainda.')
    expect(appHtml).toContain('id="flashcard-frente"')
    expect(appHtml).toContain('id="flashcard-verso"')
    expect(appHtml).toContain('id="flashcard-tags"')
    expect(appHtml).toContain('id="flashcard-materia"')
    expect(appHtml).toContain('Total de cards')
    expect(appHtml).toContain('Cards para hoje')
    expect(appHtml).toContain('id="flashcards-cards-atrasados"')
    expect(appHtml).toContain('id="flashcards-cards-para-hoje"')
    expect(appHtml).toContain('Taxa de acerto')
    expect(appHtml).toContain('Sequ')
  })

  it('botao Salvar Card existe e esta funcional para a etapa de cadastro', () => {
    expect(appHtml).toContain('id="btn-salvar-flashcard"')
    expect(appHtml).toContain('Salvar Card')
    expect(appHtml).not.toContain('id="btn-salvar-flashcard" type="button" disabled')
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

  it('inicializador mantem Revisar Hoje e carrega Todos os Cards apenas ao abrir a aba', async () => {
    const cardRico = criarCardRevisao({
      id: 'card-rico',
      frente: 'Frente lazy',
      verso: `VERSO:
Resposta principal.

CONTEXTO:
Contexto util.

RECONHECER:
Pista de prova.

ALERTA DE BANCA:
Alerta importante.`
    })
    const listarCards = vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({
      data: [cardRico],
      error: null
    })
    const listarDevidosHoje = vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
      data: [criarCardRevisao({ id: 'revisao-hoje' })],
      error: null
    })
    vi.spyOn(globalThis, 'listarMateriasPlanejadasHojeFlashcards').mockResolvedValue({ data: [], error: null })
    vi.spyOn(globalThis, 'listarMateriasFlashcards').mockResolvedValue({ data: [], error: null })

    document.body.innerHTML = `
      <section id="secao-flashcards">
        <button class="flashcards-aba" data-flashcards-aba="revisar-hoje" aria-selected="false"></button>
        <button class="flashcards-aba" data-flashcards-aba="todos" aria-selected="false"></button>
        <div class="flashcards-painel" id="flashcards-painel-revisar-hoje" hidden>
          <span id="flashcards-pendentes-hoje"></span>
          <p id="flashcards-progresso-sessao"></p>
          <p id="flashcards-resumo-vencimento"></p>
          <p id="flashcards-revisar-vazio"></p>
          <div id="flashcards-revisao-card"></div>
          <button id="btn-iniciar-revisao-flashcards" type="button" disabled>Iniciar revisao</button>
          <span id="flashcards-estudo-dia-status"></span>
          <p id="flashcards-estudo-dia-vazio"></p>
          <div id="flashcards-estudo-dia-lista"></div>
        </div>
        <div class="flashcards-painel" id="flashcards-painel-todos" hidden>
          <div id="flashcards-lista"></div>
        </div>
        <div id="flashcards-alerta-acumulo" hidden>
          <p id="flashcards-alerta-acumulo-texto"></p>
        </div>
        <strong id="flashcards-total-cards"></strong>
        <strong id="flashcards-cards-hoje"></strong>
        <strong id="flashcards-taxa-acerto"></strong>
        <strong id="flashcards-sequencia-estudos"></strong>
      </section>
    `

    expect(() => inicializarFlashcards()).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()

    expect(document.getElementById('flashcards-painel-revisar-hoje').hidden).toBe(false)
    expect(document.querySelector('[data-flashcards-aba="revisar-hoje"]').getAttribute('aria-selected')).toBe('true')
    expect(listarDevidosHoje).toHaveBeenCalled()
    expect(document.getElementById('flashcards-lista').textContent).toBe('')

    expect(listarCards).not.toHaveBeenCalled()
    document.querySelector('[data-flashcards-aba="todos"]').click()

    expect(document.getElementById('flashcards-lista').textContent).toContain('Carregando flashcards...')
    await Promise.resolve()
    await Promise.resolve()

    expect(listarCards).toHaveBeenCalledTimes(1)
    expect(document.getElementById('flashcards-painel-revisar-hoje').hidden).toBe(true)
    expect(document.getElementById('flashcards-painel-todos').hidden).toBe(false)
    expect(document.querySelector('[data-flashcards-aba="todos"]').getAttribute('aria-selected')).toBe('true')
    expect(document.getElementById('flashcards-lista').textContent).toContain('Frente lazy')
    expect(document.getElementById('flashcards-lista').textContent).toContain('Contexto util.')
    expect(document.getElementById('flashcards-lista').textContent).toContain('Pista de prova.')
    expect(document.getElementById('flashcards-lista').textContent).toContain('Alerta importante.')
  })

  it('continua expondo as funcoes de dados existentes', () => {
    expect(globalThis.salvarFlashcardTela).toBe(salvarFlashcardTela)
    expect(globalThis.carregarListaFlashcards).toBe(carregarListaFlashcards)
    expect(globalThis.renderizarListaFlashcards).toBe(renderizarListaFlashcards)
    expect(globalThis.carregarFlashcardsRevisarHoje).toBe(carregarFlashcardsRevisarHoje)
    expect(globalThis.iniciarSessaoRevisaoFlashcards).toBe(iniciarSessaoRevisaoFlashcards)
    expect(globalThis.mostrarRespostaFlashcardAtual).toBe(mostrarRespostaFlashcardAtual)
    expect(globalThis.avaliarFlashcardAtual).toBe(avaliarFlashcardAtual)
    expect(globalThis.carregarEstudoDiaFlashcards).toBe(carregarEstudoDiaFlashcards)
    expect(globalThis.carregarAlertaAcumuloFlashcards).toBe(carregarAlertaAcumuloFlashcards)
    expect(globalThis.contarCardsAcumuladosFlashcards).toBe(contarCardsAcumuladosFlashcards)
    expect(globalThis.navegarParaRevisaoUrgenteFlashcards).toBe(navegarParaRevisaoUrgenteFlashcards)
    expect(globalThis.renderizarAlertaAcumuloFlashcards).toBe(renderizarAlertaAcumuloFlashcards)
    expect(globalThis.selecionarCardsNovosEstudoDiaFlashcards).toBe(selecionarCardsNovosEstudoDiaFlashcards)
    expect(globalThis.calcularProximaRevisaoSM2Flashcards).toBe(calcularProximaRevisaoSM2Flashcards)
    expect(globalThis.calcularEstatisticasFlashcards).toBe(calcularEstatisticasFlashcards)
    expect(globalThis.renderizarEstatisticasFlashcards).toBe(renderizarEstatisticasFlashcards)
    expect(globalThis.carregarEstatisticasFlashcards).toBe(carregarEstatisticasFlashcards)
    expect(globalThis.criarFlashcard).toBe(criarFlashcard)
    expect(globalThis.listarFlashcards).toBe(listarFlashcards)
    expect(globalThis.listarMateriasPlanejadasHojeFlashcards).toBe(listarMateriasPlanejadasHojeFlashcards)
    expect(globalThis.listarFlashcardsDevidosHoje).toBe(listarFlashcardsDevidosHoje)
    expect(globalThis.listarRevisoesFlashcards).toBe(listarRevisoesFlashcards)
    expect(globalThis.listarMateriasFlashcards).toBe(listarMateriasFlashcards)
    expect(globalThis.carregarMateriasFlashcards).toBe(carregarMateriasFlashcards)
    expect(globalThis.atualizarFlashcard).toBe(atualizarFlashcard)
    expect(globalThis.desativarFlashcard).toBe(desativarFlashcard)
    expect(globalThis.registrarRevisaoFlashcard).toBe(registrarRevisaoFlashcard)
  })

  it('frente vazia impede salvamento pela tela', async () => {
    montarFormularioFlashcards()
    document.getElementById('flashcard-verso').value = 'Verso'
    const criar = vi.spyOn(globalThis, 'criarFlashcard')

    const resultado = await salvarFlashcardTela()

    expect(resultado.error.message).toBe('Informe a frente do flashcard.')
    expect(document.getElementById('msg-flashcards').textContent).toBe('Informe a frente do flashcard.')
    expect(criar).not.toHaveBeenCalled()
  })

  it('verso vazio impede salvamento pela tela', async () => {
    montarFormularioFlashcards()
    document.getElementById('flashcard-frente').value = 'Frente'
    const criar = vi.spyOn(globalThis, 'criarFlashcard')

    const resultado = await salvarFlashcardTela()

    expect(resultado.error.message).toBe('Informe o verso do flashcard.')
    expect(document.getElementById('msg-flashcards').textContent).toBe('Informe o verso do flashcard.')
    expect(criar).not.toHaveBeenCalled()
  })

  it('salva card com frente, verso e tags sem enviar user_id do formulario', async () => {
    montarFormularioFlashcards()
    document.getElementById('flashcard-frente').value = ' Frente '
    document.getElementById('flashcard-verso').value = ' Verso '
    document.getElementById('flashcard-tags').value = ' constitucional, , prazos '
    const criar = vi.spyOn(globalThis, 'criarFlashcard').mockResolvedValue({
      data: { id: 'card-1' },
      error: null
    })
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({
      data: [{ id: 'card-1', frente: 'Frente', verso: 'Verso', estado: 'novo', due_date: '2026-05-21', tags: ['constitucional'] }],
      error: null
    })

    const resultado = await salvarFlashcardTela()

    expect(resultado.error).toBeNull()
    expect(criar).toHaveBeenCalledWith({
      frente: 'Frente',
      verso: 'Verso',
      tags: ['constitucional', 'prazos']
    })
    expect(criar.mock.calls[0][0]).not.toHaveProperty('user_id')
    expect(document.getElementById('flashcard-frente').value).toBe('')
    expect(document.getElementById('flashcard-verso').value).toBe('')
    expect(document.getElementById('flashcard-tags').value).toBe('')
    expect(document.getElementById('flashcard-materia').value).toBe('')
    expect(document.getElementById('msg-flashcards').textContent).toBe('Flashcard salvo com sucesso!')
    expect(document.getElementById('flashcards-lista').textContent).toContain('Frente')
  })

  it('salva card com materia enviando materia_id', async () => {
    montarFormularioFlashcards()
    document.getElementById('flashcard-frente').value = 'Frente'
    document.getElementById('flashcard-verso').value = 'Verso'
    document.getElementById('flashcard-materia').value = 'mat-1'
    const criar = vi.spyOn(globalThis, 'criarFlashcard').mockResolvedValue({
      data: { id: 'card-1' },
      error: null
    })
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({ data: [], error: null })

    await salvarFlashcardTela()

    expect(criar).toHaveBeenCalledWith({
      frente: 'Frente',
      verso: 'Verso',
      tags: [],
      materia_id: 'mat-1'
    })
    expect(criar.mock.calls[0][0]).not.toHaveProperty('user_id')
  })

  it('lista Todos os Cards renderiza cards retornados', () => {
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))
    document.body.innerHTML = '<div id="flashcards-lista"></div>'

    renderizarListaFlashcards([
      {
        id: 'card-1',
        frente: 'Frente do card',
        verso: 'Verso do card',
        estado: 'novo',
        due_date: '2026-05-21',
        materia_id: 'mat-1',
        materias: { nome: 'Direito Constitucional' },
        tags: ['constitucional', 'prazos']
      }
    ])

    const texto = document.getElementById('flashcards-lista').textContent
    expect(texto).toContain('Frente do card')
    expect(texto).toContain('Verso do card')
    expect(texto).toContain('Estado: novo')
    expect(texto).toContain('Proxima revisao: amanhã (2026-05-21)')
    expect(texto).toContain('Tags: constitucional, prazos')
    expect(texto).toContain('Matéria: Direito Constitucional')
  })

  it('Todos os Cards mostra Sem matéria quando o card nao tem materia', () => {
    document.body.innerHTML = '<div id="flashcards-lista"></div>'

    renderizarListaFlashcards([
      criarCardRevisao({
        id: 'card-sem-materia',
        frente: 'Card sem materia',
        materia_id: null
      })
    ])

    expect(document.getElementById('flashcards-lista').textContent).toContain('Matéria: Sem matéria')
  })

  it('Todos os Cards exibe proxima revisao em texto amigavel', () => {
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))
    document.body.innerHTML = '<div id="flashcards-lista"></div>'

    renderizarListaFlashcards([
      criarCardRevisao({ id: 'hoje', frente: 'Hoje', due_date: '2026-05-20' }),
      criarCardRevisao({ id: 'amanha', frente: 'Amanha', due_date: '2026-05-21' }),
      criarCardRevisao({ id: 'futuro', frente: 'Futuro', due_date: '2026-05-23' }),
      criarCardRevisao({ id: 'atrasado-1', frente: 'Atrasado 1', due_date: '2026-05-19' }),
      criarCardRevisao({ id: 'atrasado-2', frente: 'Atrasado 2', due_date: '2026-05-18' }),
      criarCardRevisao({ id: 'sem-data', frente: 'Sem data', due_date: null })
    ])

    const texto = document.getElementById('flashcards-lista').textContent
    expect(texto).toContain('Proxima revisao: hoje (2026-05-20)')
    expect(texto).toContain('Proxima revisao: amanhã (2026-05-21)')
    expect(texto).toContain('Proxima revisao: em 3 dias (2026-05-23)')
    expect(texto).toContain('Proxima revisao: atrasado há 1 dia (2026-05-19)')
    expect(texto).toContain('Proxima revisao: atrasado há 2 dias (2026-05-18)')
    expect(texto).toContain('Proxima revisao: sem data definida')
  })

  it('Todos os Cards mostra botoes Editar e Desativar', () => {
    document.body.innerHTML = '<div id="flashcards-lista"></div>'

    renderizarListaFlashcards([
      criarCardRevisao({
        id: 'card-1',
        frente: 'Frente do card',
        verso: 'Verso do card',
        tags: ['tag']
      })
    ])

    const botoes = [...document.querySelectorAll('#flashcards-lista button')].map(botao => botao.textContent)
    expect(botoes).toContain('Editar')
    expect(botoes).toContain('Desativar')
  })

  it('Editar abre formulario com dados atuais', () => {
    document.body.innerHTML = '<div id="flashcards-lista"></div>'
    const card = criarCardRevisao({
      id: 'card-1',
      frente: 'Frente atual',
      verso: 'Verso atual',
      tags: ['constitucional', 'prazos']
    })

    renderizarListaFlashcards([card])
    document.querySelector('#flashcards-lista button').click()

    expect(document.querySelector('[data-flashcard-edicao="frente"]').value).toBe('Frente atual')
    expect(document.querySelector('[data-flashcard-edicao="verso"]').value).toBe('Verso atual')
    expect(document.querySelector('[data-flashcard-edicao="tags"]').value).toBe('constitucional, prazos')
  })

  it('Editar frente, verso e tags chama atualizarFlashcard sem enviar user_id', async () => {
    montarFormularioFlashcards()
    const card = criarCardRevisao({
      id: 'card-1',
      frente: 'Frente atual',
      verso: 'Verso atual',
      tags: ['antiga']
    })
    renderizarListaFlashcards([card])
    const item = document.querySelector('[data-flashcard-id="card-1"]')
    abrirEdicaoFlashcardLista(card, item)

    document.querySelector('[data-flashcard-edicao="frente"]').value = ' Nova frente '
    document.querySelector('[data-flashcard-edicao="verso"]').value = ' Novo verso '
    document.querySelector('[data-flashcard-edicao="tags"]').value = ' nova, , revisao '
    const atualizar = vi.spyOn(globalThis, 'atualizarFlashcard').mockResolvedValue({
      data: { id: 'card-1' },
      error: null
    })
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({
      data: [criarCardRevisao({ id: 'card-1', frente: 'Nova frente', verso: 'Novo verso', tags: ['nova'] })],
      error: null
    })

    const resultado = await salvarEdicaoFlashcardLista('card-1', item)

    expect(resultado.error).toBeNull()
    expect(atualizar).toHaveBeenCalledWith('card-1', {
      frente: 'Nova frente',
      verso: 'Novo verso',
      tags: ['nova', 'revisao']
    })
    expect(atualizar.mock.calls[0][1]).not.toHaveProperty('user_id')
    expect(document.getElementById('flashcards-lista').textContent).toContain('Nova frente')
    expect(document.getElementById('msg-flashcards-lista').textContent).toBe('Flashcard atualizado com sucesso.')
  })

  it('Frente vazia impede salvar edicao', async () => {
    document.body.innerHTML = '<div id="flashcards-lista"></div>'
    const card = criarCardRevisao({ id: 'card-1' })
    renderizarListaFlashcards([card])
    const item = document.querySelector('[data-flashcard-id="card-1"]')
    abrirEdicaoFlashcardLista(card, item)
    document.querySelector('[data-flashcard-edicao="frente"]').value = '   '
    const atualizar = vi.spyOn(globalThis, 'atualizarFlashcard')

    const resultado = await salvarEdicaoFlashcardLista('card-1', item)

    expect(resultado.error.message).toBe('Informe a frente do flashcard.')
    expect(atualizar).not.toHaveBeenCalled()
    expect(item.textContent).toContain('Informe a frente do flashcard.')
  })

  it('Verso vazio impede salvar edicao', async () => {
    document.body.innerHTML = '<div id="flashcards-lista"></div>'
    const card = criarCardRevisao({ id: 'card-1' })
    renderizarListaFlashcards([card])
    const item = document.querySelector('[data-flashcard-id="card-1"]')
    abrirEdicaoFlashcardLista(card, item)
    document.querySelector('[data-flashcard-edicao="verso"]').value = '   '
    const atualizar = vi.spyOn(globalThis, 'atualizarFlashcard')

    const resultado = await salvarEdicaoFlashcardLista('card-1', item)

    expect(resultado.error.message).toBe('Informe o verso do flashcard.')
    expect(atualizar).not.toHaveBeenCalled()
    expect(item.textContent).toContain('Informe o verso do flashcard.')
  })

  it('Desativar pede confirmacao antes de chamar desativarFlashcard', () => {
    document.body.innerHTML = '<div id="flashcards-lista"></div>'
    const card = criarCardRevisao({ id: 'card-1' })
    renderizarListaFlashcards([card])
    const desativar = vi.spyOn(globalThis, 'desativarFlashcard')

    const botaoDesativar = [...document.querySelectorAll('#flashcards-lista button')]
      .find(botao => botao.textContent === 'Desativar')
    botaoDesativar.click()

    expect(document.getElementById('flashcards-lista').textContent).toContain('Desativar este flashcard?')
    expect(desativar).not.toHaveBeenCalled()
  })

  it('desativarFlashcard e chamado ao confirmar e o card sai da lista', async () => {
    montarFormularioFlashcards()
    const card = criarCardRevisao({ id: 'card-1', frente: 'Frente para desativar' })
    renderizarListaFlashcards([card])
    const item = document.querySelector('[data-flashcard-id="card-1"]')
    mostrarConfirmacaoDesativarFlashcardLista(card, item)
    const desativar = vi.spyOn(globalThis, 'desativarFlashcard').mockResolvedValue({
      data: { id: 'card-1', ativo: false },
      error: null
    })
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({
      data: [],
      error: null
    })

    const resultado = await confirmarDesativacaoFlashcardLista('card-1', item)

    expect(resultado.error).toBeNull()
    expect(desativar).toHaveBeenCalledWith('card-1')
    expect(document.getElementById('flashcards-lista').textContent).not.toContain('Frente para desativar')
    expect(document.getElementById('msg-flashcards-lista').textContent).toBe('Flashcard desativado com sucesso.')
  })

  it('erro ao atualizar flashcard mostra mensagem amigavel', async () => {
    document.body.innerHTML = '<div id="flashcards-lista"></div>'
    const card = criarCardRevisao({ id: 'card-1' })
    renderizarListaFlashcards([card])
    const item = document.querySelector('[data-flashcard-id="card-1"]')
    abrirEdicaoFlashcardLista(card, item)
    vi.spyOn(globalThis, 'atualizarFlashcard').mockResolvedValue({
      data: null,
      error: new Error('Nao foi possivel atualizar o flashcard.')
    })

    const resultado = await salvarEdicaoFlashcardLista('card-1', item)

    expect(resultado.error.message).toBe('Nao foi possivel atualizar o flashcard.')
    expect(item.textContent).toContain('Nao foi possivel atualizar o flashcard.')
  })

  it('card desativado nao aparece na lista de cards ativos', () => {
    document.body.innerHTML = '<div id="flashcards-lista"></div>'

    renderizarListaFlashcards([
      criarCardRevisao({ id: 'card-ativo', frente: 'Card ativo', ativo: true }),
      criarCardRevisao({ id: 'card-inativo', frente: 'Card inativo', ativo: false })
    ])

    expect(document.getElementById('flashcards-lista').textContent).toContain('Card ativo')
    expect(document.getElementById('flashcards-lista').textContent).not.toContain('Card inativo')
  })

  it('extrai campos ricos de verso estruturado', () => {
    const campos = extrairCamposRicosDoVersoFlashcard(`VERSO:
Resposta principal.

CONTEXTO:
Questao com padrao de cobranca.

RECONHECER:
Procure a pista central.

ALERTA DE BANCA:
Nao confundir os institutos.`)

    expect(campos).toEqual({
      estruturado: true,
      verso: 'Resposta principal.',
      contexto: 'Questao com padrao de cobranca.',
      reconhecer: 'Procure a pista central.',
      alertaBanca: 'Nao confundir os institutos.'
    })
  })

  it('mantem fallback para verso antigo sem rotulos', () => {
    const campos = extrairCamposRicosDoVersoFlashcard('Resposta antiga sem campos ricos.')

    expect(campos).toEqual({
      estruturado: false,
      verso: 'Resposta antiga sem campos ricos.',
      contexto: '',
      reconhecer: '',
      alertaBanca: ''
    })
  })

  it('renderiza campos ricos na lista sem perder o verso principal', () => {
    document.body.innerHTML = '<div id="flashcards-lista"></div>'

    renderizarListaFlashcards([
      criarCardRevisao({
        id: 'card-rico',
        verso: `VERSO:
Resposta principal.

CONTEXTO:
Contexto util.

RECONHECER:
Pista de prova.

ALERTA DE BANCA:
Alerta importante.`
      })
    ])

    const texto = document.getElementById('flashcards-lista').textContent
    expect(texto).toContain('Resposta principal.')
    expect(texto).toContain('Contexto')
    expect(texto).toContain('Contexto util.')
    expect(texto).toContain('Como reconhecer')
    expect(texto).toContain('Pista de prova.')
    expect(texto).toContain('Alerta de banca')
    expect(texto).toContain('Alerta importante.')
  })

  it('renderiza verso antigo normalmente na lista', () => {
    document.body.innerHTML = '<div id="flashcards-lista"></div>'

    renderizarListaFlashcards([
      criarCardRevisao({ id: 'card-antigo', verso: 'Verso antigo simples.' })
    ])

    const texto = document.getElementById('flashcards-lista').textContent
    expect(texto).toContain('Verso antigo simples.')
    expect(texto).not.toContain('Como reconhecer')
    expect(texto).not.toContain('Alerta de banca')
  })

  it('busca encontra card pela frente', () => {
    const resultado = aplicarFiltrosFlashcards(criarCardsFiltroFlashcards(), {
      busca: 'controle',
      estado: 'todos',
      vencimento: 'todos',
      tag: ''
    })

    expect(resultado.map(card => card.id)).toEqual(['card-novo'])
  })

  it('busca encontra card pelo verso', () => {
    const resultado = aplicarFiltrosFlashcards(criarCardsFiltroFlashcards(), {
      busca: 'dias uteis',
      estado: 'todos',
      vencimento: 'todos',
      tag: ''
    })

    expect(resultado.map(card => card.id)).toEqual(['card-aprendendo'])
  })

  it('busca encontra card pela tag', () => {
    const resultado = aplicarFiltrosFlashcards(criarCardsFiltroFlashcards(), {
      busca: 'recursos',
      estado: 'todos',
      vencimento: 'todos',
      tag: ''
    })

    expect(resultado.map(card => card.id)).toEqual(['card-revisando'])
  })

  it('filtro por estado novo funciona', () => {
    const resultado = aplicarFiltrosFlashcards(criarCardsFiltroFlashcards(), {
      busca: '',
      estado: 'novo',
      vencimento: 'todos',
      tag: ''
    })

    expect(resultado.map(card => card.id)).toEqual(['card-novo'])
  })

  it('filtro por estado aprendendo funciona', () => {
    const resultado = aplicarFiltrosFlashcards(criarCardsFiltroFlashcards(), {
      busca: '',
      estado: 'aprendendo',
      vencimento: 'todos',
      tag: ''
    })

    expect(resultado.map(card => card.id)).toEqual(['card-aprendendo'])
  })

  it('filtro por estado revisando funciona', () => {
    const resultado = aplicarFiltrosFlashcards(criarCardsFiltroFlashcards(), {
      busca: '',
      estado: 'revisando',
      vencimento: 'todos',
      tag: ''
    })

    expect(resultado.map(card => card.id)).toEqual(['card-revisando'])
  })

  it('filtro para hoje considera due_date menor ou igual a hoje', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))

    const resultado = aplicarFiltrosFlashcards(criarCardsFiltroFlashcards(), {
      busca: '',
      estado: 'todos',
      vencimento: 'hoje',
      tag: ''
    })

    expect(resultado.map(card => card.id)).toEqual(['card-novo', 'card-revisando'])
  })

  it('filtro futuros considera due_date maior que hoje', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))

    const resultado = aplicarFiltrosFlashcards(criarCardsFiltroFlashcards(), {
      busca: '',
      estado: 'todos',
      vencimento: 'futuros',
      tag: ''
    })

    expect(resultado.map(card => card.id)).toEqual(['card-aprendendo'])
  })

  it('filtro por tag funciona pelo campo especifico', () => {
    const resultado = aplicarFiltrosFlashcards(criarCardsFiltroFlashcards(), {
      busca: '',
      estado: 'todos',
      vencimento: 'todos',
      tag: 'prazos',
      materia: 'todos'
    })

    expect(resultado.map(card => card.id)).toEqual(['card-aprendendo'])
  })

  it('filtro por materia funciona', () => {
    const resultado = aplicarFiltrosFlashcards(criarCardsFiltroFlashcards(), {
      busca: '',
      estado: 'todos',
      vencimento: 'todos',
      tag: '',
      materia: 'mat-1'
    })

    expect(resultado.map(card => card.id)).toEqual(['card-novo'])
  })

  it('filtro por Sem matéria funciona', () => {
    const resultado = aplicarFiltrosFlashcards(criarCardsFiltroFlashcards(), {
      busca: '',
      estado: 'todos',
      vencimento: 'todos',
      tag: '',
      materia: 'sem-materia'
    })

    expect(resultado.map(card => card.id)).toEqual(['card-revisando'])
  })

  it('mensagem aparece quando nenhum card corresponde aos filtros', async () => {
    montarListaFlashcardsComFiltros()
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({
      data: criarCardsFiltroFlashcards(),
      error: null
    })

    await carregarListaFlashcards()
    document.getElementById('flashcards-busca').value = 'inexistente'
    renderizarListaFlashcardsFiltrada()

    expect(document.getElementById('flashcards-lista').textContent).toBe('Nenhum flashcard encontrado com os filtros atuais.')
  })

  it('limpar filtros restaura a lista completa de cards ativos', async () => {
    montarListaFlashcardsComFiltros()
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({
      data: criarCardsFiltroFlashcards(),
      error: null
    })

    await carregarListaFlashcards()
    document.getElementById('flashcards-busca').value = 'controle'
    renderizarListaFlashcardsFiltrada()

    expect(document.getElementById('flashcards-lista').textContent).toContain('Controle difuso')
    expect(document.getElementById('flashcards-lista').textContent).not.toContain('Prazo administrativo')

    limparFiltrosFlashcards()

    expect(document.getElementById('flashcards-busca').value).toBe('')
    expect(document.getElementById('flashcards-filtro-estado').value).toBe('todos')
    expect(document.getElementById('flashcards-filtro-vencimento').value).toBe('todos')
    expect(document.getElementById('flashcards-filtro-tag').value).toBe('')
    expect(document.getElementById('flashcards-filtro-materia').value).toBe('todos')
    expect(document.getElementById('flashcards-lista').textContent).toContain('Controle difuso')
    expect(document.getElementById('flashcards-lista').textContent).toContain('Prazo administrativo')
    expect(document.getElementById('flashcards-lista').textContent).toContain('Recurso ordinario')
  })

  it('pagina Todos os Cards em grupos de 20 e navega entre paginas', async () => {
    montarListaFlashcardsComFiltros()
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({
      data: criarCardsPaginacaoFlashcards(25, {
        21: {
          verso: `VERSO:
Resposta da pagina 2.

CONTEXTO:
Contexto da pagina 2.

RECONHECER:
Pista da pagina 2.

ALERTA DE BANCA:
Alerta da pagina 2.`
        }
      }),
      error: null
    })

    await carregarListaFlashcards()

    let texto = document.getElementById('flashcards-lista').textContent
    expect(texto).toContain('Card 01')
    expect(texto).toContain('Card 20')
    expect(texto).not.toContain('Card 21')
    expect(texto).toContain('Pagina 1 de 2')
    expect(texto).toContain('Mostrando 1-20 de 25 cards')
    expect(obterBotaoListaFlashcards('Anterior').disabled).toBe(true)

    obterBotaoListaFlashcards('Proxima').click()

    texto = document.getElementById('flashcards-lista').textContent
    expect(texto).not.toContain('Card 20')
    expect(texto).toContain('Card 21')
    expect(texto).toContain('Card 25')
    expect(texto).toContain('Pagina 2 de 2')
    expect(texto).toContain('Mostrando 21-25 de 25 cards')
    expect(texto).toContain('Contexto da pagina 2.')
    expect(texto).toContain('Pista da pagina 2.')
    expect(texto).toContain('Alerta da pagina 2.')
    expect(obterBotaoListaFlashcards('Proxima').disabled).toBe(true)

    obterBotaoListaFlashcards('Anterior').click()

    texto = document.getElementById('flashcards-lista').textContent
    expect(texto).toContain('Card 01')
    expect(texto).toContain('Pagina 1 de 2')
  })

  it('reseta para a primeira pagina ao buscar ou filtrar', async () => {
    montarListaFlashcardsComFiltros()
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({
      data: criarCardsPaginacaoFlashcards(25),
      error: null
    })

    await carregarListaFlashcards()
    obterBotaoListaFlashcards('Proxima').click()

    expect(document.getElementById('flashcards-lista').textContent).toContain('Pagina 2 de 2')

    document.getElementById('flashcards-busca').value = 'Card 01'
    renderizarListaFlashcardsFiltrada()

    const texto = document.getElementById('flashcards-lista').textContent
    expect(texto).toContain('Card 01')
    expect(texto).not.toContain('Card 21')
    expect(texto).toContain('Pagina 1 de 1')
    expect(texto).toContain('Mostrando 1-1 de 1 cards')
  })

  it('carrega lista de materias nos selects de flashcards', async () => {
    montarFormularioFlashcards()
    document.getElementById('secao-flashcards').insertAdjacentHTML('beforeend', `
      <select id="flashcards-filtro-materia">
        <option value="todos">Todas as matérias</option>
      </select>
    `)
    vi.spyOn(globalThis, 'listarMateriasFlashcards').mockResolvedValue({
      data: [
        { id: 'mat-1', nome: 'Direito Constitucional' },
        { id: 'mat-2', nome: 'Direito Administrativo' }
      ],
      error: null
    })

    const resultado = await carregarMateriasFlashcards()

    expect(resultado.error).toBeNull()
    expect([...document.getElementById('flashcard-materia').options].map(option => option.textContent)).toEqual([
      'Sem matéria',
      'Direito Constitucional',
      'Direito Administrativo'
    ])
    expect([...document.getElementById('flashcards-filtro-materia').options].map(option => option.textContent)).toEqual([
      'Todas as matérias',
      'Sem matéria',
      'Direito Constitucional',
      'Direito Administrativo'
    ])
  })

  it('falha ao carregar materias usa fallback seguro', async () => {
    montarFormularioFlashcards()
    vi.spyOn(globalThis, 'listarMateriasFlashcards').mockResolvedValue({
      data: null,
      error: new Error('falha')
    })

    const resultado = await carregarMateriasFlashcards()

    expect(resultado.error.message).toBe('falha')
    expect([...document.getElementById('flashcard-materia').options].map(option => option.textContent)).toEqual(['Sem matéria'])
  })

  it('lista vazia mostra mensagem correta', () => {
    document.body.innerHTML = '<div id="flashcards-lista"></div>'

    renderizarListaFlashcards([])

    expect(document.getElementById('flashcards-lista').textContent).toBe('Nenhum flashcard cadastrado ainda.')
  })

  it('erro do Supabase mostra mensagem amigavel na tela', async () => {
    montarFormularioFlashcards()
    document.getElementById('flashcard-frente').value = 'Frente'
    document.getElementById('flashcard-verso').value = 'Verso'
    vi.spyOn(globalThis, 'criarFlashcard').mockResolvedValue({
      data: null,
      error: new Error('Nao foi possivel criar o flashcard. Verifique sua conexao e tente novamente.')
    })

    const resultado = await salvarFlashcardTela()

    expect(resultado.error.message).toBe('Nao foi possivel criar o flashcard. Verifique sua conexao e tente novamente.')
    expect(document.getElementById('msg-flashcards').textContent).toBe('Nao foi possivel criar o flashcard. Verifique sua conexao e tente novamente.')
    expect(document.getElementById('flashcard-frente').value).toBe('Frente')
  })

  it('Revisar Hoje renderiza apenas cards ativos com due_date menor ou igual a hoje', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
      data: [
        criarCardRevisao({ id: 'card-devido', frente: 'Card devido' }),
        criarCardRevisao({ id: 'card-futuro', frente: 'Card futuro', due_date: '2026-05-21' }),
        criarCardRevisao({ id: 'card-inativo', frente: 'Card inativo', ativo: false })
      ],
      error: null
    })

    const resultado = await carregarFlashcardsRevisarHoje()

    expect(resultado.data.map(card => card.id)).toEqual(['card-devido'])
    expect(document.getElementById('flashcards-pendentes-hoje').textContent).toBe('1 cards vencidos/devidos')
    expect(document.getElementById('flashcards-resumo-vencimento').textContent).toBe('0 atrasado(s) · 1 para hoje')
    expect(document.getElementById('btn-iniciar-revisao-flashcards').disabled).toBe(false)

    iniciarSessaoRevisaoFlashcards()

    expect(document.getElementById('flashcards-revisao-card').textContent).toContain('Card devido')
    expect(document.getElementById('flashcards-revisao-card').textContent).not.toContain('Card futuro')
    expect(document.getElementById('flashcards-revisao-card').textContent).not.toContain('Card inativo')
  })

  it('Revisao Urgente separa visualmente cards atrasados e para hoje', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
      data: [
        criarCardRevisao({ id: 'atrasado', due_date: '2026-05-18' }),
        criarCardRevisao({ id: 'hoje', due_date: '2026-05-20' }),
        criarCardRevisao({ id: 'futuro', due_date: '2026-05-21' })
      ],
      error: null
    })

    await carregarFlashcardsRevisarHoje()

    expect(document.getElementById('flashcards-pendentes-hoje').textContent).toBe('2 cards vencidos/devidos')
    expect(document.getElementById('flashcards-resumo-vencimento').textContent).toBe('1 atrasado(s) · 1 para hoje')
  })

  it('Revisao Urgente inclui cards devidos de qualquer materia e estado', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
      data: [
        criarCardRevisao({ id: 'novo-materia-1', estado: 'novo', materia_id: 'mat-1' }),
        criarCardRevisao({ id: 'aprendendo-materia-2', estado: 'aprendendo', materia_id: 'mat-2' }),
        criarCardRevisao({ id: 'revisando-sem-materia', estado: 'revisando', materia_id: null })
      ],
      error: null
    })

    const resultado = await carregarFlashcardsRevisarHoje()

    expect(resultado.data.map(card => card.id).sort()).toEqual([
      'aprendendo-materia-2',
      'novo-materia-1',
      'revisando-sem-materia'
    ])
    expect(document.getElementById('flashcards-pendentes-hoje').textContent).toBe('3 cards vencidos/devidos')
  })

  it('botao Mostrar resposta revela o verso e os botoes de avaliacao', async () => {
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
      data: [criarCardRevisao()],
      error: null
    })

    await carregarFlashcardsRevisarHoje()
    iniciarSessaoRevisaoFlashcards()

    expect(document.getElementById('flashcards-verso-atual').hidden).toBe(true)
    mostrarRespostaFlashcardAtual()

    expect(document.getElementById('flashcards-verso-atual').hidden).toBe(false)
    expect(document.getElementById('flashcards-verso-atual').textContent).toContain('Verso do card')
    expect(document.getElementById('flashcards-avaliacao-atual').textContent).toContain('Como avaliar:')
    expect(document.getElementById('flashcards-avaliacao-atual').textContent).toContain('0-2: errei ou não lembrei')
    expect(document.querySelectorAll('[data-flashcard-quality]')).toHaveLength(6)
  })

  it.each([0, 1, 2])(
    'avaliacao quality %s marca dueAgainToday e recoloca o card na fila',
    async (quality) => {
      montarSecaoRevisaoFlashcards()
      const card = criarCardRevisao({ id: `card-${quality}` })
      vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
        data: [card],
        error: null
      })
      const registrar = vi.spyOn(globalThis, 'registrarRevisaoFlashcard').mockResolvedValue({
        data: { flashcard: card },
        error: null
      })

      await carregarFlashcardsRevisarHoje()
      iniciarSessaoRevisaoFlashcards()
      const resultado = await avaliarFlashcardAtual(quality)

      expect(resultado.error).toBeNull()
      expect(registrar).toHaveBeenCalledWith(card.id, expect.objectContaining({
        quality,
        dueAgainToday: true,
        wasCorrect: false,
        repetitions: 0,
        intervalDays: 1
      }))
      expect(document.getElementById('flashcards-pendentes-hoje').textContent).toBe('1 cards vencidos/devidos')
      expect(document.getElementById('flashcards-revisao-card').textContent).toContain('Frente do card')
    }
  )

  it.each([3, 4, 5])('avaliacao quality %s remove o card da sessao de hoje', async (quality) => {
    montarSecaoRevisaoFlashcards()
    const card = criarCardRevisao({ id: `card-${quality}` })
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
      data: [card],
      error: null
    })
    const registrar = vi.spyOn(globalThis, 'registrarRevisaoFlashcard').mockResolvedValue({
      data: { flashcard: { ...card, due_date: '2026-05-21' } },
      error: null
    })

    await carregarFlashcardsRevisarHoje()
    iniciarSessaoRevisaoFlashcards()
    await avaliarFlashcardAtual(quality)

    expect(registrar).toHaveBeenCalledWith(card.id, expect.objectContaining({
      quality,
      dueAgainToday: false,
      wasCorrect: true
    }))
    expect(document.getElementById('flashcards-pendentes-hoje').textContent).toBe('0 cards vencidos/devidos')
    expect(document.getElementById('flashcards-progresso-sessao').textContent).toBe('Progresso: 1/1')
    expect(document.getElementById('flashcards-revisar-vazio').textContent).toBe('Nenhuma revisão pendente. Ótimo trabalho!')
  })

  it('renderiza campos ricos na revisao sem quebrar os botoes de nota', async () => {
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
      data: [
        criarCardRevisao({
          id: 'card-rico',
          verso: `VERSO:
Resposta principal.

CONTEXTO:
Contexto util.

RECONHECER:
Pista de prova.

ALERTA DE BANCA:
Alerta importante.`
        })
      ],
      error: null
    })

    await carregarFlashcardsRevisarHoje()
    iniciarSessaoRevisaoFlashcards()
    mostrarRespostaFlashcardAtual()

    const area = document.getElementById('flashcards-revisao-card')
    expect(area.textContent).toContain('Resposta principal.')
    expect(area.textContent).toContain('Contexto util.')
    expect(area.textContent).toContain('Pista de prova.')
    expect(area.textContent).toContain('Alerta importante.')
    expect(area.querySelectorAll('[data-flashcard-quality]')).toHaveLength(6)
  })

  it('mostra mensagem de sessao vazia quando nao ha cards pendentes', async () => {
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
      data: [],
      error: null
    })

    await carregarFlashcardsRevisarHoje()

    expect(document.getElementById('flashcards-revisar-vazio').textContent).toBe('Nenhuma revisão pendente. Ótimo trabalho!')
    expect(document.getElementById('btn-iniciar-revisao-flashcards').disabled).toBe(true)
  })

  it('Estudo do Dia mostra mensagem quando nao ha materia planejada', async () => {
    montarSecaoRevisaoFlashcards()
    const listarCards = vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({ data: [], error: null })
    vi.spyOn(globalThis, 'listarMateriasPlanejadasHojeFlashcards').mockResolvedValue({ data: [], error: null })

    const resultado = await carregarEstudoDiaFlashcards()

    expect(resultado.data).toEqual([])
    expect(listarCards).not.toHaveBeenCalled()
    expect(document.getElementById('flashcards-estudo-dia-vazio').textContent).toBe('Nenhuma matéria programada para hoje. Configure seu planejamento.')
    expect(document.getElementById('flashcards-estudo-dia-lista').textContent).toBe('')
  })

  it('Estudo do Dia mostra mensagem quando ha materia planejada mas nao ha cards novos', async () => {
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarMateriasPlanejadasHojeFlashcards').mockResolvedValue({
      data: [{ materia_id: 'mat-1', materias: { nome: 'Direito Constitucional' } }],
      error: null
    })
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({
      data: [
        criarCardRevisao({ id: 'revisando', estado: 'revisando', materia_id: 'mat-1' }),
        criarCardRevisao({ id: 'aprendendo', estado: 'aprendendo', materia_id: 'mat-1' }),
        criarCardRevisao({ id: 'inativo', estado: 'novo', materia_id: 'mat-1', ativo: false }),
        criarCardRevisao({ id: 'outra-materia', estado: 'novo', materia_id: 'mat-2' })
      ],
      error: null
    })

    const resultado = await carregarEstudoDiaFlashcards()

    expect(resultado.data).toEqual([])
    expect(document.getElementById('flashcards-estudo-dia-vazio').textContent).toBe('Não há cards novos para as matérias planejadas hoje.')
    expect(document.getElementById('flashcards-estudo-dia-lista').textContent).toBe('')
  })

  it('Estudo do Dia lista somente cards novos das materias planejadas', async () => {
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarMateriasPlanejadasHojeFlashcards').mockResolvedValue({
      data: [
        { materia_id: 'mat-1', materias: { nome: 'Direito Constitucional' } },
        { materia_id: 'mat-2', materias: { nome: 'Direito Administrativo' } }
      ],
      error: null
    })
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({
      data: [
        criarCardRevisao({ id: 'card-mat-1', frente: 'Controle difuso', estado: 'novo', materia_id: 'mat-1' }),
        criarCardRevisao({ id: 'card-mat-2', frente: 'Prazo administrativo', estado: 'novo', materia_id: 'mat-2' }),
        criarCardRevisao({ id: 'card-mat-3', frente: 'Matéria fora da grade', estado: 'novo', materia_id: 'mat-3' }),
        criarCardRevisao({ id: 'card-inativo', frente: 'Card inativo', estado: 'novo', materia_id: 'mat-1', ativo: false }),
        criarCardRevisao({ id: 'card-aprendendo', frente: 'Card aprendendo', estado: 'aprendendo', materia_id: 'mat-1' })
      ],
      error: null
    })

    const resultado = await carregarEstudoDiaFlashcards()
    const texto = document.getElementById('flashcards-estudo-dia-lista').textContent

    expect(resultado.data.map(card => card.id)).toEqual(['card-mat-1', 'card-mat-2'])
    expect(texto).toContain('Controle difuso')
    expect(texto).toContain('Direito Constitucional')
    expect(texto).toContain('Prazo administrativo')
    expect(texto).toContain('Direito Administrativo')
    expect(texto).not.toContain('Matéria fora da grade')
    expect(texto).not.toContain('Card inativo')
    expect(texto).not.toContain('Card aprendendo')
    expect(document.getElementById('flashcards-estudo-dia-vazio').hidden).toBe(true)
  })

  it('alerta de acumulo nao aparece quando nao ha cards vencidos ha mais de 2 dias', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
      data: [
        criarCardRevisao({ id: 'hoje', due_date: '2026-05-20' }),
        criarCardRevisao({ id: 'um-dia', due_date: '2026-05-19' }),
        criarCardRevisao({ id: 'inativo-antigo', due_date: '2026-05-17', ativo: false })
      ],
      error: null
    })

    const resultado = await carregarAlertaAcumuloFlashcards()

    expect(resultado.data).toBe(0)
    expect(document.getElementById('flashcards-alerta-acumulo').hidden).toBe(true)
    expect(document.getElementById('flashcards-alerta-acumulo-texto').textContent).toBe('')
  })

  it('alerta de acumulo aparece para 1 card vencido ha mais de 2 dias', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
      data: [criarCardRevisao({ id: 'antigo', due_date: '2026-05-18' })],
      error: null
    })

    const resultado = await carregarAlertaAcumuloFlashcards()

    expect(resultado.data).toBe(1)
    expect(document.getElementById('flashcards-alerta-acumulo').hidden).toBe(false)
    expect(document.getElementById('flashcards-alerta-acumulo-texto').textContent).toContain('Você tem 1 cards vencidos há mais de 2 dias')
  })

  it('alerta de acumulo mostra quantidade correta e nao altera os cards', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))
    montarSecaoRevisaoFlashcards()
    const cards = [
      criarCardRevisao({ id: 'antigo-1', due_date: '2026-05-18' }),
      criarCardRevisao({ id: 'antigo-2', due_date: '2026-05-17' }),
      criarCardRevisao({ id: 'um-dia', due_date: '2026-05-19' }),
      criarCardRevisao({ id: 'hoje', due_date: '2026-05-20' }),
      criarCardRevisao({ id: 'inativo', due_date: '2026-05-16', ativo: false })
    ]
    const antes = JSON.stringify(cards)
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({ data: cards, error: null })

    const resultado = await carregarAlertaAcumuloFlashcards()

    expect(resultado.data).toBe(2)
    expect(contarCardsAcumuladosFlashcards(cards, '2026-05-20')).toBe(2)
    expect(document.getElementById('flashcards-alerta-acumulo-texto').textContent).toContain('Você tem 2 cards vencidos há mais de 2 dias')
    expect(JSON.stringify(cards)).toBe(antes)
  })

  it('botao Revisar agora leva para Revisar Hoje e Revisao Urgente', () => {
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({ data: [], error: null })
    vi.spyOn(globalThis, 'listarMateriasPlanejadasHojeFlashcards').mockResolvedValue({ data: [], error: null })

    renderizarAlertaAcumuloFlashcards(2)
    selecionarAbaFlashcards('todos', document.getElementById('secao-flashcards'))
    document.getElementById('btn-revisar-alerta-flashcards').click()

    expect(document.getElementById('flashcards-painel-revisar-hoje').hidden).toBe(false)
    expect(document.querySelector('[data-flashcards-aba="revisar-hoje"]').getAttribute('aria-selected')).toBe('true')
  })

  it('erro ao carregar Revisar Hoje mostra mensagem amigavel', async () => {
    montarSecaoRevisaoFlashcards()
    vi.spyOn(globalThis, 'listarFlashcardsDevidosHoje').mockResolvedValue({
      data: null,
      error: new Error('Nao foi possivel listar os flashcards de hoje. Verifique sua conexao e tente novamente.')
    })

    const resultado = await carregarFlashcardsRevisarHoje()

    expect(resultado.error.message).toBe('Nao foi possivel listar os flashcards de hoje. Verifique sua conexao e tente novamente.')
    expect(document.getElementById('flashcards-revisar-vazio').textContent).toBe('Nao foi possivel listar os flashcards de hoje. Verifique sua conexao e tente novamente.')
  })

  it('Estatisticas mostra valores zerados quando nao ha cards nem revisoes', async () => {
    montarSecaoEstatisticasFlashcards()
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({ data: [], error: null })
    vi.spyOn(globalThis, 'listarRevisoesFlashcards').mockResolvedValue({ data: [], error: null })

    const resultado = await carregarEstatisticasFlashcards()

    expect(resultado.error).toBeNull()
    expect(document.getElementById('flashcards-total-cards').textContent).toBe('0')
    expect(document.getElementById('flashcards-cards-hoje').textContent).toBe('0')
    expect(document.getElementById('flashcards-cards-atrasados').textContent).toBe('0')
    expect(document.getElementById('flashcards-cards-para-hoje').textContent).toBe('0')
    expect(document.getElementById('flashcards-cards-novos').textContent).toBe('0')
    expect(document.getElementById('flashcards-total-revisoes').textContent).toBe('0')
    expect(document.getElementById('flashcards-taxa-acerto').textContent).toBe('0%')
    expect(document.getElementById('msg-flashcards-estatisticas').textContent).toBe('')
  })

  it('calcula total ativo, cards para hoje e cards por estado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))

    const estatisticas = calcularEstatisticasFlashcards([
      criarCardRevisao({ id: 'novo-hoje', estado: 'novo', due_date: '2026-05-20' }),
      criarCardRevisao({ id: 'aprendendo-atrasado', estado: 'aprendendo', due_date: '2026-05-19' }),
      criarCardRevisao({ id: 'revisando-futuro', estado: 'revisando', due_date: '2026-05-21' }),
      criarCardRevisao({ id: 'inativo', estado: 'novo', ativo: false, due_date: '2026-05-20' })
    ], [])

    expect(estatisticas.totalCards).toBe(3)
    expect(estatisticas.cardsHoje).toBe(2)
    expect(estatisticas.cardsAtrasados).toBe(1)
    expect(estatisticas.cardsParaHoje).toBe(1)
    expect(estatisticas.cardsNovos).toBe(1)
    expect(estatisticas.cardsAprendendo).toBe(1)
    expect(estatisticas.cardsRevisando).toBe(1)
  })

  it('calcula revisoes, acertos, erros, taxa e sequencia simples', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00'))

    const estatisticas = calcularEstatisticasFlashcards([], [
      { quality: 5, was_correct: true, reviewed_at: '2026-05-20T09:00:00Z' },
      { quality: 4, was_correct: true, reviewed_at: '2026-05-19T09:00:00Z' },
      { quality: 2, was_correct: false, reviewed_at: '2026-05-18T09:00:00Z' },
      { quality: 1, was_correct: false, reviewed_at: '2026-05-16T09:00:00Z' }
    ])

    expect(estatisticas.totalRevisoes).toBe(4)
    expect(estatisticas.totalAcertos).toBe(2)
    expect(estatisticas.totalErros).toBe(2)
    expect(estatisticas.taxaAcerto).toBe(50)
    expect(estatisticas.sequenciaEstudos).toBe(3)
  })

  it('renderiza estatisticas na aba sem quebrar', () => {
    montarSecaoEstatisticasFlashcards()

    renderizarEstatisticasFlashcards({
      totalCards: 4,
      cardsHoje: 2,
      cardsAtrasados: 1,
      cardsParaHoje: 1,
      cardsNovos: 1,
      cardsAprendendo: 1,
      cardsRevisando: 2,
      totalRevisoes: 10,
      totalAcertos: 7,
      taxaAcerto: 70,
      totalErros: 3,
      sequenciaEstudos: 5
    })

    expect(document.getElementById('flashcards-total-cards').textContent).toBe('4')
    expect(document.getElementById('flashcards-cards-hoje').textContent).toBe('2')
    expect(document.getElementById('flashcards-cards-atrasados').textContent).toBe('1')
    expect(document.getElementById('flashcards-cards-para-hoje').textContent).toBe('1')
    expect(document.getElementById('flashcards-cards-novos').textContent).toBe('1')
    expect(document.getElementById('flashcards-cards-aprendendo').textContent).toBe('1')
    expect(document.getElementById('flashcards-cards-revisando').textContent).toBe('2')
    expect(document.getElementById('flashcards-total-revisoes').textContent).toBe('10')
    expect(document.getElementById('flashcards-total-acertos').textContent).toBe('7')
    expect(document.getElementById('flashcards-taxa-acerto').textContent).toBe('70%')
    expect(document.getElementById('flashcards-total-erros').textContent).toBe('3')
    expect(document.getElementById('flashcards-sequencia-estudos').textContent).toBe('5')
  })

  it('erro ao carregar Estatisticas mostra mensagem amigavel e valores zerados', async () => {
    montarSecaoEstatisticasFlashcards()
    vi.spyOn(globalThis, 'listarFlashcards').mockResolvedValue({
      data: null,
      error: new Error('Nao foi possivel listar os flashcards. Verifique sua conexao e tente novamente.')
    })
    vi.spyOn(globalThis, 'listarRevisoesFlashcards').mockResolvedValue({ data: [], error: null })

    const resultado = await carregarEstatisticasFlashcards()

    expect(resultado.error.message).toBe('Nao foi possivel listar os flashcards. Verifique sua conexao e tente novamente.')
    expect(document.getElementById('flashcards-total-cards').textContent).toBe('0')
    expect(document.getElementById('flashcards-taxa-acerto').textContent).toBe('0%')
    expect(document.getElementById('msg-flashcards-estatisticas').textContent).toBe('Nao foi possivel listar os flashcards. Verifique sua conexao e tente novamente.')
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

  it('listarMateriasPlanejadasHojeFlashcards usa planejamento_semanal do dia', async () => {
    const query = criarQueryLista({ data: [{ materia_id: 'mat-1' }], error: null })
    const from = vi.fn(() => query)
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    const resultado = await listarMateriasPlanejadasHojeFlashcards('2026-05-20')

    expect(resultado.data).toEqual([{ materia_id: 'mat-1' }])
    expect(from).toHaveBeenCalledWith('planejamento_semanal')
    expect(query.select).toHaveBeenCalledWith('id, dia_semana, materia_id, materias(nome)')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(query.eq).toHaveBeenCalledWith('dia_semana', 3)
    expect(query.order).toHaveBeenCalledWith('ordem', { ascending: true })
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

  it('listarRevisoesFlashcards usa a tabela flashcard_reviews do usuario logado', async () => {
    const query = criarQueryLista({ data: [{ id: 'review-1' }], error: null })
    const from = vi.fn(() => query)
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    const resultado = await listarRevisoesFlashcards()

    expect(resultado.data).toEqual([{ id: 'review-1' }])
    expect(from).toHaveBeenCalledWith('flashcard_reviews')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(query.order).toHaveBeenCalledWith('reviewed_at', { ascending: false })
  })

  it('listarMateriasFlashcards usa materias do usuario logado', async () => {
    const query = criarQueryLista({ data: [{ id: 'mat-1', nome: 'Direito Constitucional' }], error: null })
    const from = vi.fn(() => query)
    globalThis.db = { auth: criarAuthMock('user-1'), from }

    const resultado = await listarMateriasFlashcards()

    expect(resultado.data).toEqual([{ id: 'mat-1', nome: 'Direito Constitucional' }])
    expect(from).toHaveBeenCalledWith('materias')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(query.order).toHaveBeenCalledWith('nome', { ascending: true })
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
