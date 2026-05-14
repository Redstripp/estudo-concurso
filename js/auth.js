// js/auth.js

// ============================================
// ALTERNÂNCIA ENTRE ABAS (Login / Cadastro)
// ============================================
const btnAbaLogin    = document.getElementById('btn-aba-login')
const btnAbaCadastro = document.getElementById('btn-aba-cadastro')
const formLogin      = document.getElementById('form-login')
const formCadastro   = document.getElementById('form-cadastro')
const msgAuth        = document.getElementById('msg-auth')

if (btnAbaLogin && btnAbaCadastro && formLogin && formCadastro) {
  btnAbaLogin.addEventListener('click', () => {
    btnAbaLogin.classList.add('ativa')
    btnAbaCadastro.classList.remove('ativa')
    formLogin.classList.remove('escondido')
    formCadastro.classList.add('escondido')
    limparMensagem()
  })

  btnAbaCadastro.addEventListener('click', () => {
    btnAbaCadastro.classList.add('ativa')
    btnAbaLogin.classList.remove('ativa')
    formCadastro.classList.remove('escondido')
    formLogin.classList.add('escondido')
    limparMensagem()
  })
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
function mostrarMensagem(texto, tipo) {
  // tipo pode ser 'sucesso' ou 'erro'
  msgAuth.textContent = texto
  msgAuth.className = `msg-feedback ${tipo}`
}

function limparMensagem() {
  msgAuth.textContent = ''
  msgAuth.className = 'msg-feedback'
}

function setBotaoCarregando(btn, carregando) {
  btn.disabled = carregando
  btn.textContent = carregando ? 'Aguarde...' : btn.dataset.texto
}

function obterUrlArquivo(nomeArquivo) {
  const url = new URL(window.location.href)
  const partes = url.pathname.split('/')
  const ultimo = partes[partes.length - 1]

  if (ultimo.includes('.')) {
    partes[partes.length - 1] = nomeArquivo
    url.pathname = partes.join('/')
  } else {
    url.pathname = `${url.pathname.replace(/\/?$/, '/')}${nomeArquivo}`
  }

  url.search = ''
  url.hash = ''
  return url.href
}

function obterUrlApp() {
  return obterUrlArquivo('app.html')
}

function ehLinkRedefinicaoSenhaAuth() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  const tipo = hashParams.get('type') || searchParams.get('type')

  return tipo === 'recovery' || Boolean(hashParams.get('access_token'))
}

// ============================================
// CADASTRO
// ============================================
const btnCadastrar = document.getElementById('btn-cadastrar')
if (btnCadastrar) {
  btnCadastrar.dataset.texto = 'Criar conta'
  
  btnCadastrar.addEventListener('click', async () => {
    const nome  = document.getElementById('cad-nome').value.trim()
    const email = document.getElementById('cad-email').value.trim()
    const senha = document.getElementById('cad-senha').value
  
    // Validações básicas
    if (!nome || !email || !senha) {
      mostrarMensagem('Preencha todos os campos.', 'erro')
      return
    }
  
    if (senha.length < 6) {
      mostrarMensagem('A senha deve ter no mínimo 6 caracteres.', 'erro')
      return
    }
  
    setBotaoCarregando(btnCadastrar, true)
  
    // Cria o usuário no Supabase Auth
    // O metadata 'nome' será usado pelo gatilho para preencher a tabela profiles
    const { error } = await db.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome }
      }
    })
  
    setBotaoCarregando(btnCadastrar, false)
  
    if (error) {
      mostrarMensagem(traduzirErro(error.message), 'erro')
      return
    }
  
    mostrarMensagem('Conta criada! Verifique seu e-mail para confirmar o cadastro.', 'sucesso')
  })
}

// ============================================
// LOGIN
// ============================================
const btnEntrar = document.getElementById('btn-entrar')
if (btnEntrar) {
  btnEntrar.dataset.texto = 'Entrar'
  
  btnEntrar.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim()
    const senha = document.getElementById('login-senha').value
  
    if (!email || !senha) {
      mostrarMensagem('Preencha e-mail e senha.', 'erro')
      return
    }
  
    setBotaoCarregando(btnEntrar, true)
  
    const { error } = await db.auth.signInWithPassword({ email, password: senha })
  
    setBotaoCarregando(btnEntrar, false)
  
    if (error) {
      mostrarMensagem(traduzirErro(error.message), 'erro')
      return
    }
  
    // Login bem-sucedido → redireciona para o app
    window.location.href = obterUrlApp()
  })
}

// ============================================
// VERIFICAR SE JÁ ESTÁ LOGADO
// (evita voltar para o login se já autenticado)
// ============================================
async function verificarSessao() {
  const { data } = await db.auth.getSession()
  if (data.session) {
    window.location.href = obterUrlApp()
  }
}

// Só executa se estiver na página de login
const ehPaginaLoginAuth = document.getElementById('btn-entrar') || document.getElementById('btn-cadastrar')
if (ehPaginaLoginAuth && !ehLinkRedefinicaoSenhaAuth()) {
  verificarSessao()
}

// ============================================
// TRADUÇÃO DE ERROS DO SUPABASE
// (as mensagens originais vêm em inglês)
// ============================================
function traduzirErro(mensagem) {
  const erros = {
    'Invalid login credentials':       'E-mail ou senha incorretos.',
    'Email not confirmed':             'Confirme seu e-mail antes de entrar.',
    'User already registered':         'Este e-mail já está cadastrado.',
    'Password should be at least 6 characters': 'A senha deve ter no mínimo 6 caracteres.',
    'Unable to validate email address: invalid format': 'Formato de e-mail inválido.',
  }
  return erros[mensagem] || 'Ocorreu um erro. Tente novamente.'
}

// ============================================
// ESQUECEU A SENHA
// ============================================
const formRecuperar  = document.getElementById('form-recuperar')
const linkEsqueceu   = document.getElementById('link-esqueceu-senha')
const linkVoltarLogin = document.getElementById('link-voltar-login')
const btnRecuperar   = document.getElementById('btn-recuperar')

if (formRecuperar && linkEsqueceu && linkVoltarLogin && btnRecuperar) {
  btnRecuperar.dataset.texto = 'Enviar link'
  
  linkEsqueceu.addEventListener('click', (e) => {
    e.preventDefault()
    formLogin.classList.add('escondido')
    formRecuperar.classList.remove('escondido')
    limparMensagem()
  })
  
  linkVoltarLogin.addEventListener('click', (e) => {
    e.preventDefault()
    formRecuperar.classList.add('escondido')
    formLogin.classList.remove('escondido')
    limparMensagem()
  })
  
  btnRecuperar.addEventListener('click', async () => {
    const email = document.getElementById('recuperar-email').value.trim()
  
    if (!email) {
      mostrarMensagem('Digite seu e-mail.', 'erro')
      return
    }
  
    setBotaoCarregando(btnRecuperar, true)
  
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: obterUrlApp()
    })
  
    setBotaoCarregando(btnRecuperar, false)
  
    if (error) {
      mostrarMensagem(traduzirErro(error.message), 'erro')
      return
    }
  
    mostrarMensagem('Link enviado! Verifique seu e-mail.', 'sucesso')
  })
}
