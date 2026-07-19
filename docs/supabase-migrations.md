# Fluxo oficial de migrations Supabase

Este projeto passou a usar Supabase CLI local para controlar migrations. O banco
remoto de desenvolvimento ja tinha sido alterado por SQLs manuais; por isso o
historico oficial comeca com um baseline que representa esse estado existente.

## Estado atual

- Baseline aplicado em desenvolvimento: `supabase/migrations/20260717112500_remote_schema_baseline.sql`.
- SM-2 aplicado em desenvolvimento: `supabase/migrations/20260717113000_add_question_sm2_scheduler.sql`.
- Hardening aplicado em desenvolvimento: `supabase/migrations/20260717212105_harden_criar_perfil_automatico.sql`.
- O scheduler individualizado continua desativado por configuracao: usuarios permanecem em `legacy`.
- Nao ha aplicacao em producao confirmada a partir deste repositorio local.
- Migrations antigas preservadas em `supabase/migrations_archive/pre-baseline-20260717/`.

## Regras

- Nao aplicar SQL direto no SQL Editor remoto para evolucao normal do schema.
- Nao executar `supabase migration repair` sem autorizacao explicita.
- Nao executar `supabase db push` sem autorizacao explicita.
- Antes de qualquer alteracao remota, gerar backup do banco e registrar
  `supabase migration list --db-url <DATABASE_URL>`.
- Antes de qualquer push, executar `supabase db push --dry-run --db-url <DATABASE_URL> --dns-resolver native`.
- Apenas uma pessoa ou processo deve executar o push remoto autorizado.
- Push real de migrations exige autorizacao explicita.
- Nunca incluir segredos em arquivos versionados ou logs compartilhados.

## Fluxo local para novas migrations

1. Criar migration com a CLI do projeto.
2. Validar em Supabase local com `supabase db reset --local --no-seed`.
3. Rodar testes e build do projeto.
4. Conferir `supabase migration list --local`.
5. Revisar o SQL gerado antes de propor aplicacao remota.

## Conferencia do historico remoto

Use estes comandos apenas para conferir o alinhamento antes de propor uma nova
mudanca de banco:

```bash
supabase migration list --db-url <DATABASE_URL>
supabase db push --dry-run --db-url <DATABASE_URL> --dns-resolver native
```

O estado esperado em desenvolvimento e:

```text
20260717112500_remote_schema_baseline.sql
20260717113000_add_question_sm2_scheduler.sql
20260717212105_harden_criar_perfil_automatico.sql
```

Com o historico alinhado, o `dry-run` nao deve listar migrations pendentes.
