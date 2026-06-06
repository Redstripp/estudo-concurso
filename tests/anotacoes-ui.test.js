import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  inicializarAnotacoesUi,
  definirModoAnotacoesUi,
  obterEstadoAnotacoesUi,
  obterViewIdAnotacoesUi
} = globalThis.AnotacoesLivresUi

const { carregarAnotacoes } = globalThis.AnotacoesLivres

let contextoCanvas
let retangulosSecoes

function criarContextoCanvas() {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn()
  }
}

function montarSecoes(ativa = 'flashcards') {
  document.body.innerHTML = `
    <header class="header-mobile">
      <button id="btn-menu" type="button">Menu</button>
    </header>
    <main class="conteudo-principal">
      <section id="secao-flashcards" class="secao ${ativa === 'flashcards' ? '' : 'escondido'}">
        <button class="btn-ajuda-secao" type="button">?</button>
      </section>
      <section id="secao-questoes" class="secao ${ativa === 'questoes' ? '' : 'escondido'}"></section>
    </main>
  `

  retangulosSecoes = {
    flashcards: { left: 200, top: 100, width: 900, height: 1200 },
    questoes: { left: 200, top: 100, width: 900, height: 1200 }
  }

  Object.entries(retangulosSecoes).forEach(([secao, retangulo]) => {
    const elemento = document.getElementById(`secao-${secao}`)
    elemento.getBoundingClientRect = () => ({ ...retangulo })
    Object.defineProperty(elemento, 'scrollWidth', { configurable: true, value: 900 })
  })
}

function configurarCanvasTeste() {
  contextoCanvas = criarContextoCanvas()
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => contextoCanvas)
  })
}

function dispararPointer(canvas, tipo, { x, y, pointerId = 1, button = 0, isPrimary = true } = {}) {
  const evento = new window.Event(tipo, { bubbles: true, cancelable: true })
  Object.defineProperties(evento, {
    button: { value: button },
    clientX: { value: x },
    clientY: { value: y },
    isPrimary: { value: isPrimary },
    pointerId: { value: pointerId }
  })
  canvas.dispatchEvent(evento)
}

function desenharTraco(canvas, pontos = [[230, 140], [260, 180], [270, 190]]) {
  dispararPointer(canvas, 'pointerdown', { x: pontos[0][0], y: pontos[0][1] })
  pontos.slice(1, -1).forEach(([x, y]) => dispararPointer(canvas, 'pointermove', { x, y }))
  const ultimo = pontos.at(-1)
  dispararPointer(canvas, 'pointerup', { x: ultimo[0], y: ultimo[1] })
}

function trocarSecao(secao) {
  document.querySelectorAll('.secao').forEach(elemento => elemento.classList.add('escondido'))
  document.getElementById(`secao-${secao}`).classList.remove('escondido')
}

function obterElementosUi() {
  return {
    raiz: document.getElementById('anotacoes-ui'),
    toggle: document.getElementById('btn-anotacoes-toggle'),
    toolbar: document.getElementById('anotacoes-toolbar'),
    canvas: document.getElementById('anotacoes-canvas')
  }
}

function clicar(seletor) {
  const elemento = document.querySelector(seletor)
  elemento.click()
  return elemento
}

