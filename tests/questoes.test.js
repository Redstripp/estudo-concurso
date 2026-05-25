import { describe, it, expect, vi } from 'vitest'

// Importa as funções reais de js/questoes.js via globalThis
const {
  MODELO_RESPOSTA_CHATGPT,
  escaparHtmlSeguro,
  CONFIG_TIPO_QUESTAO,
  normalizarTipoQuestao,
  normalizarStatusRevisao,
  obterTipoQuestaoPorCampos,
  questaoChutadaAcertada,
  normalizarTextoDuplicidade,
  alterarQuantidadeAlternativas,
  ordenarQuestoes,
  montarPromptDiagnosticoChatGPT,
  montarPromptFlashcardsQuestao,
  coletarDadosPromptFlashcardsQuestao,
  abrirPromptFlashcardsQuestao,
  copiarPromptFlashcardsQuestao,
  abrirColarFlashcardsIA,
  previsualizarFlashcardsIA,
  adicionarFlashcardsPreviewIAAoDeck,
  extrairFlashcardsRespostaIA,
  identificarCampoFlashcardIA,
  identificarInicioCardFlashcardIA,
  copiarModeloRespostaChatGPT,
  previsualizarRespostaChatGPT,
  aplicarRespostaChatGPT,
  extrairCamposRespostaChatGPT,
  identificarCampoRespostaChatGPT,
  obterOuCriarSessaoDeHoje,
  recalcularTotalQuestoesSessao
} = globalThis

function montarFormularioAlternativas() {
  document.body.innerHTML = `
    <select id="q-materia">
      <option value="">Selecione...</option>
      <option value="mat-1">Direito Constitucional</option>
    </select>
    <select id="q-edital-topico">
      <option value="">Sem assunto específico</option>
      <option value="topico-1">Fintechs</option>
    </select>
    <input id="q-banca" />
    <textarea id="q-enunciado"></textarea>
    <textarea id="q-comentario"></textarea>
    <textarea id="q-pegadinha-banca"></textarea>
    <textarea id="q-conceito-chave"></textarea>
    <textarea id="q-como-reconhecer"></textarea>
    <textarea id="q-acao-corretiva"></textarea>
    <select id="q-motivo-erro">
      <option value="">Selecione...</option>
      <option value="Interpretação incorreta">Interpretação incorreta</option>
    </select>
    <select id="q-nivel-confianca">
      <option value="">Selecione...</option>
      <option value="Baixa confiança">Baixa confiança</option>
    </select>
    <div id="campos-alternativas"></div>
    <div id="grupo-marcada"></div>
    <div id="grupo-correta"></div>
  `
}

function clicarBotaoAlternativa(seletor, letra) {
  const botao = Array.from(document.querySelectorAll(seletor))
    .find(btn => btn.textContent === letra)
  botao?.click()
}

describe('escaparHtmlSeguro', () => {
  it('escapa < para &lt;', () => {
    expect(escaparHtmlSeguro('<script>')).toBe('&lt;script&gt;')
  })

  it('escapa > para &gt;', () => {
    expect(escaparHtmlSeguro('a > b')).toBe('a &gt; b')
  })

  it('escapa & para &amp;', () => {
    expect(escaparHtmlSeguro('A & B')).toBe('A &amp; B')
  })

  it('escapa aspas duplas para &quot;', () => {
    expect(escaparHtmlSeguro('diz "oi"')).toBe('diz &quot;oi&quot;')
  })

  it('retorna string vazia para null', () => {
    expect(escaparHtmlSeguro(null)).toBe('')
  })

  it('retorna string vazia para undefined', () => {
    expect(escaparHtmlSeguro(undefined)).toBe('')
  })

  it('não altera texto sem caracteres especiais', () => {
    expect(escaparHtmlSeguro('texto normal')).toBe('texto normal')
  })
})

describe('normalizarTipoQuestao', () => {
  it("{ tipo_questao: 'Chutada' } deve retornar 'Chutada'", () => {
    expect(normalizarTipoQuestao({ tipo_questao: 'Chutada' })).toBe('Chutada')
  })

  it("{ tipo_questao: 'Errada' } deve retornar 'Errada'", () => {
    expect(normalizarTipoQuestao({ tipo_questao: 'Errada' })).toBe('Errada')
  })

  it("{ motivo_erro: 'Chute completo' } deve retornar 'Chutada'", () => {
    expect(normalizarTipoQuestao({ motivo_erro: 'Chute completo' })).toBe('Chutada')
  })

  it("{ nivel_confianca: 'Chutei' } deve retornar 'Chutada'", () => {
    expect(normalizarTipoQuestao({ nivel_confianca: 'Chutei' })).toBe('Chutada')
  })

  it('{} deve retornar Errada', () => {
    expect(normalizarTipoQuestao({})).toBe('Errada')
  })
})

describe('normalizarStatusRevisao', () => {
  it("{ status_revisao: 'recuperada' } deve retornar 'recuperada'", () => {
    expect(normalizarStatusRevisao({ status_revisao: 'recuperada' })).toBe('recuperada')
  })

  it("{ status_revisao: 'pendente' } deve retornar 'pendente'", () => {
    expect(normalizarStatusRevisao({ status_revisao: 'pendente' })).toBe('pendente')
  })

  it('{} deve retornar pendente', () => {
    expect(normalizarStatusRevisao({})).toBe('pendente')
  })
})

describe('obterTipoQuestaoPorCampos', () => {
  it('identifica Chutada por motivo exclusivo de chute', () => {
    expect(obterTipoQuestaoPorCampos('Chute completo', '', 'motivo')).toBe('Chutada')
  })

  it('identifica Errada por motivo exclusivo de erro', () => {
    expect(obterTipoQuestaoPorCampos('Falta de conteúdo', '', 'motivo')).toBe('Errada')
  })

  it('prioriza o campo alterado para reverter de Chutada para Errada', () => {
    expect(obterTipoQuestaoPorCampos('Falta de conteúdo', 'Chutei', 'motivo')).toBe('Errada')
  })

  it('não força troca de tipo com valores compartilhados', () => {
    expect(obterTipoQuestaoPorCampos('Dúvida entre alternativas', 'Não informado')).toBe('')
  })
})

describe('questaoChutadaAcertada', () => {
  it('Questão Chutada com marcada === correta deve retornar true', () => {
    const questao = {
      tipo_questao: 'Chutada',
      alternativa_marcada: 'A',
      alternativa_correta: 'A'
    }
    expect(questaoChutadaAcertada(questao)).toBe(true)
  })

  it('Questão Chutada com marcada !== correta deve retornar false', () => {
    const questao = {
      tipo_questao: 'Chutada',
      alternativa_marcada: 'A',
      alternativa_correta: 'B'
    }
    expect(questaoChutadaAcertada(questao)).toBe(false)
  })

  it('Questão Errada com marcada === correta deve retornar false', () => {
    const questao = {
      tipo_questao: 'Errada',
      alternativa_marcada: 'A',
      alternativa_correta: 'A'
    }
    expect(questaoChutadaAcertada(questao)).toBe(false)
  })
})

describe('normalizarTextoDuplicidade', () => {
  it('Deve remover acentos', () => {
    expect(normalizarTextoDuplicidade('café')).toBe('cafe')
    expect(normalizarTextoDuplicidade('órgão')).toBe('orgao')
  })

  it('Deve converter para minúsculas', () => {
    expect(normalizarTextoDuplicidade('TEXTO')).toBe('texto')
  })

  it('Deve remover caracteres especiais', () => {
    expect(normalizarTextoDuplicidade('texto@#!especial')).toBe('texto especial')
  })

  it('Deve retornar string vazia para null', () => {
    expect(normalizarTextoDuplicidade(null)).toBe('')
  })
})

