# Revisao Inteligente `sm2_v1`

Este documento descreve a Melhoria 1: repeticao espacada individualizada por questao na Revisao Inteligente.

## Escopo

O `sm2_v1` vale para questoes da tabela `questoes`. Ele nao altera o modulo real de Flashcards, que continua usando `flashcards` e `flashcard_reviews`.

Acertos registrados apenas em `questoes_certas` continuam agregados por quantidade. Eles nao criam estado individual porque nao ha enunciado, alternativa ou `questao_id` por item. Para uma questao correta entrar na agenda individual, ela precisa existir como linha em `questoes` (por exemplo, uma questao chutada/baixa confianca com alternativa correta marcada).

Nao foram implementados nesta etapa:

- discursiva ou redacao;
- pontuacao real de banca;
- alteracoes em Planejamento, Edital, Simulados, Dashboard ou fluxo de salvar questoes fora do scheduler.

## Schema

Migration: `supabase/migrations/20260717113000_add_question_sm2_scheduler.sql`.

Bootstrap de ativacao: `supabase/migrations/20260719211000_bootstrap_sm2_states_on_activation.sql`.

Campos adicionados a `configuracoes_revisao`:

- `review_scheduler_mode`: `legacy` ou `sm2_v1`; o default da migration e `legacy` para evitar ativacao global automatica;
- `review_timezone`: fuso usado para calcular o dia local; o default inicial e `America/Recife`;
- `review_max_interval_days`: teto conservador do intervalo.

Campos adicionados a `questoes_revisoes`:

- `scheduler_algorithm`;
- `review_grade`;
- `source_attempt_id`;
- `response_time_ms`.

Tabelas novas:

- `questao_review_states`: uma linha por `user_id + questao_id`, com estado atual do aprendizado;
- `questao_review_events`: eventos imutaveis de revisao, sem copiar o conteudo completo da questao.

## RLS e isolamento

As tabelas novas usam RLS. As policies usam `auth.uid() = user_id` e validam que `questao_id` pertence ao usuario autenticado.

`questao_review_events` e historico imutavel para o usuario comum. O cliente autenticado pode ler seus eventos, mas nao recebe permissao direta para inserir, atualizar ou excluir linhas nessa tabela. Eventos novos devem ser gravados pela RPC `registrar_revisao_questao_sm2`, que roda como `security definer`.

A RPC `registrar_revisao_questao_sm2` tambem deriva o usuario de `auth.uid()` e nao aceita `user_id` enviado pelo frontend.

## RPC transacional

`registrar_revisao_questao_sm2` executa em uma transacao PostgreSQL:

1. valida usuario autenticado;
2. valida questao do usuario;
3. verifica idempotencia por `source_attempt_id`;
4. cria estado ausente, se necessario;
5. bloqueia o estado com `for update`;
6. calcula SM-2;
7. insere evento;
8. atualiza estado;
9. atualiza historico legado para compatibilidade.

Se a mesma tentativa for enviada novamente para a mesma questao, a RPC retorna o evento/estado existente e nao avanca o intervalo duas vezes.

Se o mesmo `source_attempt_id` for reaproveitado para outra questao do mesmo usuario, a RPC gera o erro `source_attempt_id_conflita_com_outra_questao`. Esse caso nao deve ser tratado como sucesso e nao deve registrar a segunda questao. A funcao tambem usa um advisory lock transacional por usuario+tentativa para serializar chamadas simultaneas com o mesmo identificador.

## Algoritmo

O scheduler puro fica em `js/questoes-sm2.js`.

Contrato conceitual:

```javascript
scheduleQuestionReview(currentState, reviewInput, reviewedAt, options)
```

Caracteristicas:

- funcao pura;
- sem DOM, banco, relogio global ou aleatoriedade;
- notas 0 a 5;
- `algorithm_version = sm2_v1`;
- fator minimo `1.3`;
- teto configuravel, padrao `365` dias;
- datas persistidas como instantes ISO/timestamptz.

