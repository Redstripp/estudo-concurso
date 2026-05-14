import { describe, it, expect } from 'vitest'

const { montarRelatorioProntoProva } = globalThis

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
