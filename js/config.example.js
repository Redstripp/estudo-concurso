// Copie este arquivo para js/config.js e preencha com os dados do seu projeto.
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co'
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_PUBLICA'

// Opcional: e-mails que podem ver o bloco administrativo de protecao do banco.
// Deixe vazio para esconder esse bloco de todos os usuarios.
window.ADMIN_EMAILS = ['seu-email@exemplo.com']

// A assistente de IA integrada usa Supabase Edge Function.
// NUNCA coloque chaves de IA neste arquivo, porque ele fica publico no navegador.

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
