# Rotina de Testes

Use este guia para testar o sistema antes de publicar qualquer alteracao.

## 1. Quando usar esta rotina

- Antes de publicar qualquer alteracao.
- Depois de qualquer mudanca feita por IA.
- Depois de mudancas em Supabase, JavaScript, HTML ou CSS.
- Depois de aplicar migrations.

## 2. Testes automaticos

Execute:

```bash
npm run check:js
npm test
```

## 3. Testes manuais obrigatorios

- Abrir `index.html` ou o site publicado.
- Verificar se o console do navegador nao mostra erros vermelhos.
- Testar cadastro.
- Testar login.
- Testar logout.
- Confirmar que `app.html` abre apos login.
- Abrir Dashboard.
- Testar Materias.
- Testar Questoes.
- Testar Caderno de Erros.
- Testar Simulados.
- Testar Estatisticas.
- Testar Revisao.
- Testar Gamificacao, se aparecer no menu.
- Testar Assistente de IA, se estiver disponivel.

## 4. Checklist de erro

Se aparecer erro:

- Nao tentar corrigir tudo de uma vez.
- Copiar o erro completo do console.
- Identificar qual arquivo aparece no erro.
- Identificar se o erro veio de JS, Supabase, RLS, grant ou arquivo 404.
- Pedir uma correcao minima.

## 5. Regra principal

Nunca publicar se:

- `npm run check:js` falhar.
- `npm test` falhar.
- Login nao funcionar.
- Console mostrar erro vermelho grave.
- Algum arquivo JS/CSS estiver dando 404.
- Supabase bloquear operacoes normais do usuario logado.
