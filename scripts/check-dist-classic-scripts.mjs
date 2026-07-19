import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const distDir = resolve('dist')
const pages = ['app.html', 'index.html']
const errors = []

function readDistPage(page) {
  const filePath = resolve(distDir, page)
  if (!existsSync(filePath)) {
    errors.push(`Arquivo ausente em dist: ${page}`)
    return ''
  }

  return readFileSync(filePath, 'utf8')
}

function getClassicScriptSources(html) {
  return [...html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/g)]
    .map(match => match[1])
    .filter(src => src.startsWith('js/'))
}

const scriptsByPage = new Map()

for (const page of pages) {
  const html = readDistPage(page)
  const scripts = getClassicScriptSources(html)
  scriptsByPage.set(page, scripts)

  for (const script of scripts) {
    const scriptPath = resolve(distDir, script)
    if (!existsSync(scriptPath)) {
      errors.push(`${page} referencia ${script}, mas o arquivo nao existe em dist.`)
    }
  }
}

const appScripts = scriptsByPage.get('app.html') || []
const requiredAppScripts = [
  'js/config.js',
  'js/auth.js',
  'js/utils.js',
  'js/questoes-sm2.js',
  'js/questoes.js',
  'js/revisao.js',
  'js/app.js'
]

for (const script of requiredAppScripts) {
  if (!appScripts.includes(script)) {
    errors.push(`dist/app.html nao referencia ${script}.`)
  }
}

function assertBefore(first, second) {
  const firstIndex = appScripts.indexOf(first)
  const secondIndex = appScripts.indexOf(second)
  if (firstIndex === -1 || secondIndex === -1) return
  if (firstIndex > secondIndex) {
    errors.push(`${first} deve carregar antes de ${second} em dist/app.html.`)
  }
}

assertBefore('js/questoes-sm2.js', 'js/questoes.js')
assertBefore('js/questoes-sm2.js', 'js/revisao.js')
assertBefore('js/utils.js', 'js/revisao.js')
assertBefore('js/revisao.js', 'js/app.js')

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`dist validado: ${appScripts.length} scripts classicos em app.html.`)
