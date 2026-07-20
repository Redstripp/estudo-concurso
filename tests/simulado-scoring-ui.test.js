import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  inicializarPontuacaoSimulado,
  salvarPerfilPontuacaoSimulado,
  criarNovaVersaoPerfilPontuacaoSimulado,
  erroIndicaSchemaPontuacaoAusenteSimulado,
  obterIdPerfilPontuacaoPersistivelSimulado,
  salvarSimulado,
  criarPerfilPontuacaoLegadoSimulado,
  normalizarErroScoringProfileService
} = globalThis

const appHtml = readFileSync(new URL('../app.html', import.meta.url), 'utf8')

function montarDomSimulado() {
  document.body.innerHTML = `
    <input id="simulado-data" value="2026-07-20">
    <input id="simulado-nome" value="Simulado local">
    <input id="simulado-banca" value="Banca configuravel">
    <input id="simulado-total" value="10">
    <input id="simulado-certas" value="7">
    <input id="simulado-erradas" value="2">
    <input id="simulado-brancas" value="1">
    <input id="simulado-tempo" value="90">
    <textarea id="simulado-comentario">Teste</textarea>
    <select id="simulado-scoring-profile"></select>
    <button id="btn-simulado-scoring-duplicar"></button>
    <button id="btn-simulado-scoring-nova-versao"></button>
    <button id="btn-simulado-scoring-ativo"></button>
    <button id="btn-simulado-scoring-importar-local"></button>
    <button id="btn-simulado-scoring-salvar"></button>
    <button id="btn-simulado-scoring-add-bloco"></button>
    <p id="simulado-scoring-status"></p>
    <div id="simulado-scoring-config">
      <input id="simulado-scoring-nome">
      <textarea id="simulado-scoring-descricao"></textarea>
      <select id="simulado-scoring-modo"><option value="simple">Simples</option><option value="negative_marking">Penalizacao</option></select>
      <input id="simulado-scoring-correta">
      <input id="simulado-scoring-errada">
      <input id="simulado-scoring-branca">
      <select id="simulado-scoring-anulada"><option value="zero">Zero</option><option value="exclude">Excluir</option></select>
      <input id="simulado-scoring-anulada-valor">
      <select id="simulado-scoring-arredondamento"><option value="matematico">Matematico</option><option value="truncar">Truncar</option></select>
      <input id="simulado-scoring-casas">
      <input id="simulado-scoring-nota-maxima">
      <input id="simulado-scoring-min-nota">
      <input id="simulado-scoring-min-percentual">
      <input id="simulado-scoring-max-erros">
      <select id="simulado-scoring-eliminar-negativa"><option value="false">Nao</option><option value="true">Sim</option></select>
      <input id="simulado-scoring-bloco-id">
      <input id="simulado-scoring-bloco-nome">
      <input id="simulado-scoring-bloco-peso">
      <input id="simulado-scoring-bloco-minimo">
      <input id="simulado-scoring-bloco-percentual">
    </div>
    <div id="simulado-scoring-blocos-lista"></div>
    <div id="simulado-scoring-preview"></div>
    <p id="msg-simulado"></p>
    <div id="lista-simulados"></div>
    <div id="simulados-resumo"></div>
  `
}

function criarDbSimulado(respostasInsert) {
  const inserts = []
  const chamadas = []
  const criarChainSelect = () => {
    const chain = {}
    ;['eq', 'order'].forEach(metodo => {
      chain[metodo] = vi.fn((...args) => {
        chamadas.push({ metodo, args })
        return chain
      })
    })
    chain.then = (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject)
    chain.catch = reject => Promise.resolve({ data: [], error: null }).catch(reject)
    return chain
  }
  globalThis.db = {
    from: vi.fn(() => ({
      insert: vi.fn(payload => {
        inserts.push(payload)
        return Promise.resolve(respostasInsert.shift() || { data: null, error: null })
      }),
      select: vi.fn(() => criarChainSelect())
    }))
  }
  return { inserts, chamadas }
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  delete globalThis.db
  globalThis.window.usuarioAtual = { id: 'usuario-teste' }
  montarDomSimulado()
})

