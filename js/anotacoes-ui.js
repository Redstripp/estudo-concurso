// js/anotacoes-ui.js

const ID_RAIZ_ANOTACOES_UI = 'anotacoes-ui'
const documentosComAtalhoAnotacoesUi = new WeakSet()

const FERRAMENTAS_ANOTACOES_UI = [
  { valor: 'pen', rotulo: 'Lapis', icone: 'L' },
  { valor: 'highlighter', rotulo: 'Marca-texto', icone: 'M' },
  { valor: 'eraser', rotulo: 'Borracha', icone: 'B' }
]

const CORES_ANOTACOES_UI = [
  { valor: 'black', rotulo: 'Preto' },
  { valor: 'red', rotulo: 'Vermelho' },
  { valor: 'blue', rotulo: 'Azul' },
  { valor: 'green', rotulo: 'Verde' },
  { valor: 'yellow', rotulo: 'Amarelo' },
  { valor: 'white', rotulo: 'Branco' }
]

const ESPESSURAS_ANOTACOES_UI = [
  { valor: 'thin', rotulo: 'Fino' },
  { valor: 'medium', rotulo: 'Medio' },
  { valor: 'thick', rotulo: 'Grosso' }
]

function criarBotaoAnotacoesUi({ classe, rotulo, texto, grupo, valor }) {
  const botao = document.createElement('button')
  botao.type = 'button'
  botao.className = classe
  botao.setAttribute('aria-label', rotulo)
  botao.title = rotulo
  botao.textContent = texto

  if (grupo) {
    botao.dataset.grupoAnotacoes = grupo
    botao.dataset.valorAnotacoes = valor
    botao.setAttribute('aria-pressed', 'false')
  }

  return botao
}

function criarGrupoAnotacoesUi(rotulo) {
  const grupo = document.createElement('div')
  grupo.className = 'anotacoes-toolbar-grupo'
  grupo.setAttribute('role', 'group')
  grupo.setAttribute('aria-label', rotulo)
  return grupo
}

function criarToolbarAnotacoesUi() {
  const toolbar = document.createElement('div')
  toolbar.id = 'anotacoes-toolbar'
  toolbar.className = 'anotacoes-toolbar'
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', 'Controles de anotacoes livres')
  toolbar.hidden = true

  const ferramentas = criarGrupoAnotacoesUi('Ferramentas')
  FERRAMENTAS_ANOTACOES_UI.forEach(({ valor, rotulo, icone }) => {
    ferramentas.appendChild(criarBotaoAnotacoesUi({
      classe: 'anotacoes-controle anotacoes-controle--ferramenta',
      rotulo,
      texto: icone,
      grupo: 'ferramenta',
      valor
    }))
  })

  const cores = criarGrupoAnotacoesUi('Cores')
  CORES_ANOTACOES_UI.forEach(({ valor, rotulo }) => {
    const botao = criarBotaoAnotacoesUi({
      classe: `anotacoes-controle anotacoes-cor anotacoes-cor--${valor}`,
      rotulo: `Cor ${rotulo.toLowerCase()}`,
      texto: '',
      grupo: 'cor',
      valor
    })
    cores.appendChild(botao)
  })

  const espessuras = criarGrupoAnotacoesUi('Espessuras')
  ESPESSURAS_ANOTACOES_UI.forEach(({ valor, rotulo }) => {
    const botao = criarBotaoAnotacoesUi({
      classe: `anotacoes-controle anotacoes-espessura anotacoes-espessura--${valor}`,
      rotulo: `Espessura ${rotulo.toLowerCase()}`,
      texto: '',
      grupo: 'espessura',
      valor
    })
    const linha = document.createElement('span')
    linha.className = 'anotacoes-espessura-linha'
    linha.setAttribute('aria-hidden', 'true')
    botao.appendChild(linha)
    espessuras.appendChild(botao)
  })

  const limpar = criarBotaoAnotacoesUi({
    classe: 'anotacoes-controle anotacoes-controle--limpar',
    rotulo: 'Limpar anotacoes, disponivel em uma etapa futura',
    texto: 'Limpar'
  })
  limpar.disabled = true

  toolbar.append(ferramentas, cores, espessuras, limpar)
  return toolbar
}

function obterRaizAnotacoesUi() {
  return document.getElementById(ID_RAIZ_ANOTACOES_UI)
}

function obterEstadoAnotacoesUi() {
  const raiz = obterRaizAnotacoesUi()
  if (!raiz) return null

  return {
    ativo: raiz.dataset.ativo === 'true',
    ferramenta: raiz.dataset.ferramenta,
    cor: raiz.dataset.cor,
    espessura: raiz.dataset.espessura
  }
}