describe('alterarQuantidadeAlternativas', () => {
  it('preserva campos preenchidos e alternativas compativeis ao reduzir a quantidade', () => {
    montarFormularioAlternativas()
    alterarQuantidadeAlternativas(5)

    document.getElementById('q-materia').value = 'mat-1'
    document.getElementById('q-edital-topico').value = 'topico-1'
    document.getElementById('q-banca').value = 'FGV'
    document.getElementById('q-enunciado').value = 'Enunciado preenchido'
    document.getElementById('q-comentario').value = 'Comentário preenchido'
    document.getElementById('q-pegadinha-banca').value = 'Pegadinha preenchida'
    document.getElementById('q-conceito-chave').value = 'Conceito preenchido'
    document.getElementById('q-como-reconhecer').value = 'Reconhecer preenchido'
    document.getElementById('q-acao-corretiva').value = 'Ação preenchida'
    document.getElementById('q-motivo-erro').value = 'Interpretação incorreta'
    document.getElementById('q-nivel-confianca').value = 'Baixa confiança'
    document.getElementById('alt-A').value = 'Alternativa A'
    document.getElementById('alt-B').value = 'Alternativa B'
    document.getElementById('alt-C').value = 'Alternativa C'
    document.getElementById('alt-D').value = 'Alternativa D'
    document.getElementById('alt-E').value = 'Alternativa E'
    clicarBotaoAlternativa('#grupo-marcada .btn-letra', 'B')
    clicarBotaoAlternativa('#grupo-correta .btn-letra', 'D')

    alterarQuantidadeAlternativas(4)

    expect(document.getElementById('q-materia').value).toBe('mat-1')
    expect(document.getElementById('q-edital-topico').value).toBe('topico-1')
    expect(document.getElementById('q-banca').value).toBe('FGV')
    expect(document.getElementById('q-enunciado').value).toBe('Enunciado preenchido')
    expect(document.getElementById('q-comentario').value).toBe('Comentário preenchido')
    expect(document.getElementById('q-pegadinha-banca').value).toBe('Pegadinha preenchida')
    expect(document.getElementById('q-conceito-chave').value).toBe('Conceito preenchido')
    expect(document.getElementById('q-como-reconhecer').value).toBe('Reconhecer preenchido')
    expect(document.getElementById('q-acao-corretiva').value).toBe('Ação preenchida')
    expect(document.getElementById('q-motivo-erro').value).toBe('Interpretação incorreta')
    expect(document.getElementById('q-nivel-confianca').value).toBe('Baixa confiança')
    expect(document.getElementById('alt-A').value).toBe('Alternativa A')
    expect(document.getElementById('alt-B').value).toBe('Alternativa B')
    expect(document.getElementById('alt-C').value).toBe('Alternativa C')
    expect(document.getElementById('alt-D').value).toBe('Alternativa D')
    expect(document.getElementById('alt-E')).toBeNull()
    expect(document.querySelector('#grupo-marcada .selecionado-errado')?.textContent).toBe('B')
    expect(document.querySelector('#grupo-correta .selecionado-certo')?.textContent).toBe('D')
  })

  it('descarta somente selecoes fora da nova quantidade', () => {
    montarFormularioAlternativas()
    alterarQuantidadeAlternativas(5)

    document.getElementById('alt-A').value = 'Alternativa A'
    document.getElementById('alt-B').value = 'Alternativa B'
    document.getElementById('alt-C').value = 'Alternativa C'
    document.getElementById('alt-D').value = 'Alternativa D'
    document.getElementById('alt-E').value = 'Alternativa E'
    clicarBotaoAlternativa('#grupo-marcada .btn-letra', 'E')
    clicarBotaoAlternativa('#grupo-correta .btn-letra', 'E')

    alterarQuantidadeAlternativas(4)

    expect(document.getElementById('alt-A').value).toBe('Alternativa A')
    expect(document.getElementById('alt-B').value).toBe('Alternativa B')
    expect(document.getElementById('alt-C').value).toBe('Alternativa C')
    expect(document.getElementById('alt-D').value).toBe('Alternativa D')
    expect(document.getElementById('alt-E')).toBeNull()
    expect(document.querySelector('#grupo-marcada .selecionado-errado')).toBeNull()
    expect(document.querySelector('#grupo-correta .selecionado-certo')).toBeNull()
  })
})

describe('prompt manual da IA', () => {
  it('gera prompt aprimorado com formato obrigatorio e dados da questao', () => {
    const prompt = montarPromptDiagnosticoChatGPT({
      materia: 'Direito Constitucional',
      topico: 'Controle de constitucionalidade',
      banca: 'Cespe',
      tipoQuestao: 'Errada',
      motivoErro: 'Interpretação incorreta',
      enunciado: 'Enunciado da questão',
      textoAlternativas: 'A) Alternativa correta\nB) Alternativa marcada',
      textoMarcada: 'B) Alternativa marcada',
      textoCorreta: 'A) Alternativa correta',
      comentario: 'Comentário do professor já existente',
      pegadinha: ''
    })

    expect(prompt).toContain('Você é uma IA especialista em análise de questões de concurso público')
    expect(prompt).toContain('FONTE E LIMITES:')
    expect(prompt).toContain('Use apenas o material fornecido')
    expect(prompt).toContain('Comentário do professor já existente')
    expect(prompt).toContain('Motivo do erro:\nInterpretação incorreta')
    expect(prompt).toContain('\nCOMENTÁRIO:\n')
    expect(prompt).toContain('\nPEGADINHAS:\n')
    expect(prompt).toContain('\nCONCEITO:\n')
    expect(prompt).toContain('\nRECONHECER:\n')
    expect(prompt).toContain('\nAÇÃO CORRETIVA:\n')
    expect(prompt).toContain('Tipo de registro:\nErrada')
    expect(prompt).not.toContain('\nACAO:\n')
  })

  it('orienta comentario didatico sem inventar fundamento externo', () => {
    const prompt = montarPromptDiagnosticoChatGPT({
      materia: 'Direito Administrativo',
      topico: 'Atos administrativos',
      banca: 'FCC',
      tipoQuestao: 'Errada',
      motivoErro: 'Falta de conteúdo',
      enunciado: 'Enunciado da questão',
      textoAlternativas: 'A) Alternativa marcada\nB) Alternativa correta',
      textoMarcada: 'A) Alternativa marcada',
      textoCorreta: 'B) Alternativa correta',
      comentario: '',
      pegadinha: ''
    })

    expect(prompt).toContain('Alternativa correta: explique por que está correta, conectando ao conceito cobrado.')
    expect(prompt).toContain('Alternativa marcada pelo usuário, se houver: explique especificamente o erro de raciocínio')
    expect(prompt).toContain('Demais alternativas: explique o erro de cada uma apenas quando o material fornecido permitir')
    expect(prompt).toContain('Síntese do aprendizado: em 3 a 5 linhas')
    expect(prompt).toContain('Não invente lei, artigo, súmula, jurisprudência, doutrina ou fundamento externo')
    expect(prompt).toContain('O material fornecido não contém informação suficiente para justificar esta alternativa.')
    expect(prompt).toContain('Se não houver comentário original, analise exclusivamente com base no enunciado e nas alternativas.')
    expect(prompt).toContain('Alternativa que marquei:\nA) Alternativa marcada')
    expect(prompt).toContain('Alternativa correta:\nB) Alternativa correta')
    expect(prompt).toContain('Motivo do erro:\nFalta de conteúdo')
  })

  it('inclui pegadinhas classicas e acao corretiva pratica', () => {
    const prompt = montarPromptDiagnosticoChatGPT({
      materia: '',
      topico: '',
      banca: '',
      tipoQuestao: 'Errada',
      motivoErro: '',
      enunciado: 'Enunciado',
      textoAlternativas: 'A) Errada\nB) Correta',
      textoMarcada: 'A) Errada',
      textoCorreta: 'B) Correta',
      comentario: '',
      pegadinha: ''
    })

    expect(prompt).toContain('Palavras absolutas ou restritivas: sempre, nunca, somente, apenas, todos, nenhum.')
    expect(prompt).toContain('Troca de conceitos parecidos: institutos similares com regimes diferentes.')
    expect(prompt).toContain('Inversão de lógica: causa e consequência trocadas.')
    expect(prompt).toContain('Exceções escondidas: regra geral apresentada como absoluta.')
    expect(prompt).toContain('Alternativas parcialmente corretas: verdadeira no início, errada no final.')
    expect(prompt).toContain('Lei literal vs. interpretação doutrinária')
    expect(prompt).toContain('Indique uma ação prática, específica e realizável')
    expect(prompt).toContain('Evite ações genéricas como "estudar mais o assunto".')
  })

  it('mantem o formato rigido dos rotulos na ordem esperada', () => {
    const prompt = montarPromptDiagnosticoChatGPT({
      materia: '',
      topico: '',
      banca: '',
      tipoQuestao: 'Errada',
      motivoErro: '',
      enunciado: 'Enunciado',
      textoAlternativas: 'A) Errada\nB) Correta',
      textoMarcada: 'A) Errada',
      textoCorreta: 'B) Correta',
      comentario: '',
      pegadinha: ''
    })
    const rotulos = ['COMENTÁRIO:', 'PEGADINHAS:', 'CONCEITO:', 'RECONHECER:', 'AÇÃO CORRETIVA:']
    const posicoes = rotulos.map(rotulo => prompt.indexOf(`\n${rotulo}\n`))

    expect(posicoes.every(posicao => posicao > -1)).toBe(true)
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b))
    expect(prompt).not.toContain('\nACAO:\n')
    expect(prompt).not.toContain('\nEXPLICAÇÃO:\n')
  })
})

