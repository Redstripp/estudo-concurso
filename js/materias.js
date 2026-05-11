// js/materias.js

// ============================================
// MÓDULO DE MATÉRIAS
// ============================================

let materiasInicializado = false

// Inicializa o módulo quando a seção for acessada
function inicializarMaterias() {
  carregarMaterias()

  if (materiasInicializado) return
  materiasInicializado = true

  const btnAdicionar = document.getElementById('btn-adicionar-materia')
  const inputMateria = document.getElementById('input-materia')

  // Adicionar ao clicar no botão
  btnAdicionar.addEventListener('click', adicionarMateria)

  // Adicionar ao pressionar Enter no campo
  inputMateria.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') adicionarMateria()
  })
}

// ============================================
// CARREGAR MATÉRIAS DO BANCO
// ============================================
async function carregarMaterias() {
  const lista = document.getElementById('lista-materias')
  const placeholder = document.getElementById('placeholder-materias')

  // Mostra estado de carregando
  placeholder.textContent = '⏳ Carregando matérias...'
  placeholder.style.display = 'block'

  const { data, error } = await db
    .from('materias')
    .select('id, nome, criado_em')
    .eq('user_id', window.usuarioAtual.id)
    .order('criado_em', { ascending: true })

  if (error) {
    placeholder.textContent = '❌ Erro ao carregar matérias.'
    return
  }

  // Limpa a lista (exceto o placeholder)
  lista.innerHTML = ''

  if (!data || data.length === 0) {
    placeholder.textContent = '📚 Nenhuma matéria cadastrada ainda.'
    lista.appendChild(placeholder)
    return
  }

  // Esconde placeholder e renderiza os cards
  placeholder.style.display = 'none'
  lista.appendChild(placeholder)

  data.forEach(materia => {
    const card = criarCardMateria(materia)
    lista.appendChild(card)
  })
}

// ============================================
// CRIAR CARD DE MATÉRIA
// ============================================
function criarCardMateria(materia) {
  const card = document.createElement('div')
  card.className = 'card-materia'
  card.dataset.id = materia.id

  card.innerHTML = `
    <div class="card-materia-info">
      <span class="card-materia-icone">📚</span>
      <span class="card-materia-nome">${escaparHtmlSeguro(materia.nome)}</span>
    </div>
    <button class="btn-excluir" data-id="${materia.id}" title="Excluir matéria">
      🗑️
    </button>
  `

  // Evento de excluir
  card.querySelector('.btn-excluir').addEventListener('click', () => {
    excluirMateria(materia.id, materia.nome)
  })

  return card
}

// ============================================
// ADICIONAR MATÉRIA
// ============================================
async function adicionarMateria() {
  const input = document.getElementById('input-materia')
  const btn   = document.getElementById('btn-adicionar-materia')
  const msg   = document.getElementById('msg-materia')

  const nome = input.value.trim()

  // Validação
  if (!nome) {
    mostrarMsgMateria('Digite o nome da matéria.', 'erro')
    return
  }

  if (nome.length < 2) {
    mostrarMsgMateria('O nome deve ter pelo menos 2 caracteres.', 'erro')
    return
  }

  // Desabilita botão durante o envio
  btn.disabled = true
  btn.textContent = 'Salvando...'

  const { error } = await salvarMateriaUsuario(nome)

  btn.disabled = false
  btn.textContent = '+ Adicionar'

  if (error) {
    mostrarMsgMateria('Erro ao salvar. Tente novamente.', 'erro')
    return
  }

  // Limpa o campo e recarrega a lista
  input.value = ''
  mostrarMsgMateria('Matéria adicionada com sucesso!', 'sucesso')
  carregarMaterias()

  // Limpa a mensagem após 3 segundos
  setTimeout(() => mostrarMsgMateria('', ''), 3000)
}

async function salvarMateriaUsuario(nome) {
  return db
    .from('materias')
    .insert({
      user_id: window.usuarioAtual.id,
      nome
    })
    .select('id, nome, criado_em')
    .single()
}

// ============================================
// EXCLUIR MATÉRIA
// ============================================
async function excluirMateria(id, nome) {
  const confirmar = confirm(`Deseja excluir a matéria "${nome}"?\n\nIsso não apagará questões já cadastradas.`)
  if (!confirmar) return

  const { error } = await db
    .from('materias')
    .delete()
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)

  if (error) {
    alert('Erro ao excluir. Tente novamente.')
    return
  }

  carregarMaterias()
}

// ============================================
// MENSAGEM DE FEEDBACK
// ============================================
function mostrarMsgMateria(texto, tipo) {
  const msg = document.getElementById('msg-materia')
  msg.textContent = texto
  msg.className = `msg-materia ${tipo}`
}
