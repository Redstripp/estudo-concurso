# Pontuacao configuravel de simulados

Este modulo separa a pontuacao de simulados do scheduler de revisao. Um simulado avaliativo calcula nota e criterio de aprovacao; ele nao altera states, events, dias de revisao ou regras SM-2. Fluxos explicitamente de revisao continuam usando a integracao SM-2 ja publicada.

## Perfil de pontuacao

Um perfil descreve a regra de edital usada para corrigir uma prova. Ele possui nome, descricao, status ativo, versao, modo de calculo, valores por resposta, anuladas, pesos, blocos, criterios minimos, eliminacoes, arredondamento e metadados.

O perfil padrao interno e `legacy_simple`. Ele replica o comportamento historico:

- correta: `+1`;
- errada: `0`;
- branco: `0`;
- percentual: `certas / total`.

`legacy_simple` e um perfil virtual no codigo, nao uma linha obrigatoria no banco. Isso evita duas fontes de verdade concorrentes. Simulados antigos continuam sendo exibidos com esse perfil virtual sem regravar dados historicos e sem fabricar snapshot retroativo.

## Hierarquia

A hierarquia escolhida e:

1. Perfil de sistema: somente leitura, para regras padrao como `legacy_simple`.
2. Perfil do usuario: criado e versionado pelo usuario autenticado.
3. Snapshot do simulado: copia imutavel da versao usada quando o simulado foi salvo.

Em uma evolucao futura, um concurso ou edital pode apontar para um perfil do usuario ou de sistema. Na tela atual de registro agregado, a regra fica fixada no momento do salvamento. Em uma tentativa iniciada questao a questao, o ponto correto de fixacao e o inicio da tentativa. O simulado sempre salva o snapshot final, entao mudancas posteriores no perfil nao alteram notas antigas.

## Modos

- `simple`: soma valores basicos. Exemplo: correta `+1`, errada `0`, branco `0`.
- `negative_marking`: permite penalidade configuravel por erro, como `-1`, `-0.5` ou `-0.25`.
- `weighted`: aplica pesos por questao, disciplina, bloco ou tipo.
- `hybrid`: combina pesos e penalidades.

Nenhuma banca e codificada como regra interna. Cebraspe, FGV ou qualquer edital devem ser representados por configuracao de perfil.

## Brancos e anuladas

Cada questao pode terminar como correta, errada, em branco, anulada ou sem gabarito valido.

Para anuladas, o perfil escolhe uma regra explicita:

- creditar acerto a todos;
- excluir a questao do denominador;
- atribuir zero;
- usar valor especifico.

Questao sem gabarito valido nao entra no denominador para evitar que o sistema invente uma regra.

## Pesos e blocos

A precedencia de pesos e:

`questao > disciplina > bloco > tipo > padrao do perfil`

Blocos representam partes da prova, como conhecimentos basicos e especificos. O resultado calcula questoes, nota, nota maxima e percentual por bloco.

Pesos negativos sao rejeitados. Peso zero e permitido para cenarios em que uma questao ou bloco deve permanecer contabilizado, mas sem impacto de nota.

## Minimos e eliminacao

O perfil pode definir:

- nota minima total;
- percentual minimo total;
- minimo de acertos;
- maximo de erros;
- nota ou percentual minimo por bloco;
- eliminacao por nota negativa;
- eliminacao por limites especificos.

O resultado diferencia nota calculada, reprovacao por criterio e eliminacao. Nota baixa nao e erro tecnico.

## Arredondamento

O calculo usa precisao completa por padrao e arredonda no final. O perfil pode configurar:

- sem alteracao;
- arredondamento matematico;
- truncamento;
- arredondamento para cima;
- casas decimais.

## Snapshot

Ao salvar um simulado com o schema novo, a aplicacao persiste:

- perfil e versao;
- regras completas;
- pesos e blocos;
- valores por resposta;
- nota bruta e final;
- nota maxima;
- percentual;
- status;
- criterios avaliados;
- motivo de eliminacao, se houver;
- detalhes por questao calculada.

Esse snapshot e suficiente para reproduzir a nota mesmo que o perfil seja editado depois.

## Persistencia remota

A migration local `20260720131000_add_configurable_exam_scoring.sql` cria:

- `scoring_profiles`;
- `scoring_profile_versions`;
- `scoring_profile_blocks`;
- colunas de snapshot e resultado em `simulados`.

A migration e aditiva, nao regrava simulados antigos, habilita RLS e isola dados por `auth.uid()`. Ela tambem trava a versao do perfil quando um simulado a referencia e impede edicao, exclusao ou alteracao de blocos em versoes usadas. Essa protecao existe no banco; a interface de criar nova versao e apenas a camada visual.

