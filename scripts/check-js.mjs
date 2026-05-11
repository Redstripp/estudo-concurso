import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const arquivos = readdirSync(join(root, 'js'))
  .filter(nome => nome.endsWith('.js'))
  .map(nome => join(root, 'js', nome))

let falhou = false

for (const arquivo of arquivos) {
  const resultado = spawnSync(process.execPath, ['--check', arquivo], {
    stdio: 'inherit'
  })

  if (resultado.status !== 0) falhou = true
}

process.exit(falhou ? 1 : 0)
