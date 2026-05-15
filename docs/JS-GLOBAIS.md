# Mapeamento dos JavaScripts globais

Este documento registra a organizacao atual dos scripts globais antes de qualquer refatoracao. Ele serve como referencia para evitar mudancas de ordem, nomes ou dependencias sem verificacao previa.

## 1. Ordem dos scripts em app.html

1. `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
2. `js/config.js`
3. `js/auth.js`
4. `js/utils.js`
5. `js/materias.js`
6. `js/edital.js`
7. `js/questoes.js`
8. `js/sessoes.js`
9. `js/gamificacao.js`
10. `js/dashboard.js`
11. `js/revisao.js`
12. `js/estatisticas.js`
13. `js/plano.js`
14. `js/simulados.js`
15. `js/planejamento.js`
16. `js/app.js`

## 2. Ordem dos scripts em index.html

1. `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
2. `js/config.js`
3. `js/auth.js`

## 3. Funcoes globais importantes por arquivo

### `js/auth.js`

- `mostrarMensagem`
- `limparMensagem`
- `setBotaoCarregando`
- `obterUrlArquivo`
- `obterBaseArquivosAuth`
- `obterScriptAuthAtual`
- `obterUrlApp`
- `ehLinkRedefinicaoSenhaAuth`
- `verificarSessao`
- `traduzirErro`

### `js/utils.js`

- `escaparHtmlSeguro`
- `formatarQuantidadeQuestoes`
- `contarOcorrenciasValores`
- `avaliarQualidadeDiagnosticoQuestao`
- `valorDiagnostico`
- `campoDiagnosticoPreenchido`
- `criarResumoQualidadeDiagnostico`
- `criarAlertaCadastroFracoQuestao`
- `calcularPorcentagem`
- `formatarData`
- `dataISO`
- `dataHoje`
- `adicionarDias`
- `calcularDiasAteProva`
- `diaAnterior`
- `formatarDataCurta`

### `js/materias.js`

- `inicializarMaterias`
- `carregarMaterias`
- `obterIconeMateria`
- `criarCardMateria`
- `salvarMateriaUsuario`
- `mostrarMsgMateria`

### `js/edital.js`

- `inicializarEdital`
- `carregarEdital`
- `validarDataProvaEdital`
- Funcoes ligadas a materias, topicos e pegadinhas do edital.

### `js/questoes.js`

- `inicializarQuestoes`
- `carregarQuestoes`
- `salvarQuestao`
- `ordenarQuestoes`
- `carregarQuestoesEmMemoria`
- `obterOuCriarSessaoDeHoje`
- `recalcularTotalQuestoesSessao`
- Funcoes de normalizacao de tipo/status de questao.
- Funcoes ligadas a assistente de IA e diagnostico de questoes.

### `js/sessoes.js`

- `inicializarDesempenho`
- `carregarDesempenho`
- `atualizarResumoTopo`
- `criarCardSessao`
- `renderizarLinhasMaterias`

### `js/gamificacao.js`

- `avaliarConquistasUsuario`
- `buscarDadosConquistasGamificacao`
- `obterResumoStreakGamificacao`
- `normalizarResumoGamificacaoBanco`
- `calcularRecordeGamificacao`
- `contarSequenciaGamificacao`
- `adicionarDataNormalizadaGamificacao`

### `js/dashboard.js`

- `inicializarDashboard`
- `carregarDashboard`
- `criarEstadoVazioDashboard`
- `criarCardsDashboardVazios`
- `criarPeriodoArquivamento`
- `montarResumoArquivamentoMensal`
- `criarResumoMateriaArquivamento`
- `normalizarTipoArquivamento`
- `formatarDataBRArquivamento`
- `obterClasseAproveitamentoDashboard`
- `criarDonutAproveitamentoDashboard`

### `js/revisao.js`

- `inicializarRevisao`
- `filtrarRevisao`
- `gerarFilaRevisaoInteligente`
- `calcularProximaRevisao24730`
- `calcularEtapaRevisao24730`
- `calcularIntervaloRepeticaoEtapa24730`
- `preRespostaTreinoCompleta`