Mapeamento padrao:

- erro: 1;
- acerto dificil: 3;
- acerto bom: 4;
- acerto facil: 5.

## Dias de estudo e fuso

`review_timezone` define o dia local do usuario. O fallback e `America/Recife`, alinhado ao uso atual em Pernambuco. Esse fuso e usado para calcular inicio/fim do dia e exibicao de agenda; os instantes persistidos continuam em UTC/timestamptz.

O campo fica em `configuracoes_revisao`, portanto pode ser diferente por usuario no futuro. Trocar o fuso de um usuario deve alterar apenas a interpretacao da janela do dia; nao deve reescrever historico.

Os dias em `dias_revisao` continuam funcionando como porta de entrada para iniciar sessao. Eles nao alteram `next_review_at`. Uma questao vencida em dia sem estudo permanece atrasada e aparece no proximo dia permitido.

## Fila

No modo `sm2_v1`, a fila usa `questao_review_states` como fonte da verdade.

Filtro principal:

```text
user_id = usuario atual
next_review_at <= instante atual
```

Os dias escolhidos nao reescrevem `next_review_at`. Eles calculam a proxima sessao permitida em ou depois do vencimento tecnico. Se o SM-2 vencer na terca e `dias_revisao = [3,6]`, o vencimento tecnico permanece terca e a sessao permitida passa a ser quarta. Se o usuario faltar na quarta, a mesma pendencia continua atrasada e a proxima oportunidade passa a ser sabado.

Ordenacao deterministica:

1. vencimento mais antigo;
2. mais lapsos;
3. menor facilidade;
4. menor sequencia de acertos;
5. revisada ha mais tempo;
6. `questao_id`.

O frontend mostra atrasadas, vencem hoje, proximas, sem agenda, limite da sessao e pendencias alem do limite.

## Simulados e SM-2

Simulados normais ou avaliativos nao registram revisao individual. Eles salvam desempenho agregado em `simulados` e nao devem criar event, alterar state ou reagendar questao.

O Simulado de revisao conta como fluxo de revisao. Em `legacy`, ele mantem o comportamento historico com `questoes`, `questoes_revisoes` e ciclo 24h/7d/30d. Em `sm2_v1`, ele lista por `questao_review_states`, filtra apenas states vencidos do usuario atual e respeita `dias_revisao`.

Ao responder no Simulado de revisao em `sm2_v1`, o frontend reconsulta o state antes de escrever. Se o state ja ficou futuro por causa de outra aba ou outro fluxo, a resposta e bloqueada sem RPC e sem qualquer update. Se ainda estiver elegivel, o frontend chama `registrar_revisao_questao_sm2` com `source_attempt_id`; idempotencia e atualizacao de state ficam centralizadas na RPC.

O diagnostico do Simulados salva apenas campos auxiliares. Em `sm2_v1`, ele pode complementar uma linha de compatibilidade existente em `questoes_revisoes` somente quando ela pertence a mesma tentativa (`source_attempt_id`) e tem `scheduler_algorithm = sm2_v1`. Ele nao cria linha plain, nao cria event, nao altera `next_review_at` e nao incrementa `total_reviews`.

## Feature flag

`configuracoes_revisao.review_scheduler_mode` controla o caminho:

- `legacy`: fila antiga por `questoes` e `questoes_revisoes`;
- `sm2_v1`: fila individual por `questao_review_states`.

O frontend preserva o caminho legado como retorno temporario.

Ordem segura de implantacao:

1. aplicar a migration;
2. validar schema, RLS, grants, RPC, backfill e bootstrap de ativacao;
3. ativar `sm2_v1` para um usuario controlado;
4. monitorar revisoes, eventos e estados;
5. ampliar a ativacao gradualmente.

Antes da migration, se uma configuracao local tentar usar `sm2_v1` e a estrutura ainda nao existir, o frontend volta para a fila legada em vez de consultar tabelas inexistentes indefinidamente.

