# Regras para IA

Este arquivo orienta qualquer IA que for mexer neste projeto.

## Regras obrigatorias

- Nao refatorar o sistema inteiro sem autorizacao.
- Nao migrar para React, TypeScript ou Vite sem autorizacao.
- Nao alterar IDs do HTML sem procurar onde eles sao usados no JavaScript.
- Nao alterar nomes de tabelas do Supabase sem autorizacao.
- Nao colocar chaves secretas no frontend.
- Nao remover funcionalidades existentes.
- Fazer mudancas pequenas e reversiveis.
- Listar arquivos alterados.
- Rodar `npm run check:js` e `npm test` apos mudancas.
- Se algum teste quebrar, parar e mostrar o erro.
