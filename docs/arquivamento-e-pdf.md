# Arquivamento mensal e PDF

Este documento registra o funcionamento atual do PDF mensal, do arquivamento mensal e da preservação das questões detalhadas.

## Estado atual do arquivamento mensal

- O arquivamento mensal salva o resumo estatístico em `estatisticas_mensais`.
- As questões detalhadas continuam preservadas na tabela `questoes`.
- O arquivamento mensal não apaga mais questões automaticamente.
- A exclusão manual individual de questões, se existir na interface, continua sendo uma ação separada do arquivamento mensal.

## Estado atual do PDF mensal

- O usuário pode escolher mês e ano antes de gerar o relatório.
- O PDF usa o período selecionado pelo usuário.
- O filtro das questões usa o campo `criado_em`.
- O relatório continua sendo gerado como uma janela HTML com `window.print()`.
- O sistema não usa `jsPDF` nesse fluxo.

## Fluxo recomendado para o usuário

1. Escolher o mês e ano desejados.
2. Gerar o PDF do período selecionado.
3. Conferir o relatório e salvar ou imprimir, se desejar.
4. Arquivar o resumo mensal somente quando fizer sentido.
5. Manter as questões detalhadas disponíveis para revisão futura.

## O que o sistema não faz mais

- Não apaga automaticamente questões ao arquivar.
- Não limpa detalhes mensais automaticamente.
- Não aplica retenção automática de 90 dias.
- Não faz arquivamento lógico com campo `arquivada` ou `data_arquivamento` ainda.

## Cuidados para futuras IAs e desenvolvedores

- Não reintroduzir `delete` automático em `questoes` no arquivamento mensal.
- Não alterar o campo `criado_em` sem revisar PDF, estatísticas e testes.
- Não mudar o arquivamento sem rodar a bateria completa de validação.
- Não mudar esse fluxo sem CI verde.

## Comandos obrigatórios antes de mudanças futuras

```powershell
npm.cmd run check:js
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

## Testes e CI

- `tests/dashboard.test.js` protege o fluxo de arquivamento mensal e geração de PDF.
- O CI do GitHub Actions valida automaticamente o projeto em push e pull request.