## Bootstrap na ativacao

A transicao individual de `review_scheduler_mode` para `sm2_v1` dispara uma trigger em `public.configuracoes_revisao`. A trigger cria, na mesma transacao da ativacao, estados ausentes para questoes pendentes daquele usuario. Ela usa apenas `NEW.user_id`, nao recebe UUID do cliente e nao cria eventos.

O bootstrap e idempotente: `questao_review_states` continua tendo uma linha unica por `user_id + questao_id`, e a insercao usa `on conflict do nothing`. Se a questao ja tiver state, ele nao e sobrescrito. Se a ativacao falhar durante o bootstrap, a transacao inteira falha e o modo nao deve permanecer em `sm2_v1`.

Somente questoes com `status_revisao = 'pendente'` recebem state. Questao `recuperada` fica fora porque nao participa da fila pendente. Como o schema atual nao possui estados de arquivamento, remocao logica ou cancelamento em `questoes`, nao ha outras categorias elegiveis.

A data inicial do state respeita dados legados nesta ordem:

1. `questoes_revisoes.revisar_novamente_em` da ultima revisao legada da questao, quando existir;
2. `questoes.revisar_novamente_em`;
3. `questoes.criado_em::date`.

Os dias em `dias_revisao` nao reescrevem `next_review_at`; eles continuam controlando quando a sessao pode ser iniciada. Assim, uma questao vencida em dia nao permitido permanece atrasada e aparece no proximo dia permitido.

Voltar para `legacy` preserva states e events. Reativar depois nao duplica states existentes. Questoes criadas quando o usuario ja esta em `sm2_v1` continuam passando pela RPC do frontend, que cria ou reutiliza o state de forma idempotente.

## Backfill

A migration cria estados para questoes pendentes existentes e eventos a partir de `questoes_revisoes`, sempre com `state_origin` ou `event_origin = 'migrated'`.

O backfill e conservador:

- nao apaga dados legados;
- nao substitui estados mais recentes por causa de `on conflict do nothing`;
- nao inventa dominio pleno;
- usa a ultima resposta conhecida quando disponivel;
- mantem `next_review_at` em data vencida quando `questoes.revisar_novamente_em` ja estava no passado, para que a questao pendente apareca na fila assim que `sm2_v1` for ativado;
- usa `current_date` quando a questao pendente nao tem `revisar_novamente_em`, evitando data historica causada apenas por campo nulo;
- deixa a feature flag em `legacy` ate ativacao posterior.

Exemplo: se uma questao pendente tinha `revisar_novamente_em = 2026-05-19`, o backfill gera `next_review_at = 2026-05-19 00:00:00+00`. Em um ensaio feito em 2026-07-17, isso significa que a questao ja estava vencida no legado e continuara vencida no SM-2. Isso e intencional: ativar o scheduler nao deve esconder pendencias antigas.

## Metricas

RPC: `obter_metricas_revisao_sm2(p_days integer default 60)`.

Ela retorna:

- taxa de acerto agendada;
- acerto por faixa de intervalo;
- itens `sm2_v1`;
- itens vencidos;
- media de lapsos;
- tamanho da amostra;
- mensagem quando ainda nao ha dados suficientes.

## Rollback logico

Para retornar temporariamente ao modo antigo, alterar apenas a feature flag do usuario:

```sql
update public.configuracoes_revisao
set review_scheduler_mode = 'legacy'
where user_id = '<USER_ID>';
```

Nao apague `questao_review_states` nem `questao_review_events` em rollback operacional. O historico pode ser usado para auditoria ou retomada posterior.

## Comandos de validacao

```powershell
npm.cmd run check:js
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:dist
```

Teste especifico:

```powershell
npm.cmd test -- tests/questoes-sm2.test.js tests/questoes-sm2-migration.test.js tests/questoes-sm2-activation-bootstrap.test.js tests/revisao.test.js tests/sm2.test.js
```
