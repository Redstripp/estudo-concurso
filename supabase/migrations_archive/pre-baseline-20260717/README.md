# Arquivo pre-baseline 2026-07-17

Estas migrations foram preservadas fora da pasta ativa porque o banco remoto de
desenvolvimento ja contem seus efeitos, mas nao possui historico oficial em
`supabase_migrations.schema_migrations`.

O baseline ativo `20260717112500_remote_schema_baseline.sql` representa o estado
remoto imediatamente anterior ao SM-2. Manter estes arquivos arquivados evita que
a Supabase CLI tente reaplicar alteracoes antigas quando o historico oficial for
regularizado.

Arquivos preservados:

- `20260515163000_hardening_grants_public_tables.sql`
- `20260520230931_create_flashcards.sql`

Nao apagar estes arquivos; eles continuam sendo evidencia historica do fluxo
manual anterior ao baseline.
