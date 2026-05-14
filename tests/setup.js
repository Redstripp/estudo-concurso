// setup.js - configuracao global para testes Vitest.
// Carrega os scripts legados antes de criar o mock de window, pois eles
// publicam funcoes de teste em globalThis quando rodam fora do navegador.

await import('../js/utils.js')
await import('../js/gamificacao.js')
await import('../js/questoes.js')

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {}
}