### `js/estatisticas.js`

- `inicializarEstatisticas`
- `carregarEstatisticas`
- `montarRelatorioEvolucao`
- `normalizarTipoQuestaoRelatorio`
- `contarValoresEstatisticas`
- `formatarDataBREstatisticas`
- `agruparErradasPorMateria`
- `agruparCertasPorMateria`
- `calcularResumoPeriodo`
- `formatarDeltaRelatorio`
- `escaparHtmlEstatisticas`

### `js/plano.js`

- `inicializarPlano`
- `carregarPlanoDia`
- `montarItemPlano`
- `criarCardPlano`
- `intervaloSemanaPlano`
- `diferencaDiasPlano`
- `dataISOHojePlano`
- `dataISOPlano`
- `mostrarMsgPlano`

### `js/simulados.js`

- `inicializarSimulados`
- `gerarSimuladoRevisao`
- `salvarSimulado`
- `carregarSimulados`
- `calcularProximaRevisaoSimulado`
- `calcularEtapaRevisaoSimulado24730`
- `normalizarTipoQuestaoSimulado`
- `obterRotuloFiltroTipo`
- `obterRotuloPeriodoSimuladoRevisao`
- `filtrarQuestoesPorPeriodoRevisao`
- `formatarDataISOParaSimulado`
- `adicionarDiasDataISO`
- `embaralharQuestoes`
- `formatarDataSimulado`

### `js/planejamento.js`

- `inicializarPlanejamento`
- `carregarPlanejamento`
- `montarRelatorioProntoProva`
- `montarFilaInteligente`
- `converterDiaSemanaPlanejamento`
- `adicionarDiasPlanejamento`
- `dataPlanejamentoISO`

### `js/app.js`

- `inicializar`
- `navegarPara`
- `aplicarModoInterface`
- Funcoes de perfil, logout, backup, onboarding, menu e inicializacao das secoes.

## 4. Variaveis globais importantes

- `db`: cliente Supabase criado em `js/config.js`.
- `window.db`: referencia global para o cliente Supabase.
- `SUPABASE_URL`: URL publica do projeto Supabase em `js/config.js`.
- `SUPABASE_ANON_KEY`: chave publica anon/publishable do Supabase em `js/config.js`.
- `window.ADMIN_EMAILS`: lista usada para identificar emails administrativos no frontend.
- `window.usuarioAtual`: usuario logado usado pelo app.
- `window.perfilAtual`: perfil atual usado pelo app.
- `window.modoInterfaceAtual`: modo de interface atual.
- Variaveis internas de estado por arquivo, como caches, filtros atuais, flags de inicializacao e listas em memoria.

## 5. Arquivos que dependem de `db` ou `window.db`

- `js/config.js`: cria `db` e expoe `window.db`.
- `js/auth.js`: usa `db.auth` no fluxo de autenticacao.
- `js/app.js`: usa Supabase para usuario, perfil, configuracoes e dados gerais do app.
- `js/dashboard.js`: consulta dados agregados e historicos.
- `js/edital.js`: consulta e salva dados de edital, materias, topicos e pegadinhas.
- `js/estatisticas.js`: consulta dados para relatorios e estatisticas.
- `js/gamificacao.js`: consulta RPCs e dados de gamificacao.
- `js/materias.js`: consulta e salva materias.
- `js/planejamento.js`: consulta dados para planejamento.
- `js/plano.js`: consulta e salva plano de estudos.
- `js/questoes.js`: consulta, salva questoes e chama funcoes/Edge Functions.
- `js/revisao.js`: consulta questoes e registra revisoes.
- `js/sessoes.js`: consulta sessoes e resumo de desempenho.
- `js/simulados.js`: consulta, salva e revisa simulados.
- `js/config.example.js`: exemplo de configuracao, nao deve ser usado como configuracao real em producao.

## 6. Arquivos que dependem de funcoes de `utils.js`

