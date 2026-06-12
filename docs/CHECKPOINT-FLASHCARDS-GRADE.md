# Checkpoint Flashcards com Grade

Checkpoint documental da funcionalidade de Flashcards apos o PR #109.

## Estado atual dos Flashcards

- Algoritmo SM-2 implementado.
- Banco Supabase criado, aplicado e validado.
- RLS e grants seguros.
- Camada de dados criada.
- Tela Flashcards criada.
- Adicionar Card funcionando.
- Todos os Cards funcionando.
- Editar/desativar cards funcionando.
- Busca e filtros funcionando.
- Filtro por materia funcionando.
- Revisar Hoje funcionando.
- Revisao Urgente funcionando.
- Estudo do Dia usando planejamento_semanal como sugestao.
- Estatisticas basicas funcionando.
- Alerta de cards vencidos ha mais de 2 dias funcionando.
- Integracao com Caderno de Erros funcionando.
- Geracao de prompt de flashcards funcionando.
- Interpretacao da resposta da IA funcionando.
- Previa editavel funcionando.
- Adicionar cards validos ao deck funcionando.

## Regra principal preservada

- O SM-2 nunca e bloqueado pela grade ou pelo planejamento.
- Cards com due_date <= hoje aparecem sempre na Revisao Urgente.
- Estudo do Dia apenas sugere cards novos de materias planejadas.

## Fluxo completo validado

Caderno de Erros -> IA -> previa editavel -> adicionar ao deck -> revisar pelo SM-2 -> estatisticas -> alerta de acumulo.

## Campos ricos dos flashcards

- Diagnostico concluido para `contexto`, `reconhecer` e `alerta_banca`.
- Esses campos nao sao colunas proprias da tabela `flashcards`.
- O contrato atual armazena os campos ricos dentro de `flashcards.verso`, em formato estruturado com rotulos.
- Prompt, parser, previa, salvamento, listagem e revisao ja reconhecem esse formato estruturado.
- Nao sera feita migration agora.
- Melhoria futura opcional: adicionar campos separados no formulario manual que apenas montem o mesmo `verso` estruturado, sem alterar schema.

## Ultimos PRs relevantes

- #93 SM-2.
- #94 Banco.
- #95 Camada de dados.
- #96 Tela.
- #97 Adicionar Card.
- #98 Revisar Hoje.
- #99 Estatisticas.
- #100 Prompt/preview IA.
- #101 Preview editavel.
- #102 Adicionar ao deck.
- #104 Gerenciar cards salvos.
- #105 Filtros e busca.
- #106 Associacao com materias.
- #107 Revisao Urgente / Estudo do Dia.
- #108 Estudo do Dia com planejamento.
- #109 Alerta de acumulo.

## O que ainda nao foi feito

- Limite diario de cards novos no Estudo do Dia.
- Configuracao propria de grade dos flashcards.
- Funcionalidade administrativa futura para redistribuir revisoes acumuladas de flashcards.
- Associacao direta com questao original no banco.
- Dashboard global dos flashcards.
- Graficos avancados.
- Geracao direta por API de IA.
- Restauracao de cards desativados.

## Backlog administrativo: redistribuir revisoes de flashcards

- Objetivo: permitir que um admin redistribua cards acumulados de um usuario sem mexer no SM-2.
- A tela futura deve permitir escolher usuario alvo, data limite dos cards acumulados, data inicial da redistribuicao, quantidade de cards por dia e se considera apenas cards ativos.
- A acao deve ter previa obrigatoria antes de aplicar e confirmacao explicita antes de qualquer update real.
- A redistribuicao deve alterar somente `flashcards.due_date`.
- Nao alterar `ease_factor`, `interval_days`, `repetitions`, `last_reviewed_at`, historico ou estatisticas.
- Recomendado registrar auditoria administrativa com admin executor, usuario alvo, parametros, total afetado e horario.
