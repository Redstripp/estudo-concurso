# Estudo Concurso

Sistema web para controle de estudos para concurso publico, com cadastro de materias, questoes para revisao, simulados, plano do dia, dashboard e estatisticas.

## Tecnologias

- HTML, CSS e JavaScript puro
- Supabase Auth
- Supabase Database com Row Level Security
- Sem build obrigatorio

## Como rodar localmente

1. Configure um projeto no Supabase.
2. Use o fluxo oficial de migrations em `docs/supabase-migrations.md` para preparar ou evoluir o banco.
   Nao use o SQL Editor remoto para mudancas de schema da aplicacao no fluxo normal.
3. Confira `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `js/config.js`.
   Esse arquivo e publico e versionado; ele pode conter somente URL publica e chave anon/publishable de frontend.
   Nunca coloque nele `service_role`, `sb_secret`, senha, connection string, PAT ou secrets de IA.
   Para ver o bloco administrativo de protecao do banco, coloque seu e-mail em `window.ADMIN_EMAILS`.
4. Rode o servidor local:

```bash
npm run dev
```

No PowerShell do Windows, se o `npm` cair na politica de execucao, use `npm.cmd run dev`.

5. Abra `http://localhost:4173`.

Tambem da para abrir `index.html` diretamente no navegador, mas usar servidor local evita problemas com redirecionamentos e politicas do navegador.

## Configuracao local segura

- `js/config.js` e publico e rastreado pelo Git porque roda no navegador.
- Ele pode conter somente `SUPABASE_URL` publica e chave `anon` legada ou publishable key moderna.
- Nunca coloque `service_role`, `sb_secret`, senha, connection string PostgreSQL, PAT, secrets de IA ou qualquer credencial privilegiada no frontend.
- `js/config.example.js` continua como modelo de referencia para novos projetos.
- Para comparar com o modelo, consulte `js/config.example.js`.
- Se usar outro projeto Supabase, altere apenas os valores publicos de frontend em `js/config.js`.

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

- O fluxo oficial de schema usa Supabase CLI e esta documentado em `docs/supabase-migrations.md`.
- Nao aplique novas mudancas diretamente no SQL Editor remoto durante o fluxo normal de desenvolvimento.
- Os arquivos `supabase-*.sql` na raiz sao historico do fluxo manual anterior e referencia de auditoria.
- O banco remoto de desenvolvimento esta alinhado com estas migrations:
  - `supabase/migrations/20260717112500_remote_schema_baseline.sql`;
  - `supabase/migrations/20260717113000_add_question_sm2_scheduler.sql`;
  - `supabase/migrations/20260717212105_harden_criar_perfil_automatico.sql`.
- O scheduler SM-2 esta instalado, mas permanece desativado por configuracao (`legacy`).
- Nao ha aplicacao em producao confirmada a partir deste repositorio local.
- Antes de qualquer alteracao remota, execute `supabase migration list --db-url <DATABASE_URL>` e `supabase db push --dry-run --db-url <DATABASE_URL> --dns-resolver native`.
- O push real de migrations exige autorizacao explicita.

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

Para ativar ou alterar esse recurso em ambiente remoto:

1. Trate `supabase-ia-assistente.sql` como referencia historica do fluxo manual anterior.
   Mudancas de banco devem virar migrations revisadas e autorizadas.
2. Publique a Edge Function `supabase/functions/assistente-ia-questao` somente no fluxo de deploy apropriado.
3. Configure os secrets da funcao fora do frontend:
   - `DEEPSEEK_API_KEY`: chave da API da DeepSeek.
   - `SUPABASE_SERVICE_ROLE_KEY`: service role key do seu projeto Supabase.
   - `IA_LIMITE_DIARIO`: opcional, padrao `20` analises por usuario/dia.
   - `IA_ALLOWED_ORIGINS`: opcional, origens separadas por virgula autorizadas no CORS. Padrao: `https://redstripp.github.io`.
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
|-- supabase-gamificacao-resumo.sql
`-- supabase-ia-assistente.sql
```