- `js/app.js`: `escaparHtmlSeguro`, `dataISO`, `dataHoje`, `adicionarDias`.
- `js/dashboard.js`: `escaparHtmlSeguro`, `formatarQuantidadeQuestoes`, `contarOcorrenciasValores`, `avaliarQualidadeDiagnosticoQuestao`, `dataISO`, `dataHoje`.
- `js/edital.js`: `escaparHtmlSeguro`, `dataISO`, `dataHoje`.
- `js/gamificacao.js`: `escaparHtmlSeguro`, `dataHoje`, `adicionarDias`.
- `js/materias.js`: `escaparHtmlSeguro`.
- `js/planejamento.js`: `escaparHtmlSeguro`, `formatarQuantidadeQuestoes`, `dataISO`.
- `js/plano.js`: `escaparHtmlSeguro`, `dataHoje`.
- `js/questoes.js`: `escaparHtmlSeguro`, `formatarQuantidadeQuestoes`, `avaliarQualidadeDiagnosticoQuestao`, `criarResumoQualidadeDiagnostico`, `criarAlertaCadastroFracoQuestao`, `dataHoje`, `adicionarDias`.
- `js/revisao.js`: `escaparHtmlSeguro`, `formatarQuantidadeQuestoes`, `contarOcorrenciasValores`, `avaliarQualidadeDiagnosticoQuestao`, `criarResumoQualidadeDiagnostico`, `criarAlertaCadastroFracoQuestao`, `dataISO`, `dataHoje`, `adicionarDias`, `calcularDiasAteProva`, `formatarDataCurta`.
- `js/sessoes.js`: `escaparHtmlSeguro`.
- `js/simulados.js`: `escaparHtmlSeguro`, `formatarQuantidadeQuestoes`, `dataISO`.

## 7. Arquivos que expoem funcoes em `globalThis` para testes

### `js/auth.js`

- `mostrarMensagem`
- `limparMensagem`
- `setBotaoCarregando`
- `obterUrlArquivo`
- `obterBaseArquivosAuth`
- `obterScriptAuthAtual`
- `obterUrlApp`
- `ehLinkRedefinicaoSenhaAuth`
- `verificarSessao`
- `traduzirErro`

### `js/utils.js`

- `escaparHtmlSeguro`
- `formatarQuantidadeQuestoes`
- `contarOcorrenciasValores`
- `avaliarQualidadeDiagnosticoQuestao`
- `valorDiagnostico`
- `campoDiagnosticoPreenchido`
- `criarResumoQualidadeDiagnostico`
- `criarAlertaCadastroFracoQuestao`
- `calcularPorcentagem`
- `formatarData`
- `dataISO`
- `dataHoje`
- `adicionarDias`
- `calcularDiasAteProva`
- `diaAnterior`
- `formatarDataCurta`

### `js/dashboard.js`

- `criarEstadoVazioDashboard`
- `criarCardsDashboardVazios`
- `criarPeriodoArquivamento`
- `montarResumoArquivamentoMensal`
- `criarResumoMateriaArquivamento`
- `normalizarTipoArquivamento`
- `formatarDataBRArquivamento`
- `obterClasseAproveitamentoDashboard`
- `criarDonutAproveitamentoDashboard`

### `js/edital.js`

- `validarDataProvaEdital`
- `filtrarTopicosEditalPorMateria`
- `obterTextoBotaoConfigEdital`

### `js/estatisticas.js`

- `montarRelatorioEvolucao`
- `normalizarTipoQuestaoRelatorio`
- `contarValoresEstatisticas`
- `formatarDataBREstatisticas`
- `agruparErradasPorMateria`
- `agruparCertasPorMateria`
- `calcularResumoPeriodo`
- `formatarDeltaRelatorio`
- `escaparHtmlEstatisticas`

### `js/gamificacao.js`

- `avaliarConquistasUsuario`
- `buscarDadosConquistasGamificacao`
- `obterResumoStreakGamificacao`
- `normalizarResumoGamificacaoBanco`
- `calcularRecordeGamificacao`
- `contarSequenciaGamificacao`
- `adicionarDataNormalizadaGamificacao`

