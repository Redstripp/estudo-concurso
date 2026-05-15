import { describe, it, expect, afterEach } from 'vitest'

const {
  atualizarResumoTopo,
  criarCardSessao,
  renderizarLinhasMaterias
} = globalThis

describe('sessoes helpers', () => {
  afterEach(() => {
    document.getElementById('fixture-sessoes')?.remove()
  })

  it('atualiza resumo do topo com media por dia', () => {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="fixture-sessoes">
        <span id="total-dias"></span>
        <span id="total-questoes-geral"></span>
        <span id="media-dia"></span>
      </div>
    `)

    atualizarResumoTopo(2, 5)

    expect(document.getElementById('total-dias').textContent).toBe('2')
    expect(document.getElementById('total-questoes-geral').textContent).toBe('5')
    expect(document.getElementById('media-dia').textContent).toBe('2.5')
  })

  it('renderiza linhas por materia somando erradas e certas', () => {
    const html = renderizarLinhasMaterias([
      { materias: { nome: 'Direito <b>' } },
      { materias: { nome: 'Direito <b>' } }
    ], [
      { id: 'c1', quantidade: 3, materias: { nome: 'Direito <b>' } }
    ], 'sessao-1')

    expect(html).toContain('5 feitas')
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('data-sessao="sessao-1"')
  })

  it('renderiza placeholder quando a sessao nao tem materias', () => {
    expect(renderizarLinhasMaterias([], [], 's1')).toContain('sem-materias')
  })

  it('cria card de sessao com totais calculados', () => {
    const card = criarCardSessao(
      { id: 's1', data: '2026-05-15' },
      [
        { materias: { nome: 'Administrativo' } },
        { materias: { nome: 'Administrativo' } }
      ],
      [
        { id: 'c1', quantidade: 4, materias: { nome: 'Administrativo' } }
      ]
    )

    expect(card.dataset.sessaoId).toBe('s1')
    expect(card.querySelector('.card-sessao-data').textContent).toContain('15/05/2026')
    expect(card.querySelector('.resumo-total-sessao').textContent).toContain('6')
    expect(card.querySelector('.resumo-certa-sessao').textContent).toContain('4')
    expect(card.querySelector('.resumo-errada-sessao').textContent).toContain('2')
  })
})
