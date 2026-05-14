// js/simulados.js

let simuladosInicializado = false

const NIVEIS_CONFIANCA_RESPOSTA_SIMULADO = ['Chutei', 'Dúvida', 'Confiante']
const MOTIVOS_ERRO_RESPOSTA_SIMULADO = [
  'Falta de conteúdo',
  'Interpretação incorreta',
  'Desatenção',
  'Confusão entre conceitos',
  'Falta de revisão',
  'Eliminação parcial',
  'Dúvida entre alternativas',
  'Falta de certeza',
  'Chute completo',
  'Reconhecimento superficial do conteúdo'
]

function inicializarSimulados() {
  if (!simuladosInicializado) {
    simuladosInicializado = true
    const inputData = document.getElementById('simulado-data')
    if (inputData && !inputData.value) inputData.value = dataSimuladoHoje()

    document.getElementById('btn-salvar-simulado')
      ?.addEventListener('click', salvarSimulado)
    document.getElementById('btn-gerar-simulado-revisao')
      ?.addEventListener('click', gerarSimuladoRevisao)

    document.getElementById('simulado-total')?.addEventListener('input', preencherErradasSimulado)
    document.getElementById('simulado-certas')?.addEventListener('input', preencherErradasSimulado)
  }

  carregarQuestoesRecuperadas()
  carregarSimulados()
}

function preencherErradasSimulado() {
  const total = parseInt(document.getElementById('simulado-total').value)
  const certas = parseInt(document.getElementById('simulado-certas').value)
  const erradas = document.getElementById('simulado-erradas')

  if (total >= 0 && certas >= 0 && certas <= total) {
    erradas.value = total - certas
  }
}

async function gerarSimuladoRevisao() {
  const container = document.getElementById('simulado-revisao-gerado')
  if (!container) return

  const periodo = document.getElementById('simulado-revisao-periodo')?.value || 'semana'
  const tipoFiltro = document.getElementById('simulado-revisao-tipo')?.value || 'all'
  const limite = parseInt(document.getElementById('simulado-revisao-limite')?.value)

  if (!limite || limite < 1 || limite > 100) {
    mostrarMsgSimuladoRevisao('Digite uma quantidade entre 1 e 100.', 'erro')
    return
  }

  mostrarMsgSimuladoRevisao('', '')
  container.innerHTML = '<p class="texto-placeholder">⏳ Montando simulado de revisão...</p>'

  let query = db
    .from('questoes')
    .select('id, enunciado, alternativas, alternativa_marcada, alternativa_correta, tipo_questao, status_revisao, revisar_novamente_em, revisao_total_acertos, revisao_total_erros, revisao_etapa, revisao_ultima_data, revisao_ultima_resultado, motivo_erro, nivel_confianca, comentario, conceito_chave, como_reconhecer, acao_corretiva, criado_em, materias(nome), edital_topicos(titulo, status), banca, pegadinha_banca')
    .eq('user_id', window.usuarioAtual.id)
    .eq('status_revisao', 'pendente')
    .order('revisar_novamente_em', { ascending: true, nullsFirst: false })
    .limit(500)

  const { data, error } = await query

  if (error) {
    console.error(error)
    mostrarMsgSimuladoRevisao('Erro ao buscar questões. Execute o SQL de melhoria no Supabase.', 'erro')
    container.innerHTML = '<p class="texto-placeholder">Não foi possível gerar o simulado agora.</p>'
    return
  }

  let questoes = (data || []).map(q => ({
    ...q,
    tipoNormalizado: normalizarTipoQuestaoSimulado(q)
  }))

  questoes = filtrarQuestoesPorPeriodoRevisao(questoes, periodo)

  if (tipoFiltro !== 'all') {
    questoes = questoes.filter(q => q.tipoNormalizado === tipoFiltro)
  }

  if (questoes.length === 0) {
    container.innerHTML = '<p class="texto-placeholder">Nenhuma questão encontrada para esse filtro.</p>'
    return
  }

  const selecionadas = embaralharQuestoes(questoes).slice(0, limite)
  renderizarSimuladoRevisao(selecionadas, periodo, tipoFiltro)
  mostrarMsgSimuladoRevisao(`Simulado gerado com ${formatarQuantidadeQuestoes(selecionadas.length)}.`, 'sucesso')
}

function renderizarSimuladoRevisao(questoes, periodo, tipoFiltro) {
  const container = document.getElementById('simulado-revisao-gerado')
  if (!container) return

  container.innerHTML = `
    <div class="simulado-revisao-resumo">
      <div>
        <h3 class="simulado-revisao-titulo">Simulado de revisão</h3>
        <p class="simulado-revisao-subtitulo">${obterRotuloPeriodoSimuladoRevisao(periodo)} · ${obterRotuloFiltroTipo(tipoFiltro)}</p>
      </div>
      <span class="simulado-revisao-total">${questoes.length} questões</span>
    </div>
    <div class="simulado-revisao-lista"></div>
  `

  const lista = container.querySelector('.simulado-revisao-lista')
  questoes.forEach((q, index) => lista.appendChild(criarCardSimuladoRevisao(q, index + 1)))
}