describe('shell visual de anotacoes livres', () => {
  beforeEach(() => {
    montarSecoes()
    document.body.className = ''
    localStorage.clear()
    configurarCanvasTeste()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
    inicializarAnotacoesUi()
  })

  it('carrega modelo e UI antes do app principal', () => {
    const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8')
    const modelo = html.indexOf('<script src="js/anotacoes.js"></script>')
    const ui = html.indexOf('<script src="js/anotacoes-ui.js"></script>')
    const app = html.indexOf('<script src="js/app.js"></script>')

    expect(modelo).toBeGreaterThan(-1)
    expect(ui).toBeGreaterThan(modelo)
    expect(app).toBeGreaterThan(ui)
  })

  it('cria botao, toolbar e canvas com modo inicial desativado', () => {
    const { raiz, toggle, toolbar, canvas } = obterElementosUi()

    expect(raiz).not.toBeNull()
    expect(toggle).not.toBeNull()
    expect(toolbar).not.toBeNull()
    expect(canvas).not.toBeNull()
    expect(obterEstadoAnotacoesUi()).toMatchObject({
      ativo: false,
      ferramenta: 'pen',
      cor: 'black',
      espessura: 'medium',
      viewId: 'secao:flashcards',
      quantidadeTracos: 0
    })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toolbar.hidden).toBe(true)
    expect(canvas.style.pointerEvents).toBe('none')
    expect(canvas.style.touchAction).toBe('none')
    expect(canvas.style.clipPath).toBe('inset(100px 100px 0px 200px)')
  })

  it('alterna modo, aria-pressed, classes e eventos do canvas pelo botao', () => {
    const { raiz, toggle, toolbar, canvas } = obterElementosUi()

    toggle.click()
    expect(obterEstadoAnotacoesUi().ativo).toBe(true)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(toggle.classList.contains('is-active')).toBe(true)
    expect(raiz.classList.contains('anotacoes-ui--ativa')).toBe(true)
    expect(toolbar.hidden).toBe(false)
    expect(canvas.classList.contains('anotacoes-canvas--ativa')).toBe(true)
    expect(canvas.style.pointerEvents).toBe('auto')

    toggle.click()
    expect(obterEstadoAnotacoesUi().ativo).toBe(false)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(raiz.classList.contains('anotacoes-ui--ativa')).toBe(false)
    expect(toolbar.hidden).toBe(true)
    expect(canvas.style.pointerEvents).toBe('none')
  })

  it('oferece ferramentas, cores e espessuras e altera somente o estado visual', () => {
    const { raiz } = obterElementosUi()
    const valores = grupo => Array.from(raiz.querySelectorAll(`[data-grupo-anotacoes="${grupo}"]`))
      .map(botao => botao.dataset.valorAnotacoes)

    expect(valores('ferramenta')).toEqual(['pen', 'highlighter', 'eraser'])
    expect(valores('cor')).toEqual(['black', 'red', 'blue', 'green', 'yellow', 'white'])
    expect(valores('espessura')).toEqual(['thin', 'medium', 'thick'])
    expect(raiz.querySelector('.anotacoes-controle--limpar').disabled).toBe(true)

    const marcaTexto = clicar('[data-grupo-anotacoes="ferramenta"][data-valor-anotacoes="highlighter"]')
    const azul = clicar('[data-grupo-anotacoes="cor"][data-valor-anotacoes="blue"]')
    const grosso = clicar('[data-grupo-anotacoes="espessura"][data-valor-anotacoes="thick"]')

    expect(obterEstadoAnotacoesUi()).toMatchObject({
      ferramenta: 'highlighter',
      cor: 'blue',
      espessura: 'thick'
    })
    expect(marcaTexto.getAttribute('aria-pressed')).toBe('true')
    expect(azul.classList.contains('is-selected')).toBe(true)
    expect(grosso.classList.contains('is-selected')).toBe(true)
    expect(localStorage.length).toBe(0)
  })

  it('detecta a secao principal ativa e usa fallback seguro sem secao visivel', () => {
    expect(obterViewIdAnotacoesUi()).toBe('secao:flashcards')

    document.querySelectorAll('.secao').forEach(secao => secao.classList.add('escondido'))
    expect(obterViewIdAnotacoesUi()).toBe('secao:desconhecida')
  })

  it('desenha com lapis e salva pontos, cor e espessura somente na finalizacao', () => {
    const { toggle, canvas } = obterElementosUi()
    canvas.setPointerCapture = vi.fn()
    canvas.releasePointerCapture = vi.fn()
    toggle.click()
    clicar('[data-grupo-anotacoes="cor"][data-valor-anotacoes="blue"]')
    clicar('[data-grupo-anotacoes="espessura"][data-valor-anotacoes="thick"]')

    dispararPointer(canvas, 'pointerdown', { x: 230, y: 140 })
    dispararPointer(canvas, 'pointermove', { x: 260, y: 180 })
    expect(localStorage.length).toBe(0)

    dispararPointer(canvas, 'pointerup', { x: 270, y: 190 })
    const salvo = carregarAnotacoes({ userId: 'anonimo', viewId: 'secao:flashcards' })

    expect(salvo.strokes).toHaveLength(1)
    expect(salvo.strokes[0]).toMatchObject({
      tool: 'pen',
      color: 'blue',
      thickness: 'thick',
      points: [{ x: 30, y: 40 }, { x: 60, y: 80 }, { x: 70, y: 90 }]
    })
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1)
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(contextoCanvas.lineCap).toBe('round')
    expect(contextoCanvas.lineJoin).toBe('round')
    expect(contextoCanvas.strokeStyle).toBe('#2563eb')
    expect(contextoCanvas.lineWidth).toBe(7)
  })

  it('ignora inicio de traco fora da area desenhavel visivel', () => {
    const { toggle, canvas } = obterElementosUi()
    toggle.click()

    dispararPointer(canvas, 'pointerdown', { x: 180, y: 140 })
    dispararPointer(canvas, 'pointermove', { x: 260, y: 180 })
    dispararPointer(canvas, 'pointerup', { x: 270, y: 190 })

    expect(localStorage.length).toBe(0)
    expect(obterEstadoAnotacoesUi().quantidadeTracos).toBe(0)
  })

  it('nao adiciona pontos fora da area desenhavel durante um traco', () => {
    const { toggle, canvas } = obterElementosUi()
    toggle.click()

    dispararPointer(canvas, 'pointerdown', { x: 230, y: 140 })
    dispararPointer(canvas, 'pointermove', { x: 1150, y: 180 })
    dispararPointer(canvas, 'pointermove', { x: 270, y: 190 })
    dispararPointer(canvas, 'pointerup', { x: 280, y: 200 })

    const salvo = carregarAnotacoes({ userId: 'anonimo', viewId: 'secao:flashcards' })
    expect(salvo.strokes).toHaveLength(1)
    expect(salvo.strokes[0].points).toEqual([
      { x: 30, y: 40 },
      { x: 70, y: 90 },
      { x: 80, y: 100 }
    ])
  })

  it('nao salva traco vazio quando o pointerup acontece fora da area desenhavel', () => {
    const { toggle, canvas } = obterElementosUi()
    toggle.click()

    dispararPointer(canvas, 'pointerdown', { x: 230, y: 140 })
    dispararPointer(canvas, 'pointerup', { x: 1150, y: 180 })

    expect(localStorage.length).toBe(0)
    expect(obterEstadoAnotacoesUi().quantidadeTracos).toBe(0)
  })

  it('nao desenha desativado, com marca-texto, borracha ou eventos incompletos', () => {
    const { toggle, canvas } = obterElementosUi()

    desenharTraco(canvas)
    dispararPointer(canvas, 'pointermove', { x: 240, y: 150 })
    dispararPointer(canvas, 'pointerup', { x: 250, y: 160 })
    dispararPointer(canvas, 'pointerdown', { x: 230, y: 140, pointerId: NaN })
    expect(localStorage.length).toBe(0)

    toggle.click()
    clicar('[data-grupo-anotacoes="ferramenta"][data-valor-anotacoes="highlighter"]')
    desenharTraco(canvas)
    clicar('[data-grupo-anotacoes="ferramenta"][data-valor-anotacoes="eraser"]')
    desenharTraco(canvas)
    clicar('[data-grupo-anotacoes="ferramenta"][data-valor-anotacoes="pen"]')
    dispararPointer(canvas, 'pointerdown', { x: 230, y: 140 })
    dispararPointer(canvas, 'pointerup', { x: 230, y: 140 })

    expect(localStorage.length).toBe(0)
    expect(obterEstadoAnotacoesUi().quantidadeTracos).toBe(0)
  })

  it('isola persistencia por secao e recarrega os tracos corretos', async () => {
    const { toggle, canvas } = obterElementosUi()
    toggle.click()
    desenharTraco(canvas)

    trocarSecao('questoes')
    await vi.waitFor(() => {
      expect(obterEstadoAnotacoesUi()).toMatchObject({ viewId: 'secao:questoes', quantidadeTracos: 0 })
    })
    desenharTraco(canvas, [[240, 150], [280, 190], [290, 200]])

    expect(carregarAnotacoes({ userId: 'anonimo', viewId: 'secao:flashcards' }).strokes).toHaveLength(1)
    expect(carregarAnotacoes({ userId: 'anonimo', viewId: 'secao:questoes' }).strokes).toHaveLength(1)

    trocarSecao('flashcards')
    await vi.waitFor(() => {
      expect(obterEstadoAnotacoesUi()).toMatchObject({ viewId: 'secao:flashcards', quantidadeTracos: 1 })
    })

    document.getElementById('anotacoes-ui').remove()
    inicializarAnotacoesUi()
    expect(obterEstadoAnotacoesUi()).toMatchObject({
      ativo: false,
      viewId: 'secao:flashcards',
      quantidadeTracos: 1
    })
  })

  it('armazena coordenadas da secao e agenda redraw no scroll sem canvas gigante', () => {
    const { toggle, canvas } = obterElementosUi()
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 9000 })
    const callbacks = []
    window.requestAnimationFrame = vi.fn(callback => {
      callbacks.push(callback)
      return callbacks.length
    })
    toggle.click()
    desenharTraco(canvas)
    contextoCanvas.moveTo.mockClear()

    retangulosSecoes.flashcards.top = -50
    window.dispatchEvent(new window.Event('scroll'))
    window.dispatchEvent(new window.Event('scroll'))

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)
    callbacks.shift()()
    expect(contextoCanvas.moveTo).toHaveBeenCalledWith(230, -10)
    expect(canvas.style.clipPath).toBe('inset(0px 100px 0px 200px)')
    expect(canvas.height).toBe(700)
    expect(canvas.height).not.toBe(9000)
  })

  it('exclui o header mobile visivel da area desenhavel', () => {
    const { toggle, canvas } = obterElementosUi()
    const callbacks = []
    const header = document.querySelector('.header-mobile')
    header.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 1200,
      bottom: 80,
      width: 1200,
      height: 80
    })
    window.requestAnimationFrame = vi.fn(callback => {
      callbacks.push(callback)
      return callbacks.length
    })
    toggle.click()

    retangulosSecoes.flashcards.top = -50
    window.dispatchEvent(new window.Event('scroll'))
    callbacks.shift()()
    dispararPointer(canvas, 'pointerdown', { x: 230, y: 60 })
    dispararPointer(canvas, 'pointermove', { x: 260, y: 100 })
    dispararPointer(canvas, 'pointerup', { x: 270, y: 110 })

    expect(canvas.style.clipPath).toBe('inset(80px 100px 0px 200px)')
    expect(localStorage.length).toBe(0)
  })

  it('ajusta canvas a viewport no resize e mantem pointer-events seguros apos desenhar', () => {
    const { toggle, canvas } = obterElementosUi()
    const callbacks = []
    window.requestAnimationFrame = vi.fn(callback => {
      callbacks.push(callback)
      return callbacks.length
    })
    toggle.click()
    desenharTraco(canvas)
    expect(canvas.style.pointerEvents).toBe('auto')

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 })
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
    window.dispatchEvent(new window.Event('resize'))
    callbacks.shift()()

    expect(canvas.width).toBe(1600)
    expect(canvas.height).toBe(1000)
    expect(canvas.style.width).toBe('800px')
    expect(canvas.style.height).toBe('500px')
    expect(canvas.style.clipPath).toBe('inset(100px 0px 0px 200px)')
    toggle.click()
    expect(canvas.style.pointerEvents).toBe('none')
  })

  it('mantem ajuda acima da camada de anotacoes e clicavel', () => {
    const css = readFileSync(new URL('../css/estilo.css', import.meta.url), 'utf8')
    const ajuda = document.querySelector('.btn-ajuda-secao')
    const abrirAjuda = vi.fn()
    ajuda.addEventListener('click', abrirAjuda)
    definirModoAnotacoesUi(true)

    ajuda.click()

    expect(abrirAjuda).toHaveBeenCalledTimes(1)
    expect(css).toMatch(/\.btn-ajuda-secao\s*{[^}]*position:\s*relative;[^}]*z-index:\s*701/s)
  })

  it('desativa o modo de anotacao antes de abrir o menu mobile', () => {
    const { toggle } = obterElementosUi()
    const btnMenu = document.getElementById('btn-menu')
    const abrirMenu = vi.fn()
    btnMenu.addEventListener('click', abrirMenu)
    toggle.click()
    expect(obterEstadoAnotacoesUi().ativo).toBe(true)

    btnMenu.click()

    expect(obterEstadoAnotacoesUi().ativo).toBe(false)
    expect(abrirMenu).toHaveBeenCalledTimes(1)
  })

  it('Escape desativa o modo sem erro quando a UI esta inativa', () => {
    definirModoAnotacoesUi(true)
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(obterEstadoAnotacoesUi().ativo).toBe(false)

    expect(() => {
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    }).not.toThrow()
  })

  it('Escape nao interfere com campos editaveis ou modais visiveis', () => {
    const input = document.createElement('input')
    const editavel = document.createElement('div')
    editavel.setAttribute('contenteditable', '')
    document.body.appendChild(input)
    document.body.appendChild(editavel)
    definirModoAnotacoesUi(true)

    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(obterEstadoAnotacoesUi().ativo).toBe(true)

    editavel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(obterEstadoAnotacoesUi().ativo).toBe(true)

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    document.body.appendChild(modal)
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(obterEstadoAnotacoesUi().ativo).toBe(true)
  })

  it('nao cria ou persiste dados de anotacao sem desenho', () => {
    const { toggle, canvas } = obterElementosUi()

    toggle.click()
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }))
    canvas.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true }))
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true }))
    toggle.click()

    expect(localStorage.length).toBe(0)
    expect(canvas.style.pointerEvents).toBe('none')
  })
})
