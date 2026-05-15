import { describe, it, expect, afterEach, vi } from 'vitest'

const {
  obterIconeMateria,
  criarCardMateria,
  salvarMateriaUsuario,
  mostrarMsgMateria
} = globalThis

describe('materias helpers', () => {
  afterEach(() => {
    document.getElementById('fixture-materias')?.remove()
  })

  it('retorna icone especifico ou padrao para materia', () => {
    expect(obterIconeMateria('Direito Administrativo')).not.toBe(obterIconeMateria('Materia sem mapeamento'))
  })

  it('cria card de materia escapando o nome', () => {
    const card = criarCardMateria({ id: 'm1', nome: 'Direito <script>' })

    expect(card).toBeInstanceOf(HTMLElement)
    expect(card.dataset.id).toBe('m1')
    expect(card.querySelector('.card-materia-nome').textContent).toBe('Direito <script>')
    expect(card.querySelectorAll('script')).toHaveLength(0)
  })

  it('salva materia do usuario no banco', async () => {
    const dbAnterior = globalThis.db
    const usuarioAnterior = window.usuarioAtual
    const single = vi.fn(async () => ({ data: { id: 'm1', nome: 'Direito' }, error: null }))
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))

    globalThis.db = { from }
    window.usuarioAtual = { id: 'user-1' }

    try {
      const resultado = await salvarMateriaUsuario('Direito')

      expect(from).toHaveBeenCalledWith('materias')
      expect(insert).toHaveBeenCalledWith({ user_id: 'user-1', nome: 'Direito' })
      expect(select).toHaveBeenCalledWith('id, nome, criado_em')
      expect(resultado.data).toEqual({ id: 'm1', nome: 'Direito' })
    } finally {
      globalThis.db = dbAnterior
      window.usuarioAtual = usuarioAnterior
    }
  })

  it('mostra mensagem de materia no DOM', () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="fixture-materias"><p id="msg-materia"></p></div>')

    mostrarMsgMateria('Salvo', 'sucesso')

    const msg = document.getElementById('msg-materia')
    expect(msg.textContent).toBe('Salvo')
    expect(msg.className).toBe('msg-materia sucesso')
  })
})