Perfis locais ou virtuais que nao possuem UUID de banco sao preservados somente no snapshot. Nesse caso, `scoring_profile_id` fica nulo e a reproducibilidade vem do snapshot salvo.

O CRUD remoto local usa uma camada central em `js/scoring-profile-service.js`. Ela lista perfis, carrega versoes completas, cria, duplica, versiona, salva blocos, ativa/desativa e classifica erros de autenticacao, RLS, validacao, rede, imutabilidade e migration ausente.

## RPCs transacionais

Operacoes que exigem mais de uma escrita nao devem ser feitas por inserts soltos no cliente. A migration local `20260720143000_add_scoring_profile_crud_rpcs.sql` adiciona RPCs transacionais para:

- criar perfil com primeira versao e blocos;
- salvar a versao atual quando ainda nao foi usada;
- duplicar perfil acessivel sem copiar IDs;
- criar nova versao e promover `current_version`;
- substituir blocos de versao desbloqueada.

As RPCs usam `auth.uid()`, nao recebem `user_id` editavel da interface, possuem `search_path` seguro, validam ownership e retornam os IDs necessarios para recarregar a versao completa. Essa migration e local nesta etapa; nao afirmar que o CRUD remoto esta publicado antes dela entrar no banco remoto.

Cada RPC mutavel recebe um `operation_id` gerado no cliente. A tabela interna `scoring_profile_operations` guarda o tipo, hash do payload e resultado confirmado. Repetir a mesma operacao com o mesmo payload retorna o mesmo resultado sem criar novas linhas; repetir o mesmo `operation_id` com dados diferentes falha com conflito de idempotencia. O cliente mantem o `operation_id` pendente no armazenamento local da sessao ate recarregar a versao remota com sucesso, para cobrir timeout/retry sem duplicar perfil, versao ou blocos.

## Privilegios das funcoes

As funcoes do CRUD se dividem em tres grupos:

- RPC publica autenticada: entrada do frontend, com `EXECUTE` somente para `authenticated`;
- helper interno: usado apenas por RPCs `security definer`, sem `EXECUTE` para `PUBLIC`, `anon`, `authenticated` ou `service_role`;
- administrativa/trigger: chamada pelo banco, tambem sem chamada direta por roles de API.

A migration `20260720153100_harden_scoring_crud_function_privileges.sql` e obrigatoria depois da migration das RPCs. Ela revoga explicitamente, por assinatura completa, qualquer `PUBLIC EXECUTE` ou grant herdado para roles da API nos helpers internos e nas funcoes de trigger, e concede novamente apenas as RPCs publicas para `authenticated`. A feature nao altera `DEFAULT PRIVILEGES` globalmente porque isso poderia afetar funcoes fora do escopo de pontuacao; o hardening fica restrito as funcoes desta entrega.

Valide os privilegios finais por duas vias: SQL com `SET ROLE` e chamadas PostgREST/RPC. Helpers internos devem falhar para cliente anonimo e autenticado quando chamados diretamente, mas continuar funcionando quando invocados pelas RPCs publicas.

## Ordem de implantacao

A ordem segura de publicacao e:

1. aplicar `20260720131000_add_configurable_exam_scoring.sql`;
2. validar schema, triggers e RLS;
3. aplicar `20260720143000_add_scoring_profile_crud_rpcs.sql`;
4. aplicar `20260720153100_harden_scoring_crud_function_privileges.sql`;
5. validar RPCs, helpers bloqueados, RLS e idempotencia com usuario A, usuario B, anonimo e perfil de sistema;
6. publicar o frontend.

O frontend nao deve ser publicado antes das migrations necessarias. Se as RPCs ainda nao existirem, a interface mostra erro de migration pendente e nao registra sucesso local. O fallback legado de simulado existe apenas para cache de schema ou rollback operacional, quando o erro comprova ausencia das novas colunas/tabelas.

Na validacao local, use Auth e PostgREST reais do Supabase local com usuarios sinteticos. A matriz minima cobre: anonimo sem leitura/criacao de perfil de usuario; usuario B sem leitura, duplicacao, versao ou vinculo de simulado ao perfil do usuario A; usuario A podendo ativar/desativar seu perfil; retry idempotente de criar, duplicar e versionar; conflito quando o mesmo `operation_id` reaparece com payload diferente; e bloqueio de edicao apos um simulado usar a versao.

## Interface

