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

## Persistencia planejada

A migration local `20260720131000_add_configurable_exam_scoring.sql` cria:

- `scoring_profiles`;
- `scoring_profile_versions`;
- `scoring_profile_blocks`;
- colunas de snapshot e resultado em `simulados`.

A migration e aditiva, nao regrava simulados antigos, habilita RLS e isola dados por `auth.uid()`. Ela tambem trava a versao do perfil quando um simulado a referencia e impede edicao, exclusao ou alteracao de blocos em versoes usadas. Essa protecao existe no banco; a interface de criar nova versao e apenas a camada visual.

Perfis locais ou virtuais que nao possuem UUID de banco sao preservados somente no snapshot. Nesse caso, `scoring_profile_id` fica nulo e a reproducibilidade vem do snapshot salvo.

## Ordem de implantacao

A ordem segura de publicacao e:

1. aplicar a migration no banco remoto;
2. validar schema, triggers e RLS;
3. publicar o frontend.

O frontend nao deve ser publicado antes da migration. O fallback legado existe apenas para cache de schema ou rollback operacional, quando o erro comprova ausencia das novas colunas/tabelas.

## Interface

Na tela de Simulados, o usuario escolhe um perfil ao registrar a prova. O painel permite ajustar valores de correta, errada e branco, regra de anulada, arredondamento, minimos e blocos por campos visuais. O usuario nao precisa editar JSON manualmente.

Enquanto a migration local nao estiver aplicada, os perfis personalizados ficam em `localStorage`. A interface nao afirma que salvou perfil remoto. Ao salvar simulado, o payload legado so e usado quando o banco indica coluna/tabela nova inexistente ou cache de schema desatualizado. Erros de RLS, autenticacao, constraint, timeout, rede, 5xx ou erro desconhecido nao fazem fallback silencioso.

## Retrocompatibilidade e metricas

Simulados antigos podem ter comentario nulo, campos novos nulos ou `certas + erradas < total`. Eles continuam abrindo pelo caminho legado. Se `total_questoes` for zero em dado sintetico ou incompleto, o percentual legado fica em zero para evitar divisao por zero.

Dashboard e estatisticas continuam usando `nota_percentual` para comparacoes historicas. A nota final configuravel aparece no card de simulado e no snapshot; ela nao substitui medias existentes sem uma regra especifica de migracao.

## RLS e seguranca

Perfis de usuario pertencem ao usuario autenticado. Perfis de sistema sao somente leitura. Versions e blocks consultam a propriedade do perfil pai e nao aceitam troca de ownership por IDs enviados pelo cliente. As regras foram desenhadas para depender da sessao/RLS, nao de campo editavel no DOM.

## Limitacoes conhecidas

- a tela atual registra simulado agregado; ela ainda nao possui tentativa persistida em andamento por questao;
- CRUD remoto completo de perfis depende da migration publicada;
- vulnerabilidades preexistentes do `npm audit` nao sao tratadas por esta funcionalidade;
- esta pontuacao permanece separada do SM-2, gamificacao e reset de progresso.
