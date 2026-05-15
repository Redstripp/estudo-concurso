// setup.js - configuracao global para testes Vitest.
// Carrega os scripts legados antes de criar o mock de window, pois eles
// publicam funcoes de teste em globalThis quando rodam fora do navegador.

// Mock do DOM para testes que rodam fora do navegador
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' })
globalThis.document = dom.window.document

await import('../js/utils.js')
await import('../js/auth.js')
await import('../js/gamificacao.js')
await import('../js/questoes.js')
await import('../js/revisao.js')
await import('../js/edital.js')
await import('../js/planejamento.js')

globalThis.window = dom.window
globalThis.localStorage = dom.window.localStorage
globalThis.HTMLElement = dom.window.HTMLElement
