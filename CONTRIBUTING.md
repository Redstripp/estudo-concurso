# Contribuindo

## Configuracao local

1. Instale as dependencias com `npm install`.
2. Copie `js/config.example.js` para `js/config.js`.
3. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` no `js/config.js`.
4. Rode `npm run dev` e acesse `http://localhost:4173`.

No PowerShell do Windows, use `npm.cmd run dev` se a politica de execucao bloquear o shim do `npm`.

`js/config.js` e um arquivo local com credenciais e nao deve ser commitado. O modelo seguro para versionamento e `js/config.example.js`.

## Testes e validacao

Antes de abrir uma alteracao, rode:

```bash
npm run check:js
npm test
```

No PowerShell:

```powershell
npm.cmd run check:js
npm.cmd test
```

Os testes usam Vitest e JSDOM. Os scripts da aplicacao sao carregados pelo `tests/setup.js`, que simula o DOM e publica helpers em `globalThis` apenas no ambiente de teste.

## Padroes de codigo

- Mantenha os arquivos JavaScript sem etapa de build obrigatoria.
- Prefira funcoes pequenas e nomes especificos por modulo para evitar colisao entre scripts globais.
- Ao adicionar uma funcao testavel, exponha-a no bloco de exportacao para Vitest no fim do arquivo.
- Nao coloque chaves privadas, service role keys ou tokens de IA em arquivos do frontend.
- Use `js/config.example.js` para documentar variaveis esperadas, sem credenciais reais.