function criarCardSimuladoRevisao(q, numero) {
  const card = document.createElement('div')
  card.className = 'simulado-revisao-card'
  card._questaoSimulado = q

  const tipo = q.tipoNormalizado || normalizarTipoQuestaoSimulado(q)
  const nomeMateria = q.materias?.nome || 'Sem matéria'
  const data = new Date(q.criado_em).toLocaleDateString('pt-BR')
  const dataRevisao = q.revisar_novamente_em ? formatarDataSimulado(q.revisar_novamente_em) : 'Disponível'
  const totalErros = Number(q.revisao_total_erros || 0)
  const totalAcertos = Number(q.revisao_total_acertos || 0)
  const alternativas = q.alternativas && typeof q.alternativas === 'object'
    ? Object.entries(q.alternativas).map(([letra, texto]) => `
      <button class="alternativa-card simulado-revisao-alternativa simulado-resposta-opcao" type="button" data-letra="${escaparHtmlSeguro(letra)}">
        <span class="alt-letra">${escaparHtmlSeguro(letra)}</span>
        <span class="alt-texto">${escaparHtmlSeguro(texto)}</span>
      </button>
    `).join('')
    : ''
  const opcoesConfianca = renderizarOptionsSelectSimulado(NIVEIS_CONFIANCA_RESPOSTA_SIMULADO, '')
  const opcoesMotivo = renderizarOptionsSelectSimulado(MOTIVOS_ERRO_RESPOSTA_SIMULADO, q.motivo_erro || '')

  card.innerHTML = `
    <div class="card-revisao-topo">
      <div class="card-revisao-meta">
        <span class="revisao-numero">#${numero}</span>
        <span class="tag-materia">${escaparHtmlSeguro(nomeMateria)}</span>
        <span class="tag-tipo-questao ${obterClasseTipoQuestaoSimulado(tipo)}">${obterRotuloTipoQuestaoSimulado(tipo)}</span>
        <span class="card-questao-data">${data}</span>
        <span class="tag-estudo">Revisar: ${escaparHtmlSeguro(dataRevisao)}</span>
        ${q.edital_topicos?.titulo ? `<span class="tag-estudo">Edital: ${escaparHtmlSeguro(q.edital_topicos.titulo)}</span>` : ''}
        ${q.banca ? `<span class="tag-estudo">Banca: ${escaparHtmlSeguro(q.banca)}</span>` : ''}
        ${Number(q.revisao_etapa || 0) > 0 ? `<span class="tag-estudo">Ciclo 24/7/30: etapa ${Number(q.revisao_etapa || 0)}</span>` : ''}
        ${totalErros > 0 ? `<span class="tag-revisao tag-revisao--erro">${totalErros} erro${totalErros !== 1 ? 's' : ''} em revisão</span>` : ''}
        ${totalAcertos > 0 ? `<span class="tag-revisao tag-revisao--acerto">${totalAcertos} acerto${totalAcertos !== 1 ? 's' : ''}</span>` : ''}
      </div>
    </div>
    <p class="card-revisao-enunciado">${escaparHtmlSeguro(q.enunciado)}</p>
    <div class="modo-pre-resposta">
      <label class="campo-label">Antes de marcar: qual conceito resolve?</label>
      <textarea class="input-texto input-textarea simulado-pre-resposta" rows="2" placeholder="Escreva em uma frase a regra, pista ou raciocínio antes de olhar o gabarito..."></textarea>
    </div>
    <div class="checklist-resposta" aria-label="Checklist antes de responder">
      <label><input type="checkbox" class="simulado-check-item"> Li o comando da questão</label>
      <label><input type="checkbox" class="simulado-check-item"> Procurei exceções ou palavras absolutas</label>
      <label><input type="checkbox" class="simulado-check-item"> Diferenciei lei seca, interpretação ou raciocínio</label>
    </div>
    <div class="lista-alternativas-card">${alternativas}</div>
    <div class="simulado-antissabotagem">
      <div class="campo-form">
        <label class="campo-label">Confiança antes do gabarito</label>
        <select class="input-texto simulado-confianca-resposta">
          <option value="">Selecione...</option>
          ${opcoesConfianca}
        </select>
      </div>
    </div>
    <div class="simulado-revisao-gabarito escondido">
      <span class="tag-certa">Correta: ${escaparHtmlSeguro(q.alternativa_correta || '-')}</span>
      <span class="tag-errada tag-marcada-antes">Marquei antes: ${escaparHtmlSeguro(q.alternativa_marcada || '-')}</span>
      <span class="tag-estudo">Marquei agora: <span class="resposta-atual">-</span></span>
      ${q.motivo_erro ? `<span class="tag-estudo">Erro: ${escaparHtmlSeguro(q.motivo_erro)}</span>` : ''}
      ${q.nivel_confianca ? `<span class="tag-estudo">Confiança: ${escaparHtmlSeguro(q.nivel_confianca)}</span>` : ''}
      ${q.comentario ? `<p class="simulado-revisao-comentario">${escaparHtmlSeguro(q.comentario)}</p>` : ''}
      ${q.pegadinha_banca ? `<p class="simulado-revisao-comentario"><strong>Pegadinhas:</strong> ${escaparHtmlSeguro(q.pegadinha_banca)}</p>` : ''}
      ${q.conceito_chave ? `<p class="simulado-revisao-comentario"><strong>Conceito:</strong> ${escaparHtmlSeguro(q.conceito_chave)}</p>` : ''}
      ${q.como_reconhecer ? `<p class="simulado-revisao-comentario"><strong>Reconhecer:</strong> ${escaparHtmlSeguro(q.como_reconhecer)}</p>` : ''}
      ${q.acao_corretiva ? `<p class="simulado-revisao-comentario"><strong>Ação:</strong> ${escaparHtmlSeguro(q.acao_corretiva)}</p>` : ''}
    </div>
    <div class="simulado-diagnostico escondido">
      <h4 class="simulado-diagnostico-titulo">Diagnóstico da revisão</h4>
      <div class="form-grid-duas-colunas">
        <div class="campo-form">
          <label class="campo-label">Causa principal</label>
          <select class="input-texto simulado-diagnostico-motivo">
            <option value="">Selecione...</option>
            ${opcoesMotivo}
          </select>
        </div>
        <div class="campo-form">
          <label class="campo-label">Confiança registrada</label>
          <input class="input-texto simulado-diagnostico-confianca" type="text" value="" disabled>
        </div>
      </div>
      <div class="caderno-erros-grid">
        <div class="campo-form">
          <label class="campo-label">Conceito ou regra que resolve</label>
          <textarea class="input-texto input-textarea simulado-diagnostico-conceito" rows="2">${escaparHtmlSeguro(q.conceito_chave || '')}</textarea>
        </div>
        <div class="campo-form">
          <label class="campo-label">Como reconhecer na próxima vez</label>
          <textarea class="input-texto input-textarea simulado-diagnostico-reconhecer" rows="2">${escaparHtmlSeguro(q.como_reconhecer || '')}</textarea>
        </div>
        <div class="campo-form caderno-erros-grid-full">
          <label class="campo-label">Ação corretiva</label>
          <textarea class="input-texto input-textarea simulado-diagnostico-acao" rows="2">${escaparHtmlSeguro(q.acao_corretiva || '')}</textarea>
        </div>
      </div>
      <button class="btn-secundario btn-salvar-diagnostico" type="button">Salvar diagnóstico</button>
      <p class="simulado-diagnostico-feedback" aria-live="polite"></p>
    </div>
    <p class="simulado-revisao-feedback" aria-live="polite"></p>
    <div class="card-questao-acoes">
      <button class="btn-acao btn-registrar-resposta" type="button" disabled>Registrar resposta</button>
    </div>
  `

  card.querySelectorAll('.simulado-resposta-opcao').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!preRespostaSimuladoCompleta(card)) {
        const feedback = card.querySelector('.simulado-revisao-feedback')
        if (feedback) {
          feedback.textContent = 'Antes de marcar, escreva o conceito e conclua o checklist.'
          feedback.className = 'simulado-revisao-feedback simulado-revisao-feedback--erro'
        }
        return
      }

      selecionarRespostaSimulado(card, btn.dataset.letra)
    })
  })
  card.querySelector('.simulado-confianca-resposta')?.addEventListener('change', (e) => {
    selecionarConfiancaSimulado(card, e.target.value)
  })
  card.querySelector('.simulado-pre-resposta')?.addEventListener('input', () => atualizarBotaoRegistrarRespostaSimulado(card))
  card.querySelectorAll('.simulado-check-item').forEach(input => {
    input.addEventListener('change', () => atualizarBotaoRegistrarRespostaSimulado(card))
  })
  card.querySelector('.btn-registrar-resposta').addEventListener('click', () => registrarRespostaSelecionada(q, card))
  card.querySelector('.btn-salvar-diagnostico')?.addEventListener('click', () => salvarDiagnosticoSimulado(q, card))

  return card
}

