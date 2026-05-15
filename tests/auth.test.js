import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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
  it('obterUrlApp deve retornar URL para app.html', () => {
    const url = obterUrlApp()
    expect(url).toContain('app.html')
  })
})
