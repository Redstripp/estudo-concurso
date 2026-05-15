import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

// Importa as funções reais de js/auth.js via globalThis
const {
  mostrarMensagem,
  limparMensagem,
  setBotaoCarregando,
  obterUrlArquivo,
  obterBaseArquivosAuth,
  obterScriptAuthAtual,
  obterUrlApp,
  ehLinkRedefinicaoSenhaAuth,
  traduzirErro
} = globalThis

describe('traduzirErro', () => {
  it('deve traduzir "Invalid login credentials" para português', () => {
    expect(traduzirErro('Invalid login credentials')).toBe('E-mail ou senha incorretos.')
  })

  it('deve traduzir "Email not confirmed" para português', () => {
    expect(traduzirErro('Email not confirmed')).toBe('Confirme seu e-mail antes de entrar.')
  })

  it('deve traduzir "User already registered" para português', () => {
    expect(traduzirErro('User already registered')).toBe('Este e-mail já está cadastrado.')
  })

  it('deve traduzir "Password should be at least 6 characters" para português', () => {
    expect(traduzirErro('Password should be at least 6 characters')).toBe('A senha deve ter no mínimo 6 caracteres.')
  })

  it('deve traduzir "Unable to validate email address: invalid format" para português', () => {
    expect(traduzirErro('Unable to validate email address: invalid format')).toBe('Formato de e-mail inválido.')
  })

  it('deve retornar mensagem genérica para erro desconhecido', () => {
    expect(traduzirErro('Erro desconhecido')).toBe('Ocorreu um erro. Tente novamente.')
  })

  it('deve retornar mensagem genérica para string vazia', () => {
    expect(traduzirErro('')).toBe('Ocorreu um erro. Tente novamente.')
  })
})

describe('setBotaoCarregando', () => {
  let mockBtn

  beforeEach(() => {
    mockBtn = {
      disabled: false,
      textContent: '',
      dataset: { texto: 'Entrar' }
    }
  })

  it('deve desabilitar o botão e mudar texto para "Aguarde..." quando carregando=true', () => {
    setBotaoCarregando(mockBtn, true)
    expect(mockBtn.disabled).toBe(true)
    expect(mockBtn.textContent).toBe('Aguarde...')
  })

  it('deve habilitar o botão e restaurar texto original quando carregando=false', () => {
    mockBtn.disabled = true
    mockBtn.textContent = 'Aguarde...'
    setBotaoCarregando(mockBtn, false)
    expect(mockBtn.disabled).toBe(false)
    expect(mockBtn.textContent).toBe('Entrar')
  })
})

describe('mensagens de autenticação', () => {
  it('mostrarMensagem atualiza texto e classe', () => {
    mostrarMensagem('Tudo certo', 'sucesso')

    const msg = document.getElementById('msg-auth')
    expect(msg.textContent).toBe('Tudo certo')
    expect(msg.className).toBe('msg-feedback sucesso')
  })

  it('limparMensagem limpa texto e restaura classe base', () => {
    mostrarMensagem('Erro', 'erro')
    limparMensagem()

    const msg = document.getElementById('msg-auth')
    expect(msg.textContent).toBe('')
    expect(msg.className).toBe('msg-feedback')
  })
})

describe('ehLinkRedefinicaoSenhaAuth', () => {
  let originalUrl

  beforeEach(() => {
    originalUrl = window.location.href
  })

  it('deve retornar true quando hash tem type=recovery', () => {
    window.history.replaceState({}, '', '/#type=recovery')
    expect(ehLinkRedefinicaoSenhaAuth()).toBe(true)
  })

  it('deve retornar true quando search tem type=recovery', () => {
    window.history.replaceState({}, '', '/?type=recovery')
    expect(ehLinkRedefinicaoSenhaAuth()).toBe(true)
  })

  it('deve retornar false quando não há type=recovery', () => {
    window.history.replaceState({}, '', '/#type=signup')
    expect(ehLinkRedefinicaoSenhaAuth()).toBe(false)
  })

  it('deve retornar false quando não há parâmetros', () => {
    window.history.replaceState({}, '', '/')
    expect(ehLinkRedefinicaoSenhaAuth()).toBe(false)
  })

  afterEach(() => {
    window.history.replaceState({}, '', originalUrl)
  })
})

describe('funções auxiliares de URL', () => {
  it('obterScriptAuthAtual encontra o script auth no DOM', () => {
    expect(obterScriptAuthAtual()?.getAttribute('src')).toBe('/js/auth.js')
  })

  it('obterBaseArquivosAuth deve apontar para a raiz dos arquivos', () => {
    expect(obterBaseArquivosAuth()).toBe('http://localhost/')
  })

  it('obterUrlArquivo deve montar URL a partir da base do script', () => {
    expect(obterUrlArquivo('manual-uso.html')).toBe('http://localhost/manual-uso.html')
  })

  it('obterUrlApp deve retornar URL para app.html', () => {
    const url = obterUrlApp()
    expect(url).toContain('app.html')
  })
})

describe('manipuladores de eventos de autenticacao', () => {
  it('alterna abas de login e cadastro limpando mensagens', async () => {
    const documentAnterior = globalThis.document
    const windowAnterior = globalThis.window
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <button id="btn-aba-login" class="ativa" type="button">Login</button>
          <button id="btn-aba-cadastro" type="button">Cadastro</button>
          <form id="form-login"></form>
          <form id="form-cadastro" class="escondido"></form>
          <p id="msg-auth" class="msg-feedback erro">Erro antigo</p>
          <script src="/js/auth.js"></script>
        </body>
      </html>
    `, { url: 'http://localhost/login.html' })

    globalThis.document = dom.window.document
    globalThis.window = dom.window

    try {
      await import('../js/auth.js?eventos-handler-test')

      document.getElementById('btn-aba-cadastro').click()

      expect(document.getElementById('btn-aba-cadastro').classList.contains('ativa')).toBe(true)
      expect(document.getElementById('btn-aba-login').classList.contains('ativa')).toBe(false)
      expect(document.getElementById('form-cadastro').classList.contains('escondido')).toBe(false)
      expect(document.getElementById('form-login').classList.contains('escondido')).toBe(true)
      expect(document.getElementById('msg-auth').textContent).toBe('')
      expect(document.getElementById('msg-auth').className).toBe('msg-feedback')

      document.getElementById('msg-auth').textContent = 'Outro erro'
      document.getElementById('msg-auth').className = 'msg-feedback erro'
      document.getElementById('btn-aba-login').click()

      expect(document.getElementById('btn-aba-login').classList.contains('ativa')).toBe(true)
      expect(document.getElementById('btn-aba-cadastro').classList.contains('ativa')).toBe(false)
      expect(document.getElementById('form-login').classList.contains('escondido')).toBe(false)
      expect(document.getElementById('form-cadastro').classList.contains('escondido')).toBe(true)
      expect(document.getElementById('msg-auth').textContent).toBe('')
    } finally {
      globalThis.document = documentAnterior
      globalThis.window = windowAnterior
    }
  })
})
