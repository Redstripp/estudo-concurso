# Revisao e filas

Este documento registra o funcionamento atual da secao Revisao e evita confusao entre fluxos parecidos:

- fila inteligente;
- treino da lista filtrada em formato de cards;
- scheduler individualizado de questoes (`sm2_v1`);
- modulo real de Flashcards/SM-2.

## Objetivo da secao Revisao

A secao Revisao existe para revisar questoes erradas ou pendentes, priorizar o estudo do ciclo e permitir treino sem mostrar o gabarito imediatamente.

Ela trabalha principalmente com questoes do Caderno de Erros e com a fila inteligente da revisao. Quando a interface usa formato de cards, isso significa apenas uma forma de apresentar questoes para treino.

## Fila inteligente de questoes

A fila inteligente usa `filaRevisaoInteligenteAtual`.

No modo legado, ela prioriza questoes do ciclo e pode considerar sinais como pendencias, qualidade do diagnostico, confianca, pegadinhas, recorrencia e outros criterios existentes no modulo de revisao.

No modo `sm2_v1`, a fila passa a vir de `questao_review_states`. A consulta filtra no banco por `user_id` e por `next_review_at <= fim do dia atual no fuso do usuario`, respeitando os dias de revisao configurados como porta de entrada da sessao. O fuso padrao inicial e `America/Recife`, mas ele fica em `configuracoes_revisao.review_timezone` para permitir configuracao por usuario.

Quando disponivel, o caminho "Iniciar fila nos flashcards" treina essa fila priorizada em formato de cards. Apesar do nome historico, esse fluxo continua sendo revisao de questoes; ele nao usa as tabelas `flashcards` e `flashcard_reviews`.

## Treinar lista filtrada

O botao antigo "Flashcards" da Revisao foi renomeado para "Treinar lista filtrada".

No modo legado, esse caminho usa `buscarQuestoesRevisao()` e respeita os filtros atuais da tela, como semana, materia e filtro de itens para revisar hoje.

Por isso, ele pode mostrar lista vazia mesmo quando a fila inteligente possui itens priorizados. Isso nao indica erro necessariamente: significa que a lista filtrada atual nao tem questoes pendentes para treino.

No modo `sm2_v1`, o botao deixa de montar uma segunda fila legada e inicia a fila individualizada de questoes vencidas. Essa decisao evita duplicacao entre `questoes` antigas e `questao_review_states`.

## Scheduler individualizado de questoes (`sm2_v1`)

O scheduler de questoes usa:

- `questao_review_states`: estado atual por `user_id + questao_id`;
- `questao_review_events`: historico imutavel de eventos, lido diretamente quando necessario e escrito somente pela RPC;
- `questoes_revisoes`: historico legado ampliado para auditoria;
- RPC `registrar_revisao_questao_sm2`: registra evento e atualiza estado de forma atomica.

O algoritmo puro fica em `js/questoes-sm2.js` e segue SM-2 classico com notas 0 a 5. Acertos recebem notas 3, 4 ou 5 quando o usuario escolhe Dificil, Bom ou Facil. Erros sempre ficam abaixo de 3.

Os dias de revisao continuam em `configuracoes_revisao.dias_revisao`. Eles nao mudam `next_review_at`; apenas definem quando a sessao pode ser iniciada. Itens vencidos em dia sem estudo continuam atrasados.

Cada tentativa real de revisao usa um `source_attempt_id`. Reenviar a mesma tentativa para a mesma questao e idempotente; reaproveitar a tentativa em outra questao e erro de conflito e nao deve avancar a segunda questao.

## Modulo real Flashcards/SM-2

O modulo real de Flashcards fica na secao Flashcards.

Ele usa as tabelas `flashcards` e `flashcard_reviews`, alem do algoritmo SM-2. Seus campos principais incluem:

- `due_date`;
- `ease_factor`;
- `repetitions`;
- `interval_days`;
- `estado`.

Esse modulo continua separado da Revisao de questoes. Mudancas em Flashcards/SM-2 devem ser analisadas no proprio fluxo de Flashcards.

## Regras para futuras IAs e desenvolvedores

Nao unificar fila inteligente, treino filtrado e Flashcards/SM-2 sem diagnostico proprio.

Nao alterar logica de revisao apenas porque os nomes parecem parecidos.

Nao misturar a fila `sm2_v1` de questoes com as tabelas reais de Flashcards. Os dois fluxos usam ideias de repeticao espacada, mas os dados e telas sao diferentes.

Nao misturar tabelas `questoes` e `flashcards` sem entender o fluxo de cada modulo.

## Mudanca recente

O botao "Flashcards" da Revisao foi renomeado para "Treinar lista filtrada".

A mensagem vazia foi alterada para explicar que a ausencia se refere aos filtros atuais e que a fila inteligente pode ter itens priorizados do ciclo.

Depois, a Revisao de questoes recebeu o scheduler `sm2_v1`. Essa mudanca altera a fila somente quando `configuracoes_revisao.review_scheduler_mode = 'sm2_v1'`; o modo `legacy` permanece como caminho de retorno e e o padrao seguro da migration inicial.

## Comandos obrigatorios

Antes e depois de qualquer mudanca na Revisao, rode:

```powershell
npm.cmd run check:js
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:dist
```

## Testes relacionados

`tests/revisao.test.js` protege textos e comportamentos da secao Revisao.

`tests/flashcards.test.js` protege o modulo real de Flashcards.

Mantenha o CI verde antes de considerar qualquer alteracao concluida.