function selecionarRespostaSimulado(card, letra) {
  card.dataset.respostaSelecionada = letra
  card.querySelectorAll('.simulado-resposta-opcao').forEach(btn => {
    btn.classList.toggle('simulado-resposta-opcao--selecionada', btn.dataset.letra === letra)
  })

  const respostaAtual = card.querySelector('.resposta-atual')
  if (respostaAtual) respostaAtual.textContent = letra

  atualizarBotaoRegistrarRespostaSimulado(card)

  if (!card.querySelector('.simulado-revisao-gabarito')?.classList.contains('escondido')) {
    const questao = card._questaoSimulado
    if (questao) marcarGabaritoNoCard(card, questao)
  }
}

function selecionarConfiancaSimulado(card, nivelConfianca) {
  card.dataset.confiancaResposta = nivelConfianca
  atualizarBotaoRegistrarRespostaSimulado(card)
}

function atualizarBotaoRegistrarRespostaSimulado(card) {
  const btnRegistrar = card.querySelector('.btn-registrar-resposta')
  if (!btnRegistrar) return

  btnRegistrar.disabled = !card.dataset.respostaSelecionada || !card.dataset.confiancaResposta || !preRespostaSimuladoCompleta(card)
}

function preRespostaSimuladoCompleta(card) {
  const texto = card.querySelector('.simulado-pre-resposta')?.value.trim() || ''
  const checks = Array.from(card.querySelectorAll('.simulado-check-item'))
  const marcados = checks.filter(input => input.checked).length
  return texto.length >= 8 && marcados === checks.length
}

