import { describe, it, expect } from 'vitest'

const {
  montarRelatorioProntoProva,
  montarFilaInteligente,
  converterDiaSemanaPlanejamento,
  adicionarDiasPlanejamento,
  dataPlanejamentoISO
} = globalThis

describe('montarRelatorioProntoProva', () => {
  it('calcula o relatório com edital, questões, revisões e Lei Seca', () => {
    const relatorio = montarRelatorioProntoProva({
      topicos: [
        { id: 't1', status: 'dominado', titulo: 'Atos administrativos', materias: { nome: 'Administrativo' } },
        { id: 't2', status: 'revisar', titulo: 'Controle de constitucionalidade', materias: { nome: 'Constitucional' } }
      ],
      questoes: [
        { tipo_questao: 'Errada', status_revisao: 'pendente', revisar_novamente_em: '2000-01-01' },
        { tipo_questao: 'Chutada', status_revisao: 'ok', revisar_novamente_em: null }
      ],
      certas: [
        { materia_id: 'm1', quantidade: 2 }
      ],
      leiSeca: [
        { status: 'ler' }
      ],
      config: {
        concurso_alvo: 'TJ',
        data_prova: null
      }
    })

    expect(relatorio).toMatchObject({
      score: 65,
      dominio: 50,
      aproveitamento: 50,
      vencidas: 1,
      leiPendentes: 1,
      concurso: 'TJ'
    })
    expect(relatorio.criticos).toHaveLength(1)
  })
})

describe('planejamento inteligente', () => {
  it('converte datas e soma dias sem depender do fuso do navegador', () => {
    expect(converterDiaSemanaPlanejamento('2026-05-17')).toBe(7)
    expect(converterDiaSemanaPlanejamento('2026-05-18')).toBe(1)
    expect(adicionarDiasPlanejamento('2026-02-28', 1)).toBe('2026-03-01')
    expect(dataPlanejamentoISO(new Date('2026-05-15T12:00:00'))).toBe('2026-05-15')
  })

  it('monta fila inteligente combinando grade, revisoes, edital e Lei Seca', () => {
    const fila = montarFilaInteligente({
      materias: [
        { id: 'm1', nome: 'Administrativo' },
        { id: 'm2', nome: 'Constitucional' }
      ],
      grade: [
        { materia_id: 'm1', dia_semana: 5, tipo_estudo: 'questoes' }
      ],
      certas: [
        { materia_id: 'm1', quantidade: 4 },
        { materia_id: 'm2', quantidade: 1 }
      ],
      questoes: [
        {
          materia_id: 'm2',
          tipo_questao: 'Errada',
          status_revisao: 'pendente',
          revisar_novamente_em: '2026-05-10',
          revisao_total_erros: 2
        }
      ],
      topicos: [
        { materia_id: 'm1', titulo: 'Atos administrativos', status: 'dificuldade', peso: 4 }
      ],
      leiSeca: [
        { materia_id: 'm2', status: 'ler', revisar_em: '2026-05-01', importancia: 4 }
      ],
      perfil: { meta_diaria: 20 },
      config: { data_prova: null }
    }, '2026-05-15')

    const administrativo = fila.find(item => item.materiaId === 'm1')
    const constitucional = fila.find(item => item.materiaId === 'm2')

    expect(administrativo).toMatchObject({
      materia: 'Administrativo',
      planejadaHoje: true,
      recomendacao: 'Teoria dirigida',
      meta: 20
    })
    expect(constitucional).toMatchObject({
      materia: 'Constitucional',
      vencidas: 1,
      leiVencida: 1,
      recomendacao: 'Revisão espaçada',
      meta: 20
    })
  })
})
