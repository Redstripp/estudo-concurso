import { describe, it, expect } from 'vitest'

const {
  validarDataProvaEdital,
  filtrarTopicosEditalPorMateria,
  obterTextoBotaoConfigEdital
} = globalThis

describe('validarDataProvaEdital', () => {
  it('permite campo vazio para limpar a data da prova', () => {
    expect(validarDataProvaEdital('', { hoje: '2026-05-14' })).toEqual({
      data: null,
      erro: ''
    })
  })

  it('rejeita formato inválido', () => {
    expect(validarDataProvaEdital('14/05/2026', { hoje: '2026-05-14' }).erro)
      .toBe('Digite uma data válida para a prova.')
  })

  it('rejeita datas impossíveis', () => {
    expect(validarDataProvaEdital('2026-02-31', { hoje: '2026-05-14' }).erro)
      .toBe('Digite uma data válida para a prova.')
  })

  it('rejeita datas no passado', () => {
    expect(validarDataProvaEdital('2026-05-13', { hoje: '2026-05-14' }).erro)
      .toBe('A data da prova não pode estar no passado.')
  })

  it('aceita hoje ou uma data futura', () => {
    expect(validarDataProvaEdital('2026-05-14', { hoje: '2026-05-14' })).toEqual({
      data: '2026-05-14',
      erro: ''
    })
    expect(validarDataProvaEdital('2026-06-01', { hoje: '2026-05-14' })).toEqual({
      data: '2026-06-01',
      erro: ''
    })
  })
})

describe('filtrarTopicosEditalPorMateria', () => {
  const topicos = [
    { id: 't1', materia_id: 'm1', titulo: 'Constitucional' },
    { id: 't2', materia_id: 'm2', titulo: 'Português' },
    { id: 't3', materia_id: 'm1', titulo: 'Administrativo' }
  ]

  it('retorna todos os assuntos quando nenhuma matéria foi escolhida', () => {
    expect(filtrarTopicosEditalPorMateria(topicos, '')).toEqual(topicos)
  })

  it('retorna apenas os assuntos da matéria selecionada', () => {
    expect(filtrarTopicosEditalPorMateria(topicos, 'm1')).toEqual([
      topicos[0],
      topicos[2]
    ])
  })
})

describe('obterTextoBotaoConfigEdital', () => {
  it('usa texto de atualização quando a reta final já tem concurso ou data', () => {
    expect(obterTextoBotaoConfigEdital({ concurso_alvo: 'TJ', data_prova: null }))
      .toBe('Atualizar reta final')
    expect(obterTextoBotaoConfigEdital({ concurso_alvo: null, data_prova: '2026-06-01' }))
      .toBe('Atualizar reta final')
  })

  it('usa texto de criação quando não existe reta final preenchida', () => {
    expect(obterTextoBotaoConfigEdital(null)).toBe('Salvar reta final')
    expect(obterTextoBotaoConfigEdital({ concurso_alvo: null, data_prova: null }))
      .toBe('Salvar reta final')
  })
})