describe('prompt de flashcards da questao', () => {
  const dadosCompletos = {
    materia: 'Direito Constitucional',
    assunto: 'Controle de constitucionalidade',
    banca: 'Cespe',
    enunciado: 'Enunciado completo da questao',
    textoAlternativas: 'A) Errada\nB) Correta',
    textoMarcada: 'A) Errada',
    textoCorreta: 'B) Correta',
    comentario: 'Comentario do professor',
    pegadinhas: 'Pegadinha da banca',
    conceito: 'Conceito central',
    reconhecer: 'Reconhecer pelo comando',
    acaoCorretiva: 'Criar quadro comparativo',
    motivoErro: 'Interpretacao incorreta'
  }

  it('gera prompt com dados completos da questao e regras principais', () => {
    const prompt = montarPromptFlashcardsQuestao(dadosCompletos)

    expect(prompt).toContain('criar entre 2 e 5 flashcards')
    expect(prompt).toContain('Um conceito por card')
    expect(prompt).toContain('recuperação ativa')
    expect(prompt).toContain('Não invente lei, artigo, súmula, jurisprudência, doutrina ou fundamento')
    expect(prompt).toContain('Material insuficiente para preencher este campo.')
    expect(prompt).toContain('CARD [N] — [TIPO DO CARD]')
    expect(prompt).toContain('\nFRENTE:\n')
    expect(prompt).toContain('\nVERSO:\n')
    expect(prompt).toContain('\nCONTEXTO:\n')
    expect(prompt).toContain('\nRECONHECER:\n')
    expect(prompt).toContain('\nALERTA DE BANCA:\n')
  })

  it('orienta flashcards autocontidos e independentes da questao original', () => {
    const prompt = montarPromptFlashcardsQuestao(dadosCompletos)

    expect(prompt).toContain('AUTONOMIA TOTAL DO CARD')
    expect(prompt).toContain('Cada flashcard deve funcionar sozinho')
    expect(prompt).toContain('sem exigir que o estudante veja a questão original')
    expect(prompt).toContain('letras de alternativas')
    expect(prompt).toContain('alternativa correta')
    expect(prompt).toContain('alternativa marcada')
    expect(prompt).toContain('conforme o enunciado')
    expect(prompt).toContain('Transforme alternativa, erro ou pegadinha em conceito universal')
    expect(prompt).toContain('padrão de cobrança generalizado')
    expect(prompt).toContain('armadilha genérica e reutilizável')
  })

  it('inclui os dados herdados do Caderno de Erros', () => {
    const prompt = montarPromptFlashcardsQuestao(dadosCompletos)

    expect(prompt).toContain('Matéria:\nDireito Constitucional')
    expect(prompt).toContain('Assunto:\nControle de constitucionalidade')
    expect(prompt).toContain('Banca:\nCespe')
    expect(prompt).toContain('Enunciado:\nEnunciado completo da questao')
    expect(prompt).toContain('Alternativas:\nA) Errada\nB) Correta')
    expect(prompt).toContain('Alternativa correta:\nB) Correta')
    expect(prompt).toContain('Comentário:\nComentario do professor')
    expect(prompt).toContain('Pegadinhas:\nPegadinha da banca')
    expect(prompt).toContain('Conceito:\nConceito central')
    expect(prompt).toContain('Como reconhecer:\nReconhecer pelo comando')
    expect(prompt).toContain('Ação corretiva:\nCriar quadro comparativo')
  })

  it('gera prompt mesmo sem comentario usando enunciado e alternativas', () => {
    const prompt = montarPromptFlashcardsQuestao({
      ...dadosCompletos,
      comentario: ''
    })

    expect(prompt).toContain('Enunciado:\nEnunciado completo da questao')
    expect(prompt).toContain('Alternativas:\nA) Errada\nB) Correta')
    expect(prompt).toContain('Comentário:\n[não informado]')
  })

  it('coleta dados preenchidos no formulario e bloqueia prompt sem enunciado', () => {
    montarFormularioAlternativas()
    alterarQuantidadeAlternativas(2)
    document.getElementById('q-materia').value = 'mat-1'
    document.getElementById('q-edital-topico').value = 'topico-1'
    document.getElementById('q-banca').value = 'FGV'
    document.getElementById('q-enunciado').value = 'Enunciado do formulario'
    document.getElementById('q-comentario').value = 'Comentario'
    document.getElementById('q-pegadinha-banca').value = 'Pegadinha'
    document.getElementById('q-conceito-chave').value = 'Conceito'
    document.getElementById('q-como-reconhecer').value = 'Reconhecer'
    document.getElementById('q-acao-corretiva').value = 'Acao'
    document.getElementById('q-motivo-erro').value = 'Interpretação incorreta'
    document.getElementById('alt-A').value = 'Alternativa A'
    document.getElementById('alt-B').value = 'Alternativa B'
    clicarBotaoAlternativa('#grupo-marcada .btn-letra', 'A')
    clicarBotaoAlternativa('#grupo-correta .btn-letra', 'B')

    const dados = coletarDadosPromptFlashcardsQuestao()

    expect(dados.materia).toBe('Direito Constitucional')
    expect(dados.assunto).toBe('Fintechs')
    expect(dados.banca).toBe('FGV')
    expect(dados.textoAlternativas).toBe('A) Alternativa A\nB) Alternativa B')
    expect(dados.textoMarcada).toBe('A) Alternativa A')
    expect(dados.textoCorreta).toBe('B) Alternativa B')

    document.getElementById('q-enunciado').value = ''
    document.body.insertAdjacentHTML('beforeend', '<p id="msg-questao"></p>')
    abrirPromptFlashcardsQuestao()

    expect(document.getElementById('msg-questao').textContent).toBe('Preencha ao menos o enunciado da questão antes de gerar o prompt de flashcards.')
    expect(document.getElementById('modal-prompt-flashcards-questao')).toBeNull()
  })

  it('copia o prompt de flashcards para a area de transferencia', async () => {
    const writeText = vi.fn().mockResolvedValue()
    const descritorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      configurable: true
    })
    document.body.innerHTML = `
      <textarea id="texto-prompt-flashcards-questao">PROMPT</textarea>
      <p id="msg-prompt-flashcards-questao"></p>
    `

    await copiarPromptFlashcardsQuestao()

    expect(writeText).toHaveBeenCalledWith('PROMPT')
    expect(document.getElementById('msg-prompt-flashcards-questao').textContent).toBe('Prompt de flashcards copiado.')

    if (descritorNavigator) {
      Object.defineProperty(globalThis, 'navigator', descritorNavigator)
    } else {
      delete globalThis.navigator
    }
  })
})

