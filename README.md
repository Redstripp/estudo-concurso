# Estudo Concurso

Sistema web para controle de estudos para concurso publico, com cadastro de materias, questoes para revisao, simulados, plano do dia, dashboard e estatisticas.

## Tecnologias

- HTML, CSS e JavaScript puro
- Supabase Auth
- Supabase Database com Row Level Security
- Sem build obrigatorio

## Como rodar localmente

1. Configure um projeto no Supabase.
2. Se o banco estiver vazio, no Supabase SQL Editor, execute o arquivo `supabase/schema.sql`.
   Se voce ja usa este app com seu Supabase atual, nao execute esse arquivo sem comparar antes.
3. Copie `js/config.example.js` para `js/config.js`.
4. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `js/config.js`.
   Para ver o bloco administrativo de protecao do banco, coloque seu e-mail em `window.ADMIN_EMAILS`.
5. Rode o servidor local:

```bash
npm run dev
```

No PowerShell do Windows, se o `npm` cair na politica de execucao, use `npm.cmd run dev`.

6. Abra `http://localhost:4173`.

Tambem da para abrir `index.html` diretamente no navegador, mas usar servidor local evita problemas com redirecionamentos e politicas do navegador.

## Configuracao local segura

- `js/config.js` contem credenciais locais do Supabase e deve ficar fora do Git.
- `js/config.example.js` e o modelo versionado para novos desenvolvedores.
- Para criar sua configuracao local, copie o modelo:

```bash
cp js/config.example.js js/config.js
```

No PowerShell:

```powershell
Copy-Item js/config.example.js js/config.js
```

Depois edite apenas o `js/config.js` local com a URL e a anon key do seu projeto.

## Configuracao do Supabase

Em Authentication > URL Configuration:

- Site URL local: `http://localhost:4173`
- Redirect URLs locais: `http://localhost:4173/app.html`
- Redirect URLs de producao:
  - a URL final da pagina inicial do site
  - a URL final do `app.html`

Se publicar no GitHub Pages, a URL geralmente fica neste formato:

- `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`
- `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/app.html`

Essas URLs precisam estar cadastradas no Supabase. Se faltar a pasta do repositorio na URL, o link de recuperacao pode abrir uma pagina 404.

## Banco de dados

- Para projeto novo, execute `supabase/schema.sql`.
- Para um banco antigo que ja tem as tabelas base, `supabase-melhoria-estudos.sql` continua servindo como migracao incremental.
- Para habilitar o arquivamento mensal, execute uma vez `supabase-arquivamento-mensal.sql` no SQL Editor do Supabase.
- Para habilitar edital verticalizado, reta final, pegadinhas da banca e ciclo 24h/7d/30d, execute uma vez `supabase-edital-concurso.sql`.
- Para habilitar planejamento semanal, fila diaria inteligente e Lei Seca, execute uma vez `supabase-planejamento-inteligente.sql`.
- Para sincronizar os dias de revisao configuraveis entre navegadores, execute uma vez `supabase-configuracao-revisao.sql`.
- Para habilitar a assistente de IA integrada com limite diario por usuario, execute uma vez `supabase-ia-assistente.sql`.

O schema cria as tabelas:

- `profiles`
- `materias`
- `sessoes_estudo`
- `questoes`
- `questoes_certas`
- `questoes_revisoes`
- `simulados`
- `plano_dia_materias`
- `estatisticas_mensais`
- `configuracoes_revisao`
- `edital_config`
- `edital_topicos`
- `pegadinhas_banca`
- `planejamento_semanal`
- `lei_seca_itens`
- `ia_uso_diario`

Ele tambem cria politicas de RLS para que cada usuario acesse apenas os seus proprios registros.

## Assistente de IA integrada

O sistema tem um botao opcional **Analisar com IA e sugerir preenchimento** no Caderno de Erros. Ele nao salva automaticamente: a IA apenas preenche sugestoes para o usuario revisar antes de salvar.

Para ativar em producao:

1. Execute `supabase-ia-assistente.sql` no SQL Editor.
2. Publique a Edge Function `supabase/functions/assistente-ia-questao`.
3. Configure os secrets da funcao:
   - `DEEPSEEK_API_KEY`: chave da API da DeepSeek.
   - `SUPABASE_SERVICE_ROLE_KEY`: service role key do seu projeto Supabase.
   - `IA_LIMITE_DIARIO`: opcional, padrao `20` analises por usuario/dia.
   - `IA_PROVIDER`: opcional, padrao `deepseek`.
   - `IA_MODEL`: opcional, padrao `deepseek-v4-flash`.
   - `IA_BASE_URL` e `IA_API_KEY`: opcionais para usar outro provedor compativel com OpenAI, como Qwen/DashScope.

Nao coloque chaves de IA no `js/config.js`, porque arquivos do GitHub Pages ficam publicos no navegador. Enquanto a funcao nao estiver configurada, o usuario pode usar o fluxo gratuito de prompt: gerar o prompt, colar em uma IA externa e colar a resposta de volta no sistema.

## Arquivamento mensal

O Dashboard mostra o ciclo mensal de revisao. No fim do mes, o usuario pode gerar um relatorio para imprimir/salvar como PDF. Nos primeiros dias do mes seguinte, o sistema libera a acao de arquivar o resumo estatistico e limpar as questoes detalhadas erradas/chutadas do ciclo anterior.

Antes da limpeza, os totais ficam salvos em `estatisticas_mensais`, e as telas de Dashboard/Estatisticas continuam considerando esses resumos no acumulado geral.

## Validacao rapida

```bash
npm run check:js
npm test
```

No PowerShell do Windows, use:

```powershell
npm.cmd run check:js
npm.cmd test
```

O primeiro comando faz uma checagem de sintaxe nos arquivos JavaScript. O segundo roda a suite unitária com Vitest.

## Checklist manual antes de publicar

- Criar conta e confirmar e-mail.
- Entrar e sair da conta.
- Recuperar senha.
- Criar, listar e excluir materia.
- Registrar uma questao errada.
- Criar um assunto do edital e vincular uma questao a ele.
- Registrar uma pegadinha da banca.
- Montar a grade semanal e gerar o Plano do Dia por ela.
- Gerar fila diaria inteligente.
- Gerar simulado por assunto do edital.
- Cadastrar e revisar um item de Lei Seca.
- Registrar acertos do dia.
- Gerar revisao/simulado e salvar resultado.
- Criar um simulado manual.
- Ver dashboard, desempenho diario e estatisticas.

## Estrutura

```text
.
|-- app.html
|-- index.html
|-- css/
|-- js/
|-- scripts/
|-- supabase/
|   `-- schema.sql
|-- supabase-melhoria-estudos.sql
|-- supabase-arquivamento-mensal.sql
|-- supabase-edital-concurso.sql
|-- supabase-planejamento-inteligente.sql
|-- supabase-configuracao-revisao.sql
`-- supabase-ia-assistente.sql
```