describe('interface de pontuacao de simulados', () => {
  function criarPerfilRemoto(sobrescritas = {}) {
    return {
      ...criarPerfilPontuacaoLegadoSimulado(),
      id: '11111111-1111-4111-8111-111111111111',
      nome: 'Perfil remoto',
      descricao: 'Regra remota',
      versao: 2,
      valores: { correta: 2, errada: -1, branca: 0, anulada: 0 },
      modo: 'negative_marking',
      metadados: {
        origem: 'remoto',
        remoto: true,
        sistema: false,
        local: false,
        bloqueado: false,
        versionId: '22222222-2222-4222-8222-222222222222'
      },
      ...sobrescritas
    }
  }

  async function aguardarFilaPontuacao() {
    await Promise.resolve()
    await Promise.resolve()
  }

  function dispararMudanca(elemento) {
    elemento.dispatchEvent(new window.Event('change'))
  }

  it('carrega o motor antes de simulados.js', () => {
    expect(appHtml.indexOf('src="js/simulado-scoring.js"')).toBeGreaterThan(-1)
    expect(appHtml.indexOf('src="js/scoring-profile-service.js"')).toBeGreaterThan(appHtml.indexOf('src="js/simulado-scoring.js"'))
    expect(appHtml.indexOf('src="js/scoring-profile-service.js"')).toBeLessThan(appHtml.indexOf('src="js/simulados.js"'))
    expect(appHtml.indexOf('src="js/simulado-scoring.js"')).toBeLessThan(appHtml.indexOf('src="js/simulados.js"'))
  })

  it('preenche perfil padrao e mostra preview calculado', () => {
    inicializarPontuacaoSimulado()

    expect(document.getElementById('simulado-scoring-profile').value).toBe('legacy_simple')
    expect(document.getElementById('simulado-scoring-nome').value).toContain('Padrao')
    expect(document.getElementById('simulado-scoring-preview').textContent).toContain('Nota final')
    expect(document.getElementById('simulado-scoring-preview').textContent).toContain('7 / 10')
  })

  it('lista perfis remotos e mostra origem do perfil selecionado', async () => {
    const remoto = criarPerfilRemoto()
    vi.spyOn(globalThis, 'listarPerfisPontuacao').mockResolvedValue([
      criarPerfilPontuacaoLegadoSimulado(),
      remoto
    ])

    inicializarPontuacaoSimulado()
    await aguardarFilaPontuacao()

    const seletor = document.getElementById('simulado-scoring-profile')
    expect([...seletor.options].map(option => option.value)).toContain(remoto.id)
    seletor.value = remoto.id
    dispararMudanca(seletor)

    expect(document.getElementById('simulado-scoring-nome').value).toBe('Perfil remoto')
    expect(document.getElementById('simulado-scoring-status').textContent).toContain('Perfil remoto')
  })

  it('cria perfil remoto a partir do legado antes de mostrar sucesso', async () => {
    const remoto = criarPerfilRemoto({ nome: 'Perfil criado' })
    vi.spyOn(globalThis, 'listarPerfisPontuacao')
      .mockResolvedValueOnce([criarPerfilPontuacaoLegadoSimulado()])
      .mockResolvedValue([criarPerfilPontuacaoLegadoSimulado(), remoto])
    vi.spyOn(globalThis.ScoringProfileService, 'criarPerfilPontuacao').mockResolvedValue(remoto)

    inicializarPontuacaoSimulado()
    await aguardarFilaPontuacao()
    document.getElementById('simulado-scoring-nome').value = 'Perfil criado'

    await salvarPerfilPontuacaoSimulado()

    expect(globalThis.ScoringProfileService.criarPerfilPontuacao).toHaveBeenCalled()
    expect(document.getElementById('simulado-scoring-profile').value).toBe(remoto.id)
    expect(document.getElementById('msg-simulado').textContent).toContain('salvo na conta')
  })

  it('nao mostra sucesso local quando a RPC de criacao esta ausente', async () => {
    vi.spyOn(globalThis, 'listarPerfisPontuacao').mockResolvedValue([criarPerfilPontuacaoLegadoSimulado()])
    vi.spyOn(globalThis.ScoringProfileService, 'criarPerfilPontuacao').mockRejectedValue(
      normalizarErroScoringProfileService({ code: 'PGRST202', message: 'function missing' })
    )

    inicializarPontuacaoSimulado()
    await aguardarFilaPontuacao()
    await salvarPerfilPontuacaoSimulado()

    expect(document.getElementById('msg-simulado').className).toContain('erro')
    expect(document.getElementById('msg-simulado').textContent).toContain('migration local')
    expect(document.getElementById('simulado-scoring-profile').value).toBe('legacy_simple')
  })

  it('cria nova versao remota sem alterar a versao antiga na tela', async () => {
    const remoto = criarPerfilRemoto()
    const nova = criarPerfilRemoto({ versao: 3, metadados: { ...remoto.metadados, bloqueado: false } })
    vi.spyOn(globalThis, 'listarPerfisPontuacao')
      .mockResolvedValueOnce([criarPerfilPontuacaoLegadoSimulado(), remoto])
      .mockResolvedValue([criarPerfilPontuacaoLegadoSimulado(), nova])
    vi.spyOn(globalThis.ScoringProfileService, 'criarNovaVersaoPontuacao').mockResolvedValue(nova)

    inicializarPontuacaoSimulado()
    await aguardarFilaPontuacao()
    document.getElementById('simulado-scoring-profile').value = remoto.id
    dispararMudanca(document.getElementById('simulado-scoring-profile'))
    document.getElementById('simulado-scoring-errada').value = '-0.5'

    await criarNovaVersaoPerfilPontuacaoSimulado()

    expect(globalThis.ScoringProfileService.criarNovaVersaoPontuacao).toHaveBeenCalledWith(expect.objectContaining({
      id: remoto.id,
      valores: expect.objectContaining({ errada: -0.5 })
    }))
    expect(document.getElementById('msg-simulado').textContent).toContain('Nova versao')
    expect(document.getElementById('simulado-scoring-profile').value).toBe(remoto.id)
  })

  it('salva simulado com snapshot quando as colunas novas existem', async () => {
    inicializarPontuacaoSimulado()
    const { inserts } = criarDbSimulado([{ data: null, error: null }])

    await salvarSimulado()

    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({
      user_id: 'usuario-teste',
      total_questoes: 10,
      certas: 7,
      erradas: 2,
      blank_count: 1,
      scoring_profile_id: null,
      score_final: 7,
      score_max: 10,
      score_status: 'aprovado'
    })
    expect(inserts[0].scoring_snapshot.perfil.id).toBe('legacy_simple')
    expect(inserts[0].score_breakdown.contagens.brancas).toBe(1)
  })

  it('recarrega a versao remota antes de salvar simulado e persiste a referencia real', async () => {
    const remoto = criarPerfilRemoto()
    vi.spyOn(globalThis, 'listarPerfisPontuacao').mockResolvedValue([
      criarPerfilPontuacaoLegadoSimulado(),
      remoto
    ])
    vi.spyOn(globalThis.ScoringProfileService, 'carregarVersaoCompleta').mockResolvedValue(remoto)

    inicializarPontuacaoSimulado()
    await aguardarFilaPontuacao()
    document.getElementById('simulado-scoring-profile').value = remoto.id
    dispararMudanca(document.getElementById('simulado-scoring-profile'))

    const { inserts } = criarDbSimulado([{ data: null, error: null }])
    await salvarSimulado()

    expect(globalThis.ScoringProfileService.carregarVersaoCompleta).toHaveBeenCalledWith(remoto.id, 2)
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({
      scoring_profile_id: remoto.id,
      scoring_profile_version: 2,
      score_final: 12,
      score_max: 20
    })
    expect(inserts[0].scoring_snapshot.perfil.nome).toBe('Perfil remoto')
  })

  it('bloqueia finalizacao se o perfil remoto ficar inativo antes do salvamento', async () => {
    const remoto = criarPerfilRemoto()
    vi.spyOn(globalThis, 'listarPerfisPontuacao').mockResolvedValue([
      criarPerfilPontuacaoLegadoSimulado(),
      remoto
    ])
    vi.spyOn(globalThis.ScoringProfileService, 'carregarVersaoCompleta').mockResolvedValue({
      ...remoto,
      ativo: false
    })

    inicializarPontuacaoSimulado()
    await aguardarFilaPontuacao()
    document.getElementById('simulado-scoring-profile').value = remoto.id
    dispararMudanca(document.getElementById('simulado-scoring-profile'))

    const { inserts } = criarDbSimulado([{ data: null, error: null }])
    await salvarSimulado()

    expect(inserts).toHaveLength(0)
    expect(document.getElementById('msg-simulado').textContent).toContain('inativo')
  })

  it('perfil local antigo nunca gera referencia remota falsa', async () => {
    localStorage.setItem('estudoConcursoScoringProfiles:v1', JSON.stringify([
      {
        id: '11111111-1111-4111-8111-111111111111',
        nome: 'Perfil local antigo',
        versao: 1,
        modo: 'simple',
        valores: { correta: 1, errada: 0, branca: 0, anulada: 0 },
        anuladas: { tratamento: 'zero', valorEspecifico: 0 },
        arredondamento: { modo: 'matematico', casasDecimais: 2, etapa: 'final' },
        pesos: { padrao: 1, questoes: {}, disciplinas: {}, blocos: {}, tipos: {} },
        blocos: [],
        minimos: {},
        eliminacao: {}
      }
    ]))
    vi.spyOn(globalThis, 'listarPerfisPontuacao').mockRejectedValue(new Error('offline'))

    inicializarPontuacaoSimulado()
    document.getElementById('simulado-scoring-profile').value = 'local:11111111-1111-4111-8111-111111111111'
    dispararMudanca(document.getElementById('simulado-scoring-profile'))
    const { inserts } = criarDbSimulado([{ data: null, error: null }])

    await salvarSimulado()

    expect(inserts).toHaveLength(1)
    expect(inserts[0].scoring_profile_id).toBeNull()
    expect(inserts[0].scoring_snapshot.perfil.id).toContain('local:')
  })

  it('faz fallback para payload legado se o schema de pontuacao ainda nao existir', async () => {
    inicializarPontuacaoSimulado()
    const { inserts } = criarDbSimulado([
      { data: null, error: { message: 'column scoring_profile_id does not exist' } },
      { data: null, error: null }
    ])

    await salvarSimulado()

    expect(inserts).toHaveLength(2)
    expect(inserts[0]).toHaveProperty('scoring_snapshot')
    expect(inserts[1]).not.toHaveProperty('scoring_snapshot')
    expect(inserts[1]).toMatchObject({ total_questoes: 10, certas: 7, erradas: 2, nota_percentual: 70 })
  })

  it('mantem apenas UUID real como referencia persistivel de perfil', () => {
    expect(obterIdPerfilPontuacaoPersistivelSimulado('legacy_simple')).toBeNull()
    expect(obterIdPerfilPontuacaoPersistivelSimulado('perfil-local')).toBeNull()
    expect(obterIdPerfilPontuacaoPersistivelSimulado('11111111-1111-4111-8111-111111111111')).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('classifica fallback legado apenas para ausencia comprovada do schema', () => {
    expect(erroIndicaSchemaPontuacaoAusenteSimulado({
      code: 'PGRST204',
      message: "Could not find the 'scoring_snapshot' column of 'simulados' in the schema cache"
    })).toBe(true)
    expect(erroIndicaSchemaPontuacaoAusenteSimulado({
      code: '42P01',
      message: 'relation public.scoring_profile_versions does not exist'
    })).toBe(true)
    expect(erroIndicaSchemaPontuacaoAusenteSimulado({
      code: '42501',
      message: 'new row violates row-level security policy'
    })).toBe(false)
    expect(erroIndicaSchemaPontuacaoAusenteSimulado({
      status: 401,
      message: 'JWT expired'
    })).toBe(false)
    expect(erroIndicaSchemaPontuacaoAusenteSimulado({
      code: '23514',
      message: 'new row violates check constraint "simulados_score_status_check"'
    })).toBe(false)
    expect(erroIndicaSchemaPontuacaoAusenteSimulado({
      status: 503,
      message: 'server error while saving scoring_snapshot'
    })).toBe(false)
    expect(erroIndicaSchemaPontuacaoAusenteSimulado({
      message: 'failed to fetch'
    })).toBe(false)
    expect(erroIndicaSchemaPontuacaoAusenteSimulado({
      message: 'unexpected scoring_snapshot failure'
    })).toBe(false)
  })

  it('nao faz fallback legado para RLS, auth, constraint, rede ou erro desconhecido', async () => {
    inicializarPontuacaoSimulado()
    const { inserts } = criarDbSimulado([
      { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }
    ])

    await salvarSimulado()

    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toHaveProperty('scoring_snapshot')
    expect(document.getElementById('msg-simulado').textContent).toMatch(/N.o foi poss.vel salvar/)
  })
})