Na tela de Simulados, o usuario escolhe um perfil ao registrar a prova. O painel permite ajustar valores de correta, errada e branco, regra de anulada, arredondamento, minimos e blocos por campos visuais. O usuario nao precisa editar JSON manualmente.

Quando autenticado, a fonte oficial dos perfis e remota. A lista inclui `legacy_simple` virtual, perfis de sistema disponiveis, perfis proprios ativos e inativos, versao atual e blocos relacionados. Perfis inativos ficam visiveis para gestao, mas nao podem finalizar simulado enquanto continuarem inativos.

A interface mostra carregamento, origem do perfil, status ativo/inativo e avisos de versao usada. Sucesso so aparece depois da persistencia remota. Erros de RLS, autenticacao, constraint, timeout, rede, 5xx ou erro desconhecido nao fazem fallback silencioso.

## Criacao, duplicacao e versionamento

Salvar a partir de `legacy_simple`, perfil de sistema ou perfil local cria uma copia remota do usuario. Salvar perfil proprio remoto atualiza a versao corrente apenas quando ela ainda nao foi usada em simulado.

Duplicar cria um novo perfil do usuario, copia a versao escolhida e seus blocos, inicia em versao `1` e nao copia IDs nem vinculos historicos do original. O nome pode ser alterado na interface antes de salvar novas mudancas.

Quando uma versao ja foi usada, alteracoes de regras e blocos exigem nova versao. A operacao cria a nova linha em `scoring_profile_versions`, copia/salva a configuracao informada, grava blocos em transacao e so entao promove `current_version`. Versoes anteriores continuam legiveis para historico.

## Ativacao e blocos

Perfis proprios remotos podem ser ativados ou desativados. Perfis de sistema e perfis locais nao podem ser ativados/desativados pela interface. Desativar nao exclui historico e nao remove a referencia de simulados antigos.

Blocos pertencem a uma versao especifica. Eles possuem chave, nome, peso, minimo de nota e minimo percentual. Chaves duplicadas, pesos negativos e percentuais fora de `0..100` sao rejeitados. Blocos de versao usada nao podem ser alterados.

## Perfis locais antigos

Perfis criados antes do CRUD remoto continuam no `localStorage` como locais, marcados na lista. Eles nao sao importados automaticamente. O usuario precisa acionar `Salvar na conta`; a importacao valida o perfil, cria uma nova copia remota e preserva o original local ate o sucesso.

Se um perfil local tiver um texto parecido com UUID, ele ainda nao gera `scoring_profile_id`. Perfis locais e `legacy_simple` salvam snapshot completo e deixam `scoring_profile_id` nulo.

## Retrocompatibilidade e metricas

Simulados antigos podem ter comentario nulo, campos novos nulos ou `certas + erradas < total`. Eles continuam abrindo pelo caminho legado. Se `total_questoes` for zero em dado sintetico ou incompleto, o percentual legado fica em zero para evitar divisao por zero.

Dashboard e estatisticas continuam usando `nota_percentual` para comparacoes historicas. A nota final configuravel aparece no card de simulado e no snapshot; ela nao substitui medias existentes sem uma regra especifica de migracao.

## RLS e seguranca

Perfis de usuario pertencem ao usuario autenticado. Perfis de sistema sao somente leitura. Versions e blocks consultam a propriedade do perfil pai e nao aceitam troca de ownership por IDs enviados pelo cliente. As regras foram desenhadas para depender da sessao/RLS, nao de campo editavel no DOM.

O cliente recarrega a versao remota antes de salvar um simulado. Se o perfil ficar inacessivel ou inativo entre a selecao e a finalizacao, o salvamento e bloqueado com mensagem explicita. A interface nao troca silenciosamente para outro perfil e nao faz fallback silencioso para `legacy_simple`.

## Historico

Ao abrir um simulado salvo, o snapshot e a fonte principal. Nome, versao, status, nota final, nota maxima, breakdown e criterios saem do snapshot/campos salvos, nao da configuracao atual do perfil. Perfil remoto excluido, inativo ou alterado depois nao muda o historico.

## Limitacoes conhecidas

- a tela atual registra simulado agregado; ela ainda nao possui tentativa persistida em andamento por questao;
- nesse fluxo agregado, o perfil e fixado imediatamente antes do salvamento; em uma tentativa futura por questao, o ponto correto de fixacao sera o inicio da tentativa;
- CRUD remoto completo de perfis depende das migrations publicadas na ordem descrita;
- vulnerabilidades preexistentes do `npm audit` nao sao tratadas por esta funcionalidade;
- esta pontuacao permanece separada do SM-2, gamificacao e reset de progresso.