function registrarRespostaSelecionada(q, card) {
  const respostaMarcada = card.dataset.respostaSelecionada
  const nivelConfianca = card.dataset.confiancaResposta
  const feedback = card.querySelector('.simulado-revisao-feedback')

  if (!respostaMarcada) {
    feedback.textContent = 'Selecione uma alternativa antes de registrar.'
    feedback.className = 'simulado-revisao-feedback simulado-revisao-feedback--erro'
    return
  }
  if (!nivelConfianca) {
    feedback.textContent = 'Selecione sua confiança antes de registrar.'
    feedback.className = 'simulado-revisao-feedback simulado-revisao-feedback--erro'
    return
  }
  if (!preRespostaSimuladoCompleta(card)) {
    feedback.textContent = 'Preencha o conceito antes da resposta e marque o checklist para registrar.'
    feedback.className = 'simulado-revisao-feedback simulado-revisao-feedback--erro'
    return
  }

  const resultado = respostaMarcada === q.alternativa_correta ? 'Acertou' : 'Errou'
  registrarResultadoRevisao(q, resultado, card, respostaMarcada, nivelConfianca)
}

function marcarGabaritoNoCard(card, q) {
  const respostaSelecionada = card.dataset.respostaSelecionada

  card.querySelectorAll('.simulado-resposta-opcao').forEach(btn => {
    const letra = btn.dataset.letra
    btn.classList.toggle('simulado-resposta-opcao--correta', letra === q.alternativa_correta)
    btn.classList.remove('simulado-resposta-opcao--marcada-antes')
    btn.classList.toggle(
      'simulado-resposta-opcao--selecionada-errada',
      letra === respostaSelecionada && respostaSelecionada !== q.alternativa_correta
    )
  })
}

async function registrarResultadoRevisao(q, resultado, card, respostaMarcada, nivelConfianca) {
  const acertou = resultado === 'Acertou'
  const hoje = dataSimuladoHoje()
  const proximaRevisao = calcularProximaRevisaoSimulado(hoje, q, acertou, nivelConfianca)
  const proximaEtapa = calcularEtapaRevisaoSimulado24730(q, acertou, nivelConfianca, proximaRevisao)
  const acertouComDominio = acertou && nivelConfianca === 'Confiante' && !proximaRevisao
  const feedback = card.querySelector('.simulado-revisao-feedback')
  const botoesResultado = card.querySelectorAll('.btn-registrar-resposta, .simulado-resposta-opcao, .simulado-confianca-resposta')

  botoesResultado.forEach(btn => { btn.disabled = true })
  feedback.textContent = 'Salvando resultado...'
  feedback.className = 'simulado-revisao-feedback'

  const { data, error: erroHistorico } = await db
    .from('questoes_revisoes')
    .insert({
      user_id: window.usuarioAtual.id,
      questao_id: q.id,
      data_revisao: hoje,
      resultado,
      resposta_marcada: respostaMarcada,
      nivel_confianca: nivelConfianca,
      revisar_novamente_em: proximaRevisao
    })
    .select('id')
    .single()

  if (erroHistorico) {
    console.error(erroHistorico)
    feedback.textContent = 'Erro ao salvar o resultado. Execute o SQL de melhoria no Supabase.'
    feedback.className = 'simulado-revisao-feedback simulado-revisao-feedback--erro'
    botoesResultado.forEach(btn => { btn.disabled = false })
    return
  }

  const { error: erroQuestao } = await db
    .from('questoes')
    .update({
      status_revisao: acertouComDominio ? 'recuperada' : 'pendente',
      revisar_novamente_em: proximaRevisao,
      revisao_ultima_data: hoje,
      revisao_ultima_resultado: resultado,
      ultima_confianca_revisao: nivelConfianca,
      revisao_etapa: proximaEtapa,
      revisao_total_acertos: Number(q.revisao_total_acertos || 0) + (acertou ? 1 : 0),
      revisao_total_erros: Number(q.revisao_total_erros || 0) + (acertou ? 0 : 1)
    })
    .eq('id', q.id)
    .eq('user_id', window.usuarioAtual.id)

  if (erroQuestao) {
    console.error(erroQuestao)
    feedback.textContent = 'O histórico foi salvo, mas não consegui atualizar a fila da questão.'
    feedback.className = 'simulado-revisao-feedback simulado-revisao-feedback--erro'
    botoesResultado.forEach(btn => { btn.disabled = false })
    return
  }

  card.classList.add('simulado-revisao-card--resolvido')
  card.querySelector('.simulado-revisao-gabarito')?.classList.remove('escondido')
  marcarGabaritoNoCard(card, q)
  feedback.textContent = acertouComDominio
    ? 'Questão recuperada. Ela saiu da fila de erradas.'
    : acertou
      ? montarMensagemAcertoEmCicloSimulado(q, proximaRevisao, nivelConfianca)
      : `Questão mantida na revisão da próxima semana: ${formatarDataSimulado(proximaRevisao)}.`
  feedback.className = `simulado-revisao-feedback ${acertouComDominio ? 'simulado-revisao-feedback--acerto' : acertou ? 'simulado-revisao-feedback--ciclo' : 'simulado-revisao-feedback--erro'}`

  card.querySelector('.btn-registrar-resposta')?.classList.add('btn-resultado-ativo')

  if (!acertouComDominio) {
    abrirDiagnosticoSimulado(card, nivelConfianca, data?.id || null)
  }

  await carregarQuestoesRecuperadas()
  if (typeof atualizarTelasAposRegistro === 'function') await atualizarTelasAposRegistro()
}

