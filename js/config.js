// js/config.js
const SUPABASE_URL = 'https://hrwsddiggaumzjxqpyoj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyd3NkZGlnZ2F1bXpqeHFweW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTUwODMsImV4cCI6MjA5MzQzMTA4M30.ofQ54DHsX5P8nag0oVqpNh3Lvnjj2wDU3TfAH_t2Oeg'

window.ADMIN_EMAILS = ['ewertonc29@gmail.com']

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
window.db = db
