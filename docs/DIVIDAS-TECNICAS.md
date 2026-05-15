# Dividas tecnicas

Este documento registra comportamentos antigos que foram preservados durante a migracao gradual para TypeScript para evitar mudancas de comportamento sem uma etapa propria de validacao.

## Funcoes de data

- A funcao `diaAnterior` foi migrada em paralelo para TypeScript preservando o comportamento legado.
- Atualmente, valores invalidos, string vazia, valor ausente e `Date` podem retornar `"NaN-NaN-NaN"`.
- Isso foi mantido de proposito para evitar mudanca de comportamento durante a migracao.
- Futuramente, criar uma etapa especifica para melhorar validacao de datas.
- Essa melhoria futura deve ser feita com testes e autorizacao separada.