function calcularProximaRevisaoSimulado(hoje, q, acertou, nivelConfianca) {
  if (!acertou) return adicionarDiasDataISO(hoje, 1)

  const etapaAtual = Number(q.revisao_etapa || 0)
  if (etapaAtual <= 0) return adicionarDiasDataISO(hoje, 7)
  if (etapaAtual === 1) return adicionarDiasDataISO(hoje, 30)
  if (nivelConfianca !== 'Confiante') return adicionarDiasDataISO(hoje, 30)
  return null
}

function montarMensagemAcertoEmCicloSimulado(q, proximaRevisao, nivelConfianca) {
  const etapaAtual = Number(q.revisao_etapa || 0)

  if (nivelConfianca !== 'Confiante') {
    return `Você acertou, mas marcou ${nivelConfianca}. Para confirmar domínio, a questão volta em ${formatarDataSimulado(proximaRevisao)}.`
  }

  if (etapaAtual <= 0) {
    return `Você acertou a primeira revisão. Para consolidar, ela volta em ${formatarDataSimulado(proximaRevisao)}.`
  }

  if (etapaAtual === 1) {
    return `Você acertou a segunda revisão. Última confirmação em ${formatarDataSimulado(proximaRevisao)}.`
  }

  return `Você acertou, mas o sistema manteve uma nova revisão em ${formatarDataSimulado(proximaRevisao)}.`
}

function calcularEtapaRevisaoSimulado24730(q, acertou, nivelConfianca, proximaRevisao) {
  if (!acertou) return 0
  if (nivelConfianca !== 'Confiante' && proximaRevisao) return Math.min(Number(q.revisao_etapa || 0), 2)
  return Math.min(Number(q.revisao_etapa || 0) + 1, 3)
}

function abrirDiagnosticoSimulado(card, nivelConfianca, revisaoId) {
  const painel = card.querySelector('.simulado-diagnostico')
  if (!painel) return

  painel.classList.remove('escondido')
  painel.dataset.revisaoId = revisaoId || ''

  const campoConfianca = painel.querySelector('.simulado-diagnostico-confianca')
  if (campoConfianca) campoConfianca.value = nivelConfianca
}

