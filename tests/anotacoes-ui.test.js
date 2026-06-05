import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'

const {
  inicializarAnotacoesUi,
  definirModoAnotacoesUi,
  obterEstadoAnotacoesUi
} = globalThis.AnotacoesLivresUi

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
    document.body.innerHTML = ''
    document.body.className = ''
    localStorage.clear()
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
      espessura: 'medium'
    })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toolbar.hidden).toBe(true)
    expect(canvas.style.pointerEvents).toBe('none')
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
