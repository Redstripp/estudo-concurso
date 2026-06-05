import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  criarEstadoAnotacoesVazio,
  criarChaveAnotacoes,
  normalizarEstadoAnotacoes,
  carregarAnotacoes,
  salvarAnotacoes,
  limparAnotacoes
} = globalThis.AnotacoesLivres

function criarStorageMemoria() {
  const dados = new Map()
  return {
    getItem: vi.fn(chave => dados.has(chave) ? dados.get(chave) : null),
    setItem: vi.fn((chave, valor) => dados.set(chave, valor)),
    removeItem: vi.fn(chave => dados.delete(chave)),
    dados
  }
}

function criarTracoValido(sobrescritas = {}) {
  return {
    id: 'traco-1',
    tool: 'pen',
    color: 'blue',
    thickness: 'medium',
    opacity: 1,
    points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    createdAt: '2026-06-05T12:00:00.000Z',
    ...sobrescritas
  }
}

function criarEstadoComTracos(strokes, contexto = {}) {
  return {
    ...criarEstadoAnotacoesVazio({
      userId: contexto.userId || 'usuario-1',
      viewId: contexto.viewId || 'secao:flashcards',
      referenceWidth: contexto.referenceWidth || 1200
    }),
    strokes
  }
}

describe('modelo local de anotações livres', () => {
  let storage

  beforeEach(() => {
    storage = criarStorageMemoria()
  })

  describe('chave de localStorage', () => {
    it('cria chave versionada com usuário e viewId', () => {
      expect(criarChaveAnotacoes({ userId: 'user-123', viewId: 'secao:dashboard' }))
        .toBe('estudoConcursoAnotacoes:v1:user-123:secao:dashboard')
    })

    it('diferencia usuários e seções', () => {
      const dashboard = criarChaveAnotacoes({ userId: 'user-1', viewId: 'secao:dashboard' })
      const questoes = criarChaveAnotacoes({ userId: 'user-1', viewId: 'secao:questoes' })
      const outroUsuario = criarChaveAnotacoes({ userId: 'user-2', viewId: 'secao:dashboard' })

      expect(new Set([dashboard, questoes, outroUsuario]).size).toBe(3)
    })

    it('aceita fallback anônimo e sanitiza partes inseguras', () => {
      expect(criarChaveAnotacoes({ viewId: 'secao:<script>' }))
        .toBe('estudoConcursoAnotacoes:v1:anonimo:secao:_script')
    })
  })

  describe('estado vazio', () => {
    it('cria contrato vazio válido preservando contexto', () => {
      const estado = criarEstadoAnotacoesVazio({
        userId: 'usuario-1',
        viewId: 'secao:edital',
        referenceWidth: 1440
      })

      expect(estado).toMatchObject({
        version: 1,
        userId: 'usuario-1',
        viewId: 'secao:edital',
        referenceWidth: 1440,
        strokes: []
      })
      expect(new Date(estado.updatedAt).toISOString()).toBe(estado.updatedAt)
    })
  })

  describe('salvamento, carregamento e isolamento', () => {
    it('salva estado válido e carrega o mesmo conteúdo normalizado', () => {
      const estado = criarEstadoComTracos([criarTracoValido()])
      const resultado = salvarAnotacoes(estado, { storage })
      const carregado = carregarAnotacoes({
        userId: 'usuario-1',
        viewId: 'secao:flashcards',
        storage
      })

      expect(resultado.ok).toBe(true)
      expect(storage.setItem).toHaveBeenCalledTimes(1)
      expect(carregado.strokes).toEqual([criarTracoValido()])
    })

    it('remove somente a chave da seção atual', () => {
      salvarAnotacoes(criarEstadoComTracos([criarTracoValido()]), { storage })
      salvarAnotacoes(criarEstadoComTracos([criarTracoValido()], { viewId: 'secao:questoes' }), { storage })

      expect(limparAnotacoes({ userId: 'usuario-1', viewId: 'secao:flashcards', storage }).ok).toBe(true)
      expect(carregarAnotacoes({ userId: 'usuario-1', viewId: 'secao:flashcards', storage }).strokes).toEqual([])
      expect(carregarAnotacoes({ userId: 'usuario-1', viewId: 'secao:questoes', storage }).strokes).toHaveLength(1)
    })

    it('isola anotações por seção e por usuário', () => {
      salvarAnotacoes(criarEstadoComTracos([criarTracoValido()]), { storage })

      expect(carregarAnotacoes({ userId: 'usuario-1', viewId: 'secao:questoes', storage }).strokes).toEqual([])
      expect(carregarAnotacoes({ userId: 'usuario-2', viewId: 'secao:flashcards', storage }).strokes).toEqual([])
    })
  })

  describe('validação segura', () => {
    it('retorna estado vazio para JSON ausente, corrompido ou versão incompatível', () => {
      const contexto = { userId: 'usuario-1', viewId: 'secao:dashboard', storage }
      expect(carregarAnotacoes(contexto).strokes).toEqual([])

      storage.setItem(criarChaveAnotacoes(contexto), '{json inválido')
      expect(carregarAnotacoes(contexto).strokes).toEqual([])

      storage.setItem(criarChaveAnotacoes(contexto), JSON.stringify({
        ...criarEstadoAnotacoesVazio(contexto),
        version: 2,
        strokes: [criarTracoValido()]
      }))
      expect(carregarAnotacoes(contexto).strokes).toEqual([])
    })

    it('descarta ferramenta, cor e espessura inválidas', () => {
      const estado = criarEstadoComTracos([
        criarTracoValido({ id: 'ferramenta', tool: '<script>' }),
        criarTracoValido({ id: 'cor', color: 'url(javascript:alert(1))' }),
        criarTracoValido({ id: 'espessura', thickness: '999px' }),
        criarTracoValido({ id: 'valido' })
      ])

      expect(normalizarEstadoAnotacoes(estado, estado).strokes.map(traco => traco.id)).toEqual(['valido'])
    })

    it('descarta pontos inválidos e mantém somente coordenadas numéricas finitas', () => {
      const estado = criarEstadoComTracos([
        criarTracoValido({
          points: [
            { x: 1, y: 2 },
            { x: '3', y: 4 },
            { x: NaN, y: 5 },
            { x: Infinity, y: 6 },
            { x: -1, y: 7 },
            { x: 8 },
            null
          ]
        })
      ])

      expect(normalizarEstadoAnotacoes(estado, estado).strokes[0].points).toEqual([{ x: 1, y: 2 }])
    })

    it('não mantém HTML ou CSS arbitrário nos campos controlados', () => {
      const estado = criarEstadoComTracos([
        criarTracoValido({ id: '<img src=x onerror=alert(1)>' }),
        criarTracoValido({ id: 'css', color: 'expression(alert(1))' })
      ], {
        userId: '<script>alert(1)</script>',
        viewId: 'secao:<img-onerror>'
      })

      const normalizado = normalizarEstadoAnotacoes(estado, estado)
      const serializado = JSON.stringify(normalizado)

      expect(serializado).not.toContain('<script')
      expect(serializado).not.toContain('<img')
      expect(serializado).not.toContain('expression(')
      expect(normalizado.strokes).toHaveLength(1)
    })
  })

  describe('limites e falhas controladas', () => {
    it('limita quantidade de traços e pontos sem quebrar com arrays grandes', () => {
      const muitosPontos = Array.from({ length: 1200 }, (_, indice) => ({ x: indice, y: indice }))
      const muitosTracos = Array.from({ length: 250 }, (_, indice) => criarTracoValido({
        id: `traco-${indice}`,
        points: muitosPontos
      }))

      const normalizado = normalizarEstadoAnotacoes(criarEstadoComTracos(muitosTracos), {
        userId: 'usuario-1',
        viewId: 'secao:flashcards'
      })

      expect(normalizado.strokes).toHaveLength(200)
      expect(normalizado.strokes[0].points).toHaveLength(1000)
    })

    it('retorna falha controlada quando a cota do storage é excedida', () => {
      const erro = new Error('quota')
      erro.name = 'QuotaExceededError'
      const storageSemCota = {
        setItem: vi.fn(() => { throw erro })
      }

      expect(salvarAnotacoes(criarEstadoComTracos([criarTracoValido()]), { storage: storageSemCota }))
        .toEqual({ ok: false, motivo: 'quota-excedida' })
    })
  })
})