async function salvarDiagnosticoSimulado(q, card) {
  const painel = card.querySelector('.simulado-diagnostico')
  if (!painel) return

  const motivoErro = painel.querySelector('.simulado-diagnostico-motivo')?.value || ''
  const conceitoChave = painel.querySelector('.simulado-diagnostico-conceito')?.value.trim() || ''
  const comoReconhecer = painel.querySelector('.simulado-diagnostico-reconhecer')?.value.trim() || ''
  const acaoCorretiva = painel.querySelector('.simulado-diagnostico-acao')?.value.trim() || ''
  const nivelConfianca = card.dataset.confiancaResposta || ''
  const feedback = painel.querySelector('.simulado-diagnostico-feedback')
  const botao = painel.querySelector('.btn-salvar-diagnostico')

  if (!motivoErro || !conceitoChave || !comoReconhecer || !acaoCorretiva) {
    feedback.textContent = 'Preencha causa, conceito, reconhecimento e ação corretiva.'
    feedback.className = 'simulado-diagnostico-feedback simulado-revisao-feedback--erro'
    return
  }

  botao.disabled = true
  feedback.textContent = 'Salvando diagnóstico...'
  feedback.className = 'simulado-diagnostico-feedback'

  const payload = {
    motivo_erro: motivoErro,
    nivel_confianca: nivelConfianca || q.nivel_confianca || null,
    conceito_chave: conceitoChave,
    como_reconhecer: comoReconhecer,
    acao_corretiva: acaoCorretiva
  }

  const { error: erroQuestao } = await db
    .from('questoes')
    .update(payload)
    .eq('id', q.id)
    .eq('user_id', window.usuarioAtual.id)

  if (erroQuestao) {
    console.error(erroQuestao)
    feedback.textContent = 'Erro ao salvar diagnóstico. Execute o SQL de melhoria no Supabase.'
    feedback.className = 'simulado-diagnostico-feedback simulado-revisao-feedback--erro'
    botao.disabled = false
    return
  }

  const revisaoId = painel.dataset.revisaoId
  if (revisaoId) {
    const { error: erroRevisao } = await db
      .from('questoes_revisoes')
      .update(payload)
      .eq('id', revisaoId)
      .eq('user_id', window.usuarioAtual.id)

    if (erroRevisao) console.error(erroRevisao)
  }

  q.motivo_erro = motivoErro
  q.nivel_confianca = payload.nivel_confianca
  q.conceito_chave = conceitoChave
  q.como_reconhecer = comoReconhecer
  q.acao_corretiva = acaoCorretiva

  feedback.textContent = 'Diagnóstico salvo nas questões para revisão.'
  feedback.className = 'simulado-diagnostico-feedback simulado-revisao-feedback--acerto'
  painel.classList.add('simulado-diagnostico--salvo')
  if (typeof carregarQuestoes === 'function') carregarQuestoes()
  if (typeof carregarEstatisticas === 'function' && typeof estatisticasInicializado !== 'undefined' && estatisticasInicializado) {
    await carregarEstatisticas()
  }
}

function normalizarTipoQuestaoSimulado(q) {
  if (typeof normalizarTipoQuestao === 'function') return normalizarTipoQuestao(q)
  if (q?.tipo_questao === 'Chutada' || q?.tipo_questao === 'Errada') return q.tipo_questao
  if (q?.motivo_erro === 'Chute' || q?.motivo_erro === 'Chute completo' || q?.nivel_confianca === 'Chutei') return 'Chutada'
  return 'Errada'
}

function obterRotuloTipoQuestaoSimulado(tipo) {
  if (typeof obterRotuloTipoQuestao === 'function') return obterRotuloTipoQuestao(tipo)
  return tipo === 'Chutada' ? 'Chutada' : 'Errada realmente'
}

function obterClasseTipoQuestaoSimulado(tipo) {
  if (typeof obterClasseTipoQuestao === 'function') return obterClasseTipoQuestao(tipo)
  return tipo === 'Chutada' ? 'tag-tipo-questao--chutada' : 'tag-tipo-questao--errada'
}

function obterRotuloFiltroTipo(tipoFiltro) {
  if (tipoFiltro === 'Chutada') return 'Só baixa confiança'
  if (tipoFiltro === 'Errada') return 'Só erros reais'
  return 'Erros e baixa confiança'
}

function obterRotuloPeriodoSimuladoRevisao(periodo) {
  if (periodo === '30') return 'Próximas 4 semanas'
  if (periodo === 'all') return 'Todas pendentes'
  return 'Fila desta semana'
}

function filtrarQuestoesPorPeriodoRevisao(questoes, periodo) {
  if (periodo === 'all') return questoes

  const hojeISO = dataSimuladoHoje()
  const limite = periodo === '30'
    ? adicionarDiasDataISO(hojeISO, 29)
    : obterFimSemanaAtualISO()

  return questoes.filter(q => {
    const dataReferencia = q.revisar_novamente_em || String(q.criado_em || '').substring(0, 10) || hojeISO
    return dataReferencia <= limite
  })
}

