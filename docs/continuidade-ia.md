# Continuidade para IAs e Desenvolvedores

## Objetivo do projeto

O `estudo-concurso` é um sistema de estudo para concurso, usado em rotina real diária.

A prioridade atual é estabilidade: revisão, flashcards, questões, estatísticas e segurança dos dados devem continuar funcionando antes de qualquer expansão.

## Estado técnico atual

- Estado confiável: `9da16aa feat: render markdown bold in edital notes`.
- Branch `main` sincronizada com `origin/main`.
- Working tree limpo.
- Projeto em HTML, CSS e JavaScript, com TypeScript gradual.
- Vite configurado para validação/build.
- CI no GitHub Actions em `.github/workflows/ci.yml`.
- Scripts principais:
  - `npm.cmd run check:js`
  - `npm.cmd test`
  - `npm.cmd run typecheck`
  - `npm.cmd run build`

## Estado de validação atual

- `check:js` passando.
- 490 testes passando em 22 arquivos.
- `typecheck` passando.
- `build` passando.
- CI verde no GitHub Actions no commit `9da16aa`.
- GitHub Pages verde no commit `9da16aa`.
- QA visual/manual aprovado no Google Chrome normal do Windows.

## Melhorias recentes

### Flashcards/SM-2

- Teste de equivalência entre SM-2 JavaScript e TypeScript.
- Legenda visual da escala 0 a 5 na revisão.
- Datas amigáveis para próxima revisão.
- Indicador de atrasados vs. para hoje.
- Correção visual de singular/plural em `dia` e `dias`.
- Estatísticas com indicadores `Atrasados` e `Para hoje`.

### Questões/Caderno de Erros

- Mensagem antiga de falta de matéria corrigida.
- Prompt da IA de diagnóstico de questões melhorado.

### Arquivamento/PDF

- Arquivamento mensal preserva questões detalhadas.
- PDF mensal permite selecionar mês/ano.
- Documentação específica criada em `docs/arquivamento-e-pdf.md`.

### Revisão

- Botão `Flashcards` da seção Revisão renomeado para `Treinar lista filtrada`.
- Mensagem vazia do treino filtrado ficou mais clara.
- O treino filtrado continua separado da fila inteligente e do módulo real de Flashcards/SM-2.

### CI

- Workflow criado em `.github/workflows/ci.yml`.
- CI roda validações em push e pull request para `main`.

### Markdown básico seguro

- Flashcards: concluído anteriormente.
- Questões/Caderno/Revisão: concluído anteriormente.
- Simulados: concluído no commit `5976be1 feat: render markdown bold in simulados cards`.
- Dashboard: diagnosticado; não implementar Markdown neste momento.
- Estatísticas: diagnosticado; não implementar Markdown neste momento.
- Planejamento/Lei Seca: concluído no commit `bf80ba7 feat: render markdown bold in lei seca notes`.
- Edital: concluído no commit `9da16aa feat: render markdown bold in edital notes`.
- Markdown continua proibido em inputs, textareas, atributos HTML, PDF/exportações, prompts copiáveis, botões, métricas, gráficos, SVG, filtros e labels técnicos, salvo novo diagnóstico específico.

## Regras que não devem ser quebradas

- Não reintroduzir `delete` automático em `questoes` no arquivamento mensal.
- Não alterar o campo `criado_em` sem revisar PDF, arquivamento, estatísticas e testes.
- Não alterar SM-2 sem rodar testes específicos.
- Não misturar o módulo real Flashcards/SM-2 com treino de questões em formato de cards.
- Não fazer refatorações grandes sem necessidade clara.
- Não alterar Supabase/migrations sem plano e validação.
- Não mexer em autenticação/login sem diagnóstico.
- Não remover testes de segurança.

## Fluxo obrigatório antes de qualquer mudança

1. `git status`
2. `npm.cmd run check:js`
3. `npm.cmd test`
4. `npm.cmd run typecheck`
5. `npm.cmd run build`

## Fluxo obrigatório depois de qualquer mudança

1. Rodar novamente:
   - `npm.cmd run check:js`
   - `npm.cmd test`
   - `npm.cmd run typecheck`
   - `npm.cmd run build`
2. Fazer teste visual quando houver mudança de interface.
   - Usar o Google Chrome normal do Windows.
   - Não usar Microsoft Edge nem navegador embutido para QA visual.
3. Criar commit pequeno e focado.
4. Fazer push para `origin/main`.
5. Verificar CI verde no GitHub Actions.
6. Considerar a mudança pronta somente com CI verde.

## Próximas pendências recomendadas

Ordem segura sugerida:

1. Usar o sistema em estudo real.
2. Corrigir somente bugs específicos e reproduzíveis.
3. Diagnosticar refresh do Dashboard após salvar questão somente se a lentidão persistir.
4. Tratar `BUG-DASH-004` somente se incomodar.
5. Tratar `BUG-DASH-005/006` em etapa separada e de baixa prioridade.
6. Tratar `BUG-DASH-007` em etapa separada.
7. Avaliar persistência estruturada dos campos ricos dos Flashcards somente com plano de banco separado.
8. Avaliar paginação server-side somente com diagnóstico próprio.

## Coisas para não fazer agora

- Criar migration de retenção de 90 dias sem diagnóstico.
- Refatorar `dashboard.js` inteiro.
- Unificar SM-2 sem plano próprio.
- Trocar `window.print()` por jsPDF agora.
- Converter tudo para TypeScript de uma vez.
- Mexer em RLS/Supabase sem auditoria.

## Estilo de trabalho esperado

- Uma mudança pequena por vez.
- Sempre com teste.
- Sempre com commit pequeno.
- Sempre com CI verde.
- Priorizar o uso real do usuário.