### `js/materias.js`

- `obterIconeMateria`
- `criarCardMateria`
- `salvarMateriaUsuario`
- `mostrarMsgMateria`

### `js/planejamento.js`

- `montarRelatorioProntoProva`
- `montarFilaInteligente`
- `converterDiaSemanaPlanejamento`
- `adicionarDiasPlanejamento`
- `dataPlanejamentoISO`

### `js/plano.js`

- `montarItemPlano`
- `criarCardPlano`
- `intervaloSemanaPlano`
- `diferencaDiasPlano`
- `dataISOHojePlano`
- `dataISOPlano`
- `mostrarMsgPlano`

### `js/questoes.js`

- `CONFIG_TIPO_QUESTAO`
- `normalizarTipoQuestao`
- `normalizarStatusRevisao`
- `obterTipoQuestaoPorCampos`
- `questaoChutadaAcertada`
- `normalizarTextoDuplicidade`
- `ordenarQuestoes`
- `carregarQuestoesEmMemoria`
- `obterOuCriarSessaoDeHoje`
- `recalcularTotalQuestoesSessao`

### `js/revisao.js`

- `calcularProximaRevisao24730`
- `calcularEtapaRevisao24730`
- `calcularIntervaloRepeticaoEtapa24730`
- `preRespostaTreinoCompleta`

### `js/sessoes.js`

- `atualizarResumoTopo`
- `criarCardSessao`
- `renderizarLinhasMaterias`

### `js/simulados.js`

- `calcularProximaRevisaoSimulado`
- `calcularEtapaRevisaoSimulado24730`
- `normalizarTipoQuestaoSimulado`
- `obterRotuloFiltroTipo`
- `obterRotuloPeriodoSimuladoRevisao`
- `filtrarQuestoesPorPeriodoRevisao`
- `formatarDataISOParaSimulado`
- `adicionarDiasDataISO`
- `embaralharQuestoes`
- `formatarDataSimulado`

## 8. Riscos de mudar a ordem dos scripts

- `supabase-js` precisa carregar antes de `js/config.js`, porque `config.js` usa `supabase.createClient`.
- `js/config.js` precisa carregar antes dos arquivos que usam `db` ou `window.db`.
- `js/utils.js` precisa carregar antes dos arquivos que usam suas funcoes auxiliares.
- `js/app.js` deve continuar depois dos arquivos de funcionalidade, porque ele referencia inicializadores de secoes como materias, questoes, dashboard, revisao, estatisticas, plano, simulados e planejamento.
- `js/questoes.js` e importante para rotinas chamadas por outras telas, como sessoes, revisao e simulados.
- `js/gamificacao.js` deve continuar antes de pontos que dependem de resumo, streak ou conquistas.
- A ordem usada nos testes deve permanecer compativel com a ordem real do navegador para evitar falsos positivos ou falsos negativos.

## 9. Recomendacoes para organizacao futura sem quebrar o sistema

- Fazer mudancas pequenas, em uma etapa por vez.
- Antes de mover qualquer funcao, procurar todos os usos no JavaScript e nos testes.
- Nao alterar IDs do HTML sem verificar os seletores usados pelos scripts.
- Manter `db` e `window.db` estaveis enquanto o sistema ainda usa scripts globais.
- Comecar qualquer organizacao futura por funcoes puras de `utils.js`, pois elas tendem a ter menor acoplamento com DOM e Supabase.
- Manter as exposicoes em `globalThis` enquanto os testes dependerem delas.
- Evitar renomear funcoes globais sem uma etapa dedicada de busca, alteracao e teste.
- Se um modulo novo for criado no futuro, migrar primeiro um conjunto pequeno de funcoes e rodar `npm run check:js` e `npm test`.
- Registrar quais arquivos foram alterados em cada etapa para facilitar reversao.
- Preservar o comportamento atual antes de fazer melhorias visuais, migracao para TypeScript, Vite ou qualquer refatoracao maior.