function formatarDataISOParaSimulado(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function obterFimSemanaAtualISO() {
  const hoje = new Date()
  const diaSemana = hoje.getDay()
  const diasAteDomingo = diaSemana === 0 ? 0 : 7 - diaSemana
  hoje.setDate(hoje.getDate() + diasAteDomingo)
  return formatarDataISOParaSimulado(hoje)
}

function adicionarDiasDataISO(dataISO, dias) {
  const data = new Date(`${dataISO}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return formatarDataISOParaSimulado(data)
}

function embaralharQuestoes(questoes) {
  const copia = [...questoes]

  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }

  return copia
}

function renderizarOptionsSelectSimulado(valores, valorAtual) {
  return valores.map(valor => `
    <option value="${escaparHtmlSeguro(valor)}" ${valor === valorAtual ? 'selected' : ''}>${escaparHtmlSeguro(valor)}</option>
  `).join('')
}

async function carregarQuestoesRecuperadas() {
  const container = document.getElementById('simulado-recuperadas')
  if (!container) return

  container.innerHTML = '<p class="texto-placeholder">⏳ Buscando questões recuperadas...</p>'

  const { data, error } = await db
    .from('questoes')
    .select('id, enunciado, tipo_questao, motivo_erro, nivel_confianca, revisao_ultima_data, revisao_total_acertos, revisao_total_erros, materias(nome)')
    .eq('user_id', window.usuarioAtual.id)
    .eq('status_revisao', 'recuperada')
    .order('revisao_ultima_data', { ascending: false, nullsFirst: false })
    .limit(20)

  if (error) {
    console.error(error)
    container.innerHTML = ''
    container.appendChild(criarEstadoErroSimulado(
      'Não foi possível carregar as questões recuperadas',
      'Execute o arquivo supabase-melhoria-estudos.sql no Supabase e tente novamente.',
      error.message,
      carregarQuestoesRecuperadas
    ))
    return
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="texto-placeholder">As questões acertadas no simulado aparecerão separadas aqui.</p>'
    return
  }

  container.innerHTML = `
    <div class="simulado-recuperadas-topo">
      <h3 class="simulado-revisao-titulo">Questões recuperadas</h3>
      <span class="simulado-revisao-total">${data.length} recentes</span>
    </div>
    <div class="simulado-recuperadas-lista"></div>
  `

  const lista = container.querySelector('.simulado-recuperadas-lista')
  data.forEach(q => lista.appendChild(criarCardQuestaoRecuperada(q)))
}

function criarCardQuestaoRecuperada(q) {
  const card = document.createElement('div')
  card.className = 'simulado-recuperada-card'

  const tipo = normalizarTipoQuestaoSimulado(q)
  const enunciado = q.enunciado.length > 140 ? `${q.enunciado.substring(0, 140)}...` : q.enunciado
  const dataRecuperacao = q.revisao_ultima_data ? formatarDataSimulado(q.revisao_ultima_data) : '-'
  const totalErros = Number(q.revisao_total_erros || 0)

  card.innerHTML = `
    <div class="card-revisao-meta">
      <span class="tag-materia">${escaparHtmlSeguro(q.materias?.nome || 'Sem matéria')}</span>
      <span class="tag-tipo-questao ${obterClasseTipoQuestaoSimulado(tipo)}">${obterRotuloTipoQuestaoSimulado(tipo)}</span>
      <span class="tag-revisao tag-revisao--acerto">Recuperada em ${escaparHtmlSeguro(dataRecuperacao)}</span>
      ${totalErros > 0 ? `<span class="tag-revisao tag-revisao--erro">${totalErros} erro${totalErros !== 1 ? 's' : ''} antes de recuperar</span>` : ''}
    </div>
    <p class="card-questao-enunciado">${escaparHtmlSeguro(enunciado)}</p>
  `

  return card
}

async function salvarSimulado() {
  const data = document.getElementById('simulado-data').value
  const nome = document.getElementById('simulado-nome').value.trim()
  const banca = document.getElementById('simulado-banca').value.trim()
  const total = parseInt(document.getElementById('simulado-total').value)
  const certas = parseInt(document.getElementById('simulado-certas').value)
  const erradas = parseInt(document.getElementById('simulado-erradas').value)
  const tempo = parseInt(document.getElementById('simulado-tempo').value)
  const comentario = document.getElementById('simulado-comentario').value.trim()

  if (!data || !nome || !total || total < 1) {
    mostrarMsgSimulado('Preencha data, nome e total de questões.', 'erro')
    return
  }

  if (Number.isNaN(certas) || certas < 0 || certas > total) {
    mostrarMsgSimulado('Digite uma quantidade válida de certas.', 'erro')
    return
  }

  if (Number.isNaN(erradas) || erradas < 0 || certas + erradas > total) {
    mostrarMsgSimulado('Digite uma quantidade válida de erradas.', 'erro')
    return
  }

  const nota = Math.round((certas / total) * 10000) / 100

  const { error } = await db
    .from('simulados')
    .insert({
      user_id: window.usuarioAtual.id,
      data,
      nome,
      banca: banca || null,
      total_questoes: total,
      certas,
      erradas,
      tempo_minutos: Number.isNaN(tempo) ? null : tempo,
      nota_percentual: nota,
      comentario: comentario || null
    })

  if (error) {
    console.error(error)
    mostrarMsgSimulado('Erro ao salvar. Execute o SQL de melhoria no Supabase se ainda não fez.', 'erro')
    return
  }

  limparFormularioSimulado()
  mostrarMsgSimulado('Simulado salvo com sucesso.', 'sucesso')
  await carregarSimulados()
}

async function carregarSimulados() {
  const lista = document.getElementById('lista-simulados')
  if (!lista) return

  lista.innerHTML = '<p class="texto-placeholder">⏳ Buscando seus simulados...</p>'

  const { data, error } = await db
    .from('simulados')
    .select('id, data, nome, banca, total_questoes, certas, erradas, tempo_minutos, nota_percentual, comentario')
    .eq('user_id', window.usuarioAtual.id)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false })

  if (error) {
    console.error(error)
    lista.innerHTML = ''
    lista.appendChild(criarEstadoErroSimulado(
      'Não foi possível carregar os simulados',
      'Execute o arquivo supabase-melhoria-estudos.sql no Supabase e tente novamente.',
      error.message
    ))
    return
  }

  renderizarResumoSimulados(data || [])

  if (!data || data.length === 0) {
    lista.innerHTML = '<p class="texto-placeholder">Nenhum simulado registrado ainda.</p>'
    return
  }

  lista.innerHTML = ''
  data.forEach(simulado => lista.appendChild(criarCardSimulado(simulado)))
}

function criarCardSimulado(simulado) {
  const card = document.createElement('div')
  card.className = 'simulado-card'

  const data = formatarDataSimulado(simulado.data)
  const nota = Number(simulado.nota_percentual).toFixed(1)
  const tempo = simulado.tempo_minutos !== null
    ? `${simulado.tempo_minutos} min`
    : 'Sem tempo'

  card.innerHTML = `
    <div class="simulado-card-topo">
      <div>
        <h3 class="simulado-titulo">${escaparHtmlSeguro(simulado.nome)}</h3>
        <p class="simulado-subtitulo">${escaparHtmlSeguro(data)}${simulado.banca ? ` · ${escaparHtmlSeguro(simulado.banca)}` : ''}</p>
      </div>
      <span class="simulado-nota">${nota}%</span>
    </div>
    <div class="simulado-metricas">
      <span>${simulado.total_questoes} questões</span>
      <span class="resumo-certa-sessao">✅ ${simulado.certas}</span>
      <span class="resumo-errada-sessao">❌ ${simulado.erradas}</span>
      <span>${tempo}</span>
    </div>
    ${simulado.comentario ? `<p class="card-questao-comentario">${escaparHtmlSeguro(simulado.comentario)}</p>` : ''}
    <div class="card-questao-acoes">
      <button class="btn-acao btn-excluir" type="button">Excluir</button>
    </div>
  `

  card.querySelector('.btn-excluir').addEventListener('click', () => excluirSimulado(simulado.id))
  return card
}

function renderizarResumoSimulados(simulados) {
  const resumo = document.getElementById('simulados-resumo')
  if (!resumo) return

  if (simulados.length === 0) {
    resumo.innerHTML = ''
    return
  }

  const total = simulados.length
  const media = simulados.reduce((acc, s) => acc + Number(s.nota_percentual || 0), 0) / total
  const melhor = Math.max(...simulados.map(s => Number(s.nota_percentual || 0)))
  const ultimo = Number(simulados[0].nota_percentual || 0)

  resumo.innerHTML = `
    <div class="resumo-card">
      <span class="resumo-numero">${total}</span>
      <span class="resumo-label">Simulados</span>
    </div>
    <div class="resumo-card">
      <span class="resumo-numero">${media.toFixed(1)}%</span>
      <span class="resumo-label">Média</span>
    </div>
    <div class="resumo-card">
      <span class="resumo-numero">${melhor.toFixed(1)}%</span>
      <span class="resumo-label">Melhor nota</span>
    </div>
    <div class="resumo-card">
      <span class="resumo-numero">${ultimo.toFixed(1)}%</span>
      <span class="resumo-label">Último simulado</span>
    </div>
  `
}

async function excluirSimulado(id) {
  if (!confirm('Excluir este simulado?')) return

  const { error } = await db
    .from('simulados')
    .delete()
    .eq('id', id)
    .eq('user_id', window.usuarioAtual.id)

  if (error) {
    mostrarMsgSimulado('Erro ao excluir simulado.', 'erro')
    return
  }

  mostrarMsgSimulado('Simulado excluído.', 'sucesso')
  await carregarSimulados()
}

function limparFormularioSimulado() {
  document.getElementById('simulado-data').value = dataSimuladoHoje()
  document.getElementById('simulado-nome').value = ''
  document.getElementById('simulado-banca').value = ''
  document.getElementById('simulado-total').value = ''
  document.getElementById('simulado-certas').value = ''
  document.getElementById('simulado-erradas').value = ''
  document.getElementById('simulado-tempo').value = ''
  document.getElementById('simulado-comentario').value = ''
}

function criarEstadoErroSimulado(titulo, mensagem, detalhe, aoTentarNovamente = carregarSimulados) {
  const div = document.createElement('div')
  div.className = 'estado-erro'
  div.innerHTML = `
    <h3 class="estado-erro-titulo">${escaparHtmlSeguro(titulo)}</h3>
    <p class="estado-erro-texto">${escaparHtmlSeguro(mensagem)}</p>
    ${detalhe ? `<p class="estado-erro-detalhe">${escaparHtmlSeguro(detalhe)}</p>` : ''}
    <button class="btn-secundario" type="button">Tentar novamente</button>
  `
  div.querySelector('button').addEventListener('click', aoTentarNovamente)
  return div
}

function formatarDataSimulado(dataStr) {
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

function dataSimuladoHoje() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

function mostrarMsgSimulado(texto, tipo) {
  const msg = document.getElementById('msg-simulado')
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo}`
}

function mostrarMsgSimuladoRevisao(texto, tipo) {
  const msg = document.getElementById('msg-simulado-revisao')
  if (!msg) return
  msg.textContent = texto
  msg.className = `msg-materia ${tipo}`
}