function atualizarSelecaoAnotacoesUi(raiz, grupo, valor) {
  raiz.dataset[grupo] = valor
  raiz.querySelectorAll(`[data-grupo-anotacoes="${grupo}"]`).forEach(botao => {
    const selecionado = botao.dataset.valorAnotacoes === valor
    botao.classList.toggle('is-selected', selecionado)
    botao.setAttribute('aria-pressed', String(selecionado))
  })
}

function definirModoAnotacoesUi(ativo) {
  const raiz = obterRaizAnotacoesUi()
  if (!raiz) return false

  const modoAtivo = Boolean(ativo)
  const toggle = raiz.querySelector('#btn-anotacoes-toggle')
  const toolbar = raiz.querySelector('#anotacoes-toolbar')
  const canvas = raiz.querySelector('#anotacoes-canvas')

  raiz.dataset.ativo = String(modoAtivo)
  raiz.classList.toggle('anotacoes-ui--ativa', modoAtivo)
  toggle.classList.toggle('is-active', modoAtivo)
  toggle.setAttribute('aria-pressed', String(modoAtivo))
  toggle.setAttribute('aria-label', modoAtivo ? 'Desativar anotacoes livres' : 'Ativar anotacoes livres')
  toggle.title = modoAtivo ? 'Desativar anotacoes livres' : 'Ativar anotacoes livres'
  toolbar.hidden = !modoAtivo
  canvas.classList.toggle('anotacoes-canvas--ativa', modoAtivo)
  canvas.style.pointerEvents = modoAtivo ? 'auto' : 'none'
  document.body.classList.toggle('modo-anotacoes-ativo', modoAtivo)
  return modoAtivo
}

function elementoEditavelAnotacoesUi(elemento) {
  if (!elemento || elemento === document) return false
  if (elemento.isContentEditable) return true
  return Boolean(elemento.closest?.('input, textarea, select, [contenteditable]'))
}

function existeModalVisivelAnotacoesUi() {
  return Array.from(document.querySelectorAll('.modal-overlay')).some(modal => {
    return !modal.hidden
      && modal.getAttribute('aria-hidden') !== 'true'
      && modal.style.display !== 'none'
  })
}

function tratarEscapeAnotacoesUi(evento) {
  if (evento.key !== 'Escape') return
  if (!obterEstadoAnotacoesUi()?.ativo) return
  if (elementoEditavelAnotacoesUi(evento.target)) return
  if (existeModalVisivelAnotacoesUi()) return
  definirModoAnotacoesUi(false)
}

function inicializarAnotacoesUi() {
  const existente = obterRaizAnotacoesUi()
  if (existente) return existente

  const raiz = document.createElement('div')
  raiz.id = ID_RAIZ_ANOTACOES_UI
  raiz.className = 'anotacoes-ui'
  raiz.dataset.ativo = 'false'
  raiz.dataset.ferramenta = 'pen'
  raiz.dataset.cor = 'black'
  raiz.dataset.espessura = 'medium'

  const canvas = document.createElement('canvas')
  canvas.id = 'anotacoes-canvas'
  canvas.className = 'anotacoes-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.pointerEvents = 'none'

  const toolbar = criarToolbarAnotacoesUi()
  const toggle = criarBotaoAnotacoesUi({
    classe: 'anotacoes-toggle',
    rotulo: 'Ativar anotacoes livres',
    texto: '\u270e Anotar'
  })
  toggle.id = 'btn-anotacoes-toggle'
  toggle.setAttribute('aria-pressed', 'false')

  toggle.addEventListener('click', () => {
    definirModoAnotacoesUi(!obterEstadoAnotacoesUi()?.ativo)
  })

  toolbar.addEventListener('click', evento => {
    const botao = evento.target.closest?.('[data-grupo-anotacoes]')
    if (!botao || !toolbar.contains(botao)) return
    atualizarSelecaoAnotacoesUi(raiz, botao.dataset.grupoAnotacoes, botao.dataset.valorAnotacoes)
  })

  raiz.append(canvas, toolbar, toggle)
  document.body.appendChild(raiz)
  atualizarSelecaoAnotacoesUi(raiz, 'ferramenta', 'pen')
  atualizarSelecaoAnotacoesUi(raiz, 'cor', 'black')
  atualizarSelecaoAnotacoesUi(raiz, 'espessura', 'medium')

  if (!documentosComAtalhoAnotacoesUi.has(document)) {
    document.addEventListener('keydown', tratarEscapeAnotacoesUi)
    documentosComAtalhoAnotacoesUi.add(document)
  }

  return raiz
}

const AnotacoesLivresUi = Object.freeze({
  inicializarAnotacoesUi,
  definirModoAnotacoesUi,
  obterEstadoAnotacoesUi
})

if (typeof globalThis !== 'undefined') {
  globalThis.AnotacoesLivresUi = AnotacoesLivresUi
}

if (typeof document !== 'undefined' && document.body) {
  inicializarAnotacoesUi()
}
