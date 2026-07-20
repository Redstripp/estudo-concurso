// setup.js - configuracao global para testes Vitest.
// Carrega os scripts legados antes de criar o mock de window, pois eles
// publicam funcoes de teste em globalThis quando rodam fora do navegador.

// Mock do DOM para testes que rodam fora do navegador
import { JSDOM } from 'jsdom'

const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <body>
      <p id="msg-auth" class="msg-feedback"></p>
      <script src="/js/auth.js"></script>
    </body>
  </html>
`, { url: 'http://localhost' })
globalThis.document = dom.window.document

await import('../js/utils.js')
await import('../js/anotacoes.js')
await import('../js/auth.js')
await import('../js/materias.js')
await import('../js/gamificacao.js')
await import('../js/questoes-sm2.js')
await import('../js/questoes.js')
await import('../js/sessoes.js')
await import('../js/dashboard.js')
await import('../js/revisao.js')
await import('../js/edital.js')
await import('../js/estatisticas.js')
await import('../js/plano.js')
await import('../js/simulado-scoring.js')
await import('../js/simulados.js')
await import('../js/planejamento.js')

globalThis.window = dom.window
globalThis.localStorage = dom.window.localStorage
globalThis.sessionStorage = dom.window.sessionStorage
globalThis.Element = dom.window.Element
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Node = dom.window.Node

await import('../js/anotacoes-ui.js')
