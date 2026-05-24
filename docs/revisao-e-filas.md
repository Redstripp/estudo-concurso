# Revisao e filas

Este documento registra o funcionamento atual da secao Revisao e evita confusao entre tres fluxos parecidos:

- fila inteligente;
- treino da lista filtrada em formato de cards;
- modulo real de Flashcards/SM-2.

## Objetivo da secao Revisao

A secao Revisao existe para revisar questoes erradas ou pendentes, priorizar o estudo do ciclo e permitir treino sem mostrar o gabarito imediatamente.

Ela trabalha principalmente com questoes do Caderno de Erros e com a fila inteligente da revisao. Quando a interface usa formato de cards, isso significa apenas uma forma de apresentar questoes para treino.

## Fila inteligente

A fila inteligente usa `filaRevisaoInteligenteAtual`.

Ela prioriza questoes do ciclo e pode considerar sinais como pendencias, qualidade do diagnostico, confianca, pegadinhas, recorrencia e outros criterios existentes no modulo de revisao.

Quando disponivel, o caminho "Iniciar fila nos flashcards" treina essa fila priorizada em formato de cards. Apesar do nome historico, esse fluxo nao e o modulo real de Flashcards/SM-2. Ele continua sendo revisao de questoes.

## Treinar lista filtrada

O botao antigo "Flashcards" da Revisao foi renomeado para "Treinar lista filtrada".

Esse caminho usa `buscarQuestoesRevisao()` e respeita os filtros atuais da tela, como semana, materia e filtro de itens para revisar hoje.

Por isso, ele pode mostrar lista vazia mesmo quando a fila inteligente possui itens priorizados. Isso nao indica erro necessariamente: significa que a lista filtrada atual nao tem questoes pendentes para treino.

Esse fluxo tambem nao deve ser confundido com o modulo real de Flashcards.

## Modulo real Flashcards/SM-2

O modulo real de Flashcards fica na secao Flashcards.

Ele usa as tabelas `flashcards` e `flashcard_reviews`, alem do algoritmo SM-2. Seus campos principais incluem:

- `due_date`;
- `ease_factor`;
- `repetitions`;
- `interval_days`;
- `estado`.

Esse modulo e separado da Revisao de questoes. Mudancas em Flashcards/SM-2 devem ser analisadas no proprio fluxo de Flashcards.

## Regras para futuras IAs e desenvolvedores

Nao unificar fila inteligente, treino filtrado e Flashcards/SM-2 sem diagnostico proprio.

Nao alterar logica de revisao apenas porque os nomes parecem parecidos.

Nao fazer o botao "Treinar lista filtrada" usar a fila inteligente sem plano explicito e testes.

Nao misturar tabelas `questoes` e `flashcards` sem entender o fluxo de cada modulo.

## Mudanca recente

O botao "Flashcards" da Revisao foi renomeado para "Treinar lista filtrada".

A mensagem vazia foi alterada para explicar que a ausencia se refere aos filtros atuais e que a fila inteligente pode ter itens priorizados do ciclo.

Essa mudanca foi apenas textual. A logica da Revisao, os filtros, a fila inteligente e o modulo real de Flashcards/SM-2 nao foram alterados.

## Comandos obrigatorios

Antes e depois de qualquer mudanca na Revisao, rode:

```powershell
npm.cmd run check:js
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

## Testes relacionados

`tests/revisao.test.js` protege textos e comportamentos da secao Revisao.

`tests/flashcards.test.js` protege o modulo real de Flashcards.

Mantenha o CI verde antes de considerar qualquer alteracao concluida.