describe('modelo de resposta da IA', () => {
  it('mantem o modelo no formato entendido pelo parser', () => {
    expect(MODELO_RESPOSTA_CHATGPT).toBe(`COMENTÁRIO:
[Explique a questão com base no material fornecido.]

PEGADINHAS:
[Liste as pegadinhas.]

CONCEITO:
[Explique o conceito central.]

RECONHECER:
[Explique como reconhecer na próxima vez.]

AÇÃO CORRETIVA:
[Explique o que devo fazer para não errar novamente.]`)
  })

  it('copia o modelo de resposta para a area de transferencia', async () => {
    const writeText = vi.fn().mockResolvedValue()
    const descritorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      configurable: true
    })
    const botao = document.createElement('button')
    botao.textContent = 'Copiar modelo de resposta'

    await copiarModeloRespostaChatGPT({ currentTarget: botao })

    expect(writeText).toHaveBeenCalledWith(MODELO_RESPOSTA_CHATGPT)
    expect(botao.textContent).toBe('Modelo copiado.')

    if (descritorNavigator) {
      Object.defineProperty(globalThis, 'navigator', descritorNavigator)
    } else {
      delete globalThis.navigator
    }
  })
})

describe('parser da resposta manual da IA', () => {
  it('nao transforma linhas de pegadinhas com conceito em rotulo CONCEITO', () => {
    const resposta = `PEGADINHAS:
Troca de termos parecidos: a questão troca características da Sociedade de Empréstimo entre Pessoas e da Sociedade de Crédito Direto.
Inversão de conceito: a afirmativa II atribui à Sociedade de Empréstimo entre Pessoas a oferta de crédito com recursos próprios, mas o comentário informa que são recursos de terceiros.
Inversão de conceito: a afirmativa III diz que a Sociedade de Crédito Direto pode captar recursos diretamente do público, mas ela não está autorizada a fazer isso.
Confusão entre conceitos: a afirmativa IV atribui à Sociedade de Crédito Direto a infraestrutura eletrônica para conectar credores e tomadores, mas essa característica é da Sociedade de Empréstimo entre Pessoas.

CONCEITO:
Diferença entre os dois tipos de fintechs de crédito: Sociedade de Empréstimo entre Pessoas realiza intermediação financeira entre credores e devedores, usando recursos de terceiros e oferecendo infraestrutura eletrônica para conectar credores e tomadores. Sociedade de Crédito Direto não está autorizada a captar recursos diretamente do público para concessão de crédito.

RECONHECER:
Observar os nomes das instituições: “Sociedade de Empréstimo entre Pessoas” e “Sociedade de Crédito Direto”. Quando a questão mencionar “intermediação”, “recursos de terceiros” ou “conectar credores e tomadores”, associar à Sociedade de Empréstimo entre Pessoas. Quando aparecer “captar recursos diretamente do público”, identificar como afirmação incorreta para Sociedade de Crédito Direto.

ACAO:
Criar um quadro comparativo entre Sociedade de Empréstimo entre Pessoas e Sociedade de Crédito Direto, destacando: quem usa recursos próprios ou de terceiros, quem conecta credores e tomadores, quem faz intermediação e quem não pode captar recursos diretamente do público. Fazer questões semelhantes focando nas trocas de características entre essas duas fintechs.`

    const campos = extrairCamposRespostaChatGPT(resposta)

    expect(campos.pegadinhas.split('\n')).toEqual([
      'Troca de termos parecidos: a questão troca características da Sociedade de Empréstimo entre Pessoas e da Sociedade de Crédito Direto.',
      'Inversão de conceito: a afirmativa II atribui à Sociedade de Empréstimo entre Pessoas a oferta de crédito com recursos próprios, mas o comentário informa que são recursos de terceiros.',
      'Inversão de conceito: a afirmativa III diz que a Sociedade de Crédito Direto pode captar recursos diretamente do público, mas ela não está autorizada a fazer isso.',
      'Confusão entre conceitos: a afirmativa IV atribui à Sociedade de Crédito Direto a infraestrutura eletrônica para conectar credores e tomadores, mas essa característica é da Sociedade de Empréstimo entre Pessoas.'
    ])
    expect(campos.conceito).toBe('Diferença entre os dois tipos de fintechs de crédito: Sociedade de Empréstimo entre Pessoas realiza intermediação financeira entre credores e devedores, usando recursos de terceiros e oferecendo infraestrutura eletrônica para conectar credores e tomadores. Sociedade de Crédito Direto não está autorizada a captar recursos diretamente do público para concessão de crédito.')
    expect(campos.reconhecer).toBe('Observar os nomes das instituições: “Sociedade de Empréstimo entre Pessoas” e “Sociedade de Crédito Direto”. Quando a questão mencionar “intermediação”, “recursos de terceiros” ou “conectar credores e tomadores”, associar à Sociedade de Empréstimo entre Pessoas. Quando aparecer “captar recursos diretamente do público”, identificar como afirmação incorreta para Sociedade de Crédito Direto.')
    expect(campos.acao).toBe('Criar um quadro comparativo entre Sociedade de Empréstimo entre Pessoas e Sociedade de Crédito Direto, destacando: quem usa recursos próprios ou de terceiros, quem conecta credores e tomadores, quem faz intermediação e quem não pode captar recursos diretamente do público. Fazer questões semelhantes focando nas trocas de características entre essas duas fintechs.')
    expect(campos.conceito).not.toContain('Inversão de conceito:')
    expect(campos.conceito).not.toContain('Confusão entre conceitos:')
  })

  it('reconhece apenas rotulos oficiais isolados', () => {
    expect(identificarCampoRespostaChatGPT('PEGADINHAS')).toBe('pegadinhas')
    expect(identificarCampoRespostaChatGPT('PEGADINHA')).toBe('pegadinhas')
    expect(identificarCampoRespostaChatGPT('CONCEITO')).toBe('conceito')
    expect(identificarCampoRespostaChatGPT('CONCEITO-CHAVE')).toBe('conceito')
    expect(identificarCampoRespostaChatGPT('RECONHECER')).toBe('reconhecer')
    expect(identificarCampoRespostaChatGPT('COMO RECONHECER')).toBe('reconhecer')
    expect(identificarCampoRespostaChatGPT('COMO RECONHECER NA PRÓXIMA VEZ')).toBe('reconhecer')
    expect(identificarCampoRespostaChatGPT('ACAO')).toBe('acao')
    expect(identificarCampoRespostaChatGPT('AÇÃO')).toBe('acao')
    expect(identificarCampoRespostaChatGPT('ACAO CORRETIVA')).toBe('acao')
    expect(identificarCampoRespostaChatGPT('AÇÃO CORRETIVA')).toBe('acao')
    expect(identificarCampoRespostaChatGPT('COMENTÁRIO')).toBe('comentario')
    expect(identificarCampoRespostaChatGPT('COMENTÁRIO DO PROFESSOR')).toBe('comentario')
    expect(identificarCampoRespostaChatGPT('EXPLICAÇÃO')).toBe('comentario')
    expect(identificarCampoRespostaChatGPT('Inversão de conceito')).toBeNull()
    expect(identificarCampoRespostaChatGPT('Confusão entre conceitos')).toBeNull()
    expect(identificarCampoRespostaChatGPT('Troca de conceitos')).toBeNull()
    expect(identificarCampoRespostaChatGPT('Troca de termos parecidos')).toBeNull()
    expect(identificarCampoRespostaChatGPT('Interpretação')).toBeNull()
  })

  it('extrai comentario e pegadinhas multilinha ate o proximo rotulo oficial', () => {
    const campos = extrairCamposRespostaChatGPT(`COMENTÁRIO:
Primeira linha do comentario.
Segunda linha do comentario.

PEGADINHAS:
Primeira pegadinha.
Segunda pegadinha.

AÇÃO CORRETIVA:
Fazer revisão direcionada.`)

    expect(campos.comentario).toBe('Primeira linha do comentario.\nSegunda linha do comentario.')
    expect(campos.pegadinhas).toBe('Primeira pegadinha.\nSegunda pegadinha.')
    expect(campos.acao).toBe('Fazer revisão direcionada.')
  })

  it('trata EXPLICACAO como comentario sem confundir com ACAO', () => {
    const campos = extrairCamposRespostaChatGPT(`EXPLICAÇÃO:
Esta linha deve virar comentario.

ACAO:
Fazer revisão direcionada.`)

    expect(campos.comentario).toBe('Esta linha deve virar comentario.')
    expect(campos.acao).toBe('Fazer revisão direcionada.')
  })

  it('preenche o campo de comentario ao colar resposta da IA', () => {
    document.body.innerHTML = `
      <textarea id="texto-resposta-chatgpt">COMENTÁRIO:
Explicação gerada pela IA.

AÇÃO CORRETIVA:
Revisar o tema e refazer questões.</textarea>
      <p id="msg-resposta-chatgpt"></p>
      <textarea id="q-comentario">Comentário manual anterior</textarea>
      <textarea id="q-pegadinha-banca"></textarea>
      <textarea id="q-conceito-chave"></textarea>
      <textarea id="q-como-reconhecer"></textarea>
      <textarea id="q-acao-corretiva"></textarea>
    `
    const modal = { remove: vi.fn() }

    aplicarRespostaChatGPT(modal, 'cadastro')

    expect(document.getElementById('q-comentario').value).toBe('Comentário manual anterior')
    expect(document.getElementById('q-acao-corretiva').value).toBe('Revisar o tema e refazer questões.')
    expect(document.getElementById('msg-resposta-chatgpt').textContent).not.toContain('Comentário')
  })

  it('mostra previa antes de preencher os campos da resposta da IA', () => {
    document.body.innerHTML = `
      <div id="modal-resposta-chatgpt">
        <div class="modal-caixa">
          <textarea id="texto-resposta-chatgpt">COMENTÁRIO:
Explicação gerada pela IA.

PEGADINHAS:
Primeira pegadinha.

CONCEITO:
Conceito central.

AÇÃO CORRETIVA:
Revisar o tema.</textarea>
          <p id="msg-resposta-chatgpt"></p>
        </div>
      </div>
      <textarea id="q-comentario"></textarea>
      <textarea id="q-pegadinha-banca"></textarea>
      <div id="q-pegadinha-chips"></div>
      <textarea id="q-conceito-chave"></textarea>
      <textarea id="q-como-reconhecer"></textarea>
      <textarea id="q-acao-corretiva"></textarea>
    `
    const modal = document.getElementById('modal-resposta-chatgpt')

    previsualizarRespostaChatGPT(modal, 'cadastro')

    expect(document.querySelector('.preview-resposta-ia-grid')).not.toBeNull()
    expect(document.querySelectorAll('.preview-resposta-ia-bloco')).toHaveLength(5)
    expect(document.body.textContent).toContain('Prévia da resposta da IA')
    expect(document.body.textContent).toContain('Confira os campos identificados antes de preencher o caderno de erros.')
    expect(document.body.textContent).toContain('Não identificado na resposta da IA.')
    expect(document.getElementById('q-comentario').value).toBe('')

    document.getElementById('btn-confirmar-preview-resposta-chatgpt').click()

    expect(document.getElementById('q-comentario').value).toBe('Explicação gerada pela IA.')
    expect(document.getElementById('q-pegadinha-banca').value).toBe('Primeira pegadinha.')
    expect(document.getElementById('q-conceito-chave').value).toBe('Conceito central.')
    expect(document.getElementById('q-como-reconhecer').value).toBe('')
    expect(document.getElementById('q-acao-corretiva').value).toBe('Revisar o tema.')
    expect(document.getElementById('modal-resposta-chatgpt')).toBeNull()
  })

  it('preserva texto manual por padrao na previa da resposta da IA', () => {
    document.body.innerHTML = `
      <div id="modal-resposta-chatgpt">
        <textarea id="texto-resposta-chatgpt">COMENTÁRIO:
Explicação gerada pela IA.</textarea>
        <p id="msg-resposta-chatgpt"></p>
      </div>
      <textarea id="q-comentario">Comentário manual anterior</textarea>
      <textarea id="q-pegadinha-banca"></textarea>
      <textarea id="q-conceito-chave"></textarea>
      <textarea id="q-como-reconhecer"></textarea>
      <textarea id="q-acao-corretiva"></textarea>
    `
    const modal = document.getElementById('modal-resposta-chatgpt')

    previsualizarRespostaChatGPT(modal, 'cadastro')

    expect(document.body.textContent).toContain('Este campo já possui conteúdo.')
    expect(document.body.textContent).toContain('Manter texto atual')
    expect(document.body.textContent).toContain('Substituir pela IA')

    document.getElementById('btn-confirmar-preview-resposta-chatgpt').click()

    expect(document.getElementById('q-comentario').value).toBe('Comentário manual anterior')
  })

  it('permite substituir texto manual pela resposta da IA quando o usuario escolhe', () => {
    document.body.innerHTML = `
      <div id="modal-resposta-chatgpt">
        <textarea id="texto-resposta-chatgpt">CONCEITO:
Conceito gerado pela IA.</textarea>
        <p id="msg-resposta-chatgpt"></p>
      </div>
      <textarea id="q-comentario"></textarea>
      <textarea id="q-pegadinha-banca"></textarea>
      <textarea id="q-conceito-chave">Conceito manual anterior</textarea>
      <textarea id="q-como-reconhecer"></textarea>
      <textarea id="q-acao-corretiva"></textarea>
    `
    const modal = document.getElementById('modal-resposta-chatgpt')

    previsualizarRespostaChatGPT(modal, 'cadastro')
    document.querySelector('input[data-preview-campo="conceito"][value="substituir"]').checked = true
    document.getElementById('btn-confirmar-preview-resposta-chatgpt').click()

    expect(document.getElementById('q-conceito-chave').value).toBe('Conceito gerado pela IA.')
  })

  it('substitui sugestao automatica generica de acao corretiva', () => {
    document.body.innerHTML = `
      <div id="modal-resposta-chatgpt">
        <textarea id="texto-resposta-chatgpt">AÇÃO CORRETIVA:
Criar quadro comparativo e refazer questões semelhantes.</textarea>
        <p id="msg-resposta-chatgpt"></p>
      </div>
      <select id="q-motivo-erro">
        <option value="Interpretação incorreta" selected>Interpretação incorreta</option>
      </select>
      <textarea id="q-comentario"></textarea>
      <textarea id="q-pegadinha-banca"></textarea>
      <textarea id="q-conceito-chave"></textarea>
      <textarea id="q-como-reconhecer"></textarea>
      <textarea id="q-acao-corretiva">Antes de responder, reescrever o comando da questão com minhas palavras.</textarea>
    `
    const modal = document.getElementById('modal-resposta-chatgpt')

    previsualizarRespostaChatGPT(modal, 'cadastro')

    expect(document.body.textContent).toContain('sugestão automática')
    expect(document.querySelector('input[data-preview-campo="acao"]')).toBeNull()

    document.getElementById('btn-confirmar-preview-resposta-chatgpt').click()

    expect(document.getElementById('q-acao-corretiva').value).toBe('Criar quadro comparativo e refazer questões semelhantes.')
  })
})

describe('parser de flashcards da IA', () => {
  const respostaCards = `CARD 1 — CONCEITO
FRENTE:
O que caracteriza controle concentrado?

VERSO:
É o controle feito em tese por órgão competente.
Texto com a palavra contexto: não deve virar rótulo.

CONTEXTO:
Questão sobre controle de constitucionalidade.

RECONHECER:
Procure expressões como ação direta.

ALERTA DE BANCA:
Não confundir com controle difuso.

CARD 2 - DISTINÇÃO
FRENTE:
Controle difuso se diferencia como?

VERSO:
Ocorre em caso concreto.

CONTEXTO:
Comparação entre modelos.

RECONHECER:
Analise o órgão julgador.

ALERTA DE BANCA:
Troca de termos parecidos.`

  it('reconhece campos oficiais apenas no inicio da linha', () => {
    expect(identificarCampoFlashcardIA('FRENTE')).toBe('frente')
    expect(identificarCampoFlashcardIA('VERSO')).toBe('verso')
    expect(identificarCampoFlashcardIA('CONTEXTO')).toBe('contexto')
    expect(identificarCampoFlashcardIA('RECONHECER')).toBe('reconhecer')
    expect(identificarCampoFlashcardIA('ALERTA DE BANCA')).toBe('alertaBanca')
    expect(identificarCampoFlashcardIA('Texto com frente')).toBeNull()
    expect(identificarInicioCardFlashcardIA('CARD 1 — CONCEITO')).toEqual({ numero: 1, tipo: 'CONCEITO' })
    expect(identificarInicioCardFlashcardIA('CARD 1 - PEGADINHA')).toEqual({ numero: 1, tipo: 'PEGADINHA' })
  })

  it('reconhece de 2 a 5 cards com hifen normal ou travessao', () => {
    const resultado = extrairFlashcardsRespostaIA(`${respostaCards}

CARD 3 — PEGADINHA
FRENTE:
Frente 3
VERSO:
Verso 3

CARD 4 - EXCEÇÃO
FRENTE:
Frente 4
VERSO:
Verso 4

CARD 5 — APLICAÇÃO
FRENTE:
Frente 5
VERSO:
Verso 5`)

    expect(resultado.cards).toHaveLength(5)
    expect(resultado.cards.map(card => card.tipo)).toEqual(['CONCEITO', 'DISTINÇÃO', 'PEGADINHA', 'EXCEÇÃO', 'APLICAÇÃO'])
  })

  it('extrai frente, verso, contexto, reconhecer e alerta de banca preservando multilinha', () => {
    const resultado = extrairFlashcardsRespostaIA(respostaCards)
    const primeiro = resultado.cards[0]

    expect(primeiro.frente).toBe('O que caracteriza controle concentrado?')
    expect(primeiro.verso).toBe('É o controle feito em tese por órgão competente.\nTexto com a palavra contexto: não deve virar rótulo.')
    expect(primeiro.contexto).toBe('Questão sobre controle de constitucionalidade.')
    expect(primeiro.reconhecer).toBe('Procure expressões como ação direta.')
    expect(primeiro.alertaBanca).toBe('Não confundir com controle difuso.')
  })

  it('marca card sem frente ou sem verso como incompleto', () => {
    const semFrente = extrairFlashcardsRespostaIA(`CARD 1 — CONCEITO
VERSO:
Resposta sem frente.`)
    const semVerso = extrairFlashcardsRespostaIA(`CARD 1 — CONCEITO
FRENTE:
Pergunta sem verso.`)

    expect(semFrente.cards[0].incompleto).toBe(true)
    expect(semFrente.mensagens).toContain('Card incompleto: frente ou verso não identificado.')
    expect(semVerso.cards[0].incompleto).toBe(true)
    expect(semVerso.mensagens).toContain('Card incompleto: frente ou verso não identificado.')
  })

  it('retorna mensagem amigavel quando nenhum card e identificado', () => {
    const resultado = extrairFlashcardsRespostaIA('Resposta fora do formato solicitado.')

    expect(resultado.cards).toEqual([])
    expect(resultado.mensagens).toContain('Nenhum flashcard foi identificado. Verifique se a resposta da IA seguiu o formato solicitado.')
  })

  it('previsualiza cards identificados sem salvar no banco nem chamar criarFlashcard', () => {
    const criarFlashcardOriginal = globalThis.criarFlashcard
    const from = vi.fn()
    globalThis.criarFlashcard = vi.fn()
    globalThis.db = { from }
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">${respostaCards}</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')

    const resultado = previsualizarFlashcardsIA(modal)

    expect(resultado.cards).toHaveLength(2)
    expect(document.body.textContent).toContain('Prévia dos flashcards da IA')
    expect(document.body.textContent).toContain('Card 1')
    expect(document.body.textContent).toContain('O que caracteriza controle concentrado?')
    expect(document.body.textContent).toContain('Não confundir com controle difuso.')
    expect(globalThis.criarFlashcard).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()

    if (criarFlashcardOriginal) {
      globalThis.criarFlashcard = criarFlashcardOriginal
    } else {
      delete globalThis.criarFlashcard
    }
  })

  it('cards interpretados aparecem em campos editaveis', () => {
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">${respostaCards}</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')

    previsualizarFlashcardsIA(modal)

    expect(document.querySelectorAll('[data-preview-flashcard-card]')).toHaveLength(2)
    expect(document.querySelector('[data-preview-flashcard-campo="tipo"]').tagName).toBe('SELECT')
    expect(document.querySelector('[data-preview-flashcard-campo="frente"]').tagName).toBe('TEXTAREA')
    expect(document.querySelector('[data-preview-flashcard-campo="verso"]').tagName).toBe('TEXTAREA')
    expect(document.querySelector('[data-preview-flashcard-campo="contexto"]').tagName).toBe('TEXTAREA')
    expect(document.querySelector('[data-preview-flashcard-campo="reconhecer"]').tagName).toBe('TEXTAREA')
    expect(document.querySelector('[data-preview-flashcard-campo="alertaBanca"]').tagName).toBe('TEXTAREA')
  })

  it('permite editar tipo, frente, verso, contexto, reconhecer e alerta de banca', () => {
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">${respostaCards}</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')
    previsualizarFlashcardsIA(modal)
    const primeiroCard = document.querySelector('[data-preview-flashcard-card]')

    primeiroCard.querySelector('[data-preview-flashcard-campo="tipo"]').value = 'PEGADINHA'
    primeiroCard.querySelector('[data-preview-flashcard-campo="tipo"]').dispatchEvent(new window.Event('change', { bubbles: true }))
    primeiroCard.querySelector('[data-preview-flashcard-campo="frente"]').value = 'Frente editada'
    primeiroCard.querySelector('[data-preview-flashcard-campo="verso"]').value = 'Verso editado'
    primeiroCard.querySelector('[data-preview-flashcard-campo="contexto"]').value = 'Contexto editado'
    primeiroCard.querySelector('[data-preview-flashcard-campo="reconhecer"]').value = 'Reconhecer editado'
    primeiroCard.querySelector('[data-preview-flashcard-campo="alertaBanca"]').value = 'Alerta editado'

    expect(primeiroCard.querySelector('[data-preview-flashcard-titulo]').textContent).toContain('PEGADINHA')
    expect(primeiroCard.querySelector('[data-preview-flashcard-campo="frente"]').value).toBe('Frente editada')
    expect(primeiroCard.querySelector('[data-preview-flashcard-campo="verso"]').value).toBe('Verso editado')
    expect(primeiroCard.querySelector('[data-preview-flashcard-campo="contexto"]').value).toBe('Contexto editado')
    expect(primeiroCard.querySelector('[data-preview-flashcard-campo="reconhecer"]').value).toBe('Reconhecer editado')
    expect(primeiroCard.querySelector('[data-preview-flashcard-campo="alertaBanca"]').value).toBe('Alerta editado')
  })

  it('permite remover um card da previa', () => {
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">${respostaCards}</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')
    previsualizarFlashcardsIA(modal)

    document.querySelector('[data-remover-preview-flashcard]').click()

    expect(document.querySelectorAll('[data-preview-flashcard-card]')).toHaveLength(1)
    expect(document.querySelector('[data-preview-flashcard-titulo]').textContent).toContain('Card 1')
    expect(document.body.textContent).not.toContain('O que caracteriza controle concentrado?')
  })

  it('marca card editavel sem frente como incompleto', () => {
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">${respostaCards}</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')
    previsualizarFlashcardsIA(modal)
    const primeiroCard = document.querySelector('[data-preview-flashcard-card]')
    const frente = primeiroCard.querySelector('[data-preview-flashcard-campo="frente"]')

    frente.value = ''
    frente.dispatchEvent(new window.Event('input', { bubbles: true }))

    expect(primeiroCard.classList.contains('preview-flashcard-ia-incompleto')).toBe(true)
    expect(primeiroCard.querySelector('[data-preview-flashcard-aviso]').hidden).toBe(false)
  })

  it('marca card editavel sem verso como incompleto', () => {
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">${respostaCards}</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')
    previsualizarFlashcardsIA(modal)
    const primeiroCard = document.querySelector('[data-preview-flashcard-card]')
    const verso = primeiroCard.querySelector('[data-preview-flashcard-campo="verso"]')

    verso.value = ''
    verso.dispatchEvent(new window.Event('input', { bubbles: true }))

    expect(primeiroCard.classList.contains('preview-flashcard-ia-incompleto')).toBe(true)
    expect(primeiroCard.querySelector('[data-preview-flashcard-aviso]').hidden).toBe(false)
  })

  it('mostra botao para adicionar cards validos ao deck apos a previa editavel', () => {
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">${respostaCards}</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')

    previsualizarFlashcardsIA(modal)

    expect(document.getElementById('btn-adicionar-preview-flashcards-ia').textContent).toBe('Adicionar cards válidos ao deck')
  })

  it('salva um card valido chamando criarFlashcard sem enviar user_id', async () => {
    const criarFlashcardOriginal = globalThis.criarFlashcard
    globalThis.criarFlashcard = vi.fn(async () => ({ data: { id: 'card-1' }, error: null }))
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">CARD 1 — PEGADINHA
FRENTE:
Frente válida
VERSO:
Verso base
CONTEXTO:
Contexto útil
RECONHECER:
Pista de prova
ALERTA DE BANCA:
Alerta importante</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')
    previsualizarFlashcardsIA(modal)

    const resultado = await adicionarFlashcardsPreviewIAAoDeck(modal)
    const payload = globalThis.criarFlashcard.mock.calls[0][0]

    expect(resultado.data).toEqual({ salvos: 1, falhas: 0 })
    expect(globalThis.criarFlashcard).toHaveBeenCalledTimes(1)
    expect(payload).toMatchObject({
      frente: 'Frente válida',
      tags: ['pegadinha', 'ia', 'caderno-de-erros']
    })
    expect(payload).not.toHaveProperty('user_id')
    expect(payload).not.toHaveProperty('materia_id')
    expect(payload.verso).toContain('VERSO:\nVerso base')
    expect(payload.verso).toContain('CONTEXTO:\nContexto útil')
    expect(payload.verso).toContain('RECONHECER:\nPista de prova')
    expect(payload.verso).toContain('ALERTA DE BANCA:\nAlerta importante')
    expect(document.getElementById('msg-preview-flashcards-ia').textContent).toBe('1 flashcard adicionado ao deck.')

    if (criarFlashcardOriginal) {
      globalThis.criarFlashcard = criarFlashcardOriginal
    } else {
      delete globalThis.criarFlashcard
    }
  })

  it('cards da IA herdam materia_id da questao quando disponivel', async () => {
    const criarFlashcardOriginal = globalThis.criarFlashcard
    globalThis.criarFlashcard = vi.fn(async () => ({ data: { id: 'card-1' }, error: null }))
    document.body.innerHTML = `
      <select id="q-materia">
        <option value="">Selecione...</option>
        <option value="mat-1" selected>Direito Constitucional</option>
      </select>
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">${respostaCards}</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')
    previsualizarFlashcardsIA(modal)

    await adicionarFlashcardsPreviewIAAoDeck(modal)

    expect(globalThis.criarFlashcard).toHaveBeenCalledWith(expect.objectContaining({
      materia_id: 'mat-1'
    }))
    expect(globalThis.criarFlashcard.mock.calls[0][0]).not.toHaveProperty('user_id')

    if (criarFlashcardOriginal) {
      globalThis.criarFlashcard = criarFlashcardOriginal
    } else {
      delete globalThis.criarFlashcard
    }
  })

  it('nao salva card sem frente ou sem verso', async () => {
    const criarFlashcardOriginal = globalThis.criarFlashcard
    globalThis.criarFlashcard = vi.fn(async () => ({ data: { id: 'card-1' }, error: null }))
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">CARD 1 — CONCEITO
VERSO:
Resposta sem frente.

CARD 2 — CONCEITO
FRENTE:
Pergunta sem verso.</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')
    previsualizarFlashcardsIA(modal)

    await adicionarFlashcardsPreviewIAAoDeck(modal)

    expect(globalThis.criarFlashcard).not.toHaveBeenCalled()
    expect(document.getElementById('msg-preview-flashcards-ia').textContent).toBe('Nenhum flashcard válido para adicionar. Confira se os cards têm frente e verso.')

    if (criarFlashcardOriginal) {
      globalThis.criarFlashcard = criarFlashcardOriginal
    } else {
      delete globalThis.criarFlashcard
    }
  })

  it('nao salva card removido da previa', async () => {
    const criarFlashcardOriginal = globalThis.criarFlashcard
    globalThis.criarFlashcard = vi.fn(async () => ({ data: { id: 'card-1' }, error: null }))
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">${respostaCards}</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')
    previsualizarFlashcardsIA(modal)

    document.querySelector('[data-remover-preview-flashcard]').click()
    await adicionarFlashcardsPreviewIAAoDeck(modal)

    expect(globalThis.criarFlashcard).toHaveBeenCalledTimes(1)
    expect(globalThis.criarFlashcard.mock.calls[0][0].frente).toBe('Controle difuso se diferencia como?')

    if (criarFlashcardOriginal) {
      globalThis.criarFlashcard = criarFlashcardOriginal
    } else {
      delete globalThis.criarFlashcard
    }
  })

  it('informa salvamento parcial quando algum card falha', async () => {
    const criarFlashcardOriginal = globalThis.criarFlashcard
    globalThis.criarFlashcard = vi.fn()
      .mockResolvedValueOnce({ data: { id: 'card-1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('falha') })
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">${respostaCards}</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')
    previsualizarFlashcardsIA(modal)

    const resultado = await adicionarFlashcardsPreviewIAAoDeck(modal)

    expect(resultado.data).toEqual({ salvos: 1, falhas: 1 })
    expect(resultado.error.message).toBe('Alguns flashcards não foram salvos.')
    expect(document.getElementById('msg-preview-flashcards-ia').textContent).toBe('1 flashcard adicionado ao deck. 1 falharam ao salvar.')

    if (criarFlashcardOriginal) {
      globalThis.criarFlashcard = criarFlashcardOriginal
    } else {
      delete globalThis.criarFlashcard
    }
  })

  it('nao acessa banco diretamente ao adicionar cards da previa', async () => {
    const criarFlashcardOriginal = globalThis.criarFlashcard
    const dbOriginal = globalThis.db
    const from = vi.fn()
    globalThis.db = { from }
    globalThis.criarFlashcard = vi.fn(async () => ({ data: { id: 'card-1' }, error: null }))
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">${respostaCards}</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')
    previsualizarFlashcardsIA(modal)

    await adicionarFlashcardsPreviewIAAoDeck(modal)

    expect(from).not.toHaveBeenCalled()

    if (criarFlashcardOriginal) {
      globalThis.criarFlashcard = criarFlashcardOriginal
    } else {
      delete globalThis.criarFlashcard
    }
    globalThis.db = dbOriginal
  })

  it('mostra mensagem amigavel no fluxo quando a resposta esta fora do formato', () => {
    document.body.innerHTML = `
      <div id="modal-flashcards-ia">
        <textarea id="texto-flashcards-ia">sem cards</textarea>
        <p id="msg-flashcards-ia"></p>
      </div>
    `
    const modal = document.getElementById('modal-flashcards-ia')

    previsualizarFlashcardsIA(modal)

    expect(document.getElementById('msg-flashcards-ia').textContent).toBe('Nenhum flashcard foi identificado. Verifique se a resposta da IA seguiu o formato solicitado.')
  })
})

describe('ordenarQuestoes', () => {
  const questoes = [
    {
      id: 'antiga',
      criado_em: '2025-01-01T10:00:00Z',
      revisar_novamente_em: '2025-01-10',
      materias: { nome: 'Zoologia' },
      motivo_erro: 'A diagnosticar',
      nivel_confianca: 'Não informado'
    },
    {
      id: 'recente',
      criado_em: '2025-01-03T10:00:00Z',
      revisar_novamente_em: '2025-01-08',
      materias: { nome: 'Administrativo' },
      motivo_erro: 'Desatenção',
      nivel_confianca: 'Dúvida',
      conceito_chave: 'Conceito suficiente',
      como_reconhecer: 'Reconhecer pelo comando da questão',
      acao_corretiva: 'Revisar antes de responder',
      comentario: 'Comentário útil para revisão'
    },
    {
      id: 'meio',
      criado_em: '2025-01-02T10:00:00Z',
      revisar_novamente_em: '2025-01-09',
      materias: { nome: 'Constitucional' },
      motivo_erro: 'Pegadinha',
      nivel_confianca: 'Baixa confiança'
    }
  ]

  it('ordena mais recentes primeiro', () => {
    expect(ordenarQuestoes(questoes, 'recente').map(q => q.id)).toEqual(['recente', 'meio', 'antiga'])
  })

  it('ordena mais antigas primeiro', () => {
    expect(ordenarQuestoes(questoes, 'antigas').map(q => q.id)).toEqual(['antiga', 'meio', 'recente'])
  })

  it('ordena por matéria em ordem alfabética', () => {
    expect(ordenarQuestoes(questoes, 'materia').map(q => q.id)).toEqual(['recente', 'meio', 'antiga'])
  })

  it('ordena revisão vencida primeiro pela data de revisão', () => {
    expect(ordenarQuestoes(questoes, 'revisao').map(q => q.id)).toEqual(['recente', 'meio', 'antiga'])
  })

  it('ordena diagnóstico mais fraco primeiro', () => {
    expect(ordenarQuestoes(questoes, 'diagnostico').map(q => q.id)).toEqual(['antiga', 'meio', 'recente'])
  })
})

describe('obterOuCriarSessaoDeHoje', () => {
  it('usa maybeSingle e cria a sessão quando ainda não existe registro no dia', async () => {
    const dbAnterior = globalThis.db
    const windowAnterior = globalThis.window
    let consultaSessaoUsouMaybeSingle = false
    let fromCount = 0

    const consultaSessao = {
      select() { return this },
      eq() { return this },
      single() { throw new Error('Não deve usar single na busca de sessão existente') },
      async maybeSingle() {
        consultaSessaoUsouMaybeSingle = true
        return { data: null, error: null }
      }
    }
    const criacaoSessao = {
      payload: null,
      insert(payload) {
        this.payload = payload
        return this
      },
      select() { return this },
      async single() {
        return { data: { id: 'sessao-nova', total_questoes: 0 }, error: null }
      }
    }

    globalThis.window = { usuarioAtual: { id: 'usuario-1' } }
    globalThis.db = {
      from(tabela) {
        expect(tabela).toBe('sessoes_estudo')
        fromCount += 1
        return fromCount === 1 ? consultaSessao : criacaoSessao
      }
    }

    try {
      const sessao = await obterOuCriarSessaoDeHoje()

      expect(consultaSessaoUsouMaybeSingle).toBe(true)
      expect(criacaoSessao.payload.user_id).toBe('usuario-1')
      expect(criacaoSessao.payload.total_questoes).toBe(0)
      expect(sessao).toEqual({ id: 'sessao-nova', total_questoes: 0 })
    } finally {
      globalThis.db = dbAnterior
      globalThis.window = windowAnterior
    }
  })
})

describe('recalcularTotalQuestoesSessao', () => {
  it('recalcula total da sessao somando erradas e acertos registrados', async () => {
    const dbAnterior = globalThis.db
    const usuarioAnterior = window.usuarioAtual
    const questoesChain = {
      error: null,
      count: 2,
      select: vi.fn(() => questoesChain),
      eq: vi.fn(() => questoesChain)
    }
    const certasChain = {
      error: null,
      data: [{ quantidade: 3 }, { quantidade: 2 }],
      select: vi.fn(() => certasChain),
      eq: vi.fn(() => certasChain)
    }
    const sessaoChain = {
      error: null,
      update: vi.fn(() => sessaoChain),
      eq: vi.fn(() => sessaoChain)
    }
    const from = vi.fn(tabela => {
      if (tabela === 'questoes') return questoesChain
      if (tabela === 'questoes_certas') return certasChain
      if (tabela === 'sessoes_estudo') return sessaoChain
      throw new Error(`Tabela inesperada: ${tabela}`)
    })

    globalThis.db = { from }
    window.usuarioAtual = { id: 'user-1' }

    try {
      await recalcularTotalQuestoesSessao('sessao-1')

      expect(sessaoChain.update).toHaveBeenCalledWith({ total_questoes: 7 })
      expect(sessaoChain.eq).toHaveBeenCalledWith('id', 'sessao-1')
      expect(sessaoChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    } finally {
      globalThis.db = dbAnterior
      window.usuarioAtual = usuarioAnterior
    }
  })
})
